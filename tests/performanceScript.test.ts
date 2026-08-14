import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  getPerformanceBenchmarks,
  getPrecompileTargets,
  PERFORMANCE_SUITE_NAMES,
  PERFORMANCE_SUITES,
} from "../scripts/performanceManifest.mjs";
import { resolvePerformanceProfile } from "../scripts/performanceProfile.mjs";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("performance profile and manifest contract", () => {
  it("supports exactly the four named suites and two profiles", () => {
    expect(PERFORMANCE_SUITE_NAMES).toEqual(["search", "scan-schema", "library-content", "intelligence"]);
    expect(Object.keys(PERFORMANCE_SUITES)).toEqual([...PERFORMANCE_SUITE_NAMES]);
    expect(resolvePerformanceProfile([])).toBe("full");
    expect(resolvePerformanceProfile(["--profile=extended"])).toBe("extended");
    expect(() => resolvePerformanceProfile(["--profile=pr"])).toThrow("Unsupported performance profile: pr");
  });

  it("keeps one benchmark in exactly one suite and retains every 1M gate in Full", () => {
    const ids = new Set<string>();
    for (const suite of PERFORMANCE_SUITE_NAMES) {
      const extended = getPerformanceBenchmarks(suite, "extended") as Array<{ id: string }>;
      const full = getPerformanceBenchmarks(suite, "full") as Array<{ id: string }>;
      expect(extended.every((benchmark) => !benchmark.id.includes("1m"))).toBe(true);
      expect(new Set(full.map((benchmark) => benchmark.id)).size).toBe(full.length);
      for (const benchmark of extended) {
        expect(full.some((fullBenchmark) => fullBenchmark.id === benchmark.id)).toBe(true);
      }
      for (const benchmark of full) {
        expect(ids.has(benchmark.id)).toBe(false);
        ids.add(benchmark.id);
      }
      expect(getPrecompileTargets(suite).length).toBeGreaterThan(0);
    }
    expect(ids.has("global_search_1m")).toBe(true);
    expect(ids.has("file_library_1m")).toBe(true);
    expect(ids.has("file_library_migration_1m")).toBe(true);
    expect(ids.has("content_migration_1m")).toBe(true);
    expect(ids.has("rule_proposal_1m")).toBe(true);
  });

  it("rejects unknown suite arguments before starting Cargo", () => {
    const result = spawnSync(
      process.execPath,
      [path.join(process.cwd(), "scripts/runPerformanceSuite.mjs"), "--suite=unknown", "--profile=extended"],
      { cwd: process.cwd(), env: process.env, encoding: "utf8" },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unsupported performance suite: unknown");
  });

  it("uses exact target precompile and serial benchmark execution", () => {
    const source = read("scripts/runPerformanceSuite.mjs");
    expect(source).toContain('"--no-run"');
    expect(source).toContain('"--locked"');
    expect(source).toContain("getPrecompileTargets(suite)");
    expect(source).toContain("getPerformanceBenchmarks(suite, profile)");
    expect(source).toContain("for (const benchmark of");
    expect(source).toContain("ZC_FTS_FULL_PROFILE: String(profile === \"full\")");
    expect(read("scripts/runPerformanceTest.mjs")).toContain("runPerformanceProfile.mjs");
    expect(fs.existsSync(path.join(process.cwd(), "scripts/checkPerformanceArchitecture.mjs"))).toBe(true);
  });

  it("keeps the PR compatibility command bounded to one fresh 100k FTS sentinel", () => {
    const source = read("scripts/runPerformanceTestPr.mjs");
    expect(source).toContain('ZC_PERFORMANCE_PROFILE: "extended"');
    expect(source).toContain('ZC_FTS_FULL_PROFILE: "false"');
    expect(source).toContain("fts_benchmark_100k");
    expect(source).toContain('"--locked"');
    expect(source).not.toContain("vitest");
    expect(source.match(/fts_benchmark_100k/g)).toHaveLength(1);
  });

  it("keeps formal npm aliases mapped to the new profile runner", () => {
    const packageJson = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(packageJson.scripts["test:performance"]).toBe("node scripts/runPerformanceProfile.mjs --profile=full");
    expect(packageJson.scripts["test:performance:full"]).toBe("node scripts/runPerformanceProfile.mjs --profile=full");
    expect(packageJson.scripts["test:performance:extended"]).toBe("node scripts/runPerformanceProfile.mjs --profile=extended");
    expect(packageJson.scripts["test:performance:architecture"]).toBe("node scripts/checkPerformanceArchitecture.mjs");
    expect(fs.existsSync(path.join(process.cwd(), "scripts/runPerformanceTestExtended.mjs"))).toBe(false);
  });

  it("retains source-level 100k and 1M thresholds while moving architecture checks out", () => {
    const library = read("src-tauri/tests/file_library_performance.rs");
    const fts = read("src-tauri/tests/fts_benchmark.rs");
    const proposal = read("src-tauri/src/db/queries/rule_proposals/mod.rs");
    expect(library).toContain("performance_1m_file_library_query_matrix");
    expect(library).toContain("performance_1m_schema_32_to_33_rule_proposal_migration");
    expect(library).toContain("100_000");
    expect(library).toContain("1_000_000");
    expect(library).toContain("DAILY_COMMON_QUERY_P95_LIMIT_MS: f64 = 100.0");
    expect(library).toContain("COMPLEX_QUERY_P95_LIMIT_MS: f64 = 150.0");
    expect(fts).toContain('env::var("ZC_FTS_FULL_PROFILE")');
    expect(fts).toContain("if full_profile");
    expect(fts).toContain("const DEFAULT_ROWS: usize = 100_000");
    expect(fts).toContain("const DEFAULT_P95_MS: f64 = 1_000.0");
    expect(proposal).toContain('profile != "extended"');
    expect(proposal).toContain("for index in 100_000..1_000_000_usize");
  });
});
