use super::PendingUpdates;
use crate::global_index::models::{normalize_path, GlobalEntryInput, PROVIDER_MACOS_SPOTLIGHT};
use block2::RcBlock;
use objc2::rc::{autoreleasepool, Retained};
use objc2::runtime::AnyObject;
use objc2_foundation::{
    NSArray, NSDate, NSMetadataItem, NSMetadataItemFSContentChangeDateKey,
    NSMetadataItemFSCreationDateKey, NSMetadataItemFSNameKey, NSMetadataItemFSSizeKey,
    NSMetadataItemPathKey, NSMetadataItemURLKey, NSMetadataQuery,
    NSMetadataQueryIndexedLocalComputerScope, NSMetadataQueryUpdateAddedItemsKey,
    NSMetadataQueryUpdateChangedItemsKey, NSMetadataQueryUpdateRemovedItemsKey, NSNotification,
    NSNotificationCenter, NSNumber, NSPredicate, NSRunLoop, NSString, NSURL,
};
use std::collections::HashSet;
use std::fs;
use std::os::unix::fs::MetadataExt;
use std::path::{Path, PathBuf};
use std::ptr::NonNull;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread::{self, JoinHandle};

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct SpotlightCollectionSummary {
    pub processed: usize,
    pub path_fallbacks: usize,
    pub skipped: usize,
    pub full_disk_access_required: bool,
    pub external_volume_not_indexed: bool,
}

#[derive(Debug)]
struct ExternalVolumeProbe {
    root: PathBuf,
    has_readable_content: bool,
}

pub fn stream_local_computer_entries<F>(
    volume_id: &str,
    cancel: &AtomicBool,
    mut on_batch: F,
) -> Result<SpotlightCollectionSummary, String>
where
    F: FnMut(&[GlobalEntryInput]) -> Result<(), String>,
{
    autoreleasepool(|_| {
        let query = new_local_computer_query();
        if !query.startQuery() {
            return Err("macos_spotlight_query_unavailable".to_string());
        }
        let run_loop = NSRunLoop::currentRunLoop();
        let external_volumes = mounted_external_volume_probes();
        let mut external_volume_hits = HashSet::new();
        while query.isGathering() {
            if cancel.load(Ordering::Acquire) {
                query.stopQuery();
                return Err("macos_spotlight_query_paused".to_string());
            }
            let deadline = NSDate::dateWithTimeIntervalSinceNow(0.2);
            run_loop.runUntilDate(&deadline);
        }
        let mut entries = Vec::with_capacity(512);
        let mut summary = SpotlightCollectionSummary::default();
        for index in 0..query.resultCount() {
            if cancel.load(Ordering::Acquire) {
                query.stopQuery();
                return Err("macos_spotlight_query_paused".to_string());
            }
            let object = query.resultAtIndex(index);
            if let Some(path) = path_from_object(&object) {
                if let Some(volume) = external_volumes
                    .iter()
                    .find(|volume| Path::new(&path).starts_with(&volume.root))
                {
                    external_volume_hits.insert(volume.root.clone());
                }
            }
            let Some(entry) = metadata_item_to_entry(volume_id, &object) else {
                summary.skipped += 1;
                continue;
            };
            summary.processed += 1;
            if has_path_identity(&entry) {
                summary.path_fallbacks += 1;
            }
            entries.push(entry);
            if entries.len() >= 512 {
                if let Err(error) = on_batch(&entries) {
                    query.stopQuery();
                    return Err(format!("callback:{error}"));
                }
                entries.clear();
            }
        }
        if !entries.is_empty() {
            if let Err(error) = on_batch(&entries) {
                query.stopQuery();
                return Err(format!("callback:{error}"));
            }
        }
        query.stopQuery();
        summary.full_disk_access_required = full_disk_access_required();
        summary.external_volume_not_indexed = external_volumes.iter().any(|volume| {
            volume.has_readable_content && !external_volume_hits.contains(&volume.root)
        });
        Ok(summary)
    })
}

pub fn spawn_update_watcher(
    volume_id: String,
    pending: Arc<Mutex<PendingUpdates>>,
    stopped: Arc<AtomicBool>,
) -> Result<JoinHandle<()>, String> {
    thread::Builder::new()
        .name("zen-canvas-macos-spotlight".to_string())
        .spawn(move || {
            autoreleasepool(|_| run_update_watcher(&volume_id, &pending, &stopped));
        })
        .map_err(|error| format!("macos_spotlight_thread_start_failed: {error}"))
}

fn run_update_watcher(volume_id: &str, pending: &Arc<Mutex<PendingUpdates>>, stopped: &AtomicBool) {
    let query = new_local_computer_query();
    let center = NSNotificationCenter::defaultCenter();
    let pending_for_block = pending.clone();
    let volume_id_for_block = volume_id.to_string();
    let update_block = RcBlock::new(move |notification: NonNull<NSNotification>| {
        let notification = unsafe { notification.as_ref() };
        let Some(user_info) = notification.userInfo() else {
            return;
        };
        let typed_info = unsafe { user_info.cast_unchecked() };
        let mut entries = Vec::new();
        let mut stale_entry_ids = Vec::new();
        let mut full_reconcile = false;
        collect_update_items(
            &typed_info,
            NSMetadataQueryUpdateAddedItemsKey,
            &volume_id_for_block,
            &mut entries,
            &mut stale_entry_ids,
            &mut full_reconcile,
            false,
        );
        collect_update_items(
            &typed_info,
            NSMetadataQueryUpdateChangedItemsKey,
            &volume_id_for_block,
            &mut entries,
            &mut stale_entry_ids,
            &mut full_reconcile,
            false,
        );
        collect_update_items(
            &typed_info,
            NSMetadataQueryUpdateRemovedItemsKey,
            &volume_id_for_block,
            &mut entries,
            &mut stale_entry_ids,
            &mut full_reconcile,
            true,
        );
        if entries.is_empty() && stale_entry_ids.is_empty() && !full_reconcile {
            return;
        }
        if let Ok(mut pending) = pending_for_block.lock() {
            pending.entries.extend(entries);
            pending.stale_entry_ids.extend(stale_entry_ids);
            pending.full_reconcile |= full_reconcile;
        }
    });
    let query_object: &AnyObject = query.as_ref();
    let observer = unsafe {
        center.addObserverForName_object_queue_usingBlock(
            Some(objc2_foundation::NSMetadataQueryDidUpdateNotification),
            Some(query_object),
            None,
            &update_block,
        )
    };
    if !query.startQuery() {
        if let Ok(mut pending) = pending.lock() {
            pending.last_error = Some("macos_spotlight_realtime_updates_unavailable".to_string());
        }
        unsafe { center.removeObserver(&observer) };
        return;
    }
    let run_loop = NSRunLoop::currentRunLoop();
    while !stopped.load(Ordering::Acquire) {
        let deadline = NSDate::dateWithTimeIntervalSinceNow(0.25);
        run_loop.runUntilDate(&deadline);
    }
    query.stopQuery();
    unsafe { center.removeObserver(&observer) };
}

fn new_local_computer_query() -> Retained<NSMetadataQuery> {
    let query = NSMetadataQuery::new();
    let predicate = NSPredicate::predicateWithValue(true);
    query.setPredicate(Some(&predicate));
    let scopes = NSArray::from_slice(&[NSMetadataQueryIndexedLocalComputerScope]);
    unsafe { query.setSearchScopes(&scopes) };
    query
}

fn full_disk_access_required() -> bool {
    let Some(home) = std::env::var_os("HOME").map(PathBuf::from) else {
        return false;
    };
    [
        home.join("Library/Mail"),
        home.join("Library/Messages"),
        home.join("Library/Safari"),
        home.join("Library/Calendars"),
    ]
    .iter()
    .any(|path| match fs::symlink_metadata(path) {
        Err(error) => error.kind() == std::io::ErrorKind::PermissionDenied,
        Ok(metadata) if metadata.is_dir() => match fs::read_dir(path) {
            Err(error) => error.kind() == std::io::ErrorKind::PermissionDenied,
            Ok(_) => false,
        },
        Ok(_) => false,
    })
}

fn mounted_external_volume_probes() -> Vec<ExternalVolumeProbe> {
    let Some(root_device) = fs::symlink_metadata("/")
        .ok()
        .map(|metadata| metadata.dev())
    else {
        return Vec::new();
    };
    let Ok(entries) = fs::read_dir("/Volumes") else {
        return Vec::new();
    };
    entries
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let root = entry.path();
            let metadata = fs::symlink_metadata(&root).ok()?;
            if !metadata.is_dir() || metadata.dev() == root_device {
                return None;
            }
            let has_readable_content = match fs::read_dir(&root) {
                Ok(mut children) => children.next().is_some(),
                Err(_) => false,
            };
            Some(ExternalVolumeProbe {
                root,
                has_readable_content,
            })
        })
        .collect()
}

fn collect_update_items(
    user_info: &objc2_foundation::NSDictionary<NSString, AnyObject>,
    key: &NSString,
    volume_id: &str,
    entries: &mut Vec<GlobalEntryInput>,
    stale_entry_ids: &mut Vec<String>,
    full_reconcile: &mut bool,
    removed: bool,
) {
    let Some(value) = user_info.objectForKey(key) else {
        return;
    };
    let Ok(items) = value.downcast::<NSArray>() else {
        return;
    };
    for index in 0..items.count() {
        let object = items.objectAtIndex(index);
        if let Some(entry) = object.downcast_ref::<NSMetadataItem>() {
            match metadata_item_to_entry(volume_id, entry.as_ref()) {
                Some(input) if !has_path_identity(&input) => {
                    if removed {
                        stale_entry_ids.push(input.entry_id());
                    } else {
                        entries.push(input);
                    }
                }
                Some(_) | None => {
                    *full_reconcile = true;
                }
            }
            continue;
        }
        if path_from_object(&object).is_some() {
            *full_reconcile = true;
        }
    }
}

fn metadata_item_to_entry(volume_id: &str, object: &AnyObject) -> Option<GlobalEntryInput> {
    let item = object.downcast_ref::<NSMetadataItem>()?;
    let path = metadata_string(item, NSMetadataItemPathKey)
        .or_else(|| metadata_url_path(item, NSMetadataItemURLKey))?;
    if path.trim().is_empty() {
        return None;
    }
    let path_buf = PathBuf::from(&path);
    let metadata = std::fs::symlink_metadata(&path_buf).ok();
    let is_directory = metadata.as_ref().is_some_and(std::fs::Metadata::is_dir);
    let name = metadata_string(item, NSMetadataItemFSNameKey)
        .or_else(|| {
            path_buf
                .file_name()
                .map(|value| value.to_string_lossy().into_owned())
        })
        .unwrap_or_else(|| path.clone());
    let extension = path_buf
        .extension()
        .map(|value| value.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let size = metadata_number(item, NSMetadataItemFSSizeKey)
        .or_else(|| metadata.as_ref().map(|value| value.len() as i64))
        .unwrap_or_default();
    let platform_file_id = mac_file_identity(&path_buf, metadata.as_ref());
    let parent_platform_file_id = path_buf
        .parent()
        .map(|parent| mac_file_identity(parent, std::fs::symlink_metadata(parent).ok().as_ref()))
        .unwrap_or_default();
    Some(GlobalEntryInput {
        volume_id: volume_id.to_string(),
        platform_file_id,
        parent_platform_file_id,
        name,
        path,
        extension,
        is_directory,
        size: if is_directory { 0 } else { size },
        created_at_fs: metadata_date(item, NSMetadataItemFSCreationDateKey),
        modified_at_fs: metadata_date(item, NSMetadataItemFSContentChangeDateKey),
        file_attributes: 0,
        is_hidden: path_buf
            .file_name()
            .is_some_and(|value| value.to_string_lossy().starts_with('.')),
        is_system: false,
        source_provider: PROVIDER_MACOS_SPOTLIGHT.to_string(),
        last_seen_at: crate::global_index::models::unix_now(),
    })
}

fn mac_file_identity(path: &Path, metadata: Option<&std::fs::Metadata>) -> String {
    metadata
        .map(|metadata| format!("mac:dev:{:x}:ino:{:x}", metadata.dev(), metadata.ino()))
        .unwrap_or_else(|| format!("path:{}", normalize_path(&path.to_string_lossy())))
}

fn has_path_identity(entry: &GlobalEntryInput) -> bool {
    entry.platform_file_id.starts_with("path:")
        || entry.parent_platform_file_id.starts_with("path:")
}

fn metadata_string(item: &NSMetadataItem, key: &NSString) -> Option<String> {
    item.valueForAttribute(key)
        .and_then(|value| value.downcast::<NSString>().ok())
        .map(|value| value.to_string())
}

fn metadata_url_path(item: &NSMetadataItem, key: &NSString) -> Option<String> {
    item.valueForAttribute(key)
        .and_then(|value| value.downcast::<NSURL>().ok())
        .and_then(|value| value.path())
        .map(|value| value.to_string())
}

fn metadata_number(item: &NSMetadataItem, key: &NSString) -> Option<i64> {
    item.valueForAttribute(key)
        .and_then(|value| value.downcast::<NSNumber>().ok())
        .map(|value| value.as_i64())
}

fn metadata_date(item: &NSMetadataItem, key: &NSString) -> Option<i64> {
    item.valueForAttribute(key)
        .and_then(|value| value.downcast::<NSDate>().ok())
        .map(|value| value.timeIntervalSince1970().max(0.0) as i64)
}

fn path_from_object(object: &AnyObject) -> Option<String> {
    if let Some(value) = object.downcast_ref::<NSString>() {
        return Some(value.to_string());
    }
    if let Some(value) = object.downcast_ref::<NSURL>() {
        return value.path().map(|path| path.to_string());
    }
    if let Some(value) = object.downcast_ref::<NSMetadataItem>() {
        return metadata_string(value, NSMetadataItemPathKey)
            .or_else(|| metadata_url_path(value, NSMetadataItemURLKey));
    }
    None
}

#[cfg(test)]
mod tests {
    use super::super::super::models::normalize_path;
    use super::mac_file_identity;
    use std::path::Path;

    #[test]
    fn macos_paths_use_platform_normalization() {
        assert_eq!(normalize_path("/Users/test/"), "/Users/test");
    }

    #[test]
    fn macos_identity_prefers_device_and_inode_when_metadata_exists() {
        let path = Path::new(file!());
        let metadata = std::fs::symlink_metadata(path).expect("test source metadata");
        assert!(mac_file_identity(path, Some(&metadata)).starts_with("mac:dev:"));
    }
}
