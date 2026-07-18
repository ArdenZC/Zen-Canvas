use super::{atomic_move, identity, AtomicMoveError};
use std::{
    fs::{self, File, OpenOptions},
    io::{self, Read, Write},
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
};

const COPY_BUFFER_SIZE: usize = 1024 * 1024;

pub(crate) fn copy_commit_move(
    source: &Path,
    target: &Path,
    expected_identity: Option<&identity::ExpectedFileIdentity>,
    cancel: Option<&AtomicBool>,
) -> Result<(), AtomicMoveError> {
    let source_before = identity::capture_identity(source, cancel).map_err(map_identity_error)?;
    if let Some(expected) = expected_identity {
        if !identity::identity_matches(expected, &source_before) {
            return Err(AtomicMoveError::SourceChanged);
        }
    }
    let stage = unique_staging_path(target);
    let result = (|| {
        copy_entry(source, &stage, cancel)?;
        sync_staging(&stage)?;
        let staged_identity =
            identity::capture_identity(&stage, cancel).map_err(map_identity_error)?;
        if !identity::content_identity_matches(&source_before, &staged_identity) {
            return Err(AtomicMoveError::CopyVerificationFailed);
        }
        let current_source =
            identity::capture_identity(source, cancel).map_err(map_identity_error)?;
        if !identity::identity_matches(&source_before, &current_source) {
            return Err(AtomicMoveError::SourceChanged);
        }
        if is_cancelled(cancel) {
            return Err(AtomicMoveError::Cancelled);
        }
        atomic_move::atomic_rename_noreplace(&stage, target)?;
        let committed = identity::capture_identity(target, cancel).map_err(map_identity_error)?;
        if !identity::content_identity_matches(&staged_identity, &committed) {
            return Err(AtomicMoveError::CopyVerificationFailed);
        }
        if let Err(error) = remove_entry(source) {
            return Err(AtomicMoveError::TargetCommittedSourceDeleteFailed(
                error.to_string(),
            ));
        }
        Ok(())
    })();

    if result.is_err() && stage.exists() {
        let _ = remove_entry(&stage);
    }
    result
}

fn copy_entry(
    source: &Path,
    target: &Path,
    cancel: Option<&AtomicBool>,
) -> Result<(), AtomicMoveError> {
    let metadata = fs::symlink_metadata(source).map_err(|error| {
        if error.kind() == io::ErrorKind::NotFound {
            AtomicMoveError::SourceMissing
        } else {
            AtomicMoveError::Io(error)
        }
    })?;
    if metadata.file_type().is_symlink() || is_reparse_point(&metadata) {
        return Err(AtomicMoveError::Symlink);
    }
    if metadata.is_file() {
        copy_file(source, target, cancel)
    } else if metadata.is_dir() {
        fs::create_dir(target).map_err(map_create_error)?;
        let mut entries = fs::read_dir(source)
            .map_err(AtomicMoveError::Io)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(AtomicMoveError::Io)?;
        entries.sort_by_key(|left| left.file_name());
        for entry in entries {
            if is_cancelled(cancel) {
                return Err(AtomicMoveError::Cancelled);
            }
            copy_entry(&entry.path(), &target.join(entry.file_name()), cancel)?;
        }
        sync_directory(target)?;
        Ok(())
    } else {
        Err(AtomicMoveError::UnsafePath)
    }
}

fn copy_file(
    source: &Path,
    target: &Path,
    cancel: Option<&AtomicBool>,
) -> Result<(), AtomicMoveError> {
    let source_size = fs::symlink_metadata(source)
        .map_err(AtomicMoveError::Io)?
        .len();
    let mut reader = File::open(source).map_err(AtomicMoveError::Io)?;
    let mut writer = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(target)
        .map_err(map_create_error)?;
    let mut buffer = vec![0_u8; COPY_BUFFER_SIZE];
    let mut hasher = blake3::Hasher::new();
    hasher.update(b"file\0");
    hasher.update(&source_size.to_le_bytes());
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
        hasher.update(&buffer[..read]);
    }
    writer.sync_all().map_err(AtomicMoveError::Io)?;
    let source_hash = identity::capture_identity(source, cancel)
        .map_err(map_identity_error)?
        .full_hash;
    if source_hash.as_deref() != Some(hasher.finalize().to_hex().as_str()) {
        return Err(AtomicMoveError::SourceChanged);
    }
    Ok(())
}

fn unique_staging_path(target: &Path) -> PathBuf {
    let name = target
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("item");
    target.with_file_name(format!(".{name}.zen-canvas-stage-{}", uuid::Uuid::new_v4()))
}

fn sync_staging(path: &Path) -> Result<(), AtomicMoveError> {
    #[cfg(unix)]
    if path.is_file() {
        File::open(path)
            .and_then(|file| file.sync_all())
            .map_err(AtomicMoveError::Io)?;
    }
    sync_directory(path)
}

fn sync_directory(path: &Path) -> Result<(), AtomicMoveError> {
    #[cfg(unix)]
    {
        File::open(path)
            .and_then(|file| file.sync_all())
            .map_err(AtomicMoveError::Io)?;
    }
    #[cfg(not(unix))]
    {
        let _ = path;
    }
    Ok(())
}

fn remove_entry(path: &Path) -> Result<(), io::Error> {
    let metadata = fs::symlink_metadata(path)?;
    if metadata.file_type().is_symlink() || is_reparse_point(&metadata) {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "reparse point",
        ));
    }
    if metadata.is_dir() {
        fs::remove_dir(path)
    } else {
        fs::remove_file(path)
    }
}

fn is_cancelled(cancel: Option<&AtomicBool>) -> bool {
    cancel.is_some_and(|flag| flag.load(Ordering::Acquire))
}

fn map_identity_error(error: identity::IdentityError) -> AtomicMoveError {
    match error {
        identity::IdentityError::SourceMissing => AtomicMoveError::SourceMissing,
        identity::IdentityError::Symlink => AtomicMoveError::Symlink,
        identity::IdentityError::UnsupportedFileType => AtomicMoveError::UnsafePath,
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

#[cfg(windows)]
fn is_reparse_point(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    use windows_sys::Win32::Storage::FileSystem::FILE_ATTRIBUTE_REPARSE_POINT;
    metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn is_reparse_point(_metadata: &fs::Metadata) -> bool {
    false
}
