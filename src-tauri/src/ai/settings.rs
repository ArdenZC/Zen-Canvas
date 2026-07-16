#[cfg(debug_assertions)]
use std::sync::{Mutex, OnceLock};
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
#[cfg(not(debug_assertions))]
const AI_CREDENTIAL_SERVICE: &str = "com.startlan.zencanvas";
#[cfg(not(debug_assertions))]
const AI_CREDENTIAL_USER: &str = "ai-api-key";
#[cfg(debug_assertions)]
static DEV_API_KEY: OnceLock<Mutex<String>> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AISettings {
    pub enabled: bool,
    pub provider: AIProviderKind,
    pub preset: AIProviderPresetId,
    pub base_url: String,
    pub chat_path: String,
    pub api_key: String,
    #[serde(default, skip_serializing)]
    pub api_key_configured: bool,
    pub model: String,
    pub temperature: f32,
    pub max_tokens: u32,
    pub batch_size: usize,
    pub classification_concurrency: usize,
    pub timeout_seconds: u64,
    pub send_full_path: bool,
    pub send_parent_path: bool,
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
            api_key_configured: false,
            model: "deepseek-v4-flash".to_string(),
            temperature: 0.0,
            max_tokens: 1024,
            batch_size: 10,
            classification_concurrency: 2,
            timeout_seconds: 120,
            send_full_path: false,
            send_parent_path: true,
            classification_mode: "ai_first".to_string(),
            cleanup_ai_enabled: true,
            force_json_output: false,
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

    let mut settings = match settings_json {
        Some(value) => serde_json::from_str(&value)
            .map(normalize_ai_settings)
            .map_err(DbError::from)?,
        None => AISettings::default(),
    };
    if !settings.api_key.is_empty() {
        store_api_key(&settings.api_key).map_err(DbError::Validation)?;
        settings.api_key.clear();
        persist_ai_settings_without_secret(db, &settings)?;
    }
    settings.api_key = load_api_key().unwrap_or_default();
    settings.api_key_configured = !settings.api_key.is_empty();
    Ok(settings)
}

pub fn save_ai_settings_for_db(
    db: &Database,
    settings: &AISettings,
) -> Result<AISettings, DbError> {
    validate_ai_settings(settings, !cfg!(debug_assertions)).map_err(DbError::Validation)?;
    let mut normalized = normalize_ai_settings(settings.clone());
    if !normalized.api_key.is_empty() {
        store_api_key(&normalized.api_key).map_err(DbError::Validation)?;
    } else if let Ok(existing) = load_api_key() {
        normalized.api_key = existing;
    }
    normalized.api_key_configured = !normalized.api_key.is_empty();
    persist_ai_settings_without_secret(db, &normalized)?;
    Ok(normalized)
}

fn persist_ai_settings_without_secret(db: &Database, settings: &AISettings) -> Result<(), DbError> {
    let mut persisted = settings.clone();
    persisted.api_key.clear();
    persisted.api_key_configured = false;
    let conn = db.conn()?;
    let settings_json = serde_json::to_string(&persisted)?;
    conn.execute(
        r#"
        INSERT INTO app_settings (key, value)
        VALUES (?1, ?2)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        "#,
        params![AI_SETTINGS_KEY, settings_json],
    )?;
    Ok(())
}

#[cfg(not(debug_assertions))]
fn credential_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(AI_CREDENTIAL_SERVICE, AI_CREDENTIAL_USER)
        .map_err(|error| format!("failed to open system credential store: {error}"))
}

#[cfg(not(debug_assertions))]
fn store_api_key(api_key: &str) -> Result<(), String> {
    credential_entry()?
        .set_password(api_key.trim())
        .map_err(|error| format!("failed to save API key in system credential store: {error}"))
}

#[cfg(not(debug_assertions))]
fn load_api_key() -> Result<String, String> {
    match credential_entry()?.get_password() {
        Ok(value) => Ok(value),
        Err(keyring::Error::NoEntry) => Ok(String::new()),
        Err(error) => Err(format!(
            "failed to read API key from system credential store: {error}"
        )),
    }
}

#[cfg(debug_assertions)]
fn store_api_key(api_key: &str) -> Result<(), String> {
    *DEV_API_KEY
        .get_or_init(|| Mutex::new(String::new()))
        .lock()
        .map_err(|_| "development credential store is unavailable".to_string())? =
        api_key.trim().to_string();
    Ok(())
}

#[cfg(debug_assertions)]
fn load_api_key() -> Result<String, String> {
    DEV_API_KEY
        .get_or_init(|| Mutex::new(String::new()))
        .lock()
        .map(|value| value.clone())
        .map_err(|_| "development credential store is unavailable".to_string())
}

fn public_ai_settings(mut settings: AISettings) -> AISettings {
    settings.api_key_configured = !settings.api_key.is_empty();
    settings.api_key.clear();
    settings
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
    settings.batch_size = settings.batch_size.clamp(1, 100);
    settings.classification_concurrency = settings.classification_concurrency.clamp(1, 4);
    if settings.provider == AIProviderKind::Ollama {
        settings.classification_concurrency = settings.classification_concurrency.min(1);
    }
    settings.timeout_seconds = settings.timeout_seconds.clamp(1, 600);
    settings.max_tokens = settings.max_tokens.clamp(1, 32_768);
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

pub fn validate_ai_settings(settings: &AISettings, release_mode: bool) -> Result<(), String> {
    let preset = provider_preset(settings.preset)
        .ok_or_else(|| "AI provider preset is not supported.".to_string())?;
    if preset.provider_kind != settings.provider {
        return Err("AI provider and preset are incompatible.".to_string());
    }
    if !(1..=100).contains(&settings.batch_size) {
        return Err("AI batch size must be between 1 and 100.".to_string());
    }
    if !(1..=4).contains(&settings.classification_concurrency) {
        return Err("AI classification concurrency must be between 1 and 4.".to_string());
    }
    if !(1..=600).contains(&settings.timeout_seconds) {
        return Err("AI timeout must be between 1 and 600 seconds.".to_string());
    }
    if !(1..=32_768).contains(&settings.max_tokens) {
        return Err("AI max tokens must be between 1 and 32768.".to_string());
    }
    if !settings.temperature.is_finite() || !(0.0..=2.0).contains(&settings.temperature) {
        return Err("AI temperature must be between 0 and 2.".to_string());
    }
    validate_text_limit("model", &settings.model, 200)?;
    validate_text_limit("base URL", &settings.base_url, 2_048)?;
    validate_text_limit("chat path", &settings.chat_path, 512)?;
    if let Some(reasoning_effort) = settings.reasoning_effort.as_deref() {
        validate_text_limit("reasoning effort", reasoning_effort, 64)?;
    }
    validate_provider_url(settings, release_mode)?;
    validate_extra_body_json(settings.extra_body_json.as_deref())?;
    Ok(())
}

fn validate_text_limit(label: &str, value: &str, max_len: usize) -> Result<(), String> {
    if value.len() > max_len {
        return Err(format!("AI {label} exceeds {max_len} characters."));
    }
    Ok(())
}

fn validate_provider_url(settings: &AISettings, release_mode: bool) -> Result<(), String> {
    let parsed = url::Url::parse(settings.base_url.trim())
        .map_err(|_| "AI base URL must be a valid HTTP or HTTPS URL.".to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("AI base URL only supports HTTP or HTTPS.".to_string());
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("AI base URL must not contain user credentials.".to_string());
    }
    let host = parsed
        .host_str()
        .ok_or_else(|| "AI base URL must include a host.".to_string())?;
    let localhost = host.eq_ignore_ascii_case("localhost")
        || host == "127.0.0.1"
        || matches!(host, "::1" | "[::1]");
    if release_mode && parsed.scheme() == "http" && !localhost {
        return Err("Release builds require HTTPS for non-local AI providers.".to_string());
    }
    let chat_path = settings.chat_path.trim();
    if chat_path.is_empty()
        || chat_path.starts_with("//")
        || chat_path.contains("://")
        || chat_path.contains('\\')
    {
        return Err("AI chat path must be a relative URL path.".to_string());
    }
    let normalized_chat_path = format!("/{}", chat_path.trim_start_matches('/'));
    let joined = parsed
        .join(&normalized_chat_path)
        .map_err(|_| "AI chat path must be a valid relative URL path.".to_string())?;
    if joined.scheme() != parsed.scheme()
        || joined.host_str() != parsed.host_str()
        || joined.port_or_known_default() != parsed.port_or_known_default()
    {
        return Err("AI chat path must not change the provider origin.".to_string());
    }
    Ok(())
}

fn validate_extra_body_json(extra: Option<&str>) -> Result<(), String> {
    let Some(extra) = extra.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(());
    };
    if extra.len() > 16_384 {
        return Err("AI extra body JSON exceeds 16384 characters.".to_string());
    }
    let value: serde_json::Value = serde_json::from_str(extra)
        .map_err(|error| format!("AI extra body must be valid JSON: {error}"))?;
    let object = value
        .as_object()
        .ok_or_else(|| "AI extra body must be a JSON object.".to_string())?;
    const RESERVED: &[&str] = &[
        "model",
        "messages",
        "stream",
        "temperature",
        "max_tokens",
        "max_completion_tokens",
        "response_format",
        "thinking",
        "reasoning_effort",
        "tools",
        "tool_choice",
    ];
    if let Some(field) = RESERVED.iter().find(|field| object.contains_key(**field)) {
        return Err(format!(
            "AI extra body cannot override internal field: {field}."
        ));
    }
    if json_depth(&value) > 8 {
        return Err("AI extra body JSON nesting exceeds 8 levels.".to_string());
    }
    Ok(())
}

fn json_depth(value: &serde_json::Value) -> usize {
    match value {
        serde_json::Value::Array(values) => {
            1 + values.iter().map(json_depth).max().unwrap_or_default()
        }
        serde_json::Value::Object(values) => {
            1 + values.values().map(json_depth).max().unwrap_or_default()
        }
        _ => 0,
    }
}

pub fn test_ai_provider_connection_for_settings(
    settings: AISettings,
) -> Result<AIConnectionTestResult, String> {
    validate_ai_settings(&settings, !cfg!(debug_assertions))?;
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
    get_ai_settings_for_db(db.inner())
        .map(public_ai_settings)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_ai_settings(
    db: State<'_, Database>,
    settings: AISettings,
) -> Result<AISettings, String> {
    save_ai_settings_for_db(db.inner(), &settings)
        .map(public_ai_settings)
        .map_err(|error| error.to_string())
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
            Some(mut settings) => {
                if settings.api_key.trim().is_empty() {
                    settings.api_key = get_ai_settings_for_db(&db)
                        .map_err(|error| error.to_string())?
                        .api_key;
                }
                validate_ai_settings(&settings, !cfg!(debug_assertions))?;
                normalize_ai_settings(settings)
            }
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

#[cfg(test)]
mod validation_tests {
    use super::*;

    #[test]
    fn ai_numeric_bounds_accept_limits_and_reject_out_of_range_values() {
        let mut settings = AISettings {
            batch_size: 100,
            classification_concurrency: 4,
            timeout_seconds: 600,
            max_tokens: 32_768,
            temperature: 2.0,
            ..AISettings::default()
        };
        assert!(validate_ai_settings(&settings, true).is_ok());

        settings.batch_size = 101;
        assert!(validate_ai_settings(&settings, true).is_err());
        settings.batch_size = 0;
        assert!(validate_ai_settings(&settings, true).is_err());
        settings.batch_size = 1;
        settings.classification_concurrency = 5;
        assert!(validate_ai_settings(&settings, true).is_err());
        settings.classification_concurrency = 0;
        assert!(validate_ai_settings(&settings, true).is_err());
        settings.classification_concurrency = 1;
        settings.timeout_seconds = 601;
        assert!(validate_ai_settings(&settings, true).is_err());
        settings.timeout_seconds = 0;
        assert!(validate_ai_settings(&settings, true).is_err());
        settings.timeout_seconds = 1;
        settings.max_tokens = 32_769;
        assert!(validate_ai_settings(&settings, true).is_err());
        settings.max_tokens = 0;
        assert!(validate_ai_settings(&settings, true).is_err());
        settings.max_tokens = 1;
        settings.temperature = -0.1;
        assert!(validate_ai_settings(&settings, true).is_err());
        settings.temperature = 2.1;
        assert!(validate_ai_settings(&settings, true).is_err());
        settings.temperature = f32::NAN;
        assert!(validate_ai_settings(&settings, true).is_err());
    }

    #[test]
    fn ai_url_policy_rejects_unsafe_schemes_userinfo_and_release_http() {
        let mut settings = AISettings::default();
        for url in [
            "file:///tmp/model",
            "ftp://example.com",
            "data:text/plain,x",
        ] {
            settings.base_url = url.to_string();
            assert!(validate_ai_settings(&settings, true).is_err(), "{url}");
        }
        settings.base_url = "https://user:secret@example.com".to_string();
        assert!(validate_ai_settings(&settings, true).is_err());
        settings.base_url = "http://example.com".to_string();
        assert!(validate_ai_settings(&settings, true).is_err());

        for url in [
            "http://localhost:11434",
            "http://127.0.0.1:11434",
            "http://[::1]:11434",
        ] {
            settings.base_url = url.to_string();
            assert!(validate_ai_settings(&settings, true).is_ok(), "{url}");
        }
    }

    #[test]
    fn ai_provider_preset_and_chat_path_cannot_cross_security_boundaries() {
        let mut settings = AISettings::default();
        settings.provider = AIProviderKind::Ollama;
        assert!(validate_ai_settings(&settings, true).is_err());

        settings.provider = AIProviderKind::OpenAICompatible;
        for chat_path in [
            "https://evil.example/chat",
            "//evil.example/chat",
            "\\\\evil\\chat",
        ] {
            settings.chat_path = chat_path.to_string();
            assert!(
                validate_ai_settings(&settings, true).is_err(),
                "{chat_path}"
            );
        }
    }

    #[test]
    fn ai_extra_body_requires_bounded_safe_json_object() {
        let mut settings = AISettings::default();
        for json in [
            "not-json",
            "[]",
            r#"{"model":"override"}"#,
            r#"{"messages":[]}"#,
            r#"{"stream":true}"#,
            r#"{"max_completion_tokens":999999}"#,
            r#"{"response_format":{"type":"text"}}"#,
            r#"{"thinking":{"type":"disabled"}}"#,
            r#"{"reasoning_effort":"high"}"#,
        ] {
            settings.extra_body_json = Some(json.to_string());
            assert!(validate_ai_settings(&settings, true).is_err(), "{json}");
        }
        settings.extra_body_json = Some(r#"{"safe_extension":true}"#.to_string());
        assert!(validate_ai_settings(&settings, true).is_ok());
        settings.extra_body_json = Some(format!(r#"{{"value":"{}"}}"#, "x".repeat(16_384)));
        assert!(validate_ai_settings(&settings, true).is_err());
        settings.extra_body_json =
            Some(r#"{"a":{"b":{"c":{"d":{"e":{"f":{"g":{"h":{"i":1}}}}}}}}}}"#.to_string());
        assert!(validate_ai_settings(&settings, true).is_err());
    }

    #[test]
    fn ai_text_fields_enforce_length_limits() {
        let mut settings = AISettings::default();
        settings.model = "x".repeat(201);
        assert!(validate_ai_settings(&settings, true).is_err());
        settings.model = "model".to_string();
        settings.reasoning_effort = Some("x".repeat(65));
        assert!(validate_ai_settings(&settings, true).is_err());
    }
}
