//! Manual, review-only Automation. No runtime, queue or filesystem executor.
mod commands;
mod repository;
mod service;
mod types;
pub use commands::*;
pub use types::*;
#[cfg(test)]
mod tests;
