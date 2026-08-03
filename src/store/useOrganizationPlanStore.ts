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

export type OrganizationMutationResult<T = void> =
  | { applied: true; value?: T }
  | { applied: false; value?: T; reason: "superseded" };

interface OrganizationPlanState {
  plans: OrganizationPlan[];
  activePlan: OrganizationPlan | null;
  groups: OrganizationPlanGroupSummary[];
  groupNextCursor: string | null;
  groupHasMore: boolean;
  dryRun: OrganizationPlanDryRun | null;
  dryRunSelection: OrganizationPlanSelection | null;
  executionResult: ExecuteOrganizationPlanResult | null;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  requestEpoch: number;
  mutationToken: number;
  groupRequestEpoch: number;
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

function applied<T>(value?: T): OrganizationMutationResult<T> {
  return value === undefined ? { applied: true } : { applied: true, value };
}

function superseded<T>(value?: T): OrganizationMutationResult<T> {
  return value === undefined ? { applied: false, reason: "superseded" } : { applied: false, value, reason: "superseded" };
}

function ownsGroupPage(
  getState: () => OrganizationPlanState,
  request: { groupRequestEpoch: number; requestEpoch: number; mutationToken: number; planId: string; planRevision: number; cursor: string }
) {
  const state = getState();
  return state.groupRequestEpoch === request.groupRequestEpoch
    && state.requestEpoch === request.requestEpoch
    && state.mutationToken === request.mutationToken
    && state.activePlan?.id === request.planId
    && state.activePlan.revision === request.planRevision
    && state.groupNextCursor === request.cursor;
}

function ownsGroupPageLoading(
  getState: () => OrganizationPlanState,
  request: { groupRequestEpoch: number; requestEpoch: number; planId: string; planRevision: number; cursor: string }
) {
  const state = getState();
  return state.isLoading
    && state.groupRequestEpoch === request.groupRequestEpoch
    && state.requestEpoch === request.requestEpoch
    && state.activePlan?.id === request.planId
    && state.activePlan.revision === request.planRevision
    && state.groupNextCursor === request.cursor;
}

function matchesGroupPage(page: { planId: string; planRevision: number }, planId: string, planRevision: number) {
  return page.planId === planId && page.planRevision === planRevision;
}

export const useOrganizationPlanStore = create<OrganizationPlanState>((set, get) => ({
  plans: [],
  activePlan: null,
  groups: [],
  groupNextCursor: null,
  groupHasMore: false,
  dryRun: null,
  dryRunSelection: null,
  executionResult: null,
  isLoading: false,
  isMutating: false,
  error: null,
  requestEpoch: 0,
  mutationToken: 0,
  groupRequestEpoch: 0,

  loadPlans: async () => {
    set({ isLoading: true, error: null });
    try {
      set({ plans: await tauriApi.listOrganizationPlans(), isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: readableError(error) });
    }
  },

  createPlan: async (source, expectedCount, title) => {
    const requestEpoch = get().requestEpoch;
    const mutationToken = get().mutationToken + 1;
    set({ isMutating: true, mutationToken, error: null });
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
        groupNextCursor: null,
        groupHasMore: false,
        dryRun: null,
        dryRunSelection: null,
        executionResult: null,
        isMutating: false
      }));
      await get().openPlan(plan.id);
      if (get().activePlan?.id !== plan.id) return superseded(plan);
      return applied(plan);
    } catch (error) {
      if (ownsMutation(get, requestEpoch, mutationToken)) {
        set({ isMutating: false, error: readableError(error) });
        throw error;
      }
      return superseded();
    }
  },

  openPlan: async (planId) => {
    const epoch = get().requestEpoch + 1;
    const groupRequestEpoch = get().groupRequestEpoch + 1;
    set({ requestEpoch: epoch, groupRequestEpoch, isLoading: true, isMutating: false, error: null, groups: [], groupNextCursor: null, groupHasMore: false, dryRun: null, dryRunSelection: null, executionResult: null });
    try {
      const [plan, groupPage] = await Promise.all([
        tauriApi.getOrganizationPlan(planId),
        tauriApi.queryOrganizationPlanGroups({ planId, pageSize: 100, cursor: null })
      ]);
      if (epoch !== get().requestEpoch) return;
      if (!matchesGroupPage(groupPage, planId, plan.revision)) throw new Error("organization_group_page_stale");
      const projectedPlan = { ...plan, effectiveSummary: groupPage.effectiveSummary };
      set((state) => ({
        activePlan: projectedPlan,
        plans: replacePlan(state.plans, projectedPlan),
        groups: groupPage.groups,
        groupNextCursor: groupPage.nextCursor,
        groupHasMore: groupPage.hasMore,
        isLoading: false
      }));
    } catch (error) {
      if (epoch === get().requestEpoch) set({ isLoading: false, error: readableError(error) });
    }
  },

  loadNextGroupPage: async () => {
    const state = get();
    const { activePlan, groupNextCursor, groupHasMore, isLoading } = state;
    if (!activePlan || !groupNextCursor || !groupHasMore || isLoading) return superseded();
    const request = {
      groupRequestEpoch: state.groupRequestEpoch + 1,
      requestEpoch: state.requestEpoch,
      mutationToken: state.mutationToken,
      planId: activePlan.id,
      planRevision: activePlan.revision,
      cursor: groupNextCursor
    };
    set({ groupRequestEpoch: request.groupRequestEpoch, isLoading: true, error: null });
    try {
      const page = await tauriApi.queryOrganizationPlanGroups({
        planId: request.planId,
        pageSize: 100,
        cursor: request.cursor
      });
      if (!ownsGroupPage(get, request) || !matchesGroupPage(page, request.planId, request.planRevision)) {
        if (ownsGroupPageLoading(get, request)) set({ isLoading: false });
        return superseded();
      }
      set((state) => ({
        groups: [...state.groups, ...page.groups],
        groupNextCursor: page.nextCursor,
        groupHasMore: page.hasMore,
        isLoading: false
      }));
      return applied();
    } catch (error) {
      if (ownsGroupPage(get, request)) {
        set({ isLoading: false, error: readableError(error) });
        throw error;
      }
      if (ownsGroupPageLoading(get, request)) set({ isLoading: false });
      return superseded();
    }
  },

  updateGroupDecision: async (group, decision) => {
    const plan = get().activePlan;
    if (!plan) return superseded();
    const requestEpoch = get().requestEpoch;
    const mutationToken = get().mutationToken + 1;
    set({ isMutating: true, mutationToken, error: null, dryRun: null, dryRunSelection: null });
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
    if (!plan) return superseded();
    const requestEpoch = get().requestEpoch;
    const mutationToken = get().mutationToken + 1;
    set({ isMutating: true, mutationToken, error: null, dryRun: null, dryRunSelection: null });
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
    if (!plan) return superseded();
    const requestEpoch = get().requestEpoch;
    const mutationToken = get().mutationToken + 1;
    set({ isMutating: true, mutationToken, error: null, dryRun: null, dryRunSelection: null, groupRequestEpoch: get().groupRequestEpoch + 1 });
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
    const plan = get().activePlan;
    if (!plan) return superseded(0);
    const requestEpoch = get().requestEpoch;
    const mutationToken = get().mutationToken + 1;
    set({ isMutating: true, mutationToken, error: null });
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
    const plan = get().activePlan;
    if (!plan) throw new Error("organization_plan_not_selected");
    if (!selection.allAccepted && selection.itemIds.length === 0) throw new Error("organization_selection_required");
    const persistedSelection: OrganizationPlanSelection = selection.allAccepted
      ? { allAccepted: true, itemIds: [] }
      : { allAccepted: false, itemIds: [...selection.itemIds] as [string, ...string[]] };
    const requestEpoch = get().requestEpoch;
    const mutationToken = get().mutationToken + 1;
    set({ isMutating: true, mutationToken, error: null, dryRun: null, dryRunSelection: null });
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
    const requestEpoch = get().requestEpoch;
    const mutationToken = get().mutationToken + 1;
    set({ isMutating: true, mutationToken, error: null });
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
        isMutating: false
      }));
      const refreshEpoch = get().requestEpoch + 1;
      await get().openPlan(result.plan.id);
      if (get().requestEpoch === refreshEpoch && get().mutationToken === mutationToken && get().activePlan?.id === result.plan.id) set({ executionResult: result });
      return applied(result);
    } catch (error) {
      if (ownsPlanMutation(get, plan.id, plan.revision, requestEpoch, mutationToken)) {
        set({ isMutating: false, error: readableError(error) });
        throw error;
      }
      return superseded();
    }
  },

  cancelPlan: async () => {
    const plan = get().activePlan;
    if (!plan) return superseded();
    const requestEpoch = get().requestEpoch;
    const mutationToken = get().mutationToken + 1;
    set({ isMutating: true, mutationToken, error: null });
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

  clearError: () => set({ error: null })
}));
