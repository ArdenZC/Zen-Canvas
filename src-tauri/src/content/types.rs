use super::{ContentPreviewDto, ContentScopePolicyDto};
use serde::Deserialize;

pub(crate) fn default_provider_mode() -> String {
    "none".to_string()
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ContentModelEnvelopeV1 {
    pub(crate) summary: String,
    #[serde(default)]
    pub(crate) keywords: Vec<String>,
    #[serde(default)]
    pub(crate) language: Option<String>,
    #[serde(default)]
    pub(crate) warnings: Vec<String>,
}

#[derive(Debug, Clone)]
pub(crate) struct UnderstandingArtifact {
    pub(crate) id: String,
    pub(crate) file_id: String,
    pub(crate) revision: i64,
    pub(crate) status: String,
    pub(crate) root_id: Option<String>,
    pub(crate) source_hash: String,
    pub(crate) raw_text: Option<String>,
    pub(crate) risk_level: String,
}

#[derive(Debug, Clone)]
pub(crate) struct ProviderRunClaim {
    pub(crate) owner: String,
    pub(crate) revision: i64,
    pub(crate) expected_library_revision: i64,
}

#[derive(Debug, Clone)]
pub(crate) struct ProviderItemClaim {
    pub(crate) owner: String,
    pub(crate) provider_revision: i64,
    pub(crate) source_size: i64,
    pub(crate) source_mtime: i64,
    pub(crate) source_hash: String,
    pub(crate) root_id: String,
    pub(crate) policy_revision: i64,
}

#[derive(Debug, Clone)]
pub(crate) struct Candidate {
    pub(crate) id: String,
    pub(crate) path: String,
    pub(crate) name: String,
    pub(crate) extension: String,
    pub(crate) size: i64,
    pub(crate) mtime: i64,
    pub(crate) is_dir: bool,
    pub(crate) root_id: String,
    pub(crate) content_hash: String,
}

#[derive(Debug)]
pub(crate) struct ContentSnapshot {
    pub(crate) preview: ContentPreviewDto,
    pub(crate) candidates: Vec<Candidate>,
}

#[derive(Debug, Clone)]
pub(crate) struct Policy {
    pub(crate) dto: ContentScopePolicyDto,
}

#[derive(Debug, Clone)]
pub(crate) struct Extraction {
    pub(crate) family: String,
    pub(crate) text: String,
    pub(crate) source_hash: String,
    pub(crate) truncated: bool,
    pub(crate) status: &'static str,
    pub(crate) reason: Option<String>,
}
