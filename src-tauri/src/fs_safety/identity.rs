use std::{
    fs::{self, File},
    io::{self, Read, Seek, SeekFrom},
    path::Path,
    sync::atomic::{AtomicBool, Ordering as AtomicOrdering},
    time::UNIX_EPOCH,
};
use thiserror::Error;

const SAMPLE_SIZE: u64 = 1024 * 1024;
const HASH_BUFFER_SIZE: usize = 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct ExpectedFileIdentity {
    pub size: u64,
    pub modified_ns: Option<i128>,
    pub platform_volume_id: Option<String>,
    pub platform_file_id: Option<String>,
    pub sample_hash: Option<String>,
    pub full_hash: Option<String>,
}

#[derive(Debug, Error)]
pub enum IdentityError {
    #[error("source_missing")]
    SourceMissing,
    #[error("symlink_or_reparse_point")]
    Symlink,
    #[error("unsupported_file_type")]
    UnsupportedFileType,
    #[error("identity_cancelled")]
    Cancelled,
    #[error("io: {0}")]
    Io(#[from] io::Error),
}

pub fn capture_identity(
    path: &Path,
    cancel: Option<&AtomicBool>,
) -> Result<ExpectedFileIdentity, IdentityError> {
    ensure_supported_entry(path)?;
    if is_cancelled(cancel) {
        return Err(IdentityError::Cancelled);
    }
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        if error.kind() == io::ErrorKind::NotFound {
            IdentityError::SourceMissing
        } else {
            IdentityError::Io(error)
        }
    })?;
    let (size, sample_hash, full_hash) = if metadata.is_file() {
        hash_file(path, metadata.len(), cancel)?
    } else if metadata.is_dir() {
        hash_directory(path, cancel)?
    } else {
        return Err(IdentityError::UnsupportedFileType);
    };
    Ok(ExpectedFileIdentity {
        size,
        modified_ns: modified_ns(&metadata),
        platform_volume_id: platform_volume_id(path, &metadata),
        platform_file_id: platform_file_id(path, &metadata),
        sample_hash: Some(sample_hash),
        full_hash: Some(full_hash),
    })
}

pub fn identity_matches(expected: &ExpectedFileIdentity, actual: &ExpectedFileIdentity) -> bool {
    let platform_matches = optional_identity_field_matches(
        expected.platform_volume_id.as_deref(),
        actual.platform_volume_id.as_deref(),
    ) && optional_identity_field_matches(
        expected.platform_file_id.as_deref(),
        actual.platform_file_id.as_deref(),
    );
    let content_matches = optional_identity_field_matches(
        expected.sample_hash.as_deref(),
        actual.sample_hash.as_deref(),
    ) && optional_identity_field_matches(
        expected.full_hash.as_deref(),
        actual.full_hash.as_deref(),
    );
    let time_matches = expected
        .modified_ns
        .zip(actual.modified_ns)
        .is_none_or(|(expected, actual)| expected == actual);
    expected.size == actual.size
        && platform_matches
        && content_matches
        && (expected.platform_file_id.is_some() || time_matches)
}

fn optional_identity_field_matches(expected: Option<&str>, actual: Option<&str>) -> bool {
    expected.is_none() || expected == actual
}

pub fn content_identity_matches(
    expected: &ExpectedFileIdentity,
    actual: &ExpectedFileIdentity,
) -> bool {
    expected.size == actual.size
        && expected
            .sample_hash
            .as_deref()
            .is_none_or(|expected| actual.sample_hash.as_deref() == Some(expected))
        && expected
            .full_hash
            .as_deref()
            .is_none_or(|expected| actual.full_hash.as_deref() == Some(expected))
}

pub fn ensure_supported_entry(path: &Path) -> Result<(), IdentityError> {
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        if error.kind() == io::ErrorKind::NotFound {
            IdentityError::SourceMissing
        } else {
            IdentityError::Io(error)
        }
    })?;
    if metadata.file_type().is_symlink() || is_reparse_point(&metadata) {
        return Err(IdentityError::Symlink);
    }
    if !metadata.is_file() && !metadata.is_dir() {
        return Err(IdentityError::UnsupportedFileType);
    }
    Ok(())
}

fn hash_file(
    path: &Path,
    size: u64,
    cancel: Option<&AtomicBool>,
) -> Result<(u64, String, String), IdentityError> {
    let mut file = File::open(path)?;
    let mut full_hasher = blake3::Hasher::new();
    full_hasher.update(b"file\0");
    full_hasher.update(&size.to_le_bytes());
    let mut first = Vec::with_capacity(SAMPLE_SIZE.min(size) as usize);
    let mut small = if size <= SAMPLE_SIZE * 2 {
        Some(Vec::with_capacity(size as usize))
    } else {
        None
    };
    let mut buffer = vec![0_u8; HASH_BUFFER_SIZE];
    loop {
        if is_cancelled(cancel) {
            return Err(IdentityError::Cancelled);
        }
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        let chunk = &buffer[..read];
        full_hasher.update(chunk);
        if first.len() < SAMPLE_SIZE as usize {
            let take = (SAMPLE_SIZE as usize - first.len()).min(read);
            first.extend_from_slice(&chunk[..take]);
        }
        if let Some(small) = small.as_mut() {
            small.extend_from_slice(chunk);
        }
    }
    let mut sample_hasher = blake3::Hasher::new();
    sample_hasher.update(b"sample-file\0");
    sample_hasher.update(&size.to_le_bytes());
    if let Some(small) = small {
        sample_hasher.update(&small);
    } else {
        sample_hasher.update(&first);
        file.seek(SeekFrom::End(-(SAMPLE_SIZE as i64)))?;
        let mut last = vec![0_u8; SAMPLE_SIZE as usize];
        file.read_exact(&mut last)?;
        sample_hasher.update(&last);
    }
    Ok((
        size,
        sample_hasher.finalize().to_hex().to_string(),
        full_hasher.finalize().to_hex().to_string(),
    ))
}

fn hash_directory(
    path: &Path,
    cancel: Option<&AtomicBool>,
) -> Result<(u64, String, String), IdentityError> {
    let mut entries = fs::read_dir(path)?.collect::<Result<Vec<_>, _>>()?;
    entries.sort_by(|left, right| {
        left.file_name()
            .cmp(&right.file_name())
            .then_with(|| left.path().cmp(&right.path()))
    });
    let mut size = 0_u64;
    let mut sample_hasher = blake3::Hasher::new();
    let mut full_hasher = blake3::Hasher::new();
    sample_hasher.update(b"directory\0");
    full_hasher.update(b"directory\0");
    for entry in entries {
        if is_cancelled(cancel) {
            return Err(IdentityError::Cancelled);
        }
        let name = entry.file_name();
        let child_path = entry.path();
        let child = capture_identity(&child_path, cancel)?;
        let kind = if fs::symlink_metadata(&child_path)?.is_dir() {
            b"dir\0".as_slice()
        } else {
            b"file\0".as_slice()
        };
        let name_bytes = name.to_string_lossy();
        size = size.saturating_add(child.size);
        for hasher in [&mut sample_hasher, &mut full_hasher] {
            hasher.update(name_bytes.as_bytes());
            hasher.update(&[0]);
            hasher.update(kind);
            hasher.update(&child.size.to_le_bytes());
        }
        sample_hasher.update(child.sample_hash.as_deref().unwrap_or_default().as_bytes());
        full_hasher.update(child.full_hash.as_deref().unwrap_or_default().as_bytes());
    }
    Ok((
        size,
        sample_hasher.finalize().to_hex().to_string(),
        full_hasher.finalize().to_hex().to_string(),
    ))
}

fn modified_ns(metadata: &fs::Metadata) -> Option<i128> {
    metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_nanos() as i128)
}

fn is_cancelled(cancel: Option<&AtomicBool>) -> bool {
    cancel.is_some_and(|flag| flag.load(AtomicOrdering::Acquire))
}

#[cfg(unix)]
fn platform_volume_id(_path: &Path, metadata: &fs::Metadata) -> Option<String> {
    use std::os::unix::fs::MetadataExt;
    Some(metadata.dev().to_string())
}

#[cfg(windows)]
fn platform_volume_id(path: &Path, _metadata: &fs::Metadata) -> Option<String> {
    windows_file_identity(path).map(|(volume, _)| volume)
}

#[cfg(not(any(unix, windows)))]
fn platform_volume_id(_path: &Path, _metadata: &fs::Metadata) -> Option<String> {
    None
}

#[cfg(unix)]
fn platform_file_id(_path: &Path, metadata: &fs::Metadata) -> Option<String> {
    use std::os::unix::fs::MetadataExt;
    Some(metadata.ino().to_string())
}

#[cfg(windows)]
fn platform_file_id(path: &Path, _metadata: &fs::Metadata) -> Option<String> {
    windows_file_identity(path).map(|(_, file)| file)
}

#[cfg(not(any(unix, windows)))]
fn platform_file_id(_path: &Path, _metadata: &fs::Metadata) -> Option<String> {
    None
}

#[cfg(windows)]
fn windows_file_identity(path: &Path) -> Option<(String, String)> {
    use std::fs::OpenOptions;
    use std::os::windows::{fs::OpenOptionsExt, io::AsRawHandle};
    use windows_sys::Win32::Storage::FileSystem::{
        GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION, FILE_FLAG_BACKUP_SEMANTICS,
        FILE_FLAG_OPEN_REPARSE_POINT,
    };
    let file = OpenOptions::new()
        .read(true)
        .custom_flags(FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT)
        .open(path)
        .ok()?;
    let mut info = unsafe { std::mem::zeroed::<BY_HANDLE_FILE_INFORMATION>() };
    let success = unsafe { GetFileInformationByHandle(file.as_raw_handle(), &mut info) };
    if success == 0 {
        return None;
    }
    let file_index = (u64::from(info.nFileIndexHigh) << 32) | u64::from(info.nFileIndexLow);
    Some((
        info.dwVolumeSerialNumber.to_string(),
        file_index.to_string(),
    ))
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::{fs, path::PathBuf, sync::atomic::AtomicBool};

    fn fixture(name: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "zen-canvas-identity-{name}-{}-{}",
            std::process::id(),
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&path).expect("fixture");
        path
    }

    #[test]
    fn full_hash_detects_middle_change_when_sample_hash_matches() {
        let root = fixture("middle-change");
        let path = root.join("large.bin");
        let mut bytes = vec![b'a'; (SAMPLE_SIZE as usize * 3).max(3_000_000)];
        fs::write(&path, &bytes).expect("write");
        let first = capture_identity(&path, None).expect("identity");
        let middle = bytes.len() / 2;
        bytes[middle] = b'b';
        fs::write(&path, &bytes).expect("rewrite");
        let second = capture_identity(&path, None).expect("identity");
        assert_eq!(first.sample_hash, second.sample_hash);
        assert_ne!(first.full_hash, second.full_hash);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn cancellation_is_fail_closed() {
        let root = fixture("cancel");
        let path = root.join("file");
        fs::write(&path, b"fixture").expect("write");
        let cancel = AtomicBool::new(true);
        assert!(matches!(
            capture_identity(&path, Some(&cancel)),
            Err(IdentityError::Cancelled)
        ));
        let _ = fs::remove_dir_all(root);
    }
}
