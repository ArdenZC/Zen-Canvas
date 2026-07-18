use super::{
    copy_commit, identity, platform_support, source_claim, source_claim::SourceClaimError,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AtomicMoveOutcome {
    pub method: AtomicMoveMethod,
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
    #[error("target_parent_identity_changed")]
    TargetParentIdentityChanged,
    #[error("target_parent_durability_unknown")]
    TargetParentDurabilityUnknown,
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
    platform_support::ensure_supported_file_mutation()
        .map_err(|_| AtomicMoveError::UnsupportedPlatformLinux)?;
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
    #[cfg(test)]
    source_claim::run_claim_test_hook(
        source_claim::ClaimTestPoint::AfterClaimVerifiedBeforeTargetCommit,
        source,
        &claim_path,
    );

    if claim.original_volume_id() == target_parent.identity().volume_id {
        let result = claim.commit_to(target_parent, target_name);
        return match result {
            Ok(_committed_path) => {
                claim.sync().map_err(map_claim_error)?;
                claim
                    .sync_current_parent()
                    .map_err(|_| AtomicMoveError::TargetParentDurabilityUnknown)?;
                claim
                    .sync_original_parent()
                    .map_err(|_| AtomicMoveError::TargetParentDurabilityUnknown)?;
                let actual = claim
                    .verify_current_identity(cancel)
                    .map_err(map_claim_error)?;
                if !identity::identity_matches(&expected, &actual) {
                    return Err(AtomicMoveError::SourceClaimMismatch);
                }
                Ok(AtomicMoveOutcome {
                    method: AtomicMoveMethod::SameVolumeNoReplace,
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
        copy_commit::copy_commit_claim(&mut claim, target_parent, target_name, cancel).map(|_| {
            AtomicMoveOutcome {
                method: AtomicMoveMethod::CrossVolumeCopyCommit,
            }
        })
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        let _ = claim.rollback_to_original();
        Err(AtomicMoveError::UnsupportedPlatformLinux)
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
        super::PathGuardError::IdentityChanged => AtomicMoveError::TargetParentIdentityChanged,
        super::PathGuardError::ReparsePoint => AtomicMoveError::ReparsePoint,
        super::PathGuardError::UnsafePath => AtomicMoveError::UnsafePath,
        super::PathGuardError::Io(error) => AtomicMoveError::Io(error),
    }
}

pub(crate) fn map_claim_error(error: SourceClaimError) -> AtomicMoveError {
    match error {
        SourceClaimError::UnsupportedPlatformLinux => AtomicMoveError::UnsupportedPlatformLinux,
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

#[cfg(target_os = "macos")]
pub(crate) fn map_unix_errno_for_test(error: io::Error) -> AtomicMoveError {
    match error.raw_os_error() {
        Some(libc::EEXIST) => AtomicMoveError::TargetExists,
        Some(libc::EXDEV) => AtomicMoveError::CrossDevice,
        Some(libc::ENOSYS) => AtomicMoveError::UnsupportedAtomicNoReplace,
        Some(libc::EINVAL) => AtomicMoveError::UnsupportedAtomicNoReplace,
        Some(libc::ENOTSUP) => AtomicMoveError::UnsupportedAtomicNoReplace,
        Some(libc::EOPNOTSUPP) => AtomicMoveError::UnsupportedAtomicNoReplace,
        _ => AtomicMoveError::Io(error),
    }
}

#[cfg(test)]
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
