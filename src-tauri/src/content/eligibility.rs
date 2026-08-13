//! Backend eligibility gates for content reads.
//!
//! The gate is intentionally evaluated before `File::open`. On macOS a
//! ubiquitous item that is not already local is reported as deferred; no
//! implicit iCloud/File Provider download is requested.

#[cfg(target_os = "macos")]
use crate::platform::macos::{CloudItemState, MacFileSemantics};
use std::path::Path;

#[allow(
    dead_code,
    reason = "macOS-only native states are compiled on Windows for shared contracts"
)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ContentEligibility {
    Eligible,
    Directory,
    MetadataOnly,
    RequiresDownloadConfirmation,
    PackageUnsupported,
    CloudDownloading,
    PermissionRequired,
    Unsupported,
    Symlink,
}

impl ContentEligibility {
    pub(crate) fn reason(self) -> &'static str {
        match self {
            Self::Eligible => "content_eligible",
            Self::Directory => "directory_not_supported",
            Self::MetadataOnly => "content_metadata_only",
            Self::RequiresDownloadConfirmation => {
                "cloud_item_not_local_download_confirmation_required"
            }
            Self::PackageUnsupported => "package_not_supported",
            Self::CloudDownloading => "cloud_item_downloading",
            Self::PermissionRequired => "content_permission_required",
            Self::Unsupported => "content_source_not_supported",
            Self::Symlink => "content_symlink_traversal_blocked",
        }
    }

    pub(crate) fn is_eligible(self) -> bool {
        matches!(self, Self::Eligible)
    }
}

pub(crate) fn classify_path(path: &Path, is_directory: bool) -> ContentEligibility {
    #[cfg(target_os = "macos")]
    {
        let metadata = match std::fs::symlink_metadata(path) {
            Ok(metadata) => metadata,
            Err(_) => return ContentEligibility::PermissionRequired,
        };
        if !metadata.is_file() && !metadata.is_dir() {
            return ContentEligibility::Unsupported;
        }
        let semantics = crate::platform::macos::file_semantics::inspect(path);
        if semantics.is_symlink {
            return ContentEligibility::Symlink;
        }
        if semantics.is_package {
            return ContentEligibility::PackageUnsupported;
        }
        if is_directory || metadata.is_dir() {
            return ContentEligibility::Directory;
        }
        classify_macos_semantics(&semantics)
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = path;
        if is_directory {
            ContentEligibility::Directory
        } else {
            ContentEligibility::Eligible
        }
    }
}

#[cfg(target_os = "macos")]
fn classify_macos_semantics(semantics: &MacFileSemantics) -> ContentEligibility {
    if semantics.is_symlink {
        return ContentEligibility::Symlink;
    }
    if semantics.is_package {
        return ContentEligibility::PackageUnsupported;
    }
    match semantics.cloud_state {
        CloudItemState::NotDownloaded => ContentEligibility::RequiresDownloadConfirmation,
        CloudItemState::Downloading => ContentEligibility::CloudDownloading,
        CloudItemState::Unknown => ContentEligibility::MetadataOnly,
        CloudItemState::NotUbiquitous | CloudItemState::Current | CloudItemState::Downloaded
            if semantics.local_content_available =>
        {
            ContentEligibility::Eligible
        }
        CloudItemState::NotUbiquitous | CloudItemState::Current | CloudItemState::Downloaded => {
            ContentEligibility::PermissionRequired
        }
    }
}

#[cfg(test)]
mod tests {
    use super::ContentEligibility;

    #[test]
    fn user_visible_reasons_are_stable_and_deferred_is_not_a_read_failure() {
        assert_eq!(
            ContentEligibility::RequiresDownloadConfirmation.reason(),
            "cloud_item_not_local_download_confirmation_required"
        );
        assert_eq!(
            ContentEligibility::PackageUnsupported.reason(),
            "package_not_supported"
        );
        assert_eq!(
            ContentEligibility::CloudDownloading.reason(),
            "cloud_item_downloading"
        );
        assert_eq!(
            ContentEligibility::MetadataOnly.reason(),
            "content_metadata_only"
        );
        assert!(!ContentEligibility::RequiresDownloadConfirmation.is_eligible());
        assert!(ContentEligibility::Eligible.is_eligible());
    }
}
