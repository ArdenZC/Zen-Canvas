use crate::path_identity::{normalize_path, normalize_text_for_platform, PathPlatform};
use crate::{
    db::Database,
    file_naming::{normalize_proposed_file_name, ExtensionChangePolicy},
    ids::new_job_id,
    window_auth::require_main_window,
};
use serde::{Deserialize, Serialize};
#[cfg(all(test, windows))]
use std::io::Read;
use std::{
    env, fs, io,
    path::{Component, Path, PathBuf},
    process::Command as ProcessCommand,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{command, AppHandle, Emitter, Manager, Runtime, State, WebviewWindow};
use thiserror::Error;

pub const OPERATION_PROGRESS_EVENT: &str = "operation-progress";
const OPERATION_PROGRESS_BATCH_SIZE: u64 = 10;
const OPERATION_PROGRESS_EMIT_INTERVAL: Duration = Duration::from_millis(200);

#[cfg(any(test, feature = "native-qa"))]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OperationTestFaultPoint {
    AfterCompletedPhaseBeforeFinalLogPersist,
    AfterRestoreJournalPreparedBeforeClaim,
    AfterRestoreSourceClaimedBeforeTargetCommit,
    AfterRestoreTargetCommittedBeforeFinalPersist,
    AfterRestoreCompletedPhaseBeforeFinalTransaction,
}

#[cfg(any(test, feature = "native-qa"))]
thread_local! {
    static OPERATION_TEST_FAULT: std::cell::Cell<Option<OperationTestFaultPoint>> =
        const { std::cell::Cell::new(None) };
}

#[cfg(any(test, feature = "native-qa"))]
pub fn set_operation_test_fault(point: Option<OperationTestFaultPoint>) {
    OPERATION_TEST_FAULT.with(|fault| fault.set(point));
}

#[cfg(any(test, feature = "native-qa"))]
fn take_operation_test_fault(point: OperationTestFaultPoint) -> bool {
    OPERATION_TEST_FAULT.with(|fault| {
        if fault.get() == Some(point) {
            fault.set(None);
            true
        } else {
            false
        }
    })
}

#[derive(Debug, Error)]
enum FileOpError {
    #[error("Source file does not exist.")]
    SourceMissing,
    #[error("Source path is not a regular file.")]
    SourceNotFile,
    #[error("Source and target paths must be absolute.")]
    RelativePath,
    #[error("Target parent directory does not exist.")]
    TargetParentMissing,
    #[error("Target file already exists. Zen Canvas will not overwrite files.")]
    TargetExists,
    #[error("The requested file name is not safe.")]
    UnsafeFileName,
    #[error("Operation rejected because it touches a protected system location: {0}")]
    ProtectedPath(String),
    #[error("Target path contains unsafe parent traversal.")]
    UnsafePathTraversal,
    #[error("File operation failed: {0}")]
    Io(#[from] io::Error),
}

#[derive(Debug)]
enum FileMutationError {
    Validation(String),
    Atomic(crate::fs_safety::AtomicMoveError),
}

impl From<String> for FileMutationError {
    fn from(error: String) -> Self {
        Self::Validation(error)
    }
}

impl From<crate::fs_safety::AtomicMoveError> for FileMutationError {
    fn from(error: crate::fs_safety::AtomicMoveError) -> Self {
        Self::Atomic(error)
    }
}

impl std::fmt::Display for FileMutationError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Validation(error) => formatter.write_str(error),
            Self::Atomic(error) => error.fmt(formatter),
        }
    }
}

impl FileMutationError {
    fn journal_phase(&self) -> &'static str {
        match self {
            Self::Validation(_) => "rolled_back",
            Self::Atomic(error) => match error {
                crate::fs_safety::AtomicMoveError::TargetCommittedDurabilityUnknown
                | crate::fs_safety::AtomicMoveError::TargetCommittedIdentityMismatch => {
                    "target_committed"
                }
                crate::fs_safety::AtomicMoveError::TargetCommittedSourceCleanupPending
                | crate::fs_safety::AtomicMoveError::TargetCommittedSourceDeleteFailed(_) => {
                    "source_cleanup_pending"
                }
                _ => match error.commit_state() {
                    crate::fs_safety::AtomicMoveCommitState::RolledBack => "rolled_back",
                    crate::fs_safety::AtomicMoveCommitState::SourceClaimed => "source_claimed",
                    crate::fs_safety::AtomicMoveCommitState::TargetCommitted => "target_committed",
                    crate::fs_safety::AtomicMoveCommitState::SourceCleanupPending => {
                        "source_cleanup_pending"
                    }
                    crate::fs_safety::AtomicMoveCommitState::Completed => "completed",
                    crate::fs_safety::AtomicMoveCommitState::ManualReview => "manual_review",
                },
            },
        }
    }

    fn requires_recovery(&self) -> bool {
        match self {
            Self::Validation(_) => false,
            Self::Atomic(error) => !matches!(
                error.commit_state(),
                crate::fs_safety::AtomicMoveCommitState::RolledBack
            ),
        }
    }

    fn is_cancelled(&self) -> bool {
        matches!(
            self,
            Self::Atomic(crate::fs_safety::AtomicMoveError::Cancelled)
        )
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationResult {
    pub operation: String,
    pub source_path: String,
    pub target_path: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ExecuteMovesRequest {
    pub operations: Vec<OperationPreviewRequest>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ExecuteMovesByIdRequest {
    pub operations: Vec<OperationSelection>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OperationSelection {
    pub id: String,
    #[serde(alias = "fileId")]
    pub file_id: String,
    #[serde(default, alias = "newName")]
    pub new_name: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OperationPreviewRequest {
    pub id: String,
    #[serde(alias = "fileId")]
    pub file_id: String,
    #[serde(alias = "operationType")]
    pub operation_type: String,
    #[serde(alias = "sourcePath")]
    pub source_path: String,
    #[serde(alias = "targetPath")]
    pub target_path: String,
    #[serde(alias = "oldName")]
    pub old_name: String,
    #[serde(alias = "newName")]
    pub new_name: String,
    #[serde(default, alias = "isExecutable")]
    pub is_executable: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct OperationLogDto {
    pub id: String,
    pub batch_id: String,
    pub operation_type: String,
    pub source_path: String,
    pub target_path: String,
    pub old_name: String,
    pub new_name: String,
    pub status: String,
    pub error_message: Option<String>,
    pub created_at: String,
    pub can_undo: bool,
    pub path_before: String,
    pub path_after: String,
    pub name_before: String,
    pub name_after: String,
    pub can_restore: bool,
    pub restored_at: Option<String>,
    pub restore_status: String,
    pub restore_error: Option<String>,
    #[serde(default)]
    pub source_size: Option<u64>,
    #[serde(default)]
    pub source_modified_ns: Option<String>,
    #[serde(default)]
    pub source_platform_file_id: Option<String>,
    #[serde(default)]
    pub source_platform_volume_id: Option<String>,
    #[serde(default)]
    pub source_quick_hash: Option<String>,
    #[serde(default)]
    pub source_full_hash: Option<String>,
    #[serde(default)]
    pub target_platform_file_id: Option<String>,
    #[serde(default)]
    pub target_platform_volume_id: Option<String>,
    #[serde(default)]
    pub target_full_hash: Option<String>,
    #[serde(default)]
    pub source_claim_path: Option<String>,
    #[serde(default = "default_operation_phase")]
    pub operation_phase: String,
    #[serde(default)]
    pub claim_created_at: Option<String>,
    #[serde(default)]
    pub claim_platform_file_id: Option<String>,
    #[serde(default)]
    pub claim_platform_volume_id: Option<String>,
    #[serde(default)]
    pub claim_full_hash: Option<String>,
    #[serde(default)]
    pub restore_claim_path: Option<String>,
    #[serde(default = "default_restore_phase")]
    pub restore_phase: String,
    #[serde(default)]
    pub restore_claim_created_at: Option<String>,
    #[serde(default)]
    pub restore_claim_platform_file_id: Option<String>,
    #[serde(default)]
    pub restore_claim_platform_volume_id: Option<String>,
    #[serde(default)]
    pub restore_claim_full_hash: Option<String>,
}

fn default_operation_phase() -> String {
    "completed".to_string()
}

fn default_restore_phase() -> String {
    "idle".to_string()
}

#[derive(Debug, Clone, Serialize)]
pub struct ExecuteMovesResult {
    pub logs: Vec<OperationLogDto>,
    pub batch_id: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RestoreMovesRequest {
    pub logs: Vec<OperationLogDto>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RestoreMovesByIdRequest {
    #[serde(alias = "logIds")]
    pub log_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RestoreMovesResult {
    pub logs: Vec<OperationLogDto>,
    pub restored: usize,
    pub failed: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OperationProgressPayload {
    pub kind: String,
    pub batch_id: String,
    pub processed: u64,
    pub total: u64,
    pub current_path: String,
}

#[derive(Clone, Default)]
pub struct OperationCancellationToken {
    cancel: Arc<AtomicBool>,
    running: Arc<AtomicBool>,
}

impl OperationCancellationToken {
    fn begin(&self) -> Result<OperationRunGuard, String> {
        self.running
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Relaxed)
            .map_err(|_| "Another file operation is already running.".to_string())?;
        self.cancel.store(false, Ordering::Release);
        Ok(OperationRunGuard {
            running: Arc::clone(&self.running),
        })
    }
}

struct OperationRunGuard {
    running: Arc<AtomicBool>,
}

impl Drop for OperationRunGuard {
    fn drop(&mut self) {
        self.running.store(false, Ordering::Release);
    }
}

pub trait OperationProgressEmitter {
    fn emit_progress(&self, payload: OperationProgressPayload);
}

struct NoopOperationProgressEmitter;

impl OperationProgressEmitter for NoopOperationProgressEmitter {
    fn emit_progress(&self, _payload: OperationProgressPayload) {}
}

struct TauriOperationProgressEmitter<R: Runtime> {
    app: AppHandle<R>,
}

impl<R: Runtime> TauriOperationProgressEmitter<R> {
    fn new(app: AppHandle<R>) -> Self {
        Self { app }
    }
}

impl<R: Runtime> OperationProgressEmitter for TauriOperationProgressEmitter<R> {
    fn emit_progress(&self, payload: OperationProgressPayload) {
        if let Err(error) = self.app.emit(OPERATION_PROGRESS_EVENT, payload) {
            eprintln!("Operation progress event failed: {error}");
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct RevealCommand {
    program: &'static str,
    args: Vec<String>,
}

pub fn move_file(source_path: String, target_path: String) -> Result<FileOperationResult, String> {
    crate::fs_safety::platform_support::ensure_supported_file_mutation()
        .map_err(|error| error.to_string())?;
    let source = validate_source_path(&PathBuf::from(source_path))?;
    let target = validate_target_path(&PathBuf::from(target_path))?;

    ensure_general_file_operation_allowed(&source)?;
    ensure_general_file_operation_allowed(&target)?;
    move_file_no_overwrite(&source, &target).map_err(|error| error.to_string())?;

    Ok(FileOperationResult {
        operation: "move".to_string(),
        source_path: normalize_path(&source),
        target_path: normalize_path(&target),
    })
}

#[command]
pub async fn execute_moves<R: Runtime>(
    window: WebviewWindow<R>,
    app: AppHandle<R>,
    db: State<'_, Database>,
    cancel: State<'_, OperationCancellationToken>,
    request: ExecuteMovesByIdRequest,
) -> Result<ExecuteMovesResult, String> {
    require_main_window(&window)?;
    let db = db.inner().clone();
    let request = resolve_execute_selections(&db, request)?;
    let app_data_dir = app.path().app_data_dir().ok();
    let guard = cancel.begin()?;
    let cancel_flag = Arc::clone(&cancel.cancel);
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = guard;
        let emitter = TauriOperationProgressEmitter::new(app);
        execute_moves_with_persistence_with_progress_and_app_data(
            &db,
            request,
            cancel_flag,
            &emitter,
            app_data_dir,
        )
    })
    .await
    .map_err(|error| format!("operation task failed: {error}"))?
}

fn resolve_execute_selections(
    db: &Database,
    request: ExecuteMovesByIdRequest,
) -> Result<ExecuteMovesRequest, String> {
    if request.operations.is_empty() {
        return Err("At least one authoritative preview ID is required.".to_string());
    }
    let file_ids = request
        .operations
        .iter()
        .map(|selection| selection.file_id.clone())
        .collect::<Vec<_>>();
    let previews = db
        .get_operation_previews_by_file_ids(&file_ids)
        .map_err(|error| error.to_string())?;
    let previews_by_file_id = previews
        .into_iter()
        .map(|preview| (preview.file_id.clone(), preview))
        .collect::<std::collections::HashMap<_, _>>();
    let mut operations = Vec::with_capacity(request.operations.len());
    for selection in request.operations {
        let preview = previews_by_file_id
            .get(&selection.file_id)
            .ok_or_else(|| format!("No authoritative preview exists for {}.", selection.id))?;
        if preview.id != selection.id || preview.is_executable == Some(false) {
            return Err(format!(
                "Invalid authoritative preview ID: {}.",
                selection.id
            ));
        }
        db.verify_indexed_file_identity(&selection.file_id)
            .map_err(|error| error.to_string())?;
        let (original_name, indexed_extension, is_dir) = db
            .get_indexed_file_naming(&selection.file_id)
            .map_err(|error| error.to_string())?;
        let mut new_name = normalize_proposed_file_name(
            &original_name,
            &indexed_extension,
            &preview.new_name,
            is_dir,
            ExtensionChangePolicy::Preserve,
        )?;
        validate_safe_file_name(&new_name)?;
        let mut target_path = preview.target_path.clone();
        if let Some(override_name) = selection.new_name {
            let normalized_override = normalize_proposed_file_name(
                &original_name,
                &indexed_extension,
                &override_name,
                is_dir,
                ExtensionChangePolicy::Preserve,
            )?;
            validate_safe_file_name(&normalized_override)?;
            let parent = Path::new(&target_path)
                .parent()
                .ok_or_else(|| "Authoritative preview target has no parent.".to_string())?;
            target_path = normalize_path(&parent.join(&normalized_override));
            new_name = normalized_override;
        }
        operations.push(OperationPreviewRequest {
            id: preview.id.clone(),
            file_id: preview.file_id.clone(),
            operation_type: preview.operation_type.clone(),
            source_path: preview.source_path.clone(),
            target_path,
            old_name: preview.old_name.clone(),
            new_name,
            is_executable: preview.is_executable,
        });
    }
    Ok(ExecuteMovesRequest { operations })
}

#[command]
pub fn cancel_operations<R: Runtime>(
    window: WebviewWindow<R>,
    cancel: State<'_, OperationCancellationToken>,
) -> Result<(), String> {
    require_main_window(&window)?;
    cancel.cancel.store(true, Ordering::Relaxed);
    Ok(())
}

pub fn execute_moves_with_persistence(
    db: &Database,
    request: ExecuteMovesRequest,
) -> Result<ExecuteMovesResult, String> {
    execute_moves_with_persistence_with_progress(
        db,
        request,
        Arc::new(AtomicBool::new(false)),
        &NoopOperationProgressEmitter,
    )
}

fn execute_moves_with_persistence_with_progress(
    db: &Database,
    request: ExecuteMovesRequest,
    cancel_flag: Arc<AtomicBool>,
    emitter: &impl OperationProgressEmitter,
) -> Result<ExecuteMovesResult, String> {
    execute_moves_with_persistence_with_progress_and_app_data(
        db,
        request,
        cancel_flag,
        emitter,
        None,
    )
}

fn execute_moves_with_persistence_with_progress_and_app_data(
    db: &Database,
    request: ExecuteMovesRequest,
    cancel_flag: Arc<AtomicBool>,
    emitter: &impl OperationProgressEmitter,
    app_data_dir: Option<PathBuf>,
) -> Result<ExecuteMovesResult, String> {
    crate::fs_safety::platform_support::ensure_supported_file_mutation()
        .map_err(|error| error.to_string())?;
    let operations = request.operations.clone();
    let batch_id = new_job_id("operation-batch");
    let created_at = current_timestamp_ms().to_string();
    let prepared_operations =
        persist_pending_operation_journal(db, &request, &batch_id, &created_at)?;
    let mut result = execute_moves_core_with_identity(
        request,
        cancel_flag,
        emitter,
        app_data_dir,
        batch_id,
        created_at,
        OperationPersistenceContext {
            prepared_operations: Some(&prepared_operations),
            journal_db: Some(db),
        },
    );

    for (operation, log) in operations.iter().zip(result.logs.iter_mut()) {
        if let Some(prepared) = prepared_operations.get(&operation.id) {
            apply_source_fingerprint(log, &prepared.fingerprint);
            log.source_claim_path = Some(normalize_path(&prepared.claim_path));
            log.claim_created_at = Some(prepared.claim_created_at.clone());
        }
        if log.status != "success" {
            continue;
        }
        if let Ok(target_fingerprint) = file_identity_fingerprint(Path::new(&log.path_after)) {
            log.target_platform_file_id = target_fingerprint.platform_file_id;
            log.target_platform_volume_id = target_fingerprint.platform_volume_id;
            log.target_full_hash = target_fingerprint.full_hash;
        }
        if operation.operation_type == "move_to_trash" {
            continue;
        }

        if let Err(error) = db.update_file_after_successful_operation(
            &operation.file_id,
            &log.path_before,
            &log.path_after,
            &log.name_after,
        ) {
            let warning = format!("file index sync failed: {error}");
            eprintln!("{warning}");
            append_operation_log_error(log, warning);
        }
    }

    for log in &mut result.logs {
        log.operation_phase = operation_phase_for_log(log).to_string();
    }

    #[cfg(any(test, feature = "native-qa"))]
    if take_operation_test_fault(OperationTestFaultPoint::AfterCompletedPhaseBeforeFinalLogPersist)
    {
        return Err("injected after_completed_phase_before_final_log_persist failure".to_string());
    }

    db.save_operation_logs(&result.batch_id, &result.logs)
        .map_err(|error| format!("operation completed but failed to persist logs: {error}"))?;
    Ok(result)
}

pub fn execute_moves_core(request: ExecuteMovesRequest) -> ExecuteMovesResult {
    execute_moves_core_with_progress(
        request,
        Arc::new(AtomicBool::new(false)),
        &NoopOperationProgressEmitter,
    )
}

pub fn execute_moves_core_with_progress(
    request: ExecuteMovesRequest,
    cancel_flag: Arc<AtomicBool>,
    emitter: &impl OperationProgressEmitter,
) -> ExecuteMovesResult {
    execute_moves_core_with_progress_and_app_data(request, cancel_flag, emitter, None)
}

fn execute_moves_core_with_progress_and_app_data(
    request: ExecuteMovesRequest,
    cancel_flag: Arc<AtomicBool>,
    emitter: &impl OperationProgressEmitter,
    app_data_dir: Option<PathBuf>,
) -> ExecuteMovesResult {
    let batch_id = new_job_id("operation-batch");
    let created_at = current_timestamp_ms().to_string();
    execute_moves_core_with_identity(
        request,
        cancel_flag,
        emitter,
        app_data_dir,
        batch_id,
        created_at,
        OperationPersistenceContext {
            prepared_operations: None,
            journal_db: None,
        },
    )
}

struct OperationPersistenceContext<'a> {
    prepared_operations: Option<&'a std::collections::HashMap<String, PreparedOperation>>,
    journal_db: Option<&'a Database>,
}

fn execute_moves_core_with_identity(
    request: ExecuteMovesRequest,
    cancel_flag: Arc<AtomicBool>,
    emitter: &impl OperationProgressEmitter,
    app_data_dir: Option<PathBuf>,
    batch_id: String,
    created_at: String,
    persistence: OperationPersistenceContext<'_>,
) -> ExecuteMovesResult {
    let prepared_operations = persistence.prepared_operations;
    let journal_db = persistence.journal_db;
    let total = request.operations.len() as u64;
    let mut progress = OperationProgressBuffer::new("execute", batch_id.clone(), total);
    let mut logs = Vec::with_capacity(request.operations.len());

    for (index, operation) in request.operations.iter().enumerate() {
        let log = if is_operation_cancelled(&cancel_flag) {
            make_canceled_operation_log(&batch_id, &created_at, index, operation)
        } else {
            let prepared = prepared_operations.and_then(|items| items.get(&operation.id));
            let expected_identity =
                prepared.map(|item| expected_identity_from_fingerprint(&item.fingerprint));
            let mut phase_log = prepared.map(|item| item.journal_log.clone());
            let mut observed_phase = None;
            let mut phase_observer = |phase: &str| {
                observed_phase = Some(phase.to_string());
                if let (Some(db), Some(log)) = (journal_db, phase_log.as_mut()) {
                    log.operation_phase = phase.to_string();
                    // The filesystem callback is not the durable operation
                    // completion boundary.  Keep the row pending until the
                    // final save_operation_logs transaction succeeds.
                    log.status = "pending".to_string();
                    log.error_message = None;
                    db.update_operation_phase(log).map_err(|error| {
                        let message = format!("journal phase persistence failed: {error}");
                        if matches!(
                            phase,
                            "target_committed" | "source_cleanup_pending" | "completed"
                        ) {
                            crate::fs_safety::AtomicMoveError::TargetCommittedDurabilityUnknown
                        } else {
                            crate::fs_safety::AtomicMoveError::SourceClaimRecoveryRequired(message)
                        }
                    })?;
                }
                Ok(())
            };
            let mut log = execute_preview_operation_with_app_data(
                &batch_id,
                &created_at,
                index,
                operation,
                OperationExecutionContext {
                    cancel_flag: Some(cancel_flag.as_ref()),
                    app_data_dir: app_data_dir.as_deref(),
                    expected_identity: expected_identity.as_ref(),
                    planned_claim_path: prepared.map(|item| item.claim_path.as_path()),
                    phase_observer: journal_db
                        .map(|_| &mut phase_observer as &mut crate::fs_safety::PhaseObserver<'_>),
                },
            );
            if let Some(phase) = observed_phase {
                log.operation_phase = phase;
                if log.status != "success"
                    && !matches!(
                        log.operation_phase.as_str(),
                        "prepared" | "source_claimed" | "copying" | "rolled_back"
                    )
                {
                    log.status = "manual_review".to_string();
                    log.can_undo = false;
                    log.can_restore = false;
                }
            }
            log
        };
        let current_path = operation.source_path.clone();
        logs.push(log);
        progress.record(emitter, (index + 1) as u64, current_path);
    }

    ExecuteMovesResult { logs, batch_id }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct FileIdentityFingerprint {
    pub(crate) size: u64,
    pub(crate) modified_ns: Option<i128>,
    pub(crate) platform_volume_id: Option<String>,
    pub(crate) platform_file_id: Option<String>,
    pub(crate) quick_hash: Option<String>,
    pub(crate) full_hash: Option<String>,
}

#[derive(Debug, Clone)]
struct PreparedOperation {
    fingerprint: FileIdentityFingerprint,
    #[cfg(any(test, feature = "native-qa"))]
    source_path: PathBuf,
    claim_path: PathBuf,
    claim_created_at: String,
    journal_log: OperationLogDto,
}

pub(crate) fn file_identity_fingerprint(path: &Path) -> Result<FileIdentityFingerprint, String> {
    let identity =
        crate::fs_safety::capture_identity(path, None).map_err(|error| error.to_string())?;
    Ok(FileIdentityFingerprint {
        size: identity.size,
        modified_ns: identity.modified_ns,
        platform_volume_id: identity.platform_volume_id,
        platform_file_id: identity.platform_file_id,
        quick_hash: identity.sample_hash,
        full_hash: identity.full_hash,
    })
}

fn apply_source_fingerprint(log: &mut OperationLogDto, fingerprint: &FileIdentityFingerprint) {
    log.source_size = Some(fingerprint.size);
    log.source_modified_ns = fingerprint.modified_ns.map(|value| value.to_string());
    log.source_platform_file_id = fingerprint.platform_file_id.clone();
    log.source_platform_volume_id = fingerprint.platform_volume_id.clone();
    log.source_quick_hash = fingerprint.quick_hash.clone();
    log.source_full_hash = fingerprint.full_hash.clone();
}

fn expected_identity_from_fingerprint(
    fingerprint: &FileIdentityFingerprint,
) -> crate::fs_safety::ExpectedFileIdentity {
    crate::fs_safety::ExpectedFileIdentity {
        size: fingerprint.size,
        modified_ns: fingerprint.modified_ns,
        platform_volume_id: fingerprint.platform_volume_id.clone(),
        platform_file_id: fingerprint.platform_file_id.clone(),
        sample_hash: fingerprint.quick_hash.clone(),
        full_hash: fingerprint.full_hash.clone(),
    }
}

fn expected_identity_from_log(
    log: &OperationLogDto,
) -> Option<crate::fs_safety::ExpectedFileIdentity> {
    Some(crate::fs_safety::ExpectedFileIdentity {
        size: log.source_size?,
        modified_ns: log
            .source_modified_ns
            .as_deref()
            .and_then(|value| value.parse::<i128>().ok()),
        platform_volume_id: log.source_platform_volume_id.clone(),
        platform_file_id: log.source_platform_file_id.clone(),
        sample_hash: log.source_quick_hash.clone(),
        full_hash: log.source_full_hash.clone(),
    })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RestoreVolumeRelation {
    SameVolume,
    CrossVolume,
    Unknown,
}

fn restore_volume_relation(log: &OperationLogDto) -> RestoreVolumeRelation {
    match (
        log.source_platform_volume_id.as_deref(),
        log.target_platform_volume_id.as_deref(),
    ) {
        (Some(source), Some(target)) if source == target => RestoreVolumeRelation::SameVolume,
        (Some(_), Some(_)) => RestoreVolumeRelation::CrossVolume,
        _ => RestoreVolumeRelation::Unknown,
    }
}

/// Identity of the path currently holding the file being restored (path_after).
/// A file ID is meaningful only when both operation volumes are known to be
/// the same. Missing volume metadata is deliberately not treated as proof of
/// same-volume semantics.
fn expected_restore_identity_from_log(
    log: &OperationLogDto,
) -> Option<crate::fs_safety::ExpectedFileIdentity> {
    let platform_file_id = if restore_volume_relation(log) == RestoreVolumeRelation::SameVolume {
        log.target_platform_file_id
            .clone()
            .or_else(|| log.source_platform_file_id.clone())
    } else {
        None
    };
    Some(crate::fs_safety::ExpectedFileIdentity {
        size: log.source_size?,
        modified_ns: None,
        platform_volume_id: log.target_platform_volume_id.clone(),
        platform_file_id,
        sample_hash: log.source_quick_hash.clone(),
        full_hash: log
            .target_full_hash
            .clone()
            .or_else(|| log.source_full_hash.clone()),
    })
}

/// Identity of the original path after a restore. A copy-commit across
/// volumes may legitimately receive a new file ID, so only a proven
/// SameVolume relation permits the old source ID to be checked.
fn expected_restore_original_identity_from_log(
    log: &OperationLogDto,
) -> Option<crate::fs_safety::ExpectedFileIdentity> {
    Some(crate::fs_safety::ExpectedFileIdentity {
        size: log.source_size?,
        modified_ns: None,
        platform_volume_id: log.source_platform_volume_id.clone(),
        platform_file_id: (restore_volume_relation(log) == RestoreVolumeRelation::SameVolume)
            .then(|| log.source_platform_file_id.clone())
            .flatten(),
        sample_hash: log.source_quick_hash.clone(),
        full_hash: log
            .source_full_hash
            .clone()
            .or_else(|| log.target_full_hash.clone()),
    })
}

fn expected_restore_final_target_identity_from_log(
    log: &OperationLogDto,
) -> Option<crate::fs_safety::ExpectedFileIdentity> {
    expected_restore_original_identity_from_log(log)
}

fn journal_identity_matches(log: &OperationLogDto, path: &Path) -> Result<bool, ()> {
    let Some(expected) = expected_identity_from_log(log) else {
        return Err(());
    };
    if expected.full_hash.is_none() {
        return Err(());
    }
    crate::fs_safety::capture_identity(path, None)
        .map(|actual| crate::fs_safety::recovery_identity_matches(&expected, &actual))
        .map_err(|_| ())
}

fn journal_target_identity_matches(log: &OperationLogDto, path: &Path) -> Result<bool, ()> {
    let Some(size) = log.source_size else {
        return Err(());
    };
    let expected = crate::fs_safety::ExpectedFileIdentity {
        size,
        modified_ns: if log.target_platform_file_id.is_none() {
            log.source_modified_ns
                .as_deref()
                .and_then(|value| value.parse::<i128>().ok())
        } else {
            None
        },
        platform_volume_id: log.target_platform_volume_id.clone(),
        platform_file_id: log.target_platform_file_id.clone(),
        sample_hash: log.source_quick_hash.clone(),
        full_hash: log
            .target_full_hash
            .clone()
            .or_else(|| log.source_full_hash.clone()),
    };
    if expected.full_hash.is_none() {
        return Err(());
    }
    crate::fs_safety::capture_identity(path, None)
        .map(|actual| crate::fs_safety::recovery_identity_matches(&expected, &actual))
        .map_err(|_| ())
}

fn operation_restore_identity_result(
    log: &OperationLogDto,
    path: &Path,
) -> Result<(), crate::recovery::RecoveryFailure> {
    let Some(expected) = expected_restore_identity_from_log(log) else {
        return Err(crate::recovery::RecoveryFailure::new(
            crate::recovery::RecoveryErrorCode::RestoreSourceIdentityUnreadable,
            "restore identity is incomplete",
        ));
    };
    if expected.full_hash.is_none() {
        return Err(crate::recovery::RecoveryFailure::new(
            crate::recovery::RecoveryErrorCode::RestoreSourceIdentityUnreadable,
            "restore full hash is missing",
        ));
    }
    let actual = crate::fs_safety::capture_identity(path, None).map_err(|error| {
        let code = match error {
            crate::fs_safety::IdentityError::SourceMissing
            | crate::fs_safety::IdentityError::Io(_) => {
                crate::recovery::RecoveryErrorCode::RestoreSourceIdentityUnreadable
            }
            crate::fs_safety::IdentityError::Symlink
            | crate::fs_safety::IdentityError::UnsupportedFileType
            | crate::fs_safety::IdentityError::DirectoryManifestNameEncodingFailed
            | crate::fs_safety::IdentityError::Cancelled => {
                crate::recovery::RecoveryErrorCode::RestoreSourceIdentityUnreadable
            }
        };
        crate::recovery::RecoveryFailure::new(
            code,
            format!("restore source identity could not be read: {error}"),
        )
    })?;
    if !crate::fs_safety::identity_matches(&expected, &actual) {
        return Err(crate::recovery::RecoveryFailure::new(
            crate::recovery::RecoveryErrorCode::RestoreSourceIdentityMismatch,
            "restore source identity does not match the operation journal",
        ));
    }
    Ok(())
}

fn operation_restore_original_identity_result(
    log: &OperationLogDto,
    path: &Path,
) -> Result<(), crate::recovery::RecoveryFailure> {
    let Some(expected) = expected_restore_original_identity_from_log(log) else {
        return Err(crate::recovery::RecoveryFailure::new(
            crate::recovery::RecoveryErrorCode::TargetCommittedIdentityUnreadable,
            "restore original-path identity is incomplete",
        ));
    };
    if expected.full_hash.is_none() {
        return Err(crate::recovery::RecoveryFailure::new(
            crate::recovery::RecoveryErrorCode::TargetCommittedIdentityUnreadable,
            "restore original-path full hash is missing",
        ));
    }
    let actual = crate::fs_safety::capture_identity(path, None).map_err(|error| {
        crate::recovery::RecoveryFailure::new(
            crate::recovery::RecoveryErrorCode::TargetCommittedIdentityUnreadable,
            format!("restore original-path identity could not be read: {error}"),
        )
    })?;
    if !crate::fs_safety::identity_matches(&expected, &actual) {
        return Err(crate::recovery::RecoveryFailure::new(
            crate::recovery::RecoveryErrorCode::TargetCommittedIdentityMismatch,
            "restore original-path identity does not match the operation journal",
        ));
    }
    Ok(())
}

fn operation_restore_identity_matches(log: &OperationLogDto, path: &Path) -> Result<bool, ()> {
    match operation_restore_identity_result(log, path) {
        Ok(()) => Ok(true),
        Err(failure) => match failure.code {
            crate::recovery::RecoveryErrorCode::RestoreSourceIdentityMismatch => Ok(false),
            _ => Err(()),
        },
    }
}

fn operation_restore_original_identity_matches(
    log: &OperationLogDto,
    path: &Path,
) -> Result<bool, ()> {
    match operation_restore_original_identity_result(log, path) {
        Ok(()) => Ok(true),
        Err(failure) => match failure.code {
            crate::recovery::RecoveryErrorCode::TargetCommittedIdentityMismatch => Ok(false),
            _ => Err(()),
        },
    }
}

fn restore_claim_identity_matches(log: &OperationLogDto, path: &Path) -> Result<bool, ()> {
    let Some(size) = log.source_size else {
        return Err(());
    };
    let Some(full_hash) = log
        .restore_claim_full_hash
        .clone()
        .or_else(|| log.source_full_hash.clone())
    else {
        return Err(());
    };
    let expected = crate::fs_safety::ExpectedFileIdentity {
        size,
        modified_ns: None,
        platform_volume_id: log
            .restore_claim_platform_volume_id
            .clone()
            .or_else(|| log.target_platform_volume_id.clone()),
        platform_file_id: log.restore_claim_platform_file_id.clone().or_else(|| {
            (restore_volume_relation(log) == RestoreVolumeRelation::SameVolume)
                .then(|| {
                    log.target_platform_file_id
                        .clone()
                        .or_else(|| log.source_platform_file_id.clone())
                })
                .flatten()
        }),
        sample_hash: log.source_quick_hash.clone(),
        full_hash: Some(full_hash),
    };
    crate::fs_safety::capture_identity(path, None)
        .map(|actual| crate::fs_safety::recovery_identity_matches(&expected, &actual))
        .map_err(|_| ())
}

fn operation_restore_final_identity_check(
    log: &OperationLogDto,
) -> Result<(), crate::recovery::RecoveryFailure> {
    let source = Path::new(&log.path_after);
    match fs::symlink_metadata(source) {
        Ok(_) => {
            return Err(crate::recovery::RecoveryFailure::new(
                crate::recovery::RecoveryErrorCode::RestoreSourcePathReappeared,
                "restore source path reappeared after the filesystem commit; preserve the restore claim and review both paths",
            ))
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => {}
        Err(error) => {
            return Err(crate::recovery::RecoveryFailure::new(
                crate::recovery::RecoveryErrorCode::RestoreSourceIdentityUnreadable,
                format!("restore source absence could not be verified: {error}"),
            ))
        }
    }

    let target = Path::new(&log.path_before);
    let expected = expected_restore_final_target_identity_from_log(log).ok_or_else(|| {
        crate::recovery::RecoveryFailure::new(
            crate::recovery::RecoveryErrorCode::TargetCommittedIdentityUnreadable,
            "restore target identity is incomplete",
        )
    })?;
    if expected.full_hash.is_none() {
        return Err(crate::recovery::RecoveryFailure::new(
            crate::recovery::RecoveryErrorCode::TargetCommittedIdentityUnreadable,
            "restore target full hash is missing",
        ));
    }
    let actual = crate::fs_safety::capture_identity(target, None).map_err(|error| {
        crate::recovery::RecoveryFailure::new(
            crate::recovery::RecoveryErrorCode::TargetCommittedIdentityUnreadable,
            format!("restore target identity could not be read: {error}"),
        )
    })?;
    if !crate::fs_safety::identity_matches(&expected, &actual) {
        return Err(crate::recovery::RecoveryFailure::new(
            crate::recovery::RecoveryErrorCode::TargetCommittedIdentityMismatch,
            "restore target identity does not match the operation journal",
        ));
    }
    Ok(())
}

pub(crate) fn validate_operation_restore_final_identity(
    log: &OperationLogDto,
) -> Result<(), String> {
    operation_restore_final_identity_check(log).map_err(|failure| failure.message())
}

fn persist_pending_operation_journal(
    db: &Database,
    request: &ExecuteMovesRequest,
    batch_id: &str,
    created_at: &str,
) -> Result<std::collections::HashMap<String, PreparedOperation>, String> {
    let logs = request
        .operations
        .iter()
        .enumerate()
        .map(|(index, operation)| {
            let fingerprint = file_identity_fingerprint(Path::new(&operation.source_path))
                .map_err(|error| format!("cannot journal source identity: {error}"))?;
            let claim_path = crate::fs_safety::source_claim::planned_claim_path(
                Path::new(&operation.source_path),
                &operation.id,
            )
            .map_err(|error| format!("cannot plan source claim: {error}"))?;
            let mut log = make_operation_log(
                batch_id,
                created_at,
                index,
                operation,
                "pending",
                None,
                operation.target_path.clone(),
            );
            apply_source_fingerprint(&mut log, &fingerprint);
            log.source_claim_path = Some(normalize_path(&claim_path));
            log.claim_created_at = Some(created_at.to_string());
            log.claim_platform_file_id = fingerprint.platform_file_id.clone();
            log.claim_platform_volume_id = fingerprint.platform_volume_id.clone();
            log.claim_full_hash = fingerprint.full_hash.clone();
            log.operation_phase = "prepared".to_string();
            let journal_log = log.clone();
            Ok((
                log,
                PreparedOperation {
                    fingerprint,
                    #[cfg(any(test, feature = "native-qa"))]
                    source_path: PathBuf::from(&operation.source_path),
                    claim_path,
                    claim_created_at: created_at.to_string(),
                    journal_log,
                },
            ))
        })
        .collect::<Result<Vec<_>, String>>()?;
    let fingerprints = logs
        .iter()
        .zip(request.operations.iter())
        .map(|((_, prepared), operation)| (operation.id.clone(), prepared.clone()))
        .collect::<std::collections::HashMap<_, _>>();
    let logs = logs.into_iter().map(|(log, _)| log).collect::<Vec<_>>();
    db.save_operation_logs(batch_id, &logs).map_err(|error| {
        format!("failed to persist operation journal before execution: {error}")
    })?;
    #[cfg(any(test, feature = "native-qa"))]
    for prepared in fingerprints.values() {
        crate::fs_safety::source_claim::run_claim_test_hook(
            crate::fs_safety::source_claim::ClaimTestPoint::AfterJournalPreparedBeforeClaim,
            &prepared.source_path,
            &prepared.claim_path,
        );
    }
    Ok(fingerprints)
}

pub fn reconcile_pending_operation_journal(db: &Database) -> Result<usize, String> {
    let pending = db
        .get_pending_operation_logs()
        .map_err(|error| error.to_string())?;
    let pending_restores = db
        .get_pending_restore_logs()
        .map_err(|error| error.to_string())?;
    let mut by_batch = std::collections::HashMap::<String, Vec<OperationLogDto>>::new();
    for mut log in pending {
        let before = Path::new(&log.path_before);
        let after = Path::new(&log.path_after);
        let claim = log.source_claim_path.as_deref().map(Path::new);
        let before_state =
            operation_journal_path_state(before, |path| journal_identity_matches(&log, path));
        let after_state =
            operation_journal_path_state(after, |path| journal_target_identity_matches(&log, path));
        let claim_state = claim.map_or(OperationJournalPathState::Missing, |path| {
            operation_journal_path_state(path, |candidate| {
                journal_identity_matches(&log, candidate)
            })
        });
        match (before_state, after_state, claim_state) {
            (
                OperationJournalPathState::Missing,
                OperationJournalPathState::Matches,
                OperationJournalPathState::Missing,
            ) if matches!(
                log.operation_phase.as_str(),
                "target_committed" | "source_cleanup_pending"
            ) =>
            {
                log.status = "manual_review".to_string();
                log.operation_phase = if log.operation_phase == "source_cleanup_pending" {
                    "source_cleanup_pending"
                } else {
                    "target_committed"
                }
                .to_string();
                log.can_undo = false;
                log.can_restore = false;
                log.error_message = Some(
                    "target_committed_durability_unknown: target may have committed; verify the target before retrying."
                        .to_string(),
                );
            }
            (
                OperationJournalPathState::Missing,
                OperationJournalPathState::Matches,
                OperationJournalPathState::Missing,
            ) => {
                log.status = "success".to_string();
                log.operation_phase = "completed".to_string();
                log.can_undo = log.operation_type != "move_to_trash";
                log.can_restore = log.can_undo;
                log.error_message =
                    Some("Recovered an interrupted operation journal after restart.".to_string());
            }
            (
                OperationJournalPathState::Matches,
                OperationJournalPathState::Missing,
                OperationJournalPathState::Missing,
            ) => {
                log.status = "failed".to_string();
                log.operation_phase = "rolled_back".to_string();
                log.can_undo = false;
                log.can_restore = false;
                log.error_message = Some(
                    "Operation was interrupted before the filesystem move; the source remains intact."
                        .to_string(),
                );
            }
            (
                OperationJournalPathState::Missing,
                OperationJournalPathState::Missing,
                OperationJournalPathState::Matches,
            ) => {
                log.status = "pending".to_string();
                log.operation_phase = "source_claimed".to_string();
                log.can_undo = false;
                log.can_restore = false;
                log.error_message = Some(
                    "Source claim was recovered without a committed target; manual review is required."
                        .to_string(),
                );
            }
            (
                OperationJournalPathState::Missing,
                OperationJournalPathState::Matches,
                OperationJournalPathState::Matches,
            ) => {
                log.status = "manual_review".to_string();
                log.operation_phase = "source_cleanup_pending".to_string();
                log.can_undo = false;
                log.can_restore = false;
                log.error_message = Some(
                    "Committed target and source claim were recovered together; source cleanup requires manual review."
                        .to_string(),
                );
            }
            _ => {
                log.status = "manual_review".to_string();
                log.operation_phase = "manual_review".to_string();
                log.can_undo = false;
                log.can_restore = false;
                log.error_message = Some(
                    "Interrupted operation has ambiguous or replaced identities; manual review is required."
                        .to_string(),
                );
            }
        }
        by_batch.entry(log.batch_id.clone()).or_default().push(log);
    }
    let mut reconciled = by_batch.values().map(Vec::len).sum::<usize>();
    for (batch_id, logs) in by_batch {
        db.save_operation_logs(&batch_id, &logs)
            .map_err(|error| error.to_string())?;
    }
    if !pending_restores.is_empty() {
        for mut log in pending_restores {
            let before = Path::new(&log.path_before);
            let after = Path::new(&log.path_after);
            let claim = log.restore_claim_path.as_deref().map(Path::new);
            let source_path_reappeared = fs::symlink_metadata(after).is_ok();
            let before_state = operation_journal_path_state(before, |path| {
                operation_restore_original_identity_matches(&log, path)
            });
            let after_state = operation_journal_path_state(after, |path| {
                operation_restore_identity_matches(&log, path)
            });
            let claim_state = claim.map_or(OperationJournalPathState::Missing, |path| {
                operation_journal_path_state(path, |candidate| {
                    restore_claim_identity_matches(&log, candidate)
                })
            });

            if before_state == OperationJournalPathState::Matches
                && after_state == OperationJournalPathState::Missing
                && claim_state == OperationJournalPathState::Missing
            {
                log.can_undo = false;
                log.can_restore = false;
                log.restored_at = Some(current_timestamp_ms().to_string());
                log.restore_status = "restored".to_string();
                log.restore_phase = "completed".to_string();
                log.restore_error = None;
                if let Err(failure) = operation_restore_final_identity_check(&log) {
                    log.restored_at = None;
                    set_restore_manual_review(
                        &mut log,
                        "target_committed",
                        failure.code,
                        failure.detail,
                    );
                    db.finalize_operation_restore_outcome(std::slice::from_ref(&log))
                        .map_err(|persist_error| persist_error.to_string())?;
                } else if let Err(error) = db.finalize_successful_operation_restore(&log) {
                    log.restored_at = None;
                    set_restore_manual_review(
                        &mut log,
                        "target_committed",
                        crate::recovery::RecoveryErrorCode::TargetCommittedDurabilityUnknown,
                        format!(
                            "restore was committed but final reconciliation transaction failed: {error}; do not auto retry"
                        ),
                    );
                    db.finalize_operation_restore_outcome(std::slice::from_ref(&log))
                        .map_err(|persist_error| persist_error.to_string())?;
                }
                reconciled += 1;
                continue;
            }

            let target_commit_observed = before_state == OperationJournalPathState::Matches
                || matches!(
                    log.restore_phase.as_str(),
                    "target_committed" | "source_cleanup_pending" | "completed"
                );
            if source_path_reappeared && target_commit_observed {
                set_restore_manual_review(
                    &mut log,
                    "source_cleanup_pending",
                    crate::recovery::RecoveryErrorCode::RestoreSourcePathReappeared,
                    "restore source path reappeared after the target commit; preserve the claim and review both paths",
                );
            } else if matches!(
                claim_state,
                OperationJournalPathState::Mismatch | OperationJournalPathState::Unreadable
            ) {
                let code = if claim_state == OperationJournalPathState::Unreadable {
                    crate::recovery::RecoveryErrorCode::ClaimIdentityUnreadable
                } else {
                    crate::recovery::RecoveryErrorCode::ClaimIdentityMismatch
                };
                set_restore_manual_review(
                    &mut log,
                    if before_state == OperationJournalPathState::Matches {
                        "target_committed"
                    } else {
                        "source_claimed"
                    },
                    code,
                    "persisted restore claim identity is mismatched or unreadable; do not auto retry.",
                );
            } else if before_state == OperationJournalPathState::Mismatch
                || before_state == OperationJournalPathState::Unreadable
            {
                let code = if before_state == OperationJournalPathState::Unreadable {
                    crate::recovery::RecoveryErrorCode::TargetCommittedIdentityUnreadable
                } else {
                    crate::recovery::RecoveryErrorCode::TargetCommittedIdentityMismatch
                };
                set_restore_manual_review(
                    &mut log,
                    "target_committed",
                    code,
                    "restore target or source identity is mismatched or unreadable; do not auto retry.",
                );
            } else if after_state == OperationJournalPathState::Mismatch
                || after_state == OperationJournalPathState::Unreadable
            {
                let code = if after_state == OperationJournalPathState::Unreadable {
                    crate::recovery::RecoveryErrorCode::RestoreSourceIdentityUnreadable
                } else {
                    crate::recovery::RecoveryErrorCode::RestoreSourceIdentityMismatch
                };
                set_restore_manual_review(
                    &mut log,
                    "target_committed",
                    code,
                    "restore source identity cannot be trusted; do not auto retry",
                );
            } else if before_state == OperationJournalPathState::Matches
                && after_state == OperationJournalPathState::Missing
                && claim_state == OperationJournalPathState::Matches
            {
                set_restore_manual_review(
                    &mut log,
                    "source_cleanup_pending",
                    crate::recovery::RecoveryErrorCode::TargetCommittedSourceCleanupPending,
                    "restored target and restore claim both exist; do not auto retry source cleanup.",
                );
            } else if before_state == OperationJournalPathState::Missing
                && after_state == OperationJournalPathState::Matches
                && claim_state == OperationJournalPathState::Missing
            {
                log.status = "success".to_string();
                log.can_undo = true;
                log.can_restore = true;
                log.restore_status = "not_restored".to_string();
                log.restore_phase = "rolled_back".to_string();
                log.restore_error = Some(crate::recovery::format_recovery_message(
                    crate::recovery::RecoveryErrorCode::RestorePendingReconciliation,
                    "restore was interrupted before filesystem commit; it remains available and will not be auto-retried",
                ));
                clear_restore_claim(&mut log);
            } else if before_state == OperationJournalPathState::Missing
                && after_state == OperationJournalPathState::Missing
                && claim_state == OperationJournalPathState::Matches
            {
                log.status = "manual_review".to_string();
                log.can_undo = false;
                log.can_restore = false;
                log.restore_status = "manual_review".to_string();
                log.restore_phase = "source_claimed".to_string();
                log.restore_error = Some(
                    "restore_pending_reconciliation: restore source claim was recovered without a committed target; do not auto retry."
                        .to_string(),
                );
            } else {
                set_restore_manual_review(
                    &mut log,
                    "target_committed",
                    crate::recovery::RecoveryErrorCode::TargetCommittedDurabilityUnknown,
                    "restore path state is ambiguous after the filesystem boundary; preserve the claim and do not auto retry",
                );
            }
            db.finalize_operation_restore_outcome(std::slice::from_ref(&log))
                .map_err(|error| error.to_string())?;
            reconciled += 1;
        }
    }
    Ok(reconciled)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum OperationJournalPathState {
    Missing,
    Matches,
    Mismatch,
    Unreadable,
}

fn operation_journal_path_state(
    path: &Path,
    identity_matches: impl FnOnce(&Path) -> Result<bool, ()>,
) -> OperationJournalPathState {
    classify_operation_journal_path_state(fs::symlink_metadata(path), || identity_matches(path))
}

fn classify_operation_journal_path_state(
    metadata: Result<fs::Metadata, io::Error>,
    identity_matches: impl FnOnce() -> Result<bool, ()>,
) -> OperationJournalPathState {
    match metadata {
        Ok(_) => match identity_matches() {
            Ok(true) => OperationJournalPathState::Matches,
            Ok(false) => OperationJournalPathState::Mismatch,
            Err(()) => OperationJournalPathState::Unreadable,
        },
        Err(error) if error.kind() == io::ErrorKind::NotFound => OperationJournalPathState::Missing,
        Err(_) => OperationJournalPathState::Unreadable,
    }
}

#[command]
pub fn reveal_in_folder(path: String) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Path cannot be empty.".to_string());
    }

    let command = build_reveal_command(Path::new(trimmed))?;
    ProcessCommand::new(command.program)
        .args(&command.args)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Failed to reveal path in file manager: {error}"))
}

pub fn rename_file(source_path: String, new_name: String) -> Result<FileOperationResult, String> {
    crate::fs_safety::platform_support::ensure_supported_file_mutation()
        .map_err(|error| error.to_string())?;
    rename_file_with_identity(source_path, new_name, None, None, None, None)
        .map_err(|error| error.to_string())
}

fn rename_file_with_identity(
    source_path: String,
    new_name: String,
    expected_identity: Option<&crate::fs_safety::ExpectedFileIdentity>,
    cancel_flag: Option<&AtomicBool>,
    planned_claim_path: Option<&Path>,
    phase_observer: Option<&mut crate::fs_safety::PhaseObserver<'_>>,
) -> Result<FileOperationResult, FileMutationError> {
    validate_safe_file_name(&new_name)?;
    let source = validate_source_path(&PathBuf::from(source_path))?;
    let parent = source
        .parent()
        .ok_or(FileOpError::TargetParentMissing)
        .map_err(|error| error.to_string())?;
    let target = parent.join(new_name);

    if target.exists() {
        return Err(FileMutationError::Validation(
            FileOpError::TargetExists.to_string(),
        ));
    }

    ensure_general_file_operation_allowed(&source)?;
    ensure_general_file_operation_allowed(&target)?;
    move_file_no_overwrite_with_identity(
        &source,
        &target,
        expected_identity,
        planned_claim_path,
        cancel_flag,
        phase_observer,
    )?;

    Ok(FileOperationResult {
        operation: "rename".to_string(),
        source_path: normalize_path(&source),
        target_path: normalize_path(&target),
    })
}

#[cfg(all(test, windows))]
fn execute_preview_operation(
    batch_id: &str,
    created_at: &str,
    index: usize,
    operation: &OperationPreviewRequest,
    cancel_flag: Option<&AtomicBool>,
) -> OperationLogDto {
    execute_preview_operation_with_app_data(
        batch_id,
        created_at,
        index,
        operation,
        OperationExecutionContext {
            cancel_flag,
            app_data_dir: None,
            expected_identity: None,
            planned_claim_path: None,
            phase_observer: None,
        },
    )
}

struct OperationExecutionContext<'a> {
    cancel_flag: Option<&'a AtomicBool>,
    app_data_dir: Option<&'a Path>,
    expected_identity: Option<&'a crate::fs_safety::ExpectedFileIdentity>,
    planned_claim_path: Option<&'a Path>,
    phase_observer: Option<&'a mut crate::fs_safety::PhaseObserver<'a>>,
}

fn execute_preview_operation_with_app_data(
    batch_id: &str,
    created_at: &str,
    index: usize,
    operation: &OperationPreviewRequest,
    context: OperationExecutionContext<'_>,
) -> OperationLogDto {
    let source_fingerprint = context
        .expected_identity
        .cloned()
        .map(|identity| FileIdentityFingerprint {
            size: identity.size,
            modified_ns: identity.modified_ns,
            platform_volume_id: identity.platform_volume_id,
            platform_file_id: identity.platform_file_id,
            quick_hash: identity.sample_hash,
            full_hash: identity.full_hash,
        })
        .or_else(|| file_identity_fingerprint(Path::new(&operation.source_path)).ok());
    let status = if operation.is_executable == Some(false) {
        Err(FileMutationError::Validation(
            "Operation is not executable.".to_string(),
        ))
    } else {
        match operation.operation_type.as_str() {
            "rename" => rename_file_with_identity(
                operation.source_path.clone(),
                operation.new_name.clone(),
                context.expected_identity,
                context.cancel_flag,
                context.planned_claim_path,
                context.phase_observer,
            ),
            "move" | "move_rename" => move_file_with_parent_policy_with_cancel_and_identity(
                operation.source_path.clone(),
                operation.target_path.clone(),
                true,
                context.cancel_flag,
                context.expected_identity,
                context.planned_claim_path,
                context.phase_observer,
            ),
            "move_to_trash" => move_to_trash_with_safety(
                operation.source_path.clone(),
                context.app_data_dir,
                context.expected_identity,
                context.planned_claim_path,
                &operation.id,
            ),
            other => Err(FileMutationError::Validation(format!(
                "Unsupported operation type: {other}"
            ))),
        }
    };

    let mut log = match status {
        Ok(result) => make_operation_log(
            batch_id,
            created_at,
            index,
            operation,
            "success",
            None,
            result.target_path,
        ),
        Err(error) if error.is_cancelled() => make_operation_log(
            batch_id,
            created_at,
            index,
            operation,
            "skipped",
            None,
            operation.target_path.clone(),
        ),
        Err(error) => {
            let requires_recovery = error.requires_recovery();
            let status = if operation.is_executable == Some(false) {
                "skipped"
            } else if requires_recovery {
                "manual_review"
            } else {
                "failed"
            };
            let mut log = make_operation_log(
                batch_id,
                created_at,
                index,
                operation,
                status,
                Some(error.to_string()),
                operation.target_path.clone(),
            );
            if requires_recovery {
                log.operation_phase = error.journal_phase().to_string();
                log.can_undo = false;
                log.can_restore = false;
            }
            log
        }
    };
    if let Some(fingerprint) = source_fingerprint.as_ref() {
        apply_source_fingerprint(&mut log, fingerprint);
    }
    if log.status == "success" {
        if let Ok(target_fingerprint) = file_identity_fingerprint(Path::new(&log.path_after)) {
            log.target_platform_file_id = target_fingerprint.platform_file_id;
            log.target_platform_volume_id = target_fingerprint.platform_volume_id;
            log.target_full_hash = target_fingerprint.full_hash;
        }
    }
    log
}

#[command]
pub async fn restore_moves<R: Runtime>(
    window: WebviewWindow<R>,
    app: AppHandle<R>,
    db: State<'_, Database>,
    cancel: State<'_, OperationCancellationToken>,
    request: RestoreMovesByIdRequest,
) -> Result<RestoreMovesResult, String> {
    require_main_window(&window)?;
    let db = db.inner().clone();
    let requested_count = request.log_ids.len();
    let logs = db
        .get_restorable_operation_logs_by_ids(&request.log_ids)
        .map_err(|error| error.to_string())?;
    if logs.len() != requested_count {
        return Err(
            "One or more operation log IDs are missing or no longer restorable.".to_string(),
        );
    }
    let request = RestoreMovesRequest { logs };
    let guard = cancel.begin()?;
    let cancel_flag = Arc::clone(&cancel.cancel);
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = guard;
        let emitter = TauriOperationProgressEmitter::new(app);
        restore_moves_with_persistence_with_progress(&db, request, cancel_flag, &emitter)
    })
    .await
    .map_err(|error| format!("restore task failed: {error}"))?
}

pub fn restore_moves_with_persistence(
    db: &Database,
    request: RestoreMovesRequest,
) -> Result<RestoreMovesResult, String> {
    restore_moves_with_persistence_with_progress(
        db,
        request,
        Arc::new(AtomicBool::new(false)),
        &NoopOperationProgressEmitter,
    )
}

fn restore_moves_with_persistence_with_progress(
    db: &Database,
    request: RestoreMovesRequest,
    cancel_flag: Arc<AtomicBool>,
    emitter: &impl OperationProgressEmitter,
) -> Result<RestoreMovesResult, String> {
    crate::fs_safety::platform_support::ensure_supported_file_mutation()
        .map_err(|error| error.to_string())?;
    if request.logs.iter().any(restore_requires_reconciliation) {
        return Err(
            "restore_pending_reconciliation: an active restore journal requires startup reconciliation before retrying."
                .to_string(),
        );
    }
    let mut prepared_logs = Vec::with_capacity(request.logs.len());
    let restore_claim_created_at = current_timestamp_ms().to_string();
    for log in &request.logs {
        let source = Path::new(&log.path_after);
        let claim_path = plan_restore_claim_path(source, &log.id)
            .map_err(|error| format!("cannot plan restore claim for {}: {error}", log.id))?;
        let expected_identity = expected_restore_identity_from_log(log).ok_or_else(|| {
            format!(
                "cannot prepare restore claim for {}: restore identity is incomplete",
                log.id
            )
        })?;
        let mut prepared = log.clone();
        prepared.restore_status = "pending".to_string();
        prepared.restore_phase = "prepared".to_string();
        prepared.restore_error = None;
        prepared.restore_claim_path = Some(normalize_path(&claim_path));
        prepared.restore_claim_created_at = Some(restore_claim_created_at.clone());
        prepared.restore_claim_platform_file_id = expected_identity.platform_file_id.clone();
        prepared.restore_claim_platform_volume_id = expected_identity.platform_volume_id.clone();
        prepared.restore_claim_full_hash = expected_identity.full_hash.clone();
        prepared_logs.push(prepared);
    }
    db.prepare_operation_restores(&prepared_logs)
        .map_err(|error| format!("failed to persist restore journal before execution: {error}"))?;
    #[cfg(any(test, feature = "native-qa"))]
    if take_operation_test_fault(OperationTestFaultPoint::AfterRestoreJournalPreparedBeforeClaim) {
        panic!("AfterRestoreJournalPreparedBeforeClaim");
    }
    let mut restored = 0_usize;
    let mut failed = 0_usize;
    let batch_id = restore_progress_batch_id(&request.logs);
    let total = request.logs.len() as u64;
    let mut progress = OperationProgressBuffer::new("restore", batch_id, total);
    let mut logs = Vec::with_capacity(request.logs.len());
    for (index, log) in prepared_logs.iter().enumerate() {
        let mut phase_log = log.clone();
        let mut phase_observer =
            |phase: &str| {
                phase_log.restore_phase = phase.to_string();
                phase_log.restore_status = "pending".to_string();
                phase_log.restore_error = None;
                db.update_operation_restore_phase(&phase_log)
                    .map_err(|error| {
                        if matches!(
                            phase,
                            "target_committed" | "source_cleanup_pending" | "completed"
                        ) {
                            crate::fs_safety::AtomicMoveError::TargetCommittedDurabilityUnknown
                        } else {
                            crate::fs_safety::AtomicMoveError::SourceClaimRecoveryRequired(format!(
                                "restore journal phase persistence failed: {error}"
                            ))
                        }
                    })?;
                #[cfg(any(test, feature = "native-qa"))]
            match phase {
                "source_claimed"
                    if take_operation_test_fault(
                        OperationTestFaultPoint::AfterRestoreSourceClaimedBeforeTargetCommit,
                    ) => panic!("AfterRestoreSourceClaimedBeforeTargetCommit"),
                "target_committed"
                    if take_operation_test_fault(
                        OperationTestFaultPoint::AfterRestoreTargetCommittedBeforeFinalPersist,
                    ) => panic!("AfterRestoreTargetCommittedBeforeFinalPersist"),
                "completed"
                    if take_operation_test_fault(
                        OperationTestFaultPoint::AfterRestoreCompletedPhaseBeforeFinalTransaction,
                    ) => panic!("AfterRestoreCompletedPhaseBeforeFinalTransaction"),
                _ => {}
            }
                Ok(())
            };
        let result = if is_operation_cancelled(&cancel_flag) {
            mark_restore_canceled(log)
        } else {
            restore_operation_log_with_observer(
                log,
                Some(cancel_flag.as_ref()),
                Some(&mut phase_observer),
            )
        };
        let result = if result.restore_status == "restored" {
            if let Err(failure) = operation_restore_final_identity_check(&result) {
                let mut review = result;
                review.restored_at = None;
                set_restore_manual_review(
                    &mut review,
                    "target_committed",
                    failure.code,
                    failure.detail,
                );
                db.finalize_operation_restore_outcome(std::slice::from_ref(&review))
                    .map_err(|persist_error| {
                        format!("restore finalization requires reconciliation: {persist_error}")
                    })?;
                failed += 1;
                review
            } else {
                match db.finalize_successful_operation_restore(&result) {
                    Ok(()) => {
                        restored += 1;
                        let mut finalized = result;
                        finalized.restore_claim_path = None;
                        finalized.restore_claim_created_at = None;
                        finalized.restore_claim_platform_file_id = None;
                        finalized.restore_claim_platform_volume_id = None;
                        finalized.restore_claim_full_hash = None;
                        finalized
                    }
                    Err(error) => {
                        let mut review = result;
                        review.restored_at = None;
                        set_restore_manual_review(
                            &mut review,
                            "target_committed",
                            crate::recovery::RecoveryErrorCode::TargetCommittedDurabilityUnknown,
                            format!(
                                "restore filesystem commit succeeded but final journal transaction failed: {error}; do not auto retry"
                            ),
                        );
                        db.finalize_operation_restore_outcome(std::slice::from_ref(&review))
                            .map_err(|persist_error| {
                                format!(
                                    "restore finalization requires reconciliation: {persist_error}"
                                )
                            })?;
                        failed += 1;
                        review
                    }
                }
            }
        } else {
            if matches!(result.restore_status.as_str(), "failed" | "manual_review") {
                failed += 1;
            }
            db.finalize_operation_restore_outcome(std::slice::from_ref(&result))
                .map_err(|error| {
                    format!("restore outcome transaction failed; reconciliation required: {error}")
                })?;
            result
        };
        progress.record(emitter, (index + 1) as u64, log.path_after.clone());
        logs.push(result);
    }
    Ok(RestoreMovesResult {
        logs,
        restored,
        failed,
    })
}

fn restore_requires_reconciliation(log: &OperationLogDto) -> bool {
    (log.restore_status == "pending" && log.restore_phase != "prepared")
        || (log.restore_status == "manual_review"
            && restore_phase_requires_recovery(&log.restore_phase))
}

pub fn restore_moves_core(request: RestoreMovesRequest) -> RestoreMovesResult {
    restore_moves_core_with_progress(
        request,
        Arc::new(AtomicBool::new(false)),
        &NoopOperationProgressEmitter,
    )
}

pub fn restore_moves_core_with_progress(
    request: RestoreMovesRequest,
    cancel_flag: Arc<AtomicBool>,
    emitter: &impl OperationProgressEmitter,
) -> RestoreMovesResult {
    let mut restored = 0_usize;
    let mut failed = 0_usize;
    let batch_id = restore_progress_batch_id(&request.logs);
    let total = request.logs.len() as u64;
    let mut progress = OperationProgressBuffer::new("restore", batch_id, total);
    let mut logs = Vec::with_capacity(request.logs.len());

    for (index, log) in request.logs.iter().enumerate() {
        let result = if is_operation_cancelled(&cancel_flag) {
            mark_restore_canceled(log)
        } else {
            restore_operation_log(log, Some(cancel_flag.as_ref()))
        };
        if result.restore_status == "restored" {
            restored += 1;
        } else if matches!(result.restore_status.as_str(), "failed" | "manual_review") {
            failed += 1;
        }
        let current_path = log.path_after.clone();
        logs.push(result);
        progress.record(emitter, (index + 1) as u64, current_path);
    }

    RestoreMovesResult {
        logs,
        restored,
        failed,
    }
}

fn make_canceled_operation_log(
    batch_id: &str,
    created_at: &str,
    index: usize,
    operation: &OperationPreviewRequest,
) -> OperationLogDto {
    make_operation_log(
        batch_id,
        created_at,
        index,
        operation,
        "skipped",
        None,
        operation.target_path.clone(),
    )
}

fn make_operation_log(
    batch_id: &str,
    created_at: &str,
    index: usize,
    operation: &OperationPreviewRequest,
    status: &str,
    error_message: Option<String>,
    actual_target_path: String,
) -> OperationLogDto {
    let success = status == "success";
    let trash_operation = operation.operation_type == "move_to_trash";
    let can_restore = success && !trash_operation;
    let restore_status = if trash_operation && success {
        "unavailable"
    } else {
        "not_restored"
    };
    let restore_error = if trash_operation && success {
        Some("Restore from system trash.".to_string())
    } else {
        None
    };
    OperationLogDto {
        id: format!("{batch_id}-{index}-{}", operation.id),
        batch_id: batch_id.to_string(),
        operation_type: operation.operation_type.clone(),
        source_path: operation.source_path.clone(),
        target_path: actual_target_path.clone(),
        old_name: operation.old_name.clone(),
        new_name: operation.new_name.clone(),
        status: status.to_string(),
        error_message,
        created_at: created_at.to_string(),
        can_undo: can_restore,
        path_before: operation.source_path.clone(),
        path_after: actual_target_path,
        name_before: operation.old_name.clone(),
        name_after: operation.new_name.clone(),
        can_restore,
        restored_at: None,
        restore_status: restore_status.to_string(),
        restore_error,
        source_size: None,
        source_modified_ns: None,
        source_platform_file_id: None,
        source_platform_volume_id: None,
        source_quick_hash: None,
        source_full_hash: None,
        target_platform_file_id: None,
        target_platform_volume_id: None,
        target_full_hash: None,
        source_claim_path: None,
        operation_phase: if status == "pending" {
            "prepared".to_string()
        } else {
            "completed".to_string()
        },
        claim_created_at: None,
        claim_platform_file_id: None,
        claim_platform_volume_id: None,
        claim_full_hash: None,
        restore_claim_path: None,
        restore_phase: "idle".to_string(),
        restore_claim_created_at: None,
        restore_claim_platform_file_id: None,
        restore_claim_platform_volume_id: None,
        restore_claim_full_hash: None,
    }
}

fn append_operation_log_error(log: &mut OperationLogDto, message: String) {
    log.error_message = Some(match log.error_message.take() {
        Some(existing) if !existing.trim().is_empty() => format!("{existing}; {message}"),
        _ => message,
    });
}

fn operation_phase_for_log(log: &OperationLogDto) -> &'static str {
    if log.status == "success" {
        return "completed";
    }
    match log.operation_phase.as_str() {
        "prepared" => "prepared",
        "source_claimed" => "source_claimed",
        "copying" => "copying",
        "target_committed" => "target_committed",
        "source_cleanup_pending" => "source_cleanup_pending",
        "manual_review" => "manual_review",
        "rolled_back" => "rolled_back",
        _ if log.status == "pending" => "prepared",
        _ => "rolled_back",
    }
}

fn restore_operation_log(
    log: &OperationLogDto,
    cancel_flag: Option<&AtomicBool>,
) -> OperationLogDto {
    restore_operation_log_with_observer(log, cancel_flag, None)
}

fn restore_operation_log_with_observer(
    log: &OperationLogDto,
    cancel_flag: Option<&AtomicBool>,
    phase_observer: Option<&mut crate::fs_safety::PhaseObserver<'_>>,
) -> OperationLogDto {
    if log.operation_type == "move_to_trash" {
        return mark_restore_unavailable(log, "Restore from system trash.");
    }
    if log.status != "success" {
        return mark_restore_unavailable(log, "Only successful operations can be restored.");
    }
    if !log.can_restore || log.restore_status == "restored" {
        return mark_restore_unavailable(log, "This operation is no longer restorable.");
    }
    if restore_requires_reconciliation(log) {
        return mark_restore_manual_review(
            log,
            "restore_pending_reconciliation: this restore has an active claim or committed-target phase; do not auto retry.",
        );
    }
    if log.path_before.trim().is_empty() || log.path_after.trim().is_empty() {
        return mark_restore_failed(log, "Restore metadata is incomplete.");
    }
    if let Err(failure) = operation_restore_identity_result(log, Path::new(&log.path_after)) {
        return mark_restore_manual_review(log, failure.message());
    }

    let source = match validate_source_path(&PathBuf::from(&log.path_after)) {
        Ok(path) => path,
        Err(error) => return mark_restore_failed(log, error),
    };
    let restore_claim_path = match log.restore_claim_path.as_deref() {
        Some(path) => PathBuf::from(path),
        None => match plan_restore_claim_path(&source, &log.id) {
            Ok(path) => path,
            Err(error) => return mark_restore_failed(log, error),
        },
    };
    if let Err(error) = validate_restore_claim_path(&source, &restore_claim_path) {
        return mark_restore_manual_review(log, format!("claim_identity_mismatch: {error}"));
    }
    let target = match validate_target_path(&PathBuf::from(&log.path_before)) {
        Ok(path) => path,
        Err(error) => return mark_restore_failed(log, error),
    };

    if let Err(error) = ensure_general_file_operation_allowed(&source) {
        return mark_restore_failed(log, error);
    }
    if let Err(error) = ensure_general_file_operation_allowed(&target) {
        return mark_restore_failed(log, error);
    }
    let expected_identity = expected_restore_identity_from_log(log);
    if let Err(error) = move_file_no_overwrite_with_identity(
        &source,
        &target,
        expected_identity.as_ref(),
        Some(&restore_claim_path),
        cancel_flag,
        phase_observer,
    ) {
        if error.is_cancelled() {
            return mark_restore_canceled(log);
        }
        return if error.requires_recovery() {
            mark_restore_manual_review(log, error.to_string())
        } else {
            mark_restore_failed(log, error.to_string())
        };
    }

    let mut restored = log.clone();
    restored.can_undo = false;
    restored.can_restore = false;
    restored.restored_at = Some(current_timestamp_ms().to_string());
    restored.restore_status = "restored".to_string();
    restored.restore_error = None;
    restored.restore_phase = "completed".to_string();
    restored
}

fn validate_restore_claim_path(source: &Path, claim: &Path) -> Result<(), String> {
    if !claim.is_absolute() {
        return Err("restore claim path must be absolute".to_string());
    }
    let claim_name = claim
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "restore claim path has no valid file name".to_string())?;
    if !claim_name.starts_with(".zen-canvas-claim-") {
        return Err("restore claim path is outside the claim namespace".to_string());
    }
    let source_parent = source
        .parent()
        .ok_or_else(|| "restore source has no parent".to_string())?;
    let claim_parent = claim
        .parent()
        .ok_or_else(|| "restore claim has no parent".to_string())?
        .canonicalize()
        .map_err(|error| format!("restore claim parent is unavailable: {error}"))?;
    if normalize_path(&claim_parent) != normalize_path(source_parent) {
        return Err("restore claim path is not adjacent to the restore source".to_string());
    }
    Ok(())
}

fn plan_restore_claim_path(source: &Path, operation_id: &str) -> Result<PathBuf, String> {
    if let Ok(path) = crate::fs_safety::source_claim::planned_claim_path(source, operation_id) {
        return Ok(path);
    }
    let parent = source
        .parent()
        .filter(|path| path.is_absolute())
        .ok_or_else(|| "restore source has no absolute parent".to_string())?;
    Ok(parent.join(format!(".zen-canvas-claim-{}", uuid::Uuid::new_v4())))
}

fn mark_restore_failed(log: &OperationLogDto, error: impl Into<String>) -> OperationLogDto {
    let mut failed = log.clone();
    failed.restore_status = "failed".to_string();
    failed.restore_error = Some(error.into());
    if !restore_phase_requires_recovery(&failed.restore_phase) {
        failed.restore_phase = "rolled_back".to_string();
        clear_restore_claim(&mut failed);
    }
    failed
}

fn mark_restore_canceled(log: &OperationLogDto) -> OperationLogDto {
    let mut canceled = log.clone();
    if restore_phase_requires_recovery(&canceled.restore_phase) {
        return mark_restore_manual_review(
            log,
            "restore_pending_reconciliation: restore cancellation occurred after the source claim boundary; do not auto retry.",
        );
    }
    canceled.restore_status = "canceled".to_string();
    canceled.restore_error = None;
    canceled.restore_phase = "rolled_back".to_string();
    clear_restore_claim(&mut canceled);
    canceled
}

fn mark_restore_unavailable(log: &OperationLogDto, reason: impl Into<String>) -> OperationLogDto {
    let mut unavailable = log.clone();
    unavailable.can_undo = false;
    unavailable.can_restore = false;
    unavailable.restore_status = "unavailable".to_string();
    unavailable.restore_error = Some(reason.into());
    unavailable
}

fn restore_progress_batch_id(_logs: &[OperationLogDto]) -> String {
    new_job_id("restore-batch")
}

fn is_operation_cancelled(cancel_flag: &Arc<AtomicBool>) -> bool {
    cancel_flag.load(Ordering::Relaxed)
}

struct OperationProgressBuffer {
    kind: &'static str,
    batch_id: String,
    total: u64,
    last_emit_at: Instant,
    processed_since_emit: u64,
}

impl OperationProgressBuffer {
    fn new(kind: &'static str, batch_id: String, total: u64) -> Self {
        Self {
            kind,
            batch_id,
            total,
            last_emit_at: Instant::now(),
            processed_since_emit: 0,
        }
    }

    fn record(
        &mut self,
        emitter: &impl OperationProgressEmitter,
        processed: u64,
        current_path: String,
    ) {
        self.processed_since_emit += 1;
        let now = Instant::now();
        if processed == self.total
            || processed.is_multiple_of(OPERATION_PROGRESS_BATCH_SIZE)
            || self.processed_since_emit >= OPERATION_PROGRESS_BATCH_SIZE
            || now.duration_since(self.last_emit_at) >= OPERATION_PROGRESS_EMIT_INTERVAL
        {
            emitter.emit_progress(OperationProgressPayload {
                kind: self.kind.to_string(),
                batch_id: self.batch_id.clone(),
                processed,
                total: self.total,
                current_path,
            });
            self.last_emit_at = now;
            self.processed_since_emit = 0;
        }
    }
}

fn validate_source_path(path: &Path) -> Result<PathBuf, String> {
    if !path.is_absolute() {
        return Err(FileOpError::RelativePath.to_string());
    }
    if path.to_string_lossy().contains('\0')
        || path
            .components()
            .any(|component| component == Component::ParentDir)
    {
        return Err(FileOpError::UnsafePathTraversal.to_string());
    }
    if !path.exists() {
        return Err(FileOpError::SourceMissing.to_string());
    }
    let metadata =
        fs::symlink_metadata(path).map_err(|error| FileOpError::Io(error).to_string())?;
    if metadata.file_type().is_symlink() {
        return Err(FileOpError::ProtectedPath(normalize_path(path)).to_string());
    }

    let source = path
        .canonicalize()
        .map_err(|error| FileOpError::Io(error).to_string())?;
    if !source.is_file() {
        return Err(FileOpError::SourceNotFile.to_string());
    }
    ensure_general_file_operation_allowed(&source)?;

    Ok(source)
}

fn validate_target_path(path: &Path) -> Result<PathBuf, String> {
    validate_target_path_with_parent_policy(path, false)
}

fn validate_target_path_with_parent_policy(
    path: &Path,
    allow_create_parent: bool,
) -> Result<PathBuf, String> {
    if !path.is_absolute() {
        return Err(FileOpError::RelativePath.to_string());
    }
    if path.to_string_lossy().contains('\0') {
        return Err(FileOpError::UnsafePathTraversal.to_string());
    }
    if path
        .components()
        .any(|component| component == Component::ParentDir)
    {
        return Err(FileOpError::UnsafePathTraversal.to_string());
    }
    if path.exists() {
        return Err(FileOpError::TargetExists.to_string());
    }

    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or(FileOpError::UnsafeFileName)
        .map_err(|error| error.to_string())?;
    validate_safe_file_name(name)?;

    let parent = path
        .parent()
        .ok_or(FileOpError::TargetParentMissing)
        .map_err(|error| error.to_string())?;
    let existing_ancestor = canonicalize_nearest_existing_ancestor(parent)?;
    ensure_general_file_operation_allowed(&existing_ancestor)?;
    if !parent.exists() && !allow_create_parent {
        return Err(FileOpError::TargetParentMissing.to_string());
    }
    // The verified chain builder is the single parent-creation boundary.  A
    // second path-based call here used to reopen the same chain and widened
    // the TOCTOU window on Windows.
    crate::fs_safety::create_directory_chain_no_links(parent)
        .map_err(|error| format!("target parent rejected: {error}"))?;
    let parent = parent
        .canonicalize()
        .map_err(|_| FileOpError::TargetParentMissing.to_string())?;
    ensure_general_file_operation_allowed(&parent)?;

    Ok(parent.join(name))
}

fn mark_restore_manual_review(log: &OperationLogDto, error: impl Into<String>) -> OperationLogDto {
    let mut review = log.clone();
    let active = restore_phase_requires_recovery(&review.restore_phase);
    review.status = "manual_review".to_string();
    review.can_undo = false;
    review.can_restore = false;
    review.restore_status = "manual_review".to_string();
    if !active {
        review.restore_phase = "manual_review".to_string();
        clear_restore_claim(&mut review);
    }
    review.restore_error = Some(error.into());
    review
}

fn set_restore_manual_review(
    log: &mut OperationLogDto,
    phase: &str,
    code: crate::recovery::RecoveryErrorCode,
    detail: impl Into<String>,
) {
    log.status = "manual_review".to_string();
    log.can_undo = false;
    log.can_restore = false;
    log.restore_status = "manual_review".to_string();
    log.restore_phase = phase.to_string();
    log.restore_error = Some(crate::recovery::format_recovery_message(
        code,
        &detail.into(),
    ));
}

fn restore_phase_requires_recovery(phase: &str) -> bool {
    matches!(
        phase,
        "source_claimed" | "copying" | "target_committed" | "source_cleanup_pending" | "completed"
    )
}

fn clear_restore_claim(log: &mut OperationLogDto) {
    log.restore_claim_path = None;
    log.restore_claim_created_at = None;
    log.restore_claim_platform_file_id = None;
    log.restore_claim_platform_volume_id = None;
    log.restore_claim_full_hash = None;
}

fn canonicalize_nearest_existing_ancestor(path: &Path) -> Result<PathBuf, String> {
    let ancestor = path
        .ancestors()
        .find(|ancestor| ancestor.exists())
        .ok_or(FileOpError::TargetParentMissing)
        .map_err(|error| error.to_string())?;
    ancestor
        .canonicalize()
        .map_err(|error| FileOpError::Io(error).to_string())
}

fn move_file_with_parent_policy_with_cancel_and_identity(
    source_path: String,
    target_path: String,
    allow_create_parent: bool,
    cancel_flag: Option<&AtomicBool>,
    expected_identity: Option<&crate::fs_safety::ExpectedFileIdentity>,
    planned_claim_path: Option<&Path>,
    phase_observer: Option<&mut crate::fs_safety::PhaseObserver<'_>>,
) -> Result<FileOperationResult, FileMutationError> {
    let source = validate_source_path(&PathBuf::from(source_path))?;
    let target =
        validate_target_path_with_parent_policy(&PathBuf::from(target_path), allow_create_parent)?;

    ensure_general_file_operation_allowed(&source)?;
    ensure_general_file_operation_allowed(&target)?;
    move_file_no_overwrite_with_identity(
        &source,
        &target,
        expected_identity,
        planned_claim_path,
        cancel_flag,
        phase_observer,
    )?;

    Ok(FileOperationResult {
        operation: "move".to_string(),
        source_path: normalize_path(&source),
        target_path: normalize_path(&target),
    })
}

fn move_to_trash_with_safety(
    source_path: String,
    app_data_dir: Option<&Path>,
    expected_identity: Option<&crate::fs_safety::ExpectedFileIdentity>,
    planned_claim_path: Option<&Path>,
    operation_id: &str,
) -> Result<FileOperationResult, FileMutationError> {
    let source = validate_cleanup_trash_source(&PathBuf::from(source_path), app_data_dir)?;
    move_path_to_system_trash_with_safety(
        &source,
        expected_identity,
        planned_claim_path,
        operation_id,
    )?;

    Ok(FileOperationResult {
        operation: "move_to_trash".to_string(),
        source_path: normalize_path(&source),
        target_path: "Recycle Bin".to_string(),
    })
}

pub(crate) fn move_path_to_system_trash_with_safety(
    _source: &Path,
    _expected_identity: Option<&crate::fs_safety::ExpectedFileIdentity>,
    _planned_claim_path: Option<&Path>,
    _operation_id: &str,
) -> Result<(), String> {
    crate::fs_safety::platform_support::ensure_supported_cleanup_mutation()
        .map_err(|error| error.to_string())?;
    Err("system_trash_source_binding_unsupported".to_string())
}

fn validate_cleanup_trash_source(
    path: &Path,
    app_data_dir: Option<&Path>,
) -> Result<PathBuf, String> {
    if path.as_os_str().is_empty()
        || path.to_string_lossy().contains('\0')
        || path.to_string_lossy().contains('*')
        || path.to_string_lossy().contains('?')
        || path
            .components()
            .any(|component| component == Component::ParentDir)
        || path.parent().is_none()
        || path.file_name().is_none()
    {
        return Err(FileOpError::UnsafePathTraversal.to_string());
    }
    if !path.is_absolute() {
        return Err(FileOpError::RelativePath.to_string());
    }
    if !path.exists() {
        return Err(FileOpError::SourceMissing.to_string());
    }
    if fs::symlink_metadata(path)
        .map(|metadata| metadata.file_type().is_symlink())
        .unwrap_or(false)
    {
        return Err(FileOpError::ProtectedPath(normalize_path(path)).to_string());
    }

    let source = path
        .canonicalize()
        .map_err(|error| FileOpError::Io(error).to_string())?;
    ensure_cleanup_operation_allowed(&source, app_data_dir)?;
    Ok(source)
}

fn ensure_cleanup_operation_allowed(
    path: &Path,
    app_data_dir: Option<&Path>,
) -> Result<(), String> {
    if crate::storage_analyzer::is_cleanup_execution_forbidden(path, app_data_dir) {
        return Err(FileOpError::ProtectedPath(normalize_path(path)).to_string());
    }
    Ok(())
}

fn validate_safe_file_name(name: &str) -> Result<(), String> {
    let trimmed = name.trim();
    if trimmed.is_empty()
        || trimmed == "."
        || trimmed == ".."
        || trimmed.contains("..")
        || trimmed.ends_with('.')
        || trimmed.ends_with(' ')
        || trimmed.contains('\0')
        || trimmed.contains('/')
        || trimmed.contains('\\')
        || trimmed.chars().any(|ch| ch.is_control())
    {
        return Err(FileOpError::UnsafeFileName.to_string());
    }

    if cfg!(windows) {
        let stem = trimmed
            .split('.')
            .next()
            .unwrap_or_default()
            .to_ascii_lowercase();
        let reserved = [
            "con", "prn", "aux", "nul", "com1", "com2", "com3", "com4", "com5", "com6", "com7",
            "com8", "com9", "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
        ];
        if reserved.contains(&stem.as_str())
            || trimmed
                .chars()
                .any(|ch| matches!(ch, '<' | '>' | ':' | '"' | '|' | '?' | '*'))
        {
            return Err(FileOpError::UnsafeFileName.to_string());
        }
    }

    Ok(())
}

fn move_file_no_overwrite(source: &Path, target: &Path) -> Result<(), FileMutationError> {
    move_file_no_overwrite_with_identity(source, target, None, None, None, None)
}

fn move_file_no_overwrite_with_identity(
    source: &Path,
    target: &Path,
    expected_identity: Option<&crate::fs_safety::ExpectedFileIdentity>,
    planned_claim_path: Option<&Path>,
    cancel_flag: Option<&AtomicBool>,
    phase_observer: Option<&mut crate::fs_safety::PhaseObserver<'_>>,
) -> Result<(), FileMutationError> {
    crate::fs_safety::atomic_move::atomic_move_noreplace_with_claim_path_and_observer(
        source,
        target,
        expected_identity,
        planned_claim_path,
        cancel_flag,
        phase_observer,
    )
    .map(|_| ())
    .map_err(FileMutationError::Atomic)
}

#[cfg(all(test, windows))]
fn copy_then_delete_via_temp_with_cancel(
    source: &Path,
    target: &Path,
    cancel_flag: Option<&AtomicBool>,
) -> Result<(), String> {
    crate::fs_safety::copy_commit::copy_commit_move(source, target, None, cancel_flag)
        .map_err(|error| error.to_string())
}

#[cfg(all(test, windows))]
fn copy_stream_to_temp<R: Read, W: std::io::Write>(
    reader: &mut R,
    writer: &mut W,
    cancel_flag: Option<&AtomicBool>,
    buffer_size: usize,
) -> Result<u64, String> {
    let mut buffer = vec![0; buffer_size.max(1)];
    let mut copied = 0_u64;
    loop {
        if cancel_flag.is_some_and(|flag| flag.load(Ordering::Relaxed)) {
            return Err(crate::fs_safety::AtomicMoveError::Cancelled.to_string());
        }
        let bytes_read = reader
            .read(&mut buffer)
            .map_err(|error| FileOpError::Io(error).to_string())?;
        if bytes_read == 0 {
            return Ok(copied);
        }
        writer
            .write_all(&buffer[..bytes_read])
            .map_err(|error| FileOpError::Io(error).to_string())?;
        copied += bytes_read as u64;
        if cancel_flag.is_some_and(|flag| flag.load(Ordering::Relaxed)) {
            return Err(crate::fs_safety::AtomicMoveError::Cancelled.to_string());
        }
    }
}

fn ensure_general_file_operation_allowed(path: &Path) -> Result<(), String> {
    ensure_general_file_operation_allowed_for_os(path, env::consts::OS)
}

fn ensure_general_file_operation_allowed_for_os(path: &Path, os: &str) -> Result<(), String> {
    let current_temp = if os == "macos" {
        env::temp_dir().canonicalize().ok()
    } else {
        None
    };
    ensure_general_file_operation_allowed_for_os_with_temp(path, os, current_temp.as_deref())
}

fn ensure_general_file_operation_allowed_for_os_with_temp(
    path: &Path,
    os: &str,
    current_temp: Option<&Path>,
) -> Result<(), String> {
    let normalized = normalize_for_compare_for_os(path, os);
    let is_current_macos_temp = os == "macos"
        && current_temp.is_some_and(|temp| {
            let normalized_temp = normalize_for_compare_for_os(temp, os);
            normalized == normalized_temp || normalized.starts_with(&format!("{normalized_temp}/"))
        });

    for root in general_file_operation_protected_roots_for_os(os) {
        let protected = normalize_for_compare_for_os(&root, os);
        if normalized == protected || normalized.starts_with(&format!("{protected}/")) {
            if is_current_macos_temp {
                continue;
            }
            return Err(FileOpError::ProtectedPath(normalize_path(&root)).to_string());
        }
    }
    Ok(())
}

#[cfg(all(test, windows))]
fn general_file_operation_protected_roots() -> Vec<PathBuf> {
    general_file_operation_protected_roots_for_os(env::consts::OS)
}

fn general_file_operation_protected_roots_for_os(os: &str) -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if os == "windows" {
        let drive = env::var("SystemDrive").unwrap_or_else(|_| "C:".to_string());
        for dir in [
            "Windows",
            "Program Files",
            "Program Files (x86)",
            "ProgramData",
            "System Volume Information",
            "$Recycle.Bin",
            "$WINDOWS.~BT",
            "$WinREAgent",
            "Recovery",
        ] {
            roots.push(PathBuf::from(format!("{drive}\\{dir}")));
        }
    } else if os == "macos" {
        roots.extend([
            PathBuf::from("/System"),
            PathBuf::from("/Library"),
            PathBuf::from("/Applications"),
            PathBuf::from("/bin"),
            PathBuf::from("/sbin"),
            PathBuf::from("/usr"),
            PathBuf::from("/etc"),
            PathBuf::from("/private"),
        ]);
    } else {
        roots.extend([
            PathBuf::from("/bin"),
            PathBuf::from("/boot"),
            PathBuf::from("/dev"),
            PathBuf::from("/etc"),
            PathBuf::from("/lib"),
            PathBuf::from("/lib64"),
            PathBuf::from("/proc"),
            PathBuf::from("/root"),
            PathBuf::from("/run"),
            PathBuf::from("/sbin"),
            PathBuf::from("/sys"),
            PathBuf::from("/usr"),
            PathBuf::from("/var"),
        ]);
    }

    roots
}

fn build_reveal_command(path: &Path) -> Result<RevealCommand, String> {
    if path.as_os_str().is_empty() {
        return Err("Path cannot be empty.".to_string());
    }

    #[cfg(windows)]
    {
        return Ok(RevealCommand {
            program: "explorer",
            args: vec![format!(
                "/select,{}",
                path.to_string_lossy().replace('/', "\\")
            )],
        });
    }

    #[cfg(target_os = "macos")]
    {
        return Ok(RevealCommand {
            program: "open",
            args: vec!["-R".to_string(), path.to_string_lossy().into_owned()],
        });
    }

    #[allow(unreachable_code)]
    Err("Reveal in folder is not supported on this platform.".to_string())
}

fn normalize_for_compare_for_os(path: &Path, os: &str) -> String {
    let platform = match os {
        "windows" => PathPlatform::Windows,
        "macos" => PathPlatform::Macos,
        _ => PathPlatform::Unix,
    };
    normalize_text_for_platform(&normalize_path(path), platform)
}

fn current_timestamp_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use crate::db::{Database, InsertFileRequest};
    use std::{
        fs,
        sync::{
            atomic::{AtomicBool, AtomicU64, Ordering},
            Arc,
        },
        time::{Duration, SystemTime, UNIX_EPOCH},
    };

    static TEST_FIXTURE_COUNTER: AtomicU64 = AtomicU64::new(0);

    #[test]
    fn execute_selection_resolves_authoritative_paths_from_database() {
        let db = Database::open(test_db_path()).expect("open database");
        let root = test_dir();
        let source = root.join("source.txt");
        let target_dir = root.join("organized");
        fs::write(&source, "hello").expect("write source");
        insert_indexed_file(&db, &source, "source.txt", "txt");
        let file_id = source.to_string_lossy().into_owned();
        let metadata = fs::metadata(&source).expect("source metadata");
        let mtime = metadata
            .modified()
            .expect("mtime")
            .duration_since(UNIX_EPOCH)
            .expect("unix mtime")
            .as_secs() as i64;
        let conn = rusqlite::Connection::open(db.path()).expect("open sqlite");
        conn.execute(
            "UPDATE files SET suggested_action = 'Move', suggested_target_path = ?2, suggested_name = 'source.txt', confidence = 0.95, size = ?3, mtime = ?4 WHERE path = ?1",
            rusqlite::params![file_id, normalize_path(&target_dir), metadata.len() as i64, mtime],
        )
        .expect("set suggestion");
        let preview = db
            .get_operation_previews_by_file_ids(std::slice::from_ref(&file_id))
            .expect("preview")
            .pop()
            .expect("operation preview");

        let request = resolve_execute_selections(
            &db,
            ExecuteMovesByIdRequest {
                operations: vec![OperationSelection {
                    id: preview.id,
                    file_id,
                    new_name: None,
                }],
            },
        )
        .expect("resolve selection");

        assert_eq!(
            normalize_path(Path::new(&request.operations[0].source_path)),
            normalize_path(&source)
        );
        assert_eq!(
            request.operations[0].target_path,
            normalize_path(&target_dir.join("source.txt"))
        );
    }

    #[test]
    fn execute_selection_preserves_indexed_extension_and_rejects_tampering() {
        let db = Database::open(test_db_path()).expect("open database");
        let root = test_dir();
        let source = root.join("Install_Package.lnk");
        let target_dir = root.join("organized");
        fs::write(&source, b"shortcut fixture").expect("write shortcut");
        insert_indexed_file(&db, &source, "Install_Package.lnk", "lnk");
        let file_id = source.to_string_lossy().into_owned();
        let metadata = fs::metadata(&source).expect("shortcut metadata");
        let mtime = metadata
            .modified()
            .expect("shortcut mtime")
            .duration_since(UNIX_EPOCH)
            .expect("unix mtime")
            .as_secs() as i64;
        let conn = rusqlite::Connection::open(db.path()).expect("open sqlite");
        conn.execute(
            "UPDATE files SET suggested_action = 'Move', suggested_target_path = ?2, suggested_name = 'Install_Package', confidence = 0.95, size = ?3, mtime = ?4 WHERE path = ?1",
            rusqlite::params![file_id, normalize_path(&target_dir), metadata.len() as i64, mtime],
        )
        .expect("set shortcut suggestion");
        let preview = db
            .get_operation_previews_by_file_ids(std::slice::from_ref(&file_id))
            .expect("shortcut preview")
            .pop()
            .expect("shortcut operation preview");

        let normalized = resolve_execute_selections(
            &db,
            ExecuteMovesByIdRequest {
                operations: vec![OperationSelection {
                    id: preview.id.clone(),
                    file_id: file_id.clone(),
                    new_name: Some("Install_Package".to_string()),
                }],
            },
        )
        .expect("missing shortcut extension is normalized");
        assert_eq!(normalized.operations[0].new_name, "Install_Package.lnk");
        assert!(normalized.operations[0]
            .target_path
            .ends_with("Install_Package.lnk"));

        let error = resolve_execute_selections(
            &db,
            ExecuteMovesByIdRequest {
                operations: vec![OperationSelection {
                    id: preview.id,
                    file_id,
                    new_name: Some("Install_Package.exe".to_string()),
                }],
            },
        )
        .expect_err("extension tampering must be rejected");
        assert!(error.contains("Changing a file extension is not allowed during organization."));
        assert_eq!(
            fs::read(&source).expect("read shortcut"),
            b"shortcut fixture"
        );
    }

    #[test]
    fn execute_selection_rejects_forged_preview_id() {
        let db = Database::open(test_db_path()).expect("open database");

        let error = resolve_execute_selections(
            &db,
            ExecuteMovesByIdRequest {
                operations: vec![OperationSelection {
                    id: "op-forged".to_string(),
                    file_id: "file-forged".to_string(),
                    new_name: None,
                }],
            },
        )
        .expect_err("reject forged selection");

        assert!(error.contains("authoritative preview"));
    }

    #[test]
    fn restore_volume_relation_is_three_state_and_preserves_hash_fallbacks() {
        let operation = OperationPreviewRequest {
            id: "restore-volume-relation".to_string(),
            file_id: "restore-volume-file".to_string(),
            operation_type: "rename".to_string(),
            source_path: "C:/restore/before.txt".to_string(),
            target_path: "D:/restore/after.txt".to_string(),
            old_name: "before.txt".to_string(),
            new_name: "after.txt".to_string(),
            is_executable: Some(false),
        };
        let mut log = make_operation_log(
            "restore-volume-batch",
            "1900000000000",
            0,
            &operation,
            "success",
            None,
            operation.target_path.clone(),
        );
        log.source_size = Some(7);
        log.source_quick_hash = Some("quick".to_string());
        log.source_full_hash = Some("source-full".to_string());
        log.target_full_hash = Some("target-full".to_string());
        log.source_platform_file_id = Some("source-file-id".to_string());
        log.target_platform_file_id = Some("target-file-id".to_string());

        log.source_platform_volume_id = Some("volume-a".to_string());
        log.target_platform_volume_id = Some("volume-a".to_string());
        assert_eq!(
            restore_volume_relation(&log),
            RestoreVolumeRelation::SameVolume
        );
        let same = expected_restore_identity_from_log(&log).expect("same-volume identity");
        assert_eq!(same.platform_volume_id.as_deref(), Some("volume-a"));
        assert_eq!(same.platform_file_id.as_deref(), Some("target-file-id"));

        log.target_platform_volume_id = Some("volume-b".to_string());
        assert_eq!(
            restore_volume_relation(&log),
            RestoreVolumeRelation::CrossVolume
        );
        let cross = expected_restore_identity_from_log(&log).expect("cross-volume identity");
        assert_eq!(cross.platform_volume_id.as_deref(), Some("volume-b"));
        assert!(cross.platform_file_id.is_none());

        log.source_platform_volume_id = None;
        log.target_platform_volume_id = None;
        assert_eq!(
            restore_volume_relation(&log),
            RestoreVolumeRelation::Unknown
        );
        let unknown = expected_restore_identity_from_log(&log).expect("unknown-volume identity");
        assert!(unknown.platform_volume_id.is_none());
        assert!(unknown.platform_file_id.is_none());
        assert_eq!(unknown.full_hash.as_deref(), Some("target-full"));

        log.source_platform_volume_id = Some("volume-a".to_string());
        assert_eq!(
            restore_volume_relation(&log),
            RestoreVolumeRelation::Unknown
        );
        assert!(expected_restore_identity_from_log(&log)
            .expect("one-volume identity")
            .platform_file_id
            .is_none());

        log.source_platform_volume_id = None;
        log.target_platform_volume_id = Some("volume-b".to_string());
        assert_eq!(
            restore_volume_relation(&log),
            RestoreVolumeRelation::Unknown
        );
        assert!(expected_restore_identity_from_log(&log)
            .expect("target-only-volume identity")
            .platform_file_id
            .is_none());
    }

    #[test]
    fn restore_unknown_volume_uses_content_identity_and_rejects_hash_mismatch() {
        let db = Database::open(test_db_path()).expect("open database");
        let root = test_dir();
        let after = root.join("restore-unknown-volume-after.txt");
        fs::write(&after, "unknown-volume-content").expect("write restore source");
        let identity = file_identity_fingerprint(&after).expect("capture restore source");
        let operation = OperationPreviewRequest {
            id: "restore-unknown-volume".to_string(),
            file_id: "restore-unknown-file".to_string(),
            operation_type: "rename".to_string(),
            source_path: root.join("before.txt").to_string_lossy().into_owned(),
            target_path: normalize_path(&after),
            old_name: "before.txt".to_string(),
            new_name: "restore-unknown-volume-after.txt".to_string(),
            is_executable: Some(false),
        };
        let mut log = make_operation_log(
            "restore-unknown-batch",
            "1900000000000",
            0,
            &operation,
            "success",
            None,
            operation.target_path.clone(),
        );
        log.source_size = Some(identity.size);
        log.source_quick_hash = identity.quick_hash;
        log.source_full_hash = identity.full_hash.clone();
        log.target_full_hash = identity.full_hash;
        log.source_platform_volume_id = None;
        log.target_platform_volume_id = None;
        log.source_platform_file_id = Some("old-source-id".to_string());
        log.target_platform_file_id = Some("old-target-id".to_string());

        assert!(operation_restore_identity_result(&log, &after).is_ok());
        log.target_full_hash = Some("wrong-hash".to_string());
        let error = operation_restore_identity_result(&log, &after)
            .expect_err("unknown-volume hash mismatch must fail closed");
        assert_eq!(
            error.code,
            crate::recovery::RecoveryErrorCode::RestoreSourceIdentityMismatch
        );
        drop(db);
    }

    #[test]
    fn pending_operation_journal_reconciles_a_move_completed_before_restart() {
        let db = Database::open(test_db_path()).expect("open database");
        let root = test_dir();
        let source = root.join("before.txt");
        let target = root.join("after.txt");
        fs::write(&source, "hello").expect("write source");
        let request = ExecuteMovesRequest {
            operations: vec![OperationPreviewRequest {
                id: "op-recovery".to_string(),
                file_id: "file-recovery".to_string(),
                operation_type: "rename".to_string(),
                source_path: normalize_path(&source),
                target_path: normalize_path(&target),
                old_name: "before.txt".to_string(),
                new_name: "after.txt".to_string(),
                is_executable: Some(true),
            }],
        };
        persist_pending_operation_journal(&db, &request, "batch-recovery", "1900000000000")
            .expect("persist pending journal");
        assert_eq!(db.get_pending_operation_logs().expect("pending").len(), 1);
        fs::rename(&source, &target).expect("simulate completed filesystem move");
        let target_file = fs::OpenOptions::new()
            .write(true)
            .open(&target)
            .expect("open moved target");
        target_file
            .set_times(fs::FileTimes::new().set_modified(SystemTime::now()))
            .expect("change target mtime");

        let reconciled = reconcile_pending_operation_journal(&db).expect("reconcile journal");
        let logs = db.get_operation_logs(Some(10)).expect("logs");

        assert_eq!(reconciled, 1);
        assert_eq!(logs[0].status, "success");
        assert!(logs[0].can_restore);
        assert!(db
            .get_pending_operation_logs()
            .expect("pending after")
            .is_empty());
    }

    #[test]
    fn pending_operation_journal_requires_matching_target_identity() {
        for (label, replacement) in [("size", "different-size"), ("hash", "world")] {
            let db = Database::open(test_db_path()).expect("open database");
            let root = test_dir();
            let source = root.join(format!("before-{label}.txt"));
            let target = root.join(format!("after-{label}.txt"));
            fs::write(&source, "hello").expect("write source");
            let request = ExecuteMovesRequest {
                operations: vec![OperationPreviewRequest {
                    id: format!("op-{label}"),
                    file_id: format!("file-{label}"),
                    operation_type: "rename".to_string(),
                    source_path: normalize_path(&source),
                    target_path: normalize_path(&target),
                    old_name: format!("before-{label}.txt"),
                    new_name: format!("after-{label}.txt"),
                    is_executable: Some(true),
                }],
            };
            persist_pending_operation_journal(&db, &request, &format!("batch-{label}"), "1")
                .expect("persist pending journal");
            fs::remove_file(&source).expect("remove source");
            fs::write(&target, replacement).expect("write unrelated target");

            reconcile_pending_operation_journal(&db).expect("reconcile journal");
            let log = db.get_operation_logs(Some(1)).expect("logs").remove(0);

            assert_eq!(log.status, "manual_review");
            assert!(!log.can_restore);
            assert!(!log.can_undo);
        }
    }

    #[test]
    fn pending_move_hash_fallback_also_requires_matching_mtime() {
        let db = Database::open(test_db_path()).expect("open database");
        let root = test_dir();
        let source = root.join("before-same-content.txt");
        let target = root.join("after-same-content.txt");
        fs::write(&source, "same-content").expect("write source");
        let request = ExecuteMovesRequest {
            operations: vec![preview_operation(0, &source, &target)],
        };
        persist_pending_operation_journal(&db, &request, "batch-mtime", "1")
            .expect("persist pending journal");
        fs::remove_file(&source).expect("remove source");
        fs::write(&target, "same-content").expect("write replacement target");
        fs::OpenOptions::new()
            .write(true)
            .open(&target)
            .expect("open replacement")
            .set_times(
                fs::FileTimes::new()
                    .set_modified(SystemTime::now() - Duration::from_secs(24 * 60 * 60)),
            )
            .expect("change replacement mtime");

        reconcile_pending_operation_journal(&db).expect("reconcile journal");
        let log = db.get_operation_logs(Some(1)).expect("logs").remove(0);

        assert_eq!(log.status, "manual_review");
        assert!(!log.can_restore);
    }

    #[test]
    fn pending_operation_journal_marks_ambiguous_path_states_for_manual_review() {
        for (label, keep_source, create_target) in [("both", true, true), ("neither", false, false)]
        {
            let db = Database::open(test_db_path()).expect("open database");
            let root = test_dir();
            let source = root.join(format!("before-{label}.txt"));
            let target = root.join(format!("after-{label}.txt"));
            fs::write(&source, "hello").expect("write source");
            let request = ExecuteMovesRequest {
                operations: vec![preview_operation(0, &source, &target)],
            };
            persist_pending_operation_journal(&db, &request, &format!("batch-{label}"), "1")
                .expect("persist pending journal");
            if !keep_source {
                fs::remove_file(&source).expect("remove source");
            }
            if create_target {
                fs::write(&target, "hello").expect("write target");
            }

            reconcile_pending_operation_journal(&db).expect("reconcile journal");
            let log = db.get_operation_logs(Some(1)).expect("logs").remove(0);
            assert_eq!(log.status, "manual_review");
            assert!(!log.can_restore);
        }
    }

    #[cfg(any(windows, target_os = "macos"))]
    #[test]
    fn pending_operation_journal_marks_target_and_claim_as_source_cleanup_pending() {
        let db = Database::open(test_db_path()).expect("open database");
        let root = test_dir();
        let source = root.join("before-claim-pending.txt");
        let target = root.join("after-claim-pending.txt");
        fs::write(&source, "hello").expect("write source");
        let request = ExecuteMovesRequest {
            operations: vec![preview_operation(0, &source, &target)],
        };
        persist_pending_operation_journal(&db, &request, "batch-claim-pending", "1")
            .expect("persist pending journal");
        let pending = db
            .get_pending_operation_logs()
            .expect("pending logs")
            .remove(0);
        let claim = PathBuf::from(pending.source_claim_path.expect("claim path"));

        fs::hard_link(&source, &target).expect("create target hard link");
        fs::hard_link(&source, &claim).expect("create claim hard link");
        fs::remove_file(&source).expect("remove original source");

        reconcile_pending_operation_journal(&db).expect("reconcile journal");
        let log = db.get_operation_logs(Some(1)).expect("logs").remove(0);

        assert_eq!(log.status, "manual_review");
        assert_eq!(log.operation_phase, "source_cleanup_pending");
        assert!(!log.can_restore);
        assert!(!log.can_undo);
    }

    #[test]
    fn pending_restore_journal_reconciles_a_restore_completed_before_restart() {
        let db = Database::open(test_db_path()).expect("open database");
        let root = test_dir();
        let source = root.join("before.txt");
        let target = root.join("after.txt");
        fs::write(&source, "hello").expect("write source");
        let executed = execute_moves_with_persistence(
            &db,
            ExecuteMovesRequest {
                operations: vec![OperationPreviewRequest {
                    id: "op-restore-recovery".to_string(),
                    file_id: "file-restore-recovery".to_string(),
                    operation_type: "rename".to_string(),
                    source_path: normalize_path(&source),
                    target_path: normalize_path(&target),
                    old_name: "before.txt".to_string(),
                    new_name: "after.txt".to_string(),
                    is_executable: Some(true),
                }],
            },
        )
        .expect("execute move");
        let log_id = executed.logs[0].id.clone();
        db.mark_operation_restores_pending(std::slice::from_ref(&log_id))
            .expect("mark restore pending");
        fs::rename(&target, &source).expect("simulate completed restore");

        let reconciled = reconcile_pending_operation_journal(&db).expect("reconcile journal");
        let logs = db.get_operation_logs(Some(10)).expect("logs");
        let restored = logs
            .iter()
            .find(|log| log.id == log_id)
            .expect("restored log");

        assert_eq!(reconciled, 1);
        assert_eq!(restored.restore_status, "restored");
        assert!(!restored.can_restore);
        assert!(db
            .get_pending_restore_logs()
            .expect("pending after")
            .is_empty());
    }

    #[test]
    fn execute_moves_core_moves_files_and_returns_success_log() {
        let root = test_dir();
        let source_dir = root.join("source");
        let target_dir = root.join("target");
        fs::create_dir_all(&source_dir).expect("source dir");
        fs::create_dir_all(&target_dir).expect("target dir");

        let source = source_dir.join("sample.txt");
        let target = target_dir.join("sample.txt");
        fs::write(&source, "hello").expect("write source");

        let result = execute_moves_core(ExecuteMovesRequest {
            operations: vec![OperationPreviewRequest {
                id: "op-1".to_string(),
                file_id: "file-1".to_string(),
                operation_type: "move".to_string(),
                source_path: source.to_string_lossy().into_owned(),
                target_path: target.to_string_lossy().into_owned(),
                old_name: "sample.txt".to_string(),
                new_name: "sample.txt".to_string(),
                is_executable: Some(true),
            }],
        });

        assert!(!source.exists());
        assert!(target.exists());
        assert_eq!(result.logs.len(), 1);
        assert_eq!(result.logs[0].status, "success");
        assert_eq!(result.logs[0].operation_type, "move");
    }

    #[test]
    fn execute_moves_result_does_not_serialize_unused_updated_files_contract() {
        let result = execute_moves_core(ExecuteMovesRequest {
            operations: Vec::new(),
        });
        let json = serde_json::to_value(&result).expect("serialize result");

        assert!(json.get("logs").is_some());
        assert!(json.get("batch_id").is_some());
        assert!(json.get("updatedFiles").is_none());
    }

    #[test]
    fn execute_moves_core_creates_safe_missing_target_parent() {
        let root = test_dir();
        let source_dir = root.join("source");
        let target_dir = root.join("ZenCanvas").join("20_Areas").join("Projects");
        fs::create_dir_all(&source_dir).expect("source dir");

        let source = source_dir.join("sample.txt");
        let target = target_dir.join("sample.txt");
        fs::write(&source, "hello").expect("write source");

        let result = execute_moves_core(ExecuteMovesRequest {
            operations: vec![OperationPreviewRequest {
                id: "op-create-parent".to_string(),
                file_id: "file-create-parent".to_string(),
                operation_type: "move".to_string(),
                source_path: source.to_string_lossy().into_owned(),
                target_path: target.to_string_lossy().into_owned(),
                old_name: "sample.txt".to_string(),
                new_name: "sample.txt".to_string(),
                is_executable: Some(true),
            }],
        });

        assert!(!source.exists());
        assert!(target.exists());
        assert_eq!(fs::read_to_string(&target).expect("read target"), "hello");
        assert_eq!(result.logs[0].status, "success");
        assert_eq!(
            result.logs[0].source_path,
            source.to_string_lossy().into_owned()
        );
        assert!(result.logs[0]
            .target_path
            .replace('\\', "/")
            .ends_with("ZenCanvas/20_Areas/Projects/sample.txt"));
    }

    #[test]
    fn execute_moves_core_refuses_to_overwrite_existing_target() {
        let root = test_dir();
        let source_dir = root.join("source");
        let target_dir = root.join("target");
        fs::create_dir_all(&source_dir).expect("source dir");
        fs::create_dir_all(&target_dir).expect("target dir");

        let source = source_dir.join("sample.txt");
        let target = target_dir.join("sample.txt");
        fs::write(&source, "hello").expect("write source");
        fs::write(&target, "existing").expect("write existing target");

        let result = execute_moves_core(ExecuteMovesRequest {
            operations: vec![OperationPreviewRequest {
                id: "op-no-overwrite".to_string(),
                file_id: "file-no-overwrite".to_string(),
                operation_type: "move".to_string(),
                source_path: source.to_string_lossy().into_owned(),
                target_path: target.to_string_lossy().into_owned(),
                old_name: "sample.txt".to_string(),
                new_name: "sample.txt".to_string(),
                is_executable: Some(true),
            }],
        });

        assert!(source.exists());
        assert_eq!(
            fs::read_to_string(&target).expect("read target"),
            "existing"
        );
        assert_eq!(result.logs[0].status, "failed");
        assert!(result.logs[0]
            .error_message
            .as_deref()
            .unwrap_or_default()
            .contains("Target file already exists"));
    }

    #[test]
    fn copy_fallback_writes_through_temp_file_then_removes_source() {
        let root = test_dir();
        let source = root.join("source.txt");
        let target = root.join("target.txt");
        fs::write(&source, "fallback content").expect("write source");

        copy_then_delete_via_temp_with_cancel(&source, &target, None).expect("copy fallback");

        assert!(!source.exists());
        assert_eq!(
            fs::read_to_string(&target).expect("read target"),
            "fallback content"
        );
        let temp_entries = fs::read_dir(&root)
            .expect("read root")
            .filter_map(Result::ok)
            .filter(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .contains(".zencanvas-tmp-")
            })
            .count();
        assert_eq!(temp_entries, 0);
    }

    #[test]
    fn copy_stream_stops_after_chunk_when_cancelled() {
        let cancel_flag = AtomicBool::new(false);
        let content = b"abcdefghijkl";
        let mut reader = CancelAfterFirstRead::new(&content[..], &cancel_flag);
        let mut writer = Vec::new();

        let error = copy_stream_to_temp(&mut reader, &mut writer, Some(&cancel_flag), 4)
            .expect_err("copy should stop after cancellation");

        assert_eq!(
            error,
            crate::fs_safety::AtomicMoveError::Cancelled.to_string()
        );
        assert!(writer.len() < content.len());
        assert_eq!(writer, b"abcd");
    }

    #[test]
    fn copy_fallback_cancel_keeps_source_and_removes_temp() {
        let root = test_dir();
        let source = root.join("source.txt");
        let target = root.join("target.txt");
        fs::write(&source, "fallback content").expect("write source");
        let cancel_flag = Arc::new(AtomicBool::new(true));

        let error = copy_then_delete_via_temp_with_cancel(&source, &target, Some(&cancel_flag))
            .expect_err("copy fallback should stop when canceled");

        assert_eq!(
            error,
            crate::fs_safety::AtomicMoveError::Cancelled.to_string()
        );
        assert_eq!(
            fs::read_to_string(&source).expect("source remains readable"),
            "fallback content"
        );
        assert!(!target.exists());
        let temp_entries = fs::read_dir(&root)
            .expect("read root")
            .filter_map(Result::ok)
            .filter(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .contains(".zencanvas-tmp-")
            })
            .count();
        assert_eq!(temp_entries, 0);
    }

    #[test]
    fn validate_safe_file_name_rejects_traversal_separators_and_nul() {
        for name in [
            "..",
            "../escape.txt",
            "..\\escape.txt",
            "safe..looking.txt",
            "nested/name.txt",
            "nested\\name.txt",
            "nul\0name.txt",
        ] {
            assert!(
                validate_safe_file_name(name).is_err(),
                "expected unsafe file name to be rejected: {name:?}"
            );
        }
    }

    #[test]
    fn validate_target_path_rejects_traversal_and_nul() {
        let root = test_dir();
        fs::create_dir_all(&root).expect("root dir");

        for target in [
            root.join("..").join("escape.txt"),
            root.join("safe..looking.txt"),
            root.join("nul\0name.txt"),
        ] {
            assert!(
                validate_target_path_with_parent_policy(&target, true).is_err(),
                "expected unsafe target path to be rejected: {target:?}"
            );
        }
    }

    #[test]
    fn validate_target_path_rejects_protected_parent() {
        let Some(protected_root) = general_file_operation_protected_roots()
            .into_iter()
            .find(|root| root.exists())
        else {
            return;
        };
        let target = protected_root.join("zencanvas-should-not-write.txt");

        let error = validate_target_path_with_parent_policy(&target, false)
            .expect_err("protected parent should be rejected");

        assert!(error.contains("protected system location"));
    }

    #[test]
    fn general_file_operation_rejects_symlink_source() {
        let root = test_dir();
        let target = root.join("target.txt");
        let link = root.join("source-link.txt");
        fs::write(&target, "target").expect("write target");
        if create_file_symlink_for_test(&target, &link).is_err() {
            return;
        }

        let error = validate_source_path(&link).expect_err("symlink source must be rejected");

        assert!(error.contains("protected system location"));
    }

    #[test]
    fn general_file_operation_rejects_parent_segments_in_source() {
        let root = test_dir();
        let target = root.join("target.txt");
        let nested = root.join("nested");
        fs::create_dir_all(&nested).expect("nested dir");
        fs::write(&target, "target").expect("write target");
        let aliased = nested.join("..").join("target.txt");

        let error = validate_source_path(&aliased).expect_err("parent segment must be rejected");

        assert!(error.contains("unsafe parent traversal"));
    }

    #[test]
    fn general_move_rejects_private_var_log() {
        let error = ensure_general_file_operation_allowed_for_os(
            Path::new("/private/var/log/example.log"),
            "macos",
        )
        .expect_err("macOS private paths must be protected");

        assert!(error.contains("protected system location"));
    }

    #[test]
    fn general_operations_preserve_macos_path_case() {
        assert_eq!(
            normalize_for_compare_for_os(Path::new("/pRiVaTe/var/log/example.log"), "macos"),
            "/pRiVaTe/var/log/example.log"
        );
        let result = ensure_general_file_operation_allowed_for_os(
            Path::new("/pRiVaTe/var/log/example.log"),
            "macos",
        );

        assert!(result.is_ok(), "macOS path identity must preserve case");
    }

    #[test]
    fn nearest_existing_target_ancestor_resolves_symlinks_before_creation() {
        let root = test_dir();
        let real_parent = root.join("real-parent");
        let link = root.join("linked-parent");
        fs::create_dir_all(&real_parent).expect("real parent");
        if create_directory_symlink_for_test(&real_parent, &link).is_err() {
            return;
        }

        let resolved = canonicalize_nearest_existing_ancestor(&link.join("missing/child"))
            .expect("resolve existing symlink ancestor");

        assert_eq!(
            resolved,
            real_parent.canonicalize().expect("canonical real parent")
        );
        assert!(!real_parent.join("missing").exists());
    }

    #[test]
    fn general_rename_rejects_applications() {
        let error = ensure_general_file_operation_allowed_for_os(
            Path::new("/Applications/Example.app/file"),
            "macos",
        )
        .expect_err("macOS Applications paths must be protected");

        assert!(error.contains("protected system location"));
    }

    #[test]
    fn general_restore_rejects_protected_destination() {
        let error = ensure_general_file_operation_allowed_for_os(
            Path::new("/Applications/Restored.app/file"),
            "macos",
        )
        .expect_err("restore destinations in Applications must be protected");

        assert!(error.contains("protected system location"));
    }

    #[test]
    fn cleanup_exception_does_not_affect_general_move() {
        let error = ensure_general_file_operation_allowed_for_os(
            Path::new("/private/tmp/zen-canvas/example.tmp"),
            "macos",
        )
        .expect_err("cleanup temp exceptions must not relax general moves");

        assert!(error.contains("protected system location"));
    }

    #[test]
    fn general_operations_allow_only_the_current_macos_temp_root() {
        let current_temp = Path::new("/private/var/folders/current/T");

        ensure_general_file_operation_allowed_for_os_with_temp(
            Path::new("/private/var/folders/current/T/zen-canvas/source.txt"),
            "macos",
            Some(current_temp),
        )
        .expect("the current macOS temp subtree should be usable");

        let error = ensure_general_file_operation_allowed_for_os_with_temp(
            Path::new("/private/var/folders/another/T/zen-canvas/source.txt"),
            "macos",
            Some(current_temp),
        )
        .expect_err("another macOS temp subtree must remain protected");

        assert!(error.contains("protected system location"));
    }

    #[test]
    fn symlink_parent_cannot_escape_protected_root() {
        let Some(protected_root) = general_file_operation_protected_roots()
            .into_iter()
            .find(|root| root.is_dir())
        else {
            return;
        };
        let root = test_dir();
        let link = root.join("protected-link");
        if create_directory_symlink_for_test(&protected_root, &link).is_err() {
            return;
        }

        let error = validate_target_path(&link.join("escape.txt"))
            .expect_err("symlink parent must not escape into a protected root");

        assert!(error.contains("protected system location"));
    }

    #[test]
    fn execute_moves_core_marks_remaining_operations_skipped_when_cancelled() {
        let root = test_dir();
        let source_dir = root.join("source");
        let target_dir = root.join("target");
        fs::create_dir_all(&source_dir).expect("source dir");
        fs::create_dir_all(&target_dir).expect("target dir");
        let operations = (0..11)
            .map(|index| {
                let source = source_dir.join(format!("sample-{index}.txt"));
                let target = target_dir.join(format!("sample-{index}.txt"));
                fs::write(&source, "hello").expect("write source");
                preview_operation(index, &source, &target)
            })
            .collect::<Vec<_>>();
        let cancelled_source = PathBuf::from(&operations[10].source_path);
        let cancelled_target = PathBuf::from(&operations[10].target_path);
        let cancel_flag = Arc::new(AtomicBool::new(false));
        let progress =
            RecordingOperationProgressEmitter::cancel_after(10, Arc::clone(&cancel_flag));

        let result = execute_moves_core_with_progress(
            ExecuteMovesRequest { operations },
            Arc::clone(&cancel_flag),
            &progress,
        );

        assert_eq!(
            result
                .logs
                .iter()
                .filter(|log| log.status == "success")
                .count(),
            10
        );
        assert_eq!(
            result
                .logs
                .iter()
                .filter(|log| log.status == "skipped")
                .count(),
            1
        );
        assert!(cancelled_source.exists());
        assert!(!cancelled_target.exists());
        assert!(result.logs[10].error_message.is_none());
        assert_eq!(
            progress.events().last().map(|event| event.processed),
            Some(11)
        );
        assert_eq!(progress.events().last().map(|event| event.total), Some(11));
    }

    #[cfg(not(target_os = "macos"))]
    #[test]
    fn execute_moves_core_fails_closed_when_system_trash_cannot_bind_source_handle() {
        let root = test_dir();
        let source = root.join("trash-me.txt");
        fs::write(&source, "temporary").expect("write source");
        let file = fs::OpenOptions::new()
            .write(true)
            .open(&source)
            .expect("open temporary source");
        file.set_times(
            fs::FileTimes::new()
                .set_modified(SystemTime::now() - Duration::from_secs(8 * 24 * 60 * 60)),
        )
        .expect("age temporary source");

        let result = execute_moves_core(ExecuteMovesRequest {
            operations: vec![OperationPreviewRequest {
                id: "trash-preview".to_string(),
                file_id: source.to_string_lossy().into_owned(),
                operation_type: "move_to_trash".to_string(),
                source_path: source.to_string_lossy().into_owned(),
                target_path: "Recycle Bin".to_string(),
                old_name: "trash-me.txt".to_string(),
                new_name: "trash-me.txt".to_string(),
                is_executable: Some(true),
            }],
        });

        assert_eq!(result.logs[0].status, "failed");
        assert_eq!(
            result.logs[0].error_message.as_deref(),
            Some("system_trash_source_binding_unsupported")
        );
        assert_eq!(result.logs[0].operation_type, "move_to_trash");
        assert_eq!(result.logs[0].target_path, "Recycle Bin");
        assert!(source.exists());
        assert!(!result.logs[0].can_restore);
        assert_eq!(result.logs[0].restore_status, "not_restored");
    }

    #[test]
    fn execute_moves_core_refuses_dangerous_move_to_trash_paths() {
        let protected_path = if cfg!(windows) {
            "C:/Windows/System32"
        } else if cfg!(target_os = "macos") {
            "/System"
        } else {
            "/etc"
        };
        let result = execute_moves_core(ExecuteMovesRequest {
            operations: vec![OperationPreviewRequest {
                id: "trash-system".to_string(),
                file_id: protected_path.to_string(),
                operation_type: "move_to_trash".to_string(),
                source_path: protected_path.to_string(),
                target_path: "Recycle Bin".to_string(),
                old_name: "protected-system-path".to_string(),
                new_name: "protected-system-path".to_string(),
                is_executable: Some(true),
            }],
        });

        assert_eq!(result.logs[0].status, "failed");
        assert!(result.logs[0]
            .error_message
            .as_deref()
            .unwrap_or("")
            .contains("protected"));
    }

    #[test]
    fn execute_moves_core_does_not_trash_when_operation_is_blocked() {
        let root = test_dir();
        let source = root.join("blocked.txt");
        fs::write(&source, "keep").expect("write source");

        let result = execute_moves_core(ExecuteMovesRequest {
            operations: vec![OperationPreviewRequest {
                id: "trash-blocked".to_string(),
                file_id: source.to_string_lossy().into_owned(),
                operation_type: "move_to_trash".to_string(),
                source_path: source.to_string_lossy().into_owned(),
                target_path: "Recycle Bin".to_string(),
                old_name: "blocked.txt".to_string(),
                new_name: "blocked.txt".to_string(),
                is_executable: Some(false),
            }],
        });

        assert_eq!(result.logs[0].status, "skipped");
        assert!(source.exists());
    }

    #[test]
    fn cleanup_execution_forbidden_rejects_empty_root_and_symlink() {
        assert!(crate::storage_analyzer::is_cleanup_execution_forbidden(
            Path::new(""),
            None
        ));
        assert!(crate::storage_analyzer::is_cleanup_execution_forbidden(
            Path::new("C:/"),
            None
        ));

        let root = test_dir();
        let target = root.join("target.txt");
        let link = root.join("link.txt");
        fs::write(&target, "target").expect("write target");
        if create_file_symlink_for_test(&target, &link).is_ok() {
            assert!(crate::storage_analyzer::is_cleanup_execution_forbidden(
                &link, None
            ));
        }
    }

    #[test]
    fn restore_moves_core_does_not_restore_move_to_trash_logs() {
        let root = test_dir();
        let source = root.join("already-trashed.txt");
        let log = OperationLogDto {
            id: "trash-log".to_string(),
            batch_id: "trash-batch".to_string(),
            operation_type: "move_to_trash".to_string(),
            source_path: source.to_string_lossy().into_owned(),
            target_path: "Recycle Bin".to_string(),
            old_name: "already-trashed.txt".to_string(),
            new_name: "already-trashed.txt".to_string(),
            status: "success".to_string(),
            error_message: None,
            created_at: "1".to_string(),
            can_undo: false,
            path_before: source.to_string_lossy().into_owned(),
            path_after: "Recycle Bin".to_string(),
            name_before: "already-trashed.txt".to_string(),
            name_after: "already-trashed.txt".to_string(),
            can_restore: false,
            restored_at: None,
            restore_status: "unavailable".to_string(),
            restore_error: Some("Restore from system trash".to_string()),
            source_size: None,
            source_modified_ns: None,
            source_platform_file_id: None,
            source_platform_volume_id: None,
            source_quick_hash: None,
            source_full_hash: None,
            target_platform_file_id: None,
            target_platform_volume_id: None,
            target_full_hash: None,
            source_claim_path: None,
            operation_phase: "completed".to_string(),
            claim_created_at: None,
            claim_platform_file_id: None,
            claim_platform_volume_id: None,
            claim_full_hash: None,
            restore_claim_path: None,
            restore_phase: "idle".to_string(),
            restore_claim_created_at: None,
            restore_claim_platform_file_id: None,
            restore_claim_platform_volume_id: None,
            restore_claim_full_hash: None,
        };

        let restored = restore_moves_core(RestoreMovesRequest { logs: vec![log] });

        assert_eq!(restored.restored, 0);
        assert_eq!(restored.failed, 0);
        assert_eq!(restored.logs[0].restore_status, "unavailable");
        assert!(restored.logs[0]
            .restore_error
            .as_deref()
            .unwrap_or("")
            .contains("system trash"));
    }

    #[test]
    fn execute_preview_operation_marks_move_cancellation_as_skipped() {
        let root = test_dir();
        let source = root.join("source.txt");
        let target = root.join("target.txt");
        fs::write(&source, "hello").expect("write source");
        let cancel_flag = AtomicBool::new(true);
        let operation = preview_operation(1, &source, &target);

        let log =
            execute_preview_operation("batch-cancel", "123", 0, &operation, Some(&cancel_flag));

        assert_eq!(log.status, "skipped");
        assert!(log.error_message.is_none());
        assert!(!log.can_undo);
        assert!(!log.can_restore);
        assert!(source.exists());
        assert!(!target.exists());
    }

    #[test]
    fn restore_moves_core_restores_successful_move_log() {
        let root = test_dir();
        let source_dir = root.join("source");
        let target_dir = root.join("target");
        fs::create_dir_all(&source_dir).expect("source dir");
        fs::create_dir_all(&target_dir).expect("target dir");

        let source = source_dir.join("sample.txt");
        let target = target_dir.join("sample.txt");
        fs::write(&source, "hello").expect("write source");

        let executed = execute_moves_core(ExecuteMovesRequest {
            operations: vec![OperationPreviewRequest {
                id: "op-1".to_string(),
                file_id: "file-1".to_string(),
                operation_type: "move".to_string(),
                source_path: source.to_string_lossy().into_owned(),
                target_path: target.to_string_lossy().into_owned(),
                old_name: "sample.txt".to_string(),
                new_name: "sample.txt".to_string(),
                is_executable: Some(true),
            }],
        });

        let restored = restore_moves_core(RestoreMovesRequest {
            logs: executed.logs.clone(),
        });

        assert!(source.exists());
        assert!(!target.exists());
        assert_eq!(restored.restored, 1);
        assert_eq!(restored.failed, 0);
        assert_eq!(restored.logs.len(), 1);
        assert_eq!(restored.logs[0].restore_status, "restored");
        assert!(!restored.logs[0].can_restore);
        assert!(restored.logs[0].restored_at.is_some());
    }

    #[test]
    fn windows_shortcut_move_and_restore_preserve_name_bytes_and_hash() {
        let root = test_dir();
        let source_dir = root.join("source");
        let target_dir = root.join("target");
        fs::create_dir_all(&source_dir).expect("source dir");
        fs::create_dir_all(&target_dir).expect("target dir");

        let source = source_dir.join("Install_Package.lnk");
        let target = target_dir.join("Install_Package.lnk");
        let bytes = b"Windows shortcut fixture bytes\0\x01\x02".to_vec();
        let hash = blake3::hash(&bytes);
        fs::write(&source, &bytes).expect("write shortcut fixture");

        let executed = execute_moves_core(ExecuteMovesRequest {
            operations: vec![OperationPreviewRequest {
                id: "op-shortcut".to_string(),
                file_id: "file-shortcut".to_string(),
                operation_type: "move".to_string(),
                source_path: source.to_string_lossy().into_owned(),
                target_path: target.to_string_lossy().into_owned(),
                old_name: "Install_Package.lnk".to_string(),
                new_name: "Install_Package.lnk".to_string(),
                is_executable: Some(true),
            }],
        });

        assert_eq!(executed.logs[0].status, "success");
        assert!(!source.exists());
        assert!(target.to_string_lossy().ends_with(".lnk"));
        assert_eq!(fs::read(&target).expect("read moved shortcut"), bytes);
        assert_eq!(
            blake3::hash(&fs::read(&target).expect("hash moved shortcut")),
            hash
        );

        let restored = restore_moves_core(RestoreMovesRequest {
            logs: executed.logs,
        });
        assert_eq!(restored.restored, 1);
        assert!(source.exists());
        assert!(!target.exists());
        assert_eq!(fs::read(&source).expect("read restored shortcut"), bytes);
        assert_eq!(
            blake3::hash(&fs::read(&source).expect("hash restored shortcut")),
            hash
        );
    }

    #[test]
    fn restore_blocks_a_replaced_operation_target() {
        let root = test_dir();
        let source = root.join("before.txt");
        let target = root.join("after.txt");
        fs::write(&source, "hello").expect("write source");
        let executed = execute_moves_core(ExecuteMovesRequest {
            operations: vec![preview_operation(0, &source, &target)],
        });
        fs::remove_file(&target).expect("remove moved target");
        fs::write(&target, "world").expect("write same-size replacement");

        let restored = restore_moves_core(RestoreMovesRequest {
            logs: executed.logs,
        });

        assert!(!source.exists());
        assert_eq!(
            fs::read_to_string(&target).expect("read replacement"),
            "world"
        );
        assert_eq!(restored.restored, 0);
        assert_eq!(restored.failed, 1);
        assert_eq!(restored.logs[0].restore_status, "manual_review");
        assert!(restored.logs[0]
            .restore_error
            .as_deref()
            .unwrap_or_default()
            .starts_with("restore_source_identity_mismatch:"));
    }

    #[test]
    fn restore_blocks_legacy_operation_logs_without_identity() {
        let root = test_dir();
        let source = root.join("legacy-before.txt");
        let target = root.join("legacy-after.txt");
        fs::write(&source, "legacy").expect("write source");
        let mut executed = execute_moves_core(ExecuteMovesRequest {
            operations: vec![preview_operation(0, &source, &target)],
        });
        let log = &mut executed.logs[0];
        log.source_size = None;
        log.source_modified_ns = None;
        log.source_platform_file_id = None;
        log.source_quick_hash = None;
        log.target_platform_file_id = None;

        let restored = restore_moves_core(RestoreMovesRequest {
            logs: executed.logs,
        });

        assert!(!source.exists());
        assert!(target.exists());
        assert_eq!(restored.logs[0].restore_status, "manual_review");
    }

    #[test]
    fn restore_moves_core_marks_remaining_logs_canceled_when_cancelled() {
        let root = test_dir();
        let source_dir = root.join("source");
        let target_dir = root.join("target");
        fs::create_dir_all(&source_dir).expect("source dir");
        fs::create_dir_all(&target_dir).expect("target dir");
        let operations = (0..11)
            .map(|index| {
                let source = source_dir.join(format!("restore-{index}.txt"));
                let target = target_dir.join(format!("restore-{index}.txt"));
                fs::write(&source, "hello").expect("write source");
                preview_operation(index, &source, &target)
            })
            .collect::<Vec<_>>();
        let executed = execute_moves_core(ExecuteMovesRequest { operations });
        let canceled_log = executed.logs[10].clone();
        let cancel_flag = Arc::new(AtomicBool::new(false));
        let progress =
            RecordingOperationProgressEmitter::cancel_after(10, Arc::clone(&cancel_flag));

        let restored = restore_moves_core_with_progress(
            RestoreMovesRequest {
                logs: executed.logs.clone(),
            },
            Arc::clone(&cancel_flag),
            &progress,
        );

        assert_eq!(restored.restored, 10);
        assert_eq!(restored.failed, 0);
        assert_eq!(restored.logs[10].restore_status, "canceled");
        assert!(restored.logs[10].restore_error.is_none());
        assert!(!PathBuf::from(canceled_log.path_before).exists());
        assert!(PathBuf::from(canceled_log.path_after).exists());
        assert_eq!(
            progress.events().last().map(|event| event.processed),
            Some(11)
        );
        assert_eq!(progress.events().last().map(|event| event.total), Some(11));
    }

    #[test]
    fn restore_cancellation_distinguishes_preclaim_and_claimed_states() {
        let root = test_dir();
        let source = root.join("cancel-before-claim.txt");
        let target = root.join("cancel-before-claim-moved.txt");
        fs::write(&source, "hello").expect("write source");
        let executed = execute_moves_core(ExecuteMovesRequest {
            operations: vec![preview_operation(0, &source, &target)],
        });

        let mut before_claim = executed.logs[0].clone();
        before_claim.restore_status = "pending".to_string();
        before_claim.restore_phase = "prepared".to_string();
        before_claim.restore_claim_path = Some(
            root.join(".zen-canvas-claim-before-cancel")
                .to_string_lossy()
                .into_owned(),
        );
        let canceled_before_claim = mark_restore_canceled(&before_claim);
        assert_eq!(canceled_before_claim.status, "success");
        assert_eq!(canceled_before_claim.restore_status, "canceled");
        assert_eq!(canceled_before_claim.restore_phase, "rolled_back");
        assert!(canceled_before_claim.can_restore);
        assert!(canceled_before_claim.restore_claim_path.is_none());
        assert!(canceled_before_claim.restore_error.is_none());

        let mut after_claim = before_claim;
        after_claim.restore_phase = "source_claimed".to_string();
        after_claim.restore_claim_path = Some(
            root.join(".zen-canvas-claim-after-cancel")
                .to_string_lossy()
                .into_owned(),
        );
        let canceled_after_claim = mark_restore_canceled(&after_claim);
        assert_eq!(canceled_after_claim.status, "manual_review");
        assert_eq!(canceled_after_claim.restore_status, "manual_review");
        assert_eq!(canceled_after_claim.restore_phase, "source_claimed");
        assert!(!canceled_after_claim.can_restore);
        assert_eq!(
            canceled_after_claim.restore_claim_path,
            after_claim.restore_claim_path
        );
        assert!(canceled_after_claim
            .restore_error
            .as_deref()
            .is_some_and(|error| error.contains("restore_pending_reconciliation")));
    }

    #[test]
    fn restore_moves_refuses_to_overwrite_original_path() {
        let root = test_dir();
        let source_dir = root.join("source");
        let target_dir = root.join("target");
        fs::create_dir_all(&source_dir).expect("source dir");
        fs::create_dir_all(&target_dir).expect("target dir");

        let source = source_dir.join("sample.txt");
        let target = target_dir.join("sample.txt");
        fs::write(&source, "hello").expect("write source");

        let executed = execute_moves_core(ExecuteMovesRequest {
            operations: vec![OperationPreviewRequest {
                id: "op-1".to_string(),
                file_id: "file-1".to_string(),
                operation_type: "move".to_string(),
                source_path: source.to_string_lossy().into_owned(),
                target_path: target.to_string_lossy().into_owned(),
                old_name: "sample.txt".to_string(),
                new_name: "sample.txt".to_string(),
                is_executable: Some(true),
            }],
        });

        fs::write(&source, "new file").expect("write conflicting source");
        let restored = restore_moves_core(RestoreMovesRequest {
            logs: executed.logs.clone(),
        });

        assert_eq!(
            fs::read_to_string(&source).expect("read conflict"),
            "new file"
        );
        assert!(target.exists());
        assert_eq!(restored.restored, 0);
        assert_eq!(restored.failed, 1);
        assert_eq!(restored.logs[0].restore_status, "failed");
        assert!(restored.logs[0]
            .restore_error
            .as_deref()
            .unwrap_or_default()
            .contains("Target file already exists"));
    }

    #[test]
    fn restore_moves_restores_successful_rename_log() {
        let root = test_dir();
        fs::create_dir_all(&root).expect("root dir");

        let source = root.join("old-name.txt");
        let renamed = root.join("new-name.txt");
        fs::write(&source, "hello").expect("write source");

        let executed = execute_moves_core(ExecuteMovesRequest {
            operations: vec![OperationPreviewRequest {
                id: "op-1".to_string(),
                file_id: "file-1".to_string(),
                operation_type: "rename".to_string(),
                source_path: source.to_string_lossy().into_owned(),
                target_path: renamed.to_string_lossy().into_owned(),
                old_name: "old-name.txt".to_string(),
                new_name: "new-name.txt".to_string(),
                is_executable: Some(true),
            }],
        });

        assert!(!source.exists());
        assert!(renamed.exists());

        let restored = restore_moves_core(RestoreMovesRequest {
            logs: executed.logs.clone(),
        });

        assert!(source.exists());
        assert!(!renamed.exists());
        assert_eq!(restored.restored, 1);
        assert_eq!(restored.logs[0].restore_status, "restored");
    }

    #[test]
    fn execute_moves_updates_file_record_after_rename() {
        let db = Database::open(test_db_path()).expect("open database");
        let root = test_dir();
        let source = root.join("old-name.txt");
        let renamed = root.join("new-name.txt");
        fs::write(&source, "hello").expect("write source");
        insert_indexed_file(&db, &source, "old-name.txt", "txt");

        let result = execute_moves_with_persistence(
            &db,
            ExecuteMovesRequest {
                operations: vec![OperationPreviewRequest {
                    id: "op-rename".to_string(),
                    file_id: source.to_string_lossy().into_owned(),
                    operation_type: "rename".to_string(),
                    source_path: source.to_string_lossy().into_owned(),
                    target_path: renamed.to_string_lossy().into_owned(),
                    old_name: "old-name.txt".to_string(),
                    new_name: "new-name.txt".to_string(),
                    is_executable: Some(true),
                }],
            },
        )
        .expect("execute moves with persistence");
        let page = db.get_paged_files(Some(10), Some(0), None).expect("page");

        assert_eq!(result.logs[0].status, "success");
        assert_eq!(page.total, 1);
        assert_eq!(page.files[0].name, "new-name.txt");
        assert_eq!(page.files[0].path, canonical_test_path(&renamed));
        assert_eq!(page.files[0].id, canonical_test_path(&renamed));
        assert_eq!(page.files[0].extension, "txt");
        assert_eq!(page.files[0].suggested_action, "Keep");
        assert!(!page.files[0].requires_confirmation);
    }

    #[cfg(windows)]
    fn replace_source_after_journal_hook(
        point: crate::fs_safety::source_claim::ClaimTestPoint,
        source: &Path,
        _claim: &Path,
    ) {
        if point == crate::fs_safety::source_claim::ClaimTestPoint::AfterJournalPreparedBeforeClaim
        {
            fs::write(source, b"replacement after journal").expect("replacement source");
        }
    }

    #[cfg(windows)]
    #[test]
    fn pending_journal_source_replacement_is_manual_review_and_never_moves_replacement() {
        let _serial = crate::fs_safety::source_claim::lock_claim_test_hooks();
        let db = Database::open(test_db_path()).expect("open database");
        let root = test_dir();
        let source = root.join("source.txt");
        let target = root.join("target.txt");
        fs::write(&source, b"original").expect("source");
        crate::fs_safety::source_claim::set_claim_test_hook(Some(
            replace_source_after_journal_hook,
        ));
        let result = execute_moves_with_persistence(
            &db,
            ExecuteMovesRequest {
                operations: vec![preview_operation(0, &source, &target)],
            },
        )
        .expect("journaled execution");
        crate::fs_safety::source_claim::set_claim_test_hook(None);

        assert_eq!(result.logs[0].status, "failed");
        assert_eq!(result.logs[0].operation_phase, "rolled_back");
        assert!(!target.exists());
        assert_eq!(
            fs::read(&source).expect("replacement source"),
            b"replacement after journal"
        );
        let logs = db.get_operation_logs(Some(10)).expect("operation logs");
        assert_eq!(logs[0].operation_phase, "rolled_back");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn source_claimed_phase_persistence_failure_rolls_back_before_target_commit() {
        let db_path = test_db_path();
        let db = Database::open(&db_path).expect("open database");
        let conn = rusqlite::Connection::open(&db_path).expect("open trigger connection");
        conn.execute_batch(
            r#"
            CREATE TRIGGER reject_source_claimed_phase
            BEFORE UPDATE OF operation_phase ON operation_logs
            WHEN NEW.operation_phase = 'source_claimed'
            BEGIN
                SELECT RAISE(ABORT, 'injected source_claimed persistence failure');
            END;
            "#,
        )
        .expect("install phase failure trigger");
        drop(conn);
        let root = test_dir();
        let source = root.join("source.txt");
        let target = root.join("target.txt");
        fs::write(&source, b"phase gated source").expect("source");

        let result = execute_moves_with_persistence(
            &db,
            ExecuteMovesRequest {
                operations: vec![preview_operation(0, &source, &target)],
            },
        );

        assert!(result.is_err());
        assert_eq!(
            fs::read(&source).expect("rolled back source"),
            b"phase gated source"
        );
        assert!(!target.exists());
        assert!(!fs::read_dir(&root)
            .expect("fixture entries")
            .filter_map(Result::ok)
            .any(|entry| entry
                .file_name()
                .to_string_lossy()
                .starts_with(".zen-canvas-claim-")));
        assert_eq!(
            db.get_pending_operation_logs().expect("pending logs").len(),
            1
        );
        assert_eq!(
            reconcile_pending_operation_journal(&db).expect("reconcile journal"),
            1
        );
        let reconciled = db.get_operation_logs(Some(1)).expect("reconciled logs");
        assert_eq!(reconciled[0].status, "failed");
        assert_eq!(reconciled[0].operation_phase, "rolled_back");
        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn target_committed_phase_persistence_failure_records_manual_review_without_rollback() {
        let db_path = test_db_path();
        let db = Database::open(&db_path).expect("open database");
        let conn = rusqlite::Connection::open(&db_path).expect("open trigger connection");
        conn.execute_batch(
            r#"
            CREATE TRIGGER reject_target_committed_phase
            BEFORE UPDATE OF operation_phase ON operation_logs
            WHEN NEW.operation_phase = 'target_committed'
            BEGIN
                SELECT RAISE(ABORT, 'injected target_committed persistence failure');
            END;
            "#,
        )
        .expect("install phase failure trigger");
        drop(conn);
        let root = test_dir();
        let source = root.join("source.txt");
        let target = root.join("target.txt");
        fs::write(&source, b"committed source").expect("source");

        let result = execute_moves_with_persistence(
            &db,
            ExecuteMovesRequest {
                operations: vec![preview_operation(0, &source, &target)],
            },
        );

        assert!(result.is_err());
        assert!(!source.exists());
        assert_eq!(
            fs::read(&target).expect("committed target"),
            b"committed source"
        );
        let pending = db.get_pending_operation_logs().expect("pending logs");
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].operation_phase, "source_claimed");
        assert_eq!(
            reconcile_pending_operation_journal(&db).expect("reconcile"),
            1
        );
        let persisted = db.get_operation_logs(Some(1)).expect("operation logs");
        assert_eq!(persisted[0].status, "success");
        assert_eq!(persisted[0].operation_phase, "completed");
        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_file(db_path);
    }

    #[cfg(any(windows, target_os = "macos"))]
    #[test]
    fn completed_phase_waits_for_final_log_persistence_and_reconciles_after_injected_failure() {
        let db_path = test_db_path();
        let db = Database::open(&db_path).expect("open database");
        let root = test_dir();
        let source = root.join("source.txt");
        let target = root.join("target.txt");
        fs::write(&source, b"final log boundary").expect("source");

        set_operation_test_fault(Some(
            OperationTestFaultPoint::AfterCompletedPhaseBeforeFinalLogPersist,
        ));
        let result = execute_moves_with_persistence(
            &db,
            ExecuteMovesRequest {
                operations: vec![preview_operation(0, &source, &target)],
            },
        );

        assert!(result.is_err());
        assert!(!source.exists());
        assert_eq!(
            fs::read(&target).expect("committed target"),
            b"final log boundary"
        );

        let pending = db
            .get_pending_operation_logs()
            .expect("pending operation logs");
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].status, "pending");
        assert_eq!(pending[0].operation_phase, "completed");

        assert_eq!(
            reconcile_pending_operation_journal(&db).expect("reconcile"),
            1
        );
        let reconciled = db.get_operation_logs(Some(1)).expect("reconciled logs");
        assert_eq!(reconciled[0].status, "success");
        assert_eq!(reconciled[0].operation_phase, "completed");
        assert!(db
            .get_pending_operation_logs()
            .expect("pending after reconcile")
            .is_empty());

        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_file(db_path);
    }

    #[test]
    fn execute_moves_updates_fts_after_rename() {
        let db = Database::open(test_db_path()).expect("open database");
        let root = test_dir();
        let source = root.join("old-name.txt");
        let renamed = root.join("new-report.txt");
        fs::write(&source, "hello").expect("write source");
        insert_indexed_file(&db, &source, "old-name.txt", "txt");

        execute_moves_with_persistence(
            &db,
            ExecuteMovesRequest {
                operations: vec![OperationPreviewRequest {
                    id: "op-rename".to_string(),
                    file_id: source.to_string_lossy().into_owned(),
                    operation_type: "rename".to_string(),
                    source_path: source.to_string_lossy().into_owned(),
                    target_path: renamed.to_string_lossy().into_owned(),
                    old_name: "old-name.txt".to_string(),
                    new_name: "new-report.txt".to_string(),
                    is_executable: Some(true),
                }],
            },
        )
        .expect("execute moves with persistence");

        let new_results = db.search_files("new-report", Some(10)).expect("search new");
        let old_results = db.search_files("old-name", Some(10)).expect("search old");

        assert_eq!(new_results.len(), 1);
        assert_eq!(new_results[0].name, "new-report.txt");
        assert_eq!(new_results[0].path, canonical_test_path(&renamed));
        assert!(old_results
            .iter()
            .all(|result| result.path != normalize_path(&source)));
    }

    #[test]
    fn execute_moves_updates_file_record_after_move() {
        let db = Database::open(test_db_path()).expect("open database");
        let root = test_dir();
        let source_dir = root.join("source");
        let target_dir = root.join("target");
        fs::create_dir_all(&source_dir).expect("source dir");
        fs::create_dir_all(&target_dir).expect("target dir");
        let source = source_dir.join("a.txt");
        let target = target_dir.join("a.txt");
        fs::write(&source, "hello").expect("write source");
        insert_indexed_file(&db, &source, "a.txt", "txt");

        execute_moves_with_persistence(
            &db,
            ExecuteMovesRequest {
                operations: vec![OperationPreviewRequest {
                    id: "op-move".to_string(),
                    file_id: source.to_string_lossy().into_owned(),
                    operation_type: "move".to_string(),
                    source_path: source.to_string_lossy().into_owned(),
                    target_path: target.to_string_lossy().into_owned(),
                    old_name: "a.txt".to_string(),
                    new_name: "a.txt".to_string(),
                    is_executable: Some(true),
                }],
            },
        )
        .expect("execute moves with persistence");
        let page = db.get_paged_files(Some(10), Some(0), None).expect("page");

        assert_eq!(page.total, 1);
        assert_eq!(page.files[0].path, canonical_test_path(&target));
        assert_eq!(page.files[0].id, canonical_test_path(&target));
    }

    #[test]
    fn execute_moves_does_not_fail_when_file_record_missing() {
        let db = Database::open(test_db_path()).expect("open database");
        let root = test_dir();
        let source_dir = root.join("source");
        let target_dir = root.join("target");
        fs::create_dir_all(&source_dir).expect("source dir");
        fs::create_dir_all(&target_dir).expect("target dir");
        let source = source_dir.join("missing-record.txt");
        let target = target_dir.join("missing-record.txt");
        fs::write(&source, "hello").expect("write source");

        let result = execute_moves_with_persistence(
            &db,
            ExecuteMovesRequest {
                operations: vec![OperationPreviewRequest {
                    id: "op-missing-record".to_string(),
                    file_id: source.to_string_lossy().into_owned(),
                    operation_type: "move".to_string(),
                    source_path: source.to_string_lossy().into_owned(),
                    target_path: target.to_string_lossy().into_owned(),
                    old_name: "missing-record.txt".to_string(),
                    new_name: "missing-record.txt".to_string(),
                    is_executable: Some(true),
                }],
            },
        )
        .expect("execute moves with persistence");
        let logs = db.get_operation_logs(Some(10)).expect("operation logs");
        let page = db.get_paged_files(Some(10), Some(0), None).expect("page");

        assert_eq!(result.logs[0].status, "success");
        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].id, result.logs[0].id);
        assert_eq!(page.total, 0);
        assert!(target.exists());
    }

    #[test]
    fn restore_moves_updates_file_record_after_move_restore() {
        let db = Database::open(test_db_path()).expect("open database");
        let root = test_dir();
        let source_dir = root.join("source");
        let target_dir = root.join("target");
        fs::create_dir_all(&source_dir).expect("source dir");
        fs::create_dir_all(&target_dir).expect("target dir");
        let source = source_dir.join("a.txt");
        let target = target_dir.join("a.txt");
        fs::write(&source, "hello").expect("write source");
        insert_indexed_file(&db, &source, "a.txt", "txt");

        let executed = execute_moves_with_persistence(
            &db,
            ExecuteMovesRequest {
                operations: vec![OperationPreviewRequest {
                    id: "op-move".to_string(),
                    file_id: source.to_string_lossy().into_owned(),
                    operation_type: "move".to_string(),
                    source_path: source.to_string_lossy().into_owned(),
                    target_path: target.to_string_lossy().into_owned(),
                    old_name: "a.txt".to_string(),
                    new_name: "a.txt".to_string(),
                    is_executable: Some(true),
                }],
            },
        )
        .expect("execute moves with persistence");

        restore_moves_with_persistence(
            &db,
            RestoreMovesRequest {
                logs: executed.logs.clone(),
            },
        )
        .expect("restore moves with persistence");
        let page = db.get_paged_files(Some(10), Some(0), None).expect("page");

        assert_eq!(page.total, 1);
        assert_eq!(page.files[0].path, normalize_path(&source));
        assert_eq!(page.files[0].id, normalize_path(&source));
        assert_eq!(page.files[0].name, "a.txt");
        assert_eq!(page.files[0].extension, "txt");
        assert_eq!(page.files[0].suggested_action, "Keep");
        assert!(!page.files[0].requires_confirmation);
    }

    #[test]
    fn restore_moves_updates_file_record_after_rename_restore() {
        let db = Database::open(test_db_path()).expect("open database");
        let root = test_dir();
        let source = root.join("old-name.txt");
        let renamed = root.join("new-name.txt");
        fs::write(&source, "hello").expect("write source");
        insert_indexed_file(&db, &source, "old-name.txt", "txt");

        let executed = execute_moves_with_persistence(
            &db,
            ExecuteMovesRequest {
                operations: vec![OperationPreviewRequest {
                    id: "op-rename".to_string(),
                    file_id: source.to_string_lossy().into_owned(),
                    operation_type: "rename".to_string(),
                    source_path: source.to_string_lossy().into_owned(),
                    target_path: renamed.to_string_lossy().into_owned(),
                    old_name: "old-name.txt".to_string(),
                    new_name: "new-name.txt".to_string(),
                    is_executable: Some(true),
                }],
            },
        )
        .expect("execute moves with persistence");

        let after_execute = db.get_paged_files(Some(10), Some(0), None).expect("page");
        assert_eq!(after_execute.files[0].name, "new-name.txt");

        restore_moves_with_persistence(
            &db,
            RestoreMovesRequest {
                logs: executed.logs.clone(),
            },
        )
        .expect("restore moves with persistence");
        let page = db.get_paged_files(Some(10), Some(0), None).expect("page");

        assert_eq!(page.total, 1);
        assert_eq!(page.files[0].name, "old-name.txt");
        assert_eq!(page.files[0].path, normalize_path(&source));
        assert_eq!(page.files[0].id, normalize_path(&source));
        assert_eq!(page.files[0].extension, "txt");
    }

    #[test]
    fn restore_moves_updates_fts_after_restore() {
        let db = Database::open(test_db_path()).expect("open database");
        let root = test_dir();
        let source = root.join("old-report.txt");
        let renamed = root.join("new-report.txt");
        fs::write(&source, "hello").expect("write source");
        insert_indexed_file(&db, &source, "old-report.txt", "txt");

        let executed = execute_moves_with_persistence(
            &db,
            ExecuteMovesRequest {
                operations: vec![OperationPreviewRequest {
                    id: "op-rename".to_string(),
                    file_id: source.to_string_lossy().into_owned(),
                    operation_type: "rename".to_string(),
                    source_path: source.to_string_lossy().into_owned(),
                    target_path: renamed.to_string_lossy().into_owned(),
                    old_name: "old-report.txt".to_string(),
                    new_name: "new-report.txt".to_string(),
                    is_executable: Some(true),
                }],
            },
        )
        .expect("execute moves with persistence");
        assert_eq!(
            db.search_files("new-report", Some(10))
                .expect("search after execute")
                .len(),
            1
        );

        restore_moves_with_persistence(
            &db,
            RestoreMovesRequest {
                logs: executed.logs.clone(),
            },
        )
        .expect("restore moves with persistence");
        let old_results = db
            .search_files("old-report", Some(10))
            .expect("search old after restore");
        let new_results = db
            .search_files("new-report", Some(10))
            .expect("search new after restore");

        assert_eq!(old_results.len(), 1);
        assert_eq!(old_results[0].path, normalize_path(&source));
        assert_eq!(old_results[0].name, "old-report.txt");
        assert!(new_results
            .iter()
            .all(|result| result.path != normalize_path(&renamed)));
    }

    #[test]
    fn restore_moves_does_not_fail_when_file_record_missing() {
        let db = Database::open(test_db_path()).expect("open database");
        let root = test_dir();
        let source_dir = root.join("source");
        let target_dir = root.join("target");
        fs::create_dir_all(&source_dir).expect("source dir");
        fs::create_dir_all(&target_dir).expect("target dir");
        let source = source_dir.join("missing-record.txt");
        let target = target_dir.join("missing-record.txt");
        fs::write(&source, "hello").expect("write source");

        let executed = execute_moves_with_persistence(
            &db,
            ExecuteMovesRequest {
                operations: vec![OperationPreviewRequest {
                    id: "op-missing-record".to_string(),
                    file_id: source.to_string_lossy().into_owned(),
                    operation_type: "move".to_string(),
                    source_path: source.to_string_lossy().into_owned(),
                    target_path: target.to_string_lossy().into_owned(),
                    old_name: "missing-record.txt".to_string(),
                    new_name: "missing-record.txt".to_string(),
                    is_executable: Some(true),
                }],
            },
        )
        .expect("execute moves with persistence");

        let restored = restore_moves_with_persistence(
            &db,
            RestoreMovesRequest {
                logs: executed.logs.clone(),
            },
        )
        .expect("restore moves with persistence");
        let logs = db.get_operation_logs(Some(10)).expect("operation logs");
        let page = db.get_paged_files(Some(10), Some(0), None).expect("page");

        assert_eq!(restored.restored, 1);
        assert_eq!(restored.logs[0].restore_status, "restored");
        assert_eq!(logs[0].restore_status, "restored");
        assert_eq!(page.total, 1);
        assert_eq!(page.files[0].path, normalize_path(&source));
        assert_eq!(page.files[0].name, "missing-record.txt");
        assert!(source.exists());
    }

    #[cfg(windows)]
    #[test]
    fn build_reveal_command_selects_file_with_windows_explorer() {
        let command = build_reveal_command(Path::new("C:/Users/example/Documents/sample.txt"))
            .expect("reveal command");

        assert_eq!(command.program, "explorer");
        assert_eq!(
            command.args,
            vec!["/select,C:\\Users\\example\\Documents\\sample.txt"]
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn build_reveal_command_selects_file_with_macos_open() {
        let command = build_reveal_command(Path::new("/Users/example/Documents/sample.txt"))
            .expect("reveal command");

        assert_eq!(command.program, "open");
        assert_eq!(
            command.args,
            vec!["-R", "/Users/example/Documents/sample.txt"]
        );
    }

    fn test_dir() -> PathBuf {
        let sequence = TEST_FIXTURE_COUNTER.fetch_add(1, Ordering::Relaxed);
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "zen-canvas-file-op-test-{}-{sequence}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&dir).expect("test dir");
        dir
    }

    fn test_db_path() -> PathBuf {
        let sequence = TEST_FIXTURE_COUNTER.fetch_add(1, Ordering::Relaxed);
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "zen-canvas-file-op-db-test-{}-{sequence}-{nonce}.sqlite3",
            std::process::id()
        ))
    }

    fn insert_indexed_file(db: &Database, path: &Path, name: &str, extension: &str) {
        let path = path.to_string_lossy().into_owned();
        db.insert_file(InsertFileRequest {
            id: path.clone(),
            path,
            name: name.to_string(),
            extension: extension.to_string(),
            size: 5,
            mtime: 1_900_000_000,
            ctime: 0,
            is_dir: false,
            state_code: 0,
        })
        .expect("insert indexed file");
    }

    fn preview_operation(index: usize, source: &Path, target: &Path) -> OperationPreviewRequest {
        let name = source
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("sample.txt")
            .to_string();
        OperationPreviewRequest {
            id: format!("op-{index}"),
            file_id: source.to_string_lossy().into_owned(),
            operation_type: "move".to_string(),
            source_path: source.to_string_lossy().into_owned(),
            target_path: target.to_string_lossy().into_owned(),
            old_name: name.clone(),
            new_name: name,
            is_executable: Some(true),
        }
    }

    fn create_file_symlink_for_test(target: &Path, link: &Path) -> io::Result<()> {
        #[cfg(windows)]
        {
            std::os::windows::fs::symlink_file(target, link)
        }
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(target, link)
        }
    }

    fn create_directory_symlink_for_test(target: &Path, link: &Path) -> io::Result<()> {
        #[cfg(windows)]
        {
            std::os::windows::fs::symlink_dir(target, link)
        }
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(target, link)
        }
    }

    fn canonical_test_path(path: &Path) -> String {
        normalize_path(&fs::canonicalize(path).expect("canonical test path"))
            .trim_start_matches("//?/")
            .to_string()
    }

    struct RecordingOperationProgressEmitter {
        events: std::cell::RefCell<Vec<OperationProgressPayload>>,
        cancel_after: u64,
        cancel_flag: Arc<AtomicBool>,
    }

    impl RecordingOperationProgressEmitter {
        fn cancel_after(cancel_after: u64, cancel_flag: Arc<AtomicBool>) -> Self {
            Self {
                events: std::cell::RefCell::new(Vec::new()),
                cancel_after,
                cancel_flag,
            }
        }

        fn events(&self) -> Vec<OperationProgressPayload> {
            self.events.borrow().clone()
        }
    }

    impl OperationProgressEmitter for RecordingOperationProgressEmitter {
        fn emit_progress(&self, payload: OperationProgressPayload) {
            if payload.processed >= self.cancel_after {
                self.cancel_flag.store(true, Ordering::Relaxed);
            }
            self.events.borrow_mut().push(payload);
        }
    }

    struct CancelAfterFirstRead<'a, R> {
        inner: R,
        cancel_flag: &'a AtomicBool,
        reads: usize,
    }

    impl<'a, R> CancelAfterFirstRead<'a, R> {
        fn new(inner: R, cancel_flag: &'a AtomicBool) -> Self {
            Self {
                inner,
                cancel_flag,
                reads: 0,
            }
        }
    }

    impl<R: Read> Read for CancelAfterFirstRead<'_, R> {
        fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
            let bytes_read = self.inner.read(buf)?;
            if bytes_read > 0 && self.reads == 0 {
                self.cancel_flag.store(true, Ordering::Relaxed);
            }
            self.reads += 1;
            Ok(bytes_read)
        }
    }
}
