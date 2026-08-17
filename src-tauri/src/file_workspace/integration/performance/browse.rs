use super::{
    fixture::WorkspaceFixture,
    harness::{open_fixture, runtime_for, try_open_fixture},
    metrics,
    resources::{self, ProcessResources},
};
use crate::file_workspace::{
    browse::{DEFAULT_MAX_BROWSE_ENTRY_REFS, DEFAULT_MAX_BROWSE_PATH_REFS},
    integration::types::{
        BrowseCompletionDto, BrowseNextPageRequest, BrowseSessionRequest,
        BrowseStartEnumerationRequest,
    },
};
use serde_json::json;
use std::time::Instant;

const PAGE_SIZE: usize = 256;
const WORKLOAD_ENTRIES: usize = 100_000;

struct EnumerationObservation {
    pages: usize,
    entries: usize,
    first_page_entries: usize,
    first_page_ms: u128,
    total_ms: u128,
    completion: &'static str,
    error: Option<String>,
    live_entry_refs: usize,
    live_path_refs: usize,
    peak_process: ProcessResources,
}

#[test]
#[ignore = "W1-11 multi-session Browse capacity evidence"]
fn browse_session_capacity_remains_bounded() {
    let fixture = WorkspaceFixture::smoke();
    let runtime = runtime_for(&fixture);
    let mut sessions = Vec::new();
    for index in 0..32 {
        sessions.push(open_fixture(&runtime, &fixture, &format!("capacity-{index}")).session_id);
    }
    assert_eq!(sessions.len(), 32);
    assert_eq!(
        try_open_fixture(&runtime, &fixture, "capacity-overflow")
            .expect_err("the 33rd Browse session must fail closed"),
        "browse_session_capacity_exceeded"
    );
    for session_id in sessions {
        runtime
            .dispose_browse(BrowseSessionRequest { session_id })
            .expect("dispose bounded Browse session");
    }
    assert!(runtime.dispose());
    let settled = runtime.resource_counts();
    assert_eq!(settled.browse_service_sessions, 0);
    metrics::emit_metric(
        "browse_multi_session_capacity",
        metrics::HARD_PASS,
        [
            ("max_sessions".to_string(), json!(32)),
            ("overflow_behavior".to_string(), json!("fail closed")),
            (
                "settled_sessions".to_string(),
                json!(settled.browse_service_sessions),
            ),
            ("fixture_root_scope".to_string(), json!("repository-local")),
        ],
    );
}

fn enumerate_without_releasing(
    runtime: &crate::file_workspace::integration::FileWorkspaceRuntime,
    session_id: String,
    path_ref: crate::file_workspace::BrowsePathRef,
    request_id: &str,
) -> EnumerationObservation {
    let started = Instant::now();
    let first = runtime.start_enumeration(BrowseStartEnumerationRequest {
        session_id: session_id.clone(),
        request_id: request_id.to_string(),
        path_ref,
        page_size: PAGE_SIZE,
    });
    let first_page_ms = started.elapsed().as_millis();
    let mut pages = 0;
    let mut entries = 0;
    let mut first_page_entries = 0;
    let mut cursor = None;
    let mut error = None;
    let mut owned_pages = Vec::new();
    let mut peak_process = resources::snapshot();

    match first {
        Ok(page) => {
            pages += 1;
            entries += page.entries.len();
            first_page_entries = page.entries.len();
            cursor = page.next_cursor.clone();
            owned_pages.push(page);
            peak_process = peak_process.max(resources::snapshot());
        }
        Err(message) => error = Some(message),
    }

    while let Some(next_cursor) = cursor.take() {
        match runtime.next_page(BrowseNextPageRequest {
            session_id: session_id.clone(),
            cursor: next_cursor,
            page_size: PAGE_SIZE,
        }) {
            Ok(page) => {
                pages += 1;
                entries += page.entries.len();
                cursor = page.next_cursor.clone();
                owned_pages.push(page);
                peak_process = peak_process.max(resources::snapshot());
            }
            Err(message) => {
                error = Some(message);
                break;
            }
        }
    }

    let total_ms = started.elapsed().as_millis();
    let counts = runtime.resource_counts();
    let completion = if error.is_some() {
        "capacity_error"
    } else if owned_pages
        .last()
        .is_some_and(|page| page.completion == BrowseCompletionDto::Complete)
    {
        "complete"
    } else {
        "incomplete"
    };

    // The vector intentionally remains live until this observation returns: it
    // mirrors the W1-10 controller's published-page ownership contract.
    drop(owned_pages);
    EnumerationObservation {
        pages,
        entries,
        first_page_entries,
        first_page_ms,
        total_ms,
        completion,
        error,
        live_entry_refs: counts.browse_entry_refs,
        live_path_refs: counts.browse_path_refs,
        peak_process,
    }
}

#[test]
#[ignore = "W1-11 100k Browse capacity baseline; run before changing BrowseLimits"]
fn browse_100k_capacity_baseline() {
    let cases = [
        ("entry-heavy-100k", 99_000, 1_000),
        ("path-heavy-100k", 90_000, 10_000),
    ];

    for (label, file_count, directory_count) in cases {
        let fixture = WorkspaceFixture::large(label, file_count, directory_count);
        let runtime = super::harness::runtime_for_browse_limits(&fixture, 4_096, 1_024);
        let opened = open_fixture(&runtime, &fixture, label);
        let observation = enumerate_without_releasing(
            &runtime,
            opened.session_id.clone(),
            opened.root_path_ref,
            label,
        );

        assert_eq!(
            observation.error.as_deref(),
            Some("browse_temporary_state_capacity_exceeded"),
            "legacy bounds should fail closed for {label}"
        );
        assert!(
            observation.entries > 0,
            "{label} should publish progressive pages"
        );
        assert!(
            observation.pages > 0,
            "{label} should publish at least one page"
        );
        assert!(runtime.dispose());
        let settled = runtime.resource_counts();
        assert_eq!(settled.browse_service_sessions, 0);

        metrics::emit_metric(
            "browse_100k_capacity_baseline",
            metrics::OBSERVED,
            [
                ("case".to_string(), json!(label)),
                ("fixture_entries".to_string(), json!(WORKLOAD_ENTRIES)),
                ("fixture_files".to_string(), json!(file_count)),
                ("fixture_directories".to_string(), json!(directory_count)),
                ("requested_page_size".to_string(), json!(PAGE_SIZE)),
                ("legacy_max_entry_refs".to_string(), json!(4_096)),
                ("legacy_max_path_refs".to_string(), json!(1_024)),
                ("pages".to_string(), json!(observation.pages)),
                ("published_entries".to_string(), json!(observation.entries)),
                (
                    "first_page_ms".to_string(),
                    json!(observation.first_page_ms),
                ),
                ("total_ms".to_string(), json!(observation.total_ms)),
                ("completion".to_string(), json!(observation.completion)),
                ("error".to_string(), json!(observation.error)),
                (
                    "peak_live_entry_refs".to_string(),
                    json!(observation.live_entry_refs),
                ),
                (
                    "peak_live_path_refs".to_string(),
                    json!(observation.live_path_refs),
                ),
                ("fixture_root_scope".to_string(), json!("repository-local")),
                ("raw_path_authority".to_string(), json!(false)),
                ("query_v2_involved".to_string(), json!(false)),
            ],
        );
    }
}

#[test]
#[ignore = "W1-11 100k Browse progressive bounded ownership gate"]
fn browse_100k_progressive_bounded_ownership() {
    let fixture = WorkspaceFixture::large("mixed-100k", 90_000, 10_000);
    let runtime = runtime_for(&fixture);
    let opened = open_fixture(&runtime, &fixture, "mixed-100k");
    // Establish the idle process baseline after the fixture/runtime setup and
    // before Browse enumeration. Setup time is not part of first-page timing.
    let idle_process = resources::snapshot();
    let observation = enumerate_without_releasing(
        &runtime,
        opened.session_id.clone(),
        opened.root_path_ref,
        "workspace-foundation-100k",
    );

    assert_eq!(
        observation.error, None,
        "100k Browse must not hit bounded capacity"
    );
    assert_eq!(observation.completion, "complete");
    assert_eq!(observation.entries, WORKLOAD_ENTRIES);
    assert!(observation.first_page_entries > 0);
    assert!(
        observation.first_page_entries < WORKLOAD_ENTRIES,
        "the first useful page must precede full enumeration"
    );
    assert!(
        observation.pages > 1,
        "100k Browse must publish multiple pages"
    );
    assert!(observation.live_entry_refs <= DEFAULT_MAX_BROWSE_ENTRY_REFS);
    assert!(observation.live_path_refs <= DEFAULT_MAX_BROWSE_PATH_REFS);

    metrics::emit_metric(
        "browse_100k_first_page",
        // This is one local sample, not a p95 measurement. Keep the latency
        // target visible while classifying the evidence honestly.
        metrics::OBSERVED,
        [
            ("fixture_entries".to_string(), json!(WORKLOAD_ENTRIES)),
            ("requested_page_size".to_string(), json!(PAGE_SIZE)),
            (
                "first_page_entries".to_string(),
                json!(observation.first_page_entries),
            ),
            (
                "first_page_ms".to_string(),
                json!(observation.first_page_ms),
            ),
            ("first_page_sample_count".to_string(), json!(1)),
            ("target_ms_p95".to_string(), json!(250)),
            ("fixture_root_scope".to_string(), json!("repository-local")),
        ],
    );
    metrics::emit_metric(
        "browse_100k_progressive_bounded_ownership",
        metrics::HARD_PASS,
        [
            ("fixture_entries".to_string(), json!(WORKLOAD_ENTRIES)),
            ("fixture_files".to_string(), json!(90_000)),
            ("fixture_directories".to_string(), json!(10_000)),
            ("requested_page_size".to_string(), json!(PAGE_SIZE)),
            ("effective_page_size".to_string(), json!(PAGE_SIZE)),
            ("pages".to_string(), json!(observation.pages)),
            ("published_entries".to_string(), json!(observation.entries)),
            (
                "first_page_ms".to_string(),
                json!(observation.first_page_ms),
            ),
            ("total_ms".to_string(), json!(observation.total_ms)),
            ("completion".to_string(), json!(observation.completion)),
            (
                "peak_live_entry_refs".to_string(),
                json!(observation.live_entry_refs),
            ),
            (
                "peak_live_path_refs".to_string(),
                json!(observation.live_path_refs),
            ),
            (
                "new_max_entry_refs".to_string(),
                json!(DEFAULT_MAX_BROWSE_ENTRY_REFS),
            ),
            (
                "new_max_path_refs".to_string(),
                json!(DEFAULT_MAX_BROWSE_PATH_REFS),
            ),
            (
                "boundedness_proof".to_string(),
                json!("fixed per-session caps; no eviction or unbounded registry"),
            ),
            (
                "frontend_entry_ref_validity".to_string(),
                json!("published pages retained until teardown"),
            ),
            (
                "history_path_ref_lifetime".to_string(),
                json!("W1-10 pins remain valid until history disposal"),
            ),
            (
                "capacity_behavior".to_string(),
                json!("fail closed at exact bound"),
            ),
            ("max_sessions".to_string(), json!(32)),
            (
                "theoretical_process_entry_ref_bound".to_string(),
                json!(32 * DEFAULT_MAX_BROWSE_ENTRY_REFS),
            ),
            (
                "theoretical_process_path_ref_bound".to_string(),
                json!(32 * DEFAULT_MAX_BROWSE_PATH_REFS),
            ),
            (
                "multi_session_capacity_behavior".to_string(),
                json!("separate exact-capacity test; 33rd session fails closed"),
            ),
            ("timing_includes_resource_sampling".to_string(), json!(true)),
            ("fixture_root_scope".to_string(), json!("repository-local")),
            ("raw_path_authority".to_string(), json!(false)),
            ("query_v2_involved".to_string(), json!(false)),
            ("idle_rss_bytes".to_string(), json!(idle_process.rss_bytes)),
            (
                "peak_rss_bytes".to_string(),
                json!(observation.peak_process.rss_bytes),
            ),
            (
                "idle_handle_count".to_string(),
                json!(idle_process.handle_count),
            ),
            (
                "peak_handle_count".to_string(),
                json!(observation.peak_process.handle_count),
            ),
            ("idle_fd_count".to_string(), json!(idle_process.fd_count)),
            (
                "peak_fd_count".to_string(),
                json!(observation.peak_process.fd_count),
            ),
        ],
    );

    assert!(runtime.dispose());
    let settled_process = resources::snapshot();
    let settled = runtime.resource_counts();
    assert_eq!(settled.browse_sessions, 0);
    assert_eq!(settled.browse_service_sessions, 0);
    assert_eq!(settled.browse_entry_refs, 0);
    assert_eq!(settled.browse_path_refs, 0);
    assert_eq!(settled.browse_active_enumerations, 0);
    metrics::emit_metric(
        "browse_100k_teardown",
        metrics::HARD_PASS,
        [
            (
                "browse_sessions".to_string(),
                json!(settled.browse_sessions),
            ),
            (
                "browse_service_sessions".to_string(),
                json!(settled.browse_service_sessions),
            ),
            (
                "live_entry_refs".to_string(),
                json!(settled.browse_entry_refs),
            ),
            (
                "live_path_refs".to_string(),
                json!(settled.browse_path_refs),
            ),
            (
                "active_enumerations".to_string(),
                json!(settled.browse_active_enumerations),
            ),
            (
                "settled_rss_bytes".to_string(),
                json!(settled_process.rss_bytes),
            ),
            (
                "settled_handle_count".to_string(),
                json!(settled_process.handle_count),
            ),
            (
                "settled_fd_count".to_string(),
                json!(settled_process.fd_count),
            ),
        ],
    );
}
