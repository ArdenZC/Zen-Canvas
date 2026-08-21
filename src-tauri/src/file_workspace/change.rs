//! Session-scoped, non-durable change hints for Ephemeral Browse.
//!
//! This module owns only a disposable notify registration and its bounded
//! event channel. It never writes managed state and never treats a raw event
//! as row-level truth. A relevant hint first invalidates the current Browse
//! enumeration, then leaves one bounded refresh request for the integration
//! layer to consume through the existing BrowseService.

#![allow(dead_code)]

use super::browse::{BrowseError, BrowsePage, BrowseQuerySpecV1, BrowseService};
use super::BrowsePathRef;
use notify::{
    event::ModifyKind, recommended_watcher, Event, EventKind, RecommendedWatcher, RecursiveMode,
    Watcher,
};
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    mpsc::{self, Receiver, TrySendError},
    Arc, Mutex,
};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};
use thiserror::Error;

const CHANGE_QUEUE_CAPACITY: usize = 128;
const CHANGE_BATCH_LIMIT: usize = 128;
const CHANGE_COALESCE_WINDOW: Duration = Duration::from_millis(50);
const CHANGE_WORKER_POLL: Duration = Duration::from_millis(25);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum EphemeralChangeKind {
    ContentChanged,
    Renamed,
    TargetUnavailable,
    Uncertain,
}

impl EphemeralChangeKind {
    fn merge(self, other: Self) -> Self {
        use EphemeralChangeKind::{ContentChanged, Renamed, TargetUnavailable, Uncertain};
        match (self, other) {
            (Uncertain, _) | (_, Uncertain) => Uncertain,
            (TargetUnavailable, _) | (_, TargetUnavailable) => TargetUnavailable,
            (Renamed, _) | (_, Renamed) => Renamed,
            (ContentChanged, ContentChanged) => ContentChanged,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct EphemeralChangeHint {
    pub(crate) kind: EphemeralChangeKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct EphemeralRefreshRequest {
    pub(crate) sequence: u64,
    generation: u64,
    pub(crate) hint: EphemeralChangeHint,
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub(crate) enum EphemeralChangeError {
    #[error(transparent)]
    Browse(#[from] BrowseError),
    #[error("ephemeral_change_invalidation_failed: {0}")]
    InvalidationFailed(BrowseError),
    #[error("ephemeral_change_monitor_disposed")]
    Disposed,
    #[error("ephemeral_change_refresh_not_pending")]
    RefreshNotPending,
    #[error("ephemeral_change_refresh_superseded")]
    RefreshSuperseded,
    #[error("ephemeral_change_watcher_start_failed: {0}")]
    WatcherStart(String),
    #[error("ephemeral_change_thread_start_failed: {0}")]
    ThreadStart(String),
}

#[derive(Debug)]
struct MonitorState {
    disposed: bool,
    pending: Option<EphemeralRefreshRequest>,
    next_sequence: u64,
    invalidation_error: Option<BrowseError>,
}

struct MonitorRuntime {
    browse: Arc<BrowseService>,
    session_id: String,
    path_ref: BrowsePathRef,
    target: PathBuf,
    stopped: AtomicBool,
    change_generation: AtomicU64,
    state: Mutex<MonitorState>,
}

pub(crate) struct EphemeralChangeMonitor {
    runtime: Arc<MonitorRuntime>,
    worker: Mutex<Option<JoinHandle<()>>>,
}

impl EphemeralChangeMonitor {
    /// Start a disposable, non-recursive monitor for an existing Browse path
    /// reference. The Browse service supplies the backend-resolved target;
    /// normal Browse navigation/session ownership remains responsible for the
    /// path reference lifecycle.
    pub(crate) fn start(
        browse: Arc<BrowseService>,
        session_id: impl Into<String>,
        path_ref: BrowsePathRef,
    ) -> Result<Self, EphemeralChangeError> {
        let session_id = session_id.into();
        let target = browse.resolve_watch_target(&session_id, &path_ref)?;
        let target_path = target.as_path().to_path_buf();
        let (tx, rx) = mpsc::sync_channel(CHANGE_QUEUE_CAPACITY);
        let runtime = Arc::new(MonitorRuntime {
            browse: Arc::clone(&browse),
            session_id,
            path_ref,
            target: target_path.clone(),
            stopped: AtomicBool::new(false),
            change_generation: AtomicU64::new(0),
            state: Mutex::new(MonitorState {
                disposed: false,
                pending: None,
                next_sequence: 0,
                invalidation_error: None,
            }),
        });

        let stopped_for_callback = Arc::clone(&runtime);
        let overflow = Arc::new(AtomicBool::new(false));
        let overflow_for_callback = Arc::clone(&overflow);
        let tx_for_callback = tx;
        let mut watcher = match recommended_watcher(move |event| {
            if stopped_for_callback.stopped.load(Ordering::Acquire) {
                return;
            }
            match tx_for_callback.try_send(event) {
                Ok(()) => {}
                Err(TrySendError::Full(_)) => {
                    overflow_for_callback.store(true, Ordering::Release);
                }
                Err(TrySendError::Disconnected(_)) => {}
            }
        }) {
            Ok(watcher) => watcher,
            Err(error) => {
                runtime.stopped.store(true, Ordering::Release);
                return Err(EphemeralChangeError::WatcherStart(error.to_string()));
            }
        };

        if let Err(error) = watcher.watch(&target_path, RecursiveMode::NonRecursive) {
            runtime.stopped.store(true, Ordering::Release);
            return Err(EphemeralChangeError::WatcherStart(error.to_string()));
        }

        let runtime_for_worker = Arc::clone(&runtime);
        let worker = match thread::Builder::new()
            .name("zen-canvas-ephemeral-change".to_string())
            .spawn(move || run_worker(runtime_for_worker, watcher, rx, overflow))
        {
            Ok(worker) => worker,
            Err(error) => {
                runtime.stopped.store(true, Ordering::Release);
                return Err(EphemeralChangeError::ThreadStart(error.to_string()));
            }
        };

        Ok(Self {
            runtime,
            worker: Mutex::new(Some(worker)),
        })
    }

    /// Return the coalesced request without consuming it. The request contains
    /// no raw event kind or filesystem path.
    pub(crate) fn pending_refresh(&self) -> Option<EphemeralRefreshRequest> {
        let state = self.runtime.state.lock().ok()?;
        (!state.disposed).then(|| state.pending).flatten()
    }

    /// Consume the current bounded request and restart enumeration through the
    /// existing BrowseService. A failed start leaves the request pending for a
    /// later bounded retry; a page is validated before it is returned.
    ///
    /// A refresh is generation-bound. If another relevant change arrives
    /// while enumeration is in flight, the newly-created enumeration is
    /// invalidated, the pending refresh is retained, and the page is never
    /// published as current.
    pub(crate) fn refresh(
        &self,
        request_id: impl Into<String>,
        page_size: usize,
    ) -> Result<BrowsePage, EphemeralChangeError> {
        self.refresh_with_query(request_id, page_size, BrowseQuerySpecV1::default())
    }

    pub(crate) fn refresh_with_query(
        &self,
        request_id: impl Into<String>,
        page_size: usize,
        query: BrowseQuerySpecV1,
    ) -> Result<BrowsePage, EphemeralChangeError> {
        let (request_sequence, request_generation) = {
            let state = self
                .runtime
                .state
                .lock()
                .map_err(|_| EphemeralChangeError::Disposed)?;
            if state.disposed || self.runtime.stopped.load(Ordering::Acquire) {
                return Err(EphemeralChangeError::Disposed);
            }
            if let Some(error) = state.invalidation_error {
                return Err(EphemeralChangeError::InvalidationFailed(error));
            }
            let pending = state
                .pending
                .ok_or(EphemeralChangeError::RefreshNotPending)?;
            (pending.sequence, pending.generation)
        };

        let page = self
            .runtime
            .browse
            .start_enumeration_with_query(
                &self.runtime.session_id,
                request_id,
                &self.runtime.path_ref,
                page_size,
                query,
            )
            .map_err(EphemeralChangeError::Browse)?;

        if self.runtime.stopped.load(Ordering::Acquire) {
            let _ = self.runtime.browse.invalidate(&self.runtime.session_id);
            return Err(EphemeralChangeError::Disposed);
        }
        self.runtime
            .browse
            .validate_page(&page)
            .map_err(EphemeralChangeError::Browse)?;

        let mut state = self
            .runtime
            .state
            .lock()
            .map_err(|_| EphemeralChangeError::Disposed)?;
        if state.disposed {
            drop(state);
            let _ = self.runtime.browse.invalidate(&self.runtime.session_id);
            return Err(EphemeralChangeError::Disposed);
        }

        let current_generation = self.runtime.change_generation.load(Ordering::Acquire);
        let request_is_still_current = current_generation == request_generation
            && state.pending.is_some_and(|pending| {
                pending.sequence == request_sequence && pending.generation == request_generation
            });
        if !request_is_still_current {
            drop(state);
            let _ = self.runtime.browse.invalidate(&self.runtime.session_id);
            return Err(EphemeralChangeError::RefreshSuperseded);
        }

        state.pending = None;
        Ok(page)
    }

    /// Stop the watcher and revoke any current Browse enumeration. The join is
    /// bounded by the worker's bounded receive/coalescing loop and is safe to
    /// call repeatedly.
    pub(crate) fn dispose(&self) {
        self.runtime.stopped.store(true, Ordering::Release);
        if let Ok(mut state) = self.runtime.state.lock() {
            state.disposed = true;
            state.pending = None;
        }
        let _ = self.runtime.browse.invalidate(&self.runtime.session_id);

        if let Ok(mut worker) = self.worker.lock() {
            if let Some(worker) = worker.take() {
                let _ = worker.join();
            }
        }
    }

    #[cfg(test)]
    fn inject_hint(&self, kind: EphemeralChangeKind) {
        handle_hint(&self.runtime, kind);
    }

    #[cfg(test)]
    pub(crate) fn inject_hint_for_integration_test(&self, kind: EphemeralChangeKind) {
        self.inject_hint(kind);
    }

    #[cfg(test)]
    fn worker_finished(&self) -> bool {
        self.worker.lock().expect("worker lock").is_none()
    }
}

impl Drop for EphemeralChangeMonitor {
    fn drop(&mut self) {
        self.dispose();
    }
}

fn run_worker(
    runtime: Arc<MonitorRuntime>,
    _watcher: RecommendedWatcher,
    rx: Receiver<notify::Result<Event>>,
    overflow: Arc<AtomicBool>,
) {
    while !runtime.stopped.load(Ordering::Acquire) {
        if overflow.swap(false, Ordering::AcqRel) {
            handle_hint(&runtime, EphemeralChangeKind::Uncertain);
        }

        match rx.recv_timeout(CHANGE_WORKER_POLL) {
            Ok(first) => {
                let mut batch = vec![first];
                let deadline = Instant::now() + CHANGE_COALESCE_WINDOW;
                while batch.len() < CHANGE_BATCH_LIMIT {
                    let Some(remaining) = deadline.checked_duration_since(Instant::now()) else {
                        break;
                    };
                    match rx.recv_timeout(remaining) {
                        Ok(event) => batch.push(event),
                        Err(mpsc::RecvTimeoutError::Timeout)
                        | Err(mpsc::RecvTimeoutError::Disconnected) => break,
                    }
                }

                let mut hint = summarize_events(&runtime.target, batch);
                if overflow.swap(false, Ordering::AcqRel) {
                    hint = merge_optional_hint(hint, EphemeralChangeKind::Uncertain);
                }
                if let Some(hint) = hint {
                    handle_hint(&runtime, hint);
                }
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {}
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }
}

fn handle_hint(runtime: &Arc<MonitorRuntime>, kind: EphemeralChangeKind) {
    if runtime.stopped.load(Ordering::Acquire) {
        return;
    }

    // Advance generation before touching Browse state. A refresh that is
    // already in flight can therefore detect this change even if this hint is
    // briefly delayed before it is merged into the pending request.
    let generation = runtime
        .change_generation
        .fetch_add(1, Ordering::AcqRel)
        .wrapping_add(1);

    let should_invalidate = match runtime.state.lock() {
        Ok(state) => {
            !state.disposed && state.pending.is_none() && state.invalidation_error.is_none()
        }
        Err(_) => false,
    };

    if should_invalidate {
        if let Err(error) = runtime.browse.invalidate(&runtime.session_id) {
            if let Ok(mut state) = runtime.state.lock() {
                if !state.disposed {
                    state.invalidation_error = Some(error);
                }
            }
            if matches!(error, BrowseError::SessionNotFound) {
                runtime.stopped.store(true, Ordering::Release);
            }
            return;
        }
    }

    if runtime.stopped.load(Ordering::Acquire) {
        return;
    }
    let Ok(mut state) = runtime.state.lock() else {
        return;
    };
    if state.disposed || state.invalidation_error.is_some() {
        return;
    }
    let hint = EphemeralChangeHint { kind };
    if let Some(pending) = &mut state.pending {
        pending.generation = generation;
        pending.hint.kind = pending.hint.kind.merge(kind);
    } else {
        state.next_sequence = state.next_sequence.saturating_add(1);
        state.pending = Some(EphemeralRefreshRequest {
            sequence: state.next_sequence,
            generation,
            hint,
        });
    }
}

fn summarize_events(
    target: &Path,
    events: Vec<notify::Result<Event>>,
) -> Option<EphemeralChangeKind> {
    let truncated = events.len() >= CHANGE_BATCH_LIMIT;
    let mut hint = None;
    for event in events
        .into_iter()
        .take(CHANGE_BATCH_LIMIT)
        .filter_map(|event| classify_event(target, event))
    {
        hint = merge_optional_hint(hint, event);
    }
    if truncated {
        hint = merge_optional_hint(hint, EphemeralChangeKind::Uncertain);
    }
    hint
}

fn merge_optional_hint(
    current: Option<EphemeralChangeKind>,
    next: EphemeralChangeKind,
) -> Option<EphemeralChangeKind> {
    Some(current.map_or(next, |current| current.merge(next)))
}

fn classify_event(target: &Path, event: notify::Result<Event>) -> Option<EphemeralChangeKind> {
    let event = match event {
        Ok(event) => event,
        Err(_) => return Some(EphemeralChangeKind::Uncertain),
    };
    if matches!(event.kind, EventKind::Access(_)) {
        return None;
    }
    if event.paths.is_empty() {
        return Some(EphemeralChangeKind::Uncertain);
    }
    if !event
        .paths
        .iter()
        .any(|path| path_is_within_target(target, path))
    {
        return None;
    }

    let target_path_event = event.paths.iter().any(|path| paths_equal(target, path));
    if target_path_event
        && (matches!(event.kind, EventKind::Remove(_))
            || matches!(event.kind, EventKind::Modify(ModifyKind::Name(_)))
            || !target.is_dir())
    {
        return Some(EphemeralChangeKind::TargetUnavailable);
    }
    if matches!(event.kind, EventKind::Modify(ModifyKind::Name(_))) {
        return Some(EphemeralChangeKind::Renamed);
    }
    if matches!(event.kind, EventKind::Other) {
        return Some(EphemeralChangeKind::Uncertain);
    }
    Some(EphemeralChangeKind::ContentChanged)
}

fn path_is_within_target(target: &Path, candidate: &Path) -> bool {
    let target = path_key(target);
    let candidate = path_key(candidate);
    candidate == target
        || candidate
            .strip_prefix(&target)
            .is_some_and(|suffix| suffix.starts_with('/'))
}

fn paths_equal(left: &Path, right: &Path) -> bool {
    path_key(left) == path_key(right)
}

fn path_key(path: &Path) -> String {
    let mut key = path.to_string_lossy().replace('\\', "/");
    while key.len() > 1 && key.ends_with('/') && !is_drive_root(&key) {
        key.pop();
    }
    if cfg!(windows) {
        key.make_ascii_lowercase();
    }
    key
}

fn is_drive_root(path: &str) -> bool {
    path.len() == 3
        && path.as_bytes().get(1) == Some(&b':')
        && path.as_bytes().get(2) == Some(&b'/')
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::file_workspace::browse::{
        BackendResolvedDirectory, BrowseCompletion, BrowseLimits, BrowseSessionInfo,
        TestPublishGate,
    };
    use notify::event::{EventAttributes, RenameMode};
    use std::fs;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::thread;
    use std::time::{SystemTime, UNIX_EPOCH};

    static FIXTURE_COUNTER: AtomicUsize = AtomicUsize::new(0);

    struct Fixture {
        root: PathBuf,
    }

    impl Fixture {
        fn new() -> Self {
            let id = FIXTURE_COUNTER.fetch_add(1, Ordering::Relaxed);
            let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .parent()
                .expect("src-tauri has repository parent")
                .to_path_buf();
            let root = repo_root
                .join(".tmp-tests")
                .join("ephemeral-change")
                .join(format!(
                    "{}-{}-{}",
                    std::process::id(),
                    SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .expect("clock")
                        .as_nanos(),
                    id
                ));
            fs::create_dir_all(&root).expect("create fixture root");
            Self { root }
        }

        fn directory(&self) -> BackendResolvedDirectory {
            BackendResolvedDirectory::from_backend_path(self.root.clone()).expect("directory")
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            if self.root.exists() {
                fs::remove_dir_all(&self.root).expect("remove fixture root");
            }
            if let Some(change_root) = self.root.parent() {
                let _ = fs::remove_dir(change_root);
                if let Some(tmp_root) = change_root.parent() {
                    let _ = fs::remove_dir(tmp_root);
                }
            }
        }
    }

    fn monitor_fixture() -> (
        Fixture,
        Arc<BrowseService>,
        BrowseSessionInfo,
        EphemeralChangeMonitor,
    ) {
        let fixture = Fixture::new();
        fs::write(fixture.root.join("first.txt"), b"first").expect("fixture file");
        let browse = Arc::new(
            BrowseService::new(BrowseLimits {
                max_sessions: 1,
                max_page_size: 8,
                max_path_refs: 8,
                max_entry_refs: 32,
                max_process_path_refs: 8,
                max_process_entry_refs: 32,
            })
            .expect("browse limits"),
        );
        let session = browse.start_session(fixture.directory()).expect("session");
        let monitor = EphemeralChangeMonitor::start(
            Arc::clone(&browse),
            session.session_id.clone(),
            session.root_path_ref.clone(),
        )
        .expect("monitor");
        (fixture, browse, session, monitor)
    }

    #[test]
    fn create_or_change_hint_invalidates_and_refreshes_with_a_new_identity() {
        let (_fixture, browse, session, monitor) = monitor_fixture();
        let old = browse
            .start_enumeration(&session.session_id, "old", &session.root_path_ref, 8)
            .expect("old page");

        monitor.inject_hint(EphemeralChangeKind::ContentChanged);

        assert_eq!(
            browse.validate_page(&old),
            Err(BrowseError::StaleEnumeration)
        );
        assert_eq!(
            monitor
                .pending_refresh()
                .expect("refresh request")
                .hint
                .kind,
            EphemeralChangeKind::ContentChanged
        );
        let fresh = monitor.refresh("refresh", 8).expect("fresh page");
        assert_ne!(old.enumeration_id, fresh.enumeration_id);
        assert_eq!(fresh.completion, BrowseCompletion::Complete);
    }

    #[test]
    fn delete_or_rename_hint_is_distinguished_and_coalesced() {
        let (_fixture, browse, session, monitor) = monitor_fixture();
        let old = browse
            .start_enumeration(&session.session_id, "old", &session.root_path_ref, 8)
            .expect("old page");

        monitor.inject_hint(EphemeralChangeKind::Renamed);
        monitor.inject_hint(EphemeralChangeKind::TargetUnavailable);

        assert_eq!(
            browse.validate_page(&old),
            Err(BrowseError::StaleEnumeration)
        );
        assert_eq!(
            monitor
                .pending_refresh()
                .expect("refresh request")
                .hint
                .kind,
            EphemeralChangeKind::TargetUnavailable
        );
    }

    #[test]
    fn a_burst_has_one_bounded_pending_refresh_request() {
        let (_fixture, _browse, _session, monitor) = monitor_fixture();
        for _ in 0..1_000 {
            monitor.inject_hint(EphemeralChangeKind::ContentChanged);
        }

        let request = monitor.pending_refresh().expect("coalesced request");
        assert_eq!(request.sequence, 1);
        assert_eq!(request.hint.kind, EphemeralChangeKind::ContentChanged);
    }

    #[test]
    fn notify_translation_ignores_access_and_degrades_uncertainty() {
        let target = PathBuf::from("/work/Documents");
        let access = Event {
            kind: EventKind::Access(notify::event::AccessKind::Read),
            paths: vec![target.join("report.txt")],
            attrs: EventAttributes::new(),
        };
        assert_eq!(classify_event(&target, Ok(access)), None);

        let other = Event {
            kind: EventKind::Other,
            paths: vec![target.join("report.txt")],
            attrs: EventAttributes::new(),
        };
        assert_eq!(
            classify_event(&target, Ok(other)),
            Some(EphemeralChangeKind::Uncertain)
        );
        let file_change = Event {
            kind: EventKind::Modify(ModifyKind::Data(notify::event::DataChange::Any)),
            paths: vec![target.join("report.txt")],
            attrs: EventAttributes::new(),
        };
        assert_eq!(
            classify_event(&target, Ok(file_change)),
            Some(EphemeralChangeKind::ContentChanged)
        );
        let outside_change = Event {
            kind: EventKind::Modify(ModifyKind::Data(notify::event::DataChange::Any)),
            paths: vec![PathBuf::from("/work/Documents-archive/report.txt")],
            attrs: EventAttributes::new(),
        };
        assert_eq!(classify_event(&target, Ok(outside_change)), None);
        assert_eq!(
            classify_event(&target, Err(notify::Error::generic("watcher failure"))),
            Some(EphemeralChangeKind::Uncertain)
        );
    }

    #[test]
    fn target_rename_event_is_unavailable_without_row_deletion_semantics() {
        let target = PathBuf::from("/work/Documents");
        let event = Event {
            kind: EventKind::Modify(ModifyKind::Name(RenameMode::Both)),
            paths: vec![target.clone(), PathBuf::from("/work/Archive")],
            attrs: EventAttributes::new(),
        };
        assert_eq!(
            classify_event(&target, Ok(event)),
            Some(EphemeralChangeKind::TargetUnavailable)
        );
    }

    #[test]
    fn old_cursor_and_delayed_page_lose_publication_rights() {
        let (fixture, browse, session, monitor) = monitor_fixture();
        fs::write(fixture.root.join("second.txt"), b"second").expect("second fixture file");
        let old = browse
            .start_enumeration(&session.session_id, "old", &session.root_path_ref, 1)
            .expect("old page");
        let cursor = old.next_cursor.clone().expect("old cursor");
        monitor.inject_hint(EphemeralChangeKind::ContentChanged);
        assert_eq!(
            browse.next_page(&session.session_id, &cursor, 1),
            Err(BrowseError::StaleEnumeration)
        );
        let first_refresh = monitor.refresh("first-refresh", 1).expect("first refresh");
        browse
            .validate_page(&first_refresh)
            .expect("first refresh current");

        let gate = Arc::new(TestPublishGate::default());
        browse.set_test_publish_gate(Arc::clone(&gate));
        let browse_for_worker = Arc::clone(&browse);
        let session_id = session.session_id.clone();
        let root_ref = session.root_path_ref.clone();
        let worker = thread::spawn(move || {
            browse_for_worker.start_enumeration(&session_id, "delayed", &root_ref, 1)
        });
        gate.wait_until_reached();
        monitor.inject_hint(EphemeralChangeKind::Renamed);
        let fresh = monitor.refresh("fresh", 1).expect("fresh enumeration");
        gate.release();

        assert_eq!(
            worker.join().expect("worker join"),
            Err(BrowseError::StalePublication)
        );
        browse.validate_page(&fresh).expect("fresh page current");
    }

    #[test]
    fn change_arriving_during_refresh_supersedes_page_and_is_not_lost() {
        let (fixture, browse, session, monitor) = monitor_fixture();
        fs::write(fixture.root.join("second.txt"), b"second").expect("second fixture file");
        let old = browse
            .start_enumeration(&session.session_id, "old", &session.root_path_ref, 1)
            .expect("old page");
        monitor.inject_hint(EphemeralChangeKind::ContentChanged);

        let gate = Arc::new(TestPublishGate::default());
        browse.set_test_publish_gate(Arc::clone(&gate));
        let monitor = Arc::new(monitor);
        let monitor_for_worker = Arc::clone(&monitor);
        let worker = thread::spawn(move || monitor_for_worker.refresh("refresh-racing", 1));

        gate.wait_until_reached();
        monitor.inject_hint(EphemeralChangeKind::Renamed);
        gate.release();

        assert_eq!(
            worker.join().expect("refresh worker join"),
            Err(EphemeralChangeError::RefreshSuperseded)
        );
        assert_eq!(
            monitor
                .pending_refresh()
                .expect("second change stays pending")
                .hint
                .kind,
            EphemeralChangeKind::Renamed
        );

        let fresh = monitor
            .refresh("refresh-after-race", 1)
            .expect("generation-stable refresh");
        assert_ne!(old.enumeration_id, fresh.enumeration_id);
        browse.validate_page(&fresh).expect("fresh page current");
        assert!(monitor.pending_refresh().is_none());
    }

    #[test]
    fn dispose_releases_worker_and_blocks_later_publication() {
        let (_fixture, browse, session, monitor) = monitor_fixture();
        let page = browse
            .start_enumeration(&session.session_id, "current", &session.root_path_ref, 8)
            .expect("page");
        monitor.dispose();
        monitor.inject_hint(EphemeralChangeKind::ContentChanged);

        assert!(monitor.worker_finished());
        assert!(monitor.pending_refresh().is_none());
        assert_eq!(
            browse.validate_page(&page),
            Err(BrowseError::StaleEnumeration)
        );
        assert_eq!(
            monitor.refresh("after-dispose", 8),
            Err(EphemeralChangeError::Disposed)
        );
    }

    #[test]
    fn unavailable_target_refresh_fails_closed_without_mass_deletion() {
        let (fixture, browse, session, monitor) = monitor_fixture();
        let page = browse
            .start_enumeration(&session.session_id, "current", &session.root_path_ref, 8)
            .expect("page");
        monitor.inject_hint(EphemeralChangeKind::TargetUnavailable);
        fs::remove_dir_all(&fixture.root).expect("remove current target");

        assert_eq!(
            browse.validate_page(&page),
            Err(BrowseError::StaleEnumeration)
        );
        assert_eq!(
            monitor.refresh("unavailable", 8),
            Err(EphemeralChangeError::Browse(BrowseError::DirectoryNotFound))
        );
    }

    #[test]
    fn bounded_paths_do_not_leak_from_hints_or_refresh_requests() {
        let (_fixture, _browse, _session, monitor) = monitor_fixture();
        monitor.inject_hint(EphemeralChangeKind::Uncertain);
        let debug = format!("{:?}", monitor.pending_refresh().expect("request"));
        assert!(!debug.contains("ephemeral-change"));
        assert!(!debug.contains("\\"));
    }
}
