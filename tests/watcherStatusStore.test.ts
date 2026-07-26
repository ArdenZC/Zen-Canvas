import { afterEach, describe, expect, it } from "vitest";
import { useWatcherStatusStore } from "../src/store/useWatcherStatusStore";
import type { ScanRootDto } from "../src/api/tauriApi";

function root(revision: number, watcherRevision: number, appliedRevision: number): ScanRootDto {
  return {
    id: "db-root-1",
    normalizedPath: "C:/Library",
    displayName: "Library",
    sourceKind: "file_library",
    enabled: true,
    healthStatus: appliedRevision < watcherRevision ? "reconciliation_required" : "healthy",
    currentGeneration: 2,
    activeRunId: null,
    activeGeneration: null,
    revision,
    lastSuccessfulGeneration: 2,
    lastFullScanAt: 10,
    needsReconciliation: appliedRevision < watcherRevision,
    lastErrorCode: null,
    lastErrorMessage: null,
    watcherRevision,
    watcherAppliedRevision: appliedRevision,
    watcherLastEventAt: 9,
    watcherLastAppliedAt: appliedRevision === watcherRevision ? 10 : null,
    watcherLastErrorCode: null,
    watcherLastErrorMessage: null,
    createdAt: 1,
    updatedAt: 10
  };
}

describe("watcher durable status projection", () => {
  afterEach(() => useWatcherStatusStore.getState().reset());

  it("hydrates root status and rejects older event revisions", () => {
    const store = useWatcherStatusStore.getState();
    store.hydrate([root(5, 4, 3)]);
    const hydrated = useWatcherStatusStore.getState().roots["db-root-1"];
    store.upsert({
      ...hydrated,
      rootRevision: 4,
      watcherRevision: 1,
      watcherAppliedRevision: 1,
      pending: false,
      needsReconciliation: false,
      healthStatus: "healthy"
    });

    expect(useWatcherStatusStore.getState().roots["db-root-1"].rootRevision).toBe(5);
    expect(useWatcherStatusStore.getState().roots["db-root-1"].pendingBatch).toBe(1);
  });

  it("accepts a newer durable snapshot and preserves its revision gap", () => {
    const store = useWatcherStatusStore.getState();
    store.hydrate([root(2, 1, 1)]);
    const hydrated = useWatcherStatusStore.getState().roots["db-root-1"];
    store.upsert({
      ...hydrated,
      rootRevision: 3,
      watcherRevision: 4,
      watcherAppliedRevision: 2,
      pending: true,
      needsReconciliation: true,
      healthStatus: "reconciliation_required",
      pendingBatch: 2
    });

    const status = useWatcherStatusStore.getState().roots["db-root-1"];
    expect(status.rootRevision).toBe(3);
    expect(status.watcherRevision - status.watcherAppliedRevision).toBe(2);
    expect(status.pending).toBe(true);
  });
});
