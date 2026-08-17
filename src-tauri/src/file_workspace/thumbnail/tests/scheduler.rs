use super::*;

#[test]
fn interactive_work_uses_explicit_bounded_scheduler_resources() {
    let gate = Arc::new(FakeGate::new("v1"));
    let wait = Arc::new((Mutex::new(false), std::sync::Condvar::new()));
    let entered = Arc::new(AtomicBool::new(false));
    let mut renderer = FakeRenderer::new(false);
    renderer.wait = Some(Arc::clone(&wait));
    renderer.entered = Some(Arc::clone(&entered));
    let renderer = Arc::new(renderer);
    let resources = renderer.descriptor().resources;
    let service = service(gate, renderer, None, ThumbnailServiceConfig::default());
    let task = service
        .request(ThumbnailRequest::new(
            "resource-request",
            source("resource-file"),
            ThumbnailVariant::Medium,
            WorkClass::Interactive,
        ))
        .expect("request");
    wait_until(&entered);
    assert_eq!(service.inner.scheduler.snapshot().granted, resources);
    release_wait(&wait);
    assert!(task.join().is_ok());
    assert_eq!(
        service.inner.scheduler.snapshot().granted,
        ResourceHints::empty()
    );
}

#[test]
fn interactive_work_is_not_hidden_behind_blocked_background_work() {
    let scheduler =
        scheduler_with_capacities(crate::scheduler::ResourceCapacities::new(1, 1, 1, 1, 1, 1));
    let renderer = Arc::new(FakeRenderer::new(false));
    let resources = renderer.descriptor().resources;
    let holder = scheduler
        .try_acquire(WorkRequest::new("holder", WorkClass::Foreground, resources))
        .expect("resource holder");
    let service = service_with_scheduler(
        Arc::new(FakeGate::new("v1")),
        Arc::clone(&scheduler),
        Arc::clone(&renderer),
        None,
        ThumbnailServiceConfig {
            worker_count: 1,
            queue_capacity: 2,
            ..ThumbnailServiceConfig::default()
        },
    );
    let background = service
        .request(ThumbnailRequest::new(
            "background-request",
            source("background-file"),
            ThumbnailVariant::Small,
            WorkClass::Background,
        ))
        .expect("background request");
    let interactive = service
        .request(ThumbnailRequest::new(
            "interactive-request",
            source("interactive-file"),
            ThumbnailVariant::Small,
            WorkClass::Interactive,
        ))
        .expect("interactive request");
    wait_until(&service.inner.interactive_queued);

    drop(holder);
    interactive.join().expect("interactive result");
    background.join().expect("background result");
    let render_order = lock(&renderer.render_order);
    let order = render_order.iter().map(String::as_str).collect::<Vec<_>>();
    assert_eq!(order, ["interactive-file", "background-file"]);
}

#[test]
fn scheduler_retry_releases_worker_for_queued_generation() {
    let scheduler =
        scheduler_with_capacities(crate::scheduler::ResourceCapacities::new(1, 1, 1, 1, 1, 1));
    let renderer = Arc::new(FakeRenderer::new(false));
    let resources = renderer.descriptor().resources;
    let holder = scheduler
        .try_acquire(WorkRequest::new(
            "external-holder",
            WorkClass::Foreground,
            resources,
        ))
        .expect("resource holder");
    let service = service_with_scheduler(
        Arc::new(FakeGate::new("v1")),
        scheduler,
        Arc::clone(&renderer),
        None,
        ThumbnailServiceConfig {
            worker_count: 1,
            queue_capacity: 1,
            ..ThumbnailServiceConfig::default()
        },
    );
    let first = service
        .request(ThumbnailRequest::new(
            "retry-a",
            source("retry-a-file"),
            ThumbnailVariant::Small,
            WorkClass::Background,
        ))
        .expect("first request");
    wait_until(&service.inner.retry_observed);
    let second = service
        .request(ThumbnailRequest::new(
            "retry-b",
            source("retry-b-file"),
            ThumbnailVariant::Small,
            WorkClass::Interactive,
        ))
        .expect("queued request");

    drop(holder);
    let (first_result, second_result) = {
        let (sender, receiver) = std::sync::mpsc::channel();
        thread::spawn(move || {
            sender
                .send((first.join(), second.join()))
                .expect("join result receiver");
        });
        receiver
            .recv_timeout(Duration::from_secs(2))
            .expect("retry handoff deadlocked")
    };
    assert!(first_result.is_ok());
    assert!(second_result.is_ok());
    assert_eq!(service.active_request_count(), 0);
    let snapshot = service.inner.scheduler.snapshot();
    assert_eq!(snapshot.queued, 0);
    assert_eq!(snapshot.running, 0);
    assert_eq!(snapshot.granted, ResourceHints::empty());
}

#[test]
fn local_handoff_allows_background_admission_under_interactive_contention() {
    let scheduler =
        scheduler_with_capacities(crate::scheduler::ResourceCapacities::new(1, 1, 1, 1, 1, 1));
    let renderer = Arc::new(FakeRenderer::new(false));
    let resources = renderer.descriptor().resources;
    let holder = scheduler
        .try_acquire(WorkRequest::new(
            "fairness-holder",
            WorkClass::Foreground,
            resources,
        ))
        .expect("resource holder");
    let service = service_with_scheduler(
        Arc::new(FakeGate::new("v1")),
        scheduler,
        Arc::clone(&renderer),
        None,
        ThumbnailServiceConfig {
            worker_count: 1,
            queue_capacity: 4,
            ..ThumbnailServiceConfig::default()
        },
    );
    let background = service
        .request(ThumbnailRequest::new(
            "fair-background",
            source("fair-background-file"),
            ThumbnailVariant::Small,
            WorkClass::Background,
        ))
        .expect("background request");
    wait_until(&service.inner.retry_observed);
    let interactives = (0..4)
        .map(|index| {
            service
                .request(ThumbnailRequest::new(
                    format!("fair-interactive-{index}"),
                    source(&format!("fair-interactive-file-{index}")),
                    ThumbnailVariant::Small,
                    WorkClass::Interactive,
                ))
                .expect("interactive request")
        })
        .collect::<Vec<_>>();
    wait_until(&service.inner.interactive_queued);
    wait_until_count(&service.inner.background_admission_attempts, 3);

    drop(holder);
    assert!(background.join().is_ok());
    for interactive in interactives {
        assert!(interactive.join().is_ok());
    }
    assert_eq!(service.active_request_count(), 0);
}

#[test]
fn deduped_interactive_owner_promotes_waiting_background_generation() {
    let scheduler =
        scheduler_with_capacities(crate::scheduler::ResourceCapacities::new(1, 1, 1, 1, 1, 1));
    let wait = Arc::new((Mutex::new(false), std::sync::Condvar::new()));
    let entered = Arc::new(AtomicBool::new(false));
    let mut renderer = FakeRenderer::new(false);
    renderer.wait = Some(Arc::clone(&wait));
    renderer.entered = Some(Arc::clone(&entered));
    let renderer = Arc::new(renderer);
    let resources = renderer.descriptor().resources;
    let holder = scheduler
        .try_acquire(WorkRequest::new(
            "priority-holder",
            WorkClass::Foreground,
            resources,
        ))
        .expect("resource holder");
    let service = service_with_scheduler(
        Arc::new(FakeGate::new("v1")),
        scheduler,
        Arc::clone(&renderer),
        None,
        ThumbnailServiceConfig {
            worker_count: 1,
            queue_capacity: 1,
            ..ThumbnailServiceConfig::default()
        },
    );
    let background = service
        .request(ThumbnailRequest::new(
            "priority-background",
            source("same-priority-file"),
            ThumbnailVariant::Small,
            WorkClass::Background,
        ))
        .expect("background request");
    wait_until(&service.inner.retry_observed);
    let interactive = service
        .request(ThumbnailRequest::new(
            "priority-interactive",
            source("same-priority-file"),
            ThumbnailVariant::Small,
            WorkClass::Interactive,
        ))
        .expect("interactive owner");

    drop(holder);
    wait_until(&entered);
    let snapshot = service.inner.scheduler.snapshot();
    assert_eq!(snapshot.running_interactive, 1);
    assert_eq!(snapshot.running_background, 0);
    release_wait(&wait);
    assert!(background.join().is_ok());
    assert!(interactive.join().is_ok());
    assert_eq!(renderer.renders.load(Ordering::SeqCst), 1);
}

#[test]
fn cancelled_interactive_owner_recomputes_waiting_generation_priority() {
    let scheduler =
        scheduler_with_capacities(crate::scheduler::ResourceCapacities::new(1, 1, 1, 1, 1, 1));
    let wait = Arc::new((Mutex::new(false), std::sync::Condvar::new()));
    let entered = Arc::new(AtomicBool::new(false));
    let mut renderer = FakeRenderer::new(false);
    renderer.wait = Some(Arc::clone(&wait));
    renderer.entered = Some(Arc::clone(&entered));
    let renderer = Arc::new(renderer);
    let resources = renderer.descriptor().resources;
    let holder = scheduler
        .try_acquire(WorkRequest::new(
            "priority-cancel-holder",
            WorkClass::Foreground,
            resources,
        ))
        .expect("resource holder");
    let service = service_with_scheduler(
        Arc::new(FakeGate::new("v1")),
        scheduler,
        Arc::clone(&renderer),
        None,
        ThumbnailServiceConfig {
            worker_count: 1,
            queue_capacity: 1,
            ..ThumbnailServiceConfig::default()
        },
    );
    let background = service
        .request(ThumbnailRequest::new(
            "priority-cancel-background",
            source("same-cancel-priority-file"),
            ThumbnailVariant::Small,
            WorkClass::Background,
        ))
        .expect("background request");
    wait_until(&service.inner.retry_observed);
    let interactive = service
        .request(ThumbnailRequest::new(
            "priority-cancel-interactive",
            source("same-cancel-priority-file"),
            ThumbnailVariant::Small,
            WorkClass::Interactive,
        ))
        .expect("interactive owner");
    assert!(interactive.cancel());
    assert_eq!(interactive.join().unwrap_err(), ThumbnailError::Cancelled);

    drop(holder);
    wait_until(&entered);
    let snapshot = service.inner.scheduler.snapshot();
    assert_eq!(snapshot.running_background, 1);
    assert_eq!(snapshot.running_interactive, 0);
    release_wait(&wait);
    assert!(background.join().is_ok());
    assert_eq!(renderer.renders.load(Ordering::SeqCst), 1);
}

#[test]
fn executor_backpressure_is_explicit_and_bounded() {
    let gate = Arc::new(FakeGate::new("v1"));
    let wait = Arc::new((Mutex::new(false), std::sync::Condvar::new()));
    let entered = Arc::new(AtomicBool::new(false));
    let mut renderer = FakeRenderer::new(false);
    renderer.wait = Some(Arc::clone(&wait));
    renderer.entered = Some(Arc::clone(&entered));
    let renderer = Arc::new(renderer);
    let config = ThumbnailServiceConfig {
        worker_count: 1,
        queue_capacity: 1,
        ..ThumbnailServiceConfig::default()
    };
    let service = service(gate, renderer, None, config);
    let first = service
        .request(ThumbnailRequest::new(
            "queue-1",
            source("queue-file-1"),
            ThumbnailVariant::Small,
            WorkClass::Interactive,
        ))
        .expect("first request");
    wait_until(&entered);
    let second = service
        .request(ThumbnailRequest::new(
            "queue-2",
            source("queue-file-2"),
            ThumbnailVariant::Small,
            WorkClass::Interactive,
        ))
        .expect("bounded queued request");
    let third = service.request(ThumbnailRequest::new(
        "queue-3",
        source("queue-file-3"),
        ThumbnailVariant::Small,
        WorkClass::Interactive,
    ));
    assert_eq!(third.unwrap_err(), ThumbnailError::SchedulerBackpressure);
    release_wait(&wait);
    assert!(first.join().is_ok());
    assert!(second.join().is_ok());
    assert_eq!(service.active_request_count(), 0);
}
