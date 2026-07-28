pub mod ai;
pub mod analysis;
pub mod app_control;
pub mod db;
pub mod dedupe;
pub(crate) mod file_naming;
pub mod file_ops;
pub mod fs_safety;
pub mod global_index;
pub mod ids;
pub mod path_filter;
pub mod path_identity;
pub(crate) mod recovery;
pub mod runtime_capabilities;
pub mod scanner;
pub mod settings;
pub mod storage_analyzer;
pub mod watcher;
pub mod window_auth;

use db::Database;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, Runtime};

pub use ai::classification::{
    cancel_ai_classification, classify_files_with_ai, classify_selected_files_with_ai,
    AIClassificationCancellationToken, AIClassificationOptions, AIClassificationProgressPayload,
};
pub use ai::cleanup::analyze_cleanup_candidates_with_ai;
pub use ai::debug::{debug_ai_classification_once, AIDebugClassificationResult};
pub use ai::settings::{
    get_ai_settings, list_ai_models, list_ai_provider_presets, save_ai_settings,
    test_ai_provider_connection, AISettings,
};
pub use ai::trace::{clear_ai_request_traces, export_ai_request_traces, list_ai_request_traces};
pub use analysis::{
    cancel_analysis_run, get_active_analysis_run, get_analysis_finding, get_analysis_run,
    get_dedupe_authority, list_analysis_detectors, list_analysis_finding_evidence,
    list_analysis_findings, list_analysis_run_detectors, list_analysis_runs, retry_analysis_run,
    revalidate_analysis_finding, set_analysis_finding_decision, start_analysis_run,
    AnalysisDetectorDescriptor, AnalysisRunManager,
};
pub use app_control::{
    activate_search_result, get_global_hotkey_status, quit_app, register_global_search_hotkey,
    resize_search_window, GlobalHotkeyStatus, GlobalHotkeyStatusState, SearchNavigatePayload,
    SearchView,
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
pub use db::{
    AnalysisDetectorDto, AnalysisFindingDecisionDto, AnalysisFindingDto,
    AnalysisFindingEvidenceDto, AnalysisFindingPageDto, AnalysisRunDto, AnalysisScopeRequest,
    DedupeAuthorityDto, StartAnalysisRunRequest,
};
pub use db::{
    DedupeGroupDto, DedupeGroupMemberDto, DedupeGroupPageDto, DedupeRunDto, DedupeScopeRequest,
    StartDedupeRunRequest,
};
pub use file_ops::{
    cancel_operations, execute_moves, move_file, reconcile_pending_operation_journal, rename_file,
    restore_moves, ExecuteMovesByIdRequest, ExecuteMovesRequest, ExecuteMovesResult,
    FileOperationResult, OperationCancellationToken, OperationLogDto, OperationPreviewRequest,
    OperationProgressPayload, OperationSelection, RestoreMovesByIdRequest, RestoreMovesRequest,
    RestoreMovesResult,
};
pub use runtime_capabilities::{get_runtime_capabilities, RuntimeCapabilities};
pub use scanner::{
    cancel_scan, cancel_scan_run, create_scan_job_id, get_managed_scan_snapshot,
    get_scan_root_health, get_scan_run, list_scan_roots, list_scan_runs,
    resume_pending_dedupe_dispatches, retry_interrupted_scan, scan_directory, start_managed_scan,
    ManagedScanEvent, ManagedScanRequest, ManagedScanSnapshotDto, ManagedScanStartDto,
    ScanBatchPayload, ScanJobManager, ScanProgressPayload, ScanRootDto, ScanRunDto, ScanSessionDto,
    ScanSessionRootDto, ScanSummary, ScannedEntry,
};
pub use settings::{
    get_app_settings, get_settings, get_versioned_app_settings, save_app_settings,
    save_app_settings_cas, save_settings, AppSettings, OrganizeRootMode, SaveSettingsRequest,
    VersionedAppSettings,
};
pub use storage_analyzer::{
    cancel_cleanup_restore, cancel_storage_cleanup_scan, get_storage_cleanup_candidate_page,
    get_storage_cleanup_scan_status, is_main_window_label_for_test, list_cleanup_trash_batches,
    move_cleanup_candidates_to_safe_trash, preview_cleanup_candidates, preview_cleanup_operations,
    preview_cleanup_restore_item_for_test, preview_restore_cleanup_trash,
    restore_cleanup_trash_items, reveal_storage_candidate, run_cleanup_restore_job_for_test,
    start_storage_cleanup_scan, CleanupActionKind, CleanupExecutionLog, CleanupExecutionResult,
    CleanupFindingSelection, CleanupPreviewItem, CleanupRestoreJobStatus, CleanupRestoreLog,
    CleanupRestorePreview, CleanupRestorePreviewItem, CleanupRestoreProgressPayload,
    CleanupRestoreResult, CleanupRestoreState, CleanupRestoreTestOutcome, CleanupTier,
    CleanupTrashBatch, CleanupTrashItem, ReviewFindingConfirmation, StorageAnalysis,
    StorageCandidate, StorageCleanupCompleted, StorageCleanupJobMessage, StorageCleanupProgress,
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
