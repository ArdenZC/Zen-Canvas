use std::{
    ffi::c_void,
    ptr::null_mut,
    sync::{atomic::Ordering, MutexGuard},
};

use uuid::Uuid;
use windows::{
    core::{implement, Error, IUnknown, Interface, Ref, Result, BOOL, GUID, HRESULT},
    Win32::{
        Foundation::{HWND, RECT},
        System::{
            Com::{IClassFactory, IClassFactory_Impl, IStream},
            Ole::{IObjectWithSite, IObjectWithSite_Impl, IOleWindow, IOleWindow_Impl},
        },
        UI::{
            Input::KeyboardAndMouse::VK_TAB,
            Shell::PropertiesSystem::{IInitializeWithStream, IInitializeWithStream_Impl},
            Shell::{IPreviewHandler, IPreviewHandler_Impl},
            WindowsAndMessaging::{MSG, WM_KEYDOWN},
        },
    },
};
use zen_canvas_native_host::{HostProvidedHost, HostProvidedReadRequest, HostProvidedRegistration};

use crate::{
    host_registry,
    state::{HandlerState, SharedHandlerState},
    stream::ShellStreamSource,
    window, ACTIVE_OBJECTS, CLASS_E_CLASSNOTAVAILABLE, CLASS_E_NOAGGREGATION, E_ABORT, E_FAIL,
    E_NOTIMPL, E_POINTER, E_UNEXPECTED, PREVIEW_HANDLER_CLSID, S_FALSE,
};

fn error(hr: HRESULT, message: &'static str) -> Error {
    Error::new(hr, message)
}

fn lock<'a>(state: &'a SharedHandlerState) -> MutexGuard<'a, HandlerState> {
    state
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}

#[implement(IClassFactory)]
struct ClassFactory;

impl ClassFactory {
    fn new() -> Self {
        ACTIVE_OBJECTS.fetch_add(1, Ordering::AcqRel);
        Self
    }
}

impl Drop for ClassFactory {
    fn drop(&mut self) {
        ACTIVE_OBJECTS.fetch_sub(1, Ordering::AcqRel);
    }
}

impl IClassFactory_Impl for ClassFactory_Impl {
    fn CreateInstance(
        &self,
        punkouter: Ref<'_, IUnknown>,
        riid: *const GUID,
        ppvobject: *mut *mut c_void,
    ) -> Result<()> {
        if !punkouter.is_null() {
            return Err(error(
                CLASS_E_NOAGGREGATION,
                "preview handler does not aggregate",
            ));
        }
        if riid.is_null() || ppvobject.is_null() {
            return Err(error(E_POINTER, "null COM output pointer"));
        }
        unsafe {
            *ppvobject = null_mut();
        }

        let object: IUnknown = PreviewHandler::new().into();
        let status = unsafe { object.query(riid, ppvobject) };
        if status.is_ok() {
            Ok(())
        } else {
            Err(Error::from_hresult(status))
        }
    }

    fn LockServer(&self, flock: BOOL) -> Result<()> {
        if flock.as_bool() {
            crate::SERVER_LOCKS.fetch_add(1, Ordering::AcqRel);
        } else {
            let _ =
                crate::SERVER_LOCKS.fetch_update(Ordering::AcqRel, Ordering::Acquire, |value| {
                    value.checked_sub(1)
                });
        }
        Ok(())
    }
}

pub(crate) fn dll_get_class_object(
    rclsid: *const GUID,
    riid: *const GUID,
    ppv: *mut *mut c_void,
) -> HRESULT {
    if rclsid.is_null() || riid.is_null() || ppv.is_null() {
        return E_POINTER;
    }
    unsafe {
        *ppv = null_mut();
        if *rclsid != PREVIEW_HANDLER_CLSID {
            return CLASS_E_CLASSNOTAVAILABLE;
        }
        let factory: IUnknown = ClassFactory::new().into();
        factory.query(riid, ppv)
    }
}

#[implement(IInitializeWithStream, IPreviewHandler, IOleWindow, IObjectWithSite)]
struct PreviewHandler {
    state: SharedHandlerState,
}

impl PreviewHandler {
    fn new() -> Self {
        ACTIVE_OBJECTS.fetch_add(1, Ordering::AcqRel);
        Self {
            state: SharedHandlerState::default(),
        }
    }

    fn set_window(&self, hwnd: HWND, rect: RECT) -> Result<()> {
        if hwnd.is_invalid() {
            return Err(error(E_POINTER, "preview parent window is null"));
        }
        let old_child = {
            let mut state = lock(&self.state);
            if state.unloaded {
                return Err(error(E_UNEXPECTED, "preview handler was unloaded"));
            }
            state.parent = hwnd;
            state.rect = rect;
            state.child.take()
        };
        window::destroy_surface(old_child);
        let child = window::create_surface(hwnd, rect)?;
        let keep = {
            let mut state = lock(&self.state);
            if state.unloaded {
                false
            } else {
                state.child = Some(child);
                true
            }
        };
        if !keep {
            window::destroy_surface(Some(child));
            return Err(error(E_ABORT, "preview handler was unloaded"));
        }
        Ok(())
    }

    fn set_rect(&self, rect: RECT) -> Result<()> {
        let child = {
            let mut state = lock(&self.state);
            if state.unloaded {
                return Err(error(E_UNEXPECTED, "preview handler was unloaded"));
            }
            state.rect = rect;
            state.child
        };
        if let Some(child) = child {
            window::resize_surface(child, rect)?;
        }
        Ok(())
    }

    fn do_preview(&self) -> Result<()> {
        const PREVIEW_READ_BYTES: u32 = 64 * 1024;
        let (stream, generation_id, child) = {
            let mut state = lock(&self.state);
            if state.unloaded || !state.initialized {
                return Err(error(E_UNEXPECTED, "preview stream is not initialized"));
            }
            let child = state
                .child
                .ok_or_else(|| error(E_UNEXPECTED, "preview window is not attached"))?;
            state.preview_started = true;
            (
                state
                    .stream
                    .as_ref()
                    .ok_or_else(|| error(E_UNEXPECTED, "preview stream is missing"))?
                    .clone(),
                state
                    .generation_id
                    .clone()
                    .ok_or_else(|| error(E_UNEXPECTED, "preview generation is missing"))?,
                child,
            )
        };

        let source = std::sync::Arc::new(ShellStreamSource::new(stream));
        let registry = host_registry();
        let handle = registry
            .register(HostProvidedRegistration {
                host: HostProvidedHost::WindowsPreviewHandler,
                generation_id: generation_id.clone(),
                source,
            })
            .map_err(|_| error(E_FAIL, "host-provided registration failed"))?;

        let should_read = {
            let mut state = lock(&self.state);
            if state.unloaded {
                false
            } else {
                state.host_handle = Some(handle.clone());
                true
            }
        };
        if !should_read {
            let _ = registry.revoke(
                &handle.host_token,
                HostProvidedHost::WindowsPreviewHandler,
                &generation_id,
            );
            return Err(error(E_ABORT, "preview handler was unloaded"));
        }

        let request = HostProvidedReadRequest {
            host_token: handle.host_token.clone(),
            host: HostProvidedHost::WindowsPreviewHandler,
            generation_id: generation_id.clone(),
            offset_bytes: 0,
            max_bytes: PREVIEW_READ_BYTES,
        };
        let read = match registry.read(&request) {
            Ok(read) => read,
            Err(error_kind) => {
                let _ = registry.revoke(
                    &handle.host_token,
                    HostProvidedHost::WindowsPreviewHandler,
                    &generation_id,
                );
                self.clear_handle(&handle);
                return Err(match error_kind {
                    zen_canvas_native_host::HostProvidedError::Cancelled
                    | zen_canvas_native_host::HostProvidedError::Disposed
                    | zen_canvas_native_host::HostProvidedError::InvalidOrStale => {
                        error(E_ABORT, "preview source was revoked")
                    }
                    _ => error(E_FAIL, "bounded preview read failed"),
                });
            }
        };

        let current = {
            let state = lock(&self.state);
            !state.unloaded
                && state.generation_id.as_deref() == Some(generation_id.as_str())
                && state
                    .host_handle
                    .as_ref()
                    .is_some_and(|active| active.host_token == handle.host_token)
        };
        if !current {
            let _ = registry.revoke(
                &handle.host_token,
                HostProvidedHost::WindowsPreviewHandler,
                &generation_id,
            );
            self.clear_handle(&handle);
            return Err(error(E_ABORT, "preview source was revoked"));
        }

        let text = inert_preview_text(&read.bytes, read.complete);
        if window::set_surface_text(child, &text).is_err() {
            let _ = registry.revoke(
                &handle.host_token,
                HostProvidedHost::WindowsPreviewHandler,
                &generation_id,
            );
            self.clear_handle(&handle);
            return Err(error(E_FAIL, "preview surface rejected text"));
        }

        // Recheck after the native call: an Unload racing the read or paint is
        // never allowed to publish a later logical result.
        let still_current = {
            let state = lock(&self.state);
            !state.unloaded
                && state.generation_id.as_deref() == Some(generation_id.as_str())
                && state
                    .host_handle
                    .as_ref()
                    .is_some_and(|active| active.host_token == handle.host_token)
        };
        if still_current {
            Ok(())
        } else {
            let _ = registry.revoke(
                &handle.host_token,
                HostProvidedHost::WindowsPreviewHandler,
                &generation_id,
            );
            self.clear_handle(&handle);
            Err(error(E_ABORT, "preview handler was unloaded"))
        }
    }

    fn clear_handle(&self, handle: &zen_canvas_native_host::HostProvidedHandle) {
        let mut state = lock(&self.state);
        if state
            .host_handle
            .as_ref()
            .is_some_and(|active| active.host_token == handle.host_token)
        {
            state.host_handle = None;
        }
    }

    fn unload_internal(&self) {
        let (handle, generation_id, child, site, stream) = {
            let mut state = lock(&self.state);
            if state.unloaded {
                return;
            }
            state.unloaded = true;
            (
                state.host_handle.take(),
                state.generation_id.take(),
                state.child.take(),
                state.site.take(),
                state.stream.take(),
            )
        };

        // The request capability is revoked before any COM stream, site or
        // HWND release so a blocked read observes cancellation first.
        if let (Some(handle), Some(generation_id)) = (handle, generation_id.as_deref()) {
            let _ = host_registry().revoke(
                &handle.host_token,
                HostProvidedHost::WindowsPreviewHandler,
                generation_id,
            );
        }
        window::destroy_surface(child);
        drop(site);
        drop(stream);
    }
}

impl Drop for PreviewHandler {
    fn drop(&mut self) {
        self.unload_internal();
        ACTIVE_OBJECTS.fetch_sub(1, Ordering::AcqRel);
    }
}

impl IInitializeWithStream_Impl for PreviewHandler_Impl {
    fn Initialize(&self, pstream: Ref<'_, IStream>, _grfmode: u32) -> Result<()> {
        let stream = pstream
            .cloned()
            .ok_or_else(|| error(E_POINTER, "preview stream is null"))?;
        let mut state = lock(&self.state);
        if state.unloaded || state.initialized {
            return Err(error(
                E_UNEXPECTED,
                "preview handler is already initialized",
            ));
        }
        state.initialized = true;
        state.generation_id = Some(Uuid::new_v4().to_string());
        state.stream = Some(stream);
        Ok(())
    }
}

impl IPreviewHandler_Impl for PreviewHandler_Impl {
    fn SetWindow(&self, hwnd: HWND, prc: *const RECT) -> Result<()> {
        if prc.is_null() {
            return Err(error(E_POINTER, "preview rectangle is null"));
        }
        self.set_window(hwnd, unsafe { *prc })
    }

    fn SetRect(&self, prc: *const RECT) -> Result<()> {
        if prc.is_null() {
            return Err(error(E_POINTER, "preview rectangle is null"));
        }
        self.set_rect(unsafe { *prc })
    }

    fn DoPreview(&self) -> Result<()> {
        self.do_preview()
    }

    fn Unload(&self) -> Result<()> {
        self.unload_internal();
        Ok(())
    }

    fn SetFocus(&self) -> Result<()> {
        let child = lock(&self.state)
            .child
            .ok_or_else(|| error(E_UNEXPECTED, "preview window is not attached"))?;
        window::focus_surface(child);
        Ok(())
    }

    fn QueryFocus(&self) -> Result<HWND> {
        let focused = window::focused_window();
        if focused.is_invalid() {
            Err(error(E_FAIL, "preview focus is unavailable"))
        } else {
            Ok(focused)
        }
    }

    fn TranslateAccelerator(&self, pmsg: *const MSG) -> Result<()> {
        if pmsg.is_null() {
            return Err(error(E_POINTER, "preview message is null"));
        }
        let message = unsafe { *pmsg };
        if message.message == WM_KEYDOWN && message.wParam.0 == usize::from(VK_TAB.0) {
            self.SetFocus()?;
            Ok(())
        } else {
            Err(Error::from_hresult(S_FALSE))
        }
    }
}

impl IOleWindow_Impl for PreviewHandler_Impl {
    fn GetWindow(&self) -> Result<HWND> {
        let parent = lock(&self.state).parent;
        if parent.is_invalid() {
            Err(error(E_UNEXPECTED, "preview parent window is unavailable"))
        } else {
            Ok(parent)
        }
    }

    fn ContextSensitiveHelp(&self, _fentermode: BOOL) -> Result<()> {
        Err(Error::from_hresult(E_NOTIMPL))
    }
}

impl IObjectWithSite_Impl for PreviewHandler_Impl {
    fn SetSite(&self, punksite: Ref<'_, IUnknown>) -> Result<()> {
        let site = punksite.cloned();
        let previous = {
            let mut state = lock(&self.state);
            std::mem::replace(&mut state.site, site)
        };
        // Keep COM Release outside the handler state mutex. The site may run
        // arbitrary apartment/runtime teardown code during its final release.
        drop(previous);
        Ok(())
    }

    fn GetSite(&self, riid: *const GUID, ppvsite: *mut *mut c_void) -> Result<()> {
        if riid.is_null() || ppvsite.is_null() {
            return Err(error(E_POINTER, "null site output pointer"));
        }
        unsafe {
            *ppvsite = null_mut();
        }
        let site = lock(&self.state)
            .site
            .clone()
            .ok_or_else(|| error(E_FAIL, "preview site is not set"))?;
        let status = unsafe { site.query(riid, ppvsite) };
        if status.is_ok() {
            Ok(())
        } else {
            Err(Error::from_hresult(status))
        }
    }
}

fn inert_preview_text(bytes: &[u8], complete: bool) -> String {
    let sample = String::from_utf8_lossy(&bytes[..bytes.len().min(256)]);
    let sample = sample
        .chars()
        .map(|character| {
            if character == '\r' || character == '\n' || character == '\t' {
                character
            } else if character.is_control() {
                ' '
            } else {
                character
            }
        })
        .collect::<String>();
    format!(
        "Zen Canvas Preview Handler\r\nbounded bytes: {}\r\ncomplete: {}\r\n\r\n{}",
        bytes.len(),
        complete,
        sample
    )
}

#[cfg(test)]
mod tests {
    use std::sync::{Mutex, OnceLock};

    use windows::{
        core::{Interface, GUID},
        Win32::{
            System::Com::IClassFactory,
            UI::{Shell::IPreviewHandler, Shell::PropertiesSystem::IInitializeWithStream},
        },
    };

    use super::{ClassFactory, ACTIVE_OBJECTS};

    fn com_test_lock() -> std::sync::MutexGuard<'static, ()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(())).lock().unwrap()
    }

    #[test]
    fn class_factory_constructs_preview_interfaces_and_unload_is_idempotent() {
        let _guard = com_test_lock();
        let before = ACTIVE_OBJECTS.load(std::sync::atomic::Ordering::Acquire);
        let factory: IClassFactory = ClassFactory::new().into();
        assert!(ACTIVE_OBJECTS.load(std::sync::atomic::Ordering::Acquire) > before);
        let handler: IPreviewHandler = unsafe { factory.CreateInstance(None).unwrap() };
        let _initializer: IInitializeWithStream = handler.cast().unwrap();
        unsafe {
            handler.Unload().unwrap();
            handler.Unload().unwrap();
        }
        drop(_initializer);
        drop(handler);
        drop(factory);
        assert_eq!(
            ACTIVE_OBJECTS.load(std::sync::atomic::Ordering::Acquire),
            before
        );
    }

    #[test]
    fn unsupported_class_and_invalid_call_order_fail_closed() {
        let _guard = com_test_lock();
        let mut output = std::ptr::null_mut();
        let wrong_clsid = GUID::from_u128(0x11111111_2222_3333_4444_555555555555);
        let status = super::dll_get_class_object(
            &wrong_clsid,
            &<IClassFactory as Interface>::IID,
            &mut output,
        );
        assert_eq!(status, crate::CLASS_E_CLASSNOTAVAILABLE);
        assert!(output.is_null());

        let factory: IClassFactory = ClassFactory::new().into();
        let handler: IPreviewHandler = unsafe { factory.CreateInstance(None).unwrap() };
        assert!(unsafe { handler.DoPreview() }.is_err());
        let initializer: IInitializeWithStream = handler.cast().unwrap();
        let stream =
            unsafe { windows::Win32::UI::Shell::SHCreateMemStream(Some(b"duplicate initialize")) }
                .expect("Windows memory IStream");
        unsafe {
            initializer.Initialize(&stream, 0).unwrap();
            assert!(initializer.Initialize(&stream, 0).is_err());
        }
        drop(initializer);
        drop(handler);
        drop(factory);
    }
}
