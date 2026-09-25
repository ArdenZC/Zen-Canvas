pub mod fallback;
pub mod mft;
pub mod service;
pub mod service_host;
pub mod usn;
pub mod volumes;

use crate::global_index::coordinator::{GlobalIndexError, GlobalIndexProvider, GlobalIndexSink};
use crate::global_index::models::{
    GlobalSourceDescriptor, INDEX_STATUS_PERMISSION_REQUIRED, INDEX_STATUS_REBUILD_REQUIRED,
    INDEX_STATUS_UNAVAILABLE, PROVIDER_WINDOWS_MFT_USN,
};
use crate::global_index::wake::{GlobalIndexWakeReason, GlobalIndexWakeSlot};
use service::{
    IndexServiceCommand, IndexServiceEvent, IndexServiceLookupResponse, IndexServiceRequest,
    IndexServiceResponse,
};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};

/// The provider used by the installed Windows service. It never calls the
/// service pipe, which prevents the service process from recursively routing
/// its own MFT/USN work back through the desktop transport.
pub struct DirectWindowsGlobalIndexProvider {}

impl DirectWindowsGlobalIndexProvider {
    pub fn new() -> Self {
        Self {}
    }
}

impl Default for DirectWindowsGlobalIndexProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl GlobalIndexProvider for DirectWindowsGlobalIndexProvider {
    fn discover_sources(&self) -> Result<Vec<GlobalSourceDescriptor>, GlobalIndexError> {
        volumes::discover_windows_volumes()
    }

    fn start_initial_index(
        &self,
        source: &GlobalSourceDescriptor,
        sink: &mut dyn GlobalIndexSink,
        cancel: &AtomicBool,
    ) -> Result<(), GlobalIndexError> {
        if source.volume.provider != PROVIDER_WINDOWS_MFT_USN {
            let message = format!(
                "windows_global_index_unsupported_filesystem:{}",
                source.volume.filesystem_type
            );
            sink.set_source_state(&source.volume.id, INDEX_STATUS_UNAVAILABLE, Some(&message))?;
            return Ok(());
        }
        sink.set_source_provider(&source.volume.id, PROVIDER_WINDOWS_MFT_USN)?;
        sink.mark_volume_entries_stale(&source.volume.id)?;
        let _qos = crate::resource_governor::scope_thread_qos(
            crate::file_workspace::WorkClass::Background,
        );
        match mft::enumerate_volume(source, sink, cancel) {
            Ok(_) => Ok(()),
            Err(GlobalIndexError::Paused) => Err(GlobalIndexError::Paused),
            Err(error) if mft::is_integrity_error(&error) => {
                let message = error.to_string();
                sink.set_source_state(
                    &source.volume.id,
                    INDEX_STATUS_REBUILD_REQUIRED,
                    Some(&message),
                )?;
                Err(error)
            }
            Err(error) => {
                let message = error.to_string();
                sink.set_source_state(
                    &source.volume.id,
                    INDEX_STATUS_PERMISSION_REQUIRED,
                    Some(&message),
                )?;
                Err(error)
            }
        }
    }

    fn resume_incremental_sync(
        &self,
        source: &GlobalSourceDescriptor,
        sink: &mut dyn GlobalIndexSink,
        cancel: &AtomicBool,
    ) -> Result<(), GlobalIndexError> {
        if source.volume.provider != PROVIDER_WINDOWS_MFT_USN {
            let message = format!(
                "windows_global_index_unsupported_filesystem:{}",
                source.volume.filesystem_type
            );
            sink.set_source_state(&source.volume.id, INDEX_STATUS_UNAVAILABLE, Some(&message))?;
            return Ok(());
        }
        sink.set_source_provider(&source.volume.id, PROVIDER_WINDOWS_MFT_USN)?;
        let result = match usn::sync_volume(source, sink, cancel) {
            Ok(result) => result,
            Err(GlobalIndexError::Paused) => return Err(GlobalIndexError::Paused),
            Err(error) if error.to_string().contains("rebuild required") => return Err(error),
            Err(error) => {
                let message = error.to_string();
                sink.set_source_state(
                    &source.volume.id,
                    INDEX_STATUS_PERMISSION_REQUIRED,
                    Some(&message),
                )?;
                return Err(error);
            }
        };
        if result.directory_path_changed {
            // A directory rename changes every descendant path. USN gives us
            // the durable signal. Queue an admitted MFT rebuild on the next
            // coordinator cycle instead of scanning inside this incremental
            // drain.
            sink.mark_volume_entries_stale(&source.volume.id)?;
            sink.set_source_state(
                &source.volume.id,
                INDEX_STATUS_REBUILD_REQUIRED,
                Some("USN directory rename requires an MFT reconciliation"),
            )?;
            return Err(GlobalIndexError::Provider(
                "USN directory rename requires an MFT reconciliation".to_string(),
            ));
        }
        Ok(())
    }

    fn pause(&self) -> Result<(), GlobalIndexError> {
        Ok(())
    }

    fn status(&self) -> Result<String, GlobalIndexError> {
        Ok("windows_mft_usn".to_string())
    }

    fn shutdown(&self) -> Result<(), GlobalIndexError> {
        Ok(())
    }
}

/// Desktop-side provider. The normal route is the installed service over a
/// versioned named pipe. If the service is not installed, stopped, or cannot
/// be reached, the desktop keeps the existing direct provider as a bounded
/// least-privilege fallback so search remains usable in development and
/// recovery scenarios.
pub struct WindowsGlobalIndexProvider {
    direct: DirectWindowsGlobalIndexProvider,
    service_available: AtomicBool,
    wake: std::sync::Arc<GlobalIndexWakeSlot>,
    database_path: PathBuf,
    change_watchers: Mutex<HashMap<String, fallback::ChangeSignalWatcher>>,
    #[cfg(test)]
    force_direct: bool,
    #[cfg(test)]
    smoke_ignored_wake_root: Option<PathBuf>,
}

impl WindowsGlobalIndexProvider {
    pub fn new() -> Self {
        Self::with_wake(
            std::sync::Arc::new(GlobalIndexWakeSlot::default()),
            PathBuf::new(),
        )
    }

    pub(crate) fn with_wake(
        wake: std::sync::Arc<GlobalIndexWakeSlot>,
        database_path: PathBuf,
    ) -> Self {
        Self {
            direct: DirectWindowsGlobalIndexProvider::new(),
            service_available: AtomicBool::new(false),
            wake,
            database_path,
            change_watchers: Mutex::new(HashMap::new()),
            #[cfg(test)]
            force_direct: false,
            #[cfg(test)]
            smoke_ignored_wake_root: None,
        }
    }

    #[cfg(test)]
    pub(crate) fn with_direct_native_smoke(
        wake: std::sync::Arc<GlobalIndexWakeSlot>,
        database_path: PathBuf,
        ignored_wake_root: PathBuf,
    ) -> Self {
        Self {
            direct: DirectWindowsGlobalIndexProvider::new(),
            service_available: AtomicBool::new(false),
            wake,
            database_path,
            change_watchers: Mutex::new(HashMap::new()),
            force_direct: true,
            smoke_ignored_wake_root: Some(ignored_wake_root),
        }
    }

    fn ensure_native_change_watcher(
        &self,
        source: &GlobalSourceDescriptor,
    ) -> Result<(), GlobalIndexError> {
        if source.volume.provider != PROVIDER_WINDOWS_MFT_USN {
            return Ok(());
        }
        let mut watchers = self.change_watchers.lock().map_err(|_| {
            GlobalIndexError::Provider("Windows Global Index watcher lock poisoned".to_string())
        })?;
        if let Some(watcher) = watchers.get(&source.volume.id) {
            return if watcher.has_failed() {
                Err(GlobalIndexError::Provider(
                    "windows_global_index_change_watcher_failed".to_string(),
                ))
            } else {
                Ok(())
            };
        }
        let ignored_database_path = self
            .database_path
            .is_absolute()
            .then(|| self.database_path.clone());
        #[cfg(test)]
        let watcher = if let Some(ignored_root) = &self.smoke_ignored_wake_root {
            fallback::ChangeSignalWatcher::start_ignoring_test_root(
                Path::new(&source.volume.mount_path),
                self.wake.clone(),
                ignored_database_path,
                ignored_root.clone(),
            )?
        } else {
            fallback::ChangeSignalWatcher::start(
                Path::new(&source.volume.mount_path),
                self.wake.clone(),
                ignored_database_path,
            )?
        };
        #[cfg(not(test))]
        let watcher = fallback::ChangeSignalWatcher::start(
            Path::new(&source.volume.mount_path),
            self.wake.clone(),
            ignored_database_path,
        )?;
        watchers.insert(source.volume.id.clone(), watcher);
        Ok(())
    }

    fn clear_native_change_watcher(&self, source_id: &str) {
        if let Ok(mut watchers) = self.change_watchers.lock() {
            watchers.remove(source_id);
        }
    }

    fn clear_native_change_watchers(&self) {
        if let Ok(mut watchers) = self.change_watchers.lock() {
            watchers.clear();
        }
    }

    fn run_source_request(
        &self,
        request: &IndexServiceRequest,
        source: &GlobalSourceDescriptor,
        sink: &mut dyn GlobalIndexSink,
        direct: impl FnOnce(
            &DirectWindowsGlobalIndexProvider,
            &mut dyn GlobalIndexSink,
        ) -> Result<(), GlobalIndexError>,
    ) -> Result<(), GlobalIndexError> {
        self.ensure_native_change_watcher(source)?;
        self.run_with_fallback(request, sink, direct)
    }

    fn service_failed(&self) {
        self.service_available.store(false, Ordering::Release);
    }

    fn service_connected(&self) {
        self.service_available.store(true, Ordering::Release);
    }

    fn service_response_error(response: &IndexServiceResponse) -> GlobalIndexError {
        GlobalIndexError::Provider(
            response
                .message
                .clone()
                .or_else(|| response.error_code.clone())
                .unwrap_or_else(|| "Windows index service request failed".to_string()),
        )
    }

    fn source_request(
        command: IndexServiceCommand,
        source: &GlobalSourceDescriptor,
    ) -> IndexServiceRequest {
        IndexServiceRequest::new(command, Some(source.volume.clone()))
    }

    fn apply_event(
        sink: &mut dyn GlobalIndexSink,
        client: &mut service::IndexServiceClient,
        event: IndexServiceEvent,
    ) -> Result<(), String> {
        match event {
            IndexServiceEvent::Entries { entries } => sink
                .write_batch(&entries)
                .map(|_| ())
                .map_err(|error| error.to_string()),
            IndexServiceEvent::EntryStale { entry_id } => sink
                .mark_entry_stale(&entry_id)
                .map_err(|error| error.to_string()),
            IndexServiceEvent::VolumeEntriesStale { volume_id } => sink
                .mark_volume_entries_stale(&volume_id)
                .map_err(|error| error.to_string()),
            IndexServiceEvent::Checkpoint {
                volume_id,
                journal_id,
                journal_cursor,
            } => sink
                .checkpoint(&volume_id, journal_id.as_deref(), journal_cursor.as_deref())
                .map_err(|error| error.to_string()),
            IndexServiceEvent::SourceState {
                volume_id,
                status,
                error,
            } => sink
                .set_source_state(&volume_id, &status, error.as_deref())
                .map_err(|error| error.to_string()),
            IndexServiceEvent::SourceProvider {
                volume_id,
                provider,
            } => sink
                .set_source_provider(&volume_id, &provider)
                .map_err(|error| error.to_string()),
            IndexServiceEvent::ResolveParentPath {
                lookup_id,
                volume_id,
                parent_platform_file_id,
            } => {
                let path = sink
                    .resolve_parent_path(&volume_id, &parent_platform_file_id)
                    .map_err(|error| error.to_string())?;
                client.send_lookup_response(IndexServiceLookupResponse::ParentPath {
                    lookup_id,
                    path,
                })
            }
            IndexServiceEvent::FindEntryByIdentity {
                lookup_id,
                volume_id,
                platform_file_id,
                parent_platform_file_id,
                name,
            } => {
                let entry = sink
                    .find_entry_by_identity(
                        &volume_id,
                        &platform_file_id,
                        &parent_platform_file_id,
                        &name,
                    )
                    .map_err(|error| error.to_string())?;
                client.send_lookup_response(IndexServiceLookupResponse::Entry {
                    lookup_id,
                    entry: Box::new(entry),
                })
            }
            IndexServiceEvent::Sources { .. } => Ok(()),
        }
    }

    fn run_service_stream(
        &self,
        request: &IndexServiceRequest,
        sink: &mut dyn GlobalIndexSink,
    ) -> Result<Result<(), GlobalIndexError>, String> {
        let response = service::call_index_service_stream(request, |client, event| {
            Self::apply_event(sink, client, event)
        })?;
        self.service_connected();
        if response.ok {
            Ok(Ok(()))
        } else {
            Ok(Err(Self::service_response_error(&response)))
        }
    }

    fn run_with_fallback(
        &self,
        request: &IndexServiceRequest,
        sink: &mut dyn GlobalIndexSink,
        direct: impl FnOnce(
            &DirectWindowsGlobalIndexProvider,
            &mut dyn GlobalIndexSink,
        ) -> Result<(), GlobalIndexError>,
    ) -> Result<(), GlobalIndexError> {
        #[cfg(test)]
        if self.force_direct {
            return direct(&self.direct, sink);
        }
        match self.run_service_stream(request, sink) {
            Ok(Ok(())) => Ok(()),
            Ok(Err(error)) => Err(error),
            Err(error) => {
                self.service_failed();
                let _ = sink.set_source_state(
                    request
                        .source
                        .as_ref()
                        .map(|source| source.id.as_str())
                        .unwrap_or_default(),
                    crate::global_index::models::INDEX_STATUS_UNAVAILABLE,
                    Some(&error),
                );
                direct(&self.direct, sink)
            }
        }
    }
}

impl Default for WindowsGlobalIndexProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl GlobalIndexProvider for WindowsGlobalIndexProvider {
    fn discover_sources(&self) -> Result<Vec<GlobalSourceDescriptor>, GlobalIndexError> {
        #[cfg(test)]
        if self.force_direct {
            return self.direct.discover_sources();
        }
        let request = IndexServiceRequest::new(IndexServiceCommand::DiscoverSources, None);
        let mut sources = None;
        match service::call_index_service_stream(&request, |_client, event| {
            if let IndexServiceEvent::Sources {
                sources: discovered,
            } = event
            {
                sources = Some(discovered);
            }
            Ok(())
        }) {
            Ok(response) if response.ok => {
                self.service_connected();
                Ok(sources
                    .unwrap_or_default()
                    .into_iter()
                    .map(|volume| GlobalSourceDescriptor { volume })
                    .collect())
            }
            Ok(response) => Err(Self::service_response_error(&response)),
            Err(_) => {
                self.service_failed();
                self.direct.discover_sources()
            }
        }
    }

    fn start_initial_index(
        &self,
        source: &GlobalSourceDescriptor,
        sink: &mut dyn GlobalIndexSink,
        cancel: &AtomicBool,
    ) -> Result<(), GlobalIndexError> {
        let request = Self::source_request(
            IndexServiceCommand::StartInitialIndex {
                source_id: source.volume.id.clone(),
            },
            source,
        );
        self.run_source_request(&request, source, sink, |direct, sink| {
            direct.start_initial_index(source, sink, cancel)
        })
    }

    fn resume_incremental_sync(
        &self,
        source: &GlobalSourceDescriptor,
        sink: &mut dyn GlobalIndexSink,
        cancel: &AtomicBool,
    ) -> Result<(), GlobalIndexError> {
        let request = Self::source_request(
            IndexServiceCommand::ResumeIncrementalSync {
                source_id: source.volume.id.clone(),
            },
            source,
        );
        self.run_source_request(&request, source, sink, |direct, sink| {
            direct.resume_incremental_sync(source, sink, cancel)
        })
    }

    fn pause(&self) -> Result<(), GlobalIndexError> {
        self.clear_native_change_watchers();
        let request = IndexServiceRequest::new(IndexServiceCommand::Pause, None);
        match service::call_index_service(&request) {
            Ok(response) if response.ok => {
                self.service_connected();
                Ok(())
            }
            Ok(response) => Err(Self::service_response_error(&response)),
            Err(_) => {
                self.service_failed();
                self.direct.pause()
            }
        }
    }

    fn status(&self) -> Result<String, GlobalIndexError> {
        let request = IndexServiceRequest::new(IndexServiceCommand::Status, None);
        match service::call_index_service(&request) {
            Ok(response) if response.ok => {
                self.service_connected();
                Ok(format!(
                    "windows_index_service:{}",
                    response.status.unwrap_or_else(|| "ready".to_string())
                ))
            }
            Ok(response) => Err(Self::service_response_error(&response)),
            Err(_) => {
                self.service_failed();
                Ok(format!("{}:service_unavailable", self.direct.status()?))
            }
        }
    }

    fn shutdown(&self) -> Result<(), GlobalIndexError> {
        self.clear_native_change_watchers();
        // The installed service is independent of the desktop lifetime. Stop
        // only its active operation when the UI exits; the SCM owns service
        // process lifetime and installer/uninstaller owns registration.
        let _ = self.pause();
        self.direct.shutdown()
    }

    fn topology_audit_interval(&self) -> Option<std::time::Duration> {
        Some(std::time::Duration::from_secs(5 * 60))
    }

    fn audit_source_topology(
        &self,
    ) -> Result<Option<Vec<GlobalSourceDescriptor>>, GlobalIndexError> {
        volumes::discover_windows_volumes().map(Some)
    }

    fn source_enabled_changed(&self, source_id: &str, enabled: bool) {
        self.clear_native_change_watcher(source_id);
        if enabled {
            self.wake.notify(GlobalIndexWakeReason::ExplicitCommand);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::global_index::models::GlobalVolume;

    #[test]
    fn direct_provider_status_does_not_claim_service_transport() {
        assert_eq!(
            DirectWindowsGlobalIndexProvider::new()
                .status()
                .expect("direct status"),
            "windows_mft_usn"
        );
    }

    #[test]
    fn service_request_keeps_persisted_source_checkpoint() {
        let source = GlobalSourceDescriptor {
            volume: GlobalVolume {
                id: "volume".to_string(),
                platform: "windows".to_string(),
                stable_volume_id: "stable".to_string(),
                display_name: "C".to_string(),
                mount_path: "C:\\".to_string(),
                filesystem_type: "ntfs".to_string(),
                drive_kind: "fixed".to_string(),
                enabled: true,
                provider: PROVIDER_WINDOWS_MFT_USN.to_string(),
                index_status: "ready".to_string(),
                last_error: None,
                journal_id: Some("journal".to_string()),
                journal_cursor: Some("42".to_string()),
                last_full_index_at: Some(1),
                last_incremental_sync_at: Some(2),
                entry_count: 3,
                created_at: 0,
                updated_at: 0,
            },
        };
        let request = WindowsGlobalIndexProvider::source_request(
            IndexServiceCommand::ResumeIncrementalSync {
                source_id: "volume".to_string(),
            },
            &source,
        );
        assert_eq!(request.source, Some(source.volume));
    }
}
