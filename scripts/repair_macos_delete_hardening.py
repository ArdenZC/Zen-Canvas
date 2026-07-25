from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MOD = ROOT / "src-tauri/src/global_index/macos/mod.rs"
SPOTLIGHT = ROOT / "src-tauri/src/global_index/macos/spotlight.rs"


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}: {old[:100]}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    MOD,
    """                    self.pending.clone(),
                    self.stopped.clone(),
""",
    """                    self.pending.clone(),
                    self.known_entries.clone(),
                    self.stopped.clone(),
""",
)
replace_once(
    MOD,
    """    fn stream_spotlight_entries(
        sink: &mut dyn GlobalIndexSink,
        volume_id: &str,
        cancel: &AtomicBool,
    ) -> Result<spotlight::SpotlightCollectionSummary, GlobalIndexError> {
        match spotlight::stream_local_computer_entries(volume_id, cancel, |batch| {
            sink.write_batch(batch)
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
""",
)
replace_once(
    MOD,
    """        self.stopped.store(false, Ordering::Release);
        sink.mark_volume_entries_stale(&source.volume.id)?;
        let summary = Self::stream_spotlight_entries(sink, &source.volume.id, cancel)?;
""",
    """        self.stopped.store(false, Ordering::Release);
        sink.mark_volume_entries_stale(&source.volume.id)?;
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
    MOD,
    """        if pending.full_reconcile || needs_baseline_reconcile {
            sink.mark_volume_entries_stale(&source.volume.id)?;
            let summary = Self::stream_spotlight_entries(sink, &source.volume.id, cancel)?;
""",
    """        if pending.full_reconcile || needs_baseline_reconcile {
            sink.mark_volume_entries_stale(&source.volume.id)?;
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
    MOD,
    """        if let Ok(mut pending) = self.pending.lock() {
            pending.full_reconcile = false;
            pending.entries.clear();
            pending.stale_entry_ids.clear();
            pending.last_event_id = None;
        }
        self.baseline_established.store(false, Ordering::Release);
""",
    """        if let Ok(mut pending) = self.pending.lock() {
            pending.full_reconcile = false;
            pending.entries.clear();
            pending.stale_entry_ids.clear();
            pending.last_event_id = None;
        }
        if let Ok(mut known) = self.known_entries.lock() {
            known.clear();
        }
        self.baseline_established.store(false, Ordering::Release);
""",
)

replace_once(
    SPOTLIGHT,
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
    SPOTLIGHT,
    "autoreleasepool(|_| run_update_watcher(&volume_id, &pending, &stopped));",
    "autoreleasepool(|_| run_update_watcher(&volume_id, &pending, &known_entries, &stopped));",
)
replace_once(
    SPOTLIGHT,
    "fn run_update_watcher(volume_id: &str, pending: &Arc<Mutex<PendingUpdates>>, stopped: &AtomicBool) {",
    """fn run_update_watcher(
    volume_id: &str,
    pending: &Arc<Mutex<PendingUpdates>>,
    known_entries: &Arc<Mutex<std::collections::HashMap<String, String>>>,
    stopped: &AtomicBool,
) {""",
)
replace_once(
    SPOTLIGHT,
    """    let pending_for_block = pending.clone();
    let volume_id_for_block = volume_id.to_string();
""",
    """    let pending_for_block = pending.clone();
    let known_entries_for_block = known_entries.clone();
    let volume_id_for_block = volume_id.to_string();
""",
)
text = SPOTLIGHT.read_text(encoding="utf-8")
old = """            &mut full_reconcile,
            false,
        );"""
if text.count(old) != 2:
    raise RuntimeError(f"expected two active notification calls, found {text.count(old)}")
text = text.replace(
    old,
    """            &mut full_reconcile,
            &known_entries_for_block,
            false,
        );""",
)
old = """            &mut full_reconcile,
            true,
        );"""
if text.count(old) != 1:
    raise RuntimeError(f"expected one removed notification call, found {text.count(old)}")
text = text.replace(
    old,
    """            &mut full_reconcile,
            &known_entries_for_block,
            true,
        );""",
)
SPOTLIGHT.write_text(text, encoding="utf-8")
replace_once(
    SPOTLIGHT,
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
    SPOTLIGHT,
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
            let entry_id = known_entries
                .lock()
                .ok()
                .and_then(|mut known| known.remove(&normalize_path(&path)));
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
    SPOTLIGHT,
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

print("Repaired macOS stable deletion reconciliation")
