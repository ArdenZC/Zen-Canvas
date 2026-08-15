//! Verified macOS copy/clone publication.
//!
//! This is the cross-volume leg of the existing `AtomicMove` transaction.  It
//! consumes the already-claimed source object, stages into the verified target
//! directory with an exclusive name, verifies content identity, publishes with
//! `RENAME_EXCL`, and retires the claim only after the destination is verified.

use crate::fs_safety::{
    capture_namespace_identity, identity, AtomicMoveError, ClaimedEntryKind, SourceClaim,
    VerifiedDirectory,
};
use std::{
    collections::HashMap,
    ffi::{CString, OsStr, OsString},
    fs::{self, File},
    io::{self, Read, Seek, SeekFrom, Write},
    os::fd::{AsRawFd, FromRawFd, RawFd},
    os::unix::ffi::OsStrExt,
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
};

const COPYFILE_ALL: u32 = 0x0000_000f;
// COPYFILE_METADATA == COPYFILE_STAT | COPYFILE_ACL | COPYFILE_XATTR.
const COPYFILE_METADATA: u32 = 0x0000_000b;
const STAGING_PREFIX: &str = ".zen-canvas-stage-";

pub(crate) fn copy_commit_claim(
    claim: &mut SourceClaim,
    target_parent: VerifiedDirectory,
    target_name: &OsStr,
    cancel: Option<&AtomicBool>,
    observer: Option<&mut crate::fs_safety::PhaseObserver<'_>>,
) -> Result<(), AtomicMoveError> {
    copy_commit_claim_with_source_retirement(
        claim,
        target_parent,
        target_name,
        cancel,
        observer,
        true,
    )
}

pub(crate) fn copy_commit_claim_preserving_source(
    claim: &mut SourceClaim,
    target_parent: VerifiedDirectory,
    target_name: &OsStr,
    cancel: Option<&AtomicBool>,
    observer: Option<&mut crate::fs_safety::PhaseObserver<'_>>,
) -> Result<(), AtomicMoveError> {
    copy_commit_claim_with_source_retirement(
        claim,
        target_parent,
        target_name,
        cancel,
        observer,
        false,
    )
}

fn copy_commit_claim_with_source_retirement(
    claim: &mut SourceClaim,
    target_parent: VerifiedDirectory,
    target_name: &OsStr,
    cancel: Option<&AtomicBool>,
    mut observer: Option<&mut crate::fs_safety::PhaseObserver<'_>>,
    retire_source: bool,
) -> Result<(), AtomicMoveError> {
    target_parent
        .ensure_unchanged()
        .map_err(|_| AtomicMoveError::TargetParentIdentityChanged)?;
    if is_cancelled(cancel) {
        return rollback_before_publish(claim, AtomicMoveError::Cancelled);
    }

    let target_path = target_parent.path().join(target_name);
    if fs::symlink_metadata(&target_path).is_ok() {
        return rollback_before_publish(claim, AtomicMoveError::TargetExists);
    }
    let staging_name = OsString::from(format!("{STAGING_PREFIX}{}", uuid::Uuid::new_v4()));
    let staging_path = target_parent.path().join(&staging_name);
    claim
        .verify_current_identity(cancel)
        .map_err(|error| rollback_claim_error(claim, map_claim_error(error)))?;
    let source_identity = claim
        .verify_content_identity(cancel)
        .map_err(|error| rollback_claim_error(claim, map_claim_error(error)))?;
    notify_phase(&mut observer, "copying")?;

    let copy_result = copy_object(claim, target_parent.raw_fd(), &staging_name, cancel);
    if let Err(error) = copy_result {
        cleanup_staging_at(target_parent.raw_fd(), &staging_name);
        return rollback_before_publish(claim, error);
    }

    let source_after_copy = match claim.verify_content_identity(cancel) {
        Ok(identity) => identity,
        Err(error) => {
            cleanup_staging_at(target_parent.raw_fd(), &staging_name);
            return rollback_before_publish(claim, map_claim_error(error));
        }
    };
    if !identity::content_identity_matches(&source_identity, &source_after_copy) {
        cleanup_staging_at(target_parent.raw_fd(), &staging_name);
        return rollback_before_publish(claim, AtomicMoveError::SourceChanged);
    }

    let staged_identity = match capture_namespace_identity(&staging_path, cancel) {
        Ok(identity) => identity,
        Err(error) => {
            cleanup_staging_at(target_parent.raw_fd(), &staging_name);
            return rollback_before_publish(
                claim,
                AtomicMoveError::Io(io::Error::other(error.to_string())),
            );
        }
    };
    if !identity::content_identity_matches(&source_identity, &staged_identity) {
        cleanup_staging_at(target_parent.raw_fd(), &staging_name);
        return rollback_before_publish(claim, AtomicMoveError::CopyVerificationFailed);
    }
    if is_cancelled(cancel) {
        cleanup_staging_at(target_parent.raw_fd(), &staging_name);
        return rollback_before_publish(claim, AtomicMoveError::Cancelled);
    }

    let staging_physical = crate::platform::macos::identity::MacPhysicalIdentity::from_at(
        target_parent.raw_fd(),
        &staging_name,
    )
    .map_err(AtomicMoveError::Io)?;

    publish_staging_exclusive(
        target_parent.raw_fd(),
        &staging_name,
        target_name,
        claim.kind(),
        staging_physical,
        cancel,
    )
    .map_err(|error| {
        cleanup_staging_at(target_parent.raw_fd(), &staging_name);
        rollback_claim_error(claim, error)
    })?;
    notify_phase(&mut observer, "target_committed")?;

    let committed_identity = capture_namespace_identity(&target_path, cancel)
        .map_err(|_| AtomicMoveError::TargetCommittedIdentityMismatch)?;
    if !identity::content_identity_matches(&source_identity, &committed_identity) {
        return Err(AtomicMoveError::TargetCommittedIdentityMismatch);
    }
    target_parent
        .sync()
        .map_err(|_| AtomicMoveError::TargetCommittedDurabilityUnknown)?;
    notify_phase(&mut observer, "source_cleanup_pending")?;
    if retire_source {
        claim.delete_claim_tree().map_err(|error| {
            AtomicMoveError::TargetCommittedSourceDeleteFailed(error.to_string())
        })?;
    } else {
        claim
            .rollback_to_original()
            .map_err(|error| AtomicMoveError::SourceClaimRollbackFailed(error.to_string()))?;
        claim
            .sync_original_parent()
            .map_err(|_| AtomicMoveError::TargetCommittedSourceCleanupPending)?;
    }
    notify_phase(&mut observer, "completed")?;
    Ok(())
}

/// Copies from the source namespace while the source remains at its original
/// pathname.  This is the target-first primitive for macOS Copy/Duplicate and
/// portable or cross-volume Move.  The source is not claimed until the target
/// has been published and verified; a crash or cancellation before that point
/// therefore leaves the source untouched.
pub(crate) fn copy_commit_source_stable(
    source: &Path,
    target: &Path,
    expected_identity: Option<&identity::ExpectedFileIdentity>,
    planned_claim_path: Option<&Path>,
    cancel: Option<&AtomicBool>,
    mut observer: Option<&mut crate::fs_safety::PhaseObserver<'_>>,
    retire_source: bool,
) -> Result<(), AtomicMoveError> {
    let target_parent_path = target.parent().ok_or(AtomicMoveError::UnsafePath)?;
    let target_name = target.file_name().ok_or(AtomicMoveError::UnsafePath)?;
    let target_parent = VerifiedDirectory::open_existing(target_parent_path)
        .map_err(|_| AtomicMoveError::TargetParentIdentityChanged)?;
    target_parent
        .ensure_unchanged()
        .map_err(|_| AtomicMoveError::TargetParentIdentityChanged)?;
    if is_cancelled(cancel) {
        return Err(AtomicMoveError::Cancelled);
    }
    if fs::symlink_metadata(target).is_ok() {
        return Err(AtomicMoveError::TargetExists);
    }

    let source_parent_path = source.parent().ok_or(AtomicMoveError::UnsafePath)?;
    let source_name = source.file_name().ok_or(AtomicMoveError::UnsafePath)?;
    let source_parent = VerifiedDirectory::open_existing(source_parent_path)
        .map_err(|_| AtomicMoveError::SourceChanged)?;
    let source_metadata = fs::symlink_metadata(source).map_err(|error| {
        if error.kind() == io::ErrorKind::NotFound {
            AtomicMoveError::SourceMissing
        } else {
            AtomicMoveError::Io(error)
        }
    })?;
    let kind = if source_metadata.file_type().is_symlink() {
        ClaimedEntryKind::Symlink
    } else if source_metadata.is_file() {
        ClaimedEntryKind::File
    } else if source_metadata.is_dir() {
        ClaimedEntryKind::Directory
    } else {
        return Err(AtomicMoveError::UnsafePath);
    };
    let physical_before = crate::platform::macos::identity::MacPhysicalIdentity::from_at(
        source_parent.raw_fd(),
        source_name,
    )
    .map_err(|error| {
        if error.kind() == io::ErrorKind::NotFound {
            AtomicMoveError::SourceMissing
        } else {
            AtomicMoveError::Io(error)
        }
    })?;
    let source_handle = match kind {
        ClaimedEntryKind::File => Some(open_file_at(source_parent.raw_fd(), source_name)?),
        ClaimedEntryKind::Directory => {
            Some(open_file_at_directory(source_parent.raw_fd(), source_name)?)
        }
        ClaimedEntryKind::Symlink => None,
    };
    if let Some(handle) = source_handle.as_ref() {
        let opened = crate::platform::macos::identity::MacPhysicalIdentity::from_fd(handle)
            .map_err(AtomicMoveError::Io)?;
        if !physical_before.matches(opened) {
            return Err(AtomicMoveError::MacClaimIdentityMismatch);
        }
    }

    let source_identity = match source_handle.as_ref() {
        Some(handle) => crate::fs_safety::capture_identity_from_handle(handle, source, cancel)
            .map_err(|error| AtomicMoveError::Io(io::Error::other(error.to_string())))?,
        None => capture_namespace_identity(source, cancel)
            .map_err(|error| AtomicMoveError::Io(io::Error::other(error.to_string())))?,
    };
    if let Some(expected) = expected_identity {
        if !identity::identity_matches(expected, &source_identity) {
            return Err(AtomicMoveError::SourceChanged);
        }
    }

    let staging_name = OsString::from(format!("{STAGING_PREFIX}{}", uuid::Uuid::new_v4()));
    notify_phase(&mut observer, "copying")?;
    let copy_result = match kind {
        ClaimedEntryKind::File => {
            let handle = source_handle.as_ref().ok_or(AtomicMoveError::UnsafePath)?;
            if clone_file_if_possible(handle, target_parent.raw_fd(), &staging_name).is_ok() {
                let destination = open_file_at(target_parent.raw_fd(), &staging_name)?;
                copy_metadata_with_native_api(handle, &destination)?;
                verify_basic_metadata(handle, &destination)?;
                Ok(())
            } else {
                cleanup_staging_at(target_parent.raw_fd(), &staging_name);
                let destination = create_staging_file(target_parent.raw_fd(), &staging_name)?;
                copy_file_contents_and_metadata(handle, &destination, cancel)?;
                destination.sync_all().map_err(AtomicMoveError::Io)
            }
        }
        ClaimedEntryKind::Directory => {
            let handle = source_handle.as_ref().ok_or(AtomicMoveError::UnsafePath)?;
            if clone_file_if_possible(handle, target_parent.raw_fd(), &staging_name).is_ok() {
                let destination = open_file_at_directory(target_parent.raw_fd(), &staging_name)?;
                copy_metadata_with_native_api(handle, &destination)?;
                verify_basic_metadata(handle, &destination)?;
                Ok(())
            } else {
                cleanup_staging_at(target_parent.raw_fd(), &staging_name);
                let destination = create_staging_directory(target_parent.raw_fd(), &staging_name)?;
                let mut hardlinks = HashMap::new();
                copy_tree_from_fd(
                    handle.as_raw_fd(),
                    destination.as_raw_fd(),
                    destination.as_raw_fd(),
                    Path::new(""),
                    &mut hardlinks,
                    cancel,
                )?;
                let metadata = handle.metadata().map_err(AtomicMoveError::Io)?;
                copy_fd_metadata(&metadata, &destination)?;
                destination.sync_all().map_err(AtomicMoveError::Io)
            }
        }
        ClaimedEntryKind::Symlink => {
            let link_target = readlink_at(source_parent.raw_fd(), source_name)?;
            symlink_at(&link_target, target_parent.raw_fd(), &staging_name)
        }
    };
    if let Err(error) = copy_result {
        cleanup_staging_at(target_parent.raw_fd(), &staging_name);
        return Err(error);
    }

    let source_after = match source_handle.as_ref() {
        Some(handle) => crate::fs_safety::capture_identity_from_handle(handle, source, cancel)
            .map_err(|error| AtomicMoveError::Io(io::Error::other(error.to_string())))?,
        None => capture_namespace_identity(source, cancel)
            .map_err(|error| AtomicMoveError::Io(io::Error::other(error.to_string())))?,
    };
    let physical_after = crate::platform::macos::identity::MacPhysicalIdentity::from_at(
        source_parent.raw_fd(),
        source_name,
    )
    .map_err(|error| {
        if error.kind() == io::ErrorKind::NotFound {
            AtomicMoveError::MacClaimPathMissing
        } else {
            AtomicMoveError::MacClaimPathUnreadable
        }
    })?;
    if !physical_before.matches(physical_after)
        || !identity::content_identity_matches(&source_identity, &source_after)
    {
        cleanup_staging_at(target_parent.raw_fd(), &staging_name);
        return Err(AtomicMoveError::MacClaimIdentityMismatch);
    }

    let staging_path = target_parent.path().join(&staging_name);
    let staged_identity = capture_namespace_identity(&staging_path, cancel)
        .map_err(|error| AtomicMoveError::Io(io::Error::other(error.to_string())))?;
    if !identity::content_identity_matches(&source_identity, &staged_identity) {
        cleanup_staging_at(target_parent.raw_fd(), &staging_name);
        return Err(AtomicMoveError::CopyVerificationFailed);
    }
    if is_cancelled(cancel) {
        cleanup_staging_at(target_parent.raw_fd(), &staging_name);
        return Err(AtomicMoveError::Cancelled);
    }

    let staging_physical = crate::platform::macos::identity::MacPhysicalIdentity::from_at(
        target_parent.raw_fd(),
        &staging_name,
    )
    .map_err(AtomicMoveError::Io)?;

    publish_staging_exclusive(
        target_parent.raw_fd(),
        &staging_name,
        target_name,
        kind,
        staging_physical,
        cancel,
    )
    .map_err(|error| {
        cleanup_staging_at(target_parent.raw_fd(), &staging_name);
        error
    })?;
    notify_phase(&mut observer, "target_committed")?;

    let committed_identity = capture_namespace_identity(target, cancel)
        .map_err(|_| AtomicMoveError::TargetCommittedIdentityMismatch)?;
    if !identity::content_identity_matches(&source_identity, &committed_identity) {
        return Err(AtomicMoveError::TargetCommittedIdentityMismatch);
    }
    target_parent
        .sync()
        .map_err(|_| AtomicMoveError::TargetCommittedDurabilityUnknown)?;
    if !retire_source {
        notify_phase(&mut observer, "completed")?;
        return Ok(());
    }

    notify_phase(&mut observer, "source_cleanup_pending")?;
    let claim_path = match planned_claim_path {
        Some(path) => path.to_path_buf(),
        None => crate::fs_safety::source_claim::planned_claim_path(source, "source-retirement")
            .map_err(|error| AtomicMoveError::Io(io::Error::other(error.to_string())))?,
    };
    let mut claim = crate::fs_safety::source_claim::claim_source_at(
        source,
        &source_identity,
        &claim_path,
        "source-retirement",
        cancel,
    )
    .map_err(|error| AtomicMoveError::TargetCommittedSourceDeleteFailed(error.to_string()))?;
    if let Err(error) = if claim.kind() == ClaimedEntryKind::Directory {
        claim.delete_claim_tree()
    } else {
        claim.delete_claim()
    } {
        return Err(AtomicMoveError::TargetCommittedSourceDeleteFailed(
            error.to_string(),
        ));
    }
    notify_phase(&mut observer, "completed")?;
    Ok(())
}

fn copy_object(
    claim: &SourceClaim,
    target_parent_fd: RawFd,
    staging_name: &OsStr,
    cancel: Option<&AtomicBool>,
) -> Result<(), AtomicMoveError> {
    match claim.kind() {
        ClaimedEntryKind::File => {
            let source = claim
                .open_read()
                .map_err(|error| AtomicMoveError::Io(io::Error::other(error.to_string())))?;
            if clone_file_if_possible(&source, target_parent_fd, staging_name).is_ok() {
                let destination = open_file_at(target_parent_fd, staging_name)?;
                copy_metadata_with_native_api(&source, &destination)?;
                verify_basic_metadata(&source, &destination)?;
                return Ok(());
            }
            cleanup_staging_at(target_parent_fd, staging_name);
            let destination = create_staging_file(target_parent_fd, staging_name)?;
            copy_file_contents_and_metadata(&source, &destination, cancel)?;
            destination.sync_all().map_err(AtomicMoveError::Io)?;
            Ok(())
        }
        ClaimedEntryKind::Directory => {
            let source = claim
                .clone_handle()
                .map_err(|error| AtomicMoveError::Io(io::Error::other(error.to_string())))?
                .ok_or(AtomicMoveError::UnsafePath)?;
            if clone_file_if_possible(&source, target_parent_fd, staging_name).is_ok() {
                let destination = open_file_at_directory(target_parent_fd, staging_name)?;
                copy_metadata_with_native_api(&source, &destination)?;
                verify_basic_metadata(&source, &destination)?;
                return Ok(());
            }
            cleanup_staging_at(target_parent_fd, staging_name);
            let destination = create_staging_directory(target_parent_fd, staging_name)?;
            let mut hardlinks = HashMap::new();
            copy_tree_from_fd(
                source.as_raw_fd(),
                destination.as_raw_fd(),
                destination.as_raw_fd(),
                Path::new(""),
                &mut hardlinks,
                cancel,
            )?;
            let metadata = source.metadata().map_err(AtomicMoveError::Io)?;
            copy_fd_metadata(&metadata, &destination)?;
            destination.sync_all().map_err(AtomicMoveError::Io)?;
            Ok(())
        }
        ClaimedEntryKind::Symlink => {
            let target = fs::read_link(claim.current_path()).map_err(AtomicMoveError::Io)?;
            symlink_at(&target, target_parent_fd, staging_name)
        }
    }
}

fn clone_file_if_possible(
    source: &File,
    target_parent_fd: RawFd,
    target_name: &OsStr,
) -> Result<(), AtomicMoveError> {
    let target_name =
        CString::new(target_name.as_bytes()).map_err(|_| AtomicMoveError::UnsafePath)?;
    let result = unsafe {
        fclonefileat(
            source.as_raw_fd(),
            target_parent_fd,
            target_name.as_ptr(),
            0,
        )
    };
    if result == 0 {
        Ok(())
    } else {
        Err(AtomicMoveError::Io(io::Error::last_os_error()))
    }
}

fn create_staging_file(parent_fd: RawFd, name: &OsStr) -> Result<File, AtomicMoveError> {
    let name = CString::new(name.as_bytes()).map_err(|_| AtomicMoveError::UnsafePath)?;
    let fd = unsafe {
        libc::openat(
            parent_fd,
            name.as_ptr(),
            libc::O_CREAT | libc::O_EXCL | libc::O_NOFOLLOW | libc::O_CLOEXEC | libc::O_RDWR,
            0o600,
        )
    };
    if fd < 0 {
        return Err(map_create_error(io::Error::last_os_error()));
    }
    Ok(unsafe { File::from_raw_fd(fd) })
}

fn copy_file_contents_and_metadata(
    source: &File,
    destination: &File,
    cancel: Option<&AtomicBool>,
) -> Result<(), AtomicMoveError> {
    let mut native_source = source.try_clone().map_err(AtomicMoveError::Io)?;
    let native_result = unsafe {
        fcopyfile(
            native_source.as_raw_fd(),
            destination.as_raw_fd(),
            std::ptr::null_mut(),
            COPYFILE_ALL,
        )
    };
    if native_result == 0 {
        copy_fd_metadata(
            &source.metadata().map_err(AtomicMoveError::Io)?,
            destination,
        )?;
        return Ok(());
    }

    // The fallback still consumes this verified source descriptor, never
    // reopens the original pathname. A byte-only fallback is not presented as
    // metadata-preserving success.
    native_source
        .seek(SeekFrom::Start(0))
        .map_err(AtomicMoveError::Io)?;
    let mut destination = destination.try_clone().map_err(AtomicMoveError::Io)?;
    destination
        .seek(SeekFrom::Start(0))
        .map_err(AtomicMoveError::Io)?;
    destination.set_len(0).map_err(AtomicMoveError::Io)?;
    let mut buffer = [0_u8; 1024 * 1024];
    loop {
        if is_cancelled(cancel) {
            return Err(AtomicMoveError::Cancelled);
        }
        let read = native_source
            .read(&mut buffer)
            .map_err(AtomicMoveError::Io)?;
        if read == 0 {
            break;
        }
        destination
            .write_all(&buffer[..read])
            .map_err(AtomicMoveError::Io)?;
    }
    copy_metadata_with_native_api(source, &destination)?;
    Ok(())
}

fn copy_metadata_with_native_api(source: &File, destination: &File) -> Result<(), AtomicMoveError> {
    let native_source = source.try_clone().map_err(AtomicMoveError::Io)?;
    if unsafe {
        fcopyfile(
            native_source.as_raw_fd(),
            destination.as_raw_fd(),
            std::ptr::null_mut(),
            COPYFILE_METADATA,
        )
    } != 0
    {
        return Err(AtomicMoveError::MetadataPreservationUnsupported(
            "native_metadata_copy_failed",
        ));
    }
    let metadata = source.metadata().map_err(AtomicMoveError::Io)?;
    copy_fd_metadata(&metadata, destination)
}

fn create_staging_directory(parent_fd: RawFd, name: &OsStr) -> Result<File, AtomicMoveError> {
    let name = CString::new(name.as_bytes()).map_err(|_| AtomicMoveError::UnsafePath)?;
    if unsafe { libc::mkdirat(parent_fd, name.as_ptr(), 0o700) } != 0 {
        return Err(map_create_error(io::Error::last_os_error()));
    }
    open_directory_at(parent_fd, name.as_c_str())
}

fn open_directory_at(parent_fd: RawFd, name: &std::ffi::CStr) -> Result<File, AtomicMoveError> {
    let fd = unsafe {
        libc::openat(
            parent_fd,
            name.as_ptr(),
            libc::O_RDONLY | libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC,
        )
    };
    if fd < 0 {
        return Err(AtomicMoveError::Io(io::Error::last_os_error()));
    }
    Ok(unsafe { File::from_raw_fd(fd) })
}

fn open_file_at(parent_fd: RawFd, name: &OsStr) -> Result<File, AtomicMoveError> {
    let name = CString::new(name.as_bytes()).map_err(|_| AtomicMoveError::UnsafePath)?;
    let fd = unsafe {
        libc::openat(
            parent_fd,
            name.as_ptr(),
            libc::O_RDONLY | libc::O_NOFOLLOW | libc::O_CLOEXEC,
        )
    };
    if fd < 0 {
        return Err(AtomicMoveError::Io(io::Error::last_os_error()));
    }
    Ok(unsafe { File::from_raw_fd(fd) })
}

fn open_file_at_directory(parent_fd: RawFd, name: &OsStr) -> Result<File, AtomicMoveError> {
    let name = CString::new(name.as_bytes()).map_err(|_| AtomicMoveError::UnsafePath)?;
    open_directory_at(parent_fd, name.as_c_str())
}

fn copy_tree_from_fd(
    source_fd: RawFd,
    destination_fd: RawFd,
    destination_root_fd: RawFd,
    relative_prefix: &Path,
    hardlinks: &mut HashMap<(u64, u64), PathBuf>,
    cancel: Option<&AtomicBool>,
) -> Result<(), AtomicMoveError> {
    for name in directory_entry_names(source_fd)? {
        if is_cancelled(cancel) {
            return Err(AtomicMoveError::Cancelled);
        }
        let source_identity =
            crate::platform::macos::identity::MacPhysicalIdentity::from_at(source_fd, &name)
                .map_err(AtomicMoveError::Io)?;
        let relative_path = relative_prefix.join(&name);
        match source_identity.file_type {
            value if value == libc::S_IFLNK as u32 => {
                let target = readlink_at(source_fd, &name)?;
                symlink_at(&target, destination_fd, &name)?;
            }
            value if value == libc::S_IFDIR as u32 => {
                let source_directory = open_file_at_directory(source_fd, &name)?;
                let destination_directory = create_staging_directory(destination_fd, &name)?;
                copy_tree_from_fd(
                    source_directory.as_raw_fd(),
                    destination_directory.as_raw_fd(),
                    destination_root_fd,
                    &relative_path,
                    hardlinks,
                    cancel,
                )?;
                let metadata = source_directory.metadata().map_err(AtomicMoveError::Io)?;
                copy_fd_metadata(&metadata, &destination_directory)?;
                copy_metadata_with_native_api(&source_directory, &destination_directory)?;
                destination_directory
                    .sync_all()
                    .map_err(AtomicMoveError::Io)?;
            }
            value if value == libc::S_IFREG as u32 => {
                let key = (source_identity.dev, source_identity.ino);
                if source_identity.nlink > 1 {
                    if let Some(first_path) = hardlinks.get(&key) {
                        linkat(destination_root_fd, first_path, destination_fd, &name)?;
                    } else {
                        let source_file = open_file_at(source_fd, &name)?;
                        let destination_file = create_staging_file(destination_fd, &name)?;
                        copy_file_contents_and_metadata(&source_file, &destination_file, cancel)?;
                        let metadata = source_file.metadata().map_err(AtomicMoveError::Io)?;
                        copy_fd_metadata(&metadata, &destination_file)?;
                        destination_file.sync_all().map_err(AtomicMoveError::Io)?;
                        hardlinks.insert(key, relative_path.clone());
                    }
                } else {
                    let source_file = open_file_at(source_fd, &name)?;
                    let destination_file = create_staging_file(destination_fd, &name)?;
                    copy_file_contents_and_metadata(&source_file, &destination_file, cancel)?;
                    let metadata = source_file.metadata().map_err(AtomicMoveError::Io)?;
                    copy_fd_metadata(&metadata, &destination_file)?;
                    destination_file.sync_all().map_err(AtomicMoveError::Io)?;
                }
            }
            _ => return Err(AtomicMoveError::UnsafePath),
        }

        let current_identity =
            crate::platform::macos::identity::MacPhysicalIdentity::from_at(source_fd, &name)
                .map_err(AtomicMoveError::Io)?;
        if !source_identity.matches(current_identity) {
            return Err(AtomicMoveError::StagingIdentityChanged);
        }
    }
    Ok(())
}

fn linkat(
    source_root_fd: RawFd,
    source_path: &Path,
    destination_fd: RawFd,
    destination_name: &OsStr,
) -> Result<(), AtomicMoveError> {
    let source_path = CString::new(source_path.as_os_str().as_bytes())
        .map_err(|_| AtomicMoveError::UnsafePath)?;
    let destination_name =
        CString::new(destination_name.as_bytes()).map_err(|_| AtomicMoveError::UnsafePath)?;
    if unsafe {
        libc::linkat(
            source_root_fd,
            source_path.as_ptr(),
            destination_fd,
            destination_name.as_ptr(),
            0,
        )
    } == 0
    {
        Ok(())
    } else {
        let error = io::Error::last_os_error();
        if matches!(
            error.raw_os_error(),
            Some(libc::EXDEV | libc::ENOTSUP | libc::EPERM)
        ) {
            Err(AtomicMoveError::MetadataPreservationUnsupported(
                "hardlink_topology_unavailable",
            ))
        } else {
            Err(AtomicMoveError::Io(error))
        }
    }
}

fn readlink_at(parent_fd: RawFd, name: &OsStr) -> Result<PathBuf, AtomicMoveError> {
    use std::os::unix::ffi::OsStringExt;

    let name = CString::new(name.as_bytes()).map_err(|_| AtomicMoveError::UnsafePath)?;
    let mut buffer = vec![0_u8; 1024];
    loop {
        let length = unsafe {
            libc::readlinkat(
                parent_fd,
                name.as_ptr(),
                buffer.as_mut_ptr().cast(),
                buffer.len(),
            )
        };
        if length < 0 {
            return Err(AtomicMoveError::Io(io::Error::last_os_error()));
        }
        let length = length as usize;
        if length < buffer.len() {
            buffer.truncate(length);
            return Ok(PathBuf::from(std::ffi::OsString::from_vec(buffer)));
        }
        if buffer.len() >= 1024 * 1024 {
            return Err(AtomicMoveError::UnsafePath);
        }
        buffer.resize(buffer.len() * 2, 0);
    }
}

fn directory_entry_names(parent_fd: RawFd) -> Result<Vec<OsString>, AtomicMoveError> {
    use std::os::unix::ffi::OsStringExt;

    let scan_fd = unsafe { libc::dup(parent_fd) };
    if scan_fd < 0 {
        return Err(AtomicMoveError::Io(io::Error::last_os_error()));
    }
    let directory = unsafe { libc::fdopendir(scan_fd) };
    if directory.is_null() {
        unsafe { libc::close(scan_fd) };
        return Err(AtomicMoveError::Io(io::Error::last_os_error()));
    }
    let mut names = Vec::new();
    loop {
        let entry = unsafe { libc::readdir(directory) };
        if entry.is_null() {
            break;
        }
        let raw_name = unsafe { std::ffi::CStr::from_ptr((*entry).d_name.as_ptr()) }.to_bytes();
        if raw_name == b"." || raw_name == b".." {
            continue;
        }
        names.push(OsString::from_vec(raw_name.to_vec()));
    }
    unsafe { libc::closedir(directory) };
    Ok(names)
}

fn copy_fd_metadata(metadata: &fs::Metadata, destination: &File) -> Result<(), AtomicMoveError> {
    use std::os::unix::fs::MetadataExt;

    unsafe {
        let current = destination.metadata().map_err(AtomicMoveError::Io)?;
        if current.uid() != metadata.uid() || current.gid() != metadata.gid() {
            if libc::fchown(
                destination.as_raw_fd(),
                metadata.uid() as libc::uid_t,
                metadata.gid() as libc::gid_t,
            ) != 0
            {
                return Err(AtomicMoveError::MetadataPreservationUnsupported(
                    "uid_gid_unavailable",
                ));
            }
        }
        if libc::fchmod(
            destination.as_raw_fd(),
            (metadata.mode() & 0o7777) as libc::mode_t,
        ) != 0
        {
            return Err(AtomicMoveError::Io(io::Error::last_os_error()));
        }
        let times = [
            libc::timespec {
                tv_sec: metadata.atime(),
                tv_nsec: metadata.atime_nsec(),
            },
            libc::timespec {
                tv_sec: metadata.mtime(),
                tv_nsec: metadata.mtime_nsec(),
            },
        ];
        if libc::futimens(destination.as_raw_fd(), times.as_ptr()) != 0 {
            return Err(AtomicMoveError::Io(io::Error::last_os_error()));
        }
    }
    Ok(())
}

fn verify_basic_metadata(source: &File, destination: &File) -> Result<(), AtomicMoveError> {
    use std::os::unix::fs::MetadataExt;

    let source = source.metadata().map_err(AtomicMoveError::Io)?;
    let destination = destination.metadata().map_err(AtomicMoveError::Io)?;
    if source.mode() & 0o7777 != destination.mode() & 0o7777
        || source.uid() != destination.uid()
        || source.gid() != destination.gid()
        || source.mtime() != destination.mtime()
        || source.mtime_nsec() != destination.mtime_nsec()
    {
        return Err(AtomicMoveError::MetadataPreservationUnsupported(
            "native_clone_metadata_mismatch",
        ));
    }
    Ok(())
}

fn symlink_at(target: &Path, parent_fd: RawFd, name: &OsStr) -> Result<(), AtomicMoveError> {
    let target =
        CString::new(target.as_os_str().as_bytes()).map_err(|_| AtomicMoveError::UnsafePath)?;
    let name = CString::new(name.as_bytes()).map_err(|_| AtomicMoveError::UnsafePath)?;
    if unsafe { libc::symlinkat(target.as_ptr(), parent_fd, name.as_ptr()) } == 0 {
        Ok(())
    } else {
        Err(AtomicMoveError::Io(io::Error::last_os_error()))
    }
}

fn rename_noreplace(
    source_parent_fd: RawFd,
    source_name: &OsStr,
    target_parent_fd: RawFd,
    target_name: &OsStr,
) -> Result<(), AtomicMoveError> {
    let source_name =
        CString::new(source_name.as_bytes()).map_err(|_| AtomicMoveError::UnsafePath)?;
    let target_name =
        CString::new(target_name.as_bytes()).map_err(|_| AtomicMoveError::UnsafePath)?;
    const RENAME_EXCL: u32 = 0x0000_0004;
    if unsafe {
        renameatx_np(
            source_parent_fd,
            source_name.as_ptr(),
            target_parent_fd,
            target_name.as_ptr(),
            RENAME_EXCL,
        )
    } == 0
    {
        Ok(())
    } else {
        let error = io::Error::last_os_error();
        match error.raw_os_error() {
            Some(libc::EEXIST) => Err(AtomicMoveError::TargetExists),
            Some(libc::EINVAL | libc::ENOTSUP | libc::ENOSYS) => {
                Err(AtomicMoveError::AtomicSourceBindingUnsupported)
            }
            _ => Err(AtomicMoveError::Io(error)),
        }
    }
}

/// Publishes a completed staging object without replacing an unexpected
/// destination. APFS uses `renameatx_np(RENAME_EXCL)`. Filesystems that do
/// not implement that flag use an exclusive-create fallback: regular files
/// prefer a hard-link publication, while directories are created exclusively
/// and populated from the verified staging descriptor.
fn publish_staging_exclusive(
    parent_fd: RawFd,
    staging_name: &OsStr,
    target_name: &OsStr,
    kind: ClaimedEntryKind,
    staging_physical: crate::platform::macos::identity::MacPhysicalIdentity,
    cancel: Option<&AtomicBool>,
) -> Result<(), AtomicMoveError> {
    ensure_staging_identity(parent_fd, staging_name, staging_physical)?;
    match rename_noreplace(parent_fd, staging_name, parent_fd, target_name) {
        Ok(()) => {
            let published = crate::platform::macos::identity::MacPhysicalIdentity::from_at(
                parent_fd,
                target_name,
            )
            .map_err(|_| AtomicMoveError::TargetCommittedIdentityMismatch)?;
            if !staging_physical.matches(published) {
                return Err(AtomicMoveError::TargetCommittedIdentityMismatch);
            }
            Ok(())
        }
        Err(AtomicMoveError::AtomicSourceBindingUnsupported) => match kind {
            ClaimedEntryKind::File => publish_file_exclusive(
                parent_fd,
                staging_name,
                target_name,
                staging_physical,
                cancel,
            ),
            ClaimedEntryKind::Directory => publish_directory_exclusive(
                parent_fd,
                staging_name,
                target_name,
                staging_physical,
                cancel,
            ),
            ClaimedEntryKind::Symlink => {
                publish_symlink_exclusive(parent_fd, staging_name, target_name, staging_physical)
            }
        },
        Err(error) => Err(error),
    }
}

fn publish_file_exclusive(
    parent_fd: RawFd,
    staging_name: &OsStr,
    target_name: &OsStr,
    staging_physical: crate::platform::macos::identity::MacPhysicalIdentity,
    cancel: Option<&AtomicBool>,
) -> Result<(), AtomicMoveError> {
    match link_staging_exclusive(parent_fd, staging_name, target_name, staging_physical)? {
        true => remove_staging_file(parent_fd, staging_name, staging_physical),
        false => {
            ensure_staging_identity(parent_fd, staging_name, staging_physical)?;
            let source = open_file_at(parent_fd, staging_name)?;
            let source_physical =
                crate::platform::macos::identity::MacPhysicalIdentity::from_fd(&source)
                    .map_err(|_| AtomicMoveError::StagingIdentityChanged)?;
            if !staging_physical.matches(source_physical) {
                return Err(AtomicMoveError::StagingIdentityChanged);
            }
            let destination = create_staging_file(parent_fd, target_name)?;
            copy_file_contents_and_metadata(&source, &destination, cancel)
                .map_err(|_| AtomicMoveError::TargetCommittedIdentityMismatch)?;
            destination
                .sync_all()
                .map_err(|_| AtomicMoveError::TargetCommittedIdentityMismatch)?;
            verify_basic_metadata(&source, &destination)
                .map_err(|_| AtomicMoveError::TargetCommittedIdentityMismatch)?;
            remove_staging_file(parent_fd, staging_name, staging_physical)
        }
    }
}

fn publish_directory_exclusive(
    parent_fd: RawFd,
    staging_name: &OsStr,
    target_name: &OsStr,
    staging_physical: crate::platform::macos::identity::MacPhysicalIdentity,
    cancel: Option<&AtomicBool>,
) -> Result<(), AtomicMoveError> {
    ensure_staging_identity(parent_fd, staging_name, staging_physical)?;
    let source = open_file_at_directory(parent_fd, staging_name)?;
    let source_physical = crate::platform::macos::identity::MacPhysicalIdentity::from_fd(&source)
        .map_err(|_| AtomicMoveError::StagingIdentityChanged)?;
    if !staging_physical.matches(source_physical) {
        return Err(AtomicMoveError::StagingIdentityChanged);
    }
    let destination = create_staging_directory(parent_fd, target_name)?;
    let mut hardlinks = HashMap::new();
    if copy_tree_from_fd(
        source.as_raw_fd(),
        destination.as_raw_fd(),
        destination.as_raw_fd(),
        Path::new(""),
        &mut hardlinks,
        cancel,
    )
    .is_err()
    {
        return Err(AtomicMoveError::TargetCommittedIdentityMismatch);
    }
    let metadata = source
        .metadata()
        .map_err(|_| AtomicMoveError::TargetCommittedIdentityMismatch)?;
    copy_fd_metadata(&metadata, &destination)
        .map_err(|_| AtomicMoveError::TargetCommittedIdentityMismatch)?;
    destination
        .sync_all()
        .map_err(|_| AtomicMoveError::TargetCommittedIdentityMismatch)?;
    remove_staging_tree(parent_fd, staging_name, staging_physical)
}

fn publish_symlink_exclusive(
    parent_fd: RawFd,
    staging_name: &OsStr,
    target_name: &OsStr,
    staging_physical: crate::platform::macos::identity::MacPhysicalIdentity,
) -> Result<(), AtomicMoveError> {
    match link_staging_exclusive(parent_fd, staging_name, target_name, staging_physical)? {
        true => remove_staging_file(parent_fd, staging_name, staging_physical),
        false => Err(AtomicMoveError::AtomicSourceBindingUnsupported),
    }
}

fn link_staging_exclusive(
    parent_fd: RawFd,
    staging_name: &OsStr,
    target_name: &OsStr,
    expected: crate::platform::macos::identity::MacPhysicalIdentity,
) -> Result<bool, AtomicMoveError> {
    ensure_staging_identity(parent_fd, staging_name, expected)?;
    let staging_name =
        CString::new(staging_name.as_bytes()).map_err(|_| AtomicMoveError::UnsafePath)?;
    let target_name_c =
        CString::new(target_name.as_bytes()).map_err(|_| AtomicMoveError::UnsafePath)?;
    if unsafe {
        libc::linkat(
            parent_fd,
            staging_name.as_ptr(),
            parent_fd,
            target_name_c.as_ptr(),
            0,
        )
    } == 0
    {
        let published =
            crate::platform::macos::identity::MacPhysicalIdentity::from_at(parent_fd, target_name)
                .map_err(|_| AtomicMoveError::TargetCommittedIdentityMismatch)?;
        if !expected.matches(published) {
            return Err(AtomicMoveError::TargetCommittedIdentityMismatch);
        }
        return Ok(true);
    }
    let error = io::Error::last_os_error();
    match error.raw_os_error() {
        Some(libc::EEXIST) => Err(AtomicMoveError::TargetExists),
        Some(libc::EXDEV | libc::ENOTSUP | libc::EPERM) => Ok(false),
        _ => Err(AtomicMoveError::Io(error)),
    }
}

fn ensure_staging_identity(
    parent_fd: RawFd,
    name: &OsStr,
    expected: crate::platform::macos::identity::MacPhysicalIdentity,
) -> Result<(), AtomicMoveError> {
    let actual = crate::platform::macos::identity::MacPhysicalIdentity::from_at(parent_fd, name)
        .map_err(|_| AtomicMoveError::StagingIdentityChanged)?;
    if !expected.matches(actual) {
        return Err(AtomicMoveError::StagingIdentityChanged);
    }
    Ok(())
}

fn remove_staging_file(
    parent_fd: RawFd,
    name: &OsStr,
    expected: crate::platform::macos::identity::MacPhysicalIdentity,
) -> Result<(), AtomicMoveError> {
    ensure_staging_identity(parent_fd, name, expected)?;
    let name = CString::new(name.as_bytes()).map_err(|_| AtomicMoveError::UnsafePath)?;
    if unsafe { libc::unlinkat(parent_fd, name.as_ptr(), 0) } == 0 {
        Ok(())
    } else {
        Err(AtomicMoveError::TargetCommittedSourceCleanupPending)
    }
}

fn remove_staging_tree(
    parent_fd: RawFd,
    name: &OsStr,
    expected: crate::platform::macos::identity::MacPhysicalIdentity,
) -> Result<(), AtomicMoveError> {
    ensure_staging_identity(parent_fd, name, expected)?;
    let name_c = CString::new(name.as_bytes()).map_err(|_| AtomicMoveError::UnsafePath)?;
    if expected.file_type == libc::S_IFDIR as u32 {
        let directory = open_directory_at(parent_fd, name_c.as_c_str())?;
        for child in directory_entry_names(directory.as_raw_fd())? {
            let child_expected = crate::platform::macos::identity::MacPhysicalIdentity::from_at(
                directory.as_raw_fd(),
                &child,
            )
            .map_err(AtomicMoveError::Io)?;
            remove_staging_tree(directory.as_raw_fd(), &child, child_expected)?;
        }
        ensure_staging_identity(parent_fd, name, expected)?;
        if unsafe { libc::unlinkat(parent_fd, name_c.as_ptr(), libc::AT_REMOVEDIR) } != 0 {
            return Err(AtomicMoveError::TargetCommittedSourceCleanupPending);
        }
        Ok(())
    } else {
        remove_staging_file(parent_fd, name, expected)
    }
}

fn cleanup_staging_at(parent_fd: RawFd, name: &OsStr) {
    let Ok(expected) =
        crate::platform::macos::identity::MacPhysicalIdentity::from_at(parent_fd, name)
    else {
        return;
    };
    let _ = remove_staging_tree(parent_fd, name, expected);
}

fn rollback_before_publish(
    claim: &mut SourceClaim,
    error: AtomicMoveError,
) -> Result<(), AtomicMoveError> {
    match claim.rollback_to_original() {
        Ok(()) => Err(error),
        Err(rollback) => Err(AtomicMoveError::SourceClaimRollbackFailed(
            rollback.to_string(),
        )),
    }
}

fn rollback_claim_error(claim: &mut SourceClaim, error: AtomicMoveError) -> AtomicMoveError {
    match claim.rollback_to_original() {
        Ok(()) => error,
        Err(rollback) => AtomicMoveError::SourceClaimRollbackFailed(rollback.to_string()),
    }
}

fn map_claim_error(error: crate::fs_safety::SourceClaimError) -> AtomicMoveError {
    crate::fs_safety::atomic_move::map_claim_error(error)
}

fn map_create_error(error: io::Error) -> AtomicMoveError {
    if error.kind() == io::ErrorKind::AlreadyExists {
        AtomicMoveError::TargetExists
    } else {
        AtomicMoveError::Io(error)
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

fn is_cancelled(cancel: Option<&AtomicBool>) -> bool {
    cancel.is_some_and(|flag| flag.load(Ordering::Acquire))
}

extern "C" {
    fn fclonefileat(
        srcfd: libc::c_int,
        dst_dir: libc::c_int,
        dst: *const libc::c_char,
        flags: libc::c_uint,
    ) -> libc::c_int;
    fn fcopyfile(
        from_fd: libc::c_int,
        to_fd: libc::c_int,
        state: *mut libc::c_void,
        flags: libc::c_uint,
    ) -> libc::c_int;
    fn renameatx_np(
        fromfd: libc::c_int,
        from: *const libc::c_char,
        tofd: libc::c_int,
        to: *const libc::c_char,
        flags: libc::c_uint,
    ) -> libc::c_int;
}
