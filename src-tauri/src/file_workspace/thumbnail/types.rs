//! Public thumbnail domain values and stable renderer/error contracts.

use super::super::contracts::{EntryRef, PreviewSourceRef, WorkClass};
use crate::scheduler::ResourceHints;
use std::time::Duration;
use thiserror::Error;

pub(super) const MAX_OPAQUE_ID_LENGTH: usize = 256;
pub(super) const DEFAULT_MEMORY_MAX_ENTRIES: usize = 128;
pub(super) const DEFAULT_MEMORY_MAX_BYTES: u64 = 32 * 1024 * 1024;
pub(super) const DEFAULT_DISK_MAX_ENTRIES: usize = 256;
pub(super) const DEFAULT_DISK_MAX_BYTES: u64 = 128 * 1024 * 1024;
pub(super) const DEFAULT_WORKERS: usize = 2;
pub(super) const DEFAULT_QUEUE_CAPACITY: usize = 32;
pub(super) const DEFAULT_MAX_OWNERS_PER_GENERATION: usize = 32;
pub(super) const DEFAULT_MAX_SOURCE_BYTES: u64 = 256 * 1024 * 1024;
pub(super) const DEFAULT_MAX_OUTPUT_BYTES: u64 = 16 * 1024 * 1024;
pub(super) const DEFAULT_GENERATION_TIMEOUT: Duration = Duration::from_secs(10);
pub(super) const READ_CHUNK_BYTES: u32 = 1024 * 1024;

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

/// A backend-authorized thumbnail request. `source` is an opaque W1 `EntryRef`;
/// it is never interpreted as a path. Ephemeral `source_generation` is an
/// internal cache namespace seed derived by the integration boundary from the
/// live Browse registry; it is not a renderer or frontend input.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ThumbnailRequest {
    pub request_id: String,
    pub source: EntryRef,
    pub variant: ThumbnailVariant,
    pub work_class: WorkClass,
    pub session_id: Option<String>,
    pub(crate) source_generation: Option<String>,
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

    pub(crate) fn with_authoritative_source_generation(
        mut self,
        generation: impl Into<String>,
    ) -> Self {
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
