use super::*;

pub(crate) fn load_run(conn: &Connection, run_id: &str) -> Result<ContentRunDto, DbError> {
    conn.query_row(
        "SELECT id, scope_json, mode, provider_mode, status, expected_library_revision,
                candidate_fingerprint, candidate_resolver, byte_budget, char_budget,
                requested_count, materialized_count, completed_count, blocked_count,
                skipped_count, failed_count, provider_revision, provider_confirmed,
                cancel_requested, revision,
                last_error_code, last_error_detail, created_at, updated_at, completed_at
         FROM content_runs WHERE id=?1",
        params![run_id.trim()],
        run_from_row,
    )
    .map_err(DbError::from)
}

pub(crate) fn run_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ContentRunDto> {
    Ok(ContentRunDto {
        id: row.get(0)?,
        scope: serde_json::from_str(&row.get::<_, String>(1)?)
            .unwrap_or(FileLibraryScopeV2::AllEnabledRoots),
        mode: row.get(2)?,
        provider_mode: row.get(3)?,
        status: row.get(4)?,
        expected_library_revision: row.get(5)?,
        candidate_fingerprint: row.get(6)?,
        candidate_resolver: row.get(7)?,
        byte_budget: row.get(8)?,
        char_budget: row.get(9)?,
        requested_count: row.get(10)?,
        materialized_count: row.get(11)?,
        completed_count: row.get(12)?,
        blocked_count: row.get(13)?,
        skipped_count: row.get(14)?,
        failed_count: row.get(15)?,
        provider_revision: row.get(16)?,
        provider_confirmed: row.get::<_, i64>(17)? != 0,
        cancel_requested: row.get::<_, i64>(18)? != 0,
        revision: row.get(19)?,
        last_error_code: row.get(20)?,
        last_error_detail: row.get(21)?,
        created_at: row.get(22)?,
        updated_at: row.get(23)?,
        completed_at: row.get(24)?,
    })
}

pub(crate) fn item_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ContentRunItemDto> {
    Ok(ContentRunItemDto {
        id: row.get(0)?,
        run_id: row.get(1)?,
        file_id: row.get(2)?,
        ordinal: row.get(3)?,
        status: row.get(4)?,
        root_id: row.get(5)?,
        source_is_dir: row.get::<_, i64>(6)? != 0,
        source_size: row.get(7)?,
        source_mtime: row.get(8)?,
        source_hash: row.get(9)?,
        extractor_family: row.get(10)?,
        extractor_version: row.get(11)?,
        artifact_id: row.get(12)?,
        provider_status: row.get(13)?,
        provider_revision: row.get(14)?,
        provider_completed_at: row.get(15)?,
        error_code: row.get(16)?,
        error_detail: row.get(17)?,
        revision: row.get(18)?,
        updated_at: row.get(19)?,
    })
}

pub(crate) fn artifact_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ContentArtifactDto> {
    Ok(ContentArtifactDto {
        id: row.get(0)?,
        file_id: row.get(1)?,
        scan_root_id: row.get(2)?,
        source_size: row.get(3)?,
        source_mtime: row.get(4)?,
        source_is_dir: row.get::<_, i64>(5)? != 0,
        source_hash: row.get(6)?,
        extractor_family: row.get(7)?,
        extractor_version: row.get(8)?,
        policy_revision: row.get(9)?,
        provider_kind: row.get(10)?,
        provider_model: row.get(11)?,
        prompt_policy_version: row.get(12)?,
        content_fingerprint: row.get(13)?,
        status: row.get(14)?,
        summary: row.get(15)?,
        keywords: serde_json::from_str(&row.get::<_, String>(16)?).unwrap_or_default(),
        language: row.get(17)?,
        truncated: row.get::<_, i64>(18)? != 0,
        text_retained: row.get::<_, i64>(19)? != 0,
        provenance: serde_json::from_str(&row.get::<_, String>(20)?)
            .unwrap_or(Value::Object(Default::default())),
        revision: row.get(21)?,
        created_at: row.get(22)?,
        updated_at: row.get(23)?,
        last_run_id: row.get(24)?,
    })
}
