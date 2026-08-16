use crate::db::scan::{
    ScanAdmissionOptions, ScanBatchInput, ScanErrorInput, ScanFinalization, ScanFinalizeInput,
    ScanRunRecord, WatcherReconciliationAdmission,
};
use crate::db::{
    current_unix_seconds, emit_search_index_optimized, run_search_index_optimize, Database,
    DbError, InsertFileRequest, LibraryScope, RuleExecutionMode,
};
use crate::dedupe::{spawn_duplicate_detection, DedupeJobManager};
use crate::file_workspace::WorkClass;
use crate::ids::new_job_id;
use crate::path_filter::is_ignored_dir_name;
use crate::scheduler::{
    adapters::ManagedScanResourceLeaseAdapter, AcquireError, CancellationToken, ResourceLease,
};
use crate::window_auth::require_main_window;
use jwalk::{ClientState, DirEntry, Parallelism, WalkDir};
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
    ManagedScanRequest, ManagedScanSnapshotDto, ManagedScanStartDto, ScanRootDto, ScanRunDto,
    ScanSessionDto, ScanSessionRootDto,
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

fn should_prune_directory(path: &Path) -> bool {
    #[cfg(target_os = "macos")]
    {
        crate::platform::macos::package::is_package(path)
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = path;
        false
    }
}
const RULE_RECOVERY_MAX_ATTEMPTS: usize = 3;
const RULE_RECOVERY_RETRY_DELAYS: [Duration; 2] =
    [Duration::from_millis(250), Duration::from_millis(500)];

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
    #[error("scheduler resource acquisition failed: {0}")]
    Scheduler(String),
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

struct ScanJobEntry {
    generation: u64,
    token: Arc<AtomicBool>,
}

struct ScanJobRegistry {
    jobs: HashMap<String, ScanJobEntry>,
    next_generation: u64,
}

impl Default for ScanJobRegistry {
    fn default() -> Self {
        Self {
            jobs: HashMap::new(),
            next_generation: 1,
        }
    }
}

#[derive(Clone, Default)]
pub struct ScanJobManager(Arc<Mutex<ScanJobRegistry>>);

struct ScanJobGuard {
    manager: ScanJobManager,
    job_id: String,
    generation: u64,
    token: Arc<AtomicBool>,
    released: bool,
}

impl ScanJobGuard {
    fn token(&self) -> Arc<AtomicBool> {
        Arc::clone(&self.token)
    }

    fn release(&mut self) {
        if self.released {
            return;
        }
        self.released = true;
        self.manager
            .release_if_current(&self.job_id, self.generation, &self.token);
    }
}

impl Drop for ScanJobGuard {
    fn drop(&mut self) {
        self.release();
    }
}

impl ScanJobManager {
    fn register(&self, job_id: &str) -> Result<ScanJobGuard, String> {
        let job_id = job_id.trim();
        if job_id.is_empty() || job_id.len() > 128 {
            return Err("A valid scan job ID is required.".to_string());
        }
        let mut jobs = self
            .0
            .lock()
            .map_err(|_| "Scan job manager is unavailable.".to_string())?;
        if jobs.jobs.contains_key(job_id) {
            return Err(format!("Scan job already exists: {job_id}."));
        }
        let token = Arc::new(AtomicBool::new(false));
        let generation = jobs.next_generation;
        jobs.next_generation = jobs.next_generation.wrapping_add(1).max(1);
        jobs.jobs.insert(
            job_id.to_string(),
            ScanJobEntry {
                generation,
                token: Arc::clone(&token),
            },
        );
        Ok(ScanJobGuard {
            manager: self.clone(),
            job_id: job_id.to_string(),
            generation,
            token,
            released: false,
        })
    }

    fn token(&self, job_id: &str) -> Option<Arc<AtomicBool>> {
        self.0
            .lock()
            .ok()?
            .jobs
            .get(job_id.trim())
            .map(|entry| Arc::clone(&entry.token))
    }

    fn cancel(&self, job_id: &str) -> bool {
        let Ok(jobs) = self.0.lock() else {
            return false;
        };
        let Some(token) = jobs
            .jobs
            .get(job_id.trim())
            .map(|entry| Arc::clone(&entry.token))
        else {
            return false;
        };
        token.store(true, Ordering::Release);
        true
    }

    pub fn cancel_all(&self) -> usize {
        let Ok(jobs) = self.0.lock() else {
            return 0;
        };
        let mut canceled = 0;
        for entry in jobs.jobs.values() {
            entry.token.store(true, Ordering::Release);
            canceled += 1;
        }
        canceled
    }

    fn release_if_current(&self, job_id: &str, generation: u64, token: &Arc<AtomicBool>) {
        if let Ok(mut jobs) = self.0.lock() {
            let is_current = jobs.jobs.get(job_id.trim()).is_some_and(|entry| {
                entry.generation == generation && Arc::ptr_eq(&entry.token, token)
            });
            if is_current {
                jobs.jobs.remove(job_id.trim());
            }
        }
    }
}

fn register_scan_guards(
    jobs: &ScanJobManager,
    runs: &[ScanRunDto],
) -> Result<HashMap<String, ScanJobGuard>, String> {
    let mut guards = HashMap::with_capacity(runs.len());
    for run in runs {
        guards.insert(run.id.clone(), jobs.register(&run.id)?);
    }
    Ok(guards)
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
        let guards = register_scan_guards(&jobs, &admission.runs)?;
        let session_id = admission.session.id.clone();
        tauri::async_runtime::spawn_blocking(move || {
            if let Err(error) = run_managed_session(
                app,
                db,
                dedupe_jobs,
                session_id,
                admission.runs,
                guards,
                None,
            ) {
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
pub fn get_managed_scan_snapshot(
    db: State<'_, Database>,
    session_id: String,
) -> Result<ManagedScanSnapshotDto, String> {
    db.inner()
        .get_managed_scan_snapshot(&session_id)
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
    }
    if admission.created && !admission.runs.is_empty() {
        let guards = register_scan_guards(&jobs, &admission.runs)?;
        tauri::async_runtime::spawn_blocking(move || {
            if let Err(error) = run_managed_session(
                app,
                db,
                dedupe_jobs,
                admission.session.id,
                admission.runs,
                guards,
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
    let guard = jobs.register(&run_id)?;
    let legacy = LegacyScanContext {
        job_kind,
        include_entries,
    };
    let legacy_job_kind = legacy.job_kind.clone();
    let session_id = admission.session.id;
    let run_ids = admission.runs;
    let result = tauri::async_runtime::spawn_blocking(move || -> Result<ScanSummary, String> {
        run_managed_session(
            app,
            db.clone(),
            dedupe_jobs,
            session_id,
            run_ids,
            HashMap::from([(run_id.clone(), guard)]),
            Some(legacy),
        )
        .map_err(|error| error.to_string())?;
        let record = db
            .get_scan_run_record(&run_id)
            .map_err(|error| error.to_string())?;
        legacy_summary_or_error(&record.dto, &legacy_job_kind, 0, Instant::now())
    })
    .await
    .map_err(|error| ScanError::Join(error.to_string()).to_string())?;
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

pub(crate) fn schedule_watcher_reconciliations<R: Runtime>(
    app: AppHandle<R>,
    db: Database,
    jobs: ScanJobManager,
    dedupe_jobs: DedupeJobManager,
) -> Result<usize, String> {
    let roots = db.list_scan_roots().map_err(|error| error.to_string())?;
    let mut scheduled = 0;
    for root in roots
        .into_iter()
        .filter(|root| root.enabled && root.source_kind == "file_library")
    {
        let path = PathBuf::from(&root.normalized_path);
        if !path.exists() {
            db.mark_watcher_root_missing(
                &root.id,
                "missing",
                "Managed scan root is not available; automatic reconciliation is paused.",
            )
            .map_err(|error| error.to_string())?;
            continue;
        }
        if !path.is_dir() {
            db.mark_watcher_root_missing(
                &root.id,
                "permission_required",
                "Managed scan root is not a readable directory; automatic reconciliation is paused.",
            )
            .map_err(|error| error.to_string())?;
            continue;
        }
        if !root.needs_reconciliation
            && !root.watcher_rule_recovery_required
            && root.watcher_revision <= root.watcher_applied_revision
        {
            continue;
        }

        let request_key = match db
            .next_watcher_reconciliation_admission(
                &root.id,
                root.watcher_revision,
                current_unix_seconds(),
            )
            .map_err(|error| error.to_string())?
        {
            WatcherReconciliationAdmission::Start { request_key, .. } => request_key,
            WatcherReconciliationAdmission::Active
            | WatcherReconciliationAdmission::Backoff { .. } => continue,
            WatcherReconciliationAdmission::Exhausted { attempts } => {
                let rule_recovery_exhausted = root.watcher_rule_recovery_required
                    || root.watcher_last_error_code.as_deref() == Some("watcher_rule_failure")
                    || root.watcher_last_error_code.as_deref()
                        == Some("watcher_rule_retry_exhausted");
                let exhausted_code = if rule_recovery_exhausted {
                    "watcher_rule_retry_exhausted"
                } else {
                    "watcher_reconciliation_retry_exhausted"
                };
                if root.watcher_last_error_code.as_deref() != Some(exhausted_code) {
                    let exhausted_message = if rule_recovery_exhausted {
                        format!(
                            "Automatic watcher rule recovery exhausted after {attempts} attempts; manual rule recovery is required."
                        )
                    } else {
                        format!(
                            "Automatic watcher reconciliation exhausted after {attempts} attempts; use manual retry."
                        )
                    };
                    db.mark_watcher_reconciliation(&root.id, exhausted_code, &exhausted_message)
                        .map_err(|error| error.to_string())?;
                }
                continue;
            }
        };
        let request = ManagedScanRequest {
            roots: vec![root.normalized_path.clone()],
            request_key: Some(request_key),
            dedupe: false,
        };
        let admission = match db.admit_managed_scan(&ScanAdmissionOptions {
            request,
            run_id_override: None,
        }) {
            Ok(admission) => admission,
            Err(error) if error.to_string().contains("active run") => continue,
            Err(error) if error.to_string().contains("active root lease") => continue,
            Err(error) => {
                db.mark_watcher_reconciliation(
                    &root.id,
                    "reconciliation_admission_failed",
                    &error.to_string(),
                )
                .map_err(|mark_error| mark_error.to_string())?;
                continue;
            }
        };
        if !admission.created || admission.runs.is_empty() {
            continue;
        }
        let guards = register_scan_guards(&jobs, &admission.runs)?;
        let session_id = admission.session.id.clone();
        let run_ids = admission.runs.clone();
        let app_for_task = app.clone();
        let db_for_task = db.clone();
        let dedupe_for_task = dedupe_jobs.clone();
        tauri::async_runtime::spawn_blocking(move || {
            if let Err(error) = run_managed_session(
                app_for_task,
                db_for_task,
                dedupe_for_task,
                session_id,
                run_ids,
                guards,
                None,
            ) {
                eprintln!("Watcher reconciliation session failed: {error}");
            }
        });
        scheduled += 1;
    }
    Ok(scheduled)
}

pub fn resume_pending_dedupe_dispatches<R: Runtime>(
    app: AppHandle<R>,
    db: Database,
    dedupe_jobs: DedupeJobManager,
) -> Result<usize, DbError> {
    resume_dedupe_dispatches(&db, 1000, |session| {
        spawn_duplicate_detection(
            app.clone(),
            db.clone(),
            dedupe_jobs.clone(),
            Some(session.id.clone()),
        )
        .map_err(|error| error.to_string())
    })
}

fn resume_dedupe_dispatches<F>(
    db: &Database,
    limit: usize,
    mut dispatch: F,
) -> Result<usize, DbError>
where
    F: FnMut(&ScanSessionDto) -> Result<String, String>,
{
    let candidates = db.list_dedupe_dispatch_candidates(limit)?;
    let mut resumed = 0;
    for session in candidates {
        let Some(dispatching) = db.claim_dedupe_dispatch(&session.id)? else {
            continue;
        };
        match dispatch(&dispatching) {
            Ok(job_id) => {
                db.record_dedupe_dispatch(
                    &dispatching.id,
                    dispatching.revision,
                    Some(&job_id),
                    None,
                )?;
                resumed += 1;
            }
            Err(error) => {
                db.record_dedupe_dispatch(
                    &dispatching.id,
                    dispatching.revision,
                    None,
                    Some(&error),
                )?;
            }
        }
    }
    Ok(resumed)
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

fn scan_work_class(legacy: Option<&LegacyScanContext>) -> WorkClass {
    match legacy.map(|legacy| legacy.job_kind.as_str()) {
        Some("foreground") => WorkClass::Foreground,
        Some("background") | None => WorkClass::Background,
        Some(_) => WorkClass::Background,
    }
}

fn acquire_scan_resource_lease(
    run_id: &str,
    cancel_flag: &Arc<AtomicBool>,
    legacy: Option<&LegacyScanContext>,
) -> Result<Option<ResourceLease>, ScanError> {
    let adapter = ManagedScanResourceLeaseAdapter::global();
    let cancellation = CancellationToken::from_flag(Arc::clone(cancel_flag));
    let class = scan_work_class(legacy);
    loop {
        if is_scan_cancelled(cancel_flag) {
            return Ok(None);
        }
        match adapter.try_acquire(run_id, class, cancellation.clone()) {
            Ok(lease) => return Ok(Some(lease)),
            Err(AcquireError::WouldBlock)
            | Err(AcquireError::QueueFull)
            | Err(AcquireError::PolicyDenied) => {
                std::thread::sleep(Duration::from_millis(25));
            }
            Err(AcquireError::Cancelled) => return Ok(None),
            Err(error) => return Err(ScanError::Scheduler(error.to_string())),
        }
    }
}

fn scan_walk_parallelism(resource_lease: &ResourceLease) -> usize {
    resource_lease.resources().cpu.max(1) as usize
}

fn run_managed_session<R: Runtime>(
    app: AppHandle<R>,
    db: Database,
    dedupe_jobs: DedupeJobManager,
    session_id: String,
    runs: Vec<ScanRunDto>,
    mut guards: HashMap<String, ScanJobGuard>,
    legacy: Option<LegacyScanContext>,
) -> Result<(), ScanError> {
    for run in runs {
        let Some(guard) = guards.remove(&run.id) else {
            continue;
        };
        let cancel_flag = guard.token();
        let result = run_scan_run(
            &app,
            &db,
            &dedupe_jobs,
            &session_id,
            &run.id,
            cancel_flag,
            legacy.as_ref(),
        );
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
    let resource_lease = match acquire_scan_resource_lease(run_id, &cancel_flag, legacy) {
        Ok(Some(lease)) => lease,
        Ok(None) => {
            let finalization = finish_scan_run(
                db,
                run_id,
                "cancelled",
                Some("cancelled"),
                Some("The scan was cancelled while waiting for scheduler capacity."),
                false,
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
        Err(error) => return Err(error),
    };
    let skipped_for_filter = Arc::clone(&skipped);
    let mut batch = ScanBatchBuffer::new(started_at);
    let root = PathBuf::from(&root_label);
    let rule_recovery_required = db
        .get_scan_root_health(Some(&claimed.dto.scan_root_id), None)?
        .watcher_rule_recovery_required;

    if let Err(error) = validate_root(&root) {
        // An unopenable root means the scan never ran, which is a failed job (axis 1) —
        // not "finished with incomplete coverage".  Carrying the specific error code
        // through also lets finalization resolve root health to `missing` or
        // `permission_required` instead of the generic reconciliation state.
        let root_error = scan_error_input_for_root(&error, &root_label);
        let root_error_code = root_error.error_code.clone();
        let root_error_message = root_error.error_message.clone();
        batch.push_error(root_error);
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
            "failed",
            Some(&root_error_code),
            Some(&root_error_message),
            false,
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
        .parallelism(Parallelism::RayonNewPool(scan_walk_parallelism(
            &resource_lease,
        )))
        .skip_hidden(true)
        .follow_links(false)
        .process_read_dir(move |_depth, path, _state, children| {
            if should_prune_directory(path) {
                skipped_for_filter.fetch_add(children.len() as u64, Ordering::Relaxed);
                children.clear();
                return;
            }
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

    let stale_gate_enabled = should_run_stale_cleanup(is_scan_cancelled(&cancel_flag));
    if stale_gate_enabled {
        let reconciled = db.reconcile_missing(
            run_id,
            cursor.run_revision,
            cursor.root_revision,
            cursor.session_revision,
        )?;
        cursor.update(&reconciled);
    } else {
        // The kill switch is engaged.  That is an operator decision, not evidence that
        // the index drifted, so the run stays on the normal success path: the terminal
        // status, root health and generation pointer are all unaffected.  We only make
        // the skipped check visible.  `finish_scan_run` records the same fact durably
        // via `result_json.staleReconciliation = false`.
        eprintln!(
            "scan run {run_id}: stale reconciliation was skipped because the \
             ZEN_CANVAS_SCAN_STALE_RECONCILIATION kill switch is disabled; deleted \
             files stay indexed until it is re-enabled"
        );
    }
    let optimizing = db.transition_scan_run_phase(
        run_id,
        cursor.run_revision,
        cursor.root_revision,
        "optimizing_search",
    )?;
    cursor.update(&optimizing);
    emit_managed_event_best_effort(app, db, &optimizing, None);

    let mut rule_recovery_succeeded = false;
    let mut rule_recovery_error = None;
    if rule_recovery_required {
        match execute_rules_for_root_with_retry(db, &root_label) {
            Ok(()) => rule_recovery_succeeded = true,
            Err(error) => rule_recovery_error = Some(error.to_string()),
        }
    }

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
        if completed_with_warnings || rule_recovery_error.is_some() {
            "completed_with_warnings"
        } else {
            "completed"
        },
        rule_recovery_error
            .as_deref()
            .map(|_| "watcher_rule_failure"),
        rule_recovery_error.as_deref(),
        stale_gate_enabled,
        rule_recovery_succeeded,
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

fn execute_rules_for_root_with_retry(db: &Database, root_path: &str) -> Result<(), DbError> {
    let scope = LibraryScope::Roots {
        roots: vec![root_path.to_string()],
    };
    crate::watcher::bounded_retry(
        RULE_RECOVERY_MAX_ATTEMPTS,
        || {
            db.execute_authoritative_rules_for_scope(
                &scope,
                RuleExecutionMode::AllChangedOrRuleChanged,
            )
            .map(|_| ())
        },
        |attempt| {
            let delay =
                RULE_RECOVERY_RETRY_DELAYS[attempt.min(RULE_RECOVERY_RETRY_DELAYS.len() - 1)];
            std::thread::sleep(delay);
        },
    )
}

fn finish_scan_run(
    db: &Database,
    run_id: &str,
    desired_status: &str,
    error_code: Option<&str>,
    error_message: Option<&str>,
    allow_stale_reconciliation: bool,
    rule_recovery_succeeded: bool,
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
        rule_recovery_succeeded,
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
    let _ = dispatch_dedupe_session(
        app,
        db,
        dedupe_jobs,
        &finalization.session.id,
        Some(&finalization.run),
    );
}

fn dispatch_dedupe_session<R: Runtime>(
    app: &AppHandle<R>,
    db: &Database,
    dedupe_jobs: DedupeJobManager,
    session_id: &str,
    event_run: Option<&ScanRunRecord>,
) -> Result<bool, DbError> {
    let Some(dispatching) = db.claim_dedupe_dispatch(session_id)? else {
        return Ok(false);
    };
    if let Some(run) = event_run {
        emit_managed_event_with_session_best_effort(app, run, &dispatching);
    }
    let dispatch_result = spawn_duplicate_detection(
        app.clone(),
        db.clone(),
        dedupe_jobs,
        Some(session_id.to_string()),
    );
    let session = match dispatch_result {
        Ok(job_id) => {
            db.record_dedupe_dispatch(session_id, dispatching.revision, Some(&job_id), None)?
        }
        Err(error) => {
            db.record_dedupe_dispatch(session_id, dispatching.revision, None, Some(&error))?
        }
    };
    if let Some(run) = event_run {
        emit_managed_event_with_session_best_effort(app, run, &session);
    }
    Ok(true)
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
    crate::watcher::emit_watcher_reconciliation_status(
        app,
        db,
        &finalization.run.dto.scan_root_id,
        None,
    );
    let Some(legacy) = legacy else {
        return;
    };
    let summary =
        progress_payload_from_record(&finalization.run, &legacy.job_kind, skipped, started_at);
    match finalization.run.dto.status.as_str() {
        "cancelled" => {
            app.emit(SCAN_CANCELED_EVENT, summary).ok();
        }
        // `requires_reconciliation` means the scan ran to the end and persisted what it
        // observed; the index may be incomplete, which is a health signal rather than a
        // scan failure.  The legacy protocol has no health channel, so it reports
        // completion and surfaces the shortfall through the summary's error counters.
        "completed" | "completed_with_warnings" | "requires_reconciliation" => {
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
        "completed" | "completed_with_warnings" | "cancelled" | "requires_reconciliation"
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

/// Stale reconciliation is the default behaviour: master executed it unconditionally
/// after every non-cancelled scan, and the managed implementation is strictly safer
/// (coverage gate, per-run `scan_seen` observations, ignored-subtree contract, CAS).
///
/// The environment variable is an emergency kill switch, not a rollout flag: it only
/// exists so the new implementation can be switched off in production without shipping
/// a build. Disabling it does NOT mean the index is known to be stale, so it must not
/// fabricate a reconciliation signal — it only stops us from looking.
fn stale_reconciliation_enabled() -> bool {
    std::env::var("ZEN_CANVAS_SCAN_STALE_RECONCILIATION")
        .map(|value| {
            !matches!(
                value.trim().to_ascii_lowercase().as_str(),
                "0" | "false" | "off"
            )
        })
        .unwrap_or(true)
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
    use std::{
        cell::RefCell,
        ffi::OsStr,
        fs,
        sync::{
            atomic::{AtomicBool, AtomicU64, Ordering},
            Arc,
        },
        time::{Duration, SystemTime, UNIX_EPOCH},
    };

    static TEST_DB_COUNTER: AtomicU64 = AtomicU64::new(0);

    fn test_db(label: &str) -> Database {
        let sequence = TEST_DB_COUNTER.fetch_add(1, Ordering::Relaxed);
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock")
            .as_nanos();
        Database::open(std::env::temp_dir().join(format!(
            "zen-canvas-scanner-{label}-{}-{timestamp}-{sequence}.sqlite3",
            std::process::id()
        )))
        .expect("open scanner test database")
    }

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
    fn scan_walk_parallelism_is_bounded_by_scheduler_grant() {
        use crate::scheduler::{
            adapters::ManagedScanResourceLeaseAdapter, PermissiveResourcePolicy,
            ResourceCapacities, SchedulerConfig, WorkScheduler,
        };

        let scheduler = Arc::new(WorkScheduler::new(
            SchedulerConfig::default()
                .with_capacities(ResourceCapacities::new(4, 1, 8, 1, 1, 1))
                .with_policy(Arc::new(PermissiveResourcePolicy)),
        ));
        let adapter = ManagedScanResourceLeaseAdapter::new(Arc::clone(&scheduler));
        let lease = adapter
            .try_acquire(
                "scan-fixture",
                WorkClass::Background,
                CancellationToken::new(),
            )
            .expect("scan resource lease");
        let configured_parallelism = scan_walk_parallelism(&lease);

        assert_eq!(lease.resources().cpu, 1);
        assert!(configured_parallelism <= lease.resources().cpu as usize);
        assert!(configured_parallelism <= scheduler.snapshot().granted.cpu as usize);
        assert_eq!(configured_parallelism, 1);
        drop(lease);
    }

    /// master executed stale cleanup unconditionally after every non-cancelled scan.
    /// The managed implementation must keep that default, otherwise shipping builds
    /// silently stop retiring deleted files from the index.
    #[test]
    fn stale_cleanup_runs_by_default_and_never_after_a_cancelled_scan() {
        assert!(stale_reconciliation_enabled());
        assert!(should_run_stale_cleanup(false));
        assert!(!should_run_stale_cleanup(true));
    }

    /// Acceptance test for the kill-switch path (BRIEF 裁决 1 + 裁决 3 修正).
    ///
    /// Disabling the switch means "we did not look", not "we found drift".  It must
    /// therefore behave exactly like a normal successful scan on every axis the rest of
    /// the system reads — terminal status, root health, and the generation pointer —
    /// and must not fabricate a reconciliation signal.  The only observable difference
    /// is that unseen rows keep their previous stale flag, because no check ran.
    ///
    /// This test pins behaviour, not status names: if a future change reintroduces a
    /// degraded health value or a stalled generation pointer here, it fails.
    #[test]
    fn kill_switch_path_completes_normally_without_fabricating_a_reconciliation_signal() {
        let db = test_db("default-stale-gate");
        let root_path = std::env::temp_dir().join(format!(
            "zen-canvas-default-stale-gate-{}",
            new_job_id("root")
        ));
        fs::create_dir_all(&root_path).expect("create scan root");
        let root = root_path.to_string_lossy().replace('\\', "/");
        let old_path = root_path.join("old.txt");
        fs::write(&old_path, "old").expect("create file before scan");
        let old_path_text = old_path.to_string_lossy().replace('\\', "/");
        db.insert_file(InsertFileRequest {
            id: old_path_text.clone(),
            path: old_path_text.clone(),
            name: "old.txt".to_string(),
            extension: "txt".to_string(),
            size: 3,
            mtime: 1,
            ctime: 1,
            is_dir: false,
            state_code: 0,
        })
        .expect("seed file ledger");

        let first_admission = db
            .admit_managed_scan(&ScanAdmissionOptions {
                request: ManagedScanRequest {
                    roots: vec![root.clone()],
                    request_key: Some("default-stale-gate-first".to_string()),
                    dedupe: false,
                },
                run_id_override: None,
            })
            .expect("admit first scan");
        let first = db
            .claim_queued_scan_run(&first_admission.runs[0].id)
            .expect("claim first scan");
        let first_batch = db
            .persist_scan_batch(
                &first.dto.id,
                first.dto.revision,
                first.root_revision,
                first.session_revision,
                &ScanBatchInput {
                    entries: &[InsertFileRequest {
                        id: old_path_text.clone(),
                        path: old_path_text.clone(),
                        name: "old.txt".to_string(),
                        extension: "txt".to_string(),
                        size: 3,
                        mtime: 1,
                        ctime: 1,
                        is_dir: false,
                        state_code: 0,
                    }],
                    errors: &[],
                    scanned_files: 1,
                    scanned_directories: 0,
                    processed_bytes: 3,
                    warnings: 0,
                },
            )
            .expect("persist first scan");
        let first_finalizing = db
            .transition_scan_run_phase(
                &first_batch.dto.id,
                first_batch.dto.revision,
                first_batch.root_revision,
                "finalizing",
            )
            .expect("enter first finalization");
        // Mirrors what the scanner does when the kill switch is engaged: skip
        // `reconcile_missing`, then finalize on the normal success path.
        let first_finalization = finish_scan_run(
            &db,
            &first_finalizing.dto.id,
            "completed",
            None,
            None,
            false,
            false,
        )
        .expect("finalize first scan");
        assert_eq!(first_finalization.run.dto.status, "completed");

        fs::remove_file(&old_path).expect("delete file between scans");
        let second_admission = db
            .admit_managed_scan(&ScanAdmissionOptions {
                request: ManagedScanRequest {
                    roots: vec![root],
                    request_key: Some("default-stale-gate-second".to_string()),
                    dedupe: false,
                },
                run_id_override: None,
            })
            .expect("admit rescan");
        let second = db
            .claim_queued_scan_run(&second_admission.runs[0].id)
            .expect("claim rescan");
        let second_finalizing = db
            .transition_scan_run_phase(
                &second.dto.id,
                second.dto.revision,
                second.root_revision,
                "finalizing",
            )
            .expect("enter rescan finalization");
        let second_finalization = finish_scan_run(
            &db,
            &second_finalizing.dto.id,
            "completed",
            None,
            None,
            false,
            false,
        )
        .expect("finalize rescan");
        let health = db
            .get_scan_root_health(Some(&second_finalization.run.dto.scan_root_id), None)
            .expect("root health after rescan");
        let stale: i64 = db
            .conn()
            .expect("db connection")
            .query_row(
                "SELECT is_stale FROM files WHERE id = ?1",
                rusqlite::params![old_path_text],
                |row| row.get(0),
            )
            .expect("stale state after rescan");

        assert_eq!(second_finalization.run.dto.generation, 2);
        // Axis 1 — job outcome: the scan ran to completion.
        assert_eq!(second_finalization.run.dto.status, "completed");
        // Axis 2 — index health: not degraded, because nothing was found to be wrong.
        assert!(!health.needs_reconciliation);
        assert_ne!(health.health_status, "reconciliation_required");
        // Axis 3 — generation pointer: advances normally.
        assert_eq!(health.last_successful_generation, Some(2));
        // The only consequence of not looking: the deleted file keeps its prior flag.
        assert_eq!(stale, 0);
        fs::remove_dir_all(root_path).expect("remove scan root fixture");
    }

    #[test]
    fn startup_replays_pending_unknown_and_failed_dedupe_dispatches_after_restart() {
        let db = test_db("dedupe-restart");
        let states = ["pending", "unknown", "failed"];
        let mut session_ids = Vec::new();
        for (index, state) in states.iter().enumerate() {
            let root = format!(
                "/tmp/zen-canvas-dedupe-restart-{}-{}",
                index,
                new_job_id("root")
            );
            let admission = db
                .admit_managed_scan(&ScanAdmissionOptions {
                    request: ManagedScanRequest {
                        roots: vec![root],
                        request_key: Some(format!("dedupe-restart-{index}")),
                        dedupe: true,
                    },
                    run_id_override: None,
                })
                .expect("admit dedupe session");
            let run = db
                .claim_queued_scan_run(&admission.runs[0].id)
                .expect("claim dedupe session");
            let finalization = db
                .finalize_scan_run(
                    &run.dto.id,
                    run.dto.revision,
                    run.root_revision,
                    run.session_revision,
                    &ScanFinalizeInput {
                        terminal_status: "completed".to_string(),
                        error_code: None,
                        error_message: None,
                        allow_stale_reconciliation: false,
                        rule_recovery_succeeded: false,
                    },
                )
                .expect("complete dedupe session");
            assert_eq!(finalization.session.dedupe_dispatch_state, "pending");
            if *state != "pending" {
                db.conn()
                    .expect("db connection")
                    .execute(
                        "UPDATE scan_sessions SET dedupe_dispatch_state = ?1, dedupe_last_error = ?2 WHERE id = ?3",
                        rusqlite::params![state, "restart fixture", admission.session.id],
                    )
                    .expect("seed restart dispatch state");
            }
            session_ids.push(admission.session.id);
        }

        let attempts = RefCell::new(Vec::<String>::new());
        let first_pass = resume_dedupe_dispatches(&db, 1000, |session| {
            let attempt = attempts.borrow().len();
            attempts.borrow_mut().push(session.id.clone());
            if attempt == 0 {
                Err("simulated manager restart gap".to_string())
            } else {
                Ok(format!("dedupe-job-{}", session.id))
            }
        })
        .expect("replay durable dispatch candidates");
        assert_eq!(first_pass, 2);
        assert_eq!(attempts.borrow().len(), 3);

        let second_pass = resume_dedupe_dispatches(&db, 1000, |session| {
            Ok(format!("dedupe-retry-{}", session.id))
        })
        .expect("replay failed dispatch after retry");
        assert_eq!(second_pass, 1);
        for session_id in session_ids {
            assert_eq!(
                db.get_scan_session(&session_id)
                    .expect("replayed session")
                    .dedupe_dispatch_state,
                "dispatched"
            );
        }
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
        let foreground_token = foreground.token();
        let background_token = background.token();

        assert!(jobs.cancel("background-1"));

        assert!(!is_scan_cancelled(&foreground_token));
        assert!(is_scan_cancelled(&background_token));
    }

    #[test]
    fn scan_job_guard_drop_releases_after_panic_and_is_idempotent() {
        let jobs = ScanJobManager::default();
        let panic_jobs = jobs.clone();
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(move || {
            let _guard = panic_jobs.register("panic-scan").expect("panic scan owner");
            panic!("simulated scan worker panic");
        }));
        assert!(result.is_err());
        assert!(jobs.token("panic-scan").is_none());

        let mut guard = jobs
            .register("idempotent-scan")
            .expect("idempotent scan owner");
        guard.release();
        guard.release();
        assert!(jobs.token("idempotent-scan").is_none());
    }

    #[test]
    fn stale_scan_job_guard_cannot_release_a_new_generation() {
        let jobs = ScanJobManager::default();
        let old = jobs.register("reused-scan").expect("old scan owner");
        jobs.release_if_current("reused-scan", old.generation, &old.token);
        let current = jobs.register("reused-scan").expect("current scan owner");
        drop(old);
        assert!(jobs.token("reused-scan").is_some());
        drop(current);
        assert!(jobs.token("reused-scan").is_none());
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
