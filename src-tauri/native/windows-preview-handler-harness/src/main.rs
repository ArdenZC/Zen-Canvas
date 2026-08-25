#![cfg(windows)]

use std::{
    env,
    error::Error,
    ffi::{c_void, OsStr},
    fs::{self, OpenOptions},
    os::windows::ffi::OsStrExt,
    path::{Path, PathBuf},
    ptr::null_mut,
};

use windows::{
    core::{w, Error as WindowsError, Interface, GUID, HRESULT, PCSTR, PCWSTR},
    Win32::{
        Foundation::{FreeLibrary, HMODULE, HWND},
        System::{
            Com::{
                CoInitializeEx, CoUninitialize, IClassFactory, IStream, COINIT_APARTMENTTHREADED,
                STGM_READ, STGM_SHARE_DENY_WRITE,
            },
            LibraryLoader::{GetProcAddress, LoadLibraryW},
        },
        UI::{
            Shell::PropertiesSystem::IInitializeWithStream,
            Shell::{IPreviewHandler, SHCreateStreamOnFileEx},
            WindowsAndMessaging::{
                CreateWindowExW, DestroyWindow, IsChild, MSG, WS_CHILD, WS_POPUP, WS_TABSTOP,
                WS_VISIBLE,
            },
        },
    },
};

const PREVIEW_HANDLER_CLSID: GUID = GUID::from_u128(0x7e5a6c11_3a6d_4c92_9352_8e9b501a557c);
const S_OK: HRESULT = HRESULT(0);
const S_FALSE: HRESULT = HRESULT(1);

type DllGetClassObject = unsafe extern "system" fn(
    rclsid: *const GUID,
    riid: *const GUID,
    ppv: *mut *mut c_void,
) -> HRESULT;
type DllCanUnloadNow = unsafe extern "system" fn() -> HRESULT;
type HostRecordCount = unsafe extern "system" fn() -> u32;

struct ComApartment;

impl ComApartment {
    fn initialize() -> Result<Self, Box<dyn Error>> {
        let status = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };
        if !status.is_ok() {
            return Err(format!("CoInitializeEx failed: {status:?}").into());
        }
        Ok(Self)
    }
}

impl Drop for ComApartment {
    fn drop(&mut self) {
        unsafe { CoUninitialize() };
    }
}

struct LoadedHandler {
    module: HMODULE,
    get_class_object: DllGetClassObject,
    can_unload_now: DllCanUnloadNow,
    record_count: HostRecordCount,
}

impl LoadedHandler {
    fn load(path: &Path) -> Result<Self, Box<dyn Error>> {
        let wide = wide_path(path);
        let module = unsafe { LoadLibraryW(PCWSTR(wide.as_ptr()))? };
        let result = unsafe {
            Ok(Self {
                module,
                get_class_object: transmute_symbol(GetProcAddress(
                    module,
                    PCSTR(c"DllGetClassObject".as_ptr().cast()),
                ))?,
                can_unload_now: transmute_symbol(GetProcAddress(
                    module,
                    PCSTR(c"DllCanUnloadNow".as_ptr().cast()),
                ))?,
                record_count: transmute_symbol(GetProcAddress(
                    module,
                    PCSTR(c"W4_03_TestHostProvidedRecordCount".as_ptr().cast()),
                ))?,
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
    path: PathBuf,
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
        let path = root.join("fixture.txt");
        fs::write(&path, b"Zen Canvas W4-03 file-backed stream\r\n")?;
        Ok(Self { root, path })
    }

    fn prove_file_released(&self) -> Result<(), Box<dyn Error>> {
        let reopened = OpenOptions::new().read(true).write(true).open(&self.path)?;
        drop(reopened);
        let renamed = self.root.join("fixture-renamed.txt");
        let moved_dir = self.root.join("moved");
        fs::rename(&self.path, &renamed)?;
        fs::create_dir_all(&moved_dir)?;
        let moved = moved_dir.join("fixture-moved.txt");
        fs::rename(&renamed, &moved)?;
        use std::io::Write;
        let mut reopened = OpenOptions::new().read(true).write(true).open(&moved)?;
        reopened.write_all(b"released\r\n")?;
        drop(reopened);
        fs::remove_file(&moved)?;
        fs::remove_dir(&moved_dir)?;
        println!("HARNESS file reopen/rename/move/delete: PASS");
        Ok(())
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn run(dll_path: &Path) -> Result<(), Box<dyn Error>> {
    let _com = ComApartment::initialize()?;
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
            &<IClassFactory as windows::core::Interface>::IID,
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
    let stream = unsafe {
        SHCreateStreamOnFileEx(
            PCWSTR(wide_path(&fixture.path).as_ptr()),
            (STGM_READ | STGM_SHARE_DENY_WRITE).0,
            0,
            false,
            None::<&IStream>,
        )?
    };
    unsafe { initializer.Initialize(&stream, 0)? };

    let rect = windows::Win32::Foundation::RECT {
        left: 4,
        top: 8,
        right: 620,
        bottom: 460,
    };
    unsafe { handler.SetWindow(host_a.hwnd(), &rect)? };
    if get_preview_window(&ole_window).is_ok() {
        return Err("GetWindow exposed a child before DoPreview".into());
    }

    unsafe { handler.DoPreview()? };
    let child = get_preview_window(&ole_window)?;
    if child == host_a.hwnd() || !unsafe { IsChild(host_a.hwnd(), child).as_bool() } {
        return Err("DoPreview did not create an owned child HWND".into());
    }
    if handler_dll.record_count() != 1 {
        return Err("DoPreview did not publish exactly one HostProvided record".into());
    }

    unsafe { handler.SetFocus()? };
    if unsafe { handler.QueryFocus()? } != child {
        return Err("SetFocus/QueryFocus did not report the owned child".into());
    }
    unsafe {
        windows::Win32::UI::Input::KeyboardAndMouse::SetFocus(Some(focus_probe.0))?;
    }
    if unsafe { handler.QueryFocus() }.is_ok() {
        return Err("QueryFocus claimed unrelated focus".into());
    }
    let message = MSG::default();
    if unsafe { handler.TranslateAccelerator(&message) }.is_ok() {
        return Err("TranslateAccelerator faked handling without a site frame".into());
    }

    unsafe { handler.DoPreview()? };
    if handler_dll.record_count() != 1 || get_preview_window(&ole_window)? != child {
        return Err("repeated DoPreview replaced the active child/record".into());
    }

    let rect_after = windows::Win32::Foundation::RECT {
        left: 12,
        top: 16,
        right: 500,
        bottom: 380,
    };
    unsafe { handler.SetRect(&rect_after)? };
    if get_preview_window(&ole_window)? != child {
        return Err("SetRect replaced the preview child".into());
    }
    unsafe { handler.SetWindow(host_b.hwnd(), &rect_after)? };
    if get_preview_window(&ole_window)? != child
        || !unsafe { IsChild(host_b.hwnd(), child).as_bool() }
    {
        return Err("SetWindow after DoPreview did not reparent the existing child".into());
    }

    unsafe { handler.Unload()? };
    if handler_dll.record_count() != 0 || get_preview_window(&ole_window).is_ok() {
        return Err("Unload did not clear the child/HostProvided record".into());
    }
    drop(ole_window);
    drop(initializer);
    drop(stream);
    drop(handler);
    drop(factory);
    check_hr(
        handler_dll.can_unload(),
        S_OK,
        "post-Unload DllCanUnloadNow",
    )?;
    fixture.prove_file_released()?;
    println!("HARNESS COM/file-backed lifecycle: PASS");
    println!("HARNESS registry writes: NONE");
    Ok(())
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
