//! Read-only iCloud metadata inspection.
//!
//! These resource values describe Apple's iCloud ubiquitous-item semantics
//! only. They are not a generic File Provider ownership signal and never
//! request a download or change materialization state.

use super::types::MacContentAvailability;
use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ICloudItemState {
    NotICloud,
    Current,
    Downloaded,
    NotDownloaded,
    Downloading,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ICloudItemSemantics {
    pub state: ICloudItemState,
    pub content_availability: MacContentAvailability,
}

impl ICloudItemSemantics {
    fn not_icloud() -> Self {
        Self {
            state: ICloudItemState::NotICloud,
            content_availability: MacContentAvailability::Unknown,
        }
    }

    #[cfg(target_os = "macos")]
    fn unknown() -> Self {
        Self {
            state: ICloudItemState::Unknown,
            content_availability: MacContentAvailability::MetadataOnly,
        }
    }
}

/// Reads only iCloud resource values. It never calls a download-starting API
/// and never opens the file.
pub fn inspect(path: &Path) -> ICloudItemSemantics {
    #[cfg(target_os = "macos")]
    {
        // A failed native metadata query is not proof that the item is local.
        // Keep the result conservative so callers cannot accidentally open a
        // cloud placeholder after a permission or Objective-C conversion
        // failure.
        foundation_cloud_state(path).unwrap_or_else(ICloudItemSemantics::unknown)
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = path;
        ICloudItemSemantics::not_icloud()
    }
}

#[cfg(target_os = "macos")]
fn foundation_cloud_state(path: &Path) -> Option<ICloudItemSemantics> {
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
        .map(|value| value.as_bool())?;
    if !ubiquitous {
        return Some(ICloudItemSemantics::not_icloud());
    }

    let downloading = values
        .objectForKey(downloading_key)
        .and_then(|value| value.downcast::<NSNumber>().ok())
        .map(|value| value.as_bool())?;
    if downloading {
        return Some(ICloudItemSemantics {
            state: ICloudItemState::Downloading,
            content_availability: MacContentAvailability::Downloading,
        });
    }

    let status = values
        .objectForKey(status_key)
        .and_then(|value| value.downcast::<NSString>().ok())?;
    let status = status.to_string();
    let current = unsafe { NSURLUbiquitousItemDownloadingStatusCurrent }.to_string();
    let downloaded = unsafe { NSURLUbiquitousItemDownloadingStatusDownloaded }.to_string();
    let not_downloaded = unsafe { NSURLUbiquitousItemDownloadingStatusNotDownloaded }.to_string();
    Some(if status == current {
        ICloudItemSemantics {
            state: ICloudItemState::Current,
            content_availability: MacContentAvailability::Local,
        }
    } else if status == downloaded {
        ICloudItemSemantics {
            state: ICloudItemState::Downloaded,
            content_availability: MacContentAvailability::Local,
        }
    } else if status == not_downloaded {
        ICloudItemSemantics {
            state: ICloudItemState::NotDownloaded,
            content_availability: MacContentAvailability::NotLocal,
        }
    } else {
        ICloudItemSemantics {
            state: ICloudItemState::Unknown,
            content_availability: MacContentAvailability::MetadataOnly,
        }
    })
}

#[cfg(test)]
mod tests {
    use super::{ICloudItemSemantics, ICloudItemState};
    use crate::platform::macos::types::MacContentAvailability;

    #[test]
    fn i_cloud_states_do_not_make_unknown_or_placeholders_readable() {
        assert_eq!(
            ICloudItemSemantics {
                state: ICloudItemState::NotDownloaded,
                content_availability: MacContentAvailability::NotLocal,
            }
            .content_availability,
            MacContentAvailability::NotLocal
        );
        assert_eq!(
            ICloudItemSemantics {
                state: ICloudItemState::Unknown,
                content_availability: MacContentAvailability::MetadataOnly,
            }
            .content_availability,
            MacContentAvailability::MetadataOnly
        );
        assert_ne!(
            ICloudItemSemantics::not_icloud().content_availability,
            MacContentAvailability::Local
        );
    }
}
