//! Task 06 durable organization-plan repository.
//!
//! Plans are review artifacts. Paths and operation kinds are derived from the
//! indexed file authority and are never accepted from renderer requests.

use super::files::operation_preview_from_indexed;
use super::library::{
    canonicalize_file_query_spec, clear_temp_selection_ids, current_library_revision,
    file_matches_authoritative_query_scope, selection_where, FileLibraryScopeV2, FileLibrarySortV2,
    FileQueryFiltersV2, FileQuerySpecV2, LibrarySelectionV1,
};
use super::*;
use rusqlite::{params, params_from_iter, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::{BTreeMap, HashMap, HashSet};

const ORGANIZATION_PLAN_VERSION: i32 = 1;
const ORGANIZATION_PLAN_MAX_ITEMS: usize = 10_000;
const ORGANIZATION_EXECUTION_MAX_ITEMS: usize = 1_000;
const ORGANIZATION_PAGE_MAX: u32 = 200;
const ORGANIZATION_GROUP_SAMPLE_MAX: usize = 3;

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct CreateOrganizationPlanRequestV1 {
    pub version: i32,
    pub request_id: String,
    #[serde(default)]
    pub title: Option<String>,
    pub source: LibrarySelectionV1,
    #[serde(default)]
    pub expected_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationPlanDto {
    pub id: String,
    pub title: String,
    pub status: String,
    pub source_kind: String,
    pub source_query_fingerprint: Option<String>,
    pub source_snapshot_revision: i64,
    pub requested_count: i64,
    pub materialized_count: i64,
    pub planner_version: i64,
    pub revision: i64,
    pub active_execution_id: Option<String>,
    pub active_operation_batch_id: Option<String>,
    pub last_error_code: Option<String>,
    pub last_error_detail: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub ready_at: Option<i64>,
    pub completed_at: Option<i64>,
    pub summary: OrganizationPlanSummaryDto,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationPlanSummaryDto {
    pub undecided: i64,
    pub accepted: i64,
    pub kept: i64,
    pub edited: i64,
    pub needs_analysis: i64,
    pub needs_review: i64,
    pub ready: i64,
    pub blocked: i64,
    pub stale: i64,
    pub executing: i64,
    pub executed: i64,
    pub failed: i64,
    pub skipped: i64,
    pub remaining_executable: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationPlanItemDto {
    pub id: String,
    pub plan_id: String,
    pub ordinal: i64,
    pub file_id_snapshot: String,
    pub source_path_snapshot: String,
    pub source_name_snapshot: String,
    pub source_size_snapshot: i64,
    pub source_mtime_snapshot: i64,
    pub source_is_dir_snapshot: bool,
    pub proposal_fingerprint: String,
    pub proposal_kind: String,
    pub proposed_target_directory: String,
    pub proposed_name: String,
    pub proposed_target_path: String,
    pub decision: String,
    pub edited_name: Option<String>,
    pub validity: String,
    pub review_state: String,
    pub confidence: f64,
    pub risk_level: String,
    pub requires_confirmation: bool,
    pub blocking_code: Option<String>,
    pub blocking_detail: Option<String>,
    pub authoritative_preview_id: Option<String>,
    pub review_reasons: Vec<String>,
    pub available_actions: Vec<String>,
    pub operation_log_id: Option<String>,
    pub execution_id: Option<String>,
    pub revision: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct QueryOrganizationPlanItemsRequest {
    pub plan_id: String,
    #[serde(default)]
    pub cursor: Option<String>,
    pub page_size: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationPlanItemPageDto {
    pub plan_id: String,
    pub plan_revision: i64,
    pub items: Vec<OrganizationPlanItemDto>,
    pub next_cursor: Option<String>,
    pub has_more: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct QueryOrganizationPlanGroupsRequest {
    pub plan_id: String,
    #[serde(default)]
    pub cursor: Option<String>,
    pub page_size: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationPlanGroupSampleDto {
    pub item_id: String,
    pub source_name: String,
    pub source_path: String,
    pub proposed_name: String,
    pub decision: String,
    pub validity: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationReviewReasonCountDto {
    pub reason: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationPlanGroupSummaryDto {
    pub group_id: String,
    pub plan_id: String,
    pub label: String,
    pub target_directory: Option<String>,
    pub proposal_kind: String,
    pub readiness: String,
    pub risk_level: String,
    pub item_count: i64,
    pub total_bytes: i64,
    pub accepted_count: i64,
    pub excluded_count: i64,
    pub stale_count: i64,
    pub conflict_count: i64,
    pub confidence_band: String,
    pub review_reason_counts: Vec<OrganizationReviewReasonCountDto>,
    pub available_actions: Vec<String>,
    pub sample_items: Vec<OrganizationPlanGroupSampleDto>,
    pub revision: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationPlanGroupPageDto {
    pub plan_id: String,
    pub plan_revision: i64,
    pub groups: Vec<OrganizationPlanGroupSummaryDto>,
    pub next_cursor: Option<String>,
    pub has_more: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct QueryOrganizationPlanGroupItemsRequest {
    pub plan_id: String,
    pub group_id: String,
    #[serde(default)]
    pub cursor: Option<String>,
    pub page_size: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationPlanGroupItemPageDto {
    pub plan_id: String,
    pub group_id: String,
    pub plan_revision: i64,
    pub items: Vec<OrganizationPlanItemDto>,
    pub next_cursor: Option<String>,
    pub has_more: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct UpdateOrganizationPlanGroupDecisionRequest {
    pub plan_id: String,
    pub group_id: String,
    pub expected_plan_revision: i64,
    pub decision: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateOrganizationPlanGroupDecisionResultDto {
    pub plan: OrganizationPlanDto,
    pub group: Option<OrganizationPlanGroupSummaryDto>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationDecisionMutation {
    pub item_id: String,
    pub expected_item_revision: i64,
    pub decision: String,
    #[serde(default)]
    pub edited_filename: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct UpdateOrganizationPlanDecisionsRequest {
    pub plan_id: String,
    pub expected_plan_revision: i64,
    #[serde(default)]
    pub safe_batch: bool,
    pub mutations: Vec<OrganizationDecisionMutation>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationPlanRevisionRequest {
    pub plan_id: String,
    pub expected_plan_revision: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct DeleteOrganizationPlanRequest {
    pub plan_id: String,
    pub expected_plan_revision: i64,
    pub confirmed: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeOrganizationPlanItemsRequest {
    pub plan_id: String,
    pub expected_plan_revision: i64,
    #[serde(default)]
    pub item_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeOrganizationPlanItemsResult {
    pub plan_id: String,
    pub queued_count: i64,
    pub requires_refresh: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationPlanSelectionRequest {
    pub plan_id: String,
    pub expected_plan_revision: i64,
    #[serde(default)]
    pub item_ids: Vec<String>,
    #[serde(default)]
    pub all_accepted: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteOrganizationPlanRequest {
    pub plan_id: String,
    pub expected_plan_revision: i64,
    pub dry_run_fingerprint: String,
    #[serde(default)]
    pub item_ids: Vec<String>,
    #[serde(default)]
    pub all_accepted: bool,
    pub confirmed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteOrganizationPlanResultDto {
    pub plan: OrganizationPlanDto,
    pub execution_id: String,
    pub operation_batch_id: String,
    pub attempted_count: i64,
    pub succeeded_count: i64,
    pub failed_count: i64,
    pub skipped_count: i64,
}

pub(crate) struct OrganizationExecutionDispatch {
    pub execution_id: String,
    pub operation_batch_id: String,
    pub item_ids: Vec<String>,
    pub selections: Vec<crate::file_ops::OperationPreviewRequest>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationDryRunItemDto {
    pub item_id: String,
    pub operation_kind: String,
    pub from: String,
    pub to: String,
    pub edited_filename: Option<String>,
    pub parent_directory_to_create: Option<String>,
    pub collision: bool,
    pub cross_volume: bool,
    pub risk_level: String,
    pub requires_confirmation: bool,
    pub source_health: String,
    pub authoritative_preview_id: Option<String>,
    pub executable: bool,
    pub blocking_code: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationPlanDryRunDto {
    pub plan_id: String,
    pub plan_revision: i64,
    pub selected_count: i64,
    pub executable_count: i64,
    pub blocked_count: i64,
    pub stale_count: i64,
    pub total_bytes: i64,
    pub operation_kinds: Vec<String>,
    pub items: Vec<OrganizationDryRunItemDto>,
    pub execution_batch_limit: usize,
    pub dry_run_fingerprint: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OrganizationItemCursor {
    ordinal: i64,
    id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OrganizationGroupCursor {
    label: String,
    group_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OrganizationGroupItemCursor {
    group_id: String,
    ordinal: i64,
    id: String,
}

#[derive(Debug, Clone, Eq, Hash, PartialEq)]
struct OrganizationPlanGroupKey {
    target_directory: String,
    proposal_kind: String,
    readiness: String,
    risk_level: String,
}

#[derive(Debug, Default)]
struct OrganizationPlanGroupAccumulator {
    key: Option<OrganizationPlanGroupKey>,
    group_id: String,
    item_count: i64,
    total_bytes: i64,
    accepted_count: i64,
    excluded_count: i64,
    stale_count: i64,
    conflict_count: i64,
    all_high_confidence: bool,
    all_medium_confidence: bool,
    all_low_confidence: bool,
    review_reason_counts: BTreeMap<String, i64>,
    available_actions: HashSet<String>,
    sample_items: Vec<OrganizationPlanGroupSampleDto>,
}

impl Database {
    pub fn recover_organization_plans(&self) -> Result<usize, DbError> {
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        let now = current_unix_seconds();
        let mut changed = tx.execute(
            "UPDATE organization_plans SET status = 'failed', revision = revision + 1,
                    updated_at = ?1, last_error_code = 'organization_build_interrupted',
                    last_error_detail = 'Plan publication was interrupted before ready.'
             WHERE status = 'building'",
            params![now],
        )?;
        let executing = {
            let mut stmt = tx.prepare(
                "SELECT id, active_execution_id, active_operation_batch_id
                 FROM organization_plans WHERE status = 'executing' ORDER BY id",
            )?;
            let rows = stmt.query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                ))
            })?;
            rows.collect::<Result<Vec<_>, _>>()?
        };
        for (plan_id, execution_id, batch_id) in executing {
            let (Some(execution_id), Some(batch_id)) = (execution_id, batch_id) else {
                tx.execute(
                    "UPDATE organization_plans SET status = 'failed',
                            active_execution_id = NULL, active_operation_batch_id = NULL,
                            revision = revision + 1, updated_at = ?2,
                            last_error_code = 'organization_execution_owner_missing',
                            last_error_detail = 'Execution owner metadata was incomplete.'
                     WHERE id = ?1",
                    params![plan_id, now],
                )?;
                changed += 1;
                continue;
            };
            let log_count: i64 = tx.query_row(
                "SELECT COUNT(*) FROM operation_logs WHERE batch_id = ?1",
                params![batch_id],
                |row| row.get(0),
            )?;
            if log_count == 0 {
                tx.execute(
                    "UPDATE organization_plan_items SET validity = 'ready', execution_id = NULL,
                            revision = revision + 1, updated_at = ?2
                     WHERE plan_id = ?1 AND execution_id = ?3 AND validity = 'executing'",
                    params![plan_id, now, execution_id],
                )?;
                tx.execute(
                    "UPDATE organization_plans SET status = 'ready',
                            active_execution_id = NULL, active_operation_batch_id = NULL,
                            revision = revision + 1, updated_at = ?2,
                            last_error_code = 'organization_execution_not_journaled',
                            last_error_detail = 'No operation journal was created; review before retry.'
                     WHERE id = ?1",
                    params![plan_id, now],
                )?;
                changed += 1;
                continue;
            }
            let executing_items = {
                let mut stmt = tx.prepare(
                    "SELECT id, authoritative_preview_id FROM organization_plan_items
                     WHERE plan_id = ?1 AND execution_id = ?2 AND validity = 'executing'",
                )?;
                let rows = stmt.query_map(params![plan_id, execution_id], |row| {
                    Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?))
                })?;
                rows.collect::<Result<Vec<_>, _>>()?
            };
            let mut unknown = 0_i64;
            for (item_id, preview_id) in executing_items {
                let Some(preview_id) = preview_id else {
                    unknown += 1;
                    continue;
                };
                let log = tx
                    .query_row(
                        "SELECT id, status, operation_phase FROM operation_logs
                         WHERE batch_id = ?1 AND id LIKE ?2 ORDER BY created_at DESC LIMIT 1",
                        params![batch_id, format!("%-{preview_id}")],
                        |row| {
                            Ok((
                                row.get::<_, String>(0)?,
                                row.get::<_, String>(1)?,
                                row.get::<_, String>(2)?,
                            ))
                        },
                    )
                    .optional()?;
                let Some((log_id, status, phase)) = log else {
                    unknown += 1;
                    continue;
                };
                let validity = match status.as_str() {
                    "success" if phase == "completed" => "executed",
                    "failed" => "failed",
                    "skipped" => "skipped",
                    "pending" | "manual_review" => "executing",
                    _ => "executing",
                };
                tx.execute(
                    "UPDATE organization_plan_items SET validity = ?2,
                            operation_log_id = ?3, revision = revision + 1, updated_at = ?4
                     WHERE id = ?1",
                    params![item_id, validity, log_id, now],
                )?;
            }
            let projection = project_organization_plan(&tx, &plan_id, unknown > 0, now)?;
            let (error_code, error_detail) = if unknown > 0 {
                (
                    Some("organization_journal_mapping_unknown"),
                    Some("One or more journal rows could not be mapped; manual review required."),
                )
            } else {
                (None, None)
            };
            tx.execute(
                "UPDATE organization_plans SET status = ?2,
                        active_execution_id = CASE WHEN ?2 = 'executing' THEN active_execution_id ELSE NULL END,
                        active_operation_batch_id = CASE WHEN ?2 = 'executing' THEN active_operation_batch_id ELSE NULL END,
                        revision = revision + 1, updated_at = ?3, completed_at = ?4,
                        last_error_code = ?5, last_error_detail = ?6 WHERE id = ?1",
                params![
                    plan_id,
                    projection.status,
                    now,
                    projection.completed_at,
                    error_code,
                    error_detail
                ],
            )?;
            changed += 1;
        }
        tx.commit()?;
        Ok(changed)
    }

    pub fn prune_organization_plans(&self) -> Result<usize, DbError> {
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        let cutoff = current_unix_seconds().saturating_sub(30 * 24 * 60 * 60);
        let ids = {
            let mut stmt = tx.prepare(
                "WITH terminal AS (
                    SELECT p.id, p.updated_at
                    FROM organization_plans AS p
                    WHERE p.status IN ('completed', 'cancelled', 'failed')
                      AND p.active_execution_id IS NULL
                      AND p.active_operation_batch_id IS NULL
                      AND NOT EXISTS (
                        SELECT 1 FROM organization_plan_items AS i
                        WHERE i.plan_id = p.id AND i.validity = 'executing'
                      )
                      AND NOT EXISTS (
                        SELECT 1
                        FROM organization_plan_items AS i
                        JOIN operation_logs AS l ON l.id = i.operation_log_id
                        WHERE i.plan_id = p.id
                          AND (l.status IN ('pending', 'manual_review')
                               OR l.operation_phase NOT IN ('completed', 'failed'))
                      )
                 ),
                 ranked AS (
                    SELECT id, updated_at,
                           ROW_NUMBER() OVER (ORDER BY updated_at DESC, id) AS terminal_rank
                    FROM terminal
                 ),
                 candidates AS (
                    SELECT id, updated_at FROM ranked WHERE updated_at < ?1
                    UNION
                    SELECT id, updated_at FROM ranked WHERE terminal_rank > 100
                 )
                 SELECT id FROM candidates ORDER BY updated_at, id LIMIT 20",
            )?;
            let rows = stmt.query_map(params![cutoff], |row| row.get::<_, String>(0))?;
            rows.collect::<Result<Vec<_>, _>>()?
        };
        for id in &ids {
            tx.execute(
                "DELETE FROM organization_plan_items WHERE plan_id = ?1",
                params![id],
            )?;
            tx.execute("DELETE FROM organization_plans WHERE id = ?1", params![id])?;
        }
        tx.commit()?;
        Ok(ids.len())
    }

    pub fn create_organization_plan(
        &self,
        request: CreateOrganizationPlanRequestV1,
    ) -> Result<OrganizationPlanDto, DbError> {
        validate_create_request(&request)?;
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        let library_revision = current_library_revision(&tx)?;
        let (where_sql, where_params, missing_count, _, source_fingerprint) =
            selection_where(&tx, &request.source, library_revision)?;
        if missing_count != 0 {
            return Err(DbError::Validation(
                "organization_plan_source_missing".to_string(),
            ));
        }
        let sql = format!(
            "SELECT f.id, f.path, f.name, f.extension, f.size, f.mtime, f.ctime, f.is_dir, f.state_code, \
                    f.file_type, f.purpose, f.lifecycle, f.context, f.risk_level, f.suggested_action, \
                    f.suggested_target_path, f.suggested_name, f.confidence, f.classification_reason, \
                    f.classification_status, f.matched_rules, f.requires_confirmation, f.content_hash, \
                    EXISTS (SELECT 1 FROM active_duplicate_membership AS membership WHERE membership.file_id = f.id), \
                    f.is_stale, f.last_seen_at, f.last_classified_at, f.classified_rule_version, \
                    f.last_classified_mtime, f.last_classified_size \
             FROM files AS f WHERE {where_sql} ORDER BY f.id LIMIT ?"
        );
        let mut query_params = where_params;
        query_params.push(rusqlite::types::Value::Integer(
            ORGANIZATION_PLAN_MAX_ITEMS as i64 + 1,
        ));
        let source_rows = {
            let mut stmt = tx.prepare(&sql)?;
            let rows =
                stmt.query_map(params_from_iter(query_params.iter()), indexed_file_from_row)?;
            rows.collect::<Result<Vec<_>, _>>()?
        };
        if source_rows.len() > ORGANIZATION_PLAN_MAX_ITEMS {
            return Err(DbError::Validation(
                "organization_plan_too_large".to_string(),
            ));
        }
        let materialized_count = source_rows.len() as i64;
        if request
            .expected_count
            .is_some_and(|expected| expected != materialized_count)
        {
            return Err(DbError::Validation(
                "organization_plan_expected_count_mismatch".to_string(),
            ));
        }

        let now = current_unix_seconds();
        let plan_id = format!("organization-plan-{}", uuid::Uuid::new_v4());
        let title = request
            .title
            .as_deref()
            .map(str::trim)
            .filter(|title| !title.is_empty())
            .unwrap_or("Organization plan")
            .to_string();
        let (source_kind, source_query_json, source_snapshot_revision) = match &request.source {
            LibrarySelectionV1::Explicit { .. } => ("explicit", None, library_revision),
            LibrarySelectionV1::AllMatching {
                query,
                snapshot_revision,
                ..
            } => (
                "all_matching",
                Some(serde_json::to_string(query.as_ref())?),
                *snapshot_revision,
            ),
        };
        tx.execute(
            "INSERT INTO organization_plans (
                id, title, status, source_kind, source_query_spec_json,
                source_query_fingerprint, source_snapshot_revision, requested_count,
                materialized_count, planner_version, revision, created_at, updated_at
             ) VALUES (?1, ?2, 'building', ?3, ?4, ?5, ?6, ?7, 0, 1, 1, ?8, ?8)",
            params![
                plan_id,
                title,
                source_kind,
                source_query_json,
                source_fingerprint,
                source_snapshot_revision,
                request.expected_count.unwrap_or(materialized_count),
                now
            ],
        )?;

        for (ordinal, row) in source_rows.into_iter().enumerate() {
            let source_id = row.id.clone();
            let source_path = row.path.clone();
            let source_name = row.name.clone();
            let source_size = row.size;
            let source_mtime = row.mtime;
            let source_is_dir = row.is_dir;
            let classification_status = row.classification_status.clone();
            let suggested_action = row.suggested_action.clone();
            let preview = operation_preview_from_indexed(row);
            let proposal = proposal_from_preview(
                &source_path,
                &source_name,
                classification_status.as_str(),
                suggested_action.as_str(),
                preview,
            );
            tx.execute(
                "INSERT INTO organization_plan_items (
                    id, plan_id, ordinal, file_id_snapshot, source_path_snapshot,
                    source_name_snapshot, source_size_snapshot, source_mtime_snapshot,
                    source_is_dir_snapshot, proposal_fingerprint, proposal_kind,
                    proposed_target_directory, proposed_name, proposed_target_path,
                    decision, edited_name, validity, confidence, risk_level,
                    requires_confirmation, blocking_code, blocking_detail,
                    authoritative_preview_id, revision, created_at, updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
                           ?13, ?14, 'undecided', NULL, ?15, ?16, ?17, ?18, ?19,
                           ?20, ?21, 1, ?22, ?22)",
                params![
                    format!("organization-item-{}", uuid::Uuid::new_v4()),
                    plan_id,
                    ordinal as i64,
                    source_id,
                    source_path,
                    source_name,
                    source_size,
                    source_mtime,
                    i64::from(source_is_dir),
                    proposal.fingerprint,
                    proposal.kind,
                    proposal.target_directory,
                    proposal.name,
                    proposal.target_path,
                    proposal.validity,
                    proposal.confidence,
                    proposal.risk,
                    i64::from(proposal.requires_confirmation),
                    proposal.blocking_code,
                    proposal.blocking_detail,
                    proposal.preview_id,
                    now
                ],
            )?;
        }
        clear_temp_selection_ids(&tx)?;
        tx.execute(
            "UPDATE organization_plans SET status = 'ready', materialized_count = ?2,
                    ready_at = ?3, updated_at = ?3 WHERE id = ?1 AND status = 'building'",
            params![plan_id, materialized_count, now],
        )?;
        let plan = load_plan(&tx, &plan_id)?;
        tx.commit()?;
        Ok(plan)
    }

    pub fn list_organization_plans(&self) -> Result<Vec<OrganizationPlanDto>, DbError> {
        let conn = self.conn()?;
        let mut plans = {
            let mut stmt = conn.prepare(
                "SELECT id, title, status, source_kind, source_query_fingerprint,
                        source_snapshot_revision, requested_count, materialized_count,
                        planner_version, revision, active_execution_id,
                        active_operation_batch_id, last_error_code, last_error_detail,
                        created_at, updated_at, ready_at, completed_at
                 FROM organization_plans ORDER BY updated_at DESC, id LIMIT 200",
            )?;
            let rows = stmt.query_map([], plan_from_row)?;
            rows.collect::<Result<Vec<_>, _>>()?
        };
        for plan in &mut plans {
            plan.summary = load_plan_summary(&conn, &plan.id)?;
        }
        Ok(plans)
    }

    pub fn get_organization_plan(&self, plan_id: &str) -> Result<OrganizationPlanDto, DbError> {
        let conn = self.conn()?;
        load_plan(
            &conn,
            &validate_id(plan_id, "organization_plan_id_invalid")?,
        )
    }

    pub fn query_organization_plan_items(
        &self,
        request: QueryOrganizationPlanItemsRequest,
    ) -> Result<OrganizationPlanItemPageDto, DbError> {
        if request.page_size == 0 || request.page_size > ORGANIZATION_PAGE_MAX {
            return Err(DbError::Validation(
                "organization_plan_page_size_invalid".to_string(),
            ));
        }
        let plan_id = validate_id(&request.plan_id, "organization_plan_id_invalid")?;
        let cursor = request
            .cursor
            .as_deref()
            .map(decode_item_cursor)
            .transpose()?;
        let conn = self.conn()?;
        let plan = load_plan(&conn, &plan_id)?;
        let mut sql = "SELECT id, plan_id, ordinal, file_id_snapshot, source_path_snapshot,
                source_name_snapshot, source_size_snapshot, source_mtime_snapshot,
                source_is_dir_snapshot, proposal_fingerprint, proposal_kind,
                proposed_target_directory, proposed_name, proposed_target_path,
                decision, edited_name, validity, confidence, risk_level,
                requires_confirmation, blocking_code, blocking_detail,
                authoritative_preview_id, operation_log_id, execution_id, revision,
                created_at, updated_at
             FROM organization_plan_items WHERE plan_id = ?1"
            .to_string();
        let mut values = vec![rusqlite::types::Value::Text(plan_id.clone())];
        if let Some(cursor) = cursor {
            sql.push_str(" AND (ordinal > ?2 OR (ordinal = ?2 AND id > ?3))");
            values.push(rusqlite::types::Value::Integer(cursor.ordinal));
            values.push(rusqlite::types::Value::Text(cursor.id));
        }
        sql.push_str(" ORDER BY ordinal, id LIMIT ?");
        values.push(rusqlite::types::Value::Integer(
            i64::from(request.page_size) + 1,
        ));
        let mut items = {
            let mut stmt = conn.prepare(&sql)?;
            let rows = stmt.query_map(params_from_iter(values.iter()), item_from_row)?;
            rows.collect::<Result<Vec<_>, _>>()?
        };
        for item in &mut items {
            decorate_organization_item_metadata(&conn, item)?;
        }
        let has_more = items.len() > request.page_size as usize;
        if has_more {
            items.truncate(request.page_size as usize);
        }
        let next_cursor = items.last().and_then(|item| {
            has_more.then(|| {
                encode_item_cursor(&OrganizationItemCursor {
                    ordinal: item.ordinal,
                    id: item.id.clone(),
                })
            })
        });
        Ok(OrganizationPlanItemPageDto {
            plan_id,
            plan_revision: plan.revision,
            items,
            next_cursor,
            has_more,
        })
    }

    pub fn query_organization_plan_groups(
        &self,
        request: QueryOrganizationPlanGroupsRequest,
    ) -> Result<OrganizationPlanGroupPageDto, DbError> {
        validate_organization_page_size(request.page_size, "organization_group_page_size_invalid")?;
        let plan_id = validate_id(&request.plan_id, "organization_plan_id_invalid")?;
        let cursor = request
            .cursor
            .as_deref()
            .map(decode_group_cursor)
            .transpose()?;
        let conn = self.conn()?;
        let plan = load_plan(&conn, &plan_id)?;
        let mut groups = load_organization_plan_group_summaries(&conn, &plan_id, plan.revision)?;
        if let Some(cursor) = cursor {
            groups.retain(|group| organization_group_is_after(group, &cursor));
        }
        let has_more = groups.len() > request.page_size as usize;
        if has_more {
            groups.truncate(request.page_size as usize);
        }
        let next_cursor = groups.last().and_then(|group| {
            has_more.then(|| {
                encode_group_cursor(&OrganizationGroupCursor {
                    label: group.label.clone(),
                    group_id: group.group_id.clone(),
                })
            })
        });
        Ok(OrganizationPlanGroupPageDto {
            plan_id,
            plan_revision: plan.revision,
            groups,
            next_cursor,
            has_more,
        })
    }

    pub fn query_organization_plan_group_items(
        &self,
        request: QueryOrganizationPlanGroupItemsRequest,
    ) -> Result<OrganizationPlanGroupItemPageDto, DbError> {
        validate_organization_page_size(
            request.page_size,
            "organization_group_item_page_size_invalid",
        )?;
        let plan_id = validate_id(&request.plan_id, "organization_plan_id_invalid")?;
        let group_id = validate_id(&request.group_id, "organization_group_id_invalid")?;
        let cursor = request
            .cursor
            .as_deref()
            .map(decode_group_item_cursor)
            .transpose()?;
        if cursor
            .as_ref()
            .is_some_and(|cursor| cursor.group_id != group_id)
        {
            return Err(DbError::Validation(
                "organization_group_cursor_invalid".to_string(),
            ));
        }
        let conn = self.conn()?;
        let plan = load_plan(&conn, &plan_id)?;
        let mut items = load_organization_plan_items_for_projection(&conn, &plan_id)?
            .into_iter()
            .filter(|item| {
                organization_group_id(&plan_id, &organization_group_key(item)) == group_id
            })
            .collect::<Vec<_>>();
        if items.is_empty() {
            return Err(DbError::Validation(
                "organization_group_not_found".to_string(),
            ));
        }
        if let Some(cursor) = cursor {
            items.retain(|item| {
                item.ordinal > cursor.ordinal
                    || (item.ordinal == cursor.ordinal && item.id > cursor.id)
            });
        }
        let has_more = items.len() > request.page_size as usize;
        if has_more {
            items.truncate(request.page_size as usize);
        }
        let next_cursor = items.last().and_then(|item| {
            has_more.then(|| {
                encode_group_item_cursor(&OrganizationGroupItemCursor {
                    group_id: group_id.clone(),
                    ordinal: item.ordinal,
                    id: item.id.clone(),
                })
            })
        });
        Ok(OrganizationPlanGroupItemPageDto {
            plan_id,
            group_id,
            plan_revision: plan.revision,
            items,
            next_cursor,
            has_more,
        })
    }

    pub fn update_organization_plan_group_decision(
        &self,
        request: UpdateOrganizationPlanGroupDecisionRequest,
    ) -> Result<UpdateOrganizationPlanGroupDecisionResultDto, DbError> {
        let plan_id = validate_id(&request.plan_id, "organization_plan_id_invalid")?;
        let group_id = validate_id(&request.group_id, "organization_group_id_invalid")?;
        let decision = normalize_decision(&request.decision)?;
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        require_plan_revision_and_status(
            &tx,
            &plan_id,
            request.expected_plan_revision,
            &["ready", "stale", "partially_completed"],
        )?;
        let members = load_organization_plan_items_for_projection(&tx, &plan_id)?
            .into_iter()
            .filter(|item| {
                organization_group_id(&plan_id, &organization_group_key(item)) == group_id
            })
            .collect::<Vec<_>>();
        if members.is_empty() {
            return Err(DbError::Validation(
                "organization_group_not_found".to_string(),
            ));
        }

        let mut selected = Vec::new();
        for item in members {
            if matches!(item.validity.as_str(), "executing" | "executed") {
                continue;
            }
            if decision == "accepted" && require_safe_batch_item(&tx, &plan_id, &item.id).is_err() {
                continue;
            }
            selected.push(item);
        }
        if selected.is_empty() {
            return Err(DbError::Validation(
                if decision == "accepted" {
                    "organization_group_no_safe_items"
                } else {
                    "organization_group_no_decidable_items"
                }
                .to_string(),
            ));
        }

        let now = current_unix_seconds();
        for item in selected {
            let updated = tx.execute(
                "UPDATE organization_plan_items SET decision = ?1, edited_name = NULL,
                        revision = revision + 1, updated_at = ?2
                 WHERE id = ?3 AND plan_id = ?4 AND revision = ?5
                   AND validity NOT IN ('executing', 'executed')",
                params![decision, now, item.id, plan_id, item.revision],
            )?;
            if updated != 1 {
                return Err(DbError::Validation(
                    "organization_item_revision_conflict".to_string(),
                ));
            }
        }
        let updated_plan = tx.execute(
            "UPDATE organization_plans SET
                    status = CASE
                        WHEN status = 'stale'
                         AND NOT EXISTS (
                            SELECT 1 FROM organization_plan_items
                            WHERE plan_id = ?1 AND validity = 'stale'
                         )
                        THEN 'ready' ELSE status END,
                    revision = revision + 1, updated_at = ?3
             WHERE id = ?1 AND revision = ?2",
            params![plan_id, request.expected_plan_revision, now],
        )?;
        if updated_plan != 1 {
            return Err(DbError::Validation(
                "organization_plan_revision_conflict".to_string(),
            ));
        }
        let plan = load_plan(&tx, &plan_id)?;
        let group = load_organization_plan_group_summaries(&tx, &plan_id, plan.revision)?
            .into_iter()
            .find(|group| group.group_id == group_id);
        tx.commit()?;
        Ok(UpdateOrganizationPlanGroupDecisionResultDto { plan, group })
    }

    pub fn update_organization_plan_decisions(
        &self,
        request: UpdateOrganizationPlanDecisionsRequest,
    ) -> Result<OrganizationPlanDto, DbError> {
        if request.mutations.is_empty() || request.mutations.len() > ORGANIZATION_PLAN_MAX_ITEMS {
            return Err(DbError::Validation(
                "organization_decision_batch_invalid".to_string(),
            ));
        }
        let plan_id = validate_id(&request.plan_id, "organization_plan_id_invalid")?;
        let mut unique = HashSet::new();
        if request
            .mutations
            .iter()
            .any(|mutation| !unique.insert(mutation.item_id.as_str()))
        {
            return Err(DbError::Validation(
                "organization_decision_duplicate_item".to_string(),
            ));
        }
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        require_plan_revision_and_status(
            &tx,
            &plan_id,
            request.expected_plan_revision,
            &["ready", "stale", "partially_completed"],
        )?;
        let now = current_unix_seconds();
        for mutation in request.mutations {
            let item_id = validate_id(&mutation.item_id, "organization_item_id_invalid")?;
            let decision = normalize_decision(&mutation.decision)?;
            if request.safe_batch {
                if decision != "accepted" {
                    return Err(DbError::Validation(
                        "organization_safe_batch_accept_only".to_string(),
                    ));
                }
                require_safe_batch_item(&tx, &plan_id, &item_id)?;
            }
            let edited_name = if decision == "edited" {
                Some(validate_edited_filename(
                    &tx,
                    &plan_id,
                    &item_id,
                    mutation.edited_filename.as_deref(),
                )?)
            } else {
                None
            };
            let updated = tx.execute(
                "UPDATE organization_plan_items SET decision = ?1, edited_name = ?2,
                        revision = revision + 1, updated_at = ?3
                 WHERE id = ?4 AND plan_id = ?5 AND revision = ?6
                   AND validity NOT IN ('executing', 'executed')",
                params![
                    decision,
                    edited_name,
                    now,
                    item_id,
                    plan_id,
                    mutation.expected_item_revision
                ],
            )?;
            if updated != 1 {
                return Err(DbError::Validation(
                    "organization_item_revision_conflict".to_string(),
                ));
            }
        }
        tx.execute(
            "UPDATE organization_plans SET
                    status = CASE
                        WHEN status = 'stale'
                         AND NOT EXISTS (
                            SELECT 1 FROM organization_plan_items
                            WHERE plan_id = ?1 AND validity = 'stale'
                         )
                        THEN 'ready' ELSE status END,
                    revision = revision + 1, updated_at = ?3
             WHERE id = ?1 AND revision = ?2",
            params![plan_id, request.expected_plan_revision, now],
        )?;
        let plan = load_plan(&tx, &plan_id)?;
        tx.commit()?;
        Ok(plan)
    }

    pub fn refresh_organization_plan(
        &self,
        request: OrganizationPlanRevisionRequest,
    ) -> Result<OrganizationPlanDto, DbError> {
        let plan_id = validate_id(&request.plan_id, "organization_plan_id_invalid")?;
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        require_plan_revision_and_status(
            &tx,
            &plan_id,
            request.expected_plan_revision,
            &["ready", "stale", "partially_completed"],
        )?;
        let source_query = match load_plan_source_query(&tx, &plan_id) {
            Ok(query) => query,
            Err(_) => {
                mark_plan_scope_stale(
                    &tx,
                    &plan_id,
                    request.expected_plan_revision,
                    "organization_source_provenance_invalid",
                )?;
                let plan = load_plan(&tx, &plan_id)?;
                tx.commit()?;
                return Ok(plan);
            }
        };
        let item_ids = {
            let mut stmt = tx.prepare(
                "SELECT id, file_id_snapshot, proposal_fingerprint, decision
                 FROM organization_plan_items WHERE plan_id = ?1
                   AND validity NOT IN ('executing', 'executed') ORDER BY ordinal, id",
            )?;
            let rows = stmt.query_map(params![plan_id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                ))
            })?;
            rows.collect::<Result<Vec<_>, _>>()?
        };
        let now = current_unix_seconds();
        let mut any_stale = false;
        for (item_id, file_id, old_fingerprint, decision) in item_ids {
            let row = load_indexed_file_by_id(&tx, &file_id)?;
            let Some(row) = row else {
                any_stale = true;
                tx.execute(
                    "UPDATE organization_plan_items SET validity = 'stale',
                            blocking_code = 'source_missing',
                            blocking_detail = 'The indexed source is no longer available.',
                            revision = revision + 1, updated_at = ?2 WHERE id = ?1",
                    params![item_id, now],
                )?;
                continue;
            };
            match file_matches_authoritative_query_scope(&tx, &source_query, &file_id) {
                Ok(true) => {}
                Ok(false) | Err(_) => {
                    any_stale = true;
                    tx.execute(
                        "UPDATE organization_plan_items SET validity = 'stale',
                                blocking_code = 'managed_scope_unavailable',
                                blocking_detail = 'The source is no longer in the current healthy managed scope.',
                                decision = 'undecided', edited_name = NULL,
                                revision = revision + 1, updated_at = ?2 WHERE id = ?1",
                        params![item_id, now],
                    )?;
                    continue;
                }
            }
            let source_path = row.path.clone();
            let source_name = row.name.clone();
            let classification_status = row.classification_status.clone();
            let suggested_action = row.suggested_action.clone();
            let proposal = proposal_from_preview(
                &source_path,
                &source_name,
                classification_status.as_str(),
                suggested_action.as_str(),
                operation_preview_from_indexed(row),
            );
            let changed = proposal.fingerprint != old_fingerprint;
            let validity = if changed && matches!(decision.as_str(), "accepted" | "edited") {
                any_stale = true;
                "needs_review"
            } else {
                proposal.validity.as_str()
            };
            let reset_review = changed && matches!(decision.as_str(), "accepted" | "edited");
            tx.execute(
                "UPDATE organization_plan_items SET proposal_fingerprint = ?2,
                        proposal_kind = ?3, proposed_target_directory = ?4,
                        proposed_name = ?5, proposed_target_path = ?6, validity = ?7,
                        confidence = ?8, risk_level = ?9, requires_confirmation = ?10,
                        blocking_code = ?11, blocking_detail = ?12,
                        authoritative_preview_id = ?13, revision = revision + 1,
                        decision = CASE WHEN ?14 THEN 'undecided' ELSE decision END,
                        edited_name = CASE WHEN ?14 THEN NULL ELSE edited_name END,
                        updated_at = ?15 WHERE id = ?1",
                params![
                    item_id,
                    proposal.fingerprint,
                    proposal.kind,
                    proposal.target_directory,
                    proposal.name,
                    proposal.target_path,
                    validity,
                    proposal.confidence,
                    proposal.risk,
                    i64::from(proposal.requires_confirmation),
                    proposal.blocking_code,
                    proposal.blocking_detail,
                    proposal.preview_id,
                    reset_review,
                    now
                ],
            )?;
        }
        let status = if any_stale { "stale" } else { "ready" };
        tx.execute(
            "UPDATE organization_plans SET status = ?3, revision = revision + 1,
                    updated_at = ?4, last_error_code = NULL, last_error_detail = NULL
             WHERE id = ?1 AND revision = ?2",
            params![plan_id, request.expected_plan_revision, status, now],
        )?;
        let plan = load_plan(&tx, &plan_id)?;
        tx.commit()?;
        Ok(plan)
    }

    pub fn cancel_organization_plan(
        &self,
        request: OrganizationPlanRevisionRequest,
    ) -> Result<OrganizationPlanDto, DbError> {
        let plan_id = validate_id(&request.plan_id, "organization_plan_id_invalid")?;
        let conn = self.conn()?;
        let updated = conn.execute(
            "UPDATE organization_plans SET status = 'cancelled', revision = revision + 1,
                    updated_at = ?3 WHERE id = ?1 AND revision = ?2
                    AND status IN ('draft', 'building', 'ready', 'stale')",
            params![
                plan_id,
                request.expected_plan_revision,
                current_unix_seconds()
            ],
        )?;
        if updated != 1 {
            return Err(DbError::Validation(
                "organization_plan_revision_conflict".to_string(),
            ));
        }
        load_plan(&conn, &plan_id)
    }

    pub fn delete_organization_plan(
        &self,
        request: DeleteOrganizationPlanRequest,
    ) -> Result<bool, DbError> {
        if !request.confirmed {
            return Err(DbError::Validation(
                "organization_plan_delete_confirmation_required".to_string(),
            ));
        }
        let plan_id = validate_id(&request.plan_id, "organization_plan_id_invalid")?;
        let conn = self.conn()?;
        let changed = conn.execute(
            "DELETE FROM organization_plans WHERE id = ?1 AND revision = ?2
             AND status IN ('completed', 'cancelled', 'failed')
             AND active_operation_batch_id IS NULL",
            params![plan_id, request.expected_plan_revision],
        )?;
        if changed != 1 {
            return Err(DbError::Validation(
                "organization_plan_delete_blocked".to_string(),
            ));
        }
        Ok(true)
    }

    pub fn analyze_organization_plan_items(
        &self,
        request: AnalyzeOrganizationPlanItemsRequest,
    ) -> Result<AnalyzeOrganizationPlanItemsResult, DbError> {
        if request.item_ids.len() > 100 {
            return Err(DbError::Validation(
                "organization_ai_batch_too_large".to_string(),
            ));
        }
        let plan_id = validate_id(&request.plan_id, "organization_plan_id_invalid")?;
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        require_plan_revision_and_status(
            &tx,
            &plan_id,
            request.expected_plan_revision,
            &["ready", "stale", "partially_completed"],
        )?;
        let requested = request
            .item_ids
            .into_iter()
            .map(|id| validate_id(&id, "organization_item_id_invalid"))
            .collect::<Result<HashSet<_>, _>>()?;
        let (candidate_sql, candidate_params) = if requested.is_empty() {
            (
                "SELECT id, file_id_snapshot FROM organization_plan_items
                 WHERE plan_id = ? AND validity = 'needs_analysis' ORDER BY ordinal, id LIMIT 101"
                    .to_string(),
                vec![plan_id.clone()],
            )
        } else {
            (
                format!(
                    "SELECT id, file_id_snapshot FROM organization_plan_items
                     WHERE plan_id = ? AND id IN ({}) ORDER BY ordinal, id LIMIT 101",
                    std::iter::repeat_n("?", requested.len())
                        .collect::<Vec<_>>()
                        .join(",")
                ),
                std::iter::once(plan_id.clone())
                    .chain(requested.iter().cloned())
                    .collect(),
            )
        };
        let mut stmt = tx.prepare(&candidate_sql)?;
        let candidates = stmt
            .query_map(params_from_iter(candidate_params.iter()), |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        drop(stmt);
        let file_ids = candidates
            .into_iter()
            .take(100)
            .map(|(_, file_id)| file_id)
            .collect::<Vec<_>>();
        let queued_count =
            crate::global_index::enqueue_managed_ai_for_library_files(&tx, &file_ids)? as i64;
        tx.commit()?;
        Ok(AnalyzeOrganizationPlanItemsResult {
            plan_id,
            queued_count,
            requires_refresh: true,
        })
    }

    pub fn get_organization_plan_dry_run(
        &self,
        request: OrganizationPlanSelectionRequest,
    ) -> Result<OrganizationPlanDryRunDto, DbError> {
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        let dry_run = build_organization_dry_run(&tx, &request)?;
        tx.commit()?;
        Ok(dry_run)
    }

    pub(crate) fn begin_organization_plan_execution(
        &self,
        request: &ExecuteOrganizationPlanRequest,
    ) -> Result<OrganizationExecutionDispatch, DbError> {
        if !request.confirmed {
            return Err(DbError::Validation(
                "organization_execution_confirmation_required".to_string(),
            ));
        }
        let dry_run = self.get_organization_plan_dry_run(OrganizationPlanSelectionRequest {
            plan_id: request.plan_id.clone(),
            expected_plan_revision: request.expected_plan_revision,
            item_ids: request.item_ids.clone(),
            all_accepted: request.all_accepted,
        })?;
        if dry_run.dry_run_fingerprint != request.dry_run_fingerprint {
            return Err(DbError::Validation(
                "organization_dry_run_expired".to_string(),
            ));
        }
        let execution_id = format!("organization-execution-{}", uuid::Uuid::new_v4());
        let operation_batch_id = format!("organization-operation-{}", uuid::Uuid::new_v4());
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        require_plan_revision_and_status(
            &tx,
            &request.plan_id,
            request.expected_plan_revision,
            &["ready", "partially_completed"],
        )?;
        let live_dry_run = build_organization_dry_run(
            &tx,
            &OrganizationPlanSelectionRequest {
                plan_id: request.plan_id.clone(),
                expected_plan_revision: request.expected_plan_revision,
                item_ids: request.item_ids.clone(),
                all_accepted: request.all_accepted,
            },
        )?;
        if live_dry_run.dry_run_fingerprint != request.dry_run_fingerprint
            || live_dry_run.dry_run_fingerprint != dry_run.dry_run_fingerprint
        {
            return Err(DbError::Validation(
                "organization_dry_run_expired".to_string(),
            ));
        }
        let executable_items = live_dry_run
            .items
            .iter()
            .filter(|item| item.executable)
            .take(ORGANIZATION_EXECUTION_MAX_ITEMS)
            .collect::<Vec<_>>();
        if executable_items.is_empty() {
            return Err(DbError::Validation(
                "organization_execution_no_executable_items".to_string(),
            ));
        }
        let executable_ids = executable_items
            .iter()
            .map(|item| item.item_id.clone())
            .collect::<Vec<_>>();
        let now = current_unix_seconds();
        let mut selections = Vec::with_capacity(executable_ids.len());
        for live_item in executable_items {
            let item_id = &live_item.item_id;
            let (file_id, source_name, validity, decision): (String, String, String, String) = tx
                .query_row(
                "SELECT file_id_snapshot, source_name_snapshot, validity, decision
                 FROM organization_plan_items WHERE id = ?1 AND plan_id = ?2",
                params![item_id, request.plan_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )?;
            if !matches!(validity.as_str(), "ready" | "needs_review")
                || !matches!(decision.as_str(), "accepted" | "edited")
            {
                return Err(DbError::Validation(
                    "organization_execution_item_changed".to_string(),
                ));
            }
            selections.push(crate::file_ops::OperationPreviewRequest {
                id: live_item.authoritative_preview_id.clone().ok_or_else(|| {
                    DbError::Validation("organization_preview_missing".to_string())
                })?,
                file_id,
                operation_type: live_item.operation_kind.clone(),
                source_path: live_item.from.clone(),
                target_path: live_item.to.clone(),
                old_name: source_name,
                new_name: std::path::Path::new(&live_item.to)
                    .file_name()
                    .and_then(|name| name.to_str())
                    .ok_or_else(|| {
                        DbError::Validation("organization_target_name_invalid".to_string())
                    })?
                    .to_string(),
                is_executable: Some(true),
            });
            let claimed = tx.execute(
                "UPDATE organization_plan_items SET validity = 'executing',
                        execution_id = ?2, revision = revision + 1, updated_at = ?3
                 WHERE id = ?1 AND validity IN ('ready', 'needs_review')",
                params![item_id, execution_id, now],
            )?;
            if claimed != 1 {
                return Err(DbError::Validation(
                    "organization_execution_item_changed".to_string(),
                ));
            }
        }
        let updated = tx.execute(
            "UPDATE organization_plans SET status = 'executing',
                    active_execution_id = ?3, active_operation_batch_id = ?4,
                    revision = revision + 1, updated_at = ?5
             WHERE id = ?1 AND revision = ?2
               AND status IN ('ready', 'partially_completed')",
            params![
                request.plan_id,
                request.expected_plan_revision,
                execution_id,
                operation_batch_id,
                now
            ],
        )?;
        if updated != 1 {
            return Err(DbError::Validation(
                "organization_plan_revision_conflict".to_string(),
            ));
        }
        tx.commit()?;
        Ok(OrganizationExecutionDispatch {
            execution_id,
            operation_batch_id,
            item_ids: executable_ids,
            selections,
        })
    }

    pub(crate) fn finalize_organization_plan_execution(
        &self,
        plan_id: &str,
        dispatch: &OrganizationExecutionDispatch,
        logs: &[crate::file_ops::OperationLogDto],
    ) -> Result<ExecuteOrganizationPlanResultDto, DbError> {
        if dispatch.item_ids.len() != logs.len() {
            return Err(DbError::Validation(
                "organization_execution_log_mapping_invalid".to_string(),
            ));
        }
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        let owner: Option<(String, String)> = tx
            .query_row(
                "SELECT active_execution_id, active_operation_batch_id
                 FROM organization_plans WHERE id = ?1 AND status = 'executing'",
                params![plan_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;
        if owner
            != Some((
                dispatch.execution_id.clone(),
                dispatch.operation_batch_id.clone(),
            ))
        {
            return Err(DbError::Validation(
                "organization_execution_owner_mismatch".to_string(),
            ));
        }
        let now = current_unix_seconds();
        let mut succeeded = 0_i64;
        let mut failed = 0_i64;
        let mut skipped = 0_i64;
        for (item_id, log) in dispatch.item_ids.iter().zip(logs.iter()) {
            let validity = match log.status.as_str() {
                "success" => {
                    succeeded += 1;
                    "executed"
                }
                "skipped" => {
                    skipped += 1;
                    "skipped"
                }
                _ => {
                    failed += 1;
                    "failed"
                }
            };
            tx.execute(
                "UPDATE organization_plan_items SET validity = ?2,
                        operation_log_id = ?3, revision = revision + 1, updated_at = ?4
                 WHERE id = ?1 AND execution_id = ?5 AND validity = 'executing'",
                params![item_id, validity, log.id, now, dispatch.execution_id],
            )?;
        }
        let projection = project_organization_plan(&tx, plan_id, false, now)?;
        tx.execute(
            "UPDATE organization_plans SET status = ?2, active_execution_id = NULL,
                    active_operation_batch_id = NULL, revision = revision + 1,
                    updated_at = ?3, completed_at = ?4,
                    last_error_code = CASE WHEN ?5 > 0 THEN 'organization_items_failed' ELSE NULL END,
                    last_error_detail = CASE WHEN ?5 > 0 THEN CAST(?5 AS TEXT) || ' item(s) failed' ELSE NULL END
             WHERE id = ?1 AND active_execution_id = ?6",
            params![
                plan_id,
                projection.status,
                now,
                projection.completed_at,
                failed,
                dispatch.execution_id
            ],
        )?;
        let plan = load_plan(&tx, plan_id)?;
        tx.commit()?;
        Ok(ExecuteOrganizationPlanResultDto {
            plan,
            execution_id: dispatch.execution_id.clone(),
            operation_batch_id: dispatch.operation_batch_id.clone(),
            attempted_count: logs.len() as i64,
            succeeded_count: succeeded,
            failed_count: failed,
            skipped_count: skipped,
        })
    }

    pub(crate) fn fail_unjournaled_organization_execution(
        &self,
        plan_id: &str,
        dispatch: &OrganizationExecutionDispatch,
        error: &str,
    ) -> Result<(), DbError> {
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        let journal_count: i64 = tx.query_row(
            "SELECT COUNT(*) FROM operation_logs WHERE batch_id = ?1",
            params![dispatch.operation_batch_id],
            |row| row.get(0),
        )?;
        if journal_count > 0 {
            return Ok(());
        }
        let now = current_unix_seconds();
        tx.execute(
            "UPDATE organization_plan_items SET validity = 'ready', execution_id = NULL,
                    revision = revision + 1, updated_at = ?2
             WHERE plan_id = ?1 AND execution_id = ?3 AND validity = 'executing'",
            params![plan_id, now, dispatch.execution_id],
        )?;
        tx.execute(
            "UPDATE organization_plans SET status = 'failed',
                    active_execution_id = NULL, active_operation_batch_id = NULL,
                    revision = revision + 1, updated_at = ?2,
                    last_error_code = 'organization_execution_dispatch_failed',
                    last_error_detail = ?3
             WHERE id = ?1 AND active_execution_id = ?4",
            params![
                plan_id,
                now,
                error.chars().take(512).collect::<String>(),
                dispatch.execution_id
            ],
        )?;
        tx.commit()?;
        Ok(())
    }
}

#[derive(Debug)]
struct OrganizationPlanProjection {
    status: &'static str,
    completed_at: Option<i64>,
}

fn project_organization_plan(
    conn: &rusqlite::Connection,
    plan_id: &str,
    unknown_mapping: bool,
    now: i64,
) -> Result<OrganizationPlanProjection, DbError> {
    if unknown_mapping {
        return Ok(OrganizationPlanProjection {
            status: "stale",
            completed_at: None,
        });
    }
    let (remaining, unresolved, failed_or_skipped): (i64, i64, i64) = conn.query_row(
        "SELECT
            COALESCE(SUM(CASE
                WHEN decision IN ('accepted', 'edited')
                 AND validity IN ('ready', 'needs_review')
                THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN validity = 'executing' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN validity IN ('failed', 'skipped') THEN 1 ELSE 0 END), 0)
         FROM organization_plan_items WHERE plan_id = ?1",
        params![plan_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )?;
    if unresolved > 0 {
        Ok(OrganizationPlanProjection {
            status: "executing",
            completed_at: None,
        })
    } else if remaining > 0 || failed_or_skipped > 0 {
        Ok(OrganizationPlanProjection {
            status: "partially_completed",
            completed_at: None,
        })
    } else {
        Ok(OrganizationPlanProjection {
            status: "completed",
            completed_at: Some(now),
        })
    }
}

#[derive(Debug)]
struct Proposal {
    fingerprint: String,
    kind: String,
    target_directory: String,
    name: String,
    target_path: String,
    validity: String,
    confidence: f64,
    risk: String,
    requires_confirmation: bool,
    blocking_code: Option<String>,
    blocking_detail: Option<String>,
    preview_id: Option<String>,
}

fn proposal_from_preview(
    source_path: &str,
    source_name: &str,
    classification_status: &str,
    suggested_action: &str,
    preview: Option<OperationPreviewDto>,
) -> Proposal {
    let mut proposal = if matches!(suggested_action, "DeleteCandidate" | "Review") {
        Proposal {
            fingerprint: String::new(),
            kind: "blocked".to_string(),
            target_directory: parent_directory(source_path),
            name: source_name.to_string(),
            target_path: source_path.to_string(),
            validity: "blocked".to_string(),
            confidence: 0.0,
            risk: "Caution".to_string(),
            requires_confirmation: true,
            blocking_code: Some("cleanup_review_required".to_string()),
            blocking_detail: Some(
                "Delete and cleanup candidates must use the existing Cleanup review flow."
                    .to_string(),
            ),
            preview_id: None,
        }
    } else if let Some(preview) = preview {
        let validity = if preview.is_executable != Some(true) {
            "blocked"
        } else if preview.risk_level != "Normal"
            || preview.confidence < 0.8
            || preview.is_duplicate
            || preview.requires_confirmation
            || preview.will_create_parent == Some(true)
        {
            "needs_review"
        } else {
            "ready"
        };
        Proposal {
            fingerprint: String::new(),
            kind: preview.operation_type,
            target_directory: parent_directory(&preview.target_path),
            name: preview.new_name,
            target_path: preview.target_path,
            validity: validity.to_string(),
            confidence: preview.confidence,
            risk: preview.risk_level,
            requires_confirmation: preview.requires_confirmation,
            blocking_code: preview
                .blocking_reason
                .as_ref()
                .map(|_| "authoritative_preview_blocked".to_string()),
            blocking_detail: preview.blocking_reason,
            preview_id: Some(preview.id),
        }
    } else if classification_status == "unclassified" {
        Proposal {
            fingerprint: String::new(),
            kind: "keep".to_string(),
            target_directory: parent_directory(source_path),
            name: source_name.to_string(),
            target_path: source_path.to_string(),
            validity: "needs_analysis".to_string(),
            confidence: 0.0,
            risk: "Unknown".to_string(),
            requires_confirmation: true,
            blocking_code: None,
            blocking_detail: None,
            preview_id: None,
        }
    } else {
        Proposal {
            fingerprint: String::new(),
            kind: "keep".to_string(),
            target_directory: parent_directory(source_path),
            name: source_name.to_string(),
            target_path: source_path.to_string(),
            validity: "ready".to_string(),
            confidence: 1.0,
            risk: "Normal".to_string(),
            requires_confirmation: false,
            blocking_code: None,
            blocking_detail: None,
            preview_id: None,
        }
    };
    proposal.fingerprint = proposal_fingerprint(&proposal, source_path);
    proposal
}

fn proposal_fingerprint(proposal: &Proposal, source_path: &str) -> String {
    blake3::hash(
        [
            source_path,
            &proposal.kind,
            &proposal.target_directory,
            &proposal.name,
            &proposal.target_path,
            &proposal.validity,
            &proposal.confidence.to_bits().to_string(),
            &proposal.risk,
            if proposal.requires_confirmation {
                "1"
            } else {
                "0"
            },
            proposal.blocking_code.as_deref().unwrap_or(""),
            proposal.preview_id.as_deref().unwrap_or(""),
        ]
        .join("\0")
        .as_bytes(),
    )
    .to_hex()
    .to_string()
}

fn validate_create_request(request: &CreateOrganizationPlanRequestV1) -> Result<(), DbError> {
    if request.version != ORGANIZATION_PLAN_VERSION
        || request.request_id.trim().is_empty()
        || request.request_id.chars().count() > 128
        || request.title.as_ref().is_some_and(|title| {
            title.chars().count() > 128 || title.chars().any(|c| c.is_control())
        })
        || request.expected_count.is_some_and(|count| count < 0)
    {
        return Err(DbError::Validation(
            "organization_plan_request_invalid".to_string(),
        ));
    }
    Ok(())
}

fn require_safe_batch_item(conn: &Connection, plan_id: &str, item_id: &str) -> Result<(), DbError> {
    let item: (
        String,
        String,
        String,
        f64,
        String,
        bool,
        Option<String>,
        Option<String>,
    ) = conn
        .query_row(
            "SELECT source_path_snapshot, proposed_target_path, validity, confidence,
                    risk_level, requires_confirmation, blocking_code,
                    authoritative_preview_id
             FROM organization_plan_items WHERE plan_id = ?1 AND id = ?2",
            params![plan_id, item_id],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get::<_, i64>(5)? != 0,
                    row.get(6)?,
                    row.get(7)?,
                ))
            },
        )
        .optional()?
        .ok_or_else(|| DbError::Validation("organization_item_not_found".to_string()))?;
    let target = std::path::Path::new(&item.1);
    let target_parent_exists = target.parent().is_some_and(std::path::Path::exists);
    let collision = item.1 != item.0 && target.exists();
    let safe = item.2 == "ready"
        && item.4 == "Normal"
        && item.3 >= 0.8
        && !item.5
        && !paths_cross_volume(&item.0, &item.1)
        && target_parent_exists
        && !collision
        && item.6.is_none()
        && item.7.is_some();
    if !safe {
        return Err(DbError::Validation(
            "organization_safe_batch_item_blocked".to_string(),
        ));
    }
    Ok(())
}

fn normalize_decision(value: &str) -> Result<&'static str, DbError> {
    match value {
        "accept" | "accepted" => Ok("accepted"),
        "keep" | "kept" => Ok("kept"),
        "edit" | "edited" => Ok("edited"),
        "clear" | "undecided" => Ok("undecided"),
        _ => Err(DbError::Validation(
            "organization_decision_invalid".to_string(),
        )),
    }
}

fn validate_edited_filename(
    conn: &rusqlite::Connection,
    plan_id: &str,
    item_id: &str,
    value: Option<&str>,
) -> Result<String, DbError> {
    let value = value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| DbError::Validation("organization_edited_name_required".to_string()))?;
    let (file_id, preview_id): (String, Option<String>) = conn.query_row(
        "SELECT file_id_snapshot, authoritative_preview_id
         FROM organization_plan_items WHERE id = ?1 AND plan_id = ?2",
        params![item_id, plan_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    let preview_id = preview_id.ok_or_else(|| {
        DbError::Validation("organization_item_has_no_editable_preview".to_string())
    })?;
    let previews = {
        let row = load_indexed_file_by_id(conn, &file_id)?
            .ok_or_else(|| DbError::Validation("organization_source_missing".to_string()))?;
        operation_preview_from_indexed(row)
    };
    let preview = previews
        .filter(|preview| preview.id == preview_id)
        .ok_or_else(|| DbError::Validation("organization_preview_stale".to_string()))?;
    let (_, extension, is_dir) = conn.query_row(
        "SELECT name, extension, is_dir FROM files WHERE id = ?1 AND is_stale = 0",
        params![file_id],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)? != 0,
            ))
        },
    )?;
    let original_name: String = conn.query_row(
        "SELECT name FROM files WHERE id = ?1",
        params![file_id],
        |row| row.get(0),
    )?;
    let normalized = crate::file_naming::normalize_proposed_file_name(
        &original_name,
        &extension,
        value,
        is_dir,
        crate::file_naming::ExtensionChangePolicy::Preserve,
    )
    .map_err(DbError::Validation)?;
    crate::file_ops::validate_safe_file_name(&normalized).map_err(DbError::Validation)?;
    let target = std::path::Path::new(&preview.target_path)
        .parent()
        .ok_or_else(|| DbError::Validation("organization_target_parent_invalid".to_string()))?
        .join(&normalized);
    if target.exists() {
        return Err(DbError::Validation(
            "organization_target_collision".to_string(),
        ));
    }
    Ok(normalized)
}

fn require_plan_revision_and_status(
    conn: &rusqlite::Connection,
    plan_id: &str,
    revision: i64,
    allowed_statuses: &[&str],
) -> Result<(), DbError> {
    let status = conn
        .query_row(
            "SELECT status FROM organization_plans WHERE id = ?1 AND revision = ?2",
            params![plan_id, revision],
            |row| row.get::<_, String>(0),
        )
        .optional()?
        .ok_or_else(|| DbError::Validation("organization_plan_revision_conflict".to_string()))?;
    if !allowed_statuses.contains(&status.as_str()) {
        return Err(DbError::Validation(
            "organization_plan_status_invalid".to_string(),
        ));
    }
    Ok(())
}

fn load_plan(conn: &rusqlite::Connection, plan_id: &str) -> Result<OrganizationPlanDto, DbError> {
    let mut plan = conn
        .query_row(
            "SELECT id, title, status, source_kind, source_query_fingerprint,
                source_snapshot_revision, requested_count, materialized_count,
                planner_version, revision, active_execution_id,
                active_operation_batch_id, last_error_code, last_error_detail,
                created_at, updated_at, ready_at, completed_at
         FROM organization_plans WHERE id = ?1",
            params![plan_id],
            plan_from_row,
        )
        .optional()?
        .ok_or_else(|| DbError::Validation("organization_plan_not_found".to_string()))?;
    plan.summary = load_plan_summary(conn, plan_id)?;
    Ok(plan)
}

fn plan_from_row(row: &Row<'_>) -> rusqlite::Result<OrganizationPlanDto> {
    Ok(OrganizationPlanDto {
        id: row.get(0)?,
        title: row.get(1)?,
        status: row.get(2)?,
        source_kind: row.get(3)?,
        source_query_fingerprint: row.get(4)?,
        source_snapshot_revision: row.get(5)?,
        requested_count: row.get(6)?,
        materialized_count: row.get(7)?,
        planner_version: row.get(8)?,
        revision: row.get(9)?,
        active_execution_id: row.get(10)?,
        active_operation_batch_id: row.get(11)?,
        last_error_code: row.get(12)?,
        last_error_detail: row.get(13)?,
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
        ready_at: row.get(16)?,
        completed_at: row.get(17)?,
        summary: OrganizationPlanSummaryDto::default(),
    })
}

fn item_from_row(row: &Row<'_>) -> rusqlite::Result<OrganizationPlanItemDto> {
    let decision = row.get::<_, String>(14)?;
    let validity = row.get::<_, String>(16)?;
    let review_state = match (validity.as_str(), decision.as_str()) {
        ("needs_review", "accepted" | "edited") => "reviewed",
        ("needs_review", _) => "needs_review",
        ("ready", _) => "ready",
        ("blocked", _) => "blocked",
        (other, _) => other,
    }
    .to_string();
    Ok(OrganizationPlanItemDto {
        id: row.get(0)?,
        plan_id: row.get(1)?,
        ordinal: row.get(2)?,
        file_id_snapshot: row.get(3)?,
        source_path_snapshot: row.get(4)?,
        source_name_snapshot: row.get(5)?,
        source_size_snapshot: row.get(6)?,
        source_mtime_snapshot: row.get(7)?,
        source_is_dir_snapshot: row.get::<_, i64>(8)? != 0,
        proposal_fingerprint: row.get(9)?,
        proposal_kind: row.get(10)?,
        proposed_target_directory: row.get(11)?,
        proposed_name: row.get(12)?,
        proposed_target_path: row.get(13)?,
        decision,
        edited_name: row.get(15)?,
        validity,
        review_state,
        confidence: row.get(17)?,
        risk_level: row.get(18)?,
        requires_confirmation: row.get::<_, i64>(19)? != 0,
        blocking_code: row.get(20)?,
        blocking_detail: row.get(21)?,
        authoritative_preview_id: row.get(22)?,
        review_reasons: Vec::new(),
        available_actions: Vec::new(),
        operation_log_id: row.get(23)?,
        execution_id: row.get(24)?,
        revision: row.get(25)?,
        created_at: row.get(26)?,
        updated_at: row.get(27)?,
    })
}

fn decorate_organization_item_metadata(
    conn: &rusqlite::Connection,
    item: &mut OrganizationPlanItemDto,
) -> Result<(), DbError> {
    let preview = load_indexed_file_by_id(conn, &item.file_id_snapshot)?
        .and_then(operation_preview_from_indexed);
    let mut reasons = Vec::new();
    let blocking_code = item.blocking_code.as_deref().unwrap_or("");
    let blocking_detail = item.blocking_detail.as_deref().unwrap_or("");

    if matches!(
        item.validity.as_str(),
        "needs_review" | "blocked" | "stale" | "failed" | "skipped"
    ) {
        if item.confidence < 0.8 {
            push_review_reason(&mut reasons, "low_confidence");
        }
        if item.risk_level.eq_ignore_ascii_case("Sensitive") {
            push_review_reason(&mut reasons, "sensitive_file");
        }
        if !item.risk_level.trim().is_empty() && !item.risk_level.eq_ignore_ascii_case("Normal") {
            push_review_reason(&mut reasons, "non_normal_risk");
        }
        if item.requires_confirmation {
            push_review_reason(&mut reasons, "requires_confirmation");
        }
    }

    if let Some(preview) = preview.as_ref() {
        if preview.is_duplicate {
            push_review_reason(&mut reasons, "possible_duplicate");
        }
        if preview.will_create_parent == Some(true) {
            push_review_reason(&mut reasons, "target_directory_creation");
        }
        if let Some(reason) = preview.blocking_reason.as_deref() {
            if let Some(mapped) = map_organization_review_reason(reason) {
                push_review_reason(&mut reasons, mapped);
            }
        }
    }

    if let Some(mapped) = map_organization_review_reason(blocking_code) {
        push_review_reason(&mut reasons, mapped);
    }
    if let Some(mapped) = map_organization_review_reason(blocking_detail) {
        push_review_reason(&mut reasons, mapped);
    }

    if matches!(blocking_code, "source_identity_changed" | "source_missing") {
        push_review_reason(&mut reasons, "source_changed");
    }
    if item.validity == "stale" && reasons.is_empty() {
        push_review_reason(&mut reasons, "source_changed");
    }
    if item.authoritative_preview_id.is_none() && item.proposal_kind != "keep" {
        push_review_reason(&mut reasons, "missing_preview");
    }
    if !matches!(
        item.proposal_kind.as_str(),
        "move" | "rename" | "move_rename" | "keep"
    ) {
        push_review_reason(&mut reasons, "unsupported_operation");
    }
    if item.validity == "needs_review" && reasons.is_empty() {
        push_review_reason(&mut reasons, "requires_confirmation");
    }
    if item.validity == "blocked" && reasons.is_empty() {
        push_review_reason(&mut reasons, "unsupported_operation");
    }

    let terminal = matches!(item.validity.as_str(), "executing" | "executed");
    let supported_operation = matches!(
        item.proposal_kind.as_str(),
        "move" | "rename" | "move_rename"
    );
    let preview_available = item.authoritative_preview_id.is_some() && preview.is_some();
    let mut actions = Vec::new();
    if !terminal {
        if preview_available
            && supported_operation
            && !matches!(
                item.validity.as_str(),
                "blocked" | "stale" | "failed" | "skipped"
            )
            && item.decision == "undecided"
        {
            actions.push("accept_suggestion".to_string());
        }
        if preview_available
            && supported_operation
            && !matches!(
                item.validity.as_str(),
                "blocked" | "stale" | "failed" | "skipped"
            )
        {
            actions.push("edit_name".to_string());
            actions.push("view_preview".to_string());
        }
        actions.push("keep".to_string());
        if item.decision != "undecided" {
            actions.push("clear_decision".to_string());
        }
        if item.validity == "needs_review" && item.decision == "undecided" {
            actions.push("defer".to_string());
        }
    }

    item.review_reasons = reasons;
    item.available_actions = actions;
    Ok(())
}

fn push_review_reason(reasons: &mut Vec<String>, reason: &str) {
    if !reasons.iter().any(|current| current == reason) {
        reasons.push(reason.to_string());
    }
}

fn map_organization_review_reason(value: &str) -> Option<&'static str> {
    let normalized = value.to_ascii_lowercase();
    if normalized.contains("duplicate") {
        Some("possible_duplicate")
    } else if normalized.contains("confirmation") || normalized.contains("confirm") {
        Some("requires_confirmation")
    } else if normalized.contains("collision") || normalized.contains("conflict") {
        Some("target_collision")
    } else if normalized.contains("parent") || normalized.contains("directory") {
        Some("target_directory_creation")
    } else if normalized.contains("source_identity") || normalized.contains("source_missing") {
        Some("source_changed")
    } else if normalized.contains("managed_scope") {
        Some("managed_scope_changed")
    } else if normalized.contains("proposal") {
        Some("proposal_changed")
    } else if normalized.contains("extension") {
        Some("extension_change_blocked")
    } else if normalized.contains("unsafe") || normalized.contains("filename") {
        Some("unsafe_filename")
    } else if normalized.contains("unsupported") || normalized.contains("cleanup_review") {
        Some("unsupported_operation")
    } else if normalized.contains("preview") {
        Some("missing_preview")
    } else {
        None
    }
}

fn validate_organization_page_size(page_size: u32, code: &str) -> Result<(), DbError> {
    if page_size == 0 || page_size > ORGANIZATION_PAGE_MAX {
        Err(DbError::Validation(code.to_string()))
    } else {
        Ok(())
    }
}

fn load_organization_plan_items_for_projection(
    conn: &rusqlite::Connection,
    plan_id: &str,
) -> Result<Vec<OrganizationPlanItemDto>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, plan_id, ordinal, file_id_snapshot, source_path_snapshot,
                source_name_snapshot, source_size_snapshot, source_mtime_snapshot,
                source_is_dir_snapshot, proposal_fingerprint, proposal_kind,
                proposed_target_directory, proposed_name, proposed_target_path,
                decision, edited_name, validity, confidence, risk_level,
                requires_confirmation, blocking_code, blocking_detail,
                authoritative_preview_id, operation_log_id, execution_id, revision,
                created_at, updated_at
         FROM organization_plan_items WHERE plan_id = ?1 ORDER BY ordinal, id",
    )?;
    let mut items = stmt
        .query_map(params![plan_id], item_from_row)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(DbError::from)?;
    for item in &mut items {
        decorate_organization_item_metadata(conn, item)?;
    }
    Ok(items)
}

fn organization_group_key(item: &OrganizationPlanItemDto) -> OrganizationPlanGroupKey {
    let readiness = match item.validity.as_str() {
        "ready" => "ready",
        "needs_review" => "requires-decision",
        _ => "blocked",
    };
    OrganizationPlanGroupKey {
        target_directory: item.proposed_target_directory.clone(),
        proposal_kind: item.proposal_kind.clone(),
        readiness: readiness.to_string(),
        risk_level: if item.risk_level.trim().is_empty() {
            "Unknown".to_string()
        } else {
            item.risk_level.clone()
        },
    }
}

fn organization_group_id(plan_id: &str, key: &OrganizationPlanGroupKey) -> String {
    let digest = blake3::hash(
        [
            "organization-plan-group-v1",
            plan_id,
            &key.target_directory,
            &key.proposal_kind,
            &key.readiness,
            &key.risk_level,
        ]
        .join("\0")
        .as_bytes(),
    );
    format!("organization-group-{}", digest.to_hex())
}

fn organization_group_label(key: &OrganizationPlanGroupKey) -> String {
    if key.target_directory.trim().is_empty() {
        key.proposal_kind.clone()
    } else {
        format!("{} · {}", key.target_directory, key.proposal_kind)
    }
}

fn organization_group_is_conflict(item: &OrganizationPlanItemDto) -> bool {
    item.blocking_code.as_deref().is_some_and(|code| {
        let code = code.to_ascii_lowercase();
        code.contains("collision") || code.contains("conflict")
    })
}

fn load_organization_plan_group_summaries(
    conn: &rusqlite::Connection,
    plan_id: &str,
    revision: i64,
) -> Result<Vec<OrganizationPlanGroupSummaryDto>, DbError> {
    let items = load_organization_plan_items_for_projection(conn, plan_id)?;
    let mut groups = HashMap::<OrganizationPlanGroupKey, OrganizationPlanGroupAccumulator>::new();
    for item in items {
        let key = organization_group_key(&item);
        let group_id = organization_group_id(plan_id, &key);
        let entry = groups
            .entry(key.clone())
            .or_insert_with(|| OrganizationPlanGroupAccumulator {
                key: Some(key.clone()),
                group_id,
                all_high_confidence: true,
                all_medium_confidence: true,
                all_low_confidence: true,
                ..OrganizationPlanGroupAccumulator::default()
            });
        entry.item_count += 1;
        entry.total_bytes = entry
            .total_bytes
            .saturating_add(item.source_size_snapshot.max(0));
        if matches!(item.decision.as_str(), "accepted" | "edited") {
            entry.accepted_count += 1;
        }
        if item.decision == "kept" {
            entry.excluded_count += 1;
        }
        if item.validity == "stale" {
            entry.stale_count += 1;
        }
        if organization_group_is_conflict(&item) {
            entry.conflict_count += 1;
        }
        for reason in &item.review_reasons {
            *entry
                .review_reason_counts
                .entry(reason.clone())
                .or_insert(0) += 1;
        }
        for action in &item.available_actions {
            entry.available_actions.insert(action.clone());
        }
        entry.all_high_confidence &= item.confidence >= 0.8;
        entry.all_medium_confidence &= (0.5..0.8).contains(&item.confidence);
        entry.all_low_confidence &= item.confidence < 0.5;
        if entry.sample_items.len() < ORGANIZATION_GROUP_SAMPLE_MAX {
            entry.sample_items.push(OrganizationPlanGroupSampleDto {
                item_id: item.id,
                source_name: item.source_name_snapshot,
                source_path: item.source_path_snapshot,
                proposed_name: item.proposed_name,
                decision: item.decision,
                validity: item.validity,
            });
        }
    }

    let mut summaries = groups
        .into_values()
        .map(|accumulator| {
            let key = accumulator
                .key
                .expect("organization group accumulator always has a key");
            let confidence_band = if accumulator.all_high_confidence {
                "high"
            } else if accumulator.all_medium_confidence {
                "medium"
            } else if accumulator.all_low_confidence {
                "low"
            } else {
                "mixed"
            };
            Ok(OrganizationPlanGroupSummaryDto {
                group_id: accumulator.group_id,
                plan_id: plan_id.to_string(),
                label: organization_group_label(&key),
                target_directory: (!key.target_directory.trim().is_empty())
                    .then_some(key.target_directory),
                proposal_kind: key.proposal_kind,
                readiness: key.readiness,
                risk_level: key.risk_level,
                item_count: accumulator.item_count,
                total_bytes: accumulator.total_bytes,
                accepted_count: accumulator.accepted_count,
                excluded_count: accumulator.excluded_count,
                stale_count: accumulator.stale_count,
                conflict_count: accumulator.conflict_count,
                confidence_band: confidence_band.to_string(),
                review_reason_counts: accumulator
                    .review_reason_counts
                    .into_iter()
                    .map(|(reason, count)| OrganizationReviewReasonCountDto { reason, count })
                    .collect(),
                available_actions: sorted_organization_actions(accumulator.available_actions),
                sample_items: accumulator.sample_items,
                revision,
            })
        })
        .collect::<Result<Vec<_>, DbError>>()?;
    summaries.sort_by(|left, right| {
        left.label
            .to_ascii_lowercase()
            .cmp(&right.label.to_ascii_lowercase())
            .then_with(|| left.group_id.cmp(&right.group_id))
    });
    Ok(summaries)
}

fn sorted_organization_actions(actions: HashSet<String>) -> Vec<String> {
    let mut actions = actions.into_iter().collect::<Vec<_>>();
    actions.sort_by_key(|action| match action.as_str() {
        "accept_suggestion" => 0,
        "edit_name" => 1,
        "view_preview" => 2,
        "keep" => 3,
        "defer" => 4,
        "clear_decision" => 5,
        _ => 99,
    });
    actions
}

fn organization_group_is_after(
    group: &OrganizationPlanGroupSummaryDto,
    cursor: &OrganizationGroupCursor,
) -> bool {
    group
        .label
        .to_ascii_lowercase()
        .cmp(&cursor.label.to_ascii_lowercase())
        .then_with(|| group.group_id.cmp(&cursor.group_id))
        == Ordering::Greater
}

fn load_plan_summary(
    conn: &rusqlite::Connection,
    plan_id: &str,
) -> Result<OrganizationPlanSummaryDto, DbError> {
    conn.query_row(
        "SELECT
            COALESCE(SUM(CASE WHEN decision = 'undecided' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN decision = 'accepted' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN decision = 'kept' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN decision = 'edited' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN validity = 'needs_analysis' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN validity = 'needs_review' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN validity = 'ready' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN validity = 'blocked' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN validity = 'stale' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN validity = 'executing' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN validity = 'executed' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN validity = 'failed' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN validity = 'skipped' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE
                WHEN decision IN ('accepted', 'edited')
                 AND validity IN ('ready', 'needs_review')
                THEN 1 ELSE 0 END), 0)
         FROM organization_plan_items WHERE plan_id = ?1",
        params![plan_id],
        |row| {
            Ok(OrganizationPlanSummaryDto {
                undecided: row.get(0)?,
                accepted: row.get(1)?,
                kept: row.get(2)?,
                edited: row.get(3)?,
                needs_analysis: row.get(4)?,
                needs_review: row.get(5)?,
                ready: row.get(6)?,
                blocked: row.get(7)?,
                stale: row.get(8)?,
                executing: row.get(9)?,
                executed: row.get(10)?,
                failed: row.get(11)?,
                skipped: row.get(12)?,
                remaining_executable: row.get(13)?,
            })
        },
    )
    .map_err(DbError::from)
}

fn load_indexed_file_by_id(
    conn: &rusqlite::Connection,
    file_id: &str,
) -> Result<Option<IndexedFileRow>, DbError> {
    conn.query_row(
        "SELECT f.id, f.path, f.name, f.extension, f.size, f.mtime, f.ctime, f.is_dir, f.state_code,
                f.file_type, f.purpose, f.lifecycle, f.context, f.risk_level, f.suggested_action,
                f.suggested_target_path, f.suggested_name, f.confidence, f.classification_reason,
                f.classification_status, f.matched_rules, f.requires_confirmation, f.content_hash,
                EXISTS (SELECT 1 FROM active_duplicate_membership AS membership
                        WHERE membership.file_id = f.id),
                f.is_stale, f.last_seen_at, f.last_classified_at, f.classified_rule_version,
                f.last_classified_mtime, f.last_classified_size
         FROM files AS f WHERE f.id = ?1 AND f.is_stale = 0",
        params![file_id],
        indexed_file_from_row,
    )
    .optional()
    .map_err(DbError::from)
}

fn load_plan_source_query(
    conn: &rusqlite::Connection,
    plan_id: &str,
) -> Result<FileQuerySpecV2, DbError> {
    let (source_kind, source_query_json, stored_fingerprint): (
        String,
        Option<String>,
        Option<String>,
    ) = conn.query_row(
        "SELECT source_kind, source_query_spec_json, source_query_fingerprint
         FROM organization_plans WHERE id = ?1",
        params![plan_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )?;
    if source_kind == "explicit" {
        return Ok(FileQuerySpecV2 {
            scope: FileLibraryScopeV2::AllEnabledRoots,
            text: None,
            filters: FileQueryFiltersV2::default(),
            sort: FileLibrarySortV2::default(),
        });
    }
    if source_kind != "all_matching" {
        return Err(DbError::Validation(
            "organization_source_provenance_invalid".to_string(),
        ));
    }
    let raw = source_query_json
        .ok_or_else(|| DbError::Validation("organization_source_provenance_invalid".to_string()))?;
    let query: FileQuerySpecV2 = serde_json::from_str(&raw)?;
    let (query, _, fingerprint) = canonicalize_file_query_spec(query)?;
    if stored_fingerprint.as_deref() != Some(fingerprint.as_str()) {
        return Err(DbError::Validation(
            "organization_source_provenance_invalid".to_string(),
        ));
    }
    Ok(query)
}

fn mark_plan_scope_stale(
    conn: &rusqlite::Connection,
    plan_id: &str,
    expected_revision: i64,
    code: &str,
) -> Result<(), DbError> {
    let now = current_unix_seconds();
    conn.execute(
        "UPDATE organization_plan_items SET validity = 'stale',
                blocking_code = ?2,
                blocking_detail = 'The plan source is no longer a valid healthy managed scope.',
                decision = 'undecided', edited_name = NULL,
                revision = revision + 1, updated_at = ?3
         WHERE plan_id = ?1 AND validity NOT IN ('executing', 'executed')",
        params![plan_id, code, now],
    )?;
    let changed = conn.execute(
        "UPDATE organization_plans SET status = 'stale', revision = revision + 1,
                updated_at = ?4, last_error_code = ?3,
                last_error_detail = 'Managed source provenance or root authority is unavailable.'
         WHERE id = ?1 AND revision = ?2",
        params![plan_id, expected_revision, code, now],
    )?;
    if changed != 1 {
        return Err(DbError::Validation(
            "organization_plan_revision_conflict".to_string(),
        ));
    }
    Ok(())
}

fn build_organization_dry_run(
    conn: &rusqlite::Connection,
    request: &OrganizationPlanSelectionRequest,
) -> Result<OrganizationPlanDryRunDto, DbError> {
    let plan_id = validate_id(&request.plan_id, "organization_plan_id_invalid")?;
    require_plan_revision_and_status(
        conn,
        &plan_id,
        request.expected_plan_revision,
        &["ready", "partially_completed"],
    )?;
    let source_query = load_plan_source_query(conn, &plan_id)?;
    let selected = selected_plan_items(conn, request)?;
    let mut items = Vec::with_capacity(selected.len());
    let mut kinds = HashSet::new();
    let mut total_bytes = 0_i64;
    let mut executable_count = 0_i64;
    let mut blocked_count = 0_i64;
    let mut stale_count = 0_i64;
    let mut fingerprint_parts = vec![plan_id.clone(), request.expected_plan_revision.to_string()];

    for item in selected {
        let current = load_indexed_file_by_id(conn, &item.file_id_snapshot)?;
        let mut source_health = "healthy";
        let mut blocking_code = item.blocking_code.clone();
        let mut live_proposal = None;
        let mut final_target = item.proposed_target_path.clone();
        let mut collision = false;
        let mut invalid_filename = false;
        let mut classification_inputs = Vec::new();

        if let Some(row) = current.as_ref() {
            let source_unchanged = row.path == item.source_path_snapshot
                && row.size == item.source_size_snapshot
                && row.mtime == item.source_mtime_snapshot
                && row.is_dir == item.source_is_dir_snapshot;
            if !source_unchanged {
                source_health = "stale";
                blocking_code = Some("source_identity_changed".to_string());
            }
            match file_matches_authoritative_query_scope(
                conn,
                &source_query,
                &item.file_id_snapshot,
            ) {
                Ok(true) => {}
                Ok(false) => {
                    source_health = "invalid_scope";
                    blocking_code = Some("managed_scope_membership_changed".to_string());
                }
                Err(_) => {
                    source_health = "invalid_scope";
                    blocking_code = Some("managed_scope_unavailable".to_string());
                }
            }
            classification_inputs.extend([
                row.file_type.clone(),
                row.purpose.clone(),
                row.lifecycle.clone(),
                row.context.clone(),
                row.risk_level.clone(),
                row.suggested_action.clone(),
                row.suggested_target_path.clone(),
                row.suggested_name.clone(),
                row.confidence.to_bits().to_string(),
                row.classification_reason.clone(),
                row.classification_status.clone(),
                row.matched_rules.clone(),
                row.requires_confirmation.to_string(),
                row.content_hash.clone(),
                row.ctime.to_string(),
                row.last_classified_at.to_string(),
                row.classified_rule_version.clone(),
                row.last_classified_mtime.to_string(),
                row.last_classified_size.to_string(),
            ]);
            let proposal = proposal_from_preview(
                &row.path,
                &row.name,
                &row.classification_status,
                &row.suggested_action,
                operation_preview_from_indexed(row.clone()),
            );
            if proposal.fingerprint != item.proposal_fingerprint {
                source_health = "stale";
                blocking_code = Some("live_proposal_changed".to_string());
            }
            final_target = if let Some(edited) = item.edited_name.as_deref() {
                if crate::file_ops::validate_safe_file_name(edited).is_err() {
                    invalid_filename = true;
                    blocking_code = Some("organization_edited_filename_invalid".to_string());
                }
                std::path::Path::new(&proposal.target_directory)
                    .join(edited)
                    .to_string_lossy()
                    .to_string()
            } else {
                proposal.target_path.clone()
            };
            collision = final_target != row.path && std::path::Path::new(&final_target).exists();
            if collision {
                blocking_code = Some("organization_target_collision".to_string());
            }
            live_proposal = Some(proposal);
        } else {
            source_health = "missing";
            blocking_code = Some("source_missing".to_string());
        }

        let (operation_kind, risk_level, requires_confirmation, preview_id, live_validity) =
            live_proposal.as_ref().map_or_else(
                || {
                    (
                        item.proposal_kind.clone(),
                        item.risk_level.clone(),
                        item.requires_confirmation,
                        None,
                        "stale".to_string(),
                    )
                },
                |proposal| {
                    (
                        proposal.kind.clone(),
                        proposal.risk.clone(),
                        proposal.requires_confirmation,
                        proposal.preview_id.clone(),
                        proposal.validity.clone(),
                    )
                },
            );
        let explicitly_reviewed = matches!(item.decision.as_str(), "accepted" | "edited")
            && matches!(item.validity.as_str(), "ready" | "needs_review");
        let supported_operation =
            matches!(operation_kind.as_str(), "move" | "rename" | "move_rename");
        let executable = explicitly_reviewed
            && source_health == "healthy"
            && matches!(live_validity.as_str(), "ready" | "needs_review")
            && supported_operation
            && preview_id.is_some()
            && !collision
            && !invalid_filename
            && blocking_code.is_none();
        if executable {
            executable_count += 1;
            total_bytes = total_bytes.saturating_add(item.source_size_snapshot);
            kinds.insert(operation_kind.clone());
        } else {
            blocked_count += 1;
            if matches!(source_health, "stale" | "missing" | "invalid_scope") {
                stale_count += 1;
            }
        }
        let parent_directory_to_create = std::path::Path::new(&final_target)
            .parent()
            .filter(|path| !path.exists())
            .map(|path| path.to_string_lossy().to_string());
        let cross_volume = paths_cross_volume(&item.source_path_snapshot, &final_target);
        let canonical_item_fingerprint = blake3::hash(
            [
                vec![
                    item.id.clone(),
                    item.file_id_snapshot.clone(),
                    item.revision.to_string(),
                    item.decision.clone(),
                    item.edited_name.clone().unwrap_or_default(),
                    item.proposal_fingerprint.clone(),
                    source_health.to_string(),
                    operation_kind.clone(),
                    final_target.clone(),
                    risk_level.clone(),
                    requires_confirmation.to_string(),
                    collision.to_string(),
                    cross_volume.to_string(),
                    preview_id.clone().unwrap_or_default(),
                    current
                        .as_ref()
                        .map(|row| row.path.clone())
                        .unwrap_or_default(),
                    current
                        .as_ref()
                        .map(|row| row.size.to_string())
                        .unwrap_or_default(),
                    current
                        .as_ref()
                        .map(|row| row.mtime.to_string())
                        .unwrap_or_default(),
                    current
                        .as_ref()
                        .map(|row| row.is_dir.to_string())
                        .unwrap_or_default(),
                ],
                classification_inputs,
            ]
            .concat()
            .join("\0")
            .as_bytes(),
        )
        .to_hex()
        .to_string();
        fingerprint_parts.push(canonical_item_fingerprint);
        items.push(OrganizationDryRunItemDto {
            item_id: item.id,
            operation_kind,
            from: current
                .as_ref()
                .map(|row| row.path.clone())
                .unwrap_or(item.source_path_snapshot),
            to: final_target,
            edited_filename: item.edited_name,
            parent_directory_to_create,
            collision,
            cross_volume,
            risk_level,
            requires_confirmation,
            source_health: source_health.to_string(),
            authoritative_preview_id: preview_id,
            executable,
            blocking_code,
        });
    }

    let dry_run_fingerprint = blake3::hash(fingerprint_parts.join("\0").as_bytes())
        .to_hex()
        .to_string();
    let mut operation_kinds = kinds.into_iter().collect::<Vec<_>>();
    operation_kinds.sort();
    Ok(OrganizationPlanDryRunDto {
        plan_id,
        plan_revision: request.expected_plan_revision,
        selected_count: items.len() as i64,
        executable_count,
        blocked_count,
        stale_count,
        total_bytes,
        operation_kinds,
        items,
        execution_batch_limit: ORGANIZATION_EXECUTION_MAX_ITEMS,
        dry_run_fingerprint,
    })
}

fn selected_plan_items(
    conn: &rusqlite::Connection,
    request: &OrganizationPlanSelectionRequest,
) -> Result<Vec<OrganizationPlanItemDto>, DbError> {
    if request.all_accepted != request.item_ids.is_empty() {
        return Err(DbError::Validation(
            "organization_selection_invalid".to_string(),
        ));
    }
    let sql = "SELECT id, plan_id, ordinal, file_id_snapshot, source_path_snapshot,
            source_name_snapshot, source_size_snapshot, source_mtime_snapshot,
            source_is_dir_snapshot, proposal_fingerprint, proposal_kind,
            proposed_target_directory, proposed_name, proposed_target_path,
            decision, edited_name, validity, confidence, risk_level,
            requires_confirmation, blocking_code, blocking_detail,
            authoritative_preview_id, operation_log_id, execution_id, revision,
            created_at, updated_at
         FROM organization_plan_items WHERE plan_id = ?1
           AND decision IN ('accepted', 'edited')"
        .to_string();
    let requested = request.item_ids.iter().cloned().collect::<HashSet<_>>();
    let mut items = {
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map(params![request.plan_id], item_from_row)?;
        rows.collect::<Result<Vec<_>, _>>()?
    };
    if !request.all_accepted {
        items.retain(|item| requested.contains(&item.id));
        if items.len() != requested.len() {
            return Err(DbError::Validation(
                "organization_selection_item_invalid".to_string(),
            ));
        }
    }
    items.sort_by_key(|item| (item.ordinal, item.id.clone()));
    Ok(items)
}

fn validate_id(value: &str, code: &str) -> Result<String, DbError> {
    let value = value.trim();
    if value.is_empty() || value.len() > 512 || value.chars().any(|ch| ch.is_control()) {
        Err(DbError::Validation(code.to_string()))
    } else {
        Ok(value.to_string())
    }
}

fn encode_item_cursor(cursor: &OrganizationItemCursor) -> String {
    serde_json::to_vec(cursor)
        .unwrap_or_default()
        .into_iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn decode_item_cursor(value: &str) -> Result<OrganizationItemCursor, DbError> {
    if value.is_empty() || value.len() > 2048 || !value.len().is_multiple_of(2) {
        return Err(DbError::Validation(
            "organization_item_cursor_invalid".to_string(),
        ));
    }
    let bytes = (0..value.len())
        .step_by(2)
        .map(|index| {
            u8::from_str_radix(&value[index..index + 2], 16)
                .map_err(|_| DbError::Validation("organization_item_cursor_invalid".to_string()))
        })
        .collect::<Result<Vec<_>, _>>()?;
    let cursor: OrganizationItemCursor = serde_json::from_slice(&bytes)
        .map_err(|_| DbError::Validation("organization_item_cursor_invalid".to_string()))?;
    validate_id(&cursor.id, "organization_item_cursor_invalid")?;
    if cursor.ordinal < 0 {
        return Err(DbError::Validation(
            "organization_item_cursor_invalid".to_string(),
        ));
    }
    Ok(cursor)
}

fn encode_group_cursor(cursor: &OrganizationGroupCursor) -> String {
    serde_json::to_vec(cursor)
        .unwrap_or_default()
        .into_iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn decode_group_cursor(value: &str) -> Result<OrganizationGroupCursor, DbError> {
    let cursor: OrganizationGroupCursor =
        decode_cursor_json(value, "organization_group_cursor_invalid")?;
    if cursor.label.is_empty()
        || cursor.label.len() > 2048
        || cursor.label.chars().any(|ch| ch.is_control())
    {
        return Err(DbError::Validation(
            "organization_group_cursor_invalid".to_string(),
        ));
    }
    validate_id(&cursor.group_id, "organization_group_cursor_invalid")?;
    Ok(cursor)
}

fn encode_group_item_cursor(cursor: &OrganizationGroupItemCursor) -> String {
    serde_json::to_vec(cursor)
        .unwrap_or_default()
        .into_iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn decode_group_item_cursor(value: &str) -> Result<OrganizationGroupItemCursor, DbError> {
    let cursor: OrganizationGroupItemCursor =
        decode_cursor_json(value, "organization_group_cursor_invalid")?;
    validate_id(&cursor.group_id, "organization_group_cursor_invalid")?;
    validate_id(&cursor.id, "organization_group_cursor_invalid")?;
    if cursor.ordinal < 0 {
        return Err(DbError::Validation(
            "organization_group_cursor_invalid".to_string(),
        ));
    }
    Ok(cursor)
}

fn decode_cursor_json<T>(value: &str, code: &str) -> Result<T, DbError>
where
    T: for<'de> Deserialize<'de>,
{
    if value.is_empty() || value.len() > 2048 || !value.len().is_multiple_of(2) {
        return Err(DbError::Validation(code.to_string()));
    }
    let bytes = (0..value.len())
        .step_by(2)
        .map(|index| {
            u8::from_str_radix(&value[index..index + 2], 16)
                .map_err(|_| DbError::Validation(code.to_string()))
        })
        .collect::<Result<Vec<_>, _>>()?;
    serde_json::from_slice(&bytes).map_err(|_| DbError::Validation(code.to_string()))
}

fn paths_cross_volume(left: &str, right: &str) -> bool {
    fn volume(path: &str) -> String {
        let normalized = path.replace('\\', "/");
        normalized
            .split('/')
            .next()
            .unwrap_or_default()
            .to_ascii_lowercase()
    }
    volume(left) != volume(right)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_database() -> (Database, std::path::PathBuf) {
        let path = std::env::temp_dir().join(format!(
            "zen-canvas-organization-test-{}-{}.sqlite3",
            std::process::id(),
            uuid::Uuid::new_v4()
        ));
        (
            Database::open(&path).expect("organization test database"),
            path,
        )
    }

    fn seed_plan(db: &Database, status: &str) {
        let conn = db.conn().expect("seed connection");
        conn.execute(
            "INSERT INTO organization_plans (
                id, title, status, source_kind, source_snapshot_revision,
                requested_count, materialized_count, planner_version, revision,
                created_at, updated_at, ready_at
             ) VALUES ('plan-test', 'Test plan', ?1, 'explicit', 1, 1, 1, 1, 1, 1, 1, 1)",
            params![status],
        )
        .expect("seed plan");
        conn.execute(
            "INSERT INTO organization_plan_items (
                id, plan_id, ordinal, file_id_snapshot, source_path_snapshot,
                source_name_snapshot, source_size_snapshot, source_mtime_snapshot,
                source_is_dir_snapshot, proposal_fingerprint, proposal_kind,
                proposed_target_directory, proposed_name, proposed_target_path,
                decision, validity, confidence, risk_level, requires_confirmation,
                authoritative_preview_id, revision, created_at, updated_at
             ) VALUES (
                'item-test', 'plan-test', 0, 'file-test', '/tmp/source.txt',
                'source.txt', 1, 1, 0, 'proposal-fingerprint', 'rename',
                '/tmp', 'renamed.txt', '/tmp/renamed.txt', 'undecided', 'ready',
                0.95, 'Normal', 0, 'preview-test', 1, 1, 1
             )",
            [],
        )
        .expect("seed plan item");
    }

    #[allow(clippy::too_many_arguments)]
    fn seed_group_item(
        db: &Database,
        id: &str,
        ordinal: i64,
        target_directory: &std::path::Path,
        validity: &str,
        decision: &str,
        confidence: f64,
        requires_confirmation: bool,
        blocking_code: Option<&str>,
    ) {
        let source_path = target_directory.join(format!("source-{id}.txt"));
        let target_path = target_directory.join(format!("target-{id}.txt"));
        let source_path = source_path.to_string_lossy().to_string();
        let target_path = target_path.to_string_lossy().to_string();
        let target_directory = target_directory.to_string_lossy().to_string();
        let conn = db.conn().expect("group item connection");
        conn.execute(
            "INSERT INTO organization_plan_items (
                id, plan_id, ordinal, file_id_snapshot, source_path_snapshot,
                source_name_snapshot, source_size_snapshot, source_mtime_snapshot,
                source_is_dir_snapshot, proposal_fingerprint, proposal_kind,
                proposed_target_directory, proposed_name, proposed_target_path,
                decision, validity, confidence, risk_level, requires_confirmation,
                blocking_code, authoritative_preview_id, revision, created_at, updated_at
             ) VALUES (?1, 'plan-test', ?2, ?3, ?4, ?5, 10, 1, 0, ?6,
                       'rename', ?7, ?8, ?9, ?10, ?11, ?12, 'Normal', ?13,
                       ?14, ?15, 1, 1, 1)",
            params![
                id,
                ordinal,
                format!("file-{id}"),
                source_path,
                format!("source-{id}.txt"),
                format!("fingerprint-{id}"),
                target_directory,
                format!("target-{id}.txt"),
                target_path,
                decision,
                validity,
                confidence,
                bool_to_i64(requires_confirmation),
                blocking_code,
                if validity == "ready" {
                    Some(format!("preview-{id}"))
                } else {
                    None
                }
            ],
        )
        .expect("seed group item");
    }

    #[test]
    fn item_cursor_round_trip_is_bounded() {
        let cursor = OrganizationItemCursor {
            ordinal: 42,
            id: "organization-item-test".to_string(),
        };
        assert_eq!(
            decode_item_cursor(&encode_item_cursor(&cursor))
                .unwrap()
                .ordinal,
            42
        );
        assert!(decode_item_cursor("not-hex").is_err());
    }

    #[test]
    fn organization_group_projection_is_complete_deterministic_and_cursored() {
        let (db, path) = test_database();
        seed_plan(&db, "ready");
        let fixture = path.with_extension("groups");
        let first_target = fixture.join("first");
        let second_target = fixture.join("second");
        std::fs::create_dir_all(&first_target).expect("create first group target");
        std::fs::create_dir_all(&second_target).expect("create second group target");
        {
            let conn = db.conn().expect("group fixture connection");
            conn.execute(
                "UPDATE organization_plan_items SET source_path_snapshot = ?1,
                    proposed_target_directory = ?2, proposed_target_path = ?3
                 WHERE id = 'item-test'",
                params![
                    first_target.join("source-item-test.txt").to_string_lossy(),
                    first_target.to_string_lossy(),
                    first_target.join("target-item-test.txt").to_string_lossy(),
                ],
            )
            .expect("bind first group item");
        }
        seed_group_item(
            &db,
            "item-group-1",
            1,
            &first_target,
            "ready",
            "undecided",
            0.9,
            false,
            None,
        );
        seed_group_item(
            &db,
            "item-group-2",
            2,
            &first_target,
            "ready",
            "undecided",
            0.7,
            false,
            None,
        );
        seed_group_item(
            &db,
            "item-group-3",
            3,
            &second_target,
            "ready",
            "undecided",
            0.9,
            false,
            None,
        );

        let first_page = db
            .query_organization_plan_groups(QueryOrganizationPlanGroupsRequest {
                plan_id: "plan-test".into(),
                cursor: None,
                page_size: 1,
            })
            .expect("first group page");
        assert!(first_page.has_more);
        let second_page = db
            .query_organization_plan_groups(QueryOrganizationPlanGroupsRequest {
                plan_id: "plan-test".into(),
                cursor: first_page.next_cursor.clone(),
                page_size: 1,
            })
            .expect("second group page");
        assert_ne!(
            first_page.groups[0].group_id,
            second_page.groups[0].group_id
        );

        let all_groups = db
            .query_organization_plan_groups(QueryOrganizationPlanGroupsRequest {
                plan_id: "plan-test".into(),
                cursor: None,
                page_size: 20,
            })
            .expect("complete group projection");
        let first_group = all_groups
            .groups
            .iter()
            .find(|group| group.item_count == 3)
            .expect("three-item group");
        assert_eq!(first_group.total_bytes, 21);
        assert_eq!(
            first_group.sample_items.len(),
            ORGANIZATION_GROUP_SAMPLE_MAX
        );
        assert_eq!(first_group.confidence_band, "mixed");
        assert_eq!(first_group.revision, 1);
        let repeated = db
            .query_organization_plan_groups(QueryOrganizationPlanGroupsRequest {
                plan_id: "plan-test".into(),
                cursor: None,
                page_size: 20,
            })
            .expect("repeat group projection");
        assert_eq!(
            all_groups
                .groups
                .iter()
                .map(|group| group.group_id.clone())
                .collect::<Vec<_>>(),
            repeated
                .groups
                .iter()
                .map(|group| group.group_id.clone())
                .collect::<Vec<_>>()
        );

        let group_page = db
            .query_organization_plan_group_items(QueryOrganizationPlanGroupItemsRequest {
                plan_id: "plan-test".into(),
                group_id: first_group.group_id.clone(),
                cursor: None,
                page_size: 1,
            })
            .expect("group item page");
        assert!(group_page.has_more);
        let next_group_page = db
            .query_organization_plan_group_items(QueryOrganizationPlanGroupItemsRequest {
                plan_id: "plan-test".into(),
                group_id: first_group.group_id.clone(),
                cursor: group_page.next_cursor,
                page_size: 10,
            })
            .expect("next group item page");
        assert_eq!(next_group_page.items.len(), 2);
        drop(db);
        let _ = std::fs::remove_dir_all(fixture);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn review_metadata_is_projected_and_requires_decision_uses_ordinary_mutation() {
        let (db, path) = test_database();
        seed_plan(&db, "ready");
        let fixture = path.with_extension("review-metadata");
        std::fs::create_dir_all(&fixture).expect("create review metadata target");
        seed_group_item(
            &db,
            "item-review-metadata",
            1,
            &fixture,
            "needs_review",
            "undecided",
            0.7,
            true,
            Some("target_collision"),
        );
        {
            let conn = db.conn().expect("review metadata connection");
            conn.execute(
                "INSERT INTO files (id, path, name, extension, size, mtime)
                 VALUES ('file-item-review-metadata', ?1, 'source-item-review-metadata.txt', 'txt', 10, 1)",
                params![fixture.join("source-item-review-metadata.txt").to_string_lossy()],
            )
            .expect("seed review metadata indexed file");
            conn.execute(
                "UPDATE files SET classification_status = 'classified',
                        suggested_action = 'Rename', suggested_target_path = ?1,
                        suggested_name = 'target-item-review-metadata.txt',
                        confidence = 0.7, risk_level = 'Normal',
                        last_classified_mtime = 1, last_classified_size = 10
                 WHERE id = 'file-item-review-metadata'",
                params![fixture.to_string_lossy()],
            )
            .expect("seed review metadata proposal");
            conn.execute(
                "UPDATE organization_plan_items
                 SET authoritative_preview_id = 'preview-review-metadata'
                 WHERE id = 'item-review-metadata'",
                [],
            )
            .expect("bind review metadata preview");
        }

        let groups = db
            .query_organization_plan_groups(QueryOrganizationPlanGroupsRequest {
                plan_id: "plan-test".into(),
                cursor: None,
                page_size: 20,
            })
            .expect("review metadata groups");
        let group = groups
            .groups
            .iter()
            .find(|group| group.readiness == "requires-decision")
            .expect("review metadata group");
        assert!(group
            .review_reason_counts
            .iter()
            .any(|reason| reason.reason == "low_confidence" && reason.count == 1));
        assert!(group
            .review_reason_counts
            .iter()
            .any(|reason| reason.reason == "requires_confirmation" && reason.count == 1));
        assert!(group
            .review_reason_counts
            .iter()
            .any(|reason| reason.reason == "target_collision" && reason.count == 1));
        assert!(group
            .available_actions
            .iter()
            .any(|action| action == "accept_suggestion"));

        let item = db
            .query_organization_plan_group_items(QueryOrganizationPlanGroupItemsRequest {
                plan_id: "plan-test".into(),
                group_id: group.group_id.clone(),
                cursor: None,
                page_size: 20,
            })
            .expect("review metadata items")
            .items
            .into_iter()
            .next()
            .expect("review metadata item");
        assert_eq!(item.review_reasons[0], "low_confidence");
        assert!(item
            .available_actions
            .iter()
            .any(|action| action == "accept_suggestion"));

        let updated = db
            .update_organization_plan_decisions(UpdateOrganizationPlanDecisionsRequest {
                plan_id: "plan-test".into(),
                expected_plan_revision: 1,
                safe_batch: false,
                mutations: vec![OrganizationDecisionMutation {
                    item_id: item.id.clone(),
                    expected_item_revision: item.revision,
                    decision: "accepted".into(),
                    edited_filename: None,
                }],
            })
            .expect("ordinary review decision");
        assert_eq!(updated.revision, 2);

        assert!(db
            .update_organization_plan_decisions(UpdateOrganizationPlanDecisionsRequest {
                plan_id: "plan-test".into(),
                expected_plan_revision: 2,
                safe_batch: true,
                mutations: vec![OrganizationDecisionMutation {
                    item_id: item.id,
                    expected_item_revision: 2,
                    decision: "accepted".into(),
                    edited_filename: None,
                }],
            })
            .expect_err("review item is not eligible for safe batch")
            .to_string()
            .contains("organization_safe_batch_item_blocked"));
        drop(db);
        let _ = std::fs::remove_dir_all(fixture);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn group_accept_skips_unsafe_members_and_requires_current_plan_revision() {
        let (db, path) = test_database();
        seed_plan(&db, "ready");
        let fixture = path.with_extension("group-safe");
        std::fs::create_dir_all(&fixture).expect("create group-safe target");
        {
            let conn = db.conn().expect("group safe fixture connection");
            conn.execute(
                "UPDATE organization_plan_items SET source_path_snapshot = ?1,
                    proposed_target_directory = ?2, proposed_target_path = ?3
                 WHERE id = 'item-test'",
                params![
                    fixture.join("source-item-test.txt").to_string_lossy(),
                    fixture.to_string_lossy(),
                    fixture.join("target-item-test.txt").to_string_lossy(),
                ],
            )
            .expect("bind safe group item");
        }
        seed_group_item(
            &db,
            "item-group-blocked",
            1,
            &fixture,
            "ready",
            "undecided",
            0.95,
            true,
            None,
        );
        let group = db
            .query_organization_plan_groups(QueryOrganizationPlanGroupsRequest {
                plan_id: "plan-test".into(),
                cursor: None,
                page_size: 20,
            })
            .expect("safe group projection")
            .groups
            .into_iter()
            .find(|group| group.item_count == 2)
            .expect("safe group");
        let updated = db
            .update_organization_plan_group_decision(UpdateOrganizationPlanGroupDecisionRequest {
                plan_id: "plan-test".into(),
                group_id: group.group_id.clone(),
                expected_plan_revision: 1,
                decision: "accepted".into(),
            })
            .expect("accept safe group members");
        assert_eq!(updated.plan.revision, 2);
        assert_eq!(updated.plan.summary.accepted, 1);
        assert_eq!(updated.group.expect("updated group").accepted_count, 1);
        let items = db
            .query_organization_plan_group_items(QueryOrganizationPlanGroupItemsRequest {
                plan_id: "plan-test".into(),
                group_id: group.group_id.clone(),
                cursor: None,
                page_size: 20,
            })
            .expect("group members after accept")
            .items;
        assert_eq!(
            items
                .iter()
                .filter(|item| item.decision == "accepted")
                .count(),
            1
        );
        assert!(db
            .update_organization_plan_group_decision(UpdateOrganizationPlanGroupDecisionRequest {
                plan_id: "plan-test".into(),
                group_id: group.group_id,
                expected_plan_revision: 1,
                decision: "kept".into(),
            })
            .expect_err("stale group decision")
            .to_string()
            .contains("organization_plan_revision_conflict"));
        drop(db);
        let _ = std::fs::remove_dir_all(fixture);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn decision_batch_uses_plan_and_item_revision_cas() {
        let (db, path) = test_database();
        seed_plan(&db, "ready");
        let updated = db
            .update_organization_plan_decisions(UpdateOrganizationPlanDecisionsRequest {
                plan_id: "plan-test".into(),
                expected_plan_revision: 1,
                safe_batch: false,
                mutations: vec![OrganizationDecisionMutation {
                    item_id: "item-test".into(),
                    expected_item_revision: 1,
                    decision: "accepted".into(),
                    edited_filename: None,
                }],
            })
            .expect("first decision");
        assert_eq!(updated.revision, 2);
        let page = db
            .query_organization_plan_items(QueryOrganizationPlanItemsRequest {
                plan_id: "plan-test".into(),
                cursor: None,
                page_size: 10,
            })
            .expect("decision page");
        assert_eq!(page.items[0].decision, "accepted");
        assert_eq!(page.items[0].revision, 2);
        assert!(db
            .update_organization_plan_decisions(UpdateOrganizationPlanDecisionsRequest {
                plan_id: "plan-test".into(),
                expected_plan_revision: 1,
                safe_batch: false,
                mutations: vec![OrganizationDecisionMutation {
                    item_id: "item-test".into(),
                    expected_item_revision: 1,
                    decision: "kept".into(),
                    edited_filename: None,
                }],
            })
            .is_err());
        drop(db);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn plan_summary_is_authoritative_for_the_whole_ledger() {
        let (db, path) = test_database();
        seed_plan(&db, "ready");
        {
            let conn = db.conn().expect("summary fixture");
            conn.execute(
                "UPDATE organization_plan_items
                 SET decision = 'accepted', validity = 'needs_review'
                 WHERE id = 'item-test'",
                [],
            )
            .expect("mark reviewed item");
        }
        let plan = db.get_organization_plan("plan-test").expect("summary plan");
        assert_eq!(plan.summary.accepted, 1);
        assert_eq!(plan.summary.needs_review, 1);
        assert_eq!(plan.summary.remaining_executable, 1);
        assert_eq!(plan.summary.undecided, 0);
        let page = db
            .query_organization_plan_items(QueryOrganizationPlanItemsRequest {
                plan_id: "plan-test".into(),
                cursor: None,
                page_size: 1,
            })
            .expect("review-state page");
        assert_eq!(page.items[0].review_state, "reviewed");
        drop(db);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn managed_scope_membership_fails_closed_for_watcher_recovery() {
        let (db, path) = test_database();
        {
            let conn = db.conn().expect("managed scope fixture");
            conn.execute(
                "INSERT INTO scan_roots (
                    id, normalized_path, display_name, source_kind, enabled,
                    health_status, current_generation, needs_reconciliation,
                    watcher_revision, watcher_applied_revision,
                    watcher_rule_recovery_required, created_at, updated_at
                 ) VALUES (
                    'root-scope-test', '/managed', 'Managed', 'file_library', 1,
                    'healthy', 1, 0, 4, 4, 0, 1, 1
                 )",
                [],
            )
            .expect("insert managed root");
        }
        db.insert_file(InsertFileRequest {
            id: "file-scope-test".into(),
            path: "/managed/source.txt".into(),
            name: "source.txt".into(),
            extension: "txt".into(),
            size: 1,
            mtime: 1,
            ctime: 1,
            is_dir: false,
            state_code: 0,
        })
        .expect("insert managed file");
        let query = FileQuerySpecV2 {
            scope: FileLibraryScopeV2::AllEnabledRoots,
            text: None,
            filters: FileQueryFiltersV2::default(),
            sort: FileLibrarySortV2::default(),
        };
        {
            let conn = db.conn().expect("healthy scope");
            assert!(
                file_matches_authoritative_query_scope(&conn, &query, "file-scope-test")
                    .expect("healthy scope membership")
            );
            conn.execute(
                "UPDATE scan_roots SET watcher_rule_recovery_required = 1
                 WHERE id = 'root-scope-test'",
                [],
            )
            .expect("require watcher recovery");
            let error = file_matches_authoritative_query_scope(&conn, &query, "file-scope-test")
                .expect_err("watcher recovery must fail closed");
            assert!(error.to_string().contains("library_scope_unavailable"));
        }
        drop(db);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn needs_review_requires_explicit_accept_before_becoming_reviewed() {
        let (db, path) = test_database();
        seed_plan(&db, "stale");
        {
            let conn = db.conn().expect("review fixture");
            conn.execute(
                "UPDATE organization_plan_items SET validity = 'needs_review',
                        risk_level = 'Sensitive', requires_confirmation = 1
                 WHERE id = 'item-test'",
                [],
            )
            .expect("mark needs review");
        }
        let updated = db
            .update_organization_plan_decisions(UpdateOrganizationPlanDecisionsRequest {
                plan_id: "plan-test".into(),
                expected_plan_revision: 1,
                safe_batch: false,
                mutations: vec![OrganizationDecisionMutation {
                    item_id: "item-test".into(),
                    expected_item_revision: 1,
                    decision: "accepted".into(),
                    edited_filename: None,
                }],
            })
            .expect("explicit review");
        assert_eq!(updated.status, "ready");
        assert_eq!(updated.summary.remaining_executable, 1);
        let page = db
            .query_organization_plan_items(QueryOrganizationPlanItemsRequest {
                plan_id: "plan-test".into(),
                cursor: None,
                page_size: 10,
            })
            .expect("reviewed item");
        assert_eq!(page.items[0].review_state, "reviewed");
        assert_eq!(page.items[0].risk_level, "Sensitive");
        assert!(page.items[0].requires_confirmation);
        drop(db);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    #[cfg_attr(
        target_os = "macos",
        ignore = "macOS file mutation source binding is intentionally fail-closed"
    )]
    fn reviewed_edited_target_is_the_actual_executed_target() {
        let (db, path) = test_database();
        let fixture = std::env::temp_dir().join(format!(
            "zen-canvas-organization-live-target-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&fixture).expect("create live-target fixture");
        let source = fixture.join("source.txt");
        let reviewed_target = fixture.join("reviewed.txt");
        let fixture_text = fixture.to_string_lossy().replace('\\', "/");
        let source_text = source.to_string_lossy().replace('\\', "/");
        std::fs::write(&source, b"reviewed target").expect("write source");
        let metadata = std::fs::metadata(&source).expect("source metadata");
        let mtime = metadata
            .modified()
            .expect("source modified")
            .duration_since(std::time::UNIX_EPOCH)
            .expect("source epoch")
            .as_secs() as i64;
        {
            let conn = db.conn().expect("live target fixture");
            conn.execute(
                "INSERT INTO scan_roots (
                    id, normalized_path, display_name, source_kind, enabled,
                    health_status, current_generation, needs_reconciliation,
                    created_at, updated_at
                 ) VALUES (
                    'root-live-target', ?1, 'Live target', 'file_library', 1,
                    'healthy', 1, 0, 1, 1
                 )",
                params![fixture_text],
            )
            .expect("insert healthy managed root");
        }
        db.insert_file(InsertFileRequest {
            id: "file-live-target".into(),
            path: source_text,
            name: "source.txt".into(),
            extension: "txt".into(),
            size: metadata.len() as i64,
            mtime,
            ctime: mtime,
            is_dir: false,
            state_code: 0,
        })
        .expect("index source");
        {
            let conn = db.conn().expect("classification fixture");
            conn.execute(
                "UPDATE files SET classification_status = 'classified',
                        suggested_action = 'Rename',
                        suggested_target_path = ?2,
                        suggested_name = 'model-name.txt',
                        confidence = 0.95, risk_level = 'Normal',
                        classification_reason = 'test proposal',
                        last_classified_mtime = mtime,
                        last_classified_size = size
                 WHERE id = ?1",
                params![
                    "file-live-target",
                    fixture.to_string_lossy().replace('\\', "/")
                ],
            )
            .expect("classify source");
        }
        let plan = db
            .create_organization_plan(CreateOrganizationPlanRequestV1 {
                version: 1,
                request_id: "live-target-request".into(),
                title: Some("Live target".into()),
                source: LibrarySelectionV1::Explicit {
                    file_ids: vec!["file-live-target".into()],
                },
                expected_count: Some(1),
            })
            .expect("create plan");
        let item = db
            .query_organization_plan_items(QueryOrganizationPlanItemsRequest {
                plan_id: plan.id.clone(),
                cursor: None,
                page_size: 10,
            })
            .expect("load live item")
            .items
            .remove(0);
        let reviewed = db
            .update_organization_plan_decisions(UpdateOrganizationPlanDecisionsRequest {
                plan_id: plan.id.clone(),
                expected_plan_revision: plan.revision,
                safe_batch: false,
                mutations: vec![OrganizationDecisionMutation {
                    item_id: item.id,
                    expected_item_revision: item.revision,
                    decision: "edited".into(),
                    edited_filename: Some("reviewed.txt".into()),
                }],
            })
            .expect("review edited target");
        let selection = OrganizationPlanSelectionRequest {
            plan_id: plan.id.clone(),
            expected_plan_revision: reviewed.revision,
            item_ids: Vec::new(),
            all_accepted: true,
        };
        let dry_run = db
            .get_organization_plan_dry_run(selection)
            .expect("canonical live dry run");
        assert_eq!(
            std::path::Path::new(&dry_run.items[0].to),
            reviewed_target.as_path()
        );
        assert!(
            dry_run.items[0].executable,
            "live item must be executable: {:?}",
            dry_run.items[0]
        );
        let dispatch = db
            .begin_organization_plan_execution(&ExecuteOrganizationPlanRequest {
                plan_id: plan.id.clone(),
                expected_plan_revision: reviewed.revision,
                dry_run_fingerprint: dry_run.dry_run_fingerprint,
                item_ids: Vec::new(),
                all_accepted: true,
                confirmed: true,
            })
            .expect("claim canonical execution");
        assert_eq!(
            std::path::Path::new(&dispatch.selections[0].target_path),
            reviewed_target.as_path()
        );
        let result = crate::file_ops::execute_moves_with_persistence(
            &db,
            crate::file_ops::ExecuteMovesRequest {
                operations: dispatch.selections.clone(),
            },
        )
        .expect("execute canonical target");
        assert!(reviewed_target.exists());
        assert!(!source.exists());
        assert_eq!(
            std::fs::canonicalize(&result.logs[0].path_after).expect("canonical journal target"),
            std::fs::canonicalize(&reviewed_target).expect("canonical reviewed target")
        );
        db.finalize_organization_plan_execution(&plan.id, &dispatch, &result.logs)
            .expect("finalize live target plan");
        drop(db);
        let _ = std::fs::remove_file(reviewed_target);
        let _ = std::fs::remove_dir(fixture);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn safe_batch_is_revalidated_by_the_repository() {
        let (db, path) = test_database();
        seed_plan(&db, "ready");
        let fixture = path.with_extension("safe-batch");
        std::fs::create_dir_all(&fixture).expect("create safe batch fixture");
        let source = fixture.join("source.txt");
        let target = fixture.join("renamed.txt");
        std::fs::write(&target, b"collision").expect("seed target collision");
        {
            let conn = db.conn().expect("safe batch fixture connection");
            conn.execute(
                "UPDATE organization_plan_items SET source_path_snapshot = ?1,
                        proposed_target_directory = ?2, proposed_target_path = ?3
                 WHERE id = 'item-test'",
                params![
                    source.to_string_lossy(),
                    fixture.to_string_lossy(),
                    target.to_string_lossy(),
                ],
            )
            .expect("bind safe batch fixture");
        }
        let error = db
            .update_organization_plan_decisions(UpdateOrganizationPlanDecisionsRequest {
                plan_id: "plan-test".into(),
                expected_plan_revision: 1,
                safe_batch: true,
                mutations: vec![OrganizationDecisionMutation {
                    item_id: "item-test".into(),
                    expected_item_revision: 1,
                    decision: "accepted".into(),
                    edited_filename: None,
                }],
            })
            .expect_err("live collision must block safe batch");
        assert!(error
            .to_string()
            .contains("organization_safe_batch_item_blocked"));
        drop(db);
        let _ = std::fs::remove_file(target);
        let _ = std::fs::remove_dir(fixture);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn terminal_plan_cannot_regress_and_delete_requires_confirmation() {
        let (db, path) = test_database();
        seed_plan(&db, "ready");
        let cancelled = db
            .cancel_organization_plan(OrganizationPlanRevisionRequest {
                plan_id: "plan-test".into(),
                expected_plan_revision: 1,
            })
            .expect("cancel plan");
        assert_eq!(cancelled.status, "cancelled");
        assert!(db
            .cancel_organization_plan(OrganizationPlanRevisionRequest {
                plan_id: "plan-test".into(),
                expected_plan_revision: cancelled.revision,
            })
            .is_err());
        assert!(db
            .delete_organization_plan(DeleteOrganizationPlanRequest {
                plan_id: "plan-test".into(),
                expected_plan_revision: cancelled.revision,
                confirmed: false,
            })
            .is_err());
        assert!(db
            .delete_organization_plan(DeleteOrganizationPlanRequest {
                plan_id: "plan-test".into(),
                expected_plan_revision: cancelled.revision,
                confirmed: true,
            })
            .expect("confirmed terminal delete"));
        drop(db);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn startup_recovery_never_replays_unjournaled_execution() {
        let (db, path) = test_database();
        seed_plan(&db, "executing");
        {
            let conn = db.conn().expect("execution fixture");
            conn.execute(
                "UPDATE organization_plans SET active_execution_id = 'execution-test',
                    active_operation_batch_id = 'batch-test' WHERE id = 'plan-test'",
                [],
            )
            .expect("mark execution owner");
            conn.execute(
                "UPDATE organization_plan_items SET validity = 'executing',
                    execution_id = 'execution-test' WHERE id = 'item-test'",
                [],
            )
            .expect("mark item executing");
        }
        assert_eq!(db.recover_organization_plans().expect("recover plan"), 1);
        let plan = db
            .get_organization_plan("plan-test")
            .expect("recovered plan");
        assert_eq!(plan.status, "ready");
        assert!(plan.active_execution_id.is_none());
        let page = db
            .query_organization_plan_items(QueryOrganizationPlanItemsRequest {
                plan_id: "plan-test".into(),
                cursor: None,
                page_size: 10,
            })
            .expect("recovered items");
        assert_eq!(page.items[0].validity, "ready");
        assert!(page.items[0].execution_id.is_none());
        drop(db);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn startup_recovery_projects_completed_after_journal_commit_crash() {
        let (db, path) = test_database();
        seed_plan(&db, "executing");
        {
            let conn = db.conn().expect("completed recovery fixture");
            conn.execute(
                "UPDATE organization_plans SET active_execution_id = 'execution-test',
                    active_operation_batch_id = 'batch-test' WHERE id = 'plan-test'",
                [],
            )
            .expect("mark owner");
            conn.execute(
                "UPDATE organization_plan_items SET decision = 'accepted',
                    validity = 'executed', execution_id = 'execution-test',
                    operation_log_id = 'log-preview-test' WHERE id = 'item-test'",
                [],
            )
            .expect("persist item journal projection");
            conn.execute(
                "INSERT INTO operation_batches (id, created_at, status)
                 VALUES ('batch-test', 1, 'completed')",
                [],
            )
            .expect("persist operation batch");
            conn.execute(
                "INSERT INTO operation_logs (
                    id, batch_id, operation_type, source_path, target_path,
                    old_name, new_name, status, created_at, path_before,
                    path_after, name_before, name_after
                 ) VALUES (
                    'log-preview-test', 'batch-test', 'rename', '/tmp/source.txt',
                    '/tmp/renamed.txt', 'source.txt', 'renamed.txt', 'success', 1,
                    '/tmp/source.txt', '/tmp/renamed.txt', 'source.txt', 'renamed.txt'
                 )",
                [],
            )
            .expect("persist successful journal before simulated crash");
        }
        assert_eq!(
            db.recover_organization_plans().expect("restart recovery"),
            1
        );
        let plan = db
            .get_organization_plan("plan-test")
            .expect("recovered plan");
        assert_eq!(plan.status, "completed");
        assert!(plan.completed_at.is_some());
        assert!(plan.active_execution_id.is_none());
        assert_eq!(plan.summary.executed, 1);
        drop(db);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn retention_uses_age_union_count_with_dedup_and_batch_cap() {
        let (db, path) = test_database();
        let now = current_unix_seconds();
        let old = now.saturating_sub(31 * 24 * 60 * 60);
        {
            let mut conn = db.conn().expect("retention fixture");
            let tx = conn.transaction().expect("retention transaction");
            for index in 0..101 {
                tx.execute(
                    "INSERT INTO organization_plans (
                        id, title, status, source_kind, source_snapshot_revision,
                        requested_count, materialized_count, planner_version, revision,
                        created_at, updated_at, ready_at, completed_at
                     ) VALUES (?1, 'Recent terminal', 'completed', 'explicit', 1,
                               0, 0, 1, 1, ?2, ?2, ?2, ?2)",
                    params![format!("recent-{index:03}"), now - index],
                )
                .expect("insert recent terminal");
            }
            tx.execute(
                "INSERT INTO organization_plans (
                    id, title, status, source_kind, source_snapshot_revision,
                    requested_count, materialized_count, planner_version, revision,
                    created_at, updated_at, ready_at, completed_at
                 ) VALUES ('age-only', 'Age terminal', 'completed', 'explicit', 1,
                           0, 0, 1, 1, ?1, ?1, ?1, ?1)",
                params![old],
            )
            .expect("insert age terminal");
            tx.execute(
                "INSERT INTO organization_plans (
                    id, title, status, source_kind, source_snapshot_revision,
                    requested_count, materialized_count, planner_version, revision,
                    active_execution_id, active_operation_batch_id,
                    created_at, updated_at, ready_at
                 ) VALUES ('active-execution', 'Active', 'executing', 'explicit', 1,
                           0, 0, 1, 1, 'execution', 'batch',
                           ?1, ?1, ?1)",
                params![old],
            )
            .expect("insert active plan");
            tx.commit().expect("publish retention fixture");
        }
        let pruned = db.prune_organization_plans().expect("prune union");
        assert_eq!(pruned, 2);
        let conn = db.conn().expect("retention assertions");
        let age_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM organization_plans WHERE id = 'age-only'",
                [],
                |row| row.get(0),
            )
            .expect("age count");
        let recent_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM organization_plans WHERE id LIKE 'recent-%'",
                [],
                |row| row.get(0),
            )
            .expect("recent count");
        let active_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM organization_plans WHERE id = 'active-execution'",
                [],
                |row| row.get(0),
            )
            .expect("active count");
        assert_eq!(age_exists, 0);
        assert_eq!(recent_exists, 100);
        assert_eq!(active_exists, 1);
        drop(conn);
        drop(db);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    #[ignore = "Task 06 100/1k/10k plan ledger, review, dry-run, refresh, WAL and prune benchmark"]
    fn performance_task06_plan_100_1k_10k_repository() {
        use std::time::Instant;

        for count in [100_usize, 1_000, 10_000] {
            let (db, path) = test_database();
            let create_start = Instant::now();
            {
                let mut conn = db.conn().expect("benchmark seed connection");
                let tx = conn.transaction().expect("benchmark seed transaction");
                tx.execute(
                    "INSERT INTO organization_plans (
                        id, title, status, source_kind, source_snapshot_revision,
                        requested_count, materialized_count, planner_version, revision,
                        created_at, updated_at, ready_at
                     ) VALUES ('plan-bench', 'Benchmark', 'ready', 'explicit', 1, ?1, ?1, 1, 1, 1, 1, 1)",
                    params![count as i64],
                )
                .expect("seed benchmark plan");
                {
                    let mut insert = tx
                        .prepare(
                            "INSERT INTO organization_plan_items (
                                id, plan_id, ordinal, file_id_snapshot, source_path_snapshot,
                                source_name_snapshot, source_size_snapshot, source_mtime_snapshot,
                                source_is_dir_snapshot, proposal_fingerprint, proposal_kind,
                                proposed_target_directory, proposed_name, proposed_target_path,
                                decision, validity, confidence, risk_level, requires_confirmation,
                                authoritative_preview_id, revision, created_at, updated_at
                             ) VALUES (?1, 'plan-bench', ?2, ?3, ?4, ?5, 1, 1, 0, ?6,
                                       'rename', '/missing', ?7, ?8, 'undecided', 'ready',
                                       0.95, 'Normal', 0, ?9, 1, 1, 1)",
                        )
                        .expect("prepare item insert");
                    for ordinal in 0..count {
                        insert
                            .execute(params![
                                format!("bench-item-{ordinal:05}"),
                                ordinal as i64,
                                format!("bench-file-{ordinal:05}"),
                                format!("/missing/source-{ordinal:05}.txt"),
                                format!("source-{ordinal:05}.txt"),
                                format!("fingerprint-{ordinal:05}"),
                                format!("renamed-{ordinal:05}.txt"),
                                format!("/missing/renamed-{ordinal:05}.txt"),
                                format!("preview-{ordinal:05}"),
                            ])
                            .expect("insert benchmark item");
                    }
                }
                tx.commit().expect("publish benchmark plan");
            }
            let create_ms = create_start.elapsed().as_secs_f64() * 1000.0;
            if count == 1_000 {
                assert!(create_ms <= 500.0, "1k plan ledger create {create_ms:.3}ms");
            }
            if count == 10_000 {
                assert!(
                    create_ms <= 3_000.0,
                    "10k plan ledger create {create_ms:.3}ms"
                );
            }

            let first_start = Instant::now();
            let first = db
                .query_organization_plan_items(QueryOrganizationPlanItemsRequest {
                    plan_id: "plan-bench".into(),
                    cursor: None,
                    page_size: 100,
                })
                .expect("benchmark first page");
            let first_ms = first_start.elapsed().as_secs_f64() * 1000.0;
            assert!(first_ms <= 100.0, "first page {first_ms:.3}ms");
            let group_start = Instant::now();
            let groups = db
                .query_organization_plan_groups(QueryOrganizationPlanGroupsRequest {
                    plan_id: "plan-bench".into(),
                    cursor: None,
                    page_size: 200,
                })
                .expect("benchmark group projection");
            let group_ms = group_start.elapsed().as_secs_f64() * 1000.0;
            assert_eq!(
                groups
                    .groups
                    .iter()
                    .map(|group| group.item_count)
                    .sum::<i64>(),
                count as i64
            );
            if count == 10_000 {
                assert!(group_ms <= 1_000.0, "10k group projection {group_ms:.3}ms");
            }
            if count == 100 {
                let conn = db.conn().expect("organization query plan connection");
                for (sql, expected_index) in [
                    (
                        "EXPLAIN QUERY PLAN SELECT id FROM organization_plans \
                         WHERE status = 'completed' ORDER BY updated_at DESC, id LIMIT 20",
                        "idx_organization_plans_status_updated",
                    ),
                    (
                        "EXPLAIN QUERY PLAN SELECT id FROM organization_plan_items \
                         WHERE plan_id = 'plan-bench' AND validity = 'ready' \
                           AND decision = 'accepted' ORDER BY ordinal, id LIMIT 1000",
                        "idx_organization_plan_items_plan_state",
                    ),
                    (
                        "EXPLAIN QUERY PLAN SELECT id FROM organization_plan_items \
                         WHERE file_id_snapshot = 'bench-file-00000'",
                        "idx_organization_plan_items_file",
                    ),
                    (
                        "EXPLAIN QUERY PLAN SELECT id FROM organization_plan_items \
                         WHERE execution_id = 'execution-bench' AND validity = 'executing'",
                        "idx_organization_plan_items_execution",
                    ),
                ] {
                    let plan = conn
                        .prepare(sql)
                        .expect("prepare organization query plan")
                        .query_map([], |row| row.get::<_, String>(3))
                        .expect("read organization query plan")
                        .collect::<Result<Vec<_>, _>>()
                        .expect("collect organization query plan");
                    assert!(
                        plan.iter().any(|detail| detail.contains(expected_index)),
                        "{expected_index} must serve its Task 06 read path: {plan:?}"
                    );
                }
            }

            let deep_start = Instant::now();
            let mut cursor = first.next_cursor;
            let mut last_page = first.items;
            while let Some(next) = cursor {
                let page = db
                    .query_organization_plan_items(QueryOrganizationPlanItemsRequest {
                        plan_id: "plan-bench".into(),
                        cursor: Some(next),
                        page_size: 200,
                    })
                    .expect("benchmark keyset page");
                cursor = page.next_cursor;
                last_page = page.items;
            }
            assert!(!last_page.is_empty());
            let deep_ms = deep_start.elapsed().as_secs_f64() * 1000.0;

            let page = db
                .query_organization_plan_items(QueryOrganizationPlanItemsRequest {
                    plan_id: "plan-bench".into(),
                    cursor: None,
                    page_size: 200,
                })
                .expect("mutation source page");
            let all_items = {
                let conn = db.conn().expect("all mutation rows");
                let mut stmt = conn
                    .prepare("SELECT id, revision FROM organization_plan_items WHERE plan_id = 'plan-bench' ORDER BY ordinal")
                    .expect("prepare all mutation rows");
                stmt.query_map([], |row| {
                    Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
                })
                .expect("query mutation rows")
                .collect::<Result<Vec<_>, _>>()
                .expect("collect mutation rows")
            };
            assert_eq!(page.plan_revision, 1);
            let decision_start = Instant::now();
            let changed = db
                .update_organization_plan_decisions(UpdateOrganizationPlanDecisionsRequest {
                    plan_id: "plan-bench".into(),
                    expected_plan_revision: 1,
                    safe_batch: false,
                    mutations: all_items
                        .into_iter()
                        .map(|(item_id, revision)| OrganizationDecisionMutation {
                            item_id,
                            expected_item_revision: revision,
                            decision: "accepted".into(),
                            edited_filename: None,
                        })
                        .collect(),
                })
                .expect("benchmark batch decision");
            let decision_ms = decision_start.elapsed().as_secs_f64() * 1000.0;
            if count == 10_000 {
                assert!(decision_ms <= 500.0, "10k decision {decision_ms:.3}ms");
            }

            let execution_fixture = path.with_extension("task06-execution-files");
            if count == 1_000 {
                std::fs::create_dir_all(&execution_fixture)
                    .expect("create execution benchmark fixture");
                let mut conn = db.conn().expect("execution benchmark seed");
                let tx = conn.transaction().expect("execution benchmark transaction");
                tx.execute(
                    "INSERT INTO scan_roots (
                        id, normalized_path, display_name, source_kind, enabled,
                        health_status, current_generation, needs_reconciliation,
                        created_at, updated_at
                     ) VALUES ('organization-benchmark-root', ?1,
                               'Organization benchmark', 'file_library', 1,
                               'healthy', 1, 0, 1, 1)",
                    params![execution_fixture.to_string_lossy().replace('\\', "/")],
                )
                .expect("seed authoritative execution root");
                for ordinal in 0..count {
                    let file_id = format!("bench-file-{ordinal:05}");
                    let item_id = format!("bench-item-{ordinal:05}");
                    let source_name = format!("source-{ordinal:05}.txt");
                    let target_name = format!("renamed-{ordinal:05}.txt");
                    let source_path = execution_fixture.join(&source_name);
                    let target_path = execution_fixture.join(&target_name);
                    std::fs::write(&source_path, b"x").expect("write execution benchmark source");
                    tx.execute(
                        "INSERT INTO files (id, path, name, extension, size, mtime)
                         VALUES (?1, ?2, ?3, 'txt', 1, 1)",
                        params![
                            file_id,
                            source_path.to_string_lossy().replace('\\', "/"),
                            source_name,
                        ],
                    )
                    .expect("seed indexed execution source");
                    tx.execute(
                        "UPDATE files SET classification_status = 'classified',
                                suggested_action = 'Rename', suggested_target_path = ?2,
                                suggested_name = ?3, confidence = 0.95,
                                risk_level = 'Normal', last_classified_mtime = 1,
                                last_classified_size = 1
                         WHERE id = ?1",
                        params![
                            file_id,
                            execution_fixture.to_string_lossy().replace('\\', "/"),
                            target_name,
                        ],
                    )
                    .expect("seed authoritative execution proposal");
                    let indexed = load_indexed_file_by_id(&tx, &file_id)
                        .expect("load authoritative execution file")
                        .expect("authoritative execution file exists");
                    let preview = operation_preview_from_indexed(indexed.clone())
                        .expect("authoritative execution preview");
                    let proposal = proposal_from_preview(
                        &indexed.path,
                        &indexed.name,
                        &indexed.classification_status,
                        &indexed.suggested_action,
                        Some(preview.clone()),
                    );
                    tx.execute(
                        "UPDATE organization_plan_items SET
                            source_path_snapshot = ?2, source_name_snapshot = ?3,
                            proposed_target_directory = ?4, proposed_name = ?5,
                            proposed_target_path = ?6, proposal_fingerprint = ?7,
                            proposal_kind = ?8, validity = ?9,
                            confidence = ?10, risk_level = ?11,
                            requires_confirmation = ?12,
                            authoritative_preview_id = ?13
                         WHERE id = ?1",
                        params![
                            item_id,
                            source_path.to_string_lossy().replace('\\', "/"),
                            source_name,
                            execution_fixture.to_string_lossy().replace('\\', "/"),
                            target_name,
                            target_path.to_string_lossy().replace('\\', "/"),
                            proposal.fingerprint,
                            proposal.kind,
                            proposal.validity,
                            proposal.confidence,
                            proposal.risk,
                            i64::from(proposal.requires_confirmation),
                            preview.id,
                        ],
                    )
                    .expect("bind execution benchmark item");
                }
                tx.commit().expect("publish execution benchmark fixture");
            }

            let mut dry_ms = None;
            let mut dry_run_for_execution = None;
            if count <= 1_000 {
                let dry_start = Instant::now();
                let dry = db
                    .get_organization_plan_dry_run(OrganizationPlanSelectionRequest {
                        plan_id: "plan-bench".into(),
                        expected_plan_revision: changed.revision,
                        item_ids: Vec::new(),
                        all_accepted: true,
                    })
                    .expect("benchmark dry run");
                dry_ms = Some(dry_start.elapsed().as_secs_f64() * 1000.0);
                assert_eq!(dry.selected_count, count as i64);
                if count == 1_000 {
                    assert!(dry_ms.unwrap() <= 1_000.0, "1k dry run {dry_ms:?}ms");
                    assert_eq!(dry.executable_count, 1_000);
                    dry_run_for_execution = Some(dry);
                }
            }

            let wal_reader = Connection::open(&path).expect("benchmark WAL reader");
            assert_eq!(
                wal_reader
                    .query_row(
                        "SELECT COUNT(*) FROM organization_plan_items WHERE plan_id = 'plan-bench'",
                        [],
                        |row| row.get::<_, i64>(0),
                    )
                    .expect("WAL read"),
                count as i64
            );

            let mut execution_ms = None;
            let refresh_ms = if let Some(dry) = dry_run_for_execution {
                let execution_start = Instant::now();
                let dispatch = db
                    .begin_organization_plan_execution(&ExecuteOrganizationPlanRequest {
                        plan_id: "plan-bench".into(),
                        expected_plan_revision: changed.revision,
                        dry_run_fingerprint: dry.dry_run_fingerprint,
                        item_ids: Vec::new(),
                        all_accepted: true,
                        confirmed: true,
                    })
                    .expect("benchmark execution preparation");
                execution_ms = Some(execution_start.elapsed().as_secs_f64() * 1000.0);
                assert_eq!(dispatch.item_ids.len(), 1_000);
                assert!(
                    execution_ms.unwrap() <= 1_000.0,
                    "1k execution preparation {execution_ms:?}ms"
                );
                db.fail_unjournaled_organization_execution(
                    "plan-bench",
                    &dispatch,
                    "benchmark rollback",
                )
                .expect("close benchmark execution lease");
                0.0
            } else {
                let refresh_start = Instant::now();
                let refreshed = db
                    .refresh_organization_plan(OrganizationPlanRevisionRequest {
                        plan_id: "plan-bench".into(),
                        expected_plan_revision: changed.revision,
                    })
                    .expect("benchmark refresh");
                let elapsed = refresh_start.elapsed().as_secs_f64() * 1000.0;
                if count == 10_000 {
                    assert!(elapsed <= 3_000.0, "10k refresh {elapsed:.3}ms");
                }
                assert_eq!(refreshed.status, "stale");
                elapsed
            };

            {
                let conn = db.conn().expect("terminal benchmark plan");
                conn.execute(
                    "UPDATE organization_plans SET status = 'completed', updated_at = 0,
                        completed_at = 0 WHERE id = 'plan-bench'",
                    [],
                )
                .expect("terminalize benchmark plan");
                for ordinal in 0..100 {
                    conn.execute(
                        "INSERT INTO organization_plans (
                            id, title, status, source_kind, source_snapshot_revision,
                            requested_count, materialized_count, planner_version, revision,
                            created_at, updated_at, completed_at
                         ) VALUES (?1, 'Retention fixture', 'completed', 'explicit', 1,
                                   0, 0, 1, 1, 1, 1, 1)",
                        params![format!("retained-plan-{ordinal:03}")],
                    )
                    .expect("seed retained terminal plan");
                }
            }
            // Task 07 keeps the Task 06 retention contract fail-closed while
            // pruning the age/count candidate union in bounded batches.
            assert_eq!(db.prune_organization_plans().expect("benchmark prune"), 20);
            println!(
                "Task 06 plan items={count} create_ms={create_ms:.3} first_page_ms={first_ms:.3} deep_keyset_ms={deep_ms:.3} decision_ms={decision_ms:.3} dry_ms={dry_ms:?} execution_ms={execution_ms:?} refresh_ms={refresh_ms:.3}"
            );
            drop(wal_reader);
            drop(db);
            let _ = std::fs::remove_file(path);
            let _ = std::fs::remove_dir_all(execution_fixture);
        }
    }
}
