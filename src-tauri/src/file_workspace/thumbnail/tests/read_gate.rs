use super::*;

#[test]
fn renderer_reads_through_thumbnail_gate_and_resources_are_released() {
    let gate = Arc::new(FakeGate::new("v1"));
    let renderer = Arc::new(FakeRenderer::new(true));
    let reads = Arc::clone(&gate.reads);
    let leases = Arc::clone(&gate.leases);
    let service = service(
        Arc::clone(&gate),
        renderer,
        None,
        ThumbnailServiceConfig::default(),
    );
    let task = service
        .request(ThumbnailRequest::new(
            "request",
            source("file"),
            ThumbnailVariant::Medium,
            WorkClass::Interactive,
        ))
        .expect("request");
    assert_eq!(task.join().expect("thumbnail").bytes, b"png");
    assert!(reads.load(Ordering::SeqCst) > 0);
    assert_eq!(leases.load(Ordering::SeqCst), 0);
    assert_eq!(service.active_request_count(), 0);
}

#[test]
fn materialization_failure_is_conservative_and_never_reads() {
    let gate = Arc::new(FakeGate::new("v1"));
    gate.set_error(Some(ReadGateError::MaterializationRequired));
    let renderer = Arc::new(FakeRenderer::new(true));
    let renders = Arc::clone(&renderer.renders);
    let service = service(
        Arc::clone(&gate),
        renderer,
        None,
        ThumbnailServiceConfig::default(),
    );
    let result = service.request(ThumbnailRequest::new(
        "request",
        source("placeholder"),
        ThumbnailVariant::Small,
        WorkClass::Interactive,
    ));
    assert_eq!(result.unwrap_err(), ThumbnailError::MaterializationRequired);
    assert_eq!(renders.load(Ordering::SeqCst), 0);
    assert_eq!(gate.reads.load(Ordering::SeqCst), 0);
    assert_eq!(gate.leases.load(Ordering::SeqCst), 0);
}

#[test]
fn unavailable_provider_states_never_trigger_implicit_reads() {
    let cases = [
        (ReadGateError::Downloading, ThumbnailError::Downloading),
        (
            ReadGateError::SourceUnavailable,
            ThumbnailError::SourceUnavailable,
        ),
        (
            ReadGateError::PermissionDenied,
            ThumbnailError::PermissionDenied,
        ),
        (
            ReadGateError::AvailabilityUnknown,
            ThumbnailError::UnknownSource,
        ),
        (
            ReadGateError::SourceNotSupported,
            ThumbnailError::UnsupportedSource,
        ),
        (
            ReadGateError::PackageUnsupported,
            ThumbnailError::UnsupportedSource,
        ),
    ];
    for (gate_error, expected) in cases {
        let gate = Arc::new(FakeGate::new("v1"));
        gate.set_error(Some(gate_error));
        let renderer = Arc::new(FakeRenderer::new(true));
        let renders = Arc::clone(&renderer.renders);
        let service = service(
            Arc::clone(&gate),
            renderer,
            None,
            ThumbnailServiceConfig::default(),
        );
        let result = service.request(ThumbnailRequest::new(
            "provider-state",
            source("provider-placeholder"),
            ThumbnailVariant::Small,
            WorkClass::Interactive,
        ));
        assert_eq!(result.unwrap_err(), expected);
        assert_eq!(renders.load(Ordering::SeqCst), 0);
        assert_eq!(gate.reads.load(Ordering::SeqCst), 0);
        assert_eq!(gate.leases.load(Ordering::SeqCst), 0);
    }
}
