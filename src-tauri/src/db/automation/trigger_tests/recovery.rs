use super::*;

#[test]
fn schedule_catchup_is_latest_once_and_crash_claim_is_stable() {
    let f = Fixture::new();
    let db = f.db();
    let i = intent(&f, schedule("UTC", "09:00", &[1, 2, 3, 4, 5, 6, 7]));
    let first = timestamp("2020-01-01T09:00:00Z");
    force_due(db, &i.id, first);
    assert!(db.select_automation_trigger(first - 1).unwrap().0.is_none());
    let now = timestamp("2026-10-01T12:00:00Z");
    let cause = db.select_automation_trigger(now).unwrap().0.unwrap();
    assert_eq!(cause.context["localOccurrence"], "2026-10-01T09:00");
    let first_run = db.run_automation_intent_automatic(&cause).unwrap();
    // Restart after Run/Plan commit but before cursor advancement: even on a
    // later day, recover the exact selected logical occurrence and receipt.
    let reopened = Database::open(db.path()).unwrap();
    let recovered = reopened
        .select_automation_trigger(now + 86400)
        .unwrap()
        .0
        .unwrap();
    assert_eq!(recovered.request_key, cause.request_key);
    let retry = deliver(&reopened, &recovered, now + 86400);
    assert_eq!(retry.id, first_run.id);
    assert_eq!(retry.result_plan_id, first_run.result_plan_id);
    assert_eq!(db.list_organization_plans().unwrap().len(), 1);
    assert!(db.select_automation_trigger(now).unwrap().0.is_none());
    assert_eq!(db.list_automation_runs(None).unwrap().len(), 1);
}

#[test]
fn pause_and_edit_discard_backlog_and_manual_works_for_every_trigger() {
    let f = Fixture::new();
    let db = f.db();
    for t in [
        trigger(json!({"version":2,"kind":"manual"})),
        schedule("UTC", "09:00", &[1]),
        trigger(json!({"version":2,"kind":"managed_scope_change"})),
    ] {
        let i = intent(&f, t);
        let run = db.run_automation_intent_manual(request(&i, &i.id)).unwrap();
        assert_eq!(run.trigger_kind, "manual");
        assert_eq!(
            db.get_automation_intent(&i.id).unwrap().trigger.kind,
            i.trigger.kind
        );
        assert!(db
            .run_automation_intent_manual(request(&i, "auto:schedule:spoof"))
            .unwrap_err()
            .to_string()
            .contains("reserved"));
    }
    let i = intent(&f, schedule("UTC", "09:00", &[1]));
    force_due(db, &i.id, 1);
    let paused = db
        .set_automation_intent_enabled(AutomationIntentEnabledV1 {
            intent_id: i.id.clone(),
            expected_revision: i.revision,
            enabled: false,
        })
        .unwrap();
    assert!(paused.trigger_state.as_ref().unwrap().next_due_at.is_none());
    let enabled = db
        .set_automation_intent_enabled(AutomationIntentEnabledV1 {
            intent_id: i.id.clone(),
            expected_revision: paused.revision,
            enabled: true,
        })
        .unwrap();
    assert!(
        enabled.trigger_state.as_ref().unwrap().next_due_at.unwrap()
            > crate::db::current_unix_seconds()
    );
    force_due(db, &i.id, 1);
    let mut d = draft();
    d.trigger = schedule("UTC", "10:00", &[2]);
    let edited = db
        .update_automation_intent(AutomationIntentUpdateV1 {
            intent_id: i.id,
            expected_revision: enabled.revision,
            draft: d,
        })
        .unwrap();
    assert!(
        edited.trigger_state.as_ref().unwrap().next_due_at.unwrap()
            > crate::db::current_unix_seconds()
    );
}

#[test]
fn event_burst_two_roots_coalesces_maxima_and_consumes_without_replay() {
    let f = Fixture::new();
    let db = f.db();
    db.conn().unwrap().execute("INSERT INTO scan_roots(id,normalized_path,display_name,source_kind,enabled,health_status,current_generation,needs_reconciliation,created_at,updated_at) VALUES('root-two','/var/tmp','Two','file_library',1,'healthy',1,0,1,1)",[]).unwrap();
    f.set_watcher_roots(vec![
        watcher_root_setting("root", "/tmp"),
        watcher_root_setting("root-two", "/var/tmp"),
    ]);
    let i = intent(
        &f,
        trigger(json!({"version":2,"kind":"managed_scope_change"})),
    );
    revise_root(db, "root", 1);
    assert!(db.select_automation_trigger(100).unwrap().0.is_none());
    revise_root(db, "root", 3);
    revise_root(db, "root-two", 2);
    assert_eq!(db.select_automation_trigger(103).unwrap().1, Some(108));
    assert!(db.select_automation_trigger(107).unwrap().0.is_none());
    let cause = db.select_automation_trigger(108).unwrap().0.unwrap();
    assert_eq!(cause.root_revisions["root"], 3);
    assert_eq!(cause.root_revisions["root-two"], 2);
    let run = deliver(db, &cause, 108);
    assert_eq!(run.trigger_kind, "managed_scope_change");
    assert!(db.select_automation_trigger(10000).unwrap().0.is_none());
    assert_eq!(db.list_automation_runs(Some(&i.id)).unwrap().len(), 1);
    assert!(!serde_json::to_string(&run.trigger_context)
        .unwrap()
        .contains("/tmp"));
}

#[test]
fn lost_wake_reconciliation_and_new_root_baseline_are_durable() {
    let f = Fixture::new();
    let db = f.db();
    f.set_watcher_roots(vec![watcher_root_setting("settings-root", "/tmp")]);
    let i = intent(
        &f,
        trigger(json!({"version":2,"kind":"managed_scope_change"})),
    );
    revise_root(db, "root", 2);
    db.conn()
        .unwrap()
        .execute(
            "UPDATE scan_roots SET needs_reconciliation=1 WHERE id='root'",
            [],
        )
        .unwrap();
    let reopened = Database::open(db.path()).unwrap();
    assert!(reopened.select_automation_trigger(10).unwrap().0.is_none());
    assert!(reopened.select_automation_trigger(20).unwrap().0.is_none());
    db.conn()
        .unwrap()
        .execute(
            "UPDATE scan_roots SET needs_reconciliation=0 WHERE id='root'",
            [],
        )
        .unwrap();
    let cause = reopened.select_automation_trigger(20).unwrap().0.unwrap();
    deliver(&reopened, &cause, 20);
    db.conn().unwrap().execute("INSERT INTO scan_roots(id,normalized_path,display_name,source_kind,enabled,health_status,current_generation,needs_reconciliation,library_change_revision,created_at,updated_at) VALUES('new','/var/tmp','New','file_library',1,'healthy',1,0,1000,1,1)",[]).unwrap();
    f.set_watcher_roots(vec![
        watcher_root_setting("root", "/tmp"),
        watcher_root_setting("new-settings-id", "/var/tmp"),
    ]);
    assert!(db.select_automation_trigger(30).unwrap().0.is_none());
    let mut d = draft();
    d.trigger = trigger(json!({"version":2,"kind":"managed_scope_change"}));
    d.scope_query["scope"] = json!({"kind":"roots","scanRootIds":["root"]});
    let explicit = db
        .update_automation_intent(AutomationIntentUpdateV1 {
            intent_id: i.id,
            expected_revision: i.revision,
            draft: d,
        })
        .unwrap();
    revise_root(db, "root", 3);
    db.conn()
        .unwrap()
        .execute("UPDATE scan_roots SET enabled=0 WHERE id='root'", [])
        .unwrap();
    assert!(db.select_automation_trigger(40).unwrap().0.is_none());
    assert_eq!(
        db.get_automation_intent(&explicit.id)
            .unwrap()
            .trigger_state
            .unwrap()
            .last_error_code
            .as_deref(),
        Some("automation_event_root_not_watched")
    );
}

#[test]
fn event_scope_rejects_explicit_and_all_enabled_unwatched_roots() {
    let f = Fixture::new();
    let db = f.db();
    db.conn().unwrap().execute("INSERT INTO scan_roots(id,normalized_path,display_name,source_kind,enabled,health_status,current_generation,needs_reconciliation,created_at,updated_at) VALUES('ad-hoc','/var/tmp','Ad hoc','file_library',1,'healthy',1,0,1,1)",[]).unwrap();
    f.persist_watcher_settings(vec![watcher_root_setting("settings-root", "/tmp")]);

    for scope in [
        json!({"kind":"roots","scanRootIds":["ad-hoc"]}),
        json!({"kind":"all_enabled_roots"}),
    ] {
        let mut d = draft();
        d.scope_query["scope"] = scope;
        d.trigger = trigger(json!({"version":2,"kind":"managed_scope_change"}));
        let event = db.create_automation_intent(d).unwrap();
        assert_eq!(
            event
                .trigger_state
                .as_ref()
                .unwrap()
                .last_error_code
                .as_deref(),
            Some("automation_event_root_not_watched")
        );

        revise_root(db, "root", 2);
        revise_root(db, "ad-hoc", 2);
        assert!(db.select_automation_trigger(100).unwrap().0.is_none());
        assert_eq!(
            db.get_automation_intent(&event.id)
                .unwrap()
                .trigger_state
                .unwrap()
                .last_error_code
                .as_deref(),
            Some("automation_event_root_not_watched")
        );
    }

    assert!(db.list_automation_runs(None).unwrap().is_empty());
    assert!(db.list_organization_plans().unwrap().is_empty());
}

#[test]
fn removing_and_readding_settings_root_clears_stale_event_claim_and_baselines_current_revision() {
    let f = Fixture::new();
    let db = f.db();
    f.set_watcher_roots(vec![watcher_root_setting("settings-root", "/tmp")]);
    let mut d = draft();
    d.scope_query["scope"] = json!({"kind":"roots","scanRootIds":["root"]});
    d.trigger = trigger(json!({"version":2,"kind":"managed_scope_change"}));
    let event = db.create_automation_intent(d).unwrap();

    revise_root(db, "root", 2);
    assert!(db.select_automation_trigger(100).unwrap().0.is_none());
    let stale_cause = db.select_automation_trigger(105).unwrap().0.unwrap();
    f.set_watcher_roots(Vec::new());
    assert!(db.run_automation_intent_automatic(&stale_cause).is_err());
    assert!(db.list_automation_runs(None).unwrap().is_empty());
    assert!(db.list_organization_plans().unwrap().is_empty());

    f.set_watcher_roots(vec![watcher_root_setting("readded-settings-id", "/tmp")]);
    let (claimed, pending, consumed): (Option<String>, String, String) = db
        .conn()
        .unwrap()
        .query_row(
            "SELECT claimed_cause_json, pending_root_revisions_json, consumed_root_revisions_json FROM automation_trigger_state WHERE intent_id=?1",
            [&event.id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .expect("read re-enrolled trigger cursors");
    assert!(
        claimed.is_none(),
        "removed-root claims must not survive re-add"
    );
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&pending).unwrap(),
        json!({})
    );
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&consumed).unwrap()["root"],
        2
    );
    let configured = db
        .list_watcher_root_configs()
        .unwrap()
        .into_iter()
        .find(|root| root.path == "/tmp")
        .expect("re-added watcher root");
    assert_eq!(
        configured.id, "root",
        "normalized path must reuse its durable id"
    );
    assert!(db.select_automation_trigger(200).unwrap().0.is_none());
    assert_eq!(
        db.get_automation_intent(&event.id)
            .unwrap()
            .trigger_state
            .unwrap()
            .last_error_code,
        None
    );

    revise_root(db, "root", 3);
    assert!(db.select_automation_trigger(201).unwrap().0.is_none());
    let fresh_cause = db.select_automation_trigger(206).unwrap().0.unwrap();
    assert_eq!(fresh_cause.root_revisions.get("root"), Some(&3));
    let run = deliver(db, &fresh_cause, 206);
    assert_eq!(run.trigger_kind, "managed_scope_change");
    assert_eq!(db.list_automation_runs(None).unwrap().len(), 1);
    assert_eq!(db.list_organization_plans().unwrap().len(), 1);
}

#[test]
fn event_claim_survives_newer_root_revision_without_consuming_new_cause() {
    let f = Fixture::new();
    f.set_watcher_roots(vec![watcher_root_setting("settings-root", "/tmp")]);
    intent(
        &f,
        trigger(json!({"version":2,"kind":"managed_scope_change"})),
    );
    revise_root(f.db(), "root", 1);
    f.db().select_automation_trigger(100).unwrap();
    let cause = f.db().select_automation_trigger(105).unwrap().0.unwrap();
    let run = f.db().run_automation_intent_automatic(&cause).unwrap();
    revise_root(f.db(), "root", 2);
    let retry = f.db().select_automation_trigger(106).unwrap().0.unwrap();
    assert_eq!(retry.request_key, cause.request_key);
    assert_eq!(
        f.db().run_automation_intent_automatic(&retry).unwrap().id,
        run.id
    );
    f.db().finish_automation_trigger(&retry, 106).unwrap();
    let (next, deadline) = f.db().select_automation_trigger(107).unwrap();
    assert!(next.is_none());
    assert_eq!(deadline, Some(111));
    let later = f.db().select_automation_trigger(111).unwrap().0.unwrap();
    assert_ne!(later.request_key, cause.request_key);
    assert_eq!(later.root_revisions.get("root"), Some(&2));
    assert_eq!(
        deliver(f.db(), &later, 111).error_code.as_deref(),
        Some("automation_review_pending")
    );
}

#[test]
fn event_settle_waits_five_complete_seconds_from_subsecond_observation() {
    let f = Fixture::new();
    f.set_watcher_roots(vec![watcher_root_setting("settings-root", "/tmp")]);
    intent(
        &f,
        trigger(json!({"version":2,"kind":"managed_scope_change"})),
    );
    revise_root(f.db(), "root", 1);
    let clock = |ms| jiff::Timestamp::from_millisecond(ms).unwrap();
    let observed = jiff::Timestamp::new(100, 999_999_999).unwrap();
    let (cause, due) = f.db().select_automation_trigger_at(observed).unwrap();
    assert!(cause.is_none());
    assert_eq!(due, Some(106_000));
    assert_eq!(
        f.db().list_automation_intents().unwrap()[0]
            .trigger_state
            .as_ref()
            .unwrap()
            .pending_event_due_at,
        Some(106.0)
    );
    assert!(f
        .db()
        .select_automation_trigger_at(clock(105_999))
        .unwrap()
        .0
        .is_none());
    assert!(f
        .db()
        .select_automation_trigger_at(clock(106_000))
        .unwrap()
        .0
        .is_some());
}
