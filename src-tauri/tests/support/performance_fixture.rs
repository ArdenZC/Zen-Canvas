use std::{
    fs,
    path::{Path, PathBuf},
};

use rusqlite::{params, Connection};
use zen_canvas_tauri::db::{Database, InsertFileRequest};

pub const ROOT_ID: &str = "task05-benchmark-root";
pub const ROOT_PATH: &str = "/task05/benchmark-library";
pub const TAG_A: &str = "task05-benchmark-tag-a";
pub const TAG_B: &str = "task05-benchmark-tag-b";

pub fn fixture_root() -> Option<PathBuf> {
    std::env::var_os("ZC_PERF_FIXTURE_ROOT").map(PathBuf::from)
}

pub fn library_fixture_path(root: &Path, row_count: usize) -> PathBuf {
    root.join(format!("file-library-{row_count}.sqlite3"))
}

pub fn seed_library(path: &Path, row_count: usize) -> Database {
    if std::env::var("ZC_PERF_FIXTURE_BUILD").as_deref() != Ok("1") {
        if let Some(root) = fixture_root() {
            let source = library_fixture_path(&root, row_count);
            if source.exists() {
                copy_and_validate_fixture(&source, path, row_count);
                return Database::open(path).expect("open reusable file-library fixture");
            }
            if std::env::var("ZC_PERF_FIXTURE_REQUIRED").as_deref() == Ok("1") {
                panic!(
                    "required reusable file-library fixture is missing: {}",
                    source.display()
                );
            }
        }
    }
    seed_library_fresh(path, row_count)
}

pub fn prepare_library_fixture(root: &Path, row_count: usize) {
    fs::create_dir_all(root).expect("create performance fixture root");
    let path = library_fixture_path(root, row_count);
    if path.exists() {
        validate_fixture(&path, row_count);
        return;
    }
    let db = seed_library_fresh(&path, row_count);
    checkpoint_and_validate(&path, row_count, db);
}

pub fn validate_fixture(path: &Path, expected_rows: usize) {
    assert_no_wal_sidecars(path);
    let connection = Connection::open(path).expect("open reusable fixture for validation");
    let integrity: String = connection
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .expect("run fixture integrity check");
    assert_eq!(
        integrity,
        "ok",
        "fixture integrity check failed: {}",
        path.display()
    );
    let rows: i64 = connection
        .query_row("SELECT COUNT(*) FROM files WHERE is_stale = 0", [], |row| {
            row.get(0)
        })
        .expect("read fixture row count");
    assert_eq!(rows, expected_rows as i64, "fixture row count mismatch");
    drop(connection);
    assert_no_wal_sidecars(path);
}

fn assert_no_wal_sidecars(path: &Path) {
    let wal_path = PathBuf::from(format!("{}-wal", path.display()));
    let shm_path = PathBuf::from(format!("{}-shm", path.display()));
    assert!(
        !wal_path.exists(),
        "fixture has an active WAL: {}",
        wal_path.display()
    );
    assert!(
        !shm_path.exists(),
        "fixture has an active SHM file: {}",
        shm_path.display()
    );
}

fn copy_and_validate_fixture(source: &Path, destination: &Path, expected_rows: usize) {
    validate_fixture(source, expected_rows);
    if destination.exists() {
        fs::remove_file(destination).expect("remove benchmark working database");
    }
    fs::copy(source, destination).expect("copy reusable fixture to working database");
    validate_fixture(destination, expected_rows);
}

fn checkpoint_and_validate(path: &Path, expected_rows: usize, db: Database) {
    drop(db);
    let connection = Connection::open(path).expect("open fixture for checkpoint");
    connection
        .execute_batch(
            "PRAGMA wal_checkpoint(TRUNCATE); PRAGMA optimize; PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE;",
        )
        .expect("checkpoint reusable fixture");
    drop(connection);
    validate_fixture(path, expected_rows);
}

fn seed_library_fresh(path: &Path, row_count: usize) -> Database {
    let db = Database::open(path).expect("open benchmark database");
    let conn = Connection::open(path).expect("open benchmark seed connection");
    let rebuild_fts_after_seed = row_count >= 1_000_000;
    conn.execute(
        "INSERT INTO scan_roots (id, normalized_path, display_name, source_kind, enabled, health_status, current_generation, needs_reconciliation, created_at, updated_at) VALUES (?1, ?2, 'Task 05 benchmark', 'file_library', 1, 'healthy', 1, 0, 1, 1)",
        params![ROOT_ID, ROOT_PATH],
    )
    .expect("seed benchmark root");
    conn.execute(
        "INSERT INTO user_tags (id, display_name, normalized_name, color_token, created_at, updated_at) VALUES (?1, 'Benchmark A', 'benchmark a', 'blue', 1, 1), (?2, 'Benchmark B', 'benchmark b', 'green', 1, 1)",
        params![TAG_A, TAG_B],
    )
    .expect("seed benchmark tags");
    if rebuild_fts_after_seed {
        conn.execute_batch(
            "DROP TRIGGER IF EXISTS files_ai; DROP TRIGGER IF EXISTS files_ad; DROP TRIGGER IF EXISTS files_au;",
        )
        .expect("suspend FTS triggers for the 1M fixture");
    }
    let tx = conn
        .unchecked_transaction()
        .expect("start benchmark transaction");
    for index in 0..row_count {
        let file = benchmark_insert_request(index);
        tx.execute(
            "INSERT INTO files (id, path, name, extension, size, mtime, ctime, is_dir, state_code, file_type, purpose, lifecycle, context, risk_level, confidence, classification_status, requires_confirmation, suggested_action, is_stale, last_seen_at) VALUES (?1, ?2, ?3, 'pdf', ?4, ?5, ?6, 0, 0, 'Document', 'Work', 'Active', '', 'Normal', ?7, 'classified', ?8, ?9, 0, ?5)",
            params![
                file.id,
                file.path,
                file.name,
                file.size,
                file.mtime,
                file.ctime,
                (index % 100) as f64 / 100.0,
                i64::from(index % 10 == 0),
                if index % 20 == 0 { "Review" } else { "Keep" },
            ],
        )
        .expect("seed benchmark file");
        if index % 10 < 8 {
            tx.execute(
                "INSERT INTO file_user_tags(file_id, tag_id, created_at) VALUES (?1, ?2, 1)",
                params![file.id, if index % 2 == 0 { TAG_A } else { TAG_B }],
            )
            .expect("seed benchmark tag assignment");
        }
    }
    tx.commit().expect("commit benchmark files");
    if rebuild_fts_after_seed {
        conn.execute_batch(
            r#"
            INSERT INTO files_fts(files_fts) VALUES('rebuild');
            CREATE TRIGGER files_ai AFTER INSERT ON files BEGIN
                INSERT INTO files_fts(rowid, name, path) VALUES (new.rowid, new.name, new.path);
            END;
            CREATE TRIGGER files_ad AFTER DELETE ON files BEGIN
                INSERT INTO files_fts(files_fts, rowid, name, path)
                VALUES('delete', old.rowid, old.name, old.path);
            END;
            CREATE TRIGGER files_au AFTER UPDATE ON files BEGIN
                INSERT INTO files_fts(files_fts, rowid, name, path)
                VALUES('delete', old.rowid, old.name, old.path);
                INSERT INTO files_fts(rowid, name, path) VALUES (new.rowid, new.name, new.path);
            END;
            INSERT INTO files_fts(files_fts) VALUES('optimize');
            PRAGMA optimize;
            "#,
        )
        .expect("rebuild and restore FTS triggers for the 1M fixture");
    }
    drop(conn);
    db
}

pub fn benchmark_insert_request(index: usize) -> InsertFileRequest {
    let name = if index.is_multiple_of(100) {
        format!("report-{index:07}.pdf")
    } else {
        format!("asset-{index:07}.pdf")
    };
    InsertFileRequest {
        id: format!("task05-file-{index:07}"),
        path: format!("{ROOT_PATH}/{name}"),
        name,
        size: 4_096 + index as i64,
        mtime: 1_700_000_000 + index as i64,
        ctime: 1_600_000_000 + index as i64,
        extension: "pdf".into(),
        is_dir: false,
        state_code: 0,
    }
}
