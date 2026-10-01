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
