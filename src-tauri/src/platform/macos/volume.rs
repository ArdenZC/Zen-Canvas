//! Read-only volume semantics from Foundation and POSIX metadata.

use std::path::Path;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MacVolumeSemantics {
    pub stable_id: Option<String>,
    pub mount_path: Option<String>,
    pub filesystem_type: Option<String>,
    pub is_local: Option<bool>,
    pub is_removable: Option<bool>,
    pub is_read_only: Option<bool>,
}

impl MacVolumeSemantics {
    fn unknown() -> Self {
        Self {
            stable_id: None,
            mount_path: None,
            filesystem_type: None,
            is_local: None,
            is_removable: None,
            is_read_only: None,
        }
    }
}

pub fn inspect(path: &Path) -> MacVolumeSemantics {
    #[cfg(target_os = "macos")]
    {
        let mut semantics =
            foundation_volume_semantics(path).unwrap_or_else(MacVolumeSemantics::unknown);
        if let Some((filesystem_type, is_local, is_read_only)) = posix_volume_semantics(path) {
            if semantics.filesystem_type.is_none() {
                semantics.filesystem_type = filesystem_type;
            }
            if semantics.is_local.is_none() {
                semantics.is_local = Some(is_local);
            }
            if semantics.is_read_only.is_none() {
                semantics.is_read_only = Some(is_read_only);
            }
        }
        semantics
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = path;
        MacVolumeSemantics::unknown()
    }
}

/// Compares native volume identity for diagnostics only. This value is never a
/// mutation proof: mutation must use the operation's descriptor-backed
/// identity and post-open revalidation, not NSURL volume metadata.
pub fn same_volume_diagnostic(left: &Path, right: &Path) -> Option<bool> {
    let left = inspect(left).stable_id?;
    let right = inspect(right).stable_id?;
    Some(left == right)
}

#[cfg(target_os = "macos")]
fn foundation_volume_semantics(path: &Path) -> Option<MacVolumeSemantics> {
    use objc2::rc::autoreleasepool;
    use objc2_foundation::{
        NSArray, NSNumber, NSString, NSURLVolumeIdentifierKey, NSURLVolumeIsLocalKey,
        NSURLVolumeIsReadOnlyKey, NSURLVolumeIsRemovableKey, NSURLVolumeTypeNameKey,
        NSURLVolumeURLKey, NSURL,
    };

    autoreleasepool(|_| {
        let path = path.to_str()?;
        let url = NSURL::fileURLWithPath(&NSString::from_str(path));
        let id_key = unsafe { NSURLVolumeIdentifierKey };
        let type_key = unsafe { NSURLVolumeTypeNameKey };
        let local_key = unsafe { NSURLVolumeIsLocalKey };
        let removable_key = unsafe { NSURLVolumeIsRemovableKey };
        let readonly_key = unsafe { NSURLVolumeIsReadOnlyKey };
        let mount_key = unsafe { NSURLVolumeURLKey };
        let keys = NSArray::from_slice(&[
            id_key,
            type_key,
            local_key,
            removable_key,
            readonly_key,
            mount_key,
        ]);
        let values = url.resourceValuesForKeys_error(&keys).ok()?;
        let stable_id = values.objectForKey(id_key).and_then(|value| {
            value
                .clone()
                .downcast::<NSString>()
                .ok()
                .map(|value| value.to_string())
                .or_else(|| {
                    value
                        .downcast::<NSNumber>()
                        .ok()
                        .map(|value| value.as_i64().to_string())
                })
        });
        let filesystem_type = values
            .objectForKey(type_key)
            .and_then(|value| value.downcast::<NSString>().ok())
            .map(|value| value.to_string());
        let is_local = values
            .objectForKey(local_key)
            .and_then(|value| value.downcast::<NSNumber>().ok())
            .map(|value| value.as_bool());
        let is_removable = values
            .objectForKey(removable_key)
            .and_then(|value| value.downcast::<NSNumber>().ok())
            .map(|value| value.as_bool());
        let is_read_only = values
            .objectForKey(readonly_key)
            .and_then(|value| value.downcast::<NSNumber>().ok())
            .map(|value| value.as_bool());
        let mount_path = values
            .objectForKey(mount_key)
            .and_then(|value| value.downcast::<NSURL>().ok())
            .and_then(|value| value.path())
            .map(|value| value.to_string());
        Some(MacVolumeSemantics {
            stable_id,
            mount_path,
            filesystem_type,
            is_local,
            is_removable,
            is_read_only,
        })
    })
}

#[cfg(target_os = "macos")]
fn posix_volume_semantics(path: &Path) -> Option<(Option<String>, bool, bool)> {
    use std::ffi::{CStr, CString};
    use std::mem::MaybeUninit;

    let path = CString::new(path.to_str()?).ok()?;
    let mut info = MaybeUninit::<libc::statfs>::zeroed();
    if unsafe { libc::statfs(path.as_ptr(), info.as_mut_ptr()) } != 0 {
        return None;
    }
    let info = unsafe { info.assume_init() };
    let filesystem_type = unsafe { CStr::from_ptr(info.f_fstypename.as_ptr()) }
        .to_string_lossy()
        .trim()
        .to_ascii_lowercase();
    let filesystem_type = (!filesystem_type.is_empty()).then_some(filesystem_type);
    let flags = info.f_flags;
    Some((
        filesystem_type,
        flags & (libc::MNT_LOCAL as u32) != 0,
        flags & (libc::MNT_RDONLY as u32) != 0,
    ))
}

#[cfg(test)]
mod tests {
    use super::{same_volume_diagnostic, MacVolumeSemantics};
    use std::path::Path;

    #[test]
    fn unknown_volume_semantics_have_no_false_local_or_writable_claim() {
        let semantics = MacVolumeSemantics::unknown();
        assert_eq!(semantics.is_local, None);
        assert_eq!(semantics.is_removable, None);
        assert_eq!(semantics.is_read_only, None);
        assert_eq!(
            same_volume_diagnostic(Path::new("/missing-a"), Path::new("/missing-b")),
            None
        );
    }
}
