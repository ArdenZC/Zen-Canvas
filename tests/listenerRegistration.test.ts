import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOperationQueueStore } from "../src/store/useOperationQueueStore";
import { useFileLibraryStore } from "../src/store/useFileLibraryStore";
import { useDedupeStore } from "../src/store/useDedupeStore";
import { useScanManagerStore } from "../src/store/useScanManagerStore";
import { registerListenerGroup } from "../src/utils/registerListenerGroup";

const apiMocks = vi.hoisted(() => ({
  getOperationLogs: vi.fn(),
  listScanRuns: vi.fn(),
  getManagedScanSnapshot: vi.fn(),
  onOperationProgress: vi.fn(),
  onManagedScanEvent: vi.fn(),
  onScanProgress: vi.fn(),
  onScanBatch: vi.fn(),
  onScanComplete: vi.fn(),
  onScanCanceled: vi.fn(),
  onScanError: vi.fn(),
  onDedupeRunUpdated: vi.fn(),
  onDedupeProgress: vi.fn(),
  onDedupeComplete: vi.fn(),
  dialogOpen: vi.fn()
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: apiMocks.dialogOpen
}));

vi.mock("../src/api/tauriApi", () => ({
  tauriApi: {
    getOperationLogs: apiMocks.getOperationLogs,
    listScanRuns: apiMocks.listScanRuns,
    getManagedScanSnapshot: apiMocks.getManagedScanSnapshot,
    onOperationProgress: apiMocks.onOperationProgress,
    onManagedScanEvent: apiMocks.onManagedScanEvent,
    onScanProgress: apiMocks.onScanProgress,
    onScanBatch: apiMocks.onScanBatch,
    onScanComplete: apiMocks.onScanComplete,
    onScanCanceled: apiMocks.onScanCanceled,
    onScanError: apiMocks.onScanError,
    onDedupeRunUpdated: apiMocks.onDedupeRunUpdated,
    onDedupeProgress: apiMocks.onDedupeProgress,
    onDedupeComplete: apiMocks.onDedupeComplete
  }
}));

describe("listener registration guards", () => {
  beforeEach(() => {
    apiMocks.getOperationLogs.mockReset().mockResolvedValue([]);
    apiMocks.listScanRuns.mockReset().mockResolvedValue([]);
    apiMocks.getManagedScanSnapshot.mockReset().mockResolvedValue({
      session: {
        id: "empty-session",
        requestKey: null,
        canonicalRequestHash: null,
        status: "completed",
        phase: "completed",
        cancelRequested: false,
        requestedRootCount: 0,
        effectiveRootCount: 0,
        completedRootCount: 0,
        failedRootCount: 0,
        cancelledRootCount: 0,
        coveredRootCount: 0,
        unstartedRootCount: 0,
        dedupeRequested: false,
        dedupeDispatchState: "not_requested",
        dedupeAttemptCount: 0,
        dedupeJobId: null,
        dedupeLastError: null,
        scannedFiles: 0,
        scannedDirectories: 0,
        warningsCount: 0,
        errorsCount: 0,
        revision: 1,
        startedAt: null,
        finishedAt: 1,
        lastCheckpointAt: 1,
        errorCode: null,
        errorMessage: null,
        resultJson: null,
        createdAt: 1,
        updatedAt: 1,
        roots: []
      },
      runs: []
    });
    apiMocks.onOperationProgress.mockReset().mockResolvedValue(() => {});
    apiMocks.onManagedScanEvent.mockReset().mockResolvedValue(() => {});
    apiMocks.onScanProgress.mockReset().mockResolvedValue(() => {});
    apiMocks.onScanBatch.mockReset().mockResolvedValue(() => {});
    apiMocks.onScanComplete.mockReset().mockResolvedValue(() => {});
    apiMocks.onScanCanceled.mockReset().mockResolvedValue(() => {});
    apiMocks.onScanError.mockReset().mockResolvedValue(() => {});
    apiMocks.onDedupeRunUpdated.mockReset().mockResolvedValue(() => {});
    apiMocks.onDedupeProgress.mockReset().mockResolvedValue(() => {});
    apiMocks.onDedupeComplete.mockReset().mockResolvedValue(() => {});

    useOperationQueueStore.setState({
      listenersRegistered: false,
      registrationPromise: null,
      unlistener: undefined,
      operationLogs: []
    });
    useScanManagerStore.setState({
      listenersRegistered: false,
      registrationPromise: null,
      unlisteners: [],
      activeScanSessionId: null,
      activeScanRunId: null,
      scanSession: null,
      scanRuns: [],
      lastRunRevision: 0,
      lastSessionRevision: 0,
      seenManagedEventIds: [],
      scanState: {
        status: "idle",
        progress: null,
        entries: [],
        error: null
      }
    });
    useFileLibraryStore.setState({ scope: { kind: "all" } });
    useDedupeStore.setState({ listenersRegistered: false });
  });

  it("allows scan listener registration to retry after an initial failure", async () => {
    const firstCleanup = vi.fn();
    apiMocks.onManagedScanEvent.mockResolvedValueOnce(firstCleanup);
    apiMocks.onScanProgress
      .mockRejectedValueOnce(new Error("scan listener failed"))
      .mockResolvedValueOnce(() => {});

    await useScanManagerStore.getState().initializeScanListeners();

    expect(useScanManagerStore.getState().listenersRegistered).toBe(false);
    expect(useScanManagerStore.getState().registrationPromise).toBeNull();
    expect(firstCleanup).toHaveBeenCalledOnce();

    await useScanManagerStore.getState().initializeScanListeners();

    expect(apiMocks.onScanProgress).toHaveBeenCalledTimes(2);
    expect(useScanManagerStore.getState().listenersRegistered).toBe(true);
    expect(useScanManagerStore.getState().registrationPromise).toBeNull();
  });

  it("deduplicates concurrent scan listener registration calls", async () => {
    const pendingScanProgress = deferred<() => void>();
    apiMocks.onScanProgress.mockReturnValueOnce(pendingScanProgress.promise);

    const first = useScanManagerStore.getState().initializeScanListeners();
    const second = useScanManagerStore.getState().initializeScanListeners();

    expect(second).toBe(first);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(apiMocks.onManagedScanEvent).toHaveBeenCalledTimes(1);
    expect(apiMocks.onScanProgress).toHaveBeenCalledTimes(1);
    expect(apiMocks.onScanBatch).not.toHaveBeenCalled();

    pendingScanProgress.resolve(() => {});
    await Promise.all([first, second]);

    expect(apiMocks.onScanBatch).toHaveBeenCalledTimes(1);
    expect(apiMocks.onScanComplete).toHaveBeenCalledTimes(1);
    expect(apiMocks.onScanCanceled).toHaveBeenCalledTimes(1);
    expect(apiMocks.onScanError).toHaveBeenCalledTimes(1);
    expect(apiMocks.onDedupeProgress).toHaveBeenCalledTimes(1);
    expect(apiMocks.onDedupeComplete).toHaveBeenCalledTimes(1);
    expect(useScanManagerStore.getState().listenersRegistered).toBe(true);
  });

  it("waits for the previous dedupe listener group to clean up before reinitializing", async () => {
    let resolveCleanup!: () => void;
    const cleanupFinished = new Promise<void>((resolve) => {
      resolveCleanup = resolve;
    });
    apiMocks.onDedupeRunUpdated.mockResolvedValueOnce(async () => cleanupFinished);

    await useDedupeStore.getState().ensureListeners();
    useDedupeStore.setState({ listenersRegistered: false });
    const reinitialize = useDedupeStore.getState().ensureListeners();

    await Promise.resolve();
    await Promise.resolve();
    expect(apiMocks.onDedupeRunUpdated).toHaveBeenCalledOnce();

    resolveCleanup();
    await reinitialize;
    expect(apiMocks.onDedupeRunUpdated).toHaveBeenCalledTimes(2);
    expect(useDedupeStore.getState().listenersRegistered).toBe(true);
  });

  it("hydrates the latest durable active run before registering renderer events", async () => {
    const restartRun = {
      id: "restart-run",
      scanRootId: "restart-root",
      rootPath: "F:/Restart",
      generation: 4,
      parentSessionId: "restart-session",
      status: "running",
      phase: "discovering",
      scannedFiles: 10,
      scannedDirectories: 1,
      processedBytes: 10,
      warningsCount: 0,
      errorsCount: 0,
      metadataErrorCount: 0,
      coverageErrorCount: 0,
      coverageComplete: false,
      staleReconciliationAllowed: false,
      cancelRequested: false,
      revision: 9,
      sessionRevision: 12,
      startedAt: 1,
      finishedAt: null,
      lastCheckpointAt: 2,
      errorCode: null,
      errorMessage: null,
      resultJson: null,
      createdAt: 1,
      updatedAt: 2
    };
    apiMocks.listScanRuns.mockResolvedValueOnce([restartRun]);
    apiMocks.getManagedScanSnapshot.mockResolvedValueOnce({
      session: {
        id: "restart-session",
        requestKey: "restart-request",
        canonicalRequestHash: "restart-hash",
        status: "running",
        phase: "finalizing",
        cancelRequested: false,
        requestedRootCount: 1,
        effectiveRootCount: 1,
        completedRootCount: 0,
        failedRootCount: 0,
        cancelledRootCount: 0,
        coveredRootCount: 0,
        unstartedRootCount: 0,
        dedupeRequested: false,
        dedupeDispatchState: "not_requested",
        dedupeAttemptCount: 0,
        dedupeJobId: null,
        dedupeLastError: null,
        scannedFiles: 10,
        scannedDirectories: 1,
        warningsCount: 0,
        errorsCount: 0,
        revision: 12,
        startedAt: 1,
        finishedAt: null,
        lastCheckpointAt: 2,
        errorCode: null,
        errorMessage: null,
        resultJson: null,
        createdAt: 1,
        updatedAt: 2,
        roots: [{
          sessionId: "restart-session",
          requestedIndex: 0,
          requestedPath: "F:/Restart",
          normalizedRequestedPath: "F:/Restart",
          resolution: "effective",
          effectiveRootId: "restart-root",
          effectivePath: "F:/Restart",
          effectiveIndex: 0,
          runId: "restart-run",
          status: "running",
          reason: null,
          createdAt: 1,
          updatedAt: 2
        }]
      },
      runs: [restartRun]
    });

    await useScanManagerStore.getState().initializeScanListeners();

    expect(useScanManagerStore.getState().activeScanSessionId).toBe("restart-session");
    expect(useScanManagerStore.getState().activeScanRunId).toBe("restart-run");
    expect(useScanManagerStore.getState().lastSessionRevision).toBe(12);
    expect(useScanManagerStore.getState().scanSession?.roots[0].requestedPath).toBe("F:/Restart");
    expect(apiMocks.getManagedScanSnapshot).toHaveBeenCalledWith("restart-session");
    expect(apiMocks.listScanRuns.mock.invocationCallOrder[0])
      .toBeLessThan(apiMocks.onManagedScanEvent.mock.invocationCallOrder[0]);
    expect(apiMocks.getManagedScanSnapshot.mock.invocationCallOrder[0])
      .toBeLessThan(apiMocks.onManagedScanEvent.mock.invocationCallOrder[0]);
  });

  it("allows operation listener registration to retry after an initial failure", async () => {
    apiMocks.onOperationProgress
      .mockRejectedValueOnce(new Error("operation listener failed"))
      .mockResolvedValueOnce(() => {});

    await useOperationQueueStore.getState().initializeOperationQueue();

    expect(useOperationQueueStore.getState().listenersRegistered).toBe(false);
    expect(useOperationQueueStore.getState().registrationPromise).toBeNull();

    await useOperationQueueStore.getState().initializeOperationQueue();

    expect(apiMocks.onOperationProgress).toHaveBeenCalledTimes(2);
    expect(useOperationQueueStore.getState().listenersRegistered).toBe(true);
    expect(useOperationQueueStore.getState().registrationPromise).toBeNull();
  });

  it("deduplicates concurrent operation listener registration calls", async () => {
    const pendingLogs = deferred<unknown[]>();
    apiMocks.getOperationLogs.mockReturnValueOnce(pendingLogs.promise);

    const first = useOperationQueueStore.getState().initializeOperationQueue();
    const second = useOperationQueueStore.getState().initializeOperationQueue();

    expect(second).toBe(first);
    expect(apiMocks.getOperationLogs).toHaveBeenCalledTimes(1);
    expect(apiMocks.onOperationProgress).not.toHaveBeenCalled();

    pendingLogs.resolve([]);
    await Promise.all([first, second]);

    expect(apiMocks.onOperationProgress).toHaveBeenCalledTimes(1);
    expect(useOperationQueueStore.getState().listenersRegistered).toBe(true);
  });
});

describe("atomic listener group helper", () => {
  it.each([0, 1, 2])("rolls back every completed registration when step %s fails", async (failureIndex) => {
    const cleanups = [vi.fn(), vi.fn(), vi.fn()];
    const registrations = cleanups.map((cleanup, index) => async () => {
      if (index === failureIndex) throw new Error(`listener ${index} failed`);
      return cleanup;
    });

    await expect(registerListenerGroup(registrations)).rejects.toThrow(`listener ${failureIndex} failed`);
    for (let index = 0; index < cleanups.length; index += 1) {
      expect(cleanups[index]).toHaveBeenCalledTimes(index < failureIndex ? 1 : 0);
    }
  });

  it("commits success and makes cleanup idempotent", async () => {
    const cleanups = [vi.fn(), vi.fn(), vi.fn()];
    const cleanup = await registerListenerGroup(cleanups.map((unlisten) => async () => unlisten));

    await Promise.all([cleanup(), cleanup()]);

    expect(cleanups[2]).toHaveBeenCalledOnce();
    expect(cleanups[1]).toHaveBeenCalledOnce();
    expect(cleanups[0]).toHaveBeenCalledOnce();
  });

  it("attempts all reverse cleanups when one cleanup callback throws", async () => {
    const throwingCleanup = vi.fn(() => { throw new Error("cleanup failure"); });
    const survivingCleanup = vi.fn();
    const cleanup = await registerListenerGroup([
      async () => survivingCleanup,
      async () => throwingCleanup
    ]);

    await cleanup();

    expect(throwingCleanup).toHaveBeenCalledOnce();
    expect(survivingCleanup).toHaveBeenCalledOnce();
  });

  it("supports retry after a rejected registration and concurrent StrictMode-style callers", async () => {
    const firstCleanup = vi.fn();
    const failed = registerListenerGroup([
      async () => firstCleanup,
      async () => { throw new Error("first attempt"); }
    ]);
    await expect(failed).rejects.toThrow("first attempt");
    expect(firstCleanup).toHaveBeenCalledOnce();

    let resolveRegistration!: (cleanup: () => void) => void;
    const pending = new Promise<() => void>((resolve) => { resolveRegistration = resolve; });
    const first = registerListenerGroup([async () => pending]);
    const second = first;
    resolveRegistration(vi.fn());
    const cleanup = await Promise.all([first, second]);
    expect(cleanup).toHaveLength(2);
  });
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}
