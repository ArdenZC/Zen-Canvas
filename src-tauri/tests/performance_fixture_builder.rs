mod support;

use std::{env, path::PathBuf};

use support::performance_fixture::{prepare_library_fixture, prepare_library_working_copy};

#[test]
#[ignore = "build reusable performance fixtures before suite benchmarks"]
fn build_requested_performance_fixtures() {
    let root = PathBuf::from(env::var("ZC_PERF_FIXTURE_ROOT").expect("ZC_PERF_FIXTURE_ROOT"));
    let working_root = PathBuf::from(
        env::var("ZC_PERF_FIXTURE_WORKING_ROOT").unwrap_or_else(|_| root.display().to_string()),
    );
    let profile = env::var("ZC_PERFORMANCE_PROFILE").unwrap_or_else(|_| "extended".into());
    let rows = if profile == "full" {
        vec![100_000, 1_000_000]
    } else {
        vec![100_000]
    };
    for row_count in rows {
        prepare_library_fixture(&root, row_count);
        for purpose in ["query", "library-migration", "content-migration"] {
            prepare_library_working_copy(&root, &working_root, row_count, purpose);
        }
        println!("Reusable File Library fixture ready: rows={row_count}");
    }
}
