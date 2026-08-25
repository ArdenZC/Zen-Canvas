use windows::{
    core::{w, Result, PCWSTR},
    Win32::{
        Foundation::{HWND, RECT},
        UI::WindowsAndMessaging::{
            CreateWindowExW, DestroyWindow, MoveWindow, SetWindowTextW, ShowWindow, SW_SHOW,
            WS_CHILD, WS_TABSTOP, WS_VISIBLE,
        },
    },
};

fn dimensions(rect: &RECT) -> Result<(i32, i32)> {
    let width = rect.right.checked_sub(rect.left).ok_or_else(|| {
        windows::core::Error::new(windows::core::HRESULT(0x80004005_u32 as _), "invalid width")
    })?;
    let height = rect.bottom.checked_sub(rect.top).ok_or_else(|| {
        windows::core::Error::new(
            windows::core::HRESULT(0x80004005_u32 as _),
            "invalid height",
        )
    })?;
    if width < 0 || height < 0 {
        return Err(windows::core::Error::new(
            windows::core::HRESULT(0x80004005_u32 as _),
            "invalid child rectangle",
        ));
    }
    Ok((width, height))
}

pub(crate) fn create_surface(parent: HWND, rect: RECT) -> Result<HWND> {
    if parent.is_invalid() {
        return Err(windows::core::Error::new(
            windows::core::HRESULT(0x80004003_u32 as _),
            "preview parent window is null",
        ));
    }
    let (width, height) = dimensions(&rect)?;
    unsafe {
        let child = CreateWindowExW(
            Default::default(),
            w!("STATIC"),
            w!("Zen Canvas Preview Handler"),
            WS_CHILD | WS_VISIBLE | WS_TABSTOP,
            rect.left,
            rect.top,
            width,
            height,
            Some(parent),
            None,
            None,
            None,
        )?;
        let _ = ShowWindow(child, SW_SHOW);
        Ok(child)
    }
}

pub(crate) fn resize_surface(child: HWND, rect: RECT) -> Result<()> {
    let (width, height) = dimensions(&rect)?;
    unsafe { MoveWindow(child, rect.left, rect.top, width, height, true) }
}

pub(crate) fn set_surface_text(child: HWND, text: &str) -> Result<()> {
    let mut wide = text.encode_utf16().collect::<Vec<_>>();
    wide.push(0);
    unsafe { SetWindowTextW(child, PCWSTR(wide.as_ptr())) }
}

pub(crate) fn destroy_surface(child: Option<HWND>) {
    if let Some(child) = child.filter(|child| !child.is_invalid()) {
        unsafe {
            let _ = DestroyWindow(child);
        }
    }
}

pub(crate) fn focus_surface(child: HWND) {
    unsafe {
        let _ = windows_sys::Win32::UI::Input::KeyboardAndMouse::SetFocus(child.0);
    }
}

pub(crate) fn focused_window() -> HWND {
    HWND(unsafe { windows_sys::Win32::UI::Input::KeyboardAndMouse::GetFocus() })
}

#[cfg(test)]
mod tests {
    use windows::Win32::Foundation::RECT;

    use super::dimensions;

    #[test]
    fn child_geometry_rejects_inverted_rectangles() {
        assert_eq!(
            dimensions(&RECT {
                left: 1,
                top: 2,
                right: 9,
                bottom: 12
            })
            .unwrap(),
            (8, 10)
        );
        assert!(dimensions(&RECT {
            left: 9,
            top: 2,
            right: 1,
            bottom: 12
        })
        .is_err());
    }
}
