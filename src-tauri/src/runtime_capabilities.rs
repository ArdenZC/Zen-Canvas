use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeCapabilities {
    pub ai_debug_available: bool,
    pub real_ai_classification_available: bool,
    pub credential_store_available: bool,
}

fn capabilities(ai_debug_available: bool) -> RuntimeCapabilities {
    RuntimeCapabilities {
        ai_debug_available,
        real_ai_classification_available: true,
        credential_store_available: cfg!(any(target_os = "windows", target_os = "macos")),
    }
}

#[tauri::command]
pub fn get_runtime_capabilities() -> RuntimeCapabilities {
    capabilities(cfg!(any(debug_assertions, feature = "ai-debug")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn production_capabilities_hide_ai_debug_without_disabling_real_ai() {
        let release = capabilities(false);
        assert!(!release.ai_debug_available);
        assert!(release.real_ai_classification_available);
    }

    #[test]
    fn debug_capabilities_expose_ai_debug() {
        assert!(capabilities(true).ai_debug_available);
    }
}
