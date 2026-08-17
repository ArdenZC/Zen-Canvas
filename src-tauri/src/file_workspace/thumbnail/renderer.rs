//! Renderer/provider contracts and the macOS Quick Look adapter boundary.

#[cfg(target_os = "macos")]
use super::cache::is_safe_regular_file;
#[cfg(target_os = "macos")]
use super::types::{DEFAULT_MAX_OUTPUT_BYTES, DEFAULT_MAX_SOURCE_BYTES};
use super::{
    read::ThumbnailRenderContext,
    types::{
        ThumbnailRenderOutput, ThumbnailRenderRequest, ThumbnailRendererDescriptor,
        ThumbnailRendererError,
    },
};
use crate::scheduler::ResourceHints;
#[cfg(target_os = "macos")]
use std::{fs, time::Instant};

/// Renderer/provider adapter contract. Any byte-consuming implementation
/// must use the bounded context backed by W1-07.
pub trait ThumbnailRenderer: Send + Sync {
    fn descriptor(&self) -> ThumbnailRendererDescriptor;

    fn render(
        &self,
        request: ThumbnailRenderRequest,
        context: &ThumbnailRenderContext,
    ) -> Result<ThumbnailRenderOutput, ThumbnailRendererError>;
}

/// Existing Mac Quick Look adapter, fed only by bytes read through W1-07.
#[derive(Clone)]
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub struct MacQuickLookThumbnailRenderer {
    service: crate::platform::macos::quick_look::MacThumbnailService,
}

impl MacQuickLookThumbnailRenderer {
    pub fn new(service: crate::platform::macos::quick_look::MacThumbnailService) -> Self {
        Self { service }
    }
}

impl ThumbnailRenderer for MacQuickLookThumbnailRenderer {
    fn descriptor(&self) -> ThumbnailRendererDescriptor {
        ThumbnailRendererDescriptor::new(
            "macos.quick-look",
            "w1-08-quick-look-v1",
            ResourceHints {
                cpu: 1,
                io: 1,
                open_handles: 1,
                decoder: 1,
                native_preview: 1,
                provider_network: 0,
            },
        )
    }

    fn render(
        &self,
        request: ThumbnailRenderRequest,
        context: &ThumbnailRenderContext,
    ) -> Result<ThumbnailRenderOutput, ThumbnailRendererError> {
        #[cfg(not(target_os = "macos"))]
        {
            let _ = (request, context);
            Err(ThumbnailRendererError::UnsupportedRenderer)
        }

        #[cfg(target_os = "macos")]
        {
            context.ensure_active()?;
            let bytes = context.read_all_bounded(DEFAULT_MAX_SOURCE_BYTES)?;
            let source_name = context
                .source_file_name()
                .unwrap_or("source.bin")
                .to_string();
            let job = self
                .service
                .request_gated_bytes(
                    &source_name,
                    &bytes,
                    request.variant.pixels(),
                    &request.request_id,
                    &request.cache_key,
                    || context.is_explicitly_cancelled(),
                    Instant::now() + context.remaining(),
                )
                .map_err(map_quick_look_error)?;
            let output = job
                .join_until(
                    || context.is_explicitly_cancelled(),
                    Instant::now() + context.remaining(),
                )
                .map_err(map_quick_look_error)?;
            context.ensure_active()?;
            let metadata =
                fs::symlink_metadata(&output).map_err(|_| ThumbnailRendererError::Failed)?;
            if !is_safe_regular_file(&metadata) || metadata.len() > DEFAULT_MAX_OUTPUT_BYTES {
                return Err(ThumbnailRendererError::Failed);
            }
            let bytes = fs::read(output).map_err(|_| ThumbnailRendererError::Failed)?;
            Ok(ThumbnailRenderOutput { bytes })
        }
    }
}

#[cfg(target_os = "macos")]
fn map_quick_look_error(error: String) -> ThumbnailRendererError {
    if error.contains("cancelled") {
        ThumbnailRendererError::Cancelled
    } else if error.contains("timeout") {
        ThumbnailRendererError::Timeout
    } else if error.contains("identity_changed") {
        ThumbnailRendererError::IdentityChanged
    } else if error.contains("unavailable") {
        ThumbnailRendererError::UnsupportedRenderer
    } else {
        ThumbnailRendererError::Failed
    }
}
