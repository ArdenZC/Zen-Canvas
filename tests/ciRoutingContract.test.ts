import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyCiScope } from "../scripts/classifyCiChanges.mjs";

function route(changedPaths: string[], options: Parameters<typeof classifyCiScope>[0] = {}) {
  return classifyCiScope({ event: "pull_request", changedPaths, ...options });
}

function performanceFlags(scope: ReturnType<typeof classifyCiScope>) {
  return [
    scope.perf_search,
    scope.perf_scan_schema,
    scope.perf_library_content,
    scope.perf_intelligence,
    scope.perf_workspace_foundation,
  ];
}

describe("CI change routing", () => {
  it("routes documentation-only changes to the documentation gate", () => {
    const scope = route(["docs/ci.md"]);
    expect(scope.docs_only).toBe(true);
    expect(scope.frontend_changed).toBe(false);
    expect(scope.rust_changed).toBe(false);
    expect(scope.performance_any).toBe(false);
    expect(scope.package_sensitive).toBe(false);
  });

  it("routes React and CSS changes only to frontend checks", () => {
    const scope = route(["src/App.tsx", "src/styles.css"]);
    expect(scope.docs_only).toBe(false);
    expect(scope.frontend_changed).toBe(true);
    expect(scope.rust_changed).toBe(false);
    expect(scope.release_sensitive).toBe(false);
    expect(performanceFlags(scope)).toEqual([false, false, false, false, false]);
  });

  it("routes Global Search changes to Search 100k only", () => {
    const scope = route(["src-tauri/src/global_index/query.rs"]);
    expect(performanceFlags(scope)).toEqual([true, false, false, false, false]);
    expect(scope.rust_changed).toBe(true);
    expect(scope.macos_sensitive).toBe(true);
  });

  it("routes scanner changes to Scan/Schema 100k only", () => {
    const scope = route(["src-tauri/src/scanner/reconcile.rs"]);
    expect(performanceFlags(scope)).toEqual([false, true, false, false, false]);
  });

  it("routes File Library and Content changes to Library/Content 100k only", () => {
    const scope = route(["src-tauri/src/db/queries/library/query.rs"]);
    expect(performanceFlags(scope)).toEqual([false, false, true, false, false]);
  });

  it("routes Intelligence changes to the Intelligence 100k suite only", () => {
    const scope = route(["src-tauri/src/db/queries/organization/projection.rs"]);
    expect(performanceFlags(scope)).toEqual([false, false, false, true, false]);
  });

  it("routes File Workspace changes to the Workspace Foundation suite only", () => {
    const scope = route(["src-tauri/src/file_workspace/browse/mod.rs"]);
    expect(performanceFlags(scope)).toEqual([false, false, false, false, true]);
    expect(scope.performance_sensitive).toBe(true);
  });

  it("routes DB core and schema changes to every 100k suite without selecting 1M", () => {
    const scope = route(["src-tauri/src/db/schema.rs"]);
    expect(scope.full_validation).toBe(false);
    expect(scope.all_domains_100k).toBe(true);
    expect(performanceFlags(scope)).toEqual([true, true, true, true, true]);
    expect(scope.package_sensitive).toBe(false);
  });

  it("routes dependency changes to audit and package smoke without performance suites", () => {
    const scope = route(["package-lock.json"]);
    expect(scope.dependency_sensitive).toBe(true);
    expect(scope.package_sensitive).toBe(true);
    expect(scope.release_sensitive).toBe(true);
    expect(scope.performance_any).toBe(false);
  });

  it("routes package and installer inputs to package smoke without 100k performance", () => {
    const scope = route(["src-tauri/tauri.conf.json"]);
    expect(scope.package_sensitive).toBe(true);
    expect(scope.release_sensitive).toBe(true);
    expect(scope.dependency_sensitive).toBe(false);
    expect(scope.performance_any).toBe(false);
  });

  it("routes workflow changes to every 100k suite but keeps Full explicit", () => {
    const scope = route([".github/workflows/ci.yml"]);
    expect(scope.workflow_changed).toBe(true);
    expect(scope.full_validation).toBe(false);
    expect(performanceFlags(scope)).toEqual([true, true, true, true, true]);
  });

  it("routes performance harness changes to every 100k suite", () => {
    const scope = route(["scripts/runPerformanceSuite.mjs"]);
    expect(scope.workflow_changed).toBe(true);
    expect(scope.full_validation).toBe(false);
    expect(performanceFlags(scope)).toEqual([true, true, true, true, true]);
  });

  it("routes schedule, manual Full, and labeled Full requests to every 1M gate", () => {
    for (const scope of [
      classifyCiScope({ event: "schedule", changedPaths: [] }),
      classifyCiScope({ event: "workflow_dispatch", changedPaths: [], dispatchFull: true }),
      classifyCiScope({ event: "pull_request", changedPaths: ["src/App.tsx"], prLabels: ["full-validation"] }),
    ]) {
      expect(scope.full_validation).toBe(true);
      expect(scope.frontend_changed).toBe(true);
      expect(scope.rust_changed).toBe(true);
      expect(scope.package_sensitive).toBe(true);
      expect(scope.dependency_sensitive).toBe(true);
      expect(performanceFlags(scope)).toEqual([true, true, true, true, true]);
    }
  });

  it("fails closed to all 100k domains when the diff base is missing", () => {
    const scope = route(["src/App.tsx"], { baseMissing: true });
    expect(scope.docs_only).toBe(false);
    expect(scope.full_validation).toBe(false);
    expect(scope.all_domains_100k).toBe(true);
    expect(performanceFlags(scope)).toEqual([true, true, true, true, true]);
  });

  it("keeps the two concurrency domains isolated", () => {
    const interactive = readFileSync(".github/workflows/ci.yml", "utf8");
    const full = readFileSync(".github/workflows/ci-full.yml", "utf8");
    expect(interactive).toContain("ci-interactive-${{ github.ref }}");
    expect(full).toContain("ci-full-${{ github.ref }}");
    expect(interactive).not.toContain("ci-full-${{ github.ref }}");
    expect(full).not.toContain("ci-interactive-${{ github.ref }}");
  });
});
