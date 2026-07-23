use std::time::Duration;

use reqwest::blocking::Client;
use serde_json::{json, Value};

use super::{
    openai_compatible::join_base_url_and_chat_path,
    prompts::{clean_ai_json_text, extract_first_json_value},
    provider::{AIProvider, AIProviderError},
    schema::{AIChatMessage, AIChatRequest, AIConnectionTestResult, AIModelInfo},
    settings::AISettings,
    trace::{now_iso, record_trace, AIRequestTrace, AITraceRequest, SecretRedactor},
};

pub struct OllamaProvider {
    settings: AISettings,
    client: Option<Client>,
}

impl OllamaProvider {
    pub fn new(settings: AISettings) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(settings.timeout_seconds.max(1)))
            .build()
            .ok();
        Self { settings, client }
    }

    fn client(&self) -> Result<&Client, AIProviderError> {
        self.client
            .as_ref()
            .ok_or_else(|| AIProviderError::new("failed to build Ollama client"))
    }
}

impl AIProvider for OllamaProvider {
    fn chat_json(&self, request: AIChatRequest) -> Result<String, AIProviderError> {
        let url = join_base_url_and_chat_path(&self.settings.base_url, "/api/chat")?;
        let parsed_url = url::Url::parse(&url).ok();
        let context = request
            .provider_options
            .trace_context
            .clone()
            .unwrap_or_default();
        let mut trace_secrets = vec![self.settings.api_key.clone()];
        trace_secrets.extend(context.redaction_secrets.iter().cloned());
        let mut trace = AIRequestTrace {
            job_id: context.job_id.clone(),
            batch_id: context.batch_id.clone(),
            started_at: now_iso(),
            operation: context.operation,
            provider_id: "ollama".to_string(),
            provider_label: "Ollama 本地模型".to_string(),
            model: request.model.clone(),
            request: AITraceRequest {
                url_host: parsed_url
                    .as_ref()
                    .and_then(url::Url::host_str)
                    .unwrap_or_default()
                    .to_string(),
                path: parsed_url
                    .as_ref()
                    .map(|url| url.path().to_string())
                    .unwrap_or_else(|| "/api/chat".to_string()),
                message_count: request.messages.len(),
                target_count: context.target_count,
                batch_size: context.batch_size,
                max_tokens: Some(request.max_tokens),
                temperature: Some(request.temperature),
                force_json: request.force_json,
                response_format: request.force_json.then(|| "json".to_string()),
                thinking_mode: request
                    .provider_options
                    .enable_thinking
                    .map(|enabled| enabled.to_string()),
                extra_body_keys: Vec::new(),
            },
            parse_stage: "request_sent".to_string(),
            ..AIRequestTrace::default()
        };
        let started = std::time::Instant::now();
        let mut body = json!({
            "model": request.model,
            "messages": messages_with_ollama_instructions(&request.messages, &self.settings.model, request.force_json),
            "stream": false,
            "options": {
                "temperature": request.temperature,
                "num_predict": request.max_tokens
            }
        });
        if request.force_json {
            body["format"] = json!("json");
        }

        let response = match self
            .client()?
            .post(url)
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            .json(&body)
            .send()
        {
            Ok(response) => response,
            Err(error) => {
                let message = format!("Ollama request failed: {error}");
                trace.elapsed_ms = started.elapsed().as_millis();
                trace.parse_stage = "transport_error".to_string();
                trace.error_code = Some("transport_error".to_string());
                trace.error_message = Some(message.clone());
                record_trace(self.settings.diagnostics_mode, trace, true);
                return Err(AIProviderError::new(message));
            }
        };
        let status = response.status();
        let text = match response.text() {
            Ok(text) => text,
            Err(error) => {
                trace.elapsed_ms = started.elapsed().as_millis();
                trace.response.http_status = Some(status.as_u16());
                trace.parse_stage = "transport_error".to_string();
                trace.error_code = Some("response_read_error".to_string());
                trace.error_message = Some(error.to_string());
                record_trace(self.settings.diagnostics_mode, trace, true);
                return Err(AIProviderError::new(format!(
                    "failed to read Ollama response: {error}"
                )));
            }
        };
        let redactor = SecretRedactor::new(trace_secrets.iter().map(String::as_str));
        let (redacted_text, truncated) = redactor
            .redact_optional_text(Some(&text), super::trace::MAX_RAW_PROVIDER_RESPONSE_CHARS);
        trace.elapsed_ms = started.elapsed().as_millis();
        trace.response.http_status = Some(status.as_u16());
        trace.raw_provider_response = redacted_text.clone();
        trace.truncated |= truncated;
        if !status.is_success() {
            trace.parse_stage = "http_error".to_string();
            trace.error_code = Some(format!("http_{}", status.as_u16()));
            trace.error_message = Some(format!("Ollama returned HTTP {}", status.as_u16()));
            record_trace(self.settings.diagnostics_mode, trace, true);
            return Err(AIProviderError::new(format!(
                "Ollama returned HTTP {status}: {}",
                redacted_text.unwrap_or_default()
            )));
        }
        match parse_ollama_content(&text) {
            Ok(content) => {
                let cleaned = clean_ai_json_text(&content);
                trace.extracted_content = Some(content.clone());
                trace.cleaned_json_text = Some(cleaned.clone());
                trace.parsed_json = serde_json::from_str(&cleaned).ok().or_else(|| {
                    extract_first_json_value(&content)
                        .and_then(|value| serde_json::from_str(&value).ok())
                });
                trace.parse_stage = "extracted_content".to_string();
                record_trace(self.settings.diagnostics_mode, trace, false);
                Ok(content)
            }
            Err(error) => {
                trace.parse_stage = "parse_error".to_string();
                trace.error_code = Some("response_parse_error".to_string());
                trace.error_message = Some(error.to_string());
                record_trace(self.settings.diagnostics_mode, trace, true);
                Err(error)
            }
        }
    }

    fn test_connection(&self) -> Result<AIConnectionTestResult, AIProviderError> {
        let test_max_tokens = self.settings.max_tokens.clamp(512, 4096);
        let content = self.chat_json(AIChatRequest {
            messages: vec![AIChatMessage {
                role: "user".to_string(),
                content: "Return exactly this JSON and nothing else: {\"ok\":true}\nDo not output Markdown.\nDo not output reasoning.\nDo not output <think>.\nDo not explain."
                    .to_string(),
            }],
            model: self.settings.model.clone(),
            temperature: 0.0,
            max_tokens: test_max_tokens,
            force_json: true,
            provider_options: Default::default(),
        })?;
        Ok(AIConnectionTestResult {
            ok: true,
            message: format!("Ollama responded: {content}"),
            model: Some(self.settings.model.clone()),
            provider: Some(self.settings.provider),
            preset: Some(self.settings.preset),
            elapsed_ms: 0,
        })
    }

    fn discover_models(&self) -> Result<Vec<AIModelInfo>, AIProviderError> {
        let url = join_base_url_and_chat_path(&self.settings.base_url, "/api/tags")?;
        let response = self
            .client()?
            .get(url)
            .header(reqwest::header::ACCEPT, "application/json")
            .send()
            .map_err(|error| {
                AIProviderError::new(format!("Ollama model discovery failed: {error}"))
            })?;
        let status = response.status();
        let text = response.text().map_err(|error| {
            AIProviderError::new(format!("failed to read Ollama model list: {error}"))
        })?;
        if !status.is_success() {
            return Err(AIProviderError::new(format!(
                "Ollama model discovery returned HTTP {}: {}",
                status.as_u16(),
                short_ollama_response(&text)
            )));
        }
        let value = serde_json::from_str::<Value>(&text).map_err(|error| {
            AIProviderError::new(format!("Ollama model list is invalid JSON: {error}"))
        })?;
        let models = value
            .get("models")
            .and_then(Value::as_array)
            .ok_or_else(|| AIProviderError::new("Ollama model list did not contain models."))?;
        let mut result = Vec::new();
        let mut seen = std::collections::HashSet::new();
        for model in models {
            let Some(name) = model
                .get("name")
                .or_else(|| model.get("model"))
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|name| !name.is_empty())
            else {
                continue;
            };
            if seen.insert(name.to_string()) {
                result.push(AIModelInfo {
                    id: name.to_string(),
                    owned_by: Some("ollama".to_string()),
                    discovered: true,
                });
            }
        }
        Ok(result)
    }
}

fn short_ollama_response(text: &str) -> String {
    text.chars().take(500).collect()
}

fn messages_with_ollama_instructions(
    messages: &[AIChatMessage],
    model: &str,
    force_json: bool,
) -> Vec<AIChatMessage> {
    let mut output = Vec::new();
    let lower_model = model.to_ascii_lowercase();
    let mut instructions = Vec::new();
    if force_json {
        instructions.push("only JSON");
        instructions.push("no markdown");
    }
    if lower_model.starts_with("qwen3") || lower_model.contains("/qwen3") {
        instructions.push("/no_think");
        instructions.push("/qwen no_think style: only final JSON");
        instructions.push("no thinking");
        instructions.push("no <think> tags");
    }
    if !instructions.is_empty() {
        output.push(AIChatMessage {
            role: "system".to_string(),
            content: instructions.join(", "),
        });
    }
    output.extend_from_slice(messages);
    output
}

fn parse_ollama_content(text: &str) -> Result<String, AIProviderError> {
    let value = serde_json::from_str::<Value>(text)
        .map_err(|error| AIProviderError::new(format!("Ollama returned invalid JSON: {error}")))?;
    value
        .get("message")
        .and_then(|message| message.get("content"))
        .and_then(Value::as_str)
        .or_else(|| value.get("response").and_then(Value::as_str))
        .map(ToString::to_string)
        .ok_or_else(|| {
            AIProviderError::new("Ollama response did not contain message.content or response.")
        })
}
