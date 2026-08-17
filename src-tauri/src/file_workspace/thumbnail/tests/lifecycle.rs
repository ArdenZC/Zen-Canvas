use super::*;

#[test]
fn identical_requests_deduplicate_and_cancelled_waiter_cannot_publish() {
    let gate = Arc::new(FakeGate::new("v1"));
    let mut renderer = FakeRenderer::new(false);
    let wait = Arc::new((Mutex::new(false), std::sync::Condvar::new()));
    renderer.wait = Some(Arc::clone(&wait));
    let renderer = Arc::new(renderer);
    let renders = Arc::clone(&renderer.renders);
    let service = service(gate, renderer, None, ThumbnailServiceConfig::default());
    let request = ThumbnailRequest::new(
        "request-1",
        source("file"),
        ThumbnailVariant::Small,
        WorkClass::Interactive,
    );
    let first = service.request(request.clone()).expect("first");
    let second = service
        .request(ThumbnailRequest {
            request_id: "request-2".to_string(),
            ..request
        })
        .expect("second");
    assert!(second.cancel());
    {
        let (ready, signal) = &*wait;
        *lock(ready) = true;
        signal.notify_all();
    }
    assert_eq!(first.join().expect("first result").bytes, b"png");
    assert_eq!(second.join().unwrap_err(), ThumbnailError::Cancelled);
    assert_eq!(renders.load(Ordering::SeqCst), 1);
}

#[test]
fn deduplication_owner_capacity_is_bounded() {
    let gate = Arc::new(FakeGate::new("v1"));
    let wait = Arc::new((Mutex::new(false), std::sync::Condvar::new()));
    let mut renderer = FakeRenderer::new(false);
    renderer.wait = Some(Arc::clone(&wait));
    let renderer = Arc::new(renderer);
    let service = service(
        gate,
        renderer,
        None,
        ThumbnailServiceConfig {
            max_owners_per_generation: 1,
            ..ThumbnailServiceConfig::default()
        },
    );
    let first = service
        .request(ThumbnailRequest::new(
            "owner-one",
            source("same-file"),
            ThumbnailVariant::Small,
            WorkClass::Interactive,
        ))
        .expect("first request");
    let second = service.request(ThumbnailRequest::new(
        "owner-two",
        source("same-file"),
        ThumbnailVariant::Small,
        WorkClass::Interactive,
    ));
    assert_eq!(second.unwrap_err(), ThumbnailError::SchedulerBackpressure);
    release_wait(&wait);
    assert!(first.join().is_ok());
    assert_eq!(service.active_request_count(), 0);
}

#[test]
fn final_owner_cancellation_abandons_work_and_releases_capacity() {
    let gate = Arc::new(FakeGate::new("v1"));
    let wait = Arc::new((Mutex::new(false), std::sync::Condvar::new()));
    let entered = Arc::new(AtomicBool::new(false));
    let mut renderer = FakeRenderer::new(false);
    renderer.wait = Some(Arc::clone(&wait));
    renderer.entered = Some(Arc::clone(&entered));
    let renderer = Arc::new(renderer);
    let service = service(gate, renderer, None, ThumbnailServiceConfig::default());
    let task = service
        .request(ThumbnailRequest::new(
            "cancel-final",
            source("cancel-file"),
            ThumbnailVariant::Small,
            WorkClass::Interactive,
        ))
        .expect("request");
    wait_until(&entered);
    assert!(task.cancel());
    assert_eq!(task.join().unwrap_err(), ThumbnailError::Cancelled);
    release_wait(&wait);
    for _ in 0..10_000 {
        if service.inner.scheduler.snapshot().running == 0 && service.active_request_count() == 0 {
            return;
        }
        thread::yield_now();
    }
    panic!("cancelled thumbnail work did not return to steady state");
}

#[test]
fn final_owner_cancellation_cannot_publish_memory_or_disk_cache() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("repository root")
        .join(".tmp-tests")
        .join("thumbnail-cancel-publication")
        .join(uuid::Uuid::new_v4().to_string());
    let gate = Arc::new(FakeGate::new("v1"));
    let renderer = Arc::new(FakeRenderer::new(false));
    let service = service(
        Arc::clone(&gate),
        renderer,
        Some(root.clone()),
        ThumbnailServiceConfig::default(),
    );
    service.inner.publication_barrier.arm();
    let task = service
        .request(ThumbnailRequest::new(
            "cancel-publication",
            source("cancel-publication-file"),
            ThumbnailVariant::Small,
            WorkClass::Interactive,
        ))
        .expect("request");
    wait_until(&service.inner.publication_barrier.entered);
    assert!(task.cancel());
    assert_eq!(task.join().unwrap_err(), ThumbnailError::Cancelled);
    service.inner.publication_barrier.release();
    wait_until(&service.inner.publication_barrier.completed);
    assert_eq!(service.active_request_count(), 0);
    assert_eq!(service.memory_cache_len(), 0);
    let entries = fs::read_dir(&root)
        .expect("cache root")
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .collect::<Vec<_>>();
    assert!(entries.iter().all(|path| {
        path.extension().and_then(|ext| ext.to_str()) != Some("thumb")
            && !path
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with(".pending-thumbnail-"))
    }));
    fs::remove_dir_all(root).expect("thumbnail cache cleanup");
}

#[test]
fn source_version_change_during_generation_rejects_and_does_not_cache() {
    let gate = Arc::new(FakeGate::new("v1"));
    let wait = Arc::new((Mutex::new(false), std::sync::Condvar::new()));
    let entered = Arc::new(AtomicBool::new(false));
    let mut renderer = FakeRenderer::new(false);
    renderer.wait = Some(Arc::clone(&wait));
    renderer.entered = Some(Arc::clone(&entered));
    let renderer = Arc::new(renderer);
    let service = service(
        Arc::clone(&gate),
        renderer,
        None,
        ThumbnailServiceConfig::default(),
    );
    let task = service
        .request(ThumbnailRequest::new(
            "stale-request",
            source("stale-file"),
            ThumbnailVariant::Large,
            WorkClass::Interactive,
        ))
        .expect("request");
    wait_until(&entered);
    *lock(&gate.version) = "v2".to_string();
    release_wait(&wait);
    assert_eq!(task.join().unwrap_err(), ThumbnailError::IdentityChanged);
    assert_eq!(service.memory_cache_len(), 0);
    assert_eq!(gate.leases.load(Ordering::SeqCst), 0);
}

#[test]
fn dispose_revokes_pending_owners_and_clears_session_memory() {
    let gate = Arc::new(FakeGate::new("v1"));
    let renderer = Arc::new(FakeRenderer::new(false));
    let service = service(gate, renderer, None, ThumbnailServiceConfig::default());
    let task = service
        .request(ThumbnailRequest::new(
            "dispose-request",
            source("dispose-file"),
            ThumbnailVariant::Small,
            WorkClass::Interactive,
        ))
        .expect("request");
    assert!(service.dispose());
    assert_eq!(task.join().unwrap_err(), ThumbnailError::Cancelled);
    assert!(!service.dispose());
    assert_eq!(service.active_request_count(), 0);
    assert_eq!(service.memory_cache_len(), 0);
    assert_eq!(
        service
            .request(ThumbnailRequest::new(
                "after-dispose",
                source("dispose-file-2"),
                ThumbnailVariant::Small,
                WorkClass::Interactive,
            ))
            .unwrap_err(),
        ThumbnailError::Disposed
    );
}

#[test]
fn repeated_request_cancel_cycles_return_to_steady_state() {
    let gate = Arc::new(FakeGate::new("v1"));
    let renderer = Arc::new(FakeRenderer::new(false));
    let service = service(
        Arc::clone(&gate),
        renderer,
        None,
        ThumbnailServiceConfig::default(),
    );
    for index in 0..40 {
        let task = service
            .request(ThumbnailRequest::new(
                format!("request-{index}"),
                source(&format!("file-{index}")),
                ThumbnailVariant::Small,
                WorkClass::Interactive,
            ))
            .expect("request");
        if index % 2 == 0 {
            assert!(task.cancel());
            assert_eq!(task.join().unwrap_err(), ThumbnailError::Cancelled);
        } else {
            task.join().expect("request result");
        }
    }
    assert_eq!(service.active_request_count(), 0);
    assert_eq!(gate.leases.load(Ordering::SeqCst), 0);
    assert_eq!(
        service.inner.scheduler.snapshot().granted,
        ResourceHints::empty()
    );
}
