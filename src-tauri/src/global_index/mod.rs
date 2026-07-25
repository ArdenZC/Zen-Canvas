pub mod commands;
pub mod coordinator;
mod legacy_queue;
pub mod managed_scope;
#[path = "managed_worker_hardened.rs"]
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
pub use managed_worker::ManagedAiWorker;
pub use models::*;
pub use search::search_global_entries;

#[cfg(test)]
mod tests;
