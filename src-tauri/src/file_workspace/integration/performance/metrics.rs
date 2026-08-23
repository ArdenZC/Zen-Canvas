use serde::Serialize;
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::time::Duration;

pub(crate) const HARD_PASS: &str = "HARD PASS";
#[cfg(feature = "performance-test-tauri")]
pub(crate) const TARGET_MET: &str = "TARGET MET";
#[cfg(feature = "performance-test-tauri")]
pub(crate) const TARGET_MISSED: &str = "TARGET MISSED";
pub(crate) const OBSERVED: &str = "OBSERVED";
#[cfg(feature = "performance-test-tauri")]
pub(crate) const UNVERIFIED: &str = "UNVERIFIED";
pub(crate) const BLOCKED: &str = "BLOCKED";

// W3-10 Phase A freezes the measurement vocabulary and target values here so
// Preview timing tests extend the existing [zc-perf] contract. These values
// are evidence metadata; they never turn a local run into final acceptance.
pub(crate) const PREVIEW_METRIC_DEFINITION: &str = "w3-10-phase-a-v1";
pub(crate) const PREVIEW_FIXTURE_MANIFEST: &str = "w3-10-preview-fixtures-v1";
pub(crate) const PREVIEW_SHELL_FIRST_VISIBLE_TARGET_P95_MS: f64 = 100.0;
pub(crate) const PREVIEW_USEFUL_REPRESENTATION_TARGET_P95_MS: f64 = 300.0;
pub(crate) const PREVIEW_NATIVE_USEFUL_REPRESENTATION_TARGET_P95_MS: f64 = 1_000.0;
pub(crate) const PREVIEW_RAPID_SWITCH_ENTRIES: usize = 100;
pub(crate) const PREVIEW_WARMUP_SAMPLES: usize = 3;
pub(crate) const PREVIEW_TIMING_SAMPLES: usize = 20;

#[derive(Debug, Serialize)]
struct PerformanceMetric {
    schema: u8,
    suite: String,
    scenario: String,
    classification: String,
    platform: &'static str,
    #[serde(flatten)]
    fields: BTreeMap<String, Value>,
}

pub(crate) fn emit_metric(
    scenario: impl Into<String>,
    classification: impl Into<String>,
    fields: impl IntoIterator<Item = (String, Value)>,
) {
    let metric = PerformanceMetric {
        schema: 1,
        suite: std::env::var("ZC_PERF_SUITE")
            .unwrap_or_else(|_| "workspace-foundation".to_string()),
        scenario: scenario.into(),
        classification: classification.into(),
        platform: if cfg!(target_os = "windows") {
            "windows"
        } else if cfg!(target_os = "macos") {
            "macos"
        } else {
            "unsupported"
        },
        fields: fields.into_iter().collect(),
    };
    println!(
        "[zc-perf] {}",
        serde_json::to_string(&metric).expect("performance metric serializes")
    );
}

/// Return deterministic percentile fields for an already-warmed timing
/// sample. The measured operation must be outside fixture/setup work, and the
/// caller must pass only post-warmup samples. Percentiles use the nearest
/// observed rank `ceil((n - 1) * p)`, making small Phase A samples stable
/// across Rust and browser evidence consumers.
pub(crate) fn timing_fields(
    samples: &[Duration],
    warmup_count: usize,
    target_p95_ms: Option<f64>,
    measurement_boundary: &str,
) -> Vec<(String, Value)> {
    assert!(
        !samples.is_empty(),
        "timing evidence requires at least one sample"
    );
    assert!(
        measurement_boundary.starts_with("backend_")
            || measurement_boundary.starts_with("browser_"),
        "timing evidence must name a backend_ or browser_ measurement boundary"
    );
    if let Some(target) = target_p95_ms {
        assert!(
            target.is_finite() && target > 0.0,
            "timing target must be finite and positive"
        );
    }

    let mut values_ms = samples
        .iter()
        .map(|sample| sample.as_secs_f64() * 1_000.0)
        .collect::<Vec<_>>();
    values_ms.sort_by(f64::total_cmp);
    let percentile = |p: f64| {
        let index = (((values_ms.len() - 1) as f64) * p).ceil() as usize;
        values_ms[index]
    };

    let mut fields = vec![
        (
            "metric_definition".to_string(),
            json!(PREVIEW_METRIC_DEFINITION),
        ),
        ("metric_kind".to_string(), json!("timing_percentile")),
        ("unit".to_string(), json!("ms")),
        (
            "percentile_method".to_string(),
            json!("nearest_observed_rank_ceil_n_minus_1_times_p"),
        ),
        (
            "measurement_boundary".to_string(),
            json!(measurement_boundary),
        ),
        ("warmup_count".to_string(), json!(warmup_count)),
        ("sample_count".to_string(), json!(samples.len())),
        ("min_ms".to_string(), json!(values_ms[0])),
        ("p50_ms".to_string(), json!(percentile(0.50))),
        ("p95_ms".to_string(), json!(percentile(0.95))),
        (
            "max_ms".to_string(),
            json!(*values_ms.last().expect("non-empty timing samples")),
        ),
    ];
    if let Some(target) = target_p95_ms {
        fields.push(("target_p95_ms".to_string(), json!(target)));
    }
    fields
}

#[cfg(test)]
mod tests {
    use super::timing_fields;
    use std::time::Duration;

    #[test]
    fn timing_percentiles_use_sorted_nearest_observed_rank() {
        let fields = timing_fields(
            &[
                Duration::from_millis(40),
                Duration::from_millis(10),
                Duration::from_millis(30),
                Duration::from_millis(20),
            ],
            3,
            Some(100.0),
            "backend_preview_start_return",
        );
        let value = |name: &str| {
            fields
                .iter()
                .find(|(key, _)| key == name)
                .map(|(_, value)| value)
                .expect("metric field")
                .as_f64()
                .expect("numeric metric field")
        };
        assert_eq!(value("min_ms"), 10.0);
        assert_eq!(value("p50_ms"), 30.0);
        assert_eq!(value("p95_ms"), 40.0);
        assert_eq!(value("max_ms"), 40.0);
    }

    #[test]
    #[should_panic(expected = "timing evidence requires at least one sample")]
    fn timing_percentiles_reject_empty_samples() {
        let _ = timing_fields(&[], 0, None, "backend_preview_start_return");
    }
}
