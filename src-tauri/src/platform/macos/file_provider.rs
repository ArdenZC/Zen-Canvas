//! File Provider domain and item identity probing.
//!
//! Generic providers expose a user-visible URL namespace to the application;
//! the native transaction boundary is supplied by `NSFileCoordinator` in the
//! mutation strategy.  Path and CloudStorage-domain detection are routing
//! hints only.  When available, NSURL's file-resource identifier and
//! materialization keys provide provider-side evidence without pretending that
//! POSIX dev/ino is a provider identity.

use super::types::MacContentAvailability;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileProviderDomainState {
    NotDetected,
    KnownDomain,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileProviderProbe {
    pub domain_state: FileProviderDomainState,
    pub content_availability: MacContentAvailability,
    /// This is native provider evidence when NSURL exposes it. `None` is
    /// expected when the provider does not publish a resource identifier;
    /// POSIX dev/ino is never substituted for it.
    pub provider_identity: Option<String>,
}

pub const GENERIC_FILE_PROVIDER_AWARENESS_AVAILABLE: bool = cfg!(target_os = "macos");

pub fn inspect(path: &Path) -> FileProviderProbe {
    if is_known_cloud_storage_path(path) {
        #[cfg(target_os = "macos")]
        let (provider_identity, content_availability) = native_resource_probe(path);
        #[cfg(not(target_os = "macos"))]
        let (provider_identity, content_availability) = (None, MacContentAvailability::Unknown);
        return FileProviderProbe {
            domain_state: FileProviderDomainState::KnownDomain,
            content_availability,
            provider_identity,
        };
    }

    FileProviderProbe {
        domain_state: FileProviderDomainState::NotDetected,
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
fn native_resource_probe(path: &Path) -> (Option<String>, MacContentAvailability) {
    use objc2_foundation::{
        NSArray, NSMetadataUbiquitousItemDownloadingStatusCurrent,
        NSMetadataUbiquitousItemDownloadingStatusDownloaded, NSNumber, NSString,
        NSURLFileResourceIdentifierKey, NSURLIsUbiquitousItemKey,
        NSURLUbiquitousItemDownloadingStatusKey, NSURL,
    };

    let Some(path) = path.to_str() else {
        return (None, MacContentAvailability::Unknown);
    };
    let url = NSURL::fileURLWithPath(&NSString::from_str(path));
    let identity_key = unsafe { NSURLFileResourceIdentifierKey };
    let ubiquitous_key = unsafe { NSURLIsUbiquitousItemKey };
    let downloading_status_key = unsafe { NSURLUbiquitousItemDownloadingStatusKey };
    let keys = NSArray::from_slice(&[identity_key, ubiquitous_key, downloading_status_key]);
    let Ok(values) = url.resourceValuesForKeys_error(&keys) else {
        return (None, MacContentAvailability::Unknown);
    };

    let provider_identity =
        values
            .objectForKey(identity_key)
            .and_then(|value| match value.downcast::<NSString>() {
                Ok(value) => Some(format!("nsurl-resource:{}", value)),
                Err(value) => value
                    .downcast::<NSNumber>()
                    .ok()
                    .map(|value| format!("nsurl-resource:{}", value.as_i64())),
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
    let availability = match (is_ubiquitous, is_downloaded) {
        (Some(false), _) => MacContentAvailability::Local,
        (Some(true), Some(true)) => MacContentAvailability::Local,
        (Some(true), Some(false)) => MacContentAvailability::NotLocal,
        _ => MacContentAvailability::Unknown,
    };
    (provider_identity, availability)
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
    use super::{inspect, FileProviderDomainState};
    use std::path::Path;

    #[test]
    fn generic_provider_awareness_is_platform_scoped() {
        let probe = inspect(Path::new("/Users/example/Documents/report.txt"));
        assert_eq!(probe.domain_state, FileProviderDomainState::NotDetected);
        assert_eq!(probe.provider_identity, None);
    }

    #[test]
    fn known_cloud_storage_roots_are_deferred_without_materialization() {
        let Some(home) = super::native_home_directory() else {
            return;
        };
        let probe = inspect(&home.join("Library/CloudStorage/Provider/item.txt"));
        assert_eq!(probe.domain_state, FileProviderDomainState::KnownDomain);
        assert_eq!(probe.provider_identity, None);
        assert_eq!(
            probe.content_availability,
            super::MacContentAvailability::Unknown
        );
    }
}
