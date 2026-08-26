use std::{
    ffi::c_void,
    sync::{
        atomic::{AtomicU32, Ordering},
        Mutex,
    },
};

use windows::{
    core::{w, Error, Result},
    Win32::{
        Foundation::{HWND, LPARAM, LRESULT, WPARAM},
        UI::WindowsAndMessaging::{
            CreateWindowExW, DefWindowProcW, DestroyWindow, GetWindowLongPtrW, PostMessageW,
            SetWindowLongPtrW, GWLP_USERDATA, GWLP_WNDPROC, HWND_MESSAGE, WM_NCDESTROY,
            WS_EX_NOACTIVATE,
        },
    },
};

use crate::com::PreviewHandler;

const COMPLETION_MESSAGE: u32 = windows::Win32::UI::WindowsAndMessaging::WM_APP + 0x403;
static NEXT_NOTIFICATION_ID: AtomicU32 = AtomicU32::new(1);

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct DeferredPreview {
    pub(crate) text: String,
    pub(crate) bytes_len: usize,
    pub(crate) complete: bool,
    pub(crate) language: Option<String>,
}

pub(crate) struct DeferredCompletion {
    notification_id: u32,
    result: Mutex<Option<std::result::Result<DeferredPreview, String>>>,
}

impl DeferredCompletion {
    pub(crate) fn new() -> Self {
        let notification_id = NEXT_NOTIFICATION_ID.fetch_add(1, Ordering::Relaxed);
        Self {
            notification_id,
            result: Mutex::new(None),
        }
    }

    pub(crate) fn notification_id(&self) -> u32 {
        self.notification_id
    }

    pub(crate) fn store(&self, result: std::result::Result<DeferredPreview, String>) {
        *self
            .result
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner) = Some(result);
    }

    pub(crate) fn take(&self) -> Option<std::result::Result<DeferredPreview, String>> {
        self.result
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .take()
    }
}

/// A message-only window created on the handler's owner STA. It carries only
/// an opaque notification id; the worker never receives a handler pointer or
/// any COM/native source object.
pub(crate) struct CompletionWindow {
    hwnd: HWND,
}

impl CompletionWindow {
    pub(crate) fn create(owner: *const PreviewHandler) -> Result<Self> {
        let hwnd = unsafe {
            CreateWindowExW(
                WS_EX_NOACTIVATE,
                w!("STATIC"),
                w!(""),
                Default::default(),
                0,
                0,
                0,
                0,
                Some(HWND_MESSAGE),
                None,
                None,
                None,
            )?
        };
        let previous = unsafe {
            SetWindowLongPtrW(
                hwnd,
                GWLP_WNDPROC,
                window_proc as *const () as usize as isize,
            )
        };
        if previous == 0 {
            unsafe {
                let _ = DestroyWindow(hwnd);
            }
            return Err(Error::from_win32());
        }
        unsafe {
            let _ = SetWindowLongPtrW(hwnd, GWLP_USERDATA, owner as isize);
        }
        Ok(Self { hwnd })
    }

    pub(crate) fn raw_handle(&self) -> isize {
        self.hwnd.0 as isize
    }
}

impl Drop for CompletionWindow {
    fn drop(&mut self) {
        unsafe {
            let _ = SetWindowLongPtrW(self.hwnd, GWLP_USERDATA, 0);
            let _ = DestroyWindow(self.hwnd);
        }
    }
}

pub(crate) fn post_completion(raw_hwnd: isize, notification_id: u32) {
    if raw_hwnd == 0 {
        return;
    }
    let hwnd = HWND(raw_hwnd as *mut c_void);
    unsafe {
        let _ = PostMessageW(
            Some(hwnd),
            COMPLETION_MESSAGE,
            WPARAM(notification_id as usize),
            LPARAM(0),
        );
    }
}

unsafe extern "system" fn window_proc(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if message == COMPLETION_MESSAGE {
        let owner = GetWindowLongPtrW(hwnd, GWLP_USERDATA) as *const PreviewHandler;
        if !owner.is_null() {
            (&*owner).publish_deferred(wparam.0 as u32);
        }
        return LRESULT(0);
    }
    if message == WM_NCDESTROY {
        let _ = SetWindowLongPtrW(hwnd, GWLP_USERDATA, 0);
    }
    DefWindowProcW(hwnd, message, wparam, lparam)
}
