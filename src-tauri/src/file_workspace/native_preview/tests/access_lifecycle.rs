use super::access_test_support::{assert_no_stage_roots, context, setup, setup_with_config};
use super::*;
use crate::file_workspace::preview::{PreviewCancellation, PreviewOperationContext};
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

fn context_for(
    source_version: &str,
    request_id: &str,
    cancellation: PreviewCancellation,
    deadline: Instant,
) -> PreviewOperationContext {
    PreviewOperationContext::for_backend_content_read(
        "session-1",
        request_id,
        source_version,
        cancellation,
        deadline,
    )
}

struct CommitPause {
    entered: Mutex<mpsc::Receiver<()>>,
    release: mpsc::Sender<()>,
}

impl CommitPause {
    fn wait_for_entry(&self) {
        self.entered
            .lock()
            .unwrap()
            .recv_timeout(Duration::from_secs(5))
            .expect("staging worker reached deterministic hook");
    }

    fn release(&self) {
        self.release
            .send(())
            .expect("staging worker release receiver");
    }
}

fn install_commit_pause(registry: &NativePreviewAccessRegistry) -> Arc<CommitPause> {
    let (entered_tx, entered_rx) = mpsc::channel();
    let (release_tx, release_rx) = mpsc::channel();
    let release_rx = Mutex::new(release_rx);
    let pause = Arc::new(CommitPause {
        entered: Mutex::new(entered_rx),
        release: release_tx,
    });
    registry.set_before_commit_hook(Some(Arc::new(move || {
        entered_tx.send(()).expect("commit hook entry receiver");
        release_rx
            .lock()
            .unwrap()
            .recv_timeout(Duration::from_secs(5))
            .expect("commit hook release");
    })));
    pause
}

fn install_first_chunk_pause(registry: &NativePreviewAccessRegistry) -> Arc<CommitPause> {
    let (entered_tx, entered_rx) = mpsc::channel();
    let (release_tx, release_rx) = mpsc::channel();
    let release_rx = Mutex::new(release_rx);
    let pause = Arc::new(CommitPause {
        entered: Mutex::new(entered_rx),
        release: release_tx,
    });
    registry.set_after_first_copy_chunk_hook(Some(Arc::new(move || {
        entered_tx.send(()).expect("copy hook entry receiver");
        release_rx
            .lock()
            .unwrap()
            .recv_timeout(Duration::from_secs(5))
            .expect("copy hook release");
    })));
    pause
}

#[test]
fn revoke_session_removes_staged_source_and_token() {
    let (_fixture, _gate, registry, source, source_version, _resolver) = setup(b"bytes");
    let operation = context(&source_version);
    let handle = registry
        .stage(
            request(source, source_version.clone(), "request-1"),
            &operation,
        )
        .unwrap();
    registry.revoke_session("session-1");
    assert_eq!(registry.counts(), (0, 0, 0));
    assert_eq!(
        registry.resolve(&NativePreviewAccessResolveRequest {
            token: handle.token,
            session_id: "session-1".to_string(),
            request_id: "request-1".to_string(),
            source_version,
            host: PreviewHostKind::ZenFloating,
        }),
        Err(NativePreviewAccessError::InvalidOrStale)
    );
}

#[test]
fn cancelled_and_deadline_expired_requests_fail_before_publish() {
    let (_fixture, _gate, registry, source, source_version, _resolver) = setup(b"bytes");
    let cancellation = PreviewCancellation::default();
    cancellation.cancel();
    let cancelled = context_for(
        &source_version,
        "request-1",
        cancellation,
        Instant::now() + Duration::from_secs(2),
    );
    assert_eq!(
        registry.stage(
            request(source.clone(), source_version.clone(), "request-1"),
            &cancelled,
        ),
        Err(NativePreviewAccessError::Cancelled)
    );

    let expired = context_for(
        &source_version,
        "request-1",
        PreviewCancellation::default(),
        Instant::now() - Duration::from_secs(1),
    );
    assert_eq!(
        registry.stage(request(source, source_version, "request-1"), &expired),
        Err(NativePreviewAccessError::TimedOut)
    );
    assert_eq!(registry.counts(), (0, 0, 0));
    assert_no_stage_roots(&registry);
}

#[test]
fn default_acquisition_deadline_is_strictly_shorter_than_abandoned_cleanup_age() {
    let default = NativePreviewAccessConfig::default();
    assert!(default.max_acquisition_duration < ABANDONED_MIN_AGE);
    assert!(default.validate().is_ok());

    for config in [
        NativePreviewAccessConfig {
            max_acquisition_duration: ABANDONED_MIN_AGE,
            ..default
        },
        NativePreviewAccessConfig {
            max_acquisition_duration: Duration::from_secs(9 * 60),
            ttl: Duration::from_secs(60),
            ..default
        },
        NativePreviewAccessConfig {
            max_acquisition_duration: Duration::MAX,
            ttl: Duration::from_secs(1),
            ..default
        },
    ] {
        assert_eq!(
            config.validate(),
            Err(NativePreviewAccessError::InvalidRequest)
        );
    }
}

#[test]
fn acquisition_deadline_during_multi_chunk_copy_deletes_partial_staging() {
    let (_fixture, _gate, registry, source, source_version, _resolver) = setup_with_config(
        &vec![b'x'; 32 * 1024],
        NativePreviewAccessConfig {
            read_chunk_bytes: 1024,
            max_acquisition_duration: Duration::from_secs(30),
            ..NativePreviewAccessConfig::default()
        },
    );
    let pause = install_first_chunk_pause(&registry);
    let operation = context(&source_version);
    let worker_registry = Arc::clone(&registry);
    let worker_source = source.clone();
    let worker_version = source_version.clone();
    let worker = thread::spawn(move || {
        worker_registry.stage(
            request(worker_source, worker_version, "request-1"),
            &operation,
        )
    });
    pause.wait_for_entry();
    registry.force_timeout_for_test();
    pause.release();
    assert_eq!(
        worker.join().unwrap(),
        Err(NativePreviewAccessError::TimedOut)
    );
    assert_eq!(registry.counts(), (0, 0, 0));
    assert_no_stage_roots(&registry);
}

#[test]
fn acquisition_timeout_before_first_copy_hook_is_bounded_and_cleans_staging() {
    let (_fixture, _gate, registry, source, source_version, _resolver) = setup_with_config(
        b"timeout before copy hook",
        NativePreviewAccessConfig {
            max_acquisition_duration: Duration::from_secs(30),
            ..NativePreviewAccessConfig::default()
        },
    );
    registry.force_timeout_for_test();

    assert_eq!(
        registry.stage(
            request(source, source_version.clone(), "request-1"),
            &context(&source_version),
        ),
        Err(NativePreviewAccessError::TimedOut)
    );
    assert_eq!(registry.counts(), (0, 0, 0));
    assert_no_stage_roots(&registry);
}

#[test]
fn final_commit_rechecks_cancel_before_publishing_handle() {
    let (_fixture, _gate, registry, source, source_version, _resolver) = setup(b"commit race");
    let pause = install_commit_pause(&registry);
    let cancellation = PreviewCancellation::default();
    let operation = context_for(
        &source_version,
        "request-1",
        cancellation.clone(),
        Instant::now() + Duration::from_secs(2),
    );
    let worker_registry = Arc::clone(&registry);
    let worker_source = source.clone();
    let worker_version = source_version.clone();
    let worker = thread::spawn(move || {
        worker_registry.stage(
            request(worker_source, worker_version, "request-1"),
            &operation,
        )
    });
    pause.wait_for_entry();
    cancellation.cancel();
    registry.revoke_session("session-1");
    pause.release();
    assert_eq!(
        worker.join().unwrap(),
        Err(NativePreviewAccessError::Cancelled)
    );
    assert_eq!(registry.counts(), (0, 0, 0));
    assert_no_stage_roots(&registry);
}

#[test]
fn source_switch_revoke_wins_over_final_commit_publication() {
    let (_fixture, _gate, registry, source, source_version, _resolver) = setup(b"switch race");
    let pause = install_commit_pause(&registry);
    let operation = context(&source_version);
    let worker_registry = Arc::clone(&registry);
    let worker_source = source.clone();
    let worker_version = source_version.clone();
    let worker = thread::spawn(move || {
        worker_registry.stage(
            request(worker_source, worker_version, "request-1"),
            &operation,
        )
    });
    pause.wait_for_entry();
    registry.revoke_request("session-1", "request-1", Some(&source_version));
    pause.release();
    assert_eq!(
        worker.join().unwrap(),
        Err(NativePreviewAccessError::Cancelled)
    );
    assert_eq!(registry.counts(), (0, 0, 0));
    assert_no_stage_roots(&registry);
}

#[test]
fn dispose_during_final_commit_leaves_no_ready_record_or_file() {
    let (_fixture, _gate, registry, source, source_version, _resolver) = setup(b"dispose race");
    let pause = install_commit_pause(&registry);
    let operation = context(&source_version);
    let worker_registry = Arc::clone(&registry);
    let worker_source = source.clone();
    let worker_version = source_version.clone();
    let worker = thread::spawn(move || {
        worker_registry.stage(
            request(worker_source, worker_version, "request-1"),
            &operation,
        )
    });
    pause.wait_for_entry();
    registry.dispose();
    pause.release();
    assert_eq!(
        worker.join().unwrap(),
        Err(NativePreviewAccessError::Disposed)
    );
    assert_eq!(registry.counts(), (0, 0, 0));
    assert_no_stage_roots(&registry);
}

#[test]
fn ready_record_expiry_removes_staged_file() {
    let (_fixture, _gate, registry, source, source_version, _resolver) = setup_with_config(
        b"expiring",
        NativePreviewAccessConfig {
            max_acquisition_duration: Duration::from_secs(30),
            ..NativePreviewAccessConfig::default()
        },
    );
    let operation = context(&source_version);
    let handle = registry
        .stage(
            request(source, source_version.clone(), "request-1"),
            &operation,
        )
        .unwrap();
    let path = registry
        .resolve(&NativePreviewAccessResolveRequest {
            token: handle.token,
            session_id: "session-1".to_string(),
            request_id: "request-1".to_string(),
            source_version,
            host: PreviewHostKind::ZenFloating,
        })
        .unwrap();
    registry.force_expire_records_for_test();
    assert_eq!(registry.counts(), (0, 0, 0));
    assert!(!path.exists());
}

#[test]
fn per_file_and_total_capacity_limits_are_enforced() {
    let (_fixture, _gate, registry, source, source_version, _resolver) = setup_with_config(
        b"1234",
        NativePreviewAccessConfig {
            max_records: 2,
            max_file_bytes: 4,
            max_total_bytes: 8,
            read_chunk_bytes: 2,
            max_acquisition_duration: Duration::from_secs(30),
            ..NativePreviewAccessConfig::default()
        },
    );
    let operation = context(&source_version);
    let first = registry
        .stage(
            request(source.clone(), source_version.clone(), "request-1"),
            &operation,
        )
        .unwrap();
    let second = registry
        .stage(
            request(source.clone(), source_version.clone(), "request-1"),
            &operation,
        )
        .unwrap();
    assert_eq!(registry.counts(), (2, 0, 8));
    assert_eq!(
        registry.stage(request(source, source_version, "request-1"), &operation,),
        Err(NativePreviewAccessError::CapacityExceeded)
    );
    assert!(!first.token.is_empty());
    assert!(!second.token.is_empty());
    registry.revoke_session("session-1");
    assert_eq!(registry.counts(), (0, 0, 0));
}

#[test]
fn inflight_reservation_capacity_is_enforced_before_commit() {
    let (_fixture, _gate, registry, source, source_version, _resolver) = setup_with_config(
        b"inflight",
        NativePreviewAccessConfig {
            max_records: 1,
            max_acquisition_duration: Duration::from_secs(30),
            ..NativePreviewAccessConfig::default()
        },
    );
    let pause = install_first_chunk_pause(&registry);
    let operation = context(&source_version);
    let worker_registry = Arc::clone(&registry);
    let worker_source = source.clone();
    let worker_version = source_version.clone();
    let worker = thread::spawn(move || {
        worker_registry.stage(
            request(worker_source, worker_version, "request-1"),
            &operation,
        )
    });
    pause.wait_for_entry();
    assert_eq!(
        registry.stage(
            request(source, source_version.clone(), "request-1"),
            &context(&source_version),
        ),
        Err(NativePreviewAccessError::CapacityExceeded)
    );
    pause.release();
    assert!(worker.join().unwrap().is_ok());
    registry.revoke_session("session-1");
    assert_eq!(registry.counts(), (0, 0, 0));
}

#[test]
fn repeated_create_and_revoke_releases_registry_capacity() {
    let (_fixture, _gate, registry, source, source_version, _resolver) = setup(b"steady state");
    for _ in 0..32 {
        let operation = context(&source_version);
        registry
            .stage(
                request(source.clone(), source_version.clone(), "request-1"),
                &operation,
            )
            .unwrap();
        registry.revoke_session("session-1");
        assert_eq!(registry.counts(), (0, 0, 0));
    }
    assert_no_stage_roots(&registry);
}
