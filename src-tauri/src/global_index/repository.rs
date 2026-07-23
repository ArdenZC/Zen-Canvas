use super::models::*;
use crate::db::{Database, DbError};
use rusqlite::{params, OptionalExtension, Transaction};
use std::path::Path;

const MAX_SEARCH_LIMIT: u32 = 200;
const MAX_SEARCH_OFFSET: u32 = 1_000_000;

impl Database {
    pub fn upsert_global_volume(&self, volume: &GlobalVolume) -> Result<(), DbError> {
        let conn = self.conn()?;
        conn.execute(
            r#"
            INSERT INTO global_volumes (
                id, platform, stable_volume_id, display_name, mount_path,
                filesystem_type, drive_kind, enabled, provider, index_status,
                last_error, journal_id, journal_cursor, last_full_index_at,
                last_incremental_sync_at, entry_count, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)
            ON CONFLICT(stable_volume_id) DO UPDATE SET
                platform = excluded.platform,
                display_name = excluded.display_name,
                mount_path = excluded.mount_path,
                filesystem_type = excluded.filesystem_type,
                drive_kind = excluded.drive_kind,
                provider = CASE
                    WHEN global_volumes.provider = 'windows_recursive_fallback'
                     AND excluded.provider = 'windows_mft_usn'
                     AND lower(global_volumes.filesystem_type) = lower(excluded.filesystem_type)
                    THEN global_volumes.provider
                    ELSE excluded.provider
                END,
                updated_at = excluded.updated_at
            "#,
            params![
                volume.id,
                volume.platform,
                volume.stable_volume_id,
                volume.display_name,
                volume.mount_path,
                volume.filesystem_type,
                volume.drive_kind,
                bool_to_i64(volume.enabled),
                volume.provider,
                volume.index_status,
                volume.last_error,
                volume.journal_id,
                volume.journal_cursor,
                volume.last_full_index_at,
                volume.last_incremental_sync_at,
                volume.entry_count,
                volume.created_at,
                volume.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn list_global_volumes(&self) -> Result<Vec<GlobalVolume>, DbError> {
        let conn = self.conn()?;
        let mut statement = conn.prepare(
            r#"
            SELECT id, platform, stable_volume_id, display_name, mount_path,
                   filesystem_type, drive_kind, enabled, provider, index_status,
                   last_error, journal_id, journal_cursor, last_full_index_at,
                   last_incremental_sync_at, entry_count, created_at, updated_at
            FROM global_volumes
            ORDER BY mount_path COLLATE NOCASE
            "#,
        )?;
        let rows = statement.query_map([], map_global_volume)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(DbError::from)
    }

    pub fn get_global_volume(&self, id: &str) -> Result<Option<GlobalVolume>, DbError> {
        let conn = self.conn()?;
        conn.query_row(
            r#"
            SELECT id, platform, stable_volume_id, display_name, mount_path,
                   filesystem_type, drive_kind, enabled, provider, index_status,
                   last_error, journal_id, journal_cursor, last_full_index_at,
                   last_incremental_sync_at, entry_count, created_at, updated_at
            FROM global_volumes WHERE id = ?1
            "#,
            params![id],
            map_global_volume,
        )
        .optional()
        .map_err(DbError::from)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn update_global_volume_state(
        &self,
        id: &str,
        status: &str,
        error: Option<&str>,
        journal_id: Option<&str>,
        journal_cursor: Option<&str>,
        full_index_at: Option<i64>,
        incremental_sync_at: Option<i64>,
    ) -> Result<(), DbError> {
        let conn = self.conn()?;
        conn.execute(
            r#"
            UPDATE global_volumes
            SET index_status = ?2,
                last_error = ?3,
                journal_id = COALESCE(?4, journal_id),
                journal_cursor = COALESCE(?5, journal_cursor),
                last_full_index_at = COALESCE(?6, last_full_index_at),
                last_incremental_sync_at = COALESCE(?7, last_incremental_sync_at),
                updated_at = ?8
            WHERE id = ?1
            "#,
            params![
                id,
                status,
                error,
                journal_id,
                journal_cursor,
                full_index_at,
                incremental_sync_at,
                unix_now()
            ],
        )?;
        Ok(())
    }

    pub fn set_global_volume_enabled(&self, id: &str, enabled: bool) -> Result<(), DbError> {
        let conn = self.conn()?;
        conn.execute(
            "UPDATE global_volumes SET enabled = ?2, updated_at = ?3 WHERE id = ?1",
            params![id, bool_to_i64(enabled), unix_now()],
        )?;
        Ok(())
    }

    pub fn update_global_volume_provider(&self, id: &str, provider: &str) -> Result<(), DbError> {
        let conn = self.conn()?;
        conn.execute(
            "UPDATE global_volumes SET provider = ?2, updated_at = ?3 WHERE id = ?1",
            params![id, provider, unix_now()],
        )?;
        Ok(())
    }

    pub fn upsert_global_entries_batch(
        &self,
        entries: &[GlobalEntryInput],
    ) -> Result<usize, DbError> {
        if entries.is_empty() {
            return Ok(0);
        }
        let mut conn = self.conn()?;
        let transaction = conn.transaction()?;
        let mut count = 0;
        for entry in entries {
            let entry_id = entry.entry_id();
            transaction.execute(
                r#"
                INSERT INTO global_entries (
                    id, volume_id, platform_file_id, parent_platform_file_id,
                    name, name_normalized, path, path_normalized, extension,
                    is_directory, size, created_at_fs, modified_at_fs,
                    file_attributes, is_hidden, is_system, is_stale,
                    source_provider, last_seen_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, 0, ?17, ?18)
                ON CONFLICT(id) DO UPDATE SET
                    volume_id = excluded.volume_id,
                    platform_file_id = excluded.platform_file_id,
                    parent_platform_file_id = excluded.parent_platform_file_id,
                    name = excluded.name,
                    name_normalized = excluded.name_normalized,
                    path = excluded.path,
                    path_normalized = excluded.path_normalized,
                    extension = excluded.extension,
                    is_directory = excluded.is_directory,
                    size = excluded.size,
                    created_at_fs = excluded.created_at_fs,
                    modified_at_fs = excluded.modified_at_fs,
                    file_attributes = excluded.file_attributes,
                    is_hidden = excluded.is_hidden,
                    is_system = excluded.is_system,
                    is_stale = 0,
                    source_provider = excluded.source_provider,
                    last_seen_at = excluded.last_seen_at
                "#,
                params![
                    entry_id,
                    entry.volume_id,
                    entry.platform_file_id,
                    entry.parent_platform_file_id,
                    entry.name,
                    entry.name.to_lowercase(),
                    entry.path,
                    normalize_path(&entry.path),
                    entry.extension,
                    bool_to_i64(entry.is_directory),
                    entry.size,
                    entry.created_at_fs,
                    entry.modified_at_fs,
                    entry.file_attributes,
                    bool_to_i64(entry.is_hidden),
                    bool_to_i64(entry.is_system),
                    entry.source_provider,
                    entry.last_seen_at,
                ],
            )?;
            enqueue_ai_jobs_for_entry(&transaction, &entry_id, entry)?;
            count += 1;
        }
        transaction.execute(
            r#"
            UPDATE global_volumes
            SET entry_count = (SELECT COUNT(*) FROM global_entries WHERE volume_id = global_volumes.id AND is_stale = 0),
                updated_at = ?1
            WHERE id IN (SELECT DISTINCT volume_id FROM global_entries WHERE last_seen_at >= ?2)
            "#,
            params![unix_now(), entries.iter().map(|entry| entry.last_seen_at).min().unwrap_or_default()],
        )?;
        transaction.commit()?;
        Ok(count)
    }

    pub fn mark_global_entries_stale_for_volume(&self, volume_id: &str) -> Result<usize, DbError> {
        let conn = self.conn()?;
        let changed = conn.execute(
            "UPDATE global_entries SET is_stale = 1 WHERE volume_id = ?1 AND is_stale = 0",
            params![volume_id],
        )?;
        conn.execute(
            "UPDATE managed_entries SET enabled = 0, updated_at = ?2 WHERE global_entry_id IN (SELECT id FROM global_entries WHERE volume_id = ?1)",
            params![volume_id, unix_now()],
        )?;
        conn.execute(
            "UPDATE ai_jobs SET status = 'stale', completed_at = ?2, last_error = 'global_entry_stale' WHERE global_entry_id IN (SELECT id FROM global_entries WHERE volume_id = ?1) AND status IN ('pending', 'running')",
            params![volume_id, unix_now()],
        )?;
        conn.execute(
            "UPDATE ai_job_items SET status = 'stale', updated_at = ?2, last_error = 'global_entry_stale' WHERE global_entry_id IN (SELECT id FROM global_entries WHERE volume_id = ?1) AND status IN ('pending', 'running')",
            params![volume_id, unix_now()],
        )?;
        conn.execute(
            "UPDATE ai_analysis_state SET status = 'stale', last_error = 'global_entry_stale', updated_at = ?2 WHERE global_entry_id IN (SELECT id FROM global_entries WHERE volume_id = ?1)",
            params![volume_id, unix_now()],
        )?;
        conn.execute(
            "UPDATE global_volumes SET entry_count = 0, updated_at = ?2 WHERE id = ?1",
            params![volume_id, unix_now()],
        )?;
        Ok(changed)
    }

    pub fn mark_global_entry_stale(&self, entry_id: &str) -> Result<bool, DbError> {
        let conn = self.conn()?;
        let changed = conn.execute(
            "UPDATE global_entries SET is_stale = 1 WHERE id = ?1 AND is_stale = 0",
            params![entry_id],
        )?;
        conn.execute(
            "UPDATE managed_entries SET enabled = 0, updated_at = ?2 WHERE global_entry_id = ?1",
            params![entry_id, unix_now()],
        )?;
        conn.execute(
            "UPDATE ai_jobs SET status = 'stale', completed_at = ?2, last_error = 'global_entry_stale' WHERE global_entry_id = ?1 AND status IN ('pending', 'running')",
            params![entry_id, unix_now()],
        )?;
        conn.execute(
            "UPDATE ai_job_items SET status = 'stale', updated_at = ?2, last_error = 'global_entry_stale' WHERE global_entry_id = ?1 AND status IN ('pending', 'running')",
            params![entry_id, unix_now()],
        )?;
        conn.execute(
            "UPDATE ai_analysis_state SET status = 'stale', last_error = 'global_entry_stale', updated_at = ?2 WHERE global_entry_id = ?1",
            params![entry_id, unix_now()],
        )?;
        Ok(changed > 0)
    }

    pub fn get_global_entry(&self, entry_id: &str) -> Result<Option<GlobalEntry>, DbError> {
        let conn = self.conn()?;
        conn.query_row(
            r#"
            SELECT id, volume_id, platform_file_id, parent_platform_file_id,
                   name, name_normalized, path, path_normalized, extension,
                   is_directory, size, created_at_fs, modified_at_fs,
                   file_attributes, is_hidden, is_system, is_stale,
                   source_provider, last_seen_at
            FROM global_entries WHERE id = ?1
            "#,
            params![entry_id],
            map_global_entry,
        )
        .optional()
        .map_err(DbError::from)
    }

    pub fn global_index_status(&self) -> Result<GlobalIndexStatus, DbError> {
        let conn = self.conn()?;
        let (total_entries, indexed_volumes, ready_volumes, pending_volumes, last_sync_at, last_error): (
            i64,
            i64,
            i64,
            i64,
            Option<i64>,
            Option<String>,
        ) = conn.query_row(
            r#"
            SELECT
                (SELECT COUNT(*) FROM global_entries WHERE is_stale = 0),
                (SELECT COUNT(*) FROM global_volumes WHERE enabled = 1),
                (SELECT COUNT(*) FROM global_volumes WHERE enabled = 1 AND index_status = 'ready'),
                (SELECT COUNT(*) FROM global_volumes WHERE enabled = 1 AND index_status NOT IN ('ready', 'paused')),
                (SELECT MAX(last_incremental_sync_at) FROM global_volumes),
                (SELECT last_error FROM global_volumes WHERE last_error IS NOT NULL ORDER BY updated_at DESC LIMIT 1)
            "#,
            [],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                ))
            },
        )?;
        let status = if indexed_volumes == 0 {
            INDEX_STATUS_UNAVAILABLE
        } else if ready_volumes == indexed_volumes {
            INDEX_STATUS_READY
        } else if ready_volumes > 0 {
            "partial"
        } else {
            INDEX_STATUS_INDEXING
        };
        Ok(GlobalIndexStatus {
            platform: std::env::consts::OS.to_string(),
            enabled: indexed_volumes > 0,
            status: status.to_string(),
            provider_status: None,
            total_entries,
            indexed_volumes,
            ready_volumes,
            pending_volumes,
            last_sync_at,
            last_error,
        })
    }

    pub fn search_global_entries(
        &self,
        query: &str,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<GlobalSearchResult>, DbError> {
        let query = query.trim();
        if query.is_empty() {
            return Ok(Vec::new());
        }
        let limit = limit.clamp(1, MAX_SEARCH_LIMIT);
        let offset = offset.min(MAX_SEARCH_OFFSET);
        let conn = self.conn()?;
        let mut results = if query.chars().count() >= 3 {
            let fts_query = format!("\"{}\"", query.replace('"', "\"\""));
            let mut statement = conn.prepare(
                r#"
                SELECT ge.id, ge.volume_id, ge.platform_file_id, ge.name, ge.path,
                       ge.extension, ge.is_directory, ge.size, ge.created_at_fs,
                       ge.modified_at_fs, ge.file_attributes, ge.is_hidden, ge.is_system,
                       ge.source_provider,
                       EXISTS (
                           SELECT 1 FROM managed_entries me
                           WHERE me.global_entry_id = ge.id AND me.enabled = 1
                       ) AS managed,
                       bm25(global_entries_fts, 8.0, 2.0, 1.0) AS rank
                FROM global_entries_fts
                JOIN global_entries ge ON ge.rowid = global_entries_fts.rowid
                WHERE global_entries_fts MATCH ?1 AND ge.is_stale = 0
                ORDER BY
                    CASE WHEN ge.name_normalized = lower(?2) THEN 0
                         WHEN ge.name_normalized LIKE lower(?2) || '%' THEN 1
                         WHEN ge.name_normalized LIKE '%' || lower(?2) || '%' THEN 2
                         ELSE 3 END,
                    rank,
                    ge.modified_at_fs DESC
                LIMIT ?3 OFFSET ?4
                "#,
            )?;
            let fts_results = statement
                .query_map(
                    params![fts_query, query, limit, offset],
                    map_global_search_result,
                )?
                .collect::<Result<Vec<_>, _>>()?;
            fts_results
        } else {
            Vec::new()
        };
        if results.is_empty() {
            let pattern = format!("%{}%", escape_like(query));
            let mut statement = conn.prepare(
                r#"
                SELECT ge.id, ge.volume_id, ge.platform_file_id, ge.name, ge.path,
                       ge.extension, ge.is_directory, ge.size, ge.created_at_fs,
                       ge.modified_at_fs, ge.file_attributes, ge.is_hidden, ge.is_system,
                       ge.source_provider,
                       EXISTS (
                           SELECT 1 FROM managed_entries me
                           WHERE me.global_entry_id = ge.id AND me.enabled = 1
                       ) AS managed,
                       0.0 AS rank
                FROM global_entries ge
                WHERE ge.is_stale = 0
                  AND (ge.name_normalized LIKE lower(?1) ESCAPE '~'
                       OR ge.path_normalized LIKE lower(?1) ESCAPE '~'
                       OR ge.extension LIKE lower(?1) ESCAPE '~')
                ORDER BY
                    CASE WHEN ge.name_normalized = lower(?2) THEN 0
                         WHEN ge.name_normalized LIKE lower(?2) || '%' THEN 1
                         WHEN ge.name_normalized LIKE '%' || lower(?2) || '%' THEN 2
                         WHEN ge.extension LIKE '%' || lower(?2) || '%' THEN 3
                         ELSE 4 END,
                    ge.modified_at_fs DESC
                LIMIT ?3 OFFSET ?4
                "#,
            )?;
            results = statement
                .query_map(
                    params![pattern, query, limit, offset],
                    map_global_search_result,
                )?
                .collect::<Result<Vec<_>, _>>()?;
        }
        Ok(results)
    }

    pub fn global_entry_for_path(&self, path: &Path) -> Result<Option<GlobalEntry>, DbError> {
        let normalized = normalize_path(&path.to_string_lossy());
        let conn = self.conn()?;
        conn.query_row(
            r#"
            SELECT id, volume_id, platform_file_id, parent_platform_file_id,
                   name, name_normalized, path, path_normalized, extension,
                   is_directory, size, created_at_fs, modified_at_fs,
                   file_attributes, is_hidden, is_system, is_stale,
                   source_provider, last_seen_at
            FROM global_entries
            WHERE path_normalized = ?1 AND is_stale = 0
            LIMIT 1
            "#,
            params![normalized],
            map_global_entry,
        )
        .optional()
        .map_err(DbError::from)
    }

    pub fn global_path_by_platform_identity(
        &self,
        volume_id: &str,
        platform_file_id: &str,
    ) -> Result<Option<String>, DbError> {
        let conn = self.conn()?;
        conn.query_row(
            "SELECT path FROM global_entries WHERE volume_id = ?1 AND platform_file_id = ?2 AND is_stale = 0 ORDER BY length(path) LIMIT 1",
            params![volume_id, platform_file_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(DbError::from)
    }

    pub fn global_entry_by_identity(
        &self,
        volume_id: &str,
        platform_file_id: &str,
        parent_platform_file_id: &str,
        name: &str,
    ) -> Result<Option<GlobalEntry>, DbError> {
        let conn = self.conn()?;
        conn.query_row(
            r#"
            SELECT id, volume_id, platform_file_id, parent_platform_file_id,
                   name, name_normalized, path, path_normalized, extension,
                   is_directory, size, created_at_fs, modified_at_fs,
                   file_attributes, is_hidden, is_system, is_stale,
                   source_provider, last_seen_at
            FROM global_entries
            WHERE volume_id = ?1 AND platform_file_id = ?2
              AND parent_platform_file_id = ?3 AND name = ?4
            LIMIT 1
            "#,
            params![volume_id, platform_file_id, parent_platform_file_id, name],
            map_global_entry,
        )
        .optional()
        .map_err(DbError::from)
    }
}

pub(crate) fn enqueue_ai_jobs_for_entry(
    transaction: &Transaction<'_>,
    entry_id: &str,
    entry: &GlobalEntryInput,
) -> Result<(), DbError> {
    let fingerprint = metadata_fingerprint(entry);
    let path_normalized = normalize_path(&entry.path);
    let mut scope_statement = transaction.prepare(
        r#"
        SELECT id, allow_local_ai, allow_cloud_ai, path
        FROM managed_scopes
        WHERE enabled = 1
        "#,
    )?;
    let scopes = scope_statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)? != 0,
                row.get::<_, i64>(2)? != 0,
                normalize_path(&row.get::<_, String>(3)?),
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    drop(scope_statement);
    for (scope_id, allow_local_ai, allow_cloud_ai, scope_path) in scopes {
        if !path_is_within(&path_normalized, &scope_path) {
            continue;
        }
        let managed_entry_id = format!(
            "me_{}",
            blake3::hash(format!("{scope_id}\0{entry_id}").as_bytes()).to_hex()
        );
        transaction.execute(
            r#"
            INSERT INTO managed_entries (id, global_entry_id, managed_scope_id, enabled, created_at, updated_at)
            VALUES (?1, ?2, ?3, 1, ?4, ?4)
            ON CONFLICT(global_entry_id, managed_scope_id) DO UPDATE SET enabled = 1, updated_at = excluded.updated_at
            "#,
            params![managed_entry_id, entry_id, scope_id, unix_now()],
        )?;

        if entry.is_directory {
            let now = unix_now();
            transaction.execute(
                "UPDATE ai_jobs SET status = 'stale', completed_at = ?2, last_error = 'global_entry_is_directory' WHERE global_entry_id = ?1 AND status IN ('pending', 'running', 'completed')",
                params![entry_id, now],
            )?;
            transaction.execute(
                "UPDATE ai_job_items SET status = 'stale', updated_at = ?2, last_error = 'global_entry_is_directory' WHERE global_entry_id = ?1 AND status IN ('pending', 'running', 'completed')",
                params![entry_id, now],
            )?;
            transaction.execute(
                "UPDATE ai_analysis_state SET status = 'stale', last_error = 'global_entry_is_directory', updated_at = ?2 WHERE global_entry_id = ?1",
                params![entry_id, now],
            )?;
            continue;
        }
        let now = unix_now();
        transaction.execute(
            "UPDATE ai_jobs SET status = 'stale', completed_at = ?2, last_error = 'input_fingerprint_changed' WHERE global_entry_id = ?1 AND input_fingerprint <> ?3 AND status IN ('pending', 'running', 'completed')",
            params![entry_id, now, fingerprint],
        )?;
        transaction.execute(
            "UPDATE ai_job_items SET status = 'stale', updated_at = ?2, last_error = 'input_fingerprint_changed' WHERE global_entry_id = ?1 AND job_id IN (SELECT id FROM ai_jobs WHERE input_fingerprint <> ?3)",
            params![entry_id, now, fingerprint],
        )?;
        let existing: Option<(String, String)> = transaction
            .query_row(
                "SELECT id, status FROM ai_jobs WHERE global_entry_id = ?1 AND input_fingerprint = ?2 ORDER BY created_at DESC LIMIT 1",
                params![entry_id, fingerprint],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;
        if let Some((job_id, status)) = existing {
            if matches!(status.as_str(), AI_JOB_STALE | AI_JOB_CANCELED) {
                let (provider, next_status) = if allow_local_ai {
                    ("local", AI_JOB_PENDING)
                } else if allow_cloud_ai {
                    ("cloud", AI_JOB_PENDING)
                } else {
                    ("none", AI_JOB_BLOCKED_BY_POLICY)
                };
                transaction.execute(
                    "UPDATE ai_jobs SET provider = ?2, status = ?3, attempt_count = 0, last_error = NULL, started_at = NULL, completed_at = NULL WHERE id = ?1",
                    params![job_id, provider, next_status],
                )?;
                transaction.execute(
                    "UPDATE ai_job_items SET status = ?2, last_error = NULL, updated_at = ?3 WHERE job_id = ?1",
                    params![job_id, next_status, unix_now()],
                )?;
                transaction.execute(
                    "UPDATE ai_analysis_state SET status = ?2, provider = ?3, last_error = NULL, updated_at = ?4 WHERE global_entry_id = ?1",
                    params![entry_id, next_status, provider, unix_now()],
                )?;
            }
            continue;
        }
        let (provider, status) = if allow_local_ai {
            ("local", AI_JOB_PENDING)
        } else if allow_cloud_ai {
            ("cloud", AI_JOB_PENDING)
        } else {
            ("none", AI_JOB_BLOCKED_BY_POLICY)
        };
        let job_id = format!(
            "aij_{}",
            blake3::hash(format!("{entry_id}\0{scope_id}\0{fingerprint}").as_bytes()).to_hex()
        );
        transaction.execute(
            r#"
            INSERT INTO ai_jobs (
                id, global_entry_id, managed_scope_id, input_fingerprint, provider,
                model, processing_mode, status, attempt_count, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, '', 'metadata', ?6, 0, ?7)
            "#,
            params![
                job_id,
                entry_id,
                scope_id,
                fingerprint,
                provider,
                status,
                unix_now()
            ],
        )?;
        transaction.execute(
            r#"
            INSERT INTO ai_job_items (id, job_id, global_entry_id, status, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?5)
            "#,
            params![
                format!("aiji_{job_id}"),
                job_id,
                entry_id,
                status,
                unix_now()
            ],
        )?;
        transaction.execute(
            r#"
            INSERT INTO ai_analysis_state (global_entry_id, status, input_fingerprint, provider, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(global_entry_id) DO UPDATE SET
                status = excluded.status,
                input_fingerprint = excluded.input_fingerprint,
                provider = excluded.provider,
                updated_at = excluded.updated_at
            "#,
            params![entry_id, status, fingerprint, provider, unix_now()],
        )?;
    }
    Ok(())
}

fn metadata_fingerprint(entry: &GlobalEntryInput) -> String {
    format!(
        "mf_{}",
        blake3::hash(
            format!(
                "{}\0{}\0{}\0{}\0{}\0{}",
                entry.volume_id,
                entry.platform_file_id,
                entry.name,
                entry.size,
                entry.modified_at_fs.unwrap_or_default(),
                entry.is_directory
            )
            .as_bytes(),
        )
        .to_hex()
    )
}

fn path_is_within(path: &str, scope: &str) -> bool {
    let path = path.trim_end_matches('/');
    let scope = scope.trim_end_matches('/');
    path == scope || path.starts_with(&format!("{scope}/"))
}

fn escape_like(value: &str) -> String {
    value
        .chars()
        .fold(String::with_capacity(value.len()), |mut result, ch| {
            if matches!(ch, '~' | '%' | '_') {
                result.push('~');
            }
            result.push(ch.to_ascii_lowercase());
            result
        })
}

pub(crate) fn global_entry_input_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<GlobalEntryInput> {
    Ok(GlobalEntryInput {
        volume_id: row.get(0)?,
        platform_file_id: row.get(1)?,
        parent_platform_file_id: row.get(2)?,
        name: row.get(3)?,
        path: row.get(4)?,
        extension: row.get(5)?,
        is_directory: row.get::<_, i64>(6)? != 0,
        size: row.get(7)?,
        created_at_fs: row.get(8)?,
        modified_at_fs: row.get(9)?,
        file_attributes: row.get(10)?,
        is_hidden: row.get::<_, i64>(11)? != 0,
        is_system: row.get::<_, i64>(12)? != 0,
        source_provider: row.get(13)?,
        last_seen_at: row.get(14)?,
    })
}

fn map_global_volume(row: &rusqlite::Row<'_>) -> rusqlite::Result<GlobalVolume> {
    Ok(GlobalVolume {
        id: row.get(0)?,
        platform: row.get(1)?,
        stable_volume_id: row.get(2)?,
        display_name: row.get(3)?,
        mount_path: row.get(4)?,
        filesystem_type: row.get(5)?,
        drive_kind: row.get(6)?,
        enabled: row.get::<_, i64>(7)? != 0,
        provider: row.get(8)?,
        index_status: row.get(9)?,
        last_error: row.get(10)?,
        journal_id: row.get(11)?,
        journal_cursor: row.get(12)?,
        last_full_index_at: row.get(13)?,
        last_incremental_sync_at: row.get(14)?,
        entry_count: row.get(15)?,
        created_at: row.get(16)?,
        updated_at: row.get(17)?,
    })
}

fn map_global_entry(row: &rusqlite::Row<'_>) -> rusqlite::Result<GlobalEntry> {
    Ok(GlobalEntry {
        id: row.get(0)?,
        volume_id: row.get(1)?,
        platform_file_id: row.get(2)?,
        parent_platform_file_id: row.get(3)?,
        name: row.get(4)?,
        name_normalized: row.get(5)?,
        path: row.get(6)?,
        path_normalized: row.get(7)?,
        extension: row.get(8)?,
        is_directory: row.get::<_, i64>(9)? != 0,
        size: row.get(10)?,
        created_at_fs: row.get(11)?,
        modified_at_fs: row.get(12)?,
        file_attributes: row.get(13)?,
        is_hidden: row.get::<_, i64>(14)? != 0,
        is_system: row.get::<_, i64>(15)? != 0,
        is_stale: row.get::<_, i64>(16)? != 0,
        source_provider: row.get(17)?,
        last_seen_at: row.get(18)?,
    })
}

fn map_global_search_result(row: &rusqlite::Row<'_>) -> rusqlite::Result<GlobalSearchResult> {
    Ok(GlobalSearchResult {
        id: row.get(0)?,
        volume_id: row.get(1)?,
        platform_file_id: row.get(2)?,
        name: row.get(3)?,
        path: row.get(4)?,
        extension: row.get(5)?,
        is_directory: row.get::<_, i64>(6)? != 0,
        size: row.get(7)?,
        created_at_fs: row.get(8)?,
        modified_at_fs: row.get(9)?,
        file_attributes: row.get(10)?,
        is_hidden: row.get::<_, i64>(11)? != 0,
        is_system: row.get::<_, i64>(12)? != 0,
        source_provider: row.get(13)?,
        managed: row.get::<_, i64>(14)? != 0,
        rank: row.get(15)?,
    })
}

fn bool_to_i64(value: bool) -> i64 {
    i64::from(value)
}
