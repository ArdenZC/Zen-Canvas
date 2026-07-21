use super::{
    identity::{self, ExpectedFileIdentity, IdentityError},
    platform_support,
    verified_directory::VerifiedDirectory,
};
use std::{
    ffi::{OsStr, OsString},
    fs::{self, File},
    io::{self, Seek, SeekFrom},
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
};
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClaimedEntryKind {
    File,
    Directory,
}

#[derive(Debug, Error)]
pub enum SourceClaimError {
    #[error("unsupported_platform_linux")]
    UnsupportedPlatformLinux,
    #[error("macos_file_mutation_source_binding_unsupported")]
    MacosFileMutationSourceBindingUnsupported,
    #[error("source_missing")]
    SourceMissing,
    #[error("source_identity_changed")]
    SourceIdentityChanged,
    #[error("source_claim_failed: {0}")]
    ClaimFailed(String),
    #[error("source_claim_mismatch")]
    ClaimMismatch,
    #[error("source_claim_rollback_failed: {0}")]
    ClaimRollbackFailed(String),
    #[error("source_claim_recovery_required: {0}")]
    RecoveryRequired(String),
    #[error("target_exists")]
    TargetExists,
    #[error("cross_device")]
    CrossDevice,
    #[error("atomic_source_binding_unsupported")]
    AtomicSourceBindingUnsupported,
    #[error("reparse_point")]
    ReparsePoint,
    #[error("unsupported_file_type")]
    UnsupportedFileType,
    #[error("cancelled")]
    Cancelled,
    #[error("io: {0}")]
    Io(#[from] io::Error),
}

pub struct SourceClaim {
    original_path: PathBuf,
    current_path: PathBuf,
    claim_path: PathBuf,
    original_name: OsString,
    current_name: OsString,
    original_parent: VerifiedDirectory,
    current_parent: VerifiedDirectory,
    expected_identity: ExpectedFileIdentity,
    actual_identity: ExpectedFileIdentity,
    kind: ClaimedEntryKind,
    handle: File,
    deleted: bool,
}

impl std::fmt::Debug for SourceClaim {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("SourceClaim")
            .field("original_path", &self.original_path)
            .field("current_path", &self.current_path)
            .field("claim_path", &self.claim_path)
            .field("expected_identity", &self.expected_identity)
            .field("actual_identity", &self.actual_identity)
            .field("kind", &self.kind)
            .field("deleted", &self.deleted)
            .finish_non_exhaustive()
    }
}

impl SourceClaim {
    pub fn original_path(&self) -> &Path {
        &self.original_path
    }

    pub fn current_path(&self) -> &Path {
        &self.current_path
    }

    pub fn claim_path(&self) -> &Path {
        &self.claim_path
    }

    pub fn expected_identity(&self) -> &ExpectedFileIdentity {
        &self.expected_identity
    }

    pub fn actual_identity(&self) -> &ExpectedFileIdentity {
        &self.actual_identity
    }

    pub fn kind(&self) -> ClaimedEntryKind {
        self.kind
    }

    pub fn original_volume_id(&self) -> &str {
        &self.original_parent.identity().volume_id
    }

    pub fn verify_current_identity(
        &self,
        cancel: Option<&AtomicBool>,
    ) -> Result<ExpectedFileIdentity, SourceClaimError> {
        let actual =
            identity::capture_identity_from_handle(&self.handle, self.current_path(), cancel)
                .map_err(map_identity_error)?;
        if !identity::identity_matches(&self.expected_identity, &actual) {
            return Err(SourceClaimError::SourceIdentityChanged);
        }
        Ok(actual)
    }

    pub fn open_read(&self) -> Result<File, SourceClaimError> {
        let mut handle = self.handle.try_clone().map_err(SourceClaimError::Io)?;
        handle
            .seek(SeekFrom::Start(0))
            .map_err(SourceClaimError::Io)?;
        Ok(handle)
    }

    pub fn sync(&self) -> Result<(), SourceClaimError> {
        self.handle.sync_all().map_err(SourceClaimError::Io)
    }

    pub fn sync_current_parent(&self) -> Result<(), SourceClaimError> {
        self.current_parent.sync().map_err(SourceClaimError::Io)
    }

    pub fn sync_original_parent(&self) -> Result<(), SourceClaimError> {
        self.original_parent.sync().map_err(SourceClaimError::Io)
    }

    pub fn current_parent_unchanged(&self) -> Result<(), SourceClaimError> {
        self.current_parent
            .ensure_unchanged()
            .map_err(map_directory_error)
    }

    pub fn commit_to(
        &mut self,
        target_parent: VerifiedDirectory,
        target_name: &OsStr,
    ) -> Result<PathBuf, SourceClaimError> {
        if self.deleted {
            return Err(SourceClaimError::RecoveryRequired(
                "claimed source was already deleted".to_string(),
            ));
        }
        target_parent
            .ensure_unchanged()
            .map_err(map_directory_error)?;
        #[cfg(test)]
        run_claim_test_hook(
            ClaimTestPoint::AfterTargetParentVerifiedBeforeCommit,
            self.current_path(),
            &target_parent.path().join(target_name),
        );
        rename_claim_handle(
            &self.handle,
            &self.current_parent,
            &self.current_name,
            &target_parent,
            target_name,
        )?;
        self.current_name = target_name.to_os_string();
        self.current_parent = target_parent;
        self.current_path = self.current_parent.path().join(&self.current_name);
        Ok(self.current_path.clone())
    }

    pub fn rollback_to_original(&mut self) -> Result<(), SourceClaimError> {
        if self.deleted {
            return Err(SourceClaimError::RecoveryRequired(
                "claimed source was already deleted".to_string(),
            ));
        }
        #[cfg(target_os = "macos")]
        self.ensure_path_identity_for_name_based_operation()?;
        self.original_parent
            .ensure_unchanged()
            .map_err(map_directory_error)?;
        rename_claim_handle(
            &self.handle,
            &self.current_parent,
            &self.current_name,
            &self.original_parent,
            &self.original_name,
        )?;
        self.current_name = self.original_name.clone();
        self.current_parent = reopen_directory(&self.original_parent)?;
        self.current_path = self.original_path.clone();
        Ok(())
    }

    pub fn delete_claim(&mut self) -> Result<(), SourceClaimError> {
        if self.deleted {
            return Ok(());
        }
        #[cfg(target_os = "macos")]
        self.ensure_path_identity_for_name_based_operation()?;
        self.current_parent
            .ensure_unchanged()
            .map_err(map_directory_error)?;
        delete_claim_handle(
            &self.handle,
            &self.current_parent,
            &self.current_name,
            self.kind,
        )?;
        self.deleted = true;
        Ok(())
    }

    pub fn is_deleted(&self) -> bool {
        self.deleted
    }

    #[cfg(target_os = "macos")]
    fn ensure_path_identity_for_name_based_operation(&self) -> Result<(), SourceClaimError> {
        let actual =
            identity::capture_identity(self.current_path(), None).map_err(map_identity_error)?;
        if !identity::identity_matches(&self.actual_identity, &actual) {
            return Err(SourceClaimError::RecoveryRequired(
                "claim path identity changed; manual recovery is required".to_string(),
            ));
        }
        Ok(())
    }
}

pub fn planned_claim_path(source: &Path, _operation_id: &str) -> Result<PathBuf, SourceClaimError> {
    let canonical_source = source.canonicalize().map_err(|error| {
        if error.kind() == io::ErrorKind::NotFound {
            SourceClaimError::SourceMissing
        } else {
            SourceClaimError::Io(error)
        }
    })?;
    let parent = canonical_source
        .parent()
        .ok_or(SourceClaimError::SourceMissing)?;
    let claim_name = format!(".zen-canvas-claim-{}", uuid::Uuid::new_v4());
    Ok(parent.join(claim_name))
}

pub fn claim_source(
    source: &Path,
    expected: &ExpectedFileIdentity,
    operation_id: &str,
    cancel: Option<&AtomicBool>,
) -> Result<SourceClaim, SourceClaimError> {
    let claim_path = planned_claim_path(source, operation_id)?;
    claim_source_at(source, expected, &claim_path, operation_id, cancel)
}

pub fn claim_source_at(
    source: &Path,
    expected: &ExpectedFileIdentity,
    claim_path: &Path,
    _operation_id: &str,
    cancel: Option<&AtomicBool>,
) -> Result<SourceClaim, SourceClaimError> {
    platform_support::ensure_supported_file_mutation().map_err(|error| match error {
        platform_support::PlatformSupportError::LinuxUnsupported => {
            SourceClaimError::UnsupportedPlatformLinux
        }
        platform_support::PlatformSupportError::MacosFileMutationSourceBindingUnsupported => {
            SourceClaimError::MacosFileMutationSourceBindingUnsupported
        }
    })?;
    if is_cancelled(cancel) {
        return Err(SourceClaimError::Cancelled);
    }
    if !source.is_absolute() || !claim_path.is_absolute() {
        return Err(SourceClaimError::ClaimFailed(
            "absolute paths required".to_string(),
        ));
    }
    let source_metadata = fs::symlink_metadata(source).map_err(|error| {
        if error.kind() == io::ErrorKind::NotFound {
            SourceClaimError::SourceMissing
        } else {
            SourceClaimError::Io(error)
        }
    })?;
    if source_metadata.file_type().is_symlink() || is_reparse_point(&source_metadata) {
        return Err(SourceClaimError::ReparsePoint);
    }
    let kind = if source_metadata.is_file() {
        ClaimedEntryKind::File
    } else if source_metadata.is_dir() {
        ClaimedEntryKind::Directory
    } else {
        return Err(SourceClaimError::UnsupportedFileType);
    };
    let original_name = source
        .file_name()
        .ok_or(SourceClaimError::SourceMissing)?
        .to_os_string();
    let parent_path = source.parent().ok_or(SourceClaimError::SourceMissing)?;
    let claim_parent = claim_path
        .parent()
        .ok_or_else(|| SourceClaimError::ClaimFailed("claim path has no parent".to_string()))?;
    let original_parent =
        VerifiedDirectory::open_existing(parent_path).map_err(map_directory_error)?;
    let current_parent =
        VerifiedDirectory::open_existing(claim_parent).map_err(map_directory_error)?;
    if current_parent.identity() != original_parent.identity() {
        return Err(SourceClaimError::ClaimFailed(
            "claim path must resolve to the source parent".to_string(),
        ));
    }
    let handle = open_source_handle(source, kind)?;
    let captured_before = identity::capture_identity_from_handle(&handle, source, cancel)
        .map_err(map_identity_error)?;
    if !identity::identity_matches(expected, &captured_before) {
        return Err(SourceClaimError::SourceIdentityChanged);
    }
    if claim_path.exists() {
        return Err(SourceClaimError::ClaimFailed(
            "claim path already exists".to_string(),
        ));
    }

    rename_claim_handle(
        &handle,
        &original_parent,
        &original_name,
        &current_parent,
        claim_path.file_name().unwrap(),
    )?;
    #[cfg(test)]
    run_claim_test_hook(
        ClaimTestPoint::AfterClaimBeforeIdentityCheck,
        source,
        claim_path,
    );
    let actual = identity::capture_identity_from_handle(&handle, claim_path, cancel)
        .map_err(map_identity_error)?;
    if fs::symlink_metadata(source).is_ok() {
        return Err(SourceClaimError::RecoveryRequired(
            "source path was replaced after the source claim".to_string(),
        ));
    }
    if !identity::identity_matches(expected, &actual)
        || !identity::identity_matches(&captured_before, &actual)
    {
        let mut partial = SourceClaim {
            original_path: source.to_path_buf(),
            current_path: claim_path.to_path_buf(),
            claim_path: claim_path.to_path_buf(),
            original_name: original_name.clone(),
            current_name: claim_path.file_name().unwrap().to_os_string(),
            original_parent,
            current_parent,
            expected_identity: expected.clone(),
            actual_identity: actual,
            kind,
            handle,
            deleted: false,
        };
        return match partial.rollback_to_original() {
            Ok(()) => Err(SourceClaimError::ClaimMismatch),
            Err(error) => Err(SourceClaimError::ClaimRollbackFailed(error.to_string())),
        };
    }

    let claim_name = claim_path.file_name().unwrap().to_os_string();
    Ok(SourceClaim {
        original_path: source.to_path_buf(),
        current_path: claim_path.to_path_buf(),
        claim_path: claim_path.to_path_buf(),
        original_name,
        current_name: claim_name,
        original_parent,
        current_parent,
        expected_identity: expected.clone(),
        actual_identity: actual,
        kind,
        handle,
        deleted: false,
    })
}

#[cfg(windows)]
pub(crate) fn commit_open_handle_noreplace(
    handle: &File,
    source_parent: &VerifiedDirectory,
    source_name: &OsStr,
    target_parent: &VerifiedDirectory,
    target_name: &OsStr,
) -> Result<(), SourceClaimError> {
    rename_claim_handle(
        handle,
        source_parent,
        source_name,
        target_parent,
        target_name,
    )
}

#[cfg(windows)]
pub(crate) fn delete_open_handle(
    handle: &File,
    parent: &VerifiedDirectory,
    name: &OsStr,
    kind: ClaimedEntryKind,
) -> Result<(), SourceClaimError> {
    delete_claim_handle(handle, parent, name, kind)
}

fn reopen_directory(directory: &VerifiedDirectory) -> Result<VerifiedDirectory, SourceClaimError> {
    VerifiedDirectory::open_existing(directory.path()).map_err(map_directory_error)
}

fn map_directory_error(error: super::PathGuardError) -> SourceClaimError {
    match error {
        super::PathGuardError::UnsupportedPlatformLinux => {
            SourceClaimError::UnsupportedPlatformLinux
        }
        super::PathGuardError::MacosFileMutationSourceBindingUnsupported => {
            SourceClaimError::MacosFileMutationSourceBindingUnsupported
        }
        super::PathGuardError::ReparsePoint => SourceClaimError::ReparsePoint,
        super::PathGuardError::IdentityChanged => {
            SourceClaimError::RecoveryRequired("verified directory identity changed".to_string())
        }
        super::PathGuardError::UnsafePath => {
            SourceClaimError::ClaimFailed("unsafe path".to_string())
        }
        super::PathGuardError::Io(error) => SourceClaimError::Io(error),
    }
}

fn map_identity_error(error: IdentityError) -> SourceClaimError {
    match error {
        IdentityError::SourceMissing => SourceClaimError::SourceMissing,
        IdentityError::Symlink => SourceClaimError::ReparsePoint,
        IdentityError::UnsupportedFileType => SourceClaimError::UnsupportedFileType,
        IdentityError::DirectoryManifestNameEncodingFailed => {
            SourceClaimError::ClaimFailed("directory_manifest_name_encoding_failed".to_string())
        }
        IdentityError::Cancelled => SourceClaimError::Cancelled,
        IdentityError::Io(error) => SourceClaimError::Io(error),
    }
}

fn is_cancelled(cancel: Option<&AtomicBool>) -> bool {
    cancel.is_some_and(|flag| flag.load(Ordering::Acquire))
}

#[cfg(windows)]
pub(crate) fn windows_wide_path(path: &Path) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;
    let mut units = path
        .as_os_str()
        .encode_wide()
        .map(|unit| {
            if unit == b'/' as u16 {
                b'\\' as u16
            } else {
                unit
            }
        })
        .collect::<Vec<_>>();
    let slash = b'\\' as u16;
    let extended = [slash, slash, b'?' as u16, slash];
    if units.starts_with(&extended) {
        units.push(0);
        return units;
    }
    if units.starts_with(&[slash, slash]) {
        let mut prefixed = [
            slash,
            slash,
            b'?' as u16,
            slash,
            b'U' as u16,
            b'N' as u16,
            b'C' as u16,
            slash,
        ]
        .to_vec();
        prefixed.extend_from_slice(&units[2..]);
        prefixed.push(0);
        return prefixed;
    }
    if units.get(1) == Some(&(b':' as u16)) {
        let mut prefixed = [slash, slash, b'?' as u16, slash].to_vec();
        prefixed.extend_from_slice(&units);
        prefixed.push(0);
        return prefixed;
    }
    units.push(0);
    units
}

#[cfg(windows)]
fn open_source_handle(path: &Path, kind: ClaimedEntryKind) -> Result<File, SourceClaimError> {
    use std::os::windows::io::{FromRawHandle, OwnedHandle};
    use windows_sys::Win32::{
        Foundation::{GetLastError, INVALID_HANDLE_VALUE},
        Storage::FileSystem::{
            CreateFileW, DELETE, FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT,
            FILE_READ_ATTRIBUTES, FILE_READ_DATA, FILE_SHARE_DELETE, FILE_SHARE_READ,
            FILE_SHARE_WRITE, FILE_WRITE_ATTRIBUTES, FILE_WRITE_DATA, OPEN_EXISTING, SYNCHRONIZE,
        },
    };
    let wide = windows_wide_path(path);
    let flags = FILE_FLAG_OPEN_REPARSE_POINT
        | if matches!(kind, ClaimedEntryKind::Directory) {
            FILE_FLAG_BACKUP_SEMANTICS
        } else {
            0
        };
    let access = DELETE
        | FILE_READ_ATTRIBUTES
        | FILE_READ_DATA
        | FILE_WRITE_ATTRIBUTES
        | FILE_WRITE_DATA
        | SYNCHRONIZE;
    let raw = unsafe {
        CreateFileW(
            wide.as_ptr(),
            access,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            std::ptr::null(),
            OPEN_EXISTING,
            flags,
            std::ptr::null_mut(),
        )
    };
    if raw == INVALID_HANDLE_VALUE {
        let error = unsafe { GetLastError() } as i32;
        return if matches!(error, 1 | 50 | 87 | 120) {
            Err(SourceClaimError::AtomicSourceBindingUnsupported)
        } else {
            Err(SourceClaimError::Io(io::Error::from_raw_os_error(error)))
        };
    }
    Ok(unsafe { File::from(OwnedHandle::from_raw_handle(raw)) })
}

#[cfg(target_os = "macos")]
fn open_source_handle(path: &Path, kind: ClaimedEntryKind) -> Result<File, SourceClaimError> {
    use std::{ffi::CString, os::unix::ffi::OsStrExt, os::unix::io::FromRawFd};
    let name = CString::new(path.as_os_str().as_bytes()).map_err(|_| {
        SourceClaimError::ClaimFailed("source path contains an embedded NUL".to_string())
    })?;
    let flags = libc::O_RDONLY | libc::O_NOFOLLOW | libc::O_CLOEXEC;
    let flags = if matches!(kind, ClaimedEntryKind::Directory) {
        flags | libc::O_DIRECTORY
    } else {
        flags
    };
    let fd = unsafe { libc::open(name.as_ptr(), flags) };
    if fd < 0 {
        return Err(SourceClaimError::Io(io::Error::last_os_error()));
    }
    Ok(unsafe { File::from_raw_fd(fd) })
}

#[cfg(not(any(windows, target_os = "macos")))]
fn open_source_handle(_path: &Path, _kind: ClaimedEntryKind) -> Result<File, SourceClaimError> {
    Err(SourceClaimError::UnsupportedPlatformLinux)
}

fn rename_claim_handle(
    _handle: &File,
    source_parent: &VerifiedDirectory,
    source_name: &OsStr,
    target_parent: &VerifiedDirectory,
    target_name: &OsStr,
) -> Result<(), SourceClaimError> {
    #[cfg(windows)]
    let _ = source_name;

    #[cfg(windows)]
    {
        let _ = source_parent;
        rename_windows(_handle, target_parent, target_name)
    }

    #[cfg(target_os = "macos")]
    {
        rename_macos(source_parent, source_name, target_parent, target_name)
    }

    #[cfg(not(any(windows, target_os = "macos")))]
    {
        let _ = (
            _handle,
            source_parent,
            source_name,
            target_parent,
            target_name,
        );
        Err(SourceClaimError::UnsupportedPlatformLinux)
    }
}

#[cfg(windows)]
fn rename_windows(
    handle: &File,
    target_parent: &VerifiedDirectory,
    target_name: &OsStr,
) -> Result<(), SourceClaimError> {
    use std::os::windows::ffi::OsStrExt;
    use std::{mem, os::windows::io::AsRawHandle, ptr};
    use windows_sys::{
        Wdk::Storage::FileSystem::{
            FileRenameInformation, NtSetInformationFile, FILE_RENAME_INFORMATION,
        },
        Win32::{
            Foundation::{
                RtlNtStatusToDosError, ERROR_ALREADY_EXISTS, ERROR_FILE_EXISTS,
                ERROR_NOT_SAME_DEVICE,
            },
            System::IO::IO_STATUS_BLOCK,
        },
    };
    let name = target_name.encode_wide().collect::<Vec<_>>();
    if name.is_empty() || name.contains(&0) {
        return Err(SourceClaimError::ClaimFailed(
            "empty or invalid target name".to_string(),
        ));
    }
    let total_size = mem::size_of::<FILE_RENAME_INFORMATION>()
        + name.len().saturating_sub(1) * mem::size_of::<u16>();
    let mut buffer = vec![0_u8; total_size];
    let info = buffer.as_mut_ptr() as *mut FILE_RENAME_INFORMATION;
    let mut io_status = unsafe { mem::zeroed::<IO_STATUS_BLOCK>() };
    unsafe {
        (*info).Anonymous.ReplaceIfExists = false;
        (*info).RootDirectory = target_parent.handle().as_raw_handle();
        (*info).FileNameLength = (name.len() * mem::size_of::<u16>()) as u32;
        ptr::copy_nonoverlapping(name.as_ptr(), (*info).FileName.as_mut_ptr(), name.len());
        let status = NtSetInformationFile(
            handle.as_raw_handle(),
            &mut io_status,
            buffer.as_ptr().cast(),
            total_size as u32,
            FileRenameInformation,
        );
        if status >= 0 {
            return Ok(());
        }
        let code = RtlNtStatusToDosError(status);
        match code {
            ERROR_ALREADY_EXISTS | ERROR_FILE_EXISTS => Err(SourceClaimError::TargetExists),
            ERROR_NOT_SAME_DEVICE => Err(SourceClaimError::CrossDevice),
            code => Err(SourceClaimError::Io(io::Error::from_raw_os_error(
                code as i32,
            ))),
        }
    }
}

#[cfg(target_os = "macos")]
fn rename_macos(
    source_parent: &VerifiedDirectory,
    source_name: &OsStr,
    target_parent: &VerifiedDirectory,
    target_name: &OsStr,
) -> Result<(), SourceClaimError> {
    use std::{ffi::CString, os::unix::ffi::OsStrExt, os::unix::io::AsRawFd};
    let from = CString::new(source_name.as_bytes())
        .map_err(|_| SourceClaimError::ClaimFailed("invalid source name".to_string()))?;
    let to = CString::new(target_name.as_bytes())
        .map_err(|_| SourceClaimError::ClaimFailed("invalid target name".to_string()))?;
    unsafe extern "C" {
        fn renameatx_np(
            fromfd: libc::c_int,
            from: *const libc::c_char,
            tofd: libc::c_int,
            to: *const libc::c_char,
            flags: libc::c_uint,
        ) -> libc::c_int;
    }
    let result = unsafe {
        renameatx_np(
            source_parent.handle().as_raw_fd(),
            from.as_ptr(),
            target_parent.handle().as_raw_fd(),
            to.as_ptr(),
            libc::RENAME_EXCL,
        )
    };
    if result == 0 {
        Ok(())
    } else {
        map_macos_errno(io::Error::last_os_error())
    }
}

#[cfg(target_os = "macos")]
fn map_macos_errno(error: io::Error) -> Result<(), SourceClaimError> {
    match error.raw_os_error() {
        Some(libc::EEXIST) => Err(SourceClaimError::TargetExists),
        Some(libc::EXDEV) => Err(SourceClaimError::CrossDevice),
        Some(libc::ENOSYS) => Err(SourceClaimError::AtomicSourceBindingUnsupported),
        Some(libc::EINVAL) => Err(SourceClaimError::AtomicSourceBindingUnsupported),
        Some(libc::ENOTSUP) => Err(SourceClaimError::AtomicSourceBindingUnsupported),
        Some(libc::EOPNOTSUPP) => Err(SourceClaimError::AtomicSourceBindingUnsupported),
        _ => Err(SourceClaimError::Io(error)),
    }
}

#[cfg(windows)]
fn delete_claim_handle(
    handle: &File,
    _parent: &VerifiedDirectory,
    _name: &OsStr,
    _kind: ClaimedEntryKind,
) -> Result<(), SourceClaimError> {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::{
        Foundation::{
            GetLastError, ERROR_CALL_NOT_IMPLEMENTED, ERROR_INVALID_FUNCTION,
            ERROR_INVALID_PARAMETER, ERROR_NOT_SUPPORTED,
        },
        Storage::FileSystem::{
            FileDispositionInfoEx, SetFileInformationByHandle, FILE_DISPOSITION_FLAG_DELETE,
            FILE_DISPOSITION_FLAG_IGNORE_READONLY_ATTRIBUTE, FILE_DISPOSITION_FLAG_POSIX_SEMANTICS,
            FILE_DISPOSITION_INFO_EX,
        },
    };
    let disposition = FILE_DISPOSITION_INFO_EX {
        Flags: FILE_DISPOSITION_FLAG_DELETE
            | FILE_DISPOSITION_FLAG_IGNORE_READONLY_ATTRIBUTE
            | FILE_DISPOSITION_FLAG_POSIX_SEMANTICS,
    };
    if unsafe {
        SetFileInformationByHandle(
            handle.as_raw_handle(),
            FileDispositionInfoEx,
            (&disposition as *const FILE_DISPOSITION_INFO_EX).cast(),
            std::mem::size_of::<FILE_DISPOSITION_INFO_EX>() as u32,
        )
    } != 0
    {
        return Ok(());
    }
    let code = unsafe { GetLastError() };
    if matches!(
        code,
        ERROR_INVALID_FUNCTION
            | ERROR_INVALID_PARAMETER
            | ERROR_NOT_SUPPORTED
            | ERROR_CALL_NOT_IMPLEMENTED
    ) {
        Err(SourceClaimError::AtomicSourceBindingUnsupported)
    } else {
        Err(SourceClaimError::Io(io::Error::from_raw_os_error(
            code as i32,
        )))
    }
}

#[cfg(target_os = "macos")]
fn delete_claim_handle(
    _handle: &File,
    parent: &VerifiedDirectory,
    name: &OsStr,
    kind: ClaimedEntryKind,
) -> Result<(), SourceClaimError> {
    use std::{ffi::CString, os::unix::ffi::OsStrExt, os::unix::io::AsRawFd};
    let name = CString::new(name.as_bytes())
        .map_err(|_| SourceClaimError::ClaimFailed("invalid claim name".to_string()))?;
    let flags = if matches!(kind, ClaimedEntryKind::Directory) {
        libc::AT_REMOVEDIR
    } else {
        0
    };
    let result = unsafe { libc::unlinkat(parent.handle().as_raw_fd(), name.as_ptr(), flags) };
    if result == 0 {
        Ok(())
    } else {
        Err(SourceClaimError::Io(io::Error::last_os_error()))
    }
}

#[cfg(not(any(windows, target_os = "macos")))]
fn delete_claim_handle(
    _handle: &File,
    _parent: &VerifiedDirectory,
    _name: &OsStr,
    _kind: ClaimedEntryKind,
) -> Result<(), SourceClaimError> {
    Err(SourceClaimError::UnsupportedPlatformLinux)
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
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClaimTestPoint {
    AfterJournalPreparedBeforeClaim,
    AfterClaimBeforeIdentityCheck,
    AfterClaimVerifiedBeforeTargetCommit,
    AfterTargetParentVerifiedBeforeCommit,
    AfterStagingVerifiedBeforeCommit,
    AfterTargetCommitBeforeSourceCleanup,
    AfterSourceCleanupBeforeJournalComplete,
}

#[cfg(test)]
pub(crate) use test_hooks::run_claim_test_hook;
#[cfg(all(test, windows))]
pub(crate) use test_hooks::{lock_claim_test_hooks, set_claim_test_hook};

#[cfg(test)]
mod test_hooks {
    use super::ClaimTestPoint;
    #[cfg(windows)]
    use std::sync::{Mutex, MutexGuard, OnceLock};
    use std::{cell::RefCell, path::Path};

    type Hook = fn(ClaimTestPoint, &Path, &Path);
    #[cfg(windows)]
    static CLAIM_TEST_SERIAL: OnceLock<Mutex<()>> = OnceLock::new();
    thread_local! {
        static CLAIM_TEST_HOOK: RefCell<Option<Hook>> = const { RefCell::new(None) };
    }

    #[cfg(windows)]
    pub(crate) fn lock_claim_test_hooks() -> MutexGuard<'static, ()> {
        CLAIM_TEST_SERIAL
            .get_or_init(|| Mutex::new(()))
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    #[cfg(windows)]
    pub(crate) fn set_claim_test_hook(hook: Option<Hook>) {
        CLAIM_TEST_HOOK.with(|current| {
            *current.borrow_mut() = hook;
        });
    }

    pub(crate) fn run_claim_test_hook(point: ClaimTestPoint, source: &Path, claim: &Path) {
        let hook = CLAIM_TEST_HOOK.with(|current| *current.borrow());
        if let Some(hook) = hook {
            hook(point, source, claim);
        }
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use crate::fs_safety::atomic_move::{atomic_move_noreplace, AtomicMoveError};

    fn fixture(name: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "zen-canvas-source-claim-{name}-{}-{}",
            std::process::id(),
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&path).expect("fixture");
        path
    }

    fn replace_source_after_claim(point: ClaimTestPoint, source: &Path, _claim: &Path) {
        if point == ClaimTestPoint::AfterClaimBeforeIdentityCheck {
            fs::write(source, b"replacement").expect("replacement source");
        }
    }

    fn create_source_replacement_before_commit(
        point: ClaimTestPoint,
        source: &Path,
        _claim: &Path,
    ) {
        if point == ClaimTestPoint::AfterClaimVerifiedBeforeTargetCommit {
            fs::write(source, b"new source at original path").expect("replacement source");
        }
    }

    fn create_target_conflict_before_commit(point: ClaimTestPoint, source: &Path, _claim: &Path) {
        if point == ClaimTestPoint::AfterClaimVerifiedBeforeTargetCommit {
            fs::write(
                source.parent().expect("source parent").join("target"),
                b"competitor",
            )
            .expect("competitor target");
        }
    }

    fn replace_target_parent_before_commit(point: ClaimTestPoint, source: &Path, _claim: &Path) {
        if point != ClaimTestPoint::AfterClaimVerifiedBeforeTargetCommit {
            return;
        }
        let root = source
            .parent()
            .and_then(Path::parent)
            .expect("fixture root");
        let target_parent = root.join("target");
        let displaced = root.join("target-displaced");
        fs::rename(&target_parent, &displaced).expect("displace target parent");
        fs::create_dir(&target_parent).expect("replace target parent");
    }

    fn replace_target_parent_after_verification(
        point: ClaimTestPoint,
        _source: &Path,
        target: &Path,
    ) {
        if point != ClaimTestPoint::AfterTargetParentVerifiedBeforeCommit {
            return;
        }
        let parent = target.parent().expect("target parent");
        let displaced = parent.with_file_name("target-verified-displaced");
        fs::rename(parent, &displaced).expect("displace verified target parent");
        fs::create_dir(parent).expect("replacement target parent");
    }

    #[cfg(windows)]
    fn replace_claim_before_identity_check(point: ClaimTestPoint, _source: &Path, claim: &Path) {
        if point == ClaimTestPoint::AfterClaimBeforeIdentityCheck {
            fs::remove_file(claim).expect("remove claim");
            fs::write(claim, b"replacement claim").expect("replacement claim");
        }
    }

    #[test]
    fn source_replacement_after_claim_is_recovery_required_and_keeps_both_objects() {
        let _serial = lock_claim_test_hooks();
        let root = fixture("source-replacement");
        let source = root.join("source.txt");
        fs::write(&source, b"original").expect("source");
        let expected = identity::capture_identity(&source, None).expect("identity");
        let claim_path = planned_claim_path(&source, "replacement").expect("claim path");
        set_claim_test_hook(Some(replace_source_after_claim));
        let result = claim_source_at(&source, &expected, &claim_path, "replacement", None);
        set_claim_test_hook(None);

        assert!(matches!(result, Err(SourceClaimError::RecoveryRequired(_))));
        assert_eq!(
            fs::read(&source).expect("replacement bytes"),
            b"replacement"
        );
        assert_eq!(fs::read(&claim_path).expect("claimed bytes"), b"original");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn original_path_replacement_after_claim_is_not_deleted_by_commit() {
        let _serial = lock_claim_test_hooks();
        let root = fixture("original-path-replacement");
        let source = root.join("source.txt");
        let target = root.join("target.txt");
        fs::write(&source, b"original").expect("source");
        set_claim_test_hook(Some(create_source_replacement_before_commit));
        let result = atomic_move_noreplace(&source, &target, None, None);
        set_claim_test_hook(None);

        assert!(result.is_ok(), "move result: {result:?}");
        assert_eq!(fs::read(&target).expect("target bytes"), b"original");
        assert_eq!(
            fs::read(&source).expect("replacement bytes"),
            b"new source at original path"
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn target_race_returns_target_exists_and_rolls_back_claim() {
        let _serial = lock_claim_test_hooks();
        let root = fixture("target-race");
        let source = root.join("source.txt");
        let target = root.join("target");
        fs::write(&source, b"original").expect("source");
        set_claim_test_hook(Some(create_target_conflict_before_commit));
        let result = atomic_move_noreplace(&source, &target, None, None);
        set_claim_test_hook(None);

        assert!(matches!(result, Err(AtomicMoveError::TargetExists)));
        assert_eq!(fs::read(&source).expect("rolled back source"), b"original");
        assert_eq!(fs::read(&target).expect("competitor target"), b"competitor");
        assert!(!fs::read_dir(&root)
            .expect("root entries")
            .filter_map(Result::ok)
            .any(|entry| entry
                .file_name()
                .to_string_lossy()
                .starts_with(".zen-canvas-claim-")));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn target_parent_replacement_is_rejected_without_redirecting_the_target() {
        let _serial = lock_claim_test_hooks();
        let root = fixture("target-parent-race");
        let source_parent = root.join("source");
        let target_parent = root.join("target");
        fs::create_dir(&source_parent).expect("source parent");
        fs::create_dir(&target_parent).expect("target parent");
        let source = source_parent.join("source.txt");
        let target = target_parent.join("source.txt");
        fs::write(&source, b"original").expect("source");
        set_claim_test_hook(Some(replace_target_parent_before_commit));
        let result = atomic_move_noreplace(&source, &target, None, None);
        set_claim_test_hook(None);

        assert!(result.is_err());
        assert_eq!(
            fs::read(&source).expect("source after rollback"),
            b"original"
        );
        assert!(!target.exists());
        assert!(!root.join("target-displaced").join("source.txt").exists());
        let _ = fs::remove_dir_all(root);
    }

    #[cfg(windows)]
    #[test]
    fn target_parent_replacement_after_verification_cannot_redirect_commit() {
        let _serial = lock_claim_test_hooks();
        let root = fixture("target-parent-after-verified");
        let source_parent = root.join("source");
        let target_parent = root.join("target");
        fs::create_dir(&source_parent).expect("source parent");
        fs::create_dir(&target_parent).expect("target parent");
        let source = source_parent.join("source.txt");
        let target = target_parent.join("source.txt");
        fs::write(&source, b"original").expect("source");
        set_claim_test_hook(Some(replace_target_parent_after_verification));
        let result = atomic_move_noreplace(&source, &target, None, None);
        set_claim_test_hook(None);

        assert!(matches!(
            result,
            Err(AtomicMoveError::TargetCommittedIdentityMismatch)
        ));
        assert!(!target.exists());
        assert_eq!(
            fs::read(root.join("target-verified-displaced").join("source.txt"))
                .expect("bound target"),
            b"original"
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn unicode_and_long_paths_commit_through_bound_handles() {
        let _serial = lock_claim_test_hooks();
        let root = fixture("unicode-long-path");
        let mut parent = root.clone();
        for index in 0..6 {
            parent.push(format!(
                "segment-{index}-abcdefghijklmnopqrstuvwxyz0123456789"
            ));
        }
        crate::fs_safety::create_directory_chain_no_links(&parent).expect("long parent");
        let source = parent.join("源-данные-α.txt");
        let target = parent.join("目标-результат-β.txt");
        fs::write(&source, b"unicode long path").expect("source");
        atomic_move_noreplace(&source, &target, None, None).expect("bound long-path move");
        assert_eq!(fs::read(&target).expect("target"), b"unicode long path");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn unc_paths_are_encoded_with_extended_unc_prefix() {
        let wide = windows_wide_path(Path::new(r"\\server\share\目录\file.txt"));
        let prefix = "\\\\?\\UNC\\".encode_utf16().collect::<Vec<_>>();
        assert!(wide.starts_with(&prefix));
        assert_eq!(wide.last(), Some(&0));
    }

    #[cfg(windows)]
    #[test]
    fn claim_identity_mismatch_does_not_move_replacement_claim_to_original() {
        let _serial = lock_claim_test_hooks();
        let root = fixture("claim-mismatch");
        let source = root.join("source.txt");
        fs::write(&source, b"original").expect("source");
        let expected = identity::capture_identity(&source, None).expect("identity");
        let claim_path = planned_claim_path(&source, "mismatch").expect("claim path");
        set_claim_test_hook(Some(replace_claim_before_identity_check));
        let result = claim_source_at(&source, &expected, &claim_path, "mismatch", None);
        set_claim_test_hook(None);

        assert!(matches!(
            result,
            Err(SourceClaimError::ClaimRollbackFailed(_))
        ));
        assert!(!source.exists());
        assert_eq!(
            fs::read(&claim_path).expect("replacement claim"),
            b"replacement claim"
        );
        let _ = fs::remove_dir_all(root);
    }
}
