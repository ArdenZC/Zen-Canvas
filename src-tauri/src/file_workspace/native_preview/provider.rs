//! macOS native Quick Look Preview provider.
//!
//! This provider is intentionally a small adapter around the W4-01 Native
//! Preview Access registry. It participates in the existing PreviewProvider
//! registry, stages through the existing ReadGate, and publishes only the
//! host-bound `NativeOpaque` representation. It never exposes the staged path
//! or creates a second byte-read authority.

use super::access::{
    NativePreviewAccessError, NativePreviewAccessRegistry, NativePreviewAccessRequest,
};
use crate::file_workspace::{
    contracts::{ContentReadEligibility, PreviewHostKind, PreviewSourceRef},
    preview::{
        PreparedPreview, PreviewCapabilities, PreviewContextError, PreviewOperationContext,
        PreviewProvider, PreviewProviderDescriptor, PreviewProviderEnvironment,
        PreviewProviderError, PreviewProviderResult, PreviewRepresentation, PreviewSourceSnapshot,
        ProviderProbe,
    },
};
use std::sync::Arc;

const ZEN_HOSTS: &[PreviewHostKind] = &[PreviewHostKind::ZenFloating, PreviewHostKind::ZenPinned];
const PROVIDER_ID: &str = "native.macos.quick-look";

pub(crate) struct MacNativePreviewProvider {
    descriptor: PreviewProviderDescriptor,
    access: Arc<NativePreviewAccessRegistry>,
}

impl MacNativePreviewProvider {
    pub(crate) fn new(access: Arc<NativePreviewAccessRegistry>) -> Self {
        Self {
            descriptor: PreviewProviderDescriptor::new(
                PROVIDER_ID,
                50,
                PreviewCapabilities {
                    can_zoom: true,
                    can_select_text: true,
                    can_reveal: true,
                    ..PreviewCapabilities::default()
                },
                ZEN_HOSTS.to_vec(),
                true,
            ),
            access,
        }
    }
}

impl PreviewProvider for MacNativePreviewProvider {
    fn descriptor(&self) -> &PreviewProviderDescriptor {
        &self.descriptor
    }

    fn probe(
        &self,
        snapshot: &PreviewSourceSnapshot,
        _context: &PreviewOperationContext,
    ) -> ProviderProbe {
        if supports_pdf(snapshot) {
            ProviderProbe::Compatible
        } else {
            ProviderProbe::Unsupported
        }
    }

    fn prepare(
        &self,
        snapshot: &PreviewSourceSnapshot,
        _context: &PreviewOperationContext,
    ) -> Result<Box<dyn PreparedPreview>, PreviewProviderError> {
        if !supports_pdf(snapshot) {
            return Err(PreviewProviderError::Unsupported);
        }
        Ok(Box::new(PreparedMacNativePreview {
            access: Arc::clone(&self.access),
            source: snapshot.source.clone(),
            source_version: snapshot.source_version.clone(),
        }))
    }
}

struct PreparedMacNativePreview {
    access: Arc<NativePreviewAccessRegistry>,
    source: PreviewSourceRef,
    source_version: String,
}

impl PreparedPreview for PreparedMacNativePreview {
    fn load(
        &mut self,
        context: &PreviewOperationContext,
        _environment: PreviewProviderEnvironment<'_>,
    ) -> Result<PreviewProviderResult, PreviewProviderError> {
        context.ensure_active().map_err(map_context_error)?;
        let Some(source_version) = context.source_version() else {
            return Err(PreviewProviderError::Failed);
        };
        if source_version != self.source_version {
            return Err(PreviewProviderError::IdentityChanged);
        }

        // The Preview session supplies the activated host through the
        // operation context. The provider is only ever composed for Zen
        // hosts, so the host is kept explicit in the access tuple rather than
        // inferred by the renderer.
        let host = context.host();
        if !ZEN_HOSTS.contains(&host) {
            return Err(PreviewProviderError::Unsupported);
        }
        let handle = self
            .access
            .stage(
                NativePreviewAccessRequest {
                    session_id: context.session_id().to_string(),
                    request_id: context.request_id().to_string(),
                    source: self.source.clone(),
                    source_version: self.source_version.clone(),
                    host,
                },
                context,
            )
            .map_err(map_access_error)?;

        Ok(PreviewProviderResult {
            representation: PreviewRepresentation::NativeOpaque {
                host,
                token: handle.token,
            },
            completeness: crate::file_workspace::PreviewCompleteness::Complete,
            warnings: Vec::new(),
        })
    }

    fn cleanup(&mut self) {}
}

fn supports_pdf(snapshot: &PreviewSourceSnapshot) -> bool {
    if snapshot.entry_kind != crate::file_workspace::PreviewEntryKind::File
        || snapshot.metadata.read_eligibility != ContentReadEligibility::Eligible
        || !snapshot.capabilities.can_zoom
        || matches!(snapshot.source, PreviewSourceRef::HostProvided { .. })
    {
        return false;
    }

    let extension_is_pdf = snapshot
        .metadata
        .extension
        .as_deref()
        .is_some_and(|extension| extension.trim().eq_ignore_ascii_case("pdf"));
    let media_type_is_pdf = snapshot
        .metadata
        .media_type
        .as_deref()
        .is_some_and(|media_type| media_type.trim().eq_ignore_ascii_case("application/pdf"));
    extension_is_pdf || media_type_is_pdf
}

fn map_context_error(error: PreviewContextError) -> PreviewProviderError {
    match error {
        PreviewContextError::Cancelled | PreviewContextError::StalePublication => {
            PreviewProviderError::Cancelled
        }
        PreviewContextError::TimedOut => PreviewProviderError::Timeout,
    }
}

fn map_access_error(error: NativePreviewAccessError) -> PreviewProviderError {
    match error {
        NativePreviewAccessError::UnsupportedHost
        | NativePreviewAccessError::UnsupportedSource
        | NativePreviewAccessError::InvalidRequest
        | NativePreviewAccessError::CapacityExceeded
        | NativePreviewAccessError::SourceTooLarge
        | NativePreviewAccessError::MetadataOnly => PreviewProviderError::Unsupported,
        NativePreviewAccessError::SourceUnavailable => PreviewProviderError::SourceUnavailable,
        NativePreviewAccessError::MaterializationRequired => {
            PreviewProviderError::MaterializationRequired
        }
        NativePreviewAccessError::PermissionDenied => PreviewProviderError::PermissionDenied,
        NativePreviewAccessError::IdentityChanged => PreviewProviderError::IdentityChanged,
        NativePreviewAccessError::Cancelled => PreviewProviderError::Cancelled,
        NativePreviewAccessError::TimedOut => PreviewProviderError::Timeout,
        NativePreviewAccessError::InvalidOrStale
        | NativePreviewAccessError::Disposed
        | NativePreviewAccessError::Failed => PreviewProviderError::Failed,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::file_workspace::{
        contracts::MaterializationState,
        preview::{PreviewMetadata, PreviewSourceSnapshot},
    };

    fn snapshot(extension: Option<&str>, media_type: Option<&str>) -> PreviewSourceSnapshot {
        PreviewSourceSnapshot::new(
            PreviewSourceRef::Managed {
                file_id: "file-1".to_string(),
            },
            "version-1",
            PreviewMetadata {
                display_name: "document.pdf".to_string(),
                media_type: media_type.map(str::to_owned),
                extension: extension.map(str::to_owned),
                size_bytes: Some(1),
                modified_at_epoch_ms: None,
                materialization: MaterializationState::BoundaryReadable,
                read_eligibility: ContentReadEligibility::Eligible,
            },
            PreviewCapabilities {
                can_zoom: true,
                ..PreviewCapabilities::default()
            },
        )
    }

    #[test]
    fn pdf_selection_uses_backend_metadata_and_rejects_host_provided_sources() {
        assert!(supports_pdf(&snapshot(Some("PDF"), None)));
        assert!(supports_pdf(&snapshot(None, Some("application/pdf"))));
        assert!(!supports_pdf(&snapshot(Some("txt"), Some("text/plain"))));

        let mut host_provided = snapshot(Some("pdf"), None);
        host_provided.source = PreviewSourceRef::HostProvided {
            host_token: "host-token".to_string(),
        };
        assert!(!supports_pdf(&host_provided));
    }
}
