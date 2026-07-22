#[cfg(any(unix, not(any(unix, windows))))]
use std::fs;
use std::{
    io,
    path::{Component, Path},
};

use super::platform_support;
#[cfg(target_os = "macos")]
use std::path::PathBuf;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum PathGuardError {
    #[error("unsafe_path")]
    UnsafePath,
    #[error("reparse_point")]
    ReparsePoint,
    #[error("io: {0}")]
    Io(#[from] io::Error),
    #[error("target_parent_identity_changed")]
    IdentityChanged,
    #[error("unsupported_platform_linux")]
    UnsupportedPlatformLinux,
    #[error("macos_file_mutation_source_binding_unsupported")]
    MacosFileMutationSourceBindingUnsupported,
}

pub fn create_directory_chain_no_links(path: &Path) -> Result<(), PathGuardError> {
    platform_support::ensure_supported_file_mutation().map_err(map_platform_error)?;
    if !path.is_absolute()
        || path
            .components()
            .any(|component| component == Component::ParentDir)
    {
        return Err(PathGuardError::UnsafePath);
    }

    #[cfg(unix)]
    {
        create_directory_chain_unix(path)
    }

    #[cfg(windows)]
    {
        create_directory_chain_windows(path)
    }

    #[cfg(not(any(unix, windows)))]
    {
        create_directory_chain_portable(path)
    }
}

pub(crate) fn map_platform_error(error: platform_support::PlatformSupportError) -> PathGuardError {
    match error {
        platform_support::PlatformSupportError::LinuxUnsupported => {
            PathGuardError::UnsupportedPlatformLinux
        }
        platform_support::PlatformSupportError::MacosFileMutationSourceBindingUnsupported => {
            PathGuardError::MacosFileMutationSourceBindingUnsupported
        }
    }
}

#[cfg(unix)]
fn create_directory_chain_unix(path: &Path) -> Result<(), PathGuardError> {
    use std::ffi::CString;
    use std::os::fd::{AsRawFd, FromRawFd, IntoRawFd, OwnedFd};

    #[cfg(target_os = "macos")]
    let path = prepare_macos_path(path)?;

    let root = fs::File::open("/")?;
    let mut parent = root;
    for component in path.components() {
        let Component::Normal(name) = component else {
            continue;
        };
        let name = CString::new(name.as_encoded_bytes()).map_err(|_| PathGuardError::UnsafePath)?;
        let flags = libc::O_RDONLY | libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC;
        let mut child_fd = unsafe { libc::openat(parent.as_raw_fd(), name.as_ptr(), flags) };
        if child_fd < 0 {
            let error = io::Error::last_os_error();
            if is_symlink_at(parent.as_raw_fd(), &name) {
                return Err(PathGuardError::ReparsePoint);
            }
            if error.raw_os_error() != Some(libc::ENOENT) {
                if error.raw_os_error() == Some(libc::ENOTDIR) {
                    return Err(PathGuardError::UnsafePath);
                }
                return Err(PathGuardError::Io(error));
            }
            let created = unsafe {
                libc::mkdirat(
                    parent.as_raw_fd(),
                    name.as_ptr(),
                    libc::S_IRWXU | libc::S_IRGRP | libc::S_IXGRP | libc::S_IROTH | libc::S_IXOTH,
                )
            };
            if created < 0 {
                let create_error = io::Error::last_os_error();
                if create_error.raw_os_error() != Some(libc::EEXIST) {
                    return Err(PathGuardError::Io(create_error));
                }
            }
            child_fd = unsafe { libc::openat(parent.as_raw_fd(), name.as_ptr(), flags) };
            if child_fd < 0 {
                let open_error = io::Error::last_os_error();
                if is_symlink_at(parent.as_raw_fd(), &name) {
                    return Err(PathGuardError::ReparsePoint);
                }
                if open_error.raw_os_error() == Some(libc::ENOTDIR) {
                    return Err(PathGuardError::UnsafePath);
                }
                return Err(PathGuardError::Io(open_error));
            }
        }
        let child = unsafe { OwnedFd::from_raw_fd(child_fd) };
        let mut stat = unsafe { std::mem::zeroed::<libc::stat>() };
        if unsafe { libc::fstat(child.as_raw_fd(), &mut stat) } != 0 {
            return Err(PathGuardError::Io(io::Error::last_os_error()));
        }
        if stat.st_mode & libc::S_IFMT != libc::S_IFDIR {
            return Err(PathGuardError::UnsafePath);
        }
        parent = unsafe { fs::File::from_raw_fd(child.into_raw_fd()) };
    }
    Ok(())
}

#[cfg(unix)]
fn is_symlink_at(parent_fd: std::os::fd::RawFd, name: &std::ffi::CString) -> bool {
    let mut stat = unsafe { std::mem::zeroed::<libc::stat>() };
    unsafe {
        libc::fstatat(
            parent_fd,
            name.as_ptr(),
            &mut stat,
            libc::AT_SYMLINK_NOFOLLOW,
        ) == 0
            && stat.st_mode & libc::S_IFMT == libc::S_IFLNK
    }
}

#[cfg(target_os = "macos")]
pub(crate) fn prepare_macos_path(path: &Path) -> Result<PathBuf, PathGuardError> {
    let mut original = PathBuf::new();
    let mut resolved = PathBuf::new();

    for component in path.components() {
        let original_next = original.join(component.as_os_str());
        match fs::symlink_metadata(&original_next) {
            Ok(metadata) => {
                if metadata.file_type().is_symlink() {
                    if original_next != Path::new("/var") && original_next != Path::new("/tmp") {
                        return Err(PathGuardError::ReparsePoint);
                    }
                    resolved = fs::canonicalize(&original_next)?;
                } else {
                    if !metadata.is_dir() {
                        return Err(PathGuardError::UnsafePath);
                    }
                    resolved.push(component.as_os_str());
                }
                original = original_next;
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                resolved.push(
                    path.strip_prefix(&original)
                        .map_err(|_| PathGuardError::UnsafePath)?,
                );
                break;
            }
            Err(error) => return Err(PathGuardError::Io(error)),
        }
    }

    Ok(resolved)
}

#[cfg(windows)]
fn create_directory_chain_windows(path: &Path) -> Result<(), PathGuardError> {
    // Windows creation is delegated to the verified-directory implementation.
    // It opens every component relative to the retained parent handle through
    // NtCreateFile and rejects reparse points on the returned handle.
    super::verified_directory::VerifiedDirectory::open_or_create(path).map(|_| ())
}

#[cfg(not(any(unix, windows)))]
fn create_directory_chain_portable(path: &Path) -> Result<(), PathGuardError> {
    let mut current = Path::new("").to_path_buf();
    for component in path.components() {
        current.push(component.as_os_str());
        match fs::symlink_metadata(&current) {
            Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => {
                return Err(PathGuardError::UnsafePath)
            }
            Ok(_) => {}
            Err(error) if error.kind() == io::ErrorKind::NotFound => fs::create_dir(&current)?,
            Err(error) => return Err(PathGuardError::Io(error)),
        }
    }
    Ok(())
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn creates_only_directory_components() {
        let root = std::env::temp_dir().join(format!(
            "zen-canvas-path-guard-{}-{}",
            std::process::id(),
            uuid::Uuid::new_v4()
        ));
        let nested = root.join("a").join("b");
        create_directory_chain_no_links(&nested).expect("create chain");
        assert!(nested.is_dir());
        let _ = fs::remove_dir_all(root);
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlink_component() {
        let root = std::env::temp_dir().join(format!(
            "zen-canvas-path-guard-link-{}-{}",
            std::process::id(),
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&root).expect("root");
        let real = root.join("real");
        let link = root.join("link");
        fs::create_dir(&real).expect("real");
        std::os::unix::fs::symlink(&real, &link).expect("link");
        assert!(matches!(
            create_directory_chain_no_links(&link.join("child")),
            Err(PathGuardError::ReparsePoint)
        ));
        let _ = fs::remove_dir_all(root);
    }
}
