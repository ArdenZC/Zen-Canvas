use std::time::Duration;

use reqwest::blocking::Client;
use serde_json::{json, Value};

use super::{
    openai_compatible::join_base_url_and_chat_path,
    provider::{AIProvider, AIProviderError},
    schema::{AIChatMessage, AIChatRequest, AIConnectionTestResult},
    settings::AISettings,
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

        let response = self
            .client()?
            .post(url)
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            .json(&body)
            .send()
            .map_err(|error| AIProviderError::new(format!("Ollama request failed: {error}")))?;
        let status = response.status();
        let text = response.text().map_err(|error| {
            AIProviderError::new(format!("failed to read Ollama response: {error}"))
        })?;
        if !status.is_success() {
            return Err(AIProviderError::new(format!(
                "Ollama returned HTTP {status}: {text}"
            )));
        }
        parse_ollama_content(&text)
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
