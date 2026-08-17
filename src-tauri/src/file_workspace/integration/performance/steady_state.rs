use super::{
    fixture::WorkspaceFixture,
    harness::{open_fixture, runtime_for_with_renderer},
    metrics, resources,
};
use crate::file_workspace::{
    contracts::{EntryRef, PreviewHostKind, PreviewSourceRef, WorkClass},
    integration::types::{
        BrowseEntryKindDto, BrowseSessionRequest, BrowseStartEnumerationRequest,
        PreviewCreateRequest, PreviewSessionRequest, ThumbnailRequestDto, ThumbnailVariantDto,
    },
    thumbnail::{
        ThumbnailRenderContext, ThumbnailRenderOutput, ThumbnailRenderRequest, ThumbnailRenderer,
        ThumbnailRendererDescriptor, ThumbnailRendererError,
    },
};
use crate::scheduler::ResourceHints;
use serde_json::json;
use std::{sync::Arc, thread, time::Duration};

struct PerformanceThumbnailRenderer;

impl ThumbnailRenderer for PerformanceThumbnailRenderer {
    fn descriptor(&self) -> ThumbnailRendererDescriptor {
        ThumbnailRendererDescriptor::new(
            "test.performance",
            "w1-11-performance-v1",
            ResourceHints {
                cpu: 1,
                io: 1,
                open_handles: 0,
                decoder: 0,
                native_preview: 0,
                provider_network: 0,
            },
        )
    }

    fn render(
        &self,
        _request: ThumbnailRenderRequest,
        context: &ThumbnailRenderContext,
    ) -> Result<ThumbnailRenderOutput, ThumbnailRendererError> {
        context.ensure_active()?;
        let _ = context.read_all_bounded(64)?;
        Ok(ThumbnailRenderOutput { bytes: vec![1] })
    }
}

#[test]
#[ignore = "W1-11 resource and lifecycle steady-state observations"]
fn resource_and_registry_steady_state_after_browse_preview_switches() {
    let fixture = WorkspaceFixture::large("resource-10k", 9_000, 1_000);
    let runtime = runtime_for_with_renderer(&fixture, Arc::new(PerformanceThumbnailRenderer));
    let opened = open_fixture(&runtime, &fixture, "resource-10k");
    // Warm the runtime/session before collecting the idle baseline. Fixture
    // construction and cache/database setup are not workload measurements.
    let idle_process = resources::snapshot();

    let first = runtime
        .start_enumeration(BrowseStartEnumerationRequest {
            session_id: opened.session_id.clone(),
            request_id: "resource-browse".to_string(),
            path_ref: opened.root_path_ref.clone(),
            page_size: 256,
        })
        .expect("10k Browse first page");
    assert!(!first.entries.is_empty());
    let mut pages = vec![first];
    while pages.last().is_some_and(|page| page.next_cursor.is_some()) {
        let cursor = pages
            .last_mut()
            .and_then(|page| page.next_cursor.take())
            .expect("10k Browse cursor");
        pages.push(
            runtime
                .next_page(
                    crate::file_workspace::integration::types::BrowseNextPageRequest {
                        session_id: opened.session_id.clone(),
                        cursor,
                        page_size: 256,
                    },
                )
                .expect("10k Browse next page"),
        );
    }
    let ten_k_entries = pages.iter().map(|page| page.entries.len()).sum::<usize>();
    assert_eq!(ten_k_entries, 10_000);
    let ten_k_process = resources::snapshot();

    let preview_entry = pages
        .first()
        .and_then(|page| page.entries.first())
        .expect("10k fixture entry");
    let source = match &preview_entry.entry_ref {
        EntryRef::Ephemeral {
            browse_session_id,
            entry_id,
        } => PreviewSourceRef::Ephemeral {
            browse_session_id: browse_session_id.clone(),
            entry_id: entry_id.clone(),
        },
        EntryRef::Managed { .. } => panic!("fixture entry must be ephemeral"),
    };

    let mut preview_peak_process = ten_k_process;
    for index in 0..100 {
        let preview = runtime
            .create_preview(PreviewCreateRequest {
                request_id: format!("resource-preview-{index}"),
                source: source.clone(),
                host_kind: PreviewHostKind::ZenFloating,
            })
            .expect("create preview cycle");
        let started = runtime
            .start_preview(PreviewSessionRequest {
                preview_id: preview.preview_id.clone(),
            })
            .expect("start preview cycle");
        assert_eq!(
            started.state,
            super::super::types::PreviewSessionStateDto::Ready
        );
        runtime
            .dispose_preview(PreviewSessionRequest {
                preview_id: preview.preview_id,
            })
            .expect("dispose preview cycle");
        preview_peak_process = preview_peak_process.max(resources::snapshot());
        assert_eq!(runtime.resource_counts().preview_sessions, 0);
    }
    let after_preview_process = resources::snapshot();

    let mut thumbnail_peak_process = after_preview_process;
    for index in 0..100 {
        let thumbnail_entry = pages
            .iter()
            .flat_map(|page| page.entries.iter())
            .filter(|entry| matches!(entry.kind, BrowseEntryKindDto::File))
            .nth(index)
            .expect("100 distinct thumbnail fixture entries");
        let artifact = runtime
            .request_thumbnail(ThumbnailRequestDto {
                request_id: format!("resource-thumbnail-{index}"),
                source: thumbnail_entry.entry_ref.clone(),
                variant: ThumbnailVariantDto::Small,
                work_class: WorkClass::Foreground,
                session_id: Some(opened.session_id.clone()),
                source_generation: Some(
                    pages
                        .first()
                        .expect("10k Browse generation")
                        .enumeration_id
                        .clone(),
                ),
            })
            .expect("test renderer thumbnail cycle");
        assert!(!artifact.bytes.is_empty());
        thumbnail_peak_process = thumbnail_peak_process.max(resources::snapshot());
        assert_eq!(runtime.resource_counts().thumbnail_requests, 0);
    }
    let after_thumbnail_process = resources::snapshot();

    runtime
        .dispose_browse(BrowseSessionRequest {
            session_id: opened.session_id,
        })
        .expect("dispose 10k Browse target");

    let mut switch_peak_process = after_preview_process;
    for index in 0..100 {
        let switched = open_fixture(&runtime, &fixture, &format!("resource-switch-{index}"));
        runtime
            .start_enumeration(BrowseStartEnumerationRequest {
                session_id: switched.session_id.clone(),
                request_id: format!("resource-switch-enumeration-{index}"),
                path_ref: switched.root_path_ref,
                page_size: 64,
            })
            .expect("target-switch Browse page");
        runtime
            .dispose_browse(BrowseSessionRequest {
                session_id: switched.session_id,
            })
            .expect("dispose target switch");
        let counts = runtime.resource_counts();
        assert_eq!(counts.browse_sessions, 0);
        assert_eq!(counts.browse_service_sessions, 0);
        assert_eq!(counts.browse_entry_refs, 0);
        assert_eq!(counts.browse_path_refs, 0);
        switch_peak_process = switch_peak_process.max(resources::snapshot());
    }

    assert!(runtime.dispose());
    let settled = runtime.resource_counts();
    // Give ThumbnailService dispatch workers and OS accounting a bounded
    // settling window before interpreting process resources.
    thread::sleep(Duration::from_millis(250));
    let mut settled_samples = Vec::new();
    for _ in 0..5 {
        settled_samples.push(resources::snapshot());
        thread::sleep(Duration::from_millis(100));
    }
    let settled_process = *settled_samples.last().expect("settled resource sample");
    let settled_resources_are_stable = settled_samples.windows(2).all(|samples| {
        samples[0].rss_bytes == samples[1].rss_bytes
            && samples[0].handle_count == samples[1].handle_count
            && samples[0].fd_count == samples[1].fd_count
    });
    let process_resource_monotonic_growth = settled_samples.windows(2).all(|samples| {
        let rss_growth = matches!((samples[0].rss_bytes, samples[1].rss_bytes),
            (Some(before), Some(after)) if after > before);
        let handle_growth = matches!((samples[0].handle_count, samples[1].handle_count),
            (Some(before), Some(after)) if after > before);
        let fd_growth = matches!((samples[0].fd_count, samples[1].fd_count),
            (Some(before), Some(after)) if after > before);
        rss_growth || handle_growth || fd_growth
    });
    let settled_rss_samples = settled_samples
        .iter()
        .map(|sample| sample.rss_bytes)
        .collect::<Vec<_>>();
    let settled_handle_samples = settled_samples
        .iter()
        .map(|sample| sample.handle_count)
        .collect::<Vec<_>>();
    let settled_fd_samples = settled_samples
        .iter()
        .map(|sample| sample.fd_count)
        .collect::<Vec<_>>();
    assert_eq!(settled.browse_sessions, 0);
    assert_eq!(settled.browse_service_sessions, 0);
    assert_eq!(settled.browse_entry_refs, 0);
    assert_eq!(settled.browse_path_refs, 0);
    assert_eq!(settled.change_monitors, 0);
    assert_eq!(settled.preview_sessions, 0);
    assert_eq!(settled.thumbnail_requests, 0);

    metrics::emit_metric(
        "resource_observations",
        metrics::OBSERVED,
        [
            ("idle_rss_bytes".to_string(), json!(idle_process.rss_bytes)),
            (
                "ten_k_browse_rss_bytes".to_string(),
                json!(ten_k_process.rss_bytes),
            ),
            (
                "preview_100_cycle_peak_rss_bytes".to_string(),
                json!(preview_peak_process.rss_bytes),
            ),
            (
                "thumbnail_100_cycle_peak_rss_bytes".to_string(),
                json!(thumbnail_peak_process.rss_bytes),
            ),
            (
                "target_switch_100_cycle_peak_rss_bytes".to_string(),
                json!(switch_peak_process.rss_bytes),
            ),
            (
                "after_thumbnail_rss_bytes".to_string(),
                json!(after_thumbnail_process.rss_bytes),
            ),
            (
                "settled_rss_bytes".to_string(),
                json!(settled_process.rss_bytes),
            ),
            (
                "idle_handle_count".to_string(),
                json!(idle_process.handle_count),
            ),
            (
                "ten_k_browse_handle_count".to_string(),
                json!(ten_k_process.handle_count),
            ),
            (
                "preview_100_cycle_peak_handle_count".to_string(),
                json!(preview_peak_process.handle_count),
            ),
            (
                "thumbnail_100_cycle_peak_handle_count".to_string(),
                json!(thumbnail_peak_process.handle_count),
            ),
            (
                "target_switch_100_cycle_peak_handle_count".to_string(),
                json!(switch_peak_process.handle_count),
            ),
            (
                "settled_handle_count".to_string(),
                json!(settled_process.handle_count),
            ),
            ("idle_fd_count".to_string(), json!(idle_process.fd_count)),
            (
                "ten_k_browse_fd_count".to_string(),
                json!(ten_k_process.fd_count),
            ),
            (
                "preview_100_cycle_peak_fd_count".to_string(),
                json!(preview_peak_process.fd_count),
            ),
            (
                "thumbnail_100_cycle_peak_fd_count".to_string(),
                json!(thumbnail_peak_process.fd_count),
            ),
            (
                "target_switch_100_cycle_peak_fd_count".to_string(),
                json!(switch_peak_process.fd_count),
            ),
            (
                "settled_fd_count".to_string(),
                json!(settled_process.fd_count),
            ),
            (
                "resource_sample_stable".to_string(),
                json!(settled_resources_are_stable),
            ),
            (
                "process_resource_monotonic_growth_observed".to_string(),
                json!(process_resource_monotonic_growth),
            ),
            (
                "settled_rss_samples".to_string(),
                json!(settled_rss_samples),
            ),
            (
                "settled_handle_samples".to_string(),
                json!(settled_handle_samples),
            ),
            ("settled_fd_samples".to_string(), json!(settled_fd_samples)),
            ("thumbnail_renderer".to_string(), json!("test.performance")),
            ("native_thumbnail".to_string(), json!(false)),
            ("fixture_root_scope".to_string(), json!("repository-local")),
        ],
    );
    metrics::emit_metric(
        "resource_registry_steady_state",
        if process_resource_monotonic_growth {
            metrics::BLOCKED
        } else {
            metrics::HARD_PASS
        },
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
                "browse_entry_refs".to_string(),
                json!(settled.browse_entry_refs),
            ),
            (
                "browse_path_refs".to_string(),
                json!(settled.browse_path_refs),
            ),
            (
                "change_monitors".to_string(),
                json!(settled.change_monitors),
            ),
            (
                "preview_sessions".to_string(),
                json!(settled.preview_sessions),
            ),
            (
                "thumbnail_requests".to_string(),
                json!(settled.thumbnail_requests),
            ),
            ("preview_cycles".to_string(), json!(100)),
            ("thumbnail_cycles".to_string(), json!(100)),
            ("target_switch_cycles".to_string(), json!(100)),
            (
                "process_resource_monotonic_growth_observed".to_string(),
                json!(process_resource_monotonic_growth),
            ),
        ],
    );
    assert!(
        !process_resource_monotonic_growth,
        "process resource samples were strictly monotonic after the bounded settling window"
    );
}
