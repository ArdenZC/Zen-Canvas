use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum EntryRef {
    Managed {
        #[serde(rename = "fileId")]
        file_id: String,
    },
    Ephemeral {
        #[serde(rename = "browseSessionId")]
        browse_session_id: String,
        #[serde(rename = "entryId")]
        entry_id: String,
    },
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum LocationRef {
    Managed {
        #[serde(rename = "scanRootId")]
        scan_root_id: String,
    },
    Ephemeral {
        #[serde(rename = "browseSessionId")]
        browse_session_id: String,
        #[serde(rename = "locationId")]
        location_id: String,
    },
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct BrowsePathRef {
    /// Opaque session-scoped path reference. It is not a filesystem path.
    pub id: String,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum LibraryNavigationSource {
    SmartView,
    SavedView,
    Tag,
    Search,
    Custom,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum NavigationTarget {
    Library {
        pub_source: LibraryNavigationSource,
        key: String,
    },
    Browse {
        location: LocationRef,
        #[serde(rename = "pathRef")]
        path_ref: BrowsePathRef,
    },
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct BrowseEnumerationRef {
    pub session_id: String,
    pub request_id: String,
    pub enumeration_id: String,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum WorkspacePlatform {
    Macos,
    Windows,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum WorkspaceRestoreLocator {
    Library {
        #[serde(rename = "targetKey")]
        target_key: String,
    },
    Browse {
        platform: WorkspacePlatform,
        #[serde(rename = "routingHint")]
        routing_hint: String,
        #[serde(rename = "displayHint", default, skip_serializing_if = "Option::is_none")]
        display_hint: Option<String>,
    },
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum LocationKind {
    Local,
    External,
    Network,
    CloudProvider,
    Unknown,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum LocationAvailability {
    Available,
    Offline,
    Disconnected,
    PermissionDenied,
    AuthenticationRequired,
    NotFound,
    Unknown,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum LocationFreshness {
    Current,
    Stale,
    Reconciling,
    Unknown,
    NotApplicable,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum MaterializationState {
    Local,
    BoundaryReadable,
    MetadataOnly,
    RemotePlaceholder,
    Hydrating,
    Unavailable,
    Unknown,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum ContentReadEligibility {
    Eligible,
    MaterializationRequired,
    Downloading,
    MetadataOnly,
    PermissionRequired,
    SourceUnavailable,
    SourceNotSupported,
    PackageUnsupported,
    Symlink,
    IdentityChanged,
    AvailabilityUnknown,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum WorkClass {
    Foreground,
    Interactive,
    Background,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum PreviewSourceRef {
    Managed {
        #[serde(rename = "fileId")]
        file_id: String,
    },
    Ephemeral {
        #[serde(rename = "browseSessionId")]
        browse_session_id: String,
        #[serde(rename = "entryId")]
        entry_id: String,
    },
    HostProvided {
        #[serde(rename = "hostToken")]
        host_token: String,
    },
}

impl From<EntryRef> for PreviewSourceRef {
    fn from(value: EntryRef) -> Self {
        match value {
            EntryRef::Managed { file_id } => Self::Managed { file_id },
            EntryRef::Ephemeral {
                browse_session_id,
                entry_id,
            } => Self::Ephemeral {
                browse_session_id,
                entry_id,
            },
        }
    }
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum PreviewHostKind {
    ZenFloating,
    ZenPinned,
    MacQuickLookExtension,
    WindowsQuickPreview,
    WindowsPreviewHandler,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct ContentReadLeaseRef {
    /// Opaque backend-issued handle. Never a filesystem path.
    pub lease_id: String,
    pub request_id: String,
    pub source_version: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct LocationCapabilities {
    pub can_browse: bool,
    pub can_read_metadata: bool,
    pub can_preview: bool,
    pub can_watch: bool,
    pub can_request_materialization: bool,
    pub can_add_to_library: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn entry_refs_have_stable_tagged_json_shapes() {
        let managed = EntryRef::Managed {
            file_id: "file-1".to_string(),
        };
        assert_eq!(
            serde_json::to_value(managed).unwrap(),
            json!({ "kind": "managed", "fileId": "file-1" })
        );

        let ephemeral = EntryRef::Ephemeral {
            browse_session_id: "browse-1".to_string(),
            entry_id: "entry-9".to_string(),
        };
        assert_eq!(
            serde_json::to_value(ephemeral).unwrap(),
            json!({
                "kind": "ephemeral",
                "browseSessionId": "browse-1",
                "entryId": "entry-9"
            })
        );
    }

    #[test]
    fn browse_navigation_uses_opaque_path_refs() {
        let target = NavigationTarget::Browse {
            location: LocationRef::Ephemeral {
                browse_session_id: "browse-1".to_string(),
                location_id: "loc-2".to_string(),
            },
            path_ref: BrowsePathRef {
                id: "path-3".to_string(),
            },
        };

        let value = serde_json::to_value(target).unwrap();
        assert_eq!(value["kind"], "browse");
        assert_eq!(value["pathRef"]["id"], "path-3");
        assert!(value.get("path").is_none());
        assert!(value.get("displayPath").is_none());
    }

    #[test]
    fn browse_enumeration_identity_is_explicit() {
        let generation = BrowseEnumerationRef {
            session_id: "browse-1".to_string(),
            request_id: "request-2".to_string(),
            enumeration_id: "enum-3".to_string(),
        };
        assert_eq!(
            serde_json::to_value(generation).unwrap(),
            json!({
                "sessionId": "browse-1",
                "requestId": "request-2",
                "enumerationId": "enum-3"
            })
        );
    }

    #[test]
    fn browse_restore_locator_is_not_an_ephemeral_authority_ref() {
        let locator = WorkspaceRestoreLocator::Browse {
            platform: WorkspacePlatform::Macos,
            routing_hint: "/Users/example/Documents".to_string(),
            display_hint: Some("Documents".to_string()),
        };
        let value = serde_json::to_value(locator).unwrap();
        assert_eq!(value["kind"], "browse");
        assert_eq!(value["platform"], "macos");
        assert_eq!(value["routingHint"], "/Users/example/Documents");
        assert!(value.get("browseSessionId").is_none());
        assert!(value.get("entryId").is_none());
        assert!(value.get("pathRef").is_none());
    }

    #[test]
    fn source_state_and_read_eligibility_remain_distinct() {
        assert_eq!(
            serde_json::to_value(MaterializationState::BoundaryReadable).unwrap(),
            json!("boundary_readable")
        );
        assert_eq!(
            serde_json::to_value(ContentReadEligibility::Eligible).unwrap(),
            json!("eligible")
        );
        assert_eq!(
            serde_json::to_value(ContentReadEligibility::MaterializationRequired).unwrap(),
            json!("materialization_required")
        );
    }

    #[test]
    fn content_read_lease_serialization_never_contains_a_path() {
        let lease = ContentReadLeaseRef {
            lease_id: "lease-1".to_string(),
            request_id: "preview-2".to_string(),
            source_version: "version-3".to_string(),
        };
        let value = serde_json::to_value(lease).unwrap();
        assert_eq!(value["leaseId"], "lease-1");
        assert_eq!(value["requestId"], "preview-2");
        assert_eq!(value["sourceVersion"], "version-3");
        assert!(value.get("path").is_none());
    }

    #[test]
    fn strict_structs_reject_unknown_fields() {
        let invalid = json!({ "id": "path-1", "path": "/tmp/not-authority" });
        assert!(serde_json::from_value::<BrowsePathRef>(invalid).is_err());
    }
}
