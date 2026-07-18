use rusqlite::{params, Connection};
use std::{
    path::PathBuf,
    sync::atomic::{AtomicU64, Ordering},
};
use zen_canvas_tauri::db::Database;

static TEST_DB_COUNTER: AtomicU64 = AtomicU64::new(0);

fn test_db_path(label: &str) -> PathBuf {
    let sequence = TEST_DB_COUNTER.fetch_add(1, Ordering::Relaxed);
    std::env::temp_dir().join(format!(
        "zen-canvas-migration-{label}-{}-{sequence}.sqlite3",
        std::process::id()
    ))
}

fn column_names(conn: &Connection, table: &str) -> Vec<String> {
    conn.prepare(&format!("PRAGMA table_info({table})"))
        .expect("prepare table info")
        .query_map([], |row| row.get(1))
        .expect("query table info")
        .collect::<Result<Vec<_>, _>>()
        .expect("collect columns")
}

fn downgrade_current_fixture_to_schema_16(path: &PathBuf) {
    let db = Database::open(path).expect("create current database");
    drop(db);
    let conn = Connection::open(path).expect("open downgrade fixture");
    conn.execute(
        "UPDATE app_settings SET value = ?1, revision = 41 WHERE key = 'app_settings_v1'",
        [r#"{"closeBehavior":"minimize","folderNamingLanguage":"en","defaultScanFolders":[],"restoreRetentionDays":30,"launchAtLogin":false}"#],
    )
    .expect("seed legacy settings");
    conn.execute(
        "INSERT INTO operation_batches (id, created_at, status) VALUES ('legacy-batch', 1700000000000, 'completed')",
        [],
    )
    .expect("seed operation batch");
    conn.execute(
        r#"
        INSERT INTO operation_logs (
          id, batch_id, operation_type, source_path, target_path, old_name, new_name,
          status, created_at, can_undo, path_before, path_after, name_before, name_after,
          can_restore, restore_status
        ) VALUES (
          'legacy-operation', 'legacy-batch', 'move', 'C:/fixture/source.txt',
          'C:/fixture/target.txt', 'source.txt', 'target.txt', 'success', 1700000000000,
          1, 'C:/fixture/source.txt', 'C:/fixture/target.txt', 'source.txt', 'target.txt',
          1, 'not_restored'
        )
        "#,
        [],
    )
    .expect("seed legacy operation");
    conn.execute(
        "INSERT INTO cleanup_trash_batches (id, created_at, root, total_items, total_size, status) VALUES ('legacy-trash-batch', '2026-07-17T00:00:00Z', 'C:/fixture', 1, 7, 'completed')",
        [],
    )
    .expect("seed cleanup batch");
    conn.execute(
        r#"
        INSERT INTO cleanup_trash_items (
          id, batch_id, original_path, trash_path, name, size, moved_at, status
        ) VALUES (
          'legacy-trash-item', 'legacy-trash-batch', 'C:/fixture/trash.txt',
          'C:/fixture/.zen-canvas-trash/trash.txt', 'trash.txt', 7,
          '2026-07-17T00:00:00Z', 'moved'
        )
        "#,
        [],
    )
    .expect("seed legacy trash item");

    conn.execute_batch(
        r#"
        ALTER TABLE app_settings DROP COLUMN revision;
        ALTER TABLE operation_logs DROP COLUMN source_size;
        ALTER TABLE operation_logs DROP COLUMN source_modified_ns;
        ALTER TABLE operation_logs DROP COLUMN source_platform_file_id;
        ALTER TABLE operation_logs DROP COLUMN source_quick_hash;
        ALTER TABLE operation_logs DROP COLUMN target_platform_file_id;
        ALTER TABLE cleanup_trash_items DROP COLUMN source_modified_ns;
        ALTER TABLE cleanup_trash_items DROP COLUMN source_platform_file_id;
        ALTER TABLE cleanup_trash_items DROP COLUMN source_quick_hash;
        ALTER TABLE cleanup_trash_items DROP COLUMN trash_modified_ns;
        ALTER TABLE cleanup_trash_items DROP COLUMN trash_platform_volume_id;
        ALTER TABLE cleanup_trash_items DROP COLUMN trash_platform_file_id;
        ALTER TABLE cleanup_trash_items DROP COLUMN trash_quick_hash;
        ALTER TABLE cleanup_trash_items DROP COLUMN identity_status;
        PRAGMA user_version = 16;
        "#,
    )
    .expect("downgrade to schema 16");
}

fn downgrade_current_fixture_to_schema_20_or_21(path: &PathBuf, version: i32) {
    assert!(matches!(version, 20 | 21));
    let db = Database::open(path).expect("create current database");
    drop(db);
    let conn = Connection::open(path).expect("open journal downgrade fixture");
    conn.execute_batch(
        r#"
        DROP TRIGGER IF EXISTS operation_logs_phase_guard_insert;
        DROP TRIGGER IF EXISTS operation_logs_phase_guard_update;
        DROP TRIGGER IF EXISTS cleanup_items_phase_guard_insert;
        DROP TRIGGER IF EXISTS cleanup_items_phase_guard_update;
        ALTER TABLE operation_logs DROP COLUMN source_claim_path;
        ALTER TABLE operation_logs DROP COLUMN operation_phase;
        ALTER TABLE operation_logs DROP COLUMN claim_created_at;
        ALTER TABLE operation_logs DROP COLUMN claim_platform_file_id;
        ALTER TABLE operation_logs DROP COLUMN claim_full_hash;
        ALTER TABLE cleanup_trash_items DROP COLUMN source_claim_path;
        ALTER TABLE cleanup_trash_items DROP COLUMN operation_phase;
        ALTER TABLE cleanup_trash_items DROP COLUMN claim_created_at;
        ALTER TABLE cleanup_trash_items DROP COLUMN claim_platform_file_id;
        ALTER TABLE cleanup_trash_items DROP COLUMN claim_full_hash;
        "#,
    )
    .expect("remove schema 22 journal columns");

    if version == 20 {
        conn.execute_batch(
            r#"
            ALTER TABLE operation_logs DROP COLUMN source_full_hash;
            ALTER TABLE operation_logs DROP COLUMN target_full_hash;
            ALTER TABLE cleanup_trash_items DROP COLUMN source_full_hash;
            ALTER TABLE cleanup_trash_items DROP COLUMN trash_full_hash;
            "#,
        )
        .expect("remove schema 21 full hash columns");
    }

    conn.execute(&format!("PRAGMA user_version = {version}"), [])
        .expect("downgrade journal fixture");
}

fn assert_schema_22_journal_columns(conn: &Connection) {
    let operation_columns = column_names(conn, "operation_logs");
    for column in [
        "source_full_hash",
        "target_full_hash",
        "source_claim_path",
        "operation_phase",
        "claim_created_at",
        "claim_platform_file_id",
        "claim_full_hash",
    ] {
        assert!(
            operation_columns.contains(&column.to_string()),
            "missing {column}"
        );
    }
    let cleanup_columns = column_names(conn, "cleanup_trash_items");
    for column in [
        "source_full_hash",
        "trash_full_hash",
        "source_claim_path",
        "operation_phase",
        "claim_created_at",
        "claim_platform_file_id",
        "claim_full_hash",
    ] {
        assert!(
            cleanup_columns.contains(&column.to_string()),
            "missing {column}"
        );
    }
}

#[test]
fn schema_16_migrates_settings_and_recovery_identity_without_trusting_legacy_rows() {
    let path = test_db_path("v16");
    downgrade_current_fixture_to_schema_16(&path);

    let db = Database::open(&path).expect("migrate schema 16 to current");
    drop(db);
    let conn = Connection::open(&path).expect("inspect migrated database");
    let version: i64 = conn
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .expect("read schema version");
    let (settings_json, revision): (String, i64) = conn
        .query_row(
            "SELECT value, revision FROM app_settings WHERE key = 'app_settings_v1'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("read migrated settings");
    let (can_restore, restore_status, restore_error): (i64, String, String) = conn
        .query_row(
            "SELECT can_restore, restore_status, restore_error FROM operation_logs WHERE id = 'legacy-operation'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .expect("read legacy operation state");
    let identity_status: String = conn
        .query_row(
            "SELECT identity_status FROM cleanup_trash_items WHERE id = 'legacy-trash-item'",
            [],
            |row| row.get(0),
        )
        .expect("read legacy trash identity state");

    assert_eq!(version, 22);
    assert!(settings_json.contains("minimize"));
    assert_eq!(revision, 0);
    assert_eq!(can_restore, 0);
    assert_eq!(restore_status, "manual_review");
    assert!(restore_error.contains("legacy identity"));
    assert_eq!(identity_status, "legacy_unverified");
    assert!(column_names(&conn, "operation_logs").contains(&"source_quick_hash".to_string()));
    assert!(column_names(&conn, "operation_logs").contains(&"source_full_hash".to_string()));
    assert!(column_names(&conn, "cleanup_trash_items").contains(&"trash_quick_hash".to_string()));
    assert!(column_names(&conn, "cleanup_trash_items").contains(&"trash_full_hash".to_string()));
    assert_eq!(
        conn.query_row::<i64, _, _>(
            "SELECT COUNT(*) FROM operation_batches WHERE id = 'legacy-batch'",
            [],
            |row| row.get(0)
        )
        .unwrap(),
        1
    );

    drop(conn);
    Database::open(&path).expect("migration is idempotent");
}

#[test]
fn migration_failure_rolls_back_prior_steps_and_preserves_schema_16_data() {
    let path = test_db_path("rollback");
    downgrade_current_fixture_to_schema_16(&path);
    let conn = Connection::open(&path).expect("open rollback fixture");
    conn.execute_batch("DROP TABLE operation_logs;")
        .expect("break later identity migration");
    drop(conn);

    let error = match Database::open(&path) {
        Ok(_) => panic!("migration should fail when the operation log table is missing"),
        Err(error) => error,
    };
    assert!(error.to_string().contains("operation_logs"));

    let conn = Connection::open(&path).expect("inspect rolled back fixture");
    let version: i64 = conn
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .expect("read rolled back version");
    assert_eq!(version, 16);
    assert!(!column_names(&conn, "app_settings").contains(&"revision".to_string()));
    let settings_json: String = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = 'app_settings_v1'",
            [],
            |row| row.get(0),
        )
        .expect("legacy settings survive rollback");
    assert!(settings_json.contains("minimize"));
}

#[test]
fn schema_20_and_21_migrate_to_schema_22_with_source_claim_journal_columns() {
    for version in [20, 21] {
        let path = test_db_path(&format!("v{version}-journal"));
        downgrade_current_fixture_to_schema_20_or_21(&path, version);

        let db = Database::open(&path).expect("migrate journal fixture to schema 22");
        drop(db);
        let conn = Connection::open(&path).expect("inspect journal migration");
        let migrated_version: i64 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .expect("read migrated journal version");
        assert_eq!(migrated_version, 22);
        assert_schema_22_journal_columns(&conn);

        drop(conn);
        Database::open(&path).expect("journal migration is idempotent");
    }
}

#[test]
fn schema_20_normalizes_invalid_historical_rule_domains_in_transaction() {
    let path = test_db_path("enums");
    let db = Database::open(&path).expect("create current database");
    drop(db);
    let conn = Connection::open(&path).expect("open enum fixture");
    conn.execute(
        r#"
        INSERT INTO rules (
          id, name, source, enabled, priority, weight, root_operator,
          groups_json, action_json, created_at, updated_at
        ) VALUES (?1, 'Legacy', 'invalid-source', 1, 1, 1, 'XOR', ?2, ?3, '', '')
        "#,
        params![
            "legacy-enums",
            r#"[{"id":"g","operator":"XOR","conditions":[{"id":"c","field":"bad-field","operator":"bad-operator","value":"x"}]}]"#,
            r#"{"purpose":"bad-purpose","lifecycle":"bad-lifecycle","risk_level":"bad-risk","suggested_action":"bad-action"}"#
        ],
    )
    .expect("seed invalid rule domains");
    conn.execute_batch("PRAGMA user_version = 19;")
        .expect("downgrade enum fixture");
    drop(conn);

    Database::open(&path).expect("run enum migration");
    let conn = Connection::open(&path).expect("inspect enum migration");
    let (source, root, groups, action): (String, String, String, String) = conn
        .query_row(
            "SELECT source, root_operator, groups_json, action_json FROM rules WHERE id = 'legacy-enums'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .expect("read normalized rule");

    assert_eq!(source, "unknown");
    assert_eq!(root, "UNKNOWN");
    assert!(groups.contains("unknown"));
    assert!(!groups.contains("XOR"));
    assert!(!groups.contains("bad-field"));
    assert_eq!(action.matches("Unknown").count(), 4);
    assert!(!action.contains("bad-purpose"));
}
