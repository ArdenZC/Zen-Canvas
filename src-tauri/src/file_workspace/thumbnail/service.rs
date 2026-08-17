//! Thumbnail service orchestration, owner lifecycle and publication coordination.

use super::super::{
    contracts::{ContentReadLeaseRef, EntryRef, PreviewSourceRef, WorkClass},
    preview::PreviewCancellation,
    read_gate::ReadGateError,
};
use super::{
    cache::{CacheIdentity, GenerationKey, ThumbnailCache},
    dispatch::ThumbnailDispatch,
    lock,
    read::{ThumbnailReadGate, ThumbnailRenderContext, ThumbnailRenderContextInit},
    renderer::ThumbnailRenderer,
    types::{
        ThumbnailArtifact, ThumbnailConfigError, ThumbnailError, ThumbnailRenderRequest,
        ThumbnailRendererDescriptor, ThumbnailRendererError, ThumbnailRequest,
        ThumbnailServiceConfig, MAX_OPAQUE_ID_LENGTH,
    },
};
use crate::scheduler::{AcquireError, CancellationToken, WorkRequest, WorkScheduler};
#[cfg(test)]
use std::sync::atomic::AtomicUsize;
#[cfg(test)]
use std::thread;
use std::{
    collections::HashMap,
    fmt,
    panic::{catch_unwind, AssertUnwindSafe},
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, AtomicU8, Ordering},
        mpsc::{self, Receiver, SyncSender},
        Arc, Mutex, Weak,
    },
    time::Instant,
};

pub(super) struct ThumbnailServiceInner {
    pub(super) gate: Arc<dyn ThumbnailReadGate>,
    pub(super) scheduler: Arc<WorkScheduler>,
    pub(super) renderer: Arc<dyn ThumbnailRenderer>,
    pub(super) renderer_descriptor: ThumbnailRendererDescriptor,
    pub(super) cache: ThumbnailCache,
    pub(super) config: ThumbnailServiceConfig,
    pub(super) state: Mutex<ThumbnailState>,
    pub(super) disposed: AtomicBool,
    pub(super) dispatch: ThumbnailDispatch,
    #[cfg(test)]
    pub(super) interactive_queued: AtomicBool,
    #[cfg(test)]
    pub(super) retry_observed: AtomicBool,
    #[cfg(test)]
    pub(super) background_admission_attempts: AtomicUsize,
    #[cfg(test)]
    pub(super) publication_barrier: Arc<PublicationBarrier>,
}

#[derive(Clone)]
/// A disposable, bounded, deduplicating thumbnail service.
pub struct ThumbnailService {
    pub(super) inner: Arc<ThumbnailServiceInner>,
}

#[derive(Clone)]
pub(super) struct GenerationSeed {
    pub(super) generation_id: u64,
    pub(super) request: ThumbnailRequest,
    pub(super) source: PreviewSourceRef,
    pub(super) source_version: String,
    pub(super) key: GenerationKey,
    pub(super) logical_cache_key: String,
    pub(super) renderer: ThumbnailRendererDescriptor,
    pub(super) scheduler_cancellation: CancellationToken,
    pub(super) render_cancellation: PreviewCancellation,
    effective_work_class: Arc<AtomicU8>,
}

struct ThumbnailOwner {
    sender: SyncSender<Result<ThumbnailArtifact, ThumbnailError>>,
    cancelled: Arc<AtomicBool>,
    work_class: WorkClass,
}

struct InFlight {
    seed: GenerationSeed,
    owners: HashMap<u64, ThumbnailOwner>,
    publication: Arc<Mutex<()>>,
}

impl GenerationSeed {
    pub(super) fn effective_work_class(&self) -> WorkClass {
        work_class_from_code(self.effective_work_class.load(Ordering::Acquire))
    }

    fn set_effective_work_class(&self, work_class: WorkClass) {
        self.effective_work_class
            .store(work_class_code(work_class), Ordering::Release);
    }
}

fn work_class_code(work_class: WorkClass) -> u8 {
    match work_class {
        WorkClass::Foreground => 0,
        WorkClass::Interactive => 1,
        WorkClass::Background => 2,
    }
}

fn work_class_from_code(code: u8) -> WorkClass {
    match code {
        0 => WorkClass::Foreground,
        1 => WorkClass::Interactive,
        _ => WorkClass::Background,
    }
}

fn work_class_priority(work_class: WorkClass) -> u8 {
    work_class_code(work_class)
}

fn refresh_effective_work_class(inflight: &InFlight) {
    let Some(work_class) = inflight
        .owners
        .values()
        .filter(|owner| !owner.cancelled.load(Ordering::Acquire))
        .map(|owner| owner.work_class)
        .min_by_key(|work_class| work_class_priority(*work_class))
    else {
        return;
    };
    inflight.seed.set_effective_work_class(work_class);
}

#[derive(Default)]
pub(super) struct ThumbnailState {
    next_owner_id: u64,
    next_generation_id: u64,
    inflight: HashMap<GenerationKey, InFlight>,
}

#[cfg(test)]
pub(super) struct PublicationBarrier {
    pub(super) enabled: AtomicBool,
    pub(super) entered: AtomicBool,
    pub(super) completed: AtomicBool,
    pub(super) release: AtomicBool,
}

#[cfg(test)]
impl PublicationBarrier {
    fn new() -> Self {
        Self {
            enabled: AtomicBool::new(false),
            entered: AtomicBool::new(false),
            completed: AtomicBool::new(false),
            release: AtomicBool::new(false),
        }
    }

    pub(super) fn arm(&self) {
        self.entered.store(false, Ordering::Release);
        self.completed.store(false, Ordering::Release);
        self.release.store(false, Ordering::Release);
        self.enabled.store(true, Ordering::Release);
    }

    pub(super) fn release(&self) {
        self.release.store(true, Ordering::Release);
    }

    fn wait_if_armed(&self) {
        if !self.enabled.load(Ordering::Acquire) {
            return;
        }
        self.entered.store(true, Ordering::Release);
        while !self.release.load(Ordering::Acquire) {
            thread::yield_now();
        }
        self.completed.store(true, Ordering::Release);
        self.enabled.store(false, Ordering::Release);
    }
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
    receiver: Mutex<Receiver<Result<ThumbnailArtifact, ThumbnailError>>>,
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
    /// Wait for the one-shot result while retaining the owner handle so a
    /// separate lifecycle command can cancel this exact request owner.
    pub fn join(&self) -> Result<ThumbnailArtifact, ThumbnailError> {
        self.receiver
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
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
        let renderer_descriptor = renderer.descriptor();
        Ok(Self {
            inner: Arc::new(ThumbnailServiceInner {
                gate,
                scheduler,
                renderer,
                renderer_descriptor,
                cache: ThumbnailCache::new(cache_dir, &config)
                    .map_err(ThumbnailConfigError::UnsafeCacheDirectory)?,
                dispatch: ThumbnailDispatch::new(config.worker_count, config.queue_capacity),
                config,
                state: Mutex::new(ThumbnailState::default()),
                disposed: AtomicBool::new(false),
                #[cfg(test)]
                interactive_queued: AtomicBool::new(false),
                #[cfg(test)]
                retry_observed: AtomicBool::new(false),
                #[cfg(test)]
                background_admission_attempts: AtomicUsize::new(0),
                #[cfg(test)]
                publication_barrier: Arc::new(PublicationBarrier::new()),
            }),
        })
    }

    pub fn request(&self, request: ThumbnailRequest) -> Result<ThumbnailTask, ThumbnailError> {
        if self.inner.disposed.load(Ordering::Acquire) {
            return Err(ThumbnailError::Disposed);
        }
        let prepared = prepare_request(&self.inner, request)?;
        if let Some(artifact) = self.inner.cache.memory_lookup(&prepared.key) {
            return Ok(ready_task(artifact));
        }
        if prepared.key.identity.is_durable() {
            if let Some(artifact) = self.inner.cache.disk_lookup(&prepared.key) {
                self.inner
                    .cache
                    .memory_insert(prepared.key.clone(), artifact.clone());
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
                            work_class: prepared.request.work_class,
                        },
                    );
                    refresh_effective_work_class(existing);
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
                        effective_work_class: Arc::new(AtomicU8::new(work_class_code(
                            prepared.request.work_class,
                        ))),
                    };
                    let mut owners = HashMap::new();
                    owners.insert(
                        owner_id,
                        ThumbnailOwner {
                            sender,
                            cancelled: Arc::clone(&owner_cancelled),
                            work_class: prepared.request.work_class,
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
                    .dispatch
                    .submit(Arc::downgrade(&self.inner), prepared.key.clone(), seed)
            {
                fail_submission(&self.inner, &prepared.key, generation_id, owner_id, error);
                return Err(error);
            }
        }

        Ok(ThumbnailTask {
            receiver: Mutex::new(receiver),
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
        self.inner.cache.memory_len()
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
            drop(state);
            self.inner.cache.clear_memory();
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
        receiver: Mutex::new(receiver),
        control: None,
    }
}

pub(super) enum GenerationError {
    Retry,
    Final(ThumbnailError),
}

impl From<ThumbnailError> for GenerationError {
    fn from(error: ThumbnailError) -> Self {
        Self::Final(error)
    }
}

pub(super) fn run_generation(
    inner: Arc<ThumbnailServiceInner>,
    key: GenerationKey,
    seed: GenerationSeed,
) {
    let result = catch_unwind(AssertUnwindSafe(|| generate(&inner, &seed)))
        .unwrap_or(Err(GenerationError::Final(ThumbnailError::RendererFailed)));
    match result {
        Ok(artifact) => {
            finish_generation(&inner, &key, seed.generation_id, Ok(artifact));
            inner.dispatch.complete();
        }
        Err(GenerationError::Final(error)) => {
            finish_generation(&inner, &key, seed.generation_id, Err(error));
            inner.dispatch.complete();
        }
        Err(GenerationError::Retry) => {
            #[cfg(test)]
            inner.retry_observed.store(true, Ordering::Release);
            if inner.disposed.load(Ordering::Acquire)
                || !has_live_owners(&inner, &key, seed.generation_id)
            {
                finish_generation(
                    &inner,
                    &key,
                    seed.generation_id,
                    Err(ThumbnailError::Cancelled),
                );
                inner.dispatch.complete();
            } else if let Err(error) =
                inner
                    .dispatch
                    .resubmit(Arc::downgrade(&inner), key.clone(), seed.clone())
            {
                finish_generation(&inner, &key, seed.generation_id, Err(error));
                inner.dispatch.complete();
            }
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
    let work_class = seed.effective_work_class();
    #[cfg(test)]
    if work_class == WorkClass::Background {
        inner
            .background_admission_attempts
            .fetch_add(1, Ordering::SeqCst);
    }
    let work_request = WorkRequest::new(
        seed.request.request_id.clone(),
        work_class,
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
    let context = ThumbnailRenderContext::new(ThumbnailRenderContextInit {
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
        scheduler_cancellation: seed.scheduler_cancellation.clone(),
        cancellation: seed.render_cancellation.clone(),
        deadline: Instant::now() + inner.config.generation_timeout,
    });
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
    #[cfg(test)]
    inner.publication_barrier.wait_if_armed();
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
        let _ = inner.cache.disk_store(&seed.key, &artifact.bytes);
    }
    let state = lock(&inner.state);
    if !can_publish_locked(inner, &state, seed) {
        return Err(ThumbnailError::Cancelled);
    }
    inner
        .cache
        .memory_insert(seed.key.clone(), artifact.clone());
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
        } else {
            refresh_effective_work_class(inflight);
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
