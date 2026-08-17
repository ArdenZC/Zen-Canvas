//! W1-07 Read Gate adaptation and bounded renderer read context.

use super::super::{
    contracts::{ContentReadLeaseRef, PreviewSourceRef},
    preview::{
        BoundedContentRead, BoundedContentReadRequest, ContentReadAccessError,
        ContentReadLeaseConsumer, PreviewCancellation, PreviewOperationContext,
    },
    read_gate::{MaterializationReadGate, ReadGateError},
};
use super::types::{ThumbnailRendererError, READ_CHUNK_BYTES};
use crate::scheduler::CancellationToken;
use std::{
    sync::{atomic::Ordering, Arc},
    time::{Duration, Instant},
};

pub trait ThumbnailReadGate: Send + Sync {
    fn current_source_version(&self, source: &PreviewSourceRef) -> Result<String, ReadGateError>;

    fn issue_thumbnail_lease(
        &self,
        request_id: &str,
        source: PreviewSourceRef,
    ) -> Result<ContentReadLeaseRef, ReadGateError>;

    fn read_bounded(
        &self,
        lease: &ContentReadLeaseRef,
        request: BoundedContentReadRequest,
        operation: ThumbnailReadOperation<'_>,
    ) -> Result<BoundedContentRead, ContentReadAccessError>;

    fn release_lease(&self, lease: &ContentReadLeaseRef) -> Result<(), ReadGateError>;

    /// A backend-derived leaf name is a display/extension hint only.  It is
    /// never used as source authorization.
    fn source_file_name(&self, _source: &PreviewSourceRef) -> Option<String> {
        None
    }
}

pub struct ThumbnailReadOperation<'a> {
    pub request_id: &'a str,
    pub session_id: Option<&'a str>,
    pub source_version: &'a str,
    pub cancellation: &'a PreviewCancellation,
    pub deadline: Instant,
}

impl ThumbnailReadGate for MaterializationReadGate {
    fn current_source_version(&self, source: &PreviewSourceRef) -> Result<String, ReadGateError> {
        MaterializationReadGate::current_source_version(self, source)
    }

    fn issue_thumbnail_lease(
        &self,
        request_id: &str,
        source: PreviewSourceRef,
    ) -> Result<ContentReadLeaseRef, ReadGateError> {
        self.issue_lease_for_current(
            request_id,
            source,
            super::super::read_gate::ReadIntent::Thumbnail,
        )
    }

    fn read_bounded(
        &self,
        lease: &ContentReadLeaseRef,
        request: BoundedContentReadRequest,
        operation: ThumbnailReadOperation<'_>,
    ) -> Result<BoundedContentRead, ContentReadAccessError> {
        let operation = PreviewOperationContext::for_backend_content_read(
            operation.session_id.unwrap_or(operation.request_id),
            operation.request_id,
            operation.source_version,
            operation.cancellation.clone(),
            operation.deadline,
        );
        ContentReadLeaseConsumer::read_bounded(self, lease, request, &operation)
    }

    fn release_lease(&self, lease: &ContentReadLeaseRef) -> Result<(), ReadGateError> {
        MaterializationReadGate::release_lease(self, lease)
    }

    fn source_file_name(&self, source: &PreviewSourceRef) -> Option<String> {
        MaterializationReadGate::source_file_name(self, source)
    }
}

/// Context passed to one renderer invocation.  All reads are bounded and
/// revalidated by the injected W1-07 gate.
pub struct ThumbnailRenderContext {
    gate: Arc<dyn ThumbnailReadGate>,
    lease: ContentReadLeaseRef,
    request_id: String,
    session_id: Option<String>,
    source: PreviewSourceRef,
    source_version: String,
    cache_key: String,
    source_name: Option<String>,
    max_source_bytes: u64,
    remaining_source_budget: std::sync::atomic::AtomicU64,
    scheduler_cancellation: CancellationToken,
    cancellation: PreviewCancellation,
    deadline: Instant,
}

pub(super) struct ThumbnailRenderContextInit {
    pub(super) gate: Arc<dyn ThumbnailReadGate>,
    pub(super) lease: ContentReadLeaseRef,
    pub(super) request_id: String,
    pub(super) session_id: Option<String>,
    pub(super) source: PreviewSourceRef,
    pub(super) source_version: String,
    pub(super) cache_key: String,
    pub(super) source_name: Option<String>,
    pub(super) max_source_bytes: u64,
    pub(super) scheduler_cancellation: CancellationToken,
    pub(super) cancellation: PreviewCancellation,
    pub(super) deadline: Instant,
}

impl ThumbnailRenderContext {
    pub(super) fn new(init: ThumbnailRenderContextInit) -> Self {
        Self {
            remaining_source_budget: std::sync::atomic::AtomicU64::new(init.max_source_bytes),
            gate: init.gate,
            lease: init.lease,
            request_id: init.request_id,
            session_id: init.session_id,
            source: init.source,
            source_version: init.source_version,
            cache_key: init.cache_key,
            source_name: init.source_name,
            max_source_bytes: init.max_source_bytes,
            scheduler_cancellation: init.scheduler_cancellation,
            cancellation: init.cancellation,
            deadline: init.deadline,
        }
    }

    pub fn read_bounded(
        &self,
        offset_bytes: u64,
        max_bytes: u32,
    ) -> Result<BoundedContentRead, ThumbnailRendererError> {
        self.ensure_active()?;
        if max_bytes == 0 {
            return Err(ThumbnailRendererError::Failed);
        }
        let requested_bytes = u64::from(max_bytes);
        let mut remaining = self.remaining_source_budget.load(Ordering::Acquire);
        loop {
            if requested_bytes > remaining {
                return Err(ThumbnailRendererError::Failed);
            }
            match self.remaining_source_budget.compare_exchange(
                remaining,
                remaining - requested_bytes,
                Ordering::AcqRel,
                Ordering::Acquire,
            ) {
                Ok(_) => break,
                Err(current) => remaining = current,
            }
        }
        let result = self.gate.read_bounded(
            &self.lease,
            BoundedContentReadRequest {
                offset_bytes,
                max_bytes,
            },
            ThumbnailReadOperation {
                request_id: &self.request_id,
                session_id: self.session_id.as_deref(),
                source_version: &self.source_version,
                cancellation: &self.cancellation,
                deadline: self.deadline,
            },
        );
        let result = result.map_err(|error| {
            self.remaining_source_budget
                .fetch_add(requested_bytes, Ordering::AcqRel);
            map_content_read_error(error)
        })?;
        let unused_bytes = requested_bytes.saturating_sub(result.bytes.len() as u64);
        if unused_bytes > 0 {
            self.remaining_source_budget
                .fetch_add(unused_bytes, Ordering::AcqRel);
        }
        self.ensure_active()?;
        Ok(result)
    }

    pub fn read_all_bounded(
        &self,
        max_total_bytes: u64,
    ) -> Result<Vec<u8>, ThumbnailRendererError> {
        let max_total_bytes = max_total_bytes.min(self.max_source_bytes);
        if max_total_bytes == 0 {
            return Err(ThumbnailRendererError::Failed);
        }
        let mut offset = 0_u64;
        let mut bytes = Vec::new();
        loop {
            self.ensure_active()?;
            let remaining = max_total_bytes.saturating_sub(bytes.len() as u64);
            if remaining == 0 {
                return Err(ThumbnailRendererError::Failed);
            }
            let chunk = remaining.min(u64::from(READ_CHUNK_BYTES)) as u32;
            let read = self.read_bounded(offset, chunk)?;
            bytes.extend_from_slice(&read.bytes);
            if read.complete {
                return Ok(bytes);
            }
            if read.bytes.is_empty() {
                return Err(ThumbnailRendererError::Failed);
            }
            offset = offset
                .checked_add(read.bytes.len() as u64)
                .ok_or(ThumbnailRendererError::Failed)?;
        }
    }

    pub fn source_file_name(&self) -> Option<&str> {
        self.source_name.as_deref()
    }

    pub fn source(&self) -> &PreviewSourceRef {
        &self.source
    }

    pub fn source_version(&self) -> &str {
        &self.source_version
    }

    pub fn cache_key(&self) -> &str {
        &self.cache_key
    }

    pub fn is_cancelled(&self) -> bool {
        self.is_explicitly_cancelled() || self.deadline_exceeded()
    }

    pub fn is_explicitly_cancelled(&self) -> bool {
        self.scheduler_cancellation.is_cancelled() || self.cancellation.is_cancelled()
    }

    pub fn deadline_exceeded(&self) -> bool {
        Instant::now() >= self.deadline
    }

    pub fn remaining(&self) -> Duration {
        self.deadline.saturating_duration_since(Instant::now())
    }

    pub fn ensure_active(&self) -> Result<(), ThumbnailRendererError> {
        if self.scheduler_cancellation.is_cancelled() || self.cancellation.is_cancelled() {
            return Err(ThumbnailRendererError::Cancelled);
        }
        if Instant::now() >= self.deadline {
            return Err(ThumbnailRendererError::Timeout);
        }
        Ok(())
    }
}

fn map_content_read_error(error: ContentReadAccessError) -> ThumbnailRendererError {
    match error {
        ContentReadAccessError::LeaseInvalid => ThumbnailRendererError::Failed,
        ContentReadAccessError::SourceVersionMismatch => ThumbnailRendererError::IdentityChanged,
        ContentReadAccessError::PermissionDenied => ThumbnailRendererError::PermissionDenied,
        ContentReadAccessError::SourceUnavailable => ThumbnailRendererError::SourceUnavailable,
        ContentReadAccessError::Cancelled => ThumbnailRendererError::Cancelled,
        ContentReadAccessError::TimedOut => ThumbnailRendererError::Timeout,
        ContentReadAccessError::Failed => ThumbnailRendererError::Failed,
    }
}
