use std::time::{Duration, Instant};

use reqwest::blocking::Client;
use serde_json::{json, Map, Value};

use super::{
    presets::{provider_preset, AIProviderPreset},
    prompts::{clean_ai_json_text, extract_first_json_value},
    provider::{AIProvider, AIProviderError},
    registry::{AIAuthKind, AIThinkingStrategy, AITokenParameter},
    schema::{
        AIChatMessage, AIChatRequest, AIConnectionTestResult, AIModelInfo, AIProviderOptions,
        AIProviderPresetId,
    },
    settings::AISettings,
    trace::{
        now_iso, record_trace, update_trace_with_secrets, AIRequestTrace, AITraceContext,
        AITraceMode, AITraceOperation, AITraceRequest, AITraceResponse, AITraceUpdate,
        AITraceUsage, SecretRedactor,
    },
};

type ChatBody = (Map<String, Value>, bool, Option<String>);

pub struct OpenAICompatibleProvider {
    settings: AISettings,
    preset: AIProviderPreset,
    client: Option<Client>,
}

#[derive(Debug, Clone)]
pub struct AIRawProviderResponse {
    pub status: u16,
    pub response_text: String,
    pub request_used_response_format: bool,
    pub request_used_thinking_field: Option<String>,
    pub response_summary: String,
    pub trace_id: Option<String>,
    pub(crate) pending_trace: Option<AIRequestTrace>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct AIDebugExtractResult {
    pub finish_reason: Option<String>,
    pub message_keys: Vec<String>,
    pub message_content: Option<String>,
    pub reasoning_content: Option<String>,
    pub output_text: Option<String>,
    pub text: Option<String>,
    pub extracted_content: Option<String>,
    pub parse_error: Option<String>,
}

impl OpenAICompatibleProvider {
    pub fn new(settings: AISettings) -> Self {
        let mut preset = provider_preset(settings.preset)
            .or_else(|| provider_preset(AIProviderPresetId::CustomOpenAICompatible))
            .expect("custom OpenAI-compatible preset exists");
        if let Some(profile) = settings
            .active_custom_profile_id
            .as_deref()
            .and_then(|profile_id| {
                settings
                    .custom_profiles
                    .iter()
                    .find(|profile| profile.id == profile_id)
            })
        {
            preset.capabilities.supports_response_format_json_object =
                profile.supports_response_format;
            preset.capabilities.supports_thinking = profile.supports_thinking;
            preset.capabilities.supports_thinking_toggle = profile.supports_thinking;
            preset.capabilities.supports_reasoning_effort = profile
                .thinking_parameter
                .eq_ignore_ascii_case("reasoning_effort");
            preset.supports_response_format = profile.supports_response_format;
            preset.supports_json_mode = profile.supports_response_format;
            preset.supports_thinking = profile.supports_thinking;
            preset.supports_reasoning_effort = profile
                .thinking_parameter
                .eq_ignore_ascii_case("reasoning_effort");
            preset.parameter_profile.token_parameter = if profile
                .token_parameter
                .eq_ignore_ascii_case("max_completion_tokens")
            {
                AITokenParameter::MaxCompletionTokens
            } else {
                AITokenParameter::MaxTokens
            };
            preset.parameter_profile.thinking_strategy =
                match profile.thinking_parameter.to_ascii_lowercase().as_str() {
                    "none" => AIThinkingStrategy::None,
                    "enable_thinking" | "boolean" => AIThinkingStrategy::EnableThinkingBoolean,
                    "reasoning_effort" => AIThinkingStrategy::ReasoningEffort,
                    "minimax_reasoning_split" | "reasoning_split" => {
                        AIThinkingStrategy::MiniMaxReasoningSplit
                    }
                    "prompt_only" => AIThinkingStrategy::PromptOnly,
                    _ => AIThinkingStrategy::GenericThinkingObject,
                };
        }
        let client = Client::builder()
            .timeout(Duration::from_secs(settings.timeout_seconds.max(1)))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .ok();
        Self {
            settings,
            preset,
            client,
        }
    }

    fn request_url(&self) -> Result<String, AIProviderError> {
        join_base_url_and_chat_path(&self.settings.base_url, &self.settings.chat_path)
    }

    fn client(&self) -> Result<&Client, AIProviderError> {
        self.client
            .as_ref()
            .ok_or_else(|| self.error("failed to build AI HTTP client"))
    }

    fn authorize_request(
        &self,
        builder: reqwest::blocking::RequestBuilder,
    ) -> reqwest::blocking::RequestBuilder {
        let api_key = self.settings.api_key.trim();
        if api_key.is_empty() {
            return builder;
        }
        match self.preset.auth_kind {
            AIAuthKind::BearerApiKey | AIAuthKind::QianfanAkSk => builder.bearer_auth(api_key),
            AIAuthKind::ApiKeyHeader => builder.header("X-API-Key", api_key),
            AIAuthKind::None => builder,
        }
    }

    fn trace_secrets(&self, request: &AIChatRequest) -> Vec<String> {
        let mut secrets = vec![self.settings.api_key.clone()];
        if let Some(context) = request.provider_options.trace_context.as_ref() {
            secrets.extend(context.redaction_secrets.iter().cloned());
        }
        secrets
    }

    fn error(&self, message: impl Into<String>) -> AIProviderError {
        AIProviderError::new(redact_api_key(&message.into(), &self.settings.api_key))
    }

    pub fn send_chat_request_raw(
        &self,
        request: AIChatRequest,
    ) -> Result<AIRawProviderResponse, AIProviderError> {
        let started = Instant::now();
        let url = self.request_url()?;
        let (body, request_used_response_format, request_used_thinking_field) =
            self.build_chat_body(&request)?;
        let trace_mode = self.settings.diagnostics_mode;
        let mut trace = self.build_trace(
            &request,
            &body,
            &url,
            request_used_response_format,
            request_used_thinking_field.clone(),
        );

        let mut builder = self
            .client()?
            .post(&url)
            .header(reqwest::header::CONTENT_TYPE, "application/json");
        builder = self.authorize_request(builder);

        let response = match builder.json(&Value::Object(body)).send() {
            Ok(response) => response,
            Err(error) => {
                let message = self.error(format!("AI request failed: {error}"));
                trace.elapsed_ms = started.elapsed().as_millis();
                trace.parse_stage = "transport_error".to_string();
                trace.error_code = Some("transport_error".to_string());
                trace.error_message = Some(message.to_string());
                record_trace(trace_mode, trace, true);
                return Err(message);
            }
        };
        let status = response.status();
        if status.is_redirection() {
            let message = self.error(format!(
                "AI provider redirect rejected: HTTP {}",
                status.as_u16()
            ));
            trace.elapsed_ms = started.elapsed().as_millis();
            trace.response.http_status = Some(status.as_u16());
            trace.parse_stage = "transport_error".to_string();
            trace.error_code = Some("redirect_rejected".to_string());
            trace.error_message = Some(message.to_string());
            record_trace(trace_mode, trace, true);
            return Err(message);
        }
        let response_text = response
            .text()
            .map_err(|error| self.error(format!("failed to read AI response: {error}")))?;
        let trace_secrets = self.trace_secrets(&request);
        let redactor = SecretRedactor::new(trace_secrets.iter().map(String::as_str));
        let (redacted_response, raw_truncated) = redactor.redact_optional_text(
            Some(&response_text),
            super::trace::MAX_RAW_PROVIDER_RESPONSE_CHARS,
        );
        let redacted_response = redacted_response.unwrap_or_default();
        let response_summary = serde_json::from_str::<Value>(&response_text)
            .map(|value| summarize_provider_response(&value))
            .unwrap_or_else(|error| format!("provider response summary: invalid_json={error}"));

        trace.elapsed_ms = started.elapsed().as_millis();
        trace.response = response_trace_metadata(status.as_u16(), &response_text);
        trace.raw_provider_response = Some(redacted_response.clone());
        trace.truncated |= raw_truncated;
        trace.parse_stage = if status.is_success() {
            "provider_response".to_string()
        } else {
            "http_error".to_string()
        };
        if !status.is_success() {
            trace.error_code = Some(format!("http_{}", status.as_u16()));
            trace.error_message = Some(format!(
                "AI provider returned HTTP {}: {}",
                status.as_u16(),
                short_response(&redacted_response)
            ));
        }
        let trace_id = record_trace(trace_mode, trace.clone(), !status.is_success());
        let pending_trace = if trace_id.is_none() && !matches!(trace_mode, AITraceMode::Off) {
            Some(trace)
        } else {
            None
        };

        Ok(AIRawProviderResponse {
            status: status.as_u16(),
            response_text: redacted_response,
            request_used_response_format,
            request_used_thinking_field,
            response_summary,
            trace_id,
            pending_trace,
        })
    }

    fn build_trace(
        &self,
        request: &AIChatRequest,
        body: &Map<String, Value>,
        url: &str,
        request_used_response_format: bool,
        request_used_thinking_field: Option<String>,
    ) -> AIRequestTrace {
        let parsed_url = url::Url::parse(url).ok();
        let mut extra_body_keys = body
            .keys()
            .filter(|key| {
                !matches!(
                    key.as_str(),
                    "model"
                        | "messages"
                        | "stream"
                        | "temperature"
                        | "max_tokens"
                        | "max_completion_tokens"
                        | "response_format"
                        | "thinking"
                        | "enable_thinking"
                        | "reasoning_split"
                        | "reasoning_effort"
                )
            })
            .cloned()
            .collect::<Vec<_>>();
        extra_body_keys.sort();
        let context = request
            .provider_options
            .trace_context
            .clone()
            .unwrap_or_default();
        AIRequestTrace {
            trace_id: String::new(),
            job_id: context.job_id.clone(),
            batch_id: context.batch_id.clone(),
            started_at: now_iso(),
            elapsed_ms: 0,
            operation: context.operation,
            provider_id: format!("{:?}", self.preset.id),
            provider_label: self.preset.label.to_string(),
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
                    .unwrap_or_else(|| "/".to_string()),
                message_count: request.messages.len(),
                target_count: context.target_count,
                batch_size: context.batch_size,
                max_tokens: Some(request.max_tokens),
                temperature: body
                    .get("temperature")
                    .and_then(Value::as_f64)
                    .map(|temperature| temperature as f32),
                force_json: request.force_json,
                response_format: request_used_response_format.then(|| "json_object".to_string()),
                thinking_mode: request_used_thinking_field,
                extra_body_keys,
            },
            parse_stage: "request_sent".to_string(),
            ..AIRequestTrace::default()
        }
    }

    fn build_chat_body(&self, request: &AIChatRequest) -> Result<ChatBody, AIProviderError> {
        let mut body = Map::new();
        body.insert("model".to_string(), json!(request.model));
        body.insert(
            "messages".to_string(),
            json!(messages_with_instructions(
                &request.messages,
                request.force_json,
                thinking_enabled(&self.settings, request),
                self.preset.id
            )),
        );
        let temperature = request.temperature.clamp(
            self.preset.parameter_profile.temperature_min as f32,
            self.preset.parameter_profile.temperature_max as f32,
        );
        body.insert("temperature".to_string(), json!(temperature));
        let token_field = match self.preset.parameter_profile.token_parameter {
            AITokenParameter::MaxTokens => "max_tokens",
            AITokenParameter::MaxCompletionTokens => "max_completion_tokens",
        };
        body.insert(token_field.to_string(), json!(request.max_tokens));

        let response_format_enabled = request.provider_options.use_response_format.unwrap_or(
            self.preset
                .capabilities
                .supports_response_format_json_object,
        );
        if request.force_json && response_format_enabled {
            body.insert(
                "response_format".to_string(),
                json!({ "type": "json_object" }),
            );
        }

        // Advanced fields may extend the request, but core request semantics stay authoritative.
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

        let enable_thinking = thinking_enabled(&self.settings, request);
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
        match self.preset.parameter_profile.thinking_strategy {
            AIThinkingStrategy::DeepSeekThinkingObject
                if self.preset.capabilities.supports_thinking_toggle =>
            {
                body.insert(
                    "thinking".to_string(),
                    json!({ "type": if enable_thinking { "enabled" } else { "disabled" } }),
                );
            }
            AIThinkingStrategy::GenericThinkingObject
                if self.preset.capabilities.supports_thinking_toggle =>
            {
                body.insert(
                    "thinking".to_string(),
                    json!({ "type": if enable_thinking { "enabled" } else { "disabled" } }),
                );
            }
            AIThinkingStrategy::EnableThinkingBoolean
                if self.preset.capabilities.supports_thinking_toggle =>
            {
                body.insert("enable_thinking".to_string(), json!(enable_thinking));
            }
            AIThinkingStrategy::MiniMaxReasoningSplit => {
                body.insert("reasoning_split".to_string(), json!(enable_thinking));
            }
            _ => {}
        }

        let request_used_thinking_field = body.get("thinking").map(thinking_field_text);
        let request_used_thinking_field = request_used_thinking_field.or_else(|| {
            body.get("enable_thinking").map(|value| {
                value
                    .as_bool()
                    .map(|enabled| enabled.to_string())
                    .unwrap_or_else(|| value.to_string())
            })
        });
        Ok((
            body,
            request.force_json && response_format_enabled,
            request_used_thinking_field,
        ))
    }
}

impl AIProvider for OpenAICompatibleProvider {
    fn chat_json(&self, request: AIChatRequest) -> Result<String, AIProviderError> {
        let raw = self.send_chat_request_raw(request.clone())?;
        if !(200..300).contains(&raw.status) {
            let mut message = format!(
                "AI provider returned HTTP {}: {}",
                raw.status,
                short_response(&raw.response_text)
            );
            if self.preset.id == AIProviderPresetId::DeepSeek
                && !thinking_enabled(&self.settings, &request)
            {
                message.push_str(
                    " If DeepSeek rejects thinking disabled, use a non-thinking model or a compatible legacy model name.",
                );
            }
            let error = self.error(message);
            if let Some(trace_id) = raw.trace_id.as_deref() {
                let trace_secrets = self.trace_secrets(&request);
                update_trace_with_secrets(
                    trace_id,
                    AITraceUpdate {
                        parse_stage: Some("http_error".to_string()),
                        error_code: Some(format!("http_{}", raw.status)),
                        error_message: Some(error.to_string()),
                        ..AITraceUpdate::default()
                    },
                    trace_secrets.iter().map(String::as_str),
                );
            }
            return Err(error);
        }

        match parse_openai_content(&raw.response_text) {
            Ok(content) => {
                let cleaned_json_text = clean_ai_json_text(&content);
                let parsed_json = serde_json::from_str::<Value>(&cleaned_json_text)
                    .ok()
                    .or_else(|| {
                        extract_first_json_value(&content)
                            .and_then(|value| serde_json::from_str::<Value>(&value).ok())
                    });
                if let Some(trace_id) = raw.trace_id.as_deref() {
                    let trace_secrets = self.trace_secrets(&request);
                    update_trace_with_secrets(
                        trace_id,
                        AITraceUpdate {
                            extracted_content: Some(content.clone()),
                            cleaned_json_text: Some(cleaned_json_text),
                            parsed_json,
                            parse_stage: Some("extracted_content".to_string()),
                            ..AITraceUpdate::default()
                        },
                        trace_secrets.iter().map(String::as_str),
                    );
                }
                Ok(content)
            }
            Err(error) => {
                let error = self.error(error);
                let trace_secrets = self.trace_secrets(&request);
                if let Some(trace_id) = raw.trace_id.as_deref() {
                    update_trace_with_secrets(
                        trace_id,
                        AITraceUpdate {
                            parse_stage: Some("parse_error".to_string()),
                            error_code: Some("response_parse_error".to_string()),
                            error_message: Some(error.to_string()),
                            ..AITraceUpdate::default()
                        },
                        trace_secrets.iter().map(String::as_str),
                    );
                } else if let Some(mut trace) = raw.pending_trace {
                    trace.parse_stage = "parse_error".to_string();
                    trace.error_code = Some("response_parse_error".to_string());
                    trace.error_message = Some(
                        SecretRedactor::new(trace_secrets.iter().map(String::as_str))
                            .redact_text(&error.to_string()),
                    );
                    record_trace(self.settings.diagnostics_mode, trace, true);
                }
                Err(error)
            }
        }
    }

    fn test_connection(&self) -> Result<AIConnectionTestResult, AIProviderError> {
        let mut prompt = "Return exactly this JSON and nothing else: {\"ok\":true}\nDo not output Markdown.\nDo not output reasoning.\nDo not output <think>.\nDo not explain.".to_string();
        if self.preset.id == AIProviderPresetId::DeepSeek && !self.settings.enable_thinking {
            prompt.push_str("\nUse non-thinking mode and only return final content.");
        }
        let test_max_tokens = self.settings.max_tokens.clamp(512, 4096);
        let content = self.chat_json(AIChatRequest {
            messages: vec![AIChatMessage {
                role: "user".to_string(),
                content: prompt,
            }],
            model: self.settings.model.clone(),
            temperature: 0.0,
            max_tokens: test_max_tokens,
            force_json: true,
            provider_options: AIProviderOptions {
                trace_context: Some(AITraceContext {
                    operation: AITraceOperation::ConnectionTest,
                    ..Default::default()
                }),
                ..Default::default()
            },
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

    fn discover_models(&self) -> Result<Vec<AIModelInfo>, AIProviderError> {
        let models_path = self
            .settings
            .models_path
            .as_deref()
            .or(self.preset.models_path)
            .filter(|path| !path.trim().is_empty())
            .ok_or_else(|| {
                self.error("This provider does not expose an OpenAI-compatible models endpoint.")
            })?;
        let url = join_base_url_and_chat_path(&self.settings.base_url, models_path)?;
        let mut builder = self
            .client()?
            .get(url)
            .header(reqwest::header::ACCEPT, "application/json");
        builder = self.authorize_request(builder);
        let response = builder
            .send()
            .map_err(|error| self.error(format!("AI model discovery request failed: {error}")))?;
        let status = response.status();
        let text = response.text().map_err(|error| {
            self.error(format!(
                "failed to read AI model discovery response: {error}"
            ))
        })?;
        if !status.is_success() {
            return Err(self.error(format!(
                "AI model discovery returned HTTP {}: {}",
                status.as_u16(),
                short_response(&redact_api_key(&text, &self.settings.api_key))
            )));
        }
        parse_model_list(&text).map_err(|error| self.error(error))
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
        instructions.push("Return JSON only; the final content must be one complete valid JSON object. Include the word JSON. Do not wrap JSON in markdown or code fences.".to_string());
    }
    if !enable_thinking {
        instructions.push("Do not output thinking, reasoning traces, or explanations; return the final JSON content directly.".to_string());
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
        if matches!(
            key.as_str(),
            "model"
                | "messages"
                | "stream"
                | "temperature"
                | "max_tokens"
                | "max_completion_tokens"
                | "response_format"
                | "thinking"
                | "reasoning_effort"
                | "enable_thinking"
                | "reasoning_split"
                | "reasoning"
        ) {
            continue;
        }
        body.insert(key, value);
    }
    Ok(())
}

fn parse_openai_content(text: &str) -> Result<String, String> {
    let value = serde_json::from_str::<Value>(text)
        .map_err(|error| format!("AI provider returned invalid JSON: {error}"))?;
    let summary = summarize_provider_response(&value);
    let finish_reason = response_finish_reason(&value);
    if matches!(finish_reason.as_deref(), Some("length" | "max_tokens")) {
        return Err(format!(
            "模型输出达到长度上限，JSON 被截断。AI provider finish_reason={}。请提高 max_tokens 或降低 batch size。 {summary}",
            finish_reason.as_deref().unwrap_or("length")
        ));
    }
    if matches!(finish_reason.as_deref(), Some("content_filter" | "safety")) {
        return Err(format!(
            "AI provider blocked the response because of content filtering (finish_reason={}). {summary}",
            finish_reason.as_deref().unwrap_or("content_filter")
        ));
    }

    let reasoning = response_reasoning_text(&value);
    let content = response_content_text(&value);
    match content {
        Some(content) if !content.trim().is_empty() => {
            validate_content_has_jsonish_text(strip_think_tags_if_needed(content), &summary)
        }
        Some(_) if !reasoning.trim().is_empty() => Err(format!(
            "AI provider returned reasoning_content but empty content. Please disable Thinking or use a non-thinking model. {summary}"
        )),
        Some(_) => Err(format!(
            "AI provider returned empty message.content. JSON content is empty and should be retried. {summary}"
        )),
        None if !reasoning.trim().is_empty() => Err(format!(
            "AI provider returned reasoning_content but no final content. Please disable Thinking or use a non-thinking model. {summary}"
        )),
        None => Err(format!(
            "AI provider response did not contain message.content, message.output_text, or message.text. {summary}"
        )),
    }
}

fn response_finish_reason(value: &Value) -> Option<String> {
    value
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("finish_reason"))
        .or_else(|| value.get("finish_reason"))
        .and_then(Value::as_str)
        .map(ToString::to_string)
}

fn response_content_text(value: &Value) -> Option<String> {
    let choice = value
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first());
    let message = choice.and_then(|choice| choice.get("message"));
    for candidate in [
        message.and_then(|message| message.get("content")),
        message.and_then(|message| message.get("output_text")),
        message.and_then(|message| message.get("text")),
        choice.and_then(|choice| choice.get("text")),
        value.get("output_text"),
        value.get("content"),
        value.get("output").and_then(|output| output.get("text")),
        value.get("output").and_then(|output| output.get("content")),
    ] {
        if let Some(candidate) = candidate {
            if let Some(text) = content_value_to_text(candidate) {
                return Some(text);
            }
        }
    }
    None
}

fn response_reasoning_text(value: &Value) -> String {
    let choice = value
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first());
    let message = choice.and_then(|choice| choice.get("message"));
    [
        message.and_then(|message| message.get("reasoning_content")),
        message.and_then(|message| message.get("reasoning_details")),
        choice.and_then(|choice| choice.get("reasoning_content")),
        value.get("reasoning_content"),
        value.get("reasoning_details"),
    ]
    .into_iter()
    .flatten()
    .filter_map(content_value_to_text)
    .collect::<Vec<_>>()
    .join("\n")
}

fn response_trace_metadata(status: u16, text: &str) -> AITraceResponse {
    let Ok(value) = serde_json::from_str::<Value>(text) else {
        return AITraceResponse {
            http_status: Some(status),
            ..AITraceResponse::default()
        };
    };
    let choice = value
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first());
    let message = choice
        .and_then(|choice| choice.get("message"))
        .and_then(Value::as_object);
    let mut message_keys = message
        .map(|message| message.keys().cloned().collect::<Vec<_>>())
        .unwrap_or_default();
    message_keys.sort();
    let content_value = message
        .and_then(|message| message.get("content"))
        .or_else(|| value.get("content"));
    let reasoning_value = message
        .and_then(|message| message.get("reasoning_content"))
        .or_else(|| message.and_then(|message| message.get("reasoning_details")))
        .or_else(|| value.get("reasoning_content"));
    let usage = value.get("usage").map(|usage| AITraceUsage {
        prompt_tokens: usage_number(usage, &["prompt_tokens", "input_tokens"]),
        completion_tokens: usage_number(usage, &["completion_tokens", "output_tokens"]),
        total_tokens: usage_number(usage, &["total_tokens"]),
    });
    AITraceResponse {
        http_status: Some(status),
        finish_reason: response_finish_reason(&value),
        message_keys,
        content_type: content_value.map(json_type_name).map(ToString::to_string),
        content_length: Some(value_text_len(content_value)),
        reasoning_content_length: Some(value_text_len(reasoning_value)),
        usage,
    }
}

fn usage_number(value: &Value, keys: &[&str]) -> Option<u64> {
    keys.iter()
        .find_map(|key| value.get(*key).and_then(Value::as_u64))
}

fn strip_think_tags_if_needed(content: String) -> String {
    let mut output = content;
    loop {
        let Some(start) = output.to_ascii_lowercase().find("<think>") else {
            break;
        };
        let Some(relative_end) = output[start..].to_ascii_lowercase().find("</think>") else {
            break;
        };
        let end = start + relative_end + "</think>".len();
        output.replace_range(start..end, "");
    }
    output.trim().to_string()
}

pub fn debug_extract_openai_response(raw_response: &str) -> AIDebugExtractResult {
    let value = match serde_json::from_str::<Value>(raw_response) {
        Ok(value) => value,
        Err(error) => {
            return AIDebugExtractResult {
                finish_reason: None,
                message_keys: Vec::new(),
                message_content: None,
                reasoning_content: None,
                output_text: None,
                text: None,
                extracted_content: None,
                parse_error: Some(format!("provider raw response is not JSON: {error}")),
            };
        }
    };
    let choice = value
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first());
    let message = choice
        .and_then(|choice| choice.get("message"))
        .and_then(Value::as_object);
    let mut message_keys = message
        .map(|message| message.keys().cloned().collect::<Vec<_>>())
        .unwrap_or_default();
    message_keys.sort();
    let message_content = message
        .and_then(|message| message.get("content"))
        .and_then(content_value_to_text);
    let output_text = message
        .and_then(|message| message.get("output_text"))
        .and_then(content_value_to_text);
    let text = message
        .and_then(|message| message.get("text"))
        .and_then(content_value_to_text);
    let extracted_content = message_content
        .clone()
        .or_else(|| output_text.clone())
        .or_else(|| text.clone());

    AIDebugExtractResult {
        finish_reason: choice
            .and_then(|choice| choice.get("finish_reason"))
            .and_then(Value::as_str)
            .map(ToString::to_string),
        message_keys,
        message_content,
        reasoning_content: message
            .and_then(|message| message.get("reasoning_content"))
            .and_then(content_value_to_text),
        output_text,
        text,
        extracted_content,
        parse_error: message
            .is_none()
            .then(|| "provider response did not contain choices[0].message".to_string()),
    }
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

fn thinking_field_text(value: &Value) -> String {
    value
        .get("type")
        .and_then(Value::as_str)
        .map(ToString::to_string)
        .unwrap_or_else(|| {
            serde_json::to_string(value).unwrap_or_else(|_| json_type_name(value).to_string())
        })
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
                } else if let Some(text) = object
                    .get("text")
                    .or_else(|| object.get("content"))
                    .or_else(|| object.get("value"))
                    .and_then(Value::as_str)
                {
                    output.push_str(text);
                }
            }
            Some(output)
        }
        Value::Object(object) => object
            .get("text")
            .or_else(|| object.get("content"))
            .or_else(|| object.get("value"))
            .and_then(Value::as_str)
            .map(ToString::to_string),
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

fn parse_model_list(text: &str) -> Result<Vec<AIModelInfo>, String> {
    let value = serde_json::from_str::<Value>(text)
        .map_err(|error| format!("AI model discovery returned invalid JSON: {error}"))?;
    let models = value
        .get("data")
        .or_else(|| value.get("models"))
        .unwrap_or(&value);
    let items = models
        .as_array()
        .ok_or_else(|| "AI model discovery response did not contain a model array.".to_string())?;
    let mut result = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for item in items {
        let (id, owned_by) = match item {
            Value::String(id) => (id.trim().to_string(), None),
            Value::Object(object) => {
                let id = object
                    .get("id")
                    .or_else(|| object.get("name"))
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .trim()
                    .to_string();
                let owned_by = object
                    .get("owned_by")
                    .or_else(|| object.get("ownedBy"))
                    .and_then(Value::as_str)
                    .map(ToString::to_string);
                (id, owned_by)
            }
            _ => (String::new(), None),
        };
        if !id.is_empty() && seen.insert(id.clone()) {
            result.push(AIModelInfo {
                id,
                owned_by,
                discovered: true,
            });
        }
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::schema::AIProviderOptions;
    use std::{
        io::{Read, Write},
        net::TcpListener,
        thread,
    };

    #[test]
    fn extra_body_cannot_override_reserved_fields() {
        let mut body = Map::from_iter([
            ("model".to_string(), json!("trusted-model")),
            (
                "messages".to_string(),
                json!([{"role":"user","content":"safe"}]),
            ),
            ("temperature".to_string(), json!(0.2)),
            ("max_tokens".to_string(), json!(1024)),
            ("response_format".to_string(), json!({"type":"json_object"})),
        ]);

        merge_extra_body(
            &mut body,
            Some(r#"{"model":"attacker","messages":[],"stream":true,"temperature":2,"max_tokens":999999,"max_completion_tokens":999999,"response_format":{"type":"text"},"thinking":{"type":"enabled"},"reasoning_effort":"high","safe_extension":true}"#),
            "",
        )
        .expect("merge safe extension fields");

        assert_eq!(body["model"], "trusted-model");
        assert_eq!(body["messages"][0]["content"], "safe");
        assert_eq!(body["temperature"], 0.2);
        assert_eq!(body["max_tokens"], 1024);
        assert_eq!(body["response_format"]["type"], "json_object");
        for key in [
            "stream",
            "max_completion_tokens",
            "thinking",
            "reasoning_effort",
        ] {
            assert!(!body.contains_key(key), "{key}");
        }
        assert_eq!(body["safe_extension"], true);
    }

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
    fn model_discovery_parses_openai_data_and_deduplicates_ids() {
        let models = parse_model_list(
            r#"{"data":[{"id":"deepseek-v4-flash","owned_by":"deepseek"},{"id":"deepseek-v4-flash"},{"id":""}]}"#,
        )
        .expect("model list");
        assert_eq!(models.len(), 1);
        assert_eq!(models[0].id, "deepseek-v4-flash");
        assert_eq!(models[0].owned_by.as_deref(), Some("deepseek"));
    }

    #[test]
    fn deepseek_force_json_uses_json_object_response_format() {
        let provider = OpenAICompatibleProvider::new(AISettings::default());
        let (_, used_response_format, thinking) = provider
            .build_chat_body(&AIChatRequest {
                messages: vec![AIChatMessage {
                    role: "user".to_string(),
                    content: "Return JSON.".to_string(),
                }],
                model: "deepseek-v4-flash".to_string(),
                temperature: 0.0,
                max_tokens: 8192,
                force_json: true,
                provider_options: AIProviderOptions::default(),
            })
            .expect("build DeepSeek body");
        let (body, _, _) = provider
            .build_chat_body(&AIChatRequest {
                messages: vec![AIChatMessage {
                    role: "user".to_string(),
                    content: "Return JSON.".to_string(),
                }],
                model: "deepseek-v4-flash".to_string(),
                temperature: 0.0,
                max_tokens: 8192,
                force_json: true,
                provider_options: AIProviderOptions::default(),
            })
            .expect("build DeepSeek body");
        assert!(used_response_format);
        assert_eq!(body["response_format"]["type"], "json_object");
        assert_eq!(thinking.as_deref(), Some("disabled"));
    }

    #[test]
    fn json_only_retry_keeps_response_format_and_disables_thinking() {
        let mut settings = AISettings::default();
        settings.enable_thinking = true;
        let provider = OpenAICompatibleProvider::new(settings);
        let (body, used_response_format, thinking) = provider
            .build_chat_body(&AIChatRequest {
                messages: Vec::new(),
                model: "deepseek-v4-flash".to_string(),
                temperature: 0.0,
                max_tokens: 512,
                force_json: true,
                provider_options: AIProviderOptions {
                    enable_thinking: Some(false),
                    use_response_format: Some(true),
                    ..Default::default()
                },
            })
            .expect("build retry body");
        assert!(used_response_format);
        assert_eq!(body["response_format"]["type"], "json_object");
        assert_eq!(body["thinking"]["type"], "disabled");
        assert_eq!(thinking.as_deref(), Some("disabled"));
    }

    #[test]
    fn registry_profiles_select_provider_specific_payload_fields() {
        let mut minimax_settings = AISettings::default();
        minimax_settings.preset = AIProviderPresetId::Minimax;
        minimax_settings.base_url = "https://api.minimaxi.com/v1".to_string();
        minimax_settings.enable_thinking = true;
        let minimax = OpenAICompatibleProvider::new(minimax_settings);
        let (body, _, _) = minimax
            .build_chat_body(&AIChatRequest {
                messages: Vec::new(),
                model: "MiniMax-M2.5".to_string(),
                temperature: 1.5,
                max_tokens: 100,
                force_json: true,
                provider_options: AIProviderOptions::default(),
            })
            .expect("MiniMax body");
        assert_eq!(body["max_completion_tokens"], 100);
        assert_eq!(body["reasoning_split"], true);
        assert_eq!(body["temperature"], 1.0);

        let mut qwen_settings = AISettings::default();
        qwen_settings.preset = AIProviderPresetId::QwenDashScope;
        qwen_settings.base_url = "https://dashscope.aliyuncs.com/compatible-mode/v1".to_string();
        qwen_settings.enable_thinking = true;
        let qwen = OpenAICompatibleProvider::new(qwen_settings);
        let (body, _, _) = qwen
            .build_chat_body(&AIChatRequest {
                messages: Vec::new(),
                model: "qwen-plus".to_string(),
                temperature: 0.2,
                max_tokens: 100,
                force_json: true,
                provider_options: AIProviderOptions::default(),
            })
            .expect("Qwen body");
        assert_eq!(body["response_format"]["type"], "json_object");
        assert_eq!(body["enable_thinking"], true);
    }

    #[test]
    fn finish_reason_length_is_reported_as_truncated_json() {
        let error = parse_openai_content(
            r#"{"choices":[{"finish_reason":"length","message":{"content":"{\"classifications\":["}}]}"#,
        )
        .expect_err("length-limited output must fail");
        assert!(error.contains("模型输出达到长度上限，JSON 被截断。"));
        assert!(error.contains("finish_reason=length"));
    }

    #[test]
    fn empty_json_content_is_explicitly_retryable() {
        let error = parse_openai_content(
            r#"{"choices":[{"finish_reason":"stop","message":{"content":""}}]}"#,
        )
        .expect_err("empty content must fail");
        assert!(error.contains("AI provider returned empty message.content."));
        assert!(error.contains("JSON content is empty and should be retried"));
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

    #[test]
    fn provider_rejects_redirects_without_forwarding_credentials() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind redirect fixture");
        let address = listener.local_addr().expect("redirect address");
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept redirect request");
            let mut request = [0_u8; 4096];
            let size = stream.read(&mut request).expect("read redirect request");
            let request = String::from_utf8_lossy(&request[..size]);
            assert!(request
                .to_ascii_lowercase()
                .contains("authorization: bearer sk-provider-secret"));
            stream
                .write_all(
                    b"HTTP/1.1 307 Temporary Redirect\r\nLocation: http://127.0.0.1:9/second\r\nContent-Length: 0\r\n\r\n",
                )
                .expect("write redirect response");
        });

        let settings = AISettings {
            base_url: format!("http://{address}"),
            api_key: "sk-provider-secret".to_string(),
            ..AISettings::default()
        };
        let provider = OpenAICompatibleProvider::new(settings);
        let error = provider
            .send_chat_request_raw(AIChatRequest {
                messages: vec![AIChatMessage {
                    role: "user".to_string(),
                    content: "hello".to_string(),
                }],
                model: "test-model".to_string(),
                temperature: 0.0,
                max_tokens: 16,
                force_json: false,
                provider_options: AIProviderOptions::default(),
            })
            .expect_err("redirect must be rejected");
        server.join().expect("redirect server");
        let message = error.to_string();
        assert!(message.contains("redirect rejected"));
        assert!(!message.contains("sk-provider-secret"));
    }
}
