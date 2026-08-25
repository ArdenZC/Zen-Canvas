use super::*;
use std::{
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc, Barrier,
    },
    thread,
    time::{Duration, Instant},
};

struct MemorySource {
    bytes: Vec<u8>,
    drops: Arc<AtomicUsize>,
}

impl Drop for MemorySource {
    fn drop(&mut self) {
        self.drops.fetch_add(1, Ordering::AcqRel);
    }
}

impl HostProvidedReadSource for MemorySource {
    fn read_bounded(
        &self,
        offset_bytes: u64,
        max_bytes: u32,
        _context: &HostProvidedReadContext,
    ) -> Result<BoundedContentRead, HostProvidedSourceError> {
        let start = usize::try_from(offset_bytes).map_err(|_| HostProvidedSourceError::Failed)?;
        if start > self.bytes.len() {
            return Ok(BoundedContentRead {
                bytes: Vec::new(),
                complete: true,
            });
        }
        let end = start
            .saturating_add(max_bytes as usize)
            .min(self.bytes.len());
        Ok(BoundedContentRead {
            bytes: self.bytes[start..end].to_vec(),
            complete: end == self.bytes.len(),
        })
    }
}

fn registration(drops: Arc<AtomicUsize>) -> HostProvidedRegistration {
    HostProvidedRegistration {
        host: PreviewHostKind::WindowsPreviewHandler,
        generation_id: "generation-1".to_string(),
        source: Arc::new(MemorySource {
            bytes: b"shell stream bytes".to_vec(),
            drops,
        }),
    }
}

fn request(handle: &HostProvidedHandle, generation_id: &str) -> HostProvidedReadRequest {
    HostProvidedReadRequest {
        host_token: handle.host_token.clone(),
        host: PreviewHostKind::WindowsPreviewHandler,
        generation_id: generation_id.to_string(),
        offset_bytes: 0,
        max_bytes: 1024,
    }
}

fn wait_until(mut condition: impl FnMut() -> bool) {
    let deadline = Instant::now() + Duration::from_secs(2);
    while !condition() {
        assert!(Instant::now() < deadline, "condition did not settle");
        thread::yield_now();
    }
}

#[test]
fn shell_token_is_opaque_request_scoped_and_revocable() {
    let drops = Arc::new(AtomicUsize::new(0));
    let registry = HostProvidedRegistry::new(HostProvidedConfig::default()).unwrap();
    let handle = registry.register(registration(Arc::clone(&drops))).unwrap();
    assert!(!handle.host_token.contains("generation-1"));
    let read = registry.read(&request(&handle, "generation-1")).unwrap();
    assert_eq!(read.bytes, b"shell stream bytes");
    assert!(read.complete);
    assert!(registry.revoke(
        &handle.host_token,
        PreviewHostKind::WindowsPreviewHandler,
        "generation-1"
    ));
    assert_eq!(drops.load(Ordering::Acquire), 1);
    assert_eq!(
        registry.read(&request(&handle, "generation-1")),
        Err(HostProvidedError::InvalidOrStale)
    );
}

#[test]
fn wrong_generation_host_unknown_and_reused_tokens_fail_closed() {
    let drops = Arc::new(AtomicUsize::new(0));
    let registry = HostProvidedRegistry::new(HostProvidedConfig::default()).unwrap();
    let handle = registry.register(registration(Arc::clone(&drops))).unwrap();

    assert_eq!(
        registry.read(&HostProvidedReadRequest {
            host_token: handle.host_token.clone(),
            host: PreviewHostKind::WindowsPreviewHandler,
            generation_id: "generation-2".to_string(),
            offset_bytes: 0,
            max_bytes: 16,
        }),
        Err(HostProvidedError::InvalidOrStale)
    );
    assert_eq!(
        registry.read(&HostProvidedReadRequest {
            host_token: handle.host_token.clone(),
            host: PreviewHostKind::MacQuickLookExtension,
            generation_id: "generation-1".to_string(),
            offset_bytes: 0,
            max_bytes: 16,
        }),
        Err(HostProvidedError::InvalidRequest)
    );
    assert_eq!(
        registry.read(&HostProvidedReadRequest {
            host_token: "unknown-token".to_string(),
            host: PreviewHostKind::WindowsPreviewHandler,
            generation_id: "generation-1".to_string(),
            offset_bytes: 0,
            max_bytes: 16,
        }),
        Err(HostProvidedError::InvalidOrStale)
    );

    registry.revoke(
        &handle.host_token,
        PreviewHostKind::WindowsPreviewHandler,
        "generation-1",
    );
    assert_eq!(
        registry.read(&request(&handle, "generation-1")),
        Err(HostProvidedError::InvalidOrStale)
    );
}

#[test]
fn capacity_limit_is_enforced_and_released_by_revoke() {
    let drops = Arc::new(AtomicUsize::new(0));
    let registry = HostProvidedRegistry::new(HostProvidedConfig {
        max_records: 1,
        ..HostProvidedConfig::default()
    })
    .unwrap();
    let first = registry.register(registration(Arc::clone(&drops))).unwrap();
    assert_eq!(
        registry.register(registration(Arc::clone(&drops))),
        Err(HostProvidedError::CapacityExceeded)
    );
    assert!(registry.revoke(
        &first.host_token,
        PreviewHostKind::WindowsPreviewHandler,
        "generation-1"
    ));
    registry.register(registration(Arc::clone(&drops))).unwrap();
    assert_eq!(registry.count(), 1);
}

#[test]
fn normal_expiry_removes_record_and_releases_source() {
    let drops = Arc::new(AtomicUsize::new(0));
    let registry = HostProvidedRegistry::new(HostProvidedConfig {
        ttl: Duration::from_millis(1),
        ..HostProvidedConfig::default()
    })
    .unwrap();
    registry.register(registration(Arc::clone(&drops))).unwrap();
    wait_until(|| registry.count() == 0);
    assert_eq!(drops.load(Ordering::Acquire), 1);
}

struct BlockingSource {
    started: Arc<Barrier>,
    drops: Arc<AtomicUsize>,
    cancellation_seen: Arc<AtomicBool>,
}

impl Drop for BlockingSource {
    fn drop(&mut self) {
        self.drops.fetch_add(1, Ordering::AcqRel);
    }
}

impl HostProvidedReadSource for BlockingSource {
    fn read_bounded(
        &self,
        _offset_bytes: u64,
        _max_bytes: u32,
        context: &HostProvidedReadContext,
    ) -> Result<BoundedContentRead, HostProvidedSourceError> {
        self.started.wait();
        loop {
            if context.is_cancelled() {
                self.cancellation_seen.store(true, Ordering::Release);
                return Err(HostProvidedSourceError::Cancelled);
            }
            thread::yield_now();
        }
    }
}

fn blocking_registration(
    generation_id: &str,
    started: Arc<Barrier>,
    drops: Arc<AtomicUsize>,
    cancellation_seen: Arc<AtomicBool>,
) -> HostProvidedRegistration {
    HostProvidedRegistration {
        host: PreviewHostKind::WindowsPreviewHandler,
        generation_id: generation_id.to_string(),
        source: Arc::new(BlockingSource {
            started,
            drops,
            cancellation_seen,
        }),
    }
}

fn spawn_blocked_read(
    registry: &Arc<HostProvidedRegistry>,
    handle: HostProvidedHandle,
    generation_id: &str,
) -> thread::JoinHandle<Result<BoundedContentRead, HostProvidedError>> {
    let registry = Arc::clone(registry);
    let request = request(&handle, generation_id);
    thread::spawn(move || registry.read(&request))
}

#[test]
fn revoke_while_read_is_blocked_cancels_source_and_releases_arc_after_exit() {
    let drops = Arc::new(AtomicUsize::new(0));
    let started = Arc::new(Barrier::new(2));
    let cancellation_seen = Arc::new(AtomicBool::new(false));
    let registry = HostProvidedRegistry::new(HostProvidedConfig::default()).unwrap();
    let handle = registry
        .register(blocking_registration(
            "generation-1",
            Arc::clone(&started),
            Arc::clone(&drops),
            Arc::clone(&cancellation_seen),
        ))
        .unwrap();
    let read = spawn_blocked_read(&registry, handle.clone(), "generation-1");
    started.wait();
    assert!(registry.revoke(
        &handle.host_token,
        PreviewHostKind::WindowsPreviewHandler,
        "generation-1"
    ));
    assert_eq!(read.join().unwrap(), Err(HostProvidedError::Cancelled));
    assert!(cancellation_seen.load(Ordering::Acquire));
    assert_eq!(registry.count(), 0);
    assert_eq!(drops.load(Ordering::Acquire), 1);
}

#[test]
fn revoke_generation_while_read_is_blocked_cancels_source() {
    let drops = Arc::new(AtomicUsize::new(0));
    let started = Arc::new(Barrier::new(2));
    let cancellation_seen = Arc::new(AtomicBool::new(false));
    let registry = HostProvidedRegistry::new(HostProvidedConfig::default()).unwrap();
    let handle = registry
        .register(blocking_registration(
            "generation-1",
            Arc::clone(&started),
            Arc::clone(&drops),
            Arc::clone(&cancellation_seen),
        ))
        .unwrap();
    let read = spawn_blocked_read(&registry, handle, "generation-1");
    started.wait();
    assert_eq!(
        registry.revoke_generation(PreviewHostKind::WindowsPreviewHandler, "generation-1"),
        1
    );
    assert_eq!(read.join().unwrap(), Err(HostProvidedError::Cancelled));
    assert!(cancellation_seen.load(Ordering::Acquire));
    assert_eq!(drops.load(Ordering::Acquire), 1);
}

#[test]
fn dispose_while_read_is_blocked_cancels_source_and_drops_record() {
    let drops = Arc::new(AtomicUsize::new(0));
    let started = Arc::new(Barrier::new(2));
    let cancellation_seen = Arc::new(AtomicBool::new(false));
    let registry = HostProvidedRegistry::new(HostProvidedConfig::default()).unwrap();
    let handle = registry
        .register(blocking_registration(
            "generation-1",
            Arc::clone(&started),
            Arc::clone(&drops),
            Arc::clone(&cancellation_seen),
        ))
        .unwrap();
    let read = spawn_blocked_read(&registry, handle, "generation-1");
    started.wait();
    registry.dispose();
    assert!(matches!(
        read.join().unwrap(),
        Err(HostProvidedError::Disposed | HostProvidedError::Cancelled)
    ));
    assert!(cancellation_seen.load(Ordering::Acquire));
    assert_eq!(registry.count(), 0);
    assert_eq!(drops.load(Ordering::Acquire), 1);
}

struct ReleaseAfterExpirySource {
    started: Arc<Barrier>,
    release: Arc<Barrier>,
    drops: Arc<AtomicUsize>,
}

impl Drop for ReleaseAfterExpirySource {
    fn drop(&mut self) {
        self.drops.fetch_add(1, Ordering::AcqRel);
    }
}

impl HostProvidedReadSource for ReleaseAfterExpirySource {
    fn read_bounded(
        &self,
        _offset_bytes: u64,
        _max_bytes: u32,
        _context: &HostProvidedReadContext,
    ) -> Result<BoundedContentRead, HostProvidedSourceError> {
        self.started.wait();
        self.release.wait();
        Ok(BoundedContentRead {
            bytes: b"late shell bytes".to_vec(),
            complete: true,
        })
    }
}

#[test]
fn ttl_expiring_while_read_is_blocked_rejects_late_bytes() {
    let drops = Arc::new(AtomicUsize::new(0));
    let started = Arc::new(Barrier::new(2));
    let release = Arc::new(Barrier::new(2));
    let registry = HostProvidedRegistry::new(HostProvidedConfig {
        ttl: Duration::from_millis(1),
        ..HostProvidedConfig::default()
    })
    .unwrap();
    let handle = registry
        .register(HostProvidedRegistration {
            host: PreviewHostKind::WindowsPreviewHandler,
            generation_id: "generation-1".to_string(),
            source: Arc::new(ReleaseAfterExpirySource {
                started: Arc::clone(&started),
                release: Arc::clone(&release),
                drops: Arc::clone(&drops),
            }),
        })
        .unwrap();
    let read = {
        let registry = Arc::clone(&registry);
        let request = request(&handle, "generation-1");
        thread::spawn(move || registry.read(&request))
    };
    started.wait();
    let expiry_deadline = Instant::now() + Duration::from_millis(10);
    while Instant::now() < expiry_deadline {
        thread::yield_now();
    }
    release.wait();
    assert_eq!(read.join().unwrap(), Err(HostProvidedError::Cancelled));
    assert_eq!(drops.load(Ordering::Acquire), 1);
}

#[test]
fn unactivated_shell_hosts_fail_closed() {
    let drops = Arc::new(AtomicUsize::new(0));
    let registry = HostProvidedRegistry::new(HostProvidedConfig::default()).unwrap();
    let mut request = registration(Arc::clone(&drops));
    request.host = PreviewHostKind::MacQuickLookExtension;
    assert!(matches!(
        registry.register(request),
        Err(HostProvidedError::UnsupportedHost)
    ));
    assert_eq!(drops.load(Ordering::Acquire), 1);
    assert_eq!(registry.count(), 0);
}
