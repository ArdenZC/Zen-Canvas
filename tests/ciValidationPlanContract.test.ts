import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { classifyCiScope } from "../scripts/classifyCiChanges.mjs";
import {
  buildValidationPlan,
  evaluateValidationAggregate,
  fetchValidationLaneResults,
  summarizeValidationLaneResults,
  validationLaneResultsForPlan,
  type ValidationLane,
} from "../scripts/ciValidationPlan.mjs";

const BASE_COMMIT = "1".repeat(40);
const HEAD_COMMIT = "2".repeat(40);
const MERGE_COMMIT = "3".repeat(40);
const HEAD_TREE = "4".repeat(40);
const INTEGRATION_TREE = "5".repeat(40);

function readWorkflow(relativePath: string) {
  return readFileSync(relativePath, "utf8").replace(/\r\n?/gu, "\n");
}

function workflowJobBlock(workflow: string, jobId: string) {
  const lines = workflow.split("\n");
  const start = lines.findIndex((line) => line === "  " + jobId + ":");
  if (start < 0) throw new Error("workflow job not found: " + jobId);
  const nextJob = lines.findIndex((line, index) => index > start && /^  [a-z0-9-]+:$/u.test(line));
  return lines.slice(start, nextJob < 0 ? undefined : nextJob).join("\n");
}

function pullRequestInput(overrides: Record<string, unknown> = {}) {
  return {
    eventName: "pull_request",
    sourceEvidenceResult: "success",
    changeScopeResult: "success",
    headCheckoutSha: HEAD_COMMIT,
    headTreeSha: HEAD_TREE,
    integrationCheckoutSha: MERGE_COMMIT,
    integrationTreeSha: INTEGRATION_TREE,
    prHeadSha: HEAD_COMMIT,
    eventSha: MERGE_COMMIT,
    ...overrides,
  };
}

function aggregateInput(plan: ReturnType<typeof buildValidationPlan>, overrides: Record<string, unknown> = {}) {
  return {
    eventName: "pull_request",
    planResult: "success",
    planValid: plan.plan_valid,
    treeEquivalent: plan.tree_equivalent,
    headValidationRequired: plan.head_validation_required,
    validationLanes: plan.validation_lanes,
    laneJobResult: null,
    laneValidationRequired: true,
    headValidationResult: plan.tree_equivalent ? null : "success",
    integrationValidationResult: "success",
    ...overrides,
  };
}

describe("tree-equivalence validation plan behavior", () => {
  it("uses one substantive lane when different commits have the same tree", () => {
    const plan = buildValidationPlan(pullRequestInput({
      headTreeSha: HEAD_TREE,
      integrationTreeSha: HEAD_TREE,
    }));

    expect(plan.plan_valid).toBe(true);
    expect(plan.head_checkout_sha).toBe(HEAD_COMMIT);
    expect(plan.integration_checkout_sha).toBe(MERGE_COMMIT);
    expect(plan.head_checkout_sha).not.toBe(plan.integration_checkout_sha);
    expect(plan.tree_equivalent).toBe(true);
    expect(plan.head_validation_required).toBe(false);
    expect(plan.validation_lanes).toEqual(["merge_integration"]);
    expect(evaluateValidationAggregate(aggregateInput(plan))).toMatchObject({ pass: true });
    expect(evaluateValidationAggregate(aggregateInput(plan, {
      integrationValidationResult: null,
    })).pass).toBe(false);
    expect(evaluateValidationAggregate(aggregateInput(plan, {
      integrationValidationResult: "skipped",
    })).pass).toBe(false);
  });

  it("requires exact-head validation when the trees differ", () => {
    const plan = buildValidationPlan(pullRequestInput());

    expect(plan.tree_equivalent).toBe(false);
    expect(plan.head_validation_required).toBe(true);
    expect(plan.validation_lanes).toEqual(["head_validation", "merge_integration"]);
  });

  it("fails the aggregate when merge succeeds but the required head lane fails", () => {
    const plan = buildValidationPlan(pullRequestInput());
    const result = evaluateValidationAggregate(aggregateInput(plan, {
      laneJobResult: null,
      headValidationResult: "failure",
      integrationValidationResult: "success",
    }));

    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/head validation/i);
  });

  it.each([
    ["head lane missing", null, "success"],
    ["integration lane missing", "success", null],
    ["head lane failed", "failure", "success"],
    ["integration lane failed", "success", "failure"],
    ["head lane cancelled", "cancelled", "success"],
    ["integration lane cancelled", "success", "cancelled"],
    ["head lane skipped", "skipped", "success"],
    ["integration lane skipped", "success", "skipped"],
  ])("fails closed when %s", (_case, headValidationResult, integrationValidationResult) => {
    const plan = buildValidationPlan(pullRequestInput());
    const result = evaluateValidationAggregate(aggregateInput(plan, {
      laneJobResult: "success",
      headValidationResult,
      integrationValidationResult,
    }));

    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/head validation|merge-integration/i);
  });

  it("fails closed when source evidence or the head lane is missing", () => {
    const invalidPlan = buildValidationPlan(pullRequestInput({
      sourceEvidenceResult: "failure",
      headCheckoutSha: undefined,
      headTreeSha: undefined,
    }));
    expect(invalidPlan.plan_valid).toBe(false);
    expect(evaluateValidationAggregate({
      eventName: "pull_request",
      planResult: "failure",
      treeEquivalent: false,
      headValidationRequired: true,
      validationLanes: ["head_validation", "merge_integration"],
    }).pass).toBe(false);
  });

  it("allows the non-equivalent aggregate only when both lanes succeed", () => {
    const plan = buildValidationPlan(pullRequestInput());
    expect(evaluateValidationAggregate(aggregateInput(plan, {
      laneJobResult: "success",
      headValidationResult: "success",
      integrationValidationResult: "success",
    })).pass).toBe(true);
  });

  it("applies the same two-lane contract to docs-only changes", () => {
    const plan = buildValidationPlan(pullRequestInput());
    expect(evaluateValidationAggregate(aggregateInput(plan, {
      laneJobResult: "success",
      headValidationResult: "success",
      integrationValidationResult: "success",
    })).pass).toBe(true);
  });

  it("keeps commit identity and tree identity as separate fields", () => {
    const plan = buildValidationPlan(pullRequestInput({
      headTreeSha: HEAD_TREE,
      integrationTreeSha: HEAD_TREE,
    }));

    expect(plan.head_checkout_sha).toBe(HEAD_COMMIT);
    expect(plan.integration_checkout_sha).toBe(MERGE_COMMIT);
    expect(plan.head_tree_sha).toBe(HEAD_TREE);
    expect(plan.integration_tree_sha).toBe(HEAD_TREE);
    expect(plan.tree_equivalent).toBe(true);
  });

  it("keeps frontend and high-risk routing obligations on both unequal-tree lanes", () => {
    const scope = classifyCiScope({
      event: "pull_request",
      changedPaths: ["src/App.tsx", "src-tauri/src/file_ops.rs"],
    });
    const plan = buildValidationPlan(pullRequestInput());

    expect(scope.frontend_changed).toBe(true);
    expect(scope.high_risk).toBe(true);
    expect(plan.tree_equivalent).toBe(false);
    expect(plan.validation_lanes).toEqual(["head_validation", "merge_integration"]);
  });

  it("routes root Rust toolchain changes through Rust validation", () => {
    const scope = classifyCiScope({
      event: "pull_request",
      changedPaths: ["rust-toolchain.toml"],
    });

    expect(scope.docs_only).toBe(false);
    expect(scope.rust_changed).toBe(true);
    expect(scope.macos_sensitive).toBe(true);
    expect(scope.release_sensitive).toBe(true);
  });

  it("keeps performance-sensitive routing obligations on both unequal-tree lanes", () => {
    const scope = classifyCiScope({
      event: "pull_request",
      changedPaths: ["src-tauri/src/file_workspace/browse/mod.rs"],
    });
    const plan = buildValidationPlan(pullRequestInput());

    expect(scope.performance_sensitive).toBe(true);
    expect(scope.performance_any).toBe(true);
    expect(plan.head_validation_required).toBe(true);
    expect(plan.validation_lanes).toEqual(["head_validation", "merge_integration"]);
  });

  it("keeps scheduled and manual Full Validation as one immutable event lane", () => {
    const plan = buildValidationPlan({
      eventName: "workflow_dispatch",
      validationLane: "manual_full_validation",
      sourceEvidenceResult: "success",
      eventCheckoutSha: HEAD_COMMIT,
      eventTreeSha: HEAD_TREE,
    });

    expect(plan.plan_valid).toBe(true);
    expect(plan.tree_equivalent).toBeNull();
    expect(plan.validation_lanes).toEqual(["manual_full_validation"]);
  });
});


describe("actual validation lane result collection", () => {
  const lanes: ValidationLane[] = ["head_validation", "merge_integration"];
  const expectations = { "Frontend and format quality": true };

  it("projects only the lanes required by the plan", () => {
    expect(validationLaneResultsForPlan(["merge_integration"], {
      merge_integration: "success",
    })).toEqual({
      headValidationResult: null,
      integrationValidationResult: "success",
    });
    expect(validationLaneResultsForPlan(lanes, {
      head_validation: "success",
      merge_integration: "success",
    })).toEqual({
      headValidationResult: "success",
      integrationValidationResult: "success",
    });
  });

  it("requires an actual success job for each planned lane", () => {
    const results = summarizeValidationLaneResults([
      { name: "Frontend and format quality (head_validation)", status: "completed", conclusion: "success" },
      { name: "Frontend and format quality (merge_integration)", status: "completed", conclusion: "success" },
    ], lanes, expectations);

    expect(results).toEqual({
      head_validation: "success",
      merge_integration: "success",
    });
  });

  it.each([
    ["missing", [], "missing"],
    ["failed", [{ name: "Frontend and format quality (head_validation)", status: "completed", conclusion: "failure" }], "failure"],
    ["cancelled", [{ name: "Frontend and format quality (head_validation)", status: "completed", conclusion: "cancelled" }], "cancelled"],
    ["skipped", [{ name: "Frontend and format quality (head_validation)", status: "completed", conclusion: "skipped" }], "skipped"],
  ])("preserves %s instead of promoting it to PASS", (_case, headJobs, expectedResult) => {
    const results = summarizeValidationLaneResults([
      ...headJobs,
      { name: "Frontend and format quality (merge_integration)", status: "completed", conclusion: "success" },
    ], lanes, expectations);

    expect(results.head_validation).toBe(expectedResult);
    const plan = buildValidationPlan(pullRequestInput());
    expect(evaluateValidationAggregate(aggregateInput(plan, {
      headValidationResult: results.head_validation,
      integrationValidationResult: results.merge_integration,
    })).pass).toBe(false);
  });

  it("does not accept a success conclusion from a job that is still running", () => {
    const results = summarizeValidationLaneResults([
      { name: "Frontend and format quality (head_validation)", status: "in_progress", conclusion: "success" },
      { name: "Frontend and format quality (merge_integration)", status: "completed", conclusion: "success" },
    ], lanes, expectations);

    expect(results.head_validation).toBe("in_progress");
    const plan = buildValidationPlan(pullRequestInput());
    expect(evaluateValidationAggregate(aggregateInput(plan, {
      headValidationResult: results.head_validation,
      integrationValidationResult: results.merge_integration,
    })).pass).toBe(false);
  });

  it("keeps unrouted matrix domains explicitly not required", () => {
    expect(summarizeValidationLaneResults([], lanes, {
      "Native macOS performance (arm64)": "false",
    })).toEqual({
      head_validation: "not_required",
      merge_integration: "not_required",
    });
    const plan = buildValidationPlan(pullRequestInput());
    expect(evaluateValidationAggregate(aggregateInput(plan, {
      laneValidationRequired: false,
      headValidationResult: "not_required",
      integrationValidationResult: "not_required",
    })).pass).toBe(true);
    expect(evaluateValidationAggregate(aggregateInput(plan, {
      laneValidationRequired: false,
      headValidationResult: "skipped",
      integrationValidationResult: "not_required",
    })).pass).toBe(false);
  });

  it("queries the exact workflow attempt with a read-only Actions token", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        total_count: 2,
        jobs: [
          { name: "Frontend and format quality (head_validation)", status: "completed", conclusion: "success" },
          { name: "Frontend and format quality (merge_integration)", status: "completed", conclusion: "success" },
        ],
      }),
    }) as unknown as Response);

    const results = await fetchValidationLaneResults({
      repository: "ArdenZC/Zen-Canvas",
      runId: "37863698017",
      runAttempt: "2",
      token: "read-only-token",
      validationLanes: lanes,
      matrixJobExpectations: expectations,
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(results).toEqual({ head_validation: "success", merge_integration: "success" });
    const [requestUrl, requestInit] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(requestUrl).toContain("/actions/runs/37863698017/attempts/2/jobs");
    expect(requestInit.headers).toMatchObject({
      Accept: "application/vnd.github+json",
      Authorization: "Bearer read-only-token",
    });
  });

  it("rejects API errors and makes the aggregate CLI fail closed when evidence is unavailable", async () => {
    await expect(fetchValidationLaneResults({
      repository: "ArdenZC/Zen-Canvas",
      runId: "37863698017",
      runAttempt: "2",
      token: "read-only-token",
      validationLanes: lanes,
      matrixJobExpectations: expectations,
      fetchImpl: vi.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch,
    })).rejects.toThrow(/HTTP 401/u);

    const result = spawnSync(process.execPath, ["scripts/ciValidationPlan.mjs", "--aggregate"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        EVENT_NAME: "pull_request",
        PLAN_RESULT: "success",
        PLAN_VALID: "true",
        TREE_EQUIVALENT: "false",
        HEAD_VALIDATION_REQUIRED: "true",
        VALIDATION_LANES: JSON.stringify(lanes),
        GITHUB_REPOSITORY: "ArdenZC/Zen-Canvas",
        GITHUB_RUN_ID: "37863698017",
        GITHUB_RUN_ATTEMPT: "2",
        MATRIX_JOB_EXPECTATIONS: JSON.stringify(expectations),
        CI_GITHUB_TOKEN: "",
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Could not collect required lane results/u);
    expect(result.stdout).toContain('"pass": false');
    expect(result.stdout).toMatch(/head validation success, got missing/u);
  });
});

describe("workflow lane and governance wiring", () => {
  const interactiveWorkflow = readWorkflow(".github/workflows/ci.yml");
  const fullWorkflow = readWorkflow(".github/workflows/ci-full.yml");

  it("pins the repository Rust toolchain authority", () => {
    const toolchainPath = "rust-toolchain.toml";

    expect(existsSync(toolchainPath)).toBe(true);
    const toolchain = readFileSync(toolchainPath, "utf8").replace(/\r\n?/gu, "\n");

    expect(toolchain).toMatch(/^\[toolchain\]\s*$/mu);
    expect(toolchain).toMatch(/^channel\s*=\s*"1\.97\.1"\s*$/mu);
    expect(toolchain).toMatch(/^profile\s*=\s*"minimal"\s*$/mu);
    expect(toolchain).toMatch(/^components\s*=\s*\["rustfmt",\s*"clippy"\]\s*$/mu);
  });

  it("normalizes CRLF and LF workflow sources before semantic assertions", () => {
    expect(interactiveWorkflow).not.toContain("\r");
    expect(interactiveWorkflow).toContain("name: Documentation-only validation\n");
    expect(fullWorkflow).not.toContain("\r");
  });

  it("routes frontend and high-risk validation through the lane matrix", () => {
    expect(interactiveWorkflow).toContain("frontend_changed: ${{ steps.classify.outputs.frontend_changed }}");
    expect(interactiveWorkflow).toContain("high_risk: ${{ steps.classify.outputs.high_risk }}");
    expect(interactiveWorkflow).toContain("  frontend-quality:");
    expect(interactiveWorkflow).toContain("validation_lane: ${{ fromJSON(needs.validation-plan.outputs.validation_lanes) }}");
    expect(interactiveWorkflow).toContain("needs: [change-scope, validation-plan]");
  });

  it("routes performance-sensitive validation through both applicable lanes", () => {
    expect(interactiveWorkflow).toContain("performance_sensitive: ${{ steps.classify.outputs.performance_sensitive }}");
    expect(interactiveWorkflow).toContain("  performance-prepare:");
    expect(interactiveWorkflow).toContain("  performance-macos:");
    expect(interactiveWorkflow).toContain("needs: [change-scope, validation-plan]");
    expect(interactiveWorkflow).toContain("perf-bin-search-${{ matrix.validation_lane }}");
    expect(interactiveWorkflow).toContain("PERF_CHECKOUT_SHA: ${{ matrix.validation_lane == 'head_validation' && github.event.pull_request.head.sha || github.sha }}");
    expect(interactiveWorkflow).toContain("Read prepared Search binary identity");
  });

  it("keeps fork source validation read-only and outside pull_request_target", () => {
    expect(interactiveWorkflow).toMatch(/permissions:\s+contents: read/);
    expect(interactiveWorkflow).not.toContain("pull_request_target");
    expect(interactiveWorkflow).not.toMatch(/secrets\./);
    expect(interactiveWorkflow).toContain("matrix.validation_lane == 'head_validation' && github.event.pull_request.head.repo.full_name");
    expect(interactiveWorkflow).toContain("persist-credentials: false");
  });

  it("preserves every aggregate call site, including non-PR Full Validation callers", () => {
    expect(interactiveWorkflow).toContain("name: Change scope / routing contract");
    expect(interactiveWorkflow).toContain("name: Documentation-only validation\n");
    expect(interactiveWorkflow).toContain("name: Quality (windows-latest)");
    expect(interactiveWorkflow).toContain("name: Quality (macos-latest)");
    expect(interactiveWorkflow.match(/node scripts\/ciValidationPlan\.mjs --aggregate/g)).toHaveLength(4);
    expect(fullWorkflow.match(/node scripts\/ciValidationPlan\.mjs --aggregate/g)).toHaveLength(3);
    expect(interactiveWorkflow.match(/name: Checkout CI validation helper/g)).toHaveLength(4);
    expect(fullWorkflow.match(/name: Checkout CI validation helper/g)).toHaveLength(3);
    expect(fullWorkflow).not.toContain("pull_request:");
    expect(fullWorkflow).toContain("  schedule:");
    expect(fullWorkflow).toContain("  workflow_dispatch:");
  });

  it.each([
    ["docs-only", ["Documentation-only validation"]],
    ["performance-profile", [
      "Performance / Prepare",
      "Performance / Search",
      "Performance / Scan & Schema",
      "Performance / Library & Content",
      "Performance / Intelligence",
      "Performance / Workspace Foundation",
      "Performance / Preview Platform",
    ]],
    ["quality-windows", [
      "Frontend and format quality",
      "Rust quality (windows-latest)",
      "Windows native Preview Handler",
      "Performance / Prepare",
      "Performance / Search",
      "Performance / Scan & Schema",
      "Performance / Library & Content",
      "Performance / Intelligence",
      "Performance / Workspace Foundation",
      "Performance / Preview Platform",
      "Release compile (windows-latest)",
      "Package NSIS",
      "Package metadata smoke",
      "Dependency audit",
    ]],
    ["quality-macos", [
      "Frontend and format quality",
      "Rust quality (macos-latest)",
      "Native macOS performance (arm64)",
      "Performance / Prepare",
      "Performance / Search",
      "Performance / Scan & Schema",
      "Performance / Library & Content",
      "Performance / Intelligence",
      "Performance / Workspace Foundation",
      "Performance / Preview Platform",
      "Release compile (macos-latest)",
      "Package unsigned DMG",
      "Package metadata smoke",
      "Dependency audit",
    ]],
  ])("wires %s to actual lane job conclusions", (jobId, expectedPrefixes) => {
    const block = workflowJobBlock(interactiveWorkflow, jobId);
    expect(block).toContain("node scripts/ciValidationPlan.mjs --aggregate");
    expect(block).toContain("actions: read");
    expect(block).toContain("contents: read");
    expect(block).toContain("CI_GITHUB_TOKEN: ${{ github.token }}");
    expect(block).toContain("MATRIX_JOB_EXPECTATIONS:");
    expect(block).toContain("VALIDATION_LANES: ${{ needs.validation-plan.outputs.validation_lanes }}");
    for (const prefix of expectedPrefixes) {
      expect(block).toContain(prefix);
      expect(interactiveWorkflow).toContain(
        "    name: " + prefix + " (${{ matrix.validation_lane }})",
      );
    }
    const serializedExpectations = block.match(/MATRIX_JOB_EXPECTATIONS: >-\n\s+(\{.*\})/u)?.[1];
    expect(serializedExpectations).toBeDefined();
    const parseableExpectations = serializedExpectations?.replace(/\$\{\{[\s\S]*?\}\}/gu, "true");
    expect(Object.keys(JSON.parse(parseableExpectations ?? "{}"))).toEqual(expectedPrefixes);
  });

  it("maps each required matrix group to its classifier route output", () => {
    const expectedMappings = [
      ["docs-only", "Documentation-only validation", "true"],
      ["performance-profile", "Performance / Prepare", "needs.change-scope.outputs.performance_any"],
      ["performance-profile", "Performance / Search", "needs.change-scope.outputs.perf_search"],
      ["performance-profile", "Performance / Scan & Schema", "needs.change-scope.outputs.perf_scan_schema"],
      ["performance-profile", "Performance / Library & Content", "needs.change-scope.outputs.perf_library_content"],
      ["performance-profile", "Performance / Intelligence", "needs.change-scope.outputs.perf_intelligence"],
      ["performance-profile", "Performance / Workspace Foundation", "needs.change-scope.outputs.perf_workspace_foundation"],
      ["performance-profile", "Performance / Preview Platform", "needs.change-scope.outputs.perf_preview_platform"],
      ["quality-windows", "Frontend and format quality", "needs.change-scope.outputs.frontend_changed"],
      ["quality-windows", "Rust quality (windows-latest)", "needs.change-scope.outputs.rust_changed"],
      ["quality-windows", "Windows native Preview Handler", "needs.change-scope.outputs.windows_native_preview_handler_changed"],
      ["quality-windows", "Performance / Prepare", "needs.change-scope.outputs.performance_any"],
      ["quality-windows", "Performance / Search", "needs.change-scope.outputs.perf_search"],
      ["quality-windows", "Performance / Scan & Schema", "needs.change-scope.outputs.perf_scan_schema"],
      ["quality-windows", "Performance / Library & Content", "needs.change-scope.outputs.perf_library_content"],
      ["quality-windows", "Performance / Intelligence", "needs.change-scope.outputs.perf_intelligence"],
      ["quality-windows", "Performance / Workspace Foundation", "needs.change-scope.outputs.perf_workspace_foundation"],
      ["quality-windows", "Performance / Preview Platform", "needs.change-scope.outputs.perf_preview_platform"],
      ["quality-windows", "Release compile (windows-latest)", "needs.change-scope.outputs.release_sensitive"],
      ["quality-windows", "Package NSIS", "needs.change-scope.outputs.full_validation"],
      ["quality-windows", "Package metadata smoke", "needs.change-scope.outputs.package_sensitive == 'true' && needs.change-scope.outputs.full_validation != 'true'"],
      ["quality-windows", "Dependency audit", "needs.change-scope.outputs.dependency_sensitive"],
      ["quality-macos", "Frontend and format quality", "needs.change-scope.outputs.frontend_changed"],
      ["quality-macos", "Rust quality (macos-latest)", "needs.change-scope.outputs.macos_sensitive"],
      ["quality-macos", "Native macOS performance (arm64)", "needs.change-scope.outputs.full_validation == 'true' || needs.change-scope.outputs.performance_sensitive == 'true'"],
      ["quality-macos", "Performance / Prepare", "needs.change-scope.outputs.performance_any"],
      ["quality-macos", "Performance / Search", "needs.change-scope.outputs.perf_search"],
      ["quality-macos", "Performance / Scan & Schema", "needs.change-scope.outputs.perf_scan_schema"],
      ["quality-macos", "Performance / Library & Content", "needs.change-scope.outputs.perf_library_content"],
      ["quality-macos", "Performance / Intelligence", "needs.change-scope.outputs.perf_intelligence"],
      ["quality-macos", "Performance / Workspace Foundation", "needs.change-scope.outputs.perf_workspace_foundation"],
      ["quality-macos", "Performance / Preview Platform", "needs.change-scope.outputs.perf_preview_platform"],
      ["quality-macos", "Release compile (macos-latest)", "needs.change-scope.outputs.release_sensitive"],
      ["quality-macos", "Package unsigned DMG", "needs.change-scope.outputs.full_validation"],
      ["quality-macos", "Package metadata smoke", "needs.change-scope.outputs.package_sensitive == 'true' && needs.change-scope.outputs.full_validation != 'true'"],
      ["quality-macos", "Dependency audit", "needs.change-scope.outputs.dependency_sensitive"],
    ] as const;

    for (const [jobId, jobPrefix, classifierOutput] of expectedMappings) {
      const block = workflowJobBlock(interactiveWorkflow, jobId);
      const expected = classifierOutput === "true"
        ? "true"
        : "${{ " + classifierOutput + " }}";
      expect(block).toContain('"' + jobPrefix + '":"' + expected + '"');
    }
  });

  it("keeps fork validation read-only and limits Actions API collection to pull requests", () => {
    expect(interactiveWorkflow).toMatch(/permissions:\s+contents: read/);
    expect(interactiveWorkflow).not.toContain("pull_request_target");
    expect(interactiveWorkflow).not.toMatch(/secrets\./);
    expect(interactiveWorkflow).toContain("persist-credentials: false");
    const helper = readFileSync("scripts/ciValidationPlan.mjs", "utf8");
    expect(helper).toContain('if (eventName === "pull_request")');
    expect(helper).toContain("fetchValidationLaneResults");
  });
});
