use crate::db::{Database, DbError, OperationPreviewDto, OperationPreviewScopeResult};
use rusqlite::{params, OptionalExtension, Row};
use serde::Serialize;
use std::{
    collections::{hash_map::DefaultHasher, HashMap, HashSet},
    env, fs,
    hash::{Hash, Hasher},
    panic::{catch_unwind, AssertUnwindSafe},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, Runtime, State, WebviewWindow};

const LARGE_FILE_THRESHOLD: u64 = 100 * 1024 * 1024;
const LARGE_DIR_THRESHOLD: u64 = 500 * 1024 * 1024;
const MAX_RETAINED_CLEANUP_JOBS: usize = 8;
const STORAGE_CLEANUP_PAGE_SIZE: usize = 200;
const STORAGE_CLEANUP_PROGRESS_EVENT: &str = "storage-cleanup-progress";
const STORAGE_CLEANUP_COMPLETED_EVENT: &str = "storage-cleanup-completed";
const STORAGE_CLEANUP_FAILED_EVENT: &str = "storage-cleanup-failed";
const STORAGE_CLEANUP_CANCELLED_EVENT: &str = "storage-cleanup-cancelled";
pub const CLEANUP_RESTORE_PROGRESS_EVENT: &str = "cleanup-restore-progress";
const STORAGE_CLEANUP_EMIT_INTERVAL: Duration = Duration::from_millis(300);
const STORAGE_CLEANUP_EMIT_ENTRY_INTERVAL: u64 = 100;

#[derive(Debug, Clone, Serialize)]
pub struct StorageAnalysis {
    pub total_size: u64,
    pub reclaimable_estimate: u64,
    pub review_estimate: u64,
    pub candidates: Vec<StorageCandidate>,
    pub denied_paths: Vec<String>,
    pub warnings: Vec<String>,
    pub candidate_total: usize,
    pub candidate_offset: usize,
    pub candidate_limit: usize,
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct StorageCandidate {
    pub id: String,
    pub path: String,
    pub name: String,
    pub size: u64,
    pub tier: CleanupTier,
    pub category: String,
    pub reason: String,
    pub suggested_action: CleanupActionKind,
    pub risk_note: Option<String>,
    pub trash_allowed: bool,
    pub selected_by_default: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub enum CleanupTier {
    Safe,
    Review,
    Caution,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub enum CleanupActionKind {
    MoveToTrash,
    Reveal,
    UninstallAdvice,
    AppInternalCleanup,
    None,
}

#[derive(Debug, Clone, Serialize)]
pub struct CleanupPreviewItem {
    pub id: String,
    pub candidate_id: String,
    pub path: String,
    pub name: String,
    pub size: u64,
    pub tier: CleanupTier,
    pub category: String,
    pub reason: String,
    pub operation_type: String,
    pub target_path: String,
    pub status: String,
    pub requires_confirmation: bool,
    pub is_executable: bool,
    pub blocking_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CleanupExecutionResult {
    pub moved: usize,
    pub skipped: usize,
    pub failed: usize,
    pub logs: Vec<CleanupExecutionLog>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupExecutionLog {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub status: String,
    pub message: String,
    pub item_id: Option<String>,
    pub trash_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageCleanupProgress {
    pub job_id: String,
    pub scanned_entries: u64,
    pub current_path: Option<String>,
    pub total_size: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageCleanupCompleted {
    pub job_id: String,
    pub analysis: StorageAnalysis,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageCleanupJobMessage {
    pub job_id: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageCleanupScanStatus {
    pub job_id: String,
    pub status: String,
    pub progress: StorageCleanupProgress,
    pub analysis: Option<StorageAnalysis>,
    pub error: Option<String>,
    pub started_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupTrashItem {
    pub id: String,
    pub batch_id: String,
    pub original_path: String,
    pub trash_path: String,
    pub name: String,
    pub size: u64,
    pub moved_at: String,
    pub restored_at: Option<String>,
    pub status: String,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupTrashBatch {
    pub id: String,
    pub created_at: String,
    pub root: Option<String>,
    pub total_items: usize,
    pub total_size: u64,
    pub status: String,
    pub items: Vec<CleanupTrashItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupRestorePreview {
    pub batch_id: String,
    pub items: Vec<CleanupRestorePreviewItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupRestorePreviewItem {
    #[serde(flatten)]
    pub item: CleanupTrashItem,
    pub can_restore: bool,
    pub blocking_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupRestoreLog {
    pub item_id: String,
    pub original_path: String,
    pub trash_path: String,
    pub status: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupRestoreResult {
    pub restored: usize,
    pub conflicts: usize,
    pub missing: usize,
    pub failed: usize,
    pub canceled: usize,
    pub logs: Vec<CleanupRestoreLog>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CleanupRestoreProgressPayload {
    pub job_id: String,
    pub processed: usize,
    pub total: usize,
    pub current_item_id: Option<String>,
    pub current_path: Option<String>,
    pub restored: usize,
    pub conflicts: usize,
    pub missing: usize,
    pub failed: usize,
    pub canceled: usize,
    pub cancel_requested: bool,
}

#[derive(Clone, Default)]
pub struct StorageCleanupState {
    inner: Arc<StorageCleanupStateInner>,
}

#[derive(Clone, Default)]
pub struct CleanupRestoreState {
    inner: Arc<CleanupRestoreStateInner>,
}

#[derive(Default)]
struct CleanupRestoreStateInner {
    jobs: Mutex<HashMap<String, CleanupRestoreJob>>,
    next_sequence: AtomicU64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CleanupRestoreJobStatus {
    Running,
    Completed,
    Canceled,
    Failed,
}

impl CleanupRestoreJobStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Running => "running",
            Self::Completed => "completed",
            Self::Canceled => "canceled",
            Self::Failed => "failed",
        }
    }
}

#[derive(Clone)]
struct CleanupRestoreJob {
    cancel_flag: Arc<AtomicBool>,
    status: CleanupRestoreJobStatus,
    sequence: u64,
}

impl CleanupRestoreState {
    fn start_job(&self, job_id: String) -> Result<Arc<AtomicBool>, String> {
        let mut jobs = self
            .inner
            .jobs
            .lock()
            .map_err(|_| "Cleanup restore job state is unavailable.".to_string())?;
        if jobs
            .values()
            .any(|job| job.status == CleanupRestoreJobStatus::Running)
        {
            return Err("Another cleanup restore is already running.".to_string());
        }
        let cancel_flag = Arc::new(AtomicBool::new(false));
        let sequence = self.inner.next_sequence.fetch_add(1, Ordering::Relaxed);
        jobs.insert(
            job_id,
            CleanupRestoreJob {
                cancel_flag: Arc::clone(&cancel_flag),
                status: CleanupRestoreJobStatus::Running,
                sequence,
            },
        );
        while jobs.len() > MAX_RETAINED_CLEANUP_JOBS {
            let oldest = jobs
                .iter()
                .filter(|(_, job)| job.status != CleanupRestoreJobStatus::Running)
                .min_by_key(|(_, job)| job.sequence)
                .map(|(id, _)| id.clone());
            let Some(oldest) = oldest else { break };
            jobs.remove(&oldest);
        }
        Ok(cancel_flag)
    }

    fn cancel_job(&self, job_id: &str) -> Result<(), String> {
        let jobs = self
            .inner
            .jobs
            .lock()
            .map_err(|_| "Cleanup restore job state is unavailable.".to_string())?;
        let job = jobs
            .get(job_id)
            .ok_or_else(|| format!("Cleanup restore job not found: {job_id}"))?;
        if job.status == CleanupRestoreJobStatus::Running {
            job.cancel_flag.store(true, Ordering::Relaxed);
        }
        Ok(())
    }

    fn finish_job(&self, job_id: &str, status: CleanupRestoreJobStatus) -> Result<(), String> {
        let mut jobs = self
            .inner
            .jobs
            .lock()
            .map_err(|_| "Cleanup restore job state is unavailable.".to_string())?;
        if let Some(job) = jobs.get_mut(job_id) {
            if job.status == CleanupRestoreJobStatus::Running {
                job.status = status;
            }
        }
        Ok(())
    }

    pub fn status_for_test(&self, job_id: &str) -> Option<CleanupRestoreJobStatus> {
        self.inner
            .jobs
            .lock()
            .ok()?
            .get(job_id)
            .map(|job| job.status)
    }

    pub fn start_job_for_test(&self, job_id: impl Into<String>) -> Result<Arc<AtomicBool>, String> {
        self.start_job(job_id.into())
    }

    pub fn cancel_job_for_test(&self, job_id: &str) -> Result<(), String> {
        self.cancel_job(job_id)
    }

    pub fn finish_job_for_test(
        &self,
        job_id: &str,
        status: CleanupRestoreJobStatus,
    ) -> Result<(), String> {
        self.finish_job(job_id, status)
    }
}

struct CleanupRestoreJobGuard {
    state: CleanupRestoreState,
    job_id: String,
    finished: bool,
}

impl CleanupRestoreJobGuard {
    fn new(state: CleanupRestoreState, job_id: String) -> Self {
        Self {
            state,
            job_id,
            finished: false,
        }
    }

    fn finish(&mut self, status: CleanupRestoreJobStatus) {
        let _ = self.state.finish_job(&self.job_id, status);
        self.finished = true;
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CleanupRestoreTestOutcome {
    Completed,
    Canceled,
    Failed,
    Panic,
}

pub fn run_cleanup_restore_job_for_test(
    state: &CleanupRestoreState,
    job_id: &str,
    outcome: CleanupRestoreTestOutcome,
) -> Result<(), String> {
    state.start_job_for_test(job_id.to_string())?;
    let state = state.clone();
    let job_id = job_id.to_string();
    let result = catch_unwind(AssertUnwindSafe(move || {
        let mut guard = CleanupRestoreJobGuard::new(state, job_id);
        match outcome {
            CleanupRestoreTestOutcome::Completed => {
                guard.finish(CleanupRestoreJobStatus::Completed)
            }
            CleanupRestoreTestOutcome::Canceled => guard.finish(CleanupRestoreJobStatus::Canceled),
            CleanupRestoreTestOutcome::Failed => guard.finish(CleanupRestoreJobStatus::Failed),
            CleanupRestoreTestOutcome::Panic => panic!("simulated cleanup restore worker panic"),
        }
    }));
    result.map_err(|_| "simulated cleanup restore worker panic".to_string())
}

impl Drop for CleanupRestoreJobGuard {
    fn drop(&mut self) {
        if !self.finished {
            let _ = self
                .state
                .finish_job(&self.job_id, CleanupRestoreJobStatus::Failed);
        }
    }
}

trait CleanupRestoreProgressEmitter {
    fn emit_progress(&self, payload: CleanupRestoreProgressPayload);
}

struct NoopCleanupRestoreProgressEmitter;

impl CleanupRestoreProgressEmitter for NoopCleanupRestoreProgressEmitter {
    fn emit_progress(&self, _payload: CleanupRestoreProgressPayload) {}
}

struct TauriCleanupRestoreProgressEmitter<R: Runtime> {
    app: AppHandle<R>,
}

impl<R: Runtime> TauriCleanupRestoreProgressEmitter<R> {
    fn new(app: AppHandle<R>) -> Self {
        Self { app }
    }
}

impl<R: Runtime> CleanupRestoreProgressEmitter for TauriCleanupRestoreProgressEmitter<R> {
    fn emit_progress(&self, payload: CleanupRestoreProgressPayload) {
        if let Err(error) = self.app.emit(CLEANUP_RESTORE_PROGRESS_EVENT, payload) {
            eprintln!("Cleanup restore progress event failed: {error}");
        }
    }
}

#[derive(Default)]
struct StorageCleanupStateInner {
    latest_candidates: Mutex<HashMap<String, StorageCandidate>>,
    jobs: Mutex<HashMap<String, StorageCleanupJob>>,
    active_job_id: Mutex<Option<String>>,
}

#[derive(Clone)]
struct StorageCleanupJob {
    status: StorageCleanupScanStatus,
    cancel_flag: Arc<AtomicBool>,
}

impl StorageCleanupState {
    fn replace_candidates(&self, candidates: &[StorageCandidate]) -> Result<(), String> {
        let mut cache = self
            .inner
            .latest_candidates
            .lock()
            .map_err(|_| "Storage cleanup cache is unavailable.".to_string())?;
        cache.clear();
        cache.extend(
            candidates
                .iter()
                .cloned()
                .map(|candidate| (candidate.id.clone(), candidate)),
        );
        Ok(())
    }

    pub(crate) fn candidates_by_id(&self, ids: &[String]) -> Result<Vec<StorageCandidate>, String> {
        let cache = self
            .inner
            .latest_candidates
            .lock()
            .map_err(|_| "Storage cleanup cache is unavailable.".to_string())?;
        Ok(ids.iter().filter_map(|id| cache.get(id).cloned()).collect())
    }

    pub(crate) fn update_candidates(&self, candidates: &[StorageCandidate]) -> Result<(), String> {
        let mut cache = self
            .inner
            .latest_candidates
            .lock()
            .map_err(|_| "Storage cleanup cache is unavailable.".to_string())?;
        for candidate in candidates {
            if cache.contains_key(&candidate.id) {
                cache.insert(candidate.id.clone(), candidate.clone());
            }
        }
        Ok(())
    }

    fn start_job(&self, job_id: String, roots: &[PathBuf]) -> Result<Arc<AtomicBool>, String> {
        self.cancel_active_job()?;
        let cancel_flag = Arc::new(AtomicBool::new(false));
        let progress = StorageCleanupProgress {
            job_id: job_id.clone(),
            scanned_entries: 0,
            current_path: roots.first().map(|path| normalize_path(path)),
            total_size: 0,
        };
        let status = StorageCleanupScanStatus {
            job_id: job_id.clone(),
            status: "running".to_string(),
            progress,
            analysis: None,
            error: None,
            started_at: current_timestamp_ms().to_string(),
            completed_at: None,
        };
        let mut jobs = self
            .inner
            .jobs
            .lock()
            .map_err(|_| "Storage cleanup job state is unavailable.".to_string())?;
        jobs.insert(
            job_id.clone(),
            StorageCleanupJob {
                status,
                cancel_flag: Arc::clone(&cancel_flag),
            },
        );
        if jobs.len() > MAX_RETAINED_CLEANUP_JOBS {
            let mut completed = jobs
                .iter()
                .filter(|(id, job)| *id != &job_id && job.status.status != "running")
                .map(|(id, job)| (id.clone(), job.status.started_at.clone()))
                .collect::<Vec<_>>();
            completed.sort_by(|left, right| left.1.cmp(&right.1));
            let remove_count = jobs.len().saturating_sub(MAX_RETAINED_CLEANUP_JOBS);
            for (id, _) in completed.into_iter().take(remove_count) {
                jobs.remove(&id);
            }
        }
        *self
            .inner
            .active_job_id
            .lock()
            .map_err(|_| "Storage cleanup job state is unavailable.".to_string())? = Some(job_id);
        Ok(cancel_flag)
    }

    fn cancel_active_job(&self) -> Result<(), String> {
        let active = self
            .inner
            .active_job_id
            .lock()
            .map_err(|_| "Storage cleanup job state is unavailable.".to_string())?
            .clone();
        if let Some(job_id) = active {
            let mut jobs = self
                .inner
                .jobs
                .lock()
                .map_err(|_| "Storage cleanup job state is unavailable.".to_string())?;
            if let Some(job) = jobs.get_mut(&job_id) {
                if job.status.status == "running" {
                    job.cancel_flag.store(true, Ordering::Relaxed);
                    job.status.status = "cancelled".to_string();
                    job.status.completed_at = Some(current_timestamp_ms().to_string());
                }
            }
        }
        Ok(())
    }

    fn cancel_job(&self, job_id: &str) -> Result<(), String> {
        let mut jobs = self
            .inner
            .jobs
            .lock()
            .map_err(|_| "Storage cleanup job state is unavailable.".to_string())?;
        let job = jobs
            .get_mut(job_id)
            .ok_or_else(|| format!("Storage cleanup scan job not found: {job_id}"))?;
        job.cancel_flag.store(true, Ordering::Relaxed);
        if job.status.status == "running" {
            job.status.status = "cancelled".to_string();
            job.status.completed_at = Some(current_timestamp_ms().to_string());
        }
        Ok(())
    }

    fn update_job_progress(&self, progress: StorageCleanupProgress) -> Result<(), String> {
        let mut jobs = self
            .inner
            .jobs
            .lock()
            .map_err(|_| "Storage cleanup job state is unavailable.".to_string())?;
        if let Some(job) = jobs.get_mut(&progress.job_id) {
            job.status.progress = progress;
        }
        Ok(())
    }

    fn complete_job(&self, job_id: &str, analysis: StorageAnalysis) -> Result<(), String> {
        self.replace_candidates(&analysis.candidates)?;
        let mut jobs = self
            .inner
            .jobs
            .lock()
            .map_err(|_| "Storage cleanup job state is unavailable.".to_string())?;
        if let Some(job) = jobs.get_mut(job_id) {
            job.status.status = "completed".to_string();
            job.status.progress.total_size = analysis.total_size;
            job.status.analysis = Some(analysis);
            job.status.completed_at = Some(current_timestamp_ms().to_string());
        }
        self.clear_active_job(job_id)?;
        Ok(())
    }

    fn fail_job(&self, job_id: &str, message: String) -> Result<(), String> {
        let mut jobs = self
            .inner
            .jobs
            .lock()
            .map_err(|_| "Storage cleanup job state is unavailable.".to_string())?;
        if let Some(job) = jobs.get_mut(job_id) {
            job.status.status = "failed".to_string();
            job.status.error = Some(message);
            job.status.completed_at = Some(current_timestamp_ms().to_string());
        }
        self.clear_active_job(job_id)?;
        Ok(())
    }

    fn mark_job_cancelled(&self, job_id: &str) -> Result<(), String> {
        let mut jobs = self
            .inner
            .jobs
            .lock()
            .map_err(|_| "Storage cleanup job state is unavailable.".to_string())?;
        if let Some(job) = jobs.get_mut(job_id) {
            job.status.status = "cancelled".to_string();
            job.status.completed_at = Some(current_timestamp_ms().to_string());
        }
        self.clear_active_job(job_id)?;
        Ok(())
    }

    fn clear_active_job(&self, job_id: &str) -> Result<(), String> {
        let mut active = self
            .inner
            .active_job_id
            .lock()
            .map_err(|_| "Storage cleanup job state is unavailable.".to_string())?;
        if active.as_deref() == Some(job_id) {
            *active = None;
        }
        Ok(())
    }

    fn job_status(&self, job_id: &str) -> Result<StorageCleanupScanStatus, String> {
        let jobs = self
            .inner
            .jobs
            .lock()
            .map_err(|_| "Storage cleanup job state is unavailable.".to_string())?;
        jobs.get(job_id)
            .map(|job| {
                let mut status = job.status.clone();
                status.analysis = status
                    .analysis
                    .as_ref()
                    .map(|analysis| storage_analysis_page(analysis, 0, STORAGE_CLEANUP_PAGE_SIZE));
                status
            })
            .ok_or_else(|| format!("Storage cleanup scan job not found: {job_id}"))
    }

    fn job_analysis_page(
        &self,
        job_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<StorageAnalysis, String> {
        let jobs = self
            .inner
            .jobs
            .lock()
            .map_err(|_| "Storage cleanup job state is unavailable.".to_string())?;
        let analysis = jobs
            .get(job_id)
            .and_then(|job| job.status.analysis.as_ref())
            .ok_or_else(|| format!("Completed storage cleanup job not found: {job_id}"))?;
        Ok(storage_analysis_page(analysis, offset, limit.clamp(1, 500)))
    }
}

#[tauri::command]
pub async fn scan_storage_cleanup<R: Runtime>(
    roots: Vec<String>,
    app: AppHandle<R>,
    state: State<'_, StorageCleanupState>,
) -> Result<StorageAnalysis, String> {
    let app_data_dir = app.path().app_data_dir().ok();
    let roots = validate_cleanup_roots(roots)?;
    let analysis = tauri::async_runtime::spawn_blocking(move || {
        analyze_storage_roots(roots, app_data_dir.into_iter().collect())
    })
    .await
    .map_err(|error| format!("storage cleanup scan task failed: {error}"))??;

    state.replace_candidates(&analysis.candidates)?;
    Ok(storage_analysis_page(
        &analysis,
        0,
        STORAGE_CLEANUP_PAGE_SIZE,
    ))
}

#[tauri::command]
pub fn start_storage_cleanup_scan<R: Runtime>(
    roots: Vec<String>,
    app: AppHandle<R>,
    state: State<'_, StorageCleanupState>,
) -> Result<String, String> {
    let app_data_dir = app.path().app_data_dir().ok();
    let roots = validate_cleanup_roots(roots)?;
    let job_id = new_id("storage-cleanup-scan");
    let cancel_flag = state.start_job(job_id.clone(), &roots)?;
    let state = state.inner().clone();
    let job_id_for_task = job_id.clone();
    tauri::async_runtime::spawn_blocking(move || {
        run_storage_cleanup_scan_job(
            roots,
            app_data_dir.into_iter().collect(),
            app,
            state,
            job_id_for_task,
            cancel_flag,
        );
    });
    Ok(job_id)
}

#[tauri::command]
pub fn cancel_storage_cleanup_scan(
    job_id: String,
    state: State<'_, StorageCleanupState>,
) -> Result<(), String> {
    state.cancel_job(&job_id)
}

#[tauri::command]
pub fn get_storage_cleanup_scan_status(
    job_id: String,
    state: State<'_, StorageCleanupState>,
) -> Result<StorageCleanupScanStatus, String> {
    state.job_status(&job_id)
}

#[tauri::command]
pub fn get_storage_cleanup_candidate_page(
    job_id: String,
    offset: usize,
    limit: Option<usize>,
    state: State<'_, StorageCleanupState>,
) -> Result<StorageAnalysis, String> {
    state.job_analysis_page(&job_id, offset, limit.unwrap_or(STORAGE_CLEANUP_PAGE_SIZE))
}

#[tauri::command]
pub fn reveal_storage_candidate(path: String) -> Result<(), String> {
    crate::file_ops::reveal_in_folder(path)
}

#[tauri::command]
pub fn preview_cleanup_candidates(
    ids: Vec<String>,
    state: State<'_, StorageCleanupState>,
) -> Result<Vec<CleanupPreviewItem>, String> {
    let candidates = state.candidates_by_id(&ids)?;
    cleanup_preview_items_for_candidates(ids, &candidates)
}

#[tauri::command]
pub fn preview_cleanup_operations<R: Runtime>(
    ids: Vec<String>,
    app: AppHandle<R>,
    state: State<'_, StorageCleanupState>,
) -> Result<OperationPreviewScopeResult, String> {
    let app_data_dir = app.path().app_data_dir().ok();
    let candidates = state.candidates_by_id(&ids)?;
    preview_cleanup_operations_for_candidates(ids, &candidates, app_data_dir.as_deref())
}

#[tauri::command]
pub fn move_cleanup_candidates_to_trash<R: Runtime>(
    window: WebviewWindow<R>,
    ids: Vec<String>,
    app: AppHandle<R>,
    state: State<'_, StorageCleanupState>,
) -> Result<CleanupExecutionResult, String> {
    require_main_window(&window)?;
    let app_data_dir = app.path().app_data_dir().ok();
    let candidates = state.candidates_by_id(&ids)?;
    move_cleanup_candidates_to_trash_for_candidates(ids, &candidates, app_data_dir.as_deref())
}

#[tauri::command]
pub fn move_cleanup_candidates_to_safe_trash<R: Runtime>(
    window: WebviewWindow<R>,
    ids: Vec<String>,
    app: AppHandle<R>,
    db: State<'_, Database>,
    state: State<'_, StorageCleanupState>,
) -> Result<CleanupExecutionResult, String> {
    require_main_window(&window)?;
    let app_data_dir = app.path().app_data_dir().ok();
    let candidates = state.candidates_by_id(&ids)?;
    move_cleanup_candidates_to_safe_trash_for_candidates(
        ids,
        &candidates,
        db.inner(),
        app_data_dir.as_deref(),
    )
}

#[tauri::command]
pub fn list_cleanup_trash_batches(
    db: State<'_, Database>,
) -> Result<Vec<CleanupTrashBatch>, String> {
    db.list_cleanup_trash_batches()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn preview_restore_cleanup_trash(
    batch_id: String,
    db: State<'_, Database>,
) -> Result<CleanupRestorePreview, String> {
    let items = db
        .cleanup_trash_items_for_batch(&batch_id)
        .map_err(|error| error.to_string())?;
    Ok(CleanupRestorePreview {
        batch_id,
        items: items
            .into_iter()
            .map(cleanup_restore_preview_item)
            .collect(),
    })
}

#[tauri::command]
pub async fn restore_cleanup_trash_items<R: Runtime>(
    window: WebviewWindow<R>,
    item_ids: Vec<String>,
    job_id: Option<String>,
    app: AppHandle<R>,
    db: State<'_, Database>,
    state: State<'_, CleanupRestoreState>,
) -> Result<CleanupRestoreResult, String> {
    require_main_window(&window)?;
    let job_id = job_id.unwrap_or_else(|| new_id("cleanup-restore"));
    let cancel_flag = state.start_job(job_id.clone())?;
    let state = state.inner().clone();
    let state_for_join_error = state.clone();
    let db = db.inner().clone();
    let job_id_for_join = job_id.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let emitter = TauriCleanupRestoreProgressEmitter::new(app);
        let mut guard = CleanupRestoreJobGuard::new(state, job_id.clone());
        let result = restore_cleanup_trash_items_for_db_with_progress(
            item_ids,
            &db,
            cancel_flag,
            job_id.clone(),
            &emitter,
        );
        let status = match result.as_ref() {
            Ok(value) if value.canceled > 0 => CleanupRestoreJobStatus::Canceled,
            Ok(_) => CleanupRestoreJobStatus::Completed,
            Err(_) => CleanupRestoreJobStatus::Failed,
        };
        guard.finish(status);
        result
    })
    .await
    .map_err(|error| {
        let _ = state_for_join_error.finish_job(&job_id_for_join, CleanupRestoreJobStatus::Failed);
        format!("Cleanup restore worker failed: {error}")
    })?;
    result
}

#[tauri::command]
pub fn cancel_cleanup_restore<R: Runtime>(
    window: WebviewWindow<R>,
    job_id: String,
    state: State<'_, CleanupRestoreState>,
) -> Result<(), String> {
    require_main_window(&window)?;
    state.cancel_job(&job_id)
}

fn cleanup_restore_preview_item(item: CleanupTrashItem) -> CleanupRestorePreviewItem {
    let status = item.status.to_ascii_lowercase();
    let blocking_reason = match status.as_str() {
        "restored" => Some("already restored".to_string()),
        "pending" => Some("pending".to_string()),
        "missing" => Some("missing".to_string()),
        "failed" => Some("failed".to_string()),
        "moved" => {
            let original_exists = Path::new(&item.original_path).exists();
            let trash_exists = Path::new(&item.trash_path).exists();
            if original_exists {
                Some("conflict".to_string())
            } else if !trash_exists {
                Some("missing".to_string())
            } else {
                None
            }
        }
        _ => Some("unavailable".to_string()),
    };
    CleanupRestorePreviewItem {
        can_restore: blocking_reason.is_none(),
        blocking_reason,
        item,
    }
}

pub fn preview_cleanup_restore_item_for_test(item: CleanupTrashItem) -> CleanupRestorePreviewItem {
    cleanup_restore_preview_item(item)
}

fn require_main_window<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), String> {
    if is_main_window_label(window.label()) {
        Ok(())
    } else {
        Err("This cleanup operation is only available from the main window.".to_string())
    }
}

fn is_main_window_label(label: &str) -> bool {
    label == "main"
}

pub fn is_main_window_label_for_test(label: &str) -> bool {
    is_main_window_label(label)
}

pub fn analyze_storage_roots_for_test(
    roots: Vec<PathBuf>,
    excluded_paths: Vec<PathBuf>,
) -> Result<StorageAnalysis, String> {
    analyze_storage_roots(roots, excluded_paths)
}

pub fn validate_cleanup_roots_for_test(roots: Vec<String>) -> Result<Vec<PathBuf>, String> {
    validate_cleanup_roots(roots)
}

pub fn start_storage_cleanup_scan_for_test(
    roots: Vec<PathBuf>,
    state: &StorageCleanupState,
) -> Result<String, String> {
    let job_id = new_id("storage-cleanup-scan-test");
    let cancel_flag = state.start_job(job_id.clone(), &roots)?;
    let state = state.clone();
    let job_id_for_task = job_id.clone();
    std::thread::spawn(move || {
        run_storage_cleanup_scan_job_without_events(
            roots,
            Vec::new(),
            state,
            job_id_for_task,
            cancel_flag,
        );
    });
    Ok(job_id)
}

pub fn cancel_storage_cleanup_scan_for_test(
    job_id: &str,
    state: &StorageCleanupState,
) -> Result<(), String> {
    state.cancel_job(job_id)
}

pub fn get_storage_cleanup_scan_status_for_test(
    job_id: &str,
    state: &StorageCleanupState,
) -> Result<StorageCleanupScanStatus, String> {
    state.job_status(job_id)
}

pub fn classify_candidate_for_test(path: &Path, size: u64) -> StorageCandidate {
    classify_candidate(path, size)
}

pub fn default_scan_roots_for_test() -> Vec<PathBuf> {
    default_scan_roots()
}

pub fn move_cleanup_candidates_to_trash_for_candidates(
    ids: Vec<String>,
    candidates: &[StorageCandidate],
    app_data_dir: Option<&Path>,
) -> Result<CleanupExecutionResult, String> {
    let by_id = candidates
        .iter()
        .map(|candidate| (candidate.id.as_str(), candidate))
        .collect::<HashMap<_, _>>();
    let mut result = CleanupExecutionResult {
        moved: 0,
        skipped: 0,
        failed: 0,
        logs: Vec::new(),
    };

    for id in ids {
        let Some(candidate) = by_id.get(id.as_str()) else {
            result.skipped += 1;
            result.logs.push(CleanupExecutionLog {
                path: String::new(),
                name: id,
                size: 0,
                status: "skipped".to_string(),
                message: "Candidate id was not found in the latest storage cleanup scan."
                    .to_string(),
                item_id: None,
                trash_path: None,
            });
            continue;
        };

        let path = Path::new(&candidate.path);
        if !cleanup_candidate_can_enter_operation_preview(candidate, app_data_dir) {
            result.skipped += 1;
            result.logs.push(CleanupExecutionLog {
                path: candidate.path.clone(),
                name: candidate.name.clone(),
                size: candidate.size,
                status: "skipped".to_string(),
                message:
                    "Only safe recycle-bin cleanup candidates from the latest scan can be moved."
                        .to_string(),
                item_id: None,
                trash_path: None,
            });
            continue;
        }

        match trash::delete(path) {
            Ok(()) => {
                result.moved += 1;
                result.logs.push(CleanupExecutionLog {
                    path: candidate.path.clone(),
                    name: candidate.name.clone(),
                    size: candidate.size,
                    status: "success".to_string(),
                    message:
                        "Moved to the system trash. Restore it from the system trash if needed."
                            .to_string(),
                    item_id: None,
                    trash_path: None,
                });
            }
            Err(error) => {
                result.failed += 1;
                result.logs.push(CleanupExecutionLog {
                    path: candidate.path.clone(),
                    name: candidate.name.clone(),
                    size: candidate.size,
                    status: "failed".to_string(),
                    message: format!("Failed to move to system trash: {error}"),
                    item_id: None,
                    trash_path: None,
                });
            }
        }
    }

    Ok(result)
}

pub fn move_cleanup_candidates_to_safe_trash_for_candidates(
    ids: Vec<String>,
    candidates: &[StorageCandidate],
    db: &Database,
    app_data_dir: Option<&Path>,
) -> Result<CleanupExecutionResult, String> {
    let by_id = candidates
        .iter()
        .map(|candidate| (candidate.id.as_str(), candidate))
        .collect::<HashMap<_, _>>();
    let batch_id = new_id("cleanup-safe-trash");
    let moved_at = current_timestamp_ms().to_string();
    let mut result = CleanupExecutionResult {
        moved: 0,
        skipped: 0,
        failed: 0,
        logs: Vec::new(),
    };
    let mut items = Vec::new();

    for (index, id) in ids.into_iter().enumerate() {
        let Some(candidate) = by_id.get(id.as_str()) else {
            result.skipped += 1;
            result.logs.push(CleanupExecutionLog {
                path: String::new(),
                name: id,
                size: 0,
                status: "skipped".to_string(),
                message: "Candidate id was not found in the latest storage cleanup scan."
                    .to_string(),
                item_id: None,
                trash_path: None,
            });
            continue;
        };

        let source = Path::new(&candidate.path);
        if !cleanup_candidate_can_enter_operation_preview(candidate, app_data_dir) {
            result.skipped += 1;
            result.logs.push(CleanupExecutionLog {
                path: candidate.path.clone(),
                name: candidate.name.clone(),
                size: candidate.size,
                status: "skipped".to_string(),
                message: "Only safe candidates from the latest scan can be moved to Zen Canvas Safe Trash.".to_string(),
                item_id: None,
                trash_path: None,
            });
            continue;
        }

        let item_id = candidate_item_id(candidate, index);
        let trash_path =
            safe_trash_item_path(source, &batch_id, &item_id, &candidate.name, app_data_dir);
        let trash_path_text = normalize_path(&trash_path);
        if trash_path.exists() {
            result.failed += 1;
            result.logs.push(CleanupExecutionLog {
                path: candidate.path.clone(),
                name: candidate.name.clone(),
                size: candidate.size,
                status: "failed".to_string(),
                message: "Safe trash destination already exists.".to_string(),
                item_id: Some(item_id),
                trash_path: Some(trash_path_text),
            });
            continue;
        }

        let item = CleanupTrashItem {
            id: item_id.clone(),
            batch_id: batch_id.clone(),
            original_path: candidate.path.clone(),
            trash_path: trash_path_text.clone(),
            name: candidate.name.clone(),
            size: candidate.size,
            moved_at: moved_at.clone(),
            restored_at: None,
            status: "pending".to_string(),
            message: Some("Pending move to Zen Canvas Safe Trash.".to_string()),
        };
        items.push(item);
    }

    if !items.is_empty() {
        let root = candidates
            .first()
            .and_then(|candidate| Path::new(&candidate.path).parent().map(normalize_path));
        db.save_cleanup_trash_batch(&CleanupTrashBatch {
            id: batch_id.clone(),
            created_at: moved_at.clone(),
            root: root.clone(),
            total_items: items.len(),
            total_size: items.iter().map(|item| item.size).sum(),
            status: "pending".to_string(),
            items: items.clone(),
        })
        .map_err(|error| {
            format!("failed to persist safe-trash journal before moving files: {error}")
        })?;

        for item in &mut items {
            let move_result = move_path_to_safe_trash(
                Path::new(&item.original_path),
                Path::new(&item.trash_path),
                item.size,
            );
            let (status, log_status, message) = match move_result {
                Ok(()) => {
                    result.moved += 1;
                    (
                        "moved",
                        "success",
                        "Moved to Zen Canvas Safe Trash.".to_string(),
                    )
                }
                Err(error) => {
                    result.failed += 1;
                    (
                        "failed",
                        "failed",
                        format!("Failed to move to Zen Canvas Safe Trash: {error}"),
                    )
                }
            };
            item.status = status.to_string();
            item.message = Some(message.clone());
            db.update_cleanup_trash_item_status(item).map_err(|error| {
                format!("safe-trash item moved but journal update failed: {error}")
            })?;
            result.logs.push(CleanupExecutionLog {
                path: item.original_path.clone(),
                name: item.name.clone(),
                size: item.size,
                status: log_status.to_string(),
                message,
                item_id: Some(item.id.clone()),
                trash_path: Some(item.trash_path.clone()),
            });
        }

        let status = if result.failed > 0 {
            "partial_failed"
        } else {
            "success"
        };
        db.save_cleanup_trash_batch(&CleanupTrashBatch {
            id: batch_id,
            created_at: moved_at,
            root,
            total_items: items.len(),
            total_size: items.iter().map(|item| item.size).sum(),
            status: status.to_string(),
            items,
        })
        .map_err(|error| error.to_string())?;
    }

    Ok(result)
}

pub fn restore_cleanup_trash_items_for_db(
    item_ids: Vec<String>,
    db: &Database,
) -> Result<CleanupRestoreResult, String> {
    let cancel_flag = Arc::new(AtomicBool::new(false));
    let emitter = NoopCleanupRestoreProgressEmitter;
    restore_cleanup_trash_items_for_db_with_progress(
        item_ids,
        db,
        cancel_flag,
        new_id("cleanup-restore-test"),
        &emitter,
    )
}

pub fn restore_cleanup_trash_items_for_db_with_cancel_for_test(
    item_ids: Vec<String>,
    db: &Database,
    cancel_flag: Arc<AtomicBool>,
) -> Result<CleanupRestoreResult, String> {
    let emitter = NoopCleanupRestoreProgressEmitter;
    restore_cleanup_trash_items_for_db_with_progress(
        item_ids,
        db,
        cancel_flag,
        new_id("cleanup-restore-test"),
        &emitter,
    )
}

fn restore_cleanup_trash_items_for_db_with_progress(
    item_ids: Vec<String>,
    db: &Database,
    cancel_flag: Arc<AtomicBool>,
    job_id: String,
    emitter: &impl CleanupRestoreProgressEmitter,
) -> Result<CleanupRestoreResult, String> {
    let total = item_ids.len();
    let mut result = CleanupRestoreResult {
        restored: 0,
        conflicts: 0,
        missing: 0,
        failed: 0,
        canceled: 0,
        logs: Vec::new(),
    };

    for item_id in item_ids {
        let mut current_path = None;
        if cancel_flag.load(Ordering::Relaxed) {
            result.canceled += 1;
            result.logs.push(CleanupRestoreLog {
                item_id: item_id.clone(),
                original_path: String::new(),
                trash_path: String::new(),
                status: "canceled".to_string(),
                message: "Cleanup restore canceled.".to_string(),
            });
            emit_cleanup_restore_progress(
                emitter,
                &job_id,
                result.logs.len(),
                total,
                Some(item_id),
                current_path,
                &result,
                &cancel_flag,
            );
            continue;
        }

        let Some(mut item) = db
            .cleanup_trash_item(&item_id)
            .map_err(|error| error.to_string())?
        else {
            result.failed += 1;
            result.logs.push(CleanupRestoreLog {
                item_id: item_id.clone(),
                original_path: String::new(),
                trash_path: String::new(),
                status: "failed".to_string(),
                message: "Cleanup trash item was not found.".to_string(),
            });
            emit_cleanup_restore_progress(
                emitter,
                &job_id,
                result.logs.len(),
                total,
                Some(item_id),
                current_path,
                &result,
                &cancel_flag,
            );
            continue;
        };

        let original = PathBuf::from(&item.original_path);
        let trash_path = PathBuf::from(&item.trash_path);
        current_path = Some(normalize_path(&trash_path));
        if cancel_flag.load(Ordering::Relaxed) {
            result.canceled += 1;
            result.logs.push(CleanupRestoreLog {
                item_id: item.id,
                original_path: normalize_path(&original),
                trash_path: normalize_path(&trash_path),
                status: "canceled".to_string(),
                message: "Cleanup restore canceled.".to_string(),
            });
            emit_cleanup_restore_progress(
                emitter,
                &job_id,
                result.logs.len(),
                total,
                Some(item_id),
                current_path,
                &result,
                &cancel_flag,
            );
            continue;
        }
        if item.status != "moved" {
            result.failed += 1;
            result.logs.push(CleanupRestoreLog {
                item_id: item.id,
                original_path: normalize_path(&original),
                trash_path: normalize_path(&trash_path),
                status: "failed".to_string(),
                message: "Cleanup trash item is no longer restorable.".to_string(),
            });
            emit_cleanup_restore_progress(
                emitter,
                &job_id,
                result.logs.len(),
                total,
                Some(item_id),
                current_path,
                &result,
                &cancel_flag,
            );
            continue;
        }
        if !trash_path.exists() {
            item.status = "missing".to_string();
            item.message = Some("Safe trash path is missing.".to_string());
            db.update_cleanup_trash_item_status(&item)
                .map_err(|error| error.to_string())?;
            result.missing += 1;
            result.logs.push(CleanupRestoreLog {
                item_id: item.id,
                original_path: normalize_path(&original),
                trash_path: normalize_path(&trash_path),
                status: "missing".to_string(),
                message: "Safe trash path is missing.".to_string(),
            });
            emit_cleanup_restore_progress(
                emitter,
                &job_id,
                result.logs.len(),
                total,
                Some(item_id),
                current_path,
                &result,
                &cancel_flag,
            );
            continue;
        }
        if original.exists() {
            result.conflicts += 1;
            result.logs.push(CleanupRestoreLog {
                item_id: item.id,
                original_path: normalize_path(&original),
                trash_path: normalize_path(&trash_path),
                status: "conflict".to_string(),
                message: "Restore is blocked because the original path already exists.".to_string(),
            });
            emit_cleanup_restore_progress(
                emitter,
                &job_id,
                result.logs.len(),
                total,
                Some(item_id),
                current_path,
                &result,
                &cancel_flag,
            );
            continue;
        }

        match move_path_to_restore_location(&trash_path, &original, item.size) {
            Ok(()) => {
                item.status = "restored".to_string();
                item.restored_at = Some(current_timestamp_ms().to_string());
                item.message = Some("Restored from Zen Canvas Safe Trash.".to_string());
                db.update_cleanup_trash_item_status(&item)
                    .map_err(|error| error.to_string())?;
                result.restored += 1;
                result.logs.push(CleanupRestoreLog {
                    item_id: item.id,
                    original_path: normalize_path(&original),
                    trash_path: normalize_path(&trash_path),
                    status: "restored".to_string(),
                    message: "Restored from Zen Canvas Safe Trash.".to_string(),
                });
            }
            Err(error) => {
                item.status = "failed".to_string();
                item.message = Some(error.clone());
                db.update_cleanup_trash_item_status(&item)
                    .map_err(|error| error.to_string())?;
                result.failed += 1;
                result.logs.push(CleanupRestoreLog {
                    item_id: item.id,
                    original_path: normalize_path(&original),
                    trash_path: normalize_path(&trash_path),
                    status: "failed".to_string(),
                    message: error,
                });
            }
        }
        emit_cleanup_restore_progress(
            emitter,
            &job_id,
            result.logs.len(),
            total,
            Some(item_id),
            current_path,
            &result,
            &cancel_flag,
        );
    }

    Ok(result)
}

fn emit_cleanup_restore_progress(
    emitter: &impl CleanupRestoreProgressEmitter,
    job_id: &str,
    processed: usize,
    total: usize,
    current_item_id: Option<String>,
    current_path: Option<String>,
    result: &CleanupRestoreResult,
    cancel_flag: &AtomicBool,
) {
    emitter.emit_progress(CleanupRestoreProgressPayload {
        job_id: job_id.to_string(),
        processed,
        total,
        current_item_id,
        current_path,
        restored: result.restored,
        conflicts: result.conflicts,
        missing: result.missing,
        failed: result.failed,
        canceled: result.canceled,
        cancel_requested: cancel_flag.load(Ordering::Relaxed),
    });
}

pub fn reconcile_pending_cleanup_journal(db: &Database) -> Result<usize, String> {
    let mut items = db
        .pending_cleanup_trash_items()
        .map_err(|error| error.to_string())?;
    for item in &mut items {
        let original_exists = Path::new(&item.original_path).exists();
        let trash_exists = Path::new(&item.trash_path).exists();
        if !original_exists && trash_exists {
            item.status = "moved".to_string();
            item.message =
                Some("Recovered an interrupted Safe Trash journal after restart.".to_string());
        } else {
            item.status = "failed".to_string();
            item.message = Some(if original_exists && !trash_exists {
                "Safe Trash move was interrupted before the filesystem change.".to_string()
            } else {
                "Interrupted Safe Trash move requires manual path review.".to_string()
            });
        }
        db.update_cleanup_trash_item_status(item)
            .map_err(|error| error.to_string())?;
    }
    if !items.is_empty() {
        db.recompute_cleanup_batch_statuses()
            .map_err(|error| error.to_string())?;
    }
    Ok(items.len())
}

pub fn is_forbidden_storage_path_for_test(path: &Path) -> bool {
    is_forbidden_storage_path(path, &[])
}

pub fn is_cleanup_execution_forbidden(path: &Path, app_data_dir: Option<&Path>) -> bool {
    if path.as_os_str().is_empty() {
        return true;
    }
    let lower = normalize_for_compare(path);
    if lower.contains('\0') || lower.contains('*') || lower.contains('?') {
        return true;
    }
    if path
        .components()
        .any(|component| component == std::path::Component::ParentDir)
    {
        return true;
    }
    if path.parent().is_none() || path.file_name().is_none() || is_drive_root(path) {
        return true;
    }
    if fs::symlink_metadata(path)
        .map(|metadata| metadata.file_type().is_symlink())
        .unwrap_or(false)
    {
        return true;
    }

    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    app_data_dir
        .map(|dir| is_same_or_child(&lower, &normalize_for_compare(dir)))
        .unwrap_or(false)
        || is_forbidden_storage_path(path, &[])
        || is_program_files_path_text(&lower)
        || is_appdata_core_path_text(&lower)
        || is_browser_profile_path(&lower)
        || is_chat_database_path(&lower, &extension)
        || is_database_extension(&extension)
}

pub fn cleanup_preview_items_for_candidates(
    ids: Vec<String>,
    candidates: &[StorageCandidate],
) -> Result<Vec<CleanupPreviewItem>, String> {
    let requested: HashSet<&str> = ids.iter().map(String::as_str).collect();
    Ok(candidates
        .iter()
        .filter(|candidate| requested.contains(candidate.id.as_str()))
        .filter(|candidate| {
            candidate.tier == CleanupTier::Safe
                && candidate.trash_allowed
                && candidate.suggested_action == CleanupActionKind::MoveToTrash
                && !is_forbidden_storage_path(Path::new(&candidate.path), &[])
        })
        .map(cleanup_preview_item)
        .collect())
}

pub fn preview_cleanup_operations_for_candidates(
    ids: Vec<String>,
    candidates: &[StorageCandidate],
    app_data_dir: Option<&Path>,
) -> Result<OperationPreviewScopeResult, String> {
    let requested: HashSet<&str> = ids.iter().map(String::as_str).collect();
    let previews = candidates
        .iter()
        .filter(|candidate| requested.contains(candidate.id.as_str()))
        .filter(|candidate| cleanup_candidate_can_enter_operation_preview(candidate, app_data_dir))
        .map(cleanup_operation_preview)
        .collect::<Vec<_>>();

    Ok(OperationPreviewScopeResult {
        total: previews.len() as i64,
        limit: previews.len() as u32,
        offset: 0,
        truncated: false,
        has_more: false,
        previews,
    })
}

fn cleanup_candidate_can_enter_operation_preview(
    candidate: &StorageCandidate,
    app_data_dir: Option<&Path>,
) -> bool {
    let path = Path::new(&candidate.path);
    candidate.tier == CleanupTier::Safe
        && candidate.trash_allowed
        && candidate.suggested_action == CleanupActionKind::MoveToTrash
        && path.exists()
        && !is_cleanup_execution_forbidden(path, app_data_dir)
}

fn cleanup_operation_preview(candidate: &StorageCandidate) -> OperationPreviewDto {
    OperationPreviewDto {
        id: format!("cleanup-trash-{}", candidate.id),
        file_id: candidate.id.clone(),
        operation_type: "move_to_trash".to_string(),
        source_path: candidate.path.clone(),
        target_path: "Recycle Bin".to_string(),
        old_name: candidate.name.clone(),
        new_name: candidate.name.clone(),
        status: "pending".to_string(),
        risk_level: "Normal".to_string(),
        confidence: 1.0,
        requires_confirmation: true,
        suggested_action: "DeleteCandidate".to_string(),
        is_duplicate: false,
        reason: candidate.reason.clone(),
        selected_by_default: Some(true),
        is_executable: Some(true),
        blocking_reason: None,
        editable_new_name: Some(false),
        target_parent_exists: Some(true),
        will_create_parent: Some(false),
    }
}

fn run_storage_cleanup_scan_job<R: Runtime>(
    roots: Vec<PathBuf>,
    excluded_paths: Vec<PathBuf>,
    app: AppHandle<R>,
    state: StorageCleanupState,
    job_id: String,
    cancel_flag: Arc<AtomicBool>,
) {
    let app_for_progress = app.clone();
    let state_for_progress = state.clone();
    let result = analyze_storage_roots_with_progress(
        roots,
        excluded_paths,
        Some(Arc::clone(&cancel_flag)),
        job_id.clone(),
        move |progress| {
            state_for_progress.update_job_progress(progress.clone())?;
            app_for_progress
                .emit(STORAGE_CLEANUP_PROGRESS_EVENT, progress)
                .map_err(|error| error.to_string())
        },
    );
    finish_storage_cleanup_scan_job(result, app, state, job_id, cancel_flag);
}

fn run_storage_cleanup_scan_job_without_events(
    roots: Vec<PathBuf>,
    excluded_paths: Vec<PathBuf>,
    state: StorageCleanupState,
    job_id: String,
    cancel_flag: Arc<AtomicBool>,
) {
    let state_for_progress = state.clone();
    let result = analyze_storage_roots_with_progress(
        roots,
        excluded_paths,
        Some(Arc::clone(&cancel_flag)),
        job_id.clone(),
        move |progress| state_for_progress.update_job_progress(progress),
    );
    match result {
        Ok(analysis) if cancel_flag.load(Ordering::Relaxed) => {
            let _ = state.mark_job_cancelled(&job_id);
            let _ = analysis;
        }
        Ok(analysis) => {
            let _ = state.complete_job(&job_id, analysis);
        }
        Err(error) => {
            let _ = state.fail_job(&job_id, error);
        }
    }
}

fn finish_storage_cleanup_scan_job<R: Runtime>(
    result: Result<StorageAnalysis, String>,
    app: AppHandle<R>,
    state: StorageCleanupState,
    job_id: String,
    cancel_flag: Arc<AtomicBool>,
) {
    match result {
        Ok(analysis) if cancel_flag.load(Ordering::Relaxed) => {
            let _ = state.mark_job_cancelled(&job_id);
            let _ = app.emit(
                STORAGE_CLEANUP_CANCELLED_EVENT,
                StorageCleanupJobMessage {
                    job_id,
                    message: "Storage cleanup scan was cancelled.".to_string(),
                },
            );
            let _ = analysis;
        }
        Ok(analysis) => {
            let completed = StorageCleanupCompleted {
                job_id: job_id.clone(),
                analysis: storage_analysis_page(&analysis, 0, STORAGE_CLEANUP_PAGE_SIZE),
            };
            let _ = state.complete_job(&job_id, analysis);
            let _ = app.emit(STORAGE_CLEANUP_COMPLETED_EVENT, completed);
        }
        Err(error) => {
            let _ = state.fail_job(&job_id, error.clone());
            let _ = app.emit(
                STORAGE_CLEANUP_FAILED_EVENT,
                StorageCleanupJobMessage {
                    job_id,
                    message: error,
                },
            );
        }
    }
}

fn analyze_storage_roots(
    roots: Vec<PathBuf>,
    excluded_paths: Vec<PathBuf>,
) -> Result<StorageAnalysis, String> {
    analyze_storage_roots_with_progress(roots, excluded_paths, None, String::new(), |_| Ok(()))
}

fn analyze_storage_roots_with_progress<F>(
    roots: Vec<PathBuf>,
    excluded_paths: Vec<PathBuf>,
    cancel_flag: Option<Arc<AtomicBool>>,
    job_id: String,
    mut on_progress: F,
) -> Result<StorageAnalysis, String>
where
    F: FnMut(StorageCleanupProgress) -> Result<(), String>,
{
    let scan_roots = roots
        .iter()
        .map(|root| normalize_for_compare(root))
        .collect::<HashSet<_>>();
    let mut context = ScanContext {
        scan_roots,
        excluded_paths,
        candidates: Vec::new(),
        denied_paths: Vec::new(),
        warnings: Vec::new(),
        progress: StorageCleanupProgress {
            job_id,
            scanned_entries: 0,
            current_path: None,
            total_size: 0,
        },
        cancel_flag,
        cancelled: false,
        last_emit: Instant::now(),
    };
    let mut total_size = 0_u64;

    for root in roots {
        if context.is_cancelled() {
            break;
        }
        if root.as_os_str().is_empty() {
            continue;
        }
        if is_drive_root(&root) {
            context.warnings.push(format!(
                "{} may take longer because it is a whole disk root.",
                normalize_path(&root)
            ));
        }
        if is_forbidden_storage_path(&root, &context.excluded_paths) {
            context.denied_paths.push(normalize_path(&root));
            continue;
        }
        if !root.exists() {
            continue;
        }
        total_size =
            total_size.saturating_add(scan_path_size(&root, &mut context, &mut on_progress));
    }

    context.emit_progress(&mut on_progress, true)?;
    context.candidates.sort_by(|left, right| {
        right
            .size
            .cmp(&left.size)
            .then_with(|| left.path.cmp(&right.path))
    });
    dedupe_candidates(&mut context.candidates);
    context.candidates.sort_by(|left, right| {
        right
            .size
            .cmp(&left.size)
            .then_with(|| left.path.cmp(&right.path))
    });

    let reclaimable_estimate = context
        .candidates
        .iter()
        .filter(|candidate| candidate.tier == CleanupTier::Safe && candidate.trash_allowed)
        .map(|candidate| candidate.size)
        .sum();
    let review_estimate = context
        .candidates
        .iter()
        .filter(|candidate| candidate.tier == CleanupTier::Review)
        .map(|candidate| candidate.size)
        .sum();

    let candidate_total = context.candidates.len();
    Ok(StorageAnalysis {
        total_size,
        reclaimable_estimate,
        review_estimate,
        candidates: context.candidates,
        denied_paths: context.denied_paths,
        warnings: context.warnings,
        candidate_total,
        candidate_offset: 0,
        candidate_limit: candidate_total,
        has_more: false,
    })
}

fn storage_analysis_page(
    analysis: &StorageAnalysis,
    offset: usize,
    limit: usize,
) -> StorageAnalysis {
    let total = analysis.candidates.len();
    let offset = offset.min(total);
    let end = offset.saturating_add(limit).min(total);
    StorageAnalysis {
        total_size: analysis.total_size,
        reclaimable_estimate: analysis.reclaimable_estimate,
        review_estimate: analysis.review_estimate,
        candidates: analysis.candidates[offset..end].to_vec(),
        denied_paths: analysis.denied_paths.clone(),
        warnings: analysis.warnings.clone(),
        candidate_total: total,
        candidate_offset: offset,
        candidate_limit: limit,
        has_more: end < total,
    }
}

struct ScanContext {
    scan_roots: HashSet<String>,
    excluded_paths: Vec<PathBuf>,
    candidates: Vec<StorageCandidate>,
    denied_paths: Vec<String>,
    warnings: Vec<String>,
    progress: StorageCleanupProgress,
    cancel_flag: Option<Arc<AtomicBool>>,
    cancelled: bool,
    last_emit: Instant,
}

impl ScanContext {
    fn is_cancelled(&mut self) -> bool {
        let cancelled = self
            .cancel_flag
            .as_ref()
            .map(|flag| flag.load(Ordering::Relaxed))
            .unwrap_or(false);
        if cancelled {
            self.cancelled = true;
        }
        cancelled
    }

    fn record_progress<F>(
        &mut self,
        path: &Path,
        size: u64,
        on_progress: &mut F,
    ) -> Result<(), String>
    where
        F: FnMut(StorageCleanupProgress) -> Result<(), String>,
    {
        self.progress.scanned_entries = self.progress.scanned_entries.saturating_add(1);
        self.progress.current_path = Some(normalize_path(path));
        self.progress.total_size = self.progress.total_size.saturating_add(size);
        self.emit_progress(on_progress, false)
    }

    fn emit_progress<F>(&mut self, on_progress: &mut F, force: bool) -> Result<(), String>
    where
        F: FnMut(StorageCleanupProgress) -> Result<(), String>,
    {
        let now = Instant::now();
        if force
            || self
                .progress
                .scanned_entries
                .is_multiple_of(STORAGE_CLEANUP_EMIT_ENTRY_INTERVAL)
            || now.duration_since(self.last_emit) >= STORAGE_CLEANUP_EMIT_INTERVAL
        {
            self.last_emit = now;
            on_progress(self.progress.clone())?;
        }
        Ok(())
    }
}

fn validate_cleanup_roots(roots: Vec<String>) -> Result<Vec<PathBuf>, String> {
    if roots.is_empty() {
        return Err("Choose a disk or folder before scanning storage cleanup.".to_string());
    }

    let mut validated = roots
        .into_iter()
        .map(|root| root.trim().to_string())
        .filter(|root| !root.is_empty())
        .map(PathBuf::from)
        .map(|root| {
            if !root.is_absolute() {
                return Err(format!(
                    "Cleanup scope must be an absolute path: {}",
                    normalize_path(&root)
                ));
            }
            if is_forbidden_storage_path(&root, &[]) {
                return Err(format!(
                    "Cleanup scope is protected and cannot be scanned: {}",
                    normalize_path(&root)
                ));
            }
            if !root.exists() {
                return Err(format!(
                    "Cleanup scope does not exist: {}",
                    normalize_path(&root)
                ));
            }
            Ok(root)
        })
        .collect::<Result<Vec<_>, _>>()?;

    dedupe_paths(&mut validated);
    if validated.is_empty() {
        return Err("Choose a disk or folder before scanning storage cleanup.".to_string());
    }
    Ok(validated)
}

fn scan_path_size<F>(path: &Path, context: &mut ScanContext, on_progress: &mut F) -> u64
where
    F: FnMut(StorageCleanupProgress) -> Result<(), String>,
{
    if context.is_cancelled() {
        return 0;
    }
    if is_forbidden_storage_path(path, &context.excluded_paths) {
        context.denied_paths.push(normalize_path(path));
        return 0;
    }

    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(_) => {
            context.denied_paths.push(normalize_path(path));
            return 0;
        }
    };

    if metadata.file_type().is_symlink() {
        context.denied_paths.push(normalize_path(path));
        return 0;
    }

    if metadata.is_file() {
        let size = metadata.len();
        let _ = context.record_progress(path, size, on_progress);
        maybe_record_candidate(path, size, false, context);
        return size;
    }

    if !metadata.is_dir() {
        return 0;
    }

    let mut size = 0_u64;
    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(_) => {
            context.denied_paths.push(normalize_path(path));
            return 0;
        }
    };

    for entry in entries.flatten() {
        if context.is_cancelled() {
            break;
        }
        size = size.saturating_add(scan_path_size(&entry.path(), context, on_progress));
    }

    let _ = context.record_progress(path, 0, on_progress);
    maybe_record_candidate(path, size, true, context);
    size
}

fn maybe_record_candidate(path: &Path, size: u64, is_dir: bool, context: &mut ScanContext) {
    if size == 0 || context.scan_roots.contains(&normalize_for_compare(path)) {
        return;
    }

    let candidate = classify_candidate(path, size);
    let is_large = if is_dir {
        size >= LARGE_DIR_THRESHOLD
    } else {
        size >= LARGE_FILE_THRESHOLD
    };
    let known_candidate = candidate.tier != CleanupTier::Review || candidate.trash_allowed;
    let review_candidate = candidate.tier == CleanupTier::Review && is_large;

    if known_candidate || review_candidate || is_generated_dir_name(path) {
        context.candidates.push(candidate);
    }
}

fn classify_candidate(path: &Path, size: u64) -> StorageCandidate {
    let normalized = normalize_path(path);
    let lower = normalized.to_ascii_lowercase();
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(normalized.as_str())
        .to_string();
    let lower_name = name.to_ascii_lowercase();
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    let (tier, category, reason, suggested_action, risk_note) = if is_system_path_text(&lower)
        || lower.contains("/programdata")
    {
        (
            CleanupTier::Caution,
            "System".to_string(),
            "System-managed location. Manual cleanup can break Windows or shared app state."
                .to_string(),
            CleanupActionKind::None,
            Some("No cleanup action is offered for system paths.".to_string()),
        )
    } else if is_program_files_path_text(&lower) {
        (
                CleanupTier::Caution,
                "Application".to_string(),
                "Installed application body. Use the app uninstaller or Windows Apps settings instead of deleting files directly.".to_string(),
                CleanupActionKind::UninstallAdvice,
                Some("Manual deletion can leave services, registry entries, and shared components behind.".to_string()),
            )
    } else if is_virtual_machine_image(&extension) {
        (
            CleanupTier::Caution,
            "Virtual machine image".to_string(),
            "Virtual machine images can contain full working systems or user data.".to_string(),
            CleanupActionKind::Reveal,
            Some("Confirm in the virtualization app before moving or deleting.".to_string()),
        )
    } else if is_chat_database_path(&lower, &extension) || is_database_extension(&extension) {
        (
                CleanupTier::Caution,
                "Application database".to_string(),
                "Database-like application data should not be moved while the owning app may be using it.".to_string(),
                CleanupActionKind::Reveal,
                Some("Use the app's own cleanup/export tools before touching database files.".to_string()),
            )
    } else if is_browser_profile_path(&lower) {
        (
            CleanupTier::Caution,
            "Browser profile".to_string(),
            "Browser profiles can contain sessions, passwords, cookies, and extension state."
                .to_string(),
            CleanupActionKind::AppInternalCleanup,
            Some("Use browser settings for cache, profile, or account cleanup.".to_string()),
        )
    } else if lower_name == "node_modules" {
        (
            CleanupTier::Safe,
            "Regenerable dependency folder".to_string(),
            "node_modules dependencies can usually be recreated by the package manager.".to_string(),
            CleanupActionKind::MoveToTrash,
            Some(
                "Review project context first: dependency folders can contain linked packages or local patches."
                    .to_string(),
            ),
        )
    } else if is_temp_path(&lower) {
        (
            CleanupTier::Safe,
            "Temporary files".to_string(),
            "Temporary directory content is normally regenerated by applications.".to_string(),
            CleanupActionKind::MoveToTrash,
            None,
        )
    } else if is_generated_dir_name(path) {
        (
            CleanupTier::Safe,
            "Regenerable development output".to_string(),
            "Build output can usually be recreated by the build tool.".to_string(),
            CleanupActionKind::MoveToTrash,
            Some(
                "Confirm this is generated output before adding it to the cleanup list."
                    .to_string(),
            ),
        )
    } else if is_package_cache_path(&lower, &lower_name) {
        (
            CleanupTier::Safe,
            "Developer cache".to_string(),
            "Package-manager cache is explicitly regenerable.".to_string(),
            CleanupActionKind::MoveToTrash,
            None,
        )
    } else if is_installer_residue(&lower, &extension) {
        (
            CleanupTier::Safe,
            "Installer residue".to_string(),
            "Installer packages can usually be downloaded again if needed.".to_string(),
            CleanupActionKind::MoveToTrash,
            None,
        )
    } else if is_appdata_path(&lower) {
        (
            CleanupTier::Caution,
            "Application data".to_string(),
            "AppData can contain account state, local databases, and app configuration."
                .to_string(),
            CleanupActionKind::Reveal,
            Some("Prefer app-provided cleanup controls for this location.".to_string()),
        )
    } else if is_downloads_path(&lower)
        || is_chat_file_path(&lower)
        || is_review_extension(&extension)
        || size >= LARGE_DIR_THRESHOLD
        || size >= LARGE_FILE_THRESHOLD
    {
        (
            CleanupTier::Review,
            review_category(&lower, &extension),
            "User-owned or unknown large content needs human review before cleanup.".to_string(),
            CleanupActionKind::Reveal,
            Some(
                "Open the location and select explicit items only after reviewing them."
                    .to_string(),
            ),
        )
    } else {
        (
            CleanupTier::Review,
            "Other".to_string(),
            "Unknown storage item.".to_string(),
            CleanupActionKind::Reveal,
            Some("No cleanup action is selected by default.".to_string()),
        )
    };

    let trash_allowed = tier == CleanupTier::Safe
        && suggested_action == CleanupActionKind::MoveToTrash
        && !is_forbidden_storage_path(path, &[]);
    let selected_by_default = trash_allowed
        && (is_temp_path(&lower)
            || is_package_cache_path(&lower, &lower_name)
            || lower_name == "node_modules");

    StorageCandidate {
        id: candidate_id(&normalized),
        path: normalized,
        name,
        size,
        tier,
        category,
        reason,
        suggested_action,
        risk_note,
        trash_allowed,
        selected_by_default,
    }
}

fn cleanup_preview_item(candidate: &StorageCandidate) -> CleanupPreviewItem {
    CleanupPreviewItem {
        id: format!("cleanup-preview-{}", candidate.id),
        candidate_id: candidate.id.clone(),
        path: candidate.path.clone(),
        name: candidate.name.clone(),
        size: candidate.size,
        tier: candidate.tier.clone(),
        category: candidate.category.clone(),
        reason: candidate.reason.clone(),
        operation_type: "move_to_trash_preview".to_string(),
        target_path: "Recycle Bin".to_string(),
        status: "pending".to_string(),
        requires_confirmation: true,
        is_executable: false,
        blocking_reason: Some(
            "Preview only: Zen Canvas has not enabled direct recycle-bin execution for storage cleanup."
                .to_string(),
        ),
    }
}

impl Database {
    pub fn save_cleanup_trash_batch(&self, batch: &CleanupTrashBatch) -> Result<(), DbError> {
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        tx.execute(
            r#"
            INSERT INTO cleanup_trash_batches (id, created_at, root, total_items, total_size, status)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(id) DO UPDATE SET
                created_at = excluded.created_at,
                root = excluded.root,
                total_items = excluded.total_items,
                total_size = excluded.total_size,
                status = excluded.status
            "#,
            params![
                batch.id,
                batch.created_at,
                batch.root,
                i64::try_from(batch.total_items).unwrap_or(i64::MAX),
                i64::try_from(batch.total_size).unwrap_or(i64::MAX),
                batch.status
            ],
        )?;
        {
            let mut stmt = tx.prepare(
                r#"
                INSERT INTO cleanup_trash_items (
                    id, batch_id, original_path, trash_path, name, size, moved_at, restored_at, status, message
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                ON CONFLICT(id) DO UPDATE SET
                    batch_id = excluded.batch_id,
                    original_path = excluded.original_path,
                    trash_path = excluded.trash_path,
                    name = excluded.name,
                    size = excluded.size,
                    moved_at = excluded.moved_at,
                    restored_at = excluded.restored_at,
                    status = excluded.status,
                    message = excluded.message
                "#,
            )?;
            for item in &batch.items {
                stmt.execute(params![
                    item.id,
                    item.batch_id,
                    item.original_path,
                    item.trash_path,
                    item.name,
                    i64::try_from(item.size).unwrap_or(i64::MAX),
                    item.moved_at,
                    item.restored_at,
                    item.status,
                    item.message
                ])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn list_cleanup_trash_batches(&self) -> Result<Vec<CleanupTrashBatch>, DbError> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            r#"
            SELECT b.id, b.created_at, b.root, b.total_items, b.total_size, b.status,
                   i.id, i.batch_id, i.original_path, i.trash_path, i.name, i.size,
                   i.moved_at, i.restored_at, i.status, i.message
            FROM cleanup_trash_batches AS b
            LEFT JOIN cleanup_trash_items AS i ON i.batch_id = b.id
            ORDER BY CAST(b.created_at AS INTEGER) DESC, i.name COLLATE NOCASE ASC
            "#,
        )?;
        let mut rows = stmt.query([])?;
        let mut batches = Vec::new();
        let mut batch_indexes = HashMap::<String, usize>::new();
        while let Some(row) = rows.next()? {
            let id = row.get::<_, String>(0)?;
            let index = if let Some(index) = batch_indexes.get(&id) {
                *index
            } else {
                let index = batches.len();
                batches.push(CleanupTrashBatch {
                    id: id.clone(),
                    created_at: row.get(1)?,
                    root: row.get(2)?,
                    total_items: usize::try_from(row.get::<_, i64>(3)?).unwrap_or(0),
                    total_size: u64::try_from(row.get::<_, i64>(4)?).unwrap_or(0),
                    status: row.get(5)?,
                    items: Vec::new(),
                });
                batch_indexes.insert(id, index);
                index
            };
            let item_id = row.get::<_, Option<String>>(6)?;
            if let Some(item_id) = item_id {
                batches[index].items.push(CleanupTrashItem {
                    id: item_id,
                    batch_id: row.get(7)?,
                    original_path: row.get(8)?,
                    trash_path: row.get(9)?,
                    name: row.get(10)?,
                    size: u64::try_from(row.get::<_, i64>(11)?).unwrap_or(0),
                    moved_at: row.get(12)?,
                    restored_at: row.get(13)?,
                    status: row.get(14)?,
                    message: row.get(15)?,
                });
            }
        }
        Ok(batches)
    }

    pub fn cleanup_trash_items_for_batch(
        &self,
        batch_id: &str,
    ) -> Result<Vec<CleanupTrashItem>, DbError> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            r#"
            SELECT id, batch_id, original_path, trash_path, name, size, moved_at, restored_at, status, message
            FROM cleanup_trash_items
            WHERE batch_id = ?1
            ORDER BY name COLLATE NOCASE ASC
            "#,
        )?;
        let rows = stmt.query_map(params![batch_id], cleanup_trash_item_from_row)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(DbError::from)
    }

    pub fn cleanup_trash_item(&self, id: &str) -> Result<Option<CleanupTrashItem>, DbError> {
        let conn = self.conn()?;
        conn.query_row(
            r#"
            SELECT id, batch_id, original_path, trash_path, name, size, moved_at, restored_at, status, message
            FROM cleanup_trash_items
            WHERE id = ?1
            "#,
            params![id],
            cleanup_trash_item_from_row,
        )
        .optional()
        .map_err(DbError::from)
    }

    pub fn pending_cleanup_trash_items(&self) -> Result<Vec<CleanupTrashItem>, DbError> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            r#"
            SELECT id, batch_id, original_path, trash_path, name, size, moved_at, restored_at, status, message
            FROM cleanup_trash_items
            WHERE status = 'pending'
            ORDER BY moved_at ASC
            "#,
        )?;
        let rows = stmt.query_map([], cleanup_trash_item_from_row)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(DbError::from)
    }

    pub fn recompute_cleanup_batch_statuses(&self) -> Result<(), DbError> {
        let conn = self.conn()?;
        conn.execute_batch(
            r#"
            UPDATE cleanup_trash_batches AS batch
            SET status = CASE
                WHEN EXISTS (
                    SELECT 1 FROM cleanup_trash_items AS item
                    WHERE item.batch_id = batch.id AND item.status = 'pending'
                ) THEN 'pending'
                WHEN EXISTS (
                    SELECT 1 FROM cleanup_trash_items AS item
                    WHERE item.batch_id = batch.id AND item.status = 'failed'
                ) THEN 'partial_failed'
                ELSE 'success'
            END
            WHERE EXISTS (
                SELECT 1 FROM cleanup_trash_items AS item WHERE item.batch_id = batch.id
            );
            "#,
        )?;
        Ok(())
    }

    pub fn update_cleanup_trash_item_status(&self, item: &CleanupTrashItem) -> Result<(), DbError> {
        let conn = self.conn()?;
        conn.execute(
            r#"
            UPDATE cleanup_trash_items
            SET restored_at = ?2,
                status = ?3,
                message = ?4
            WHERE id = ?1
            "#,
            params![item.id, item.restored_at, item.status, item.message],
        )?;
        Ok(())
    }
}

fn cleanup_trash_item_from_row(row: &Row<'_>) -> rusqlite::Result<CleanupTrashItem> {
    let size: i64 = row.get(5)?;
    Ok(CleanupTrashItem {
        id: row.get(0)?,
        batch_id: row.get(1)?,
        original_path: row.get(2)?,
        trash_path: row.get(3)?,
        name: row.get(4)?,
        size: u64::try_from(size).unwrap_or(0),
        moved_at: row.get(6)?,
        restored_at: row.get(7)?,
        status: row.get(8)?,
        message: row.get(9)?,
    })
}

fn candidate_item_id(candidate: &StorageCandidate, index: usize) -> String {
    let mut hasher = DefaultHasher::new();
    candidate.id.hash(&mut hasher);
    candidate.path.hash(&mut hasher);
    index.hash(&mut hasher);
    format!("cleanup-item-{:016x}", hasher.finish())
}

fn safe_trash_item_path(
    source: &Path,
    batch_id: &str,
    item_id: &str,
    name: &str,
    app_data_dir: Option<&Path>,
) -> PathBuf {
    let root = preferred_safe_trash_root(source)
        .or_else(|| app_data_dir.map(|dir| dir.join("safe-trash")))
        .unwrap_or_else(|| env::temp_dir().join("Zen Canvas").join("safe-trash"));
    root.join("items").join(batch_id).join(item_id).join(name)
}

fn preferred_safe_trash_root(source: &Path) -> Option<PathBuf> {
    source
        .parent()
        .map(|parent| parent.join(".zen-canvas-trash"))
}

fn move_path_to_safe_trash(
    source: &Path,
    trash_path: &Path,
    expected_size: u64,
) -> Result<(), String> {
    move_path_with_copy_fallback(source, trash_path, expected_size)
}

fn move_path_to_restore_location(
    trash_path: &Path,
    original: &Path,
    expected_size: u64,
) -> Result<(), String> {
    move_path_with_copy_fallback(trash_path, original, expected_size)
}

fn move_path_with_copy_fallback(
    source: &Path,
    target: &Path,
    expected_size: u64,
) -> Result<(), String> {
    if target.exists() {
        return Err("target path already exists".to_string());
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    match fs::rename(source, target) {
        Ok(()) => return Ok(()),
        Err(_) => {
            let stage = staging_path_for(target);
            if stage.exists() {
                let _ = remove_path(&stage);
            }
            if let Err(error) = copy_path(source, &stage) {
                let _ = remove_path(&stage);
                return Err(error);
            }
            let copied_size = path_size_for_verify(&stage)?;
            if expected_size > 0 && copied_size != expected_size {
                let _ = remove_path(&stage);
                return Err(format!(
                    "copy verification failed: expected {expected_size} bytes, copied {copied_size} bytes"
                ));
            }
            fs::rename(&stage, target).map_err(|error| {
                let _ = remove_path(&stage);
                format!("failed to commit staged safe-trash copy: {error}")
            })?;
            remove_path(source)?;
        }
    }
    Ok(())
}

fn staging_path_for(target: &Path) -> PathBuf {
    let name = target
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("item");
    target.with_file_name(format!(
        ".{name}.zencanvas-stage-{}",
        current_timestamp_ms()
    ))
}

fn copy_path(source: &Path, target: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(source).map_err(|error| error.to_string())?;
    if metadata.file_type().is_symlink() {
        return Err("refusing to copy symlink into safe trash".to_string());
    }
    if metadata.is_file() {
        fs::copy(source, target).map_err(|error| error.to_string())?;
        return Ok(());
    }
    if metadata.is_dir() {
        fs::create_dir_all(target).map_err(|error| error.to_string())?;
        for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            copy_path(&entry.path(), &target.join(entry.file_name()))?;
        }
        return Ok(());
    }
    Err("unsupported file type for safe trash".to_string())
}

fn remove_path(path: &Path) -> Result<(), String> {
    if path.is_dir() {
        fs::remove_dir_all(path).map_err(|error| error.to_string())
    } else {
        fs::remove_file(path).map_err(|error| error.to_string())
    }
}

fn path_size_for_verify(path: &Path) -> Result<u64, String> {
    let metadata = fs::symlink_metadata(path).map_err(|error| error.to_string())?;
    if metadata.is_file() {
        return Ok(metadata.len());
    }
    if metadata.is_dir() {
        let mut size = 0_u64;
        for entry in fs::read_dir(path).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            size = size.saturating_add(path_size_for_verify(&entry.path())?);
        }
        return Ok(size);
    }
    Ok(0)
}

fn default_scan_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    push_if_some(&mut roots, dirs::download_dir());
    push_if_some(&mut roots, dirs::desktop_dir());
    push_if_some(&mut roots, dirs::document_dir());
    add_standard_user_roots(&mut roots);
    roots.push(env::temp_dir());
    add_home_dev_cache_roots(&mut roots);
    dedupe_paths(&mut roots);
    roots
}

fn add_standard_user_roots(roots: &mut Vec<PathBuf>) {
    let Some(home) = dirs::home_dir() else {
        return;
    };
    for relative in ["Downloads", "Desktop", "Documents"] {
        roots.push(home.join(relative));
    }
}

fn add_home_dev_cache_roots(roots: &mut Vec<PathBuf>) {
    let Some(home) = dirs::home_dir() else {
        return;
    };
    for relative in [
        ".npm",
        ".pnpm-store",
        ".cargo/registry/cache",
        ".cargo/git/checkouts",
        ".gradle/caches",
        ".m2/repository",
        "AppData/Local/npm-cache",
        "AppData/Local/pnpm-store",
        "AppData/Local/Cargo",
        "AppData/Local/Temp",
    ] {
        roots.push(home.join(relative));
    }
}

fn push_if_some(roots: &mut Vec<PathBuf>, path: Option<PathBuf>) {
    if let Some(path) = path {
        roots.push(path);
    }
}

fn is_forbidden_storage_path(path: &Path, excluded_paths: &[PathBuf]) -> bool {
    let lower = normalize_for_compare(path);
    excluded_paths
        .iter()
        .any(|excluded| is_same_or_child(&lower, &normalize_for_compare(excluded)))
        || is_system_path_text(&lower)
        || is_zen_canvas_safe_trash_path_text(&lower)
        || lower.contains("/programdata")
        || lower.contains("/startlan/zen canvas")
        || lower.ends_with("/zen-canvas.sqlite3")
        || lower.ends_with("/zen-canvas.sqlite")
        || lower.ends_with("/zen-canvas.db")
}

fn is_zen_canvas_safe_trash_path_text(lower: &str) -> bool {
    lower.ends_with("/.zen-canvas-trash")
        || lower.contains("/.zen-canvas-trash/")
        || lower.ends_with("/safe-trash")
        || lower.contains("/safe-trash/items/")
}

fn is_system_path_text(lower: &str) -> bool {
    if cfg!(target_os = "macos")
        && (lower == "/tmp"
            || lower.starts_with("/tmp/")
            || lower == "/var/folders"
            || lower.starts_with("/var/folders/")
            || lower == "/private/tmp"
            || lower.starts_with("/private/tmp/")
            || lower == "/private/var/folders"
            || lower.starts_with("/private/var/folders/"))
    {
        return false;
    }
    lower.starts_with("c:/windows")
        || lower.contains("/windows/system32")
        || lower.contains("/windows/winsxs")
        || lower.contains("/system volume information")
        || lower.contains("/$recycle.bin")
        || matches!(
            lower,
            "/" | "/System"
                | "/Library"
                | "/Applications"
                | "/system"
                | "/usr"
                | "/etc"
                | "/var"
                | "/bin"
                | "/sbin"
                | "/library"
                | "/applications"
                | "/private"
        )
        || lower.starts_with("/System/")
        || lower.starts_with("/Library/")
        || lower.starts_with("/Applications/")
        || lower.starts_with("/system/")
        || lower.starts_with("/usr/")
        || lower.starts_with("/etc/")
        || lower.starts_with("/var/")
        || lower.starts_with("/bin/")
        || lower.starts_with("/sbin/")
        || lower.starts_with("/library/")
        || lower.starts_with("/applications/")
        || lower.starts_with("/private/")
}

fn is_program_files_path_text(lower: &str) -> bool {
    lower.starts_with("c:/program files/")
        || lower.starts_with("c:/program files (x86)/")
        || lower.contains("/program files/")
        || lower.contains("/program files (x86)/")
}

fn is_appdata_path(lower: &str) -> bool {
    lower.contains("/appdata/local/") || lower.contains("/appdata/roaming/")
}

fn is_appdata_core_path_text(lower: &str) -> bool {
    lower.ends_with("/appdata")
        || lower.ends_with("/appdata/local")
        || lower.ends_with("/appdata/roaming")
        || lower.ends_with("/appdata/locallow")
}

fn is_temp_path(lower: &str) -> bool {
    lower.contains("/appdata/local/temp/") || lower.ends_with("/appdata/local/temp")
}

fn is_drive_root(path: &Path) -> bool {
    let normalized = normalize_path(path);
    let trimmed = normalized.trim_end_matches('/');
    let bytes = trimmed.as_bytes();
    bytes.len() == 2 && bytes[1] == b':' && bytes[0].is_ascii_alphabetic()
}

fn is_generated_dir_name(path: &Path) -> bool {
    let lower_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    matches!(
        lower_name.as_str(),
        "node_modules" | "target" | "dist" | "build" | ".next" | ".nuxt" | ".turbo"
    )
}

fn is_package_cache_path(lower: &str, lower_name: &str) -> bool {
    matches!(
        lower_name,
        ".npm" | ".pnpm-store" | "npm-cache" | "pnpm-store"
    ) || lower.ends_with("/.cargo/registry/cache")
        || lower.contains("/.cargo/registry/cache/")
        || lower.ends_with("/.cargo/git/checkouts")
        || lower.contains("/.cargo/git/checkouts/")
        || lower.ends_with("/.gradle/caches")
        || lower.contains("/.gradle/caches/")
        || lower.ends_with("/.m2/repository")
        || lower.contains("/.m2/repository/")
}

fn is_installer_residue(lower: &str, extension: &str) -> bool {
    is_downloads_path(lower) && matches!(extension, "msi" | "dmg" | "pkg")
}

fn is_downloads_path(lower: &str) -> bool {
    lower.contains("/downloads/")
}

fn is_chat_file_path(lower: &str) -> bool {
    (lower.contains("/wechat files/")
        || lower.contains("/tencent/files/")
        || lower.contains("/qq/"))
        && !is_chat_database_text(lower)
}

fn is_chat_database_path(lower: &str, extension: &str) -> bool {
    is_chat_database_text(lower)
        || ((lower.contains("wechat") || lower.contains("/qq/"))
            && is_database_extension(extension))
}

fn is_chat_database_text(lower: &str) -> bool {
    (lower.contains("wechat") || lower.contains("/qq/") || lower.contains("tencent"))
        && (lower.ends_with(".db") || lower.ends_with(".sqlite") || lower.ends_with(".sqlite3"))
}

fn is_browser_profile_path(lower: &str) -> bool {
    (lower.contains("/google/chrome/user data")
        || lower.contains("/microsoft/edge/user data")
        || lower.contains("/mozilla/firefox/profiles"))
        && !lower.contains("/cache/")
}

fn is_database_extension(extension: &str) -> bool {
    matches!(extension, "db" | "sqlite" | "sqlite3" | "mdb" | "accdb")
}

fn is_virtual_machine_image(extension: &str) -> bool {
    matches!(
        extension,
        "vmdk" | "vhd" | "vhdx" | "qcow2" | "ova" | "avhdx"
    )
}

fn is_review_extension(extension: &str) -> bool {
    matches!(
        extension,
        "zip"
            | "rar"
            | "7z"
            | "tar"
            | "gz"
            | "mp4"
            | "mov"
            | "mkv"
            | "avi"
            | "pdf"
            | "doc"
            | "docx"
            | "ppt"
            | "pptx"
            | "xls"
            | "xlsx"
    )
}

fn review_category(lower: &str, extension: &str) -> String {
    if is_downloads_path(lower) {
        "Downloads".to_string()
    } else if is_chat_file_path(lower) {
        "Chat files".to_string()
    } else if matches!(extension, "zip" | "rar" | "7z" | "tar" | "gz") {
        "Archive".to_string()
    } else if matches!(extension, "mp4" | "mov" | "mkv" | "avi") {
        "Video".to_string()
    } else if matches!(
        extension,
        "pdf" | "doc" | "docx" | "ppt" | "pptx" | "xls" | "xlsx"
    ) {
        "Documents".to_string()
    } else {
        "Large unknown directory".to_string()
    }
}

fn dedupe_candidates(candidates: &mut Vec<StorageCandidate>) {
    candidates.sort_by(|left, right| {
        let left_depth = Path::new(&left.path).components().count();
        let right_depth = Path::new(&right.path).components().count();
        cleanup_candidate_specificity(right)
            .cmp(&cleanup_candidate_specificity(left))
            .then_with(|| left_depth.cmp(&right_depth))
            .then_with(|| left.path.cmp(&right.path))
    });
    let mut seen = HashSet::new();
    let mut retained_safe_parents = Vec::<String>::new();
    candidates.retain(|candidate| {
        let normalized = normalize_compare_text(&candidate.path);
        if !seen.insert(normalized.clone()) {
            return false;
        }
        if candidate.trash_allowed {
            if retained_safe_parents.iter().any(|retained| {
                normalized != *retained
                    && (is_same_or_child(&normalized, retained)
                        || is_same_or_child(retained, &normalized))
            }) {
                return false;
            }
            retained_safe_parents.push(normalized);
        }
        true
    });
}

fn cleanup_candidate_specificity(candidate: &StorageCandidate) -> u8 {
    match candidate.category.as_str() {
        "Regenerable dependency folder" | "Developer cache" => 3,
        "Regenerable development output" => 2,
        "Temporary files" => 1,
        _ => 0,
    }
}

fn dedupe_paths(paths: &mut Vec<PathBuf>) {
    let mut seen = HashSet::new();
    paths.retain(|path| seen.insert(normalize_for_compare(path)));
}

fn is_same_or_child(path: &str, parent: &str) -> bool {
    path == parent || path.starts_with(&format!("{parent}/"))
}

fn candidate_id(path: &str) -> String {
    let mut hasher = DefaultHasher::new();
    normalize_compare_text(path).hash(&mut hasher);
    format!("storage-{:016x}", hasher.finish())
}

fn new_id(prefix: &str) -> String {
    let timestamp = current_timestamp_ms();
    let mut hasher = DefaultHasher::new();
    prefix.hash(&mut hasher);
    timestamp.hash(&mut hasher);
    std::thread::current().id().hash(&mut hasher);
    format!("{prefix}-{timestamp}-{:016x}", hasher.finish())
}

fn current_timestamp_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

fn normalize_for_compare(path: &Path) -> String {
    normalize_compare_text(&normalize_path(path))
}

fn normalize_compare_text(value: &str) -> String {
    let normalized = value
        .strip_prefix("//?/")
        .or_else(|| value.strip_prefix("//?/"))
        .unwrap_or(value)
        .replace('\\', "/");
    let value = if normalized == "/" {
        normalized
    } else {
        normalized.trim_end_matches('/').to_string()
    };
    if cfg!(windows) || value.get(1..3) == Some(":/") {
        value.to_ascii_lowercase()
    } else {
        value
    }
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}
