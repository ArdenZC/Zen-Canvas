use thiserror::Error;

pub const UNSUPPORTED_PLATFORM_LINUX: &str = "unsupported_platform_linux";
pub const MACOS_FILE_MUTATION_SOURCE_BINDING_UNSUPPORTED: &str =
    "macos_file_mutation_source_binding_unsupported";

#[derive(Debug, Error, Clone, Copy, PartialEq, Eq)]
pub enum PlatformSupportError {
    #[error("unsupported_platform_linux")]
    LinuxUnsupported,
    #[error("macos_file_mutation_source_binding_unsupported")]
    MacosFileMutationSourceBindingUnsupported,
}

pub fn ensure_supported_file_mutation() -> Result<(), PlatformSupportError> {
    if cfg!(target_os = "linux") {
        Err(PlatformSupportError::LinuxUnsupported)
    } else if cfg!(target_os = "macos") {
        Err(PlatformSupportError::MacosFileMutationSourceBindingUnsupported)
    } else {
        Ok(())
    }
}

pub fn ensure_supported_cleanup_mutation() -> Result<(), PlatformSupportError> {
    ensure_supported_file_mutation()
}

pub fn is_supported_product_platform() -> bool {
    cfg!(any(windows, target_os = "macos"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn support_policy_is_windows_or_macos_only() {
        assert_eq!(
            is_supported_product_platform(),
            cfg!(any(windows, target_os = "macos"))
        );
    }

    #[test]
    fn linux_mutation_error_is_stable() {
        if cfg!(target_os = "linux") {
            assert_eq!(
                ensure_supported_file_mutation().unwrap_err().to_string(),
                UNSUPPORTED_PLATFORM_LINUX
            );
        }
    }

    #[test]
    fn macos_mutation_error_is_stable() {
        if cfg!(target_os = "macos") {
            assert_eq!(
                ensure_supported_file_mutation().unwrap_err().to_string(),
                MACOS_FILE_MUTATION_SOURCE_BINDING_UNSUPPORTED
            );
        }
    }
}
