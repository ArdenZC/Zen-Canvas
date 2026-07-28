use serde::{Deserialize, Serialize};
use std::{
    sync::{Condvar, Mutex},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Runtime, State, WebviewWindow};

use crate::{settings::DEFAULT_SEARCH_HOTKEY, window_auth::require_main_window};

#[cfg(feature = "desktop-runtime")]
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, Emitter, LogicalSize, Manager, Size, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
#[cfg(feature = "desktop-runtime")]
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[cfg(feature = "desktop-runtime")]
const TRAY_SHOW_MAIN_WINDOW_ID: &str = "show-main-window";
#[cfg(feature = "desktop-runtime")]
const TRAY_QUIT_APP_ID: &str = "quit-app";
#[cfg(feature = "desktop-runtime")]
const TRAY_ICON_BYTES: &[u8] = include_bytes!("../../build/icon.png");
const MAIN_WINDOW_LABEL: &str = "main";
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
const GLOBAL_HOTKEY_REGISTRATION_FAILED_EVENT: &str = "global-hotkey-registration-failed";
#[cfg(feature = "desktop-runtime")]
const SEARCH_WINDOW_STATE_EVENT: &str = "search-window-state";
#[cfg(feature = "desktop-runtime")]
const MAIN_WINDOW_READY_REQUEST_EVENT: &str = "search-main-ready-request";
const MAIN_WINDOW_READY_TIMEOUT: Duration = Duration::from_secs(3);

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SearchNavigatePayload {
    pub view: SearchView,
    pub file_id: Option<String>,
    pub nonce: u64,
    pub session_id: Option<u64>,
    pub revision: Option<u64>,
    pub settings_target: Option<SearchSettingsTarget>,
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

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum SearchSettingsTarget {
    SearchScope,
    GlobalIndex,
    Appearance,
    Ai,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GlobalHotkeyErrorPayload {
    pub message: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GlobalHotkeyStatus {
    pub requested_accelerator: String,
    pub effective_accelerator: Option<String>,
    pub registered: bool,
    pub error: Option<String>,
    pub revision: u64,
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

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SearchWindowPhase {
    Hidden,
    Showing,
    VisibleCollapsed,
    VisibleExpanded,
    Hiding,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SearchWindowSnapshot {
    pub session_id: u64,
    pub revision: u64,
    pub phase: SearchWindowPhase,
}

#[derive(Debug)]
pub struct SearchWindowLifecycleState {
    snapshot: Mutex<SearchWindowSnapshot>,
    // Every native window side effect must be performed while holding this
    // owner. A CAS check followed by a later native call is not sufficient:
    // an older resize could otherwise pass the check and mutate the window
    // after a newer lifecycle revision has committed.
    operation_owner: Mutex<()>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchWindowMutationRequest {
    pub session_id: u64,
    pub expected_revision: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchWindowResizeRequest {
    pub session_id: u64,
    pub expected_revision: u64,
    pub expanded: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivateSearchResultRequest {
    pub session_id: Option<u64>,
    pub expected_revision: Option<u64>,
    pub view: SearchView,
    pub file_id: Option<String>,
    pub settings_target: Option<SearchSettingsTarget>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MainWindowReadyRequest {
    pub nonce: u64,
    pub session_id: Option<u64>,
    pub revision: Option<u64>,
}

#[derive(Debug, Default)]
struct MainWindowReadiness {
    ready: bool,
    next_nonce: u64,
    acknowledged_nonce: u64,
}

#[derive(Debug, Default)]
pub struct MainWindowReadinessState {
    readiness: Mutex<MainWindowReadiness>,
    changed: Condvar,
}

impl SearchNavigatePayload {
    pub fn new(view: SearchView, file_id: Option<String>) -> Self {
        Self {
            view,
            file_id,
            nonce: 0,
            session_id: None,
            revision: None,
            settings_target: None,
        }
    }

    pub fn with_window_context(
        mut self,
        session_id: Option<u64>,
        revision: Option<u64>,
        settings_target: Option<SearchSettingsTarget>,
    ) -> Self {
        self.session_id = session_id;
        self.revision = revision;
        self.settings_target = settings_target;
        self
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

impl Default for SearchWindowLifecycleState {
    fn default() -> Self {
        Self {
            snapshot: Mutex::new(SearchWindowSnapshot {
                session_id: 0,
                revision: 1,
                phase: SearchWindowPhase::Hidden,
            }),
            operation_owner: Mutex::new(()),
        }
    }
}

impl SearchWindowLifecycleState {
    pub fn get(&self) -> SearchWindowSnapshot {
        self.snapshot
            .lock()
            .map(|snapshot| snapshot.clone())
            .unwrap_or(SearchWindowSnapshot {
                session_id: 0,
                revision: 1,
                phase: SearchWindowPhase::Hidden,
            })
    }

    #[cfg(test)]
    fn begin_show(&self) -> Result<SearchWindowSnapshot, String> {
        let _owner = self
            .operation_owner
            .lock()
            .map_err(|_| "search_window_operation_unavailable".to_string())?;
        self.begin_show_locked()
    }

    fn begin_show_locked(&self) -> Result<SearchWindowSnapshot, String> {
        let mut state = self
            .snapshot
            .lock()
            .map_err(|_| "search_window_state_unavailable".to_string())?;
        if state.phase != SearchWindowPhase::Hidden {
            return Err("search_window_already_visible".to_string());
        }
        state.session_id = state.session_id.saturating_add(1);
        state.revision = state.revision.saturating_add(1);
        state.phase = SearchWindowPhase::Showing;
        Ok(state.clone())
    }

    fn complete_show(
        &self,
        session_id: u64,
        expected_revision: u64,
    ) -> Result<SearchWindowSnapshot, String> {
        let _owner = self
            .operation_owner
            .lock()
            .map_err(|_| "search_window_operation_unavailable".to_string())?;
        self.transition_locked(
            session_id,
            expected_revision,
            &[SearchWindowPhase::Showing],
            SearchWindowPhase::VisibleCollapsed,
        )
    }

    #[cfg(test)]
    fn resize(&self, request: &SearchWindowResizeRequest) -> Result<SearchWindowSnapshot, String> {
        let _owner = self
            .operation_owner
            .lock()
            .map_err(|_| "search_window_operation_unavailable".to_string())?;
        self.resize_locked(request)
    }

    fn resize_locked(
        &self,
        request: &SearchWindowResizeRequest,
    ) -> Result<SearchWindowSnapshot, String> {
        self.transition_locked(
            request.session_id,
            request.expected_revision,
            &[
                SearchWindowPhase::VisibleCollapsed,
                SearchWindowPhase::VisibleExpanded,
            ],
            if request.expanded {
                SearchWindowPhase::VisibleExpanded
            } else {
                SearchWindowPhase::VisibleCollapsed
            },
        )
    }

    #[cfg(test)]
    fn begin_hide(
        &self,
        request: Option<&SearchWindowMutationRequest>,
    ) -> Result<SearchWindowSnapshot, String> {
        let _owner = self
            .operation_owner
            .lock()
            .map_err(|_| "search_window_operation_unavailable".to_string())?;
        self.begin_hide_locked(request)
    }

    fn begin_hide_locked(
        &self,
        request: Option<&SearchWindowMutationRequest>,
    ) -> Result<SearchWindowSnapshot, String> {
        let current = self.snapshot_locked()?;
        if current.phase == SearchWindowPhase::Hidden {
            return Ok(current);
        }
        if let Some(request) = request {
            validate_search_window_cas(&current, request.session_id, request.expected_revision)?;
        }
        if current.phase == SearchWindowPhase::Hiding {
            return Ok(current);
        }
        self.transition_locked(
            current.session_id,
            current.revision,
            &[
                SearchWindowPhase::Showing,
                SearchWindowPhase::VisibleCollapsed,
                SearchWindowPhase::VisibleExpanded,
            ],
            SearchWindowPhase::Hiding,
        )
    }

    #[cfg(test)]
    fn complete_hide(
        &self,
        session_id: u64,
        expected_revision: u64,
    ) -> Result<SearchWindowSnapshot, String> {
        let _owner = self
            .operation_owner
            .lock()
            .map_err(|_| "search_window_operation_unavailable".to_string())?;
        self.transition_locked(
            session_id,
            expected_revision,
            &[SearchWindowPhase::Hiding],
            SearchWindowPhase::Hidden,
        )
    }

    fn snapshot_locked(&self) -> Result<SearchWindowSnapshot, String> {
        self.snapshot
            .lock()
            .map(|snapshot| snapshot.clone())
            .map_err(|_| "search_window_state_unavailable".to_string())
    }

    fn transition_locked(
        &self,
        session_id: u64,
        expected_revision: u64,
        allowed: &[SearchWindowPhase],
        next: SearchWindowPhase,
    ) -> Result<SearchWindowSnapshot, String> {
        let mut state = self
            .snapshot
            .lock()
            .map_err(|_| "search_window_state_unavailable".to_string())?;
        validate_search_window_cas(&state, session_id, expected_revision)?;
        if !allowed.contains(&state.phase) {
            return Err("search_window_transition_invalid".to_string());
        }
        state.revision = state.revision.saturating_add(1);
        state.phase = next;
        Ok(state.clone())
    }

    /// Validates the CAS, performs the injected native resize while the
    /// operation owner is held, and commits the new revision only after the
    /// native call succeeds. Tests use the injected closure as the native
    /// adapter; production passes the real Tauri resize operation.
    fn resize_with_native<F>(
        &self,
        request: &SearchWindowResizeRequest,
        native: F,
    ) -> Result<SearchWindowSnapshot, String>
    where
        F: FnOnce() -> Result<(), String>,
    {
        let _owner = self
            .operation_owner
            .lock()
            .map_err(|_| "search_window_operation_unavailable".to_string())?;
        let current = self.snapshot_locked()?;
        validate_search_window_cas(&current, request.session_id, request.expected_revision)?;
        if !matches!(
            current.phase,
            SearchWindowPhase::VisibleCollapsed | SearchWindowPhase::VisibleExpanded
        ) {
            return Err("search_window_transition_invalid".to_string());
        }
        native()?;
        self.resize_locked(request)
    }

    /// Owns the entire show sequence. Native failure rolls the durable phase
    /// back to Hidden so a failed start is retryable and never leaves a stuck
    /// Showing phase behind.
    fn show_with_native<F, E>(&self, native: F, mut emit: E) -> Result<SearchWindowSnapshot, String>
    where
        F: FnOnce() -> Result<(), String>,
        E: FnMut(&SearchWindowSnapshot),
    {
        let _owner = self
            .operation_owner
            .lock()
            .map_err(|_| "search_window_operation_unavailable".to_string())?;
        let previous = self.snapshot_locked()?;
        let showing = self.begin_show_locked()?;
        if let Err(error) = native() {
            self.restore_snapshot_locked(&previous)?;
            return Err(error);
        }
        emit(&showing);
        Ok(showing)
    }

    /// Owns hide transition, native hide, and finalization. On a native
    /// failure the prior visible snapshot is restored and emitted, so a
    /// renderer can retry instead of being trapped in Hiding.
    fn hide_with_native<F, E>(
        &self,
        request: Option<&SearchWindowMutationRequest>,
        native: F,
        mut emit: E,
    ) -> Result<SearchWindowSnapshot, String>
    where
        F: FnOnce() -> Result<(), String>,
        E: FnMut(&SearchWindowSnapshot),
    {
        let _owner = self
            .operation_owner
            .lock()
            .map_err(|_| "search_window_operation_unavailable".to_string())?;
        let previous = self.snapshot_locked()?;
        let hiding = self.begin_hide_locked(request)?;
        if hiding.phase == SearchWindowPhase::Hidden {
            return Ok(hiding);
        }
        emit(&hiding);
        if let Err(error) = native() {
            self.restore_snapshot_locked(&previous)?;
            emit(&previous);
            return Err(error);
        }
        let hidden = self.transition_locked(
            hiding.session_id,
            hiding.revision,
            &[SearchWindowPhase::Hiding],
            SearchWindowPhase::Hidden,
        )?;
        emit(&hidden);
        Ok(hidden)
    }

    fn restore_snapshot_locked(&self, previous: &SearchWindowSnapshot) -> Result<(), String> {
        let mut state = self
            .snapshot
            .lock()
            .map_err(|_| "search_window_state_unavailable".to_string())?;
        *state = previous.clone();
        Ok(())
    }
}

fn validate_search_window_cas(
    current: &SearchWindowSnapshot,
    session_id: u64,
    expected_revision: u64,
) -> Result<(), String> {
    if current.session_id != session_id {
        return Err("search_window_session_stale".to_string());
    }
    if current.revision != expected_revision {
        return Err("search_window_revision_stale".to_string());
    }
    Ok(())
}

impl MainWindowReadinessState {
    fn set_ready(&self, ready: bool) {
        if let Ok(mut state) = self.readiness.lock() {
            state.ready = ready;
            self.changed.notify_all();
        }
    }

    fn begin_request(&self, timeout: Duration) -> Result<u64, String> {
        let deadline = Instant::now() + timeout;
        let mut state = self
            .readiness
            .lock()
            .map_err(|_| "main_window_readiness_unavailable".to_string())?;
        while !state.ready {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return Err("main_window_not_ready".to_string());
            }
            let (next, wait) = self
                .changed
                .wait_timeout(state, remaining)
                .map_err(|_| "main_window_readiness_unavailable".to_string())?;
            state = next;
            if wait.timed_out() && !state.ready {
                return Err("main_window_not_ready".to_string());
            }
        }
        state.next_nonce = state.next_nonce.saturating_add(1);
        Ok(state.next_nonce)
    }

    fn acknowledge(&self, nonce: u64) -> Result<(), String> {
        let mut state = self
            .readiness
            .lock()
            .map_err(|_| "main_window_readiness_unavailable".to_string())?;
        if nonce == 0 || nonce != state.next_nonce {
            return Err("main_window_ready_nonce_stale".to_string());
        }
        state.acknowledged_nonce = nonce;
        self.changed.notify_all();
        Ok(())
    }

    fn wait_for_ack(&self, nonce: u64, timeout: Duration) -> Result<(), String> {
        let deadline = Instant::now() + timeout;
        let mut state = self
            .readiness
            .lock()
            .map_err(|_| "main_window_readiness_unavailable".to_string())?;
        while state.acknowledged_nonce < nonce {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return Err("main_window_ready_ack_timeout".to_string());
            }
            let (next, wait) = self
                .changed
                .wait_timeout(state, remaining)
                .map_err(|_| "main_window_readiness_unavailable".to_string())?;
            state = next;
            if wait.timed_out() && state.acknowledged_nonce < nonce {
                return Err("main_window_ready_ack_timeout".to_string());
            }
        }
        Ok(())
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
    window: WebviewWindow<R>,
    app: AppHandle<R>,
    lifecycle: State<'_, SearchWindowLifecycleState>,
    readiness: State<'_, MainWindowReadinessState>,
    request: ActivateSearchResultRequest,
) -> Result<(), String> {
    if window.label() == SEARCH_WINDOW_LABEL {
        let (Some(session_id), Some(expected_revision)) =
            (request.session_id, request.expected_revision)
        else {
            return Err("search_window_session_required".to_string());
        };
        validate_search_window_cas(&lifecycle.get(), session_id, expected_revision)?;
    } else {
        require_main_window(&window)?;
    }
    let payload = SearchNavigatePayload::new(request.view, request.file_id).with_window_context(
        request.session_id,
        request.expected_revision,
        request.settings_target,
    );
    activate_search_result_payload(&app, &lifecycle, &readiness, payload)
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
        let previous = status_state.get();
        return GlobalHotkeyStatus {
            requested_accelerator: global_search_accelerator(&accelerator).to_string(),
            effective_accelerator: previous
                .as_ref()
                .and_then(|status| status.effective_accelerator.clone()),
            registered: previous.as_ref().is_some_and(|status| status.registered),
            error: Some("main_window_required".to_string()),
            revision: previous.map_or(1, |status| status.revision.saturating_add(1)),
        };
    }
    register_global_search_shortcut(&app, &status_state, &accelerator)
}

#[tauri::command]
pub fn get_search_window_state(
    lifecycle: State<'_, SearchWindowLifecycleState>,
) -> SearchWindowSnapshot {
    lifecycle.get()
}

#[tauri::command]
pub fn search_window_ready<R: Runtime>(
    window: WebviewWindow<R>,
    app: AppHandle<R>,
    lifecycle: State<'_, SearchWindowLifecycleState>,
    request: SearchWindowMutationRequest,
) -> Result<SearchWindowSnapshot, String> {
    require_search_window(&window)?;
    let snapshot = lifecycle.complete_show(request.session_id, request.expected_revision)?;
    emit_search_window_state(&app, &snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub fn resize_search_window<R: Runtime>(
    window: WebviewWindow<R>,
    app: AppHandle<R>,
    lifecycle: State<'_, SearchWindowLifecycleState>,
    request: SearchWindowResizeRequest,
) -> Result<SearchWindowSnapshot, String> {
    require_search_window(&window)?;
    let snapshot = lifecycle.resize_with_native(&request, || {
        resize_search_window_for_state(&app, request.expanded).map_err(|error| error.to_string())
    })?;
    emit_search_window_state(&app, &snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub fn hide_search_window_command<R: Runtime>(
    window: WebviewWindow<R>,
    app: AppHandle<R>,
    lifecycle: State<'_, SearchWindowLifecycleState>,
    request: SearchWindowMutationRequest,
) -> Result<SearchWindowSnapshot, String> {
    require_search_window(&window)?;
    hide_search_window_with_state(&app, &lifecycle, Some(&request))
}

#[tauri::command]
pub fn mark_main_window_ready<R: Runtime>(
    window: WebviewWindow<R>,
    readiness: State<'_, MainWindowReadinessState>,
    ready: bool,
) -> Result<(), String> {
    require_main_window(&window)?;
    readiness.set_ready(ready);
    Ok(())
}

#[tauri::command]
pub fn acknowledge_main_window_ready<R: Runtime>(
    window: WebviewWindow<R>,
    readiness: State<'_, MainWindowReadinessState>,
    nonce: u64,
) -> Result<(), String> {
    require_main_window(&window)?;
    readiness.acknowledge(nonce)
}

#[cfg(feature = "desktop-runtime")]
fn activate_search_result_payload<R: Runtime>(
    app: &AppHandle<R>,
    lifecycle: &SearchWindowLifecycleState,
    readiness: &MainWindowReadinessState,
    mut payload: SearchNavigatePayload,
) -> Result<(), String> {
    show_main_window(app).map_err(|error| error.to_string())?;
    let nonce = readiness.begin_request(MAIN_WINDOW_READY_TIMEOUT)?;
    payload.nonce = nonce;
    app.emit_to(
        MAIN_WINDOW_LABEL,
        MAIN_WINDOW_READY_REQUEST_EVENT,
        MainWindowReadyRequest {
            nonce,
            session_id: payload.session_id,
            revision: payload.revision,
        },
    )
    .map_err(|error| error.to_string())?;
    readiness.wait_for_ack(nonce, MAIN_WINDOW_READY_TIMEOUT)?;
    app.emit_to(MAIN_WINDOW_LABEL, SEARCH_NAVIGATE_EVENT, payload)
        .map_err(|error| error.to_string())?;
    hide_search_window_with_state(app, lifecycle, None)?;
    Ok(())
}

#[cfg(not(feature = "desktop-runtime"))]
fn activate_search_result_payload<R: Runtime>(
    _app: &AppHandle<R>,
    _lifecycle: &SearchWindowLifecycleState,
    _readiness: &MainWindowReadinessState,
    _payload: SearchNavigatePayload,
) -> Result<(), String> {
    Ok(())
}

#[cfg(feature = "desktop-runtime")]
pub fn setup_search_window(app: &mut App) -> tauri::Result<()> {
    if app.get_webview_window(SEARCH_WINDOW_LABEL).is_some() {
        return Ok(());
    }

    let search_window = WebviewWindowBuilder::new(
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
    let app_handle = app.handle().clone();
    search_window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let lifecycle = app_handle.state::<SearchWindowLifecycleState>();
            if let Err(error) = hide_search_window_with_state(&app_handle, &lifecycle, None) {
                eprintln!("Hide search window after close request failed: {error}");
            }
        }
    });
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
    let requested = global_search_accelerator(accelerator).to_string();
    let previous_status = status_state.get();
    if let Some(previous) = previous_status
        .as_ref()
        .filter(|status| hotkey_registration_is_idempotent(status, &requested))
    {
        return previous.clone();
    }
    let next_revision = previous_status
        .as_ref()
        .map_or(1, |status| status.revision.saturating_add(1));
    let shortcut = match global_search_shortcut(&requested) {
        Ok(shortcut) => shortcut,
        Err(error) => {
            let message =
                format!("Global search hotkey registration failed for {requested}: {error}");
            eprintln!("{message}");
            emit_global_hotkey_error(app, message.clone());
            let status = GlobalHotkeyStatus {
                requested_accelerator: requested,
                effective_accelerator: previous_status
                    .as_ref()
                    .and_then(|status| status.effective_accelerator.clone()),
                registered: previous_status
                    .as_ref()
                    .is_some_and(|status| status.registered),
                error: Some(message),
                revision: next_revision,
            };
            status_state.set(status.clone());
            return status;
        }
    };

    let previous_effective = previous_status.as_ref().and_then(|status| {
        status
            .registered
            .then(|| status.effective_accelerator.clone())
            .flatten()
    });
    if let Some(previous_accelerator) = previous_effective.as_deref() {
        let previous_shortcut = match global_search_shortcut(previous_accelerator) {
            Ok(shortcut) => shortcut,
            Err(error) => {
                let message = format!("Previous global search hotkey could not be parsed: {error}");
                let status = GlobalHotkeyStatus {
                    requested_accelerator: requested,
                    effective_accelerator: previous_effective,
                    registered: true,
                    error: Some(message.clone()),
                    revision: next_revision,
                };
                emit_global_hotkey_error(app, message);
                status_state.set(status.clone());
                return status;
            }
        };
        if let Err(error) = app.global_shortcut().unregister(previous_shortcut) {
            let message = format!("Global search hotkey reset failed: {error}");
            let status = GlobalHotkeyStatus {
                requested_accelerator: requested,
                effective_accelerator: previous_effective,
                registered: true,
                error: Some(message.clone()),
                revision: next_revision,
            };
            emit_global_hotkey_error(app, message);
            status_state.set(status.clone());
            return status;
        }
    }

    let status = match app.global_shortcut().register(shortcut) {
        Ok(()) => GlobalHotkeyStatus {
            requested_accelerator: requested,
            effective_accelerator: Some(global_search_accelerator(accelerator).to_string()),
            registered: true,
            error: None,
            revision: next_revision,
        },
        Err(error) => {
            let restore_error =
                restore_previous_global_hotkey(app, previous_effective.as_deref()).err();
            let rollback = hotkey_registration_failure_with_rollback(
                requested,
                error.to_string(),
                previous_effective,
                restore_error,
                next_revision,
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

fn hotkey_registration_is_idempotent(previous: &GlobalHotkeyStatus, requested: &str) -> bool {
    previous.registered
        && previous.error.is_none()
        && previous.effective_accelerator.as_deref() == Some(requested)
}

#[cfg(feature = "desktop-runtime")]
fn restore_previous_global_hotkey<R: Runtime>(
    app: &AppHandle<R>,
    previous_accelerator: Option<&str>,
) -> Result<(), String> {
    let Some(previous_accelerator) = previous_accelerator else {
        return Ok(());
    };
    let previous_shortcut = global_search_shortcut(previous_accelerator)?;
    app.global_shortcut()
        .register(previous_shortcut)
        .map_err(|error| error.to_string())
}

#[cfg(any(feature = "desktop-runtime", test))]
fn hotkey_registration_failure_with_rollback(
    requested_accelerator: String,
    registration_error: String,
    previous_effective: Option<String>,
    restore_error: Option<String>,
    revision: u64,
) -> HotkeyRollbackResult {
    let base_message = format!(
        "Global search hotkey registration failed for {requested_accelerator}: {registration_error}"
    );

    match (previous_effective, restore_error) {
        (Some(previous), None) => {
            let returned_status = GlobalHotkeyStatus {
                requested_accelerator,
                effective_accelerator: Some(previous.clone()),
                registered: true,
                error: Some(format!(
                    "{base_message}; restored previous hotkey {}",
                    previous
                )),
                revision,
            };
            HotkeyRollbackResult {
                returned_status: returned_status.clone(),
                state_status: returned_status,
            }
        }
        (Some(previous), Some(restore_error)) => {
            let returned_status = GlobalHotkeyStatus {
                requested_accelerator,
                effective_accelerator: None,
                registered: false,
                error: Some(format!(
                    "{base_message}; restore previous hotkey failed for {}: {restore_error}",
                    previous
                )),
                revision,
            };
            HotkeyRollbackResult {
                returned_status: returned_status.clone(),
                state_status: returned_status,
            }
        }
        _ => {
            let returned_status = GlobalHotkeyStatus {
                requested_accelerator,
                effective_accelerator: None,
                registered: false,
                error: Some(base_message),
                revision,
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
        requested_accelerator: global_search_accelerator(accelerator).to_string(),
        effective_accelerator: None,
        registered: false,
        error: Some("Global hotkeys require the desktop runtime.".to_string()),
        revision: status_state
            .get()
            .map_or(1, |status| status.revision.saturating_add(1)),
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
) -> Result<(), String> {
    let window = app
        .get_webview_window(SEARCH_WINDOW_LABEL)
        .ok_or_else(|| "search_window_missing".to_string())?;
    window
        .set_size(Size::Logical(LogicalSize {
            width: SEARCH_WINDOW_WIDTH,
            height: if expanded {
                SEARCH_WINDOW_EXPANDED_HEIGHT
            } else {
                SEARCH_WINDOW_COLLAPSED_HEIGHT
            },
        }))
        .map_err(|error| error.to_string())?;
    window.center().map_err(|error| error.to_string())?;
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
pub fn toggle_search_window<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let lifecycle = app.state::<SearchWindowLifecycleState>();
    match search_window_action(lifecycle.get().phase) {
        SearchWindowAction::ShowStandalone => show_search_window(app, &lifecycle)?,
        SearchWindowAction::HideStandalone => {
            hide_search_window_with_state(app, &lifecycle, None)?;
        }
    }
    Ok(())
}

#[cfg(any(feature = "desktop-runtime", test))]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SearchWindowAction {
    ShowStandalone,
    HideStandalone,
}

#[cfg(any(feature = "desktop-runtime", test))]
fn search_window_action(phase: SearchWindowPhase) -> SearchWindowAction {
    match phase {
        SearchWindowPhase::Hidden => SearchWindowAction::ShowStandalone,
        SearchWindowPhase::Showing
        | SearchWindowPhase::VisibleCollapsed
        | SearchWindowPhase::VisibleExpanded
        | SearchWindowPhase::Hiding => SearchWindowAction::HideStandalone,
    }
}

#[cfg(feature = "desktop-runtime")]
fn show_search_window<R: Runtime>(
    app: &AppHandle<R>,
    lifecycle: &SearchWindowLifecycleState,
) -> Result<(), String> {
    lifecycle
        .show_with_native(
            || {
                let window = app
                    .get_webview_window(SEARCH_WINDOW_LABEL)
                    .ok_or_else(|| "search_window_missing".to_string())?;
                resize_search_window_for_state(app, false).map_err(|error| error.to_string())?;
                window.show().map_err(|error| error.to_string())?;
                window.set_focus().map_err(|error| error.to_string())?;
                Ok(())
            },
            |snapshot| emit_search_window_state(app, snapshot),
        )
        .map(|_| ())
}

#[cfg(feature = "desktop-runtime")]
fn hide_search_window_with_state<R: Runtime>(
    app: &AppHandle<R>,
    lifecycle: &SearchWindowLifecycleState,
    request: Option<&SearchWindowMutationRequest>,
) -> Result<SearchWindowSnapshot, String> {
    lifecycle.hide_with_native(
        request,
        || {
            let window = app
                .get_webview_window(SEARCH_WINDOW_LABEL)
                .ok_or_else(|| "search_window_missing".to_string())?;
            window.hide().map_err(|error| error.to_string())
        },
        |snapshot| emit_search_window_state(app, snapshot),
    )
}

#[cfg(not(feature = "desktop-runtime"))]
fn hide_search_window_with_state<R: Runtime>(
    app: &AppHandle<R>,
    lifecycle: &SearchWindowLifecycleState,
    request: Option<&SearchWindowMutationRequest>,
) -> Result<SearchWindowSnapshot, String> {
    lifecycle.hide_with_native(
        request,
        || Ok(()),
        |snapshot| emit_search_window_state(app, snapshot),
    )
}

#[cfg(feature = "desktop-runtime")]
fn emit_search_window_state<R: Runtime>(app: &AppHandle<R>, snapshot: &SearchWindowSnapshot) {
    let _ = app.emit_to(
        SEARCH_WINDOW_LABEL,
        SEARCH_WINDOW_STATE_EVENT,
        snapshot.clone(),
    );
}

#[cfg(not(feature = "desktop-runtime"))]
fn emit_search_window_state<R: Runtime>(_app: &AppHandle<R>, _snapshot: &SearchWindowSnapshot) {}

fn require_search_window<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), String> {
    if window.label() == SEARCH_WINDOW_LABEL {
        Ok(())
    } else {
        Err("search_window_required".to_string())
    }
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
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        mpsc, Arc,
    };

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
    fn search_window_action_is_owned_by_the_durable_phase() {
        assert_eq!(
            search_window_action(SearchWindowPhase::Hidden),
            SearchWindowAction::ShowStandalone
        );
        assert_eq!(
            search_window_action(SearchWindowPhase::Showing),
            SearchWindowAction::HideStandalone
        );
        assert_eq!(
            search_window_action(SearchWindowPhase::VisibleCollapsed),
            SearchWindowAction::HideStandalone
        );
    }

    #[test]
    fn search_window_rejects_old_session_and_revision_mutations() {
        let lifecycle = SearchWindowLifecycleState::default();
        let showing = lifecycle.begin_show().expect("begin show");
        assert_eq!(showing.phase, SearchWindowPhase::Showing);
        assert_eq!(
            lifecycle
                .complete_show(showing.session_id.saturating_sub(1), showing.revision)
                .expect_err("old session rejected"),
            "search_window_session_stale"
        );
        let visible = lifecycle
            .complete_show(showing.session_id, showing.revision)
            .expect("complete show");
        let stale_resize = SearchWindowResizeRequest {
            session_id: visible.session_id,
            expected_revision: visible.revision.saturating_sub(1),
            expanded: true,
        };
        assert_eq!(
            lifecycle
                .resize(&stale_resize)
                .expect_err("old revision rejected"),
            "search_window_revision_stale"
        );
    }

    #[test]
    fn search_window_lifecycle_hides_and_reopens_with_a_new_session() {
        let lifecycle = SearchWindowLifecycleState::default();
        let showing = lifecycle.begin_show().expect("begin show");
        let visible = lifecycle
            .complete_show(showing.session_id, showing.revision)
            .expect("complete show");
        let expanded = lifecycle
            .resize(&SearchWindowResizeRequest {
                session_id: visible.session_id,
                expected_revision: visible.revision,
                expanded: true,
            })
            .expect("expand");
        let hiding = lifecycle.begin_hide(None).expect("begin hide");
        assert_eq!(hiding.phase, SearchWindowPhase::Hiding);
        assert_eq!(
            lifecycle.begin_hide(None).expect("retry begin hide"),
            hiding
        );
        let hidden = lifecycle
            .complete_hide(hiding.session_id, hiding.revision)
            .expect("complete hide");
        assert_eq!(hidden.phase, SearchWindowPhase::Hidden);
        assert!(hidden.revision > expanded.revision);

        let reopened = lifecycle.begin_show().expect("reopen");
        assert!(reopened.session_id > hidden.session_id);
        assert_eq!(reopened.phase, SearchWindowPhase::Showing);
    }

    #[test]
    fn stale_resize_is_rejected_before_the_native_adapter_runs() {
        let lifecycle = SearchWindowLifecycleState::default();
        let showing = lifecycle.begin_show().expect("begin show");
        let visible = lifecycle
            .complete_show(showing.session_id, showing.revision)
            .expect("complete show");
        let calls = AtomicUsize::new(0);
        let stale = SearchWindowResizeRequest {
            session_id: visible.session_id,
            expected_revision: visible.revision.saturating_sub(1),
            expanded: true,
        };

        assert_eq!(
            lifecycle
                .resize_with_native(&stale, || {
                    calls.fetch_add(1, Ordering::SeqCst);
                    Ok(())
                })
                .expect_err("stale resize"),
            "search_window_revision_stale"
        );
        assert_eq!(calls.load(Ordering::SeqCst), 0);
    }

    #[test]
    fn lifecycle_owner_serializes_native_resize_and_rejects_old_race() {
        let lifecycle = Arc::new(SearchWindowLifecycleState::default());
        let showing = lifecycle.begin_show().expect("begin show");
        let visible = lifecycle
            .complete_show(showing.session_id, showing.revision)
            .expect("complete show");
        let old_request = SearchWindowResizeRequest {
            session_id: visible.session_id,
            expected_revision: visible.revision,
            expanded: true,
        };
        let new_request = old_request.clone();
        let native_calls = Arc::new(AtomicUsize::new(0));
        let (entered_tx, entered_rx) = mpsc::channel();
        let (release_tx, release_rx) = mpsc::channel();
        let new_lifecycle = Arc::clone(&lifecycle);
        let new_calls = Arc::clone(&native_calls);
        let newer = std::thread::spawn(move || {
            new_lifecycle.resize_with_native(&new_request, || {
                new_calls.fetch_add(1, Ordering::SeqCst);
                entered_tx.send(()).expect("notify native entry");
                release_rx.recv().expect("release native adapter");
                Ok(())
            })
        });
        entered_rx
            .recv_timeout(Duration::from_secs(1))
            .expect("new request owns native adapter");

        let old_lifecycle = Arc::clone(&lifecycle);
        let old_calls = Arc::clone(&native_calls);
        let older = std::thread::spawn(move || {
            old_lifecycle.resize_with_native(&old_request, || {
                old_calls.fetch_add(1, Ordering::SeqCst);
                Ok(())
            })
        });
        release_tx.send(()).expect("release new native adapter");

        newer
            .join()
            .expect("newer request thread")
            .expect("newer resize succeeds");
        assert_eq!(
            older.join().expect("older request thread"),
            Err("search_window_revision_stale".to_string())
        );
        assert_eq!(native_calls.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn native_failure_restores_retryable_phase_without_stuck_transition() {
        let lifecycle = SearchWindowLifecycleState::default();
        let events = Arc::new(Mutex::new(Vec::new()));
        let first_events = Arc::clone(&events);
        assert_eq!(
            lifecycle
                .show_with_native(
                    || Err("native_show_failed".to_string()),
                    |snapshot| first_events.lock().unwrap().push(snapshot.phase),
                )
                .expect_err("show failure"),
            "native_show_failed"
        );
        assert_eq!(lifecycle.get().phase, SearchWindowPhase::Hidden);

        let showing = lifecycle
            .show_with_native(|| Ok(()), |_| {})
            .expect("retry show");
        let visible = lifecycle
            .complete_show(showing.session_id, showing.revision)
            .expect("complete retry show");
        let second_events = Arc::clone(&events);
        assert_eq!(
            lifecycle
                .hide_with_native(
                    None,
                    || Err("native_hide_failed".to_string()),
                    |snapshot| second_events.lock().unwrap().push(snapshot.phase),
                )
                .expect_err("hide failure"),
            "native_hide_failed"
        );
        assert_eq!(lifecycle.get(), visible);
        assert_eq!(
            events.lock().unwrap().as_slice(),
            &[
                SearchWindowPhase::Hiding,
                SearchWindowPhase::VisibleCollapsed
            ]
        );
    }

    #[test]
    fn main_window_readiness_rejects_stale_nonce_and_accepts_current_ack() {
        let readiness = MainWindowReadinessState::default();
        readiness.set_ready(true);
        let nonce = readiness
            .begin_request(Duration::from_millis(5))
            .expect("ready request");
        assert_eq!(
            readiness.acknowledge(nonce.saturating_add(1)),
            Err("main_window_ready_nonce_stale".to_string())
        );
        readiness.acknowledge(nonce).expect("ack current nonce");
        readiness
            .wait_for_ack(nonce, Duration::from_millis(5))
            .expect("observe ack");
    }

    #[test]
    fn main_window_readiness_fails_closed_when_renderer_is_not_ready() {
        let readiness = MainWindowReadinessState::default();
        assert_eq!(
            readiness.begin_request(Duration::from_millis(1)),
            Err("main_window_not_ready".to_string())
        );
    }

    #[test]
    fn search_navigation_payload_serializes_camel_case_file_id() {
        let payload = SearchNavigatePayload::new(SearchView::Settings, None).with_window_context(
            Some(7),
            Some(12),
            Some(SearchSettingsTarget::GlobalIndex),
        );
        let value = serde_json::to_value(payload).expect("serialize search navigation payload");

        assert_eq!(value["view"], "settings");
        assert_eq!(value["fileId"], serde_json::Value::Null);
        assert_eq!(value["nonce"], 0);
        assert_eq!(value["sessionId"], 7);
        assert_eq!(value["revision"], 12);
        assert_eq!(value["settingsTarget"], "global-index");
        assert!(
            serde_json::from_value::<SearchSettingsTarget>(serde_json::json!("arbitrary")).is_err()
        );
    }

    #[test]
    fn main_window_ready_request_carries_search_context_for_renderer_parity() {
        let value = serde_json::to_value(MainWindowReadyRequest {
            nonce: 21,
            session_id: Some(7),
            revision: Some(12),
        })
        .expect("serialize main window ready request");

        assert_eq!(value["nonce"], 21);
        assert_eq!(value["sessionId"], 7);
        assert_eq!(value["revision"], 12);
    }

    #[test]
    fn hotkey_registration_failure_restores_previous_status_when_fallback_succeeds() {
        let rollback = hotkey_registration_failure_with_rollback(
            "Alt+Space".to_string(),
            "shortcut already registered".to_string(),
            Some("CmdOrCtrl+K".to_string()),
            None,
            2,
        );

        assert!(rollback.returned_status.registered);
        assert_eq!(rollback.returned_status.requested_accelerator, "Alt+Space");
        assert_eq!(
            rollback.returned_status.effective_accelerator.as_deref(),
            Some("CmdOrCtrl+K")
        );
        assert!(rollback
            .returned_status
            .error
            .as_deref()
            .unwrap_or_default()
            .contains("restored previous hotkey CmdOrCtrl+K"));
        assert_eq!(rollback.state_status, rollback.returned_status);
    }

    #[test]
    fn hotkey_registration_failure_keeps_failure_status_when_fallback_fails() {
        let rollback = hotkey_registration_failure_with_rollback(
            "Alt+Space".to_string(),
            "shortcut already registered".to_string(),
            Some("CmdOrCtrl+K".to_string()),
            Some("restore failed".to_string()),
            2,
        );

        assert!(!rollback.returned_status.registered);
        assert_eq!(rollback.returned_status.requested_accelerator, "Alt+Space");
        assert_eq!(rollback.returned_status.effective_accelerator, None);
        assert!(rollback
            .returned_status
            .error
            .as_deref()
            .unwrap_or_default()
            .contains("restore previous hotkey failed"));
        assert_eq!(rollback.state_status, rollback.returned_status);
    }

    #[test]
    fn hotkey_same_effective_value_is_idempotent_only_for_a_healthy_registration() {
        let healthy = GlobalHotkeyStatus {
            requested_accelerator: "CmdOrCtrl+K".to_string(),
            effective_accelerator: Some("CmdOrCtrl+K".to_string()),
            registered: true,
            error: None,
            revision: 4,
        };
        assert!(hotkey_registration_is_idempotent(&healthy, "CmdOrCtrl+K"));
        assert!(!hotkey_registration_is_idempotent(&healthy, "Alt+Space"));

        let failed = GlobalHotkeyStatus {
            error: Some("registration failed".to_string()),
            ..healthy
        };
        assert!(!hotkey_registration_is_idempotent(&failed, "CmdOrCtrl+K"));
    }
}
