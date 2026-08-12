use super::*;
use serde_json::Value;

pub(super) struct CompiledPredicate {
    pub(super) sql: String,
    pub(super) params: Vec<SqlValue>,
}

pub(super) fn compile_candidate_predicate(
    candidate: &CanonicalRuleAstV1,
) -> Result<CompiledPredicate, DbError> {
    let mut params = Vec::new();
    let mut groups = Vec::new();
    for group in &candidate.groups {
        let mut conditions = Vec::new();
        for condition in &group.conditions {
            conditions.push(compile_condition(condition, &mut params)?);
        }
        let joiner = match group.operator.as_str() {
            "AND" => " AND ",
            "OR" => " OR ",
            _ => return Err(DbError::Validation("rule_operator_invalid".to_string())),
        };
        groups.push(format!("({})", conditions.join(joiner)));
    }
    let root_joiner = match candidate.root_operator.as_str() {
        "AND" => " AND ",
        "OR" => " OR ",
        _ => return Err(DbError::Validation("rule_operator_invalid".to_string())),
    };
    Ok(CompiledPredicate {
        sql: groups.join(root_joiner),
        params,
    })
}

fn compile_condition(
    condition: &RuleCondition,
    params: &mut Vec<SqlValue>,
) -> Result<String, DbError> {
    let expression = match condition.field.as_str() {
        "name" => "f.name".to_string(),
        "extension" => "CASE WHEN f.is_dir = 1 THEN 'folder' ELSE f.extension END".to_string(),
        "file_type" => "f.file_type".to_string(),
        "path" => "f.path".to_string(),
        "directory" => "substr(replace(f.path, '\\', '/'), 1,
                    max(0, length(replace(f.path, '\\', '/')) - length(f.name) - 1))"
            .to_string(),
        "size" => "f.size".to_string(),
        "modified_at" => "CAST((strftime('%s','now') - f.mtime) / 86400 AS INTEGER)".to_string(),
        "is_duplicate" => {
            "(EXISTS (SELECT 1 FROM active_duplicate_membership AS dm WHERE dm.file_id = f.id))"
                .to_string()
        }
        "risk_level" => "f.risk_level".to_string(),
        _ => return Err(DbError::Validation("rule_field_invalid".to_string())),
    };
    match condition.operator.as_str() {
        "contains" => {
            params.push(SqlValue::Text(
                condition.value.as_str().unwrap_or_default().to_lowercase(),
            ));
            Ok(format!("instr(lower({expression}), ?) > 0"))
        }
        "equals" | "is" if condition.field.as_str() == "is_duplicate" => {
            params.push(SqlValue::Integer(i64::from(
                condition.value.as_bool().unwrap_or(false),
            )));
            Ok(format!("{expression} = ?"))
        }
        "equals" if condition.field.as_str() == "size" => {
            params.push(value_to_sql(&condition.value)?);
            Ok(format!("{expression} = ?"))
        }
        "equals" | "is" => {
            params.push(value_to_sql(&condition.value)?);
            Ok(format!("lower({expression}) = lower(?)"))
        }
        "startsWith" => {
            params.push(SqlValue::Text(
                condition.value.as_str().unwrap_or_default().to_lowercase(),
            ));
            let duplicate = params.last().cloned().unwrap_or(SqlValue::Null);
            params.push(duplicate);
            Ok(format!("substr(lower({expression}), 1, length(?)) = ?"))
        }
        "endsWith" => {
            params.push(SqlValue::Text(
                condition.value.as_str().unwrap_or_default().to_lowercase(),
            ));
            let duplicate = params.last().cloned().unwrap_or(SqlValue::Null);
            params.push(duplicate);
            Ok(format!("substr(lower({expression}), -length(?)) = ?"))
        }
        "greaterThan" | "olderThanDays" => {
            params.push(value_to_sql(&condition.value)?);
            Ok(format!("{expression} > ?"))
        }
        "lessThan" | "newerThanDays" => {
            params.push(value_to_sql(&condition.value)?);
            Ok(format!("{expression} < ?"))
        }
        _ => Err(DbError::Validation(
            "rule_condition_operator_invalid".to_string(),
        )),
    }
}

fn value_to_sql(value: &Value) -> Result<SqlValue, DbError> {
    if let Some(value) = value.as_str() {
        Ok(SqlValue::Text(value.to_string()))
    } else if let Some(value) = value.as_i64() {
        Ok(SqlValue::Integer(value))
    } else if let Some(value) = value.as_f64() {
        Ok(SqlValue::Real(value))
    } else if let Some(value) = value.as_bool() {
        Ok(SqlValue::Integer(i64::from(value)))
    } else {
        Err(DbError::Validation(
            "rule_condition_value_invalid".to_string(),
        ))
    }
}

pub(super) fn candidate_is_expensive(candidate: &CanonicalRuleAstV1) -> bool {
    candidate.groups.len() > 1 && candidate.root_operator.as_str() == "OR"
        || candidate.groups.iter().any(|group| {
            (group.conditions.len() > 1 && group.operator.as_str() == "OR")
                || group.conditions.iter().any(|condition| {
                    condition.operator.as_str() == "contains" || condition.field.as_str() == "path"
                })
        })
}
