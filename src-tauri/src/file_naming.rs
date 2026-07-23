const EXTENSION_CHANGE_ERROR: &str =
    "Changing a file extension is not allowed during organization.";

#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ExtensionChangePolicy {
    Preserve,
    ExplicitlyAllow,
}

pub(crate) fn normalize_proposed_file_name(
    original_name: &str,
    indexed_extension: &str,
    proposed_name: &str,
    is_dir: bool,
    policy: ExtensionChangePolicy,
) -> Result<String, String> {
    let proposed_name = proposed_name.trim();
    let proposed_name = if proposed_name.is_empty() {
        original_name.trim()
    } else {
        proposed_name
    };
    validate_file_name_shape(proposed_name)?;

    if is_dir || matches!(policy, ExtensionChangePolicy::ExplicitlyAllow) {
        return Ok(proposed_name.to_string());
    }

    let indexed_extension = indexed_extension.trim().trim_start_matches('.');
    let Some(proposed_extension) = file_extension(proposed_name) else {
        return if indexed_extension.is_empty() {
            Ok(proposed_name.to_string())
        } else {
            Ok(format!(
                "{proposed_name}.{}",
                original_extension_spelling(original_name, indexed_extension)
            ))
        };
    };

    if indexed_extension.is_empty() || !proposed_extension.eq_ignore_ascii_case(indexed_extension) {
        return Err(EXTENSION_CHANGE_ERROR.to_string());
    }

    let stem = &proposed_name[..proposed_name.len() - proposed_extension.len() - 1];
    Ok(format!(
        "{stem}.{}",
        original_extension_spelling(original_name, indexed_extension)
    ))
}

pub(crate) fn file_extension(name: &str) -> Option<&str> {
    let name = name.rsplit(['/', '\\']).next().unwrap_or(name);
    let dot = name.rfind('.')?;
    if dot == 0 || dot + 1 >= name.len() {
        return None;
    }
    Some(&name[dot + 1..])
}

pub(crate) fn filename_has_mismatched_extension(name: &str, indexed_extension: &str) -> bool {
    let indexed_extension = indexed_extension.trim().trim_start_matches('.');
    file_extension(name).is_some_and(|extension| {
        indexed_extension.is_empty() || !extension.eq_ignore_ascii_case(indexed_extension)
    })
}

pub(crate) fn split_filename_from_target_directory(
    target_directory: &str,
    indexed_extension: &str,
) -> Option<(String, String)> {
    let normalized = target_directory.trim().replace('\\', "/");
    let (parent, last) = normalized
        .rsplit_once('/')
        .unwrap_or(("", normalized.as_str()));
    if !file_extension_matches(last, indexed_extension) {
        return None;
    }
    Some((parent.to_string(), last.to_string()))
}

fn file_extension_matches(name: &str, indexed_extension: &str) -> bool {
    let indexed_extension = indexed_extension.trim().trim_start_matches('.');
    !indexed_extension.is_empty()
        && file_extension(name)
            .is_some_and(|extension| extension.eq_ignore_ascii_case(indexed_extension))
}

fn original_extension_spelling(original_name: &str, indexed_extension: &str) -> String {
    file_extension(original_name)
        .filter(|extension| extension.eq_ignore_ascii_case(indexed_extension))
        .unwrap_or(indexed_extension)
        .to_string()
}

fn validate_file_name_shape(name: &str) -> Result<(), String> {
    if name.is_empty()
        || name == "."
        || name == ".."
        || name.contains("..")
        || name.ends_with('.')
        || name.ends_with(' ')
        || name.contains('\0')
        || name.contains('/')
        || name.contains('\\')
        || name.chars().any(|character| character.is_control())
        || name
            .chars()
            .any(|character| matches!(character, '<' | '>' | ':' | '"' | '|' | '?' | '*'))
    {
        return Err("The requested file name is not safe.".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn preserve(original: &str, extension: &str, proposed: &str) -> Result<String, String> {
        normalize_proposed_file_name(
            original,
            extension,
            proposed,
            false,
            ExtensionChangePolicy::Preserve,
        )
    }

    #[test]
    fn appends_missing_extension_without_duplication() {
        assert_eq!(
            preserve("Install_Package.lnk", "lnk", "Install_Package").unwrap(),
            "Install_Package.lnk"
        );
        assert_eq!(
            preserve("archive.tar.gz", "gz", "archive-2026").unwrap(),
            "archive-2026.gz"
        );
    }

    #[test]
    fn preserves_original_extension_spelling_case_insensitively() {
        assert_eq!(
            preserve("My_Shortcut.LNK", "lnk", "Renamed.lnk").unwrap(),
            "Renamed.LNK"
        );
    }

    #[test]
    fn rejects_extension_changes_including_invented_extensions() {
        assert_eq!(
            preserve("Install_Package.lnk", "lnk", "Install_Package.exe"),
            Err(EXTENSION_CHANGE_ERROR.to_string())
        );
        assert_eq!(
            preserve("README", "", "README.txt"),
            Err(EXTENSION_CHANGE_ERROR.to_string())
        );
    }

    #[test]
    fn treats_dotfiles_as_extensionless() {
        assert_eq!(
            preserve(".gitignore", "", ".gitignore").unwrap(),
            ".gitignore"
        );
        assert_eq!(preserve(".env", "", "config").unwrap(), "config");
    }

    #[test]
    fn directories_do_not_receive_extension_logic() {
        assert_eq!(
            normalize_proposed_file_name(
                "Folder",
                "lnk",
                "Folder.v2",
                true,
                ExtensionChangePolicy::Preserve,
            )
            .unwrap(),
            "Folder.v2"
        );
    }

    #[test]
    fn target_directory_compatibility_requires_indexed_extension() {
        assert_eq!(
            split_filename_from_target_directory("Archive/Install_Package.lnk", "lnk"),
            Some(("Archive".to_string(), "Install_Package.lnk".to_string()))
        );
        assert_eq!(
            split_filename_from_target_directory("Archive/Install_Package.url", "lnk"),
            None
        );
        assert_eq!(
            split_filename_from_target_directory("Archive/Install_Package.appref-ms", "appref-ms"),
            Some((
                "Archive".to_string(),
                "Install_Package.appref-ms".to_string()
            ))
        );
    }
}
