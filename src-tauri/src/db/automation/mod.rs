//! Review-only Automation with one trigger coordinator and existing admission.
mod runtime;
pub use runtime::AutomationTriggerCoordinator;
pub(crate) use runtime::AutomationWake;
mod calendar;
mod commands;
mod repository;
mod service;
mod trigger_state;
mod types;
pub use commands::*;
pub use types::*;
#[cfg(test)]
mod tests;

#[cfg(test)]
mod trigger_tests;
