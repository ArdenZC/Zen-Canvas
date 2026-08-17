//! Bounded W1-10 integration adapters.
//!
//! This module composes the existing W1 services into a process-local Tauri
//! surface.  It is deliberately not a new authority: Browse owns ephemeral
//! refs, the read gate owns byte-read admission, ThumbnailService owns
//! thumbnail work, and PreviewSession owns only disposable lifecycle state.

mod browse;
mod change;
pub mod commands;
mod preview;
mod runtime;
mod thumbnail;
pub mod types;

pub use runtime::FileWorkspaceRuntime;

#[cfg(test)]
mod tests;
