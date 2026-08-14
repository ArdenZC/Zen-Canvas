import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { resolvePerformanceProfile } from "../scripts/performanceProfile.mjs";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function runProfileResolverProcess(profileArgument: string, ambientProfile: string) {
  const resolverSource = [
    'import { resolvePerformanceProfile } from "./scripts/performanceProfile.mjs";',
    "try {",
    "  console.log(resolvePerformanceProfile(process.argv.slice(1)));",
    "} catch (error) {",
    "  console.error(error instanceof Error ? error.message : String(error));",
    "  process.exitCode = 1;",
    "}",
  ].join("\n");

  return spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", resolverSource, "--", profileArgument],
    {
      cwd: process.cwd(),
      env: { ...process.env, ZC_PERFORMANCE_PROFILE: ambientProfile },
      encoding: "utf8",
    },
  );
}

describe("performance benchmark script", () => {
  it("uses an explicit CLI profile over the ambient profile at process boundary", () => {
    const full = runProfileResolverProcess("--profile=full", "extended");
    const extended = runProfileResolverProcess("--profile=extended", "full");

    expect(full.status).toBe(0);
    expect(full.stdout.trim()).toBe("full");
    expect(extended.status).toBe(0);
    expect(extended.stdout.trim()).toBe("extended");
  });

  it("defaults direct resolver calls to Full without a CLI profile", () => {
    expect(resolvePerformanceProfile([])).toBe("full");
  });

  it("rejects an unknown profile before starting the benchmark runner", () => {
    const result = spawnSync(
      process.execPath,
      [path.join(process.cwd(), "scripts/runPerformanceTest.mjs"), "--profile=foo"],
      {
        cwd: process.cwd(),
        env: { ...process.env, ZC_PERFORMANCE_PROFILE: "full" },
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unsupported performance profile: foo");
  });

  it("keeps the formal npm performance scripts explicit", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["test:performance"]).toBe(
      "node scripts/runPerformanceTest.mjs --profile=full",
    );
    expect(packageJson.scripts["test:performance:full"]).toBe(
      "node scripts/runPerformanceTest.mjs --profile=full",
    );
    expect(packageJson.scripts["test:performance:extended"]).toBe(
      "node scripts/runPerformanceTest.mjs --profile=extended",
    );
    expect(fs.existsSync(path.join(process.cwd(), "scripts/runPerformanceTestExtended.mjs"))).toBe(false);
  });

  it("runs the 100k SQLite benchmark with all required query scenarios", () => {
    const source = read("scripts/runPerformanceTest.mjs");

    expect(source).toContain("fts_benchmark_100k");
    expect(source).toContain("english_search");
    expect(source).toContain("cjk_search");
    expect(source).toContain("extension_search");
    expect(source).toContain("scope_query");
    expect(source).toContain("filter_query");
    expect(source).toContain("query_filter_query");
  });

  it("runs the Task 02 repository and bounded hash IO gates with a reduced fixture", () => {
    const source = read("scripts/runPerformanceTest.mjs");

    expect(source).toContain("performance_100k_files_schema_28_to_29_and_wal_reader");
    expect(source).toContain("performance_task02_repository_100k_and_group_pages");
    expect(source).toContain("performance_task02_hash_io_1000x16mib_1_worker_and_default_workers");
    expect(source).toContain('ZC_TASK02_IO_FILES: "16"');
    expect(source).toContain('ZC_TASK02_IO_BYTES: "1048576"');
  });

  it("runs the Task 05 handoff and Task 06 durable plan performance gates", () => {
    const source = read("scripts/runPerformanceTest.mjs");

    expect(source).toContain("performance_1m_file_library_query_matrix");
    expect(source).toContain("performance_task06_plan_100_1k_10k_repository");
    expect(source).toContain("performance_100k_schema_32_to_33_rule_proposal_migration");
    expect(source).toContain("performance_1m_schema_32_to_33_rule_proposal_migration");
    expect(source).toContain("performance_task07_rule_proposal_repository_and_impact");
  });

  it("scopes Cargo tests to their actual unit or integration target", () => {
    const source = read("scripts/runPerformanceTest.mjs");
    const prSource = read("scripts/runPerformanceTestPr.mjs");

    expect(source).toContain('"--test",\n    "fts_benchmark"');
    expect(source).toContain('"--test",\n    "migrations"');
    expect(source).toContain('"--test",\n      "file_library_performance"');
    expect(source).toContain('"--test",\n    "file_library_performance",\n    "performance_100k_schema_32_to_33_rule_proposal_migration"');
    expect(source).toContain('"--lib",\n    null,\n    "performance_task07_rule_proposal_repository_and_impact"');
    expect(source).toContain('"--lib",\n    "global_search_performance_100k_synthetic_entries"');
    expect(source).toContain('"--lib",\n    "performance_task06_plan_100_1k_10k_repository"');
    expect(prSource).toContain('"--test",\n    "fts_benchmark"');
  });

  it("keeps 1M gates in Full while Extended selects only the bounded path", () => {
    const source = read("scripts/runPerformanceTest.mjs");
    const prSource = read("scripts/runPerformanceTestPr.mjs");
    const ftsSource = read("src-tauri/tests/fts_benchmark.rs");
    const proposalSource = read("src-tauri/src/db/queries/rule_proposals/mod.rs");

    expect(source).toContain('const fullProfile = performanceProfile === "full";');
    expect(source).toContain("ZC_PERFORMANCE_PROFILE: performanceProfile");
    expect(source).toContain("ZC_FTS_FULL_PROFILE: String(fullProfile)");
    expect(source).not.toContain("process.env.ZC_PERFORMANCE_PROFILE ??");
    expect(prSource).toContain('ZC_PERFORMANCE_PROFILE: "pr"');
    expect(prSource).toContain('ZC_FTS_FULL_PROFILE: "false"');
    expect(source).toContain("global_search_performance_one_million_synthetic_entries");
    expect(source).toContain("performance_1m_file_library_query_matrix");
    expect(source).toContain("performance_1m_schema_32_to_33_rule_proposal_migration");
    expect(ftsSource).toContain('env::var("ZC_FTS_FULL_PROFILE")');
    expect(ftsSource).toContain("if full_profile");
    expect(proposalSource).toContain('profile != "extended"');
    expect(proposalSource).toContain("for index in 100_000..1_000_000_usize");
  });
});
