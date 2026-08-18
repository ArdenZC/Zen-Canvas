use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(tag = "kind", rename_all = "snake_case")]
#[serde(deny_unknown_fields)]
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

/// The only identity a real Browse producer can publish.
///
/// `EntryRef` remains the shared managed/ephemeral source contract for
/// consumers that genuinely support both source kinds. Browse pages use this
/// narrower wire type so a managed File Library identity cannot masquerade as
/// a Browse row.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(tag = "kind", rename_all = "snake_case")]
#[serde(deny_unknown_fields)]
pub enum BrowseEntryRef {
    Ephemeral {
        #[serde(rename = "browseSessionId")]
        browse_session_id: String,
        #[serde(rename = "entryId")]
        entry_id: String,
    },
}

impl From<BrowseEntryRef> for EntryRef {
    fn from(value: BrowseEntryRef) -> Self {
        match value {
            BrowseEntryRef::Ephemeral {
                browse_session_id,
                entry_id,
            } => Self::Ephemeral {
                browse_session_id,
                entry_id,
            },
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(tag = "kind", rename_all = "snake_case")]
#[serde(deny_unknown_fields)]
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
#[serde(deny_unknown_fields)]
pub enum NavigationTarget {
    Library {
        source: LibraryNavigationSource,
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
#[serde(deny_unknown_fields)]
pub enum WorkspaceRestoreLocator {
    Library {
        source: LibraryNavigationSource,
        key: String,
    },
    Browse {
        platform: WorkspacePlatform,
        #[serde(rename = "routingHint")]
        routing_hint: String,
        #[serde(
            rename = "displayHint",
            default,
            skip_serializing_if = "Option::is_none"
        )]
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
#[serde(deny_unknown_fields)]
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
    fn browse_entry_ref_is_source_specific_and_only_serializes_ephemeral_identity() {
        let browse = BrowseEntryRef::Ephemeral {
            browse_session_id: "browse-1".to_string(),
            entry_id: "entry-1".to_string(),
        };
        assert_eq!(
            serde_json::to_value(&browse).unwrap(),
            json!({
                "kind": "ephemeral",
                "browseSessionId": "browse-1",
                "entryId": "entry-1"
            })
        );
        assert!(serde_json::from_value::<BrowseEntryRef>(json!({
            "kind": "managed",
            "fileId": "file-1"
        }))
        .is_err());
        assert_eq!(EntryRef::from(browse), ephemeral_entry());
    }

    fn ephemeral_entry() -> EntryRef {
        EntryRef::Ephemeral {
            browse_session_id: "browse-1".to_string(),
            entry_id: "entry-1".to_string(),
        }
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
    fn location_refs_have_stable_managed_and_ephemeral_shapes() {
        let managed = LocationRef::Managed {
            scan_root_id: "root-1".to_string(),
        };
        assert_eq!(
            serde_json::to_value(managed).unwrap(),
            json!({ "kind": "managed", "scanRootId": "root-1" })
        );

        let ephemeral = LocationRef::Ephemeral {
            browse_session_id: "browse-1".to_string(),
            location_id: "location-2".to_string(),
        };
        assert_eq!(
            serde_json::to_value(ephemeral).unwrap(),
            json!({
                "kind": "ephemeral",
                "browseSessionId": "browse-1",
                "locationId": "location-2"
            })
        );
    }

    #[test]
    fn library_navigation_uses_the_source_wire_field() {
        let target = NavigationTarget::Library {
            source: LibraryNavigationSource::SavedView,
            key: "recent-files".to_string(),
        };

        assert_eq!(
            serde_json::to_value(target).unwrap(),
            json!({
                "kind": "library",
                "source": "saved_view",
                "key": "recent-files"
            })
        );

        let seed_shape = json!({
            "kind": "library",
            "pub_source": "saved_view",
            "key": "recent-files"
        });
        assert!(serde_json::from_value::<NavigationTarget>(seed_shape).is_err());
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
    fn library_restore_locator_is_presentation_routing_only() {
        let locator = WorkspaceRestoreLocator::Library {
            source: LibraryNavigationSource::SavedView,
            key: "recent-files".to_string(),
        };
        assert_eq!(
            serde_json::to_value(locator).unwrap(),
            json!({
                "kind": "library",
                "source": "saved_view",
                "key": "recent-files"
            })
        );
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
    fn preview_sources_and_hosts_have_opaque_wire_shapes() {
        let source = PreviewSourceRef::HostProvided {
            host_token: "host-token-1".to_string(),
        };
        assert_eq!(
            serde_json::to_value(source).unwrap(),
            json!({ "kind": "host_provided", "hostToken": "host-token-1" })
        );

        let managed_source = PreviewSourceRef::Managed {
            file_id: "file-1".to_string(),
        };
        assert_eq!(
            serde_json::to_value(managed_source).unwrap(),
            json!({ "kind": "managed", "fileId": "file-1" })
        );

        assert_eq!(
            serde_json::to_value(PreviewHostKind::MacQuickLookExtension).unwrap(),
            json!("mac_quick_look_extension")
        );
    }

    #[test]
    fn location_capabilities_have_stable_camel_case_fields() {
        let capabilities = LocationCapabilities {
            can_browse: true,
            can_read_metadata: true,
            can_preview: false,
            can_watch: false,
            can_request_materialization: false,
            can_add_to_library: true,
        };
        assert_eq!(
            serde_json::to_value(capabilities).unwrap(),
            json!({
                "canBrowse": true,
                "canReadMetadata": true,
                "canPreview": false,
                "canWatch": false,
                "canRequestMaterialization": false,
                "canAddToLibrary": true
            })
        );
    }

    #[test]
    fn strict_structs_reject_unknown_fields() {
        let invalid_path = json!({ "id": "path-1", "path": "/tmp/not-authority" });
        assert!(serde_json::from_value::<BrowsePathRef>(invalid_path).is_err());

        let invalid_enumeration = json!({
            "sessionId": "browse-1",
            "requestId": "request-1",
            "enumerationId": "enum-1",
            "path": "/tmp/not-authority"
        });
        assert!(serde_json::from_value::<BrowseEnumerationRef>(invalid_enumeration).is_err());

        let invalid_lease = json!({
            "leaseId": "lease-1",
            "requestId": "request-1",
            "sourceVersion": "version-1",
            "path": "/tmp/not-authority"
        });
        assert!(serde_json::from_value::<ContentReadLeaseRef>(invalid_lease).is_err());

        let invalid_capabilities = json!({
            "canBrowse": true,
            "canReadMetadata": true,
            "canPreview": true,
            "canWatch": true,
            "canRequestMaterialization": true,
            "canAddToLibrary": true,
            "path": "/tmp/not-authority"
        });
        assert!(serde_json::from_value::<LocationCapabilities>(invalid_capabilities).is_err());
    }

    #[test]
    fn strict_tagged_refs_reject_unknown_fields() {
        let invalid_entry = json!({
            "kind": "managed",
            "fileId": "file-1",
            "path": "/tmp/not-authority"
        });
        assert!(serde_json::from_value::<EntryRef>(invalid_entry).is_err());

        let invalid_location = json!({
            "kind": "ephemeral",
            "browseSessionId": "browse-1",
            "locationId": "location-1",
            "path": "/tmp/not-authority"
        });
        assert!(serde_json::from_value::<LocationRef>(invalid_location).is_err());

        let invalid_navigation_target = json!({
            "kind": "library",
            "source": "saved_view",
            "key": "recent-files",
            "path": "/tmp/not-authority"
        });
        assert!(serde_json::from_value::<NavigationTarget>(invalid_navigation_target).is_err());

        let invalid_preview_source = json!({
            "kind": "host_provided",
            "hostToken": "host-token-1",
            "path": "/tmp/not-authority"
        });
        assert!(serde_json::from_value::<PreviewSourceRef>(invalid_preview_source).is_err());

        let invalid_restore_locator = json!({
            "kind": "library",
            "source": "saved_view",
            "key": "recent-files",
            "routingHint": "/tmp/not-authority"
        });
        assert!(
            serde_json::from_value::<WorkspaceRestoreLocator>(invalid_restore_locator).is_err()
        );
    }
}
