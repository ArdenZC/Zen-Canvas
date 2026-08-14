import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const interactiveWorkflow = readFileSync(".github/workflows/ci.yml", "utf8");
const fullWorkflow = readFileSync(".github/workflows/ci-full.yml", "utf8");
const releaseWorkflow = readFileSync(".github/workflows/release-build.yml", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};

function section(source: string, job: string, nextJob?: string) {
  const start = source.indexOf(`  ${job}:`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = nextJob ? source.indexOf(`  ${nextJob}:`, start + 1) : source.length;
  return source.slice(start, end < 0 ? source.length : end);
}

describe("CI final performance remediation contract", () => {
  it("keeps Interactive and Full triggers, concurrency, and stable check names distinct", () => {
    expect(interactiveWorkflow).toContain("pull_request: {}");
    expect(interactiveWorkflow).toContain("ci-interactive-${{ github.ref }}");
    expect(interactiveWorkflow).not.toContain("schedule:");
    expect(interactiveWorkflow).not.toContain("workflow_dispatch:");
    expect(fullWorkflow).toContain("schedule:");
    expect(fullWorkflow).toContain("workflow_dispatch:");
    expect(fullWorkflow).toContain("ci-full-${{ github.ref }}");
    expect(fullWorkflow).not.toContain("pull_request:");
    expect(fullWorkflow).not.toContain("push:");
    for (const requiredName of [
      "name: Quality (windows-latest)",
      "name: Quality (macos-latest)",
      "name: Performance profile",
    ]) {
      expect(interactiveWorkflow).toContain(requiredName);
      expect(fullWorkflow).toContain(requiredName);
    }
  });

  it("declares one prepare job and four independent consumer shards", () => {
    const performanceJobs = [
      "performance-search",
      "performance-scan-schema",
      "performance-library-content",
      "performance-intelligence",
    ];
    for (const workflow of [interactiveWorkflow, fullWorkflow]) {
      expect(workflow).toContain("  performance-prepare:");
      expect(workflow).toContain("name: Performance / Prepare");
      for (const [index, job] of performanceJobs.entries()) {
        expect(workflow).toContain(`  ${job}:`);
        const nextJob = performanceJobs[index + 1]
          ?? (workflow === fullWorkflow ? "build-windows" : "performance-profile");
        const shard = section(workflow, job, nextJob);
        expect(shard).toContain("actions/download-artifact");
        expect(shard).not.toContain("Swatinem/rust-cache");
        expect(shard).not.toContain("actions/cache@");
        expect(shard).not.toContain("cargo test");
        expect(shard).toContain(".performance-temp");
      }
      expect(section(workflow, "performance-profile")).toContain("performance-prepare");
    }
    expect(section(interactiveWorkflow, "performance-prepare", "performance-search")).toContain("preparePerformanceBinaries.mjs");
    expect(section(interactiveWorkflow, "performance-prepare", "performance-search")).toContain("preparePerformanceFixtures.mjs");
    expect(section(fullWorkflow, "performance-prepare", "performance-search")).toContain("preparePerformanceBinaries.mjs");
  });

  it("makes Performance Prepare the only performance Rust cache writer", () => {
    for (const workflow of [interactiveWorkflow, fullWorkflow]) {
      const prepare = section(workflow, "performance-prepare");
      expect(prepare).toContain("Swatinem/rust-cache");
      expect(prepare).toContain("shared-key: zen-canvas-Windows-performance-v3");
      expect(prepare).toContain("add-job-id-key: false");
      expect(prepare).toContain("cache-workspace-crates: true");
      expect(prepare).toContain("cache-targets: true");
      expect(prepare).toContain("cache-on-failure: true");
      expect((workflow.match(/shared-key: zen-canvas-Windows-performance-v3/g) ?? []).length).toBe(1);
      expect(workflow).not.toContain("zen-canvas-Windows-performance-v2");
      expect(prepare).toContain("actions/cache@5a3ec84eff668545956fd18022155c47e93e2684 # v4.2.3");
      expect(prepare).toContain("actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7");
      expect(prepare).not.toContain("github.sha");
      expect(prepare).not.toContain("github.run_id");
    }
  });

  it("uses domain-specific artifacts and direct prepared-binary execution", () => {
    for (const workflow of [interactiveWorkflow, fullWorkflow]) {
      for (const artifact of [
        "perf-bin-search",
        "perf-bin-scan-schema",
        "perf-bin-library-content",
        "perf-bin-intelligence",
      ]) {
        expect(workflow).toContain(`name: ${artifact}`);
      }
      expect(workflow).toContain("name: perf-fixture-library-content");
      expect(workflow).toContain("--prepared-binaries=.performance-artifacts/binaries");
      expect(workflow).not.toContain("--prepare-missing-fixtures");
    }
    expect(section(interactiveWorkflow, "performance-profile")).toContain("EXPECTED_ANY");
    expect(section(interactiveWorkflow, "performance-profile")).toContain("expected skipped");
  });

  it("preserves routing, release, package, and build boundaries", () => {
    for (const output of [
      "perf_search",
      "perf_scan_schema",
      "perf_library_content",
      "perf_intelligence",
      "frontend_changed",
      "rust_changed",
      "macos_sensitive",
      "package_sensitive",
      "dependency_sensitive",
    ]) {
      expect(interactiveWorkflow).toContain(output + ": ${{ steps.classify.outputs." + output + " }}");
    }
    expect(interactiveWorkflow).toContain("needs.change-scope.outputs.rust_changed == 'true'");
    expect(interactiveWorkflow).toContain("needs.change-scope.outputs.macos_sensitive == 'true'");
    expect(interactiveWorkflow).toContain("needs.change-scope.outputs.release_sensitive == 'true'");
    expect(packageJson.scripts["build:check"]).toContain("build:frontend");
    expect(packageJson.scripts["build:check"]).toContain("check:rust:release");
    expect(packageJson.scripts["check:rust:release"]).not.toContain("vite");
    expect(releaseWorkflow).toContain("npm run test:performance:pr");
    expect(fullWorkflow).toContain("npm run build -- --no-sign");
  });

  it("pins actions and keeps packaging and quality checks authoritative", () => {
    for (const workflow of [interactiveWorkflow, fullWorkflow, releaseWorkflow]) {
      expect(workflow).toContain("actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7");
      expect(workflow).toContain("actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7");
      expect(workflow).not.toContain("sccache");
    }
    expect(fullWorkflow).toContain("name: Package NSIS");
    expect(fullWorkflow).toContain("name: Package unsigned DMG");
    expect(interactiveWorkflow).toContain("Package metadata smoke");
  });
});
