use std::{
    fs, io,
    path::{Component, Path},
};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum PathGuardError {
    #[error("unsafe_path")]
    UnsafePath,
    #[error("reparse_point")]
    ReparsePoint,
    #[error("io: {0}")]
    Io(#[from] io::Error),
}

pub fn create_directory_chain_no_links(path: &Path) -> Result<(), PathGuardError> {
    if !path.is_absolute()
        || path
            .components()
            .any(|component| component == Component::ParentDir)
    {
        return Err(PathGuardError::UnsafePath);
    }

    #[cfg(unix)]
    {
        return create_directory_chain_unix(path);
    }

    #[cfg(windows)]
    {
        return create_directory_chain_windows(path);
    }

    #[cfg(not(any(unix, windows)))]
    {
        create_directory_chain_portable(path)
    }
}

#[cfg(unix)]
fn create_directory_chain_unix(path: &Path) -> Result<(), PathGuardError> {
    use std::ffi::CString;
    use std::os::fd::{AsRawFd, FromRawFd, OwnedFd};

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
            if error.raw_os_error() != Some(libc::ENOENT) {
                if matches!(error.raw_os_error(), Some(libc::ELOOP)) {
                    return Err(PathGuardError::ReparsePoint);
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
                if matches!(open_error.raw_os_error(), Some(libc::ELOOP)) {
                    return Err(PathGuardError::ReparsePoint);
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

#[cfg(windows)]
fn create_directory_chain_windows(path: &Path) -> Result<(), PathGuardError> {
    use std::os::windows::fs::MetadataExt;
    use windows_sys::Win32::Storage::FileSystem::FILE_ATTRIBUTE_REPARSE_POINT;

    let mut current = path
        .components()
        .take_while(|component| !matches!(component, Component::Normal(_)))
        .fold(Path::new("").to_path_buf(), |value, component| {
            value.join(component.as_os_str())
        });
    for component in path.components() {
        if !matches!(component, Component::Normal(_)) {
            continue;
        }
        current.push(component.as_os_str());
        match fs::symlink_metadata(&current) {
            Ok(metadata) => {
                if metadata.file_type().is_symlink()
                    || metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
                {
                    return Err(PathGuardError::ReparsePoint);
                }
                if !metadata.is_dir() {
                    return Err(PathGuardError::UnsafePath);
                }
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                fs::create_dir(&current).or_else(|create_error| {
                    if create_error.kind() == io::ErrorKind::AlreadyExists {
                        Ok(())
                    } else {
                        Err(create_error)
                    }
                })?;
                let metadata = fs::symlink_metadata(&current)?;
                if metadata.file_type().is_symlink()
                    || metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
                {
                    return Err(PathGuardError::ReparsePoint);
                }
                if !metadata.is_dir() {
                    return Err(PathGuardError::UnsafePath);
                }
            }
            Err(error) => return Err(PathGuardError::Io(error)),
        }
    }
    Ok(())
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

#[cfg(test)]
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
