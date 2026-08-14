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
  const end = nextJob ? source.indexOf(`\n\n  ${nextJob}:`, start) : source.length;
  return source.slice(start, end < 0 ? source.length : end);
}

describe("CI final optimization contract", () => {
  it("keeps Interactive and Full triggers, concurrency, and stable check names distinct", () => {
    expect(interactiveWorkflow).toContain("pull_request: {}");
    expect(interactiveWorkflow).toContain("branches:");
    expect(interactiveWorkflow).toContain("ci-interactive-${{ github.ref }}");
    expect(interactiveWorkflow).not.toContain("schedule:");
    expect(interactiveWorkflow).not.toContain("workflow_dispatch:");
    expect(fullWorkflow).toContain("schedule:");
    expect(fullWorkflow).toContain("workflow_dispatch:");
    expect(fullWorkflow).toContain("ci-full-${{ github.ref }}");
    expect(fullWorkflow).not.toContain("pull_request:");
    expect(fullWorkflow).not.toContain("push:");
    expect(interactiveWorkflow).not.toContain("performance_sensitive");
    expect(fullWorkflow).not.toContain("performance_sensitive");
    for (const requiredName of [
      "name: Quality (windows-latest)",
      "name: Quality (macos-latest)",
      "name: Performance profile",
    ]) {
      expect(interactiveWorkflow).toContain(requiredName);
      expect(fullWorkflow).toContain(requiredName);
    }
  });

  it("declares every independent performance shard and a terminal aggregate", () => {
    for (const job of [
      "performance-search",
      "performance-scan-schema",
      "performance-library-content",
      "performance-intelligence",
    ]) {
      expect(interactiveWorkflow).toContain(`  ${job}:`);
      expect(fullWorkflow).toContain(`  ${job}:`);
    }
    expect(interactiveWorkflow).toContain("needs: [change-scope, performance-search, performance-scan-schema, performance-library-content, performance-intelligence]");
    expect(fullWorkflow).toContain("needs: [performance-search, performance-scan-schema, performance-library-content, performance-intelligence]");
    expect(interactiveWorkflow).toContain("Run Search performance suite");
    expect(interactiveWorkflow).toContain("Run Scan and Schema performance suite");
    expect(interactiveWorkflow).toContain("Run Library and Content performance suite");
    expect(interactiveWorkflow).toContain("Run Intelligence performance suite");
    expect(fullWorkflow).toContain("Run Search Full suite");
  });

  it("uses change-aware routing and records expected skips", () => {
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
    expect(interactiveWorkflow).toContain("EXPECTED_SEARCH");
    expect(interactiveWorkflow).toContain("expected skipped");
    expect(interactiveWorkflow).toContain("needs.change-scope.outputs.rust_changed == 'true'");
    expect(interactiveWorkflow).toContain("needs.change-scope.outputs.macos_sensitive == 'true'");
    expect(interactiveWorkflow).toContain("needs.change-scope.outputs.release_sensitive == 'true'");
  });

  it("keeps bounded, full, cache, and precompile responsibilities in the right layers", () => {
    expect(interactiveWorkflow).toContain("npm run test:performance:architecture");
    expect(interactiveWorkflow).not.toContain("npm run test:performance:pr");
    expect(interactiveWorkflow).not.toContain("npm run test:performance:extended");
    expect(interactiveWorkflow).not.toContain("npm run test:performance:full");
    expect(fullWorkflow).toContain("--profile=full");
    expect(interactiveWorkflow).toContain("--profile=${{ needs.change-scope.outputs.full_validation == 'true' && 'full' || 'extended' }}");
    expect(interactiveWorkflow).toContain("actions/cache@5a3ec84eff668545956fd18022155c47e93e2684 # v4.2.3");
    expect(interactiveWorkflow).toContain("zen-canvas-Windows-performance-v2");
    expect(fullWorkflow).toContain("zen-canvas-Windows-performance-v2");
    for (const [job, nextJob] of [
      ["performance-search", "performance-scan-schema"],
      ["performance-scan-schema", "performance-library-content"],
      ["performance-library-content", "performance-intelligence"],
      ["performance-intelligence", "performance-profile"],
    ]) {
      const jobSource = section(interactiveWorkflow, job, nextJob);
      expect(jobSource).not.toContain("npm ci");
    }
    expect(section(interactiveWorkflow, "build-windows", "build-macos")).not.toContain("npm ci");
    expect(section(interactiveWorkflow, "build-macos", "package-windows")).not.toContain("npm ci");
    expect(packageJson.scripts["build:check"]).toContain("build:frontend");
    expect(packageJson.scripts["build:check"]).toContain("check:rust:release");
    expect(packageJson.scripts["check:rust:release"]).not.toContain("vite");
    expect(releaseWorkflow).toContain("npm run test:performance:pr");
  });

  it("retains cross-platform release and real packaging gates", () => {
    for (const workflow of [interactiveWorkflow, fullWorkflow, releaseWorkflow]) {
      expect(workflow).toContain("test \"$(uname -m)\" = \"arm64\"");
      expect(workflow).toContain("aarch64-apple-darwin");
      expect(workflow).toContain("MACOSX_DEPLOYMENT_TARGET=13.0");
    }
    expect(interactiveWorkflow).toContain("Package metadata smoke");
    expect(interactiveWorkflow).toContain("needs.change-scope.outputs.package_sensitive == 'true'");
    expect(interactiveWorkflow).toContain("needs.change-scope.outputs.full_validation != 'true'");
    expect(fullWorkflow).toContain("name: Package NSIS");
    expect(fullWorkflow).toContain("name: Package unsigned DMG");
    expect(fullWorkflow).toContain("npm run build -- --no-sign");
  });

  it("pins the existing action versions and does not weaken performance gates", () => {
    for (const workflow of [interactiveWorkflow, fullWorkflow, releaseWorkflow]) {
      expect(workflow).toContain("actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7");
      expect(workflow).toContain("actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7");
    }
    for (const workflow of [interactiveWorkflow, fullWorkflow]) {
      expect(workflow).toContain("cache-workspace-crates: true");
      expect(workflow).toContain("cache-on-failure: true");
      expect(workflow).not.toContain("sccache");
    }
    expect(releaseWorkflow).toContain("actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7");
  });
});
