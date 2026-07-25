pub mod commands;
pub mod coordinator;
pub mod hardened_worker;
pub mod managed_scope;
pub mod managed_worker;
pub mod models;
mod repository;
pub mod search;

#[cfg(target_os = "macos")]
pub mod macos;
#[cfg(target_os = "windows")]
pub mod windows;

pub use commands::*;
pub use coordinator::{GlobalIndexCoordinator, GlobalIndexProvider, GlobalIndexSink};
pub use hardened_worker::ManagedAiWorker;
pub use models::*;
pub use search::search_global_entries;

#[cfg(test)]
mod tests;
