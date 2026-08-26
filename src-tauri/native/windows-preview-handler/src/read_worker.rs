use std::{
    sync::{Arc, Condvar, Mutex, OnceLock},
    thread,
    time::{Duration, Instant},
};

use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_MULTITHREADED};
use zen_canvas_native_host::{
    BoundedContentRead, HostProvidedError, HostProvidedReadRequest, HostProvidedRegistry,
};

/// Completion is deliberately detached from the COM handler object. A worker
/// may outlive `Unload`, but it must never retain a handler/interface/HWND
/// reference or call back into the owner STA.
pub(crate) struct ReadCompletion {
    result: Mutex<Option<Result<BoundedContentRead, HostProvidedError>>>,
}

impl ReadCompletion {
    pub(crate) fn new() -> Arc<Self> {
        Arc::new(Self {
            result: Mutex::new(None),
        })
    }

    pub(crate) fn take(&self) -> Option<Result<BoundedContentRead, HostProvidedError>> {
        lock(&self.result).take()
    }

    fn complete(&self, result: Result<BoundedContentRead, HostProvidedError>) {
        *lock(&self.result) = Some(result);
    }
}

/// A per-request observation point used by the external harness. It is also
/// the exact boundary immediately before the worker invokes `IStream::Seek`.
pub(crate) struct ReadObservation {
    entered: Mutex<bool>,
    changed: Condvar,
}

impl ReadObservation {
    pub(crate) fn new() -> Arc<Self> {
        Arc::new(Self {
            entered: Mutex::new(false),
            changed: Condvar::new(),
        })
    }

    pub(crate) fn mark_entered(&self) {
        *lock(&self.entered) = true;
        self.changed.notify_all();
    }

    fn wait_until_entered(&self, timeout: Duration) -> bool {
        let deadline = Instant::now() + timeout;
        let mut entered = lock(&self.entered);
        while !*entered {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return false;
            }
            let (next, result) = self
                .changed
                .wait_timeout(entered, remaining)
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            entered = next;
            if result.timed_out() && !*entered {
                return false;
            }
        }
        true
    }
}

#[derive(Default)]
struct WorkerState {
    active: usize,
    current_observation: Option<Arc<ReadObservation>>,
    cancelled_count: u32,
    last_cancelled: bool,
}

struct WorkerTracker {
    state: Mutex<WorkerState>,
    changed: Condvar,
}

impl WorkerTracker {
    fn new() -> Self {
        Self {
            state: Mutex::new(WorkerState::default()),
            changed: Condvar::new(),
        }
    }
}

static WORKERS: OnceLock<WorkerTracker> = OnceLock::new();

fn workers() -> &'static WorkerTracker {
    WORKERS.get_or_init(WorkerTracker::new)
}

pub(crate) fn new_observation() -> Arc<ReadObservation> {
    let observation = ReadObservation::new();
    lock(&workers().state).current_observation = Some(Arc::clone(&observation));
    observation
}

pub(crate) fn discard_observation(observation: &Arc<ReadObservation>) {
    let mut state = lock(&workers().state);
    if state
        .current_observation
        .as_ref()
        .is_some_and(|current| Arc::ptr_eq(current, observation))
    {
        state.current_observation = None;
    }
}

pub(crate) fn spawn_bounded_read(
    registry: Arc<HostProvidedRegistry>,
    request: HostProvidedReadRequest,
    observation: Arc<ReadObservation>,
    completion: Arc<ReadCompletion>,
) -> std::io::Result<()> {
    worker_started();
    let observation_for_spawn_failure = Arc::clone(&observation);
    let spawned = thread::Builder::new()
        .name("zen-preview-handler-read".to_string())
        .spawn(move || {
            let mut worker = WorkerGuard::new(Arc::clone(&observation));
            let result = match ComApartment::initialize() {
                Some(_com) => registry.read(&request),
                None => Err(HostProvidedError::Failed),
            };
            let cancelled = matches!(
                result,
                Err(HostProvidedError::Cancelled
                    | HostProvidedError::Disposed
                    | HostProvidedError::InvalidOrStale)
            );
            completion.complete(result);
            // Keep the observation alive until the read result has been
            // classified, then release all request-local worker state.
            drop(observation);
            worker.finish(cancelled);
        });
    match spawned {
        Ok(_) => Ok(()),
        Err(error) => {
            // The closure creates its guard only after the OS thread starts.
            // Account for a rejected spawn here so DllCanUnloadNow never
            // observes a detached worker as already quiescent.
            worker_finished(false, Some(&observation_for_spawn_failure));
            Err(error)
        }
    }
}

pub(crate) fn active_count() -> usize {
    lock(&workers().state).active
}

#[cfg(any(test, feature = "test-observability"))]
pub(crate) fn wait_for_read_entered(timeout: Duration) -> bool {
    let observation = lock(&workers().state).current_observation.clone();
    observation.is_some_and(|observation| observation.wait_until_entered(timeout))
}

#[cfg(any(test, feature = "test-observability"))]
pub(crate) fn wait_for_quiescence(timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;
    let mut state = lock(&workers().state);
    while state.active != 0 {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            return false;
        }
        let (next, result) = workers()
            .changed
            .wait_timeout(state, remaining)
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        state = next;
        if result.timed_out() && state.active != 0 {
            return false;
        }
    }
    true
}

#[cfg(any(test, feature = "test-observability"))]
pub(crate) fn cancelled_count() -> u32 {
    lock(&workers().state).cancelled_count
}

#[cfg(any(test, feature = "test-observability"))]
pub(crate) fn last_cancelled() -> bool {
    lock(&workers().state).last_cancelled
}

fn worker_started() {
    lock(&workers().state).active += 1;
}

fn worker_finished(cancelled: bool, observation: Option<&Arc<ReadObservation>>) {
    let mut state = lock(&workers().state);
    state.active = state.active.saturating_sub(1);
    if observation.is_some_and(|observation| {
        state
            .current_observation
            .as_ref()
            .is_some_and(|current| Arc::ptr_eq(current, observation))
    }) {
        state.current_observation = None;
    }
    state.last_cancelled = cancelled;
    if cancelled {
        state.cancelled_count = state.cancelled_count.saturating_add(1);
    }
    workers().changed.notify_all();
}

struct WorkerGuard {
    finished: bool,
    observation: Arc<ReadObservation>,
}

impl WorkerGuard {
    fn new(observation: Arc<ReadObservation>) -> Self {
        Self {
            finished: false,
            observation,
        }
    }

    fn finish(&mut self, cancelled: bool) {
        if !self.finished {
            self.finished = true;
            worker_finished(cancelled, Some(&self.observation));
        }
    }
}

impl Drop for WorkerGuard {
    fn drop(&mut self) {
        if !self.finished {
            worker_finished(false, Some(&self.observation));
        }
    }
}

struct ComApartment;

impl ComApartment {
    fn initialize() -> Option<Self> {
        let status = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
        status.is_ok().then_some(Self)
    }
}

impl Drop for ComApartment {
    fn drop(&mut self) {
        unsafe { CoUninitialize() };
    }
}

fn lock<T>(value: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    value
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}
