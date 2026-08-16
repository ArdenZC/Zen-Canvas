//! Bounded W1-07 materialization/read gate.
//!
//! This module adapts the existing platform byte-read authority to the
//! opaque content-read lease contract from Preview Core.  It owns only
//! process-local, bounded lease state.  It does not persist leases, resolve
//! renderer paths, materialize provider content, or perform filesystem
//! mutation.

use super::{
    browse::{BrowseError, BrowseService},
    contracts::{ContentReadEligibility, ContentReadLeaseRef, EntryRef, PreviewSourceRef},
    preview::{
        BoundedContentRead, BoundedContentReadRequest, ContentReadAccessError,
        ContentReadLeaseConsumer, PreviewOperationContext,
    },
};
use crate::{
    db::Database,
    fs_safety::{capture_physical_identity, PhysicalFileIdentity, PhysicalIdentityError},
};
use std::{
    collections::HashMap,
    fs::{self, File},
    io::{self, Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    sync::{Arc, Mutex, MutexGuard},
    time::{Duration, Instant},
};
use thiserror::Error;

#[cfg(not(target_os = "macos"))]
use std::fs::OpenOptions;

const MAX_TOKEN_LENGTH: usize = 256;
const DEFAULT_MAX_ACTIVE_LEASES: usize = 128;
const DEFAULT_MAX_READ_BYTES: u32 = 1024 * 1024;
const DEFAULT_LEASE_TTL: Duration = Duration::from_secs(30);

/// The reason a byte consumer wants access to a source.
///
/// `MetadataOnly` is intentionally not a byte-read intent.  It is retained
/// as an explicit rejected value so a caller cannot accidentally turn a
/// metadata probe into a lease request.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ReadIntent {
    Preview,
    Thumbnail,
    ContentAnalysis,
    Hashing,
    MetadataOnly,
}

impl ReadIntent {
    const fn requires_bytes(self) -> bool {
        !matches!(self, Self::MetadataOnly)
    }
}

/// W1 policy: content is never materialized implicitly.  A future explicit
/// user action may cross this boundary through the existing materialization
/// authority; this gate does not execute that action.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MaterializationPolicy {
    NeverImplicit,
    UserInitiatedOnly,
}

/// Bounds for the process-local lease registry and every individual read.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ReadGateConfig {
    pub max_active_leases: usize,
    pub max_read_bytes: u32,
    pub lease_ttl: Duration,
    pub materialization_policy: MaterializationPolicy,
}

impl Default for ReadGateConfig {
    fn default() -> Self {
        Self {
            max_active_leases: DEFAULT_MAX_ACTIVE_LEASES,
            max_read_bytes: DEFAULT_MAX_READ_BYTES,
            lease_ttl: DEFAULT_LEASE_TTL,
            materialization_policy: MaterializationPolicy::UserInitiatedOnly,
        }
    }
}

impl ReadGateConfig {
    #[allow(dead_code)]
    fn validate(self) -> Result<Self, ReadGateConfigError> {
        if self.max_active_leases == 0 {
            return Err(ReadGateConfigError::ZeroLeaseCapacity);
        }
        if self.max_read_bytes == 0 {
            return Err(ReadGateConfigError::ZeroReadLimit);
        }
        if self.lease_ttl.is_zero() || Instant::now().checked_add(self.lease_ttl).is_none() {
            return Err(ReadGateConfigError::InvalidLeaseLifetime);
        }
        Ok(self)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Error)]
pub enum ReadGateConfigError {
    #[error("content read lease capacity must be non-zero")]
    ZeroLeaseCapacity,
    #[error("content read limit must be non-zero")]
    ZeroReadLimit,
    #[error("content read lease lifetime is invalid")]
    InvalidLeaseLifetime,
}

/// Errors returned while issuing or disposing a bounded lease.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Error)]
pub enum ReadGateError {
    #[error("content source is unavailable")]
    SourceUnavailable,
    #[error("content source permission was denied")]
    PermissionDenied,
    #[error("content materialization is required")]
    MaterializationRequired,
    #[error("content source is downloading")]
    Downloading,
    #[error("content source is metadata-only")]
    MetadataOnly,
    #[error("content source is not supported")]
    SourceNotSupported,
    #[error("content source package cannot be read")]
    PackageUnsupported,
    #[error("content source is a symlink or reparse point")]
    Symlink,
    #[error("content source availability is unknown")]
    AvailabilityUnknown,
    #[error("content source identity changed")]
    IdentityChanged,
    #[error("content read lease is invalid")]
    LeaseInvalid,
    #[error("content read request is invalid")]
    InvalidRequest,
    #[error("content read lease registry is at capacity")]
    LeaseCapacityExceeded,
    #[error("content read gate is disposed")]
    Disposed,
}

/// A backend-only source resolution result.  The path never crosses the
/// public lease or Preview provider boundary.
#[derive(Debug, Clone)]
pub(crate) struct ResolvedContentSource {
    path: PathBuf,
}

impl ResolvedContentSource {
    #[allow(dead_code)]
    pub(crate) fn from_backend_path(path: PathBuf) -> Self {
        Self { path }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[allow(dead_code)]
pub(crate) enum SourceResolutionError {
    Unavailable,
    PermissionDenied,
    NotSupported,
    Unknown,
}

/// Backend source resolution is deliberately an internal seam.  Production
/// callers provide an EntryRef-derived source; only this backend trait may
/// turn it into a private path for the authoritative opener.
pub(crate) trait ReadGateSourceResolver: Send + Sync {
    fn resolve_source(
        &self,
        source: &PreviewSourceRef,
    ) -> Result<ResolvedContentSource, SourceResolutionError>;
}

/// The W1-10 wiring adapter for existing managed File Library and Browse
/// authorities.  It does not persist or own either authority.
#[derive(Clone)]
#[allow(dead_code)]
pub(crate) struct WorkspaceContentSourceResolver {
    database: Database,
    browse: Arc<BrowseService>,
}

impl WorkspaceContentSourceResolver {
    #[allow(dead_code)]
    pub(crate) fn new(database: Database, browse: Arc<BrowseService>) -> Self {
        Self { database, browse }
    }
}

impl ReadGateSourceResolver for WorkspaceContentSourceResolver {
    fn resolve_source(
        &self,
        source: &PreviewSourceRef,
    ) -> Result<ResolvedContentSource, SourceResolutionError> {
        match source {
            PreviewSourceRef::Managed { file_id } => self
                .database
                .resolve_file_library_path(file_id)
                .map(|path| ResolvedContentSource::from_backend_path(PathBuf::from(path)))
                .map_err(|_| SourceResolutionError::Unavailable),
            PreviewSourceRef::Ephemeral {
                browse_session_id,
                entry_id,
            } => {
                let entry_ref = EntryRef::Ephemeral {
                    browse_session_id: browse_session_id.clone(),
                    entry_id: entry_id.clone(),
                };
                let resolved = self
                    .browse
                    .resolve_entry(&entry_ref)
                    .map_err(map_browse_resolution_error)?;
                Ok(ResolvedContentSource::from_backend_path(resolved.path))
            }
            // Host tokens are owned by a native host integration that is not
            // part of W1-07.  Never interpret them as paths.
            PreviewSourceRef::HostProvided { .. } => Err(SourceResolutionError::NotSupported),
        }
    }
}

#[derive(Debug, Clone)]
struct LeaseRecord {
    request_id: String,
    source: PreviewSourceRef,
    source_version: String,
    intent: ReadIntent,
    expires_at: Instant,
}

#[derive(Debug, Default)]
struct LeaseRegistry {
    disposed: bool,
    leases: HashMap<String, LeaseRecord>,
}

fn lock<T>(value: &Mutex<T>) -> MutexGuard<'_, T> {
    value
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}

/// The bounded W1-07 read gate.
pub struct MaterializationReadGate {
    resolver: Arc<dyn ReadGateSourceResolver>,
    config: ReadGateConfig,
    leases: Mutex<LeaseRegistry>,
}

impl MaterializationReadGate {
    #[allow(dead_code)]
    pub(crate) fn new<R>(
        resolver: Arc<R>,
        config: ReadGateConfig,
    ) -> Result<Self, ReadGateConfigError>
    where
        R: ReadGateSourceResolver + 'static,
    {
        Ok(Self {
            resolver,
            config: config.validate()?,
            leases: Mutex::new(LeaseRegistry::default()),
        })
    }

    #[allow(dead_code)]
    pub(crate) fn from_workspace_sources(
        database: Database,
        browse: Arc<BrowseService>,
        config: ReadGateConfig,
    ) -> Result<Self, ReadGateConfigError> {
        Self::new(
            Arc::new(WorkspaceContentSourceResolver::new(database, browse)),
            config,
        )
    }

    /// Project the current authoritative platform result without issuing a
    /// lease.  Errors in opaque source resolution are descriptive fail-closed
    /// states, never a path-based authorization.
    pub fn content_read_eligibility(&self, source: &PreviewSourceRef) -> ContentReadEligibility {
        if self.is_disposed() || validate_source_ref(source).is_err() {
            return ContentReadEligibility::SourceUnavailable;
        }
        let resolved = match self.resolver.resolve_source(source) {
            Ok(resolved) => resolved,
            Err(error) => return map_resolution_to_eligibility(error),
        };
        classify_path(&resolved.path)
    }

    pub fn eligibility(&self, source: &PreviewSourceRef) -> ContentReadEligibility {
        self.content_read_eligibility(source)
    }

    /// Return the current opaque source version without issuing byte access.
    /// The value contains physical identity facts only; it never contains a
    /// filesystem path.
    pub fn current_source_version(
        &self,
        source: &PreviewSourceRef,
    ) -> Result<String, ReadGateError> {
        self.ensure_usable_source(source)?;
        Ok(self.resolve_eligible(source)?.source_version)
    }

    /// Return only a backend-derived leaf name for adapters that need to keep
    /// a safe extension while staging already-authorized bytes.  The path is
    /// resolved and consumed entirely inside the read-gate authority; no path
    /// crosses the public source/lease contract.
    pub(crate) fn source_file_name(&self, source: &PreviewSourceRef) -> Option<String> {
        self.ensure_usable_source(source).ok()?;
        let resolved = self.resolver.resolve_source(source).ok()?;
        let name = resolved.path.file_name()?.to_str()?.trim();
        (!name.is_empty() && !name.contains('/') && !name.contains('\\')).then(|| name.to_string())
    }

    /// Issue a lease bound to a caller's already-resolved source version.
    /// The version is checked against a fresh backend resolution before the
    /// lease is stored.
    pub fn issue_lease(
        &self,
        request_id: impl Into<String>,
        source: PreviewSourceRef,
        source_version: impl Into<String>,
        intent: ReadIntent,
    ) -> Result<ContentReadLeaseRef, ReadGateError> {
        let request_id = request_id.into();
        let source_version = source_version.into();
        self.validate_request_id(&request_id)?;
        self.ensure_usable_source(&source)?;
        if !intent.requires_bytes() {
            return Err(ReadGateError::InvalidRequest);
        }
        if source_version.is_empty() || source_version.len() > MAX_TOKEN_LENGTH {
            return Err(ReadGateError::InvalidRequest);
        }

        let current = self.resolve_eligible(&source)?;
        if current.source_version != source_version {
            return Err(ReadGateError::IdentityChanged);
        }
        self.store_lease(request_id, source, source_version, intent)
    }

    /// Convenience for backend callers that have not yet published a
    /// PreviewSourceSnapshot.  It still resolves and validates the source
    /// before storing the lease.
    pub fn issue_lease_for_current(
        &self,
        request_id: impl Into<String>,
        source: PreviewSourceRef,
        intent: ReadIntent,
    ) -> Result<ContentReadLeaseRef, ReadGateError> {
        let request_id = request_id.into();
        self.validate_request_id(&request_id)?;
        self.ensure_usable_source(&source)?;
        if !intent.requires_bytes() {
            return Err(ReadGateError::InvalidRequest);
        }
        let current = self.resolve_eligible(&source)?;
        self.store_lease(request_id, source, current.source_version, intent)
    }

    pub fn release_lease(&self, lease: &ContentReadLeaseRef) -> Result<(), ReadGateError> {
        let mut registry = lock(&self.leases);
        if registry.disposed {
            return Err(ReadGateError::Disposed);
        }
        prune_expired(&mut registry.leases);
        let Some(record) = registry.leases.get(&lease.lease_id) else {
            return Err(ReadGateError::LeaseInvalid);
        };
        if record.request_id != lease.request_id {
            return Err(ReadGateError::LeaseInvalid);
        }
        if record.source_version != lease.source_version {
            return Err(ReadGateError::IdentityChanged);
        }
        registry.leases.remove(&lease.lease_id);
        Ok(())
    }

    /// Revoke all process-local leases.  No durable state is created.
    pub fn dispose(&self) -> bool {
        let mut registry = lock(&self.leases);
        if registry.disposed {
            return false;
        }
        registry.disposed = true;
        registry.leases.clear();
        true
    }

    pub fn active_lease_count(&self) -> usize {
        let mut registry = lock(&self.leases);
        prune_expired(&mut registry.leases);
        registry.leases.len()
    }

    fn ensure_usable_source(&self, source: &PreviewSourceRef) -> Result<(), ReadGateError> {
        if self.is_disposed() {
            return Err(ReadGateError::Disposed);
        }
        validate_source_ref(source)
    }

    fn validate_request_id(&self, request_id: &str) -> Result<(), ReadGateError> {
        if request_id.is_empty() || request_id.len() > MAX_TOKEN_LENGTH {
            return Err(ReadGateError::InvalidRequest);
        }
        if self.is_disposed() {
            return Err(ReadGateError::Disposed);
        }
        Ok(())
    }

    fn is_disposed(&self) -> bool {
        lock(&self.leases).disposed
    }

    fn resolve_eligible(
        &self,
        source: &PreviewSourceRef,
    ) -> Result<EvaluatedSource, ReadGateError> {
        let resolved = self
            .resolver
            .resolve_source(source)
            .map_err(map_resolution_to_error)?;
        let eligibility = classify_path(&resolved.path);
        if eligibility != ContentReadEligibility::Eligible {
            return Err(map_eligibility_to_error(eligibility));
        }
        let identity = capture_physical_identity(&resolved.path).map_err(map_identity_error)?;
        let source_version = source_version_for_identity(&identity)?;
        Ok(EvaluatedSource {
            path: resolved.path,
            identity,
            source_version,
        })
    }

    fn store_lease(
        &self,
        request_id: String,
        source: PreviewSourceRef,
        source_version: String,
        intent: ReadIntent,
    ) -> Result<ContentReadLeaseRef, ReadGateError> {
        let mut registry = lock(&self.leases);
        if registry.disposed {
            return Err(ReadGateError::Disposed);
        }
        prune_expired(&mut registry.leases);
        if registry.leases.len() >= self.config.max_active_leases {
            return Err(ReadGateError::LeaseCapacityExceeded);
        }
        let lease_id = uuid::Uuid::new_v4().to_string();
        let expires_at = Instant::now()
            .checked_add(self.config.lease_ttl)
            .ok_or(ReadGateError::InvalidRequest)?;
        registry.leases.insert(
            lease_id.clone(),
            LeaseRecord {
                request_id: request_id.clone(),
                source,
                source_version: source_version.clone(),
                intent,
                expires_at,
            },
        );
        Ok(ContentReadLeaseRef {
            lease_id,
            request_id,
            source_version,
        })
    }

    fn lease_is_active(&self, lease_id: &str) -> bool {
        let mut registry = lock(&self.leases);
        if registry.disposed {
            return false;
        }
        prune_expired(&mut registry.leases);
        registry.leases.contains_key(lease_id)
    }
}

impl ContentReadLeaseConsumer for MaterializationReadGate {
    fn read_bounded(
        &self,
        lease: &ContentReadLeaseRef,
        request: BoundedContentReadRequest,
        context: &PreviewOperationContext,
    ) -> Result<BoundedContentRead, ContentReadAccessError> {
        context.ensure_active().map_err(map_context_error)?;
        if request.max_bytes == 0 || request.max_bytes > self.config.max_read_bytes {
            return Err(ContentReadAccessError::Failed);
        }
        let max_bytes = u64::from(request.max_bytes);
        let read_limit = max_bytes
            .checked_add(1)
            .ok_or(ContentReadAccessError::Failed)?;
        request
            .offset_bytes
            .checked_add(read_limit)
            .ok_or(ContentReadAccessError::Failed)?;

        let record = {
            let mut registry = lock(&self.leases);
            if registry.disposed {
                return Err(ContentReadAccessError::LeaseInvalid);
            }
            prune_expired(&mut registry.leases);
            registry
                .leases
                .get(&lease.lease_id)
                .cloned()
                .ok_or(ContentReadAccessError::LeaseInvalid)?
        };
        if record.request_id != lease.request_id || record.request_id != context.request_id() {
            return Err(ContentReadAccessError::LeaseInvalid);
        }
        if record.source_version != lease.source_version
            || context.source_version() != Some(record.source_version.as_str())
        {
            return Err(ContentReadAccessError::SourceVersionMismatch);
        }
        if !record.intent.requires_bytes() {
            return Err(ContentReadAccessError::LeaseInvalid);
        }
        context.ensure_active().map_err(map_context_error)?;

        // Re-resolve the opaque source for every bounded read.  The lease is
        // not a cached path or a durable open handle.
        let current = self
            .resolve_eligible(&record.source)
            .map_err(map_gate_error_to_access)?;
        if current.source_version != record.source_version {
            return Err(ContentReadAccessError::SourceVersionMismatch);
        }
        context.ensure_active().map_err(map_context_error)?;

        let mut file = open_authoritative_file(&current.path, &current.identity)
            .map_err(map_open_error_to_access)?;
        context.ensure_active().map_err(map_context_error)?;
        file.seek(SeekFrom::Start(request.offset_bytes))
            .map_err(map_io_error_to_access)?;
        let mut bytes = Vec::new();
        file.take(read_limit)
            .read_to_end(&mut bytes)
            .map_err(map_io_error_to_access)?;
        context.ensure_active().map_err(map_context_error)?;

        // Release/dispose/expiry during the read revokes publication.  The
        // local read may have finished, but no bytes are returned to a caller.
        if !self.lease_is_active(&lease.lease_id) {
            return Err(ContentReadAccessError::LeaseInvalid);
        }
        let complete = bytes.len() <= usize::try_from(max_bytes).unwrap_or(usize::MAX);
        if !complete {
            bytes.truncate(usize::try_from(max_bytes).unwrap_or(usize::MAX));
        }
        Ok(BoundedContentRead { bytes, complete })
    }
}

#[derive(Debug, Clone)]
struct EvaluatedSource {
    path: PathBuf,
    identity: PhysicalFileIdentity,
    source_version: String,
}

fn prune_expired(leases: &mut HashMap<String, LeaseRecord>) {
    let now = Instant::now();
    leases.retain(|_, record| record.expires_at > now);
}

fn validate_source_ref(source: &PreviewSourceRef) -> Result<(), ReadGateError> {
    let valid = match source {
        PreviewSourceRef::Managed { file_id } => valid_token(file_id),
        PreviewSourceRef::Ephemeral {
            browse_session_id,
            entry_id,
        } => valid_token(browse_session_id) && valid_token(entry_id),
        PreviewSourceRef::HostProvided { host_token } => valid_token(host_token),
    };
    if valid {
        Ok(())
    } else {
        Err(ReadGateError::InvalidRequest)
    }
}

fn valid_token(value: &str) -> bool {
    !value.is_empty() && value.len() <= MAX_TOKEN_LENGTH
}

#[allow(dead_code)]
fn map_browse_resolution_error(error: BrowseError) -> SourceResolutionError {
    match error {
        BrowseError::EntryPermissionDenied | BrowseError::DirectoryPermissionDenied => {
            SourceResolutionError::PermissionDenied
        }
        BrowseError::UnsupportedEntry
        | BrowseError::InvalidEntryRef
        | BrowseError::InvalidPathRef => SourceResolutionError::NotSupported,
        BrowseError::EntryNotFound
        | BrowseError::SessionNotFound
        | BrowseError::EntryUnavailable
        | BrowseError::DirectoryNotFound
        | BrowseError::DirectoryUnavailable
        | BrowseError::StaleEnumeration
        | BrowseError::StalePublication
        | BrowseError::Cancelled => SourceResolutionError::Unavailable,
        BrowseError::StateUnavailable
        | BrowseError::InvalidRequest
        | BrowseError::InvalidCursor
        | BrowseError::InvalidPageSize
        | BrowseError::InvalidLimits
        | BrowseError::SessionCapacityExceeded
        | BrowseError::TemporaryStateCapacityExceeded
        | BrowseError::TargetNotDirectory => SourceResolutionError::Unknown,
    }
}

fn map_resolution_to_eligibility(error: SourceResolutionError) -> ContentReadEligibility {
    match error {
        SourceResolutionError::Unavailable => ContentReadEligibility::SourceUnavailable,
        SourceResolutionError::PermissionDenied => ContentReadEligibility::PermissionRequired,
        SourceResolutionError::NotSupported => ContentReadEligibility::SourceNotSupported,
        SourceResolutionError::Unknown => ContentReadEligibility::AvailabilityUnknown,
    }
}

fn map_resolution_to_error(error: SourceResolutionError) -> ReadGateError {
    match error {
        SourceResolutionError::Unavailable => ReadGateError::SourceUnavailable,
        SourceResolutionError::PermissionDenied => ReadGateError::PermissionDenied,
        SourceResolutionError::NotSupported => ReadGateError::SourceNotSupported,
        SourceResolutionError::Unknown => ReadGateError::AvailabilityUnknown,
    }
}

fn map_eligibility_to_error(eligibility: ContentReadEligibility) -> ReadGateError {
    match eligibility {
        ContentReadEligibility::Eligible => unreachable!("eligible source has no read error"),
        ContentReadEligibility::MaterializationRequired => ReadGateError::MaterializationRequired,
        ContentReadEligibility::Downloading => ReadGateError::Downloading,
        ContentReadEligibility::MetadataOnly => ReadGateError::MetadataOnly,
        ContentReadEligibility::PermissionRequired => ReadGateError::PermissionDenied,
        ContentReadEligibility::SourceUnavailable => ReadGateError::SourceUnavailable,
        ContentReadEligibility::SourceNotSupported => ReadGateError::SourceNotSupported,
        ContentReadEligibility::PackageUnsupported => ReadGateError::PackageUnsupported,
        ContentReadEligibility::Symlink => ReadGateError::Symlink,
        ContentReadEligibility::IdentityChanged => ReadGateError::IdentityChanged,
        ContentReadEligibility::AvailabilityUnknown => ReadGateError::AvailabilityUnknown,
    }
}

fn map_identity_error(error: PhysicalIdentityError) -> ReadGateError {
    match error {
        PhysicalIdentityError::Missing => ReadGateError::SourceUnavailable,
        PhysicalIdentityError::UnsupportedLink => ReadGateError::Symlink,
        PhysicalIdentityError::UnsupportedType => ReadGateError::SourceNotSupported,
        PhysicalIdentityError::Io(error) => match error.kind() {
            io::ErrorKind::PermissionDenied => ReadGateError::PermissionDenied,
            io::ErrorKind::NotFound => ReadGateError::SourceUnavailable,
            _ => ReadGateError::AvailabilityUnknown,
        },
    }
}

fn source_version_for_identity(identity: &PhysicalFileIdentity) -> Result<String, ReadGateError> {
    let physical_key = identity
        .physical_key
        .as_deref()
        .ok_or(ReadGateError::AvailabilityUnknown)?;
    Ok(format!(
        "read-source-v1:{physical_key}:{}:{}",
        identity.size,
        identity.modified_ns.unwrap_or_default()
    ))
}

fn classify_path(path: &Path) -> ContentReadEligibility {
    #[cfg(target_os = "macos")]
    {
        map_macos_eligibility(
            crate::platform::macos::file_semantics::content_read_eligibility(path),
        )
    }

    #[cfg(not(target_os = "macos"))]
    {
        let metadata = match fs::symlink_metadata(path) {
            Ok(metadata) => metadata,
            Err(error) => return map_metadata_error_to_eligibility(error),
        };
        if metadata.file_type().is_symlink() {
            return ContentReadEligibility::Symlink;
        }
        #[cfg(windows)]
        if is_windows_reparse_point(&metadata) {
            // W1-07 has no independent Windows Cloud Files/provider identity
            // authority.  Reparse-backed sources therefore fail closed.
            return ContentReadEligibility::SourceNotSupported;
        }
        if !metadata.is_file() {
            return ContentReadEligibility::SourceNotSupported;
        }
        match capture_physical_identity(path) {
            Ok(identity) if identity.physical_key.is_some() => ContentReadEligibility::Eligible,
            Ok(_) => ContentReadEligibility::AvailabilityUnknown,
            Err(error) => map_identity_error_to_eligibility(error),
        }
    }
}

#[cfg(target_os = "macos")]
fn map_macos_eligibility(
    eligibility: crate::platform::macos::MacContentReadEligibility,
) -> ContentReadEligibility {
    use crate::platform::macos::MacContentReadEligibility;

    match eligibility {
        MacContentReadEligibility::Eligible => ContentReadEligibility::Eligible,
        MacContentReadEligibility::Symlink => ContentReadEligibility::Symlink,
        MacContentReadEligibility::NonRegular
        | MacContentReadEligibility::ContentSourceNotSupported => {
            ContentReadEligibility::SourceNotSupported
        }
        MacContentReadEligibility::PackageUnsupported => ContentReadEligibility::PackageUnsupported,
        MacContentReadEligibility::ICloudItemNotLocal
        | MacContentReadEligibility::FileProviderItemNotLocal => {
            ContentReadEligibility::MaterializationRequired
        }
        MacContentReadEligibility::ICloudLocalReadDeferred
        | MacContentReadEligibility::MetadataOnly => ContentReadEligibility::MetadataOnly,
        MacContentReadEligibility::CloudDownloading => ContentReadEligibility::Downloading,
        MacContentReadEligibility::PermissionRequired => ContentReadEligibility::PermissionRequired,
        MacContentReadEligibility::ContentAvailabilityUnknown => {
            ContentReadEligibility::AvailabilityUnknown
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn map_metadata_error_to_eligibility(error: io::Error) -> ContentReadEligibility {
    match error.kind() {
        io::ErrorKind::PermissionDenied => ContentReadEligibility::PermissionRequired,
        io::ErrorKind::NotFound => ContentReadEligibility::SourceUnavailable,
        _ => ContentReadEligibility::AvailabilityUnknown,
    }
}

#[cfg(not(target_os = "macos"))]
fn map_identity_error_to_eligibility(error: PhysicalIdentityError) -> ContentReadEligibility {
    match error {
        PhysicalIdentityError::Missing => ContentReadEligibility::SourceUnavailable,
        PhysicalIdentityError::UnsupportedLink => ContentReadEligibility::SourceNotSupported,
        PhysicalIdentityError::UnsupportedType => ContentReadEligibility::SourceNotSupported,
        PhysicalIdentityError::Io(error) => map_metadata_error_to_eligibility(error),
    }
}

#[cfg(windows)]
fn is_windows_reparse_point(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    use windows_sys::Win32::Storage::FileSystem::FILE_ATTRIBUTE_REPARSE_POINT;

    metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum OpenReadError {
    PermissionDenied,
    SourceUnavailable,
    IdentityChanged,
    #[cfg(target_os = "macos")]
    Unsupported,
    Failed,
}

fn open_authoritative_file(
    path: &Path,
    expected: &PhysicalFileIdentity,
) -> Result<File, OpenReadError> {
    #[cfg(target_os = "macos")]
    let file = crate::platform::macos::file_semantics::open_content_read(path)
        .map_err(map_macos_open_error)?;

    #[cfg(not(target_os = "macos"))]
    let file = open_local_file(path).map_err(map_io_error_to_open)?;

    if !opened_file_matches(&file, expected)? {
        return Err(OpenReadError::IdentityChanged);
    }
    Ok(file)
}

#[cfg(all(not(target_os = "macos"), unix))]
fn open_local_file(path: &Path) -> io::Result<File> {
    use std::os::unix::fs::OpenOptionsExt;

    OpenOptions::new()
        .read(true)
        .custom_flags(libc::O_CLOEXEC | libc::O_NOFOLLOW)
        .open(path)
}

#[cfg(all(not(target_os = "macos"), windows))]
fn open_local_file(path: &Path) -> io::Result<File> {
    use std::os::windows::fs::OpenOptionsExt;

    OpenOptions::new()
        .read(true)
        .custom_flags(windows_sys::Win32::Storage::FileSystem::FILE_FLAG_OPEN_REPARSE_POINT)
        .open(path)
}

#[cfg(all(not(target_os = "macos"), not(any(unix, windows))))]
fn open_local_file(path: &Path) -> io::Result<File> {
    File::open(path)
}

#[cfg(target_os = "macos")]
fn map_macos_open_error(reason: &'static str) -> OpenReadError {
    match reason {
        "content_permission_required" => OpenReadError::PermissionDenied,
        "content_source_identity_changed" | "mac_provider_url_changed" => {
            OpenReadError::IdentityChanged
        }
        "icloud_item_not_local"
        | "icloud_local_read_deferred"
        | "file_provider_item_not_local"
        | "cloud_item_downloading"
        | "content_metadata_only" => OpenReadError::SourceUnavailable,
        "content_symlink_traversal_blocked"
        | "content_source_not_supported"
        | "package_not_supported" => OpenReadError::Unsupported,
        _ => OpenReadError::Failed,
    }
}

#[cfg(not(target_os = "macos"))]
fn map_io_error_to_open(error: io::Error) -> OpenReadError {
    match error.kind() {
        io::ErrorKind::PermissionDenied => OpenReadError::PermissionDenied,
        io::ErrorKind::NotFound => OpenReadError::SourceUnavailable,
        _ => OpenReadError::Failed,
    }
}

fn opened_file_matches(
    file: &File,
    expected: &PhysicalFileIdentity,
) -> Result<bool, OpenReadError> {
    let metadata = file.metadata().map_err(map_io_error_to_open_generic)?;
    if !metadata.is_file() || metadata.len() != expected.size {
        return Ok(false);
    }
    if let Some(expected_modified) = expected.modified_ns {
        if modified_ns(&metadata) != Some(expected_modified) {
            return Ok(false);
        }
    }

    opened_file_platform_matches(file, &metadata, expected)
}

#[cfg(target_os = "macos")]
fn opened_file_platform_matches(
    file: &File,
    _metadata: &fs::Metadata,
    expected: &PhysicalFileIdentity,
) -> Result<bool, OpenReadError> {
    let opened = crate::platform::macos::identity::MacPhysicalIdentity::from_fd(file)
        .map_err(map_io_error_to_open_generic)?;
    let volume = opened.dev.to_string();
    let file_id = opened.ino.to_string();
    Ok(
        expected.platform_volume_id.as_deref() == Some(volume.as_str())
            && expected.platform_file_id.as_deref() == Some(file_id.as_str())
            && opened.size == expected.size,
    )
}

#[cfg(all(unix, not(target_os = "macos")))]
fn opened_file_platform_matches(
    _file: &File,
    metadata: &fs::Metadata,
    expected: &PhysicalFileIdentity,
) -> Result<bool, OpenReadError> {
    use std::os::unix::fs::MetadataExt;

    let volume = metadata.dev().to_string();
    let file_id = metadata.ino().to_string();
    Ok(
        expected.platform_volume_id.as_deref() == Some(volume.as_str())
            && expected.platform_file_id.as_deref() == Some(file_id.as_str()),
    )
}

#[cfg(windows)]
fn opened_file_platform_matches(
    file: &File,
    metadata: &fs::Metadata,
    expected: &PhysicalFileIdentity,
) -> Result<bool, OpenReadError> {
    use std::os::windows::{fs::MetadataExt, io::AsRawHandle};
    use windows_sys::Win32::Storage::FileSystem::{
        GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION, FILE_ATTRIBUTE_REPARSE_POINT,
    };

    if metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
        return Ok(false);
    }
    let mut info = unsafe { std::mem::zeroed::<BY_HANDLE_FILE_INFORMATION>() };
    let success = unsafe { GetFileInformationByHandle(file.as_raw_handle(), &mut info) };
    if success == 0 {
        return Err(OpenReadError::Failed);
    }
    let volume = info.dwVolumeSerialNumber.to_string();
    let file_id =
        ((u64::from(info.nFileIndexHigh) << 32) | u64::from(info.nFileIndexLow)).to_string();
    Ok(
        expected.platform_volume_id.as_deref() == Some(volume.as_str())
            && expected.platform_file_id.as_deref() == Some(file_id.as_str()),
    )
}

#[cfg(not(any(unix, windows)))]
fn opened_file_platform_matches(
    _file: &File,
    _metadata: &fs::Metadata,
    _expected: &PhysicalFileIdentity,
) -> Result<bool, OpenReadError> {
    Ok(false)
}

fn modified_ns(metadata: &fs::Metadata) -> Option<i64> {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .and_then(|duration| i128::try_from(duration.as_nanos()).ok())
        .and_then(|value| i64::try_from(value).ok())
}

fn map_io_error_to_access(error: io::Error) -> ContentReadAccessError {
    match error.kind() {
        io::ErrorKind::PermissionDenied => ContentReadAccessError::PermissionDenied,
        io::ErrorKind::NotFound => ContentReadAccessError::SourceUnavailable,
        _ => ContentReadAccessError::Failed,
    }
}

fn map_io_error_to_open_generic(error: io::Error) -> OpenReadError {
    match error.kind() {
        io::ErrorKind::PermissionDenied => OpenReadError::PermissionDenied,
        io::ErrorKind::NotFound => OpenReadError::SourceUnavailable,
        _ => OpenReadError::Failed,
    }
}

fn map_open_error_to_access(error: OpenReadError) -> ContentReadAccessError {
    match error {
        OpenReadError::PermissionDenied => ContentReadAccessError::PermissionDenied,
        OpenReadError::SourceUnavailable => ContentReadAccessError::SourceUnavailable,
        OpenReadError::IdentityChanged => ContentReadAccessError::SourceVersionMismatch,
        #[cfg(target_os = "macos")]
        OpenReadError::Unsupported => ContentReadAccessError::Failed,
        OpenReadError::Failed => ContentReadAccessError::Failed,
    }
}

fn map_gate_error_to_access(error: ReadGateError) -> ContentReadAccessError {
    match error {
        ReadGateError::LeaseInvalid | ReadGateError::Disposed => {
            ContentReadAccessError::LeaseInvalid
        }
        ReadGateError::IdentityChanged => ContentReadAccessError::SourceVersionMismatch,
        ReadGateError::PermissionDenied => ContentReadAccessError::PermissionDenied,
        ReadGateError::SourceUnavailable
        | ReadGateError::MaterializationRequired
        | ReadGateError::Downloading
        | ReadGateError::MetadataOnly => ContentReadAccessError::SourceUnavailable,
        ReadGateError::SourceNotSupported
        | ReadGateError::PackageUnsupported
        | ReadGateError::Symlink
        | ReadGateError::AvailabilityUnknown
        | ReadGateError::InvalidRequest
        | ReadGateError::LeaseCapacityExceeded => ContentReadAccessError::Failed,
    }
}

fn map_context_error(error: super::preview::PreviewContextError) -> ContentReadAccessError {
    match error {
        super::preview::PreviewContextError::Cancelled => ContentReadAccessError::Cancelled,
        super::preview::PreviewContextError::TimedOut => ContentReadAccessError::TimedOut,
        super::preview::PreviewContextError::StalePublication => {
            ContentReadAccessError::SourceVersionMismatch
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::file_workspace::contracts::PreviewHostKind;
    use crate::file_workspace::preview::{
        PreparedPreview, PreviewCapabilities, PreviewHost, PreviewMetadata, PreviewProvider,
        PreviewProviderDescriptor, PreviewProviderEnvironment, PreviewProviderError,
        PreviewProviderRegistry, PreviewProviderResult, PreviewRepresentation, PreviewSession,
        PreviewSessionConfig, PreviewSourceSnapshot, PreviewWorkBudget, ProviderProbe,
        SourceResolveError, SourceResolver,
    };

    struct Fixture {
        root: PathBuf,
    }

    impl Fixture {
        fn new() -> Self {
            let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .parent()
                .expect("src-tauri has repository parent")
                .join(".tmp-tests")
                .join("read-gate")
                .join(uuid::Uuid::new_v4().to_string());
            fs::create_dir_all(&root).expect("create read-gate fixture root");
            Self { root }
        }

        fn file(&self, name: &str, bytes: &[u8]) -> PathBuf {
            let path = self.root.join(name);
            fs::write(&path, bytes).expect("write read-gate fixture");
            path
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            if let Err(error) = fs::remove_dir_all(&self.root) {
                eprintln!(
                    "read-gate fixture cleanup failed at {:?}: {error}",
                    self.root
                );
            }
        }
    }

    #[derive(Clone)]
    struct TestResolver {
        path: Arc<Mutex<PathBuf>>,
    }

    impl TestResolver {
        fn new(path: PathBuf) -> Self {
            Self {
                path: Arc::new(Mutex::new(path)),
            }
        }

        fn replace_path(&self, path: PathBuf) {
            *lock(&self.path) = path;
        }
    }

    impl ReadGateSourceResolver for TestResolver {
        fn resolve_source(
            &self,
            _source: &PreviewSourceRef,
        ) -> Result<ResolvedContentSource, SourceResolutionError> {
            Ok(ResolvedContentSource::from_backend_path(
                lock(&self.path).clone(),
            ))
        }
    }

    fn source() -> PreviewSourceRef {
        PreviewSourceRef::Managed {
            file_id: "managed-test-file".to_string(),
        }
    }

    fn gate(resolver: Arc<TestResolver>, config: ReadGateConfig) -> Arc<MaterializationReadGate> {
        Arc::new(MaterializationReadGate::new(resolver, config).expect("valid read-gate config"))
    }

    #[derive(Clone)]
    struct StaticPreviewResolver {
        snapshot: PreviewSourceSnapshot,
    }

    impl SourceResolver for StaticPreviewResolver {
        fn resolve(
            &self,
            request: &super::super::preview::PreviewResolveRequest,
            context: &PreviewOperationContext,
        ) -> Result<PreviewSourceSnapshot, SourceResolveError> {
            context.ensure_active().map_err(|error| match error {
                super::super::preview::PreviewContextError::Cancelled => {
                    SourceResolveError::Cancelled
                }
                super::super::preview::PreviewContextError::TimedOut => SourceResolveError::Timeout,
                super::super::preview::PreviewContextError::StalePublication => {
                    SourceResolveError::Cancelled
                }
            })?;
            if request.source != self.snapshot.source {
                return Err(SourceResolveError::SourceMismatch);
            }
            Ok(self.snapshot.clone())
        }
    }

    struct ReadProvider {
        descriptor: PreviewProviderDescriptor,
        lease: ContentReadLeaseRef,
        request: BoundedContentReadRequest,
        cancel_before_read: bool,
        result: Arc<Mutex<Option<Result<BoundedContentRead, ContentReadAccessError>>>>,
    }

    impl PreviewProvider for ReadProvider {
        fn descriptor(&self) -> &PreviewProviderDescriptor {
            &self.descriptor
        }

        fn probe(
            &self,
            _snapshot: &PreviewSourceSnapshot,
            _context: &PreviewOperationContext,
        ) -> ProviderProbe {
            ProviderProbe::Compatible
        }

        fn prepare(
            &self,
            _snapshot: &PreviewSourceSnapshot,
            _context: &PreviewOperationContext,
        ) -> Result<Box<dyn PreparedPreview>, PreviewProviderError> {
            Ok(Box::new(ReadPrepared {
                lease: self.lease.clone(),
                request: self.request,
                cancel_before_read: self.cancel_before_read,
                result: Arc::clone(&self.result),
            }))
        }
    }

    struct ReadPrepared {
        lease: ContentReadLeaseRef,
        request: BoundedContentReadRequest,
        cancel_before_read: bool,
        result: Arc<Mutex<Option<Result<BoundedContentRead, ContentReadAccessError>>>>,
    }

    impl PreparedPreview for ReadPrepared {
        fn load(
            &mut self,
            context: &PreviewOperationContext,
            environment: PreviewProviderEnvironment<'_>,
        ) -> Result<PreviewProviderResult, PreviewProviderError> {
            if self.cancel_before_read {
                context.cancellation().cancel();
            }
            let read_result = environment
                .content_read
                .map_or(Err(ContentReadAccessError::Failed), |consumer| {
                    consumer.read_bounded(&self.lease, self.request, context)
                });
            let provider_result = read_result.clone().map(|read| PreviewProviderResult {
                representation: PreviewRepresentation::Text {
                    text: String::from_utf8_lossy(&read.bytes).into_owned(),
                    language: None,
                },
                completeness: if read.complete {
                    super::super::preview::PreviewCompleteness::Complete
                } else {
                    super::super::preview::PreviewCompleteness::Partial
                },
                warnings: Vec::new(),
            });
            *lock(&self.result) = Some(read_result);
            provider_result.map_err(|_| PreviewProviderError::Failed)
        }

        fn cleanup(&mut self) {}
    }

    fn read_through_preview(
        gate: Arc<MaterializationReadGate>,
        source: PreviewSourceRef,
        lease: ContentReadLeaseRef,
        request_id: &str,
        request: BoundedContentReadRequest,
        cancel_before_read: bool,
    ) -> Option<Result<BoundedContentRead, ContentReadAccessError>> {
        let snapshot = PreviewSourceSnapshot::new(
            source.clone(),
            lease.source_version.clone(),
            PreviewMetadata {
                display_name: "fixture.bin".to_string(),
                media_type: Some("application/octet-stream".to_string()),
                extension: Some("bin".to_string()),
                size_bytes: Some(5),
                modified_at_epoch_ms: None,
                materialization: super::super::contracts::MaterializationState::Local,
                read_eligibility: ContentReadEligibility::Eligible,
            },
            PreviewCapabilities::all(),
        );
        let resolver = Arc::new(StaticPreviewResolver { snapshot });
        let result = Arc::new(Mutex::new(None));
        let provider = Arc::new(ReadProvider {
            descriptor: PreviewProviderDescriptor::new(
                "read-gate-test",
                1,
                PreviewCapabilities::metadata_fallback(),
                vec![PreviewHostKind::ZenFloating],
                true,
            ),
            lease,
            request,
            cancel_before_read,
            result: Arc::clone(&result),
        });
        let registry =
            Arc::new(PreviewProviderRegistry::new(vec![provider]).expect("test provider registry"));
        let session = PreviewSession::new(PreviewSessionConfig {
            session_id: "read-gate-session".to_string(),
            request: super::super::preview::PreviewRequest {
                request_id: request_id.to_string(),
                source,
            },
            host: PreviewHost::new(PreviewHostKind::ZenFloating, PreviewCapabilities::all()),
            budget: PreviewWorkBudget::default(),
        });
        let _ = session.run_with_environment(
            resolver,
            registry,
            super::super::preview::PreviewProviderEnvironmentHandle::with_content_read(gate),
        );
        let captured = lock(&result).take();
        captured
    }

    #[test]
    fn opaque_lease_contains_no_path_and_preview_can_inject_gate() {
        let fixture = Fixture::new();
        let path = fixture.file("ordinary.bin", b"hello");
        let gate = gate(
            Arc::new(TestResolver::new(path.clone())),
            ReadGateConfig::default(),
        );
        let source = source();
        let lease = gate
            .issue_lease_for_current("request-1", source.clone(), ReadIntent::Preview)
            .expect("issue lease");
        let wire = serde_json::to_value(&lease).expect("serialize opaque lease");
        assert!(!wire.to_string().contains(path.to_string_lossy().as_ref()));
        assert!(wire.get("path").is_none());
        assert_eq!(gate.active_lease_count(), 1);

        // W1-06's existing environment is the only provider seam; the gate is
        // injected as a consumer and no path is passed to the provider.
        let result = read_through_preview(
            Arc::clone(&gate),
            source,
            lease,
            "request-1",
            BoundedContentReadRequest {
                offset_bytes: 0,
                max_bytes: 5,
            },
            false,
        );
        assert!(result.is_some());
    }

    #[test]
    fn unknown_released_and_expired_leases_fail_closed() {
        let fixture = Fixture::new();
        let path = fixture.file("lease.bin", b"lease");
        let resolver = Arc::new(TestResolver::new(path));
        let gate = gate(Arc::clone(&resolver), ReadGateConfig::default());
        let source = source();
        let unknown = ContentReadLeaseRef {
            lease_id: "unknown".to_string(),
            request_id: "request-1".to_string(),
            source_version: "unknown".to_string(),
        };
        assert_eq!(
            read_through_preview(
                Arc::clone(&gate),
                source.clone(),
                unknown,
                "request-1",
                BoundedContentReadRequest {
                    offset_bytes: 0,
                    max_bytes: 1,
                },
                false,
            ),
            Some(Err(ContentReadAccessError::LeaseInvalid))
        );

        let released = gate
            .issue_lease_for_current("request-1", source.clone(), ReadIntent::Preview)
            .expect("issue released lease");
        gate.release_lease(&released).expect("release lease");
        assert_eq!(
            read_through_preview(
                Arc::clone(&gate),
                source.clone(),
                released,
                "request-1",
                BoundedContentReadRequest {
                    offset_bytes: 0,
                    max_bytes: 1,
                },
                false,
            ),
            Some(Err(ContentReadAccessError::LeaseInvalid))
        );

        let expiring = MaterializationReadGate::new(
            resolver,
            ReadGateConfig {
                lease_ttl: Duration::from_millis(1),
                ..ReadGateConfig::default()
            },
        )
        .expect("short lease config");
        let expiring = Arc::new(expiring);
        let lease = expiring
            .issue_lease_for_current("request-1", source.clone(), ReadIntent::Preview)
            .expect("issue expiring lease");
        std::thread::sleep(Duration::from_millis(5));
        assert_eq!(
            read_through_preview(
                expiring,
                source,
                lease,
                "request-1",
                BoundedContentReadRequest {
                    offset_bytes: 0,
                    max_bytes: 1,
                },
                false,
            ),
            Some(Err(ContentReadAccessError::LeaseInvalid))
        );
    }

    #[test]
    fn request_and_source_version_mismatches_are_rejected() {
        let fixture = Fixture::new();
        let first = fixture.file("first.bin", b"first");
        let second = fixture.file("second.bin", b"second");
        let resolver = Arc::new(TestResolver::new(first));
        let gate = gate(Arc::clone(&resolver), ReadGateConfig::default());
        let source = source();
        let lease = gate
            .issue_lease_for_current("request-1", source.clone(), ReadIntent::Preview)
            .expect("issue lease");
        assert_eq!(
            read_through_preview(
                Arc::clone(&gate),
                source.clone(),
                lease.clone(),
                "request-2",
                BoundedContentReadRequest {
                    offset_bytes: 0,
                    max_bytes: 1,
                },
                false,
            ),
            Some(Err(ContentReadAccessError::LeaseInvalid))
        );
        resolver.replace_path(second);
        assert_eq!(
            read_through_preview(
                gate,
                source,
                lease,
                "request-1",
                BoundedContentReadRequest {
                    offset_bytes: 0,
                    max_bytes: 1,
                },
                false,
            ),
            Some(Err(ContentReadAccessError::SourceVersionMismatch))
        );
    }

    #[test]
    fn oversized_and_overflowing_reads_are_rejected() {
        let fixture = Fixture::new();
        let path = fixture.file("bounded.bin", b"bounded");
        let gate = gate(Arc::new(TestResolver::new(path)), ReadGateConfig::default());
        let source = source();
        let lease = gate
            .issue_lease_for_current("request-1", source.clone(), ReadIntent::Preview)
            .expect("issue lease");
        assert_eq!(
            read_through_preview(
                Arc::clone(&gate),
                source.clone(),
                lease.clone(),
                "request-1",
                BoundedContentReadRequest {
                    offset_bytes: 0,
                    max_bytes: DEFAULT_MAX_READ_BYTES + 1,
                },
                false,
            ),
            Some(Err(ContentReadAccessError::Failed))
        );
        assert_eq!(
            read_through_preview(
                gate,
                source,
                lease,
                "request-1",
                BoundedContentReadRequest {
                    offset_bytes: u64::MAX,
                    max_bytes: 1,
                },
                false,
            ),
            Some(Err(ContentReadAccessError::Failed))
        );
    }

    #[test]
    fn cancellation_prevents_publication_after_gate_entry() {
        let fixture = Fixture::new();
        let path = fixture.file("cancel.bin", b"cancel");
        let gate = gate(Arc::new(TestResolver::new(path)), ReadGateConfig::default());
        let source = source();
        let lease = gate
            .issue_lease_for_current("request-1", source.clone(), ReadIntent::Preview)
            .expect("issue lease");
        assert_eq!(
            read_through_preview(
                gate,
                source,
                lease,
                "request-1",
                BoundedContentReadRequest {
                    offset_bytes: 0,
                    max_bytes: 1,
                },
                true,
            ),
            Some(Err(ContentReadAccessError::Cancelled))
        );
    }

    #[test]
    fn metadata_only_and_non_regular_sources_never_issue_a_lease() {
        let fixture = Fixture::new();
        let directory = fixture.root.join("directory");
        fs::create_dir(&directory).expect("create directory fixture");
        let gate = gate(
            Arc::new(TestResolver::new(directory)),
            ReadGateConfig::default(),
        );
        let source = source();
        assert_eq!(
            gate.content_read_eligibility(&source),
            ContentReadEligibility::SourceNotSupported
        );
        assert_eq!(
            gate.issue_lease_for_current("request-1", source.clone(), ReadIntent::Preview),
            Err(ReadGateError::SourceNotSupported)
        );
        assert_eq!(
            gate.issue_lease_for_current("request-1", source, ReadIntent::MetadataOnly),
            Err(ReadGateError::InvalidRequest)
        );
        assert_eq!(gate.active_lease_count(), 0);
    }

    #[cfg(unix)]
    #[test]
    fn symlink_source_fails_closed_without_following_target() {
        let fixture = Fixture::new();
        let target = fixture.file("target.bin", b"target");
        let link = fixture.root.join("link.bin");
        std::os::unix::fs::symlink(&target, &link).expect("create symlink fixture");
        let gate = gate(Arc::new(TestResolver::new(link)), ReadGateConfig::default());
        let source = source();
        assert_eq!(
            gate.content_read_eligibility(&source),
            ContentReadEligibility::Symlink
        );
        assert_eq!(
            gate.issue_lease_for_current("request-1", source, ReadIntent::Preview),
            Err(ReadGateError::Symlink)
        );
    }

    #[test]
    fn read_errors_are_conservative_and_release_frees_bounded_capacity() {
        let fixture = Fixture::new();
        let path = fixture.file("capacity.bin", b"capacity");
        let resolver = Arc::new(TestResolver::new(path));
        let gate = gate(
            Arc::clone(&resolver),
            ReadGateConfig {
                max_active_leases: 1,
                ..ReadGateConfig::default()
            },
        );
        let source = source();
        let first = gate
            .issue_lease_for_current("request-1", source.clone(), ReadIntent::Preview)
            .expect("issue first lease");
        assert_eq!(
            gate.issue_lease_for_current("request-2", source.clone(), ReadIntent::Preview),
            Err(ReadGateError::LeaseCapacityExceeded)
        );
        assert_eq!(
            read_through_preview(
                Arc::clone(&gate),
                source.clone(),
                first.clone(),
                "request-1",
                BoundedContentReadRequest {
                    offset_bytes: 0,
                    max_bytes: 2,
                },
                false,
            )
            .expect("captured read result")
            .expect("bounded read succeeds")
            .bytes,
            b"ca"
        );
        gate.release_lease(&first).expect("release first lease");
        let second = gate
            .issue_lease_for_current("request-2", source.clone(), ReadIntent::Preview)
            .expect("capacity is released");
        assert_eq!(gate.active_lease_count(), 1);
        gate.dispose();
        assert_eq!(gate.active_lease_count(), 0);
        assert_eq!(gate.release_lease(&second), Err(ReadGateError::Disposed));
    }
}
