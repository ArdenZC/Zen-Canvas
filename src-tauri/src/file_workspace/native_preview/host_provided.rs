//! Compatibility facade for the shared native host request lifecycle.
//!
//! W4-01 established this module path for the main app. The implementation now
//! lives in `zen-canvas-native-host` so the Windows Preview Handler DLL can use
//! the same registry and bounded-read contract without linking the Tauri app.

#[allow(unused_imports)]
pub(crate) use zen_canvas_native_host::{
    BoundedContentRead, HostProvidedConfig, HostProvidedError, HostProvidedHandle,
    HostProvidedHost, HostProvidedReadContext, HostProvidedReadRequest, HostProvidedReadSource,
    HostProvidedRegistration, HostProvidedRegistry, HostProvidedSourceError,
};

// The W4-01 lifecycle tests historically imported PreviewHostKind from this
// module. Keep that test-facing spelling while the shared crate owns the
// native host value accepted by the registry.
#[allow(dead_code)]
pub(crate) type PreviewHostKind = HostProvidedHost;

#[cfg(test)]
#[path = "tests/host_provided_lifecycle.rs"]
mod host_provided_lifecycle_tests;
