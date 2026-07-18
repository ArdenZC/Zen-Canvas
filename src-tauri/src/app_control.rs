use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Runtime, State, WebviewWindow};

use crate::{settings::DEFAULT_SEARCH_HOTKEY, window_auth::require_main_window};

#[cfg(feature = "desktop-runtime")]
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, Emitter, LogicalSize, Manager, Size, WebviewUrl, WebviewWindowBuilder,
};
#[cfg(feature = "desktop-runtime")]
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[cfg(feature = "desktop-runtime")]
const TRAY_SHOW_MAIN_WINDOW_ID: &str = "show-main-window";
#[cfg(feature = "desktop-runtime")]
const TRAY_QUIT_APP_ID: &str = "quit-app";
#[cfg(feature = "desktop-runtime")]
const TRAY_ICON_BYTES: &[u8] = include_bytes!("../../build/icon.png");
#[cfg(feature = "desktop-runtime")]
const MAIN_WINDOW_LABEL: &str = "main";
#[cfg(feature = "desktop-runtime")]
const SEARCH_WINDOW_LABEL: &str = "search";
const SEARCH_WINDOW_URL: &str = "index.html?mode=search";
#[cfg(feature = "desktop-runtime")]
const SEARCH_WINDOW_WIDTH: f64 = 820.0;
#[cfg(feature = "desktop-runtime")]
const SEARCH_WINDOW_COLLAPSED_HEIGHT: f64 = 160.0;
#[cfg(feature = "desktop-runtime")]
const SEARCH_WINDOW_EXPANDED_HEIGHT: f64 = 660.0;
#[cfg(feature = "desktop-runtime")]
const SEARCH_NAVIGATE_EVENT: &str = "search-navigate";
#[cfg(feature = "desktop-runtime")]
const GLOBAL_SEARCH_REQUESTED_EVENT: &str = "global-search-requested";
#[cfg(feature = "desktop-runtime")]
const GLOBAL_HOTKEY_REGISTRATION_FAILED_EVENT: &str = "global-hotkey-registration-failed";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SearchNavigatePayload {
    pub view: SearchView,
    pub file_id: Option<String>,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SearchView {
    Scanner,
    Cleanup,
    Organize,
    Library,
    Preview,
    Rules,
    Restore,
    Settings,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GlobalHotkeyErrorPayload {
    pub message: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GlobalHotkeyStatus {
    pub accelerator: String,
    pub registered: bool,
    pub error: Option<String>,
}

#[cfg(any(feature = "desktop-runtime", test))]
#[derive(Debug, Clone, PartialEq, Eq)]
struct HotkeyRollbackResult {
    returned_status: GlobalHotkeyStatus,
    state_status: GlobalHotkeyStatus,
}

#[derive(Debug, Default)]
pub struct GlobalHotkeyStatusState {
    status: Mutex<Option<GlobalHotkeyStatus>>,
}

impl SearchNavigatePayload {
    pub fn new(view: SearchView, file_id: Option<String>) -> Self {
        Self { view, file_id }
    }
}

impl GlobalHotkeyStatusState {
    pub fn set(&self, status: GlobalHotkeyStatus) {
        if let Ok(mut guard) = self.status.lock() {
            *guard = Some(status);
        }
    }

    pub fn get(&self) -> Option<GlobalHotkeyStatus> {
        self.status.lock().ok().and_then(|guard| guard.clone())
    }
}

pub fn search_window_url() -> &'static str {
    SEARCH_WINDOW_URL
}

pub fn exit_app<R: Runtime>(app: &AppHandle<R>) {
    app.exit(0);
}

#[tauri::command]
pub fn quit_app<R: Runtime>(window: WebviewWindow<R>, app: AppHandle<R>) -> Result<(), String> {
    require_main_window(&window)?;
    exit_app(&app);
    Ok(())
}

#[cfg(feature = "desktop-runtime")]
pub fn show_main_window<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        window.unminimize()?;
        window.show()?;
        window.set_focus()?;
    }
    Ok(())
}

#[tauri::command]
pub fn activate_search_result<R: Runtime>(
    app: AppHandle<R>,
    view: SearchView,
    file_id: Option<String>,
) -> Result<(), String> {
    let payload = SearchNavigatePayload::new(view, file_id);
    activate_search_result_payload(&app, payload).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_global_hotkey_status(
    status_state: State<'_, GlobalHotkeyStatusState>,
) -> Option<GlobalHotkeyStatus> {
    status_state.get()
}

#[tauri::command]
pub fn register_global_search_hotkey<R: Runtime>(
    window: WebviewWindow<R>,
    app: AppHandle<R>,
    status_state: State<'_, GlobalHotkeyStatusState>,
    accelerator: String,
) -> GlobalHotkeyStatus {
    if require_main_window(&window).is_err() {
        return GlobalHotkeyStatus {
            registered: false,
            accelerator: accelerator.clone(),
            error: Some("main_window_required".to_string()),
        };
    }
    register_global_search_shortcut(&app, &status_state, &accelerator)
}

#[tauri::command]
pub fn resize_search_window<R: Runtime>(app: AppHandle<R>, expanded: bool) -> Result<(), String> {
    resize_search_window_for_state(&app, expanded).map_err(|error| error.to_string())
}

#[cfg(feature = "desktop-runtime")]
fn activate_search_result_payload<R: Runtime>(
    app: &AppHandle<R>,
    payload: SearchNavigatePayload,
) -> tauri::Result<()> {
    show_main_window(app)?;
    app.emit_to(MAIN_WINDOW_LABEL, SEARCH_NAVIGATE_EVENT, payload)?;
    hide_search_window(app)?;
    Ok(())
}

#[cfg(not(feature = "desktop-runtime"))]
fn activate_search_result_payload<R: Runtime>(
    _app: &AppHandle<R>,
    _payload: SearchNavigatePayload,
) -> tauri::Result<()> {
    Ok(())
}

#[cfg(feature = "desktop-runtime")]
pub fn setup_search_window(app: &mut App) -> tauri::Result<()> {
    if app.get_webview_window(SEARCH_WINDOW_LABEL).is_some() {
        return Ok(());
    }

    WebviewWindowBuilder::new(
        app,
        SEARCH_WINDOW_LABEL,
        WebviewUrl::App(search_window_url().into()),
    )
    .title("Zen Canvas Search")
    .inner_size(SEARCH_WINDOW_WIDTH, SEARCH_WINDOW_COLLAPSED_HEIGHT)
    .min_inner_size(SEARCH_WINDOW_WIDTH, SEARCH_WINDOW_COLLAPSED_HEIGHT)
    .max_inner_size(SEARCH_WINDOW_WIDTH, SEARCH_WINDOW_EXPANDED_HEIGHT)
    .decorations(false)
    .transparent(true)
    .shadow(false)
    .resizable(false)
    .skip_taskbar(true)
    .always_on_top(true)
    .visible(false)
    .center()
    .build()?;
    Ok(())
}

#[cfg(feature = "desktop-runtime")]
pub fn setup_global_search_shortcut(app: &mut App, accelerator: &str) -> Result<(), String> {
    app.handle()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        if let Err(error) = toggle_search_window(app) {
                            eprintln!("Toggle search window from global shortcut failed: {error}");
                        }
                    }
                })
                .build(),
        )
        .map_err(|error| error.to_string())?;
    let status_state = app.state::<GlobalHotkeyStatusState>();
    let status = register_global_search_shortcut(app.handle(), &status_state, accelerator);
    if status.registered {
        Ok(())
    } else {
        Err(status
            .error
            .unwrap_or_else(|| "Global search hotkey registration failed".to_string()))
    }
}

#[cfg(feature = "desktop-runtime")]
fn register_global_search_shortcut<R: Runtime>(
    app: &AppHandle<R>,
    status_state: &GlobalHotkeyStatusState,
    accelerator: &str,
) -> GlobalHotkeyStatus {
    let accelerator = global_search_accelerator(accelerator).to_string();
    let previous_status = status_state.get();
    if let Some(previous) = previous_status
        .as_ref()
        .filter(|status| status.registered && status.accelerator == accelerator)
    {
        return previous.clone();
    }
    let shortcut = match global_search_shortcut(&accelerator) {
        Ok(shortcut) => shortcut,
        Err(error) => {
            let message =
                format!("Global search hotkey registration failed for {accelerator}: {error}");
            eprintln!("{message}");
            emit_global_hotkey_error(app, message.clone());
            let status = GlobalHotkeyStatus {
                accelerator,
                registered: false,
                error: Some(message),
            };
            return status;
        }
    };

    if let Some(previous) = previous_status.as_ref().filter(|status| status.registered) {
        if previous.accelerator != accelerator {
            match global_search_shortcut(&previous.accelerator) {
                Ok(previous_shortcut) => {
                    if let Err(error) = app.global_shortcut().unregister(previous_shortcut) {
                        let rollback = hotkey_registration_failure_with_rollback(
                            accelerator,
                            format!("Global search hotkey reset failed: {error}"),
                            previous_status,
                            None,
                        );
                        if let Some(message) = rollback.returned_status.error.clone() {
                            eprintln!("{message}");
                            emit_global_hotkey_error(app, message);
                        }
                        status_state.set(rollback.state_status.clone());
                        return rollback.returned_status;
                    }
                }
                Err(error) => {
                    let message = format!(
                        "Previous global search hotkey could not be parsed for rollback: {error}"
                    );
                    eprintln!("{message}");
                    emit_global_hotkey_error(app, message.clone());
                    let status = GlobalHotkeyStatus {
                        accelerator,
                        registered: false,
                        error: Some(message),
                    };
                    status_state.set(status.clone());
                    return status;
                }
            }
        }
    }

    let status = match app.global_shortcut().register(shortcut) {
        Ok(()) => GlobalHotkeyStatus {
            accelerator,
            registered: true,
            error: None,
        },
        Err(error) => {
            let previous_for_restore = previous_status
                .clone()
                .filter(|status| status.registered && status.accelerator != accelerator);
            let restore_error =
                restore_previous_global_hotkey(app, previous_for_restore.as_ref()).err();
            let rollback = hotkey_registration_failure_with_rollback(
                accelerator,
                error.to_string(),
                previous_for_restore,
                restore_error,
            );
            if let Some(message) = rollback.returned_status.error.clone() {
                eprintln!("{message}");
                emit_global_hotkey_error(app, message);
            }
            status_state.set(rollback.state_status.clone());
            return rollback.returned_status;
        }
    };
    status_state.set(status.clone());
    status
}

#[cfg(feature = "desktop-runtime")]
fn restore_previous_global_hotkey<R: Runtime>(
    app: &AppHandle<R>,
    previous_status: Option<&GlobalHotkeyStatus>,
) -> Result<(), String> {
    let Some(previous) = previous_status else {
        return Ok(());
    };
    let previous_shortcut = global_search_shortcut(&previous.accelerator)?;
    app.global_shortcut()
        .register(previous_shortcut)
        .map_err(|error| error.to_string())
}

#[cfg(any(feature = "desktop-runtime", test))]
fn hotkey_registration_failure_with_rollback(
    requested_accelerator: String,
    registration_error: String,
    previous_status: Option<GlobalHotkeyStatus>,
    restore_error: Option<String>,
) -> HotkeyRollbackResult {
    let base_message = format!(
        "Global search hotkey registration failed for {requested_accelerator}: {registration_error}"
    );

    match (previous_status, restore_error) {
        (Some(previous), None) if previous.registered => {
            let returned_status = GlobalHotkeyStatus {
                accelerator: requested_accelerator,
                registered: false,
                error: Some(format!(
                    "{base_message}; restored previous hotkey {}",
                    previous.accelerator
                )),
            };
            HotkeyRollbackResult {
                returned_status,
                state_status: previous,
            }
        }
        (Some(previous), Some(restore_error)) if previous.registered => {
            let returned_status = GlobalHotkeyStatus {
                accelerator: requested_accelerator,
                registered: false,
                error: Some(format!(
                    "{base_message}; restore previous hotkey failed for {}: {restore_error}",
                    previous.accelerator
                )),
            };
            HotkeyRollbackResult {
                returned_status: returned_status.clone(),
                state_status: returned_status,
            }
        }
        _ => {
            let returned_status = GlobalHotkeyStatus {
                accelerator: requested_accelerator,
                registered: false,
                error: Some(base_message),
            };
            HotkeyRollbackResult {
                returned_status: returned_status.clone(),
                state_status: returned_status,
            }
        }
    }
}

#[cfg(not(feature = "desktop-runtime"))]
fn register_global_search_shortcut<R: Runtime>(
    _app: &AppHandle<R>,
    status_state: &GlobalHotkeyStatusState,
    accelerator: &str,
) -> GlobalHotkeyStatus {
    let status = GlobalHotkeyStatus {
        accelerator: global_search_accelerator(accelerator).to_string(),
        registered: false,
        error: Some("Global hotkeys require the desktop runtime.".to_string()),
    };
    status_state.set(status.clone());
    status
}

#[cfg(feature = "desktop-runtime")]
fn global_search_shortcut(accelerator: &str) -> Result<Shortcut, String> {
    global_search_accelerator(accelerator)
        .parse::<Shortcut>()
        .map_err(|error| error.to_string())
}

pub fn global_search_accelerator(accelerator: &str) -> &str {
    let trimmed = accelerator.trim();
    if trimmed.is_empty() {
        DEFAULT_SEARCH_HOTKEY
    } else {
        trimmed
    }
}

#[cfg(feature = "desktop-runtime")]
fn emit_global_hotkey_error<R: Runtime>(app: &AppHandle<R>, message: String) {
    let _ = app.emit(
        GLOBAL_HOTKEY_REGISTRATION_FAILED_EVENT,
        GlobalHotkeyErrorPayload { message },
    );
}

#[cfg(feature = "desktop-runtime")]
fn resize_search_window_for_state<R: Runtime>(
    app: &AppHandle<R>,
    expanded: bool,
) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(SEARCH_WINDOW_LABEL) {
        window.set_size(Size::Logical(LogicalSize {
            width: SEARCH_WINDOW_WIDTH,
            height: if expanded {
                SEARCH_WINDOW_EXPANDED_HEIGHT
            } else {
                SEARCH_WINDOW_COLLAPSED_HEIGHT
            },
        }))?;
        window.center()?;
    }
    Ok(())
}

#[cfg(not(feature = "desktop-runtime"))]
fn resize_search_window_for_state<R: Runtime>(
    _app: &AppHandle<R>,
    _expanded: bool,
) -> tauri::Result<()> {
    Ok(())
}

#[cfg(feature = "desktop-runtime")]
pub fn toggle_search_window<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(SEARCH_WINDOW_LABEL) {
        let visibility = match window.is_visible() {
            Ok(is_visible) => Some(is_visible),
            Err(error) => {
                eprintln!(
                    "Read search window visibility failed; opening Spotlight in the main window: {error}"
                );
                None
            }
        };
        match search_window_action(visibility) {
            SearchWindowAction::ShowStandalone => {
                resize_search_window_for_state(app, false)?;
                window.show()?;
                window.set_focus()?;
            }
            SearchWindowAction::HideStandalone => window.hide()?,
            SearchWindowAction::ShowMainFallback => {
                show_main_window(app)?;
                app.emit_to(MAIN_WINDOW_LABEL, GLOBAL_SEARCH_REQUESTED_EVENT, ())?;
            }
        }
    }
    Ok(())
}

#[cfg(any(feature = "desktop-runtime", test))]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SearchWindowAction {
    ShowStandalone,
    HideStandalone,
    ShowMainFallback,
}

#[cfg(any(feature = "desktop-runtime", test))]
fn search_window_action(is_visible: Option<bool>) -> SearchWindowAction {
    match is_visible {
        Some(true) => SearchWindowAction::HideStandalone,
        Some(false) => SearchWindowAction::ShowStandalone,
        None => SearchWindowAction::ShowMainFallback,
    }
}

#[cfg(feature = "desktop-runtime")]
pub fn hide_search_window<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(SEARCH_WINDOW_LABEL) {
        window.hide()?;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn global_search_shortcut_matches_documented_accelerator() {
        assert_eq!(DEFAULT_SEARCH_HOTKEY, "CmdOrCtrl+K");
        assert_eq!(global_search_accelerator("Alt+Space"), "Alt+Space");
        assert_eq!(global_search_accelerator(""), DEFAULT_SEARCH_HOTKEY);
    }

    #[cfg(feature = "desktop-runtime")]
    #[test]
    fn global_search_shortcut_parses_for_registration() {
        assert!(global_search_shortcut(DEFAULT_SEARCH_HOTKEY).is_ok());
    }

    #[test]
    fn search_window_url_targets_standalone_search_mode() {
        assert_eq!(search_window_url(), "index.html?mode=search");
    }

    #[test]
    fn search_hotkey_shows_window_when_visibility_cannot_be_read() {
        assert_eq!(
            search_window_action(None),
            SearchWindowAction::ShowMainFallback
        );
        assert_eq!(
            search_window_action(Some(false)),
            SearchWindowAction::ShowStandalone
        );
        assert_eq!(
            search_window_action(Some(true)),
            SearchWindowAction::HideStandalone
        );
    }

    #[test]
    fn search_navigation_payload_serializes_camel_case_file_id() {
        let payload = SearchNavigatePayload::new(SearchView::Library, Some("file-1".to_string()));
        let value = serde_json::to_value(payload).expect("serialize search navigation payload");

        assert_eq!(value["view"], "library");
        assert_eq!(value["fileId"], "file-1");
    }

    #[test]
    fn hotkey_registration_failure_restores_previous_status_when_fallback_succeeds() {
        let previous = GlobalHotkeyStatus {
            accelerator: "CmdOrCtrl+K".to_string(),
            registered: true,
            error: None,
        };

        let rollback = hotkey_registration_failure_with_rollback(
            "Alt+Space".to_string(),
            "shortcut already registered".to_string(),
            Some(previous.clone()),
            None,
        );

        assert!(!rollback.returned_status.registered);
        assert_eq!(rollback.returned_status.accelerator, "Alt+Space");
        assert!(rollback
            .returned_status
            .error
            .as_deref()
            .unwrap_or_default()
            .contains("restored previous hotkey CmdOrCtrl+K"));
        assert_eq!(rollback.state_status, previous);
    }

    #[test]
    fn hotkey_registration_failure_keeps_failure_status_when_fallback_fails() {
        let previous = GlobalHotkeyStatus {
            accelerator: "CmdOrCtrl+K".to_string(),
            registered: true,
            error: None,
        };

        let rollback = hotkey_registration_failure_with_rollback(
            "Alt+Space".to_string(),
            "shortcut already registered".to_string(),
            Some(previous),
            Some("restore failed".to_string()),
        );

        assert!(!rollback.returned_status.registered);
        assert_eq!(rollback.returned_status.accelerator, "Alt+Space");
        assert!(rollback
            .returned_status
            .error
            .as_deref()
            .unwrap_or_default()
            .contains("restore previous hotkey failed"));
        assert_eq!(rollback.state_status, rollback.returned_status);
    }
}
