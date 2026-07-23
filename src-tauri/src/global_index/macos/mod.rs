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
    GlobalEntryInput, GlobalSourceDescriptor, GlobalVolume, INDEX_STATUS_FSEVENTS_UNAVAILABLE,
    INDEX_STATUS_PERMISSION_REQUIRED, INDEX_STATUS_READY,
    INDEX_STATUS_SPOTLIGHT_EXTERNAL_NOT_INDEXED, INDEX_STATUS_SPOTLIGHT_NOT_INDEXED,
    INDEX_STATUS_SPOTLIGHT_UNAVAILABLE, INDEX_STATUS_UNAVAILABLE,
    PROVIDER_MACOS_FSEVENTS_RECONCILE, PROVIDER_MACOS_SPOTLIGHT,
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
    pub last_event_id: Option<u64>,
    pub last_error: Option<String>,
}

pub struct MacosSpotlightProvider {
    stopped: Arc<AtomicBool>,
    pending: Arc<Mutex<PendingUpdates>>,
    spotlight_watcher: Mutex<Option<JoinHandle<()>>>,
    fsevents_watcher: Mutex<Option<fsevents::FseventsHandle>>,
    baseline_established: AtomicBool,
}

impl MacosSpotlightProvider {
    pub fn new() -> Self {
        Self {
            stopped: Arc::new(AtomicBool::new(false)),
            pending: Arc::new(Mutex::new(PendingUpdates::default())),
            spotlight_watcher: Mutex::new(None),
            fsevents_watcher: Mutex::new(None),
            baseline_established: AtomicBool::new(false),
        }
    }

    fn start_watchers(
        &self,
        volume_id: &str,
        since_event_id: Option<u64>,
    ) -> Result<(), GlobalIndexError> {
        let mut spotlight_slot = self.spotlight_watcher.lock().map_err(|_| {
            GlobalIndexError::Provider("macOS Spotlight watcher lock poisoned".to_string())
        })?;
        if spotlight_slot.is_none() {
            *spotlight_slot = Some(
                spotlight::spawn_update_watcher(
                    volume_id.to_string(),
                    self.pending.clone(),
                    self.stopped.clone(),
                )
                .map_err(GlobalIndexError::Provider)?,
            );
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
                    since_event_id,
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

    fn stream_spotlight_entries(
        sink: &mut dyn GlobalIndexSink,
        volume_id: &str,
        cancel: &AtomicBool,
    ) -> Result<spotlight::SpotlightCollectionSummary, GlobalIndexError> {
        match spotlight::stream_local_computer_entries(volume_id, cancel, |batch| {
            sink.write_batch(batch)
                .map(|_| ())
                .map_err(|error| error.to_string())
        }) {
            Ok(summary) => Ok(summary),
            Err(error) if error == "macos_spotlight_query_paused" => Err(GlobalIndexError::Paused),
            Err(error) if error.starts_with("callback:") => Err(GlobalIndexError::Provider(
                error.trim_start_matches("callback:").to_string(),
            )),
            Err(error) => Err(Self::report_native_error(sink, volume_id, &error)?),
        }
    }

    fn record_collection_state(
        sink: &mut dyn GlobalIndexSink,
        volume_id: &str,
        summary: spotlight::SpotlightCollectionSummary,
    ) -> Result<(), GlobalIndexError> {
        if summary.full_disk_access_required {
            sink.set_source_state(
                volume_id,
                INDEX_STATUS_PERMISSION_REQUIRED,
                Some("macos_spotlight_full_disk_access_required"),
            )?;
        } else if summary.external_volume_not_indexed {
            sink.set_source_state(
                volume_id,
                INDEX_STATUS_SPOTLIGHT_EXTERNAL_NOT_INDEXED,
                Some("macos_spotlight_external_volume_not_indexed"),
            )?;
        } else if summary.processed == 0 {
            sink.set_source_state(
                volume_id,
                INDEX_STATUS_SPOTLIGHT_NOT_INDEXED,
                Some("macos_spotlight_no_indexed_local_results"),
            )?;
        } else if summary.path_fallbacks > 0 {
            sink.set_source_state(
                volume_id,
                INDEX_STATUS_PERMISSION_REQUIRED,
                Some("macos_spotlight_protected_directories"),
            )?;
        } else if summary.skipped > 0 {
            sink.set_source_state(
                volume_id,
                INDEX_STATUS_PERMISSION_REQUIRED,
                Some("macos_spotlight_incomplete_results"),
            )?;
        } else {
            sink.set_source_state(volume_id, INDEX_STATUS_READY, None)?;
        }
        Ok(())
    }

    fn report_native_error(
        sink: &mut dyn GlobalIndexSink,
        volume_id: &str,
        error: &str,
    ) -> Result<GlobalIndexError, GlobalIndexError> {
        let status = if error.contains("macos_spotlight") {
            if error.contains("full_disk_access")
                || error.contains("permission")
                || error.contains("protected")
            {
                super::models::INDEX_STATUS_PERMISSION_REQUIRED
            } else if error.contains("external_volume_not_indexed") {
                INDEX_STATUS_SPOTLIGHT_EXTERNAL_NOT_INDEXED
            } else {
                INDEX_STATUS_SPOTLIGHT_UNAVAILABLE
            }
        } else if error.contains("macos_fsevents") {
            INDEX_STATUS_FSEVENTS_UNAVAILABLE
        } else {
            INDEX_STATUS_UNAVAILABLE
        };
        sink.set_source_state(volume_id, status, Some(error))?;
        Ok(GlobalIndexError::Provider(error.to_string()))
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
        sink.mark_volume_entries_stale(&source.volume.id)?;
        let summary = Self::stream_spotlight_entries(sink, &source.volume.id, cancel)?;
        Self::record_collection_state(sink, &source.volume.id, summary)?;
        self.baseline_established.store(true, Ordering::Release);
        if let Err(error) = self.start_watchers(
            &source.volume.id,
            source
                .volume
                .journal_cursor
                .as_deref()
                .and_then(|value| value.parse::<u64>().ok()),
        ) {
            let error = error.to_string();
            return Err(Self::report_native_error(sink, &source.volume.id, &error)?);
        }
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
            return Err(Self::report_native_error(sink, &source.volume.id, &error)?);
        }
        let needs_baseline_reconcile = !self.baseline_established.load(Ordering::Acquire);
        if pending.full_reconcile || needs_baseline_reconcile {
            sink.mark_volume_entries_stale(&source.volume.id)?;
            let summary = Self::stream_spotlight_entries(sink, &source.volume.id, cancel)?;
            Self::record_collection_state(sink, &source.volume.id, summary)?;
            self.baseline_established.store(true, Ordering::Release);
        } else {
            for entry_id in pending.stale_entry_ids {
                sink.mark_entry_stale(&entry_id)?;
            }
            Self::write_entries(sink, &pending.entries)?;
        }
        if let Some(event_id) = pending.last_event_id {
            let event_id = event_id.to_string();
            sink.checkpoint(&source.volume.id, None, Some(&event_id))?;
        }
        if let Err(error) = self.start_watchers(
            &source.volume.id,
            source
                .volume
                .journal_cursor
                .as_deref()
                .and_then(|value| value.parse::<u64>().ok()),
        ) {
            let error = error.to_string();
            return Err(Self::report_native_error(sink, &source.volume.id, &error)?);
        }
        Ok(())
    }

    fn pause(&self) -> Result<(), GlobalIndexError> {
        self.stopped.store(true, Ordering::Release);
        self.baseline_established.store(false, Ordering::Release);
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
            pending.last_event_id = None;
        }
        self.baseline_established.store(false, Ordering::Release);
        Ok(())
    }
}
