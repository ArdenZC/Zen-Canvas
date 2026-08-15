//! File Provider domain and item identity probing.
//!
//! Generic providers expose a user-visible URL namespace to the application;
//! the native transaction boundary is supplied by `NSFileCoordinator` in the
//! mutation strategy.  Path and CloudStorage-domain detection are routing
//! hints only. NSURL's file-resource identifier and materialization keys are
//! diagnostic observations; they are never treated as the provider's
//! item/domain identity or as proof that third-party provider bytes are local.

use super::types::MacContentAvailability;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileProviderDomainState {
    NotDetected,
    KnownDomain,
}

/// The CloudStorage path is only a routing hint.  A native provider identity
/// is required before a provider transaction may claim a path or treat its
/// bytes as local.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MacFileProviderDetection {
    None,
    CloudStorageNamespaceHint,
    NativeProviderIdentified,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MacProviderMaterialization {
    Materialized,
    NotMaterialized,
    Downloading,
    MetadataOnly,
    Unknown,
}

impl MacProviderMaterialization {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Materialized => "materialized",
            Self::NotMaterialized => "not_materialized",
            Self::Downloading => "downloading",
            Self::MetadataOnly => "metadata_only",
            Self::Unknown => "unknown",
        }
    }

    pub const fn content_availability(self) -> MacContentAvailability {
        match self {
            Self::Materialized => MacContentAvailability::Local,
            Self::NotMaterialized => MacContentAvailability::NotLocal,
            Self::Downloading => MacContentAvailability::Downloading,
            Self::MetadataOnly => MacContentAvailability::MetadataOnly,
            Self::Unknown => MacContentAvailability::Unknown,
        }
    }
}

/// Provider identity must come from the provider API.  An NSURL resource
/// identifier, POSIX dev/ino pair, or CloudStorage path is not a substitute
/// for this pair.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MacFileProviderIdentity {
    pub item_identifier: String,
    pub domain_identifier: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileProviderProbe {
    pub domain_state: FileProviderDomainState,
    pub detection: MacFileProviderDetection,
    pub materialization: MacProviderMaterialization,
    pub content_availability: MacContentAvailability,
    pub provider_identity: Option<MacFileProviderIdentity>,
}

/// Path awareness exists on macOS, but this build does not yet have an
/// NSFileProviderManager identity bridge.  Keep mutation unavailable rather
/// than advertising generic File Provider support from a path heuristic.
pub const GENERIC_FILE_PROVIDER_AWARENESS_AVAILABLE: bool = cfg!(target_os = "macos");
pub const GENERIC_FILE_PROVIDER_NATIVE_IDENTITY_AVAILABLE: bool = false;
pub const GENERIC_FILE_PROVIDER_MUTATION_AVAILABLE: bool =
    cfg!(target_os = "macos") && GENERIC_FILE_PROVIDER_NATIVE_IDENTITY_AVAILABLE;

pub fn inspect(path: &Path) -> FileProviderProbe {
    if is_known_cloud_storage_path(path) {
        #[cfg(target_os = "macos")]
        let materialization = native_resource_probe(path);
        #[cfg(not(target_os = "macos"))]
        let materialization = MacProviderMaterialization::Unknown;
        return FileProviderProbe {
            domain_state: FileProviderDomainState::KnownDomain,
            detection: MacFileProviderDetection::CloudStorageNamespaceHint,
            content_availability: materialization.content_availability(),
            materialization,
            provider_identity: None,
        };
    }

    FileProviderProbe {
        domain_state: FileProviderDomainState::NotDetected,
        detection: MacFileProviderDetection::None,
        materialization: MacProviderMaterialization::Unknown,
        content_availability: MacContentAvailability::Unknown,
        provider_identity: None,
    }
}

fn is_known_cloud_storage_path(path: &Path) -> bool {
    let Some(home) = native_home_directory() else {
        return false;
    };
    let root = home.join("Library").join("CloudStorage");
    path == root || path.starts_with(root)
}

#[cfg(target_os = "macos")]
fn native_resource_probe(path: &Path) -> MacProviderMaterialization {
    use objc2_foundation::{
        NSArray, NSMetadataUbiquitousItemDownloadingStatusCurrent,
        NSMetadataUbiquitousItemDownloadingStatusDownloaded, NSNumber, NSString,
        NSURLFileResourceIdentifierKey, NSURLIsUbiquitousItemKey,
        NSURLUbiquitousItemDownloadingStatusKey, NSURL,
    };

    let Some(path) = path.to_str() else {
        return MacProviderMaterialization::Unknown;
    };
    let url = NSURL::fileURLWithPath(&NSString::from_str(path));
    let identity_key = unsafe { NSURLFileResourceIdentifierKey };
    let ubiquitous_key = unsafe { NSURLIsUbiquitousItemKey };
    let downloading_status_key = unsafe { NSURLUbiquitousItemDownloadingStatusKey };
    let keys = NSArray::from_slice(&[identity_key, ubiquitous_key, downloading_status_key]);
    let Ok(values) = url.resourceValuesForKeys_error(&keys) else {
        return MacProviderMaterialization::Unknown;
    };

    // NSURLFileResourceIdentifierKey is useful diagnostic metadata, but it
    // is not the File Provider item/domain identity.  Read it only to make
    // the deliberate non-use explicit and prevent a future path-based
    // identity shortcut.
    let _resource_identifier = values.objectForKey(identity_key).and_then(|value| {
        value
            .clone()
            .downcast::<NSString>()
            .ok()
            .map(|value| value.to_string())
            .or_else(|| {
                value
                    .downcast::<NSNumber>()
                    .ok()
                    .map(|value| value.as_i64().to_string())
            })
    });
    let is_ubiquitous = values
        .objectForKey(ubiquitous_key)
        .and_then(|value| value.downcast::<NSNumber>().ok())
        .map(|value| value.as_bool());
    let is_downloaded = values
        .objectForKey(downloading_status_key)
        .and_then(|value| value.downcast::<NSString>().ok())
        .map(|value| {
            value.isEqualToString(unsafe { NSMetadataUbiquitousItemDownloadingStatusCurrent })
                || value
                    .isEqualToString(unsafe { NSMetadataUbiquitousItemDownloadingStatusDownloaded })
        });
    match (is_ubiquitous, is_downloaded) {
        // A false iCloud flag says only that this is not an iCloud ubiquitous
        // item. It does not prove that a third-party File Provider has local
        // bytes, so remain conservative.
        (Some(false), _) => MacProviderMaterialization::Unknown,
        (Some(true), Some(true)) => MacProviderMaterialization::Materialized,
        (Some(true), Some(false)) => MacProviderMaterialization::NotMaterialized,
        _ => MacProviderMaterialization::Unknown,
    }
}

/// Returns the current user's home directory from Foundation rather than from
/// an environment variable. A hostile or incomplete environment must never
/// make a provider-like path look local.
#[cfg(target_os = "macos")]
pub(crate) fn native_home_directory() -> Option<PathBuf> {
    use objc2_foundation::NSHomeDirectory;

    let home = NSHomeDirectory();
    let text = home.to_string();
    (!text.is_empty()).then(|| PathBuf::from(text))
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn native_home_directory() -> Option<PathBuf> {
    None
}

#[cfg(test)]
mod tests {
    use super::{
        inspect, FileProviderDomainState, MacFileProviderDetection, MacProviderMaterialization,
        GENERIC_FILE_PROVIDER_MUTATION_AVAILABLE,
    };
    use std::path::Path;

    #[test]
    fn generic_provider_awareness_is_platform_scoped() {
        let probe = inspect(Path::new("/Users/example/Documents/report.txt"));
        assert_eq!(probe.domain_state, FileProviderDomainState::NotDetected);
        assert_eq!(probe.provider_identity, None);
        assert_eq!(probe.detection, MacFileProviderDetection::None);
    }

    #[test]
    fn known_cloud_storage_roots_are_deferred_without_materialization() {
        let Some(home) = super::native_home_directory() else {
            return;
        };
        let probe = inspect(&home.join("Library/CloudStorage/Provider/item.txt"));
        assert_eq!(probe.domain_state, FileProviderDomainState::KnownDomain);
        assert_eq!(
            probe.detection,
            MacFileProviderDetection::CloudStorageNamespaceHint
        );
        assert_eq!(probe.provider_identity, None);
        assert_eq!(probe.materialization, MacProviderMaterialization::Unknown);
        assert_eq!(
            probe.content_availability,
            super::MacContentAvailability::Unknown
        );
    }

    #[test]
    fn generic_provider_mutation_is_not_advertised_without_native_identity_bridge() {
        const {
            assert!(!GENERIC_FILE_PROVIDER_MUTATION_AVAILABLE);
        }
    }
}
