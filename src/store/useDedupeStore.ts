import { create } from "zustand";
import { tauriApi } from "../api/tauriApi";
import type {
  DedupeGroup,
  DedupeGroupPage,
  DedupeRun,
  StartDedupeRunRequest
} from "../types/domain";

const activeStatuses = new Set(["queued", "running", "cancelling"]);

export interface DedupeStore {
  activeRun: DedupeRun | null;
  recentRuns: DedupeRun[];
  groups: DedupeGroup[];
  groupsCursor: string | null;
  groupsHasMore: boolean;
  isHydrating: boolean;
  isLoadingGroups: boolean;
  error: string | null;
  listenersRegistered: boolean;
  ensureListeners: () => Promise<void>;
  hydrate: () => Promise<void>;
  start: (request?: StartDedupeRunRequest) => Promise<DedupeRun>;
  cancel: (runId: string) => Promise<DedupeRun>;
  retry: (runId: string) => Promise<DedupeRun>;
  loadGroups: (reset?: boolean) => Promise<void>;
  clearError: () => void;
}

let listenerPromise: Promise<void> | null = null;

function mergeRun(runs: DedupeRun[], next: DedupeRun): DedupeRun[] {
  const merged = [next, ...runs.filter((run) => run.id !== next.id)];
  return merged
    .sort((left, right) => right.createdAt - left.createdAt || right.id.localeCompare(left.id))
    .slice(0, 50);
}

function applyRun(next: DedupeRun) {
  const current = useDedupeStore.getState();
  const known = current.recentRuns.find((run) => run.id === next.id);
  if (known && next.revision < known.revision) return;
  if (known && next.revision > known.revision + 1) {
    void current.hydrate();
    return;
  }
  const recentRuns = mergeRun(current.recentRuns, next);
  const activeRun = activeStatuses.has(next.status)
    ? next
    : current.activeRun?.id === next.id
      ? null
      : current.activeRun;
  useDedupeStore.setState({ activeRun, recentRuns, error: null });
}

export const useDedupeStore = create<DedupeStore>((set, get) => ({
  activeRun: null,
  recentRuns: [],
  groups: [],
  groupsCursor: null,
  groupsHasMore: true,
  isHydrating: false,
  isLoadingGroups: false,
  error: null,
  listenersRegistered: false,

  ensureListeners: async () => {
    if (get().listenersRegistered) return;
    if (listenerPromise) return listenerPromise;
    listenerPromise = Promise.all([
      tauriApi.onDedupeRunUpdated((run) => applyRun(run)),
      tauriApi.onDedupeProgress((progress) => {
        const current = get().activeRun;
        if (!current || current.id !== progress.dedupeJobId) return;
        if (progress.revision !== undefined && progress.revision < current.revision) return;
        set({
          activeRun: {
            ...current,
            phase: progress.phase ?? current.phase,
            processedFiles: progress.processed,
            processedBytes: progress.processedBytes ?? current.processedBytes,
            totalBytes: progress.totalBytes ?? current.totalBytes,
            revision: Math.max(current.revision, progress.revision ?? current.revision),
            warningCount: progress.warningCount ?? current.warningCount,
            errorCount: progress.errorCount ?? current.errorCount
          }
        });
      }),
      tauriApi.onDedupeComplete((payload) => {
        const current = get().activeRun;
        if (!current || current.id !== payload.dedupeJobId) return;
        void get().hydrate();
      })
    ]).then(() => {
      set({ listenersRegistered: true });
    }).finally(() => {
      listenerPromise = null;
    });
    return listenerPromise;
  },

  hydrate: async () => {
    set({ isHydrating: true, error: null });
    try {
      const [recentRuns, activeRun] = await Promise.all([
        tauriApi.listDedupeRuns(50),
        tauriApi.getActiveDedupeRun()
      ]);
      set({
        recentRuns,
        activeRun,
        isHydrating: false
      });
      await get().ensureListeners();
    } catch (error) {
      set({ isHydrating: false, error: error instanceof Error ? error.message : String(error) });
    }
  },

  start: async (request) => {
    const run = await tauriApi.startDedupeRun(request ?? {
      scope: { kind: "allManagedFileLibrary" },
      requestKey: null,
      parentScanSessionId: null
    });
    applyRun(run);
    return run;
  },

  cancel: async (runId) => {
    const run = await tauriApi.cancelDedupeRun(runId);
    applyRun(run);
    return run;
  },

  retry: async (runId) => {
    const run = await tauriApi.retryDedupeRun(runId);
    applyRun(run);
    return run;
  },

  loadGroups: async (reset = false) => {
    if (get().isLoadingGroups || (!reset && !get().groupsHasMore)) return;
    set({ isLoadingGroups: true, error: null });
    try {
      const page: DedupeGroupPage = await tauriApi.listDuplicateGroups(
        reset ? null : get().groupsCursor,
        30
      );
      set((state) => ({
        groups: reset ? page.groups : [...state.groups, ...page.groups],
        groupsCursor: page.nextCursor,
        groupsHasMore: Boolean(page.nextCursor),
        isLoadingGroups: false
      }));
    } catch (error) {
      set({ isLoadingGroups: false, error: error instanceof Error ? error.message : String(error) });
    }
  },

  clearError: () => set({ error: null })
}));
