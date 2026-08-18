use super::*;

#[test]
fn ephemeral_identity_never_writes_disk_and_durable_cache_reuses_verified_version() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("repository root")
        .join(".tmp-tests")
        .join("thumbnail-cache")
        .join(uuid::Uuid::new_v4().to_string());
    let config = ThumbnailServiceConfig {
        worker_count: 1,
        ..ThumbnailServiceConfig::default()
    };
    let gate = Arc::new(FakeGate::new("same-version"));
    let renderer = Arc::new(FakeRenderer::new(false));
    let service = ThumbnailService::new(
        gate.clone(),
        scheduler(),
        renderer.clone(),
        Some(root.clone()),
        config.clone(),
    )
    .expect("service");
    let ephemeral = ThumbnailRequest::new(
        "ephemeral",
        EntryRef::Ephemeral {
            browse_session_id: "browse".to_string(),
            entry_id: "entry".to_string(),
        },
        ThumbnailVariant::Small,
        WorkClass::Interactive,
    )
    .with_authoritative_source_generation("generation-1");
    service
        .request(ephemeral)
        .expect("ephemeral")
        .join()
        .expect("result");
    assert_eq!(fs::read_dir(&root).expect("cache root").count(), 0);
    let durable = ThumbnailRequest::new(
        "durable-1",
        source("managed-file"),
        ThumbnailVariant::Small,
        WorkClass::Interactive,
    );
    service
        .request(durable.clone())
        .expect("durable")
        .join()
        .expect("result");
    let second_service = ThumbnailService::new(
        gate,
        scheduler(),
        renderer.clone(),
        Some(root.clone()),
        config,
    )
    .expect("second service");
    let before = renderer.renders.load(Ordering::SeqCst);
    second_service
        .request(ThumbnailRequest {
            request_id: "durable-2".to_string(),
            ..durable
        })
        .expect("cache request")
        .join()
        .expect("cache result");
    assert_eq!(renderer.renders.load(Ordering::SeqCst), before);
    fs::remove_dir_all(root).expect("thumbnail cache cleanup");
}

#[test]
fn source_version_change_rejects_output_and_does_not_poison_memory_cache() {
    let gate = Arc::new(FakeGate::new("v1"));
    let renderer = Arc::new(FakeRenderer::new(false));
    let renders = Arc::clone(&renderer.renders);
    let service = service(
        Arc::clone(&gate),
        Arc::clone(&renderer),
        None,
        ThumbnailServiceConfig::default(),
    );
    let request = ThumbnailRequest::new(
        "version-one",
        source("file"),
        ThumbnailVariant::Large,
        WorkClass::Interactive,
    );
    service
        .request(request.clone())
        .expect("first request")
        .join()
        .expect("first result");
    *lock(&gate.version) = "v2".to_string();
    service
        .request(ThumbnailRequest::new(
            "version-two",
            request.source,
            request.variant,
            request.work_class,
        ))
        .expect("changed-version request")
        .join()
        .expect("changed-version result");
    assert_eq!(renders.load(Ordering::SeqCst), 2);
    assert_eq!(service.memory_cache_len(), 2);
}

#[test]
fn durable_source_version_and_renderer_version_changes_miss_old_cache() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("repository root")
        .join(".tmp-tests")
        .join("thumbnail-version-cache")
        .join(uuid::Uuid::new_v4().to_string());
    let gate = Arc::new(FakeGate::new("v1"));
    let renderer = Arc::new(FakeRenderer::new(false));
    let service = ThumbnailService::new(
        gate.clone(),
        scheduler(),
        renderer.clone(),
        Some(root.clone()),
        ThumbnailServiceConfig::default(),
    )
    .expect("service");
    let request = ThumbnailRequest::new(
        "version-1",
        source("same-managed-file"),
        ThumbnailVariant::Medium,
        WorkClass::Interactive,
    );
    service
        .request(request.clone())
        .expect("first")
        .join()
        .expect("result");
    let first_render_count = renderer.renders.load(Ordering::SeqCst);
    *lock(&gate.version) = "v2".to_string();
    service
        .request(ThumbnailRequest {
            request_id: "version-2".to_string(),
            ..request.clone()
        })
        .expect("changed-version request")
        .join()
        .expect("changed-version result");
    assert_eq!(
        renderer.renders.load(Ordering::SeqCst),
        first_render_count + 1
    );

    let renderer_v2 = Arc::new(FakeRenderer::new(false).with_version("2"));
    let service_v2 = ThumbnailService::new(
        gate,
        scheduler(),
        renderer_v2.clone(),
        Some(root.clone()),
        ThumbnailServiceConfig::default(),
    )
    .expect("new renderer service");
    service_v2
        .request(ThumbnailRequest {
            request_id: "renderer-version-2".to_string(),
            ..request
        })
        .expect("renderer-version request")
        .join()
        .expect("renderer-version result");
    assert_eq!(renderer_v2.renders.load(Ordering::SeqCst), 1);
    fs::remove_dir_all(root).expect("thumbnail cache cleanup");
}

#[test]
fn memory_and_disk_cache_limits_evict_oldest_valid_entries() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("repository root")
        .join(".tmp-tests")
        .join("thumbnail-eviction")
        .join(uuid::Uuid::new_v4().to_string());
    let gate = Arc::new(FakeGate::new("v1"));
    let renderer = Arc::new(FakeRenderer::new(false));
    let config = ThumbnailServiceConfig {
        memory_max_entries: 1,
        memory_max_bytes: 3,
        disk_max_entries: 1,
        disk_max_bytes: 3,
        ..ThumbnailServiceConfig::default()
    };
    let service = ThumbnailService::new(gate, scheduler(), renderer, Some(root.clone()), config)
        .expect("service");
    for (index, file) in ["evict-1", "evict-2"].into_iter().enumerate() {
        service
            .request(ThumbnailRequest::new(
                format!("evict-{index}"),
                source(file),
                ThumbnailVariant::Small,
                WorkClass::Interactive,
            ))
            .expect("eviction request")
            .join()
            .expect("eviction result");
    }
    assert_eq!(service.memory_cache_len(), 1);
    let disk_entries = fs::read_dir(&root)
        .expect("cache root")
        .filter_map(Result::ok)
        .filter(|entry| entry.path().extension().and_then(|ext| ext.to_str()) == Some("thumb"))
        .count();
    assert!(disk_entries <= 1);
    fs::remove_dir_all(root).expect("thumbnail cache cleanup");
}
