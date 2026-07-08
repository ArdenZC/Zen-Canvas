use std::time::Instant;

use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

use super::{
    ollama::OllamaProvider,
    openai_compatible::OpenAICompatibleProvider,
    presets::{all_provider_presets, provider_preset, AIProviderPreset},
    provider::AIProvider,
    schema::{AIConnectionTestResult, AIProviderKind, AIProviderPresetId},
};
use crate::db::{Database, DbError};

pub const AI_SETTINGS_KEY: &str = "ai_settings_v1";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AISettings {
    pub enabled: bool,
    pub provider: AIProviderKind,
    pub preset: AIProviderPresetId,
    pub base_url: String,
    pub chat_path: String,
    pub api_key: String,
    pub model: String,
    pub temperature: f32,
    pub max_tokens: u32,
    pub batch_size: usize,
    pub timeout_seconds: u64,
    pub send_full_path: bool,
    pub send_parent_path: bool,
    pub send_file_content: bool,
    pub classification_mode: String,
    pub cleanup_ai_enabled: bool,
    pub force_json_output: bool,
    pub enable_thinking: bool,
    pub reasoning_effort: Option<String>,
    pub extra_body_json: Option<String>,
}

impl Default for AISettings {
    fn default() -> Self {
        Self {
            enabled: false,
            provider: AIProviderKind::OpenAICompatible,
            preset: AIProviderPresetId::DeepSeek,
            base_url: "https://api.deepseek.com".to_string(),
            chat_path: "/chat/completions".to_string(),
            api_key: String::new(),
            model: "deepseek-v4-flash".to_string(),
            temperature: 0.1,
            max_tokens: 2048,
            batch_size: 5,
            timeout_seconds: 120,
            send_full_path: true,
            send_parent_path: true,
            send_file_content: false,
            classification_mode: "rules_first".to_string(),
            cleanup_ai_enabled: true,
            force_json_output: true,
            enable_thinking: false,
            reasoning_effort: None,
            extra_body_json: None,
        }
    }
}

pub fn get_ai_settings_for_db(db: &Database) -> Result<AISettings, DbError> {
    let conn = db.conn()?;
    let settings_json = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            params![AI_SETTINGS_KEY],
            |row| row.get::<_, String>(0),
        )
        .optional()?;

    match settings_json {
        Some(value) => serde_json::from_str(&value)
            .map(normalize_ai_settings)
            .map_err(DbError::from),
        None => Ok(AISettings::default()),
    }
}

pub fn save_ai_settings_for_db(
    db: &Database,
    settings: &AISettings,
) -> Result<AISettings, DbError> {
    let normalized = normalize_ai_settings(settings.clone());
    let conn = db.conn()?;
    let settings_json = serde_json::to_string(&normalized)?;
    conn.execute(
        r#"
        INSERT INTO app_settings (key, value)
        VALUES (?1, ?2)
        ON CONFLICT(key) DO UPDATE SET
            value = excluded.value
        "#,
        params![AI_SETTINGS_KEY, settings_json],
    )?;
    Ok(normalized)
}

pub fn normalize_ai_settings(mut settings: AISettings) -> AISettings {
    if let Some(preset) = provider_preset(settings.preset) {
        settings.provider = preset.provider_kind;
        if settings.base_url.trim().is_empty() && !preset.default_base_url.is_empty() {
            settings.base_url = preset.default_base_url.to_string();
        }
        if settings.chat_path.trim().is_empty() {
            settings.chat_path = preset.default_chat_path.to_string();
        }
        if settings.model.trim().is_empty() && !preset.default_model.is_empty() {
            settings.model = preset.default_model.to_string();
        }
        if settings.preset == AIProviderPresetId::Ollama {
            settings.chat_path = "/api/chat".to_string();
        }
    }

    settings.base_url = settings.base_url.trim().trim_end_matches('/').to_string();
    settings.chat_path = normalize_chat_path(&settings.chat_path);
    settings.api_key = settings.api_key.trim().to_string();
    settings.model = settings.model.trim().to_string();
    settings.batch_size = settings.batch_size.max(1);
    settings.timeout_seconds = settings.timeout_seconds.max(1);
    settings.max_tokens = settings.max_tokens.max(1);
    settings.temperature = settings.temperature.clamp(0.0, 2.0);
    settings.classification_mode = match settings.classification_mode.trim() {
        "ai_first" | "rules_first" | "hybrid" => settings.classification_mode.trim().to_string(),
        _ => "rules_first".to_string(),
    };
    settings.reasoning_effort = settings
        .reasoning_effort
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string);
    settings.extra_body_json = settings
        .extra_body_json
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string);
    settings
}

pub fn test_ai_provider_connection_for_settings(
    settings: AISettings,
) -> Result<AIConnectionTestResult, String> {
    let settings = normalize_ai_settings(settings);
    let started = Instant::now();

    let mut result = match settings.provider {
        AIProviderKind::OpenAICompatible => {
            OpenAICompatibleProvider::new(settings.clone()).test_connection()
        }
        AIProviderKind::Ollama => OllamaProvider::new(settings.clone()).test_connection(),
    }
    .map_err(|error| sanitize_ai_error(error.to_string(), &settings.api_key))?;
    result.elapsed_ms = started.elapsed().as_millis();
    Ok(result)
}

#[tauri::command]
pub fn get_ai_settings(db: State<'_, Database>) -> Result<AISettings, String> {
    get_ai_settings_for_db(db.inner()).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_ai_settings(
    db: State<'_, Database>,
    settings: AISettings,
) -> Result<AISettings, String> {
    save_ai_settings_for_db(db.inner(), &settings).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_ai_provider_presets() -> Vec<AIProviderPreset> {
    all_provider_presets()
}

#[tauri::command]
pub async fn test_ai_provider_connection(
    db: State<'_, Database>,
    settings: Option<AISettings>,
) -> Result<AIConnectionTestResult, String> {
    let db = db.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let settings = match settings {
            Some(settings) => normalize_ai_settings(settings),
            None => get_ai_settings_for_db(&db).map_err(|error| error.to_string())?,
        };
        test_ai_provider_connection_for_settings(settings)
    })
    .await
    .map_err(|error| error.to_string())?
}

fn normalize_chat_path(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return "/chat/completions".to_string();
    }
    format!("/{}", trimmed.trim_start_matches('/'))
}

fn sanitize_ai_error(message: String, api_key: &str) -> String {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        message
    } else {
        message.replace(api_key, "[redacted]")
    }
}
