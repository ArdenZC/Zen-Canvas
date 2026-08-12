import { create } from "zustand";
import { tauriApi } from "../api/tauriApi";
import type {
  ExecuteOrganizationPlanResult,
  LibrarySelectionV1,
  OrganizationPlan,
  OrganizationPlanDryRun,
  OrganizationPlanGroupSummary,
  OrganizationPlanItem,
  OrganizationPlanSelection
} from "../types/domain";
import { readableError } from "../utils/viewHelpers";

type DurableDecision = "accepted" | "kept" | "edited" | "undecided";

type GroupLoadingOwner = {
  kind: "open_plan" | "pagination";
  epoch: number;
  planId: string;
  planRevision: number | null;
  cursor: string | null;
  projectionFingerprint: string | null;
};

export type PlanListState = "idle" | "loading" | "loaded" | "failed";

export type ActivePlanState = "idle" | "opening" | "loaded" | "failed";

export type OrganizationMutationResult<T = void> =
  | { applied: true; value?: T }
  | { applied: false; value?: T; reason: "superseded" };

interface OrganizationPlanState {
  plans: OrganizationPlan[];
  activePlan: OrganizationPlan | null;
  groups: OrganizationPlanGroupSummary[];
  groupProjectionFingerprint: string | null;
  groupNextCursor: string | null;
  groupHasMore: boolean;
  dryRun: OrganizationPlanDryRun | null;
  dryRunSelection: OrganizationPlanSelection | null;
  executionResult: ExecuteOrganizationPlanResult | null;
  planListState: PlanListState;
  planListError: string | null;
  planListRequestEpoch: number;
  activePlanState: ActivePlanState;
  openPlanError: string | null;
  openPlanErrorPlanId: string | null;
  createPlanError: string | null;
  isPlanListLoading: boolean;
  isLoading: boolean;
  isMutating: boolean;
  isExecutionInFlight: boolean;
  error: string | null;
  requestEpoch: number;
  mutationToken: number;
  groupRequestEpoch: number;
  groupLoadingOwner: GroupLoadingOwner | null;
  loadPlans: () => Promise<void>;
  createPlan: (source: LibrarySelectionV1, expectedCount: number, title?: string) => Promise<OrganizationMutationResult<OrganizationPlan>>;
  openPlan: (planId: string) => Promise<void>;
  loadNextGroupPage: () => Promise<OrganizationMutationResult<void>>;
  updateGroupDecision: (group: OrganizationPlanGroupSummary, decision: "accepted" | "kept" | "undecided") => Promise<OrganizationMutationResult<void>>;
  updateDecision: (item: OrganizationPlanItem, decision: DurableDecision, editedFilename?: string) => Promise<OrganizationMutationResult<OrganizationPlan>>;
  refreshPlan: () => Promise<OrganizationMutationResult<OrganizationPlan>>;
  analyzeMissing: (itemIds?: string[]) => Promise<OrganizationMutationResult<number>>;
  createDryRun: (selection?: OrganizationPlanSelection) => Promise<OrganizationMutationResult<OrganizationPlanDryRun>>;
  executeDryRun: () => Promise<OrganizationMutationResult<ExecuteOrganizationPlanResult>>;
  cancelPlan: () => Promise<OrganizationMutationResult<OrganizationPlan>>;
  clearError: () => void;
}

function replacePlan(plans: OrganizationPlan[], plan: OrganizationPlan) {
  return [plan, ...plans.filter((item) => item.id !== plan.id)]
    .sort((left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id));
}

function isTerminalOrganizationPlan(status: OrganizationPlan["status"]): boolean {
  return status === "completed" || status === "cancelled" || status === "failed";
}

export function isReviewableOrganizationPlan(status: OrganizationPlan["status"]): boolean {
  return status === "ready" || status === "partially_completed";
}

export function isHistoricalOrganizationPlan(status: OrganizationPlan["status"]): boolean {
  return isTerminalOrganizationPlan(status);
}

export function organizationPlanReviewCount(plan: OrganizationPlan): number {
  return plan.effectiveSummary?.pendingReview
    ?? plan.summary.pendingReview;
}

export function selectReviewableOrganizationPlan(
  plans: readonly OrganizationPlan[],
  activePlan: OrganizationPlan | null
): OrganizationPlan | null {
  const listedPlans = plans
    .filter((plan) => isReviewableOrganizationPlan(plan.status))
    .map((plan) => activePlan?.id === plan.id ? activePlan : plan);
  const activeReviewable = activePlan && isReviewableOrganizationPlan(activePlan.status)
    ? activePlan
    : null;
  if (activeReviewable && organizationPlanReviewCount(activeReviewable) > 0) return activeReviewable;
  return listedPlans.find((plan) => organizationPlanReviewCount(plan) > 0)
    ?? activeReviewable
    ?? listedPlans[0]
    ?? null;
}

export function organizationPlanPendingReview(
  plans: readonly OrganizationPlan[],
  activePlan: OrganizationPlan | null
): number {
  const selectedPlan = selectReviewableOrganizationPlan(plans, activePlan);
  return selectedPlan ? organizationPlanReviewCount(selectedPlan) : 0;
}

function isCancelableOrganizationPlan(status: OrganizationPlan["status"]): boolean {
  return ["draft", "building", "ready", "stale"].includes(status);
}

function ownsPlanMutation(
  getState: () => OrganizationPlanState,
  planId: string,
  planRevision: number,
  requestEpoch: number,
  mutationToken: number
) {
  const state = getState();
  return state.requestEpoch === requestEpoch
    && state.mutationToken === mutationToken
    && state.activePlan?.id === planId
    && state.activePlan.revision === planRevision;
}

function ownsMutation(getState: () => OrganizationPlanState, requestEpoch: number, mutationToken: number) {
  const state = getState();
  return state.requestEpoch === requestEpoch && state.mutationToken === mutationToken;
}

function takeGroupProjectionOwnership(state: OrganizationPlanState, update: Partial<OrganizationPlanState>) {
  return state.groupLoadingOwner?.kind === "pagination"
    ? { ...update, isLoading: false, groupLoadingOwner: null }
    : update;
}

function applied<T>(value?: T): OrganizationMutationResult<T> {
  return value === undefined ? { applied: true } : { applied: true, value };
}

function superseded<T>(value?: T): OrganizationMutationResult<T> {
  return value === undefined ? { applied: false, reason: "superseded" } : { applied: false, value, reason: "superseded" };
}

function ownsGroupPage(
  getState: () => OrganizationPlanState,
  request: { groupRequestEpoch: number; requestEpoch: number; mutationToken: number; planId: string; planRevision: number; cursor: string; projectionFingerprint: string; loadingOwner: GroupLoadingOwner }
) {
  const state = getState();
  return state.groupLoadingOwner === request.loadingOwner
    && state.groupRequestEpoch === request.groupRequestEpoch
    && state.requestEpoch === request.requestEpoch
    && state.mutationToken === request.mutationToken
    && state.activePlan?.id === request.planId
    && state.activePlan.revision === request.planRevision
    && state.groupProjectionFingerprint === request.projectionFingerprint
    && state.groupNextCursor === request.cursor;
}

function ownsGroupPageLoading(
  getState: () => OrganizationPlanState,
  request: { loadingOwner: GroupLoadingOwner }
) {
  const state = getState();
  return state.isLoading && state.groupLoadingOwner === request.loadingOwner;
}

function matchesGroupPage(
  page: { planId: string; planRevision: number; projectionFingerprint: string },
  planId: string,
  planRevision: number,
  projectionFingerprint?: string
) {
  return page.planId === planId
    && page.planRevision === planRevision
    && typeof page.projectionFingerprint === "string"
    && page.projectionFingerprint.length > 0
    && (projectionFingerprint === undefined || page.projectionFingerprint === projectionFingerprint);
}

function isOrganizationGroupProjectionChangedError(error: unknown): boolean {
  return readableError(error).includes("organization_group_projection_changed");
}

export const useOrganizationPlanStore = create<OrganizationPlanState>((set, get) => ({
  plans: [],
  activePlan: null,
  groups: [],
  groupProjectionFingerprint: null,
  groupNextCursor: null,
  groupHasMore: false,
  dryRun: null,
  dryRunSelection: null,
  executionResult: null,
  planListState: "idle",
  planListError: null,
  planListRequestEpoch: 0,
  activePlanState: "idle",
  openPlanError: null,
  openPlanErrorPlanId: null,
  createPlanError: null,
  isPlanListLoading: false,
  isLoading: false,
  isMutating: false,
  isExecutionInFlight: false,
  error: null,
  requestEpoch: 0,
  mutationToken: 0,
  groupRequestEpoch: 0,
  groupLoadingOwner: null,

  loadPlans: async () => {
    const planListRequestEpoch = get().planListRequestEpoch + 1;
    set({ planListRequestEpoch, planListState: "loading", planListError: null, isPlanListLoading: true });
    try {
      const plans = await tauriApi.listOrganizationPlans();
      if (get().planListRequestEpoch !== planListRequestEpoch) return;
      let projectedPlans = plans;
      const selectedPlan = selectReviewableOrganizationPlan(plans, get().activePlan);
      const hydrationCandidates = plans
        .filter((plan) => isReviewableOrganizationPlan(plan.status)
          && plan.effectiveSummary === null
          && organizationPlanReviewCount(plan) > 0)
        .sort((left, right) => {
          if (selectedPlan?.id === left.id) return -1;
          if (selectedPlan?.id === right.id) return 1;
          return 0;
        });
      for (const candidate of hydrationCandidates) {
        if (get().planListRequestEpoch !== planListRequestEpoch) return;
        try {
          const groupPage = await tauriApi.queryOrganizationPlanGroups({ planId: candidate.id, pageSize: 100, cursor: null });
          if (get().planListRequestEpoch !== planListRequestEpoch) return;
          if (groupPage.planId === candidate.id && groupPage.planRevision === candidate.revision) {
            projectedPlans = projectedPlans.map((plan) => plan.id === candidate.id
              ? { ...plan, effectiveSummary: groupPage.effectiveSummary }
              : plan);
            if (groupPage.effectiveSummary.pendingReview > 0) break;
          }
        } catch {
          // Keep the durable list usable and continue with the next durable
          // candidate whose persisted summary still needs authoritative data.
        }
      }
      if (get().planListRequestEpoch !== planListRequestEpoch) return;
      set({ plans: projectedPlans, planListState: "loaded", planListError: null, isPlanListLoading: false });
    } catch (error) {
      if (get().planListRequestEpoch !== planListRequestEpoch) return;
      set({ planListState: "failed", planListError: readableError(error), isPlanListLoading: false });
    }
  },

  createPlan: async (source, expectedCount, title) => {
    const state = get();
    if (state.planListState !== "loaded" || state.plans.some((plan) => !isTerminalOrganizationPlan(plan.status)) || state.isMutating || state.isPlanListLoading || state.isLoading) return superseded();
    const requestEpoch = state.requestEpoch;
    const mutationToken = state.mutationToken + 1;
    set((state) => takeGroupProjectionOwnership(state, { isMutating: true, mutationToken, createPlanError: null, error: null }));
    try {
      const plan = await tauriApi.createOrganizationPlan({
        version: 1,
        requestId: `organization-plan-${Date.now().toString(36)}`,
        title: title?.trim() || null,
        source,
        expectedCount
      });
      if (!ownsMutation(get, requestEpoch, mutationToken)) return superseded(plan);
      set((state) => ({
        plans: replacePlan(state.plans, plan),
        activePlan: plan,
        groups: [],
        groupProjectionFingerprint: null,
        groupNextCursor: null,
        groupHasMore: false,
        dryRun: null,
        dryRunSelection: null,
        executionResult: null,
        isMutating: false,
        createPlanError: null
      }));
      await get().openPlan(plan.id);
      if (get().activePlan?.id !== plan.id) return superseded(plan);
      return applied(plan);
    } catch (error) {
      if (ownsMutation(get, requestEpoch, mutationToken)) {
        set({ isMutating: false, createPlanError: readableError(error) });
        throw error;
      }
      return superseded();
    }
  },

  openPlan: async (planId) => {
    if (get().isExecutionInFlight) return;
    const epoch = get().requestEpoch + 1;
    const groupRequestEpoch = get().groupRequestEpoch + 1;
    const loadingOwner: GroupLoadingOwner = { kind: "open_plan", epoch: groupRequestEpoch, planId, planRevision: null, cursor: null, projectionFingerprint: null };
    set({ activePlan: null, requestEpoch: epoch, groupRequestEpoch, groupLoadingOwner: loadingOwner, activePlanState: "opening", openPlanError: null, openPlanErrorPlanId: planId, isLoading: true, isMutating: false, error: null, groups: [], groupProjectionFingerprint: null, groupNextCursor: null, groupHasMore: false, dryRun: null, dryRunSelection: null, executionResult: null });
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
        plans: replacePlan(state.plans, projectedPlan),
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
  },

  loadNextGroupPage: async () => {
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
    const request = {
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
      set((state) => ({
        groups: [...state.groups, ...page.groups],
        groupNextCursor: page.nextCursor,
        groupHasMore: page.hasMore,
        isLoading: false,
        groupLoadingOwner: null
      }));
      return applied();
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
  },

  updateGroupDecision: async (group, decision) => {
    const plan = get().activePlan;
    if (!plan || get().isExecutionInFlight) return superseded();
    const requestEpoch = get().requestEpoch;
    const mutationToken = get().mutationToken + 1;
    set((state) => takeGroupProjectionOwnership(state, { isMutating: true, mutationToken, error: null, dryRun: null, dryRunSelection: null }));
    try {
      await tauriApi.updateOrganizationPlanGroupDecision({
        planId: plan.id,
        groupId: group.groupId,
        expectedPlanRevision: plan.revision,
        expectedProjectionFingerprint: group.projectionFingerprint,
        expectedItemCount: group.itemCount,
        decision
      });
      if (!ownsPlanMutation(get, plan.id, plan.revision, requestEpoch, mutationToken)) return superseded();
      await get().openPlan(plan.id);
      return applied();
    } catch (error) {
      if (ownsPlanMutation(get, plan.id, plan.revision, requestEpoch, mutationToken)) {
        set({ isMutating: false, error: readableError(error) });
        throw error;
      }
      return superseded();
    }
  },

  updateDecision: async (item, decision, editedFilename) => {
    const plan = get().activePlan;
    if (!plan || get().isExecutionInFlight) return superseded();
    const requestEpoch = get().requestEpoch;
    const mutationToken = get().mutationToken + 1;
    set((state) => takeGroupProjectionOwnership(state, { isMutating: true, mutationToken, error: null, dryRun: null, dryRunSelection: null }));
    try {
      const updatedPlan = await tauriApi.updateOrganizationPlanDecisions({
        planId: plan.id,
        expectedPlanRevision: plan.revision,
        mutations: [{
          itemId: item.id,
          expectedItemRevision: item.revision,
          decision,
          editedFilename: editedFilename ?? null
        }]
      });
      if (!ownsPlanMutation(get, plan.id, plan.revision, requestEpoch, mutationToken)) return superseded(updatedPlan);
      const groupPage = await tauriApi.queryOrganizationPlanGroups({ planId: updatedPlan.id, pageSize: 100, cursor: null });
      if (!ownsPlanMutation(get, plan.id, plan.revision, requestEpoch, mutationToken)) return superseded(updatedPlan);
      if (!matchesGroupPage(groupPage, updatedPlan.id, updatedPlan.revision)) throw new Error("organization_group_page_stale");
      const projectedPlan = { ...updatedPlan, effectiveSummary: groupPage.effectiveSummary };
      set((state) => ({
        activePlan: projectedPlan,
        plans: replacePlan(state.plans, projectedPlan),
        groups: groupPage.groups,
        groupProjectionFingerprint: groupPage.projectionFingerprint,
        groupNextCursor: groupPage.nextCursor,
        groupHasMore: groupPage.hasMore,
        groupRequestEpoch: state.groupRequestEpoch + 1,
        isMutating: false
      }));
      return applied(updatedPlan);
    } catch (error) {
      if (ownsPlanMutation(get, plan.id, plan.revision, requestEpoch, mutationToken)) {
        set({ isMutating: false, error: readableError(error) });
        throw error;
      }
      return superseded();
    }
  },

  refreshPlan: async () => {
    const plan = get().activePlan;
    if (!plan || get().isExecutionInFlight) return superseded();
    const requestEpoch = get().requestEpoch;
    const mutationToken = get().mutationToken + 1;
    set((state) => takeGroupProjectionOwnership(state, { isMutating: true, mutationToken, error: null, dryRun: null, dryRunSelection: null, groupRequestEpoch: state.groupRequestEpoch + 1 }));
    try {
      const updated = await tauriApi.refreshOrganizationPlan({
        planId: plan.id,
        expectedPlanRevision: plan.revision
      });
      if (!ownsPlanMutation(get, plan.id, plan.revision, requestEpoch, mutationToken)) return superseded(updated);
      set((state) => ({ activePlan: updated, plans: replacePlan(state.plans, updated), isMutating: false }));
      await get().openPlan(updated.id);
      return applied(updated);
    } catch (error) {
      if (ownsPlanMutation(get, plan.id, plan.revision, requestEpoch, mutationToken)) {
        set({ isMutating: false, error: readableError(error) });
        throw error;
      }
      return superseded();
    }
  },

  analyzeMissing: async (itemIds = []) => {
    const state = get();
    const plan = state.activePlan;
    if (!plan) return superseded(0);
    if (state.isMutating || state.groupLoadingOwner?.kind === "open_plan") return superseded(0);
    const requestEpoch = state.requestEpoch;
    const mutationToken = state.mutationToken + 1;
    set((current) => takeGroupProjectionOwnership(current, { isMutating: true, mutationToken, error: null }));
    try {
      const result = await tauriApi.analyzeOrganizationPlanItems({
        planId: plan.id,
        expectedPlanRevision: plan.revision,
        itemIds
      });
      if (!ownsPlanMutation(get, plan.id, plan.revision, requestEpoch, mutationToken)) return superseded(result.queuedCount);
      set({ isMutating: false });
      return applied(result.queuedCount);
    } catch (error) {
      if (ownsPlanMutation(get, plan.id, plan.revision, requestEpoch, mutationToken)) {
        set({ isMutating: false, error: readableError(error) });
        throw error;
      }
      return superseded(0);
    }
  },

  createDryRun: async (selection = { allAccepted: true, itemIds: [] }) => {
    const state = get();
    const plan = state.activePlan;
    if (!plan && state.groupLoadingOwner?.kind === "open_plan") return superseded();
    if (!plan) throw new Error("organization_plan_not_selected");
    if (!selection.allAccepted && selection.itemIds.length === 0) throw new Error("organization_selection_required");
    if (state.isMutating || state.groupLoadingOwner?.kind === "open_plan") return superseded();
    const persistedSelection: OrganizationPlanSelection = selection.allAccepted
      ? { allAccepted: true, itemIds: [] }
      : { allAccepted: false, itemIds: [...selection.itemIds] as [string, ...string[]] };
    const requestEpoch = state.requestEpoch;
    const mutationToken = state.mutationToken + 1;
    set((current) => takeGroupProjectionOwnership(current, { isMutating: true, mutationToken, error: null, dryRun: null, dryRunSelection: null }));
    try {
      const dryRun = await tauriApi.getOrganizationPlanDryRun({
        planId: plan.id,
        expectedPlanRevision: plan.revision,
        itemIds: persistedSelection.itemIds,
        allAccepted: persistedSelection.allAccepted
      });
      if (!ownsPlanMutation(get, plan.id, plan.revision, requestEpoch, mutationToken)) return superseded(dryRun);
      set({ dryRun, dryRunSelection: persistedSelection, isMutating: false });
      return applied(dryRun);
    } catch (error) {
      if (ownsPlanMutation(get, plan.id, plan.revision, requestEpoch, mutationToken)) {
        set({ isMutating: false, error: readableError(error) });
        throw error;
      }
      return superseded();
    }
  },

  executeDryRun: async () => {
    const { activePlan: plan, dryRun, dryRunSelection } = get();
    if (!plan || !dryRun) throw new Error("organization_dry_run_required");
    if (!dryRunSelection) throw new Error("organization_dry_run_selection_required");
    if (get().isExecutionInFlight) return superseded();
    const requestEpoch = get().requestEpoch;
    const mutationToken = get().mutationToken + 1;
    set((state) => takeGroupProjectionOwnership(state, { isMutating: true, isExecutionInFlight: true, mutationToken, error: null }));
    try {
      const result = await tauriApi.executeOrganizationPlan({
        planId: plan.id,
        expectedPlanRevision: dryRun.planRevision,
        dryRunFingerprint: dryRun.dryRunFingerprint,
        itemIds: dryRunSelection.itemIds,
        allAccepted: dryRunSelection.allAccepted,
        confirmed: true
      });
      if (!ownsPlanMutation(get, plan.id, plan.revision, requestEpoch, mutationToken)) return superseded(result);
      set((state) => ({
        executionResult: result,
        activePlan: result.plan,
        plans: replacePlan(state.plans, result.plan),
        dryRun: null,
        dryRunSelection: null,
        isMutating: false,
        isExecutionInFlight: false
      }));
      const refreshEpoch = get().requestEpoch + 1;
      await get().openPlan(result.plan.id);
      if (get().requestEpoch === refreshEpoch && get().mutationToken === mutationToken && get().activePlan?.id === result.plan.id) set({ executionResult: result });
      return applied(result);
    } catch (error) {
      if (ownsPlanMutation(get, plan.id, plan.revision, requestEpoch, mutationToken)) {
        set({ isMutating: false, isExecutionInFlight: false, error: readableError(error) });
        throw error;
      }
      return superseded();
    }
  },

  cancelPlan: async () => {
    const plan = get().activePlan;
    if (!plan || get().isExecutionInFlight || !isCancelableOrganizationPlan(plan.status)) return superseded();
    const requestEpoch = get().requestEpoch;
    const mutationToken = get().mutationToken + 1;
    set((state) => takeGroupProjectionOwnership(state, { isMutating: true, mutationToken, error: null }));
    try {
      const updated = await tauriApi.cancelOrganizationPlan({
        planId: plan.id,
        expectedPlanRevision: plan.revision
      });
      if (!ownsPlanMutation(get, plan.id, plan.revision, requestEpoch, mutationToken)) return superseded(updated);
      set((state) => ({ activePlan: updated, plans: replacePlan(state.plans, updated) }));
      await get().openPlan(updated.id);
      return applied(updated);
    } catch (error) {
      if (ownsPlanMutation(get, plan.id, plan.revision, requestEpoch, mutationToken)) {
        set({ isMutating: false, error: readableError(error) });
        throw error;
      }
      return superseded();
    }
  },

  clearError: () => set({ error: null, planListError: null, openPlanError: null, createPlanError: null })
}));
