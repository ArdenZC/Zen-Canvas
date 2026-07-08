use std::{error::Error, fmt};

use super::schema::{AIChatRequest, AIConnectionTestResult};

pub trait AIProvider {
    fn chat_json(&self, request: AIChatRequest) -> Result<String, AIProviderError>;
    fn test_connection(&self) -> Result<AIConnectionTestResult, AIProviderError>;
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
