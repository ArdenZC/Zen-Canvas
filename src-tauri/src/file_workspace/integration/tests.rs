use super::{
    types::{
        BrowseCancelRequest, BrowseCompletionDto, BrowseOpenRequest, BrowseRestoreRequest,
        BrowseStartEnumerationRequest, ChangePendingRequest, ChangeStartRequest,
        PreviewCreateRequest, PreviewSessionRequest, ThumbnailCancelRequest, ThumbnailRequestDto,
        ThumbnailVariantDto,
    },
    FileWorkspaceRuntime,
};
use crate::{
    db::Database,
    file_workspace::{
        contracts::{PreviewHostKind, PreviewSourceRef, WorkClass, WorkspacePlatform},
        thumbnail::{
            ThumbnailRenderContext, ThumbnailRenderOutput, ThumbnailRenderRequest,
            ThumbnailRenderer, ThumbnailRendererDescriptor, ThumbnailRendererError,
        },
    },
    platform::macos::quick_look::MacThumbnailService,
    scheduler::ResourceHints,
};
use std::{
    fs,
    path::PathBuf,
    sync::{Arc, Condvar, Mutex},
    thread,
};

struct Fixture {
    root: PathBuf,
}

impl Fixture {
    fn new(name: &str) -> Self {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join(".tmp-tests")
            .join(format!("w1-10-{name}-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).expect("fixture root");
        fs::create_dir(root.join("nested")).expect("nested directory");
        fs::write(root.join("entry.txt"), b"workspace integration").expect("fixture file");
        Self { root }
    }

    fn runtime(&self) -> FileWorkspaceRuntime {
        let database = Database::open(self.root.join("zen-canvas.sqlite3")).expect("database");
        FileWorkspaceRuntime::new(
            database,
            MacThumbnailService::new(self.root.join("legacy-thumbnail-cache")),
            self.root.join("thumbnail-cache"),
        )
        .expect("workspace runtime")
    }

    fn runtime_with_renderer(&self, renderer: Arc<dyn ThumbnailRenderer>) -> FileWorkspaceRuntime {
        let database = Database::open(self.root.join("zen-canvas-custom-thumbnail.sqlite3"))
            .expect("database");
        FileWorkspaceRuntime::new_with_thumbnail_renderer_for_test(
            database,
            renderer,
            self.root.join("custom-thumbnail-cache"),
        )
        .expect("workspace runtime")
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn platform() -> WorkspacePlatform {
    if cfg!(target_os = "windows") {
        WorkspacePlatform::Windows
    } else {
        WorkspacePlatform::Macos
    }
}

fn open_request(fixture: &Fixture) -> BrowseOpenRequest {
    BrowseOpenRequest {
        platform: platform(),
        routing_hint: fixture.root.to_string_lossy().into_owned(),
        display_hint: Some("Integration fixture".to_string()),
    }
}

#[derive(Default)]
struct RendererGate {
    state: Mutex<usize>,
    wake: Condvar,
}

impl RendererGate {
    fn mark_entered(&self) {
        let mut count = self.state.lock().expect("renderer gate lock");
        *count += 1;
        self.wake.notify_all();
    }

    fn count(&self) -> usize {
        *self.state.lock().expect("renderer gate lock")
    }

    fn wait_until_count(&self, expected: usize) {
        let mut count = self.state.lock().expect("renderer gate lock");
        while *count < expected {
            count = self.wake.wait(count).expect("renderer gate wait");
        }
    }
}

struct BlockingThumbnailRenderer {
    gate: Arc<RendererGate>,
}

impl ThumbnailRenderer for BlockingThumbnailRenderer {
    fn descriptor(&self) -> ThumbnailRendererDescriptor {
        ThumbnailRendererDescriptor::new(
            "test.blocking",
            "w1-10-integration-test-v1",
            ResourceHints {
                cpu: 1,
                io: 1,
                open_handles: 0,
                decoder: 0,
                native_preview: 0,
                provider_network: 0,
            },
        )
    }

    fn render(
        &self,
        _request: ThumbnailRenderRequest,
        context: &ThumbnailRenderContext,
    ) -> Result<ThumbnailRenderOutput, ThumbnailRendererError> {
        self.gate.mark_entered();
        while !context.is_explicitly_cancelled() {
            thread::yield_now();
        }
        Err(ThumbnailRendererError::Cancelled)
    }
}

fn assert_runtime_resources_are_empty(runtime: &FileWorkspaceRuntime) {
    let counts = runtime.resource_counts();
    assert_eq!(counts.browse_sessions, 0);
    assert_eq!(counts.change_monitors, 0);
    assert_eq!(counts.thumbnail_requests, 0);
    assert_eq!(counts.preview_sessions, 0);
    assert_eq!(counts.browse_service_sessions, 0);
}

#[test]
fn browse_restore_uses_fresh_refs_and_ephemeral_read_resolution() {
    let fixture = Fixture::new("fresh-refs");
    let runtime = fixture.runtime();
    let first = runtime
        .open_browse(open_request(&fixture))
        .expect("open browse");
    assert!(!first.location.capabilities.can_browse);
    assert!(!first.location.capabilities.can_read_metadata);
    assert!(!first.location.capabilities.can_preview);
    assert!(!first.location.capabilities.can_watch);
    assert!(!first.location.capabilities.can_request_materialization);
    assert!(!first.location.capabilities.can_add_to_library);
    let first_page = runtime
        .start_enumeration(BrowseStartEnumerationRequest {
            session_id: first.session_id.clone(),
            request_id: "request-1".to_string(),
            path_ref: first.root_path_ref.clone(),
            page_size: 16,
        })
        .expect("first page");
    let entry = first_page.entries.first().expect("fixture entry");
    let source = match &entry.entry_ref {
        crate::file_workspace::EntryRef::Ephemeral {
            browse_session_id,
            entry_id,
        } => PreviewSourceRef::Ephemeral {
            browse_session_id: browse_session_id.clone(),
            entry_id: entry_id.clone(),
        },
        crate::file_workspace::EntryRef::Managed { .. } => panic!("fixture must be ephemeral"),
    };

    assert!(runtime.inner.browse.resolve_entry(&entry.entry_ref).is_ok());
    assert_ne!(
        runtime.inner.read_gate.content_read_eligibility(&source),
        crate::file_workspace::ContentReadEligibility::SourceUnavailable
    );

    let restored = runtime
        .restore_browse(BrowseRestoreRequest {
            locator: crate::file_workspace::WorkspaceRestoreLocator::Browse {
                platform: platform(),
                routing_hint: fixture.root.to_string_lossy().into_owned(),
                display_hint: Some("Restored fixture".to_string()),
            },
        })
        .expect("restore browse");
    assert_ne!(first.session_id, restored.session_id);
    assert_ne!(first.root_path_ref, restored.root_path_ref);

    runtime
        .dispose_browse(super::types::BrowseSessionRequest {
            session_id: first.session_id.clone(),
        })
        .expect("dispose first");
    assert!(runtime
        .inner
        .browse
        .resolve_entry(&entry.entry_ref)
        .is_err());
    runtime.dispose();
}

#[test]
fn integration_known_count_is_present_only_after_complete_enumeration() {
    let fixture = Fixture::new("known-count-parity");
    let runtime = fixture.runtime();
    let opened = runtime
        .open_browse(open_request(&fixture))
        .expect("open browse");
    let partial = runtime
        .start_enumeration(BrowseStartEnumerationRequest {
            session_id: opened.session_id.clone(),
            request_id: "known-count".to_string(),
            path_ref: opened.root_path_ref.clone(),
            page_size: 1,
        })
        .expect("partial page");
    assert_eq!(partial.completion, BrowseCompletionDto::Partial);
    assert_eq!(partial.known_count, None);

    let mut complete = partial;
    while complete.completion == BrowseCompletionDto::Partial {
        complete = runtime
            .next_page(super::types::BrowseNextPageRequest {
                session_id: opened.session_id.clone(),
                cursor: complete.next_cursor.take().expect("partial cursor"),
                page_size: 1,
            })
            .expect("next page");
        if complete.completion == BrowseCompletionDto::Partial {
            assert_eq!(complete.known_count, None);
        }
    }
    assert_eq!(complete.completion, BrowseCompletionDto::Complete);
    assert!(complete.known_count.is_some());
    runtime.dispose();
}

#[test]
fn integration_cancel_entrypoint_cancels_real_in_flight_browse_request() {
    let fixture = Fixture::new("browse-cancellation");
    let runtime = fixture.runtime();
    let opened = runtime
        .open_browse(open_request(&fixture))
        .expect("open browse");
    let gate = Arc::new(super::super::browse::TestPublishGate::default());
    runtime
        .inner
        .browse
        .set_test_publish_gate(Arc::clone(&gate));

    let worker_runtime = runtime.clone();
    let session_id = opened.session_id.clone();
    let path_ref = opened.root_path_ref.clone();
    let worker = thread::spawn(move || {
        worker_runtime.start_enumeration(BrowseStartEnumerationRequest {
            session_id,
            request_id: "in-flight-cancel".to_string(),
            path_ref,
            page_size: 1,
        })
    });
    gate.wait_until_reached();

    runtime
        .cancel_enumeration(BrowseCancelRequest {
            session_id: opened.session_id,
            enumeration: None,
            request_id: Some("in-flight-cancel".to_string()),
        })
        .expect("cancel pending enumeration");
    gate.release();

    assert_eq!(
        worker.join().expect("browse worker join"),
        Err("browse_cancelled".to_string())
    );
    runtime.dispose();
    assert_runtime_resources_are_empty(&runtime);
}

#[test]
fn change_monitor_and_preview_reuse_ephemeral_browse_refs() {
    let fixture = Fixture::new("change-preview");
    let runtime = fixture.runtime();
    let opened = runtime
        .open_browse(open_request(&fixture))
        .expect("open browse");
    let monitor = runtime
        .start_change_monitor(ChangeStartRequest {
            session_id: opened.session_id.clone(),
            path_ref: opened.root_path_ref.clone(),
        })
        .expect("start monitor");
    assert!(runtime
        .pending_change(ChangePendingRequest {
            monitor_id: monitor.monitor_id.clone(),
        })
        .expect("pending")
        .is_none());

    let entry_page = runtime
        .start_enumeration(BrowseStartEnumerationRequest {
            session_id: opened.session_id,
            request_id: "preview-request".to_string(),
            path_ref: opened.root_path_ref,
            page_size: 16,
        })
        .expect("entry page");
    let entry = entry_page.entries.first().expect("entry");
    let source = match &entry.entry_ref {
        crate::file_workspace::EntryRef::Ephemeral {
            browse_session_id,
            entry_id,
        } => PreviewSourceRef::Ephemeral {
            browse_session_id: browse_session_id.clone(),
            entry_id: entry_id.clone(),
        },
        crate::file_workspace::EntryRef::Managed { .. } => panic!("fixture must be ephemeral"),
    };
    let preview = runtime
        .create_preview(PreviewCreateRequest {
            request_id: "preview-request".to_string(),
            source,
            host_kind: PreviewHostKind::ZenFloating,
        })
        .expect("create preview");
    let started = runtime
        .start_preview(PreviewSessionRequest {
            preview_id: preview.preview_id.clone(),
        })
        .expect("metadata preview");
    assert_eq!(started.state, super::types::PreviewSessionStateDto::Ready);
    assert!(matches!(
        started
            .representation
            .as_ref()
            .map(|value| &value.representation),
        Some(crate::file_workspace::PreviewRepresentation::Metadata { .. })
    ));
    runtime
        .dispose_change_monitor(ChangePendingRequest {
            monitor_id: monitor.monitor_id,
        })
        .expect("dispose monitor");
    runtime
        .dispose_preview(PreviewSessionRequest {
            preview_id: preview.preview_id,
        })
        .expect("dispose preview");
    runtime.dispose();
}

#[test]
fn runtime_owned_resources_return_to_steady_state_after_repeated_target_teardown() {
    let fixture = Fixture::new("bounded-target-lifecycle");
    let runtime = fixture.runtime();

    for index in 0..8 {
        let opened = runtime
            .open_browse(open_request(&fixture))
            .expect("open browse target");
        let page = runtime
            .start_enumeration(BrowseStartEnumerationRequest {
                session_id: opened.session_id.clone(),
                request_id: format!("lifecycle-{index}"),
                path_ref: opened.root_path_ref.clone(),
                page_size: 16,
            })
            .expect("browse page");
        let entry = page
            .entries
            .iter()
            .find(|entry| entry.kind == super::types::BrowseEntryKindDto::File)
            .expect("file entry");
        let source = match &entry.entry_ref {
            crate::file_workspace::EntryRef::Ephemeral {
                browse_session_id,
                entry_id,
            } => PreviewSourceRef::Ephemeral {
                browse_session_id: browse_session_id.clone(),
                entry_id: entry_id.clone(),
            },
            crate::file_workspace::EntryRef::Managed { .. } => panic!("fixture must be ephemeral"),
        };
        runtime
            .start_change_monitor(ChangeStartRequest {
                session_id: opened.session_id.clone(),
                path_ref: opened.root_path_ref.clone(),
            })
            .expect("change monitor");
        runtime
            .create_preview(PreviewCreateRequest {
                request_id: format!("preview-{index}"),
                source,
                host_kind: PreviewHostKind::ZenFloating,
            })
            .expect("preview session");

        let counts = runtime.resource_counts();
        assert!(counts.browse_sessions <= 1);
        assert!(counts.browse_service_sessions <= 1);
        assert!(counts.change_monitors <= 1);
        assert!(counts.preview_sessions <= 1);
        assert!(counts.thumbnail_requests <= 1);

        runtime
            .dispose_browse(super::types::BrowseSessionRequest {
                session_id: opened.session_id,
            })
            .expect("dispose target");
        assert_runtime_resources_are_empty(&runtime);
    }

    runtime.dispose();
    assert_runtime_resources_are_empty(&runtime);
}

#[test]
fn change_hint_invalidates_old_page_and_refreshes_through_browse_service() {
    let fixture = Fixture::new("change-refresh");
    let runtime = fixture.runtime();
    let opened = runtime
        .open_browse(open_request(&fixture))
        .expect("open browse");
    let page = runtime
        .start_enumeration(BrowseStartEnumerationRequest {
            session_id: opened.session_id.clone(),
            request_id: "before-change".to_string(),
            path_ref: opened.root_path_ref.clone(),
            page_size: 1,
        })
        .expect("page before change");
    let monitor = runtime
        .start_change_monitor(ChangeStartRequest {
            session_id: opened.session_id.clone(),
            path_ref: opened.root_path_ref,
        })
        .expect("monitor");
    let monitor_handle = runtime
        .inner
        .monitors
        .lock()
        .expect("monitor registry")
        .get(&monitor.monitor_id)
        .expect("monitor handle")
        .monitor
        .clone();
    monitor_handle.inject_hint_for_integration_test(
        crate::file_workspace::change::EphemeralChangeKind::ContentChanged,
    );
    let pending = runtime
        .pending_change(ChangePendingRequest {
            monitor_id: monitor.monitor_id.clone(),
        })
        .expect("pending change")
        .expect("coalesced hint");
    let serialized = serde_json::to_string(&pending).expect("pending JSON");
    assert!(!serialized.contains("path"));
    let cursor = page.next_cursor.expect("cursor before change");
    let old_page_error = runtime
        .next_page(super::types::BrowseNextPageRequest {
            session_id: opened.session_id.clone(),
            cursor,
            page_size: 1,
        })
        .expect_err("old page must be stale");
    assert_eq!(old_page_error, "browse_enumeration_stale");
    let refreshed = runtime
        .refresh_change(super::types::ChangeRefreshRequest {
            monitor_id: monitor.monitor_id.clone(),
            request_id: "after-change".to_string(),
            page_size: 1,
        })
        .expect("fresh page");
    assert_eq!(refreshed.request_id, "after-change");
    runtime
        .cancel_enumeration(BrowseCancelRequest {
            session_id: refreshed.session_id.clone(),
            enumeration: Some(crate::file_workspace::BrowseEnumerationRef {
                session_id: refreshed.session_id.clone(),
                request_id: refreshed.request_id.clone(),
                enumeration_id: refreshed.enumeration_id.clone(),
            }),
            request_id: None,
        })
        .expect("cancel refreshed enumeration");
    runtime
        .dispose_change_monitor(ChangePendingRequest {
            monitor_id: monitor.monitor_id,
        })
        .expect("dispose monitor");
    runtime.dispose();
}

#[test]
fn thumbnail_registry_reserves_before_service_and_cancels_reserved_running_and_completed() {
    let fixture = Fixture::new("thumbnail-registry-race");
    let renderer_gate = Arc::new(RendererGate::default());
    let runtime = fixture.runtime_with_renderer(Arc::new(BlockingThumbnailRenderer {
        gate: Arc::clone(&renderer_gate),
    }));
    let opened = runtime
        .open_browse(open_request(&fixture))
        .expect("open browse");
    let page = runtime
        .start_enumeration(BrowseStartEnumerationRequest {
            session_id: opened.session_id.clone(),
            request_id: "thumbnail-source".to_string(),
            path_ref: opened.root_path_ref.clone(),
            page_size: 16,
        })
        .expect("source page");
    let source = page
        .entries
        .iter()
        .find(|entry| entry.kind == super::types::BrowseEntryKindDto::File)
        .expect("file source entry")
        .entry_ref
        .clone();
    let request_for = move |request_id: &str| ThumbnailRequestDto {
        request_id: request_id.to_string(),
        source: source.clone(),
        variant: ThumbnailVariantDto::Small,
        work_class: WorkClass::Interactive,
        session_id: Some(opened.session_id.clone()),
        source_generation: Some(page.enumeration_id.clone()),
    };

    let reservation_gate = Arc::new(super::runtime::ThumbnailReservationGate::default());
    runtime.set_thumbnail_reservation_gate(Arc::clone(&reservation_gate));
    let first_id = "thumbnail-reserved";
    let first_runtime = runtime.clone();
    let first_request = request_for(first_id);
    let first_worker = thread::spawn(move || first_runtime.request_thumbnail(first_request));
    reservation_gate.wait_until_reached();

    assert_eq!(
        runtime
            .request_thumbnail(request_for(first_id))
            .expect_err("duplicate request must be rejected"),
        "thumbnail_request_in_flight"
    );
    assert_eq!(
        runtime.resource_counts().thumbnail_requests,
        1,
        "duplicate must not create a second owner"
    );
    assert!(runtime
        .cancel_thumbnail(ThumbnailCancelRequest {
            request_id: first_id.to_string(),
        })
        .expect("cancel reserved request"));
    assert!(!runtime
        .cancel_thumbnail(ThumbnailCancelRequest {
            request_id: first_id.to_string(),
        })
        .expect("duplicate reserved cancel"));
    reservation_gate.release();
    assert_eq!(
        first_worker.join().expect("reserved worker join"),
        Err("thumbnail_request_cancelled".to_string())
    );
    assert!(!runtime
        .cancel_thumbnail(ThumbnailCancelRequest {
            request_id: first_id.to_string(),
        })
        .expect("completed reserved cancel"));

    let second_id = "thumbnail-running";
    let renderer_count_before = renderer_gate.count();
    let second_runtime = runtime.clone();
    let second_worker =
        thread::spawn(move || second_runtime.request_thumbnail(request_for(second_id)));
    renderer_gate.wait_until_count(renderer_count_before + 1);
    assert!(runtime
        .cancel_thumbnail(ThumbnailCancelRequest {
            request_id: second_id.to_string(),
        })
        .expect("cancel running request"));
    assert!(!runtime
        .cancel_thumbnail(ThumbnailCancelRequest {
            request_id: second_id.to_string(),
        })
        .expect("duplicate running cancel"));
    assert_eq!(
        second_worker.join().expect("running worker join"),
        Err("thumbnail_request_cancelled".to_string())
    );
    assert!(!runtime
        .cancel_thumbnail(ThumbnailCancelRequest {
            request_id: second_id.to_string(),
        })
        .expect("completed running cancel"));

    for _ in 0..1000 {
        if runtime.inner.thumbnail.active_request_count() == 0 {
            break;
        }
        thread::yield_now();
    }
    assert_eq!(runtime.inner.thumbnail.active_request_count(), 0);
    runtime.dispose();
    assert_runtime_resources_are_empty(&runtime);
}

#[test]
fn thumbnail_ipc_response_is_bounded_binary_and_path_free() {
    let payload =
        super::types::encode_thumbnail_ipc_response(&super::types::ThumbnailArtifactDto {
            cache_key: "logical-cache-key".to_string(),
            bytes: vec![1, 2, 3, 4],
        })
        .expect("binary thumbnail payload");
    assert_eq!(&payload[..4], b"ZCTH");
    assert_eq!(payload[4], 1);
    assert!(!payload.starts_with(b"{"));
    assert!(payload
        .windows(b"logical-cache-key".len())
        .any(|window| { window == b"logical-cache-key" }));
    assert!(
        super::types::encode_thumbnail_ipc_response(&super::types::ThumbnailArtifactDto {
            cache_key: "key".to_string(),
            bytes: vec![0; super::types::THUMBNAIL_IPC_MAX_BYTES + 1],
        })
        .is_err()
    );
}

#[cfg(not(target_os = "macos"))]
#[test]
fn shared_thumbnail_surface_is_explicitly_unsupported_without_native_renderer() {
    let fixture = Fixture::new("thumbnail-unsupported");
    let runtime = fixture.runtime();
    let opened = runtime
        .open_browse(open_request(&fixture))
        .expect("open browse");
    let page = runtime
        .start_enumeration(BrowseStartEnumerationRequest {
            session_id: opened.session_id.clone(),
            request_id: "thumbnail-request".to_string(),
            path_ref: opened.root_path_ref,
            page_size: 16,
        })
        .expect("page");
    let entry = page.entries.first().expect("entry");
    let error = runtime
        .request_thumbnail(ThumbnailRequestDto {
            request_id: "thumbnail-request".to_string(),
            source: entry.entry_ref.clone(),
            variant: ThumbnailVariantDto::Small,
            work_class: WorkClass::Interactive,
            session_id: Some(opened.session_id),
            source_generation: Some(page.enumeration_id),
        })
        .expect_err("non-mac renderer must fail closed");
    assert_eq!(error, "thumbnail_renderer_unsupported");
    runtime.dispose();
}
