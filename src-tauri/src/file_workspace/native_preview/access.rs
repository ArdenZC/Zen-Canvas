//! Zen-owned Native Preview Access staging.
//!
//! This registry owns only disposable native-presentation artifacts. Source
//! eligibility, sourceVersion truth and actual byte opens remain owned by the
//! existing MaterializationReadGate. Native callers receive an opaque token;
//! only backend/native bridge code may resolve it to a private staged path.

use crate::file_workspace::{
    contracts::{PreviewHostKind, PreviewSourceRef},
    preview::{PreviewContextError, PreviewOperationContext, PreviewReadAccessError},
    read_gate::{MaterializationReadGate, ReadGateError, VerifiedCopyBounds, VerifiedCopyError},
};
use crate::scheduler::{adapters::NativePreviewResourceLeaseAdapter, AcquireError};
#[cfg(test)]
use std::io;
use std::{
    collections::HashMap,
    fs::{self, File, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, MutexGuard,
    },
    time::{Duration, Instant, SystemTime},
};
use thiserror::Error;
use uuid::Uuid;

const TOKEN_LIMIT: usize = 256;
const ABANDONED_CLEANUP_LIMIT: usize = 128;
const ABANDONED_MIN_AGE: Duration = Duration::from_secs(10 * 60);
const DEFAULT_MAX_ACQUISITION_DURATION: Duration = Duration::from_secs(20);
const STAGE_PREFIX: &str = ".native-preview-";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct NativePreviewAccessConfig {
    pub(crate) max_records: usize,
    pub(crate) max_file_bytes: u64,
    pub(crate) max_total_bytes: u64,
    pub(crate) ttl: Duration,
    pub(crate) read_chunk_bytes: u32,
    pub(crate) max_acquisition_duration: Duration,
}

impl Default for NativePreviewAccessConfig {
    fn default() -> Self {
        Self {
            max_records: 8,
            max_file_bytes: 256 * 1024 * 1024,
            max_total_bytes: 512 * 1024 * 1024,
            ttl: Duration::from_secs(60),
            read_chunk_bytes: 512 * 1024,
            max_acquisition_duration: DEFAULT_MAX_ACQUISITION_DURATION,
        }
    }
}

impl NativePreviewAccessConfig {
    fn validate(self) -> Result<Self, NativePreviewAccessError> {
        let live_lifetime = self.max_acquisition_duration.checked_add(self.ttl);
        if self.max_records == 0
            || self.max_file_bytes == 0
            || self.max_total_bytes < self.max_file_bytes
            || self.ttl.is_zero()
            || self.read_chunk_bytes == 0
            || self.read_chunk_bytes > 1024 * 1024
            || self.max_acquisition_duration.is_zero()
            || self.max_acquisition_duration >= ABANDONED_MIN_AGE
            || live_lifetime.is_none_or(|lifetime| lifetime >= ABANDONED_MIN_AGE)
        {
            return Err(NativePreviewAccessError::InvalidRequest);
        }
        Ok(self)
    }

    fn validate_against_read_gate_lease(
        self,
        read_gate_lease_ttl: Duration,
    ) -> Result<Self, NativePreviewAccessError> {
        let config = self.validate()?;
        if config.max_acquisition_duration >= read_gate_lease_ttl {
            return Err(NativePreviewAccessError::InvalidRequest);
        }
        Ok(config)
    }
}

#[derive(Debug, Clone)]
pub(crate) struct NativePreviewAccessRequest {
    pub(crate) session_id: String,
    pub(crate) request_id: String,
    pub(crate) source: PreviewSourceRef,
    pub(crate) source_version: String,
    pub(crate) host: PreviewHostKind,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct NativePreviewAccessHandle {
    pub(crate) token: String,
}

#[derive(Debug, Clone)]
pub(crate) struct NativePreviewAccessResolveRequest {
    pub(crate) token: String,
    pub(crate) session_id: String,
    pub(crate) request_id: String,
    pub(crate) source_version: String,
    pub(crate) host: PreviewHostKind,
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub(crate) enum NativePreviewAccessError {
    #[error("native preview access request is invalid")]
    InvalidRequest,
    #[error("native preview host is not eligible for Zen-owned staging")]
    UnsupportedHost,
    #[error("native preview source must remain managed or ephemeral")]
    UnsupportedSource,
    #[error("native preview access registry is at capacity")]
    CapacityExceeded,
    #[error("native preview source exceeds the staging budget")]
    SourceTooLarge,
    #[error("native preview source is unavailable")]
    SourceUnavailable,
    #[error("native preview source requires materialization")]
    MaterializationRequired,
    #[error("native preview source is metadata-only")]
    MetadataOnly,
    #[error("native preview permission was denied")]
    PermissionDenied,
    #[error("native preview source identity changed")]
    IdentityChanged,
    #[error("native preview access was cancelled")]
    Cancelled,
    #[error("native preview access timed out")]
    TimedOut,
    #[error("native preview access token is invalid or stale")]
    InvalidOrStale,
    #[error("native preview access registry is disposed")]
    Disposed,
    #[error("native preview staging failed")]
    Failed,
}

#[derive(Debug)]
struct AccessRecord {
    session_id: String,
    request_id: String,
    source_version: String,
    host: PreviewHostKind,
    stage_root: PathBuf,
    staged_path: PathBuf,
    bytes: u64,
    expires_at: Instant,
}

#[derive(Debug)]
struct InflightRecord {
    session_id: String,
    request_id: String,
    source_version: String,
    host: PreviewHostKind,
    cancelled: Arc<AtomicBool>,
    reserved_bytes: u64,
}

#[derive(Debug, Default)]
struct AccessState {
    records: HashMap<String, AccessRecord>,
    inflight: HashMap<String, InflightRecord>,
    total_bytes: u64,
    reserved_bytes: u64,
    disposed: bool,
}

pub(crate) struct NativePreviewAccessRegistry {
    root: PathBuf,
    read_gate: Arc<MaterializationReadGate>,
    admission: NativePreviewResourceLeaseAdapter,
    config: NativePreviewAccessConfig,
    state: Mutex<AccessState>,
    #[cfg(test)]
    test_hooks: TestHooks,
}

#[cfg(test)]
#[derive(Default)]
struct TestHooks {
    before_commit: Mutex<Option<Arc<dyn Fn() + Send + Sync>>>,
    after_first_copy_chunk: Mutex<Option<Arc<dyn Fn() + Send + Sync>>>,
    force_timeout: AtomicBool,
}

/// Reserves registry capacity while staging is in flight. Revocation flips the
/// shared cancellation flag immediately; the reservation is removed on drop.
struct StageReservation<'a> {
    registry: &'a NativePreviewAccessRegistry,
    stage_id: String,
    cancelled: Arc<AtomicBool>,
    active: bool,
}

impl StageReservation<'_> {
    fn ensure_active(&self) -> Result<(), NativePreviewAccessError> {
        if self.cancelled.load(Ordering::Acquire) {
            Err(NativePreviewAccessError::Cancelled)
        } else {
            Ok(())
        }
    }

    fn commit(
        mut self,
        token: String,
        record: AccessRecord,
        context: &PreviewOperationContext,
    ) -> Result<(), NativePreviewAccessError> {
        let mut state = lock(&self.registry.state);
        let Some(inflight) = state.inflight.remove(&self.stage_id) else {
            self.active = false;
            return Err(NativePreviewAccessError::Cancelled);
        };
        state.reserved_bytes = state.reserved_bytes.saturating_sub(inflight.reserved_bytes);
        self.active = false;

        if state.disposed {
            return Err(NativePreviewAccessError::Disposed);
        }
        if inflight.cancelled.load(Ordering::Acquire) {
            return Err(NativePreviewAccessError::Cancelled);
        }
        context.ensure_active().map_err(map_context_error)?;
        if inflight.session_id != record.session_id
            || inflight.request_id != record.request_id
            || inflight.source_version != record.source_version
            || inflight.host != record.host
        {
            return Err(NativePreviewAccessError::InvalidRequest);
        }
        let total = state
            .total_bytes
            .checked_add(record.bytes)
            .ok_or(NativePreviewAccessError::CapacityExceeded)?;
        if total > self.registry.config.max_total_bytes
            || state.records.len() >= self.registry.config.max_records
            || state.records.contains_key(&token)
        {
            return Err(NativePreviewAccessError::CapacityExceeded);
        }
        state.total_bytes = total;
        state.records.insert(token, record);
        Ok(())
    }
}

#[cfg(test)]
struct StageCopyWriter<'a> {
    file: &'a mut File,
    registry: &'a NativePreviewAccessRegistry,
    writes: usize,
}

#[cfg(test)]
impl Write for StageCopyWriter<'_> {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        let written = self.file.write(bytes)?;
        if written > 0 {
            self.writes += 1;
            if self.writes == 1 {
                self.registry.run_after_first_copy_chunk_hook();
            }
        }
        Ok(written)
    }

    fn flush(&mut self) -> io::Result<()> {
        self.file.flush()
    }
}

impl Drop for StageReservation<'_> {
    fn drop(&mut self) {
        if !self.active {
            return;
        }
        let mut state = lock(&self.registry.state);
        if let Some(inflight) = state.inflight.remove(&self.stage_id) {
            state.reserved_bytes = state.reserved_bytes.saturating_sub(inflight.reserved_bytes);
        }
    }
}

/// Deletes a staging directory on every early-return edge. It is disarmed only
/// after the ready record has been committed atomically into the registry.
struct StageRootGuard {
    path: Option<PathBuf>,
}

impl StageRootGuard {
    fn new(path: PathBuf) -> Self {
        Self { path: Some(path) }
    }

    fn disarm(mut self) {
        self.path.take();
    }
}

impl Drop for StageRootGuard {
    fn drop(&mut self) {
        if let Some(path) = self.path.take() {
            cleanup_stage_root(&path);
        }
    }
}

impl NativePreviewAccessRegistry {
    pub(crate) fn new(
        root: PathBuf,
        read_gate: Arc<MaterializationReadGate>,
        scheduler: Arc<crate::scheduler::WorkScheduler>,
        config: NativePreviewAccessConfig,
    ) -> Result<Arc<Self>, NativePreviewAccessError> {
        let config = config.validate_against_read_gate_lease(read_gate.lease_ttl())?;
        initialize_root(&root)?;
        cleanup_abandoned(&root);
        Ok(Arc::new(Self {
            root,
            read_gate,
            admission: NativePreviewResourceLeaseAdapter::new(scheduler),
            config,
            state: Mutex::new(AccessState::default()),
            #[cfg(test)]
            test_hooks: TestHooks::default(),
        }))
    }

    #[cfg_attr(
        not(test),
        expect(
            dead_code,
            reason = "W4-02 will activate the Native Preview Access staging consumer"
        )
    )]
    pub(crate) fn stage(
        &self,
        request: NativePreviewAccessRequest,
        context: &PreviewOperationContext,
    ) -> Result<NativePreviewAccessHandle, NativePreviewAccessError> {
        validate_request(&request, context)?;
        context.ensure_active().map_err(map_context_error)?;
        let acquisition_deadline = Instant::now()
            .checked_add(self.config.max_acquisition_duration)
            .ok_or(NativePreviewAccessError::InvalidRequest)?;
        let effective_context = context.with_deadline(acquisition_deadline);
        effective_context
            .ensure_active()
            .map_err(map_context_error)?;
        self.prune_expired();

        let reservation = self.reserve(&request)?;
        let scheduler_cancellation =
            effective_context.scheduler_cancellation_with(Arc::clone(&reservation.cancelled));
        let _scheduler_lease = self
            .admission
            .acquire(
                &request.request_id,
                &request.session_id,
                scheduler_cancellation,
                effective_context.deadline(),
            )
            .map_err(|error| map_admission_error(error, &effective_context))?;
        reservation.ensure_active()?;
        effective_context
            .ensure_active()
            .map_err(map_context_error)?;
        let stage_root = self
            .root
            .join(format!("{STAGE_PREFIX}{}", reservation.stage_id));
        let source_name = self
            .read_gate
            .source_file_name(&request.source)
            .unwrap_or_else(|| "source.bin".to_string());
        let source_name = safe_leaf_name(&source_name)?;

        create_private_directory(&stage_root)?;
        let stage_guard = StageRootGuard::new(stage_root.clone());
        let staged_path = stage_root.join(source_name);
        let mut staged = create_private_file(&staged_path)?;

        let bytes =
            self.copy_complete_source(&request, &effective_context, &reservation, &mut staged)?;
        staged
            .flush()
            .map_err(|_| NativePreviewAccessError::Failed)?;
        drop(staged);

        reservation.ensure_active()?;
        effective_context
            .ensure_active()
            .map_err(map_context_error)?;
        let current_version = self
            .read_gate
            .current_source_version(&request.source)
            .map_err(map_gate_error)?;
        if current_version != request.source_version {
            return Err(NativePreviewAccessError::IdentityChanged);
        }
        effective_context
            .ensure_active()
            .map_err(map_context_error)?;

        let token = Uuid::new_v4().to_string();
        let expires_at = Instant::now()
            .checked_add(self.config.ttl)
            .ok_or(NativePreviewAccessError::InvalidRequest)?;
        let record = AccessRecord {
            session_id: request.session_id,
            request_id: request.request_id,
            source_version: request.source_version,
            host: request.host,
            stage_root,
            staged_path,
            bytes,
            expires_at,
        };
        #[cfg(test)]
        self.run_before_commit_hook();
        reservation.commit(token.clone(), record, &effective_context)?;
        if let Err(error) = effective_context.ensure_active() {
            self.revoke_token(&token);
            return Err(map_context_error(error));
        }
        stage_guard.disarm();
        Ok(NativePreviewAccessHandle { token })
    }

    fn copy_complete_source(
        &self,
        request: &NativePreviewAccessRequest,
        context: &PreviewOperationContext,
        reservation: &StageReservation<'_>,
        staged: &mut File,
    ) -> Result<u64, NativePreviewAccessError> {
        reservation.ensure_active()?;
        context.ensure_active().map_err(map_context_error)?;
        #[cfg(test)]
        let mut staged_writer = StageCopyWriter {
            file: staged,
            registry: self,
            writes: 0,
        };
        #[cfg(not(test))]
        let mut staged_writer = staged;
        self.read_gate
            .stream_verified_source_to_writer(
                &request.source,
                &request.source_version,
                context,
                VerifiedCopyBounds {
                    max_total_bytes: self.config.max_file_bytes,
                    chunk_bytes: self.config.read_chunk_bytes,
                },
                || {
                    #[cfg(test)]
                    if reservation.registry.take_forced_timeout_for_test() {
                        return Err(PreviewReadAccessError::TimedOut);
                    }
                    reservation
                        .ensure_active()
                        .map_err(|_| PreviewReadAccessError::Cancelled)
                },
                &mut staged_writer,
            )
            .map_err(map_verified_copy_error)
    }

    /// Backend/native-only token resolution. This path must never be wrapped by
    /// a generic renderer-facing Tauri command.
    #[cfg_attr(
        not(test),
        expect(
            dead_code,
            reason = "W4-02 will activate the Native Preview Access token consumer"
        )
    )]
    pub(crate) fn resolve(
        &self,
        request: &NativePreviewAccessResolveRequest,
    ) -> Result<PathBuf, NativePreviewAccessError> {
        if !valid_token(&request.token)
            || !valid_token(&request.session_id)
            || !valid_token(&request.request_id)
            || !valid_token(&request.source_version)
            || !zen_host(request.host)
        {
            return Err(NativePreviewAccessError::InvalidOrStale);
        }
        self.prune_expired();
        let (path, expected_bytes) = {
            let state = lock(&self.state);
            if state.disposed {
                return Err(NativePreviewAccessError::Disposed);
            }
            let record = state
                .records
                .get(&request.token)
                .ok_or(NativePreviewAccessError::InvalidOrStale)?;
            if record.session_id != request.session_id
                || record.request_id != request.request_id
                || record.source_version != request.source_version
                || record.host != request.host
            {
                return Err(NativePreviewAccessError::InvalidOrStale);
            }
            (record.staged_path.clone(), record.bytes)
        };
        let metadata =
            fs::symlink_metadata(&path).map_err(|_| NativePreviewAccessError::InvalidOrStale)?;
        if !metadata.is_file()
            || metadata.file_type().is_symlink()
            || metadata.len() != expected_bytes
        {
            return Err(NativePreviewAccessError::InvalidOrStale);
        }
        Ok(path)
    }

    pub(crate) fn revoke_request(
        &self,
        session_id: &str,
        request_id: &str,
        source_version: Option<&str>,
    ) {
        let roots = {
            let mut state = lock(&self.state);
            for inflight in state.inflight.values() {
                if inflight.session_id == session_id
                    && inflight.request_id == request_id
                    && source_version.is_none_or(|version| inflight.source_version == version)
                {
                    inflight.cancelled.store(true, Ordering::Release);
                }
            }
            take_records_where(&mut state, |record| {
                record.session_id == session_id
                    && record.request_id == request_id
                    && source_version.is_none_or(|version| record.source_version == version)
            })
        };
        cleanup_roots(roots);
    }

    pub(crate) fn revoke_session(&self, session_id: &str) {
        let roots = {
            let mut state = lock(&self.state);
            for inflight in state.inflight.values() {
                if inflight.session_id == session_id {
                    inflight.cancelled.store(true, Ordering::Release);
                }
            }
            take_records_where(&mut state, |record| record.session_id == session_id)
        };
        cleanup_roots(roots);
    }

    fn revoke_token(&self, token: &str) {
        let root = {
            let mut state = lock(&self.state);
            let Some(record) = state.records.remove(token) else {
                return;
            };
            state.total_bytes = state.total_bytes.saturating_sub(record.bytes);
            record.stage_root
        };
        cleanup_stage_root(&root);
    }

    pub(crate) fn dispose(&self) {
        let roots = {
            let mut state = lock(&self.state);
            if state.disposed {
                return;
            }
            state.disposed = true;
            for inflight in state.inflight.values() {
                inflight.cancelled.store(true, Ordering::Release);
            }
            let roots = state
                .records
                .drain()
                .map(|(_, record)| record.stage_root)
                .collect::<Vec<_>>();
            state.total_bytes = 0;
            roots
        };
        cleanup_roots(roots);
    }

    fn reserve(
        &self,
        request: &NativePreviewAccessRequest,
    ) -> Result<StageReservation<'_>, NativePreviewAccessError> {
        let stage_id = Uuid::new_v4().to_string();
        let cancelled = Arc::new(AtomicBool::new(false));
        let mut state = lock(&self.state);
        if state.disposed {
            return Err(NativePreviewAccessError::Disposed);
        }
        if state.records.len() + state.inflight.len() >= self.config.max_records {
            return Err(NativePreviewAccessError::CapacityExceeded);
        }
        let reserved_total = state
            .total_bytes
            .checked_add(state.reserved_bytes)
            .and_then(|value| value.checked_add(self.config.max_file_bytes))
            .ok_or(NativePreviewAccessError::CapacityExceeded)?;
        if reserved_total > self.config.max_total_bytes {
            return Err(NativePreviewAccessError::CapacityExceeded);
        }
        state.reserved_bytes += self.config.max_file_bytes;
        state.inflight.insert(
            stage_id.clone(),
            InflightRecord {
                session_id: request.session_id.clone(),
                request_id: request.request_id.clone(),
                source_version: request.source_version.clone(),
                host: request.host,
                cancelled: Arc::clone(&cancelled),
                reserved_bytes: self.config.max_file_bytes,
            },
        );
        Ok(StageReservation {
            registry: self,
            stage_id,
            cancelled,
            active: true,
        })
    }

    fn prune_expired(&self) {
        let now = Instant::now();
        let roots = {
            let mut state = lock(&self.state);
            take_records_where(&mut state, |record| record.expires_at <= now)
        };
        cleanup_roots(roots);
    }

    #[cfg(test)]
    pub(crate) fn counts(&self) -> (usize, usize, u64) {
        self.prune_expired();
        let state = lock(&self.state);
        (state.records.len(), state.inflight.len(), state.total_bytes)
    }

    #[cfg(test)]
    fn set_before_commit_hook(&self, hook: Option<Arc<dyn Fn() + Send + Sync>>) {
        *lock(&self.test_hooks.before_commit) = hook;
    }

    #[cfg(test)]
    pub(crate) fn set_after_first_copy_chunk_hook(
        &self,
        hook: Option<Arc<dyn Fn() + Send + Sync>>,
    ) {
        *lock(&self.test_hooks.after_first_copy_chunk) = hook;
    }

    #[cfg(test)]
    pub(crate) fn force_timeout_for_test(&self) {
        self.test_hooks.force_timeout.store(true, Ordering::Release);
    }

    #[cfg(test)]
    fn take_forced_timeout_for_test(&self) -> bool {
        self.test_hooks.force_timeout.swap(false, Ordering::AcqRel)
    }

    #[cfg(test)]
    pub(crate) fn force_expire_records_for_test(&self) {
        let mut state = lock(&self.state);
        let now = Instant::now();
        let expired_at = now.checked_sub(Duration::from_secs(1)).unwrap_or(now);
        for record in state.records.values_mut() {
            record.expires_at = expired_at;
        }
    }

    #[cfg(test)]
    fn run_before_commit_hook(&self) {
        let hook = lock(&self.test_hooks.before_commit).take();
        if let Some(hook) = hook {
            hook();
        }
    }

    #[cfg(test)]
    fn run_after_first_copy_chunk_hook(&self) {
        let hook = lock(&self.test_hooks.after_first_copy_chunk).take();
        if let Some(hook) = hook {
            hook();
        }
    }
}

fn validate_request(
    request: &NativePreviewAccessRequest,
    context: &PreviewOperationContext,
) -> Result<(), NativePreviewAccessError> {
    if !valid_token(&request.session_id)
        || !valid_token(&request.request_id)
        || !valid_token(&request.source_version)
        || request.session_id != context.session_id()
        || request.request_id != context.request_id()
        || context.source_version() != Some(request.source_version.as_str())
    {
        return Err(NativePreviewAccessError::InvalidRequest);
    }
    if !zen_host(request.host) {
        return Err(NativePreviewAccessError::UnsupportedHost);
    }
    if matches!(request.source, PreviewSourceRef::HostProvided { .. }) {
        return Err(NativePreviewAccessError::UnsupportedSource);
    }
    Ok(())
}

fn zen_host(host: PreviewHostKind) -> bool {
    matches!(
        host,
        PreviewHostKind::ZenFloating | PreviewHostKind::ZenPinned
    )
}

fn valid_token(value: &str) -> bool {
    !value.is_empty() && value.len() <= TOKEN_LIMIT
}

fn safe_leaf_name(value: &str) -> Result<String, NativePreviewAccessError> {
    let candidate = Path::new(value);
    if value.is_empty()
        || value.len() > TOKEN_LIMIT
        || candidate.file_name().and_then(|name| name.to_str()) != Some(value)
        || value.contains('/')
        || value.contains('\\')
    {
        return Err(NativePreviewAccessError::InvalidRequest);
    }
    Ok(value.to_string())
}

fn initialize_root(root: &Path) -> Result<(), NativePreviewAccessError> {
    match fs::symlink_metadata(root) {
        Ok(metadata) => {
            if !is_verified_real_directory(&metadata) {
                return Err(NativePreviewAccessError::Failed);
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            fs::create_dir(root).map_err(|_| NativePreviewAccessError::Failed)?;
            let metadata =
                fs::symlink_metadata(root).map_err(|_| NativePreviewAccessError::Failed)?;
            if !is_verified_real_directory(&metadata) {
                return Err(NativePreviewAccessError::Failed);
            }
        }
        Err(_) => return Err(NativePreviewAccessError::Failed),
    }
    set_private_directory(root)
}

fn create_private_directory(path: &Path) -> Result<(), NativePreviewAccessError> {
    fs::create_dir(path).map_err(|_| NativePreviewAccessError::Failed)?;
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(_) => {
            cleanup_stage_root(path);
            return Err(NativePreviewAccessError::Failed);
        }
    };
    if !is_verified_real_directory(&metadata) {
        cleanup_stage_root(path);
        return Err(NativePreviewAccessError::Failed);
    }
    if let Err(error) = set_private_directory(path) {
        cleanup_stage_root(path);
        return Err(error);
    }
    Ok(())
}

fn create_private_file(path: &Path) -> Result<File, NativePreviewAccessError> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(path)
            .map_err(|_| NativePreviewAccessError::Failed)
    }
    #[cfg(not(unix))]
    {
        OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(path)
            .map_err(|_| NativePreviewAccessError::Failed)
    }
}

fn set_private_directory(path: &Path) -> Result<(), NativePreviewAccessError> {
    let metadata = fs::symlink_metadata(path).map_err(|_| NativePreviewAccessError::Failed)?;
    if !is_verified_real_directory(&metadata) {
        return Err(NativePreviewAccessError::Failed);
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700))
            .map_err(|_| NativePreviewAccessError::Failed)?;
    }
    let _ = path;
    Ok(())
}

fn cleanup_abandoned(root: &Path) {
    if !is_verified_real_directory_path(root) {
        return;
    }
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    let now = SystemTime::now();
    for entry in entries.flatten().take(ABANDONED_CLEANUP_LIMIT) {
        let name = entry.file_name();
        if !name.to_string_lossy().starts_with(STAGE_PREFIX) {
            continue;
        }
        let Ok(metadata) = fs::symlink_metadata(entry.path()) else {
            continue;
        };
        if !is_verified_real_directory(&metadata) {
            continue;
        }
        let stale = metadata
            .modified()
            .ok()
            .and_then(|modified| now.duration_since(modified).ok())
            .is_some_and(|age| age >= ABANDONED_MIN_AGE);
        if stale {
            cleanup_stage_root(&entry.path());
        }
    }
}

fn take_records_where(
    state: &mut AccessState,
    predicate: impl Fn(&AccessRecord) -> bool,
) -> Vec<PathBuf> {
    let tokens = state
        .records
        .iter()
        .filter(|&(_, record)| predicate(record))
        .map(|(token, _)| token.clone())
        .collect::<Vec<_>>();
    let mut roots = Vec::with_capacity(tokens.len());
    for token in tokens {
        if let Some(record) = state.records.remove(&token) {
            state.total_bytes = state.total_bytes.saturating_sub(record.bytes);
            roots.push(record.stage_root);
        }
    }
    roots
}

fn cleanup_roots(roots: Vec<PathBuf>) {
    for root in roots {
        cleanup_stage_root(&root);
    }
}

fn cleanup_stage_root(path: &Path) {
    let owned_stage_root = path
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.starts_with(STAGE_PREFIX));
    if !owned_stage_root || !is_verified_real_directory_path(path) {
        return;
    }
    if let Err(error) = fs::remove_dir_all(path) {
        if error.kind() != std::io::ErrorKind::NotFound {
            eprintln!("native_preview_stage_cleanup_failed:{error}");
        }
    }
}

fn is_verified_real_directory_path(path: &Path) -> bool {
    fs::symlink_metadata(path)
        .ok()
        .is_some_and(|metadata| is_verified_real_directory(&metadata))
}

fn is_verified_real_directory(metadata: &fs::Metadata) -> bool {
    metadata.is_dir() && !metadata.file_type().is_symlink() && !is_reparse_point(metadata)
}

#[cfg(windows)]
fn is_reparse_point(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;

    is_reparse_point_attributes(metadata.file_attributes())
}

#[cfg(windows)]
fn is_reparse_point_attributes(attributes: u32) -> bool {
    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
    attributes & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn is_reparse_point(_metadata: &fs::Metadata) -> bool {
    false
}

fn lock<T>(value: &Mutex<T>) -> MutexGuard<'_, T> {
    value
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}

fn map_verified_copy_error(error: VerifiedCopyError) -> NativePreviewAccessError {
    match error {
        VerifiedCopyError::InvalidRequest => NativePreviewAccessError::InvalidRequest,
        VerifiedCopyError::SourceTooLarge => NativePreviewAccessError::SourceTooLarge,
        VerifiedCopyError::Access(error) => map_read_error(error),
    }
}

fn map_admission_error(
    error: AcquireError,
    context: &PreviewOperationContext,
) -> NativePreviewAccessError {
    match error {
        AcquireError::Cancelled => NativePreviewAccessError::Cancelled,
        AcquireError::WouldBlock => {
            if context.remaining().is_zero() {
                NativePreviewAccessError::TimedOut
            } else {
                NativePreviewAccessError::CapacityExceeded
            }
        }
        AcquireError::QueueFull => NativePreviewAccessError::CapacityExceeded,
        AcquireError::InvalidRequest(_)
        | AcquireError::Unavailable
        | AcquireError::PolicyDenied => NativePreviewAccessError::Failed,
    }
}

fn map_read_error(error: PreviewReadAccessError) -> NativePreviewAccessError {
    match error {
        PreviewReadAccessError::LeaseInvalid => NativePreviewAccessError::InvalidOrStale,
        PreviewReadAccessError::SourceVersionMismatch => NativePreviewAccessError::IdentityChanged,
        PreviewReadAccessError::PermissionDenied => NativePreviewAccessError::PermissionDenied,
        PreviewReadAccessError::SourceUnavailable => NativePreviewAccessError::SourceUnavailable,
        PreviewReadAccessError::MaterializationRequired => {
            NativePreviewAccessError::MaterializationRequired
        }
        PreviewReadAccessError::MetadataOnly => NativePreviewAccessError::MetadataOnly,
        PreviewReadAccessError::Cancelled => NativePreviewAccessError::Cancelled,
        PreviewReadAccessError::TimedOut => NativePreviewAccessError::TimedOut,
        PreviewReadAccessError::Failed => NativePreviewAccessError::Failed,
    }
}

fn map_gate_error(error: ReadGateError) -> NativePreviewAccessError {
    match error {
        ReadGateError::IdentityChanged => NativePreviewAccessError::IdentityChanged,
        ReadGateError::PermissionDenied => NativePreviewAccessError::PermissionDenied,
        ReadGateError::SourceUnavailable | ReadGateError::AvailabilityUnknown => {
            NativePreviewAccessError::SourceUnavailable
        }
        ReadGateError::MaterializationRequired | ReadGateError::Downloading => {
            NativePreviewAccessError::MaterializationRequired
        }
        ReadGateError::MetadataOnly => NativePreviewAccessError::MetadataOnly,
        ReadGateError::LeaseInvalid | ReadGateError::Disposed => {
            NativePreviewAccessError::InvalidOrStale
        }
        ReadGateError::SourceNotSupported
        | ReadGateError::PackageUnsupported
        | ReadGateError::Symlink
        | ReadGateError::InvalidRequest
        | ReadGateError::LeaseCapacityExceeded => NativePreviewAccessError::Failed,
    }
}

fn map_context_error(error: PreviewContextError) -> NativePreviewAccessError {
    match error {
        PreviewContextError::Cancelled => NativePreviewAccessError::Cancelled,
        PreviewContextError::TimedOut => NativePreviewAccessError::TimedOut,
        PreviewContextError::StalePublication => NativePreviewAccessError::IdentityChanged,
    }
}

#[cfg(test)]
#[path = "tests/access_support.rs"]
mod access_test_support;

#[cfg(test)]
#[path = "tests/access_lifecycle.rs"]
mod access_lifecycle_tests;

#[cfg(test)]
#[path = "tests/access_read_boundary.rs"]
mod access_read_boundary_tests;

#[cfg(test)]
#[path = "tests/access_scheduler.rs"]
mod access_scheduler_tests;
