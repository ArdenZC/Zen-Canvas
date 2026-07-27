use crate::{
    db::{Database, DbError},
    dedupe::DedupeJobManager,
    path_filter::is_ignored_dir_name,
    scanner::ScanJobManager,
    settings::{AppSettings, ScanRootSetting, SearchRootSetting},
};
use notify::{
    event::{ModifyKind, RenameMode},
    recommended_watcher, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher,
};
use serde::Serialize;
use std::{
    collections::{HashMap, HashSet},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{self, Receiver, RecvTimeoutError, TrySendError},
        Arc, Mutex,
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Runtime};
use thiserror::Error;

const FILE_EVENT_NAME: &str = "fs-event";
const WATCHER_READY_EVENT_NAME: &str = "fs-watcher-ready";
const WATCHER_ERROR_EVENT_NAME: &str = "fs-watcher-error";
pub const WATCHER_RECONCILIATION_STATUS_EVENT_NAME: &str = "watcher-reconciliation-status";
pub const WATCHER_BACKEND_ENV: &str = "ZEN_CANVAS_BACKEND_WATCHER_RECONCILIATION";
const WATCHER_CHANNEL_CAPACITY: usize = 2048;
const WATCHER_BATCH_LIMIT: usize = 500;
const WATCHER_MAX_ATTEMPTS: usize = 8;
const WATCHER_RULE_MAX_ATTEMPTS: usize = 3;
const WATCHER_RETRY_DELAYS: [Duration; 4] = [
    Duration::from_millis(250),
    Duration::from_millis(500),
    Duration::from_secs(1),
    Duration::from_secs(2),
];
const WATCHER_RULE_RETRY_DELAYS: [Duration; 2] =
    [Duration::from_millis(250), Duration::from_millis(500)];
const WATCHER_COALESCE_WINDOW: Duration = Duration::from_millis(150);

#[derive(Debug, Error)]
enum WatcherError {
    #[error("watch path does not exist: {0}")]
    MissingPath(String),
    #[error("watch path is not a directory: {0}")]
    NotDirectory(String),
    #[error("notify error: {0}")]
    Notify(#[from] notify::Error),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("tauri emit error: {0}")]
    Tauri(#[from] tauri::Error),
    #[error("failed to start watcher thread: {0}")]
    Thread(std::io::Error),
    #[error("watcher state lock poisoned")]
    StateLock,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileWatchEvent {
    pub event_type: String,
    pub paths: Vec<String>,
    pub stale_paths: Vec<String>,
    pub upsert_paths: Vec<String>,
    pub reconciliation_paths: Vec<String>,
    pub timestamp_ms: u128,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WatcherReadyEvent {
    pub roots: Vec<String>,
    pub recursive: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WatcherErrorEvent {
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WatcherReconciliationStatusEvent {
    pub scan_root_id: String,
    pub path: String,
    pub root_revision: i64,
    pub watcher_revision: i64,
    pub watcher_applied_revision: i64,
    pub pending: bool,
    pub needs_reconciliation: bool,
    pub watcher_rule_recovery_required: bool,
    pub health_status: String,
    pub active_run_id: Option<String>,
    pub last_event_at: Option<i64>,
    pub last_applied_at: Option<i64>,
    pub last_error_code: Option<String>,
    pub last_error_message: Option<String>,
    pub pending_batch: i64,
    pub timestamp: i64,
}

enum WatcherInput {
    Notify(notify::Result<Event>),
}

#[derive(Default)]
pub struct FileWatcherManager {
    session: Mutex<Option<WatcherSession>>,
    reload_lock: Mutex<()>,
}

struct WatcherSession {
    roots: Vec<PathBuf>,
    shutdown: Option<Box<dyn FnOnce() + Send + 'static>>,
}

impl WatcherSession {
    fn new(roots: Vec<PathBuf>, shutdown: impl FnOnce() + Send + 'static) -> Self {
        Self {
            roots,
            shutdown: Some(Box::new(shutdown)),
        }
    }

    fn detach(mut self) {
        self.shutdown.take();
    }
}

impl Drop for WatcherSession {
    fn drop(&mut self) {
        if let Some(shutdown) = self.shutdown.take() {
            shutdown();
        }
    }
}

impl FileWatcherManager {
    fn restart<R: Runtime>(
        &self,
        app: AppHandle<R>,
        paths: Vec<PathBuf>,
    ) -> Result<bool, WatcherError> {
        let roots = normalize_watch_roots(paths)?;
        if roots.is_empty() {
            let changed = self.restart_with_roots(Vec::new(), |_| unreachable!(), |_, _| {})?;
            if changed {
                emit_watcher_ready(&app, Vec::new())?;
            }
            return Ok(changed);
        }

        self.restart_with_roots(
            roots,
            |roots| start_legacy_watcher_session(app, roots),
            |_, _| {},
        )
    }

    fn restart_backend<R: Runtime>(
        &self,
        app: AppHandle<R>,
        paths: Vec<PathBuf>,
        db: Database,
        jobs: ScanJobManager,
        dedupe_jobs: DedupeJobManager,
    ) -> Result<bool, WatcherError> {
        let roots = normalize_watch_roots(paths)?;
        if roots.is_empty() {
            let gap_app = app.clone();
            let gap_db = db.clone();
            return self.restart_with_roots(
                Vec::new(),
                |_| unreachable!(),
                move |old_roots, new_roots| {
                    mark_watcher_reload_gap(&gap_app, &gap_db, old_roots, new_roots)
                },
            );
        }
        let gap_app = app.clone();
        let gap_db = db.clone();
        self.restart_with_roots(
            roots,
            |roots| start_backend_watcher_session(app, roots, db, jobs, dedupe_jobs),
            move |old_roots, new_roots| {
                mark_watcher_reload_gap(&gap_app, &gap_db, old_roots, new_roots)
            },
        )
    }

    fn restart_with_roots(
        &self,
        roots: Vec<PathBuf>,
        start: impl FnOnce(Vec<PathBuf>) -> Result<WatcherSession, WatcherError>,
        on_handoff_gap: impl Fn(&[PathBuf], &[PathBuf]),
    ) -> Result<bool, WatcherError> {
        let _reload_guard = self
            .reload_lock
            .lock()
            .map_err(|_| WatcherError::StateLock)?;
        let mut session = self.session.lock().map_err(|_| WatcherError::StateLock)?;
        if session
            .as_ref()
            .is_some_and(|current| current.roots == roots)
        {
            return Ok(false);
        }
        let previous = session.take();
        let previous_roots = previous
            .as_ref()
            .map(|current| current.roots.clone())
            .unwrap_or_default();
        drop(session);
        drop(previous);

        let had_previous = !previous_roots.is_empty();
        if had_previous {
            on_handoff_gap(&previous_roots, &roots);
        }
        if roots.is_empty() {
            return Ok(true);
        }

        let next = match start(roots.clone()) {
            Ok(next) => next,
            Err(error) => {
                if !had_previous {
                    on_handoff_gap(&previous_roots, &roots);
                }
                return Err(error);
            }
        };
        let mut session = self.session.lock().map_err(|_| WatcherError::StateLock)?;
        *session = Some(next);
        Ok(true)
    }

    pub fn active_roots(&self) -> Result<Vec<PathBuf>, String> {
        self.session
            .lock()
            .map(|session| {
                session
                    .as_ref()
                    .map(|session| session.roots.clone())
                    .unwrap_or_default()
            })
            .map_err(|_| WatcherError::StateLock.to_string())
    }
}

pub fn setup_file_watcher<R: Runtime>(
    app: AppHandle<R>,
    paths: Vec<PathBuf>,
) -> Result<(), String> {
    setup_file_watcher_inner(app, paths).map_err(|error| error.to_string())
}

pub fn reload_file_watcher_for_settings<R: Runtime>(
    app: AppHandle<R>,
    manager: &FileWatcherManager,
    db: &Database,
    jobs: &ScanJobManager,
    dedupe_jobs: &DedupeJobManager,
    settings: &AppSettings,
) -> Result<bool, String> {
    db.sync_file_library_watcher_roots(&settings.default_scan_folders)
        .map_err(|error| error.to_string())?;
    if backend_watcher_reconciliation_enabled() {
        let paths = existing_watch_paths_from_default_scan_folders(&settings.default_scan_folders);
        let root_labels = paths
            .iter()
            .map(|path| normalize_path(path))
            .collect::<Vec<_>>();
        let changed = manager
            .restart_backend(
                app.clone(),
                paths,
                db.clone(),
                jobs.clone(),
                dedupe_jobs.clone(),
            )
            .map_err(|error| error.to_string())?;
        crate::scanner::schedule_watcher_reconciliations(
            app.clone(),
            db.clone(),
            jobs.clone(),
            dedupe_jobs.clone(),
        )?;
        if changed {
            emit_watcher_ready(&app, root_labels).map_err(|error| error.to_string())?;
        }
        Ok(changed)
    } else {
        eprintln!(
            "{WATCHER_BACKEND_ENV}=false: using the legacy renderer watcher adapter; Rust will not mutate managed files or watcher revisions"
        );
        let paths = existing_legacy_watch_paths_from_settings(settings);
        manager
            .restart(app, paths)
            .map_err(|error| error.to_string())
    }
}

pub fn backend_watcher_reconciliation_enabled() -> bool {
    backend_watcher_reconciliation_enabled_value(std::env::var(WATCHER_BACKEND_ENV).ok().as_deref())
}

fn backend_watcher_reconciliation_enabled_value(value: Option<&str>) -> bool {
    match value {
        Some(value) => !matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "0" | "false" | "off" | "no" | "disabled"
        ),
        None => true,
    }
}

pub fn reload_file_watcher<R: Runtime>(
    app: AppHandle<R>,
    manager: &FileWatcherManager,
    paths: Vec<PathBuf>,
) -> Result<bool, String> {
    manager
        .restart(app, paths)
        .map_err(|error| error.to_string())
}

pub fn watch_paths_from_default_scan_folders(folders: &[ScanRootSetting]) -> Vec<PathBuf> {
    folders
        .iter()
        .filter(|root| root.enabled)
        .map(|root| root.path.trim())
        .filter(|path| !path.is_empty() && looks_absolute_path(path))
        .map(PathBuf::from)
        .collect()
}

pub fn watch_paths_from_search_roots(roots: &[SearchRootSetting]) -> Vec<PathBuf> {
    roots
        .iter()
        .filter(|root| root.enabled)
        .map(|root| root.path.trim())
        .filter(|path| !path.is_empty() && looks_absolute_path(path))
        .map(PathBuf::from)
        .collect()
}

pub fn watch_paths_from_settings(settings: &AppSettings) -> Vec<PathBuf> {
    let mut paths = watch_paths_from_default_scan_folders(&settings.default_scan_folders);
    paths.extend(watch_paths_from_search_roots(&settings.custom_search_roots));
    paths
}

pub fn existing_watch_paths_from_settings(settings: &AppSettings) -> Vec<PathBuf> {
    watch_paths_from_settings(settings)
        .into_iter()
        .filter(|path| path.exists())
        .collect()
}

fn existing_legacy_watch_paths_from_settings(settings: &AppSettings) -> Vec<PathBuf> {
    legacy_watch_paths_from_settings(settings)
        .into_iter()
        .filter(|path| path.exists())
        .collect()
}

fn legacy_watch_paths_from_settings(settings: &AppSettings) -> Vec<PathBuf> {
    watch_paths_from_default_scan_folders(&settings.default_scan_folders)
}

pub fn existing_watch_paths_from_default_scan_folders(folders: &[ScanRootSetting]) -> Vec<PathBuf> {
    watch_paths_from_default_scan_folders(folders)
        .into_iter()
        .filter(|path| path.exists())
        .collect()
}

pub fn emit_file_watcher_error<R: Runtime>(app: &AppHandle<R>, message: String) {
    let _ = app.emit(WATCHER_ERROR_EVENT_NAME, WatcherErrorEvent { message });
}

fn setup_file_watcher_inner<R: Runtime>(
    app: AppHandle<R>,
    paths: Vec<PathBuf>,
) -> Result<(), WatcherError> {
    let roots = normalize_watch_roots(paths)?;
    if roots.is_empty() {
        emit_watcher_ready(&app, Vec::new())?;
        return Ok(());
    }
    let session = start_legacy_watcher_session(app, roots)?;
    session.detach();
    Ok(())
}

fn start_legacy_watcher_session<R: Runtime>(
    app: AppHandle<R>,
    roots: Vec<PathBuf>,
) -> Result<WatcherSession, WatcherError> {
    let root_labels = roots
        .iter()
        .map(|path| normalize_path(path))
        .collect::<Vec<_>>();
    let (tx, rx) = mpsc::sync_channel::<notify::Result<Event>>(WATCHER_CHANNEL_CAPACITY);
    let (stop_tx, stop_rx) = mpsc::channel::<()>();
    let overflow_reported = Arc::new(AtomicBool::new(false));
    let overflow_for_callback = Arc::clone(&overflow_reported);
    let overflow_app = app.clone();

    let mut watcher = recommended_watcher(move |event| {
        if let Err(TrySendError::Full(_)) = tx.try_send(event) {
            if !overflow_for_callback.swap(true, Ordering::AcqRel) {
                emit_file_watcher_error(
                    &overflow_app,
                    "File watcher overflowed its bounded queue. A rescan is required to reconcile changes."
                        .to_string(),
                );
            }
        }
    })?;

    for root in &roots {
        watcher.watch(root, RecursiveMode::Recursive)?;
    }

    emit_watcher_ready(&app, root_labels)?;

    let handle = thread::Builder::new()
        .name("zen-canvas-file-watcher".to_string())
        .spawn(move || run_legacy_watcher_loop(app, watcher, rx, stop_rx))
        .map_err(WatcherError::Thread)?;

    Ok(WatcherSession::new(roots, move || {
        stop_watcher(stop_tx, handle)
    }))
}

fn start_backend_watcher_session<R: Runtime>(
    app: AppHandle<R>,
    roots: Vec<PathBuf>,
    db: Database,
    jobs: ScanJobManager,
    dedupe_jobs: DedupeJobManager,
) -> Result<WatcherSession, WatcherError> {
    let (tx, rx) = mpsc::sync_channel::<WatcherInput>(WATCHER_CHANNEL_CAPACITY);
    let (stop_tx, stop_rx) = mpsc::channel::<()>();
    let overflow_signal = Arc::new(AtomicBool::new(false));
    let overflow_burst_active = Arc::new(AtomicBool::new(false));
    let overflow_signal_for_callback = Arc::clone(&overflow_signal);
    let overflow_burst_for_callback = Arc::clone(&overflow_burst_active);

    let mut watcher = recommended_watcher(move |event| {
        if let Err(TrySendError::Full(_)) = tx.try_send(WatcherInput::Notify(event)) {
            signal_overflow(&overflow_burst_for_callback, &overflow_signal_for_callback);
        }
    })?;

    for root in &roots {
        watcher.watch(root, RecursiveMode::Recursive)?;
    }

    let handle = thread::Builder::new()
        .name("zen-canvas-file-watcher-backend".to_string())
        .spawn(move || {
            run_backend_watcher_loop(
                app,
                watcher,
                rx,
                stop_rx,
                db,
                jobs,
                dedupe_jobs,
                overflow_signal,
                overflow_burst_active,
            )
        })
        .map_err(WatcherError::Thread)?;

    Ok(WatcherSession::new(roots, move || {
        stop_watcher(stop_tx, handle)
    }))
}

fn stop_watcher(stop_tx: mpsc::Sender<()>, handle: JoinHandle<()>) {
    let _ = stop_tx.send(());
    let _ = handle.join();
}

fn emit_watcher_ready<R: Runtime>(
    app: &AppHandle<R>,
    roots: Vec<String>,
) -> Result<(), WatcherError> {
    app.emit(
        WATCHER_READY_EVENT_NAME,
        WatcherReadyEvent {
            roots,
            recursive: true,
        },
    )?;
    Ok(())
}

fn run_legacy_watcher_loop(
    app: AppHandle<impl Runtime>,
    _watcher: RecommendedWatcher,
    rx: Receiver<notify::Result<Event>>,
    stop_rx: Receiver<()>,
) {
    loop {
        if stop_rx.try_recv().is_ok() {
            break;
        }

        match rx.recv_timeout(Duration::from_millis(250)) {
            Ok(event) => match event {
                Ok(event) => {
                    let mut payloads = event_to_payload(event).into_iter().collect::<Vec<_>>();
                    let deadline = Instant::now() + WATCHER_COALESCE_WINDOW;
                    while let Some(remaining) = deadline.checked_duration_since(Instant::now()) {
                        match rx.recv_timeout(remaining) {
                            Ok(Ok(event)) => payloads.extend(event_to_payload(event)),
                            Ok(Err(error)) => emit_file_watcher_error(&app, error.to_string()),
                            Err(RecvTimeoutError::Timeout) => break,
                            Err(RecvTimeoutError::Disconnected) => break,
                        }
                    }
                    if let Some(payload) = coalesce_payloads(payloads) {
                        let _ = app.emit(FILE_EVENT_NAME, payload);
                    }
                }
                Err(error) => emit_file_watcher_error(&app, error.to_string()),
            },
            Err(RecvTimeoutError::Timeout) => {}
            Err(RecvTimeoutError::Disconnected) => break,
        }
    }
}

fn signal_overflow(burst_active: &AtomicBool, signal: &AtomicBool) {
    if !burst_active.swap(true, Ordering::AcqRel) {
        signal.store(true, Ordering::Release);
    }
}

pub(crate) fn bounded_retry<T, E, Operation, Delay>(
    max_attempts: usize,
    mut operation: Operation,
    mut delay: Delay,
) -> Result<T, E>
where
    Operation: FnMut() -> Result<T, E>,
    Delay: FnMut(usize),
{
    let attempts = max_attempts.max(1);
    let mut last_error = None;
    for attempt in 0..attempts {
        match operation() {
            Ok(value) => return Ok(value),
            Err(error) => {
                last_error = Some(error);
                if attempt + 1 < attempts {
                    delay(attempt);
                }
            }
        }
    }
    Err(last_error.expect("bounded retry always records an error"))
}

#[allow(clippy::too_many_arguments)]
fn run_backend_watcher_loop<R: Runtime>(
    app: AppHandle<R>,
    _watcher: RecommendedWatcher,
    rx: Receiver<WatcherInput>,
    stop_rx: Receiver<()>,
    db: Database,
    jobs: ScanJobManager,
    dedupe_jobs: DedupeJobManager,
    overflow_signal: Arc<AtomicBool>,
    overflow_burst_active: Arc<AtomicBool>,
) {
    let mut last_schedule = Instant::now() - Duration::from_secs(2);
    loop {
        if stop_rx.try_recv().is_ok() {
            break;
        }

        if overflow_signal.swap(false, Ordering::AcqRel) {
            mark_all_roots_for_reconciliation(
                &app,
                &db,
                "watcher_overflow",
                "The bounded watcher queue overflowed; a managed scan is required.",
            );
            emit_file_watcher_error(
                &app,
                "File watcher overflowed its bounded queue. Durable reconciliation was scheduled."
                    .to_string(),
            );
        }

        match rx.recv_timeout(Duration::from_millis(250)) {
            Ok(WatcherInput::Notify(Ok(event))) => {
                let mut payloads = event_to_payload(event).into_iter().collect::<Vec<_>>();
                let deadline = Instant::now() + WATCHER_COALESCE_WINDOW;
                while let Some(remaining) = deadline.checked_duration_since(Instant::now()) {
                    match rx.recv_timeout(remaining) {
                        Ok(WatcherInput::Notify(Ok(event))) => {
                            payloads.extend(event_to_payload(event));
                        }
                        Ok(WatcherInput::Notify(Err(error))) => {
                            mark_all_roots_for_reconciliation(
                                &app,
                                &db,
                                "watcher_notify_error",
                                &error.to_string(),
                            );
                        }
                        Err(RecvTimeoutError::Timeout) => break,
                        Err(RecvTimeoutError::Disconnected) => break,
                    }
                }
                if let Some(payload) = coalesce_payloads(payloads) {
                    process_backend_payload(&app, &db, &jobs, &dedupe_jobs, payload);
                }
            }
            Ok(WatcherInput::Notify(Err(error))) => {
                mark_all_roots_for_reconciliation(
                    &app,
                    &db,
                    "watcher_notify_error",
                    &error.to_string(),
                );
            }
            Err(RecvTimeoutError::Timeout) => {
                overflow_burst_active.store(false, Ordering::Release);
            }
            Err(RecvTimeoutError::Disconnected) => break,
        }

        if last_schedule.elapsed() >= Duration::from_secs(1) {
            if let Err(error) = crate::scanner::schedule_watcher_reconciliations(
                app.clone(),
                db.clone(),
                jobs.clone(),
                dedupe_jobs.clone(),
            ) {
                emit_file_watcher_error(&app, error);
            }
            last_schedule = Instant::now();
        }
    }
}

fn process_backend_payload<R: Runtime>(
    app: &AppHandle<R>,
    db: &Database,
    jobs: &ScanJobManager,
    dedupe_jobs: &DedupeJobManager,
    payload: FileWatchEvent,
) {
    let Ok(configs) = db.list_watcher_root_configs() else {
        emit_file_watcher_error(app, "Unable to load managed watcher roots.".to_string());
        return;
    };
    let directory_paths = payload
        .reconciliation_paths
        .iter()
        .map(|path| normalize_path(&PathBuf::from(path)))
        .collect::<HashSet<_>>();
    let paths = payload
        .paths
        .iter()
        .map(|path| normalize_path(&PathBuf::from(path)))
        .filter(|path| !is_ignored_path(Path::new(path)))
        .collect::<HashSet<_>>();
    let mut grouped = HashMap::<String, Vec<String>>::new();
    let mut ambiguous = HashMap::<String, Vec<String>>::new();

    for path in paths {
        let matches = configs
            .iter()
            .filter(|root| path_within_root(&root.path, &path))
            .collect::<Vec<_>>();
        match matches.as_slice() {
            [root] => grouped.entry(root.id.clone()).or_default().push(path),
            [] => {}
            _ => {
                for root in matches {
                    ambiguous
                        .entry(root.id.clone())
                        .or_default()
                        .push(path.clone());
                }
            }
        }
    }

    for (root_id, paths) in ambiguous {
        let Some(batch) = begin_watcher_batch(app, db, &root_id) else {
            continue;
        };
        let message = format!(
            "Watcher path batch is ambiguous across managed roots: {}",
            paths.join(", ")
        );
        let _ = db.mark_watcher_reconciliation(&root_id, "ambiguous_root", &message);
        emit_root_status(app, db, &root_id, Some(batch.watcher_revision));
    }

    for (root_id, mut paths) in grouped {
        let oversized = paths.len() > WATCHER_BATCH_LIMIT;
        if oversized {
            paths.truncate(WATCHER_BATCH_LIMIT);
        }
        let Some(batch) = begin_watcher_batch(app, db, &root_id) else {
            continue;
        };
        let result =
            apply_watcher_exact_mutations_with_retry(db, &root_id, &paths, &directory_paths);
        match result {
            Ok(result) => {
                let mut reconciliation_required = result.reconciliation_required || oversized;
                let mut rule_warning = None;
                if let Some(warning) = result.warning.as_deref() {
                    let _ = db.record_watcher_warning(&root_id, "watcher_partial_update", warning);
                    emit_file_watcher_error(app, warning.to_string());
                }
                if !result.upserted_paths.is_empty() {
                    match execute_rules_for_paths_with_retry(db, &result.upserted_paths) {
                        Ok(_) => {}
                        Err(error) => {
                            let message = error.to_string();
                            rule_warning = Some(message.clone());
                            reconciliation_required = true;
                            emit_file_watcher_error(app, message);
                        }
                    }
                }
                if reconciliation_required {
                    let message = if oversized {
                        "Watcher event batch exceeded the bounded mutation batch; a full reconciliation is required."
                    } else if let Some(rule_warning) = rule_warning.as_deref() {
                        rule_warning
                    } else {
                        result.warning.as_deref().unwrap_or(
                            "Watcher directory or ambiguous event requires reconciliation.",
                        )
                    };
                    let _ = db.mark_watcher_reconciliation(
                        &root_id,
                        "watcher_reconciliation_required",
                        message,
                    );
                } else if !db
                    .complete_watcher_revision(&root_id, batch.watcher_revision)
                    .unwrap_or(false)
                {
                    let _ = db.mark_watcher_reconciliation(
                        &root_id,
                        "watcher_revision_cas_failed",
                        "Watcher applied revision CAS failed; a full reconciliation is required.",
                    );
                }
                if let Some(message) = rule_warning {
                    let _ = db.record_watcher_warning(&root_id, "watcher_rule_failure", &message);
                }
            }
            Err(error) => {
                let message = error.to_string();
                let _ =
                    db.mark_watcher_reconciliation(&root_id, "watcher_mutation_failed", &message);
                emit_file_watcher_error(app, message);
            }
        }
        emit_root_status(app, db, &root_id, Some(batch.watcher_revision));
    }

    if let Err(error) = crate::scanner::schedule_watcher_reconciliations(
        app.clone(),
        db.clone(),
        jobs.clone(),
        dedupe_jobs.clone(),
    ) {
        emit_file_watcher_error(app, error);
    }
}

fn apply_watcher_exact_mutations_with_retry(
    db: &Database,
    root_id: &str,
    paths: &[String],
    directory_paths: &HashSet<String>,
) -> Result<crate::db::scan::WatcherMutationResult, DbError> {
    bounded_retry(
        WATCHER_MAX_ATTEMPTS,
        || db.apply_watcher_exact_mutations(root_id, paths, directory_paths),
        |attempt| {
            let delay = WATCHER_RETRY_DELAYS[attempt.min(WATCHER_RETRY_DELAYS.len() - 1)];
            thread::sleep(delay);
        },
    )
}

fn execute_rules_for_paths_with_retry(
    db: &Database,
    paths: &[String],
) -> Result<crate::db::RuleExecutionSummary, DbError> {
    bounded_retry(
        WATCHER_RULE_MAX_ATTEMPTS,
        || {
            db.get_user_rules()
                .and_then(|rules| db.execute_rules_for_paths(paths, rules))
        },
        |attempt| {
            let delay = WATCHER_RULE_RETRY_DELAYS[attempt.min(WATCHER_RULE_RETRY_DELAYS.len() - 1)];
            thread::sleep(delay);
        },
    )
}

fn begin_watcher_batch<R: Runtime>(
    app: &AppHandle<R>,
    db: &Database,
    root_id: &str,
) -> Option<crate::db::scan::WatcherRevisionStart> {
    match db.begin_watcher_revision(root_id) {
        Ok(Some(batch)) => Some(batch),
        Ok(None) => None,
        Err(error) => {
            emit_file_watcher_error(app, error.to_string());
            None
        }
    }
}

fn mark_all_roots_for_reconciliation<R: Runtime>(
    app: &AppHandle<R>,
    db: &Database,
    error_code: &str,
    message: &str,
) {
    let Ok(configs) = db.list_watcher_root_configs() else {
        emit_file_watcher_error(
            app,
            "Unable to load managed watcher roots for recovery.".to_string(),
        );
        return;
    };
    for root in configs {
        if let Some(batch) = begin_watcher_batch(app, db, &root.id) {
            let _ = db.mark_watcher_reconciliation(&root.id, error_code, message);
            emit_root_status(app, db, &root.id, Some(batch.watcher_revision));
        }
    }
}

fn mark_watcher_reload_gap<R: Runtime>(
    app: &AppHandle<R>,
    db: &Database,
    _old_roots: &[PathBuf],
    _new_roots: &[PathBuf],
) {
    // A notify watcher cannot prove that no filesystem event arrived between
    // stopping the old session and installing the new one. Mark every enabled
    // managed root before the new session starts so the next scheduler pass
    // performs a durable reconciliation instead of relying on the event stream.
    mark_all_roots_for_reconciliation(
        app,
        db,
        "watcher_reload_gap",
        "Watcher settings reload created a listening gap; a managed reconciliation is required.",
    );
}

pub(crate) fn emit_watcher_reconciliation_status<R: Runtime>(
    app: &AppHandle<R>,
    db: &Database,
    root_id: &str,
    _batch_revision: Option<i64>,
) {
    let Ok(root) = db.get_scan_root_health(Some(root_id), None) else {
        return;
    };
    let payload = WatcherReconciliationStatusEvent {
        scan_root_id: root.id,
        path: root.normalized_path,
        root_revision: root.revision,
        watcher_revision: root.watcher_revision,
        watcher_applied_revision: root.watcher_applied_revision,
        pending: root.watcher_revision > root.watcher_applied_revision
            || root.needs_reconciliation
            || root.watcher_rule_recovery_required,
        needs_reconciliation: root.needs_reconciliation || root.watcher_rule_recovery_required,
        watcher_rule_recovery_required: root.watcher_rule_recovery_required,
        health_status: if root.watcher_rule_recovery_required {
            "reconciliation_required".to_string()
        } else {
            root.health_status
        },
        active_run_id: root.active_run_id,
        last_event_at: root.watcher_last_event_at,
        last_applied_at: root.watcher_last_applied_at,
        last_error_code: root.watcher_last_error_code.or(root.last_error_code),
        last_error_message: root.watcher_last_error_message.or(root.last_error_message),
        pending_batch: (root.watcher_revision - root.watcher_applied_revision).max(0),
        timestamp: current_timestamp_ms() as i64,
    };
    if let Err(error) = app.emit(WATCHER_RECONCILIATION_STATUS_EVENT_NAME, payload) {
        eprintln!("Failed to emit watcher reconciliation status: {error}");
    }
}

fn emit_root_status<R: Runtime>(
    app: &AppHandle<R>,
    db: &Database,
    root_id: &str,
    batch_revision: Option<i64>,
) {
    emit_watcher_reconciliation_status(app, db, root_id, batch_revision);
}

fn path_within_root(root: &str, path: &str) -> bool {
    let root = normalize_path(Path::new(root))
        .trim_end_matches('/')
        .to_string();
    let path = normalize_path(Path::new(path));
    let (root, path) = if cfg!(windows) {
        (root.to_ascii_lowercase(), path.to_ascii_lowercase())
    } else {
        (root, path)
    };
    path == root
        || path
            .strip_prefix(&root)
            .is_some_and(|suffix| suffix.starts_with('/'))
}

pub fn recover_watcher_reconciliation_state<R: Runtime>(
    app: AppHandle<R>,
    db: Database,
) -> Result<usize, String> {
    let roots = db.list_scan_roots().map_err(|error| error.to_string())?;
    let mut recovered = 0;
    for root in roots
        .into_iter()
        .filter(|root| root.enabled && root.source_kind == "file_library")
    {
        if root.watcher_revision > root.watcher_applied_revision {
            db.mark_watcher_reconciliation(
                &root.id,
                "startup_revision_gap",
                "A previous watcher batch was not durably applied before shutdown.",
            )
            .map_err(|error| error.to_string())?;
            emit_root_status(&app, &db, &root.id, None);
            recovered += 1;
        }
    }
    Ok(recovered)
}

fn coalesce_payloads(payloads: Vec<FileWatchEvent>) -> Option<FileWatchEvent> {
    if payloads.is_empty() {
        return None;
    }
    let mut paths = HashSet::new();
    let mut latest_route = HashMap::<String, bool>::new();
    let mut reconciliation_paths = HashSet::new();
    for payload in payloads {
        paths.extend(payload.paths);
        for path in payload.stale_paths {
            latest_route.insert(path, false);
        }
        for path in payload.upsert_paths {
            latest_route.insert(path, true);
        }
        reconciliation_paths.extend(payload.reconciliation_paths);
    }
    let mut paths = paths.into_iter().collect::<Vec<_>>();
    let mut stale_paths = latest_route
        .iter()
        .filter_map(|(path, upsert)| (!upsert).then_some(path.clone()))
        .collect::<Vec<_>>();
    let mut upsert_paths = latest_route
        .into_iter()
        .filter_map(|(path, upsert)| upsert.then_some(path))
        .collect::<Vec<_>>();
    let mut reconciliation_paths = reconciliation_paths.into_iter().collect::<Vec<_>>();
    paths.sort();
    stale_paths.sort();
    upsert_paths.sort();
    reconciliation_paths.sort();
    Some(FileWatchEvent {
        event_type: "batch".to_string(),
        paths,
        stale_paths,
        upsert_paths,
        reconciliation_paths,
        timestamp_ms: current_timestamp_ms(),
    })
}

fn event_to_payload(event: Event) -> Option<FileWatchEvent> {
    if matches!(event.kind, EventKind::Access(_)) {
        return None;
    }

    let paths = normalize_event_paths(&event.paths);

    if paths.is_empty() {
        return None;
    }

    let (stale_paths, upsert_paths) = route_event_paths(&event.kind, &event.paths);
    let reconciliation_paths = if is_directory_event(&event.kind) {
        normalize_event_paths(&event.paths)
    } else {
        Vec::new()
    };

    Some(FileWatchEvent {
        event_type: event_type(&event.kind).to_string(),
        paths,
        stale_paths,
        upsert_paths,
        reconciliation_paths,
        timestamp_ms: current_timestamp_ms(),
    })
}

fn is_directory_event(kind: &EventKind) -> bool {
    matches!(
        kind,
        EventKind::Create(notify::event::CreateKind::Folder)
            | EventKind::Remove(notify::event::RemoveKind::Folder)
            // notify does not reliably carry directory metadata for both sides of a
            // rename. Treat every rename conservatively so old and new roots both
            // receive a full reconciliation instead of leaving directory descendants active.
            | EventKind::Modify(ModifyKind::Name(_))
    )
}

fn route_event_paths(kind: &EventKind, paths: &[PathBuf]) -> (Vec<String>, Vec<String>) {
    match kind {
        EventKind::Remove(_) => (normalize_event_paths(paths), Vec::new()),
        EventKind::Create(_) => (Vec::new(), normalize_event_paths(paths)),
        EventKind::Modify(ModifyKind::Name(RenameMode::Both)) => {
            if paths.len() >= 2 {
                (
                    normalize_event_paths(&paths[0..1]),
                    normalize_event_paths(&paths[1..2]),
                )
            } else {
                (Vec::new(), normalize_event_paths(paths))
            }
        }
        EventKind::Modify(ModifyKind::Name(RenameMode::From)) => {
            (normalize_event_paths(paths), Vec::new())
        }
        EventKind::Modify(ModifyKind::Name(RenameMode::To)) => {
            (Vec::new(), normalize_event_paths(paths))
        }
        EventKind::Modify(ModifyKind::Name(_)) | EventKind::Modify(_) | EventKind::Any => {
            (Vec::new(), normalize_event_paths(paths))
        }
        EventKind::Access(_) | EventKind::Other => (Vec::new(), Vec::new()),
    }
}

#[cfg(test)]
#[allow(clippy::items_after_test_module)]
mod tests {
    use super::*;
    use crate::settings::ScanRootSetting;
    use notify::event::{AccessKind, EventAttributes, RenameMode};
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    };

    #[test]
    fn watch_paths_follow_enabled_absolute_scan_root_settings() {
        let folders = vec![
            scan_root("downloads", "/Users/zen/Downloads", true),
            scan_root("projects", "/Volumes/Work/Projects", true),
            scan_root("archive", "/Volumes/Archive", false),
        ];

        let paths = watch_paths_from_default_scan_folders(&folders);

        assert_eq!(
            paths,
            vec![
                PathBuf::from("/Users/zen/Downloads"),
                PathBuf::from("/Volumes/Work/Projects")
            ]
        );
    }

    #[test]
    fn watch_paths_ignore_disabled_empty_and_relative_roots() {
        let folders = vec![
            scan_root("downloads", "/Users/zen/Downloads", false),
            scan_root("empty", "", true),
            scan_root("relative", "Downloads", true),
        ];

        let paths = watch_paths_from_default_scan_folders(&folders);

        assert!(paths.is_empty());
    }

    #[test]
    fn watch_paths_include_enabled_custom_search_roots() {
        let settings = AppSettings {
            default_scan_folders: vec![scan_root("downloads", "/Users/zen/Downloads", true)],
            custom_search_roots: vec![
                search_root("projects", "/Users/zen/Projects", true),
                search_root("disabled", "/Users/zen/Disabled", false),
            ],
            ..AppSettings::default()
        };

        let paths = watch_paths_from_settings(&settings);

        assert_eq!(
            paths,
            vec![
                PathBuf::from("/Users/zen/Downloads"),
                PathBuf::from("/Users/zen/Projects")
            ]
        );
    }

    #[test]
    fn legacy_watcher_paths_exclude_custom_search_roots() {
        let settings = AppSettings {
            default_scan_folders: vec![scan_root("downloads", "/Users/zen/Downloads", true)],
            custom_search_roots: vec![search_root("projects", "/Users/zen/Projects", true)],
            ..AppSettings::default()
        };

        assert_eq!(
            legacy_watch_paths_from_settings(&settings),
            vec![PathBuf::from("/Users/zen/Downloads")]
        );
    }

    #[test]
    fn file_watcher_manager_restarts_when_roots_change() {
        let manager = FileWatcherManager::default();
        let starts = Arc::new(AtomicUsize::new(0));
        let shutdowns = Arc::new(AtomicUsize::new(0));

        restart_test_session(&manager, "/tmp/root-a", &starts, &shutdowns);
        manager
            .restart_with_roots(
                vec![PathBuf::from("/tmp/root-a")],
                |_| panic!("unchanged roots should not restart"),
                |_, _| panic!("unchanged roots should not report a handoff gap"),
            )
            .expect("same roots");
        restart_test_session(&manager, "/tmp/root-b", &starts, &shutdowns);

        assert_eq!(starts.load(Ordering::SeqCst), 2);
        assert_eq!(shutdowns.load(Ordering::SeqCst), 1);

        drop(manager);
        assert_eq!(shutdowns.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn file_watcher_manager_stops_when_roots_become_empty() {
        let manager = FileWatcherManager::default();
        let starts = Arc::new(AtomicUsize::new(0));
        let shutdowns = Arc::new(AtomicUsize::new(0));

        restart_test_session(&manager, "/tmp/root-a", &starts, &shutdowns);
        manager
            .restart_with_roots(
                Vec::new(),
                |_| panic!("empty roots should not start"),
                |_, _| {},
            )
            .expect("empty roots");

        assert_eq!(
            manager.active_roots().expect("active roots"),
            Vec::<PathBuf>::new()
        );
        assert_eq!(starts.load(Ordering::SeqCst), 1);
        assert_eq!(shutdowns.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn watcher_reload_stops_old_owner_before_starting_new_owner() {
        let manager = FileWatcherManager::default();
        let active_owners = Arc::new(AtomicUsize::new(0));
        let handoff_gaps = Arc::new(AtomicUsize::new(0));
        let starts = Arc::new(AtomicUsize::new(0));

        let active_for_first = Arc::clone(&active_owners);
        manager
            .restart_with_roots(
                vec![PathBuf::from("/tmp/root-a")],
                move |roots| {
                    active_for_first.fetch_add(1, Ordering::SeqCst);
                    Ok(WatcherSession::new(roots, move || {
                        active_for_first.fetch_sub(1, Ordering::SeqCst);
                    }))
                },
                |_, _| {},
            )
            .expect("start first owner");

        let active_for_second = Arc::clone(&active_owners);
        let starts_for_second = Arc::clone(&starts);
        let gaps_for_second = Arc::clone(&handoff_gaps);
        manager
            .restart_with_roots(
                vec![PathBuf::from("/tmp/root-b")],
                move |roots| {
                    assert_eq!(active_for_second.load(Ordering::SeqCst), 0);
                    starts_for_second.fetch_add(1, Ordering::SeqCst);
                    active_for_second.fetch_add(1, Ordering::SeqCst);
                    Ok(WatcherSession::new(roots, move || {
                        active_for_second.fetch_sub(1, Ordering::SeqCst);
                    }))
                },
                move |old_roots, new_roots| {
                    assert_eq!(old_roots, &[PathBuf::from("/tmp/root-a")]);
                    assert_eq!(new_roots, &[PathBuf::from("/tmp/root-b")]);
                    gaps_for_second.fetch_add(1, Ordering::SeqCst);
                },
            )
            .expect("handoff to second owner");

        assert_eq!(active_owners.load(Ordering::SeqCst), 1);
        assert_eq!(starts.load(Ordering::SeqCst), 1);
        assert_eq!(handoff_gaps.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn watcher_reload_start_failure_leaves_no_owner_and_reports_reconciliation_gap() {
        let manager = FileWatcherManager::default();
        let gaps = Arc::new(AtomicUsize::new(0));
        let gaps_for_callback = Arc::clone(&gaps);

        let result = manager.restart_with_roots(
            vec![PathBuf::from("/tmp/root-a")],
            |_| {
                Err(WatcherError::MissingPath(
                    "synthetic start failure".to_string(),
                ))
            },
            move |old_roots, new_roots| {
                assert!(old_roots.is_empty());
                assert_eq!(new_roots, &[PathBuf::from("/tmp/root-a")]);
                gaps_for_callback.fetch_add(1, Ordering::SeqCst);
            },
        );

        assert!(result.is_err());
        assert!(manager.active_roots().expect("active roots").is_empty());
        assert_eq!(gaps.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn watcher_reload_start_failure_after_handoff_keeps_no_old_or_new_owner() {
        let manager = FileWatcherManager::default();
        let active_owners = Arc::new(AtomicUsize::new(0));
        let gaps = Arc::new(AtomicUsize::new(0));
        let active_for_first = Arc::clone(&active_owners);
        manager
            .restart_with_roots(
                vec![PathBuf::from("/tmp/root-a")],
                move |roots| {
                    active_for_first.fetch_add(1, Ordering::SeqCst);
                    Ok(WatcherSession::new(roots, move || {
                        active_for_first.fetch_sub(1, Ordering::SeqCst);
                    }))
                },
                |_, _| {},
            )
            .expect("start old owner");

        let active_for_failed_start = Arc::clone(&active_owners);
        let active_for_callback = Arc::clone(&active_owners);
        let gaps_for_callback = Arc::clone(&gaps);
        let result = manager.restart_with_roots(
            vec![PathBuf::from("/tmp/root-b")],
            move |_| {
                assert_eq!(active_for_failed_start.load(Ordering::SeqCst), 0);
                Err(WatcherError::MissingPath(
                    "synthetic reload failure".to_string(),
                ))
            },
            move |old_roots, new_roots| {
                assert_eq!(active_for_callback.load(Ordering::SeqCst), 0);
                assert_eq!(old_roots, &[PathBuf::from("/tmp/root-a")]);
                assert_eq!(new_roots, &[PathBuf::from("/tmp/root-b")]);
                gaps_for_callback.fetch_add(1, Ordering::SeqCst);
            },
        );

        assert!(result.is_err());
        assert!(manager.active_roots().expect("active roots").is_empty());
        assert_eq!(active_owners.load(Ordering::SeqCst), 0);
        assert_eq!(gaps.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn event_to_payload_ignores_access_events() {
        let event = Event {
            kind: EventKind::Access(AccessKind::Read),
            paths: vec![PathBuf::from("/Users/zen/Documents/report.pdf")],
            attrs: EventAttributes::new(),
        };

        assert!(event_to_payload(event).is_none());
    }

    #[test]
    fn event_to_payload_splits_rename_old_and_new_paths() {
        let event = Event {
            kind: EventKind::Modify(ModifyKind::Name(RenameMode::Both)),
            paths: vec![
                PathBuf::from("/Users/zen/Documents/old.pdf"),
                PathBuf::from("/Users/zen/Documents/new.pdf"),
            ],
            attrs: EventAttributes::new(),
        };

        let payload = event_to_payload(event).expect("rename payload");

        assert_eq!(payload.event_type, "renamed");
        assert_eq!(payload.stale_paths, vec!["/Users/zen/Documents/old.pdf"]);
        assert_eq!(payload.upsert_paths, vec!["/Users/zen/Documents/new.pdf"]);
        assert_eq!(
            payload.paths,
            vec![
                "/Users/zen/Documents/old.pdf".to_string(),
                "/Users/zen/Documents/new.pdf".to_string()
            ]
        );
        assert_eq!(
            payload.reconciliation_paths,
            vec![
                "/Users/zen/Documents/old.pdf".to_string(),
                "/Users/zen/Documents/new.pdf".to_string()
            ]
        );
    }

    #[test]
    fn event_to_payload_routes_delete_and_create_paths() {
        let deleted = event_to_payload(Event {
            kind: EventKind::Remove(notify::event::RemoveKind::File),
            paths: vec![PathBuf::from("/Users/zen/Documents/deleted.pdf")],
            attrs: EventAttributes::new(),
        })
        .expect("delete payload");
        let created = event_to_payload(Event {
            kind: EventKind::Create(notify::event::CreateKind::File),
            paths: vec![PathBuf::from("/Users/zen/Documents/created.pdf")],
            attrs: EventAttributes::new(),
        })
        .expect("create payload");

        assert_eq!(
            deleted.stale_paths,
            vec!["/Users/zen/Documents/deleted.pdf"]
        );
        assert!(deleted.upsert_paths.is_empty());
        assert_eq!(
            created.upsert_paths,
            vec!["/Users/zen/Documents/created.pdf"]
        );
        assert!(created.stale_paths.is_empty());
    }

    #[test]
    fn directory_events_are_marked_for_full_reconciliation() {
        let payload = event_to_payload(Event {
            kind: EventKind::Create(notify::event::CreateKind::Folder),
            paths: vec![PathBuf::from("/Users/zen/Documents/new-folder")],
            attrs: EventAttributes::new(),
        })
        .expect("directory create payload");

        assert_eq!(
            payload.reconciliation_paths,
            vec!["/Users/zen/Documents/new-folder"]
        );
    }

    #[test]
    fn same_root_directory_rename_marks_old_and_new_paths_for_reconciliation() {
        let payload = event_to_payload(Event {
            kind: EventKind::Modify(ModifyKind::Name(RenameMode::Both)),
            paths: vec![
                PathBuf::from("/Users/zen/Documents/old-folder"),
                PathBuf::from("/Users/zen/Documents/new-folder"),
            ],
            attrs: EventAttributes::new(),
        })
        .expect("directory rename payload");

        assert_eq!(
            payload.reconciliation_paths,
            vec![
                "/Users/zen/Documents/old-folder".to_string(),
                "/Users/zen/Documents/new-folder".to_string()
            ]
        );
    }

    #[test]
    fn cross_root_directory_rename_marks_both_roots_for_reconciliation() {
        let payload = event_to_payload(Event {
            kind: EventKind::Modify(ModifyKind::Name(RenameMode::Both)),
            paths: vec![
                PathBuf::from("/Users/zen/Downloads/old-folder"),
                PathBuf::from("/Users/zen/Projects/new-folder"),
            ],
            attrs: EventAttributes::new(),
        })
        .expect("cross-root directory rename payload");

        assert_eq!(payload.stale_paths, vec!["/Users/zen/Downloads/old-folder"]);
        assert_eq!(payload.upsert_paths, vec!["/Users/zen/Projects/new-folder"]);
        assert_eq!(
            payload.reconciliation_paths,
            vec![
                "/Users/zen/Downloads/old-folder".to_string(),
                "/Users/zen/Projects/new-folder".to_string()
            ]
        );
    }

    #[test]
    fn watcher_root_matching_is_boundary_aware() {
        assert!(path_within_root(
            "/Users/zen/Library",
            "/Users/zen/Library/report.pdf"
        ));
        assert!(path_within_root("C:/Library", "C:/Library/report.pdf"));
        assert!(!path_within_root(
            "/Users/zen/Library",
            "/Users/zen/Library-old/report.pdf"
        ));
    }

    #[test]
    fn overflow_signal_is_once_per_burst() {
        let burst_active = AtomicBool::new(false);
        let signal = AtomicBool::new(false);

        signal_overflow(&burst_active, &signal);
        signal_overflow(&burst_active, &signal);
        assert!(signal.swap(false, Ordering::AcqRel));
        assert!(!signal.load(Ordering::Acquire));

        signal_overflow(&burst_active, &signal);
        assert!(!signal.load(Ordering::Acquire));
        burst_active.store(false, Ordering::Release);
        signal_overflow(&burst_active, &signal);
        assert!(signal.load(Ordering::Acquire));
    }

    #[test]
    fn bounded_retry_recovers_after_a_transient_rule_failure() {
        let attempts = Arc::new(AtomicUsize::new(0));
        let delays = Arc::new(AtomicUsize::new(0));
        let attempts_for_operation = Arc::clone(&attempts);
        let delays_for_callback = Arc::clone(&delays);

        let result = bounded_retry(
            3,
            move || {
                let attempt = attempts_for_operation.fetch_add(1, Ordering::SeqCst);
                if attempt < 2 {
                    Err("temporary rule failure")
                } else {
                    Ok("recovered")
                }
            },
            move |_| {
                delays_for_callback.fetch_add(1, Ordering::SeqCst);
            },
        );

        assert_eq!(result.expect("bounded retry recovery"), "recovered");
        assert_eq!(attempts.load(Ordering::SeqCst), 3);
        assert_eq!(delays.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn bounded_retry_returns_the_last_permanent_rule_failure() {
        let attempts = Arc::new(AtomicUsize::new(0));
        let attempts_for_operation = Arc::clone(&attempts);

        let result = bounded_retry(
            3,
            move || {
                attempts_for_operation.fetch_add(1, Ordering::SeqCst);
                Err::<(), _>("permanent rule failure")
            },
            |_| {},
        );

        assert_eq!(
            result.expect_err("permanent failure must remain visible"),
            "permanent rule failure"
        );
        assert_eq!(attempts.load(Ordering::SeqCst), 3);
    }

    #[test]
    fn backend_owner_switch_defaults_on_and_accepts_explicit_legacy_values() {
        assert!(backend_watcher_reconciliation_enabled_value(None));
        assert!(backend_watcher_reconciliation_enabled_value(Some("true")));
        assert!(!backend_watcher_reconciliation_enabled_value(Some("false")));
        assert!(!backend_watcher_reconciliation_enabled_value(Some("0")));
        assert!(!backend_watcher_reconciliation_enabled_value(Some(
            "disabled"
        )));
    }

    fn scan_root(id: &str, path: &str, enabled: bool) -> ScanRootSetting {
        ScanRootSetting {
            id: id.to_string(),
            path: path.to_string(),
            label: id.to_string(),
            enabled,
            created_at: "2026-06-22T00:00:00.000Z".to_string(),
        }
    }

    #[test]
    fn watcher_payloads_coalesce_and_keep_the_latest_route_for_each_path() {
        let path = "/Users/zen/Documents/report.pdf".to_string();
        let created = FileWatchEvent {
            event_type: "create".to_string(),
            paths: vec![path.clone()],
            stale_paths: Vec::new(),
            upsert_paths: vec![path.clone()],
            reconciliation_paths: Vec::new(),
            timestamp_ms: 1,
        };
        let removed = FileWatchEvent {
            event_type: "remove".to_string(),
            paths: vec![path.clone()],
            stale_paths: vec![path.clone()],
            upsert_paths: Vec::new(),
            reconciliation_paths: Vec::new(),
            timestamp_ms: 2,
        };

        let payload = coalesce_payloads(vec![created, removed]).expect("coalesced payload");

        assert_eq!(payload.event_type, "batch");
        assert_eq!(payload.paths, vec![path.clone()]);
        assert_eq!(payload.stale_paths, vec![path]);
        assert!(payload.upsert_paths.is_empty());
    }

    fn search_root(id: &str, path: &str, enabled: bool) -> SearchRootSetting {
        SearchRootSetting {
            id: id.to_string(),
            path: path.to_string(),
            label: id.to_string(),
            enabled,
            created_at: "2026-06-22T00:00:00.000Z".to_string(),
        }
    }

    fn restart_test_session(
        manager: &FileWatcherManager,
        root: &str,
        starts: &Arc<AtomicUsize>,
        shutdowns: &Arc<AtomicUsize>,
    ) {
        let starts = Arc::clone(starts);
        let shutdowns = Arc::clone(shutdowns);
        manager
            .restart_with_roots(
                vec![PathBuf::from(root)],
                move |roots| {
                    starts.fetch_add(1, Ordering::SeqCst);
                    Ok(WatcherSession::new(roots, move || {
                        shutdowns.fetch_add(1, Ordering::SeqCst);
                    }))
                },
                |_, _| {},
            )
            .expect("restart test session");
    }
}

fn event_type(kind: &EventKind) -> &'static str {
    match kind {
        EventKind::Create(_) => "created",
        EventKind::Remove(_) => "deleted",
        EventKind::Modify(ModifyKind::Name(_)) => "renamed",
        EventKind::Modify(_) => "modified",
        EventKind::Access(_) => "accessed",
        EventKind::Any => "changed",
        EventKind::Other => "other",
    }
}

fn normalize_watch_roots(paths: Vec<PathBuf>) -> Result<Vec<PathBuf>, WatcherError> {
    let mut roots = Vec::new();

    for path in paths {
        if !path.exists() {
            return Err(WatcherError::MissingPath(normalize_path(&path)));
        }
        if !path.is_dir() {
            return Err(WatcherError::NotDirectory(normalize_path(&path)));
        }

        let canonical = path.canonicalize()?;
        if roots.iter().any(|root| root == &canonical) {
            continue;
        }
        roots.push(canonical);
    }

    Ok(roots)
}

fn is_ignored_path(path: &Path) -> bool {
    path.components()
        .any(|component| is_ignored_dir_name(component.as_os_str()))
}

fn normalize_event_paths(paths: &[PathBuf]) -> Vec<String> {
    paths
        .iter()
        .filter(|path| !is_ignored_path(path))
        .map(|path| normalize_path(path))
        .collect()
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn looks_absolute_path(path: &str) -> bool {
    Path::new(path).is_absolute()
        || path.starts_with('/')
        || path.starts_with('\\')
        || path.as_bytes().get(0..3).is_some_and(|prefix| {
            prefix[0].is_ascii_alphabetic()
                && prefix[1] == b':'
                && (prefix[2] == b'/' || prefix[2] == b'\\')
        })
}

fn current_timestamp_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}
