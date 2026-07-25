use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use zen_canvas_tauri::db::Database;
use zen_canvas_tauri::global_index::{
    search_global_entries, GlobalEntryInput, GlobalVolume, INDEX_STATUS_READY,
    PROVIDER_WINDOWS_MFT_USN,
};

static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

fn test_db_path() -> PathBuf {
    let id = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
    std::env::temp_dir().join(format!(
        "zen-canvas-global-search-boundary-{}-{id}.db",
        std::process::id()
    ))
}

fn test_volume(enabled: bool) -> GlobalVolume {
    GlobalVolume {
        id: "gv_boundary".to_string(),
        platform: "windows".to_string(),
        stable_volume_id: "boundary-volume".to_string(),
        display_name: "Boundary".to_string(),
        mount_path: r"C:\Boundary\".to_string(),
        filesystem_type: "ntfs".to_string(),
        drive_kind: "fixed".to_string(),
        enabled,
        provider: PROVIDER_WINDOWS_MFT_USN.to_string(),
        index_status: INDEX_STATUS_READY.to_string(),
        last_error: None,
        journal_id: Some("1".to_string()),
        journal_cursor: Some("1".to_string()),
        last_full_index_at: Some(1),
        last_incremental_sync_at: Some(1),
        entry_count: 0,
        created_at: 1,
        updated_at: 1,
    }
}

fn test_entry() -> GlobalEntryInput {
    GlobalEntryInput {
        volume_id: "gv_boundary".to_string(),
        platform_file_id: "frn:boundary-report".to_string(),
        parent_platform_file_id: "frn:boundary-parent".to_string(),
        name: "Boundary Report.txt".to_string(),
        path: r"C:\Boundary\Boundary Report.txt".to_string(),
        extension: "txt".to_string(),
        is_directory: false,
        size: 42,
        created_at_fs: Some(1),
        modified_at_fs: Some(2),
        file_attributes: 0,
        is_hidden: false,
        is_system: false,
        source_provider: PROVIDER_WINDOWS_MFT_USN.to_string(),
        last_seen_at: 3,
    }
}

#[test]
fn disabled_volume_is_immediately_excluded_from_global_search() {
    let path = test_db_path();
    let db = Database::open(&path).expect("open database");
    db.upsert_global_volume(&test_volume(true))
        .expect("insert volume");
    db.upsert_global_entries_batch(&[test_entry()])
        .expect("insert entry");

    let enabled_results =
        search_global_entries(&db, "Boundary Report", 20, 0).expect("search enabled volume");
    assert_eq!(enabled_results.len(), 1);

    db.set_global_volume_enabled("gv_boundary", false)
        .expect("disable volume");
    let disabled_results =
        search_global_entries(&db, "Boundary Report", 20, 0).expect("search disabled volume");
    assert!(disabled_results.is_empty());

    drop(db);
    let _ = std::fs::remove_file(path);
}

#[test]
fn short_query_fallback_still_respects_volume_enablement() {
    let path = test_db_path();
    let db = Database::open(&path).expect("open database");
    db.upsert_global_volume(&test_volume(true))
        .expect("insert volume");
    db.upsert_global_entries_batch(&[test_entry()])
        .expect("insert entry");

    assert_eq!(
        search_global_entries(&db, "Bo", 20, 0)
            .expect("short enabled search")
            .len(),
        1
    );
    db.set_global_volume_enabled("gv_boundary", false)
        .expect("disable volume");
    assert!(search_global_entries(&db, "Bo", 20, 0)
        .expect("short disabled search")
        .is_empty());

    drop(db);
    let _ = std::fs::remove_file(path);
}
