//! Bounded W3-05 JSON/YAML/XML structured and CSV/TSV table providers.
//!
//! The providers in this module are read-only adapters. They receive bytes
//! only through the W3-04 Preview read seam, and they publish one frozen,
//! versioned JSON payload inside the existing `structured_tree` / `table`
//! representation families. No parser receives a path or a reusable lease.

use super::{
    contracts::{ContentReadEligibility, PreviewHostKind, PreviewSourceRef},
    preview::{
        BoundedContentRead, PreparedPreview, PreviewCapabilities, PreviewCompleteness,
        PreviewMetadata, PreviewOperationContext, PreviewProvider, PreviewProviderDescriptor,
        PreviewProviderEnvironment, PreviewProviderError, PreviewProviderResult,
        PreviewRepresentation, PreviewSourceSnapshot, ProviderProbe,
    },
};
use csv::ReaderBuilder;
use quick_xml::{
    events::{BytesStart, Event},
    Reader as XmlReader,
};
use serde::{de, de::DeserializeSeed, Deserialize, Serialize};
use serde_json::Deserializer as JsonDeserializer;
use std::{fmt, io::Cursor, str, sync::Arc};
use yaml_rust2::parser::{Event as YamlEvent, EventReceiver, Parser as YamlParser};

pub(crate) const PREVIEW_STRUCTURED_TABLE_READ_BYTES: u32 = 512 * 1024;
pub(crate) const MAX_STRUCTURED_DEPTH: usize = 64;
// serde_json's default recursion guard counts parser frames rather than
// structured nodes. Keep a lower parser ceiling so hostile nesting is
// rejected before deserialization can exhaust the stack; the published
// structured bound remains the wider frozen limit.
const MAX_JSON_PARSER_DEPTH: usize = 48;
pub(crate) const MAX_STRUCTURED_NODES: usize = 10_000;
pub(crate) const MAX_STRUCTURED_KEY_BYTES: usize = 1024;
pub(crate) const MAX_STRUCTURED_SCALAR_BYTES: usize = 16 * 1024;
pub(crate) const MAX_XML_ATTRIBUTES: usize = 128;
pub(crate) const MAX_ENCODED_STRUCTURED_BYTES: usize = 1024 * 1024;
pub(crate) const MAX_TABLE_ROWS: usize = 500;
pub(crate) const MAX_TABLE_COLUMNS: usize = 64;
pub(crate) const MAX_TABLE_CELL_BYTES: usize = 16 * 1024;
pub(crate) const MAX_ENCODED_TABLE_BYTES: usize = 1024 * 1024;

const ZEN_HOSTS: &[PreviewHostKind] = &[PreviewHostKind::ZenFloating, PreviewHostKind::ZenPinned];

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum StructuredFormatV1 {
    Json,
    Yaml,
    Xml,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum StructuredScalarTypeV1 {
    String,
    Number,
    Boolean,
    Null,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub(crate) struct StructuredObjectEntryV1 {
    pub key: String,
    pub value: StructuredNodeV1,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub(crate) struct StructuredAttributeV1 {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub(crate) enum StructuredNodeV1 {
    Object {
        entries: Vec<StructuredObjectEntryV1>,
    },
    Array {
        items: Vec<StructuredNodeV1>,
    },
    Scalar {
        #[serde(rename = "scalarType")]
        scalar_type: StructuredScalarTypeV1,
        value: String,
    },
    Element {
        name: String,
        attributes: Vec<StructuredAttributeV1>,
        children: Vec<StructuredNodeV1>,
    },
    Text {
        value: String,
    },
}

#[derive(Debug, Clone, Copy, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub(crate) struct StructuredTruncationV1 {
    pub depth: bool,
    pub nodes: bool,
    pub strings: bool,
}

impl StructuredTruncationV1 {
    const fn any(&self) -> bool {
        self.depth || self.nodes || self.strings
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct StructuredTreePayloadV1 {
    #[serde(deserialize_with = "deserialize_schema_version")]
    pub schema_version: u8,
    pub format: StructuredFormatV1,
    pub root: StructuredNodeV1,
    pub truncation: StructuredTruncationV1,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum TableFormatV1 {
    Csv,
    Tsv,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub(crate) struct TableTruncationV1 {
    pub rows: bool,
    pub columns: bool,
    pub cells: bool,
}

impl TableTruncationV1 {
    const fn none() -> Self {
        Self {
            rows: false,
            columns: false,
            cells: false,
        }
    }

    const fn any(&self) -> bool {
        self.rows || self.columns || self.cells
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct TablePayloadV1 {
    #[serde(deserialize_with = "deserialize_schema_version")]
    pub schema_version: u8,
    pub format: TableFormatV1,
    pub columns: Vec<String>,
    pub rows: Vec<Vec<String>>,
    pub truncation: TableTruncationV1,
}

fn deserialize_schema_version<'de, D>(deserializer: D) -> Result<u8, D::Error>
where
    D: de::Deserializer<'de>,
{
    let version = u8::deserialize(deserializer)?;
    if version == 1 {
        Ok(version)
    } else {
        Err(de::Error::custom(
            "unsupported preview payload schema version",
        ))
    }
}

#[derive(Debug, Clone, Copy)]
enum StructuredProviderKind {
    Json,
    Yaml,
    Xml,
}

#[derive(Debug, Clone, Copy)]
enum TableProviderKind {
    Csv,
    Tsv,
}

pub(crate) fn production_preview_providers() -> Vec<Arc<dyn PreviewProvider>> {
    vec![
        Arc::new(StructuredPreviewProvider::new(
            "builtin.structured-json",
            260,
            StructuredProviderKind::Json,
        )),
        Arc::new(StructuredPreviewProvider::new(
            "builtin.structured-yaml",
            250,
            StructuredProviderKind::Yaml,
        )),
        Arc::new(StructuredPreviewProvider::new(
            "builtin.structured-xml",
            240,
            StructuredProviderKind::Xml,
        )),
        Arc::new(TablePreviewProvider::new(
            "builtin.table-csv",
            230,
            TableProviderKind::Csv,
        )),
        Arc::new(TablePreviewProvider::new(
            "builtin.table-tsv",
            220,
            TableProviderKind::Tsv,
        )),
    ]
}

pub(crate) fn is_structured_or_table_hint(metadata: &PreviewMetadata) -> bool {
    is_json_hint(metadata)
        || is_yaml_hint(metadata)
        || is_xml_hint(metadata)
        || is_csv_hint(metadata)
        || is_tsv_hint(metadata)
}

struct StructuredPreviewProvider {
    descriptor: PreviewProviderDescriptor,
    kind: StructuredProviderKind,
}

impl StructuredPreviewProvider {
    fn new(id: &'static str, priority: i32, kind: StructuredProviderKind) -> Self {
        Self {
            descriptor: PreviewProviderDescriptor::new(
                id,
                priority,
                PreviewCapabilities {
                    can_select_text: true,
                    ..PreviewCapabilities::default()
                },
                ZEN_HOSTS.to_vec(),
                true,
            ),
            kind,
        }
    }
}

impl PreviewProvider for StructuredPreviewProvider {
    fn descriptor(&self) -> &PreviewProviderDescriptor {
        &self.descriptor
    }

    fn probe(
        &self,
        snapshot: &PreviewSourceSnapshot,
        _context: &PreviewOperationContext,
    ) -> ProviderProbe {
        if !source_can_render_structured(snapshot) || !structured_kind_matches(self.kind, snapshot)
        {
            ProviderProbe::Unsupported
        } else {
            ProviderProbe::Compatible
        }
    }

    fn prepare(
        &self,
        snapshot: &PreviewSourceSnapshot,
        _context: &PreviewOperationContext,
    ) -> Result<Box<dyn PreparedPreview>, PreviewProviderError> {
        if !source_can_render_structured(snapshot) || !structured_kind_matches(self.kind, snapshot)
        {
            return Err(PreviewProviderError::Unsupported);
        }
        Ok(Box::new(PreparedStructuredPreview {
            source: snapshot.source.clone(),
            source_version: snapshot.source_version.clone(),
            kind: self.kind,
        }))
    }
}

struct PreparedStructuredPreview {
    source: PreviewSourceRef,
    source_version: String,
    kind: StructuredProviderKind,
}

impl PreparedPreview for PreparedStructuredPreview {
    fn load(
        &mut self,
        context: &PreviewOperationContext,
        environment: PreviewProviderEnvironment<'_>,
    ) -> Result<PreviewProviderResult, PreviewProviderError> {
        let read = crate::file_workspace::preview_providers::read_source_prefix_with_limit(
            &self.source,
            &self.source_version,
            context,
            environment.preview_read,
            PREVIEW_STRUCTURED_TABLE_READ_BYTES,
        )?;
        let (text, source_complete) = decode_utf8_input(read)?;
        let parsed = match self.kind {
            StructuredProviderKind::Json => parse_json(&text),
            StructuredProviderKind::Yaml => parse_yaml(&text),
            StructuredProviderKind::Xml => parse_xml(&text),
        };
        let (root, truncation) = match parsed {
            Ok(parsed) => parsed,
            Err(PreviewProviderError::CorruptSource) if !source_complete => {
                // An incomplete prefix is not evidence that an empty object,
                // array or XML element existed in the source.  Keep a real
                // parser-produced prefix when one is complete enough to
                // publish; otherwise preserve Metadata fallback.
                return Err(PreviewProviderError::Failed);
            }
            Err(error) => return Err(error),
        };
        let format = match self.kind {
            StructuredProviderKind::Json => StructuredFormatV1::Json,
            StructuredProviderKind::Yaml => StructuredFormatV1::Yaml,
            StructuredProviderKind::Xml => StructuredFormatV1::Xml,
        };
        let payload = StructuredTreePayloadV1 {
            schema_version: 1,
            format,
            root,
            truncation,
        };
        let completeness = if source_complete && !payload.truncation.any() {
            PreviewCompleteness::Complete
        } else {
            PreviewCompleteness::Partial
        };
        let encoded_tree = encode_structured_payload(payload)?;
        Ok(PreviewProviderResult {
            representation: PreviewRepresentation::StructuredTree { encoded_tree },
            completeness,
            warnings: Vec::new(),
        })
    }

    fn cleanup(&mut self) {}
}

struct TablePreviewProvider {
    descriptor: PreviewProviderDescriptor,
    kind: TableProviderKind,
}

impl TablePreviewProvider {
    fn new(id: &'static str, priority: i32, kind: TableProviderKind) -> Self {
        Self {
            descriptor: PreviewProviderDescriptor::new(
                id,
                priority,
                PreviewCapabilities {
                    can_select_text: true,
                    ..PreviewCapabilities::default()
                },
                ZEN_HOSTS.to_vec(),
                true,
            ),
            kind,
        }
    }
}

impl PreviewProvider for TablePreviewProvider {
    fn descriptor(&self) -> &PreviewProviderDescriptor {
        &self.descriptor
    }

    fn probe(
        &self,
        snapshot: &PreviewSourceSnapshot,
        _context: &PreviewOperationContext,
    ) -> ProviderProbe {
        if !source_can_render_structured(snapshot) || !table_kind_matches(self.kind, snapshot) {
            ProviderProbe::Unsupported
        } else {
            ProviderProbe::Compatible
        }
    }

    fn prepare(
        &self,
        snapshot: &PreviewSourceSnapshot,
        _context: &PreviewOperationContext,
    ) -> Result<Box<dyn PreparedPreview>, PreviewProviderError> {
        if !source_can_render_structured(snapshot) || !table_kind_matches(self.kind, snapshot) {
            return Err(PreviewProviderError::Unsupported);
        }
        Ok(Box::new(PreparedTablePreview {
            source: snapshot.source.clone(),
            source_version: snapshot.source_version.clone(),
            kind: self.kind,
        }))
    }
}

struct PreparedTablePreview {
    source: PreviewSourceRef,
    source_version: String,
    kind: TableProviderKind,
}

impl PreparedPreview for PreparedTablePreview {
    fn load(
        &mut self,
        context: &PreviewOperationContext,
        environment: PreviewProviderEnvironment<'_>,
    ) -> Result<PreviewProviderResult, PreviewProviderError> {
        let read = crate::file_workspace::preview_providers::read_source_prefix_with_limit(
            &self.source,
            &self.source_version,
            context,
            environment.preview_read,
            PREVIEW_STRUCTURED_TABLE_READ_BYTES,
        )?;
        let (text, source_complete) = decode_utf8_input(read)?;
        let (columns, rows, truncation) = parse_table(&text, self.kind, source_complete)?;
        let payload = TablePayloadV1 {
            schema_version: 1,
            format: match self.kind {
                TableProviderKind::Csv => TableFormatV1::Csv,
                TableProviderKind::Tsv => TableFormatV1::Tsv,
            },
            columns,
            rows,
            truncation,
        };
        let completeness = if source_complete && !payload.truncation.any() {
            PreviewCompleteness::Complete
        } else {
            PreviewCompleteness::Partial
        };
        let encoded_table = encode_table_payload(payload)?;
        Ok(PreviewProviderResult {
            representation: PreviewRepresentation::Table { encoded_table },
            completeness,
            warnings: Vec::new(),
        })
    }

    fn cleanup(&mut self) {}
}

fn source_can_render_structured(snapshot: &PreviewSourceSnapshot) -> bool {
    snapshot.metadata.read_eligibility == ContentReadEligibility::Eligible
        && snapshot.capabilities.can_select_text
}

fn structured_kind_matches(kind: StructuredProviderKind, snapshot: &PreviewSourceSnapshot) -> bool {
    match kind {
        StructuredProviderKind::Json => is_json_hint(&snapshot.metadata),
        StructuredProviderKind::Yaml => is_yaml_hint(&snapshot.metadata),
        StructuredProviderKind::Xml => is_xml_hint(&snapshot.metadata),
    }
}

fn table_kind_matches(kind: TableProviderKind, snapshot: &PreviewSourceSnapshot) -> bool {
    match kind {
        TableProviderKind::Csv => is_csv_hint(&snapshot.metadata),
        TableProviderKind::Tsv => is_tsv_hint(&snapshot.metadata),
    }
}

fn normalized_extension(metadata: &PreviewMetadata) -> Option<String> {
    metadata
        .extension
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.trim_start_matches('.').to_ascii_lowercase())
        .filter(|value| !value.is_empty())
}

fn normalized_media_type(metadata: &PreviewMetadata) -> Option<String> {
    metadata
        .media_type
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_ascii_lowercase)
}

fn is_json_hint(metadata: &PreviewMetadata) -> bool {
    matches!(normalized_extension(metadata).as_deref(), Some("json"))
        || matches!(
            normalized_media_type(metadata).as_deref(),
            Some(
                "application/json"
                    | "text/json"
                    | "application/ld+json"
                    | "application/manifest+json"
            )
        )
}

fn is_yaml_hint(metadata: &PreviewMetadata) -> bool {
    matches!(
        normalized_extension(metadata).as_deref(),
        Some("yaml" | "yml")
    ) || matches!(
        normalized_media_type(metadata).as_deref(),
        Some("application/yaml" | "text/yaml" | "application/x-yaml")
    )
}

fn is_xml_hint(metadata: &PreviewMetadata) -> bool {
    matches!(normalized_extension(metadata).as_deref(), Some("xml"))
        || matches!(
            normalized_media_type(metadata).as_deref(),
            Some(
                "application/xml"
                    | "text/xml"
                    | "application/xhtml+xml"
                    | "application/rss+xml"
                    | "application/atom+xml"
            )
        )
}

fn is_csv_hint(metadata: &PreviewMetadata) -> bool {
    matches!(normalized_extension(metadata).as_deref(), Some("csv"))
        || matches!(
            normalized_media_type(metadata).as_deref(),
            Some("text/csv" | "application/csv")
        )
}

fn is_tsv_hint(metadata: &PreviewMetadata) -> bool {
    matches!(normalized_extension(metadata).as_deref(), Some("tsv"))
        || matches!(
            normalized_media_type(metadata).as_deref(),
            Some("text/tab-separated-values" | "text/tsv" | "application/tsv")
        )
}

fn decode_utf8_input(read: BoundedContentRead) -> Result<(String, bool), PreviewProviderError> {
    let complete = read.complete;
    let bytes = read.bytes;
    let text = match str::from_utf8(&bytes) {
        Ok(text) => text,
        Err(error) if !complete && error.error_len().is_none() => {
            str::from_utf8(&bytes[..error.valid_up_to()])
                .map_err(|_| PreviewProviderError::Failed)?
        }
        Err(_) => {
            return Err(if complete {
                PreviewProviderError::CorruptSource
            } else {
                PreviewProviderError::Failed
            })
        }
    };
    Ok((
        text.strip_prefix('\u{feff}').unwrap_or(text).to_owned(),
        complete,
    ))
}

fn encode_structured_payload(
    mut payload: StructuredTreePayloadV1,
) -> Result<String, PreviewProviderError> {
    let mut encoded = serde_json::to_vec(&payload).map_err(|_| PreviewProviderError::Failed)?;
    if encoded.len() > MAX_ENCODED_STRUCTURED_BYTES {
        truncate_structured_strings(&mut payload.root, 1024, &mut payload.truncation);
        payload.truncation.strings = true;
        encoded = serde_json::to_vec(&payload).map_err(|_| PreviewProviderError::Failed)?;
    }
    while encoded.len() > MAX_ENCODED_STRUCTURED_BYTES {
        if !prune_one_structured_child(&mut payload.root) {
            return Err(PreviewProviderError::Failed);
        }
        payload.truncation.nodes = true;
        encoded = serde_json::to_vec(&payload).map_err(|_| PreviewProviderError::Failed)?;
    }
    String::from_utf8(encoded).map_err(|_| PreviewProviderError::Failed)
}

fn truncate_structured_strings(
    node: &mut StructuredNodeV1,
    max_bytes: usize,
    truncation: &mut StructuredTruncationV1,
) {
    match node {
        StructuredNodeV1::Object { entries } => {
            for entry in entries {
                let next = truncate_utf8(&entry.key, max_bytes);
                if next.len() != entry.key.len() {
                    truncation.strings = true;
                }
                entry.key = next;
                truncate_structured_strings(&mut entry.value, max_bytes, truncation);
            }
        }
        StructuredNodeV1::Array { items } => {
            for item in items {
                truncate_structured_strings(item, max_bytes, truncation);
            }
        }
        StructuredNodeV1::Scalar { value, .. } | StructuredNodeV1::Text { value } => {
            let next = truncate_utf8(value, max_bytes);
            if next.len() != value.len() {
                truncation.strings = true;
            }
            *value = next;
        }
        StructuredNodeV1::Element {
            name,
            attributes,
            children,
        } => {
            let next = truncate_utf8(name, max_bytes);
            if next.len() != name.len() {
                truncation.strings = true;
            }
            *name = next;
            for attribute in attributes {
                let next_name = truncate_utf8(&attribute.name, max_bytes);
                let next_value = truncate_utf8(&attribute.value, max_bytes);
                if next_name.len() != attribute.name.len()
                    || next_value.len() != attribute.value.len()
                {
                    truncation.strings = true;
                }
                attribute.name = next_name;
                attribute.value = next_value;
            }
            for child in children {
                truncate_structured_strings(child, max_bytes, truncation);
            }
        }
    }
}

fn prune_one_structured_child(node: &mut StructuredNodeV1) -> bool {
    match node {
        StructuredNodeV1::Object { entries } => {
            if entries.pop().is_some() {
                return true;
            }
            entries
                .iter_mut()
                .rev()
                .any(|entry| prune_one_structured_child(&mut entry.value))
        }
        StructuredNodeV1::Array { items } => {
            if items.pop().is_some() {
                return true;
            }
            items.iter_mut().rev().any(prune_one_structured_child)
        }
        StructuredNodeV1::Element { children, .. } => {
            if children.pop().is_some() {
                return true;
            }
            children.iter_mut().rev().any(prune_one_structured_child)
        }
        StructuredNodeV1::Scalar { .. } | StructuredNodeV1::Text { .. } => false,
    }
}

fn encode_table_payload(mut payload: TablePayloadV1) -> Result<String, PreviewProviderError> {
    let mut encoded = serde_json::to_vec(&payload).map_err(|_| PreviewProviderError::Failed)?;
    if encoded.len() > MAX_ENCODED_TABLE_BYTES {
        for column in &mut payload.columns {
            *column = truncate_utf8(column, 1024);
        }
        for row in &mut payload.rows {
            for cell in row {
                *cell = truncate_utf8(cell, 1024);
            }
        }
        payload.truncation.cells = true;
        encoded = serde_json::to_vec(&payload).map_err(|_| PreviewProviderError::Failed)?;
    }
    while encoded.len() > MAX_ENCODED_TABLE_BYTES && !payload.rows.is_empty() {
        payload.rows.pop();
        payload.truncation.rows = true;
        encoded = serde_json::to_vec(&payload).map_err(|_| PreviewProviderError::Failed)?;
    }
    while encoded.len() > MAX_ENCODED_TABLE_BYTES && !payload.columns.is_empty() {
        payload.columns.pop();
        for row in &mut payload.rows {
            row.truncate(payload.columns.len());
        }
        payload.truncation.columns = true;
        encoded = serde_json::to_vec(&payload).map_err(|_| PreviewProviderError::Failed)?;
    }
    if encoded.len() > MAX_ENCODED_TABLE_BYTES {
        return Err(PreviewProviderError::Failed);
    }
    String::from_utf8(encoded).map_err(|_| PreviewProviderError::Failed)
}

fn truncate_utf8(value: &str, max_bytes: usize) -> String {
    if value.len() <= max_bytes {
        return value.to_owned();
    }
    let mut end = max_bytes;
    while end > 0 && !value.is_char_boundary(end) {
        end -= 1;
    }
    value[..end].to_owned()
}

fn parse_error(complete: bool) -> PreviewProviderError {
    if complete {
        PreviewProviderError::CorruptSource
    } else {
        PreviewProviderError::Failed
    }
}

#[derive(Debug, Default)]
struct JsonBudget {
    nodes: usize,
    truncation: StructuredTruncationV1,
}

impl JsonBudget {
    fn take_node(&mut self) -> bool {
        if self.nodes >= MAX_STRUCTURED_NODES {
            self.truncation.nodes = true;
            return false;
        }
        self.nodes += 1;
        true
    }

    fn bounded_string(&mut self, value: String, max_bytes: usize) -> String {
        let bounded = truncate_utf8(&value, max_bytes);
        if bounded.len() != value.len() {
            self.truncation.strings = true;
        }
        bounded
    }
}

struct JsonSeed<'a> {
    budget: &'a mut JsonBudget,
    depth: usize,
}

impl<'de> de::DeserializeSeed<'de> for JsonSeed<'_> {
    type Value = Option<StructuredNodeV1>;

    fn deserialize<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
    where
        D: de::Deserializer<'de>,
    {
        if self.depth > MAX_STRUCTURED_DEPTH {
            self.budget.truncation.depth = true;
            deserializer.deserialize_ignored_any(de::IgnoredAny)?;
            return Ok(None);
        }
        if !self.budget.take_node() {
            deserializer.deserialize_ignored_any(de::IgnoredAny)?;
            return Ok(None);
        }
        deserializer.deserialize_any(JsonVisitor {
            budget: self.budget,
            depth: self.depth,
        })
    }
}

struct JsonKeySeed<'a> {
    budget: &'a mut JsonBudget,
}

impl<'de> de::DeserializeSeed<'de> for JsonKeySeed<'_> {
    type Value = String;

    fn deserialize<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
    where
        D: de::Deserializer<'de>,
    {
        deserializer.deserialize_string(JsonKeyVisitor {
            budget: self.budget,
        })
    }
}

struct JsonKeyVisitor<'a> {
    budget: &'a mut JsonBudget,
}

impl<'de> de::Visitor<'de> for JsonKeyVisitor<'_> {
    type Value = String;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a JSON object key")
    }

    fn visit_borrowed_str<E>(self, value: &'de str) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        Ok(self
            .budget
            .bounded_string(value.to_owned(), MAX_STRUCTURED_KEY_BYTES))
    }

    fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        Ok(self
            .budget
            .bounded_string(value.to_owned(), MAX_STRUCTURED_KEY_BYTES))
    }

    fn visit_string<E>(self, value: String) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        Ok(self.budget.bounded_string(value, MAX_STRUCTURED_KEY_BYTES))
    }
}

struct JsonVisitor<'a> {
    budget: &'a mut JsonBudget,
    depth: usize,
}

impl<'de> de::Visitor<'de> for JsonVisitor<'_> {
    type Value = Option<StructuredNodeV1>;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a bounded JSON value")
    }

    fn visit_map<M>(self, mut map: M) -> Result<Self::Value, M::Error>
    where
        M: de::MapAccess<'de>,
    {
        let mut entries = Vec::new();
        while let Some(key) = map.next_key_seed(JsonKeySeed {
            budget: self.budget,
        })? {
            let value = map.next_value_seed(JsonSeed {
                budget: self.budget,
                depth: self.depth + 1,
            })?;
            if let Some(value) = value {
                entries.push(StructuredObjectEntryV1 { key, value });
            }
        }
        Ok(Some(StructuredNodeV1::Object { entries }))
    }

    fn visit_seq<S>(self, mut sequence: S) -> Result<Self::Value, S::Error>
    where
        S: de::SeqAccess<'de>,
    {
        let mut items = Vec::new();
        while let Some(item) = sequence.next_element_seed(JsonSeed {
            budget: self.budget,
            depth: self.depth + 1,
        })? {
            if let Some(item) = item {
                items.push(item);
            }
        }
        Ok(Some(StructuredNodeV1::Array { items }))
    }

    fn visit_borrowed_str<E>(self, value: &'de str) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        Ok(Some(StructuredNodeV1::Scalar {
            scalar_type: StructuredScalarTypeV1::String,
            value: self
                .budget
                .bounded_string(value.to_owned(), MAX_STRUCTURED_SCALAR_BYTES),
        }))
    }

    fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        self.visit_string(value.to_owned())
    }

    fn visit_string<E>(self, value: String) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        Ok(Some(StructuredNodeV1::Scalar {
            scalar_type: StructuredScalarTypeV1::String,
            value: self
                .budget
                .bounded_string(value, MAX_STRUCTURED_SCALAR_BYTES),
        }))
    }

    fn visit_bool<E>(self, value: bool) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        Ok(Some(StructuredNodeV1::Scalar {
            scalar_type: StructuredScalarTypeV1::Boolean,
            value: value.to_string(),
        }))
    }

    fn visit_i64<E>(self, value: i64) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        self.visit_number(value.to_string())
    }

    fn visit_u64<E>(self, value: u64) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        self.visit_number(value.to_string())
    }

    fn visit_i128<E>(self, value: i128) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        self.visit_number(value.to_string())
    }

    fn visit_u128<E>(self, value: u128) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        self.visit_number(value.to_string())
    }

    fn visit_f64<E>(self, value: f64) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        self.visit_number(value.to_string())
    }

    fn visit_unit<E>(self) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        Ok(Some(StructuredNodeV1::Scalar {
            scalar_type: StructuredScalarTypeV1::Null,
            value: "null".to_string(),
        }))
    }

    fn visit_none<E>(self) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        self.visit_unit()
    }

    fn visit_some<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
    where
        D: de::Deserializer<'de>,
    {
        deserializer.deserialize_any(self)
    }
}

impl JsonVisitor<'_> {
    fn visit_number<E>(self, value: String) -> Result<Option<StructuredNodeV1>, E>
    where
        E: de::Error,
    {
        Ok(Some(StructuredNodeV1::Scalar {
            scalar_type: StructuredScalarTypeV1::Number,
            value,
        }))
    }
}

fn parse_json(
    text: &str,
) -> Result<(StructuredNodeV1, StructuredTruncationV1), PreviewProviderError> {
    let mut budget = JsonBudget::default();
    if json_depth_exceeds_limit(text) {
        // serde_json's visitor path is recursive inside the parser.  Do not
        // invoke it past its independently safe parser depth and do not
        // invent an empty root merely to label the result Partial.  The
        // provider-local failure preserves the existing Metadata fallback.
        return Err(PreviewProviderError::Failed);
    }
    let mut deserializer = JsonDeserializer::from_str(text);
    let root = JsonSeed {
        budget: &mut budget,
        depth: 0,
    }
    .deserialize(&mut deserializer)
    .map_err(|_| PreviewProviderError::CorruptSource)?
    .ok_or(PreviewProviderError::CorruptSource)?;
    deserializer
        .end()
        .map_err(|_| PreviewProviderError::CorruptSource)?;
    Ok((root, budget.truncation))
}

fn json_depth_exceeds_limit(text: &str) -> bool {
    let mut depth = 0usize;
    let mut escaped = false;
    let mut in_string = false;
    for byte in text.bytes() {
        if in_string {
            if escaped {
                escaped = false;
            } else if byte == b'\\' {
                escaped = true;
            } else if byte == b'"' {
                in_string = false;
            }
            continue;
        }
        match byte {
            b'"' => in_string = true,
            b'{' | b'[' => {
                depth += 1;
                if depth > MAX_JSON_PARSER_DEPTH {
                    return true;
                }
            }
            b'}' | b']' => depth = depth.saturating_sub(1),
            _ => {}
        }
    }
    false
}

#[derive(Debug)]
enum YamlFrame {
    Object {
        entries: Vec<StructuredObjectEntryV1>,
        pending_key: Option<String>,
    },
    Array {
        items: Vec<StructuredNodeV1>,
    },
}

#[derive(Debug, Default)]
struct YamlEventBuilder {
    frames: Vec<YamlFrame>,
    root: Option<StructuredNodeV1>,
    truncation: StructuredTruncationV1,
    nodes: usize,
    suppressed_depth: usize,
    document_count: usize,
    failed: bool,
}

impl YamlEventBuilder {
    fn fail(&mut self) {
        self.failed = true;
    }

    fn take_node(&mut self) -> bool {
        if self.nodes >= MAX_STRUCTURED_NODES {
            self.truncation.nodes = true;
            false
        } else {
            self.nodes += 1;
            true
        }
    }

    /// Consume a value that cannot be represented under the node/depth
    /// budget.  A mapping key is a pending slot, not a source value by
    /// itself; leaving it set would make a valid bounded mapping look like a
    /// malformed mapping at MappingEnd.
    fn drop_pending_value(&mut self) {
        if let Some(YamlFrame::Object { pending_key, .. }) = self.frames.last_mut() {
            pending_key.take();
        }
    }

    fn parent_expects_key(&self) -> bool {
        matches!(
            self.frames.last(),
            Some(YamlFrame::Object {
                pending_key: None,
                ..
            })
        )
    }

    fn start_container(&mut self, sequence: bool, tag_present: bool) {
        if self.failed {
            return;
        }
        if tag_present
            || self.parent_expects_key()
            || (self.frames.is_empty() && self.root.is_some())
        {
            self.fail();
            return;
        }
        if self.suppressed_depth > 0 {
            self.suppressed_depth += 1;
            return;
        }
        if self.frames.len() >= MAX_STRUCTURED_DEPTH {
            self.truncation.depth = true;
            self.suppressed_depth = 1;
            return;
        }
        if !self.take_node() {
            self.suppressed_depth = 1;
            return;
        }
        self.frames.push(if sequence {
            YamlFrame::Array { items: Vec::new() }
        } else {
            YamlFrame::Object {
                entries: Vec::new(),
                pending_key: None,
            }
        });
    }

    fn end_container(&mut self) {
        if self.failed {
            return;
        }
        if self.suppressed_depth > 0 {
            self.suppressed_depth -= 1;
            if self.suppressed_depth == 0 {
                if let Some(YamlFrame::Object { pending_key, .. }) = self.frames.last_mut() {
                    *pending_key = None;
                }
            }
            return;
        }
        let Some(frame) = self.frames.pop() else {
            self.fail();
            return;
        };
        let node = match frame {
            YamlFrame::Object {
                entries,
                pending_key,
            } => {
                if pending_key.is_some() {
                    self.fail();
                    return;
                }
                StructuredNodeV1::Object { entries }
            }
            YamlFrame::Array { items } => StructuredNodeV1::Array { items },
        };
        self.accept_value(node);
    }

    fn scalar(&mut self, value: String, tag_present: bool) {
        if self.failed || self.suppressed_depth > 0 {
            return;
        }
        if tag_present {
            self.fail();
            return;
        }
        if self.parent_expects_key() {
            let key = truncate_utf8(&value, MAX_STRUCTURED_KEY_BYTES);
            if key.len() != value.len() {
                self.truncation.strings = true;
            }
            if let Some(YamlFrame::Object { pending_key, .. }) = self.frames.last_mut() {
                *pending_key = Some(key);
            }
            return;
        }
        let original_len = value.len();
        let value = truncate_utf8(&value, MAX_STRUCTURED_SCALAR_BYTES);
        if value.len() != original_len {
            self.truncation.strings = true;
        }
        if !self.take_node() {
            self.drop_pending_value();
            return;
        }
        self.accept_value(StructuredNodeV1::Scalar {
            scalar_type: StructuredScalarTypeV1::String,
            value,
        });
    }

    fn alias(&mut self, anchor: usize) {
        if self.failed || self.suppressed_depth > 0 {
            return;
        }
        if self.parent_expects_key() {
            if let Some(YamlFrame::Object { pending_key, .. }) = self.frames.last_mut() {
                *pending_key = Some(format!("*{anchor}"));
            }
            return;
        }
        if !self.take_node() {
            self.drop_pending_value();
            return;
        }
        // Alias references are intentionally inert text. They are never
        // expanded, so a hostile anchor graph cannot amplify the payload.
        self.accept_value(StructuredNodeV1::Scalar {
            scalar_type: StructuredScalarTypeV1::String,
            value: format!("*{anchor}"),
        });
    }

    fn accept_value(&mut self, value: StructuredNodeV1) {
        if self.failed || self.suppressed_depth > 0 {
            return;
        }
        match self.frames.last_mut() {
            Some(YamlFrame::Object {
                entries,
                pending_key,
            }) => {
                let Some(key) = pending_key.take() else {
                    self.fail();
                    return;
                };
                if entries.len() >= MAX_STRUCTURED_NODES {
                    self.truncation.nodes = true;
                    return;
                }
                entries.push(StructuredObjectEntryV1 { key, value });
            }
            Some(YamlFrame::Array { items }) => {
                if items.len() >= MAX_STRUCTURED_NODES {
                    self.truncation.nodes = true;
                    return;
                }
                items.push(value);
            }
            None => {
                if self.root.is_some() {
                    self.fail();
                } else {
                    self.root = Some(value);
                }
            }
        }
    }

    fn finish(self) -> Result<(StructuredNodeV1, StructuredTruncationV1), PreviewProviderError> {
        if self.failed
            || self.document_count != 1
            || !self.frames.is_empty()
            || self.suppressed_depth != 0
        {
            return Err(PreviewProviderError::CorruptSource);
        }
        self.root
            .map(|root| (root, self.truncation))
            .ok_or(PreviewProviderError::CorruptSource)
    }
}

impl EventReceiver for YamlEventBuilder {
    fn on_event(&mut self, event: YamlEvent) {
        if self.failed {
            return;
        }
        match event {
            YamlEvent::DocumentStart => {
                self.document_count += 1;
                if self.document_count != 1 {
                    self.fail();
                }
            }
            YamlEvent::MappingStart(_, tag) => self.start_container(false, tag.is_some()),
            YamlEvent::SequenceStart(_, tag) => self.start_container(true, tag.is_some()),
            YamlEvent::MappingEnd | YamlEvent::SequenceEnd => self.end_container(),
            YamlEvent::Scalar(value, _, _, tag) => self.scalar(value, tag.is_some()),
            YamlEvent::Alias(anchor) => self.alias(anchor),
            YamlEvent::DocumentEnd
            | YamlEvent::StreamStart
            | YamlEvent::StreamEnd
            | YamlEvent::Nothing => {}
        }
    }
}

fn parse_yaml(
    text: &str,
) -> Result<(StructuredNodeV1, StructuredTruncationV1), PreviewProviderError> {
    let mut parser = YamlParser::new_from_str(text);
    let mut builder = YamlEventBuilder::default();
    // Parser::load() recursively walks nested mappings/sequences before it
    // returns each event.  Consume the public one-event API instead: the
    // parser's own state stack remains heap-backed and our representation
    // stack is independently capped by YamlEventBuilder.
    loop {
        let (event, _marker) = parser
            .next_token()
            .map_err(|_| PreviewProviderError::CorruptSource)?;
        let stream_end = matches!(event, YamlEvent::StreamEnd);
        builder.on_event(event);
        if stream_end {
            break;
        }
    }
    builder.finish()
}

#[derive(Debug)]
struct XmlElementBuilder {
    name: String,
    attributes: Vec<StructuredAttributeV1>,
    children: Vec<StructuredNodeV1>,
}

#[derive(Debug, Default)]
struct XmlBudget {
    nodes: usize,
    truncation: StructuredTruncationV1,
}

impl XmlBudget {
    fn take_node(&mut self) -> bool {
        if self.nodes >= MAX_STRUCTURED_NODES {
            self.truncation.nodes = true;
            false
        } else {
            self.nodes += 1;
            true
        }
    }

    fn bounded_string(&mut self, value: String, max_bytes: usize) -> String {
        let bounded = truncate_utf8(&value, max_bytes);
        if bounded.len() != value.len() {
            self.truncation.strings = true;
        }
        bounded
    }
}

fn xml_name(bytes: &[u8], budget: &mut XmlBudget) -> Result<String, PreviewProviderError> {
    let name = str::from_utf8(bytes).map_err(|_| PreviewProviderError::CorruptSource)?;
    if name.is_empty() {
        return Err(PreviewProviderError::CorruptSource);
    }
    Ok(budget.bounded_string(name.to_owned(), MAX_STRUCTURED_KEY_BYTES))
}

fn xml_attribute_value(
    bytes: &[u8],
    budget: &mut XmlBudget,
) -> Result<String, PreviewProviderError> {
    let value = str::from_utf8(bytes).map_err(|_| PreviewProviderError::CorruptSource)?;
    let value = quick_xml::escape::unescape(value)
        .map_err(|_| PreviewProviderError::CorruptSource)?
        .into_owned();
    Ok(budget.bounded_string(value, MAX_STRUCTURED_SCALAR_BYTES))
}

fn xml_element_from_start(
    start: &BytesStart<'_>,
    budget: &mut XmlBudget,
) -> Result<XmlElementBuilder, PreviewProviderError> {
    let name = xml_name(start.name().as_ref(), budget)?;
    let mut attributes = Vec::new();
    for (index, attribute) in start.attributes().with_checks(true).enumerate() {
        let attribute = attribute.map_err(|_| PreviewProviderError::CorruptSource)?;
        if index >= MAX_XML_ATTRIBUTES {
            budget.truncation.strings = true;
            continue;
        }
        let name = xml_name(attribute.key.as_ref(), budget)?;
        let value = xml_attribute_value(attribute.value.as_ref(), budget)?;
        attributes.push(StructuredAttributeV1 { name, value });
    }
    Ok(XmlElementBuilder {
        name,
        attributes,
        children: Vec::new(),
    })
}

fn xml_text_value(bytes: &[u8], budget: &mut XmlBudget) -> Result<String, PreviewProviderError> {
    let value = str::from_utf8(bytes).map_err(|_| PreviewProviderError::CorruptSource)?;
    let value = quick_xml::escape::unescape(value)
        .map_err(|_| PreviewProviderError::CorruptSource)?
        .into_owned();
    Ok(budget.bounded_string(value, MAX_STRUCTURED_SCALAR_BYTES))
}

fn xml_cdata_value(bytes: &[u8], budget: &mut XmlBudget) -> Result<String, PreviewProviderError> {
    let value = str::from_utf8(bytes).map_err(|_| PreviewProviderError::CorruptSource)?;
    Ok(budget.bounded_string(value.to_owned(), MAX_STRUCTURED_SCALAR_BYTES))
}

fn append_xml_text(stack: &mut [XmlElementBuilder], value: String, budget: &mut XmlBudget) {
    if value.is_empty() {
        return;
    }
    if !budget.take_node() {
        return;
    }
    if let Some(element) = stack.last_mut() {
        element.children.push(StructuredNodeV1::Text { value });
    }
}

fn attach_xml_node(
    stack: &mut [XmlElementBuilder],
    root: &mut Option<StructuredNodeV1>,
    node: StructuredNodeV1,
) -> Result<(), PreviewProviderError> {
    if let Some(parent) = stack.last_mut() {
        parent.children.push(node);
        return Ok(());
    }
    if root.is_some() {
        return Err(PreviewProviderError::CorruptSource);
    }
    *root = Some(node);
    Ok(())
}

type ParsedTable = (Vec<String>, Vec<Vec<String>>, TableTruncationV1);

fn parse_xml(
    text: &str,
) -> Result<(StructuredNodeV1, StructuredTruncationV1), PreviewProviderError> {
    let mut reader = XmlReader::from_reader(Cursor::new(text.as_bytes()));
    reader.config_mut().trim_text(false);
    reader.config_mut().check_end_names = true;
    let mut buffer = Vec::new();
    let mut budget = XmlBudget::default();
    let mut stack = Vec::new();
    let mut root = None;
    let mut suppressed_depth = 0usize;

    loop {
        let event = reader
            .read_event_into(&mut buffer)
            .map_err(|_| PreviewProviderError::CorruptSource)?;
        match event {
            Event::Start(start) => {
                if suppressed_depth > 0 {
                    suppressed_depth += 1;
                } else if stack.len() >= MAX_STRUCTURED_DEPTH {
                    budget.truncation.depth = true;
                    suppressed_depth = 1;
                } else if !budget.take_node() {
                    suppressed_depth = 1;
                } else {
                    stack.push(xml_element_from_start(&start, &mut budget)?);
                }
            }
            Event::Empty(start) => {
                if suppressed_depth == 0 {
                    if stack.len() >= MAX_STRUCTURED_DEPTH {
                        budget.truncation.depth = true;
                    } else if budget.take_node() {
                        let element = xml_element_from_start(&start, &mut budget)?;
                        attach_xml_node(
                            &mut stack,
                            &mut root,
                            StructuredNodeV1::Element {
                                name: element.name,
                                attributes: element.attributes,
                                children: element.children,
                            },
                        )?;
                    }
                }
            }
            Event::End(end) => {
                if suppressed_depth > 0 {
                    suppressed_depth -= 1;
                } else {
                    let element = stack.pop().ok_or(PreviewProviderError::CorruptSource)?;
                    let end_name = xml_name(end.name().as_ref(), &mut budget)?;
                    if element.name != end_name {
                        return Err(PreviewProviderError::CorruptSource);
                    }
                    attach_xml_node(
                        &mut stack,
                        &mut root,
                        StructuredNodeV1::Element {
                            name: element.name,
                            attributes: element.attributes,
                            children: element.children,
                        },
                    )?;
                }
            }
            Event::Text(value) => {
                if suppressed_depth == 0 {
                    let value = xml_text_value(value.as_ref(), &mut budget)?;
                    if stack.is_empty() {
                        if !value.trim().is_empty() {
                            return Err(PreviewProviderError::CorruptSource);
                        }
                    } else {
                        append_xml_text(&mut stack, value, &mut budget);
                    }
                }
            }
            Event::CData(value) => {
                if suppressed_depth == 0 {
                    let value = xml_cdata_value(value.as_ref(), &mut budget)?;
                    if stack.is_empty() {
                        return Err(PreviewProviderError::CorruptSource);
                    }
                    append_xml_text(&mut stack, value, &mut budget);
                }
            }
            Event::GeneralRef(reference) => {
                if suppressed_depth == 0 {
                    let reference = reference
                        .decode()
                        .map_err(|_| PreviewProviderError::CorruptSource)?;
                    let value = match reference.as_ref() {
                        "lt" => "<",
                        "gt" => ">",
                        "amp" => "&",
                        "apos" => "'",
                        "quot" => "\"",
                        // DTD/entity declarations are rejected below and no
                        // custom entity is ever resolved by this provider.
                        _ => return Err(PreviewProviderError::CorruptSource),
                    };
                    if stack.is_empty() {
                        return Err(PreviewProviderError::CorruptSource);
                    }
                    append_xml_text(&mut stack, value.to_string(), &mut budget);
                }
            }
            Event::DocType(_) => {
                // Reject the declaration itself. The parser is fed only an
                // in-memory prefix and has no entity/resource resolver, but
                // accepting a DTD would make the safety contract ambiguous.
                return Err(PreviewProviderError::CorruptSource);
            }
            Event::Comment(_) | Event::Decl(_) | Event::PI(_) => {}
            Event::Eof => {
                if suppressed_depth != 0 || !stack.is_empty() || root.is_none() {
                    return Err(PreviewProviderError::CorruptSource);
                }
                return Ok((root.expect("checked XML root"), budget.truncation));
            }
        }
        buffer.clear();
    }
}

fn parse_table(
    text: &str,
    kind: TableProviderKind,
    source_complete: bool,
) -> Result<ParsedTable, PreviewProviderError> {
    let delimiter = match kind {
        TableProviderKind::Csv => b',',
        TableProviderKind::Tsv => b'\t',
    };
    let mut reader = ReaderBuilder::new()
        .has_headers(false)
        .flexible(true)
        .delimiter(delimiter)
        .from_reader(text.as_bytes());
    if has_unclosed_csv_quote(text.as_bytes()) {
        return Err(parse_error(source_complete));
    }
    let mut columns = Vec::new();
    let mut rows = Vec::new();
    let mut truncation = TableTruncationV1::none();
    let mut record_index = 0usize;
    for record in reader.records() {
        let record = record.map_err(|_| parse_error(source_complete))?;
        if record_index == 0 {
            for (index, value) in record.iter().enumerate() {
                if index >= MAX_TABLE_COLUMNS {
                    truncation.columns = true;
                    break;
                }
                let bounded = truncate_utf8(value, MAX_TABLE_CELL_BYTES);
                if bounded.len() != value.len() {
                    truncation.cells = true;
                }
                columns.push(bounded);
            }
            record_index += 1;
            continue;
        }
        if rows.len() >= MAX_TABLE_ROWS {
            truncation.rows = true;
            break;
        }
        let mut row = Vec::new();
        for (index, value) in record.iter().enumerate() {
            if index >= MAX_TABLE_COLUMNS {
                truncation.columns = true;
                break;
            }
            let bounded = truncate_utf8(value, MAX_TABLE_CELL_BYTES);
            if bounded.len() != value.len() {
                truncation.cells = true;
            }
            row.push(bounded);
        }
        rows.push(row);
        record_index += 1;
    }
    Ok((columns, rows, truncation))
}

fn has_unclosed_csv_quote(bytes: &[u8]) -> bool {
    let mut in_quotes = false;
    let mut index = 0usize;
    while index < bytes.len() {
        match (in_quotes, bytes[index]) {
            (true, b'"') if bytes.get(index + 1) == Some(&b'"') => index += 1,
            (true, b'"') => in_quotes = false,
            (false, b'"') => in_quotes = true,
            _ => {}
        }
        index += 1;
    }
    in_quotes
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::file_workspace::preview::{
        BoundedContentReadRequest, PreviewCancellation, PreviewContentReadAccess,
        PreviewProviderRegistry, PreviewReadAccessError,
    };
    use std::sync::Mutex;
    use std::time::{Duration, Instant};

    struct FakeReader {
        bytes: Mutex<Option<BoundedContentRead>>,
    }

    impl PreviewContentReadAccess for FakeReader {
        fn read_source_bounded(
            &self,
            _source: &PreviewSourceRef,
            _source_version: &str,
            _request: BoundedContentReadRequest,
            _context: &PreviewOperationContext,
        ) -> Result<BoundedContentRead, PreviewReadAccessError> {
            self.bytes
                .lock()
                .expect("fake structured reader lock")
                .take()
                .ok_or(PreviewReadAccessError::Failed)
        }
    }

    fn source() -> PreviewSourceRef {
        PreviewSourceRef::Managed {
            file_id: "structured-fixture".to_string(),
        }
    }

    fn snapshot(extension: &str, media_type: &str) -> PreviewSourceSnapshot {
        PreviewSourceSnapshot::new(
            source(),
            "structured-version",
            PreviewMetadata {
                display_name: format!("fixture.{extension}"),
                media_type: Some(media_type.to_string()),
                extension: Some(extension.to_string()),
                size_bytes: None,
                modified_at_epoch_ms: None,
                materialization: crate::file_workspace::MaterializationState::BoundaryReadable,
                read_eligibility: ContentReadEligibility::Eligible,
            },
            PreviewCapabilities {
                can_select_text: true,
                ..PreviewCapabilities::default()
            },
        )
    }

    fn context() -> PreviewOperationContext {
        PreviewOperationContext::for_backend_content_read(
            "structured-session",
            "structured-request",
            "structured-version",
            PreviewCancellation::default(),
            Instant::now() + Duration::from_secs(1),
        )
    }

    fn load(
        provider: &dyn PreviewProvider,
        snapshot: &PreviewSourceSnapshot,
        bytes: &[u8],
        complete: bool,
    ) -> Result<PreviewProviderResult, PreviewProviderError> {
        let mut prepared = provider.prepare(snapshot, &context())?;
        let reader = Arc::new(FakeReader {
            bytes: Mutex::new(Some(BoundedContentRead {
                bytes: bytes.to_vec(),
                complete,
            })),
        });
        prepared.load(
            &context(),
            PreviewProviderEnvironment {
                content_read: None,
                preview_read: Some(reader.as_ref()),
                publication: None,
                asset_publisher: None,
                decoder_admission: None,
                archive_admission: None,
            },
        )
    }

    fn structured_payload(result: PreviewProviderResult) -> StructuredTreePayloadV1 {
        let PreviewRepresentation::StructuredTree { encoded_tree } = result.representation else {
            panic!("expected structured representation");
        };
        serde_json::from_str(&encoded_tree).expect("strict structured payload")
    }

    fn table_payload(result: PreviewProviderResult) -> TablePayloadV1 {
        let PreviewRepresentation::Table { encoded_table } = result.representation else {
            panic!("expected table representation");
        };
        serde_json::from_str(&encoded_table).expect("strict table payload")
    }

    #[test]
    fn registry_contains_w3_05_providers_once_in_priority_order() {
        let mut providers =
            crate::file_workspace::preview_providers::production_preview_providers();
        let registry = PreviewProviderRegistry::new(std::mem::take(&mut providers))
            .expect("production providers are unique");
        assert_eq!(
            registry.provider_ids(),
            vec![
                "builtin.markdown",
                "builtin.image",
                "builtin.archive-zip",
                "builtin.structured-json",
                "builtin.structured-yaml",
                "builtin.structured-xml",
                "builtin.table-csv",
                "builtin.table-tsv",
                "builtin.source-code",
                "builtin.text"
            ]
        );
    }

    #[test]
    fn json_payload_is_strict_and_duplicate_keys_are_preserved_in_source_order() {
        let provider = StructuredPreviewProvider::new(
            "builtin.structured-json",
            260,
            StructuredProviderKind::Json,
        );
        let result = load(
            &provider,
            &snapshot("json", "application/json"),
            br#"{"object":{"a":1,"a":true},"array":[null,"x"],"ok":false}"#,
            true,
        )
        .expect("valid JSON");
        assert_eq!(result.completeness, PreviewCompleteness::Complete);
        let payload = structured_payload(result);
        assert_eq!(payload.schema_version, 1);
        assert_eq!(payload.format, StructuredFormatV1::Json);
        let wire = serde_json::to_value(&payload).expect("payload wire");
        assert!(wire.get("path").is_none());
        assert_eq!(payload.schema_version, 1);
        assert!(
            serde_json::from_value::<StructuredTreePayloadV1>(serde_json::json!({
                "schemaVersion": 2,
                "format": "json",
                "root": {"kind": "scalar", "scalarType": "string", "value": "x"},
                "truncation": {"depth": false, "nodes": false, "strings": false}
            }))
            .is_err()
        );
        let StructuredNodeV1::Object { entries } = payload.root else {
            panic!("expected object root");
        };
        let StructuredNodeV1::Object {
            entries: duplicate_entries,
        } = &entries[0].value
        else {
            panic!("expected nested object");
        };
        assert_eq!(duplicate_entries.len(), 2);
        assert_eq!(duplicate_entries[0].key, "a");
        assert_eq!(duplicate_entries[1].key, "a");
    }

    #[test]
    fn json_depth_nodes_and_string_limits_are_truthful_and_bounded() {
        let provider = StructuredPreviewProvider::new(
            "builtin.structured-json",
            260,
            StructuredProviderKind::Json,
        );
        let mut deep = String::new();
        for _ in 0..(MAX_STRUCTURED_DEPTH + 8) {
            deep.push('[');
        }
        deep.push('0');
        for _ in 0..(MAX_STRUCTURED_DEPTH + 8) {
            deep.push(']');
        }
        let deep = load(
            &provider,
            &snapshot("json", "application/json"),
            deep.as_bytes(),
            true,
        );
        assert_eq!(deep, Err(PreviewProviderError::Failed));

        let many = format!(
            "[{}]",
            (0..(MAX_STRUCTURED_NODES + 5))
                .map(|_| "0")
                .collect::<Vec<_>>()
                .join(",")
        );
        let many = load(
            &provider,
            &snapshot("json", "application/json"),
            many.as_bytes(),
            true,
        )
        .expect("many JSON nodes are bounded");
        assert_eq!(many.completeness, PreviewCompleteness::Partial);
        assert!(structured_payload(many).truncation.nodes);

        let huge = format!(
            "{{\"value\":\"{}\"}}",
            "x".repeat(MAX_STRUCTURED_SCALAR_BYTES + 10)
        );
        let huge = load(
            &provider,
            &snapshot("json", "application/json"),
            huge.as_bytes(),
            true,
        )
        .expect("huge JSON scalar is bounded");
        assert_eq!(huge.completeness, PreviewCompleteness::Partial);
        assert!(structured_payload(huge).truncation.strings);
    }

    #[test]
    fn malformed_json_and_truncated_prefix_never_publish_complete() {
        let provider = StructuredPreviewProvider::new(
            "builtin.structured-json",
            260,
            StructuredProviderKind::Json,
        );
        assert_eq!(
            load(
                &provider,
                &snapshot("json", "application/json"),
                br#"{"broken": }"#,
                true
            ),
            Err(PreviewProviderError::CorruptSource)
        );
        let partial = load(
            &provider,
            &snapshot("json", "application/json"),
            br#"{"valid":true}"#,
            false,
        )
        .expect("valid prefix remains truthful");
        assert_eq!(partial.completeness, PreviewCompleteness::Partial);
        let payload = structured_payload(partial);
        let StructuredNodeV1::Object { entries } = payload.root else {
            panic!("expected real JSON prefix object");
        };
        assert_eq!(entries[0].key, "valid");
        assert_eq!(
            load(
                &provider,
                &snapshot("json", "application/json"),
                br#"{"valid":true"#,
                false,
            ),
            Err(PreviewProviderError::Failed)
        );
    }

    #[test]
    fn yaml_is_inert_bounded_single_document_and_aliases_are_not_expanded() {
        let provider = StructuredPreviewProvider::new(
            "builtin.structured-yaml",
            250,
            StructuredProviderKind::Yaml,
        );
        let result = load(
            &provider,
            &snapshot("yaml", "application/yaml"),
            b"name: Zen\nitems:\n  - one\n  - two\nbase: &base {safe: value}\ncopy: *base\n",
            true,
        )
        .expect("valid YAML");
        let payload = structured_payload(result);
        assert_eq!(payload.format, StructuredFormatV1::Yaml);
        let encoded = serde_json::to_string(&payload).expect("yaml payload");
        assert!(encoded.contains("*"));
        assert!(!encoded.contains("safe\\\":\\\"value"));
        assert_eq!(
            load(
                &provider,
                &snapshot("yaml", "application/yaml"),
                b"---\none: 1\n---\ntwo: 2\n",
                true,
            ),
            Err(PreviewProviderError::CorruptSource)
        );
        assert_eq!(
            load(
                &provider,
                &snapshot("yaml", "application/yaml"),
                b"tagged: !ruby/object:User {}\n",
                true,
            ),
            Err(PreviewProviderError::CorruptSource)
        );
    }

    #[test]
    fn yaml_deep_hostile_nesting_is_iterative_and_depth_truncated() {
        let provider = StructuredPreviewProvider::new(
            "builtin.structured-yaml",
            250,
            StructuredProviderKind::Yaml,
        );
        // Flow collections have an upstream scanner recursion limit.  Use
        // deeply indented block sequences instead so the fixture exercises
        // the parser's nested event production rather than that unrelated
        // syntax limit, while remaining under the 512 KiB source prefix.
        let hostile_depth = 900usize;
        let mut deep = String::with_capacity(hostile_depth * hostile_depth / 2);
        for level in 0..hostile_depth {
            deep.push_str(&" ".repeat(level));
            if level + 1 == hostile_depth {
                deep.push_str("- 0\n");
            } else {
                deep.push_str("-\n");
            }
        }
        assert!(deep.len() < PREVIEW_STRUCTURED_TABLE_READ_BYTES as usize);

        let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            load(
                &provider,
                &snapshot("yaml", "application/yaml"),
                deep.as_bytes(),
                true,
            )
        }))
        .expect("iterative YAML parsing must not panic or overflow the stack");
        let result = outcome.expect("deep YAML remains a bounded Partial preview");
        assert_eq!(result.completeness, PreviewCompleteness::Partial);
        let PreviewRepresentation::StructuredTree { encoded_tree } = result.representation else {
            panic!("expected structured YAML representation");
        };
        assert!(encoded_tree.contains("\"depth\":true"));
        assert!(encoded_tree.len() <= MAX_ENCODED_STRUCTURED_BYTES);
    }

    #[test]
    fn yaml_mapping_node_budget_drops_values_without_corrupting_the_mapping() {
        let provider = StructuredPreviewProvider::new(
            "builtin.structured-yaml",
            250,
            StructuredProviderKind::Yaml,
        );
        let large_mapping = (0..(MAX_STRUCTURED_NODES + 64))
            .map(|index| format!("key{index}: value{index}\n"))
            .collect::<String>();
        let result = load(
            &provider,
            &snapshot("yaml", "application/yaml"),
            large_mapping.as_bytes(),
            true,
        )
        .expect("node-limited valid YAML mapping remains Partial");
        assert_eq!(result.completeness, PreviewCompleteness::Partial);
        let payload = structured_payload(result);
        assert!(payload.truncation.nodes);
        let StructuredNodeV1::Object { entries } = payload.root else {
            panic!("expected bounded YAML mapping");
        };
        assert!(entries.len() <= MAX_STRUCTURED_NODES);
    }

    #[test]
    fn truncated_structured_prefixes_never_fabricate_source_nodes() {
        let json_provider = StructuredPreviewProvider::new(
            "builtin.structured-json",
            260,
            StructuredProviderKind::Json,
        );
        assert_eq!(
            load(
                &json_provider,
                &snapshot("json", "application/json"),
                br#"{"name":"Zen""#,
                false,
            ),
            Err(PreviewProviderError::Failed)
        );

        let yaml_provider = StructuredPreviewProvider::new(
            "builtin.structured-yaml",
            250,
            StructuredProviderKind::Yaml,
        );
        assert_eq!(
            load(
                &yaml_provider,
                &snapshot("yaml", "application/yaml"),
                b"root: [one\n",
                false,
            ),
            Err(PreviewProviderError::Failed)
        );

        let xml_provider = StructuredPreviewProvider::new(
            "builtin.structured-xml",
            240,
            StructuredProviderKind::Xml,
        );
        assert_eq!(
            load(
                &xml_provider,
                &snapshot("xml", "application/xml"),
                b"<root><child>",
                false,
            ),
            Err(PreviewProviderError::Failed)
        );

        let real_prefix = load(
            &yaml_provider,
            &snapshot("yaml", "application/yaml"),
            b"name: Zen\n",
            false,
        )
        .expect("complete parsed YAML prefix remains truthful");
        assert_eq!(real_prefix.completeness, PreviewCompleteness::Partial);
        let payload = structured_payload(real_prefix);
        let StructuredNodeV1::Object { entries } = payload.root else {
            panic!("expected real YAML prefix object");
        };
        assert_eq!(entries[0].key, "name");

        let real_xml_prefix = load(
            &xml_provider,
            &snapshot("xml", "application/xml"),
            b"<root>safe</root>",
            false,
        )
        .expect("complete parsed XML prefix remains truthful");
        assert_eq!(real_xml_prefix.completeness, PreviewCompleteness::Partial);
        let payload = structured_payload(real_xml_prefix);
        let StructuredNodeV1::Element { name, .. } = payload.root else {
            panic!("expected real XML prefix element");
        };
        assert_eq!(name, "root");
    }

    #[test]
    fn xml_rejects_dtd_entities_and_keeps_markup_as_inert_nodes() {
        let provider = StructuredPreviewProvider::new(
            "builtin.structured-xml",
            240,
            StructuredProviderKind::Xml,
        );
        let result = load(
            &provider,
            &snapshot("xml", "application/xml"),
            br#"<root attr="<script>" xml:lang="en"><item>text &amp; &lt;script&gt;</item><![CDATA[<script>]]></root>"#,
            true,
        )
        .expect("safe XML");
        let payload = structured_payload(result);
        assert_eq!(payload.format, StructuredFormatV1::Xml);
        let encoded = serde_json::to_string(&payload).expect("xml payload");
        assert!(encoded.contains("&lt;script&gt;") || encoded.contains("<script>"));
        for hostile in [
            br#"<!DOCTYPE root SYSTEM "http://127.0.0.1:9/xxe"><root/>"#.as_slice(),
            br#"<!DOCTYPE root SYSTEM "file:///tmp/secret"><root/>"#.as_slice(),
            br#"<!DOCTYPE root SYSTEM "relative.dtd"><root/>"#.as_slice(),
            br#"<!DOCTYPE root [<!ENTITY laugh "ha">]><root>&laugh;</root>"#.as_slice(),
        ] {
            assert_eq!(
                load(
                    &provider,
                    &snapshot("xml", "application/xml"),
                    hostile,
                    true
                ),
                Err(PreviewProviderError::CorruptSource)
            );
        }
    }

    #[test]
    fn xml_depth_attributes_and_text_limits_are_partial_not_unbounded() {
        let provider = StructuredPreviewProvider::new(
            "builtin.structured-xml",
            240,
            StructuredProviderKind::Xml,
        );
        let mut deep = String::new();
        for index in 0..(MAX_STRUCTURED_DEPTH + 4) {
            deep.push_str(&format!("<n{index}>"));
        }
        deep.push('x');
        for index in (0..(MAX_STRUCTURED_DEPTH + 4)).rev() {
            deep.push_str(&format!("</n{index}>"));
        }
        let result = load(
            &provider,
            &snapshot("xml", "application/xml"),
            deep.as_bytes(),
            true,
        )
        .expect("deep XML remains bounded");
        assert_eq!(result.completeness, PreviewCompleteness::Partial);
        let PreviewRepresentation::StructuredTree { encoded_tree } = result.representation else {
            panic!("expected structured representation");
        };
        assert!(encoded_tree.contains("\"depth\":true"));

        let attrs = (0..(MAX_XML_ATTRIBUTES + 4))
            .map(|index| format!(" a{index}=\"x\""))
            .collect::<String>();
        let result = load(
            &provider,
            &snapshot("xml", "application/xml"),
            format!("<root{attrs}>text</root>").as_bytes(),
            true,
        )
        .expect("many XML attributes remain bounded");
        assert_eq!(result.completeness, PreviewCompleteness::Partial);
        assert!(structured_payload(result).truncation.strings);

        assert_eq!(
            load(
                &provider,
                &snapshot("xml", "application/xml"),
                b"<root><child>",
                false,
            ),
            Err(PreviewProviderError::Failed)
        );
    }

    #[test]
    fn csv_and_tsv_payloads_keep_headers_ragged_cells_and_formulas_inert() {
        let csv_provider =
            TablePreviewProvider::new("builtin.table-csv", 230, TableProviderKind::Csv);
        let csv = load(
            &csv_provider,
            &snapshot("csv", "text/csv"),
            b"Name,Value\r\nalpha,=SUM(A1:A2)\r\nbeta,\"quoted, cell\"\r\ngamma,+1+1\r\ndelta,-2+3\r\nepsilon,@COMMAND\r\n",
            true,
        )
        .expect("valid CSV");
        let payload = table_payload(csv);
        assert_eq!(payload.format, TableFormatV1::Csv);
        assert_eq!(payload.columns, vec!["Name", "Value"]);
        assert_eq!(payload.rows[0][1], "=SUM(A1:A2)");
        assert_eq!(payload.rows[1][1], "quoted, cell");
        assert_eq!(payload.rows[4][1], "@COMMAND");

        let tsv_provider =
            TablePreviewProvider::new("builtin.table-tsv", 220, TableProviderKind::Tsv);
        let tsv = load(
            &tsv_provider,
            &snapshot("tsv", "text/tab-separated-values"),
            b"A\tB\n1\t2\nragged\n",
            true,
        )
        .expect("valid TSV");
        let payload = table_payload(tsv);
        assert_eq!(payload.format, TableFormatV1::Tsv);
        assert_eq!(payload.rows[1], vec!["ragged"]);
        assert!(serde_json::from_value::<TablePayloadV1>(serde_json::json!({
            "schemaVersion": 2,
            "format": "csv",
            "columns": ["A"],
            "rows": [["1"]],
            "truncation": {"rows": false, "columns": false, "cells": false}
        }))
        .is_err());
    }

    #[test]
    fn table_limits_and_malformed_quotes_are_truthful() {
        let provider = TablePreviewProvider::new("builtin.table-csv", 230, TableProviderKind::Csv);
        let many_rows = (0..(MAX_TABLE_ROWS + 4))
            .map(|index| format!("{index},value"))
            .collect::<Vec<_>>()
            .join("\n");
        let result = load(
            &provider,
            &snapshot("csv", "text/csv"),
            many_rows.as_bytes(),
            true,
        )
        .expect("row bound");
        assert_eq!(result.completeness, PreviewCompleteness::Partial);
        assert!(table_payload(result).truncation.rows);

        assert_eq!(
            load(
                &provider,
                &snapshot("csv", "text/csv"),
                b"header,value\n\"unterminated",
                true,
            ),
            Err(PreviewProviderError::CorruptSource)
        );

        let huge = format!("header\n{}", "x".repeat(MAX_TABLE_CELL_BYTES + 5));
        let result = load(
            &provider,
            &snapshot("csv", "text/csv"),
            huge.as_bytes(),
            true,
        )
        .expect("cell bound");
        assert_eq!(result.completeness, PreviewCompleteness::Partial);
        assert!(table_payload(result).truncation.cells);
    }
}
