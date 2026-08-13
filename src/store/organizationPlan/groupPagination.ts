import { tauriApi } from "../../api/tauriApi";
import { readableError } from "../../utils/viewHelpers";
import type { OrganizationPlanState } from "../useOrganizationPlanStore";
import type { OrganizationMutationResult } from "../useOrganizationPlanStore";
import {
  isOrganizationGroupProjectionChangedError,
  matchesGroupPage,
  ownsGroupPage,
  ownsGroupPageLoading,
  type GroupLoadingOwner,
  type GroupPageRequest
} from "./ownership";

type Context = {
  get: () => OrganizationPlanState;
  set: (
    update:
      | Partial<OrganizationPlanState>
      | ((state: OrganizationPlanState) => Partial<OrganizationPlanState>)
  ) => void;
};

function superseded<T>(value?: T): OrganizationMutationResult<T> {
  return value === undefined ? { applied: false, reason: "superseded" } : { applied: false, value, reason: "superseded" };
}

export async function openPlan({ get, set }: Context, planId: string): Promise<void> {
  if (get().isExecutionInFlight) return;
  const epoch = get().requestEpoch + 1;
  const groupRequestEpoch = get().groupRequestEpoch + 1;
  const loadingOwner: GroupLoadingOwner = {
    kind: "open_plan",
    epoch: groupRequestEpoch,
    planId,
    planRevision: null,
    cursor: null,
    projectionFingerprint: null
  };
  set({
    activePlan: null,
    requestEpoch: epoch,
    groupRequestEpoch,
    groupLoadingOwner: loadingOwner,
    activePlanState: "opening",
    openPlanError: null,
    openPlanErrorPlanId: planId,
    isLoading: true,
    isMutating: false,
    error: null,
    groups: [],
    groupProjectionFingerprint: null,
    groupNextCursor: null,
    groupHasMore: false,
    dryRun: null,
    dryRunSelection: null,
    executionResult: null
  });
  try {
    const [plan, groupPage] = await Promise.all([
      tauriApi.getOrganizationPlan(planId),
      tauriApi.queryOrganizationPlanGroups({ planId, pageSize: 100, cursor: null })
    ]);
    if (epoch !== get().requestEpoch || get().groupLoadingOwner !== loadingOwner) return;
    if (!matchesGroupPage(groupPage, planId, plan.revision)) throw new Error("organization_group_page_stale");
    const projectedPlan = { ...plan, effectiveSummary: groupPage.effectiveSummary };
    set((state) => ({
      activePlan: projectedPlan,
      plans: [projectedPlan, ...state.plans.filter((item) => item.id !== projectedPlan.id)]
        .sort((left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id)),
      groups: groupPage.groups,
      groupProjectionFingerprint: groupPage.projectionFingerprint,
      groupNextCursor: groupPage.nextCursor,
      groupHasMore: groupPage.hasMore,
      activePlanState: "loaded",
      openPlanError: null,
      openPlanErrorPlanId: null,
      isLoading: false,
      groupLoadingOwner: null
    }));
  } catch (error) {
    if (epoch === get().requestEpoch && get().groupLoadingOwner === loadingOwner) {
      set({ activePlanState: "failed", openPlanError: readableError(error), openPlanErrorPlanId: planId, isLoading: false, groupLoadingOwner: null });
    }
  }
}

export async function loadNextGroupPage({ get, set }: Context): Promise<OrganizationMutationResult<void>> {
  const state = get();
  const { activePlan, groupProjectionFingerprint, groupNextCursor, groupHasMore, isLoading } = state;
  if (!activePlan || !groupNextCursor || !groupHasMore || isLoading) return superseded();
  if (!groupProjectionFingerprint) {
    set({ groupProjectionFingerprint: null, groupNextCursor: null, groupHasMore: false });
    void get().openPlan(activePlan.id);
    return superseded();
  }
  const loadingOwner: GroupLoadingOwner = {
    kind: "pagination",
    epoch: state.groupRequestEpoch + 1,
    planId: activePlan.id,
    planRevision: activePlan.revision,
    cursor: groupNextCursor,
    projectionFingerprint: groupProjectionFingerprint
  };
  const request: GroupPageRequest = {
    groupRequestEpoch: loadingOwner.epoch,
    requestEpoch: state.requestEpoch,
    mutationToken: state.mutationToken,
    planId: activePlan.id,
    planRevision: activePlan.revision,
    cursor: groupNextCursor,
    projectionFingerprint: groupProjectionFingerprint,
    loadingOwner
  };
  set({ groupRequestEpoch: request.groupRequestEpoch, groupLoadingOwner: loadingOwner, isLoading: true, error: null });
  try {
    const page = await tauriApi.queryOrganizationPlanGroups({
      planId: request.planId,
      pageSize: 100,
      cursor: request.cursor
    });
    if (!ownsGroupPage(get, request) || !matchesGroupPage(page, request.planId, request.planRevision)) {
      if (ownsGroupPageLoading(get, request)) set({ isLoading: false, groupLoadingOwner: null });
      return superseded();
    }
    if (!matchesGroupPage(page, request.planId, request.planRevision, request.projectionFingerprint)) {
      set({ groupProjectionFingerprint: null, groupNextCursor: null, groupHasMore: false, isLoading: false, groupLoadingOwner: null, error: null });
      await get().openPlan(request.planId);
      return superseded();
    }
    set((current) => ({
      groups: [...current.groups, ...page.groups],
      groupNextCursor: page.nextCursor,
      groupHasMore: page.hasMore,
      isLoading: false,
      groupLoadingOwner: null
    }));
    return { applied: true };
  } catch (error) {
    if (ownsGroupPage(get, request)) {
      if (isOrganizationGroupProjectionChangedError(error)) {
        set({ groupProjectionFingerprint: null, groupNextCursor: null, groupHasMore: false, isLoading: false, groupLoadingOwner: null, error: null });
        await get().openPlan(request.planId);
        return superseded();
      }
      set({ isLoading: false, groupLoadingOwner: null, error: readableError(error) });
      throw error;
    }
    if (ownsGroupPageLoading(get, request)) set({ isLoading: false, groupLoadingOwner: null });
    return superseded();
  }
}
