//! Consent-bound local content understanding.
//!
//! The module deliberately keeps content understanding separate from the File
//! Library, scanner, watcher, rule and operation authorities. It accepts only
//! durable IDs/scopes, reads bytes on the backend after root validation, stores
//! bounded deterministic facts, and never stores raw text unless a root policy
//! explicitly opts into a bounded retention cap.

use crate::{
    ai::{
        schema::{AIChatMessage, AIChatRequest, AIProviderKind, AIProviderOptions},
        settings::{
            get_ai_settings_for_db, normalize_ai_settings, provider_for_settings,
            validate_ai_settings,
        },
        trace::{AITraceContext, AITraceOperation},
    },
    db::{
        current_library_revision, resolve_scope, Database, DbError, FileLibraryScopeV2,
        LibraryScopeHealthDto,
    },
    window_auth::require_main_window,
};
use blake3::Hasher;
use rusqlite::{
    params, params_from_iter, types::Value as SqlValue, Connection, OptionalExtension,
    TransactionBehavior,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    fs::File,
    io::{Cursor, Read},
    path::Path,
    time::{Duration, Instant, UNIX_EPOCH},
};
use tauri::{Runtime, State, WebviewWindow};
use zip::ZipArchive;

const CONTENT_VERSION: i32 = 1;
const EXTRACTOR_VERSION: &str = "content-extractor-v1";
const DEFAULT_MAX_BYTES: i64 = 8 * 1024 * 1024;
const DEFAULT_MAX_CHARS: usize = 32 * 1024;
const MAX_SAMPLE: u32 = 20;
const MAX_ITEMS: usize = 10_000;
const MAX_QUERY_CHARS: usize = 256;
const MAX_RETAINED_TEXT_BYTES: i64 = 4 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentScopePolicyDto {
    pub root_id: String,
    pub root_revision: i64,
    pub enabled: bool,
    pub extractor_families: Vec<String>,
    pub max_bytes: i64,
    pub max_chars: i64,
    pub max_pages: i64,
    pub max_rows: i64,
    pub raw_retention_mode: String,
    pub raw_retention_chars: i64,
    pub local_allowed: bool,
    pub cloud_allowed: bool,
    pub policy_revision: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct SetContentScopePolicyRequest {
    pub version: i32,
    pub root_id: String,
    pub expected_root_revision: i64,
    pub expected_policy_revision: i64,
    pub confirmed: bool,
    pub policy: ContentScopePolicyDto,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct ContentPolicyRevisionRequest {
    pub root_id: String,
    pub root_revision: i64,
    pub policy_revision: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct ContentPreviewRequest {
    pub version: i32,
    pub request_id: String,
    pub scope: FileLibraryScopeV2,
    #[serde(default)]
    pub selection_file_ids: Vec<String>,
    pub mode: String,
    pub expected_library_revision: i64,
    #[serde(default)]
    pub expected_policy_revisions: Vec<ContentPolicyRevisionRequest>,
    #[serde(default = "default_provider_mode")]
    pub provider_mode: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct StartContentRunRequest {
    pub version: i32,
    pub request_id: String,
    pub scope: FileLibraryScopeV2,
    #[serde(default)]
    pub selection_file_ids: Vec<String>,
    pub mode: String,
    pub expected_library_revision: i64,
    #[serde(default)]
    pub expected_policy_revisions: Vec<ContentPolicyRevisionRequest>,
    #[serde(default = "default_provider_mode")]
    pub provider_mode: String,
    pub preview_fingerprint: String,
    pub confirmed: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct ContentRunIdRequest {
    pub run_id: String,
    pub expected_revision: i64,
    pub confirmed: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct ContentRunPageRequest {
    pub limit: u32,
    #[serde(default)]
    pub cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentScopeHealthDto {
    pub scope: FileLibraryScopeV2,
    pub health: LibraryScopeHealthDto,
    pub root_ids: Vec<String>,
    pub policy_revisions: Vec<ContentPolicyRevisionRequest>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentSampleDto {
    pub file_id: String,
    pub name: String,
    pub extension: String,
    pub size: i64,
    pub modified_at: i64,
    pub status: String,
    pub extractor_family: Option<String>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentPreviewDto {
    pub version: i32,
    pub request_id: String,
    pub scope_health: ContentScopeHealthDto,
    pub exact_count: i64,
    pub deferred_count: Option<i64>,
    pub exact_state: String,
    pub byte_budget: i64,
    pub char_budget: i64,
    pub supported_count: i64,
    pub unsupported_count: i64,
    pub blocked_count: i64,
    pub failed_count: i64,
    pub supported_formats: Vec<String>,
    pub unsupported_formats: Vec<String>,
    pub blocked_reasons: Vec<String>,
    pub local_allowed: bool,
    pub cloud_allowed: bool,
    pub raw_retention_disclosure: String,
    pub sample: Vec<ContentSampleDto>,
    pub library_revision: i64,
    pub policy_fingerprint: String,
    pub preview_fingerprint: String,
    pub requires_confirmation: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentRunDto {
    pub id: String,
    pub scope: FileLibraryScopeV2,
    pub mode: String,
    pub provider_mode: String,
    pub status: String,
    pub expected_library_revision: i64,
    pub byte_budget: i64,
    pub char_budget: i64,
    pub requested_count: i64,
    pub materialized_count: i64,
    pub completed_count: i64,
    pub blocked_count: i64,
    pub skipped_count: i64,
    pub failed_count: i64,
    pub revision: i64,
    pub last_error_code: Option<String>,
    pub last_error_detail: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub completed_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentRunItemDto {
    pub id: String,
    pub run_id: String,
    pub file_id: String,
    pub ordinal: i64,
    pub status: String,
    pub root_id: Option<String>,
    pub source_is_dir: bool,
    pub source_size: i64,
    pub source_mtime: i64,
    pub source_hash: String,
    pub extractor_family: Option<String>,
    pub extractor_version: Option<String>,
    pub artifact_id: Option<String>,
    pub error_code: Option<String>,
    pub error_detail: Option<String>,
    pub revision: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct ContentRunItemPageRequest {
    pub run_id: String,
    pub limit: u32,
    #[serde(default)]
    pub cursor: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentRunItemPageDto {
    pub run_id: String,
    pub items: Vec<ContentRunItemDto>,
    pub next_cursor: Option<i64>,
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentArtifactDto {
    pub id: String,
    pub file_id: String,
    pub scan_root_id: Option<String>,
    pub source_size: i64,
    pub source_mtime: i64,
    pub source_is_dir: bool,
    pub source_hash: String,
    pub extractor_family: String,
    pub extractor_version: String,
    pub policy_revision: i64,
    pub provider_kind: Option<String>,
    pub provider_model: Option<String>,
    pub prompt_policy_version: Option<i64>,
    pub content_fingerprint: String,
    pub status: String,
    pub summary: Option<String>,
    pub keywords: Vec<String>,
    pub language: Option<String>,
    pub truncated: bool,
    pub text_retained: bool,
    pub provenance: Value,
    pub revision: i64,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_run_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct ContentArtifactQueryRequest {
    pub file_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct ContentArtifactPageRequest {
    pub query: String,
    pub scope: FileLibraryScopeV2,
    pub expected_library_revision: i64,
    pub limit: u32,
    #[serde(default)]
    pub cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentArtifactPageDto {
    pub artifacts: Vec<ContentArtifactDto>,
    pub next_cursor: Option<String>,
    pub has_more: bool,
    pub library_revision: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct ContentArtifactMutationRequest {
    pub file_id: String,
    pub expected_revision: i64,
    pub confirmed: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct PurgeContentScopeRequest {
    pub version: i32,
    pub scope: FileLibraryScopeV2,
    pub expected_library_revision: i64,
    #[serde(default)]
    pub expected_policy_revisions: Vec<ContentPolicyRevisionRequest>,
    pub confirmed: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct UnderstandContentArtifactsRequest {
    pub version: i32,
    pub artifact_ids: Vec<String>,
    pub expected_revisions: Vec<i64>,
    pub confirmed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentUnderstandingResultDto {
    pub processed_count: i64,
    pub blocked_count: i64,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
struct ContentModelEnvelopeV1 {
    summary: String,
    #[serde(default)]
    keywords: Vec<String>,
    #[serde(default)]
    language: Option<String>,
    #[serde(default)]
    warnings: Vec<String>,
}

#[derive(Debug, Clone)]
struct UnderstandingArtifact {
    id: String,
    file_id: String,
    revision: i64,
    status: String,
    root_id: Option<String>,
    source_hash: String,
    raw_text: Option<String>,
    risk_level: String,
}

#[derive(Debug, Clone)]
struct Candidate {
    id: String,
    path: String,
    name: String,
    extension: String,
    size: i64,
    mtime: i64,
    is_dir: bool,
    root_id: String,
    content_hash: String,
}

#[derive(Debug, Clone)]
struct Policy {
    dto: ContentScopePolicyDto,
}

#[derive(Debug, Clone)]
struct Extraction {
    family: String,
    text: String,
    source_hash: String,
    truncated: bool,
    status: &'static str,
    reason: Option<String>,
}

fn default_provider_mode() -> String {
    "none".to_string()
}

fn default_policy(root_id: &str, now: i64) -> ContentScopePolicyDto {
    ContentScopePolicyDto {
        root_id: root_id.to_string(),
        root_revision: 0,
        enabled: false,
        extractor_families: vec![
            "txt".into(),
            "md".into(),
            "csv".into(),
            "pdf_text".into(),
            "docx".into(),
            "xlsx".into(),
            "pptx".into(),
        ],
        max_bytes: DEFAULT_MAX_BYTES,
        max_chars: DEFAULT_MAX_CHARS as i64,
        max_pages: 100,
        max_rows: 10_000,
        raw_retention_mode: "none".into(),
        raw_retention_chars: 0,
        local_allowed: false,
        cloud_allowed: false,
        policy_revision: 0,
        updated_at: now,
    }
}

impl Database {
    pub fn prune_content_artifacts(&self) -> Result<usize, DbError> {
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        let now = crate::db::current_unix_seconds();
        let stale_cutoff = now.saturating_sub(30 * 24 * 60 * 60);
        let retained_cutoff = now.saturating_sub(7 * 24 * 60 * 60);
        tx.execute(
            "UPDATE content_artifacts SET raw_text=NULL, text_retained=0,
                    revision=revision+1, updated_at=?1
             WHERE text_retained=1 AND updated_at < ?2",
            params![now, retained_cutoff],
        )?;
        let retained_ids = {
            let mut stmt = tx.prepare(
                "SELECT id, COALESCE(length(CAST(raw_text AS BLOB)), 0)
                 FROM content_artifacts
                 WHERE text_retained=1 AND raw_text IS NOT NULL
                 ORDER BY updated_at DESC, id DESC",
            )?;
            let rows = stmt.query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
            })?;
            let mut used = 0_i64;
            let mut overflow = Vec::new();
            for row in rows {
                let (id, chars) = row?;
                if used.saturating_add(chars) > MAX_RETAINED_TEXT_BYTES {
                    overflow.push(id);
                } else {
                    used = used.saturating_add(chars);
                }
            }
            overflow
        };
        for id in retained_ids {
            tx.execute(
                "UPDATE content_artifacts SET raw_text=NULL, text_retained=0,
                        revision=revision+1, updated_at=?2 WHERE id=?1",
                params![id, now],
            )?;
        }
        tx.execute(
            "UPDATE content_artifact_fts SET raw_text=NULL
             WHERE artifact_id IN (SELECT id FROM content_artifacts WHERE text_retained=0)",
            [],
        )?;
        let deleted_artifacts = tx.execute(
            "DELETE FROM content_artifacts WHERE status='stale' AND updated_at < ?1",
            params![stale_cutoff],
        )?;
        tx.execute(
            "UPDATE content_run_items SET artifact_id=NULL, revision=revision+1,
                    updated_at=?1 WHERE artifact_id NOT IN (SELECT id FROM content_artifacts)",
            params![now],
        )?;
        tx.execute("DELETE FROM content_artifact_fts WHERE artifact_id NOT IN (SELECT id FROM content_artifacts)", [])?;
        let run_ids_to_delete = {
            let mut stmt = tx.prepare(
                "SELECT id FROM content_runs
                 WHERE status IN ('completed','partially_completed','cancelled','failed','stale')
                   AND (updated_at < ?1 OR id IN (
                       SELECT id FROM content_runs
                       WHERE status IN ('completed','partially_completed','cancelled','failed','stale')
                       ORDER BY updated_at DESC, id DESC LIMIT -1 OFFSET 100
                   ))
                 ORDER BY updated_at ASC, id ASC LIMIT 20",
            )?;
            let rows = stmt.query_map(params![stale_cutoff], |row| row.get::<_, String>(0))?;
            rows.collect::<Result<Vec<_>, _>>()?
        };
        for run_id in run_ids_to_delete {
            tx.execute(
                "DELETE FROM content_run_items WHERE run_id=?1",
                params![run_id],
            )?;
            tx.execute("DELETE FROM content_runs WHERE id=?1", params![run_id])?;
        }
        tx.commit()?;
        Ok(deleted_artifacts)
    }

    pub fn recover_content_runs(&self) -> Result<usize, DbError> {
        let conn = self.conn()?;
        let now = crate::db::current_unix_seconds();
        conn.execute(
            "UPDATE content_artifacts SET status='stale', revision=revision+1,
                    updated_at=?1
             WHERE status='current' AND extractor_version <> ?2",
            params![now, EXTRACTOR_VERSION],
        )?;
        let changed = conn.execute(
            "UPDATE content_runs SET status='failed', revision=revision+1,
                    last_error_code='content_run_interrupted',
                    last_error_detail='The previous owner stopped before the run reached a terminal state.',
                    updated_at=?1
             WHERE status IN ('building','ready','running','cancelling')",
            params![now],
        )?;
        conn.execute(
            "UPDATE content_run_items SET status='failed', error_code='content_run_interrupted',
                    error_detail='The previous run owner stopped.', revision=revision+1,
                    updated_at=?1 WHERE status IN ('pending','running')
             AND run_id IN (SELECT id FROM content_runs WHERE status='failed')",
            params![now],
        )?;
        Ok(changed)
    }

    pub fn get_content_scope_policy(
        &self,
        root_id: &str,
    ) -> Result<ContentScopePolicyDto, DbError> {
        let conn = self.conn()?;
        load_policy(&conn, root_id)
    }

    pub fn set_content_scope_policy(
        &self,
        request: SetContentScopePolicyRequest,
    ) -> Result<ContentScopePolicyDto, DbError> {
        if request.version != CONTENT_VERSION
            || request.root_id.trim().is_empty()
            || !request.confirmed
        {
            return Err(DbError::Validation("content_policy_request_invalid".into()));
        }
        if request.policy.policy_revision != request.expected_policy_revision {
            return Err(DbError::Validation(
                "content_policy_revision_conflict".into(),
            ));
        }
        validate_policy(&request.policy, &request.root_id)?;
        let mut conn = self.conn()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let exists: Option<i64> = tx
            .query_row(
                "SELECT revision FROM scan_roots WHERE id = ?1 AND source_kind = 'file_library'",
                params![request.root_id.trim()],
                |row| row.get(0),
            )
            .optional()?;
        let Some(root_revision) = exists else {
            return Err(DbError::Validation("content_policy_root_invalid".into()));
        };
        if root_revision != request.expected_root_revision
            || request.policy.root_revision != request.expected_root_revision
        {
            return Err(DbError::Validation("content_root_revision_conflict".into()));
        }
        let now = crate::db::current_unix_seconds();
        let families = serde_json::to_string(&request.policy.extractor_families)?;
        let changed = tx.execute(
            "INSERT INTO content_scope_policies(
                scan_root_id, enabled, extractor_families_json, max_bytes, max_chars,
                max_pages, max_rows, raw_retention_mode, raw_retention_chars,
                local_allowed, cloud_allowed, policy_revision, created_at, updated_at
             ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,1,?12,?12)
             ON CONFLICT(scan_root_id) DO UPDATE SET
                enabled=excluded.enabled,
                extractor_families_json=excluded.extractor_families_json,
                max_bytes=excluded.max_bytes,
                max_chars=excluded.max_chars,
                max_pages=excluded.max_pages,
                max_rows=excluded.max_rows,
                raw_retention_mode=excluded.raw_retention_mode,
                raw_retention_chars=excluded.raw_retention_chars,
                local_allowed=excluded.local_allowed,
                cloud_allowed=excluded.cloud_allowed,
                policy_revision=content_scope_policies.policy_revision+1,
                updated_at=excluded.updated_at
             WHERE content_scope_policies.policy_revision = ?13",
            params![
                request.root_id.trim(),
                bool_i64(request.policy.enabled),
                families,
                request.policy.max_bytes,
                request.policy.max_chars,
                request.policy.max_pages,
                request.policy.max_rows,
                request.policy.raw_retention_mode,
                request.policy.raw_retention_chars,
                bool_i64(request.policy.local_allowed),
                bool_i64(request.policy.cloud_allowed),
                now,
                request.expected_policy_revision,
            ],
        )?;
        if changed != 1 {
            return Err(DbError::Validation(
                "content_policy_revision_conflict".into(),
            ));
        }
        tx.execute(
            "UPDATE content_artifacts
             SET status='stale', revision=revision+1, updated_at=?2
             WHERE scan_root_id=?1 AND status='current' AND policy_revision <> (
                 SELECT policy_revision FROM content_scope_policies WHERE scan_root_id=?1
             )",
            params![request.root_id.trim(), now],
        )?;
        if request.policy.raw_retention_mode == "none" || request.policy.raw_retention_chars == 0 {
            tx.execute(
                "UPDATE content_artifacts SET raw_text=NULL, text_retained=0,
                        revision=revision+1, updated_at=?2 WHERE scan_root_id=?1",
                params![request.root_id.trim(), now],
            )?;
            tx.execute(
                "UPDATE content_artifact_fts SET raw_text=NULL
                 WHERE artifact_id IN (SELECT id FROM content_artifacts WHERE scan_root_id=?1)",
                params![request.root_id.trim()],
            )?;
        }
        let policy = load_policy(&tx, &request.root_id)?;
        tx.commit()?;
        Ok(policy)
    }

    pub fn preview_content(
        &self,
        request: ContentPreviewRequest,
    ) -> Result<ContentPreviewDto, DbError> {
        validate_preview_request(&request)?;
        let conn = self.conn()?;
        build_content_preview(&conn, request)
    }

    pub fn start_content_run(
        &self,
        request: StartContentRunRequest,
    ) -> Result<ContentRunDto, DbError> {
        validate_start_request(&request)?;
        let preview = {
            let conn = self.conn()?;
            build_content_preview(
                &conn,
                ContentPreviewRequest {
                    version: request.version,
                    request_id: request.request_id.clone(),
                    scope: request.scope.clone(),
                    selection_file_ids: request.selection_file_ids.clone(),
                    mode: request.mode.clone(),
                    expected_library_revision: request.expected_library_revision,
                    expected_policy_revisions: request.expected_policy_revisions.clone(),
                    provider_mode: request.provider_mode.clone(),
                },
            )?
        };
        if !request.confirmed || preview.preview_fingerprint != request.preview_fingerprint {
            return Err(DbError::Validation(
                "content_preview_confirmation_or_revision_required".into(),
            ));
        }
        let provider_requested =
            matches!(request.mode.as_str(), "understand" | "local_and_understand");
        if provider_requested {
            if request.provider_mode != "existing_interactive_provider" {
                return Err(DbError::Validation(
                    "content_provider_not_configured_for_this_run".into(),
                ));
            }
            if preview.exact_count > MAX_SAMPLE as i64 {
                return Err(DbError::Validation(
                    "content_understanding_item_limit_exceeded".into(),
                ));
            }
            let settings = normalize_ai_settings(get_ai_settings_for_db(self)?);
            if !content_provider_is_configured(&settings) {
                return Err(DbError::Validation(
                    "content_provider_not_configured_for_this_run".into(),
                ));
            }
        }
        if preview.exact_count > MAX_ITEMS as i64 {
            return Err(DbError::Validation(
                "content_run_item_limit_exceeded".into(),
            ));
        }
        if preview.scope_health.health.state != "healthy"
            && preview.scope_health.health.state != "empty"
        {
            return Err(DbError::Validation("content_scope_unavailable".into()));
        }
        if preview.blocked_count > 0 && preview.supported_count == 0 {
            return Err(DbError::Validation(
                "content_scope_no_supported_files".into(),
            ));
        }
        let run_id = format!("content-run-{}", uuid::Uuid::new_v4());
        let now = crate::db::current_unix_seconds();
        let mut conn = self.conn()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let scope_json = serde_json::to_string(&request.scope)?;
        if current_library_revision(&tx)? != request.expected_library_revision {
            return Err(DbError::Validation(
                "content_library_revision_conflict".into(),
            ));
        }
        for expected in &request.expected_policy_revisions {
            let current = load_policy(&tx, &expected.root_id)?;
            if current.root_revision != expected.root_revision
                || current.policy_revision != expected.policy_revision
            {
                return Err(DbError::Validation(
                    "content_root_or_policy_revision_conflict".into(),
                ));
            }
        }
        let candidates = select_candidates(&tx, &request.scope, &request.selection_file_ids)?;
        tx.execute(
            "INSERT INTO content_runs(
                id, scope_json, scope_fingerprint, mode, provider_mode, status,
                expected_library_revision, policy_fingerprint, confirmation,
                byte_budget, char_budget, requested_count, materialized_count,
                created_at, updated_at
             ) VALUES (?1,?2,?3,?4,?5,'building',?6,?7,1,?8,?9,?10,?11,?12,?12)",
            params![
                run_id,
                scope_json,
                hash_bytes(serde_json::to_vec(&preview.scope_health)?),
                request.mode,
                request.provider_mode,
                request.expected_library_revision,
                preview.policy_fingerprint,
                preview.byte_budget,
                preview.char_budget,
                preview.exact_count,
                candidates.len() as i64,
                now,
            ],
        )?;
        for (ordinal, candidate) in candidates.iter().enumerate() {
            let policy = load_policy(&tx, &candidate.root_id)?;
            let extractor_family = classify_candidate(candidate, Some(&policy)).extractor_family;
            tx.execute(
                "INSERT INTO content_run_items(
                    id, run_id, file_id, ordinal, status, root_id, source_is_dir,
                    extractor_family, extractor_version, source_size, source_mtime,
                    created_at, updated_at
                 ) VALUES (?1,?2,?3,?4,'pending',?5,?6,?7,?8,?9,?10,?11,?11)",
                params![
                    format!("{run_id}-item-{ordinal}"),
                    run_id,
                    candidate.id,
                    ordinal as i64,
                    candidate.root_id,
                    bool_i64(candidate.is_dir),
                    extractor_family,
                    EXTRACTOR_VERSION,
                    candidate.size,
                    candidate.mtime,
                    now,
                ],
            )?;
        }
        tx.execute(
            "UPDATE content_runs SET status='ready', revision=revision+1, updated_at=?2
             WHERE id=?1 AND status='building'",
            params![run_id, now],
        )?;
        tx.commit()?;

        let conn = self.conn()?;
        conn.execute(
            "UPDATE content_runs SET status='running', revision=revision+1, updated_at=?2
             WHERE id=?1 AND status='ready'",
            params![run_id, crate::db::current_unix_seconds()],
        )?;
        drop(conn);

        // Local extraction is deterministic and bounded. It runs through the
        // same durable item ledger, so an interrupted process leaves explicit
        // pending/failed rows for startup recovery rather than replaying a
        // hidden queue.
        let selected_file_ids = candidates
            .iter()
            .map(|candidate| candidate.id.clone())
            .collect::<Vec<_>>();
        let run = self.process_content_run(&run_id, &request, candidates)?;
        if provider_requested && matches!(run.status.as_str(), "completed" | "partially_completed")
        {
            let mut artifact_ids = Vec::new();
            let mut expected_revisions = Vec::new();
            for file_id in selected_file_ids {
                if let Some(artifact) = self.get_content_artifact(&file_id)? {
                    if artifact.status == "current" {
                        artifact_ids.push(artifact.id);
                        expected_revisions.push(artifact.revision);
                    }
                }
            }
            if !artifact_ids.is_empty() {
                let understanding =
                    self.understand_content_artifacts(UnderstandContentArtifactsRequest {
                        version: CONTENT_VERSION,
                        artifact_ids,
                        expected_revisions,
                        confirmed: request.confirmed,
                    })?;
                let provider_status = if understanding.blocked_count > 0 {
                    "partially_completed"
                } else {
                    "completed"
                };
                let conn = self.conn()?;
                conn.execute(
                    "UPDATE content_runs SET status=?2, blocked_count=blocked_count+?3,
                            revision=revision+1, updated_at=?4,
                            completed_at=CASE WHEN ?2='completed' THEN ?4 ELSE completed_at END,
                            last_error_code=?5 WHERE id=?1 AND status IN ('completed','partially_completed')",
                    params![
                        run_id,
                        provider_status,
                        understanding.blocked_count,
                        crate::db::current_unix_seconds(),
                        understanding.reason,
                    ],
                )?;
            }
            return self.get_content_run(&run_id);
        }
        Ok(run)
    }

    pub fn get_content_run(&self, run_id: &str) -> Result<ContentRunDto, DbError> {
        let conn = self.conn()?;
        load_run(&conn, run_id)
    }

    pub fn list_content_runs(
        &self,
        request: ContentRunPageRequest,
    ) -> Result<Vec<ContentRunDto>, DbError> {
        let limit = request.limit.clamp(1, 100) as i64;
        let conn = self.conn()?;
        let mut sql = String::from(
            "SELECT id, scope_json, mode, provider_mode, status,
                    expected_library_revision, byte_budget, char_budget,
                    requested_count, materialized_count, completed_count,
                    blocked_count, skipped_count, failed_count, revision, last_error_code,
                    last_error_detail, created_at, updated_at, completed_at
             FROM content_runs",
        );
        let mut values = Vec::<SqlValue>::new();
        if let Some(cursor) = request.cursor.as_deref() {
            let (updated_at, id) = decode_cursor(cursor)?;
            sql.push_str(" WHERE (updated_at < ? OR (updated_at = ? AND id < ?))");
            values.push(SqlValue::Integer(updated_at));
            values.push(SqlValue::Integer(updated_at));
            values.push(SqlValue::Text(id));
        }
        sql.push_str(" ORDER BY updated_at DESC, id DESC LIMIT ?");
        values.push(SqlValue::Integer(limit));
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map(params_from_iter(values.iter()), run_from_row)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(DbError::from)
    }

    pub fn cancel_content_run(
        &self,
        request: ContentRunIdRequest,
    ) -> Result<ContentRunDto, DbError> {
        if !request.confirmed {
            return Err(DbError::Validation(
                "content_cancel_confirmation_required".into(),
            ));
        }
        let conn = self.conn()?;
        let changed = conn.execute(
            "UPDATE content_runs SET status='cancelling', revision=revision+1,
                    updated_at=?3
             WHERE id=?1 AND revision=?2 AND status IN ('building','ready','running')",
            params![
                request.run_id,
                request.expected_revision,
                crate::db::current_unix_seconds()
            ],
        )?;
        if changed != 1 {
            return Err(DbError::Validation("content_run_revision_conflict".into()));
        }
        load_run(&conn, &request.run_id)
    }

    pub fn query_content_run_items(
        &self,
        request: ContentRunItemPageRequest,
    ) -> Result<ContentRunItemPageDto, DbError> {
        let limit = request.limit.clamp(1, 100) as i64;
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            "SELECT id, run_id, file_id, ordinal, status, root_id, source_is_dir,
                    source_size, source_mtime, source_hash, extractor_family,
                    extractor_version, artifact_id, error_code, error_detail,
                    revision, updated_at
             FROM content_run_items
             WHERE run_id=?1 AND (?2 IS NULL OR ordinal > ?2)
             ORDER BY ordinal LIMIT ?3",
        )?;
        let mut items = stmt
            .query_map(
                params![request.run_id, request.cursor, limit + 1],
                item_from_row,
            )?
            .collect::<Result<Vec<_>, _>>()?;
        let has_more = items.len() > limit as usize;
        if has_more {
            items.truncate(limit as usize);
        }
        let next_cursor = if has_more {
            items.last().map(|item| item.ordinal)
        } else {
            None
        };
        Ok(ContentRunItemPageDto {
            run_id: request.run_id,
            items,
            next_cursor,
            has_more,
        })
    }

    pub fn get_content_artifact(
        &self,
        file_id: &str,
    ) -> Result<Option<ContentArtifactDto>, DbError> {
        let conn = self.conn()?;
        conn.query_row(
            "SELECT id, file_id, scan_root_id, source_size, source_mtime, source_is_dir,
                    source_hash, extractor_family, extractor_version, policy_revision,
                    provider_kind, provider_model, prompt_policy_version, content_fingerprint,
                    status, summary, keywords_json, language, truncated, text_retained,
                    provenance_json, revision, created_at, updated_at, last_run_id
             FROM content_artifacts WHERE file_id=?1",
            params![file_id.trim()],
            artifact_from_row,
        )
        .optional()
        .map_err(DbError::from)
    }

    pub fn query_content_artifacts(
        &self,
        request: ContentArtifactPageRequest,
    ) -> Result<ContentArtifactPageDto, DbError> {
        if request.query.chars().count() > MAX_QUERY_CHARS
            || request.limit == 0
            || request.limit > 100
        {
            return Err(DbError::Validation("content_query_invalid".into()));
        }
        let conn = self.conn()?;
        let library_revision = current_library_revision(&conn)?;
        if library_revision != request.expected_library_revision {
            return Err(DbError::Validation(
                "content_library_revision_conflict".into(),
            ));
        }
        let resolved = resolve_scope(&conn, &request.scope)?;
        if resolved.health.state != "healthy" {
            return Err(DbError::Validation("content_scope_unavailable".into()));
        }
        let mut params = resolved.params.clone();
        let needle = request.query.trim().to_lowercase();
        let mut where_clause = format!("({}) AND ca.status = 'current'", resolved.clause);
        if !needle.is_empty() {
            let query = fts_query(&needle);
            if query.trim().is_empty() {
                return Ok(ContentArtifactPageDto {
                    artifacts: Vec::new(),
                    next_cursor: None,
                    has_more: false,
                    library_revision,
                });
            }
            where_clause.push_str(" AND ca.id IN (SELECT artifact_id FROM content_artifact_fts WHERE content_artifact_fts MATCH ?)");
            params.push(SqlValue::Text(query));
        }
        let mut sql = format!(
            "SELECT ca.id, ca.file_id, ca.scan_root_id, ca.source_size, ca.source_mtime,
                    ca.source_is_dir, ca.source_hash, ca.extractor_family,
                    ca.extractor_version, ca.policy_revision, ca.provider_kind,
                    ca.provider_model, ca.prompt_policy_version, ca.content_fingerprint,
                    ca.status, ca.summary, ca.keywords_json, ca.language, ca.truncated,
                    ca.text_retained, ca.provenance_json, ca.revision, ca.created_at,
                    ca.updated_at, ca.last_run_id
             FROM content_artifacts ca JOIN files f ON f.id=ca.file_id
             WHERE {where_clause}"
        );
        if let Some(cursor) = request.cursor.as_deref() {
            sql.push_str(" AND (ca.updated_at < ? OR (ca.updated_at = ? AND ca.id < ?))");
            let decoded = decode_cursor(cursor)?;
            params.push(SqlValue::Integer(decoded.0));
            params.push(SqlValue::Integer(decoded.0));
            params.push(SqlValue::Text(decoded.1));
        }
        sql.push_str(" ORDER BY ca.updated_at DESC, ca.id DESC LIMIT ?");
        params.push(SqlValue::Integer(i64::from(request.limit) + 1));
        let mut artifacts = conn
            .prepare(&sql)?
            .query_map(params_from_iter(params.iter()), artifact_from_row)?
            .collect::<Result<Vec<_>, _>>()?;
        let has_more = artifacts.len() > request.limit as usize;
        if has_more {
            artifacts.truncate(request.limit as usize);
        }
        let next_cursor = if has_more {
            artifacts
                .last()
                .map(|artifact| encode_cursor(artifact.updated_at, &artifact.id))
        } else {
            None
        };
        Ok(ContentArtifactPageDto {
            artifacts,
            next_cursor,
            has_more,
            library_revision,
        })
    }

    pub fn rebuild_content_artifact(
        &self,
        request: ContentArtifactMutationRequest,
    ) -> Result<ContentArtifactDto, DbError> {
        if !request.confirmed {
            return Err(DbError::Validation(
                "content_rebuild_confirmation_required".into(),
            ));
        }
        let artifact = self
            .get_content_artifact(&request.file_id)?
            .ok_or_else(|| DbError::Validation("content_artifact_not_found".into()))?;
        if artifact.revision != request.expected_revision {
            return Err(DbError::Validation(
                "content_artifact_revision_conflict".into(),
            ));
        }
        let root_id = artifact
            .scan_root_id
            .clone()
            .ok_or_else(|| DbError::Validation("content_root_missing".into()))?;
        let policy = self.get_content_scope_policy(&root_id)?;
        let conn = self.conn()?;
        let library_revision = current_library_revision(&conn)?;
        let candidate = load_candidate_by_id(&conn, &request.file_id, &root_id)?
            .ok_or_else(|| DbError::Validation("library_file_unavailable".into()))?;
        let preview = build_content_preview(
            &conn,
            ContentPreviewRequest {
                version: CONTENT_VERSION,
                request_id: "rebuild-preview".into(),
                scope: FileLibraryScopeV2::Roots {
                    scan_root_ids: vec![policy.root_id.clone()],
                },
                selection_file_ids: vec![candidate.id.clone()],
                mode: "local".into(),
                expected_library_revision: library_revision,
                expected_policy_revisions: vec![ContentPolicyRevisionRequest {
                    root_id: policy.root_id.clone(),
                    root_revision: policy.root_revision,
                    policy_revision: policy.policy_revision,
                }],
                provider_mode: "none".into(),
            },
        )?;
        let run_request = StartContentRunRequest {
            version: CONTENT_VERSION,
            request_id: format!("rebuild-{}", uuid::Uuid::new_v4()),
            scope: FileLibraryScopeV2::Roots {
                scan_root_ids: vec![root_id],
            },
            selection_file_ids: vec![candidate.id.clone()],
            mode: "local".into(),
            expected_library_revision: library_revision,
            expected_policy_revisions: vec![ContentPolicyRevisionRequest {
                root_id: policy.root_id.clone(),
                root_revision: policy.root_revision,
                policy_revision: policy.policy_revision,
            }],
            provider_mode: "none".into(),
            preview_fingerprint: preview.preview_fingerprint,
            confirmed: true,
        };
        self.start_content_run(run_request)?;
        let rebuilt = self
            .get_content_artifact(&request.file_id)?
            .ok_or_else(|| DbError::Validation("content_artifact_not_created".into()))?;
        if rebuilt.status != "current" {
            return Err(DbError::Validation("content_rebuild_failed".into()));
        }
        Ok(rebuilt)
    }

    pub fn delete_content_artifact(
        &self,
        request: ContentArtifactMutationRequest,
    ) -> Result<bool, DbError> {
        if !request.confirmed {
            return Err(DbError::Validation(
                "content_delete_confirmation_required".into(),
            ));
        }
        let conn = self.conn()?;
        let changed = conn.execute(
            "DELETE FROM content_artifacts WHERE file_id=?1 AND revision=?2",
            params![request.file_id.trim(), request.expected_revision],
        )?;
        conn.execute("DELETE FROM content_artifact_fts WHERE artifact_id NOT IN (SELECT id FROM content_artifacts)", [])?;
        conn.execute(
            "UPDATE content_run_items SET artifact_id=NULL, revision=revision+1,
                    updated_at=?1 WHERE artifact_id NOT IN (SELECT id FROM content_artifacts)",
            params![crate::db::current_unix_seconds()],
        )?;
        if changed != 1 {
            return Err(DbError::Validation(
                "content_artifact_revision_conflict".into(),
            ));
        }
        Ok(true)
    }

    pub fn purge_content_scope(&self, request: PurgeContentScopeRequest) -> Result<i64, DbError> {
        if request.version != CONTENT_VERSION || !request.confirmed {
            return Err(DbError::Validation(
                "content_purge_confirmation_required".into(),
            ));
        }
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        let current = current_library_revision(&tx)?;
        if current != request.expected_library_revision {
            return Err(DbError::Validation(
                "content_scope_revision_conflict".into(),
            ));
        }
        let resolved = resolve_scope(&tx, &request.scope)?;
        if resolved.health.state != "healthy" && resolved.health.state != "empty" {
            return Err(DbError::Validation("content_scope_unavailable".into()));
        }
        let root_ids = resolved
            .health
            .roots
            .iter()
            .map(|root| root.id.clone())
            .collect::<Vec<_>>();
        if request.expected_policy_revisions.len() != root_ids.len()
            || request
                .expected_policy_revisions
                .iter()
                .map(|item| item.root_id.as_str())
                .collect::<HashSet<_>>()
                .len()
                != request.expected_policy_revisions.len()
            || request
                .expected_policy_revisions
                .iter()
                .any(|item| !root_ids.iter().any(|root_id| root_id == &item.root_id))
        {
            return Err(DbError::Validation(
                "content_root_or_policy_revision_required".into(),
            ));
        }
        for root_id in &root_ids {
            let current = load_policy(&tx, root_id)?;
            let Some(expected) = request
                .expected_policy_revisions
                .iter()
                .find(|item| item.root_id == *root_id)
            else {
                return Err(DbError::Validation(
                    "content_root_or_policy_revision_required".into(),
                ));
            };
            if current.root_revision != expected.root_revision
                || current.policy_revision != expected.policy_revision
            {
                return Err(DbError::Validation(
                    "content_root_or_policy_revision_conflict".into(),
                ));
            }
        }
        let changed = tx.execute(
            &format!("DELETE FROM content_artifacts WHERE file_id IN (SELECT f.id FROM files f WHERE {})", resolved.clause),
            params_from_iter(resolved.params.iter()),
        )? as i64;
        let run_ids = {
            let mut stmt = tx.prepare(&format!(
                "SELECT DISTINCT cri.run_id FROM content_run_items cri
                 JOIN files f ON f.id=cri.file_id WHERE {}",
                resolved.clause
            ))?;
            let rows = stmt.query_map(params_from_iter(resolved.params.iter()), |row| {
                row.get::<_, String>(0)
            })?;
            rows.collect::<Result<Vec<_>, _>>()?
        };
        for run_id in run_ids {
            tx.execute(
                "DELETE FROM content_run_items WHERE run_id=?1",
                params![run_id],
            )?;
            tx.execute("DELETE FROM content_runs WHERE id=?1", params![run_id])?;
        }
        tx.execute("DELETE FROM content_artifact_fts WHERE artifact_id NOT IN (SELECT id FROM content_artifacts)", [])?;
        tx.commit()?;
        Ok(changed)
    }

    pub fn understand_content_artifacts(
        &self,
        request: UnderstandContentArtifactsRequest,
    ) -> Result<ContentUnderstandingResultDto, DbError> {
        let unique_artifact_ids = request.artifact_ids.iter().collect::<HashSet<_>>();
        if request.version != CONTENT_VERSION
            || request.artifact_ids.is_empty()
            || request.artifact_ids.len() > MAX_SAMPLE as usize
            || request.artifact_ids.len() != request.expected_revisions.len()
            || unique_artifact_ids.len() != request.artifact_ids.len()
            || request
                .artifact_ids
                .iter()
                .any(|id| id.trim().is_empty() || id.chars().count() > 256)
        {
            return Err(DbError::Validation(
                "content_understand_request_invalid".into(),
            ));
        }
        if !request.confirmed {
            return Err(DbError::Validation(
                "content_understand_confirmation_required".into(),
            ));
        }
        let settings = normalize_ai_settings(get_ai_settings_for_db(self)?);
        if !content_provider_is_configured(&settings) {
            return Err(DbError::Validation(
                "content_provider_not_configured_for_this_run".into(),
            ));
        }
        validate_ai_settings(&settings, !cfg!(debug_assertions)).map_err(|error| {
            DbError::Validation(redact_content_provider_error(error, &settings.api_key))
        })?;
        let provider = provider_for_settings(&settings);
        let mut processed = 0_i64;
        let mut blocked = 0_i64;
        let mut first_reason = None;
        for (artifact_id, expected_revision) in request
            .artifact_ids
            .iter()
            .zip(request.expected_revisions.iter())
        {
            let artifact = self.load_understanding_artifact(artifact_id)?;
            let Some(artifact) = artifact else {
                blocked += 1;
                first_reason.get_or_insert_with(|| "content_artifact_not_found".into());
                continue;
            };
            if artifact.revision != *expected_revision || artifact.status != "current" {
                blocked += 1;
                first_reason.get_or_insert_with(|| "content_artifact_revision_conflict".into());
                continue;
            }
            let Some(root_id) = artifact.root_id.as_deref() else {
                blocked += 1;
                first_reason.get_or_insert_with(|| "content_root_missing".into());
                continue;
            };
            let policy = self.get_content_scope_policy(root_id)?;
            let provider_is_cloud = matches!(settings.provider, AIProviderKind::OpenAICompatible);
            if provider_is_cloud && matches!(artifact.risk_level.as_str(), "Sensitive" | "System") {
                blocked += 1;
                first_reason.get_or_insert_with(|| "content_sensitive_cloud_denied".into());
                continue;
            }
            let allowed = if provider_is_cloud {
                policy.enabled && policy.cloud_allowed
            } else {
                policy.enabled && policy.local_allowed
            };
            if !allowed {
                blocked += 1;
                first_reason.get_or_insert_with(|| "content_provider_consent_required".into());
                continue;
            }
            let payload = match self.load_understanding_payload(&artifact, &policy) {
                Ok(payload) => payload,
                Err(error) => {
                    blocked += 1;
                    first_reason.get_or_insert_with(|| content_error_code(&error));
                    continue;
                }
            };
            if payload.trim().is_empty() {
                blocked += 1;
                first_reason.get_or_insert_with(|| "content_extraction_text_unavailable".into());
                continue;
            }
            let prompt = serde_json::json!({
                "schemaVersion": "content_understanding_v1",
                "text": payload,
            });
            let raw = match provider.chat_json(AIChatRequest {
                messages: vec![
                    AIChatMessage {
                        role: "system".into(),
                        content: "Return only strict JSON with keys summary, keywords, language, warnings. Do not infer paths, commands, or actions.".into(),
                    },
                    AIChatMessage {
                        role: "user".into(),
                        content: serde_json::to_string(&prompt)?,
                    },
                ],
                model: settings.model.clone(),
                temperature: 0.0,
                max_tokens: settings.max_tokens.min(1_024),
                force_json: true,
                provider_options: AIProviderOptions {
                    enable_thinking: Some(false),
                    use_response_format: Some(true),
                    trace_context: Some(AITraceContext {
                        operation: AITraceOperation::ContentUnderstanding,
                        job_id: Some(format!("content-artifact-{artifact_id}")),
                        target_count: Some(1),
                        batch_size: Some(1),
                        redaction_secrets: vec![settings.api_key.clone()],
                        ..Default::default()
                    }),
                    ..Default::default()
                },
            }) {
                Ok(raw) => raw,
                Err(error) => {
                    blocked += 1;
                    first_reason.get_or_insert_with(|| {
                        redact_content_provider_error(error.to_string(), &settings.api_key)
                    });
                    continue;
                }
            };
            let envelope: ContentModelEnvelopeV1 = match serde_json::from_str(&raw) {
                Ok(value) => value,
                Err(_) => {
                    blocked += 1;
                    first_reason.get_or_insert_with(|| "content_model_json_invalid".into());
                    continue;
                }
            };
            if !validate_content_model_envelope(&envelope) {
                blocked += 1;
                first_reason.get_or_insert_with(|| "content_model_envelope_invalid".into());
                continue;
            }
            self.persist_understanding_result(&artifact, &envelope, &settings)?;
            processed += 1;
        }
        Ok(ContentUnderstandingResultDto {
            processed_count: processed,
            blocked_count: blocked,
            reason: first_reason,
        })
    }

    fn load_understanding_artifact(
        &self,
        artifact_id: &str,
    ) -> Result<Option<UnderstandingArtifact>, DbError> {
        let conn = self.conn()?;
        conn.query_row(
            "SELECT ca.id, ca.revision, ca.status, ca.scan_root_id,
                    ca.file_id, ca.source_hash, ca.raw_text, f.risk_level
             FROM content_artifacts ca JOIN files f ON f.id=ca.file_id
             WHERE ca.id=?1",
            params![artifact_id.trim()],
            |row| {
                Ok(UnderstandingArtifact {
                    id: row.get(0)?,
                    revision: row.get(1)?,
                    status: row.get(2)?,
                    root_id: row.get(3)?,
                    file_id: row.get(4)?,
                    source_hash: row.get(5)?,
                    raw_text: row.get(6)?,
                    risk_level: row.get(7)?,
                })
            },
        )
        .optional()
        .map_err(DbError::from)
    }

    fn load_understanding_payload(
        &self,
        artifact: &UnderstandingArtifact,
        policy: &ContentScopePolicyDto,
    ) -> Result<String, DbError> {
        let root_id = artifact
            .root_id
            .as_deref()
            .ok_or_else(|| DbError::Validation("content_root_missing".into()))?;
        let conn = self.conn()?;
        let root_path = conn.query_row(
            "SELECT normalized_path FROM scan_roots WHERE id=?1 AND source_kind='file_library'",
            params![root_id],
            |row| row.get::<_, String>(0),
        )?;
        let candidate = load_candidate_by_id(&conn, &artifact.file_id, root_id)?
            .ok_or_else(|| DbError::Validation("library_file_unavailable".into()))?;
        let extraction = extract_candidate(&candidate, policy, &root_path)?;
        if extraction.status != "completed" {
            return Err(DbError::Validation(
                extraction
                    .reason
                    .unwrap_or_else(|| "content_extraction_text_unavailable".into()),
            ));
        }
        if extraction.source_hash != artifact.source_hash {
            return Err(DbError::Validation("content_artifact_stale".into()));
        }
        Ok(extraction.text.chars().take(12_000).collect())
    }

    fn persist_understanding_result(
        &self,
        artifact: &UnderstandingArtifact,
        envelope: &ContentModelEnvelopeV1,
        settings: &crate::ai::settings::AISettings,
    ) -> Result<(), DbError> {
        let summary = envelope
            .summary
            .trim()
            .chars()
            .take(500)
            .collect::<String>();
        let keywords = normalized_model_keywords(&envelope.keywords);
        let language = envelope
            .language
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(|value| value.chars().take(16).collect::<String>());
        let provenance = serde_json::json!({
            "source": "interactive-provider",
            "provider": format!("{:?}", settings.provider),
            "model": settings.model.chars().take(128).collect::<String>(),
            "promptPolicyVersion": 1,
            "bounded": true,
        });
        let mut conn = self.conn()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let changed = tx.execute(
            "UPDATE content_artifacts
             SET provider_kind=?2, provider_model=?3, prompt_policy_version=1,
                 summary=?4, keywords_json=?5, language=?6,
                 provenance_json=?7, revision=revision+1, updated_at=?8
             WHERE id=?1 AND revision=?9 AND status='current'",
            params![
                artifact.id,
                format!("{:?}", settings.provider),
                settings.model.chars().take(128).collect::<String>(),
                summary,
                serde_json::to_string(&keywords)?,
                language,
                serde_json::to_string(&provenance)?,
                crate::db::current_unix_seconds(),
                artifact.revision,
            ],
        )?;
        if changed != 1 {
            return Err(DbError::Validation(
                "content_artifact_revision_conflict".into(),
            ));
        }
        tx.execute(
            "DELETE FROM content_artifact_fts WHERE artifact_id=?1",
            params![artifact.id],
        )?;
        tx.execute(
            "INSERT INTO content_artifact_fts(artifact_id, summary, keywords, language, raw_text)
             VALUES (?1,?2,?3,?4,?5)",
            params![
                artifact.id,
                summary,
                keywords.join(" "),
                language,
                artifact.raw_text,
            ],
        )?;
        tx.commit()?;
        Ok(())
    }

    fn process_content_run(
        &self,
        run_id: &str,
        request: &StartContentRunRequest,
        candidates: Vec<Candidate>,
    ) -> Result<ContentRunDto, DbError> {
        let mut completed = 0_i64;
        let mut blocked = 0_i64;
        let mut failed = 0_i64;
        for (ordinal, candidate) in candidates.iter().enumerate() {
            let status = self
                .get_content_run(run_id)
                .map(|run| run.status)
                .unwrap_or_else(|_| "running".into());
            if status == "cancelling" {
                self.finish_content_run(run_id, "cancelled", completed, blocked, failed, None)?;
                return self.get_content_run(run_id);
            }
            self.mark_content_item(run_id, ordinal as i64, "running", None, None)?;
            let policy = self.get_content_scope_policy(&candidate.root_id)?;
            let classification = classify_candidate(candidate, Some(&policy));
            let extraction = if classification.status == "supported" {
                let root_path = self.conn()?.query_row(
                    "SELECT normalized_path FROM scan_roots WHERE id=?1",
                    params![candidate.root_id],
                    |row| row.get::<_, String>(0),
                )?;
                extract_candidate(candidate, &policy, &root_path)
            } else {
                Ok(Extraction {
                    family: classification
                        .extractor_family
                        .unwrap_or_else(|| "policy".into()),
                    text: String::new(),
                    source_hash: String::new(),
                    truncated: false,
                    status: if classification.status == "unsupported" {
                        "unsupported"
                    } else {
                        "blocked"
                    },
                    reason: classification.reason,
                })
            };
            let extraction = match extraction {
                Ok(extraction) => extraction,
                Err(error) => Extraction {
                    family: "backend".into(),
                    text: String::new(),
                    source_hash: String::new(),
                    truncated: false,
                    status: "failed",
                    reason: Some(content_error_code(&error)),
                },
            };
            if extraction.status == "completed" {
                self.persist_artifact(run_id, candidate, &policy, &extraction)?;
                self.mark_content_item(run_id, ordinal as i64, "completed", None, None)?;
                completed += 1;
            } else if matches!(extraction.status, "blocked" | "unsupported") {
                self.persist_artifact(run_id, candidate, &policy, &extraction)?;
                self.mark_content_item(
                    run_id,
                    ordinal as i64,
                    "blocked",
                    extraction.reason.as_deref(),
                    extraction.reason.as_deref(),
                )?;
                blocked += 1;
            } else {
                // A rebuild failure must never leave an older current artifact
                // masquerading as the result of this run. Publish a bounded
                // failed projection (or replace the stale projection) before
                // recording the item failure.
                self.persist_artifact(run_id, candidate, &policy, &extraction)?;
                self.mark_content_item(
                    run_id,
                    ordinal as i64,
                    "failed",
                    extraction.reason.as_deref(),
                    extraction.reason.as_deref(),
                )?;
                failed += 1;
            }
        }
        let final_status = if failed > 0 || blocked > 0 {
            "partially_completed"
        } else {
            "completed"
        };
        self.finish_content_run(run_id, final_status, completed, blocked, failed, None)?;
        let _ = request;
        self.get_content_run(run_id)
    }

    fn mark_content_item(
        &self,
        run_id: &str,
        ordinal: i64,
        status: &str,
        code: Option<&str>,
        detail: Option<&str>,
    ) -> Result<(), DbError> {
        let conn = self.conn()?;
        let changed = conn.execute(
            "UPDATE content_run_items SET status=?3, error_code=?4, error_detail=?5,
                    revision=revision+1, updated_at=?6
             WHERE run_id=?1 AND ordinal=?2 AND status IN ('pending','running')",
            params![
                run_id,
                ordinal,
                status,
                code,
                detail.map(|value| value.chars().take(500).collect::<String>()),
                crate::db::current_unix_seconds()
            ],
        )?;
        if changed != 1 {
            return Err(DbError::Validation(
                "content_run_item_owner_conflict".into(),
            ));
        }
        Ok(())
    }

    fn finish_content_run(
        &self,
        run_id: &str,
        status: &str,
        completed: i64,
        blocked: i64,
        failed: i64,
        error: Option<&str>,
    ) -> Result<(), DbError> {
        let conn = self.conn()?;
        conn.execute(
            "UPDATE content_runs SET status=CASE
                        WHEN status='cancelling' AND ?2 IN ('completed','partially_completed')
                        THEN 'cancelled' ELSE ?2 END,
                    completed_count=?3, blocked_count=?4,
                    failed_count=?5, last_error_detail=?6, revision=revision+1,
                    updated_at=?7, completed_at=CASE WHEN ?2 IN ('completed','partially_completed','cancelled','failed') OR status='cancelling' THEN ?7 ELSE completed_at END
             WHERE id=?1",
            params![run_id, status, completed, blocked, failed, error, crate::db::current_unix_seconds()],
        )?;
        Ok(())
    }

    fn persist_artifact(
        &self,
        run_id: &str,
        candidate: &Candidate,
        policy: &ContentScopePolicyDto,
        extraction: &Extraction,
    ) -> Result<(), DbError> {
        let now = crate::db::current_unix_seconds();
        let source_hash = if extraction.source_hash.is_empty() {
            hash_bytes(
                format!(
                    "unreadable-source:{}:{}:{}:{}",
                    candidate.id, candidate.size, candidate.mtime, candidate.is_dir
                )
                .as_bytes(),
            )
        } else {
            extraction.source_hash.clone()
        };
        let content_fingerprint = hash_bytes(
            format!(
                "{}:{}:{}:{}:{}",
                candidate.id, candidate.size, candidate.mtime, extraction.family, source_hash
            )
            .as_bytes(),
        );
        let keywords = deterministic_keywords(&extraction.text);
        let summary = deterministic_summary(&extraction.text);
        let raw_retained = extraction.status == "completed"
            && policy.raw_retention_mode == "bounded"
            && policy.raw_retention_chars > 0;
        let raw_text = raw_retained.then(|| {
            extraction
                .text
                .chars()
                .take(policy.raw_retention_chars as usize)
                .collect::<String>()
        });
        let provenance = serde_json::json!({
            "source": "backend-local",
            "extractor": extraction.family,
            "extractorVersion": EXTRACTOR_VERSION,
            "policyRevision": policy.policy_revision,
            "runId": run_id,
            "bounded": true,
            "rawRetention": if raw_retained { "bounded" } else { "none" },
        });
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        let artifact_status = if extraction.status == "completed" {
            "current"
        } else {
            extraction.status
        };
        let artifact_id = format!("content-artifact-{}", candidate.id);
        if extraction.status == "failed" {
            // A failed rebuild keeps the previous projection as an explicit
            // stale artifact. It must never be replaced by a failed row that
            // could accidentally retain the old summary as current.
            let changed = tx.execute(
                "UPDATE content_artifacts
                 SET status='stale', revision=revision+1, updated_at=?2, last_run_id=?3
                 WHERE file_id=?1",
                params![candidate.id, now, run_id],
            )?;
            if changed == 1 {
                tx.execute(
                    "UPDATE content_run_items
                     SET artifact_id=?1, extractor_family=?2, extractor_version=?3,
                         source_hash=?4, revision=revision+1, updated_at=?5
                     WHERE run_id=?6 AND file_id=?7",
                    params![
                        artifact_id,
                        extraction.family,
                        EXTRACTOR_VERSION,
                        source_hash.clone(),
                        now,
                        run_id,
                        candidate.id,
                    ],
                )?;
                tx.commit()?;
                return Ok(());
            }
        }
        tx.execute(
            "INSERT INTO content_artifacts(
                id, file_id, scan_root_id, source_size, source_mtime, source_is_dir,
                source_hash, extractor_family, extractor_version, policy_revision,
                content_fingerprint, status, summary, keywords_json, language,
                truncated, text_retained, raw_text, provenance_json, revision,
                created_at, updated_at, last_run_id
             ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,1,?20,?20,?21)
             ON CONFLICT(file_id) DO UPDATE SET
                scan_root_id=excluded.scan_root_id, source_size=excluded.source_size,
                source_mtime=excluded.source_mtime, source_is_dir=excluded.source_is_dir,
                source_hash=excluded.source_hash, extractor_family=excluded.extractor_family,
                extractor_version=excluded.extractor_version, policy_revision=excluded.policy_revision,
                content_fingerprint=excluded.content_fingerprint, status=excluded.status,
                summary=excluded.summary, keywords_json=excluded.keywords_json,
                language=excluded.language, truncated=excluded.truncated,
                text_retained=excluded.text_retained, raw_text=excluded.raw_text,
                provenance_json=excluded.provenance_json, revision=content_artifacts.revision+1,
                updated_at=excluded.updated_at, last_run_id=excluded.last_run_id",
            params![
                artifact_id,
                candidate.id,
                candidate.root_id,
                candidate.size,
                candidate.mtime,
                bool_i64(candidate.is_dir),
                source_hash.clone(),
                extraction.family,
                EXTRACTOR_VERSION,
                policy.policy_revision,
                content_fingerprint,
                artifact_status,
                summary,
                serde_json::to_string(&keywords)?,
                detect_language(&extraction.text),
                bool_i64(extraction.truncated),
                bool_i64(raw_retained),
                raw_text,
                serde_json::to_string(&provenance)?,
                now,
                run_id,
            ],
        )?;
        tx.execute(
            "DELETE FROM content_artifact_fts WHERE artifact_id=?1",
            params![format!("content-artifact-{}", candidate.id)],
        )?;
        tx.execute(
            "INSERT INTO content_artifact_fts(artifact_id, summary, keywords, language, raw_text) VALUES (?1,?2,?3,?4,?5)",
            params![format!("content-artifact-{}", candidate.id), summary, keywords.join(" "), detect_language(&extraction.text), raw_text],
        )?;
        tx.execute(
            "UPDATE content_run_items
             SET artifact_id=?1, extractor_family=?2, extractor_version=?3,
                 source_hash=?4, revision=revision+1, updated_at=?5
             WHERE run_id=?6 AND file_id=?7",
            params![
                format!("content-artifact-{}", candidate.id),
                extraction.family,
                EXTRACTOR_VERSION,
                source_hash,
                now,
                run_id,
                candidate.id,
            ],
        )?;
        tx.commit()?;
        Ok(())
    }
}

fn bool_i64(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

fn content_provider_is_configured(settings: &crate::ai::settings::AISettings) -> bool {
    if !settings.enabled {
        return false;
    }
    match settings.provider {
        AIProviderKind::Ollama => true,
        AIProviderKind::OpenAICompatible => {
            settings.api_key_configured || !settings.api_key.trim().is_empty()
        }
    }
}

fn redact_content_provider_error(message: impl Into<String>, secret: &str) -> String {
    let message = message.into();
    let redacted = if secret.trim().is_empty() {
        message
    } else {
        message.replace(secret, "[redacted]")
    };
    let normalized = redacted.to_ascii_lowercase();
    let stable = if normalized.contains("timeout") {
        "content_provider_timeout"
    } else if normalized.contains("config") || normalized.contains("credential") {
        "content_provider_configuration_invalid"
    } else {
        "content_provider_request_failed"
    };
    stable.to_string()
}

fn normalized_model_keywords(values: &[String]) -> Vec<String> {
    let mut keywords = values
        .iter()
        .map(|value| value.trim().chars().take(64).collect::<String>())
        .filter(|value| !value.is_empty() && !value.chars().any(|ch| ch.is_control()))
        .collect::<Vec<_>>();
    keywords.sort();
    keywords.dedup();
    keywords.truncate(10);
    keywords
}

fn validate_content_model_envelope(envelope: &ContentModelEnvelopeV1) -> bool {
    let summary = envelope.summary.trim();
    !summary.is_empty()
        && summary.chars().count() <= 500
        && !summary.chars().any(|ch| ch.is_control())
        && !contains_forbidden_model_content(summary)
        && envelope.keywords.len() <= 10
        && envelope.keywords.iter().all(|value| {
            !value.trim().is_empty()
                && value.chars().count() <= 64
                && !contains_forbidden_model_content(value)
        })
        && envelope.warnings.len() <= 8
        && envelope.warnings.iter().all(|value| {
            value.chars().count() <= 160
                && !value.chars().any(|ch| ch.is_control())
                && !contains_forbidden_model_content(value)
        })
        && envelope.language.as_deref().is_none_or(|value| {
            value.chars().count() <= 16 && !value.chars().any(|ch| ch.is_control())
        })
}

fn contains_forbidden_model_content(value: &str) -> bool {
    let normalized = value
        .chars()
        .filter(|ch| !ch.is_whitespace() && !matches!(ch, '-' | '_' | '/' | '\\'))
        .flat_map(char::to_lowercase)
        .collect::<String>();
    [
        "path",
        "filepath",
        "filename",
        "rule",
        "plan",
        "operation",
        "script",
        "command",
        "tool",
        "mcp",
        "路径",
        "文件名",
        "规则",
        "计划",
        "操作",
        "脚本",
        "命令",
        "工具",
    ]
    .iter()
    .any(|term| normalized.contains(term))
}

fn validate_policy(policy: &ContentScopePolicyDto, root_id: &str) -> Result<(), DbError> {
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
        || (!policy.local_allowed && !policy.cloud_allowed)
    {
        return Err(DbError::Validation("content_policy_invalid".into()));
    }
    Ok(())
}

fn load_policy(conn: &Connection, root_id: &str) -> Result<ContentScopePolicyDto, DbError> {
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

fn validate_preview_request(request: &ContentPreviewRequest) -> Result<(), DbError> {
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

fn validate_start_request(request: &StartContentRunRequest) -> Result<(), DbError> {
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

fn build_content_preview(
    conn: &Connection,
    request: ContentPreviewRequest,
) -> Result<ContentPreviewDto, DbError> {
    validate_preview_request(&request)?;
    let library_revision = current_library_revision(conn)?;
    if library_revision != request.expected_library_revision {
        return Err(DbError::Validation(
            "content_library_revision_conflict".into(),
        ));
    }
    let resolved = resolve_scope(conn, &request.scope)?;
    let root_ids = resolved
        .health
        .roots
        .iter()
        .map(|root| root.id.clone())
        .collect::<Vec<_>>();
    let mut policies = Vec::new();
    let mut policy_revisions = Vec::new();
    let mut local_allowed = true;
    let mut cloud_allowed = false;
    let mut byte_budget = 0_i64;
    let mut char_budget = 0_i64;
    let expected_roots = request
        .expected_policy_revisions
        .iter()
        .map(|item| item.root_id.as_str())
        .collect::<HashSet<_>>();
    if expected_roots.len() != request.expected_policy_revisions.len()
        || expected_roots.len() != root_ids.len()
        || expected_roots
            .iter()
            .any(|root_id| !root_ids.iter().any(|id| id == root_id))
    {
        return Err(DbError::Validation(
            "content_root_or_policy_revision_required".into(),
        ));
    }
    for root_id in &root_ids {
        let policy = load_policy(conn, root_id)?;
        if let Some(expected) = request
            .expected_policy_revisions
            .iter()
            .find(|item| item.root_id == *root_id)
        {
            if policy.root_revision != expected.root_revision
                || policy.policy_revision != expected.policy_revision
            {
                return Err(DbError::Validation(
                    "content_root_or_policy_revision_conflict".into(),
                ));
            }
        } else {
            return Err(DbError::Validation(
                "content_root_or_policy_revision_required".into(),
            ));
        }
        local_allowed &= policy.local_allowed && policy.enabled;
        cloud_allowed |= policy.cloud_allowed;
        byte_budget = byte_budget.saturating_add(policy.max_bytes);
        char_budget = char_budget.saturating_add(policy.max_chars);
        policy_revisions.push(ContentPolicyRevisionRequest {
            root_id: root_id.clone(),
            root_revision: policy.root_revision,
            policy_revision: policy.policy_revision,
        });
        policies.push(Policy { dto: policy });
    }
    let candidates = select_candidates(conn, &request.scope, &request.selection_file_ids)?;
    let mut supported = 0_i64;
    let mut unsupported = 0_i64;
    let mut blocked = 0_i64;
    let mut failed = 0_i64;
    let mut supported_formats = HashSet::new();
    let mut unsupported_formats = HashSet::new();
    let mut blocked_reasons = HashSet::new();
    let mut sample = Vec::new();
    for candidate in &candidates {
        let policy = policies
            .iter()
            .find(|policy| policy.dto.root_id == candidate.root_id)
            .map(|policy| &policy.dto);
        let item = classify_candidate(candidate, policy);
        match item.status.as_str() {
            "supported" => {
                supported += 1;
                if let Some(family) = item.extractor_family.clone() {
                    supported_formats.insert(family);
                }
            }
            "unsupported" => {
                unsupported += 1;
                unsupported_formats.insert(candidate.extension.clone());
            }
            "blocked" => {
                blocked += 1;
                if let Some(reason) = item.reason.clone() {
                    blocked_reasons.insert(reason);
                }
            }
            _ => failed += 1,
        }
        if sample.len() < MAX_SAMPLE as usize {
            sample.push(ContentSampleDto {
                file_id: candidate.id.clone(),
                name: candidate.name.clone(),
                extension: candidate.extension.clone(),
                size: candidate.size,
                modified_at: candidate.mtime,
                status: item.status,
                extractor_family: item.extractor_family,
                reason: item.reason,
            });
        }
    }
    let exact_count = candidates.len() as i64;
    let exact_state = if exact_count > 10_000 {
        "deferred"
    } else {
        "exact"
    };
    let policy_payload = serde_json::to_vec(&policy_revisions)?;
    let policy_fingerprint = hash_bytes(&policy_payload);
    let scope_health = ContentScopeHealthDto {
        scope: request.scope.clone(),
        health: resolved.health,
        root_ids,
        policy_revisions,
    };
    let preview_payload = serde_json::json!({
        "version": CONTENT_VERSION,
        "scope": &scope_health,
        "libraryRevision": library_revision,
        "policyFingerprint": policy_fingerprint,
        "mode": request.mode,
        "providerMode": request.provider_mode,
        "count": exact_count,
    });
    let preview_fingerprint = hash_bytes(serde_json::to_string(&preview_payload)?.as_bytes());
    Ok(ContentPreviewDto {
        version: CONTENT_VERSION,
        request_id: request.request_id,
        scope_health,
        exact_count,
        deferred_count: (exact_state == "deferred").then_some(exact_count),
        exact_state: exact_state.into(),
        byte_budget,
        char_budget,
        supported_count: supported,
        unsupported_count: unsupported,
        blocked_count: blocked,
        failed_count: failed,
        supported_formats: sorted_strings(supported_formats),
        unsupported_formats: sorted_strings(unsupported_formats),
        blocked_reasons: sorted_strings(blocked_reasons),
        local_allowed,
        cloud_allowed,
        raw_retention_disclosure: "Raw text is not retained by default; bounded retention requires an explicit per-root policy.".into(),
        sample,
        library_revision,
        policy_fingerprint,
        preview_fingerprint,
        requires_confirmation: true,
    })
}

fn select_candidates(
    conn: &Connection,
    scope: &FileLibraryScopeV2,
    selection: &[String],
) -> Result<Vec<Candidate>, DbError> {
    let resolved = resolve_scope(conn, scope)?;
    if resolved.health.state != "healthy" && resolved.health.state != "empty" {
        return Err(DbError::Validation("content_scope_unavailable".into()));
    }
    let mut params = resolved.params.clone();
    let mut clause = format!("f.is_stale=0 AND ({})", resolved.clause);
    if !selection.is_empty() {
        let ids = selection
            .iter()
            .map(|id| id.trim())
            .filter(|id| !id.is_empty())
            .take(MAX_ITEMS)
            .collect::<Vec<_>>();
        if ids.len() != selection.len() {
            return Err(DbError::Validation("content_selection_invalid".into()));
        }
        clause.push_str(&format!(
            " AND f.id IN ({})",
            std::iter::repeat_n("?", ids.len())
                .collect::<Vec<_>>()
                .join(",")
        ));
        params.extend(ids.into_iter().map(|id| SqlValue::Text(id.to_string())));
    }
    let sql = format!(
        "SELECT f.id, f.path, f.name, f.extension, f.size, f.mtime, f.is_dir,
                f.content_hash,
                (SELECT sr.id FROM scan_roots sr WHERE sr.source_kind='file_library'
                 AND (f.path=sr.normalized_path
                      OR f.path LIKE sr.normalized_path || '/%'
                      OR f.path LIKE sr.normalized_path || '\\%')
                 ORDER BY length(sr.normalized_path) DESC LIMIT 1)
         FROM files f WHERE {clause} ORDER BY f.id LIMIT {}",
        MAX_ITEMS + 1
    );
    let mut candidates = Vec::new();
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params_from_iter(params.iter()), |row| {
        Ok(Candidate {
            id: row.get(0)?,
            path: row.get(1)?,
            name: row.get(2)?,
            extension: row.get(3)?,
            size: row.get(4)?,
            mtime: row.get(5)?,
            is_dir: row.get::<_, i64>(6)? != 0,
            content_hash: row.get(7)?,
            root_id: row.get::<_, Option<String>>(8)?.unwrap_or_default(),
        })
    })?;
    for row in rows {
        let candidate = row?;
        if candidate.root_id.is_empty() {
            continue;
        }
        candidates.push(candidate);
    }
    Ok(candidates)
}

fn load_candidate_by_id(
    conn: &Connection,
    file_id: &str,
    root_id: &str,
) -> Result<Option<Candidate>, DbError> {
    conn.query_row(
        "SELECT f.id, f.path, f.name, f.extension, f.size, f.mtime, f.is_dir,
                f.content_hash, ?2
         FROM files f WHERE f.id=?1 AND f.is_stale=0",
        params![file_id.trim(), root_id],
        |row| {
            Ok(Candidate {
                id: row.get(0)?,
                path: row.get(1)?,
                name: row.get(2)?,
                extension: row.get(3)?,
                size: row.get(4)?,
                mtime: row.get(5)?,
                is_dir: row.get::<_, i64>(6)? != 0,
                content_hash: row.get(7)?,
                root_id: row.get(8)?,
            })
        },
    )
    .optional()
    .map_err(DbError::from)
}

fn classify_candidate(
    candidate: &Candidate,
    policy: Option<&ContentScopePolicyDto>,
) -> ClassifiedCandidate {
    let Some(policy) = policy else {
        return ClassifiedCandidate {
            status: "blocked".into(),
            extractor_family: None,
            reason: Some("content_policy_missing".into()),
        };
    };
    if !policy.enabled || !policy.local_allowed {
        return ClassifiedCandidate {
            status: "blocked".into(),
            extractor_family: None,
            reason: Some("content_policy_disabled_or_local_denied".into()),
        };
    }
    if candidate.is_dir {
        return ClassifiedCandidate {
            status: "blocked".into(),
            extractor_family: None,
            reason: Some("directory_not_supported".into()),
        };
    }
    let extension = candidate
        .extension
        .trim()
        .trim_start_matches('.')
        .to_ascii_lowercase();
    let family = match extension.as_str() {
        "txt" => "txt",
        "md" | "markdown" => "md",
        "csv" => "csv",
        "pdf" => "pdf_text",
        "docx" => "docx",
        "xlsx" => "xlsx",
        "pptx" => "pptx",
        "doc" | "xls" | "ppt" => {
            return ClassifiedCandidate {
                status: "unsupported".into(),
                extractor_family: None,
                reason: Some("legacy_office_format".into()),
            }
        }
        "zip" | "7z" | "rar" | "tar" | "gz" => {
            return ClassifiedCandidate {
                status: "blocked".into(),
                extractor_family: None,
                reason: Some("archive_not_supported".into()),
            }
        }
        "png" | "jpg" | "jpeg" | "gif" | "bmp" | "webp" => {
            return ClassifiedCandidate {
                status: "blocked".into(),
                extractor_family: None,
                reason: Some("image_ocr_not_enabled".into()),
            }
        }
        "mp3" | "wav" | "mp4" | "mov" | "mkv" | "epub" | "mobi" => {
            return ClassifiedCandidate {
                status: "blocked".into(),
                extractor_family: None,
                reason: Some("media_or_ebook_not_supported".into()),
            }
        }
        _ => {
            return ClassifiedCandidate {
                status: "unsupported".into(),
                extractor_family: None,
                reason: Some("unsupported_extension".into()),
            }
        }
    };
    if !policy.extractor_families.iter().any(|item| item == family) {
        return ClassifiedCandidate {
            status: "blocked".into(),
            extractor_family: Some(family.into()),
            reason: Some("extractor_family_disabled".into()),
        };
    }
    ClassifiedCandidate {
        status: "supported".into(),
        extractor_family: Some(family.into()),
        reason: None,
    }
}

#[derive(Debug)]
struct ClassifiedCandidate {
    status: String,
    extractor_family: Option<String>,
    reason: Option<String>,
}

fn extract_candidate(
    candidate: &Candidate,
    policy: &ContentScopePolicyDto,
    root_path: &str,
) -> Result<Extraction, DbError> {
    let path = Path::new(&candidate.path);
    let canonical = std::fs::canonicalize(path)
        .map_err(|_| DbError::Validation("content_source_unavailable".into()))?;
    let canonical_root = std::fs::canonicalize(root_path)
        .map_err(|_| DbError::Validation("content_root_unavailable".into()))?;
    if !canonical.starts_with(&canonical_root) {
        return Err(DbError::Validation(
            "content_symlink_traversal_blocked".into(),
        ));
    }
    let source_metadata = std::fs::metadata(&canonical)
        .map_err(|_| DbError::Validation("content_source_metadata_unavailable".into()))?;
    if !source_metadata.is_file()
        || candidate.size < 0
        || source_metadata.len() != candidate.size as u64
        || modified_unix_seconds(&source_metadata) != candidate.mtime
    {
        return Err(DbError::Validation(
            "content_source_identity_changed".into(),
        ));
    }
    // The selected root is resolved again from the backend ledger. A file is
    // never read merely because a renderer supplied a path.
    let source_bytes = read_bounded_file(&canonical, policy.max_bytes as usize)?;
    let after_metadata = std::fs::metadata(&canonical)
        .map_err(|_| DbError::Validation("content_source_metadata_unavailable".into()))?;
    if after_metadata.len() != source_metadata.len()
        || modified_unix_seconds(&after_metadata) != modified_unix_seconds(&source_metadata)
    {
        return Err(DbError::Validation(
            "content_source_changed_during_read".into(),
        ));
    }
    let source_hash = hash_bytes(&source_bytes);
    if is_valid_content_hash(&candidate.content_hash)
        && !candidate.content_hash.eq_ignore_ascii_case(&source_hash)
    {
        return Err(DbError::Validation(
            "content_source_identity_changed".into(),
        ));
    }
    let extension = candidate
        .extension
        .trim()
        .trim_start_matches('.')
        .to_ascii_lowercase();
    let mut extraction = match extension.as_str() {
        "txt" => text_extraction("txt", source_bytes, policy),
        "md" | "markdown" => text_extraction("md", source_bytes, policy),
        "csv" => csv_extraction(source_bytes, policy),
        "pdf" => pdf_text_extraction(source_bytes, policy),
        "docx" => office_xml_extraction("docx", source_bytes, policy, &["word/document.xml"]),
        "xlsx" => office_xml_extraction(
            "xlsx",
            source_bytes,
            policy,
            &["xl/sharedStrings.xml", "xl/worksheets/sheet1.xml"],
        ),
        "pptx" => office_xml_extraction("pptx", source_bytes, policy, &["ppt/slides/slide1.xml"]),
        _ => Ok(Extraction {
            family: "unsupported".into(),
            text: String::new(),
            source_hash: String::new(),
            truncated: false,
            status: "unsupported",
            reason: Some("unsupported_extension".into()),
        }),
    }?;
    extraction.source_hash = source_hash;
    Ok(extraction)
}

fn read_bounded_file(path: &Path, max_bytes: usize) -> Result<Vec<u8>, DbError> {
    let metadata = std::fs::metadata(path)
        .map_err(|_| DbError::Validation("content_source_metadata_unavailable".into()))?;
    if !metadata.is_file() {
        return Err(DbError::Validation(
            "content_source_not_regular_file".into(),
        ));
    }
    if metadata.len() > max_bytes as u64 {
        return Err(DbError::Validation(
            "content_source_byte_limit_exceeded".into(),
        ));
    }
    let file =
        File::open(path).map_err(|_| DbError::Validation("content_source_open_failed".into()))?;
    let mut bytes = Vec::with_capacity(metadata.len() as usize);
    file.take(max_bytes as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| DbError::Validation("content_source_read_failed".into()))?;
    if bytes.len() > max_bytes {
        return Err(DbError::Validation(
            "content_source_byte_limit_exceeded".into(),
        ));
    }
    Ok(bytes)
}

fn modified_unix_seconds(metadata: &std::fs::Metadata) -> i64 {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

fn is_valid_content_hash(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn text_extraction(
    family: &str,
    bytes: Vec<u8>,
    policy: &ContentScopePolicyDto,
) -> Result<Extraction, DbError> {
    let text = decode_bounded_text(&bytes, "content_text_not_utf8")?;
    let (text, truncated) = bound_text(text, policy.max_chars as usize);
    Ok(Extraction {
        family: family.into(),
        text,
        source_hash: String::new(),
        truncated,
        status: "completed",
        reason: None,
    })
}

fn csv_extraction(bytes: Vec<u8>, policy: &ContentScopePolicyDto) -> Result<Extraction, DbError> {
    let text = decode_bounded_text(&bytes, "content_csv_not_utf8")?;
    let all_rows = text.lines().collect::<Vec<_>>();
    let rows_truncated = all_rows.len() > policy.max_rows as usize;
    let rows = all_rows
        .into_iter()
        .take(policy.max_rows as usize)
        .collect::<Vec<_>>()
        .join("\n");
    let (text, truncated) = bound_text(rows, policy.max_chars as usize);
    Ok(Extraction {
        family: "csv".into(),
        text,
        source_hash: String::new(),
        truncated: truncated || rows_truncated,
        status: "completed",
        reason: None,
    })
}

fn decode_bounded_text(bytes: &[u8], error_code: &str) -> Result<String, DbError> {
    if bytes.starts_with(&[0xff, 0xfe]) || bytes.starts_with(&[0xfe, 0xff]) {
        if !(bytes.len() - 2).is_multiple_of(2) {
            return Err(DbError::Validation(error_code.to_string()));
        }
        let little_endian = bytes[0] == 0xff;
        let units = bytes[2..]
            .chunks_exact(2)
            .map(|chunk| {
                if little_endian {
                    u16::from_le_bytes([chunk[0], chunk[1]])
                } else {
                    u16::from_be_bytes([chunk[0], chunk[1]])
                }
            })
            .collect::<Vec<_>>();
        return String::from_utf16(&units).map_err(|_| DbError::Validation(error_code.to_string()));
    }
    String::from_utf8(bytes.to_vec()).map_err(|_| DbError::Validation(error_code.to_string()))
}

fn pdf_text_extraction(
    bytes: Vec<u8>,
    policy: &ContentScopePolicyDto,
) -> Result<Extraction, DbError> {
    let raw = String::from_utf8_lossy(&bytes);
    let deadline = Instant::now() + Duration::from_secs(2);
    let page_count = raw
        .match_indices("/Type /Page")
        .filter(|(index, _)| {
            raw.get(index + "/Type /Page".len()..index + "/Type /Page".len() + 1) != Some("s")
        })
        .count() as i64;
    if page_count > policy.max_pages {
        return Ok(Extraction {
            family: "pdf_text".into(),
            text: String::new(),
            source_hash: String::new(),
            truncated: false,
            status: "blocked",
            reason: Some("content_pdf_page_limit_exceeded".into()),
        });
    }
    let mut text = String::new();
    let mut in_text = false;
    let mut current = String::new();
    for character in raw.chars() {
        if Instant::now() > deadline {
            return Ok(Extraction {
                family: "pdf_text".into(),
                text: String::new(),
                source_hash: String::new(),
                truncated: false,
                status: "failed",
                reason: Some("content_extractor_timeout".into()),
            });
        }
        if character == '(' && !in_text {
            in_text = true;
            current.clear();
        } else if character == ')' && in_text {
            in_text = false;
            text.push_str(&current);
            text.push('\n');
        } else if in_text && !character.is_control() {
            current.push(character);
        }
        if text.chars().count() > policy.max_chars as usize {
            break;
        }
    }
    if text.trim().is_empty() {
        return Ok(Extraction {
            family: "pdf_text".into(),
            text: String::new(),
            source_hash: String::new(),
            truncated: false,
            status: "blocked",
            reason: Some("ocr_only_or_no_text_layer".into()),
        });
    }
    let (text, truncated) = bound_text(text, policy.max_chars as usize);
    Ok(Extraction {
        family: "pdf_text".into(),
        text,
        source_hash: String::new(),
        truncated,
        status: "completed",
        reason: None,
    })
}

fn office_xml_extraction(
    family: &str,
    bytes: Vec<u8>,
    policy: &ContentScopePolicyDto,
    names: &[&str],
) -> Result<Extraction, DbError> {
    let mut archive = ZipArchive::new(Cursor::new(bytes))
        .map_err(|_| DbError::Validation("content_office_container_invalid".into()))?;
    if archive.len() > 1_000 {
        return Ok(Extraction {
            family: family.into(),
            text: String::new(),
            source_hash: String::new(),
            truncated: false,
            status: "blocked",
            reason: Some("content_archive_entry_count_limit_exceeded".into()),
        });
    }
    let mut target_names = names
        .iter()
        .map(|name| (*name).to_string())
        .collect::<Vec<_>>();
    let mut document_unit_count = 0_usize;
    if family == "xlsx" || family == "pptx" {
        let mut discovered = Vec::new();
        for index in 0..archive.len() {
            let entry = archive
                .by_index(index)
                .map_err(|_| DbError::Validation("content_office_container_invalid".into()))?;
            let name = entry.name().to_string();
            let prefix = if family == "xlsx" {
                "xl/worksheets/sheet"
            } else {
                "ppt/slides/slide"
            };
            if name.starts_with(prefix) && name.ends_with(".xml") {
                discovered.push(name);
            }
        }
        discovered.sort();
        document_unit_count = discovered.len();
        target_names.extend(discovered);
    }
    target_names.sort();
    target_names.dedup();
    if (family == "xlsx" || family == "pptx") && document_unit_count as i64 > policy.max_pages {
        return Ok(Extraction {
            family: family.into(),
            text: String::new(),
            source_hash: String::new(),
            truncated: false,
            status: "blocked",
            reason: Some("content_page_limit_exceeded".into()),
        });
    }
    let mut text = String::new();
    let mut decompressed_bytes = 0_u64;
    let deadline = Instant::now() + Duration::from_secs(2);
    for name in &target_names {
        if Instant::now() > deadline {
            return Ok(Extraction {
                family: family.into(),
                text: String::new(),
                source_hash: String::new(),
                truncated: false,
                status: "failed",
                reason: Some("content_extractor_timeout".into()),
            });
        }
        let Ok(entry) = archive.by_name(name) else {
            continue;
        };
        if entry.encrypted() {
            return Ok(Extraction {
                family: family.into(),
                text: String::new(),
                source_hash: String::new(),
                truncated: false,
                status: "blocked",
                reason: Some("content_encrypted_document".into()),
            });
        }
        if entry.size() > policy.max_bytes as u64
            || (entry.compressed_size() > 0
                && entry.size() > entry.compressed_size().saturating_mul(100))
        {
            return Ok(Extraction {
                family: family.into(),
                text: String::new(),
                source_hash: String::new(),
                truncated: false,
                status: "blocked",
                reason: Some("content_archive_entry_limit_exceeded".into()),
            });
        }
        let mut xml = Vec::new();
        entry
            .take(policy.max_bytes as u64 + 1)
            .read_to_end(&mut xml)?;
        decompressed_bytes = decompressed_bytes.saturating_add(xml.len() as u64);
        if decompressed_bytes > policy.max_bytes as u64 {
            return Ok(Extraction {
                family: family.into(),
                text: String::new(),
                source_hash: String::new(),
                truncated: false,
                status: "blocked",
                reason: Some("content_decompressed_byte_limit_exceeded".into()),
            });
        }
        if family == "xlsx"
            && xml.windows(4).filter(|window| *window == b"<row").count() as i64 > policy.max_rows
        {
            return Ok(Extraction {
                family: family.into(),
                text: String::new(),
                source_hash: String::new(),
                truncated: false,
                status: "blocked",
                reason: Some("content_row_limit_exceeded".into()),
            });
        }
        let xml_text = String::from_utf8(xml)
            .map_err(|_| DbError::Validation("content_office_xml_invalid".into()))?;
        if !xml_is_well_formed(&xml_text) {
            return Ok(Extraction {
                family: family.into(),
                text: String::new(),
                source_hash: String::new(),
                truncated: false,
                status: "blocked",
                reason: Some("content_office_xml_invalid".into()),
            });
        }
        text.push_str(&strip_xml(&xml_text));
        text.push('\n');
        if text.chars().count() >= policy.max_chars as usize {
            break;
        }
    }
    if text.trim().is_empty() {
        return Ok(Extraction {
            family: family.into(),
            text: String::new(),
            source_hash: String::new(),
            truncated: false,
            status: "blocked",
            reason: Some("content_office_text_empty".into()),
        });
    }
    let (text, truncated) = bound_text(text, policy.max_chars as usize);
    Ok(Extraction {
        family: family.into(),
        text,
        source_hash: String::new(),
        truncated,
        status: "completed",
        reason: None,
    })
}

fn strip_xml(value: &str) -> String {
    let mut text = String::new();
    let mut in_tag = false;
    for character in value.chars() {
        match character {
            '<' => in_tag = true,
            '>' => {
                in_tag = false;
                text.push(' ');
            }
            _ if !in_tag => text.push(character),
            _ => {}
        }
    }
    text.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}

fn xml_is_well_formed(value: &str) -> bool {
    let mut stack = Vec::<String>::new();
    let mut offset = 0_usize;
    while let Some(relative_start) = value[offset..].find('<') {
        let start = offset + relative_start;
        let Some(relative_end) = value[start..].find('>') else {
            return false;
        };
        let end = start + relative_end;
        let token = value[start + 1..end].trim();
        if token.is_empty() {
            return false;
        }
        if token.starts_with("!--") {
            if !token.ends_with("--") {
                return false;
            }
        } else if token.starts_with('?') || token.starts_with('!') {
            // XML declaration, doctype and processing instructions are
            // bounded metadata; they do not contribute to element nesting.
        } else if let Some(name) = token.strip_prefix('/') {
            let name = name.split_whitespace().next().unwrap_or_default();
            if name.is_empty() || stack.pop().as_deref() != Some(name) {
                return false;
            }
        } else {
            let self_closing = token.ends_with('/');
            let name = token
                .trim_end_matches('/')
                .split_whitespace()
                .next()
                .unwrap_or_default();
            if name.is_empty() || name.contains('=') {
                return false;
            }
            if !self_closing {
                stack.push(name.to_string());
            }
        }
        offset = end + 1;
    }
    stack.is_empty()
}

fn bound_text(value: String, max_chars: usize) -> (String, bool) {
    let truncated = value.chars().count() > max_chars;
    (value.chars().take(max_chars).collect(), truncated)
}

fn deterministic_summary(text: &str) -> Option<String> {
    let summary = text.lines().map(str::trim).find(|line| !line.is_empty())?;
    Some(summary.chars().take(500).collect())
}

fn deterministic_keywords(text: &str) -> Vec<String> {
    let mut counts = HashMap::<String, usize>::new();
    let mut current = String::new();
    for character in text.chars() {
        if character.is_alphanumeric() || ('\u{4e00}'..='\u{9fff}').contains(&character) {
            current.push(character.to_ascii_lowercase());
        } else if current.chars().count() >= 3 {
            *counts.entry(current.clone()).or_default() += 1;
            current.clear();
        } else {
            current.clear();
        }
    }
    if current.chars().count() >= 3 {
        *counts.entry(current).or_default() += 1;
    }
    let mut values = counts.into_iter().collect::<Vec<_>>();
    values.sort_by(|left, right| right.1.cmp(&left.1).then_with(|| left.0.cmp(&right.0)));
    values
        .into_iter()
        .take(10)
        .map(|(value, _)| value)
        .collect()
}

fn detect_language(text: &str) -> Option<String> {
    if text.trim().is_empty() {
        None
    } else if text
        .chars()
        .any(|character| ('\u{4e00}'..='\u{9fff}').contains(&character))
    {
        Some("zh".into())
    } else {
        Some("en".into())
    }
}

fn hash_bytes(value: impl AsRef<[u8]>) -> String {
    let mut hasher = Hasher::new();
    hasher.update(value.as_ref());
    hasher.finalize().to_hex().to_string()
}

fn sorted_strings(values: HashSet<String>) -> Vec<String> {
    let mut values = values.into_iter().collect::<Vec<_>>();
    values.sort();
    values
}

fn content_error_code(error: &DbError) -> String {
    match error {
        DbError::Validation(code) => code
            .split(':')
            .next()
            .unwrap_or("content_extraction_failed")
            .chars()
            .take(96)
            .collect(),
        DbError::Io(_) => "content_source_io_failed".into(),
        DbError::Sqlite(_) => "content_extraction_database_failed".into(),
        DbError::Pool(_) => "content_extraction_pool_failed".into(),
        DbError::Json(_) => "content_extraction_json_failed".into(),
    }
}

fn fts_query(value: &str) -> String {
    value
        .split_whitespace()
        .map(|term| {
            let normalized = term
                .chars()
                .filter(|character| character.is_alphanumeric())
                .collect::<String>();
            format!("\"{}\"", normalized.replace('"', ""))
        })
        .filter(|term| term != "\"\"")
        .collect::<Vec<_>>()
        .join(" AND ")
}
fn encode_cursor(updated_at: i64, id: &str) -> String {
    format!("{updated_at}:{id}")
}
fn decode_cursor(value: &str) -> Result<(i64, String), DbError> {
    let (timestamp, id) = value
        .split_once(':')
        .ok_or_else(|| DbError::Validation("content_cursor_invalid".into()))?;
    Ok((
        timestamp
            .parse()
            .map_err(|_| DbError::Validation("content_cursor_invalid".into()))?,
        id.to_string(),
    ))
}

fn load_run(conn: &Connection, run_id: &str) -> Result<ContentRunDto, DbError> {
    conn.query_row(
        "SELECT id, scope_json, mode, provider_mode, status, expected_library_revision,
                byte_budget, char_budget, requested_count, materialized_count,
                completed_count, blocked_count, skipped_count, failed_count, revision,
                last_error_code, last_error_detail, created_at, updated_at, completed_at
         FROM content_runs WHERE id=?1",
        params![run_id.trim()],
        run_from_row,
    )
    .map_err(DbError::from)
}

fn run_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ContentRunDto> {
    Ok(ContentRunDto {
        id: row.get(0)?,
        scope: serde_json::from_str(&row.get::<_, String>(1)?)
            .unwrap_or(FileLibraryScopeV2::AllEnabledRoots),
        mode: row.get(2)?,
        provider_mode: row.get(3)?,
        status: row.get(4)?,
        expected_library_revision: row.get(5)?,
        byte_budget: row.get(6)?,
        char_budget: row.get(7)?,
        requested_count: row.get(8)?,
        materialized_count: row.get(9)?,
        completed_count: row.get(10)?,
        blocked_count: row.get(11)?,
        skipped_count: row.get(12)?,
        failed_count: row.get(13)?,
        revision: row.get(14)?,
        last_error_code: row.get(15)?,
        last_error_detail: row.get(16)?,
        created_at: row.get(17)?,
        updated_at: row.get(18)?,
        completed_at: row.get(19)?,
    })
}

fn item_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ContentRunItemDto> {
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
        error_code: row.get(13)?,
        error_detail: row.get(14)?,
        revision: row.get(15)?,
        updated_at: row.get(16)?,
    })
}

fn artifact_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ContentArtifactDto> {
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

#[tauri::command]
pub fn get_content_scope_policy<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    root_id: String,
) -> Result<ContentScopePolicyDto, String> {
    require_main_window(&window)?;
    db.get_content_scope_policy(&root_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_content_scope_policy<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: SetContentScopePolicyRequest,
) -> Result<ContentScopePolicyDto, String> {
    require_main_window(&window)?;
    db.set_content_scope_policy(request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn preview_content<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: ContentPreviewRequest,
) -> Result<ContentPreviewDto, String> {
    require_main_window(&window)?;
    db.preview_content(request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn start_content_run<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: StartContentRunRequest,
) -> Result<ContentRunDto, String> {
    require_main_window(&window)?;
    db.start_content_run(request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_content_run<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    run_id: String,
) -> Result<ContentRunDto, String> {
    require_main_window(&window)?;
    db.get_content_run(&run_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_content_runs<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: ContentRunPageRequest,
) -> Result<Vec<ContentRunDto>, String> {
    require_main_window(&window)?;
    db.list_content_runs(request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn cancel_content_run<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: ContentRunIdRequest,
) -> Result<ContentRunDto, String> {
    require_main_window(&window)?;
    db.cancel_content_run(request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn query_content_run_items<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: ContentRunItemPageRequest,
) -> Result<ContentRunItemPageDto, String> {
    require_main_window(&window)?;
    db.query_content_run_items(request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_content_artifact<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    file_id: String,
) -> Result<Option<ContentArtifactDto>, String> {
    require_main_window(&window)?;
    db.get_content_artifact(&file_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn query_content_artifacts<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: ContentArtifactPageRequest,
) -> Result<ContentArtifactPageDto, String> {
    require_main_window(&window)?;
    db.query_content_artifacts(request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn rebuild_content_artifact<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: ContentArtifactMutationRequest,
) -> Result<ContentArtifactDto, String> {
    require_main_window(&window)?;
    db.rebuild_content_artifact(request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_content_artifact<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: ContentArtifactMutationRequest,
) -> Result<bool, String> {
    require_main_window(&window)?;
    db.delete_content_artifact(request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn purge_content_scope<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: PurgeContentScopeRequest,
) -> Result<i64, String> {
    require_main_window(&window)?;
    db.purge_content_scope(request)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn understand_content_artifacts<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    request: UnderstandContentArtifactsRequest,
) -> Result<ContentUnderstandingResultDto, String> {
    require_main_window(&window)?;
    db.understand_content_artifacts(request)
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use zip::{write::SimpleFileOptions, ZipWriter};

    #[test]
    fn deterministic_keywords_and_summary_are_bounded() {
        let text = "Alpha alpha beta\nThis is a longer line";
        assert_eq!(deterministic_summary(text).unwrap(), "Alpha alpha beta");
        assert_eq!(deterministic_keywords(text).first().unwrap(), "alpha");
        assert!(bound_text("abcdef".into(), 3).1);
    }

    #[test]
    fn unsupported_and_ocr_only_formats_fail_closed() {
        let policy = default_policy("root", 0);
        let legacy = classify_candidate(
            &Candidate {
                id: "1".into(),
                path: "x.doc".into(),
                name: "x.doc".into(),
                extension: "doc".into(),
                size: 1,
                mtime: 1,
                is_dir: false,
                root_id: "root".into(),
                content_hash: String::new(),
            },
            Some(&policy),
        );
        assert_eq!(legacy.status, "blocked");
        let pdf = pdf_text_extraction(b"%PDF /Type /Page".to_vec(), &policy).unwrap();
        assert_eq!(pdf.status, "blocked");
    }

    #[test]
    fn mandatory_extractors_decode_bounded_fixtures_and_bombs_fail_closed() {
        let policy = default_policy("root", 0);
        let utf16 = [0xff, 0xfe, b'A', 0, b'l', 0, b'p', 0, b'h', 0, b'a', 0];
        assert_eq!(
            text_extraction("txt", utf16.to_vec(), &policy)
                .unwrap()
                .text,
            "Alpha"
        );
        assert_eq!(
            csv_extraction(b"one,two\nthree,four".to_vec(), &policy)
                .unwrap()
                .status,
            "completed"
        );
        let mut csv_limited = policy.clone();
        csv_limited.max_rows = 1;
        assert!(
            csv_extraction(b"one,two\nthree,four".to_vec(), &csv_limited)
                .unwrap()
                .truncated
        );
        let pdf = pdf_text_extraction(b"%PDF (Hello) /Type /Page".to_vec(), &policy).unwrap();
        assert_eq!(pdf.status, "completed");
        assert!(pdf.text.contains("Hello"));

        fn office_fixture(name: &str, xml: &str) -> Vec<u8> {
            let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
            writer
                .start_file(name, SimpleFileOptions::default())
                .unwrap();
            writer.write_all(xml.as_bytes()).unwrap();
            writer.finish().unwrap().into_inner()
        }

        let docx = office_xml_extraction(
            "docx",
            office_fixture("word/document.xml", "<w:document>Hello docx</w:document>"),
            &policy,
            &["word/document.xml"],
        )
        .unwrap();
        assert_eq!(docx.status, "completed");
        let malformed_docx = office_xml_extraction(
            "docx",
            office_fixture("word/document.xml", "<w:document>unterminated"),
            &policy,
            &["word/document.xml"],
        )
        .unwrap();
        assert_eq!(malformed_docx.status, "blocked");
        let xlsx = office_xml_extraction(
            "xlsx",
            office_fixture(
                "xl/worksheets/sheet1.xml",
                "<worksheet><row><c>Sheet value</c></row></worksheet>",
            ),
            &policy,
            &["xl/sharedStrings.xml", "xl/worksheets/sheet1.xml"],
        )
        .unwrap();
        assert_eq!(xlsx.status, "completed");
        let pptx = office_xml_extraction(
            "pptx",
            office_fixture(
                "ppt/slides/slide1.xml",
                "<p:sld><p:sp>Slide value</p:sp></p:sld>",
            ),
            &policy,
            &["ppt/slides/slide1.xml"],
        )
        .unwrap();
        assert_eq!(pptx.status, "completed");

        let mut limited = policy.clone();
        limited.max_pages = 1;
        let page_limited =
            pdf_text_extraction(b"%PDF /Type /Page /Type /Page".to_vec(), &limited).unwrap();
        assert_eq!(
            page_limited.reason.as_deref(),
            Some("content_pdf_page_limit_exceeded")
        );
    }

    #[test]
    fn provider_envelope_is_strict_bounded_and_content_only() {
        assert!(serde_json::from_str::<ContentModelEnvelopeV1>(
            r#"{"summary":"safe","keywords":[],"warnings":[],"tool":"shell"}"#
        )
        .is_err());
        let valid: ContentModelEnvelopeV1 =
            serde_json::from_str(r#"{"summary":"safe summary","keywords":[],"warnings":[]}"#)
                .unwrap();
        assert!(validate_content_model_envelope(&valid));
        assert!(!validate_content_model_envelope(&ContentModelEnvelopeV1 {
            summary: "filename: secret.txt".into(),
            keywords: Vec::new(),
            language: None,
            warnings: Vec::new(),
        }));
    }

    #[test]
    fn content_run_materializes_bounded_local_artifact_without_raw_retention() {
        let root = std::env::temp_dir().join(format!("zen-content-root-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let file_path = root.join("notes.txt");
        std::fs::write(&file_path, "Alpha alpha beta\nPrivate source text").unwrap();
        let db_path =
            std::env::temp_dir().join(format!("zen-content-db-{}.sqlite3", uuid::Uuid::new_v4()));
        let db = Database::open(&db_path).unwrap();
        let root_id = "content-test-root";
        {
            let conn = db.conn().unwrap();
            conn.execute(
                "INSERT INTO scan_roots(id, normalized_path, display_name, source_kind,
                    enabled, health_status, current_generation, revision,
                    needs_reconciliation, created_at, updated_at)
                 VALUES (?1,?2,'Content test','file_library',1,'healthy',1,1,0,1,1)",
                params![root_id, root.to_string_lossy().replace('\\', "/")],
            )
            .unwrap();
        }
        let file_metadata = std::fs::metadata(&file_path).unwrap();
        db.insert_file(crate::db::InsertFileRequest {
            id: "content-test-file".into(),
            path: file_path.to_string_lossy().replace('\\', "/"),
            name: "notes.txt".into(),
            extension: "txt".into(),
            size: file_metadata.len() as i64,
            mtime: modified_unix_seconds(&file_metadata),
            ctime: modified_unix_seconds(&file_metadata),
            is_dir: false,
            state_code: 0,
        })
        .unwrap();
        let root_revision: i64 = db
            .conn()
            .unwrap()
            .query_row(
                "SELECT revision FROM scan_roots WHERE id=?1",
                params![root_id],
                |row| row.get(0),
            )
            .unwrap();
        db.set_content_scope_policy(SetContentScopePolicyRequest {
            version: CONTENT_VERSION,
            root_id: root_id.into(),
            expected_root_revision: root_revision,
            expected_policy_revision: 0,
            confirmed: true,
            policy: ContentScopePolicyDto {
                root_revision,
                enabled: true,
                local_allowed: true,
                ..default_policy(root_id, 1)
            },
        })
        .unwrap();
        assert!(db
            .set_content_scope_policy(SetContentScopePolicyRequest {
                version: CONTENT_VERSION,
                root_id: root_id.into(),
                expected_root_revision: root_revision.saturating_sub(1),
                expected_policy_revision: 1,
                confirmed: true,
                policy: ContentScopePolicyDto {
                    root_revision: root_revision.saturating_sub(1),
                    enabled: true,
                    ..default_policy(root_id, 1)
                },
            })
            .is_err());
        assert!(db
            .set_content_scope_policy(SetContentScopePolicyRequest {
                version: CONTENT_VERSION,
                root_id: root_id.into(),
                expected_root_revision: root_revision,
                expected_policy_revision: 0,
                confirmed: true,
                policy: ContentScopePolicyDto {
                    root_revision,
                    enabled: true,
                    local_allowed: true,
                    ..default_policy(root_id, 1)
                },
            })
            .is_err());
        let library_revision = current_library_revision(&db.conn().unwrap()).unwrap();
        let preview = db
            .preview_content(ContentPreviewRequest {
                version: CONTENT_VERSION,
                request_id: "content-test-preview".into(),
                scope: FileLibraryScopeV2::Roots {
                    scan_root_ids: vec![root_id.into()],
                },
                selection_file_ids: vec!["content-test-file".into()],
                mode: "local".into(),
                expected_library_revision: library_revision,
                expected_policy_revisions: vec![ContentPolicyRevisionRequest {
                    root_id: root_id.into(),
                    root_revision,
                    policy_revision: 1,
                }],
                provider_mode: "none".into(),
            })
            .unwrap();
        assert_eq!(preview.supported_count, 1);
        let run = db
            .start_content_run(StartContentRunRequest {
                version: CONTENT_VERSION,
                request_id: "content-test-run".into(),
                scope: FileLibraryScopeV2::Roots {
                    scan_root_ids: vec![root_id.into()],
                },
                selection_file_ids: vec!["content-test-file".into()],
                mode: "local".into(),
                expected_library_revision: library_revision,
                expected_policy_revisions: vec![ContentPolicyRevisionRequest {
                    root_id: root_id.into(),
                    root_revision,
                    policy_revision: 1,
                }],
                provider_mode: "none".into(),
                preview_fingerprint: preview.preview_fingerprint,
                confirmed: true,
            })
            .unwrap();
        assert_eq!(run.status, "completed");
        let artifact = db
            .get_content_artifact("content-test-file")
            .unwrap()
            .unwrap();
        assert_eq!(artifact.status, "current");
        assert!(!artifact.text_retained);
        assert!(artifact
            .summary
            .as_deref()
            .unwrap_or_default()
            .contains("Alpha"));
        {
            let conn = db.conn().unwrap();
            conn.execute(
                "UPDATE files SET content_hash='changed-source' WHERE id='content-test-file'",
                [],
            )
            .unwrap();
        }
        assert_eq!(
            db.get_content_artifact("content-test-file")
                .unwrap()
                .unwrap()
                .status,
            "stale"
        );
        let stale_artifact = db
            .get_content_artifact("content-test-file")
            .unwrap()
            .unwrap();
        let old_summary = stale_artifact.summary.clone();
        std::fs::write(
            &file_path,
            "Changed source with a materially different size and content identity",
        )
        .unwrap();
        let rebuild_error = db
            .rebuild_content_artifact(ContentArtifactMutationRequest {
                file_id: "content-test-file".into(),
                expected_revision: stale_artifact.revision,
                confirmed: true,
            })
            .expect_err("changed source must fail rebuild");
        assert!(rebuild_error.to_string().contains("content_rebuild_failed"));
        let failed_rebuild = db
            .get_content_artifact("content-test-file")
            .unwrap()
            .unwrap();
        assert_eq!(failed_rebuild.status, "stale");
        assert_eq!(failed_rebuild.summary, old_summary);
        drop(db);
        let _ = std::fs::remove_file(db_path);
        let _ = std::fs::remove_dir_all(root);
    }
}
