#[cfg(test)]
use super::platform_support;
use super::{
    atomic_move::{map_claim_error, map_directory_error, AtomicMoveError},
    identity,
    source_claim::{self, ClaimedEntryKind, SourceClaim},
    verified_directory::VerifiedDirectory,
};
use std::{
    ffi::OsString,
    fs::OpenOptions,
    io::{self, Read, Write},
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
};

const COPY_BUFFER_SIZE: usize = 1024 * 1024;

#[cfg(test)]
pub(crate) fn copy_commit_move(
    source: &Path,
    target: &Path,
    expected_identity: Option<&identity::ExpectedFileIdentity>,
    cancel: Option<&AtomicBool>,
) -> Result<(), AtomicMoveError> {
    copy_commit_move_with_claim_path(source, target, expected_identity, None, cancel)
}

#[cfg(test)]
pub(crate) fn copy_commit_move_with_claim_path(
    source: &Path,
    target: &Path,
    expected_identity: Option<&identity::ExpectedFileIdentity>,
    planned_claim_path: Option<&Path>,
    cancel: Option<&AtomicBool>,
) -> Result<(), AtomicMoveError> {
    platform_support::ensure_supported_file_mutation()
        .map_err(|_| AtomicMoveError::UnsupportedPlatformLinux)?;
    let expected = match expected_identity {
        Some(expected) if expected.full_hash.is_some() => expected.clone(),
        Some(_) => {
            return Err(AtomicMoveError::SourceClaimFailed(
                "source identity is incomplete".to_string(),
            ));
        }
        None => identity::capture_identity(source, cancel).map_err(|error| match error {
            identity::IdentityError::SourceMissing => AtomicMoveError::SourceMissing,
            identity::IdentityError::Symlink => AtomicMoveError::ReparsePoint,
            identity::IdentityError::UnsupportedFileType => AtomicMoveError::UnsafePath,
            identity::IdentityError::DirectoryManifestNameEncodingFailed => {
                AtomicMoveError::DirectoryManifestNameEncodingFailed
            }
            identity::IdentityError::Cancelled => AtomicMoveError::Cancelled,
            identity::IdentityError::Io(error) => AtomicMoveError::Io(error),
        })?,
    };
    let target_parent_path = target.parent().ok_or(AtomicMoveError::UnsafePath)?;
    let target_name = target.file_name().ok_or(AtomicMoveError::UnsafePath)?;
    let target_parent =
        VerifiedDirectory::open_existing(target_parent_path).map_err(map_directory_error)?;
    let claim_path = match planned_claim_path {
        Some(path) => path.to_path_buf(),
        None => source_claim::planned_claim_path(source, "copy-commit").map_err(map_claim_error)?,
    };
    let mut claim =
        source_claim::claim_source_at(source, &expected, &claim_path, "copy-commit", cancel)
            .map_err(map_claim_error)?;
    copy_commit_claim(&mut claim, target_parent, target_name, cancel).map(|_| ())
}

pub(crate) fn copy_commit_claim(
    claim: &mut SourceClaim,
    target_parent: VerifiedDirectory,
    target_name: &std::ffi::OsStr,
    cancel: Option<&AtomicBool>,
) -> Result<(), AtomicMoveError> {
    if claim.kind() != ClaimedEntryKind::File {
        let _ = claim.rollback_to_original();
        return Err(AtomicMoveError::CrossVolumeDirectoryMoveUnsupported);
    }
    if is_cancelled(cancel) {
        let _ = claim.rollback_to_original();
        return Err(AtomicMoveError::Cancelled);
    }
    claim
        .verify_current_identity(cancel)
        .map_err(map_claim_error)?;
    target_parent
        .ensure_unchanged()
        .map_err(map_directory_error)?;
    let stage_path = unique_staging_path(&target_parent, target_name);
    let mut target_committed = false;
    let result = (|| {
        copy_file_from_claim(claim, &stage_path, cancel)?;
        sync_staging(&stage_path)?;
        target_parent
            .ensure_unchanged()
            .map_err(map_directory_error)?;
        let staged = identity::capture_identity(&stage_path, cancel).map_err(map_identity_error)?;
        if !identity::content_identity_matches(claim.expected_identity(), &staged) {
            return Err(AtomicMoveError::CopyVerificationFailed);
        }
        source_claim::commit_path_noreplace(
            &stage_path,
            &target_parent,
            &target_parent,
            target_name,
            ClaimedEntryKind::File,
        )
        .map_err(map_claim_error)?;
        target_committed = true;
        target_parent
            .sync()
            .map_err(|_| AtomicMoveError::TargetParentDurabilityUnknown)?;
        let committed = identity::capture_identity(&target_parent.path().join(target_name), cancel)
            .map_err(map_identity_error)?;
        if !identity::content_identity_matches(&staged, &committed) {
            return Err(AtomicMoveError::CopyVerificationFailed);
        }
        claim.sync().map_err(map_claim_error)?;
        #[cfg(test)]
        source_claim::run_claim_test_hook(
            source_claim::ClaimTestPoint::AfterTargetCommitBeforeSourceCleanup,
            claim.original_path(),
            claim.claim_path(),
        );
        claim.delete_claim().map_err(|error| {
            AtomicMoveError::TargetCommittedSourceDeleteFailed(error.to_string())
        })?;
        claim.sync_current_parent().map_err(|error| {
            AtomicMoveError::TargetCommittedSourceDeleteFailed(error.to_string())
        })?;
        #[cfg(test)]
        source_claim::run_claim_test_hook(
            source_claim::ClaimTestPoint::AfterSourceCleanupBeforeJournalComplete,
            claim.original_path(),
            claim.claim_path(),
        );
        Ok(())
    })();

    if result.is_err() && !target_committed {
        let _ = remove_staging(&stage_path, &target_parent);
        if let Err(error) = claim.rollback_to_original() {
            return Err(AtomicMoveError::SourceClaimRollbackFailed(
                error.to_string(),
            ));
        }
    }
    result
}

fn copy_file_from_claim(
    claim: &SourceClaim,
    target: &Path,
    cancel: Option<&AtomicBool>,
) -> Result<(), AtomicMoveError> {
    let mut reader = claim.open_read().map_err(map_claim_error)?;
    let mut writer = OpenOptions::new()
        .read(true)
        .write(true)
        .create_new(true)
        .open(target)
        .map_err(map_create_error)?;
    let mut buffer = vec![0_u8; COPY_BUFFER_SIZE];
    let mut hasher = blake3::Hasher::new();
    hasher.update(b"file\0");
    hasher.update(&claim.expected_identity().size.to_le_bytes());
    let mut copied = 0_u64;
    loop {
        if is_cancelled(cancel) {
            return Err(AtomicMoveError::Cancelled);
        }
        let read = reader.read(&mut buffer).map_err(AtomicMoveError::Io)?;
        if read == 0 {
            break;
        }
        writer
            .write_all(&buffer[..read])
            .map_err(AtomicMoveError::Io)?;
        copied = copied.saturating_add(read as u64);
        hasher.update(&buffer[..read]);
    }
    writer.sync_all().map_err(AtomicMoveError::Io)?;
    let hash = hasher.finalize().to_hex().to_string();
    if copied != claim.expected_identity().size
        || claim.expected_identity().full_hash.as_deref() != Some(hash.as_str())
    {
        return Err(AtomicMoveError::CopyVerificationFailed);
    }
    Ok(())
}

fn unique_staging_path(
    target_parent: &VerifiedDirectory,
    _target_name: &std::ffi::OsStr,
) -> PathBuf {
    target_parent.path().join(OsString::from(format!(
        ".zen-canvas-stage-{}",
        uuid::Uuid::new_v4()
    )))
}

fn sync_staging(path: &Path) -> Result<(), AtomicMoveError> {
    OpenOptions::new()
        .read(true)
        .write(true)
        .open(path)
        .and_then(|file| file.sync_all())
        .map_err(AtomicMoveError::Io)
}

fn remove_staging(path: &Path, parent: &VerifiedDirectory) -> Result<(), AtomicMoveError> {
    source_claim::delete_path_with_binding(path, parent, ClaimedEntryKind::File)
        .map_err(map_claim_error)
}

fn map_identity_error(error: identity::IdentityError) -> AtomicMoveError {
    match error {
        identity::IdentityError::SourceMissing => AtomicMoveError::SourceMissing,
        identity::IdentityError::Symlink => AtomicMoveError::ReparsePoint,
        identity::IdentityError::UnsupportedFileType => AtomicMoveError::UnsafePath,
        identity::IdentityError::DirectoryManifestNameEncodingFailed => {
            AtomicMoveError::DirectoryManifestNameEncodingFailed
        }
        identity::IdentityError::Cancelled => AtomicMoveError::Cancelled,
        identity::IdentityError::Io(error) => AtomicMoveError::Io(error),
    }
}

fn map_create_error(error: io::Error) -> AtomicMoveError {
    if error.kind() == io::ErrorKind::AlreadyExists {
        AtomicMoveError::TargetExists
    } else {
        AtomicMoveError::Io(error)
    }
}

fn is_cancelled(cancel: Option<&AtomicBool>) -> bool {
    cancel.is_some_and(|flag| flag.load(Ordering::Acquire))
}
