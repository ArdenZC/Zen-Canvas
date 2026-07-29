//! Task 06 durable organization-plan repository.
//!
//! Plans are review artifacts. Paths and operation kinds are derived from the
//! indexed file authority and are never accepted from renderer requests.

use super::files::operation_preview_from_indexed;
use super::library::{
    clear_temp_selection_ids, current_library_revision, selection_where, LibrarySelectionV1,
};
use super::*;
use rusqlite::{params, params_from_iter, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

const ORGANIZATION_PLAN_VERSION: i32 = 1;
const ORGANIZATION_PLAN_MAX_ITEMS: usize = 10_000;
const ORGANIZATION_EXECUTION_MAX_ITEMS: usize = 1_000;
const ORGANIZATION_PAGE_MAX: u32 = 200;

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
    pub confidence: f64,
    pub risk_level: String,
    pub requires_confirmation: bool,
    pub blocking_code: Option<String>,
    pub blocking_detail: Option<String>,
    pub authoritative_preview_id: Option<String>,
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
    pub selections: Vec<crate::file_ops::OperationSelection>,
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
            let mut unresolved = 0_i64;
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
                    "pending" | "manual_review" => {
                        unresolved += 1;
                        "executing"
                    }
                    _ => {
                        unresolved += 1;
                        "executing"
                    }
                };
                tx.execute(
                    "UPDATE organization_plan_items SET validity = ?2,
                            operation_log_id = ?3, revision = revision + 1, updated_at = ?4
                     WHERE id = ?1",
                    params![item_id, validity, log_id, now],
                )?;
            }
            let (status, error_code, error_detail) = if unknown > 0 {
                (
                    "stale",
                    Some("organization_journal_mapping_unknown"),
                    Some("One or more journal rows could not be mapped; manual review required."),
                )
            } else if unresolved > 0 {
                ("executing", None, None)
            } else {
                ("partially_completed", None, None)
            };
            tx.execute(
                "UPDATE organization_plans SET status = ?2,
                        active_execution_id = CASE WHEN ?2 = 'executing' THEN active_execution_id ELSE NULL END,
                        active_operation_batch_id = CASE WHEN ?2 = 'executing' THEN active_operation_batch_id ELSE NULL END,
                        revision = revision + 1, updated_at = ?3,
                        last_error_code = ?4, last_error_detail = ?5 WHERE id = ?1",
                params![plan_id, status, now, error_code, error_detail],
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
                "SELECT id FROM organization_plans
                 WHERE status IN ('completed', 'cancelled', 'failed')
                   AND updated_at < ?1
                   AND id NOT IN (
                     SELECT id FROM organization_plans
                     WHERE status IN ('completed', 'cancelled', 'failed')
                     ORDER BY updated_at DESC, id LIMIT 100
                   )
                 ORDER BY updated_at, id LIMIT 20",
            )?;
            let rows = stmt.query_map(params![cutoff], |row| row.get::<_, String>(0))?;
            rows.collect::<Result<Vec<_>, _>>()?
        };
        for id in &ids {
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
        let mut stmt = conn.prepare(
            "SELECT id, title, status, source_kind, source_query_fingerprint,
                    source_snapshot_revision, requested_count, materialized_count,
                    planner_version, revision, active_execution_id,
                    active_operation_batch_id, last_error_code, last_error_detail,
                    created_at, updated_at, ready_at, completed_at
             FROM organization_plans ORDER BY updated_at DESC, id LIMIT 200",
        )?;
        let rows = stmt.query_map([], plan_from_row)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(DbError::from)
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
            "UPDATE organization_plans SET revision = revision + 1, updated_at = ?3
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
            tx.execute(
                "UPDATE organization_plan_items SET proposal_fingerprint = ?2,
                        proposal_kind = ?3, proposed_target_directory = ?4,
                        proposed_name = ?5, proposed_target_path = ?6, validity = ?7,
                        confidence = ?8, risk_level = ?9, requires_confirmation = ?10,
                        blocking_code = ?11, blocking_detail = ?12,
                        authoritative_preview_id = ?13, revision = revision + 1,
                        updated_at = ?14 WHERE id = ?1",
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
        let plan_id = validate_id(&request.plan_id, "organization_plan_id_invalid")?;
        let conn = self.conn()?;
        require_plan_revision_and_status(
            &conn,
            &plan_id,
            request.expected_plan_revision,
            &["ready", "partially_completed"],
        )?;
        let selected = selected_plan_items(&conn, &request)?;
        let mut items = Vec::with_capacity(selected.len());
        let mut kinds = HashSet::new();
        let mut total_bytes = 0_i64;
        let mut executable_count = 0_i64;
        let mut blocked_count = 0_i64;
        let mut stale_count = 0_i64;
        let mut fingerprint_parts =
            vec![plan_id.clone(), request.expected_plan_revision.to_string()];
        for item in selected {
            let current = load_indexed_file_by_id(&conn, &item.file_id_snapshot)?;
            let source_unchanged = current.as_ref().is_some_and(|row| {
                row.path == item.source_path_snapshot
                    && row.size == item.source_size_snapshot
                    && row.mtime == item.source_mtime_snapshot
            });
            let collision = item.proposed_target_path != item.source_path_snapshot
                && std::path::Path::new(&item.proposed_target_path).exists();
            let source_health = if current.is_none() {
                "missing"
            } else if !source_unchanged {
                "stale"
            } else {
                "healthy"
            };
            let executable = item.validity == "ready"
                && matches!(item.decision.as_str(), "accepted" | "edited")
                && source_unchanged
                && !collision
                && item.authoritative_preview_id.is_some();
            if executable {
                executable_count += 1;
                total_bytes = total_bytes.saturating_add(item.source_size_snapshot);
                kinds.insert(item.proposal_kind.clone());
            } else {
                blocked_count += 1;
                if source_health == "stale" || item.validity == "stale" {
                    stale_count += 1;
                }
            }
            fingerprint_parts.extend([
                item.id.clone(),
                item.revision.to_string(),
                item.proposal_fingerprint.clone(),
                item.decision.clone(),
                item.edited_name.clone().unwrap_or_default(),
                source_health.to_string(),
                collision.to_string(),
            ]);
            let target = if let Some(edited) = item.edited_name.as_deref() {
                std::path::Path::new(&item.proposed_target_directory)
                    .join(edited)
                    .to_string_lossy()
                    .to_string()
            } else {
                item.proposed_target_path.clone()
            };
            let parent_directory_to_create = std::path::Path::new(&target)
                .parent()
                .filter(|path| !path.exists())
                .map(|path| path.to_string_lossy().to_string());
            items.push(OrganizationDryRunItemDto {
                item_id: item.id,
                operation_kind: item.proposal_kind,
                from: item.source_path_snapshot.clone(),
                to: target,
                edited_filename: item.edited_name,
                parent_directory_to_create,
                collision,
                cross_volume: paths_cross_volume(
                    &item.source_path_snapshot,
                    &item.proposed_target_path,
                ),
                risk_level: item.risk_level,
                requires_confirmation: item.requires_confirmation,
                source_health: source_health.to_string(),
                authoritative_preview_id: item.authoritative_preview_id,
                executable,
                blocking_code: item.blocking_code,
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
        let executable_ids = dry_run
            .items
            .iter()
            .filter(|item| item.executable)
            .take(ORGANIZATION_EXECUTION_MAX_ITEMS)
            .map(|item| item.item_id.clone())
            .collect::<Vec<_>>();
        if executable_ids.is_empty() {
            return Err(DbError::Validation(
                "organization_execution_no_executable_items".to_string(),
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
        let now = current_unix_seconds();
        let mut selections = Vec::with_capacity(executable_ids.len());
        for item_id in &executable_ids {
            let (file_id, preview_id, edited_name, validity, decision): (
                String,
                Option<String>,
                Option<String>,
                String,
                String,
            ) = tx.query_row(
                "SELECT file_id_snapshot, authoritative_preview_id, edited_name,
                        validity, decision
                 FROM organization_plan_items WHERE id = ?1 AND plan_id = ?2",
                params![item_id, request.plan_id],
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
            if validity != "ready" || !matches!(decision.as_str(), "accepted" | "edited") {
                return Err(DbError::Validation(
                    "organization_execution_item_changed".to_string(),
                ));
            }
            selections.push(crate::file_ops::OperationSelection {
                id: preview_id.ok_or_else(|| {
                    DbError::Validation("organization_preview_missing".to_string())
                })?,
                file_id,
                new_name: edited_name,
            });
            tx.execute(
                "UPDATE organization_plan_items SET validity = 'executing',
                        execution_id = ?2, revision = revision + 1, updated_at = ?3
                 WHERE id = ?1 AND validity = 'ready'",
                params![item_id, execution_id, now],
            )?;
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
        let remaining: i64 = tx.query_row(
            "SELECT COUNT(*) FROM organization_plan_items
             WHERE plan_id = ?1 AND decision IN ('accepted', 'edited')
               AND validity = 'ready'",
            params![plan_id],
            |row| row.get(0),
        )?;
        let unresolved: i64 = tx.query_row(
            "SELECT COUNT(*) FROM organization_plan_items
             WHERE plan_id = ?1 AND validity = 'executing'",
            params![plan_id],
            |row| row.get(0),
        )?;
        let (status, completed_at) = if unresolved > 0 {
            ("executing", None)
        } else if remaining > 0 || failed > 0 || skipped > 0 {
            ("partially_completed", None)
        } else {
            ("completed", Some(now))
        };
        tx.execute(
            "UPDATE organization_plans SET status = ?2, active_execution_id = NULL,
                    active_operation_batch_id = NULL, revision = revision + 1,
                    updated_at = ?3, completed_at = ?4,
                    last_error_code = CASE WHEN ?5 > 0 THEN 'organization_items_failed' ELSE NULL END,
                    last_error_detail = CASE WHEN ?5 > 0 THEN CAST(?5 AS TEXT) || ' item(s) failed' ELSE NULL END
             WHERE id = ?1 AND active_execution_id = ?6",
            params![
                plan_id,
                status,
                now,
                completed_at,
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
    conn.query_row(
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
    .ok_or_else(|| DbError::Validation("organization_plan_not_found".to_string()))
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
    })
}

fn item_from_row(row: &Row<'_>) -> rusqlite::Result<OrganizationPlanItemDto> {
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
        decision: row.get(14)?,
        edited_name: row.get(15)?,
        validity: row.get(16)?,
        confidence: row.get(17)?,
        risk_level: row.get(18)?,
        requires_confirmation: row.get::<_, i64>(19)? != 0,
        blocking_code: row.get(20)?,
        blocking_detail: row.get(21)?,
        authoritative_preview_id: row.get(22)?,
        operation_log_id: row.get(23)?,
        execution_id: row.get(24)?,
        revision: row.get(25)?,
        created_at: row.get(26)?,
        updated_at: row.get(27)?,
    })
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

fn selected_plan_items(
    conn: &rusqlite::Connection,
    request: &OrganizationPlanSelectionRequest,
) -> Result<Vec<OrganizationPlanItemDto>, DbError> {
    if request.all_accepted == !request.item_ids.is_empty() {
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
    if value.is_empty() || value.len() > 2048 || value.len() % 2 != 0 {
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
                        params![file_id, source_path.to_string_lossy(), source_name,],
                    )
                    .expect("seed indexed execution source");
                    tx.execute(
                        "UPDATE organization_plan_items SET
                            source_path_snapshot = ?2, source_name_snapshot = ?3,
                            proposed_target_directory = ?4, proposed_name = ?5,
                            proposed_target_path = ?6
                         WHERE id = ?1",
                        params![
                            item_id,
                            source_path.to_string_lossy(),
                            source_name,
                            execution_fixture.to_string_lossy(),
                            target_name,
                            target_path.to_string_lossy(),
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
            assert_eq!(db.prune_organization_plans().expect("benchmark prune"), 1);
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
