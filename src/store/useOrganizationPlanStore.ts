import { create } from "zustand";
import { tauriApi } from "../api/tauriApi";
import type {
  ExecuteOrganizationPlanResult,
  LibrarySelectionV1,
  OrganizationPlan,
  OrganizationPlanDryRun,
  OrganizationPlanGroupSummary,
  OrganizationPlanItem
} from "../types/domain";
import { readableError } from "../utils/viewHelpers";

type DurableDecision = "accepted" | "kept" | "edited" | "undecided";

interface OrganizationPlanState {
  plans: OrganizationPlan[];
  activePlan: OrganizationPlan | null;
  items: OrganizationPlanItem[];
  nextCursor: string | null;
  hasMore: boolean;
  groups: OrganizationPlanGroupSummary[];
  groupNextCursor: string | null;
  groupHasMore: boolean;
  dryRun: OrganizationPlanDryRun | null;
  executionResult: ExecuteOrganizationPlanResult | null;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  requestEpoch: number;
  loadPlans: () => Promise<void>;
  createPlan: (source: LibrarySelectionV1, expectedCount: number, title?: string) => Promise<OrganizationPlan>;
  openPlan: (planId: string) => Promise<void>;
  loadNextPage: () => Promise<void>;
  loadNextGroupPage: () => Promise<void>;
  updateGroupDecision: (group: OrganizationPlanGroupSummary, decision: "accepted" | "kept" | "undecided") => Promise<void>;
  updateDecision: (item: OrganizationPlanItem, decision: DurableDecision, editedFilename?: string) => Promise<void>;
  updateBatch: (items: OrganizationPlanItem[], decision: DurableDecision) => Promise<void>;
  refreshPlan: () => Promise<void>;
  analyzeMissing: (itemIds?: string[]) => Promise<number>;
  createDryRun: (itemIds?: string[]) => Promise<OrganizationPlanDryRun>;
  executeDryRun: () => Promise<ExecuteOrganizationPlanResult>;
  cancelPlan: () => Promise<void>;
  clearError: () => void;
}

function replacePlan(plans: OrganizationPlan[], plan: OrganizationPlan) {
  return [plan, ...plans.filter((item) => item.id !== plan.id)]
    .sort((left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id));
}

export const useOrganizationPlanStore = create<OrganizationPlanState>((set, get) => ({
  plans: [],
  activePlan: null,
  items: [],
  nextCursor: null,
  hasMore: false,
  groups: [],
  groupNextCursor: null,
  groupHasMore: false,
  dryRun: null,
  executionResult: null,
  isLoading: false,
  isMutating: false,
  error: null,
  requestEpoch: 0,

  loadPlans: async () => {
    set({ isLoading: true, error: null });
    try {
      set({ plans: await tauriApi.listOrganizationPlans(), isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: readableError(error) });
    }
  },

  createPlan: async (source, expectedCount, title) => {
    set({ isMutating: true, error: null });
    try {
      const plan = await tauriApi.createOrganizationPlan({
        version: 1,
        requestId: `organization-plan-${Date.now().toString(36)}`,
        title: title?.trim() || null,
        source,
        expectedCount
      });
      set((state) => ({
        plans: replacePlan(state.plans, plan),
        activePlan: plan,
        items: [],
        nextCursor: null,
        hasMore: false,
        groups: [],
        groupNextCursor: null,
        groupHasMore: false,
        dryRun: null,
        executionResult: null,
        isMutating: false
      }));
      await get().openPlan(plan.id);
      return plan;
    } catch (error) {
      set({ isMutating: false, error: readableError(error) });
      throw error;
    }
  },

  openPlan: async (planId) => {
    const epoch = get().requestEpoch + 1;
    set({ requestEpoch: epoch, isLoading: true, error: null, items: [], nextCursor: null, hasMore: false, groups: [], groupNextCursor: null, groupHasMore: false, dryRun: null, executionResult: null });
    try {
      const [plan, page, groupPage] = await Promise.all([
        tauriApi.getOrganizationPlan(planId),
        tauriApi.queryOrganizationPlanItems({ planId, pageSize: 100, cursor: null }),
        tauriApi.queryOrganizationPlanGroups({ planId, pageSize: 100, cursor: null })
      ]);
      if (epoch !== get().requestEpoch) return;
      const projectedPlan = { ...plan, effectiveSummary: groupPage.effectiveSummary ?? plan.effectiveSummary };
      set((state) => ({
        activePlan: projectedPlan,
        plans: replacePlan(state.plans, projectedPlan),
        items: page.items,
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
        groups: groupPage.groups,
        groupNextCursor: groupPage.nextCursor,
        groupHasMore: groupPage.hasMore,
        isLoading: false
      }));
    } catch (error) {
      if (epoch === get().requestEpoch) set({ isLoading: false, error: readableError(error) });
    }
  },

  loadNextPage: async () => {
    const { activePlan, nextCursor, hasMore, isLoading, requestEpoch } = get();
    if (!activePlan || !nextCursor || !hasMore || isLoading) return;
    set({ isLoading: true, error: null });
    try {
      const page = await tauriApi.queryOrganizationPlanItems({
        planId: activePlan.id,
        pageSize: 100,
        cursor: nextCursor
      });
      if (requestEpoch !== get().requestEpoch) return;
      set((state) => ({
        items: [...state.items, ...page.items],
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
        isLoading: false
      }));
    } catch (error) {
      set({ isLoading: false, error: readableError(error) });
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
    set({ isMutating: true, error: null, dryRun: null });
    try {
      await tauriApi.updateOrganizationPlanGroupDecision({
        planId: plan.id,
        groupId: group.groupId,
        expectedPlanRevision: plan.revision,
        decision
      });
      await get().openPlan(plan.id);
      set({ isMutating: false });
    } catch (error) {
      set({ isMutating: false, error: readableError(error) });
      throw error;
    }
  },

  updateDecision: async (item, decision, editedFilename) => {
    const plan = get().activePlan;
    if (!plan) return;
    set({ isMutating: true, error: null, dryRun: null });
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
      const groupPage = await tauriApi.queryOrganizationPlanGroups({ planId: updatedPlan.id, pageSize: 100, cursor: null });
      const projectedPlan = { ...updatedPlan, effectiveSummary: groupPage.effectiveSummary ?? updatedPlan.effectiveSummary };
      set((state) => ({
        activePlan: projectedPlan,
        plans: replacePlan(state.plans, projectedPlan),
        groups: groupPage.groups,
        groupNextCursor: groupPage.nextCursor,
        groupHasMore: groupPage.hasMore,
        items: state.items.map((current) => current.id === item.id
          ? { ...current, decision, editedName: decision === "edited" ? editedFilename ?? null : null, revision: current.revision + 1 }
          : current),
        isMutating: false
      }));
    } catch (error) {
      set({ isMutating: false, error: readableError(error) });
      throw error;
    }
  },

  updateBatch: async (items, decision) => {
    const plan = get().activePlan;
    if (!plan || !items.length) return;
    set({ isMutating: true, error: null, dryRun: null });
    try {
      const updatedPlan = await tauriApi.updateOrganizationPlanDecisions({
        planId: plan.id,
        expectedPlanRevision: plan.revision,
        safeBatch: decision === "accepted",
        mutations: items.map((item) => ({
          itemId: item.id,
          expectedItemRevision: item.revision,
          decision
        }))
      });
      const groupPage = await tauriApi.queryOrganizationPlanGroups({ planId: updatedPlan.id, pageSize: 100, cursor: null });
      const projectedPlan = { ...updatedPlan, effectiveSummary: groupPage.effectiveSummary ?? updatedPlan.effectiveSummary };
      const selected = new Set(items.map((item) => item.id));
      set((state) => ({
        activePlan: projectedPlan,
        plans: replacePlan(state.plans, projectedPlan),
        groups: groupPage.groups,
        groupNextCursor: groupPage.nextCursor,
        groupHasMore: groupPage.hasMore,
        items: state.items.map((item) => selected.has(item.id)
          ? { ...item, decision, editedName: null, revision: item.revision + 1 }
          : item),
        isMutating: false
      }));
    } catch (error) {
      set({ isMutating: false, error: readableError(error) });
      throw error;
    }
  },

  refreshPlan: async () => {
    const plan = get().activePlan;
    if (!plan) return;
    set({ isMutating: true, error: null, dryRun: null });
    try {
      const updated = await tauriApi.refreshOrganizationPlan({
        planId: plan.id,
        expectedPlanRevision: plan.revision
      });
      set((state) => ({ activePlan: updated, plans: replacePlan(state.plans, updated), isMutating: false }));
      await get().openPlan(updated.id);
    } catch (error) {
      set({ isMutating: false, error: readableError(error) });
    }
  },

  analyzeMissing: async (itemIds = []) => {
    const plan = get().activePlan;
    if (!plan) return 0;
    set({ isMutating: true, error: null });
    try {
      const result = await tauriApi.analyzeOrganizationPlanItems({
        planId: plan.id,
        expectedPlanRevision: plan.revision,
        itemIds
      });
      set({ isMutating: false });
      return result.queuedCount;
    } catch (error) {
      set({ isMutating: false, error: readableError(error) });
      return 0;
    }
  },

  createDryRun: async (itemIds = []) => {
    const plan = get().activePlan;
    if (!plan) throw new Error("organization_plan_not_selected");
    set({ isMutating: true, error: null, dryRun: null });
    try {
      const dryRun = await tauriApi.getOrganizationPlanDryRun({
        planId: plan.id,
        expectedPlanRevision: plan.revision,
        itemIds,
        allAccepted: itemIds.length === 0
      });
      set({ dryRun, isMutating: false });
      return dryRun;
    } catch (error) {
      set({ isMutating: false, error: readableError(error) });
      throw error;
    }
  },

  executeDryRun: async () => {
    const { activePlan: plan, dryRun } = get();
    if (!plan || !dryRun) throw new Error("organization_dry_run_required");
    set({ isMutating: true, error: null });
    try {
      const result = await tauriApi.executeOrganizationPlan({
        planId: plan.id,
        expectedPlanRevision: dryRun.planRevision,
        dryRunFingerprint: dryRun.dryRunFingerprint,
        allAccepted: true,
        confirmed: true
      });
      set((state) => ({
        executionResult: result,
        activePlan: result.plan,
        plans: replacePlan(state.plans, result.plan),
        dryRun: null,
        isMutating: false
      }));
      await get().openPlan(result.plan.id);
      set({ executionResult: result });
      return result;
    } catch (error) {
      set({ isMutating: false, error: readableError(error) });
      throw error;
    }
  },

  cancelPlan: async () => {
    const plan = get().activePlan;
    if (!plan) return;
    set({ isMutating: true, error: null });
    try {
      const updated = await tauriApi.cancelOrganizationPlan({
        planId: plan.id,
        expectedPlanRevision: plan.revision
      });
      set((state) => ({ activePlan: updated, plans: replacePlan(state.plans, updated) }));
      await get().openPlan(updated.id);
      set({ isMutating: false });
    } catch (error) {
      set({ isMutating: false, error: readableError(error) });
    }
  },

  clearError: () => set({ error: null })
}));
