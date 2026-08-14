//! Conservative File Provider domain probing.
//!
//! The current objc2 Foundation bindings do not expose NSFileProviderManager's
//! user-visible URL identity APIs. This adapter therefore deliberately does
//! not guess a generic provider identity and never calls a materialization,
//! download, eviction, or mutation API. Known CloudStorage roots are marked
//! as provider-backed but remain byte-read deferred until a native identity
//! bridge and real provider fixtures prove otherwise.

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

/// Generic File Provider awareness is intentionally not advertised until the
/// OS identity APIs and a real provider fixture have been validated together.
pub const GENERIC_FILE_PROVIDER_AWARENESS_AVAILABLE: bool = false;

pub fn inspect(path: &Path) -> FileProviderProbe {
    if is_known_cloud_storage_path(path) {
        return FileProviderProbe {
            domain_state: FileProviderDomainState::KnownDomain,
            content_availability: MacContentAvailability::Unknown,
            provider_identity: None,
        };
    }

    FileProviderProbe {
        domain_state: FileProviderDomainState::NotDetected,
        content_availability: MacContentAvailability::Unknown,
        provider_identity: None,
    }
}

fn is_known_cloud_storage_path(path: &Path) -> bool {
    let Some(home) = std::env::var_os("HOME").map(PathBuf::from) else {
        return false;
    };
    let root = home.join("Library").join("CloudStorage");
    path == root || path.starts_with(root)
}

#[cfg(test)]
mod tests {
    use super::{inspect, FileProviderDomainState, GENERIC_FILE_PROVIDER_AWARENESS_AVAILABLE};
    use std::path::Path;

    #[test]
    fn generic_provider_awareness_is_not_claimed_without_native_identity_proof() {
        const {
            assert!(!GENERIC_FILE_PROVIDER_AWARENESS_AVAILABLE);
        }
        let probe = inspect(Path::new("/Users/example/Documents/report.txt"));
        assert_eq!(probe.domain_state, FileProviderDomainState::NotDetected);
        assert_eq!(probe.provider_identity, None);
    }

    #[test]
    fn known_cloud_storage_roots_are_deferred_without_materialization() {
        let Some(home) = std::env::var_os("HOME") else {
            return;
        };
        let probe =
            inspect(&std::path::PathBuf::from(home).join("Library/CloudStorage/Provider/item.txt"));
        assert_eq!(probe.domain_state, FileProviderDomainState::KnownDomain);
        assert_eq!(probe.provider_identity, None);
        assert_eq!(
            probe.content_availability,
            super::MacContentAvailability::Unknown
        );
    }
}
