//! Physical identity for macOS namespace objects.
//!
//! Path strings are only used to locate an object.  Mutation decisions use the
//! device, inode, and object type captured from `fstat`, `lstat`, or
//! `fstatat(..., AT_SYMLINK_NOFOLLOW)`.  The helpers in this module intentionally
//! do not hash bytes: content identity and physical identity are separate
//! authorities.

#[cfg(target_os = "macos")]
use std::{ffi::OsStr, io, path::Path};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MacPhysicalIdentity {
    pub dev: u64,
    pub ino: u64,
    pub mode: u32,
    pub file_type: u32,
    pub nlink: u64,
    pub size: u64,
    pub mtime_ns: i128,
    pub generation: Option<u64>,
}

impl MacPhysicalIdentity {
    /// Captures identity from an already-opened descriptor.
    #[cfg(target_os = "macos")]
    pub fn from_fd(file: &std::fs::File) -> io::Result<Self> {
        use std::os::fd::AsRawFd;

        let mut stat = unsafe { std::mem::zeroed::<libc::stat>() };
        if unsafe { libc::fstat(file.as_raw_fd(), &mut stat) } != 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(Self::from_stat(&stat))
    }

    /// Captures identity without following the final path component.
    #[cfg(target_os = "macos")]
    pub fn from_path_no_follow(path: &Path) -> io::Result<Self> {
        use std::{ffi::CString, os::unix::ffi::OsStrExt};

        let path = CString::new(path.as_os_str().as_bytes())
            .map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "embedded NUL"))?;
        let mut stat = unsafe { std::mem::zeroed::<libc::stat>() };
        if unsafe { libc::lstat(path.as_ptr(), &mut stat) } != 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(Self::from_stat(&stat))
    }

    /// Captures identity for one directory entry without following a symlink.
    #[cfg(target_os = "macos")]
    pub fn from_at(dir_fd: std::os::fd::RawFd, name: &OsStr) -> io::Result<Self> {
        use std::os::unix::ffi::OsStrExt;

        let name = std::ffi::CString::new(name.as_bytes())
            .map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "embedded NUL"))?;
        let mut stat = unsafe { std::mem::zeroed::<libc::stat>() };
        if unsafe { libc::fstatat(dir_fd, name.as_ptr(), &mut stat, libc::AT_SYMLINK_NOFOLLOW) }
            != 0
        {
            return Err(io::Error::last_os_error());
        }
        Ok(Self::from_stat(&stat))
    }

    pub const fn matches(self, other: Self) -> bool {
        self.dev == other.dev
            && self.ino == other.ino
            && self.file_type == other.file_type
            && match (self.generation, other.generation) {
                (Some(left), Some(right)) => left == right,
                _ => true,
            }
    }

    pub fn matches_strict(self, other: Self) -> bool {
        self.matches(other)
            && self.mode == other.mode
            && self.nlink == other.nlink
            && self.size == other.size
            && self.mtime_ns == other.mtime_ns
            && self.generation == other.generation
    }

    /// Compares all available mutable metadata except the link count. A
    /// staging file can gain a hard link when it is published through
    /// `linkat`; that change is not a pathname rebind. Destructive source
    /// claims must use the full `matches_strict` proof instead.
    pub fn matches_strict_ignoring_link_count(self, other: Self) -> bool {
        self.matches(other)
            && self.mode == other.mode
            && self.size == other.size
            && self.mtime_ns == other.mtime_ns
            && self.generation == other.generation
    }

    #[cfg(target_os = "macos")]
    fn from_stat(stat: &libc::stat) -> Self {
        let file_type = (stat.st_mode as u32) & libc::S_IFMT as u32;
        let mtime_ns = i128::from(stat.st_mtime) * 1_000_000_000 + i128::from(stat.st_mtime_nsec);
        Self {
            dev: stat.st_dev as u64,
            ino: stat.st_ino,
            mode: stat.st_mode as u32,
            file_type,
            nlink: stat.st_nlink as u64,
            size: stat.st_size.max(0) as u64,
            mtime_ns,
            // macOS does not expose a portable object-generation value through
            // the POSIX stat contract.  Provider-specific identity is handled
            // by the provider strategy rather than guessed here.
            generation: None,
        }
    }
}
