//! Backend-owned Location -> Browse admission.
//!
//! This is intentionally a narrow action seam. Location projection remains in
//! `file_workspace::location`, BrowseService owns ephemeral session/path
//! identity, and this adapter only joins an opaque LocationRef to one of those
//! existing authorities before publishing a fresh Browse response.

use super::{
    browse::map_browse_error,
    runtime::FileWorkspaceRuntime,
    types::{BrowseOpenResponse, LocationBrowseRequest},
};
use crate::file_workspace::{
    browse::{BackendResolvedDirectory, BrowseError},
    contracts::LocationRef,
    location::LocationRuntimeEvidence,
};
use std::path::PathBuf;

impl FileWorkspaceRuntime {
    pub(crate) fn browse_location(
        &self,
        request: LocationBrowseRequest,
    ) -> Result<BrowseOpenResponse, String> {
        self.ensure_live()?;

        let (info, display_name) = match request.location {
            LocationRef::Managed { scan_root_id } => self.admit_managed_location(&scan_root_id)?,
            LocationRef::Ephemeral {
                browse_session_id,
                location_id,
            } => {
                let display_name = self.browse_display_name(&browse_session_id)?;
                let location = LocationRef::Ephemeral {
                    browse_session_id,
                    location_id,
                };
                let info = self
                    .inner
                    .browse
                    .re_admit_ephemeral_location(&location)
                    .map_err(map_location_browse_error)?;
                (info, display_name)
            }
        };

        // This evidence is intentionally narrower than a classified
        // Location probe: a fresh Browse root proves only canBrowse.
        self.publish_browse_admission(
            info,
            display_name,
            LocationRuntimeEvidence::browse_admitted(),
        )
    }

    fn admit_managed_location(
        &self,
        scan_root_id: &str,
    ) -> Result<(crate::file_workspace::browse::BrowseSessionInfo, String), String> {
        if !super::types::valid_bounded_text(scan_root_id) {
            return Err("workspace_location_ref_unknown".to_string());
        }

        // The managed LocationRef is resolved only through the existing
        // scan-root/database authority. The normalized path never crosses the
        // IPC boundary and is used only inside this backend admission seam.
        let root = self
            .inner
            .database
            .get_scan_root_health(Some(scan_root_id), None)
            .map_err(|_| "workspace_location_ref_unknown".to_string())?;
        if root.id != scan_root_id || root.source_kind != "file_library" {
            return Err("workspace_location_ref_unknown".to_string());
        }
        if !root.enabled {
            return Err("workspace_location_unavailable".to_string());
        }
        if let Some(error) = managed_health_error(&root.health_status) {
            return Err(error.to_string());
        }

        let directory =
            BackendResolvedDirectory::from_backend_path(PathBuf::from(root.normalized_path))
                .map_err(map_browse_error)?;
        let info = self
            .inner
            .browse
            .start_session(directory)
            .map_err(map_browse_error)?;
        let display_name = if root.display_name.trim().is_empty() {
            "Browse".to_string()
        } else {
            root.display_name
        };
        Ok((info, display_name))
    }

    fn browse_display_name(&self, session_id: &str) -> Result<String, String> {
        let sessions = self
            .inner
            .sessions
            .lock()
            .map_err(|_| "workspace_session_state_unavailable".to_string())?;
        let record = sessions
            .get(session_id)
            .ok_or_else(|| "workspace_location_ref_stale".to_string())?;
        Ok(if record.display_name.trim().is_empty() {
            "Browse".to_string()
        } else {
            record.display_name.clone()
        })
    }
}

fn managed_health_error(status: &str) -> Option<&'static str> {
    match status {
        "missing" => Some("workspace_location_not_found"),
        "permission_required" => Some("workspace_location_permission_denied"),
        "authentication_required" => Some("workspace_location_authentication_required"),
        "offline" => Some("workspace_location_offline"),
        "disconnected" => Some("workspace_location_disconnected"),
        _ => None,
    }
}

fn map_location_browse_error(error: BrowseError) -> String {
    match error {
        BrowseError::SessionNotFound | BrowseError::InvalidPathRef => {
            "workspace_location_ref_stale".to_string()
        }
        BrowseError::InvalidLocationRef => "workspace_location_ref_mismatch".to_string(),
        other => other.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::managed_health_error;

    #[test]
    fn managed_health_errors_preserve_distinct_provider_and_permission_states() {
        assert_eq!(
            managed_health_error("permission_required"),
            Some("workspace_location_permission_denied")
        );
        assert_eq!(
            managed_health_error("authentication_required"),
            Some("workspace_location_authentication_required")
        );
        assert_eq!(
            managed_health_error("offline"),
            Some("workspace_location_offline")
        );
        assert_eq!(
            managed_health_error("disconnected"),
            Some("workspace_location_disconnected")
        );
        assert_eq!(managed_health_error("reconciliation_required"), None);
    }
}
