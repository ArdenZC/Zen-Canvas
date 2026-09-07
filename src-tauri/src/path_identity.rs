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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum WindowsPathNamespace {
    Ordinary,
    ExtendedDrive,
    ExtendedUnc,
}

/// Recognize Windows path namespaces and validate the subset of verbatim
/// spellings that is proven equivalent to ordinary Win32 path semantics.
///
/// This function deliberately does not rewrite a filesystem path. Callers
/// that need filesystem access must keep using the original `PathBuf`; the
/// normalized spelling is only for comparison/display identity.
pub(crate) fn validate_windows_path_text(
    value: &str,
) -> Result<WindowsPathNamespace, &'static str> {
    let normalized = value.replace('\\', "/");
    if normalized == "//." || normalized.starts_with("//./") {
        return Err("unsupported Windows device path");
    }
    if normalized.starts_with("//?") {
        let rest = normalized
            .strip_prefix("//?/")
            .ok_or("malformed Windows extended path prefix")?;
        if rest
            .get(..4)
            .is_some_and(|prefix| prefix.eq_ignore_ascii_case("UNC/"))
        {
            let unc = &rest[4..];
            let mut parts = unc.split('/').filter(|part| !part.is_empty());
            if parts.next().is_none() || parts.next().is_none() {
                return Err("malformed Windows extended UNC path");
            }
            validate_windows_equivalent_components(unc, true)?;
            return Ok(WindowsPathNamespace::ExtendedUnc);
        }

        let bytes = rest.as_bytes();
        if bytes.len() < 3
            || !bytes[0].is_ascii_alphabetic()
            || bytes[1] != b':'
            || bytes[2] != b'/'
        {
            return Err("unsupported or malformed Windows extended path");
        }
        validate_windows_equivalent_components(rest, true)?;
        return Ok(WindowsPathNamespace::ExtendedDrive);
    }

    Ok(WindowsPathNamespace::Ordinary)
}

fn validate_windows_equivalent_components(
    value: &str,
    reject_verbatim_only_spellings: bool,
) -> Result<(), &'static str> {
    let mut components = value.split('/').filter(|component| !component.is_empty());
    let has_drive_designator = components
        .clone()
        .next()
        .is_some_and(is_windows_drive_designator);
    if has_drive_designator {
        // The drive designator is the only component where a colon is valid.
        components.next();
    }

    for component in components {
        if component.eq_ignore_ascii_case("GLOBALROOT") {
            return Err("unsupported Windows GLOBALROOT namespace");
        }
        if component == ".." {
            return Err("Windows path contains parent-directory traversal");
        }
        if reject_verbatim_only_spellings
            && (component == "." || component.ends_with('.') || component.ends_with(' '))
        {
            return Err("Windows verbatim path is not Win32-equivalent");
        }
        if component.contains(':')
            || component.contains('\0')
            || component.contains('*')
            || component.contains('?')
            || component.chars().any(|character| character.is_control())
        {
            return Err("unsafe Windows path component");
        }
        crate::file_ops::validate_windows_path_component(component)
            .map_err(|_| "unsafe Windows path component")?;
    }
    Ok(())
}

fn is_windows_drive_designator(component: &str) -> bool {
    let bytes = component.as_bytes();
    bytes.len() == 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':'
}

/// Normalize a Windows extended-length path into a Win32 path spelling that
/// can be passed through the normal filesystem validation chain.
///
/// Only drive-letter paths and UNC paths are accepted. Device namespaces and
/// malformed extended prefixes are intentionally rejected instead of being
/// silently stripped into an ambiguous path.
pub fn normalize_extended_windows_path_text(value: &str) -> Result<Option<String>, &'static str> {
    let normalized = value.replace('\\', "/");
    match validate_windows_path_text(value)? {
        WindowsPathNamespace::Ordinary => Ok(None),
        WindowsPathNamespace::ExtendedDrive => Ok(Some(
            normalized
                .strip_prefix("//?/")
                .expect("validated extended drive prefix")
                .to_string(),
        )),
        WindowsPathNamespace::ExtendedUnc => {
            let rest = normalized
                .strip_prefix("//?/")
                .expect("validated extended UNC prefix");
            Ok(Some(format!("//{}", &rest[4..])))
        }
    }
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
        assert_eq!(
            normalize_text_for_platform("\\\\Server\\Share\\Report.md", PathPlatform::Windows),
            normalize_text_for_platform(
                "\\\\?\\UNC\\Server\\Share\\Report.md",
                PathPlatform::Windows
            )
        );
    }

    #[test]
    fn extended_windows_path_text_accepts_drive_and_unc_only() {
        assert_eq!(
            normalize_extended_windows_path_text("\\\\?\\C:\\Users\\Zen\\Report.md"),
            Ok(Some("C:/Users/Zen/Report.md".to_string()))
        );
        assert_eq!(
            validate_windows_path_text("\\\\?\\C:\\Users\\Zen\\normal.file.txt"),
            Ok(WindowsPathNamespace::ExtendedDrive)
        );
        assert_eq!(
            normalize_extended_windows_path_text("//?/UNC/Server/Share/Report.md"),
            Ok(Some("//Server/Share/Report.md".to_string()))
        );
        assert_eq!(
            validate_windows_path_text("//?/UNC/Server/Share/normal.file.txt"),
            Ok(WindowsPathNamespace::ExtendedUnc)
        );
        assert_eq!(
            normalize_extended_windows_path_text("C:/Users/Zen/Report.md"),
            Ok(None)
        );
        assert_eq!(
            validate_windows_path_text("C:/Users/Zen/normal.file.txt"),
            Ok(WindowsPathNamespace::Ordinary)
        );
        assert_eq!(
            validate_windows_path_text("//Server/Share/normal.file.txt"),
            Ok(WindowsPathNamespace::Ordinary)
        );
    }

    #[test]
    fn extended_windows_path_accepts_consecutive_dots_inside_a_filename() {
        let ordinary = r"C:\folder\report..draft.txt";
        let extended = r"\\?\C:\folder\report..draft.txt";

        assert_eq!(
            normalize_extended_windows_path_text(extended),
            Ok(Some("C:/folder/report..draft.txt".to_string()))
        );
        assert_eq!(
            normalize_text_for_platform(ordinary, PathPlatform::Windows),
            normalize_text_for_platform(extended, PathPlatform::Windows)
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
    fn extended_windows_path_rejects_verbatim_only_spellings() {
        for value in [
            "//?/C:/Users/Zen/report.",
            "//?/C:/Users/Zen/report ",
            "//?/C:/Users/Zen/./report",
            "//?/C:/Users/Zen/../report",
            "//?/C:/Users/Zen/report:stream",
            "//?/C:/Users/Zen/report*",
            "//?/C:/Users/Zen/CON/report.txt",
            "//?/C:/GLOBALROOT/Device/HarddiskVolumeShadowCopy1",
            "//./PhysicalDrive0",
        ] {
            assert!(
                normalize_extended_windows_path_text(value).is_err(),
                "verbatim-only or device path must be rejected: {value}"
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
