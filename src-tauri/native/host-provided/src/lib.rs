//! Process-local request-scoped host input for native Preview adapters.
//!
//! This crate deliberately owns no filesystem paths, managed identities,
//! renderer IPC, provider selection, or durable state. It is shared by the
//! main application and the Windows Preview Handler DLL so both sides use one
//! bounded capability implementation instead of growing parallel registries.

use std::{
    cell::RefCell,
    collections::HashMap,
    rc::Rc,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
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

/// Narrow request-owned shell source. The source is never exposed to generic
/// Preview renderer IPC. It intentionally carries no `Send`/`Sync` promise:
/// COM apartment-affine sources use the thread-local registry below.
pub trait HostProvidedReadSource {
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

/// Registration for the main application's cross-thread-safe host sources.
#[derive(Clone)]
pub struct HostProvidedRegistration {
    pub host: HostProvidedHost,
    pub generation_id: String,
    pub source: Arc<dyn HostProvidedReadSource + Send + Sync>,
}

/// Registration for a source that must remain in one COM apartment/thread.
/// `Rc` is deliberate: this value cannot be moved into a worker thread or a
/// process-wide synchronized registry by construction.
#[derive(Clone)]
pub struct HostProvidedThreadRegistration {
    pub host: HostProvidedHost,
    pub generation_id: String,
    pub source: Rc<dyn HostProvidedReadSource>,
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

trait SourceHandle: Clone {
    fn read_bounded(
        &self,
        offset_bytes: u64,
        max_bytes: u32,
        context: &HostProvidedReadContext,
    ) -> Result<BoundedContentRead, HostProvidedSourceError>;
}

impl SourceHandle for Arc<dyn HostProvidedReadSource + Send + Sync> {
    fn read_bounded(
        &self,
        offset_bytes: u64,
        max_bytes: u32,
        context: &HostProvidedReadContext,
    ) -> Result<BoundedContentRead, HostProvidedSourceError> {
        (**self).read_bounded(offset_bytes, max_bytes, context)
    }
}

impl SourceHandle for Rc<dyn HostProvidedReadSource> {
    fn read_bounded(
        &self,
        offset_bytes: u64,
        max_bytes: u32,
        context: &HostProvidedReadContext,
    ) -> Result<BoundedContentRead, HostProvidedSourceError> {
        (**self).read_bounded(offset_bytes, max_bytes, context)
    }
}

struct HostRecord<S> {
    host: HostProvidedHost,
    generation_id: String,
    source: S,
    expires_at: Instant,
    cancelled: Arc<AtomicBool>,
}

struct HostCore<S> {
    config: HostProvidedConfig,
    records: HashMap<String, HostRecord<S>>,
    disposed: bool,
}

impl<S> HostCore<S> {
    fn new(config: HostProvidedConfig) -> Self {
        Self {
            config,
            records: HashMap::new(),
            disposed: false,
        }
    }
}

struct RegisterOutcome<S> {
    result: Result<HostProvidedHandle, HostProvidedError>,
    detached: Vec<HostRecord<S>>,
    rejected_source: Option<S>,
}

struct ReadLease<S> {
    source: S,
    context: HostProvidedReadContext,
}

struct ReadOutcome<S> {
    result: Result<BoundedContentRead, HostProvidedError>,
    detached: Vec<HostRecord<S>>,
}

impl<S: SourceHandle> HostCore<S> {
    fn register(
        &mut self,
        host: HostProvidedHost,
        generation_id: String,
        source: S,
    ) -> RegisterOutcome<S> {
        let mut detached = Vec::new();
        let invalid = !valid_token(&generation_id);
        let unsupported = !activated_shell_host(host);
        if invalid || unsupported {
            return RegisterOutcome {
                result: Err(if invalid {
                    HostProvidedError::InvalidRequest
                } else {
                    HostProvidedError::UnsupportedHost
                }),
                detached,
                rejected_source: Some(source),
            };
        }

        detached = self.prune_expired();
        if self.disposed {
            return RegisterOutcome {
                result: Err(HostProvidedError::Disposed),
                detached,
                rejected_source: Some(source),
            };
        }
        if self.records.len() >= self.config.max_records {
            return RegisterOutcome {
                result: Err(HostProvidedError::CapacityExceeded),
                detached,
                rejected_source: Some(source),
            };
        }
        let host_token = Uuid::new_v4().to_string();
        let Some(expires_at) = Instant::now().checked_add(self.config.ttl) else {
            return RegisterOutcome {
                result: Err(HostProvidedError::InvalidRequest),
                detached,
                rejected_source: Some(source),
            };
        };
        let cancelled = Arc::new(AtomicBool::new(false));
        self.records.insert(
            host_token.clone(),
            HostRecord {
                host,
                generation_id,
                source,
                expires_at,
                cancelled,
            },
        );
        RegisterOutcome {
            result: Ok(HostProvidedHandle { host_token }),
            detached,
            rejected_source: None,
        }
    }

    fn begin_read(
        &mut self,
        request: &HostProvidedReadRequest,
    ) -> (Result<ReadLease<S>, HostProvidedError>, Vec<HostRecord<S>>) {
        if !valid_request(request, self.config.max_read_bytes) {
            return (Err(HostProvidedError::InvalidRequest), Vec::new());
        }
        let detached = self.prune_expired();
        if self.disposed {
            return (Err(HostProvidedError::Disposed), detached);
        }
        let Some(record) = self.records.get(&request.host_token) else {
            return (Err(HostProvidedError::InvalidOrStale), detached);
        };
        if record.host != request.host || record.generation_id != request.generation_id {
            return (Err(HostProvidedError::InvalidOrStale), detached);
        }
        (
            Ok(ReadLease {
                source: record.source.clone(),
                context: HostProvidedReadContext {
                    cancelled: Arc::clone(&record.cancelled),
                },
            }),
            detached,
        )
    }

    fn finish_read(
        &mut self,
        request: &HostProvidedReadRequest,
        context: &HostProvidedReadContext,
        read: BoundedContentRead,
    ) -> ReadOutcome<S> {
        if read.bytes.len() > request.max_bytes as usize {
            return ReadOutcome {
                result: Err(HostProvidedError::Failed),
                detached: Vec::new(),
            };
        }
        if self.disposed {
            return ReadOutcome {
                result: Err(HostProvidedError::Disposed),
                detached: Vec::new(),
            };
        }
        if context.is_cancelled() {
            return ReadOutcome {
                result: Err(HostProvidedError::Cancelled),
                detached: Vec::new(),
            };
        }
        let Some(record) = self.records.get(&request.host_token) else {
            return ReadOutcome {
                result: Err(HostProvidedError::InvalidOrStale),
                detached: Vec::new(),
            };
        };
        if record.host != request.host || record.generation_id != request.generation_id {
            return ReadOutcome {
                result: Err(HostProvidedError::InvalidOrStale),
                detached: Vec::new(),
            };
        }
        if Instant::now() >= record.expires_at {
            let detached = self
                .records
                .remove(&request.host_token)
                .map(|record| {
                    record.cancelled.store(true, Ordering::Release);
                    vec![record]
                })
                .unwrap_or_default();
            return ReadOutcome {
                result: Err(HostProvidedError::Cancelled),
                detached,
            };
        }
        ReadOutcome {
            result: Ok(read),
            detached: Vec::new(),
        }
    }

    fn revoke(
        &mut self,
        host_token: &str,
        host: HostProvidedHost,
        generation_id: &str,
    ) -> (bool, Vec<HostRecord<S>>) {
        let detached = if self
            .records
            .get(host_token)
            .is_some_and(|record| record.host == host && record.generation_id == generation_id)
        {
            self.records
                .remove(host_token)
                .map(|record| {
                    record.cancelled.store(true, Ordering::Release);
                    vec![record]
                })
                .unwrap_or_default()
        } else {
            Vec::new()
        };
        (!detached.is_empty(), detached)
    }

    fn revoke_generation(
        &mut self,
        host: HostProvidedHost,
        generation_id: &str,
    ) -> Vec<HostRecord<S>> {
        detach_records_where(&mut self.records, |record| {
            record.host == host && record.generation_id == generation_id
        })
    }

    fn dispose(&mut self) -> Vec<HostRecord<S>> {
        if self.disposed {
            return Vec::new();
        }
        self.disposed = true;
        self.records
            .drain()
            .map(|(_, record)| {
                record.cancelled.store(true, Ordering::Release);
                record
            })
            .collect()
    }

    fn prune_expired(&mut self) -> Vec<HostRecord<S>> {
        let now = Instant::now();
        detach_records_where(&mut self.records, |record| record.expires_at <= now)
    }

    #[cfg(any(test, feature = "test-observability"))]
    fn force_expire(&mut self, host_token: &str) {
        if let Some(record) = self.records.get_mut(host_token) {
            let now = Instant::now();
            record.expires_at = now.checked_sub(Duration::from_secs(1)).unwrap_or(now);
        }
    }
}

fn detach_records_where<S>(
    records: &mut HashMap<String, HostRecord<S>>,
    predicate: impl Fn(&HostRecord<S>) -> bool,
) -> Vec<HostRecord<S>> {
    let tokens = records
        .iter()
        .filter(|(_, record)| predicate(record))
        .map(|(token, _)| token.clone())
        .collect::<Vec<_>>();
    let mut detached = Vec::with_capacity(tokens.len());
    for token in tokens {
        if let Some(record) = records.remove(&token) {
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

/// One process-local registry for request-scoped, cross-thread-safe host
/// capabilities used by the main application.
pub struct HostProvidedRegistry {
    state: Mutex<HostCore<Arc<dyn HostProvidedReadSource + Send + Sync>>>,
}

impl HostProvidedRegistry {
    pub fn new(config: HostProvidedConfig) -> Result<Arc<Self>, HostProvidedError> {
        Ok(Arc::new(Self {
            state: Mutex::new(HostCore::new(config.validate()?)),
        }))
    }

    pub fn register(
        &self,
        registration: HostProvidedRegistration,
    ) -> Result<HostProvidedHandle, HostProvidedError> {
        let outcome = {
            let mut state = lock(&self.state);
            state.register(
                registration.host,
                registration.generation_id,
                registration.source,
            )
        };
        let RegisterOutcome {
            result,
            detached,
            rejected_source,
        } = outcome;
        drop(detached);
        drop(rejected_source);
        result
    }

    pub fn read(
        &self,
        request: &HostProvidedReadRequest,
    ) -> Result<BoundedContentRead, HostProvidedError> {
        let begin = {
            let mut state = lock(&self.state);
            state.begin_read(request)
        };
        let (lease_result, detached) = begin;
        drop(detached);
        let lease = lease_result?;
        let ReadLease { source, context } = lease;
        let read = source
            .read_bounded(request.offset_bytes, request.max_bytes, &context)
            .map_err(map_source_error)?;
        let outcome = {
            let mut state = lock(&self.state);
            state.finish_read(request, &context, read)
        };
        drop(outcome.detached);
        outcome.result
    }

    pub fn revoke(&self, host_token: &str, host: HostProvidedHost, generation_id: &str) -> bool {
        let (removed, detached) = {
            let mut state = lock(&self.state);
            state.revoke(host_token, host, generation_id)
        };
        drop(detached);
        removed
    }

    pub fn revoke_generation(&self, host: HostProvidedHost, generation_id: &str) -> usize {
        let detached = {
            let mut state = lock(&self.state);
            state.revoke_generation(host, generation_id)
        };
        let removed = detached.len();
        drop(detached);
        removed
    }

    pub fn dispose(&self) {
        let detached = {
            let mut state = lock(&self.state);
            state.dispose()
        };
        drop(detached);
    }

    #[cfg(any(test, feature = "test-observability"))]
    #[doc(hidden)]
    pub fn state_lock_is_available_for_test(&self) -> bool {
        self.state.try_lock().is_ok()
    }

    #[cfg(any(test, feature = "test-observability"))]
    #[doc(hidden)]
    pub fn force_expire_for_test(&self, host_token: &str) {
        let mut state = lock(&self.state);
        state.force_expire(host_token);
    }

    #[cfg(any(test, feature = "test-observability"))]
    #[doc(hidden)]
    pub fn count(&self) -> usize {
        let detached = {
            let mut state = lock(&self.state);
            let detached = state.prune_expired();
            (state.records.len(), detached)
        };
        let (count, detached) = detached;
        drop(detached);
        count
    }
}

/// One thread/apartment-affine registry. It intentionally uses `Rc` and
/// `RefCell` so an `IStream` source cannot be sent across COM apartments or
/// hidden behind an unsafe synchronization claim.
pub struct HostProvidedThreadLocalRegistry {
    state: RefCell<HostCore<Rc<dyn HostProvidedReadSource>>>,
}

impl HostProvidedThreadLocalRegistry {
    pub fn new(config: HostProvidedConfig) -> Result<Rc<Self>, HostProvidedError> {
        Ok(Rc::new(Self {
            state: RefCell::new(HostCore::new(config.validate()?)),
        }))
    }

    pub fn register(
        &self,
        registration: HostProvidedThreadRegistration,
    ) -> Result<HostProvidedHandle, HostProvidedError> {
        let outcome = {
            let mut state = self.state.borrow_mut();
            state.register(
                registration.host,
                registration.generation_id,
                registration.source,
            )
        };
        let RegisterOutcome {
            result,
            detached,
            rejected_source,
        } = outcome;
        drop(detached);
        drop(rejected_source);
        result
    }

    pub fn read(
        &self,
        request: &HostProvidedReadRequest,
    ) -> Result<BoundedContentRead, HostProvidedError> {
        let begin = {
            let mut state = self.state.borrow_mut();
            state.begin_read(request)
        };
        let (lease_result, detached) = begin;
        drop(detached);
        let lease = lease_result?;
        let ReadLease { source, context } = lease;
        let read = source
            .read_bounded(request.offset_bytes, request.max_bytes, &context)
            .map_err(map_source_error)?;
        let outcome = {
            let mut state = self.state.borrow_mut();
            state.finish_read(request, &context, read)
        };
        drop(outcome.detached);
        outcome.result
    }

    pub fn revoke(&self, host_token: &str, host: HostProvidedHost, generation_id: &str) -> bool {
        let (removed, detached) = {
            let mut state = self.state.borrow_mut();
            state.revoke(host_token, host, generation_id)
        };
        drop(detached);
        removed
    }

    pub fn revoke_generation(&self, host: HostProvidedHost, generation_id: &str) -> usize {
        let detached = {
            let mut state = self.state.borrow_mut();
            state.revoke_generation(host, generation_id)
        };
        let removed = detached.len();
        drop(detached);
        removed
    }

    pub fn dispose(&self) {
        let detached = {
            let mut state = self.state.borrow_mut();
            state.dispose()
        };
        drop(detached);
    }

    #[cfg(any(test, feature = "test-observability"))]
    #[doc(hidden)]
    pub fn state_lock_is_available_for_test(&self) -> bool {
        self.state.try_borrow_mut().is_ok()
    }

    #[cfg(any(test, feature = "test-observability"))]
    #[doc(hidden)]
    pub fn force_expire_for_test(&self, host_token: &str) {
        let mut state = self.state.borrow_mut();
        state.force_expire(host_token);
    }

    #[cfg(any(test, feature = "test-observability"))]
    #[doc(hidden)]
    pub fn count(&self) -> usize {
        let (count, detached) = {
            let mut state = self.state.borrow_mut();
            let detached = state.prune_expired();
            (state.records.len(), detached)
        };
        drop(detached);
        count
    }
}

fn lock<T>(value: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
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

    #[test]
    fn forced_expiry_prunes_the_record_and_fails_closed() {
        let registry = HostProvidedRegistry::new(HostProvidedConfig::default()).unwrap();
        let handle = registry.register(registration()).unwrap();
        registry.force_expire_for_test(&handle.host_token);
        assert_eq!(registry.count(), 0);
        assert_eq!(
            registry.read(&HostProvidedReadRequest {
                host_token: handle.host_token,
                host: HostProvidedHost::WindowsPreviewHandler,
                generation_id: "generation-1".to_string(),
                offset_bytes: 0,
                max_bytes: 4,
            }),
            Err(HostProvidedError::InvalidOrStale)
        );
    }

    struct LocalSource {
        bytes: Rc<Vec<u8>>,
    }

    impl HostProvidedReadSource for LocalSource {
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

    #[test]
    fn apartment_registry_accepts_non_send_source_without_promoting_it() {
        let registry = HostProvidedThreadLocalRegistry::new(HostProvidedConfig::default()).unwrap();
        let handle = registry
            .register(HostProvidedThreadRegistration {
                host: HostProvidedHost::WindowsPreviewHandler,
                generation_id: "local-generation".to_string(),
                source: Rc::new(LocalSource {
                    bytes: Rc::new(b"apartment bytes".to_vec()),
                }),
            })
            .unwrap();
        let read = registry
            .read(&HostProvidedReadRequest {
                host_token: handle.host_token,
                host: HostProvidedHost::WindowsPreviewHandler,
                generation_id: "local-generation".to_string(),
                offset_bytes: 0,
                max_bytes: 9,
            })
            .unwrap();
        assert_eq!(read.bytes, b"apartment");
    }
}
