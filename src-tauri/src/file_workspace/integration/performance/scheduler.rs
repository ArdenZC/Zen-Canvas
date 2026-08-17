#![cfg(feature = "performance-test-tauri")]

use super::{
    fixture::WorkspaceFixture,
    harness::{open_fixture, runtime_for},
    metrics,
};
use crate::{
    db::Database,
    dedupe::DedupeJobManager,
    file_workspace::contracts::WorkClass,
    scanner::{
        cancel_performance_managed_scan, start_performance_managed_scan, PerformanceManagedScan,
    },
    scheduler::{ResourceHints, WorkRequest, WorkScheduler},
};
use serde_json::json;
use std::{
    sync::{mpsc, Arc},
    thread,
    time::{Duration, Instant},
};

fn p95(values: &[u128]) -> u128 {
    let mut sorted = values.to_vec();
    sorted.sort_unstable();
    sorted[(sorted.len() * 95).div_ceil(100).saturating_sub(1)]
}

const MIN_PRESSURE_FIXTURE_ENTRIES: usize = 100_000;
// Twenty samples makes nearest-rank p95 distinct from the maximum while
// retaining the same foreground first-page workload under both conditions.
const FIRST_PAGE_SAMPLE_COUNT: usize = 20;

fn pressure_fixture_shape(scan_root_count: usize) -> (usize, usize, usize) {
    let entries_per_root = MIN_PRESSURE_FIXTURE_ENTRIES.div_ceil(scan_root_count.max(1));
    let directories_per_root = (entries_per_root / 10).max(1);
    let files_per_root = entries_per_root.saturating_sub(directories_per_root);
    let total_entries =
        scan_root_count.saturating_mul(files_per_root.saturating_add(directories_per_root));
    (files_per_root, directories_per_root, total_entries)
}

fn measure_first_pages(
    runtime: &crate::file_workspace::integration::FileWorkspaceRuntime,
    session_id: &str,
    path_ref: &crate::file_workspace::BrowsePathRef,
    prefix: &str,
) -> Vec<u128> {
    (0..FIRST_PAGE_SAMPLE_COUNT)
        .map(|index| {
            let started = Instant::now();
            let page = runtime
                .start_enumeration(
                    crate::file_workspace::integration::types::BrowseStartEnumerationRequest {
                        session_id: session_id.to_string(),
                        request_id: format!("{prefix}-{index}"),
                        path_ref: path_ref.clone(),
                        page_size: 128,
                    },
                )
                .expect("foreground Browse remains usable under scheduler pressure");
            assert!(!page.entries.is_empty());
            started.elapsed().as_micros()
        })
        .collect()
}

fn wait_for_real_pressure(
    scheduler: &WorkScheduler,
    scan_db: &Database,
    scans: &[PerformanceManagedScan],
    expected_background: usize,
) -> bool {
    let deadline = Instant::now() + Duration::from_secs(15);
    while Instant::now() < deadline {
        if scheduler.snapshot().running_background >= expected_background {
            return true;
        }
        if scans.iter().all(|scan| {
            scan_db
                .get_scan_run_record(&scan.run_id)
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
        }) {
            return false;
        }
        thread::sleep(Duration::from_millis(25));
    }
    false
}

fn cancel_and_join_scans(
    scan_db: &Database,
    jobs: &crate::scanner::ScanJobManager,
    dedupe_jobs: &DedupeJobManager,
    scans: &mut Vec<PerformanceManagedScan>,
) -> bool {
    let mut cancellation_ok = true;
    for scan in scans.iter() {
        let should_cancel = scan_db
            .get_scan_run_record(&scan.run_id)
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
        if should_cancel {
            cancellation_ok &=
                cancel_performance_managed_scan(scan_db, jobs, dedupe_jobs, &scan.run_id).is_ok();
        }
    }
    for scan in scans.drain(..) {
        cancellation_ok &= scan.worker.join().is_ok();
    }
    cancellation_ok
}

#[test]
#[ignore = "W1-11 real managed scan scheduler interference evidence"]
fn managed_scan_pressure_preserves_foreground_browse_and_releases() {
    let scheduler = WorkScheduler::global();
    let initial_snapshot = scheduler.snapshot();
    let decision = scheduler
        .config()
        .policy
        .decision(WorkClass::Background, scheduler.config().capacities);

    if !decision.allow_background {
        metrics::emit_metric(
            "managed_scan_pressure",
            metrics::UNVERIFIED,
            [
                (
                    "reason".to_string(),
                    json!("platform policy denied background work"),
                ),
                (
                    "scheduler_running".to_string(),
                    json!(initial_snapshot.running),
                ),
            ],
        );
        return;
    }

    // One independent real scan root per adapter slot gives the existing
    // managed scanner a chance to occupy its actual budget. No performance-
    // only scheduler or synthetic lease holder is used here.
    let pressure_slots = decision
        .effective_capacity
        .cpu
        .min(decision.effective_capacity.io)
        .max(1) as usize;
    let scan_root_count = pressure_slots.saturating_add(1);
    let (files_per_root, directories_per_root, pressure_fixture_entries) =
        pressure_fixture_shape(scan_root_count);
    assert!(pressure_fixture_entries >= MIN_PRESSURE_FIXTURE_ENTRIES);
    let fixture = WorkspaceFixture::split(
        "scheduler-managed-scan",
        scan_root_count,
        files_per_root,
        directories_per_root,
    );
    let runtime = runtime_for(&fixture);
    let opened = open_fixture(&runtime, &fixture, "scheduler-managed-scan");
    let idle_samples = measure_first_pages(
        &runtime,
        &opened.session_id,
        &opened.root_path_ref,
        "scheduler-idle",
    );

    let scan_db = Database::open(fixture.state_path().join("managed-scan.sqlite3"))
        .expect("open managed scan performance database");
    let jobs = crate::scanner::ScanJobManager::default();
    let dedupe_jobs = DedupeJobManager::default();
    let app = tauri::test::mock_app();
    let app_handle = app.handle().clone();
    let mut scans = Vec::with_capacity(scan_root_count);
    let mut admission_ok = true;
    for index in 0..pressure_slots {
        match start_performance_managed_scan(
            app_handle.clone(),
            scan_db.clone(),
            jobs.clone(),
            dedupe_jobs.clone(),
            fixture.child_path(index),
            format!("w1-11-managed-scan-{index}"),
            "background",
        ) {
            Ok(scan) => scans.push(scan),
            Err(error) => {
                admission_ok = false;
                eprintln!("managed scan performance admission failed: {error}");
                break;
            }
        }
    }
    let pressure_observed = admission_ok
        && scans.len() == pressure_slots
        && wait_for_real_pressure(&scheduler, &scan_db, &scans, pressure_slots);
    let pressure_snapshot = scheduler.snapshot();
    // Admit the extra real scan only after all pressure slots are observed as
    // occupied. Its adapter acquisition must therefore wait for the explicit
    // cancellation below instead of completing before pressure measurement.
    if admission_ok {
        match start_performance_managed_scan(
            app_handle,
            scan_db.clone(),
            jobs.clone(),
            dedupe_jobs.clone(),
            fixture.child_path(pressure_slots),
            format!("w1-11-managed-scan-{pressure_slots}"),
            "background",
        ) {
            Ok(scan) => scans.push(scan),
            Err(error) => {
                admission_ok = false;
                eprintln!("managed scan replacement admission failed: {error}");
            }
        }
    }
    let pressure_samples = measure_first_pages(
        &runtime,
        &opened.session_id,
        &opened.root_path_ref,
        "scheduler-pressure",
    );

    // Exercise process-local foreground admission while real managed scanner
    // workers own background leases. Cancel one real run to prove that the
    // production cancellation path frees capacity.
    let foreground_scheduler = Arc::clone(&scheduler);
    let (foreground_tx, foreground_rx) = mpsc::channel();
    let foreground_started = Instant::now();
    let foreground = thread::spawn(move || {
        let result = foreground_scheduler
            .acquire(
                WorkRequest::new(
                    "w1-11-foreground-work",
                    WorkClass::Foreground,
                    ResourceHints {
                        cpu: 1,
                        io: 1,
                        open_handles: 1,
                        ..ResourceHints::empty()
                    },
                )
                .with_session_id("w1-11-foreground-session"),
            )
            .map(|_| ());
        let _ = foreground_tx.send(result);
    });
    thread::sleep(Duration::from_millis(100));
    let cancelled_one = scans.first().is_some_and(|scan| {
        cancel_performance_managed_scan(&scan_db, &jobs, &dedupe_jobs, &scan.run_id).is_ok()
    });
    let foreground_result = foreground_rx.recv_timeout(Duration::from_secs(30));
    let foreground_wait_ms = foreground_started.elapsed().as_millis();
    let foreground_admitted = foreground_result.is_ok_and(|result| result.is_ok());
    foreground
        .join()
        .expect("foreground scheduler admission joins");

    // The extra real scan should be able to make progress after one lease is
    // released. Require a replacement background grant in addition to the
    // foreground grant, so the metric cannot be satisfied by foreground work
    // alone.
    let replacement_deadline = Instant::now() + Duration::from_secs(15);
    let mut background_progressed = false;
    while Instant::now() < replacement_deadline {
        let snapshot = scheduler.snapshot();
        let extra_scan_left_queued = scans
            .get(pressure_slots)
            .and_then(|scan| scan_db.get_scan_run_record(&scan.run_id).ok())
            .is_some_and(|record| record.dto.status == "queued");
        if !extra_scan_left_queued
            && (snapshot.running_background >= pressure_slots
                || snapshot.total_grants >= pressure_snapshot.total_grants + 2)
        {
            background_progressed = true;
            break;
        }
        thread::sleep(Duration::from_millis(25));
    }
    let scan_run_ids = scans
        .iter()
        .map(|scan| scan.run_id.clone())
        .collect::<Vec<_>>();
    let cancellation_releases = cancel_and_join_scans(&scan_db, &jobs, &dedupe_jobs, &mut scans);
    let scan_runs_settled_without_failure = scan_run_ids.iter().all(|run_id| {
        scan_db
            .get_scan_run_record(run_id)
            .map(|record| {
                matches!(
                    record.dto.status.as_str(),
                    "completed" | "cancelled" | "interrupted"
                )
            })
            .unwrap_or(false)
    });
    let settled_snapshot = scheduler.snapshot();
    let scheduler_settled = settled_snapshot.running == initial_snapshot.running
        && settled_snapshot.queued == initial_snapshot.queued;

    assert!(runtime.dispose());
    let settled_runtime = runtime.resource_counts();
    let runtime_settled = settled_runtime.browse_service_sessions == 0
        && settled_runtime.browse_entry_refs == 0
        && settled_runtime.browse_path_refs == 0
        && settled_runtime.browse_active_enumerations == 0;
    assert!(
        runtime_settled,
        "File Workspace resources must settle after pressure"
    );

    let idle_p95_us = p95(&idle_samples);
    let pressure_p95_us = p95(&pressure_samples);
    let foreground_within_2x_idle_target = pressure_p95_us <= idle_p95_us.saturating_mul(2).max(1);
    let structural_pass = admission_ok
        && pressure_observed
        && foreground_admitted
        && background_progressed
        && cancelled_one
        && cancellation_releases
        && scan_runs_settled_without_failure
        && scheduler_settled
        && runtime_settled;
    let classification = if structural_pass {
        metrics::HARD_PASS
    } else {
        metrics::BLOCKED
    };
    metrics::emit_metric(
        "managed_scan_foreground_latency",
        if foreground_within_2x_idle_target {
            metrics::TARGET_MET
        } else {
            metrics::TARGET_MISSED
        },
        [
            ("idle_first_page_p95_us".to_string(), json!(idle_p95_us)),
            (
                "pressure_first_page_p95_us".to_string(),
                json!(pressure_p95_us),
            ),
            ("sample_count".to_string(), json!(idle_samples.len())),
            ("foreground_wait_ms".to_string(), json!(foreground_wait_ms)),
            ("foreground_deadline_ms".to_string(), json!(30_000)),
            (
                "foreground_within_2x_idle_target".to_string(),
                json!(foreground_within_2x_idle_target),
            ),
        ],
    );
    metrics::emit_metric(
        "managed_scan_pressure",
        classification,
        [
            (
                "real_authority".to_string(),
                json!("scanner::run_managed_session"),
            ),
            (
                "adapter".to_string(),
                json!("ManagedScanResourceLeaseAdapter"),
            ),
            ("managed_scan_admission".to_string(), json!(admission_ok)),
            ("pressure_slots".to_string(), json!(pressure_slots)),
            ("real_scan_count".to_string(), json!(scan_root_count)),
            (
                "pressure_fixture_entries".to_string(),
                json!(pressure_fixture_entries),
            ),
            (
                "pressure_fixture_files_per_root".to_string(),
                json!(files_per_root),
            ),
            (
                "pressure_fixture_directories_per_root".to_string(),
                json!(directories_per_root),
            ),
            (
                "pressure_fixture_min_entries".to_string(),
                json!(MIN_PRESSURE_FIXTURE_ENTRIES),
            ),
            ("pressure_observed".to_string(), json!(pressure_observed)),
            (
                "pressure_scheduler_background".to_string(),
                json!(pressure_snapshot.running_background),
            ),
            (
                "background_progressed_after_release".to_string(),
                json!(background_progressed),
            ),
            (
                "cancellation_releases_leases".to_string(),
                json!(cancellation_releases),
            ),
            (
                "scan_runs_settled_without_failure".to_string(),
                json!(scan_runs_settled_without_failure),
            ),
            (
                "scheduler_settled_running".to_string(),
                json!(settled_snapshot.running),
            ),
            (
                "scheduler_settled_queued".to_string(),
                json!(settled_snapshot.queued),
            ),
            (
                "runtime_settled_entry_refs".to_string(),
                json!(settled_runtime.browse_entry_refs),
            ),
            (
                "runtime_settled_path_refs".to_string(),
                json!(settled_runtime.browse_path_refs),
            ),
            ("fixture_root_scope".to_string(), json!("repository-local")),
        ],
    );
    assert!(
        structural_pass,
        "real managed scan pressure did not preserve foreground access, background progress, cancellation release, or steady state"
    );
}
