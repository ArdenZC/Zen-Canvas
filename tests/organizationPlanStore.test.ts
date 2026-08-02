import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOrganizationPlanStore } from "../src/store/useOrganizationPlanStore";
import type { OrganizationPlan } from "../src/types/domain";

const apiMocks = vi.hoisted(() => ({
  getOrganizationPlan: vi.fn(),
  queryOrganizationPlanGroups: vi.fn(),
  queryOrganizationPlanItems: vi.fn()
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
    useOrganizationPlanStore.setState({ activePlan: null, plans: [], groups: [], groupNextCursor: null, groupHasMore: false, isLoading: false, error: null });
  });

  it("opens a large plan with only basic plan and group projection requests", async () => {
    await useOrganizationPlanStore.getState().openPlan(plan.id);

    expect(apiMocks.getOrganizationPlan).toHaveBeenCalledWith(plan.id);
    expect(apiMocks.queryOrganizationPlanGroups).toHaveBeenCalledWith({ planId: plan.id, pageSize: 100, cursor: null });
    expect(apiMocks.queryOrganizationPlanItems).not.toHaveBeenCalled();
    expect(useOrganizationPlanStore.getState().activePlan?.effectiveSummary).toEqual({ ready: 0, reviewed: 0, pendingReview: 10_000, blocked: 0 });
  });
});
