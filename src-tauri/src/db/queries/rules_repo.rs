use super::super::*;
use rusqlite::{params, Connection, OptionalExtension, Row, Transaction};
use serde::{Deserialize, Serialize};
use serde_json::{Number, Value};
use std::sync::{Mutex, MutexGuard, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

pub const RULE_AST_VERSION: i64 = 1;

// Rule execution and every catalog mutation share this process-local gate. It
// prevents a long-running execution from observing catalog revision N while a
// concurrent mutation publishes N+1 halfway through the run. The durable CAS
// revision remains the authority across processes; this gate closes the
// in-process TOCTOU window used by the desktop runtime and tests.
static RULE_CATALOG_EXECUTION_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

pub(crate) fn catalog_execution_guard() -> MutexGuard<'static, ()> {
    RULE_CATALOG_EXECUTION_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct RuleDraftV2 {
    pub name: String,
    #[serde(default)]
    pub priority: f64,
    #[serde(default)]
    pub weight: f64,
    pub root_operator: String,
    pub groups: Vec<RuleGroupDraftV2>,
    #[serde(default)]
    pub action: RuleActionDraftV2,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct RuleGroupDraftV2 {
    pub operator: String,
    pub conditions: Vec<RuleConditionDraftV2>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct RuleConditionDraftV2 {
    pub field: String,
    pub operator: String,
    pub value: Value,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct RuleActionDraftV2 {
    #[serde(default)]
    pub purpose: Option<String>,
    #[serde(default)]
    pub lifecycle: Option<String>,
    #[serde(default)]
    pub context: Option<String>,
    #[serde(default)]
    pub risk_level: Option<String>,
    #[serde(default)]
    pub suggested_action: Option<String>,
    #[serde(default)]
    pub target_template: Option<String>,
    #[serde(default)]
    pub rename_template: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct CanonicalRuleAstV1 {
    pub ast_version: i64,
    pub name: String,
    pub priority: f64,
    pub weight: f64,
    pub root_operator: RuleOperator,
    pub groups: Vec<RuleConditionGroup>,
    pub action: RuleAction,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CanonicalRuleResultV2 {
    pub candidate: CanonicalRuleAstV1,
    pub fingerprint: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserRuleV2 {
    #[serde(flatten)]
    pub rule: Rule,
    pub ast_version: i64,
    pub revision: i64,
    pub origin_proposal_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleCatalogStateDto {
    pub revision: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct CreateUserRuleV2Request {
    pub version: i32,
    pub request_id: String,
    pub expected_catalog_revision: i64,
    pub draft: RuleDraftV2,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct UpdateUserRuleV2Request {
    pub rule_id: String,
    pub expected_rule_revision: i64,
    pub expected_catalog_revision: i64,
    pub draft: RuleDraftV2,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct SetUserRuleEnabledV2Request {
    pub rule_id: String,
    pub expected_rule_revision: i64,
    pub expected_catalog_revision: i64,
    pub enabled: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct DeleteUserRuleV2Request {
    pub rule_id: String,
    pub expected_rule_revision: i64,
    pub expected_catalog_revision: i64,
    pub confirmed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleMutationResultV2 {
    pub rule: UserRuleV2,
    pub catalog_revision: i64,
}

impl Database {
    pub fn get_user_rules(&self) -> Result<Vec<Rule>, DbError> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            r#"
            SELECT
                id,
                name,
                source,
                enabled,
                priority,
                weight,
                root_operator,
                groups_json,
                action_json,
                created_at,
                updated_at
            FROM rules
            WHERE source = 'user'
            ORDER BY priority DESC, updated_at DESC, name COLLATE NOCASE ASC
            "#,
        )?;
        let rows = stmt.query_map([], rule_from_row)?;
        let mut rules = Vec::new();
        for row in rows {
            rules.push(rule_from_sql_row(row?)?);
        }

        Ok(rules)
    }

    pub fn save_user_rule(&self, rule: Rule) -> Result<Rule, DbError> {
        let _catalog_guard = catalog_execution_guard();
        let mut rule = rule;
        rule.source = RuleSource::User;
        validate_user_rule(&rule)?;
        let now = current_timestamp_iso();
        if rule.created_at.trim().is_empty() {
            rule.created_at =
                existing_rule_created_at(self, &rule.id)?.unwrap_or_else(|| now.clone());
        }
        if rule.updated_at.trim().is_empty() {
            rule.updated_at = now;
        }
        let groups_json = serde_json::to_string(&rule.groups)?;
        let action_json = serde_json::to_string(&rule.action)?;
        let rule_id = rule.id.clone();
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        tx.execute(
            r#"
            INSERT INTO rules (
                id,
                name,
                source,
                enabled,
                priority,
                weight,
                root_operator,
                groups_json,
                action_json,
                created_at,
                updated_at
            )
            VALUES (?1, ?2, 'user', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                source = 'user',
                enabled = excluded.enabled,
                priority = excluded.priority,
                weight = excluded.weight,
                root_operator = excluded.root_operator,
                groups_json = excluded.groups_json,
                action_json = excluded.action_json,
                updated_at = excluded.updated_at
            "#,
            params![
                rule.id,
                rule.name,
                bool_to_i64(rule.enabled),
                rule.priority,
                rule.weight,
                rule.root_operator.as_str(),
                groups_json,
                action_json,
                rule.created_at,
                rule.updated_at
            ],
        )?;
        bump_catalog_revision_unconditional(&tx)?;
        tx.commit()?;

        get_user_rule_by_id(self, &rule_id)
    }

    pub fn delete_user_rule(&self, id: &str) -> Result<bool, DbError> {
        let _catalog_guard = catalog_execution_guard();
        let id = id.trim();
        if id.is_empty() {
            return Ok(false);
        }

        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        let deleted = tx.execute(
            "DELETE FROM rules WHERE id = ?1 AND source = 'user'",
            params![id],
        )?;
        if deleted > 0 {
            bump_catalog_revision_unconditional(&tx)?;
        }
        tx.commit()?;
        Ok(deleted > 0)
    }

    pub fn get_rule_catalog_state(&self) -> Result<RuleCatalogStateDto, DbError> {
        let conn = self.conn()?;
        load_catalog_state(&conn)
    }

    pub fn list_user_rules_v2(&self) -> Result<Vec<UserRuleV2>, DbError> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, source, enabled, priority, weight, root_operator,
                    groups_json, action_json, created_at, updated_at,
                    ast_version, revision, origin_proposal_id
             FROM rules WHERE source = 'user'
             ORDER BY priority DESC, updated_at DESC, id",
        )?;
        let rows = stmt.query_map([], user_rule_v2_from_row)?;
        let mut rules = Vec::new();
        for row in rows {
            rules.push(rule_v2_from_sql_row(row?)?);
        }
        Ok(rules)
    }

    pub(crate) fn load_enabled_persisted_rules(&self) -> Result<Vec<Rule>, DbError> {
        let conn = self.conn()?;
        Self::load_enabled_persisted_rules_from_connection(&conn)
    }

    pub(crate) fn load_enabled_persisted_rules_from_connection(
        conn: &Connection,
    ) -> Result<Vec<Rule>, DbError> {
        let mut stmt = conn.prepare(
            "SELECT id, name, source, enabled, priority, weight, root_operator,
                    groups_json, action_json, created_at, updated_at
             FROM rules
             WHERE enabled = 1 AND source IN ('user','learned','system')
             ORDER BY priority DESC, weight DESC, updated_at DESC, id",
        )?;
        let rows = stmt.query_map([], rule_from_row)?;
        let mut rules = Vec::new();
        for row in rows {
            let rule = rule_from_sql_row(row?)?;
            validate_user_rule(&rule)?;
            rules.push(rule);
        }
        Ok(rules)
    }

    pub fn create_user_rule_v2(
        &self,
        request: CreateUserRuleV2Request,
    ) -> Result<RuleMutationResultV2, DbError> {
        let _catalog_guard = catalog_execution_guard();
        if request.version != 2 || request.request_id.trim().is_empty() {
            return Err(DbError::Validation(
                "rule_create_request_invalid".to_string(),
            ));
        }
        let canonical = canonicalize_rule_draft_v2(request.draft)?;
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        require_catalog_revision(&tx, request.expected_catalog_revision)?;
        let now = current_timestamp_iso();
        let id = format!("user-rule-{}", uuid::Uuid::new_v4());
        insert_canonical_user_rule(
            &tx,
            CanonicalUserRuleInsert {
                id: &id,
                candidate: &canonical.candidate,
                enabled: false,
                revision: 1,
                origin_proposal_id: None,
                created_at: &now,
                updated_at: &now,
            },
        )?;
        let catalog_revision = bump_catalog_revision(&tx, request.expected_catalog_revision)?;
        let rule = load_user_rule_v2(&tx, &id)?;
        tx.commit()?;
        Ok(RuleMutationResultV2 {
            rule,
            catalog_revision,
        })
    }

    pub fn update_user_rule_v2(
        &self,
        request: UpdateUserRuleV2Request,
    ) -> Result<RuleMutationResultV2, DbError> {
        let _catalog_guard = catalog_execution_guard();
        let rule_id = validate_rule_record_id(&request.rule_id)?;
        let canonical = canonicalize_rule_draft_v2(request.draft)?;
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        require_catalog_revision(&tx, request.expected_catalog_revision)?;
        let current = load_user_rule_v2(&tx, &rule_id)?;
        if current.revision != request.expected_rule_revision {
            return Err(DbError::Validation("rule_revision_conflict".to_string()));
        }
        let groups_json = serde_json::to_string(&canonical.candidate.groups)?;
        let action_json = serde_json::to_string(&canonical.candidate.action)?;
        let updated = tx.execute(
            "UPDATE rules SET name = ?2, priority = ?3, weight = ?4,
                    root_operator = ?5, groups_json = ?6, action_json = ?7,
                    ast_version = 1, revision = revision + 1, updated_at = ?8
             WHERE id = ?1 AND source = 'user' AND revision = ?9",
            params![
                rule_id,
                canonical.candidate.name,
                canonical.candidate.priority,
                canonical.candidate.weight,
                canonical.candidate.root_operator.as_str(),
                groups_json,
                action_json,
                current_timestamp_iso(),
                request.expected_rule_revision
            ],
        )?;
        if updated != 1 {
            return Err(DbError::Validation("rule_revision_conflict".to_string()));
        }
        let catalog_revision = bump_catalog_revision(&tx, request.expected_catalog_revision)?;
        let rule = load_user_rule_v2(&tx, &rule_id)?;
        tx.commit()?;
        Ok(RuleMutationResultV2 {
            rule,
            catalog_revision,
        })
    }

    pub fn set_user_rule_enabled_v2(
        &self,
        request: SetUserRuleEnabledV2Request,
    ) -> Result<RuleMutationResultV2, DbError> {
        let _catalog_guard = catalog_execution_guard();
        let rule_id = validate_rule_record_id(&request.rule_id)?;
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        require_catalog_revision(&tx, request.expected_catalog_revision)?;
        let updated = tx.execute(
            "UPDATE rules SET enabled = ?2, revision = revision + 1, updated_at = ?3
             WHERE id = ?1 AND source = 'user' AND revision = ?4",
            params![
                rule_id,
                bool_to_i64(request.enabled),
                current_timestamp_iso(),
                request.expected_rule_revision
            ],
        )?;
        if updated != 1 {
            return Err(DbError::Validation("rule_revision_conflict".to_string()));
        }
        let catalog_revision = bump_catalog_revision(&tx, request.expected_catalog_revision)?;
        let rule = load_user_rule_v2(&tx, &rule_id)?;
        tx.commit()?;
        Ok(RuleMutationResultV2 {
            rule,
            catalog_revision,
        })
    }

    pub fn delete_user_rule_v2(
        &self,
        request: DeleteUserRuleV2Request,
    ) -> Result<RuleCatalogStateDto, DbError> {
        let _catalog_guard = catalog_execution_guard();
        if !request.confirmed {
            return Err(DbError::Validation(
                "rule_delete_confirmation_required".to_string(),
            ));
        }
        let rule_id = validate_rule_record_id(&request.rule_id)?;
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        require_catalog_revision(&tx, request.expected_catalog_revision)?;
        let deleted = tx.execute(
            "DELETE FROM rules WHERE id = ?1 AND source = 'user' AND revision = ?2",
            params![rule_id, request.expected_rule_revision],
        )?;
        if deleted != 1 {
            return Err(DbError::Validation("rule_revision_conflict".to_string()));
        }
        bump_catalog_revision(&tx, request.expected_catalog_revision)?;
        let state = load_catalog_state(&tx)?;
        tx.commit()?;
        Ok(state)
    }
}

struct UserRuleV2SqlRow {
    rule: RuleSqlRow,
    ast_version: i64,
    revision: i64,
    origin_proposal_id: Option<String>,
}

pub fn canonicalize_rule_draft_v2(draft: RuleDraftV2) -> Result<CanonicalRuleResultV2, DbError> {
    let name = draft.name.trim().to_string();
    if name.is_empty() || name.chars().count() > 160 {
        return Err(DbError::Validation("rule_name_invalid".to_string()));
    }
    if !draft.priority.is_finite() || !(0.0..=1000.0).contains(&draft.priority) {
        return Err(DbError::Validation("rule_priority_invalid".to_string()));
    }
    if !draft.weight.is_finite() || !(0.0..=100.0).contains(&draft.weight) {
        return Err(DbError::Validation("rule_weight_invalid".to_string()));
    }
    let root_operator = canonical_rule_operator(&draft.root_operator)?;
    if draft.groups.is_empty() || draft.groups.len() > 32 {
        return Err(DbError::Validation("rule_group_count_invalid".to_string()));
    }
    let mut canonical_groups = Vec::<(
        RuleOperator,
        Vec<(ConditionField, ConditionOperator, Value)>,
    )>::new();
    for group in draft.groups {
        if group.conditions.is_empty() || group.conditions.len() > 32 {
            return Err(DbError::Validation(
                "rule_condition_count_invalid".to_string(),
            ));
        }
        let operator = canonical_rule_operator(&group.operator)?;
        let mut conditions = group
            .conditions
            .into_iter()
            .map(canonical_condition)
            .collect::<Result<Vec<_>, _>>()?;
        conditions.sort_by(|left, right| {
            canonical_condition_key(left).cmp(&canonical_condition_key(right))
        });
        conditions.dedup_by(|left, right| {
            canonical_condition_key(left) == canonical_condition_key(right)
        });
        canonical_groups.push((operator, conditions));
    }
    canonical_groups.sort_by_key(canonical_group_key);
    canonical_groups
        .dedup_by(|left, right| canonical_group_key(left) == canonical_group_key(right));

    let mut groups = Vec::with_capacity(canonical_groups.len());
    for (group_index, (operator, conditions)) in canonical_groups.into_iter().enumerate() {
        let group_seed = canonical_group_key(&(operator.clone(), conditions.clone()));
        let group_hash = blake3::hash(format!("{group_index}\0{group_seed}").as_bytes())
            .to_hex()
            .to_string();
        let mut canonical_conditions = Vec::with_capacity(conditions.len());
        for (condition_index, (field, operator, value)) in conditions.into_iter().enumerate() {
            let condition_seed =
                canonical_condition_key(&(field.clone(), operator.clone(), value.clone()));
            let condition_hash = blake3::hash(
                format!("{group_index}\0{condition_index}\0{condition_seed}").as_bytes(),
            )
            .to_hex()
            .to_string();
            canonical_conditions.push(RuleCondition {
                id: format!("condition-{}", &condition_hash[..16]),
                field,
                operator,
                value,
            });
        }
        groups.push(RuleConditionGroup {
            id: format!("group-{}", &group_hash[..16]),
            operator,
            conditions: canonical_conditions,
        });
    }

    let action = canonical_action(draft.action)?;
    let candidate = CanonicalRuleAstV1 {
        ast_version: RULE_AST_VERSION,
        name,
        priority: draft.priority,
        weight: draft.weight,
        root_operator,
        groups,
        action,
    };
    validate_canonical_candidate(&candidate)?;
    let fingerprint = blake3::hash(serde_json::to_string(&candidate)?.as_bytes())
        .to_hex()
        .to_string();
    Ok(CanonicalRuleResultV2 {
        candidate,
        fingerprint,
    })
}

fn canonical_rule_operator(value: &str) -> Result<RuleOperator, DbError> {
    match value.trim().to_ascii_uppercase().as_str() {
        "AND" => Ok(RuleOperator::And),
        "OR" => Ok(RuleOperator::Or),
        _ => Err(DbError::Validation("rule_operator_invalid".to_string())),
    }
}

fn canonical_condition(
    condition: RuleConditionDraftV2,
) -> Result<(ConditionField, ConditionOperator, Value), DbError> {
    let field = match condition
        .field
        .trim()
        .replace('-', "_")
        .to_ascii_lowercase()
        .as_str()
    {
        "name" => ConditionField::Name,
        "extension" => ConditionField::Extension,
        "file_type" | "filetype" => ConditionField::FileType,
        "path" => ConditionField::Path,
        "directory" => ConditionField::Directory,
        "size" => ConditionField::Size,
        "modified_at" | "modifiedat" => ConditionField::ModifiedAt,
        "is_duplicate" | "isduplicate" => ConditionField::IsDuplicate,
        "risk_level" | "risklevel" => ConditionField::RiskLevel,
        _ => return Err(DbError::Validation("rule_field_invalid".to_string())),
    };
    let compact_operator = condition
        .operator
        .trim()
        .replace(['_', '-'], "")
        .to_ascii_lowercase();
    let operator = match compact_operator.as_str() {
        "contains" => ConditionOperator::Contains,
        "equals" => ConditionOperator::Equals,
        "startswith" => ConditionOperator::StartsWith,
        "endswith" => ConditionOperator::EndsWith,
        "is" => ConditionOperator::Is,
        "greaterthan" => ConditionOperator::GreaterThan,
        "lessthan" => ConditionOperator::LessThan,
        "olderthandays" => ConditionOperator::OlderThanDays,
        "newerthandays" => ConditionOperator::NewerThanDays,
        _ => {
            return Err(DbError::Validation(
                "rule_condition_operator_invalid".to_string(),
            ))
        }
    };
    let value = canonical_condition_value(&field, condition.value)?;
    Ok((field, operator, value))
}

fn canonical_condition_value(field: &ConditionField, value: Value) -> Result<Value, DbError> {
    match field {
        ConditionField::Name | ConditionField::Path | ConditionField::Directory => {
            let text = value
                .as_str()
                .map(str::trim)
                .filter(|text| !text.is_empty() && text.chars().count() <= 1024)
                .ok_or_else(|| DbError::Validation("rule_condition_value_invalid".to_string()))?;
            Ok(Value::String(text.to_string()))
        }
        ConditionField::Extension => {
            let text = value
                .as_str()
                .map(str::trim)
                .map(|text| text.trim_start_matches('.').to_ascii_lowercase())
                .filter(|text| !text.is_empty() && text.len() <= 32)
                .ok_or_else(|| DbError::Validation("rule_extension_invalid".to_string()))?;
            Ok(Value::String(text))
        }
        ConditionField::FileType => Ok(Value::String(canonical_enum(
            value.as_str(),
            &[
                "Document",
                "Image",
                "Video",
                "Audio",
                "Code",
                "ArchivePackage",
                "Installer",
                "Spreadsheet",
                "Presentation",
                "Other",
            ],
            "rule_file_type_invalid",
        )?)),
        ConditionField::RiskLevel => Ok(Value::String(canonical_enum(
            value.as_str(),
            &["Normal", "Sensitive", "System", "Caution", "Unknown"],
            "rule_risk_level_invalid",
        )?)),
        ConditionField::Size => {
            let number = value
                .as_f64()
                .or_else(|| value.as_str().and_then(|text| text.trim().parse().ok()))
                .filter(|number| number.is_finite() && *number >= 0.0)
                .ok_or_else(|| DbError::Validation("rule_size_invalid".to_string()))?;
            Number::from_f64(number)
                .map(Value::Number)
                .ok_or_else(|| DbError::Validation("rule_size_invalid".to_string()))
        }
        ConditionField::ModifiedAt => {
            let number = value
                .as_i64()
                .or_else(|| value.as_str().and_then(|text| text.trim().parse().ok()))
                .filter(|number| *number >= 0)
                .ok_or_else(|| DbError::Validation("rule_modified_days_invalid".to_string()))?;
            Ok(Value::Number(Number::from(number)))
        }
        ConditionField::IsDuplicate => value
            .as_bool()
            .map(Value::Bool)
            .ok_or_else(|| DbError::Validation("rule_duplicate_invalid".to_string())),
        ConditionField::Unknown | ConditionField::Invalid(_) => {
            Err(DbError::Validation("rule_field_invalid".to_string()))
        }
    }
}

fn canonical_enum(value: Option<&str>, allowed: &[&str], code: &str) -> Result<String, DbError> {
    let value = value
        .map(str::trim)
        .ok_or_else(|| DbError::Validation(code.to_string()))?;
    allowed
        .iter()
        .find(|candidate| candidate.eq_ignore_ascii_case(value))
        .map(|candidate| (*candidate).to_string())
        .ok_or_else(|| DbError::Validation(code.to_string()))
}

fn canonical_action(draft: RuleActionDraftV2) -> Result<RuleAction, DbError> {
    let purpose = draft
        .purpose
        .as_deref()
        .map(|value| {
            canonical_enum(
                Some(value),
                &[
                    "Project",
                    "Teaching",
                    "Study",
                    "Work",
                    "Personal",
                    "Career",
                    "Finance",
                    "Identity",
                    "Media",
                    "Installer",
                    "Temporary",
                    "Archive",
                    "Document",
                    "Duplicate Review",
                    "Unknown",
                ],
                "rule_action_purpose_invalid",
            )
            .map(Purpose::from)
        })
        .transpose()?;
    let lifecycle = draft
        .lifecycle
        .as_deref()
        .map(|value| {
            canonical_enum(
                Some(value),
                &[
                    "Inbox",
                    "Active",
                    "Reference",
                    "Archive",
                    "Disposable",
                    "Duplicate",
                    "Sensitive",
                    "TrashReview",
                    "Unknown",
                ],
                "rule_action_lifecycle_invalid",
            )
            .map(Lifecycle::from)
        })
        .transpose()?;
    let risk_level = draft
        .risk_level
        .as_deref()
        .map(|value| {
            canonical_enum(
                Some(value),
                &["Normal", "Sensitive", "System", "Caution", "Unknown"],
                "rule_action_risk_invalid",
            )
            .map(RiskLevel::from)
        })
        .transpose()?;
    let suggested_action = draft
        .suggested_action
        .as_deref()
        .map(|value| {
            canonical_enum(
                Some(value),
                &[
                    "Keep",
                    "Rename",
                    "Move",
                    "MoveAndRename",
                    "Archive",
                    "Review",
                    "DeleteCandidate",
                ],
                "rule_action_invalid",
            )
            .map(SuggestedAction::from)
        })
        .transpose()?;
    let context = trim_optional(draft.context, 256, "rule_action_context_invalid")?;
    let target_template =
        trim_optional(draft.target_template, 1024, "rule_target_template_invalid")?;
    let rename_template =
        trim_optional(draft.rename_template, 255, "rule_rename_template_invalid")?;
    Ok(RuleAction {
        purpose,
        lifecycle,
        context,
        risk_level,
        suggested_action,
        target_template,
        rename_template,
    })
}

fn trim_optional(value: Option<String>, max: usize, code: &str) -> Result<Option<String>, DbError> {
    value
        .map(|value| {
            let value = value.trim().to_string();
            if value.is_empty() || value.chars().count() > max {
                Err(DbError::Validation(code.to_string()))
            } else {
                Ok(value)
            }
        })
        .transpose()
}

fn canonical_condition_key(condition: &(ConditionField, ConditionOperator, Value)) -> String {
    format!(
        "{}\0{}\0{}",
        condition.0.as_str(),
        condition.1.as_str(),
        serde_json::to_string(&condition.2).unwrap_or_default()
    )
}

fn canonical_group_key(
    group: &(
        RuleOperator,
        Vec<(ConditionField, ConditionOperator, Value)>,
    ),
) -> String {
    format!(
        "{}\0{}",
        group.0.as_str(),
        group
            .1
            .iter()
            .map(canonical_condition_key)
            .collect::<Vec<_>>()
            .join("\0")
    )
}

fn validate_canonical_candidate(candidate: &CanonicalRuleAstV1) -> Result<(), DbError> {
    let rule = Rule {
        id: "canonical-validation".to_string(),
        name: candidate.name.clone(),
        source: RuleSource::User,
        enabled: false,
        priority: candidate.priority,
        weight: candidate.weight,
        root_operator: candidate.root_operator.clone(),
        groups: candidate.groups.clone(),
        action: candidate.action.clone(),
        created_at: String::new(),
        updated_at: String::new(),
    };
    validate_user_rule(&rule)
}

fn validate_rule_record_id(id: &str) -> Result<String, DbError> {
    let id = id.trim();
    if id.is_empty() || id.len() > 128 || id.chars().any(char::is_control) {
        Err(DbError::Validation("rule_id_invalid".to_string()))
    } else {
        Ok(id.to_string())
    }
}

pub(crate) struct CanonicalUserRuleInsert<'a> {
    pub id: &'a str,
    pub candidate: &'a CanonicalRuleAstV1,
    pub enabled: bool,
    pub revision: i64,
    pub origin_proposal_id: Option<&'a str>,
    pub created_at: &'a str,
    pub updated_at: &'a str,
}

pub(crate) fn insert_canonical_user_rule(
    tx: &Transaction<'_>,
    input: CanonicalUserRuleInsert<'_>,
) -> Result<(), DbError> {
    let groups_json = serde_json::to_string(&input.candidate.groups)?;
    let action_json = serde_json::to_string(&input.candidate.action)?;
    tx.execute(
        "INSERT INTO rules (
            id, name, source, enabled, priority, weight, root_operator,
            groups_json, action_json, created_at, updated_at,
            ast_version, revision, origin_proposal_id
        ) VALUES (?1, ?2, 'user', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1, ?11, ?12)",
        params![
            input.id,
            input.candidate.name,
            bool_to_i64(input.enabled),
            input.candidate.priority,
            input.candidate.weight,
            input.candidate.root_operator.as_str(),
            groups_json,
            action_json,
            input.created_at,
            input.updated_at,
            input.revision,
            input.origin_proposal_id
        ],
    )?;
    Ok(())
}

pub(crate) fn require_catalog_revision(conn: &Connection, expected: i64) -> Result<(), DbError> {
    let actual = load_catalog_state(conn)?.revision;
    if actual != expected {
        Err(DbError::Validation(
            "rule_catalog_revision_conflict".to_string(),
        ))
    } else {
        Ok(())
    }
}

pub(crate) fn bump_catalog_revision(conn: &Connection, expected: i64) -> Result<i64, DbError> {
    let updated = conn.execute(
        "UPDATE rule_catalog_state SET revision = revision + 1, updated_at = ?2
         WHERE singleton_id = 1 AND revision = ?1",
        params![expected, current_unix_seconds()],
    )?;
    if updated != 1 {
        return Err(DbError::Validation(
            "rule_catalog_revision_conflict".to_string(),
        ));
    }
    Ok(expected + 1)
}

pub(crate) fn bump_catalog_revision_unconditional(conn: &Connection) -> Result<i64, DbError> {
    conn.execute(
        "UPDATE rule_catalog_state SET revision = revision + 1, updated_at = ?1
         WHERE singleton_id = 1",
        params![current_unix_seconds()],
    )?;
    load_catalog_state(conn).map(|state| state.revision)
}

fn load_catalog_state(conn: &Connection) -> Result<RuleCatalogStateDto, DbError> {
    conn.query_row(
        "SELECT revision, updated_at FROM rule_catalog_state WHERE singleton_id = 1",
        [],
        |row| {
            Ok(RuleCatalogStateDto {
                revision: row.get(0)?,
                updated_at: row.get(1)?,
            })
        },
    )
    .map_err(DbError::from)
}

pub(crate) fn load_user_rule_v2(conn: &Connection, id: &str) -> Result<UserRuleV2, DbError> {
    let row = conn
        .query_row(
            "SELECT id, name, source, enabled, priority, weight, root_operator,
                    groups_json, action_json, created_at, updated_at,
                    ast_version, revision, origin_proposal_id
             FROM rules WHERE id = ?1 AND source = 'user'",
            params![id],
            user_rule_v2_from_row,
        )
        .optional()?
        .ok_or_else(|| DbError::Validation("rule_not_found".to_string()))?;
    rule_v2_from_sql_row(row)
}

fn user_rule_v2_from_row(row: &Row<'_>) -> rusqlite::Result<UserRuleV2SqlRow> {
    Ok(UserRuleV2SqlRow {
        rule: RuleSqlRow {
            id: row.get(0)?,
            name: row.get(1)?,
            source: row.get(2)?,
            enabled: row.get::<_, i64>(3)? != 0,
            priority: row.get(4)?,
            weight: row.get(5)?,
            root_operator: row.get(6)?,
            groups_json: row.get(7)?,
            action_json: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
        },
        ast_version: row.get(11)?,
        revision: row.get(12)?,
        origin_proposal_id: row.get(13)?,
    })
}

fn rule_v2_from_sql_row(row: UserRuleV2SqlRow) -> Result<UserRuleV2, DbError> {
    Ok(UserRuleV2 {
        rule: rule_from_sql_row(row.rule)?,
        ast_version: row.ast_version,
        revision: row.revision,
        origin_proposal_id: row.origin_proposal_id,
    })
}

pub(crate) fn validate_user_rule(rule: &Rule) -> Result<(), DbError> {
    if rule.id.trim().is_empty() || rule.id.len() > 128 {
        return Err(DbError::Validation("Rule ID is required.".to_string()));
    }
    if rule.name.trim().is_empty() || rule.name.len() > 160 {
        return Err(DbError::Validation("Rule name is required.".to_string()));
    }
    if !matches!(rule.root_operator.as_str(), "AND" | "OR") {
        return Err(DbError::Validation(
            "Rule root operator is invalid.".to_string(),
        ));
    }
    if !rule.weight.is_finite() || !(0.0..=100.0).contains(&rule.weight) {
        return Err(DbError::Validation(
            "Rule weight must be between 0 and 100.".to_string(),
        ));
    }
    if !rule.priority.is_finite() || !(0.0..=1000.0).contains(&rule.priority) {
        return Err(DbError::Validation(
            "Rule priority must be between 0 and 1000.".to_string(),
        ));
    }
    if rule.groups.is_empty() {
        return Err(DbError::Validation(
            "At least one condition group is required.".to_string(),
        ));
    }
    if rule.groups.len() > 32 {
        return Err(DbError::Validation(
            "A rule cannot contain more than 32 condition groups.".to_string(),
        ));
    }

    const FIELDS: &[&str] = &[
        "name",
        "extension",
        "file_type",
        "path",
        "directory",
        "size",
        "modified_at",
        "is_duplicate",
        "risk_level",
    ];
    const TEXT_FIELDS: &[&str] = &["name", "extension", "path", "directory"];
    const TEXT_OPERATORS: &[&str] = &["contains", "equals", "startsWith", "endsWith"];
    const ENUM_OPERATORS: &[&str] = &["equals", "is"];
    const NUMBER_OPERATORS: &[&str] = &["equals", "greaterThan", "lessThan"];
    const DATE_OPERATORS: &[&str] = &["olderThanDays", "newerThanDays"];
    const FILE_TYPES: &[&str] = &[
        "Document",
        "Image",
        "Video",
        "Audio",
        "Code",
        "ArchivePackage",
        "Installer",
        "Spreadsheet",
        "Presentation",
        "Other",
    ];
    const RISK_LEVELS: &[&str] = &["Normal", "Sensitive", "System", "Caution", "Unknown"];

    for group in &rule.groups {
        if group.id.trim().is_empty() || group.id.len() > 128 || group.conditions.len() > 32 {
            return Err(DbError::Validation(
                "Rule condition group size or ID is invalid.".to_string(),
            ));
        }
        if !matches!(group.operator.as_str(), "AND" | "OR") {
            return Err(DbError::Validation(
                "Rule group operator is invalid.".to_string(),
            ));
        }
        if group.conditions.is_empty() {
            return Err(DbError::Validation(
                "Each rule group requires a condition.".to_string(),
            ));
        }
        for condition in &group.conditions {
            if condition.id.trim().is_empty() || condition.id.len() > 128 {
                return Err(DbError::Validation(
                    "Rule condition ID is invalid.".to_string(),
                ));
            }
            if !FIELDS.contains(&condition.field.as_str()) {
                return Err(DbError::Validation(
                    "Rule condition field is invalid.".to_string(),
                ));
            }
            if condition.value.is_null() {
                return Err(DbError::Validation(
                    "Rule condition value is required.".to_string(),
                ));
            }
            if condition
                .value
                .as_str()
                .is_some_and(|value| value.trim().is_empty())
            {
                return Err(DbError::Validation(
                    "Rule condition value is required.".to_string(),
                ));
            }
            if condition
                .value
                .as_str()
                .is_some_and(|value| value.len() > 1024)
            {
                return Err(DbError::Validation(
                    "Rule condition value is too long.".to_string(),
                ));
            }

            match condition.field.as_str() {
                field if TEXT_FIELDS.contains(&field) => {
                    if !TEXT_OPERATORS.contains(&condition.operator.as_str())
                        || condition.value.as_str().is_none()
                    {
                        return Err(DbError::Validation(
                            "Rule condition operator or value is invalid for its field."
                                .to_string(),
                        ));
                    }
                }
                "file_type" => {
                    if !ENUM_OPERATORS.contains(&condition.operator.as_str())
                        || !condition
                            .value
                            .as_str()
                            .is_some_and(|value| FILE_TYPES.contains(&value))
                    {
                        return Err(DbError::Validation(
                            "Rule condition operator or value is invalid for its field."
                                .to_string(),
                        ));
                    }
                }
                "risk_level" => {
                    if !ENUM_OPERATORS.contains(&condition.operator.as_str())
                        || !condition
                            .value
                            .as_str()
                            .is_some_and(|value| RISK_LEVELS.contains(&value))
                    {
                        return Err(DbError::Validation(
                            "Rule condition operator or value is invalid for its field."
                                .to_string(),
                        ));
                    }
                }
                "size" => {
                    if !NUMBER_OPERATORS.contains(&condition.operator.as_str())
                        || !non_negative_finite_number(&condition.value)
                    {
                        return Err(DbError::Validation(
                            "Rule size condition must be a finite non-negative number.".to_string(),
                        ));
                    }
                }
                "modified_at" => {
                    if !DATE_OPERATORS.contains(&condition.operator.as_str())
                        || !non_negative_integer(&condition.value)
                    {
                        return Err(DbError::Validation(
                            "Rule modified-day condition must be a non-negative integer."
                                .to_string(),
                        ));
                    }
                }
                "is_duplicate" => {
                    if !matches!(condition.operator.as_str(), "equals" | "is")
                        || !condition.value.is_boolean()
                    {
                        return Err(DbError::Validation(
                            "Rule duplicate condition must be a boolean.".to_string(),
                        ));
                    }
                }
                _ => {
                    return Err(DbError::Validation(
                        "Rule condition field is invalid.".to_string(),
                    ))
                }
            }
        }
    }

    if rule
        .action
        .purpose
        .as_ref()
        .is_some_and(Purpose::is_invalid)
    {
        return Err(DbError::Validation("Rule purpose is invalid.".to_string()));
    }
    if rule
        .action
        .lifecycle
        .as_ref()
        .is_some_and(Lifecycle::is_invalid)
    {
        return Err(DbError::Validation(
            "Rule lifecycle is invalid.".to_string(),
        ));
    }
    if rule
        .action
        .risk_level
        .as_ref()
        .is_some_and(RiskLevel::is_invalid)
    {
        return Err(DbError::Validation(
            "Rule risk level is invalid.".to_string(),
        ));
    }
    if let Some(action) = rule.action.suggested_action.as_deref() {
        if !matches!(
            action,
            "Keep" | "Rename" | "Move" | "MoveAndRename" | "Archive" | "Review" | "DeleteCandidate"
        ) {
            return Err(DbError::Validation("Rule action is invalid.".to_string()));
        }
    }
    if let Some(template) = rule.action.target_template.as_deref() {
        validate_rule_target_template(template)?;
    }
    validate_optional_rule_action_value(rule.action.purpose.as_deref(), "purpose")?;
    validate_optional_rule_action_value(rule.action.lifecycle.as_deref(), "lifecycle")?;
    validate_optional_rule_action_value(rule.action.context.as_deref(), "context")?;
    if let Some(risk_level) = rule.action.risk_level.as_deref() {
        if !matches!(
            risk_level,
            "Normal" | "Sensitive" | "System" | "Caution" | "Unknown"
        ) {
            return Err(DbError::Validation(
                "Rule risk level is invalid.".to_string(),
            ));
        }
    }
    if let Some(template) = rule.action.rename_template.as_deref() {
        let template = template.trim();
        if template.is_empty()
            || template.len() > 255
            || template.chars().any(|ch| matches!(ch, '/' | '\\' | '\0'))
            || template.chars().any(char::is_control)
        {
            return Err(DbError::Validation(
                "Rule rename template is unsafe.".to_string(),
            ));
        }
    }
    if matches!(
        rule.action.suggested_action.as_deref(),
        Some("Move" | "MoveAndRename" | "Archive")
    ) && rule
        .action
        .target_template
        .as_deref()
        .map(str::trim)
        .unwrap_or_default()
        .is_empty()
    {
        return Err(DbError::Validation(
            "Move rules require a target template.".to_string(),
        ));
    }
    Ok(())
}

fn non_negative_finite_number(value: &Value) -> bool {
    let number = value.as_f64().or_else(|| {
        value
            .as_str()
            .and_then(|text| text.trim().parse::<f64>().ok())
    });
    number.is_some_and(|number| number.is_finite() && number >= 0.0)
}

fn non_negative_integer(value: &Value) -> bool {
    let number = value
        .as_i64()
        .map(|number| number as f64)
        .or_else(|| value.as_f64())
        .or_else(|| {
            value
                .as_str()
                .and_then(|text| text.trim().parse::<f64>().ok())
        });
    number.is_some_and(|number| number.is_finite() && number >= 0.0 && number.fract() == 0.0)
}

fn validate_optional_rule_action_value(value: Option<&str>, field: &str) -> Result<(), DbError> {
    if value.is_some_and(|value| value.trim().is_empty() || value.len() > 256) {
        return Err(DbError::Validation(format!(
            "Rule action {field} is invalid."
        )));
    }
    Ok(())
}

fn validate_rule_target_template(template: &str) -> Result<(), DbError> {
    let normalized = template.trim().replace('\\', "/");
    let without_home = normalized.strip_prefix("{home}/").unwrap_or(&normalized);
    if normalized.is_empty()
        || normalized.len() > 1024
        || normalized.starts_with('/')
        || normalized.contains(':')
        || normalized.contains('\0')
        || normalized.contains('*')
        || normalized.contains('?')
        || without_home
            .split('/')
            .any(|part| part.is_empty() || part == "." || part == "..")
    {
        return Err(DbError::Validation(
            "Rule target template is unsafe.".to_string(),
        ));
    }
    Ok(())
}

fn rule_from_row(row: &Row<'_>) -> rusqlite::Result<RuleSqlRow> {
    Ok(RuleSqlRow {
        id: row.get(0)?,
        name: row.get(1)?,
        source: row.get(2)?,
        enabled: row.get::<_, i64>(3)? != 0,
        priority: row.get(4)?,
        weight: row.get(5)?,
        root_operator: row.get(6)?,
        groups_json: row.get(7)?,
        action_json: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

fn rule_from_sql_row(row: RuleSqlRow) -> Result<Rule, DbError> {
    let mut action = serde_json::from_str::<RuleAction>(&row.action_json)?;
    if action.purpose.as_ref().is_some_and(Purpose::is_invalid) {
        eprintln!(
            "migration warning: rule {} has invalid purpose; mapped to Unknown",
            row.id
        );
        action.purpose = Some(Purpose::Unknown);
    }
    if action.lifecycle.as_ref().is_some_and(Lifecycle::is_invalid) {
        eprintln!(
            "migration warning: rule {} has invalid lifecycle; mapped to Unknown",
            row.id
        );
        action.lifecycle = Some(Lifecycle::Unknown);
    }
    if action
        .risk_level
        .as_ref()
        .is_some_and(RiskLevel::is_invalid)
    {
        eprintln!(
            "migration warning: rule {} has invalid risk level; mapped to Unknown",
            row.id
        );
        action.risk_level = Some(RiskLevel::Unknown);
    }
    if action
        .suggested_action
        .as_ref()
        .is_some_and(SuggestedAction::is_invalid)
    {
        eprintln!(
            "migration warning: rule {} has invalid suggested action; mapped to Unknown",
            row.id
        );
        action.suggested_action = Some(SuggestedAction::Unknown);
    }
    Ok(Rule {
        id: row.id,
        name: row.name,
        source: row.source.into(),
        enabled: row.enabled,
        priority: row.priority,
        weight: row.weight,
        root_operator: row.root_operator.into(),
        groups: serde_json::from_str::<Vec<RuleConditionGroup>>(&row.groups_json)?,
        action,
        created_at: row.created_at,
        updated_at: row.updated_at,
    })
}

fn existing_rule_created_at(db: &Database, id: &str) -> Result<Option<String>, DbError> {
    let conn = db.conn()?;
    conn.query_row(
        "SELECT created_at FROM rules WHERE id = ?1",
        params![id],
        |row| row.get::<_, String>(0),
    )
    .optional()
    .map_err(DbError::from)
}

fn get_user_rule_by_id(db: &Database, id: &str) -> Result<Rule, DbError> {
    let conn = db.conn()?;
    let row = conn.query_row(
        r#"
        SELECT
            id,
            name,
            source,
            enabled,
            priority,
            weight,
            root_operator,
            groups_json,
            action_json,
            created_at,
            updated_at
        FROM rules
        WHERE id = ?1
          AND source = 'user'
        "#,
        params![id],
        rule_from_row,
    )?;
    rule_from_sql_row(row)
}

pub(super) fn current_timestamp_iso() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0);
    OffsetDateTime::from_unix_timestamp(seconds)
        .ok()
        .and_then(|time| time.format(&Rfc3339).ok())
        .unwrap_or_else(|| "1970-01-01T00:00:00Z".to_string())
}

#[cfg(test)]
mod v2_tests {
    use super::*;

    fn test_database() -> (Database, std::path::PathBuf) {
        let path = std::env::temp_dir().join(format!(
            "zen-canvas-rule-v2-test-{}-{}.sqlite3",
            std::process::id(),
            uuid::Uuid::new_v4()
        ));
        (Database::open(&path).expect("rule v2 database"), path)
    }

    fn draft(field: &str, operator: &str, value: Value) -> RuleDraftV2 {
        RuleDraftV2 {
            name: "  Canonical rule  ".into(),
            priority: 10.0,
            weight: 5.0,
            root_operator: "and".into(),
            groups: vec![RuleGroupDraftV2 {
                operator: "or".into(),
                conditions: vec![RuleConditionDraftV2 {
                    field: field.into(),
                    operator: operator.into(),
                    value,
                }],
            }],
            action: RuleActionDraftV2 {
                purpose: Some("work".into()),
                lifecycle: Some("reference".into()),
                ..RuleActionDraftV2::default()
            },
        }
    }

    #[test]
    fn canonical_v1_covers_every_field_operator_value_family() {
        for (field, operator, value) in [
            ("name", "contains", Value::String("report".into())),
            ("extension", "equals", Value::String(".PDF".into())),
            ("file_type", "is", Value::String("document".into())),
            ("path", "starts_with", Value::String("Projects".into())),
            ("directory", "ends-with", Value::String("Archive".into())),
            ("size", "greaterThan", Value::String("500".into())),
            ("modified_at", "older_than_days", Value::String("30".into())),
            ("is_duplicate", "equals", Value::Bool(true)),
            ("risk_level", "is", Value::String("caution".into())),
        ] {
            let canonical = canonicalize_rule_draft_v2(draft(field, operator, value))
                .unwrap_or_else(|error| panic!("{field}/{operator}: {error}"));
            assert_eq!(canonical.candidate.ast_version, 1);
            assert!(!canonical.fingerprint.is_empty());
            assert!(canonical.candidate.groups[0].id.starts_with("group-"));
            assert!(canonical.candidate.groups[0].conditions[0]
                .id
                .starts_with("condition-"));
            if field == "extension" {
                assert_eq!(
                    canonical.candidate.groups[0].conditions[0].value,
                    Value::String("pdf".into())
                );
            }
        }
    }

    #[test]
    fn canonicalization_is_deterministic_and_strict_about_unknown_fields() {
        let first =
            canonicalize_rule_draft_v2(draft("extension", "EQUALS", Value::String(".PDF".into())))
                .expect("first canonical rule");
        let second =
            canonicalize_rule_draft_v2(draft("EXTENSION", "equals", Value::String("pdf".into())))
                .expect("second canonical rule");
        assert_eq!(first.fingerprint, second.fingerprint);
        assert!(serde_json::from_str::<RuleDraftV2>(
            r#"{
                "name":"x","priority":0,"weight":0,"rootOperator":"AND",
                "groups":[],"action":{},"enabled":true
            }"#
        )
        .is_err());
        assert!(canonicalize_rule_draft_v2(draft(
            "unsupported",
            "equals",
            Value::String("x".into())
        ))
        .is_err());
    }

    #[test]
    fn repository_v2_defaults_disabled_and_uses_rule_and_catalog_cas() {
        let (db, path) = test_database();
        let created = db
            .create_user_rule_v2(CreateUserRuleV2Request {
                version: 2,
                request_id: "create-v2".into(),
                expected_catalog_revision: 1,
                draft: draft("extension", "equals", Value::String("pdf".into())),
            })
            .expect("create disabled rule");
        assert!(!created.rule.rule.enabled);
        assert_eq!(created.rule.revision, 1);
        assert_eq!(created.rule.ast_version, 1);
        assert_eq!(created.catalog_revision, 2);
        assert!(db
            .set_user_rule_enabled_v2(SetUserRuleEnabledV2Request {
                rule_id: created.rule.rule.id.clone(),
                expected_rule_revision: 1,
                expected_catalog_revision: 1,
                enabled: true,
            })
            .is_err());
        let enabled = db
            .set_user_rule_enabled_v2(SetUserRuleEnabledV2Request {
                rule_id: created.rule.rule.id.clone(),
                expected_rule_revision: 1,
                expected_catalog_revision: 2,
                enabled: true,
            })
            .expect("enable separately");
        assert!(enabled.rule.rule.enabled);
        assert_eq!(enabled.rule.revision, 2);
        assert_eq!(enabled.catalog_revision, 3);
        assert!(db
            .delete_user_rule_v2(DeleteUserRuleV2Request {
                rule_id: enabled.rule.rule.id.clone(),
                expected_rule_revision: 2,
                expected_catalog_revision: 3,
                confirmed: false,
            })
            .is_err());
        let catalog = db
            .delete_user_rule_v2(DeleteUserRuleV2Request {
                rule_id: enabled.rule.rule.id,
                expected_rule_revision: 2,
                expected_catalog_revision: 3,
                confirmed: true,
            })
            .expect("confirmed delete");
        assert_eq!(catalog.revision, 4);
        drop(db);
        let _ = std::fs::remove_file(path);
    }
}
