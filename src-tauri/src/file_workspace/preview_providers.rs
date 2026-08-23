//! Bounded W3-04 Text, source-code and Markdown Preview providers.
//!
//! These providers are deliberately read-only presentation adapters. They
//! receive only an opaque source reference, source version, Preview operation
//! context and the narrow Preview read adapter. The existing read gate remains
//! the only authority that resolves and opens bytes.

use super::{
    contracts::{ContentReadEligibility, PreviewHostKind, PreviewSourceRef},
    preview::{
        BoundedContentRead, BoundedContentReadRequest, PreparedPreview, PreviewCapabilities,
        PreviewCompleteness, PreviewContentReadAccess, PreviewMetadata, PreviewOperationContext,
        PreviewProvider, PreviewProviderDescriptor, PreviewProviderEnvironment,
        PreviewProviderError, PreviewProviderResult, PreviewReadAccessError, PreviewRepresentation,
        PreviewSourceSnapshot, ProviderProbe,
    },
};
use ammonia::Builder as HtmlSanitizer;
use pulldown_cmark::{html, Options, Parser};
use std::{
    collections::{HashMap, HashSet},
    str,
};

/// Shared W3-04 source prefix. It remains below the existing one-megabyte
/// read-gate ceiling and is used by Text, Code and Markdown alike.
pub(crate) const PREVIEW_TEXT_READ_BYTES: u32 = 512 * 1024;
const MAX_MARKDOWN_HTML_BYTES: usize = 2 * 1024 * 1024;

const ZEN_HOSTS: &[PreviewHostKind] = &[PreviewHostKind::ZenFloating, PreviewHostKind::ZenPinned];

fn text_capabilities() -> PreviewCapabilities {
    PreviewCapabilities {
        can_select_text: true,
        ..PreviewCapabilities::default()
    }
}

pub(crate) fn production_preview_providers() -> Vec<std::sync::Arc<dyn PreviewProvider>> {
    let mut providers: Vec<std::sync::Arc<dyn PreviewProvider>> = vec![
        std::sync::Arc::new(MarkdownPreviewProvider::new()),
        std::sync::Arc::new(crate::file_workspace::preview_image::ImagePreviewProvider::new()),
        std::sync::Arc::new(
            crate::file_workspace::preview_archive::ArchiveZipPreviewProvider::new(),
        ),
        std::sync::Arc::new(SourceCodePreviewProvider::new()),
        std::sync::Arc::new(PlainTextPreviewProvider::new()),
    ];
    providers.extend(crate::file_workspace::preview_structured::production_preview_providers());
    providers
}

pub(crate) struct MarkdownPreviewProvider {
    descriptor: PreviewProviderDescriptor,
}

impl MarkdownPreviewProvider {
    pub(crate) fn new() -> Self {
        Self {
            descriptor: PreviewProviderDescriptor::new(
                "builtin.markdown",
                300,
                text_capabilities(),
                ZEN_HOSTS.to_vec(),
                true,
            ),
        }
    }
}

impl PreviewProvider for MarkdownPreviewProvider {
    fn descriptor(&self) -> &PreviewProviderDescriptor {
        &self.descriptor
    }

    fn probe(
        &self,
        snapshot: &PreviewSourceSnapshot,
        _context: &PreviewOperationContext,
    ) -> ProviderProbe {
        if source_can_render_text(snapshot) && is_markdown_hint(&snapshot.metadata) {
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
        if !source_can_render_text(snapshot) || !is_markdown_hint(&snapshot.metadata) {
            return Err(PreviewProviderError::Unsupported);
        }
        Ok(Box::new(PreparedMarkdownPreview {
            source: snapshot.source.clone(),
            source_version: snapshot.source_version.clone(),
        }))
    }
}

struct PreparedMarkdownPreview {
    source: PreviewSourceRef,
    source_version: String,
}

impl PreparedPreview for PreparedMarkdownPreview {
    fn load(
        &mut self,
        context: &PreviewOperationContext,
        environment: PreviewProviderEnvironment<'_>,
    ) -> Result<PreviewProviderResult, PreviewProviderError> {
        let read = read_source_prefix(
            &self.source,
            &self.source_version,
            context,
            environment.preview_read,
        )?;
        let (text, completeness) = decode_text(read)?;
        let html = render_safe_markdown(&text)?;
        Ok(PreviewProviderResult {
            representation: PreviewRepresentation::SafeHtml { html },
            completeness,
            warnings: Vec::new(),
        })
    }

    fn cleanup(&mut self) {}
}

pub(crate) struct SourceCodePreviewProvider {
    descriptor: PreviewProviderDescriptor,
}

impl SourceCodePreviewProvider {
    pub(crate) fn new() -> Self {
        Self {
            descriptor: PreviewProviderDescriptor::new(
                "builtin.source-code",
                200,
                text_capabilities(),
                ZEN_HOSTS.to_vec(),
                true,
            ),
        }
    }
}

impl PreviewProvider for SourceCodePreviewProvider {
    fn descriptor(&self) -> &PreviewProviderDescriptor {
        &self.descriptor
    }

    fn probe(
        &self,
        snapshot: &PreviewSourceSnapshot,
        _context: &PreviewOperationContext,
    ) -> ProviderProbe {
        if source_can_render_text(snapshot)
            && !crate::file_workspace::preview_structured::is_structured_or_table_hint(
                &snapshot.metadata,
            )
            && code_language(&snapshot.metadata).is_some()
        {
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
        let Some(language) = code_language(&snapshot.metadata) else {
            return Err(PreviewProviderError::Unsupported);
        };
        if !source_can_render_text(snapshot)
            || crate::file_workspace::preview_structured::is_structured_or_table_hint(
                &snapshot.metadata,
            )
        {
            return Err(PreviewProviderError::Unsupported);
        }
        Ok(Box::new(PreparedTextPreview {
            source: snapshot.source.clone(),
            source_version: snapshot.source_version.clone(),
            language: Some(language),
        }))
    }
}

pub(crate) struct PlainTextPreviewProvider {
    descriptor: PreviewProviderDescriptor,
}

impl PlainTextPreviewProvider {
    pub(crate) fn new() -> Self {
        Self {
            descriptor: PreviewProviderDescriptor::new(
                "builtin.text",
                100,
                text_capabilities(),
                ZEN_HOSTS.to_vec(),
                true,
            ),
        }
    }
}

impl PreviewProvider for PlainTextPreviewProvider {
    fn descriptor(&self) -> &PreviewProviderDescriptor {
        &self.descriptor
    }

    fn probe(
        &self,
        snapshot: &PreviewSourceSnapshot,
        _context: &PreviewOperationContext,
    ) -> ProviderProbe {
        if source_can_render_text(snapshot)
            && !crate::file_workspace::preview_structured::is_structured_or_table_hint(
                &snapshot.metadata,
            )
            && is_plain_text_hint(&snapshot.metadata)
        {
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
        if !source_can_render_text(snapshot)
            || crate::file_workspace::preview_structured::is_structured_or_table_hint(
                &snapshot.metadata,
            )
            || !is_plain_text_hint(&snapshot.metadata)
        {
            return Err(PreviewProviderError::Unsupported);
        }
        Ok(Box::new(PreparedTextPreview {
            source: snapshot.source.clone(),
            source_version: snapshot.source_version.clone(),
            language: None,
        }))
    }
}

struct PreparedTextPreview {
    source: PreviewSourceRef,
    source_version: String,
    language: Option<&'static str>,
}

impl PreparedPreview for PreparedTextPreview {
    fn load(
        &mut self,
        context: &PreviewOperationContext,
        environment: PreviewProviderEnvironment<'_>,
    ) -> Result<PreviewProviderResult, PreviewProviderError> {
        let read = read_source_prefix(
            &self.source,
            &self.source_version,
            context,
            environment.preview_read,
        )?;
        let (text, completeness) = decode_text(read)?;
        Ok(PreviewProviderResult {
            representation: PreviewRepresentation::Text {
                text,
                language: self.language.map(str::to_owned),
            },
            completeness,
            warnings: Vec::new(),
        })
    }

    fn cleanup(&mut self) {}
}

fn source_can_render_text(snapshot: &PreviewSourceSnapshot) -> bool {
    snapshot.metadata.read_eligibility == ContentReadEligibility::Eligible
        && snapshot.capabilities.can_select_text
}

pub(crate) fn read_source_prefix(
    source: &PreviewSourceRef,
    source_version: &str,
    context: &PreviewOperationContext,
    reader: Option<&dyn PreviewContentReadAccess>,
) -> Result<BoundedContentRead, PreviewProviderError> {
    read_source_prefix_with_limit(
        source,
        source_version,
        context,
        reader,
        PREVIEW_TEXT_READ_BYTES,
    )
}

pub(crate) fn read_source_prefix_with_limit(
    source: &PreviewSourceRef,
    source_version: &str,
    context: &PreviewOperationContext,
    reader: Option<&dyn PreviewContentReadAccess>,
    max_bytes: u32,
) -> Result<BoundedContentRead, PreviewProviderError> {
    let reader = reader.ok_or(PreviewProviderError::Failed)?;
    reader
        .read_source_bounded(
            source,
            source_version,
            BoundedContentReadRequest {
                offset_bytes: 0,
                max_bytes,
            },
            context,
        )
        .map_err(map_content_read_error)
}

fn map_content_read_error(error: PreviewReadAccessError) -> PreviewProviderError {
    match error {
        PreviewReadAccessError::LeaseInvalid | PreviewReadAccessError::Failed => {
            PreviewProviderError::Failed
        }
        PreviewReadAccessError::SourceVersionMismatch => PreviewProviderError::IdentityChanged,
        PreviewReadAccessError::PermissionDenied => PreviewProviderError::PermissionDenied,
        PreviewReadAccessError::SourceUnavailable => PreviewProviderError::SourceUnavailable,
        PreviewReadAccessError::MaterializationRequired => {
            PreviewProviderError::MaterializationRequired
        }
        PreviewReadAccessError::MetadataOnly => PreviewProviderError::Unsupported,
        PreviewReadAccessError::Cancelled => PreviewProviderError::Cancelled,
        PreviewReadAccessError::TimedOut => PreviewProviderError::Timeout,
    }
}

fn decode_text(
    read: BoundedContentRead,
) -> Result<(String, PreviewCompleteness), PreviewProviderError> {
    let completeness = if read.complete {
        PreviewCompleteness::Complete
    } else {
        PreviewCompleteness::Partial
    };
    let bytes = read.bytes;
    let text = match str::from_utf8(&bytes) {
        Ok(text) => text,
        Err(error) if !read.complete && error.error_len().is_none() => {
            str::from_utf8(&bytes[..error.valid_up_to()])
                .map_err(|_| PreviewProviderError::CorruptSource)?
        }
        Err(_) => return Err(PreviewProviderError::CorruptSource),
    };
    if text.chars().any(is_obvious_binary_character) {
        return Err(PreviewProviderError::CorruptSource);
    }
    Ok((
        text.strip_prefix('\u{feff}').unwrap_or(text).to_owned(),
        completeness,
    ))
}

fn is_obvious_binary_character(character: char) -> bool {
    character == '\0'
        || (character.is_control() && !matches!(character, '\t' | '\n' | '\r' | '\u{000c}'))
}

fn render_safe_markdown(text: &str) -> Result<String, PreviewProviderError> {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TASKLISTS);
    options.insert(Options::ENABLE_FOOTNOTES);

    let mut raw_html = String::with_capacity(text.len().min(MAX_MARKDOWN_HTML_BYTES));
    html::push_html(&mut raw_html, Parser::new_ext(text, options));
    if raw_html.len() > MAX_MARKDOWN_HTML_BYTES {
        return Err(PreviewProviderError::Failed);
    }

    let allowed_tags: HashSet<&str> = [
        "blockquote",
        "br",
        "code",
        "del",
        "em",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "hr",
        "li",
        "ol",
        "p",
        "pre",
        "strong",
        "table",
        "tbody",
        "td",
        "th",
        "thead",
        "tr",
        "ul",
    ]
    .into_iter()
    .collect();
    let sanitized = HtmlSanitizer::default()
        .tags(allowed_tags)
        .tag_attributes(HashMap::new())
        .generic_attributes(HashSet::new())
        .url_schemes(HashSet::new())
        .clean(&raw_html);
    let sanitized = sanitized.to_string();
    if sanitized.len() > MAX_MARKDOWN_HTML_BYTES {
        return Err(PreviewProviderError::Failed);
    }
    Ok(sanitized)
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

fn is_markdown_hint(metadata: &PreviewMetadata) -> bool {
    matches!(
        normalized_extension(metadata).as_deref(),
        Some("md" | "markdown" | "mdown" | "mkdn")
    ) || matches!(
        normalized_media_type(metadata).as_deref(),
        Some("text/markdown" | "text/x-markdown" | "application/markdown")
    )
}

fn is_plain_text_hint(metadata: &PreviewMetadata) -> bool {
    let extension = normalized_extension(metadata);
    let media_type = normalized_media_type(metadata);
    if extension.as_deref().is_some_and(is_binary_extension) {
        return false;
    }
    extension.as_deref().is_some_and(is_known_text_extension)
        || media_type.as_deref().is_some_and(is_text_media_type)
        || media_type
            .as_deref()
            .is_some_and(|value| matches!(value, "application/json" | "application/xml"))
}

fn is_text_media_type(value: &str) -> bool {
    value == "text/plain"
        || value.starts_with("text/")
        || value == "application/json"
        || value == "application/xml"
}

fn is_known_text_extension(value: &str) -> bool {
    matches!(
        value,
        "bat"
            | "c"
            | "cc"
            | "cfg"
            | "conf"
            | "cpp"
            | "csv"
            | "css"
            | "cxx"
            | "env"
            | "gitignore"
            | "h"
            | "hpp"
            | "htm"
            | "html"
            | "ini"
            | "java"
            | "js"
            | "json"
            | "jsx"
            | "kt"
            | "kts"
            | "log"
            | "markdown"
            | "md"
            | "mdown"
            | "mkdn"
            | "php"
            | "ps1"
            | "py"
            | "rb"
            | "rs"
            | "sh"
            | "sql"
            | "swift"
            | "svelte"
            | "text"
            | "toml"
            | "ts"
            | "tsx"
            | "tsv"
            | "txt"
            | "vue"
            | "xml"
            | "yaml"
            | "yml"
    )
}

fn is_binary_extension(value: &str) -> bool {
    matches!(
        value,
        "7z" | "avi"
            | "bmp"
            | "class"
            | "dll"
            | "doc"
            | "docx"
            | "epub"
            | "gif"
            | "gz"
            | "ico"
            | "jpeg"
            | "jpg"
            | "mkv"
            | "mov"
            | "mp3"
            | "mp4"
            | "otf"
            | "pdf"
            | "png"
            | "rar"
            | "tar"
            | "wav"
            | "webp"
            | "woff"
            | "woff2"
            | "xls"
            | "xlsx"
            | "zip"
    )
}

fn code_language(metadata: &PreviewMetadata) -> Option<&'static str> {
    if let Some(extension) = normalized_extension(metadata) {
        let language = match extension.as_str() {
            "bat" => "batch",
            "c" => "c",
            "cc" | "cpp" | "cxx" | "hpp" => "cpp",
            "css" => "css",
            "h" => "c",
            "htm" | "html" => "html",
            "java" => "java",
            "js" | "jsx" => "javascript",
            "json" => "json",
            "kt" | "kts" => "kotlin",
            "php" => "php",
            "ps1" => "powershell",
            "py" => "python",
            "rb" => "ruby",
            "rs" => "rust",
            "sh" => "shell",
            "sql" => "sql",
            "swift" => "swift",
            "svelte" => "svelte",
            "toml" => "toml",
            "ts" | "tsx" => "typescript",
            "vue" => "vue",
            "xml" => "xml",
            "yaml" | "yml" => "yaml",
            _ => return None,
        };
        return Some(language);
    }
    match normalized_media_type(metadata).as_deref() {
        Some("application/json") => Some("json"),
        Some("application/xml") | Some("text/xml") => Some("xml"),
        Some("text/css") => Some("css"),
        Some("text/html") => Some("html"),
        Some("text/x-python") => Some("python"),
        Some("text/x-rust") => Some("rust"),
        Some("text/x-shellscript") => Some("shell"),
        Some("text/typescript") => Some("typescript"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::file_workspace::preview::PreviewCancellation;
    use std::sync::{Arc, Mutex};
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
                .expect("fake reader lock")
                .take()
                .ok_or(PreviewReadAccessError::Failed)
        }
    }

    fn source() -> PreviewSourceRef {
        PreviewSourceRef::Managed {
            file_id: "file-1".to_string(),
        }
    }

    fn snapshot(extension: Option<&str>, media_type: Option<&str>) -> PreviewSourceSnapshot {
        PreviewSourceSnapshot::new(
            source(),
            "version-1",
            PreviewMetadata {
                display_name: "fixture.txt".to_string(),
                media_type: media_type.map(str::to_owned),
                extension: extension.map(str::to_owned),
                size_bytes: None,
                modified_at_epoch_ms: None,
                materialization: crate::file_workspace::MaterializationState::BoundaryReadable,
                read_eligibility: ContentReadEligibility::Eligible,
            },
            PreviewCapabilities {
                can_select_text: true,
                can_search: true,
                ..PreviewCapabilities::default()
            },
        )
    }

    fn context() -> PreviewOperationContext {
        PreviewOperationContext::for_backend_content_read(
            "session-1",
            "request-1",
            "version-1",
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
        let prepared = provider.prepare(snapshot, &context())?;
        let reader = Arc::new(FakeReader {
            bytes: Mutex::new(Some(BoundedContentRead {
                bytes: bytes.to_vec(),
                complete,
            })),
        });
        let mut prepared = prepared;
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

    #[test]
    fn production_providers_are_static_and_markdown_precedes_text() {
        let providers = production_preview_providers();
        let registry = crate::file_workspace::PreviewProviderRegistry::new(providers)
            .expect("provider registry");
        assert_eq!(
            registry.provider_ids(),
            vec![
                "builtin.markdown".to_string(),
                "builtin.image".to_string(),
                "builtin.archive-zip".to_string(),
                "builtin.structured-json".to_string(),
                "builtin.structured-yaml".to_string(),
                "builtin.structured-xml".to_string(),
                "builtin.table-csv".to_string(),
                "builtin.table-tsv".to_string(),
                "builtin.source-code".to_string(),
                "builtin.text".to_string()
            ]
        );
    }

    #[test]
    fn text_preserves_bom_unicode_empty_crlf_and_partial_utf8() {
        let provider = PlainTextPreviewProvider::new();
        let fixture = snapshot(Some("txt"), Some("text/plain"));
        let result = load(
            &provider,
            &fixture,
            b"\xef\xbb\xbfhello\r\n\xe4\xb8\x96\xe7\x95\x8c",
            true,
        )
        .expect("valid text");
        assert_eq!(
            result.representation,
            PreviewRepresentation::Text {
                text: "hello\r\n世界".to_string(),
                language: None
            }
        );
        assert_eq!(result.completeness, PreviewCompleteness::Complete);

        let empty = load(&provider, &fixture, b"", true).expect("empty text");
        assert_eq!(empty.completeness, PreviewCompleteness::Complete);
        assert!(matches!(
            empty.representation,
            PreviewRepresentation::Text { ref text, .. } if text.is_empty()
        ));

        let partial = load(&provider, &fixture, &[0xe4, 0xb8], false).expect("partial utf8");
        assert_eq!(partial.completeness, PreviewCompleteness::Partial);
        assert!(matches!(
            partial.representation,
            PreviewRepresentation::Text { ref text, .. } if text.is_empty()
        ));
    }

    #[test]
    fn invalid_utf8_and_binary_bytes_fail_provider_locally() {
        let provider = PlainTextPreviewProvider::new();
        let fixture = snapshot(Some("txt"), Some("text/plain"));
        assert_eq!(
            load(&provider, &fixture, &[0xff, 0xfe], true),
            Err(PreviewProviderError::CorruptSource)
        );
        assert_eq!(
            load(&provider, &fixture, b"text\0binary", true),
            Err(PreviewProviderError::CorruptSource)
        );
    }

    #[test]
    fn source_code_exposes_only_a_presentation_language_hint() {
        let provider = SourceCodePreviewProvider::new();
        let fixture = snapshot(Some("rs"), Some("text/plain"));
        let result = load(&provider, &fixture, b"fn main() {}", true).expect("code text");
        assert_eq!(
            result.representation,
            PreviewRepresentation::Text {
                text: "fn main() {}".to_string(),
                language: Some("rust".to_string())
            }
        );
        assert!(provider.descriptor().reads_content);
        assert!(!provider.descriptor().capabilities.can_search);
    }

    #[test]
    fn huge_line_stays_bounded_and_partial_is_truthful() {
        let provider = PlainTextPreviewProvider::new();
        let fixture = snapshot(Some("log"), Some("text/plain"));
        let bytes = vec![b'x'; PREVIEW_TEXT_READ_BYTES as usize];
        let result = load(&provider, &fixture, &bytes, false).expect("bounded line");
        assert_eq!(result.completeness, PreviewCompleteness::Partial);
        assert_eq!(
            match result.representation {
                PreviewRepresentation::Text { text, .. } => text.len(),
                _ => 0,
            },
            PREVIEW_TEXT_READ_BYTES as usize
        );
    }

    #[test]
    fn markdown_is_sanitized_without_resource_or_navigation_elements() {
        let provider = MarkdownPreviewProvider::new();
        let fixture = snapshot(Some("md"), Some("text/markdown"));
        let hostile = br#"# Safe

<script>alert(1)</script>
<img src="https://attacker.invalid/x" onerror="alert(2)">
[remote](https://attacker.invalid/page)
![file](file:///secret.txt)
<iframe src="//attacker.invalid/frame"></iframe>
<div style="background:url(file:///secret)">text</div>
"#;
        let result = load(&provider, &fixture, hostile, true).expect("sanitized markdown");
        let PreviewRepresentation::SafeHtml { html } = result.representation else {
            panic!("expected safe html");
        };
        for forbidden in [
            "<script",
            "<img",
            "<iframe",
            "<object",
            "<embed",
            "onerror",
            "onclick",
            "href=",
            "src=",
            "javascript:",
            "style=",
        ] {
            assert!(
                !html.to_ascii_lowercase().contains(forbidden),
                "forbidden {forbidden}: {html}"
            );
        }
        assert!(html.contains("Safe"));
    }

    #[test]
    fn preview_read_error_mapping_preserves_terminal_and_metadata_fallback_semantics() {
        assert_eq!(
            map_content_read_error(PreviewReadAccessError::MaterializationRequired),
            PreviewProviderError::MaterializationRequired
        );
        assert_eq!(
            map_content_read_error(PreviewReadAccessError::SourceUnavailable),
            PreviewProviderError::SourceUnavailable
        );
        assert_eq!(
            map_content_read_error(PreviewReadAccessError::MetadataOnly),
            PreviewProviderError::Unsupported
        );
    }

    #[test]
    fn directories_unknown_sources_and_unsupported_hosts_do_not_probe_as_text() {
        let mut directory = snapshot(Some("txt"), Some("text/plain"));
        directory.capabilities.can_select_text = false;
        let provider = PlainTextPreviewProvider::new();
        assert_eq!(
            provider.probe(&directory, &context()),
            ProviderProbe::Unsupported
        );

        let unknown = snapshot(Some("bin"), Some("application/octet-stream"));
        assert_eq!(
            provider.probe(&unknown, &context()),
            ProviderProbe::Unsupported
        );
    }
}
