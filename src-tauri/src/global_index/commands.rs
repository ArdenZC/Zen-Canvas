use super::coordinator::GlobalIndexCoordinator;
use super::hardened_worker::{reconcile_managed_scope_policy, with_managed_policy_write_lock};
use super::models::*;
use super::search::search_global_entries as search_global_entries_impl;
use crate::db::Database;
use crate::window_auth::require_main_window;
use std::process::Command;
use tauri::{Runtime, State, WebviewWindow};

#[tauri::command]
pub fn search_global_entries(
    db: State<'_, Database>,
    query: String,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<Vec<GlobalSearchResult>, String> {
    search_global_entries_impl(db.inner(), &query, limit.unwrap_or(80), offset.unwrap_or(0))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_global_index_status(
    coordinator: State<'_, GlobalIndexCoordinator>,
) -> Result<GlobalIndexStatus, String> {
    let mut status = coordinator.status().map_err(|error| error.to_string())?;
    status.provider_status = coordinator.provider_status().ok();
    // `collection_complete` is a coverage guarantee, not merely an indication
    // that the initial worker loop returned. Permission, Spotlight, FSEvents,
    // source availability, and partial-volume states must remain visibly
    // degraded until every enabled source is ready.
    status.collection_complete &= status.status == INDEX_STATUS_READY;
    Ok(status)
}

#[tauri::command]
pub fn list_global_index_sources(
    db: State<'_, Database>,
) -> Result<Vec<GlobalIndexSource>, String> {
    db.list_global_volumes()
        .map(|volumes| {
            volumes
                .into_iter()
                .map(|volume| GlobalIndexSource {
                    can_pause: volume.index_status == INDEX_STATUS_INDEXING
                        || volume.index_status == INDEX_STATUS_SYNCING,
                    can_rebuild: true,
                    technical_detail: Some(GlobalIndexTechnicalDetail {
                        journal_id: volume.journal_id.clone(),
                        journal_cursor: volume.journal_cursor.clone(),
                        provider: volume.provider.clone(),
                        filesystem_type: volume.filesystem_type.clone(),
                    }),
                    volume,
                })
                .collect()
        })
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn start_global_index<R: Runtime>(
    window: WebviewWindow<R>,
    coordinator: State<'_, GlobalIndexCoordinator>,
) -> Result<(), String> {
    require_main_window(&window)?;
    coordinator.start().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn pause_global_index<R: Runtime>(
    window: WebviewWindow<R>,
    coordinator: State<'_, GlobalIndexCoordinator>,
) -> Result<(), String> {
    require_main_window(&window)?;
    coordinator.pause().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn resume_global_index<R: Runtime>(
    window: WebviewWindow<R>,
    coordinator: State<'_, GlobalIndexCoordinator>,
) -> Result<(), String> {
    require_main_window(&window)?;
    coordinator.resume().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn rebuild_global_index_source<R: Runtime>(
    window: WebviewWindow<R>,
    coordinator: State<'_, GlobalIndexCoordinator>,
    source_id: Option<String>,
) -> Result<(), String> {
    require_main_window(&window)?;
    coordinator
        .rebuild(source_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_global_index_source_enabled<R: Runtime>(
    window: WebviewWindow<R>,
    coordinator: State<'_, GlobalIndexCoordinator>,
    db: State<'_, Database>,
    source_id: String,
    enabled: bool,
) -> Result<(), String> {
    require_main_window(&window)?;
    coordinator
        .set_source_enabled(&source_id, enabled)
        .map_err(|error| error.to_string())?;

    if enabled {
        // A disabled source may have missed an arbitrary amount of native
        // history. Re-enable only through an explicit fail-closed rebuild.
        coordinator
            .rebuild(Some(source_id))
            .map_err(|error| error.to_string())
    } else {
        // Search SQL also checks the volume flag, so this is immediate even if
        // a native provider still has an in-flight batch. Staling the existing
        // rows additionally cancels managed AI work and guarantees that a later
        // re-enable cannot expose an old snapshot before rebuilding.
        db.mark_global_entries_stale_for_volume(&source_id)
            .map(|_| ())
            .map_err(|error| error.to_string())
    }
}

#[tauri::command]
pub fn open_global_search_result(db: State<'_, Database>, entry_id: String) -> Result<(), String> {
    let entry = db
        .get_global_entry(&entry_id)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "global_search_result_not_found".to_string())?;
    open_path(&entry.path)
}

#[tauri::command]
pub fn reveal_global_search_result(
    db: State<'_, Database>,
    entry_id: String,
) -> Result<(), String> {
    let entry = db
        .get_global_entry(&entry_id)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "global_search_result_not_found".to_string())?;
    crate::file_ops::reveal_in_folder(entry.path)
}

#[tauri::command]
pub fn list_managed_scopes(db: State<'_, Database>) -> Result<Vec<ManagedScope>, String> {
    db.list_managed_scopes().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn add_managed_scope<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: AddManagedScopeRequest,
) -> Result<ManagedScope, String> {
    require_main_window(&window)?;
    with_managed_policy_write_lock(|| db.add_managed_scope(request))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn remove_managed_scope<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    id: String,
) -> Result<bool, String> {
    require_main_window(&window)?;
    with_managed_policy_write_lock(|| db.remove_managed_scope(&id))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn update_managed_scope_policy<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: UpdateManagedScopePolicyRequest,
) -> Result<ManagedScope, String> {
    require_main_window(&window)?;
    with_managed_policy_write_lock(|| {
        let updated = db.update_managed_scope_policy(request)?;
        reconcile_managed_scope_policy(db.inner(), &updated)?;
        Ok::<ManagedScope, crate::db::DbError>(updated)
    })
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_ai_management_status(db: State<'_, Database>) -> Result<AiManagementStatus, String> {
    db.ai_management_status().map_err(|error| error.to_string())
}

fn open_path(path: &str) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("global_search_path_empty".to_string());
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer.exe")
            .arg(path)
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("global_search_open_failed: {error}"))
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(path)
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("global_search_open_failed: {error}"))
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("global_search_open_failed: {error}"))
    }
    #[cfg(not(any(windows, unix)))]
    {
        Err("global_search_open_unsupported".to_string())
    }
}
