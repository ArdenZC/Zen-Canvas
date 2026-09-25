use crate::global_index::coordinator::{GlobalIndexError, GlobalIndexSink};
use crate::global_index::models::{
    GlobalEntryInput, GlobalSourceDescriptor, INDEX_STATUS_PERMISSION_REQUIRED,
    PROVIDER_WINDOWS_RECURSIVE_FALLBACK,
};
use crate::global_index::wake::{GlobalIndexWakeReason, GlobalIndexWakeSlot};
use notify::{recommended_watcher, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

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

/// Windows native indexing uses filesystem events only as a coalesced wake
/// hint. Event paths are discarded and USN remains the row-change authority.
pub(crate) struct ChangeSignalWatcher {
    _watcher: Option<RecommendedWatcher>,
    failed: Arc<AtomicBool>,
}

impl ChangeSignalWatcher {
    pub(crate) fn start(
        root: &Path,
        wake: Arc<GlobalIndexWakeSlot>,
        ignored_database_path: Option<PathBuf>,
    ) -> Result<Self, GlobalIndexError> {
        Self::start_inner(root, wake, ignored_database_path, None)
    }

    #[cfg(test)]
    pub(crate) fn start_ignoring_test_root(
        root: &Path,
        wake: Arc<GlobalIndexWakeSlot>,
        ignored_database_path: Option<PathBuf>,
        ignored_event_root: PathBuf,
    ) -> Result<Self, GlobalIndexError> {
        Self::start_inner(root, wake, ignored_database_path, Some(ignored_event_root))
    }

    fn start_inner(
        root: &Path,
        wake: Arc<GlobalIndexWakeSlot>,
        ignored_database_path: Option<PathBuf>,
        ignored_event_root: Option<PathBuf>,
    ) -> Result<Self, GlobalIndexError> {
        let failed = Arc::new(AtomicBool::new(false));
        let failed_for_callback = failed.clone();
        let ignored_database_path = ignored_database_path.clone();
        let ignored_event_root = ignored_event_root.clone();
        let mut watcher = recommended_watcher(move |event: notify::Result<Event>| match event {
            Ok(event) => {
                let is_ignored_only = !event.paths.is_empty()
                    && event.paths.iter().all(|path| {
                        ignored_database_path
                            .as_deref()
                            .is_some_and(|database_path| is_database_artifact(path, database_path))
                            || ignored_event_root
                                .as_deref()
                                .is_some_and(|ignored_root| is_path_within(path, ignored_root))
                    });
                if !is_ignored_only {
                    wake.notify(GlobalIndexWakeReason::ProviderChange);
                }
            }
            Err(error) => {
                if !failed_for_callback.swap(true, Ordering::AcqRel) {
                    eprintln!("Windows Global Index change watcher failed: {error}");
                    wake.notify(GlobalIndexWakeReason::ProviderChange);
                }
            }
        })
        .map_err(|error| {
            GlobalIndexError::Provider(format!(
                "windows_global_index_change_watcher_start_failed: {error}"
            ))
        })?;
        watcher
            .watch(root, RecursiveMode::Recursive)
            .map_err(|error| {
                GlobalIndexError::Provider(format!(
                    "windows_global_index_change_watcher_watch_failed: {error}"
                ))
            })?;
        Ok(Self {
            _watcher: Some(watcher),
            failed,
        })
    }

    #[cfg(test)]
    pub(crate) fn new_for_test() -> Self {
        Self {
            _watcher: None,
            failed: Arc::new(AtomicBool::new(false)),
        }
    }

    #[cfg(test)]
    pub(crate) fn mark_failed_for_test(&self) {
        self.failed.store(true, Ordering::Release);
    }

    pub(crate) fn has_failed(&self) -> bool {
        self.failed.load(Ordering::Acquire)
    }
}

fn is_database_artifact(event_path: &Path, database_path: &Path) -> bool {
    let event_path = normalized_windows_path(event_path);
    let database_path = normalized_windows_path(database_path);
    event_path == database_path
        || ["-wal", "-shm", "-journal"]
            .iter()
            .any(|suffix| event_path == format!("{database_path}{suffix}"))
}

fn normalized_windows_path(path: &Path) -> String {
    let path = path.to_string_lossy().replace('/', "\\");
    let path = path.strip_prefix("\\\\?\\").unwrap_or(&path);
    path.to_ascii_lowercase()
}

fn is_path_within(path: &Path, root: &Path) -> bool {
    let path = normalized_windows_path(path);
    let root = normalized_windows_path(root);
    path == root
        || path
            .strip_prefix(&root)
            .is_some_and(|suffix| suffix.starts_with('\\'))
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
    use super::{is_database_artifact, *};

    #[test]
    fn fallback_provider_name_is_explicit() {
        assert_eq!(
            PROVIDER_WINDOWS_RECURSIVE_FALLBACK,
            "windows_recursive_fallback"
        );
    }

    #[test]
    fn native_change_signal_ignores_only_its_sqlite_artifacts() {
        let database = Path::new(r"C:\Users\test\AppData\Roaming\Zen\zen-canvas.sqlite3");
        assert!(is_database_artifact(database, database));
        assert!(is_database_artifact(
            Path::new(r"\\?\C:\Users\test\AppData\Roaming\Zen\zen-canvas.sqlite3-wal"),
            database
        ));
        assert!(is_database_artifact(
            Path::new(r"C:\Users\test\AppData\Roaming\Zen\zen-canvas.sqlite3-shm"),
            database
        ));
        assert!(!is_database_artifact(
            Path::new(r"C:\Users\test\AppData\Roaming\Zen\user.db"),
            database
        ));
        let staging_root = Path::new(r"F:\worktree\.tmp-tests\native-smoke\temp");
        assert!(is_path_within(
            Path::new(r"\\?\F:\worktree\.tmp-tests\native-smoke\temp\mft.sqlite"),
            staging_root
        ));
        assert!(!is_path_within(
            Path::new(r"F:\worktree\.tmp-tests\native-smoke\fixture\file.txt"),
            staging_root
        ));
    }
}
