use std::sync::Mutex;
use windows::{
    core::IUnknown,
    Win32::{
        Foundation::{HWND, RECT},
        System::Com::IStream,
    },
};
use zen_canvas_native_host::HostProvidedHandle;

#[derive(Default)]
pub(crate) struct HandlerState {
    pub(crate) initialized: bool,
    pub(crate) unloaded: bool,
    pub(crate) preview_started: bool,
    pub(crate) generation_id: Option<String>,
    pub(crate) stream: Option<IStream>,
    pub(crate) site: Option<IUnknown>,
    pub(crate) parent: HWND,
    pub(crate) rect: RECT,
    pub(crate) child: Option<HWND>,
    pub(crate) host_handle: Option<HostProvidedHandle>,
}

pub(crate) type SharedHandlerState = Mutex<HandlerState>;
