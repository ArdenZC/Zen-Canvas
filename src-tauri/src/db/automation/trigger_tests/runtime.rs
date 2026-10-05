use super::*;

#[test]
fn coordinator_idle_defer_release_and_shutdown_use_existing_admission() {
    use crate::{
        file_workspace::WorkClass,
        scheduler::{
            PermissiveResourcePolicy, ResourceCapacities, ResourceHints, SchedulerConfig,
            WorkRequest, WorkScheduler,
        },
    };
    use std::{
        sync::{mpsc, Arc},
        time::Duration,
    };
    let f = Fixture::new();
    let scheduler = Arc::new(WorkScheduler::new(
        SchedulerConfig::default()
            .with_capacities(ResourceCapacities::new(1, 1, 8, 1, 1, 1))
            .with_policy(Arc::new(PermissiveResourcePolicy)),
    ));
    scheduler.set_native_policy_notifications_available(true);
    let (tx, rx) = mpsc::channel();
    let coordinator = AutomationTriggerCoordinator::start_with_scheduler(
        f.db().clone(),
        scheduler.clone(),
        Arc::new(move || {
            let _ = tx.send(());
        }),
    )
    .unwrap();
    // No enabled automatic Intent: no scheduler request, receipt or mutation.
    assert!(rx.recv_timeout(Duration::from_millis(100)).is_err());
    assert_eq!(scheduler.snapshot().total_grants, 0);
    assert_eq!(scheduler.snapshot().queued, 0);
    assert!(f.db().list_automation_runs(None).unwrap().is_empty());
    let holder = scheduler
        .try_acquire(WorkRequest::new(
            "foreground-holder",
            WorkClass::Foreground,
            ResourceHints {
                cpu: 1,
                ..ResourceHints::empty()
            },
        ))
        .unwrap();
    let i = intent(&f, schedule("UTC", "09:00", &[1, 2, 3, 4, 5, 6, 7]));
    force_due(
        f.db(),
        &i.id,
        crate::db::queries::current_unix_seconds() - 86400,
    );
    f.db().wake_automation_triggers();
    rx.recv_timeout(Duration::from_secs(3))
        .expect("deferred projection event");
    assert!(f.db().list_automation_runs(None).unwrap().is_empty());
    assert_eq!(
        f.db()
            .get_automation_intent(&i.id)
            .unwrap()
            .trigger_state
            .unwrap()
            .last_error_code
            .as_deref(),
        Some("automation_resource_deferred")
    );
    assert!(rx.recv_timeout(Duration::from_millis(150)).is_err());
    assert_eq!(scheduler.snapshot().total_timed_wait_wakeups, 0);
    assert_eq!(scheduler.snapshot().total_grants, 1);
    let (foreground_tx, foreground_rx) = mpsc::channel();
    let foreground_scheduler = scheduler.clone();
    let foreground = std::thread::spawn(move || {
        let lease = foreground_scheduler
            .acquire(WorkRequest::new(
                "priority-foreground",
                WorkClass::Foreground,
                ResourceHints {
                    cpu: 1,
                    ..ResourceHints::empty()
                },
            ))
            .unwrap();
        foreground_tx.send(lease).unwrap();
    });
    let until = std::time::Instant::now() + Duration::from_secs(3);
    while scheduler.snapshot().queued < 2 {
        assert!(std::time::Instant::now() < until, "both admissions queue");
        std::thread::sleep(Duration::from_millis(1));
    }
    drop(holder);
    let foreground_lease = foreground_rx.recv_timeout(Duration::from_secs(3)).unwrap();
    assert!(rx.recv_timeout(Duration::from_millis(100)).is_err());
    assert!(f.db().list_automation_runs(None).unwrap().is_empty());
    drop(foreground_lease);
    foreground.join().unwrap();
    rx.recv_timeout(Duration::from_secs(3))
        .expect("receipt after foreground release");
    coordinator.shutdown();
    assert_eq!(f.db().list_automation_runs(None).unwrap().len(), 1);
    assert_eq!(scheduler.snapshot().running, 0);
    assert_eq!(scheduler.snapshot().queued, 0);
    assert_eq!(scheduler.snapshot().granted, ResourceHints::empty());
}

#[test]
fn coordinator_shutdown_cancels_deferred_cause_without_consuming_it() {
    use crate::{
        file_workspace::WorkClass,
        scheduler::{
            PermissiveResourcePolicy, ResourceCapacities, ResourceHints, SchedulerConfig,
            WorkRequest, WorkScheduler,
        },
    };
    use std::{
        sync::{mpsc, Arc},
        time::Duration,
    };
    let f = Fixture::new();
    let scheduler = Arc::new(WorkScheduler::new(
        SchedulerConfig::default()
            .with_capacities(ResourceCapacities::new(1, 1, 8, 1, 1, 1))
            .with_policy(Arc::new(PermissiveResourcePolicy)),
    ));
    scheduler.set_native_policy_notifications_available(true);
    let _holder = scheduler
        .try_acquire(WorkRequest::new(
            "holder",
            WorkClass::Foreground,
            ResourceHints {
                cpu: 1,
                ..ResourceHints::empty()
            },
        ))
        .unwrap();
    let i = intent(&f, schedule("UTC", "09:00", &[1, 2, 3, 4, 5, 6, 7]));
    force_due(
        f.db(),
        &i.id,
        crate::db::queries::current_unix_seconds() - 86400,
    );
    let (tx, rx) = mpsc::channel();
    let coordinator = AutomationTriggerCoordinator::start_with_scheduler(
        f.db().clone(),
        scheduler.clone(),
        Arc::new(move || {
            let _ = tx.send(());
        }),
    )
    .unwrap();
    rx.recv_timeout(Duration::from_secs(3)).unwrap();
    let cause = f
        .db()
        .select_automation_trigger(crate::db::queries::current_unix_seconds())
        .unwrap()
        .0
        .unwrap();
    coordinator.shutdown();
    assert_eq!(scheduler.snapshot().queued, 0);
    assert!(f.db().list_automation_runs(None).unwrap().is_empty());
    assert_eq!(
        f.db()
            .select_automation_trigger(crate::db::queries::current_unix_seconds())
            .unwrap()
            .0
            .unwrap()
            .request_key,
        cause.request_key
    );
}
