use super::types::*;
use crate::db::queries::{
    current_unix_seconds,
    library::{canonicalize_file_query_spec, resolve_scope},
};
use crate::db::{Database, DbError, FileLibraryScopeV2, FileQuerySpecV2};
use rusqlite::{params, Connection, OptionalExtension, Row};

pub(super) fn invalid(code: &str) -> DbError {
    DbError::Validation(code.into())
}
pub(super) fn validate_contract(draft: &AutomationIntentDraftV1) -> Result<(), DbError> {
    if draft.title.trim().is_empty() || draft.title.chars().count() > 120 {
        return Err(invalid("automation_title_invalid"));
    }
    if draft.workflow_kind != "organize_plan" {
        return Err(invalid("automation_workflow_invalid"));
    }
    if draft.trigger.version != 1 || draft.trigger.kind != "manual" {
        return Err(invalid("automation_trigger_invalid"));
    }
    if draft.policy.version != 1 || draft.policy.review != "required" || draft.policy.auto_execute {
        return Err(invalid("automation_policy_invalid"));
    }
    Ok(())
}
pub(super) fn canonical_scope(
    conn: &Connection,
    value: serde_json::Value,
) -> Result<(FileQuerySpecV2, String, String), DbError> {
    // The reusable scope envelope rejects renderer snapshot/path fields, even
    // though the older Query V2 scope enum permits serde extension fields.
    let scope = value
        .get("scope")
        .and_then(serde_json::Value::as_object)
        .ok_or_else(|| invalid("automation_scope_invalid"))?;
    let keys: Vec<&str> = scope.keys().map(String::as_str).collect();
    match scope.get("kind").and_then(serde_json::Value::as_str) {
        Some("all_enabled_roots") if keys.len() == 1 && keys.contains(&"kind") => {}
        Some("roots")
            if keys.len() == 2 && keys.contains(&"kind") && keys.contains(&"scanRootIds") => {}
        _ => return Err(invalid("automation_scope_not_durable")),
    }
    let query: FileQuerySpecV2 =
        serde_json::from_value(value).map_err(|_| invalid("automation_scope_invalid"))?;
    if matches!(query.scope, FileLibraryScopeV2::CurrentScan { .. }) {
        return Err(invalid("automation_scope_not_durable"));
    }
    let canonical = canonicalize_file_query_spec(query)?;
    let resolved = resolve_scope(conn, &canonical.0.scope)?;
    if resolved.health.state != "healthy" {
        return Err(invalid("automation_scope_unavailable"));
    }
    Ok(canonical)
}
const INTENT_COLUMNS: &str = "id,revision,title,workflow_kind,scope_query_json,scope_fingerprint,trigger_json,policy_json,enabled,created_at,updated_at,archived_at";
pub(super) const RUN_COLUMNS: &str = "id,request_key,intent_id,intent_revision,trigger_kind,scope_fingerprint,library_snapshot_revision,status,result_plan_id,queued_analysis_count,requires_plan_refresh,analysis_blocker_code,error_code,created_at,completed_at";
fn decode<T: serde::de::DeserializeOwned>(row: &Row<'_>, index: usize) -> rusqlite::Result<T> {
    let text: String = row.get(index)?;
    serde_json::from_str(&text).map_err(|e| {
        rusqlite::Error::FromSqlConversionFailure(index, rusqlite::types::Type::Text, Box::new(e))
    })
}
fn intent_row(row: &Row<'_>) -> rusqlite::Result<AutomationIntentV1> {
    Ok(AutomationIntentV1 {
        id: row.get(0)?,
        revision: row.get(1)?,
        title: row.get(2)?,
        workflow_kind: row.get(3)?,
        scope_query: decode(row, 4)?,
        scope_fingerprint: row.get(5)?,
        trigger: decode(row, 6)?,
        policy: decode(row, 7)?,
        enabled: row.get::<_, i64>(8)? != 0,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
        archived_at: row.get(11)?,
    })
}
pub(super) fn run_row(row: &Row<'_>) -> rusqlite::Result<AutomationRunV1> {
    Ok(AutomationRunV1 {
        id: row.get(0)?,
        request_key: row.get(1)?,
        intent_id: row.get(2)?,
        intent_revision: row.get(3)?,
        trigger_kind: row.get(4)?,
        scope_fingerprint: row.get(5)?,
        library_snapshot_revision: row.get(6)?,
        status: row.get(7)?,
        result_plan_id: row.get(8)?,
        queued_analysis_count: row.get(9)?,
        requires_plan_refresh: row.get::<_, i64>(10)? != 0,
        analysis_blocker_code: row.get(11)?,
        error_code: row.get(12)?,
        created_at: row.get(13)?,
        completed_at: row.get(14)?,
    })
}
pub(super) fn load_intent(conn: &Connection, id: &str) -> Result<AutomationIntentV1, DbError> {
    conn.query_row(
        &format!("SELECT {INTENT_COLUMNS} FROM automation_intents WHERE id=?1"),
        [id],
        intent_row,
    )
    .optional()?
    .ok_or_else(|| invalid("automation_intent_not_found"))
}
pub(super) fn require_revision(intent: &AutomationIntentV1, expected: i64) -> Result<(), DbError> {
    if intent.revision != expected {
        return Err(invalid("automation_revision_conflict"));
    }
    if intent.archived_at.is_some() {
        return Err(invalid("automation_intent_archived"));
    }
    Ok(())
}
impl Database {
    pub fn list_automation_intents(&self) -> Result<Vec<AutomationIntentV1>, DbError> {
        let conn = self.conn()?;
        let mut stmt=conn.prepare(&format!("SELECT {INTENT_COLUMNS} FROM automation_intents WHERE archived_at IS NULL ORDER BY updated_at DESC,id LIMIT 200"))?;
        let rows = stmt
            .query_map([], intent_row)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }
    pub fn get_automation_intent(&self, intent_id: &str) -> Result<AutomationIntentV1, DbError> {
        let conn = self.conn()?;
        load_intent(&conn, intent_id)
    }
    pub fn list_automation_runs(
        &self,
        intent_id: Option<&str>,
    ) -> Result<Vec<AutomationRunV1>, DbError> {
        let conn = self.conn()?;
        let mut stmt=conn.prepare(&format!("SELECT {RUN_COLUMNS} FROM automation_runs WHERE (?1 IS NULL OR intent_id=?1) ORDER BY created_at DESC,rowid DESC LIMIT 100"))?;
        let rows = stmt
            .query_map([intent_id], run_row)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }
    pub fn create_automation_intent(
        &self,
        draft: AutomationIntentDraftV1,
    ) -> Result<AutomationIntentV1, DbError> {
        validate_contract(&draft)?;
        let mut conn = self.conn()?;
        let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        let (_, json, fingerprint) = canonical_scope(&tx, draft.scope_query)?;
        let id = format!("automation-intent-{}", uuid::Uuid::new_v4());
        let now = current_unix_seconds();
        tx.execute("INSERT INTO automation_intents (id,revision,title,workflow_kind,scope_query_json,scope_fingerprint,trigger_json,policy_json,enabled,created_at,updated_at) VALUES (?1,1,?2,?3,?4,?5,?6,?7,?8,?9,?9)",params![id,draft.title.trim(),draft.workflow_kind,json,fingerprint,serde_json::to_string(&draft.trigger)?,serde_json::to_string(&draft.policy)?,i64::from(draft.enabled),now])?;
        let result = load_intent(&tx, &id)?;
        tx.commit()?;
        Ok(result)
    }
    pub fn update_automation_intent(
        &self,
        request: AutomationIntentUpdateV1,
    ) -> Result<AutomationIntentV1, DbError> {
        validate_contract(&request.draft)?;
        let mut conn = self.conn()?;
        let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        require_revision(
            &load_intent(&tx, &request.intent_id)?,
            request.expected_revision,
        )?;
        let (_, json, fingerprint) = canonical_scope(&tx, request.draft.scope_query.clone())?;
        let draft = request.draft;
        tx.execute("UPDATE automation_intents SET revision=revision+1,title=?2,scope_query_json=?3,scope_fingerprint=?4,trigger_json=?5,policy_json=?6,enabled=?7,updated_at=?8 WHERE id=?1 AND revision=?9",params![request.intent_id,draft.title.trim(),json,fingerprint,serde_json::to_string(&draft.trigger)?,serde_json::to_string(&draft.policy)?,i64::from(draft.enabled),current_unix_seconds(),request.expected_revision])?;
        let result = load_intent(&tx, &request.intent_id)?;
        tx.commit()?;
        Ok(result)
    }
    pub fn set_automation_intent_enabled(
        &self,
        request: AutomationIntentEnabledV1,
    ) -> Result<AutomationIntentV1, DbError> {
        self.mutate_automation_state(
            &request.intent_id,
            request.expected_revision,
            Some(request.enabled),
        )
    }
    pub fn archive_automation_intent(
        &self,
        request: AutomationIntentRevisionV1,
    ) -> Result<AutomationIntentV1, DbError> {
        self.mutate_automation_state(&request.intent_id, request.expected_revision, None)
    }
    fn mutate_automation_state(
        &self,
        id: &str,
        expected: i64,
        enabled: Option<bool>,
    ) -> Result<AutomationIntentV1, DbError> {
        let mut conn = self.conn()?;
        let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        require_revision(&load_intent(&tx, id)?, expected)?;
        let now = current_unix_seconds();
        tx.execute("UPDATE automation_intents SET revision=revision+1,enabled=?2,archived_at=?3,updated_at=?4 WHERE id=?1 AND revision=?5",params![id,i64::from(enabled.unwrap_or(false)),if enabled.is_none(){Some(now)}else{None},now,expected])?;
        let result = load_intent(&tx, id)?;
        tx.commit()?;
        Ok(result)
    }
}
