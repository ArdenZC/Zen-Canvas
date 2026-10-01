use crate::db::FileQuerySpecV2;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AutomationTriggerV2 {
    pub version: i32,
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub time_zone: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub local_time: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub weekdays: Option<Vec<i8>>,
}
impl<'de> Deserialize<'de> for AutomationTriggerV2 {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        use serde::de::Error;
        let value = serde_json::Value::deserialize(deserializer)?;
        let object = value
            .as_object()
            .ok_or_else(|| D::Error::custom("trigger must be an object"))?;
        let kind = object
            .get("kind")
            .and_then(serde_json::Value::as_str)
            .ok_or_else(|| D::Error::custom("trigger kind required"))?;
        let allowed: &[&str] = if kind == "schedule" {
            &["version", "kind", "timeZone", "localTime", "weekdays"]
        } else {
            &["version", "kind"]
        };
        if object.keys().any(|key| !allowed.contains(&key.as_str())) {
            return Err(D::Error::custom("unknown trigger field"));
        }
        let version = serde_json::from_value(
            object
                .get("version")
                .cloned()
                .ok_or_else(|| D::Error::custom("trigger version required"))?,
        )
        .map_err(D::Error::custom)?;
        let time_zone = object
            .get("timeZone")
            .map(|v| serde_json::from_value(v.clone()).map_err(D::Error::custom))
            .transpose()?;
        let local_time = object
            .get("localTime")
            .map(|v| serde_json::from_value(v.clone()).map_err(D::Error::custom))
            .transpose()?;
        let weekdays = object
            .get("weekdays")
            .map(|v| serde_json::from_value(v.clone()).map_err(D::Error::custom))
            .transpose()?;
        Ok(Self {
            version,
            kind: kind.into(),
            time_zone,
            local_time,
            weekdays,
        })
    }
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
    pub trigger: AutomationTriggerV2,
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
    pub trigger: AutomationTriggerV2,
    pub policy: AutomationPolicyV1,
    pub enabled: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub archived_at: Option<i64>,
    pub trigger_state: Option<AutomationTriggerStatusV1>,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationRunV1 {
    pub id: String,
    pub request_key: String,
    pub intent_id: String,
    pub intent_revision: i64,
    pub trigger_kind: String,
    pub trigger_context: serde_json::Value,
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationTriggerStatusV1 {
    pub next_due_at: Option<i64>,
    pub pending_event_due_at: Option<i64>,
    pub last_error_code: Option<String>,
}
