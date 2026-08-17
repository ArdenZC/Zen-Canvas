use super::{
    runtime::{FileWorkspaceRuntime, MonitorRecord, MAX_CHANGE_MONITORS},
    types::{
        BrowsePageDto, ChangePendingRequest, ChangePendingResponse, ChangeRefreshRequest,
        ChangeStartRequest, ChangeStartResponse,
    },
};
use crate::file_workspace::change::{EphemeralChangeError, EphemeralChangeMonitor};
use std::sync::Arc;

impl FileWorkspaceRuntime {
    pub(crate) fn start_change_monitor(
        &self,
        request: ChangeStartRequest,
    ) -> Result<ChangeStartResponse, String> {
        self.ensure_live()?;
        if !self.has_browse_session(&request.session_id) {
            return Err("browse_session_not_found".to_string());
        }
        {
            let monitors = self
                .inner
                .monitors
                .lock()
                .map_err(|_| "workspace_monitor_state_unavailable".to_string())?;
            if monitors.len() >= MAX_CHANGE_MONITORS {
                return Err("ephemeral_change_monitor_capacity_exceeded".to_string());
            }
        }

        // Starting a native watcher is intentionally outside the registry
        // mutex. The BrowseService resolves the opaque target and remains the
        // only source of backend path truth.
        let monitor = EphemeralChangeMonitor::start(
            Arc::clone(&self.inner.browse),
            request.session_id.clone(),
            request.path_ref.clone(),
        )
        .map_err(map_change_error)?;
        let monitor = Arc::new(monitor);
        let monitor_id = FileWorkspaceRuntime::next_id("change");
        let mut monitors = self
            .inner
            .monitors
            .lock()
            .map_err(|_| "workspace_monitor_state_unavailable".to_string())?;
        if monitors.len() >= MAX_CHANGE_MONITORS {
            drop(monitors);
            monitor.dispose();
            return Err("ephemeral_change_monitor_capacity_exceeded".to_string());
        }
        monitors.insert(
            monitor_id.clone(),
            MonitorRecord {
                session_id: request.session_id.clone(),
                monitor,
            },
        );
        Ok(ChangeStartResponse {
            monitor_id,
            session_id: request.session_id,
            path_ref: request.path_ref,
        })
    }

    pub(crate) fn pending_change(
        &self,
        request: ChangePendingRequest,
    ) -> Result<Option<ChangePendingResponse>, String> {
        self.ensure_live()?;
        let monitor = self
            .inner
            .monitors
            .lock()
            .map_err(|_| "workspace_monitor_state_unavailable".to_string())?
            .get(&request.monitor_id)
            .map(|record| Arc::clone(&record.monitor))
            .ok_or_else(|| "ephemeral_change_monitor_not_found".to_string())?;
        Ok(monitor
            .pending_refresh()
            .map(|pending| ChangePendingResponse {
                monitor_id: request.monitor_id,
                sequence: pending.sequence,
                hint: pending.hint.into(),
            }))
    }

    pub(crate) fn refresh_change(
        &self,
        request: ChangeRefreshRequest,
    ) -> Result<BrowsePageDto, String> {
        self.ensure_live()?;
        let monitor = self
            .inner
            .monitors
            .lock()
            .map_err(|_| "workspace_monitor_state_unavailable".to_string())?
            .get(&request.monitor_id)
            .map(|record| Arc::clone(&record.monitor))
            .ok_or_else(|| "ephemeral_change_monitor_not_found".to_string())?;
        monitor
            .refresh(request.request_id, request.page_size)
            .map(BrowsePageDto::from_internal)
            .map_err(map_change_error)
    }

    pub(crate) fn dispose_change_monitor(
        &self,
        request: ChangePendingRequest,
    ) -> Result<(), String> {
        self.ensure_live()?;
        let monitor = self
            .inner
            .monitors
            .lock()
            .map_err(|_| "workspace_monitor_state_unavailable".to_string())?
            .remove(&request.monitor_id)
            .map(|record| record.monitor)
            .ok_or_else(|| "ephemeral_change_monitor_not_found".to_string())?;
        monitor.dispose();
        Ok(())
    }
}

fn map_change_error(error: EphemeralChangeError) -> String {
    match error {
        EphemeralChangeError::Browse(error) | EphemeralChangeError::InvalidationFailed(error) => {
            error.to_string()
        }
        EphemeralChangeError::Disposed => "ephemeral_change_monitor_disposed".to_string(),
        EphemeralChangeError::RefreshNotPending => {
            "ephemeral_change_refresh_not_pending".to_string()
        }
        EphemeralChangeError::RefreshSuperseded => {
            "ephemeral_change_refresh_superseded".to_string()
        }
        EphemeralChangeError::WatcherStart(_) => {
            "ephemeral_change_watcher_start_failed".to_string()
        }
        EphemeralChangeError::ThreadStart(_) => "ephemeral_change_thread_start_failed".to_string(),
    }
}
