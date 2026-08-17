use super::*;

#[test]
fn variant_mapping_is_bounded_and_stable() {
    assert_eq!(ThumbnailVariant::Small.pixels(), 96);
    assert_eq!(ThumbnailVariant::Medium.pixels(), 256);
    assert_eq!(ThumbnailVariant::Large.pixels(), 512);
    assert!(ThumbnailVariant::Large.is_bounded());
}

#[test]
fn malformed_ids_and_path_like_authority_are_rejected() {
    let gate = Arc::new(FakeGate::new("v1"));
    let renderer = Arc::new(FakeRenderer::new(true));
    let service = service(gate, renderer, None, ThumbnailServiceConfig::default());
    let empty = ThumbnailRequest::new(
        "",
        source("file"),
        ThumbnailVariant::Small,
        WorkClass::Interactive,
    );
    assert_eq!(
        service.request(empty).unwrap_err(),
        ThumbnailError::InvalidRequest
    );
    let path = ThumbnailRequest::new(
        "request",
        source("C:\\Users\\user\\file.png"),
        ThumbnailVariant::Small,
        WorkClass::Interactive,
    );
    assert_eq!(
        service.request(path).unwrap_err(),
        ThumbnailError::InvalidRequest
    );
    let missing_generation = ThumbnailRequest::new(
        "ephemeral-request",
        EntryRef::Ephemeral {
            browse_session_id: "browse".to_string(),
            entry_id: "entry".to_string(),
        },
        ThumbnailVariant::Small,
        WorkClass::Interactive,
    );
    assert_eq!(
        service.request(missing_generation).unwrap_err(),
        ThumbnailError::InvalidRequest
    );
}
