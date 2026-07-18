use super::{platform_support, PathGuardError};
use std::{
    fs::File,
    io,
    path::{Path, PathBuf},
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DirectoryIdentity {
    pub volume_id: String,
    pub file_id: String,
}

pub struct VerifiedDirectory {
    path: PathBuf,
    identity: DirectoryIdentity,
    handle: File,
}

impl std::fmt::Debug for VerifiedDirectory {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("VerifiedDirectory")
            .field("path", &self.path)
            .field("identity", &self.identity)
            .finish_non_exhaustive()
    }
}

impl VerifiedDirectory {
    pub fn open_existing(path: &Path) -> Result<Self, PathGuardError> {
        platform_support::ensure_supported_file_mutation()
            .map_err(|_| PathGuardError::UnsupportedPlatformLinux)?;
        if !path.is_absolute() {
            return Err(PathGuardError::UnsafePath);
        }

        #[cfg(windows)]
        {
            open_windows(path)
        }

        #[cfg(target_os = "macos")]
        {
            open_macos(path)
        }

        #[cfg(not(any(windows, target_os = "macos")))]
        {
            let _ = path;
            Err(PathGuardError::UnsupportedPlatformLinux)
        }
    }

    pub fn open_or_create(path: &Path) -> Result<Self, PathGuardError> {
        platform_support::ensure_supported_file_mutation()
            .map_err(|_| PathGuardError::UnsupportedPlatformLinux)?;
        super::path_guard::create_directory_chain_no_links(path)?;
        Self::open_existing(path)
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn identity(&self) -> &DirectoryIdentity {
        &self.identity
    }

    #[cfg(target_os = "macos")]
    pub(crate) fn handle(&self) -> &File {
        &self.handle
    }

    pub fn sync(&self) -> io::Result<()> {
        self.handle.sync_all()
    }

    pub fn ensure_unchanged(&self) -> Result<(), PathGuardError> {
        let current = Self::open_existing(&self.path)?;
        if current.identity != self.identity {
            return Err(PathGuardError::IdentityChanged);
        }
        Ok(())
    }
}

#[cfg(windows)]
fn open_windows(path: &Path) -> Result<VerifiedDirectory, PathGuardError> {
    use std::os::windows::io::{FromRawHandle, OwnedHandle};
    use windows_sys::Win32::{
        Foundation::{GetLastError, INVALID_HANDLE_VALUE},
        Storage::FileSystem::{
            CreateFileW, GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION, FILE_ADD_FILE,
            FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT, FILE_LIST_DIRECTORY,
            FILE_READ_ATTRIBUTES, FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE,
            FILE_WRITE_ATTRIBUTES, OPEN_EXISTING, SYNCHRONIZE,
        },
    };

    let wide = super::source_claim::windows_wide_path(path);
    let raw = unsafe {
        CreateFileW(
            wide.as_ptr(),
            FILE_LIST_DIRECTORY
                | FILE_ADD_FILE
                | FILE_READ_ATTRIBUTES
                | FILE_WRITE_ATTRIBUTES
                | SYNCHRONIZE,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            std::ptr::null(),
            OPEN_EXISTING,
            FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT,
            std::ptr::null_mut(),
        )
    };
    if raw == INVALID_HANDLE_VALUE {
        return Err(PathGuardError::Io(io::Error::from_raw_os_error(
            unsafe { GetLastError() } as i32,
        )));
    }
    let handle = unsafe { File::from(OwnedHandle::from_raw_handle(raw)) };
    let mut info = unsafe { std::mem::zeroed::<BY_HANDLE_FILE_INFORMATION>() };
    if unsafe { GetFileInformationByHandle(handle.as_raw_handle(), &mut info) } == 0 {
        return Err(PathGuardError::Io(io::Error::last_os_error()));
    }
    if info.dwFileAttributes & windows_sys::Win32::Storage::FileSystem::FILE_ATTRIBUTE_REPARSE_POINT
        != 0
    {
        return Err(PathGuardError::ReparsePoint);
    }
    let file_id =
        (u64::from(info.nFileIndexHigh) << 32 | u64::from(info.nFileIndexLow)).to_string();
    Ok(VerifiedDirectory {
        path: path.to_path_buf(),
        identity: DirectoryIdentity {
            volume_id: info.dwVolumeSerialNumber.to_string(),
            file_id,
        },
        handle,
    })
}

#[cfg(windows)]
use std::os::windows::io::AsRawHandle;

#[cfg(target_os = "macos")]
fn open_macos(path: &Path) -> Result<VerifiedDirectory, PathGuardError> {
    use std::{ffi::CString, os::unix::ffi::OsStrExt, os::unix::io::FromRawFd};

    let resolved = super::path_guard::prepare_macos_path(path)?;
    let name =
        CString::new(resolved.as_os_str().as_bytes()).map_err(|_| PathGuardError::UnsafePath)?;
    let fd = unsafe {
        libc::open(
            name.as_ptr(),
            libc::O_RDONLY | libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC,
        )
    };
    if fd < 0 {
        return Err(PathGuardError::Io(io::Error::last_os_error()));
    }
    let handle = unsafe { File::from_raw_fd(fd) };
    let identity = macos_directory_identity(&handle)?;
    Ok(VerifiedDirectory {
        path: resolved,
        identity,
        handle,
    })
}

#[cfg(target_os = "macos")]
fn macos_directory_identity(handle: &File) -> Result<DirectoryIdentity, PathGuardError> {
    use std::os::unix::io::AsRawFd;
    let mut stat = unsafe { std::mem::zeroed::<libc::stat>() };
    if unsafe { libc::fstat(handle.as_raw_fd(), &mut stat) } != 0 {
        return Err(PathGuardError::Io(io::Error::last_os_error()));
    }
    if stat.st_mode & libc::S_IFMT != libc::S_IFDIR {
        return Err(PathGuardError::UnsafePath);
    }
    Ok(DirectoryIdentity {
        volume_id: stat.st_dev.to_string(),
        file_id: stat.st_ino.to_string(),
    })
}
