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

/// Normalize a Windows extended-length path into a Win32 path spelling that
/// can be passed through the normal filesystem validation chain.
///
/// Only drive-letter paths and UNC paths are accepted. Device namespaces and
/// malformed extended prefixes are intentionally rejected instead of being
/// silently stripped into an ambiguous path.
pub fn normalize_extended_windows_path_text(value: &str) -> Result<Option<String>, &'static str> {
    let normalized = value.replace('\\', "/");
    if normalized.starts_with("//./") {
        return Err("unsupported Windows device path");
    }
    let Some(rest) = normalized.strip_prefix("//?/") else {
        return Ok(None);
    };

    let unc = rest
        .get(..4)
        .filter(|prefix| prefix.eq_ignore_ascii_case("UNC/"))
        .map(|_| &rest[4..]);
    if let Some(unc) = unc {
        let mut parts = unc.split('/');
        let server = parts.next().filter(|part| !part.is_empty());
        let share = parts.next().filter(|part| !part.is_empty());
        if server.is_none() || share.is_none() {
            return Err("malformed Windows extended UNC path");
        }
        return Ok(Some(format!("//{unc}")));
    }

    let bytes = rest.as_bytes();
    if bytes.len() >= 3 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' && bytes[2] == b'/' {
        return Ok(Some(rest.to_string()));
    }

    Err("unsupported or malformed Windows extended path")
}

pub fn normalize_text_for_platform(value: &str, platform: PathPlatform) -> String {
    let normalized = if platform == PathPlatform::Windows {
        normalize_extended_windows_path_text(value)
            .ok()
            .flatten()
            .unwrap_or_else(|| value.replace('\\', "/"))
    } else {
        value.replace('\\', "/")
    };
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
        assert_eq!(
            normalize_text_for_platform(
                "\\\\?\\UNC\\Server\\Share\\Report.md",
                PathPlatform::Windows
            ),
            "//server/share/report.md"
        );
    }

    #[test]
    fn extended_windows_path_text_accepts_drive_and_unc_only() {
        assert_eq!(
            normalize_extended_windows_path_text("\\\\?\\C:\\Users\\Zen\\Report.md"),
            Ok(Some("C:/Users/Zen/Report.md".to_string()))
        );
        assert_eq!(
            normalize_extended_windows_path_text("//?/UNC/Server/Share/Report.md"),
            Ok(Some("//Server/Share/Report.md".to_string()))
        );
        assert_eq!(
            normalize_extended_windows_path_text("C:/Users/Zen/Report.md"),
            Ok(None)
        );
    }

    #[test]
    fn malformed_and_device_windows_path_text_is_rejected() {
        for value in [
            "//?/",
            "//?/C:",
            "//?/UNC/server",
            "//?/GLOBALROOT/Device/HarddiskVolumeShadowCopy1",
            "\\\\.\\PhysicalDrive0",
        ] {
            assert!(
                normalize_extended_windows_path_text(value).is_err(),
                "{value}"
            );
        }
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
