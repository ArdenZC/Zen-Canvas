pub mod fallback;
pub mod mft;
pub mod service;
pub mod service_host;
pub mod usn;
pub mod volumes;

use crate::global_index::coordinator::{GlobalIndexError, GlobalIndexProvider, GlobalIndexSink};
use crate::global_index::models::{
    GlobalSourceDescriptor, INDEX_STATUS_PERMISSION_REQUIRED, PROVIDER_WINDOWS_MFT_USN,
    PROVIDER_WINDOWS_RECURSIVE_FALLBACK,
};
use service::{
    IndexServiceCommand, IndexServiceEvent, IndexServiceLookupResponse, IndexServiceRequest,
    IndexServiceResponse,
};
use std::sync::atomic::{AtomicBool, Ordering};

/// The provider used by the installed Windows service. It never calls the
/// service pipe, which prevents the service process from recursively routing
/// its own MFT/USN work back through the desktop transport.
pub struct DirectWindowsGlobalIndexProvider {
    stopped: AtomicBool,
}

impl DirectWindowsGlobalIndexProvider {
    pub fn new() -> Self {
        Self {
            stopped: AtomicBool::new(false),
        }
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
        self.stopped.store(false, Ordering::Release);
        sink.mark_volume_entries_stale(&source.volume.id)?;
        if source.volume.provider == PROVIDER_WINDOWS_MFT_USN {
            sink.set_source_provider(&source.volume.id, PROVIDER_WINDOWS_MFT_USN)?;
            match mft::enumerate_volume(source, sink, cancel) {
                Ok(_) => Ok(()),
                Err(GlobalIndexError::Paused) => Err(GlobalIndexError::Paused),
                Err(error) => {
                    let message = error.to_string();
                    sink.set_source_state(
                        &source.volume.id,
                        INDEX_STATUS_PERMISSION_REQUIRED,
                        Some(&message),
                    )?;
                    sink.set_source_provider(
                        &source.volume.id,
                        PROVIDER_WINDOWS_RECURSIVE_FALLBACK,
                    )?;
                    fallback::index_volume(source, sink, cancel)
                }
            }
        } else {
            sink.set_source_provider(&source.volume.id, PROVIDER_WINDOWS_RECURSIVE_FALLBACK)?;
            fallback::index_volume(source, sink, cancel)
        }
    }

    fn resume_incremental_sync(
        &self,
        source: &GlobalSourceDescriptor,
        sink: &mut dyn GlobalIndexSink,
        cancel: &AtomicBool,
    ) -> Result<(), GlobalIndexError> {
        if source.volume.provider != PROVIDER_WINDOWS_MFT_USN {
            sink.set_source_provider(&source.volume.id, PROVIDER_WINDOWS_RECURSIVE_FALLBACK)?;
            sink.mark_volume_entries_stale(&source.volume.id)?;
            return fallback::index_volume(source, sink, cancel);
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
                sink.set_source_provider(&source.volume.id, PROVIDER_WINDOWS_RECURSIVE_FALLBACK)?;
                sink.mark_volume_entries_stale(&source.volume.id)?;
                fallback::index_volume(source, sink, cancel)?;
                return Ok(());
            }
        };
        if result.directory_path_changed {
            // A directory rename changes every descendant path. USN gives us
            // the durable signal; MFT is then used to reconcile the complete
            // subtree so FTS never retains stale descendant paths.
            sink.mark_volume_entries_stale(&source.volume.id)?;
            mft::enumerate_volume(source, sink, cancel)?;
        }
        Ok(())
    }

    fn pause(&self) -> Result<(), GlobalIndexError> {
        self.stopped.store(true, Ordering::Release);
        Ok(())
    }

    fn status(&self) -> Result<String, GlobalIndexError> {
        Ok("windows_mft_usn_or_recursive_fallback".to_string())
    }

    fn shutdown(&self) -> Result<(), GlobalIndexError> {
        self.stopped.store(true, Ordering::Release);
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
}

impl WindowsGlobalIndexProvider {
    pub fn new() -> Self {
        Self {
            direct: DirectWindowsGlobalIndexProvider::new(),
            service_available: AtomicBool::new(false),
        }
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
        self.run_with_fallback(&request, sink, |direct, sink| {
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
        self.run_with_fallback(&request, sink, |direct, sink| {
            direct.resume_incremental_sync(source, sink, cancel)
        })
    }

    fn pause(&self) -> Result<(), GlobalIndexError> {
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
        // The installed service is independent of the desktop lifetime. Stop
        // only its active operation when the UI exits; the SCM owns service
        // process lifetime and installer/uninstaller owns registration.
        let _ = self.pause();
        self.direct.shutdown()
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
            "windows_mft_usn_or_recursive_fallback"
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
