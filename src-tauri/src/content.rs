//! Consent-bound local content understanding.
//!
//! The module deliberately keeps content understanding separate from the File
//! Library, scanner, watcher, rule and operation authorities. It accepts only
//! durable IDs/scopes, reads bytes on the backend after root validation, stores
//! bounded deterministic facts, and never stores raw text unless a root policy
//! explicitly opts into a bounded retention cap.

use crate::{
    ai::{
        provider::AIProvider,
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
use csv::ReaderBuilder;
use flate2::read::ZlibDecoder;
use quick_xml::{escape::unescape as unescape_xml, events::Event, Reader as XmlReader};
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
    sync::atomic::{AtomicBool, Ordering},
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
const PDF_MAX_OBJECTS: usize = 50_000;
const PDF_MAX_DECOMPRESSED_BYTES: usize = 64 * 1024 * 1024;
const PDF_SCAN_CHECK_BYTES: usize = 4096;
const PDF_MAX_CMAP_ENTRIES: usize = 16_384;
const PDF_MAX_CMAP_DECODED_BYTES: usize = 4 * 1024 * 1024;
const PDF_MAX_TEMP_BUFFER_BYTES: usize = 1024 * 1024;

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
    pub candidate_resolver: String,
    pub candidate_fingerprint: String,
    pub per_file_byte_budget: i64,
    pub per_file_char_budget: i64,
    pub total_byte_budget: i64,
    pub total_char_budget: i64,
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
    pub candidate_fingerprint: String,
    pub candidate_resolver: String,
    pub byte_budget: i64,
    pub char_budget: i64,
    pub requested_count: i64,
    pub materialized_count: i64,
    pub completed_count: i64,
    pub blocked_count: i64,
    pub skipped_count: i64,
    pub failed_count: i64,
    pub provider_revision: i64,
    pub provider_confirmed: bool,
    pub cancel_requested: bool,
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
    pub provider_status: String,
    pub provider_revision: i64,
    pub provider_completed_at: Option<i64>,
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
    pub expected_content_revision: i64,
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
    pub content_revision: i64,
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
    #[serde(default)]
    pub run_id: Option<String>,
    #[serde(default)]
    pub expected_run_revision: Option<i64>,
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
struct ProviderRunClaim {
    owner: String,
    revision: i64,
    expected_library_revision: i64,
}

#[derive(Debug, Clone)]
struct ProviderItemClaim {
    owner: String,
    provider_revision: i64,
    source_size: i64,
    source_mtime: i64,
    source_hash: String,
    root_id: String,
    policy_revision: i64,
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

#[derive(Debug)]
struct ContentSnapshot {
    preview: ContentPreviewDto,
    candidates: Vec<Candidate>,
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
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
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
        conn.execute(
            "UPDATE content_run_items SET provider_status='failed',
                    error_code='content_run_interrupted',
                    error_detail='The previous provider owner stopped.',
                    provider_owner=NULL, provider_revision=provider_revision+1,
                    revision=revision+1,
                    updated_at=?1 WHERE provider_status='running'
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

    pub fn get_content_catalog_revision(&self) -> Result<i64, DbError> {
        let conn = self.conn()?;
        current_content_revision(&conn)
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
        Ok(build_content_snapshot(&conn, request)?.preview)
    }

    pub fn start_content_run(
        &self,
        request: StartContentRunRequest,
    ) -> Result<ContentRunDto, DbError> {
        validate_start_request(&request)?;
        let mut conn = self.conn()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let snapshot = build_content_snapshot(
            &tx,
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
        )?;
        let selected_file_ids = snapshot
            .candidates
            .iter()
            .map(|candidate| candidate.id.clone())
            .collect::<Vec<_>>();
        let preview = snapshot.preview;
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
        if preview.exact_count > MAX_ITEMS as i64
            || snapshot.candidates.len() != preview.exact_count as usize
        {
            return Err(DbError::Validation(
                "content_preview_snapshot_changed_or_item_limit_exceeded".into(),
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
        let scope_json = serde_json::to_string(&request.scope)?;
        tx.execute(
            "INSERT INTO content_runs(
                id, scope_json, scope_fingerprint, mode, provider_mode, status,
                expected_library_revision, policy_fingerprint, confirmation,
                candidate_fingerprint, candidate_resolver,
                byte_budget, char_budget, requested_count, materialized_count,
                provider_confirmed, created_at, updated_at
             ) VALUES (?1,?2,?3,?4,?5,'building',?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?16)",
            params![
                run_id,
                scope_json,
                hash_bytes(serde_json::to_vec(&preview.scope_health)?),
                request.mode,
                request.provider_mode,
                request.expected_library_revision,
                preview.policy_fingerprint,
                bool_i64(request.confirmed),
                preview.candidate_fingerprint,
                preview.candidate_resolver,
                preview.byte_budget,
                preview.char_budget,
                preview.exact_count,
                snapshot.candidates.len() as i64,
                bool_i64(provider_requested),
                now,
            ],
        )?;
        for (ordinal, candidate) in snapshot.candidates.iter().enumerate() {
            let policy = load_policy(&tx, &candidate.root_id)?;
            let extractor_family = classify_candidate(candidate, Some(&policy)).extractor_family;
            tx.execute(
                "INSERT INTO content_run_items(
                    id, run_id, file_id, ordinal, status, root_id, source_is_dir,
                    extractor_family, extractor_version, source_hash, source_size, source_mtime,
                    policy_revision, created_at, updated_at
                 ) VALUES (?1,?2,?3,?4,'pending',?5,?6,?7,?8,?9,?10,?11,?12,?13,?13)",
                params![
                    format!("{run_id}-item-{ordinal}"),
                    run_id,
                    candidate.id,
                    ordinal as i64,
                    candidate.root_id,
                    bool_i64(candidate.is_dir),
                    extractor_family,
                    EXTRACTOR_VERSION,
                    candidate.content_hash,
                    candidate.size,
                    candidate.mtime,
                    policy.policy_revision,
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
        let run = self.process_content_run(&run_id, &request, snapshot.candidates)?;
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
                self.understand_content_artifacts(UnderstandContentArtifactsRequest {
                    version: CONTENT_VERSION,
                    artifact_ids,
                    expected_revisions,
                    run_id: Some(run_id.clone()),
                    expected_run_revision: self
                        .get_content_run(&run_id)
                        .ok()
                        .map(|run| run.revision),
                    confirmed: request.confirmed,
                })?;
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
                    expected_library_revision, candidate_fingerprint, candidate_resolver,
                    byte_budget, char_budget,
                    requested_count, materialized_count, completed_count,
                    blocked_count, skipped_count, failed_count, provider_revision,
                    provider_confirmed, cancel_requested, revision, last_error_code,
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
                    cancel_requested=1, updated_at=?3
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
                    extractor_version, artifact_id, provider_status, provider_revision,
                    provider_completed_at, error_code, error_detail, revision, updated_at
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
        let content_revision = current_content_revision(&conn)?;
        if library_revision != request.expected_library_revision {
            return Err(DbError::Validation(
                "content_library_revision_conflict".into(),
            ));
        }
        if content_revision != request.expected_content_revision {
            return Err(DbError::Validation(
                "content_catalog_revision_conflict".into(),
            ));
        }
        let resolved = resolve_scope(&conn, &request.scope)?;
        if resolved.health.state != "healthy" {
            return Err(DbError::Validation("content_scope_unavailable".into()));
        }
        let query_fingerprint = hash_bytes(serde_json::to_vec(&serde_json::json!({
            "query": request.query.trim(),
            "scope": &request.scope,
        }))?);
        let scope_fingerprint = hash_bytes(serde_json::to_vec(&request.scope)?);
        let cursor = request
            .cursor
            .as_deref()
            .map(|value| {
                decode_content_cursor(
                    value,
                    &query_fingerprint,
                    &scope_fingerprint,
                    content_revision,
                )
            })
            .transpose()?;
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
                    content_revision,
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
        if let Some(cursor) = cursor {
            sql.push_str(" AND (ca.updated_at < ? OR (ca.updated_at = ? AND ca.id < ?))");
            params.push(SqlValue::Integer(cursor.updated_at));
            params.push(SqlValue::Integer(cursor.updated_at));
            params.push(SqlValue::Text(cursor.id));
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
            artifacts.last().map(|artifact| {
                encode_content_cursor(
                    content_revision,
                    &query_fingerprint,
                    &scope_fingerprint,
                    artifact.updated_at,
                    &artifact.id,
                )
            })
        } else {
            None
        };
        Ok(ContentArtifactPageDto {
            artifacts,
            next_cursor,
            has_more,
            library_revision,
            content_revision,
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
        let preview = build_content_snapshot(
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
        )?
        .preview;
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
        let mut conn = self.conn()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let artifact_id = tx
            .query_row(
                "SELECT id FROM content_artifacts WHERE file_id=?1 AND revision=?2",
                params![request.file_id.trim(), request.expected_revision],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        let Some(artifact_id) = artifact_id else {
            return Err(DbError::Validation(
                "content_artifact_revision_conflict".into(),
            ));
        };
        let changed = tx.execute(
            "DELETE FROM content_artifacts WHERE id=?1 AND revision=?2",
            params![artifact_id, request.expected_revision],
        )?;
        let affected_run_ids = {
            let mut stmt =
                tx.prepare("SELECT DISTINCT run_id FROM content_run_items WHERE artifact_id=?1")?;
            let rows =
                stmt.query_map(params![artifact_id.as_str()], |row| row.get::<_, String>(0))?;
            rows.collect::<Result<Vec<_>, _>>()?
        };
        tx.execute(
            "DELETE FROM content_artifact_fts WHERE artifact_id=?1",
            params![artifact_id],
        )?;
        tx.execute(
            "UPDATE content_run_items SET artifact_id=NULL, provider_status='stale',
                    error_code='content_artifact_deleted', error_detail='Content artifact deleted by user.',
                    revision=revision+1, updated_at=?2
             WHERE artifact_id=?1",
            params![artifact_id, crate::db::current_unix_seconds()],
        )?;
        for run_id in affected_run_ids {
            tx.execute(
                "UPDATE content_runs SET status=CASE WHEN status IN ('completed','partially_completed') THEN 'stale' ELSE status END,
                        last_error_code='content_artifact_deleted',
                        last_error_detail='A referenced content artifact was deleted; the source file remains untouched.',
                        revision=revision+1, updated_at=?2 WHERE id=?1",
                params![run_id, crate::db::current_unix_seconds()],
            )?;
        }
        if changed != 1 {
            return Err(DbError::Validation(
                "content_artifact_revision_conflict".into(),
            ));
        }
        tx.commit()?;
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
        let scoped_file_sql = format!("SELECT f.id FROM files f WHERE {}", resolved.clause);
        let scoped_file_ids = {
            let mut stmt = tx.prepare(&scoped_file_sql)?;
            let rows = stmt.query_map(params_from_iter(resolved.params.iter()), |row| {
                row.get::<_, String>(0)
            })?;
            rows.collect::<Result<Vec<_>, _>>()?
        };
        if scoped_file_ids.is_empty() {
            tx.commit()?;
            return Ok(0);
        }
        let scoped_artifact_ids = {
            let mut stmt = tx.prepare(&format!(
                "SELECT ca.id FROM content_artifacts ca JOIN files f ON f.id=ca.file_id WHERE {}",
                resolved.clause
            ))?;
            let rows = stmt.query_map(params_from_iter(resolved.params.iter()), |row| {
                row.get::<_, String>(0)
            })?;
            rows.collect::<Result<Vec<_>, _>>()?
        };
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
        let changed = tx.execute(
            &format!(
                "DELETE FROM content_artifacts WHERE file_id IN ({})",
                scoped_file_sql
            ),
            params_from_iter(resolved.params.iter()),
        )? as i64;
        for artifact_id in scoped_artifact_ids {
            tx.execute(
                "DELETE FROM content_artifact_fts WHERE artifact_id=?1",
                params![artifact_id],
            )?;
        }
        for run_id in run_ids {
            let mut values = vec![SqlValue::Text(run_id.clone())];
            values.extend(resolved.params.iter().cloned());
            tx.execute(
                &format!(
                    "DELETE FROM content_run_items WHERE run_id=?1 AND file_id IN ({})",
                    scoped_file_sql
                ),
                params_from_iter(values.iter()),
            )?;
            let remaining: i64 = tx.query_row(
                "SELECT COUNT(*) FROM content_run_items WHERE run_id=?1",
                params![run_id],
                |row| row.get(0),
            )?;
            if remaining == 0 {
                tx.execute("DELETE FROM content_runs WHERE id=?1", params![run_id])?;
            } else {
                tx.execute(
                    "UPDATE content_runs SET status='stale', last_error_code='content_scope_purged',
                            last_error_detail='In-scope content was purged; out-of-scope items remain.',
                            revision=revision+1, updated_at=?2 WHERE id=?1",
                    params![run_id, crate::db::current_unix_seconds()],
                )?;
            }
        }
        tx.commit()?;
        Ok(changed)
    }

    pub fn understand_content_artifacts(
        &self,
        request: UnderstandContentArtifactsRequest,
    ) -> Result<ContentUnderstandingResultDto, DbError> {
        self.understand_content_artifacts_with_seams(request, None, None)
    }

    fn understand_content_artifacts_with_seams(
        &self,
        request: UnderstandContentArtifactsRequest,
        provider_override: Option<&dyn AIProvider>,
        before_provider_send: Option<&dyn Fn()>,
    ) -> Result<ContentUnderstandingResultDto, DbError> {
        let run_id = request
            .run_id
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| DbError::Validation("content_provider_run_required".into()))?;
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
        let run = self.get_content_run(run_id)?;
        if request.expected_run_revision != Some(run.revision)
            || !run.provider_confirmed
            || !matches!(
                run.status.as_str(),
                "running" | "completed" | "partially_completed"
            )
        {
            return Err(DbError::Validation(
                "content_provider_run_revision_or_consent_required".into(),
            ));
        }
        // Resolve and validate every provider dependency before claiming the
        // durable run owner. A malformed/disabled provider must be retryable
        // without leaving a committed owner or advancing the run revision.
        let settings =
            normalize_ai_settings(get_ai_settings_for_db(self).map_err(|_| {
                DbError::Validation("content_provider_configuration_invalid".into())
            })?);
        if !content_provider_is_configured(&settings) {
            return Err(DbError::Validation(
                "content_provider_not_configured_for_this_run".into(),
            ));
        }
        validate_ai_settings(&settings, !cfg!(debug_assertions))
            .map_err(|_| DbError::Validation("content_provider_configuration_invalid".into()))?;
        let owned_provider = provider_override
            .is_none()
            .then(|| provider_for_settings(&settings));
        let provider = provider_override.unwrap_or_else(|| {
            owned_provider
                .as_deref()
                .expect("provider is owned when no test override is supplied")
        });
        let run_claim = self.claim_provider_phase(run_id, run.revision)?;
        let provider_result = (|| -> Result<ContentUnderstandingResultDto, DbError> {
            let mut processed = 0_i64;
            let mut blocked = 0_i64;
            let mut first_reason = None;
            for (artifact_id, expected_revision) in request
                .artifact_ids
                .iter()
                .zip(request.expected_revisions.iter())
            {
                if self.provider_run_cancelled(run_id)? {
                    blocked += 1;
                    first_reason.get_or_insert_with(|| "content_run_cancelled".into());
                    continue;
                }
                let Some(item_claim) = self.claim_provider_item(run_id, artifact_id, &run_claim)?
                else {
                    // A completed provider item is durable and must never replay.
                    continue;
                };
                let artifact = self.load_understanding_artifact(artifact_id)?;
                let Some(artifact) = artifact else {
                    blocked += 1;
                    first_reason.get_or_insert_with(|| "content_artifact_not_found".into());
                    self.mark_provider_item(
                        run_id,
                        artifact_id,
                        &item_claim,
                        "blocked",
                        Some("content_artifact_not_found"),
                    )?;
                    continue;
                };
                if artifact.revision != *expected_revision || artifact.status != "current" {
                    blocked += 1;
                    first_reason.get_or_insert_with(|| "content_artifact_revision_conflict".into());
                    self.mark_provider_item(
                        run_id,
                        artifact_id,
                        &item_claim,
                        "stale",
                        Some("content_artifact_revision_conflict"),
                    )?;
                    continue;
                }
                let Some(root_id) = artifact.root_id.as_deref() else {
                    blocked += 1;
                    first_reason.get_or_insert_with(|| "content_root_missing".into());
                    self.mark_provider_item(
                        run_id,
                        artifact_id,
                        &item_claim,
                        "blocked",
                        Some("content_root_missing"),
                    )?;
                    continue;
                };
                if root_id != item_claim.root_id {
                    blocked += 1;
                    first_reason.get_or_insert_with(|| "content_provider_scope_conflict".into());
                    self.mark_provider_item(
                        run_id,
                        artifact_id,
                        &item_claim,
                        "stale",
                        Some("content_provider_scope_conflict"),
                    )?;
                    continue;
                }
                let policy = self.get_content_scope_policy(root_id)?;
                if policy.policy_revision != item_claim.policy_revision {
                    blocked += 1;
                    first_reason.get_or_insert_with(|| "content_policy_revision_conflict".into());
                    self.mark_provider_item(
                        run_id,
                        artifact_id,
                        &item_claim,
                        "stale",
                        Some("content_policy_revision_conflict"),
                    )?;
                    continue;
                }
                let provider_is_cloud =
                    matches!(settings.provider, AIProviderKind::OpenAICompatible);
                if provider_is_cloud
                    && matches!(artifact.risk_level.as_str(), "Sensitive" | "System")
                {
                    blocked += 1;
                    first_reason.get_or_insert_with(|| "content_sensitive_cloud_denied".into());
                    self.mark_provider_item(
                        run_id,
                        artifact_id,
                        &item_claim,
                        "blocked",
                        Some("content_sensitive_cloud_denied"),
                    )?;
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
                    self.mark_provider_item(
                        run_id,
                        artifact_id,
                        &item_claim,
                        "blocked",
                        Some("content_provider_consent_required"),
                    )?;
                    continue;
                }
                let payload = match self.load_understanding_payload(
                    &artifact,
                    &policy,
                    run_claim.expected_library_revision,
                ) {
                    Ok(payload) => payload,
                    Err(error) => {
                        blocked += 1;
                        first_reason.get_or_insert_with(|| content_error_code(&error));
                        self.mark_provider_item(
                            run_id,
                            artifact_id,
                            &item_claim,
                            "stale",
                            Some(&content_error_code(&error)),
                        )?;
                        continue;
                    }
                };
                if payload.trim().is_empty() {
                    blocked += 1;
                    first_reason
                        .get_or_insert_with(|| "content_extraction_text_unavailable".into());
                    self.mark_provider_item(
                        run_id,
                        artifact_id,
                        &item_claim,
                        "blocked",
                        Some("content_extraction_text_unavailable"),
                    )?;
                    continue;
                }
                if let Some(hook) = before_provider_send {
                    hook();
                }
                if let Err(error) = self.revalidate_provider_send_boundary(
                    &artifact,
                    &policy,
                    &run_claim,
                    &item_claim,
                ) {
                    blocked += 1;
                    first_reason.get_or_insert_with(|| content_error_code(&error));
                    self.mark_provider_item(
                        run_id,
                        artifact_id,
                        &item_claim,
                        "stale",
                        Some(&content_error_code(&error)),
                    )?;
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
                    self.mark_provider_item(run_id, artifact_id, &item_claim, "failed", Some("content_provider_request_failed"))?;
                    continue;
                }
            };
                let envelope: ContentModelEnvelopeV1 = match serde_json::from_str(&raw) {
                    Ok(value) => value,
                    Err(_) => {
                        blocked += 1;
                        first_reason.get_or_insert_with(|| "content_model_json_invalid".into());
                        self.mark_provider_item(
                            run_id,
                            artifact_id,
                            &item_claim,
                            "failed",
                            Some("content_model_json_invalid"),
                        )?;
                        continue;
                    }
                };
                if !validate_content_model_envelope(&envelope) {
                    blocked += 1;
                    first_reason.get_or_insert_with(|| "content_model_envelope_invalid".into());
                    self.mark_provider_item(
                        run_id,
                        artifact_id,
                        &item_claim,
                        "failed",
                        Some("content_model_envelope_invalid"),
                    )?;
                    continue;
                }
                if let Err(error) = self.publish_provider_result(
                    run_id,
                    &run_claim,
                    &item_claim,
                    &artifact,
                    &envelope,
                    &settings,
                ) {
                    blocked += 1;
                    first_reason.get_or_insert_with(|| content_error_code(&error));
                    continue;
                }
                processed += 1;
            }
            self.finish_provider_phase(run_id, &run_claim, blocked, first_reason.as_deref())?;
            Ok(ContentUnderstandingResultDto {
                processed_count: processed,
                blocked_count: blocked,
                reason: first_reason,
            })
        })();
        match provider_result {
            Ok(result) => Ok(result),
            Err(error) => {
                self.abort_provider_phase(run_id, &run_claim, "content_provider_phase_aborted")?;
                Err(error)
            }
        }
    }

    fn claim_provider_phase(
        &self,
        run_id: &str,
        expected_revision: i64,
    ) -> Result<ProviderRunClaim, DbError> {
        let mut conn = self.conn()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let owner = format!("provider-run-owner-{}", uuid::Uuid::new_v4());
        let now = crate::db::current_unix_seconds();
        let changed = tx.execute(
            "UPDATE content_runs
             SET status='running', provider_revision=provider_revision+1,
                 provider_owner=?3, revision=revision+1, updated_at=?4
             WHERE id=?1 AND revision=?2 AND provider_confirmed=1
               AND provider_owner IS NULL
               AND status IN ('running','completed','partially_completed')",
            params![run_id, expected_revision, owner, now],
        )?;
        if changed != 1 {
            return Err(DbError::Validation(
                "content_provider_run_revision_conflict".into(),
            ));
        }
        let expected_library_revision = tx.query_row(
            "SELECT expected_library_revision FROM content_runs WHERE id=?1 AND revision=?2 AND provider_owner=?3",
            params![run_id, expected_revision + 1, owner],
            |row| row.get(0),
        )?;
        tx.commit()?;
        Ok(ProviderRunClaim {
            owner,
            revision: expected_revision + 1,
            expected_library_revision,
        })
    }

    fn provider_run_cancelled(&self, run_id: &str) -> Result<bool, DbError> {
        let conn = self.conn()?;
        conn.query_row(
            "SELECT cancel_requested=1 OR status='cancelling' FROM content_runs WHERE id=?1",
            params![run_id],
            |row| row.get(0),
        )
        .map_err(DbError::from)
    }

    fn claim_provider_item(
        &self,
        run_id: &str,
        artifact_id: &str,
        run_claim: &ProviderRunClaim,
    ) -> Result<Option<ProviderItemClaim>, DbError> {
        let mut conn = self.conn()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let owner = format!("provider-item-owner-{}", uuid::Uuid::new_v4());
        let now = crate::db::current_unix_seconds();
        let changed = tx.execute(
            "UPDATE content_run_items
             SET provider_status='running', provider_revision=provider_revision+1,
                 provider_owner=?3, revision=revision+1, updated_at=?4
             WHERE run_id=?1 AND artifact_id=?2
               AND provider_status IN ('pending','failed','stale')
               AND status='completed'
               AND EXISTS (
                   SELECT 1 FROM content_runs
                   WHERE id=?1 AND status='running' AND revision=?5 AND provider_owner=?6
               )",
            params![
                run_id,
                artifact_id,
                owner,
                now,
                run_claim.revision,
                run_claim.owner
            ],
        )?;
        if changed == 0 {
            tx.commit()?;
            return Ok(None);
        }
        let claim = tx.query_row(
            "SELECT provider_revision, source_size, source_mtime, source_hash,
                    root_id, policy_revision
             FROM content_run_items
             WHERE run_id=?1 AND artifact_id=?2 AND provider_status='running'
               AND provider_owner=?3",
            params![run_id, artifact_id, owner],
            |row| {
                Ok(ProviderItemClaim {
                    owner: owner.clone(),
                    provider_revision: row.get(0)?,
                    source_size: row.get(1)?,
                    source_mtime: row.get(2)?,
                    source_hash: row.get(3)?,
                    root_id: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
                    policy_revision: row.get(5)?,
                })
            },
        )?;
        tx.commit()?;
        Ok(Some(claim))
    }

    fn mark_provider_item(
        &self,
        run_id: &str,
        artifact_id: &str,
        claim: &ProviderItemClaim,
        status: &str,
        error_code: Option<&str>,
    ) -> Result<(), DbError> {
        let conn = self.conn()?;
        let changed = conn.execute(
            "UPDATE content_run_items
             SET provider_status=?4, error_code=?5,
                 error_detail=?5, provider_completed_at=CASE
                    WHEN ?4 IN ('completed','blocked','failed','cancelled','stale')
                    THEN ?6 ELSE provider_completed_at END,
                 provider_owner=NULL, revision=revision+1, updated_at=?6
             WHERE run_id=?1 AND artifact_id=?2 AND provider_status='running'
               AND provider_revision=?3 AND provider_owner=?7",
            params![
                run_id,
                artifact_id,
                claim.provider_revision,
                status,
                error_code,
                crate::db::current_unix_seconds(),
                claim.owner,
            ],
        )?;
        if changed != 1 {
            return Err(DbError::Validation(
                "content_provider_item_owner_conflict".into(),
            ));
        }
        Ok(())
    }

    fn finish_provider_phase(
        &self,
        run_id: &str,
        claim: &ProviderRunClaim,
        provider_blocked: i64,
        reason: Option<&str>,
    ) -> Result<(), DbError> {
        let mut conn = self.conn()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let now = crate::db::current_unix_seconds();
        let (current_revision, current_status, cancelled): (i64, String, bool) = tx.query_row(
            "SELECT revision, status, cancel_requested=1 OR status='cancelling' FROM content_runs WHERE id=?1",
            params![run_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )?;
        let remaining: i64 = tx.query_row(
            "SELECT COUNT(*) FROM content_run_items
             WHERE run_id=?1 AND provider_status IN ('pending','running')",
            params![run_id],
            |row| row.get(0),
        )?;
        let (existing_blocked, existing_failed): (i64, i64) = tx.query_row(
            "SELECT blocked_count, failed_count FROM content_runs WHERE id=?1",
            params![run_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;
        let status = if cancelled {
            "cancelled"
        } else if provider_blocked > 0
            || existing_blocked > 0
            || existing_failed > 0
            || remaining > 0
        {
            "partially_completed"
        } else {
            "completed"
        };
        if cancelled {
            tx.execute(
                "UPDATE content_run_items
                 SET provider_status='cancelled', provider_owner=NULL,
                     error_code='content_run_cancelled',
                     error_detail='The run was cancelled while provider work was active.',
                     provider_completed_at=?2, revision=revision+1, updated_at=?2
                 WHERE run_id=?1 AND provider_status IN ('pending','running')",
                params![run_id, now],
            )?;
        }
        let expected_status = if current_status == "cancelling" {
            "cancelling"
        } else {
            "running"
        };
        let expected_revision = if expected_status == "running" {
            claim.revision
        } else {
            current_revision
        };
        let changed = tx.execute(
            "UPDATE content_runs SET status=?2, blocked_count=blocked_count+?3,
                    last_error_code=?4, provider_owner=NULL, revision=revision+1, updated_at=?5,
                    completed_at=CASE WHEN ?2 IN ('completed','partially_completed','cancelled')
                                      THEN ?5 ELSE completed_at END
             WHERE id=?1 AND revision=?6 AND status=?7 AND provider_owner=?8",
            params![
                run_id,
                status,
                provider_blocked,
                reason,
                now,
                expected_revision,
                expected_status,
                claim.owner
            ],
        )?;
        if changed != 1 {
            return Err(DbError::Validation(
                "content_provider_run_owner_conflict".into(),
            ));
        }
        tx.commit()?;
        Ok(())
    }

    fn abort_provider_phase(
        &self,
        run_id: &str,
        claim: &ProviderRunClaim,
        error_code: &str,
    ) -> Result<(), DbError> {
        let mut conn = self.conn()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let now = crate::db::current_unix_seconds();
        let failed_items = tx.execute(
            "UPDATE content_run_items
             SET provider_status='failed', error_code=?2, error_detail=?2,
                 provider_owner=NULL, provider_completed_at=?3,
                 revision=revision+1, updated_at=?3
             WHERE run_id=?1 AND provider_status='running'
               AND EXISTS (
                   SELECT 1 FROM content_runs
                   WHERE id=?1 AND revision=?4 AND status='running' AND provider_owner=?5
               )",
            params![run_id, error_code, now, claim.revision, claim.owner],
        )? as i64;
        let changed = tx.execute(
            "UPDATE content_runs
             SET status='partially_completed', failed_count=failed_count+?2,
                 last_error_code=?3, provider_owner=NULL, revision=revision+1,
                 completed_at=?4, updated_at=?4
             WHERE id=?1 AND revision=?5 AND status='running' AND provider_owner=?6",
            params![
                run_id,
                failed_items,
                error_code,
                now,
                claim.revision,
                claim.owner
            ],
        )?;
        if changed != 1 {
            return Err(DbError::Validation(
                "content_provider_run_owner_conflict".into(),
            ));
        }
        tx.commit()?;
        Ok(())
    }

    fn revalidate_provider_send_boundary(
        &self,
        artifact: &UnderstandingArtifact,
        policy: &ContentScopePolicyDto,
        run_claim: &ProviderRunClaim,
        item_claim: &ProviderItemClaim,
    ) -> Result<(), DbError> {
        let root_id = artifact
            .root_id
            .as_deref()
            .ok_or_else(|| DbError::Validation("content_root_missing".into()))?;
        let conn = self.conn()?;
        let candidate = load_candidate_by_id(&conn, &artifact.file_id, root_id)?
            .ok_or_else(|| DbError::Validation("library_file_unavailable".into()))?;
        let library_revision = current_library_revision(&conn)?;
        if library_revision != run_claim.expected_library_revision {
            return Err(DbError::Validation(
                "content_library_revision_conflict".into(),
            ));
        }
        revalidate_content_boundary(
            &conn,
            &candidate,
            run_claim.expected_library_revision,
            policy.root_revision,
            policy.policy_revision,
            policy,
        )?;
        if candidate.size != item_claim.source_size
            || candidate.mtime != item_claim.source_mtime
            || candidate.content_hash != item_claim.source_hash
        {
            return Err(DbError::Validation(
                "content_source_changed_before_provider_send".into(),
            ));
        }
        Self::verify_provider_source_snapshot(
            Path::new(&candidate.path),
            item_claim.source_size,
            item_claim.source_mtime,
            &item_claim.source_hash,
            policy.max_bytes.max(0) as usize,
        )?;
        let current = conn
            .query_row(
                "SELECT revision, status, source_hash FROM content_artifacts WHERE id=?1",
                params![artifact.id.as_str()],
                |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                    ))
                },
            )
            .optional()?;
        let Some((revision, status, source_hash)) = current else {
            return Err(DbError::Validation("content_artifact_not_found".into()));
        };
        if revision != artifact.revision
            || status != "current"
            || source_hash != artifact.source_hash
        {
            return Err(DbError::Validation(
                "content_artifact_revision_conflict".into(),
            ));
        }
        Ok(())
    }

    fn verify_provider_source_snapshot(
        path: &Path,
        expected_size: i64,
        expected_mtime: i64,
        expected_hash: &str,
        max_bytes: usize,
    ) -> Result<(), DbError> {
        let metadata = std::fs::metadata(path)
            .map_err(|_| DbError::Validation("library_file_unavailable".into()))?;
        let actual_size = i64::try_from(metadata.len()).map_err(|_| {
            DbError::Validation("content_source_changed_before_provider_send".into())
        })?;
        let actual_mtime = metadata
            .modified()
            .ok()
            .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
            .map(|value| value.as_secs() as i64)
            .unwrap_or_default();
        if actual_size != expected_size || actual_mtime != expected_mtime {
            return Err(DbError::Validation(
                "content_source_changed_before_provider_send".into(),
            ));
        }
        if !metadata.is_dir() {
            let source_bytes = read_bounded_file(path, max_bytes)?;
            if hash_bytes(&source_bytes) != expected_hash {
                return Err(DbError::Validation(
                    "content_source_changed_before_provider_send".into(),
                ));
            }
        }
        Ok(())
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
        expected_library_revision: i64,
    ) -> Result<String, DbError> {
        let root_id = artifact
            .root_id
            .as_deref()
            .ok_or_else(|| DbError::Validation("content_root_missing".into()))?;
        let conn = self.conn()?;
        let candidate = load_candidate_by_id(&conn, &artifact.file_id, root_id)?
            .ok_or_else(|| DbError::Validation("library_file_unavailable".into()))?;
        let library_revision = current_library_revision(&conn)?;
        if library_revision != expected_library_revision {
            return Err(DbError::Validation(
                "content_library_revision_conflict".into(),
            ));
        }
        let root_revision = policy.root_revision;
        let root_path = revalidate_content_boundary(
            &conn,
            &candidate,
            expected_library_revision,
            root_revision,
            policy.policy_revision,
            policy,
        )?;
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

    fn publish_provider_result(
        &self,
        run_id: &str,
        run_claim: &ProviderRunClaim,
        item_claim: &ProviderItemClaim,
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
        let run_state: (String, i64, Option<String>) = tx.query_row(
            "SELECT status, revision, provider_owner FROM content_runs WHERE id=?1",
            params![run_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )?;
        if run_state.0 != "running"
            || run_state.1 != run_claim.revision
            || run_state.2.as_deref() != Some(run_claim.owner.as_str())
        {
            let changed = tx.execute(
                "UPDATE content_run_items
                 SET provider_status='cancelled', error_code='content_run_cancelled',
                     error_detail='Provider result arrived after the run owner lost its claim.',
                     provider_owner=NULL, provider_completed_at=?5,
                     revision=revision+1, updated_at=?5
                 WHERE run_id=?1 AND artifact_id=?2 AND provider_status='running'
                   AND provider_revision=?3 AND provider_owner=?4",
                params![
                    run_id,
                    artifact.id,
                    item_claim.provider_revision,
                    item_claim.owner,
                    crate::db::current_unix_seconds()
                ],
            )?;
            if changed != 1 {
                return Err(DbError::Validation(
                    "content_provider_item_owner_conflict".into(),
                ));
            }
            tx.commit()?;
            return Err(DbError::Validation("content_run_cancelled".into()));
        }
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
            let item_changed = tx.execute(
                "UPDATE content_run_items
                 SET provider_status='stale', error_code='content_artifact_revision_conflict',
                     error_detail='The artifact changed while the provider result was being published.',
                     provider_owner=NULL, provider_completed_at=?5,
                     revision=revision+1, updated_at=?5
                 WHERE run_id=?1 AND artifact_id=?2 AND provider_status='running'
                   AND provider_revision=?3 AND provider_owner=?4",
                params![
                    run_id,
                    artifact.id,
                    item_claim.provider_revision,
                    item_claim.owner,
                    crate::db::current_unix_seconds()
                ],
            )?;
            if item_changed != 1 {
                return Err(DbError::Validation(
                    "content_provider_item_owner_conflict".into(),
                ));
            }
            tx.commit()?;
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
        let item_changed = tx.execute(
            "UPDATE content_run_items
             SET provider_status='completed', error_code=NULL, error_detail=NULL,
                 provider_owner=NULL, provider_completed_at=?5,
                 revision=revision+1, updated_at=?5
             WHERE run_id=?1 AND artifact_id=?2 AND provider_status='running'
               AND provider_revision=?3 AND provider_owner=?4",
            params![
                run_id,
                artifact.id,
                item_claim.provider_revision,
                item_claim.owner,
                crate::db::current_unix_seconds()
            ],
        )?;
        if item_changed != 1 {
            return Err(DbError::Validation(
                "content_provider_item_owner_conflict".into(),
            ));
        }
        tx.commit()?;
        Ok(())
    }

    fn process_content_run(
        &self,
        run_id: &str,
        request: &StartContentRunRequest,
        candidates: Vec<Candidate>,
    ) -> Result<ContentRunDto, DbError> {
        self.process_content_run_with_pdf_hook(run_id, request, candidates, None, None)
    }

    fn process_content_run_with_pdf_hook(
        &self,
        run_id: &str,
        request: &StartContentRunRequest,
        candidates: Vec<Candidate>,
        pdf_work_hook: Option<&dyn Fn()>,
        pdf_cancel: Option<&AtomicBool>,
    ) -> Result<ContentRunDto, DbError> {
        self.process_content_run_with_pdf_controls(
            run_id,
            request,
            candidates,
            pdf_work_hook,
            pdf_cancel,
            None,
        )
    }

    #[cfg(test)]
    fn process_content_run_with_pdf_deadline_for_test(
        &self,
        run_id: &str,
        request: &StartContentRunRequest,
        candidates: Vec<Candidate>,
        pdf_work_hook: Option<&dyn Fn()>,
        deadline_after: Duration,
    ) -> Result<ContentRunDto, DbError> {
        self.process_content_run_with_pdf_controls(
            run_id,
            request,
            candidates,
            pdf_work_hook,
            None,
            Some(deadline_after),
        )
    }

    fn process_content_run_with_pdf_controls(
        &self,
        run_id: &str,
        request: &StartContentRunRequest,
        candidates: Vec<Candidate>,
        pdf_work_hook: Option<&dyn Fn()>,
        pdf_cancel: Option<&AtomicBool>,
        pdf_deadline_after: Option<Duration>,
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
                let expected = request
                    .expected_policy_revisions
                    .iter()
                    .find(|item| item.root_id == candidate.root_id)
                    .ok_or_else(|| {
                        DbError::Validation("content_root_or_policy_revision_required".into())
                    });
                match expected {
                    Ok(expected) => {
                        let conn = self.conn()?;
                        match revalidate_content_boundary(
                            &conn,
                            candidate,
                            request.expected_library_revision,
                            expected.root_revision,
                            expected.policy_revision,
                            &policy,
                        ) {
                            Ok(root_path) => extract_candidate_with_pdf_hook(
                                candidate,
                                &policy,
                                &root_path,
                                pdf_work_hook,
                                pdf_cancel,
                                pdf_deadline_after,
                            ),
                            Err(error) => Err(error),
                        }
                    }
                    Err(error) => Err(error),
                }
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
                    status: if is_content_boundary_error(&error) {
                        "blocked"
                    } else {
                        "failed"
                    },
                    reason: Some(content_error_code(&error)),
                },
            };
            if extraction.status == "completed" {
                self.persist_artifact(run_id, candidate, &policy, &extraction)?;
                self.mark_content_item(run_id, ordinal as i64, "completed", None, None)?;
                completed += 1;
            } else if matches!(extraction.status, "blocked" | "unsupported") {
                if should_publish_failed_pdf_extraction(&extraction) {
                    self.persist_artifact(run_id, candidate, &policy, &extraction)?;
                }
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
                // recording the item failure, except for a cooperative PDF
                // timeout/cancel, which must publish no artifact or FTS row.
                if should_publish_failed_pdf_extraction(&extraction) {
                    self.persist_artifact(run_id, candidate, &policy, &extraction)?;
                }
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

fn build_content_snapshot(
    conn: &Connection,
    request: ContentPreviewRequest,
) -> Result<ContentSnapshot, DbError> {
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
        policy_revisions.push(ContentPolicyRevisionRequest {
            root_id: root_id.clone(),
            root_revision: policy.root_revision,
            policy_revision: policy.policy_revision,
        });
        policies.push(Policy { dto: policy });
    }
    let candidate_count = candidate_count(conn, &request.scope, &request.selection_file_ids)?;
    // A deferred (>10,000) preview is count/fingerprint-only.  Do not
    // materialize a candidate vector that a start request could accidentally
    // treat as executable work; start rejects the snapshot before any item
    // rows are inserted.
    let candidates = if candidate_count <= MAX_ITEMS as i64 {
        select_candidates(
            conn,
            &request.scope,
            &request.selection_file_ids,
            Some(candidate_count as usize),
        )?
    } else {
        Vec::new()
    };
    let mut supported = 0_i64;
    let mut unsupported = 0_i64;
    let mut blocked = 0_i64;
    let mut failed = 0_i64;
    let mut supported_formats = HashSet::new();
    let mut unsupported_formats = HashSet::new();
    let mut blocked_reasons = HashSet::new();
    let mut sample = Vec::new();
    let mut total_byte_budget = 0_i64;
    let mut total_char_budget = 0_i64;
    let mut per_file_byte_budget = 0_i64;
    let mut per_file_char_budget = 0_i64;
    for_each_candidate(
        conn,
        &request.scope,
        &request.selection_file_ids,
        None,
        |candidate| {
            let policy = policies
                .iter()
                .find(|policy| policy.dto.root_id == candidate.root_id)
                .map(|policy| &policy.dto);
            let item = classify_candidate(&candidate, policy);
            if let Some(policy) = policy {
                per_file_byte_budget = per_file_byte_budget.max(policy.max_bytes);
                per_file_char_budget = per_file_char_budget.max(policy.max_chars);
                total_byte_budget =
                    total_byte_budget.saturating_add(candidate.size.max(0).min(policy.max_bytes));
                total_char_budget = total_char_budget.saturating_add(policy.max_chars);
            }
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
            Ok(())
        },
    )?;
    let exact_count = candidate_count;
    let exact_state = if exact_count > MAX_ITEMS as i64 {
        "deferred"
    } else {
        "exact"
    };
    // Hash the complete ordered candidate stream even when materialization is
    // deferred.  The preview never stores/returns all IDs, but its opaque
    // resolver still commits to every identity and extractor classification.
    let candidate_fingerprint =
        candidate_stream_fingerprint(conn, &request.scope, &request.selection_file_ids, &policies)?;
    let policy_payload = serde_json::to_vec(&policy_revisions)?;
    let policy_fingerprint = hash_bytes(&policy_payload);
    let scope_health = ContentScopeHealthDto {
        scope: request.scope.clone(),
        health: resolved.health,
        root_ids,
        policy_revisions,
    };
    let candidate_resolver = hash_bytes(
        serde_json::to_string(&serde_json::json!({
            "scope": &request.scope,
            "selection": &request.selection_file_ids,
            "libraryRevision": library_revision,
            "policyFingerprint": policy_fingerprint,
            "candidateFingerprint": candidate_fingerprint,
            "count": exact_count,
        }))?
        .as_bytes(),
    );
    let preview_payload = serde_json::json!({
        "version": CONTENT_VERSION,
        "scope": &scope_health,
        "libraryRevision": library_revision,
        "policyFingerprint": policy_fingerprint,
        "candidateFingerprint": candidate_fingerprint,
        "candidateResolver": candidate_resolver,
        "mode": request.mode,
        "providerMode": request.provider_mode,
        "count": exact_count,
        "exactState": exact_state,
        "totalByteBudget": total_byte_budget,
        "totalCharBudget": total_char_budget,
        "perFileByteBudget": per_file_byte_budget,
        "perFileCharBudget": per_file_char_budget,
        "selection": &request.selection_file_ids,
    });
    let preview_fingerprint = hash_bytes(serde_json::to_string(&preview_payload)?.as_bytes());
    Ok(ContentSnapshot { candidates, preview: ContentPreviewDto {
        version: CONTENT_VERSION,
        request_id: request.request_id,
        scope_health,
        exact_count,
        deferred_count: (exact_state == "deferred").then_some(exact_count),
        exact_state: exact_state.into(),
        candidate_resolver,
        candidate_fingerprint,
        per_file_byte_budget,
        per_file_char_budget,
        total_byte_budget,
        total_char_budget,
        byte_budget: total_byte_budget,
        char_budget: total_char_budget,
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
    }})
}

fn select_candidates(
    conn: &Connection,
    scope: &FileLibraryScopeV2,
    selection: &[String],
    limit: Option<usize>,
) -> Result<Vec<Candidate>, DbError> {
    let mut candidates = Vec::new();
    for_each_candidate(conn, scope, selection, limit, |candidate| {
        candidates.push(candidate);
        Ok(())
    })?;
    Ok(candidates)
}

fn candidate_filter(
    conn: &Connection,
    scope: &FileLibraryScopeV2,
    selection: &[String],
) -> Result<(String, Vec<SqlValue>), DbError> {
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
            .collect::<Vec<_>>();
        if ids.len() != selection.len()
            || ids.len() > MAX_ITEMS
            || ids.iter().collect::<HashSet<_>>().len() != ids.len()
        {
            return Err(DbError::Validation("content_selection_invalid".into()));
        }
        clause.push_str(&format!(
            " AND f.id IN ({})",
            std::iter::repeat_n("?", ids.len())
                .collect::<Vec<_>>()
                .join(",")
        ));
        params.extend(ids.into_iter().map(|id| SqlValue::Text(id.to_string())));
        let selected_count: i64 = conn.query_row(
            &format!("SELECT COUNT(*) FROM files f WHERE {clause}"),
            params_from_iter(params.iter()),
            |row| row.get(0),
        )?;
        if selected_count != selection.len() as i64 {
            return Err(DbError::Validation(
                "content_selection_scope_conflict".into(),
            ));
        }
    }
    Ok((clause, params))
}

fn candidate_count(
    conn: &Connection,
    scope: &FileLibraryScopeV2,
    selection: &[String],
) -> Result<i64, DbError> {
    let (clause, params) = candidate_filter(conn, scope, selection)?;
    conn.query_row(
        &format!("SELECT COUNT(*) FROM files f WHERE {clause}"),
        params_from_iter(params.iter()),
        |row| row.get(0),
    )
    .map_err(DbError::from)
}

fn for_each_candidate<F>(
    conn: &Connection,
    scope: &FileLibraryScopeV2,
    selection: &[String],
    limit: Option<usize>,
    mut callback: F,
) -> Result<(), DbError>
where
    F: FnMut(Candidate) -> Result<(), DbError>,
{
    let (clause, mut params) = candidate_filter(conn, scope, selection)?;
    let limit_sql = limit.map(|_| " LIMIT ?").unwrap_or("");
    if let Some(limit) = limit {
        params.push(SqlValue::Integer(limit as i64));
    }
    let sql = format!(
        "SELECT f.id, f.path, f.name, f.extension, f.size, f.mtime, f.is_dir,
                f.content_hash,
                (SELECT sr.id FROM scan_roots sr WHERE sr.source_kind='file_library'
                 AND (f.path=sr.normalized_path
                      OR f.path LIKE sr.normalized_path || '/%'
                      OR f.path LIKE sr.normalized_path || '\\%')
                 ORDER BY length(sr.normalized_path) DESC LIMIT 1)
         FROM files f WHERE {clause} ORDER BY f.id{limit_sql}"
    );
    let mut stmt = conn.prepare(&sql)?;
    let mut rows = stmt.query(params_from_iter(params.iter()))?;
    while let Some(row) = rows.next()? {
        let candidate = Candidate {
            id: row.get(0)?,
            path: row.get(1)?,
            name: row.get(2)?,
            extension: row.get(3)?,
            size: row.get(4)?,
            mtime: row.get(5)?,
            is_dir: row.get::<_, i64>(6)? != 0,
            content_hash: row.get(7)?,
            root_id: row.get::<_, Option<String>>(8)?.unwrap_or_default(),
        };
        if !candidate.root_id.is_empty() {
            callback(candidate)?;
        }
    }
    Ok(())
}

fn candidate_stream_fingerprint(
    conn: &Connection,
    scope: &FileLibraryScopeV2,
    selection: &[String],
    policies: &[Policy],
) -> Result<String, DbError> {
    let mut hasher = Hasher::new();
    for_each_candidate(conn, scope, selection, None, |candidate| {
        let policy = policies
            .iter()
            .find(|policy| policy.dto.root_id == candidate.root_id)
            .map(|policy| &policy.dto);
        let classified = classify_candidate(&candidate, policy);
        let value = serde_json::to_vec(&serde_json::json!({
            "id": candidate.id,
            "rootId": candidate.root_id,
            "path": candidate.path,
            "size": candidate.size,
            "mtime": candidate.mtime,
            "isDir": candidate.is_dir,
            "contentHash": candidate.content_hash,
            "extension": candidate.extension,
            "status": classified.status,
            "extractorFamily": classified.extractor_family,
            "reason": classified.reason,
        }))?;
        hasher.update(&(value.len() as u64).to_le_bytes());
        hasher.update(&value);
        Ok(())
    })?;
    Ok(hasher.finalize().to_hex().to_string())
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

/// Re-check every mutable authority immediately before opening a source file.
/// The preview is only a user-facing snapshot; it is never an authorization to
/// read a path later.  A changed library/root/policy/watcher/source identity
/// therefore fails closed before `extract_candidate` is allowed to open bytes.
fn revalidate_content_boundary(
    conn: &Connection,
    candidate: &Candidate,
    expected_library_revision: i64,
    expected_root_revision: i64,
    expected_policy_revision: i64,
    policy: &ContentScopePolicyDto,
) -> Result<String, DbError> {
    if current_library_revision(conn)? != expected_library_revision {
        return Err(DbError::Validation(
            "content_library_revision_conflict".into(),
        ));
    }
    let root = conn
        .query_row(
            "SELECT normalized_path, enabled, health_status, revision,
                    needs_reconciliation, watcher_revision,
                    watcher_applied_revision, watcher_rule_recovery_required
             FROM scan_roots
             WHERE id=?1 AND source_kind='file_library'",
            params![candidate.root_id.as_str()],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, i64>(3)?,
                    row.get::<_, i64>(4)?,
                    row.get::<_, i64>(5)?,
                    row.get::<_, i64>(6)?,
                    row.get::<_, i64>(7)?,
                ))
            },
        )
        .optional()?;
    let Some((
        root_path,
        enabled,
        health_status,
        root_revision,
        needs_reconciliation,
        watcher_revision,
        watcher_applied_revision,
        watcher_rule_recovery_required,
    )) = root
    else {
        return Err(DbError::Validation("content_root_missing".into()));
    };
    if enabled == 0
        || health_status != "healthy"
        || needs_reconciliation != 0
        || watcher_rule_recovery_required != 0
        || watcher_revision != watcher_applied_revision
        || root_revision != expected_root_revision
        || policy.root_revision != expected_root_revision
        || policy.policy_revision != expected_policy_revision
        || !policy.enabled
        || !policy.local_allowed
    {
        return Err(DbError::Validation("content_scope_stale_or_blocked".into()));
    }

    let file_identity = conn
        .query_row(
            "SELECT path, size, mtime, is_dir, content_hash, is_stale
             FROM files WHERE id=?1",
            params![candidate.id.as_str()],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, i64>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, i64>(5)?,
                ))
            },
        )
        .optional()?;
    let Some((path, size, mtime, is_dir, content_hash, is_stale)) = file_identity else {
        return Err(DbError::Validation("library_file_unavailable".into()));
    };
    if is_stale != 0
        || path != candidate.path
        || size != candidate.size
        || mtime != candidate.mtime
        || is_dir != bool_i64(candidate.is_dir)
        || (is_valid_content_hash(&content_hash)
            && is_valid_content_hash(&candidate.content_hash)
            && !content_hash.eq_ignore_ascii_case(&candidate.content_hash))
    {
        return Err(DbError::Validation(
            "content_source_identity_changed".into(),
        ));
    }

    let canonical = std::fs::canonicalize(&candidate.path)
        .map_err(|_| DbError::Validation("content_source_unavailable".into()))?;
    let canonical_root = std::fs::canonicalize(&root_path)
        .map_err(|_| DbError::Validation("content_root_unavailable".into()))?;
    if !canonical.starts_with(&canonical_root) || !canonical.is_file() {
        return Err(DbError::Validation(
            "content_symlink_traversal_blocked".into(),
        ));
    }
    Ok(root_path)
}

fn extract_candidate(
    candidate: &Candidate,
    policy: &ContentScopePolicyDto,
    root_path: &str,
) -> Result<Extraction, DbError> {
    extract_candidate_with_pdf_hook(candidate, policy, root_path, None, None, None)
}

fn extract_candidate_with_pdf_hook(
    candidate: &Candidate,
    policy: &ContentScopePolicyDto,
    root_path: &str,
    pdf_work_hook: Option<&dyn Fn()>,
    pdf_cancel: Option<&AtomicBool>,
    pdf_deadline_after: Option<Duration>,
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
        "pdf" => match pdf_work_hook {
            Some(hook) => pdf_text_extraction_with_limits_and_hook(
                &source_bytes,
                policy,
                Instant::now() + pdf_deadline_after.unwrap_or_else(|| Duration::from_secs(2)),
                pdf_cancel,
                Some(hook),
            ),
            None => pdf_text_extraction(source_bytes, policy),
        },
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

fn should_publish_failed_pdf_extraction(extraction: &Extraction) -> bool {
    !(extraction.family == "pdf_text"
        && matches!(
            extraction.reason.as_deref(),
            Some("content_extractor_timeout") | Some("content_extractor_cancelled")
        ))
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
    let mut reader = ReaderBuilder::new()
        .has_headers(false)
        .flexible(true)
        .from_reader(bytes.as_slice());
    let mut rows = Vec::new();
    let mut rows_truncated = false;
    for (index, record) in reader.records().enumerate() {
        let record = record.map_err(|_| DbError::Validation("content_csv_invalid".into()))?;
        if index >= policy.max_rows as usize {
            rows_truncated = true;
            break;
        }
        rows.push(record.iter().map(str::trim).collect::<Vec<_>>().join("\t"));
    }
    let rows = rows.join("\n");
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
    pdf_text_extraction_with_limits(
        &bytes,
        policy,
        Instant::now() + Duration::from_secs(2),
        None,
    )
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PdfStop {
    Timeout,
    Cancelled,
    Invalid,
    Limit(&'static str),
}

struct PdfTextAccumulator {
    text: String,
    max_chars: usize,
    emitted_chars: usize,
    truncated: bool,
}

impl PdfTextAccumulator {
    fn new(max_chars: usize) -> Self {
        Self {
            text: String::new(),
            max_chars,
            emitted_chars: 0,
            truncated: false,
        }
    }

    fn push_char(&mut self, value: char) {
        if self.emitted_chars < self.max_chars {
            self.text.push(value);
            self.emitted_chars = self.emitted_chars.saturating_add(1);
        } else {
            self.truncated = true;
        }
    }

    fn push_bytes(&mut self, bytes: &[u8]) {
        if bytes.starts_with(&[0xfe, 0xff]) && bytes.len() >= 4 {
            for chunk in bytes[2..].chunks_exact(2) {
                if let Some(character) =
                    char::from_u32(u16::from_be_bytes([chunk[0], chunk[1]]) as u32)
                {
                    self.push_char(character);
                }
            }
        } else {
            for character in String::from_utf8_lossy(bytes).chars() {
                self.push_char(character);
            }
        }
    }

    fn push_mapped_bytes(&mut self, bytes: &[u8], cmap: &HashMap<Vec<u8>, String>) {
        if bytes.len() == 1 && bytes[0] == 0 && !cmap.is_empty() {
            return;
        }
        if bytes.len() >= 4
            && bytes.len().is_multiple_of(2)
            && bytes.chunks_exact(2).all(|chunk| chunk[0] == 0)
        {
            for chunk in bytes.chunks_exact(2) {
                self.push_char(char::from(chunk[1]));
            }
            return;
        }
        if cmap.is_empty() {
            self.push_bytes(bytes);
            return;
        }
        let mut index = 0_usize;
        while index < bytes.len() {
            let mut matched = None;
            for width in (1..=4).rev() {
                if let Some(value) = bytes.get(index..index.saturating_add(width)) {
                    if let Some(mapped) = cmap.get(value) {
                        matched = Some((width, mapped));
                        break;
                    }
                }
            }
            if let Some((width, mapped)) = matched {
                for character in mapped.chars() {
                    self.push_char(character);
                }
                index += width;
            } else {
                // Most application PDFs use fixed-width two-byte glyph IDs.
                // A zero high byte is a transport marker, not user text.
                if bytes[index] == 0 && bytes.get(index + 1).is_some() {
                    index += 1;
                    continue;
                }
                self.push_bytes(&bytes[index..index + 1]);
                index += 1;
            }
        }
    }
}

fn pdf_text_extraction_with_limits(
    bytes: &[u8],
    policy: &ContentScopePolicyDto,
    deadline: Instant,
    cancel: Option<&AtomicBool>,
) -> Result<Extraction, DbError> {
    pdf_text_extraction_with_limits_and_hook(bytes, policy, deadline, cancel, None)
}

fn pdf_text_extraction_with_limits_and_hook(
    bytes: &[u8],
    policy: &ContentScopePolicyDto,
    deadline: Instant,
    cancel: Option<&AtomicBool>,
    work_hook: Option<&dyn Fn()>,
) -> Result<Extraction, DbError> {
    let blocked = |reason: &str| {
        Ok(Extraction {
            family: "pdf_text".into(),
            text: String::new(),
            source_hash: String::new(),
            truncated: false,
            status: "blocked",
            reason: Some(reason.into()),
        })
    };
    if bytes.len() < 5 || !bytes.starts_with(b"%PDF-") {
        return blocked("content_pdf_invalid");
    }
    let mut accumulator = PdfTextAccumulator::new(policy.max_chars.max(0) as usize);
    let mut objects = 0_usize;
    let mut pages = 0_i64;
    let mut decompressed = 0_usize;
    let mut streams = Vec::<Vec<u8>>::new();
    let mut offset = 5_usize;
    let mut work_started = false;
    while offset < bytes.len() {
        let obj_start = match find_pdf_object_start_bounded(bytes, offset, deadline, cancel) {
            Ok(Some(value)) => value,
            Ok(None) => break,
            Err(stop) => return Ok(pdf_stop_extraction(stop)),
        };
        if !work_started {
            if let Some(hook) = work_hook {
                hook();
            }
            work_started = true;
        }
        if let Err(stop) = pdf_budget_check(obj_start, bytes.len(), deadline, cancel) {
            return Ok(pdf_stop_extraction(stop));
        }
        let endobj = match find_pdf_token_bounded(bytes, b"endobj", obj_start + 3, deadline, cancel)
        {
            Ok(Some(value)) => value,
            Ok(None) => break,
            Err(stop) => return Ok(pdf_stop_extraction(stop)),
        };
        objects = objects.saturating_add(1);
        if objects > PDF_MAX_OBJECTS {
            return blocked("content_pdf_object_limit_exceeded");
        }
        let object = &bytes[obj_start..endobj];
        let encrypted = match contains_pdf_token_bounded(object, b"/Encrypt", deadline, cancel) {
            Ok(value) => value,
            Err(stop) => return Ok(pdf_stop_extraction(stop)),
        };
        if encrypted {
            return blocked("content_encrypted_document");
        }
        let is_page = match contains_pdf_type_page_bounded(object, deadline, cancel) {
            Ok(value) => value,
            Err(stop) => return Ok(pdf_stop_extraction(stop)),
        };
        if is_page {
            pages = pages.saturating_add(1);
            if pages > policy.max_pages {
                return blocked("content_pdf_page_limit_exceeded");
            }
        }
        let mut local = 0_usize;
        while let Some(stream_rel) =
            match find_pdf_token_bounded(object, b"stream", local, deadline, cancel) {
                Ok(value) => value,
                Err(stop) => return Ok(pdf_stop_extraction(stop)),
            }
        {
            if let Err(stop) =
                pdf_budget_check(obj_start + stream_rel, bytes.len(), deadline, cancel)
            {
                return Ok(pdf_stop_extraction(stop));
            }
            let data_start = pdf_stream_data_start(object, stream_rel + b"stream".len());
            let endstream =
                match find_pdf_token_bounded(object, b"endstream", data_start, deadline, cancel) {
                    Ok(Some(value)) => value,
                    Ok(None) => return blocked("content_pdf_invalid"),
                    Err(stop) => return Ok(pdf_stop_extraction(stop)),
                };
            let stream = &object[data_start..endstream];
            if stream.len() > policy.max_bytes.max(0) as usize {
                return blocked("content_decompressed_byte_limit_exceeded");
            }
            let dictionary = &object[..stream_rel];
            let flate =
                match contains_pdf_token_bounded(dictionary, b"/FlateDecode", deadline, cancel) {
                    Ok(value) => value,
                    Err(stop) => return Ok(pdf_stop_extraction(stop)),
                };
            if flate {
                let mut decoder = ZlibDecoder::new(stream);
                let mut decoded = Vec::new();
                let mut chunk = [0_u8; 8192];
                loop {
                    if let Err(stop) =
                        pdf_budget_check(obj_start + data_start, bytes.len(), deadline, cancel)
                    {
                        return Ok(pdf_stop_extraction(stop));
                    }
                    let read = decoder
                        .read(&mut chunk)
                        .map_err(|_| DbError::Validation("content_pdf_invalid".into()))?;
                    if read == 0 {
                        break;
                    }
                    decompressed = decompressed.saturating_add(read);
                    if decompressed > pdf_decompressed_limit(policy) {
                        return blocked("content_pdf_decompressed_byte_limit_exceeded");
                    }
                    decoded.extend_from_slice(&chunk[..read]);
                    if decoded.len() > pdf_decompressed_limit(policy) {
                        return blocked("content_pdf_decompressed_byte_limit_exceeded");
                    }
                }
                streams.push(decoded);
            } else {
                decompressed = decompressed.saturating_add(stream.len());
                if decompressed > pdf_decompressed_limit(policy) {
                    return blocked("content_pdf_decompressed_byte_limit_exceeded");
                }
                streams.push(stream.to_vec());
            }
            local = endstream.saturating_add(b"endstream".len());
        }
        offset = endobj.saturating_add(b"endobj".len());
    }
    if objects == 0 || pages == 0 {
        return blocked("content_pdf_invalid");
    }
    let mut cmap = HashMap::new();
    let mut cmap_decoded_bytes = 0_usize;
    for stream in &streams {
        let has_bfchar = match find_pdf_token_bounded(stream, b"beginbfchar", 0, deadline, cancel) {
            Ok(value) => value.is_some(),
            Err(stop) => return Ok(pdf_stop_extraction(stop)),
        };
        let has_bfrange = match find_pdf_token_bounded(stream, b"beginbfrange", 0, deadline, cancel)
        {
            Ok(value) => value.is_some(),
            Err(stop) => return Ok(pdf_stop_extraction(stop)),
        };
        if has_bfchar || has_bfrange {
            if let Err(stop) =
                parse_pdf_cmap(stream, &mut cmap, &mut cmap_decoded_bytes, deadline, cancel)
            {
                return Ok(pdf_stop_extraction(stop));
            }
        }
    }
    for stream in &streams {
        if let Err(stop) = parse_pdf_text_stream(stream, &mut accumulator, &cmap, deadline, cancel)
        {
            return Ok(pdf_stop_extraction(stop));
        }
    }
    if accumulator.text.trim().is_empty() {
        return blocked("ocr_only_or_no_text_layer");
    }
    Ok(Extraction {
        family: "pdf_text".into(),
        text: accumulator.text,
        source_hash: String::new(),
        truncated: accumulator.truncated,
        status: "completed",
        reason: None,
    })
}

fn pdf_stop_extraction(stop: PdfStop) -> Extraction {
    let (status, reason) = match stop {
        PdfStop::Timeout => ("failed", "content_extractor_timeout"),
        PdfStop::Cancelled => ("failed", "content_extractor_cancelled"),
        PdfStop::Invalid => ("blocked", "content_pdf_invalid"),
        PdfStop::Limit(reason) => ("blocked", reason),
    };
    Extraction {
        family: "pdf_text".into(),
        text: String::new(),
        source_hash: String::new(),
        truncated: false,
        status,
        reason: Some(reason.into()),
    }
}

fn pdf_decompressed_limit(policy: &ContentScopePolicyDto) -> usize {
    (policy.max_bytes.max(1024) as usize)
        .saturating_mul(4)
        .min(PDF_MAX_DECOMPRESSED_BYTES)
}

fn pdf_budget_check(
    offset: usize,
    length: usize,
    deadline: Instant,
    cancel: Option<&AtomicBool>,
) -> Result<(), PdfStop> {
    if cancel.is_some_and(|value| value.load(Ordering::Relaxed)) {
        return Err(PdfStop::Cancelled);
    }
    if Instant::now() > deadline {
        return Err(PdfStop::Timeout);
    }
    let _ = (offset, length);
    Ok(())
}

fn find_pdf_object_start_bounded(
    bytes: &[u8],
    from: usize,
    deadline: Instant,
    cancel: Option<&AtomicBool>,
) -> Result<Option<usize>, PdfStop> {
    let mut index = from;
    while index + 3 < bytes.len() {
        if index
            .saturating_sub(from)
            .is_multiple_of(PDF_SCAN_CHECK_BYTES)
        {
            pdf_budget_check(index, bytes.len(), deadline, cancel)?;
        }
        if bytes[index].is_ascii_digit()
            && (index == 0 || bytes[index - 1].is_ascii_whitespace())
            && bytes[index + 1..].windows(3).next().is_some()
        {
            let mut cursor = index;
            while cursor < bytes.len() && bytes[cursor].is_ascii_digit() {
                if cursor
                    .saturating_sub(from)
                    .is_multiple_of(PDF_SCAN_CHECK_BYTES)
                {
                    pdf_budget_check(cursor, bytes.len(), deadline, cancel)?;
                }
                cursor += 1;
            }
            while cursor < bytes.len() && bytes[cursor].is_ascii_whitespace() {
                if cursor
                    .saturating_sub(from)
                    .is_multiple_of(PDF_SCAN_CHECK_BYTES)
                {
                    pdf_budget_check(cursor, bytes.len(), deadline, cancel)?;
                }
                cursor += 1;
            }
            let generation_start = cursor;
            while cursor < bytes.len() && bytes[cursor].is_ascii_digit() {
                if cursor
                    .saturating_sub(from)
                    .is_multiple_of(PDF_SCAN_CHECK_BYTES)
                {
                    pdf_budget_check(cursor, bytes.len(), deadline, cancel)?;
                }
                cursor += 1;
            }
            if cursor > generation_start {
                while cursor < bytes.len() && bytes[cursor].is_ascii_whitespace() {
                    if cursor
                        .saturating_sub(from)
                        .is_multiple_of(PDF_SCAN_CHECK_BYTES)
                    {
                        pdf_budget_check(cursor, bytes.len(), deadline, cancel)?;
                    }
                    cursor += 1;
                }
                if bytes.get(cursor..cursor + 3) == Some(b"obj") {
                    return Ok(Some(index));
                }
            }
        }
        index += 1;
    }
    pdf_budget_check(bytes.len(), bytes.len(), deadline, cancel)?;
    Ok(None)
}

fn find_pdf_token_bounded(
    bytes: &[u8],
    token: &[u8],
    from: usize,
    deadline: Instant,
    cancel: Option<&AtomicBool>,
) -> Result<Option<usize>, PdfStop> {
    if token.is_empty() {
        return Ok(Some(from.min(bytes.len())));
    }
    let end = bytes.len().saturating_sub(token.len());
    let mut index = from.min(bytes.len());
    while index <= end {
        if index
            .saturating_sub(from)
            .is_multiple_of(PDF_SCAN_CHECK_BYTES)
        {
            pdf_budget_check(index, bytes.len(), deadline, cancel)?;
        }
        if bytes.get(index..index + token.len()) == Some(token) {
            return Ok(Some(index));
        }
        index = index.saturating_add(1);
    }
    pdf_budget_check(bytes.len(), bytes.len(), deadline, cancel)?;
    Ok(None)
}

fn contains_pdf_token_bounded(
    bytes: &[u8],
    token: &[u8],
    deadline: Instant,
    cancel: Option<&AtomicBool>,
) -> Result<bool, PdfStop> {
    Ok(find_pdf_token_bounded(bytes, token, 0, deadline, cancel)?.is_some())
}

fn contains_pdf_type_page_bounded(
    bytes: &[u8],
    deadline: Instant,
    cancel: Option<&AtomicBool>,
) -> Result<bool, PdfStop> {
    let Some(type_start) = find_pdf_token_bounded(bytes, b"/Type", 0, deadline, cancel)? else {
        return Ok(false);
    };
    let remainder = &bytes[type_start + b"/Type".len()..];
    let Some(page_start) = find_pdf_token_bounded(remainder, b"/Page", 0, deadline, cancel)? else {
        return Ok(false);
    };
    Ok(remainder
        .get(page_start + b"/Page".len())
        .is_none_or(|character| !character.is_ascii_alphabetic()))
}

fn pdf_stream_data_start(bytes: &[u8], mut index: usize) -> usize {
    while index < bytes.len() && (bytes[index] == b' ' || bytes[index] == b'\t') {
        index += 1;
    }
    if bytes.get(index) == Some(&b'\r') {
        index += 1;
        if bytes.get(index) == Some(&b'\n') {
            index += 1;
        }
    } else if bytes.get(index) == Some(&b'\n') {
        index += 1;
    }
    index
}

fn parse_pdf_text_stream(
    stream: &[u8],
    accumulator: &mut PdfTextAccumulator,
    cmap: &HashMap<Vec<u8>, String>,
    deadline: Instant,
    cancel: Option<&AtomicBool>,
) -> Result<(), PdfStop> {
    let mut index = 0_usize;
    while index < stream.len() {
        if index.is_multiple_of(PDF_SCAN_CHECK_BYTES) {
            pdf_budget_check(index, stream.len(), deadline, cancel)?;
        }
        match stream[index] {
            b'(' => {
                index += 1;
                let mut depth = 1_i32;
                let mut escaped = false;
                let mut literal = Vec::new();
                while index < stream.len() && depth > 0 {
                    if index.is_multiple_of(PDF_SCAN_CHECK_BYTES) {
                        pdf_budget_check(index, stream.len(), deadline, cancel)?;
                    }
                    let character = stream[index];
                    if escaped {
                        let decoded = match character {
                            b'n' => b'\n',
                            b'r' => b'\r',
                            b't' => b'\t',
                            b'b' => 8,
                            b'f' => 12,
                            value => value,
                        };
                        if literal.len() >= PDF_MAX_TEMP_BUFFER_BYTES {
                            return Err(PdfStop::Limit(
                                "content_pdf_literal_buffer_limit_exceeded",
                            ));
                        }
                        literal.push(decoded);
                        escaped = false;
                    } else if character == b'\\' {
                        escaped = true;
                    } else if character == b'(' {
                        depth += 1;
                        if literal.len() >= PDF_MAX_TEMP_BUFFER_BYTES {
                            return Err(PdfStop::Limit(
                                "content_pdf_literal_buffer_limit_exceeded",
                            ));
                        }
                        literal.push(b'(');
                    } else if character == b')' {
                        depth -= 1;
                        if depth > 0 {
                            if literal.len() >= PDF_MAX_TEMP_BUFFER_BYTES {
                                return Err(PdfStop::Limit(
                                    "content_pdf_literal_buffer_limit_exceeded",
                                ));
                            }
                            literal.push(b')');
                        }
                    } else {
                        if literal.len() >= PDF_MAX_TEMP_BUFFER_BYTES {
                            return Err(PdfStop::Limit(
                                "content_pdf_literal_buffer_limit_exceeded",
                            ));
                        }
                        literal.push(character);
                    }
                    index += 1;
                }
                if depth != 0 {
                    return Err(PdfStop::Invalid);
                }
                accumulator.push_mapped_bytes(&literal, cmap);
            }
            b'<' if stream.get(index + 1) != Some(&b'<') => {
                index += 1;
                let mut high = None;
                let mut decoded = Vec::new();
                while index < stream.len() && stream[index] != b'>' {
                    if index.is_multiple_of(PDF_SCAN_CHECK_BYTES) {
                        pdf_budget_check(index, stream.len(), deadline, cancel)?;
                    }
                    let value = stream[index];
                    if value.is_ascii_hexdigit() {
                        let nibble = pdf_hex_nibble(value).ok_or(PdfStop::Invalid)?;
                        if let Some(first) = high.take() {
                            if decoded.len() >= PDF_MAX_TEMP_BUFFER_BYTES {
                                return Err(PdfStop::Limit(
                                    "content_pdf_hex_buffer_limit_exceeded",
                                ));
                            }
                            decoded.push((first << 4) | nibble);
                        } else {
                            high = Some(nibble);
                        }
                    }
                    index += 1;
                }
                if stream.get(index) != Some(&b'>') {
                    return Err(PdfStop::Invalid);
                }
                if let Some(first) = high {
                    if decoded.len() >= PDF_MAX_TEMP_BUFFER_BYTES {
                        return Err(PdfStop::Limit("content_pdf_hex_buffer_limit_exceeded"));
                    }
                    decoded.push(first << 4);
                }
                accumulator.push_mapped_bytes(&decoded, cmap);
            }
            _ => index += 1,
        }
    }
    Ok(())
}

fn parse_pdf_cmap(
    stream: &[u8],
    cmap: &mut HashMap<Vec<u8>, String>,
    decoded_bytes: &mut usize,
    deadline: Instant,
    cancel: Option<&AtomicBool>,
) -> Result<(), PdfStop> {
    if stream.len() > PDF_MAX_CMAP_DECODED_BYTES {
        return Err(PdfStop::Limit(
            "content_pdf_cmap_decoded_byte_limit_exceeded",
        ));
    }
    let source = String::from_utf8_lossy(stream);
    let mut mode = None;
    let mut scanned = 0_usize;
    for line in source.lines() {
        scanned = scanned.saturating_add(line.len());
        if scanned.is_multiple_of(PDF_SCAN_CHECK_BYTES)
            || scanned.saturating_sub(line.len()) < PDF_SCAN_CHECK_BYTES
        {
            pdf_budget_check(scanned, stream.len(), deadline, cancel)?;
        }
        if contains_pdf_token_bounded(line.as_bytes(), b"beginbfchar", deadline, cancel)? {
            mode = Some("char");
            continue;
        }
        if contains_pdf_token_bounded(line.as_bytes(), b"beginbfrange", deadline, cancel)? {
            mode = Some("range");
            continue;
        }
        if contains_pdf_token_bounded(line.as_bytes(), b"endbfchar", deadline, cancel)?
            || contains_pdf_token_bounded(line.as_bytes(), b"endbfrange", deadline, cancel)?
        {
            mode = None;
            continue;
        }
        let Some(mode) = mode else { continue };
        if line.len() > PDF_MAX_TEMP_BUFFER_BYTES {
            return Err(PdfStop::Limit(
                "content_pdf_cmap_temporary_buffer_limit_exceeded",
            ));
        }
        let tokens = line
            .split_whitespace()
            .filter_map(|token| {
                let trimmed = token.trim_matches(|value| value == '<' || value == '>');
                (!trimmed.is_empty()).then(|| pdf_hex_bytes(trimmed))
            })
            .collect::<Option<Vec<_>>>();
        let Some(tokens) = tokens else { continue };
        match (mode, tokens.as_slice()) {
            ("char", [source, target, ..]) => {
                if let Some(text) = pdf_unicode_string(target) {
                    insert_pdf_cmap_entry(cmap, decoded_bytes, source.clone(), text)?;
                }
            }
            ("range", [start, end, target, ..]) if start.len() == end.len() => {
                let start_value = pdf_big_endian_value(start);
                let end_value = pdf_big_endian_value(end);
                if let Some(base) = pdf_unicode_string(target) {
                    if start_value > end_value || end_value - start_value > 1024 {
                        continue;
                    }
                    let base_value = base.chars().next().map(|value| value as u32).unwrap_or(0);
                    for value in start_value..=end_value {
                        pdf_budget_check(value as usize, end_value as usize, deadline, cancel)?;
                        let mut key = value.to_be_bytes().to_vec();
                        key = key[key.len().saturating_sub(start.len())..].to_vec();
                        if let Some(character) = char::from_u32(base_value + value - start_value) {
                            insert_pdf_cmap_entry(cmap, decoded_bytes, key, character.to_string())?;
                        }
                    }
                }
            }
            _ => {}
        }
    }
    pdf_budget_check(stream.len(), stream.len(), deadline, cancel)
}

fn insert_pdf_cmap_entry(
    cmap: &mut HashMap<Vec<u8>, String>,
    decoded_bytes: &mut usize,
    key: Vec<u8>,
    value: String,
) -> Result<(), PdfStop> {
    if cmap.len() >= PDF_MAX_CMAP_ENTRIES || key.len() > PDF_MAX_TEMP_BUFFER_BYTES {
        return Err(PdfStop::Limit("content_pdf_cmap_entry_limit_exceeded"));
    }
    let value_bytes = value.len();
    if (*decoded_bytes).saturating_add(value_bytes) > PDF_MAX_CMAP_DECODED_BYTES {
        return Err(PdfStop::Limit(
            "content_pdf_cmap_decoded_byte_limit_exceeded",
        ));
    }
    if cmap.insert(key, value).is_none() {
        *decoded_bytes = (*decoded_bytes).saturating_add(value_bytes);
    }
    Ok(())
}

fn pdf_hex_bytes(value: &str) -> Option<Vec<u8>> {
    if !value.len().is_multiple_of(2)
        || value.is_empty()
        || value.len() / 2 > PDF_MAX_TEMP_BUFFER_BYTES
    {
        return None;
    }
    let mut bytes = Vec::with_capacity(value.len() / 2);
    let chars = value.as_bytes();
    for pair in chars.chunks_exact(2) {
        bytes.push((pdf_hex_nibble(pair[0])? << 4) | pdf_hex_nibble(pair[1])?);
    }
    Some(bytes)
}

fn pdf_big_endian_value(value: &[u8]) -> u32 {
    value
        .iter()
        .fold(0_u32, |current, byte| (current << 8) | u32::from(*byte))
}

fn pdf_unicode_string(value: &[u8]) -> Option<String> {
    if value.len() > PDF_MAX_TEMP_BUFFER_BYTES {
        return None;
    }
    if value.starts_with(&[0xfe, 0xff]) {
        let units = value[2..]
            .chunks_exact(2)
            .map(|chunk| u16::from_be_bytes([chunk[0], chunk[1]]))
            .collect::<Vec<_>>();
        String::from_utf16(&units).ok()
    } else if value.len() >= 2 && value.len().is_multiple_of(2) {
        let units = value
            .chunks_exact(2)
            .map(|chunk| u16::from_be_bytes([chunk[0], chunk[1]]))
            .collect::<Vec<_>>();
        String::from_utf16(&units).ok()
    } else {
        Some(String::from_utf8_lossy(value).into_owned())
    }
}

fn pdf_hex_nibble(value: u8) -> Option<u8> {
    match value {
        b'0'..=b'9' => Some(value - b'0'),
        b'a'..=b'f' => Some(value - b'a' + 10),
        b'A'..=b'F' => Some(value - b'A' + 10),
        _ => None,
    }
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
    for index in 0..archive.len() {
        let entry = archive
            .by_index(index)
            .map_err(|_| DbError::Validation("content_office_container_invalid".into()))?;
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
    }
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
    let deadline = Instant::now() + Duration::from_secs(2);
    let shared_strings = if family == "xlsx" {
        if let Ok(mut entry) = archive.by_name("xl/sharedStrings.xml") {
            let xml = match read_zip_entry_bounded(&mut entry, policy.max_bytes as u64, deadline) {
                Ok(xml) => xml,
                Err(error) => {
                    let code = content_error_code(&error);
                    return Ok(Extraction {
                        family: family.into(),
                        text: String::new(),
                        source_hash: String::new(),
                        truncated: false,
                        status: if code == "content_extractor_timeout" {
                            "failed"
                        } else {
                            "blocked"
                        },
                        reason: Some(code),
                    });
                }
            };
            match parse_xlsx_shared_strings(&xml) {
                Ok(values) => values,
                Err(_) => {
                    return Ok(Extraction {
                        family: family.into(),
                        text: String::new(),
                        source_hash: String::new(),
                        truncated: false,
                        status: "blocked",
                        reason: Some("content_office_xml_invalid".into()),
                    });
                }
            }
        } else {
            Vec::new()
        }
    } else {
        Vec::new()
    };
    let mut text = String::new();
    let mut decompressed_bytes = 0_u64;
    let mut total_rows = 0_i64;
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
        let Ok(mut entry) = archive.by_name(name) else {
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
        let xml = match read_zip_entry_bounded(&mut entry, policy.max_bytes as u64, deadline) {
            Ok(xml) => xml,
            Err(error) => {
                let code = content_error_code(&error);
                return Ok(Extraction {
                    family: family.into(),
                    text: String::new(),
                    source_hash: String::new(),
                    truncated: false,
                    status: if code == "content_extractor_timeout" {
                        "failed"
                    } else {
                        "blocked"
                    },
                    reason: Some(code),
                });
            }
        };
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
        let parsed = if family == "xlsx" && name.starts_with("xl/worksheets/") {
            parse_xlsx_sheet_text(&xml, &shared_strings, policy.max_rows)
        } else {
            parse_xml_text(&xml).map(|text| (text, 0))
        };
        let (part_text, rows) = match parsed {
            Ok(value) => value,
            Err(_) => {
                return Ok(Extraction {
                    family: family.into(),
                    text: String::new(),
                    source_hash: String::new(),
                    truncated: false,
                    status: "blocked",
                    reason: Some("content_office_xml_invalid".into()),
                });
            }
        };
        total_rows = total_rows.saturating_add(rows);
        if total_rows > policy.max_rows {
            return Ok(Extraction {
                family: family.into(),
                text: String::new(),
                source_hash: String::new(),
                truncated: false,
                status: "blocked",
                reason: Some("content_row_limit_exceeded".into()),
            });
        }
        text.push_str(&part_text);
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

fn read_zip_entry_bounded<R: Read>(
    reader: &mut R,
    max_bytes: u64,
    deadline: Instant,
) -> Result<Vec<u8>, DbError> {
    let mut bytes = Vec::new();
    let mut chunk = [0_u8; 32 * 1024];
    loop {
        if Instant::now() > deadline {
            return Err(DbError::Validation("content_extractor_timeout".into()));
        }
        let read = reader
            .read(&mut chunk)
            .map_err(|_| DbError::Validation("content_archive_read_failed".into()))?;
        if read == 0 {
            break;
        }
        bytes.extend_from_slice(&chunk[..read]);
        if bytes.len() as u64 > max_bytes {
            return Err(DbError::Validation(
                "content_decompressed_byte_limit_exceeded".into(),
            ));
        }
    }
    Ok(bytes)
}

fn parse_xml_text(xml: &[u8]) -> Result<String, DbError> {
    let mut reader = XmlReader::from_reader(Cursor::new(xml));
    reader.config_mut().trim_text(false);
    let mut buffer = Vec::new();
    let mut text = String::new();
    let mut depth = 0_i32;
    loop {
        match reader.read_event_into(&mut buffer) {
            Ok(Event::Start(_)) => depth += 1,
            Ok(Event::End(_)) => {
                if depth == 0 {
                    return Err(DbError::Validation("content_office_xml_invalid".into()));
                }
                depth -= 1;
            }
            Ok(Event::Text(value)) => {
                let value = value
                    .xml10_content()
                    .map_err(|_| DbError::Validation("content_office_xml_invalid".into()))?;
                let value = unescape_xml(value.as_ref())
                    .map_err(|_| DbError::Validation("content_office_xml_invalid".into()))?;
                text.push_str(&value);
                text.push(' ');
            }
            Ok(Event::CData(value)) => {
                text.push_str(&String::from_utf8_lossy(&value));
                text.push(' ');
            }
            Ok(Event::Comment(value)) => {
                let value = String::from_utf8_lossy(&value);
                if !value.trim().is_empty() {
                    text.push_str(&value);
                    text.push(' ');
                }
            }
            Ok(Event::GeneralRef(value)) => {
                let reference = format!(
                    "&{};",
                    value
                        .decode()
                        .map_err(|_| DbError::Validation("content_office_xml_invalid".into()))?
                );
                let value = unescape_xml(&reference)
                    .map_err(|_| DbError::Validation("content_office_xml_invalid".into()))?;
                text.push_str(&value);
                text.push(' ');
            }
            Ok(Event::Eof) => {
                if depth != 0 {
                    return Err(DbError::Validation("content_office_xml_invalid".into()));
                }
                break;
            }
            Ok(_) => {}
            Err(_) => return Err(DbError::Validation("content_office_xml_invalid".into())),
        }
        buffer.clear();
    }
    Ok(text)
}

fn parse_xlsx_shared_strings(xml: &[u8]) -> Result<Vec<String>, DbError> {
    let mut reader = XmlReader::from_reader(Cursor::new(xml));
    reader.config_mut().trim_text(false);
    let mut buffer = Vec::new();
    let mut values = Vec::new();
    let mut in_item = false;
    let mut current = String::new();
    let mut depth = 0_i32;
    loop {
        match reader.read_event_into(&mut buffer) {
            Ok(Event::Start(event)) if event.local_name().as_ref() == b"si" => {
                depth += 1;
                in_item = true;
                current.clear();
            }
            Ok(Event::End(event)) if event.local_name().as_ref() == b"si" => {
                if depth == 0 {
                    return Err(DbError::Validation("content_office_xml_invalid".into()));
                }
                depth -= 1;
                if in_item {
                    values.push(std::mem::take(&mut current));
                }
                in_item = false;
            }
            Ok(Event::Start(_)) => depth += 1,
            Ok(Event::End(_)) => {
                if depth == 0 {
                    return Err(DbError::Validation("content_office_xml_invalid".into()));
                }
                depth -= 1;
            }
            Ok(Event::Text(value)) if in_item => {
                let value = value
                    .xml10_content()
                    .map_err(|_| DbError::Validation("content_office_xml_invalid".into()))?;
                let value = unescape_xml(value.as_ref())
                    .map_err(|_| DbError::Validation("content_office_xml_invalid".into()))?;
                current.push_str(&value);
            }
            Ok(Event::CData(value)) if in_item => {
                current.push_str(&String::from_utf8_lossy(&value))
            }
            Ok(Event::GeneralRef(value)) if in_item => {
                let reference = format!(
                    "&{};",
                    value
                        .decode()
                        .map_err(|_| DbError::Validation("content_office_xml_invalid".into()))?
                );
                current.push_str(
                    &unescape_xml(&reference)
                        .map_err(|_| DbError::Validation("content_office_xml_invalid".into()))?,
                );
            }
            Ok(Event::Eof) => {
                if depth != 0 {
                    return Err(DbError::Validation("content_office_xml_invalid".into()));
                }
                break;
            }
            Ok(_) => {}
            Err(_) => return Err(DbError::Validation("content_office_xml_invalid".into())),
        }
        buffer.clear();
    }
    Ok(values)
}

fn parse_xlsx_sheet_text(
    xml: &[u8],
    shared_strings: &[String],
    max_rows: i64,
) -> Result<(String, i64), DbError> {
    let mut reader = XmlReader::from_reader(Cursor::new(xml));
    reader.config_mut().trim_text(false);
    let mut buffer = Vec::new();
    let mut text = String::new();
    let mut rows = 0_i64;
    let mut in_cell = false;
    let mut cell_type = String::new();
    let mut cell_value = String::new();
    let mut in_value = false;
    let mut depth = 0_i32;
    loop {
        match reader.read_event_into(&mut buffer) {
            Ok(Event::Start(event)) if event.local_name().as_ref() == b"row" => {
                depth += 1;
                rows += 1;
                if rows > max_rows {
                    return Ok((String::new(), rows));
                }
            }
            Ok(Event::Start(event)) if event.local_name().as_ref() == b"c" => {
                depth += 1;
                in_cell = true;
                cell_type.clear();
                cell_value.clear();
                for attribute in event.attributes().flatten() {
                    if attribute.key.as_ref() == b"t" {
                        cell_type = String::from_utf8_lossy(&attribute.value).into_owned();
                    }
                }
            }
            Ok(Event::Start(event)) if event.local_name().as_ref() == b"v" => {
                depth += 1;
                in_value = true;
            }
            Ok(Event::Start(event)) if event.local_name().as_ref() == b"t" && in_cell => {
                depth += 1;
                in_value = true;
            }
            Ok(Event::End(event))
                if event.local_name().as_ref() == b"v" || event.local_name().as_ref() == b"t" =>
            {
                if depth == 0 {
                    return Err(DbError::Validation("content_office_xml_invalid".into()));
                }
                depth -= 1;
                in_value = false;
            }
            Ok(Event::End(event)) if event.local_name().as_ref() == b"c" => {
                if depth == 0 {
                    return Err(DbError::Validation("content_office_xml_invalid".into()));
                }
                depth -= 1;
                if in_cell {
                    let value = if cell_type == "s" {
                        cell_value
                            .trim()
                            .parse::<usize>()
                            .ok()
                            .and_then(|index| shared_strings.get(index).cloned())
                            .unwrap_or_default()
                    } else {
                        cell_value.clone()
                    };
                    if !value.is_empty() {
                        text.push_str(value.trim());
                        text.push('\t');
                    }
                }
                in_cell = false;
                in_value = false;
            }
            Ok(Event::Start(_)) => depth += 1,
            Ok(Event::End(_)) => {
                if depth == 0 {
                    return Err(DbError::Validation("content_office_xml_invalid".into()));
                }
                depth -= 1;
            }
            Ok(Event::Text(value)) if in_cell => {
                let value = value
                    .xml10_content()
                    .map_err(|_| DbError::Validation("content_office_xml_invalid".into()))?;
                let value = unescape_xml(value.as_ref())
                    .map_err(|_| DbError::Validation("content_office_xml_invalid".into()))?;
                cell_value.push_str(&value);
            }
            Ok(Event::CData(value)) if in_cell && in_value => {
                cell_value.push_str(&String::from_utf8_lossy(&value));
            }
            Ok(Event::GeneralRef(value)) if in_cell => {
                let reference = format!(
                    "&{};",
                    value
                        .decode()
                        .map_err(|_| DbError::Validation("content_office_xml_invalid".into()))?
                );
                cell_value.push_str(
                    &unescape_xml(&reference)
                        .map_err(|_| DbError::Validation("content_office_xml_invalid".into()))?,
                );
            }
            Ok(Event::Eof) => {
                if depth != 0 {
                    return Err(DbError::Validation("content_office_xml_invalid".into()));
                }
                break;
            }
            Ok(_) => {}
            Err(_) => return Err(DbError::Validation("content_office_xml_invalid".into())),
        }
        buffer.clear();
    }
    Ok((text, rows))
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

fn current_content_revision(conn: &Connection) -> Result<i64, DbError> {
    conn.query_row(
        "SELECT revision FROM content_catalog WHERE id=1",
        [],
        |row| row.get(0),
    )
    .map_err(DbError::from)
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

fn is_content_boundary_error(error: &DbError) -> bool {
    let code = content_error_code(error);
    matches!(
        code.as_str(),
        "content_library_revision_conflict"
            | "content_root_missing"
            | "content_scope_stale_or_blocked"
            | "content_symlink_traversal_blocked"
            | "library_file_unavailable"
    )
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
#[derive(Debug)]
struct ContentCursor {
    updated_at: i64,
    id: String,
}

fn encode_content_cursor(
    revision: i64,
    query_fingerprint: &str,
    scope_fingerprint: &str,
    updated_at: i64,
    id: &str,
) -> String {
    format!(
        "v2:{revision}:{query_fingerprint}:{scope_fingerprint}:{updated_at}:{}",
        hex_encode(id.as_bytes())
    )
}

fn decode_content_cursor(
    value: &str,
    expected_query_fingerprint: &str,
    expected_scope_fingerprint: &str,
    expected_revision: i64,
) -> Result<ContentCursor, DbError> {
    let parts = value.split(':').collect::<Vec<_>>();
    if parts.len() != 6 || parts[0] != "v2" {
        return Err(DbError::Validation("content_cursor_invalid".into()));
    }
    let revision = parts[1]
        .parse::<i64>()
        .map_err(|_| DbError::Validation("content_cursor_invalid".into()))?;
    if revision != expected_revision
        || parts[2] != expected_query_fingerprint
        || parts[3] != expected_scope_fingerprint
    {
        return Err(DbError::Validation("content_cursor_stale".into()));
    }
    let updated_at = parts[4]
        .parse::<i64>()
        .map_err(|_| DbError::Validation("content_cursor_invalid".into()))?;
    let id = String::from_utf8(hex_decode(parts[5])?)
        .map_err(|_| DbError::Validation("content_cursor_invalid".into()))?;
    Ok(ContentCursor { updated_at, id })
}

fn hex_encode(value: &[u8]) -> String {
    value.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn hex_decode(value: &str) -> Result<Vec<u8>, DbError> {
    if !value.len().is_multiple_of(2) {
        return Err(DbError::Validation("content_cursor_invalid".into()));
    }
    (0..value.len())
        .step_by(2)
        .map(|index| {
            u8::from_str_radix(&value[index..index + 2], 16)
                .map_err(|_| DbError::Validation("content_cursor_invalid".into()))
        })
        .collect()
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

fn run_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ContentRunDto> {
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
        provider_status: row.get(13)?,
        provider_revision: row.get(14)?,
        provider_completed_at: row.get(15)?,
        error_code: row.get(16)?,
        error_detail: row.get(17)?,
        revision: row.get(18)?,
        updated_at: row.get(19)?,
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
pub fn get_content_catalog_revision<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
) -> Result<i64, String> {
    require_main_window(&window)?;
    db.get_content_catalog_revision()
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
    use std::sync::{atomic::AtomicUsize, Arc, Barrier};
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
        let pdf = pdf_text_extraction(valid_pdf_fixture(), &policy).unwrap();
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
        let page_limited = pdf_text_extraction(valid_pdf_fixture_with_pages(2), &limited).unwrap();
        assert_eq!(
            page_limited.reason.as_deref(),
            Some("content_pdf_page_limit_exceeded")
        );
    }

    fn valid_pdf_fixture() -> Vec<u8> {
        valid_pdf_fixture_with_pages(1)
    }

    fn valid_pdf_fixture_with_pages(page_count: usize) -> Vec<u8> {
        let page_count = page_count.max(1);
        let font_id = 3 + page_count * 2;
        let kids = (0..page_count)
            .map(|index| format!("{} 0 R", 3 + index * 2))
            .collect::<Vec<_>>()
            .join(" ");
        let mut objects = vec![
            "<< /Type /Catalog /Pages 2 0 R >>".to_string(),
            format!("<< /Type /Pages /Kids [{kids}] /Count {page_count} >>"),
        ];
        for index in 0..page_count {
            let page_id = 3 + index * 2;
            let content_id = page_id + 1;
            objects.push(format!(
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 {font_id} 0 R >> >> /Contents {content_id} 0 R >>"
            ));
            let stream = format!("BT /F1 24 Tf 72 72 Td (Hello {index}) Tj ET\n");
            objects.push(format!(
                "<< /Length {} >>\nstream\n{}endstream",
                stream.len(),
                stream
            ));
        }
        objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_string());
        let mut bytes = b"%PDF-1.4\n".to_vec();
        let mut offsets = vec![0_u64];
        for (index, object) in objects.iter().enumerate() {
            offsets.push(bytes.len() as u64);
            bytes
                .extend_from_slice(format!("{} 0 obj\n{}\nendobj\n", index + 1, object).as_bytes());
        }
        let startxref = bytes.len();
        bytes.extend_from_slice(format!("xref\n0 {}\n", offsets.len()).as_bytes());
        bytes.extend_from_slice(b"0000000000 65535 f \n");
        for offset in offsets.iter().skip(1) {
            bytes.extend_from_slice(format!("{offset:010} 00000 n \n").as_bytes());
        }
        bytes.extend_from_slice(
            format!(
                "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{}\n%%EOF\n",
                offsets.len(),
                startxref
            )
            .as_bytes(),
        );
        bytes
    }

    #[test]
    fn real_application_office_fixtures_decode_all_units_without_external_tools() {
        let policy = default_policy("fixture-root", 0);
        let docx = office_xml_extraction(
            "docx",
            include_bytes!("../tests/fixtures/task08-real/task08-multipage.docx").to_vec(),
            &policy,
            &["word/document.xml"],
        )
        .unwrap();
        assert_eq!(docx.status, "completed");
        assert!(docx.text.contains("page one"));
        assert!(docx.text.contains("page two"));
        assert!(docx.text.contains("entity"));

        let xlsx = office_xml_extraction(
            "xlsx",
            include_bytes!("../tests/fixtures/task08-real/task08-multisheet.xlsx").to_vec(),
            &policy,
            &["xl/sharedStrings.xml"],
        )
        .unwrap();
        assert_eq!(xlsx.status, "completed");
        assert!(xlsx.text.contains("Shared"));
        assert!(xlsx.text.contains("Inline"));
        assert!(xlsx.text.contains("Entity"));

        let pptx = office_xml_extraction(
            "pptx",
            include_bytes!("../tests/fixtures/task08-real/task08-multislide.pptx").to_vec(),
            &policy,
            &[],
        )
        .unwrap();
        assert_eq!(pptx.status, "completed");
        assert!(pptx.text.contains("slide one"));
        assert!(pptx.text.contains("slide two"));

        let pdf = pdf_text_extraction(
            include_bytes!("../tests/fixtures/task08-real/task08-multipage.pdf").to_vec(),
            &policy,
        )
        .unwrap();
        assert_eq!(pdf.status, "completed");
        assert!(pdf.text.to_ascii_lowercase().contains("page one"));
        assert!(pdf.text.to_ascii_lowercase().contains("page two"));
    }

    #[test]
    fn pdf_resource_limits_are_enforced_during_scan_and_decode() {
        let mut policy = default_policy("fixture-root", 0);
        policy.max_bytes = 1024;
        let bomb = compressed_pdf_fixture(&vec![b'x'; 100_000]);
        let extraction = pdf_text_extraction(bomb, &policy).unwrap();
        assert_eq!(extraction.status, "blocked");
        assert_eq!(
            extraction.reason.as_deref(),
            Some("content_pdf_decompressed_byte_limit_exceeded")
        );
        let timed_bomb = compressed_pdf_fixture(&vec![b'x'; 100_000]);
        let timed_bomb = pdf_text_extraction_with_limits(
            &timed_bomb,
            &default_policy("fixture-root", 0),
            Instant::now() - Duration::from_millis(1),
            None,
        )
        .unwrap();
        assert_eq!(timed_bomb.status, "failed");
        assert_eq!(
            timed_bomb.reason.as_deref(),
            Some("content_extractor_timeout")
        );

        let timeout = pdf_text_extraction_with_limits(
            &valid_pdf_fixture(),
            &default_policy("fixture-root", 0),
            Instant::now() - Duration::from_millis(1),
            None,
        )
        .unwrap();
        assert_eq!(timeout.status, "failed");
        assert_eq!(timeout.reason.as_deref(), Some("content_extractor_timeout"));

        let cancelled = AtomicBool::new(true);
        let cancelled = pdf_text_extraction_with_limits(
            &valid_pdf_fixture(),
            &default_policy("fixture-root", 0),
            Instant::now() + Duration::from_secs(1),
            Some(&cancelled),
        )
        .unwrap();
        assert_eq!(cancelled.status, "failed");
        assert_eq!(
            cancelled.reason.as_deref(),
            Some("content_extractor_cancelled")
        );

        let mut output_policy = default_policy("fixture-root", 0);
        output_policy.max_chars = 8;
        let output = pdf_text_extraction(
            valid_pdf_fixture_with_text("0123456789abcdefghijklmnopqrstuvwxyz"),
            &output_policy,
        )
        .unwrap();
        assert_eq!(output.status, "completed");
        assert!(output.truncated);
        assert!(output.text.chars().count() <= 8);

        let mut object_bomb = b"%PDF-1.4\n".to_vec();
        for index in 0..=PDF_MAX_OBJECTS {
            object_bomb.extend_from_slice(format!("{index} 0 obj << >> endobj\n").as_bytes());
        }
        let object_limit = pdf_text_extraction(object_bomb, &default_policy("root", 0)).unwrap();
        assert_eq!(object_limit.status, "blocked");
        assert_eq!(
            object_limit.reason.as_deref(),
            Some("content_pdf_object_limit_exceeded")
        );

        let literal = valid_pdf_fixture_with_stream(&format!(
            "BT /F1 24 Tf 72 72 Td ({}) Tj ET\n",
            "x".repeat(PDF_MAX_TEMP_BUFFER_BYTES + 1)
        ));
        let literal_limit = pdf_text_extraction(literal, &default_policy("root", 0)).unwrap();
        assert_eq!(
            literal_limit.reason.as_deref(),
            Some("content_pdf_literal_buffer_limit_exceeded")
        );

        let hex = valid_pdf_fixture_with_stream(&format!(
            "BT /F1 24 Tf 72 72 Td <{}> Tj ET\n",
            "aa".repeat(PDF_MAX_TEMP_BUFFER_BYTES + 1)
        ));
        let hex_limit = pdf_text_extraction(hex, &default_policy("root", 0)).unwrap();
        assert_eq!(
            hex_limit.reason.as_deref(),
            Some("content_pdf_hex_buffer_limit_exceeded")
        );

        let mut cmap_stream = String::from("BT /F1 24 Tf 72 72 Td <0000> Tj ET\n");
        cmap_stream.push_str("/CIDInit /ProcSet findresource begin\nbeginbfchar\n");
        for value in 0..=PDF_MAX_CMAP_ENTRIES {
            cmap_stream.push_str(&format!("<{:04x}> <0041>\n", value));
        }
        cmap_stream.push_str("endbfchar\nend\n");
        let cmap_limit = pdf_text_extraction(
            valid_pdf_fixture_with_stream(&cmap_stream),
            &default_policy("root", 0),
        )
        .unwrap();
        assert_eq!(
            cmap_limit.reason.as_deref(),
            Some("content_pdf_cmap_entry_limit_exceeded")
        );

        let mut decoded_policy = default_policy("root", 0);
        decoded_policy.max_bytes = 16 * 1024 * 1024;
        let cmap_target = "61".repeat(349_525);
        let mut decoded_cmap_stream = String::from("BT /F1 24 Tf 72 72 Td <0000> Tj ET\n");
        decoded_cmap_stream.push_str("/CIDInit /ProcSet findresource begin\nbeginbfchar\n");
        for value in 0..13_u16 {
            decoded_cmap_stream.push_str(&format!("<{value:04x}> <{cmap_target}>\n"));
        }
        decoded_cmap_stream.push_str("endbfchar\nend\n");
        let decoded_cmap_limit = pdf_text_extraction(
            valid_pdf_fixture_with_stream(&decoded_cmap_stream),
            &decoded_policy,
        )
        .unwrap();
        assert_eq!(
            decoded_cmap_limit.reason.as_deref(),
            Some("content_pdf_cmap_decoded_byte_limit_exceeded")
        );
    }

    #[test]
    fn pdf_midflight_timeout_and_cancel_are_bounded_without_publication() {
        let policy = default_policy("fixture-root", 0);
        let hostile = compressed_pdf_fixture(&vec![b'x'; 2 * 1024 * 1024]);

        let timeout_started = AtomicBool::new(false);
        let timeout_hook = || {
            timeout_started.store(true, Ordering::SeqCst);
            std::thread::sleep(Duration::from_millis(20));
        };
        let started_at = Instant::now();
        let timeout = pdf_text_extraction_with_limits_and_hook(
            &hostile,
            &policy,
            Instant::now() + Duration::from_millis(5),
            None,
            Some(&timeout_hook),
        )
        .unwrap();
        let timeout_elapsed = started_at.elapsed();
        assert!(timeout_started.load(Ordering::SeqCst));
        assert_eq!(timeout.status, "failed");
        assert_eq!(timeout.reason.as_deref(), Some("content_extractor_timeout"));
        assert!(timeout_elapsed < Duration::from_millis(500));

        let cancel = AtomicBool::new(false);
        let cancel_started = AtomicBool::new(false);
        let cancel_hook = || {
            cancel_started.store(true, Ordering::SeqCst);
            cancel.store(true, Ordering::SeqCst);
        };
        let started_at = Instant::now();
        let cancelled = pdf_text_extraction_with_limits_and_hook(
            &hostile,
            &policy,
            Instant::now() + Duration::from_secs(2),
            Some(&cancel),
            Some(&cancel_hook),
        )
        .unwrap();
        let cancel_elapsed = started_at.elapsed();
        assert!(cancel_started.load(Ordering::SeqCst));
        assert_eq!(cancelled.status, "failed");
        assert_eq!(
            cancelled.reason.as_deref(),
            Some("content_extractor_cancelled")
        );
        assert!(cancel_elapsed < Duration::from_millis(500));
    }

    #[test]
    fn pdf_midflight_cancel_through_run_publishes_no_artifact_or_fts() {
        let root = std::env::temp_dir().join(format!(
            "zen-content-pdf-run-cancel-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&root).unwrap();
        let path = root.join("hostile.pdf");
        let bytes = compressed_pdf_fixture(&vec![b'x'; 2 * 1024 * 1024]);
        std::fs::write(&path, &bytes).unwrap();
        let metadata = std::fs::metadata(&path).unwrap();
        let size = metadata.len() as i64;
        let mtime = modified_unix_seconds(&metadata);
        let db_path = std::env::temp_dir().join(format!(
            "zen-content-pdf-run-cancel-{}.sqlite3",
            uuid::Uuid::new_v4()
        ));
        let db = Database::open(&db_path).unwrap();
        let root_id = "pdf-run-cancel-root";
        db.conn()
            .unwrap()
            .execute(
                "INSERT INTO scan_roots(
                    id, normalized_path, display_name, source_kind, enabled,
                    health_status, current_generation, revision, needs_reconciliation,
                    created_at, updated_at
                 ) VALUES (?1,?2,?1,'file_library',1,'healthy',1,1,0,1,1)",
                params![root_id, root.to_string_lossy().replace('\\', "/")],
            )
            .unwrap();
        db.insert_file(crate::db::InsertFileRequest {
            id: "pdf-run-cancel-file".into(),
            path: path.to_string_lossy().replace('\\', "/"),
            name: "hostile.pdf".into(),
            extension: "pdf".into(),
            size,
            mtime,
            ctime: mtime,
            is_dir: false,
            state_code: 0,
        })
        .unwrap();
        db.set_content_scope_policy(SetContentScopePolicyRequest {
            version: CONTENT_VERSION,
            root_id: root_id.into(),
            expected_root_revision: 1,
            expected_policy_revision: 0,
            confirmed: true,
            policy: ContentScopePolicyDto {
                root_revision: 1,
                enabled: true,
                local_allowed: true,
                ..default_policy(root_id, 1)
            },
        })
        .unwrap();
        let library_revision = current_library_revision(&db.conn().unwrap()).unwrap();
        let source_hash = hash_bytes(&bytes);
        db.conn()
            .unwrap()
            .execute(
                "INSERT INTO content_runs(
                    id, scope_json, scope_fingerprint, mode, provider_mode, status,
                    expected_library_revision, policy_fingerprint, confirmation,
                    provider_confirmed, revision, created_at, updated_at
                 ) VALUES ('pdf-run-cancel-run','{}','scope','local','none','running',
                           ?1,'policy',1,0,1,1,1)",
                params![library_revision],
            )
            .unwrap();
        db.conn()
            .unwrap()
            .execute(
                "INSERT INTO content_run_items(
                    id, run_id, file_id, ordinal, status, root_id, source_is_dir,
                    source_size, source_mtime, source_hash, provider_status,
                    policy_revision, created_at, updated_at
                 ) VALUES ('pdf-run-cancel-item','pdf-run-cancel-run',
                           'pdf-run-cancel-file',0,'pending',?1,0,?2,?3,?4,
                           'pending',1,1,1)",
                params![root_id, size, mtime, source_hash],
            )
            .unwrap();
        let candidate = Candidate {
            id: "pdf-run-cancel-file".into(),
            path: path.to_string_lossy().replace('\\', "/"),
            name: "hostile.pdf".into(),
            extension: "pdf".into(),
            size,
            mtime,
            is_dir: false,
            root_id: root_id.into(),
            content_hash: String::new(),
        };
        let request = StartContentRunRequest {
            version: CONTENT_VERSION,
            request_id: "pdf-run-cancel-request".into(),
            scope: FileLibraryScopeV2::Roots {
                scan_root_ids: vec![root_id.into()],
            },
            selection_file_ids: vec![candidate.id.clone()],
            mode: "local".into(),
            expected_library_revision: library_revision,
            expected_policy_revisions: vec![ContentPolicyRevisionRequest {
                root_id: root_id.into(),
                root_revision: 1,
                policy_revision: 1,
            }],
            provider_mode: "none".into(),
            preview_fingerprint: "test".into(),
            confirmed: true,
        };
        let cancel = AtomicBool::new(false);
        let started = AtomicBool::new(false);
        let cancel_hook = || {
            started.store(true, Ordering::SeqCst);
            cancel.store(true, Ordering::SeqCst);
        };
        let elapsed_start = Instant::now();
        let run = db
            .process_content_run_with_pdf_hook(
                "pdf-run-cancel-run",
                &request,
                vec![candidate],
                Some(&cancel_hook),
                Some(&cancel),
            )
            .unwrap();
        assert!(started.load(Ordering::SeqCst));
        assert!(elapsed_start.elapsed() < Duration::from_millis(500));
        assert_eq!(run.status, "partially_completed");
        let conn = db.conn().unwrap();
        let (item_status, error_code): (String, Option<String>) = conn
            .query_row(
                "SELECT status, error_code FROM content_run_items WHERE id='pdf-run-cancel-item'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        let artifacts: i64 = conn
            .query_row("SELECT COUNT(*) FROM content_artifacts", [], |row| {
                row.get(0)
            })
            .unwrap();
        let fts: i64 = conn
            .query_row("SELECT COUNT(*) FROM content_artifact_fts", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(item_status, "failed");
        assert_eq!(error_code.as_deref(), Some("content_extractor_cancelled"));
        assert_eq!(artifacts, 0);
        assert_eq!(fts, 0);
        drop(conn);
        drop(db);
        let _ = std::fs::remove_file(db_path);
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn pdf_midflight_timeout_through_run_publishes_no_artifact_or_fts() {
        let suffix = uuid::Uuid::new_v4().to_string();
        let root = std::env::temp_dir().join(format!("zen-content-pdf-run-timeout-{suffix}"));
        std::fs::create_dir_all(&root).unwrap();
        let path = root.join("hostile.pdf");
        let bytes = compressed_pdf_fixture(&vec![b'x'; 2 * 1024 * 1024]);
        std::fs::write(&path, &bytes).unwrap();
        let metadata = std::fs::metadata(&path).unwrap();
        let size = metadata.len() as i64;
        let mtime = modified_unix_seconds(&metadata);
        let db_path =
            std::env::temp_dir().join(format!("zen-content-pdf-run-timeout-{suffix}.sqlite3"));
        let db = Database::open(&db_path).unwrap();
        let root_id = format!("pdf-run-timeout-root-{suffix}");
        let file_id = format!("pdf-run-timeout-file-{suffix}");
        let run_id = format!("pdf-run-timeout-run-{suffix}");
        let item_id = format!("pdf-run-timeout-item-{suffix}");
        db.conn()
            .unwrap()
            .execute(
                "INSERT INTO scan_roots(
                    id, normalized_path, display_name, source_kind, enabled,
                    health_status, current_generation, revision, needs_reconciliation,
                    created_at, updated_at
                 ) VALUES (?1,?2,?1,'file_library',1,'healthy',1,1,0,1,1)",
                params![root_id, root.to_string_lossy().replace('\\', "/")],
            )
            .unwrap();
        db.insert_file(crate::db::InsertFileRequest {
            id: file_id.clone(),
            path: path.to_string_lossy().replace('\\', "/"),
            name: "hostile.pdf".into(),
            extension: "pdf".into(),
            size,
            mtime,
            ctime: mtime,
            is_dir: false,
            state_code: 0,
        })
        .unwrap();
        db.set_content_scope_policy(SetContentScopePolicyRequest {
            version: CONTENT_VERSION,
            root_id: root_id.clone(),
            expected_root_revision: 1,
            expected_policy_revision: 0,
            confirmed: true,
            policy: ContentScopePolicyDto {
                root_revision: 1,
                enabled: true,
                local_allowed: true,
                ..default_policy(&root_id, 1)
            },
        })
        .unwrap();
        let library_revision = current_library_revision(&db.conn().unwrap()).unwrap();
        let source_hash = hash_bytes(&bytes);
        db.conn()
            .unwrap()
            .execute(
                "INSERT INTO content_runs(
                    id, scope_json, scope_fingerprint, mode, provider_mode, status,
                    expected_library_revision, policy_fingerprint, confirmation,
                    provider_confirmed, revision, created_at, updated_at
                 ) VALUES (?1,'{}','scope','local','none','running',?2,'policy',1,0,1,1,1)",
                params![run_id, library_revision],
            )
            .unwrap();
        db.conn()
            .unwrap()
            .execute(
                "INSERT INTO content_run_items(
                    id, run_id, file_id, ordinal, status, root_id, source_is_dir,
                    source_size, source_mtime, source_hash, provider_status,
                    policy_revision, created_at, updated_at
                 ) VALUES (?1,?2,?3,0,'pending',?4,0,?5,?6,?7,'pending',1,1,1)",
                params![item_id, run_id, file_id, root_id, size, mtime, source_hash],
            )
            .unwrap();
        let candidate = Candidate {
            id: file_id.clone(),
            path: path.to_string_lossy().replace('\\', "/"),
            name: "hostile.pdf".into(),
            extension: "pdf".into(),
            size,
            mtime,
            is_dir: false,
            root_id: root_id.clone(),
            content_hash: String::new(),
        };
        let request = StartContentRunRequest {
            version: CONTENT_VERSION,
            request_id: format!("pdf-run-timeout-request-{suffix}"),
            scope: FileLibraryScopeV2::Roots {
                scan_root_ids: vec![root_id],
            },
            selection_file_ids: vec![candidate.id.clone()],
            mode: "local".into(),
            expected_library_revision: library_revision,
            expected_policy_revisions: vec![ContentPolicyRevisionRequest {
                root_id: candidate.root_id.clone(),
                root_revision: 1,
                policy_revision: 1,
            }],
            provider_mode: "none".into(),
            preview_fingerprint: "test".into(),
            confirmed: true,
        };
        let started = AtomicBool::new(false);
        let timeout_hook = || {
            started.store(true, Ordering::SeqCst);
            std::thread::sleep(Duration::from_millis(20));
        };
        let elapsed_start = Instant::now();
        let run = db
            .process_content_run_with_pdf_deadline_for_test(
                &run_id,
                &request,
                vec![candidate],
                Some(&timeout_hook),
                Duration::from_millis(5),
            )
            .unwrap();
        assert!(started.load(Ordering::SeqCst));
        assert!(elapsed_start.elapsed() < Duration::from_millis(500));
        assert_eq!(run.status, "partially_completed");
        let conn = db.conn().unwrap();
        let (item_status, error_code): (String, Option<String>) = conn
            .query_row(
                "SELECT status, error_code FROM content_run_items WHERE id=?1",
                params![item_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        let running_items: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM content_run_items
                 WHERE run_id=?1 AND status='running'",
                params![run_id],
                |row| row.get(0),
            )
            .unwrap();
        let run_in_progress: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM content_runs
                 WHERE id=?1 AND status IN ('running','cancelling')",
                params![run_id],
                |row| row.get(0),
            )
            .unwrap();
        let artifacts: i64 = conn
            .query_row("SELECT COUNT(*) FROM content_artifacts", [], |row| {
                row.get(0)
            })
            .unwrap();
        let fts: i64 = conn
            .query_row("SELECT COUNT(*) FROM content_artifact_fts", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(item_status, "failed");
        assert_eq!(error_code.as_deref(), Some("content_extractor_timeout"));
        assert_eq!(running_items, 0);
        assert_eq!(run_in_progress, 0);
        assert_eq!(artifacts, 0);
        assert_eq!(fts, 0);
        drop(conn);
        drop(db);
        let _ = std::fs::remove_file(db_path);
        let _ = std::fs::remove_dir_all(root);
    }

    fn valid_pdf_fixture_with_text(text: &str) -> Vec<u8> {
        let escaped = text
            .replace('\\', "\\\\")
            .replace('(', "\\(")
            .replace(')', "\\)");
        let stream = format!("BT /F1 24 Tf 72 72 Td ({escaped}) Tj ET\n");
        valid_pdf_fixture_with_stream(&stream)
    }

    fn valid_pdf_fixture_with_stream(stream: &str) -> Vec<u8> {
        let objects = [
            "<< /Type /Catalog /Pages 2 0 R >>".to_string(),
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>".to_string(),
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>".to_string(),
            format!(
                "<< /Length {} >>\nstream\n{}endstream",
                stream.len(),
                stream
            ),
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_string(),
        ];
        let mut bytes = b"%PDF-1.4\n".to_vec();
        for (index, object) in objects.iter().enumerate() {
            bytes
                .extend_from_slice(format!("{} 0 obj\n{}\nendobj\n", index + 1, object).as_bytes());
        }
        bytes
    }

    fn compressed_pdf_fixture(payload: &[u8]) -> Vec<u8> {
        use flate2::{write::ZlibEncoder, Compression};
        let mut encoder = ZlibEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(payload).unwrap();
        let compressed = encoder.finish().unwrap();
        let mut bytes = b"%PDF-1.4\n".to_vec();
        let objects = [
            "<< /Type /Catalog /Pages 2 0 R >>".as_bytes().to_vec(),
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>"
                .as_bytes()
                .to_vec(),
            b"<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>".to_vec(),
            {
                let mut object = format!(
                    "<< /Length {} /Filter /FlateDecode >>\nstream\n",
                    compressed.len()
                )
                .into_bytes();
                object.extend_from_slice(&compressed);
                object.extend_from_slice(b"\nendstream");
                object
            },
        ];
        for (index, object) in objects.iter().enumerate() {
            bytes.extend_from_slice(format!("{} 0 obj\n", index + 1).as_bytes());
            bytes.extend_from_slice(object);
            bytes.extend_from_slice(b"\nendobj\n");
        }
        bytes
    }

    #[test]
    fn office_xml_entities_comments_and_malformed_input_fail_closed() {
        let parsed = parse_xml_text(b"<root>A &amp; B<!-- bounded comment --></root>").unwrap();
        assert!(parsed.contains('A') && parsed.contains('&') && parsed.contains('B'));
        assert!(parsed.contains("bounded comment"));
        assert!(parse_xml_text(b"<root><child>").is_err());
    }

    #[test]
    fn office_zip_bomb_and_entry_limits_fail_closed() {
        let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
        writer
            .start_file("word/document.xml", SimpleFileOptions::default())
            .unwrap();
        writer
            .write_all(format!("<root>{}</root>", "x".repeat(20_000)).as_bytes())
            .unwrap();
        let archive = writer.finish().unwrap().into_inner();
        let mut policy = default_policy("fixture-root", 0);
        policy.max_bytes = 1024;
        let extraction =
            office_xml_extraction("docx", archive, &policy, &["word/document.xml"]).unwrap();
        assert_eq!(extraction.status, "blocked");
        assert_eq!(
            extraction.reason.as_deref(),
            Some("content_archive_entry_limit_exceeded")
        );
        let mut reader = Cursor::new(vec![0_u8; 4]);
        let timeout =
            read_zip_entry_bounded(&mut reader, 64, Instant::now() - Duration::from_secs(1))
                .expect_err("expired extraction deadline must fail closed");
        assert_eq!(content_error_code(&timeout), "content_extractor_timeout");
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
    fn provider_claim_owner_and_completed_item_are_non_replayable() {
        let db_path = std::env::temp_dir().join(format!(
            "zen-content-provider-claim-{}.sqlite3",
            uuid::Uuid::new_v4()
        ));
        let db = Database::open(&db_path).unwrap();
        db.insert_file(crate::db::InsertFileRequest {
            id: "provider-claim-file".into(),
            path: "provider-claim-file.txt".into(),
            name: "provider-claim-file.txt".into(),
            extension: "txt".into(),
            size: 4,
            mtime: 1,
            ctime: 1,
            is_dir: false,
            state_code: 0,
        })
        .unwrap();
        db.conn()
            .unwrap()
            .execute(
                "INSERT INTO content_runs(
                    id, scope_json, scope_fingerprint, mode, provider_mode, status,
                    expected_library_revision, policy_fingerprint, confirmation,
                    provider_confirmed, created_at, updated_at
                 ) VALUES ('provider-claim-run','{\"kind\":\"all_enabled_roots\"}','scope','understand','existing_interactive_provider','running',1,'policy',1,1,1,1)",
                [],
            )
            .unwrap();
        db.conn()
            .unwrap()
            .execute(
                "INSERT INTO content_run_items(
                    id, run_id, file_id, ordinal, status, root_id, source_is_dir,
                    artifact_id, provider_status, source_size, source_mtime, source_hash,
                    policy_revision, created_at, updated_at
                 ) VALUES ('provider-claim-item','provider-claim-run','provider-claim-file',0,'completed','provider-root',0,'provider-claim-artifact','pending',4,1,'hash',1,1,1)",
                [],
            )
            .unwrap();
        let run_claim = db.claim_provider_phase("provider-claim-run", 1).unwrap();
        let item_claim = db
            .claim_provider_item("provider-claim-run", "provider-claim-artifact", &run_claim)
            .unwrap()
            .expect("first provider owner claim");
        assert!(db
            .claim_provider_item("provider-claim-run", "provider-claim-artifact", &run_claim)
            .unwrap()
            .is_none());
        db.mark_provider_item(
            "provider-claim-run",
            "provider-claim-artifact",
            &item_claim,
            "completed",
            None,
        )
        .unwrap();
        db.finish_provider_phase("provider-claim-run", &run_claim, 0, None)
            .unwrap();
        let completed_run = db.get_content_run("provider-claim-run").unwrap();
        let replay_claim = db
            .claim_provider_phase("provider-claim-run", completed_run.revision)
            .unwrap();
        assert!(db
            .claim_provider_item(
                "provider-claim-run",
                "provider-claim-artifact",
                &replay_claim
            )
            .unwrap()
            .is_none());
        drop(db);
        let _ = std::fs::remove_file(db_path);
    }

    #[test]
    fn provider_phase_claim_serializes_active_owners_across_connections() {
        let db_path = std::env::temp_dir().join(format!(
            "zen-content-provider-contention-{}.sqlite3",
            uuid::Uuid::new_v4()
        ));
        let db = Database::open(&db_path).unwrap();
        db.insert_file(crate::db::InsertFileRequest {
            id: "contention-file".into(),
            path: "contention-file.txt".into(),
            name: "contention-file.txt".into(),
            extension: "txt".into(),
            size: 0,
            mtime: 0,
            ctime: 0,
            is_dir: false,
            state_code: 0,
        })
        .unwrap();
        db.conn()
            .unwrap()
            .execute(
                "INSERT INTO content_runs(
                    id, scope_json, scope_fingerprint, mode, provider_mode, status,
                    expected_library_revision, policy_fingerprint, confirmation,
                    provider_confirmed, created_at, updated_at
                 ) VALUES ('provider-contention-run','{}','scope','understand',
                           'existing_interactive_provider','running',1,'policy',1,1,1,1)",
                [],
            )
            .unwrap();
        db.conn()
            .unwrap()
            .execute(
                "INSERT INTO content_run_items(
                    id, run_id, file_id, ordinal, status, root_id, source_is_dir,
                    artifact_id, provider_status, source_size, source_mtime, source_hash,
                    policy_revision, created_at, updated_at
                 ) VALUES ('provider-contention-item','provider-contention-run',
                           'contention-file',0,'completed','contention-root',0,
                           'contention-artifact','pending',0,0,'',1,1,1)",
                [],
            )
            .unwrap();

        let barrier = Arc::new(Barrier::new(2));
        let provider_gate_count = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let first_db = db.clone();
        let first_barrier = barrier.clone();
        let first_gate = provider_gate_count.clone();
        let first = std::thread::spawn(move || {
            first_barrier.wait();
            let result = first_db.claim_provider_phase("provider-contention-run", 1);
            if result.is_ok() {
                first_gate.fetch_add(1, Ordering::SeqCst);
            }
            result
                .map(|claim| claim.owner)
                .map_err(|error| error.to_string())
        });
        let second_db = db.clone();
        let second_barrier = barrier.clone();
        let second_gate = provider_gate_count.clone();
        let second = std::thread::spawn(move || {
            second_barrier.wait();
            let result = second_db.claim_provider_phase("provider-contention-run", 1);
            if result.is_ok() {
                second_gate.fetch_add(1, Ordering::SeqCst);
            }
            result
                .map(|claim| claim.owner)
                .map_err(|error| error.to_string())
        });
        let first = first.join().unwrap();
        let second = second.join().unwrap();
        let owners = [first.as_ref().ok(), second.as_ref().ok()]
            .into_iter()
            .flatten()
            .collect::<Vec<_>>();
        assert_eq!(owners.len(), 1, "exactly one connection owns the phase");
        assert_eq!(provider_gate_count.load(Ordering::SeqCst), 1);

        let winner_owner = owners[0].clone();
        let conn = db.conn().unwrap();
        let (revision, status, active_owner): (i64, String, String) = conn
            .query_row(
                "SELECT revision, status, provider_owner FROM content_runs WHERE id='provider-contention-run'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(revision, 2);
        assert_eq!(status, "running");
        assert_eq!(active_owner, winner_owner);
        let item_state: (String, Option<String>) = conn
            .query_row(
                "SELECT provider_status, provider_owner FROM content_run_items WHERE id='provider-contention-item'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(item_state, ("pending".into(), None));
        drop(conn);

        // A contender that read the newly incremented revision still cannot
        // replace the live owner; startup recovery is the only reclaim path.
        assert!(db
            .claim_provider_phase("provider-contention-run", 2)
            .is_err());
        let conn = db.conn().unwrap();
        let (revision, active_owner): (i64, String) = conn
            .query_row(
                "SELECT revision, provider_owner FROM content_runs WHERE id='provider-contention-run'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(revision, 2);
        assert_eq!(active_owner, winner_owner);
        drop(conn);
        drop(db);
        let _ = std::fs::remove_file(db_path);
    }

    #[test]
    fn provider_publication_commits_artifact_fts_and_item_together() {
        let db_path = std::env::temp_dir().join(format!(
            "zen-content-provider-publish-{}.sqlite3",
            uuid::Uuid::new_v4()
        ));
        let db = Database::open(&db_path).unwrap();
        db.insert_file(crate::db::InsertFileRequest {
            id: "provider-publish-file".into(),
            path: "provider-publish-file.txt".into(),
            name: "provider-publish-file.txt".into(),
            extension: "txt".into(),
            size: 4,
            mtime: 1,
            ctime: 1,
            is_dir: false,
            state_code: 0,
        })
        .unwrap();
        let conn = db.conn().unwrap();
        conn.execute(
            "INSERT INTO content_runs(
                id, scope_json, scope_fingerprint, mode, provider_mode, status,
                expected_library_revision, policy_fingerprint, confirmation,
                provider_confirmed, created_at, updated_at
             ) VALUES ('provider-publish-run','{\"kind\":\"all_enabled_roots\"}','scope','understand','existing_interactive_provider','running',1,'policy',1,1,1,1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO content_artifacts(
                id, file_id, source_size, source_mtime, source_is_dir, source_hash,
                extractor_family, extractor_version, policy_revision, content_fingerprint,
                status, keywords_json, provenance_json, revision, created_at, updated_at
             ) VALUES ('provider-publish-artifact','provider-publish-file',4,1,0,'hash',
                       'txt','content-extractor-v1',1,'fingerprint','current','[]','{}',1,1,1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO content_run_items(
                id, run_id, file_id, ordinal, status, root_id, source_is_dir,
                artifact_id, provider_status, source_size, source_mtime, source_hash,
                policy_revision, created_at, updated_at
             ) VALUES ('provider-publish-item','provider-publish-run','provider-publish-file',0,'completed','provider-root',0,
                       'provider-publish-artifact','pending',4,1,'hash',1,1,1)",
            [],
        )
        .unwrap();
        drop(conn);
        let run_claim = db.claim_provider_phase("provider-publish-run", 1).unwrap();
        let item_claim = db
            .claim_provider_item(
                "provider-publish-run",
                "provider-publish-artifact",
                &run_claim,
            )
            .unwrap()
            .unwrap();
        let artifact = UnderstandingArtifact {
            id: "provider-publish-artifact".into(),
            file_id: "provider-publish-file".into(),
            revision: 1,
            status: "current".into(),
            root_id: Some("provider-root".into()),
            source_hash: "hash".into(),
            raw_text: Some("source text".into()),
            risk_level: "Normal".into(),
        };
        let envelope: ContentModelEnvelopeV1 = serde_json::from_str(
            r#"{"summary":"published summary","keywords":["alpha"],"warnings":[]}"#,
        )
        .unwrap();
        db.publish_provider_result(
            "provider-publish-run",
            &run_claim,
            &item_claim,
            &artifact,
            &envelope,
            &crate::ai::settings::AISettings::default(),
        )
        .unwrap();
        let conn = db.conn().unwrap();
        let item_status: String = conn
            .query_row(
                "SELECT provider_status FROM content_run_items WHERE id='provider-publish-item'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let summary: String = conn
            .query_row(
                "SELECT summary FROM content_artifacts WHERE id='provider-publish-artifact'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let fts_rows: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM content_artifact_fts WHERE artifact_id='provider-publish-artifact'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(item_status, "completed");
        assert_eq!(summary, "published summary");
        assert_eq!(fts_rows, 1);
        drop(conn);

        // Inject a failure after the artifact UPDATE is entered.  The
        // publication transaction must roll back the artifact and FTS writes
        // together, leaving the claimed item recoverable rather than exposing
        // a half-published provider result.
        db.insert_file(crate::db::InsertFileRequest {
            id: "provider-rollback-file".into(),
            path: "provider-rollback-file.txt".into(),
            name: "provider-rollback-file.txt".into(),
            extension: "txt".into(),
            size: 4,
            mtime: 1,
            ctime: 1,
            is_dir: false,
            state_code: 0,
        })
        .unwrap();
        let conn = db.conn().unwrap();
        conn.execute(
            "INSERT INTO content_artifacts(
                id, file_id, source_size, source_mtime, source_is_dir, source_hash,
                extractor_family, extractor_version, policy_revision, content_fingerprint,
                status, keywords_json, provenance_json, revision, created_at, updated_at
             ) VALUES ('provider-rollback-artifact','provider-rollback-file',4,1,0,'hash',
                       'txt','content-extractor-v1',1,'rollback-fingerprint','current','[]','{}',1,1,1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO content_run_items(
                id, run_id, file_id, ordinal, status, root_id, source_is_dir,
                artifact_id, provider_status, source_size, source_mtime, source_hash,
                policy_revision, created_at, updated_at
             ) VALUES ('provider-rollback-item','provider-publish-run','provider-rollback-file',2,'completed','provider-root',0,
                       'provider-rollback-artifact','pending',4,1,'hash',1,1,1)",
            [],
        )
        .unwrap();
        conn.execute_batch(
            "CREATE TRIGGER task08_provider_publish_fault
             BEFORE UPDATE ON content_artifacts
             WHEN OLD.id='provider-rollback-artifact'
             BEGIN SELECT RAISE(ABORT, 'task08 injected provider publication failure'); END;",
        )
        .unwrap();
        drop(conn);
        let rollback_claim = db
            .claim_provider_item(
                "provider-publish-run",
                "provider-rollback-artifact",
                &run_claim,
            )
            .unwrap()
            .unwrap();
        let rollback_artifact = UnderstandingArtifact {
            id: "provider-rollback-artifact".into(),
            file_id: "provider-rollback-file".into(),
            revision: 1,
            status: "current".into(),
            root_id: Some("provider-root".into()),
            source_hash: "hash".into(),
            raw_text: None,
            risk_level: "Normal".into(),
        };
        let injected = db.publish_provider_result(
            "provider-publish-run",
            &run_claim,
            &rollback_claim,
            &rollback_artifact,
            &ContentModelEnvelopeV1 {
                summary: "fault injected".into(),
                keywords: vec!["fault".into()],
                language: None,
                warnings: Vec::new(),
            },
            &crate::ai::settings::AISettings::default(),
        );
        assert!(injected.is_err());
        let conn = db.conn().unwrap();
        let rollback_summary: Option<String> = conn
            .query_row(
                "SELECT summary FROM content_artifacts WHERE id='provider-rollback-artifact'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let rollback_fts_rows: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM content_artifact_fts WHERE artifact_id='provider-rollback-artifact'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let rollback_item_status: String = conn
            .query_row(
                "SELECT provider_status FROM content_run_items WHERE id='provider-rollback-item'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(rollback_summary.is_none());
        assert_eq!(rollback_fts_rows, 0);
        assert_eq!(rollback_item_status, "running");
        drop(conn);
        db.conn()
            .unwrap()
            .execute_batch("DROP TRIGGER task08_provider_publish_fault;")
            .unwrap();
        db.insert_file(crate::db::InsertFileRequest {
            id: "provider-conflict-file".into(),
            path: "provider-conflict-file.txt".into(),
            name: "provider-conflict-file.txt".into(),
            extension: "txt".into(),
            size: 4,
            mtime: 1,
            ctime: 1,
            is_dir: false,
            state_code: 0,
        })
        .unwrap();
        let conn = db.conn().unwrap();
        conn.execute(
            "INSERT INTO content_artifacts(
                id, file_id, source_size, source_mtime, source_is_dir, source_hash,
                extractor_family, extractor_version, policy_revision, content_fingerprint,
                status, keywords_json, provenance_json, revision, created_at, updated_at
             ) VALUES ('provider-conflict-artifact','provider-conflict-file',4,1,0,'hash',
                       'txt','content-extractor-v1',1,'fingerprint-2','current','[]','{}',1,1,1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO content_run_items(
                id, run_id, file_id, ordinal, status, root_id, source_is_dir,
                artifact_id, provider_status, source_size, source_mtime, source_hash,
                policy_revision, created_at, updated_at
             ) VALUES ('provider-conflict-item','provider-publish-run','provider-conflict-file',1,'completed','provider-root',0,
                       'provider-conflict-artifact','pending',4,1,'hash',1,1,1)",
            [],
        )
        .unwrap();
        conn.execute(
            "UPDATE content_artifacts SET revision=2 WHERE id='provider-conflict-artifact'",
            [],
        )
        .unwrap();
        drop(conn);
        let conflict_claim = db
            .claim_provider_item(
                "provider-publish-run",
                "provider-conflict-artifact",
                &run_claim,
            )
            .unwrap()
            .unwrap();
        let conflict_artifact = UnderstandingArtifact {
            id: "provider-conflict-artifact".into(),
            file_id: "provider-conflict-file".into(),
            revision: 1,
            status: "current".into(),
            root_id: Some("provider-root".into()),
            source_hash: "hash".into(),
            raw_text: None,
            risk_level: "Normal".into(),
        };
        let conflict = db.publish_provider_result(
            "provider-publish-run",
            &run_claim,
            &conflict_claim,
            &conflict_artifact,
            &envelope,
            &crate::ai::settings::AISettings::default(),
        );
        assert_eq!(
            content_error_code(&conflict.unwrap_err()),
            "content_artifact_revision_conflict"
        );
        let conflict_status: String = db
            .conn()
            .unwrap()
            .query_row(
                "SELECT provider_status FROM content_run_items WHERE id='provider-conflict-item'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(conflict_status, "stale");
        // Recovery after the injected crash terminates the still-claimed
        // item and clears its opaque owner token; the already completed item
        // remains completed and is not replayed.
        db.recover_content_runs().unwrap();
        let conn = db.conn().unwrap();
        let recovered_item: (String, Option<String>) = conn
            .query_row(
                "SELECT provider_status, provider_owner FROM content_run_items WHERE id='provider-rollback-item'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        let completed_item: String = conn
            .query_row(
                "SELECT provider_status FROM content_run_items WHERE id='provider-publish-item'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(recovered_item.0, "failed");
        assert!(recovered_item.1.is_none());
        assert_eq!(completed_item, "completed");
        drop(conn);
        drop(db);
        let _ = std::fs::remove_file(db_path);
    }

    #[test]
    fn provider_source_mutation_after_extraction_blocks_request_before_send() {
        let root = std::env::temp_dir().join(format!(
            "zen-content-provider-boundary-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&root).unwrap();
        let path = root.join("source.txt");
        std::fs::write(&path, b"before-send").unwrap();
        let metadata = std::fs::metadata(&path).unwrap();
        let expected_size = metadata.len() as i64;
        let expected_mtime = modified_unix_seconds(&metadata);
        let expected_hash = hash_bytes(std::fs::read(&path).unwrap());
        Database::verify_provider_source_snapshot(
            &path,
            expected_size,
            expected_mtime,
            &expected_hash,
            1024,
        )
        .unwrap();
        // This models the extraction/send gap: the source changes after the
        // bounded extraction snapshot but before the provider call.
        std::fs::write(&path, b"changed-now").unwrap();
        let mut provider_requests = 0_u32;
        let boundary = Database::verify_provider_source_snapshot(
            &path,
            expected_size,
            expected_mtime,
            &expected_hash,
            1024,
        );
        if boundary.is_ok() {
            provider_requests += 1;
        }
        assert_eq!(
            content_error_code(&boundary.unwrap_err()),
            "content_source_changed_before_provider_send"
        );
        assert_eq!(
            provider_requests, 0,
            "a changed source must not reach the provider"
        );
        let _ = std::fs::remove_dir_all(root);
    }

    struct CountingProvider {
        invocations: Arc<AtomicUsize>,
    }

    impl AIProvider for CountingProvider {
        fn chat_json(
            &self,
            _request: AIChatRequest,
        ) -> Result<String, crate::ai::provider::AIProviderError> {
            self.invocations.fetch_add(1, Ordering::SeqCst);
            Ok(r#"{"summary":"should not be sent","keywords":[],"warnings":[]}"#.into())
        }

        fn test_connection(
            &self,
        ) -> Result<crate::ai::schema::AIConnectionTestResult, crate::ai::provider::AIProviderError>
        {
            Ok(crate::ai::schema::AIConnectionTestResult {
                ok: true,
                message: "test provider".into(),
                model: Some("test".into()),
                provider: None,
                preset: None,
                elapsed_ms: 0,
            })
        }
    }

    fn provider_settings_fixture(
        label: &str,
    ) -> (
        Database,
        std::path::PathBuf,
        std::path::PathBuf,
        String,
        String,
        String,
        String,
    ) {
        let suffix = format!("{}-{}", label, uuid::Uuid::new_v4());
        let root = std::env::temp_dir().join(format!("zen-content-provider-settings-{suffix}"));
        std::fs::create_dir_all(&root).unwrap();
        let path = root.join("source.txt");
        std::fs::write(&path, b"provider settings fixture").unwrap();
        let metadata = std::fs::metadata(&path).unwrap();
        let size = metadata.len() as i64;
        let mtime = modified_unix_seconds(&metadata);
        let source_hash = hash_bytes(std::fs::read(&path).unwrap());

        let db_path =
            std::env::temp_dir().join(format!("zen-content-provider-settings-{suffix}.sqlite3"));
        let db = Database::open(&db_path).unwrap();
        let root_id = format!("provider-settings-root-{suffix}");
        let file_id = format!("provider-settings-file-{suffix}");
        let run_id = format!("provider-settings-run-{suffix}");
        let artifact_id = format!("provider-settings-artifact-{suffix}");
        let item_id = format!("provider-settings-item-{suffix}");
        db.conn()
            .unwrap()
            .execute(
                "INSERT INTO scan_roots(
                    id, normalized_path, display_name, source_kind, enabled,
                    health_status, current_generation, revision, needs_reconciliation,
                    created_at, updated_at
                 ) VALUES (?1,?2,?1,'file_library',1,'healthy',1,1,0,1,1)",
                params![root_id, root.to_string_lossy().replace('\\', "/")],
            )
            .unwrap();
        db.insert_file(crate::db::InsertFileRequest {
            id: file_id.clone(),
            path: path.to_string_lossy().replace('\\', "/"),
            name: "source.txt".into(),
            extension: "txt".into(),
            size,
            mtime,
            ctime: mtime,
            is_dir: false,
            state_code: 0,
        })
        .unwrap();
        db.conn()
            .unwrap()
            .execute(
                "UPDATE files SET content_hash=?2 WHERE id=?1",
                params![file_id, source_hash],
            )
            .unwrap();
        db.set_content_scope_policy(SetContentScopePolicyRequest {
            version: CONTENT_VERSION,
            root_id: root_id.clone(),
            expected_root_revision: 1,
            expected_policy_revision: 0,
            confirmed: true,
            policy: ContentScopePolicyDto {
                root_revision: 1,
                enabled: true,
                local_allowed: true,
                ..default_policy(&root_id, 1)
            },
        })
        .unwrap();
        let library_revision = current_library_revision(&db.conn().unwrap()).unwrap();
        db.conn()
            .unwrap()
            .execute(
                "INSERT INTO content_artifacts(
                    id, file_id, scan_root_id, source_size, source_mtime, source_is_dir,
                    source_hash, extractor_family, extractor_version, policy_revision,
                    content_fingerprint, status, summary, keywords_json, provenance_json,
                    revision, created_at, updated_at
                 ) VALUES (?1,?2,?3,?4,?5,0,?6,'txt','content-extractor-v1',1,
                           'provider-settings-fingerprint','current','fixture','[]','{}',1,1,1)",
                params![artifact_id, file_id, root_id, size, mtime, source_hash],
            )
            .unwrap();
        db.conn()
            .unwrap()
            .execute(
                "INSERT INTO content_runs(
                    id, scope_json, scope_fingerprint, mode, provider_mode, status,
                    expected_library_revision, policy_fingerprint, confirmation,
                    provider_confirmed, revision, created_at, updated_at
                 ) VALUES (?1,'{}','scope','understand','existing_interactive_provider',
                           'completed',?2,'policy',1,1,1,1,1)",
                params![run_id, library_revision],
            )
            .unwrap();
        db.conn()
            .unwrap()
            .execute(
                "INSERT INTO content_run_items(
                    id, run_id, file_id, ordinal, status, root_id, source_is_dir,
                    source_size, source_mtime, source_hash, extractor_family,
                    extractor_version, artifact_id, provider_status, policy_revision,
                    created_at, updated_at
                 ) VALUES (?1,?2,?3,0,'completed',?4,0,?5,?6,?7,'txt',
                           'content-extractor-v1',?8,'pending',1,1,1)",
                params![
                    item_id,
                    run_id,
                    file_id,
                    root_id,
                    size,
                    mtime,
                    source_hash,
                    artifact_id
                ],
            )
            .unwrap();
        let settings = crate::ai::settings::AISettings {
            enabled: true,
            provider: AIProviderKind::Ollama,
            preset: crate::ai::schema::AIProviderPresetId::Ollama,
            base_url: "http://127.0.0.1:11434".into(),
            model: "test-model".into(),
            ..Default::default()
        };
        db.conn()
            .unwrap()
            .execute(
                "INSERT OR REPLACE INTO app_settings(key, value) VALUES (?1, ?2)",
                params![
                    crate::ai::settings::AI_SETTINGS_KEY,
                    serde_json::to_string(&settings).unwrap()
                ],
            )
            .unwrap();
        (db, db_path, root, run_id, artifact_id, item_id, file_id)
    }

    fn provider_settings_request(
        run_id: &str,
        artifact_id: &str,
    ) -> UnderstandContentArtifactsRequest {
        UnderstandContentArtifactsRequest {
            version: CONTENT_VERSION,
            artifact_ids: vec![artifact_id.into()],
            expected_revisions: vec![1],
            run_id: Some(run_id.into()),
            expected_run_revision: Some(1),
            confirmed: true,
        }
    }

    fn cleanup_provider_settings_fixture(
        db: Database,
        db_path: std::path::PathBuf,
        root: std::path::PathBuf,
    ) {
        drop(db);
        let _ = std::fs::remove_file(db_path);
        let _ = std::fs::remove_dir_all(root);
    }

    fn overwrite_ai_settings_for_test(db: &Database, settings: &crate::ai::settings::AISettings) {
        db.conn()
            .unwrap()
            .execute(
                "INSERT OR REPLACE INTO app_settings(key, value) VALUES (?1, ?2)",
                params![
                    crate::ai::settings::AI_SETTINGS_KEY,
                    serde_json::to_string(settings).unwrap()
                ],
            )
            .unwrap();
    }

    #[test]
    fn provider_settings_invalid_before_claim_leaves_no_owner() {
        let (db, db_path, root, run_id, artifact_id, item_id, _) =
            provider_settings_fixture("invalid-before-claim");
        let mut invalid = get_ai_settings_for_db(&db).unwrap();
        invalid.base_url = "not a provider URL".into();
        overwrite_ai_settings_for_test(&db, &invalid);
        let invocations = Arc::new(AtomicUsize::new(0));
        let provider = CountingProvider {
            invocations: invocations.clone(),
        };
        let error = db
            .understand_content_artifacts_with_seams(
                provider_settings_request(&run_id, &artifact_id),
                Some(&provider),
                None,
            )
            .expect_err("invalid provider settings must fail before claiming the run");
        assert_eq!(error.to_string(), "content_provider_configuration_invalid");
        let conn = db.conn().unwrap();
        let (run_status, run_revision, provider_revision, run_owner): (
            String,
            i64,
            i64,
            Option<String>,
        ) = conn
            .query_row(
                "SELECT status, revision, provider_revision, provider_owner
                 FROM content_runs WHERE id=?1",
                params![run_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .unwrap();
        let (item_status, item_owner): (String, Option<String>) = conn
            .query_row(
                "SELECT provider_status, provider_owner
                 FROM content_run_items WHERE id=?1",
                params![item_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(run_status, "completed");
        assert_eq!(run_revision, 1);
        assert_eq!(provider_revision, 1);
        assert!(run_owner.is_none());
        assert_eq!(item_status, "pending");
        assert!(item_owner.is_none());
        assert_eq!(invocations.load(Ordering::SeqCst), 0);
        drop(conn);
        cleanup_provider_settings_fixture(db, db_path, root);
    }

    #[test]
    fn provider_disabled_before_claim_leaves_no_owner() {
        let (db, db_path, root, run_id, artifact_id, item_id, _) =
            provider_settings_fixture("disabled-before-claim");
        let mut disabled = get_ai_settings_for_db(&db).unwrap();
        disabled.enabled = false;
        overwrite_ai_settings_for_test(&db, &disabled);
        let invocations = Arc::new(AtomicUsize::new(0));
        let provider = CountingProvider {
            invocations: invocations.clone(),
        };
        let error = db
            .understand_content_artifacts_with_seams(
                provider_settings_request(&run_id, &artifact_id),
                Some(&provider),
                None,
            )
            .expect_err("disabled provider must fail before claiming the run");
        assert_eq!(
            error.to_string(),
            "content_provider_not_configured_for_this_run"
        );
        let conn = db.conn().unwrap();
        let (run_revision, provider_owner): (i64, Option<String>) = conn
            .query_row(
                "SELECT revision, provider_owner FROM content_runs WHERE id=?1",
                params![run_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        let (item_status, item_owner): (String, Option<String>) = conn
            .query_row(
                "SELECT provider_status, provider_owner
                 FROM content_run_items WHERE id=?1",
                params![item_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(run_revision, 1);
        assert!(provider_owner.is_none());
        assert_eq!(item_status, "pending");
        assert!(item_owner.is_none());
        assert_eq!(invocations.load(Ordering::SeqCst), 0);
        drop(conn);
        cleanup_provider_settings_fixture(db, db_path, root);
    }

    #[test]
    fn provider_settings_repaired_can_retry_without_restart() {
        let (db, db_path, root, run_id, artifact_id, item_id, _) =
            provider_settings_fixture("repair-without-restart");
        let valid = get_ai_settings_for_db(&db).unwrap();
        let mut invalid = valid.clone();
        invalid.base_url = "not a provider URL".into();
        overwrite_ai_settings_for_test(&db, &invalid);
        let first_error = db
            .understand_content_artifacts_with_seams(
                provider_settings_request(&run_id, &artifact_id),
                None,
                None,
            )
            .expect_err("invalid settings must not claim the run");
        assert_eq!(
            first_error.to_string(),
            "content_provider_configuration_invalid"
        );
        overwrite_ai_settings_for_test(&db, &valid);
        let invocations = Arc::new(AtomicUsize::new(0));
        let provider = CountingProvider {
            invocations: invocations.clone(),
        };
        let result = db
            .understand_content_artifacts_with_seams(
                provider_settings_request(&run_id, &artifact_id),
                Some(&provider),
                None,
            )
            .expect("the repaired provider must retry without recovery or restart");
        assert_eq!(result.processed_count, 1);
        assert_eq!(result.blocked_count, 0);
        assert_eq!(invocations.load(Ordering::SeqCst), 1);
        let conn = db.conn().unwrap();
        let (run_status, run_owner): (String, Option<String>) = conn
            .query_row(
                "SELECT status, provider_owner FROM content_runs WHERE id=?1",
                params![run_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        let (item_status, item_owner): (String, Option<String>) = conn
            .query_row(
                "SELECT provider_status, provider_owner
                 FROM content_run_items WHERE id=?1",
                params![item_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(run_status, "completed");
        assert!(run_owner.is_none());
        assert_eq!(item_status, "completed");
        assert!(item_owner.is_none());
        drop(conn);
        cleanup_provider_settings_fixture(db, db_path, root);
    }

    #[test]
    fn provider_validation_failure_does_not_advance_run_claim_revision() {
        let (db, db_path, root, run_id, artifact_id, item_id, _) =
            provider_settings_fixture("validation-revision");
        let mut invalid = get_ai_settings_for_db(&db).unwrap();
        invalid.base_url = "https://user:secret@example.invalid".into();
        overwrite_ai_settings_for_test(&db, &invalid);
        let error = db
            .understand_content_artifacts_with_seams(
                provider_settings_request(&run_id, &artifact_id),
                None,
                None,
            )
            .expect_err("validation failure must occur before claim");
        assert_eq!(error.to_string(), "content_provider_configuration_invalid");
        let conn = db.conn().unwrap();
        let (revision, provider_revision, owner): (i64, i64, Option<String>) = conn
            .query_row(
                "SELECT revision, provider_revision, provider_owner
                 FROM content_runs WHERE id=?1",
                params![run_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        let running_items: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM content_run_items
                 WHERE id=?1 AND provider_status='running'",
                params![item_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(revision, 1);
        assert_eq!(provider_revision, 1);
        assert!(owner.is_none());
        assert_eq!(running_items, 0);
        drop(conn);
        cleanup_provider_settings_fixture(db, db_path, root);
    }

    #[test]
    fn provider_source_mutation_blocks_complete_understand_orchestration() {
        let root = std::env::temp_dir().join(format!(
            "zen-content-provider-orchestration-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&root).unwrap();
        let path = root.join("source.txt");
        std::fs::write(&path, b"before-send").unwrap();
        let metadata = std::fs::metadata(&path).unwrap();
        let size = metadata.len() as i64;
        let mtime = modified_unix_seconds(&metadata);
        let source_hash = hash_bytes(std::fs::read(&path).unwrap());

        let db_path = std::env::temp_dir().join(format!(
            "zen-content-provider-orchestration-{}.sqlite3",
            uuid::Uuid::new_v4()
        ));
        let db = Database::open(&db_path).unwrap();
        let root_id = "provider-orchestration-root";
        db.conn()
            .unwrap()
            .execute(
                "INSERT INTO scan_roots(
                    id, normalized_path, display_name, source_kind, enabled,
                    health_status, current_generation, revision, needs_reconciliation,
                    created_at, updated_at
                 ) VALUES (?1,?2,?1,'file_library',1,'healthy',1,1,0,1,1)",
                params![root_id, root.to_string_lossy().replace('\\', "/")],
            )
            .unwrap();
        db.insert_file(crate::db::InsertFileRequest {
            id: "provider-orchestration-file".into(),
            path: path.to_string_lossy().replace('\\', "/"),
            name: "source.txt".into(),
            extension: "txt".into(),
            size,
            mtime,
            ctime: mtime,
            is_dir: false,
            state_code: 0,
        })
        .unwrap();
        db.set_content_scope_policy(SetContentScopePolicyRequest {
            version: CONTENT_VERSION,
            root_id: root_id.into(),
            expected_root_revision: 1,
            expected_policy_revision: 0,
            confirmed: true,
            policy: ContentScopePolicyDto {
                root_revision: 1,
                enabled: true,
                local_allowed: true,
                ..default_policy(root_id, 1)
            },
        })
        .unwrap();
        let library_revision = current_library_revision(&db.conn().unwrap()).unwrap();
        let artifact_id = "provider-orchestration-artifact";
        db.conn()
            .unwrap()
            .execute(
                "INSERT INTO content_artifacts(
                    id, file_id, scan_root_id, source_size, source_mtime, source_is_dir,
                    source_hash, extractor_family, extractor_version, policy_revision,
                    content_fingerprint, status, summary, keywords_json, provenance_json,
                    revision, created_at, updated_at
                 ) VALUES (?1,'provider-orchestration-file',?2,?3,?4,0,?5,'txt',
                           'content-extractor-v1',1,'provider-orchestration-fingerprint',
                           'current','before','[]','{}',1,1,1)",
                params![artifact_id, root_id, size, mtime, source_hash],
            )
            .unwrap();
        db.conn()
            .unwrap()
            .execute(
                "INSERT INTO content_runs(
                    id, scope_json, scope_fingerprint, mode, provider_mode, status,
                    expected_library_revision, policy_fingerprint, confirmation,
                    provider_confirmed, revision, created_at, updated_at
                 ) VALUES ('provider-orchestration-run','{}','scope','understand',
                           'existing_interactive_provider','completed',?1,'policy',1,1,1,1,1)",
                params![library_revision],
            )
            .unwrap();
        db.conn()
            .unwrap()
            .execute(
                "INSERT INTO content_run_items(
                    id, run_id, file_id, ordinal, status, root_id, source_is_dir,
                    source_size, source_mtime, source_hash, extractor_family,
                    extractor_version, artifact_id, provider_status, policy_revision,
                    created_at, updated_at
                 ) VALUES ('provider-orchestration-item','provider-orchestration-run',
                           'provider-orchestration-file',0,'completed',?1,0,?2,?3,?4,
                           'txt','content-extractor-v1',?5,'pending',1,1,1)",
                params![root_id, size, mtime, source_hash, artifact_id],
            )
            .unwrap();
        let settings = crate::ai::settings::AISettings {
            enabled: true,
            provider: AIProviderKind::Ollama,
            preset: crate::ai::schema::AIProviderPresetId::Ollama,
            base_url: "http://127.0.0.1:11434".into(),
            model: "test-model".into(),
            ..Default::default()
        };
        db.conn()
            .unwrap()
            .execute(
                "INSERT INTO app_settings(key, value) VALUES (?1, ?2)",
                params![
                    crate::ai::settings::AI_SETTINGS_KEY,
                    serde_json::to_string(&settings).unwrap()
                ],
            )
            .unwrap();
        let saved_policy = db.get_content_scope_policy(root_id).unwrap();
        assert!(saved_policy.enabled && saved_policy.local_allowed);
        let saved_settings = normalize_ai_settings(get_ai_settings_for_db(&db).unwrap());
        assert!(
            saved_settings.enabled && matches!(saved_settings.provider, AIProviderKind::Ollama)
        );

        let invocations = Arc::new(AtomicUsize::new(0));
        let provider = CountingProvider {
            invocations: invocations.clone(),
        };
        let mutation_path = path.clone();
        let mutate_after_extraction = || {
            std::fs::write(&mutation_path, b"changed-after-extraction").unwrap();
        };
        let result = db
            .understand_content_artifacts_with_seams(
                UnderstandContentArtifactsRequest {
                    version: CONTENT_VERSION,
                    artifact_ids: vec![artifact_id.into()],
                    expected_revisions: vec![1],
                    run_id: Some("provider-orchestration-run".into()),
                    expected_run_revision: Some(1),
                    confirmed: true,
                },
                Some(&provider),
                Some(&mutate_after_extraction),
            )
            .unwrap();
        assert_eq!(result.processed_count, 0);
        assert_eq!(result.blocked_count, 1);
        assert_eq!(
            result.reason.as_deref(),
            Some("content_source_changed_before_provider_send")
        );
        assert_eq!(invocations.load(Ordering::SeqCst), 0);

        let conn = db.conn().unwrap();
        let (item_status, item_owner): (String, Option<String>) = conn
            .query_row(
                "SELECT provider_status, provider_owner FROM content_run_items WHERE id='provider-orchestration-item'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        let (run_status, run_owner): (String, Option<String>) = conn
            .query_row(
                "SELECT status, provider_owner FROM content_runs WHERE id='provider-orchestration-run'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(item_status, "stale");
        assert!(item_owner.is_none());
        assert_eq!(run_status, "partially_completed");
        assert!(run_owner.is_none());
        drop(conn);
        drop(db);
        let _ = std::fs::remove_file(db_path);
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn provider_recovery_terminates_claimed_items_and_preserves_completed_items() {
        let db_path = std::env::temp_dir().join(format!(
            "zen-content-provider-recovery-{}.sqlite3",
            uuid::Uuid::new_v4()
        ));
        let db = Database::open(&db_path).unwrap();
        for id in ["provider-recovery-file-a", "provider-recovery-file-b"] {
            db.insert_file(crate::db::InsertFileRequest {
                id: id.into(),
                path: format!("{id}.txt"),
                name: format!("{id}.txt"),
                extension: "txt".into(),
                size: 1,
                mtime: 1,
                ctime: 1,
                is_dir: false,
                state_code: 0,
            })
            .unwrap();
        }
        let conn = db.conn().unwrap();
        conn.execute(
            "INSERT INTO content_runs(
                id, scope_json, scope_fingerprint, mode, provider_mode, status,
                expected_library_revision, policy_fingerprint, confirmation,
                provider_confirmed, created_at, updated_at
             ) VALUES ('provider-recovery-run','{\"kind\":\"all_enabled_roots\"}','scope','understand','existing_interactive_provider','running',1,'policy',1,1,1,1)",
            [],
        )
        .unwrap();
        for (ordinal, suffix) in [(0, "a"), (1, "b")] {
            conn.execute(
                "INSERT INTO content_run_items(
                    id, run_id, file_id, ordinal, status, root_id, source_is_dir,
                    artifact_id, provider_status, source_size, source_mtime, source_hash,
                    policy_revision, created_at, updated_at
                 ) VALUES (?1,'provider-recovery-run',?2,?3,'completed','provider-root',0,?4,'pending',1,1,'hash',1,1,1)",
                params![
                    format!("provider-recovery-item-{suffix}"),
                    format!("provider-recovery-file-{suffix}"),
                    ordinal,
                    format!("provider-recovery-artifact-{suffix}"),
                ],
            )
            .unwrap();
        }
        drop(conn);
        let run_claim = db.claim_provider_phase("provider-recovery-run", 1).unwrap();
        let completed_claim = db
            .claim_provider_item(
                "provider-recovery-run",
                "provider-recovery-artifact-a",
                &run_claim,
            )
            .unwrap()
            .unwrap();
        let _interrupted_claim = db
            .claim_provider_item(
                "provider-recovery-run",
                "provider-recovery-artifact-b",
                &run_claim,
            )
            .unwrap()
            .unwrap();
        db.mark_provider_item(
            "provider-recovery-run",
            "provider-recovery-artifact-a",
            &completed_claim,
            "completed",
            None,
        )
        .unwrap();
        db.recover_content_runs().unwrap();
        let conn = db.conn().unwrap();
        let run_status: String = conn
            .query_row(
                "SELECT status FROM content_runs WHERE id='provider-recovery-run'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let completed_status: String = conn
            .query_row(
                "SELECT provider_status FROM content_run_items WHERE id='provider-recovery-item-a'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let interrupted_status: (String, Option<String>) = conn
            .query_row(
                "SELECT provider_status, provider_owner FROM content_run_items WHERE id='provider-recovery-item-b'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(run_status, "failed");
        assert_eq!(completed_status, "completed");
        assert_eq!(interrupted_status.0, "failed");
        assert!(interrupted_status.1.is_none());
        drop(conn);
        drop(db);
        let _ = std::fs::remove_file(db_path);
    }

    #[test]
    fn provider_cancel_during_send_finishes_run_without_running_items() {
        let db_path = std::env::temp_dir().join(format!(
            "zen-content-provider-cancel-{}.sqlite3",
            uuid::Uuid::new_v4()
        ));
        let db = Database::open(&db_path).unwrap();
        db.insert_file(crate::db::InsertFileRequest {
            id: "provider-cancel-file".into(),
            path: "provider-cancel-file.txt".into(),
            name: "provider-cancel-file.txt".into(),
            extension: "txt".into(),
            size: 1,
            mtime: 1,
            ctime: 1,
            is_dir: false,
            state_code: 0,
        })
        .unwrap();
        let conn = db.conn().unwrap();
        conn.execute(
            "INSERT INTO content_runs(
                id, scope_json, scope_fingerprint, mode, provider_mode, status,
                expected_library_revision, policy_fingerprint, confirmation,
                provider_confirmed, created_at, updated_at
             ) VALUES ('provider-cancel-run','{\"kind\":\"all_enabled_roots\"}','scope','understand','existing_interactive_provider','running',1,'policy',1,1,1,1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO content_run_items(
                id, run_id, file_id, ordinal, status, root_id, source_is_dir,
                artifact_id, provider_status, source_size, source_mtime, source_hash,
                policy_revision, created_at, updated_at
             ) VALUES ('provider-cancel-item','provider-cancel-run','provider-cancel-file',0,'completed','provider-root',0,'provider-cancel-artifact','pending',1,1,'hash',1,1,1)",
            [],
        )
        .unwrap();
        drop(conn);
        let run_claim = db.claim_provider_phase("provider-cancel-run", 1).unwrap();
        db.claim_provider_item(
            "provider-cancel-run",
            "provider-cancel-artifact",
            &run_claim,
        )
        .unwrap()
        .unwrap();
        db.cancel_content_run(ContentRunIdRequest {
            run_id: "provider-cancel-run".into(),
            expected_revision: run_claim.revision,
            confirmed: true,
        })
        .unwrap();
        db.finish_provider_phase(
            "provider-cancel-run",
            &run_claim,
            0,
            Some("content_run_cancelled"),
        )
        .unwrap();
        let conn = db.conn().unwrap();
        let run_status: String = conn
            .query_row(
                "SELECT status FROM content_runs WHERE id='provider-cancel-run'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let item_status: String = conn
            .query_row(
                "SELECT provider_status FROM content_run_items WHERE id='provider-cancel-item'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(run_status, "cancelled");
        assert_eq!(item_status, "cancelled");
        drop(conn);
        drop(db);
        let _ = std::fs::remove_file(db_path);
    }

    #[test]
    fn content_search_stale_cursor_and_scoped_purge_are_fail_closed() {
        let db_path = std::env::temp_dir().join(format!(
            "zen-content-scope-{}.sqlite3",
            uuid::Uuid::new_v4()
        ));
        let db = Database::open(&db_path).unwrap();
        for (root_id, root_path) in [
            ("purge-root-a", "C:/zen/purge-root-a"),
            ("purge-root-b", "C:/zen/purge-root-b"),
        ] {
            db.conn()
                .unwrap()
                .execute(
                    "INSERT INTO scan_roots(
                        id, normalized_path, display_name, source_kind, enabled,
                        health_status, current_generation, revision,
                        needs_reconciliation, created_at, updated_at
                     ) VALUES (?1,?2,?1,'file_library',1,'healthy',1,1,0,1,1)",
                    params![root_id, root_path],
                )
                .unwrap();
            db.set_content_scope_policy(SetContentScopePolicyRequest {
                version: CONTENT_VERSION,
                root_id: root_id.into(),
                expected_root_revision: 1,
                expected_policy_revision: 0,
                confirmed: true,
                policy: ContentScopePolicyDto {
                    root_revision: 1,
                    enabled: true,
                    local_allowed: true,
                    ..default_policy(root_id, 1)
                },
            })
            .unwrap();
        }
        for (file_id, root_id, ordinal) in [
            ("purge-file-a1", "purge-root-a", 1),
            ("purge-file-a2", "purge-root-a", 2),
            ("purge-file-b1", "purge-root-b", 3),
        ] {
            let path = format!("C:/zen/{root_id}/file-{ordinal}.txt");
            db.insert_file(crate::db::InsertFileRequest {
                id: file_id.into(),
                path,
                name: format!("file-{ordinal}.txt"),
                extension: "txt".into(),
                size: 4,
                mtime: ordinal,
                ctime: ordinal,
                is_dir: false,
                state_code: 0,
            })
            .unwrap();
            db.conn()
                .unwrap()
                .execute(
                    "INSERT INTO content_artifacts(
                        id, file_id, scan_root_id, source_size, source_mtime, source_is_dir,
                        source_hash, extractor_family, extractor_version, policy_revision,
                        content_fingerprint, status, summary, keywords_json, provenance_json,
                        revision, created_at, updated_at
                     ) VALUES (?1,?2,?3,4,?4,0,'hash','txt','content-extractor-v1',1,?1,'current',?1,'[]','{}',1,?4,?4)",
                    params![format!("purge-artifact-{file_id}"), file_id, root_id, ordinal],
                )
                .unwrap();
        }
        let scope = FileLibraryScopeV2::Roots {
            scan_root_ids: vec!["purge-root-a".into()],
        };
        let library_revision = current_library_revision(&db.conn().unwrap()).unwrap();
        let content_revision = current_content_revision(&db.conn().unwrap()).unwrap();
        let first = db
            .query_content_artifacts(ContentArtifactPageRequest {
                query: String::new(),
                scope: scope.clone(),
                expected_library_revision: library_revision,
                expected_content_revision: content_revision,
                limit: 1,
                cursor: None,
            })
            .unwrap();
        let cursor = first
            .next_cursor
            .expect("two in-scope artifacts create a cursor");
        db.conn()
            .unwrap()
            .execute(
                "UPDATE content_artifacts SET summary='changed', revision=revision+1 WHERE id='purge-artifact-purge-file-a1'",
                [],
            )
            .unwrap();
        let stale = db.query_content_artifacts(ContentArtifactPageRequest {
            query: String::new(),
            scope: scope.clone(),
            expected_library_revision: library_revision,
            expected_content_revision: content_revision,
            limit: 1,
            cursor: Some(cursor),
        });
        assert_eq!(
            content_error_code(&stale.unwrap_err()),
            "content_catalog_revision_conflict"
        );
        let outside = db
            .get_content_artifact("purge-file-b1")
            .unwrap()
            .expect("outside artifact before purge");
        assert!(db
            .delete_content_artifact(ContentArtifactMutationRequest {
                file_id: "purge-file-b1".into(),
                expected_revision: outside.revision + 1,
                confirmed: true,
            })
            .is_err());
        assert!(db.get_content_artifact("purge-file-b1").unwrap().is_some());
        db.conn()
            .unwrap()
            .execute(
                "INSERT INTO content_runs(
                    id, scope_json, scope_fingerprint, mode, provider_mode, status,
                    expected_library_revision, policy_fingerprint, confirmation,
                    created_at, updated_at
                 ) VALUES ('purge-rollback-run','{\"kind\":\"all_enabled_roots\"}','scope','local','none','completed',1,'policy',1,1,1)",
                [],
            )
            .unwrap();
        db.conn()
            .unwrap()
            .execute(
                "INSERT INTO content_run_items(
                    id, run_id, file_id, ordinal, status, root_id, source_is_dir,
                    artifact_id, source_size, source_mtime, source_hash, created_at, updated_at
                 ) VALUES ('purge-rollback-item','purge-rollback-run','purge-file-b1',0,'completed','purge-root-b',0,'purge-artifact-purge-file-b1',4,3,'hash',1,1)",
                [],
            )
            .unwrap();
        db.conn()
            .unwrap()
            .execute_batch(
                "CREATE TRIGGER task08_abort_delete BEFORE UPDATE OF error_code ON content_run_items WHEN NEW.error_code='content_artifact_deleted' BEGIN SELECT RAISE(ABORT, 'task08 injected delete failure'); END;",
            )
            .unwrap();
        let outside_current = db.get_content_artifact("purge-file-b1").unwrap().unwrap();
        assert!(db
            .delete_content_artifact(ContentArtifactMutationRequest {
                file_id: "purge-file-b1".into(),
                expected_revision: outside_current.revision,
                confirmed: true,
            })
            .is_err());
        assert!(db.get_content_artifact("purge-file-b1").unwrap().is_some());
        db.conn()
            .unwrap()
            .execute_batch("DROP TRIGGER task08_abort_delete;")
            .unwrap();
        db.conn()
            .unwrap()
            .execute_batch(
                "CREATE TRIGGER task08_abort_purge BEFORE DELETE ON content_artifacts WHEN OLD.scan_root_id='purge-root-a' BEGIN SELECT RAISE(ABORT, 'task08 injected purge failure'); END;",
            )
            .unwrap();
        assert!(db
            .purge_content_scope(PurgeContentScopeRequest {
                version: CONTENT_VERSION,
                scope: FileLibraryScopeV2::Roots {
                    scan_root_ids: vec!["purge-root-a".into()],
                },
                expected_library_revision: library_revision,
                expected_policy_revisions: vec![ContentPolicyRevisionRequest {
                    root_id: "purge-root-a".into(),
                    root_revision: 1,
                    policy_revision: 1,
                }],
                confirmed: true,
            })
            .is_err());
        assert!(db.get_content_artifact("purge-file-a1").unwrap().is_some());
        db.conn()
            .unwrap()
            .execute_batch("DROP TRIGGER task08_abort_purge;")
            .unwrap();
        let purged = db
            .purge_content_scope(PurgeContentScopeRequest {
                version: CONTENT_VERSION,
                scope,
                expected_library_revision: library_revision,
                expected_policy_revisions: vec![ContentPolicyRevisionRequest {
                    root_id: "purge-root-a".into(),
                    root_revision: 1,
                    policy_revision: 1,
                }],
                confirmed: true,
            })
            .unwrap();
        assert_eq!(purged, 2);
        assert!(db.get_content_artifact("purge-file-a1").unwrap().is_none());
        assert!(db.get_content_artifact("purge-file-a2").unwrap().is_none());
        assert!(db.get_content_artifact("purge-file-b1").unwrap().is_some());
        drop(db);
        let _ = std::fs::remove_file(db_path);
    }

    #[test]
    fn durable_run_cancellation_sets_owner_signal_and_revision() {
        let db_path = std::env::temp_dir().join(format!(
            "zen-content-cancel-{}.sqlite3",
            uuid::Uuid::new_v4()
        ));
        let db = Database::open(&db_path).unwrap();
        db.conn()
            .unwrap()
            .execute(
                "INSERT INTO content_runs(
                    id, scope_json, scope_fingerprint, mode, provider_mode, status,
                    expected_library_revision, policy_fingerprint, confirmation,
                    created_at, updated_at
                 ) VALUES ('cancel-run','{\"kind\":\"all_enabled_roots\"}','scope','local','none','running',1,'policy',1,1,1)",
                [],
            )
            .unwrap();
        let run = db
            .cancel_content_run(ContentRunIdRequest {
                run_id: "cancel-run".into(),
                expected_revision: 1,
                confirmed: true,
            })
            .unwrap();
        assert_eq!(run.status, "cancelling");
        assert!(run.cancel_requested);
        assert_eq!(run.revision, 2);
        drop(db);
        let _ = std::fs::remove_file(db_path);
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
