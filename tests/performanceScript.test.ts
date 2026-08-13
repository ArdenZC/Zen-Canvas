import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("performance benchmark script", () => {
  it("runs the 100k SQLite benchmark with all required query scenarios", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "scripts/runPerformanceTest.mjs"), "utf8");

    expect(source).toContain("fts_benchmark_100k");
    expect(source).toContain("english_search");
    expect(source).toContain("cjk_search");
    expect(source).toContain("extension_search");
    expect(source).toContain("scope_query");
    expect(source).toContain("filter_query");
    expect(source).toContain("query_filter_query");
  });

  it("runs the Task 02 repository and bounded hash IO gates with a reduced fixture", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "scripts/runPerformanceTest.mjs"), "utf8");

    expect(source).toContain("performance_100k_files_schema_28_to_29_and_wal_reader");
    expect(source).toContain("performance_task02_repository_100k_and_group_pages");
    expect(source).toContain("performance_task02_hash_io_1000x16mib_1_worker_and_default_workers");
    expect(source).toContain('ZC_TASK02_IO_FILES: "16"');
    expect(source).toContain('ZC_TASK02_IO_BYTES: "1048576"');
  });

  it("runs the Task 05 handoff and Task 06 durable plan performance gates", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "scripts/runPerformanceTest.mjs"), "utf8");

    expect(source).toContain("performance_1m_file_library_query_matrix");
    expect(source).toContain("performance_task06_plan_100_1k_10k_repository");
    expect(source).toContain("performance_100k_schema_32_to_33_rule_proposal_migration");
    expect(source).toContain("performance_1m_schema_32_to_33_rule_proposal_migration");
    expect(source).toContain("performance_task07_rule_proposal_repository_and_impact");
  });

  it("scopes Cargo tests to their actual unit or integration target", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "scripts/runPerformanceTest.mjs"), "utf8");
    const prSource = fs.readFileSync(path.join(process.cwd(), "scripts/runPerformanceTestPr.mjs"), "utf8");

    expect(source).toContain('"--test",\n    "fts_benchmark"');
    expect(source).toContain('"--test",\n    "migrations"');
    expect(source).toContain('"--test",\n      "file_library_performance"');
    expect(source).toContain('"--test",\n    "file_library_performance",\n    "performance_100k_schema_32_to_33_rule_proposal_migration"');
    expect(source).toContain('"--lib",\n    null,\n    "performance_task07_rule_proposal_repository_and_impact"');
    expect(source).toContain('"--lib",\n    "global_search_performance_100k_synthetic_entries"');
    expect(source).toContain('"--lib",\n    "performance_task06_plan_100_1k_10k_repository"');
    expect(prSource).toContain('"--test",\n    "fts_benchmark"');
  });

  it("keeps 1M gates in Full while the Extended profile selects only the 100k path", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "scripts/runPerformanceTest.mjs"), "utf8");
    const extendedSource = fs.readFileSync(path.join(process.cwd(), "scripts/runPerformanceTestExtended.mjs"), "utf8");
    const ftsSource = fs.readFileSync(path.join(process.cwd(), "src-tauri/tests/fts_benchmark.rs"), "utf8");
    const proposalSource = fs.readFileSync(path.join(process.cwd(), "src-tauri/src/db/queries/rule_proposals/mod.rs"), "utf8");

    expect(source).toContain('const fullProfile = performanceProfile === "full";');
    expect(source).toContain("global_search_performance_one_million_synthetic_entries");
    expect(source).toContain("performance_1m_file_library_query_matrix");
    expect(source).toContain("performance_1m_schema_32_to_33_rule_proposal_migration");
    expect(extendedSource).toContain('ZC_PERFORMANCE_PROFILE: "extended"');
    expect(ftsSource).toContain('env::var("ZC_FTS_FULL_PROFILE")');
    expect(proposalSource).toContain('profile != "extended"');
  });
});
