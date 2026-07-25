from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    if new in text:
        return
    if text.count(old) != 1:
        raise SystemExit(f"{path}: expected one match for {old[:100]!r}, found {text.count(old)}")
    target.write_text(text.replace(old, new), encoding="utf-8")


repo = "src-tauri/src/global_index/repository.rs"
replace_once(
    repo,
    "(SELECT COUNT(*) FROM global_entries WHERE is_stale = 0),",
    """(SELECT COUNT(*)
                 FROM global_entries entry
                 JOIN global_volumes volume ON volume.id = entry.volume_id
                 WHERE entry.is_stale = 0 AND volume.enabled = 1),""",
)
replace_once(
    repo,
    "(SELECT MAX(last_incremental_sync_at) FROM global_volumes),",
    "(SELECT MAX(last_incremental_sync_at) FROM global_volumes WHERE enabled = 1),",
)
replace_once(
    repo,
    "(SELECT last_error FROM global_volumes WHERE last_error IS NOT NULL ORDER BY updated_at DESC LIMIT 1)",
    "(SELECT last_error FROM global_volumes WHERE enabled = 1 AND last_error IS NOT NULL ORDER BY updated_at DESC LIMIT 1)",
)

mac = "src-tauri/src/global_index/macos/mod.rs"
replace_once(
    mac,
    """                spotlight::spawn_update_watcher(
                    volume_id.to_string(),
                    self.pending.clone(),
                    self.stopped.clone(),
                )""",
    """                spotlight::spawn_update_watcher(
                    volume_id.to_string(),
                    self.pending.clone(),
                    self.known_entries.clone(),
                    self.stopped.clone(),
                )""",
)
replace_once(
    mac,
    """    fn write_entries(
        sink: &mut dyn GlobalIndexSink,
        entries: &[GlobalEntryInput],
    ) -> Result<(), GlobalIndexError> {
        for batch in entries.chunks(512) {
            sink.write_batch(batch)?;
        }
        Ok(())
    }

    fn stream_spotlight_entries(
        sink: &mut dyn GlobalIndexSink,""",
    """    fn remember_entries(&self, entries: &[GlobalEntryInput]) {
        if let Ok(mut known) = self.known_entries.lock() {
            for entry in entries {
                known.insert(normalize_path(&entry.path), entry.entry_id());
            }
        }
    }

    fn forget_entry_id(&self, entry_id: &str) {
        if let Ok(mut known) = self.known_entries.lock() {
            known.retain(|_, known_entry_id| known_entry_id != entry_id);
        }
    }

    fn clear_known_entries(&self) {
        if let Ok(mut known) = self.known_entries.lock() {
            known.clear();
        }
    }

    fn write_entries(
        &self,
        sink: &mut dyn GlobalIndexSink,
        entries: &[GlobalEntryInput],
    ) -> Result<(), GlobalIndexError> {
        for batch in entries.chunks(512) {
            sink.write_batch(batch)?;
            self.remember_entries(batch);
        }
        Ok(())
    }

    fn stream_spotlight_entries(
        &self,
        sink: &mut dyn GlobalIndexSink,""",
)
replace_once(
    mac,
    """        match spotlight::stream_local_computer_entries(volume_id, cancel, |batch| {
            sink.write_batch(batch)
                .map(|_| ())
                .map_err(|error| error.to_string())
        }) {""",
    """        match spotlight::stream_local_computer_entries(volume_id, cancel, |batch| {
            sink.write_batch(batch).map_err(|error| error.to_string())?;
            self.remember_entries(batch);
            Ok(())
        }) {""",
)
replace_once(
    mac,
    """        sink.mark_volume_entries_stale(&source.volume.id)?;
        let summary = Self::stream_spotlight_entries(sink, &source.volume.id, cancel)?;""",
    """        sink.mark_volume_entries_stale(&source.volume.id)?;
        self.clear_known_entries();
        let summary = self.stream_spotlight_entries(sink, &source.volume.id, cancel)?;""",
)
replace_once(
    mac,
    """            sink.mark_volume_entries_stale(&source.volume.id)?;
            let summary = Self::stream_spotlight_entries(sink, &source.volume.id, cancel)?;""",
    """            sink.mark_volume_entries_stale(&source.volume.id)?;
            self.clear_known_entries();
            let summary = self.stream_spotlight_entries(sink, &source.volume.id, cancel)?;""",
)
replace_once(
    mac,
    """            for entry_id in pending.stale_entry_ids {
                sink.mark_entry_stale(&entry_id)?;
            }
            Self::write_entries(sink, &pending.entries)?;""",
    """            for entry_id in pending.stale_entry_ids {
                sink.mark_entry_stale(&entry_id)?;
                self.forget_entry_id(&entry_id);
            }
            self.write_entries(sink, &pending.entries)?;""",
)
replace_once(
    mac,
    """            pending.last_event_id = None;
        }
        self.baseline_established.store(false, Ordering::Release);""",
    """            pending.last_event_id = None;
        }
        self.clear_known_entries();
        self.baseline_established.store(false, Ordering::Release);""",
)

spotlight = "src-tauri/src/global_index/macos/spotlight.rs"
replace_once(
    spotlight,
    "use std::collections::HashSet;",
    "use std::collections::{HashMap, HashSet};",
)
replace_once(
    spotlight,
    """pub fn spawn_update_watcher(
    volume_id: String,
    pending: Arc<Mutex<PendingUpdates>>,
    stopped: Arc<AtomicBool>,
) -> Result<JoinHandle<()>, String> {""",
    """pub fn spawn_update_watcher(
    volume_id: String,
    pending: Arc<Mutex<PendingUpdates>>,
    known_entries: Arc<Mutex<HashMap<String, String>>>,
    stopped: Arc<AtomicBool>,
) -> Result<JoinHandle<()>, String> {""",
)
replace_once(
    spotlight,
    "autoreleasepool(|_| run_update_watcher(&volume_id, &pending, &stopped));",
    "autoreleasepool(|_| run_update_watcher(&volume_id, &pending, &known_entries, &stopped));",
)
replace_once(
    spotlight,
    "fn run_update_watcher(volume_id: &str, pending: &Arc<Mutex<PendingUpdates>>, stopped: &AtomicBool) {",
    """fn run_update_watcher(
    volume_id: &str,
    pending: &Arc<Mutex<PendingUpdates>>,
    known_entries: &Arc<Mutex<HashMap<String, String>>>,
    stopped: &AtomicBool,
) {""",
)
replace_once(
    spotlight,
    """    let pending_for_block = pending.clone();
    let volume_id_for_block = volume_id.to_string();""",
    """    let pending_for_block = pending.clone();
    let known_entries_for_block = known_entries.clone();
    let volume_id_for_block = volume_id.to_string();""",
)
# Add the known-entry map to all three notification collectors.
target = Path(spotlight)
text = target.read_text(encoding="utf-8")
old = """            &volume_id_for_block,
            &mut entries,
            &mut stale_entry_ids,"""
new = """            &volume_id_for_block,
            &known_entries_for_block,
            &mut entries,
            &mut stale_entry_ids,"""
if text.count(new) != 3:
    if text.count(old) != 3:
        raise SystemExit(f"{spotlight}: expected three update collector calls")
    target.write_text(text.replace(old, new), encoding="utf-8")

replace_once(
    spotlight,
    """fn collect_update_items(
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
                Some(input) => {
                    match classify_spotlight_update(removed, has_path_identity(&input)) {
                        SpotlightUpdateAction::Upsert => entries.push(input),
                        SpotlightUpdateAction::Stale => stale_entry_ids.push(input.entry_id()),
                        SpotlightUpdateAction::Reconcile => *full_reconcile = true,
                    }
                }
                None => {
                    *full_reconcile = true;
                }
            }
            continue;
        }
        if path_from_object(&object).is_some() {
            *full_reconcile = true;
        }
    }
}""",
    """fn collect_update_items(
    user_info: &objc2_foundation::NSDictionary<NSString, AnyObject>,
    key: &NSString,
    volume_id: &str,
    known_entries: &Arc<Mutex<HashMap<String, String>>>,
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
        let path = path_from_object(&object).map(|path| normalize_path(&path));
        if removed {
            if let Some(entry_id) = path.as_deref().and_then(|path| {
                known_entries
                    .lock()
                    .ok()
                    .and_then(|known| known.get(path).cloned())
            }) {
                stale_entry_ids.push(entry_id);
                continue;
            }
        }
        if let Some(entry) = object.downcast_ref::<NSMetadataItem>() {
            match metadata_item_to_entry(volume_id, entry.as_ref()) {
                Some(input) => match classify_spotlight_update(removed, has_path_identity(&input)) {
                    SpotlightUpdateAction::Upsert => entries.push(input),
                    SpotlightUpdateAction::Stale => stale_entry_ids.push(input.entry_id()),
                    SpotlightUpdateAction::Reconcile => *full_reconcile = true,
                },
                None => *full_reconcile = true,
            }
            continue;
        }
        if path.is_some() {
            *full_reconcile = true;
        }
    }
}""",
)

print("Applied final global-index correctness fixes")
