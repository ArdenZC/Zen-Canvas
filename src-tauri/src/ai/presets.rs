use serde::{Deserialize, Serialize};

use super::{
    registry::{
        provider_descriptor, provider_registry, AIAuthKind, AIParameterProfile,
        AIProviderCapabilities, AIProviderDescriptor, AIResponseProfile,
    },
    schema::{AIProviderKind, AIProviderPresetId},
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AIExtraBodyStrategy {
    None,
    Generic,
    DeepSeekThinking,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AIProviderPreset {
    pub id: AIProviderPresetId,
    pub label: &'static str,
    pub provider_kind: AIProviderKind,
    pub default_base_url: &'static str,
    pub default_chat_path: &'static str,
    pub models_path: Option<&'static str>,
    pub default_model: &'static str,
    pub suggested_models: &'static [&'static str],
    pub api_key_env_hint: &'static str,
    pub auth_kind: AIAuthKind,
    pub capabilities: AIProviderCapabilities,
    pub parameter_profile: AIParameterProfile,
    pub response_profile: AIResponseProfile,
    pub endpoint_variants: &'static [super::registry::AIEndpointVariant],
    pub supports_response_format: bool,
    pub supports_json_mode: bool,
    pub supports_thinking: bool,
    pub supports_reasoning_effort: bool,
    pub extra_body_strategy: AIExtraBodyStrategy,
    pub docs_url: Option<&'static str>,
}

impl From<&'static AIProviderDescriptor> for AIProviderPreset {
    fn from(descriptor: &'static AIProviderDescriptor) -> Self {
        Self {
            id: descriptor.id,
            label: descriptor.label,
            provider_kind: descriptor.provider_kind,
            default_base_url: descriptor.default_base_url,
            default_chat_path: descriptor.default_chat_path,
            models_path: descriptor.models_path,
            default_model: descriptor.default_model,
            suggested_models: descriptor.suggested_models,
            api_key_env_hint: descriptor.api_key_env_hint,
            auth_kind: descriptor.auth_kind,
            capabilities: descriptor.capabilities,
            parameter_profile: descriptor.parameter_profile,
            response_profile: descriptor.response_profile,
            endpoint_variants: descriptor.endpoint_variants,
            supports_response_format: descriptor.capabilities.supports_response_format_json_object,
            supports_json_mode: descriptor.provider_kind == AIProviderKind::Ollama
                || descriptor.capabilities.supports_response_format_json_object,
            supports_thinking: descriptor.capabilities.supports_thinking,
            supports_reasoning_effort: descriptor.capabilities.supports_reasoning_effort,
            extra_body_strategy: match descriptor.parameter_profile.thinking_strategy {
                super::registry::AIThinkingStrategy::None => AIExtraBodyStrategy::None,
                super::registry::AIThinkingStrategy::DeepSeekThinkingObject => {
                    AIExtraBodyStrategy::DeepSeekThinking
                }
                _ => AIExtraBodyStrategy::Generic,
            },
            docs_url: descriptor.docs_url,
        }
    }
}

pub fn all_provider_presets() -> Vec<AIProviderPreset> {
    provider_registry()
        .iter()
        .map(AIProviderPreset::from)
        .collect()
}

pub fn provider_preset(id: AIProviderPresetId) -> Option<AIProviderPreset> {
    provider_descriptor(id).map(AIProviderPreset::from)
}
