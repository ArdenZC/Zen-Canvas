use std::ffi::c_void;

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

/// A message-only window owned by the handler's creating STA. It carries no
/// COM state and is used only to deliver a worker completion back to that STA.
/// The raw handler pointer is installed only while this window is alive and is
/// cleared before the window is destroyed in `PreviewHandler::drop`.
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
        // The handler pointer must not be observable during WM_DESTROY or
        // WM_NCDESTROY. This drop runs on the owning STA before the handler
        // allocation itself is released.
        unsafe {
            let _ = SetWindowLongPtrW(self.hwnd, GWLP_USERDATA, 0);
            let _ = DestroyWindow(self.hwnd);
        }
    }
}

pub(crate) fn post_completion(raw_hwnd: isize, notification_id: u32) {
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
            // The window is owned by the handler's STA, and its user-data
            // pointer is cleared before the handler can be dropped.
            (&*owner).publish_completed_read(wparam.0 as u32);
        }
        return LRESULT(0);
    }

    if message == WM_NCDESTROY {
        let _ = SetWindowLongPtrW(hwnd, GWLP_USERDATA, 0);
    }
    DefWindowProcW(hwnd, message, wparam, lparam)
}
