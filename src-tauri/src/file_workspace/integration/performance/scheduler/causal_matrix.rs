use super::super::{
    fixture::WorkspaceFixture,
    harness::{open_fixture, runtime_for},
    metrics,
};
use crate::{
    db::Database,
    dedupe::DedupeJobManager,
    file_workspace::contracts::WorkClass,
    scanner::{
        cancel_performance_managed_scan, start_performance_managed_scan_roots,
        PerformanceManagedScan, ScanJobManager,
    },
    scheduler::{CancellationToken, ResourceCapacities, ResourceHints, WorkRequest, WorkScheduler},
};
use serde_json::{json, Value};
use std::{
    path::PathBuf,
    sync::{mpsc, Arc},
    thread,
    time::{Duration, Instant},
};

const FIXTURE_ROOTS: usize = 4;
const FIXTURE_ENTRIES: usize = 100_000;
const SAMPLE_COUNT: usize = 20;
const PRESSURE_DEADLINE: Duration = Duration::from_secs(15);

fn p95(values: &[u128]) -> u128 {
    let mut sorted = values.to_vec();
    sorted.sort_unstable();
    sorted[(sorted.len() * 95).div_ceil(100).saturating_sub(1)]
}

fn fixture_shape() -> (usize, usize, usize) {
    let entries_per_root = FIXTURE_ENTRIES.div_ceil(FIXTURE_ROOTS);
    let directories_per_root = (entries_per_root / 10).max(1);
    let files_per_root = entries_per_root.saturating_sub(directories_per_root);
    let total_entries = FIXTURE_ROOTS.saturating_mul(files_per_root + directories_per_root);
    (files_per_root, directories_per_root, total_entries)
}

fn measure_first_pages(
    runtime: &crate::file_workspace::integration::FileWorkspaceRuntime,
    session_id: &str,
    path_ref: &crate::file_workspace::BrowsePathRef,
    prefix: &str,
) -> Vec<u128> {
    (0..SAMPLE_COUNT)
        .map(|index| {
            let started = Instant::now();
            let page = runtime
                .start_enumeration(
                    crate::file_workspace::integration::types::BrowseStartEnumerationRequest {
                        session_id: session_id.to_string(),
                        request_id: format!("{prefix}-{index}"),
                        path_ref: path_ref.clone(),
                        page_size: 128,
                        query: Default::default(),
                    },
                )
                .expect("foreground Browse remains usable under real scan leases");
            assert!(!page.entries.is_empty());
            started.elapsed().as_micros()
        })
        .collect()
}

fn assigned_roots(fixture: &WorkspaceFixture, sessions: usize) -> Vec<Vec<PathBuf>> {
    let mut groups = vec![Vec::new(); sessions];
    for root_index in 0..FIXTURE_ROOTS {
        groups[root_index % sessions].push(fixture.child_path(root_index));
    }
    groups
}

fn scheduler_fields(snapshot: &crate::scheduler::SchedulerSnapshot) -> Value {
    json!({
        "running": snapshot.running,
        "running_background": snapshot.running_background,
        "queued": snapshot.queued,
        "total_grants": snapshot.total_grants,
    })
}

fn progress_snapshot(db: &Database, scans: &[PerformanceManagedScan]) -> (u64, Value) {
    let mut total_scanned = 0_u64;
    let rows = scans
        .iter()
        .flat_map(|scan| scan.run_ids.iter())
        .map(|run_id| match db.get_scan_run_record(run_id) {
            Ok(record) => {
                let files = record.dto.scanned_files.max(0) as u64;
                let directories = record.dto.scanned_directories.max(0) as u64;
                total_scanned = total_scanned
                    .saturating_add(files)
                    .saturating_add(directories);
                json!({
                    "run_id": run_id,
                    "status": record.dto.status,
                    "phase": record.dto.phase,
                    "scanned_files": files,
                    "scanned_directories": directories,
                    "processed_bytes": record.dto.processed_bytes.max(0),
                    "revision": record.dto.revision,
                })
            }
            Err(error) => json!({ "run_id": run_id, "read_error": error.to_string() }),
        })
        .collect::<Vec<_>>();
    (total_scanned, json!(rows))
}

fn wait_for_pressure(
    scheduler: &WorkScheduler,
    db: &Database,
    scans: &[PerformanceManagedScan],
    baseline_background: usize,
    expected_background: usize,
) -> (bool, crate::scheduler::SchedulerSnapshot) {
    let deadline = Instant::now() + PRESSURE_DEADLINE;
    let mut latest = scheduler.snapshot();
    while Instant::now() < deadline {
        latest = scheduler.snapshot();
        if latest.running_background >= baseline_background + expected_background {
            return (true, latest);
        }
        let all_terminal = scans
            .iter()
            .flat_map(|scan| scan.run_ids.iter())
            .all(|run_id| {
                db.get_scan_run_record(run_id)
                    .map(|record| {
                        matches!(
                            record.dto.status.as_str(),
                            "completed"
                                | "cancelled"
                                | "failed"
                                | "interrupted"
                                | "requires_reconciliation"
                        )
                    })
                    .unwrap_or(true)
            });
        if all_terminal {
            break;
        }
        thread::sleep(Duration::from_millis(25));
    }
    (false, latest)
}

fn request_scan_cancellation(
    db: &Database,
    jobs: &ScanJobManager,
    dedupe_jobs: &DedupeJobManager,
    run_ids: &[String],
) -> bool {
    let mut cancellation_ok = true;
    // The caller owns each session's run IDs, so it can request all terminal
    // transitions before joining workers without extending the foreground
    // admission measurement.
    for run_id in run_ids {
        let active = db
            .get_scan_run_record(run_id)
            .map(|record| {
                !matches!(
                    record.dto.status.as_str(),
                    "completed"
                        | "cancelled"
                        | "failed"
                        | "interrupted"
                        | "requires_reconciliation"
                )
            })
            .unwrap_or(false);
        if active {
            cancellation_ok &=
                cancel_performance_managed_scan(db, jobs, dedupe_jobs, run_id).is_ok();
        }
    }
    cancellation_ok
}

fn join_scan_workers(scans: &mut Vec<PerformanceManagedScan>) -> bool {
    let mut workers_joined = true;
    for scan in scans.drain(..) {
        workers_joined &= scan.worker.join().is_ok();
    }
    workers_joined
}

fn all_runs_settled(db: &Database, run_ids: &[String]) -> (bool, Value) {
    let rows = run_ids
        .iter()
        .map(|run_id| match db.get_scan_run_record(run_id) {
            Ok(record) => json!({ "run_id": run_id, "status": record.dto.status }),
            Err(error) => json!({ "run_id": run_id, "read_error": error.to_string() }),
        })
        .collect::<Vec<_>>();
    let settled = run_ids.iter().all(|run_id| {
        db.get_scan_run_record(run_id)
            .map(|record| {
                matches!(
                    record.dto.status.as_str(),
                    "completed" | "cancelled" | "interrupted"
                )
            })
            .unwrap_or(false)
    });
    (settled, json!(rows))
}

fn run_slot_observation<R: tauri::Runtime + 'static>(
    scheduler: &Arc<WorkScheduler>,
    initial_snapshot: &crate::scheduler::SchedulerSnapshot,
    fixture: &WorkspaceFixture,
    requested_slots: usize,
    background_capacity: ResourceCapacities,
    capacity_slots: usize,
    app: &tauri::AppHandle<R>,
) -> bool {
    let expected_active_slots = requested_slots.min(capacity_slots);
    let runtime = runtime_for(fixture);
    let opened = open_fixture(
        &runtime,
        fixture,
        &format!("managed-scan-slot-matrix-{requested_slots}"),
    );
    let idle_samples = measure_first_pages(
        &runtime,
        &opened.session_id,
        &opened.root_path_ref,
        &format!("slot-matrix-{requested_slots}-idle"),
    );
    let scan_db = Database::open(
        fixture
            .state_path()
            .join(format!("managed-scan-slots-{requested_slots}.sqlite3")),
    )
    .expect("open per-level managed-scan causal matrix database");
    let jobs = ScanJobManager::default();
    let dedupe_jobs = DedupeJobManager::default();
    let groups = assigned_roots(fixture, requested_slots);
    let mut scans = Vec::with_capacity(requested_slots);
    let mut admission_ok = true;
    for (index, roots) in groups.into_iter().enumerate() {
        match start_performance_managed_scan_roots(
            app.clone(),
            scan_db.clone(),
            jobs.clone(),
            dedupe_jobs.clone(),
            roots,
            format!("slot-matrix-{requested_slots}-session-{index}"),
            "background",
        ) {
            Ok(scan) => scans.push(scan),
            Err(error) => {
                admission_ok = false;
                eprintln!("managed scan slot matrix admission failed: {error}");
                break;
            }
        }
    }
    let sessions_admitted = scans.len() == requested_slots;
    let run_ids = scans
        .iter()
        .flat_map(|scan| scan.run_ids.iter().cloned())
        .collect::<Vec<_>>();
    let (pressure_observed, pressure_snapshot) = wait_for_pressure(
        scheduler,
        &scan_db,
        &scans,
        initial_snapshot.running_background,
        expected_active_slots,
    );
    let (progress_before, progress_before_runs) = progress_snapshot(&scan_db, &scans);
    let pressure_samples = measure_first_pages(
        &runtime,
        &opened.session_id,
        &opened.root_path_ref,
        &format!("slot-matrix-{requested_slots}-pressure"),
    );
    let pressure_after_snapshot = scheduler.snapshot();
    let (progress_after, progress_after_runs) = progress_snapshot(&scan_db, &scans);
    let background_progress = progress_after > progress_before;

    let foreground_scheduler = Arc::clone(scheduler);
    let foreground_cancellation = CancellationToken::new();
    let foreground_cancellation_for_worker = foreground_cancellation.clone();
    let (foreground_tx, foreground_rx) = mpsc::channel();
    let foreground_started = Instant::now();
    let foreground = thread::spawn(move || {
        let result = foreground_scheduler
            .acquire(
                WorkRequest::new(
                    format!("slot-matrix-{requested_slots}-foreground"),
                    WorkClass::Foreground,
                    ResourceHints {
                        cpu: 1,
                        io: 1,
                        open_handles: 1,
                        ..ResourceHints::empty()
                    },
                )
                .with_session_id(format!("slot-matrix-{requested_slots}-foreground-session"))
                .with_cancellation(foreground_cancellation_for_worker),
            )
            .map(|_| ());
        let _ = foreground_tx.send(result);
    });
    thread::sleep(Duration::from_millis(100));
    let cancellation_requests_ok =
        request_scan_cancellation(&scan_db, &jobs, &dedupe_jobs, &run_ids);
    let foreground_result = foreground_rx.recv_timeout(PRESSURE_DEADLINE);
    if foreground_result.is_err() {
        foreground_cancellation.cancel();
    }
    let foreground_wait_ms = foreground_started.elapsed().as_millis();
    let foreground_admitted = foreground_result.is_ok_and(|result| result.is_ok());
    let foreground_joined = foreground.join().is_ok();
    let workers_joined = join_scan_workers(&mut scans);

    let (scan_runs_settled, settled_runs) = all_runs_settled(&scan_db, &run_ids);
    let settled_snapshot = scheduler.snapshot();
    let scheduler_settled = settled_snapshot.running == initial_snapshot.running
        && settled_snapshot.queued == initial_snapshot.queued;
    let cancellation_releases_leases =
        cancellation_requests_ok && workers_joined && scheduler_settled;
    let disposed = runtime.dispose();
    let runtime_counts = runtime.resource_counts();
    let runtime_settled = disposed
        && runtime_counts.browse_service_sessions == 0
        && runtime_counts.browse_entry_refs == 0
        && runtime_counts.browse_path_refs == 0
        && runtime_counts.browse_active_enumerations == 0;

    let idle_p95_us = p95(&idle_samples);
    let pressure_p95_us = p95(&pressure_samples);
    let ratio = pressure_p95_us as f64 / idle_p95_us.max(1) as f64;
    let target_met = pressure_p95_us <= idle_p95_us.saturating_mul(2).max(1);
    let actual_active_slots = pressure_snapshot
        .running_background
        .saturating_sub(initial_snapshot.running_background);
    let matrix_level_achieved = actual_active_slots >= requested_slots;
    let structural_pass = admission_ok
        && sessions_admitted
        && pressure_observed
        && actual_active_slots >= expected_active_slots
        && foreground_admitted
        && foreground_joined
        && cancellation_releases_leases
        && workers_joined
        && scan_runs_settled
        && scheduler_settled
        && runtime_settled;
    let structural_classification = if structural_pass {
        metrics::HARD_PASS
    } else {
        metrics::BLOCKED
    };
    let latency_classification = if matrix_level_achieved {
        if target_met {
            metrics::TARGET_MET
        } else {
            metrics::TARGET_MISSED
        }
    } else {
        "MATRIX LEVEL UNAVAILABLE"
    };

    let common_fields = vec![
        (
            "target_effective_scan_slots".to_string(),
            json!(requested_slots),
        ),
        (
            "expected_attainable_scan_slots".to_string(),
            json!(expected_active_slots),
        ),
        (
            "scheduler_background_capacity_slots".to_string(),
            json!(capacity_slots),
        ),
        (
            "scheduler_background_capacity_cpu".to_string(),
            json!(background_capacity.cpu),
        ),
        (
            "scheduler_background_capacity_io".to_string(),
            json!(background_capacity.io),
        ),
        (
            "scheduler_background_capacity_open_handles".to_string(),
            json!(background_capacity.open_handles),
        ),
        (
            "observed_effective_scan_slots".to_string(),
            json!(actual_active_slots),
        ),
        (
            "matrix_level_achieved".to_string(),
            json!(matrix_level_achieved),
        ),
        (
            "all_requested_sessions_admitted".to_string(),
            json!(sessions_admitted),
        ),
        (
            "real_managed_scan_sessions".to_string(),
            json!(requested_slots),
        ),
        (
            "real_managed_scan_run_count".to_string(),
            json!(run_ids.len()),
        ),
        (
            "fixture_identity".to_string(),
            json!("one-shared-workspace-foundation-fixture-v1"),
        ),
        ("fixture_root_count".to_string(), json!(FIXTURE_ROOTS)),
        (
            "fixture_file_count_per_root".to_string(),
            json!(fixture_shape().0),
        ),
        (
            "fixture_directory_count_per_root".to_string(),
            json!(fixture_shape().1),
        ),
        (
            "fixture_total_entries".to_string(),
            json!(fixture_shape().2),
        ),
        ("idle_first_page_p95_us".to_string(), json!(idle_p95_us)),
        (
            "pressure_first_page_p95_us".to_string(),
            json!(pressure_p95_us),
        ),
        ("pressure_to_idle_ratio".to_string(), json!(ratio)),
        ("idle_sample_count".to_string(), json!(idle_samples.len())),
        (
            "pressure_sample_count".to_string(),
            json!(pressure_samples.len()),
        ),
        (
            "idle_first_page_samples_us".to_string(),
            json!(idle_samples),
        ),
        (
            "pressure_first_page_samples_us".to_string(),
            json!(pressure_samples),
        ),
        ("foreground_wait_ms".to_string(), json!(foreground_wait_ms)),
        (
            "foreground_admitted".to_string(),
            json!(foreground_admitted),
        ),
        (
            "foreground_deadline_ms".to_string(),
            json!(PRESSURE_DEADLINE.as_millis()),
        ),
        (
            "background_progress".to_string(),
            json!(background_progress),
        ),
        (
            "background_scanned_before_pressure_samples".to_string(),
            json!(progress_before),
        ),
        (
            "background_scanned_after_pressure_samples".to_string(),
            json!(progress_after),
        ),
        (
            "background_progress_runs_before".to_string(),
            progress_before_runs,
        ),
        (
            "background_progress_runs_after".to_string(),
            progress_after_runs,
        ),
        (
            "scheduler_before".to_string(),
            scheduler_fields(initial_snapshot),
        ),
        (
            "scheduler_at_pressure".to_string(),
            scheduler_fields(&pressure_snapshot),
        ),
        (
            "scheduler_after_pressure_samples".to_string(),
            scheduler_fields(&pressure_after_snapshot),
        ),
        ("scheduler_settled".to_string(), json!(scheduler_settled)),
        (
            "scheduler_settled_snapshot".to_string(),
            scheduler_fields(&settled_snapshot),
        ),
        ("pressure_observed".to_string(), json!(pressure_observed)),
        (
            "scan_runs_settled_without_failure".to_string(),
            json!(scan_runs_settled),
        ),
        ("scan_run_settled_statuses".to_string(), settled_runs),
        (
            "cancellation_requests_ok".to_string(),
            json!(cancellation_requests_ok),
        ),
        (
            "cancellation_releases_leases".to_string(),
            json!(cancellation_releases_leases),
        ),
        ("workers_joined".to_string(), json!(workers_joined)),
        ("runtime_settled".to_string(), json!(runtime_settled)),
        ("runtime_disposed".to_string(), json!(disposed)),
    ];
    metrics::emit_metric(
        "managed_scan_slot_causal_latency",
        latency_classification,
        common_fields.clone(),
    );
    metrics::emit_metric(
        "managed_scan_slot_causal_structure",
        structural_classification,
        common_fields,
    );
    structural_pass
}

#[test]
#[ignore = "post-repair Windows managed-scan causal matrix; exact hosted runner required"]
fn managed_scan_slot_causal_matrix_1_to_4() {
    let scheduler = WorkScheduler::global();
    let initial_snapshot = scheduler.snapshot();
    let background_decision = scheduler
        .config()
        .policy
        .decision(WorkClass::Background, scheduler.config().capacities);
    assert!(
        background_decision.allow_background,
        "the Windows production policy must admit background managed scans"
    );
    let background_capacity = background_decision.effective_capacity;
    let capacity_slots = background_capacity
        .cpu
        .min(background_capacity.io)
        .min(background_capacity.open_handles)
        .max(1) as usize;
    let (files_per_root, directories_per_root, fixture_entries) = fixture_shape();
    assert_eq!(fixture_entries, FIXTURE_ENTRIES);
    let fixture = WorkspaceFixture::split(
        "managed-scan-slot-causal-matrix",
        FIXTURE_ROOTS,
        files_per_root,
        directories_per_root,
    );
    let app = tauri::test::mock_app();
    let app_handle = app.handle().clone();
    let mut structural_rows = Vec::with_capacity(4);
    for requested_slots in 1..=4 {
        structural_rows.push(run_slot_observation(
            &scheduler,
            &initial_snapshot,
            &fixture,
            requested_slots,
            background_capacity,
            capacity_slots,
            &app_handle,
        ));
    }
    assert!(
        structural_rows.into_iter().all(|passed| passed),
        "one or more managed-scan causal rows failed their structural or settlement checks"
    );
}
