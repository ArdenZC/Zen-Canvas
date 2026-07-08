use std::time::Duration;

use reqwest::blocking::Client;
use serde_json::{json, Map, Value};

use super::{
    presets::{provider_preset, AIExtraBodyStrategy, AIProviderPreset},
    provider::{AIProvider, AIProviderError},
    schema::{AIChatMessage, AIChatRequest, AIConnectionTestResult, AIProviderPresetId},
    settings::AISettings,
};

pub struct OpenAICompatibleProvider {
    settings: AISettings,
    preset: AIProviderPreset,
}

impl OpenAICompatibleProvider {
    pub fn new(settings: AISettings) -> Self {
        let preset = provider_preset(settings.preset)
            .or_else(|| provider_preset(AIProviderPresetId::CustomOpenAICompatible))
            .expect("custom OpenAI-compatible preset exists");
        Self { settings, preset }
    }

    fn request_url(&self) -> Result<String, AIProviderError> {
        join_base_url_and_chat_path(&self.settings.base_url, &self.settings.chat_path)
    }

    fn client(&self) -> Result<Client, AIProviderError> {
        Client::builder()
            .timeout(Duration::from_secs(self.settings.timeout_seconds.max(1)))
            .build()
            .map_err(|error| self.error(format!("failed to build AI HTTP client: {error}")))
    }

    fn error(&self, message: impl Into<String>) -> AIProviderError {
        AIProviderError::new(redact_api_key(&message.into(), &self.settings.api_key))
    }
}

impl AIProvider for OpenAICompatibleProvider {
    fn chat_json(&self, request: AIChatRequest) -> Result<String, AIProviderError> {
        let url = self.request_url()?;
        let mut body = Map::new();
        body.insert("model".to_string(), json!(request.model));
        body.insert(
            "messages".to_string(),
            json!(messages_with_instructions(
                &request.messages,
                request.force_json,
                thinking_enabled(&self.settings, &request),
                self.preset.id
            )),
        );
        body.insert("temperature".to_string(), json!(request.temperature));
        body.insert("max_tokens".to_string(), json!(request.max_tokens));

        let response_format_enabled = request
            .provider_options
            .use_response_format
            .unwrap_or(self.preset.supports_response_format);
        if request.force_json && response_format_enabled {
            body.insert(
                "response_format".to_string(),
                json!({ "type": "json_object" }),
            );
        }

        // Advanced override: user-provided extra_body_json is merged last and can override
        // provider fields intentionally. The settings UI labels this as an advanced option.
        merge_extra_body(
            &mut body,
            self.settings.extra_body_json.as_deref(),
            &self.settings.api_key,
        )
        .map_err(|error| self.error(error.to_string()))?;
        merge_extra_body(
            &mut body,
            request.provider_options.extra_body_json.as_deref(),
            &self.settings.api_key,
        )
        .map_err(|error| self.error(error.to_string()))?;

        let enable_thinking = thinking_enabled(&self.settings, &request);
        if enable_thinking && self.preset.supports_reasoning_effort {
            if let Some(reasoning_effort) = request
                .provider_options
                .reasoning_effort
                .as_deref()
                .or(self.settings.reasoning_effort.as_deref())
                .filter(|value| !value.trim().is_empty())
            {
                body.insert("reasoning_effort".to_string(), json!(reasoning_effort));
            }
        }
        if enable_thinking
            && self.preset.supports_thinking
            && self.preset.extra_body_strategy == AIExtraBodyStrategy::DeepSeekThinking
            && !body.contains_key("thinking")
        {
            body.insert("thinking".to_string(), json!({ "type": "enabled" }));
        }

        let mut builder = self
            .client()?
            .post(url)
            .header(reqwest::header::CONTENT_TYPE, "application/json");
        if !self.settings.api_key.trim().is_empty() {
            builder = builder.bearer_auth(self.settings.api_key.trim());
        }

        let response = builder
            .json(&Value::Object(body))
            .send()
            .map_err(|error| self.error(format!("AI request failed: {error}")))?;
        let status = response.status();
        let text = response
            .text()
            .map_err(|error| self.error(format!("failed to read AI response: {error}")))?;
        if !status.is_success() {
            return Err(self.error(format!(
                "AI provider returned HTTP {status}: {}",
                short_response(&text)
            )));
        }

        parse_openai_content(&text).map_err(|error| self.error(error))
    }

    fn test_connection(&self) -> Result<AIConnectionTestResult, AIProviderError> {
        let content = self.chat_json(AIChatRequest {
            messages: vec![AIChatMessage {
                role: "user".to_string(),
                content: "Return {\"ok\":true} as JSON.".to_string(),
            }],
            model: self.settings.model.clone(),
            temperature: 0.0,
            max_tokens: 64,
            force_json: true,
            provider_options: Default::default(),
        })?;
        Ok(AIConnectionTestResult {
            ok: true,
            message: format!("AI provider responded: {}", short_response(&content)),
            model: Some(self.settings.model.clone()),
            provider: Some(self.settings.provider),
            preset: Some(self.settings.preset),
            elapsed_ms: 0,
        })
    }
}

pub fn join_base_url_and_chat_path(
    base_url: &str,
    chat_path: &str,
) -> Result<String, AIProviderError> {
    let base = base_url.trim().trim_end_matches('/');
    let path = chat_path.trim().trim_start_matches('/');
    if base.is_empty() {
        return Err(AIProviderError::new("AI provider base_url is empty."));
    }
    if path.is_empty() {
        return Err(AIProviderError::new("AI provider chat_path is empty."));
    }
    Ok(format!("{base}/{path}"))
}

fn messages_with_instructions(
    messages: &[AIChatMessage],
    force_json: bool,
    enable_thinking: bool,
    preset_id: AIProviderPresetId,
) -> Vec<AIChatMessage> {
    let mut output = Vec::new();
    let mut instructions = Vec::new();
    if force_json {
        instructions.push("Return only valid JSON. Do not wrap the JSON in markdown.".to_string());
    }
    if !enable_thinking {
        instructions.push("Do not output thinking, reasoning traces, or explanations.".to_string());
    }
    if preset_id == AIProviderPresetId::DeepSeek {
        instructions.push(
            "DeepSeek legacy model names deepseek-chat and deepseek-reasoner may be deprecated; keep output compatible with the selected model.".to_string(),
        );
    }
    if !instructions.is_empty() {
        output.push(AIChatMessage {
            role: "system".to_string(),
            content: instructions.join(" "),
        });
    }
    output.extend_from_slice(messages);
    output
}

fn thinking_enabled(settings: &AISettings, request: &AIChatRequest) -> bool {
    request
        .provider_options
        .enable_thinking
        .unwrap_or(settings.enable_thinking)
}

fn merge_extra_body(
    body: &mut Map<String, Value>,
    extra_body_json: Option<&str>,
    api_key: &str,
) -> Result<(), AIProviderError> {
    let Some(extra_body_json) = extra_body_json.filter(|value| !value.trim().is_empty()) else {
        return Ok(());
    };
    let value = serde_json::from_str::<Value>(extra_body_json).map_err(|error| {
        AIProviderError::new(redact_api_key(
            &format!("AI extra_body_json must be a JSON object: {error}"),
            api_key,
        ))
    })?;
    let Value::Object(extra) = value else {
        return Err(AIProviderError::new(
            "AI extra_body_json must be a JSON object.",
        ));
    };
    for (key, value) in extra {
        body.insert(key, value);
    }
    Ok(())
}

fn parse_openai_content(text: &str) -> Result<String, String> {
    let value = serde_json::from_str::<Value>(text)
        .map_err(|error| format!("AI provider returned invalid JSON: {error}"))?;
    value
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("content"))
        .and_then(Value::as_str)
        .map(ToString::to_string)
        .ok_or_else(|| {
            format!(
                "AI provider response did not contain choices[0].message.content: {}",
                short_response(text)
            )
        })
}

fn short_response(text: &str) -> String {
    const LIMIT: usize = 500;
    if text.len() <= LIMIT {
        text.to_string()
    } else {
        format!("{}...", &text[..LIMIT])
    }
}

fn redact_api_key(message: &str, api_key: &str) -> String {
    let trimmed = api_key.trim();
    if trimmed.is_empty() {
        message.to_string()
    } else {
        message.replace(trimmed, "[redacted]")
    }
}
