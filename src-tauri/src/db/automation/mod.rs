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

pub(crate) fn apply_watcher_root_transitions(
    conn: &rusqlite::Connection,
    transitions: &[(String, Option<i64>)],
    now: i64,
) -> Result<(), crate::db::DbError> {
    trigger_state::apply_watcher_root_transitions(conn, transitions, now)
}
#[cfg(test)]
mod tests;

#[cfg(test)]
mod trigger_tests;
