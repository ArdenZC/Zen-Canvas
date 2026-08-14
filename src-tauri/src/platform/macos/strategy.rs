//! macOS mutation strategy selection and provider coordination.
//!
//! The durable operation journal remains the authority.  This module only
//! selects the native filesystem adapter and wraps iCloud/File Provider
//! namespace work in Apple's coordination boundary when the path belongs to a
//! provider-backed domain.

use crate::fs_safety::AtomicMoveError;
use std::{path::Path, sync::atomic::AtomicBool};

pub const MAC_PROVIDER_MATERIALIZATION_FAILED: &str = "mac_provider_materialization_failed";
pub const MAC_PROVIDER_COORDINATION_FAILED: &str = "mac_provider_coordination_failed";
pub const MAC_PROVIDER_OFFLINE: &str = "mac_provider_offline";
pub const MAC_PROVIDER_ITEM_UNAVAILABLE: &str = "mac_provider_item_unavailable";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MacMutationStrategy {
    LocalApfs,
    LocalPortable,
    CrossVolume,
    NetworkPortable,
    ICloudCoordinated,
    FileProviderCoordinated,
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
    if !matches!(
        source_cloud.state,
        crate::platform::macos::cloud_item::ICloudItemState::NotICloud
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

/// Performs provider materialization and coordination around one already
/// journaled filesystem transaction.
pub fn with_mutation_strategy<T, F>(
    source: &Path,
    target_parent: &Path,
    cancel: Option<&AtomicBool>,
    action: F,
) -> Result<T, AtomicMoveError>
where
    F: FnOnce() -> Result<T, AtomicMoveError>,
{
    let strategy = select(source, target_parent);
    if matches!(strategy, MacMutationStrategy::ICloudCoordinated) {
        materialize_for_user_action(source, cancel)?;
    }
    if strategy.coordinates_provider() {
        coordinate_move(source, target_parent, action)
    } else {
        action()
    }
}

#[cfg(target_os = "macos")]
fn materialize_for_user_action(
    path: &Path,
    cancel: Option<&AtomicBool>,
) -> Result<(), AtomicMoveError> {
    use objc2_foundation::{NSFileManager, NSString, NSURL};
    use std::{thread, time::Duration};

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
    if matches!(
        initial.content_availability,
        crate::platform::macos::types::MacContentAvailability::Local
    ) {
        return Ok(());
    }
    manager
        .startDownloadingUbiquitousItemAtURL_error(&url)
        .map_err(|_| {
            AtomicMoveError::MacMutationNotSupported(MAC_PROVIDER_MATERIALIZATION_FAILED)
        })?;

    for _ in 0..300 {
        if cancel.is_some_and(|flag| flag.load(std::sync::atomic::Ordering::Acquire)) {
            return Err(AtomicMoveError::Cancelled);
        }
        let state = crate::platform::macos::cloud_item::inspect(path);
        if matches!(
            state.content_availability,
            crate::platform::macos::types::MacContentAvailability::Local
        ) {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(100));
    }
    Err(AtomicMoveError::MacMutationNotSupported(
        MAC_PROVIDER_MATERIALIZATION_FAILED,
    ))
}

#[cfg(not(target_os = "macos"))]
fn materialize_for_user_action(
    _path: &Path,
    _cancel: Option<&AtomicBool>,
) -> Result<(), AtomicMoveError> {
    Ok(())
}

#[cfg(target_os = "macos")]
fn coordinate_move<T, F>(
    source: &Path,
    target_parent: &Path,
    action: F,
) -> Result<T, AtomicMoveError>
where
    F: FnOnce() -> Result<T, AtomicMoveError>,
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
    let target_text = target_parent
        .to_str()
        .ok_or(AtomicMoveError::MacMutationNotSupported(
            MAC_PROVIDER_COORDINATION_FAILED,
        ))?;
    let source_url = NSURL::fileURLWithPath(&NSString::from_str(source_text));
    let target_url = NSURL::fileURLWithPath(&NSString::from_str(target_text));
    let result = Rc::new(RefCell::new(None));
    let pending = Rc::new(RefCell::new(Some(action)));
    let result_for_block = Rc::clone(&result);
    let pending_for_block = Rc::clone(&pending);
    let block = RcBlock::new(move |_source: NonNull<NSURL>, _target: NonNull<NSURL>| {
        let Some(action) = pending_for_block.borrow_mut().take() else {
            *result_for_block.borrow_mut() = Some(Err(AtomicMoveError::MacMutationNotSupported(
                MAC_PROVIDER_COORDINATION_FAILED,
            )));
            return;
        };
        *result_for_block.borrow_mut() = Some(action());
    });
    let coordinator = NSFileCoordinator::new();
    let mut native_error = None;
    coordinator.coordinateReadingItemAtURL_options_writingItemAtURL_options_error_byAccessor(
        &source_url,
        NSFileCoordinatorReadingOptions::empty(),
        &target_url,
        NSFileCoordinatorWritingOptions::ForMoving,
        Some(&mut native_error),
        &block,
    );
    if native_error.is_some() {
        return Err(AtomicMoveError::MacMutationNotSupported(
            MAC_PROVIDER_COORDINATION_FAILED,
        ));
    }
    result.borrow_mut().take().unwrap_or_else(|| {
        Err(AtomicMoveError::MacMutationNotSupported(
            MAC_PROVIDER_COORDINATION_FAILED,
        ))
    })
}

#[cfg(not(target_os = "macos"))]
fn coordinate_move<T, F>(
    _source: &Path,
    _target_parent: &Path,
    action: F,
) -> Result<T, AtomicMoveError>
where
    F: FnOnce() -> Result<T, AtomicMoveError>,
{
    action()
}

#[cfg(test)]
mod tests {
    use super::{select, MacMutationStrategy};
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
}
