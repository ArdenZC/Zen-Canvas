use super::*;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use tauri::State;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClassificationCorrectionRequest {
    pub file_type: String,
    pub purpose: String,
    pub lifecycle: String,
    pub context: String,
    pub risk_level: String,
    pub suggested_action: String,
    pub target_template: String,
    pub suggested_name: Option<String>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct LearnedRuleHint {
    pub summary: String,
}

#[derive(Debug, Clone, Serialize)]
struct ClassificationSnapshot {
    file_id: String,
    file_name: String,
    file_path: String,
    extension: String,
    source: String,
    file_type: String,
    purpose: String,
    lifecycle: String,
    context: String,
    risk_level: String,
    suggested_action: String,
    suggested_target_path: String,
    suggested_name: String,
    confidence: f64,
    reason: String,
    keywords: Vec<String>,
    matched_rules: Vec<String>,
}

impl Database {
    pub fn confirm_classification_for_file(&self, file_id: &str) -> Result<(), DbError> {
        let row = indexed_file_by_id(self, file_id)?;
        let source = classification_source(&row.matched_rules);
        let keywords = extract_learning_keywords(&row.name, &row.path, &row.extension);
        let snapshot = ClassificationSnapshot::from_row(&row, source, keywords);
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        insert_classification_history(&tx, &snapshot, true)?;
        tx.execute(
            "UPDATE files SET matched_rules = ?2 WHERE id = ?1",
            params![
                file_id,
                append_matched_rule_marker(&row.matched_rules, "user_confirmed")?
            ],
        )?;
        if let Some(rule) = learn_rule_from_confirmed_classification(&snapshot)? {
            insert_learned_rule(&tx, &rule)?;
        }
        tx.commit()?;
        Ok(())
    }

    pub fn correct_classification_for_file(
        &self,
        file_id: &str,
        correction: ClassificationCorrectionRequest,
    ) -> Result<(), DbError> {
        let row = indexed_file_by_id(self, file_id)?;
        let correction = sanitize_correction(correction)?;
        let app_settings = crate::settings::get_app_settings(self)?;
        let suggested_target_path = build_target_path(
            &row,
            &correction.file_type,
            (!correction.target_template.is_empty()).then_some(correction.target_template.as_str()),
            &app_settings.folder_naming_language,
            &OrganizeRootConfig::from(&app_settings),
        );
        let suggested_name = correction.suggested_name.clone().unwrap_or_default();
        let reason = correction
            .reason
            .clone()
            .unwrap_or_else(|| "User corrected classification.".to_string());
        let requires_confirmation = correction.risk_level == "Sensitive"
            || correction.suggested_action == "Review"
            || correction.suggested_action == "DeleteCandidate"
            || correction.confidence() < 0.65;
        let original = ClassificationSnapshot::from_row(
            &row,
            classification_source(&row.matched_rules),
            extract_learning_keywords(&row.name, &row.path, &row.extension),
        );
        let keywords = extract_learning_keywords(&row.name, &row.path, &row.extension);
        let corrected = ClassificationSnapshot {
            file_id: row.id.clone(),
            file_name: row.name.clone(),
            file_path: row.path.clone(),
            extension: row.extension.clone(),
            source: "user_correction".to_string(),
            file_type: correction.file_type.clone(),
            purpose: correction.purpose.clone(),
            lifecycle: correction.lifecycle.clone(),
            context: correction.context.clone(),
            risk_level: correction.risk_level.clone(),
            suggested_action: correction.suggested_action.clone(),
            suggested_target_path: suggested_target_path.clone(),
            suggested_name: suggested_name.clone(),
            confidence: 1.0,
            reason: reason.clone(),
            keywords,
            matched_rules: vec!["user_correction".to_string()],
        };

        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        tx.execute(
            r#"
            UPDATE files
            SET file_type = ?2,
                purpose = ?3,
                lifecycle = ?4,
                context = ?5,
                risk_level = ?6,
                suggested_action = ?7,
                suggested_target_path = ?8,
                suggested_name = ?9,
                confidence = 1.0,
                classification_reason = ?10,
                classification_status = 'classified',
                matched_rules = ?11,
                requires_confirmation = ?12,
                last_classified_at = ?13,
                classified_rule_version = ?14,
                last_classified_mtime = ?15,
                last_classified_size = ?16
            WHERE id = ?1
            "#,
            params![
                row.id,
                correction.file_type,
                correction.purpose,
                correction.lifecycle,
                correction.context,
                correction.risk_level,
                correction.suggested_action,
                suggested_target_path,
                suggested_name,
                reason,
                serde_json::to_string(&corrected.matched_rules)?,
                bool_to_i64(requires_confirmation),
                current_unix_seconds(),
                "user_correction",
                row.mtime,
                row.size
            ],
        )?;
        insert_classification_feedback(&tx, &original, &corrected)?;
        insert_classification_history(&tx, &corrected, true)?;
        if let Some(rule) = learn_rule_from_correction(&corrected, &correction)? {
            insert_learned_rule(&tx, &rule)?;
        }
        tx.commit()?;
        Ok(())
    }

    pub fn learned_rule_hints(&self, limit: usize) -> Result<Vec<LearnedRuleHint>, DbError> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            r#"
            SELECT name, groups_json, action_json
            FROM rules
            WHERE source = 'learned'
            ORDER BY priority DESC, weight DESC, updated_at DESC
            LIMIT ?1
            "#,
        )?;
        let rows = stmt.query_map(params![limit as i64], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })?;
        let mut hints = Vec::new();
        for row in rows {
            let (name, groups_json, action_json) = row?;
            let groups = serde_json::from_str::<Vec<RuleConditionGroup>>(&groups_json)?;
            let action = serde_json::from_str::<RuleAction>(&action_json)?;
            hints.push(LearnedRuleHint {
                summary: learned_rule_summary(&name, &groups, &action),
            });
        }
        Ok(hints)
    }
}

#[tauri::command]
pub fn confirm_classification(db: State<'_, Database>, file_id: String) -> Result<(), String> {
    db.confirm_classification_for_file(&file_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn correct_classification(
    db: State<'_, Database>,
    file_id: String,
    correction: ClassificationCorrectionRequest,
) -> Result<(), String> {
    db.correct_classification_for_file(&file_id, correction)
        .map_err(|error| error.to_string())
}

impl ClassificationSnapshot {
    fn from_row(row: &IndexedFileRow, source: String, keywords: Vec<String>) -> Self {
        Self {
            file_id: row.id.clone(),
            file_name: row.name.clone(),
            file_path: row.path.clone(),
            extension: row.extension.clone(),
            source,
            file_type: row.file_type.clone(),
            purpose: row.purpose.clone(),
            lifecycle: row.lifecycle.clone(),
            context: row.context.clone(),
            risk_level: row.risk_level.clone(),
            suggested_action: row.suggested_action.clone(),
            suggested_target_path: row.suggested_target_path.clone(),
            suggested_name: row.suggested_name.clone(),
            confidence: row.confidence,
            reason: row.classification_reason.clone(),
            keywords,
            matched_rules: serde_json::from_str::<Vec<String>>(&row.matched_rules)
                .unwrap_or_default(),
        }
    }
}

impl ClassificationCorrectionRequest {
    fn confidence(&self) -> f64 {
        1.0
    }
}

fn learn_rule_from_confirmed_classification(
    snapshot: &ClassificationSnapshot,
) -> Result<Option<Rule>, DbError> {
    learned_rule_from_snapshot(snapshot, None)
}

fn learn_rule_from_correction(
    snapshot: &ClassificationSnapshot,
    correction: &ClassificationCorrectionRequest,
) -> Result<Option<Rule>, DbError> {
    learned_rule_from_snapshot(snapshot, Some(correction.target_template.as_str()))
}

pub(crate) fn extract_learning_keywords(name: &str, path: &str, extension: &str) -> Vec<String> {
    if is_dangerous_learning_path(path) {
        return Vec::new();
    }
    let mut keywords = Vec::new();
    for token in tokenize_learning_text(name) {
        push_learning_keyword(&mut keywords, token);
    }
    for parent in parent_segments(path).into_iter().rev().take(2) {
        for token in tokenize_learning_text(&parent) {
            push_learning_keyword(&mut keywords, token);
        }
    }
    let extension = extension
        .trim()
        .trim_start_matches('.')
        .to_ascii_lowercase();
    if !extension.is_empty() && !COMMON_LEARNING_WORDS.contains(&extension.as_str()) {
        push_learning_keyword(&mut keywords, format!("ext:{extension}"));
    }
    keywords.truncate(8);
    keywords
}

fn learned_rule_from_snapshot(
    snapshot: &ClassificationSnapshot,
    target_template: Option<&str>,
) -> Result<Option<Rule>, DbError> {
    let keywords = extract_learning_keywords(
        &snapshot.file_name,
        &snapshot.file_path,
        &snapshot.extension,
    );
    if keywords.is_empty() {
        return Ok(None);
    }
    let mut groups = Vec::new();
    for keyword in &keywords {
        let (field, operator, value) = if let Some(extension) = keyword.strip_prefix("ext:") {
            ("extension", "equals", Value::String(extension.to_string()))
        } else if parent_segments(&snapshot.file_path)
            .iter()
            .any(|parent| parent.eq_ignore_ascii_case(keyword))
        {
            ("path", "contains", Value::String(keyword.clone()))
        } else {
            ("name", "contains", Value::String(keyword.clone()))
        };
        groups.push(RuleConditionGroup {
            id: format!("learned_group_{}", stable_id(keyword)),
            operator: "AND".into(),
            conditions: vec![RuleCondition {
                id: format!("learned_condition_{}", stable_id(keyword)),
                field: field.into(),
                operator: operator.into(),
                value,
            }],
        });
    }

    let now = current_rule_timestamp();
    let action = RuleAction {
        purpose: Some(snapshot.purpose.clone().into()),
        lifecycle: Some(snapshot.lifecycle.clone().into()),
        context: (!snapshot.context.trim().is_empty()).then(|| snapshot.context.clone()),
        risk_level: Some(snapshot.risk_level.clone().into()),
        suggested_action: Some(snapshot.suggested_action.clone().into()),
        target_template: target_template
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToString::to_string),
        rename_template: (!snapshot.suggested_name.trim().is_empty())
            .then(|| snapshot.suggested_name.clone()),
    };
    Ok(Some(Rule {
        id: format!(
            "learned_{}",
            stable_id(&format!("{}:{}", snapshot.file_id, keywords.join("|")))
        ),
        name: format!("learned: {}", keywords.join(", ")),
        source: "learned".into(),
        enabled: false,
        priority: 88.0,
        weight: 85.0,
        root_operator: "OR".into(),
        groups,
        action,
        created_at: now.clone(),
        updated_at: now,
    }))
}

fn indexed_file_by_id(db: &Database, file_id: &str) -> Result<IndexedFileRow, DbError> {
    let conn = db.conn()?;
    conn.query_row(
        r#"
        SELECT f.id, f.path, f.name, f.extension, f.size,
               f.mtime, f.ctime, f.is_dir, f.state_code,
               f.file_type, f.purpose, f.lifecycle, f.context,
               f.risk_level, f.suggested_action, f.suggested_target_path,
               f.suggested_name, f.confidence, f.classification_reason,
               f.classification_status, f.matched_rules, f.requires_confirmation,
               f.content_hash, 0 AS is_duplicate, f.is_stale, f.last_seen_at,
               f.last_classified_at, f.classified_rule_version,
               f.last_classified_mtime, f.last_classified_size
        FROM files AS f
        WHERE f.id = ?1
        "#,
        params![file_id.trim()],
        indexed_file_from_row,
    )
    .map_err(DbError::from)
}

fn insert_classification_history(
    conn: &rusqlite::Transaction<'_>,
    snapshot: &ClassificationSnapshot,
    user_confirmed: bool,
) -> Result<(), DbError> {
    conn.execute(
        r#"
        INSERT INTO classification_history (
            id, file_id, file_name, file_path, extension, source, file_type,
            purpose, lifecycle, context, risk_level, suggested_action,
            suggested_target_path, suggested_name, confidence, reason,
            keywords_json, user_confirmed, created_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)
        "#,
        params![
            new_learning_id("classification-history", &snapshot.file_id),
            snapshot.file_id,
            snapshot.file_name,
            snapshot.file_path,
            snapshot.extension,
            snapshot.source,
            snapshot.file_type,
            snapshot.purpose,
            snapshot.lifecycle,
            snapshot.context,
            snapshot.risk_level,
            snapshot.suggested_action,
            snapshot.suggested_target_path,
            snapshot.suggested_name,
            snapshot.confidence,
            snapshot.reason,
            serde_json::to_string(&snapshot.keywords)?,
            bool_to_i64(user_confirmed),
            current_unix_seconds()
        ],
    )?;
    Ok(())
}

fn insert_classification_feedback(
    conn: &rusqlite::Transaction<'_>,
    original: &ClassificationSnapshot,
    corrected: &ClassificationSnapshot,
) -> Result<(), DbError> {
    conn.execute(
        r#"
        INSERT INTO classification_feedback (
            id, file_id, file_name, original_json, corrected_json, created_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        "#,
        params![
            new_learning_id("classification-feedback", &original.file_id),
            original.file_id,
            original.file_name,
            serde_json::to_string(original)?,
            serde_json::to_string(corrected)?,
            current_unix_seconds()
        ],
    )?;
    Ok(())
}

fn insert_learned_rule(conn: &rusqlite::Transaction<'_>, rule: &Rule) -> Result<(), DbError> {
    conn.execute(
        r#"
        INSERT INTO rules (
            id, name, source, enabled, priority, weight, root_operator,
            groups_json, action_json, created_at, updated_at
        )
        VALUES (?1, ?2, 'learned', 1, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            source = 'learned',
            enabled = 1,
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
            rule.priority,
            rule.weight,
            rule.root_operator.as_str(),
            serde_json::to_string(&rule.groups)?,
            serde_json::to_string(&rule.action)?,
            rule.created_at,
            rule.updated_at
        ],
    )?;
    Ok(())
}

fn sanitize_correction(
    mut correction: ClassificationCorrectionRequest,
) -> Result<ClassificationCorrectionRequest, DbError> {
    correction.file_type = require_allowed("fileType", &correction.file_type, FILE_TYPES)?;
    correction.purpose = require_allowed("purpose", &correction.purpose, PURPOSES)?;
    correction.lifecycle = require_allowed("lifecycle", &correction.lifecycle, LIFECYCLES)?;
    correction.risk_level = require_allowed("riskLevel", &correction.risk_level, RISK_LEVELS)?;
    correction.suggested_action = require_allowed(
        "suggestedAction",
        &correction.suggested_action,
        SUGGESTED_ACTIONS,
    )?;
    correction.context = correction.context.trim().chars().take(120).collect();
    correction.target_template = sanitize_target_template(&correction.target_template)?;
    correction.suggested_name = correction
        .suggested_name
        .as_deref()
        .map(sanitize_suggested_name)
        .filter(|value| !value.is_empty());
    correction.reason = correction
        .reason
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.chars().take(500).collect());
    if correction.risk_level == "Sensitive" && correction.suggested_action != "Keep" {
        correction.suggested_action = "Review".to_string();
    }
    if correction.suggested_action == "DeleteCandidate" {
        correction.suggested_action = "Review".to_string();
    }
    Ok(correction)
}

fn require_allowed(field: &str, value: &str, allowed: &[&str]) -> Result<String, DbError> {
    let trimmed = value.trim();
    allowed
        .iter()
        .find(|item| **item == trimmed)
        .map(|item| (*item).to_string())
        .ok_or_else(|| DbError::Validation(format!("{field} has unsupported value.")))
}

fn sanitize_target_template(value: &str) -> Result<String, DbError> {
    let template = value.trim().replace('\\', "/");
    if template.is_empty() {
        return Ok(String::new());
    }
    if template.starts_with('/') || template.starts_with("//") {
        return Err(DbError::Validation(
            "targetTemplate must be a relative path template.".to_string(),
        ));
    }
    if template.len() >= 2 && template.as_bytes().get(1) == Some(&b':') {
        return Err(DbError::Validation(
            "targetTemplate must not contain a Windows drive prefix.".to_string(),
        ));
    }
    if template.contains('\0') {
        return Err(DbError::Validation(
            "targetTemplate must not contain NUL.".to_string(),
        ));
    }
    if template
        .split('/')
        .any(|segment| segment == ".." || segment.trim().is_empty())
    {
        return Err(DbError::Validation(
            "targetTemplate must not contain empty or parent segments.".to_string(),
        ));
    }
    if template
        .chars()
        .any(|ch| matches!(ch, '*' | '?' | '<' | '>' | '|' | '"' | ':'))
    {
        return Err(DbError::Validation(
            "targetTemplate contains unsafe characters.".to_string(),
        ));
    }
    Ok(template)
}

fn sanitize_suggested_name(value: &str) -> String {
    value
        .trim()
        .chars()
        .map(|ch| {
            if matches!(ch, '/' | '\\' | '\0' | '*' | '?' | '<' | '>' | '|' | '"') {
                '_'
            } else {
                ch
            }
        })
        .collect::<String>()
        .trim()
        .trim_matches('.')
        .to_string()
}

fn classification_source(matched_rules_json: &str) -> String {
    let rules = serde_json::from_str::<Vec<String>>(matched_rules_json).unwrap_or_default();
    if rules.iter().any(|rule| rule == "user_correction") {
        "user_correction".to_string()
    } else if rules.iter().any(|rule| rule == "user_confirmed") {
        "user_confirmed".to_string()
    } else if rules.iter().any(|rule| rule.starts_with("ai:")) {
        "ai".to_string()
    } else if rules
        .iter()
        .any(|rule| rule.starts_with("learned:") || rule.starts_with("learned"))
    {
        "learned".to_string()
    } else if rules.iter().any(|rule| rule.contains("system")) {
        "system".to_string()
    } else {
        "user".to_string()
    }
}

fn append_matched_rule_marker(
    matched_rules_json: &str,
    marker: &str,
) -> Result<String, serde_json::Error> {
    let mut rules = serde_json::from_str::<Vec<String>>(matched_rules_json).unwrap_or_default();
    if !rules.iter().any(|rule| rule == marker) {
        rules.push(marker.to_string());
    }
    serde_json::to_string(&rules)
}

fn tokenize_learning_text(value: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut ascii = String::new();
    let mut chinese = String::new();
    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() {
            if !chinese.is_empty() {
                tokens.push(std::mem::take(&mut chinese));
            }
            ascii.push(ch.to_ascii_lowercase());
        } else if is_cjk(ch) {
            if !ascii.is_empty() {
                tokens.push(std::mem::take(&mut ascii));
            }
            chinese.push(ch);
        } else {
            if !ascii.is_empty() {
                tokens.push(std::mem::take(&mut ascii));
            }
            if !chinese.is_empty() {
                tokens.push(std::mem::take(&mut chinese));
            }
        }
    }
    if !ascii.is_empty() {
        tokens.push(ascii);
    }
    if !chinese.is_empty() {
        tokens.push(chinese);
    }
    tokens
}

fn push_learning_keyword(keywords: &mut Vec<String>, token: String) {
    let token = token.trim().trim_matches('.').to_string();
    if token.is_empty() || keywords.iter().any(|existing| existing == &token) {
        return;
    }
    let normalized = token.to_ascii_lowercase();
    if COMMON_LEARNING_WORDS.contains(&normalized.as_str()) {
        return;
    }
    if normalized.chars().all(|ch| ch.is_ascii_digit()) && normalized.chars().count() < 4 {
        return;
    }
    if token.starts_with("ext:") {
        keywords.push(token);
        return;
    }
    let char_count = token.chars().count();
    if char_count < 2 {
        return;
    }
    keywords.push(token);
}

fn parent_segments(path: &str) -> Vec<String> {
    let normalized = path.replace('\\', "/");
    let mut parts = normalized
        .split('/')
        .filter(|part| !part.trim().is_empty())
        .map(ToString::to_string)
        .collect::<Vec<_>>();
    if !parts.is_empty() {
        parts.pop();
    }
    parts
}

fn is_dangerous_learning_path(path: &str) -> bool {
    let lower = path.replace('\\', "/").to_ascii_lowercase();
    lower.contains("/windows/")
        || lower.ends_with("/windows")
        || lower.contains("/program files/")
        || lower.contains("/program files (x86)/")
        || lower.contains("/programdata/")
        || lower.contains("/system volume information/")
        || matches!(
            lower.as_str(),
            "/" | "/system"
                | "/usr"
                | "/etc"
                | "/var"
                | "/bin"
                | "/sbin"
                | "/library"
                | "/applications"
                | "/private"
        )
        || [
            "/system/",
            "/usr/",
            "/etc/",
            "/var/",
            "/bin/",
            "/sbin/",
            "/library/",
            "/applications/",
            "/private/",
        ]
        .iter()
        .any(|prefix| lower.starts_with(prefix))
}

fn is_cjk(ch: char) -> bool {
    ('\u{4e00}'..='\u{9fff}').contains(&ch)
}

fn stable_id(value: &str) -> String {
    let digest = Sha256::digest(value.as_bytes());
    digest
        .iter()
        .take(8)
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn new_learning_id(prefix: &str, _file_id: &str) -> String {
    crate::ids::new_job_id(prefix)
}

fn current_rule_timestamp() -> String {
    current_unix_seconds().to_string()
}

fn learned_rule_summary(name: &str, groups: &[RuleConditionGroup], action: &RuleAction) -> String {
    let patterns = groups
        .iter()
        .filter_map(|group| group.conditions.first())
        .filter_map(condition_summary)
        .take(3)
        .collect::<Vec<_>>();
    let target = [
        action.purpose.as_deref(),
        action.context.as_deref(),
        action.lifecycle.as_deref(),
    ]
    .into_iter()
    .flatten()
    .filter(|value| !value.trim().is_empty())
    .collect::<Vec<_>>()
    .join(" / ");
    if patterns.is_empty() || target.is_empty() {
        name.to_string()
    } else {
        format!("包含 {} 的文件通常归类为 {}", patterns.join("、"), target)
    }
}

fn condition_summary(condition: &RuleCondition) -> Option<String> {
    match (
        &condition.field[..],
        &condition.operator[..],
        &condition.value,
    ) {
        ("name" | "path", "contains", Value::String(value)) => Some(format!("\"{value}\"")),
        ("extension", "equals", Value::String(value)) => Some(format!(".{value}")),
        _ => None,
    }
}

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
const PURPOSES: &[&str] = &[
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
    "Unknown",
];
const LIFECYCLES: &[&str] = &[
    "Inbox",
    "Active",
    "Reference",
    "Archive",
    "Disposable",
    "Duplicate",
    "Sensitive",
];
const RISK_LEVELS: &[&str] = &["Normal", "Sensitive", "System", "Unknown"];
const SUGGESTED_ACTIONS: &[&str] = &[
    "Keep",
    "Rename",
    "Move",
    "MoveAndRename",
    "Archive",
    "Review",
    "DeleteCandidate",
];
const COMMON_LEARNING_WORDS: &[&str] = &[
    "final", "copy", "new", "temp", "tmp", "old", "backup", "draft", "文件", "资料", "文档",
    "新建", "副本", "最终", "临时",
];

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use std::{
        path::{Path, PathBuf},
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn confirm_writes_history_and_learned_rule() {
        let db = test_db();
        insert_learning_file(&db, "file-1", "/tmp/Scala/Scala试卷.pdf");
        db.confirm_classification_for_file("file-1")
            .expect("confirm classification");
        let conn = Connection::open(db.path()).expect("open db");

        assert_eq!(row_count(&conn, "classification_history"), 1);
        let confirmed: i64 = conn
            .query_row(
                "SELECT user_confirmed FROM classification_history",
                [],
                |row| row.get(0),
            )
            .expect("confirmed");
        let source: String = conn
            .query_row(
                "SELECT source FROM rules WHERE source = 'learned'",
                [],
                |row| row.get(0),
            )
            .expect("learned source");
        let matched_rules: String = conn
            .query_row(
                "SELECT matched_rules FROM files WHERE id = 'file-1'",
                [],
                |row| row.get(0),
            )
            .expect("matched rules");
        assert_eq!(confirmed, 1);
        assert_eq!(source, "learned");
        assert!(matched_rules.contains("user_confirmed"));
    }

    #[test]
    fn correction_writes_feedback_history_and_updates_file() {
        let db = test_db();
        insert_learning_file(&db, "file-1", "/tmp/Scala/Scala试卷.pdf");
        db.correct_classification_for_file("file-1", valid_correction())
            .expect("correct classification");
        let conn = Connection::open(db.path()).expect("open db");

        assert_eq!(row_count(&conn, "classification_feedback"), 1);
        assert_eq!(row_count(&conn, "classification_history"), 1);
        let row: (String, String, String) = conn
            .query_row(
                "SELECT purpose, lifecycle, matched_rules FROM files WHERE id = 'file-1'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("file row");
        assert_eq!(row.0, "Teaching");
        assert_eq!(row.1, "Active");
        assert!(row.2.contains("user_correction"));
    }

    #[test]
    fn learned_rule_does_not_override_system_sensitive_rule() {
        let db = test_db();
        insert_learning_file(&db, "file-1", "/tmp/Scala/Scala讲义.pdf");
        db.correct_classification_for_file("file-1", valid_correction())
            .expect("learn normal rule");
        let learned = db.learned_rule_hints(20).expect("learned hints");
        assert!(!learned.is_empty());

        insert_learning_file(&db, "file-2", "/tmp/Scala/passport Scala.pdf");
        db.execute_rules_for_paths(&["/tmp/Scala/passport Scala.pdf".to_string()], Vec::new())
            .expect("execute rules");
        let conn = Connection::open(db.path()).expect("open db");
        let risk: String = conn
            .query_row(
                "SELECT risk_level FROM files WHERE id = 'file-2'",
                [],
                |row| row.get(0),
            )
            .expect("risk");
        assert_eq!(risk, "Sensitive");
    }

    #[test]
    fn learned_rule_hints_include_user_habit_for_ai_prompt() {
        let db = test_db();
        insert_learning_file(&db, "file-1", "/tmp/Scala/Scala试卷.pdf");
        db.correct_classification_for_file("file-1", valid_correction())
            .expect("correct classification");
        let hints = db.learned_rule_hints(20).expect("hints");
        assert!(hints.iter().any(|hint| hint.summary.contains("Scala")));
        assert!(hints.iter().any(|hint| hint.summary.contains("Teaching")));
    }

    #[test]
    fn invalid_correction_enum_is_rejected() {
        let mut correction = valid_correction();
        correction.file_type = "BadType".to_string();
        assert!(sanitize_correction(correction).is_err());
    }

    #[test]
    fn absolute_target_template_is_rejected() {
        let mut correction = valid_correction();
        correction.target_template = "C:/Users/Zen/Documents".to_string();
        assert!(sanitize_correction(correction).is_err());
    }

    #[test]
    fn parent_target_template_is_rejected() {
        let mut correction = valid_correction();
        correction.target_template = "Teaching/../Secrets".to_string();
        assert!(sanitize_correction(correction).is_err());
    }

    fn valid_correction() -> ClassificationCorrectionRequest {
        ClassificationCorrectionRequest {
            file_type: "Document".to_string(),
            purpose: "Teaching".to_string(),
            lifecycle: "Active".to_string(),
            context: "Scala".to_string(),
            risk_level: "Normal".to_string(),
            suggested_action: "Move".to_string(),
            target_template: "Teaching/Scala".to_string(),
            suggested_name: None,
            reason: Some("User correction.".to_string()),
        }
    }

    fn test_db() -> Database {
        Database::open(test_db_path()).expect("open test database")
    }

    fn insert_learning_file(db: &Database, id: &str, path: &str) {
        let name = Path::new(path)
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or(path)
            .to_string();
        let extension = Path::new(path)
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_string();
        db.insert_file(InsertFileRequest {
            id: id.to_string(),
            path: path.to_string(),
            name,
            extension,
            size: 2048,
            mtime: 1_700_000_000,
            ctime: 1_700_000_000,
            is_dir: false,
            state_code: 0,
        })
        .expect("insert file");
    }

    fn test_db_path() -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        std::env::temp_dir().join(format!("zen-canvas-learning-test-{nonce}.sqlite3"))
    }

    fn row_count(conn: &rusqlite::Connection, table: &str) -> i64 {
        conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
            row.get(0)
        })
        .expect("count table")
    }
}
