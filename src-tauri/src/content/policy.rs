use super::{
    default_policy, ContentPreviewRequest, ContentScopePolicyDto, DbError, CONTENT_VERSION,
    MAX_ITEMS,
};
use rusqlite::{params, Connection, OptionalExtension};

pub(crate) fn load_policy(
    conn: &Connection,
    root_id: &str,
) -> Result<ContentScopePolicyDto, DbError> {
    let now = crate::db::current_unix_seconds();
    let root_revision = conn
        .query_row(
            "SELECT revision FROM scan_roots WHERE id=?1 AND source_kind='file_library'",
            params![root_id.trim()],
            |row| row.get::<_, i64>(0),
        )
        .optional()?
        .unwrap_or(0);
    let row = conn
        .query_row(
            "SELECT scan_root_id, enabled, extractor_families_json, max_bytes, max_chars,
                max_pages, max_rows, raw_retention_mode, raw_retention_chars,
                local_allowed, cloud_allowed, policy_revision, updated_at
         FROM content_scope_policies WHERE scan_root_id=?1",
            params![root_id.trim()],
            |row| {
                Ok(ContentScopePolicyDto {
                    root_id: row.get(0)?,
                    root_revision,
                    enabled: row.get::<_, i64>(1)? != 0,
                    extractor_families: serde_json::from_str(&row.get::<_, String>(2)?)
                        .unwrap_or_default(),
                    max_bytes: row.get(3)?,
                    max_chars: row.get(4)?,
                    max_pages: row.get(5)?,
                    max_rows: row.get(6)?,
                    raw_retention_mode: row.get(7)?,
                    raw_retention_chars: row.get(8)?,
                    local_allowed: row.get::<_, i64>(9)? != 0,
                    cloud_allowed: row.get::<_, i64>(10)? != 0,
                    policy_revision: row.get(11)?,
                    updated_at: row.get(12)?,
                })
            },
        )
        .optional()?;
    Ok(row.unwrap_or_else(|| default_policy(root_id, now)))
}

pub(crate) fn validate_policy(
    policy: &ContentScopePolicyDto,
    root_id: &str,
) -> Result<(), DbError> {
    if policy.root_id != root_id
        || policy.extractor_families.len() > 16
        || policy.extractor_families.iter().any(|family| {
            !matches!(
                family.as_str(),
                "txt" | "md" | "csv" | "pdf_text" | "docx" | "xlsx" | "pptx"
            )
        })
        || policy.max_bytes < 1024
        || policy.max_bytes > 64 * 1024 * 1024
        || policy.max_chars < 256
        || policy.max_chars > 262_144
        || policy.max_pages < 1
        || policy.max_pages > 1_000
        || policy.max_rows < 1
        || policy.max_rows > 100_000
        || policy.raw_retention_chars < 0
        || policy.raw_retention_chars > 262_144
        || !matches!(policy.raw_retention_mode.as_str(), "none" | "bounded")
        || (policy.raw_retention_mode == "bounded" && policy.raw_retention_chars == 0)
    {
        return Err(DbError::Validation("content_policy_invalid".into()));
    }
    Ok(())
}

pub(crate) fn validate_preview_request(request: &ContentPreviewRequest) -> Result<(), DbError> {
    if request.version != CONTENT_VERSION
        || request.request_id.trim().is_empty()
        || request.request_id.chars().count() > 128
        || request.selection_file_ids.len() > MAX_ITEMS
        || !matches!(
            request.mode.as_str(),
            "local" | "understand" | "local_and_understand"
        )
        || !matches!(
            request.provider_mode.as_str(),
            "none" | "existing_interactive_provider"
        )
    {
        return Err(DbError::Validation(
            "content_preview_request_invalid".into(),
        ));
    }
    Ok(())
}

pub(crate) fn validate_start_request(
    request: &super::StartContentRunRequest,
) -> Result<(), DbError> {
    if request.version != CONTENT_VERSION
        || !request.confirmed
        || request.preview_fingerprint.trim().is_empty()
    {
        return Err(DbError::Validation(
            "content_start_confirmation_required".into(),
        ));
    }
    validate_preview_request(&ContentPreviewRequest {
        version: request.version,
        request_id: request.request_id.clone(),
        scope: request.scope.clone(),
        selection_file_ids: request.selection_file_ids.clone(),
        mode: request.mode.clone(),
        expected_library_revision: request.expected_library_revision,
        expected_policy_revisions: request.expected_policy_revisions.clone(),
        provider_mode: request.provider_mode.clone(),
    })
}
