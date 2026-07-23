use std::{error::Error, fmt};

use super::schema::{AIChatRequest, AIConnectionTestResult, AIModelInfo};

pub trait AIProvider: Send + Sync {
    fn chat_json(&self, request: AIChatRequest) -> Result<String, AIProviderError>;
    fn test_connection(&self) -> Result<AIConnectionTestResult, AIProviderError>;

    fn discover_models(&self) -> Result<Vec<AIModelInfo>, AIProviderError> {
        Err(AIProviderError::new(
            "This AI provider does not support model discovery.",
        ))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AIProviderError {
    message: String,
}

impl AIProviderError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

impl fmt::Display for AIProviderError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl Error for AIProviderError {}
