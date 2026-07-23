use crate::global_index::coordinator::{GlobalIndexError, GlobalIndexSink};
use crate::global_index::models::{
    GlobalEntryInput, GlobalSourceDescriptor, INDEX_STATUS_PERMISSION_REQUIRED,
    PROVIDER_WINDOWS_RECURSIVE_FALLBACK,
};
use notify::{recommended_watcher, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::fs;
use std::path::Path;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    mpsc::{sync_channel, Receiver, TryRecvError, TrySendError},
    Arc,
};

const FALLBACK_WATCHER_CHANNEL_CAPACITY: usize = 2048;

#[derive(Default)]
struct FallbackScanSummary {
    inaccessible_directories: usize,
    first_error: Option<String>,
}

impl FallbackScanSummary {
    fn record(&mut self, path: &str, error: impl std::fmt::Display) {
        self.inaccessible_directories += 1;
        if self.first_error.is_none() {
            self.first_error = Some(format!("recursive fallback cannot read {path}: {error}"));
        }
    }
}

/// The recursive provider remains metadata-only. The watcher is only a
/// bounded change signal; the next reconciliation performs the authoritative
/// batched directory walk so overflow and rename edge cases cannot leave stale
/// paths in the global index.
pub(crate) struct ReconcileWatcher {
    _watcher: RecommendedWatcher,
    receiver: Receiver<notify::Result<Event>>,
    overflowed: Arc<AtomicBool>,
}

impl ReconcileWatcher {
    pub(crate) fn start(root: &Path) -> Result<Self, GlobalIndexError> {
        let (sender, receiver) = sync_channel(FALLBACK_WATCHER_CHANNEL_CAPACITY);
        let overflowed = Arc::new(AtomicBool::new(false));
        let overflowed_for_callback = overflowed.clone();
        let mut watcher = recommended_watcher(move |event| {
            if let Err(TrySendError::Full(_)) = sender.try_send(event) {
                overflowed_for_callback.store(true, Ordering::Release);
            }
        })
        .map_err(|error| {
            GlobalIndexError::Provider(format!(
                "windows_recursive_fallback_watcher_start_failed: {error}"
            ))
        })?;
        watcher
            .watch(root, RecursiveMode::Recursive)
            .map_err(|error| {
                GlobalIndexError::Provider(format!(
                    "windows_recursive_fallback_watcher_watch_failed: {error}"
                ))
            })?;
        Ok(Self {
            _watcher: watcher,
            receiver,
            overflowed,
        })
    }

    pub(crate) fn take_reconcile_signal(&self) -> Result<bool, GlobalIndexError> {
        let mut changed = self.overflowed.swap(false, Ordering::AcqRel);
        loop {
            match self.receiver.try_recv() {
                Ok(Ok(_event)) => changed = true,
                Ok(Err(error)) => {
                    return Err(GlobalIndexError::Provider(format!(
                        "windows_recursive_fallback_watcher_event_failed: {error}"
                    )))
                }
                Err(TryRecvError::Empty) => break,
                Err(TryRecvError::Disconnected) => {
                    return Err(GlobalIndexError::Provider(
                        "windows_recursive_fallback_watcher_disconnected".to_string(),
                    ))
                }
            }
        }
        Ok(changed)
    }
}

pub fn index_volume(
    source: &GlobalSourceDescriptor,
    sink: &mut dyn GlobalIndexSink,
    cancel: &AtomicBool,
) -> Result<(), GlobalIndexError> {
    let mut batch = Vec::with_capacity(512);
    let mut summary = FallbackScanSummary::default();
    walk(
        &source.volume.mount_path,
        &source.volume.id,
        &mut batch,
        sink,
        cancel,
        &mut summary,
    )?;
    if !batch.is_empty() {
        sink.write_batch(&batch)?;
    }
    if summary.inaccessible_directories > 0 {
        let message = format!(
            "{}; {} inaccessible directories were skipped",
            summary.first_error.unwrap_or_else(|| {
                "recursive fallback encountered inaccessible directories".to_string()
            }),
            summary.inaccessible_directories
        );
        sink.set_source_state(
            &source.volume.id,
            INDEX_STATUS_PERMISSION_REQUIRED,
            Some(&message),
        )?;
    }
    Ok(())
}

fn walk(
    path: &str,
    volume_id: &str,
    batch: &mut Vec<GlobalEntryInput>,
    sink: &mut dyn GlobalIndexSink,
    cancel: &AtomicBool,
    summary: &mut FallbackScanSummary,
) -> Result<(), GlobalIndexError> {
    if cancel.load(Ordering::Acquire) {
        return Err(GlobalIndexError::Paused);
    }
    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(error) => {
            summary.record(path, error);
            return Ok(());
        }
    };
    for item in entries {
        if cancel.load(Ordering::Acquire) {
            return Err(GlobalIndexError::Paused);
        }
        let item = match item {
            Ok(item) => item,
            Err(error) => {
                summary.record(path, error);
                continue;
            }
        };
        let item_path = item.path();
        let mut input =
            GlobalEntryInput::from_path(volume_id, &item_path, PROVIDER_WINDOWS_RECURSIVE_FALLBACK);
        input.source_provider = PROVIDER_WINDOWS_RECURSIVE_FALLBACK.to_string();
        let is_directory = item
            .file_type()
            .map(|value| value.is_dir())
            .unwrap_or(false);
        batch.push(input);
        if batch.len() >= 512 {
            sink.write_batch(batch)?;
            batch.clear();
        }
        if is_directory {
            let child = item_path.to_string_lossy().into_owned();
            walk(&child, volume_id, batch, sink, cancel, summary)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fallback_provider_name_is_explicit() {
        assert_eq!(
            PROVIDER_WINDOWS_RECURSIVE_FALLBACK,
            "windows_recursive_fallback"
        );
    }
}
