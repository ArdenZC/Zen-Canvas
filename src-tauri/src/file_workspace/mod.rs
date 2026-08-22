//! Shared File Library 2.0 / Preview Platform foundation contracts.
//!
//! W1-01 intentionally contains data contracts only. Runtime behavior belongs
//! to later W1 tracks so this module cannot become a second query, watcher,
//! content-read, or mutation authority.

pub(crate) mod change;
pub mod contracts;
pub mod integration;
pub mod location;
pub mod preview;
pub(crate) mod preview_asset;
pub(crate) mod preview_policy;
pub(crate) mod preview_publication;
pub mod read_gate;
pub mod thumbnail;

pub(crate) mod browse;

pub use contracts::*;
pub use location::*;
pub use preview::*;
pub use read_gate::*;
pub use thumbnail::*;
