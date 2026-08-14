//! Fail-closed eligibility checks for the first macOS mutation surface.
//!
//! This module is deliberately a policy gate, not a mutation implementation.
//! The descriptor-bound primitives live in `fs_safety`; this gate prevents a
//! path that is cloud-backed, packaged, linked, mounted, read-only, or on an
//! unverified filesystem from reaching those primitives.

use std::{fs::File, path::Path};

pub const MAC_SOURCE_IDENTITY_CHANGED: &str = "mac_source_identity_changed";
pub const MAC_SOURCE_CLAIM_FAILED: &str = "mac_source_claim_failed";
pub const MAC_SOURCE_CLAIM_IDENTITY_MISMATCH: &str = "mac_source_claim_identity_mismatch";
pub const MAC_TARGET_IDENTITY_CHANGED: &str = "mac_target_identity_changed";
pub const MAC_TARGET_EXISTS: &str = "mac_target_exists";
pub const MAC_TARGET_PARENT_CHANGED: &str = "mac_target_parent_changed";
pub const MAC_SYMLINK_NOT_ALLOWED: &str = "mac_symlink_not_allowed";
pub const MAC_HARDLINK_NOT_SUPPORTED: &str = "mac_hardlink_not_supported";
pub const MAC_PACKAGE_MUTATION_NOT_SUPPORTED: &str = "mac_package_mutation_not_supported";
pub const MAC_CLOUD_MUTATION_NOT_SUPPORTED: &str = "mac_cloud_mutation_not_supported";
pub const MAC_FILE_PROVIDER_MUTATION_NOT_SUPPORTED: &str =
    "mac_file_provider_mutation_not_supported";
pub const MAC_CROSS_VOLUME_NOT_SUPPORTED: &str = "mac_cross_volume_not_supported";
pub const MAC_FILESYSTEM_NOT_SUPPORTED: &str = "mac_filesystem_not_supported";
pub const MAC_VOLUME_READ_ONLY: &str = "mac_volume_read_only";
pub const MAC_POST_COMMIT_IDENTITY_FAILED: &str = "mac_post_commit_identity_failed";
pub const MAC_RECOVERY_REQUIRED: &str = "mac_recovery_required";
pub const MAC_RESTORE_CONFLICT: &str = "mac_restore_conflict";
pub const MAC_CONTENT_AVAILABILITY_UNKNOWN: &str = "mac_content_availability_unknown";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MacMutationEntryKind {
    File,
    Directory,
}

/// Checks the source and target namespace before a descriptor-bound claim is
/// attempted. The target itself must be absent; the caller still performs the
/// final no-overwrite check through `renameatx_np(RENAME_EXCL)`.
pub fn ensure_path_eligible(source: &Path, target_parent: &Path) -> Result<(), &'static str> {
    #[cfg(target_os = "macos")]
    {
        use std::os::unix::fs::MetadataExt;

        if !source.is_absolute() || !target_parent.is_absolute() {
            return Err(MAC_FILESYSTEM_NOT_SUPPORTED);
        }
        if source
            .components()
            .chain(target_parent.components())
            .any(|component| component == std::path::Component::ParentDir)
        {
            return Err(MAC_FILESYSTEM_NOT_SUPPORTED);
        }

        let source_metadata =
            std::fs::symlink_metadata(source).map_err(|_| MAC_SOURCE_IDENTITY_CHANGED)?;
        if source_metadata.file_type().is_symlink() {
            return Err(MAC_SYMLINK_NOT_ALLOWED);
        }
        let source_kind = if source_metadata.is_file() {
            MacMutationEntryKind::File
        } else if source_metadata.is_dir() {
            MacMutationEntryKind::Directory
        } else {
            return Err(MAC_FILESYSTEM_NOT_SUPPORTED);
        };
        if matches!(source_kind, MacMutationEntryKind::File) && source_metadata.nlink() > 1 {
            return Err(MAC_HARDLINK_NOT_SUPPORTED);
        }

        let source_parent = source.parent().ok_or(MAC_SOURCE_IDENTITY_CHANGED)?;
        let source_parent_metadata = verified_directory_metadata(source_parent)?;
        let target_parent_metadata = verified_directory_metadata(target_parent)?;

        if source_parent_metadata.dev() != source_metadata.dev()
            || target_parent_metadata.dev() != source_metadata.dev()
        {
            return Err(MAC_CROSS_VOLUME_NOT_SUPPORTED);
        }
        if source_parent_metadata.dev() != parent_device(source_parent)?
            || target_parent_metadata.dev() != parent_device(target_parent)?
        {
            return Err(MAC_FILESYSTEM_NOT_SUPPORTED);
        }

        let source_volume = super::volume::inspect(source);
        let target_volume = super::volume::inspect(target_parent);
        for volume in [&source_volume, &target_volume] {
            if volume.is_local != Some(true)
                || volume.is_read_only.is_none()
                || volume.filesystem_type.as_deref() != Some("apfs")
            {
                return Err(MAC_FILESYSTEM_NOT_SUPPORTED);
            }
            if volume.is_read_only == Some(true) {
                return Err(MAC_VOLUME_READ_ONLY);
            }
        }

        if path_has_package_ancestor(source) || path_has_package_ancestor(target_parent) {
            return Err(MAC_PACKAGE_MUTATION_NOT_SUPPORTED);
        }

        let source_semantics = super::file_semantics::inspect(source);
        if matches!(
            source_semantics.backing_kind,
            super::MacCloudBacking::ICloud
        ) {
            return Err(MAC_CLOUD_MUTATION_NOT_SUPPORTED);
        }
        if matches!(
            source_semantics.backing_kind,
            super::MacCloudBacking::FileProvider
        ) {
            return Err(MAC_FILE_PROVIDER_MUTATION_NOT_SUPPORTED);
        }
        let target_semantics = super::file_semantics::inspect(target_parent);
        if matches!(
            target_semantics.backing_kind,
            super::MacCloudBacking::ICloud
        ) {
            return Err(MAC_CLOUD_MUTATION_NOT_SUPPORTED);
        }
        if matches!(
            target_semantics.backing_kind,
            super::MacCloudBacking::FileProvider
        ) {
            return Err(MAC_FILE_PROVIDER_MUTATION_NOT_SUPPORTED);
        }
        if matches!(
            source_semantics.backing_kind,
            super::MacCloudBacking::Unknown
        ) || matches!(
            target_semantics.backing_kind,
            super::MacCloudBacking::Unknown
        ) {
            return Err(MAC_CONTENT_AVAILABILITY_UNKNOWN);
        }
        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (source, target_parent);
        Err("macos_mutation_unavailable")
    }
}

/// Re-checks the source after it has been opened with `O_NOFOLLOW`. This is
/// intentionally descriptor-based and complements the preflight path check.
#[cfg(target_os = "macos")]
pub fn ensure_opened_source_eligible(
    handle: &File,
    parent_device: u64,
    kind: MacMutationEntryKind,
) -> Result<(), &'static str> {
    use std::os::unix::fs::MetadataExt;

    let metadata = handle.metadata().map_err(|_| MAC_SOURCE_IDENTITY_CHANGED)?;
    let type_matches = match kind {
        MacMutationEntryKind::File => metadata.is_file(),
        MacMutationEntryKind::Directory => metadata.is_dir(),
    };
    if !type_matches {
        return Err(MAC_SOURCE_IDENTITY_CHANGED);
    }
    if matches!(kind, MacMutationEntryKind::File) && metadata.nlink() > 1 {
        return Err(MAC_HARDLINK_NOT_SUPPORTED);
    }
    if metadata.dev() != parent_device {
        return Err(MAC_CROSS_VOLUME_NOT_SUPPORTED);
    }
    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn ensure_opened_source_eligible(
    _handle: &File,
    _parent_device: u64,
    _kind: MacMutationEntryKind,
) -> Result<(), &'static str> {
    Err("macos_mutation_unavailable")
}

#[cfg(target_os = "macos")]
fn verified_directory_metadata(path: &Path) -> Result<std::fs::Metadata, &'static str> {
    let metadata = std::fs::symlink_metadata(path).map_err(|_| MAC_TARGET_PARENT_CHANGED)?;
    if metadata.file_type().is_symlink() {
        return Err(MAC_SYMLINK_NOT_ALLOWED);
    }
    if !metadata.is_dir() {
        return Err(MAC_TARGET_PARENT_CHANGED);
    }
    Ok(metadata)
}

#[cfg(target_os = "macos")]
fn parent_device(path: &Path) -> Result<u64, &'static str> {
    let parent = path.parent().unwrap_or(path);
    Ok(std::fs::symlink_metadata(parent)
        .map_err(|_| MAC_TARGET_PARENT_CHANGED)?
        .dev())
}

#[cfg(target_os = "macos")]
fn path_has_package_ancestor(path: &Path) -> bool {
    path.ancestors()
        .take_while(|ancestor| !ancestor.as_os_str().is_empty())
        .any(super::package::is_package)
}

#[cfg(test)]
mod tests {
    use super::{ensure_path_eligible, MAC_FILESYSTEM_NOT_SUPPORTED};
    use std::path::Path;

    #[test]
    fn non_macos_builds_never_claim_macos_mutation_eligibility() {
        if !cfg!(target_os = "macos") {
            assert_eq!(
                ensure_path_eligible(Path::new("/tmp/source"), Path::new("/tmp")),
                Err("macos_mutation_unavailable")
            );
        } else {
            let _ = MAC_FILESYSTEM_NOT_SUPPORTED;
        }
    }
}
