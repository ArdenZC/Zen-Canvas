//! macOS mutation eligibility and filesystem strategy facts.
//!
//! macOS does not expose the Windows source-handle rename primitive.  Zen
//! therefore uses a recoverable namespace claim: an object is moved to a
//! private, exclusive claim name, its physical identity is checked again, and
//! only then is it published to the destination.  This module owns the
//! preflight facts; the durable operation journal remains the authority.

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
pub const MAC_FILESYSTEM_CAPABILITY_INSUFFICIENT: &str = "mac_filesystem_capability_insufficient";
pub const MAC_VOLUME_READ_ONLY: &str = "mac_volume_read_only";
pub const MAC_IMMUTABLE: &str = "mac_immutable";
pub const MAC_POST_COMMIT_IDENTITY_FAILED: &str = "mac_post_commit_identity_failed";
pub const MAC_RECOVERY_REQUIRED: &str = "mac_recovery_required";
pub const MAC_RESTORE_CONFLICT: &str = "mac_restore_conflict";
pub const MAC_CONTENT_AVAILABILITY_UNKNOWN: &str = "mac_content_availability_unknown";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MacMutationEntryKind {
    File,
    Directory,
    Symlink,
}

/// Checks the source and target namespace before a recoverable claim is
/// attempted.  This deliberately permits cloud/provider and non-APFS paths;
/// the selected strategy may return a runtime provider/filesystem error after
/// the same durable preview and journal boundary.
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
        let _source_kind = if source_metadata.is_file() {
            MacMutationEntryKind::File
        } else if source_metadata.is_dir() {
            MacMutationEntryKind::Directory
        } else if source_metadata.file_type().is_symlink() {
            MacMutationEntryKind::Symlink
        } else {
            return Err(MAC_FILESYSTEM_NOT_SUPPORTED);
        };

        let source_parent = source.parent().ok_or(MAC_SOURCE_IDENTITY_CHANGED)?;
        let source_parent_metadata = verified_directory_metadata(source_parent)?;
        let target_parent_metadata = verified_directory_metadata(target_parent)?;

        if source_parent_metadata.dev() != source_metadata.dev()
            || target_parent_metadata.dev() == 0
        {
            return Err(MAC_FILESYSTEM_NOT_SUPPORTED);
        }

        let source_volume = super::volume::inspect(source_parent);
        let target_volume = super::volume::inspect(target_parent);
        for volume in [&source_volume, &target_volume] {
            if volume.filesystem_type.is_none() || volume.is_read_only.is_none() {
                return Err(MAC_FILESYSTEM_CAPABILITY_INSUFFICIENT);
            }
            if volume.is_read_only == Some(true) {
                return Err(MAC_VOLUME_READ_ONLY);
            }
        }

        // A package root is one logical namespace object and may be moved as
        // a whole.  A path inside a package is never an independent product
        // mutation target.
        if path_has_package_ancestor(source)
            || super::package::is_package(target_parent)
            || path_has_package_ancestor(target_parent)
        {
            return Err(MAC_PACKAGE_MUTATION_NOT_SUPPORTED);
        }

        // Immutable flags are a stable runtime refusal.  Zen never silently
        // clears them; an explicitly confirmed override can be added later.
        if source_metadata_flags(&source_metadata)? & immutable_flags() != 0 {
            return Err(MAC_IMMUTABLE);
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
        MacMutationEntryKind::Symlink => false,
    };
    if !type_matches {
        return Err(MAC_SOURCE_IDENTITY_CHANGED);
    }
    if metadata.dev() != parent_device {
        return Err(MAC_FILESYSTEM_CAPABILITY_INSUFFICIENT);
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
fn path_has_package_ancestor(path: &Path) -> bool {
    path.ancestors()
        .skip(1)
        .take_while(|ancestor| !ancestor.as_os_str().is_empty())
        .any(super::package::is_package)
}

#[cfg(target_os = "macos")]
fn source_metadata_flags(metadata: &std::fs::Metadata) -> Result<u32, &'static str> {
    use std::os::darwin::fs::MetadataExt;

    Ok(metadata.st_flags())
}

#[cfg(target_os = "macos")]
const fn immutable_flags() -> u32 {
    // UF_IMMUTABLE and SF_IMMUTABLE are stable Darwin stat flags.
    libc::UF_IMMUTABLE as u32 | libc::SF_IMMUTABLE as u32
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
