//! Unified read-only macOS file semantics.

use super::{cloud_item, package, volume, CloudItemState, MacVolumeSemantics};
use std::path::Path;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MacFileSemantics {
    pub is_symlink: bool,
    pub is_package: bool,
    pub is_ubiquitous: bool,
    pub cloud_state: CloudItemState,
    pub local_content_available: bool,
    pub logical_size: Option<u64>,
    pub allocated_size: Option<u64>,
    pub volume: MacVolumeSemantics,
}

impl MacFileSemantics {
    pub fn unsupported() -> Self {
        Self {
            is_symlink: false,
            is_package: false,
            is_ubiquitous: false,
            cloud_state: CloudItemState::Unknown,
            local_content_available: false,
            logical_size: None,
            allocated_size: None,
            volume: MacVolumeSemantics {
                stable_id: None,
                filesystem_type: None,
                is_local: None,
                is_removable: None,
                is_read_only: None,
            },
        }
    }
}

/// Returns whether a caller may read content bytes without following a link or
/// implicitly materializing a cloud placeholder.
pub fn content_bytes_are_available(path: &Path) -> bool {
    let Some(metadata) = std::fs::symlink_metadata(path).ok() else {
        return false;
    };
    if !metadata.is_file() || metadata.file_type().is_symlink() {
        return false;
    }
    inspect(path).local_content_available
}

pub fn inspect(path: &Path) -> MacFileSemantics {
    let metadata = std::fs::symlink_metadata(path).ok();
    let is_symlink = metadata
        .as_ref()
        .is_some_and(|value| value.file_type().is_symlink());
    if is_symlink {
        return MacFileSemantics {
            is_symlink: true,
            is_package: false,
            is_ubiquitous: false,
            cloud_state: CloudItemState::Unknown,
            local_content_available: false,
            logical_size: None,
            allocated_size: None,
            volume: volume::inspect(path),
        };
    }

    let is_directory = metadata.as_ref().is_some_and(std::fs::Metadata::is_dir);
    let cloud_state = cloud_item::inspect(path);
    let logical_size = metadata
        .as_ref()
        .filter(|_| !is_directory)
        .map(std::fs::Metadata::len);
    let allocated_size = if cloud_state.local_content_available() {
        allocated_size(path, metadata.as_ref())
    } else {
        None
    };
    MacFileSemantics {
        is_symlink: false,
        is_package: is_directory && package::is_package(path),
        is_ubiquitous: cloud_state.is_ubiquitous(),
        cloud_state,
        local_content_available: metadata.is_some() && cloud_state.local_content_available(),
        logical_size,
        allocated_size,
        volume: volume::inspect(path),
    }
}

#[cfg(target_os = "macos")]
fn allocated_size(path: &Path, metadata: Option<&std::fs::Metadata>) -> Option<u64> {
    use objc2_foundation::{NSArray, NSNumber, NSString, NSURLTotalFileAllocatedSizeKey, NSURL};

    let foundation_size = path.to_str().and_then(|path| {
        let url = NSURL::fileURLWithPath(&NSString::from_str(path));
        let key = unsafe { NSURLTotalFileAllocatedSizeKey };
        let keys = NSArray::from_slice(&[key]);
        let values = url.resourceValuesForKeys_error(&keys).ok()?;
        values
            .objectForKey(key)
            .and_then(|value| value.downcast::<NSNumber>().ok())
            .and_then(|value| u64::try_from(value.as_i64()).ok())
    });
    foundation_size.or_else(|| {
        use std::os::unix::fs::MetadataExt;
        metadata?.blocks().checked_mul(512)
    })
}

#[cfg(not(target_os = "macos"))]
fn allocated_size(_path: &Path, _metadata: Option<&std::fs::Metadata>) -> Option<u64> {
    None
}

#[cfg(test)]
mod tests {
    use super::inspect;
    use std::path::Path;

    #[test]
    fn symlink_semantics_are_fail_closed_without_following_the_link() {
        let semantics = inspect(Path::new("/path/that/does/not/exist"));
        assert!(!semantics.is_package);
        assert!(!semantics.local_content_available);
    }
}
