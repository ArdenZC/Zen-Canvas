//! Preview Contract Core for W1-06.
//!
//! This module owns only the disposable, read-only Preview contract. It does
//! not resolve paths, open bytes, materialize provider content, mutate the
//! filesystem, or persist state. A resolver supplies a backend-owned source
//! snapshot and providers consume that snapshot through an opaque operation
//! context. The existing authoritative read/open boundary remains outside
//! this module and will be adapted by W1-07.

use super::contracts::{
    ContentReadEligibility, MaterializationState, PreviewHostKind, PreviewSourceRef,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex, MutexGuard,
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};
use thiserror::Error;

fn lock<T>(value: &Mutex<T>) -> MutexGuard<'_, T> {
    value
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// Capabilities exposed by the host, provider and resolved source.
///
/// The effective value is always the intersection of all three layers. The
/// renderer must consume this result rather than infer controls from names,
/// extensions, paths or platform labels.
#[derive(Debug, Clone, Copy, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct PreviewCapabilities {
    pub can_search: bool,
    pub can_zoom: bool,
    pub can_playback: bool,
    pub can_select_text: bool,
    pub can_navigate_internal: bool,
    pub can_navigate_siblings: bool,
    pub can_open_external: bool,
    pub can_reveal: bool,
    pub can_request_materialization: bool,
}

impl PreviewCapabilities {
    pub const fn all() -> Self {
        Self {
            can_search: true,
            can_zoom: true,
            can_playback: true,
            can_select_text: true,
            can_navigate_internal: true,
            can_navigate_siblings: true,
            can_open_external: true,
            can_reveal: true,
            can_request_materialization: true,
        }
    }

    pub const fn metadata_fallback() -> Self {
        Self {
            can_search: false,
            can_zoom: false,
            can_playback: false,
            can_select_text: false,
            can_navigate_internal: false,
            can_navigate_siblings: false,
            can_open_external: true,
            can_reveal: true,
            can_request_materialization: true,
        }
    }

    pub const fn intersect(self, other: Self) -> Self {
        Self {
            can_search: self.can_search && other.can_search,
            can_zoom: self.can_zoom && other.can_zoom,
            can_playback: self.can_playback && other.can_playback,
            can_select_text: self.can_select_text && other.can_select_text,
            can_navigate_internal: self.can_navigate_internal && other.can_navigate_internal,
            can_navigate_siblings: self.can_navigate_siblings && other.can_navigate_siblings,
            can_open_external: self.can_open_external && other.can_open_external,
            can_reveal: self.can_reveal && other.can_reveal,
            can_request_materialization: self.can_request_materialization
                && other.can_request_materialization,
        }
    }
}

/// The host shell is intentionally separate from Preview Core/provider work.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PreviewHost {
    pub kind: PreviewHostKind,
    pub capabilities: PreviewCapabilities,
}

impl PreviewHost {
    pub const fn new(kind: PreviewHostKind, capabilities: PreviewCapabilities) -> Self {
        Self { kind, capabilities }
    }
}

/// Bounded metadata supplied by a SourceResolver.
///
/// This contains presentation metadata only. It deliberately has no path,
/// handle, provider URL, security-scoped URL or native object.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct PreviewMetadata {
    pub display_name: String,
    pub media_type: Option<String>,
    pub extension: Option<String>,
    pub size_bytes: Option<u64>,
    pub modified_at_epoch_ms: Option<i64>,
    pub materialization: MaterializationState,
    pub read_eligibility: ContentReadEligibility,
}

/// A backend-owned source snapshot. A source version is required for stale
/// publication protection; the snapshot never grants byte-read authority.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct PreviewSourceSnapshot {
    pub source: PreviewSourceRef,
    pub source_version: String,
    pub metadata: PreviewMetadata,
    pub capabilities: PreviewCapabilities,
}

impl PreviewSourceSnapshot {
    pub fn new(
        source: PreviewSourceRef,
        source_version: impl Into<String>,
        metadata: PreviewMetadata,
        capabilities: PreviewCapabilities,
    ) -> Self {
        Self {
            source,
            source_version: source_version.into(),
            metadata,
            capabilities,
        }
    }
}

pub type PreviewSourceCapabilities = PreviewCapabilities;

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PreviewRepresentationFamily {
    Metadata,
    Text,
    SafeHtml,
    StructuredTree,
    Table,
    Image,
    Media,
    FolderSummary,
    ArchiveTree,
    NativeOpaque,
}

/// Host-neutral representations. NativeOpaque is the only host-bound family
/// and carries an opaque token that is meaningful only to the declared host.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "family", rename_all = "snake_case")]
pub enum PreviewRepresentation {
    Metadata {
        metadata: PreviewMetadata,
    },
    Text {
        text: String,
        language: Option<String>,
    },
    SafeHtml {
        html: String,
    },
    StructuredTree {
        encoded_tree: String,
    },
    Table {
        encoded_table: String,
    },
    Image {
        asset_token: String,
        media_type: String,
    },
    Media {
        asset_token: String,
        media_type: String,
    },
    FolderSummary {
        encoded_summary: String,
    },
    ArchiveTree {
        encoded_tree: String,
    },
    NativeOpaque {
        host: PreviewHostKind,
        token: String,
    },
}

impl PreviewRepresentation {
    pub const fn family(&self) -> PreviewRepresentationFamily {
        match self {
            Self::Metadata { .. } => PreviewRepresentationFamily::Metadata,
            Self::Text { .. } => PreviewRepresentationFamily::Text,
            Self::SafeHtml { .. } => PreviewRepresentationFamily::SafeHtml,
            Self::StructuredTree { .. } => PreviewRepresentationFamily::StructuredTree,
            Self::Table { .. } => PreviewRepresentationFamily::Table,
            Self::Image { .. } => PreviewRepresentationFamily::Image,
            Self::Media { .. } => PreviewRepresentationFamily::Media,
            Self::FolderSummary { .. } => PreviewRepresentationFamily::FolderSummary,
            Self::ArchiveTree { .. } => PreviewRepresentationFamily::ArchiveTree,
            Self::NativeOpaque { .. } => PreviewRepresentationFamily::NativeOpaque,
        }
    }

    fn is_host_compatible(&self, host: PreviewHostKind) -> bool {
        match self {
            Self::NativeOpaque {
                host: representation_host,
                ..
            } => *representation_host == host,
            _ => true,
        }
    }
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PreviewCompleteness {
    Complete,
    Partial,
    Unknown,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PreviewProviderErrorCode {
    Unsupported,
    Failed,
    Timeout,
    CorruptSource,
    SourceUnavailable,
    MaterializationRequired,
    PermissionDenied,
    IdentityChanged,
    Cancelled,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PreviewTerminalCondition {
    SourceUnavailable,
    MaterializationRequired,
    PermissionDenied,
    IdentityChanged,
    Cancelled,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case", tag = "kind")]
pub enum PreviewWarning {
    ProviderFallback {
        provider_id: String,
        reason: PreviewProviderErrorCode,
    },
    MetadataFallback,
    TerminalCondition {
        condition: PreviewTerminalCondition,
    },
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct PreviewRepresentationEnvelope {
    pub source_version: String,
    pub representation: PreviewRepresentation,
    pub completeness: PreviewCompleteness,
    pub warnings: Vec<PreviewWarning>,
    pub capabilities: PreviewCapabilities,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreviewProviderResult {
    pub representation: PreviewRepresentation,
    pub completeness: PreviewCompleteness,
    pub warnings: Vec<PreviewWarning>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreviewProviderDescriptor {
    pub id: String,
    pub priority: i32,
    pub capabilities: PreviewCapabilities,
    pub supported_hosts: Vec<PreviewHostKind>,
    /// True when the provider may require the W1-07 opaque read gate. This is
    /// descriptive routing metadata, not a second eligibility decision.
    pub reads_content: bool,
}

impl PreviewProviderDescriptor {
    pub fn new(
        id: impl Into<String>,
        priority: i32,
        capabilities: PreviewCapabilities,
        supported_hosts: Vec<PreviewHostKind>,
        reads_content: bool,
    ) -> Self {
        Self {
            id: id.into(),
            priority,
            capabilities,
            supported_hosts,
            reads_content,
        }
    }

    fn supports_host(&self, host: PreviewHostKind) -> bool {
        self.supported_hosts.is_empty() || self.supported_hosts.contains(&host)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProviderProbe {
    Compatible,
    Unsupported,
}

/// Providers receive only a snapshot and an opaque operation context.
pub trait PreviewProvider: Send + Sync {
    fn descriptor(&self) -> &PreviewProviderDescriptor;

    /// Probe must be cheap and bounded; it must not perform unbounded reads.
    fn probe(
        &self,
        snapshot: &PreviewSourceSnapshot,
        context: &PreviewOperationContext,
    ) -> ProviderProbe;

    fn prepare(
        &self,
        snapshot: &PreviewSourceSnapshot,
        context: &PreviewOperationContext,
    ) -> Result<Box<dyn PreparedPreview>, PreviewProviderError>;
}

/// Prepared provider state is disposable and never owns a durable authority.
pub trait PreparedPreview: Send {
    fn load(
        &mut self,
        context: &PreviewOperationContext,
    ) -> Result<PreviewProviderResult, PreviewProviderError>;

    fn cleanup(&mut self);
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Error)]
pub enum PreviewProviderError {
    #[error("provider does not support this source")]
    Unsupported,
    #[error("provider failed")]
    Failed,
    #[error("provider timed out")]
    Timeout,
    #[error("provider reported a corrupt source")]
    CorruptSource,
    #[error("source is unavailable")]
    SourceUnavailable,
    #[error("materialization is required")]
    MaterializationRequired,
    #[error("permission was denied")]
    PermissionDenied,
    #[error("source identity changed")]
    IdentityChanged,
    #[error("preview was cancelled")]
    Cancelled,
}

impl PreviewProviderError {
    pub const fn code(self) -> PreviewProviderErrorCode {
        match self {
            Self::Unsupported => PreviewProviderErrorCode::Unsupported,
            Self::Failed => PreviewProviderErrorCode::Failed,
            Self::Timeout => PreviewProviderErrorCode::Timeout,
            Self::CorruptSource => PreviewProviderErrorCode::CorruptSource,
            Self::SourceUnavailable => PreviewProviderErrorCode::SourceUnavailable,
            Self::MaterializationRequired => PreviewProviderErrorCode::MaterializationRequired,
            Self::PermissionDenied => PreviewProviderErrorCode::PermissionDenied,
            Self::IdentityChanged => PreviewProviderErrorCode::IdentityChanged,
            Self::Cancelled => PreviewProviderErrorCode::Cancelled,
        }
    }

    pub const fn terminal_condition(self) -> Option<PreviewTerminalCondition> {
        match self {
            Self::SourceUnavailable => Some(PreviewTerminalCondition::SourceUnavailable),
            Self::MaterializationRequired => {
                Some(PreviewTerminalCondition::MaterializationRequired)
            }
            Self::PermissionDenied => Some(PreviewTerminalCondition::PermissionDenied),
            Self::IdentityChanged => Some(PreviewTerminalCondition::IdentityChanged),
            Self::Cancelled => Some(PreviewTerminalCondition::Cancelled),
            Self::Unsupported | Self::Failed | Self::Timeout | Self::CorruptSource => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Error)]
pub enum SourceResolveError {
    #[error("source is unavailable")]
    SourceUnavailable,
    #[error("materialization is required before source resolution")]
    MaterializationRequired,
    #[error("permission was denied while resolving the source")]
    PermissionDenied,
    #[error("source identity changed while resolving")]
    IdentityChanged,
    #[error("source resolution timed out")]
    Timeout,
    #[error("source resolution was cancelled")]
    Cancelled,
    #[error("source resolution returned a mismatched source")]
    SourceMismatch,
    #[error("source resolution failed")]
    Failed,
}

pub trait SourceResolver: Send + Sync {
    fn resolve(
        &self,
        request: &PreviewResolveRequest,
        context: &PreviewOperationContext,
    ) -> Result<PreviewSourceSnapshot, SourceResolveError>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreviewResolveRequest {
    pub request_id: String,
    pub source: PreviewSourceRef,
    pub host_kind: PreviewHostKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PreviewContextError {
    Cancelled,
    TimedOut,
    StalePublication,
}

#[derive(Clone, Debug, Default)]
pub struct PreviewCancellation(Arc<AtomicBool>);

impl PreviewCancellation {
    pub fn cancel(&self) {
        self.0.store(true, Ordering::Release);
    }

    pub fn is_cancelled(&self) -> bool {
        self.0.load(Ordering::Acquire)
    }
}

#[derive(Debug)]
struct PublicationAuthority {
    generation: AtomicU64,
    disposed: AtomicBool,
}

/// Opaque publication capability used to reject late source/provider results.
#[derive(Clone, Debug)]
pub struct PreviewPublicationToken {
    session_id: String,
    request_id: String,
    source_version: Option<String>,
    generation: u64,
    authority: Arc<PublicationAuthority>,
    cancellation: PreviewCancellation,
}

impl PreviewPublicationToken {
    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    pub fn request_id(&self) -> &str {
        &self.request_id
    }

    pub fn source_version(&self) -> Option<&str> {
        self.source_version.as_deref()
    }

    pub fn is_current(&self) -> bool {
        !self.authority.disposed.load(Ordering::Acquire)
            && self.authority.generation.load(Ordering::Acquire) == self.generation
            && !self.cancellation.is_cancelled()
    }

    fn with_source_version(&self, source_version: impl Into<String>) -> Self {
        Self {
            session_id: self.session_id.clone(),
            request_id: self.request_id.clone(),
            source_version: Some(source_version.into()),
            generation: self.generation,
            authority: Arc::clone(&self.authority),
            cancellation: self.cancellation.clone(),
        }
    }
}

#[derive(Clone, Debug)]
pub struct PreviewOperationContext {
    session_id: String,
    request_id: String,
    source_version: Option<String>,
    publication: PreviewPublicationToken,
    cancellation: PreviewCancellation,
    deadline: Instant,
}

impl PreviewOperationContext {
    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    pub fn request_id(&self) -> &str {
        &self.request_id
    }

    pub fn source_version(&self) -> Option<&str> {
        self.source_version.as_deref()
    }

    pub fn publication(&self) -> &PreviewPublicationToken {
        &self.publication
    }

    pub fn cancellation(&self) -> PreviewCancellation {
        self.cancellation.clone()
    }

    pub fn is_publication_current(&self) -> bool {
        self.publication.is_current()
    }

    pub fn remaining(&self) -> Duration {
        self.deadline.saturating_duration_since(Instant::now())
    }

    pub fn ensure_active(&self) -> Result<(), PreviewContextError> {
        if self.cancellation.is_cancelled() {
            return Err(PreviewContextError::Cancelled);
        }
        if !self.publication.is_current() {
            return Err(PreviewContextError::StalePublication);
        }
        if Instant::now() >= self.deadline {
            return Err(PreviewContextError::TimedOut);
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PreviewWorkBudget {
    pub resolve_timeout: Duration,
    pub probe_timeout: Duration,
    pub prepare_timeout: Duration,
    pub load_timeout: Duration,
}

impl Default for PreviewWorkBudget {
    fn default() -> Self {
        Self {
            resolve_timeout: Duration::from_secs(2),
            probe_timeout: Duration::from_millis(250),
            prepare_timeout: Duration::from_secs(2),
            load_timeout: Duration::from_secs(5),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreviewRequest {
    pub request_id: String,
    pub source: PreviewSourceRef,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreviewSessionConfig {
    pub session_id: String,
    pub request: PreviewRequest,
    pub host: PreviewHost,
    pub budget: PreviewWorkBudget,
}

impl PreviewSessionConfig {
    pub fn new(
        session_id: impl Into<String>,
        request_id: impl Into<String>,
        source: PreviewSourceRef,
        host: PreviewHost,
    ) -> Self {
        Self {
            session_id: session_id.into(),
            request: PreviewRequest {
                request_id: request_id.into(),
                source,
            },
            host,
            budget: PreviewWorkBudget::default(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PreviewSessionState {
    Idle,
    Resolving,
    Preparing,
    Loading,
    Ready,
    Failed,
    Cancelled,
    Disposed,
}

#[derive(Debug, Clone)]
pub struct PreviewSessionSnapshot {
    pub session_id: String,
    pub request_id: String,
    pub source: PreviewSourceRef,
    pub host_kind: PreviewHostKind,
    pub state: PreviewSessionState,
    pub source_version: Option<String>,
    pub representation: Option<PreviewRepresentationEnvelope>,
    pub effective_capabilities: PreviewCapabilities,
    pub active_provider_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum PreviewSessionError {
    #[error("preview session is disposed")]
    Disposed,
    #[error("preview session already has an active operation")]
    AlreadyRunning,
    #[error("preview session cannot start from state {0:?}")]
    InvalidState(PreviewSessionState),
    #[error("preview worker could not be spawned: {0}")]
    SpawnFailed(String),
}

#[derive(Debug, Error)]
pub enum PreviewRunError {
    #[error("{0}")]
    Session(#[from] PreviewSessionError),
    #[error("source resolver failed: {0}")]
    SourceResolver(#[from] SourceResolveError),
    #[error("provider {provider_id} reached terminal condition {condition:?}")]
    ProviderTerminal {
        provider_id: String,
        condition: PreviewTerminalCondition,
    },
    #[error("preview was cancelled")]
    Cancelled,
    #[error("preview result was stale")]
    StalePublication,
    #[error("preview worker panicked")]
    WorkerPanicked,
}

#[derive(Debug, Clone)]
pub struct PreviewRunOutcome {
    pub provider_id: Option<String>,
    pub envelope: PreviewRepresentationEnvelope,
    pub attempted_provider_ids: Vec<String>,
}

pub struct PreviewTask {
    handle: Option<JoinHandle<Result<PreviewRunOutcome, PreviewRunError>>>,
}

impl PreviewTask {
    pub fn join(mut self) -> Result<PreviewRunOutcome, PreviewRunError> {
        let handle = self.handle.take().expect("preview task handle is present");
        handle
            .join()
            .unwrap_or(Err(PreviewRunError::WorkerPanicked))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum PreviewRegistryError {
    #[error("preview provider id must not be empty")]
    EmptyProviderId,
    #[error("duplicate preview provider id: {0}")]
    DuplicateProviderId(String),
}

pub struct PreviewProviderRegistry {
    providers: Vec<Arc<dyn PreviewProvider>>,
}

impl PreviewProviderRegistry {
    pub fn new(providers: Vec<Arc<dyn PreviewProvider>>) -> Result<Self, PreviewRegistryError> {
        let mut ids = HashSet::new();
        for provider in &providers {
            let id = provider.descriptor().id.as_str();
            if id.is_empty() {
                return Err(PreviewRegistryError::EmptyProviderId);
            }
            if !ids.insert(id.to_string()) {
                return Err(PreviewRegistryError::DuplicateProviderId(id.to_string()));
            }
        }

        let mut providers = providers;
        providers.sort_by(|left, right| {
            right
                .descriptor()
                .priority
                .cmp(&left.descriptor().priority)
                .then_with(|| left.descriptor().id.cmp(&right.descriptor().id))
        });
        Ok(Self { providers })
    }

    pub fn provider_ids(&self) -> Vec<String> {
        self.providers
            .iter()
            .map(|provider| provider.descriptor().id.clone())
            .collect()
    }
}

struct PreparedPreviewGuard {
    inner: Option<Box<dyn PreparedPreview>>,
}

impl PreparedPreviewGuard {
    fn new(inner: Box<dyn PreparedPreview>) -> Self {
        Self { inner: Some(inner) }
    }

    fn load(
        &mut self,
        context: &PreviewOperationContext,
    ) -> Result<PreviewProviderResult, PreviewProviderError> {
        self.inner
            .as_mut()
            .ok_or(PreviewProviderError::Failed)?
            .load(context)
    }

    fn cleanup_once(&mut self) {
        if let Some(mut inner) = self.inner.take() {
            inner.cleanup();
        }
    }
}

impl Drop for PreparedPreviewGuard {
    fn drop(&mut self) {
        self.cleanup_once();
    }
}

type PreparedPreviewHandle = Arc<Mutex<PreparedPreviewGuard>>;

struct ActiveProvider {
    id: String,
    handle: PreparedPreviewHandle,
}

struct SessionInner {
    session_id: String,
    request: PreviewRequest,
    host: PreviewHost,
    budget: PreviewWorkBudget,
    state: PreviewSessionState,
    cancellation: PreviewCancellation,
    running: bool,
    source_snapshot: Option<PreviewSourceSnapshot>,
    representation: Option<PreviewRepresentationEnvelope>,
    effective_capabilities: PreviewCapabilities,
    active_provider: Option<ActiveProvider>,
}

#[derive(Clone)]
pub struct PreviewSession {
    inner: Arc<Mutex<SessionInner>>,
    authority: Arc<PublicationAuthority>,
}

struct OperationSeed {
    request: PreviewRequest,
    host: PreviewHost,
    budget: PreviewWorkBudget,
    token: PreviewPublicationToken,
}

impl OperationSeed {
    fn context(&self, source_version: Option<&str>, timeout: Duration) -> PreviewOperationContext {
        PreviewOperationContext {
            session_id: self.token.session_id.clone(),
            request_id: self.token.request_id.clone(),
            source_version: source_version.map(str::to_owned),
            publication: match source_version {
                Some(version) => self.token.with_source_version(version),
                None => self.token.clone(),
            },
            cancellation: self.token.cancellation.clone(),
            deadline: Instant::now() + timeout,
        }
    }
}

impl PreviewSession {
    pub fn new(config: PreviewSessionConfig) -> Self {
        let cancellation = PreviewCancellation::default();
        Self {
            inner: Arc::new(Mutex::new(SessionInner {
                session_id: config.session_id,
                request: config.request,
                host: config.host,
                budget: config.budget,
                state: PreviewSessionState::Idle,
                cancellation,
                running: false,
                source_snapshot: None,
                representation: None,
                effective_capabilities: PreviewCapabilities::default(),
                active_provider: None,
            })),
            authority: Arc::new(PublicationAuthority {
                generation: AtomicU64::new(1),
                disposed: AtomicBool::new(false),
            }),
        }
    }

    pub fn state(&self) -> PreviewSessionState {
        lock(&self.inner).state
    }

    pub fn request(&self) -> PreviewRequest {
        lock(&self.inner).request.clone()
    }

    pub fn host(&self) -> PreviewHost {
        lock(&self.inner).host
    }

    pub fn source_snapshot(&self) -> Option<PreviewSourceSnapshot> {
        lock(&self.inner).source_snapshot.clone()
    }

    pub fn representation(&self) -> Option<PreviewRepresentationEnvelope> {
        lock(&self.inner).representation.clone()
    }

    pub fn effective_capabilities(&self) -> PreviewCapabilities {
        lock(&self.inner).effective_capabilities
    }

    pub fn snapshot(&self) -> PreviewSessionSnapshot {
        let inner = lock(&self.inner);
        PreviewSessionSnapshot {
            session_id: inner.session_id.clone(),
            request_id: inner.request.request_id.clone(),
            source: inner.request.source.clone(),
            host_kind: inner.host.kind,
            state: inner.state,
            source_version: inner
                .source_snapshot
                .as_ref()
                .map(|snapshot| snapshot.source_version.clone()),
            representation: inner.representation.clone(),
            effective_capabilities: inner.effective_capabilities,
            active_provider_id: inner
                .active_provider
                .as_ref()
                .map(|provider| provider.id.clone()),
        }
    }

    /// Switches the source and immediately revokes all old publication rights.
    pub fn switch_source(&self, request: PreviewRequest) -> Result<(), PreviewSessionError> {
        let active_provider = {
            let mut inner = lock(&self.inner);
            if inner.state == PreviewSessionState::Disposed
                || self.authority.disposed.load(Ordering::Acquire)
            {
                return Err(PreviewSessionError::Disposed);
            }
            inner.cancellation.cancel();
            self.authority.generation.fetch_add(1, Ordering::AcqRel);
            inner.cancellation = PreviewCancellation::default();
            inner.request = request;
            inner.state = PreviewSessionState::Resolving;
            inner.running = false;
            inner.source_snapshot = None;
            inner.representation = None;
            inner.effective_capabilities = PreviewCapabilities::default();
            inner.active_provider.take()
        };
        cleanup_active_provider(active_provider);
        Ok(())
    }

    /// Cancels the current operation, revokes publication rights and cleans up
    /// the currently prepared provider. It is idempotent.
    pub fn cancel(&self) -> bool {
        let active_provider = {
            let mut inner = lock(&self.inner);
            if matches!(
                inner.state,
                PreviewSessionState::Disposed | PreviewSessionState::Cancelled
            ) {
                return false;
            }
            inner.cancellation.cancel();
            self.authority.generation.fetch_add(1, Ordering::AcqRel);
            inner.state = PreviewSessionState::Cancelled;
            inner.running = false;
            if let Some(snapshot) = inner.source_snapshot.as_ref() {
                let envelope = metadata_fallback(snapshot, inner.host, Vec::new());
                inner.effective_capabilities = envelope.capabilities;
                inner.representation = Some(envelope);
            }
            inner.active_provider.take()
        };
        cleanup_active_provider(active_provider);
        true
    }

    /// Disposes the session permanently. The host may use this for close,
    /// source teardown or app shutdown; a disposed session cannot be reused.
    pub fn dispose(&self) -> bool {
        let active_provider = {
            let mut inner = lock(&self.inner);
            if inner.state == PreviewSessionState::Disposed {
                return false;
            }
            inner.cancellation.cancel();
            self.authority.disposed.store(true, Ordering::Release);
            self.authority.generation.fetch_add(1, Ordering::AcqRel);
            inner.state = PreviewSessionState::Disposed;
            inner.running = false;
            inner.active_provider.take()
        };
        cleanup_active_provider(active_provider);
        true
    }

    pub fn current_publication(&self) -> Option<PreviewPublicationToken> {
        let inner = lock(&self.inner);
        if matches!(
            inner.state,
            PreviewSessionState::Disposed | PreviewSessionState::Cancelled
        ) {
            return None;
        }
        let source_version = inner
            .source_snapshot
            .as_ref()
            .map(|snapshot| snapshot.source_version.clone());
        Some(self.token_for(&inner, source_version))
    }

    pub fn can_publish(&self, token: &PreviewPublicationToken) -> bool {
        let inner = lock(&self.inner);
        self.identity_current_locked(&inner, token)
            && token.is_current()
            && !matches!(
                inner.state,
                PreviewSessionState::Disposed | PreviewSessionState::Cancelled
            )
    }

    /// Runs synchronously for embedders that own their executor/thread.
    pub fn run(
        &self,
        resolver: &dyn SourceResolver,
        registry: &PreviewProviderRegistry,
    ) -> Result<PreviewRunOutcome, PreviewRunError> {
        let operation = self.begin_operation().map_err(PreviewRunError::Session)?;
        self.run_operation(operation, resolver, registry)
    }

    /// Creates the shell synchronously, then performs resolver/provider work on
    /// a disposable worker. The shell is therefore observable before any slow
    /// provider result is available.
    pub fn start(
        &self,
        resolver: Arc<dyn SourceResolver>,
        registry: Arc<PreviewProviderRegistry>,
    ) -> Result<PreviewTask, PreviewSessionError> {
        let operation = self.begin_operation()?;
        let session = self.clone();
        let worker = thread::Builder::new()
            .name(format!("preview-{}", operation.token.request_id()))
            .spawn(move || session.run_operation(operation, resolver.as_ref(), registry.as_ref()))
            .map_err(|error| PreviewSessionError::SpawnFailed(error.to_string()));
        match worker {
            Ok(handle) => Ok(PreviewTask {
                handle: Some(handle),
            }),
            Err(error) => {
                self.fail_spawned_operation();
                Err(error)
            }
        }
    }

    fn begin_operation(&self) -> Result<OperationSeed, PreviewSessionError> {
        let mut inner = lock(&self.inner);
        if inner.state == PreviewSessionState::Disposed
            || self.authority.disposed.load(Ordering::Acquire)
        {
            return Err(PreviewSessionError::Disposed);
        }
        if inner.running {
            return Err(PreviewSessionError::AlreadyRunning);
        }
        if !matches!(
            inner.state,
            PreviewSessionState::Idle | PreviewSessionState::Resolving
        ) {
            return Err(PreviewSessionError::InvalidState(inner.state));
        }
        inner.state = PreviewSessionState::Resolving;
        inner.running = true;
        let token = self.token_for(&inner, None);
        Ok(OperationSeed {
            request: inner.request.clone(),
            host: inner.host,
            budget: inner.budget,
            token,
        })
    }

    fn token_for(
        &self,
        inner: &SessionInner,
        source_version: Option<String>,
    ) -> PreviewPublicationToken {
        PreviewPublicationToken {
            session_id: inner.session_id.clone(),
            request_id: inner.request.request_id.clone(),
            source_version,
            generation: self.authority.generation.load(Ordering::Acquire),
            authority: Arc::clone(&self.authority),
            cancellation: inner.cancellation.clone(),
        }
    }

    fn fail_spawned_operation(&self) {
        let mut inner = lock(&self.inner);
        if inner.state != PreviewSessionState::Disposed {
            inner.running = false;
            inner.state = PreviewSessionState::Failed;
        }
    }

    fn run_operation(
        &self,
        operation: OperationSeed,
        resolver: &dyn SourceResolver,
        registry: &PreviewProviderRegistry,
    ) -> Result<PreviewRunOutcome, PreviewRunError> {
        let resolve_context = operation.context(None, operation.budget.resolve_timeout);
        let resolved = resolver.resolve(
            &PreviewResolveRequest {
                request_id: operation.request.request_id.clone(),
                source: operation.request.source.clone(),
                host_kind: operation.host.kind,
            },
            &resolve_context,
        );

        let snapshot = match resolved {
            Ok(snapshot) => {
                if let Err(error) = resolve_context.ensure_active() {
                    return match error {
                        PreviewContextError::Cancelled => {
                            self.cancel_if_current(&operation.token, None, Vec::new())
                        }
                        PreviewContextError::StalePublication => {
                            self.stale_or_cancelled(&operation.token)
                        }
                        PreviewContextError::TimedOut => {
                            self.mark_failed_if_current(&operation.token);
                            Err(PreviewRunError::SourceResolver(SourceResolveError::Timeout))
                        }
                    };
                }
                if snapshot.source != operation.request.source || snapshot.source_version.is_empty()
                {
                    self.mark_failed_if_current(&operation.token);
                    return Err(PreviewRunError::SourceResolver(
                        SourceResolveError::SourceMismatch,
                    ));
                }
                snapshot
            }
            Err(error) => {
                if !self.identity_current(&operation.token) {
                    return self.stale_or_cancelled(&operation.token);
                }
                if matches!(error, SourceResolveError::Cancelled)
                    || resolve_context.cancellation.is_cancelled()
                {
                    return self.cancel_if_current(&operation.token, None, Vec::new());
                }
                self.mark_failed_if_current(&operation.token);
                return Err(PreviewRunError::SourceResolver(error));
            }
        };

        let source_token = match self.publish_snapshot(&operation.token, snapshot.clone()) {
            Some(token) => token,
            None => return self.stale_or_cancelled(&operation.token),
        };

        let mut attempted = Vec::new();
        let mut warnings = Vec::new();
        for provider in &registry.providers {
            let descriptor = provider.descriptor();
            if !descriptor.supports_host(operation.host.kind) {
                continue;
            }
            let provider_id = descriptor.id.clone();
            attempted.push(provider_id.clone());

            if !self.can_publish(&source_token) {
                return self.stale_or_cancelled(&source_token);
            }
            self.set_phase(&source_token, PreviewSessionState::Preparing);

            let probe_context = operation_context(
                &source_token,
                Some(&snapshot.source_version),
                operation.budget.probe_timeout,
            );
            if let Err(error) = probe_context.ensure_active() {
                if error == PreviewContextError::Cancelled {
                    return self.cancel_if_current(&source_token, Some(&snapshot), warnings);
                }
                if error == PreviewContextError::StalePublication {
                    return self.stale_or_cancelled(&source_token);
                }
                warnings.push(PreviewWarning::ProviderFallback {
                    provider_id,
                    reason: PreviewProviderErrorCode::Timeout,
                });
                continue;
            }
            let probe = provider.probe(&snapshot, &probe_context);
            match probe_context.ensure_active() {
                Ok(()) => {}
                Err(PreviewContextError::Cancelled) => {
                    return self.cancel_if_current(&source_token, Some(&snapshot), warnings);
                }
                Err(PreviewContextError::StalePublication) => {
                    return self.stale_or_cancelled(&source_token);
                }
                Err(PreviewContextError::TimedOut) => {
                    warnings.push(PreviewWarning::ProviderFallback {
                        provider_id,
                        reason: PreviewProviderErrorCode::Timeout,
                    });
                    continue;
                }
            }
            if probe == ProviderProbe::Unsupported {
                warnings.push(PreviewWarning::ProviderFallback {
                    provider_id,
                    reason: PreviewProviderErrorCode::Unsupported,
                });
                continue;
            }

            let prepare_context = operation_context(
                &source_token,
                Some(&snapshot.source_version),
                operation.budget.prepare_timeout,
            );
            match prepare_context.ensure_active() {
                Ok(()) => {}
                Err(PreviewContextError::Cancelled) => {
                    return self.cancel_if_current(&source_token, Some(&snapshot), warnings);
                }
                Err(PreviewContextError::StalePublication) => {
                    return self.stale_or_cancelled(&source_token);
                }
                Err(PreviewContextError::TimedOut) => {
                    warnings.push(PreviewWarning::ProviderFallback {
                        provider_id,
                        reason: PreviewProviderErrorCode::Timeout,
                    });
                    continue;
                }
            }
            let prepared = match provider.prepare(&snapshot, &prepare_context) {
                Ok(prepared) => prepared,
                Err(mut error) => {
                    error = match prepare_context.ensure_active() {
                        Ok(()) => error,
                        Err(PreviewContextError::Cancelled) => {
                            return self.cancel_if_current(
                                &source_token,
                                Some(&snapshot),
                                warnings,
                            );
                        }
                        Err(PreviewContextError::StalePublication) => {
                            return self.stale_or_cancelled(&source_token);
                        }
                        Err(PreviewContextError::TimedOut) => PreviewProviderError::Timeout,
                    };
                    if error == PreviewProviderError::Cancelled {
                        return self.cancel_if_current(&source_token, Some(&snapshot), warnings);
                    }
                    if let Some(condition) = error.terminal_condition() {
                        return self.terminal_if_current(
                            &source_token,
                            &snapshot,
                            provider_id,
                            condition,
                            warnings,
                        );
                    }
                    warnings.push(PreviewWarning::ProviderFallback {
                        provider_id,
                        reason: error.code(),
                    });
                    continue;
                }
            };
            if let Err(error) = prepare_context.ensure_active() {
                let handle = Arc::new(Mutex::new(PreparedPreviewGuard::new(prepared)));
                cleanup_preview_handle(&handle);
                if error == PreviewContextError::Cancelled {
                    return self.cancel_if_current(&source_token, Some(&snapshot), warnings);
                }
                if error == PreviewContextError::StalePublication {
                    return self.stale_or_cancelled(&source_token);
                }
                warnings.push(PreviewWarning::ProviderFallback {
                    provider_id,
                    reason: PreviewProviderErrorCode::Timeout,
                });
                continue;
            }

            let handle = Arc::new(Mutex::new(PreparedPreviewGuard::new(prepared)));
            if !self.install_active_provider(
                &source_token,
                provider_id.clone(),
                Arc::clone(&handle),
            ) {
                cleanup_preview_handle(&handle);
                return self.stale_or_cancelled(&source_token);
            }
            self.set_phase(&source_token, PreviewSessionState::Loading);
            let load_context = operation_context(
                &source_token,
                Some(&snapshot.source_version),
                operation.budget.load_timeout,
            );
            let loaded = {
                let mut prepared = lock(&handle);
                prepared.load(&load_context)
            };

            if !self.can_publish(&source_token) {
                self.clear_active_provider(&source_token, &handle);
                cleanup_preview_handle(&handle);
                return self.stale_or_cancelled(&source_token);
            }
            if let Err(error) = load_context.ensure_active() {
                self.clear_active_provider(&source_token, &handle);
                cleanup_preview_handle(&handle);
                if error == PreviewContextError::Cancelled {
                    return self.cancel_if_current(&source_token, Some(&snapshot), warnings);
                }
                if error == PreviewContextError::StalePublication {
                    return self.stale_or_cancelled(&source_token);
                }
                warnings.push(PreviewWarning::ProviderFallback {
                    provider_id,
                    reason: PreviewProviderErrorCode::Timeout,
                });
                continue;
            }

            match loaded {
                Ok(result)
                    if result
                        .representation
                        .is_host_compatible(operation.host.kind) =>
                {
                    let envelope = PreviewRepresentationEnvelope {
                        source_version: snapshot.source_version.clone(),
                        representation: result.representation,
                        completeness: result.completeness,
                        warnings: result.warnings,
                        capabilities: operation
                            .host
                            .capabilities
                            .intersect(snapshot.capabilities)
                            .intersect(descriptor.capabilities),
                    };
                    if !self.publish_ready(&source_token, provider_id.clone(), envelope.clone()) {
                        self.clear_active_provider(&source_token, &handle);
                        cleanup_preview_handle(&handle);
                        return self.stale_or_cancelled(&source_token);
                    }
                    return Ok(PreviewRunOutcome {
                        provider_id: Some(provider_id),
                        envelope,
                        attempted_provider_ids: attempted,
                    });
                }
                Ok(_) => {
                    self.clear_active_provider(&source_token, &handle);
                    cleanup_preview_handle(&handle);
                    warnings.push(PreviewWarning::ProviderFallback {
                        provider_id,
                        reason: PreviewProviderErrorCode::Unsupported,
                    });
                }
                Err(error) => {
                    self.clear_active_provider(&source_token, &handle);
                    cleanup_preview_handle(&handle);
                    if error == PreviewProviderError::Cancelled {
                        return self.cancel_if_current(&source_token, Some(&snapshot), warnings);
                    }
                    if let Some(condition) = error.terminal_condition() {
                        return self.terminal_if_current(
                            &source_token,
                            &snapshot,
                            provider_id,
                            condition,
                            warnings,
                        );
                    }
                    warnings.push(PreviewWarning::ProviderFallback {
                        provider_id,
                        reason: error.code(),
                    });
                }
            }
        }

        let envelope = metadata_fallback(&snapshot, operation.host, warnings);
        if !self.publish_fallback(&source_token, envelope.clone(), PreviewSessionState::Ready) {
            return self.stale_or_cancelled(&source_token);
        }
        Ok(PreviewRunOutcome {
            provider_id: None,
            envelope,
            attempted_provider_ids: attempted,
        })
    }

    fn publish_snapshot(
        &self,
        token: &PreviewPublicationToken,
        snapshot: PreviewSourceSnapshot,
    ) -> Option<PreviewPublicationToken> {
        let mut inner = lock(&self.inner);
        if !self.identity_current_locked(&inner, token) || !token.is_current() {
            return None;
        }
        let source_token = token.with_source_version(snapshot.source_version.clone());
        inner.source_snapshot = Some(snapshot);
        inner.representation = None;
        inner.effective_capabilities = PreviewCapabilities::default();
        inner.state = PreviewSessionState::Preparing;
        Some(source_token)
    }

    fn publish_ready(
        &self,
        token: &PreviewPublicationToken,
        provider_id: String,
        envelope: PreviewRepresentationEnvelope,
    ) -> bool {
        let mut inner = lock(&self.inner);
        if !self.identity_current_locked(&inner, token)
            || !token.is_current()
            || envelope.source_version
                != inner
                    .source_snapshot
                    .as_ref()
                    .map(|snapshot| snapshot.source_version.as_str())
                    .unwrap_or_default()
        {
            return false;
        }
        inner.representation = Some(envelope.clone());
        inner.effective_capabilities = envelope.capabilities;
        if let Some(active) = inner.active_provider.as_mut() {
            active.id = provider_id;
        }
        inner.state = PreviewSessionState::Ready;
        inner.running = false;
        true
    }

    fn publish_fallback(
        &self,
        token: &PreviewPublicationToken,
        envelope: PreviewRepresentationEnvelope,
        state: PreviewSessionState,
    ) -> bool {
        let mut inner = lock(&self.inner);
        if !self.identity_current_locked(&inner, token) || !token.is_current() {
            return false;
        }
        inner.effective_capabilities = envelope.capabilities;
        inner.representation = Some(envelope);
        inner.state = state;
        inner.running = false;
        true
    }

    fn set_phase(&self, token: &PreviewPublicationToken, state: PreviewSessionState) {
        let mut inner = lock(&self.inner);
        if self.identity_current_locked(&inner, token) && token.is_current() {
            inner.state = state;
        }
    }

    fn install_active_provider(
        &self,
        token: &PreviewPublicationToken,
        id: String,
        handle: PreparedPreviewHandle,
    ) -> bool {
        let mut inner = lock(&self.inner);
        if !self.identity_current_locked(&inner, token) || !token.is_current() {
            return false;
        }
        inner.active_provider = Some(ActiveProvider { id, handle });
        true
    }

    fn clear_active_provider(
        &self,
        token: &PreviewPublicationToken,
        handle: &PreparedPreviewHandle,
    ) {
        let active = {
            let mut inner = lock(&self.inner);
            if !self.identity_current_locked(&inner, token) {
                None
            } else if inner
                .active_provider
                .as_ref()
                .is_some_and(|active| Arc::ptr_eq(&active.handle, handle))
            {
                inner.active_provider.take()
            } else {
                None
            }
        };
        cleanup_active_provider(active);
    }

    fn identity_current(&self, token: &PreviewPublicationToken) -> bool {
        let inner = lock(&self.inner);
        self.identity_current_locked(&inner, token)
    }

    fn identity_current_locked(
        &self,
        inner: &SessionInner,
        token: &PreviewPublicationToken,
    ) -> bool {
        if self.authority.disposed.load(Ordering::Acquire)
            || inner.state == PreviewSessionState::Disposed
            || self.authority.generation.load(Ordering::Acquire) != token.generation
            || inner.request.request_id != token.request_id
        {
            return false;
        }
        match token.source_version.as_deref() {
            Some(version) => inner
                .source_snapshot
                .as_ref()
                .is_some_and(|snapshot| snapshot.source_version == version),
            None => true,
        }
    }

    fn mark_failed_if_current(&self, token: &PreviewPublicationToken) {
        let mut inner = lock(&self.inner);
        if self.identity_current_locked(&inner, token) {
            inner.running = false;
            inner.state = PreviewSessionState::Failed;
        }
    }

    fn stale_or_cancelled(
        &self,
        token: &PreviewPublicationToken,
    ) -> Result<PreviewRunOutcome, PreviewRunError> {
        let inner = lock(&self.inner);
        if inner.request.request_id == token.request_id
            && inner.state == PreviewSessionState::Cancelled
        {
            Err(PreviewRunError::Cancelled)
        } else {
            Err(PreviewRunError::StalePublication)
        }
    }

    fn cancel_if_current(
        &self,
        token: &PreviewPublicationToken,
        snapshot: Option<&PreviewSourceSnapshot>,
        warnings: Vec<PreviewWarning>,
    ) -> Result<PreviewRunOutcome, PreviewRunError> {
        let active_provider = {
            let mut inner = lock(&self.inner);
            if !self.identity_current_locked(&inner, token) {
                None
            } else {
                inner.cancellation.cancel();
                self.authority.generation.fetch_add(1, Ordering::AcqRel);
                inner.state = PreviewSessionState::Cancelled;
                inner.running = false;
                if let Some(snapshot) = snapshot.or(inner.source_snapshot.as_ref()) {
                    let envelope = metadata_fallback(snapshot, inner.host, warnings);
                    inner.effective_capabilities = envelope.capabilities;
                    inner.representation = Some(envelope);
                }
                inner.active_provider.take()
            }
        };
        if active_provider.is_none() && !self.state_matches_cancelled(token) {
            return self.stale_or_cancelled(token);
        }
        cleanup_active_provider(active_provider);
        Err(PreviewRunError::Cancelled)
    }

    fn state_matches_cancelled(&self, token: &PreviewPublicationToken) -> bool {
        let inner = lock(&self.inner);
        inner.request.request_id == token.request_id
            && inner.state == PreviewSessionState::Cancelled
    }

    fn terminal_if_current(
        &self,
        token: &PreviewPublicationToken,
        snapshot: &PreviewSourceSnapshot,
        provider_id: String,
        condition: PreviewTerminalCondition,
        mut warnings: Vec<PreviewWarning>,
    ) -> Result<PreviewRunOutcome, PreviewRunError> {
        warnings.push(PreviewWarning::TerminalCondition { condition });
        let envelope = metadata_fallback(snapshot, self.host(), warnings);
        if !self.publish_fallback(token, envelope, PreviewSessionState::Failed) {
            return self.stale_or_cancelled(token);
        }
        Err(PreviewRunError::ProviderTerminal {
            provider_id,
            condition,
        })
    }
}

fn operation_context(
    token: &PreviewPublicationToken,
    source_version: Option<&str>,
    timeout: Duration,
) -> PreviewOperationContext {
    PreviewOperationContext {
        session_id: token.session_id.clone(),
        request_id: token.request_id.clone(),
        source_version: source_version.map(str::to_owned),
        publication: match source_version {
            Some(version) => token.with_source_version(version),
            None => token.clone(),
        },
        cancellation: token.cancellation.clone(),
        deadline: Instant::now() + timeout,
    }
}

fn metadata_fallback(
    snapshot: &PreviewSourceSnapshot,
    host: PreviewHost,
    mut warnings: Vec<PreviewWarning>,
) -> PreviewRepresentationEnvelope {
    warnings.push(PreviewWarning::MetadataFallback);
    PreviewRepresentationEnvelope {
        source_version: snapshot.source_version.clone(),
        representation: PreviewRepresentation::Metadata {
            metadata: snapshot.metadata.clone(),
        },
        completeness: PreviewCompleteness::Complete,
        warnings,
        capabilities: host
            .capabilities
            .intersect(snapshot.capabilities)
            .intersect(PreviewCapabilities::metadata_fallback()),
    }
}

fn cleanup_preview_handle(handle: &PreparedPreviewHandle) {
    lock(handle).cleanup_once();
}

fn cleanup_active_provider(active: Option<ActiveProvider>) {
    if let Some(active) = active {
        cleanup_preview_handle(&active.handle);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicUsize;

    fn source(id: &str) -> PreviewSourceRef {
        PreviewSourceRef::Ephemeral {
            browse_session_id: "browse-1".to_string(),
            entry_id: id.to_string(),
        }
    }

    fn metadata(name: &str) -> PreviewMetadata {
        PreviewMetadata {
            display_name: name.to_string(),
            media_type: Some("text/plain".to_string()),
            extension: Some("txt".to_string()),
            size_bytes: Some(12),
            modified_at_epoch_ms: Some(1),
            materialization: MaterializationState::Local,
            read_eligibility: ContentReadEligibility::Eligible,
        }
    }

    fn snapshot(source: PreviewSourceRef, version: &str) -> PreviewSourceSnapshot {
        PreviewSourceSnapshot::new(
            source,
            version,
            metadata("sample.txt"),
            PreviewCapabilities::all(),
        )
    }

    fn text_result(text: &str) -> PreviewProviderResult {
        PreviewProviderResult {
            representation: PreviewRepresentation::Text {
                text: text.to_string(),
                language: Some("text".to_string()),
            },
            completeness: PreviewCompleteness::Complete,
            warnings: Vec::new(),
        }
    }

    fn host() -> PreviewHost {
        PreviewHost::new(PreviewHostKind::ZenFloating, PreviewCapabilities::all())
    }

    fn session(entry_id: &str) -> PreviewSession {
        PreviewSession::new(PreviewSessionConfig::new(
            "session-1",
            "request-1",
            source(entry_id),
            host(),
        ))
    }

    struct FakeResolver {
        snapshot: PreviewSourceSnapshot,
    }

    impl SourceResolver for FakeResolver {
        fn resolve(
            &self,
            request: &PreviewResolveRequest,
            context: &PreviewOperationContext,
        ) -> Result<PreviewSourceSnapshot, SourceResolveError> {
            context.ensure_active().map_err(|error| match error {
                PreviewContextError::Cancelled => SourceResolveError::Cancelled,
                PreviewContextError::TimedOut => SourceResolveError::Timeout,
                PreviewContextError::StalePublication => SourceResolveError::Cancelled,
            })?;
            if request.source != self.snapshot.source {
                return Err(SourceResolveError::SourceMismatch);
            }
            Ok(self.snapshot.clone())
        }
    }

    struct FakePrepared {
        load_result: Result<PreviewProviderResult, PreviewProviderError>,
        cleanup_count: Arc<AtomicUsize>,
        started: Option<Arc<AtomicBool>>,
        wait_for_cancel: bool,
    }

    impl PreparedPreview for FakePrepared {
        fn load(
            &mut self,
            context: &PreviewOperationContext,
        ) -> Result<PreviewProviderResult, PreviewProviderError> {
            if let Some(started) = &self.started {
                started.store(true, Ordering::Release);
            }
            if self.wait_for_cancel {
                while !context.cancellation().is_cancelled() && context.is_publication_current() {
                    thread::yield_now();
                }
                return Err(PreviewProviderError::Cancelled);
            }
            self.load_result.clone()
        }

        fn cleanup(&mut self) {
            self.cleanup_count.fetch_add(1, Ordering::AcqRel);
        }
    }

    struct FakeProvider {
        descriptor: PreviewProviderDescriptor,
        probe: ProviderProbe,
        prepare_error: Option<PreviewProviderError>,
        load_result: Result<PreviewProviderResult, PreviewProviderError>,
        prepare_calls: AtomicUsize,
        cleanup_count: Arc<AtomicUsize>,
        started: Option<Arc<AtomicBool>>,
        wait_for_cancel: bool,
    }

    impl PreviewProvider for FakeProvider {
        fn descriptor(&self) -> &PreviewProviderDescriptor {
            &self.descriptor
        }

        fn probe(
            &self,
            _snapshot: &PreviewSourceSnapshot,
            _context: &PreviewOperationContext,
        ) -> ProviderProbe {
            self.probe
        }

        fn prepare(
            &self,
            _snapshot: &PreviewSourceSnapshot,
            _context: &PreviewOperationContext,
        ) -> Result<Box<dyn PreparedPreview>, PreviewProviderError> {
            self.prepare_calls.fetch_add(1, Ordering::AcqRel);
            if let Some(error) = self.prepare_error {
                return Err(error);
            }
            Ok(Box::new(FakePrepared {
                load_result: self.load_result.clone(),
                cleanup_count: Arc::clone(&self.cleanup_count),
                started: self.started.clone(),
                wait_for_cancel: self.wait_for_cancel,
            }))
        }
    }

    fn fake_provider(
        id: &str,
        priority: i32,
        probe: ProviderProbe,
        prepare_error: Option<PreviewProviderError>,
        load_result: Result<PreviewProviderResult, PreviewProviderError>,
    ) -> Arc<FakeProvider> {
        Arc::new(FakeProvider {
            descriptor: PreviewProviderDescriptor::new(
                id,
                priority,
                PreviewCapabilities::all(),
                vec![PreviewHostKind::ZenFloating],
                true,
            ),
            probe,
            prepare_error,
            load_result,
            prepare_calls: AtomicUsize::new(0),
            cleanup_count: Arc::new(AtomicUsize::new(0)),
            started: None,
            wait_for_cancel: false,
        })
    }

    fn registry(providers: Vec<Arc<FakeProvider>>) -> Arc<PreviewProviderRegistry> {
        let providers: Vec<Arc<dyn PreviewProvider>> = providers
            .into_iter()
            .map(|provider| provider as Arc<dyn PreviewProvider>)
            .collect();
        Arc::new(PreviewProviderRegistry::new(providers).expect("fake provider registry"))
    }

    fn resolver(entry_id: &str, version: &str) -> Arc<FakeResolver> {
        Arc::new(FakeResolver {
            snapshot: snapshot(source(entry_id), version),
        })
    }

    fn wait_until(flag: &AtomicBool) {
        let deadline = Instant::now() + Duration::from_secs(2);
        while !flag.load(Ordering::Acquire) && Instant::now() < deadline {
            thread::sleep(Duration::from_millis(1));
        }
        assert!(flag.load(Ordering::Acquire), "fake provider did not start");
    }

    #[test]
    fn shell_and_session_exist_before_slow_provider_result() {
        let started = Arc::new(AtomicBool::new(false));
        let cleanup_count = Arc::new(AtomicUsize::new(0));
        let provider = Arc::new(FakeProvider {
            descriptor: PreviewProviderDescriptor::new(
                "slow",
                10,
                PreviewCapabilities::all(),
                vec![PreviewHostKind::ZenFloating],
                true,
            ),
            probe: ProviderProbe::Compatible,
            prepare_error: None,
            load_result: Ok(text_result("slow")),
            prepare_calls: AtomicUsize::new(0),
            cleanup_count: Arc::clone(&cleanup_count),
            started: Some(Arc::clone(&started)),
            wait_for_cancel: true,
        });
        let session = session("entry-a");
        let task = session
            .start(resolver("entry-a", "version-a"), registry(vec![provider]))
            .expect("preview worker starts");

        assert!(matches!(
            session.state(),
            PreviewSessionState::Resolving
                | PreviewSessionState::Preparing
                | PreviewSessionState::Loading
        ));
        wait_until(&started);
        assert!(session.representation().is_none());
        assert!(session.cancel());
        assert!(matches!(task.join(), Err(PreviewRunError::Cancelled)));
        assert_eq!(session.state(), PreviewSessionState::Cancelled);
        assert_eq!(cleanup_count.load(Ordering::Acquire), 1);
    }

    #[test]
    fn higher_priority_compatible_provider_wins_over_generic_provider() {
        let specific = fake_provider(
            "specific",
            100,
            ProviderProbe::Compatible,
            None,
            Ok(text_result("specific")),
        );
        let generic = fake_provider(
            "generic",
            10,
            ProviderProbe::Compatible,
            None,
            Ok(text_result("generic")),
        );
        let session = session("entry-a");
        let outcome = session
            .run(
                &*resolver("entry-a", "version-a"),
                &registry(vec![generic.clone(), specific.clone()]),
            )
            .expect("specific provider succeeds");

        assert_eq!(outcome.provider_id.as_deref(), Some("specific"));
        assert_eq!(outcome.attempted_provider_ids, vec!["specific"]);
        assert_eq!(specific.prepare_calls.load(Ordering::Acquire), 1);
        assert_eq!(generic.prepare_calls.load(Ordering::Acquire), 0);
    }

    #[test]
    fn provider_local_unsupported_failure_timeout_and_corruption_fall_back() {
        let cases = [
            (ProviderProbe::Unsupported, None, Ok(text_result("generic"))),
            (
                ProviderProbe::Compatible,
                None,
                Err(PreviewProviderError::Failed),
            ),
            (
                ProviderProbe::Compatible,
                None,
                Err(PreviewProviderError::Timeout),
            ),
            (
                ProviderProbe::Compatible,
                None,
                Err(PreviewProviderError::CorruptSource),
            ),
        ];
        for (index, (probe, prepare_error, load_result)) in cases.into_iter().enumerate() {
            let local = fake_provider("local", 100, probe, prepare_error, load_result);
            let generic = fake_provider(
                "generic",
                10,
                ProviderProbe::Compatible,
                None,
                Ok(text_result("generic")),
            );
            let session = session(&format!("entry-{index}"));
            let outcome = session
                .run(
                    &*resolver(&format!("entry-{index}"), "version-a"),
                    &registry(vec![local.clone(), generic]),
                )
                .expect("provider-local error falls back");
            assert_eq!(outcome.provider_id.as_deref(), Some("generic"));
            assert_eq!(outcome.attempted_provider_ids, vec!["local", "generic"]);
        }
    }

    #[test]
    fn terminal_source_conditions_do_not_fall_through_to_byte_provider() {
        for error in [
            PreviewProviderError::SourceUnavailable,
            PreviewProviderError::MaterializationRequired,
            PreviewProviderError::PermissionDenied,
            PreviewProviderError::IdentityChanged,
        ] {
            let terminal =
                fake_provider("terminal", 100, ProviderProbe::Compatible, None, Err(error));
            let generic = fake_provider(
                "generic",
                10,
                ProviderProbe::Compatible,
                None,
                Ok(text_result("must-not-load")),
            );
            let session = session("entry-terminal");
            let result = session.run(
                &*resolver("entry-terminal", "version-terminal"),
                &registry(vec![terminal, generic.clone()]),
            );
            assert!(matches!(
                result,
                Err(PreviewRunError::ProviderTerminal { .. })
            ));
            assert_eq!(generic.prepare_calls.load(Ordering::Acquire), 0);
            assert_eq!(session.state(), PreviewSessionState::Failed);
            assert!(matches!(
                session
                    .representation()
                    .map(|envelope| envelope.representation),
                Some(PreviewRepresentation::Metadata { .. })
            ));
        }
    }

    #[test]
    fn cancellation_is_terminal_and_does_not_fall_through() {
        let terminal = fake_provider(
            "cancelled",
            100,
            ProviderProbe::Compatible,
            None,
            Err(PreviewProviderError::Cancelled),
        );
        let generic = fake_provider(
            "generic",
            10,
            ProviderProbe::Compatible,
            None,
            Ok(text_result("must-not-load")),
        );
        let session = session("entry-cancelled");
        let result = session.run(
            &*resolver("entry-cancelled", "version-cancelled"),
            &registry(vec![terminal, generic.clone()]),
        );
        assert!(matches!(result, Err(PreviewRunError::Cancelled)));
        assert_eq!(generic.prepare_calls.load(Ordering::Acquire), 0);
        assert_eq!(session.state(), PreviewSessionState::Cancelled);
    }

    #[test]
    fn stale_result_cannot_publish_after_switching_source() {
        let started = Arc::new(AtomicBool::new(false));
        let cleanup_count = Arc::new(AtomicUsize::new(0));
        let provider = Arc::new(FakeProvider {
            descriptor: PreviewProviderDescriptor::new(
                "slow",
                100,
                PreviewCapabilities::all(),
                vec![PreviewHostKind::ZenFloating],
                true,
            ),
            probe: ProviderProbe::Compatible,
            prepare_error: None,
            load_result: Ok(text_result("source-a")),
            prepare_calls: AtomicUsize::new(0),
            cleanup_count: Arc::clone(&cleanup_count),
            started: Some(Arc::clone(&started)),
            wait_for_cancel: true,
        });
        let session = session("entry-a");
        let task = session
            .start(resolver("entry-a", "version-a"), registry(vec![provider]))
            .expect("preview worker starts");
        wait_until(&started);

        session
            .switch_source(PreviewRequest {
                request_id: "request-b".to_string(),
                source: source("entry-b"),
            })
            .expect("source switch revokes old publication");
        assert_eq!(session.state(), PreviewSessionState::Resolving);
        assert!(matches!(
            task.join(),
            Err(PreviewRunError::StalePublication)
        ));
        assert!(session.representation().is_none());
        assert_eq!(cleanup_count.load(Ordering::Acquire), 1);
    }

    #[test]
    fn dispose_cleans_prepared_provider_and_revokes_publication() {
        let started = Arc::new(AtomicBool::new(false));
        let cleanup_count = Arc::new(AtomicUsize::new(0));
        let provider = Arc::new(FakeProvider {
            descriptor: PreviewProviderDescriptor::new(
                "disposable",
                100,
                PreviewCapabilities::all(),
                vec![PreviewHostKind::ZenFloating],
                true,
            ),
            probe: ProviderProbe::Compatible,
            prepare_error: None,
            load_result: Ok(text_result("never-published")),
            prepare_calls: AtomicUsize::new(0),
            cleanup_count: Arc::clone(&cleanup_count),
            started: Some(Arc::clone(&started)),
            wait_for_cancel: true,
        });
        let session = session("entry-dispose");
        let task = session
            .start(
                resolver("entry-dispose", "version-dispose"),
                registry(vec![provider]),
            )
            .expect("preview worker starts");
        wait_until(&started);
        assert!(session.dispose());
        assert_eq!(session.state(), PreviewSessionState::Disposed);
        assert!(matches!(
            task.join(),
            Err(PreviewRunError::StalePublication)
        ));
        assert_eq!(cleanup_count.load(Ordering::Acquire), 1);
    }

    #[test]
    fn metadata_fallback_survives_provider_failure() {
        let provider = fake_provider(
            "failed",
            100,
            ProviderProbe::Compatible,
            None,
            Err(PreviewProviderError::Failed),
        );
        let session = session("entry-fallback");
        let outcome = session
            .run(
                &*resolver("entry-fallback", "version-fallback"),
                &registry(vec![provider]),
            )
            .expect("metadata fallback remains available");
        assert!(outcome.provider_id.is_none());
        assert!(matches!(
            outcome.envelope.representation,
            PreviewRepresentation::Metadata { .. }
        ));
        assert!(outcome
            .envelope
            .warnings
            .iter()
            .any(|warning| matches!(warning, PreviewWarning::ProviderFallback { .. })));
        assert!(outcome
            .envelope
            .warnings
            .iter()
            .any(|warning| matches!(warning, PreviewWarning::MetadataFallback)));
        assert_eq!(session.state(), PreviewSessionState::Ready);
    }

    #[test]
    fn effective_capabilities_are_host_provider_source_intersection() {
        let mut host_capabilities = PreviewCapabilities::all();
        host_capabilities.can_zoom = false;
        let mut source_capabilities = PreviewCapabilities::all();
        source_capabilities.can_playback = false;
        let mut provider_capabilities = PreviewCapabilities::all();
        provider_capabilities.can_search = false;
        let provider = Arc::new(FakeProvider {
            descriptor: PreviewProviderDescriptor::new(
                "capability-provider",
                100,
                provider_capabilities,
                vec![PreviewHostKind::ZenFloating],
                true,
            ),
            probe: ProviderProbe::Compatible,
            prepare_error: None,
            load_result: Ok(text_result("capabilities")),
            prepare_calls: AtomicUsize::new(0),
            cleanup_count: Arc::new(AtomicUsize::new(0)),
            started: None,
            wait_for_cancel: false,
        });
        let session = PreviewSession::new(PreviewSessionConfig {
            session_id: "session-capabilities".to_string(),
            request: PreviewRequest {
                request_id: "request-capabilities".to_string(),
                source: source("entry-capabilities"),
            },
            host: PreviewHost::new(PreviewHostKind::ZenFloating, host_capabilities),
            budget: PreviewWorkBudget::default(),
        });
        let source_resolver = FakeResolver {
            snapshot: PreviewSourceSnapshot::new(
                source("entry-capabilities"),
                "version-capabilities",
                metadata("capabilities.txt"),
                source_capabilities,
            ),
        };
        let outcome = session
            .run(&source_resolver, &registry(vec![provider]))
            .expect("capability provider succeeds");
        assert!(!outcome.envelope.capabilities.can_search);
        assert!(!outcome.envelope.capabilities.can_zoom);
        assert!(!outcome.envelope.capabilities.can_playback);
        assert!(outcome.envelope.capabilities.can_select_text);
    }

    #[test]
    fn publication_token_is_revoked_by_source_switch() {
        let session = session("entry-token-a");
        let token = session.current_publication().expect("idle token exists");
        assert!(session.can_publish(&token));
        session
            .switch_source(PreviewRequest {
                request_id: "request-token-b".to_string(),
                source: source("entry-token-b"),
            })
            .expect("switch succeeds");
        assert!(!token.is_current());
        assert!(!session.can_publish(&token));
    }
}
