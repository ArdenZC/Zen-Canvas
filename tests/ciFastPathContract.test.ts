import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const interactiveWorkflow = readFileSync(".github/workflows/ci.yml", "utf8");
const fullWorkflow = readFileSync(".github/workflows/ci-full.yml", "utf8");
const releaseWorkflow = readFileSync(".github/workflows/release-build.yml", "utf8");
const classifierSource = readFileSync("scripts/classifyCiChanges.mjs", "utf8");
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

  it("declares one prepare job and five independent consumer shards", () => {
    const performanceJobs = [
      "performance-search",
      "performance-scan-schema",
      "performance-library-content",
      "performance-intelligence",
      "performance-workspace-foundation",
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
        if (job === "performance-library-content") {
          expect(shard).toContain("actions/cache/restore@");
          expect(shard).not.toContain("actions/cache/save@");
        } else {
          expect(shard).not.toContain("actions/cache/restore@");
          expect(shard).not.toContain("actions/cache/save@");
        }
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
      expect(prepare).toContain("actions/cache/restore@5a3ec84eff668545956fd18022155c47e93e2684 # v4.2.3");
      expect(prepare).toContain("actions/cache/save@5a3ec84eff668545956fd18022155c47e93e2684 # v4.2.3");
      expect(prepare).toContain(".performance-cache/binaries");
      expect(prepare).toContain("performanceBuildIdentity.mjs");
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
        "perf-bin-workspace-foundation",
      ]) {
        expect(workflow).toContain(`name: ${artifact}`);
      }
      expect(workflow).not.toContain("name: perf-fixture-library-content");
      expect(workflow).not.toContain(".performance-artifacts/fixtures");
      expect(workflow).toContain("fixture_cache_key");
      expect(workflow).toContain("fixture_identity");
      expect(workflow).toContain("--fixture-root=.tmp-performance-fixtures/cache");
      expect(workflow).toContain("--prepared-binaries=.performance-artifacts/binaries");
      expect(workflow).not.toContain("--prepare-missing-fixtures");
    }
    expect(section(interactiveWorkflow, "performance-profile")).toContain("EXPECTED_ANY");
    expect(section(interactiveWorkflow, "performance-profile")).toContain("expected skipped");
  });

  it("preserves the Round 2 macOS routing and native performance contract", () => {
    for (const prefix of [
      '"src-tauri/src/platform/macos/"',
      '"src-tauri/src/global_index/macos/"',
      '"src-tauri/src/runtime_capabilities.rs"',
      '"src-tauri/src/scanner.rs"',
    ]) {
      expect(classifierSource).toContain(prefix);
    }
    expect(classifierSource).not.toContain('path.startsWith("src-tauri/src/scanner/")');
    expect(interactiveWorkflow).toContain("performance_sensitive: ${{ steps.classify.outputs.performance_sensitive }}");
    expect(interactiveWorkflow).toContain("  performance-macos:");
    expect(interactiveWorkflow).toContain("name: Native macOS performance (arm64)");
    expect(interactiveWorkflow).toContain("macos_file_provider_feasibility");
    expect(interactiveWorkflow).toContain("Prepare native Workspace Foundation performance binary");
    expect(interactiveWorkflow).toContain("--suites=workspace-foundation");
    expect(interactiveWorkflow).toContain("--suite=workspace-foundation");
    expect(fullWorkflow).toContain("  performance-macos:");
    expect(fullWorkflow).toContain("name: Native macOS performance (arm64)");
    expect(fullWorkflow).toContain("macos_native_bookkeeping_benchmark_is_bounded_by_unique_identity");
    expect(fullWorkflow).toContain("Prepare native Workspace Foundation performance binary");
    expect(fullWorkflow).toContain("--suites=workspace-foundation");
    expect(fullWorkflow).toContain("--suite=workspace-foundation");
  });

  it("preserves routing, release, package, and build boundaries", () => {
    for (const output of [
      "perf_search",
      "perf_scan_schema",
      "perf_library_content",
      "perf_intelligence",
      "perf_workspace_foundation",
      "frontend_changed",
      "rust_changed",
      "macos_sensitive",
      "performance_sensitive",
      "high_risk",
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

  it("runs the committed W2-01 real-browser gate with a lockfile-keyed Chromium cache", () => {
    for (const workflow of [interactiveWorkflow, fullWorkflow]) {
      const frontend = section(workflow, "frontend-quality", "rust-windows");
      expect(frontend).toContain("PLAYWRIGHT_BROWSERS_PATH");
      expect(frontend).toContain("actions/cache@5a3ec84eff668545956fd18022155c47e93e2684 # v4.2.3");
      expect(frontend).toContain("zen-canvas-playwright-${{ runner.os }}-${{ runner.arch }}-${{ hashFiles('package-lock.json') }}");
      expect(frontend).toContain("npx playwright install --with-deps chromium");
      expect(frontend).toContain("W2-01 real browser regression gate");
      expect(frontend).toContain("W201_SOURCE_HEAD: ${{ github.event.pull_request.head.sha || github.sha }}");
      expect(frontend).toContain("npm run test:browser:w2-01:real");
      expect(frontend).toContain("w2-01-browser-gate-failure");
    }
  });
});
