import { describe, expect, it } from "vitest";
import {
  matchesGroupPage,
  ownsGroupPage,
  ownsGroupPageLoading,
  ownsMutation,
  ownsPlanMutation,
  type GroupLoadingOwner,
  type GroupPageRequest,
  type OrganizationPlanConcurrencyState
} from "../src/store/organizationPlan/ownership";

const owner: GroupLoadingOwner = {
  kind: "pagination",
  epoch: 3,
  planId: "plan-1",
  planRevision: 4,
  cursor: "cursor-a",
  projectionFingerprint: "projection-a"
};

const state: OrganizationPlanConcurrencyState = {
  activePlan: { id: "plan-1", revision: 4 } as never,
  requestEpoch: 2,
  mutationToken: 7,
  groupRequestEpoch: 3,
  groupProjectionFingerprint: "projection-a",
  groupNextCursor: "cursor-a",
  groupLoadingOwner: owner,
  isLoading: true
};

const request: GroupPageRequest = {
  groupRequestEpoch: 3,
  requestEpoch: 2,
  mutationToken: 7,
  planId: "plan-1",
  planRevision: 4,
  cursor: "cursor-a",
  projectionFingerprint: "projection-a",
  loadingOwner: owner
};

describe("Organization Plan concurrency protocol", () => {
  it("requires every plan mutation owner token and revision to match", () => {
    expect(ownsPlanMutation(() => state, "plan-1", 4, 2, 7)).toBe(true);
    expect(ownsPlanMutation(() => state, "plan-1", 5, 2, 7)).toBe(false);
    expect(ownsMutation(() => state, 2, 8)).toBe(false);
  });

  it("requires the complete group page ownership tuple", () => {
    expect(ownsGroupPage(() => state, request)).toBe(true);
    expect(ownsGroupPage(() => state, { ...request, cursor: "cursor-b" })).toBe(false);
    expect(ownsGroupPageLoading(() => state, request)).toBe(true);
  });

  it("rejects stale or empty projection fingerprints", () => {
    const page = { planId: "plan-1", planRevision: 4, projectionFingerprint: "projection-a" };
    expect(matchesGroupPage(page, "plan-1", 4)).toBe(true);
    expect(matchesGroupPage(page, "plan-1", 5)).toBe(false);
    expect(matchesGroupPage({ ...page, projectionFingerprint: "" }, "plan-1", 4)).toBe(false);
    expect(matchesGroupPage(page, "plan-1", 4, "projection-b")).toBe(false);
  });
});
