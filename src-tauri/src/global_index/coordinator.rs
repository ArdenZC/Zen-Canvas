use super::models::*;
use crate::db::{Database, DbError};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread::{self, JoinHandle};
use std::time::Duration;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum GlobalIndexError {
    #[error("database error: {0}")]
    Database(#[from] DbError),
    #[error("provider error: {0}")]
    Provider(String),
    #[error("indexing paused")]
    Paused,
}

pub trait GlobalIndexSink: Send {
    fn write_batch(&mut self, entries: &[GlobalEntryInput]) -> Result<usize, GlobalIndexError>;
    fn mark_entry_stale(&mut self, entry_id: &str) -> Result<(), GlobalIndexError>;
    fn checkpoint(
        &mut self,
        volume_id: &str,
        journal_id: Option<&str>,
        journal_cursor: Option<&str>,
    ) -> Result<(), GlobalIndexError>;
    fn set_source_state(
        &mut self,
        volume_id: &str,
        status: &str,
        error: Option<&str>,
    ) -> Result<(), GlobalIndexError>;
    fn set_source_provider(
        &mut self,
        volume_id: &str,
        provider: &str,
    ) -> Result<(), GlobalIndexError>;
    fn resolve_parent_path(
        &mut self,
        volume_id: &str,
        parent_platform_file_id: &str,
    ) -> Result<Option<String>, GlobalIndexError>;
    fn find_entry_by_identity(
        &mut self,
        volume_id: &str,
        platform_file_id: &str,
        parent_platform_file_id: &str,
        name: &str,
    ) -> Result<Option<GlobalEntry>, GlobalIndexError>;
    fn mark_volume_entries_stale(&mut self, volume_id: &str) -> Result<(), GlobalIndexError>;
}

pub trait GlobalIndexProvider: Send + Sync {
    fn discover_sources(&self) -> Result<Vec<GlobalSourceDescriptor>, GlobalIndexError>;
    fn start_initial_index(
        &self,
        source: &GlobalSourceDescriptor,
        sink: &mut dyn GlobalIndexSink,
        cancel: &AtomicBool,
    ) -> Result<(), GlobalIndexError>;
    fn resume_incremental_sync(
        &self,
        source: &GlobalSourceDescriptor,
        sink: &mut dyn GlobalIndexSink,
        cancel: &AtomicBool,
    ) -> Result<(), GlobalIndexError>;
    fn pause(&self) -> Result<(), GlobalIndexError>;
    fn rebuild(
        &self,
        source: &GlobalSourceDescriptor,
        sink: &mut dyn GlobalIndexSink,
        cancel: &AtomicBool,
    ) -> Result<(), GlobalIndexError> {
        self.start_initial_index(source, sink, cancel)
    }
    fn status(&self) -> Result<String, GlobalIndexError>;
    fn shutdown(&self) -> Result<(), GlobalIndexError>;
    fn incremental_poll_interval(&self) -> Duration {
        Duration::from_secs(2)
    }
}

#[derive(Debug, Default)]
struct CoordinatorState {
    running: bool,
    paused: bool,
    last_error: Option<String>,
}

#[derive(Clone)]
pub struct GlobalIndexCoordinator {
    db: Database,
    provider: Arc<dyn GlobalIndexProvider>,
    state: Arc<Mutex<CoordinatorState>>,
    cancel: Arc<AtomicBool>,
    worker: Arc<Mutex<Option<JoinHandle<()>>>>,
}

impl GlobalIndexCoordinator {
    pub fn new(db: Database) -> Self {
        Self {
            db,
            provider: Arc::from(platform_provider()),
            state: Arc::new(Mutex::new(CoordinatorState::default())),
            cancel: Arc::new(AtomicBool::new(false)),
            worker: Arc::new(Mutex::new(None)),
        }
    }

    pub fn start(&self) -> Result<(), GlobalIndexError> {
        {
            let mut state = self.state.lock().map_err(|_| {
                GlobalIndexError::Provider("coordinator state lock poisoned".to_string())
            })?;
            if state.running {
                state.paused = false;
                return Ok(());
            }
            state.running = true;
            state.paused = false;
            state.last_error = None;
        }
        self.cancel.store(false, Ordering::Release);
        let db = self.db.clone();
        let provider = self.provider.clone();
        let state = self.state.clone();
        let cancel = self.cancel.clone();
        let worker = thread::Builder::new()
            .name("zen-canvas-global-index".to_string())
            .spawn(move || {
                let result = run_index(provider, db, cancel.clone());
                if let Ok(mut state) = state.lock() {
                    state.running = false;
                    state.paused = cancel.load(Ordering::Acquire);
                    state.last_error = result.err().map(|error| error.to_string());
                }
            })
            .map_err(|error| {
                GlobalIndexError::Provider(format!("failed to start index worker: {error}"))
            })?;
        if let Ok(mut slot) = self.worker.lock() {
            if let Some(previous) = slot.take() {
                let _ = previous.join();
            }
            *slot = Some(worker);
        }
        Ok(())
    }

    pub fn pause(&self) -> Result<(), GlobalIndexError> {
        self.cancel.store(true, Ordering::Release);
        self.provider.pause()?;
        if let Ok(mut slot) = self.worker.lock() {
            if let Some(worker) = slot.take() {
                let _ = worker.join();
            }
        }
        let mut state = self.state.lock().map_err(|_| {
            GlobalIndexError::Provider("coordinator state lock poisoned".to_string())
        })?;
        state.paused = true;
        Ok(())
    }

    pub fn resume(&self) -> Result<(), GlobalIndexError> {
        self.cancel.store(false, Ordering::Release);
        self.start()
    }

    pub fn rebuild(&self, source_id: Option<String>) -> Result<(), GlobalIndexError> {
        let discovered = self.provider.discover_sources()?;
        let discovered_by_id = discovered
            .into_iter()
            .map(|source| (source.volume.id.clone(), source.volume.provider))
            .collect::<HashMap<_, _>>();
        if let Some(id) = source_id {
            if let Some(provider) = discovered_by_id.get(&id) {
                self.db.update_global_volume_provider(&id, provider)?;
            }
            self.db.update_global_volume_state(
                &id,
                INDEX_STATUS_REBUILD_REQUIRED,
                None,
                None,
                None,
                None,
                None,
            )?;
            self.db.mark_global_entries_stale_for_volume(&id)?;
        } else {
            for volume in self.db.list_global_volumes()? {
                if let Some(provider) = discovered_by_id.get(&volume.id) {
                    self.db
                        .update_global_volume_provider(&volume.id, provider)?;
                }
                self.db.update_global_volume_state(
                    &volume.id,
                    INDEX_STATUS_REBUILD_REQUIRED,
                    None,
                    None,
                    None,
                    None,
                    None,
                )?;
                self.db.mark_global_entries_stale_for_volume(&volume.id)?;
            }
        }
        self.start()
    }

    pub fn set_source_enabled(
        &self,
        source_id: &str,
        enabled: bool,
    ) -> Result<(), GlobalIndexError> {
        self.db.set_global_volume_enabled(source_id, enabled)?;
        Ok(())
    }

    pub fn status(&self) -> Result<GlobalIndexStatus, GlobalIndexError> {
        Ok(self.db.global_index_status()?)
    }

    pub fn shutdown(&self) -> Result<(), GlobalIndexError> {
        self.cancel.store(true, Ordering::Release);
        self.provider.shutdown()?;
        if let Ok(mut slot) = self.worker.lock() {
            if let Some(worker) = slot.take() {
                let _ = worker.join();
            }
        }
        if let Ok(mut state) = self.state.lock() {
            state.running = false;
            state.paused = true;
        }
        Ok(())
    }

    pub fn provider_status(&self) -> Result<String, GlobalIndexError> {
        self.provider.status()
    }
}

struct DatabaseIndexSink {
    db: Database,
}

impl GlobalIndexSink for DatabaseIndexSink {
    fn write_batch(&mut self, entries: &[GlobalEntryInput]) -> Result<usize, GlobalIndexError> {
        self.db
            .upsert_global_entries_batch(entries)
            .map_err(GlobalIndexError::from)
    }

    fn mark_entry_stale(&mut self, entry_id: &str) -> Result<(), GlobalIndexError> {
        self.db.mark_global_entry_stale(entry_id)?;
        Ok(())
    }

    fn checkpoint(
        &mut self,
        volume_id: &str,
        journal_id: Option<&str>,
        journal_cursor: Option<&str>,
    ) -> Result<(), GlobalIndexError> {
        self.db.update_global_volume_state(
            volume_id,
            INDEX_STATUS_SYNCING,
            None,
            journal_id,
            journal_cursor,
            None,
            None,
        )?;
        Ok(())
    }

    fn set_source_state(
        &mut self,
        volume_id: &str,
        status: &str,
        error: Option<&str>,
    ) -> Result<(), GlobalIndexError> {
        self.db
            .update_global_volume_state(volume_id, status, error, None, None, None, None)?;
        Ok(())
    }

    fn set_source_provider(
        &mut self,
        volume_id: &str,
        provider: &str,
    ) -> Result<(), GlobalIndexError> {
        self.db
            .update_global_volume_provider(volume_id, provider)
            .map_err(GlobalIndexError::from)
    }

    fn resolve_parent_path(
        &mut self,
        volume_id: &str,
        parent_platform_file_id: &str,
    ) -> Result<Option<String>, GlobalIndexError> {
        Ok(self
            .db
            .global_path_by_platform_identity(volume_id, parent_platform_file_id)?)
    }

    fn find_entry_by_identity(
        &mut self,
        volume_id: &str,
        platform_file_id: &str,
        parent_platform_file_id: &str,
        name: &str,
    ) -> Result<Option<GlobalEntry>, GlobalIndexError> {
        Ok(self.db.global_entry_by_identity(
            volume_id,
            platform_file_id,
            parent_platform_file_id,
            name,
        )?)
    }

    fn mark_volume_entries_stale(&mut self, volume_id: &str) -> Result<(), GlobalIndexError> {
        self.db.mark_global_entries_stale_for_volume(volume_id)?;
        Ok(())
    }
}

fn run_index(
    provider: Arc<dyn GlobalIndexProvider>,
    db: Database,
    cancel: Arc<AtomicBool>,
) -> Result<(), GlobalIndexError> {
    // Providers keep their native watchers alive between cycles. The
    // coordinator only polls the provider boundary, which lets USN, Spotlight
    // notifications, and recursive-fallback watcher signals all enter the
    // same transactional database sink without blocking the UI thread.
    while !cancel.load(Ordering::Acquire) {
        let discovered = provider.discover_sources()?;
        for source in &discovered {
            db.upsert_global_volume(&source.volume)?;
        }
        let discovered_by_id = discovered
            .into_iter()
            .map(|source| (source.volume.id.clone(), source))
            .collect::<HashMap<_, _>>();
        let volumes = db.list_global_volumes()?;
        let mut sink = DatabaseIndexSink { db: db.clone() };
        for volume in volumes {
            if cancel.load(Ordering::Acquire) {
                break;
            }
            if !volume.enabled {
                continue;
            }
            let Some(discovered_source) = discovered_by_id.get(&volume.id) else {
                if volume.index_status != INDEX_STATUS_UNAVAILABLE
                    || volume.last_error.as_deref() != Some("global_index_source_unavailable")
                {
                    db.update_global_volume_state(
                        &volume.id,
                        INDEX_STATUS_UNAVAILABLE,
                        Some("global_index_source_unavailable"),
                        None,
                        None,
                        None,
                        None,
                    )?;
                    db.mark_global_entries_stale_for_volume(&volume.id)?;
                }
                continue;
            };
            let source_reappeared = volume.index_status == INDEX_STATUS_UNAVAILABLE
                && volume.last_error.as_deref() == Some("global_index_source_unavailable");
            let mut source = discovered_source.clone();
            // Discovery returns current platform capabilities. The persisted
            // volume contributes only durable indexing state and user choices,
            // including a deliberate recursive-fallback provider decision.
            source.volume.enabled = volume.enabled;
            source.volume.index_status = volume.index_status.clone();
            source.volume.last_error = volume.last_error.clone();
            source.volume.journal_id = volume.journal_id.clone();
            source.volume.journal_cursor = volume.journal_cursor.clone();
            source.volume.last_full_index_at = volume.last_full_index_at;
            source.volume.last_incremental_sync_at = volume.last_incremental_sync_at;
            source.volume.entry_count = volume.entry_count;
            source.volume.created_at = volume.created_at;
            if volume.provider == PROVIDER_WINDOWS_RECURSIVE_FALLBACK
                && discovered_source.volume.provider == PROVIDER_WINDOWS_MFT_USN
            {
                source.volume.provider = volume.provider.clone();
            }
            db.update_global_volume_state(
                &volume.id,
                if volume.last_full_index_at.is_some()
                    && !source_reappeared
                    && volume.index_status != INDEX_STATUS_REBUILD_REQUIRED
                {
                    INDEX_STATUS_SYNCING
                } else {
                    INDEX_STATUS_INDEXING
                },
                (volume.index_status == INDEX_STATUS_PERMISSION_REQUIRED)
                    .then_some(volume.last_error.as_deref())
                    .flatten(),
                None,
                None,
                None,
                None,
            )?;
            let result = if volume.last_full_index_at.is_some()
                && !source_reappeared
                && volume.index_status != INDEX_STATUS_REBUILD_REQUIRED
            {
                provider.resume_incremental_sync(&source, &mut sink, &cancel)
            } else if volume.index_status == INDEX_STATUS_REBUILD_REQUIRED {
                provider.rebuild(&source, &mut sink, &cancel)
            } else {
                provider.start_initial_index(&source, &mut sink, &cancel)
            };
            match result {
                Ok(()) => {
                    let now = unix_now();
                    let current = db.get_global_volume(&volume.id).ok().flatten();
                    let permission_required = volume.index_status
                        == INDEX_STATUS_PERMISSION_REQUIRED
                        || current.as_ref().is_some_and(|current| {
                            current.index_status == INDEX_STATUS_PERMISSION_REQUIRED
                        });
                    let preserved_error = if permission_required {
                        current
                            .as_ref()
                            .and_then(|current| current.last_error.as_deref())
                            .or(volume.last_error.as_deref())
                    } else {
                        None
                    };
                    db.update_global_volume_state(
                        &volume.id,
                        if cancel.load(Ordering::Acquire) {
                            INDEX_STATUS_PAUSED
                        } else if permission_required {
                            INDEX_STATUS_PERMISSION_REQUIRED
                        } else {
                            INDEX_STATUS_READY
                        },
                        preserved_error,
                        None,
                        None,
                        if volume.last_full_index_at.is_some() && !source_reappeared {
                            None
                        } else {
                            Some(now)
                        },
                        Some(now),
                    )?;
                }
                Err(GlobalIndexError::Paused) if cancel.load(Ordering::Acquire) => {
                    db.update_global_volume_state(
                        &volume.id,
                        INDEX_STATUS_PAUSED,
                        None,
                        None,
                        None,
                        None,
                        None,
                    )?;
                    break;
                }
                Err(error) => {
                    let preserved_status = db
                        .get_global_volume(&volume.id)
                        .ok()
                        .flatten()
                        .map(|current| current.index_status)
                        .filter(|status| {
                            status == INDEX_STATUS_PERMISSION_REQUIRED
                                || status == INDEX_STATUS_REBUILD_REQUIRED
                        });
                    db.update_global_volume_state(
                        &volume.id,
                        preserved_status.as_deref().unwrap_or(INDEX_STATUS_ERROR),
                        Some(&error.to_string()),
                        None,
                        None,
                        None,
                        None,
                    )?;
                }
            }
        }
        if !wait_for_next_reconcile(&cancel, provider.incremental_poll_interval()) {
            break;
        }
    }
    Ok(())
}

fn wait_for_next_reconcile(cancel: &AtomicBool, interval: Duration) -> bool {
    let step = Duration::from_millis(100);
    let steps = (interval.as_millis() / step.as_millis()).max(1) as usize;
    for _ in 0..steps {
        if cancel.load(Ordering::Acquire) {
            return false;
        }
        thread::sleep(step);
    }
    true
}

fn platform_provider() -> Box<dyn GlobalIndexProvider> {
    #[cfg(target_os = "windows")]
    {
        Box::new(crate::global_index::windows::WindowsGlobalIndexProvider::new())
    }
    #[cfg(all(not(target_os = "windows"), target_os = "macos"))]
    {
        Box::new(crate::global_index::macos::MacosSpotlightProvider::new())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Box::new(RecursiveFallbackProvider::new())
    }
}

pub struct RecursiveFallbackProvider {
    stopped: AtomicBool,
}

impl RecursiveFallbackProvider {
    pub fn new() -> Self {
        Self {
            stopped: AtomicBool::new(false),
        }
    }
}

impl Default for RecursiveFallbackProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl GlobalIndexProvider for RecursiveFallbackProvider {
    fn discover_sources(&self) -> Result<Vec<GlobalSourceDescriptor>, GlobalIndexError> {
        let root = if cfg!(windows) {
            PathBuf::from("C:\\")
        } else {
            PathBuf::from("/")
        };
        let mount_path = root.to_string_lossy().into_owned();
        let stable_volume_id = format!("{}-root", std::env::consts::OS);
        let now = unix_now();
        Ok(vec![GlobalSourceDescriptor {
            volume: GlobalVolume {
                id: format!("gv_{}", blake3::hash(stable_volume_id.as_bytes()).to_hex()),
                platform: std::env::consts::OS.to_string(),
                stable_volume_id,
                display_name: mount_path.clone(),
                mount_path,
                filesystem_type: "unknown".to_string(),
                drive_kind: "fixed".to_string(),
                enabled: true,
                provider: PROVIDER_RECURSIVE_FALLBACK.to_string(),
                index_status: INDEX_STATUS_DISCOVERED.to_string(),
                last_error: None,
                journal_id: None,
                journal_cursor: None,
                last_full_index_at: None,
                last_incremental_sync_at: None,
                entry_count: 0,
                created_at: now,
                updated_at: now,
            },
        }])
    }

    fn start_initial_index(
        &self,
        source: &GlobalSourceDescriptor,
        sink: &mut dyn GlobalIndexSink,
        cancel: &AtomicBool,
    ) -> Result<(), GlobalIndexError> {
        self.stopped.store(false, Ordering::Release);
        let mut batch = Vec::with_capacity(512);
        walk_directory(
            Path::new(&source.volume.mount_path),
            &mut batch,
            sink,
            cancel,
            &self.stopped,
        )?;
        if !batch.is_empty() {
            sink.write_batch(&batch)?;
        }
        Ok(())
    }

    fn resume_incremental_sync(
        &self,
        source: &GlobalSourceDescriptor,
        sink: &mut dyn GlobalIndexSink,
        cancel: &AtomicBool,
    ) -> Result<(), GlobalIndexError> {
        // Recursive fallback has no durable journal.  A reconciliation scan is
        // explicit in the provider status and is kept separate from MFT/USN.
        self.start_initial_index(source, sink, cancel)
    }

    fn pause(&self) -> Result<(), GlobalIndexError> {
        self.stopped.store(true, Ordering::Release);
        Ok(())
    }

    fn status(&self) -> Result<String, GlobalIndexError> {
        Ok(PROVIDER_RECURSIVE_FALLBACK.to_string())
    }

    fn shutdown(&self) -> Result<(), GlobalIndexError> {
        self.stopped.store(true, Ordering::Release);
        Ok(())
    }

    fn incremental_poll_interval(&self) -> Duration {
        Duration::from_secs(30)
    }
}

fn walk_directory(
    root: &Path,
    batch: &mut Vec<GlobalEntryInput>,
    sink: &mut dyn GlobalIndexSink,
    cancel: &AtomicBool,
    stopped: &AtomicBool,
) -> Result<(), GlobalIndexError> {
    if cancel.load(Ordering::Acquire) || stopped.load(Ordering::Acquire) {
        return Err(GlobalIndexError::Paused);
    }
    let entries = match fs::read_dir(root) {
        Ok(entries) => entries,
        Err(_) => return Ok(()),
    };
    let volume_id = format!(
        "gv_{}",
        blake3::hash(format!("{}-root", std::env::consts::OS).as_bytes()).to_hex()
    );
    for item in entries {
        if cancel.load(Ordering::Acquire) || stopped.load(Ordering::Acquire) {
            return Err(GlobalIndexError::Paused);
        }
        let item = match item {
            Ok(item) => item,
            Err(_) => continue,
        };
        let path = item.path();
        let input = GlobalEntryInput::from_path(&volume_id, &path, PROVIDER_RECURSIVE_FALLBACK);
        let is_directory = item.file_type().map(|kind| kind.is_dir()).unwrap_or(false);
        batch.push(input);
        if batch.len() >= 512 {
            sink.write_batch(batch)?;
            batch.clear();
        }
        if is_directory {
            walk_directory(&path, batch, sink, cancel, stopped)?;
        }
    }
    Ok(())
}
