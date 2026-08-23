//! Bounded built-in raster Preview provider for W3-06.
//!
//! The provider consumes only the opaque Preview read adapter, validates the
//! actual bytes with a feature-limited local decoder, and publishes one
//! normalized image through the existing Preview asset registry. It has no
//! path, file handle, URL, renderer lease, cache or decode worker authority.

use super::{
    contracts::{ContentReadEligibility, PreviewHostKind, PreviewSourceRef},
    preview::{
        BoundedContentReadRequest, PreparedPreview, PreviewCapabilities, PreviewCompleteness,
        PreviewContentReadAccess, PreviewOperationContext, PreviewProvider,
        PreviewProviderDescriptor, PreviewProviderEnvironment, PreviewProviderError,
        PreviewProviderResult, PreviewReadAccessError, PreviewRepresentation,
        PreviewSourceSnapshot, ProviderProbe,
    },
};
use crate::scheduler::{adapters::PreviewDecoderResourceLeaseAdapter, AcquireError, ResourceLease};
use image::{GenericImageView, ImageDecoder, ImageFormat, ImageReader, Limits};
use std::{
    io::Cursor,
    io::{self, Seek, SeekFrom, Write},
};

const ZEN_HOSTS: &[PreviewHostKind] = &[PreviewHostKind::ZenFloating, PreviewHostKind::ZenPinned];

pub(crate) const IMAGE_PROVIDER_ID: &str = "builtin.image";
pub(crate) const IMAGE_PROVIDER_PRIORITY: i32 = 280;
pub(crate) const MAX_IMAGE_SOURCE_BYTES: usize = 12 * 1024 * 1024;
pub(crate) const IMAGE_READ_CHUNK_BYTES: u32 = 1024 * 1024;
pub(crate) const MAX_IMAGE_SOURCE_WIDTH: u32 = 8192;
pub(crate) const MAX_IMAGE_SOURCE_HEIGHT: u32 = 8192;
pub(crate) const MAX_IMAGE_SOURCE_PIXELS: u64 = 24_000_000;
pub(crate) const MAX_IMAGE_OUTPUT_EDGE: u32 = 4096;
pub(crate) const MAX_IMAGE_OUTPUT_PIXELS: u64 = 12_000_000;
pub(crate) const MAX_IMAGE_DECODE_BYTES: u64 = 96_000_000;
pub(crate) const MAX_IMAGE_ASSET_BYTES: usize = 12 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RasterFormat {
    Png,
    Jpeg,
}

impl RasterFormat {
    fn image_format(self) -> ImageFormat {
        match self {
            Self::Png => ImageFormat::Png,
            Self::Jpeg => ImageFormat::Jpeg,
        }
    }

    fn media_type(self) -> &'static str {
        match self {
            Self::Png => "image/png",
            Self::Jpeg => "image/jpeg",
        }
    }
}

#[derive(Debug)]
struct SourceBytes {
    bytes: Vec<u8>,
    complete: bool,
}

#[derive(Debug)]
struct NormalizedImage {
    bytes: Vec<u8>,
    reduced: bool,
}

pub(crate) struct ImagePreviewProvider {
    descriptor: PreviewProviderDescriptor,
}

impl ImagePreviewProvider {
    pub(crate) fn new() -> Self {
        Self {
            descriptor: PreviewProviderDescriptor::new(
                IMAGE_PROVIDER_ID,
                IMAGE_PROVIDER_PRIORITY,
                PreviewCapabilities::default(),
                ZEN_HOSTS.to_vec(),
                true,
            ),
        }
    }
}

impl PreviewProvider for ImagePreviewProvider {
    fn descriptor(&self) -> &PreviewProviderDescriptor {
        &self.descriptor
    }

    fn probe(
        &self,
        snapshot: &PreviewSourceSnapshot,
        _context: &PreviewOperationContext,
    ) -> ProviderProbe {
        if source_can_render_image(snapshot).is_some() {
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
        let Some(expected_format) = source_can_render_image(snapshot) else {
            return Err(PreviewProviderError::Unsupported);
        };
        Ok(Box::new(PreparedImagePreview {
            source: snapshot.source.clone(),
            source_version: snapshot.source_version.clone(),
            expected_format,
        }))
    }
}

struct PreparedImagePreview {
    source: PreviewSourceRef,
    source_version: String,
    expected_format: RasterFormat,
}

impl PreparedPreview for PreparedImagePreview {
    fn load(
        &mut self,
        context: &PreviewOperationContext,
        environment: PreviewProviderEnvironment<'_>,
    ) -> Result<PreviewProviderResult, PreviewProviderError> {
        let reader = environment
            .preview_read
            .ok_or(PreviewProviderError::Failed)?;
        let publisher = environment
            .asset_publisher
            .ok_or(PreviewProviderError::Failed)?;
        let decoder_admission = environment
            .decoder_admission
            .ok_or(PreviewProviderError::Failed)?;

        let source = read_source_bounded(&self.source, &self.source_version, context, reader)?;
        context.ensure_active().map_err(map_context_error)?;

        // try_acquire is deliberately non-blocking: a full scheduler is a
        // provider-local fallback rather than an unbounded Preview worker
        // wait. The adapter's blocking acquire remains available to the
        // scheduler/lifecycle tests and observes the same cancellation token.
        let (decoded, decoder_lease) = decode_normalized_image(
            &source.bytes,
            self.expected_format,
            context,
            decoder_admission,
        )?;

        let normalized = encode_normalized_image(decoded, self.expected_format)?;
        let completeness = if source.complete && !normalized.reduced {
            PreviewCompleteness::Complete
        } else {
            PreviewCompleteness::Partial
        };
        context.ensure_active().map_err(map_context_error)?;
        let asset_token = publisher
            .publish_asset(context, self.expected_format.media_type(), normalized.bytes)
            .map_err(map_asset_error)?;
        drop(decoder_lease);

        Ok(PreviewProviderResult {
            representation: PreviewRepresentation::Image {
                asset_token,
                media_type: self.expected_format.media_type().to_string(),
            },
            completeness,
            warnings: Vec::new(),
        })
    }

    fn cleanup(&mut self) {}
}

fn source_can_render_image(snapshot: &PreviewSourceSnapshot) -> Option<RasterFormat> {
    if snapshot.metadata.read_eligibility != ContentReadEligibility::Eligible {
        return None;
    }
    hinted_format(
        snapshot.metadata.extension.as_deref(),
        snapshot.metadata.media_type.as_deref(),
    )
}

fn hinted_format(extension: Option<&str>, media_type: Option<&str>) -> Option<RasterFormat> {
    let extension_hint = extension.and_then(format_from_extension);
    let media_hint = media_type.and_then(format_from_media_type);

    // A non-image extension or image media type that disagree is a mismatch,
    // not permission to trust either hint and forward arbitrary bytes.
    if extension.is_some_and(|value| !value.trim().is_empty())
        && extension_hint.is_none()
        && media_hint.is_some()
    {
        return None;
    }
    if extension_hint.is_some()
        && media_type.is_some_and(|value| !value.trim().is_empty())
        && (media_hint.is_none() || extension_hint != media_hint)
    {
        return None;
    }
    extension_hint.or(media_hint)
}

fn format_from_extension(extension: &str) -> Option<RasterFormat> {
    match extension
        .trim()
        .trim_start_matches('.')
        .to_ascii_lowercase()
        .as_str()
    {
        "png" => Some(RasterFormat::Png),
        "jpg" | "jpeg" => Some(RasterFormat::Jpeg),
        _ => None,
    }
}

fn format_from_media_type(media_type: &str) -> Option<RasterFormat> {
    match media_type.trim().to_ascii_lowercase().as_str() {
        "image/png" => Some(RasterFormat::Png),
        "image/jpeg" | "image/jpg" => Some(RasterFormat::Jpeg),
        _ => None,
    }
}

fn read_source_bounded(
    source: &PreviewSourceRef,
    source_version: &str,
    context: &PreviewOperationContext,
    reader: &dyn PreviewContentReadAccess,
) -> Result<SourceBytes, PreviewProviderError> {
    let mut bytes = Vec::with_capacity(MAX_IMAGE_SOURCE_BYTES.min(IMAGE_READ_CHUNK_BYTES as usize));
    let mut offset = 0_u64;

    loop {
        context.ensure_active().map_err(map_context_error)?;
        let remaining = MAX_IMAGE_SOURCE_BYTES.saturating_sub(bytes.len());
        if remaining == 0 {
            return Ok(SourceBytes {
                bytes,
                complete: false,
            });
        }
        let max_bytes = remaining.min(IMAGE_READ_CHUNK_BYTES as usize) as u32;
        let read = reader
            .read_source_bounded(
                source,
                source_version,
                BoundedContentReadRequest {
                    offset_bytes: offset,
                    max_bytes,
                },
                context,
            )
            .map_err(map_read_error)?;
        if read.bytes.is_empty() || read.bytes.len() > max_bytes as usize {
            return Err(PreviewProviderError::Failed);
        }
        offset = offset
            .checked_add(read.bytes.len() as u64)
            .ok_or(PreviewProviderError::Failed)?;
        bytes.extend_from_slice(&read.bytes);
        if read.complete {
            return Ok(SourceBytes {
                bytes,
                complete: true,
            });
        }
    }
}

fn decode_normalized_image(
    source: &[u8],
    expected_format: RasterFormat,
    context: &PreviewOperationContext,
    decoder_admission: &PreviewDecoderResourceLeaseAdapter,
) -> Result<(image::DynamicImage, Option<ResourceLease>), PreviewProviderError> {
    let reader = ImageReader::new(Cursor::new(source))
        .with_guessed_format()
        .map_err(|_| PreviewProviderError::CorruptSource)?;
    let actual_format = match reader.format() {
        Some(ImageFormat::Png) => RasterFormat::Png,
        Some(ImageFormat::Jpeg) => RasterFormat::Jpeg,
        _ => return Err(PreviewProviderError::Unsupported),
    };
    if actual_format != expected_format {
        return Err(PreviewProviderError::CorruptSource);
    }

    let mut decoder = reader
        .into_decoder()
        .map_err(|_| PreviewProviderError::CorruptSource)?;
    let (width, height) = decoder.dimensions();
    let pixels = u64::from(width).saturating_mul(u64::from(height));
    if width == 0
        || height == 0
        || width > MAX_IMAGE_SOURCE_WIDTH
        || height > MAX_IMAGE_SOURCE_HEIGHT
        || pixels > MAX_IMAGE_SOURCE_PIXELS
        || decoder.total_bytes() > MAX_IMAGE_DECODE_BYTES
    {
        return Err(PreviewProviderError::Failed);
    }
    let orientation = decoder
        .orientation()
        .map_err(|_| PreviewProviderError::CorruptSource)?;
    let mut limits = Limits::default();
    limits.max_image_width = Some(MAX_IMAGE_SOURCE_WIDTH);
    limits.max_image_height = Some(MAX_IMAGE_SOURCE_HEIGHT);
    limits.max_alloc = Some(MAX_IMAGE_DECODE_BYTES);
    decoder
        .set_limits(limits)
        .map_err(|_| PreviewProviderError::Failed)?;
    let decoder_lease = decoder_admission
        .try_acquire(
            context.request_id(),
            context.session_id(),
            context.scheduler_cancellation(),
        )
        .map_err(map_decoder_acquire_error)?;
    context.ensure_active().map_err(map_context_error)?;
    let mut image = image::DynamicImage::from_decoder(decoder)
        .map_err(|_| PreviewProviderError::CorruptSource)?;
    image.apply_orientation(orientation);
    context.ensure_active().map_err(map_context_error)?;
    Ok((image, Some(decoder_lease)))
}

fn encode_normalized_image(
    image: image::DynamicImage,
    format: RasterFormat,
) -> Result<NormalizedImage, PreviewProviderError> {
    let (width, height) = image.dimensions();
    let (output_width, output_height) = bounded_output_dimensions(width, height);
    let reduced = output_width != width || output_height != height;
    let image = if reduced {
        image.resize_exact(
            output_width,
            output_height,
            image::imageops::FilterType::Triangle,
        )
    } else {
        image
    };
    let mut writer = LimitedImageWriter::new(MAX_IMAGE_ASSET_BYTES);
    image
        .write_to(&mut writer, format.image_format())
        .map_err(|_| PreviewProviderError::Failed)?;
    Ok(NormalizedImage {
        bytes: writer.into_bytes(),
        reduced,
    })
}

fn bounded_output_dimensions(width: u32, height: u32) -> (u32, u32) {
    let mut scale = 1.0_f64;
    let width_f = f64::from(width);
    let height_f = f64::from(height);
    if width > MAX_IMAGE_OUTPUT_EDGE || height > MAX_IMAGE_OUTPUT_EDGE {
        scale = scale.min(f64::from(MAX_IMAGE_OUTPUT_EDGE) / width_f);
        scale = scale.min(f64::from(MAX_IMAGE_OUTPUT_EDGE) / height_f);
    }
    let pixels = width_f * height_f;
    if pixels > MAX_IMAGE_OUTPUT_PIXELS as f64 {
        scale = scale.min((MAX_IMAGE_OUTPUT_PIXELS as f64 / pixels).sqrt());
    }
    let output_width = ((width_f * scale).floor() as u32).max(1);
    let output_height = ((height_f * scale).floor() as u32).max(1);
    (output_width, output_height)
}

fn map_read_error(error: PreviewReadAccessError) -> PreviewProviderError {
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

fn map_context_error(error: super::preview::PreviewContextError) -> PreviewProviderError {
    match error {
        super::preview::PreviewContextError::Cancelled
        | super::preview::PreviewContextError::StalePublication => PreviewProviderError::Cancelled,
        super::preview::PreviewContextError::TimedOut => PreviewProviderError::Timeout,
    }
}

fn map_decoder_acquire_error(error: AcquireError) -> PreviewProviderError {
    match error {
        AcquireError::Cancelled => PreviewProviderError::Cancelled,
        AcquireError::WouldBlock | AcquireError::QueueFull => PreviewProviderError::Timeout,
        AcquireError::Unavailable
        | AcquireError::PolicyDenied
        | AcquireError::InvalidRequest(_) => PreviewProviderError::Failed,
    }
}

fn map_asset_error(error: super::preview::PreviewAssetError) -> PreviewProviderError {
    match error {
        super::preview::PreviewAssetError::Cancelled => PreviewProviderError::Cancelled,
        super::preview::PreviewAssetError::StalePublication => PreviewProviderError::Cancelled,
        super::preview::PreviewAssetError::InvalidMediaType
        | super::preview::PreviewAssetError::OutputTooLarge
        | super::preview::PreviewAssetError::CapacityExceeded
        | super::preview::PreviewAssetError::Disposed => PreviewProviderError::Failed,
    }
}

struct LimitedImageWriter {
    bytes: Vec<u8>,
    position: u64,
    max_bytes: usize,
}

impl LimitedImageWriter {
    fn new(max_bytes: usize) -> Self {
        Self {
            bytes: Vec::new(),
            position: 0,
            max_bytes,
        }
    }

    fn into_bytes(self) -> Vec<u8> {
        self.bytes
    }
}

impl Write for LimitedImageWriter {
    fn write(&mut self, buffer: &[u8]) -> io::Result<usize> {
        let start = usize::try_from(self.position)
            .map_err(|_| io::Error::other("image output position overflow"))?;
        let end = start
            .checked_add(buffer.len())
            .ok_or_else(|| io::Error::other("image output size overflow"))?;
        if end > self.max_bytes {
            return Err(io::Error::other("image output exceeds bound"));
        }
        if start > self.bytes.len() {
            self.bytes.resize(start, 0);
        }
        if end > self.bytes.len() {
            self.bytes.resize(end, 0);
        }
        self.bytes[start..end].copy_from_slice(buffer);
        self.position = end as u64;
        Ok(buffer.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

impl Seek for LimitedImageWriter {
    fn seek(&mut self, position: SeekFrom) -> io::Result<u64> {
        let current = self.position as i128;
        let max = self.max_bytes as i128;
        let next = match position {
            SeekFrom::Start(value) => i128::from(value),
            SeekFrom::Current(value) => current + i128::from(value),
            SeekFrom::End(value) => self.bytes.len() as i128 + i128::from(value),
        };
        if next < 0 || next > max {
            return Err(io::Error::other("image output seek exceeds bound"));
        }
        self.position = next as u64;
        Ok(self.position)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{DynamicImage, ImageBuffer, Rgba};

    fn encoded(format: RasterFormat, width: u32, height: u32) -> Vec<u8> {
        let image = DynamicImage::ImageRgba8(ImageBuffer::from_fn(width, height, |x, y| {
            Rgba([x as u8, y as u8, 17, 255])
        }));
        let mut writer = LimitedImageWriter::new(MAX_IMAGE_SOURCE_BYTES);
        image
            .write_to(&mut writer, format.image_format())
            .expect("fixture image");
        writer.into_bytes()
    }

    #[test]
    fn image_hints_require_consistent_png_or_jpeg_metadata() {
        assert_eq!(
            hinted_format(Some("png"), Some("image/png")),
            Some(RasterFormat::Png)
        );
        assert_eq!(
            hinted_format(Some("JPG"), Some("image/jpeg")),
            Some(RasterFormat::Jpeg)
        );
        assert_eq!(hinted_format(Some("png"), Some("image/jpeg")), None);
        assert_eq!(hinted_format(Some("txt"), Some("image/png")), None);
        assert_eq!(hinted_format(Some("svg"), Some("image/svg+xml")), None);
    }

    #[test]
    fn output_dimensions_are_bounded_and_preserve_aspect_ratio() {
        assert_eq!(bounded_output_dimensions(100, 200), (100, 200));
        let (width, height) = bounded_output_dimensions(8192, 4096);
        assert!(width <= MAX_IMAGE_OUTPUT_EDGE);
        assert!(height <= MAX_IMAGE_OUTPUT_EDGE);
        assert!(u64::from(width) * u64::from(height) <= MAX_IMAGE_OUTPUT_PIXELS);
        assert_eq!(width * 4096, height * 8192);
    }

    #[test]
    fn decoder_rejects_truncated_and_mismatched_rasters_without_publishing() {
        let png = encoded(RasterFormat::Png, 2, 2);
        let context = test_context();
        let decoder_admission = PreviewDecoderResourceLeaseAdapter::global();
        assert!(decode_normalized_image(
            &png[..png.len() / 2],
            RasterFormat::Png,
            &context,
            &decoder_admission,
        )
        .is_err());
        assert!(matches!(
            decode_normalized_image(&png, RasterFormat::Jpeg, &context, &decoder_admission),
            Err(PreviewProviderError::CorruptSource)
        ));
    }

    #[test]
    fn decoder_accepts_png_alpha_and_jpeg_and_normalizes_them() {
        let context = test_context();
        let decoder_admission = PreviewDecoderResourceLeaseAdapter::global();
        for format in [RasterFormat::Png, RasterFormat::Jpeg] {
            let bytes = encoded(format, 3, 2);
            let (decoded, lease) =
                decode_normalized_image(&bytes, format, &context, &decoder_admission)
                    .expect("valid bounded image decodes");
            assert_eq!(decoded.dimensions(), (3, 2));
            drop(lease);
            let normalized =
                encode_normalized_image(decoded, format).expect("valid bounded image normalizes");
            assert!(!normalized.bytes.is_empty());
            let sniffed = ImageReader::new(Cursor::new(normalized.bytes))
                .with_guessed_format()
                .expect("normalized image format");
            assert_eq!(sniffed.format(), Some(format.image_format()));
        }
    }

    #[test]
    fn dimension_header_limits_reject_bombs_before_full_decode() {
        let context = test_context();
        let decoder_admission = PreviewDecoderResourceLeaseAdapter::global();
        for (width, height) in [
            (MAX_IMAGE_SOURCE_WIDTH + 1, 1),
            (MAX_IMAGE_SOURCE_WIDTH, MAX_IMAGE_SOURCE_HEIGHT),
        ] {
            let bomb = png_header(width, height);
            assert!(matches!(
                decode_normalized_image(&bomb, RasterFormat::Png, &context, &decoder_admission,),
                Err(PreviewProviderError::Failed)
            ));
        }
    }

    #[test]
    fn source_and_decode_bounds_are_frozen() {
        assert_eq!(MAX_IMAGE_SOURCE_BYTES, 12 * 1024 * 1024);
        assert_eq!(IMAGE_READ_CHUNK_BYTES, 1024 * 1024);
        assert_eq!(MAX_IMAGE_SOURCE_WIDTH, 8192);
        assert_eq!(MAX_IMAGE_SOURCE_HEIGHT, 8192);
        assert_eq!(MAX_IMAGE_SOURCE_PIXELS, 24_000_000);
        assert_eq!(MAX_IMAGE_OUTPUT_EDGE, 4096);
        assert_eq!(MAX_IMAGE_OUTPUT_PIXELS, 12_000_000);
        assert_eq!(MAX_IMAGE_ASSET_BYTES, 12 * 1024 * 1024);
    }

    fn png_header(width: u32, height: u32) -> Vec<u8> {
        let mut bytes = encoded(RasterFormat::Png, 2, 2);
        bytes[16..20].copy_from_slice(&width.to_be_bytes());
        bytes[20..24].copy_from_slice(&height.to_be_bytes());
        let checksum = png_crc32(&bytes[12..29]);
        bytes[29..33].copy_from_slice(&checksum.to_be_bytes());
        bytes
    }

    fn png_crc32(bytes: &[u8]) -> u32 {
        let mut crc = 0xffff_ffff_u32;
        for byte in bytes {
            crc ^= u32::from(*byte);
            for _ in 0..8 {
                let mask = 0_u32.wrapping_sub(crc & 1);
                crc = (crc >> 1) ^ (0xedb8_8320_u32 & mask);
            }
        }
        !crc
    }

    fn test_context() -> PreviewOperationContext {
        PreviewOperationContext::for_backend_content_read(
            "image-test-session",
            "image-test-request",
            "image-test-version",
            Default::default(),
            std::time::Instant::now() + std::time::Duration::from_secs(5),
        )
    }
}
