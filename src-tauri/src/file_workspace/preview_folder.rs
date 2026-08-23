//! Bounded direct-child Folder Preview provider for W3-07.
//!
//! The provider owns only fixed-size aggregation and the FolderSummary wire.
//! Directory resolution, Browse paging, resource admission and cleanup stay
//! in the integration adapter; no provider code receives a path, ref or
//! filesystem handle.

use super::{
    contracts::{PreviewHostKind, PreviewSourceRef},
    preview::{
        PreparedPreview, PreviewCompleteness, PreviewEntryKind, PreviewFolderEntryFact,
        PreviewFolderEntryKind, PreviewFolderEnumerationError, PreviewFolderPage,
        PreviewFolderPageAction, PreviewOperationContext, PreviewProvider,
        PreviewProviderDescriptor, PreviewProviderEnvironment, PreviewProviderError,
        PreviewProviderResult, PreviewRepresentation, PreviewSourceSnapshot, ProviderProbe,
    },
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub(crate) const FOLDER_PROVIDER_ID: &str = "builtin.folder";
pub(crate) const FOLDER_PROVIDER_PRIORITY: i32 = 290;
pub(crate) const MAX_FOLDER_CHILDREN_INSPECTED: u64 = 100_000;
pub(crate) const MAX_FOLDER_SAMPLE_ITEMS: usize = 32;
pub(crate) const MAX_FOLDER_EXTENSION_BUCKETS: usize = 16;
pub(crate) const MAX_FOLDER_LARGEST_ITEMS: usize = 10;
pub(crate) const MAX_FOLDER_PROJECT_HINTS: usize = 8;
pub(crate) const MAX_FOLDER_NAME_CHARS: usize = 512;
pub(crate) const MAX_FOLDER_EXTENSION_CHARS: usize = 64;
pub(crate) const MAX_FOLDER_ENCODED_SUMMARY_BYTES: usize = 256 * 1024;
pub(crate) const MAX_FOLDER_PROGRESS_PUBLICATIONS: usize = 8;
pub(crate) const FOLDER_DEADLINE_RETURN_GUARD_MS: u64 = 100;
pub(crate) const FOLDER_DEADLINE_RETURN_GUARD: std::time::Duration =
    std::time::Duration::from_millis(FOLDER_DEADLINE_RETURN_GUARD_MS);
pub(crate) const FOLDER_PROGRESS_MILESTONES: &[u64] = &[1, 1_000, 10_000, 50_000, 100_000];

const ZEN_HOSTS: &[PreviewHostKind] = &[PreviewHostKind::ZenFloating, PreviewHostKind::ZenPinned];
const EXTENSION_OTHER: &str = "(other)";
const EXTENSION_NONE: &str = "(none)";

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum FolderSummaryStateV1 {
    Partial,
    Complete,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum FolderLimitReasonV1 {
    EntryLimit,
    Deadline,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum FolderSampleKindV1 {
    File,
    Directory,
    Other,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct FolderProgressV1 {
    pub inspected_entries: u64,
    pub accepted_children: u64,
    pub state: FolderSummaryStateV1,
    pub limit_reason: Option<FolderLimitReasonV1>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct FolderSampleItemV1 {
    pub name: String,
    pub kind: FolderSampleKindV1,
    pub extension: Option<String>,
    pub size_bytes: Option<u64>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct FolderKindCountsV1 {
    pub files: u64,
    pub directories: u64,
    pub other: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct FolderExtensionCountV1 {
    pub extension: String,
    pub count: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct FolderSizeProgressV1 {
    pub observed_bytes: u64,
    pub known_size_entries: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct FolderLargestObservedV1 {
    pub name: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct FolderSummaryPayloadV1 {
    pub version: u8,
    pub folder_name: String,
    pub progress: FolderProgressV1,
    pub sample: Vec<FolderSampleItemV1>,
    pub kind_counts: FolderKindCountsV1,
    pub extension_counts: Vec<FolderExtensionCountV1>,
    pub size_progress: FolderSizeProgressV1,
    pub largest_observed: Vec<FolderLargestObservedV1>,
    pub project_hints: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SummaryStopReason {
    EntryLimit,
    Deadline,
}

#[derive(Debug)]
struct FolderSummaryBuilder {
    folder_name: String,
    inspected_entries: u64,
    accepted_children: u64,
    kind_counts: FolderKindCountsV1,
    sample: Vec<FolderSampleItemV1>,
    extension_counts: HashMap<String, u64>,
    observed_bytes: u64,
    known_size_entries: u64,
    largest_observed: Vec<FolderLargestObservedV1>,
    project_hints: Vec<String>,
}

impl FolderSummaryBuilder {
    fn new(folder_name: &str) -> Self {
        Self {
            folder_name: bounded_display_text(folder_name, MAX_FOLDER_NAME_CHARS),
            inspected_entries: 0,
            accepted_children: 0,
            kind_counts: FolderKindCountsV1 {
                files: 0,
                directories: 0,
                other: 0,
            },
            sample: Vec::with_capacity(MAX_FOLDER_SAMPLE_ITEMS),
            extension_counts: HashMap::with_capacity(MAX_FOLDER_EXTENSION_BUCKETS),
            observed_bytes: 0,
            known_size_entries: 0,
            largest_observed: Vec::with_capacity(MAX_FOLDER_LARGEST_ITEMS),
            project_hints: Vec::with_capacity(MAX_FOLDER_PROJECT_HINTS),
        }
    }

    fn observe_page(&mut self, page: &PreviewFolderPage) -> Result<bool, PreviewProviderError> {
        let remaining = MAX_FOLDER_CHILDREN_INSPECTED.saturating_sub(self.inspected_entries);
        let entries_to_observe = page.entries.iter().take(remaining as usize);
        for entry in entries_to_observe {
            self.inspected_entries = self
                .inspected_entries
                .checked_add(1)
                .ok_or(PreviewProviderError::Failed)?;
            self.accepted_children = self
                .accepted_children
                .checked_add(1)
                .ok_or(PreviewProviderError::Failed)?;
            self.observe_entry(entry)?;
        }
        Ok(page.entries.len() > remaining as usize)
    }

    fn observe_entry(
        &mut self,
        entry: &PreviewFolderEntryFact,
    ) -> Result<(), PreviewProviderError> {
        let name = bounded_display_text(&entry.name, MAX_FOLDER_NAME_CHARS);
        let extension = normalized_extension(entry.extension.as_deref());
        let kind = match entry.kind {
            PreviewFolderEntryKind::File => {
                self.kind_counts.files = self
                    .kind_counts
                    .files
                    .checked_add(1)
                    .ok_or(PreviewProviderError::Failed)?;
                if let Some(extension) = extension.as_deref() {
                    self.observe_extension(extension)?;
                }
                if let Some(size_bytes) = entry.size_bytes {
                    self.observed_bytes = self
                        .observed_bytes
                        .checked_add(size_bytes)
                        .ok_or(PreviewProviderError::Failed)?;
                    self.known_size_entries = self
                        .known_size_entries
                        .checked_add(1)
                        .ok_or(PreviewProviderError::Failed)?;
                    self.observe_largest(&name, size_bytes);
                }
                FolderSampleKindV1::File
            }
            PreviewFolderEntryKind::Directory => {
                self.kind_counts.directories = self
                    .kind_counts
                    .directories
                    .checked_add(1)
                    .ok_or(PreviewProviderError::Failed)?;
                FolderSampleKindV1::Directory
            }
            PreviewFolderEntryKind::Other => {
                self.kind_counts.other = self
                    .kind_counts
                    .other
                    .checked_add(1)
                    .ok_or(PreviewProviderError::Failed)?;
                FolderSampleKindV1::Other
            }
        };

        if self.sample.len() < MAX_FOLDER_SAMPLE_ITEMS {
            self.sample.push(FolderSampleItemV1 {
                name: name.clone(),
                kind,
                extension,
                size_bytes: entry.size_bytes,
            });
        }
        self.observe_project_hint(&name);
        Ok(())
    }

    fn observe_extension(&mut self, extension: &str) -> Result<(), PreviewProviderError> {
        if extension == EXTENSION_OTHER {
            return self.increment_other_extension();
        }
        if let Some(count) = self.extension_counts.get_mut(extension) {
            *count = count.checked_add(1).ok_or(PreviewProviderError::Failed)?;
            return Ok(());
        }
        if self.extension_counts.len() < MAX_FOLDER_EXTENSION_BUCKETS.saturating_sub(1) {
            self.extension_counts.insert(extension.to_string(), 1);
            return Ok(());
        }
        self.increment_other_extension()
    }

    fn increment_other_extension(&mut self) -> Result<(), PreviewProviderError> {
        let other = self
            .extension_counts
            .entry(EXTENSION_OTHER.to_string())
            .or_insert(0);
        *other = other.checked_add(1).ok_or(PreviewProviderError::Failed)?;
        Ok(())
    }

    fn observe_largest(&mut self, name: &str, size_bytes: u64) {
        let candidate = FolderLargestObservedV1 {
            name: name.to_string(),
            size_bytes,
        };
        if self.largest_observed.len() < MAX_FOLDER_LARGEST_ITEMS {
            self.largest_observed.push(candidate);
            self.sort_largest();
            return;
        }
        let replace = self.largest_observed.last().is_some_and(|current| {
            (size_bytes, name) > (current.size_bytes, current.name.as_str())
        });
        if replace {
            let last = self
                .largest_observed
                .last_mut()
                .expect("largest list has fixed non-zero capacity");
            *last = candidate;
            self.sort_largest();
        }
    }

    fn sort_largest(&mut self) {
        self.largest_observed.sort_by(|left, right| {
            right
                .size_bytes
                .cmp(&left.size_bytes)
                .then_with(|| left.name.cmp(&right.name))
        });
    }

    fn observe_project_hint(&mut self, name: &str) {
        let lower = name.to_ascii_lowercase();
        let hint = match lower.as_str() {
            "package.json" | "pnpm-lock.yaml" | "yarn.lock" => Some("Node.js project"),
            "cargo.toml" | "cargo.lock" => Some("Rust project"),
            "pyproject.toml" | "requirements.txt" | "setup.py" => Some("Python project"),
            "go.mod" | "go.sum" => Some("Go project"),
            "pom.xml" | "build.gradle" | "build.gradle.kts" => Some("Java project"),
            "readme" | "readme.md" | "readme.txt" => Some("README"),
            ".gitignore" => Some("Git metadata"),
            _ => None,
        };
        if let Some(hint) = hint {
            if self.project_hints.len() < MAX_FOLDER_PROJECT_HINTS
                && !self.project_hints.iter().any(|value| value == hint)
            {
                self.project_hints.push(hint.to_string());
            }
        }
    }

    fn payload(
        &self,
        reason: Option<SummaryStopReason>,
        completeness: PreviewCompleteness,
    ) -> FolderSummaryPayloadV1 {
        let state = match completeness {
            PreviewCompleteness::Complete => FolderSummaryStateV1::Complete,
            PreviewCompleteness::Partial | PreviewCompleteness::Unknown => {
                FolderSummaryStateV1::Partial
            }
        };
        let mut extension_counts = self
            .extension_counts
            .iter()
            .map(|(extension, count)| FolderExtensionCountV1 {
                extension: extension.clone(),
                count: *count,
            })
            .collect::<Vec<_>>();
        extension_counts.sort_by(|left, right| {
            right
                .count
                .cmp(&left.count)
                .then_with(|| left.extension.cmp(&right.extension))
        });
        FolderSummaryPayloadV1 {
            version: 1,
            folder_name: self.folder_name.clone(),
            progress: FolderProgressV1 {
                inspected_entries: self.inspected_entries,
                accepted_children: self.accepted_children,
                state,
                limit_reason: reason.map(|reason| match reason {
                    SummaryStopReason::EntryLimit => FolderLimitReasonV1::EntryLimit,
                    SummaryStopReason::Deadline => FolderLimitReasonV1::Deadline,
                }),
            },
            sample: self.sample.clone(),
            kind_counts: self.kind_counts.clone(),
            extension_counts,
            size_progress: FolderSizeProgressV1 {
                observed_bytes: self.observed_bytes,
                known_size_entries: self.known_size_entries,
            },
            largest_observed: self.largest_observed.clone(),
            project_hints: self.project_hints.clone(),
        }
    }
}

pub(crate) struct FolderPreviewProvider {
    descriptor: PreviewProviderDescriptor,
}

impl FolderPreviewProvider {
    pub(crate) fn new() -> Self {
        Self {
            descriptor: PreviewProviderDescriptor::new(
                FOLDER_PROVIDER_ID,
                FOLDER_PROVIDER_PRIORITY,
                Default::default(),
                ZEN_HOSTS.to_vec(),
                false,
            ),
        }
    }
}

impl PreviewProvider for FolderPreviewProvider {
    fn descriptor(&self) -> &PreviewProviderDescriptor {
        &self.descriptor
    }

    fn probe(
        &self,
        snapshot: &PreviewSourceSnapshot,
        _context: &PreviewOperationContext,
    ) -> ProviderProbe {
        if snapshot.entry_kind == PreviewEntryKind::Directory {
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
        if snapshot.entry_kind != PreviewEntryKind::Directory {
            return Err(PreviewProviderError::Unsupported);
        }
        Ok(Box::new(PreparedFolderPreview {
            source: snapshot.source.clone(),
            source_version: snapshot.source_version.clone(),
            folder_name: snapshot.metadata.display_name.clone(),
        }))
    }
}

struct PreparedFolderPreview {
    source: PreviewSourceRef,
    source_version: String,
    folder_name: String,
}

impl PreparedPreview for PreparedFolderPreview {
    fn load(
        &mut self,
        context: &PreviewOperationContext,
        environment: PreviewProviderEnvironment<'_>,
    ) -> Result<PreviewProviderResult, PreviewProviderError> {
        let access = environment
            .folder_enumeration
            .ok_or(PreviewProviderError::Failed)?;
        let mut builder = FolderSummaryBuilder::new(&self.folder_name);
        let mut published = 0usize;
        let mut last_publication_count = 0u64;
        let mut stop_reason = None;
        let mut completed = false;
        let mut saw_page = false;

        let enumeration = access.enumerate_direct_children(
            &self.source,
            &self.source_version,
            context,
            &mut |page| {
                saw_page = true;
                if context.remaining() <= FOLDER_DEADLINE_RETURN_GUARD {
                    stop_reason = Some(SummaryStopReason::Deadline);
                    return Err(PreviewFolderEnumerationError::Deadline);
                }
                context
                    .ensure_active()
                    .map_err(map_context_to_folder_error)?;
                let page_has_unobserved_entries = builder
                    .observe_page(&page)
                    .map_err(|_| PreviewFolderEnumerationError::Failed)?;

                let reached_limit = builder.inspected_entries >= MAX_FOLDER_CHILDREN_INSPECTED;
                if reached_limit && (page_has_unobserved_entries || !page.complete) {
                    stop_reason = Some(SummaryStopReason::EntryLimit);
                    publish_if_due(
                        &builder,
                        stop_reason,
                        PreviewCompleteness::Partial,
                        context,
                        environment.publication,
                        &mut published,
                        &mut last_publication_count,
                    )
                    .map_err(map_progress_error)?;
                    return Ok(PreviewFolderPageAction::Stop);
                }
                if page.complete {
                    completed = true;
                    publish_if_due(
                        &builder,
                        None,
                        PreviewCompleteness::Complete,
                        context,
                        environment.publication,
                        &mut published,
                        &mut last_publication_count,
                    )
                    .map_err(map_progress_error)?;
                    return Ok(PreviewFolderPageAction::Stop);
                }

                let first_page = published == 0;
                let milestone = FOLDER_PROGRESS_MILESTONES.iter().any(|milestone| {
                    last_publication_count < *milestone && builder.inspected_entries >= *milestone
                });
                if first_page || milestone {
                    publish_if_due(
                        &builder,
                        None,
                        PreviewCompleteness::Partial,
                        context,
                        environment.publication,
                        &mut published,
                        &mut last_publication_count,
                    )
                    .map_err(map_progress_error)?;
                }
                Ok(PreviewFolderPageAction::Continue)
            },
        );

        match enumeration {
            Ok(()) => {}
            Err(PreviewFolderEnumerationError::Deadline) => {
                stop_reason = Some(SummaryStopReason::Deadline);
            }
            Err(error) => return Err(map_folder_access_error(error)),
        }

        if !saw_page && stop_reason.is_none() {
            stop_reason = Some(SummaryStopReason::Deadline);
        }
        if !completed && stop_reason.is_none() {
            stop_reason = Some(SummaryStopReason::Deadline);
        }
        context.ensure_active().map_err(map_context_error)?;
        if context.remaining() <= FOLDER_DEADLINE_RETURN_GUARD {
            stop_reason = Some(SummaryStopReason::Deadline);
        }
        let completeness = if stop_reason.is_none() {
            PreviewCompleteness::Complete
        } else {
            PreviewCompleteness::Partial
        };
        let result = folder_result(&builder, stop_reason, completeness)?;
        Ok(result)
    }

    fn cleanup(&mut self) {}
}

fn publish_if_due(
    builder: &FolderSummaryBuilder,
    reason: Option<SummaryStopReason>,
    completeness: PreviewCompleteness,
    context: &PreviewOperationContext,
    publication: Option<&dyn super::preview::PreviewPublicationSink>,
    published: &mut usize,
    last_publication_count: &mut u64,
) -> Result<(), PreviewProviderError> {
    context.ensure_active().map_err(map_context_error)?;
    if context.remaining() <= FOLDER_DEADLINE_RETURN_GUARD {
        return Err(PreviewProviderError::Timeout);
    }
    if *published >= MAX_FOLDER_PROGRESS_PUBLICATIONS {
        return Ok(());
    }
    let result = folder_result(builder, reason, completeness)?;
    if let Some(publication) = publication {
        publication
            .publish_next(result)
            .map_err(|_| PreviewProviderError::Cancelled)?;
    }
    *published = published.saturating_add(1);
    *last_publication_count = builder.inspected_entries;
    Ok(())
}

fn folder_result(
    builder: &FolderSummaryBuilder,
    reason: Option<SummaryStopReason>,
    completeness: PreviewCompleteness,
) -> Result<PreviewProviderResult, PreviewProviderError> {
    let payload = builder.payload(reason, completeness);
    let encoded_summary = encode_summary(&payload)?;
    Ok(PreviewProviderResult {
        representation: PreviewRepresentation::FolderSummary { encoded_summary },
        completeness,
        warnings: Vec::new(),
    })
}

fn encode_summary(payload: &FolderSummaryPayloadV1) -> Result<String, PreviewProviderError> {
    let encoded = serde_json::to_vec(payload).map_err(|_| PreviewProviderError::Failed)?;
    if encoded.len() > MAX_FOLDER_ENCODED_SUMMARY_BYTES {
        return Err(PreviewProviderError::Failed);
    }
    String::from_utf8(encoded).map_err(|_| PreviewProviderError::Failed)
}

fn bounded_display_text(value: &str, max_chars: usize) -> String {
    value
        .chars()
        .map(|character| match character {
            '/' | '\\' | '\0' => ' ',
            character if character.is_control() => ' ',
            character => character,
        })
        .take(max_chars)
        .collect::<String>()
}

fn normalized_extension(extension: Option<&str>) -> Option<String> {
    let extension = extension
        .map(|value| bounded_display_text(value, MAX_FOLDER_EXTENSION_CHARS))
        .filter(|value| !value.trim().is_empty());
    extension.or_else(|| Some(EXTENSION_NONE.to_string()))
}

fn map_context_error(error: super::preview::PreviewContextError) -> PreviewProviderError {
    match error {
        super::preview::PreviewContextError::Cancelled
        | super::preview::PreviewContextError::StalePublication => PreviewProviderError::Cancelled,
        super::preview::PreviewContextError::TimedOut => PreviewProviderError::Timeout,
    }
}

fn map_context_to_folder_error(
    error: super::preview::PreviewContextError,
) -> PreviewFolderEnumerationError {
    match error {
        super::preview::PreviewContextError::Cancelled
        | super::preview::PreviewContextError::StalePublication => {
            PreviewFolderEnumerationError::Cancelled
        }
        super::preview::PreviewContextError::TimedOut => PreviewFolderEnumerationError::Deadline,
    }
}

fn map_progress_error(error: PreviewProviderError) -> PreviewFolderEnumerationError {
    match error {
        PreviewProviderError::Cancelled => PreviewFolderEnumerationError::Cancelled,
        PreviewProviderError::Timeout => PreviewFolderEnumerationError::Deadline,
        _ => PreviewFolderEnumerationError::Failed,
    }
}

fn map_folder_access_error(error: PreviewFolderEnumerationError) -> PreviewProviderError {
    match error {
        PreviewFolderEnumerationError::Unsupported => PreviewProviderError::Unsupported,
        PreviewFolderEnumerationError::SourceUnavailable => PreviewProviderError::SourceUnavailable,
        PreviewFolderEnumerationError::IdentityChanged => PreviewProviderError::IdentityChanged,
        PreviewFolderEnumerationError::PermissionDenied => PreviewProviderError::PermissionDenied,
        PreviewFolderEnumerationError::Cancelled => PreviewProviderError::Cancelled,
        PreviewFolderEnumerationError::Deadline => PreviewProviderError::Timeout,
        PreviewFolderEnumerationError::Failed => PreviewProviderError::Failed,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::file_workspace::preview::{
        PreviewCancellation, PreviewCapabilities, PreviewFolderEnumerationAccess, PreviewMetadata,
        PreviewProviderEnvironment,
    };
    use std::sync::Arc;
    use std::time::{Duration, Instant};

    fn source() -> PreviewSourceRef {
        PreviewSourceRef::Ephemeral {
            browse_session_id: "browse-folder".to_string(),
            entry_id: "folder-entry".to_string(),
        }
    }

    fn context() -> PreviewOperationContext {
        PreviewOperationContext::for_backend_content_read(
            "session-folder",
            "request-folder",
            "folder-version",
            PreviewCancellation::default(),
            Instant::now() + Duration::from_secs(2),
        )
    }

    fn snapshot(kind: PreviewEntryKind) -> PreviewSourceSnapshot {
        PreviewSourceSnapshot::new(
            source(),
            "folder-version",
            PreviewMetadata {
                display_name: "fixture-folder".to_string(),
                media_type: None,
                extension: None,
                size_bytes: Some(0),
                modified_at_epoch_ms: None,
                materialization: crate::file_workspace::MaterializationState::MetadataOnly,
                read_eligibility: crate::file_workspace::ContentReadEligibility::MetadataOnly,
            },
            PreviewCapabilities::default(),
        )
        .with_entry_kind(kind)
    }

    struct FakeAccess {
        pages: Vec<PreviewFolderPage>,
    }

    impl PreviewFolderEnumerationAccess for FakeAccess {
        fn enumerate_direct_children(
            &self,
            _source: &PreviewSourceRef,
            _source_version: &str,
            _context: &PreviewOperationContext,
            visit_page: &mut dyn FnMut(
                PreviewFolderPage,
            ) -> Result<
                PreviewFolderPageAction,
                PreviewFolderEnumerationError,
            >,
        ) -> Result<(), PreviewFolderEnumerationError> {
            for page in &self.pages {
                if visit_page(page.clone())? == PreviewFolderPageAction::Stop {
                    break;
                }
            }
            Ok(())
        }
    }

    fn load(
        access: Arc<dyn PreviewFolderEnumerationAccess>,
        entry_kind: PreviewEntryKind,
    ) -> PreviewProviderResult {
        let provider = FolderPreviewProvider::new();
        let snapshot = snapshot(entry_kind);
        let mut prepared = provider.prepare(&snapshot, &context()).expect("prepared");
        prepared
            .load(
                &context(),
                PreviewProviderEnvironment {
                    content_read: None,
                    preview_read: None,
                    folder_enumeration: Some(access.as_ref()),
                    publication: None,
                    asset_publisher: None,
                    decoder_admission: None,
                },
            )
            .expect("folder load")
    }

    #[test]
    fn descriptor_routes_only_directories_to_zen_hosts() {
        let provider = FolderPreviewProvider::new();
        assert_eq!(provider.descriptor().id, FOLDER_PROVIDER_ID);
        assert_eq!(provider.descriptor().priority, FOLDER_PROVIDER_PRIORITY);
        assert!(!provider.descriptor().reads_content);
        assert_eq!(
            provider.probe(&snapshot(PreviewEntryKind::Directory), &context()),
            ProviderProbe::Compatible
        );
        assert_eq!(
            provider.probe(&snapshot(PreviewEntryKind::File), &context()),
            ProviderProbe::Unsupported
        );
        assert_eq!(provider.descriptor().supported_hosts, ZEN_HOSTS);
    }

    #[test]
    fn empty_folder_is_complete_and_small_mixed_folder_is_truthful() {
        let empty = load(
            Arc::new(FakeAccess {
                pages: vec![PreviewFolderPage {
                    entries: Vec::new(),
                    complete: true,
                }],
            }),
            PreviewEntryKind::Directory,
        );
        let PreviewRepresentation::FolderSummary { encoded_summary } = empty.representation else {
            panic!("folder representation")
        };
        let empty_payload: FolderSummaryPayloadV1 =
            serde_json::from_str(&encoded_summary).expect("empty payload");
        assert_eq!(empty_payload.progress.state, FolderSummaryStateV1::Complete);
        assert_eq!(empty_payload.progress.inspected_entries, 0);

        let mixed = load(
            Arc::new(FakeAccess {
                pages: vec![PreviewFolderPage {
                    entries: vec![
                        PreviewFolderEntryFact {
                            name: "README.md".into(),
                            kind: PreviewFolderEntryKind::File,
                            extension: Some("md".into()),
                            size_bytes: Some(5),
                        },
                        PreviewFolderEntryFact {
                            name: "src".into(),
                            kind: PreviewFolderEntryKind::Directory,
                            extension: None,
                            size_bytes: None,
                        },
                    ],
                    complete: true,
                }],
            }),
            PreviewEntryKind::Directory,
        );
        let PreviewRepresentation::FolderSummary { encoded_summary } = mixed.representation else {
            panic!("folder representation")
        };
        let payload: FolderSummaryPayloadV1 =
            serde_json::from_str(&encoded_summary).expect("mixed payload");
        assert_eq!(payload.kind_counts.files, 1);
        assert_eq!(payload.kind_counts.directories, 1);
        assert_eq!(payload.size_progress.observed_bytes, 5);
        assert!(payload.project_hints.iter().any(|hint| hint == "README"));
    }

    #[test]
    fn entry_limit_marks_partial_without_unbounded_state() {
        let page = PreviewFolderPage {
            entries: (0..256)
                .map(|index| PreviewFolderEntryFact {
                    name: format!("file-{index}.txt"),
                    kind: PreviewFolderEntryKind::File,
                    extension: Some("txt".to_string()),
                    size_bytes: Some(1),
                })
                .collect(),
            complete: false,
        };
        let access = FakeAccess {
            pages: vec![page; 400],
        };
        let result = load(Arc::new(access), PreviewEntryKind::Directory);
        let PreviewRepresentation::FolderSummary { encoded_summary } = result.representation else {
            panic!("folder representation")
        };
        let payload: FolderSummaryPayloadV1 =
            serde_json::from_str(&encoded_summary).expect("bounded payload");
        assert_eq!(payload.progress.state, FolderSummaryStateV1::Partial);
        assert_eq!(
            payload.progress.limit_reason,
            Some(FolderLimitReasonV1::EntryLimit)
        );
        assert_eq!(
            payload.progress.inspected_entries,
            MAX_FOLDER_CHILDREN_INSPECTED
        );
        assert!(payload.sample.len() <= MAX_FOLDER_SAMPLE_ITEMS);
        assert!(payload.extension_counts.len() <= MAX_FOLDER_EXTENSION_BUCKETS);
        assert!(payload.largest_observed.len() <= MAX_FOLDER_LARGEST_ITEMS);
    }

    #[test]
    fn extension_distribution_reserves_other_bucket() {
        let mut builder = FolderSummaryBuilder::new("extensions");
        for index in 0..MAX_FOLDER_EXTENSION_BUCKETS {
            builder
                .observe_entry(&PreviewFolderEntryFact {
                    name: format!("file-{index}"),
                    kind: PreviewFolderEntryKind::File,
                    extension: Some(format!("ext-{index}")),
                    size_bytes: None,
                })
                .expect("bounded extension bucket");
        }
        let payload = builder.payload(None, PreviewCompleteness::Complete);
        assert!(payload.extension_counts.len() <= MAX_FOLDER_EXTENSION_BUCKETS);
        assert_eq!(
            payload
                .extension_counts
                .iter()
                .map(|bucket| bucket.count)
                .sum::<u64>(),
            MAX_FOLDER_EXTENSION_BUCKETS as u64
        );
        assert_eq!(
            payload
                .extension_counts
                .iter()
                .find(|bucket| bucket.extension == EXTENSION_OTHER)
                .map(|bucket| bucket.count),
            Some(1)
        );
    }

    fn pages_for_scale(count: usize) -> Vec<PreviewFolderPage> {
        (0..count)
            .step_by(256)
            .map(|start| {
                let end = (start + 256).min(count);
                PreviewFolderPage {
                    entries: (start..end)
                        .map(|index| PreviewFolderEntryFact {
                            name: format!("scale-{index}.txt"),
                            kind: PreviewFolderEntryKind::File,
                            extension: Some("txt".to_string()),
                            size_bytes: Some(1),
                        })
                        .collect(),
                    complete: end == count,
                }
            })
            .collect()
    }

    #[test]
    fn bounded_scales_preserve_eof_and_entry_limit_truth() {
        for (count, expected_state, expected_reason) in [
            (1_000usize, FolderSummaryStateV1::Complete, None),
            (10_000usize, FolderSummaryStateV1::Complete, None),
            (100_000usize, FolderSummaryStateV1::Complete, None),
            (
                100_001usize,
                FolderSummaryStateV1::Partial,
                Some(FolderLimitReasonV1::EntryLimit),
            ),
        ] {
            let result = load(
                Arc::new(FakeAccess {
                    pages: pages_for_scale(count),
                }),
                PreviewEntryKind::Directory,
            );
            let PreviewRepresentation::FolderSummary { encoded_summary } = result.representation
            else {
                panic!("folder representation")
            };
            let payload: FolderSummaryPayloadV1 =
                serde_json::from_str(&encoded_summary).expect("scale payload");
            assert_eq!(payload.progress.state, expected_state, "count={count}");
            assert_eq!(
                payload.progress.limit_reason, expected_reason,
                "count={count}"
            );
            assert_eq!(
                payload.progress.inspected_entries,
                count.min(MAX_FOLDER_CHILDREN_INSPECTED as usize) as u64,
                "count={count}"
            );
            assert_eq!(
                payload.progress.accepted_children,
                count.min(MAX_FOLDER_CHILDREN_INSPECTED as usize) as u64,
                "count={count}"
            );
        }
    }

    #[test]
    fn progressive_publications_keep_partial_null_reason_until_authoritative_eof() {
        let mut builder = FolderSummaryBuilder::new("progressive");
        builder
            .observe_entry(&PreviewFolderEntryFact {
                name: "first.txt".to_string(),
                kind: PreviewFolderEntryKind::File,
                extension: Some("txt".to_string()),
                size_bytes: Some(1),
            })
            .expect("first progressive entry");
        let first_partial = builder.payload(None, PreviewCompleteness::Partial);
        let later_partial = builder.payload(None, PreviewCompleteness::Partial);
        let complete = builder.payload(None, PreviewCompleteness::Complete);

        assert_eq!(first_partial.progress.state, FolderSummaryStateV1::Partial);
        assert_eq!(first_partial.progress.limit_reason, None);
        assert_eq!(later_partial.progress.state, FolderSummaryStateV1::Partial);
        assert_eq!(later_partial.progress.limit_reason, None);
        assert_eq!(complete.progress.state, FolderSummaryStateV1::Complete);
        assert_eq!(complete.progress.limit_reason, None);
    }

    #[test]
    fn fixed_payload_bounds_and_overflow_fail_closed() {
        let builder = FolderSummaryBuilder::new("\u{0000}folder");
        let encoded = encode_summary(&builder.payload(None, PreviewCompleteness::Complete))
            .expect("bounded empty payload");
        assert!(encoded.len() <= MAX_FOLDER_ENCODED_SUMMARY_BYTES);

        let mut overflowing = FolderSummaryBuilder::new("overflow");
        overflowing
            .observe_entry(&PreviewFolderEntryFact {
                name: "huge.bin".to_string(),
                kind: PreviewFolderEntryKind::File,
                extension: Some("bin".to_string()),
                size_bytes: Some(u64::MAX),
            })
            .expect("first huge size");
        assert_eq!(
            overflowing.observe_entry(&PreviewFolderEntryFact {
                name: "second.bin".to_string(),
                kind: PreviewFolderEntryKind::File,
                extension: Some("bin".to_string()),
                size_bytes: Some(1),
            }),
            Err(PreviewProviderError::Failed)
        );
    }
}
