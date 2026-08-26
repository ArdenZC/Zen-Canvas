use std::{cell::RefCell, rc::Rc, sync::Arc};
use windows::{
    core::IUnknown,
    Win32::{
        Foundation::{HWND, RECT},
        System::Com::IStream,
        UI::Shell::IPreviewHandlerFrame,
    },
};
use zen_canvas_native_host::HostProvidedHandle;

use crate::read_worker::ReadCompletion;

#[derive(Default)]
pub(crate) struct HandlerState {
    pub(crate) initialized: bool,
    pub(crate) preview_started: bool,
    pub(crate) generation_id: Option<String>,
    pub(crate) stream: Option<Rc<IStream>>,
    pub(crate) site: Option<Rc<IUnknown>>,
    pub(crate) preview_frame: Option<Rc<IPreviewHandlerFrame>>,
    pub(crate) parent: HWND,
    pub(crate) rect: RECT,
    pub(crate) child: Option<HWND>,
    pub(crate) host_handle: Option<HostProvidedHandle>,
    pub(crate) read_completion: Option<Arc<ReadCompletion>>,
    pub(crate) read_cancellation: Option<Arc<crate::read_worker::WorkerCancellation>>,
}

pub(crate) type SharedHandlerState = RefCell<HandlerState>;
