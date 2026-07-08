pub mod ai;
pub mod app_control;
pub mod db;
pub mod dedupe;
pub mod file_ops;
pub mod path_filter;
pub mod scanner;
pub mod settings;
pub mod storage_analyzer;
pub mod watcher;

use db::Database;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, Runtime};

pub use ai::classification::{
    classify_files_with_ai, classify_selected_files_with_ai, AIClassificationOptions,
};
pub use ai::cleanup::analyze_cleanup_candidates_with_ai;
pub use ai::debug::{debug_ai_classification_once, AIDebugClassificationResult};
pub use ai::settings::{
    get_ai_settings, list_ai_provider_presets, save_ai_settings, test_ai_provider_connection,
    AISettings,
};
pub use app_control::{
    activate_search_result, get_global_hotkey_status, quit_app, register_global_search_hotkey,
    resize_search_window, GlobalHotkeyStatus, GlobalHotkeyStatusState, SearchNavigatePayload,
};
pub use db::{
    confirm_classification, correct_classification, delete_user_rule, execute_rules_for_paths,
    execute_rules_for_scope, execute_rules_on_inbox, get_operation_logs,
    get_operation_previews_for_scope, get_paged_files, get_stats_summary, get_user_rules, init_db,
    insert_file, save_user_rule, search_files, upsert_files_by_paths,
    ClassificationCorrectionRequest, FileLibraryFilter, FileRecordDto, FileSearchResult,
    InsertFileRequest, LibraryFilter, LibraryScope, OperationPreviewDto,
    OperationPreviewScopeResult, PagedFilesResult, Rule, RuleExecutionMode, RuleExecutionSummary,
    StatsSummary,
};
pub use file_ops::{
    cancel_operations, execute_moves, move_file, rename_file, restore_moves, ExecuteMovesRequest,
    ExecuteMovesResult, FileOperationResult, OperationCancellationToken, OperationLogDto,
    OperationPreviewRequest, OperationProgressPayload, RestoreMovesRequest, RestoreMovesResult,
};
pub use scanner::{
    cancel_scan, scan_directory, ScanBatchPayload, ScanCancellationToken, ScanProgressPayload,
    ScanSummary, ScannedEntry,
};
pub use settings::{
    get_app_settings, get_settings, save_app_settings, save_settings, AppSettings, OrganizeRootMode,
};
pub use storage_analyzer::{
    cancel_storage_cleanup_scan, get_storage_cleanup_scan_status, list_cleanup_trash_batches,
    move_cleanup_candidates_to_safe_trash, move_cleanup_candidates_to_trash,
    preview_cleanup_candidates, preview_cleanup_operations, preview_restore_cleanup_trash,
    restore_cleanup_trash_items, reveal_storage_candidate, scan_storage_cleanup,
    start_storage_cleanup_scan, CleanupActionKind, CleanupExecutionLog, CleanupExecutionResult,
    CleanupPreviewItem, CleanupRestoreLog, CleanupRestorePreview, CleanupRestoreResult,
    CleanupTier, CleanupTrashBatch, CleanupTrashItem, StorageAnalysis, StorageCandidate,
    StorageCleanupCompleted, StorageCleanupJobMessage, StorageCleanupProgress,
    StorageCleanupScanStatus, StorageCleanupState,
};
pub use watcher::{
    setup_file_watcher, FileWatchEvent, FileWatcherManager, WatcherErrorEvent, WatcherReadyEvent,
};

pub fn database_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    Ok(dir.join("zen-canvas.sqlite3"))
}

pub fn open_database<R: Runtime>(app: &AppHandle<R>) -> Result<Database, String> {
    Database::open(database_path(app)?).map_err(|error| error.to_string())
}
