use super::{
    runtime::FileWorkspaceRuntime,
    types::{
        encode_thumbnail_ipc_response, BrowseCancelRequest, BrowseNextPageRequest,
        BrowseOpenRequest, BrowseReleasePageRequest, BrowseReleasePathRequest,
        BrowseRestoreRequest, BrowseSessionRequest, BrowseStartEnumerationRequest,
        ChangePendingRequest, ChangeRefreshRequest, ChangeStartRequest, PreviewCreateRequest,
        PreviewSessionRequest, PreviewSwitchSourceRequest, ReadEligibilityRequest,
        ThumbnailCancelRequest, ThumbnailRequestDto,
    },
};
use crate::window_auth::require_main_window;
use tauri::{Runtime, State, WebviewWindow};

/// Every blocking integration operation crosses this boundary. The async
/// command remains available to sibling cancellation commands while the
/// filesystem, database, watcher join, or shared service wait is in flight.
async fn spawn_runtime<T, F>(
    runtime: FileWorkspaceRuntime,
    operation: &'static str,
    work: F,
) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce(&FileWorkspaceRuntime) -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(move || work(&runtime))
        .await
        .map_err(|error| format!("{operation}_task_failed:{error}"))?
}

#[tauri::command]
pub async fn file_workspace_browse_open<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: BrowseOpenRequest,
) -> Result<super::types::BrowseOpenResponse, String> {
    require_main_window(&window)?;
    spawn_runtime(
        runtime.inner().clone(),
        "workspace_browse_open",
        move |runtime| runtime.open_browse(request),
    )
    .await
}

#[tauri::command]
pub async fn file_workspace_browse_restore<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: BrowseRestoreRequest,
) -> Result<super::types::BrowseOpenResponse, String> {
    require_main_window(&window)?;
    spawn_runtime(
        runtime.inner().clone(),
        "workspace_browse_restore",
        move |runtime| runtime.restore_browse(request),
    )
    .await
}

#[tauri::command]
pub async fn file_workspace_browse_start_enumeration<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: BrowseStartEnumerationRequest,
) -> Result<super::types::BrowsePageDto, String> {
    require_main_window(&window)?;
    spawn_runtime(
        runtime.inner().clone(),
        "workspace_browse_start_enumeration",
        move |runtime| runtime.start_enumeration(request),
    )
    .await
}

#[tauri::command]
pub async fn file_workspace_browse_next_page<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: BrowseNextPageRequest,
) -> Result<super::types::BrowsePageDto, String> {
    require_main_window(&window)?;
    spawn_runtime(
        runtime.inner().clone(),
        "workspace_browse_next_page",
        move |runtime| runtime.next_page(request),
    )
    .await
}

/// This operation only flips BrowseService's cancellation token and therefore
/// stays on the async command lane. It can run while a sibling spawn_blocking
/// page request is still reading/enumerating.
#[tauri::command]
pub async fn file_workspace_browse_cancel_enumeration<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: BrowseCancelRequest,
) -> Result<(), String> {
    require_main_window(&window)?;
    runtime.cancel_enumeration(request)
}

#[tauri::command]
pub async fn file_workspace_browse_release_page<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: BrowseReleasePageRequest,
) -> Result<(), String> {
    require_main_window(&window)?;
    spawn_runtime(
        runtime.inner().clone(),
        "workspace_browse_release_page",
        move |runtime| runtime.release_page(request),
    )
    .await
}

#[tauri::command]
pub async fn file_workspace_browse_release_path<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: BrowseReleasePathRequest,
) -> Result<(), String> {
    require_main_window(&window)?;
    spawn_runtime(
        runtime.inner().clone(),
        "workspace_browse_release_path",
        move |runtime| runtime.release_path(request),
    )
    .await
}

#[tauri::command]
pub async fn file_workspace_browse_dispose<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: BrowseSessionRequest,
) -> Result<(), String> {
    require_main_window(&window)?;
    spawn_runtime(
        runtime.inner().clone(),
        "workspace_browse_dispose",
        move |runtime| runtime.dispose_browse(request),
    )
    .await
}

#[tauri::command]
pub async fn file_workspace_location_list<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
) -> Result<Vec<crate::file_workspace::LocationDescriptor>, String> {
    require_main_window(&window)?;
    spawn_runtime(
        runtime.inner().clone(),
        "workspace_location_list",
        |runtime| runtime.list_locations(),
    )
    .await
}

#[tauri::command]
pub async fn file_workspace_change_start<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: ChangeStartRequest,
) -> Result<super::types::ChangeStartResponse, String> {
    require_main_window(&window)?;
    spawn_runtime(
        runtime.inner().clone(),
        "workspace_change_start",
        move |runtime| runtime.start_change_monitor(request),
    )
    .await
}

#[tauri::command]
pub async fn file_workspace_change_pending<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: ChangePendingRequest,
) -> Result<Option<super::types::ChangePendingResponse>, String> {
    require_main_window(&window)?;
    runtime.pending_change(request)
}

#[tauri::command]
pub async fn file_workspace_change_refresh<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: ChangeRefreshRequest,
) -> Result<super::types::BrowsePageDto, String> {
    require_main_window(&window)?;
    spawn_runtime(
        runtime.inner().clone(),
        "workspace_change_refresh",
        move |runtime| runtime.refresh_change(request),
    )
    .await
}

#[tauri::command]
pub async fn file_workspace_change_dispose<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: ChangePendingRequest,
) -> Result<(), String> {
    require_main_window(&window)?;
    spawn_runtime(
        runtime.inner().clone(),
        "workspace_change_dispose",
        move |runtime| runtime.dispose_change_monitor(request),
    )
    .await
}

#[tauri::command]
pub async fn file_workspace_read_eligibility<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: ReadEligibilityRequest,
) -> Result<super::types::ReadEligibilityResponse, String> {
    require_main_window(&window)?;
    spawn_runtime(
        runtime.inner().clone(),
        "workspace_read_eligibility",
        move |runtime| runtime.read_eligibility(request),
    )
    .await
}

#[tauri::command]
pub async fn file_workspace_thumbnail_request<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: ThumbnailRequestDto,
) -> Result<tauri::ipc::Response, String> {
    require_main_window(&window)?;
    let payload = spawn_runtime(
        runtime.inner().clone(),
        "workspace_thumbnail_request",
        move |runtime| {
            let artifact = runtime.request_thumbnail(request)?;
            encode_thumbnail_ipc_response(&artifact)
        },
    )
    .await?;
    Ok(tauri::ipc::Response::new(payload))
}

/// Cancellation is deliberately a short, direct async command so it can run
/// while the sibling thumbnail request is waiting in spawn_blocking.
#[tauri::command]
pub async fn file_workspace_thumbnail_cancel<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: ThumbnailCancelRequest,
) -> Result<bool, String> {
    require_main_window(&window)?;
    runtime.cancel_thumbnail(request)
}

#[tauri::command]
pub async fn file_workspace_preview_create<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: PreviewCreateRequest,
) -> Result<super::types::PreviewSnapshotDto, String> {
    require_main_window(&window)?;
    spawn_runtime(
        runtime.inner().clone(),
        "workspace_preview_create",
        move |runtime| runtime.create_preview(request),
    )
    .await
}

#[tauri::command]
pub async fn file_workspace_preview_snapshot<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: PreviewSessionRequest,
) -> Result<super::types::PreviewSnapshotDto, String> {
    require_main_window(&window)?;
    runtime.snapshot_preview(request)
}

#[tauri::command]
pub async fn file_workspace_preview_start<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: PreviewSessionRequest,
) -> Result<super::types::PreviewSnapshotDto, String> {
    require_main_window(&window)?;
    spawn_runtime(
        runtime.inner().clone(),
        "workspace_preview_start",
        move |runtime| runtime.start_preview(request),
    )
    .await
}

#[tauri::command]
pub async fn file_workspace_preview_cancel<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: PreviewSessionRequest,
) -> Result<bool, String> {
    require_main_window(&window)?;
    runtime.cancel_preview(request)
}

#[tauri::command]
pub async fn file_workspace_preview_dispose<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: PreviewSessionRequest,
) -> Result<bool, String> {
    require_main_window(&window)?;
    runtime.dispose_preview(request)
}

#[tauri::command]
pub async fn file_workspace_preview_switch_source<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: PreviewSwitchSourceRequest,
) -> Result<super::types::PreviewSnapshotDto, String> {
    require_main_window(&window)?;
    spawn_runtime(
        runtime.inner().clone(),
        "workspace_preview_switch_source",
        move |runtime| runtime.switch_preview_source(request),
    )
    .await
}
