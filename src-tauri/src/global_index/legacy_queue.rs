//! Compatibility bridge from the existing File Library commands into the
//! persistent Managed AI queue.
//!
//! The File Library still stores rich `files` rows, but model execution is no
//! longer allowed to bypass `ai_jobs`. Paths are resolved against the global
//! index and accepted only when an enabled Managed Scope currently covers the
//! entry.

use super::models::{normalize_path, AI_JOB_BLOCKED_BY_POLICY};
use super::repository::{enqueue_ai_jobs_for_entry, global_entry_input_from_row};
use crate::db::{Database, DbError, IndexedFileRow, RuleExecutionSummary};
use rusqlite::{params, OptionalExtension};

impl Database {
    pub(crate) fn enqueue_legacy_targets_for_managed_ai(
        &self,
        targets: &[IndexedFileRow],
        force: bool,
    ) -> Result<RuleExecutionSummary, DbError> {
        if targets.is_empty() {
            return Ok(queue_summary(0, 0));
        }
        let mut conn = self.conn()?;
        let transaction = conn.transaction()?;
        let mut accepted = 0_i64;
        for target in targets {
            if target.is_dir {
                continue;
            }
            let normalized = normalize_path(&target.path);
            let entry = transaction
                .query_row(
                    r#"
                    SELECT entry.volume_id, entry.platform_file_id,
                           entry.parent_platform_file_id, entry.name, entry.path,
                           entry.extension, entry.is_directory, entry.size,
                           entry.created_at_fs, entry.modified_at_fs,
                           entry.file_attributes, entry.is_hidden, entry.is_system,
                           entry.source_provider, entry.last_seen_at
                    FROM global_entries entry
                    JOIN global_volumes volume ON volume.id = entry.volume_id
                    WHERE entry.path_normalized = ?1
                      AND entry.is_stale = 0
                      AND entry.is_directory = 0
                      AND volume.enabled = 1
                      AND EXISTS (
                          SELECT 1
                          FROM managed_entries managed
                          JOIN managed_scopes scope ON scope.id = managed.managed_scope_id
                          WHERE managed.global_entry_id = entry.id
                            AND managed.enabled = 1
                            AND scope.enabled = 1
                      )
                    LIMIT 1
                    "#,
                    params![normalized],
                    global_entry_input_from_row,
                )
                .optional()?;
            let Some(entry) = entry else {
                continue;
            };
            let entry_id = entry.entry_id();
            if force {
                transaction.execute(
                    r#"
                    UPDATE ai_jobs
                    SET status = 'stale', completed_at = ?2,
                        last_error = 'manual_reanalysis_requested'
                    WHERE global_entry_id = ?1
                      AND status IN ('completed', 'failed', 'blocked_by_policy')
                      AND NOT EXISTS (
                          SELECT 1 FROM ai_analysis_state state
                          WHERE state.global_entry_id = ai_jobs.global_entry_id
                            AND state.user_corrected = 1
                      )
                    "#,
                    params![entry_id, super::models::unix_now()],
                )?;
            }
            enqueue_ai_jobs_for_entry(&transaction, &entry_id, &entry)?;
            accepted += 1;
        }
        transaction.commit()?;
        Ok(queue_summary(targets.len() as i64, accepted))
    }

    pub(crate) fn cancel_managed_ai_queue(&self) -> Result<i64, DbError> {
        let mut conn = self.conn()?;
        let transaction = conn.transaction()?;
        let now = super::models::unix_now();
        let changed = transaction.execute(
            r#"
            UPDATE ai_jobs
            SET status = 'canceled', completed_at = ?1,
                last_error = 'user_canceled'
            WHERE status IN ('pending', 'running')
            "#,
            params![now],
        )? as i64;
        transaction.execute(
            r#"
            UPDATE ai_job_items
            SET status = 'canceled', updated_at = ?1,
                last_error = 'user_canceled'
            WHERE job_id IN (
                SELECT id FROM ai_jobs
                WHERE status = 'canceled' AND last_error = 'user_canceled'
            )
            "#,
            params![now],
        )?;
        transaction.execute(
            r#"
            UPDATE ai_analysis_state
            SET status = 'canceled', updated_at = ?1,
                last_error = 'user_canceled'
            WHERE user_corrected = 0
              AND global_entry_id IN (
                  SELECT global_entry_id FROM ai_jobs
                  WHERE status = 'canceled' AND last_error = 'user_canceled'
              )
              AND NOT EXISTS (
                  SELECT 1 FROM ai_jobs active
                  WHERE active.global_entry_id = ai_analysis_state.global_entry_id
                    AND active.status IN ('pending', 'running')
              )
            "#,
            params![now],
        )?;
        transaction.commit()?;
        Ok(changed)
    }

    #[allow(
        dead_code,
        reason = "kept for schema rollback and legacy queue repair tests"
    )]
    pub(crate) fn block_unmanaged_legacy_jobs(&self) -> Result<usize, DbError> {
        let conn = self.conn()?;
        conn.execute(
            r#"
            UPDATE ai_jobs
            SET status = ?1, completed_at = ?2,
                last_error = 'managed_scope_required'
            WHERE status IN ('pending', 'running')
              AND NOT EXISTS (
                  SELECT 1
                  FROM managed_entries managed
                  JOIN managed_scopes scope ON scope.id = managed.managed_scope_id
                  WHERE managed.global_entry_id = ai_jobs.global_entry_id
                    AND managed.managed_scope_id = ai_jobs.managed_scope_id
                    AND managed.enabled = 1
                    AND scope.enabled = 1
              )
            "#,
            params![AI_JOB_BLOCKED_BY_POLICY, super::models::unix_now()],
        )
        .map_err(DbError::from)
    }
}

fn queue_summary(scanned: i64, accepted: i64) -> RuleExecutionSummary {
    RuleExecutionSummary {
        scanned,
        updated: accepted,
        skipped: scanned.saturating_sub(accepted),
        needs_confirmation: 0,
        failed_batches: None,
        failed_files: None,
        warning: Some(
            "Managed AI tasks were queued; results will appear after policy validation and background processing."
                .to_string(),
        ),
    }
}
