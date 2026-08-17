use super::{
    types::{
        BrowseCancelRequest, BrowseOpenRequest, BrowseRestoreRequest,
        BrowseStartEnumerationRequest, ChangePendingRequest, ChangeStartRequest,
        PreviewCreateRequest, PreviewSessionRequest, ThumbnailRequestDto, ThumbnailVariantDto,
    },
    FileWorkspaceRuntime,
};
use crate::{
    db::Database,
    file_workspace::contracts::{PreviewHostKind, PreviewSourceRef, WorkClass, WorkspacePlatform},
    platform::macos::quick_look::MacThumbnailService,
};
use std::{fs, path::PathBuf};

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

#[test]
fn browse_restore_uses_fresh_refs_and_ephemeral_read_resolution() {
    let fixture = Fixture::new("fresh-refs");
    let runtime = fixture.runtime();
    let first = runtime
        .open_browse(open_request(&fixture))
        .expect("open browse");
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
            enumeration: crate::file_workspace::BrowseEnumerationRef {
                session_id: refreshed.session_id.clone(),
                request_id: refreshed.request_id.clone(),
                enumeration_id: refreshed.enumeration_id.clone(),
            },
        })
        .expect("cancel refreshed enumeration");
    runtime
        .dispose_change_monitor(ChangePendingRequest {
            monitor_id: monitor.monitor_id,
        })
        .expect("dispose monitor");
    runtime.dispose();
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
