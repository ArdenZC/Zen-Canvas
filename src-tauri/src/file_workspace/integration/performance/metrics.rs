use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeMap;

pub(crate) const HARD_PASS: &str = "HARD PASS";
pub(crate) const TARGET_MET: &str = "TARGET MET";
pub(crate) const TARGET_MISSED: &str = "TARGET MISSED";
pub(crate) const OBSERVED: &str = "OBSERVED";
pub(crate) const UNVERIFIED: &str = "UNVERIFIED";
pub(crate) const BLOCKED: &str = "BLOCKED";

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
