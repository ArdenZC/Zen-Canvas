use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AIProviderKind {
    #[serde(rename = "openai_compatible")]
    OpenAICompatible,
    #[serde(rename = "ollama")]
    Ollama,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AIProviderPresetId {
    #[serde(rename = "deepseek")]
    DeepSeek,
    #[serde(rename = "kimi")]
    Kimi,
    #[serde(rename = "qwen_dashscope")]
    QwenDashScope,
    #[serde(rename = "zhipu_glm")]
    ZhipuGlm,
    #[serde(rename = "minimax")]
    Minimax,
    #[serde(rename = "baichuan")]
    Baichuan,
    #[serde(rename = "doubao_ark")]
    DoubaoArk,
    #[serde(rename = "siliconflow")]
    Siliconflow,
    #[serde(rename = "custom_openai_compatible")]
    CustomOpenAICompatible,
    #[serde(rename = "ollama")]
    Ollama,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AIChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AIChatRequest {
    pub messages: Vec<AIChatMessage>,
    pub model: String,
    pub temperature: f32,
    pub max_tokens: u32,
    pub force_json: bool,
    pub provider_options: AIProviderOptions,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AIConnectionTestResult {
    pub ok: bool,
    pub message: String,
    pub model: Option<String>,
    pub provider: Option<AIProviderKind>,
    pub preset: Option<AIProviderPresetId>,
    pub elapsed_ms: u128,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIProviderOptions {
    pub enable_thinking: Option<bool>,
    pub reasoning_effort: Option<String>,
    pub extra_body_json: Option<String>,
    pub use_response_format: Option<bool>,
}
