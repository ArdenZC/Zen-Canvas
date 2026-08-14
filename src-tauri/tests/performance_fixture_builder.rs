mod support;

use std::{env, path::PathBuf};

use support::performance_fixture::{
    library_fixture_path, prepare_library_fixture, validate_fixture,
};

#[test]
#[ignore = "build reusable performance fixtures before suite benchmarks"]
fn build_requested_performance_fixtures() {
    let root = PathBuf::from(env::var("ZC_PERF_FIXTURE_ROOT").expect("ZC_PERF_FIXTURE_ROOT"));
    let profile = env::var("ZC_PERFORMANCE_PROFILE").unwrap_or_else(|_| "extended".into());
    let rows = if profile == "full" {
        vec![100_000, 1_000_000]
    } else {
        vec![100_000]
    };
    for row_count in rows {
        prepare_library_fixture(&root, row_count);
        validate_fixture(&library_fixture_path(&root, row_count), row_count);
        println!("Reusable File Library fixture ready: rows={row_count}");
    }
}
