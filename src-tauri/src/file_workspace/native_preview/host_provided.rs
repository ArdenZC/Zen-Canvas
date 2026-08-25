//! OS/shell-owned HostProvided request lifecycle.
//!
//! Host tokens are opaque request-scoped capabilities. They never encode a
//! filesystem path and never become a managed File Library/Browse identity or
//! a renderer-facing byte service.

use crate::file_workspace::{contracts::PreviewHostKind, preview::BoundedContentRead};
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, MutexGuard,
    },
    time::{Duration, Instant},
};
use thiserror::Error;
use uuid::Uuid;

const TOKEN_LIMIT: usize = 256;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct HostProvidedConfig {
    pub(crate) max_records: usize,
    pub(crate) max_read_bytes: u32,
    pub(crate) ttl: Duration,
}

impl Default for HostProvidedConfig {
    fn default() -> Self {
        Self {
            max_records: 32,
            max_read_bytes: 1024 * 1024,
            ttl: Duration::from_secs(60),
        }
    }
}

impl HostProvidedConfig {
    fn validate(self) -> Result<Self, HostProvidedError> {
        if self.max_records == 0 || self.max_read_bytes == 0 || self.ttl.is_zero() {
            return Err(HostProvidedError::InvalidRequest);
        }
        Ok(self)
    }
}

#[cfg_attr(
    not(test),
    expect(
        dead_code,
        reason = "W4-03 will map the complete shell-owned source error surface"
    )
)]
#[cfg_attr(
    test,
    expect(
        dead_code,
        reason = "HostProvided unit fixtures only exercise the successful and failed read paths"
    )
)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Error)]
pub(crate) enum HostProvidedSourceError {
    #[error("host-provided source is unavailable")]
    Unavailable,
    #[error("host-provided source permission was denied")]
    PermissionDenied,
    #[error("host-provided source request was cancelled")]
    Cancelled,
    #[error("host-provided source read failed")]
    Failed,
}

/// Narrow request-owned shell source. W4-03 may adapt an Explorer IStream (or
/// another separately reviewed native request source) behind this contract.
/// The source itself is never exposed to generic Preview renderer IPC.
pub(crate) trait HostProvidedReadSource: Send + Sync {
    fn read_bounded(
        &self,
        offset_bytes: u64,
        max_bytes: u32,
        context: &HostProvidedReadContext,
    ) -> Result<BoundedContentRead, HostProvidedSourceError>;
}

#[derive(Clone)]
pub(crate) struct HostProvidedReadContext {
    cancelled: Arc<AtomicBool>,
}

impl HostProvidedReadContext {
    pub(crate) fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::Acquire)
    }
}

#[derive(Clone)]
pub(crate) struct HostProvidedRegistration {
    pub(crate) host: PreviewHostKind,
    pub(crate) generation_id: String,
    pub(crate) source: Arc<dyn HostProvidedReadSource>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct HostProvidedHandle {
    pub(crate) host_token: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct HostProvidedReadRequest {
    pub(crate) host_token: String,
    pub(crate) host: PreviewHostKind,
    pub(crate) generation_id: String,
    pub(crate) offset_bytes: u64,
    pub(crate) max_bytes: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub(crate) enum HostProvidedError {
    #[error("host-provided request is invalid")]
    InvalidRequest,
    #[error("native shell host is not activated for HostProvided registration")]
    UnsupportedHost,
    #[error("host-provided registry is at capacity")]
    CapacityExceeded,
    #[error("host-provided token is invalid or stale")]
    InvalidOrStale,
    #[error("host-provided registry is disposed")]
    Disposed,
    #[error("host-provided source is unavailable")]
    SourceUnavailable,
    #[error("host-provided source permission was denied")]
    PermissionDenied,
    #[error("host-provided source request was cancelled")]
    Cancelled,
    #[error("host-provided source read failed")]
    Failed,
}

struct HostRecord {
    host: PreviewHostKind,
    generation_id: String,
    source: Arc<dyn HostProvidedReadSource>,
    expires_at: Instant,
    cancelled: Arc<AtomicBool>,
}

#[derive(Default)]
struct HostState {
    records: HashMap<String, HostRecord>,
    disposed: bool,
}

pub(crate) struct HostProvidedRegistry {
    config: HostProvidedConfig,
    state: Mutex<HostState>,
}

#[cfg_attr(
    not(test),
    expect(
        dead_code,
        reason = "W4-03 will activate the complete HostProvided shell lifecycle seam"
    )
)]
impl HostProvidedRegistry {
    pub(crate) fn new(config: HostProvidedConfig) -> Result<Arc<Self>, HostProvidedError> {
        Ok(Arc::new(Self {
            config: config.validate()?,
            state: Mutex::new(HostState::default()),
        }))
    }

    pub(crate) fn register(
        &self,
        registration: HostProvidedRegistration,
    ) -> Result<HostProvidedHandle, HostProvidedError> {
        if !valid_token(&registration.generation_id) {
            return Err(HostProvidedError::InvalidRequest);
        }
        if !activated_shell_host(registration.host) {
            return Err(HostProvidedError::UnsupportedHost);
        }
        self.prune_expired();
        let mut state = lock(&self.state);
        if state.disposed {
            return Err(HostProvidedError::Disposed);
        }
        if state.records.len() >= self.config.max_records {
            return Err(HostProvidedError::CapacityExceeded);
        }
        let host_token = Uuid::new_v4().to_string();
        let expires_at = Instant::now()
            .checked_add(self.config.ttl)
            .ok_or(HostProvidedError::InvalidRequest)?;
        let cancelled = Arc::new(AtomicBool::new(false));
        state.records.insert(
            host_token.clone(),
            HostRecord {
                host: registration.host,
                generation_id: registration.generation_id,
                source: registration.source,
                expires_at,
                cancelled,
            },
        );
        Ok(HostProvidedHandle { host_token })
    }

    pub(crate) fn read(
        &self,
        request: &HostProvidedReadRequest,
    ) -> Result<BoundedContentRead, HostProvidedError> {
        if !valid_token(&request.host_token)
            || !valid_token(&request.generation_id)
            || !activated_shell_host(request.host)
            || request.max_bytes == 0
            || request.max_bytes > self.config.max_read_bytes
            || request
                .offset_bytes
                .checked_add(u64::from(request.max_bytes))
                .is_none()
        {
            return Err(HostProvidedError::InvalidRequest);
        }
        self.prune_expired();
        let (source, context) = {
            let state = lock(&self.state);
            if state.disposed {
                return Err(HostProvidedError::Disposed);
            }
            let record = state
                .records
                .get(&request.host_token)
                .ok_or(HostProvidedError::InvalidOrStale)?;
            if record.host != request.host || record.generation_id != request.generation_id {
                return Err(HostProvidedError::InvalidOrStale);
            }
            (
                Arc::clone(&record.source),
                HostProvidedReadContext {
                    cancelled: Arc::clone(&record.cancelled),
                },
            )
        };

        let read = source
            .read_bounded(request.offset_bytes, request.max_bytes, &context)
            .map_err(map_source_error)?;
        if read.bytes.len() > request.max_bytes as usize {
            return Err(HostProvidedError::Failed);
        }

        // Re-check publication rights after the potentially blocking source
        // read. Unload/revoke/expiry racing the read invalidates the result.
        let mut state = lock(&self.state);
        if state.disposed {
            return Err(HostProvidedError::Disposed);
        }
        if context.is_cancelled() {
            return Err(HostProvidedError::Cancelled);
        }
        let record = state
            .records
            .get(&request.host_token)
            .ok_or(HostProvidedError::InvalidOrStale)?;
        if record.host != request.host || record.generation_id != request.generation_id {
            return Err(HostProvidedError::InvalidOrStale);
        }
        if Instant::now() >= record.expires_at {
            if let Some(record) = state.records.remove(&request.host_token) {
                record.cancelled.store(true, Ordering::Release);
            }
            return Err(HostProvidedError::Cancelled);
        }
        Ok(read)
    }

    pub(crate) fn revoke(
        &self,
        host_token: &str,
        host: PreviewHostKind,
        generation_id: &str,
    ) -> bool {
        let mut state = lock(&self.state);
        let matches = state
            .records
            .get(host_token)
            .is_some_and(|record| record.host == host && record.generation_id == generation_id);
        if matches {
            if let Some(record) = state.records.remove(host_token) {
                record.cancelled.store(true, Ordering::Release);
            }
        }
        matches
    }

    pub(crate) fn revoke_generation(&self, host: PreviewHostKind, generation_id: &str) -> usize {
        let mut state = lock(&self.state);
        let tokens = state
            .records
            .iter()
            .filter(|&(_, record)| record.host == host && record.generation_id == generation_id)
            .map(|(token, _)| token.clone())
            .collect::<Vec<_>>();
        let removed = tokens.len();
        for token in tokens {
            if let Some(record) = state.records.remove(&token) {
                record.cancelled.store(true, Ordering::Release);
            }
        }
        removed
    }

    pub(crate) fn dispose(&self) {
        let mut state = lock(&self.state);
        if state.disposed {
            return;
        }
        state.disposed = true;
        for record in state.records.drain().map(|(_, record)| record) {
            record.cancelled.store(true, Ordering::Release);
        }
    }

    fn prune_expired(&self) {
        let now = Instant::now();
        let mut state = lock(&self.state);
        let expired = state
            .records
            .iter()
            .filter(|&(_, record)| record.expires_at <= now)
            .map(|(token, _)| token.clone())
            .collect::<Vec<_>>();
        for token in expired {
            if let Some(record) = state.records.remove(&token) {
                record.cancelled.store(true, Ordering::Release);
            }
        }
    }

    #[cfg(test)]
    pub(crate) fn count(&self) -> usize {
        self.prune_expired();
        lock(&self.state).records.len()
    }
}

fn activated_shell_host(host: PreviewHostKind) -> bool {
    // W4-01 prepares only the source lifecycle consumed by W4-03/04. A Finder
    // extension and WindowsQuickPreview remain unactivated product scope.
    matches!(host, PreviewHostKind::WindowsPreviewHandler)
}

fn valid_token(value: &str) -> bool {
    !value.is_empty() && value.len() <= TOKEN_LIMIT
}

fn map_source_error(error: HostProvidedSourceError) -> HostProvidedError {
    match error {
        HostProvidedSourceError::Unavailable => HostProvidedError::SourceUnavailable,
        HostProvidedSourceError::PermissionDenied => HostProvidedError::PermissionDenied,
        HostProvidedSourceError::Cancelled => HostProvidedError::Cancelled,
        HostProvidedSourceError::Failed => HostProvidedError::Failed,
    }
}

fn lock<T>(value: &Mutex<T>) -> MutexGuard<'_, T> {
    value
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}

#[cfg(test)]
#[path = "tests/host_provided_lifecycle.rs"]
mod host_provided_lifecycle_tests;
