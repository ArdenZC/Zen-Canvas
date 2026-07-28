use super::*;
use crate::db::Database;
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Barrier};
use std::time::Instant;

static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);
const GLOBAL_SEARCH_P95_LIMIT_MS: f64 = 100.0;

fn test_db_path() -> PathBuf {
    let id = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
    std::env::temp_dir().join(format!(
        "zen-canvas-global-index-{}-{id}.db",
        std::process::id()
    ))
}

fn test_volume() -> GlobalVolume {
    GlobalVolume {
        id: "gv_test".to_string(),
        platform: "windows".to_string(),
        stable_volume_id: "test-volume".to_string(),
        display_name: "Test volume".to_string(),
        mount_path: r"C:\Global\".to_string(),
        filesystem_type: "ntfs".to_string(),
        drive_kind: "fixed".to_string(),
        enabled: true,
        provider: PROVIDER_WINDOWS_MFT_USN.to_string(),
        index_status: INDEX_STATUS_DISCOVERED.to_string(),
        last_error: None,
        journal_id: None,
        journal_cursor: None,
        last_full_index_at: None,
        last_incremental_sync_at: None,
        entry_count: 0,
        created_at: 1,
        updated_at: 1,
    }
}

fn test_entry(path: &str, name: &str, is_directory: bool) -> GlobalEntryInput {
    GlobalEntryInput {
        volume_id: "gv_test".to_string(),
        platform_file_id: format!("frn:{path}"),
        parent_platform_file_id: "frn:parent".to_string(),
        name: name.to_string(),
        path: path.to_string(),
        extension: if is_directory {
            String::new()
        } else {
            "txt".to_string()
        },
        is_directory,
        size: if is_directory { 0 } else { 1024 },
        created_at_fs: Some(10),
        modified_at_fs: Some(20),
        file_attributes: 0,
        is_hidden: false,
        is_system: false,
        source_provider: PROVIDER_WINDOWS_MFT_USN.to_string(),
        last_seen_at: 30,
    }
}

#[test]
fn stable_entry_id_uses_native_identity_without_path_coupling() {
    let original = stable_entry_id(
        "gv_test",
        "mac:dev:1:ino:2",
        "mac:dev:1:ino:1",
        "note.txt",
        "/Users/test/note.txt",
    );
    let moved = stable_entry_id(
        "gv_test",
        "mac:dev:1:ino:2",
        "mac:dev:1:ino:1",
        "note.txt",
        "/Users/test/archive/note.txt",
    );
    assert_eq!(original, moved);

    let path_based = stable_entry_id(
        "gv_test",
        "path:/Users/test/note.txt",
        "path:/Users/test",
        "note.txt",
        "/Users/test/note.txt",
    );
    let path_moved = stable_entry_id(
        "gv_test",
        "path:/Users/test/note.txt",
        "path:/Users/test",
        "note.txt",
        "/Users/test/archive/note.txt",
    );
    assert_ne!(path_based, path_moved);
}

#[test]
fn mac_native_identity_survives_parent_and_name_changes() {
    let before = stable_entry_id(
        "gv_test",
        "mac:dev:1:ino:2",
        "mac:dev:1:ino:1",
        "note.txt",
        "/Users/test/note.txt",
    );
    let after = stable_entry_id(
        "gv_test",
        "mac:dev:1:ino:2",
        "mac:dev:1:ino:9",
        "renamed.txt",
        "/Users/test/archive/renamed.txt",
    );
    assert_eq!(before, after);
}

#[test]
fn migration_creates_global_and_managed_domains_separately() {
    let path = test_db_path();
    let db = Database::open(&path).expect("open test database");
    let conn = Connection::open(&path).expect("open migrated database");
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_schema WHERE type = 'table' AND name IN ('global_volumes', 'global_entries', 'global_entries_fts', 'managed_scopes', 'managed_entries', 'ai_analysis_state', 'ai_jobs', 'ai_job_items')",
            [],
            |row| row.get(0),
        )
        .expect("global schema tables");
    assert_eq!(count, 8);
    let version: i32 = conn
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .expect("schema version");
    assert_eq!(version, 30);
    drop(conn);
    drop(db);
    let _ = std::fs::remove_file(path);
}

#[test]
fn global_search_is_independent_from_legacy_files_and_ai_is_scope_gated() {
    let path = test_db_path();
    let db = Database::open(&path).expect("open test database");
    db.upsert_global_volume(&test_volume())
        .expect("insert global volume");
    let directory = test_entry(r"C:\Global\Reports", "Reports", true);
    let document = test_entry(r"C:\Global\Reports\报告.txt", "报告.txt", false);
    db.upsert_global_entries_batch(&[directory, document.clone()])
        .expect("insert global entries");

    let collecting_status = db.global_index_status().expect("collecting status");
    assert_eq!(collecting_status.processed_entries, 2);
    assert!(!collecting_status.collection_complete);

    let results = db
        .search_global_entries("报告", 20, 0)
        .expect("global search");
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].path, document.path);
    assert!(!results[0].managed);

    let conn = Connection::open(&path).expect("inspect isolated tables");
    let legacy_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM files", [], |row| row.get(0))
        .expect("legacy files count");
    assert_eq!(legacy_count, 0);
    drop(conn);

    let scope = db
        .add_managed_scope(AddManagedScopeRequest {
            path: r"C:\Global\Reports".to_string(),
            global_entry_id: None,
            enabled: true,
            allow_local_ai: true,
            allow_cloud_ai: false,
        })
        .expect("add managed scope");
    assert!(scope.enabled);
    let managed_results = db
        .search_global_entries("报告", 20, 0)
        .expect("managed global search");
    assert!(managed_results[0].managed);

    let conn = Connection::open(&path).expect("inspect managed tables");
    let managed_entries: i64 = conn
        .query_row("SELECT COUNT(*) FROM managed_entries", [], |row| row.get(0))
        .expect("managed entry count");
    let ai_jobs: i64 = conn
        .query_row("SELECT COUNT(*) FROM ai_jobs", [], |row| row.get(0))
        .expect("AI job count");
    let ai_states: i64 = conn
        .query_row("SELECT COUNT(*) FROM ai_analysis_state", [], |row| {
            row.get(0)
        })
        .expect("AI analysis state count");
    assert_eq!(managed_entries, 2);
    assert_eq!(ai_jobs, 1);
    assert_eq!(ai_states, 1);

    db.update_global_volume_state(
        "gv_test",
        INDEX_STATUS_READY,
        None,
        None,
        None,
        Some(40),
        Some(40),
    )
    .expect("mark volume ready");
    let completed_status = db.global_index_status().expect("completed status");
    assert_eq!(completed_status.status, INDEX_STATUS_READY);
    assert!(completed_status.collection_complete);
    drop(conn);
    drop(db);
    let _ = std::fs::remove_file(path);
}

#[test]
fn global_search_ranking_is_exact_then_prefix_then_extension_with_stable_id_ties() {
    let path = test_db_path();
    let db = Database::open(&path).expect("open test database");
    db.upsert_global_volume(&test_volume())
        .expect("insert global volume");

    let mut exact = test_entry(r"C:\Global\r", "r", false);
    exact.platform_file_id = "identity-exact".to_string();
    exact.modified_at_fs = Some(20);
    let mut prefix_b = test_entry(r"C:\Global\report-b.txt", "report-b.txt", false);
    prefix_b.platform_file_id = "identity-prefix-b".to_string();
    prefix_b.modified_at_fs = Some(10);
    let mut prefix_a = test_entry(r"C:\Global\report-a.txt", "report-a.txt", false);
    prefix_a.platform_file_id = "identity-prefix-a".to_string();
    prefix_a.modified_at_fs = Some(10);
    let prefix_a_id = prefix_a.entry_id();
    let prefix_b_id = prefix_b.entry_id();
    let mut extension = test_entry(r"C:\Global\archive.r", "archive.r", false);
    extension.platform_file_id = "identity-extension".to_string();
    extension.extension = "r".to_string();
    extension.modified_at_fs = Some(9);
    let mut extension_prefix = test_entry(r"C:\Global\archive.rust", "archive.rust", false);
    extension_prefix.platform_file_id = "identity-extension-prefix".to_string();
    extension_prefix.extension = "rust".to_string();
    extension_prefix.modified_at_fs = Some(8);

    db.upsert_global_entries_batch(&[prefix_b, extension, exact, prefix_a, extension_prefix])
        .expect("insert ranked entries");
    let results = db.search_global_entries("r", 20, 0).expect("ranked search");
    assert_eq!(results.len(), 5);
    assert_eq!(results[0].name, "r");
    let mut expected_prefix_ids = vec![prefix_a_id, prefix_b_id];
    expected_prefix_ids.sort();
    assert_eq!(
        results[1..3]
            .iter()
            .map(|entry| entry.id.clone())
            .collect::<Vec<_>>(),
        expected_prefix_ids
    );
    assert_eq!(results[3].name, "archive.r");
    assert_eq!(results[4].name, "archive.rust");
    let result_ids = results
        .iter()
        .map(|entry| entry.id.clone())
        .collect::<Vec<_>>();
    assert_eq!(
        result_ids
            .iter()
            .collect::<std::collections::HashSet<_>>()
            .len(),
        result_ids.len(),
        "layer union must not duplicate an entry"
    );
    let limited = db
        .search_global_entries("r", 3, 0)
        .expect("bounded ranked search");
    assert_eq!(
        limited
            .iter()
            .map(|entry| entry.name.as_str())
            .collect::<Vec<_>>(),
        vec!["r", results[1].name.as_str(), results[2].name.as_str()]
    );
    let page_after_prefix = db
        .search_global_entries("r", 20, 2)
        .expect("offset in deduplicated tier stream");
    assert_eq!(
        page_after_prefix
            .iter()
            .map(|entry| entry.name.as_str())
            .collect::<Vec<_>>(),
        results[2..]
            .iter()
            .map(|entry| entry.name.as_str())
            .collect::<Vec<_>>()
    );
    let prefix_results = db
        .search_global_entries("rep", 20, 0)
        .expect("prefix search");
    assert_eq!(prefix_results.len(), 2);
    assert!(prefix_results
        .iter()
        .all(|entry| entry.name.starts_with("report-")));
    let extension_results = db
        .search_global_entries("r", 20, 0)
        .expect("extension search");
    assert_eq!(extension_results[3].name, "archive.r");
    assert_eq!(extension_results[4].name, "archive.rust");
    let repeated_ids = db
        .search_global_entries("rep", 20, 0)
        .expect("repeat ranked search")
        .into_iter()
        .map(|entry| entry.id)
        .collect::<Vec<_>>();
    assert_eq!(
        prefix_results
            .into_iter()
            .map(|entry| entry.id)
            .collect::<Vec<_>>(),
        repeated_ids
    );

    drop(db);
    let _ = std::fs::remove_file(path);
}

#[test]
fn global_search_snapshot_filters_disabled_sources_and_tracks_entry_revision() {
    let path = test_db_path();
    let db = Database::open(&path).expect("open test database");
    db.upsert_global_volume(&test_volume())
        .expect("insert global volume");
    db.update_global_volume_state(
        "gv_test",
        INDEX_STATUS_READY,
        None,
        None,
        None,
        None,
        Some(31),
    )
    .expect("mark source ready");
    let document = test_entry(r"C:\Global\snapshot-note.txt", "snapshot-note.txt", false);
    let document_id = document.entry_id();
    db.upsert_global_entries_batch(std::slice::from_ref(&document))
        .expect("insert snapshot entry");

    let ready = db
        .search_global_entries_snapshot("snapshot", 20, 0)
        .expect("read consistent search snapshot");
    assert_eq!(ready.results.len(), 1);
    assert_eq!(ready.source_health.len(), 1);
    assert!(ready.source_health[0].enabled);
    assert_eq!(ready.source_health[0].status, INDEX_STATUS_READY);
    assert!(ready.index_status.collection_complete);
    assert!(!ready.source_revision.is_empty());

    db.set_global_volume_enabled("gv_test", false)
        .expect("disable source");
    let disabled = db
        .search_global_entries_snapshot("snapshot", 20, 0)
        .expect("read disabled source snapshot");
    assert!(disabled.results.is_empty());
    assert!(!disabled.source_health[0].enabled);
    assert_eq!(disabled.index_status.status, INDEX_STATUS_UNAVAILABLE);
    assert_ne!(ready.source_revision, disabled.source_revision);

    db.set_global_volume_enabled("gv_test", true)
        .expect("re-enable source");
    db.mark_global_entry_stale(&document_id)
        .expect("mark entry stale");
    let stale = db
        .search_global_entries_snapshot("snapshot", 20, 0)
        .expect("read stale entry snapshot");
    assert!(stale.results.is_empty());
    assert_ne!(disabled.source_revision, stale.source_revision);

    drop(db);
    let _ = std::fs::remove_file(path);
}

#[test]
fn global_search_snapshot_remains_source_consistent_during_status_rebuild_changes() {
    let path = test_db_path();
    let db = Database::open(&path).expect("open test database");
    db.upsert_global_volume(&test_volume())
        .expect("insert global volume");
    db.update_global_volume_state(
        "gv_test",
        INDEX_STATUS_READY,
        None,
        None,
        None,
        None,
        Some(31),
    )
    .expect("mark source ready");
    let document = test_entry(
        r"C:\Global\concurrent-note.txt",
        "concurrent-note.txt",
        false,
    );
    db.upsert_global_entries_batch(std::slice::from_ref(&document))
        .expect("insert concurrent entry");

    let start = Arc::new(Barrier::new(2));
    let worker_db = db.clone();
    let worker_start = Arc::clone(&start);
    let worker = std::thread::spawn(move || {
        worker_start.wait();
        for index in 0..24 {
            let enabled = index % 2 == 0;
            worker_db
                .set_global_volume_enabled("gv_test", enabled)
                .expect("toggle source");
            worker_db
                .update_global_volume_state(
                    "gv_test",
                    if enabled {
                        INDEX_STATUS_READY
                    } else {
                        INDEX_STATUS_REBUILD_REQUIRED
                    },
                    None,
                    None,
                    None,
                    None,
                    Some(40 + index),
                )
                .expect("update source status");
        }
    });
    start.wait();
    for _ in 0..24 {
        let snapshot = db
            .search_global_entries_snapshot("concurrent", 20, 0)
            .expect("read concurrent snapshot");
        let source = &snapshot.source_health[0];
        assert!(snapshot
            .results
            .iter()
            .all(|result| result.volume_id == source.source_id && source.enabled));
        if snapshot.index_status.collection_complete {
            assert!(source.enabled);
            assert_eq!(source.status, INDEX_STATUS_READY);
        }
        assert!(!snapshot.source_revision.is_empty());
    }
    worker.join().expect("status worker");

    drop(db);
    let _ = std::fs::remove_file(path);
}

#[test]
fn disabled_ai_policy_creates_no_jobs_without_removing_global_search() {
    let path = test_db_path();
    let db = Database::open(&path).expect("open test database");
    db.upsert_global_volume(&test_volume())
        .expect("insert global volume");
    let document = test_entry(r"C:\Global\Private\secret.txt", "secret.txt", false);
    db.upsert_global_entries_batch(std::slice::from_ref(&document))
        .expect("insert global document");
    db.add_managed_scope(AddManagedScopeRequest {
        path: r"C:\Global\Private".to_string(),
        global_entry_id: None,
        enabled: true,
        allow_local_ai: false,
        allow_cloud_ai: false,
    })
    .expect("add blocked scope");

    let results = db
        .search_global_entries("secret", 20, 0)
        .expect("global search remains available");
    assert_eq!(results.len(), 1);
    assert!(results[0].managed);
    let conn = Connection::open(&path).expect("inspect disabled AI policy");
    let job_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM ai_jobs", [], |row| row.get(0))
        .expect("AI job count");
    assert_eq!(job_count, 0);
    drop(conn);
    drop(db);
    let _ = std::fs::remove_file(path);
}

#[test]
fn disabled_managed_scope_is_not_reported_as_active_management() {
    let path = test_db_path();
    let db = Database::open(&path).expect("open test database");
    db.upsert_global_volume(&test_volume())
        .expect("insert global volume");
    let document = test_entry(r"C:\Global\Disabled\note.txt", "note.txt", false);
    db.upsert_global_entries_batch(std::slice::from_ref(&document))
        .expect("insert global document");

    let scope = db
        .add_managed_scope(AddManagedScopeRequest {
            path: r"C:\Global\Disabled".to_string(),
            global_entry_id: None,
            enabled: false,
            allow_local_ai: true,
            allow_cloud_ai: false,
        })
        .expect("add disabled scope");
    let result = db
        .search_global_entries("note", 20, 0)
        .expect("search disabled scope");
    assert_eq!(result.len(), 1);
    assert!(!result[0].managed);

    let conn = Connection::open(&path).expect("inspect disabled scope");
    let enabled_entries: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM managed_entries WHERE enabled = 1",
            [],
            |row| row.get(0),
        )
        .expect("enabled managed entries");
    assert_eq!(enabled_entries, 0);
    drop(conn);

    db.update_managed_scope_policy(UpdateManagedScopePolicyRequest {
        id: scope.id,
        enabled: Some(true),
        allow_local_ai: None,
        allow_cloud_ai: None,
    })
    .expect("enable scope");
    let result = db
        .search_global_entries("note", 20, 0)
        .expect("search enabled scope");
    assert!(result[0].managed);

    drop(db);
    let _ = std::fs::remove_file(path);
}

#[test]
fn overlapping_managed_scopes_keep_ai_jobs_isolated_by_scope() {
    let path = test_db_path();
    let db = Database::open(&path).expect("open test database");
    db.upsert_global_volume(&test_volume())
        .expect("insert global volume");
    let document = test_entry(r"C:\Global\Shared\note.txt", "note.txt", false);
    db.upsert_global_entries_batch(std::slice::from_ref(&document))
        .expect("insert global document");

    db.add_managed_scope(AddManagedScopeRequest {
        path: r"C:\Global".to_string(),
        global_entry_id: None,
        enabled: true,
        allow_local_ai: true,
        allow_cloud_ai: false,
    })
    .expect("add broad managed scope");
    db.add_managed_scope(AddManagedScopeRequest {
        path: r"C:\Global\Shared".to_string(),
        global_entry_id: None,
        enabled: true,
        allow_local_ai: true,
        allow_cloud_ai: false,
    })
    .expect("add nested managed scope");

    let conn = Connection::open(&path).expect("inspect isolated jobs");
    let managed_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM managed_entries", [], |row| row.get(0))
        .expect("managed entry count");
    let job_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM ai_jobs", [], |row| row.get(0))
        .expect("AI job count");
    let distinct_scope_count: i64 = conn
        .query_row(
            "SELECT COUNT(DISTINCT managed_scope_id) FROM ai_jobs",
            [],
            |row| row.get(0),
        )
        .expect("AI job scope count");
    assert_eq!(managed_count, 2);
    assert_eq!(job_count, 2);
    assert_eq!(distinct_scope_count, 2);

    drop(conn);
    drop(db);
    let _ = std::fs::remove_file(path);
}

#[test]
fn removing_the_last_managed_scope_clears_ai_state_but_keeps_global_entry() {
    let path = test_db_path();
    let db = Database::open(&path).expect("open test database");
    db.upsert_global_volume(&test_volume())
        .expect("insert global volume");
    let document = test_entry(r"C:\Global\Managed\note.txt", "note.txt", false);
    db.upsert_global_entries_batch(std::slice::from_ref(&document))
        .expect("insert global document");
    let scope = db
        .add_managed_scope(AddManagedScopeRequest {
            path: r"C:\Global\Managed".to_string(),
            global_entry_id: None,
            enabled: true,
            allow_local_ai: true,
            allow_cloud_ai: false,
        })
        .expect("add managed scope");
    db.remove_managed_scope(&scope.id)
        .expect("remove managed scope");

    let results = db
        .search_global_entries("note", 20, 0)
        .expect("global search after scope removal");
    assert_eq!(results.len(), 1);
    assert!(!results[0].managed);
    let conn = Connection::open(&path).expect("inspect removed scope");
    let ai_state_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM ai_analysis_state", [], |row| {
            row.get(0)
        })
        .expect("AI state count");
    let managed_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM managed_entries", [], |row| row.get(0))
        .expect("managed entry count");
    assert_eq!(ai_state_count, 0);
    assert_eq!(managed_count, 0);

    drop(conn);
    drop(db);
    let _ = std::fs::remove_file(path);
}

#[test]
#[ignore = "runs the required one-hundred-thousand-entry global search benchmark"]
fn global_search_performance_100k_synthetic_entries() {
    let path = test_db_path();
    let db = Database::open(&path).expect("open benchmark database");
    db.upsert_global_volume(&test_volume())
        .expect("insert benchmark volume");

    {
        let mut conn = db.conn().expect("benchmark database connection");
        conn.pragma_update(None, "synchronous", "OFF")
            .expect("set benchmark synchronous mode");
        let transaction = conn.transaction().expect("benchmark transaction");
        transaction
            .execute_batch(
                r#"
                DROP TRIGGER IF EXISTS global_entries_ai;
                DROP TRIGGER IF EXISTS global_entries_count_ai;
                WITH RECURSIVE numbers(n) AS (
                    SELECT 1
                    UNION ALL
                    SELECT n + 1 FROM numbers WHERE n < 100000
                )
                INSERT INTO global_entries (
                    id, volume_id, platform_file_id, parent_platform_file_id,
                    name, name_normalized, path, path_normalized, extension,
                    is_directory, size, created_at_fs, modified_at_fs,
                    file_attributes, is_hidden, is_system, is_stale,
                    source_provider, last_seen_at
                )
                SELECT
                    'ge_perf_' || n, 'gv_test', 'frn:perf:' || n, 'frn:perf-parent',
                    printf('Report-%06d.txt', n), lower(printf('report-%06d.txt', n)),
                    'C:\\Global\\Benchmark\\' || printf('Report-%06d.txt', n),
                    lower('c:\\global\\benchmark\\' || printf('report-%06d.txt', n)),
                    'txt', 0, 1024, 10, 20, 0, 0, 0, 0, 'windows_mft_usn', 30
                FROM numbers;
                INSERT INTO global_entries_fts(global_entries_fts) VALUES ('rebuild');
                UPDATE global_volumes
                SET entry_count = (SELECT COUNT(*) FROM global_entries WHERE volume_id = 'gv_test'),
                    updated_at = 30
                WHERE id = 'gv_test';
                "#,
            )
            .expect("insert one hundred thousand benchmark entries");
        transaction.commit().expect("commit benchmark entries");
    }

    let queries = [
        ("R", "Report-000001.txt"),
        ("Report-050000", "Report-050000.txt"),
        ("Report-100000", "Report-100000.txt"),
        ("txt", "Report-000001.txt"),
        ("Report-050000!", "Report-050000.txt"),
    ];
    let mut timings_ms = Vec::with_capacity(queries.len() * 3);
    for (query, expected_name) in queries {
        for _ in 0..3 {
            let started = Instant::now();
            let results = db
                .search_global_entries(query, 80, 0)
                .expect("search 100k benchmark entries");
            let elapsed_ms = started.elapsed().as_secs_f64() * 1_000.0;
            eprintln!("Task 04 100k query {query:?}: {elapsed_ms:.3}ms");
            timings_ms.push(elapsed_ms);
            if query != "Report-050000!" {
                assert!(
                    results.iter().any(|result| result.name == expected_name),
                    "global search query {query:?} should return {expected_name:?}"
                );
            }
            assert!(results.len() <= 80);
        }
    }
    timings_ms.sort_by(f64::total_cmp);
    let p95_index = ((timings_ms.len() as f64 * 0.95).ceil() as usize)
        .saturating_sub(1)
        .min(timings_ms.len().saturating_sub(1));
    let p95_ms = timings_ms[p95_index];
    eprintln!(
        "global search over 100,000 entries: samples={} p95_ms={p95_ms:.3} threshold_ms={GLOBAL_SEARCH_P95_LIMIT_MS:.3}",
        timings_ms.len()
    );
    assert!(
        p95_ms <= GLOBAL_SEARCH_P95_LIMIT_MS,
        "global search p95 {p95_ms:.3}ms exceeded {GLOBAL_SEARCH_P95_LIMIT_MS:.3}ms"
    );

    drop(db);
    let _ = std::fs::remove_file(path);
}

#[test]
#[ignore = "runs the required one-million-entry global search benchmark"]
fn global_search_performance_one_million_synthetic_entries() {
    let path = test_db_path();
    let db = Database::open(&path).expect("open benchmark database");
    db.upsert_global_volume(&test_volume())
        .expect("insert benchmark volume");

    {
        let mut conn = db.conn().expect("benchmark database connection");
        conn.pragma_update(None, "synchronous", "OFF")
            .expect("set benchmark synchronous mode");
        let transaction = conn.transaction().expect("benchmark transaction");
        transaction
            .execute_batch(
                r#"
                DROP TRIGGER IF EXISTS global_entries_ai;
                DROP TRIGGER IF EXISTS global_entries_count_ai;
                WITH RECURSIVE numbers(n) AS (
                    SELECT 1
                    UNION ALL
                    SELECT n + 1 FROM numbers WHERE n < 1000000
                )
                INSERT INTO global_entries (
                    id, volume_id, platform_file_id, parent_platform_file_id,
                    name, name_normalized, path, path_normalized, extension,
                    is_directory, size, created_at_fs, modified_at_fs,
                    file_attributes, is_hidden, is_system, is_stale,
                    source_provider, last_seen_at
                )
                SELECT
                    'ge_perf_' || n,
                    'gv_test',
                    'frn:perf:' || n,
                    'frn:perf-parent',
                    printf('Report-%06d.txt', n),
                    lower(printf('report-%06d.txt', n)),
                    'C:\\Global\\Benchmark\\' || printf('Report-%06d.txt', n),
                    lower('c:\\global\\benchmark\\' || printf('report-%06d.txt', n)),
                    'txt', 0, 1024, 10, 20, 0, 0, 0, 0,
                    'windows_mft_usn', 30
                FROM numbers;
                INSERT INTO global_entries_fts(global_entries_fts) VALUES ('rebuild');
                UPDATE global_volumes
                SET entry_count = (SELECT COUNT(*) FROM global_entries WHERE volume_id = 'gv_test'),
                    updated_at = 30
                WHERE id = 'gv_test';
                "#,
            )
            .expect("insert one million benchmark entries");
        transaction.commit().expect("commit benchmark entries");
    }

    let queries = [
        ("Report-000001", "Report-000001.txt"),
        ("Report-100000", "Report-100000.txt"),
        ("Report-500000", "Report-500000.txt"),
        ("Report-750000", "Report-750000.txt"),
        ("Report-999999", "Report-999999.txt"),
    ];
    {
        let conn = db.conn().expect("explain benchmark query");
        let mut statement = conn
            .prepare(
                "EXPLAIN QUERY PLAN SELECT ge.id FROM global_entries ge INDEXED BY idx_global_entries_active_name \
                 JOIN global_volumes gv ON gv.id = ge.volume_id \
                 WHERE gv.enabled = 1 AND ge.is_stale = 0 \
                   AND ge.name_normalized GLOB ?1 \
                 ORDER BY ge.modified_at_fs DESC, ge.id ASC LIMIT 20",
            )
            .expect("prepare benchmark plan");
        let plan = statement
            .query_map(["report-500000*"], |row| row.get::<_, String>(3))
            .expect("query benchmark plan")
            .collect::<Result<Vec<_>, _>>()
            .expect("collect benchmark plan");
        eprintln!("Task 04 1M prefix query plan: {plan:?}");
    }
    let mut timings_ms = Vec::with_capacity(queries.len() * 3);
    for (query, expected_name) in queries {
        for _ in 0..3 {
            let started = Instant::now();
            let results = db
                .search_global_entries(query, 20, 0)
                .expect("search one million benchmark entries");
            let elapsed_ms = started.elapsed().as_secs_f64() * 1_000.0;
            eprintln!("Task 04 1M query {query:?}: {elapsed_ms:.3}ms");
            timings_ms.push(elapsed_ms);
            assert!(
                results.iter().any(|result| result.name == expected_name),
                "global search query {query:?} should return {expected_name:?}"
            );
        }
    }
    timings_ms.sort_by(f64::total_cmp);
    let p95_index = ((timings_ms.len() as f64 * 0.95).ceil() as usize)
        .saturating_sub(1)
        .min(timings_ms.len().saturating_sub(1));
    let p95_ms = timings_ms[p95_index];
    eprintln!(
        "global search over 1,000,000 entries: samples={} p95_ms={p95_ms:.3} threshold_ms={GLOBAL_SEARCH_P95_LIMIT_MS:.3}",
        timings_ms.len()
    );
    assert!(
        p95_ms <= GLOBAL_SEARCH_P95_LIMIT_MS,
        "global search p95 {p95_ms:.3}ms exceeded {GLOBAL_SEARCH_P95_LIMIT_MS:.3}ms"
    );

    drop(db);
    let _ = std::fs::remove_file(path);
}
