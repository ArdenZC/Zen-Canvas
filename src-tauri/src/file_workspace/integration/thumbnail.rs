use super::{
    runtime::{FileWorkspaceRuntime, ThumbnailRegistration, MAX_THUMBNAIL_TASKS},
    types::{ThumbnailArtifactDto, ThumbnailCancelRequest, ThumbnailRequestDto},
};
use crate::file_workspace::{
    thumbnail::{validate_source_shape, ThumbnailError, ThumbnailRequest},
    BrowseEntryRef, EntryRef,
};
use std::sync::Arc;

impl FileWorkspaceRuntime {
    pub(crate) fn request_thumbnail(
        &self,
        request: ThumbnailRequestDto,
    ) -> Result<ThumbnailArtifactDto, String> {
        self.ensure_live()?;
        let request_id = request.request_id.clone();
        {
            let mut tasks = self
                .inner
                .thumbnail_tasks
                .lock()
                .map_err(|_| "workspace_thumbnail_state_unavailable".to_string())?;
            if tasks.contains_key(&request_id) {
                return Err("thumbnail_request_in_flight".to_string());
            }
            if tasks.len() >= MAX_THUMBNAIL_TASKS {
                return Err("thumbnail_request_capacity_exceeded".to_string());
            }
            // Reserve the caller id and capacity before any ThumbnailService
            // admission or filesystem-backed source resolution. Cancellation
            // can therefore address a request during registration, and a
            // duplicate cannot create a second unaddressable owner.
            tasks.insert(
                request_id.clone(),
                ThumbnailRegistration::Reserved {
                    cancel_requested: false,
                },
            );
        }

        #[cfg(test)]
        self.pause_after_thumbnail_reservation();

        let cancelled_before_service_admission = {
            let mut tasks = self
                .inner
                .thumbnail_tasks
                .lock()
                .map_err(|_| "workspace_thumbnail_state_unavailable".to_string())?;
            match tasks.get(&request_id) {
                Some(ThumbnailRegistration::Reserved {
                    cancel_requested: true,
                }) => {
                    tasks.remove(&request_id);
                    true
                }
                Some(ThumbnailRegistration::Reserved { .. }) => false,
                Some(ThumbnailRegistration::Running { .. }) => false,
                None => return Err("workspace_thumbnail_request_disposed".to_string()),
            }
        };
        if cancelled_before_service_admission {
            return Err(map_thumbnail_error(ThumbnailError::Cancelled));
        }

        let mut thumbnail_request = ThumbnailRequest::new(
            request_id.clone(),
            request.source,
            request.variant.into(),
            request.work_class,
        );
        if let Some(session_id) = request.session_id {
            thumbnail_request = thumbnail_request.with_session_id(session_id);
        }
        if let Err(error) = validate_source_shape(&thumbnail_request) {
            let mut tasks = self
                .inner
                .thumbnail_tasks
                .lock()
                .map_err(|_| "workspace_thumbnail_state_unavailable".to_string())?;
            if matches!(
                tasks.get(&request_id),
                Some(ThumbnailRegistration::Reserved { .. })
            ) {
                tasks.remove(&request_id);
            }
            return Err(map_thumbnail_error(error));
        }

        let source_generation = match resolve_browse_source_generation(
            &self.inner.browse,
            &thumbnail_request.source,
            thumbnail_request.session_id.as_deref(),
        ) {
            Ok(generation) => generation,
            Err(error) => {
                let mut tasks = self
                    .inner
                    .thumbnail_tasks
                    .lock()
                    .map_err(|_| "workspace_thumbnail_state_unavailable".to_string())?;
                if matches!(
                    tasks.get(&request_id),
                    Some(ThumbnailRegistration::Reserved { .. })
                ) {
                    tasks.remove(&request_id);
                }
                return Err(error);
            }
        };

        if let Some(generation) = source_generation {
            thumbnail_request = thumbnail_request.with_authoritative_source_generation(generation);
        }
        let task = match self.inner.thumbnail.request(thumbnail_request) {
            Ok(task) => task,
            Err(error) => {
                let mut tasks = self
                    .inner
                    .thumbnail_tasks
                    .lock()
                    .map_err(|_| "workspace_thumbnail_state_unavailable".to_string())?;
                let cancelled = matches!(
                    tasks.get(&request_id),
                    Some(ThumbnailRegistration::Reserved {
                        cancel_requested: true,
                    })
                );
                if matches!(
                    tasks.get(&request_id),
                    Some(ThumbnailRegistration::Reserved { .. })
                ) {
                    tasks.remove(&request_id);
                }
                if cancelled {
                    return Err(map_thumbnail_error(ThumbnailError::Cancelled));
                }
                return Err(map_thumbnail_error(error));
            }
        };
        let task = Arc::new(task);
        let cancel_requested = {
            let mut tasks = self
                .inner
                .thumbnail_tasks
                .lock()
                .map_err(|_| "workspace_thumbnail_state_unavailable".to_string())?;
            let Some(registration) = tasks.get_mut(&request_id) else {
                // Runtime disposal may have drained the reservation while the
                // service task was being admitted. The task is no longer
                // addressable and must not publish.
                let _ = task.cancel();
                return Err("workspace_thumbnail_request_disposed".to_string());
            };
            let cancel_requested = registration.cancel_requested();
            *registration = ThumbnailRegistration::Running {
                task: Arc::clone(&task),
                cancel_requested,
            };
            cancel_requested
        };
        if cancel_requested {
            let _ = task.cancel();
        }

        // ThumbnailTask is a shared, one-shot result. The request command may
        // wait here while a separate cancel command revokes only this owner.
        let joined = task.join();
        let mut tasks = self
            .inner
            .thumbnail_tasks
            .lock()
            .map_err(|_| "workspace_thumbnail_state_unavailable".to_string())?;
        let was_cancelled = tasks.get(&request_id).is_some_and(|registration| {
            matches!(
                registration,
                ThumbnailRegistration::Running {
                    task: current,
                    cancel_requested: true,
                } if Arc::ptr_eq(current, &task)
            )
        });
        if tasks.get(&request_id).is_some_and(|registration| {
            matches!(
                registration,
                ThumbnailRegistration::Running { task: current, .. }
                    if Arc::ptr_eq(current, &task)
            )
        }) {
            tasks.remove(&request_id);
        }
        if was_cancelled {
            return Err(map_thumbnail_error(ThumbnailError::Cancelled));
        }
        joined
            .map(ThumbnailArtifactDto::from)
            .map_err(map_thumbnail_error)
    }

    pub(crate) fn cancel_thumbnail(&self, request: ThumbnailCancelRequest) -> Result<bool, String> {
        self.ensure_live()?;
        let mut tasks = self
            .inner
            .thumbnail_tasks
            .lock()
            .map_err(|_| "workspace_thumbnail_state_unavailable".to_string())?;
        let Some(registration) = tasks.get_mut(&request.request_id) else {
            return Ok(false);
        };
        match registration {
            ThumbnailRegistration::Reserved { cancel_requested } => {
                if *cancel_requested {
                    Ok(false)
                } else {
                    *cancel_requested = true;
                    Ok(true)
                }
            }
            ThumbnailRegistration::Running {
                task,
                cancel_requested,
            } => {
                if *cancel_requested {
                    return Ok(false);
                }
                let cancelled = task.cancel();
                if cancelled {
                    *cancel_requested = true;
                }
                Ok(cancelled)
            }
        }
    }
}

fn resolve_browse_source_generation(
    browse: &crate::file_workspace::browse::BrowseService,
    source: &EntryRef,
    session_id: Option<&str>,
) -> Result<Option<String>, String> {
    let EntryRef::Ephemeral {
        browse_session_id,
        entry_id,
    } = source
    else {
        return Ok(None);
    };

    if session_id.is_some_and(|session| session != browse_session_id) {
        return Err("thumbnail_request_invalid".to_string());
    }

    let browse_ref = BrowseEntryRef::Ephemeral {
        browse_session_id: browse_session_id.clone(),
        entry_id: entry_id.clone(),
    };
    browse
        .resolve_entry_generation(&browse_ref)
        .map(Some)
        .map_err(|_| "thumbnail_source_unavailable".to_string())
}

fn map_thumbnail_error(error: ThumbnailError) -> String {
    match error {
        ThumbnailError::InvalidRequest => "thumbnail_request_invalid".to_string(),
        ThumbnailError::UnsupportedRenderer => "thumbnail_renderer_unsupported".to_string(),
        ThumbnailError::UnsupportedSource => "thumbnail_source_unsupported".to_string(),
        ThumbnailError::MaterializationRequired => "thumbnail_materialization_required".to_string(),
        ThumbnailError::Downloading => "thumbnail_source_downloading".to_string(),
        ThumbnailError::SourceUnavailable => "thumbnail_source_unavailable".to_string(),
        ThumbnailError::PermissionDenied => "thumbnail_permission_denied".to_string(),
        ThumbnailError::UnknownSource => "thumbnail_source_unknown".to_string(),
        ThumbnailError::IdentityChanged => "thumbnail_source_identity_changed".to_string(),
        ThumbnailError::SchedulerBackpressure => "thumbnail_scheduler_backpressure".to_string(),
        ThumbnailError::SchedulerUnavailable => "thumbnail_scheduler_unavailable".to_string(),
        ThumbnailError::Cancelled => "thumbnail_request_cancelled".to_string(),
        ThumbnailError::Timeout => "thumbnail_generation_timeout".to_string(),
        ThumbnailError::RendererFailed => "thumbnail_renderer_failed".to_string(),
        ThumbnailError::Disposed => "thumbnail_service_disposed".to_string(),
    }
}
