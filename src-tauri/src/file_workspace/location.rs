//! Location projections for managed scan roots and ephemeral Browse targets.
//!
//! This module is deliberately a pure projection boundary. Managed location
//! state is read from the existing [`ScanRootDto`] authority, while
//! platform-specific code supplies explicit runtime evidence. It does not
//! probe paths, persist locations, change watcher state, read bytes, or
//! authorize filesystem mutation.

use super::contracts::{
    LocationAvailability, LocationCapabilities, LocationFreshness, LocationKind, LocationRef,
};
use crate::scanner::ScanRootDto;
use serde::{Deserialize, Serialize};

/// A common, non-authoritative Location projection used by later workspace
/// tracks. The `ref` field is an identity reference, not a filesystem path.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct LocationDescriptor {
    #[serde(rename = "ref")]
    pub location_ref: LocationRef,
    pub display_name: String,
    pub kind: LocationKind,
    pub availability: LocationAvailability,
    pub freshness: LocationFreshness,
    pub capabilities: LocationCapabilities,
}

/// Runtime evidence supplied by a platform/location adapter.
///
/// `Available` is the only variant that carries capabilities. A platform name
/// or a path-shaped label is not enough to construct runtime capability truth;
/// an adapter must provide the evidence-backed capability projection itself.
/// `Unavailable` preserves a current offline/disconnected/provider state while
/// intentionally carrying no capabilities.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LocationRuntimeEvidence {
    Available {
        kind: LocationKind,
        capabilities: LocationCapabilities,
    },
    Unavailable {
        kind: LocationKind,
        availability: LocationAvailability,
    },
    Unknown,
}

impl LocationRuntimeEvidence {
    /// Construct evidence for a location that a runtime probe can access now.
    /// Capabilities are copied only after the projection verifies that the
    /// kind is known.
    pub fn available(kind: LocationKind, capabilities: LocationCapabilities) -> Self {
        Self::Available { kind, capabilities }
    }

    /// Construct evidence for a location that is currently unavailable.
    /// `Available` and `Unknown` availability values are normalized to
    /// `Unknown` during projection so an invalid adapter result fails closed.
    pub const fn unavailable(kind: LocationKind, availability: LocationAvailability) -> Self {
        Self::Unavailable { kind, availability }
    }

    /// Construct the fail-closed evidence used when no runtime probe result
    /// exists.
    pub const fn unknown() -> Self {
        Self::Unknown
    }

    fn project(&self, fallback_availability: LocationAvailability) -> ProjectedRuntimeState {
        match self {
            Self::Available { kind, capabilities } if *kind != LocationKind::Unknown => {
                ProjectedRuntimeState {
                    kind: *kind,
                    availability: LocationAvailability::Available,
                    capabilities: capabilities.clone(),
                }
            }
            Self::Available { .. } => ProjectedRuntimeState::unknown(),
            Self::Unavailable { kind, availability } => {
                let availability = match availability {
                    LocationAvailability::Available | LocationAvailability::Unknown => {
                        LocationAvailability::Unknown
                    }
                    other => *other,
                };
                ProjectedRuntimeState {
                    kind: *kind,
                    availability,
                    capabilities: LocationCapabilities::fail_closed(),
                }
            }
            Self::Unknown => ProjectedRuntimeState {
                kind: LocationKind::Unknown,
                availability: fallback_availability,
                capabilities: LocationCapabilities::fail_closed(),
            },
        }
    }
}

/// Lifecycle of the Browse session that owns an ephemeral LocationRef.
///
/// A canceled or disposed session has no publication right for a Location
/// descriptor. The owning Browse track remains responsible for cancellation
/// and enumeration cleanup; this module only prevents stale projection
/// publication at its boundary.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EphemeralLocationLifecycle {
    Active,
    Cancelled,
    Disposed,
}

/// Input for projecting an ephemeral, session-scoped location.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EphemeralLocationProjectionInput {
    pub location_ref: LocationRef,
    pub display_name: String,
    pub runtime: LocationRuntimeEvidence,
    pub lifecycle: EphemeralLocationLifecycle,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LocationProjectionError {
    InvalidManagedScanRoot,
    ExpectedEphemeralLocation,
    InvalidEphemeralLocationRef,
    SessionCancelled,
    SessionDisposed,
}

impl LocationCapabilities {
    /// The only capability set valid when runtime evidence is unavailable or
    /// the location is not currently accessible.
    pub const fn fail_closed() -> Self {
        Self {
            can_browse: false,
            can_read_metadata: false,
            can_preview: false,
            can_watch: false,
            can_request_materialization: false,
            can_add_to_library: false,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ProjectedRuntimeState {
    kind: LocationKind,
    availability: LocationAvailability,
    capabilities: LocationCapabilities,
}

impl ProjectedRuntimeState {
    fn unknown() -> Self {
        Self {
            kind: LocationKind::Unknown,
            availability: LocationAvailability::Unknown,
            capabilities: LocationCapabilities::fail_closed(),
        }
    }
}

/// Project an existing managed scan root into the common Location shape.
///
/// The root ID and health/reconciliation fields are copied from the existing
/// scan-root authority. No database lookup or watcher mutation occurs here.
pub fn project_managed_scan_root(
    root: &ScanRootDto,
    runtime: &LocationRuntimeEvidence,
) -> Result<LocationDescriptor, LocationProjectionError> {
    if root.id.trim().is_empty() || root.source_kind != "file_library" {
        return Err(LocationProjectionError::InvalidManagedScanRoot);
    }

    let runtime_state = runtime.project(managed_health_availability(root));
    let capabilities =
        if root.enabled && runtime_state.availability == LocationAvailability::Available {
            runtime_state.capabilities
        } else {
            LocationCapabilities::fail_closed()
        };

    Ok(LocationDescriptor {
        location_ref: LocationRef::Managed {
            scan_root_id: root.id.clone(),
        },
        display_name: root.display_name.clone(),
        kind: runtime_state.kind,
        availability: runtime_state.availability,
        freshness: managed_freshness(root),
        capabilities,
    })
}

/// Project an active ephemeral Browse location without making it durable.
///
/// Ephemeral locations never inherit managed freshness: they have no durable
/// index authority, so their freshness is always `not_applicable`.
pub fn project_ephemeral_location(
    input: EphemeralLocationProjectionInput,
) -> Result<LocationDescriptor, LocationProjectionError> {
    match input.lifecycle {
        EphemeralLocationLifecycle::Active => {}
        EphemeralLocationLifecycle::Cancelled => {
            return Err(LocationProjectionError::SessionCancelled)
        }
        EphemeralLocationLifecycle::Disposed => {
            return Err(LocationProjectionError::SessionDisposed)
        }
    }

    let LocationRef::Ephemeral {
        browse_session_id,
        location_id,
    } = &input.location_ref
    else {
        return Err(LocationProjectionError::ExpectedEphemeralLocation);
    };

    if browse_session_id.trim().is_empty() || location_id.trim().is_empty() {
        return Err(LocationProjectionError::InvalidEphemeralLocationRef);
    }

    let runtime_state = input.runtime.project(LocationAvailability::Unknown);
    Ok(LocationDescriptor {
        location_ref: input.location_ref,
        display_name: input.display_name,
        kind: runtime_state.kind,
        availability: runtime_state.availability,
        freshness: LocationFreshness::NotApplicable,
        capabilities: if runtime_state.availability == LocationAvailability::Available {
            runtime_state.capabilities
        } else {
            LocationCapabilities::fail_closed()
        },
    })
}

fn managed_health_availability(root: &ScanRootDto) -> LocationAvailability {
    match root.health_status.as_str() {
        "missing" => LocationAvailability::NotFound,
        "permission_required" => LocationAvailability::PermissionDenied,
        _ => LocationAvailability::Unknown,
    }
}

fn managed_freshness(root: &ScanRootDto) -> LocationFreshness {
    if !root.enabled {
        return LocationFreshness::Unknown;
    }

    let watcher_revision_gap = root.watcher_revision != root.watcher_applied_revision;
    if root.active_run_id.is_some()
        || root.needs_reconciliation
        || root.watcher_rule_recovery_required
        || watcher_revision_gap
        || matches!(
            root.health_status.as_str(),
            "scanning" | "reconciliation_required"
        )
    {
        return LocationFreshness::Reconciling;
    }

    match root.health_status.as_str() {
        "healthy" => LocationFreshness::Current,
        "degraded" | "missing" | "permission_required" => LocationFreshness::Stale,
        _ => LocationFreshness::Unknown,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn capabilities() -> LocationCapabilities {
        LocationCapabilities {
            can_browse: true,
            can_read_metadata: true,
            can_preview: true,
            can_watch: true,
            can_request_materialization: false,
            can_add_to_library: true,
        }
    }

    fn scan_root() -> ScanRootDto {
        ScanRootDto {
            id: "root-1".to_string(),
            normalized_path: "/managed/root".to_string(),
            display_name: "Managed Root".to_string(),
            source_kind: "file_library".to_string(),
            enabled: true,
            health_status: "healthy".to_string(),
            current_generation: 3,
            active_run_id: None,
            active_generation: None,
            revision: 7,
            last_successful_generation: Some(3),
            last_full_scan_at: Some(100),
            needs_reconciliation: false,
            last_error_code: None,
            last_error_message: None,
            watcher_revision: 4,
            watcher_applied_revision: 4,
            watcher_last_event_at: Some(90),
            watcher_last_applied_at: Some(95),
            watcher_last_error_code: None,
            watcher_last_error_message: None,
            watcher_rule_recovery_required: false,
            created_at: 1,
            updated_at: 100,
        }
    }

    #[test]
    fn managed_projection_reuses_scan_root_identity_and_projects_current_health() {
        let descriptor = project_managed_scan_root(
            &scan_root(),
            &LocationRuntimeEvidence::available(LocationKind::Local, capabilities()),
        )
        .expect("valid managed scan root");

        assert_eq!(
            descriptor.location_ref,
            LocationRef::Managed {
                scan_root_id: "root-1".to_string()
            }
        );
        assert_eq!(descriptor.display_name, "Managed Root");
        assert_eq!(descriptor.kind, LocationKind::Local);
        assert_eq!(descriptor.availability, LocationAvailability::Available);
        assert_eq!(descriptor.freshness, LocationFreshness::Current);
        assert_eq!(descriptor.capabilities, capabilities());
    }

    #[test]
    fn availability_and_freshness_are_independent() {
        let mut root = scan_root();
        root.needs_reconciliation = true;
        root.watcher_revision = 5;

        let available = project_managed_scan_root(
            &root,
            &LocationRuntimeEvidence::available(LocationKind::External, capabilities()),
        )
        .expect("valid managed scan root");
        assert_eq!(available.availability, LocationAvailability::Available);
        assert_eq!(available.freshness, LocationFreshness::Reconciling);
        assert_eq!(available.capabilities, capabilities());

        let disconnected = project_managed_scan_root(
            &root,
            &LocationRuntimeEvidence::unavailable(
                LocationKind::External,
                LocationAvailability::Disconnected,
            ),
        )
        .expect("valid managed scan root");
        assert_eq!(
            disconnected.availability,
            LocationAvailability::Disconnected
        );
        assert_eq!(disconnected.freshness, LocationFreshness::Reconciling);
        assert_eq!(
            disconnected.capabilities,
            LocationCapabilities::fail_closed()
        );
    }

    #[test]
    fn ephemeral_projection_is_session_scoped_and_not_a_managed_authority() {
        let descriptor = project_ephemeral_location(EphemeralLocationProjectionInput {
            location_ref: LocationRef::Ephemeral {
                browse_session_id: "browse-1".to_string(),
                location_id: "location-1".to_string(),
            },
            display_name: "Documents".to_string(),
            runtime: LocationRuntimeEvidence::available(LocationKind::Local, capabilities()),
            lifecycle: EphemeralLocationLifecycle::Active,
        })
        .expect("active ephemeral location");

        assert_eq!(descriptor.freshness, LocationFreshness::NotApplicable);
        assert_eq!(descriptor.availability, LocationAvailability::Available);
        assert_eq!(descriptor.capabilities, capabilities());

        let value = serde_json::to_value(descriptor).expect("serialize descriptor");
        assert_eq!(
            value,
            json!({
                "ref": {
                    "kind": "ephemeral",
                    "browseSessionId": "browse-1",
                    "locationId": "location-1"
                },
                "displayName": "Documents",
                "kind": "local",
                "availability": "available",
                "freshness": "not_applicable",
                "capabilities": {
                    "canBrowse": true,
                    "canReadMetadata": true,
                    "canPreview": true,
                    "canWatch": true,
                    "canRequestMaterialization": false,
                    "canAddToLibrary": true
                }
            })
        );
        assert!(value.get("materialization").is_none());
        assert!(value.get("contentReadEligibility").is_none());
        assert!(value.get("path").is_none());
        assert!(value["ref"].get("scanRootId").is_none());
    }

    #[test]
    fn unknown_and_unavailable_runtime_evidence_fail_closed() {
        let root = scan_root();
        let unknown = project_managed_scan_root(&root, &LocationRuntimeEvidence::unknown())
            .expect("valid managed scan root");
        assert_eq!(unknown.kind, LocationKind::Unknown);
        assert_eq!(unknown.availability, LocationAvailability::Unknown);
        assert_eq!(unknown.capabilities, LocationCapabilities::fail_closed());

        let mislabeled = project_managed_scan_root(
            &root,
            &LocationRuntimeEvidence::available(LocationKind::Unknown, capabilities()),
        )
        .expect("valid managed scan root");
        assert_eq!(mislabeled.kind, LocationKind::Unknown);
        assert_eq!(mislabeled.availability, LocationAvailability::Unknown);
        assert_eq!(mislabeled.capabilities, LocationCapabilities::fail_closed());

        let offline = project_managed_scan_root(
            &root,
            &LocationRuntimeEvidence::unavailable(
                LocationKind::CloudProvider,
                LocationAvailability::Offline,
            ),
        )
        .expect("valid managed scan root");
        assert_eq!(offline.kind, LocationKind::CloudProvider);
        assert_eq!(offline.availability, LocationAvailability::Offline);
        assert_eq!(offline.capabilities, LocationCapabilities::fail_closed());
    }

    #[test]
    fn missing_or_permission_health_is_stale_without_deletion_semantics() {
        for (health_status, expected_availability) in [
            ("missing", LocationAvailability::NotFound),
            (
                "permission_required",
                LocationAvailability::PermissionDenied,
            ),
        ] {
            let mut root = scan_root();
            root.health_status = health_status.to_string();
            let descriptor = project_managed_scan_root(&root, &LocationRuntimeEvidence::unknown())
                .expect("valid managed scan root");

            assert_eq!(descriptor.availability, expected_availability);
            assert_eq!(descriptor.freshness, LocationFreshness::Stale);
            assert_eq!(descriptor.capabilities, LocationCapabilities::fail_closed());
            assert_eq!(
                descriptor.location_ref,
                LocationRef::Managed {
                    scan_root_id: "root-1".to_string()
                }
            );
        }
    }

    #[test]
    fn canceled_and_disposed_ephemeral_sessions_revoke_publication() {
        for lifecycle in [
            EphemeralLocationLifecycle::Cancelled,
            EphemeralLocationLifecycle::Disposed,
        ] {
            let error = project_ephemeral_location(EphemeralLocationProjectionInput {
                location_ref: LocationRef::Ephemeral {
                    browse_session_id: "browse-1".to_string(),
                    location_id: "location-1".to_string(),
                },
                display_name: "Documents".to_string(),
                runtime: LocationRuntimeEvidence::unknown(),
                lifecycle,
            })
            .expect_err("inactive sessions must not publish locations");

            assert_eq!(
                error,
                match lifecycle {
                    EphemeralLocationLifecycle::Cancelled => {
                        LocationProjectionError::SessionCancelled
                    }
                    EphemeralLocationLifecycle::Disposed => {
                        LocationProjectionError::SessionDisposed
                    }
                    EphemeralLocationLifecycle::Active => unreachable!(),
                }
            );
        }
    }

    #[test]
    fn invalid_refs_fail_closed_without_crossing_location_authority() {
        let managed_error = project_ephemeral_location(EphemeralLocationProjectionInput {
            location_ref: LocationRef::Managed {
                scan_root_id: "root-1".to_string(),
            },
            display_name: "Managed Root".to_string(),
            runtime: LocationRuntimeEvidence::unknown(),
            lifecycle: EphemeralLocationLifecycle::Active,
        })
        .expect_err("managed refs cannot be ephemeral projections");
        assert_eq!(
            managed_error,
            LocationProjectionError::ExpectedEphemeralLocation
        );

        let invalid_error = project_ephemeral_location(EphemeralLocationProjectionInput {
            location_ref: LocationRef::Ephemeral {
                browse_session_id: String::new(),
                location_id: "location-1".to_string(),
            },
            display_name: "Invalid".to_string(),
            runtime: LocationRuntimeEvidence::unknown(),
            lifecycle: EphemeralLocationLifecycle::Active,
        })
        .expect_err("empty session identity must fail closed");
        assert_eq!(
            invalid_error,
            LocationProjectionError::InvalidEphemeralLocationRef
        );
    }
}
