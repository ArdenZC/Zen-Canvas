//! macOS mutation strategy selection and provider coordination.
//!
//! The durable operation journal remains the authority.  This module only
//! selects the native filesystem adapter and wraps iCloud/File Provider
//! namespace work in Apple's coordination boundary when the path belongs to a
//! provider-backed domain.

use crate::fs_safety::AtomicMoveError;
use std::{path::Path, sync::atomic::AtomicBool};

pub const MAC_PROVIDER_MATERIALIZATION_FAILED: &str = "mac_provider_materialization_failed";
pub const MAC_PROVIDER_MATERIALIZATION_REQUIRED: &str = "mac_provider_materialization_required";
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

/// The operation kind is part of the native coordination contract.  The
/// coordinator must know whether it is protecting a move, delete, replace,
/// or a byte-preserving copy; one generic `ForMoving` wrapper is not safe.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MacCoordinatedOperation {
    Copy,
    Duplicate,
    Rename,
    Move,
    Replace,
    Trash,
    Restore,
    PermanentDelete,
}

impl MacCoordinatedOperation {
    const fn writing_is_delete(self) -> bool {
        matches!(self, Self::Trash | Self::PermanentDelete)
    }

    const fn writing_is_replace(self) -> bool {
        matches!(self, Self::Replace)
    }

    const fn requires_materialization(self) -> bool {
        matches!(self, Self::Copy | Self::Duplicate | Self::Replace)
    }
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
    if matches!(strategy, MacMutationStrategy::FileProviderCoordinated)
        && operation.requires_materialization()
    {
        ensure_file_provider_materialized(source)?;
    }
    if strategy.coordinates_provider() {
        coordinate_operation(source, target, operation, action)
    } else {
        action(source, target)
    }
}

fn ensure_file_provider_materialized(path: &Path) -> Result<(), AtomicMoveError> {
    let probe = crate::platform::macos::file_provider::inspect(path);
    match probe.content_availability {
        crate::platform::macos::types::MacContentAvailability::Local => Ok(()),
        crate::platform::macos::types::MacContentAvailability::NotLocal
        | crate::platform::macos::types::MacContentAvailability::Downloading => Err(
            AtomicMoveError::MacMutationNotSupported(MAC_PROVIDER_MATERIALIZATION_REQUIRED),
        ),
        crate::platform::macos::types::MacContentAvailability::MetadataOnly
        | crate::platform::macos::types::MacContentAvailability::Unknown => Err(
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
    let _ = (manager, cancel);
    // Starting a download is a user-visible materialization side effect. It
    // must be requested explicitly before the operation enters this backend;
    // mutation never silently downloads a placeholder.
    Err(AtomicMoveError::MacMutationNotSupported(
        MAC_PROVIDER_MATERIALIZATION_REQUIRED,
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
    let coordinator = NSFileCoordinator::new();
    let mut native_error = None;
    if operation.writing_is_delete() {
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
    } else {
        let target_url = NSURL::fileURLWithPath(&NSString::from_str(target_text));
        let writing_options = if operation.writing_is_replace() {
            NSFileCoordinatorWritingOptions::ForReplacing
        } else if matches!(
            operation,
            MacCoordinatedOperation::Copy | MacCoordinatedOperation::Duplicate
        ) {
            NSFileCoordinatorWritingOptions::empty()
        } else {
            NSFileCoordinatorWritingOptions::ForMoving
        };
        let block = RcBlock::new(
            move |actual_source: NonNull<NSURL>, actual_target: NonNull<NSURL>| {
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
                let Some(actual_target) = (unsafe { actual_target.as_ref() }).path() else {
                    *result_for_block.borrow_mut() = Some(Err(
                        AtomicMoveError::MacMutationNotSupported(MAC_PROVIDER_COORDINATION_FAILED),
                    ));
                    return;
                };
                let actual_source = std::path::PathBuf::from(actual_source.to_string());
                let actual_target = std::path::PathBuf::from(actual_target.to_string());
                *result_for_block.borrow_mut() = Some(action(&actual_source, &actual_target));
            },
        );
        coordinator.coordinateReadingItemAtURL_options_writingItemAtURL_options_error_byAccessor(
            &source_url,
            NSFileCoordinatorReadingOptions::empty(),
            &target_url,
            writing_options,
            Some(&mut native_error),
            &block,
        );
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
