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
const STAGE_PREFIX: &str = ".native-preview-";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct NativePreviewAccessConfig {
    pub(crate) max_records: usize,
    pub(crate) max_file_bytes: u64,
    pub(crate) max_total_bytes: u64,
    pub(crate) ttl: Duration,
    pub(crate) read_chunk_bytes: u32,
}

impl Default for NativePreviewAccessConfig {
    fn default() -> Self {
        Self {
            max_records: 8,
            max_file_bytes: 256 * 1024 * 1024,
            max_total_bytes: 512 * 1024 * 1024,
            ttl: Duration::from_secs(60),
            read_chunk_bytes: 512 * 1024,
        }
    }
}

impl NativePreviewAccessConfig {
    fn validate(self) -> Result<Self, NativePreviewAccessError> {
        if self.max_records == 0
            || self.max_file_bytes == 0
            || self.max_total_bytes < self.max_file_bytes
            || self.ttl.is_zero()
            || self.read_chunk_bytes == 0
            || self.read_chunk_bytes > 1024 * 1024
        {
            return Err(NativePreviewAccessError::InvalidRequest);
        }
        Ok(self)
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
    config: NativePreviewAccessConfig,
    state: Mutex<AccessState>,
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

#[cfg_attr(
    not(test),
    expect(
        dead_code,
        reason = "W4-02 will activate the complete Native Preview Access staging seam"
    )
)]
impl NativePreviewAccessRegistry {
    pub(crate) fn new(
        root: PathBuf,
        read_gate: Arc<MaterializationReadGate>,
        config: NativePreviewAccessConfig,
    ) -> Result<Arc<Self>, NativePreviewAccessError> {
        let config = config.validate()?;
        initialize_root(&root)?;
        cleanup_abandoned(&root);
        Ok(Arc::new(Self {
            root,
            read_gate,
            config,
            state: Mutex::new(AccessState::default()),
        }))
    }

    pub(crate) fn stage(
        &self,
        request: NativePreviewAccessRequest,
        context: &PreviewOperationContext,
    ) -> Result<NativePreviewAccessHandle, NativePreviewAccessError> {
        validate_request(&request, context)?;
        context.ensure_active().map_err(map_context_error)?;
        self.prune_expired();

        let reservation = self.reserve(&request)?;
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

        let bytes = self.copy_complete_source(&request, context, &reservation, &mut staged)?;
        staged
            .flush()
            .map_err(|_| NativePreviewAccessError::Failed)?;
        drop(staged);

        reservation.ensure_active()?;
        context.ensure_active().map_err(map_context_error)?;
        let current_version = self
            .read_gate
            .current_source_version(&request.source)
            .map_err(map_gate_error)?;
        if current_version != request.source_version {
            return Err(NativePreviewAccessError::IdentityChanged);
        }
        context.ensure_active().map_err(map_context_error)?;

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
        reservation.commit(token.clone(), record)?;
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
                    reservation
                        .ensure_active()
                        .map_err(|_| PreviewReadAccessError::Cancelled)
                },
                staged,
            )
            .map_err(map_verified_copy_error)
    }

    /// Backend/native-only token resolution. This path must never be wrapped by
    /// a generic renderer-facing Tauri command.
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
    fs::create_dir_all(root).map_err(|_| NativePreviewAccessError::Failed)?;
    set_private_directory(root)
}

fn create_private_directory(path: &Path) -> Result<(), NativePreviewAccessError> {
    fs::create_dir(path).map_err(|_| NativePreviewAccessError::Failed)?;
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
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    let now = SystemTime::now();
    for entry in entries.flatten().take(ABANDONED_CLEANUP_LIMIT) {
        let name = entry.file_name();
        if !name.to_string_lossy().starts_with(STAGE_PREFIX) {
            continue;
        }
        let stale = entry
            .metadata()
            .ok()
            .and_then(|metadata| metadata.modified().ok())
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
    if let Err(error) = fs::remove_dir_all(path) {
        if error.kind() != std::io::ErrorKind::NotFound {
            eprintln!("native_preview_stage_cleanup_failed:{error}");
        }
    }
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
mod tests {
    use super::*;
    use crate::file_workspace::{
        preview::{PreviewCancellation, PreviewOperationContext},
        read_gate::{
            ReadGateConfig, ReadGateSourceResolver, ResolvedContentSource, SourceResolutionError,
        },
    };
    use std::{
        collections::HashMap,
        io::{self, Write},
        sync::{
            atomic::{AtomicBool, AtomicUsize, Ordering},
            Arc, Mutex,
        },
        time::Duration,
    };

    struct TestResolver {
        sources: Mutex<HashMap<String, PathBuf>>,
        resolve_count: AtomicUsize,
        replace_on_resolve: Mutex<Option<(usize, PathBuf)>>,
    }

    impl TestResolver {
        fn resolve_count(&self) -> usize {
            self.resolve_count.load(Ordering::Acquire)
        }

        fn replace_on_resolve(&self, resolve_number: usize, path: PathBuf) {
            *self.replace_on_resolve.lock().unwrap() = Some((resolve_number, path));
        }
    }

    impl ReadGateSourceResolver for TestResolver {
        fn resolve_source(
            &self,
            source: &PreviewSourceRef,
        ) -> Result<ResolvedContentSource, SourceResolutionError> {
            let resolve_number = self.resolve_count.fetch_add(1, Ordering::AcqRel) + 1;
            let PreviewSourceRef::Managed { file_id } = source else {
                return Err(SourceResolutionError::NotSupported);
            };
            let replacement = {
                let mut replacement = self.replace_on_resolve.lock().unwrap();
                replacement
                    .as_ref()
                    .is_some_and(|(expected_number, _)| *expected_number == resolve_number)
                    .then(|| replacement.take())
                    .flatten()
            };
            if let Some((_, path)) = replacement {
                self.sources.lock().unwrap().insert(file_id.clone(), path);
            }
            self.sources
                .lock()
                .unwrap()
                .get(file_id)
                .cloned()
                .map(ResolvedContentSource::from_backend_path)
                .ok_or(SourceResolutionError::Unavailable)
        }
    }

    struct Fixture {
        root: PathBuf,
    }

    impl Fixture {
        fn new() -> Self {
            let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .parent()
                .unwrap()
                .join(".tmp-tests")
                .join(format!("native-preview-access-{}", Uuid::new_v4()));
            fs::create_dir_all(&root).unwrap();
            Self { root }
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    fn setup(
        bytes: &[u8],
    ) -> (
        Fixture,
        Arc<MaterializationReadGate>,
        Arc<NativePreviewAccessRegistry>,
        PreviewSourceRef,
        String,
        Arc<TestResolver>,
    ) {
        setup_with_config(
            bytes,
            NativePreviewAccessConfig {
                max_records: 2,
                max_file_bytes: 1024 * 1024,
                max_total_bytes: 2 * 1024 * 1024,
                ttl: Duration::from_secs(30),
                read_chunk_bytes: 64 * 1024,
            },
        )
    }

    fn setup_with_config(
        bytes: &[u8],
        native_config: NativePreviewAccessConfig,
    ) -> (
        Fixture,
        Arc<MaterializationReadGate>,
        Arc<NativePreviewAccessRegistry>,
        PreviewSourceRef,
        String,
        Arc<TestResolver>,
    ) {
        let fixture = Fixture::new();
        let source_path = fixture.root.join("document.pdf");
        fs::write(&source_path, bytes).unwrap();
        let resolver = Arc::new(TestResolver {
            sources: Mutex::new(HashMap::from([("file-1".to_string(), source_path)])),
            resolve_count: AtomicUsize::new(0),
            replace_on_resolve: Mutex::new(None),
        });
        let gate = Arc::new(
            MaterializationReadGate::new(Arc::clone(&resolver), ReadGateConfig::default()).unwrap(),
        );
        let source = PreviewSourceRef::Managed {
            file_id: "file-1".to_string(),
        };
        let source_version = gate.current_source_version(&source).unwrap();
        let registry = NativePreviewAccessRegistry::new(
            fixture.root.join("staging"),
            Arc::clone(&gate),
            native_config,
        )
        .unwrap();
        (fixture, gate, registry, source, source_version, resolver)
    }

    fn context(source_version: &str) -> PreviewOperationContext {
        PreviewOperationContext::for_backend_content_read(
            "session-1",
            "request-1",
            source_version,
            PreviewCancellation::default(),
            Instant::now() + Duration::from_secs(2),
        )
    }

    fn assert_no_stage_roots(registry: &NativePreviewAccessRegistry) {
        let roots = fs::read_dir(&registry.root)
            .unwrap()
            .flatten()
            .filter(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .starts_with(STAGE_PREFIX)
            })
            .count();
        assert_eq!(roots, 0);
    }

    struct CancelingWriter {
        bytes: Vec<u8>,
        cancellation: Option<PreviewCancellation>,
        gate: Option<Arc<MaterializationReadGate>>,
        lease_revoked: Option<Arc<AtomicBool>>,
    }

    impl Write for CancelingWriter {
        fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
            self.bytes.extend_from_slice(bytes);
            if let Some(cancellation) = self.cancellation.take() {
                cancellation.cancel();
            }
            if let Some(gate) = self.gate.take() {
                gate.dispose();
            }
            if let Some(lease_revoked) = self.lease_revoked.take() {
                lease_revoked.store(true, Ordering::Release);
            }
            Ok(bytes.len())
        }

        fn flush(&mut self) -> io::Result<()> {
            Ok(())
        }
    }

    #[test]
    fn stages_complete_source_behind_opaque_host_bound_token() {
        let (_fixture, _gate, registry, source, source_version, _resolver) =
            setup(b"native preview bytes");
        let operation = context(&source_version);
        let handle = registry
            .stage(
                NativePreviewAccessRequest {
                    session_id: "session-1".to_string(),
                    request_id: "request-1".to_string(),
                    source,
                    source_version: source_version.clone(),
                    host: PreviewHostKind::ZenFloating,
                },
                &operation,
            )
            .unwrap();
        assert!(!handle.token.contains("document.pdf"));
        let path = registry
            .resolve(&NativePreviewAccessResolveRequest {
                token: handle.token,
                session_id: "session-1".to_string(),
                request_id: "request-1".to_string(),
                source_version,
                host: PreviewHostKind::ZenFloating,
            })
            .unwrap();
        assert_eq!(fs::read(path).unwrap(), b"native preview bytes");
        assert_eq!(registry.counts(), (1, 0, 20));
    }

    #[test]
    fn wrong_host_and_host_provided_input_fail_closed() {
        let (_fixture, _gate, registry, source, source_version, _resolver) = setup(b"bytes");
        let operation = context(&source_version);
        assert_eq!(
            registry.stage(
                NativePreviewAccessRequest {
                    session_id: "session-1".to_string(),
                    request_id: "request-1".to_string(),
                    source: source.clone(),
                    source_version: source_version.clone(),
                    host: PreviewHostKind::WindowsPreviewHandler,
                },
                &operation,
            ),
            Err(NativePreviewAccessError::UnsupportedHost)
        );
        assert_eq!(
            registry.stage(
                NativePreviewAccessRequest {
                    session_id: "session-1".to_string(),
                    request_id: "request-1".to_string(),
                    source: PreviewSourceRef::HostProvided {
                        host_token: "host-1".to_string(),
                    },
                    source_version,
                    host: PreviewHostKind::ZenFloating,
                },
                &operation,
            ),
            Err(NativePreviewAccessError::UnsupportedSource)
        );
    }

    #[test]
    fn revoke_session_removes_staged_source_and_token() {
        let (_fixture, _gate, registry, source, source_version, _resolver) = setup(b"bytes");
        let operation = context(&source_version);
        let handle = registry
            .stage(
                NativePreviewAccessRequest {
                    session_id: "session-1".to_string(),
                    request_id: "request-1".to_string(),
                    source,
                    source_version: source_version.clone(),
                    host: PreviewHostKind::ZenFloating,
                },
                &operation,
            )
            .unwrap();
        registry.revoke_session("session-1");
        assert_eq!(registry.counts(), (0, 0, 0));
        assert_eq!(
            registry.resolve(&NativePreviewAccessResolveRequest {
                token: handle.token,
                session_id: "session-1".to_string(),
                request_id: "request-1".to_string(),
                source_version,
                host: PreviewHostKind::ZenFloating,
            }),
            Err(NativePreviewAccessError::InvalidOrStale)
        );
    }

    #[test]
    fn complete_multi_chunk_staging_uses_one_fresh_source_resolution_for_the_copy() {
        let bytes = vec![b'x'; 64 * 1024 + 17];
        let (_fixture, _gate, registry, source, source_version, resolver) = setup(&bytes);
        let operation = context(&source_version);
        let handle = registry
            .stage(
                NativePreviewAccessRequest {
                    session_id: "session-1".to_string(),
                    request_id: "request-1".to_string(),
                    source,
                    source_version: source_version.clone(),
                    host: PreviewHostKind::ZenFloating,
                },
                &operation,
            )
            .unwrap();
        let path = registry
            .resolve(&NativePreviewAccessResolveRequest {
                token: handle.token,
                session_id: "session-1".to_string(),
                request_id: "request-1".to_string(),
                source_version,
                host: PreviewHostKind::ZenFloating,
            })
            .unwrap();
        assert_eq!(fs::read(path).unwrap(), bytes);
        // setup's version lookup, the staging-name hint and the final
        // publication revalidation account for three resolutions. The copy
        // itself contributes exactly one fresh resolution, regardless of the
        // number of chunks.
        assert_eq!(resolver.resolve_count(), 4);
    }

    #[test]
    fn over_budget_copy_deletes_partial_staging_and_releases_capacity() {
        let (_fixture, _gate, registry, source, source_version, _resolver) = setup_with_config(
            b"too-large",
            NativePreviewAccessConfig {
                max_records: 2,
                max_file_bytes: 4,
                max_total_bytes: 4,
                ttl: Duration::from_secs(30),
                read_chunk_bytes: 2,
            },
        );
        let operation = context(&source_version);
        assert_eq!(
            registry.stage(
                NativePreviewAccessRequest {
                    session_id: "session-1".to_string(),
                    request_id: "request-1".to_string(),
                    source,
                    source_version,
                    host: PreviewHostKind::ZenFloating,
                },
                &operation,
            ),
            Err(NativePreviewAccessError::SourceTooLarge)
        );
        assert_eq!(registry.counts(), (0, 0, 0));
        assert_no_stage_roots(&registry);
    }

    #[test]
    fn cancelled_and_deadline_expired_requests_fail_before_publish() {
        let (_fixture, _gate, registry, source, source_version, _resolver) = setup(b"bytes");
        let cancellation = PreviewCancellation::default();
        cancellation.cancel();
        let cancelled = PreviewOperationContext::for_backend_content_read(
            "session-1",
            "request-1",
            source_version.clone(),
            cancellation,
            Instant::now() + Duration::from_secs(2),
        );
        assert_eq!(
            registry.stage(
                NativePreviewAccessRequest {
                    session_id: "session-1".to_string(),
                    request_id: "request-1".to_string(),
                    source: source.clone(),
                    source_version: source_version.clone(),
                    host: PreviewHostKind::ZenFloating,
                },
                &cancelled,
            ),
            Err(NativePreviewAccessError::Cancelled)
        );

        let expired = PreviewOperationContext::for_backend_content_read(
            "session-1",
            "request-1",
            source_version.clone(),
            PreviewCancellation::default(),
            Instant::now() - Duration::from_secs(1),
        );
        assert_eq!(
            registry.stage(
                NativePreviewAccessRequest {
                    session_id: "session-1".to_string(),
                    request_id: "request-1".to_string(),
                    source,
                    source_version,
                    host: PreviewHostKind::ZenFloating,
                },
                &expired,
            ),
            Err(NativePreviewAccessError::TimedOut)
        );
        assert_eq!(registry.counts(), (0, 0, 0));
        assert_no_stage_roots(&registry);
    }

    #[test]
    fn final_source_version_drift_discards_completed_copy() {
        let (fixture, _gate, registry, source, source_version, resolver) = setup(b"original");
        let replacement = fixture.root.join("replacement.pdf");
        fs::write(&replacement, b"replacement").unwrap();
        resolver.replace_on_resolve(4, replacement);
        let operation = context(&source_version);
        assert_eq!(
            registry.stage(
                NativePreviewAccessRequest {
                    session_id: "session-1".to_string(),
                    request_id: "request-1".to_string(),
                    source,
                    source_version,
                    host: PreviewHostKind::ZenFloating,
                },
                &operation,
            ),
            Err(NativePreviewAccessError::IdentityChanged)
        );
        assert_eq!(registry.counts(), (0, 0, 0));
        assert_no_stage_roots(&registry);
    }

    #[test]
    fn verified_copy_fails_closed_on_cancel_and_read_gate_revoke() {
        let (_fixture, gate, _registry, source, source_version, _resolver) =
            setup(b"copy cancellation fixture");
        let cancellation = PreviewCancellation::default();
        let canceled_context = PreviewOperationContext::for_backend_content_read(
            "session-1",
            "request-1",
            source_version.clone(),
            cancellation.clone(),
            Instant::now() + Duration::from_secs(2),
        );
        let mut canceled_writer = CancelingWriter {
            bytes: Vec::new(),
            cancellation: Some(cancellation),
            gate: None,
            lease_revoked: None,
        };
        assert_eq!(
            gate.stream_verified_source_to_writer(
                &source,
                &source_version,
                &canceled_context,
                VerifiedCopyBounds {
                    max_total_bytes: 1024,
                    chunk_bytes: 4,
                },
                || Ok(()),
                &mut canceled_writer,
            ),
            Err(VerifiedCopyError::Access(PreviewReadAccessError::Cancelled))
        );
        assert!(!canceled_writer.bytes.is_empty());
        assert_eq!(gate.active_lease_count(), 0);

        let lease_revoked = Arc::new(AtomicBool::new(false));
        let mut lease_revoked_writer = CancelingWriter {
            bytes: Vec::new(),
            cancellation: None,
            gate: None,
            lease_revoked: Some(Arc::clone(&lease_revoked)),
        };
        assert_eq!(
            gate.stream_verified_source_to_writer(
                &source,
                &source_version,
                &context(&source_version),
                VerifiedCopyBounds {
                    max_total_bytes: 1024,
                    chunk_bytes: 4,
                },
                || {
                    if lease_revoked.load(Ordering::Acquire) {
                        Err(PreviewReadAccessError::Cancelled)
                    } else {
                        Ok(())
                    }
                },
                &mut lease_revoked_writer,
            ),
            Err(VerifiedCopyError::Access(PreviewReadAccessError::Cancelled))
        );
        assert!(!lease_revoked_writer.bytes.is_empty());
        assert_eq!(gate.active_lease_count(), 0);

        let operation = context(&source_version);
        let mut revoked_writer = CancelingWriter {
            bytes: Vec::new(),
            cancellation: None,
            gate: Some(Arc::clone(&gate)),
            lease_revoked: None,
        };
        assert_eq!(
            gate.stream_verified_source_to_writer(
                &source,
                &source_version,
                &operation,
                VerifiedCopyBounds {
                    max_total_bytes: 1024,
                    chunk_bytes: 4,
                },
                || Ok(()),
                &mut revoked_writer,
            ),
            Err(VerifiedCopyError::Access(
                PreviewReadAccessError::LeaseInvalid
            ))
        );
        assert!(!revoked_writer.bytes.is_empty());
        assert_eq!(gate.active_lease_count(), 0);
    }
}
