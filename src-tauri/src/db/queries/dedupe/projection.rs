use super::*;
use rusqlite::{params, Connection, Row};

pub(super) const DEDUPE_RUN_SELECT: &str = r#"
    SELECT id, request_key, request_attempt, parent_scan_session_id,
           scope_json, scope_snapshot_json, scope_hash, scope_snapshot_hash,
           publication_mode,
           status, phase, revision, cancel_requested, rerun_required,
           candidate_files, candidate_physical_objects, candidate_bytes,
           identity_verified_files, identity_unknown_files, hardlink_aliases,
           prehashed_files, prehash_pruned_files, full_hashed_files,
           duplicate_groups, duplicate_members, exact_reclaimable_bytes,
           potential_reclaimable_bytes, processed_files, processed_bytes,
           total_bytes, warning_count, error_count, started_at, finished_at,
           last_checkpoint_at, created_at, updated_at, error_code, error_message
    FROM dedupe_runs
"#;

pub(super) fn query_dedupe_run(conn: &Connection, run_id: &str) -> Result<DedupeRunDto, DbError> {
    conn.query_row(
        &format!("{DEDUPE_RUN_SELECT} WHERE id = ?1"),
        params![run_id],
        dedupe_run_from_row,
    )
    .map_err(DbError::from)
}

pub(super) fn dedupe_run_from_row(row: &Row<'_>) -> rusqlite::Result<DedupeRunDto> {
    let scope_json: String = row.get(4)?;
    let snapshot_json: String = row.get(5)?;
    Ok(DedupeRunDto {
        id: row.get(0)?,
        request_key: row.get(1)?,
        request_attempt: row.get(2)?,
        parent_scan_session_id: row.get(3)?,
        scope: serde_json::from_str(&scope_json).unwrap_or(Value::Null),
        scope_snapshot: serde_json::from_str(&snapshot_json).unwrap_or(Value::Null),
        scope_hash: row.get(6)?,
        scope_snapshot_hash: row.get(7)?,
        publication_mode: row.get(8)?,
        status: row.get(9)?,
        phase: row.get(10)?,
        revision: row.get(11)?,
        cancel_requested: row.get::<_, i64>(12)? != 0,
        rerun_required: row.get::<_, i64>(13)? != 0,
        candidate_files: row.get(14)?,
        candidate_physical_objects: row.get(15)?,
        candidate_bytes: row.get(16)?,
        identity_verified_files: row.get(17)?,
        identity_unknown_files: row.get(18)?,
        hardlink_aliases: row.get(19)?,
        prehashed_files: row.get(20)?,
        prehash_pruned_files: row.get(21)?,
        full_hashed_files: row.get(22)?,
        duplicate_groups: row.get(23)?,
        duplicate_members: row.get(24)?,
        exact_reclaimable_bytes: row.get(25)?,
        potential_reclaimable_bytes: row.get(26)?,
        processed_files: row.get(27)?,
        processed_bytes: row.get(28)?,
        total_bytes: row.get(29)?,
        warning_count: row.get(30)?,
        error_count: row.get(31)?,
        started_at: row.get(32)?,
        finished_at: row.get(33)?,
        last_checkpoint_at: row.get(34)?,
        created_at: row.get(35)?,
        updated_at: row.get(36)?,
        error_code: row.get(37)?,
        error_message: row.get(38)?,
    })
}

pub(super) const FINGERPRINT_SELECT: &str = r#"
    SELECT file_id, path_snapshot, identity_status, platform_kind,
           platform_volume_id, platform_file_id, physical_key, link_count,
           size, modified_ns, prehash, prehash_algorithm, prehash_version,
           prehash_sample_bytes, full_hash, full_hash_algorithm, full_hash_version,
           fingerprint_status, captured_at, prehashed_at, full_hashed_at,
           last_verified_at, error_code, error_message, revision
    FROM file_fingerprints
"#;

pub(super) fn query_fingerprint(
    conn: &Connection,
    file_id: &str,
) -> Result<Option<FingerprintRow>, DbError> {
    conn.query_row(
        &format!("{FINGERPRINT_SELECT} WHERE file_id = ?1"),
        params![file_id],
        fingerprint_from_row,
    )
    .optional()
    .map_err(DbError::from)
}

pub(super) fn fingerprint_from_row(row: &Row<'_>) -> rusqlite::Result<FingerprintRow> {
    Ok(FingerprintRow {
        file_id: row.get(0)?,
        path_snapshot: row.get(1)?,
        identity_status: row.get(2)?,
        platform_kind: row.get(3)?,
        platform_volume_id: row.get(4)?,
        platform_file_id: row.get(5)?,
        physical_key: row.get(6)?,
        link_count: row.get(7)?,
        size: row.get(8)?,
        modified_ns: row.get(9)?,
        prehash: row.get(10)?,
        prehash_algorithm: row.get(11)?,
        prehash_version: row.get(12)?,
        prehash_sample_bytes: row.get(13)?,
        full_hash: row.get(14)?,
        full_hash_algorithm: row.get(15)?,
        full_hash_version: row.get(16)?,
        fingerprint_status: row.get(17)?,
        captured_at: row.get(18)?,
        prehashed_at: row.get(19)?,
        full_hashed_at: row.get(20)?,
        last_verified_at: row.get(21)?,
        error_code: row.get(22)?,
        error_message: row.get(23)?,
        revision: row.get(24)?,
    })
}

pub(super) const GROUP_SELECT: &str = r#"
    SELECT id, size_each, full_hash, full_hash_algorithm, full_hash_version,
           member_count, physical_copy_count, hardlink_alias_count,
           exact_reclaimable_bytes, potential_reclaimable_bytes,
           reclaimable_confidence, status, last_built_run_id, revision,
           created_at, updated_at, last_verified_at
    FROM duplicate_groups
"#;

pub(super) fn group_from_row(row: &Row<'_>) -> rusqlite::Result<DedupeGroupDto> {
    Ok(DedupeGroupDto {
        id: row.get(0)?,
        size_each: row.get(1)?,
        full_hash: row.get(2)?,
        full_hash_algorithm: row.get(3)?,
        full_hash_version: row.get(4)?,
        member_count: row.get(5)?,
        physical_copy_count: row.get(6)?,
        hardlink_alias_count: row.get(7)?,
        exact_reclaimable_bytes: row.get(8)?,
        potential_reclaimable_bytes: row.get(9)?,
        reclaimable_confidence: row.get(10)?,
        status: row.get(11)?,
        last_built_run_id: row.get(12)?,
        revision: row.get(13)?,
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
        last_verified_at: row.get(16)?,
        representative_paths: Vec::new(),
    })
}

pub(super) fn add_representative_paths(
    conn: &Connection,
    mut group: DedupeGroupDto,
) -> Result<DedupeGroupDto, DbError> {
    let mut statement = conn.prepare(
        "SELECT path_snapshot FROM duplicate_group_members WHERE group_id = ?1 ORDER BY path_snapshot COLLATE NOCASE, file_id LIMIT 3",
    )?;
    group.representative_paths = statement
        .query_map(params![group.id], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(group)
}

pub(super) fn group_member_from_row(row: &Row<'_>) -> rusqlite::Result<DedupeGroupMemberDto> {
    Ok(DedupeGroupMemberDto {
        group_id: row.get(0)?,
        file_id: row.get(1)?,
        path_snapshot: row.get(2)?,
        physical_key: row.get(3)?,
        identity_status: row.get(4)?,
        is_hardlink_alias: row.get::<_, i64>(5)? != 0,
        size: row.get(6)?,
        modified_ns: row.get(7)?,
        verified_at: row.get(8)?,
    })
}

pub(super) fn parse_group_cursor(value: &str) -> Result<GroupCursor, DbError> {
    let cursor: GroupCursor = serde_json::from_str(value).map_err(|_| {
        DbError::Validation(
            "Duplicate group cursor is invalid or from another version.".to_string(),
        )
    })?;
    if cursor.id.trim().is_empty() || cursor.full_hash.trim().is_empty() {
        return Err(DbError::Validation(
            "Duplicate group cursor is incomplete.".to_string(),
        ));
    }
    Ok(cursor)
}
