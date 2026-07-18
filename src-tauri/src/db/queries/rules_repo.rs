use super::super::*;
use rusqlite::{params, OptionalExtension, Row};
use serde_json::Value;
use std::time::{SystemTime, UNIX_EPOCH};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

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
        let conn = self.conn()?;
        conn.execute(
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

        get_user_rule_by_id(self, &rule_id)
    }

    pub fn delete_user_rule(&self, id: &str) -> Result<bool, DbError> {
        let id = id.trim();
        if id.is_empty() {
            return Ok(false);
        }

        let conn = self.conn()?;
        let deleted = conn.execute(
            "DELETE FROM rules WHERE id = ?1 AND source = 'user'",
            params![id],
        )?;
        Ok(deleted > 0)
    }
}

fn validate_user_rule(rule: &Rule) -> Result<(), DbError> {
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
