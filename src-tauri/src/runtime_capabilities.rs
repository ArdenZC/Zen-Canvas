use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeCapabilities {
    pub platform: &'static str,
    pub architecture: &'static str,
    pub macos_version: Option<String>,
    pub ai_debug_available: bool,
    pub real_ai_classification_available: bool,
    pub credential_store_available: bool,
    pub file_mutation_available: bool,
    pub file_mutation_unavailable_code: Option<&'static str>,
    pub backend_watcher_reconciliation: bool,
    pub macos_native_semantics_available: bool,
    pub macos_same_volume_mutation_available: bool,
    pub macos_safe_trash_available: bool,
    pub macos_icloud_awareness_available: bool,
    pub macos_file_provider_awareness_available: bool,
    pub macos_package_awareness_available: bool,
}

fn capabilities(ai_debug_available: bool) -> RuntimeCapabilities {
    RuntimeCapabilities {
        platform: std::env::consts::OS,
        architecture: std::env::consts::ARCH,
        macos_version: crate::platform::macos::operating_system_version(),
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
        backend_watcher_reconciliation: crate::watcher::backend_watcher_reconciliation_enabled(),
        macos_native_semantics_available: cfg!(target_os = "macos"),
        macos_same_volume_mutation_available: false,
        macos_safe_trash_available: false,
        // iCloud metadata awareness is available on macOS. Generic File
        // Provider identity/materialization awareness remains deliberately
        // unavailable until the native identity bridge and real fixtures are
        // validated together.
        macos_icloud_awareness_available: cfg!(target_os = "macos"),
        macos_file_provider_awareness_available: false,
        macos_package_awareness_available: cfg!(target_os = "macos"),
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
        assert!(!release.macos_same_volume_mutation_available);
        assert!(!release.macos_safe_trash_available);
        assert!(!release.macos_file_provider_awareness_available);
    }

    #[test]
    fn debug_capabilities_expose_ai_debug() {
        assert!(capabilities(true).ai_debug_available);
    }
}
