use super::{
    runtime::FileWorkspaceRuntime,
    types::{
        BrowseCancelRequest, BrowseNextPageRequest, BrowseOpenRequest, BrowseReleasePageRequest,
        BrowseReleasePathRequest, BrowseRestoreRequest, BrowseSessionRequest,
        BrowseStartEnumerationRequest, ChangePendingRequest, ChangeRefreshRequest,
        ChangeStartRequest, PreviewCreateRequest, PreviewSessionRequest,
        PreviewSwitchSourceRequest, ReadEligibilityRequest, ThumbnailCancelRequest,
        ThumbnailRequestDto,
    },
};
use crate::window_auth::require_main_window;
use tauri::{Runtime, State, WebviewWindow};

#[tauri::command]
pub fn file_workspace_browse_open<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: BrowseOpenRequest,
) -> Result<super::types::BrowseOpenResponse, String> {
    require_main_window(&window)?;
    runtime.open_browse(request)
}

#[tauri::command]
pub fn file_workspace_browse_restore<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: BrowseRestoreRequest,
) -> Result<super::types::BrowseOpenResponse, String> {
    require_main_window(&window)?;
    runtime.restore_browse(request)
}

#[tauri::command]
pub fn file_workspace_browse_start_enumeration<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: BrowseStartEnumerationRequest,
) -> Result<super::types::BrowsePageDto, String> {
    require_main_window(&window)?;
    runtime.start_enumeration(request)
}

#[tauri::command]
pub fn file_workspace_browse_next_page<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: BrowseNextPageRequest,
) -> Result<super::types::BrowsePageDto, String> {
    require_main_window(&window)?;
    runtime.next_page(request)
}

#[tauri::command]
pub fn file_workspace_browse_cancel_enumeration<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: BrowseCancelRequest,
) -> Result<(), String> {
    require_main_window(&window)?;
    runtime.cancel_enumeration(request)
}

#[tauri::command]
pub fn file_workspace_browse_release_page<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: BrowseReleasePageRequest,
) -> Result<(), String> {
    require_main_window(&window)?;
    runtime.release_page(request)
}

#[tauri::command]
pub fn file_workspace_browse_release_path<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: BrowseReleasePathRequest,
) -> Result<(), String> {
    require_main_window(&window)?;
    runtime.release_path(request)
}

#[tauri::command]
pub fn file_workspace_browse_dispose<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: BrowseSessionRequest,
) -> Result<(), String> {
    require_main_window(&window)?;
    runtime.dispose_browse(request)
}

#[tauri::command]
pub fn file_workspace_location_list<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
) -> Result<Vec<crate::file_workspace::LocationDescriptor>, String> {
    require_main_window(&window)?;
    runtime.list_locations()
}

#[tauri::command]
pub fn file_workspace_change_start<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: ChangeStartRequest,
) -> Result<super::types::ChangeStartResponse, String> {
    require_main_window(&window)?;
    runtime.start_change_monitor(request)
}

#[tauri::command]
pub fn file_workspace_change_pending<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: ChangePendingRequest,
) -> Result<Option<super::types::ChangePendingResponse>, String> {
    require_main_window(&window)?;
    runtime.pending_change(request)
}

#[tauri::command]
pub fn file_workspace_change_refresh<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: ChangeRefreshRequest,
) -> Result<super::types::BrowsePageDto, String> {
    require_main_window(&window)?;
    runtime.refresh_change(request)
}

#[tauri::command]
pub fn file_workspace_change_dispose<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: ChangePendingRequest,
) -> Result<(), String> {
    require_main_window(&window)?;
    runtime.dispose_change_monitor(request)
}

#[tauri::command]
pub fn file_workspace_read_eligibility<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: ReadEligibilityRequest,
) -> Result<super::types::ReadEligibilityResponse, String> {
    require_main_window(&window)?;
    runtime.read_eligibility(request)
}

#[tauri::command]
pub fn file_workspace_thumbnail_request<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: ThumbnailRequestDto,
) -> Result<super::types::ThumbnailArtifactDto, String> {
    require_main_window(&window)?;
    runtime.request_thumbnail(request)
}

#[tauri::command]
pub fn file_workspace_thumbnail_cancel<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: ThumbnailCancelRequest,
) -> Result<bool, String> {
    require_main_window(&window)?;
    runtime.cancel_thumbnail(request)
}

#[tauri::command]
pub fn file_workspace_preview_create<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: PreviewCreateRequest,
) -> Result<super::types::PreviewSnapshotDto, String> {
    require_main_window(&window)?;
    runtime.create_preview(request)
}

#[tauri::command]
pub fn file_workspace_preview_snapshot<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: PreviewSessionRequest,
) -> Result<super::types::PreviewSnapshotDto, String> {
    require_main_window(&window)?;
    runtime.snapshot_preview(request)
}

#[tauri::command]
pub fn file_workspace_preview_start<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: PreviewSessionRequest,
) -> Result<super::types::PreviewSnapshotDto, String> {
    require_main_window(&window)?;
    runtime.start_preview(request)
}

#[tauri::command]
pub fn file_workspace_preview_cancel<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: PreviewSessionRequest,
) -> Result<bool, String> {
    require_main_window(&window)?;
    runtime.cancel_preview(request)
}

#[tauri::command]
pub fn file_workspace_preview_dispose<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: PreviewSessionRequest,
) -> Result<bool, String> {
    require_main_window(&window)?;
    runtime.dispose_preview(request)
}

#[tauri::command]
pub fn file_workspace_preview_switch_source<R: Runtime>(
    window: WebviewWindow<R>,
    runtime: State<'_, FileWorkspaceRuntime>,
    request: PreviewSwitchSourceRequest,
) -> Result<super::types::PreviewSnapshotDto, String> {
    require_main_window(&window)?;
    runtime.switch_preview_source(request)
}
