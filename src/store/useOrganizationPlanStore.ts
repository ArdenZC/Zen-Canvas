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
  loadPlans: () => Promise<void>;
  createPlan: (source: LibrarySelectionV1, expectedCount: number, title?: string) => Promise<OrganizationPlan>;
  openPlan: (planId: string) => Promise<void>;
  loadNextGroupPage: () => Promise<void>;
  updateGroupDecision: (group: OrganizationPlanGroupSummary, decision: "accepted" | "kept" | "undecided") => Promise<void>;
  updateDecision: (item: OrganizationPlanItem, decision: DurableDecision, editedFilename?: string) => Promise<void>;
  refreshPlan: () => Promise<void>;
  analyzeMissing: (itemIds?: string[]) => Promise<number>;
  createDryRun: (selection?: OrganizationPlanSelection) => Promise<OrganizationPlanDryRun>;
  executeDryRun: () => Promise<ExecuteOrganizationPlanResult>;
  cancelPlan: () => Promise<void>;
  clearError: () => void;
}

function replacePlan(plans: OrganizationPlan[], plan: OrganizationPlan) {
  return [plan, ...plans.filter((item) => item.id !== plan.id)]
    .sort((left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id));
}

function ownsPlanMutation(
  getState: () => OrganizationPlanState,
  planId: string,
  requestEpoch: number,
  mutationToken: number
) {
  const state = getState();
  return state.requestEpoch === requestEpoch
    && state.mutationToken === mutationToken
    && state.activePlan?.id === planId;
}

function ownsMutation(getState: () => OrganizationPlanState, requestEpoch: number, mutationToken: number) {
  const state = getState();
  return state.requestEpoch === requestEpoch && state.mutationToken === mutationToken;
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
      if (!ownsMutation(get, requestEpoch, mutationToken)) return plan;
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
      return plan;
    } catch (error) {
      if (ownsMutation(get, requestEpoch, mutationToken)) set({ isMutating: false, error: readableError(error) });
      throw error;
    }
  },

  openPlan: async (planId) => {
    const epoch = get().requestEpoch + 1;
    set({ requestEpoch: epoch, isLoading: true, isMutating: false, error: null, groups: [], groupNextCursor: null, groupHasMore: false, dryRun: null, dryRunSelection: null, executionResult: null });
    try {
      const [plan, groupPage] = await Promise.all([
        tauriApi.getOrganizationPlan(planId),
        tauriApi.queryOrganizationPlanGroups({ planId, pageSize: 100, cursor: null })
      ]);
      if (epoch !== get().requestEpoch) return;
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
    const { activePlan, groupNextCursor, groupHasMore, isLoading, requestEpoch } = get();
    if (!activePlan || !groupNextCursor || !groupHasMore || isLoading) return;
    set({ isLoading: true, error: null });
    try {
      const page = await tauriApi.queryOrganizationPlanGroups({
        planId: activePlan.id,
        pageSize: 100,
        cursor: groupNextCursor
      });
      if (requestEpoch !== get().requestEpoch) return;
      set((state) => ({
        groups: [...state.groups, ...page.groups],
        groupNextCursor: page.nextCursor,
        groupHasMore: page.hasMore,
        isLoading: false
      }));
    } catch (error) {
      set({ isLoading: false, error: readableError(error) });
    }
  },

  updateGroupDecision: async (group, decision) => {
    const plan = get().activePlan;
    if (!plan) return;
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
      if (!ownsPlanMutation(get, plan.id, requestEpoch, mutationToken)) return;
      await get().openPlan(plan.id);
    } catch (error) {
      if (ownsPlanMutation(get, plan.id, requestEpoch, mutationToken)) set({ isMutating: false, error: readableError(error) });
      throw error;
    }
  },

  updateDecision: async (item, decision, editedFilename) => {
    const plan = get().activePlan;
    if (!plan) return;
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
      if (!ownsPlanMutation(get, plan.id, requestEpoch, mutationToken)) return;
      const groupPage = await tauriApi.queryOrganizationPlanGroups({ planId: updatedPlan.id, pageSize: 100, cursor: null });
      if (!ownsPlanMutation(get, plan.id, requestEpoch, mutationToken)) return;
      const projectedPlan = { ...updatedPlan, effectiveSummary: groupPage.effectiveSummary };
      set((state) => ({
        activePlan: projectedPlan,
        plans: replacePlan(state.plans, projectedPlan),
        groups: groupPage.groups,
        groupNextCursor: groupPage.nextCursor,
        groupHasMore: groupPage.hasMore,
        isMutating: false
      }));
    } catch (error) {
      if (ownsPlanMutation(get, plan.id, requestEpoch, mutationToken)) set({ isMutating: false, error: readableError(error) });
      throw error;
    }
  },

  refreshPlan: async () => {
    const plan = get().activePlan;
    if (!plan) return;
    const requestEpoch = get().requestEpoch;
    const mutationToken = get().mutationToken + 1;
    set({ isMutating: true, mutationToken, error: null, dryRun: null, dryRunSelection: null });
    try {
      const updated = await tauriApi.refreshOrganizationPlan({
        planId: plan.id,
        expectedPlanRevision: plan.revision
      });
      if (!ownsPlanMutation(get, plan.id, requestEpoch, mutationToken)) return;
      set((state) => ({ activePlan: updated, plans: replacePlan(state.plans, updated), isMutating: false }));
      await get().openPlan(updated.id);
    } catch (error) {
      if (ownsPlanMutation(get, plan.id, requestEpoch, mutationToken)) set({ isMutating: false, error: readableError(error) });
    }
  },

  analyzeMissing: async (itemIds = []) => {
    const plan = get().activePlan;
    if (!plan) return 0;
    const requestEpoch = get().requestEpoch;
    const mutationToken = get().mutationToken + 1;
    set({ isMutating: true, mutationToken, error: null });
    try {
      const result = await tauriApi.analyzeOrganizationPlanItems({
        planId: plan.id,
        expectedPlanRevision: plan.revision,
        itemIds
      });
      if (ownsPlanMutation(get, plan.id, requestEpoch, mutationToken)) set({ isMutating: false });
      return result.queuedCount;
    } catch (error) {
      if (ownsPlanMutation(get, plan.id, requestEpoch, mutationToken)) set({ isMutating: false, error: readableError(error) });
      return 0;
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
      if (!ownsPlanMutation(get, plan.id, requestEpoch, mutationToken)) return dryRun;
      set({ dryRun, dryRunSelection: persistedSelection, isMutating: false });
      return dryRun;
    } catch (error) {
      if (ownsPlanMutation(get, plan.id, requestEpoch, mutationToken)) set({ isMutating: false, error: readableError(error) });
      throw error;
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
      if (!ownsPlanMutation(get, plan.id, requestEpoch, mutationToken)) return result;
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
      return result;
    } catch (error) {
      if (ownsPlanMutation(get, plan.id, requestEpoch, mutationToken)) set({ isMutating: false, error: readableError(error) });
      throw error;
    }
  },

  cancelPlan: async () => {
    const plan = get().activePlan;
    if (!plan) return;
    const requestEpoch = get().requestEpoch;
    const mutationToken = get().mutationToken + 1;
    set({ isMutating: true, mutationToken, error: null });
    try {
      const updated = await tauriApi.cancelOrganizationPlan({
        planId: plan.id,
        expectedPlanRevision: plan.revision
      });
      if (!ownsPlanMutation(get, plan.id, requestEpoch, mutationToken)) return;
      set((state) => ({ activePlan: updated, plans: replacePlan(state.plans, updated) }));
      await get().openPlan(updated.id);
    } catch (error) {
      if (ownsPlanMutation(get, plan.id, requestEpoch, mutationToken)) set({ isMutating: false, error: readableError(error) });
    }
  },

  clearError: () => set({ error: null })
}));
