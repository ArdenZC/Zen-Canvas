//! W1-08 bounded, headless thumbnail infrastructure.
//!
//! This module owns disposable request coordination and bounded cache
//! projections only.  Source resolution and byte authorization remain owned
//! by W1-07 `MaterializationReadGate`; the renderer boundary never receives a
//! renderer-authorized filesystem path.

use super::{
    contracts::{ContentReadLeaseRef, EntryRef, PreviewSourceRef, WorkClass},
    preview::{
        BoundedContentRead, BoundedContentReadRequest, ContentReadAccessError,
        ContentReadLeaseConsumer, PreviewCancellation, PreviewOperationContext,
    },
    read_gate::{MaterializationReadGate, ReadGateError},
};
use crate::scheduler::{
    AcquireError, CancellationToken, ResourceHints, WorkRequest, WorkScheduler,
};
use std::{
    collections::{HashMap, VecDeque},
    fmt, fs,
    io::{self, Write},
    panic::{catch_unwind, AssertUnwindSafe},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{self, Receiver, SyncSender},
        Arc, Condvar, Mutex, MutexGuard, Weak,
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};
use thiserror::Error;

#[cfg(test)]
use std::sync::atomic::AtomicUsize;

const MAX_OPAQUE_ID_LENGTH: usize = 256;
const DEFAULT_MEMORY_MAX_ENTRIES: usize = 128;
const DEFAULT_MEMORY_MAX_BYTES: u64 = 32 * 1024 * 1024;
const DEFAULT_DISK_MAX_ENTRIES: usize = 256;
const DEFAULT_DISK_MAX_BYTES: u64 = 128 * 1024 * 1024;
const DEFAULT_WORKERS: usize = 2;
const DEFAULT_QUEUE_CAPACITY: usize = 32;
const DEFAULT_MAX_OWNERS_PER_GENERATION: usize = 32;
const DEFAULT_MAX_SOURCE_BYTES: u64 = 256 * 1024 * 1024;
const DEFAULT_MAX_OUTPUT_BYTES: u64 = 16 * 1024 * 1024;
const DEFAULT_GENERATION_TIMEOUT: Duration = Duration::from_secs(10);
const READ_CHUNK_BYTES: u32 = 1024 * 1024;

/// One backend policy location for thumbnail physical dimensions.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ThumbnailVariant {
    Small,
    Medium,
    Large,
}

impl ThumbnailVariant {
    pub const fn pixels(self) -> u32 {
        match self {
            Self::Small => 96,
            Self::Medium => 256,
            Self::Large => 512,
        }
    }

    pub const fn is_bounded(self) -> bool {
        self.pixels() <= 1024
    }
}

/// A backend-authorized thumbnail request.  `source` is an opaque W1
/// `EntryRef`; it is never interpreted as a path.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ThumbnailRequest {
    pub request_id: String,
    pub source: EntryRef,
    pub variant: ThumbnailVariant,
    pub work_class: WorkClass,
    pub session_id: Option<String>,
    pub source_generation: Option<String>,
}

impl ThumbnailRequest {
    pub fn new(
        request_id: impl Into<String>,
        source: EntryRef,
        variant: ThumbnailVariant,
        work_class: WorkClass,
    ) -> Self {
        Self {
            request_id: request_id.into(),
            source,
            variant,
            work_class,
            session_id: None,
            source_generation: None,
        }
    }

    pub fn with_session_id(mut self, session_id: impl Into<String>) -> Self {
        self.session_id = Some(session_id.into());
        self
    }

    pub fn with_source_generation(mut self, generation: impl Into<String>) -> Self {
        self.source_generation = Some(generation.into());
        self
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ThumbnailRendererDescriptor {
    pub id: String,
    pub version: String,
    pub resources: ResourceHints,
}

impl ThumbnailRendererDescriptor {
    pub fn new(
        id: impl Into<String>,
        version: impl Into<String>,
        resources: ResourceHints,
    ) -> Self {
        Self {
            id: id.into(),
            version: version.into(),
            resources,
        }
    }
}

/// A provider receives only opaque source metadata and this bounded reader.
/// It has no path, URL, handle or provider identity with which it could bypass
/// W1-07.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ThumbnailRenderRequest {
    pub request_id: String,
    pub source: PreviewSourceRef,
    pub variant: ThumbnailVariant,
    pub source_version: String,
    pub cache_key: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ThumbnailRenderOutput {
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Error)]
pub enum ThumbnailRendererError {
    #[error("thumbnail renderer is unsupported")]
    UnsupportedRenderer,
    #[error("thumbnail source is unsupported")]
    UnsupportedSource,
    #[error("thumbnail source requires materialization")]
    MaterializationRequired,
    #[error("thumbnail source is unavailable")]
    SourceUnavailable,
    #[error("thumbnail permission was denied")]
    PermissionDenied,
    #[error("thumbnail source identity changed")]
    IdentityChanged,
    #[error("thumbnail rendering was cancelled")]
    Cancelled,
    #[error("thumbnail rendering timed out")]
    Timeout,
    #[error("thumbnail renderer failed")]
    Failed,
}

/// Renderer/provider adapter contract.  Any byte-consuming implementation
/// must use `ThumbnailRenderContext::read_bounded` or
/// `read_all_bounded`; those methods are backed by W1-07.
pub trait ThumbnailRenderer: Send + Sync {
    fn descriptor(&self) -> ThumbnailRendererDescriptor;

    fn render(
        &self,
        request: ThumbnailRenderRequest,
        context: &ThumbnailRenderContext,
    ) -> Result<ThumbnailRenderOutput, ThumbnailRendererError>;
}

/// The only source-read seam exposed to thumbnail renderers.
pub trait ThumbnailReadGate: Send + Sync {
    fn current_source_version(&self, source: &PreviewSourceRef) -> Result<String, ReadGateError>;

    fn issue_thumbnail_lease(
        &self,
        request_id: &str,
        source: PreviewSourceRef,
    ) -> Result<ContentReadLeaseRef, ReadGateError>;

    fn read_bounded(
        &self,
        lease: &ContentReadLeaseRef,
        request: BoundedContentReadRequest,
        operation: ThumbnailReadOperation<'_>,
    ) -> Result<BoundedContentRead, ContentReadAccessError>;

    fn release_lease(&self, lease: &ContentReadLeaseRef) -> Result<(), ReadGateError>;

    /// A backend-derived leaf name is a display/extension hint only.  It is
    /// never used as source authorization.
    fn source_file_name(&self, _source: &PreviewSourceRef) -> Option<String> {
        None
    }
}

pub struct ThumbnailReadOperation<'a> {
    pub request_id: &'a str,
    pub session_id: Option<&'a str>,
    pub source_version: &'a str,
    pub cancellation: &'a PreviewCancellation,
    pub deadline: Instant,
}

impl ThumbnailReadGate for MaterializationReadGate {
    fn current_source_version(&self, source: &PreviewSourceRef) -> Result<String, ReadGateError> {
        MaterializationReadGate::current_source_version(self, source)
    }

    fn issue_thumbnail_lease(
        &self,
        request_id: &str,
        source: PreviewSourceRef,
    ) -> Result<ContentReadLeaseRef, ReadGateError> {
        self.issue_lease_for_current(request_id, source, super::read_gate::ReadIntent::Thumbnail)
    }

    fn read_bounded(
        &self,
        lease: &ContentReadLeaseRef,
        request: BoundedContentReadRequest,
        operation: ThumbnailReadOperation<'_>,
    ) -> Result<BoundedContentRead, ContentReadAccessError> {
        let operation = PreviewOperationContext::for_backend_content_read(
            operation.session_id.unwrap_or(operation.request_id),
            operation.request_id,
            operation.source_version,
            operation.cancellation.clone(),
            operation.deadline,
        );
        ContentReadLeaseConsumer::read_bounded(self, lease, request, &operation)
    }

    fn release_lease(&self, lease: &ContentReadLeaseRef) -> Result<(), ReadGateError> {
        MaterializationReadGate::release_lease(self, lease)
    }

    fn source_file_name(&self, source: &PreviewSourceRef) -> Option<String> {
        MaterializationReadGate::source_file_name(self, source)
    }
}

/// Context passed to one renderer invocation.  All reads are bounded and
/// revalidated by the injected W1-07 gate.
pub struct ThumbnailRenderContext {
    gate: Arc<dyn ThumbnailReadGate>,
    lease: ContentReadLeaseRef,
    request_id: String,
    session_id: Option<String>,
    source: PreviewSourceRef,
    source_version: String,
    cache_key: String,
    source_name: Option<String>,
    max_source_bytes: u64,
    remaining_source_budget: std::sync::atomic::AtomicU64,
    scheduler_cancellation: CancellationToken,
    cancellation: PreviewCancellation,
    deadline: Instant,
}

impl ThumbnailRenderContext {
    pub fn read_bounded(
        &self,
        offset_bytes: u64,
        max_bytes: u32,
    ) -> Result<BoundedContentRead, ThumbnailRendererError> {
        self.ensure_active()?;
        if max_bytes == 0 {
            return Err(ThumbnailRendererError::Failed);
        }
        let requested_bytes = u64::from(max_bytes);
        let mut remaining = self.remaining_source_budget.load(Ordering::Acquire);
        loop {
            if requested_bytes > remaining {
                return Err(ThumbnailRendererError::Failed);
            }
            match self.remaining_source_budget.compare_exchange(
                remaining,
                remaining - requested_bytes,
                Ordering::AcqRel,
                Ordering::Acquire,
            ) {
                Ok(_) => break,
                Err(current) => remaining = current,
            }
        }
        let result = self.gate.read_bounded(
            &self.lease,
            BoundedContentReadRequest {
                offset_bytes,
                max_bytes,
            },
            ThumbnailReadOperation {
                request_id: &self.request_id,
                session_id: self.session_id.as_deref(),
                source_version: &self.source_version,
                cancellation: &self.cancellation,
                deadline: self.deadline,
            },
        );
        let result = result.map_err(|error| {
            self.remaining_source_budget
                .fetch_add(requested_bytes, Ordering::AcqRel);
            map_content_read_error(error)
        })?;
        let unused_bytes = requested_bytes.saturating_sub(result.bytes.len() as u64);
        if unused_bytes > 0 {
            self.remaining_source_budget
                .fetch_add(unused_bytes, Ordering::AcqRel);
        }
        self.ensure_active()?;
        Ok(result)
    }

    pub fn read_all_bounded(
        &self,
        max_total_bytes: u64,
    ) -> Result<Vec<u8>, ThumbnailRendererError> {
        let max_total_bytes = max_total_bytes.min(self.max_source_bytes);
        if max_total_bytes == 0 {
            return Err(ThumbnailRendererError::Failed);
        }
        let mut offset = 0_u64;
        let mut bytes = Vec::new();
        loop {
            self.ensure_active()?;
            let remaining = max_total_bytes.saturating_sub(bytes.len() as u64);
            if remaining == 0 {
                return Err(ThumbnailRendererError::Failed);
            }
            let chunk = remaining.min(u64::from(READ_CHUNK_BYTES)) as u32;
            let read = self.read_bounded(offset, chunk)?;
            bytes.extend_from_slice(&read.bytes);
            if read.complete {
                return Ok(bytes);
            }
            if read.bytes.is_empty() {
                return Err(ThumbnailRendererError::Failed);
            }
            offset = offset
                .checked_add(read.bytes.len() as u64)
                .ok_or(ThumbnailRendererError::Failed)?;
        }
    }

    pub fn source_file_name(&self) -> Option<&str> {
        self.source_name.as_deref()
    }

    pub fn source(&self) -> &PreviewSourceRef {
        &self.source
    }

    pub fn source_version(&self) -> &str {
        &self.source_version
    }

    pub fn cache_key(&self) -> &str {
        &self.cache_key
    }

    pub fn is_cancelled(&self) -> bool {
        self.is_explicitly_cancelled() || self.deadline_exceeded()
    }

    pub fn is_explicitly_cancelled(&self) -> bool {
        self.scheduler_cancellation.is_cancelled() || self.cancellation.is_cancelled()
    }

    pub fn deadline_exceeded(&self) -> bool {
        Instant::now() >= self.deadline
    }

    pub fn remaining(&self) -> Duration {
        self.deadline.saturating_duration_since(Instant::now())
    }

    pub fn ensure_active(&self) -> Result<(), ThumbnailRendererError> {
        if self.scheduler_cancellation.is_cancelled() || self.cancellation.is_cancelled() {
            return Err(ThumbnailRendererError::Cancelled);
        }
        if Instant::now() >= self.deadline {
            return Err(ThumbnailRendererError::Timeout);
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ThumbnailArtifact {
    /// Logical cache key only; this is not a filesystem path or authorization.
    pub cache_key: String,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Error)]
pub enum ThumbnailError {
    #[error("thumbnail request is invalid")]
    InvalidRequest,
    #[error("thumbnail renderer is unsupported")]
    UnsupportedRenderer,
    #[error("thumbnail source is unsupported")]
    UnsupportedSource,
    #[error("thumbnail source requires materialization")]
    MaterializationRequired,
    #[error("thumbnail source is downloading")]
    Downloading,
    #[error("thumbnail source is unavailable")]
    SourceUnavailable,
    #[error("thumbnail permission was denied")]
    PermissionDenied,
    #[error("thumbnail source availability is unknown")]
    UnknownSource,
    #[error("thumbnail source identity changed")]
    IdentityChanged,
    #[error("thumbnail scheduler is under backpressure")]
    SchedulerBackpressure,
    #[error("thumbnail scheduler is unavailable")]
    SchedulerUnavailable,
    #[error("thumbnail request was cancelled")]
    Cancelled,
    #[error("thumbnail generation timed out")]
    Timeout,
    #[error("thumbnail renderer failed")]
    RendererFailed,
    #[error("thumbnail service is disposed")]
    Disposed,
}

impl From<ThumbnailError> for ThumbnailRendererError {
    fn from(error: ThumbnailError) -> Self {
        match error {
            ThumbnailError::MaterializationRequired => Self::MaterializationRequired,
            ThumbnailError::SourceUnavailable => Self::SourceUnavailable,
            ThumbnailError::PermissionDenied => Self::PermissionDenied,
            ThumbnailError::IdentityChanged => Self::IdentityChanged,
            ThumbnailError::Cancelled => Self::Cancelled,
            ThumbnailError::Timeout => Self::Timeout,
            ThumbnailError::UnsupportedRenderer => Self::UnsupportedRenderer,
            ThumbnailError::UnsupportedSource => Self::UnsupportedSource,
            ThumbnailError::Downloading
            | ThumbnailError::UnknownSource
            | ThumbnailError::InvalidRequest
            | ThumbnailError::SchedulerBackpressure
            | ThumbnailError::SchedulerUnavailable
            | ThumbnailError::RendererFailed
            | ThumbnailError::Disposed => Self::Failed,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum ThumbnailConfigError {
    #[error("thumbnail cache entry capacity must be non-zero")]
    ZeroCacheEntries,
    #[error("thumbnail cache byte capacity must be non-zero")]
    ZeroCacheBytes,
    #[error("thumbnail worker count must be non-zero")]
    ZeroWorkers,
    #[error("thumbnail queue capacity must be non-zero")]
    ZeroQueueCapacity,
    #[error("thumbnail deduplication owner capacity must be non-zero")]
    ZeroOwnerCapacity,
    #[error("thumbnail source/output byte limits must be non-zero")]
    ZeroByteLimit,
    #[error("thumbnail generation timeout is invalid")]
    InvalidTimeout,
    #[error("thumbnail renderer descriptor is invalid")]
    InvalidRenderer,
    #[error("thumbnail cache directory is not safe: {0}")]
    UnsafeCacheDirectory(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ThumbnailServiceConfig {
    pub memory_max_entries: usize,
    pub memory_max_bytes: u64,
    pub disk_max_entries: usize,
    pub disk_max_bytes: u64,
    pub worker_count: usize,
    pub queue_capacity: usize,
    pub max_owners_per_generation: usize,
    pub max_source_bytes: u64,
    pub max_output_bytes: u64,
    pub generation_timeout: Duration,
}

impl Default for ThumbnailServiceConfig {
    fn default() -> Self {
        Self {
            memory_max_entries: DEFAULT_MEMORY_MAX_ENTRIES,
            memory_max_bytes: DEFAULT_MEMORY_MAX_BYTES,
            disk_max_entries: DEFAULT_DISK_MAX_ENTRIES,
            disk_max_bytes: DEFAULT_DISK_MAX_BYTES,
            worker_count: DEFAULT_WORKERS,
            queue_capacity: DEFAULT_QUEUE_CAPACITY,
            max_owners_per_generation: DEFAULT_MAX_OWNERS_PER_GENERATION,
            max_source_bytes: DEFAULT_MAX_SOURCE_BYTES,
            max_output_bytes: DEFAULT_MAX_OUTPUT_BYTES,
            generation_timeout: DEFAULT_GENERATION_TIMEOUT,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
enum CacheIdentity {
    Durable {
        source_identity: String,
        source_version: String,
    },
    Session {
        session_id: String,
        generation: String,
        entry_id: String,
        source_version: String,
    },
}

impl CacheIdentity {
    fn is_durable(&self) -> bool {
        matches!(self, Self::Durable { .. })
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
struct GenerationKey {
    identity: CacheIdentity,
    variant: ThumbnailVariant,
    renderer_id: String,
    renderer_version: String,
}

impl GenerationKey {
    fn logical_key(&self) -> String {
        let identity = match &self.identity {
            CacheIdentity::Durable {
                source_identity,
                source_version,
            } => format!("durable:{source_identity}:{source_version}"),
            CacheIdentity::Session {
                session_id,
                generation,
                entry_id,
                source_version,
            } => format!("session:{session_id}:{generation}:{entry_id}:{source_version}"),
        };
        let material = format!(
            "thumbnail-v1:{identity}:{}:{}:{}",
            self.variant.pixels(),
            self.renderer_id,
            self.renderer_version
        );
        blake3::hash(material.as_bytes()).to_hex().to_string()
    }
}

#[derive(Clone)]
struct GenerationSeed {
    generation_id: u64,
    request: ThumbnailRequest,
    source: PreviewSourceRef,
    source_version: String,
    key: GenerationKey,
    logical_cache_key: String,
    renderer: ThumbnailRendererDescriptor,
    scheduler_cancellation: CancellationToken,
    render_cancellation: PreviewCancellation,
}

struct MemoryCacheEntry {
    artifact: ThumbnailArtifact,
    last_used: u64,
}

struct ThumbnailOwner {
    sender: SyncSender<Result<ThumbnailArtifact, ThumbnailError>>,
    cancelled: Arc<AtomicBool>,
}

struct InFlight {
    seed: GenerationSeed,
    owners: HashMap<u64, ThumbnailOwner>,
    publication: Arc<Mutex<()>>,
}

#[derive(Default)]
struct ThumbnailState {
    memory: HashMap<GenerationKey, MemoryCacheEntry>,
    memory_bytes: u64,
    access_counter: u64,
    next_owner_id: u64,
    next_generation_id: u64,
    inflight: HashMap<GenerationKey, InFlight>,
}

fn lock<T>(value: &Mutex<T>) -> MutexGuard<'_, T> {
    value
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}

struct ThumbnailWorkItem {
    inner: Weak<ThumbnailServiceInner>,
    key: GenerationKey,
    seed: GenerationSeed,
    order: u64,
}

struct ThumbnailExecutorState {
    queue: VecDeque<ThumbnailWorkItem>,
    next_order: u64,
    closed: bool,
}

struct ThumbnailExecutor {
    state: Arc<(Mutex<ThumbnailExecutorState>, Condvar)>,
    queue_capacity: usize,
    workers: Vec<JoinHandle<()>>,
}

impl ThumbnailExecutor {
    fn new(worker_count: usize, queue_capacity: usize) -> Self {
        let state = Arc::new((
            Mutex::new(ThumbnailExecutorState {
                queue: VecDeque::new(),
                next_order: 0,
                closed: false,
            }),
            Condvar::new(),
        ));
        let mut workers = Vec::with_capacity(worker_count);
        for index in 0..worker_count {
            let state = Arc::clone(&state);
            let name = format!("thumbnail-worker-{index}");
            let worker = thread::Builder::new()
                .name(name)
                .spawn(move || loop {
                    let work = {
                        let (queue, changed) = &*state;
                        let mut state = lock(queue);
                        loop {
                            if let Some(index) = state
                                .queue
                                .iter()
                                .enumerate()
                                .min_by_key(|(_, work)| {
                                    (
                                        work_class_priority(work.seed.request.work_class),
                                        work.order,
                                    )
                                })
                                .map(|(index, _)| index)
                            {
                                break state.queue.remove(index);
                            }
                            if state.closed {
                                break None;
                            }
                            state = changed
                                .wait(state)
                                .unwrap_or_else(std::sync::PoisonError::into_inner);
                        }
                    };
                    let Some(work) = work else {
                        break;
                    };
                    if let Some(inner) = work.inner.upgrade() {
                        run_generation(inner, work.key, work.seed);
                    }
                })
                .expect("thumbnail worker must start");
            workers.push(worker);
        }
        Self {
            state,
            queue_capacity,
            workers,
        }
    }

    fn submit(
        &self,
        inner: Weak<ThumbnailServiceInner>,
        key: GenerationKey,
        seed: GenerationSeed,
    ) -> Result<(), ThumbnailError> {
        let (queue, changed) = &*self.state;
        let mut state = lock(queue);
        if state.closed {
            return Err(ThumbnailError::SchedulerUnavailable);
        }
        if state.queue.len() >= self.queue_capacity {
            return Err(ThumbnailError::SchedulerBackpressure);
        }
        state.next_order = state.next_order.wrapping_add(1).max(1);
        let order = state.next_order;
        state.queue.push_back(ThumbnailWorkItem {
            inner,
            key,
            seed,
            order,
        });
        changed.notify_one();
        Ok(())
    }
}

impl Drop for ThumbnailExecutor {
    fn drop(&mut self) {
        let (_, changed) = &*self.state;
        {
            let (queue, _) = &*self.state;
            lock(queue).closed = true;
        }
        changed.notify_all();
        for worker in self.workers.drain(..) {
            let _ = worker.join();
        }
    }
}

fn work_class_priority(class: WorkClass) -> u8 {
    match class {
        WorkClass::Foreground => 0,
        WorkClass::Interactive => 1,
        WorkClass::Background => 2,
    }
}

struct ThumbnailServiceInner {
    gate: Arc<dyn ThumbnailReadGate>,
    scheduler: Arc<WorkScheduler>,
    renderer: Arc<dyn ThumbnailRenderer>,
    renderer_descriptor: ThumbnailRendererDescriptor,
    cache_dir: Option<PathBuf>,
    config: ThumbnailServiceConfig,
    state: Mutex<ThumbnailState>,
    disposed: AtomicBool,
    executor: ThumbnailExecutor,
    #[cfg(test)]
    scheduler_retries: AtomicUsize,
}

/// A disposable, bounded, deduplicating thumbnail service.
#[derive(Clone)]
pub struct ThumbnailService {
    inner: Arc<ThumbnailServiceInner>,
}

struct ThumbnailOwnerControl {
    inner: Weak<ThumbnailServiceInner>,
    key: GenerationKey,
    generation_id: u64,
    owner_id: u64,
    cancelled: Arc<AtomicBool>,
}

/// A one-shot asynchronous thumbnail result.  Dropping a pending task revokes
/// that owner's publication rights.
pub struct ThumbnailTask {
    receiver: Receiver<Result<ThumbnailArtifact, ThumbnailError>>,
    control: Option<Arc<ThumbnailOwnerControl>>,
}

impl fmt::Debug for ThumbnailTask {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("ThumbnailTask")
            .field("pending", &self.control.is_some())
            .finish_non_exhaustive()
    }
}

impl ThumbnailTask {
    pub fn join(self) -> Result<ThumbnailArtifact, ThumbnailError> {
        self.receiver
            .recv()
            .unwrap_or(Err(ThumbnailError::SchedulerUnavailable))
    }

    pub fn cancel(&self) -> bool {
        let Some(control) = self.control.as_ref() else {
            return false;
        };
        if control.cancelled.load(Ordering::Acquire) {
            return false;
        }
        if let Some(inner) = control.inner.upgrade() {
            return cancel_owner(
                &inner,
                &control.key,
                control.generation_id,
                control.owner_id,
                &control.cancelled,
            );
        }
        control.cancelled.store(true, Ordering::Release);
        true
    }
}

impl Drop for ThumbnailTask {
    fn drop(&mut self) {
        if let Some(control) = self.control.as_ref() {
            if control.cancelled.load(Ordering::Acquire) {
                return;
            }
            if let Some(inner) = control.inner.upgrade() {
                let _ = cancel_owner(
                    &inner,
                    &control.key,
                    control.generation_id,
                    control.owner_id,
                    &control.cancelled,
                );
            } else {
                control.cancelled.store(true, Ordering::Release);
            }
        }
    }
}

impl ThumbnailService {
    pub fn new(
        gate: Arc<dyn ThumbnailReadGate>,
        scheduler: Arc<WorkScheduler>,
        renderer: Arc<dyn ThumbnailRenderer>,
        cache_dir: Option<PathBuf>,
        config: ThumbnailServiceConfig,
    ) -> Result<Self, ThumbnailConfigError> {
        validate_config(&config, &*renderer)?;
        if let Some(cache_dir) = cache_dir.as_ref() {
            ensure_cache_dir(cache_dir).map_err(ThumbnailConfigError::UnsafeCacheDirectory)?;
        }
        let renderer_descriptor = renderer.descriptor();
        Ok(Self {
            inner: Arc::new(ThumbnailServiceInner {
                gate,
                scheduler,
                renderer,
                renderer_descriptor,
                cache_dir,
                executor: ThumbnailExecutor::new(config.worker_count, config.queue_capacity),
                config,
                state: Mutex::new(ThumbnailState::default()),
                disposed: AtomicBool::new(false),
                #[cfg(test)]
                scheduler_retries: AtomicUsize::new(0),
            }),
        })
    }

    pub fn request(&self, request: ThumbnailRequest) -> Result<ThumbnailTask, ThumbnailError> {
        if self.inner.disposed.load(Ordering::Acquire) {
            return Err(ThumbnailError::Disposed);
        }
        let prepared = prepare_request(&self.inner, request)?;
        if let Some(artifact) = memory_lookup(&self.inner, &prepared.key) {
            return Ok(ready_task(artifact));
        }
        if prepared.key.identity.is_durable() {
            if let Some(artifact) = disk_lookup(&self.inner, &prepared.key) {
                memory_insert(&self.inner, prepared.key.clone(), artifact.clone());
                return Ok(ready_task(artifact));
            }
        }

        let (sender, receiver) = mpsc::sync_channel(1);
        let owner_cancelled = Arc::new(AtomicBool::new(false));
        let (owner_id, generation_id, submit) = {
            let mut state = lock(&self.inner.state);
            if self.inner.disposed.load(Ordering::Acquire) {
                return Err(ThumbnailError::Disposed);
            }
            state.next_owner_id = state.next_owner_id.wrapping_add(1).max(1);
            let owner_id = state.next_owner_id;
            let (generation_id, seed) =
                if let Some(existing) = state.inflight.get_mut(&prepared.key) {
                    if existing.owners.len() >= self.inner.config.max_owners_per_generation {
                        return Err(ThumbnailError::SchedulerBackpressure);
                    }
                    existing.owners.insert(
                        owner_id,
                        ThumbnailOwner {
                            sender,
                            cancelled: Arc::clone(&owner_cancelled),
                        },
                    );
                    (existing.seed.generation_id, None)
                } else {
                    state.next_generation_id = state.next_generation_id.wrapping_add(1).max(1);
                    let generation_id = state.next_generation_id;
                    let scheduler_cancellation = CancellationToken::new();
                    let render_cancellation = PreviewCancellation::default();
                    let seed = GenerationSeed {
                        generation_id,
                        request: prepared.request.clone(),
                        source: prepared.source.clone(),
                        source_version: prepared.source_version.clone(),
                        key: prepared.key.clone(),
                        logical_cache_key: prepared.logical_cache_key.clone(),
                        renderer: self.inner.renderer_descriptor.clone(),
                        scheduler_cancellation,
                        render_cancellation,
                    };
                    let mut owners = HashMap::new();
                    owners.insert(
                        owner_id,
                        ThumbnailOwner {
                            sender,
                            cancelled: Arc::clone(&owner_cancelled),
                        },
                    );
                    state.inflight.insert(
                        prepared.key.clone(),
                        InFlight {
                            seed: seed.clone(),
                            owners,
                            publication: Arc::new(Mutex::new(())),
                        },
                    );
                    (generation_id, Some(seed))
                };
            (owner_id, generation_id, seed)
        };

        if let Some(seed) = submit {
            if let Err(error) =
                self.inner
                    .executor
                    .submit(Arc::downgrade(&self.inner), prepared.key.clone(), seed)
            {
                fail_submission(&self.inner, &prepared.key, generation_id, owner_id, error);
                return Err(error);
            }
        }

        Ok(ThumbnailTask {
            receiver,
            control: Some(Arc::new(ThumbnailOwnerControl {
                inner: Arc::downgrade(&self.inner),
                key: prepared.key,
                generation_id,
                owner_id,
                cancelled: owner_cancelled,
            })),
        })
    }

    pub fn active_request_count(&self) -> usize {
        lock(&self.inner.state).inflight.len()
    }

    pub fn memory_cache_len(&self) -> usize {
        lock(&self.inner.state).memory.len()
    }

    /// Revoke all in-flight publication rights and dispose process-local
    /// memory state. Durable cache files remain bounded artifacts and are not
    /// removed by ordinary service disposal.
    pub fn dispose(&self) -> bool {
        if self.inner.disposed.swap(true, Ordering::AcqRel) {
            return false;
        }
        let owners = {
            let mut state = lock(&self.inner.state);
            let mut owners = Vec::new();
            for inflight in state.inflight.values() {
                inflight.seed.scheduler_cancellation.cancel();
                inflight.seed.render_cancellation.cancel();
                owners.extend(
                    inflight
                        .owners
                        .values()
                        .map(|owner| (owner.sender.clone(), Arc::clone(&owner.cancelled))),
                );
            }
            state.inflight.clear();
            state.memory.clear();
            state.memory_bytes = 0;
            owners
        };
        for (sender, cancelled) in owners {
            cancelled.store(true, Ordering::Release);
            let _ = sender.send(Err(ThumbnailError::Cancelled));
        }
        true
    }
}

struct PreparedRequest {
    request: ThumbnailRequest,
    source: PreviewSourceRef,
    source_version: String,
    key: GenerationKey,
    logical_cache_key: String,
}

fn validate_config(
    config: &ThumbnailServiceConfig,
    renderer: &dyn ThumbnailRenderer,
) -> Result<(), ThumbnailConfigError> {
    if config.memory_max_entries == 0 || config.disk_max_entries == 0 {
        return Err(ThumbnailConfigError::ZeroCacheEntries);
    }
    if config.memory_max_bytes == 0 || config.disk_max_bytes == 0 {
        return Err(ThumbnailConfigError::ZeroCacheBytes);
    }
    if config.worker_count == 0 {
        return Err(ThumbnailConfigError::ZeroWorkers);
    }
    if config.queue_capacity == 0 {
        return Err(ThumbnailConfigError::ZeroQueueCapacity);
    }
    if config.max_owners_per_generation == 0 {
        return Err(ThumbnailConfigError::ZeroOwnerCapacity);
    }
    if config.max_source_bytes == 0 || config.max_output_bytes == 0 {
        return Err(ThumbnailConfigError::ZeroByteLimit);
    }
    if config.generation_timeout.is_zero() {
        return Err(ThumbnailConfigError::InvalidTimeout);
    }
    let descriptor = renderer.descriptor();
    if descriptor.id.trim().is_empty()
        || descriptor.id.len() > MAX_OPAQUE_ID_LENGTH
        || descriptor.version.trim().is_empty()
        || descriptor.version.len() > MAX_OPAQUE_ID_LENGTH
        || descriptor.resources.is_empty()
    {
        return Err(ThumbnailConfigError::InvalidRenderer);
    }
    Ok(())
}

fn prepare_request(
    inner: &Arc<ThumbnailServiceInner>,
    request: ThumbnailRequest,
) -> Result<PreparedRequest, ThumbnailError> {
    validate_request(&request)?;
    let source = PreviewSourceRef::from(request.source.clone());
    let source_version = inner
        .gate
        .current_source_version(&source)
        .map_err(map_read_gate_error)?;
    let identity = match &request.source {
        EntryRef::Managed { file_id } => CacheIdentity::Durable {
            source_identity: format!("managed:{file_id}"),
            source_version: source_version.clone(),
        },
        EntryRef::Ephemeral {
            browse_session_id,
            entry_id,
        } => CacheIdentity::Session {
            session_id: request
                .session_id
                .clone()
                .unwrap_or_else(|| browse_session_id.clone()),
            generation: request
                .source_generation
                .clone()
                .unwrap_or_else(|| "generation-unknown".to_string()),
            entry_id: entry_id.clone(),
            source_version: source_version.clone(),
        },
    };
    let key = GenerationKey {
        identity,
        variant: request.variant,
        renderer_id: inner.renderer_descriptor.id.clone(),
        renderer_version: inner.renderer_descriptor.version.clone(),
    };
    let logical_cache_key = key.logical_key();
    Ok(PreparedRequest {
        request,
        source,
        source_version,
        key,
        logical_cache_key,
    })
}

fn validate_request(request: &ThumbnailRequest) -> Result<(), ThumbnailError> {
    if !valid_opaque_id(&request.request_id)
        || request.request_id.contains('/')
        || request.request_id.contains('\\')
        || !request.variant.is_bounded()
    {
        return Err(ThumbnailError::InvalidRequest);
    }
    match &request.source {
        EntryRef::Managed { file_id } => {
            if !valid_opaque_id(file_id) || looks_like_path(file_id) {
                return Err(ThumbnailError::InvalidRequest);
            }
        }
        EntryRef::Ephemeral {
            browse_session_id,
            entry_id,
        } => {
            if !valid_opaque_id(browse_session_id)
                || !valid_opaque_id(entry_id)
                || looks_like_path(browse_session_id)
                || looks_like_path(entry_id)
                || request.source_generation.is_none()
            {
                return Err(ThumbnailError::InvalidRequest);
            }
            if request
                .session_id
                .as_deref()
                .is_some_and(|session| session != browse_session_id)
            {
                return Err(ThumbnailError::InvalidRequest);
            }
        }
    }
    for value in [
        request.session_id.as_deref(),
        request.source_generation.as_deref(),
    ]
    .into_iter()
    .flatten()
    {
        if !valid_opaque_id(value) || looks_like_path(value) {
            return Err(ThumbnailError::InvalidRequest);
        }
    }
    Ok(())
}

fn valid_opaque_id(value: &str) -> bool {
    !value.is_empty() && value.len() <= MAX_OPAQUE_ID_LENGTH && !value.contains('\0')
}

fn looks_like_path(value: &str) -> bool {
    value.contains('/') || value.contains('\\') || value.starts_with("C:")
}

fn map_read_gate_error(error: ReadGateError) -> ThumbnailError {
    match error {
        ReadGateError::MaterializationRequired => ThumbnailError::MaterializationRequired,
        ReadGateError::Downloading => ThumbnailError::Downloading,
        ReadGateError::PermissionDenied => ThumbnailError::PermissionDenied,
        ReadGateError::SourceUnavailable => ThumbnailError::SourceUnavailable,
        ReadGateError::IdentityChanged => ThumbnailError::IdentityChanged,
        ReadGateError::AvailabilityUnknown => ThumbnailError::UnknownSource,
        ReadGateError::SourceNotSupported
        | ReadGateError::PackageUnsupported
        | ReadGateError::Symlink
        | ReadGateError::MetadataOnly
        | ReadGateError::LeaseInvalid
        | ReadGateError::InvalidRequest
        | ReadGateError::LeaseCapacityExceeded
        | ReadGateError::Disposed => ThumbnailError::UnsupportedSource,
    }
}

fn map_content_read_error(error: ContentReadAccessError) -> ThumbnailRendererError {
    match error {
        ContentReadAccessError::LeaseInvalid => ThumbnailRendererError::Failed,
        ContentReadAccessError::SourceVersionMismatch => ThumbnailRendererError::IdentityChanged,
        ContentReadAccessError::PermissionDenied => ThumbnailRendererError::PermissionDenied,
        ContentReadAccessError::SourceUnavailable => ThumbnailRendererError::SourceUnavailable,
        ContentReadAccessError::Cancelled => ThumbnailRendererError::Cancelled,
        ContentReadAccessError::TimedOut => ThumbnailRendererError::Timeout,
        ContentReadAccessError::Failed => ThumbnailRendererError::Failed,
    }
}

fn map_acquire_error(error: AcquireError) -> ThumbnailError {
    match error {
        AcquireError::QueueFull | AcquireError::WouldBlock => ThumbnailError::SchedulerBackpressure,
        AcquireError::Cancelled => ThumbnailError::Cancelled,
        AcquireError::Unavailable | AcquireError::PolicyDenied => {
            ThumbnailError::SchedulerUnavailable
        }
        AcquireError::InvalidRequest(_) => ThumbnailError::SchedulerBackpressure,
    }
}

fn ready_task(artifact: ThumbnailArtifact) -> ThumbnailTask {
    let (sender, receiver) = mpsc::sync_channel(1);
    let _ = sender.send(Ok(artifact));
    ThumbnailTask {
        receiver,
        control: None,
    }
}

fn memory_lookup(
    inner: &Arc<ThumbnailServiceInner>,
    key: &GenerationKey,
) -> Option<ThumbnailArtifact> {
    let mut state = lock(&inner.state);
    let access = state.access_counter.wrapping_add(1).max(1);
    state.access_counter = access;
    state.memory.get_mut(key).map(|entry| {
        entry.last_used = access;
        entry.artifact.clone()
    })
}

fn memory_insert(
    inner: &Arc<ThumbnailServiceInner>,
    key: GenerationKey,
    artifact: ThumbnailArtifact,
) {
    let mut state = lock(&inner.state);
    memory_insert_locked(&mut state, &inner.config, key, artifact);
}

fn memory_insert_locked(
    state: &mut ThumbnailState,
    config: &ThumbnailServiceConfig,
    key: GenerationKey,
    artifact: ThumbnailArtifact,
) {
    let size = artifact.bytes.len() as u64;
    if size > config.memory_max_bytes {
        return;
    }
    if let Some(previous) = state.memory.remove(&key) {
        state.memory_bytes = state
            .memory_bytes
            .saturating_sub(previous.artifact.bytes.len() as u64);
    }
    state.access_counter = state.access_counter.wrapping_add(1).max(1);
    let access = state.access_counter;
    state.memory_bytes = state.memory_bytes.saturating_add(size);
    state.memory.insert(
        key,
        MemoryCacheEntry {
            artifact,
            last_used: access,
        },
    );
    while state.memory.len() > config.memory_max_entries
        || state.memory_bytes > config.memory_max_bytes
    {
        let Some(oldest) = state
            .memory
            .iter()
            .min_by_key(|(_, entry)| entry.last_used)
            .map(|(key, _)| key.clone())
        else {
            break;
        };
        if let Some(removed) = state.memory.remove(&oldest) {
            state.memory_bytes = state
                .memory_bytes
                .saturating_sub(removed.artifact.bytes.len() as u64);
        }
    }
}

fn cache_file_path(inner: &ThumbnailServiceInner, key: &GenerationKey) -> Option<PathBuf> {
    inner
        .cache_dir
        .as_ref()
        .map(|root| root.join(format!("{}.thumb", key.logical_key())))
}

fn disk_lookup(
    inner: &Arc<ThumbnailServiceInner>,
    key: &GenerationKey,
) -> Option<ThumbnailArtifact> {
    let path = cache_file_path(inner, key)?;
    let metadata = fs::symlink_metadata(&path).ok()?;
    let max_bytes = inner
        .config
        .disk_max_bytes
        .min(inner.config.max_output_bytes);
    if !is_safe_regular_file(&metadata) || metadata.len() > max_bytes {
        return None;
    }
    let bytes = fs::read(&path).ok()?;
    if bytes.len() as u64 > max_bytes {
        return None;
    }
    Some(ThumbnailArtifact {
        cache_key: key.logical_key(),
        bytes,
    })
}

fn disk_store(inner: &ThumbnailServiceInner, key: &GenerationKey, bytes: &[u8]) -> io::Result<()> {
    let Some(cache_dir) = inner.cache_dir.as_ref() else {
        return Ok(());
    };
    if bytes.len() as u64
        > inner
            .config
            .disk_max_bytes
            .min(inner.config.max_output_bytes)
    {
        return Ok(());
    }
    ensure_cache_dir(cache_dir).map_err(io::Error::other)?;
    let target = cache_dir.join(format!("{}.thumb", key.logical_key()));
    reject_cache_symlink(&target).map_err(io::Error::other)?;
    if let Ok(metadata) = fs::symlink_metadata(&target) {
        if is_safe_regular_file(&metadata)
            && metadata.len()
                <= inner
                    .config
                    .disk_max_bytes
                    .min(inner.config.max_output_bytes)
        {
            return Ok(());
        }
    }
    let pending = cache_dir.join(format!(".pending-thumbnail-{}", uuid::Uuid::new_v4()));
    let result = (|| {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&pending)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        fs::rename(&pending, &target)?;
        Ok::<(), io::Error>(())
    })();
    let _ = fs::remove_file(&pending);
    if result.is_ok() {
        trim_disk_cache(
            cache_dir,
            inner.config.disk_max_entries,
            inner.config.disk_max_bytes,
        );
    }
    result
}

fn trim_disk_cache(cache_dir: &Path, max_entries: usize, max_bytes: u64) {
    let mut entries = fs::read_dir(cache_dir)
        .into_iter()
        .flatten()
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let path = entry.path();
            if path.extension().and_then(|ext| ext.to_str()) != Some("thumb") {
                return None;
            }
            let metadata = fs::symlink_metadata(&path).ok()?;
            if !is_safe_regular_file(&metadata) {
                return None;
            }
            Some((path, metadata.len(), metadata.modified().ok()))
        })
        .collect::<Vec<_>>();
    entries.sort_by_key(|(_, _, modified)| *modified);
    let mut total = 0_u64;
    let mut count = 0_usize;
    for (path, size, _) in entries.into_iter().rev() {
        if count < max_entries && total.saturating_add(size) <= max_bytes {
            total = total.saturating_add(size);
            count += 1;
        } else {
            let _ = fs::remove_file(path);
        }
    }
}

enum GenerationError {
    Retry,
    Final(ThumbnailError),
}

impl From<ThumbnailError> for GenerationError {
    fn from(error: ThumbnailError) -> Self {
        Self::Final(error)
    }
}

fn run_generation(inner: Arc<ThumbnailServiceInner>, key: GenerationKey, seed: GenerationSeed) {
    let result = catch_unwind(AssertUnwindSafe(|| generate(&inner, &seed)))
        .unwrap_or(Err(GenerationError::Final(ThumbnailError::RendererFailed)));
    match result {
        Ok(artifact) => finish_generation(&inner, &key, seed.generation_id, Ok(artifact)),
        Err(GenerationError::Final(error)) => {
            finish_generation(&inner, &key, seed.generation_id, Err(error));
        }
        Err(GenerationError::Retry) => {
            if let Err(error) = resubmit_generation(&inner, &key, &seed) {
                finish_generation(&inner, &key, seed.generation_id, Err(error));
            }
        }
    }
}

fn resubmit_generation(
    inner: &Arc<ThumbnailServiceInner>,
    key: &GenerationKey,
    seed: &GenerationSeed,
) -> Result<(), ThumbnailError> {
    loop {
        if inner.disposed.load(Ordering::Acquire)
            || !has_live_owners(inner, key, seed.generation_id)
        {
            return Err(ThumbnailError::Cancelled);
        }
        match inner
            .executor
            .submit(Arc::downgrade(inner), key.clone(), seed.clone())
        {
            Ok(()) => return Ok(()),
            Err(ThumbnailError::SchedulerBackpressure) => {
                thread::sleep(Duration::from_millis(5));
            }
            Err(error) => return Err(error),
        }
    }
}

fn generate(
    inner: &Arc<ThumbnailServiceInner>,
    seed: &GenerationSeed,
) -> Result<ThumbnailArtifact, GenerationError> {
    if !has_live_owners(inner, &seed.key, seed.generation_id) {
        return Err(GenerationError::Final(ThumbnailError::Cancelled));
    }
    let work_request = WorkRequest::new(
        seed.request.request_id.clone(),
        seed.request.work_class,
        seed.renderer.resources,
    )
    .with_coalesce_key(seed.logical_cache_key.clone())
    .with_cancellation(seed.scheduler_cancellation.clone());
    let session_id = seed
        .request
        .session_id
        .clone()
        .or_else(|| match &seed.source {
            PreviewSourceRef::Ephemeral {
                browse_session_id, ..
            } => Some(browse_session_id.clone()),
            _ => None,
        });
    let work_request = session_id
        .as_deref()
        .map(|session| work_request.clone().with_session_id(session))
        .unwrap_or(work_request);
    let scheduler_lease = match inner.scheduler.try_acquire(work_request) {
        Ok(lease) => lease,
        Err(AcquireError::WouldBlock | AcquireError::QueueFull) => {
            #[cfg(test)]
            inner.scheduler_retries.fetch_add(1, Ordering::AcqRel);
            return Err(GenerationError::Retry);
        }
        Err(error) => return Err(GenerationError::from(map_acquire_error(error))),
    };
    if seed.scheduler_cancellation.is_cancelled() {
        drop(scheduler_lease);
        return Err(GenerationError::Final(ThumbnailError::Cancelled));
    }

    let read_lease = inner
        .gate
        .issue_thumbnail_lease(&seed.request.request_id, seed.source.clone())
        .map_err(map_read_gate_error)?;
    let read_lease = ThumbnailLeaseGuard {
        gate: Arc::clone(&inner.gate),
        lease: Some(read_lease),
    };
    let source_name = inner.gate.source_file_name(&seed.source);
    let context = ThumbnailRenderContext {
        gate: Arc::clone(&inner.gate),
        lease: read_lease
            .lease
            .as_ref()
            .expect("thumbnail read lease guard must hold a lease")
            .clone(),
        request_id: seed.request.request_id.clone(),
        session_id,
        source: seed.source.clone(),
        source_version: seed.source_version.clone(),
        cache_key: seed.logical_cache_key.clone(),
        source_name,
        max_source_bytes: inner.config.max_source_bytes,
        remaining_source_budget: std::sync::atomic::AtomicU64::new(inner.config.max_source_bytes),
        scheduler_cancellation: seed.scheduler_cancellation.clone(),
        cancellation: seed.render_cancellation.clone(),
        deadline: Instant::now() + inner.config.generation_timeout,
    };
    let render_request = ThumbnailRenderRequest {
        request_id: seed.request.request_id.clone(),
        source: seed.source.clone(),
        variant: seed.request.variant,
        source_version: seed.source_version.clone(),
        cache_key: seed.logical_cache_key.clone(),
    };
    let output = inner
        .renderer
        .render(render_request, &context)
        .map_err(map_renderer_error)?;
    context.ensure_active().map_err(map_renderer_error)?;
    if output.bytes.len() as u64 > inner.config.max_output_bytes {
        return Err(ThumbnailError::RendererFailed.into());
    }
    let current_version = inner
        .gate
        .current_source_version(&seed.source)
        .map_err(map_read_gate_error)?;
    if current_version != seed.source_version {
        return Err(ThumbnailError::IdentityChanged.into());
    }
    if !has_live_owners(inner, &seed.key, seed.generation_id)
        || seed.scheduler_cancellation.is_cancelled()
    {
        return Err(ThumbnailError::Cancelled.into());
    }

    let artifact = ThumbnailArtifact {
        cache_key: seed.logical_cache_key.clone(),
        bytes: output.bytes,
    };
    drop(read_lease);
    drop(scheduler_lease);
    publish_artifact(inner, seed, artifact).map_err(GenerationError::from)
}

struct ThumbnailLeaseGuard {
    gate: Arc<dyn ThumbnailReadGate>,
    lease: Option<ContentReadLeaseRef>,
}

impl Drop for ThumbnailLeaseGuard {
    fn drop(&mut self) {
        if let Some(lease) = self.lease.take() {
            let _ = self.gate.release_lease(&lease);
        }
    }
}

fn map_renderer_error(error: ThumbnailRendererError) -> ThumbnailError {
    match error {
        ThumbnailRendererError::UnsupportedRenderer => ThumbnailError::UnsupportedRenderer,
        ThumbnailRendererError::UnsupportedSource => ThumbnailError::UnsupportedSource,
        ThumbnailRendererError::MaterializationRequired => ThumbnailError::MaterializationRequired,
        ThumbnailRendererError::SourceUnavailable => ThumbnailError::SourceUnavailable,
        ThumbnailRendererError::PermissionDenied => ThumbnailError::PermissionDenied,
        ThumbnailRendererError::IdentityChanged => ThumbnailError::IdentityChanged,
        ThumbnailRendererError::Cancelled => ThumbnailError::Cancelled,
        ThumbnailRendererError::Timeout => ThumbnailError::Timeout,
        ThumbnailRendererError::Failed => ThumbnailError::RendererFailed,
    }
}

fn has_live_owners(
    inner: &Arc<ThumbnailServiceInner>,
    key: &GenerationKey,
    generation_id: u64,
) -> bool {
    lock(&inner.state)
        .inflight
        .get(key)
        .filter(|inflight| inflight.seed.generation_id == generation_id)
        .is_some_and(|inflight| {
            inflight
                .owners
                .values()
                .any(|owner| !owner.cancelled.load(Ordering::Acquire))
        })
}

fn can_publish_locked(
    inner: &ThumbnailServiceInner,
    state: &ThumbnailState,
    seed: &GenerationSeed,
) -> bool {
    !inner.disposed.load(Ordering::Acquire)
        && !seed.scheduler_cancellation.is_cancelled()
        && state
            .inflight
            .get(&seed.key)
            .filter(|inflight| inflight.seed.generation_id == seed.generation_id)
            .is_some_and(|inflight| {
                inflight
                    .owners
                    .values()
                    .any(|owner| !owner.cancelled.load(Ordering::Acquire))
            })
}

fn publish_artifact(
    inner: &Arc<ThumbnailServiceInner>,
    seed: &GenerationSeed,
    artifact: ThumbnailArtifact,
) -> Result<ThumbnailArtifact, ThumbnailError> {
    let publication = {
        let state = lock(&inner.state);
        state
            .inflight
            .get(&seed.key)
            .filter(|inflight| inflight.seed.generation_id == seed.generation_id)
            .map(|inflight| Arc::clone(&inflight.publication))
            .ok_or(ThumbnailError::Cancelled)?
    };
    // Cancellation takes this same per-generation gate before removing an
    // owner. The global coordination mutex is intentionally not held across
    // disk I/O, fsync, rename, or trim.
    let _publication = lock(&publication);
    {
        let state = lock(&inner.state);
        if !can_publish_locked(inner, &state, seed) {
            return Err(ThumbnailError::Cancelled);
        }
    }
    if seed.key.identity.is_durable() {
        let _ = disk_store(inner, &seed.key, &artifact.bytes);
    }
    let mut state = lock(&inner.state);
    if !can_publish_locked(inner, &state, seed) {
        return Err(ThumbnailError::Cancelled);
    }
    memory_insert_locked(
        &mut state,
        &inner.config,
        seed.key.clone(),
        artifact.clone(),
    );
    Ok(artifact)
}

fn finish_generation(
    inner: &Arc<ThumbnailServiceInner>,
    key: &GenerationKey,
    generation_id: u64,
    result: Result<ThumbnailArtifact, ThumbnailError>,
) {
    let owners = {
        let publication = {
            let state = lock(&inner.state);
            state
                .inflight
                .get(key)
                .filter(|inflight| inflight.seed.generation_id == generation_id)
                .map(|inflight| Arc::clone(&inflight.publication))
        };
        let Some(publication) = publication else {
            return;
        };
        let _publication = lock(&publication);
        let mut state = lock(&inner.state);
        let Some(inflight) = state
            .inflight
            .get(key)
            .filter(|inflight| inflight.seed.generation_id == generation_id)
        else {
            return;
        };
        let owners = inflight
            .owners
            .values()
            .map(|owner| (owner.sender.clone(), Arc::clone(&owner.cancelled)))
            .collect::<Vec<_>>();
        state.inflight.remove(key);
        owners
    };
    for (sender, cancelled) in owners {
        if cancelled.load(Ordering::Acquire) {
            continue;
        }
        let _ = sender.send(result.clone());
    }
}

fn cancel_owner(
    inner: &Arc<ThumbnailServiceInner>,
    key: &GenerationKey,
    generation_id: u64,
    owner_id: u64,
    cancelled: &Arc<AtomicBool>,
) -> bool {
    let publication = {
        let state = lock(&inner.state);
        state
            .inflight
            .get(key)
            .filter(|inflight| inflight.seed.generation_id == generation_id)
            .map(|inflight| Arc::clone(&inflight.publication))
    };
    let Some(publication) = publication else {
        cancelled.store(true, Ordering::Release);
        return false;
    };
    let _publication = lock(&publication);
    let sender = {
        let mut state = lock(&inner.state);
        let Some(inflight) = state
            .inflight
            .get_mut(key)
            .filter(|inflight| inflight.seed.generation_id == generation_id)
        else {
            cancelled.store(true, Ordering::Release);
            return false;
        };
        let Some(owner) = inflight.owners.remove(&owner_id) else {
            cancelled.store(true, Ordering::Release);
            return false;
        };
        owner.cancelled.store(true, Ordering::Release);
        cancelled.store(true, Ordering::Release);
        let sender = owner.sender;
        if inflight.owners.is_empty() {
            inflight.seed.scheduler_cancellation.cancel();
            inflight.seed.render_cancellation.cancel();
            state.inflight.remove(key);
        }
        sender
    };
    let _ = sender.send(Err(ThumbnailError::Cancelled));
    true
}

fn fail_submission(
    inner: &Arc<ThumbnailServiceInner>,
    key: &GenerationKey,
    generation_id: u64,
    owner_id: u64,
    error: ThumbnailError,
) {
    let mut sender = None;
    {
        let mut state = lock(&inner.state);
        if let Some(inflight) = state
            .inflight
            .get_mut(key)
            .filter(|inflight| inflight.seed.generation_id == generation_id)
        {
            if let Some(owner) = inflight.owners.remove(&owner_id) {
                sender = Some(owner.sender);
            }
            if inflight.owners.is_empty() {
                state.inflight.remove(key);
            }
        }
    }
    if let Some(sender) = sender {
        let _ = sender.send(Err(error));
    }
}

fn ensure_cache_dir(cache_dir: &Path) -> Result<(), String> {
    if let Ok(metadata) = fs::symlink_metadata(cache_dir) {
        if metadata.file_type().is_symlink() || !metadata.is_dir() || is_reparse_point(&metadata) {
            return Err("thumbnail_cache_directory_not_safe".to_string());
        }
        return Ok(());
    }
    fs::create_dir_all(cache_dir)
        .map_err(|error| format!("thumbnail_cache_create_failed:{error}"))?;
    let metadata = fs::symlink_metadata(cache_dir)
        .map_err(|error| format!("thumbnail_cache_stat_failed:{error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() || is_reparse_point(&metadata) {
        return Err("thumbnail_cache_directory_not_safe".to_string());
    }
    Ok(())
}

fn reject_cache_symlink(path: &Path) -> Result<(), String> {
    if fs::symlink_metadata(path)
        .map(|metadata| metadata.file_type().is_symlink() || is_reparse_point(&metadata))
        .unwrap_or(false)
    {
        return Err("thumbnail_cache_entry_not_safe".to_string());
    }
    Ok(())
}

fn is_safe_regular_file(metadata: &fs::Metadata) -> bool {
    metadata.is_file() && !metadata.file_type().is_symlink() && !is_reparse_point(metadata)
}

#[cfg(windows)]
fn is_reparse_point(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
    metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn is_reparse_point(_metadata: &fs::Metadata) -> bool {
    false
}

/// Existing Mac Quick Look adapter, now fed only by bytes read through the
/// W1-07 seam.  On other platforms the shared service remains compilable and
/// returns an explicit unsupported renderer error.
#[derive(Clone)]
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub struct MacQuickLookThumbnailRenderer {
    service: crate::platform::macos::quick_look::MacThumbnailService,
}

impl MacQuickLookThumbnailRenderer {
    pub fn new(service: crate::platform::macos::quick_look::MacThumbnailService) -> Self {
        Self { service }
    }
}

impl ThumbnailRenderer for MacQuickLookThumbnailRenderer {
    fn descriptor(&self) -> ThumbnailRendererDescriptor {
        ThumbnailRendererDescriptor::new(
            "macos.quick-look",
            "w1-08-quick-look-v1",
            ResourceHints {
                cpu: 1,
                io: 1,
                open_handles: 1,
                decoder: 1,
                native_preview: 1,
                provider_network: 0,
            },
        )
    }

    fn render(
        &self,
        request: ThumbnailRenderRequest,
        context: &ThumbnailRenderContext,
    ) -> Result<ThumbnailRenderOutput, ThumbnailRendererError> {
        #[cfg(not(target_os = "macos"))]
        {
            let _ = (request, context);
            Err(ThumbnailRendererError::UnsupportedRenderer)
        }

        #[cfg(target_os = "macos")]
        {
            context.ensure_active()?;
            let bytes = context.read_all_bounded(DEFAULT_MAX_SOURCE_BYTES)?;
            let source_name = context
                .source_file_name()
                .unwrap_or("source.bin")
                .to_string();
            let job = self
                .service
                .request_gated_bytes(
                    &source_name,
                    &bytes,
                    request.variant.pixels(),
                    &request.request_id,
                    &request.cache_key,
                    || context.is_explicitly_cancelled(),
                    Instant::now() + context.remaining(),
                )
                .map_err(map_quick_look_error)?;
            let output = job
                .join_until(
                    || context.is_explicitly_cancelled(),
                    Instant::now() + context.remaining(),
                )
                .map_err(map_quick_look_error)?;
            context.ensure_active()?;
            let metadata =
                fs::symlink_metadata(&output).map_err(|_| ThumbnailRendererError::Failed)?;
            if !is_safe_regular_file(&metadata) || metadata.len() > DEFAULT_MAX_OUTPUT_BYTES {
                return Err(ThumbnailRendererError::Failed);
            }
            let bytes = fs::read(output).map_err(|_| ThumbnailRendererError::Failed)?;
            Ok(ThumbnailRenderOutput { bytes })
        }
    }
}

#[cfg(target_os = "macos")]
fn map_quick_look_error(error: String) -> ThumbnailRendererError {
    if error.contains("cancelled") {
        ThumbnailRendererError::Cancelled
    } else if error.contains("timeout") {
        ThumbnailRendererError::Timeout
    } else if error.contains("identity_changed") {
        ThumbnailRendererError::IdentityChanged
    } else if error.contains("unavailable") {
        ThumbnailRendererError::UnsupportedRenderer
    } else {
        ThumbnailRendererError::Failed
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{sync::atomic::AtomicUsize, thread};

    #[derive(Clone)]
    struct FakeGate {
        version: Arc<Mutex<String>>,
        error: Arc<Mutex<Option<ReadGateError>>>,
        reads: Arc<AtomicUsize>,
        leases: Arc<AtomicUsize>,
    }

    impl FakeGate {
        fn new(version: &str) -> Self {
            Self {
                version: Arc::new(Mutex::new(version.to_string())),
                error: Arc::new(Mutex::new(None)),
                reads: Arc::new(AtomicUsize::new(0)),
                leases: Arc::new(AtomicUsize::new(0)),
            }
        }

        fn set_error(&self, error: Option<ReadGateError>) {
            *lock(&self.error) = error;
        }
    }

    impl ThumbnailReadGate for FakeGate {
        fn current_source_version(
            &self,
            _source: &PreviewSourceRef,
        ) -> Result<String, ReadGateError> {
            if let Some(error) = *lock(&self.error) {
                return Err(error);
            }
            Ok(lock(&self.version).clone())
        }

        fn issue_thumbnail_lease(
            &self,
            request_id: &str,
            _source: PreviewSourceRef,
        ) -> Result<ContentReadLeaseRef, ReadGateError> {
            if let Some(error) = *lock(&self.error) {
                return Err(error);
            }
            self.leases.fetch_add(1, Ordering::SeqCst);
            Ok(ContentReadLeaseRef {
                lease_id: format!("lease-{request_id}"),
                request_id: request_id.to_string(),
                source_version: lock(&self.version).clone(),
            })
        }

        fn read_bounded(
            &self,
            _lease: &ContentReadLeaseRef,
            request: BoundedContentReadRequest,
            operation: ThumbnailReadOperation<'_>,
        ) -> Result<BoundedContentRead, ContentReadAccessError> {
            if operation.cancellation.is_cancelled() {
                return Err(ContentReadAccessError::Cancelled);
            }
            if Instant::now() >= operation.deadline {
                return Err(ContentReadAccessError::TimedOut);
            }
            self.reads.fetch_add(1, Ordering::SeqCst);
            let content = b"thumbnail-source";
            let offset = usize::try_from(request.offset_bytes).unwrap_or(usize::MAX);
            if offset >= content.len() {
                return Ok(BoundedContentRead {
                    bytes: Vec::new(),
                    complete: true,
                });
            }
            let end = (offset + request.max_bytes as usize).min(content.len());
            Ok(BoundedContentRead {
                bytes: content[offset..end].to_vec(),
                complete: end == content.len(),
            })
        }

        fn release_lease(&self, _lease: &ContentReadLeaseRef) -> Result<(), ReadGateError> {
            self.leases.fetch_sub(1, Ordering::SeqCst);
            Ok(())
        }

        fn source_file_name(&self, _source: &PreviewSourceRef) -> Option<String> {
            Some("fixture.png".to_string())
        }
    }

    struct FakeRenderer {
        descriptor: ThumbnailRendererDescriptor,
        renders: Arc<AtomicUsize>,
        render_order: Arc<Mutex<Vec<String>>>,
        read: bool,
        wait: Option<Arc<(Mutex<bool>, std::sync::Condvar)>>,
        entered: Option<Arc<AtomicBool>>,
    }

    impl FakeRenderer {
        fn new(read: bool) -> Self {
            Self {
                descriptor: ThumbnailRendererDescriptor::new(
                    "test.renderer",
                    "1",
                    ResourceHints {
                        cpu: 1,
                        io: 1,
                        open_handles: 1,
                        decoder: 1,
                        native_preview: 1,
                        ..ResourceHints::empty()
                    },
                ),
                renders: Arc::new(AtomicUsize::new(0)),
                render_order: Arc::new(Mutex::new(Vec::new())),
                read,
                wait: None,
                entered: None,
            }
        }

        fn with_version(mut self, version: &str) -> Self {
            self.descriptor.version = version.to_string();
            self
        }
    }

    impl ThumbnailRenderer for FakeRenderer {
        fn descriptor(&self) -> ThumbnailRendererDescriptor {
            self.descriptor.clone()
        }

        fn render(
            &self,
            request: ThumbnailRenderRequest,
            context: &ThumbnailRenderContext,
        ) -> Result<ThumbnailRenderOutput, ThumbnailRendererError> {
            self.renders.fetch_add(1, Ordering::SeqCst);
            if let PreviewSourceRef::Managed { file_id } = request.source {
                lock(&self.render_order).push(file_id);
            }
            if let Some(entered) = self.entered.as_ref() {
                entered.store(true, Ordering::Release);
            }
            if let Some(wait) = self.wait.as_ref() {
                let (ready, signal) = &**wait;
                let mut ready = lock(ready);
                while !*ready && !context.is_cancelled() {
                    ready = signal
                        .wait_timeout(ready, Duration::from_millis(10))
                        .map_err(|_| ThumbnailRendererError::Failed)?
                        .0;
                }
            }
            if self.read {
                let _ = context.read_bounded(0, 64)?;
            }
            context.ensure_active()?;
            Ok(ThumbnailRenderOutput {
                bytes: b"png".to_vec(),
            })
        }
    }

    fn scheduler() -> Arc<WorkScheduler> {
        scheduler_with_capacities(crate::scheduler::ResourceCapacities::new(2, 2, 4, 2, 2, 1))
    }

    fn scheduler_with_capacities(
        capacities: crate::scheduler::ResourceCapacities,
    ) -> Arc<WorkScheduler> {
        Arc::new(WorkScheduler::new(
            crate::scheduler::SchedulerConfig::default()
                .with_capacities(capacities)
                .with_policy(Arc::new(crate::scheduler::PermissiveResourcePolicy)),
        ))
    }

    fn source(id: &str) -> EntryRef {
        EntryRef::Managed {
            file_id: id.to_string(),
        }
    }

    fn release_wait(wait: &Arc<(Mutex<bool>, std::sync::Condvar)>) {
        let (ready, signal) = &**wait;
        *lock(ready) = true;
        signal.notify_all();
    }

    fn wait_until(flag: &AtomicBool) {
        for _ in 0..10_000 {
            if flag.load(Ordering::Acquire) {
                return;
            }
            thread::yield_now();
        }
        panic!("thumbnail worker did not reach expected state");
    }

    fn wait_until_at_least(counter: &AtomicUsize, target: usize) {
        for _ in 0..10_000 {
            if counter.load(Ordering::Acquire) >= target {
                return;
            }
            thread::yield_now();
        }
        panic!("thumbnail worker did not reach expected scheduler retry count");
    }

    fn service<G, R>(
        gate: Arc<G>,
        renderer: Arc<R>,
        cache_dir: Option<PathBuf>,
        config: ThumbnailServiceConfig,
    ) -> ThumbnailService
    where
        G: ThumbnailReadGate + 'static,
        R: ThumbnailRenderer + 'static,
    {
        ThumbnailService::new(gate, scheduler(), renderer, cache_dir, config)
            .expect("valid thumbnail service")
    }

    fn service_with_scheduler<G, R>(
        gate: Arc<G>,
        scheduler: Arc<WorkScheduler>,
        renderer: Arc<R>,
        cache_dir: Option<PathBuf>,
        config: ThumbnailServiceConfig,
    ) -> ThumbnailService
    where
        G: ThumbnailReadGate + 'static,
        R: ThumbnailRenderer + 'static,
    {
        ThumbnailService::new(gate, scheduler, renderer, cache_dir, config)
            .expect("valid thumbnail service")
    }

    #[test]
    fn variant_mapping_is_bounded_and_stable() {
        assert_eq!(ThumbnailVariant::Small.pixels(), 96);
        assert_eq!(ThumbnailVariant::Medium.pixels(), 256);
        assert_eq!(ThumbnailVariant::Large.pixels(), 512);
        assert!(ThumbnailVariant::Large.is_bounded());
    }

    #[test]
    fn malformed_ids_and_path_like_authority_are_rejected() {
        let gate = Arc::new(FakeGate::new("v1"));
        let renderer = Arc::new(FakeRenderer::new(true));
        let service = service(gate, renderer, None, ThumbnailServiceConfig::default());
        let empty = ThumbnailRequest::new(
            "",
            source("file"),
            ThumbnailVariant::Small,
            WorkClass::Interactive,
        );
        assert_eq!(
            service.request(empty).unwrap_err(),
            ThumbnailError::InvalidRequest
        );
        let path = ThumbnailRequest::new(
            "request",
            source("C:\\Users\\user\\file.png"),
            ThumbnailVariant::Small,
            WorkClass::Interactive,
        );
        assert_eq!(
            service.request(path).unwrap_err(),
            ThumbnailError::InvalidRequest
        );
        let missing_generation = ThumbnailRequest::new(
            "ephemeral-request",
            EntryRef::Ephemeral {
                browse_session_id: "browse".to_string(),
                entry_id: "entry".to_string(),
            },
            ThumbnailVariant::Small,
            WorkClass::Interactive,
        );
        assert_eq!(
            service.request(missing_generation).unwrap_err(),
            ThumbnailError::InvalidRequest
        );
    }

    #[test]
    fn renderer_reads_through_thumbnail_gate_and_resources_are_released() {
        let gate = Arc::new(FakeGate::new("v1"));
        let renderer = Arc::new(FakeRenderer::new(true));
        let reads = Arc::clone(&gate.reads);
        let leases = Arc::clone(&gate.leases);
        let service = service(
            Arc::clone(&gate),
            renderer,
            None,
            ThumbnailServiceConfig::default(),
        );
        let task = service
            .request(ThumbnailRequest::new(
                "request",
                source("file"),
                ThumbnailVariant::Medium,
                WorkClass::Interactive,
            ))
            .expect("request");
        assert_eq!(task.join().expect("thumbnail").bytes, b"png");
        assert!(reads.load(Ordering::SeqCst) > 0);
        assert_eq!(leases.load(Ordering::SeqCst), 0);
        assert_eq!(service.active_request_count(), 0);
    }

    #[test]
    fn identical_requests_deduplicate_and_cancelled_waiter_cannot_publish() {
        let gate = Arc::new(FakeGate::new("v1"));
        let mut renderer = FakeRenderer::new(false);
        let wait = Arc::new((Mutex::new(false), std::sync::Condvar::new()));
        renderer.wait = Some(Arc::clone(&wait));
        let renderer = Arc::new(renderer);
        let renders = Arc::clone(&renderer.renders);
        let service = service(gate, renderer, None, ThumbnailServiceConfig::default());
        let request = ThumbnailRequest::new(
            "request-1",
            source("file"),
            ThumbnailVariant::Small,
            WorkClass::Interactive,
        );
        let first = service.request(request.clone()).expect("first");
        let second = service
            .request(ThumbnailRequest {
                request_id: "request-2".to_string(),
                ..request
            })
            .expect("second");
        assert!(second.cancel());
        {
            let (ready, signal) = &*wait;
            *lock(ready) = true;
            signal.notify_all();
        }
        assert_eq!(first.join().expect("first result").bytes, b"png");
        assert_eq!(second.join().unwrap_err(), ThumbnailError::Cancelled);
        assert_eq!(renders.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn deduplication_owner_capacity_is_bounded() {
        let gate = Arc::new(FakeGate::new("v1"));
        let wait = Arc::new((Mutex::new(false), std::sync::Condvar::new()));
        let mut renderer = FakeRenderer::new(false);
        renderer.wait = Some(Arc::clone(&wait));
        let renderer = Arc::new(renderer);
        let service = service(
            gate,
            renderer,
            None,
            ThumbnailServiceConfig {
                max_owners_per_generation: 1,
                ..ThumbnailServiceConfig::default()
            },
        );
        let first = service
            .request(ThumbnailRequest::new(
                "owner-one",
                source("same-file"),
                ThumbnailVariant::Small,
                WorkClass::Interactive,
            ))
            .expect("first request");
        let second = service.request(ThumbnailRequest::new(
            "owner-two",
            source("same-file"),
            ThumbnailVariant::Small,
            WorkClass::Interactive,
        ));
        assert_eq!(second.unwrap_err(), ThumbnailError::SchedulerBackpressure);
        release_wait(&wait);
        assert!(first.join().is_ok());
        assert_eq!(service.active_request_count(), 0);
    }

    #[test]
    fn materialization_failure_is_conservative_and_never_reads() {
        let gate = Arc::new(FakeGate::new("v1"));
        gate.set_error(Some(ReadGateError::MaterializationRequired));
        let renderer = Arc::new(FakeRenderer::new(true));
        let renders = Arc::clone(&renderer.renders);
        let service = service(
            Arc::clone(&gate),
            renderer,
            None,
            ThumbnailServiceConfig::default(),
        );
        let result = service.request(ThumbnailRequest::new(
            "request",
            source("placeholder"),
            ThumbnailVariant::Small,
            WorkClass::Interactive,
        ));
        assert_eq!(result.unwrap_err(), ThumbnailError::MaterializationRequired);
        assert_eq!(renders.load(Ordering::SeqCst), 0);
        assert_eq!(gate.reads.load(Ordering::SeqCst), 0);
        assert_eq!(gate.leases.load(Ordering::SeqCst), 0);
    }

    #[test]
    fn unavailable_provider_states_never_trigger_implicit_reads() {
        let cases = [
            (ReadGateError::Downloading, ThumbnailError::Downloading),
            (
                ReadGateError::SourceUnavailable,
                ThumbnailError::SourceUnavailable,
            ),
            (
                ReadGateError::PermissionDenied,
                ThumbnailError::PermissionDenied,
            ),
            (
                ReadGateError::AvailabilityUnknown,
                ThumbnailError::UnknownSource,
            ),
            (
                ReadGateError::SourceNotSupported,
                ThumbnailError::UnsupportedSource,
            ),
            (
                ReadGateError::PackageUnsupported,
                ThumbnailError::UnsupportedSource,
            ),
        ];
        for (gate_error, expected) in cases {
            let gate = Arc::new(FakeGate::new("v1"));
            gate.set_error(Some(gate_error));
            let renderer = Arc::new(FakeRenderer::new(true));
            let renders = Arc::clone(&renderer.renders);
            let service = service(
                Arc::clone(&gate),
                renderer,
                None,
                ThumbnailServiceConfig::default(),
            );
            let result = service.request(ThumbnailRequest::new(
                "provider-state",
                source("provider-placeholder"),
                ThumbnailVariant::Small,
                WorkClass::Interactive,
            ));
            assert_eq!(result.unwrap_err(), expected);
            assert_eq!(renders.load(Ordering::SeqCst), 0);
            assert_eq!(gate.reads.load(Ordering::SeqCst), 0);
            assert_eq!(gate.leases.load(Ordering::SeqCst), 0);
        }
    }

    #[test]
    fn interactive_work_uses_explicit_bounded_scheduler_resources() {
        let gate = Arc::new(FakeGate::new("v1"));
        let wait = Arc::new((Mutex::new(false), std::sync::Condvar::new()));
        let entered = Arc::new(AtomicBool::new(false));
        let mut renderer = FakeRenderer::new(false);
        renderer.wait = Some(Arc::clone(&wait));
        renderer.entered = Some(Arc::clone(&entered));
        let renderer = Arc::new(renderer);
        let resources = renderer.descriptor().resources;
        let service = service(gate, renderer, None, ThumbnailServiceConfig::default());
        let task = service
            .request(ThumbnailRequest::new(
                "resource-request",
                source("resource-file"),
                ThumbnailVariant::Medium,
                WorkClass::Interactive,
            ))
            .expect("request");
        wait_until(&entered);
        assert_eq!(service.inner.scheduler.snapshot().granted, resources);
        release_wait(&wait);
        assert!(task.join().is_ok());
        assert_eq!(
            service.inner.scheduler.snapshot().granted,
            ResourceHints::empty()
        );
    }

    #[test]
    fn interactive_work_is_not_hidden_behind_blocked_background_work() {
        let scheduler =
            scheduler_with_capacities(crate::scheduler::ResourceCapacities::new(1, 1, 1, 1, 1, 1));
        let renderer = Arc::new(FakeRenderer::new(false));
        let resources = renderer.descriptor().resources;
        let holder = scheduler
            .try_acquire(WorkRequest::new("holder", WorkClass::Foreground, resources))
            .expect("resource holder");
        let service = service_with_scheduler(
            Arc::new(FakeGate::new("v1")),
            Arc::clone(&scheduler),
            Arc::clone(&renderer),
            None,
            ThumbnailServiceConfig {
                worker_count: 1,
                ..ThumbnailServiceConfig::default()
            },
        );
        let background = service
            .request(ThumbnailRequest::new(
                "background-request",
                source("background-file"),
                ThumbnailVariant::Small,
                WorkClass::Background,
            ))
            .expect("background request");
        wait_until_at_least(&service.inner.scheduler_retries, 1);
        let retries_before_interactive = service.inner.scheduler_retries.load(Ordering::Acquire);
        let interactive = service
            .request(ThumbnailRequest::new(
                "interactive-request",
                source("interactive-file"),
                ThumbnailVariant::Small,
                WorkClass::Interactive,
            ))
            .expect("interactive request");
        wait_until_at_least(
            &service.inner.scheduler_retries,
            retries_before_interactive + 1,
        );

        drop(holder);
        interactive.join().expect("interactive result");
        background.join().expect("background result");
        let render_order = lock(&renderer.render_order);
        let order = render_order.iter().map(String::as_str).collect::<Vec<_>>();
        assert_eq!(order, ["interactive-file", "background-file"]);
    }

    #[test]
    fn final_owner_cancellation_abandons_work_and_releases_capacity() {
        let gate = Arc::new(FakeGate::new("v1"));
        let wait = Arc::new((Mutex::new(false), std::sync::Condvar::new()));
        let entered = Arc::new(AtomicBool::new(false));
        let mut renderer = FakeRenderer::new(false);
        renderer.wait = Some(Arc::clone(&wait));
        renderer.entered = Some(Arc::clone(&entered));
        let renderer = Arc::new(renderer);
        let service = service(gate, renderer, None, ThumbnailServiceConfig::default());
        let task = service
            .request(ThumbnailRequest::new(
                "cancel-final",
                source("cancel-file"),
                ThumbnailVariant::Small,
                WorkClass::Interactive,
            ))
            .expect("request");
        wait_until(&entered);
        assert!(task.cancel());
        assert_eq!(task.join().unwrap_err(), ThumbnailError::Cancelled);
        release_wait(&wait);
        for _ in 0..10_000 {
            if service.inner.scheduler.snapshot().running == 0
                && service.active_request_count() == 0
            {
                return;
            }
            thread::yield_now();
        }
        panic!("cancelled thumbnail work did not return to steady state");
    }

    #[test]
    fn final_owner_cancellation_cannot_publish_memory_or_disk_cache() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("repository root")
            .join(".tmp-tests")
            .join("thumbnail-cancel-publication")
            .join(uuid::Uuid::new_v4().to_string());
        let gate = Arc::new(FakeGate::new("v1"));
        let wait = Arc::new((Mutex::new(false), std::sync::Condvar::new()));
        let entered = Arc::new(AtomicBool::new(false));
        let mut renderer = FakeRenderer::new(false);
        renderer.wait = Some(Arc::clone(&wait));
        renderer.entered = Some(Arc::clone(&entered));
        let renderer = Arc::new(renderer);
        let service = service(
            Arc::clone(&gate),
            renderer,
            Some(root.clone()),
            ThumbnailServiceConfig::default(),
        );
        let task = service
            .request(ThumbnailRequest::new(
                "cancel-publication",
                source("cancel-publication-file"),
                ThumbnailVariant::Small,
                WorkClass::Interactive,
            ))
            .expect("request");
        wait_until(&entered);
        assert!(task.cancel());
        assert_eq!(task.join().unwrap_err(), ThumbnailError::Cancelled);
        release_wait(&wait);
        for _ in 0..10_000 {
            if service.active_request_count() == 0 {
                break;
            }
            thread::yield_now();
        }
        assert_eq!(service.active_request_count(), 0);
        assert_eq!(service.memory_cache_len(), 0);
        let entries = fs::read_dir(&root)
            .expect("cache root")
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .collect::<Vec<_>>();
        assert!(entries.iter().all(|path| {
            path.extension().and_then(|ext| ext.to_str()) != Some("thumb")
                && !path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| name.starts_with(".pending-thumbnail-"))
        }));
        fs::remove_dir_all(root).expect("thumbnail cache cleanup");
    }

    #[test]
    fn source_version_change_during_generation_rejects_and_does_not_cache() {
        let gate = Arc::new(FakeGate::new("v1"));
        let wait = Arc::new((Mutex::new(false), std::sync::Condvar::new()));
        let entered = Arc::new(AtomicBool::new(false));
        let mut renderer = FakeRenderer::new(false);
        renderer.wait = Some(Arc::clone(&wait));
        renderer.entered = Some(Arc::clone(&entered));
        let renderer = Arc::new(renderer);
        let service = service(
            Arc::clone(&gate),
            renderer,
            None,
            ThumbnailServiceConfig::default(),
        );
        let task = service
            .request(ThumbnailRequest::new(
                "stale-request",
                source("stale-file"),
                ThumbnailVariant::Large,
                WorkClass::Interactive,
            ))
            .expect("request");
        wait_until(&entered);
        *lock(&gate.version) = "v2".to_string();
        release_wait(&wait);
        assert_eq!(task.join().unwrap_err(), ThumbnailError::IdentityChanged);
        assert_eq!(service.memory_cache_len(), 0);
        assert_eq!(gate.leases.load(Ordering::SeqCst), 0);
    }

    #[test]
    fn executor_backpressure_is_explicit_and_bounded() {
        let gate = Arc::new(FakeGate::new("v1"));
        let wait = Arc::new((Mutex::new(false), std::sync::Condvar::new()));
        let entered = Arc::new(AtomicBool::new(false));
        let mut renderer = FakeRenderer::new(false);
        renderer.wait = Some(Arc::clone(&wait));
        renderer.entered = Some(Arc::clone(&entered));
        let renderer = Arc::new(renderer);
        let config = ThumbnailServiceConfig {
            worker_count: 1,
            queue_capacity: 1,
            ..ThumbnailServiceConfig::default()
        };
        let service = service(gate, renderer, None, config);
        let first = service
            .request(ThumbnailRequest::new(
                "queue-1",
                source("queue-file-1"),
                ThumbnailVariant::Small,
                WorkClass::Interactive,
            ))
            .expect("first request");
        wait_until(&entered);
        let second = service
            .request(ThumbnailRequest::new(
                "queue-2",
                source("queue-file-2"),
                ThumbnailVariant::Small,
                WorkClass::Interactive,
            ))
            .expect("bounded queued request");
        let third = service.request(ThumbnailRequest::new(
            "queue-3",
            source("queue-file-3"),
            ThumbnailVariant::Small,
            WorkClass::Interactive,
        ));
        assert_eq!(third.unwrap_err(), ThumbnailError::SchedulerBackpressure);
        release_wait(&wait);
        assert!(first.join().is_ok());
        assert!(second.join().is_ok());
        assert_eq!(service.active_request_count(), 0);
    }

    #[test]
    fn ephemeral_identity_never_writes_disk_and_durable_cache_reuses_verified_version() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("repository root")
            .join(".tmp-tests")
            .join("thumbnail-cache")
            .join(uuid::Uuid::new_v4().to_string());
        let config = ThumbnailServiceConfig {
            worker_count: 1,
            ..ThumbnailServiceConfig::default()
        };
        let gate = Arc::new(FakeGate::new("same-version"));
        let renderer = Arc::new(FakeRenderer::new(false));
        let service = ThumbnailService::new(
            gate.clone(),
            scheduler(),
            renderer.clone(),
            Some(root.clone()),
            config.clone(),
        )
        .expect("service");
        let ephemeral = ThumbnailRequest::new(
            "ephemeral",
            EntryRef::Ephemeral {
                browse_session_id: "browse".to_string(),
                entry_id: "entry".to_string(),
            },
            ThumbnailVariant::Small,
            WorkClass::Interactive,
        )
        .with_source_generation("generation-1");
        service
            .request(ephemeral)
            .expect("ephemeral")
            .join()
            .expect("result");
        assert_eq!(fs::read_dir(&root).expect("cache root").count(), 0);
        let durable = ThumbnailRequest::new(
            "durable-1",
            source("managed-file"),
            ThumbnailVariant::Small,
            WorkClass::Interactive,
        );
        service
            .request(durable.clone())
            .expect("durable")
            .join()
            .expect("result");
        let second_service = ThumbnailService::new(
            gate,
            scheduler(),
            renderer.clone(),
            Some(root.clone()),
            config,
        )
        .expect("second service");
        let before = renderer.renders.load(Ordering::SeqCst);
        second_service
            .request(ThumbnailRequest {
                request_id: "durable-2".to_string(),
                ..durable
            })
            .expect("cache request")
            .join()
            .expect("cache result");
        assert_eq!(renderer.renders.load(Ordering::SeqCst), before);
        fs::remove_dir_all(root).expect("thumbnail cache cleanup");
    }

    #[test]
    fn source_version_change_rejects_output_and_does_not_poison_memory_cache() {
        let gate = Arc::new(FakeGate::new("v1"));
        let renderer = Arc::new(FakeRenderer::new(false));
        let renders = Arc::clone(&renderer.renders);
        let service = service(
            Arc::clone(&gate),
            Arc::clone(&renderer),
            None,
            ThumbnailServiceConfig::default(),
        );
        let request = ThumbnailRequest::new(
            "version-one",
            source("file"),
            ThumbnailVariant::Large,
            WorkClass::Interactive,
        );
        service
            .request(request.clone())
            .expect("first request")
            .join()
            .expect("first result");
        *lock(&gate.version) = "v2".to_string();
        service
            .request(ThumbnailRequest::new(
                "version-two",
                request.source,
                request.variant,
                request.work_class,
            ))
            .expect("changed-version request")
            .join()
            .expect("changed-version result");
        assert_eq!(renders.load(Ordering::SeqCst), 2);
        assert_eq!(service.memory_cache_len(), 2);
    }

    #[test]
    fn durable_source_version_and_renderer_version_changes_miss_old_cache() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("repository root")
            .join(".tmp-tests")
            .join("thumbnail-version-cache")
            .join(uuid::Uuid::new_v4().to_string());
        let gate = Arc::new(FakeGate::new("v1"));
        let renderer = Arc::new(FakeRenderer::new(false));
        let service = ThumbnailService::new(
            gate.clone(),
            scheduler(),
            renderer.clone(),
            Some(root.clone()),
            ThumbnailServiceConfig::default(),
        )
        .expect("service");
        let request = ThumbnailRequest::new(
            "version-1",
            source("same-managed-file"),
            ThumbnailVariant::Medium,
            WorkClass::Interactive,
        );
        service
            .request(request.clone())
            .expect("first")
            .join()
            .expect("result");
        let first_render_count = renderer.renders.load(Ordering::SeqCst);
        *lock(&gate.version) = "v2".to_string();
        service
            .request(ThumbnailRequest {
                request_id: "version-2".to_string(),
                ..request.clone()
            })
            .expect("changed-version request")
            .join()
            .expect("changed-version result");
        assert_eq!(
            renderer.renders.load(Ordering::SeqCst),
            first_render_count + 1
        );

        let renderer_v2 = Arc::new(FakeRenderer::new(false).with_version("2"));
        let service_v2 = ThumbnailService::new(
            gate,
            scheduler(),
            renderer_v2.clone(),
            Some(root.clone()),
            ThumbnailServiceConfig::default(),
        )
        .expect("new renderer service");
        service_v2
            .request(ThumbnailRequest {
                request_id: "renderer-version-2".to_string(),
                ..request
            })
            .expect("renderer-version request")
            .join()
            .expect("renderer-version result");
        assert_eq!(renderer_v2.renders.load(Ordering::SeqCst), 1);
        fs::remove_dir_all(root).expect("thumbnail cache cleanup");
    }

    #[test]
    fn memory_and_disk_cache_limits_evict_oldest_valid_entries() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("repository root")
            .join(".tmp-tests")
            .join("thumbnail-eviction")
            .join(uuid::Uuid::new_v4().to_string());
        let gate = Arc::new(FakeGate::new("v1"));
        let renderer = Arc::new(FakeRenderer::new(false));
        let config = ThumbnailServiceConfig {
            memory_max_entries: 1,
            memory_max_bytes: 3,
            disk_max_entries: 1,
            disk_max_bytes: 3,
            ..ThumbnailServiceConfig::default()
        };
        let service =
            ThumbnailService::new(gate, scheduler(), renderer, Some(root.clone()), config)
                .expect("service");
        for (index, file) in ["evict-1", "evict-2"].into_iter().enumerate() {
            service
                .request(ThumbnailRequest::new(
                    format!("evict-{index}"),
                    source(file),
                    ThumbnailVariant::Small,
                    WorkClass::Interactive,
                ))
                .expect("eviction request")
                .join()
                .expect("eviction result");
        }
        assert_eq!(service.memory_cache_len(), 1);
        let disk_entries = fs::read_dir(&root)
            .expect("cache root")
            .filter_map(Result::ok)
            .filter(|entry| entry.path().extension().and_then(|ext| ext.to_str()) == Some("thumb"))
            .count();
        assert!(disk_entries <= 1);
        fs::remove_dir_all(root).expect("thumbnail cache cleanup");
    }

    #[cfg(not(target_os = "macos"))]
    #[test]
    fn non_macos_quick_look_adapter_is_explicitly_unsupported() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("repository root")
            .join(".tmp-tests")
            .join("thumbnail-non-macos")
            .join(uuid::Uuid::new_v4().to_string());
        let gate = Arc::new(FakeGate::new("v1"));
        let renderer = Arc::new(MacQuickLookThumbnailRenderer::new(
            crate::platform::macos::quick_look::MacThumbnailService::new(root.clone()),
        ));
        let service = service(
            gate,
            renderer,
            Some(root.clone()),
            ThumbnailServiceConfig::default(),
        );
        let result = service
            .request(ThumbnailRequest::new(
                "unsupported-native",
                source("native-file"),
                ThumbnailVariant::Small,
                WorkClass::Interactive,
            ))
            .expect("request")
            .join();
        assert_eq!(result.unwrap_err(), ThumbnailError::UnsupportedRenderer);
        fs::remove_dir_all(root).expect("thumbnail cache cleanup");
    }

    #[test]
    fn dispose_revokes_pending_owners_and_clears_session_memory() {
        let gate = Arc::new(FakeGate::new("v1"));
        let renderer = Arc::new(FakeRenderer::new(false));
        let service = service(gate, renderer, None, ThumbnailServiceConfig::default());
        let task = service
            .request(ThumbnailRequest::new(
                "dispose-request",
                source("dispose-file"),
                ThumbnailVariant::Small,
                WorkClass::Interactive,
            ))
            .expect("request");
        assert!(service.dispose());
        assert_eq!(task.join().unwrap_err(), ThumbnailError::Cancelled);
        assert!(!service.dispose());
        assert_eq!(service.active_request_count(), 0);
        assert_eq!(service.memory_cache_len(), 0);
        assert_eq!(
            service
                .request(ThumbnailRequest::new(
                    "after-dispose",
                    source("dispose-file-2"),
                    ThumbnailVariant::Small,
                    WorkClass::Interactive,
                ))
                .unwrap_err(),
            ThumbnailError::Disposed
        );
    }

    #[test]
    fn repeated_request_cancel_cycles_return_to_steady_state() {
        let gate = Arc::new(FakeGate::new("v1"));
        let renderer = Arc::new(FakeRenderer::new(false));
        let service = service(
            Arc::clone(&gate),
            renderer,
            None,
            ThumbnailServiceConfig::default(),
        );
        for index in 0..40 {
            let task = service
                .request(ThumbnailRequest::new(
                    format!("request-{index}"),
                    source(&format!("file-{index}")),
                    ThumbnailVariant::Small,
                    WorkClass::Interactive,
                ))
                .expect("request");
            if index % 2 == 0 {
                assert!(task.cancel());
                assert_eq!(task.join().unwrap_err(), ThumbnailError::Cancelled);
            } else {
                task.join().expect("request result");
            }
        }
        assert_eq!(service.active_request_count(), 0);
        assert_eq!(gate.leases.load(Ordering::SeqCst), 0);
        assert_eq!(
            service.inner.scheduler.snapshot().granted,
            ResourceHints::empty()
        );
    }
}
