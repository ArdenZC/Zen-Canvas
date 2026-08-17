//! Behavior-oriented thumbnail tests.

use super::super::{
    contracts::{ContentReadLeaseRef, EntryRef, PreviewSourceRef, WorkClass},
    preview::{BoundedContentRead, BoundedContentReadRequest, ContentReadAccessError},
    read_gate::ReadGateError,
};
use super::{lock, read::*, renderer::*, service::*, types::*};
use crate::scheduler::{ResourceHints, WorkRequest, WorkScheduler};
use std::{
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};

struct FakeGate {
    version: Arc<Mutex<String>>,
    error: Arc<Mutex<Option<ReadGateError>>>,
    reads: Arc<AtomicUsize>,
    leases: Arc<AtomicUsize>,
}

impl FakeGate {
    fn new(version: &str) -> Self {
        Self {
            version: Arc::new(Mutex::new(version.to_string())),
            error: Arc::new(Mutex::new(None)),
            reads: Arc::new(AtomicUsize::new(0)),
            leases: Arc::new(AtomicUsize::new(0)),
        }
    }

    fn set_error(&self, error: Option<ReadGateError>) {
        *lock(&self.error) = error;
    }
}

impl ThumbnailReadGate for FakeGate {
    fn current_source_version(&self, _source: &PreviewSourceRef) -> Result<String, ReadGateError> {
        if let Some(error) = *lock(&self.error) {
            return Err(error);
        }
        Ok(lock(&self.version).clone())
    }

    fn issue_thumbnail_lease(
        &self,
        request_id: &str,
        _source: PreviewSourceRef,
    ) -> Result<ContentReadLeaseRef, ReadGateError> {
        if let Some(error) = *lock(&self.error) {
            return Err(error);
        }
        self.leases.fetch_add(1, Ordering::SeqCst);
        Ok(ContentReadLeaseRef {
            lease_id: format!("lease-{request_id}"),
            request_id: request_id.to_string(),
            source_version: lock(&self.version).clone(),
        })
    }

    fn read_bounded(
        &self,
        _lease: &ContentReadLeaseRef,
        request: BoundedContentReadRequest,
        operation: ThumbnailReadOperation<'_>,
    ) -> Result<BoundedContentRead, ContentReadAccessError> {
        if operation.cancellation.is_cancelled() {
            return Err(ContentReadAccessError::Cancelled);
        }
        if Instant::now() >= operation.deadline {
            return Err(ContentReadAccessError::TimedOut);
        }
        self.reads.fetch_add(1, Ordering::SeqCst);
        let content = b"thumbnail-source";
        let offset = usize::try_from(request.offset_bytes).unwrap_or(usize::MAX);
        if offset >= content.len() {
            return Ok(BoundedContentRead {
                bytes: Vec::new(),
                complete: true,
            });
        }
        let end = (offset + request.max_bytes as usize).min(content.len());
        Ok(BoundedContentRead {
            bytes: content[offset..end].to_vec(),
            complete: end == content.len(),
        })
    }

    fn release_lease(&self, _lease: &ContentReadLeaseRef) -> Result<(), ReadGateError> {
        self.leases.fetch_sub(1, Ordering::SeqCst);
        Ok(())
    }

    fn source_file_name(&self, _source: &PreviewSourceRef) -> Option<String> {
        Some("fixture.png".to_string())
    }
}

struct FakeRenderer {
    descriptor: ThumbnailRendererDescriptor,
    renders: Arc<AtomicUsize>,
    render_order: Arc<Mutex<Vec<String>>>,
    read: bool,
    wait: Option<Arc<(Mutex<bool>, std::sync::Condvar)>>,
    entered: Option<Arc<AtomicBool>>,
}

impl FakeRenderer {
    fn new(read: bool) -> Self {
        Self {
            descriptor: ThumbnailRendererDescriptor::new(
                "test.renderer",
                "1",
                ResourceHints {
                    cpu: 1,
                    io: 1,
                    open_handles: 1,
                    decoder: 1,
                    native_preview: 1,
                    ..ResourceHints::empty()
                },
            ),
            renders: Arc::new(AtomicUsize::new(0)),
            render_order: Arc::new(Mutex::new(Vec::new())),
            read,
            wait: None,
            entered: None,
        }
    }

    fn with_version(mut self, version: &str) -> Self {
        self.descriptor.version = version.to_string();
        self
    }
}

impl ThumbnailRenderer for FakeRenderer {
    fn descriptor(&self) -> ThumbnailRendererDescriptor {
        self.descriptor.clone()
    }

    fn render(
        &self,
        request: ThumbnailRenderRequest,
        context: &ThumbnailRenderContext,
    ) -> Result<ThumbnailRenderOutput, ThumbnailRendererError> {
        self.renders.fetch_add(1, Ordering::SeqCst);
        if let PreviewSourceRef::Managed { file_id } = request.source {
            lock(&self.render_order).push(file_id);
        }
        if let Some(entered) = self.entered.as_ref() {
            entered.store(true, Ordering::Release);
        }
        if let Some(wait) = self.wait.as_ref() {
            let (ready, signal) = &**wait;
            let mut ready = lock(ready);
            while !*ready && !context.is_cancelled() {
                ready = signal
                    .wait_timeout(ready, Duration::from_millis(10))
                    .map_err(|_| ThumbnailRendererError::Failed)?
                    .0;
            }
        }
        if self.read {
            let _ = context.read_bounded(0, 64)?;
        }
        context.ensure_active()?;
        Ok(ThumbnailRenderOutput {
            bytes: b"png".to_vec(),
        })
    }
}

fn scheduler() -> Arc<WorkScheduler> {
    scheduler_with_capacities(crate::scheduler::ResourceCapacities::new(2, 2, 4, 2, 2, 1))
}

fn scheduler_with_capacities(
    capacities: crate::scheduler::ResourceCapacities,
) -> Arc<WorkScheduler> {
    Arc::new(WorkScheduler::new(
        crate::scheduler::SchedulerConfig::default()
            .with_capacities(capacities)
            .with_policy(Arc::new(crate::scheduler::PermissiveResourcePolicy)),
    ))
}

fn source(id: &str) -> EntryRef {
    EntryRef::Managed {
        file_id: id.to_string(),
    }
}

fn release_wait(wait: &Arc<(Mutex<bool>, std::sync::Condvar)>) {
    let (ready, signal) = &**wait;
    *lock(ready) = true;
    signal.notify_all();
}

fn wait_until(flag: &AtomicBool) {
    for _ in 0..10_000 {
        if flag.load(Ordering::Acquire) {
            return;
        }
        thread::yield_now();
    }
    panic!("thumbnail worker did not reach expected state");
}

fn service<G, R>(
    gate: Arc<G>,
    renderer: Arc<R>,
    cache_dir: Option<PathBuf>,
    config: ThumbnailServiceConfig,
) -> ThumbnailService
where
    G: ThumbnailReadGate + 'static,
    R: ThumbnailRenderer + 'static,
{
    ThumbnailService::new(gate, scheduler(), renderer, cache_dir, config)
        .expect("valid thumbnail service")
}

fn service_with_scheduler<G, R>(
    gate: Arc<G>,
    scheduler: Arc<WorkScheduler>,
    renderer: Arc<R>,
    cache_dir: Option<PathBuf>,
    config: ThumbnailServiceConfig,
) -> ThumbnailService
where
    G: ThumbnailReadGate + 'static,
    R: ThumbnailRenderer + 'static,
{
    ThumbnailService::new(gate, scheduler, renderer, cache_dir, config)
        .expect("valid thumbnail service")
}

mod cache;
mod contract;
mod lifecycle;
mod platform;
mod read_gate;
mod scheduler;
