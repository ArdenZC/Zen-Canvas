use super::{
    types::{
        BrowseOpenRequest, BrowseSessionRequest, BrowseStartEnumerationRequest, PreviewCreateRequest,
        PreviewSessionRequest, PreviewSwitchSourceRequest,
    },
    FileWorkspaceRuntime,
};
use crate::{
    db::Database,
    file_workspace::{
        native_preview::{
            access::{NativePreviewAccessRequest, NativePreviewAccessResolveRequest},
            host_provided::{
                HostProvidedReadSource, HostProvidedRegistration, HostProvidedSourceError,
            },
        },
        BoundedContentRead, BrowseEntryRef, PreviewCancellation, PreviewHostKind,
        PreviewOperationContext, PreviewSourceRef, WorkspacePlatform,
    },
    platform::macos::quick_look::MacThumbnailService,
};
use std::{
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};

struct Fixture {
    root: PathBuf,
}

impl Fixture {
    fn new(name: &str) -> Self {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join(".tmp-tests")
            .join(format!("w4-01-{name}-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).expect("fixture root");
        fs::write(root.join("alpha.txt"), b"native preview alpha").expect("alpha fixture");
        fs::write(root.join("beta.txt"), b"native preview beta").expect("beta fixture");
        Self { root }
    }

    fn runtime(&self) -> FileWorkspaceRuntime {
        FileWorkspaceRuntime::new(
            Database::open(self.root.join("zen-canvas.sqlite3")).expect("database"),
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

fn open_sources(
    runtime: &FileWorkspaceRuntime,
    fixture: &Fixture,
) -> (String, PreviewSourceRef, PreviewSourceRef) {
    let opened = runtime
        .open_browse(BrowseOpenRequest {
            platform: platform(),
            routing_hint: fixture.root.to_string_lossy().into_owned(),
            display_hint: Some("W4-01 native fixture".to_string()),
        })
        .expect("open browse fixture");
    let page = runtime
        .start_enumeration(BrowseStartEnumerationRequest {
            session_id: opened.session_id.clone(),
            request_id: "w4-native-enumerate".to_string(),
            path_ref: opened.root_path_ref,
            page_size: 16,
            query: Default::default(),
        })
        .expect("enumerate fixture");

    let source_for = |name: &str| {
        let entry = page
            .entries
            .iter()
            .find(|entry| entry.name == name)
            .unwrap_or_else(|| panic!("missing fixture entry {name}"));
        match &entry.entry_ref {
            BrowseEntryRef::Ephemeral {
                browse_session_id,
                entry_id,
            } => PreviewSourceRef::Ephemeral {
                browse_session_id: browse_session_id.clone(),
                entry_id: entry_id.clone(),
            },
        }
    };

    (
        opened.session_id,
        source_for("alpha.txt"),
        source_for("beta.txt"),
    )
}

fn stage_for_preview(
    runtime: &FileWorkspaceRuntime,
    preview_id: &str,
    request_id: &str,
    source: PreviewSourceRef,
) -> PathBuf {
    let source_version = runtime
        .inner
        .read_gate
        .current_source_version(&source)
        .expect("source version");
    let context = PreviewOperationContext::for_backend_content_read(
        preview_id.to_string(),
        request_id.to_string(),
        source_version.clone(),
        PreviewCancellation::default(),
        Instant::now() + Duration::from_secs(5),
    );
    let handle = runtime
        .inner
        .native_preview_access
        .stage(
            NativePreviewAccessRequest {
                session_id: preview_id.to_string(),
                request_id: request_id.to_string(),
                source,
                source_version: source_version.clone(),
                host: PreviewHostKind::ZenFloating,
            },
            &context,
        )
        .expect("stage native preview");
    runtime
        .inner
        .native_preview_access
        .resolve(&NativePreviewAccessResolveRequest {
            token: handle.token,
            session_id: preview_id.to_string(),
            request_id: request_id.to_string(),
            source_version,
            host: PreviewHostKind::ZenFloating,
        })
        .expect("resolve staged native preview")
}

fn create_preview(
    runtime: &FileWorkspaceRuntime,
    request_id: &str,
    source: PreviewSourceRef,
) -> String {
    runtime
        .create_preview(PreviewCreateRequest {
            request_id: request_id.to_string(),
            source,
            host_kind: PreviewHostKind::ZenFloating,
        })
        .expect("create preview")
        .preview_id
}

fn assert_native_empty(runtime: &FileWorkspaceRuntime) {
    let (records, inflight, bytes) = runtime.inner.native_preview_access.counts();
    assert_eq!((records, inflight, bytes), (0, 0, 0));
}

#[test]
fn preview_cancel_dispose_and_switch_revoke_native_staging() {
    let fixture = Fixture::new("preview-lifecycle");
    let runtime = fixture.runtime();
    let (_browse_session_id, alpha, beta) = open_sources(&runtime, &fixture);

    let cancel_id = create_preview(&runtime, "cancel-request", alpha.clone());
    let cancel_path = stage_for_preview(&runtime, &cancel_id, "cancel-request", alpha.clone());
    assert!(cancel_path.is_file());
    runtime
        .cancel_preview(PreviewSessionRequest {
            preview_id: cancel_id,
        })
        .expect("cancel preview");
    assert!(!cancel_path.exists());
    assert_native_empty(&runtime);

    let dispose_id = create_preview(&runtime, "dispose-request", alpha.clone());
    let dispose_path =
        stage_for_preview(&runtime, &dispose_id, "dispose-request", alpha.clone());
    runtime
        .dispose_preview(PreviewSessionRequest {
            preview_id: dispose_id,
        })
        .expect("dispose preview");
    assert!(!dispose_path.exists());
    assert_native_empty(&runtime);

    let switch_id = create_preview(&runtime, "switch-request-a", alpha.clone());
    let switch_path = stage_for_preview(&runtime, &switch_id, "switch-request-a", alpha);
    runtime
        .switch_preview_source(PreviewSwitchSourceRequest {
            preview_id: switch_id,
            request_id: "switch-request-b".to_string(),
            source: beta,
        })
        .expect("switch preview source");
    assert!(!switch_path.exists());
    assert_native_empty(&runtime);

    assert!(runtime.dispose());
}

#[test]
fn browse_dispose_revokes_ephemeral_preview_native_staging() {
    let fixture = Fixture::new("browse-dispose");
    let runtime = fixture.runtime();
    let (browse_session_id, alpha, _) = open_sources(&runtime, &fixture);
    let preview_id = create_preview(&runtime, "browse-preview", alpha.clone());
    let staged_path = stage_for_preview(&runtime, &preview_id, "browse-preview", alpha);

    runtime
        .dispose_browse(BrowseSessionRequest { browse_session_id: browse_session_id.clone() })
        .or_else(|_| runtime.dispose_browse(BrowseSessionRequest { session_id: browse_session_id }))
        .expect("dispose browse");
    assert!(!staged_path.exists());
    assert_native_empty(&runtime);
    assert_eq!(
        runtime
            .inner
            .preview_sessions
            .lock()
            .expect("preview sessions")
            .len(),
        0
    );
    assert!(runtime.dispose());
}

struct DropTrackedSource {
    drops: Arc<AtomicUsize>,
}

impl Drop for DropTrackedSource {
    fn drop(&mut self) {
        self.drops.fetch_add(1, Ordering::AcqRel);
    }
}

impl HostProvidedReadSource for DropTrackedSource {
    fn read_bounded(
        &self,
        _offset_bytes: u64,
        _max_bytes: u32,
    ) -> Result<BoundedContentRead, HostProvidedSourceError> {
        Ok(BoundedContentRead {
            bytes: b"shell-owned".to_vec(),
            complete: true,
        })
    }
}

#[test]
fn runtime_dispose_revokes_native_and_host_provided_resources() {
    let fixture = Fixture::new("runtime-dispose");
    let runtime = fixture.runtime();
    let (_browse_session_id, alpha, _) = open_sources(&runtime, &fixture);
    let preview_id = create_preview(&runtime, "runtime-preview", alpha.clone());
    let staged_path = stage_for_preview(&runtime, &preview_id, "runtime-preview", alpha);

    let drops = Arc::new(AtomicUsize::new(0));
    runtime
        .inner
        .host_provided
        .register(HostProvidedRegistration {
            host: PreviewHostKind::WindowsPreviewHandler,
            generation_id: "runtime-host-generation".to_string(),
            source: Arc::new(DropTrackedSource {
                drops: Arc::clone(&drops),
            }),
        })
        .expect("register host-provided source");
    assert_eq!(runtime.inner.host_provided.count(), 1);

    assert!(runtime.dispose());
    assert!(!staged_path.exists());
    assert_native_empty(&runtime);
    assert_eq!(runtime.inner.host_provided.count(), 0);
    assert_eq!(drops.load(Ordering::Acquire), 1);
}
