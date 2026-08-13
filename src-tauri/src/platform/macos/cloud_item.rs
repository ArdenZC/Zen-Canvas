//! iCloud/File Provider metadata inspection without requesting a download.

use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CloudItemState {
    NotUbiquitous,
    Current,
    Downloaded,
    NotDownloaded,
    Downloading,
    Unknown,
}

impl CloudItemState {
    pub fn is_ubiquitous(self) -> bool {
        matches!(
            self,
            Self::Current | Self::Downloaded | Self::NotDownloaded | Self::Downloading
        )
    }

    pub fn local_content_available(self) -> bool {
        matches!(self, Self::NotUbiquitous | Self::Current | Self::Downloaded)
    }
}

/// Reads cloud state using Foundation resource values only. It never calls a
/// download-starting API and never opens the file.
pub fn inspect(path: &Path) -> CloudItemState {
    #[cfg(target_os = "macos")]
    {
        return foundation_cloud_state(path).unwrap_or(CloudItemState::Unknown);
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = path;
        CloudItemState::NotUbiquitous
    }
}

#[cfg(target_os = "macos")]
fn foundation_cloud_state(path: &Path) -> Option<CloudItemState> {
    use objc2_foundation::{
        NSArray, NSNumber, NSString, NSURLIsUbiquitousItemKey,
        NSURLUbiquitousItemDownloadingStatusCurrent,
        NSURLUbiquitousItemDownloadingStatusDownloaded, NSURLUbiquitousItemDownloadingStatusKey,
        NSURLUbiquitousItemDownloadingStatusNotDownloaded, NSURLUbiquitousItemIsDownloadingKey,
        NSURL,
    };

    let path = path.to_str()?;
    let url = NSURL::fileURLWithPath(&NSString::from_str(path));
    let ubiquitous_key = unsafe { NSURLIsUbiquitousItemKey };
    let downloading_key = unsafe { NSURLUbiquitousItemIsDownloadingKey };
    let status_key = unsafe { NSURLUbiquitousItemDownloadingStatusKey };
    let keys = NSArray::from_slice(&[ubiquitous_key, downloading_key, status_key]);
    let values = url.resourceValuesForKeys_error(&keys).ok()?;
    let ubiquitous = values
        .objectForKey(ubiquitous_key)
        .and_then(|value| value.downcast::<NSNumber>().ok())
        .map(|value| value.as_bool())
        .unwrap_or(false);
    if !ubiquitous {
        return Some(CloudItemState::NotUbiquitous);
    }

    let downloading = values
        .objectForKey(downloading_key)
        .and_then(|value| value.downcast::<NSNumber>().ok())
        .is_some_and(|value| value.as_bool());
    if downloading {
        return Some(CloudItemState::Downloading);
    }

    let status = values
        .objectForKey(status_key)
        .and_then(|value| value.downcast::<NSString>().ok())?;
    let status = status.to_string();
    let current = unsafe { NSURLUbiquitousItemDownloadingStatusCurrent }.to_string();
    let downloaded = unsafe { NSURLUbiquitousItemDownloadingStatusDownloaded }.to_string();
    let not_downloaded = unsafe { NSURLUbiquitousItemDownloadingStatusNotDownloaded }.to_string();
    Some(if status == current {
        CloudItemState::Current
    } else if status == downloaded {
        CloudItemState::Downloaded
    } else if status == not_downloaded {
        CloudItemState::NotDownloaded
    } else {
        CloudItemState::Unknown
    })
}

#[cfg(test)]
mod tests {
    use super::CloudItemState;

    #[test]
    fn cloud_states_are_conservative_about_local_bytes() {
        assert!(CloudItemState::NotDownloaded.is_ubiquitous());
        assert!(CloudItemState::Downloading.is_ubiquitous());
        assert!(!CloudItemState::Unknown.is_ubiquitous());
        assert!(CloudItemState::Current.local_content_available());
        assert!(CloudItemState::Downloaded.local_content_available());
        assert!(!CloudItemState::NotDownloaded.local_content_available());
        assert!(!CloudItemState::Downloading.local_content_available());
        assert!(!CloudItemState::Unknown.local_content_available());
    }
}
