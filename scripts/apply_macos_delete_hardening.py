from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


mod = ROOT / "src-tauri/src/global_index/macos/mod.rs"
replace_once(mod, "use std::path::Path;", "use std::collections::HashMap;\nuse std::path::Path;")
replace_once(
    mod,
    "GlobalEntryInput, GlobalSourceDescriptor, GlobalVolume, INDEX_STATUS_FSEVENTS_UNAVAILABLE,",
    "normalize_path, GlobalEntryInput, GlobalSourceDescriptor, GlobalVolume, INDEX_STATUS_FSEVENTS_UNAVAILABLE,",
)
replace_once(
    mod,
    """    pending: Arc<Mutex<PendingUpdates>>,
    spotlight_watcher: Mutex<Option<JoinHandle<()>>>,
""",
    """    pending: Arc<Mutex<PendingUpdates>>,
    known_entries: Arc<Mutex<HashMap<String, String>>>,
    spotlight_watcher: Mutex<Option<JoinHandle<()>>>,
""",
)
replace_once(
    mod,
    """            pending: Arc::new(Mutex::new(PendingUpdates::default())),
            spotlight_watcher: Mutex::new(None),
""",
    """            pending: Arc::new(Mutex::new(PendingUpdates::default())),
            known_entries: Arc::new(Mutex::new(HashMap::new())),
            spotlight_watcher: Mutex::new(None),
""",
)
replace_once(
    mod,
    """                    self.pending.clone(),
                    self.stopped.clone(),
""",
    """                    self.pending.clone(),
                    self.known_entries.clone(),
                    self.stopped.clone(),
""",
)
replace_once(
    mod,
    """    fn stream_spotlight_entries(
        sink: &mut dyn GlobalIndexSink,
        volume_id: &str,
        cancel: &AtomicBool,
    ) -> Result<spotlight::SpotlightCollectionSummary, GlobalIndexError> {
        match spotlight::stream_local_computer_entries(volume_id, cancel, |batch| {
            sink.write_batch(batch)
                .map(|_| ())
                .map_err(|error| error.to_string())
        }) {
""",
    """    fn stream_spotlight_entries(
        sink: &mut dyn GlobalIndexSink,
        volume_id: &str,
        cancel: &AtomicBool,
        known_entries: &Arc<Mutex<HashMap<String, String>>>,
    ) -> Result<spotlight::SpotlightCollectionSummary, GlobalIndexError> {
        match spotlight::stream_local_computer_entries(volume_id, cancel, |batch| {
            if let Ok(mut known) = known_entries.lock() {
                for entry in batch {
                    known.insert(normalize_path(&entry.path), entry.entry_id());
                }
            }
            sink.write_batch(batch)
                .map(|_| ())
                .map_err(|error| error.to_string())
        }) {
""",
)
replace_once(
    mod,
    """        sink.mark_volume_entries_stale(&source.volume.id)?;
        let summary = Self::stream_spotlight_entries(sink, &source.volume.id, cancel)?;
""",
    """        sink.mark_volume_entries_stale(&source.volume.id)?;
        if let Ok(mut known) = self.known_entries.lock() {
            known.clear();
        }
        let summary = Self::stream_spotlight_entries(
            sink,
            &source.volume.id,
            cancel,
            &self.known_entries,
        )?;
""",
)
replace_once(
    mod,
    """            sink.mark_volume_entries_stale(&source.volume.id)?;
            let summary = Self::stream_spotlight_entries(sink, &source.volume.id, cancel)?;
""",
    """            sink.mark_volume_entries_stale(&source.volume.id)?;
            if let Ok(mut known) = self.known_entries.lock() {
                known.clear();
            }
            let summary = Self::stream_spotlight_entries(
                sink,
                &source.volume.id,
                cancel,
                &self.known_entries,
            )?;
""",
)
replace_once(
    mod,
    """        self.baseline_established.store(false, Ordering::Release);
        Ok(())
    }
}
""",
    """        if let Ok(mut known) = self.known_entries.lock() {
            known.clear();
        }
        self.baseline_established.store(false, Ordering::Release);
        Ok(())
    }
}
""",
)

spotlight = ROOT / "src-tauri/src/global_index/macos/spotlight.rs"
replace_once(
    spotlight,
    """pub fn spawn_update_watcher(
    volume_id: String,
    pending: Arc<Mutex<PendingUpdates>>,
    stopped: Arc<AtomicBool>,
) -> Result<JoinHandle<()>, String> {
""",
    """pub fn spawn_update_watcher(
    volume_id: String,
    pending: Arc<Mutex<PendingUpdates>>,
    known_entries: Arc<Mutex<std::collections::HashMap<String, String>>>,
    stopped: Arc<AtomicBool>,
) -> Result<JoinHandle<()>, String> {
""",
)
replace_once(
    spotlight,
    "autoreleasepool(|_| run_update_watcher(&volume_id, &pending, &stopped));",
    "autoreleasepool(|_| run_update_watcher(&volume_id, &pending, &known_entries, &stopped));",
)
replace_once(
    spotlight,
    """fn run_update_watcher(volume_id: &str, pending: &Arc<Mutex<PendingUpdates>>, stopped: &AtomicBool) {
""",
    """fn run_update_watcher(
    volume_id: &str,
    pending: &Arc<Mutex<PendingUpdates>>,
    known_entries: &Arc<Mutex<std::collections::HashMap<String, String>>>,
    stopped: &AtomicBool,
) {
""",
)
replace_once(
    spotlight,
    """    let pending_for_block = pending.clone();
    let volume_id_for_block = volume_id.to_string();
""",
    """    let pending_for_block = pending.clone();
    let known_entries_for_block = known_entries.clone();
    let volume_id_for_block = volume_id.to_string();
""",
)
# Add the known-entry map to each of the three notification collectors.
spotlight_text = spotlight.read_text(encoding="utf-8")
old_call = """            &mut full_reconcile,
            false,
        );"""
new_call = """            &mut full_reconcile,
            &known_entries_for_block,
            false,
        );"""
if spotlight_text.count(old_call) != 2:
    raise RuntimeError("expected two added/changed collector calls")
spotlight_text = spotlight_text.replace(old_call, new_call)
old_removed = """            &mut full_reconcile,
            true,
        );"""
new_removed = """            &mut full_reconcile,
            &known_entries_for_block,
            true,
        );"""
if spotlight_text.count(old_removed) != 1:
    raise RuntimeError("expected one removed collector call")
spotlight.write_text(spotlight_text.replace(old_removed, new_removed), encoding="utf-8")
replace_once(
    spotlight,
    """    full_reconcile: &mut bool,
    removed: bool,
) {
""",
    """    full_reconcile: &mut bool,
    known_entries: &Arc<Mutex<std::collections::HashMap<String, String>>>,
    removed: bool,
) {
""",
)
replace_once(
    spotlight,
    """    for index in 0..items.count() {
        let object = items.objectAtIndex(index);
        if let Some(entry) = object.downcast_ref::<NSMetadataItem>() {
""",
    """    for index in 0..items.count() {
        let object = items.objectAtIndex(index);
        if removed {
            let Some(path) = path_from_object(&object) else {
                *full_reconcile = true;
                continue;
            };
            let key = normalize_path(&path);
            let entry_id = known_entries
                .lock()
                .ok()
                .and_then(|mut known| known.remove(&key));
            if let Some(entry_id) = entry_id {
                stale_entry_ids.push(entry_id);
            } else {
                *full_reconcile = true;
            }
            continue;
        }
        if let Some(entry) = object.downcast_ref::<NSMetadataItem>() {
""",
)
replace_once(
    spotlight,
    """                Some(input) => {
                    match classify_spotlight_update(removed, has_path_identity(&input)) {
""",
    """                Some(input) => {
                    if let Ok(mut known) = known_entries.lock() {
                        known.insert(normalize_path(&input.path), input.entry_id());
                    }
                    match classify_spotlight_update(false, has_path_identity(&input)) {
""",
)

print("Applied macOS stable delete reconciliation patch")
