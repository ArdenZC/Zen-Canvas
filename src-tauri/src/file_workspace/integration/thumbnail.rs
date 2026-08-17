use super::{
    runtime::{FileWorkspaceRuntime, MAX_THUMBNAIL_TASKS},
    types::{ThumbnailArtifactDto, ThumbnailCancelRequest, ThumbnailRequestDto},
};
use crate::file_workspace::thumbnail::{ThumbnailError, ThumbnailRequest};
use std::sync::Arc;

impl FileWorkspaceRuntime {
    pub(crate) fn request_thumbnail(
        &self,
        request: ThumbnailRequestDto,
    ) -> Result<ThumbnailArtifactDto, String> {
        self.ensure_live()?;
        {
            let tasks = self
                .inner
                .thumbnail_tasks
                .lock()
                .map_err(|_| "workspace_thumbnail_state_unavailable".to_string())?;
            if tasks.contains_key(&request.request_id) {
                return Err("thumbnail_request_in_flight".to_string());
            }
            if tasks.len() >= MAX_THUMBNAIL_TASKS {
                return Err("thumbnail_request_capacity_exceeded".to_string());
            }
        }

        let mut thumbnail_request = ThumbnailRequest::new(
            request.request_id.clone(),
            request.source,
            request.variant.into(),
            request.work_class,
        );
        if let Some(session_id) = request.session_id {
            thumbnail_request = thumbnail_request.with_session_id(session_id);
        }
        if let Some(generation) = request.source_generation {
            thumbnail_request = thumbnail_request.with_source_generation(generation);
        }
        let task = self
            .inner
            .thumbnail
            .request(thumbnail_request)
            .map_err(map_thumbnail_error)?;
        let task = Arc::new(task);
        self.inner
            .thumbnail_tasks
            .lock()
            .map_err(|_| "workspace_thumbnail_state_unavailable".to_string())?
            .insert(request.request_id.clone(), Arc::clone(&task));

        // ThumbnailTask is a shared, one-shot result. The request command may
        // wait here while a separate cancel command revokes only this owner.
        let result = task
            .join()
            .map(ThumbnailArtifactDto::from)
            .map_err(map_thumbnail_error);
        let mut tasks = self
            .inner
            .thumbnail_tasks
            .lock()
            .map_err(|_| "workspace_thumbnail_state_unavailable".to_string())?;
        if tasks
            .get(&request.request_id)
            .is_some_and(|current| Arc::ptr_eq(current, &task))
        {
            tasks.remove(&request.request_id);
        }
        result
    }

    pub(crate) fn cancel_thumbnail(&self, request: ThumbnailCancelRequest) -> Result<bool, String> {
        self.ensure_live()?;
        let task = self
            .inner
            .thumbnail_tasks
            .lock()
            .map_err(|_| "workspace_thumbnail_state_unavailable".to_string())?
            .remove(&request.request_id);
        Ok(task.is_some_and(|task| task.cancel()))
    }
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
