mod metrics;

use super::{
    types::{BrowseOpenRequest, BrowseStartEnumerationRequest},
    FileWorkspaceRuntime,
};
use crate::{
    db::Database,
    file_workspace::contracts::WorkspacePlatform,
    platform::macos::quick_look::MacThumbnailService,
};
use serde_json::json;
use std::{
    fs,
    path::{Path, PathBuf},
};

struct Fixture {
    root: PathBuf,
}

impl Fixture {
    fn new() -> Self {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("repository root")
            .join(".tmp-performance-fixtures")
            .join("workspace-foundation")
            .join(format!("smoke-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).expect("create workspace performance fixture root");
        fs::create_dir(root.join("nested")).expect("create workspace performance nested fixture");
        fs::write(root.join("entry.txt"), []).expect("create workspace performance file fixture");
        Self { root }
    }

    fn path(&self) -> &Path {
        &self.root
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
    } else if cfg!(target_os = "macos") {
        WorkspacePlatform::Macos
    } else {
        panic!("File Workspace performance harness is unsupported on this platform")
    }
}

#[test]
#[ignore = "W1-11 File Workspace/Foundation performance harness"]
fn harness_smoke() {
    let fixture = Fixture::new();
    let runtime = FileWorkspaceRuntime::new(
        Database::open(fixture.path().join("zen-canvas.sqlite3")).expect("open harness database"),
        MacThumbnailService::new(fixture.path().join("legacy-thumbnail-cache")),
        fixture.path().join("thumbnail-cache"),
    )
    .expect("create File Workspace runtime");

    let opened = runtime
        .open_browse(BrowseOpenRequest {
            platform: platform(),
            routing_hint: fixture.path().to_string_lossy().into_owned(),
            display_hint: Some("W1-11 harness".to_string()),
        })
        .expect("admit real filesystem fixture");
    let page = runtime
        .start_enumeration(BrowseStartEnumerationRequest {
            session_id: opened.session_id.clone(),
            request_id: "workspace-foundation-smoke".to_string(),
            path_ref: opened.root_path_ref,
            page_size: 2,
        })
        .expect("enumerate first useful page");
    assert!(!page.entries.is_empty(), "real fixture should publish a first page");
    assert!(page.entries.iter().all(|entry| {
        matches!(
            entry.entry_ref,
            crate::file_workspace::EntryRef::Ephemeral { .. }
        )
    }));
    assert!(runtime.dispose());

    metrics::emit_metric(
        "harness_smoke",
        metrics::HARD_PASS,
        [
            ("fixture_entries".to_string(), json!(3)),
            ("requested_page_size".to_string(), json!(2)),
            ("published_entries".to_string(), json!(page.entries.len())),
            ("fixture_root_scope".to_string(), json!("repository-local")),
            ("raw_path_authority".to_string(), json!(false)),
        ],
    );
}
