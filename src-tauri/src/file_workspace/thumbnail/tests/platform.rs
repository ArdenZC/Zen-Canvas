use super::*;

#[cfg(not(target_os = "macos"))]
#[test]
fn non_macos_quick_look_adapter_is_explicitly_unsupported() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("repository root")
        .join(".tmp-tests")
        .join("thumbnail-non-macos")
        .join(uuid::Uuid::new_v4().to_string());
    let gate = Arc::new(FakeGate::new("v1"));
    let renderer = Arc::new(MacQuickLookThumbnailRenderer::new(
        crate::platform::macos::quick_look::MacThumbnailService::new(root.clone()),
    ));
    let service = service(
        gate,
        renderer,
        Some(root.clone()),
        ThumbnailServiceConfig::default(),
    );
    let result = service
        .request(ThumbnailRequest::new(
            "unsupported-native",
            source("native-file"),
            ThumbnailVariant::Small,
            WorkClass::Interactive,
        ))
        .expect("request")
        .join();
    assert_eq!(result.unwrap_err(), ThumbnailError::UnsupportedRenderer);
    fs::remove_dir_all(root).expect("thumbnail cache cleanup");
}
