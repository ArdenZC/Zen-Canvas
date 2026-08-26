//! One process-local, bounded HostProvided capability implementation.
//!
//! The app and native host artifacts consume this crate so the lifecycle and
//! validation rules cannot drift into separate registries. The crate owns only
//! request-scoped immutable/capability sources; it has no paths, durable
//! identities, renderer IPC, provider selection or filesystem authority.

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

/// Host labels are intentionally data-only. Only the Windows Preview Handler
/// label is active for shell registration in this bounded spike.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum HostProvidedHost {
    ZenFloating,
    ZenPinned,
    MacQuickLookExtension,
    WindowsQuickPreview,
    WindowsPreviewHandler,
}

/// Bounded bytes returned by one request-owned source.
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

/// A source must be safe to retain and read from a worker. Shell-owned COM
/// streams deliberately do not implement this contract; they are captured and
/// released before registration with this registry.
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

/// Bounded process-local registry. Registry locks are never held while a
/// source executes; detached records are dropped after unlocking.
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
        state.records.insert(
            host_token.clone(),
            HostRecord {
                host: registration.host,
                generation_id: registration.generation_id,
                source: registration.source,
                expires_at,
                cancelled: Arc::new(AtomicBool::new(false)),
            },
        );
        Ok(HostProvidedHandle { host_token })
    }

    pub fn read(
        &self,
        request: &HostProvidedReadRequest,
    ) -> Result<BoundedContentRead, HostProvidedError> {
        if !valid_request(request, self.config.max_read_bytes) {
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

        // Revalidate after source work so revoke/expiry cannot publish the
        // result from a detached request.
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
        let detached =
            {
                let mut state = lock(&self.state);
                if state.records.get(host_token).is_some_and(|record| {
                    record.host == host && record.generation_id == generation_id
                }) {
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

    /// Test/harness observability. This does not expose request bytes or turn
    /// the registry into a durable authority.
    #[doc(hidden)]
    pub fn count(&self) -> usize {
        self.prune_expired();
        lock(&self.state).records.len()
    }

    #[doc(hidden)]
    pub fn state_lock_is_available_for_test(&self) -> bool {
        self.state.try_lock().is_ok()
    }

    #[doc(hidden)]
    pub fn force_expire_for_test(&self, host_token: &str) {
        let mut state = lock(&self.state);
        if let Some(record) = state.records.get_mut(host_token) {
            let now = Instant::now();
            record.expires_at = now.checked_sub(Duration::from_secs(1)).unwrap_or(now);
        }
    }

    fn prune_expired(&self) {
        let now = Instant::now();
        let detached = {
            let mut state = lock(&self.state);
            detach_records_where(&mut state, |record| record.expires_at <= now)
        };
        drop(detached);
    }
}

fn detach_records_where(
    state: &mut HostState,
    predicate: impl Fn(&HostRecord) -> bool,
) -> Vec<HostRecord> {
    let tokens = state
        .records
        .iter()
        .filter(|(_, record)| predicate(record))
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

fn valid_request(request: &HostProvidedReadRequest, max_read_bytes: u32) -> bool {
    valid_token(&request.host_token)
        && valid_token(&request.generation_id)
        && activated_shell_host(request.host)
        && request.max_bytes > 0
        && request.max_bytes <= max_read_bytes
        && request
            .offset_bytes
            .checked_add(u64::from(request.max_bytes))
            .is_some()
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
                complete: end >= self.bytes.len(),
            })
        }
    }

    fn request(handle: &HostProvidedHandle) -> HostProvidedReadRequest {
        HostProvidedReadRequest {
            host_token: handle.host_token.clone(),
            host: HostProvidedHost::WindowsPreviewHandler,
            generation_id: "generation".to_string(),
            offset_bytes: 0,
            max_bytes: 32,
        }
    }

    #[test]
    fn immutable_memory_source_is_bounded_and_revocable() {
        let registry = HostProvidedRegistry::new(HostProvidedConfig::default()).unwrap();
        let handle = registry
            .register(HostProvidedRegistration {
                host: HostProvidedHost::WindowsPreviewHandler,
                generation_id: "generation".to_string(),
                source: Arc::new(MemorySource {
                    bytes: b"bounded".to_vec(),
                }),
            })
            .unwrap();
        assert_eq!(registry.read(&request(&handle)).unwrap().bytes, b"bounded");
        assert!(registry.revoke(
            &handle.host_token,
            HostProvidedHost::WindowsPreviewHandler,
            "generation"
        ));
        assert_eq!(registry.count(), 0);
        assert_eq!(
            registry.read(&request(&handle)),
            Err(HostProvidedError::InvalidOrStale)
        );
    }

    #[test]
    fn configured_read_bound_is_independent_from_source_completeness() {
        let registry = HostProvidedRegistry::new(HostProvidedConfig {
            max_records: 1,
            max_read_bytes: 1024 * 1024,
            ttl: Duration::from_secs(5),
        })
        .unwrap();
        let handle = registry
            .register(HostProvidedRegistration {
                host: HostProvidedHost::WindowsPreviewHandler,
                generation_id: "generation".to_string(),
                source: Arc::new(MemorySource {
                    bytes: vec![b'x'; 1024 * 1024 + 1],
                }),
            })
            .unwrap();
        let mut request = request(&handle);
        request.max_bytes = 1024 * 1024;
        let read = registry.read(&request).unwrap();
        assert_eq!(read.bytes.len(), 1024 * 1024);
        assert!(!read.complete);

        request.max_bytes = 1024 * 1024 + 1;
        assert_eq!(
            registry.read(&request),
            Err(HostProvidedError::InvalidRequest)
        );
    }
}
