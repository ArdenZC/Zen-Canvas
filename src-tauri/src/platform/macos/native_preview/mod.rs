//! Native macOS Quick Look host for Zen-owned Preview presentations.
//!
//! The host is deliberately separate from the thumbnail adapter. It consumes
//! only a validated W4-01 opaque access token, resolves the private staged URL
//! inside the backend/native bridge, and owns the disposable AppKit view
//! attachment. It does not select providers, resolve source identity, or
//! expose a filesystem path to the renderer.

#[cfg(target_os = "macos")]
mod host;

#[cfg(target_os = "macos")]
pub(crate) use host::MacQuickLookPreviewHost;

#[cfg(not(target_os = "macos"))]
#[derive(Clone, Default)]
pub(crate) struct MacQuickLookPreviewHost;

#[cfg(not(target_os = "macos"))]
impl MacQuickLookPreviewHost {
    pub(crate) fn new() -> Self {
        Self
    }

    pub(crate) fn dispose(&self) -> Result<(), String> {
        Ok(())
    }
}

/// Runtime capability is based on the actual native bridge class, not only
/// on the compilation target. Browser/Windows builds therefore remain
/// honest and return false.
pub fn available() -> bool {
    #[cfg(target_os = "macos")]
    {
        host::available()
    }
    #[cfg(not(target_os = "macos"))]
    {
        false
    }
}

#[cfg(all(target_os = "macos", feature = "native-qa"))]
pub fn run_native_preview_lifecycle_harness() -> Result<(), String> {
    host::run_native_preview_lifecycle_harness()
}
