use super::{
    runtime::{FileWorkspaceRuntime, MAX_PREVIEW_SESSIONS},
    types::{
        PreviewAssetArtifactDto, PreviewAssetRequestDto, PreviewCreateRequest,
        PreviewSessionRequest, PreviewSnapshotDto, PreviewSwitchSourceRequest,
    },
};
use crate::{
    db::Database,
    file_workspace::{
        browse::{BrowseEntryKind, BrowseService},
        contracts::{ContentReadEligibility, MaterializationState, PreviewSourceRef},
        preview::{
            PreviewContextError, PreviewHost, PreviewOperationContext,
            PreviewProviderEnvironmentHandle, PreviewRequest, PreviewResolveRequest,
            PreviewSession, PreviewSessionConfig, PreviewSourceSnapshot, SourceResolveError,
            SourceResolver,
        },
        preview_policy::{
            activated_host_capabilities, project_source_capabilities, PreviewSourceEntryKind,
        },
        read_gate::{MaterializationReadGate, PreviewReadGateAdapter, ReadGateError},
    },
    fs_safety::capture_namespace_identity_only,
};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Arc,
    time::UNIX_EPOCH,
};

/// W1 resolver adapter. It resolves managed sources through the existing
/// File Library detail authority and ephemeral sources through the same
/// BrowseService that issued their refs. It only publishes metadata snapshots.
pub(crate) struct WorkspacePreviewResolver {
    database: Database,
    browse: Arc<BrowseService>,
    read_gate: Arc<MaterializationReadGate>,
}

impl WorkspacePreviewResolver {
    pub(crate) fn new(
        database: Database,
        browse: Arc<BrowseService>,
        read_gate: Arc<MaterializationReadGate>,
    ) -> Self {
        Self {
            database,
            browse,
            read_gate,
        }
    }
}

impl SourceResolver for WorkspacePreviewResolver {
    fn resolve(
        &self,
        request: &PreviewResolveRequest,
        context: &PreviewOperationContext,
    ) -> Result<PreviewSourceSnapshot, SourceResolveError> {
        context.ensure_active().map_err(map_context_error)?;
        let source = request.source.clone();
        let resolved = self.resolve_metadata(&source)?;
        context.ensure_active().map_err(map_context_error)?;

        let eligibility = self.read_gate.content_read_eligibility(&source);
        let source_version = source_version_for_metadata(&self.read_gate, &source, &resolved.path)?;
        let materialization = materialization_for_eligibility(eligibility);
        let metadata = crate::file_workspace::PreviewMetadata {
            display_name: resolved.display_name,
            media_type: None,
            extension: resolved.extension,
            size_bytes: Some(resolved.size_bytes),
            modified_at_epoch_ms: resolved.modified_at_epoch_ms,
            materialization,
            read_eligibility: eligibility,
        };
        let capabilities = project_source_capabilities(
            &source,
            resolved.entry_kind,
            eligibility,
            materialization,
            true,
        );
        Ok(PreviewSourceSnapshot::new(
            source,
            source_version,
            metadata,
            capabilities,
        ))
    }
}

struct ResolvedPreviewMetadata {
    path: PathBuf,
    display_name: String,
    extension: Option<String>,
    size_bytes: u64,
    modified_at_epoch_ms: Option<i64>,
    entry_kind: PreviewSourceEntryKind,
}

impl WorkspacePreviewResolver {
    fn resolve_metadata(
        &self,
        source: &PreviewSourceRef,
    ) -> Result<ResolvedPreviewMetadata, SourceResolveError> {
        match source {
            PreviewSourceRef::Managed { file_id } => {
                let detail = self
                    .database
                    .get_file_library_detail(file_id)
                    .map_err(|_| SourceResolveError::SourceUnavailable)?;
                let path = PathBuf::from(&detail.path);
                let metadata = fs::symlink_metadata(&path).map_err(map_metadata_error)?;
                Ok(ResolvedPreviewMetadata {
                    path,
                    display_name: detail.name,
                    extension: non_empty(detail.extension),
                    size_bytes: detail.size.max(0) as u64,
                    modified_at_epoch_ms: seconds_to_millis(detail.modified_at),
                    entry_kind: if metadata.is_dir() {
                        PreviewSourceEntryKind::Directory
                    } else {
                        PreviewSourceEntryKind::File
                    },
                })
                .and_then(|resolved| {
                    if metadata.is_file() || metadata.is_dir() {
                        Ok(resolved)
                    } else {
                        Err(SourceResolveError::SourceUnavailable)
                    }
                })
            }
            PreviewSourceRef::Ephemeral {
                browse_session_id,
                entry_id,
            } => {
                let entry_ref = crate::file_workspace::BrowseEntryRef::Ephemeral {
                    browse_session_id: browse_session_id.clone(),
                    entry_id: entry_id.clone(),
                };
                let entry = self
                    .browse
                    .resolve_entry(&entry_ref)
                    .map_err(|_| SourceResolveError::SourceUnavailable)?;
                let metadata = fs::symlink_metadata(&entry.path).map_err(map_metadata_error)?;
                if !matches!(
                    entry.kind,
                    BrowseEntryKind::File | BrowseEntryKind::Directory
                ) {
                    return Err(SourceResolveError::SourceUnavailable);
                }
                let display_name = entry
                    .path
                    .file_name()
                    .and_then(|value| value.to_str())
                    .filter(|value| !value.is_empty())
                    .unwrap_or("Browse entry")
                    .to_string();
                let extension = entry
                    .path
                    .extension()
                    .and_then(|value| value.to_str())
                    .filter(|value| !value.is_empty())
                    .map(str::to_owned);
                Ok(ResolvedPreviewMetadata {
                    path: entry.path,
                    display_name,
                    extension,
                    size_bytes: metadata.len(),
                    modified_at_epoch_ms: metadata.modified().ok().and_then(system_time_millis),
                    entry_kind: match entry.kind {
                        BrowseEntryKind::File => PreviewSourceEntryKind::File,
                        BrowseEntryKind::Directory => PreviewSourceEntryKind::Directory,
                    },
                })
            }
            PreviewSourceRef::HostProvided { .. } => Err(SourceResolveError::SourceUnavailable),
        }
    }
}

impl FileWorkspaceRuntime {
    pub(crate) fn create_preview(
        &self,
        request: PreviewCreateRequest,
    ) -> Result<PreviewSnapshotDto, String> {
        self.ensure_live()?;
        let mut previews = self
            .inner
            .preview_sessions
            .lock()
            .map_err(|_| "workspace_preview_state_unavailable".to_string())?;
        if previews.len() >= MAX_PREVIEW_SESSIONS {
            return Err("preview_session_capacity_exceeded".to_string());
        }
        let host_capabilities =
            activated_host_capabilities(request.host_kind).map_err(str::to_string)?;
        let preview_id = FileWorkspaceRuntime::next_id("preview");
        let session = PreviewSession::new(PreviewSessionConfig::new(
            preview_id.clone(),
            request.request_id,
            request.source,
            PreviewHost::new(request.host_kind, host_capabilities),
        ));
        let snapshot = PreviewSnapshotDto::from_internal(preview_id.clone(), session.snapshot());
        previews.insert(preview_id, session);
        Ok(snapshot)
    }

    pub(crate) fn snapshot_preview(
        &self,
        request: PreviewSessionRequest,
    ) -> Result<PreviewSnapshotDto, String> {
        self.ensure_live()?;
        let session = self
            .inner
            .preview_sessions
            .lock()
            .map_err(|_| "workspace_preview_state_unavailable".to_string())?
            .get(&request.preview_id)
            .cloned()
            .ok_or_else(|| "preview_session_not_found".to_string())?;
        Ok(PreviewSnapshotDto::from_internal(
            request.preview_id,
            session.snapshot(),
        ))
    }

    pub(crate) fn start_preview(
        &self,
        request: PreviewSessionRequest,
    ) -> Result<PreviewSnapshotDto, String> {
        self.ensure_live()?;
        let session = self
            .inner
            .preview_sessions
            .lock()
            .map_err(|_| "workspace_preview_state_unavailable".to_string())?
            .get(&request.preview_id)
            .cloned()
            .ok_or_else(|| "preview_session_not_found".to_string())?;
        let registry = Arc::clone(&self.inner.preview_registry);
        let preview_read = Arc::new(PreviewReadGateAdapter::new(Arc::clone(
            &self.inner.read_gate,
        )));
        let asset_publisher: Arc<dyn crate::file_workspace::PreviewAssetPublisher> =
            self.inner.preview_assets.clone();
        let decoder_admission = Arc::new(
            crate::scheduler::adapters::PreviewDecoderResourceLeaseAdapter::new(Arc::clone(
                &self.inner.scheduler,
            )),
        );
        let archive_admission = Arc::new(
            crate::scheduler::adapters::PreviewArchiveResourceLeaseAdapter::new(Arc::clone(
                &self.inner.scheduler,
            )),
        );
        let task = session
            .start_with_environment(
                Arc::clone(&self.inner.preview_resolver) as Arc<dyn SourceResolver>,
                registry,
                PreviewProviderEnvironmentHandle::with_preview_read_and_asset_publisher_and_decoder_and_archive(
                    preview_read,
                    asset_publisher,
                    decoder_admission,
                    archive_admission,
                ),
            )
            .map_err(map_preview_session_error)?;
        task.join().map_err(map_preview_run_error)?;
        Ok(PreviewSnapshotDto::from_internal(
            request.preview_id,
            session.snapshot(),
        ))
    }

    pub(crate) fn cancel_preview(&self, request: PreviewSessionRequest) -> Result<bool, String> {
        self.ensure_live()?;
        let session = self
            .inner
            .preview_sessions
            .lock()
            .map_err(|_| "workspace_preview_state_unavailable".to_string())?
            .get(&request.preview_id)
            .cloned()
            .ok_or_else(|| "preview_session_not_found".to_string())?;
        let cancelled = session.cancel();
        self.inner
            .preview_assets
            .revoke_session(&request.preview_id);
        Ok(cancelled)
    }

    pub(crate) fn dispose_preview(&self, request: PreviewSessionRequest) -> Result<bool, String> {
        self.ensure_live()?;
        let session = self
            .inner
            .preview_sessions
            .lock()
            .map_err(|_| "workspace_preview_state_unavailable".to_string())?
            .remove(&request.preview_id)
            .ok_or_else(|| "preview_session_not_found".to_string())?;
        let disposed = session.dispose();
        self.inner
            .preview_assets
            .revoke_session(&request.preview_id);
        Ok(disposed)
    }

    pub(crate) fn switch_preview_source(
        &self,
        request: PreviewSwitchSourceRequest,
    ) -> Result<PreviewSnapshotDto, String> {
        self.ensure_live()?;
        let session = self
            .inner
            .preview_sessions
            .lock()
            .map_err(|_| "workspace_preview_state_unavailable".to_string())?
            .get(&request.preview_id)
            .cloned()
            .ok_or_else(|| "preview_session_not_found".to_string())?;
        let superseded = session.snapshot();
        session
            .switch_source(PreviewRequest {
                request_id: request.request_id,
                source: request.source,
            })
            .map_err(map_preview_session_error)?;
        self.inner.preview_assets.revoke_request(
            &request.preview_id,
            &superseded.request_id,
            superseded.source_version.as_deref(),
        );
        Ok(PreviewSnapshotDto::from_internal(
            request.preview_id,
            session.snapshot(),
        ))
    }

    pub(crate) fn request_preview_asset(
        &self,
        request: PreviewAssetRequestDto,
    ) -> Result<PreviewAssetArtifactDto, String> {
        self.ensure_live()?;
        let artifact = self
            .inner
            .preview_assets
            .read(&crate::file_workspace::preview_asset::PreviewAssetRequest {
                session_id: request.preview_id,
                request_id: request.request_id,
                source_version: request.source_version,
                asset_token: request.asset_token,
            })
            .map_err(|error| format!("preview_asset_{error}"))?;
        Ok(PreviewAssetArtifactDto {
            media_type: artifact.media_type,
            bytes: artifact.bytes,
        })
    }
}

fn map_context_error(error: PreviewContextError) -> SourceResolveError {
    match error {
        PreviewContextError::Cancelled => SourceResolveError::Cancelled,
        PreviewContextError::TimedOut => SourceResolveError::Timeout,
        PreviewContextError::StalePublication => SourceResolveError::Cancelled,
    }
}

fn map_metadata_error(error: std::io::Error) -> SourceResolveError {
    match error.kind() {
        std::io::ErrorKind::PermissionDenied => SourceResolveError::PermissionDenied,
        std::io::ErrorKind::NotFound => SourceResolveError::SourceUnavailable,
        _ => SourceResolveError::Failed,
    }
}

fn namespace_source_version(path: &Path) -> Result<String, SourceResolveError> {
    let identity = capture_namespace_identity_only(path, None)
        .map_err(|_| SourceResolveError::SourceUnavailable)?;
    let encoded = serde_json::to_vec(&identity).map_err(|_| SourceResolveError::Failed)?;
    Ok(format!(
        "metadata-source-v1:{}",
        blake3::hash(&encoded).to_hex()
    ))
}

/// Metadata Preview may use a namespace-only version when W1-07 deliberately
/// declines byte-read eligibility for a directory/package or a
/// materialization-only source. Identity/availability failures never take
/// this fallback: swallowing those errors would publish a fresh-looking
/// version for a source whose identity could not be revalidated.
fn source_version_for_metadata(
    read_gate: &MaterializationReadGate,
    source: &PreviewSourceRef,
    path: &Path,
) -> Result<String, SourceResolveError> {
    match read_gate.current_source_version(source) {
        Ok(version) => Ok(version),
        Err(error) if metadata_source_version_fallback_allowed(error) => {
            namespace_source_version(path)
        }
        Err(error) => Err(map_read_gate_source_version_error(error)),
    }
}

fn metadata_source_version_fallback_allowed(error: ReadGateError) -> bool {
    matches!(
        error,
        ReadGateError::MaterializationRequired
            | ReadGateError::Downloading
            | ReadGateError::MetadataOnly
            | ReadGateError::SourceNotSupported
            | ReadGateError::PackageUnsupported
    )
}

fn map_read_gate_source_version_error(error: ReadGateError) -> SourceResolveError {
    match error {
        ReadGateError::SourceUnavailable => SourceResolveError::SourceUnavailable,
        ReadGateError::PermissionDenied => SourceResolveError::PermissionDenied,
        ReadGateError::IdentityChanged => SourceResolveError::IdentityChanged,
        ReadGateError::MaterializationRequired => SourceResolveError::MaterializationRequired,
        ReadGateError::Downloading
        | ReadGateError::MetadataOnly
        | ReadGateError::SourceNotSupported
        | ReadGateError::PackageUnsupported
        | ReadGateError::AvailabilityUnknown
        | ReadGateError::Symlink
        | ReadGateError::LeaseInvalid
        | ReadGateError::InvalidRequest
        | ReadGateError::LeaseCapacityExceeded
        | ReadGateError::Disposed => SourceResolveError::Failed,
    }
}

fn materialization_for_eligibility(value: ContentReadEligibility) -> MaterializationState {
    match value {
        ContentReadEligibility::Eligible => MaterializationState::BoundaryReadable,
        ContentReadEligibility::MaterializationRequired => MaterializationState::RemotePlaceholder,
        ContentReadEligibility::Downloading => MaterializationState::Hydrating,
        ContentReadEligibility::MetadataOnly => MaterializationState::MetadataOnly,
        ContentReadEligibility::PermissionRequired
        | ContentReadEligibility::SourceUnavailable
        | ContentReadEligibility::SourceNotSupported
        | ContentReadEligibility::PackageUnsupported
        | ContentReadEligibility::Symlink
        | ContentReadEligibility::IdentityChanged => MaterializationState::Unavailable,
        ContentReadEligibility::AvailabilityUnknown => MaterializationState::Unknown,
    }
}

fn seconds_to_millis(value: i64) -> Option<i64> {
    value.checked_mul(1_000)
}

fn system_time_millis(value: std::time::SystemTime) -> Option<i64> {
    value
        .duration_since(UNIX_EPOCH)
        .ok()
        .and_then(|duration| i64::try_from(duration.as_millis()).ok())
}

fn non_empty(value: String) -> Option<String> {
    (!value.trim().is_empty()).then_some(value)
}

fn map_preview_session_error(error: crate::file_workspace::PreviewSessionError) -> String {
    match error {
        crate::file_workspace::PreviewSessionError::Disposed => {
            "preview_session_disposed".to_string()
        }
        crate::file_workspace::PreviewSessionError::InvalidRequest => {
            "preview_request_invalid".to_string()
        }
        crate::file_workspace::PreviewSessionError::AlreadyRunning => {
            "preview_session_already_running".to_string()
        }
        crate::file_workspace::PreviewSessionError::InvalidState(_) => {
            "preview_session_invalid_state".to_string()
        }
        crate::file_workspace::PreviewSessionError::ExecutionUnavailable(_) => {
            "preview_execution_unavailable".to_string()
        }
    }
}

fn map_preview_run_error(error: crate::file_workspace::PreviewRunError) -> String {
    match error {
        crate::file_workspace::PreviewRunError::Session(error) => map_preview_session_error(error),
        crate::file_workspace::PreviewRunError::SourceResolver(error) => match error {
            SourceResolveError::SourceUnavailable => "preview_source_unavailable".to_string(),
            SourceResolveError::MaterializationRequired => {
                "preview_materialization_required".to_string()
            }
            SourceResolveError::PermissionDenied => "preview_permission_denied".to_string(),
            SourceResolveError::IdentityChanged => "preview_source_identity_changed".to_string(),
            SourceResolveError::Timeout => "preview_source_timeout".to_string(),
            SourceResolveError::Cancelled => "preview_cancelled".to_string(),
            SourceResolveError::SourceMismatch => "preview_source_mismatch".to_string(),
            SourceResolveError::Failed => "preview_source_resolution_failed".to_string(),
        },
        crate::file_workspace::PreviewRunError::ProviderTerminal { .. } => {
            "preview_terminal_condition".to_string()
        }
        crate::file_workspace::PreviewRunError::Cancelled => "preview_cancelled".to_string(),
        crate::file_workspace::PreviewRunError::StalePublication => {
            "preview_stale_publication".to_string()
        }
        crate::file_workspace::PreviewRunError::ExecutionUnavailable(_) => {
            "preview_execution_unavailable".to_string()
        }
        crate::file_workspace::PreviewRunError::WorkerPanicked => {
            "preview_worker_failed".to_string()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{metadata_source_version_fallback_allowed, ReadGateError};

    #[test]
    fn metadata_version_fallback_does_not_swallow_identity_or_availability_failures() {
        assert!(metadata_source_version_fallback_allowed(
            ReadGateError::SourceNotSupported
        ));
        assert!(metadata_source_version_fallback_allowed(
            ReadGateError::MaterializationRequired
        ));
        assert!(!metadata_source_version_fallback_allowed(
            ReadGateError::IdentityChanged
        ));
        assert!(!metadata_source_version_fallback_allowed(
            ReadGateError::SourceUnavailable
        ));
        assert!(!metadata_source_version_fallback_allowed(
            ReadGateError::AvailabilityUnknown
        ));
    }
}
