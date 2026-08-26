use std::{
    ffi::c_void,
    ptr::null_mut,
    rc::Rc,
    sync::{atomic::Ordering, Arc},
    thread::ThreadId,
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
            Shell::PropertiesSystem::{IInitializeWithStream, IInitializeWithStream_Impl},
            Shell::{IPreviewHandler, IPreviewHandlerFrame, IPreviewHandler_Impl},
            WindowsAndMessaging::MSG,
        },
    },
};
use zen_canvas_native_host::{
    HostProvidedHost, HostProvidedReadRequest, HostProvidedRegistration, HostProvidedRegistry,
};

use crate::{
    host_registry,
    read_worker::{self, ReadCompletion},
    state::SharedHandlerState,
    stream::MarshaledShellStreamSource,
    window, ACTIVE_OBJECTS, CLASS_E_CLASSNOTAVAILABLE, CLASS_E_NOAGGREGATION, E_ABORT, E_FAIL,
    E_NOTIMPL, E_POINTER, E_UNEXPECTED, PREVIEW_HANDLER_CLSID, S_FALSE,
};

const PREVIEW_READ_BYTES: u32 = 64 * 1024;

fn error(hr: HRESULT, message: &'static str) -> Error {
    Error::new(hr, message)
}

fn owner_thread_error() -> Error {
    error(
        E_UNEXPECTED,
        "preview handler method was called from the wrong COM apartment",
    )
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
    registry: Arc<HostProvidedRegistry>,
    owner_thread: ThreadId,
}

impl PreviewHandler {
    fn new() -> Self {
        ACTIVE_OBJECTS.fetch_add(1, Ordering::AcqRel);
        Self {
            state: SharedHandlerState::default(),
            registry: host_registry(),
            owner_thread: std::thread::current().id(),
        }
    }

    fn ensure_owner_thread(&self) -> Result<()> {
        if std::thread::current().id() == self.owner_thread {
            Ok(())
        } else {
            Err(owner_thread_error())
        }
    }

    fn set_window(&self, hwnd: HWND, rect: RECT) -> Result<()> {
        self.ensure_owner_thread()?;
        self.publish_completed_read();
        if hwnd.is_invalid() {
            return Err(error(E_POINTER, "preview parent window is null"));
        }
        let child = {
            let mut state = self.state.borrow_mut();
            if !state.initialized {
                return Err(error(E_UNEXPECTED, "preview stream is not initialized"));
            }
            state.parent = hwnd;
            state.rect = rect;
            state.child
        };
        if let Some(child) = child {
            window::reparent_surface(child, hwnd)?;
            window::resize_surface(child, rect)?;
        }
        Ok(())
    }

    fn set_rect(&self, rect: RECT) -> Result<()> {
        self.ensure_owner_thread()?;
        self.publish_completed_read();
        let child = {
            let mut state = self.state.borrow_mut();
            if !state.initialized {
                return Err(error(E_UNEXPECTED, "preview stream is not initialized"));
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
        self.ensure_owner_thread()?;
        self.publish_completed_read();
        let (stream, generation_id, parent, rect, existing_child) = {
            let state = self.state.borrow();
            if !state.initialized {
                return Err(error(E_UNEXPECTED, "preview stream is not initialized"));
            }
            if state.preview_started {
                // DoPreview is idempotent for one initialized generation. The
                // existing child and HostProvided record remain the sole ones.
                return Ok(());
            }
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
                state.parent,
                state.rect,
                state.child,
            )
        };
        if parent.is_invalid() {
            return Err(error(E_UNEXPECTED, "preview window is not attached"));
        }

        let child = {
            if let Some(child) = existing_child {
                child
            } else {
                let child = window::create_surface(parent, rect)?;
                let keep = {
                    let mut state = self.state.borrow_mut();
                    if !state.initialized
                        || state.generation_id.as_deref() != Some(generation_id.as_str())
                        || state.child.is_some()
                    {
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
                child
            }
        };

        let observation = read_worker::new_observation();
        let source = match MarshaledShellStreamSource::new(&stream, Arc::clone(&observation)) {
            Ok(source) => Arc::new(source),
            Err(_) => {
                read_worker::discard_observation(&observation);
                return Err(error(E_FAIL, "preview stream could not be marshaled"));
            }
        };
        let handle = match self.registry.register(HostProvidedRegistration {
            host: HostProvidedHost::WindowsPreviewHandler,
            generation_id: generation_id.clone(),
            source,
        }) {
            Ok(handle) => handle,
            Err(_) => {
                read_worker::discard_observation(&observation);
                return Err(error(E_FAIL, "host-provided registration failed"));
            }
        };
        let completion = ReadCompletion::new();

        let should_read = {
            let mut state = self.state.borrow_mut();
            if !state.initialized
                || state.generation_id.as_deref() != Some(generation_id.as_str())
                || state.host_handle.is_some()
                || state.child != Some(child)
            {
                false
            } else {
                state.host_handle = Some(handle.clone());
                state.read_completion = Some(Arc::clone(&completion));
                state.preview_started = true;
                true
            }
        };
        if !should_read {
            self.revoke_handle(&handle, &generation_id);
            read_worker::discard_observation(&observation);
            return Err(error(E_ABORT, "preview handler was unloaded"));
        }

        if window::set_surface_text(child, pending_preview_text()).is_err() {
            self.revoke_handle(&handle, &generation_id);
            read_worker::discard_observation(&observation);
            return Err(error(E_FAIL, "preview surface rejected text"));
        }

        let request = HostProvidedReadRequest {
            host_token: handle.host_token.clone(),
            host: HostProvidedHost::WindowsPreviewHandler,
            generation_id: generation_id.clone(),
            offset_bytes: 0,
            max_bytes: PREVIEW_READ_BYTES,
        };
        if let Err(spawn_error) = read_worker::spawn_bounded_read(
            Arc::clone(&self.registry),
            request,
            observation,
            completion,
        ) {
            self.revoke_handle(&handle, &generation_id);
            let _ = spawn_error;
            return Err(error(E_FAIL, "bounded preview worker could not start"));
        }
        Ok(())
    }

    fn publish_completed_read(&self) {
        let (completion, generation_id, handle, child) = {
            let state = self.state.borrow();
            (
                state.read_completion.clone(),
                state.generation_id.clone(),
                state.host_handle.clone(),
                state.child,
            )
        };
        let (Some(completion), Some(generation_id), Some(handle), Some(child)) =
            (completion, generation_id, handle, child)
        else {
            return;
        };
        let Some(result) = completion.take() else {
            return;
        };
        let detached = {
            let mut state = self.state.borrow_mut();
            if state
                .read_completion
                .as_ref()
                .is_some_and(|current| Arc::ptr_eq(current, &completion))
            {
                state.read_completion = None;
                true
            } else {
                false
            }
        };
        if !detached || !self.is_current(&generation_id, &handle) {
            return;
        }
        match result {
            Ok(read) => {
                let text = inert_preview_text(&read.bytes, read.complete);
                if window::set_surface_text(child, &text).is_err()
                    || !self.is_current(&generation_id, &handle)
                {
                    self.revoke_handle(&handle, &generation_id);
                }
            }
            Err(_) => {
                self.revoke_handle(&handle, &generation_id);
            }
        }
    }

    fn is_current(
        &self,
        generation_id: &str,
        handle: &zen_canvas_native_host::HostProvidedHandle,
    ) -> bool {
        let state = self.state.borrow();
        state.initialized
            && state.generation_id.as_deref() == Some(generation_id)
            && state
                .host_handle
                .as_ref()
                .is_some_and(|active| active.host_token == handle.host_token)
    }

    fn revoke_handle(
        &self,
        handle: &zen_canvas_native_host::HostProvidedHandle,
        generation_id: &str,
    ) {
        let _ = self.registry.revoke(
            &handle.host_token,
            HostProvidedHost::WindowsPreviewHandler,
            generation_id,
        );
        let mut state = self.state.borrow_mut();
        if state
            .host_handle
            .as_ref()
            .is_some_and(|active| active.host_token == handle.host_token)
        {
            state.host_handle = None;
        }
        let completion = state.read_completion.take();
        state.preview_started = false;
        drop(completion);
    }

    fn unload_internal(&self) {
        let (handle, generation_id, child, site, frame, stream, completion) = {
            let mut state = self.state.borrow_mut();
            if !state.initialized
                && state.host_handle.is_none()
                && state.generation_id.is_none()
                && state.stream.is_none()
                && state.child.is_none()
                && state.site.is_none()
                && state.preview_frame.is_none()
                && state.read_completion.is_none()
            {
                return;
            }
            state.initialized = false;
            state.preview_started = false;
            state.parent = HWND(std::ptr::null_mut());
            state.rect = RECT::default();
            (
                state.host_handle.take(),
                state.generation_id.take(),
                state.child.take(),
                state.site.take(),
                state.preview_frame.take(),
                state.stream.take(),
                state.read_completion.take(),
            )
        };

        // Revoke before any stream/site/HWND release so a blocked read observes
        // cancellation first. Registry borrows and source destruction are
        // separated by the registry method boundary.
        if let (Some(handle), Some(generation_id)) = (handle, generation_id.as_deref()) {
            let _ = self.registry.revoke(
                &handle.host_token,
                HostProvidedHost::WindowsPreviewHandler,
                generation_id,
            );
        }
        window::destroy_surface(child);
        drop(completion);
        drop(site);
        drop(frame);
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
        self.ensure_owner_thread()?;
        let stream = pstream
            .cloned()
            .ok_or_else(|| error(E_POINTER, "preview stream is null"))?;
        if self.state.borrow().initialized {
            return Err(error(
                E_UNEXPECTED,
                "preview handler is already initialized",
            ));
        }
        let generation_id = Uuid::new_v4().to_string();
        let mut state = self.state.borrow_mut();
        if state.initialized {
            return Err(error(
                E_UNEXPECTED,
                "preview handler is already initialized",
            ));
        }
        state.initialized = true;
        state.generation_id = Some(generation_id);
        state.stream = Some(Rc::new(stream));
        Ok(())
    }
}

impl IPreviewHandler_Impl for PreviewHandler_Impl {
    fn SetWindow(&self, hwnd: HWND, prc: *const RECT) -> Result<()> {
        self.ensure_owner_thread()?;
        if prc.is_null() {
            return Err(error(E_POINTER, "preview rectangle is null"));
        }
        self.set_window(hwnd, unsafe { *prc })
    }

    fn SetRect(&self, prc: *const RECT) -> Result<()> {
        self.ensure_owner_thread()?;
        if prc.is_null() {
            return Err(error(E_POINTER, "preview rectangle is null"));
        }
        self.set_rect(unsafe { *prc })
    }

    fn DoPreview(&self) -> Result<()> {
        self.do_preview()
    }

    fn Unload(&self) -> Result<()> {
        self.ensure_owner_thread()?;
        self.unload_internal();
        Ok(())
    }

    fn SetFocus(&self) -> Result<()> {
        self.ensure_owner_thread()?;
        let child = self
            .state
            .borrow()
            .child
            .ok_or_else(|| error(E_UNEXPECTED, "preview window is not attached"))?;
        window::focus_surface(child);
        Ok(())
    }

    fn QueryFocus(&self) -> Result<HWND> {
        self.ensure_owner_thread()?;
        // IPreviewHandler::QueryFocus reports the current thread's GetFocus
        // result. The preview host, not the handler, decides whether another
        // same-thread window is an eligible focus owner.
        Ok(window::focused_window())
    }

    fn TranslateAccelerator(&self, pmsg: *const MSG) -> Result<()> {
        self.ensure_owner_thread()?;
        if pmsg.is_null() {
            return Err(error(E_POINTER, "preview message is null"));
        }
        let frame = self.state.borrow().preview_frame.clone();
        match frame {
            Some(frame) => unsafe { frame.TranslateAccelerator(pmsg) },
            // The generated windows-rs wrapper maps all non-failing HRESULTs
            // to Ok(()), so an Err carrying S_FALSE is intentional here: it
            // preserves the exact COM ABI result for callers that inspect it.
            None => Err(Error::new(S_FALSE, "preview frame did not handle message")),
        }
    }
}

impl IOleWindow_Impl for PreviewHandler_Impl {
    fn GetWindow(&self) -> Result<HWND> {
        self.ensure_owner_thread()?;
        self.publish_completed_read();
        self.state
            .borrow()
            .child
            .ok_or_else(|| error(E_UNEXPECTED, "preview child window is unavailable"))
    }

    fn ContextSensitiveHelp(&self, _fentermode: BOOL) -> Result<()> {
        Err(Error::from_hresult(E_NOTIMPL))
    }
}

impl IObjectWithSite_Impl for PreviewHandler_Impl {
    fn SetSite(&self, punksite: Ref<'_, IUnknown>) -> Result<()> {
        self.ensure_owner_thread()?;
        let site = punksite.cloned().map(Rc::new);
        let frame = site
            .as_ref()
            .and_then(|site| site.cast::<IPreviewHandlerFrame>().ok())
            .map(Rc::new);
        let (previous_site, previous_frame) = {
            let mut state = self.state.borrow_mut();
            (
                std::mem::replace(&mut state.site, site),
                std::mem::replace(&mut state.preview_frame, frame),
            )
        };
        // COM Release of the previous site/frame is outside HandlerState.
        drop(previous_site);
        drop(previous_frame);
        Ok(())
    }

    fn GetSite(&self, riid: *const GUID, ppvsite: *mut *mut c_void) -> Result<()> {
        self.ensure_owner_thread()?;
        if riid.is_null() || ppvsite.is_null() {
            return Err(error(E_POINTER, "null site output pointer"));
        }
        unsafe {
            *ppvsite = null_mut();
        }
        let site = self
            .state
            .borrow()
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

fn pending_preview_text() -> &'static str {
    "Zen Canvas Preview Handler\r\nbounded read scheduled"
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
            handler.Unload().unwrap();
            // Unload ends the request generation but not the COM object. The
            // same interface set must accept a fresh generation afterward.
            initializer.Initialize(&stream, 0).unwrap();
            handler.Unload().unwrap();
            handler.Unload().unwrap();
        }
        drop(initializer);
        drop(handler);
        drop(factory);
    }
}
