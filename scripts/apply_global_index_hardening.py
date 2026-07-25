from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one literal match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def regex_once(path: Path, pattern: str, replacement: str) -> None:
    text = path.read_text(encoding="utf-8")
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{path}: expected one regex match, found {count}: {pattern}")
    path.write_text(updated, encoding="utf-8")


schema = ROOT / "src-tauri/src/db/schema.rs"
replace_once(schema, "const CURRENT_SCHEMA_VERSION: i32 = 25;", "const CURRENT_SCHEMA_VERSION: i32 = 26;")
replace_once(
    schema,
    """    if version == CURRENT_SCHEMA_VERSION {
        ensure_global_index_schema(conn)?;
        ensure_journal_state_triggers(conn)?;
        return Ok(());
    }
""",
    """    if version == CURRENT_SCHEMA_VERSION {
        ensure_global_index_schema(conn)?;
        ensure_global_index_hardening(conn)?;
        ensure_journal_state_triggers(conn)?;
        return Ok(());
    }
""",
)
replace_once(
    schema,
    """        if version < 25 {
            ensure_global_index_schema(conn)?;
            set_schema_version(conn, 25)?;
        }
        Ok(())
""",
    """        if version < 25 {
            ensure_global_index_schema(conn)?;
            set_schema_version(conn, 25)?;
        }
        if version < 26 {
            ensure_global_index_hardening(conn)?;
            set_schema_version(conn, 26)?;
        }
        Ok(())
""",
)
replace_once(
    schema,
    "CREATE TRIGGER IF NOT EXISTS global_entries_au AFTER UPDATE ON global_entries BEGIN",
    "CREATE TRIGGER IF NOT EXISTS global_entries_au AFTER UPDATE OF name, path, extension ON global_entries\n        WHEN old.name IS NOT new.name OR old.path IS NOT new.path OR old.extension IS NOT new.extension BEGIN",
)
hardening_function = r'''
fn ensure_global_index_hardening(conn: &Connection) -> Result<(), DbError> {
    conn.execute_batch(
        r#"
        DROP TRIGGER IF EXISTS global_entries_au;
        CREATE TRIGGER global_entries_au
        AFTER UPDATE OF name, path, extension ON global_entries
        WHEN old.name IS NOT new.name
          OR old.path IS NOT new.path
          OR old.extension IS NOT new.extension
        BEGIN
            INSERT INTO global_entries_fts(global_entries_fts, rowid, name, path, extension)
            VALUES ('delete', old.rowid, old.name, old.path, old.extension);
            INSERT INTO global_entries_fts(rowid, name, path, extension)
            VALUES (new.rowid, new.name, new.path, new.extension);
        END;

        DROP TRIGGER IF EXISTS global_entries_count_ai;
        DROP TRIGGER IF EXISTS global_entries_count_ad;
        DROP TRIGGER IF EXISTS global_entries_count_au;
        CREATE TRIGGER global_entries_count_ai
        AFTER INSERT ON global_entries
        WHEN new.is_stale = 0
        BEGIN
            UPDATE global_volumes
            SET entry_count = entry_count + 1, updated_at = new.last_seen_at
            WHERE id = new.volume_id;
        END;
        CREATE TRIGGER global_entries_count_ad
        AFTER DELETE ON global_entries
        WHEN old.is_stale = 0
        BEGIN
            UPDATE global_volumes
            SET entry_count = MAX(0, entry_count - 1), updated_at = unixepoch()
            WHERE id = old.volume_id;
        END;
        CREATE TRIGGER global_entries_count_au
        AFTER UPDATE OF is_stale, volume_id ON global_entries
        WHEN old.is_stale IS NOT new.is_stale OR old.volume_id IS NOT new.volume_id
        BEGIN
            UPDATE global_volumes
            SET entry_count = MAX(0, entry_count - CASE WHEN old.is_stale = 0 THEN 1 ELSE 0 END),
                updated_at = unixepoch()
            WHERE id = old.volume_id;
            UPDATE global_volumes
            SET entry_count = entry_count + CASE WHEN new.is_stale = 0 THEN 1 ELSE 0 END,
                updated_at = unixepoch()
            WHERE id = new.volume_id;
        END;

        DROP TRIGGER IF EXISTS ai_jobs_canceled_terminal;
        CREATE TRIGGER ai_jobs_canceled_terminal
        BEFORE UPDATE OF status ON ai_jobs
        WHEN old.status = 'canceled' AND new.status <> 'canceled'
        BEGIN
            SELECT RAISE(ABORT, 'canceled AI jobs are terminal');
        END;

        CREATE INDEX IF NOT EXISTS idx_global_entries_active_name
            ON global_entries(name_normalized, modified_at_fs DESC)
            WHERE is_stale = 0;
        CREATE INDEX IF NOT EXISTS idx_global_entries_active_extension
            ON global_entries(extension, modified_at_fs DESC)
            WHERE is_stale = 0;

        UPDATE global_volumes
        SET entry_count = (
            SELECT COUNT(*) FROM global_entries entry
            WHERE entry.volume_id = global_volumes.id AND entry.is_stale = 0
        );
        "#,
    )?;
    Ok(())
}

'''
replace_once(schema, "fn ensure_journal_state_triggers(conn: &Connection) -> Result<(), DbError> {", hardening_function + "fn ensure_journal_state_triggers(conn: &Connection) -> Result<(), DbError> {")

repository = ROOT / "src-tauri/src/global_index/repository.rs"
replace_once(
    repository,
    """        let transaction = conn.transaction()?;
        let mut count = 0;
        for entry in entries {
""",
    """        let transaction = conn.transaction()?;
        let scope_policies = load_enabled_scope_policies(&transaction)?;
        let mut count = 0;
        for entry in entries {
""",
)
replace_once(
    repository,
    "enqueue_ai_jobs_for_entry(&transaction, &entry_id, entry)?;",
    "enqueue_ai_jobs_for_entry_with_scopes(&transaction, &entry_id, entry, &scope_policies)?;",
)
regex_once(
    repository,
    r'''        transaction\.execute\(\n            r#"\n            UPDATE global_volumes\n            SET entry_count = \(SELECT COUNT\(\*\) FROM global_entries WHERE volume_id = global_volumes\.id AND is_stale = 0\),\n                updated_at = \?1\n            WHERE id IN \(SELECT DISTINCT volume_id FROM global_entries WHERE last_seen_at >= \?2\)\n            "#,\n            params!\[unix_now\(\), entries\.iter\(\)\.map\(\|entry\| entry\.last_seen_at\)\.min\(\)\.unwrap_or_default\(\)\],\n        \)\?;\n''',
    "",
)
helper_pattern = r'''pub\(crate\) fn enqueue_ai_jobs_for_entry\(\n    transaction: &Transaction<'_>,\n    entry_id: &str,\n    entry: &GlobalEntryInput,\n\) -> Result<\(\), DbError> \{\n    let fingerprint = metadata_fingerprint\(entry\);\n    let path_normalized = normalize_path\(&entry\.path\);\n    let mut scope_statement = transaction\.prepare\(\n        r#"\n        SELECT id, allow_local_ai, allow_cloud_ai, path\n        FROM managed_scopes\n        WHERE enabled = 1\n        "#,\n    \)\?;\n    let scopes = scope_statement\n        \.query_map\(\[\], \|row\| \{\n            Ok\(\(\n                row\.get::<_, String>\(0\)\?,\n                row\.get::<_, i64>\(1\)\? != 0,\n                row\.get::<_, i64>\(2\)\? != 0,\n                normalize_path\(&row\.get::<_, String>\(3\)\?\),\n            \)\)\n        \}\)\?\n        \.collect::<Result<Vec<_>, _>>\(\)\?;\n    drop\(scope_statement\);\n    for \(scope_id, allow_local_ai, allow_cloud_ai, scope_path\) in scopes \{'''
helper_replacement = r'''#[derive(Debug, Clone)]
pub(crate) struct ManagedScopePolicy {
    id: String,
    allow_local_ai: bool,
    allow_cloud_ai: bool,
    path: String,
}

pub(crate) fn load_enabled_scope_policies(
    transaction: &Transaction<'_>,
) -> Result<Vec<ManagedScopePolicy>, DbError> {
    let mut statement = transaction.prepare(
        r#"
        SELECT id, allow_local_ai, allow_cloud_ai, path
        FROM managed_scopes
        WHERE enabled = 1
        ORDER BY length(path) DESC, id ASC
        "#,
    )?;
    statement
        .query_map([], |row| {
            Ok(ManagedScopePolicy {
                id: row.get(0)?,
                allow_local_ai: row.get::<_, i64>(1)? != 0,
                allow_cloud_ai: row.get::<_, i64>(2)? != 0,
                path: normalize_path(&row.get::<_, String>(3)?),
            })
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(DbError::from)
}

pub(crate) fn enqueue_ai_jobs_for_entry(
    transaction: &Transaction<'_>,
    entry_id: &str,
    entry: &GlobalEntryInput,
) -> Result<(), DbError> {
    let scopes = load_enabled_scope_policies(transaction)?;
    enqueue_ai_jobs_for_entry_with_scopes(transaction, entry_id, entry, &scopes)
}

pub(crate) fn enqueue_ai_jobs_for_entry_with_scopes(
    transaction: &Transaction<'_>,
    entry_id: &str,
    entry: &GlobalEntryInput,
    scopes: &[ManagedScopePolicy],
) -> Result<(), DbError> {
    let fingerprint = metadata_fingerprint(entry);
    let path_normalized = normalize_path(&entry.path);
    for scope in scopes {
        let scope_id = &scope.id;
        let allow_local_ai = scope.allow_local_ai;
        let allow_cloud_ai = scope.allow_cloud_ai;
        let scope_path = &scope.path;'''
regex_once(repository, helper_pattern, helper_replacement)
replace_once(
    repository,
    "if matches!(status.as_str(), AI_JOB_STALE | AI_JOB_CANCELED) {",
    "if status == AI_JOB_STALE {",
)

managed_scope = ROOT / "src-tauri/src/global_index/managed_scope.rs"
replace_once(
    managed_scope,
    "use super::repository::{enqueue_ai_jobs_for_entry, global_entry_input_from_row};",
    "use super::repository::{enqueue_ai_jobs_for_entry_with_scopes, global_entry_input_from_row, load_enabled_scope_policies};",
)
replace_once(
    managed_scope,
    """        let entries = load_entries_in_scope(&transaction, &scope.path)?;
        for entry in entries {
            let entry_id = entry.entry_id();
            upsert_managed_entry(&transaction, &scope.id, &entry_id, scope.enabled, now)?;
            enqueue_ai_jobs_for_entry(&transaction, &entry_id, &entry)?;
        }
        transaction.commit()?;
        Ok(scope)
""",
    """        transaction.commit()?;
        backfill_managed_scope(self, &scope)?;
        Ok(scope)
""",
)
backfill = r'''
fn backfill_managed_scope(db: &Database, scope: &ManagedScope) -> Result<(), DbError> {
    const BATCH_SIZE: i64 = 512;
    let normalized_scope = normalize_path(&scope.path);
    let pattern = format!("{}%", escape_like(normalized_scope.trim_end_matches('/')) + "/");
    let mut last_id = String::new();
    loop {
        let entries = {
            let conn = db.conn()?;
            let mut statement = conn.prepare(
                r#"
                SELECT volume_id, platform_file_id, parent_platform_file_id, name, path,
                       extension, is_directory, size, created_at_fs, modified_at_fs,
                       file_attributes, is_hidden, is_system, source_provider, last_seen_at,
                       id
                FROM global_entries
                WHERE is_stale = 0
                  AND id > ?3
                  AND (path_normalized = ?1 OR path_normalized LIKE ?2 ESCAPE '~')
                ORDER BY id
                LIMIT ?4
                "#,
            )?;
            statement
                .query_map(params![normalized_scope, pattern, last_id, BATCH_SIZE], |row| {
                    Ok((global_entry_input_from_row(row)?, row.get::<_, String>(15)?))
                })?
                .collect::<Result<Vec<_>, _>>()?
        };
        if entries.is_empty() {
            break;
        }
        last_id = entries.last().map(|(_, id)| id.clone()).unwrap_or_default();
        let mut conn = db.conn()?;
        let transaction = conn.transaction()?;
        let policies = load_enabled_scope_policies(&transaction)?;
        let now = unix_now();
        for (entry, entry_id) in &entries {
            upsert_managed_entry(&transaction, &scope.id, entry_id, scope.enabled, now)?;
            enqueue_ai_jobs_for_entry_with_scopes(
                &transaction,
                entry_id,
                entry,
                &policies,
            )?;
        }
        transaction.commit()?;
        if entries.len() < BATCH_SIZE as usize {
            break;
        }
    }
    Ok(())
}

'''
replace_once(managed_scope, "fn load_entries_in_scope(\n", backfill + "fn load_entries_in_scope(\n")

# The old all-at-once loader is no longer used after paged backfill.
regex_once(
    managed_scope,
    r'''fn load_entries_in_scope\(\n    transaction: &Transaction<'_>,\n    scope_path: &str,\n\) -> Result<Vec<GlobalEntryInput>, DbError> \{.*?\n\}\n\n''',
    "",
)

index_tests = ROOT / "src-tauri/src/global_index/tests.rs"
replace_once(index_tests, "assert_eq!(version, 25);", "assert_eq!(version, 26);")

print("Applied global-index hardening patch")
