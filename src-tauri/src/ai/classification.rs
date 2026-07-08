use std::collections::{HashMap, HashSet};

use rusqlite::{params, params_from_iter, types::Value as SqlValue};
use serde::{Deserialize, Serialize};
use tauri::State;

use super::{
    ollama::OllamaProvider,
    openai_compatible::OpenAICompatibleProvider,
    prompts::{
        ai_file_classification_system_prompt,
        build_ai_classification_prompt as build_ai_classification_prompt_body,
    },
    provider::AIProvider,
    schema::{AIChatMessage, AIChatRequest, AIProviderKind, AIProviderPresetId},
    settings::{get_ai_settings_for_db, normalize_ai_settings, AISettings},
};
use crate::{
    db::{
        bool_to_i64, build_target_path, current_unix_seconds, indexed_file_from_row,
        parent_directory, scoped_files_sql, unix_seconds_to_iso, Database, DbError, IndexedFileRow,
        LibraryScope, OrganizeRootConfig, RuleExecutionSummary,
    },
    settings::get_app_settings,
};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIClassificationOptions {
    pub only_unclassified: Option<bool>,
    pub only_low_confidence: Option<bool>,
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AIClassificationInputFile {
    pub id: String,
    pub name: String,
    pub extension: String,
    pub path: Option<String>,
    pub parent: Option<String>,
    pub size: i64,
    pub modified_at: String,
    pub is_dir: bool,
    pub existing_file_type: String,
    pub existing_purpose: String,
    pub existing_lifecycle: String,
    pub existing_risk_level: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIClassificationOutput {
    pub id: String,
    pub file_type: String,
    pub purpose: String,
    pub lifecycle: String,
    pub context: String,
    pub risk_level: String,
    pub suggested_action: String,
    pub target_template: String,
    pub suggested_name: Option<String>,
    pub confidence: f64,
    pub reason: String,
    pub keywords: Vec<String>,
    pub requires_confirmation: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AIClassificationResponse {
    classifications: Vec<AIClassificationOutput>,
}

#[derive(Debug, Clone)]
pub(crate) struct SanitizedAIClassification {
    id: String,
    file_type: String,
    purpose: String,
    lifecycle: String,
    context: String,
    risk_level: String,
    suggested_action: String,
    target_template: String,
    suggested_name: String,
    confidence: f64,
    reason: String,
    keywords: Vec<String>,
    requires_confirmation: bool,
}

pub async fn classify_files_with_ai_for_db(
    db: Database,
    scope: LibraryScope,
    options: Option<AIClassificationOptions>,
) -> Result<RuleExecutionSummary, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let settings = normalize_ai_settings(get_ai_settings_for_db(&db).map_err(string_error)?);
        let targets = collect_ai_classification_targets(&db, &scope, options.as_ref(), &settings)
            .map_err(string_error)?;
        classify_ai_targets_with_configured_provider(&db, targets, &settings)
    })
    .await
    .map_err(|error| error.to_string())?
}

pub async fn classify_selected_files_with_ai_for_db(
    db: Database,
    file_ids: Vec<String>,
) -> Result<RuleExecutionSummary, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let settings = normalize_ai_settings(get_ai_settings_for_db(&db).map_err(string_error)?);
        let targets =
            collect_selected_ai_classification_targets(&db, &file_ids).map_err(string_error)?;
        classify_ai_targets_with_configured_provider(&db, targets, &settings)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn classify_files_with_ai(
    db: State<'_, Database>,
    scope: LibraryScope,
    options: Option<AIClassificationOptions>,
) -> Result<RuleExecutionSummary, String> {
    classify_files_with_ai_for_db(db.inner().clone(), scope, options).await
}

#[tauri::command]
pub async fn classify_selected_files_with_ai(
    db: State<'_, Database>,
    file_ids: Vec<String>,
) -> Result<RuleExecutionSummary, String> {
    classify_selected_files_with_ai_for_db(db.inner().clone(), file_ids).await
}

pub(crate) fn collect_ai_classification_targets(
    db: &Database,
    scope: &LibraryScope,
    options: Option<&AIClassificationOptions>,
    settings: &AISettings,
) -> Result<Vec<IndexedFileRow>, DbError> {
    let limit = options
        .and_then(|options| options.limit)
        .unwrap_or(settings.batch_size as u32)
        .clamp(1, 1000);
    let only_unclassified = options
        .and_then(|options| options.only_unclassified)
        .unwrap_or(true);
    let only_low_confidence = options
        .and_then(|options| options.only_low_confidence)
        .unwrap_or(false);
    let mut filters = Vec::new();
    if only_unclassified {
        filters.push("f.classification_status <> 'classified'");
    }
    if only_low_confidence {
        filters.push("f.confidence < 0.65");
    }
    let where_clause = if filters.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", filters.join(" AND "))
    };
    let scoped = scoped_files_sql(Some(scope));
    let sql = format!(
        r#"
        WITH {}
        {}
        FROM scoped_files AS f
        {}
        ORDER BY f.mtime DESC, f.name COLLATE NOCASE ASC
        LIMIT ?
        "#,
        scoped.cte,
        select_indexed_file_columns("f"),
        where_clause
    );
    let mut params = scoped.params;
    params.push(SqlValue::Integer(i64::from(limit)));
    query_indexed_file_rows(db, &sql, params)
}

pub(crate) fn collect_selected_ai_classification_targets(
    db: &Database,
    file_ids: &[String],
) -> Result<Vec<IndexedFileRow>, DbError> {
    let mut ids = Vec::new();
    for id in file_ids
        .iter()
        .map(|id| id.trim())
        .filter(|id| !id.is_empty())
    {
        if !ids.iter().any(|existing| existing == id) {
            ids.push(id.to_string());
        }
        if ids.len() >= 500 {
            break;
        }
    }
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let placeholders = std::iter::repeat("?")
        .take(ids.len())
        .collect::<Vec<_>>()
        .join(", ");
    let sql = format!(
        r#"
        {}
        FROM files AS f
        WHERE f.is_stale = 0
          AND f.id IN ({placeholders})
        ORDER BY f.mtime DESC, f.name COLLATE NOCASE ASC
        "#,
        select_indexed_file_columns("f")
    );
    let params = ids.into_iter().map(SqlValue::Text).collect::<Vec<_>>();
    query_indexed_file_rows(db, &sql, params)
}

pub(crate) fn build_ai_classification_prompt(
    targets: &[IndexedFileRow],
    settings: &AISettings,
    learned_rules: &[String],
) -> Result<Vec<AIChatMessage>, String> {
    let files = targets
        .iter()
        .map(|row| ai_input_file_from_row(row, settings))
        .collect::<Vec<_>>();
    let user_prompt = build_ai_classification_prompt_body(&files, learned_rules)?;
    Ok(vec![
        AIChatMessage {
            role: "system".to_string(),
            content: ai_file_classification_system_prompt(settings.enable_thinking),
        },
        AIChatMessage {
            role: "user".to_string(),
            content: user_prompt,
        },
    ])
}

pub(crate) fn call_ai_classification_provider(
    provider: &dyn AIProvider,
    settings: &AISettings,
    targets: &[IndexedFileRow],
    learned_rules: &[String],
) -> Result<String, String> {
    let messages = build_ai_classification_prompt(targets, settings, learned_rules)?;
    provider
        .chat_json(AIChatRequest {
            messages,
            model: settings.model.clone(),
            temperature: settings.temperature,
            max_tokens: settings.max_tokens,
            force_json: settings.force_json_output,
            provider_options: Default::default(),
        })
        .map_err(|error| sanitize_ai_error(error.to_string(), &settings.api_key))
}

pub(crate) fn parse_ai_classification_response(
    content: &str,
) -> Result<Vec<AIClassificationOutput>, String> {
    match serde_json::from_str::<AIClassificationResponse>(content) {
        Ok(response) => return Ok(response.classifications),
        Err(first_error) => {
            let Some(object) = extract_first_json_object(content) else {
                return Err(format!(
                    "AI classification response is not valid JSON: {first_error}"
                ));
            };
            serde_json::from_str::<AIClassificationResponse>(&object)
                .map(|response| response.classifications)
                .map_err(|error| {
                    format!(
                        "AI classification response JSON did not match expected schema: {error}"
                    )
                })
        }
    }
}

pub(crate) fn sanitize_ai_classification_result(
    output: AIClassificationOutput,
    requested_ids: &HashSet<String>,
) -> Result<SanitizedAIClassification, String> {
    let id = output.id.trim().to_string();
    if !requested_ids.contains(&id) {
        return Err("AI classification id was not part of the request.".to_string());
    }
    let file_type = require_allowed("fileType", &output.file_type, FILE_TYPES)?;
    let purpose = require_allowed("purpose", &output.purpose, PURPOSES)?;
    let lifecycle = require_allowed("lifecycle", &output.lifecycle, LIFECYCLES)?;
    let risk_level = require_allowed("riskLevel", &output.risk_level, RISK_LEVELS)?;
    let mut suggested_action = require_allowed(
        "suggestedAction",
        &output.suggested_action,
        SUGGESTED_ACTIONS,
    )?;
    let target_template = sanitize_target_template(&output.target_template)?;
    let suggested_name = sanitize_suggested_name(output.suggested_name.as_deref());
    let confidence = output.confidence.clamp(0.0, 1.0);
    let mut requires_confirmation = output.requires_confirmation;

    if risk_level == "Sensitive" {
        suggested_action = "Review".to_string();
        requires_confirmation = true;
    }
    if suggested_action == "DeleteCandidate" {
        suggested_action = "Review".to_string();
    }
    if confidence < 0.65 {
        requires_confirmation = true;
    }
    if target_template.is_empty()
        && matches!(
            suggested_action.as_str(),
            "Move" | "MoveAndRename" | "Archive"
        )
    {
        suggested_action = "Review".to_string();
        requires_confirmation = true;
    }

    Ok(SanitizedAIClassification {
        id,
        file_type,
        purpose,
        lifecycle,
        context: output.context.trim().chars().take(120).collect(),
        risk_level,
        suggested_action,
        target_template,
        suggested_name,
        confidence,
        reason: output.reason.trim().chars().take(500).collect(),
        keywords: output
            .keywords
            .into_iter()
            .map(|keyword| keyword.trim().chars().take(40).collect::<String>())
            .filter(|keyword| !keyword.is_empty())
            .take(12)
            .collect(),
        requires_confirmation,
    })
}

pub(crate) fn apply_ai_classification_results(
    db: &Database,
    targets: &[IndexedFileRow],
    results: &[SanitizedAIClassification],
    settings: &AISettings,
) -> Result<RuleExecutionSummary, DbError> {
    if results.is_empty() {
        return Ok(RuleExecutionSummary {
            scanned: targets.len() as i64,
            updated: 0,
            skipped: targets.len() as i64,
            needs_confirmation: 0,
        });
    }
    let app_settings = get_app_settings(db)?;
    let organize_root = OrganizeRootConfig::from(&app_settings);
    let rows_by_id = targets
        .iter()
        .map(|row| (row.id.as_str(), row))
        .collect::<HashMap<_, _>>();
    let matched_rules =
        serde_json::to_string(&vec![ai_matched_rule(settings)]).map_err(DbError::from)?;
    let classified_rule_version = ai_classified_rule_version(settings);
    let classified_at = current_unix_seconds();
    let mut conn = db.conn()?;
    let tx = conn.transaction()?;
    let mut updated = 0_i64;
    let mut needs_confirmation = 0_i64;
    {
        let mut stmt = tx.prepare(
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
                confidence = ?10,
                classification_reason = ?11,
                classification_status = 'classified',
                matched_rules = ?12,
                requires_confirmation = ?13,
                last_classified_at = ?14,
                classified_rule_version = ?15,
                last_classified_mtime = ?16,
                last_classified_size = ?17
            WHERE id = ?1
            "#,
        )?;
        for result in results {
            let Some(row) = rows_by_id.get(result.id.as_str()) else {
                continue;
            };
            let suggested_target_path = build_target_path(
                row,
                &result.file_type,
                (!result.target_template.is_empty()).then_some(result.target_template.as_str()),
                &app_settings.folder_naming_language,
                &organize_root,
            );
            if result.requires_confirmation {
                needs_confirmation += 1;
            }
            stmt.execute(params![
                result.id,
                result.file_type,
                result.purpose,
                result.lifecycle,
                result.context,
                result.risk_level,
                result.suggested_action,
                suggested_target_path,
                result.suggested_name,
                result.confidence,
                ai_reason(result),
                matched_rules,
                bool_to_i64(result.requires_confirmation),
                classified_at,
                classified_rule_version,
                row.mtime,
                row.size
            ])?;
            updated += 1;
        }
    }
    tx.commit()?;

    Ok(RuleExecutionSummary {
        scanned: targets.len() as i64,
        updated,
        skipped: targets.len() as i64 - updated,
        needs_confirmation,
    })
}

fn classify_ai_targets_with_configured_provider(
    db: &Database,
    targets: Vec<IndexedFileRow>,
    settings: &AISettings,
) -> Result<RuleExecutionSummary, String> {
    if !settings.enabled {
        return Err("AI classification is disabled.".to_string());
    }
    let provider: Box<dyn AIProvider> = match settings.provider {
        AIProviderKind::OpenAICompatible => {
            Box::new(OpenAICompatibleProvider::new(settings.clone()))
        }
        AIProviderKind::Ollama => Box::new(OllamaProvider::new(settings.clone())),
    };
    let learned_rules = db
        .learned_rule_hints(20)
        .map_err(string_error)?
        .into_iter()
        .map(|hint| hint.summary)
        .collect::<Vec<_>>();
    classify_ai_targets_with_provider(db, targets, settings, provider.as_ref(), &learned_rules)
}

fn classify_ai_targets_with_provider(
    db: &Database,
    targets: Vec<IndexedFileRow>,
    settings: &AISettings,
    provider: &dyn AIProvider,
    learned_rules: &[String],
) -> Result<RuleExecutionSummary, String> {
    if targets.is_empty() {
        return Ok(RuleExecutionSummary {
            scanned: 0,
            updated: 0,
            skipped: 0,
            needs_confirmation: 0,
        });
    }
    let batch_size = settings.batch_size.max(1);
    let requested_ids = targets
        .iter()
        .map(|row| row.id.clone())
        .collect::<HashSet<_>>();
    let mut sanitized = Vec::new();
    let mut sanitized_ids = HashSet::new();
    for batch in targets.chunks(batch_size) {
        let content = call_ai_classification_provider(provider, settings, batch, learned_rules)?;
        let outputs = parse_ai_classification_response(&content)?;
        for output in outputs {
            match sanitize_ai_classification_result(output, &requested_ids) {
                Ok(result) if sanitized_ids.insert(result.id.clone()) => sanitized.push(result),
                Ok(_) => {}
                Err(_) => {}
            }
        }
    }
    apply_ai_classification_results(db, &targets, &sanitized, settings).map_err(string_error)
}

fn query_indexed_file_rows(
    db: &Database,
    sql: &str,
    params: Vec<SqlValue>,
) -> Result<Vec<IndexedFileRow>, DbError> {
    let conn = db.conn()?;
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map(params_from_iter(params.iter()), indexed_file_from_row)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(DbError::from)
}

fn select_indexed_file_columns(alias: &str) -> String {
    format!(
        r#"
        SELECT {alias}.id, {alias}.path, {alias}.name, {alias}.extension, {alias}.size,
               {alias}.mtime, {alias}.ctime, {alias}.is_dir, {alias}.state_code,
               {alias}.file_type, {alias}.purpose, {alias}.lifecycle, {alias}.context,
               {alias}.risk_level, {alias}.suggested_action, {alias}.suggested_target_path,
               {alias}.suggested_name, {alias}.confidence, {alias}.classification_reason,
               {alias}.classification_status, {alias}.matched_rules, {alias}.requires_confirmation,
               {alias}.content_hash, 0 AS is_duplicate, {alias}.is_stale, {alias}.last_seen_at,
               {alias}.last_classified_at, {alias}.classified_rule_version,
               {alias}.last_classified_mtime, {alias}.last_classified_size
        "#
    )
}

fn ai_input_file_from_row(
    row: &IndexedFileRow,
    settings: &AISettings,
) -> AIClassificationInputFile {
    // Stage 3 intentionally ignores send_file_content even if enabled; only metadata is sent.
    let _send_file_content_ignored = settings.send_file_content;
    AIClassificationInputFile {
        id: row.id.clone(),
        name: row.name.clone(),
        extension: row.extension.clone(),
        path: settings.send_full_path.then(|| row.path.clone()),
        parent: settings
            .send_parent_path
            .then(|| parent_directory(&row.path))
            .filter(|parent| !parent.is_empty()),
        size: row.size,
        modified_at: unix_seconds_to_iso(row.mtime),
        is_dir: row.is_dir,
        existing_file_type: row.file_type.clone(),
        existing_purpose: row.purpose.clone(),
        existing_lifecycle: row.lifecycle.clone(),
        existing_risk_level: row.risk_level.clone(),
    }
}

fn extract_first_json_object(content: &str) -> Option<String> {
    let mut start = None;
    let mut depth = 0_i32;
    let mut in_string = false;
    let mut escaped = false;
    for (index, ch) in content.char_indices() {
        if in_string {
            if escaped {
                escaped = false;
            } else if ch == '\\' {
                escaped = true;
            } else if ch == '"' {
                in_string = false;
            }
            continue;
        }
        match ch {
            '"' => in_string = true,
            '{' => {
                if start.is_none() {
                    start = Some(index);
                }
                depth += 1;
            }
            '}' => {
                if depth > 0 {
                    depth -= 1;
                    if depth == 0 {
                        let start = start?;
                        return Some(content[start..=index].to_string());
                    }
                }
            }
            _ => {}
        }
    }
    None
}

fn require_allowed(field: &str, value: &str, allowed: &[&str]) -> Result<String, String> {
    let trimmed = value.trim();
    allowed
        .iter()
        .find(|item| **item == trimmed)
        .map(|item| (*item).to_string())
        .ok_or_else(|| format!("AI classification {field} has unsupported value."))
}

fn sanitize_target_template(value: &str) -> Result<String, String> {
    let template = value.trim().replace('\\', "/");
    if template.is_empty() {
        return Ok(String::new());
    }
    if template.starts_with('/') || template.starts_with("//") {
        return Err("AI targetTemplate must be relative.".to_string());
    }
    if template.len() >= 2 && template.as_bytes().get(1) == Some(&b':') {
        return Err("AI targetTemplate must not contain a Windows drive prefix.".to_string());
    }
    if template.contains('\0') {
        return Err("AI targetTemplate must not contain NUL.".to_string());
    }
    if template
        .split('/')
        .any(|segment| segment == ".." || segment.trim().is_empty())
    {
        return Err("AI targetTemplate must not contain empty or parent segments.".to_string());
    }
    if template
        .chars()
        .any(|ch| matches!(ch, '*' | '?' | '<' | '>' | '|' | '"' | ':'))
    {
        return Err("AI targetTemplate contains unsafe characters.".to_string());
    }
    Ok(template)
}

fn sanitize_suggested_name(value: Option<&str>) -> String {
    let Some(value) = value.map(str::trim).filter(|value| !value.is_empty()) else {
        return String::new();
    };
    value
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

fn ai_reason(result: &SanitizedAIClassification) -> String {
    if result.keywords.is_empty() {
        result.reason.clone()
    } else {
        format!("{} Keywords: {}", result.reason, result.keywords.join(", "))
    }
}

fn ai_matched_rule(settings: &AISettings) -> String {
    format!(
        "ai:{}:{}",
        preset_id_text(settings.preset),
        settings.model.trim()
    )
}

fn ai_classified_rule_version(settings: &AISettings) -> String {
    format!("{}:classification", ai_matched_rule(settings))
}

fn preset_id_text(preset: AIProviderPresetId) -> String {
    serde_json::to_value(preset)
        .ok()
        .and_then(|value| value.as_str().map(ToString::to_string))
        .unwrap_or_else(|| "unknown".to_string())
}

fn sanitize_ai_error(message: String, api_key: &str) -> String {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        message
    } else {
        message.replace(api_key, "[redacted]")
    }
}

fn string_error(error: impl std::fmt::Display) -> String {
    error.to_string()
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
    "Move",
    "MoveAndRename",
    "Archive",
    "Review",
    "DeleteCandidate",
];

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::{
        provider::AIProviderError,
        schema::{AIConnectionTestResult, AIProviderPresetId},
        settings::{save_ai_settings_for_db, AISettings},
    };
    use crate::db::InsertFileRequest;
    use rusqlite::Connection;
    use std::{
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn normal_json_parses() {
        let outputs = parse_ai_classification_response(valid_response("file-1", "Move", "Normal"))
            .expect("parse json");
        assert_eq!(outputs.len(), 1);
        assert_eq!(outputs[0].id, "file-1");
    }

    #[test]
    fn markdown_wrapped_json_extracts_first_object() {
        let content = format!(
            "```json\n{}\n```",
            valid_response("file-1", "Move", "Normal")
        );
        let outputs = parse_ai_classification_response(&content).expect("extract json");
        assert_eq!(outputs[0].id, "file-1");
    }

    #[test]
    fn invalid_enum_is_rejected() {
        let requested = requested_ids(&["file-1"]);
        let mut output = valid_output("file-1");
        output.file_type = "BadType".to_string();
        assert!(sanitize_ai_classification_result(output, &requested).is_err());
    }

    #[test]
    fn absolute_windows_target_template_is_rejected() {
        assert_target_template_rejected("C:/Users/zen/Documents");
    }

    #[test]
    fn absolute_unix_target_template_is_rejected() {
        assert_target_template_rejected("/Users/zen/Documents");
    }

    #[test]
    fn parent_segments_in_target_template_are_rejected() {
        assert_target_template_rejected("Teaching/../Secrets");
    }

    #[test]
    fn unsafe_target_template_characters_are_rejected() {
        assert_target_template_rejected("Teaching/*/Scala");
        assert_target_template_rejected("Teaching/?/Scala");
    }

    #[test]
    fn suggested_name_path_separators_are_cleaned() {
        let requested = requested_ids(&["file-1"]);
        let mut output = valid_output("file-1");
        output.suggested_name = Some("bad/name\\file.pdf".to_string());
        let sanitized = sanitize_ai_classification_result(output, &requested).expect("sanitize");
        assert!(!sanitized.suggested_name.contains('/'));
        assert!(!sanitized.suggested_name.contains('\\'));
    }

    #[test]
    fn sensitive_forces_review_and_confirmation() {
        let requested = requested_ids(&["file-1"]);
        let mut output = valid_output("file-1");
        output.risk_level = "Sensitive".to_string();
        output.suggested_action = "Move".to_string();
        output.requires_confirmation = false;
        let sanitized = sanitize_ai_classification_result(output, &requested).expect("sanitize");
        assert_eq!(sanitized.suggested_action, "Review");
        assert!(sanitized.requires_confirmation);
    }

    #[test]
    fn delete_candidate_forces_review() {
        let requested = requested_ids(&["file-1"]);
        let mut output = valid_output("file-1");
        output.suggested_action = "DeleteCandidate".to_string();
        let sanitized = sanitize_ai_classification_result(output, &requested).expect("sanitize");
        assert_eq!(sanitized.suggested_action, "Review");
    }

    #[test]
    fn low_confidence_forces_confirmation() {
        let requested = requested_ids(&["file-1"]);
        let mut output = valid_output("file-1");
        output.confidence = 0.42;
        output.requires_confirmation = false;
        let sanitized = sanitize_ai_classification_result(output, &requested).expect("sanitize");
        assert!(sanitized.requires_confirmation);
    }

    #[test]
    fn provider_error_does_not_write_files_table() {
        let db = test_db();
        insert_test_file(&db, "file-1", "/tmp/Scala期末复习题.pdf");
        let settings = enabled_settings();
        save_ai_settings_for_db(&db, &settings).expect("save ai settings");
        let targets = collect_selected_ai_classification_targets(&db, &["file-1".to_string()])
            .expect("collect targets");
        let provider = StaticProvider {
            response: Err(AIProviderError::new("bad ai-secret-key")),
        };

        let error = classify_ai_targets_with_provider(&db, targets, &settings, &provider, &[])
            .expect_err("provider should fail");
        let status = file_status(&db, "file-1");

        assert!(!error.contains("ai-secret-key"));
        assert_eq!(status, "unclassified");
    }

    #[test]
    fn valid_ai_response_writes_classification_suggestions_only() {
        let db = test_db();
        insert_test_file(&db, "file-1", "/tmp/Scala期末复习题.pdf");
        let settings = enabled_settings();
        let targets = collect_selected_ai_classification_targets(&db, &["file-1".to_string()])
            .expect("collect targets");
        let provider = StaticProvider {
            response: Ok(valid_response("file-1", "Move", "Normal").to_string()),
        };

        let summary = classify_ai_targets_with_provider(&db, targets, &settings, &provider, &[])
            .expect("classify");

        assert_eq!(summary.scanned, 1);
        assert_eq!(summary.updated, 1);
        let conn = Connection::open(db.path()).expect("open db");
        let row: (String, String, String, String) = conn
            .query_row(
                "SELECT file_type, suggested_action, classification_status, matched_rules FROM files WHERE id = 'file-1'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .expect("row");
        assert_eq!(row.0, "Document");
        assert_eq!(row.1, "Move");
        assert_eq!(row.2, "classified");
        assert!(row.3.contains("ai:deepseek:deepseek-v4-flash"));
    }

    #[test]
    fn prompt_includes_learned_rule_hints() {
        let db = test_db();
        insert_test_file(&db, "file-1", "/tmp/Scala期末复习题.pdf");
        let settings = enabled_settings();
        let targets = collect_selected_ai_classification_targets(&db, &["file-1".to_string()])
            .expect("collect targets");

        let messages = build_ai_classification_prompt(
            &targets,
            &settings,
            &["包含 \"Scala\" 的文档通常归类为 Teaching / Scala".to_string()],
        )
        .expect("build prompt");

        assert!(messages[1].content.contains("用户已经确认过的分类习惯"));
        assert!(messages[1].content.contains("Scala"));
        assert!(messages[1].content.contains("Teaching"));
    }

    fn assert_target_template_rejected(template: &str) {
        let requested = requested_ids(&["file-1"]);
        let mut output = valid_output("file-1");
        output.target_template = template.to_string();
        assert!(sanitize_ai_classification_result(output, &requested).is_err());
    }

    fn requested_ids(ids: &[&str]) -> HashSet<String> {
        ids.iter().map(|id| (*id).to_string()).collect()
    }

    fn valid_response(id: &str, suggested_action: &str, risk_level: &str) -> &'static str {
        match (id, suggested_action, risk_level) {
            ("file-1", "Move", "Normal") => {
                r#"{"classifications":[{"id":"file-1","fileType":"Document","purpose":"Teaching","lifecycle":"Active","context":"Scala","riskLevel":"Normal","suggestedAction":"Move","targetTemplate":"Teaching/Scala/试卷","suggestedName":"","confidence":0.92,"reason":"文件名包含 Scala、期末、复习题，判断为教学考试资料。","keywords":["Scala","期末","复习题"],"requiresConfirmation":false}]}"#
            }
            _ => panic!("unexpected fixture"),
        }
    }

    fn valid_output(id: &str) -> AIClassificationOutput {
        parse_ai_classification_response(valid_response(id, "Move", "Normal"))
            .expect("parse fixture")
            .remove(0)
    }

    fn enabled_settings() -> AISettings {
        AISettings {
            enabled: true,
            api_key: "ai-secret-key".to_string(),
            preset: AIProviderPresetId::DeepSeek,
            batch_size: 20,
            ..AISettings::default()
        }
    }

    fn test_db() -> Database {
        Database::open(test_db_path()).expect("open test database")
    }

    fn insert_test_file(db: &Database, id: &str, path: &str) {
        db.insert_file(InsertFileRequest {
            id: id.to_string(),
            path: path.to_string(),
            name: path.rsplit('/').next().unwrap_or(path).to_string(),
            extension: path.rsplit('.').next().unwrap_or_default().to_string(),
            size: 2048,
            mtime: 1_700_000_000,
            ctime: 1_700_000_000,
            is_dir: false,
            state_code: 0,
        })
        .expect("insert file");
    }

    fn file_status(db: &Database, id: &str) -> String {
        let conn = Connection::open(db.path()).expect("open db");
        conn.query_row(
            "SELECT classification_status FROM files WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .expect("file status")
    }

    fn test_db_path() -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        std::env::temp_dir().join(format!("zen-canvas-ai-classification-test-{nonce}.sqlite3"))
    }

    struct StaticProvider {
        response: Result<String, AIProviderError>,
    }

    impl AIProvider for StaticProvider {
        fn chat_json(&self, _request: AIChatRequest) -> Result<String, AIProviderError> {
            self.response.clone()
        }

        fn test_connection(&self) -> Result<AIConnectionTestResult, AIProviderError> {
            Ok(AIConnectionTestResult {
                ok: true,
                message: "ok".to_string(),
                model: None,
                provider: None,
                preset: None,
                elapsed_ms: 0,
            })
        }
    }
}
