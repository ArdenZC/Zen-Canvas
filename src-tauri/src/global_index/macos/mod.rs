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
    normalize_path, GlobalEntryInput, GlobalSourceDescriptor, GlobalVolume,
    INDEX_STATUS_FSEVENTS_UNAVAILABLE, INDEX_STATUS_PERMISSION_REQUIRED, INDEX_STATUS_READY,
    INDEX_STATUS_SPOTLIGHT_EXTERNAL_NOT_INDEXED, INDEX_STATUS_SPOTLIGHT_NOT_INDEXED,
    INDEX_STATUS_SPOTLIGHT_UNAVAILABLE, INDEX_STATUS_UNAVAILABLE,
    PROVIDER_MACOS_FSEVENTS_RECONCILE, PROVIDER_MACOS_SPOTLIGHT,
};
use std::collections::HashMap;
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
    known_entries: Arc<Mutex<HashMap<String, String>>>,
    spotlight_watcher: Mutex<Option<JoinHandle<()>>>,
    fsevents_watcher: Mutex<Option<fsevents::FseventsHandle>>,
    baseline_established: AtomicBool,
}

impl MacosSpotlightProvider {
    pub fn new() -> Self {
        Self {
            stopped: Arc::new(AtomicBool::new(false)),
            pending: Arc::new(Mutex::new(PendingUpdates::default())),
            known_entries: Arc::new(Mutex::new(HashMap::new())),
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
                    self.known_entries.clone(),
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

    fn remember_entries(&self, entries: &[GlobalEntryInput]) {
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
        sink: &mut dyn GlobalIndexSink,
        volume_id: &str,
        cancel: &AtomicBool,
    ) -> Result<spotlight::SpotlightCollectionSummary, GlobalIndexError> {
        match spotlight::stream_local_computer_entries(volume_id, cancel, |batch| {
            sink.write_batch(batch).map_err(|error| error.to_string())?;
            self.remember_entries(batch);
            Ok(())
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
        self.clear_known_entries();
        let summary = self.stream_spotlight_entries(sink, &source.volume.id, cancel)?;
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
            self.clear_known_entries();
            let summary = self.stream_spotlight_entries(sink, &source.volume.id, cancel)?;
            Self::record_collection_state(sink, &source.volume.id, summary)?;
            self.baseline_established.store(true, Ordering::Release);
        } else {
            for entry_id in pending.stale_entry_ids {
                sink.mark_entry_stale(&entry_id)?;
                self.forget_entry_id(&entry_id);
            }
            self.write_entries(sink, &pending.entries)?;
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
        self.clear_known_entries();
        self.baseline_established.store(false, Ordering::Release);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::global_index::coordinator::GlobalIndexError;
    use crate::global_index::models::{
        GlobalEntry, INDEX_STATUS_FSEVENTS_UNAVAILABLE, INDEX_STATUS_PERMISSION_REQUIRED,
        INDEX_STATUS_READY, INDEX_STATUS_SPOTLIGHT_EXTERNAL_NOT_INDEXED,
        INDEX_STATUS_SPOTLIGHT_NOT_INDEXED, INDEX_STATUS_SPOTLIGHT_UNAVAILABLE,
    };

    #[derive(Default)]
    struct RecordingSink {
        statuses: Vec<(String, String, Option<String>)>,
        batch_lengths: Vec<usize>,
    }

    impl GlobalIndexSink for RecordingSink {
        fn write_batch(&mut self, entries: &[GlobalEntryInput]) -> Result<usize, GlobalIndexError> {
            self.batch_lengths.push(entries.len());
            Ok(entries.len())
        }

        fn mark_entry_stale(&mut self, _entry_id: &str) -> Result<(), GlobalIndexError> {
            Ok(())
        }

        fn checkpoint(
            &mut self,
            _volume_id: &str,
            _journal_id: Option<&str>,
            _journal_cursor: Option<&str>,
        ) -> Result<(), GlobalIndexError> {
            Ok(())
        }

        fn set_source_state(
            &mut self,
            volume_id: &str,
            status: &str,
            error: Option<&str>,
        ) -> Result<(), GlobalIndexError> {
            self.statuses.push((
                volume_id.to_string(),
                status.to_string(),
                error.map(ToString::to_string),
            ));
            Ok(())
        }

        fn set_source_provider(
            &mut self,
            _volume_id: &str,
            _provider: &str,
        ) -> Result<(), GlobalIndexError> {
            Ok(())
        }

        fn resolve_parent_path(
            &mut self,
            _volume_id: &str,
            _parent_platform_file_id: &str,
        ) -> Result<Option<String>, GlobalIndexError> {
            Ok(None)
        }

        fn find_entry_by_identity(
            &mut self,
            _volume_id: &str,
            _platform_file_id: &str,
            _parent_platform_file_id: &str,
            _name: &str,
        ) -> Result<Option<GlobalEntry>, GlobalIndexError> {
            Ok(None)
        }

        fn mark_volume_entries_stale(&mut self, _volume_id: &str) -> Result<(), GlobalIndexError> {
            Ok(())
        }
    }

    fn input(index: usize) -> GlobalEntryInput {
        GlobalEntryInput {
            volume_id: "volume".to_string(),
            platform_file_id: format!("mac:dev:1:ino:{index}"),
            parent_platform_file_id: "mac:dev:1:ino:1".to_string(),
            name: format!("file-{index}.txt"),
            path: format!("/tmp/file-{index}.txt"),
            extension: "txt".to_string(),
            is_directory: false,
            size: 1,
            created_at_fs: None,
            modified_at_fs: None,
            file_attributes: 0,
            is_hidden: false,
            is_system: false,
            source_provider: PROVIDER_MACOS_SPOTLIGHT.to_string(),
            last_seen_at: index as i64,
        }
    }

    #[test]
    fn macos_spotlight_batches_use_the_shared_sink_contract() {
        let entries = (0..1025).map(input).collect::<Vec<_>>();
        let mut sink = RecordingSink::default();
        MacosSpotlightProvider::write_entries(&mut sink, &entries).expect("write batches");
        assert_eq!(sink.batch_lengths, vec![512, 512, 1]);
    }

    #[test]
    fn macos_collection_states_distinguish_unavailable_permission_and_partial_results() {
        let cases = [
            (
                spotlight::SpotlightCollectionSummary::default(),
                INDEX_STATUS_SPOTLIGHT_NOT_INDEXED,
            ),
            (
                spotlight::SpotlightCollectionSummary {
                    processed: 1,
                    ..Default::default()
                },
                INDEX_STATUS_READY,
            ),
            (
                spotlight::SpotlightCollectionSummary {
                    processed: 1,
                    full_disk_access_required: true,
                    ..Default::default()
                },
                INDEX_STATUS_PERMISSION_REQUIRED,
            ),
            (
                spotlight::SpotlightCollectionSummary {
                    processed: 1,
                    external_volume_not_indexed: true,
                    ..Default::default()
                },
                INDEX_STATUS_SPOTLIGHT_EXTERNAL_NOT_INDEXED,
            ),
            (
                spotlight::SpotlightCollectionSummary {
                    processed: 1,
                    path_fallbacks: 1,
                    ..Default::default()
                },
                INDEX_STATUS_PERMISSION_REQUIRED,
            ),
            (
                spotlight::SpotlightCollectionSummary {
                    processed: 1,
                    skipped: 1,
                    ..Default::default()
                },
                INDEX_STATUS_PERMISSION_REQUIRED,
            ),
        ];
        for (summary, expected_status) in cases {
            let mut sink = RecordingSink::default();
            MacosSpotlightProvider::record_collection_state(&mut sink, "volume", summary)
                .expect("record collection state");
            assert_eq!(
                sink.statuses.last().map(|value| value.1.as_str()),
                Some(expected_status)
            );
        }
    }

    #[test]
    fn macos_native_error_mapping_keeps_permission_and_spotlight_states_distinct() {
        let cases = [
            (
                "macos_spotlight_query_unavailable",
                INDEX_STATUS_SPOTLIGHT_UNAVAILABLE,
            ),
            (
                "macos_spotlight_full_disk_access_required",
                INDEX_STATUS_PERMISSION_REQUIRED,
            ),
            (
                "macos_spotlight_external_volume_not_indexed",
                INDEX_STATUS_SPOTLIGHT_EXTERNAL_NOT_INDEXED,
            ),
            (
                "macos_fsevents_stream_unavailable",
                INDEX_STATUS_FSEVENTS_UNAVAILABLE,
            ),
        ];
        for (error, expected_status) in cases {
            let mut sink = RecordingSink::default();
            let returned = MacosSpotlightProvider::report_native_error(&mut sink, "volume", error)
                .expect("native error mapping");
            assert!(returned.to_string().contains(error));
            assert_eq!(
                sink.statuses.last().map(|value| value.1.as_str()),
                Some(expected_status)
            );
        }
    }

    #[test]
    fn macos_bridge_lifecycle_is_idempotent_and_shutdown_clears_native_state() {
        let provider = MacosSpotlightProvider::new();
        assert!(provider.status().is_ok());
        provider.pause().expect("pause provider");
        provider.pause().expect("pause provider twice");
        provider.shutdown().expect("shutdown provider");
        provider.shutdown().expect("shutdown provider twice");
    }
}
