use serde::Serialize;
use tauri::State;

use super::{
    classification::{
        build_ai_classification_prompt, collect_selected_ai_classification_targets,
        parse_ai_classification_response,
    },
    openai_compatible::{
        debug_extract_openai_response, AIRawProviderResponse, OpenAICompatibleProvider,
    },
    prompts::clean_ai_json_text,
    schema::{AIChatRequest, AIProviderKind, AIProviderOptions, AIProviderPresetId},
    settings::{get_ai_settings_for_db, normalize_ai_settings, AISettings},
};
use crate::db::Database;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AIDebugClassificationResult {
    pub provider: AIProviderKind,
    pub preset: AIProviderPresetId,
    pub model: String,
    pub base_url: String,
    pub chat_path: String,
    pub force_json_output: bool,
    pub enable_thinking: bool,
    pub max_tokens: u32,
    pub batch_size: usize,
    pub request_used_response_format: bool,
    pub request_used_thinking_field: Option<String>,
    pub http_status: u16,
    pub provider_response_summary: String,
    pub raw_response_preview: String,
    pub message_content_preview: String,
    pub reasoning_content_preview: String,
    pub extracted_content_preview: String,
    pub cleaned_content_preview: String,
    pub parse_stage: String,
    pub parse_error: Option<String>,
    pub success: bool,
}

pub trait AIDebugRawProvider {
    fn send_raw(&self, request: AIChatRequest) -> Result<AIRawProviderResponse, String>;
}

impl AIDebugRawProvider for OpenAICompatibleProvider {
    fn send_raw(&self, request: AIChatRequest) -> Result<AIRawProviderResponse, String> {
        self.send_chat_request_raw(request)
            .map_err(|error| error.to_string())
    }
}

#[tauri::command]
pub async fn debug_ai_classification_once(
    db: State<'_, Database>,
    file_id: String,
) -> Result<AIDebugClassificationResult, String> {
    let db = db.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let settings =
            normalize_ai_settings(get_ai_settings_for_db(&db).map_err(|error| error.to_string())?);
        if settings.provider != AIProviderKind::OpenAICompatible {
            return Err(
                "AI classification debug currently supports OpenAI-compatible providers only."
                    .to_string(),
            );
        }
        let provider = OpenAICompatibleProvider::new(settings.clone());
        debug_ai_classification_once_for_db(&db, &file_id, &provider)
    })
    .await
    .map_err(|error| error.to_string())?
}

pub(crate) fn debug_ai_classification_once_for_db(
    db: &Database,
    file_id: &str,
    raw_provider: &dyn AIDebugRawProvider,
) -> Result<AIDebugClassificationResult, String> {
    let settings =
        normalize_ai_settings(get_ai_settings_for_db(db).map_err(|error| error.to_string())?);
    if !settings.enabled {
        return Err("请先在设置中启用 AI。".to_string());
    }
    let trimmed_file_id = file_id.trim();
    if trimmed_file_id.is_empty() {
        return Err("file_id is required for AI classification debug.".to_string());
    }
    let targets = collect_selected_ai_classification_targets(db, &[trimmed_file_id.to_string()])
        .map_err(|error| error.to_string())?;
    if targets.len() != 1 {
        return Err("AI classification debug requires one existing non-stale file.".to_string());
    }
    let learned_rules = db
        .learned_rule_hints(20)
        .map_err(|error| error.to_string())?
        .into_iter()
        .map(|hint| hint.summary)
        .collect::<Vec<_>>();
    let messages = build_ai_classification_prompt(&targets, &settings, &learned_rules)?;
    let raw = raw_provider
        .send_raw(AIChatRequest {
            messages,
            model: settings.model.clone(),
            temperature: settings.temperature,
            max_tokens: settings.max_tokens,
            force_json: settings.force_json_output,
            provider_options: AIProviderOptions::default(),
        })
        .map_err(|error| sanitize_debug_text(&error, &settings.api_key))?;

    Ok(build_debug_result(&settings, raw))
}

fn build_debug_result(
    settings: &AISettings,
    raw: AIRawProviderResponse,
) -> AIDebugClassificationResult {
    let response_summary = sanitize_debug_text(&raw.response_summary, &settings.api_key);
    let raw_response = sanitize_debug_text(&raw.response_text, &settings.api_key);
    let extracted = debug_extract_openai_response(&raw_response);
    let message_content = extracted.message_content.unwrap_or_default();
    let reasoning_content = extracted.reasoning_content.unwrap_or_default();
    let extracted_content = extracted.extracted_content.unwrap_or_default();
    let cleaned_content = clean_ai_json_text(&extracted_content);
    let (success, parse_stage, parse_error) = if let Some(error) = extracted.parse_error {
        (false, "raw_response_extract".to_string(), Some(error))
    } else if extracted_content.trim().is_empty() {
        (
            false,
            "message_content_extract".to_string(),
            Some("No extracted message content found.".to_string()),
        )
    } else {
        match parse_ai_classification_response(&extracted_content) {
            Ok(_) => (true, "parse_ai_classification_response".to_string(), None),
            Err(error) => (
                false,
                "parse_ai_classification_response".to_string(),
                Some(sanitize_debug_text(&error, &settings.api_key)),
            ),
        }
    };

    AIDebugClassificationResult {
        provider: settings.provider,
        preset: settings.preset,
        model: settings.model.clone(),
        base_url: settings.base_url.clone(),
        chat_path: settings.chat_path.clone(),
        force_json_output: settings.force_json_output,
        enable_thinking: settings.enable_thinking,
        max_tokens: settings.max_tokens,
        batch_size: settings.batch_size,
        request_used_response_format: raw.request_used_response_format,
        request_used_thinking_field: raw.request_used_thinking_field,
        http_status: raw.status,
        provider_response_summary: response_summary,
        raw_response_preview: debug_preview(&raw_response, 3000),
        message_content_preview: debug_preview(&message_content, 3000),
        reasoning_content_preview: debug_preview(&reasoning_content, 1000),
        extracted_content_preview: debug_preview(&extracted_content, 3000),
        cleaned_content_preview: debug_preview(&cleaned_content, 3000),
        parse_stage,
        parse_error,
        success,
    }
}

pub fn debug_preview(text: &str, limit: usize) -> String {
    if limit == 0 {
        return String::new();
    }
    let char_count = text.chars().count();
    if char_count <= limit {
        return text.to_string();
    }
    if limit <= 3 {
        return ".".repeat(limit);
    }
    let mut preview = text.chars().take(limit - 3).collect::<String>();
    preview.push_str("...");
    preview
}

fn sanitize_debug_text(text: &str, api_key: &str) -> String {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        text.to_string()
    } else {
        text.replace(api_key, "[redacted]")
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        ai::{
            debug::{debug_ai_classification_once_for_db, AIDebugRawProvider},
            openai_compatible::AIRawProviderResponse,
            schema::{AIChatRequest, AIProviderPresetId},
            settings::{save_ai_settings_for_db, AISettings},
        },
        db::{Database, InsertFileRequest},
    };
    use rusqlite::{params, Connection};
    use std::{
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn debug_classification_does_not_write_files_table() {
        let db = test_db();
        insert_test_file(&db, "file-1", "/tmp/Scala期末复习题.pdf");
        save_ai_settings_for_db(&db, &enabled_settings()).expect("save ai settings");
        let provider = StaticRawProvider {
            response: Ok(AIRawProviderResponse {
                status: 200,
                response_text:
                    r#"{"choices":[{"finish_reason":"stop","message":{"content":"not json"}}]}"#
                        .to_string(),
                request_used_response_format: false,
                request_used_thinking_field: Some("disabled".to_string()),
                response_summary: "provider response summary: has_choices=true".to_string(),
            }),
        };

        let result =
            debug_ai_classification_once_for_db(&db, "file-1", &provider).expect("debug result");

        assert!(!result.success);
        assert_eq!(result.message_content_preview, "not json");
        assert_eq!(file_status(&db, "file-1"), "unclassified");
    }

    #[test]
    fn debug_classification_redacts_api_key_from_result() {
        let db = test_db();
        insert_test_file(&db, "file-1", "/tmp/Scala期末复习题.pdf");
        save_ai_settings_for_db(&db, &enabled_settings()).expect("save ai settings");
        let provider = StaticRawProvider {
            response: Ok(AIRawProviderResponse {
                status: 200,
                response_text: r#"{"choices":[{"finish_reason":"stop","message":{"content":"secret-debug-key"}}]}"#.to_string(),
                request_used_response_format: false,
                request_used_thinking_field: Some("disabled".to_string()),
                response_summary: "provider response summary: has_choices=true".to_string(),
            }),
        };

        let result =
            debug_ai_classification_once_for_db(&db, "file-1", &provider).expect("debug result");

        let serialized = serde_json::to_string(&result).expect("serialize result");
        assert!(!serialized.contains("secret-debug-key"));
        assert!(serialized.contains("[redacted]"));
    }

    struct StaticRawProvider {
        response: Result<AIRawProviderResponse, String>,
    }

    impl AIDebugRawProvider for StaticRawProvider {
        fn send_raw(&self, _request: AIChatRequest) -> Result<AIRawProviderResponse, String> {
            self.response.clone()
        }
    }

    fn enabled_settings() -> AISettings {
        AISettings {
            enabled: true,
            api_key: "secret-debug-key".to_string(),
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
        std::env::temp_dir().join(format!("zen-canvas-ai-debug-test-{nonce}.sqlite3"))
    }
}
