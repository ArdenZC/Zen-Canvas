use super::*;
use crate::db::Database;
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
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
    let mut timings_ms = Vec::with_capacity(queries.len() * 3);
    for (query, expected_name) in queries {
        for _ in 0..3 {
            let started = Instant::now();
            let results = db
                .search_global_entries(query, 20, 0)
                .expect("search one million benchmark entries");
            timings_ms.push(started.elapsed().as_secs_f64() * 1_000.0);
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
