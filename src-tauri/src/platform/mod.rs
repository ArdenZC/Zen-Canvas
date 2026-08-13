//! Platform-native, read-only filesystem semantics.
//!
//! This module is deliberately descriptive. It does not expose a filesystem
//! mutation primitive and callers must keep the existing operation, cleanup,
//! and restore authorities in place.

pub mod macos;
