import { create } from "zustand";
import type { ScanRootDto, WatcherReconciliationStatus } from "../api/tauriApi";

export type WatcherRootStatus = WatcherReconciliationStatus;

interface WatcherStatusStore {
  roots: Record<string, WatcherRootStatus>;
  hydrate: (roots: ScanRootDto[]) => void;
  upsert: (status: WatcherRootStatus) => void;
  reset: () => void;
}

function statusFromRoot(root: ScanRootDto): WatcherRootStatus {
  return {
    scanRootId: root.id,
    path: root.normalizedPath,
    rootRevision: root.revision,
    watcherRevision: root.watcherRevision,
    watcherAppliedRevision: root.watcherAppliedRevision,
    pending: root.needsReconciliation || root.watcherRevision > root.watcherAppliedRevision,
    needsReconciliation: root.needsReconciliation,
    healthStatus: root.healthStatus,
    activeRunId: root.activeRunId,
    lastEventAt: root.watcherLastEventAt,
    lastAppliedAt: root.watcherLastAppliedAt,
    lastErrorCode: root.watcherLastErrorCode ?? root.lastErrorCode,
    lastErrorMessage: root.watcherLastErrorMessage ?? root.lastErrorMessage,
    pendingBatch: Math.max(0, root.watcherRevision - root.watcherAppliedRevision),
    timestamp: Date.now()
  };
}

function shouldReplace(previous: WatcherRootStatus | undefined, next: WatcherRootStatus) {
  return !previous || next.rootRevision > previous.rootRevision;
}

export const useWatcherStatusStore = create<WatcherStatusStore>((set) => ({
  roots: {},
  hydrate: (roots) => set((state) => {
    const next = { ...state.roots };
    for (const root of roots) {
      const status = statusFromRoot(root);
      if (shouldReplace(next[root.id], status)) next[root.id] = status;
    }
    return { roots: next };
  }),
  upsert: (status) => set((state) => {
    if (!shouldReplace(state.roots[status.scanRootId], status)) return state;
    return { roots: { ...state.roots, [status.scanRootId]: status } };
  }),
  reset: () => set({ roots: {} })
}));
