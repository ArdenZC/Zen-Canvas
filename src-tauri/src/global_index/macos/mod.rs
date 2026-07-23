//! Native macOS global-index provider.
//!
//! Spotlight owns the initial inventory and its metadata-query notifications
//! provide low-latency updates. FSEvents is deliberately used as a reconcile
//! signal: it is authoritative about filesystem change pressure, while
//! Spotlight remains the source of file metadata.

mod fsevents;
mod spotlight;

use super::coordinator::{GlobalIndexError, GlobalIndexProvider, GlobalIndexSink};
use super::models::{
    GlobalEntryInput, GlobalSourceDescriptor, GlobalVolume, PROVIDER_MACOS_FSEVENTS_RECONCILE,
    PROVIDER_MACOS_SPOTLIGHT,
};
use std::path::Path;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread::JoinHandle;

#[derive(Default)]
pub(crate) struct PendingUpdates {
    pub entries: Vec<GlobalEntryInput>,
    pub stale_entry_ids: Vec<String>,
    pub full_reconcile: bool,
    pub last_error: Option<String>,
}

pub struct MacosSpotlightProvider {
    stopped: Arc<AtomicBool>,
    pending: Arc<Mutex<PendingUpdates>>,
    spotlight_watcher: Mutex<Option<JoinHandle<()>>>,
    fsevents_watcher: Mutex<Option<fsevents::FseventsHandle>>,
}

impl MacosSpotlightProvider {
    pub fn new() -> Self {
        Self {
            stopped: Arc::new(AtomicBool::new(false)),
            pending: Arc::new(Mutex::new(PendingUpdates::default())),
            spotlight_watcher: Mutex::new(None),
            fsevents_watcher: Mutex::new(None),
        }
    }

    fn start_watchers(&self, volume_id: &str) -> Result<(), GlobalIndexError> {
        let mut spotlight_slot = self.spotlight_watcher.lock().map_err(|_| {
            GlobalIndexError::Provider("macOS Spotlight watcher lock poisoned".to_string())
        })?;
        if spotlight_slot.is_none() {
            *spotlight_slot = Some(spotlight::spawn_update_watcher(
                volume_id.to_string(),
                self.pending.clone(),
                self.stopped.clone(),
            ));
        }
        drop(spotlight_slot);

        let mut fsevents_slot = self.fsevents_watcher.lock().map_err(|_| {
            GlobalIndexError::Provider("macOS FSEvents watcher lock poisoned".to_string())
        })?;
        if fsevents_slot.is_none() {
            *fsevents_slot = Some(
                fsevents::start_reconcile_watcher(
                    Path::new("/"),
                    self.pending.clone(),
                    self.stopped.clone(),
                )
                .map_err(GlobalIndexError::Provider)?,
            );
        }
        Ok(())
    }

    fn stop_watchers(&self) {
        if let Ok(mut watcher) = self.spotlight_watcher.lock() {
            if let Some(handle) = watcher.take() {
                let _ = handle.join();
            }
        }
        if let Ok(mut watcher) = self.fsevents_watcher.lock() {
            if let Some(handle) = watcher.take() {
                handle.stop();
            }
        }
    }

    fn take_pending(&self) -> PendingUpdates {
        self.pending
            .lock()
            .map(|mut pending| std::mem::take(&mut *pending))
            .unwrap_or_else(|_| PendingUpdates {
                last_error: Some("macOS native index update lock poisoned".to_string()),
                ..PendingUpdates::default()
            })
    }

    fn write_entries(
        sink: &mut dyn GlobalIndexSink,
        entries: &[GlobalEntryInput],
    ) -> Result<(), GlobalIndexError> {
        for batch in entries.chunks(512) {
            sink.write_batch(batch)?;
        }
        Ok(())
    }
}

impl Default for MacosSpotlightProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl GlobalIndexProvider for MacosSpotlightProvider {
    fn discover_sources(&self) -> Result<Vec<GlobalSourceDescriptor>, GlobalIndexError> {
        Ok(vec![GlobalSourceDescriptor {
            volume: GlobalVolume::macos_spotlight_local_computer(),
        }])
    }

    fn start_initial_index(
        &self,
        source: &GlobalSourceDescriptor,
        sink: &mut dyn GlobalIndexSink,
        cancel: &AtomicBool,
    ) -> Result<(), GlobalIndexError> {
        self.stopped.store(false, Ordering::Release);
        let entries = spotlight::collect_local_computer_entries(&source.volume.id, cancel)
            .map_err(GlobalIndexError::Provider)?;
        sink.mark_volume_entries_stale(&source.volume.id)?;
        Self::write_entries(sink, &entries)?;
        self.start_watchers(&source.volume.id)?;
        Ok(())
    }

    fn resume_incremental_sync(
        &self,
        source: &GlobalSourceDescriptor,
        sink: &mut dyn GlobalIndexSink,
        cancel: &AtomicBool,
    ) -> Result<(), GlobalIndexError> {
        self.stopped.store(false, Ordering::Release);
        let pending = self.take_pending();
        if let Some(error) = pending.last_error {
            return Err(GlobalIndexError::Provider(error));
        }
        if pending.full_reconcile {
            let entries = spotlight::collect_local_computer_entries(&source.volume.id, cancel)
                .map_err(GlobalIndexError::Provider)?;
            sink.mark_volume_entries_stale(&source.volume.id)?;
            Self::write_entries(sink, &entries)?;
        } else {
            for entry_id in pending.stale_entry_ids {
                sink.mark_entry_stale(&entry_id)?;
            }
            Self::write_entries(sink, &pending.entries)?;
        }
        self.start_watchers(&source.volume.id)?;
        Ok(())
    }

    fn pause(&self) -> Result<(), GlobalIndexError> {
        self.stopped.store(true, Ordering::Release);
        self.stop_watchers();
        Ok(())
    }

    fn status(&self) -> Result<String, GlobalIndexError> {
        Ok(format!(
            "{PROVIDER_MACOS_SPOTLIGHT}+{PROVIDER_MACOS_FSEVENTS_RECONCILE}"
        ))
    }

    fn shutdown(&self) -> Result<(), GlobalIndexError> {
        self.stopped.store(true, Ordering::Release);
        self.stop_watchers();
        if let Ok(mut pending) = self.pending.lock() {
            pending.full_reconcile = false;
            pending.entries.clear();
            pending.stale_entry_ids.clear();
        }
        Ok(())
    }
}
