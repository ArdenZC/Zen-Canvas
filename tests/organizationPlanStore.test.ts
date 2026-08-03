import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOrganizationPlanStore } from "../src/store/useOrganizationPlanStore";
import type { OrganizationPlan, OrganizationPlanSelection } from "../src/types/domain";

const apiMocks = vi.hoisted(() => ({
  getOrganizationPlan: vi.fn(),
  queryOrganizationPlanGroups: vi.fn(),
  queryOrganizationPlanItems: vi.fn(),
  getOrganizationPlanDryRun: vi.fn(),
  executeOrganizationPlan: vi.fn()
}));

vi.mock("../src/api/tauriApi", () => ({ tauriApi: apiMocks }));

const plan = {
  id: "plan-10k",
  title: "10k plan",
  revision: 4,
  requestedCount: 10_000,
  materializedCount: 10_000,
  updatedAt: 1,
  effectiveSummary: null,
  summary: { pendingReview: 10_000 }
} as unknown as OrganizationPlan;

describe("Organization Plan group-first loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getOrganizationPlan.mockResolvedValue(plan);
    apiMocks.queryOrganizationPlanGroups.mockResolvedValue({
      planId: plan.id,
      planRevision: plan.revision,
      groups: [],
      effectiveSummary: { ready: 0, reviewed: 0, pendingReview: 10_000, blocked: 0 },
      nextCursor: null,
      hasMore: false
    });
    useOrganizationPlanStore.setState({ activePlan: null, plans: [], groups: [], groupNextCursor: null, groupHasMore: false, dryRun: null, dryRunSelection: null, executionResult: null, isLoading: false, isMutating: false, error: null });
  });

  it("opens a large plan with only basic plan and group projection requests", async () => {
    await useOrganizationPlanStore.getState().openPlan(plan.id);

    expect(apiMocks.getOrganizationPlan).toHaveBeenCalledWith(plan.id);
    expect(apiMocks.queryOrganizationPlanGroups).toHaveBeenCalledWith({ planId: plan.id, pageSize: 100, cursor: null });
    expect(apiMocks.queryOrganizationPlanItems).not.toHaveBeenCalled();
    expect(useOrganizationPlanStore.getState().activePlan?.effectiveSummary).toEqual({ ready: 0, reviewed: 0, pendingReview: 10_000, blocked: 0 });
  });

  it("executes the exact item selection that was dry-run instead of expanding it", async () => {
    const selection: OrganizationPlanSelection = { allAccepted: false, itemIds: ["item-a"] };
    const dryRun = {
      planId: plan.id,
      planRevision: plan.revision,
      selectedCount: 1,
      executableCount: 1,
      blockedCount: 0,
      staleCount: 0,
      totalBytes: 1,
      operationKinds: ["move"],
      items: [],
      executionBatchLimit: 100,
      dryRunFingerprint: "fingerprint-item-a"
    };
    apiMocks.getOrganizationPlanDryRun.mockResolvedValue(dryRun);
    apiMocks.executeOrganizationPlan.mockResolvedValue({
      plan,
      executionId: "execution-1",
      operationBatchId: "batch-1",
      attemptedCount: 1,
      succeededCount: 1,
      failedCount: 0,
      skippedCount: 0
    });

    useOrganizationPlanStore.setState({ activePlan: plan });
    await useOrganizationPlanStore.getState().createDryRun(selection);
    await useOrganizationPlanStore.getState().executeDryRun();

    expect(apiMocks.getOrganizationPlanDryRun).toHaveBeenCalledWith({
      planId: plan.id,
      expectedPlanRevision: plan.revision,
      itemIds: ["item-a"],
      allAccepted: false
    });
    expect(apiMocks.executeOrganizationPlan).toHaveBeenCalledWith({
      planId: plan.id,
      expectedPlanRevision: plan.revision,
      dryRunFingerprint: "fingerprint-item-a",
      itemIds: ["item-a"],
      allAccepted: false,
      confirmed: true
    });
  });
});
