use super::access_test_support::{
    assert_no_stage_roots, isolated_scheduler, setup_with_scheduler_and_read_gate_config,
};
use super::*;
use crate::file_workspace::{
    preview::{PreviewCancellation, PreviewOperationContext},
    read_gate::ReadGateConfig,
};
use std::{
    sync::{mpsc, Arc, Mutex},
    thread,
    time::{Duration, Instant},
};

fn request(
    source: PreviewSourceRef,
    source_version: String,
    request_id: &str,
) -> NativePreviewAccessRequest {
    NativePreviewAccessRequest {
        session_id: "session-1".to_string(),
        request_id: request_id.to_string(),
        source,
        source_version,
        host: PreviewHostKind::ZenFloating,
    }
}

fn context(source_version: &str, request_id: &str) -> PreviewOperationContext {
    context_until(
        source_version,
        request_id,
        Instant::now() + Duration::from_secs(5),
    )
}

fn context_until(
    source_version: &str,
    request_id: &str,
    deadline: Instant,
) -> PreviewOperationContext {
    PreviewOperationContext::for_backend_content_read(
        "session-1",
        request_id,
        source_version,
        PreviewCancellation::default(),
        deadline,
    )
}

struct CopyPause {
    entered: Mutex<mpsc::Receiver<()>>,
    release: mpsc::Sender<()>,
}

impl CopyPause {
    fn wait_for_entry(&self) {
        self.entered
            .lock()
            .unwrap()
            .recv_timeout(Duration::from_secs(5))
            .expect("native copy entered deterministic pause");
    }

    fn release(&self) {
        self.release.send(()).expect("native copy pause release");
    }
}

fn install_copy_pause(registry: &NativePreviewAccessRegistry) -> Arc<CopyPause> {
    let (entered_tx, entered_rx) = mpsc::channel();
    let (release_tx, release_rx) = mpsc::channel();
    let release_rx = Mutex::new(release_rx);
    let pause = Arc::new(CopyPause {
        entered: Mutex::new(entered_rx),
        release: release_tx,
    });
    registry.set_after_first_copy_chunk_hook(Some(Arc::new(move || {
        entered_tx.send(()).expect("native copy pause receiver");
        release_rx
            .lock()
            .unwrap()
            .recv_timeout(Duration::from_secs(5))
            .expect("native copy pause release");
    })));
    pause
}

fn wait_for_queued(scheduler: &crate::scheduler::WorkScheduler) {
    for _ in 0..10_000 {
        if scheduler.snapshot().queued_interactive >= 1 {
            return;
        }
        thread::yield_now();
    }
    panic!("native preview request did not enter the shared scheduler queue");
}

#[test]
fn native_preview_staging_is_shared_scheduler_bounded_and_raii_releases_all_resources() {
    let scheduler = isolated_scheduler();
    let (_fixture, _gate, registry, source, source_version, _resolver) =
        setup_with_scheduler_and_read_gate_config(
            b"native scheduler admission",
            NativePreviewAccessConfig::default(),
            ReadGateConfig::default(),
            Arc::clone(&scheduler),
        );
    let pause = install_copy_pause(&registry);
    let worker_registry = Arc::clone(&registry);
    let worker_source = source.clone();
    let worker_version = source_version.clone();
    let worker_a = thread::spawn(move || {
        worker_registry.stage(
            request(worker_source, worker_version.clone(), "request-a"),
            &context(&worker_version, "request-a"),
        )
    });
    pause.wait_for_entry();

    let worker_registry = Arc::clone(&registry);
    let worker_source = source.clone();
    let worker_version = source_version.clone();
    let worker_b = thread::spawn(move || {
        worker_registry.stage(
            request(worker_source, worker_version.clone(), "request-b"),
            &context(&worker_version, "request-b"),
        )
    });
    wait_for_queued(&scheduler);
    let snapshot = scheduler.snapshot();
    assert_eq!(snapshot.running, 1);
    assert_eq!(snapshot.queued_interactive, 1);
    assert_eq!(snapshot.granted.native_preview, 1);
    assert_eq!(snapshot.granted.io, 1);
    assert_eq!(snapshot.granted.open_handles, 2);

    pause.release();
    assert!(worker_a.join().unwrap().is_ok());
    assert!(worker_b.join().unwrap().is_ok());
    assert_eq!(scheduler.snapshot().running, 0);
    assert_eq!(scheduler.snapshot().queued, 0);
    assert_eq!(scheduler.snapshot().granted.native_preview, 0);
    assert_eq!(scheduler.snapshot().granted.io, 0);
    assert_eq!(scheduler.snapshot().granted.open_handles, 0);
    registry.revoke_session("session-1");
    assert_eq!(registry.counts(), (0, 0, 0));
    assert_no_stage_roots(&registry);
}

#[test]
fn queued_and_active_native_revocation_cancel_scheduler_admission_and_restore_baseline() {
    let scheduler = isolated_scheduler();
    let (_fixture, _gate, registry, source, source_version, _resolver) =
        setup_with_scheduler_and_read_gate_config(
            b"native scheduler cancellation",
            NativePreviewAccessConfig::default(),
            ReadGateConfig::default(),
            Arc::clone(&scheduler),
        );
    let pause = install_copy_pause(&registry);
    let worker_registry = Arc::clone(&registry);
    let worker_source = source.clone();
    let worker_version = source_version.clone();
    let worker_a = thread::spawn(move || {
        worker_registry.stage(
            request(worker_source, worker_version.clone(), "request-a"),
            &context(&worker_version, "request-a"),
        )
    });
    pause.wait_for_entry();

    let worker_registry = Arc::clone(&registry);
    let worker_source = source.clone();
    let worker_version = source_version.clone();
    let worker_b = thread::spawn(move || {
        worker_registry.stage(
            request(worker_source, worker_version.clone(), "request-b"),
            &context(&worker_version, "request-b"),
        )
    });
    wait_for_queued(&scheduler);

    registry.revoke_request("session-1", "request-b", Some(&source_version));
    assert_eq!(
        worker_b.join().unwrap(),
        Err(NativePreviewAccessError::Cancelled)
    );
    assert_eq!(scheduler.snapshot().queued, 0);
    assert_eq!(scheduler.snapshot().running, 1);

    registry.revoke_request("session-1", "request-a", Some(&source_version));
    pause.release();
    assert_eq!(
        worker_a.join().unwrap(),
        Err(NativePreviewAccessError::Cancelled)
    );
    let snapshot = scheduler.snapshot();
    assert_eq!(snapshot.running, 0);
    assert_eq!(snapshot.queued, 0);
    assert_eq!(snapshot.granted.native_preview, 0);
    assert_eq!(snapshot.granted.io, 0);
    assert_eq!(snapshot.granted.open_handles, 0);
    assert_eq!(registry.counts(), (0, 0, 0));
    assert_no_stage_roots(&registry);
}

#[test]
fn queued_native_admission_respects_operation_deadline_without_staging() {
    let scheduler = isolated_scheduler();
    let (_fixture, _gate, registry, source, source_version, _resolver) =
        setup_with_scheduler_and_read_gate_config(
            b"native scheduler deadline",
            NativePreviewAccessConfig::default(),
            ReadGateConfig::default(),
            Arc::clone(&scheduler),
        );
    let pause = install_copy_pause(&registry);
    let worker_registry = Arc::clone(&registry);
    let worker_source = source.clone();
    let worker_version = source_version.clone();
    let worker_a = thread::spawn(move || {
        worker_registry.stage(
            request(worker_source, worker_version.clone(), "request-a"),
            &context(&worker_version, "request-a"),
        )
    });
    pause.wait_for_entry();

    let worker_registry = Arc::clone(&registry);
    let worker_source = source.clone();
    let worker_version = source_version.clone();
    let worker_b = thread::spawn(move || {
        worker_registry.stage(
            request(worker_source, worker_version.clone(), "request-b"),
            &context_until(
                &worker_version,
                "request-b",
                Instant::now() + Duration::from_millis(50),
            ),
        )
    });
    wait_for_queued(&scheduler);
    assert_eq!(
        worker_b.join().unwrap(),
        Err(NativePreviewAccessError::TimedOut)
    );
    assert_eq!(scheduler.snapshot().queued, 0);
    assert_eq!(scheduler.snapshot().running, 1);

    pause.release();
    assert!(worker_a.join().unwrap().is_ok());
    assert_eq!(scheduler.snapshot().running, 0);
    assert_eq!(
        scheduler.snapshot().granted,
        crate::scheduler::ResourceHints::empty()
    );
    registry.revoke_session("session-1");
    assert_eq!(registry.counts(), (0, 0, 0));
    assert_no_stage_roots(&registry);
}
