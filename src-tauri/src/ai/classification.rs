use std::{
    collections::{HashMap, HashSet, VecDeque},
    sync::mpsc,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Instant,
};

use rusqlite::{params, params_from_iter, types::Value as SqlValue};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Runtime, State};

use super::{
    ollama::OllamaProvider,
    openai_compatible::OpenAICompatibleProvider,
    prompts::{
        ai_file_classification_system_prompt,
        build_ai_classification_prompt as build_ai_classification_prompt_body, clean_ai_json_text,
        extract_first_json_value,
    },
    provider::AIProvider,
    schema::{AIChatMessage, AIChatRequest, AIProviderKind, AIProviderOptions, AIProviderPresetId},
    settings::{get_ai_settings_for_db, normalize_ai_settings, AISettings},
};
use crate::{
    db::{
        bool_to_i64, build_target_path, current_unix_seconds, indexed_file_from_row,
        normalize_path_text, parent_directory, scoped_files_sql, trim_trailing_path_separators,
        unix_seconds_to_iso, Database, DbError, IndexedFileRow, LibraryScope, OrganizeRootConfig,
        RuleExecutionSummary,
    },
    settings::get_app_settings,
};

pub const AI_CLASSIFICATION_PROGRESS_EVENT: &str = "ai-classification-progress";
const DEFAULT_AI_CLASSIFICATION_LIMIT: u32 = 100;
const AI_CLASSIFICATION_TRANSIENT_RETRIES: usize = 2;

#[derive(Clone)]
pub struct AIClassificationCancellationToken(pub Arc<AtomicBool>);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AIClassificationProgressPayload {
    pub job_id: String,
    pub processed: usize,
    pub total: usize,
    pub batch_index: usize,
    pub batch_count: usize,
    pub completed_batches: usize,
    pub failed_batches: usize,
    pub updated: i64,
    pub skipped: i64,
    pub needs_confirmation: i64,
    pub stage: String,
    pub current_file_preview: String,
    pub elapsed_ms: u128,
    pub estimated_remaining_ms: Option<u128>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIClassificationOptions {
    pub only_unclassified: Option<bool>,
    pub only_low_confidence: Option<bool>,
    pub limit: Option<u32>,
    pub force: Option<bool>,
    pub allow_overwrite_user_corrections: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AIClassificationInputFile {
    pub ref_id: String,
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
    #[serde(default, alias = "ref_id")]
    pub ref_id: Option<String>,
    #[serde(default)]
    pub id: String,
    #[serde(default = "default_file_type", alias = "file_type")]
    pub file_type: String,
    #[serde(default = "default_purpose", alias = "purpose")]
    pub purpose: String,
    #[serde(default = "default_lifecycle", alias = "lifecycle")]
    pub lifecycle: String,
    #[serde(default, alias = "context")]
    pub context: String,
    #[serde(default = "default_risk_level", alias = "risk_level")]
    pub risk_level: String,
    #[serde(default = "default_suggested_action", alias = "suggested_action")]
    pub suggested_action: String,
    #[serde(default, alias = "target_template")]
    pub target_template: String,
    #[serde(default, alias = "suggested_name")]
    pub suggested_name: Option<String>,
    #[serde(default = "default_confidence", alias = "confidence")]
    pub confidence: f64,
    #[serde(default, alias = "reason")]
    pub reason: String,
    #[serde(default, alias = "keywords")]
    pub keywords: Vec<String>,
    #[serde(
        default = "default_requires_confirmation",
        alias = "requires_confirmation"
    )]
    pub requires_confirmation: bool,
    #[serde(skip)]
    pub missing_optional_fields: Vec<String>,
    #[serde(skip)]
    pub fallback_applied: bool,
    #[serde(skip)]
    pub item_parse_warnings: Vec<String>,
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

#[derive(Debug, Clone)]
pub(crate) struct AIClassificationIdEntry {
    pub(crate) ref_id: String,
    pub(crate) real_file_id: String,
    pub(crate) path: String,
}

#[derive(Debug, Clone)]
pub(crate) struct AIClassificationIdResolution {
    pub(crate) real_file_id: String,
    pub(crate) returned_ref_id: Option<String>,
    pub(crate) returned_id: Option<String>,
    pub(crate) matched: bool,
}

#[derive(Debug, Clone)]
pub(crate) struct AIClassificationIdMap {
    pub(crate) entries: Vec<AIClassificationIdEntry>,
    ref_to_id: HashMap<String, String>,
    real_ids: HashSet<String>,
    path_to_id: HashMap<String, String>,
}

impl AIClassificationIdMap {
    pub(crate) fn from_targets(targets: &[IndexedFileRow]) -> Self {
        let mut entries = Vec::with_capacity(targets.len());
        let mut ref_to_id = HashMap::with_capacity(targets.len());
        let mut real_ids = HashSet::with_capacity(targets.len());
        let mut path_to_id = HashMap::with_capacity(targets.len() * 2);
        for (index, row) in targets.iter().enumerate() {
            let ref_id = format!("f{}", index + 1);
            entries.push(AIClassificationIdEntry {
                ref_id: ref_id.clone(),
                real_file_id: row.id.clone(),
                path: row.path.clone(),
            });
            ref_to_id.insert(ref_id, row.id.clone());
            real_ids.insert(row.id.clone());
            for key in path_keys(&row.path) {
                path_to_id.entry(key).or_insert_with(|| row.id.clone());
            }
        }
        Self {
            entries,
            ref_to_id,
            real_ids,
            path_to_id,
        }
    }

    pub(crate) fn resolve_output(
        &self,
        output: &AIClassificationOutput,
    ) -> Result<AIClassificationIdResolution, String> {
        let returned_ref_id = output
            .ref_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToString::to_string);
        let returned_id = output.id.trim();
        let returned_id = (!returned_id.is_empty()).then(|| returned_id.to_string());

        if let Some(ref_id) = returned_ref_id.as_deref() {
            let Some(real_file_id) = self.ref_to_id.get(ref_id) else {
                return Err("AI classification refId was not part of the request.".to_string());
            };
            return Ok(AIClassificationIdResolution {
                real_file_id: real_file_id.clone(),
                returned_ref_id,
                returned_id,
                matched: true,
            });
        }

        let Some(id) = returned_id.as_deref() else {
            return Err("AI classification result did not include refId.".to_string());
        };
        if let Some(real_file_id) = self.ref_to_id.get(id) {
            return Ok(AIClassificationIdResolution {
                real_file_id: real_file_id.clone(),
                returned_ref_id,
                returned_id,
                matched: true,
            });
        }
        if self.real_ids.contains(id) {
            return Ok(AIClassificationIdResolution {
                real_file_id: id.to_string(),
                returned_ref_id,
                returned_id,
                matched: true,
            });
        }
        for key in path_keys(id) {
            if let Some(real_file_id) = self.path_to_id.get(&key) {
                return Ok(AIClassificationIdResolution {
                    real_file_id: real_file_id.clone(),
                    returned_ref_id,
                    returned_id,
                    matched: true,
                });
            }
        }
        if is_path_like(id) {
            return Err(
                "AI returned file path instead of refId. This result was not applied.".to_string(),
            );
        }
        Err("AI classification id was not part of the request.".to_string())
    }
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
        classify_ai_targets_with_configured_provider(&db, targets, &settings, None)
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
        classify_ai_targets_with_configured_provider(&db, targets, &settings, None)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn classify_files_with_ai<R: Runtime>(
    db: State<'_, Database>,
    app: AppHandle<R>,
    cancellation: State<'_, AIClassificationCancellationToken>,
    scope: LibraryScope,
    options: Option<AIClassificationOptions>,
) -> Result<RuleExecutionSummary, String> {
    cancellation.0.store(false, Ordering::SeqCst);
    let cancel_flag = Arc::clone(&cancellation.0);
    let db = db.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let settings = normalize_ai_settings(get_ai_settings_for_db(&db).map_err(string_error)?);
        let targets = collect_ai_classification_targets(&db, &scope, options.as_ref(), &settings)
            .map_err(string_error)?;
        let progress = TauriAIClassificationProgress::new(app);
        classify_ai_targets_with_configured_provider(
            &db,
            targets,
            &settings,
            Some((&progress, &cancel_flag)),
        )
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn classify_selected_files_with_ai(
    db: State<'_, Database>,
    file_ids: Vec<String>,
) -> Result<RuleExecutionSummary, String> {
    classify_selected_files_with_ai_for_db(db.inner().clone(), file_ids).await
}

#[tauri::command]
pub fn cancel_ai_classification(cancellation: State<'_, AIClassificationCancellationToken>) {
    cancellation.0.store(true, Ordering::SeqCst);
}

pub(crate) fn collect_ai_classification_targets(
    db: &Database,
    scope: &LibraryScope,
    options: Option<&AIClassificationOptions>,
    _settings: &AISettings,
) -> Result<Vec<IndexedFileRow>, DbError> {
    let limit = options
        .and_then(|options| options.limit)
        .unwrap_or(DEFAULT_AI_CLASSIFICATION_LIMIT)
        .clamp(1, 5000);
    let force = options.and_then(|options| options.force).unwrap_or(false);
    let allow_overwrite_user_corrections = options
        .and_then(|options| options.allow_overwrite_user_corrections)
        .unwrap_or(false);
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
    if !allow_overwrite_user_corrections {
        filters.push(
            "NOT (
                f.matched_rules LIKE '%user_correction%'
                OR f.matched_rules LIKE '%user_confirmed%'
                OR f.matched_rules LIKE '%manual%'
                OR f.matched_rules LIKE '%learned:%'
            )",
        );
    }
    if !force {
        filters.push(
            "NOT (
                f.classification_status = 'classified'
                AND f.requires_confirmation = 0
                AND f.last_classified_mtime = f.mtime
                AND f.last_classified_size = f.size
            )",
        );
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
    let id_map = AIClassificationIdMap::from_targets(targets);
    let files = targets
        .iter()
        .zip(id_map.entries.iter())
        .map(|(row, entry)| ai_input_file_from_row(row, settings, &entry.ref_id))
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
    retry_json_only: bool,
) -> Result<String, String> {
    let mut messages = build_ai_classification_prompt(targets, settings, learned_rules)?;
    if retry_json_only {
        messages.push(AIChatMessage {
            role: "user".to_string(),
            content: "上一次输出不是有效 JSON。请只返回一个 JSON 对象，不要 Markdown，不要解释，不要 thinking，不要代码块。".to_string(),
        });
    }
    provider
        .chat_json(AIChatRequest {
            messages,
            model: settings.model.clone(),
            temperature: settings.temperature,
            max_tokens: max_tokens_for_classification_request(settings, targets.len()),
            force_json: settings.force_json_output,
            provider_options: AIProviderOptions {
                use_response_format: retry_json_only.then_some(false),
                ..Default::default()
            },
        })
        .map_err(|error| sanitize_ai_error(error.to_string(), &settings.api_key))
}

fn max_tokens_for_classification_request(settings: &AISettings, batch_len: usize) -> u32 {
    let estimated = batch_len.saturating_mul(120).saturating_add(256);
    let clamped = estimated.clamp(512, settings.max_tokens.max(512) as usize);
    clamped as u32
}

pub(crate) fn parse_ai_classification_response(
    content: &str,
) -> Result<Vec<AIClassificationOutput>, String> {
    let cleaned = clean_ai_json_text(content);
    let value = serde_json::from_str::<serde_json::Value>(&cleaned)
        .or_else(|_| {
            extract_first_json_value(content)
                .ok_or_else(|| {
                    serde_json::Error::io(std::io::Error::new(
                        std::io::ErrorKind::InvalidData,
                        "no JSON value found",
                    ))
                })
                .and_then(|value| serde_json::from_str::<serde_json::Value>(&value))
        })
        .map_err(|error| ai_classification_json_error(content, &error.to_string()))?;
    classification_outputs_from_value(value)
        .map_err(|error| ai_classification_json_error(content, &error))
}

pub(crate) fn sanitize_ai_classification_result(
    output: AIClassificationOutput,
    id_map: &AIClassificationIdMap,
) -> Result<SanitizedAIClassification, String> {
    let resolution = id_map.resolve_output(&output)?;
    let id = resolution.real_file_id;
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
    let (target_template, suggested_name) =
        split_filename_from_target_template(target_template, suggested_name);
    let confidence = output.confidence.clamp(0.0, 1.0);
    let mut requires_confirmation = output.requires_confirmation;
    if output.fallback_applied {
        requires_confirmation = true;
    }

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

#[allow(dead_code)]
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
            failed_batches: None,
            failed_files: None,
            warning: None,
        });
    }
    apply_ai_classification_batch_results(db, targets, results, settings)
}

fn apply_ai_classification_batch_results(
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
            failed_batches: None,
            failed_files: None,
            warning: None,
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
        failed_batches: None,
        failed_files: None,
        warning: None,
    })
}

fn classify_ai_targets_with_configured_provider(
    db: &Database,
    targets: Vec<IndexedFileRow>,
    settings: &AISettings,
    runtime: Option<(&dyn AIClassificationProgressEmitter, &AtomicBool)>,
) -> Result<RuleExecutionSummary, String> {
    if !settings.enabled {
        return Err("AI classification is disabled.".to_string());
    }
    let provider: Arc<dyn AIProvider> = match settings.provider {
        AIProviderKind::OpenAICompatible => {
            Arc::new(OpenAICompatibleProvider::new(settings.clone()))
        }
        AIProviderKind::Ollama => Arc::new(OllamaProvider::new(settings.clone())),
    };
    let learned_rules = db
        .learned_rule_hints(10)
        .map_err(string_error)?
        .into_iter()
        .map(|hint| truncate_chars(&hint.summary, 80))
        .collect::<Vec<_>>();
    classify_ai_targets_with_provider(
        db,
        targets,
        settings,
        provider.as_ref(),
        &learned_rules,
        runtime,
    )
}

fn classify_ai_targets_with_provider(
    db: &Database,
    targets: Vec<IndexedFileRow>,
    settings: &AISettings,
    provider: &dyn AIProvider,
    learned_rules: &[String],
    runtime: Option<(&dyn AIClassificationProgressEmitter, &AtomicBool)>,
) -> Result<RuleExecutionSummary, String> {
    let job_id = format!("ai-classification-{}", current_unix_seconds());
    let started = Instant::now();
    if targets.is_empty() {
        emit_ai_classification_progress(
            runtime.map(|(emitter, _)| emitter),
            AIClassificationProgressUpdate::new(&job_id, 0, 0, 0, 0, "收集待分类文件")
                .elapsed(started.elapsed().as_millis()),
        );
        return Ok(RuleExecutionSummary {
            scanned: 0,
            updated: 0,
            skipped: 0,
            needs_confirmation: 0,
            failed_batches: None,
            failed_files: None,
            warning: None,
        });
    }

    let batch_size = settings.batch_size.max(1);
    let batch_count = targets.len().div_ceil(batch_size);
    let concurrency = settings.classification_concurrency.clamp(1, 4).min(batch_count.max(1));
    let tasks = targets
        .chunks(batch_size)
        .enumerate()
        .map(|(index, batch)| AIClassificationBatchTask {
            index: index + 1,
            batch_count,
            batch_size,
            target_count: targets.len(),
            rows: batch.to_vec(),
        })
        .collect::<VecDeque<_>>();
    let queue = Arc::new(Mutex::new(tasks));
    let (tx, rx) = mpsc::channel::<AIClassificationBatchRunResult>();
    let cancel_flag = runtime.map(|(_, cancel_flag)| cancel_flag);
    let mut completed_batches = 0_usize;
    let mut failed_batches_count = 0_usize;
    let mut processed = 0_usize;
    let mut updated = 0_i64;
    let mut skipped = 0_i64;
    let mut needs_confirmation = 0_i64;
    let mut failures = Vec::new();

    emit_ai_classification_progress(
        runtime.map(|(emitter, _)| emitter),
        AIClassificationProgressUpdate::new(&job_id, 0, targets.len(), 0, batch_count, "收集待分类文件")
            .current_file(targets.first().map(|row| row.name.as_str()).unwrap_or_default())
            .elapsed(started.elapsed().as_millis()),
    );

    std::thread::scope(|scope| {
        for _ in 0..concurrency {
            let queue = Arc::clone(&queue);
            let tx = tx.clone();
            let provider = provider;
            let settings = settings.clone();
            let learned_rules = learned_rules.to_vec();
            scope.spawn(move || loop {
                let task = {
                    let mut queue = queue.lock().expect("classification queue poisoned");
                    queue.pop_front()
                };
                let Some(task) = task else { break };
                if cancel_flag.map(|flag| flag.load(Ordering::SeqCst)).unwrap_or(false) {
                    break;
                }
                let result = run_ai_classification_batch(provider, &settings, &learned_rules, task);
                if tx.send(result).is_err() {
                    break;
                }
            });
        }
        drop(tx);

        for result in rx {
            processed += result.file_count();
            match result {
                AIClassificationBatchRunResult::Success { task, results } => {
                    completed_batches += 1;
                    match apply_ai_classification_batch_results(db, &task.rows, &results, settings)
                        .map_err(string_error)
                    {
                        Ok(summary) => {
                            updated += summary.updated;
                            skipped += summary.skipped;
                            needs_confirmation += summary.needs_confirmation;
                            emit_ai_classification_progress(
                                runtime.map(|(emitter, _)| emitter),
                                AIClassificationProgressUpdate::new(&job_id, processed, targets.len(), task.index, batch_count, "写入整理建议")
                                    .completed_batches(completed_batches)
                                    .failed_batches(failed_batches_count)
                                    .summary(updated, skipped, needs_confirmation)
                                    .current_file(task.rows.last().map(|row| row.name.as_str()).unwrap_or_default())
                                    .elapsed(started.elapsed().as_millis())
                                    .estimated_remaining(estimated_remaining_ms(started, processed, targets.len())),
                            );
                        }
                        Err(error) => {
                            failed_batches_count += 1;
                            skipped += task.rows.len() as i64;
                            failures.push(AIClassificationBatchFailure::from_context(&task.context(), error));
                        }
                    }
                }
                AIClassificationBatchRunResult::Failure { task, error } => {
                    failed_batches_count += 1;
                    skipped += task.rows.len() as i64;
                    failures.push(AIClassificationBatchFailure::from_context(&task.context(), error));
                    emit_ai_classification_progress(
                        runtime.map(|(emitter, _)| emitter),
                        AIClassificationProgressUpdate::new(&job_id, processed, targets.len(), task.index, batch_count, "解析模型返回")
                            .completed_batches(completed_batches)
                            .failed_batches(failed_batches_count)
                            .summary(updated, skipped, needs_confirmation)
                            .current_file(task.rows.first().map(|row| row.name.as_str()).unwrap_or_default())
                            .elapsed(started.elapsed().as_millis())
                            .estimated_remaining(estimated_remaining_ms(started, processed, targets.len())),
                    );
                }
            }
        }
    });

    if updated == 0 && !failures.is_empty() && completed_batches == 0 {
        let first = failures
            .first()
            .map(|failure| failure.message.clone())
            .unwrap_or_else(|| "AI classification batches failed.".to_string());
        return Err(first);
    }

    let accounted = updated + skipped;
    let mut summary = RuleExecutionSummary {
        scanned: targets.len() as i64,
        updated,
        skipped: skipped + (targets.len() as i64 - accounted).max(0),
        needs_confirmation,
        failed_batches: None,
        failed_files: None,
        warning: None,
    };

    if cancel_flag.map(|flag| flag.load(Ordering::SeqCst)).unwrap_or(false) {
        summary.warning = Some("AI 分类已取消。".to_string());
    }
    if !failures.is_empty() {
        let failed_files = failures
            .iter()
            .map(|failure| failure.file_count as i64)
            .sum::<i64>();
        summary.failed_batches = Some(failures.len() as i64);
        summary.failed_files = Some(failed_files);
        summary.warning = Some("部分批次请求失败，请降低 Batch Size 或并发数后重试。".to_string());
    }

    emit_ai_classification_progress(
        runtime.map(|(emitter, _)| emitter),
        AIClassificationProgressUpdate::new(&job_id, targets.len(), targets.len(), batch_count, batch_count, "完成")
            .completed_batches(completed_batches)
            .failed_batches(failed_batches_count)
            .summary(updated, summary.skipped, needs_confirmation)
            .elapsed(started.elapsed().as_millis()),
    );

    Ok(summary)
}

#[derive(Debug, Clone)]
struct AIClassificationBatchTask {
    index: usize,
    batch_count: usize,
    batch_size: usize,
    target_count: usize,
    rows: Vec<IndexedFileRow>,
}

impl AIClassificationBatchTask {
    fn context(&self) -> AIClassificationBatchContext {
        AIClassificationBatchContext::new(
            self.index,
            self.batch_count,
            self.batch_size,
            self.target_count,
            &self.rows,
        )
    }
}

enum AIClassificationBatchRunResult {
    Success {
        task: AIClassificationBatchTask,
        results: Vec<SanitizedAIClassification>,
    },
    Failure {
        task: AIClassificationBatchTask,
        error: String,
    },
}

impl AIClassificationBatchRunResult {
    fn file_count(&self) -> usize {
        match self {
            Self::Success { task, .. } | Self::Failure { task, .. } => task.rows.len(),
        }
    }
}

fn run_ai_classification_batch(
    provider: &dyn AIProvider,
    settings: &AISettings,
    learned_rules: &[String],
    task: AIClassificationBatchTask,
) -> AIClassificationBatchRunResult {
    let id_map = AIClassificationIdMap::from_targets(&task.rows);
    let context = task.context();
    let content = match call_ai_classification_provider_with_retries(
        provider,
        settings,
        &task.rows,
        learned_rules,
        false,
        &context,
    ) {
        Ok(content) => content,
        Err(error) => return AIClassificationBatchRunResult::Failure { task, error },
    };
    let outputs = match parse_ai_classification_response(&content) {
        Ok(outputs) => outputs,
        Err(_) => {
            let retry_content = match call_ai_classification_provider_with_retries(
                provider,
                settings,
                &task.rows,
                learned_rules,
                true,
                &context,
            ) {
                Ok(content) => content,
                Err(error) => return AIClassificationBatchRunResult::Failure { task, error },
            };
            match parse_ai_classification_response(&retry_content).map_err(|error| {
                if is_ai_classification_schema_error(&error) {
                    format!("{error} 已尝试清洗和重试，但仍失败。")
                } else {
                    format!(
                        "{error} 已尝试清洗和重试，但仍失败。建议关闭 thinking，或换用 deepseek-v4-flash / qwen-plus 等更稳定的非思考模型。"
                    )
                }
            }) {
                Ok(outputs) => outputs,
                Err(error) => return AIClassificationBatchRunResult::Failure { task, error },
            }
        }
    };
    let mut sanitized = Vec::new();
    let mut sanitized_ids = HashSet::new();
    for output in outputs {
        match sanitize_ai_classification_result(output, &id_map) {
            Ok(result) if sanitized_ids.insert(result.id.clone()) => sanitized.push(result),
            Ok(_) => {}
            Err(_) => {}
        }
    }
    AIClassificationBatchRunResult::Success {
        task,
        results: sanitized,
    }
}

fn estimated_remaining_ms(started: Instant, processed: usize, total: usize) -> Option<u128> {
    if processed == 0 || processed >= total {
        return None;
    }
    let elapsed = started.elapsed().as_millis();
    let remaining = total.saturating_sub(processed) as u128;
    Some(elapsed.saturating_mul(remaining) / processed as u128)
}

trait AIClassificationProgressEmitter {
    fn emit_progress(&self, payload: AIClassificationProgressPayload);
}

struct TauriAIClassificationProgress<R: Runtime> {
    app: AppHandle<R>,
}

impl<R: Runtime> TauriAIClassificationProgress<R> {
    fn new(app: AppHandle<R>) -> Self {
        Self { app }
    }
}

impl<R: Runtime> AIClassificationProgressEmitter for TauriAIClassificationProgress<R> {
    fn emit_progress(&self, payload: AIClassificationProgressPayload) {
        let _ = self.app.emit(AI_CLASSIFICATION_PROGRESS_EVENT, payload);
    }
}

fn emit_ai_classification_progress(
    emitter: Option<&dyn AIClassificationProgressEmitter>,
    update: AIClassificationProgressUpdate,
) {
    if let Some(emitter) = emitter {
        emitter.emit_progress(AIClassificationProgressPayload {
            job_id: update.job_id,
            processed: update.processed,
            total: update.total,
            batch_index: update.batch_index,
            batch_count: update.batch_count,
            completed_batches: update.completed_batches,
            failed_batches: update.failed_batches,
            updated: update.updated,
            skipped: update.skipped,
            needs_confirmation: update.needs_confirmation,
            stage: update.stage,
            current_file_preview: update.current_file_preview.chars().take(120).collect::<String>(),
            elapsed_ms: update.elapsed_ms,
            estimated_remaining_ms: update.estimated_remaining_ms,
        });
    }
}

#[derive(Debug, Clone)]
struct AIClassificationProgressUpdate {
    job_id: String,
    processed: usize,
    total: usize,
    batch_index: usize,
    batch_count: usize,
    completed_batches: usize,
    failed_batches: usize,
    updated: i64,
    skipped: i64,
    needs_confirmation: i64,
    stage: String,
    current_file_preview: String,
    elapsed_ms: u128,
    estimated_remaining_ms: Option<u128>,
}

impl AIClassificationProgressUpdate {
    fn new(
        job_id: &str,
        processed: usize,
        total: usize,
        batch_index: usize,
        batch_count: usize,
        stage: &str,
    ) -> Self {
        Self {
            job_id: job_id.to_string(),
            processed,
            total,
            batch_index,
            batch_count,
            completed_batches: 0,
            failed_batches: 0,
            updated: 0,
            skipped: 0,
            needs_confirmation: 0,
            stage: stage.to_string(),
            current_file_preview: String::new(),
            elapsed_ms: 0,
            estimated_remaining_ms: None,
        }
    }

    fn completed_batches(mut self, value: usize) -> Self {
        self.completed_batches = value;
        self
    }

    fn failed_batches(mut self, value: usize) -> Self {
        self.failed_batches = value;
        self
    }

    fn summary(mut self, updated: i64, skipped: i64, needs_confirmation: i64) -> Self {
        self.updated = updated;
        self.skipped = skipped;
        self.needs_confirmation = needs_confirmation;
        self
    }

    fn current_file(mut self, value: &str) -> Self {
        self.current_file_preview = value.to_string();
        self
    }

    fn elapsed(mut self, value: u128) -> Self {
        self.elapsed_ms = value;
        self
    }

    fn estimated_remaining(mut self, value: Option<u128>) -> Self {
        self.estimated_remaining_ms = value;
        self
    }
}

#[derive(Debug, Clone)]
struct AIClassificationBatchContext {
    batch_index: usize,
    batch_count: usize,
    batch_size: usize,
    target_count: usize,
    file_count: usize,
    file_names: String,
}

impl AIClassificationBatchContext {
    fn new(
        batch_index: usize,
        batch_count: usize,
        batch_size: usize,
        target_count: usize,
        batch: &[IndexedFileRow],
    ) -> Self {
        Self {
            batch_index,
            batch_count,
            batch_size,
            target_count,
            file_count: batch.len(),
            file_names: batch_file_names(batch),
        }
    }

    fn format_error(&self, error: &str) -> String {
        let hint = provider_error_hint(error);
        let hint = if hint.is_empty() {
            String::new()
        } else {
            format!(" {hint}")
        };
        format!(
            "AI classification batch {}/{} failed. batchSize={} targetCount={} files=[{}]. Provider error: {}{}",
            self.batch_index,
            self.batch_count,
            self.batch_size,
            self.target_count,
            self.file_names,
            error,
            hint
        )
    }
}

#[derive(Debug, Clone)]
struct AIClassificationBatchFailure {
    file_count: usize,
    message: String,
}

impl AIClassificationBatchFailure {
    fn from_context(context: &AIClassificationBatchContext, error: String) -> Self {
        Self {
            file_count: context.file_count,
            message: context.format_error(&error),
        }
    }
}

fn call_ai_classification_provider_with_retries(
    provider: &dyn AIProvider,
    settings: &AISettings,
    targets: &[IndexedFileRow],
    learned_rules: &[String],
    retry_json_only: bool,
    _batch_context: &AIClassificationBatchContext,
) -> Result<String, String> {
    let mut last_error = String::new();
    for attempt in 0..=AI_CLASSIFICATION_TRANSIENT_RETRIES {
        match call_ai_classification_provider(
            provider,
            settings,
            targets,
            learned_rules,
            retry_json_only,
        ) {
            Ok(content) => return Ok(content),
            Err(error) => {
                let should_retry = is_transient_provider_error(&error)
                    && attempt < AI_CLASSIFICATION_TRANSIENT_RETRIES;
                last_error = error;
                if should_retry {
                    ai_classification_retry_sleep(attempt);
                    continue;
                }
                break;
            }
        }
    }
    Err(last_error)
}

fn is_transient_provider_error(error: &str) -> bool {
    let normalized = error.to_ascii_lowercase();
    normalized.contains("http 429")
        || normalized.contains("status 429")
        || normalized.contains("rate limit")
        || normalized.contains("too many request")
        || normalized.contains("http 500")
        || normalized.contains("http 502")
        || normalized.contains("http 503")
        || normalized.contains("status 500")
        || normalized.contains("status 502")
        || normalized.contains("status 503")
        || normalized.contains("timeout")
        || normalized.contains("timed out")
}

fn provider_error_hint(error: &str) -> &'static str {
    let normalized = error.to_ascii_lowercase();
    if normalized.contains("http 429")
        || normalized.contains("status 429")
        || normalized.contains("rate limit")
    {
        "Rate limit: 请降低 Batch Size 或稍后重试。"
    } else if normalized.contains("timeout") || normalized.contains("timed out") {
        "Timeout: 请降低 Batch Size、减少本次处理数量，或提高 Timeout Seconds。"
    } else if normalized.contains("http 400") || normalized.contains("status 400") {
        "HTTP 400: 请检查 response_format、thinking、extraBodyJson 或模型名。"
    } else if normalized.contains("http 401")
        || normalized.contains("http 403")
        || normalized.contains("status 401")
        || normalized.contains("status 403")
    {
        "请检查 API Key 或模型服务权限。"
    } else {
        ""
    }
}

#[cfg(not(test))]
fn ai_classification_retry_sleep(attempt: usize) {
    let seconds = if attempt == 0 { 1 } else { 3 };
    std::thread::sleep(std::time::Duration::from_secs(seconds));
}

#[cfg(test)]
fn ai_classification_retry_sleep(_attempt: usize) {}

fn batch_file_names(batch: &[IndexedFileRow]) -> String {
    let names = batch
        .iter()
        .take(3)
        .map(|row| row.name.replace(['\r', '\n', '[', ']'], " "))
        .collect::<Vec<_>>()
        .join(",");
    names.chars().take(200).collect()
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
    ref_id: &str,
) -> AIClassificationInputFile {
    // Stage 3 intentionally ignores send_file_content even if enabled; only metadata is sent.
    let _send_file_content_ignored = settings.send_file_content;
    AIClassificationInputFile {
        ref_id: ref_id.to_string(),
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

fn path_keys(path: &str) -> Vec<String> {
    let trimmed = trim_trailing_path_separators(path.trim());
    let normalized = normalize_path_text(trimmed);
    let normalized = trim_trailing_path_separators(&normalized).to_string();
    let mut keys = vec![normalized.clone()];
    if is_path_like(path) {
        let lower = normalized.to_lowercase();
        if lower != normalized {
            keys.push(lower);
        }
    }
    keys
}

fn is_path_like(value: &str) -> bool {
    value.contains('/')
        || value.contains('\\')
        || value.as_bytes().get(1) == Some(&b':')
        || value.starts_with("//")
        || value.starts_with("\\\\")
}

fn classification_outputs_from_value(
    value: serde_json::Value,
) -> Result<Vec<AIClassificationOutput>, String> {
    if value.is_array() {
        return classification_outputs_from_array(&value);
    }

    if let Some(classifications) = value.get("classifications") {
        return classification_outputs_from_array(classifications);
    }

    if let Some(result) = value.get("result") {
        if let Some(classifications) = result.get("classifications") {
            return classification_outputs_from_array(classifications);
        }
    }

    Err("missing classifications array".to_string())
}

fn classification_outputs_from_array(
    classifications: &serde_json::Value,
) -> Result<Vec<AIClassificationOutput>, String> {
    let Some(items) = classifications.as_array() else {
        return Err("classifications is not an array".to_string());
    };
    let mut outputs = Vec::new();
    let mut skipped_invalid_items = 0_usize;
    for item in items {
        match classification_output_from_item(item) {
            Ok(Some(output)) => outputs.push(output),
            Ok(None) => skipped_invalid_items += 1,
            Err(_) => skipped_invalid_items += 1,
        }
    }
    if outputs.is_empty() {
        return Err(
            "AI 返回了 JSON，但没有任何可应用的分类项。请减少 Batch Size 或重试。".to_string(),
        );
    }
    if skipped_invalid_items > 0 {
        for output in &mut outputs {
            output
                .item_parse_warnings
                .push(format!("skippedInvalidItems={skipped_invalid_items}"));
        }
    }
    Ok(outputs)
}

fn classification_output_from_item(
    item: &serde_json::Value,
) -> Result<Option<AIClassificationOutput>, String> {
    let Some(object) = item.as_object() else {
        return Err("classification item is not an object".to_string());
    };
    if !has_any_key(object, &["refId", "ref_id", "id"]) {
        return Ok(None);
    }

    let mut missing_optional_fields = Vec::new();
    for (field, keys) in [
        ("targetTemplate", &["targetTemplate", "target_template"][..]),
        ("suggestedName", &["suggestedName", "suggested_name"][..]),
        ("reason", &["reason"][..]),
        ("keywords", &["keywords"][..]),
        ("context", &["context"][..]),
        (
            "requiresConfirmation",
            &["requiresConfirmation", "requires_confirmation"][..],
        ),
        ("confidence", &["confidence"][..]),
    ] {
        if !has_any_key(object, keys) {
            missing_optional_fields.push(field.to_string());
        }
    }

    let mut fallback_fields = Vec::new();
    for (field, keys) in [
        ("fileType", &["fileType", "file_type"][..]),
        ("purpose", &["purpose"][..]),
        ("lifecycle", &["lifecycle"][..]),
        ("riskLevel", &["riskLevel", "risk_level"][..]),
        (
            "suggestedAction",
            &["suggestedAction", "suggested_action"][..],
        ),
    ] {
        if !has_any_key(object, keys) {
            fallback_fields.push(field.to_string());
        }
    }

    let mut output = serde_json::from_value::<AIClassificationOutput>(item.clone())
        .map_err(|error| format!("classification item schema mismatch: {error}"))?;
    output.missing_optional_fields = missing_optional_fields;
    output.fallback_applied = !fallback_fields.is_empty()
        || output
            .missing_optional_fields
            .iter()
            .any(|field| matches!(field.as_str(), "confidence" | "requiresConfirmation"));
    output.item_parse_warnings = fallback_fields
        .into_iter()
        .map(|field| format!("{field} missing; safe fallback applied"))
        .collect();
    if output.fallback_applied {
        output.requires_confirmation = true;
    }
    Ok(Some(output))
}

fn has_any_key(object: &serde_json::Map<String, serde_json::Value>, keys: &[&str]) -> bool {
    keys.iter().any(|key| object.contains_key(*key))
}

fn ai_classification_json_error(content: &str, detail: &str) -> String {
    let lower = content.to_ascii_lowercase();
    if lower.contains("<think>") {
        return "模型返回了 thinking 内容，导致 JSON 解析失败。请关闭 Thinking，或换用非思考模型。"
            .to_string();
    }
    if lower.contains("```") {
        return "模型返回了 Markdown 代码块，Zen Canvas 已尝试提取 JSON，但结构仍不符合要求。"
            .to_string();
    }
    if detail.contains("没有任何可应用的分类项") {
        return detail.to_string();
    }
    if detail.contains("classification item schema mismatch") {
        return "AI 返回了 JSON，但部分分类项缺少字段，Zen Canvas 已尝试使用安全默认值处理。严重无效的项目会被跳过。".to_string();
    }
    format!("模型返回的内容不是 Zen Canvas 需要的 JSON 格式。已尝试清洗，但仍失败：{detail}")
}

fn is_ai_classification_schema_error(error: &str) -> bool {
    error.contains("AI 返回了 JSON")
        || error.contains("classification item schema mismatch")
        || error.contains("没有任何可应用的分类项")
}

fn default_file_type() -> String {
    "Other".to_string()
}

fn default_purpose() -> String {
    "Unknown".to_string()
}

fn default_lifecycle() -> String {
    "Inbox".to_string()
}

fn default_risk_level() -> String {
    "Unknown".to_string()
}

fn default_suggested_action() -> String {
    "Review".to_string()
}

fn default_confidence() -> f64 {
    0.5
}

fn default_requires_confirmation() -> bool {
    true
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

fn split_filename_from_target_template(
    target_template: String,
    suggested_name: String,
) -> (String, String) {
    let Some((parent, file_name)) = split_template_filename_segment(&target_template) else {
        return (target_template, suggested_name);
    };
    let safe_name = if suggested_name.trim().is_empty() {
        sanitize_suggested_name(Some(&file_name))
    } else {
        suggested_name
    };
    (parent, safe_name)
}

fn split_template_filename_segment(template: &str) -> Option<(String, String)> {
    let normalized = template.trim().replace('\\', "/");
    let (parent, last) = normalized
        .rsplit_once('/')
        .unwrap_or(("", normalized.as_str()));
    if !looks_like_file_name(last) {
        return None;
    }
    Some((parent.trim_matches('/').to_string(), last.to_string()))
}

fn looks_like_file_name(segment: &str) -> bool {
    let lower = segment.trim().to_ascii_lowercase();
    [
        ".doc", ".docx", ".pdf", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".zip", ".rar", ".7z",
        ".csv", ".md", ".png", ".jpg", ".jpeg", ".gif", ".mp4", ".mov", ".mp3",
    ]
    .iter()
    .any(|extension| lower.ends_with(extension) && lower.len() > extension.len())
}

fn ai_reason(result: &SanitizedAIClassification) -> String {
    if result.keywords.is_empty() {
        result.reason.clone()
    } else {
        format!("{} Keywords: {}", result.reason, result.keywords.join(", "))
    }
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    value.trim().chars().take(max_chars).collect()
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
        let outputs = parse_ai_classification_response(&valid_response("file-1", "Move", "Normal"))
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
    fn thinking_wrapped_json_parses() {
        let content = format!(
            "<think>I should inspect the file name first.</think>\n{}",
            valid_response("file-1", "Move", "Normal")
        );
        let outputs = parse_ai_classification_response(&content).expect("strip thinking");
        assert_eq!(outputs[0].id, "file-1");
    }

    #[test]
    fn direct_array_json_parses() {
        let content = r#"[{"id":"file-1","fileType":"Document","purpose":"Teaching","lifecycle":"Active","context":"Scala","riskLevel":"Normal","suggestedAction":"Move","targetTemplate":"Teaching/Scala/试卷","suggestedName":"","confidence":0.92,"reason":"文件名包含 Scala、期末、复习题，判断为教学考试资料。","keywords":["Scala"],"requiresConfirmation":false}]"#;
        let outputs = parse_ai_classification_response(content).expect("parse direct array");
        assert_eq!(outputs[0].id, "file-1");
    }

    #[test]
    fn nested_result_classifications_parses() {
        let content = r#"{"result":{"classifications":[{"id":"file-1","fileType":"Document","purpose":"Teaching","lifecycle":"Active","context":"Scala","riskLevel":"Normal","suggestedAction":"Move","targetTemplate":"Teaching/Scala/试卷","suggestedName":"","confidence":0.92,"reason":"文件名包含 Scala、期末、复习题，判断为教学考试资料。","keywords":["Scala"],"requiresConfirmation":false}]}}"#;
        let outputs =
            parse_ai_classification_response(content).expect("parse result.classifications");
        assert_eq!(outputs[0].id, "file-1");
    }

    #[test]
    fn classification_item_missing_target_template_defaults_empty() {
        let outputs = parse_ai_classification_response(
            r#"{"classifications":[{"refId":"f1","fileType":"Document","purpose":"Teaching","lifecycle":"Active","context":"Scala","riskLevel":"Normal","suggestedAction":"Move","suggestedName":"","confidence":0.92,"reason":"ok","keywords":["Scala"],"requiresConfirmation":false}]}"#,
        )
        .expect("parse missing targetTemplate");

        assert_eq!(outputs[0].target_template, "");
        assert!(outputs[0]
            .missing_optional_fields
            .contains(&"targetTemplate".to_string()));
    }

    #[test]
    fn classification_item_missing_suggested_name_defaults_empty() {
        let outputs = parse_ai_classification_response(
            r#"{"classifications":[{"refId":"f1","fileType":"Document","purpose":"Teaching","lifecycle":"Active","context":"Scala","riskLevel":"Normal","suggestedAction":"Review","targetTemplate":"","confidence":0.92,"reason":"ok","keywords":["Scala"],"requiresConfirmation":true}]}"#,
        )
        .expect("parse missing suggestedName");

        assert_eq!(outputs[0].suggested_name.as_deref(), None);
        assert!(outputs[0]
            .missing_optional_fields
            .contains(&"suggestedName".to_string()));
    }

    #[test]
    fn classification_item_missing_keywords_defaults_empty() {
        let outputs = parse_ai_classification_response(
            r#"{"classifications":[{"refId":"f1","fileType":"Document","purpose":"Teaching","lifecycle":"Active","context":"Scala","riskLevel":"Normal","suggestedAction":"Review","targetTemplate":"","suggestedName":"","confidence":0.92,"reason":"ok","requiresConfirmation":true}]}"#,
        )
        .expect("parse missing keywords");

        assert!(outputs[0].keywords.is_empty());
    }

    #[test]
    fn classification_item_missing_reason_defaults_empty() {
        let outputs = parse_ai_classification_response(
            r#"{"classifications":[{"refId":"f1","fileType":"Document","purpose":"Teaching","lifecycle":"Active","context":"Scala","riskLevel":"Normal","suggestedAction":"Review","targetTemplate":"","suggestedName":"","confidence":0.92,"keywords":["Scala"],"requiresConfirmation":true}]}"#,
        )
        .expect("parse missing reason");

        assert_eq!(outputs[0].reason, "");
    }

    #[test]
    fn classification_item_missing_confidence_defaults_half_and_requires_confirmation() {
        let outputs = parse_ai_classification_response(
            r#"{"classifications":[{"refId":"f1","fileType":"Document","purpose":"Teaching","lifecycle":"Active","context":"Scala","riskLevel":"Normal","suggestedAction":"Review","targetTemplate":"","suggestedName":"","reason":"ok","keywords":["Scala"],"requiresConfirmation":false}]}"#,
        )
        .expect("parse missing confidence");

        assert_eq!(outputs[0].confidence, 0.5);
        assert!(outputs[0].requires_confirmation);
        assert!(outputs[0].fallback_applied);
    }

    #[test]
    fn classification_item_missing_suggested_action_falls_back_review() {
        let outputs = parse_ai_classification_response(
            r#"{"classifications":[{"refId":"f1","fileType":"Document","purpose":"Teaching","lifecycle":"Active","context":"Scala","riskLevel":"Normal","targetTemplate":"","suggestedName":"","confidence":0.92,"reason":"ok","keywords":["Scala"],"requiresConfirmation":false}]}"#,
        )
        .expect("parse missing suggestedAction");

        assert_eq!(outputs[0].suggested_action, "Review");
        assert!(outputs[0].requires_confirmation);
        assert!(outputs[0].fallback_applied);
    }

    #[test]
    fn classification_item_missing_file_type_falls_back_other() {
        let outputs = parse_ai_classification_response(
            r#"{"classifications":[{"refId":"f1","purpose":"Teaching","lifecycle":"Active","context":"Scala","riskLevel":"Normal","suggestedAction":"Review","targetTemplate":"","suggestedName":"","confidence":0.92,"reason":"ok","keywords":["Scala"],"requiresConfirmation":false}]}"#,
        )
        .expect("parse missing fileType");

        assert_eq!(outputs[0].file_type, "Other");
        assert!(outputs[0].requires_confirmation);
        assert!(outputs[0].fallback_applied);
    }

    #[test]
    fn classification_item_missing_ref_id_and_id_is_skipped() {
        let error = parse_ai_classification_response(
            r#"{"classifications":[{"fileType":"Document","purpose":"Teaching","lifecycle":"Active","context":"Scala","riskLevel":"Normal","suggestedAction":"Review","targetTemplate":"","suggestedName":"","confidence":0.92,"reason":"ok","keywords":["Scala"],"requiresConfirmation":true}]}"#,
        )
        .expect_err("no applicable items");

        assert!(error.contains("没有任何可应用的分类项"));
    }

    #[test]
    fn batch_with_invalid_item_still_parses_valid_item() {
        let outputs = parse_ai_classification_response(
            r#"{"classifications":[{"fileType":"Document","purpose":"Teaching","lifecycle":"Active","context":"Scala","riskLevel":"Normal","suggestedAction":"Review","targetTemplate":"","suggestedName":"","confidence":0.92,"reason":"missing id","keywords":["Scala"],"requiresConfirmation":true},{"refId":"f1","fileType":"Document","purpose":"Teaching","lifecycle":"Active","context":"Scala","riskLevel":"Normal","suggestedAction":"Move","suggestedName":"","confidence":0.92,"reason":"ok","keywords":["Scala"],"requiresConfirmation":false}]}"#,
        )
        .expect("parse valid item");

        assert_eq!(outputs.len(), 1);
        assert_eq!(outputs[0].ref_id.as_deref(), Some("f1"));
        assert!(outputs[0]
            .item_parse_warnings
            .iter()
            .any(|warning| warning == "skippedInvalidItems=1"));
    }

    #[test]
    fn empty_target_template_with_move_downgrades_to_review() {
        let requested = requested_ids(&["file-1"]);
        let output = parse_ai_classification_response(
            r#"{"classifications":[{"id":"file-1","fileType":"Document","purpose":"Teaching","lifecycle":"Active","context":"Scala","riskLevel":"Normal","suggestedAction":"Move","suggestedName":"","confidence":0.92,"reason":"ok","keywords":["Scala"],"requiresConfirmation":false}]}"#,
        )
        .expect("parse missing targetTemplate")
        .remove(0);

        let sanitized = sanitize_ai_classification_result(output, &requested).expect("sanitize");
        assert_eq!(sanitized.suggested_action, "Review");
        assert!(sanitized.requires_confirmation);
    }

    #[test]
    fn schema_error_message_does_not_suggest_disabling_thinking() {
        let error = parse_ai_classification_response(
            r#"{"classifications":[{"fileType":"Document","purpose":"Teaching"}]}"#,
        )
        .expect_err("no applicable items");

        assert!(!error.contains("关闭 Thinking"));
        assert!(!error.contains("非思考模型"));
        assert!(error.contains("没有任何可应用的分类项"));
    }

    #[test]
    fn invalid_json_retries_once_then_writes_valid_result() {
        let db = test_db();
        insert_test_file(&db, "file-1", "/tmp/Scala期末复习题.pdf");
        let settings = enabled_settings();
        let targets = collect_selected_ai_classification_targets(&db, &["file-1".to_string()])
            .expect("collect targets");
        let provider = SequenceProvider::new(vec![
            Ok("not json".to_string()),
            Ok(valid_response("file-1", "Move", "Normal").to_string()),
        ]);

        let summary =
            classify_ai_targets_with_provider(&db, targets, &settings, &provider, &[], None)
                .expect("retry and classify");

        assert_eq!(summary.updated, 1);
        assert_eq!(provider.call_count(), 2);
    }

    #[test]
    fn collect_targets_default_limit_is_100_and_not_batch_size() {
        let db = test_db();
        for index in 0..120 {
            insert_test_file(
                &db,
                &format!("file-{index}"),
                &format!("/tmp/ai-default-limit-{index}.pdf"),
            );
        }
        let settings = AISettings {
            batch_size: 20,
            ..enabled_settings()
        };

        let targets = collect_ai_classification_targets(&db, &LibraryScope::All, None, &settings)
            .expect("collect targets");

        assert_eq!(targets.len(), 100);
    }

    #[test]
    fn collect_targets_respects_explicit_limit() {
        let db = test_db();
        for index in 0..120 {
            insert_test_file(
                &db,
                &format!("file-{index}"),
                &format!("/tmp/ai-explicit-limit-{index}.pdf"),
            );
        }
        let settings = AISettings {
            batch_size: 20,
            ..enabled_settings()
        };
        let options = AIClassificationOptions {
            only_unclassified: None,
            only_low_confidence: None,
            limit: Some(100),
            force: None,
            allow_overwrite_user_corrections: None,
        };

        let targets =
            collect_ai_classification_targets(&db, &LibraryScope::All, Some(&options), &settings)
                .expect("collect targets");

        assert_eq!(targets.len(), 100);
    }

    #[test]
    fn collect_targets_skips_stable_ai_classification_unless_forced() {
        let db = test_db();
        insert_test_file(&db, "file-1", "/tmp/ai-stable.pdf");
        mark_classified(
            &db,
            "file-1",
            r#"["ai:deepseek:deepseek-v4-flash"]"#,
            false,
        );
        let settings = enabled_settings();
        let default_options = AIClassificationOptions {
            only_unclassified: Some(false),
            only_low_confidence: Some(false),
            limit: None,
            force: Some(false),
            allow_overwrite_user_corrections: None,
        };
        let force_options = AIClassificationOptions {
            force: Some(true),
            ..default_options.clone()
        };

        let default_targets = collect_ai_classification_targets(
            &db,
            &LibraryScope::All,
            Some(&default_options),
            &settings,
        )
        .expect("collect default targets");
        let force_targets =
            collect_ai_classification_targets(&db, &LibraryScope::All, Some(&force_options), &settings)
                .expect("collect forced targets");

        assert!(default_targets.is_empty());
        assert_eq!(force_targets.len(), 1);
    }

    #[test]
    fn collect_targets_protects_user_corrections_even_when_forced() {
        let db = test_db();
        insert_test_file(&db, "file-1", "/tmp/user-corrected.pdf");
        mark_classified(&db, "file-1", r#"["user_correction"]"#, false);
        let settings = enabled_settings();
        let options = AIClassificationOptions {
            only_unclassified: Some(false),
            only_low_confidence: Some(false),
            limit: None,
            force: Some(true),
            allow_overwrite_user_corrections: None,
        };

        let targets =
            collect_ai_classification_targets(&db, &LibraryScope::All, Some(&options), &settings)
                .expect("collect targets");

        assert!(targets.is_empty());
    }

    #[test]
    fn collect_targets_protects_user_confirmed_even_when_forced() {
        let db = test_db();
        insert_test_file(&db, "file-1", "/tmp/user-confirmed.pdf");
        mark_classified(&db, "file-1", r#"["ai:deepseek:model","user_confirmed"]"#, false);
        let settings = enabled_settings();
        let options = AIClassificationOptions {
            only_unclassified: Some(false),
            only_low_confidence: Some(false),
            limit: None,
            force: Some(true),
            allow_overwrite_user_corrections: None,
        };

        let targets =
            collect_ai_classification_targets(&db, &LibraryScope::All, Some(&options), &settings)
                .expect("collect targets");

        assert!(targets.is_empty());
    }

    #[test]
    fn collect_targets_allows_user_correction_overwrite_only_when_explicit() {
        let db = test_db();
        insert_test_file(&db, "file-1", "/tmp/user-corrected-override.pdf");
        mark_classified(&db, "file-1", r#"["user_correction"]"#, false);
        let settings = enabled_settings();
        let options = AIClassificationOptions {
            only_unclassified: Some(false),
            only_low_confidence: Some(false),
            limit: None,
            force: Some(true),
            allow_overwrite_user_corrections: Some(true),
        };

        let targets =
            collect_ai_classification_targets(&db, &LibraryScope::All, Some(&options), &settings)
                .expect("collect targets");

        assert_eq!(targets.len(), 1);
    }

    #[test]
    fn collect_targets_skips_classified_unchanged_confirmed_files_by_default() {
        let db = test_db();
        insert_test_file(&db, "file-1", "/tmp/classified-stable.pdf");
        mark_classified(&db, "file-1", r#"[]"#, false);
        let settings = enabled_settings();
        let options = AIClassificationOptions {
            only_unclassified: Some(false),
            only_low_confidence: Some(false),
            limit: None,
            force: Some(false),
            allow_overwrite_user_corrections: None,
        };

        let targets =
            collect_ai_classification_targets(&db, &LibraryScope::All, Some(&options), &settings)
                .expect("collect targets");

        assert!(targets.is_empty());
    }

    #[test]
    fn batch_size_only_controls_provider_chunks() {
        let db = test_db();
        for index in 0..5 {
            insert_test_file(
                &db,
                &format!("file-{index}"),
                &format!("/tmp/ai-batch-size-{index}.pdf"),
            );
        }
        let settings = AISettings {
            batch_size: 2,
            ..enabled_settings()
        };
        let targets = collect_ai_classification_targets(&db, &LibraryScope::All, None, &settings)
            .expect("collect targets");
        let provider = SequenceProvider::new(vec![
            Ok(valid_ref_response("f1")),
            Ok(valid_ref_response("f1")),
            Ok(valid_ref_response("f1")),
        ]);

        let summary =
            classify_ai_targets_with_provider(&db, targets, &settings, &provider, &[], None)
                .expect("classify all targets");

        assert_eq!(summary.scanned, 5);
        assert_eq!(summary.updated, 3);
        assert_eq!(provider.call_count(), 3);
    }

    #[test]
    fn one_successful_batch_and_one_failed_batch_returns_partial_summary() {
        let db = test_db();
        for index in 0..4 {
            insert_test_file(
                &db,
                &format!("file-{index}"),
                &format!("/tmp/ai-partial-batch-{index}.pdf"),
            );
        }
        let settings = AISettings {
            batch_size: 2,
            ..enabled_settings()
        };
        let targets = collect_ai_classification_targets(&db, &LibraryScope::All, None, &settings)
            .expect("collect targets");
        let provider = SequenceProvider::new(vec![
            Ok(valid_ref_response("f1")),
            Err(AIProviderError::new("HTTP 429 rate limit")),
            Err(AIProviderError::new("HTTP 429 rate limit")),
            Err(AIProviderError::new("HTTP 429 rate limit")),
        ]);

        let summary =
            classify_ai_targets_with_provider(&db, targets, &settings, &provider, &[], None)
                .expect("partial success should return summary");

        assert_eq!(summary.scanned, 4);
        assert_eq!(summary.updated, 1);
        assert_eq!(summary.skipped, 3);
        assert_eq!(summary.failed_batches, Some(1));
        assert_eq!(summary.failed_files, Some(2));
        assert!(summary
            .warning
            .as_deref()
            .unwrap_or_default()
            .contains("部分批次请求失败"));
        assert_eq!(provider.call_count(), 4);
    }

    #[test]
    fn all_failed_batches_return_batch_context_error() {
        let db = test_db();
        for index in 0..2 {
            insert_test_file(
                &db,
                &format!("file-{index}"),
                &format!("/tmp/ai-all-fail-{index}.pdf"),
            );
        }
        let settings = AISettings {
            batch_size: 2,
            ..enabled_settings()
        };
        let targets = collect_ai_classification_targets(&db, &LibraryScope::All, None, &settings)
            .expect("collect targets");
        let provider = SequenceProvider::new(vec![
            Err(AIProviderError::new("HTTP 429 rate limit ai-secret-key")),
            Err(AIProviderError::new("HTTP 429 rate limit ai-secret-key")),
            Err(AIProviderError::new("HTTP 429 rate limit ai-secret-key")),
        ]);

        let error =
            classify_ai_targets_with_provider(&db, targets, &settings, &provider, &[], None)
                .expect_err("all batches should fail");

        assert!(error.contains("batch 1/1"));
        assert!(error.contains("batchSize=2"));
        assert!(error.contains("targetCount=2"));
        assert!(error.contains("HTTP 429"));
        assert!(error.contains("降低 Batch Size"));
        assert!(!error.contains("ai-secret-key"));
        assert_eq!(provider.call_count(), 3);
    }

    #[test]
    fn http_400_provider_error_is_not_retried() {
        let db = test_db();
        insert_test_file(&db, "file-1", "/tmp/ai-http-400.pdf");
        let settings = AISettings {
            batch_size: 1,
            ..enabled_settings()
        };
        let targets = collect_ai_classification_targets(&db, &LibraryScope::All, None, &settings)
            .expect("collect targets");
        let provider =
            SequenceProvider::new(vec![Err(AIProviderError::new("HTTP 400 invalid request"))]);

        let error =
            classify_ai_targets_with_provider(&db, targets, &settings, &provider, &[], None)
                .expect_err("bad request should fail");

        assert!(error.contains("HTTP 400"));
        assert!(error.contains("response_format"));
        assert_eq!(provider.call_count(), 1);
    }

    #[test]
    fn http_500_provider_error_retries_twice() {
        let db = test_db();
        insert_test_file(&db, "file-1", "/tmp/ai-http-500.pdf");
        let settings = AISettings {
            batch_size: 1,
            ..enabled_settings()
        };
        let targets = collect_ai_classification_targets(&db, &LibraryScope::All, None, &settings)
            .expect("collect targets");
        let provider = SequenceProvider::new(vec![
            Err(AIProviderError::new("HTTP 500 provider unavailable")),
            Err(AIProviderError::new("HTTP 500 provider unavailable")),
            Err(AIProviderError::new("HTTP 500 provider unavailable")),
        ]);

        let _ = classify_ai_targets_with_provider(&db, targets, &settings, &provider, &[], None)
            .expect_err("server error should fail after retries");

        assert_eq!(provider.call_count(), 3);
    }

    #[test]
    fn timeout_provider_error_retries_twice() {
        let db = test_db();
        insert_test_file(&db, "file-1", "/tmp/ai-timeout.pdf");
        let settings = AISettings {
            batch_size: 1,
            ..enabled_settings()
        };
        let targets = collect_ai_classification_targets(&db, &LibraryScope::All, None, &settings)
            .expect("collect targets");
        let provider = SequenceProvider::new(vec![
            Err(AIProviderError::new("request timeout")),
            Err(AIProviderError::new("request timeout")),
            Err(AIProviderError::new("request timeout")),
        ]);

        let error =
            classify_ai_targets_with_provider(&db, targets, &settings, &provider, &[], None)
                .expect_err("timeout should fail after retries");

        assert!(error.contains("Timeout"));
        assert!(error.contains("Timeout Seconds"));
        assert_eq!(provider.call_count(), 3);
    }

    #[test]
    fn ai_move_classification_generates_operation_preview() {
        let db = test_db();
        insert_test_file(&db, "file-1", "/tmp/Scala期末复习题.pdf");
        let settings = enabled_settings();
        let targets = collect_selected_ai_classification_targets(&db, &["file-1".to_string()])
            .expect("collect targets");
        let provider = StaticProvider {
            response: Ok(valid_response("file-1", "Move", "Normal").to_string()),
        };

        classify_ai_targets_with_provider(&db, targets, &settings, &provider, &[], None)
            .expect("classify");
        let previews = db
            .get_operation_previews_for_scope(&LibraryScope::All, None, None, None)
            .expect("operation previews");

        assert_eq!(previews.total, 1);
        assert_eq!(previews.previews.len(), 1);
        assert_eq!(previews.previews[0].suggested_action, "Move");
    }

    #[test]
    fn target_template_without_file_name_builds_normal_preview_path() {
        let db = test_db();
        insert_test_file(&db, "file-1", "/tmp/企业实践总结-舒智超.docx");
        let settings = enabled_settings();
        let targets = collect_selected_ai_classification_targets(&db, &["file-1".to_string()])
            .expect("collect targets");
        let provider = StaticProvider {
            response: Ok(valid_id_response_with_target(
                "file-1",
                "Work/企业实践总结",
                "",
            )),
        };

        classify_ai_targets_with_provider(&db, targets, &settings, &provider, &[], None)
            .expect("classify");
        let previews = db
            .get_operation_previews_for_scope(&LibraryScope::All, None, None, None)
            .expect("operation previews");

        assert_eq!(previews.total, 1);
        assert!(previews.previews[0]
            .target_path
            .ends_with("Work/企业实践总结/企业实践总结-舒智超.docx"));
        assert!(!previews.previews[0]
            .target_path
            .contains(".docx/企业实践总结-舒智超"));
    }

    #[test]
    fn target_template_with_file_name_is_split_before_preview_path() {
        let db = test_db();
        insert_test_file(&db, "file-1", "/tmp/企业实践总结-舒智超.docx");
        let settings = enabled_settings();
        let targets = collect_selected_ai_classification_targets(&db, &["file-1".to_string()])
            .expect("collect targets");
        let provider = StaticProvider {
            response: Ok(valid_id_response_with_target(
                "file-1",
                "Work/企业实践总结/企业实践总结-舒智超.docx",
                "",
            )),
        };

        classify_ai_targets_with_provider(&db, targets, &settings, &provider, &[], None)
            .expect("classify");
        let previews = db
            .get_operation_previews_for_scope(&LibraryScope::All, None, None, None)
            .expect("operation previews");

        assert_eq!(previews.total, 1);
        assert!(previews.previews[0]
            .target_path
            .ends_with("Work/企业实践总结/企业实践总结-舒智超.docx"));
        assert!(!previews.previews[0].target_path.contains(".docx/"));
    }

    #[test]
    fn ai_review_classification_does_not_generate_operation_preview() {
        let db = test_db();
        insert_test_file(&db, "file-1", "/tmp/Scala期末复习题.pdf");
        let settings = enabled_settings();
        let targets = collect_selected_ai_classification_targets(&db, &["file-1".to_string()])
            .expect("collect targets");
        let provider = StaticProvider {
            response: Ok(valid_response("file-1", "Review", "Normal").to_string()),
        };

        classify_ai_targets_with_provider(&db, targets, &settings, &provider, &[], None)
            .expect("classify");
        let previews = db
            .get_operation_previews_for_scope(&LibraryScope::All, None, None, None)
            .expect("operation previews");

        assert_eq!(previews.total, 0);
        assert!(previews.previews.is_empty());
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

        let error =
            classify_ai_targets_with_provider(&db, targets, &settings, &provider, &[], None)
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

        let summary =
            classify_ai_targets_with_provider(&db, targets, &settings, &provider, &[], None)
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
    fn batch_with_invalid_item_still_writes_valid_classification() {
        let db = test_db();
        insert_test_file(&db, "real-file-1", "/tmp/Scala期末复习题.pdf");
        let settings = enabled_settings();
        let targets = collect_selected_ai_classification_targets(&db, &["real-file-1".to_string()])
            .expect("collect targets");
        let provider = StaticProvider {
            response: Ok(format!(
                r#"{{"classifications":[{{"fileType":"Document","purpose":"Teaching"}},{}]}}"#,
                valid_ref_item("f1")
            )),
        };

        let summary =
            classify_ai_targets_with_provider(&db, targets, &settings, &provider, &[], None)
                .expect("classify valid item");

        assert_eq!(summary.updated, 1);
        assert_eq!(file_status(&db, "real-file-1"), "classified");
    }

    #[test]
    fn ai_response_ref_id_maps_to_real_file_id() {
        let db = test_db();
        insert_test_file(&db, "real-file-1", "/tmp/Scala期末复习题.pdf");
        let settings = enabled_settings();
        let targets = collect_selected_ai_classification_targets(&db, &["real-file-1".to_string()])
            .expect("collect targets");
        let provider = StaticProvider {
            response: Ok(valid_ref_response("f1").to_string()),
        };

        let summary =
            classify_ai_targets_with_provider(&db, targets, &settings, &provider, &[], None)
                .expect("classify");

        assert_eq!(summary.updated, 1);
        assert_eq!(file_status(&db, "real-file-1"), "classified");
    }

    #[test]
    fn ai_response_id_can_compatibly_be_ref_id() {
        let db = test_db();
        insert_test_file(&db, "real-file-1", "/tmp/Scala期末复习题.pdf");
        let settings = enabled_settings();
        let targets = collect_selected_ai_classification_targets(&db, &["real-file-1".to_string()])
            .expect("collect targets");
        let provider = StaticProvider {
            response: Ok(valid_id_response("f1")),
        };

        let summary =
            classify_ai_targets_with_provider(&db, targets, &settings, &provider, &[], None)
                .expect("classify");

        assert_eq!(summary.updated, 1);
        assert_eq!(file_status(&db, "real-file-1"), "classified");
    }

    #[test]
    fn ai_response_id_can_compatibly_be_real_file_id() {
        let db = test_db();
        insert_test_file(&db, "real-file-1", "/tmp/Scala期末复习题.pdf");
        let settings = enabled_settings();
        let targets = collect_selected_ai_classification_targets(&db, &["real-file-1".to_string()])
            .expect("collect targets");
        let provider = StaticProvider {
            response: Ok(valid_id_response("real-file-1")),
        };

        let summary =
            classify_ai_targets_with_provider(&db, targets, &settings, &provider, &[], None)
                .expect("classify");

        assert_eq!(summary.updated, 1);
        assert_eq!(file_status(&db, "real-file-1"), "classified");
    }

    #[test]
    fn ai_response_id_can_fallback_match_path() {
        let db = test_db();
        insert_test_file(
            &db,
            "real-file-1",
            "D:/Install_Package/Scala编程基础期末复习题.docx",
        );
        let settings = enabled_settings();
        let targets = collect_selected_ai_classification_targets(&db, &["real-file-1".to_string()])
            .expect("collect targets");
        let provider = StaticProvider {
            response: Ok(valid_id_response(
                "D:/Install_Package/Scala编程基础期末复习题.docx",
            )),
        };

        let summary =
            classify_ai_targets_with_provider(&db, targets, &settings, &provider, &[], None)
                .expect("classify");

        assert_eq!(summary.updated, 1);
        assert_eq!(file_status(&db, "real-file-1"), "classified");
    }

    #[test]
    fn ai_response_unknown_id_is_rejected() {
        let db = test_db();
        insert_test_file(&db, "real-file-1", "/tmp/Scala期末复习题.pdf");
        let settings = enabled_settings();
        let targets = collect_selected_ai_classification_targets(&db, &["real-file-1".to_string()])
            .expect("collect targets");
        let provider = StaticProvider {
            response: Ok(valid_id_response("unknown")),
        };

        let summary =
            classify_ai_targets_with_provider(&db, targets, &settings, &provider, &[], None)
                .expect("classify");

        assert_eq!(summary.updated, 0);
        assert_eq!(file_status(&db, "real-file-1"), "unclassified");
    }

    #[test]
    fn ai_response_duplicate_ref_id_applies_once() {
        let db = test_db();
        insert_test_file(&db, "real-file-1", "/tmp/Scala期末复习题.pdf");
        let settings = enabled_settings();
        let targets = collect_selected_ai_classification_targets(&db, &["real-file-1".to_string()])
            .expect("collect targets");
        let provider = StaticProvider {
            response: Ok(format!(
                r#"{{"classifications":[{},{}]}}"#,
                valid_ref_item("f1"),
                valid_ref_item("f1")
            )),
        };

        let summary =
            classify_ai_targets_with_provider(&db, targets, &settings, &provider, &[], None)
                .expect("classify");

        assert_eq!(summary.updated, 1);
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

        assert!(messages[1].content.contains("用户确认/纠正形成的习惯"));
        assert!(messages[1].content.contains("Scala"));
        assert!(messages[1].content.contains("Teaching"));
        assert!(messages[1].content.contains("\"refId\": \"f1\""));
        assert!(!messages[1].content.contains("\"id\": \"file-1\""));
        assert!(messages[0]
            .content
            .contains("Return the same refId exactly"));
        assert!(messages[0].content.contains("Do not use path as id"));
    }

    fn assert_target_template_rejected(template: &str) {
        let requested = requested_ids(&["file-1"]);
        let mut output = valid_output("file-1");
        output.target_template = template.to_string();
        assert!(sanitize_ai_classification_result(output, &requested).is_err());
    }

    fn requested_ids(ids: &[&str]) -> AIClassificationIdMap {
        let mut entries = Vec::new();
        let mut ref_to_id = HashMap::new();
        let mut real_ids = HashSet::new();
        let mut path_to_id = HashMap::new();
        for (index, id) in ids.iter().enumerate() {
            let ref_id = format!("f{}", index + 1);
            let path = format!("/tmp/{id}.pdf");
            entries.push(AIClassificationIdEntry {
                ref_id: ref_id.clone(),
                real_file_id: (*id).to_string(),
                path: path.clone(),
            });
            ref_to_id.insert(ref_id, (*id).to_string());
            real_ids.insert((*id).to_string());
            for key in path_keys(&path) {
                path_to_id.insert(key, (*id).to_string());
            }
        }
        AIClassificationIdMap {
            entries,
            ref_to_id,
            real_ids,
            path_to_id,
        }
    }

    fn valid_response(id: &str, suggested_action: &str, risk_level: &str) -> String {
        match (id, suggested_action, risk_level) {
            ("file-1", "Move", "Normal") => {
                r#"{"classifications":[{"id":"file-1","fileType":"Document","purpose":"Teaching","lifecycle":"Active","context":"Scala","riskLevel":"Normal","suggestedAction":"Move","targetTemplate":"Teaching/Scala/试卷","suggestedName":"","confidence":0.92,"reason":"文件名包含 Scala、期末、复习题，判断为教学考试资料。","keywords":["Scala","期末","复习题"],"requiresConfirmation":false}]}"#.to_string()
            }
            ("file-1", "Review", "Normal") => {
                r#"{"classifications":[{"id":"file-1","fileType":"Document","purpose":"Teaching","lifecycle":"Active","context":"Scala","riskLevel":"Normal","suggestedAction":"Review","targetTemplate":"","suggestedName":"","confidence":0.72,"reason":"需要人工确认。","keywords":["Scala"],"requiresConfirmation":true}]}"#.to_string()
            }
            _ => panic!("unexpected fixture"),
        }
    }

    fn valid_ref_response(ref_id: &str) -> String {
        format!(r#"{{"classifications":[{}]}}"#, valid_ref_item(ref_id))
    }

    fn valid_id_response(id: &str) -> String {
        format!(
            r#"{{"classifications":[{{"id":"{id}","fileType":"Document","purpose":"Teaching","lifecycle":"Active","context":"Scala","riskLevel":"Normal","suggestedAction":"Move","targetTemplate":"Teaching/Scala/试卷","suggestedName":"","confidence":0.92,"reason":"文件名包含 Scala、期末、复习题，判断为教学考试资料。","keywords":["Scala","期末","复习题"],"requiresConfirmation":false}}]}}"#
        )
    }

    fn valid_id_response_with_target(
        id: &str,
        target_template: &str,
        suggested_name: &str,
    ) -> String {
        format!(
            r#"{{"classifications":[{{"id":"{id}","fileType":"Document","purpose":"Work","lifecycle":"Active","context":"企业实践","riskLevel":"Normal","suggestedAction":"Move","targetTemplate":"{target_template}","suggestedName":"{suggested_name}","confidence":0.92,"reason":"工作文档。","keywords":["企业实践"],"requiresConfirmation":false}}]}}"#
        )
    }

    fn valid_ref_item(ref_id: &str) -> String {
        format!(
            r#"{{"refId":"{ref_id}","fileType":"Document","purpose":"Teaching","lifecycle":"Active","context":"Scala","riskLevel":"Normal","suggestedAction":"Move","targetTemplate":"Teaching/Scala/试卷","suggestedName":"","confidence":0.92,"reason":"文件名包含 Scala、期末、复习题，判断为教学考试资料。","keywords":["Scala","期末","复习题"],"requiresConfirmation":false}}"#
        )
    }

    fn valid_output(id: &str) -> AIClassificationOutput {
        parse_ai_classification_response(&valid_response(id, "Move", "Normal"))
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

    fn mark_classified(
        db: &Database,
        id: &str,
        matched_rules: &str,
        requires_confirmation: bool,
    ) {
        let conn = Connection::open(db.path()).expect("open db");
        conn.execute(
            r#"
            UPDATE files
            SET classification_status = 'classified',
                matched_rules = ?2,
                requires_confirmation = ?3,
                last_classified_at = 1700000001,
                last_classified_mtime = mtime,
                last_classified_size = size
            WHERE id = ?1
            "#,
            params![id, matched_rules, i64::from(requires_confirmation)],
        )
        .expect("mark classified");
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

    struct SequenceProvider {
        responses: std::sync::Mutex<Vec<Result<String, AIProviderError>>>,
        calls: std::sync::atomic::AtomicUsize,
    }

    impl SequenceProvider {
        fn new(responses: Vec<Result<String, AIProviderError>>) -> Self {
            Self {
                responses: std::sync::Mutex::new(responses.into_iter().rev().collect()),
                calls: std::sync::atomic::AtomicUsize::new(0),
            }
        }

        fn call_count(&self) -> usize {
            self.calls.load(std::sync::atomic::Ordering::SeqCst)
        }
    }

    impl AIProvider for SequenceProvider {
        fn chat_json(&self, _request: AIChatRequest) -> Result<String, AIProviderError> {
            self.calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            self.responses
                .lock()
                .expect("responses")
                .pop()
                .unwrap_or_else(|| Err(AIProviderError::new("no response")))
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
