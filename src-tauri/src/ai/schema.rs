use serde::{Deserialize, Serialize};

use super::trace::AITraceContext;

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
    #[serde(rename = "hunyuan")]
    Hunyuan,
    #[serde(rename = "baidu_qianfan")]
    BaiduQianfan,
    #[serde(rename = "stepfun")]
    StepFun,
    #[serde(rename = "yi")]
    Yi,
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
#[serde(rename_all = "camelCase")]
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
    #[serde(default)]
    pub trace_context: Option<AITraceContext>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AICustomProviderProfile {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub chat_path: String,
    pub models_path: Option<String>,
    pub model: String,
    pub supports_response_format: bool,
    pub supports_thinking: bool,
    pub thinking_parameter: String,
    pub token_parameter: String,
    pub content_path: String,
    pub reasoning_path: String,
    pub temperature_min: f32,
    pub temperature_max: f32,
    pub max_output_tokens: u32,
    pub extra_body_json: Option<String>,
    #[serde(default)]
    pub api_key_configured: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIModelInfo {
    pub id: String,
    pub owned_by: Option<String>,
    pub discovered: bool,
}
