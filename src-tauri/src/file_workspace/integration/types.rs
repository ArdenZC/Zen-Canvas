use super::super::{
    browse::{BrowseCompletion, BrowsePage, EphemeralBrowseEntry},
    change::{EphemeralChangeHint, EphemeralChangeKind, EphemeralRefreshRequest},
    contracts::{
        BrowseEnumerationRef, BrowsePathRef, ContentReadEligibility, EntryRef,
        MaterializationState, PreviewHostKind, PreviewSourceRef, WorkClass, WorkspacePlatform,
        WorkspaceRestoreLocator,
    },
    location::LocationDescriptor,
    preview::{
        PreviewCapabilities, PreviewRepresentationEnvelope, PreviewSessionSnapshot,
        PreviewSessionState,
    },
    thumbnail::{ThumbnailArtifact, ThumbnailVariant},
};
use serde::{Deserialize, Serialize};

const MAX_REQUEST_TEXT_LENGTH: usize = 4096;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BrowseOpenRequest {
    pub platform: WorkspacePlatform,
    pub routing_hint: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_hint: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BrowseOpenResponse {
    pub session_id: String,
    pub location: LocationDescriptor,
    pub root_path_ref: BrowsePathRef,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BrowseRestoreRequest {
    pub locator: WorkspaceRestoreLocator,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BrowseStartEnumerationRequest {
    pub session_id: String,
    pub request_id: String,
    pub path_ref: BrowsePathRef,
    pub page_size: usize,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BrowseNextPageRequest {
    pub session_id: String,
    pub cursor: String,
    pub page_size: usize,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BrowseCancelRequest {
    pub session_id: String,
    pub enumeration: BrowseEnumerationRef,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BrowseReleasePageRequest {
    pub page: BrowsePageDto,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BrowseReleasePathRequest {
    pub session_id: String,
    pub path_ref: BrowsePathRef,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BrowseSessionRequest {
    pub session_id: String,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BrowseCompletionDto {
    Partial,
    Complete,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BrowseEntryDto {
    #[serde(rename = "ref")]
    pub entry_ref: EntryRef,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path_ref: Option<BrowsePathRef>,
    pub name: String,
    /// Presentation only. This field is never accepted by a resolver.
    pub display_path: String,
    pub kind: BrowseEntryKindDto,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub extension: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub modified_at: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<i64>,
    pub materialization: MaterializationState,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BrowseEntryKindDto {
    File,
    Directory,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BrowsePageDto {
    pub session_id: String,
    pub request_id: String,
    pub enumeration_id: String,
    pub entries: Vec<BrowseEntryDto>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
    pub completion: BrowseCompletionDto,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub known_count: Option<usize>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LocationListRequest {}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ChangeStartRequest {
    pub session_id: String,
    pub path_ref: BrowsePathRef,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ChangeStartResponse {
    pub monitor_id: String,
    pub session_id: String,
    pub path_ref: BrowsePathRef,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ChangePendingRequest {
    pub monitor_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ChangePendingResponse {
    pub monitor_id: String,
    pub sequence: u64,
    pub hint: ChangeHintDto,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ChangeKindDto {
    ContentChanged,
    Renamed,
    TargetUnavailable,
    Uncertain,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ChangeHintDto {
    pub kind: ChangeKindDto,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ChangeRefreshRequest {
    pub monitor_id: String,
    pub request_id: String,
    pub page_size: usize,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReadEligibilityRequest {
    pub source: PreviewSourceRef,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReadEligibilityResponse {
    pub source: PreviewSourceRef,
    pub eligibility: ContentReadEligibility,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ThumbnailVariantDto {
    Small,
    Medium,
    Large,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ThumbnailRequestDto {
    pub request_id: String,
    pub source: EntryRef,
    pub variant: ThumbnailVariantDto,
    pub work_class: WorkClass,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_generation: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ThumbnailCancelRequest {
    pub request_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ThumbnailArtifactDto {
    pub cache_key: String,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PreviewCreateRequest {
    pub request_id: String,
    pub source: PreviewSourceRef,
    pub host_kind: PreviewHostKind,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PreviewSessionRequest {
    pub preview_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PreviewSwitchSourceRequest {
    pub preview_id: String,
    pub request_id: String,
    pub source: PreviewSourceRef,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PreviewSnapshotDto {
    pub preview_id: String,
    pub session_id: String,
    pub request_id: String,
    pub source: PreviewSourceRef,
    pub host_kind: PreviewHostKind,
    pub state: PreviewSessionStateDto,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub representation: Option<PreviewRepresentationEnvelope>,
    pub effective_capabilities: PreviewCapabilities,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active_provider_id: Option<String>,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PreviewSessionStateDto {
    Idle,
    Resolving,
    Preparing,
    Loading,
    Ready,
    Failed,
    Cancelled,
    Disposed,
}

impl BrowsePageDto {
    pub(crate) fn from_internal(page: BrowsePage) -> Self {
        Self {
            session_id: page.session_id,
            request_id: page.request_id,
            enumeration_id: page.enumeration_id,
            entries: page
                .entries
                .into_iter()
                .map(BrowseEntryDto::from_internal)
                .collect(),
            next_cursor: page.next_cursor,
            completion: match page.completion {
                BrowseCompletion::Partial => BrowseCompletionDto::Partial,
                BrowseCompletion::Complete => BrowseCompletionDto::Complete,
            },
            known_count: page.known_count,
        }
    }

    pub(crate) fn into_internal(self) -> BrowsePage {
        BrowsePage {
            session_id: self.session_id,
            request_id: self.request_id,
            enumeration_id: self.enumeration_id,
            entries: self
                .entries
                .into_iter()
                .map(BrowseEntryDto::into_internal)
                .collect(),
            next_cursor: self.next_cursor,
            completion: match self.completion {
                BrowseCompletionDto::Partial => BrowseCompletion::Partial,
                BrowseCompletionDto::Complete => BrowseCompletion::Complete,
            },
            known_count: self.known_count,
        }
    }
}

impl BrowseEntryDto {
    fn from_internal(entry: EphemeralBrowseEntry) -> Self {
        Self {
            entry_ref: entry.entry_ref,
            path_ref: entry.path_ref,
            name: entry.name,
            display_path: entry.display_path,
            kind: match entry.kind {
                super::super::browse::BrowseEntryKind::File => BrowseEntryKindDto::File,
                super::super::browse::BrowseEntryKind::Directory => BrowseEntryKindDto::Directory,
            },
            extension: entry.extension,
            size: entry.size,
            modified_at: entry.modified_at,
            created_at: entry.created_at,
            materialization: entry.materialization,
        }
    }

    fn into_internal(self) -> EphemeralBrowseEntry {
        EphemeralBrowseEntry {
            entry_ref: self.entry_ref,
            path_ref: self.path_ref,
            name: self.name,
            display_path: self.display_path,
            kind: match self.kind {
                BrowseEntryKindDto::File => super::super::browse::BrowseEntryKind::File,
                BrowseEntryKindDto::Directory => super::super::browse::BrowseEntryKind::Directory,
            },
            extension: self.extension,
            size: self.size,
            modified_at: self.modified_at,
            created_at: self.created_at,
            materialization: self.materialization,
        }
    }
}

impl From<EphemeralChangeKind> for ChangeKindDto {
    fn from(value: EphemeralChangeKind) -> Self {
        match value {
            EphemeralChangeKind::ContentChanged => Self::ContentChanged,
            EphemeralChangeKind::Renamed => Self::Renamed,
            EphemeralChangeKind::TargetUnavailable => Self::TargetUnavailable,
            EphemeralChangeKind::Uncertain => Self::Uncertain,
        }
    }
}

impl From<EphemeralChangeHint> for ChangeHintDto {
    fn from(value: EphemeralChangeHint) -> Self {
        Self {
            kind: value.kind.into(),
        }
    }
}

impl From<EphemeralRefreshRequest> for ChangePendingResponse {
    fn from(value: EphemeralRefreshRequest) -> Self {
        Self {
            monitor_id: String::new(),
            sequence: value.sequence,
            hint: value.hint.into(),
        }
    }
}

impl From<ThumbnailVariantDto> for ThumbnailVariant {
    fn from(value: ThumbnailVariantDto) -> Self {
        match value {
            ThumbnailVariantDto::Small => Self::Small,
            ThumbnailVariantDto::Medium => Self::Medium,
            ThumbnailVariantDto::Large => Self::Large,
        }
    }
}

impl From<ThumbnailArtifact> for ThumbnailArtifactDto {
    fn from(value: ThumbnailArtifact) -> Self {
        Self {
            cache_key: value.cache_key,
            bytes: value.bytes,
        }
    }
}

impl PreviewSnapshotDto {
    pub(crate) fn from_internal(preview_id: String, snapshot: PreviewSessionSnapshot) -> Self {
        Self {
            preview_id,
            session_id: snapshot.session_id,
            request_id: snapshot.request_id,
            source: snapshot.source,
            host_kind: snapshot.host_kind,
            state: snapshot.state.into(),
            source_version: snapshot.source_version,
            representation: snapshot.representation,
            effective_capabilities: snapshot.effective_capabilities,
            active_provider_id: snapshot.active_provider_id,
        }
    }
}

impl From<PreviewSessionState> for PreviewSessionStateDto {
    fn from(value: PreviewSessionState) -> Self {
        match value {
            PreviewSessionState::Idle => Self::Idle,
            PreviewSessionState::Resolving => Self::Resolving,
            PreviewSessionState::Preparing => Self::Preparing,
            PreviewSessionState::Loading => Self::Loading,
            PreviewSessionState::Ready => Self::Ready,
            PreviewSessionState::Failed => Self::Failed,
            PreviewSessionState::Cancelled => Self::Cancelled,
            PreviewSessionState::Disposed => Self::Disposed,
        }
    }
}

pub(crate) fn valid_bounded_text(value: &str) -> bool {
    !value.is_empty() && value.len() <= MAX_REQUEST_TEXT_LENGTH && !value.contains('\0')
}
