use super::*;

#[test]
fn review_suppression_consumes_exact_cause_and_never_refreshes_decisions() {
    for status in ["draft", "building", "ready", "executing"] {
        let f = Fixture::new();
        let db = f.db();
        let i = intent(&f, schedule("UTC", "09:00", &[1, 2, 3, 4, 5, 6, 7]));
        let manual = db
            .run_automation_intent_manual(request(&i, "manual"))
            .unwrap();
        let plan = manual.result_plan_id.unwrap();
        db.conn()
            .unwrap()
            .execute(
                "UPDATE organization_plans SET status=?2 WHERE id=?1",
                params![plan, status],
            )
            .unwrap();
        let now = timestamp("2026-10-01T12:00:00Z");
        force_due(db, &i.id, now - 10800);
        let cause = db.select_automation_trigger(now).unwrap().0.unwrap();
        let run = deliver(db, &cause, now);
        assert_eq!(run.status, "blocked");
        assert_eq!(run.error_code.as_deref(), Some("automation_review_pending"));
        assert_eq!(run.result_plan_id.as_deref(), Some(plan.as_str()));
        assert_eq!(db.list_organization_plans().unwrap().len(), 1);
        assert_eq!(db.get_organization_plan(&plan).unwrap().status, status);
        db.conn()
            .unwrap()
            .execute(
                "UPDATE organization_plans SET status='completed' WHERE id=?1",
                [&plan],
            )
            .unwrap();
        assert!(db.select_automation_trigger(now).unwrap().0.is_none());
        let later = db
            .select_automation_trigger(now + 86400)
            .unwrap()
            .0
            .unwrap();
        let run = deliver(db, &later, now + 86400);
        assert_ne!(run.result_plan_id.as_deref(), Some(plan.as_str()));
        assert_eq!(db.list_organization_plans().unwrap().len(), 2);
        let count: i64 = db
            .conn()
            .unwrap()
            .query_row("SELECT COUNT(*) FROM operation_batches", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }
}

#[test]
fn automatic_current_and_stale_semantics_reuse_shared_admission_without_mutation() {
    for stale in [false, true] {
        let f = Fixture::new();
        f.file();
        crate::db::queries::organization::tests::seed_current_managed_semantics_for_file(
            f.db(),
            "file",
        );
        if stale {
            f.db().conn().unwrap().execute("UPDATE ai_analysis_state SET status='stale' WHERE global_entry_id='organization-test-global-file'",[]).unwrap();
        }
        let i = intent(&f, schedule("UTC", "09:00", &[1, 2, 3, 4, 5, 6, 7]));
        let now = timestamp("2026-10-01T10:00:00Z");
        force_due(f.db(), &i.id, now - 7200);
        let cause = f.db().select_automation_trigger(now).unwrap().0.unwrap();
        let run = deliver(f.db(), &cause, now);
        assert_eq!(run.status, if stale { "blocked" } else { "completed" });
        assert_eq!(run.queued_analysis_count, 0);
        assert_eq!(run.requires_plan_refresh, stale);
        assert_eq!(run.analysis_blocker_code.is_some(), stale);
        assert!(run.result_plan_id.is_some());
        assert_eq!(
            f.db()
                .conn()
                .unwrap()
                .query_row("SELECT COUNT(*) FROM operation_batches", [], |r| r
                    .get::<_, i64>(0))
                .unwrap(),
            0
        );
    }
}

#[test]
fn automatic_fresh_analysis_uses_existing_queue_and_retry_cannot_enqueue_twice() {
    let f = Fixture::new();
    f.file();
    let db = f.db();
    crate::db::queries::organization::tests::seed_current_managed_semantics_for_file(db, "file");
    let settings = crate::ai::settings::AISettings {
        enabled: true,
        provider: crate::ai::schema::AIProviderKind::Ollama,
        preset: crate::ai::schema::AIProviderPresetId::Ollama,
        base_url: "http://127.0.0.1:11434".into(),
        model: "llama3.2".into(),
        ..Default::default()
    };
    let conn = db.conn().unwrap();
    conn.execute(
        "UPDATE app_settings SET value=?2 WHERE key=?1",
        params![
            crate::ai::settings::AI_SETTINGS_KEY,
            serde_json::to_string(&settings).unwrap()
        ],
    )
    .unwrap();
    conn.execute(
        "UPDATE managed_scopes SET allow_local_ai=1,allow_cloud_ai=0",
        [],
    )
    .unwrap();
    conn.execute_batch(
        "DELETE FROM ai_analysis_state; DELETE FROM ai_job_items; DELETE FROM ai_jobs;",
    )
    .unwrap();
    drop(conn);
    let i = intent(&f, schedule("UTC", "09:00", &[1, 2, 3, 4, 5, 6, 7]));
    let now = timestamp("2026-10-01T10:00:00Z");
    force_due(db, &i.id, now - 7200);
    {
        let mut conn = db.conn().unwrap();
        let tx = conn.transaction().unwrap();
        crate::db::queries::library::bump_library_query_revision_in_transaction(&tx).unwrap();
        tx.commit().unwrap();
    }
    let snapshot =
        crate::db::queries::library::current_library_revision(&db.conn().unwrap()).unwrap();
    let cause = db.select_automation_trigger(now).unwrap().0.unwrap();
    let run = db.run_automation_intent_automatic(&cause).unwrap();
    assert_eq!(run.trigger_kind, "schedule");
    assert_eq!(run.status, "completed");
    assert_eq!(run.queued_analysis_count, 1);
    assert!(run.requires_plan_refresh);
    assert!(run.analysis_blocker_code.is_none());
    assert_eq!(run.library_snapshot_revision, Some(snapshot));
    assert_eq!(
        db.run_automation_intent_automatic(&cause).unwrap().id,
        run.id
    );
    let conn = db.conn().unwrap();
    assert_eq!(
        conn.query_row(
            "SELECT COUNT(*) FROM ai_jobs WHERE status='pending'",
            [],
            |r| r.get::<_, i64>(0)
        )
        .unwrap(),
        1
    );
    conn.execute("UPDATE automation_runs SET status='blocked',queued_analysis_count=0,analysis_blocker_code='automation_analysis_admission_unconfirmed' WHERE id=?1",[&run.id]).unwrap();
    drop(conn);
    assert_eq!(
        db.run_automation_intent_automatic(&cause)
            .unwrap()
            .analysis_blocker_code
            .as_deref(),
        Some("automation_analysis_admission_unconfirmed")
    );
    assert_eq!(
        db.conn()
            .unwrap()
            .query_row(
                "SELECT COUNT(*) FROM ai_jobs WHERE status='pending'",
                [],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
        1
    );
    db.finish_automation_trigger(&cause, now).unwrap();
    assert_eq!(
        db.conn()
            .unwrap()
            .query_row("SELECT COUNT(*) FROM operation_batches", [], |r| r
                .get::<_, i64>(0))
            .unwrap(),
        0
    );
}
