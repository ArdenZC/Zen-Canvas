use super::{
    runtime::{BrowseRecord, FileWorkspaceRuntime, MAX_BROWSE_SESSIONS},
    types::{
        BrowseCancelRequest, BrowseNextPageRequest, BrowseOpenRequest, BrowseOpenResponse,
        BrowsePageDto, BrowseReleasePageRequest, BrowseReleasePathRequest, BrowseRestoreRequest,
        BrowseRetainPathRequest, BrowseSessionRequest, BrowseStartEnumerationRequest,
    },
};
use crate::file_workspace::{
    browse::{BackendResolvedDirectory, BrowseError, BrowseSessionInfo},
    contracts::WorkspacePlatform,
    location::{
        project_ephemeral_location, project_managed_scan_root, EphemeralLocationLifecycle,
        EphemeralLocationProjectionInput, LocationRuntimeEvidence,
    },
};
use std::path::PathBuf;

impl FileWorkspaceRuntime {
    pub(crate) fn open_browse(
        &self,
        request: BrowseOpenRequest,
    ) -> Result<BrowseOpenResponse, String> {
        self.ensure_live()?;
        validate_platform(request.platform)?;
        let routing_hint = validate_routing_hint(&request.routing_hint)?;
        let directory =
            BackendResolvedDirectory::from_backend_path(routing_hint).map_err(map_browse_error)?;
        let display_name = request
            .display_hint
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "Browse".to_string());

        let info = self
            .inner
            .browse
            .start_session(directory)
            .map_err(map_browse_error)?;
        self.publish_browse_admission(
            info,
            display_name,
            LocationRuntimeEvidence::browse_admitted(),
        )
    }

    pub(crate) fn restore_browse(
        &self,
        request: BrowseRestoreRequest,
    ) -> Result<BrowseOpenResponse, String> {
        let locator = request.locator;
        match locator {
            crate::file_workspace::WorkspaceRestoreLocator::Browse {
                platform,
                routing_hint,
                display_hint,
            } => self.open_browse(BrowseOpenRequest {
                platform,
                routing_hint,
                display_hint,
            }),
            crate::file_workspace::WorkspaceRestoreLocator::Library { .. } => {
                Err("workspace_restore_requires_browse_locator".to_string())
            }
        }
    }

    pub(crate) fn start_enumeration(
        &self,
        request: BrowseStartEnumerationRequest,
    ) -> Result<BrowsePageDto, String> {
        self.ensure_live()?;
        let page = self
            .inner
            .browse
            .start_enumeration(
                &request.session_id,
                request.request_id,
                &request.path_ref,
                request.page_size,
            )
            .map_err(map_browse_error)?;
        Ok(BrowsePageDto::from_internal(page))
    }

    pub(crate) fn next_page(
        &self,
        request: BrowseNextPageRequest,
    ) -> Result<BrowsePageDto, String> {
        self.ensure_live()?;
        let page = self
            .inner
            .browse
            .next_page(&request.session_id, &request.cursor, request.page_size)
            .map_err(map_browse_error)?;
        Ok(BrowsePageDto::from_internal(page))
    }

    pub(crate) fn cancel_enumeration(&self, request: BrowseCancelRequest) -> Result<(), String> {
        self.ensure_live()?;
        match (request.enumeration, request.request_id) {
            (Some(enumeration), None) => self
                .inner
                .browse
                .cancel(&request.session_id, &enumeration)
                .map_err(map_browse_error),
            (None, Some(request_id)) if !request_id.is_empty() => self
                .inner
                .browse
                .cancel_request(&request.session_id, &request_id)
                .map_err(map_browse_error),
            _ => Err("browse_cancel_requires_exactly_one_identity".to_string()),
        }
    }

    pub(crate) fn release_page(&self, request: BrowseReleasePageRequest) -> Result<(), String> {
        self.ensure_live()?;
        self.inner
            .browse
            .release_page(&request.page.into_internal())
            .map_err(map_browse_error)
    }

    pub(crate) fn release_path(&self, request: BrowseReleasePathRequest) -> Result<(), String> {
        self.ensure_live()?;
        self.inner
            .browse
            .release_path_ref(&request.session_id, &request.path_ref)
            .map_err(map_browse_error)
    }

    pub(crate) fn retain_path(&self, request: BrowseRetainPathRequest) -> Result<(), String> {
        self.ensure_live()?;
        self.inner
            .browse
            .retain_path_ref(&request.session_id, &request.path_ref)
            .map_err(map_browse_error)
    }

    pub(crate) fn dispose_browse(&self, request: BrowseSessionRequest) -> Result<(), String> {
        self.ensure_live()?;
        self.dispose_monitors_for_session(&request.session_id);
        self.dispose_previews_for_session(&request.session_id);
        self.inner
            .sessions
            .lock()
            .map_err(|_| "workspace_session_state_unavailable".to_string())?
            .remove(&request.session_id)
            .ok_or_else(|| "browse_session_not_found".to_string())?;
        self.inner
            .browse
            .dispose_session(&request.session_id)
            .map_err(map_browse_error)
    }

    pub(crate) fn list_locations(
        &self,
    ) -> Result<Vec<crate::file_workspace::LocationDescriptor>, String> {
        self.ensure_live()?;
        let roots = self
            .inner
            .database
            .list_scan_roots()
            .map_err(|_| "workspace_location_list_unavailable".to_string())?;
        let mut descriptors = roots
            .iter()
            .filter_map(|root| {
                project_managed_scan_root(root, &LocationRuntimeEvidence::unknown()).ok()
            })
            .collect::<Vec<_>>();
        let ephemeral = self
            .inner
            .sessions
            .lock()
            .map_err(|_| "workspace_session_state_unavailable".to_string())?
            .values()
            .map(|record| {
                project_ephemeral_location(EphemeralLocationProjectionInput {
                    location_ref: record.info.location.clone(),
                    display_name: record.display_name.clone(),
                    runtime: LocationRuntimeEvidence::unknown(),
                    lifecycle: EphemeralLocationLifecycle::Active,
                })
            })
            .collect::<Result<Vec<_>, _>>()
            .map_err(|_| "workspace_location_projection_failed".to_string())?;
        descriptors.extend(ephemeral);
        Ok(descriptors)
    }

    pub(crate) fn read_eligibility(
        &self,
        request: super::types::ReadEligibilityRequest,
    ) -> Result<super::types::ReadEligibilityResponse, String> {
        self.ensure_live()?;
        let eligibility = self
            .inner
            .read_gate
            .content_read_eligibility(&request.source);
        Ok(super::types::ReadEligibilityResponse {
            source: request.source,
            eligibility,
        })
    }

    /// Publish one already-admitted Browse session into the integration
    /// lifecycle registry. The registry owns only command-addressable handles;
    /// BrowseService remains the session/path authority.
    pub(crate) fn publish_browse_admission(
        &self,
        info: BrowseSessionInfo,
        display_name: String,
        runtime: LocationRuntimeEvidence,
    ) -> Result<BrowseOpenResponse, String> {
        let descriptor = match project_ephemeral_location(EphemeralLocationProjectionInput {
            location_ref: info.location.clone(),
            display_name: display_name.clone(),
            runtime,
            lifecycle: EphemeralLocationLifecycle::Active,
        }) {
            Ok(descriptor) => descriptor,
            Err(_) => {
                let _ = self.inner.browse.dispose_session(&info.session_id);
                return Err("workspace_location_projection_failed".to_string());
            }
        };

        let mut sessions = match self.inner.sessions.lock() {
            Ok(sessions) => sessions,
            Err(_) => {
                let _ = self.inner.browse.dispose_session(&info.session_id);
                return Err("workspace_session_state_unavailable".to_string());
            }
        };
        if sessions.len() >= MAX_BROWSE_SESSIONS {
            drop(sessions);
            let _ = self.inner.browse.dispose_session(&info.session_id);
            return Err("browse_session_capacity_exceeded".to_string());
        }
        let session_id = info.session_id.clone();
        let response = BrowseOpenResponse {
            session_id: session_id.clone(),
            location: descriptor,
            root_path_ref: info.root_path_ref.clone(),
        };
        sessions.insert(session_id, BrowseRecord { info, display_name });
        Ok(response)
    }
}

impl FileWorkspaceRuntime {
    pub(crate) fn has_browse_session(&self, session_id: &str) -> bool {
        self.inner
            .sessions
            .lock()
            .map(|sessions| sessions.contains_key(session_id))
            .unwrap_or(false)
    }

    pub(crate) fn dispose_monitors_for_session(&self, session_id: &str) {
        let monitors = {
            let Ok(mut records) = self.inner.monitors.lock() else {
                return;
            };
            let ids = records
                .iter()
                .filter(|(_, record)| record.session_id == session_id)
                .map(|(id, _)| id.clone())
                .collect::<Vec<_>>();
            ids.into_iter()
                .filter_map(|id| records.remove(&id))
                .map(|record| record.monitor)
                .collect::<Vec<_>>()
        };
        for monitor in monitors {
            monitor.dispose();
        }
    }

    pub(crate) fn dispose_previews_for_session(&self, session_id: &str) {
        let previews = {
            let Ok(mut records) = self.inner.preview_sessions.lock() else {
                return;
            };
            let ids = records
                .iter()
                .filter(|(_, session)| {
                    matches!(
                        session.request().source,
                        crate::file_workspace::PreviewSourceRef::Ephemeral {
                            ref browse_session_id,
                            ..
                        } if browse_session_id == session_id
                    )
                })
                .map(|(id, _)| id.clone())
                .collect::<Vec<_>>();
            ids.into_iter()
                .filter_map(|id| records.remove(&id))
                .collect::<Vec<_>>()
        };
        for session in previews {
            session.dispose();
        }
    }
}

fn validate_platform(platform: WorkspacePlatform) -> Result<(), String> {
    let supported = if cfg!(target_os = "windows") {
        platform == WorkspacePlatform::Windows
    } else if cfg!(target_os = "macos") {
        platform == WorkspacePlatform::Macos
    } else {
        false
    };
    supported
        .then_some(())
        .ok_or_else(|| "workspace_platform_not_supported".to_string())
}

fn validate_routing_hint(value: &str) -> Result<PathBuf, String> {
    if !super::types::valid_bounded_text(value) {
        return Err("browse_routing_hint_invalid".to_string());
    }
    Ok(PathBuf::from(value))
}

pub(super) fn map_browse_error(error: BrowseError) -> String {
    error.to_string()
}
