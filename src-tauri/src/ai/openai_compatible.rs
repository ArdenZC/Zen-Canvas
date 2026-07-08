use std::time::Duration;

use reqwest::blocking::Client;
use serde_json::{json, Map, Value};

use super::{
    presets::{provider_preset, AIProviderPreset},
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
        if self.preset.id == AIProviderPresetId::DeepSeek
            && self.preset.supports_thinking
            && !body.contains_key("thinking")
        {
            body.insert(
                "thinking".to_string(),
                json!({ "type": if enable_thinking { "enabled" } else { "disabled" } }),
            );
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
            let mut message = format!(
                "AI provider returned HTTP {status}: {}",
                short_response(&text)
            );
            if self.preset.id == AIProviderPresetId::DeepSeek
                && !thinking_enabled(&self.settings, &request)
            {
                message.push_str(
                    " If DeepSeek rejects thinking disabled, use a non-thinking model or a compatible legacy model name.",
                );
            }
            return Err(self.error(message));
        }

        parse_openai_content(&text).map_err(|error| self.error(error))
    }

    fn test_connection(&self) -> Result<AIConnectionTestResult, AIProviderError> {
        let mut prompt = "Return exactly this JSON and nothing else: {\"ok\":true}\nDo not output Markdown.\nDo not output reasoning.\nDo not output <think>.\nDo not explain.".to_string();
        if self.preset.id == AIProviderPresetId::DeepSeek && !self.settings.enable_thinking {
            prompt.push_str("\nUse non-thinking mode and only return final content.");
        }
        let test_max_tokens = self.settings.max_tokens.max(512).min(4096);
        let content = self.chat_json(AIChatRequest {
            messages: vec![AIChatMessage {
                role: "user".to_string(),
                content: prompt,
            }],
            model: self.settings.model.clone(),
            temperature: 0.0,
            max_tokens: test_max_tokens,
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
    let summary = summarize_provider_response(&value);
    let Some(choice) = value
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
    else {
        return Err(format!(
            "AI provider response did not contain choices[0]. {summary}"
        ));
    };
    let Some(message) = choice.get("message").and_then(Value::as_object) else {
        return Err(format!(
            "AI provider response did not contain choices[0].message. {summary}"
        ));
    };

    if let Some(content) = message.get("content") {
        let content = content_value_to_text(content).ok_or_else(|| {
            format!("AI provider response had unsupported message.content shape. {summary}")
        })?;
        if content.trim().is_empty() {
            if value_text_len(message.get("reasoning_content")) > 0 {
                if choice.get("finish_reason").and_then(Value::as_str) == Some("length") {
                    return Err(format!(
                        "AI provider returned reasoning_content but empty content. 模型只返回了 reasoning_content，且因为输出长度限制被截断，没有生成最终 content。请关闭 Thinking，并提高连接测试 max_tokens；Zen Canvas 已不再使用 64 token 进行连接测试。 {summary}"
                    ));
                }
                return Err(format!(
                    "AI provider returned reasoning_content but empty content. Please disable Thinking or use a non-thinking model. {summary}"
                ));
            }
            return Err(format!(
                "AI provider returned empty message.content. {summary}"
            ));
        }
        return validate_content_has_jsonish_text(content, &summary);
    }

    for fallback_key in ["output_text", "text"] {
        if let Some(content) = message.get(fallback_key) {
            let content = content_value_to_text(content).ok_or_else(|| {
                format!(
                    "AI provider response had unsupported message.{fallback_key} shape. {summary}"
                )
            })?;
            if content.trim().is_empty() {
                continue;
            }
            return validate_content_has_jsonish_text(content, &summary);
        }
    }

    Err(format!(
        "AI provider response did not contain message.content, message.output_text, or message.text. {summary}"
    ))
}

pub(crate) fn summarize_provider_response(value: &Value) -> String {
    let choices = value.get("choices").and_then(Value::as_array);
    let choice = choices.and_then(|items| items.first());
    let message = choice
        .and_then(|choice| choice.get("message"))
        .and_then(Value::as_object);
    let mut message_keys = message
        .map(|message| message.keys().cloned().collect::<Vec<_>>())
        .unwrap_or_default();
    message_keys.sort();
    let content = message.and_then(|message| message.get("content"));
    let reasoning_content = message.and_then(|message| message.get("reasoning_content"));
    format!(
        "provider response summary: has_choices={}; choice_count={}; finish_reason={}; message_keys={}; content_type={}; content_length={}; has_reasoning_content={}; reasoning_content_length={}",
        choices.is_some(),
        choices.map_or(0, Vec::len),
        choice
            .and_then(|choice| choice.get("finish_reason"))
            .map(json_type_or_string)
            .unwrap_or_else(|| "missing".to_string()),
        if message_keys.is_empty() {
            "[]".to_string()
        } else {
            format!("[{}]", message_keys.join(","))
        },
        content.map(json_type_name).unwrap_or("missing"),
        value_text_len(content),
        reasoning_content.is_some(),
        value_text_len(reasoning_content),
    )
}

fn content_value_to_text(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => Some(text.clone()),
        Value::Array(items) => {
            let mut output = String::new();
            for item in items {
                let Some(object) = item.as_object() else {
                    continue;
                };
                if object.get("type").and_then(Value::as_str) == Some("text") {
                    if let Some(text) = object.get("text").and_then(Value::as_str) {
                        output.push_str(text);
                    }
                }
            }
            Some(output)
        }
        _ => None,
    }
}

fn validate_content_has_jsonish_text(content: String, summary: &str) -> Result<String, String> {
    if content.contains('{') || content.contains('[') {
        Ok(content)
    } else {
        Err(format!(
            "AI provider returned non-JSON message content. content_preview=\"{}\". {summary}",
            preview_text(&content, 300)
        ))
    }
}

fn value_text_len(value: Option<&Value>) -> usize {
    value
        .and_then(content_value_to_text)
        .map(|text| text.chars().count())
        .unwrap_or(0)
}

fn json_type_or_string(value: &Value) -> String {
    value
        .as_str()
        .map(ToString::to_string)
        .unwrap_or_else(|| json_type_name(value).to_string())
}

fn json_type_name(value: &Value) -> &'static str {
    match value {
        Value::Null => "null",
        Value::Bool(_) => "boolean",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Array(_) => "array",
        Value::Object(_) => "object",
    }
}

fn preview_text(text: &str, limit: usize) -> String {
    let mut preview = text
        .chars()
        .take(limit)
        .collect::<String>()
        .replace(['\r', '\n', '\t'], " ");
    if text.chars().count() > limit {
        preview.push_str("...");
    }
    preview
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_openai_content_reads_normal_string_content() {
        let text =
            r#"{"choices":[{"finish_reason":"stop","message":{"content":"{\"ok\":true}"}}]}"#;
        let content = parse_openai_content(text).expect("parse content");
        assert_eq!(content, r#"{"ok":true}"#);
    }

    #[test]
    fn parse_openai_content_reports_empty_content() {
        let text = r#"{"choices":[{"finish_reason":"stop","message":{"content":"  "}}]}"#;
        let error = parse_openai_content(text).expect_err("empty content should fail");
        assert!(error.contains("AI provider returned empty message.content."));
        assert!(error.contains("has_choices=true"));
        assert!(error.contains("content_type=string"));
        assert!(error.contains("content_length=2"));
    }

    #[test]
    fn parse_openai_content_reports_reasoning_without_final_content() {
        let text = r#"{"choices":[{"finish_reason":"stop","message":{"content":"","reasoning_content":"thinking trace"}}]}"#;
        let error = parse_openai_content(text).expect_err("reasoning-only response should fail");
        assert!(error.contains("AI provider returned reasoning_content but empty content."));
        assert!(error.contains("Please disable Thinking or use a non-thinking model."));
        assert!(error.contains("has_reasoning_content=true"));
        assert!(error.contains("reasoning_content_length=14"));
    }

    #[test]
    fn parse_openai_content_reads_array_text_content() {
        let text = r#"{"choices":[{"finish_reason":"stop","message":{"content":[{"type":"text","text":"{\"ok\":"},{"type":"text","text":"true}"}]}}]}"#;
        let content = parse_openai_content(text).expect("parse text parts");
        assert_eq!(content, r#"{"ok":true}"#);
    }

    #[test]
    fn parse_openai_content_reads_message_output_text() {
        let text =
            r#"{"choices":[{"finish_reason":"stop","message":{"output_text":"{\"ok\":true}"}}]}"#;
        let content = parse_openai_content(text).expect("parse output_text");
        assert_eq!(content, r#"{"ok":true}"#);
    }

    #[test]
    fn parse_openai_content_reads_message_text() {
        let text = r#"{"choices":[{"finish_reason":"stop","message":{"text":"{\"ok\":true}"}}]}"#;
        let content = parse_openai_content(text).expect("parse text");
        assert_eq!(content, r#"{"ok":true}"#);
    }

    #[test]
    fn parse_openai_content_includes_short_non_json_preview() {
        let text = r#"{"choices":[{"finish_reason":"stop","message":{"content":"Sure, I can classify that file."}}]}"#;
        let error = parse_openai_content(text).expect_err("non-json content should fail");
        assert!(error.contains("AI provider returned non-JSON message content."));
        assert!(error.contains("content_preview=\"Sure, I can classify that file.\""));
        assert!(error.contains("message_keys=[content]"));
    }

    #[test]
    fn provider_error_redaction_removes_api_key_from_summary() {
        let api_key = "sk-provider-secret";
        let text = r#"{"choices":[{"finish_reason":"stop","message":{"content":"Provider rejected sk-provider-secret"}}]}"#;
        let error = parse_openai_content(text).expect_err("non-json content should fail");
        let redacted = redact_api_key(&error, api_key);
        assert!(!redacted.contains(api_key));
        assert!(redacted.contains("[redacted]"));
    }
}
