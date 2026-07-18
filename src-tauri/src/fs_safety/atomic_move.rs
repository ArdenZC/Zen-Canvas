use super::{copy_commit, identity};
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
    #[error("atomic_noreplace_unsupported")]
    UnsupportedAtomicNoReplace,
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
    if is_cancelled(cancel) {
        return Err(AtomicMoveError::Cancelled);
    }
    identity::ensure_supported_entry(source).map_err(map_identity_error)?;
    if let Some(expected) = expected_identity {
        let actual = identity::capture_identity(source, cancel).map_err(map_identity_error)?;
        if !identity::identity_matches(expected, &actual) {
            return Err(AtomicMoveError::SourceChanged);
        }
    }
    if let Some(parent) = target.parent() {
        if !parent.exists() {
            return Err(AtomicMoveError::Io(io::Error::new(
                io::ErrorKind::NotFound,
                "target parent does not exist",
            )));
        }
    }
    match atomic_rename_noreplace(source, target) {
        Ok(()) => {
            if let Some(expected) = expected_identity {
                let actual =
                    identity::capture_identity(target, cancel).map_err(map_identity_error)?;
                if !identity::identity_matches(expected, &actual) {
                    return Err(AtomicMoveError::CopyVerificationFailed);
                }
            }
            Ok(AtomicMoveOutcome {
                method: AtomicMoveMethod::SameVolumeNoReplace,
            })
        }
        Err(AtomicMoveError::CrossDevice) => {
            copy_commit::copy_commit_move(source, target, expected_identity, cancel)?;
            Ok(AtomicMoveOutcome {
                method: AtomicMoveMethod::CrossVolumeCopyCommit,
            })
        }
        Err(error) => Err(error),
    }
}

pub(crate) fn atomic_rename_noreplace(source: &Path, target: &Path) -> Result<(), AtomicMoveError> {
    #[cfg(windows)]
    {
        return atomic_rename_windows(source, target);
    }

    #[cfg(target_os = "linux")]
    {
        return atomic_rename_linux(source, target);
    }

    #[cfg(target_os = "macos")]
    {
        return atomic_rename_macos(source, target);
    }

    #[cfg(not(any(windows, target_os = "linux", target_os = "macos")))]
    {
        let _ = (source, target);
        Err(AtomicMoveError::UnsupportedAtomicNoReplace)
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

#[cfg(windows)]
fn atomic_rename_windows(source: &Path, target: &Path) -> Result<(), AtomicMoveError> {
    use std::{ffi::OsStr, os::windows::ffi::OsStrExt};
    use windows_sys::Win32::{
        Foundation::{
            GetLastError, ERROR_ALREADY_EXISTS, ERROR_FILE_EXISTS, ERROR_NOT_SAME_DEVICE,
        },
        Storage::FileSystem::MoveFileExW,
    };

    fn wide(path: &Path) -> Vec<u16> {
        let text = path.to_string_lossy().replace('/', "\\");
        let text = if text.starts_with(r"\\?\") {
            text
        } else if text.starts_with(r"\\") {
            format!(r"\\?\UNC\{}", text.trim_start_matches(r"\"))
        } else if text.as_bytes().get(1) == Some(&b':') {
            format!(r"\\?\{text}")
        } else {
            text.to_string()
        };
        OsStr::new(&text)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }

    let source = wide(source);
    let target = wide(target);
    let result = unsafe { MoveFileExW(source.as_ptr(), target.as_ptr(), 0) };
    if result != 0 {
        return Ok(());
    }
    let code = unsafe { GetLastError() };
    match code {
        ERROR_ALREADY_EXISTS | ERROR_FILE_EXISTS => Err(AtomicMoveError::TargetExists),
        ERROR_NOT_SAME_DEVICE => Err(AtomicMoveError::CrossDevice),
        6 | 50 | 120 => Err(AtomicMoveError::UnsupportedAtomicNoReplace),
        code => Err(AtomicMoveError::Io(io::Error::from_raw_os_error(
            code as i32,
        ))),
    }
}

#[cfg(target_os = "linux")]
fn atomic_rename_linux(source: &Path, target: &Path) -> Result<(), AtomicMoveError> {
    use std::ffi::CString;
    let source = CString::new(source.as_os_str().as_encoded_bytes())
        .map_err(|_| AtomicMoveError::UnsafePath)?;
    let target = CString::new(target.as_os_str().as_encoded_bytes())
        .map_err(|_| AtomicMoveError::UnsafePath)?;
    let result = unsafe {
        libc::syscall(
            libc::SYS_renameat2,
            libc::AT_FDCWD,
            source.as_ptr(),
            libc::AT_FDCWD,
            target.as_ptr(),
            1_i32,
        )
    };
    if result == 0 {
        return Ok(());
    }
    map_unix_errno(io::Error::last_os_error())
}

#[cfg(target_os = "macos")]
fn atomic_rename_macos(source: &Path, target: &Path) -> Result<(), AtomicMoveError> {
    use std::ffi::CString;
    let source = CString::new(source.as_os_str().as_encoded_bytes())
        .map_err(|_| AtomicMoveError::UnsafePath)?;
    let target = CString::new(target.as_os_str().as_encoded_bytes())
        .map_err(|_| AtomicMoveError::UnsafePath)?;
    const RENAME_EXCL: libc::c_uint = 0x0002;
    unsafe extern "C" {
        fn renamex_np(
            from: *const libc::c_char,
            to: *const libc::c_char,
            flags: libc::c_uint,
        ) -> libc::c_int;
    }
    let result = unsafe { renamex_np(source.as_ptr(), target.as_ptr(), RENAME_EXCL) };
    if result == 0 {
        return Ok(());
    }
    map_unix_errno(io::Error::last_os_error())
}

#[cfg(any(target_os = "linux", target_os = "macos"))]
fn map_unix_errno(error: io::Error) -> Result<(), AtomicMoveError> {
    match error.raw_os_error() {
        Some(libc::EEXIST) => Err(AtomicMoveError::TargetExists),
        Some(libc::EXDEV) => Err(AtomicMoveError::CrossDevice),
        Some(libc::ENOSYS | libc::EINVAL | libc::ENOTSUP | libc::EOPNOTSUPP) => {
            Err(AtomicMoveError::UnsupportedAtomicNoReplace)
        }
        _ => Err(AtomicMoveError::Io(error)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

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
}
