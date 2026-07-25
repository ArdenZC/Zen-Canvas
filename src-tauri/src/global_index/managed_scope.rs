use super::models::*;
use super::repository::{
    enqueue_ai_jobs_for_entry_with_scopes, global_entry_input_from_row, load_enabled_scope_policies,
};
use crate::db::{Database, DbError};
use rusqlite::{params, OptionalExtension, Transaction};

const INITIAL_MANAGED_AI_JOB_LIMIT: usize = 100;

impl Database {
    pub fn list_managed_scopes(&self) -> Result<Vec<ManagedScope>, DbError> {
        let conn = self.conn()?;
        let mut statement = conn.prepare(
            r#"
            SELECT id, path, global_entry_id, enabled, allow_local_ai,
                   allow_cloud_ai, created_at, updated_at
            FROM managed_scopes
            ORDER BY path COLLATE NOCASE
            "#,
        )?;
        let rows = statement.query_map([], map_managed_scope)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(DbError::from)
    }

    pub fn add_managed_scope(
        &self,
        request: AddManagedScopeRequest,
    ) -> Result<ManagedScope, DbError> {
        let path = normalize_path(request.path.trim());
        if path.is_empty() {
            return Err(DbError::Validation(
                "managed scope path cannot be empty".to_string(),
            ));
        }
        let now = unix_now();
        let scope_id = format!("ms_{}", blake3::hash(path.as_bytes()).to_hex());
        let mut conn = self.conn()?;
        let transaction = conn.transaction()?;
        let resolved_global_entry_id = match request.global_entry_id {
            Some(global_entry_id) => Some(global_entry_id),
            None => transaction
                .query_row(
                    "SELECT id FROM global_entries WHERE path_normalized = ?1 AND is_stale = 0 LIMIT 1",
                    params![path],
                    |row| row.get(0),
                )
                .optional()?,
        };
        transaction.execute(
            r#"
            INSERT INTO managed_scopes (
                id, path, global_entry_id, enabled, allow_local_ai,
                allow_cloud_ai, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
            ON CONFLICT(path) DO UPDATE SET
                global_entry_id = COALESCE(excluded.global_entry_id, managed_scopes.global_entry_id),
                enabled = excluded.enabled,
                allow_local_ai = excluded.allow_local_ai,
                allow_cloud_ai = excluded.allow_cloud_ai,
                updated_at = excluded.updated_at
            "#,
            params![
                scope_id,
                path,
                resolved_global_entry_id,
                bool_to_i64(request.enabled),
                bool_to_i64(request.allow_local_ai),
                bool_to_i64(request.allow_cloud_ai),
                now,
            ],
        )?;
        let scope: ManagedScope = transaction.query_row(
            r#"
            SELECT id, path, global_entry_id, enabled, allow_local_ai,
                   allow_cloud_ai, created_at, updated_at
            FROM managed_scopes WHERE path = ?1
            "#,
            params![path],
            map_managed_scope,
        )?;

        transaction.commit()?;
        backfill_managed_scope(self, &scope)?;
        Ok(scope)
    }

    pub fn remove_managed_scope(&self, id: &str) -> Result<bool, DbError> {
        let mut conn = self.conn()?;
        let transaction = conn.transaction()?;
        transaction.execute(
            "UPDATE ai_jobs SET status = 'canceled', completed_at = ?2, last_error = 'managed_scope_removed' WHERE managed_scope_id = ?1 AND status IN ('pending', 'running')",
            params![id, unix_now()],
        )?;
        transaction.execute(
            "UPDATE ai_job_items SET status = 'canceled', updated_at = ?2, last_error = 'managed_scope_removed' WHERE job_id IN (SELECT id FROM ai_jobs WHERE managed_scope_id = ?1)",
            params![id, unix_now()],
        )?;
        let removed =
            transaction.execute("DELETE FROM managed_scopes WHERE id = ?1", params![id])?;
        transaction.execute(
            "DELETE FROM ai_analysis_state WHERE global_entry_id NOT IN (SELECT DISTINCT global_entry_id FROM managed_entries WHERE enabled = 1)",
            [],
        )?;
        transaction.commit()?;
        Ok(removed > 0)
    }

    pub fn update_managed_scope_policy(
        &self,
        request: UpdateManagedScopePolicyRequest,
    ) -> Result<ManagedScope, DbError> {
        let mut conn = self.conn()?;
        let transaction = conn.transaction()?;
        let current: ManagedScope = transaction
            .query_row(
                r#"
                SELECT id, path, global_entry_id, enabled, allow_local_ai,
                       allow_cloud_ai, created_at, updated_at
                FROM managed_scopes WHERE id = ?1
                "#,
                params![request.id],
                map_managed_scope,
            )
            .optional()?
            .ok_or_else(|| DbError::Validation("managed scope not found".to_string()))?;
        let enabled = request.enabled.unwrap_or(current.enabled);
        let allow_local_ai = request.allow_local_ai.unwrap_or(current.allow_local_ai);
        let allow_cloud_ai = request.allow_cloud_ai.unwrap_or(current.allow_cloud_ai);
        let now = unix_now();
        transaction.execute(
            r#"
            UPDATE managed_scopes
            SET enabled = ?2, allow_local_ai = ?3, allow_cloud_ai = ?4, updated_at = ?5
            WHERE id = ?1
            "#,
            params![
                request.id,
                bool_to_i64(enabled),
                bool_to_i64(allow_local_ai),
                bool_to_i64(allow_cloud_ai),
                now
            ],
        )?;
        transaction.execute(
            "UPDATE managed_entries SET enabled = ?2, updated_at = ?3 WHERE managed_scope_id = ?1",
            params![request.id, bool_to_i64(enabled), now],
        )?;
        if !enabled || (!allow_local_ai && !allow_cloud_ai) {
            transaction.execute(
                "UPDATE ai_jobs SET status = 'blocked_by_policy', started_at = NULL, completed_at = ?2, last_error = 'managed_scope_policy_disabled' WHERE managed_scope_id = ?1 AND status IN ('pending', 'running')",
                params![request.id, now],
            )?;
            transaction.execute(
                "UPDATE ai_job_items SET status = 'blocked_by_policy', last_error = 'managed_scope_policy_disabled', updated_at = ?2 WHERE job_id IN (SELECT id FROM ai_jobs WHERE managed_scope_id = ?1)",
                params![request.id, now],
            )?;
            transaction.execute(
                r#"
                UPDATE ai_analysis_state
                SET status = 'blocked_by_policy', last_error = 'managed_scope_policy_disabled', updated_at = ?2
                WHERE global_entry_id IN (SELECT global_entry_id FROM ai_jobs WHERE managed_scope_id = ?1)
                  AND NOT EXISTS (
                      SELECT 1 FROM ai_jobs job
                      WHERE job.global_entry_id = ai_analysis_state.global_entry_id
                        AND job.status IN ('pending', 'running')
                  )
                "#,
                params![request.id, now],
            )?;
        } else {
            let provider = if allow_local_ai { "local" } else { "cloud" };
            transaction.execute(
                "UPDATE ai_jobs SET status = 'pending', provider = ?2, last_error = NULL WHERE managed_scope_id = ?1 AND status = 'blocked_by_policy'",
                params![request.id, provider],
            )?;
            transaction.execute(
                "UPDATE ai_job_items SET status = 'pending', last_error = NULL, updated_at = ?2 WHERE job_id IN (SELECT id FROM ai_jobs WHERE managed_scope_id = ?1) AND status = 'blocked_by_policy'",
                params![request.id, now],
            )?;
            transaction.execute(
                "UPDATE ai_analysis_state SET status = 'pending', last_error = NULL, updated_at = ?2 WHERE global_entry_id IN (SELECT global_entry_id FROM ai_jobs WHERE managed_scope_id = ?1) AND status = 'blocked_by_policy'",
                params![request.id, now],
            )?;
        }
        let updated = transaction.query_row(
            r#"
            SELECT id, path, global_entry_id, enabled, allow_local_ai,
                   allow_cloud_ai, created_at, updated_at
            FROM managed_scopes WHERE id = ?1
            "#,
            params![request.id],
            map_managed_scope,
        )?;
        transaction.commit()?;
        Ok(updated)
    }

    pub fn ai_management_status(&self) -> Result<AiManagementStatus, DbError> {
        let conn = self.conn()?;
        let (
            enabled_scope_count,
            managed_entry_count,
            pending_job_count,
            running_job_count,
            cloud_scope_count,
        ): (i64, i64, i64, i64, i64) = conn.query_row(
            r#"
            SELECT
                (SELECT COUNT(*) FROM managed_scopes WHERE enabled = 1),
                (SELECT COUNT(*) FROM managed_entries WHERE enabled = 1),
                (SELECT COUNT(*) FROM ai_jobs WHERE status = 'pending'),
                (SELECT COUNT(*) FROM ai_jobs WHERE status = 'running'),
                (SELECT COUNT(*) FROM managed_scopes WHERE enabled = 1 AND allow_cloud_ai = 1)
            "#,
            [],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                ))
            },
        )?;
        Ok(AiManagementStatus {
            enabled_scope_count,
            managed_entry_count,
            pending_job_count,
            running_job_count,
            cloud_scope_count,
            policy_summary: if cloud_scope_count > 0 {
                "managed_scope_only_cloud_enabled".to_string()
            } else {
                "managed_scope_only_cloud_disabled".to_string()
            },
        })
    }
}

fn backfill_managed_scope(db: &Database, scope: &ManagedScope) -> Result<(), DbError> {
    const BATCH_SIZE: i64 = 512;
    let normalized_scope = normalize_path(&scope.path);
    let pattern = format!(
        "{}%",
        escape_like(normalized_scope.trim_end_matches('/')) + "/"
    );
    let mut last_id = String::new();
    let mut remaining_initial_jobs =
        if scope.enabled && (scope.allow_local_ai || scope.allow_cloud_ai) {
            INITIAL_MANAGED_AI_JOB_LIMIT
        } else {
            0
        };
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
            let rows = statement.query_map(
                params![normalized_scope, pattern, last_id, BATCH_SIZE],
                |row| Ok((global_entry_input_from_row(row)?, row.get::<_, String>(15)?)),
            )?;
            rows.collect::<Result<Vec<_>, _>>()?
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
            if remaining_initial_jobs > 0 && !entry.is_directory {
                enqueue_ai_jobs_for_entry_with_scopes(&transaction, entry_id, entry, &policies)?;
                remaining_initial_jobs -= 1;
            }
        }
        transaction.commit()?;
        if entries.len() < BATCH_SIZE as usize {
            break;
        }
    }
    Ok(())
}

fn upsert_managed_entry(
    transaction: &Transaction<'_>,
    scope_id: &str,
    global_entry_id: &str,
    enabled: bool,
    now: i64,
) -> Result<(), DbError> {
    let id = format!(
        "me_{}",
        blake3::hash(format!("{scope_id}\0{global_entry_id}").as_bytes()).to_hex()
    );
    transaction.execute(
        r#"
        INSERT INTO managed_entries (id, global_entry_id, managed_scope_id, enabled, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?5)
        ON CONFLICT(global_entry_id, managed_scope_id) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at
        "#,
        params![id, global_entry_id, scope_id, bool_to_i64(enabled), now],
    )?;
    Ok(())
}

fn map_managed_scope(row: &rusqlite::Row<'_>) -> rusqlite::Result<ManagedScope> {
    Ok(ManagedScope {
        id: row.get(0)?,
        path: row.get(1)?,
        global_entry_id: row.get(2)?,
        enabled: row.get::<_, i64>(3)? != 0,
        allow_local_ai: row.get::<_, i64>(4)? != 0,
        allow_cloud_ai: row.get::<_, i64>(5)? != 0,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

fn escape_like(value: &str) -> String {
    value
        .chars()
        .fold(String::with_capacity(value.len()), |mut result, ch| {
            if matches!(ch, '~' | '%' | '_') {
                result.push('~');
            }
            result.push(ch);
            result
        })
}

fn bool_to_i64(value: bool) -> i64 {
    i64::from(value)
}
