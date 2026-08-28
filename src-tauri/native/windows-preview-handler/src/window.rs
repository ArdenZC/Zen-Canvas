use std::mem::size_of;

use std::sync::OnceLock;
use windows::{
    core::{w, Error, Result, HRESULT, PCWSTR},
    Win32::{
        Foundation::{COLORREF, HWND, LPARAM, RECT, WPARAM},
        Graphics::Gdi::{
            CreateFontIndirectW, GetStockObject, GetSysColor, COLOR_WINDOW, COLOR_WINDOWTEXT,
            HFONT, LOGFONTW, SYSTEM_FIXED_FONT,
        },
        System::LibraryLoader::LoadLibraryW,
        UI::Controls::RichEdit::{
            CFM_COLOR, CHARFORMAT2W, EM_EXLIMITTEXT, EM_SETBKGNDCOLOR, EM_SETCHARFORMAT, SCF_ALL,
        },
        UI::WindowsAndMessaging::{
            CreateWindowExW, DestroyWindow, MoveWindow, SendMessageW, SetParent, SetWindowTextW,
            ShowWindow, ES_AUTOHSCROLL, ES_AUTOVSCROLL, ES_MULTILINE, ES_NOHIDESEL, ES_READONLY,
            ES_WANTRETURN, SW_SHOW, WINDOW_STYLE, WM_SETFONT, WS_CHILD, WS_EX_CLIENTEDGE,
            WS_HSCROLL, WS_TABSTOP, WS_VISIBLE, WS_VSCROLL,
        },
    },
};

fn dimensions(rect: &RECT) -> Result<(i32, i32)> {
    let width = rect
        .right
        .checked_sub(rect.left)
        .ok_or_else(|| Error::new(HRESULT(0x80004005_u32 as _), "invalid width"))?;
    let height = rect
        .bottom
        .checked_sub(rect.top)
        .ok_or_else(|| Error::new(HRESULT(0x80004005_u32 as _), "invalid height"))?;
    if width < 0 || height < 0 {
        return Err(Error::new(
            HRESULT(0x80004005_u32 as _),
            "invalid child rectangle",
        ));
    }
    Ok((width, height))
}

pub(crate) fn create_surface(parent: HWND, rect: RECT) -> Result<HWND> {
    if parent.is_invalid() {
        return Err(Error::new(
            HRESULT(0x80004003_u32 as _),
            "preview parent window is null",
        ));
    }
    let (width, height) = dimensions(&rect)?;
    ensure_rich_edit_loaded()?;
    unsafe {
        let child = CreateWindowExW(
            WS_EX_CLIENTEDGE,
            w!("RICHEDIT50W"),
            w!(""),
            WS_CHILD
                | WS_VISIBLE
                | WS_TABSTOP
                | WS_VSCROLL
                | WS_HSCROLL
                | WINDOW_STYLE(
                    (ES_MULTILINE
                        | ES_READONLY
                        | ES_AUTOVSCROLL
                        | ES_AUTOHSCROLL
                        | ES_NOHIDESEL
                        | ES_WANTRETURN) as u32,
                ),
            rect.left,
            rect.top,
            width,
            height,
            Some(parent),
            None,
            None,
            None,
        )?;
        let stock_font = GetStockObject(SYSTEM_FIXED_FONT);
        if !stock_font.is_invalid() {
            let _ = SendMessageW(
                child,
                WM_SETFONT,
                Some(WPARAM(stock_font.0 as usize)),
                Some(LPARAM(1)),
            );
        }
        let _ = SendMessageW(
            child,
            EM_EXLIMITTEXT,
            Some(WPARAM(0)),
            Some(LPARAM((512 * 1024 + 1024) as isize)),
        );
        set_surface_colors(
            child,
            COLORREF(GetSysColor(COLOR_WINDOW)),
            COLORREF(GetSysColor(COLOR_WINDOWTEXT)),
        );
        let _ = ShowWindow(child, SW_SHOW);
        Ok(child)
    }
}

static RICH_EDIT_LOADED: OnceLock<bool> = OnceLock::new();

fn ensure_rich_edit_loaded() -> Result<()> {
    if *RICH_EDIT_LOADED.get_or_init(|| unsafe { LoadLibraryW(w!("Msftedit.dll")).is_ok() }) {
        Ok(())
    } else {
        Err(Error::from_win32())
    }
}

pub(crate) fn resize_surface(child: HWND, rect: RECT) -> Result<()> {
    let (width, height) = dimensions(&rect)?;
    unsafe { MoveWindow(child, rect.left, rect.top, width, height, true) }
}

pub(crate) fn reparent_surface(child: HWND, parent: HWND) -> Result<()> {
    if child.is_invalid() || parent.is_invalid() {
        return Err(Error::new(
            HRESULT(0x80004003_u32 as _),
            "preview child or parent window is null",
        ));
    }
    unsafe { SetParent(child, Some(parent)).map(|_| ()) }
}

pub(crate) fn set_surface_text(child: HWND, text: &str) -> Result<()> {
    let mut wide = text.encode_utf16().collect::<Vec<_>>();
    wide.push(0);
    unsafe { SetWindowTextW(child, PCWSTR(wide.as_ptr())) }
}

pub(crate) fn set_surface_background_color(child: HWND, color: COLORREF) {
    unsafe {
        let _ = SendMessageW(
            child,
            EM_SETBKGNDCOLOR,
            Some(WPARAM(0)),
            Some(LPARAM(color.0 as isize)),
        );
    }
}

pub(crate) fn set_surface_text_color(child: HWND, color: COLORREF) {
    unsafe {
        let mut format = CHARFORMAT2W::default();
        format.Base.cbSize = size_of::<CHARFORMAT2W>() as u32;
        format.Base.dwMask = CFM_COLOR;
        format.Base.crTextColor = color;
        let _ = SendMessageW(
            child,
            EM_SETCHARFORMAT,
            Some(WPARAM(SCF_ALL as usize)),
            Some(LPARAM(
                (&format as *const CHARFORMAT2W).cast::<()>() as isize
            )),
        );
    }
}

pub(crate) fn create_surface_font(logfont: &LOGFONTW) -> Result<HFONT> {
    let font = unsafe { CreateFontIndirectW(logfont) };
    if font.is_invalid() {
        Err(Error::from_win32())
    } else {
        Ok(font)
    }
}

pub(crate) fn set_surface_font(child: HWND, font: HFONT) {
    unsafe {
        let _ = SendMessageW(
            child,
            WM_SETFONT,
            Some(WPARAM(font.0 as usize)),
            Some(LPARAM(1)),
        );
    }
}

pub(crate) fn set_surface_colors(child: HWND, background: COLORREF, text: COLORREF) {
    set_surface_background_color(child, background);
    set_surface_text_color(child, text);
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
    use super::dimensions;
    use windows::Win32::Foundation::RECT;

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
