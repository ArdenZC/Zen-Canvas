//! W3-10 Phase A Preview performance evidence.
//!
//! This module deliberately stays in the existing File Workspace performance
//! test binary. It drives the real Browse -> PreviewSession -> Read Gate ->
//! provider path and observes existing scheduler/registry counters; it does
//! not add a production provider, cache, scheduler or telemetry authority.

use super::{
    fixture::{PreviewFixtureSpec, WorkspaceFixture, PREVIEW_FIXTURE_SPECS},
    harness::{open_fixture, runtime_for},
    metrics, resources,
};
use crate::{
    file_workspace::{
        contracts::{PreviewHostKind, PreviewSourceRef},
        integration::{
            types::{
                BrowseEntryDto, BrowseEntryKindDto, BrowseNextPageRequest, BrowseOpenResponse,
                BrowseStartEnumerationRequest, PreviewCreateRequest, PreviewSessionRequest,
                PreviewSessionStateDto, PreviewSnapshotDto, PreviewSwitchSourceRequest,
            },
            FileWorkspaceRuntime,
        },
        preview::{
            PreparedPreview, PreviewCapabilities, PreviewCompleteness, PreviewHost,
            PreviewMetadata, PreviewOperationContext, PreviewProvider, PreviewProviderDescriptor,
            PreviewProviderEnvironment, PreviewProviderError, PreviewProviderRegistry,
            PreviewProviderResult, PreviewRepresentation, PreviewRequest, PreviewSession,
            PreviewSessionConfig, PreviewSourceSnapshot, ProviderProbe, SourceResolveError,
            SourceResolver,
        },
    },
    scheduler::SchedulerSnapshot,
};
use serde_json::{json, Value};
use std::{
    collections::BTreeMap,
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc,
    },
    thread,
    time::{Duration, Instant},
};

const RAPID_SWITCH_FIXTURE_ENTRIES: usize = metrics::PREVIEW_RAPID_SWITCH_ENTRIES;
const STEADY_STATE_CYCLES: usize = 100;

fn fixture_sources(
    runtime: &FileWorkspaceRuntime,
    fixture: &WorkspaceFixture,
    display_hint: &str,
) -> (
    BrowseOpenResponse,
    BTreeMap<&'static str, (PreviewFixtureSpec, PreviewSourceRef)>,
    Vec<PreviewSourceRef>,
) {
    let opened = open_fixture(runtime, fixture, display_hint);
    let mut page = runtime
        .start_enumeration(BrowseStartEnumerationRequest {
            session_id: opened.session_id.clone(),
            request_id: format!("{display_hint}-enumeration"),
            path_ref: opened.root_path_ref.clone(),
            page_size: 256,
            query: Default::default(),
        })
        .expect("enumerate Preview Phase A fixture");
    let mut entries = std::mem::take(&mut page.entries);
    let mut cursor = page.next_cursor.take();
    while let Some(next_cursor) = cursor {
        page = runtime
            .next_page(BrowseNextPageRequest {
                session_id: opened.session_id.clone(),
                cursor: next_cursor,
                page_size: 256,
            })
            .expect("continue Preview Phase A fixture enumeration");
        entries.append(&mut page.entries);
        cursor = page.next_cursor.take();
    }

    let mut matrix = BTreeMap::new();
    for spec in PREVIEW_FIXTURE_SPECS.iter().copied() {
        let entry = entries
            .iter()
            .find(|entry| entry.kind == BrowseEntryKindDto::File && entry.name == spec.file_name)
            .unwrap_or_else(|| panic!("Preview fixture entry is missing: {}", spec.file_name));
        matrix.insert(spec.id, (spec, source_from_entry(entry)));
    }

    let mut rapid_sources = entries
        .iter()
        .filter(|entry| entry.kind == BrowseEntryKindDto::File && entry.name.starts_with("rapid-"))
        .map(|entry| {
            let index = entry
                .name
                .strip_prefix("rapid-")
                .and_then(|value| value.strip_suffix(".txt"))
                .and_then(|value| value.parse::<usize>().ok())
                .expect("rapid fixture entry has a numeric name");
            (index, source_from_entry(entry))
        })
        .collect::<Vec<_>>();
    rapid_sources.sort_by_key(|(index, _)| *index);
    let rapid_sources = rapid_sources
        .into_iter()
        .map(|(_, source)| source)
        .collect::<Vec<_>>();
    assert_eq!(
        rapid_sources.len(),
        RAPID_SWITCH_FIXTURE_ENTRIES,
        "rapid-switch fixture must expose exactly 100 opaque source entries"
    );
    (opened, matrix, rapid_sources)
}

fn source_from_entry(entry: &BrowseEntryDto) -> PreviewSourceRef {
    match &entry.entry_ref {
        crate::file_workspace::BrowseEntryRef::Ephemeral {
            browse_session_id,
            entry_id,
        } => PreviewSourceRef::Ephemeral {
            browse_session_id: browse_session_id.clone(),
            entry_id: entry_id.clone(),
        },
    }
}

fn create_preview(
    runtime: &FileWorkspaceRuntime,
    source: PreviewSourceRef,
    request_id: impl Into<String>,
) -> PreviewSnapshotDto {
    runtime
        .create_preview(PreviewCreateRequest {
            request_id: request_id.into(),
            source,
            host_kind: PreviewHostKind::ZenFloating,
        })
        .expect("create Preview Phase A session")
}

fn start_preview(runtime: &FileWorkspaceRuntime, preview_id: &str) -> PreviewSnapshotDto {
    runtime
        .start_preview(PreviewSessionRequest {
            preview_id: preview_id.to_string(),
        })
        .expect("start Preview Phase A session")
}

fn dispose_preview(runtime: &FileWorkspaceRuntime, preview_id: String) {
    runtime
        .dispose_preview(PreviewSessionRequest { preview_id })
        .expect("dispose Preview Phase A session");
}

fn family_name(representation: &PreviewRepresentation) -> &'static str {
    match representation {
        PreviewRepresentation::Metadata { .. } => "metadata",
        PreviewRepresentation::Text { .. } => "text",
        PreviewRepresentation::SafeHtml { .. } => "safe_html",
        PreviewRepresentation::StructuredTree { .. } => "structured_tree",
        PreviewRepresentation::Table { .. } => "table",
        PreviewRepresentation::Image { .. } => "image",
        PreviewRepresentation::Media { .. } => "media",
        PreviewRepresentation::FolderSummary { .. } => "folder_summary",
        PreviewRepresentation::ArchiveTree { .. } => "archive_tree",
        PreviewRepresentation::NativeOpaque { .. } => "native_opaque",
    }
}

fn assert_useful_representation(snapshot: &PreviewSnapshotDto, spec: &PreviewFixtureSpec) {
    assert_eq!(snapshot.state, PreviewSessionStateDto::Ready);
    let envelope = snapshot
        .representation
        .as_ref()
        .expect("Preview provider must publish a representation");
    let family = family_name(&envelope.representation);
    assert_eq!(
        family, spec.representation_family,
        "fixture {} published the wrong representation family",
        spec.id
    );
    assert_eq!(
        snapshot.active_provider_id.as_deref(),
        Some(spec.provider_id),
        "fixture {} selected the wrong provider",
        spec.id
    );
    assert_ne!(
        envelope.completeness,
        PreviewCompleteness::Unknown,
        "fixture {} did not publish useful completeness",
        spec.id
    );
}

fn phase_a_fields() -> Vec<(String, Value)> {
    vec![
        (
            "metric_definition".to_string(),
            json!(metrics::PREVIEW_METRIC_DEFINITION),
        ),
        (
            "fixture_manifest".to_string(),
            json!(metrics::PREVIEW_FIXTURE_MANIFEST),
        ),
        ("phase".to_string(), json!("A")),
        (
            "profile".to_string(),
            json!(std::env::var("ZC_PERFORMANCE_PROFILE").unwrap_or_else(|_| "release".into())),
        ),
        ("fixture_root_scope".to_string(), json!("repository-local")),
    ]
}

fn append_timing_fields(
    fields: &mut Vec<(String, Value)>,
    samples: &[Duration],
    warmup_count: usize,
    target_p95_ms: Option<f64>,
    measurement_boundary: &str,
) {
    fields.extend(metrics::timing_fields(
        samples,
        warmup_count,
        target_p95_ms,
        measurement_boundary,
    ));
}

#[test]
#[ignore = "W3-10 Phase A Preview shell timing preparation"]
fn preview_shell_first_visible() {
    let fixture = WorkspaceFixture::preview("preview-shell", RAPID_SWITCH_FIXTURE_ENTRIES);
    let runtime = runtime_for(&fixture);
    let (opened, matrix, _) = fixture_sources(&runtime, &fixture, "preview-shell");
    let source = matrix
        .get("text-normal")
        .expect("normal text fixture")
        .1
        .clone();
    let total_samples = metrics::PREVIEW_WARMUP_SAMPLES + metrics::PREVIEW_TIMING_SAMPLES;
    let mut samples = Vec::with_capacity(metrics::PREVIEW_TIMING_SAMPLES);
    for index in 0..total_samples {
        let started = Instant::now();
        let preview = create_preview(&runtime, source.clone(), format!("shell-{index}"));
        let elapsed = started.elapsed();
        let snapshot = runtime
            .snapshot_preview(PreviewSessionRequest {
                preview_id: preview.preview_id.clone(),
            })
            .expect("snapshot created Preview shell");
        assert_eq!(snapshot.state, PreviewSessionStateDto::Idle);
        assert!(snapshot.representation.is_none());
        if index >= metrics::PREVIEW_WARMUP_SAMPLES {
            samples.push(elapsed);
        }
        dispose_preview(&runtime, preview.preview_id);
    }

    let mut fields = phase_a_fields();
    append_timing_fields(
        &mut fields,
        &samples,
        metrics::PREVIEW_WARMUP_SAMPLES,
        Some(metrics::PREVIEW_SHELL_FIRST_VISIBLE_TARGET_P95_MS),
        "backend_preview_create_return",
    );
    fields.extend([
        ("source_kind".to_string(), json!("warm_local_browse")),
        ("shell_state".to_string(), json!("idle")),
        ("provider_completion_included".to_string(), json!(false)),
        ("actual_dom_visibility_measured".to_string(), json!(false)),
        (
            "evidence_scope".to_string(),
            json!("Phase A backend shell-creation proxy; browser helper owns DOM visibility measurement"),
        ),
    ]);
    metrics::emit_metric("preview_shell_first_visible", metrics::OBSERVED, fields);

    runtime
        .dispose_browse(
            crate::file_workspace::integration::types::BrowseSessionRequest {
                session_id: opened.session_id,
            },
        )
        .expect("dispose shell measurement Browse session");
    assert!(runtime.dispose());
}

#[test]
#[ignore = "W3-10 Phase A Preview provider useful-representation timing preparation"]
fn preview_provider_useful_representation() {
    let fixture = WorkspaceFixture::preview("preview-providers", RAPID_SWITCH_FIXTURE_ENTRIES);
    let runtime = runtime_for(&fixture);
    let (opened, matrix, _) = fixture_sources(&runtime, &fixture, "preview-providers");
    let normal_specs = PREVIEW_FIXTURE_SPECS
        .iter()
        .copied()
        .filter(|spec| spec.fixture_class == "normal")
        .collect::<Vec<_>>();

    for spec in normal_specs {
        let source = matrix
            .get(spec.id)
            .expect("normal Preview fixture source")
            .1
            .clone();
        let mut samples = Vec::with_capacity(metrics::PREVIEW_TIMING_SAMPLES);
        for index in 0..(metrics::PREVIEW_WARMUP_SAMPLES + metrics::PREVIEW_TIMING_SAMPLES) {
            let preview = create_preview(
                &runtime,
                source.clone(),
                format!("useful-{}-{index}", spec.id),
            );
            let started = Instant::now();
            let snapshot = start_preview(&runtime, &preview.preview_id);
            let elapsed = started.elapsed();
            assert_useful_representation(&snapshot, &spec);
            if index >= metrics::PREVIEW_WARMUP_SAMPLES {
                samples.push(elapsed);
            }
            dispose_preview(&runtime, preview.preview_id);
        }

        let mut fields = phase_a_fields();
        append_timing_fields(
            &mut fields,
            &samples,
            metrics::PREVIEW_WARMUP_SAMPLES,
            Some(metrics::PREVIEW_USEFUL_REPRESENTATION_TARGET_P95_MS),
            "backend_preview_start_return",
        );
        fields.extend([
            ("fixture_id".to_string(), json!(spec.id)),
            ("provider_id".to_string(), json!(spec.provider_id)),
            (
                "representation_family".to_string(),
                json!(spec.representation_family),
            ),
            ("fixture_class".to_string(), json!(spec.fixture_class)),
            ("setup_included".to_string(), json!(false)),
            ("useful_representation_observed".to_string(), json!(true)),
        ]);
        metrics::emit_metric(
            "preview_provider_useful_representation",
            metrics::OBSERVED,
            fields,
        );
    }

    let mut native_fields = phase_a_fields();
    native_fields.extend([
        (
            "target_p95_ms".to_string(),
            json!(metrics::PREVIEW_NATIVE_USEFUL_REPRESENTATION_TARGET_P95_MS),
        ),
        ("applicable".to_string(), json!(false)),
        (
            "reason".to_string(),
            json!("W3-10 Phase A exercises Zen hosts and no native provider family"),
        ),
    ]);
    metrics::emit_metric(
        "preview_native_useful_representation",
        metrics::OBSERVED,
        native_fields,
    );

    assert_eq!(runtime.inner.read_gate.active_lease_count(), 0);
    assert_eq!(runtime.inner.preview_assets.counts().0, 0);
    runtime
        .dispose_browse(
            crate::file_workspace::integration::types::BrowseSessionRequest {
                session_id: opened.session_id,
            },
        )
        .expect("dispose provider measurement Browse session");
    assert!(runtime.dispose());
}

#[test]
#[ignore = "W3-10 Phase A deterministic 100-entry rapid-switch runtime evidence"]
fn preview_rapid_switch_100() {
    let fixture = WorkspaceFixture::preview("preview-rapid-switch", RAPID_SWITCH_FIXTURE_ENTRIES);
    let runtime = runtime_for(&fixture);
    let (opened, _matrix, rapid_sources) =
        fixture_sources(&runtime, &fixture, "preview-rapid-switch");
    let initial = create_preview(&runtime, rapid_sources[0].clone(), "rapid-initial");
    let initial_snapshot = start_preview(&runtime, &initial.preview_id);
    assert_eq!(initial_snapshot.state, PreviewSessionStateDto::Ready);

    let mut switch_samples = Vec::with_capacity(RAPID_SWITCH_FIXTURE_ENTRIES);
    let mut max_runtime_counts = runtime.resource_counts();
    let mut max_scheduler = runtime.inner.scheduler.snapshot();
    let mut max_asset_count = runtime.inner.preview_assets.counts().0;
    let mut max_read_leases = runtime.inner.read_gate.active_lease_count();

    for index in 0..RAPID_SWITCH_FIXTURE_ENTRIES {
        let source_index = (index + 1) % rapid_sources.len();
        let source = rapid_sources[source_index].clone();
        let started = Instant::now();
        let switched = runtime
            .switch_preview_source(PreviewSwitchSourceRequest {
                preview_id: initial.preview_id.clone(),
                request_id: format!("rapid-switch-{index:03}"),
                source: source.clone(),
            })
            .expect("switch Preview source");
        assert_eq!(switched.state, PreviewSessionStateDto::Resolving);
        assert_eq!(switched.source, source);
        assert!(switched.representation.is_none());

        let settled = start_preview(&runtime, &initial.preview_id);
        switch_samples.push(started.elapsed());
        assert_eq!(settled.state, PreviewSessionStateDto::Ready);
        assert_eq!(settled.source, source);
        assert_eq!(settled.active_provider_id.as_deref(), Some("builtin.text"));
        match settled
            .representation
            .as_ref()
            .map(|envelope| &envelope.representation)
        {
            Some(PreviewRepresentation::Text { text, .. }) => {
                assert!(text.contains(&source_index.to_string()));
            }
            other => panic!("rapid switch published wrong final representation: {other:?}"),
        }

        max_runtime_counts = max_resource_counts(max_runtime_counts, runtime.resource_counts());
        max_scheduler = max_scheduler_snapshot(max_scheduler, runtime.inner.scheduler.snapshot());
        max_asset_count = max_asset_count.max(runtime.inner.preview_assets.counts().0);
        max_read_leases = max_read_leases.max(runtime.inner.read_gate.active_lease_count());
        assert!(runtime.resource_counts().preview_sessions <= 1);
    }

    dispose_preview(&runtime, initial.preview_id);
    assert_eq!(runtime.inner.read_gate.active_lease_count(), 0);
    assert_eq!(runtime.inner.preview_assets.counts(), (0, 0));
    let after = runtime.resource_counts();
    assert_eq!(after.preview_sessions, 0);
    assert_eq!(after.browse_sessions, 1);
    assert_eq!(after.browse_service_sessions, 1);

    let mut fields = phase_a_fields();
    append_timing_fields(
        &mut fields,
        &switch_samples,
        0,
        None,
        "backend_preview_switch_and_start_return",
    );
    fields.extend([
        (
            "switch_count".to_string(),
            json!(RAPID_SWITCH_FIXTURE_ENTRIES),
        ),
        (
            "max_preview_sessions".to_string(),
            json!(max_runtime_counts.preview_sessions),
        ),
        (
            "max_scheduler_running".to_string(),
            json!(max_scheduler.running),
        ),
        (
            "max_scheduler_queued".to_string(),
            json!(max_scheduler.queued),
        ),
        ("max_asset_entries".to_string(), json!(max_asset_count)),
        ("max_read_leases".to_string(), json!(max_read_leases)),
        ("stale_final_representation".to_string(), json!(false)),
        ("duplicate_preview_host".to_string(), json!(false)),
        ("final_source_matches_last_switch".to_string(), json!(true)),
        (
            "fixture_sequence".to_string(),
            json!("rapid-000..rapid-099"),
        ),
    ]);
    metrics::emit_metric("preview_rapid_switch_100", metrics::HARD_PASS, fields);

    runtime
        .dispose_browse(
            crate::file_workspace::integration::types::BrowseSessionRequest {
                session_id: opened.session_id,
            },
        )
        .expect("dispose rapid-switch Browse session");
    assert!(runtime.dispose());
}

#[test]
#[ignore = "W3-10 Phase A repeated-cycle Preview resource instrumentation"]
fn preview_repeated_cycle_steady_state() {
    let fixture = WorkspaceFixture::preview("preview-steady-state", RAPID_SWITCH_FIXTURE_ENTRIES);
    let runtime = runtime_for(&fixture);
    let (opened, matrix, _) = fixture_sources(&runtime, &fixture, "preview-steady-state");
    let cycle_specs = PREVIEW_FIXTURE_SPECS
        .iter()
        .copied()
        .filter(|spec| spec.fixture_class == "normal")
        .collect::<Vec<_>>();
    let baseline_runtime = runtime.resource_counts();
    let baseline_scheduler = runtime.inner.scheduler.snapshot();
    let baseline_leases = runtime.inner.read_gate.active_lease_count();
    let baseline_assets = runtime.inner.preview_assets.counts();
    let baseline_process = resources::snapshot();
    let mut peak_process = baseline_process;
    let mut peak_runtime = baseline_runtime;
    let mut peak_scheduler = baseline_scheduler;
    let mut peak_leases = baseline_leases;
    let mut peak_assets = baseline_assets;
    let mut epoch_process = Vec::with_capacity(STEADY_STATE_CYCLES / 20);

    for index in 0..STEADY_STATE_CYCLES {
        let spec = cycle_specs[index % cycle_specs.len()];
        let source = matrix
            .get(spec.id)
            .expect("steady-state fixture source")
            .1
            .clone();
        let preview = create_preview(&runtime, source, format!("steady-{index:03}"));
        let settled = start_preview(&runtime, &preview.preview_id);
        assert_useful_representation(&settled, &spec);
        dispose_preview(&runtime, preview.preview_id);

        let counts = runtime.resource_counts();
        let scheduler = runtime.inner.scheduler.snapshot();
        let assets = runtime.inner.preview_assets.counts();
        let leases = runtime.inner.read_gate.active_lease_count();
        assert_eq!(counts.preview_sessions, baseline_runtime.preview_sessions);
        assert_eq!(assets, baseline_assets);
        assert_eq!(leases, baseline_leases);
        assert_eq!(scheduler.running, baseline_scheduler.running);
        assert_eq!(scheduler.queued, baseline_scheduler.queued);
        peak_runtime = max_resource_counts(peak_runtime, counts);
        peak_scheduler = max_scheduler_snapshot(peak_scheduler, scheduler);
        peak_leases = peak_leases.max(leases);
        peak_assets = (peak_assets.0.max(assets.0), peak_assets.1.max(assets.1));
        peak_process = peak_process.max(resources::snapshot());
        if (index + 1) % 20 == 0 {
            resources::settle_allocator();
            epoch_process.push(resources::snapshot());
        }
    }

    resources::settle_allocator();
    let after_process = resources::snapshot();
    let after_runtime = runtime.resource_counts();
    let after_scheduler = runtime.inner.scheduler.snapshot();
    let after_assets = runtime.inner.preview_assets.counts();
    let after_leases = runtime.inner.read_gate.active_lease_count();
    assert_eq!(
        after_runtime.preview_sessions,
        baseline_runtime.preview_sessions
    );
    assert_eq!(after_scheduler.running, baseline_scheduler.running);
    assert_eq!(after_scheduler.queued, baseline_scheduler.queued);
    assert_eq!(after_assets, baseline_assets);
    assert_eq!(after_leases, baseline_leases);

    let mut fields = phase_a_fields();
    fields.extend([
        ("cycle_count".to_string(), json!(STEADY_STATE_CYCLES)),
        (
            "baseline_preview_sessions".to_string(),
            json!(baseline_runtime.preview_sessions),
        ),
        (
            "peak_preview_sessions".to_string(),
            json!(peak_runtime.preview_sessions),
        ),
        (
            "after_preview_sessions".to_string(),
            json!(after_runtime.preview_sessions),
        ),
        ("baseline_read_leases".to_string(), json!(baseline_leases)),
        ("peak_read_leases".to_string(), json!(peak_leases)),
        ("after_read_leases".to_string(), json!(after_leases)),
        (
            "baseline_asset_entries".to_string(),
            json!(baseline_assets.0),
        ),
        ("peak_asset_entries".to_string(), json!(peak_assets.0)),
        ("after_asset_entries".to_string(), json!(after_assets.0)),
        (
            "baseline_scheduler_running".to_string(),
            json!(baseline_scheduler.running),
        ),
        (
            "peak_scheduler_running".to_string(),
            json!(peak_scheduler.running),
        ),
        (
            "after_scheduler_running".to_string(),
            json!(after_scheduler.running),
        ),
        (
            "baseline_scheduler_queued".to_string(),
            json!(baseline_scheduler.queued),
        ),
        (
            "peak_scheduler_queued".to_string(),
            json!(peak_scheduler.queued),
        ),
        (
            "after_scheduler_queued".to_string(),
            json!(after_scheduler.queued),
        ),
        (
            "baseline_rss_bytes".to_string(),
            json!(baseline_process.rss_bytes),
        ),
        ("peak_rss_bytes".to_string(), json!(peak_process.rss_bytes)),
        (
            "after_rss_bytes".to_string(),
            json!(after_process.rss_bytes),
        ),
        (
            "baseline_private_committed_bytes".to_string(),
            json!(baseline_process.private_committed_bytes),
        ),
        (
            "peak_private_committed_bytes".to_string(),
            json!(peak_process.private_committed_bytes),
        ),
        (
            "after_private_committed_bytes".to_string(),
            json!(after_process.private_committed_bytes),
        ),
        ("epoch_process_samples".to_string(), json!(epoch_process)),
        (
            "os_resource_classification".to_string(),
            json!("observational; internal registry counters are the hard bounded gate"),
        ),
    ]);
    metrics::emit_metric("preview_resource_observations", metrics::OBSERVED, fields);

    let mut steady_fields = phase_a_fields();
    steady_fields.extend([
        ("cycle_count".to_string(), json!(STEADY_STATE_CYCLES)),
        (
            "preview_sessions".to_string(),
            json!(after_runtime.preview_sessions),
        ),
        ("read_leases".to_string(), json!(after_leases)),
        ("asset_entries".to_string(), json!(after_assets.0)),
        (
            "scheduler_running".to_string(),
            json!(after_scheduler.running),
        ),
        (
            "scheduler_queued".to_string(),
            json!(after_scheduler.queued),
        ),
        (
            "internal_counters_returned_to_baseline".to_string(),
            json!(true),
        ),
        ("process_rss_hard_bound".to_string(), json!(false)),
    ]);
    metrics::emit_metric(
        "preview_resource_steady_state",
        metrics::HARD_PASS,
        steady_fields,
    );

    runtime
        .dispose_browse(
            crate::file_workspace::integration::types::BrowseSessionRequest {
                session_id: opened.session_id,
            },
        )
        .expect("dispose steady-state Browse session");
    assert!(runtime.dispose());
}

fn max_resource_counts(
    left: crate::file_workspace::integration::runtime::ResourceCounts,
    right: crate::file_workspace::integration::runtime::ResourceCounts,
) -> crate::file_workspace::integration::runtime::ResourceCounts {
    crate::file_workspace::integration::runtime::ResourceCounts {
        browse_sessions: left.browse_sessions.max(right.browse_sessions),
        change_monitors: left.change_monitors.max(right.change_monitors),
        thumbnail_requests: left.thumbnail_requests.max(right.thumbnail_requests),
        preview_sessions: left.preview_sessions.max(right.preview_sessions),
        browse_service_sessions: left
            .browse_service_sessions
            .max(right.browse_service_sessions),
        browse_entry_refs: left.browse_entry_refs.max(right.browse_entry_refs),
        browse_path_refs: left.browse_path_refs.max(right.browse_path_refs),
        browse_active_enumerations: left
            .browse_active_enumerations
            .max(right.browse_active_enumerations),
    }
}

fn max_scheduler_snapshot(left: SchedulerSnapshot, right: SchedulerSnapshot) -> SchedulerSnapshot {
    SchedulerSnapshot {
        queued: left.queued.max(right.queued),
        running: left.running.max(right.running),
        queued_foreground: left.queued_foreground.max(right.queued_foreground),
        queued_interactive: left.queued_interactive.max(right.queued_interactive),
        queued_background: left.queued_background.max(right.queued_background),
        running_foreground: left.running_foreground.max(right.running_foreground),
        running_interactive: left.running_interactive.max(right.running_interactive),
        running_background: left.running_background.max(right.running_background),
        granted: left.granted,
        available: left.available,
        total_grants: left.total_grants.max(right.total_grants),
        total_releases: left.total_releases.max(right.total_releases),
        total_cancellations: left.total_cancellations.max(right.total_cancellations),
        total_rejections: left.total_rejections.max(right.total_rejections),
    }
}

struct DeferredResolver;

impl SourceResolver for DeferredResolver {
    fn resolve(
        &self,
        request: &crate::file_workspace::preview::PreviewResolveRequest,
        _context: &PreviewOperationContext,
    ) -> Result<PreviewSourceSnapshot, SourceResolveError> {
        Ok(PreviewSourceSnapshot::new(
            request.source.clone(),
            request.request_id.clone(),
            PreviewMetadata {
                display_name: request.request_id.clone(),
                media_type: Some("text/plain".to_string()),
                extension: Some("txt".to_string()),
                size_bytes: Some(32),
                modified_at_epoch_ms: None,
                materialization: crate::file_workspace::contracts::MaterializationState::Local,
                read_eligibility:
                    crate::file_workspace::contracts::ContentReadEligibility::Eligible,
            },
            PreviewCapabilities::all(),
        ))
    }
}

struct DeferredProvider {
    descriptor: PreviewProviderDescriptor,
    started: Arc<AtomicUsize>,
    release: Arc<AtomicBool>,
    cleaned: Arc<AtomicUsize>,
}

struct DeferredPreparedPreview {
    source_version: String,
    started: Arc<AtomicUsize>,
    release: Arc<AtomicBool>,
    cleaned: Arc<AtomicUsize>,
}

impl PreviewProvider for DeferredProvider {
    fn descriptor(&self) -> &PreviewProviderDescriptor {
        &self.descriptor
    }

    fn probe(
        &self,
        _snapshot: &PreviewSourceSnapshot,
        _context: &PreviewOperationContext,
    ) -> ProviderProbe {
        ProviderProbe::Compatible
    }

    fn prepare(
        &self,
        snapshot: &PreviewSourceSnapshot,
        _context: &PreviewOperationContext,
    ) -> Result<Box<dyn PreparedPreview>, PreviewProviderError> {
        Ok(Box::new(DeferredPreparedPreview {
            source_version: snapshot.source_version.clone(),
            started: Arc::clone(&self.started),
            release: Arc::clone(&self.release),
            cleaned: Arc::clone(&self.cleaned),
        }))
    }
}

impl PreparedPreview for DeferredPreparedPreview {
    fn load(
        &mut self,
        context: &PreviewOperationContext,
        _environment: PreviewProviderEnvironment<'_>,
    ) -> Result<PreviewProviderResult, PreviewProviderError> {
        self.started.fetch_add(1, Ordering::AcqRel);
        while !self.release.load(Ordering::Acquire) {
            context
                .ensure_active()
                .map_err(|_| PreviewProviderError::Cancelled)?;
            thread::yield_now();
        }
        context
            .ensure_active()
            .map_err(|_| PreviewProviderError::Cancelled)?;
        Ok(PreviewProviderResult {
            representation: PreviewRepresentation::Text {
                text: self.source_version.clone(),
                language: None,
            },
            completeness: PreviewCompleteness::Complete,
            warnings: Vec::new(),
        })
    }

    fn cleanup(&mut self) {
        self.cleaned.fetch_add(1, Ordering::AcqRel);
    }
}

fn wait_for_count(counter: &AtomicUsize, expected: usize) {
    let deadline = Instant::now() + Duration::from_secs(2);
    while counter.load(Ordering::Acquire) < expected {
        assert!(
            Instant::now() < deadline,
            "deferred Preview provider did not start"
        );
        thread::yield_now();
    }
}

/// Deterministic deferred correctness harness. It intentionally uses opaque
/// synthetic refs and the production PreviewSession/registry/executor, while
/// the real fixture benchmarks above provide provider/resource timing data.
#[test]
fn preview_rapid_switch_100_deferred_correctness() {
    let started = Arc::new(AtomicUsize::new(0));
    let cleaned = Arc::new(AtomicUsize::new(0));
    let release = Arc::new(AtomicBool::new(false));
    let provider = Arc::new(DeferredProvider {
        descriptor: PreviewProviderDescriptor::new(
            "phase-a-deferred",
            100,
            PreviewCapabilities::all(),
            vec![PreviewHostKind::ZenFloating],
            false,
        ),
        started: Arc::clone(&started),
        release: Arc::clone(&release),
        cleaned: Arc::clone(&cleaned),
    });
    let registry =
        Arc::new(PreviewProviderRegistry::new(vec![provider]).expect("deferred Preview registry"));
    let source_for = |index: usize| PreviewSourceRef::Ephemeral {
        browse_session_id: "phase-a-browse".to_string(),
        entry_id: format!("rapid-{index:03}"),
    };
    let session = PreviewSession::new(PreviewSessionConfig::new(
        "phase-a-session",
        "rapid-request-000",
        source_for(0),
        PreviewHost::new(PreviewHostKind::ZenFloating, PreviewCapabilities::all()),
    ));
    let resolver: Arc<dyn SourceResolver> = Arc::new(DeferredResolver);
    let mut task = session
        .start(Arc::clone(&resolver), Arc::clone(&registry))
        .expect("start first deferred Preview");
    wait_for_count(&started, 1);

    for index in 0..metrics::PREVIEW_RAPID_SWITCH_ENTRIES {
        let next_index = (index + 1) % metrics::PREVIEW_RAPID_SWITCH_ENTRIES;
        session
            .switch_source(PreviewRequest {
                request_id: format!("rapid-request-{next_index:03}"),
                source: source_for(next_index),
            })
            .expect("switch deferred Preview source");
        assert!(matches!(
            task.join(),
            Err(crate::file_workspace::preview::PreviewRunError::Cancelled)
                | Err(crate::file_workspace::preview::PreviewRunError::StalePublication)
        ));
        task = session
            .start(Arc::clone(&resolver), Arc::clone(&registry))
            .expect("start deferred Preview after switch");
        if index + 1 < metrics::PREVIEW_RAPID_SWITCH_ENTRIES {
            wait_for_count(&started, index + 2);
        } else {
            release.store(true, Ordering::Release);
        }
    }

    let outcome = task.join().expect("final deferred Preview result");
    assert_eq!(
        outcome.envelope.representation,
        PreviewRepresentation::Text {
            text: "rapid-request-000".to_string(),
            language: None,
        }
    );
    assert_eq!(session.snapshot().request_id, "rapid-request-000");
    assert_eq!(
        session.state(),
        crate::file_workspace::preview::PreviewSessionState::Ready
    );
    assert_eq!(
        started.load(Ordering::Acquire),
        metrics::PREVIEW_RAPID_SWITCH_ENTRIES + 1
    );
    assert_eq!(
        cleaned.load(Ordering::Acquire),
        metrics::PREVIEW_RAPID_SWITCH_ENTRIES + 1
    );
    assert!(session.dispose());
}
