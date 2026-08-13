use super::*;

#[tauri::command]
pub fn get_content_scope_policy<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    root_id: String,
) -> Result<ContentScopePolicyDto, String> {
    require_main_window(&window)?;
    db.get_content_scope_policy(&root_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_content_catalog_revision<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
) -> Result<i64, String> {
    require_main_window(&window)?;
    db.get_content_catalog_revision()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_content_scope_policy<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: SetContentScopePolicyRequest,
) -> Result<ContentScopePolicyDto, String> {
    require_main_window(&window)?;
    db.set_content_scope_policy(request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn preview_content<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: ContentPreviewRequest,
) -> Result<ContentPreviewDto, String> {
    require_main_window(&window)?;
    db.preview_content(request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn start_content_run<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: StartContentRunRequest,
) -> Result<ContentRunDto, String> {
    require_main_window(&window)?;
    db.start_content_run(request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_content_run<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    run_id: String,
) -> Result<ContentRunDto, String> {
    require_main_window(&window)?;
    db.get_content_run(&run_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_content_runs<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: ContentRunPageRequest,
) -> Result<Vec<ContentRunDto>, String> {
    require_main_window(&window)?;
    db.list_content_runs(request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_active_content_run_for_file<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    file_id: String,
) -> Result<Option<ActiveContentRunForFileDto>, String> {
    require_main_window(&window)?;
    db.get_active_content_run_for_file(&file_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn cancel_content_run<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: ContentRunIdRequest,
) -> Result<ContentRunDto, String> {
    require_main_window(&window)?;
    db.cancel_content_run(request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn query_content_run_items<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: ContentRunItemPageRequest,
) -> Result<ContentRunItemPageDto, String> {
    require_main_window(&window)?;
    db.query_content_run_items(request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_content_artifact<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    file_id: String,
) -> Result<Option<ContentArtifactDto>, String> {
    require_main_window(&window)?;
    db.get_content_artifact(&file_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn query_content_artifacts<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: ContentArtifactPageRequest,
) -> Result<ContentArtifactPageDto, String> {
    require_main_window(&window)?;
    db.query_content_artifacts(request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn rebuild_content_artifact<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: ContentArtifactMutationRequest,
) -> Result<ContentArtifactDto, String> {
    require_main_window(&window)?;
    db.rebuild_content_artifact(request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_content_artifact<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: ContentArtifactMutationRequest,
) -> Result<bool, String> {
    require_main_window(&window)?;
    db.delete_content_artifact(request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn purge_content_scope<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: PurgeContentScopeRequest,
) -> Result<i64, String> {
    require_main_window(&window)?;
    db.purge_content_scope(request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn understand_content_artifacts<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: UnderstandContentArtifactsRequest,
) -> Result<ContentUnderstandingResultDto, String> {
    require_main_window(&window)?;
    db.understand_content_artifacts(request)
        .map_err(|error| error.to_string())
}
