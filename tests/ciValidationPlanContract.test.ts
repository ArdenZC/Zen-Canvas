import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyCiScope } from "../scripts/classifyCiChanges.mjs";
import {
  buildValidationPlan,
  evaluateValidationAggregate,
} from "../scripts/ciValidationPlan.mjs";

const BASE_COMMIT = "1".repeat(40);
const HEAD_COMMIT = "2".repeat(40);
const MERGE_COMMIT = "3".repeat(40);
const HEAD_TREE = "4".repeat(40);
const INTEGRATION_TREE = "5".repeat(40);

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
    laneJobResult: "success",
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

  it("fails closed when the required head lane is missing", () => {
    const plan = buildValidationPlan(pullRequestInput());
    const result = evaluateValidationAggregate(aggregateInput(plan, {
      laneJobResult: null,
      integrationValidationResult: "success",
    }));

    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/require head validation success/i);
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
      laneJobResult: null,
      headValidationResult: "success",
      integrationValidationResult: "success",
    })).pass).toBe(true);
  });

  it("applies the same two-lane contract to docs-only changes", () => {
    const plan = buildValidationPlan(pullRequestInput());
    expect(evaluateValidationAggregate(aggregateInput(plan, {
      laneJobResult: "success",
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

describe("workflow lane and governance wiring", () => {
  const interactiveWorkflow = readFileSync(".github/workflows/ci.yml", "utf8");

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

  it("preserves the required aggregate contexts and makes them depend on the plan", () => {
    expect(interactiveWorkflow).toContain("name: Change scope / routing contract");
    expect(interactiveWorkflow).toContain("name: Documentation-only validation\n");
    expect(interactiveWorkflow).toContain("name: Quality (windows-latest)");
    expect(interactiveWorkflow).toContain("name: Quality (macos-latest)");
    expect(interactiveWorkflow).toContain("node scripts/ciValidationPlan.mjs --aggregate");
    expect(interactiveWorkflow).toContain("VALIDATION_PLAN: ${{ needs.validation-plan.result }}");
  });
});
