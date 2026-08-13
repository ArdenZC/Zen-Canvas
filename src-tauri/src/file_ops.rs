use crate::path_identity::normalize_path;
use crate::{
    db::Database,
    file_naming::{normalize_proposed_file_name, ExtensionChangePolicy},
    ids::new_job_id,
    window_auth::require_main_window,
};
#[cfg(all(test, windows))]
use std::io::Read;
use std::{
    env, fs, io,
    path::{Path, PathBuf},
    process::Command as ProcessCommand,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{command, AppHandle, Emitter, Manager, Runtime, State, WebviewWindow};

mod authority;
mod execution;
mod identity;
mod journal;
mod preview;
mod progress;
mod recovery;
mod restore;
mod reveal;
mod types;
mod validation;
pub(crate) use authority::resolve_execute_selections;
pub(crate) use execution::*;
pub(crate) use identity::{file_identity_fingerprint, FileIdentityFingerprint};
pub(crate) use journal::*;
pub(crate) use preview::*;
use progress::OperationProgressBuffer;
pub use recovery::reconcile_pending_operation_journal;
pub(crate) use recovery::*;
#[cfg(any(test, feature = "native-qa", target_os = "macos"))]
pub use restore::restore_moves_with_persistence;
pub(crate) use restore::*;
pub(crate) use reveal::*;
pub use types::*;
pub(crate) use validation::*;

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
            None,
        )
    })
    .await
    .map_err(|error| format!("operation task failed: {error}"))?
}

/// Executes an already canonicalized backend-owned operation set without
/// resolving a second preview/target after the caller's approval fingerprint.
pub(crate) async fn execute_canonical_operations<R: Runtime>(
    app: AppHandle<R>,
    db: Database,
    cancel: OperationCancellationToken,
    request: ExecuteMovesRequest,
    batch_id: String,
) -> Result<ExecuteMovesResult, String> {
    if request.operations.is_empty() {
        return Err("At least one canonical operation is required.".to_string());
    }
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
            Some(batch_id),
        )
    })
    .await
    .map_err(|error| format!("operation task failed: {error}"))?
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
        None,
    )
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

    /// Environmental-failure resilience for tests that move real files
    /// (`docs/remediation/issue-file-ops-flaky.md`, F1).  Under system load,
    /// external processes (antivirus / indexer scans) briefly hold handles on
    /// freshly created fixtures, so a move fails with a Windows sharing
    /// violation (`os error 32`) or trips the post-commit identity check into
    /// `target_committed_identity_mismatch`.  Both are environment noise, not
    /// logic regressions — the safety layer responding to them is behaving
    /// correctly.  Affected tests rebuild their fixture from scratch and retry
    /// a bounded number of times; every retry is reported and the run aborts
    /// loudly once the limit is reached.  Silent retry is forbidden (裁决 D7).
    const ENVIRONMENTAL_ATTEMPT_LIMIT: usize = 3;

    fn environmental_failure_signature(logs: &[OperationLogDto]) -> Option<String> {
        logs.iter().find_map(|log| {
            [log.error_message.as_deref(), log.restore_error.as_deref()]
                .into_iter()
                .flatten()
                .find(|message| {
                    message.contains("os error 32")
                        || message.contains("target_committed_identity_mismatch")
                })
                .map(|message| format!("{}: {message}", log.id))
        })
    }

    /// Appends one line per environmental event to the file named by
    /// `ZEN_CANVAS_ENV_RETRY_LOG` (set by CI, F2) so retries leave a durable,
    /// countable trace even when the test ultimately passes.
    fn record_environmental_event(test_name: &str, event: &str) {
        eprintln!("[env-retry] {test_name}: {event}");
        if let Ok(log_path) = std::env::var("ZEN_CANVAS_ENV_RETRY_LOG") {
            if let Ok(mut file) = fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(log_path)
            {
                use std::io::Write as _;
                // Parallel tests append concurrently: emit the whole line in one
                // write so records never interleave mid-line.
                let line = format!("{test_name}\t{event}\n");
                let _ = file.write_all(line.as_bytes());
            }
        }
    }

    fn with_environmental_retry(test_name: &str, mut attempt: impl FnMut() -> Result<(), String>) {
        let mut signatures = Vec::new();
        for attempt_number in 1..=ENVIRONMENTAL_ATTEMPT_LIMIT {
            match attempt() {
                Ok(()) => {
                    if attempt_number > 1 {
                        record_environmental_event(
                            test_name,
                            &format!(
                                "passed on attempt {attempt_number}/{ENVIRONMENTAL_ATTEMPT_LIMIT} after: {signatures:?}"
                            ),
                        );
                    }
                    return;
                }
                Err(signature) => {
                    record_environmental_event(
                        test_name,
                        &format!(
                            "environmental failure on attempt {attempt_number}/{ENVIRONMENTAL_ATTEMPT_LIMIT}: {signature}"
                        ),
                    );
                    signatures.push(signature);
                }
            }
        }
        record_environmental_event(
            test_name,
            &format!("exhausted {ENVIRONMENTAL_ATTEMPT_LIMIT} attempts: {signatures:?}"),
        );
        panic!(
            "[env-retry] {test_name}: environmental failure persisted through \
             {ENVIRONMENTAL_ATTEMPT_LIMIT} attempts ({signatures:?}); see \
             docs/remediation/issue-file-ops-flaky.md — investigate, do not dismiss by rerunning"
        );
    }

    #[test]
    fn environmental_retry_reports_and_recovers_within_the_attempt_limit() {
        let mut attempts = 0;
        with_environmental_retry("environmental-retry-recovers", || {
            attempts += 1;
            if attempts < ENVIRONMENTAL_ATTEMPT_LIMIT {
                Err(format!("op-{attempts}: simulated (os error 32)"))
            } else {
                Ok(())
            }
        });
        assert_eq!(attempts, ENVIRONMENTAL_ATTEMPT_LIMIT);
    }

    #[test]
    #[should_panic(expected = "environmental failure persisted")]
    fn environmental_retry_fails_loudly_when_attempts_are_exhausted() {
        with_environmental_retry("environmental-retry-exhausted", || {
            Err("op-x: simulated (os error 32)".to_string())
        });
    }

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
        with_environmental_retry(
            "execute_moves_core_moves_files_and_returns_success_log",
            || {
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
                if let Some(signature) = environmental_failure_signature(&result.logs) {
                    let _ = fs::remove_dir_all(&root);
                    return Err(signature);
                }

                assert!(!source.exists());
                assert!(target.exists());
                assert_eq!(result.logs.len(), 1);
                assert_eq!(result.logs[0].status, "success");
                assert_eq!(result.logs[0].operation_type, "move");
                Ok(())
            },
        );
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
        with_environmental_retry(
            "execute_moves_core_creates_safe_missing_target_parent",
            || {
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
                if let Some(signature) = environmental_failure_signature(&result.logs) {
                    let _ = fs::remove_dir_all(&root);
                    return Err(signature);
                }

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
                Ok(())
            },
        );
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
        with_environmental_retry(
            "execute_moves_core_marks_remaining_operations_skipped_when_cancelled",
            || {
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
                if let Some(signature) = environmental_failure_signature(&result.logs) {
                    let _ = fs::remove_dir_all(&root);
                    return Err(signature);
                }

                run_cancelled_moves_assertions(
                    result,
                    &cancelled_source,
                    &cancelled_target,
                    &progress,
                );
                Ok(())
            },
        );
    }

    fn run_cancelled_moves_assertions(
        result: ExecuteMovesResult,
        cancelled_source: &Path,
        cancelled_target: &Path,
        progress: &RecordingOperationProgressEmitter,
    ) {
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
    fn cleanup_rejects_windows_system_directory_without_filesystem_access() {
        let error = ensure_general_file_operation_allowed_for_os(
            Path::new("C:/Windows/System32"),
            "windows",
        )
        .expect_err("Windows system directories must be rejected lexically");

        assert!(error.contains("protected system location"));
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
        with_environmental_retry(
            "restore_blocks_legacy_operation_logs_without_identity",
            || {
                let root = test_dir();
                let source = root.join("legacy-before.txt");
                let target = root.join("legacy-after.txt");
                fs::write(&source, "legacy").expect("write source");
                let mut executed = execute_moves_core(ExecuteMovesRequest {
                    operations: vec![preview_operation(0, &source, &target)],
                });
                if let Some(signature) = environmental_failure_signature(&executed.logs) {
                    let _ = fs::remove_dir_all(&root);
                    return Err(signature);
                }
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
                Ok(())
            },
        );
    }

    #[test]
    fn restore_moves_core_marks_remaining_logs_canceled_when_cancelled() {
        with_environmental_retry(
            "restore_moves_core_marks_remaining_logs_canceled_when_cancelled",
            || {
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
                if let Some(signature) = environmental_failure_signature(&executed.logs) {
                    let _ = fs::remove_dir_all(&root);
                    return Err(signature);
                }
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
                if let Some(signature) = environmental_failure_signature(&restored.logs) {
                    let _ = fs::remove_dir_all(&root);
                    return Err(signature);
                }

                assert_eq!(restored.restored, 10);
                assert_eq!(restored.failed, 0);
                assert_eq!(restored.logs[10].restore_status, "canceled");
                assert!(restored.logs[10].restore_error.is_none());
                assert!(!PathBuf::from(&canceled_log.path_before).exists());
                assert!(PathBuf::from(&canceled_log.path_after).exists());
                assert_eq!(
                    progress.events().last().map(|event| event.processed),
                    Some(11)
                );
                assert_eq!(progress.events().last().map(|event| event.total), Some(11));
                Ok(())
            },
        );
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
        with_environmental_retry(
            "source_claimed_phase_persistence_failure_rolls_back_before_target_commit",
            || {
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
                // Environmental modes mirror the target_committed sibling: a sharing
                // violation before the trigger fires yields Ok with a failed log, or
                // surfaces through the batch error string.
                let environmental = match &result {
                    Ok(ok_result) => environmental_failure_signature(&ok_result.logs),
                    Err(message) if message.contains("os error 32") => {
                        Some(format!("batch error: {message}"))
                    }
                    Err(_) => None,
                };
                if let Some(signature) = environmental {
                    let _ = fs::remove_dir_all(&root);
                    let _ = fs::remove_file(&db_path);
                    return Err(signature);
                }

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
                let _ = fs::remove_dir_all(&root);
                let _ = fs::remove_file(&db_path);
                Ok(())
            },
        );
    }

    #[test]
    fn target_committed_phase_persistence_failure_records_manual_review_without_rollback() {
        with_environmental_retry(
            "target_committed_phase_persistence_failure_records_manual_review_without_rollback",
            || {
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
                // Environmental modes: the move fails before reaching target_committed
                // (sharing violation / identity mismatch) so the injected trigger never
                // fires and the batch returns Ok with a failed log — or the sharing
                // violation surfaces through the batch error string itself.
                let environmental = match &result {
                    Ok(ok_result) => environmental_failure_signature(&ok_result.logs),
                    Err(message) if message.contains("os error 32") => {
                        Some(format!("batch error: {message}"))
                    }
                    Err(_) => None,
                };
                if let Some(signature) = environmental {
                    let _ = fs::remove_dir_all(&root);
                    let _ = fs::remove_file(&db_path);
                    return Err(signature);
                }

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
                if let Some(signature) = environmental_failure_signature(&persisted) {
                    let _ = fs::remove_dir_all(&root);
                    let _ = fs::remove_file(&db_path);
                    return Err(signature);
                }
                assert_eq!(persisted[0].status, "success");
                assert_eq!(persisted[0].operation_phase, "completed");
                let _ = fs::remove_dir_all(&root);
                let _ = fs::remove_file(&db_path);
                Ok(())
            },
        );
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
