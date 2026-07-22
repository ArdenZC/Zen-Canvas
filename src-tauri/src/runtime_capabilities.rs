use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeCapabilities {
    pub ai_debug_available: bool,
    pub real_ai_classification_available: bool,
    pub credential_store_available: bool,
    pub file_mutation_available: bool,
    pub file_mutation_unavailable_code: Option<&'static str>,
}

fn capabilities(ai_debug_available: bool) -> RuntimeCapabilities {
    RuntimeCapabilities {
        ai_debug_available,
        real_ai_classification_available: true,
        credential_store_available: cfg!(any(target_os = "windows", target_os = "macos")),
        file_mutation_available: cfg!(windows),
        file_mutation_unavailable_code: if cfg!(target_os = "macos") {
            Some(crate::fs_safety::platform_support::MACOS_FILE_MUTATION_SOURCE_BINDING_UNSUPPORTED)
        } else if cfg!(target_os = "linux") {
            Some(crate::fs_safety::platform_support::UNSUPPORTED_PLATFORM_LINUX)
        } else {
            None
        },
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
        assert_eq!(release.file_mutation_available, cfg!(windows));
    }

    #[test]
    fn debug_capabilities_expose_ai_debug() {
        assert!(capabilities(true).ai_debug_available);
    }
}
