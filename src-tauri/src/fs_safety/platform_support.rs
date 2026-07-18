use thiserror::Error;

pub const UNSUPPORTED_PLATFORM_LINUX: &str = "unsupported_platform_linux";

#[derive(Debug, Error, Clone, Copy, PartialEq, Eq)]
pub enum PlatformSupportError {
    #[error("unsupported_platform_linux")]
    LinuxUnsupported,
}

pub fn ensure_supported_file_mutation() -> Result<(), PlatformSupportError> {
    if cfg!(target_os = "linux") {
        Err(PlatformSupportError::LinuxUnsupported)
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
}
