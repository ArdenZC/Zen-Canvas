use crate::db::scan::{
    ScanAdmissionOptions, ScanBatchInput, ScanErrorInput, ScanFinalization, ScanFinalizeInput,
    ScanRunRecord,
};
use crate::db::{
    current_unix_seconds, emit_search_index_optimized, run_search_index_optimize, Database,
    DbError, InsertFileRequest,
};
use crate::dedupe::{spawn_duplicate_detection, DedupeJobManager};
use crate::ids::new_job_id;
use crate::path_filter::is_ignored_dir_name;
use crate::window_auth::require_main_window;
use jwalk::{ClientState, DirEntry, WalkDir};
use serde::Serialize;
use std::{
    collections::HashMap,
    ffi::OsStr,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Runtime, State, WebviewWindow};
use thiserror::Error;

pub use crate::db::scan::{
    ManagedScanRequest, ManagedScanStartDto, ScanRootDto, ScanRunDto, ScanSessionDto,
    ScanSessionRootDto,
};

const SCAN_BATCH_SIZE: usize = 500;
const SCAN_EMIT_INTERVAL: Duration = Duration::from_millis(200);
const SCAN_STARTED_EVENT: &str = "scan-started";
const SCAN_BATCH_EVENT: &str = "scan-batch";
const SCAN_PROGRESS_EVENT: &str = "scan-progress";
const SCAN_COMPLETE_EVENT: &str = "scan-complete";
const SCAN_CANCELED_EVENT: &str = "scan-canceled";
const SCAN_ERROR_EVENT: &str = "scan-error";
pub const MANAGED_SCAN_EVENT: &str = "scan-run-updated";

#[derive(Debug, Error)]
enum ScanError {
    #[error("scan root does not exist: {0}")]
    MissingRoot(String),
    #[error("scan root is not a readable file-system path: {0}")]
    InvalidRoot(String),
    #[error("metadata error at {path}: {source}")]
    Metadata {
        path: String,
        #[source]
        source: jwalk::Error,
    },
    #[error("database scan operation failed: {0}")]
    Database(#[from] DbError),
    #[error("scan task failed: {0}")]
    Join(String),
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedScanEvent {
    pub event_id: String,
    pub run_id: String,
    pub scan_root_id: String,
    pub parent_session_id: Option<String>,
    pub generation: i64,
    pub run_revision: i64,
    pub session_revision: i64,
    pub status: String,
    pub run_phase: String,
    pub session_phase: String,
    pub scanned_files: i64,
    pub scanned_directories: i64,
    pub processed_bytes: i64,
    pub warnings_count: i64,
    pub errors_count: i64,
    pub current_path: Option<String>,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScannedEntry {
    pub path: String,
    pub name: String,
    pub extension: String,
    pub size: u64,
    pub mtime: i64,
    pub ctime: i64,
    pub is_dir: bool,
    pub state_code: i32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgressPayload {
    pub job_id: String,
    pub job_kind: String,
    pub root: String,
    pub scanned: u64,
    pub files: u64,
    pub directories: u64,
    pub skipped: u64,
    pub errors: u64,
    pub elapsed_ms: u128,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanStartedPayload {
    pub job_id: String,
    pub job_kind: String,
    pub root: String,
    pub batch_size: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanBatchPayload {
    pub job_id: String,
    pub job_kind: String,
    pub root: String,
    pub batch_index: u64,
    pub entries: Vec<ScannedEntry>,
    pub progress: ScanProgressPayload,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanErrorPayload {
    pub job_id: String,
    pub job_kind: String,
    pub root: String,
    pub path: String,
    pub message: String,
}

pub type ScanSummary = ScanProgressPayload;

#[derive(Clone, Default)]
pub struct ScanJobManager(Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>);

impl ScanJobManager {
    fn register(&self, job_id: &str) -> Result<Arc<AtomicBool>, String> {
        let job_id = job_id.trim();
        if job_id.is_empty() || job_id.len() > 128 {
            return Err("A valid scan job ID is required.".to_string());
        }
        let mut jobs = self
            .0
            .lock()
            .map_err(|_| "Scan job manager is unavailable.".to_string())?;
        if jobs.contains_key(job_id) {
            return Err(format!("Scan job already exists: {job_id}."));
        }
        let token = Arc::new(AtomicBool::new(false));
        jobs.insert(job_id.to_string(), Arc::clone(&token));
        Ok(token)
    }

    fn token(&self, job_id: &str) -> Option<Arc<AtomicBool>> {
        self.0.lock().ok()?.get(job_id.trim()).cloned()
    }

    fn cancel(&self, job_id: &str) -> bool {
        let Ok(jobs) = self.0.lock() else {
            return false;
        };
        let Some(token) = jobs.get(job_id.trim()) else {
            return false;
        };
        token.store(true, Ordering::Release);
        true
    }

    fn finish(&self, job_id: &str) {
        if let Ok(mut jobs) = self.0.lock() {
            jobs.remove(job_id.trim());
        }
    }
}

#[tauri::command]
pub async fn start_managed_scan<R: Runtime>(
    app: AppHandle<R>,
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    jobs: State<'_, ScanJobManager>,
    dedupe_jobs: State<'_, DedupeJobManager>,
    request: ManagedScanRequest,
) -> Result<ManagedScanStartDto, String> {
    require_main_window(&window)?;
    let db = db.inner().clone();
    let jobs = jobs.inner().clone();
    let dedupe_jobs = dedupe_jobs.inner().clone();
    let admission = db
        .admit_managed_scan(&ScanAdmissionOptions {
            request: request.clone(),
            run_id_override: None,
        })
        .map_err(|error| error.to_string())?;
    let start = ManagedScanStartDto {
        session: admission.session.clone(),
        runs: admission.runs.clone(),
    };

    for run in &admission.runs {
        if let Ok(record) = db.get_scan_run_record(&run.id) {
            emit_managed_event_best_effort(&app, &db, &record, None);
        }
    }

    if admission.created && !admission.runs.is_empty() {
        for run in &admission.runs {
            jobs.register(&run.id)?;
        }
        let session_id = admission.session.id.clone();
        tauri::async_runtime::spawn_blocking(move || {
            if let Err(error) =
                run_managed_session(app, db, jobs, dedupe_jobs, session_id, admission.runs, None)
            {
                eprintln!("Managed scan session failed: {error}");
            }
        });
    }

    Ok(start)
}

#[tauri::command]
pub fn get_scan_run(db: State<'_, Database>, run_id: String) -> Result<ScanRunDto, String> {
    db.inner()
        .get_scan_run_record(&run_id)
        .map(|record| record.dto)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_scan_runs(
    db: State<'_, Database>,
    session_id: Option<String>,
    root_id: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<ScanRunDto>, String> {
    db.inner()
        .list_scan_runs(
            session_id.as_deref(),
            root_id.as_deref(),
            limit.unwrap_or(100),
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_scan_roots(db: State<'_, Database>) -> Result<Vec<ScanRootDto>, String> {
    db.inner()
        .list_scan_roots()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_scan_root_health(
    db: State<'_, Database>,
    root_id: Option<String>,
    path: Option<String>,
) -> Result<ScanRootDto, String> {
    db.inner()
        .get_scan_root_health(root_id.as_deref(), path.as_deref())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn cancel_scan_run<R: Runtime>(
    window: WebviewWindow<R>,
    app: AppHandle<R>,
    db: State<'_, Database>,
    jobs: State<'_, ScanJobManager>,
    dedupe_jobs: State<'_, DedupeJobManager>,
    run_id: String,
) -> Result<ScanRunDto, String> {
    require_main_window(&window)?;
    let db = db.inner().clone();
    let run = db
        .request_scan_cancellation(&run_id)
        .map_err(|error| error.to_string())?;
    if run.dto.cancel_requested || is_terminal_scan_status(&run.dto.status) {
        jobs.cancel(&run_id);
    }
    let dedupe_parent = run.dto.parent_session_id.as_deref().unwrap_or(&run_id);
    dedupe_jobs.cancel_for_scan(dedupe_parent);
    emit_managed_event_best_effort(&app, &db, &run, None);
    Ok(run.dto)
}

#[tauri::command]
pub async fn retry_interrupted_scan<R: Runtime>(
    app: AppHandle<R>,
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    jobs: State<'_, ScanJobManager>,
    dedupe_jobs: State<'_, DedupeJobManager>,
    run_id: String,
) -> Result<ManagedScanStartDto, String> {
    require_main_window(&window)?;
    let db = db.inner().clone();
    let jobs = jobs.inner().clone();
    let dedupe_jobs = dedupe_jobs.inner().clone();
    let previous = db
        .get_scan_run_record(&run_id)
        .map_err(|error| error.to_string())?;
    if previous.dto.status != "interrupted" {
        return Err("Only an interrupted scan run can be retried.".to_string());
    }
    let admission = db
        .admit_managed_scan(&ScanAdmissionOptions {
            request: ManagedScanRequest {
                roots: vec![previous.dto.root_path.clone()],
                request_key: None,
                dedupe: false,
            },
            run_id_override: None,
        })
        .map_err(|error| error.to_string())?;
    let start = ManagedScanStartDto {
        session: admission.session.clone(),
        runs: admission.runs.clone(),
    };
    for run in &admission.runs {
        if let Ok(record) = db.get_scan_run_record(&run.id) {
            emit_managed_event_best_effort(&app, &db, &record, None);
        }
        jobs.register(&run.id)?;
    }
    if admission.created && !admission.runs.is_empty() {
        tauri::async_runtime::spawn_blocking(move || {
            if let Err(error) = run_managed_session(
                app,
                db,
                jobs,
                dedupe_jobs,
                admission.session.id,
                admission.runs,
                None,
            ) {
                eprintln!("Retried scan session failed: {error}");
            }
        });
    }
    Ok(start)
}

#[tauri::command]
pub fn create_scan_job_id(job_kind: String) -> Result<String, String> {
    match job_kind.trim() {
        "foreground" => Ok(new_job_id("scan-foreground")),
        "background" => Ok(new_job_id("scan-background")),
        _ => Err("Scan job kind must be foreground or background.".to_string()),
    }
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn scan_directory<R: Runtime>(
    app: AppHandle<R>,
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    jobs: State<'_, ScanJobManager>,
    dedupe_jobs: State<'_, DedupeJobManager>,
    path: String,
    include_entries: bool,
    job_id: String,
    job_kind: String,
    run_dedupe: Option<bool>,
) -> Result<ScanSummary, String> {
    require_main_window(&window)?;
    if !matches!(job_kind.as_str(), "foreground" | "background") {
        return Err("Scan job kind must be foreground or background.".to_string());
    }
    let job_id = job_id.trim().to_string();
    if job_id.is_empty() || job_id.len() > 128 {
        return Err("A valid scan job ID is required.".to_string());
    }
    let db = db.inner().clone();
    let jobs = jobs.inner().clone();
    let dedupe_jobs = dedupe_jobs.inner().clone();
    let request = ManagedScanRequest {
        roots: vec![path],
        request_key: Some(job_id.clone()),
        dedupe: run_dedupe.unwrap_or(true),
    };
    let admission = db
        .admit_managed_scan(&ScanAdmissionOptions {
            request,
            run_id_override: Some(job_id.clone()),
        })
        .map_err(|error| error.to_string())?;
    if !admission.created {
        let run = admission
            .runs
            .first()
            .ok_or_else(|| "The legacy scan request has no effective run.".to_string())?;
        if is_terminal_scan_status(&run.status) {
            return legacy_summary_or_error(run, &job_kind, 0, Instant::now());
        }
        return Err(format!(
            "Scan request is already active: {}.",
            admission.session.id
        ));
    }
    let run = admission
        .runs
        .first()
        .ok_or_else(|| "The legacy scan request has no effective run.".to_string())?;
    let run_id = run.id.clone();
    let _cancel_flag = jobs.register(&run_id)?;
    let legacy = LegacyScanContext {
        job_kind,
        include_entries,
    };
    let legacy_job_kind = legacy.job_kind.clone();
    let session_id = admission.session.id;
    let run_ids = admission.runs;
    let jobs_for_task = jobs.clone();
    let run_id_for_task = run_id.clone();
    let result = tauri::async_runtime::spawn_blocking(move || -> Result<ScanSummary, String> {
        run_managed_session(
            app,
            db.clone(),
            jobs_for_task,
            dedupe_jobs,
            session_id,
            run_ids,
            Some(legacy),
        )
        .map_err(|error| error.to_string())?;
        let record = db
            .get_scan_run_record(&run_id_for_task)
            .map_err(|error| error.to_string())?;
        legacy_summary_or_error(&record.dto, &legacy_job_kind, 0, Instant::now())
    })
    .await
    .map_err(|error| ScanError::Join(error.to_string()).to_string())?;
    jobs.finish(&run_id);
    result
}

#[tauri::command]
pub fn cancel_scan<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    jobs: State<'_, ScanJobManager>,
    dedupe_jobs: State<'_, DedupeJobManager>,
    job_id: String,
) -> Result<(), String> {
    require_main_window(&window)?;
    let run = db
        .inner()
        .request_scan_cancellation(&job_id)
        .map_err(|error| error.to_string())?;
    if run.dto.cancel_requested || is_terminal_scan_status(&run.dto.status) {
        jobs.cancel(&job_id);
    }
    let dedupe_parent = run.dto.parent_session_id.as_deref().unwrap_or(&job_id);
    dedupe_jobs.cancel_for_scan(dedupe_parent);
    if is_terminal_scan_status(&run.dto.status) || jobs.token(&job_id).is_some() {
        Ok(())
    } else {
        Err(format!("Scan job not found: {job_id}."))
    }
}

pub fn recover_scan_state(db: &Database) -> Result<usize, DbError> {
    let recovered = db.recover_interrupted_scan_runs()?;
    db.prune_scan_observations()?;
    Ok(recovered)
}

#[derive(Debug, Clone)]
struct LegacyScanContext {
    job_kind: String,
    include_entries: bool,
}

#[derive(Debug, Clone, Copy)]
struct LedgerCursor {
    run_revision: i64,
    root_revision: i64,
    session_revision: i64,
}

impl LedgerCursor {
    fn from_record(record: &ScanRunRecord) -> Self {
        Self {
            run_revision: record.dto.revision,
            root_revision: record.root_revision,
            session_revision: record.session_revision,
        }
    }

    fn update(&mut self, record: &ScanRunRecord) {
        *self = Self::from_record(record);
    }
}

fn run_managed_session<R: Runtime>(
    app: AppHandle<R>,
    db: Database,
    jobs: ScanJobManager,
    dedupe_jobs: DedupeJobManager,
    session_id: String,
    runs: Vec<ScanRunDto>,
    legacy: Option<LegacyScanContext>,
) -> Result<(), ScanError> {
    for run in runs {
        let Some(cancel_flag) = jobs.token(&run.id) else {
            continue;
        };
        let result = run_scan_run(
            &app,
            &db,
            &dedupe_jobs,
            &session_id,
            &run.id,
            cancel_flag,
            legacy.as_ref(),
        );
        jobs.finish(&run.id);
        if let Err(error) = result {
            let still_active = db
                .get_scan_run_record(&run.id)
                .ok()
                .is_some_and(|record| !is_terminal_scan_status(&record.dto.status));
            if still_active {
                if let Err(abort_error) = abort_scan_run(&app, &db, &run.id, error) {
                    eprintln!(
                        "Managed scan run {} failed to finalize: {abort_error}",
                        run.id
                    );
                }
            } else {
                eprintln!("Managed scan run {} failed: {error}", run.id);
            }
        }
    }
    Ok(())
}

fn run_scan_run<R: Runtime>(
    app: &AppHandle<R>,
    db: &Database,
    dedupe_jobs: &DedupeJobManager,
    _session_id: &str,
    run_id: &str,
    cancel_flag: Arc<AtomicBool>,
    legacy: Option<&LegacyScanContext>,
) -> Result<(), ScanError> {
    let claimed = match db.claim_queued_scan_run(run_id) {
        Ok(record) => record,
        Err(error) => {
            if db
                .get_scan_run_record(run_id)
                .ok()
                .is_some_and(|record| is_terminal_scan_status(&record.dto.status))
            {
                return Ok(());
            }
            return Err(error.into());
        }
    };
    if claimed.dto.status != "running" {
        return Ok(());
    }
    let started_at = Instant::now();
    let root_label = claimed.dto.root_path.clone();
    let mut cursor = LedgerCursor::from_record(&claimed);
    emit_managed_event_best_effort(app, db, &claimed, Some(root_label.clone()));
    if let Some(legacy) = legacy {
        emit_legacy_started(app, run_id, legacy, &root_label);
    }

    let skipped = Arc::new(AtomicU64::new(0));
    let skipped_for_filter = Arc::clone(&skipped);
    let mut batch = ScanBatchBuffer::new(started_at);
    let root = PathBuf::from(&root_label);

    if let Err(error) = validate_root(&root) {
        batch.push_error(scan_error_input_for_root(&error, &root_label));
        if let Err(error) = flush_scan_batch(
            app,
            db,
            run_id,
            &mut cursor,
            &mut batch,
            &skipped,
            started_at,
            legacy,
        ) {
            return abort_scan_run(app, db, run_id, error);
        }
        let finalization = finish_scan_run(
            db,
            run_id,
            "requires_reconciliation",
            Some("root_unavailable"),
            Some("The scan root could not be opened."),
            false,
        )?;
        emit_terminal_events(
            app,
            db,
            &finalization,
            skipped.load(Ordering::Acquire),
            started_at,
            legacy,
        );
        return Ok(());
    }

    let walker = WalkDir::new(&root)
        .skip_hidden(true)
        .follow_links(false)
        .process_read_dir(move |_depth, _path, _state, children| {
            children.retain(|entry_result| match entry_result {
                Ok(entry)
                    if entry.file_type().is_dir() && is_ignored_dir_name(entry.file_name()) =>
                {
                    skipped_for_filter.fetch_add(1, Ordering::Relaxed);
                    false
                }
                _ => true,
            });
        });

    for entry_result in walker {
        if is_scan_cancelled(&cancel_flag) {
            break;
        }

        match entry_result {
            Ok(entry) => match entry_to_payload(&entry) {
                Ok(Some(payload)) => {
                    batch.push_entry(payload);
                }
                Ok(None) => {
                    skipped.fetch_add(1, Ordering::Relaxed);
                }
                Err(error) => {
                    batch.push_error(scan_error_input_for_error(&error));
                }
            },
            Err(error) => {
                batch.push_error(ScanErrorInput {
                    path: Some(root_label.clone()),
                    error_code: "traversal_error".to_string(),
                    error_message: error.to_string(),
                    affects_coverage: true,
                    metadata_error: false,
                });
            }
        }

        if batch.should_flush(Instant::now()) {
            if let Err(error) = flush_scan_batch(
                app,
                db,
                run_id,
                &mut cursor,
                &mut batch,
                &skipped,
                started_at,
                legacy,
            ) {
                return abort_scan_run(app, db, run_id, error);
            }
        }
    }

    let durable_before_flush = db.get_scan_run_record(run_id)?;
    let cancelled = is_scan_cancelled(&cancel_flag)
        || durable_before_flush.dto.cancel_requested
        || durable_before_flush.dto.status == "cancelling";
    if !cancelled && !batch.is_empty() {
        if let Err(error) = flush_scan_batch(
            app,
            db,
            run_id,
            &mut cursor,
            &mut batch,
            &skipped,
            started_at,
            legacy,
        ) {
            return abort_scan_run(app, db, run_id, error);
        }
    } else if cancelled {
        batch.clear();
    }

    let latest = db.get_scan_run_record(run_id)?;
    if cancelled || latest.dto.cancel_requested || latest.dto.status == "cancelling" {
        let finalization = finish_scan_run(
            db,
            run_id,
            "cancelled",
            Some("cancelled"),
            Some("The scan was cancelled before finalization."),
            false,
        )?;
        emit_terminal_events(
            app,
            db,
            &finalization,
            skipped.load(Ordering::Acquire),
            started_at,
            legacy,
        );
        return Ok(());
    }
    cursor.update(&latest);

    if latest.dto.coverage_error_count > 0 {
        let finalization = finish_scan_run(
            db,
            run_id,
            "requires_reconciliation",
            Some("coverage_incomplete"),
            Some("The scan encountered a metadata or traversal error; stale reconciliation was skipped."),
            false,
        )?;
        emit_terminal_events(
            app,
            db,
            &finalization,
            skipped.load(Ordering::Acquire),
            started_at,
            legacy,
        );
        return Ok(());
    }

    if should_run_stale_cleanup(false) {
        let reconciled = db.reconcile_missing(
            run_id,
            cursor.run_revision,
            cursor.root_revision,
            cursor.session_revision,
        )?;
        cursor.update(&reconciled);
    }
    let optimizing = db.transition_scan_run_phase(
        run_id,
        cursor.run_revision,
        cursor.root_revision,
        "optimizing_search",
    )?;
    cursor.update(&optimizing);
    emit_managed_event_best_effort(app, db, &optimizing, None);

    let report = run_search_index_optimize("scan_complete", db);
    emit_search_index_optimized(app, &report);
    let mut completed_with_warnings = false;
    if !report.success {
        completed_with_warnings = true;
        let warned = db.record_scan_warning(
            run_id,
            cursor.run_revision,
            cursor.root_revision,
            cursor.session_revision,
            "search_index_optimize_failed",
            report
                .error
                .as_deref()
                .unwrap_or("Search index optimize failed."),
        )?;
        cursor.update(&warned);
        emit_managed_event_best_effort(app, db, &warned, None);
    }
    let finalizing = db.transition_scan_run_phase(
        run_id,
        cursor.run_revision,
        cursor.root_revision,
        "finalizing",
    )?;
    cursor.update(&finalizing);
    let finalization = finish_scan_run(
        db,
        run_id,
        if completed_with_warnings {
            "completed_with_warnings"
        } else {
            "completed"
        },
        None,
        None,
        stale_reconciliation_enabled(),
    )?;
    emit_terminal_events(
        app,
        db,
        &finalization,
        skipped.load(Ordering::Acquire),
        started_at,
        legacy,
    );
    if finalization.dedupe_pending {
        dispatch_dedupe_if_pending(app, db, dedupe_jobs.clone(), &finalization, legacy);
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn flush_scan_batch<R: Runtime>(
    app: &AppHandle<R>,
    db: &Database,
    run_id: &str,
    cursor: &mut LedgerCursor,
    batch: &mut ScanBatchBuffer,
    skipped: &AtomicU64,
    started_at: Instant,
    legacy: Option<&LegacyScanContext>,
) -> Result<ScanRunRecord, ScanError> {
    if batch.is_empty() {
        return db.get_scan_run_record(run_id).map_err(ScanError::from);
    }
    let requests = batch
        .entries
        .iter()
        .map(scanned_entry_to_insert_request)
        .collect::<Vec<_>>();
    let current_path = batch.current_path();
    let input = ScanBatchInput {
        entries: &requests,
        errors: &batch.errors,
        scanned_files: batch.scanned_files,
        scanned_directories: batch.scanned_directories,
        processed_bytes: batch.processed_bytes,
        warnings: batch.warnings,
    };
    let updated = db.persist_scan_batch(
        run_id,
        cursor.run_revision,
        cursor.root_revision,
        cursor.session_revision,
        &input,
    )?;
    cursor.update(&updated);
    let entries = std::mem::take(&mut batch.entries);
    let errors = std::mem::take(&mut batch.errors);
    let progress = progress_payload_from_record(
        &updated,
        legacy
            .map(|value| value.job_kind.as_str())
            .unwrap_or("managed"),
        skipped.load(Ordering::Acquire),
        started_at,
    );
    emit_managed_event_best_effort(app, db, &updated, current_path);
    if let Some(legacy) = legacy {
        app.emit(
            SCAN_BATCH_EVENT,
            scan_batch_payload(
                &updated.dto.id,
                &legacy.job_kind,
                &updated.dto.root_path,
                batch.batch_index,
                entries.clone(),
                progress.clone(),
                legacy.include_entries,
            ),
        )
        .ok();
        app.emit(SCAN_PROGRESS_EVENT, progress).ok();
        for error in errors {
            app.emit(
                SCAN_ERROR_EVENT,
                ScanErrorPayload {
                    job_id: updated.dto.id.clone(),
                    job_kind: legacy.job_kind.clone(),
                    root: updated.dto.root_path.clone(),
                    path: error.path.unwrap_or_else(|| updated.dto.root_path.clone()),
                    message: error.error_message,
                },
            )
            .ok();
        }
    }
    batch.scanned_files = 0;
    batch.scanned_directories = 0;
    batch.processed_bytes = 0;
    batch.warnings = 0;
    batch.batch_index += 1;
    batch.last_emit_at = Instant::now();
    batch.entries.reserve(SCAN_BATCH_SIZE);
    Ok(updated)
}

fn finish_scan_run(
    db: &Database,
    run_id: &str,
    desired_status: &str,
    error_code: Option<&str>,
    error_message: Option<&str>,
    allow_stale_reconciliation: bool,
) -> Result<ScanFinalization, ScanError> {
    let current = db.get_scan_run_record(run_id)?;
    if is_terminal_scan_status(&current.dto.status) {
        return terminal_finalization(db, current);
    }
    let terminal_status = if current.dto.cancel_requested || current.dto.status == "cancelling" {
        "cancelled"
    } else {
        desired_status
    };
    let input = ScanFinalizeInput {
        terminal_status: terminal_status.to_string(),
        error_code: error_code.map(str::to_string),
        error_message: error_message.map(str::to_string),
        allow_stale_reconciliation,
    };
    db.finalize_scan_run(
        run_id,
        current.dto.revision,
        current.root_revision,
        current.session_revision,
        &input,
    )
    .map_err(ScanError::from)
}

fn terminal_finalization(db: &Database, run: ScanRunRecord) -> Result<ScanFinalization, ScanError> {
    let session_id = run
        .dto
        .parent_session_id
        .as_deref()
        .ok_or_else(|| DbError::Validation("Scan run has no parent session.".to_string()))?;
    let session = db.get_scan_session(session_id)?;
    Ok(ScanFinalization {
        dedupe_pending: session.dedupe_dispatch_state == "pending",
        run,
        session,
    })
}

fn abort_scan_run<R: Runtime>(
    app: &AppHandle<R>,
    db: &Database,
    run_id: &str,
    error: ScanError,
) -> Result<(), ScanError> {
    let finalization = finish_scan_run(
        db,
        run_id,
        "failed",
        Some("worker_failure"),
        Some(&error.to_string()),
        false,
    );
    if let Ok(finalization) = finalization {
        emit_managed_event_best_effort(app, db, &finalization.run, None);
    }
    Err(error)
}

fn dispatch_dedupe_if_pending<R: Runtime>(
    app: &AppHandle<R>,
    db: &Database,
    dedupe_jobs: DedupeJobManager,
    finalization: &ScanFinalization,
    _legacy: Option<&LegacyScanContext>,
) {
    let session_id = finalization.session.id.clone();
    let Ok(Some(dispatching)) = db.claim_dedupe_dispatch(&session_id) else {
        return;
    };
    emit_managed_event_with_session_best_effort(app, &finalization.run, &dispatching);
    match spawn_duplicate_detection(
        app.clone(),
        db.clone(),
        dedupe_jobs,
        Some(session_id.clone()),
    ) {
        Ok(job_id) => {
            if let Ok(session) =
                db.record_dedupe_dispatch(&session_id, dispatching.revision, Some(&job_id), None)
            {
                emit_managed_event_with_session_best_effort(app, &finalization.run, &session);
            }
        }
        Err(error) => {
            if let Ok(session) =
                db.record_dedupe_dispatch(&session_id, dispatching.revision, None, Some(&error))
            {
                emit_managed_event_with_session_best_effort(app, &finalization.run, &session);
            }
        }
    }
}

fn emit_terminal_events<R: Runtime>(
    app: &AppHandle<R>,
    db: &Database,
    finalization: &ScanFinalization,
    skipped: u64,
    started_at: Instant,
    legacy: Option<&LegacyScanContext>,
) {
    emit_managed_event_with_session_best_effort(app, &finalization.run, &finalization.session);
    let Some(legacy) = legacy else {
        return;
    };
    let summary =
        progress_payload_from_record(&finalization.run, &legacy.job_kind, skipped, started_at);
    match finalization.run.dto.status.as_str() {
        "cancelled" => {
            app.emit(SCAN_CANCELED_EVENT, summary).ok();
        }
        "completed" | "completed_with_warnings" => {
            app.emit(SCAN_COMPLETE_EVENT, summary).ok();
        }
        _ => {
            if let Some(message) = finalization.run.dto.error_message.as_deref() {
                app.emit(
                    SCAN_ERROR_EVENT,
                    ScanErrorPayload {
                        job_id: finalization.run.dto.id.clone(),
                        job_kind: legacy.job_kind.clone(),
                        root: finalization.run.dto.root_path.clone(),
                        path: finalization.run.dto.root_path.clone(),
                        message: message.to_string(),
                    },
                )
                .ok();
            }
        }
    }
    let _ = db;
}

fn emit_legacy_started<R: Runtime>(
    app: &AppHandle<R>,
    run_id: &str,
    legacy: &LegacyScanContext,
    root: &str,
) {
    app.emit(
        SCAN_STARTED_EVENT,
        ScanStartedPayload {
            job_id: run_id.to_string(),
            job_kind: legacy.job_kind.clone(),
            root: root.to_string(),
            batch_size: SCAN_BATCH_SIZE,
        },
    )
    .ok();
}

fn emit_managed_event_best_effort<R: Runtime>(
    app: &AppHandle<R>,
    db: &Database,
    record: &ScanRunRecord,
    current_path: Option<String>,
) {
    let Ok(session_id) = record
        .dto
        .parent_session_id
        .clone()
        .ok_or_else(|| "scan run has no parent session".to_string())
    else {
        return;
    };
    let Ok(session) = db.get_scan_session(&session_id) else {
        return;
    };
    emit_managed_event_with_session(app, record, &session, current_path);
}

fn emit_managed_event_with_session_best_effort<R: Runtime>(
    app: &AppHandle<R>,
    record: &ScanRunRecord,
    session: &ScanSessionDto,
) {
    emit_managed_event_with_session(app, record, session, None);
}

fn emit_managed_event_with_session<R: Runtime>(
    app: &AppHandle<R>,
    record: &ScanRunRecord,
    session: &ScanSessionDto,
    current_path: Option<String>,
) {
    let event = ManagedScanEvent {
        event_id: new_job_id("scan-event"),
        run_id: record.dto.id.clone(),
        scan_root_id: record.dto.scan_root_id.clone(),
        parent_session_id: record.dto.parent_session_id.clone(),
        generation: record.dto.generation,
        run_revision: record.dto.revision,
        session_revision: session.revision,
        status: record.dto.status.clone(),
        run_phase: record.dto.phase.clone(),
        session_phase: session.phase.clone(),
        scanned_files: record.dto.scanned_files,
        scanned_directories: record.dto.scanned_directories,
        processed_bytes: record.dto.processed_bytes,
        warnings_count: record.dto.warnings_count,
        errors_count: record.dto.errors_count,
        current_path,
        error_code: record.dto.error_code.clone(),
        error_message: record.dto.error_message.clone(),
        timestamp: current_unix_seconds(),
    };
    if let Err(error) = app.emit(MANAGED_SCAN_EVENT, event) {
        eprintln!("Managed scan event emit failed: {error}");
    }
}

struct ScanBatchBuffer {
    entries: Vec<ScannedEntry>,
    errors: Vec<ScanErrorInput>,
    scanned_files: i64,
    scanned_directories: i64,
    processed_bytes: i64,
    warnings: i64,
    batch_index: u64,
    last_emit_at: Instant,
}

impl ScanBatchBuffer {
    fn new(started_at: Instant) -> Self {
        Self {
            entries: Vec::with_capacity(SCAN_BATCH_SIZE),
            errors: Vec::new(),
            scanned_files: 0,
            scanned_directories: 0,
            processed_bytes: 0,
            warnings: 0,
            batch_index: 0,
            last_emit_at: started_at,
        }
    }

    fn push_entry(&mut self, entry: ScannedEntry) {
        if entry.is_dir {
            self.scanned_directories += 1;
        } else {
            self.scanned_files += 1;
            self.processed_bytes = self
                .processed_bytes
                .saturating_add(i64::try_from(entry.size).unwrap_or(i64::MAX));
        }
        self.entries.push(entry);
    }

    fn push_error(&mut self, error: ScanErrorInput) {
        self.errors.push(error);
    }

    fn is_empty(&self) -> bool {
        self.entries.is_empty() && self.errors.is_empty()
    }

    fn clear(&mut self) {
        self.entries.clear();
        self.errors.clear();
        self.scanned_files = 0;
        self.scanned_directories = 0;
        self.processed_bytes = 0;
        self.warnings = 0;
    }

    fn current_path(&self) -> Option<String> {
        self.errors
            .last()
            .and_then(|error| error.path.clone())
            .or_else(|| self.entries.last().map(|entry| entry.path.clone()))
    }

    fn should_flush(&self, now: Instant) -> bool {
        !self.is_empty()
            && (self.entries.len() >= SCAN_BATCH_SIZE
                || now.duration_since(self.last_emit_at) >= SCAN_EMIT_INTERVAL)
    }
}

fn progress_payload_from_record(
    record: &ScanRunRecord,
    job_kind: &str,
    skipped: u64,
    started_at: Instant,
) -> ScanProgressPayload {
    ScanProgressPayload {
        job_id: record.dto.id.clone(),
        job_kind: job_kind.to_string(),
        root: record.dto.root_path.clone(),
        scanned: (record.dto.scanned_files + record.dto.scanned_directories).max(0) as u64,
        files: record.dto.scanned_files.max(0) as u64,
        directories: record.dto.scanned_directories.max(0) as u64,
        skipped,
        errors: record.dto.errors_count.max(0) as u64,
        elapsed_ms: started_at.elapsed().as_millis(),
    }
}

fn legacy_summary_or_error(
    run: &ScanRunDto,
    job_kind: &str,
    skipped: u64,
    started_at: Instant,
) -> Result<ScanSummary, String> {
    let summary = ScanProgressPayload {
        job_id: run.id.clone(),
        job_kind: job_kind.to_string(),
        root: run.root_path.clone(),
        scanned: (run.scanned_files + run.scanned_directories).max(0) as u64,
        files: run.scanned_files.max(0) as u64,
        directories: run.scanned_directories.max(0) as u64,
        skipped,
        errors: run.errors_count.max(0) as u64,
        elapsed_ms: started_at.elapsed().as_millis(),
    };
    if matches!(
        run.status.as_str(),
        "completed" | "completed_with_warnings" | "cancelled"
    ) {
        Ok(summary)
    } else {
        Err(run
            .error_message
            .clone()
            .unwrap_or_else(|| format!("Scan ended in {}.", run.status)))
    }
}

fn scanned_entry_to_insert_request(entry: &ScannedEntry) -> InsertFileRequest {
    InsertFileRequest {
        id: entry.path.clone(),
        path: entry.path.clone(),
        name: entry.name.clone(),
        extension: entry.extension.clone(),
        size: i64::try_from(entry.size).unwrap_or(i64::MAX),
        mtime: entry.mtime,
        ctime: entry.ctime,
        is_dir: entry.is_dir,
        state_code: i64::from(entry.state_code),
    }
}

fn entry_to_payload<C: ClientState>(
    entry: &DirEntry<C>,
) -> Result<Option<ScannedEntry>, ScanError> {
    let path = entry.path();
    if entry.file_type().is_symlink() {
        return Ok(None);
    }

    let is_dir = entry.file_type().is_dir();
    let metadata = entry.metadata().map_err(|source| ScanError::Metadata {
        path: normalize_path(&path),
        source,
    })?;
    let mtime = modified_unix_seconds(&metadata);

    Ok(Some(ScannedEntry {
        path: normalize_path(&path),
        name: entry.file_name().to_string_lossy().into_owned(),
        extension: path
            .extension()
            .and_then(OsStr::to_str)
            .unwrap_or_default()
            .to_ascii_lowercase(),
        size: if is_dir { 0 } else { metadata.len() },
        mtime,
        ctime: metadata
            .created()
            .ok()
            .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
            .map(|duration| duration.as_secs() as i64)
            .unwrap_or(mtime),
        is_dir,
        state_code: 0,
    }))
}

fn scan_error_input_for_root(error: &ScanError, root: &str) -> ScanErrorInput {
    ScanErrorInput {
        path: Some(root.to_string()),
        error_code: match error {
            ScanError::MissingRoot(_) => "root_missing",
            ScanError::InvalidRoot(_) => "root_invalid",
            _ => "root_unavailable",
        }
        .to_string(),
        error_message: error.to_string(),
        affects_coverage: true,
        metadata_error: false,
    }
}

fn scan_error_input_for_error(error: &ScanError) -> ScanErrorInput {
    match error {
        ScanError::Metadata { path, source } => ScanErrorInput {
            path: Some(path.clone()),
            error_code: "metadata_error".to_string(),
            error_message: source.to_string(),
            affects_coverage: true,
            metadata_error: true,
        },
        other => ScanErrorInput {
            path: None,
            error_code: "scan_error".to_string(),
            error_message: other.to_string(),
            affects_coverage: true,
            metadata_error: false,
        },
    }
}

fn validate_root(root: &Path) -> Result<(), ScanError> {
    if !root.exists() {
        return Err(ScanError::MissingRoot(normalize_path(root)));
    }
    if !root.is_dir() && !root.is_file() {
        return Err(ScanError::InvalidRoot(normalize_path(root)));
    }
    Ok(())
}

fn modified_unix_seconds(metadata: &std::fs::Metadata) -> i64 {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn is_scan_cancelled(cancel_flag: &AtomicBool) -> bool {
    cancel_flag.load(Ordering::Acquire)
}

fn stale_reconciliation_enabled() -> bool {
    std::env::var("ZEN_CANVAS_SCAN_STALE_RECONCILIATION")
        .map(|value| {
            matches!(
                value.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "on"
            )
        })
        .unwrap_or(false)
}

fn is_terminal_scan_status(status: &str) -> bool {
    matches!(
        status,
        "cancelled"
            | "completed"
            | "completed_with_warnings"
            | "failed"
            | "interrupted"
            | "requires_reconciliation"
    )
}

fn should_run_stale_cleanup(cancelled: bool) -> bool {
    !cancelled && stale_reconciliation_enabled()
}

fn scan_batch_payload(
    job_id: &str,
    job_kind: &str,
    root: &str,
    batch_index: u64,
    entries: Vec<ScannedEntry>,
    progress: ScanProgressPayload,
    include_entries: bool,
) -> ScanBatchPayload {
    ScanBatchPayload {
        job_id: job_id.to_string(),
        job_kind: job_kind.to_string(),
        root: root.to_string(),
        batch_index,
        entries: if include_entries { entries } else { Vec::new() },
        progress,
    }
}

#[cfg(test)]
fn emit_scan_complete_then_schedule_dedupe(
    emit_complete: impl FnOnce() -> Result<(), ScanError>,
    schedule_dedupe: impl FnOnce(),
) -> Result<(), ScanError> {
    emit_complete()?;
    schedule_dedupe();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{ffi::OsStr, sync::atomic::AtomicBool, time::Duration};

    #[test]
    fn backend_issues_authoritative_uuid_scan_job_ids() {
        let foreground = create_scan_job_id("foreground".to_string()).expect("foreground id");
        let background = create_scan_job_id("background".to_string()).expect("background id");

        assert!(foreground.starts_with("scan-foreground-"));
        assert!(background.starts_with("scan-background-"));
        assert_ne!(foreground, background);
        assert!(create_scan_job_id("forged".to_string()).is_err());
    }

    #[test]
    fn should_skip_dir_matches_case_insensitive_generated_variants() {
        assert!(is_ignored_dir_name(OsStr::new("Node_Modules")));
        assert!(is_ignored_dir_name(OsStr::new("node_modules.cache")));
        assert!(is_ignored_dir_name(OsStr::new(".git-worktree")));
        assert!(is_ignored_dir_name(OsStr::new(".zen-canvas-trash")));
        assert!(is_ignored_dir_name(OsStr::new("System Volume Information")));
        assert!(!is_ignored_dir_name(OsStr::new("Library")));
        assert!(!is_ignored_dir_name(OsStr::new("client-documents")));
    }

    #[test]
    fn scan_cancellation_flag_reports_requested_cancel() {
        let cancel_flag = AtomicBool::new(true);

        assert!(is_scan_cancelled(&cancel_flag));
    }

    #[test]
    fn stale_cleanup_is_disabled_by_default_without_the_rollout_gate() {
        assert!(!should_run_stale_cleanup(false));
        assert!(!should_run_stale_cleanup(true));
    }

    #[test]
    fn scan_batch_buffer_flushes_after_emit_interval() {
        let started_at = Instant::now();
        let mut buffer = ScanBatchBuffer::new(started_at);

        assert!(!buffer.should_flush(started_at + Duration::from_millis(250)));

        buffer.push_entry(test_scanned_entry(1));

        assert!(!buffer.should_flush(started_at + Duration::from_millis(199)));
        assert!(buffer.should_flush(started_at + SCAN_EMIT_INTERVAL));
    }

    #[test]
    fn scan_batch_buffer_flushes_when_batch_is_full() {
        let started_at = Instant::now();
        let mut buffer = ScanBatchBuffer::new(started_at);

        for index in 0..SCAN_BATCH_SIZE {
            buffer.push_entry(test_scanned_entry(index));
        }

        assert!(buffer.should_flush(started_at + Duration::from_millis(1)));
    }

    #[test]
    fn scan_batch_payload_omits_entries_when_not_requested() {
        let payload = scan_batch_payload(
            "job-1",
            "foreground",
            "/tmp/root",
            2,
            vec![test_scanned_entry(1), test_scanned_entry(2)],
            test_scan_progress(),
            false,
        );

        assert_eq!(payload.root, "/tmp/root");
        assert_eq!(payload.batch_index, 2);
        assert_eq!(payload.progress.scanned, 2);
        assert!(payload.entries.is_empty());
    }

    #[test]
    fn scan_batch_payload_includes_entries_when_requested() {
        let payload = scan_batch_payload(
            "job-1",
            "foreground",
            "/tmp/root",
            3,
            vec![test_scanned_entry(1), test_scanned_entry(2)],
            test_scan_progress(),
            true,
        );

        assert_eq!(payload.root, "/tmp/root");
        assert_eq!(payload.batch_index, 3);
        assert_eq!(payload.entries.len(), 2);
    }

    #[test]
    fn scan_completion_emits_complete_before_scheduling_dedupe() {
        let events = std::cell::RefCell::new(Vec::new());

        emit_scan_complete_then_schedule_dedupe(
            || {
                events.borrow_mut().push("scan-complete");
                Ok(())
            },
            || events.borrow_mut().push("dedupe-started"),
        )
        .expect("finish scan");

        assert_eq!(*events.borrow(), vec!["scan-complete", "dedupe-started"]);
    }

    #[test]
    fn scan_jobs_have_independent_cancellation_tokens() {
        let jobs = ScanJobManager::default();
        let foreground = jobs.register("foreground-1").expect("foreground job");
        let background = jobs.register("background-1").expect("background job");

        assert!(jobs.cancel("background-1"));

        assert!(!is_scan_cancelled(&foreground));
        assert!(is_scan_cancelled(&background));
    }

    fn test_scanned_entry(index: usize) -> ScannedEntry {
        ScannedEntry {
            path: format!("/tmp/file-{index}.txt"),
            name: format!("file-{index}.txt"),
            extension: "txt".to_string(),
            size: 1,
            mtime: 0,
            ctime: 0,
            is_dir: false,
            state_code: 0,
        }
    }

    fn test_scan_progress() -> ScanProgressPayload {
        ScanProgressPayload {
            job_id: "job-1".to_string(),
            job_kind: "foreground".to_string(),
            root: "/tmp/root".to_string(),
            scanned: 2,
            files: 2,
            directories: 0,
            skipped: 0,
            errors: 0,
            elapsed_ms: 100,
        }
    }
}
