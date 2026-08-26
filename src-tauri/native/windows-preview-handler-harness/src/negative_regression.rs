use std::{
    ffi::c_void,
    fs::{self, OpenOptions},
    mem::ManuallyDrop,
    os::windows::ffi::OsStrExt,
    path::Path,
    ptr::NonNull,
    sync::{mpsc, Arc, Condvar, Mutex},
    thread,
    time::Duration,
};

use windows::{
    core::{implement, Error as WindowsError, Interface, Ref, HRESULT, PCWSTR},
    Win32::{
        Foundation::{CloseHandle, GENERIC_READ, HANDLE},
        Security::SECURITY_ATTRIBUTES,
        Storage::FileSystem::{CreateFileW, FILE_ATTRIBUTE_NORMAL, FILE_SHARE_READ, OPEN_EXISTING},
        System::{
            Com::Marshal::CoMarshalInterThreadInterfaceInStream,
            Com::StructuredStorage::CoGetInterfaceAndReleaseStream,
            Com::{
                CoCancelCall, CoDisableCallCancellation, CoEnableCallCancellation, CoInitializeEx,
                ISequentialStream_Impl, IStream, IStream_Impl, COINIT_APARTMENTTHREADED,
                COINIT_MULTITHREADED, LOCKTYPE, STATFLAG, STATSTG, STGC, STREAM_SEEK,
                STREAM_SEEK_CUR, STREAM_SEEK_END, STREAM_SEEK_SET,
            },
            Threading::{CreateEventW, GetCurrentThreadId, SetEvent, INFINITE},
        },
    },
};

const E_FAIL: HRESULT = HRESULT(0x80004005_u32 as _);
const E_NOTIMPL: HRESULT = HRESULT(0x80004001_u32 as _);
const E_POINTER: HRESULT = HRESULT(0x80004003_u32 as _);
const S_OK: HRESULT = HRESULT(0);

#[derive(Default)]
struct ReadStateInner {
    entered: bool,
    exited: bool,
    release: bool,
}

struct ReadState {
    state: Mutex<ReadStateInner>,
    changed: Condvar,
}

impl ReadState {
    fn new() -> Arc<Self> {
        Arc::new(Self {
            state: Mutex::new(ReadStateInner::default()),
            changed: Condvar::new(),
        })
    }

    fn mark_entered(&self) {
        self.lock().entered = true;
        self.changed.notify_all();
    }

    fn wait_for_release(&self) {
        let mut state = self.lock();
        while !state.release {
            state = self
                .changed
                .wait(state)
                .unwrap_or_else(|poisoned| poisoned.into_inner());
        }
    }

    fn mark_exited(&self) {
        self.lock().exited = true;
        self.changed.notify_all();
    }

    fn release(&self) {
        self.lock().release = true;
        self.changed.notify_all();
    }

    fn wait_until_entered(&self, timeout: Duration) -> bool {
        self.wait_until(timeout, |state| state.entered)
    }

    fn exited(&self) -> bool {
        self.lock().exited
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, ReadStateInner> {
        self.state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }

    fn wait_until<F>(&self, timeout: Duration, predicate: F) -> bool
    where
        F: Fn(&ReadStateInner) -> bool,
    {
        let deadline = std::time::Instant::now() + timeout;
        let mut state = self.lock();
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
struct NonCooperativeStream {
    read_state: Arc<ReadState>,
    _locked_file: LockedFile,
}

#[allow(non_snake_case)]
impl ISequentialStream_Impl for NonCooperativeStream_Impl {
    fn Read(&self, pv: *mut c_void, cb: u32, pcbread: *mut u32) -> HRESULT {
        if (cb != 0 && pv.is_null()) || pcbread.is_null() {
            return E_POINTER;
        }
        self.read_state.mark_entered();
        // Deliberately does not call CoTestCancel or inspect a private
        // production callback. This is the permanent negative fixture.
        self.read_state.wait_for_release();
        self.read_state.mark_exited();
        let bytes = b"non-cooperative stream";
        let count = (cb as usize).min(bytes.len());
        if count != 0 {
            unsafe {
                std::ptr::copy_nonoverlapping(bytes.as_ptr(), pv.cast::<u8>(), count);
            }
        }
        unsafe {
            *pcbread = count as u32;
        }
        S_OK
    }

    fn Write(&self, _pv: *const c_void, _cb: u32, pcbwritten: *mut u32) -> HRESULT {
        if !pcbwritten.is_null() {
            unsafe {
                *pcbwritten = 0;
            }
        }
        E_NOTIMPL
    }
}

#[allow(non_snake_case)]
impl IStream_Impl for NonCooperativeStream_Impl {
    fn Seek(
        &self,
        dlibmove: i64,
        dworigin: STREAM_SEEK,
        plibnewposition: *mut u64,
    ) -> windows::core::Result<()> {
        if plibnewposition.is_null() {
            return Err(WindowsError::from_hresult(E_POINTER));
        }
        let position = match dworigin {
            STREAM_SEEK_SET if dlibmove >= 0 => dlibmove as u64,
            STREAM_SEEK_CUR if dlibmove >= 0 => dlibmove as u64,
            STREAM_SEEK_END if dlibmove <= 0 => dlibmove.unsigned_abs(),
            _ => return Err(WindowsError::from_hresult(E_FAIL)),
        };
        unsafe {
            *plibnewposition = position;
        }
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

struct ShutdownEvent(HANDLE);

// Kernel event handles are process-wide synchronization objects and may be
// waited/signaled from different threads. The wrapper never exposes the raw
// handle beyond those two operations.
unsafe impl Send for ShutdownEvent {}
unsafe impl Sync for ShutdownEvent {}

impl ShutdownEvent {
    fn new() -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Self(unsafe { CreateEventW(None, true, false, None)? }))
    }

    fn signal(&self) {
        unsafe {
            let _ = SetEvent(self.0);
        }
    }
}

impl Drop for ShutdownEvent {
    fn drop(&mut self) {
        unsafe {
            let _ = CloseHandle(self.0);
        }
    }
}

struct MarshaledStream(NonNull<c_void>);

unsafe impl Send for MarshaledStream {}

fn take_marshaled(packet: MarshaledStream) -> *mut c_void {
    packet.0.as_ptr()
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

pub(crate) fn run(path: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let original = fs::read(path)?;
    let read_state = ReadState::new();
    let shutdown = Arc::new(ShutdownEvent::new()?);
    let (packet_sender, packet_receiver) = mpsc::sync_channel::<Result<MarshaledStream, String>>(1);
    let source_state = Arc::clone(&read_state);
    let source_shutdown = Arc::clone(&shutdown);
    let source_path = path.to_path_buf();
    let source_thread = thread::spawn(move || -> Result<(), String> {
        let status = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };
        if !status.is_ok() {
            return Err(format!("negative source CoInitializeEx failed: {status:?}"));
        }
        let result = (|| {
            let wide = source_path
                .as_os_str()
                .encode_wide()
                .chain(std::iter::once(0))
                .collect::<Vec<_>>();
            let locked_file = unsafe {
                CreateFileW(
                    PCWSTR(wide.as_ptr()),
                    GENERIC_READ.0,
                    FILE_SHARE_READ,
                    None::<*const SECURITY_ATTRIBUTES>,
                    OPEN_EXISTING,
                    FILE_ATTRIBUTE_NORMAL,
                    None,
                )
                .map_err(|error| format!("negative source file open failed: {error:?}"))?
            };
            let stream: IStream = NonCooperativeStream {
                read_state: source_state,
                _locked_file: LockedFile(locked_file),
            }
            .into();
            let marshal_stream = unsafe {
                CoMarshalInterThreadInterfaceInStream(&IStream::IID, &stream)
                    .map_err(|error| format!("negative source marshal failed: {error:?}"))?
            };
            let raw = Interface::into_raw(marshal_stream);
            let packet = NonNull::new(raw)
                .map(MarshaledStream)
                .ok_or_else(|| "negative source marshal returned null".to_string())?;
            packet_sender
                .send(Ok(packet))
                .map_err(|_| "negative source packet receiver dropped".to_string())?;
            wait_for_shutdown(&source_shutdown);
            drop(stream);
            Ok(())
        })();
        unsafe { windows::Win32::System::Com::CoUninitialize() };
        result
    });

    let packet = match packet_receiver.recv_timeout(Duration::from_secs(5))? {
        Ok(packet) => packet,
        Err(error) => {
            shutdown.signal();
            let _ = source_thread.join();
            return Err(error.into());
        }
    };
    let marshaled = ManuallyDrop::new(unsafe { IStream::from_raw(packet.0.as_ptr()) });
    let stream: IStream = unsafe { CoGetInterfaceAndReleaseStream(&*marshaled)? };
    let caller_marshal = unsafe { CoMarshalInterThreadInterfaceInStream(&IStream::IID, &stream)? };
    let caller_raw = Interface::into_raw(caller_marshal);
    let caller_packet =
        MarshaledStream(NonNull::new(caller_raw).ok_or("negative caller marshal returned null")?);
    let (thread_sender, thread_receiver) = mpsc::sync_channel(1);
    let caller_thread = thread::spawn(move || -> Result<HRESULT, String> {
        let status = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
        if !status.is_ok() {
            return Err(format!("negative caller CoInitializeEx failed: {status:?}"));
        }
        unsafe { CoEnableCallCancellation(None) }.map_err(|error| {
            format!("negative caller call-cancellation setup failed: {error:?}")
        })?;
        let result = (|| {
            let marshaled =
                ManuallyDrop::new(unsafe { IStream::from_raw(take_marshaled(caller_packet)) });
            let remote: IStream = unsafe {
                CoGetInterfaceAndReleaseStream(&*marshaled)
                    .map_err(|error| format!("negative caller unmarshal failed: {error:?}"))?
            };
            thread_sender
                .send(unsafe { GetCurrentThreadId() })
                .map_err(|_| "negative caller thread-id receiver dropped".to_string())?;
            let mut buffer = [0_u8; 64];
            let mut read = 0_u32;
            let status = unsafe {
                remote.Read(
                    buffer.as_mut_ptr().cast::<c_void>(),
                    buffer.len() as u32,
                    Some(&mut read),
                )
            };
            Ok(status)
        })();
        let _ = unsafe { CoDisableCallCancellation(None) };
        unsafe { windows::Win32::System::Com::CoUninitialize() };
        result
    });

    let caller_thread_id = match thread_receiver.recv_timeout(Duration::from_secs(5)) {
        Ok(thread_id) => thread_id,
        Err(error) => {
            read_state.release();
            let _ = caller_thread.join();
            shutdown.signal();
            let _ = source_thread.join();
            return Err(format!("negative caller did not start: {error}").into());
        }
    };
    if !read_state.wait_until_entered(Duration::from_secs(5)) {
        read_state.release();
        let _ = caller_thread.join();
        shutdown.signal();
        let _ = source_thread.join();
        return Err("negative non-cooperative Read did not enter".into());
    }

    let cancel_result = unsafe { CoCancelCall(caller_thread_id, 0) };
    let cancel_hresult = cancel_result
        .as_ref()
        .map_or_else(|error| error.code(), |_| S_OK);
    let lock_before_release = probe_file_lock(path, &original);
    let source_still_active = !read_state.exited();
    if cancel_result.is_err() || !lock_before_release.all_blocked() || !source_still_active {
        read_state.release();
        let _ = caller_thread.join();
        drop(stream);
        shutdown.signal();
        let _ = source_thread.join();
        return Err(format!(
            "negative boundary not reproduced: CoCancelCall={cancel_hresult:?}, source_read_active={source_still_active}, file_lock={lock_before_release:?}"
        )
        .into());
    }
    println!(
        "HARNESS negative non-cooperative stream: CoCancelCall={cancel_hresult:?}, server Read active, file lock held after cancellation request; OUTCOME B / v1 topology rejected"
    );

    // Manual unblocking is deliberately after the negative observation. It is
    // cleanup for this hostile fixture, never the reason the assertion passes.
    read_state.release();
    let caller_result = caller_thread
        .join()
        .map_err(|_| "negative caller thread panicked")??;
    drop(stream);
    shutdown.signal();
    source_thread
        .join()
        .map_err(|_| "negative source thread panicked")??;
    println!(
        "HARNESS negative manual unblock after observation: server Read exited={}, caller HRESULT={caller_result:?}; CoCancelCall(S_OK) != source-release guarantee: PASS",
        read_state.exited()
    );
    Ok(())
}

fn probe_file_lock(path: &Path, original: &[u8]) -> FileLockObservation {
    let write_blocked = OpenOptions::new().write(true).open(path).is_err();
    let renamed = path.with_extension("w4-03-negative-renamed");
    let rename_blocked = match fs::rename(path, &renamed) {
        Ok(()) => {
            let _ = fs::rename(&renamed, path);
            false
        }
        Err(_) => true,
    };
    let delete_blocked = match fs::remove_file(path) {
        Ok(()) => {
            let _ = fs::write(path, original);
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

fn wait_for_shutdown(shutdown: &ShutdownEvent) {
    let handles = [shutdown.0];
    loop {
        let result = unsafe {
            windows::Win32::UI::WindowsAndMessaging::MsgWaitForMultipleObjectsEx(
                Some(&handles),
                INFINITE,
                windows::Win32::UI::WindowsAndMessaging::QS_ALLINPUT,
                windows::Win32::UI::WindowsAndMessaging::MWMO_INPUTAVAILABLE,
            )
        };
        if result == windows::Win32::Foundation::WAIT_OBJECT_0 {
            break;
        }
        if result
            == windows::Win32::Foundation::WAIT_EVENT(
                windows::Win32::Foundation::WAIT_OBJECT_0.0 + 1,
            )
        {
            super::pump_messages();
        } else {
            break;
        }
    }
}
