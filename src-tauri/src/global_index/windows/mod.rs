pub mod fallback;
pub mod mft;
pub mod service;
pub mod usn;
pub mod volumes;

use crate::global_index::coordinator::{GlobalIndexError, GlobalIndexProvider, GlobalIndexSink};
use crate::global_index::models::{GlobalSourceDescriptor, PROVIDER_WINDOWS_MFT_USN};
use std::sync::atomic::{AtomicBool, Ordering};

pub struct WindowsGlobalIndexProvider {
    stopped: AtomicBool,
}

impl WindowsGlobalIndexProvider {
    pub fn new() -> Self {
        Self {
            stopped: AtomicBool::new(false),
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
            match mft::enumerate_volume(source, sink, cancel) {
                Ok(_) => Ok(()),
                Err(error) => {
                    sink.set_source_state(
                        &source.volume.id,
                        crate::global_index::models::INDEX_STATUS_PERMISSION_REQUIRED,
                        Some(&error.to_string()),
                    )?;
                    Err(error)
                }
            }
        } else {
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
            sink.mark_volume_entries_stale(&source.volume.id)?;
            return fallback::index_volume(source, sink, cancel);
        }
        let result = usn::sync_volume(source, sink, cancel)?;
        if result.directory_path_changed {
            // A directory rename changes every descendant path.  USN gives us
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
