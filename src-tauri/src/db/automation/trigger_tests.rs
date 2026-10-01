use super::{
    calendar::*,
    tests::{draft, request, Fixture},
    trigger_state::*,
    *,
};
use crate::db::Database;
use rusqlite::params;
use serde_json::json;

fn trigger(value: serde_json::Value) -> AutomationTriggerV2 {
    serde_json::from_value(value).unwrap()
}
fn schedule(zone: &str, time: &str, days: &[i8]) -> AutomationTriggerV2 {
    trigger(json!({"version":2,"kind":"schedule","timeZone":zone,"localTime":time,"weekdays":days}))
}
fn timestamp(text: &str) -> i64 {
    text.parse::<jiff::Timestamp>().unwrap().as_second()
}
fn intent(f: &Fixture, t: AutomationTriggerV2) -> AutomationIntentV1 {
    let mut d = draft();
    d.trigger = t;
    f.db().create_automation_intent(d).unwrap()
}
fn force_due(db: &Database, id: &str, at: i64) {
    db.conn()
        .unwrap()
        .execute(
            "UPDATE automation_trigger_state SET next_due_at=?2 WHERE intent_id=?1",
            params![id, at],
        )
        .unwrap();
}
fn deliver(db: &Database, cause: &TriggerCause, now: i64) -> AutomationRunV1 {
    let run = db.run_automation_intent_automatic(cause).unwrap();
    db.finish_automation_trigger(cause, now).unwrap();
    run
}
fn revise_root(db: &Database, id: &str, revision: i64) {
    db.conn()
        .unwrap()
        .execute(
            "UPDATE scan_roots SET library_change_revision=?2 WHERE id=?1",
            params![id, revision],
        )
        .unwrap();
}

mod calendar;
mod migration;
mod publication;
mod recovery;
mod runtime;
mod service;
