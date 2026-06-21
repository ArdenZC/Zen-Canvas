use tauri::{AppHandle, Runtime};

#[cfg(feature = "desktop-runtime")]
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, Manager,
};

#[cfg(feature = "desktop-runtime")]
const TRAY_SHOW_MAIN_WINDOW_ID: &str = "show-main-window";
#[cfg(feature = "desktop-runtime")]
const TRAY_QUIT_APP_ID: &str = "quit-app";
#[cfg(feature = "desktop-runtime")]
const TRAY_ICON_BYTES: &[u8] = include_bytes!("../../build/icon.png");

pub fn exit_app<R: Runtime>(app: &AppHandle<R>) {
    app.exit(0);
}

#[tauri::command]
pub fn quit_app<R: Runtime>(app: AppHandle<R>) {
    exit_app(&app);
}

#[cfg(feature = "desktop-runtime")]
pub fn show_main_window<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.show()?;
        window.set_focus()?;
    }
    Ok(())
}

#[cfg(feature = "desktop-runtime")]
pub fn setup_tray(app: &mut App) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(
        app,
        TRAY_SHOW_MAIN_WINDOW_ID,
        "显示主窗口",
        true,
        None::<&str>,
    )?;
    let quit_item = MenuItem::with_id(app, TRAY_QUIT_APP_ID, "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;
    let icon = Image::from_bytes(TRAY_ICON_BYTES)?;

    TrayIconBuilder::new()
        .icon(icon)
        .tooltip("Zen Canvas")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            TRAY_SHOW_MAIN_WINDOW_ID => {
                if let Err(error) = show_main_window(app) {
                    eprintln!("Show main window from tray failed: {error}");
                }
            }
            TRAY_QUIT_APP_ID => exit_app(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Err(error) = show_main_window(tray.app_handle()) {
                    eprintln!("Show main window from tray click failed: {error}");
                }
            }
        })
        .build(app)?;
    Ok(())
}
