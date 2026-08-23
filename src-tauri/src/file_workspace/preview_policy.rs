//! W3-01 Preview composition and capability policy.
//!
//! This module is the single production composition root for Preview
//! providers and the backend-owned policy point for activated Zen hosts and
//! source capability projections. It deliberately does not inspect filename
//! extensions or create a second read/materialization authority.

use super::{
    contracts::{ContentReadEligibility, MaterializationState, PreviewHostKind, PreviewSourceRef},
    preview::{
        PreviewCapabilities, PreviewProvider, PreviewProviderRegistry, PreviewRegistryError,
    },
    preview_providers::production_preview_providers,
};
use std::sync::Arc;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum PreviewSourceEntryKind {
    File,
    Directory,
}

/// The only production registry composition owner. Built-in providers are
/// added here, not to PreviewSession orchestration or individual commands.
pub(crate) fn production_preview_provider_registry(
) -> Result<Arc<PreviewProviderRegistry>, PreviewRegistryError> {
    let providers: Vec<Arc<dyn PreviewProvider>> = production_preview_providers();
    Ok(Arc::new(PreviewProviderRegistry::new(providers)?))
}

/// Capabilities describe what an activated Zen host can render/control. They
/// are intentionally broader than the current metadata-only registry so that
/// later providers can consume one stable host policy. Materialization stays
/// false because W3-01 has no authoritative renderer action for it.
pub(crate) fn activated_host_capabilities(
    host: PreviewHostKind,
) -> Result<PreviewCapabilities, &'static str> {
    match host {
        PreviewHostKind::ZenFloating => Ok(PreviewCapabilities {
            can_search: true,
            can_zoom: true,
            can_playback: true,
            can_select_text: true,
            can_navigate_internal: true,
            can_navigate_siblings: true,
            can_open_external: true,
            can_reveal: true,
            can_request_materialization: false,
        }),
        PreviewHostKind::ZenPinned => Ok(PreviewCapabilities {
            can_search: true,
            can_zoom: true,
            can_playback: true,
            can_select_text: true,
            can_navigate_internal: true,
            can_navigate_siblings: true,
            can_open_external: true,
            can_reveal: true,
            can_request_materialization: false,
        }),
        PreviewHostKind::MacQuickLookExtension
        | PreviewHostKind::WindowsQuickPreview
        | PreviewHostKind::WindowsPreviewHandler => Err("preview_host_not_activated"),
    }
}

/// Project source-side boundaries from backend-known facts. The source layer
/// grants only what it can prove; provider capabilities still narrow the
/// result. In particular, a source never becomes text/image/media-capable from
/// an extension alone, and it never grants a materialization action.
pub(crate) fn project_source_capabilities(
    source: &PreviewSourceRef,
    entry_kind: PreviewSourceEntryKind,
    eligibility: ContentReadEligibility,
    materialization: MaterializationState,
    source_available: bool,
) -> PreviewCapabilities {
    if matches!(source, PreviewSourceRef::HostProvided { .. }) || !source_available {
        return PreviewCapabilities::default();
    }

    let safe_metadata_actions = !matches!(
        eligibility,
        ContentReadEligibility::PermissionRequired
            | ContentReadEligibility::SourceUnavailable
            | ContentReadEligibility::IdentityChanged
            | ContentReadEligibility::AvailabilityUnknown
    );
    let content_readable = eligibility == ContentReadEligibility::Eligible
        && matches!(
            materialization,
            MaterializationState::Local | MaterializationState::BoundaryReadable
        );

    match entry_kind {
        PreviewSourceEntryKind::Directory => PreviewCapabilities {
            can_search: false,
            can_zoom: false,
            can_playback: false,
            can_select_text: false,
            can_navigate_internal: safe_metadata_actions,
            can_navigate_siblings: false,
            can_open_external: safe_metadata_actions && content_readable,
            can_reveal: safe_metadata_actions,
            can_request_materialization: false,
        },
        PreviewSourceEntryKind::File => PreviewCapabilities {
            can_search: content_readable,
            can_zoom: content_readable,
            can_playback: content_readable,
            can_select_text: content_readable,
            can_navigate_internal: content_readable,
            can_navigate_siblings: false,
            can_open_external: safe_metadata_actions && content_readable,
            can_reveal: safe_metadata_actions,
            can_request_materialization: false,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn managed_source() -> PreviewSourceRef {
        PreviewSourceRef::Managed {
            file_id: "file-1".to_string(),
        }
    }

    fn ephemeral_source() -> PreviewSourceRef {
        PreviewSourceRef::Ephemeral {
            browse_session_id: "browse-1".to_string(),
            entry_id: "entry-1".to_string(),
        }
    }

    #[test]
    fn production_registry_has_one_composition_owner_and_is_deterministic() {
        let first = production_preview_provider_registry().expect("production registry");
        let second = production_preview_provider_registry().expect("production registry");
        assert_eq!(
            first.provider_ids(),
            vec![
                "builtin.markdown".to_string(),
                "builtin.structured-json".to_string(),
                "builtin.structured-yaml".to_string(),
                "builtin.structured-xml".to_string(),
                "builtin.table-csv".to_string(),
                "builtin.table-tsv".to_string(),
                "builtin.source-code".to_string(),
                "builtin.text".to_string()
            ]
        );
        assert_eq!(first.provider_ids(), second.provider_ids());
    }

    #[test]
    fn only_zen_hosts_are_activated_with_explicit_matrices() {
        let floating = activated_host_capabilities(PreviewHostKind::ZenFloating)
            .expect("floating host policy");
        let pinned =
            activated_host_capabilities(PreviewHostKind::ZenPinned).expect("pinned host policy");
        assert!(floating.can_search);
        assert!(floating.can_zoom);
        assert!(floating.can_select_text);
        assert!(pinned.can_navigate_siblings);
        assert!(!floating.can_request_materialization);
        assert!(!pinned.can_request_materialization);
        assert_eq!(
            activated_host_capabilities(PreviewHostKind::MacQuickLookExtension),
            Err("preview_host_not_activated")
        );
        assert_eq!(
            activated_host_capabilities(PreviewHostKind::WindowsPreviewHandler),
            Err("preview_host_not_activated")
        );
    }

    #[test]
    fn source_projection_uses_read_state_not_extension_or_source_shape() {
        for source in [managed_source(), ephemeral_source()] {
            let eligible = project_source_capabilities(
                &source,
                PreviewSourceEntryKind::File,
                ContentReadEligibility::Eligible,
                MaterializationState::BoundaryReadable,
                true,
            );
            assert!(eligible.can_select_text);
            assert!(eligible.can_zoom);
            assert!(!eligible.can_navigate_siblings);

            let metadata_only = project_source_capabilities(
                &source,
                PreviewSourceEntryKind::File,
                ContentReadEligibility::MetadataOnly,
                MaterializationState::MetadataOnly,
                true,
            );
            assert!(!metadata_only.can_select_text);
            assert!(!metadata_only.can_zoom);
            assert!(metadata_only.can_reveal);
            assert!(!metadata_only.can_request_materialization);
        }
    }

    #[test]
    fn directory_projection_preserves_bounded_navigation_without_byte_authority() {
        let capabilities = project_source_capabilities(
            &managed_source(),
            PreviewSourceEntryKind::Directory,
            ContentReadEligibility::SourceNotSupported,
            MaterializationState::MetadataOnly,
            true,
        );
        assert!(capabilities.can_navigate_internal);
        assert!(!capabilities.can_select_text);
        assert!(!capabilities.can_open_external);
        assert!(capabilities.can_reveal);
    }

    #[test]
    fn unavailable_and_host_provided_sources_fail_closed() {
        let unavailable = project_source_capabilities(
            &managed_source(),
            PreviewSourceEntryKind::File,
            ContentReadEligibility::SourceUnavailable,
            MaterializationState::Unavailable,
            false,
        );
        assert_eq!(unavailable, PreviewCapabilities::default());

        let host_provided = project_source_capabilities(
            &PreviewSourceRef::HostProvided {
                host_token: "host-1".to_string(),
            },
            PreviewSourceEntryKind::File,
            ContentReadEligibility::Eligible,
            MaterializationState::BoundaryReadable,
            true,
        );
        assert_eq!(host_provided, PreviewCapabilities::default());
    }
}
