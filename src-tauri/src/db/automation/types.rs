use crate::db::FileQuerySpecV2;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AutomationTriggerV1 {
    pub version: i32,
    pub kind: String,
}
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AutomationPolicyV1 {
    pub version: i32,
    pub review: String,
    pub auto_execute: bool,
}
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AutomationIntentDraftV1 {
    pub title: String,
    pub workflow_kind: String,
    pub scope_query: serde_json::Value,
    pub trigger: AutomationTriggerV1,
    pub policy: AutomationPolicyV1,
    pub enabled: bool,
}
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AutomationIntentUpdateV1 {
    pub intent_id: String,
    pub expected_revision: i64,
    pub draft: AutomationIntentDraftV1,
}
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AutomationIntentRevisionV1 {
    pub intent_id: String,
    pub expected_revision: i64,
}
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AutomationIntentEnabledV1 {
    pub intent_id: String,
    pub expected_revision: i64,
    pub enabled: bool,
}
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RunAutomationIntentV1 {
    pub version: i32,
    pub intent_id: String,
    pub expected_intent_revision: i64,
    pub request_key: String,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationIntentV1 {
    pub id: String,
    pub revision: i64,
    pub title: String,
    pub workflow_kind: String,
    pub scope_query: FileQuerySpecV2,
    pub scope_fingerprint: String,
    pub trigger: AutomationTriggerV1,
    pub policy: AutomationPolicyV1,
    pub enabled: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub archived_at: Option<i64>,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationRunV1 {
    pub id: String,
    pub request_key: String,
    pub intent_id: String,
    pub intent_revision: i64,
    pub trigger_kind: String,
    pub scope_fingerprint: String,
    pub library_snapshot_revision: Option<i64>,
    pub status: String,
    pub result_plan_id: Option<String>,
    pub queued_analysis_count: i64,
    pub requires_plan_refresh: bool,
    pub analysis_blocker_code: Option<String>,
    pub error_code: Option<String>,
    pub created_at: i64,
    pub completed_at: i64,
}
