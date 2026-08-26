use std::{
    error::Error,
    ffi::c_void,
    fs::OpenOptions,
    mem::ManuallyDrop,
    os::windows::ffi::OsStrExt,
    path::{Path, PathBuf},
    ptr::NonNull,
    sync::{mpsc, Arc, Condvar, Mutex},
    thread::{self, JoinHandle},
    time::Duration,
};

use windows::{
    core::{implement, Error as WindowsError, Interface, Ref, HRESULT, PCWSTR},
    Win32::{
        Foundation::{CloseHandle, HANDLE, HWND, RECT},
        Security::SECURITY_ATTRIBUTES,
        Storage::FileSystem::{CreateFileW, FILE_ATTRIBUTE_NORMAL, FILE_SHARE_READ, OPEN_EXISTING},
        System::{
            Com::{ISequentialStream_Impl, IStream, IStream_Impl},
            Threading::{WaitForSingleObject, INFINITE},
        },
    },
};

use windows::Win32::System::Com::{
    COINIT_APARTMENTTHREADED, LOCKTYPE, STATFLAG, STATSTG, STGC, STREAM_SEEK, STREAM_SEEK_CUR,
    STREAM_SEEK_END, STREAM_SEEK_SET,
};

use super::{
    check_hr, wait_for_quiescence_with_message_pump, ComApartment, Gate, IInitializeWithStream,
    LoadedHandler, MarshaledStreamPacket, E_FAIL, E_NOTIMPL, E_POINTER, S_OK,
};

#[derive(Default)]
struct ExperimentCallStateInner {
    seek_entered: bool,
    read_entered: bool,
    position: u64,
}

struct ExperimentCallState {
    state: Mutex<ExperimentCallStateInner>,
    changed: Condvar,
}

impl ExperimentCallState {
    fn new() -> Arc<Self> {
        Arc::new(Self {
            state: Mutex::new(ExperimentCallStateInner::default()),
            changed: Condvar::new(),
        })
    }

    fn mark_seek(&self) {
        lock(&self.state).seek_entered = true;
        self.changed.notify_all();
    }

    fn mark_read(&self) {
        lock(&self.state).read_entered = true;
        self.changed.notify_all();
    }

    fn wait_until<F>(&self, timeout: Duration, predicate: F) -> bool
    where
        F: Fn(&ExperimentCallStateInner) -> bool,
    {
        let deadline = std::time::Instant::now() + timeout;
        let mut state = lock(&self.state);
        while !predicate(&state) {
            let remaining = deadline.saturating_duration_since(std::time::Instant::now());
            if remaining.is_zero() {
                return false;
            }
            let (next, result) = self
                .changed
                .wait_timeout(state, remaining)
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            state = next;
            if result.timed_out() && !predicate(&state) {
                return false;
            }
        }
        true
    }

    fn seek_entered(&self) -> bool {
        lock(&self.state).seek_entered
    }

    fn read_entered(&self) -> bool {
        lock(&self.state).read_entered
    }
}

struct NonCooperativeReadState {
    release_read: Arc<Gate>,
    state: Mutex<bool>,
    changed: Condvar,
}

impl NonCooperativeReadState {
    fn new() -> Result<Arc<Self>, Box<dyn Error>> {
        Ok(Arc::new(Self {
            release_read: Arc::new(Gate::new()?),
            state: Mutex::new(false),
            changed: Condvar::new(),
        }))
    }

    fn wait_for_release(&self) {
        let _ = unsafe { WaitForSingleObject(self.release_read.handle(), INFINITE) };
    }

    fn mark_exited(&self) {
        *lock(&self.state) = true;
        self.changed.notify_all();
    }

    fn read_exited(&self) -> bool {
        *lock(&self.state)
    }

    fn wait_until_exited(&self, timeout: Duration) -> bool {
        let deadline = std::time::Instant::now() + timeout;
        let mut exited = lock(&self.state);
        while !*exited {
            let remaining = deadline.saturating_duration_since(std::time::Instant::now());
            if remaining.is_zero() {
                return false;
            }
            let (next, result) = self
                .changed
                .wait_timeout(exited, remaining)
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            exited = next;
            if result.timed_out() && !*exited {
                return false;
            }
        }
        true
    }

    fn release(&self) {
        self.release_read.signal();
    }
}

struct LockedFile(HANDLE);

impl Drop for LockedFile {
    fn drop(&mut self) {
        unsafe {
            let _ = CloseHandle(self.0);
        }
    }
}

#[allow(non_snake_case)]
#[implement(IStream, Agile = false)]
struct ExperimentStream {
    calls: Arc<ExperimentCallState>,
    non_cooperative: Option<Arc<NonCooperativeReadState>>,
    _locked_file: Option<LockedFile>,
}

#[allow(non_snake_case)]
impl ISequentialStream_Impl for ExperimentStream_Impl {
    fn Read(&self, pv: *mut c_void, cb: u32, pcbread: *mut u32) -> HRESULT {
        if (cb != 0 && pv.is_null()) || pcbread.is_null() {
            return E_POINTER;
        }
        self.calls.mark_read();
        if let Some(non_cooperative) = &self.non_cooperative {
            // This is the acceptance fixture's only blocking operation. It
            // waits on a teardown event and deliberately does not inspect
            // CoTestCancel, HostProvided state or any private cancel flag.
            non_cooperative.wait_for_release();
            non_cooperative.mark_exited();
        }
        let bytes: &[u8] = if self.non_cooperative.is_some() {
            b"non-cooperative read"
        } else {
            b"probe read"
        };
        let count = cb.min(bytes.len() as u32);
        unsafe {
            std::ptr::copy_nonoverlapping(bytes.as_ptr(), pv.cast::<u8>(), count as usize);
            *pcbread = count;
        }
        let mut state = lock(&self.calls.state);
        state.position = state.position.saturating_add(u64::from(count));
        S_OK
    }

    fn Write(&self, _pv: *const c_void, _cb: u32, pcbwritten: *mut u32) -> HRESULT {
        if !pcbwritten.is_null() {
            unsafe { *pcbwritten = 0 };
        }
        E_NOTIMPL
    }
}

#[allow(non_snake_case)]
impl IStream_Impl for ExperimentStream_Impl {
    fn Seek(
        &self,
        dlibmove: i64,
        dworigin: STREAM_SEEK,
        plibnewposition: *mut u64,
    ) -> windows::core::Result<()> {
        if plibnewposition.is_null() {
            return Err(WindowsError::from_hresult(E_POINTER));
        }
        self.calls.mark_seek();
        let mut state = lock(&self.calls.state);
        let base = match dworigin {
            STREAM_SEEK_SET => 0_i128,
            STREAM_SEEK_CUR => i128::from(state.position),
            STREAM_SEEK_END => 0_i128,
            _ => return Err(WindowsError::from_hresult(E_FAIL)),
        };
        let position = base + i128::from(dlibmove);
        if position < 0 || position > i128::from(u64::MAX) {
            return Err(WindowsError::from_hresult(E_FAIL));
        }
        state.position = position as u64;
        unsafe { *plibnewposition = state.position };
        Ok(())
    }

    fn SetSize(&self, _libnewsize: u64) -> windows::core::Result<()> {
        Err(WindowsError::from_hresult(E_NOTIMPL))
    }

    fn CopyTo(
        &self,
        _pstm: Ref<'_, IStream>,
        _cb: u64,
        _pcbread: *mut u64,
        _pcbwritten: *mut u64,
    ) -> windows::core::Result<()> {
        Err(WindowsError::from_hresult(E_NOTIMPL))
    }

    fn Commit(&self, _grfcommitflags: &STGC) -> windows::core::Result<()> {
        Err(WindowsError::from_hresult(E_NOTIMPL))
    }

    fn Revert(&self) -> windows::core::Result<()> {
        Err(WindowsError::from_hresult(E_NOTIMPL))
    }

    fn LockRegion(
        &self,
        _liboffset: u64,
        _cb: u64,
        _dwlocktype: &LOCKTYPE,
    ) -> windows::core::Result<()> {
        Err(WindowsError::from_hresult(E_NOTIMPL))
    }

    fn UnlockRegion(
        &self,
        _liboffset: u64,
        _cb: u64,
        _dwlocktype: u32,
    ) -> windows::core::Result<()> {
        Err(WindowsError::from_hresult(E_NOTIMPL))
    }

    fn Stat(&self, _pstatstg: *mut STATSTG, _grfstatflag: &STATFLAG) -> windows::core::Result<()> {
        Err(WindowsError::from_hresult(E_NOTIMPL))
    }

    fn Clone(&self) -> windows::core::Result<IStream> {
        Err(WindowsError::from_hresult(E_NOTIMPL))
    }
}

struct ExperimentSource {
    calls: Arc<ExperimentCallState>,
    non_cooperative: Option<Arc<NonCooperativeReadState>>,
    shutdown: Arc<Gate>,
    thread: Option<JoinHandle<()>>,
}

impl ExperimentSource {
    fn probe() -> Result<(Self, IStream), Box<dyn Error>> {
        Self::create(None)
    }

    fn non_cooperative(path: &Path) -> Result<(Self, IStream), Box<dyn Error>> {
        Self::create(Some(path.to_path_buf()))
    }

    fn create(path: Option<PathBuf>) -> Result<(Self, IStream), Box<dyn Error>> {
        let calls = ExperimentCallState::new();
        let non_cooperative = if path.is_some() {
            Some(NonCooperativeReadState::new()?)
        } else {
            None
        };
        let shutdown = Arc::new(Gate::new()?);
        let (sender, receiver) = mpsc::sync_channel::<Result<MarshaledStreamPacket, String>>(1);
        let thread_calls = Arc::clone(&calls);
        let thread_non_cooperative = non_cooperative.as_ref().map(Arc::clone);
        let thread_shutdown = Arc::clone(&shutdown);
        let thread = thread::spawn(move || {
            let Ok(_com) = ComApartment::initialize(COINIT_APARTMENTTHREADED) else {
                let _ = sender.send(Err("source STA CoInitializeEx failed".to_string()));
                return;
            };
            let locked_file = path.as_ref().map(|path| {
                let wide = path
                    .as_os_str()
                    .encode_wide()
                    .chain(std::iter::once(0))
                    .collect::<Vec<_>>();
                unsafe {
                    CreateFileW(
                        PCWSTR(wide.as_ptr()),
                        windows::Win32::Foundation::GENERIC_READ.0,
                        FILE_SHARE_READ,
                        None::<*const SECURITY_ATTRIBUTES>,
                        OPEN_EXISTING,
                        FILE_ATTRIBUTE_NORMAL,
                        None,
                    )
                    .map(LockedFile)
                    .map_err(|error| format!("locked file open failed: {error:?}"))
                }
            });
            let locked_file = match locked_file.transpose() {
                Ok(locked_file) => locked_file,
                Err(error) => {
                    let _ = sender.send(Err(error));
                    return;
                }
            };
            let stream: IStream = ExperimentStream {
                calls: thread_calls,
                non_cooperative: thread_non_cooperative,
                _locked_file: locked_file,
            }
            .into();
            let result = unsafe {
                windows::Win32::System::Com::Marshal::CoMarshalInterThreadInterfaceInStream(
                    &IStream::IID,
                    &stream,
                )
                .map_err(|error| format!("source stream marshal failed: {error:?}"))
                .and_then(|stream| {
                    let raw = Interface::into_raw(stream);
                    NonNull::new(raw)
                        .map(|raw| MarshaledStreamPacket { raw })
                        .ok_or_else(|| "COM marshal returned a null stream".to_string())
                })
            };
            let Ok(packet) = result else {
                let _ = sender.send(result);
                return;
            };
            if sender.send(Ok(packet)).is_err() {
                return;
            }
            super::wait_for_shutdown_with_message_pump(&thread_shutdown);
            drop(stream);
        });

        let packet = match receiver.recv() {
            Ok(Ok(packet)) => packet,
            Ok(Err(error)) => {
                shutdown.signal();
                let _ = thread.join();
                return Err(error.to_string().into());
            }
            Err(error) => {
                shutdown.signal();
                let _ = thread.join();
                return Err(error.to_string().into());
            }
        };
        let raw = packet.raw;
        std::mem::forget(packet);
        let marshal_stream = ManuallyDrop::new(unsafe { IStream::from_raw(raw.as_ptr()) });
        let stream = unsafe {
            windows::Win32::System::Com::StructuredStorage::CoGetInterfaceAndReleaseStream(
                &*marshal_stream,
            )?
        };
        Ok((
            Self {
                calls,
                non_cooperative,
                shutdown,
                thread: Some(thread),
            },
            stream,
        ))
    }

    fn wait_until_seek_entered(&self, timeout: Duration) -> bool {
        self.calls.wait_until(timeout, |state| state.seek_entered)
    }

    fn wait_until_read_entered(&self, timeout: Duration) -> bool {
        self.calls.wait_until(timeout, |state| state.read_entered)
    }

    fn seek_entered(&self) -> bool {
        self.calls.seek_entered()
    }

    fn read_entered(&self) -> bool {
        self.calls.read_entered()
    }

    fn read_exited(&self) -> bool {
        self.non_cooperative
            .as_ref()
            .is_some_and(|state| state.read_exited())
    }

    fn wait_until_read_exited(&self, timeout: Duration) -> bool {
        self.non_cooperative
            .as_ref()
            .is_some_and(|state| state.wait_until_exited(timeout))
    }

    fn release_for_cleanup(&self) {
        if let Some(non_cooperative) = self.non_cooperative.as_ref() {
            non_cooperative.release();
        }
        self.shutdown.signal();
    }

    fn shutdown_and_join(&mut self) {
        self.release_for_cleanup();
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

impl Drop for ExperimentSource {
    fn drop(&mut self) {
        self.shutdown_and_join();
    }
}

#[derive(Debug, Clone, Copy)]
struct FileLockObservation {
    write_blocked: bool,
    rename_blocked: bool,
    delete_blocked: bool,
}

impl FileLockObservation {
    fn all_blocked(self) -> bool {
        self.write_blocked && self.rename_blocked && self.delete_blocked
    }
}

struct ReturnSignal {
    returned: Mutex<bool>,
    changed: Condvar,
}

impl ReturnSignal {
    fn new() -> Arc<Self> {
        Arc::new(Self {
            returned: Mutex::new(false),
            changed: Condvar::new(),
        })
    }

    fn mark_returned(&self) {
        *lock(&self.returned) = true;
        self.changed.notify_all();
    }

    fn wait_until_returned(&self, timeout: Duration) -> bool {
        let deadline = std::time::Instant::now() + timeout;
        let mut returned = lock(&self.returned);
        while !*returned {
            let remaining = deadline.saturating_duration_since(std::time::Instant::now());
            if remaining.is_zero() {
                return false;
            }
            let (next, result) = self
                .changed
                .wait_timeout(returned, remaining)
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            returned = next;
            if result.timed_out() && !*returned {
                return false;
            }
        }
        true
    }
}

fn probe_file_lock(path: &Path) -> FileLockObservation {
    let write_blocked = OpenOptions::new().write(true).open(path).is_err();
    let renamed = path.with_extension("non-cooperative-renamed");
    let rename_blocked = match std::fs::rename(path, &renamed) {
        Ok(()) => {
            let _ = std::fs::rename(&renamed, path);
            false
        }
        Err(_) => true,
    };
    let delete_blocked = match std::fs::remove_file(path) {
        Ok(()) => {
            let _ = std::fs::write(path, b"restored after unexpected unlock\r\n");
            false
        }
        Err(_) => true,
    };
    FileLockObservation {
        write_blocked,
        rename_blocked,
        delete_blocked,
    }
}

pub(super) fn run_admission_race_case(
    handler_dll: &LoadedHandler,
    handler: &windows::Win32::UI::Shell::IPreviewHandler,
    initializer: &IInitializeWithStream,
    ole_window: &windows::Win32::System::Ole::IOleWindow,
    host: HWND,
    rect: RECT,
) -> Result<(), Box<dyn Error>> {
    let (source, stream) = ExperimentSource::probe()?;
    handler_dll.reset_cancel_observation();
    handler_dll.arm_before_stream_operations();
    unsafe { initializer.Initialize(&stream, 0)? };
    drop(stream);
    unsafe {
        handler.SetWindow(host, &rect)?;
        handler.DoPreview()?;
    }
    if !handler_dll.wait_for_before_stream_operations(5000) {
        handler_dll.release_before_stream_operations();
        return Err("admission-race gate was not reached after registry lease acquisition".into());
    }
    if source.seek_entered() || source.read_entered() {
        handler_dll.release_before_stream_operations();
        return Err("admission-race gate was reached after a COM stream operation".into());
    }

    unsafe { handler.Unload()? };
    let (status, child) = unsafe { super::raw_get_window(ole_window) };
    check_hr(
        status,
        super::E_FAIL,
        "admission-race GetWindow after Unload",
    )?;
    if !child.is_invalid() || handler_dll.record_count() != 0 {
        handler_dll.release_before_stream_operations();
        return Err("admission-race Unload did not revoke publication immediately".into());
    }
    let cancel_count = handler_dll.cancel_call_count();
    let first_cancel = handler_dll.first_cancel_hresult();
    let last_cancel = handler_dll.last_cancel_hresult();

    handler_dll.release_before_stream_operations();
    if !wait_for_quiescence_with_message_pump(handler_dll) {
        return Err("admission-race worker did not quiesce after releasing the gate".into());
    }
    if !source.seek_entered() || !source.read_entered() {
        return Err(
            "admission-race did not observe the future Seek/Read after cancellation request".into(),
        );
    }
    println!(
        "HARNESS admission race (cancel before COM call): REPRODUCED; CoCancelCall attempts={cancel_count}, first={first_cancel:?}, last={last_cancel:?}; future Seek/Read occurred after Unload"
    );
    Ok(())
}

pub(super) fn run_seek_read_gap_case(
    handler_dll: &LoadedHandler,
    handler: &windows::Win32::UI::Shell::IPreviewHandler,
    initializer: &IInitializeWithStream,
    ole_window: &windows::Win32::System::Ole::IOleWindow,
    host: HWND,
    rect: RECT,
) -> Result<(), Box<dyn Error>> {
    let (source, stream) = ExperimentSource::probe()?;
    handler_dll.reset_cancel_observation();
    handler_dll.arm_after_seek();
    unsafe { initializer.Initialize(&stream, 0)? };
    drop(stream);
    unsafe {
        handler.SetWindow(host, &rect)?;
        handler.DoPreview()?;
    }
    if !handler_dll.wait_for_after_seek(5000)
        || !source.wait_until_seek_entered(Duration::from_secs(5))
    {
        handler_dll.release_after_seek();
        return Err("Seek-to-Read gate was not reached after Seek completed".into());
    }
    if source.read_entered() {
        handler_dll.release_after_seek();
        return Err("Seek-to-Read gate was reached after Read had already started".into());
    }

    unsafe { handler.Unload()? };
    let (status, child) = unsafe { super::raw_get_window(ole_window) };
    check_hr(
        status,
        super::E_FAIL,
        "Seek-to-Read gap GetWindow after Unload",
    )?;
    if !child.is_invalid() || handler_dll.record_count() != 0 || source.read_entered() {
        handler_dll.release_after_seek();
        return Err("Seek-to-Read gap Unload did not revoke state before Read".into());
    }
    let cancel_count = handler_dll.cancel_call_count();
    let first_cancel = handler_dll.first_cancel_hresult();
    let last_cancel = handler_dll.last_cancel_hresult();

    handler_dll.release_after_seek();
    if !wait_for_quiescence_with_message_pump(handler_dll) {
        return Err("Seek-to-Read gap worker did not quiesce after releasing the gate".into());
    }
    if !source.read_entered() {
        return Err("Seek-to-Read gap did not observe Read after cancellation request".into());
    }
    println!(
        "HARNESS cancellation between Seek and Read: REPRODUCED; CoCancelCall attempts={cancel_count}, first={first_cancel:?}, last={last_cancel:?}; Read occurred after Unload"
    );
    Ok(())
}

pub(super) fn run_non_cooperative_file_lock_case(
    handler_dll: &LoadedHandler,
    handler: &windows::Win32::UI::Shell::IPreviewHandler,
    initializer: &IInitializeWithStream,
    ole_window: &windows::Win32::System::Ole::IOleWindow,
    fixture: &super::Fixture,
    host: HWND,
    rect: RECT,
) -> Result<(), Box<dyn Error>> {
    println!("HARNESS non-cooperative experiment: create lock-bearing source");
    let path = fixture.create_generation(4)?;
    let (source, stream) = ExperimentSource::non_cooperative(&path)?;
    println!("HARNESS non-cooperative experiment: source marshaled");
    handler_dll.reset_cancel_observation();
    unsafe { initializer.Initialize(&stream, 0)? };
    drop(stream);
    println!("HARNESS non-cooperative experiment: handler initialized");
    unsafe {
        handler.SetWindow(host, &rect)?;
        handler.DoPreview()?;
    }
    println!("HARNESS non-cooperative experiment: DoPreview returned");
    if !source.wait_until_read_entered(Duration::from_secs(5))
        || !handler_dll.wait_for_read_entered(5000)
    {
        return Err("non-cooperative IStream::Read did not enter".into());
    }
    println!("HARNESS non-cooperative experiment: server Read entered");
    let before = probe_file_lock(&path);
    if !before.all_blocked() {
        return Err(format!(
            "non-cooperative fixture was not lock-bearing before Unload: {before:?}"
        )
        .into());
    }

    println!("HARNESS non-cooperative experiment: calling Unload");
    let unload_return = ReturnSignal::new();
    let watchdog_return = Arc::clone(&unload_return);
    let watchdog_read = source
        .non_cooperative
        .as_ref()
        .expect("non-cooperative source state")
        .clone();
    let watchdog_shutdown = Arc::clone(&source.shutdown);
    let watchdog_path = path.clone();
    let watchdog_wait_for_quiescence = handler_dll.wait_for_read_quiescence;
    let watchdog_record_count = handler_dll.record_count;
    let watchdog_cancel_call_count = handler_dll.cancel_call_count;
    let watchdog_first_cancel_hresult = handler_dll.first_cancel_hresult;
    let watchdog_last_cancel_hresult = handler_dll.last_cancel_hresult;
    let watchdog_unload_phase = handler_dll.unload_phase;
    let watchdog = thread::spawn(move || {
        if watchdog_return.wait_until_returned(Duration::from_secs(2)) {
            return false;
        }
        let file_lock = probe_file_lock(&watchdog_path);
        let server_read_exited = watchdog_read.read_exited();
        let worker_quiescent = unsafe { watchdog_wait_for_quiescence(0).as_bool() };
        let record_count = unsafe { watchdog_record_count() };
        let cancel_count = unsafe { watchdog_cancel_call_count() };
        let first_cancel = HRESULT(unsafe { watchdog_first_cancel_hresult() });
        let last_cancel = HRESULT(unsafe { watchdog_last_cancel_hresult() });
        let unload_phase = unsafe { watchdog_unload_phase() };
        println!(
            "HARNESS non-cooperative Unload diagnostic timeout: manual_unblock_before_assertion=false; unload_phase={unload_phase}; CoCancelCall attempts={cancel_count}, first={first_cancel:?}, last={last_cancel:?}; record_count={record_count}, worker_quiescent={worker_quiescent}, server_read_exited={server_read_exited}, file_lock={{write_blocked:{}, rename_blocked:{}, delete_blocked:{}}}",
            file_lock.write_blocked,
            file_lock.rename_blocked,
            file_lock.delete_blocked,
        );
        if file_lock.all_blocked() && !server_read_exited {
            println!(
                "HARNESS non-cooperative in-flight file-lock hard boundary: OUTCOME B / STOP CONDITION #5 REPRODUCED"
            );
        }

        // Teardown follows the diagnostic assertion. It must never be used
        // to make the hard-boundary result pass.
        watchdog_read.release();
        watchdog_shutdown.signal();
        true
    });
    let unload_result = unsafe { handler.Unload() };
    unload_return.mark_returned();
    let unload_was_diagnostic_timeout = watchdog
        .join()
        .map_err(|_| "non-cooperative Unload watchdog panicked")?;
    println!("HARNESS non-cooperative experiment: Unload returned");
    unload_result?;

    let (status, child) = unsafe { super::raw_get_window(ole_window) };
    check_hr(
        status,
        super::E_FAIL,
        "non-cooperative GetWindow after Unload",
    )?;
    if !child.is_invalid() || handler_dll.record_count() != 0 {
        return Err("non-cooperative Unload did not revoke publication immediately".into());
    }

    if !unload_was_diagnostic_timeout {
        let after = probe_file_lock(&path);
        let read_exited = source.read_exited();
        let worker_quiescent = handler_dll.wait_for_read_quiescence(0);
        let cancel_count = handler_dll.cancel_call_count();
        let first_cancel = handler_dll.first_cancel_hresult();
        let last_cancel = handler_dll.last_cancel_hresult();
        println!(
            "HARNESS non-cooperative standard-marshaled Read after Unload: CoCancelCall attempts={cancel_count}, first={first_cancel:?}, last={last_cancel:?}; worker_quiescent={worker_quiescent}, server_read_exited={read_exited}, file_lock_after={{write_blocked:{}, rename_blocked:{}, delete_blocked:{}}}",
            after.write_blocked,
            after.rename_blocked,
            after.delete_blocked,
        );
        if after.all_blocked() && !read_exited {
            println!(
                "HARNESS non-cooperative in-flight file-lock hard boundary: OUTCOME B / STOP CONDITION #5 REPRODUCED"
            );
        }
        source.release_for_cleanup();
    }
    if !source.wait_until_read_exited(Duration::from_secs(5)) {
        return Err(
            "non-cooperative source did not exit after post-observation cleanup release".into(),
        );
    }
    if !wait_for_quiescence_with_message_pump(handler_dll) {
        return Err("non-cooperative worker did not quiesce after fixture teardown".into());
    }
    Ok(())
}

fn lock<T>(value: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    value
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}
