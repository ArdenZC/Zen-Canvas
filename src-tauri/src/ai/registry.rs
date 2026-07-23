use serde::{Deserialize, Serialize};

use super::schema::{AIProviderKind, AIProviderPresetId};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AIAuthKind {
    None,
    BearerApiKey,
    ApiKeyHeader,
    QianfanAkSk,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AITokenParameter {
    MaxTokens,
    MaxCompletionTokens,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AIThinkingStrategy {
    None,
    DeepSeekThinkingObject,
    GenericThinkingObject,
    EnableThinkingBoolean,
    ReasoningEffort,
    MiniMaxReasoningSplit,
    PromptOnly,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResponseFieldPath {
    ChoicesMessageContent,
    ChoicesMessageOutputText,
    ChoicesMessageText,
    ChoicesMessageReasoningContent,
    ChoicesMessageReasoningDetails,
    RootOutputText,
    RootContent,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIProviderCapabilities {
    pub supports_model_discovery: bool,
    pub supports_response_format_json_object: bool,
    pub supports_json_schema: bool,
    pub supports_thinking: bool,
    pub supports_thinking_toggle: bool,
    pub supports_reasoning_effort: bool,
    pub supports_usage: bool,
    pub supports_streaming: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIParameterProfile {
    pub temperature_min: f64,
    pub temperature_max: f64,
    pub default_temperature: f64,
    pub max_output_tokens: Option<u32>,
    pub token_parameter: AITokenParameter,
    pub thinking_strategy: AIThinkingStrategy,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AIResponseProfile {
    pub content_paths: &'static [ResponseFieldPath],
    pub reasoning_paths: &'static [ResponseFieldPath],
    pub finish_reason_paths: &'static [ResponseFieldPath],
    pub usage_paths: &'static [ResponseFieldPath],
    pub strip_think_tags: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AIEndpointVariant {
    pub id: &'static str,
    pub label: &'static str,
    pub base_url: &'static str,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AIProviderDescriptor {
    pub id: AIProviderPresetId,
    pub label: &'static str,
    pub provider_kind: AIProviderKind,
    pub default_base_url: &'static str,
    pub default_chat_path: &'static str,
    pub models_path: Option<&'static str>,
    pub default_model: &'static str,
    pub suggested_models: &'static [&'static str],
    pub auth_kind: AIAuthKind,
    pub capabilities: AIProviderCapabilities,
    pub parameter_profile: AIParameterProfile,
    pub response_profile: AIResponseProfile,
    pub endpoint_variants: &'static [AIEndpointVariant],
    pub api_key_env_hint: &'static str,
    pub docs_url: Option<&'static str>,
}

const OPENAI_CONTENT_PATHS: &[ResponseFieldPath] = &[
    ResponseFieldPath::ChoicesMessageContent,
    ResponseFieldPath::ChoicesMessageOutputText,
    ResponseFieldPath::ChoicesMessageText,
    ResponseFieldPath::RootOutputText,
    ResponseFieldPath::RootContent,
];
const OPENAI_REASONING_PATHS: &[ResponseFieldPath] = &[
    ResponseFieldPath::ChoicesMessageReasoningContent,
    ResponseFieldPath::ChoicesMessageReasoningDetails,
];
const OPENAI_FINISH_PATHS: &[ResponseFieldPath] = &[];
const OPENAI_USAGE_PATHS: &[ResponseFieldPath] = &[];
const EMPTY_ENDPOINTS: &[AIEndpointVariant] = &[];
const DEEPSEEK_MODELS: &[&str] = &["deepseek-v4-flash", "deepseek-v4-pro"];
const KIMI_MODELS: &[&str] = &["kimi-k2.6", "kimi-k2-thinking", "moonshot-v1-128k"];
const QWEN_MODELS: &[&str] = &["qwen-plus", "qwen3.6-plus", "qwen3.5-plus", "qwen3-vl-plus"];
const GLM_MODELS: &[&str] = &["glm-5.2", "glm-5", "glm-4.7", "glm-4.5"];
const MINIMAX_MODELS: &[&str] = &["MiniMax-M2.5", "MiniMax-M2.1", "MiniMax-M2"];
const DOUBAO_MODELS: &[&str] = &["ep-2024-...", "doubao-seed-1-6-250615"];
const HUNYUAN_MODELS: &[&str] = &["hunyuan-turbos", "hunyuan-pro"];
const STEPFUN_MODELS: &[&str] = &["step-3.5-flash", "step-3.5-turbo"];
const OLLAMA_MODELS: &[&str] = &["qwen3:8b", "llama3.2:3b"];

const DASHSCOPE_ENDPOINTS: &[AIEndpointVariant] = &[
    AIEndpointVariant {
        id: "cn-beijing",
        label: "中国内地（北京）",
        base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    },
    AIEndpointVariant {
        id: "us-virginia",
        label: "美国（弗吉尼亚）",
        base_url: "https://dashscope-us.aliyuncs.com/compatible-mode/v1",
    },
    AIEndpointVariant {
        id: "singapore-workspace",
        label: "新加坡（Workspace Endpoint）",
        base_url: "https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
    },
    AIEndpointVariant {
        id: "japan-workspace",
        label: "日本（Workspace Endpoint）",
        base_url: "https://{WorkspaceId}.ap-northeast-1.maas.aliyuncs.com/compatible-mode/v1",
    },
];

const OPENAI_RESPONSE_PROFILE: AIResponseProfile = AIResponseProfile {
    content_paths: OPENAI_CONTENT_PATHS,
    reasoning_paths: OPENAI_REASONING_PATHS,
    finish_reason_paths: OPENAI_FINISH_PATHS,
    usage_paths: OPENAI_USAGE_PATHS,
    strip_think_tags: false,
};
const MINIMAX_RESPONSE_PROFILE: AIResponseProfile = AIResponseProfile {
    content_paths: OPENAI_CONTENT_PATHS,
    reasoning_paths: OPENAI_REASONING_PATHS,
    finish_reason_paths: OPENAI_FINISH_PATHS,
    usage_paths: OPENAI_USAGE_PATHS,
    strip_think_tags: true,
};

const PROMPT_ONLY: AIProviderCapabilities = AIProviderCapabilities {
    supports_model_discovery: true,
    supports_response_format_json_object: false,
    supports_json_schema: false,
    supports_thinking: false,
    supports_thinking_toggle: false,
    supports_reasoning_effort: false,
    supports_usage: true,
    supports_streaming: true,
};

const DEFAULT_OPENAI_PARAMETERS: AIParameterProfile = AIParameterProfile {
    temperature_min: 0.0,
    temperature_max: 2.0,
    default_temperature: 0.0,
    max_output_tokens: None,
    token_parameter: AITokenParameter::MaxTokens,
    thinking_strategy: AIThinkingStrategy::PromptOnly,
};
const QWEN_CAPABILITIES: AIProviderCapabilities = AIProviderCapabilities {
    supports_model_discovery: true,
    supports_response_format_json_object: true,
    supports_json_schema: false,
    supports_thinking: true,
    supports_thinking_toggle: true,
    supports_reasoning_effort: false,
    supports_usage: true,
    supports_streaming: true,
};

pub static PROVIDER_REGISTRY: &[AIProviderDescriptor] = &[
    AIProviderDescriptor {
        id: AIProviderPresetId::DeepSeek,
        label: "DeepSeek",
        provider_kind: AIProviderKind::OpenAICompatible,
        default_base_url: "https://api.deepseek.com",
        default_chat_path: "/chat/completions",
        models_path: Some("/models"),
        default_model: "deepseek-v4-flash",
        suggested_models: DEEPSEEK_MODELS,
        auth_kind: AIAuthKind::BearerApiKey,
        capabilities: AIProviderCapabilities {
            supports_model_discovery: true,
            supports_response_format_json_object: true,
            supports_json_schema: false,
            supports_thinking: true,
            supports_thinking_toggle: true,
            supports_reasoning_effort: true,
            supports_usage: true,
            supports_streaming: true,
        },
        parameter_profile: AIParameterProfile {
            temperature_min: 0.0,
            temperature_max: 2.0,
            default_temperature: 0.0,
            max_output_tokens: Some(8192),
            token_parameter: AITokenParameter::MaxTokens,
            thinking_strategy: AIThinkingStrategy::DeepSeekThinkingObject,
        },
        response_profile: OPENAI_RESPONSE_PROFILE,
        endpoint_variants: EMPTY_ENDPOINTS,
        api_key_env_hint: "DEEPSEEK_API_KEY",
        docs_url: Some("https://api-docs.deepseek.com/"),
    },
    AIProviderDescriptor {
        id: AIProviderPresetId::Kimi,
        label: "Kimi / Moonshot",
        provider_kind: AIProviderKind::OpenAICompatible,
        default_base_url: "https://api.moonshot.ai/v1",
        default_chat_path: "/chat/completions",
        models_path: Some("/models"),
        default_model: "kimi-k2.6",
        suggested_models: KIMI_MODELS,
        auth_kind: AIAuthKind::BearerApiKey,
        capabilities: AIProviderCapabilities {
            supports_model_discovery: true,
            supports_response_format_json_object: true,
            supports_json_schema: false,
            supports_thinking: true,
            supports_thinking_toggle: true,
            supports_reasoning_effort: false,
            supports_usage: true,
            supports_streaming: true,
        },
        parameter_profile: AIParameterProfile {
            temperature_min: 0.0,
            temperature_max: 1.0,
            default_temperature: 0.0,
            max_output_tokens: Some(32768),
            token_parameter: AITokenParameter::MaxTokens,
            thinking_strategy: AIThinkingStrategy::GenericThinkingObject,
        },
        response_profile: OPENAI_RESPONSE_PROFILE,
        endpoint_variants: EMPTY_ENDPOINTS,
        api_key_env_hint: "MOONSHOT_API_KEY",
        docs_url: Some("https://platform.kimi.ai/docs"),
    },
    AIProviderDescriptor {
        id: AIProviderPresetId::QwenDashScope,
        label: "Qwen / 阿里云百炼",
        provider_kind: AIProviderKind::OpenAICompatible,
        default_base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        default_chat_path: "/chat/completions",
        models_path: Some("/models"),
        default_model: "qwen-plus",
        suggested_models: QWEN_MODELS,
        auth_kind: AIAuthKind::BearerApiKey,
        capabilities: QWEN_CAPABILITIES,
        parameter_profile: AIParameterProfile {
            temperature_min: 0.0,
            temperature_max: 2.0,
            default_temperature: 0.0,
            max_output_tokens: Some(32768),
            token_parameter: AITokenParameter::MaxTokens,
            thinking_strategy: AIThinkingStrategy::EnableThinkingBoolean,
        },
        response_profile: OPENAI_RESPONSE_PROFILE,
        endpoint_variants: DASHSCOPE_ENDPOINTS,
        api_key_env_hint: "DASHSCOPE_API_KEY",
        docs_url: Some("https://help.aliyun.com/model-studio/"),
    },
    AIProviderDescriptor {
        id: AIProviderPresetId::ZhipuGlm,
        label: "智谱 GLM",
        provider_kind: AIProviderKind::OpenAICompatible,
        default_base_url: "https://open.bigmodel.cn/api/paas/v4",
        default_chat_path: "/chat/completions",
        models_path: None,
        default_model: "glm-5.2",
        suggested_models: GLM_MODELS,
        auth_kind: AIAuthKind::BearerApiKey,
        capabilities: AIProviderCapabilities {
            supports_model_discovery: false,
            supports_response_format_json_object: true,
            supports_json_schema: false,
            supports_thinking: true,
            supports_thinking_toggle: true,
            supports_reasoning_effort: true,
            supports_usage: true,
            supports_streaming: true,
        },
        parameter_profile: AIParameterProfile {
            temperature_min: 0.0,
            temperature_max: 2.0,
            default_temperature: 0.0,
            max_output_tokens: Some(32768),
            token_parameter: AITokenParameter::MaxTokens,
            thinking_strategy: AIThinkingStrategy::GenericThinkingObject,
        },
        response_profile: OPENAI_RESPONSE_PROFILE,
        endpoint_variants: EMPTY_ENDPOINTS,
        api_key_env_hint: "ZHIPUAI_API_KEY",
        docs_url: Some("https://docs.bigmodel.cn/"),
    },
    AIProviderDescriptor {
        id: AIProviderPresetId::DoubaoArk,
        label: "豆包 / 火山方舟",
        provider_kind: AIProviderKind::OpenAICompatible,
        default_base_url: "https://ark.cn-beijing.volces.com/api/v3",
        default_chat_path: "/chat/completions",
        models_path: Some("/models"),
        default_model: "",
        suggested_models: DOUBAO_MODELS,
        auth_kind: AIAuthKind::BearerApiKey,
        capabilities: PROMPT_ONLY,
        parameter_profile: AIParameterProfile {
            temperature_min: 0.0,
            temperature_max: 2.0,
            default_temperature: 0.0,
            max_output_tokens: Some(32768),
            token_parameter: AITokenParameter::MaxTokens,
            thinking_strategy: AIThinkingStrategy::PromptOnly,
        },
        response_profile: OPENAI_RESPONSE_PROFILE,
        endpoint_variants: EMPTY_ENDPOINTS,
        api_key_env_hint: "ARK_API_KEY",
        docs_url: Some("https://www.volcengine.com/docs/82379"),
    },
    AIProviderDescriptor {
        id: AIProviderPresetId::Minimax,
        label: "MiniMax",
        provider_kind: AIProviderKind::OpenAICompatible,
        default_base_url: "https://api.minimaxi.com/v1",
        default_chat_path: "/chat/completions",
        models_path: Some("/models"),
        default_model: "MiniMax-M2.5",
        suggested_models: MINIMAX_MODELS,
        auth_kind: AIAuthKind::BearerApiKey,
        capabilities: AIProviderCapabilities {
            supports_model_discovery: true,
            supports_response_format_json_object: true,
            supports_json_schema: false,
            supports_thinking: true,
            supports_thinking_toggle: true,
            supports_reasoning_effort: false,
            supports_usage: true,
            supports_streaming: true,
        },
        parameter_profile: AIParameterProfile {
            temperature_min: 0.0,
            temperature_max: 1.0,
            default_temperature: 0.0,
            max_output_tokens: Some(32768),
            token_parameter: AITokenParameter::MaxCompletionTokens,
            thinking_strategy: AIThinkingStrategy::MiniMaxReasoningSplit,
        },
        response_profile: MINIMAX_RESPONSE_PROFILE,
        endpoint_variants: EMPTY_ENDPOINTS,
        api_key_env_hint: "MINIMAX_API_KEY",
        docs_url: Some("https://platform.minimaxi.com/document"),
    },
    AIProviderDescriptor {
        id: AIProviderPresetId::Hunyuan,
        label: "腾讯混元",
        provider_kind: AIProviderKind::OpenAICompatible,
        default_base_url: "https://api.hunyuan.cloud.tencent.com/v1",
        default_chat_path: "/chat/completions",
        models_path: Some("/models"),
        default_model: "hunyuan-turbos",
        suggested_models: HUNYUAN_MODELS,
        auth_kind: AIAuthKind::BearerApiKey,
        capabilities: PROMPT_ONLY,
        parameter_profile: DEFAULT_OPENAI_PARAMETERS,
        response_profile: OPENAI_RESPONSE_PROFILE,
        endpoint_variants: EMPTY_ENDPOINTS,
        api_key_env_hint: "HUNYUAN_API_KEY",
        docs_url: Some("https://cloud.tencent.com/document/product/1729"),
    },
    AIProviderDescriptor {
        id: AIProviderPresetId::Siliconflow,
        label: "SiliconFlow / 硅基流动",
        provider_kind: AIProviderKind::OpenAICompatible,
        default_base_url: "https://api.siliconflow.cn/v1",
        default_chat_path: "/chat/completions",
        models_path: Some("/models"),
        default_model: "",
        suggested_models: &[],
        auth_kind: AIAuthKind::BearerApiKey,
        capabilities: PROMPT_ONLY,
        parameter_profile: DEFAULT_OPENAI_PARAMETERS,
        response_profile: OPENAI_RESPONSE_PROFILE,
        endpoint_variants: EMPTY_ENDPOINTS,
        api_key_env_hint: "SILICONFLOW_API_KEY",
        docs_url: Some("https://docs.siliconflow.cn/"),
    },
    AIProviderDescriptor {
        id: AIProviderPresetId::BaiduQianfan,
        label: "百度千帆 / 文心",
        provider_kind: AIProviderKind::OpenAICompatible,
        default_base_url: "https://qianfan.baidubce.com/v2",
        default_chat_path: "/chat/completions",
        models_path: None,
        default_model: "ernie-4.5-turbo-32k",
        suggested_models: &["ernie-4.5-turbo-32k", "ernie-speed-128k"],
        auth_kind: AIAuthKind::BearerApiKey,
        capabilities: PROMPT_ONLY,
        parameter_profile: DEFAULT_OPENAI_PARAMETERS,
        response_profile: OPENAI_RESPONSE_PROFILE,
        endpoint_variants: EMPTY_ENDPOINTS,
        api_key_env_hint: "QIANFAN_API_KEY",
        docs_url: Some("https://cloud.baidu.com/doc/WENXINWORKSHOP/"),
    },
    AIProviderDescriptor {
        id: AIProviderPresetId::Baichuan,
        label: "百川智能（兼容入口）",
        provider_kind: AIProviderKind::OpenAICompatible,
        default_base_url: "",
        default_chat_path: "/chat/completions",
        models_path: None,
        default_model: "",
        suggested_models: &["Baichuan4-Turbo"],
        auth_kind: AIAuthKind::BearerApiKey,
        capabilities: PROMPT_ONLY,
        parameter_profile: DEFAULT_OPENAI_PARAMETERS,
        response_profile: OPENAI_RESPONSE_PROFILE,
        endpoint_variants: EMPTY_ENDPOINTS,
        api_key_env_hint: "BAICHUAN_API_KEY",
        docs_url: Some("https://platform.baichuan-ai.com/docs/api"),
    },
    AIProviderDescriptor {
        id: AIProviderPresetId::StepFun,
        label: "阶跃星辰 / StepFun",
        provider_kind: AIProviderKind::OpenAICompatible,
        default_base_url: "https://api.stepfun.com/v1",
        default_chat_path: "/chat/completions",
        models_path: Some("/models"),
        default_model: "step-3.5-flash",
        suggested_models: STEPFUN_MODELS,
        auth_kind: AIAuthKind::BearerApiKey,
        capabilities: PROMPT_ONLY,
        parameter_profile: DEFAULT_OPENAI_PARAMETERS,
        response_profile: OPENAI_RESPONSE_PROFILE,
        endpoint_variants: EMPTY_ENDPOINTS,
        api_key_env_hint: "STEPFUN_API_KEY",
        docs_url: Some("https://platform.stepfun.com/docs"),
    },
    AIProviderDescriptor {
        id: AIProviderPresetId::Yi,
        label: "零一万物 / Yi（兼容平台）",
        provider_kind: AIProviderKind::OpenAICompatible,
        default_base_url: "",
        default_chat_path: "/chat/completions",
        models_path: None,
        default_model: "",
        suggested_models: &["yi-large"],
        auth_kind: AIAuthKind::BearerApiKey,
        capabilities: PROMPT_ONLY,
        parameter_profile: DEFAULT_OPENAI_PARAMETERS,
        response_profile: OPENAI_RESPONSE_PROFILE,
        endpoint_variants: EMPTY_ENDPOINTS,
        api_key_env_hint: "YI_API_KEY",
        docs_url: Some("https://platform.lingyiwanwu.com/"),
    },
    AIProviderDescriptor {
        id: AIProviderPresetId::CustomOpenAICompatible,
        label: "自定义 OpenAI-compatible",
        provider_kind: AIProviderKind::OpenAICompatible,
        default_base_url: "",
        default_chat_path: "/chat/completions",
        models_path: Some("/models"),
        default_model: "",
        suggested_models: &[],
        auth_kind: AIAuthKind::BearerApiKey,
        capabilities: PROMPT_ONLY,
        parameter_profile: DEFAULT_OPENAI_PARAMETERS,
        response_profile: OPENAI_RESPONSE_PROFILE,
        endpoint_variants: EMPTY_ENDPOINTS,
        api_key_env_hint: "OPENAI_COMPATIBLE_API_KEY",
        docs_url: None,
    },
    AIProviderDescriptor {
        id: AIProviderPresetId::Ollama,
        label: "Ollama 本地模型",
        provider_kind: AIProviderKind::Ollama,
        default_base_url: "http://localhost:11434",
        default_chat_path: "/api/chat",
        models_path: Some("/api/tags"),
        default_model: "qwen3:8b",
        suggested_models: OLLAMA_MODELS,
        auth_kind: AIAuthKind::None,
        capabilities: AIProviderCapabilities {
            supports_model_discovery: true,
            supports_response_format_json_object: false,
            supports_json_schema: false,
            supports_thinking: true,
            supports_thinking_toggle: true,
            supports_reasoning_effort: false,
            supports_usage: true,
            supports_streaming: true,
        },
        parameter_profile: AIParameterProfile {
            temperature_min: 0.0,
            temperature_max: 2.0,
            default_temperature: 0.0,
            max_output_tokens: Some(32768),
            token_parameter: AITokenParameter::MaxTokens,
            thinking_strategy: AIThinkingStrategy::PromptOnly,
        },
        response_profile: OPENAI_RESPONSE_PROFILE,
        endpoint_variants: EMPTY_ENDPOINTS,
        api_key_env_hint: "",
        docs_url: Some("https://github.com/ollama/ollama/blob/main/docs/api.md"),
    },
];

pub fn provider_registry() -> &'static [AIProviderDescriptor] {
    PROVIDER_REGISTRY
}

pub fn provider_descriptor(id: AIProviderPresetId) -> Option<&'static AIProviderDescriptor> {
    PROVIDER_REGISTRY
        .iter()
        .find(|descriptor| descriptor.id == id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_has_one_descriptor_for_each_supported_preset() {
        let expected = [
            AIProviderPresetId::DeepSeek,
            AIProviderPresetId::Kimi,
            AIProviderPresetId::QwenDashScope,
            AIProviderPresetId::ZhipuGlm,
            AIProviderPresetId::DoubaoArk,
            AIProviderPresetId::Minimax,
            AIProviderPresetId::Hunyuan,
            AIProviderPresetId::Siliconflow,
            AIProviderPresetId::BaiduQianfan,
            AIProviderPresetId::Baichuan,
            AIProviderPresetId::StepFun,
            AIProviderPresetId::Yi,
            AIProviderPresetId::CustomOpenAICompatible,
            AIProviderPresetId::Ollama,
        ];
        assert_eq!(provider_registry().len(), expected.len());
        for id in expected {
            assert_eq!(
                provider_registry()
                    .iter()
                    .filter(|item| item.id == id)
                    .count(),
                1
            );
        }
    }

    #[test]
    fn registry_snapshots_provider_specific_protocol_parameters() {
        let deepseek = provider_descriptor(AIProviderPresetId::DeepSeek).expect("DeepSeek");
        assert_eq!(deepseek.default_base_url, "https://api.deepseek.com");
        assert!(deepseek.capabilities.supports_response_format_json_object);
        assert_eq!(
            deepseek.parameter_profile.thinking_strategy,
            AIThinkingStrategy::DeepSeekThinkingObject
        );

        let qwen = provider_descriptor(AIProviderPresetId::QwenDashScope).expect("Qwen");
        assert!(qwen.capabilities.supports_response_format_json_object);
        assert_eq!(
            qwen.parameter_profile.thinking_strategy,
            AIThinkingStrategy::EnableThinkingBoolean
        );

        let minimax = provider_descriptor(AIProviderPresetId::Minimax).expect("MiniMax");
        assert_eq!(
            minimax.parameter_profile.token_parameter,
            AITokenParameter::MaxCompletionTokens
        );
        assert_eq!(
            minimax.parameter_profile.thinking_strategy,
            AIThinkingStrategy::MiniMaxReasoningSplit
        );

        let qianfan = provider_descriptor(AIProviderPresetId::BaiduQianfan).expect("Qianfan");
        assert_eq!(qianfan.auth_kind, AIAuthKind::BearerApiKey);
        assert_eq!(qianfan.default_base_url, "https://qianfan.baidubce.com/v2");
    }
}
