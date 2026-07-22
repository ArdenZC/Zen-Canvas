use super::*;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;
use std::sync::OnceLock;

/// 当前期望的 schema 版本号，每次需要改动 schema 时 +1
const CURRENT_SCHEMA_VERSION: i32 = 22;
static FTS5_CHECKED: OnceLock<()> = OnceLock::new();

fn assert_fts5_available(conn: &Connection) -> Result<(), DbError> {
    if FTS5_CHECKED.get().is_none() {
        conn.execute_batch(
            r#"
            CREATE VIRTUAL TABLE temp.fts5_probe USING fts5(value, tokenize='trigram');
            DROP TABLE temp.fts5_probe;
            "#,
        )?;
        let _ = FTS5_CHECKED.set(());
    }
    Ok(())
}

fn schema_version(conn: &Connection) -> Result<i32, DbError> {
    conn.query_row("SELECT user_version FROM pragma_user_version", [], |row| {
        row.get(0)
    })
    .map_err(DbError::from)
}

fn set_schema_version(conn: &Connection, version: i32) -> Result<(), DbError> {
    // PRAGMA user_version 不支持参数绑定，用格式化字符串（整数无 SQL 注入风险）
    conn.execute_batch(&format!("PRAGMA user_version = {version}"))
        .map_err(DbError::from)
}

pub(crate) fn migrate(conn: &Connection) -> Result<(), DbError> {
    assert_fts5_available(conn)?;
    let version = schema_version(conn)?;
    if version > CURRENT_SCHEMA_VERSION {
        return Err(DbError::Validation(format!(
            "Database schema version {version} is newer than this app supports ({CURRENT_SCHEMA_VERSION})."
        )));
    }
    if version == CURRENT_SCHEMA_VERSION {
        ensure_journal_state_triggers(conn)?;
        return Ok(());
    }
    conn.execute_batch("BEGIN IMMEDIATE")?;
    let migration_result = (|| -> Result<(), DbError> {
        if version < 1 {
            // 建表 + 基础索引
            conn.execute_batch(
                r#"
            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                path TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                extension TEXT NOT NULL DEFAULT '',
                size INTEGER NOT NULL DEFAULT 0,
                mtime INTEGER NOT NULL DEFAULT 0,
                is_dir INTEGER NOT NULL DEFAULT 0 CHECK (is_dir IN (0, 1)),
                state_code INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
            CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);
            CREATE INDEX IF NOT EXISTS idx_files_extension ON files(extension);
            CREATE INDEX IF NOT EXISTS idx_files_mtime ON files(mtime DESC);
            "#,
            )?;
            set_schema_version(conn, 1)?;
        }
        if version < 2 {
            // 分类字段 + FTS + 触发器
            execute_column_migrations(
            conn,
            &[
                "ALTER TABLE files ADD COLUMN file_type TEXT NOT NULL DEFAULT 'Other';",
                "ALTER TABLE files ADD COLUMN purpose TEXT NOT NULL DEFAULT 'Unknown';",
                "ALTER TABLE files ADD COLUMN lifecycle TEXT NOT NULL DEFAULT 'Inbox';",
                "ALTER TABLE files ADD COLUMN context TEXT NOT NULL DEFAULT '';",
                "ALTER TABLE files ADD COLUMN risk_level TEXT NOT NULL DEFAULT 'Normal';",
                "ALTER TABLE files ADD COLUMN suggested_action TEXT NOT NULL DEFAULT 'Keep';",
                "ALTER TABLE files ADD COLUMN suggested_target_path TEXT NOT NULL DEFAULT '';",
                "ALTER TABLE files ADD COLUMN suggested_name TEXT NOT NULL DEFAULT '';",
                "ALTER TABLE files ADD COLUMN confidence REAL NOT NULL DEFAULT 0.5;",
                "ALTER TABLE files ADD COLUMN classification_reason TEXT NOT NULL DEFAULT 'Indexed by Zen Canvas Tauri backend.';",
                "ALTER TABLE files ADD COLUMN matched_rules TEXT NOT NULL DEFAULT '[]';",
                "ALTER TABLE files ADD COLUMN requires_confirmation INTEGER NOT NULL DEFAULT 0;",
            ],
        )?;
            conn.execute_batch(
            r#"
            CREATE INDEX IF NOT EXISTS idx_files_file_type ON files(file_type);
            CREATE INDEX IF NOT EXISTS idx_files_purpose ON files(purpose);
            CREATE INDEX IF NOT EXISTS idx_files_lifecycle ON files(lifecycle);
            CREATE INDEX IF NOT EXISTS idx_files_risk_level ON files(risk_level);
            CREATE INDEX IF NOT EXISTS idx_files_requires_confirmation ON files(requires_confirmation);
            "#,
        )?;
            ensure_trigram_fts(conn)?;
            ensure_fts_triggers(conn)?;
            set_schema_version(conn, 2)?;
        }
        if version < 3 {
            // 新增 ctime 字段（真实创建时间）
            execute_column_migrations(
                conn,
                &["ALTER TABLE files ADD COLUMN ctime INTEGER NOT NULL DEFAULT 0;"],
            )?;
            set_schema_version(conn, 3)?;
        }
        if version < 4 {
            conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS operation_batches (
                id TEXT PRIMARY KEY,
                created_at INTEGER NOT NULL,
                status TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS operation_logs (
                id TEXT PRIMARY KEY,
                batch_id TEXT NOT NULL,
                operation_type TEXT NOT NULL,
                source_path TEXT NOT NULL,
                target_path TEXT NOT NULL,
                old_name TEXT NOT NULL,
                new_name TEXT NOT NULL,
                status TEXT NOT NULL,
                error_message TEXT,
                created_at INTEGER NOT NULL,
                can_undo INTEGER NOT NULL DEFAULT 0,
                path_before TEXT NOT NULL,
                path_after TEXT NOT NULL,
                name_before TEXT NOT NULL,
                name_after TEXT NOT NULL,
                can_restore INTEGER NOT NULL DEFAULT 0,
                restored_at INTEGER,
                restore_status TEXT NOT NULL DEFAULT 'not_restored',
                restore_error TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_operation_logs_batch_id ON operation_logs(batch_id);
            CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON operation_logs(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_operation_logs_restore_status ON operation_logs(restore_status);
            "#,
        )?;
            set_schema_version(conn, 4)?;
        }
        if version < 5 {
            execute_column_migrations(
                conn,
                &[
                    "ALTER TABLE files ADD COLUMN is_stale INTEGER NOT NULL DEFAULT 0;",
                    "ALTER TABLE files ADD COLUMN last_seen_at INTEGER NOT NULL DEFAULT 0;",
                ],
            )?;
            conn.execute_batch(
                r#"
            CREATE INDEX IF NOT EXISTS idx_files_is_stale ON files(is_stale);
            CREATE INDEX IF NOT EXISTS idx_files_last_seen_at ON files(last_seen_at DESC);
            "#,
            )?;
            set_schema_version(conn, 5)?;
        }
        if version < 6 {
            execute_column_migrations(
            conn,
            &[
                "ALTER TABLE files ADD COLUMN last_classified_at INTEGER NOT NULL DEFAULT 0;",
                "ALTER TABLE files ADD COLUMN classified_rule_version TEXT NOT NULL DEFAULT '';",
                "ALTER TABLE files ADD COLUMN last_classified_mtime INTEGER NOT NULL DEFAULT 0;",
                "ALTER TABLE files ADD COLUMN last_classified_size INTEGER NOT NULL DEFAULT 0;",
            ],
        )?;
            conn.execute_batch(
            r#"
            CREATE INDEX IF NOT EXISTS idx_files_classified_version ON files(classified_rule_version);
            CREATE INDEX IF NOT EXISTS idx_files_last_classified_at ON files(last_classified_at DESC);
            CREATE INDEX IF NOT EXISTS idx_files_classification_fingerprint ON files(last_classified_mtime, last_classified_size);
            "#,
        )?;
            set_schema_version(conn, 6)?;
        }
        if version < 7 {
            conn.execute_batch(
                r#"
            CREATE TABLE IF NOT EXISTS rules (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'user',
                enabled INTEGER NOT NULL DEFAULT 1,
                priority REAL NOT NULL DEFAULT 0,
                weight REAL NOT NULL DEFAULT 0,
                root_operator TEXT NOT NULL DEFAULT 'AND',
                groups_json TEXT NOT NULL DEFAULT '[]',
                action_json TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT ''
            );
            CREATE INDEX IF NOT EXISTS idx_rules_source ON rules(source);
            CREATE INDEX IF NOT EXISTS idx_rules_enabled ON rules(enabled);
            CREATE INDEX IF NOT EXISTS idx_rules_priority ON rules(priority DESC);
            "#,
            )?;
            set_schema_version(conn, 7)?;
        }
        if version < 8 {
            conn.execute_batch(
                r#"
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            "#,
            )?;
            conn.execute(
                r#"
            INSERT OR IGNORE INTO app_settings (key, value)
            VALUES (?1, ?2)
            "#,
                params![
                    crate::settings::APP_SETTINGS_KEY,
                    crate::settings::default_settings_json()?
                ],
            )?;
            set_schema_version(conn, 8)?;
        }
        if version < 9 {
            execute_column_migrations(
                conn,
                &["ALTER TABLE files ADD COLUMN content_hash TEXT NOT NULL DEFAULT '';"],
            )?;
            conn.execute_batch(
                r#"
            CREATE INDEX IF NOT EXISTS idx_files_dedupe
            ON files(size, content_hash)
            WHERE is_dir = 0 AND size > 0;
            "#,
            )?;
            set_schema_version(conn, 9)?;
        }
        if version < 10 {
            execute_column_migrations(
                conn,
                &[r#"
                ALTER TABLE files ADD COLUMN classification_status TEXT NOT NULL DEFAULT 'unclassified'
                CHECK (classification_status IN ('unclassified', 'classified'));
            "#],
            )?;
            conn.execute(
                r#"
            UPDATE files
            SET classification_status = 'classified'
            WHERE last_classified_at > 0
               OR matched_rules <> '[]'
               OR purpose <> 'Unknown'
            "#,
                [],
            )?;
            set_schema_version(conn, 10)?;
        }
        if version < 11 {
            conn.execute_batch(
                r#"
            CREATE INDEX IF NOT EXISTS idx_files_active_mtime
            ON files(is_stale, mtime DESC);

            CREATE INDEX IF NOT EXISTS idx_files_lifecycle_mtime
            ON files(is_stale, lifecycle, mtime DESC);

            CREATE INDEX IF NOT EXISTS idx_files_action_mtime
            ON files(is_stale, suggested_action, mtime DESC);

            CREATE INDEX IF NOT EXISTS idx_files_review_mtime
            ON files(is_stale, requires_confirmation, suggested_action, mtime DESC);

            CREATE INDEX IF NOT EXISTS idx_files_risk_mtime
            ON files(is_stale, risk_level, mtime DESC);

            CREATE INDEX IF NOT EXISTS idx_files_scope_path
            ON files(is_stale, path);
            "#,
            )?;
            set_schema_version(conn, 11)?;
        }
        if version < 12 {
            ensure_trigram_fts(conn)?;
            ensure_fts_triggers(conn)?;
            set_schema_version(conn, 12)?;
        }
        if version < 13 {
            conn.execute_batch(
                r#"
            CREATE TABLE IF NOT EXISTS cleanup_trash_batches (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                root TEXT,
                total_items INTEGER NOT NULL,
                total_size INTEGER NOT NULL,
                status TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS cleanup_trash_items (
                id TEXT PRIMARY KEY,
                batch_id TEXT NOT NULL,
                original_path TEXT NOT NULL,
                trash_path TEXT NOT NULL,
                name TEXT NOT NULL,
                size INTEGER NOT NULL,
                moved_at TEXT NOT NULL,
                restored_at TEXT,
                status TEXT NOT NULL,
                message TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_cleanup_trash_items_batch_id
            ON cleanup_trash_items(batch_id);
            CREATE INDEX IF NOT EXISTS idx_cleanup_trash_batches_created_at
            ON cleanup_trash_batches(created_at DESC);
            "#,
            )?;
            set_schema_version(conn, 13)?;
        }
        if version < 14 {
            conn.execute_batch(
                r#"
            CREATE TABLE IF NOT EXISTS classification_history (
                id TEXT PRIMARY KEY,
                file_id TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                extension TEXT NOT NULL DEFAULT '',
                source TEXT NOT NULL,
                file_type TEXT NOT NULL,
                purpose TEXT NOT NULL,
                lifecycle TEXT NOT NULL,
                context TEXT NOT NULL DEFAULT '',
                risk_level TEXT NOT NULL,
                suggested_action TEXT NOT NULL,
                suggested_target_path TEXT NOT NULL DEFAULT '',
                suggested_name TEXT NOT NULL DEFAULT '',
                confidence REAL NOT NULL DEFAULT 0.5,
                reason TEXT NOT NULL DEFAULT '',
                keywords_json TEXT NOT NULL DEFAULT '[]',
                user_confirmed INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_classification_history_file_id
            ON classification_history(file_id);
            CREATE INDEX IF NOT EXISTS idx_classification_history_name
            ON classification_history(file_name);
            CREATE INDEX IF NOT EXISTS idx_classification_history_confirmed
            ON classification_history(user_confirmed);
            CREATE INDEX IF NOT EXISTS idx_classification_history_source
            ON classification_history(source);

            CREATE TABLE IF NOT EXISTS classification_feedback (
                id TEXT PRIMARY KEY,
                file_id TEXT NOT NULL,
                file_name TEXT NOT NULL,
                original_json TEXT NOT NULL,
                corrected_json TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_classification_feedback_file_id
            ON classification_feedback(file_id);
            "#,
            )?;
            set_schema_version(conn, 14)?;
        }
        if version < 15 {
            conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS operation_batches (
                id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, status TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS operation_logs (
                id TEXT PRIMARY KEY, batch_id TEXT NOT NULL, operation_type TEXT NOT NULL,
                source_path TEXT NOT NULL, target_path TEXT NOT NULL, old_name TEXT NOT NULL,
                new_name TEXT NOT NULL, status TEXT NOT NULL, error_message TEXT,
                created_at INTEGER NOT NULL, can_undo INTEGER NOT NULL DEFAULT 0,
                path_before TEXT NOT NULL, path_after TEXT NOT NULL, name_before TEXT NOT NULL,
                name_after TEXT NOT NULL, can_restore INTEGER NOT NULL DEFAULT 0,
                restored_at INTEGER, restore_status TEXT NOT NULL DEFAULT 'not_restored',
                restore_error TEXT
            );
            CREATE TABLE IF NOT EXISTS cleanup_trash_batches (
                id TEXT PRIMARY KEY, created_at TEXT NOT NULL, root TEXT,
                total_items INTEGER NOT NULL, total_size INTEGER NOT NULL, status TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS cleanup_trash_items (
                id TEXT PRIMARY KEY, batch_id TEXT NOT NULL, original_path TEXT NOT NULL,
                trash_path TEXT NOT NULL, name TEXT NOT NULL, size INTEGER NOT NULL,
                moved_at TEXT NOT NULL, restored_at TEXT, status TEXT NOT NULL, message TEXT
            );

            CREATE TRIGGER IF NOT EXISTS operation_logs_batch_guard_insert
            BEFORE INSERT ON operation_logs
            WHEN NOT EXISTS (SELECT 1 FROM operation_batches WHERE id = NEW.batch_id)
            BEGIN SELECT RAISE(ABORT, 'operation log batch does not exist'); END;

            CREATE TRIGGER IF NOT EXISTS operation_logs_status_guard_insert
            BEFORE INSERT ON operation_logs
            WHEN NEW.status NOT IN ('pending', 'success', 'failed', 'skipped')
              OR NEW.restore_status NOT IN ('not_restored', 'pending', 'restored', 'failed', 'unavailable', 'canceled')
            BEGIN SELECT RAISE(ABORT, 'invalid operation log status'); END;

            CREATE TRIGGER IF NOT EXISTS operation_logs_status_guard_update
            BEFORE UPDATE OF status, restore_status ON operation_logs
            WHEN NEW.status NOT IN ('pending', 'success', 'failed', 'skipped')
              OR NEW.restore_status NOT IN ('not_restored', 'pending', 'restored', 'failed', 'unavailable', 'canceled')
            BEGIN SELECT RAISE(ABORT, 'invalid operation log status'); END;

            CREATE TRIGGER IF NOT EXISTS cleanup_items_batch_guard_insert
            BEFORE INSERT ON cleanup_trash_items
            WHEN NOT EXISTS (SELECT 1 FROM cleanup_trash_batches WHERE id = NEW.batch_id)
            BEGIN SELECT RAISE(ABORT, 'cleanup item batch does not exist'); END;

            CREATE TRIGGER IF NOT EXISTS cleanup_items_status_guard_insert
            BEFORE INSERT ON cleanup_trash_items
            WHEN NEW.status NOT IN ('pending', 'moved', 'restored', 'failed', 'missing')
            BEGIN SELECT RAISE(ABORT, 'invalid cleanup item status'); END;

            CREATE TRIGGER IF NOT EXISTS cleanup_items_status_guard_update
            BEFORE UPDATE OF status ON cleanup_trash_items
            WHEN NEW.status NOT IN ('pending', 'moved', 'restored', 'failed', 'missing')
            BEGIN SELECT RAISE(ABORT, 'invalid cleanup item status'); END;
            "#,
        )?;
            set_schema_version(conn, 15)?;
        }
        if version < 16 {
            conn.execute_batch(
            r#"
            DROP TRIGGER IF EXISTS operation_logs_status_guard_insert;
            DROP TRIGGER IF EXISTS operation_logs_status_guard_update;

            CREATE TRIGGER operation_logs_status_guard_insert
            BEFORE INSERT ON operation_logs
            WHEN NEW.status NOT IN ('pending', 'success', 'failed', 'skipped')
              OR NEW.restore_status NOT IN ('not_restored', 'pending', 'restored', 'failed', 'unavailable', 'canceled')
            BEGIN SELECT RAISE(ABORT, 'invalid operation log status'); END;

            CREATE TRIGGER operation_logs_status_guard_update
            BEFORE UPDATE OF status, restore_status ON operation_logs
            WHEN NEW.status NOT IN ('pending', 'success', 'failed', 'skipped')
              OR NEW.restore_status NOT IN ('not_restored', 'pending', 'restored', 'failed', 'unavailable', 'canceled')
            BEGIN SELECT RAISE(ABORT, 'invalid operation log status'); END;
            "#,
        )?;
            set_schema_version(conn, 16)?;
        }
        if version < 17 {
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
            )?;
            execute_column_migrations(
                conn,
                &["ALTER TABLE app_settings ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;"],
            )?;
            conn.execute(
                "INSERT OR IGNORE INTO app_settings (key, value, revision) VALUES (?1, ?2, 0)",
                params![
                    crate::settings::APP_SETTINGS_KEY,
                    crate::settings::default_settings_json()?
                ],
            )?;
            set_schema_version(conn, 17)?;
        }
        if version < 18 {
            execute_column_migrations(
                conn,
                &[
                    "ALTER TABLE operation_logs ADD COLUMN source_size INTEGER;",
                    "ALTER TABLE operation_logs ADD COLUMN source_modified_ns TEXT;",
                    "ALTER TABLE operation_logs ADD COLUMN source_platform_file_id TEXT;",
                    "ALTER TABLE operation_logs ADD COLUMN source_quick_hash TEXT;",
                    "ALTER TABLE operation_logs ADD COLUMN target_platform_file_id TEXT;",
                ],
            )?;
            conn.execute_batch(
                r#"
                DROP TRIGGER IF EXISTS operation_logs_status_guard_insert;
                DROP TRIGGER IF EXISTS operation_logs_status_guard_update;
                CREATE TRIGGER operation_logs_status_guard_insert
                BEFORE INSERT ON operation_logs
                WHEN NEW.status NOT IN ('pending', 'success', 'failed', 'skipped', 'manual_review')
                  OR NEW.restore_status NOT IN ('not_restored', 'pending', 'restored', 'failed', 'unavailable', 'canceled', 'manual_review')
                BEGIN SELECT RAISE(ABORT, 'invalid operation log status'); END;
                CREATE TRIGGER operation_logs_status_guard_update
                BEFORE UPDATE OF status, restore_status ON operation_logs
                WHEN NEW.status NOT IN ('pending', 'success', 'failed', 'skipped', 'manual_review')
                  OR NEW.restore_status NOT IN ('not_restored', 'pending', 'restored', 'failed', 'unavailable', 'canceled', 'manual_review')
                BEGIN SELECT RAISE(ABORT, 'invalid operation log status'); END;
                "#,
            )?;
            set_schema_version(conn, 18)?;
        }
        if version < 19 {
            execute_column_migrations(
                conn,
                &[
                    "ALTER TABLE cleanup_trash_items ADD COLUMN source_modified_ns TEXT;",
                    "ALTER TABLE cleanup_trash_items ADD COLUMN source_platform_file_id TEXT;",
                    "ALTER TABLE cleanup_trash_items ADD COLUMN source_quick_hash TEXT;",
                    "ALTER TABLE cleanup_trash_items ADD COLUMN trash_modified_ns TEXT;",
                    "ALTER TABLE cleanup_trash_items ADD COLUMN trash_platform_volume_id TEXT;",
                    "ALTER TABLE cleanup_trash_items ADD COLUMN trash_platform_file_id TEXT;",
                    "ALTER TABLE cleanup_trash_items ADD COLUMN trash_quick_hash TEXT;",
                    "ALTER TABLE cleanup_trash_items ADD COLUMN identity_status TEXT NOT NULL DEFAULT 'legacy_unverified';",
                ],
            )?;
            set_schema_version(conn, 19)?;
        }
        if version < 20 {
            migrate_invalid_rule_domain_values(conn)?;
            conn.execute(
                r#"
                UPDATE operation_logs
                SET can_restore = 0,
                    restore_status = 'manual_review',
                    restore_error = 'manual_review: legacy identity unavailable'
                WHERE status = 'success'
                  AND can_restore = 1
                  AND (
                    source_size IS NULL
                    OR source_modified_ns IS NULL
                    OR source_quick_hash IS NULL
                    OR target_platform_file_id IS NULL
                  )
                "#,
                [],
            )?;
            set_schema_version(conn, 20)?;
        }
        if version < 21 {
            execute_column_migrations(
                conn,
                &[
                    "ALTER TABLE operation_logs ADD COLUMN source_full_hash TEXT;",
                    "ALTER TABLE operation_logs ADD COLUMN target_full_hash TEXT;",
                    "ALTER TABLE cleanup_trash_items ADD COLUMN source_full_hash TEXT;",
                    "ALTER TABLE cleanup_trash_items ADD COLUMN trash_full_hash TEXT;",
                ],
            )?;
            conn.execute(
                r#"
                UPDATE operation_logs
                SET can_restore = 0,
                    restore_status = 'manual_review',
                    restore_error = 'manual_review: complete identity unavailable'
                WHERE status = 'success'
                  AND can_restore = 1
                  AND (source_full_hash IS NULL OR target_full_hash IS NULL)
                "#,
                [],
            )?;
            conn.execute(
                r#"
                UPDATE cleanup_trash_items
                SET identity_status = 'legacy_unverified',
                    message = COALESCE(message, 'Complete identity is unavailable; manual review is required.')
                WHERE status = 'moved'
                  AND (source_full_hash IS NULL OR trash_full_hash IS NULL)
                "#,
                [],
            )?;
            set_schema_version(conn, 21)?;
        }
        if version < 22 {
            execute_column_migrations(
                conn,
                &[
                    "ALTER TABLE operation_logs ADD COLUMN source_claim_path TEXT;",
                    "ALTER TABLE operation_logs ADD COLUMN operation_phase TEXT NOT NULL DEFAULT 'completed';",
                    "ALTER TABLE operation_logs ADD COLUMN claim_created_at TEXT;",
                    "ALTER TABLE operation_logs ADD COLUMN claim_platform_file_id TEXT;",
                    "ALTER TABLE operation_logs ADD COLUMN claim_full_hash TEXT;",
                    "ALTER TABLE cleanup_trash_items ADD COLUMN source_claim_path TEXT;",
                    "ALTER TABLE cleanup_trash_items ADD COLUMN operation_phase TEXT NOT NULL DEFAULT 'completed';",
                    "ALTER TABLE cleanup_trash_items ADD COLUMN claim_created_at TEXT;",
                    "ALTER TABLE cleanup_trash_items ADD COLUMN claim_platform_file_id TEXT;",
                    "ALTER TABLE cleanup_trash_items ADD COLUMN claim_full_hash TEXT;",
                ],
            )?;
            conn.execute_batch(
                r#"
                DROP TRIGGER IF EXISTS operation_logs_phase_guard_insert;
                DROP TRIGGER IF EXISTS operation_logs_phase_guard_update;
                CREATE TRIGGER operation_logs_phase_guard_insert
                BEFORE INSERT ON operation_logs
                WHEN NEW.operation_phase NOT IN ('prepared', 'source_claimed', 'copying',
                    'target_committed', 'source_cleanup_pending', 'completed',
                    'rolled_back', 'manual_review')
                BEGIN SELECT RAISE(ABORT, 'invalid operation phase'); END;
                CREATE TRIGGER operation_logs_phase_guard_update
                BEFORE UPDATE OF operation_phase ON operation_logs
                WHEN NEW.operation_phase NOT IN ('prepared', 'source_claimed', 'copying',
                    'target_committed', 'source_cleanup_pending', 'completed',
                    'rolled_back', 'manual_review')
                BEGIN SELECT RAISE(ABORT, 'invalid operation phase'); END;

                DROP TRIGGER IF EXISTS cleanup_items_phase_guard_insert;
                DROP TRIGGER IF EXISTS cleanup_items_phase_guard_update;
                CREATE TRIGGER cleanup_items_phase_guard_insert
                BEFORE INSERT ON cleanup_trash_items
                WHEN NEW.operation_phase NOT IN ('prepared', 'source_claimed', 'copying',
                    'target_committed', 'source_cleanup_pending', 'completed',
                    'rolled_back', 'manual_review')
                BEGIN SELECT RAISE(ABORT, 'invalid cleanup operation phase'); END;
                CREATE TRIGGER cleanup_items_phase_guard_update
                BEFORE UPDATE OF operation_phase ON cleanup_trash_items
                WHEN NEW.operation_phase NOT IN ('prepared', 'source_claimed', 'copying',
                    'target_committed', 'source_cleanup_pending', 'completed',
                    'rolled_back', 'manual_review')
                BEGIN SELECT RAISE(ABORT, 'invalid cleanup operation phase'); END;

                DROP TRIGGER IF EXISTS cleanup_items_status_guard_insert;
                DROP TRIGGER IF EXISTS cleanup_items_status_guard_update;
                CREATE TRIGGER cleanup_items_status_guard_insert
                BEFORE INSERT ON cleanup_trash_items
                WHEN NEW.status NOT IN ('pending', 'moved', 'restored', 'failed', 'missing',
                    'manual_review', 'canceled')
                BEGIN SELECT RAISE(ABORT, 'invalid cleanup item status'); END;
                CREATE TRIGGER cleanup_items_status_guard_update
                BEFORE UPDATE OF status ON cleanup_trash_items
                WHEN NEW.status NOT IN ('pending', 'moved', 'restored', 'failed', 'missing',
                    'manual_review', 'canceled')
                BEGIN SELECT RAISE(ABORT, 'invalid cleanup item status'); END;
                "#,
            )?;
            set_schema_version(conn, 22)?;
        }
        Ok(())
    })();
    match migration_result {
        Ok(()) => {
            conn.execute_batch("COMMIT")?;
            Ok(())
        }
        Err(error) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(error)
        }
    }
}

fn ensure_journal_state_triggers(conn: &Connection) -> Result<(), DbError> {
    conn.execute_batch(
        r#"
        DROP TRIGGER IF EXISTS cleanup_items_status_guard_insert;
        DROP TRIGGER IF EXISTS cleanup_items_status_guard_update;
        CREATE TRIGGER cleanup_items_status_guard_insert
        BEFORE INSERT ON cleanup_trash_items
        WHEN NEW.status NOT IN ('pending', 'moved', 'restored', 'failed', 'missing',
            'manual_review', 'canceled')
        BEGIN SELECT RAISE(ABORT, 'invalid cleanup item status'); END;
        CREATE TRIGGER cleanup_items_status_guard_update
        BEFORE UPDATE OF status ON cleanup_trash_items
        WHEN NEW.status NOT IN ('pending', 'moved', 'restored', 'failed', 'missing',
            'manual_review', 'canceled')
        BEGIN SELECT RAISE(ABORT, 'invalid cleanup item status'); END;
        "#,
    )?;
    Ok(())
}

fn migrate_invalid_rule_domain_values(conn: &Connection) -> Result<(), DbError> {
    let compatible_rules_columns = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('rules') WHERE name IN ('source', 'root_operator', 'groups_json', 'action_json')",
        [],
        |row| row.get::<_, i64>(0),
    )?;
    if compatible_rules_columns != 4 {
        return Ok(());
    }
    let migrations = [
        (
            "purpose",
            "'Project','Teaching','Study','Work','Personal','Career','Finance','Identity','Media','Installer','Temporary','Archive','Document','Duplicate Review','Unknown'",
        ),
        (
            "lifecycle",
            "'Inbox','Active','Reference','Archive','Disposable','Duplicate','Sensitive','TrashReview','Unknown'",
        ),
        (
            "risk_level",
            "'Normal','Sensitive','System','Caution','Unknown'",
        ),
        (
            "suggested_action",
            "'Keep','Rename','Move','MoveAndRename','Archive','Review','DeleteCandidate','Unknown'",
        ),
    ];
    for (field, allowed) in migrations {
        conn.execute(
            &format!(
                "UPDATE rules SET action_json = json_set(action_json, '$.{field}', 'Unknown') \
                 WHERE json_valid(action_json) \
                 AND json_type(action_json, '$.{field}') = 'text' \
                 AND json_extract(action_json, '$.{field}') NOT IN ({allowed})"
            ),
            [],
        )?;
    }
    conn.execute(
        "UPDATE rules SET source = 'unknown' WHERE source NOT IN ('system', 'user', 'session', 'ai', 'learned', 'unknown')",
        [],
    )?;
    conn.execute(
        "UPDATE rules SET root_operator = 'UNKNOWN' WHERE root_operator NOT IN ('AND', 'OR', 'UNKNOWN')",
        [],
    )?;

    let mut stmt = conn.prepare("SELECT id, groups_json FROM rules")?;
    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    drop(stmt);
    for (id, groups_json) in rows {
        let Ok(mut groups) = serde_json::from_str::<Value>(&groups_json) else {
            continue;
        };
        let mut changed = false;
        if let Some(group_values) = groups.as_array_mut() {
            for group in group_values {
                let Some(group_object) = group.as_object_mut() else {
                    continue;
                };
                let operator = group_object
                    .get("operator")
                    .and_then(Value::as_str)
                    .unwrap_or("UNKNOWN");
                if !matches!(operator, "AND" | "OR" | "UNKNOWN") {
                    group_object
                        .insert("operator".to_string(), Value::String("UNKNOWN".to_string()));
                    changed = true;
                }
                let Some(conditions) = group_object
                    .get_mut("conditions")
                    .and_then(Value::as_array_mut)
                else {
                    continue;
                };
                for condition in conditions {
                    let Some(condition_object) = condition.as_object_mut() else {
                        continue;
                    };
                    let field = condition_object
                        .get("field")
                        .and_then(Value::as_str)
                        .unwrap_or("unknown");
                    if !matches!(
                        field,
                        "name"
                            | "extension"
                            | "file_type"
                            | "path"
                            | "directory"
                            | "size"
                            | "modified_at"
                            | "is_duplicate"
                            | "risk_level"
                            | "unknown"
                    ) {
                        condition_object
                            .insert("field".to_string(), Value::String("unknown".to_string()));
                        changed = true;
                    }
                    let operator = condition_object
                        .get("operator")
                        .and_then(Value::as_str)
                        .unwrap_or("unknown");
                    if !matches!(
                        operator,
                        "contains"
                            | "equals"
                            | "startsWith"
                            | "endsWith"
                            | "is"
                            | "greaterThan"
                            | "lessThan"
                            | "olderThanDays"
                            | "newerThanDays"
                            | "unknown"
                    ) {
                        condition_object
                            .insert("operator".to_string(), Value::String("unknown".to_string()));
                        changed = true;
                    }
                }
            }
        }
        if changed {
            conn.execute(
                "UPDATE rules SET groups_json = ?2 WHERE id = ?1",
                params![id, serde_json::to_string(&groups)?],
            )?;
        }
    }
    Ok(())
}

fn execute_column_migrations(conn: &Connection, statements: &[&str]) -> Result<(), DbError> {
    for statement in statements {
        match conn.execute_batch(statement) {
            Ok(()) => {}
            Err(rusqlite::Error::SqliteFailure(_, Some(message)))
                if message.contains("duplicate column name") => {}
            Err(error) => return Err(DbError::Sqlite(error)),
        }
    }
    Ok(())
}

fn ensure_trigram_fts(conn: &Connection) -> Result<(), DbError> {
    let existing_sql = conn
        .query_row(
            "SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = 'files_fts'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()?;

    if existing_sql
        .as_deref()
        .map(is_trigram_fts_definition)
        .unwrap_or(false)
    {
        return Ok(());
    }

    conn.execute_batch(
        r#"
        DROP TRIGGER IF EXISTS files_ai;
        DROP TRIGGER IF EXISTS files_ad;
        DROP TRIGGER IF EXISTS files_au;
        DROP TABLE IF EXISTS files_fts;

        CREATE VIRTUAL TABLE files_fts USING fts5(
            name,
            path,
            content='files',
            content_rowid='rowid',
            tokenize='trigram'
        );

        INSERT INTO files_fts(files_fts) VALUES('rebuild');
        "#,
    )?;
    Ok(())
}

fn ensure_fts_triggers(conn: &Connection) -> Result<(), DbError> {
    conn.execute_batch(
        r#"
        CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
            INSERT INTO files_fts(rowid, name, path) VALUES (new.rowid, new.name, new.path);
        END;
        CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
            INSERT INTO files_fts(files_fts, rowid, name, path)
            VALUES('delete', old.rowid, old.name, old.path);
        END;
        CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE ON files BEGIN
            INSERT INTO files_fts(files_fts, rowid, name, path)
            VALUES('delete', old.rowid, old.name, old.path);
            INSERT INTO files_fts(rowid, name, path) VALUES (new.rowid, new.name, new.path);
        END;
        "#,
    )?;
    Ok(())
}

fn is_trigram_fts_definition(sql: &str) -> bool {
    let normalized = sql.to_ascii_lowercase().replace(char::is_whitespace, "");
    normalized.contains("tokenize='trigram'") || normalized.contains("tokenize=\"trigram\"")
}
