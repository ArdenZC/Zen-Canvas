import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOrganizationPlanStore } from "../src/store/useOrganizationPlanStore";
import type { OrganizationPlan, OrganizationPlanItem, OrganizationPlanSelection } from "../src/types/domain";

const apiMocks = vi.hoisted(() => ({
  getOrganizationPlan: vi.fn(),
  listOrganizationPlans: vi.fn(),
  createOrganizationPlan: vi.fn(),
  queryOrganizationPlanGroups: vi.fn(),
  queryOrganizationPlanItems: vi.fn(),
  getOrganizationPlanDryRun: vi.fn(),
  analyzeOrganizationPlanItems: vi.fn(),
  executeOrganizationPlan: vi.fn(),
  updateOrganizationPlanDecisions: vi.fn(),
  updateOrganizationPlanGroupDecision: vi.fn(),
  refreshOrganizationPlan: vi.fn()
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
    apiMocks.listOrganizationPlans.mockResolvedValue([]);
    apiMocks.queryOrganizationPlanGroups.mockResolvedValue({
      planId: plan.id,
      planRevision: plan.revision,
      groups: [],
      effectiveSummary: { ready: 0, reviewed: 0, pendingReview: 10_000, blocked: 0 },
      nextCursor: null,
      hasMore: false
    });
    useOrganizationPlanStore.setState({ activePlan: null, plans: [], groups: [], groupNextCursor: null, groupHasMore: false, dryRun: null, dryRunSelection: null, executionResult: null, planListState: "loaded", planListError: null, createPlanError: null, isPlanListLoading: false, isLoading: false, isMutating: false, error: null, requestEpoch: 0, mutationToken: 0, groupRequestEpoch: 0, groupLoadingOwner: null });
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

  it("does not let a delayed Plan A mutation reopen Plan A after the user switches to Plan B", async () => {
    const planA = { ...plan, id: "plan-a", title: "Plan A" };
    const planB = { ...plan, id: "plan-b", title: "Plan B", revision: 5 };
    const item = { id: "item-a", planId: planA.id, revision: 1 } as unknown as OrganizationPlanItem;
    let resolveMutation: (value: OrganizationPlan) => void = () => undefined;
    const delayedMutation = new Promise<OrganizationPlan>((resolve) => { resolveMutation = resolve; });
    apiMocks.updateOrganizationPlanDecisions.mockReturnValue(delayedMutation);
    apiMocks.getOrganizationPlan.mockImplementation(async (planId: string) => planId === planB.id ? planB : planA);
    apiMocks.queryOrganizationPlanGroups.mockImplementation(async (request: { planId: string }) => ({
      planId: request.planId,
      planRevision: request.planId === planB.id ? planB.revision : planA.revision,
      groups: [],
      effectiveSummary: { ready: 0, reviewed: 0, pendingReview: 0, blocked: 0 },
      nextCursor: null,
      hasMore: false
    }));
    useOrganizationPlanStore.setState({ activePlan: planA, plans: [planA, planB], requestEpoch: 0, mutationToken: 0 });

    const mutation = useOrganizationPlanStore.getState().updateDecision(item, "accepted");
    await Promise.resolve();
    await useOrganizationPlanStore.getState().openPlan(planB.id);
    resolveMutation(planA);
    await mutation;

    expect(useOrganizationPlanStore.getState().activePlan?.id).toBe(planB.id);
    expect(useOrganizationPlanStore.getState().isMutating).toBe(false);
    expect(apiMocks.queryOrganizationPlanGroups).not.toHaveBeenCalledWith({ planId: planA.id, pageSize: 100, cursor: null });
  });

  it("does not append a deferred Plan A page after a mutation publishes a newer Plan A revision", async () => {
    const planA = { ...plan, id: "plan-a", revision: 4 };
    const updatedPlan = { ...planA, revision: 5 };
    const firstGroup = { groupId: "group-first", planId: planA.id, revision: planA.revision } as any;
    const newGroup = { groupId: "group-new", planId: planA.id, revision: updatedPlan.revision } as any;
    const oldPage = { planId: planA.id, planRevision: planA.revision, groups: [{ groupId: "group-old" }], effectiveSummary: { ready: 0, reviewed: 0, pendingReview: 0, blocked: 0 }, nextCursor: null, hasMore: false };
    let resolveOldPage: (value: typeof oldPage) => void = () => undefined;
    const oldPagePending = new Promise<typeof oldPage>((resolve) => { resolveOldPage = resolve; });
    apiMocks.updateOrganizationPlanDecisions.mockResolvedValue(updatedPlan);
    apiMocks.queryOrganizationPlanGroups.mockImplementation(async (request: { cursor?: string | null }) => request.cursor
      ? oldPagePending
      : { planId: planA.id, planRevision: updatedPlan.revision, groups: [newGroup], effectiveSummary: { ready: 1, reviewed: 0, pendingReview: 0, blocked: 0 }, nextCursor: null, hasMore: false });
    useOrganizationPlanStore.setState({ activePlan: planA, plans: [planA], groups: [firstGroup], groupNextCursor: "cursor-a", groupHasMore: true, isLoading: false, requestEpoch: 0, mutationToken: 0, groupRequestEpoch: 0 });

    const oldPageRequest = useOrganizationPlanStore.getState().loadNextGroupPage();
    await Promise.resolve();
    const item = { id: "item-a", planId: planA.id, revision: 1 } as unknown as OrganizationPlanItem;
    const mutation = useOrganizationPlanStore.getState().updateDecision(item, "accepted");
    await mutation;
    resolveOldPage(oldPage);
    const oldPageResult = await oldPageRequest;

    expect(oldPageResult.applied).toBe(false);
    expect(useOrganizationPlanStore.getState().isLoading).toBe(false);
    expect(useOrganizationPlanStore.getState().isMutating).toBe(false);
    expect(useOrganizationPlanStore.getState().activePlan?.revision).toBe(updatedPlan.revision);
    expect(useOrganizationPlanStore.getState().groups).toEqual([newGroup]);
    expect(useOrganizationPlanStore.getState().groups).not.toContainEqual(expect.objectContaining({ groupId: "group-old" }));
  });

  it("does not surface a rejected Plan A page after switching to Plan B", async () => {
    const planA = { ...plan, id: "plan-a", revision: 4 };
    const planB = { ...plan, id: "plan-b", revision: 8 };
    let rejectPage: (error: unknown) => void = () => undefined;
    const deferredPage = new Promise<never>((_, reject) => { rejectPage = reject; });
    apiMocks.queryOrganizationPlanGroups.mockImplementation((request: { planId: string; cursor?: string | null }) => request.cursor
      ? deferredPage
      : Promise.resolve({ planId: request.planId, planRevision: request.planId === planB.id ? planB.revision : planA.revision, groups: [], effectiveSummary: { ready: 0, reviewed: 0, pendingReview: 0, blocked: 0 }, nextCursor: null, hasMore: false }));
    apiMocks.getOrganizationPlan.mockImplementation(async (planId: string) => planId === planB.id ? planB : planA);
    useOrganizationPlanStore.setState({ activePlan: planA, plans: [planA, planB], groups: [{ groupId: "group-first" } as any], groupNextCursor: "cursor-a", groupHasMore: true, isLoading: false, requestEpoch: 0, mutationToken: 0, groupRequestEpoch: 0 });

    const pageRequest = useOrganizationPlanStore.getState().loadNextGroupPage();
    await Promise.resolve();
    await useOrganizationPlanStore.getState().openPlan(planB.id);
    rejectPage(new Error("plan_a_page_failed"));
    const result = await pageRequest;

    expect(result.applied).toBe(false);
    expect(useOrganizationPlanStore.getState().activePlan?.id).toBe(planB.id);
    expect(useOrganizationPlanStore.getState().error).toBeNull();
    expect(useOrganizationPlanStore.getState().isLoading).toBe(false);
  });

  it("releases a deferred page loading lock when a same-plan mutation supersedes the page", async () => {
    const planA = { ...plan, id: "plan-a", revision: 4 };
    const page = { planId: planA.id, planRevision: planA.revision, groups: [{ groupId: "group-old" }], effectiveSummary: { ready: 1, reviewed: 0, pendingReview: 0, blocked: 0 }, nextCursor: null, hasMore: false };
    let resolvePage: (value: typeof page) => void = () => undefined;
    const deferredPage = new Promise<typeof page>((resolve) => { resolvePage = resolve; });
    const dryRun = {
      planId: planA.id,
      planRevision: planA.revision,
      selectedCount: 0,
      executableCount: 0,
      blockedCount: 0,
      staleCount: 0,
      totalBytes: 0,
      operationKinds: [],
      items: [],
      executionBatchLimit: 100,
      dryRunFingerprint: "dry-run-empty"
    };
    apiMocks.queryOrganizationPlanGroups.mockImplementation((request: { cursor?: string | null }) => request.cursor ? deferredPage : page);
    apiMocks.getOrganizationPlanDryRun.mockResolvedValue(dryRun);
    useOrganizationPlanStore.setState({ activePlan: planA, plans: [planA], groups: [{ groupId: "group-first" } as any], groupNextCursor: "cursor-a", groupHasMore: true, isPlanListLoading: false, isLoading: false, requestEpoch: 0, mutationToken: 0, groupRequestEpoch: 0, groupLoadingOwner: null });

    const pageRequest = useOrganizationPlanStore.getState().loadNextGroupPage();
    await Promise.resolve();
    expect(useOrganizationPlanStore.getState().groupLoadingOwner?.kind).toBe("pagination");
    const dryRunRequest = useOrganizationPlanStore.getState().createDryRun();
    await Promise.resolve();
    expect(useOrganizationPlanStore.getState().isLoading).toBe(false);
    expect(useOrganizationPlanStore.getState().groupLoadingOwner).toBeNull();

    await dryRunRequest;
    expect(useOrganizationPlanStore.getState().dryRun?.dryRunFingerprint).toBe("dry-run-empty");

    resolvePage(page);
    const pageResult = await pageRequest;

    expect(pageResult.applied).toBe(false);
    expect(useOrganizationPlanStore.getState().isLoading).toBe(false);
    expect(useOrganizationPlanStore.getState().groups).toEqual([{ groupId: "group-first" }]);
  });

  it("keeps the newer refresh error and releases a superseded page loading owner", async () => {
    const planA = { ...plan, id: "plan-refresh", revision: 4 };
    const oldPage = { planId: planA.id, planRevision: planA.revision, groups: [{ groupId: "group-old" }], effectiveSummary: { ready: 1, reviewed: 0, pendingReview: 0, blocked: 0 }, nextCursor: null, hasMore: false };
    let resolveOldPage: (value: typeof oldPage) => void = () => undefined;
    const oldPagePending = new Promise<typeof oldPage>((resolve) => { resolveOldPage = resolve; });
    apiMocks.queryOrganizationPlanGroups.mockImplementation((request: { cursor?: string | null }) => request.cursor ? oldPagePending : oldPage);
    apiMocks.refreshOrganizationPlan.mockRejectedValue(new Error("refresh_failed"));
    useOrganizationPlanStore.setState({ activePlan: planA, plans: [planA], groups: [{ groupId: "group-first" } as any], groupNextCursor: "cursor-a", groupHasMore: true, isLoading: false, isMutating: false, error: null, requestEpoch: 0, mutationToken: 0, groupRequestEpoch: 0, groupLoadingOwner: null });

    const pageRequest = useOrganizationPlanStore.getState().loadNextGroupPage();
    await Promise.resolve();
    await expect(useOrganizationPlanStore.getState().refreshPlan()).rejects.toThrow("refresh_failed");

    expect(useOrganizationPlanStore.getState().isLoading).toBe(false);
    expect(useOrganizationPlanStore.getState().isMutating).toBe(false);
    expect(useOrganizationPlanStore.getState().error).toContain("refresh_failed");

    resolveOldPage(oldPage);
    const pageResult = await pageRequest;
    expect(pageResult.applied).toBe(false);
    expect(useOrganizationPlanStore.getState().groups).toEqual([{ groupId: "group-first" }]);
    expect(useOrganizationPlanStore.getState().error).toContain("refresh_failed");
  });

  it("releases pagination loading immediately when Analyze takes ownership", async () => {
    const planA = { ...plan, id: "plan-analyze", revision: 4 };
    const page = { planId: planA.id, planRevision: planA.revision, groups: [{ groupId: "group-old" }], effectiveSummary: { ready: 1, reviewed: 0, pendingReview: 0, blocked: 0 }, nextCursor: null, hasMore: false };
    let resolvePage: (value: typeof page) => void = () => undefined;
    const deferredPage = new Promise<typeof page>((resolve) => { resolvePage = resolve; });
    apiMocks.queryOrganizationPlanGroups.mockImplementation((request: { cursor?: string | null }) => request.cursor ? deferredPage : page);
    apiMocks.analyzeOrganizationPlanItems.mockResolvedValue({ queuedCount: 2 });
    useOrganizationPlanStore.setState({ activePlan: planA, plans: [planA], groups: [{ groupId: "group-first" } as any], groupNextCursor: "cursor-a", groupHasMore: true, isPlanListLoading: false, isLoading: false, isMutating: false, error: null, requestEpoch: 0, mutationToken: 0, groupRequestEpoch: 0, groupLoadingOwner: null });

    const pageRequest = useOrganizationPlanStore.getState().loadNextGroupPage();
    await Promise.resolve();
    const analyzeRequest = useOrganizationPlanStore.getState().analyzeMissing(["item-a"]);
    await Promise.resolve();

    expect(useOrganizationPlanStore.getState().isLoading).toBe(false);
    expect(useOrganizationPlanStore.getState().groupLoadingOwner).toBeNull();
    await expect(analyzeRequest).resolves.toMatchObject({ applied: true, value: 2 });
    expect(useOrganizationPlanStore.getState().isLoading).toBe(false);

    resolvePage(page);
    await expect(pageRequest).resolves.toMatchObject({ applied: false, reason: "superseded" });
    expect(useOrganizationPlanStore.getState().groups).toEqual([{ groupId: "group-first" }]);
  });

  it("does not let Analyze or Dry Run clear a newer open-plan owner", async () => {
    const planA = { ...plan, id: "plan-old", revision: 4 };
    const planB = { ...plan, id: "plan-new", revision: 8 };
    const planBPage = { planId: planB.id, planRevision: planB.revision, groups: [{ groupId: "group-new" }], effectiveSummary: { ready: 1, reviewed: 0, pendingReview: 0, blocked: 0 }, nextCursor: null, hasMore: false };
    let resolvePlanB: (value: OrganizationPlan) => void = () => undefined;
    let resolvePlanBPage: (value: typeof planBPage) => void = () => undefined;
    const pendingPlanB = new Promise<OrganizationPlan>((resolve) => { resolvePlanB = resolve; });
    const pendingPlanBPage = new Promise<typeof planBPage>((resolve) => { resolvePlanBPage = resolve; });
    apiMocks.getOrganizationPlan.mockReturnValue(pendingPlanB);
    apiMocks.queryOrganizationPlanGroups.mockReturnValue(pendingPlanBPage);
    useOrganizationPlanStore.setState({ activePlan: planA, plans: [planA, planB], groups: [], groupNextCursor: null, groupHasMore: false, isPlanListLoading: false, isLoading: false, isMutating: false, error: null, requestEpoch: 0, mutationToken: 0, groupRequestEpoch: 0, groupLoadingOwner: null });

    const openPlanRequest = useOrganizationPlanStore.getState().openPlan(planB.id);
    await Promise.resolve();
    const dryRunResult = await useOrganizationPlanStore.getState().createDryRun();
    const analyzeResult = await useOrganizationPlanStore.getState().analyzeMissing();

    expect(dryRunResult).toMatchObject({ applied: false, reason: "superseded" });
    expect(analyzeResult).toMatchObject({ applied: false, reason: "superseded" });
    expect(apiMocks.getOrganizationPlanDryRun).not.toHaveBeenCalled();
    expect(apiMocks.analyzeOrganizationPlanItems).not.toHaveBeenCalled();
    expect(useOrganizationPlanStore.getState().groupLoadingOwner?.kind).toBe("open_plan");
    expect(useOrganizationPlanStore.getState().isLoading).toBe(true);

    resolvePlanB(planB);
    resolvePlanBPage(planBPage);
    await openPlanRequest;
    expect(useOrganizationPlanStore.getState().activePlan?.id).toBe(planB.id);
    expect(useOrganizationPlanStore.getState().isLoading).toBe(false);
    expect(useOrganizationPlanStore.getState().groupLoadingOwner).toBeNull();
  });

  it("rejects a duplicate createPlan call before issuing a second backend request", async () => {
    const createdPlan = { ...plan, id: "plan-created" };
    let resolveCreate: (value: OrganizationPlan) => void = () => undefined;
    const pendingCreate = new Promise<OrganizationPlan>((resolve) => { resolveCreate = resolve; });
    apiMocks.createOrganizationPlan.mockReturnValue(pendingCreate);
    apiMocks.getOrganizationPlan.mockResolvedValue(createdPlan);
    apiMocks.queryOrganizationPlanGroups.mockResolvedValue({ planId: createdPlan.id, planRevision: createdPlan.revision, groups: [], effectiveSummary: { ready: 0, reviewed: 0, pendingReview: 0, blocked: 0 }, nextCursor: null, hasMore: false });
    useOrganizationPlanStore.setState({ activePlan: null, plans: [], planListState: "loaded", planListError: null, createPlanError: null, isPlanListLoading: false, isLoading: false, isMutating: false, error: null, requestEpoch: 0, mutationToken: 0 });

    const firstRequest = useOrganizationPlanStore.getState().createPlan({ kind: "explicit", fileIds: ["file-a"] } as any, 1, "Created plan");
    await Promise.resolve();
    const secondResult = await useOrganizationPlanStore.getState().createPlan({ kind: "explicit", fileIds: ["file-a"] } as any, 1, "Created plan");

    expect(secondResult).toMatchObject({ applied: false, reason: "superseded" });
    expect(apiMocks.createOrganizationPlan).toHaveBeenCalledOnce();
    resolveCreate(createdPlan);
    await firstRequest;
    expect(apiMocks.createOrganizationPlan).toHaveBeenCalledOnce();
  });

  it("keeps Plan List failure distinct from an empty loaded list and blocks creation", async () => {
    apiMocks.listOrganizationPlans.mockRejectedValueOnce(new Error("plan_list_failed"));

    await useOrganizationPlanStore.getState().loadPlans();

    expect(useOrganizationPlanStore.getState().planListState).toBe("failed");
    expect(useOrganizationPlanStore.getState().planListError).toContain("plan_list_failed");
    expect(useOrganizationPlanStore.getState().plans).toEqual([]);
    const result = await useOrganizationPlanStore.getState().createPlan({ kind: "explicit", fileIds: ["file-a"] } as any, 1, "Blocked plan");
    expect(result).toMatchObject({ applied: false, reason: "superseded" });
    expect(apiMocks.createOrganizationPlan).not.toHaveBeenCalled();
  });

  it("only exposes an empty create state after a successful retry", async () => {
    apiMocks.listOrganizationPlans
      .mockRejectedValueOnce(new Error("plan_list_failed"))
      .mockResolvedValueOnce([]);

    await useOrganizationPlanStore.getState().loadPlans();
    expect(useOrganizationPlanStore.getState().planListState).toBe("failed");
    await useOrganizationPlanStore.getState().loadPlans();

    expect(useOrganizationPlanStore.getState().planListState).toBe("loaded");
    expect(useOrganizationPlanStore.getState().planListError).toBeNull();
    expect(useOrganizationPlanStore.getState().plans).toEqual([]);
  });

  it("blocks direct create calls until Plan List loading has succeeded", async () => {
    for (const planListState of ["loading", "failed"] as const) {
      useOrganizationPlanStore.setState({ planListState, planListError: planListState === "failed" ? "plan_list_failed" : null, plans: [], activePlan: null, isPlanListLoading: planListState === "loading", isLoading: false, isMutating: false });
      const result = await useOrganizationPlanStore.getState().createPlan({ kind: "explicit", fileIds: ["file-a"] } as any, 1, "Blocked plan");
      expect(result).toMatchObject({ applied: false, reason: "superseded" });
    }
    expect(apiMocks.createOrganizationPlan).not.toHaveBeenCalled();
  });

  it("keeps a create failure visible without changing the successful Plan List state", async () => {
    apiMocks.createOrganizationPlan.mockRejectedValueOnce(new Error("create_failed"));
    useOrganizationPlanStore.setState({ planListState: "loaded", planListError: null, plans: [], activePlan: null, isPlanListLoading: false, isLoading: false, isMutating: false, createPlanError: null });

    await expect(useOrganizationPlanStore.getState().createPlan({ kind: "explicit", fileIds: ["file-a"] } as any, 1, "Retryable plan")).rejects.toThrow("create_failed");

    expect(useOrganizationPlanStore.getState().planListState).toBe("loaded");
    expect(useOrganizationPlanStore.getState().createPlanError).toContain("create_failed");
    expect(useOrganizationPlanStore.getState().planListError).toBeNull();
  });

  it("keeps plan-list loading independent from group projection loading", async () => {
    let resolvePlans: (value: OrganizationPlan[]) => void = () => undefined;
    const plansRequest = new Promise<OrganizationPlan[]>((resolve) => { resolvePlans = resolve; });
    let resolveOpenPlan: (value: OrganizationPlan) => void = () => undefined;
    let resolveGroups: (value: { planId: string; planRevision: number; groups: any[]; effectiveSummary: any; nextCursor: null; hasMore: false }) => void = () => undefined;
    const openPlanResponse = new Promise<OrganizationPlan>((resolve) => { resolveOpenPlan = resolve; });
    const groupsResponse = new Promise<{ planId: string; planRevision: number; groups: any[]; effectiveSummary: any; nextCursor: null; hasMore: false }>((resolve) => { resolveGroups = resolve; });
    apiMocks.listOrganizationPlans.mockReturnValue(plansRequest);
    apiMocks.getOrganizationPlan.mockReturnValue(openPlanResponse);
    apiMocks.queryOrganizationPlanGroups.mockReturnValue(groupsResponse);
    useOrganizationPlanStore.setState({ activePlan: null, plans: [], isPlanListLoading: false, isLoading: false, isMutating: false, error: null, requestEpoch: 0, mutationToken: 0, groupRequestEpoch: 0, groupLoadingOwner: null });

    const listRequest = useOrganizationPlanStore.getState().loadPlans();
    await Promise.resolve();
    const openRequest = useOrganizationPlanStore.getState().openPlan(plan.id);
    await Promise.resolve();
    expect(useOrganizationPlanStore.getState().isPlanListLoading).toBe(true);
    expect(useOrganizationPlanStore.getState().isLoading).toBe(true);

    resolvePlans([plan]);
    await listRequest;
    expect(useOrganizationPlanStore.getState().isPlanListLoading).toBe(false);
    expect(useOrganizationPlanStore.getState().isLoading).toBe(true);

    resolveOpenPlan(plan);
    resolveGroups({ planId: plan.id, planRevision: plan.revision, groups: [], effectiveSummary: { ready: 0, reviewed: 0, pendingReview: 0, blocked: 0 }, nextCursor: null, hasMore: false });
    await openRequest;
    expect(useOrganizationPlanStore.getState().isLoading).toBe(false);
    expect(useOrganizationPlanStore.getState().isPlanListLoading).toBe(false);
  });

  it("keeps a pending plan-list request from relocking a completed group projection", async () => {
    let resolvePlans: (value: OrganizationPlan[]) => void = () => undefined;
    let resolveGroups: (value: { planId: string; planRevision: number; groups: any[]; effectiveSummary: any; nextCursor: null; hasMore: false }) => void = () => undefined;
    const plansRequest = new Promise<OrganizationPlan[]>((resolve) => { resolvePlans = resolve; });
    const groupsResponse = new Promise<{ planId: string; planRevision: number; groups: any[]; effectiveSummary: any; nextCursor: null; hasMore: false }>((resolve) => { resolveGroups = resolve; });
    apiMocks.listOrganizationPlans.mockReturnValue(plansRequest);
    apiMocks.getOrganizationPlan.mockResolvedValue(plan);
    apiMocks.queryOrganizationPlanGroups.mockReturnValue(groupsResponse);
    useOrganizationPlanStore.setState({ activePlan: null, plans: [], isPlanListLoading: false, isLoading: false, isMutating: false, error: null, requestEpoch: 0, mutationToken: 0, groupRequestEpoch: 0, groupLoadingOwner: null });

    const openRequest = useOrganizationPlanStore.getState().openPlan(plan.id);
    await Promise.resolve();
    const listRequest = useOrganizationPlanStore.getState().loadPlans();
    await Promise.resolve();
    expect(useOrganizationPlanStore.getState().isPlanListLoading).toBe(true);
    expect(useOrganizationPlanStore.getState().isLoading).toBe(true);

    resolveGroups({ planId: plan.id, planRevision: plan.revision, groups: [], effectiveSummary: { ready: 0, reviewed: 0, pendingReview: 0, blocked: 0 }, nextCursor: null, hasMore: false });
    await openRequest;
    expect(useOrganizationPlanStore.getState().isLoading).toBe(false);
    expect(useOrganizationPlanStore.getState().isPlanListLoading).toBe(true);

    resolvePlans([plan]);
    await listRequest;
    expect(useOrganizationPlanStore.getState().isPlanListLoading).toBe(false);
    expect(useOrganizationPlanStore.getState().isLoading).toBe(false);
  });

  it("does not let an old page release a newer open-plan loading owner", async () => {
    const planA = { ...plan, id: "plan-a", revision: 4 };
    const planB = { ...plan, id: "plan-b", revision: 8 };
    const oldPage = { planId: planA.id, planRevision: planA.revision, groups: [{ groupId: "group-old" }], effectiveSummary: { ready: 1, reviewed: 0, pendingReview: 0, blocked: 0 }, nextCursor: null, hasMore: false };
    const planBPage = { planId: planB.id, planRevision: planB.revision, groups: [{ groupId: "group-b" }], effectiveSummary: { ready: 1, reviewed: 0, pendingReview: 0, blocked: 0 }, nextCursor: null, hasMore: false };
    let resolveOldPage: (value: typeof oldPage) => void = () => undefined;
    let resolvePlanBPage: (value: typeof planBPage) => void = () => undefined;
    const oldPagePending = new Promise<typeof oldPage>((resolve) => { resolveOldPage = resolve; });
    const planBPagePending = new Promise<typeof planBPage>((resolve) => { resolvePlanBPage = resolve; });
    apiMocks.getOrganizationPlan.mockImplementation((planId: string) => Promise.resolve(planId === planB.id ? planB : planA));
    apiMocks.queryOrganizationPlanGroups.mockImplementation((request: { planId: string; cursor?: string | null }) => {
      if (request.cursor) return oldPagePending;
      if (request.planId === planB.id) return planBPagePending;
      return Promise.resolve({ ...oldPage, nextCursor: null, hasMore: false });
    });
    useOrganizationPlanStore.setState({ activePlan: planA, plans: [planA, planB], groups: [{ groupId: "group-first" } as any], groupNextCursor: "cursor-a", groupHasMore: true, isLoading: false, isMutating: false, error: null, requestEpoch: 0, mutationToken: 0, groupRequestEpoch: 0, groupLoadingOwner: null });

    const oldPageRequest = useOrganizationPlanStore.getState().loadNextGroupPage();
    await Promise.resolve();
    const openPlanRequest = useOrganizationPlanStore.getState().openPlan(planB.id);
    await Promise.resolve();
    expect(useOrganizationPlanStore.getState().isLoading).toBe(true);

    resolveOldPage(oldPage);
    const oldPageResult = await oldPageRequest;
    expect(oldPageResult.applied).toBe(false);
    expect(useOrganizationPlanStore.getState().isLoading).toBe(true);

    resolvePlanBPage(planBPage);
    await openPlanRequest;
    expect(useOrganizationPlanStore.getState().activePlan?.id).toBe(planB.id);
    expect(useOrganizationPlanStore.getState().groups).toEqual(planBPage.groups);
    expect(useOrganizationPlanStore.getState().isLoading).toBe(false);
  });
});
