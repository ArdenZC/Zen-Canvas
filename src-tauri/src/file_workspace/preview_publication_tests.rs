use super::tests::{
    partial_text_result, registry, resolver, session, source, text_result, wait_until,
    wait_until_representation,
};
use super::*;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use std::thread;

struct ProgressivePrepared {
    cleanup_count: Arc<AtomicUsize>,
    partial_publications: Arc<AtomicUsize>,
    out_of_order_rejected: Arc<AtomicBool>,
    fail_after_partial: bool,
    partial_release: Option<Arc<AtomicBool>>,
    burst_partials: usize,
    wait_for_cancel: bool,
    started: Arc<AtomicBool>,
}

impl PreparedPreview for ProgressivePrepared {
    fn load(
        &mut self,
        context: &PreviewOperationContext,
        environment: PreviewProviderEnvironment<'_>,
    ) -> Result<PreviewProviderResult, PreviewProviderError> {
        self.started.store(true, Ordering::Release);
        let publication = environment
            .publication
            .ok_or(PreviewProviderError::Failed)?;
        publication
            .publish(PreviewPublicationUpdate {
                sequence: 1,
                result: partial_text_result("partial-a"),
            })
            .map_err(|_| PreviewProviderError::Failed)?;
        self.partial_publications.fetch_add(1, Ordering::AcqRel);
        if publication
            .publish(PreviewPublicationUpdate {
                sequence: 1,
                result: partial_text_result("duplicate-partial"),
            })
            .is_err()
        {
            self.out_of_order_rejected.store(true, Ordering::Release);
        } else {
            return Err(PreviewProviderError::Failed);
        }
        if self.fail_after_partial {
            return Err(PreviewProviderError::Failed);
        }
        if let Some(release) = &self.partial_release {
            while !release.load(Ordering::Acquire)
                && !context.cancellation().is_cancelled()
                && context.is_publication_current()
            {
                thread::yield_now();
            }
            if context.cancellation().is_cancelled() {
                return Err(PreviewProviderError::Cancelled);
            }
        }
        for offset in 0..self.burst_partials {
            publication
                .publish(PreviewPublicationUpdate {
                    sequence: 2 + offset as u64,
                    result: partial_text_result(&format!("partial-burst-{offset}")),
                })
                .map_err(|_| PreviewProviderError::Failed)?;
            self.partial_publications.fetch_add(1, Ordering::AcqRel);
        }
        if self.wait_for_cancel {
            while !context.cancellation().is_cancelled() && context.is_publication_current() {
                thread::yield_now();
            }
            let late = publication.publish(PreviewPublicationUpdate {
                sequence: 2,
                result: text_result("late-progressive"),
            });
            assert!(late.is_err());
            return Err(PreviewProviderError::Cancelled);
        }
        Ok(text_result("complete"))
    }

    fn cleanup(&mut self) {
        self.cleanup_count.fetch_add(1, Ordering::AcqRel);
    }
}

struct ProgressiveProvider {
    descriptor: PreviewProviderDescriptor,
    cleanup_count: Arc<AtomicUsize>,
    partial_publications: Arc<AtomicUsize>,
    out_of_order_rejected: Arc<AtomicBool>,
    fail_after_partial: bool,
    partial_release: Option<Arc<AtomicBool>>,
    burst_partials: usize,
    wait_for_cancel: bool,
    started: Arc<AtomicBool>,
}

impl PreviewProvider for ProgressiveProvider {
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
        Ok(Box::new(ProgressivePrepared {
            cleanup_count: Arc::clone(&self.cleanup_count),
            partial_publications: Arc::clone(&self.partial_publications),
            out_of_order_rejected: Arc::clone(&self.out_of_order_rejected),
            fail_after_partial: self.fail_after_partial,
            partial_release: self.partial_release.clone(),
            burst_partials: self.burst_partials,
            wait_for_cancel: self.wait_for_cancel,
            started: Arc::clone(&self.started),
        }))
    }
}

type ProgressiveProviderFixture = (
    Arc<ProgressiveProvider>,
    Arc<AtomicBool>,
    Arc<AtomicBool>,
    Arc<AtomicUsize>,
    Arc<AtomicBool>,
);

fn progressive_provider(
    id: &str,
    wait_for_cancel: bool,
    fail_after_partial: bool,
    pause_after_partial: bool,
    burst_partials: usize,
) -> ProgressiveProviderFixture {
    let started = Arc::new(AtomicBool::new(false));
    let out_of_order_rejected = Arc::new(AtomicBool::new(false));
    let partial_release = Arc::new(AtomicBool::new(!pause_after_partial));
    let cleanup_count = Arc::new(AtomicUsize::new(0));
    let provider = Arc::new(ProgressiveProvider {
        descriptor: PreviewProviderDescriptor::new(
            id,
            100,
            PreviewCapabilities::all(),
            vec![PreviewHostKind::ZenFloating],
            true,
        ),
        cleanup_count: Arc::clone(&cleanup_count),
        partial_publications: Arc::new(AtomicUsize::new(0)),
        out_of_order_rejected: Arc::clone(&out_of_order_rejected),
        fail_after_partial,
        partial_release: Some(Arc::clone(&partial_release)),
        burst_partials,
        wait_for_cancel,
        started: Arc::clone(&started),
    });
    (
        provider,
        started,
        out_of_order_rejected,
        cleanup_count,
        partial_release,
    )
}

#[test]
fn progressive_publication_is_partial_then_complete_and_rejects_duplicate_sequence() {
    let (provider, started, out_of_order_rejected, cleanup_count, partial_release) =
        progressive_provider("progressive", false, false, true, 3);
    let session = session("entry-progressive");
    let task = session
        .start(
            resolver("entry-progressive", "version-progressive"),
            registry(vec![provider.clone()]),
        )
        .expect("progressive worker starts");
    wait_until(&started);
    wait_until_representation(&session);
    let partial = session.representation().expect("partial is observable");
    assert_eq!(partial.completeness, PreviewCompleteness::Partial);
    assert_eq!(partial.source_version, "version-progressive");
    partial_release.store(true, Ordering::Release);
    let outcome = task.join().expect("progressive provider completes");
    assert_eq!(outcome.envelope.completeness, PreviewCompleteness::Complete);
    assert!(provider.partial_publications.load(Ordering::Acquire) >= 4);
    assert!(out_of_order_rejected.load(Ordering::Acquire));
    assert_eq!(cleanup_count.load(Ordering::Acquire), 1);
    assert_eq!(session.state(), PreviewSessionState::Ready);
}

#[test]
fn progressive_publication_is_revoked_by_cancel_and_cleanup_runs() {
    let (provider, started, _out_of_order_rejected, cleanup_count, _partial_release) =
        progressive_provider("progressive-cancel", true, false, false, 0);
    let session = session("entry-progressive-cancel");
    let task = session
        .start(
            resolver("entry-progressive-cancel", "version-progressive-cancel"),
            registry(vec![provider]),
        )
        .expect("progressive worker starts");
    wait_until(&started);
    wait_until_representation(&session);
    assert_eq!(
        session
            .representation()
            .expect("partial representation")
            .completeness,
        PreviewCompleteness::Partial
    );
    assert!(session.cancel());
    assert_eq!(session.state(), PreviewSessionState::Cancelled);
    assert!(matches!(task.join(), Err(PreviewRunError::Cancelled)));
    assert_eq!(cleanup_count.load(Ordering::Acquire), 1);
    assert!(session.current_publication().is_none());
}

#[test]
fn progressive_provider_failure_after_partial_uses_metadata_fallback() {
    let (provider, started, _out_of_order_rejected, cleanup_count, _partial_release) =
        progressive_provider("progressive-failure", false, true, false, 0);
    let session = session("entry-progressive-failure");
    let task = session
        .start(
            resolver("entry-progressive-failure", "version-progressive-failure"),
            registry(vec![provider]),
        )
        .expect("progressive worker starts");
    wait_until(&started);
    wait_until_representation(&session);
    let outcome = task.join().expect("metadata fallback survives failure");
    assert!(matches!(
        outcome.envelope.representation,
        PreviewRepresentation::Metadata { .. }
    ));
    assert!(outcome
        .envelope
        .warnings
        .iter()
        .any(|warning| matches!(warning, PreviewWarning::MetadataFallback)));
    assert_eq!(cleanup_count.load(Ordering::Acquire), 1);
}

#[test]
fn progressive_publication_rejects_late_switch_and_dispose_updates() {
    for action in ["switch", "dispose"] {
        let (provider, started, _out_of_order_rejected, cleanup_count, _partial_release) =
            progressive_provider(&format!("progressive-{action}"), true, false, false, 0);
        let session = session(&format!("entry-progressive-{action}"));
        let task = session
            .start(
                resolver(
                    &format!("entry-progressive-{action}"),
                    &format!("version-progressive-{action}"),
                ),
                registry(vec![provider]),
            )
            .expect("progressive worker starts");
        wait_until(&started);
        wait_until_representation(&session);
        assert_eq!(
            session
                .representation()
                .expect("partial representation")
                .completeness,
            PreviewCompleteness::Partial
        );
        let old_publication = session
            .current_publication()
            .expect("old publication token");

        if action == "switch" {
            session
                .switch_source(PreviewRequest {
                    request_id: "progressive-switched-request".to_string(),
                    source: source("progressive-switched-source"),
                })
                .expect("switch revokes old publication");
        } else {
            assert!(session.dispose());
        }
        assert!(!old_publication.is_current());
        if action == "dispose" {
            assert!(session.current_publication().is_none());
        } else {
            assert!(session.representation().is_none());
        }
        assert!(matches!(
            task.join(),
            Err(PreviewRunError::Cancelled) | Err(PreviewRunError::StalePublication)
        ));
        assert_eq!(cleanup_count.load(Ordering::Acquire), 1);
    }
}

#[test]
fn progressive_publication_keeps_a_bounded_latest_only_burst() {
    let (provider, started, _out_of_order_rejected, cleanup_count, _partial_release) =
        progressive_provider("progressive-burst", false, false, false, 256);
    let session = session("entry-progressive-burst");
    let task = session
        .start(
            resolver("entry-progressive-burst", "version-progressive-burst"),
            registry(vec![provider.clone()]),
        )
        .expect("progressive worker starts");
    wait_until(&started);
    let outcome = task.join().expect("bounded burst completes");
    assert_eq!(provider.partial_publications.load(Ordering::Acquire), 257);
    assert_eq!(outcome.envelope.completeness, PreviewCompleteness::Complete);
    assert_eq!(cleanup_count.load(Ordering::Acquire), 1);
    assert_eq!(session.state(), PreviewSessionState::Ready);
}

#[test]
fn repeated_progressive_cancel_switch_dispose_cycles_leave_no_publication() {
    for index in 0..128 {
        let action = index % 2;
        let entry_id = format!("entry-progressive-cycle-{index}");
        let (provider, started, _out_of_order_rejected, cleanup_count, _partial_release) =
            progressive_provider(&format!("progressive-cycle-{index}"), true, false, false, 0);
        let session = session(&entry_id);
        let task = session
            .start(
                resolver(&entry_id, &format!("version-progressive-cycle-{index}")),
                registry(vec![provider]),
            )
            .expect("progressive cycle starts");
        wait_until(&started);
        wait_until_representation(&session);
        let old_publication = session
            .current_publication()
            .expect("progressive cycle publication");
        if action == 0 {
            assert!(session.cancel());
        } else {
            session
                .switch_source(PreviewRequest {
                    request_id: format!("progressive-cycle-switched-{index}"),
                    source: source(&format!("progressive-cycle-source-{index}")),
                })
                .expect("progressive cycle switch");
        }
        assert!(matches!(
            task.join(),
            Err(PreviewRunError::Cancelled) | Err(PreviewRunError::StalePublication)
        ));
        assert!(!old_publication.is_current());
        assert_eq!(cleanup_count.load(Ordering::Acquire), 1);
        assert!(session.dispose());
    }
}
