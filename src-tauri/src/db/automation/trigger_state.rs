//! Durable recovery cursors and exact causes. This is not a job queue.
use super::{
    calendar::{newest_due, next_occurrence},
    repository::{invalid, load_intent},
    types::*,
};
use crate::db::{queries::library::resolve_scope, Database, DbError};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

type Revisions = BTreeMap<String, i64>;
pub(super) const SETTLE_SECONDS: i64 = 5;
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct TriggerCause {
    pub intent_id: String,
    pub intent_revision: i64,
    pub kind: String,
    pub request_key: String,
    pub context: serde_json::Value,
    pub next_due_at: Option<i64>,
    pub root_revisions: Revisions,
}
struct State {
    next: Option<i64>,
    due: Option<i64>,
    pending: Revisions,
    consumed: Revisions,
    claim: Option<TriggerCause>,
}
fn state(conn: &Connection, id: &str) -> Result<State, DbError> {
    let (next,due,pending,consumed,claim):(Option<i64>,Option<i64>,String,String,Option<String>)=conn.query_row(
        "SELECT next_due_at,pending_event_due_at,pending_root_revisions_json,consumed_root_revisions_json,claimed_cause_json FROM automation_trigger_state WHERE intent_id=?1",[id],
        |r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?)))?;
    Ok(State {
        next,
        due,
        pending: serde_json::from_str(&pending)?,
        consumed: serde_json::from_str(&consumed)?,
        claim: claim.map(|s| serde_json::from_str(&s)).transpose()?,
    })
}
fn roots(conn: &Connection, intent: &AutomationIntentV1) -> Result<(Revisions, bool), DbError> {
    let scope = resolve_scope(conn, &intent.scope_query.scope)?;
    if scope.health.roots.len() > 128 {
        return Err(invalid("automation_trigger_scope_too_large"));
    }
    let mut revisions = Revisions::new();
    for root in &scope.health.roots {
        if root.enabled {
            let revision = conn.query_row(
                "SELECT library_change_revision FROM scan_roots WHERE id=?1",
                [&root.id],
                |r| r.get(0),
            )?;
            revisions.insert(root.id.clone(), revision);
        }
    }
    Ok((revisions, scope.health.state == "healthy"))
}
pub(super) fn rebuild(
    conn: &Connection,
    intent: &AutomationIntentV1,
    now: i64,
) -> Result<(), DbError> {
    conn.execute(
        "DELETE FROM automation_trigger_state WHERE intent_id=?1",
        [&intent.id],
    )?;
    if intent.trigger.kind == "manual" || intent.archived_at.is_some() {
        return Ok(());
    }
    let next = if intent.enabled && intent.trigger.kind == "schedule" {
        Some(next_occurrence(&intent.trigger, now)?.instant)
    } else {
        None
    };
    let baseline = if intent.trigger.kind == "managed_scope_change" {
        roots(conn, intent)?.0
    } else {
        Revisions::new()
    };
    conn.execute("INSERT INTO automation_trigger_state(intent_id,intent_revision,next_due_at,consumed_root_revisions_json,updated_at) VALUES(?1,?2,?3,?4,?5)",params![intent.id,intent.revision,next,serde_json::to_string(&baseline)?,now])?;
    Ok(())
}
fn save_event(
    conn: &Connection,
    id: &str,
    s: &State,
    now: i64,
    healthy: bool,
) -> Result<(), DbError> {
    conn.execute("UPDATE automation_trigger_state SET pending_event_due_at=?2,pending_root_revisions_json=?3,consumed_root_revisions_json=?4,last_error_code=?5,updated_at=?6 WHERE intent_id=?1",params![id,s.due,serde_json::to_string(&s.pending)?,serde_json::to_string(&s.consumed)?,if healthy{None}else{Some("automation_scope_unavailable")},now])?;
    Ok(())
}
fn request_key(intent: &AutomationIntentV1, identity: &str) -> String {
    let bytes = serde_json::to_vec(&(intent.id.as_str(), intent.revision, identity))
        .expect("scalar cause identity serializes");
    format!(
        "auto:{}:{}",
        intent.trigger.kind,
        blake3::hash(&bytes).to_hex()
    )
}
impl Database {
    /// Called only on startup, explicit publication/configuration/lifecycle
    /// hints, or a nearest-deadline completion. Never a periodic DB poll.
    pub(super) fn select_automation_trigger(
        &self,
        now: i64,
    ) -> Result<(Option<TriggerCause>, Option<i64>), DbError> {
        let mut conn = self.conn()?;
        let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        let ids = {
            let mut stmt=tx.prepare("SELECT state.intent_id FROM automation_trigger_state state JOIN automation_intents intent ON intent.id=state.intent_id AND intent.revision=state.intent_revision WHERE intent.enabled=1 AND intent.archived_at IS NULL ORDER BY state.intent_id")?;
            let rows = stmt
                .query_map([], |r| r.get::<_, String>(0))?
                .collect::<Result<Vec<_>, _>>()?;
            rows
        };
        let mut nearest: Option<i64> = None;
        let mut selected = None;
        for id in ids {
            let intent = load_intent(&tx, &id)?;
            let mut s = state(&tx, &id)?;
            let mut healthy = true;
            if intent.trigger.kind == "managed_scope_change" {
                let (observed, current) = roots(&tx, &intent)?;
                healthy = current;
                s.consumed.retain(|id, _| observed.contains_key(id));
                s.pending.retain(|id, _| observed.contains_key(id));
                for (root, revision) in observed {
                    match s.consumed.get(&root).copied() {
                        None => {
                            s.consumed.insert(root, revision);
                        }
                        Some(consumed)
                            if revision > consumed
                                && revision > s.pending.get(&root).copied().unwrap_or(consumed) =>
                        {
                            s.pending.insert(root, revision);
                            s.due = Some(now.saturating_add(SETTLE_SECONDS));
                        }
                        _ => {}
                    }
                }
                if s.pending.is_empty() {
                    s.due = None;
                }
                save_event(&tx, &id, &s, now, healthy)?;
            }
            if !healthy {
                continue;
            }
            if let Some(claim) = s.claim {
                if selected.is_none() {
                    selected = Some(claim);
                }
                continue;
            }
            let due = if intent.trigger.kind == "schedule" {
                s.next
            } else {
                s.due
            };
            if let Some(due) = due {
                if due > now {
                    nearest = Some(nearest.map_or(due, |n| n.min(due)));
                    continue;
                }
                if selected.is_some() {
                    continue;
                }
                let (identity, context, next, root_revisions) = if intent.trigger.kind == "schedule"
                {
                    let latest = newest_due(&intent.trigger, now, due)?;
                    let next = next_occurrence(&intent.trigger, now)?.instant;
                    (
                        latest.logical_local.clone(),
                        serde_json::json!({"version":1,"kind":"schedule","scheduledFor":latest.instant,"timeZone":intent.trigger.time_zone,"localOccurrence":latest.logical_local}),
                        Some(next),
                        Revisions::new(),
                    )
                } else {
                    let context_roots:Vec<_>=s.pending.iter().map(|(root,to)|serde_json::json!({"rootId":root,"fromRevision":s.consumed.get(root).copied().unwrap_or(0),"toRevision":to})).collect();
                    (
                        serde_json::to_string(&s.pending)?,
                        serde_json::json!({"version":1,"kind":"managed_scope_change","roots":context_roots}),
                        None,
                        s.pending,
                    )
                };
                let cause = TriggerCause {
                    intent_id: id.clone(),
                    intent_revision: intent.revision,
                    kind: intent.trigger.kind.clone(),
                    request_key: request_key(&intent, &identity),
                    context,
                    next_due_at: next,
                    root_revisions,
                };
                // Freeze the selected occurrence/cause before admission. A crash
                // cannot change identity as time or root revisions advance.
                tx.execute("UPDATE automation_trigger_state SET claimed_cause_json=?2,updated_at=?3 WHERE intent_id=?1",params![id,serde_json::to_string(&cause)?,now])?;
                selected = Some(cause);
            }
        }
        tx.commit()?;
        Ok((selected, nearest))
    }
    pub(super) fn validate_automation_cause(
        conn: &Connection,
        cause: &TriggerCause,
    ) -> Result<(), DbError> {
        let intent = load_intent(conn, &cause.intent_id)?;
        if !intent.enabled
            || intent.archived_at.is_some()
            || intent.revision != cause.intent_revision
            || intent.trigger.kind != cause.kind
        {
            return Err(invalid("automation_trigger_obsolete"));
        }
        let claim:Option<String>=conn.query_row("SELECT claimed_cause_json FROM automation_trigger_state WHERE intent_id=?1 AND intent_revision=?2",params![cause.intent_id,cause.intent_revision],|r|r.get(0)).optional()?.flatten();
        let stored: TriggerCause =
            serde_json::from_str(&claim.ok_or_else(|| invalid("automation_trigger_obsolete"))?)?;
        if stored.request_key != cause.request_key {
            return Err(invalid("automation_trigger_obsolete"));
        }
        if cause.kind == "managed_scope_change" && !roots(conn, &intent)?.1 {
            return Err(invalid("automation_scope_unavailable"));
        }
        Ok(())
    }
    pub(super) fn finish_automation_trigger(
        &self,
        cause: &TriggerCause,
        now: i64,
    ) -> Result<(), DbError> {
        let mut conn = self.conn()?;
        let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        if Self::validate_automation_cause(&tx, cause).is_err() {
            return Ok(());
        }
        let receipt:bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM automation_runs WHERE request_key=?1 AND intent_id=?2 AND intent_revision=?3)",params![cause.request_key,cause.intent_id,cause.intent_revision],|r|r.get(0))?;
        if !receipt {
            return Err(invalid("automation_trigger_receipt_missing"));
        }
        let mut s = state(&tx, &cause.intent_id)?;
        for (root, revision) in &cause.root_revisions {
            s.consumed.insert(root.clone(), *revision);
            if s.pending.get(root).is_some_and(|r| r <= revision) {
                s.pending.remove(root);
            }
        }
        if s.pending.is_empty() {
            s.due = None;
        }
        tx.execute("UPDATE automation_trigger_state SET next_due_at=?2,pending_event_due_at=?3,pending_root_revisions_json=?4,consumed_root_revisions_json=?5,last_trigger_key=?6,last_triggered_at=?7,last_error_code=NULL,claimed_cause_json=NULL,updated_at=?7 WHERE intent_id=?1 AND intent_revision=?8",params![cause.intent_id,cause.next_due_at,s.due,serde_json::to_string(&s.pending)?,serde_json::to_string(&s.consumed)?,cause.request_key,now,cause.intent_revision])?;
        tx.commit()?;
        Ok(())
    }
    pub(super) fn defer_automation_trigger(&self, cause: &TriggerCause) -> Result<(), DbError> {
        self.conn()?.execute("UPDATE automation_trigger_state SET last_error_code='automation_resource_deferred' WHERE intent_id=?1 AND intent_revision=?2",params![cause.intent_id,cause.intent_revision])?;
        Ok(())
    }
}
