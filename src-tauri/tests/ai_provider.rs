use std::{
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    path::PathBuf,
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde_json::Value;
use zen_canvas_tauri::ai::{
    ollama::OllamaProvider,
    openai_compatible::{join_base_url_and_chat_path, OpenAICompatibleProvider},
    presets::{all_provider_presets, provider_preset, AIExtraBodyStrategy},
    provider::AIProvider,
    schema::{AIChatMessage, AIChatRequest, AIProviderKind, AIProviderOptions, AIProviderPresetId},
    settings::test_ai_provider_connection_for_settings,
    settings::{
        get_ai_settings_for_db, normalize_ai_settings, save_ai_settings_for_db, AISettings,
    },
};
use zen_canvas_tauri::{db::Database, settings::get_app_settings};

#[test]
fn deepseek_preset_uses_openai_compatible_defaults_without_forcing_response_format() {
    let preset = provider_preset(AIProviderPresetId::DeepSeek).expect("deepseek preset");

    assert_eq!(preset.id, AIProviderPresetId::DeepSeek);
    assert_eq!(preset.provider_kind, AIProviderKind::OpenAICompatible);
    assert_eq!(preset.default_base_url, "https://api.deepseek.com");
    assert_eq!(preset.default_chat_path, "/chat/completions");
    assert_eq!(preset.default_model, "deepseek-v4-flash");
    assert!(preset.supports_thinking);
    assert!(preset.supports_reasoning_effort);
    assert!(preset.supports_response_format);
    assert_eq!(
        preset.extra_body_strategy,
        AIExtraBodyStrategy::DeepSeekThinking
    );
}

#[test]
fn ai_settings_default_starts_disabled_on_deepseek() {
    let settings = AISettings::default();

    assert!(!settings.enabled);
    assert_eq!(settings.provider, AIProviderKind::OpenAICompatible);
    assert_eq!(settings.preset, AIProviderPresetId::DeepSeek);
    assert_eq!(settings.base_url, "https://api.deepseek.com");
    assert_eq!(settings.chat_path, "/chat/completions");
    assert_eq!(settings.model, "deepseek-v4-flash");
    assert_eq!(settings.batch_size, 20);
    assert_eq!(settings.timeout_seconds, 120);
    assert!(settings.send_full_path);
    assert!(settings.send_parent_path);
    assert!(!settings.send_file_content);
    assert!(settings.force_json_output);
    assert!(!settings.enable_thinking);
}

#[test]
fn ai_settings_roundtrip_uses_separate_settings_row_and_normalizes_paths() {
    let db = Database::open(test_db_path()).expect("open test database");
    let app_settings_before = get_app_settings(&db).expect("app settings before");
    let mut settings = AISettings {
        enabled: true,
        preset: AIProviderPresetId::Kimi,
        provider: AIProviderKind::OpenAICompatible,
        base_url: " https://api.moonshot.cn/v1/ ".to_string(),
        chat_path: " chat/completions ".to_string(),
        api_key: " moonshot-secret ".to_string(),
        model: " kimi-k2.6 ".to_string(),
        timeout_seconds: 0,
        batch_size: 0,
        ..AISettings::default()
    };

    let saved = save_ai_settings_for_db(&db, &settings).expect("save ai settings");
    settings.base_url = "https://api.moonshot.cn/v1".to_string();
    settings.chat_path = "/chat/completions".to_string();
    settings.api_key = "moonshot-secret".to_string();
    settings.model = "kimi-k2.6".to_string();
    settings.timeout_seconds = 1;
    settings.batch_size = 1;
    let loaded = get_ai_settings_for_db(&db).expect("load ai settings");
    let app_settings_after = get_app_settings(&db).expect("app settings after");

    assert_eq!(saved.base_url, settings.base_url);
    assert_eq!(saved.chat_path, settings.chat_path);
    assert_eq!(loaded.model, settings.model);
    assert_eq!(loaded.api_key, "moonshot-secret");
    assert_eq!(
        app_settings_before.close_behavior,
        app_settings_after.close_behavior
    );
    assert_eq!(
        app_settings_before.folder_naming_language,
        app_settings_after.folder_naming_language
    );
}

#[test]
fn missing_ai_settings_loads_deepseek_defaults_and_presets_list_has_all_ids() {
    let db = Database::open(test_db_path()).expect("open test database");

    let settings = get_ai_settings_for_db(&db).expect("default ai settings");
    let ids = all_provider_presets()
        .into_iter()
        .map(|preset| preset.id)
        .collect::<Vec<_>>();

    assert_eq!(settings.preset, AIProviderPresetId::DeepSeek);
    assert_eq!(settings.provider, AIProviderKind::OpenAICompatible);
    assert_eq!(settings.base_url, "https://api.deepseek.com");
    assert_eq!(ids.len(), 10);
    assert!(ids.contains(&AIProviderPresetId::DeepSeek));
    assert!(ids.contains(&AIProviderPresetId::Ollama));
    assert!(ids.contains(&AIProviderPresetId::CustomOpenAICompatible));
}

#[test]
fn normalize_ai_settings_reconciles_preset_provider_and_chat_path() {
    let normalized = normalize_ai_settings(AISettings {
        preset: AIProviderPresetId::Ollama,
        provider: AIProviderKind::OpenAICompatible,
        base_url: " http://localhost:11434/ ".to_string(),
        chat_path: "api/chat".to_string(),
        model: " qwen3:8b ".to_string(),
        api_key: " local-key ".to_string(),
        ..AISettings::default()
    });

    assert_eq!(normalized.provider, AIProviderKind::Ollama);
    assert_eq!(normalized.base_url, "http://localhost:11434");
    assert_eq!(normalized.chat_path, "/api/chat");
    assert_eq!(normalized.model, "qwen3:8b");
    assert_eq!(normalized.api_key, "local-key");
}

#[test]
fn test_ai_provider_connection_for_settings_uses_short_json_probe_and_reports_elapsed() {
    let server = TestServer::start(
        200,
        r#"{"choices":[{"message":{"content":"{\"ok\":true}"}}]}"#,
    );
    let settings = settings_for_server(
        &server.base_url,
        AIProviderPresetId::DeepSeek,
        "secret-openai-key",
    );

    let result = test_ai_provider_connection_for_settings(settings).expect("connection test");
    let request = server.request();
    let body: Value = serde_json::from_str(&request.body).expect("json body");

    assert!(result.ok);
    assert_eq!(result.provider, Some(AIProviderKind::OpenAICompatible));
    assert_eq!(result.preset, Some(AIProviderPresetId::DeepSeek));
    assert_eq!(result.model.as_deref(), Some("deepseek-v4-flash"));
    assert!(result.elapsed_ms <= 10_000);
    assert!(body["messages"].to_string().contains(r#"{\"ok\":true}"#));
    assert_eq!(body["max_tokens"], 64);
}

#[test]
fn ai_schema_serializes_expected_provider_and_preset_ids() {
    assert_eq!(
        serde_json::to_value(AIProviderKind::OpenAICompatible).unwrap(),
        "openai_compatible"
    );
    assert_eq!(
        serde_json::to_value(AIProviderPresetId::QwenDashScope).unwrap(),
        "qwen_dashscope"
    );
    assert_eq!(
        serde_json::to_value(AIProviderPresetId::CustomOpenAICompatible).unwrap(),
        "custom_openai_compatible"
    );
}

#[test]
fn openai_compatible_url_join_accepts_optional_slashes() {
    assert_eq!(
        join_base_url_and_chat_path("https://api.example.com/", "/chat/completions").unwrap(),
        "https://api.example.com/chat/completions"
    );
    assert_eq!(
        join_base_url_and_chat_path("https://api.example.com/v1", "chat/completions").unwrap(),
        "https://api.example.com/v1/chat/completions"
    );
}

#[test]
fn openai_compatible_chat_returns_choice_content_and_requests_json_mode() {
    let server = TestServer::start(
        200,
        r#"{"choices":[{"message":{"content":"{\"ok\":true}"}}]}"#,
    );
    let provider = OpenAICompatibleProvider::new(settings_for_server(
        &server.base_url,
        AIProviderPresetId::DeepSeek,
        "secret-openai-key",
    ));

    let content = provider
        .chat_json(chat_request("deepseek-v4-flash", true))
        .expect("chat response");

    assert_eq!(content, r#"{"ok":true}"#);
    let request = server.request();
    assert_eq!(request.path, "/chat/completions");
    assert_eq!(
        request.headers.get("authorization").map(String::as_str),
        Some("Bearer secret-openai-key")
    );
    assert_eq!(
        request.headers.get("content-type").map(String::as_str),
        Some("application/json")
    );
    let body: Value = serde_json::from_str(&request.body).expect("json body");
    assert_eq!(body["model"], "deepseek-v4-flash");
    assert_eq!(body["response_format"]["type"], "json_object");
    let messages = body["messages"].as_array().expect("messages");
    assert!(messages.iter().any(|message| message["content"]
        .as_str()
        .unwrap_or_default()
        .contains("only valid JSON")));
}

#[test]
fn openai_compatible_errors_redact_api_key() {
    let server = TestServer::start(401, r#"{"error":"bad secret-openai-key"}"#);
    let provider = OpenAICompatibleProvider::new(settings_for_server(
        &server.base_url,
        AIProviderPresetId::DeepSeek,
        "secret-openai-key",
    ));

    let error = provider
        .chat_json(chat_request("deepseek-v4-flash", true))
        .expect_err("request should fail");
    let message = error.to_string();

    assert!(message.contains("[redacted]"));
    assert!(!message.contains("secret-openai-key"));
}

#[test]
fn openai_compatible_respects_preset_without_response_format() {
    let server = TestServer::start(
        200,
        r#"{"choices":[{"message":{"content":"{\"ok\":true}"}}]}"#,
    );
    let provider = OpenAICompatibleProvider::new(settings_for_server(
        &server.base_url,
        AIProviderPresetId::QwenDashScope,
        "dashscope-key",
    ));

    provider
        .chat_json(chat_request("qwen-plus", true))
        .expect("chat response");

    let body: Value = serde_json::from_str(&server.request().body).expect("json body");
    assert!(body.get("response_format").is_none());
    let messages = body["messages"].as_array().expect("messages");
    assert!(messages.iter().any(|message| message["content"]
        .as_str()
        .unwrap_or_default()
        .contains("only valid JSON")));
}

#[test]
fn ollama_chat_uses_api_chat_stream_false_and_json_format() {
    let server = TestServer::start(200, r#"{"message":{"content":"{\"ok\":true}"}}"#);
    let mut settings = AISettings::default();
    settings.provider = AIProviderKind::Ollama;
    settings.preset = AIProviderPresetId::Ollama;
    settings.base_url = server.base_url.clone();
    settings.chat_path = "/api/chat".to_string();
    settings.model = "qwen3:8b".to_string();
    let provider = OllamaProvider::new(settings);

    let content = provider
        .chat_json(chat_request("qwen3:8b", true))
        .expect("ollama response");

    assert_eq!(content, r#"{"ok":true}"#);
    let request = server.request();
    assert_eq!(request.path, "/api/chat");
    let body: Value = serde_json::from_str(&request.body).expect("json body");
    assert_eq!(body["model"], "qwen3:8b");
    assert_eq!(body["stream"], false);
    assert_eq!(body["format"], "json");
    let messages = body["messages"].as_array().expect("messages");
    assert!(messages.iter().any(|message| message["content"]
        .as_str()
        .unwrap_or_default()
        .contains("no thinking")));
}

fn settings_for_server(base_url: &str, preset_id: AIProviderPresetId, api_key: &str) -> AISettings {
    let preset = provider_preset(preset_id).expect("preset");
    AISettings {
        provider: preset.provider_kind,
        preset: preset.id,
        base_url: base_url.to_string(),
        chat_path: preset.default_chat_path.to_string(),
        api_key: api_key.to_string(),
        model: preset.default_model.to_string(),
        timeout_seconds: 5,
        ..AISettings::default()
    }
}

fn chat_request(model: &str, force_json: bool) -> AIChatRequest {
    AIChatRequest {
        messages: vec![AIChatMessage {
            role: "user".to_string(),
            content: "Return {\"ok\":true}".to_string(),
        }],
        model: model.to_string(),
        temperature: 0.1,
        max_tokens: 128,
        force_json,
        provider_options: AIProviderOptions::default(),
    }
}

struct TestServer {
    base_url: String,
    handle: thread::JoinHandle<CapturedRequest>,
}

impl TestServer {
    fn start(status: u16, response_body: &'static str) -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind test server");
        let port = listener.local_addr().expect("server addr").port();
        let handle = thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept request");
            let request = read_http_request(&mut stream);
            let status_text = if status == 200 { "OK" } else { "ERROR" };
            let response = format!(
                "HTTP/1.1 {status} {status_text}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                response_body.len(),
                response_body
            );
            stream
                .write_all(response.as_bytes())
                .expect("write response");
            request
        });

        Self {
            base_url: format!("http://127.0.0.1:{port}"),
            handle,
        }
    }

    fn request(self) -> CapturedRequest {
        self.handle
            .join()
            .expect("test server thread should finish")
    }
}

struct CapturedRequest {
    path: String,
    headers: std::collections::HashMap<String, String>,
    body: String,
}

fn read_http_request(stream: &mut TcpStream) -> CapturedRequest {
    stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .expect("set read timeout");
    let mut buffer = Vec::new();
    let mut temp = [0_u8; 4096];
    let mut header_end = None;
    while header_end.is_none() {
        let read = stream.read(&mut temp).expect("read headers");
        assert!(read > 0, "client closed before headers");
        buffer.extend_from_slice(&temp[..read]);
        header_end = find_header_end(&buffer);
    }
    let header_end = header_end.expect("headers complete");
    let headers_text = String::from_utf8_lossy(&buffer[..header_end]).to_string();
    let mut lines = headers_text.split("\r\n");
    let request_line = lines.next().expect("request line");
    let path = request_line
        .split_whitespace()
        .nth(1)
        .expect("path")
        .to_string();
    let mut headers = std::collections::HashMap::new();
    for line in lines.filter(|line| !line.is_empty()) {
        if let Some((key, value)) = line.split_once(':') {
            headers.insert(key.trim().to_ascii_lowercase(), value.trim().to_string());
        }
    }
    let content_length = headers
        .get("content-length")
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(0);
    while buffer.len() < header_end + 4 + content_length {
        let read = stream.read(&mut temp).expect("read body");
        assert!(read > 0, "client closed before body");
        buffer.extend_from_slice(&temp[..read]);
    }
    let body_start = header_end + 4;
    let body =
        String::from_utf8_lossy(&buffer[body_start..body_start + content_length]).to_string();

    CapturedRequest {
        path,
        headers,
        body,
    }
}

fn find_header_end(buffer: &[u8]) -> Option<usize> {
    buffer.windows(4).position(|window| window == b"\r\n\r\n")
}

fn test_db_path() -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock")
        .as_nanos();
    std::env::temp_dir().join(format!("zen-canvas-ai-provider-test-{nonce}.sqlite3"))
}
