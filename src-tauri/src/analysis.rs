//! Durable Analysis Run orchestration and the fixed detector registry.
//!
//! This module owns only analysis coordination. Detector output is staged in
//! the database and is published by one short transaction; the renderer never
//! becomes an authority for a run, finding, or cleanup candidate.

use crate::{
    db::{
        AnalysisDetectorDto, AnalysisFindingDecisionDto, AnalysisFindingDto,
        AnalysisFindingEvidenceDto, AnalysisFindingFilter, AnalysisFindingPageDto, AnalysisRunDto,
        Database, DedupeAuthorityDto, DedupeGroupDto, DedupeGroupMemberDto, FindingDraft,
        FindingEvidenceDraft, StartAnalysisRunRequest,
    },
    fs_safety::capture_physical_identity,
    storage_analyzer::{self, CleanupActionKind, CleanupTier, StorageCandidate},
    window_auth::require_main_window,
};
use serde::Serialize;
use serde_json::{json, Value};
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};
use tauri::{AppHandle, Emitter, Runtime, State, WebviewWindow};

pub const ANALYSIS_RUN_UPDATED_EVENT: &str = "analysis-run-updated";
pub const ANALYSIS_DETECTOR_UPDATED_EVENT: &str = "analysis-detector-updated";
pub const ANALYSIS_FINDINGS_PUBLISHED_EVENT: &str = "analysis-findings-published";

pub const DUPLICATE_RECLAIMABLE_DETECTOR: &str = "duplicate_reclaimable_v1";
pub const LARGE_FILE_DETECTOR: &str = "large_file_v1";
pub const LARGE_DIRECTORY_DETECTOR: &str = "large_directory_v1";
pub const CLEANUP_HEURISTICS_DETECTOR: &str = "cleanup_heuristics_v1";

const DETECTOR_VERSION: i64 = 1;
const LARGE_FILE_THRESHOLD: u64 = 100 * 1024 * 1024;
const LARGE_DIRECTORY_THRESHOLD: u64 = 500 * 1024 * 1024;
const ALL_DETECTORS: [&str; 4] = [
    DUPLICATE_RECLAIMABLE_DETECTOR,
    LARGE_FILE_DETECTOR,
    LARGE_DIRECTORY_DETECTOR,
    CLEANUP_HEURISTICS_DETECTOR,
];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisDetectorDescriptor {
    pub detector_id: String,
    pub version: i64,
    pub title: String,
    pub description: String,
    pub supports_all_managed_scope: bool,
    pub supports_approved_paths: bool,
}

#[derive(Clone, Default)]
pub struct AnalysisRunManager {
    jobs: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
}

impl AnalysisRunManager {
    fn register(&self, run_id: &str) -> Result<Arc<AtomicBool>, String> {
        let mut jobs = self
            .jobs
            .lock()
            .map_err(|_| "Analysis run manager is unavailable.".to_string())?;
        if jobs.contains_key(run_id) {
            return Err(format!("Analysis run already has a local owner: {run_id}"));
        }
        let flag = Arc::new(AtomicBool::new(false));
        jobs.insert(run_id.to_string(), Arc::clone(&flag));
        Ok(flag)
    }

    pub(crate) fn cancel(&self, run_id: &str) -> bool {
        self.jobs
            .lock()
            .ok()
            .and_then(|jobs| jobs.get(run_id).cloned())
            .map(|flag| {
                flag.store(true, Ordering::Release);
                true
            })
            .unwrap_or(false)
    }

    fn finish(&self, run_id: &str) {
        if let Ok(mut jobs) = self.jobs.lock() {
            jobs.remove(run_id);
        }
    }
}

pub fn detector_registry() -> Vec<AnalysisDetectorDescriptor> {
    ALL_DETECTORS
        .iter()
        .map(|detector_id| AnalysisDetectorDescriptor {
            detector_id: (*detector_id).to_string(),
            version: DETECTOR_VERSION,
            title: match *detector_id {
                DUPLICATE_RECLAIMABLE_DETECTOR => "Duplicate reclaimable groups".to_string(),
                LARGE_FILE_DETECTOR => "Large files".to_string(),
                LARGE_DIRECTORY_DETECTOR => "Large directories".to_string(),
                _ => "Cleanup heuristics".to_string(),
            },
            description: match *detector_id {
                DUPLICATE_RECLAIMABLE_DETECTOR => {
                    "Reads only the healthy global dedupe authority; never executes cleanup."
                        .to_string()
                }
                LARGE_FILE_DETECTOR => {
                    "Reports large managed or explicitly approved files for review.".to_string()
                }
                LARGE_DIRECTORY_DETECTOR => {
                    "Reports large directories without nested double counting.".to_string()
                }
                _ => "Applies the existing deterministic protected/excluded/allowlist classification."
                    .to_string(),
            },
            supports_all_managed_scope: matches!(
                *detector_id,
                DUPLICATE_RECLAIMABLE_DETECTOR | LARGE_FILE_DETECTOR
            ),
            supports_approved_paths: *detector_id != DUPLICATE_RECLAIMABLE_DETECTOR,
        })
        .collect()
}

#[tauri::command]
pub fn list_analysis_detectors() -> Vec<AnalysisDetectorDescriptor> {
    detector_registry()
}

#[tauri::command]
pub fn start_analysis_run<R: Runtime>(
    window: WebviewWindow<R>,
    app: AppHandle<R>,
    db: State<'_, Database>,
    manager: State<'_, AnalysisRunManager>,
    mut request: StartAnalysisRunRequest,
) -> Result<AnalysisRunDto, String> {
    require_main_window(&window)?;
    normalize_analysis_request(&mut request)?;
    start_analysis_request(app, db.inner(), manager.inner(), request)
}

/// Start the durable analysis projection used by the legacy Storage Cleanup
/// surface.  The caller supplies only the approved roots; all detector,
/// request-key, and worker ownership decisions remain in this module.
pub(crate) fn start_cleanup_analysis_run<R: Runtime>(
    app: AppHandle<R>,
    db: &Database,
    manager: &AnalysisRunManager,
    roots: Vec<String>,
) -> Result<AnalysisRunDto, String> {
    let request = StartAnalysisRunRequest {
        scope: crate::db::AnalysisScopeRequest {
            kind: "approved_cleanup_paths".to_string(),
            root_ids: Vec::new(),
            paths: roots,
        },
        detector_ids: vec![
            LARGE_FILE_DETECTOR.to_string(),
            LARGE_DIRECTORY_DETECTOR.to_string(),
            CLEANUP_HEURISTICS_DETECTOR.to_string(),
        ],
        request_key: Some(crate::ids::new_job_id("storage-cleanup-request")),
    };
    start_analysis_request(app, db, manager, request)
}

fn start_analysis_request<R: Runtime>(
    app: AppHandle<R>,
    db: &Database,
    manager: &AnalysisRunManager,
    mut request: StartAnalysisRunRequest,
) -> Result<AnalysisRunDto, String> {
    normalize_analysis_request(&mut request)?;
    let detector_ids = resolve_detector_ids(&request)?;
    let admission = db
        .start_analysis_run(&request, &detector_ids)
        .map_err(|error| error.to_string())?;
    let run = admission.run.clone();
    emit_run(&app, &run);
    if admission.created {
        spawn_analysis_run(app, db.clone(), manager.clone(), run.id.clone())?;
    }
    Ok(run)
}

#[tauri::command]
pub fn cancel_analysis_run<R: Runtime>(
    window: WebviewWindow<R>,
    app: AppHandle<R>,
    db: State<'_, Database>,
    manager: State<'_, AnalysisRunManager>,
    run_id: String,
) -> Result<AnalysisRunDto, String> {
    require_main_window(&window)?;
    let run_id = run_id.trim();
    manager.cancel(run_id);
    let run = db
        .request_analysis_cancellation(run_id)
        .map_err(|error| error.to_string())?;
    emit_run(&app, &run);
    Ok(run)
}

#[tauri::command]
pub fn retry_analysis_run<R: Runtime>(
    window: WebviewWindow<R>,
    app: AppHandle<R>,
    db: State<'_, Database>,
    manager: State<'_, AnalysisRunManager>,
    run_id: String,
) -> Result<AnalysisRunDto, String> {
    require_main_window(&window)?;
    let existing = db
        .get_analysis_run(run_id.trim())
        .map_err(|error| error.to_string())?;
    let detector_ids = existing
        .detector_set
        .iter()
        .filter_map(|value| {
            value
                .split_once(":v")
                .map(|(id, _)| (id.to_string(), DETECTOR_VERSION))
        })
        .collect::<Vec<_>>();
    let admission = db
        .retry_analysis_run(run_id.trim(), &detector_ids)
        .map_err(|error| error.to_string())?;
    let run = admission.run.clone();
    emit_run(&app, &run);
    if admission.created {
        spawn_analysis_run(
            app,
            db.inner().clone(),
            manager.inner().clone(),
            run.id.clone(),
        )?;
    }
    Ok(run)
}

#[tauri::command]
pub fn get_analysis_run(db: State<'_, Database>, run_id: String) -> Result<AnalysisRunDto, String> {
    db.get_analysis_run(run_id.trim())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_active_analysis_run(db: State<'_, Database>) -> Result<Option<AnalysisRunDto>, String> {
    db.get_active_analysis_run()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_analysis_runs(
    db: State<'_, Database>,
    limit: Option<usize>,
) -> Result<Vec<AnalysisRunDto>, String> {
    db.list_analysis_runs(limit.unwrap_or(20))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_analysis_run_detectors(
    db: State<'_, Database>,
    run_id: String,
) -> Result<Vec<AnalysisDetectorDto>, String> {
    db.list_analysis_run_detectors(run_id.trim())
        .map_err(|error| error.to_string())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn list_analysis_findings(
    db: State<'_, Database>,
    run_id: Option<String>,
    detector_id: Option<String>,
    tier: Option<String>,
    category: Option<String>,
    decision: Option<String>,
    status: Option<String>,
    executable_only: Option<bool>,
    cursor: Option<String>,
    limit: Option<usize>,
) -> Result<AnalysisFindingPageDto, String> {
    let filter = AnalysisFindingFilter {
        run_id,
        detector_id,
        tier,
        category,
        decision,
        status,
        executable_only: executable_only.unwrap_or(false),
    };
    db.list_analysis_findings(&filter, cursor.as_deref(), limit.unwrap_or(100))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_analysis_finding(
    db: State<'_, Database>,
    finding_id: String,
) -> Result<Option<AnalysisFindingDto>, String> {
    db.get_analysis_finding(finding_id.trim())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_analysis_finding_evidence(
    db: State<'_, Database>,
    finding_id: String,
) -> Result<Vec<AnalysisFindingEvidenceDto>, String> {
    db.list_analysis_finding_evidence(finding_id.trim())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_dedupe_authority(db: State<'_, Database>) -> Result<DedupeAuthorityDto, String> {
    db.get_dedupe_authority().map_err(|error| error.to_string())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn set_analysis_finding_decision<R: Runtime>(
    window: WebviewWindow<R>,
    app: AppHandle<R>,
    db: State<'_, Database>,
    finding_key: String,
    decision: String,
    snoozed_until: Option<i64>,
    note: Option<String>,
    expected_revision: Option<i64>,
) -> Result<AnalysisFindingDecisionDto, String> {
    require_main_window(&window)?;
    let result = db
        .set_analysis_finding_decision(
            finding_key.trim(),
            decision.trim(),
            snoozed_until,
            note.as_deref(),
            expected_revision,
        )
        .map_err(|error| error.to_string())?;
    let _ = app.emit("analysis-finding-decision-updated", result.clone());
    Ok(result)
}

#[tauri::command]
pub fn revalidate_analysis_finding<R: Runtime>(
    window: WebviewWindow<R>,
    db: State<'_, Database>,
    finding_id: String,
) -> Result<AnalysisFindingDto, String> {
    require_main_window(&window)?;
    let finding = db
        .get_analysis_finding(finding_id.trim())
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "Analysis finding was not found.".to_string())?;
    if finding.status == "active" && !finding_identity_matches(&finding) {
        db.mark_analysis_finding_stale(&finding.id)
            .map_err(|error| error.to_string())?;
    }
    db.get_analysis_finding(&finding.id)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "Analysis finding disappeared during revalidation.".to_string())
}

fn normalize_analysis_request(request: &mut StartAnalysisRunRequest) -> Result<(), String> {
    let kind = request.scope.kind.trim();
    if matches!(kind, "approvedCleanupPaths" | "approved_cleanup_paths") {
        let raw = std::mem::take(&mut request.scope.paths);
        let validated = storage_analyzer::validate_cleanup_roots(raw)?;
        request.scope.paths = validated
            .into_iter()
            .map(|path| path.to_string_lossy().into_owned())
            .collect();
        request.scope.kind = "approved_cleanup_paths".to_string();
    } else if matches!(kind, "allManagedFileLibrary" | "all_managed_file_library") {
        request.scope.kind = "all_managed_file_library".to_string();
    } else if matches!(
        kind,
        "explicitEnabledScanRoots" | "explicit_enabled_scan_roots"
    ) {
        request.scope.kind = "explicit_enabled_scan_roots".to_string();
    }
    Ok(())
}

fn resolve_detector_ids(request: &StartAnalysisRunRequest) -> Result<Vec<(String, i64)>, String> {
    let requested = if request.detector_ids.is_empty() {
        ALL_DETECTORS
            .iter()
            .copied()
            .filter(|id| {
                (request.scope.kind == "all_managed_file_library"
                    && matches!(*id, DUPLICATE_RECLAIMABLE_DETECTOR | LARGE_FILE_DETECTOR))
                    || (request.scope.kind == "approved_cleanup_paths"
                        && *id != DUPLICATE_RECLAIMABLE_DETECTOR)
            })
            .map(str::to_string)
            .collect::<Vec<_>>()
    } else {
        request.detector_ids.clone()
    };
    let mut seen = HashSet::new();
    let mut result = Vec::with_capacity(requested.len());
    for detector_id in requested {
        let detector_id = detector_id.trim();
        if !ALL_DETECTORS.contains(&detector_id) {
            return Err(format!("Unknown analysis detector: {detector_id}"));
        }
        let supported = if request.scope.kind == "all_managed_file_library" {
            matches!(
                detector_id,
                DUPLICATE_RECLAIMABLE_DETECTOR | LARGE_FILE_DETECTOR
            )
        } else {
            detector_id != DUPLICATE_RECLAIMABLE_DETECTOR
        };
        if !supported {
            return Err(format!(
                "Analysis detector {detector_id} does not support the requested scope."
            ));
        }
        if seen.insert(detector_id.to_string()) {
            if request.scope.kind == "approved_cleanup_paths"
                && detector_id == DUPLICATE_RECLAIMABLE_DETECTOR
            {
                return Err(
                    "Duplicate detector requires the all-managed healthy global authority scope."
                        .to_string(),
                );
            }
            result.push((detector_id.to_string(), DETECTOR_VERSION));
        }
    }
    if result.is_empty() {
        return Err("At least one fixed analysis detector is required.".to_string());
    }
    Ok(result)
}

fn spawn_analysis_run<R: Runtime>(
    app: AppHandle<R>,
    db: Database,
    manager: AnalysisRunManager,
    run_id: String,
) -> Result<(), String> {
    let cancel_flag = manager.register(&run_id)?;
    tauri::async_runtime::spawn_blocking(move || {
        let result = run_analysis_run(&app, &db, &manager, &run_id, &cancel_flag);
        if let Err(error) = result {
            if let Err(failure) = db.fail_analysis_run(&run_id, "analysis_worker_failed", &error) {
                eprintln!("Analysis failure could not be persisted for {run_id}: {failure}");
            }
            if let Ok(run) = db.get_analysis_run(&run_id) {
                emit_run(&app, &run);
            }
        }
        manager.finish(&run_id);
    });
    Ok(())
}

fn run_analysis_run<R: Runtime>(
    app: &AppHandle<R>,
    db: &Database,
    manager: &AnalysisRunManager,
    run_id: &str,
    cancel_flag: &Arc<AtomicBool>,
) -> Result<(), String> {
    let Some(mut run) = db
        .claim_analysis_run(run_id)
        .map_err(|error| error.to_string())?
    else {
        return Ok(());
    };
    emit_run(app, &run);
    let detectors = db
        .list_analysis_run_detectors(run_id)
        .map_err(|error| error.to_string())?;
    let mut cleanup_drafts: Option<Vec<(String, FindingDraft)>> = None;
    let mut warning_count = run.warning_count;
    let mut error_count = run.error_count;

    for detector in detectors {
        if cancel_flag.load(Ordering::Acquire)
            || db
                .is_analysis_cancel_requested(run_id)
                .map_err(|error| error.to_string())?
        {
            break;
        }
        run = db
            .get_analysis_run(run_id)
            .map_err(|error| error.to_string())?;
        run = db
            .checkpoint_analysis_run(
                run_id,
                run.revision,
                "running_detectors",
                warning_count,
                error_count,
            )
            .map_err(|error| error.to_string())?;
        let detector = db
            .set_analysis_detector_status(
                run_id,
                &detector.detector_id,
                detector.revision,
                "running",
                0,
                0,
                0,
                0,
                None,
                None,
            )
            .map_err(|error| error.to_string())?;
        emit_detector(app, &detector);

        let outcome = if detector.detector_id == DUPLICATE_RECLAIMABLE_DETECTOR {
            duplicate_findings(db, &run, cancel_flag)
        } else {
            if cleanup_drafts.is_none() {
                cleanup_drafts = Some(build_cleanup_findings(db, &run, cancel_flag)?);
            }
            Ok(cleanup_drafts
                .as_ref()
                .map(|items| {
                    items
                        .iter()
                        .filter(|(detector_id, _)| detector_id == &detector.detector_id)
                        .map(|(_, finding)| finding.clone())
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default())
        };

        let current_detector = db
            .list_analysis_run_detectors(run_id)
            .map_err(|error| error.to_string())?
            .into_iter()
            .find(|item| item.detector_id == detector.detector_id)
            .ok_or_else(|| "Analysis detector disappeared.".to_string())?;
        match outcome {
            Ok(drafts) => {
                if cancel_flag.load(Ordering::Acquire)
                    || db
                        .is_analysis_cancel_requested(run_id)
                        .map_err(|error| error.to_string())?
                {
                    let cancelled = db
                        .set_analysis_detector_status(
                            run_id,
                            &detector.detector_id,
                            current_detector.revision,
                            "cancelled",
                            0,
                            0,
                            0,
                            0,
                            Some("cancelled"),
                            Some("Detector was cancelled before publication."),
                        )
                        .map_err(|error| error.to_string())?;
                    emit_detector(app, &cancelled);
                    break;
                }
                db.stage_analysis_findings(run_id, &run.scope_hash, &drafts)
                    .map_err(|error| error.to_string())?;
                let exact = drafts
                    .iter()
                    .filter_map(|draft| draft.exact_reclaimable_bytes)
                    .sum();
                let potential = drafts
                    .iter()
                    .map(|draft| draft.potential_reclaimable_bytes)
                    .sum();
                let completed = db
                    .set_analysis_detector_status(
                        run_id,
                        &detector.detector_id,
                        current_detector.revision,
                        "completed",
                        drafts.len() as i64,
                        drafts.len() as i64,
                        exact,
                        potential,
                        None,
                        None,
                    )
                    .map_err(|error| error.to_string())?;
                emit_detector(app, &completed);
            }
            Err(error) => {
                let cancellation_requested = cancel_flag.load(Ordering::Acquire)
                    || db
                        .is_analysis_cancel_requested(run_id)
                        .map_err(|db_error| db_error.to_string())?;
                let status = if cancellation_requested {
                    "cancelled"
                } else {
                    warning_count += 1;
                    error_count += 1;
                    "failed"
                };
                let failed = db
                    .set_analysis_detector_status(
                        run_id,
                        &detector.detector_id,
                        current_detector.revision,
                        status,
                        0,
                        0,
                        0,
                        0,
                        Some(if cancellation_requested {
                            "cancelled"
                        } else {
                            "detector_failed"
                        }),
                        Some(&error),
                    )
                    .map_err(|error| error.to_string())?;
                emit_detector(app, &failed);
                if cancellation_requested {
                    break;
                }
            }
        }
    }

    run = db
        .get_analysis_run(run_id)
        .map_err(|error| error.to_string())?;
    let phase = db
        .checkpoint_analysis_run(
            run_id,
            run.revision,
            "finalizing",
            warning_count,
            error_count,
        )
        .map_err(|error| error.to_string())?;
    emit_run(app, &phase);
    let outcome = db
        .publish_analysis_run(run_id)
        .map_err(|error| error.to_string())?;
    let completed = db
        .get_analysis_run(run_id)
        .map_err(|error| error.to_string())?;
    emit_run(app, &completed);
    if matches!(
        outcome,
        crate::db::AnalysisPublishOutcome::Completed
            | crate::db::AnalysisPublishOutcome::CompletedWithWarnings
    ) {
        let _ = app.emit(ANALYSIS_FINDINGS_PUBLISHED_EVENT, completed.clone());
    }
    // Coalesced requests and a source-changed publication may receive one
    // automatic retry.  The second attempt is deliberately user-visible and
    // never auto-retries again, so a changing source cannot create a loop.
    if completed.rerun_required && completed.request_attempt < 2 {
        let detector_ids = completed
            .detector_set
            .iter()
            .filter_map(|value| {
                value.split_once(":v").and_then(|(id, version)| {
                    version.parse::<i64>().ok().map(|v| (id.to_string(), v))
                })
            })
            .collect::<Vec<_>>();
        match db.retry_analysis_run(&completed.id, &detector_ids) {
            Ok(admission) if admission.created => {
                emit_run(app, &admission.run);
                if let Err(error) = spawn_analysis_run(
                    app.clone(),
                    db.clone(),
                    manager.clone(),
                    admission.run.id.clone(),
                ) {
                    eprintln!("Analysis coalesced retry could not start: {error}");
                }
            }
            Ok(_) => {}
            Err(error) => eprintln!("Analysis coalesced retry was not admitted: {error}"),
        }
    }
    Ok(())
}

fn duplicate_findings(
    db: &Database,
    run: &AnalysisRunDto,
    cancel_flag: &Arc<AtomicBool>,
) -> Result<Vec<FindingDraft>, String> {
    if run.scope.get("kind").and_then(Value::as_str) != Some("all_managed_file_library") {
        return Err("duplicate_detector_requires_global_scope".to_string());
    }
    let authority = db
        .get_dedupe_authority()
        .map_err(|error| error.to_string())?;
    if authority.status != "healthy" {
        return Err(format!("dedupe_authority_not_healthy:{}", authority.status));
    }
    let mut result = Vec::new();
    let mut cursor = None;
    loop {
        if cancel_flag.load(Ordering::Acquire)
            || db
                .is_analysis_cancel_requested(&run.id)
                .map_err(|error| error.to_string())?
        {
            return Err("analysis_cancelled".to_string());
        }
        let page = db
            .list_duplicate_groups(cursor.as_deref(), 200)
            .map_err(|error| error.to_string())?;
        for group in page.groups {
            result.push(duplicate_finding(db, &group)?);
        }
        cursor = page.next_cursor;
        if cursor.is_none() {
            break;
        }
    }
    Ok(result)
}

fn duplicate_finding(db: &Database, group: &DedupeGroupDto) -> Result<FindingDraft, String> {
    let finding_key = format!("duplicate-group:{}:v{}", group.id, DETECTOR_VERSION);
    let finding_id = deterministic_id("analysis-finding", &finding_key);
    let members = db
        .list_duplicate_group_members(&group.id)
        .map_err(|error| error.to_string())?;
    let evidence = members
        .iter()
        .map(duplicate_member_evidence)
        .collect::<Vec<_>>();
    let path = group.representative_paths.first().cloned();
    Ok(FindingDraft {
        id: finding_id,
        finding_key,
        detector_id: DUPLICATE_RECLAIMABLE_DETECTOR.to_string(),
        detector_version: DETECTOR_VERSION,
        tier: "review".to_string(),
        category: "duplicate_group".to_string(),
        action_kind: "review_duplicate_group".to_string(),
        title: "Duplicate files may be reclaimable".to_string(),
        reason: format!(
            "{} verified members share the same exact content.",
            group.member_count
        ),
        risk_note: Some("Duplicate groups are read-only findings; choose a keeper and use the existing preview/confirmation flow.".to_string()),
        confidence: group.reclaimable_confidence.clone(),
        size_bytes: group.size_each,
        exact_reclaimable_bytes: group.exact_reclaimable_bytes,
        potential_reclaimable_bytes: group.potential_reclaimable_bytes,
        requires_confirmation: true,
        executable: false,
        primary_subject_kind: "duplicate_group".to_string(),
        primary_subject_id: group.id.clone(),
        path_snapshot: path,
        identity_snapshot: json!({
            "groupId": group.id,
            "fullHash": group.full_hash,
            "memberCount": group.member_count,
            "revision": group.revision
        }),
        evidence_summary: json!({
            "memberCount": group.member_count,
            "physicalCopyCount": group.physical_copy_count,
            "hardlinkAliasCount": group.hardlink_alias_count
        }),
        evidence,
    })
}

fn duplicate_member_evidence(member: &DedupeGroupMemberDto) -> FindingEvidenceDraft {
    FindingEvidenceDraft {
        evidence_kind: "duplicate_member".to_string(),
        subject_kind: "managed_file".to_string(),
        subject_id: Some(member.file_id.clone()),
        path_snapshot: Some(member.path_snapshot.clone()),
        value: json!({
            "size": member.size,
            "physicalKey": member.physical_key,
            "identityStatus": member.identity_status,
            "hardlinkAlias": member.is_hardlink_alias,
            "modifiedNs": member.modified_ns,
            "verifiedAt": member.verified_at
        }),
    }
}

fn build_cleanup_findings(
    db: &Database,
    run: &AnalysisRunDto,
    cancel_flag: &Arc<AtomicBool>,
) -> Result<Vec<(String, FindingDraft)>, String> {
    if run.scope.get("kind").and_then(Value::as_str) == Some("all_managed_file_library") {
        return build_managed_large_file_findings(db, run, cancel_flag);
    }
    let paths = run
        .scope
        .get("paths")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(PathBuf::from)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    if paths.is_empty() {
        return Ok(Vec::new());
    }
    let analysis = storage_analyzer::analyze_storage_roots_with_progress(
        paths,
        Vec::new(),
        Some(Arc::clone(cancel_flag)),
        run.id.clone(),
        |_| {
            if cancel_flag.load(Ordering::Acquire)
                || db
                    .is_analysis_cancel_requested(&run.id)
                    .map_err(|error| error.to_string())?
            {
                Err("analysis_cancelled".to_string())
            } else {
                Ok(())
            }
        },
    )?;
    if cancel_flag.load(Ordering::Acquire)
        || db
            .is_analysis_cancel_requested(&run.id)
            .map_err(|error| error.to_string())?
    {
        return Err("analysis_cancelled".to_string());
    }
    let candidates = analysis.candidates;
    let mut result = Vec::new();
    for candidate in &candidates {
        if cancel_flag.load(Ordering::Acquire)
            || db
                .is_analysis_cancel_requested(&run.id)
                .map_err(|error| error.to_string())?
        {
            return Err("analysis_cancelled".to_string());
        }
        let metadata = fs::symlink_metadata(&candidate.path).ok();
        let is_dir = metadata.as_ref().is_some_and(fs::Metadata::is_dir);
        let detector_id = if is_dir && candidate.size >= LARGE_DIRECTORY_THRESHOLD {
            if has_large_directory_ancestor(&candidate.path, &candidates) {
                continue;
            }
            LARGE_DIRECTORY_DETECTOR
        } else if !is_dir && candidate.size >= LARGE_FILE_THRESHOLD {
            LARGE_FILE_DETECTOR
        } else {
            CLEANUP_HEURISTICS_DETECTOR
        };
        let finding = cleanup_finding(detector_id, candidate, metadata.as_ref())?;
        result.push((detector_id.to_string(), finding));
    }
    Ok(result)
}

fn build_managed_large_file_findings(
    db: &Database,
    run: &AnalysisRunDto,
    cancel_flag: &Arc<AtomicBool>,
) -> Result<Vec<(String, FindingDraft)>, String> {
    let root_ids = run
        .scope
        .get("rootIds")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let files = db
        .list_managed_files_for_analysis(&root_ids, LARGE_FILE_THRESHOLD as i64)
        .map_err(|error| error.to_string())?;
    files
        .into_iter()
        .map(|(path, size)| {
            if cancel_flag.load(Ordering::Acquire) {
                return Err("analysis_cancelled".to_string());
            }
            let metadata = fs::symlink_metadata(&path).ok();
            let name = Path::new(&path)
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or(&path)
                .to_string();
            let candidate = StorageCandidate {
                id: String::new(),
                path: path.clone(),
                name,
                size: size.max(0) as u64,
                tier: CleanupTier::Review,
                category: "large_file".to_string(),
                reason: format!("Managed file is larger than {} bytes.", size.max(0)),
                suggested_action: CleanupActionKind::Reveal,
                risk_note: Some("Large files are review-only; the analysis detector never moves or deletes them.".to_string()),
                trash_allowed: false,
                selected_by_default: false,
            };
            cleanup_finding(LARGE_FILE_DETECTOR, &candidate, metadata.as_ref())
                .map(|finding| (LARGE_FILE_DETECTOR.to_string(), finding))
        })
        .collect()
}

fn has_large_directory_ancestor(path: &str, candidates: &[StorageCandidate]) -> bool {
    candidates.iter().any(|candidate| {
        candidate.path != path
            && candidate.size >= LARGE_DIRECTORY_THRESHOLD
            && fs::symlink_metadata(&candidate.path)
                .ok()
                .is_some_and(|metadata| metadata.is_dir())
            && is_same_or_child(path, &candidate.path)
    })
}

fn cleanup_finding(
    detector_id: &str,
    candidate: &StorageCandidate,
    metadata: Option<&fs::Metadata>,
) -> Result<FindingDraft, String> {
    let identity = candidate_identity(&candidate.path, candidate.size, metadata);
    let identity_hash = blake3::hash(
        serde_json::to_string(&identity)
            .unwrap_or_default()
            .as_bytes(),
    )
    .to_hex()
    .to_string();
    let finding_key = format!(
        "{detector_id}:{}:{}",
        normalize_path_text(&candidate.path),
        identity_hash
    );
    let action_kind = match candidate.suggested_action {
        CleanupActionKind::MoveToTrash => "safe_trash_candidate",
        CleanupActionKind::Reveal => "reveal",
        CleanupActionKind::UninstallAdvice => "uninstall_advice",
        CleanupActionKind::AppInternalCleanup => "app_internal_cleanup",
        CleanupActionKind::None => "none",
    };
    let tier = match candidate.tier {
        CleanupTier::Safe => "safe",
        CleanupTier::Review => "review",
        CleanupTier::Caution => "caution",
    };
    let executable =
        tier == "safe" && candidate.trash_allowed && action_kind == "safe_trash_candidate";
    let exact = executable.then_some(candidate.size as i64);
    Ok(FindingDraft {
        id: deterministic_id("analysis-finding", &finding_key),
        finding_key,
        detector_id: detector_id.to_string(),
        detector_version: DETECTOR_VERSION,
        tier: tier.to_string(),
        category: candidate.category.clone(),
        action_kind: action_kind.to_string(),
        title: candidate.name.clone(),
        reason: candidate.reason.clone(),
        risk_note: candidate.risk_note.clone(),
        confidence: if tier == "safe" { "exact" } else { "estimated" }.to_string(),
        size_bytes: candidate.size as i64,
        exact_reclaimable_bytes: exact,
        potential_reclaimable_bytes: candidate.size as i64,
        requires_confirmation: true,
        executable,
        primary_subject_kind: "approved_path".to_string(),
        primary_subject_id: normalize_path_text(&candidate.path),
        path_snapshot: Some(normalize_path_text(&candidate.path)),
        identity_snapshot: identity.clone(),
        evidence_summary: json!({
            "category": candidate.category,
            "trashAllowed": candidate.trash_allowed,
            "selectedByDefault": candidate.selected_by_default
        }),
        evidence: vec![FindingEvidenceDraft {
            evidence_kind: "path_identity".to_string(),
            subject_kind: "approved_path".to_string(),
            subject_id: Some(normalize_path_text(&candidate.path)),
            path_snapshot: Some(normalize_path_text(&candidate.path)),
            value: json!({
                "size": candidate.size,
                "isDirectory": metadata.is_some_and(fs::Metadata::is_dir),
                "identity": identity
            }),
        }],
    })
}

pub(crate) fn candidate_identity(
    path: &str,
    candidate_size: u64,
    metadata: Option<&fs::Metadata>,
) -> Value {
    let modified_ns = metadata
        .and_then(|item| item.modified().ok())
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .and_then(|duration| i64::try_from(duration.as_nanos()).ok());
    let physical = if metadata.is_some_and(fs::Metadata::is_file) {
        capture_physical_identity(Path::new(path))
            .ok()
            .map(|identity| {
                json!({
                    "physicalKey": identity.physical_key,
                    "platformFileId": identity.platform_file_id,
                    "platformVolumeId": identity.platform_volume_id,
                    "modifiedNs": identity.modified_ns
                })
            })
    } else {
        None
    };
    json!({
        "path": normalize_path_text(path),
        "size": candidate_size,
        "modifiedNs": modified_ns,
        "physical": physical
    })
}

pub(crate) fn finding_identity_matches(finding: &AnalysisFindingDto) -> bool {
    let Some(path) = finding.path_snapshot.as_deref() else {
        return true;
    };
    let Ok(metadata) = fs::symlink_metadata(path) else {
        return false;
    };
    let Some(size) = finding
        .identity_snapshot
        .get("size")
        .and_then(Value::as_u64)
    else {
        return false;
    };
    let size_matches = metadata.is_dir() || metadata.len() == size;
    size_matches && candidate_identity(path, size, Some(&metadata)) == finding.identity_snapshot
}

fn deterministic_id(prefix: &str, value: &str) -> String {
    let digest = blake3::hash(value.as_bytes()).to_hex().to_string();
    format!("{prefix}-{}", &digest[..40])
}

fn normalize_path_text(path: &str) -> String {
    path.replace('\\', "/")
}

fn is_same_or_child(path: &str, parent: &str) -> bool {
    let path = normalize_path_text(path).trim_end_matches('/').to_string();
    let parent = normalize_path_text(parent)
        .trim_end_matches('/')
        .to_string();
    path == parent || path.starts_with(&format!("{parent}/"))
}

fn emit_run<R: Runtime>(app: &AppHandle<R>, run: &AnalysisRunDto) {
    if let Err(error) = app.emit(ANALYSIS_RUN_UPDATED_EVENT, run.clone()) {
        eprintln!("Analysis run event failed: {error}");
    }
}

fn emit_detector<R: Runtime>(app: &AppHandle<R>, detector: &AnalysisDetectorDto) {
    if let Err(error) = app.emit(ANALYSIS_DETECTOR_UPDATED_EVENT, detector.clone()) {
        eprintln!("Analysis detector event failed: {error}");
    }
}
