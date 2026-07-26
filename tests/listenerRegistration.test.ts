import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOperationQueueStore } from "../src/store/useOperationQueueStore";
import { useFileLibraryStore } from "../src/store/useFileLibraryStore";
import { useScanManagerStore } from "../src/store/useScanManagerStore";

const apiMocks = vi.hoisted(() => ({
  getOperationLogs: vi.fn(),
  listScanRuns: vi.fn(),
  onOperationProgress: vi.fn(),
  onManagedScanEvent: vi.fn(),
  onScanProgress: vi.fn(),
  onScanBatch: vi.fn(),
  onScanComplete: vi.fn(),
  onScanCanceled: vi.fn(),
  onScanError: vi.fn(),
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
    onOperationProgress: apiMocks.onOperationProgress,
    onManagedScanEvent: apiMocks.onManagedScanEvent,
    onScanProgress: apiMocks.onScanProgress,
    onScanBatch: apiMocks.onScanBatch,
    onScanComplete: apiMocks.onScanComplete,
    onScanCanceled: apiMocks.onScanCanceled,
    onScanError: apiMocks.onScanError,
    onDedupeProgress: apiMocks.onDedupeProgress,
    onDedupeComplete: apiMocks.onDedupeComplete
  }
}));

describe("listener registration guards", () => {
  beforeEach(() => {
    apiMocks.getOperationLogs.mockReset().mockResolvedValue([]);
    apiMocks.listScanRuns.mockReset().mockResolvedValue([]);
    apiMocks.onOperationProgress.mockReset().mockResolvedValue(() => {});
    apiMocks.onManagedScanEvent.mockReset().mockResolvedValue(() => {});
    apiMocks.onScanProgress.mockReset().mockResolvedValue(() => {});
    apiMocks.onScanBatch.mockReset().mockResolvedValue(() => {});
    apiMocks.onScanComplete.mockReset().mockResolvedValue(() => {});
    apiMocks.onScanCanceled.mockReset().mockResolvedValue(() => {});
    apiMocks.onScanError.mockReset().mockResolvedValue(() => {});
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
  });

  it("allows scan listener registration to retry after an initial failure", async () => {
    apiMocks.onScanProgress
      .mockRejectedValueOnce(new Error("scan listener failed"))
      .mockResolvedValueOnce(() => {});

    await useScanManagerStore.getState().initializeScanListeners();

    expect(useScanManagerStore.getState().listenersRegistered).toBe(false);
    expect(useScanManagerStore.getState().registrationPromise).toBeNull();

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
    expect(apiMocks.onScanBatch).toHaveBeenCalledTimes(1);
    expect(apiMocks.onScanComplete).toHaveBeenCalledTimes(1);
    expect(apiMocks.onScanCanceled).toHaveBeenCalledTimes(1);
    expect(apiMocks.onScanError).toHaveBeenCalledTimes(1);
    expect(apiMocks.onDedupeProgress).toHaveBeenCalledTimes(1);
    expect(apiMocks.onDedupeComplete).toHaveBeenCalledTimes(1);

    pendingScanProgress.resolve(() => {});
    await Promise.all([first, second]);

    expect(useScanManagerStore.getState().listenersRegistered).toBe(true);
  });

  it("hydrates the latest durable active run before registering renderer events", async () => {
    apiMocks.listScanRuns.mockResolvedValueOnce([{
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
    }]);

    await useScanManagerStore.getState().initializeScanListeners();

    expect(useScanManagerStore.getState().activeScanSessionId).toBe("restart-session");
    expect(useScanManagerStore.getState().activeScanRunId).toBe("restart-run");
    expect(useScanManagerStore.getState().lastSessionRevision).toBe(12);
    expect(apiMocks.listScanRuns.mock.invocationCallOrder[0])
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

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}
