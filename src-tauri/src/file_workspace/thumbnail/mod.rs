//! W1-08 bounded, headless thumbnail infrastructure.
//!
//! The stable surface is intentionally small.  Service lifecycle, cache
//! storage, W1-07 read adaptation, renderer contracts, and bounded dispatch
//! live behind separate responsibility boundaries.

mod cache;
mod dispatch;
mod read;
mod renderer;
mod service;
mod types;

#[cfg(test)]
mod tests;

pub use read::{ThumbnailReadGate, ThumbnailReadOperation, ThumbnailRenderContext};
pub use renderer::{MacQuickLookThumbnailRenderer, ThumbnailRenderer};
pub use service::{ThumbnailService, ThumbnailTask};
pub use types::{
    ThumbnailArtifact, ThumbnailConfigError, ThumbnailError, ThumbnailRenderOutput,
    ThumbnailRenderRequest, ThumbnailRendererDescriptor, ThumbnailRendererError, ThumbnailRequest,
    ThumbnailServiceConfig, ThumbnailVariant,
};

pub(super) fn lock<T>(value: &std::sync::Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    value
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}
