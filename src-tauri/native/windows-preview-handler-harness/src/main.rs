#![cfg(windows)]

use std::{
    env,
    error::Error,
    ffi::{c_void, OsStr},
    fs::{self, OpenOptions},
    mem::ManuallyDrop,
    os::windows::ffi::OsStrExt,
    path::{Path, PathBuf},
    ptr::{null_mut, NonNull},
    sync::{mpsc, Arc, Condvar, Mutex},
    thread::{self, JoinHandle},
    time::Duration,
};

use windows::{
    core::{
        implement, w, Error as WindowsError, Interface, Ref, BOOL, GUID, HRESULT, PCSTR, PCWSTR,
    },
    Win32::{
        Foundation::{FreeLibrary, HMODULE, HWND, RECT},
        System::{
            Com::{
                IClassFactory, ISequentialStream_Impl, IStream, IStream_Impl, COINIT,
                COINIT_APARTMENTTHREADED, COINIT_MULTITHREADED, LOCKTYPE, STATFLAG, STATSTG, STGC,
                STREAM_SEEK, STREAM_SEEK_CUR, STREAM_SEEK_END, STREAM_SEEK_SET,
            },
            Com::{
                Marshal::{CoMarshalInterThreadInterfaceInStream, CoReleaseMarshalData},
                StructuredStorage::CoGetInterfaceAndReleaseStream,
            },
        },
        UI::{
            Input::KeyboardAndMouse::SetFocus,
            Shell::PropertiesSystem::IInitializeWithStream,
            Shell::{IPreviewHandler, SHCreateStreamOnFileEx},
            WindowsAndMessaging::{
                CreateWindowExW, DestroyWindow, DispatchMessageW, IsChild,
                MsgWaitForMultipleObjectsEx, PeekMessageW, TranslateMessage, MSG,
                MWMO_INPUTAVAILABLE, PM_REMOVE, QS_ALLINPUT, WS_CHILD, WS_POPUP, WS_TABSTOP,
                WS_VISIBLE,
            },
        },
    },
};

const PREVIEW_HANDLER_CLSID: GUID = GUID::from_u128(0x7e5a6c11_3a6d_4c92_9352_8e9b501a557c);
const S_OK: HRESULT = HRESULT(0);
const S_FALSE: HRESULT = HRESULT(1);
const E_FAIL: HRESULT = HRESULT(0x80004005_u32 as _);
const E_NOTIMPL: HRESULT = HRESULT(0x80004001_u32 as _);
const E_POINTER: HRESULT = HRESULT(0x80004003_u32 as _);

type DllGetClassObject = unsafe extern "system" fn(
    rclsid: *const GUID,
    riid: *const GUID,
    ppv: *mut *mut c_void,
) -> HRESULT;
type DllCanUnloadNow = unsafe extern "system" fn() -> HRESULT;
type HostRecordCount = unsafe extern "system" fn() -> u32;
type WaitForRead = unsafe extern "system" fn(timeout_ms: u32) -> BOOL;
type CancelledReadCount = unsafe extern "system" fn() -> u32;
type LastReadCancelled = unsafe extern "system" fn() -> BOOL;

struct ComApartment;

impl ComApartment {
    fn initialize(flags: COINIT) -> Result<Self, Box<dyn Error>> {
        let status = unsafe { windows::Win32::System::Com::CoInitializeEx(None, flags) };
        if !status.is_ok() {
            return Err(format!("CoInitializeEx failed: {status:?}").into());
        }
        Ok(Self)
    }
}

impl Drop for ComApartment {
    fn drop(&mut self) {
        unsafe { windows::Win32::System::Com::CoUninitialize() };
    }
}

struct LoadedHandler {
    module: HMODULE,
    get_class_object: DllGetClassObject,
    can_unload_now: DllCanUnloadNow,
    record_count: HostRecordCount,
    wait_for_read_entered: WaitForRead,
    wait_for_read_quiescence: WaitForRead,
    cancelled_read_count: CancelledReadCount,
    last_read_cancelled: LastReadCancelled,
}

impl LoadedHandler {
    fn load(path: &Path) -> Result<Self, Box<dyn Error>> {
        let wide = wide_path(path);
        let module =
            unsafe { windows::Win32::System::LibraryLoader::LoadLibraryW(PCWSTR(wide.as_ptr()))? };
        let result = unsafe {
            Ok(Self {
                module,
                get_class_object: transmute_symbol(
                    windows::Win32::System::LibraryLoader::GetProcAddress(
                        module,
                        PCSTR(c"DllGetClassObject".as_ptr().cast()),
                    ),
                )?,
                can_unload_now: transmute_symbol(
                    windows::Win32::System::LibraryLoader::GetProcAddress(
                        module,
                        PCSTR(c"DllCanUnloadNow".as_ptr().cast()),
                    ),
                )?,
                record_count: transmute_symbol(
                    windows::Win32::System::LibraryLoader::GetProcAddress(
                        module,
                        PCSTR(c"W4_03_TestHostProvidedRecordCount".as_ptr().cast()),
                    ),
                )?,
                wait_for_read_entered: transmute_symbol(
                    windows::Win32::System::LibraryLoader::GetProcAddress(
                        module,
                        PCSTR(c"W4_03_TestWaitForReadEntered".as_ptr().cast()),
                    ),
                )?,
                wait_for_read_quiescence: transmute_symbol(
                    windows::Win32::System::LibraryLoader::GetProcAddress(
                        module,
                        PCSTR(c"W4_03_TestWaitForReadQuiescence".as_ptr().cast()),
                    ),
                )?,
                cancelled_read_count: transmute_symbol(
                    windows::Win32::System::LibraryLoader::GetProcAddress(
                        module,
                        PCSTR(c"W4_03_TestCancelledReadCount".as_ptr().cast()),
                    ),
                )?,
                last_read_cancelled: transmute_symbol(
                    windows::Win32::System::LibraryLoader::GetProcAddress(
                        module,
                        PCSTR(c"W4_03_TestLastReadCancelled".as_ptr().cast()),
                    ),
                )?,
            })
        };
        if result.is_err() {
            unsafe {
                let _ = FreeLibrary(module);
            }
        }
        result
    }

    fn can_unload(&self) -> HRESULT {
        unsafe { (self.can_unload_now)() }
    }

    fn record_count(&self) -> u32 {
        unsafe { (self.record_count)() }
    }

    fn wait_for_read_entered(&self, timeout_ms: u32) -> bool {
        unsafe { (self.wait_for_read_entered)(timeout_ms).as_bool() }
    }

    fn wait_for_read_quiescence(&self, timeout_ms: u32) -> bool {
        unsafe { (self.wait_for_read_quiescence)(timeout_ms).as_bool() }
    }

    fn cancelled_read_count(&self) -> u32 {
        unsafe { (self.cancelled_read_count)() }
    }

    fn last_read_cancelled(&self) -> bool {
        unsafe { (self.last_read_cancelled)().as_bool() }
    }
}

impl Drop for LoadedHandler {
    fn drop(&mut self) {
        unsafe {
            let _ = FreeLibrary(self.module);
        }
    }
}

struct HostWindow(HWND);

impl HostWindow {
    fn create() -> Result<Self, Box<dyn Error>> {
        let hwnd = unsafe {
            CreateWindowExW(
                Default::default(),
                w!("STATIC"),
                w!("Zen Canvas W4-03 harness host"),
                WS_POPUP | WS_VISIBLE | WS_TABSTOP,
                0,
                0,
                640,
                480,
                None,
                None,
                None,
                None,
            )?
        };
        Ok(Self(hwnd))
    }

    fn hwnd(&self) -> HWND {
        self.0
    }
}

impl Drop for HostWindow {
    fn drop(&mut self) {
        unsafe {
            let _ = DestroyWindow(self.0);
        }
    }
}

struct FocusProbe(HWND);

impl FocusProbe {
    fn create(parent: HWND) -> Result<Self, Box<dyn Error>> {
        let hwnd = unsafe {
            CreateWindowExW(
                Default::default(),
                w!("STATIC"),
                w!("focus probe"),
                WS_CHILD | WS_VISIBLE | WS_TABSTOP,
                0,
                0,
                20,
                20,
                Some(parent),
                None,
                None,
                None,
            )?
        };
        Ok(Self(hwnd))
    }
}

impl Drop for FocusProbe {
    fn drop(&mut self) {
        unsafe {
            let _ = DestroyWindow(self.0);
        }
    }
}

struct Fixture {
    root: PathBuf,
}

impl Fixture {
    fn create() -> Result<Self, Box<dyn Error>> {
        let root = env::var_os("W4_03_HARNESS_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(|| {
                env::current_dir()
                    .expect("current directory")
                    .join(".tmp-tests")
                    .join("w4-03-harness")
            });
        fs::create_dir_all(&root)?;
        Ok(Self { root })
    }

    fn create_generation(&self, generation: usize) -> Result<PathBuf, Box<dyn Error>> {
        let path = self.root.join(format!("fixture-{generation}.txt"));
        fs::write(&path, b"Zen Canvas W4-03 file-backed stream\r\n")?;
        Ok(path)
    }

    fn prove_file_released(&self, path: &Path, generation: usize) -> Result<(), Box<dyn Error>> {
        let reopened = OpenOptions::new().read(true).write(true).open(path)?;
        drop(reopened);
        let renamed = self.root.join(format!("fixture-{generation}-renamed.txt"));
        let moved_dir = self.root.join(format!("moved-{generation}"));
        fs::rename(path, &renamed)?;
        fs::create_dir_all(&moved_dir)?;
        let moved = moved_dir.join(format!("fixture-{generation}-moved.txt"));
        fs::rename(&renamed, &moved)?;
        use std::io::Write;
        let mut reopened = OpenOptions::new().read(true).write(true).open(&moved)?;
        reopened.write_all(b"released\r\n")?;
        drop(reopened);
        fs::remove_file(&moved)?;
        fs::remove_dir(&moved_dir)?;
        println!("HARNESS generation {generation} file reopen/rename/move/delete: PASS");
        Ok(())
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

struct BlockingReadState {
    state: Mutex<BlockingReadStateInner>,
    changed: Condvar,
}

struct BlockingReadStateInner {
    entered: bool,
    released: bool,
    position: u64,
}

impl BlockingReadState {
    fn new() -> Arc<Self> {
        Arc::new(Self {
            state: Mutex::new(BlockingReadStateInner {
                entered: false,
                released: false,
                position: 0,
            }),
            changed: Condvar::new(),
        })
    }

    fn wait_until_entered(&self, timeout: Duration) -> bool {
        let deadline = std::time::Instant::now() + timeout;
        let mut state = lock(&self.state);
        while !state.entered {
            let remaining = deadline.saturating_duration_since(std::time::Instant::now());
            if remaining.is_zero() {
                return false;
            }
            let (next, result) = self
                .changed
                .wait_timeout(state, remaining)
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            state = next;
            if result.timed_out() && !state.entered {
                return false;
            }
        }
        true
    }

    fn release(&self) {
        let mut state = lock(&self.state);
        state.released = true;
        self.changed.notify_all();
    }
}

#[allow(non_snake_case)]
#[implement(IStream)]
struct BlockingStream {
    state: Arc<BlockingReadState>,
}

#[allow(non_snake_case)]
impl ISequentialStream_Impl for BlockingStream_Impl {
    fn Read(&self, pv: *mut c_void, cb: u32, pcbread: *mut u32) -> HRESULT {
        if (cb != 0 && pv.is_null()) || pcbread.is_null() {
            return E_POINTER;
        }
        let mut state = lock(&self.state.state);
        state.entered = true;
        self.state.changed.notify_all();
        while !state.released {
            state = self
                .state
                .changed
                .wait(state)
                .unwrap_or_else(|poisoned| poisoned.into_inner());
        }
        let bytes = b"late completion";
        let count = cb.min(bytes.len() as u32);
        unsafe {
            std::ptr::copy_nonoverlapping(bytes.as_ptr(), pv.cast::<u8>(), count as usize);
            *pcbread = count;
        }
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
impl IStream_Impl for BlockingStream_Impl {
    fn Seek(
        &self,
        dlibmove: i64,
        dworigin: STREAM_SEEK,
        plibnewposition: *mut u64,
    ) -> windows::core::Result<()> {
        if plibnewposition.is_null() {
            return Err(WindowsError::from_hresult(E_POINTER));
        }
        let mut state = lock(&self.state.state);
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

struct BlockingSource {
    read_state: Arc<BlockingReadState>,
    shutdown: Arc<Gate>,
    thread: Option<JoinHandle<()>>,
}

struct MarshaledStreamPacket {
    raw: NonNull<c_void>,
}

// SAFETY: this is only the owning interface reference returned by standard
// COM marshaling. It is consumed by a marshal API on the destination
// apartment and is never used as an ordinary IStream on the wrong thread.
unsafe impl Send for MarshaledStreamPacket {}

impl MarshaledStreamPacket {
    fn from_marshaled(stream: IStream) -> Result<Self, String> {
        let raw = Interface::into_raw(stream);
        NonNull::new(raw)
            .map(|raw| Self { raw })
            .ok_or_else(|| "COM marshal returned a null stream".to_string())
    }

    fn into_stream(self) -> windows::core::Result<IStream> {
        let raw = self.raw;
        std::mem::forget(self);
        let marshal_stream = ManuallyDrop::new(unsafe { IStream::from_raw(raw.as_ptr()) });
        unsafe { CoGetInterfaceAndReleaseStream(&*marshal_stream) }
    }
}

impl Drop for MarshaledStreamPacket {
    fn drop(&mut self) {
        let marshal_stream = unsafe { IStream::from_raw(self.raw.as_ptr()) };
        unsafe {
            let _ = CoReleaseMarshalData(&marshal_stream);
        }
    }
}

impl BlockingSource {
    fn create() -> Result<(Self, IStream), Box<dyn Error>> {
        let read_state = BlockingReadState::new();
        let shutdown = Arc::new(Gate::new());
        let (sender, receiver) = mpsc::sync_channel::<Result<MarshaledStreamPacket, String>>(1);
        let thread_read_state = Arc::clone(&read_state);
        let thread_shutdown = Arc::clone(&shutdown);
        let thread = thread::spawn(move || {
            let Ok(_com) = ComApartment::initialize(COINIT_MULTITHREADED) else {
                let _ = sender.send(Err("source MTA CoInitializeEx failed".to_string()));
                return;
            };
            let stream: IStream = BlockingStream {
                state: thread_read_state,
            }
            .into();
            let result = unsafe {
                CoMarshalInterThreadInterfaceInStream(&IStream::IID, &stream)
                    .map_err(|error| format!("source stream marshal failed: {error:?}"))
                    .and_then(MarshaledStreamPacket::from_marshaled)
            };
            let Ok(packet) = result else {
                let _ = sender.send(result);
                return;
            };
            if sender.send(Ok(packet)).is_err() {
                return;
            }
            thread_shutdown.wait();
            drop(stream);
        });

        let packet = match receiver.recv() {
            Ok(Ok(packet)) => packet,
            Ok(Err(error)) => {
                shutdown.signal();
                let _ = thread.join();
                return Err(error.into());
            }
            Err(error) => {
                shutdown.signal();
                let _ = thread.join();
                return Err(error.into());
            }
        };
        let stream = match packet.into_stream() {
            Ok(stream) => stream,
            Err(error) => {
                shutdown.signal();
                let _ = thread.join();
                return Err(error.into());
            }
        };
        Ok((
            Self {
                read_state,
                shutdown,
                thread: Some(thread),
            },
            stream,
        ))
    }

    fn wait_until_read_entered(&self, timeout: Duration) -> bool {
        self.read_state.wait_until_entered(timeout)
    }

    fn release_read(&self) {
        self.read_state.release();
    }

    fn shutdown_and_join(&mut self) {
        self.read_state.release();
        self.shutdown.signal();
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

impl Drop for BlockingSource {
    fn drop(&mut self) {
        self.shutdown_and_join();
    }
}

struct Gate {
    state: Mutex<bool>,
    changed: Condvar,
}

impl Gate {
    fn new() -> Self {
        Self {
            state: Mutex::new(false),
            changed: Condvar::new(),
        }
    }

    fn wait(&self) {
        let mut released = lock(&self.state);
        while !*released {
            released = self
                .changed
                .wait(released)
                .unwrap_or_else(|poisoned| poisoned.into_inner());
        }
    }

    fn signal(&self) {
        *lock(&self.state) = true;
        self.changed.notify_all();
    }
}

fn run(dll_path: &Path) -> Result<(), Box<dyn Error>> {
    let _com = ComApartment::initialize(COINIT_APARTMENTTHREADED)?;
    let fixture = Fixture::create()?;
    let host_a = HostWindow::create()?;
    let host_b = HostWindow::create()?;
    let focus_probe = FocusProbe::create(host_a.hwnd())?;
    let handler_dll = LoadedHandler::load(dll_path)?;

    check_hr(handler_dll.can_unload(), S_OK, "baseline DllCanUnloadNow")?;
    if handler_dll.record_count() != 0 {
        return Err("baseline HostProvided record count was not zero".into());
    }

    let mut factory_output = null_mut();
    let status = unsafe {
        (handler_dll.get_class_object)(
            &PREVIEW_HANDLER_CLSID,
            &<IClassFactory as Interface>::IID,
            &mut factory_output,
        )
    };
    check_hr(status, S_OK, "DllGetClassObject")?;
    let factory: IClassFactory = unsafe { IClassFactory::from_raw(factory_output) };
    check_hr(
        handler_dll.can_unload(),
        S_FALSE,
        "class factory active count",
    )?;
    unsafe { factory.LockServer(true)? };
    check_hr(
        handler_dll.can_unload(),
        S_FALSE,
        "server lock active count",
    )?;
    unsafe { factory.LockServer(false)? };

    let handler: IPreviewHandler = unsafe { factory.CreateInstance(None)? };
    let initializer: IInitializeWithStream = handler.cast()?;
    let ole_window: windows::Win32::System::Ole::IOleWindow = handler.cast()?;
    let rect = RECT {
        left: 4,
        top: 8,
        right: 620,
        bottom: 460,
    };
    let rect_after = RECT {
        left: 12,
        top: 16,
        right: 500,
        bottom: 380,
    };

    for generation in 0..3 {
        let path = fixture.create_generation(generation)?;
        let stream = unsafe {
            SHCreateStreamOnFileEx(
                PCWSTR(wide_path(&path).as_ptr()),
                (windows::Win32::System::Com::STGM_READ
                    | windows::Win32::System::Com::STGM_SHARE_DENY_WRITE)
                    .0,
                0,
                false,
                None::<&IStream>,
            )?
        };
        unsafe { initializer.Initialize(&stream, 0)? };
        if unsafe { initializer.Initialize(&stream, 0) }.is_ok() {
            return Err(format!("generation {generation}: duplicate Initialize succeeded").into());
        }
        // The caller's reference is gone before the handler starts/owns any
        // deferred read. The handler must release its own reference at Unload.
        drop(stream);

        unsafe { handler.SetWindow(host_a.hwnd(), &rect)? };
        if get_preview_window(&ole_window).is_ok() {
            return Err(format!("generation {generation}: child existed before DoPreview").into());
        }
        unsafe { handler.DoPreview()? };
        let child = get_preview_window(&ole_window)?;
        if child == host_a.hwnd() || !unsafe { IsChild(host_a.hwnd(), child).as_bool() } {
            return Err(format!("generation {generation}: child HWND was not host-owned").into());
        }
        if handler_dll.record_count() != 1 {
            return Err(format!("generation {generation}: HostProvided count was not one").into());
        }
        if !wait_for_quiescence_with_message_pump(&handler_dll) {
            return Err(format!("generation {generation}: bounded read did not quiesce").into());
        }

        unsafe { handler.DoPreview()? };
        if handler_dll.record_count() != 1 || get_preview_window(&ole_window)? != child {
            return Err(
                format!("generation {generation}: repeated DoPreview replaced state").into(),
            );
        }
        unsafe { handler.SetRect(&rect_after)? };
        if get_preview_window(&ole_window)? != child {
            return Err(format!("generation {generation}: SetRect replaced child").into());
        }
        unsafe { handler.SetWindow(host_b.hwnd(), &rect_after)? };
        if get_preview_window(&ole_window)? != child
            || !unsafe { IsChild(host_b.hwnd(), child).as_bool() }
        {
            return Err(format!("generation {generation}: SetWindow did not reuse child").into());
        }

        unsafe { handler.SetFocus()? };
        if unsafe { handler.QueryFocus()? } != child {
            return Err(format!("generation {generation}: child focus was not reported").into());
        }
        unsafe { SetFocus(Some(focus_probe.0))? };
        if unsafe { handler.QueryFocus()? } != focus_probe.0 {
            return Err(format!("generation {generation}: same-thread focus was rejected").into());
        }
        unsafe { SetFocus(None)? };
        if !unsafe { handler.QueryFocus()? }.is_invalid() {
            return Err(format!("generation {generation}: null GetFocus was not preserved").into());
        }
        unsafe { handler.SetFocus()? };
        check_hr(
            unsafe { raw_translate_accelerator(&handler, &MSG::default()) },
            S_FALSE,
            "TranslateAccelerator without frame",
        )?;

        unsafe { handler.Unload()? };
        if handler_dll.record_count() != 0 || get_preview_window(&ole_window).is_ok() {
            return Err(format!("generation {generation}: Unload left child/record").into());
        }
        if unsafe { handler.SetRect(&rect) }.is_ok() {
            return Err(format!("generation {generation}: SetRect after Unload succeeded").into());
        }
        if unsafe { handler.SetWindow(host_a.hwnd(), &rect) }.is_ok() {
            return Err(
                format!("generation {generation}: SetWindow after Unload succeeded").into(),
            );
        }
        if unsafe { handler.DoPreview() }.is_ok() {
            return Err(
                format!("generation {generation}: DoPreview after Unload succeeded").into(),
            );
        }
        unsafe { handler.Unload()? };
        fixture.prove_file_released(&path, generation)?;
        println!("HARNESS generation {generation}: Initialize/DoPreview/Unload PASS");
    }

    let (mut blocking_source, blocked_stream) = BlockingSource::create()?;
    unsafe { initializer.Initialize(&blocked_stream, 0)? };
    drop(blocked_stream);
    unsafe { handler.SetWindow(host_a.hwnd(), &rect)? };
    let cancelled_before = handler_dll.cancelled_read_count();
    unsafe { handler.DoPreview()? };
    if !blocking_source.wait_until_read_entered(Duration::from_secs(5))
        || !handler_dll.wait_for_read_entered(5000)
    {
        return Err("blocked IStream never entered the worker read boundary".into());
    }
    if handler_dll.record_count() != 1 {
        return Err("blocked read did not publish one HostProvided record".into());
    }
    unsafe { handler.Unload()? };
    if handler_dll.record_count() != 0 || get_preview_window(&ole_window).is_ok() {
        return Err("Unload did not revoke blocked generation immediately".into());
    }
    drop(ole_window);
    drop(initializer);
    drop(handler);
    drop(factory);
    check_hr(
        handler_dll.can_unload(),
        S_FALSE,
        "in-flight read keeps DLL non-unloadable",
    )?;
    blocking_source.release_read();
    if !handler_dll.wait_for_read_quiescence(5000) {
        return Err("cancelled blocked read did not quiesce".into());
    }
    if !handler_dll.last_read_cancelled()
        || handler_dll.cancelled_read_count() != cancelled_before.saturating_add(1)
    {
        return Err("late blocked read was not rejected after Unload".into());
    }
    println!("HARNESS in-flight cancellation/no-late-publication: PASS");

    blocking_source.shutdown_and_join();
    check_hr(
        handler_dll.can_unload(),
        S_OK,
        "post-handler-release DllCanUnloadNow",
    )?;
    println!("HARNESS COM/file-backed/multi-generation lifecycle: PASS");
    println!("HARNESS registry writes: NONE");
    Ok(())
}

fn wait_for_quiescence_with_message_pump(handler: &LoadedHandler) -> bool {
    let wait_for_read_quiescence = handler.wait_for_read_quiescence;
    let (sender, receiver) = mpsc::sync_channel(1);
    let waiter = thread::spawn(move || {
        let result = unsafe { wait_for_read_quiescence(5000).as_bool() };
        let _ = sender.send(result);
    });
    let deadline = std::time::Instant::now() + Duration::from_secs(5);

    let result = loop {
        if let Ok(result) = receiver.try_recv() {
            break result;
        }
        let remaining = deadline.saturating_duration_since(std::time::Instant::now());
        if remaining.is_zero() {
            break false;
        }
        let milliseconds = remaining.as_millis().min(u128::from(u32::MAX)) as u32;
        unsafe {
            let _ = MsgWaitForMultipleObjectsEx(
                None,
                milliseconds.max(1),
                QS_ALLINPUT,
                MWMO_INPUTAVAILABLE,
            );
            let mut message = MSG::default();
            while PeekMessageW(&mut message, None, 0, 0, PM_REMOVE).as_bool() {
                let _ = TranslateMessage(&message);
                let _ = DispatchMessageW(&message);
            }
        }
    };
    let _ = waiter.join();
    result
}

unsafe fn raw_translate_accelerator(handler: &IPreviewHandler, message: &MSG) -> HRESULT {
    let vtable = <IPreviewHandler as Interface>::vtable(handler);
    (vtable.TranslateAccelerator)(<IPreviewHandler as Interface>::as_raw(handler), message)
}

fn check_hr(actual: HRESULT, expected: HRESULT, label: &str) -> Result<(), Box<dyn Error>> {
    if actual == expected {
        Ok(())
    } else {
        Err(format!("{label}: expected {expected:?}, got {actual:?}").into())
    }
}

fn get_preview_window(
    ole_window: &windows::Win32::System::Ole::IOleWindow,
) -> windows::core::Result<HWND> {
    unsafe { ole_window.GetWindow() }
}

unsafe fn transmute_symbol<T>(
    symbol: windows::Win32::Foundation::FARPROC,
) -> Result<T, Box<dyn Error>> {
    let Some(symbol) = symbol else {
        return Err(WindowsError::from_win32().into());
    };
    Ok(std::mem::transmute_copy(&symbol))
}

fn lock<T>(value: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    value
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}

fn wide_path(path: &Path) -> Vec<u16> {
    OsStr::new(path)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

fn main() -> Result<(), Box<dyn Error>> {
    let mut args = env::args_os();
    let _program = args.next();
    let dll_path = args
        .next()
        .map(PathBuf::from)
        .ok_or("usage: zen-canvas-windows-preview-handler-harness <preview-handler.dll>")?;
    run(&dll_path)
}
