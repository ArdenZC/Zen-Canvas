//! File Provider domain and item identity probing.
//!
//! Generic providers expose a user-visible URL namespace to the application;
//! the native transaction boundary is supplied by `NSFileCoordinator` in the
//! mutation strategy.  The identity below is an observed provider-domain plus
//! physical namespace identity.  It is a routing and postcondition fact, not a
//! replacement for the durable Zen journal.

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
    pub provider_identity: Option<String>,
}

pub const GENERIC_FILE_PROVIDER_AWARENESS_AVAILABLE: bool = cfg!(target_os = "macos");

pub fn inspect(path: &Path) -> FileProviderProbe {
    if is_known_cloud_storage_path(path) {
        let provider_identity = provider_item_identity(path);
        return FileProviderProbe {
            domain_state: FileProviderDomainState::KnownDomain,
            content_availability: MacContentAvailability::Unknown,
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
fn provider_item_identity(path: &Path) -> Option<String> {
    use std::os::unix::fs::MetadataExt;

    let home = native_home_directory()?;
    let root = home.join("Library").join("CloudStorage");
    let relative = path.strip_prefix(&root).ok()?;
    let domain = relative.components().next()?.as_os_str().to_string_lossy();
    let metadata = std::fs::symlink_metadata(path).ok()?;
    Some(format!(
        "file-provider:{domain}:{}:{}",
        metadata.dev(),
        metadata.ino()
    ))
}

#[cfg(not(target_os = "macos"))]
fn provider_item_identity(_path: &Path) -> Option<String> {
    None
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
