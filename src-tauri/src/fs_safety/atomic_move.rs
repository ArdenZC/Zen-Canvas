#[cfg(windows)]
use super::copy_commit;
use super::{
    identity, platform_support, source_claim, source_claim::SourceClaimError,
    verified_directory::VerifiedDirectory,
};
use std::{
    io,
    path::Path,
    sync::atomic::{AtomicBool, Ordering},
};
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AtomicMoveMethod {
    SameVolumeNoReplace,
    CrossVolumeCopyCommit,
}

/// Structured durability state for a filesystem mutation.
///
/// Callers must use this value when deciding whether a journal row can be
/// marked failed/rolled back.  The error text is intentionally not part of
/// the state machine because several variants carry platform error details.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AtomicMoveCommitState {
    RolledBack,
    SourceClaimed,
    TargetCommitted,
    SourceCleanupPending,
    Completed,
    ManualReview,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AtomicMoveOutcome {
    pub method: AtomicMoveMethod,
    pub commit_state: AtomicMoveCommitState,
}

#[derive(Debug, Error)]
pub enum AtomicMoveError {
    #[error("target_exists")]
    TargetExists,
    #[error("source_missing")]
    SourceMissing,
    #[error("source_changed")]
    SourceChanged,
    #[error("cross_device")]
    CrossDevice,
    #[error("cross_volume_directory_move_unsupported")]
    CrossVolumeDirectoryMoveUnsupported,
    #[error("cross_volume_file_move_unsupported_on_macos")]
    CrossVolumeFileMoveUnsupportedOnMacos,
    #[error("atomic_noreplace_unsupported")]
    UnsupportedAtomicNoReplace,
    #[error("atomic_source_binding_unsupported")]
    AtomicSourceBindingUnsupported,
    #[error("unsupported_platform_linux")]
    UnsupportedPlatformLinux,
    #[error("macos_file_mutation_source_binding_unsupported")]
    MacosFileMutationSourceBindingUnsupported,
    #[error("target_parent_identity_changed")]
    TargetParentIdentityChanged,
    #[error("target_parent_durability_unknown")]
    TargetParentDurabilityUnknown,
    #[error("staging_identity_changed")]
    StagingIdentityChanged,
    #[error("staging_handle_commit_unsupported")]
    StagingHandleCommitUnsupported,
    #[error("target_committed_durability_unknown")]
    TargetCommittedDurabilityUnknown,
    #[error("target_committed_identity_mismatch")]
    TargetCommittedIdentityMismatch,
    #[error("target_committed_source_cleanup_pending")]
    TargetCommittedSourceCleanupPending,
    #[error("unsafe_path")]
    UnsafePath,
    #[error("reparse_point")]
    ReparsePoint,
    #[error("symlink")]
    Symlink,
    #[error("cancelled")]
    Cancelled,
    #[error("copy_verification_failed")]
    CopyVerificationFailed,
    #[error("directory_manifest_name_encoding_failed")]
    DirectoryManifestNameEncodingFailed,
    #[error("source_claim_failed: {0}")]
    SourceClaimFailed(String),
    #[error("source_claim_mismatch")]
    SourceClaimMismatch,
    #[error("source_claim_rollback_failed: {0}")]
    SourceClaimRollbackFailed(String),
    #[error("source_claim_recovery_required: {0}")]
    SourceClaimRecoveryRequired(String),
    #[error("target_committed_source_delete_failed: {0}")]
    TargetCommittedSourceDeleteFailed(String),
    #[error("io: {0}")]
    Io(#[from] io::Error),
}

impl AtomicMoveError {
    pub fn commit_state(&self) -> AtomicMoveCommitState {
        match self {
            Self::TargetCommittedSourceDeleteFailed(_)
            | Self::TargetCommittedSourceCleanupPending => {
                AtomicMoveCommitState::SourceCleanupPending
            }
            Self::TargetCommittedDurabilityUnknown | Self::TargetCommittedIdentityMismatch => {
                AtomicMoveCommitState::ManualReview
            }
            Self::SourceClaimRecoveryRequired(_) | Self::SourceClaimRollbackFailed(_) => {
                AtomicMoveCommitState::SourceClaimed
            }
            _ => AtomicMoveCommitState::RolledBack,
        }
    }

    pub fn is_post_commit(&self) -> bool {
        matches!(
            self.commit_state(),
            AtomicMoveCommitState::TargetCommitted
                | AtomicMoveCommitState::SourceCleanupPending
                | AtomicMoveCommitState::ManualReview
        )
    }

    pub fn is_cancelled(&self) -> bool {
        matches!(self, Self::Cancelled)
    }
}

pub fn atomic_move_noreplace(
    source: &Path,
    target: &Path,
    expected_identity: Option<&identity::ExpectedFileIdentity>,
    cancel: Option<&AtomicBool>,
) -> Result<AtomicMoveOutcome, AtomicMoveError> {
    atomic_move_noreplace_with_claim_path(source, target, expected_identity, None, cancel)
}

pub fn atomic_move_noreplace_with_claim_path(
    source: &Path,
    target: &Path,
    expected_identity: Option<&identity::ExpectedFileIdentity>,
    planned_claim_path: Option<&Path>,
    cancel: Option<&AtomicBool>,
) -> Result<AtomicMoveOutcome, AtomicMoveError> {
    atomic_move_noreplace_with_claim_path_and_observer(
        source,
        target,
        expected_identity,
        planned_claim_path,
        cancel,
        None,
    )
}

pub(crate) fn atomic_move_noreplace_with_claim_path_and_observer(
    source: &Path,
    target: &Path,
    expected_identity: Option<&identity::ExpectedFileIdentity>,
    planned_claim_path: Option<&Path>,
    cancel: Option<&AtomicBool>,
    mut observer: Option<&mut crate::fs_safety::PhaseObserver<'_>>,
) -> Result<AtomicMoveOutcome, AtomicMoveError> {
    platform_support::ensure_supported_file_mutation().map_err(map_platform_error)?;
    if is_cancelled(cancel) {
        return Err(AtomicMoveError::Cancelled);
    }
    let target_parent_path = target.parent().ok_or(AtomicMoveError::UnsafePath)?;
    let target_name = target.file_name().ok_or(AtomicMoveError::UnsafePath)?;
    let target_parent =
        VerifiedDirectory::open_existing(target_parent_path).map_err(map_directory_error)?;
    if target.exists() {
        return Err(AtomicMoveError::TargetExists);
    }
    let expected = match expected_identity {
        Some(expected) if expected.full_hash.is_some() => expected.clone(),
        Some(_) => {
            return Err(AtomicMoveError::SourceClaimFailed(
                "source identity is incomplete".to_string(),
            ));
        }
        None => identity::capture_identity(source, cancel).map_err(map_identity_error)?,
    };
    let claim_path = match planned_claim_path {
        Some(path) => path.to_path_buf(),
        None => source_claim::planned_claim_path(source, "atomic-move").map_err(map_claim_error)?,
    };
    let mut claim =
        source_claim::claim_source_at(source, &expected, &claim_path, "atomic-move", cancel)
            .map_err(map_claim_error)?;
    if let Err(error) = notify_phase(&mut observer, "source_claimed") {
        return match claim.rollback_to_original() {
            Ok(()) => Err(error),
            Err(rollback) => Err(AtomicMoveError::SourceClaimRollbackFailed(
                rollback.to_string(),
            )),
        };
    }
    #[cfg(any(test, feature = "native-qa"))]
    source_claim::run_claim_test_hook(
        source_claim::ClaimTestPoint::AfterClaimVerifiedBeforeTargetCommit,
        source,
        &claim_path,
    );

    if claim.original_volume_id() == target_parent.identity().volume_id {
        let result = claim.commit_to(target_parent, target_name);
        return match result {
            Ok(_committed_path) => {
                notify_phase(&mut observer, "target_committed")?;
                #[cfg(any(test, feature = "native-qa"))]
                if test_faults::take_fault(test_faults::AtomicFaultPoint::SourceCleanup) {
                    notify_phase(&mut observer, "source_cleanup_pending")?;
                    return Err(AtomicMoveError::TargetCommittedSourceCleanupPending);
                }
                #[cfg(any(test, feature = "native-qa"))]
                if test_faults::take_fault(test_faults::AtomicFaultPoint::TargetDurability) {
                    return Err(AtomicMoveError::TargetCommittedDurabilityUnknown);
                }
                claim
                    .sync()
                    .map_err(|_| AtomicMoveError::TargetCommittedDurabilityUnknown)?;
                claim
                    .sync_current_parent()
                    .map_err(|_| AtomicMoveError::TargetCommittedDurabilityUnknown)?;
                claim
                    .sync_original_parent()
                    .map_err(|_| AtomicMoveError::TargetCommittedDurabilityUnknown)?;
                claim
                    .current_parent_unchanged()
                    .map_err(|_| AtomicMoveError::TargetCommittedIdentityMismatch)?;
                #[cfg(any(test, feature = "native-qa"))]
                if test_faults::take_fault(test_faults::AtomicFaultPoint::TargetIdentity) {
                    return Err(AtomicMoveError::TargetCommittedIdentityMismatch);
                }
                let actual = claim
                    .verify_current_identity(cancel)
                    .map_err(|_| AtomicMoveError::TargetCommittedIdentityMismatch)?;
                if !identity::identity_matches(&expected, &actual) {
                    return Err(AtomicMoveError::TargetCommittedIdentityMismatch);
                }
                let path_actual = identity::capture_identity(claim.current_path(), cancel)
                    .map_err(|_| AtomicMoveError::TargetCommittedIdentityMismatch)?;
                if !identity::identity_matches(&actual, &path_actual) {
                    return Err(AtomicMoveError::TargetCommittedIdentityMismatch);
                }
                notify_phase(&mut observer, "completed")?;
                Ok(AtomicMoveOutcome {
                    method: AtomicMoveMethod::SameVolumeNoReplace,
                    commit_state: AtomicMoveCommitState::Completed,
                })
            }
            Err(error) => Err(rollback_after_failure(&mut claim, error)),
        };
    }

    if matches!(claim.kind(), source_claim::ClaimedEntryKind::Directory) {
        let _ = claim.rollback_to_original();
        return Err(AtomicMoveError::CrossVolumeDirectoryMoveUnsupported);
    }
    #[cfg(target_os = "macos")]
    {
        let _ = claim.rollback_to_original();
        Err(AtomicMoveError::CrossVolumeFileMoveUnsupportedOnMacos)
    }
    #[cfg(windows)]
    {
        copy_commit::copy_commit_claim(&mut claim, target_parent, target_name, cancel, observer)
            .map(|_| AtomicMoveOutcome {
                method: AtomicMoveMethod::CrossVolumeCopyCommit,
                commit_state: AtomicMoveCommitState::Completed,
            })
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        let _ = claim.rollback_to_original();
        Err(AtomicMoveError::UnsupportedPlatformLinux)
    }
}

fn notify_phase(
    observer: &mut Option<&mut crate::fs_safety::PhaseObserver<'_>>,
    phase: &str,
) -> Result<(), AtomicMoveError> {
    if let Some(observer) = observer.as_deref_mut() {
        observer(phase)?;
    }
    Ok(())
}

#[cfg(any(test, feature = "native-qa"))]
pub mod test_faults {
    use std::cell::RefCell;
    #[cfg(all(test, windows))]
    use std::sync::{Mutex, MutexGuard, OnceLock};

    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub enum AtomicFaultPoint {
        TargetDurability,
        TargetIdentity,
        SourceCleanup,
    }

    thread_local! {
        static FAULT: RefCell<Option<AtomicFaultPoint>> = const { RefCell::new(None) };
    }

    #[cfg(all(test, windows))]
    fn serial() -> &'static Mutex<()> {
        static SERIAL: OnceLock<Mutex<()>> = OnceLock::new();
        SERIAL.get_or_init(|| Mutex::new(()))
    }

    #[cfg(all(test, windows))]
    pub(crate) fn lock() -> MutexGuard<'static, ()> {
        serial()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    pub fn set_fault(point: Option<AtomicFaultPoint>) {
        FAULT.with(|fault| *fault.borrow_mut() = point);
    }

    pub(crate) fn take_fault(point: AtomicFaultPoint) -> bool {
        FAULT.with(|fault| {
            let mut current = fault.borrow_mut();
            if *current == Some(point) {
                *current = None;
                true
            } else {
                false
            }
        })
    }
}

fn map_platform_error(error: platform_support::PlatformSupportError) -> AtomicMoveError {
    match error {
        platform_support::PlatformSupportError::LinuxUnsupported => {
            AtomicMoveError::UnsupportedPlatformLinux
        }
        platform_support::PlatformSupportError::MacosFileMutationSourceBindingUnsupported => {
            AtomicMoveError::MacosFileMutationSourceBindingUnsupported
        }
    }
}

fn rollback_after_failure(
    claim: &mut source_claim::SourceClaim,
    error: SourceClaimError,
) -> AtomicMoveError {
    let mapped = map_claim_error(error);
    if matches!(mapped, AtomicMoveError::TargetExists) {
        return match claim.rollback_to_original() {
            Ok(()) => AtomicMoveError::TargetExists,
            Err(error) => AtomicMoveError::SourceClaimRollbackFailed(error.to_string()),
        };
    }
    match claim.rollback_to_original() {
        Ok(()) => mapped,
        Err(rollback_error) => {
            AtomicMoveError::SourceClaimRollbackFailed(rollback_error.to_string())
        }
    }
}

pub(crate) fn map_directory_error(error: super::PathGuardError) -> AtomicMoveError {
    match error {
        super::PathGuardError::UnsupportedPlatformLinux => {
            AtomicMoveError::UnsupportedPlatformLinux
        }
        super::PathGuardError::MacosFileMutationSourceBindingUnsupported => {
            AtomicMoveError::MacosFileMutationSourceBindingUnsupported
        }
        super::PathGuardError::IdentityChanged => AtomicMoveError::TargetParentIdentityChanged,
        super::PathGuardError::ReparsePoint => AtomicMoveError::ReparsePoint,
        super::PathGuardError::UnsafePath => AtomicMoveError::UnsafePath,
        super::PathGuardError::Io(error) => AtomicMoveError::Io(error),
    }
}

pub(crate) fn map_claim_error(error: SourceClaimError) -> AtomicMoveError {
    match error {
        SourceClaimError::UnsupportedPlatformLinux => AtomicMoveError::UnsupportedPlatformLinux,
        SourceClaimError::MacosFileMutationSourceBindingUnsupported => {
            AtomicMoveError::MacosFileMutationSourceBindingUnsupported
        }
        SourceClaimError::SourceMissing => AtomicMoveError::SourceMissing,
        SourceClaimError::SourceIdentityChanged => AtomicMoveError::SourceChanged,
        SourceClaimError::ClaimFailed(error) => AtomicMoveError::SourceClaimFailed(error),
        SourceClaimError::ClaimMismatch => AtomicMoveError::SourceClaimMismatch,
        SourceClaimError::ClaimRollbackFailed(error) => {
            AtomicMoveError::SourceClaimRollbackFailed(error)
        }
        SourceClaimError::RecoveryRequired(error) => {
            AtomicMoveError::SourceClaimRecoveryRequired(error)
        }
        SourceClaimError::TargetExists => AtomicMoveError::TargetExists,
        SourceClaimError::CrossDevice => AtomicMoveError::CrossDevice,
        SourceClaimError::AtomicSourceBindingUnsupported => {
            AtomicMoveError::AtomicSourceBindingUnsupported
        }
        SourceClaimError::ReparsePoint => AtomicMoveError::ReparsePoint,
        SourceClaimError::UnsupportedFileType => AtomicMoveError::UnsafePath,
        SourceClaimError::Cancelled => AtomicMoveError::Cancelled,
        SourceClaimError::Io(error) => AtomicMoveError::Io(error),
    }
}

fn map_identity_error(error: identity::IdentityError) -> AtomicMoveError {
    match error {
        identity::IdentityError::SourceMissing => AtomicMoveError::SourceMissing,
        identity::IdentityError::Symlink => AtomicMoveError::Symlink,
        identity::IdentityError::UnsupportedFileType => AtomicMoveError::UnsafePath,
        identity::IdentityError::DirectoryManifestNameEncodingFailed => {
            AtomicMoveError::DirectoryManifestNameEncodingFailed
        }
        identity::IdentityError::Cancelled => AtomicMoveError::Cancelled,
        identity::IdentityError::Io(error) => AtomicMoveError::Io(error),
    }
}

fn is_cancelled(cancel: Option<&AtomicBool>) -> bool {
    cancel.is_some_and(|flag| flag.load(Ordering::Acquire))
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use std::{fs, sync::atomic::AtomicBool};

    fn fixture(name: &str) -> std::path::PathBuf {
        let path = std::env::temp_dir().join(format!(
            "zen-canvas-atomic-{name}-{}-{}",
            std::process::id(),
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&path).expect("fixture");
        path
    }

    #[test]
    fn target_created_before_commit_is_never_overwritten() {
        let root = fixture("target-exists");
        let source = root.join("source");
        let target = root.join("target");
        fs::write(&source, b"source").expect("source");
        fs::write(&target, b"target").expect("target");
        let error =
            atomic_move_noreplace(&source, &target, None, None).expect_err("target conflict");
        assert!(matches!(error, AtomicMoveError::TargetExists));
        assert_eq!(fs::read(&source).expect("source bytes"), b"source");
        assert_eq!(fs::read(&target).expect("target bytes"), b"target");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn cancellation_before_claim_leaves_source_and_target_untouched() {
        let root = fixture("cancel-before-claim");
        let source = root.join("source");
        let target = root.join("target");
        fs::write(&source, b"source").expect("source");
        let cancel = AtomicBool::new(true);

        let error = atomic_move_noreplace(&source, &target, None, Some(&cancel))
            .expect_err("cancelled move");

        assert!(matches!(error, AtomicMoveError::Cancelled));
        assert_eq!(fs::read(&source).expect("source bytes"), b"source");
        assert!(!target.exists());
        let _ = fs::remove_dir_all(root);
    }
}
