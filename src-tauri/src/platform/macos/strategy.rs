//! macOS mutation strategy selection and provider coordination.
//!
//! The durable operation journal remains the authority.  This module only
//! selects the native filesystem adapter and wraps iCloud/File Provider
//! namespace work in Apple's coordination boundary when the path belongs to a
//! provider-backed domain.

use crate::fs_safety::AtomicMoveError;
use std::{path::Path, sync::atomic::AtomicBool};

#[cfg(target_os = "macos")]
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};

pub const MAC_PROVIDER_MATERIALIZATION_FAILED: &str = "mac_provider_materialization_failed";
pub const MAC_PROVIDER_MATERIALIZATION_REQUIRED: &str = "mac_provider_materialization_required";
pub const MAC_PROVIDER_MATERIALIZATION_CANCELLED: &str = "mac_provider_materialization_cancelled";
pub const MAC_PROVIDER_DOWNLOAD_FAILED: &str = "mac_provider_download_failed";
pub const MAC_PROVIDER_COORDINATION_FAILED: &str = "mac_provider_coordination_failed";
pub const MAC_PROVIDER_URL_CHANGED: &str = "mac_provider_url_changed";
pub const MAC_PROVIDER_OFFLINE: &str = "mac_provider_offline";
pub const MAC_PROVIDER_PERMISSION_DENIED: &str = "mac_provider_permission_denied";
pub const MAC_PROVIDER_ITEM_UNAVAILABLE: &str = "mac_provider_item_unavailable";
pub const MAC_FILESYSTEM_CAPABILITY_INSUFFICIENT: &str = "mac_filesystem_capability_insufficient";
pub const MAC_SOURCE_RETIREMENT_PENDING: &str = "mac_source_retirement_pending";

fn map_coordinated_url_error(error: &'static str) -> AtomicMoveError {
    AtomicMoveError::MacMutationNotSupported(
        if error == crate::platform::macos::file_provider::PROVIDER_COORDINATED_URL_UNAVAILABLE {
            crate::platform::macos::file_provider::PROVIDER_COORDINATED_URL_UNAVAILABLE
        } else {
            MAC_PROVIDER_COORDINATION_FAILED
        },
    )
}

#[cfg(target_os = "macos")]
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct SourceRetirementCacheKey {
    volume_identity: String,
    filesystem_type: String,
    mount_path: String,
    root_path: PathBuf,
    read_only: bool,
    root_identity: Option<(u64, u64)>,
}

#[cfg(target_os = "macos")]
#[derive(Debug, Clone, Copy)]
struct SourceRetirementCacheEntry {
    capability: MacSourceRetirementCapability,
    observed_at: Instant,
}

#[cfg(target_os = "macos")]
fn source_retirement_cache(
) -> &'static Mutex<HashMap<SourceRetirementCacheKey, SourceRetirementCacheEntry>> {
    static CACHE: OnceLock<Mutex<HashMap<SourceRetirementCacheKey, SourceRetirementCacheEntry>>> =
        OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

#[cfg(target_os = "macos")]
const SOURCE_RETIREMENT_CACHE_TTL: Duration = Duration::from_secs(30);

#[cfg(target_os = "macos")]
const SOURCE_RETIREMENT_CACHE_MAX_ITEMS: usize = 128;

#[cfg(target_os = "macos")]
fn purge_source_retirement_cache(
    cache: &mut HashMap<SourceRetirementCacheKey, SourceRetirementCacheEntry>,
    now: Instant,
) {
    cache.retain(|_, entry| {
        now.saturating_duration_since(entry.observed_at) <= SOURCE_RETIREMENT_CACHE_TTL
    });
}

#[cfg(target_os = "macos")]
pub fn invalidate_source_retirement_capability_cache() {
    if let Ok(mut cache) = source_retirement_cache().lock() {
        cache.clear();
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MacMutationStrategy {
    LocalApfs,
    LocalPortable,
    CrossVolume,
    NetworkPortable,
    ICloudCoordinated,
    FileProviderCoordinated,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MacSourceRetirementStrategy {
    ExclusiveClaim,
    ProviderCoordinated,
    PortableNamespaceRetirement,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MacSourceRetirementCapability {
    pub strategy: MacSourceRetirementStrategy,
    pub eligible: bool,
    pub reason: Option<&'static str>,
}

impl MacSourceRetirementCapability {
    pub const fn eligible(strategy: MacSourceRetirementStrategy) -> Self {
        Self {
            strategy,
            eligible: true,
            reason: None,
        }
    }

    pub const fn insufficient() -> Self {
        Self {
            strategy: MacSourceRetirementStrategy::PortableNamespaceRetirement,
            eligible: false,
            reason: Some(MAC_FILESYSTEM_CAPABILITY_INSUFFICIENT),
        }
    }

    pub const fn unavailable(strategy: MacSourceRetirementStrategy, reason: &'static str) -> Self {
        Self {
            strategy,
            eligible: false,
            reason: Some(reason),
        }
    }
}

/// The operation kind is part of the native coordination contract.  The
/// coordinator must know whether it is protecting a move, delete, replace,
/// or a byte-preserving copy; one generic `ForMoving` wrapper is not safe.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MacCoordinatedOperation {
    ContentAccess,
    Copy,
    Duplicate,
    Rename,
    Move,
    Replace,
    SafeTrash,
    Restore,
    PermanentDelete,
}

impl MacCoordinatedOperation {
    #[cfg(test)]
    const fn writing_is_delete(self) -> bool {
        matches!(self, Self::PermanentDelete)
    }

    const fn writing_is_replace(self) -> bool {
        matches!(self, Self::Replace)
    }

    const fn requires_materialization(self) -> bool {
        matches!(self, Self::Copy | Self::Duplicate | Self::Replace)
    }

    /// Foundation has two different coordination contracts for a two-URL
    /// operation.  Byte-preserving copies read the source and write the
    /// destination; namespace moves and replacements must write both URLs so
    /// the provider sees the source mutation as well as the target mutation.
    const fn coordination_contract(self) -> MacCoordinatorContract {
        match self {
            Self::ContentAccess => MacCoordinatorContract::ReadSourceOnly,
            Self::Copy | Self::Duplicate => MacCoordinatorContract::ReadSourceWriteTarget,
            Self::Rename | Self::Move | Self::SafeTrash | Self::Restore => {
                MacCoordinatorContract::WriteSourceAndTargetMoving
            }
            Self::Replace => MacCoordinatorContract::WriteSourceAndTargetReplacing,
            Self::PermanentDelete => MacCoordinatorContract::WriteSourceDelete,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MacCoordinatorContract {
    ReadSourceOnly,
    ReadSourceWriteTarget,
    WriteSourceAndTargetMoving,
    WriteSourceAndTargetReplacing,
    WriteSourceDelete,
}

/// Coordinates one explicit, user-consented read against a provider-backed
/// user-visible URL. This is a content-access boundary, not a mutation or
/// durable operation authority.
#[cfg(target_os = "macos")]
pub fn coordinate_content_access<T, F>(source: &Path, action: F) -> Result<T, AtomicMoveError>
where
    F: FnOnce(&Path) -> Result<T, AtomicMoveError>,
{
    coordinate_operation(
        source,
        source,
        MacCoordinatedOperation::ContentAccess,
        |actual_source, _| action(actual_source),
    )
}

#[cfg(not(target_os = "macos"))]
pub fn coordinate_content_access<T, F>(source: &Path, action: F) -> Result<T, AtomicMoveError>
where
    F: FnOnce(&Path) -> Result<T, AtomicMoveError>,
{
    action(source)
}

impl MacMutationStrategy {
    pub const fn label(self) -> &'static str {
        match self {
            Self::LocalApfs => "local_apfs",
            Self::LocalPortable => "local_portable",
            Self::CrossVolume => "cross_volume_copy_verify",
            Self::NetworkPortable => "network_portable",
            Self::ICloudCoordinated => "icloud_coordinated",
            Self::FileProviderCoordinated => "file_provider_coordinated",
        }
    }

    pub const fn coordinates_provider(self) -> bool {
        matches!(
            self,
            Self::ICloudCoordinated | Self::FileProviderCoordinated
        )
    }
}

/// Selects a strategy from backend-observed path and volume facts.  The UI is
/// intentionally not involved in this decision.
pub fn select(source: &Path, target_parent: &Path) -> MacMutationStrategy {
    let source_cloud = crate::platform::macos::cloud_item::inspect(source);
    let target_cloud = target_parent
        .exists()
        .then(|| crate::platform::macos::cloud_item::inspect(target_parent));
    if !matches!(
        source_cloud.state,
        crate::platform::macos::cloud_item::ICloudItemState::NotICloud
    ) || !matches!(
        target_cloud.as_ref().map(|cloud| cloud.state),
        Some(crate::platform::macos::cloud_item::ICloudItemState::NotICloud) | None
    ) {
        return MacMutationStrategy::ICloudCoordinated;
    }

    let source_provider = crate::platform::macos::file_provider::inspect(source);
    let target_provider = crate::platform::macos::file_provider::inspect(target_parent);
    if matches!(
        source_provider.domain_state,
        crate::platform::macos::file_provider::FileProviderDomainState::KnownDomain
    ) || matches!(
        target_provider.domain_state,
        crate::platform::macos::file_provider::FileProviderDomainState::KnownDomain
    ) {
        return MacMutationStrategy::FileProviderCoordinated;
    }

    let source_parent = source.parent().unwrap_or(source);
    let source_volume = crate::platform::macos::volume::inspect(source_parent);
    let target_volume = crate::platform::macos::volume::inspect(target_parent);
    if source_volume.is_local == Some(false) || target_volume.is_local == Some(false) {
        return MacMutationStrategy::NetworkPortable;
    }

    let Some(source_dev) = std::fs::symlink_metadata(source_parent)
        .ok()
        .map(|metadata| std::os::unix::fs::MetadataExt::dev(&metadata))
    else {
        return MacMutationStrategy::LocalPortable;
    };
    let Some(target_dev) = std::fs::symlink_metadata(target_parent)
        .ok()
        .map(|metadata| std::os::unix::fs::MetadataExt::dev(&metadata))
    else {
        return MacMutationStrategy::LocalPortable;
    };
    if source_dev != target_dev {
        return MacMutationStrategy::CrossVolume;
    }

    if source_volume
        .filesystem_type
        .as_deref()
        .is_some_and(|value| value.eq_ignore_ascii_case("apfs"))
        && target_volume
            .filesystem_type
            .as_deref()
            .is_some_and(|value| value.eq_ignore_ascii_case("apfs"))
    {
        MacMutationStrategy::LocalApfs
    } else {
        MacMutationStrategy::LocalPortable
    }
}

/// Determines whether the source volume can retire the original namespace
/// entry after target-first publication. APFS keeps the descriptor-bound
/// exclusive claim path. Other volumes need a separately proven
/// no-replace/identity/durability probe and therefore fail closed here.
pub fn source_retirement_capability(source: &Path) -> MacSourceRetirementCapability {
    let provider = crate::platform::macos::file_provider::inspect(source);
    if matches!(
        provider.domain_state,
        crate::platform::macos::file_provider::FileProviderDomainState::KnownDomain
    ) {
        // Decision B: a generic provider's user-visible URL can be coordinated
        // without pretending that Zen owns the provider extension's item/domain
        // authority. Physical source binding remains operation-owned.
        return MacSourceRetirementCapability::eligible(
            MacSourceRetirementStrategy::ProviderCoordinated,
        );
    }

    let parent = source.parent().unwrap_or(source);
    let volume = crate::platform::macos::volume::inspect(parent);
    if volume
        .filesystem_type
        .as_deref()
        .is_some_and(|value| value.eq_ignore_ascii_case("apfs"))
        && volume.is_local == Some(true)
        && volume.is_read_only != Some(true)
    {
        MacSourceRetirementCapability::eligible(MacSourceRetirementStrategy::ExclusiveClaim)
    } else {
        MacSourceRetirementCapability::insufficient()
    }
}

/// Reports whether a move may defer namespace capability proof to the
/// execution preflight. This function is observation-only: it never creates,
/// writes, renames, syncs, or removes a probe entry. A connected, writable
/// volume with known native facts is eligible for the active probe ladder;
/// unknown or read-only volumes remain fail-closed.
pub fn source_retirement_probe_required(source: &Path) -> bool {
    let parent = source.parent().unwrap_or(source);
    let volume = crate::platform::macos::volume::inspect(parent);
    volume.filesystem_type.is_some()
        && volume.is_read_only != Some(true)
        && volume.is_local.is_some()
}

/// Runs the implementation-backed probe for a known writable connected
/// volume. Network volumes use the same fail-closed primitive ladder only
/// when Foundation/POSIX report a connected, writable volume with stable
/// identity. Disconnects, unknown mounts, and probe failures remain pending;
/// a local fixture is never used as network evidence.
pub fn verify_source_retirement_capability(source: &Path) -> MacSourceRetirementCapability {
    #[cfg(not(target_os = "macos"))]
    {
        let _ = source;
        return MacSourceRetirementCapability::insufficient();
    }

    #[cfg(target_os = "macos")]
    {
        if matches!(
            crate::platform::macos::file_provider::inspect(source).domain_state,
            crate::platform::macos::file_provider::FileProviderDomainState::KnownDomain
        ) {
            return MacSourceRetirementCapability::eligible(
                MacSourceRetirementStrategy::ProviderCoordinated,
            );
        }
        let capability = source_retirement_capability(source);
        if matches!(
            capability.strategy,
            MacSourceRetirementStrategy::ProviderCoordinated
        ) {
            return capability;
        }
        if capability.eligible {
            return capability;
        }
        let parent = source.parent().unwrap_or(source);
        let volume = crate::platform::macos::volume::inspect(parent);
        if volume.is_local.is_none()
            || volume.is_read_only == Some(true)
            || volume.filesystem_type.is_none()
        {
            return capability;
        }
        let cache_key = source_retirement_cache_key(source, &volume);
        if let Some(key) = cache_key.as_ref() {
            if let Ok(mut cache) = source_retirement_cache().lock() {
                let now = Instant::now();
                purge_source_retirement_cache(&mut cache, now);
                if let Some(cached) = cache.get(key).copied() {
                    return cached.capability;
                }
            }
        }
        let source_is_directory = std::fs::symlink_metadata(source)
            .ok()
            .is_some_and(|metadata| metadata.is_dir());
        let result = if crate::fs_safety::source_claim::probe_macos_namespace_retirement(
            parent,
            source_is_directory,
        )
        .is_ok()
        {
            MacSourceRetirementCapability::eligible(
                MacSourceRetirementStrategy::PortableNamespaceRetirement,
            )
        } else {
            capability
        };
        if let Some(key) = cache_key {
            if let Ok(mut cache) = source_retirement_cache().lock() {
                let now = Instant::now();
                purge_source_retirement_cache(&mut cache, now);
                if !cache.contains_key(&key) && cache.len() >= SOURCE_RETIREMENT_CACHE_MAX_ITEMS {
                    if let Some(oldest) = cache
                        .iter()
                        .min_by_key(|(_, entry)| entry.observed_at)
                        .map(|(key, _)| key.clone())
                    {
                        cache.remove(&oldest);
                    }
                }
                cache.insert(
                    key,
                    SourceRetirementCacheEntry {
                        capability: result,
                        observed_at: now,
                    },
                );
            }
        }
        result
    }
}

#[cfg(target_os = "macos")]
fn source_retirement_cache_key(
    source: &Path,
    volume: &crate::platform::macos::volume::MacVolumeSemantics,
) -> Option<SourceRetirementCacheKey> {
    use std::os::unix::fs::MetadataExt;

    let parent = source.parent().unwrap_or(source);
    let root_identity = std::fs::symlink_metadata(parent)
        .ok()
        .map(|metadata| (metadata.dev(), metadata.ino()));
    Some(SourceRetirementCacheKey {
        volume_identity: volume.stable_id.clone()?,
        filesystem_type: volume.filesystem_type.clone()?,
        mount_path: volume.mount_path.clone()?,
        root_path: parent.to_path_buf(),
        read_only: volume.is_read_only?,
        root_identity,
    })
}

/// Performs provider materialization and coordination around one already
/// journaled filesystem transaction.
pub fn with_mutation_strategy<T, F>(
    source: &Path,
    target: &Path,
    cancel: Option<&AtomicBool>,
    operation: MacCoordinatedOperation,
    action: F,
) -> Result<T, AtomicMoveError>
where
    F: FnOnce(&Path, &Path) -> Result<T, AtomicMoveError>,
{
    let target_parent = target.parent().unwrap_or(target);
    let strategy = select(source, target_parent);
    if matches!(strategy, MacMutationStrategy::ICloudCoordinated) {
        materialize_for_user_action(source, cancel, operation)?;
    }
    let (source_provider_evidence, target_provider_evidence) =
        if matches!(strategy, MacMutationStrategy::FileProviderCoordinated) {
            let source_probe = crate::platform::macos::file_provider::inspect(source);
            let target_probe = crate::platform::macos::file_provider::inspect(target_parent);
            let source_evidence = if matches!(
                source_probe.domain_state,
                crate::platform::macos::file_provider::FileProviderDomainState::KnownDomain
            ) {
                Some(
                crate::platform::macos::file_provider::coordinated_user_visible_url_for_execution(
                    source,
                )
                .map_err(map_coordinated_url_error)?,
            )
            } else {
                None
            };
            let target_evidence = if matches!(
                target_probe.domain_state,
                crate::platform::macos::file_provider::FileProviderDomainState::KnownDomain
            ) {
                Some(
                crate::platform::macos::file_provider::coordinated_user_visible_url_for_execution(
                    target_parent,
                )
                .map_err(map_coordinated_url_error)?,
            )
            } else {
                None
            };
            (source_evidence, target_evidence)
        } else {
            (None, None)
        };

    let coordinated_action = |actual_source: &Path, actual_target: &Path| {
        if let Some(expected) = source_provider_evidence.as_ref() {
            let current =
                crate::platform::macos::file_provider::coordinated_user_visible_url_for_execution(
                    actual_source,
                )
                .map_err(map_coordinated_url_error)?;
            if current != *expected {
                return Err(AtomicMoveError::MacMutationNotSupported(
                    MAC_PROVIDER_URL_CHANGED,
                ));
            }
            if operation.requires_materialization() {
                ensure_file_provider_materialized(actual_source)?;
            }
        }
        if let Some(expected) = target_provider_evidence.as_ref() {
            let actual_target_parent = actual_target.parent().unwrap_or(actual_target);
            let current =
                crate::platform::macos::file_provider::coordinated_user_visible_url_for_execution(
                    actual_target_parent,
                )
                .map_err(map_coordinated_url_error)?;
            if current != *expected {
                return Err(AtomicMoveError::MacMutationNotSupported(
                    MAC_PROVIDER_URL_CHANGED,
                ));
            }
        }
        action(actual_source, actual_target)
    };
    if strategy.coordinates_provider() {
        coordinate_operation(source, target, operation, coordinated_action)
    } else {
        coordinated_action(source, target)
    }
}

fn ensure_file_provider_materialized(path: &Path) -> Result<(), AtomicMoveError> {
    let probe = crate::platform::macos::file_provider::inspect(path);
    if !matches!(
        probe.identity_evidence,
        crate::platform::macos::file_provider::MacProviderIdentityEvidence::NamespaceHint
            | crate::platform::macos::file_provider::MacProviderIdentityEvidence::CoordinatedUserVisibleUrl { .. }
    ) {
        return Err(AtomicMoveError::MacMutationNotSupported(
            MAC_PROVIDER_COORDINATION_FAILED,
        ));
    }
    match probe.materialization {
        crate::platform::macos::file_provider::MacProviderMaterialization::BoundaryReadable
        | crate::platform::macos::file_provider::MacProviderMaterialization::FullyConsumable
        | crate::platform::macos::file_provider::MacProviderMaterialization::ProviderNative => {
            Ok(())
        }
        crate::platform::macos::file_provider::MacProviderMaterialization::DownloadRequested
        | crate::platform::macos::file_provider::MacProviderMaterialization::Downloading
        | crate::platform::macos::file_provider::MacProviderMaterialization::NotMaterialized => {
            Err(AtomicMoveError::MacMutationNotSupported(
                MAC_PROVIDER_MATERIALIZATION_REQUIRED,
            ))
        }
        crate::platform::macos::file_provider::MacProviderMaterialization::MetadataOnly
        | crate::platform::macos::file_provider::MacProviderMaterialization::Unknown => Err(
            AtomicMoveError::MacMutationNotSupported(MAC_PROVIDER_ITEM_UNAVAILABLE),
        ),
    }
}

#[cfg(target_os = "macos")]
fn materialize_for_user_action(
    path: &Path,
    cancel: Option<&AtomicBool>,
    operation: MacCoordinatedOperation,
) -> Result<(), AtomicMoveError> {
    use objc2_foundation::{NSFileManager, NSString, NSURL};
    let path_text = path
        .to_str()
        .ok_or(AtomicMoveError::MacMutationNotSupported(
            MAC_PROVIDER_MATERIALIZATION_FAILED,
        ))?;
    let url = NSURL::fileURLWithPath(&NSString::from_str(path_text));
    let manager = NSFileManager::defaultManager();
    if !manager.isUbiquitousItemAtURL(&url) {
        return Ok(());
    }
    let initial = crate::platform::macos::cloud_item::inspect(path);
    if matches!(
        initial.state,
        crate::platform::macos::cloud_item::ICloudItemState::Unknown
    ) {
        return Err(AtomicMoveError::MacMutationNotSupported(
            MAC_PROVIDER_ITEM_UNAVAILABLE,
        ));
    }
    if !operation.requires_materialization()
        || matches!(
            initial.content_availability,
            crate::platform::macos::types::MacContentAvailability::Local
        )
    {
        return Ok(());
    }
    // Mutation never starts a download implicitly. The explicit materialize
    // command below owns this side effect and revalidates the URL before the
    // original preview may be retried.
    let _ = (manager, cancel);
    Err(AtomicMoveError::MacMutationNotSupported(
        MAC_PROVIDER_MATERIALIZATION_REQUIRED,
    ))
}

/// Explicitly materializes a provider-backed source after the user has
/// confirmed the preview action. The returned operation fingerprint is not
/// retained here; the caller must refresh the authoritative preview before
/// retrying the original operation.
#[cfg(target_os = "macos")]
pub fn materialize_explicit<F>(
    path: &Path,
    cancel: Option<&AtomicBool>,
    mut progress: F,
) -> Result<(), AtomicMoveError>
where
    F: FnMut(u64, u64),
{
    use objc2_foundation::{NSFileManager, NSString, NSURL};
    use std::{thread, time::Duration};

    if cancel.is_some_and(|flag| flag.load(std::sync::atomic::Ordering::Acquire)) {
        return Err(AtomicMoveError::MacMutationNotSupported(
            MAC_PROVIDER_MATERIALIZATION_CANCELLED,
        ));
    }
    let path_text = path
        .to_str()
        .ok_or(AtomicMoveError::MacMutationNotSupported(
            MAC_PROVIDER_MATERIALIZATION_FAILED,
        ))?;
    let url = NSURL::fileURLWithPath(&NSString::from_str(path_text));
    let manager = NSFileManager::defaultManager();
    let cloud = crate::platform::macos::cloud_item::inspect(path);
    if matches!(
        cloud.state,
        crate::platform::macos::cloud_item::ICloudItemState::NotICloud
    ) {
        crate::platform::macos::file_provider::request_explicit_content_access(
            path,
            cancel,
            &mut progress,
        )
        .map_err(AtomicMoveError::MacMutationNotSupported)?;
        return Ok(());
    }
    if matches!(
        cloud.content_availability,
        crate::platform::macos::types::MacContentAvailability::Local
    ) {
        progress(1, 1);
        return Ok(());
    }
    if cancel.is_some_and(|flag| flag.load(std::sync::atomic::Ordering::Acquire)) {
        return Err(AtomicMoveError::MacMutationNotSupported(
            MAC_PROVIDER_MATERIALIZATION_CANCELLED,
        ));
    }
    manager
        .startDownloadingUbiquitousItemAtURL_error(&url)
        .map_err(|_| AtomicMoveError::MacMutationNotSupported(MAC_PROVIDER_DOWNLOAD_FAILED))?;

    // The native API is asynchronous. Poll only the read-only resource
    // values, emit bounded progress, and allow cancellation to leave the
    // journal untouched.
    for _ in 0..480 {
        if cancel.is_some_and(|flag| flag.load(std::sync::atomic::Ordering::Acquire)) {
            return Err(AtomicMoveError::MacMutationNotSupported(
                MAC_PROVIDER_MATERIALIZATION_CANCELLED,
            ));
        }
        let current = crate::platform::macos::cloud_item::inspect(path);
        if matches!(
            current.content_availability,
            crate::platform::macos::types::MacContentAvailability::Local
        ) {
            progress(1, 1);
            return Ok(());
        }
        if matches!(
            current.state,
            crate::platform::macos::cloud_item::ICloudItemState::Unknown
        ) {
            return Err(AtomicMoveError::MacMutationNotSupported(
                MAC_PROVIDER_DOWNLOAD_FAILED,
            ));
        }
        progress(0, 1);
        thread::sleep(Duration::from_millis(250));
    }
    Err(AtomicMoveError::MacMutationNotSupported(
        MAC_PROVIDER_DOWNLOAD_FAILED,
    ))
}

#[cfg(not(target_os = "macos"))]
fn materialize_for_user_action(
    _path: &Path,
    _cancel: Option<&AtomicBool>,
    _operation: MacCoordinatedOperation,
) -> Result<(), AtomicMoveError> {
    Ok(())
}

#[cfg(target_os = "macos")]
fn coordinate_operation<T, F>(
    source: &Path,
    target: &Path,
    operation: MacCoordinatedOperation,
    action: F,
) -> Result<T, AtomicMoveError>
where
    F: FnOnce(&Path, &Path) -> Result<T, AtomicMoveError>,
{
    use block2::RcBlock;
    use objc2_foundation::{
        NSFileCoordinator, NSFileCoordinatorReadingOptions, NSFileCoordinatorWritingOptions,
        NSString, NSURL,
    };
    use std::{cell::RefCell, ptr::NonNull, rc::Rc};

    let source_text = source
        .to_str()
        .ok_or(AtomicMoveError::MacMutationNotSupported(
            MAC_PROVIDER_COORDINATION_FAILED,
        ))?;
    let target_text = target
        .to_str()
        .ok_or(AtomicMoveError::MacMutationNotSupported(
            MAC_PROVIDER_COORDINATION_FAILED,
        ))?;
    let source_url = NSURL::fileURLWithPath(&NSString::from_str(source_text));
    let result = Rc::new(RefCell::new(None));
    let pending = Rc::new(RefCell::new(Some(action)));
    let result_for_block = Rc::clone(&result);
    let pending_for_block = Rc::clone(&pending);
    let coordinator = std::rc::Rc::new(NSFileCoordinator::new());
    let mut native_error = None;
    match operation.coordination_contract() {
        MacCoordinatorContract::ReadSourceOnly => {
            let block = RcBlock::new(move |actual_source: NonNull<NSURL>| {
                let Some(action) = pending_for_block.borrow_mut().take() else {
                    *result_for_block.borrow_mut() = Some(Err(
                        AtomicMoveError::MacMutationNotSupported(MAC_PROVIDER_COORDINATION_FAILED),
                    ));
                    return;
                };
                let Some(actual_source) = (unsafe { actual_source.as_ref() }).path() else {
                    *result_for_block.borrow_mut() = Some(Err(
                        AtomicMoveError::MacMutationNotSupported(MAC_PROVIDER_COORDINATION_FAILED),
                    ));
                    return;
                };
                let actual_source = std::path::PathBuf::from(actual_source.to_string());
                *result_for_block.borrow_mut() = Some(action(&actual_source, &actual_source));
            });
            coordinator.coordinateReadingItemAtURL_options_error_byAccessor(
                &source_url,
                NSFileCoordinatorReadingOptions::empty(),
                Some(&mut native_error),
                &block,
            );
        }
        MacCoordinatorContract::WriteSourceDelete => {
            let block = RcBlock::new(move |actual_source: NonNull<NSURL>| {
                let Some(action) = pending_for_block.borrow_mut().take() else {
                    *result_for_block.borrow_mut() = Some(Err(
                        AtomicMoveError::MacMutationNotSupported(MAC_PROVIDER_COORDINATION_FAILED),
                    ));
                    return;
                };
                let Some(actual_source) = (unsafe { actual_source.as_ref() }).path() else {
                    *result_for_block.borrow_mut() = Some(Err(
                        AtomicMoveError::MacMutationNotSupported(MAC_PROVIDER_COORDINATION_FAILED),
                    ));
                    return;
                };
                let actual_source = std::path::PathBuf::from(actual_source.to_string());
                *result_for_block.borrow_mut() = Some(action(&actual_source, &actual_source));
            });
            coordinator.coordinateWritingItemAtURL_options_error_byAccessor(
                &source_url,
                NSFileCoordinatorWritingOptions::ForDeleting,
                Some(&mut native_error),
                &block,
            );
        }
        MacCoordinatorContract::ReadSourceWriteTarget => {
            let target_url = NSURL::fileURLWithPath(&NSString::from_str(target_text));
            let block = RcBlock::new(
                move |actual_source: NonNull<NSURL>, actual_target: NonNull<NSURL>| {
                    let Some(action) = pending_for_block.borrow_mut().take() else {
                        *result_for_block.borrow_mut() =
                            Some(Err(AtomicMoveError::MacMutationNotSupported(
                                MAC_PROVIDER_COORDINATION_FAILED,
                            )));
                        return;
                    };
                    let Some(actual_source) = (unsafe { actual_source.as_ref() }).path() else {
                        *result_for_block.borrow_mut() =
                            Some(Err(AtomicMoveError::MacMutationNotSupported(
                                MAC_PROVIDER_COORDINATION_FAILED,
                            )));
                        return;
                    };
                    let Some(actual_target) = (unsafe { actual_target.as_ref() }).path() else {
                        *result_for_block.borrow_mut() =
                            Some(Err(AtomicMoveError::MacMutationNotSupported(
                                MAC_PROVIDER_COORDINATION_FAILED,
                            )));
                        return;
                    };
                    let actual_source = std::path::PathBuf::from(actual_source.to_string());
                    let actual_target = std::path::PathBuf::from(actual_target.to_string());
                    *result_for_block.borrow_mut() = Some(action(&actual_source, &actual_target));
                },
            );
            coordinator
                .coordinateReadingItemAtURL_options_writingItemAtURL_options_error_byAccessor(
                    &source_url,
                    NSFileCoordinatorReadingOptions::empty(),
                    &target_url,
                    NSFileCoordinatorWritingOptions::empty(),
                    Some(&mut native_error),
                    &block,
                );
        }
        MacCoordinatorContract::WriteSourceAndTargetMoving
        | MacCoordinatorContract::WriteSourceAndTargetReplacing => {
            let target_url = NSURL::fileURLWithPath(&NSString::from_str(target_text));
            let source_options = NSFileCoordinatorWritingOptions::ForMoving;
            let target_options = if operation.writing_is_replace() {
                NSFileCoordinatorWritingOptions::ForReplacing
            } else {
                NSFileCoordinatorWritingOptions::ForMoving
            };
            let coordinator_for_block = std::rc::Rc::clone(&coordinator);
            let block = RcBlock::new(
                move |actual_source: NonNull<NSURL>, actual_target: NonNull<NSURL>| {
                    let Some(action) = pending_for_block.borrow_mut().take() else {
                        *result_for_block.borrow_mut() =
                            Some(Err(AtomicMoveError::MacMutationNotSupported(
                                MAC_PROVIDER_COORDINATION_FAILED,
                            )));
                        return;
                    };
                    let Some(actual_source_path) = (unsafe { actual_source.as_ref() }).path()
                    else {
                        *result_for_block.borrow_mut() =
                            Some(Err(AtomicMoveError::MacMutationNotSupported(
                                MAC_PROVIDER_COORDINATION_FAILED,
                            )));
                        return;
                    };
                    let Some(actual_target_path) = (unsafe { actual_target.as_ref() }).path()
                    else {
                        *result_for_block.borrow_mut() =
                            Some(Err(AtomicMoveError::MacMutationNotSupported(
                                MAC_PROVIDER_COORDINATION_FAILED,
                            )));
                        return;
                    };
                    let actual_source_path =
                        std::path::PathBuf::from(actual_source_path.to_string());
                    let actual_target_path =
                        std::path::PathBuf::from(actual_target_path.to_string());
                    let actual_source_url = NSURL::fileURLWithPath(&NSString::from_str(
                        &actual_source_path.to_string_lossy(),
                    ));
                    let actual_target_url = NSURL::fileURLWithPath(&NSString::from_str(
                        &actual_target_path.to_string_lossy(),
                    ));
                    coordinator_for_block
                        .itemAtURL_willMoveToURL(&actual_source_url, &actual_target_url);
                    let outcome = action(&actual_source_path, &actual_target_path);
                    if outcome.is_ok() {
                        coordinator_for_block
                            .itemAtURL_didMoveToURL(&actual_source_url, &actual_target_url);
                    }
                    *result_for_block.borrow_mut() = Some(outcome);
                },
            );
            coordinator
                .coordinateWritingItemAtURL_options_writingItemAtURL_options_error_byAccessor(
                    &source_url,
                    source_options,
                    &target_url,
                    target_options,
                    Some(&mut native_error),
                    &block,
                );
        }
    }
    if native_error.is_some() {
        return Err(AtomicMoveError::MacMutationNotSupported(
            MAC_PROVIDER_COORDINATION_FAILED,
        ));
    }
    let outcome = result.borrow_mut().take().unwrap_or_else(|| {
        Err(AtomicMoveError::MacMutationNotSupported(
            MAC_PROVIDER_COORDINATION_FAILED,
        ))
    });
    outcome
}

#[cfg(not(target_os = "macos"))]
fn coordinate_operation<T, F>(
    source: &Path,
    target: &Path,
    _operation: MacCoordinatedOperation,
    action: F,
) -> Result<T, AtomicMoveError>
where
    F: FnOnce(&Path, &Path) -> Result<T, AtomicMoveError>,
{
    action(source, target)
}

#[cfg(test)]
mod tests {
    use super::{select, MacCoordinatedOperation, MacCoordinatorContract, MacMutationStrategy};
    use std::path::Path;

    #[test]
    fn strategy_has_explicit_labels_and_provider_boundary() {
        assert_eq!(MacMutationStrategy::LocalApfs.label(), "local_apfs");
        assert!(MacMutationStrategy::ICloudCoordinated.coordinates_provider());
        if !cfg!(target_os = "macos") {
            assert!(!matches!(
                select(Path::new("/tmp/source"), Path::new("/tmp")),
                MacMutationStrategy::ICloudCoordinated
            ));
        }
    }

    #[test]
    fn safe_trash_is_a_two_url_namespace_move_while_permanent_delete_is_single_source() {
        assert!(!MacCoordinatedOperation::SafeTrash.writing_is_delete());
        assert!(MacCoordinatedOperation::PermanentDelete.writing_is_delete());
        assert!(!MacCoordinatedOperation::SafeTrash.requires_materialization());
        assert!(!MacCoordinatedOperation::PermanentDelete.requires_materialization());
        assert_eq!(
            MacCoordinatedOperation::Copy.coordination_contract(),
            MacCoordinatorContract::ReadSourceWriteTarget
        );
        assert_eq!(
            MacCoordinatedOperation::ContentAccess.coordination_contract(),
            MacCoordinatorContract::ReadSourceOnly
        );
        assert_eq!(
            MacCoordinatedOperation::Duplicate.coordination_contract(),
            MacCoordinatorContract::ReadSourceWriteTarget
        );
        for operation in [
            MacCoordinatedOperation::Rename,
            MacCoordinatedOperation::Move,
            MacCoordinatedOperation::SafeTrash,
            MacCoordinatedOperation::Restore,
        ] {
            assert_eq!(
                operation.coordination_contract(),
                MacCoordinatorContract::WriteSourceAndTargetMoving
            );
        }
        assert_eq!(
            MacCoordinatedOperation::Replace.coordination_contract(),
            MacCoordinatorContract::WriteSourceAndTargetReplacing
        );
        assert_eq!(
            MacCoordinatedOperation::PermanentDelete.coordination_contract(),
            MacCoordinatorContract::WriteSourceDelete
        );
    }

    #[test]
    fn portable_retirement_is_not_claimed_without_volume_primitives() {
        let capability =
            super::source_retirement_capability(Path::new("/Volumes/unknown-fixture/source.txt"));
        assert!(!capability.eligible);
        assert_eq!(
            capability.reason,
            Some(super::MAC_FILESYSTEM_CAPABILITY_INSUFFICIENT)
        );
    }
}
