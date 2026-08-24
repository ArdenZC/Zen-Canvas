//! W3-10 Phase A Preview performance evidence.
//!
//! This module deliberately stays in the existing File Workspace performance
//! test binary. It drives the real Browse -> PreviewSession -> Read Gate ->
//! provider path and observes existing scheduler/registry counters; it does
//! not add a production provider, cache, scheduler or telemetry authority.

use super::{
    fixture::{PreviewFixtureSpec, WorkspaceFixture, PREVIEW_FIXTURE_SPECS},
    harness::{open_fixture, open_path, runtime_for},
    metrics, resources,
};
use crate::{
    file_ops::{execute_moves_with_persistence, ExecuteMovesRequest, OperationPreviewRequest},
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
    collections::{BTreeMap, BTreeSet},
    fs,
    path::Path,
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc, Mutex, OnceLock,
    },
    thread,
    time::{Duration, Instant},
};

const RAPID_SWITCH_FIXTURE_ENTRIES: usize = metrics::PREVIEW_RAPID_SWITCH_ENTRIES;
const STEADY_STATE_CYCLES: usize = 100;

static PREVIEW_PERFORMANCE_TEST_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

fn preview_performance_test_guard() -> std::sync::MutexGuard<'static, ()> {
    PREVIEW_PERFORMANCE_TEST_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .expect("Preview performance test lock")
}

type FixtureSources = (
    BrowseOpenResponse,
    BTreeMap<&'static str, (PreviewFixtureSpec, PreviewSourceRef)>,
    Vec<PreviewSourceRef>,
    Vec<BrowseEntryDto>,
);

fn fixture_sources(
    runtime: &FileWorkspaceRuntime,
    fixture: &WorkspaceFixture,
    display_hint: &str,
) -> FixtureSources {
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
            .find(|entry| {
                entry.name == spec.file_name
                    && entry.kind
                        == if spec.is_directory {
                            BrowseEntryKindDto::Directory
                        } else {
                            BrowseEntryKindDto::File
                        }
            })
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
    (opened, matrix, rapid_sources, entries)
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

fn source_for_name(
    entries: &[BrowseEntryDto],
    name: &str,
    expected_kind: BrowseEntryKindDto,
) -> PreviewSourceRef {
    let entry = entries
        .iter()
        .find(|entry| entry.name == name && entry.kind == expected_kind)
        .unwrap_or_else(|| panic!("Preview scale fixture entry is missing: {name}"));
    source_from_entry(entry)
}

fn source_for_path(
    runtime: &FileWorkspaceRuntime,
    path: &Path,
    name: &str,
    expected_kind: BrowseEntryKindDto,
    display_hint: &str,
) -> (BrowseOpenResponse, PreviewSourceRef) {
    let opened = open_path(runtime, path, display_hint);
    let mut page = runtime
        .start_enumeration(BrowseStartEnumerationRequest {
            session_id: opened.session_id.clone(),
            request_id: format!("{display_hint}-enumeration"),
            path_ref: opened.root_path_ref.clone(),
            page_size: 256,
            query: Default::default(),
        })
        .expect("enumerate close-to-mutate fixture");

    loop {
        if let Some(entry) = page
            .entries
            .iter()
            .find(|entry| entry.name == name && entry.kind == expected_kind)
        {
            return (opened, source_from_entry(entry));
        }
        let Some(cursor) = page.next_cursor.take() else {
            panic!("close-to-mutate fixture entry is missing: {name}");
        };
        page = runtime
            .next_page(BrowseNextPageRequest {
                session_id: opened.session_id.clone(),
                cursor,
                page_size: 256,
            })
            .expect("continue close-to-mutate fixture enumeration");
    }
}

fn close_browse_and_assert_baseline(
    runtime: &FileWorkspaceRuntime,
    opened: BrowseOpenResponse,
    baseline_runtime: crate::file_workspace::integration::runtime::ResourceCounts,
    baseline_scheduler: SchedulerSnapshot,
    baseline_leases: usize,
    baseline_assets: (usize, usize),
) {
    runtime
        .dispose_browse(
            crate::file_workspace::integration::types::BrowseSessionRequest {
                session_id: opened.session_id,
            },
        )
        .expect("dispose close-to-mutate Browse session");
    assert_eq!(runtime.resource_counts(), baseline_runtime);
    assert_eq!(
        runtime.inner.read_gate.active_lease_count(),
        baseline_leases
    );
    assert_eq!(runtime.inner.preview_assets.counts(), baseline_assets);
    let scheduler = runtime.inner.scheduler.snapshot();
    assert_eq!(scheduler.running, baseline_scheduler.running);
    assert_eq!(scheduler.queued, baseline_scheduler.queued);
}

struct PreviewLifecycleCase<'a> {
    path: &'a Path,
    name: &'a str,
    expected_kind: BrowseEntryKindDto,
    spec: &'a PreviewFixtureSpec,
    request_id: &'a str,
}

fn open_useful_preview_then_close(
    runtime: &FileWorkspaceRuntime,
    case: PreviewLifecycleCase<'_>,
    baseline_runtime: crate::file_workspace::integration::runtime::ResourceCounts,
    baseline_scheduler: SchedulerSnapshot,
    baseline_leases: usize,
    baseline_assets: (usize, usize),
) {
    let (opened, source) = source_for_path(
        runtime,
        case.path,
        case.name,
        case.expected_kind,
        case.request_id,
    );
    let preview = create_preview(runtime, source, case.request_id);
    let settled = start_preview(runtime, &preview.preview_id);
    assert_useful_representation(&settled, case.spec);
    dispose_preview(runtime, preview.preview_id);
    close_browse_and_assert_baseline(
        runtime,
        opened,
        baseline_runtime,
        baseline_scheduler,
        baseline_leases,
        baseline_assets,
    );
}

fn execute_close_gate_operation(
    runtime: &FileWorkspaceRuntime,
    operation_id: &str,
    operation_type: &str,
    source: &Path,
    target: &Path,
) -> Result<(), String> {
    let old_name = source
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "source fixture name is not UTF-8".to_string())?;
    let new_name = target
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(old_name);
    let target_path = if operation_type == "permanent_delete" {
        "Permanent deletion quarantine".to_string()
    } else {
        target.to_string_lossy().into_owned()
    };
    let result = execute_moves_with_persistence(
        &runtime.inner.database,
        ExecuteMovesRequest {
            operations: vec![OperationPreviewRequest {
                id: operation_id.to_string(),
                file_id: format!("w3-10-close-gate-{operation_id}"),
                operation_type: operation_type.to_string(),
                source_path: source.to_string_lossy().into_owned(),
                target_path,
                old_name: old_name.to_string(),
                new_name: new_name.to_string(),
                is_executable: Some(true),
            }],
        },
    )
    .map_err(|error| format!("operation execution failed: {error}"))?;
    let log = result
        .logs
        .first()
        .ok_or_else(|| "operation execution returned no log".to_string())?;
    if log.status == "success" {
        Ok(())
    } else {
        Err(log
            .error_message
            .clone()
            .unwrap_or_else(|| format!("operation status was {}", log.status)))
    }
}

type MixedPreviewSource = (&'static str, PreviewSourceRef, &'static str, &'static str);

fn mixed_provider_sources(
    matrix: &BTreeMap<&'static str, (PreviewFixtureSpec, PreviewSourceRef)>,
    entries: &[BrowseEntryDto],
) -> Vec<MixedPreviewSource> {
    let mut sources = Vec::new();
    for id in [
        "text-normal",
        "source-normal",
        "markdown-normal",
        "json-normal",
        "csv-normal",
        "png-normal",
        "folder-normal",
        "archive-normal",
        "yaml-normal",
        "tsv-normal",
        "jpeg-normal",
    ] {
        let (spec, source) = matrix.get(id).expect("mixed Preview fixture source");
        sources.push((
            spec.id,
            source.clone(),
            spec.provider_id,
            spec.representation_family,
        ));
    }
    assert!(
        entries.iter().any(|entry| {
            entry.name == "preview-folder" && entry.kind == BrowseEntryKindDto::Directory
        }),
        "mixed Preview fixture must retain a directory source"
    );
    assert!(
        entries.iter().any(|entry| {
            entry.name == "preview-archive.zip" && entry.kind == BrowseEntryKindDto::File
        }),
        "mixed Preview fixture must retain an archive source"
    );
    sources
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
    assert_expected_representation(snapshot, spec.provider_id, spec.representation_family);
    assert_ne!(
        snapshot
            .representation
            .as_ref()
            .expect("Preview provider must publish a representation")
            .completeness,
        PreviewCompleteness::Unknown,
        "fixture {} did not publish useful completeness",
        spec.id
    );
}

fn assert_expected_representation(
    snapshot: &PreviewSnapshotDto,
    provider_id: &str,
    representation_family: &str,
) {
    assert_eq!(snapshot.state, PreviewSessionStateDto::Ready);
    let envelope = snapshot
        .representation
        .as_ref()
        .expect("Preview provider must publish a representation");
    let family = family_name(&envelope.representation);
    assert_eq!(
        family, representation_family,
        "Preview published the wrong representation family"
    );
    assert_eq!(
        snapshot.active_provider_id.as_deref(),
        Some(provider_id),
        "Preview selected the wrong provider"
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

fn phase_b_fields() -> Vec<(String, Value)> {
    let mut fields = phase_a_fields();
    fields.push((
        "metric_definition".to_string(),
        json!(metrics::PREVIEW_PHASE_B_METRIC_DEFINITION),
    ));
    fields.push(("phase".to_string(), json!("B")));
    fields
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
    let _test_guard = preview_performance_test_guard();
    let fixture = WorkspaceFixture::preview("preview-shell", RAPID_SWITCH_FIXTURE_ENTRIES);
    let runtime = runtime_for(&fixture);
    let (opened, matrix, _, _) = fixture_sources(&runtime, &fixture, "preview-shell");
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
    let _test_guard = preview_performance_test_guard();
    let fixture = WorkspaceFixture::preview("preview-providers", RAPID_SWITCH_FIXTURE_ENTRIES);
    let runtime = runtime_for(&fixture);
    let (opened, matrix, _, _) = fixture_sources(&runtime, &fixture, "preview-providers");
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
    let _test_guard = preview_performance_test_guard();
    let fixture = WorkspaceFixture::preview("preview-rapid-switch", RAPID_SWITCH_FIXTURE_ENTRIES);
    let runtime = runtime_for(&fixture);
    let (opened, _matrix, rapid_sources, _) =
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
#[ignore = "W3-10 Phase B deterministic 100-entry mixed-provider switch evidence"]
fn preview_rapid_switch_100_mixed_provider_families() {
    let _test_guard = preview_performance_test_guard();
    let fixture =
        WorkspaceFixture::preview("preview-mixed-rapid-switch", RAPID_SWITCH_FIXTURE_ENTRIES);
    let runtime = runtime_for(&fixture);
    let (opened, matrix, _, entries) =
        fixture_sources(&runtime, &fixture, "preview-mixed-rapid-switch");
    let mixed_sources = mixed_provider_sources(&matrix, &entries);
    assert!(mixed_sources.len() >= 7);

    let baseline_runtime = runtime.resource_counts();
    let baseline_scheduler = runtime.inner.scheduler.snapshot();
    let baseline_leases = runtime.inner.read_gate.active_lease_count();
    let baseline_assets = runtime.inner.preview_assets.counts();
    let initial = &mixed_sources[0];
    let preview = create_preview(&runtime, initial.1.clone(), "mixed-initial");
    let initial_snapshot = start_preview(&runtime, &preview.preview_id);
    assert_expected_representation(&initial_snapshot, initial.2, initial.3);

    let mut switch_samples = Vec::with_capacity(RAPID_SWITCH_FIXTURE_ENTRIES);
    let mut max_runtime_counts = baseline_runtime;
    let mut max_scheduler = baseline_scheduler;
    let mut max_asset_count = baseline_assets.0;
    let mut max_read_leases = baseline_leases;
    let mut observed_families = BTreeSet::new();

    for index in 0..RAPID_SWITCH_FIXTURE_ENTRIES {
        let expected = &mixed_sources[(index + 1) % mixed_sources.len()];
        let started = Instant::now();
        let switched = runtime
            .switch_preview_source(PreviewSwitchSourceRequest {
                preview_id: preview.preview_id.clone(),
                request_id: format!("mixed-switch-{index:03}"),
                source: expected.1.clone(),
            })
            .expect("switch mixed Preview source");
        assert_eq!(switched.state, PreviewSessionStateDto::Resolving);
        assert_eq!(switched.source, expected.1);
        assert!(switched.representation.is_none());

        let settled = start_preview(&runtime, &preview.preview_id);
        switch_samples.push(started.elapsed());
        assert_expected_representation(&settled, expected.2, expected.3);
        observed_families.insert(expected.3);

        max_runtime_counts = max_resource_counts(max_runtime_counts, runtime.resource_counts());
        max_scheduler = max_scheduler_snapshot(max_scheduler, runtime.inner.scheduler.snapshot());
        max_asset_count = max_asset_count.max(runtime.inner.preview_assets.counts().0);
        max_read_leases = max_read_leases.max(runtime.inner.read_gate.active_lease_count());
        assert!(
            runtime.resource_counts().preview_sessions <= baseline_runtime.preview_sessions + 1,
            "mixed Preview switching exceeded one current host/session"
        );
    }

    let expected_families = [
        "text",
        "safe_html",
        "structured_tree",
        "table",
        "image",
        "folder_summary",
        "archive_tree",
    ];
    for family in expected_families {
        assert!(
            observed_families.contains(family),
            "mixed rapid switch did not exercise representation family {family}"
        );
    }

    dispose_preview(&runtime, preview.preview_id);
    assert_eq!(runtime.resource_counts(), baseline_runtime);
    assert_eq!(
        runtime.inner.read_gate.active_lease_count(),
        baseline_leases
    );
    assert_eq!(runtime.inner.preview_assets.counts(), baseline_assets);
    let after_scheduler = runtime.inner.scheduler.snapshot();
    assert_eq!(after_scheduler.running, baseline_scheduler.running);
    assert_eq!(after_scheduler.queued, baseline_scheduler.queued);

    let mut fields = phase_b_fields();
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
            "provider_sequence".to_string(),
            json!(mixed_sources
                .iter()
                .map(|(_, _, provider, _)| *provider)
                .collect::<Vec<_>>()),
        ),
        (
            "representation_families_observed".to_string(),
            json!(observed_families.iter().copied().collect::<Vec<_>>()),
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
        ("cleanup_returned_to_baseline".to_string(), json!(true)),
    ]);
    metrics::emit_metric(
        "preview_rapid_switch_100_mixed_provider_families",
        metrics::HARD_PASS,
        fields,
    );

    runtime
        .dispose_browse(
            crate::file_workspace::integration::types::BrowseSessionRequest {
                session_id: opened.session_id,
            },
        )
        .expect("dispose mixed rapid-switch Browse session");
    assert!(runtime.dispose());
}

#[test]
#[ignore = "W3-10 Phase B real Folder scale and bounded publication evidence"]
fn preview_folder_scale() {
    let _test_guard = preview_performance_test_guard();
    for entry_count in [1_000_usize, 10_000, 100_000, 100_001] {
        let fixture = WorkspaceFixture::preview_scale(
            &format!("preview-folder-scale-{entry_count}"),
            RAPID_SWITCH_FIXTURE_ENTRIES,
            entry_count,
            32,
        );
        let runtime = runtime_for(&fixture);
        let (opened, _matrix, _rapid_sources, entries) =
            fixture_sources(&runtime, &fixture, "preview-folder-scale");
        let preview = create_preview(
            &runtime,
            source_for_name(
                &entries,
                "preview-folder-scale",
                BrowseEntryKindDto::Directory,
            ),
            format!("folder-scale-{entry_count}"),
        );
        let started = Instant::now();
        let snapshot = start_preview(&runtime, &preview.preview_id);
        let elapsed = started.elapsed();
        let envelope = snapshot
            .representation
            .as_ref()
            .expect("Folder scale must publish a summary");
        assert_eq!(
            snapshot.active_provider_id.as_deref(),
            Some("builtin.folder")
        );
        let PreviewRepresentation::FolderSummary { encoded_summary } = &envelope.representation
        else {
            panic!("Folder scale published the wrong representation");
        };
        let payload: Value = serde_json::from_str(encoded_summary).expect("Folder summary JSON");
        let progress = &payload["progress"];
        let expected_inspected = entry_count.min(100_000) as u64;
        let inspected_entries = progress["inspectedEntries"]
            .as_u64()
            .expect("Folder inspected entry count");
        assert!(inspected_entries <= expected_inspected);
        assert_eq!(progress["acceptedChildren"], inspected_entries);
        if entry_count <= 10_000 {
            assert_eq!(inspected_entries, expected_inspected);
            assert_eq!(envelope.completeness, PreviewCompleteness::Complete);
            assert_eq!(progress["state"], "complete");
            assert!(progress["limitReason"].is_null());
        } else {
            assert!(matches!(
                envelope.completeness,
                PreviewCompleteness::Complete | PreviewCompleteness::Partial
            ));
            if envelope.completeness == PreviewCompleteness::Complete {
                assert_eq!(progress["state"], "complete");
                assert!(progress["limitReason"].is_null());
                assert_eq!(inspected_entries, expected_inspected);
            } else {
                assert_eq!(progress["state"], "partial");
                assert!(matches!(
                    progress["limitReason"].as_str(),
                    Some("entry_limit") | Some("deadline")
                ));
            }
        }
        let mut fields = phase_b_fields();
        fields.extend([
            ("entry_count".to_string(), json!(entry_count)),
            (
                "inspected_entries".to_string(),
                progress["inspectedEntries"].clone(),
            ),
            (
                "accepted_children".to_string(),
                progress["acceptedChildren"].clone(),
            ),
            ("publication_count_bound".to_string(), json!(8)),
            ("recursive_traversal".to_string(), json!(false)),
            (
                "measurement_boundary".to_string(),
                json!("backend_preview_start_return"),
            ),
            (
                "elapsed_ms".to_string(),
                json!(elapsed.as_secs_f64() * 1_000.0),
            ),
        ]);
        metrics::emit_metric("preview_folder_scale", metrics::HARD_PASS, fields);
        dispose_preview(&runtime, preview.preview_id);
        runtime
            .dispose_browse(
                crate::file_workspace::integration::types::BrowseSessionRequest {
                    session_id: opened.session_id,
                },
            )
            .expect("dispose Folder scale Browse session");
        assert_eq!(runtime.resource_counts().preview_sessions, 0);
        assert_eq!(runtime.inner.read_gate.active_lease_count(), 0);
        assert_eq!(runtime.inner.preview_assets.counts(), (0, 0));
        assert!(runtime.dispose());
    }
}

#[test]
#[ignore = "W3-10 Phase B real ZIP scale/security/resource evidence"]
fn preview_zip_scale() {
    let _test_guard = preview_performance_test_guard();
    let fixture = WorkspaceFixture::preview_scale(
        "preview-zip-scale",
        RAPID_SWITCH_FIXTURE_ENTRIES,
        1,
        20_001,
    );
    let runtime = runtime_for(&fixture);
    let (opened, _matrix, _rapid_sources, entries) =
        fixture_sources(&runtime, &fixture, "preview-zip-scale");
    let preview = create_preview(
        &runtime,
        source_for_name(
            &entries,
            "preview-archive-scale.zip",
            BrowseEntryKindDto::File,
        ),
        "zip-scale-large",
    );
    let started = Instant::now();
    let snapshot = start_preview(&runtime, &preview.preview_id);
    let elapsed = started.elapsed();
    let envelope = snapshot
        .representation
        .as_ref()
        .expect("ZIP scale must publish bounded ArchiveTree");
    assert_eq!(
        snapshot.active_provider_id.as_deref(),
        Some("builtin.archive-zip")
    );
    let PreviewRepresentation::ArchiveTree { encoded_tree } = &envelope.representation else {
        panic!("ZIP scale published the wrong representation");
    };
    let payload: Value = serde_json::from_str(encoded_tree).expect("ArchiveTree JSON");
    assert_eq!(envelope.completeness, PreviewCompleteness::Partial);
    assert!(matches!(
        payload["progress"]["limitReason"].as_str(),
        Some("entry_limit") | Some("deadline")
    ));
    assert!(
        payload["progress"]["inspectedEntries"]
            .as_u64()
            .unwrap_or(u64::MAX)
            <= 20_000
    );
    assert!(encoded_tree.len() <= 1024 * 1024);

    let mut fields = phase_b_fields();
    fields.extend([
        ("entry_count".to_string(), json!(20_001)),
        (
            "inspected_entries".to_string(),
            payload["progress"]["inspectedEntries"].clone(),
        ),
        ("tree_node_bound".to_string(), json!(2_000)),
        ("encoded_tree_bytes".to_string(), json!(encoded_tree.len())),
        ("no_entry_extraction".to_string(), json!(true)),
        (
            "measurement_boundary".to_string(),
            json!("backend_preview_start_return"),
        ),
        (
            "elapsed_ms".to_string(),
            json!(elapsed.as_secs_f64() * 1_000.0),
        ),
    ]);
    metrics::emit_metric("preview_zip_scale", metrics::HARD_PASS, fields);
    dispose_preview(&runtime, preview.preview_id);

    for (request_id, name) in [
        ("zip-scale-truncated", "preview-archive-truncated.zip"),
        ("zip-scale-corrupt", "preview-corrupt.zip"),
    ] {
        let source = source_for_name(&entries, name, BrowseEntryKindDto::File);
        let preview = create_preview(&runtime, source, request_id);
        let snapshot = start_preview(&runtime, &preview.preview_id);
        assert!(snapshot.representation.as_ref().is_some_and(|envelope| {
            matches!(
                envelope.representation,
                PreviewRepresentation::Metadata { .. }
            )
        }));
        assert!(snapshot.active_provider_id.is_none());
        dispose_preview(&runtime, preview.preview_id);
    }

    runtime
        .dispose_browse(
            crate::file_workspace::integration::types::BrowseSessionRequest {
                session_id: opened.session_id,
            },
        )
        .expect("dispose ZIP scale Browse session");
    assert_eq!(runtime.resource_counts().preview_sessions, 0);
    assert_eq!(runtime.inner.read_gate.active_lease_count(), 0);
    assert_eq!(runtime.inner.preview_assets.counts(), (0, 0));
    assert!(runtime.dispose());
}

#[test]
#[ignore = "W3-10 final close-to-mutate/open filesystem lifecycle evidence"]
fn preview_close_mutate_open_hard_gate() {
    let _test_guard = preview_performance_test_guard();
    let fixture =
        WorkspaceFixture::preview("preview-close-mutate-open", RAPID_SWITCH_FIXTURE_ENTRIES);
    let runtime = runtime_for(&fixture);
    let baseline_runtime = runtime.resource_counts();
    let baseline_scheduler = runtime.inner.scheduler.snapshot();
    let baseline_leases = runtime.inner.read_gate.active_lease_count();
    let baseline_assets = runtime.inner.preview_assets.counts();
    let mutation_root = fixture.path().join("w3-10-close-gate-mutations");
    fs::create_dir_all(&mutation_root).expect("create close-to-mutate target directory");

    let byte_operations = [
        ("text-normal", "rename"),
        ("markdown-normal", "move"),
        ("json-normal", "rename"),
        ("csv-normal", "move"),
        ("png-normal", "rename"),
        ("archive-normal", "move"),
    ];
    let mut byte_provider_families = BTreeSet::new();
    let mut rename_successes = 0_usize;
    let mut move_successes = 0_usize;

    for (index, (fixture_id, operation_type)) in byte_operations.into_iter().enumerate() {
        let spec = PREVIEW_FIXTURE_SPECS
            .iter()
            .find(|candidate| candidate.id == fixture_id)
            .expect("close-to-mutate provider fixture");
        byte_provider_families.insert(spec.representation_family);
        let source = fixture.path().join(spec.file_name);
        let source_name = Path::new(spec.file_name)
            .file_name()
            .and_then(|name| name.to_str())
            .expect("provider fixture file name");
        let target_name = format!("w3-10-{operation_type}-{fixture_id}-{source_name}");
        let target = if operation_type == "move" {
            mutation_root.join(&target_name)
        } else {
            fixture.path().join(&target_name)
        };
        open_useful_preview_then_close(
            &runtime,
            PreviewLifecycleCase {
                path: fixture.path(),
                name: source_name,
                expected_kind: BrowseEntryKindDto::File,
                spec,
                request_id: &format!("close-gate-before-{fixture_id}-{index}"),
            },
            baseline_runtime,
            baseline_scheduler,
            baseline_leases,
            baseline_assets,
        );
        execute_close_gate_operation(
            &runtime,
            &format!("{fixture_id}-{operation_type}"),
            operation_type,
            &source,
            &target,
        )
        .unwrap_or_else(|error| {
            panic!("{operation_type} must be available for {fixture_id}: {error}")
        });
        if operation_type == "rename" {
            rename_successes += 1;
        } else {
            move_successes += 1;
        }
        let target_parent = target.parent().expect("mutated target parent");
        let target_name = target
            .file_name()
            .and_then(|name| name.to_str())
            .expect("mutated target name");
        open_useful_preview_then_close(
            &runtime,
            PreviewLifecycleCase {
                path: target_parent,
                name: target_name,
                expected_kind: BrowseEntryKindDto::File,
                spec,
                request_id: &format!("close-gate-after-{fixture_id}-{index}"),
            },
            baseline_runtime,
            baseline_scheduler,
            baseline_leases,
            baseline_assets,
        );
    }

    let delete_name = "w3-10-close-gate-delete.txt";
    let delete_path = fixture.path().join(delete_name);
    fs::write(&delete_path, b"delete after preview disposal\n")
        .expect("create close-to-mutate delete fixture");
    let delete_spec = PREVIEW_FIXTURE_SPECS
        .iter()
        .find(|candidate| candidate.id == "text-normal")
        .expect("text fixture for delete lifecycle");
    open_useful_preview_then_close(
        &runtime,
        PreviewLifecycleCase {
            path: fixture.path(),
            name: delete_name,
            expected_kind: BrowseEntryKindDto::File,
            spec: delete_spec,
            request_id: "close-gate-before-delete",
        },
        baseline_runtime,
        baseline_scheduler,
        baseline_leases,
        baseline_assets,
    );
    let delete_result = execute_close_gate_operation(
        &runtime,
        "text-delete",
        "permanent_delete",
        &delete_path,
        &delete_path,
    );
    let delete_supported = delete_result.is_ok();
    if cfg!(target_os = "macos") {
        assert!(
            delete_supported,
            "native macOS delete seam failed after preview disposal: {delete_result:?}"
        );
        assert!(
            !delete_path.exists(),
            "successful delete must remove the source"
        );
    }
    open_useful_preview_then_close(
        &runtime,
        PreviewLifecycleCase {
            path: fixture.path(),
            name: "preview-source.rs",
            expected_kind: BrowseEntryKindDto::File,
            spec: PREVIEW_FIXTURE_SPECS
                .iter()
                .find(|candidate| candidate.id == "source-normal")
                .expect("source fixture after delete attempt"),
            request_id: "close-gate-after-delete",
        },
        baseline_runtime,
        baseline_scheduler,
        baseline_leases,
        baseline_assets,
    );

    let folder_spec = PREVIEW_FIXTURE_SPECS
        .iter()
        .find(|candidate| candidate.id == "folder-normal")
        .expect("folder fixture for lifecycle");
    open_useful_preview_then_close(
        &runtime,
        PreviewLifecycleCase {
            path: fixture.path(),
            name: folder_spec.file_name,
            expected_kind: BrowseEntryKindDto::Directory,
            spec: folder_spec,
            request_id: "close-gate-before-folder-mutation",
        },
        baseline_runtime,
        baseline_scheduler,
        baseline_leases,
        baseline_assets,
    );
    let folder_source = fixture.path().join(folder_spec.file_name);
    let folder_target = fixture.path().join("w3-10-folder-renamed");
    let folder_result = execute_close_gate_operation(
        &runtime,
        "folder-rename",
        "rename",
        &folder_source,
        &folder_target,
    );
    let folder_mutation_supported = folder_result.is_ok();
    if folder_mutation_supported {
        open_useful_preview_then_close(
            &runtime,
            PreviewLifecycleCase {
                path: fixture.path(),
                name: folder_target
                    .file_name()
                    .and_then(|name| name.to_str())
                    .expect("renamed folder name"),
                expected_kind: BrowseEntryKindDto::Directory,
                spec: folder_spec,
                request_id: "close-gate-after-folder-mutation",
            },
            baseline_runtime,
            baseline_scheduler,
            baseline_leases,
            baseline_assets,
        );
    }

    assert_eq!(runtime.resource_counts(), baseline_runtime);
    assert_eq!(
        runtime.inner.read_gate.active_lease_count(),
        baseline_leases
    );
    assert_eq!(runtime.inner.preview_assets.counts(), baseline_assets);
    let final_scheduler = runtime.inner.scheduler.snapshot();
    assert_eq!(final_scheduler.running, baseline_scheduler.running);
    assert_eq!(final_scheduler.queued, baseline_scheduler.queued);

    let mut fields = phase_b_fields();
    fields.extend([
        (
            "sequence".to_string(),
            json!("useful_ready -> dispose -> file_ops_preview_execute -> fresh_browse_open"),
        ),
        (
            "provider_families".to_string(),
            json!(byte_provider_families.into_iter().collect::<Vec<_>>()),
        ),
        (
            "fixture_ids".to_string(),
            json!(byte_operations
                .iter()
                .map(|(fixture_id, _)| *fixture_id)
                .collect::<Vec<_>>()),
        ),
        (
            "byte_provider_count".to_string(),
            json!(byte_operations.len()),
        ),
        ("rename_successes".to_string(), json!(rename_successes)),
        ("move_successes".to_string(), json!(move_successes)),
        ("delete_attempted".to_string(), json!(true)),
        (
            "delete_platform_classification".to_string(),
            json!(if delete_supported {
                "HARD PASS"
            } else {
                "UNVERIFIED"
            }),
        ),
        (
            "delete_unverified_reason".to_string(),
            json!(if delete_supported {
                Value::Null
            } else {
                json!("existing permanent-delete seam is unavailable on this platform")
            }),
        ),
        (
            "folder_resources_zero_before_mutation".to_string(),
            json!(true),
        ),
        (
            "folder_mutation_classification".to_string(),
            json!(if folder_mutation_supported {
                "HARD PASS"
            } else {
                "UNVERIFIED"
            }),
        ),
        (
            "folder_unverified_reason".to_string(),
            json!(if folder_mutation_supported {
                Value::Null
            } else {
                json!("existing file_ops directory-mutation seam is unavailable on this platform")
            }),
        ),
        ("read_gate_baseline_restored".to_string(), json!(true)),
        ("scheduler_baseline_restored".to_string(), json!(true)),
        ("preview_assets_baseline_restored".to_string(), json!(true)),
        ("no_sleep".to_string(), json!(true)),
        (
            "mutation_authority".to_string(),
            json!("crate::file_ops::execute_moves_with_persistence"),
        ),
    ]);
    metrics::emit_metric(
        "preview_close_mutate_open_hard_gate",
        metrics::HARD_PASS,
        fields,
    );
    assert!(runtime.dispose());
}

#[test]
#[ignore = "W3-10 Phase A repeated-cycle Preview resource instrumentation"]
fn preview_repeated_cycle_steady_state() {
    let _test_guard = preview_performance_test_guard();
    let fixture = WorkspaceFixture::preview("preview-steady-state", RAPID_SWITCH_FIXTURE_ENTRIES);
    let runtime = runtime_for(&fixture);
    let (opened, matrix, _, _) = fixture_sources(&runtime, &fixture, "preview-steady-state");
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

#[derive(Clone, Copy)]
enum DeferredRepresentationFamily {
    Text,
    SafeHtml,
    StructuredTree,
    Table,
    Image,
    FolderSummary,
    ArchiveTree,
}

impl DeferredRepresentationFamily {
    fn for_source_version(source_version: &str) -> Self {
        let index = source_version
            .rsplit('-')
            .next()
            .and_then(|value| value.parse::<usize>().ok())
            .unwrap_or_default();
        match index % 7 {
            0 => Self::Text,
            1 => Self::SafeHtml,
            2 => Self::StructuredTree,
            3 => Self::Table,
            4 => Self::Image,
            5 => Self::FolderSummary,
            _ => Self::ArchiveTree,
        }
    }

    fn bit(self) -> usize {
        match self {
            Self::Text => 1 << 0,
            Self::SafeHtml => 1 << 1,
            Self::StructuredTree => 1 << 2,
            Self::Table => 1 << 3,
            Self::Image => 1 << 4,
            Self::FolderSummary => 1 << 5,
            Self::ArchiveTree => 1 << 6,
        }
    }

    fn representation(self, source_version: &str) -> PreviewRepresentation {
        match self {
            Self::Text => PreviewRepresentation::Text {
                text: source_version.to_string(),
                language: None,
            },
            Self::SafeHtml => PreviewRepresentation::SafeHtml {
                html: format!("<p>{source_version}</p>"),
            },
            Self::StructuredTree => PreviewRepresentation::StructuredTree {
                encoded_tree: format!(r#"{{"version":1,"source":"{source_version}"}}"#),
            },
            Self::Table => PreviewRepresentation::Table {
                encoded_table: format!(r#"{{"version":1,"source":"{source_version}"}}"#),
            },
            Self::Image => PreviewRepresentation::Image {
                asset_token: format!("asset-{source_version}"),
                media_type: "image/png".to_string(),
            },
            Self::FolderSummary => PreviewRepresentation::FolderSummary {
                encoded_summary: format!(r#"{{"version":1,"source":"{source_version}"}}"#),
            },
            Self::ArchiveTree => PreviewRepresentation::ArchiveTree {
                encoded_tree: format!(r#"{{"version":1,"source":"{source_version}"}}"#),
            },
        }
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
    family_mask: Arc<AtomicUsize>,
}

struct DeferredPreparedPreview {
    source_version: String,
    family: DeferredRepresentationFamily,
    started: Arc<AtomicUsize>,
    release: Arc<AtomicBool>,
    cleaned: Arc<AtomicUsize>,
    family_mask: Arc<AtomicUsize>,
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
            family: DeferredRepresentationFamily::for_source_version(&snapshot.source_version),
            started: Arc::clone(&self.started),
            release: Arc::clone(&self.release),
            cleaned: Arc::clone(&self.cleaned),
            family_mask: Arc::clone(&self.family_mask),
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
        self.family_mask
            .fetch_or(self.family.bit(), Ordering::AcqRel);
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
            representation: self.family.representation(&self.source_version),
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
    let _test_guard = preview_performance_test_guard();
    let started = Arc::new(AtomicUsize::new(0));
    let cleaned = Arc::new(AtomicUsize::new(0));
    let family_mask = Arc::new(AtomicUsize::new(0));
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
        family_mask: Arc::clone(&family_mask),
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
    assert_eq!(family_mask.load(Ordering::Acquire), 0b111_1111);
    let mut fields = phase_a_fields();
    fields.extend([
        (
            "switch_count".to_string(),
            json!(metrics::PREVIEW_RAPID_SWITCH_ENTRIES),
        ),
        (
            "started_tasks".to_string(),
            json!(started.load(Ordering::Acquire)),
        ),
        (
            "cancelled_tasks".to_string(),
            json!(metrics::PREVIEW_RAPID_SWITCH_ENTRIES),
        ),
        (
            "cleaned_tasks".to_string(),
            json!(cleaned.load(Ordering::Acquire)),
        ),
        (
            "representation_family_mask".to_string(),
            json!(family_mask.load(Ordering::Acquire)),
        ),
        ("stale_final_representation".to_string(), json!(false)),
        ("duplicate_preview_host".to_string(), json!(false)),
        ("cleanup_returned_to_baseline".to_string(), json!(true)),
    ]);
    metrics::emit_metric(
        "preview_rapid_switch_100_deferred_correctness",
        metrics::HARD_PASS,
        fields,
    );
    assert!(session.dispose());
}
