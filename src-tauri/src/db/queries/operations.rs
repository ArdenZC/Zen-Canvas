use super::super::*;
use crate::file_ops::OperationLogDto;
use rusqlite::{params, OptionalExtension, Row};
use std::time::{SystemTime, UNIX_EPOCH};

impl Database {
    pub fn get_operation_logs(&self, limit: Option<u32>) -> Result<Vec<OperationLogDto>, DbError> {
        let limit = i64::from(limit.unwrap_or(500).clamp(1, 1000));
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            r#"
            SELECT
                id,
                batch_id,
                operation_type,
                source_path,
                target_path,
                old_name,
                new_name,
                status,
                error_message,
                created_at,
                can_undo,
                path_before,
                path_after,
                name_before,
                name_after,
                can_restore,
                restored_at,
                restore_status,
                restore_error,
                source_size, source_modified_ns, source_platform_file_id, source_quick_hash,
                source_full_hash, target_platform_file_id, target_full_hash
            FROM operation_logs
            ORDER BY created_at DESC
            LIMIT ?1
            "#,
        )?;
        let rows = stmt.query_map(params![limit], operation_log_from_row)?;

        rows.collect::<Result<Vec<_>, _>>().map_err(DbError::from)
    }

    pub fn get_restorable_operation_logs_by_ids(
        &self,
        ids: &[String],
    ) -> Result<Vec<OperationLogDto>, DbError> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            r#"
            SELECT
                id, batch_id, operation_type, source_path, target_path, old_name, new_name,
                status, error_message, created_at, can_undo, path_before, path_after,
                name_before, name_after, can_restore, restored_at, restore_status, restore_error,
                source_size, source_modified_ns, source_platform_file_id, source_quick_hash,
                source_full_hash, target_platform_file_id, target_full_hash
            FROM operation_logs
            WHERE id = ?1
              AND status = 'success'
              AND can_restore = 1
              AND restore_status = 'not_restored'
            "#,
        )?;
        let mut logs = Vec::with_capacity(ids.len());
        for id in ids {
            let log = stmt
                .query_row(params![id], operation_log_from_row)
                .optional()?;
            if let Some(log) = log {
                logs.push(log);
            }
        }
        Ok(logs)
    }

    pub fn get_pending_operation_logs(&self) -> Result<Vec<OperationLogDto>, DbError> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            r#"
            SELECT
                id, batch_id, operation_type, source_path, target_path, old_name, new_name,
                status, error_message, created_at, can_undo, path_before, path_after,
                name_before, name_after, can_restore, restored_at, restore_status, restore_error,
                source_size, source_modified_ns, source_platform_file_id, source_quick_hash,
                source_full_hash, target_platform_file_id, target_full_hash
            FROM operation_logs
            WHERE status = 'pending'
            ORDER BY created_at ASC
            "#,
        )?;
        let rows = stmt.query_map([], operation_log_from_row)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(DbError::from)
    }

    pub fn get_pending_restore_logs(&self) -> Result<Vec<OperationLogDto>, DbError> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            r#"
            SELECT
                id, batch_id, operation_type, source_path, target_path, old_name, new_name,
                status, error_message, created_at, can_undo, path_before, path_after,
                name_before, name_after, can_restore, restored_at, restore_status, restore_error,
                source_size, source_modified_ns, source_platform_file_id, source_quick_hash,
                source_full_hash, target_platform_file_id, target_full_hash
            FROM operation_logs
            WHERE restore_status = 'pending'
            ORDER BY created_at ASC
            "#,
        )?;
        let rows = stmt.query_map([], operation_log_from_row)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(DbError::from)
    }

    pub fn mark_operation_restores_pending(&self, ids: &[String]) -> Result<(), DbError> {
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        {
            let mut stmt = tx.prepare(
                r#"
                UPDATE operation_logs
                SET restore_status = 'pending', restore_error = NULL
                WHERE id = ?1 AND status = 'success' AND can_restore = 1
                  AND restore_status = 'not_restored'
                "#,
            )?;
            for id in ids {
                if stmt.execute(params![id])? != 1 {
                    return Err(DbError::Validation(format!(
                        "Operation log is no longer restorable: {id}"
                    )));
                }
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn save_operation_logs(
        &self,
        batch_id: &str,
        logs: &[OperationLogDto],
    ) -> Result<(), DbError> {
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        let created_at = logs
            .first()
            .map(|log| parse_operation_timestamp(&log.created_at))
            .unwrap_or_else(current_timestamp_ms);
        let batch_status = if logs.iter().any(|log| log.status == "pending") {
            "pending"
        } else if logs
            .iter()
            .any(|log| matches!(log.status.as_str(), "failed" | "manual_review"))
        {
            "partial_failed"
        } else if logs.iter().all(|log| log.status == "skipped") {
            "skipped"
        } else {
            "success"
        };

        tx.execute(
            r#"
            INSERT INTO operation_batches (id, created_at, status)
            VALUES (?1, ?2, ?3)
            ON CONFLICT(id) DO UPDATE SET
                created_at = excluded.created_at,
                status = excluded.status
            "#,
            params![batch_id, created_at, batch_status],
        )?;

        {
            let mut stmt = tx.prepare(
                r#"
                INSERT INTO operation_logs (
                    id,
                    batch_id,
                    operation_type,
                    source_path,
                    target_path,
                    old_name,
                    new_name,
                    status,
                    error_message,
                    created_at,
                    can_undo,
                    path_before,
                    path_after,
                    name_before,
                    name_after,
                    can_restore,
                    restored_at,
                    restore_status,
                    restore_error,
                    source_size,
                    source_modified_ns,
                    source_platform_file_id,
                    source_quick_hash,
                    source_full_hash,
                    target_platform_file_id,
                    target_full_hash
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26)
                ON CONFLICT(id) DO UPDATE SET
                    batch_id = excluded.batch_id,
                    operation_type = excluded.operation_type,
                    source_path = excluded.source_path,
                    target_path = excluded.target_path,
                    old_name = excluded.old_name,
                    new_name = excluded.new_name,
                    status = excluded.status,
                    error_message = excluded.error_message,
                    created_at = excluded.created_at,
                    can_undo = excluded.can_undo,
                    path_before = excluded.path_before,
                    path_after = excluded.path_after,
                    name_before = excluded.name_before,
                    name_after = excluded.name_after,
                    can_restore = excluded.can_restore,
                    restored_at = excluded.restored_at,
                    restore_status = excluded.restore_status,
                    restore_error = excluded.restore_error,
                    source_size = excluded.source_size,
                    source_modified_ns = excluded.source_modified_ns,
                    source_platform_file_id = excluded.source_platform_file_id,
                    source_quick_hash = excluded.source_quick_hash,
                    source_full_hash = excluded.source_full_hash,
                    target_platform_file_id = excluded.target_platform_file_id,
                    target_full_hash = excluded.target_full_hash
                "#,
            )?;

            for log in logs {
                stmt.execute(params![
                    log.id,
                    log.batch_id,
                    log.operation_type,
                    log.source_path,
                    log.target_path,
                    log.old_name,
                    log.new_name,
                    log.status,
                    log.error_message,
                    parse_operation_timestamp(&log.created_at),
                    bool_to_i64(log.can_undo),
                    log.path_before,
                    log.path_after,
                    log.name_before,
                    log.name_after,
                    bool_to_i64(log.can_restore),
                    log.restored_at
                        .as_deref()
                        .and_then(parse_optional_operation_timestamp),
                    log.restore_status,
                    log.restore_error,
                    log.source_size.map(|value| value as i64),
                    log.source_modified_ns,
                    log.source_platform_file_id,
                    log.source_quick_hash,
                    log.source_full_hash,
                    log.target_platform_file_id,
                    log.target_full_hash
                ])?;
            }
        }

        tx.commit()?;
        Ok(())
    }

    pub fn update_operation_restore_logs(&self, logs: &[OperationLogDto]) -> Result<(), DbError> {
        if logs.is_empty() {
            return Ok(());
        }

        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        {
            let mut stmt = tx.prepare(
                r#"
                UPDATE operation_logs
                SET can_restore = ?2,
                    restored_at = ?3,
                    restore_status = ?4,
                    restore_error = ?5,
                    can_undo = ?6
                WHERE id = ?1
                "#,
            )?;

            for log in logs {
                stmt.execute(params![
                    log.id,
                    bool_to_i64(log.can_restore),
                    log.restored_at
                        .as_deref()
                        .and_then(parse_optional_operation_timestamp),
                    log.restore_status,
                    log.restore_error,
                    bool_to_i64(log.can_undo)
                ])?;
            }
        }

        tx.commit()?;
        Ok(())
    }

    pub fn prune_operation_logs(&self, retention_days: i64) -> Result<(), DbError> {
        let retention_days = retention_days.max(0);
        let retention_ms = retention_days.saturating_mul(24 * 60 * 60 * 1000);
        let prune_before = current_timestamp_ms().saturating_sub(retention_ms);
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;

        tx.execute(
            "DELETE FROM operation_logs WHERE created_at < ?1",
            params![prune_before],
        )?;
        tx.execute(
            r#"
            DELETE FROM operation_batches
            WHERE NOT EXISTS (
                SELECT 1
                FROM operation_logs
                WHERE operation_logs.batch_id = operation_batches.id
            )
            "#,
            [],
        )?;

        tx.commit()?;
        Ok(())
    }
}

fn parse_operation_timestamp(value: &str) -> i64 {
    value
        .parse::<i64>()
        .unwrap_or_else(|_| current_timestamp_ms())
}

fn parse_optional_operation_timestamp(value: &str) -> Option<i64> {
    value.parse::<i64>().ok()
}

fn operation_log_from_row(row: &Row<'_>) -> rusqlite::Result<OperationLogDto> {
    let created_at: i64 = row.get(9)?;
    let restored_at: Option<i64> = row.get(16)?;
    Ok(OperationLogDto {
        id: row.get(0)?,
        batch_id: row.get(1)?,
        operation_type: row.get(2)?,
        source_path: row.get(3)?,
        target_path: row.get(4)?,
        old_name: row.get(5)?,
        new_name: row.get(6)?,
        status: row.get(7)?,
        error_message: row.get(8)?,
        created_at: created_at.to_string(),
        can_undo: row.get::<_, i64>(10)? != 0,
        path_before: row.get(11)?,
        path_after: row.get(12)?,
        name_before: row.get(13)?,
        name_after: row.get(14)?,
        can_restore: row.get::<_, i64>(15)? != 0,
        restored_at: restored_at.map(|value| value.to_string()),
        restore_status: row.get(17)?,
        restore_error: row.get(18)?,
        source_size: row.get::<_, Option<i64>>(19)?.map(|value| value as u64),
        source_modified_ns: row.get(20)?,
        source_platform_file_id: row.get(21)?,
        source_quick_hash: row.get(22)?,
        source_full_hash: row.get(23)?,
        target_platform_file_id: row.get(24)?,
        target_full_hash: row.get(25)?,
    })
}

fn current_timestamp_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| i64::try_from(duration.as_millis()).unwrap_or(i64::MAX))
        .unwrap_or(0)
}
