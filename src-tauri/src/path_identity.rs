use std::path::Path;

/// The comparison semantics used for persisted and safety-sensitive paths.
///
/// Windows path identity is case-insensitive. POSIX and macOS paths retain
/// case because the filesystem may distinguish otherwise identical strings.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PathPlatform {
    Windows,
    Macos,
    Unix,
}

pub fn current_platform() -> PathPlatform {
    if cfg!(windows) {
        PathPlatform::Windows
    } else if cfg!(target_os = "macos") {
        PathPlatform::Macos
    } else {
        PathPlatform::Unix
    }
}

pub fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

pub fn normalize_for_compare(path: &Path) -> String {
    normalize_text_for_platform(&normalize_path(path), current_platform())
}

pub fn normalize_text_for_compare(value: &str) -> String {
    normalize_text_for_platform(value, current_platform())
}

pub fn normalize_text_for_platform(value: &str, platform: PathPlatform) -> String {
    let normalized = value.replace('\\', "/");
    let normalized = normalized
        .strip_prefix("//?/")
        .unwrap_or(&normalized)
        .to_string();
    let normalized = if normalized == "/" {
        normalized
    } else {
        normalized.trim_end_matches('/').to_string()
    };
    match platform {
        PathPlatform::Windows => normalized.to_ascii_lowercase(),
        PathPlatform::Macos | PathPlatform::Unix => normalized,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn windows_identity_is_case_and_separator_insensitive() {
        assert_eq!(
            normalize_text_for_platform("C:\\Users\\Zen\\Report.md", PathPlatform::Windows),
            "c:/users/zen/report.md"
        );
        assert_eq!(
            normalize_text_for_platform("//?/C:/Users/Zen/Report.md", PathPlatform::Windows),
            "c:/users/zen/report.md"
        );
    }

    #[test]
    fn unix_and_macos_identity_preserve_case() {
        for platform in [PathPlatform::Unix, PathPlatform::Macos] {
            assert_eq!(
                normalize_text_for_platform("/Users/Zen/Report.md", platform),
                "/Users/Zen/Report.md"
            );
            assert_ne!(
                normalize_text_for_platform("/Users/Zen/Report.md", platform),
                normalize_text_for_platform("/users/zen/report.md", platform)
            );
        }
    }
}
