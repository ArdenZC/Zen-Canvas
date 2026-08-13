//! Narrow Finder reveal adapter.
//!
//! This adapter only constructs the native reveal request. It does not open,
//! mutate, or authorize a file operation.

use std::path::Path;

#[allow(
    dead_code,
    reason = "The native reveal call site is compiled only for macOS; shared tests keep this adapter covered elsewhere"
)]
pub(crate) fn build_reveal_args(path: &Path) -> Result<Vec<String>, String> {
    if path.as_os_str().is_empty() {
        return Err("Path cannot be empty.".to_string());
    }
    Ok(vec!["-R".to_string(), path.to_string_lossy().into_owned()])
}

#[allow(
    dead_code,
    reason = "The native open call site is compiled only for macOS; shared tests keep this adapter covered elsewhere"
)]
pub(crate) fn build_open_args(path: &Path) -> Result<Vec<String>, String> {
    if path.as_os_str().is_empty() {
        return Err("Path cannot be empty.".to_string());
    }
    Ok(vec![path.to_string_lossy().into_owned()])
}

#[allow(
    dead_code,
    reason = "The native parent-open call site is compiled only for macOS; shared tests keep this adapter covered elsewhere"
)]
pub(crate) fn build_open_parent_args(path: &Path) -> Result<Vec<String>, String> {
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .ok_or_else(|| "Path has no parent directory.".to_string())?;
    build_open_args(parent)
}

#[cfg(test)]
mod tests {
    use super::{build_open_args, build_open_parent_args, build_reveal_args};
    use std::path::Path;

    #[test]
    fn finder_reveal_uses_select_without_mutation_arguments() {
        assert_eq!(
            build_reveal_args(Path::new("/Users/example/file.txt")).expect("Finder args"),
            vec!["-R", "/Users/example/file.txt"]
        );
    }

    #[test]
    fn finder_open_adapter_keeps_native_arguments_narrow() {
        assert_eq!(
            build_open_args(Path::new("/Users/example/file.txt")).expect("open args"),
            vec!["/Users/example/file.txt"]
        );
        assert_eq!(
            build_open_parent_args(Path::new("/Users/example/file.txt")).expect("parent args"),
            vec!["/Users/example"]
        );
    }
}
