import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  startManagedScan: vi.fn(),
  cancelScanRun: vi.fn(),
  refresh: vi.fn(),
  showError: vi.fn(),
  isScanning: false
}));

vi.mock("../src/api/tauriApi", () => ({
  tauriApi: {
    startManagedScan: runtimeMocks.startManagedScan,
    cancelScanRun: runtimeMocks.cancelScanRun
  }
}));

vi.mock("../src/store/useAppStore", () => ({
  useAppStore: { getState: () => ({ searchQuery: "", showError: runtimeMocks.showError }) }
}));

vi.mock("../src/store/useFileLibraryStore", () => ({
  useFileLibraryStore: { getState: () => ({ refresh: runtimeMocks.refresh }) }
}));

vi.mock("../src/store/useScanManagerStore", () => ({
  useScanManagerStore: { getState: () => ({ isScanning: runtimeMocks.isScanning }) }
}));

import { useBackgroundIndexerStore } from "../src/store/useBackgroundIndexerStore";

describe("background indexer lifecycle", () => {
  beforeEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    runtimeMocks.startManagedScan.mockReset();
    runtimeMocks.cancelScanRun.mockReset().mockResolvedValue({});
    runtimeMocks.refresh.mockReset().mockResolvedValue(undefined);
    runtimeMocks.showError.mockReset();
    runtimeMocks.isScanning = false;
    useBackgroundIndexerStore.setState({
      pendingRoots: [],
      currentRoot: null,
      isBackgroundIndexing: false,
      failedRoots: [],
      completedRoots: []
    });
  });

  it("ignores a stale scan completion after cancellation", async () => {
    const start = deferred<void>();
    runtimeMocks.startManagedScan.mockReturnValue(start.promise);

    useBackgroundIndexerStore.getState().enqueueRoot("F:/hardening");
    await flushPromises();
    expect(useBackgroundIndexerStore.getState().isBackgroundIndexing).toBe(true);

    const cancelling = useBackgroundIndexerStore.getState().cancelBackgroundIndexing();
    await cancelling;
    expect(useBackgroundIndexerStore.getState().isBackgroundIndexing).toBe(false);

    start.resolve();
    await flushPromises();

    expect(useBackgroundIndexerStore.getState().completedRoots).toEqual([]);
    expect(runtimeMocks.refresh).not.toHaveBeenCalled();
    expect(useBackgroundIndexerStore.getState().currentRoot).toBeNull();
  });

  it("keeps the active job truthful when cancellation RPC fails", async () => {
    runtimeMocks.startManagedScan
      .mockResolvedValueOnce(managedStart("running"))
      .mockResolvedValue(managedStart("completed"));
    runtimeMocks.cancelScanRun.mockRejectedValue(new Error("cancel unavailable"));

    useBackgroundIndexerStore.getState().enqueueRoot("F:/hardening");
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 60));
    await useBackgroundIndexerStore.getState().cancelBackgroundIndexing();

    expect(useBackgroundIndexerStore.getState().isBackgroundIndexing).toBe(true);
    expect(useBackgroundIndexerStore.getState().currentRoot).toBe("F:/hardening");
    expect(runtimeMocks.showError).toHaveBeenCalledWith(expect.stringContaining("cancel"));

    await new Promise((resolve) => setTimeout(resolve, 300));
    await flushPromises();

    expect(useBackgroundIndexerStore.getState().completedRoots).toEqual(["F:/hardening"]);
    expect(runtimeMocks.refresh).toHaveBeenCalledTimes(1);
  });
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function managedStart(status: "running" | "completed") {
  const terminal = status === "completed";
  const run = {
    id: "background-job-1",
    scanRootId: "background-root-1",
    rootPath: "F:/hardening",
    generation: 1,
    parentSessionId: "background-session-1",
    status,
    phase: terminal ? "completed" : "discovering",
    scannedFiles: terminal ? 2 : 0,
    scannedDirectories: terminal ? 1 : 0,
    processedBytes: terminal ? 2 : 0,
    warningsCount: 0,
    errorsCount: 0,
    metadataErrorCount: 0,
    coverageErrorCount: 0,
    coverageComplete: terminal,
    staleReconciliationAllowed: false,
    cancelRequested: false,
    revision: terminal ? 4 : 1,
    sessionRevision: terminal ? 4 : 1,
    startedAt: 1,
    finishedAt: terminal ? 2 : null,
    lastCheckpointAt: 1,
    errorCode: null,
    errorMessage: null,
    resultJson: null,
    createdAt: 1,
    updatedAt: 1
  };
  return {
    session: {
      id: "background-session-1",
      requestKey: "background-request-1",
      canonicalRequestHash: "hash",
      status,
      phase: terminal ? "completed" : "running",
      cancelRequested: false,
      requestedRootCount: 1,
      effectiveRootCount: 1,
      completedRootCount: terminal ? 1 : 0,
      failedRootCount: 0,
      cancelledRootCount: 0,
      coveredRootCount: 0,
      unstartedRootCount: terminal ? 0 : 1,
      dedupeRequested: true,
      dedupeDispatchState: terminal ? "pending" : "not_requested",
      dedupeAttemptCount: 0,
      dedupeJobId: null,
      dedupeLastError: null,
      scannedFiles: run.scannedFiles,
      scannedDirectories: run.scannedDirectories,
      warningsCount: 0,
      errorsCount: 0,
      revision: terminal ? 4 : 1,
      startedAt: 1,
      finishedAt: terminal ? 2 : null,
      lastCheckpointAt: 1,
      errorCode: null,
      errorMessage: null,
      resultJson: null,
      createdAt: 1,
      updatedAt: 1,
      roots: [{
        sessionId: "background-session-1",
        requestedIndex: 0,
        requestedPath: "F:/hardening",
        normalizedRequestedPath: "F:/hardening",
        resolution: "effective",
        effectiveRootId: "background-root-1",
        effectivePath: "F:/hardening",
        effectiveIndex: 0,
        runId: "background-job-1",
        status,
        reason: null,
        createdAt: 1,
        updatedAt: 1
      }]
    },
    runs: [run]
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
