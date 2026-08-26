use std::{
    sync::{
        atomic::{AtomicU32, Ordering},
        Arc, Condvar, Mutex, OnceLock,
    },
    thread,
    time::{Duration, Instant},
};

#[cfg(feature = "test-observability")]
use std::sync::atomic::AtomicI32;

use windows::Win32::System::{
    Com::{
        CoCancelCall, CoDisableCallCancellation, CoEnableCallCancellation, CoInitializeEx,
        CoUninitialize, COINIT_MULTITHREADED,
    },
    Threading::GetCurrentThreadId,
};
use zen_canvas_native_host::{
    BoundedContentRead, HostProvidedError, HostProvidedReadRequest, HostProvidedRegistry,
};

/// Completion is deliberately detached from the COM handler object. A worker
/// may outlive `Unload`, but it must never retain a handler/interface/HWND
/// reference or call back into the owner STA.
pub(crate) struct ReadCompletion {
    notification_id: u32,
    result: Mutex<Option<Result<BoundedContentRead, HostProvidedError>>>,
}

static NEXT_NOTIFICATION_ID: AtomicU32 = AtomicU32::new(1);

#[cfg(feature = "test-observability")]
#[derive(Default)]
struct TestPauseState {
    armed: bool,
    entered: bool,
    released: bool,
}

#[cfg(feature = "test-observability")]
struct TestPause {
    state: Mutex<TestPauseState>,
    changed: Condvar,
}

#[cfg(feature = "test-observability")]
impl TestPause {
    fn new() -> Self {
        Self {
            state: Mutex::new(TestPauseState::default()),
            changed: Condvar::new(),
        }
    }

    fn arm(&self) {
        *lock(&self.state) = TestPauseState {
            armed: true,
            entered: false,
            released: false,
        };
    }

    fn wait_if_armed(&self) {
        let mut state = lock(&self.state);
        if !state.armed {
            return;
        }
        state.entered = true;
        self.changed.notify_all();
        while !state.released {
            state = self
                .changed
                .wait(state)
                .unwrap_or_else(|poisoned| poisoned.into_inner());
        }
        state.armed = false;
    }

    fn wait_until_entered(&self, timeout: Duration) -> bool {
        let deadline = Instant::now() + timeout;
        let mut state = lock(&self.state);
        while !state.entered {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return false;
            }
            let (next, result) = self
                .changed
                .wait_timeout(state, remaining)
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            state = next;
            if result.timed_out() && !state.entered {
                return false;
            }
        }
        true
    }

    fn release(&self) {
        let mut state = lock(&self.state);
        state.released = true;
        self.changed.notify_all();
    }
}

#[cfg(feature = "test-observability")]
static BEFORE_STREAM_OPERATIONS: OnceLock<TestPause> = OnceLock::new();

#[cfg(feature = "test-observability")]
static AFTER_SEEK: OnceLock<TestPause> = OnceLock::new();

#[cfg(feature = "test-observability")]
static CANCEL_CALL_COUNT: AtomicU32 = AtomicU32::new(0);

#[cfg(feature = "test-observability")]
static FIRST_CANCEL_HRESULT: AtomicI32 = AtomicI32::new(0);

#[cfg(feature = "test-observability")]
static LAST_CANCEL_HRESULT: AtomicI32 = AtomicI32::new(0);

#[cfg(feature = "test-observability")]
fn before_stream_operations() -> &'static TestPause {
    BEFORE_STREAM_OPERATIONS.get_or_init(TestPause::new)
}

#[cfg(feature = "test-observability")]
fn after_seek() -> &'static TestPause {
    AFTER_SEEK.get_or_init(TestPause::new)
}

#[cfg(feature = "test-observability")]
pub(crate) fn arm_before_stream_operations() {
    before_stream_operations().arm();
}

#[cfg(feature = "test-observability")]
pub(crate) fn wait_for_before_stream_operations(timeout: Duration) -> bool {
    before_stream_operations().wait_until_entered(timeout)
}

#[cfg(feature = "test-observability")]
pub(crate) fn release_before_stream_operations() {
    before_stream_operations().release();
}

#[cfg(feature = "test-observability")]
pub(crate) fn pause_before_stream_operations_if_armed() {
    before_stream_operations().wait_if_armed();
}

#[cfg(feature = "test-observability")]
pub(crate) fn arm_after_seek() {
    after_seek().arm();
}

#[cfg(feature = "test-observability")]
pub(crate) fn wait_for_after_seek(timeout: Duration) -> bool {
    after_seek().wait_until_entered(timeout)
}

#[cfg(feature = "test-observability")]
pub(crate) fn release_after_seek() {
    after_seek().release();
}

#[cfg(feature = "test-observability")]
pub(crate) fn pause_after_seek_if_armed() {
    after_seek().wait_if_armed();
}

#[cfg(feature = "test-observability")]
fn record_cancel_hresult(status: i32) {
    let previous = CANCEL_CALL_COUNT.fetch_add(1, Ordering::AcqRel);
    if previous == 0 {
        FIRST_CANCEL_HRESULT.store(status, Ordering::Release);
    }
    LAST_CANCEL_HRESULT.store(status, Ordering::Release);
}

#[cfg(feature = "test-observability")]
pub(crate) fn reset_cancel_observation() {
    CANCEL_CALL_COUNT.store(0, Ordering::Release);
    FIRST_CANCEL_HRESULT.store(0, Ordering::Release);
    LAST_CANCEL_HRESULT.store(0, Ordering::Release);
}

#[cfg(feature = "test-observability")]
pub(crate) fn cancel_call_count() -> u32 {
    CANCEL_CALL_COUNT.load(Ordering::Acquire)
}

#[cfg(feature = "test-observability")]
pub(crate) fn first_cancel_hresult() -> i32 {
    FIRST_CANCEL_HRESULT.load(Ordering::Acquire)
}

#[cfg(feature = "test-observability")]
pub(crate) fn last_cancel_hresult() -> i32 {
    LAST_CANCEL_HRESULT.load(Ordering::Acquire)
}

impl ReadCompletion {
    pub(crate) fn new() -> Arc<Self> {
        Arc::new(Self {
            notification_id: NEXT_NOTIFICATION_ID.fetch_add(1, Ordering::Relaxed),
            result: Mutex::new(None),
        })
    }

    pub(crate) fn notification_id(&self) -> u32 {
        self.notification_id
    }

    pub(crate) fn take(&self) -> Option<Result<BoundedContentRead, HostProvidedError>> {
        lock(&self.result).take()
    }

    fn complete(&self, result: Result<BoundedContentRead, HostProvidedError>) {
        *lock(&self.result) = Some(result);
    }
}

#[derive(Default)]
struct CancellationState {
    thread_id: u32,
    call_active: bool,
    cancel_requested: bool,
    completed: bool,
}

/// Controls one worker's outbound COM call. The owner STA records the cancel
/// request and targets the worker OS thread with `CoCancelCall`; the worker
/// enables call cancellation before entering the HostProvided read. The
/// handler object and its owner-only state never cross this boundary.
pub(crate) struct WorkerCancellation {
    state: Mutex<CancellationState>,
}

impl WorkerCancellation {
    pub(crate) fn new() -> Arc<Self> {
        Arc::new(Self {
            state: Mutex::new(CancellationState::default()),
        })
    }

    pub(crate) fn request_cancel(&self) {
        let thread_id = {
            let mut state = lock(&self.state);
            if state.completed {
                0
            } else {
                state.cancel_requested = true;
                if state.call_active {
                    state.thread_id
                } else {
                    0
                }
            }
        };
        if thread_id != 0 {
            // A zero timeout issues the cancellation request without making
            // the owner STA wait for the remote call to finish. The worker
            // remains counted until its COM call and apartment have really
            // quiesced.
            let result = unsafe { CoCancelCall(thread_id, 0) };
            #[cfg(feature = "test-observability")]
            record_cancel_hresult(result.as_ref().err().map_or(0, |error| error.code().0));
            #[cfg(not(feature = "test-observability"))]
            let _ = result;
        }
    }

    fn register_thread(&self, thread_id: u32) -> bool {
        let mut state = lock(&self.state);
        state.thread_id = thread_id;
        !state.cancel_requested && !state.completed
    }

    fn begin_call(&self) -> bool {
        let mut state = lock(&self.state);
        if state.cancel_requested || state.completed {
            return false;
        }
        state.call_active = true;
        true
    }

    fn end_call(&self) {
        lock(&self.state).call_active = false;
    }

    fn complete(&self) {
        let mut state = lock(&self.state);
        state.call_active = false;
        state.thread_id = 0;
        state.completed = true;
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

    #[allow(dead_code)]
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
    completion_target: isize,
    cancellation: Arc<WorkerCancellation>,
) -> std::io::Result<()> {
    worker_started();
    let observation_for_spawn_failure = Arc::clone(&observation);
    let spawned = thread::Builder::new()
        .name("zen-preview-handler-read".to_string())
        .spawn(move || {
            let mut worker = WorkerGuard::new(Arc::clone(&observation));
            let result = match ComApartment::initialize() {
                Some(_com) => match CallCancellation::enable() {
                    Ok(call_cancellation) => {
                        let thread_id = unsafe { GetCurrentThreadId() };
                        let registered = cancellation.register_thread(thread_id);
                        let began = registered && cancellation.begin_call();
                        let can_read = began;
                        let result = if can_read {
                            let result = registry.read(&request);
                            cancellation.end_call();
                            result
                        } else {
                            Err(HostProvidedError::Cancelled)
                        };
                        cancellation.complete();
                        drop(call_cancellation);
                        result
                    }
                    Err(_) => {
                        cancellation.complete();
                        Err(HostProvidedError::Failed)
                    }
                },
                None => {
                    cancellation.complete();
                    Err(HostProvidedError::Failed)
                }
            };
            let cancelled = matches!(
                result,
                Err(HostProvidedError::Cancelled
                    | HostProvidedError::Disposed
                    | HostProvidedError::InvalidOrStale)
            );
            completion.complete(result);
            crate::completion::post_completion(completion_target, completion.notification_id());
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
#[allow(dead_code)]
pub(crate) fn wait_for_read_entered(timeout: Duration) -> bool {
    let observation = lock(&workers().state).current_observation.clone();
    observation.is_some_and(|observation| observation.wait_until_entered(timeout))
}

#[cfg(any(test, feature = "test-observability"))]
#[allow(dead_code)]
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
#[allow(dead_code)]
pub(crate) fn cancelled_count() -> u32 {
    lock(&workers().state).cancelled_count
}

#[cfg(any(test, feature = "test-observability"))]
#[allow(dead_code)]
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

struct CallCancellation;

impl CallCancellation {
    fn enable() -> windows::core::Result<Self> {
        unsafe { CoEnableCallCancellation(None)? };
        Ok(Self)
    }
}

impl Drop for CallCancellation {
    fn drop(&mut self) {
        unsafe {
            let _ = CoDisableCallCancellation(None);
        }
    }
}

fn lock<T>(value: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    value
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}
