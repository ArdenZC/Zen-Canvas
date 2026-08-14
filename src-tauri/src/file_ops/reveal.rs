use super::*;
use crate::path_identity::{normalize_text_for_platform, PathPlatform};

#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(target_os = "macos", allow(dead_code))]
pub(crate) struct RevealCommand {
    pub(crate) program: &'static str,
    pub(crate) args: Vec<String>,
}

#[cfg_attr(target_os = "macos", allow(dead_code))]
pub(crate) fn build_reveal_command(path: &Path) -> Result<RevealCommand, String> {
    if path.as_os_str().is_empty() {
        return Err("Path cannot be empty.".to_string());
    }

    #[cfg(windows)]
    {
        return Ok(RevealCommand {
            program: "explorer",
            args: vec![format!(
                "/select,{}",
                path.to_string_lossy().replace('/', "\\")
            )],
        });
    }

    #[cfg(target_os = "macos")]
    {
        let args = crate::platform::macos::finder::build_reveal_args(path)?;
        return Ok(RevealCommand {
            program: "open",
            args,
        });
    }

    #[allow(unreachable_code)]
    Err("Reveal in folder is not supported on this platform.".to_string())
}

pub(crate) fn normalize_for_compare_for_os(path: &Path, os: &str) -> String {
    let platform = match os {
        "windows" => PathPlatform::Windows,
        "macos" => PathPlatform::Macos,
        _ => PathPlatform::Unix,
    };
    normalize_text_for_platform(&normalize_path(path), platform)
}
