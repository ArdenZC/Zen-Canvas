use super::preview::WorkspacePreviewResolver;
use crate::{
    db::Database,
    file_workspace::{
        browse::BrowseService,
        change::EphemeralChangeMonitor,
        read_gate::{MaterializationReadGate, ReadGateConfig},
        thumbnail::{
            MacQuickLookThumbnailRenderer, ThumbnailRenderer, ThumbnailService,
            ThumbnailServiceConfig, ThumbnailTask,
        },
    },
    platform::macos::quick_look::MacThumbnailService,
    scheduler::WorkScheduler,
};
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};
use uuid::Uuid;

pub(crate) const MAX_BROWSE_SESSIONS: usize = 32;
pub(crate) const MAX_CHANGE_MONITORS: usize = 32;
pub(crate) const MAX_PREVIEW_SESSIONS: usize = 32;
pub(crate) const MAX_THUMBNAIL_TASKS: usize = 128;

pub(crate) struct BrowseRecord {
    pub(crate) info: super::super::browse::BrowseSessionInfo,
    pub(crate) display_name: String,
}

pub(crate) struct MonitorRecord {
    pub(crate) session_id: String,
    pub(crate) monitor: Arc<EphemeralChangeMonitor>,
}

pub(crate) struct RuntimeInner {
    pub(crate) database: Database,
    pub(crate) browse: Arc<BrowseService>,
    pub(crate) read_gate: Arc<MaterializationReadGate>,
    // Retain the exact global scheduler reference as part of the integration
    // ownership record; ThumbnailService receives the same Arc above.
    #[allow(dead_code)]
    pub(crate) scheduler: Arc<WorkScheduler>,
    pub(crate) thumbnail: Arc<ThumbnailService>,
    pub(crate) preview_resolver: Arc<WorkspacePreviewResolver>,
    pub(crate) sessions: Mutex<HashMap<String, BrowseRecord>>,
    pub(crate) monitors: Mutex<HashMap<String, MonitorRecord>>,
    pub(crate) thumbnail_tasks: Mutex<HashMap<String, Arc<ThumbnailTask>>>,
    pub(crate) preview_sessions: Mutex<HashMap<String, crate::file_workspace::PreviewSession>>,
    disposed: AtomicBool,
}

/// Process-local ownership for the W1-10 adapters.  The services referenced by
/// this object remain the authorities for their domains; these maps only keep
/// command-addressable lifecycle handles alive.
pub struct FileWorkspaceRuntime {
    pub(crate) inner: Arc<RuntimeInner>,
}

impl FileWorkspaceRuntime {
    pub fn new(
        database: Database,
        legacy_thumbnail_service: MacThumbnailService,
        thumbnail_cache_dir: PathBuf,
    ) -> Result<Self, String> {
        let browse = Arc::new(BrowseService::default());
        let read_gate = Arc::new(
            MaterializationReadGate::from_workspace_sources(
                database.clone(),
                Arc::clone(&browse),
                ReadGateConfig::default(),
            )
            .map_err(|error| format!("workspace_read_gate_{error}"))?,
        );
        let scheduler = WorkScheduler::global();
        let renderer: Arc<dyn ThumbnailRenderer> =
            Arc::new(MacQuickLookThumbnailRenderer::new(legacy_thumbnail_service));
        let thumbnail_read_gate: Arc<dyn crate::file_workspace::ThumbnailReadGate> =
            read_gate.clone();
        let thumbnail = Arc::new(
            ThumbnailService::new(
                thumbnail_read_gate,
                Arc::clone(&scheduler),
                renderer,
                Some(thumbnail_cache_dir),
                ThumbnailServiceConfig::default(),
            )
            .map_err(|error| format!("workspace_thumbnail_{error}"))?,
        );
        let preview_resolver = Arc::new(WorkspacePreviewResolver::new(
            database.clone(),
            Arc::clone(&browse),
            Arc::clone(&read_gate),
        ));

        Ok(Self {
            inner: Arc::new(RuntimeInner {
                database,
                browse,
                read_gate,
                scheduler,
                thumbnail,
                preview_resolver,
                sessions: Mutex::new(HashMap::new()),
                monitors: Mutex::new(HashMap::new()),
                thumbnail_tasks: Mutex::new(HashMap::new()),
                preview_sessions: Mutex::new(HashMap::new()),
                disposed: AtomicBool::new(false),
            }),
        })
    }

    pub(crate) fn ensure_live(&self) -> Result<(), String> {
        if self.inner.disposed.load(Ordering::Acquire) {
            Err("file_workspace_runtime_disposed".to_string())
        } else {
            Ok(())
        }
    }

    pub(crate) fn next_id(prefix: &str) -> String {
        format!("{prefix}-{}", Uuid::new_v4())
    }

    pub fn dispose(&self) -> bool {
        dispose_inner(&self.inner)
    }
}

impl Drop for RuntimeInner {
    fn drop(&mut self) {
        dispose_inner_fields(self);
    }
}

fn dispose_inner(inner: &Arc<RuntimeInner>) -> bool {
    if inner.disposed.swap(true, Ordering::AcqRel) {
        return false;
    }
    dispose_inner_fields(inner);
    true
}

fn dispose_inner_fields(inner: &RuntimeInner) {
    let monitors = take_map(&inner.monitors);
    for record in monitors.into_values() {
        record.monitor.dispose();
    }

    let previews = take_map(&inner.preview_sessions);
    for session in previews.into_values() {
        session.dispose();
    }

    let thumbnail_tasks = take_map(&inner.thumbnail_tasks);
    for task in thumbnail_tasks.into_values() {
        let _ = task.cancel();
    }

    let sessions = take_map(&inner.sessions);
    for record in sessions.into_values() {
        let _ = inner.browse.dispose_session(&record.info.session_id);
    }

    inner.thumbnail.dispose();
    inner.read_gate.dispose();
}

fn take_map<T>(map: &Mutex<HashMap<String, T>>) -> HashMap<String, T> {
    map.lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .drain()
        .collect()
}
