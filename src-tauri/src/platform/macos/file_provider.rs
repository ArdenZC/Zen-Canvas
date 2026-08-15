//! File Provider domain and item identity probing.
//!
//! Generic providers expose a user-visible URL namespace to other apps, but
//! Apple's public item/domain translation APIs are scoped to the provider
//! extension that owns the item. Zen therefore uses the public
//! `NSFileCoordinator` user-visible URL contract plus physical identity and
//! operation-time revalidation. CloudStorage detection is only a routing
//! hint. NSURL resource identifiers and provider materialization keys are
//! diagnostic observations, never provider authority.

use super::types::MacContentAvailability;
use std::path::{Path, PathBuf};

// Zen is not a File Provider extension. The public item/domain translation
// and provider-manager download APIs are therefore intentionally not linked
// into the generic client path. Generic execution uses NSFileCoordinator with
// the user-visible URL and revalidates the physical namespace object at the
// operation boundary.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileProviderDomainState {
    NotDetected,
    KnownDomain,
}

/// The CloudStorage path is only a routing hint. A coordinated URL evidence
/// value is captured only for an execution or explicit-content boundary.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MacFileProviderDetection {
    None,
    CloudStorageNamespaceHint,
    CoordinatedUserVisibleUrl,
}

/// Evidence that Zen may use for generic third-party provider operations.
///
/// `NativeItemDomain` is retained only as a typed boundary for provider
/// extension-owned diagnostics. It is deliberately not returned by the
/// generic inspection path and is never required for mutation. The
/// `CoordinatedUserVisibleUrl` value is a URL/physical-identity observation,
/// not a fabricated provider item identifier.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MacProviderIdentityEvidence {
    NativeItemDomain {
        item_identifier: String,
        domain_identifier: String,
    },
    CoordinatedUserVisibleUrl {
        stable_url_fingerprint: String,
        physical_identity: crate::platform::macos::identity::MacPhysicalIdentity,
    },
    NamespaceHint,
    None,
}

impl MacProviderIdentityEvidence {
    pub fn fingerprint(&self) -> Option<String> {
        match self {
            Self::NativeItemDomain {
                item_identifier,
                domain_identifier,
            } => Some(
                blake3::hash(
                    format!("native-item-domain\0{item_identifier}\0{domain_identifier}")
                        .as_bytes(),
                )
                .to_hex()
                .to_string(),
            ),
            Self::CoordinatedUserVisibleUrl {
                stable_url_fingerprint,
                physical_identity,
            } => Some(
                blake3::hash(
                    format!(
                        "coordinated-url\0{stable_url_fingerprint}\0{}\0{}\0{}\0{}\0{}\0{}\0{}\0{}",
                        physical_identity.dev,
                        physical_identity.ino,
                        physical_identity.mode,
                        physical_identity.file_type,
                        physical_identity.nlink,
                        physical_identity.size,
                        physical_identity.mtime_ns,
                        physical_identity.generation.unwrap_or_default(),
                    )
                    .as_bytes(),
                )
                .to_hex()
                .to_string(),
            ),
            Self::NamespaceHint | Self::None => None,
        }
    }

    pub const fn is_coordinated_url(&self) -> bool {
        matches!(self, Self::CoordinatedUserVisibleUrl { .. })
    }

    pub fn stable_url_fingerprint(&self) -> Option<&str> {
        match self {
            Self::CoordinatedUserVisibleUrl {
                stable_url_fingerprint,
                ..
            } => Some(stable_url_fingerprint),
            Self::NativeItemDomain { .. } | Self::NamespaceHint | Self::None => None,
        }
    }

    pub const fn physical_identity(
        &self,
    ) -> Option<crate::platform::macos::identity::MacPhysicalIdentity> {
        match self {
            Self::CoordinatedUserVisibleUrl {
                physical_identity, ..
            } => Some(*physical_identity),
            Self::NativeItemDomain { .. } | Self::NamespaceHint | Self::None => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MacProviderMaterialization {
    DownloadRequested,
    BoundaryReadable,
    FullyConsumable,
    ProviderNative,
    NotMaterialized,
    Downloading,
    MetadataOnly,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MacProviderMaterializationEvidence {
    None,
    NativeResourceKeys,
    ExplicitDownloadBoundedRead,
}

impl MacProviderMaterializationEvidence {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::NativeResourceKeys => "native_resource_keys",
            Self::ExplicitDownloadBoundedRead => "explicit_download_bounded_read",
        }
    }
}

impl MacProviderMaterialization {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::DownloadRequested => "download_requested",
            Self::BoundaryReadable => "boundary_readable",
            Self::FullyConsumable => "fully_consumable",
            Self::ProviderNative => "provider_native",
            Self::NotMaterialized => "not_materialized",
            Self::Downloading => "downloading",
            Self::MetadataOnly => "metadata_only",
            Self::Unknown => "unknown",
        }
    }

    pub const fn content_availability(self) -> MacContentAvailability {
        match self {
            Self::DownloadRequested | Self::Downloading => MacContentAvailability::Downloading,
            Self::BoundaryReadable => MacContentAvailability::BoundaryReadable,
            Self::FullyConsumable | Self::ProviderNative => MacContentAvailability::Local,
            Self::NotMaterialized => MacContentAvailability::NotLocal,
            Self::MetadataOnly => MacContentAvailability::MetadataOnly,
            Self::Unknown => MacContentAvailability::Unknown,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileProviderProbe {
    pub domain_state: FileProviderDomainState,
    pub detection: MacFileProviderDetection,
    pub materialization: MacProviderMaterialization,
    pub materialization_evidence: MacProviderMaterializationEvidence,
    pub content_availability: MacContentAvailability,
    pub identity_evidence: MacProviderIdentityEvidence,
}

/// Capability layers are intentionally separate. The generic client route is
/// the coordinated user-visible URL route; the native item/domain bridge is
/// not a generic third-party authority.
pub const GENERIC_FILE_PROVIDER_CLIENT_IMPLEMENTED: bool = cfg!(target_os = "macos");
pub const GENERIC_FILE_PROVIDER_AWARENESS_AVAILABLE: bool = cfg!(target_os = "macos");
pub const GENERIC_FILE_PROVIDER_NATIVE_ITEM_IDENTITY_SUPPORTED: bool = false;
pub const GENERIC_FILE_PROVIDER_COORDINATED_URL_SUPPORTED: bool = cfg!(target_os = "macos");
pub const GENERIC_FILE_PROVIDER_MUTATION_AVAILABLE: bool =
    GENERIC_FILE_PROVIDER_CLIENT_IMPLEMENTED && GENERIC_FILE_PROVIDER_COORDINATED_URL_SUPPORTED;

pub const PROVIDER_COORDINATED_URL_UNAVAILABLE: &str = "mac_provider_coordinated_url_unavailable";

#[cfg(target_os = "macos")]
fn recent_explicit_content_proofs() -> &'static std::sync::Mutex<
    std::collections::HashMap<String, (MacProviderMaterialization, std::time::Instant)>,
> {
    static PROOFS: std::sync::OnceLock<
        std::sync::Mutex<
            std::collections::HashMap<String, (MacProviderMaterialization, std::time::Instant)>,
        >,
    > = std::sync::OnceLock::new();
    PROOFS.get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()))
}

#[cfg(target_os = "macos")]
const EXPLICIT_CONTENT_PROOF_TTL: std::time::Duration = std::time::Duration::from_secs(300);

#[cfg(target_os = "macos")]
const EXPLICIT_CONTENT_PROOF_MAX_ITEMS: usize = 1024;

#[cfg(target_os = "macos")]
fn recent_explicit_content_proof(path: &Path) -> Option<MacProviderMaterialization> {
    let evidence = coordinated_user_visible_url_for_execution(path).ok()?;
    let key = evidence.fingerprint()?;
    let Ok(mut proofs) = recent_explicit_content_proofs().lock() else {
        return None;
    };
    let now = std::time::Instant::now();
    proofs.retain(|_, (_, observed_at)| {
        now.saturating_duration_since(*observed_at) <= EXPLICIT_CONTENT_PROOF_TTL
    });
    proofs.get(&key).map(|(state, _)| *state)
}

#[cfg(target_os = "macos")]
fn remember_recent_explicit_content_proof(
    evidence: &MacProviderIdentityEvidence,
    state: MacProviderMaterialization,
) {
    let Some(key) = evidence.fingerprint() else {
        return;
    };
    let Ok(mut proofs) = recent_explicit_content_proofs().lock() else {
        return;
    };
    let now = std::time::Instant::now();
    proofs.retain(|_, (_, observed_at)| {
        now.saturating_duration_since(*observed_at) <= EXPLICIT_CONTENT_PROOF_TTL
    });
    if !proofs.contains_key(&key) && proofs.len() >= EXPLICIT_CONTENT_PROOF_MAX_ITEMS {
        if let Some(oldest) = proofs
            .iter()
            .min_by_key(|(_, (_, observed_at))| *observed_at)
            .map(|(key, _)| key.clone())
        {
            proofs.remove(&oldest);
        }
    }
    proofs.insert(key, (state, now));
}

#[cfg(target_os = "macos")]
pub fn invalidate_materialized_provider_items() {
    if let Ok(mut proofs) = recent_explicit_content_proofs().lock() {
        proofs.clear();
    }
}

/// Captures the only generic-provider authority Zen can establish without
/// being the provider extension: the current user-visible URL namespace
/// object and its physical identity. This is intentionally an execution
/// helper, not a provider-manager lookup and not a promise of provider
/// connectivity.
pub fn coordinated_user_visible_url_for_execution(
    path: &Path,
) -> Result<MacProviderIdentityEvidence, &'static str> {
    #[cfg(target_os = "macos")]
    {
        let path_text = path.to_str().ok_or(PROVIDER_COORDINATED_URL_UNAVAILABLE)?;
        let physical_identity =
            crate::platform::macos::identity::MacPhysicalIdentity::from_path_no_follow(path)
                .map_err(|_| PROVIDER_COORDINATED_URL_UNAVAILABLE)?;
        let stable_url_fingerprint = blake3::hash(path_text.as_bytes()).to_hex().to_string();
        Ok(MacProviderIdentityEvidence::CoordinatedUserVisibleUrl {
            stable_url_fingerprint,
            physical_identity,
        })
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = path;
        Err(PROVIDER_COORDINATED_URL_UNAVAILABLE)
    }
}

/// Performs the explicit user-consented content access route for a generic
/// provider. There is intentionally no provider-extension item/domain call
/// here: the coordinated user-visible URL is the authority, and the bounded
/// read only records `BoundaryReadable`. The real byte operation must still
/// reopen and consume the source itself.
#[cfg(target_os = "macos")]
pub fn request_explicit_content_access<F>(
    path: &Path,
    cancel: Option<&std::sync::atomic::AtomicBool>,
    mut progress: F,
) -> Result<(), &'static str>
where
    F: FnMut(u64, u64),
{
    use std::{
        fs::OpenOptions,
        io::{Read, Seek, SeekFrom},
        os::unix::fs::OpenOptionsExt,
    };

    if cancel.is_some_and(|flag| flag.load(std::sync::atomic::Ordering::Acquire)) {
        return Err("mac_provider_materialization_cancelled");
    }
    let initial_evidence = coordinated_user_visible_url_for_execution(path)?;
    let result = crate::platform::macos::strategy::coordinate_content_access(path, |actual| {
        let evidence = coordinated_user_visible_url_for_execution(actual).map_err(|_| {
            crate::fs_safety::AtomicMoveError::MacMutationNotSupported(
                PROVIDER_COORDINATED_URL_UNAVAILABLE,
            )
        })?;
        let mut file = OpenOptions::new()
            .read(true)
            .custom_flags(libc::O_CLOEXEC | libc::O_NOFOLLOW)
            .open(actual)
            .map_err(|_| {
                crate::fs_safety::AtomicMoveError::MacMutationNotSupported(
                    "mac_provider_item_unavailable",
                )
            })?;
        let metadata = file.metadata().map_err(|_| {
            crate::fs_safety::AtomicMoveError::MacMutationNotSupported(
                "mac_provider_item_unavailable",
            )
        })?;
        if !metadata.is_file() {
            return Err(crate::fs_safety::AtomicMoveError::MacMutationNotSupported(
                "mac_provider_item_unavailable",
            ));
        }
        let opened_identity = crate::platform::macos::identity::MacPhysicalIdentity::from_fd(&file)
            .map_err(|_| {
                crate::fs_safety::AtomicMoveError::MacMutationNotSupported(
                    PROVIDER_COORDINATED_URL_UNAVAILABLE,
                )
            })?;
        let Some(expected_identity) = evidence.physical_identity() else {
            return Err(crate::fs_safety::AtomicMoveError::MacMutationNotSupported(
                PROVIDER_COORDINATED_URL_UNAVAILABLE,
            ));
        };
        // An explicit user action is allowed to make a provider placeholder
        // replace its backing inode while the coordinated accessor is active.
        // Revalidate the user-visible URL namespace, then bind the proof to
        // the identity actually opened. The subsequent byte operation still
        // reopens and validates its own source; this bounded proof is never a
        // claim that the provider has fully materialized the whole file.
        if evidence.stable_url_fingerprint() != initial_evidence.stable_url_fingerprint() {
            return Err(crate::fs_safety::AtomicMoveError::MacMutationNotSupported(
                "mac_provider_url_changed",
            ));
        }
        if !expected_identity.matches(opened_identity) {
            // The physical identity may legitimately change as a provider
            // fetches content into the user-visible namespace. Keep the
            // transition explicit and require the post-open descriptor to be
            // the object represented by the coordinated URL.
            let current =
                crate::platform::macos::identity::MacPhysicalIdentity::from_path_no_follow(actual)
                    .map_err(|_| {
                        crate::fs_safety::AtomicMoveError::MacMutationNotSupported(
                            "mac_provider_url_changed",
                        )
                    })?;
            if !current.matches(opened_identity) {
                return Err(crate::fs_safety::AtomicMoveError::MacMutationNotSupported(
                    "mac_provider_url_changed",
                ));
            }
        }

        const PROOF_RANGE_BYTES: u64 = 64 * 1024;
        let total = metadata.len();
        let ranges = if total <= PROOF_RANGE_BYTES {
            vec![(0_u64, total)]
        } else {
            vec![
                (0_u64, PROOF_RANGE_BYTES),
                (total - PROOF_RANGE_BYTES, PROOF_RANGE_BYTES),
            ]
        };
        let mut buffer = [0_u8; 16 * 1024];
        progress(0, total);
        for (offset, length) in ranges {
            file.seek(SeekFrom::Start(offset)).map_err(|_| {
                crate::fs_safety::AtomicMoveError::MacMutationNotSupported(
                    "mac_provider_download_failed",
                )
            })?;
            let mut remaining = length;
            while remaining > 0 {
                if cancel.is_some_and(|flag| flag.load(std::sync::atomic::Ordering::Acquire)) {
                    return Err(crate::fs_safety::AtomicMoveError::MacMutationNotSupported(
                        "mac_provider_materialization_cancelled",
                    ));
                }
                let read_len = (remaining as usize).min(buffer.len());
                let count = file.read(&mut buffer[..read_len]).map_err(|_| {
                    crate::fs_safety::AtomicMoveError::MacMutationNotSupported(
                        "mac_provider_download_failed",
                    )
                })?;
                if count == 0 {
                    return Err(crate::fs_safety::AtomicMoveError::MacMutationNotSupported(
                        "mac_provider_download_failed",
                    ));
                }
                remaining = remaining.saturating_sub(count as u64);
                progress(total.saturating_sub(remaining), total);
            }
        }
        remember_recent_explicit_content_proof(
            &evidence,
            MacProviderMaterialization::BoundaryReadable,
        );
        progress(total, total);
        Ok(())
    });
    result.map_err(|error| match error {
        crate::fs_safety::AtomicMoveError::MacMutationNotSupported(reason) => reason,
        _ => "mac_provider_coordination_failed",
    })
}

pub fn inspect(path: &Path) -> FileProviderProbe {
    if is_known_cloud_storage_path(path) {
        #[cfg(target_os = "macos")]
        let materialization = recent_explicit_content_proof(path).unwrap_or_else(|| {
            // Generic provider resource keys do not prove byte availability;
            // only an explicit, coordinated bounded read may create this
            // process's recent proof.
            MacProviderMaterialization::Unknown
        });
        #[cfg(not(target_os = "macos"))]
        let materialization = MacProviderMaterialization::Unknown;
        return FileProviderProbe {
            domain_state: FileProviderDomainState::KnownDomain,
            detection: MacFileProviderDetection::CloudStorageNamespaceHint,
            content_availability: materialization.content_availability(),
            materialization,
            materialization_evidence: if matches!(
                materialization,
                MacProviderMaterialization::BoundaryReadable
            ) {
                MacProviderMaterializationEvidence::ExplicitDownloadBoundedRead
            } else {
                MacProviderMaterializationEvidence::None
            },
            identity_evidence: MacProviderIdentityEvidence::NamespaceHint,
        };
    }

    FileProviderProbe {
        domain_state: FileProviderDomainState::NotDetected,
        detection: MacFileProviderDetection::None,
        materialization: MacProviderMaterialization::Unknown,
        materialization_evidence: MacProviderMaterializationEvidence::None,
        content_availability: MacContentAvailability::Unknown,
        identity_evidence: MacProviderIdentityEvidence::None,
    }
}

fn is_known_cloud_storage_path(path: &Path) -> bool {
    let Some(home) = native_home_directory() else {
        return false;
    };
    let root = home.join("Library").join("CloudStorage");
    path == root || path.starts_with(root)
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
        assert_eq!(probe.detection, MacFileProviderDetection::None);
        assert_eq!(
            probe.identity_evidence,
            super::MacProviderIdentityEvidence::None
        );
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
        assert_eq!(
            probe.identity_evidence,
            super::MacProviderIdentityEvidence::NamespaceHint
        );
        assert_eq!(probe.materialization, MacProviderMaterialization::Unknown);
        assert_eq!(
            probe.content_availability,
            super::MacContentAvailability::Unknown
        );
    }

    #[test]
    fn generic_provider_mutation_capability_matches_the_coordinated_url_route() {
        assert_eq!(
            GENERIC_FILE_PROVIDER_MUTATION_AVAILABLE,
            cfg!(target_os = "macos")
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn ordinary_fixture_never_gets_provider_authority_from_path_or_posix_metadata() {
        let root =
            std::env::temp_dir().join(format!("zen-canvas-provider-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).expect("provider fixture");
        let probe = inspect(&root.join("ordinary.txt"));
        assert_eq!(probe.detection, MacFileProviderDetection::None);
        assert_eq!(
            probe.identity_evidence,
            super::MacProviderIdentityEvidence::None
        );
        std::fs::remove_dir_all(root).expect("remove provider fixture");
    }
}
