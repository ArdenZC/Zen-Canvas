//! Process-local request-scoped host input for native Preview adapters.
//!
//! This crate deliberately owns no filesystem paths, managed identities,
//! renderer IPC, provider selection, or durable state. It is shared by the
//! main application and the Windows Preview Handler DLL so both sides use one
//! bounded capability implementation instead of growing parallel registries.

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

/// The only shell host activated by W4-01/W4-03.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum HostProvidedHost {
    ZenFloating,
    ZenPinned,
    MacQuickLookExtension,
    WindowsQuickPreview,
    WindowsPreviewHandler,
}

/// Bounded bytes returned by a request-owned host source.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BoundedContentRead {
    pub bytes: Vec<u8>,
    pub complete: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct HostProvidedConfig {
    pub max_records: usize,
    pub max_read_bytes: u32,
    pub ttl: Duration,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Error)]
pub enum HostProvidedSourceError {
    #[error("host-provided source is unavailable")]
    Unavailable,
    #[error("host-provided source permission was denied")]
    PermissionDenied,
    #[error("host-provided source request was cancelled")]
    Cancelled,
    #[error("host-provided source read failed")]
    Failed,
}

/// Narrow request-owned shell source. The source itself is never exposed to
/// generic Preview renderer IPC.
pub trait HostProvidedReadSource: Send + Sync {
    fn read_bounded(
        &self,
        offset_bytes: u64,
        max_bytes: u32,
        context: &HostProvidedReadContext,
    ) -> Result<BoundedContentRead, HostProvidedSourceError>;
}

#[derive(Clone)]
pub struct HostProvidedReadContext {
    cancelled: Arc<AtomicBool>,
}

impl HostProvidedReadContext {
    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::Acquire)
    }
}

#[derive(Clone)]
pub struct HostProvidedRegistration {
    pub host: HostProvidedHost,
    pub generation_id: String,
    pub source: Arc<dyn HostProvidedReadSource>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostProvidedHandle {
    pub host_token: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostProvidedReadRequest {
    pub host_token: String,
    pub host: HostProvidedHost,
    pub generation_id: String,
    pub offset_bytes: u64,
    pub max_bytes: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum HostProvidedError {
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
    host: HostProvidedHost,
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

/// One process-local registry for request-scoped host capabilities.
pub struct HostProvidedRegistry {
    config: HostProvidedConfig,
    state: Mutex<HostState>,
}

impl HostProvidedRegistry {
    pub fn new(config: HostProvidedConfig) -> Result<Arc<Self>, HostProvidedError> {
        Ok(Arc::new(Self {
            config: config.validate()?,
            state: Mutex::new(HostState::default()),
        }))
    }

    pub fn register(
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

    pub fn read(
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
        let expires_at = record.expires_at;
        if Instant::now() >= expires_at {
            let detached = state.records.remove(&request.host_token).inspect(|record| {
                record.cancelled.store(true, Ordering::Release);
            });
            drop(state);
            drop(detached);
            return Err(HostProvidedError::Cancelled);
        }
        Ok(read)
    }

    pub fn revoke(&self, host_token: &str, host: HostProvidedHost, generation_id: &str) -> bool {
        let detached = {
            let mut state = lock(&self.state);
            let matches = state
                .records
                .get(host_token)
                .is_some_and(|record| record.host == host && record.generation_id == generation_id);
            if matches {
                state.records.remove(host_token).inspect(|record| {
                    record.cancelled.store(true, Ordering::Release);
                })
            } else {
                None
            }
        };
        let removed = detached.is_some();
        drop(detached);
        removed
    }

    pub fn revoke_generation(&self, host: HostProvidedHost, generation_id: &str) -> usize {
        let detached = {
            let mut state = lock(&self.state);
            detach_records_where(&mut state, |record| {
                record.host == host && record.generation_id == generation_id
            })
        };
        let removed = detached.len();
        drop(detached);
        removed
    }

    pub fn dispose(&self) {
        let detached = {
            let mut state = lock(&self.state);
            if state.disposed {
                return;
            }
            state.disposed = true;
            state
                .records
                .drain()
                .map(|(_, record)| {
                    record.cancelled.store(true, Ordering::Release);
                    record
                })
                .collect::<Vec<_>>()
        };
        drop(detached);
    }

    fn prune_expired(&self) {
        let now = Instant::now();
        let detached = {
            let mut state = lock(&self.state);
            detach_records_where(&mut state, |record| record.expires_at <= now)
        };
        drop(detached);
    }

    /// Test-only lifecycle observability retained for the main app contract
    /// tests and the Windows handler harness.
    #[doc(hidden)]
    pub fn state_lock_is_available_for_test(&self) -> bool {
        self.state.try_lock().is_ok()
    }

    /// Test-only deterministic expiry hook; it never exists in the wire API.
    #[doc(hidden)]
    pub fn force_expire_for_test(&self, host_token: &str) {
        let mut state = lock(&self.state);
        if let Some(record) = state.records.get_mut(host_token) {
            let now = Instant::now();
            record.expires_at = now.checked_sub(Duration::from_secs(1)).unwrap_or(now);
        }
    }

    /// Test-only count of live request records.
    #[doc(hidden)]
    pub fn count(&self) -> usize {
        self.prune_expired();
        lock(&self.state).records.len()
    }
}

fn detach_records_where(
    state: &mut HostState,
    predicate: impl Fn(&HostRecord) -> bool,
) -> Vec<HostRecord> {
    let tokens = state
        .records
        .iter()
        .filter(|&(_, record)| predicate(record))
        .map(|(token, _)| token.clone())
        .collect::<Vec<_>>();
    let mut detached = Vec::with_capacity(tokens.len());
    for token in tokens {
        if let Some(record) = state.records.remove(&token) {
            record.cancelled.store(true, Ordering::Release);
            detached.push(record);
        }
    }
    detached
}

fn activated_shell_host(host: HostProvidedHost) -> bool {
    matches!(host, HostProvidedHost::WindowsPreviewHandler)
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
mod tests {
    use super::*;

    struct MemorySource {
        bytes: Vec<u8>,
    }

    impl HostProvidedReadSource for MemorySource {
        fn read_bounded(
            &self,
            offset_bytes: u64,
            max_bytes: u32,
            _context: &HostProvidedReadContext,
        ) -> Result<BoundedContentRead, HostProvidedSourceError> {
            let start =
                usize::try_from(offset_bytes).map_err(|_| HostProvidedSourceError::Failed)?;
            let end = start
                .saturating_add(max_bytes as usize)
                .min(self.bytes.len());
            Ok(BoundedContentRead {
                bytes: self.bytes.get(start..end).unwrap_or_default().to_vec(),
                complete: end == self.bytes.len(),
            })
        }
    }

    fn registration() -> HostProvidedRegistration {
        HostProvidedRegistration {
            host: HostProvidedHost::WindowsPreviewHandler,
            generation_id: "generation-1".to_string(),
            source: Arc::new(MemorySource {
                bytes: b"shared host bytes".to_vec(),
            }),
        }
    }

    #[test]
    fn bounded_read_is_opaque_and_revocable() {
        let registry = HostProvidedRegistry::new(HostProvidedConfig::default()).unwrap();
        let handle = registry.register(registration()).unwrap();
        let result = registry
            .read(&HostProvidedReadRequest {
                host_token: handle.host_token.clone(),
                host: HostProvidedHost::WindowsPreviewHandler,
                generation_id: "generation-1".to_string(),
                offset_bytes: 7,
                max_bytes: 4,
            })
            .unwrap();
        assert_eq!(result.bytes, b"host");
        assert!(registry.revoke(
            &handle.host_token,
            HostProvidedHost::WindowsPreviewHandler,
            "generation-1"
        ));
        assert_eq!(registry.count(), 0);
    }

    #[test]
    fn wrong_generation_and_invalid_bounds_fail_closed() {
        let registry = HostProvidedRegistry::new(HostProvidedConfig::default()).unwrap();
        let handle = registry.register(registration()).unwrap();
        let wrong_generation = registry.read(&HostProvidedReadRequest {
            host_token: handle.host_token.clone(),
            host: HostProvidedHost::WindowsPreviewHandler,
            generation_id: "generation-2".to_string(),
            offset_bytes: 0,
            max_bytes: 4,
        });
        assert_eq!(wrong_generation, Err(HostProvidedError::InvalidOrStale));
        let invalid_bounds = registry.read(&HostProvidedReadRequest {
            host_token: handle.host_token,
            host: HostProvidedHost::WindowsPreviewHandler,
            generation_id: "generation-1".to_string(),
            offset_bytes: u64::MAX,
            max_bytes: 4,
        });
        assert_eq!(invalid_bounds, Err(HostProvidedError::InvalidRequest));
    }
}
