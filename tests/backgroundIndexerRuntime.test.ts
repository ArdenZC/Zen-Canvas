import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  createScanJobId: vi.fn(),
  startScan: vi.fn(),
  cancelScan: vi.fn(),
  refresh: vi.fn(),
  showError: vi.fn(),
  isScanning: false
}));

vi.mock("../src/api/tauriApi", () => ({
  tauriApi: {
    createScanJobId: runtimeMocks.createScanJobId,
    startScan: runtimeMocks.startScan,
    cancelScan: runtimeMocks.cancelScan
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
  beforeEach(() => {
    runtimeMocks.createScanJobId.mockReset().mockResolvedValue("background-job-1");
    runtimeMocks.startScan.mockReset();
    runtimeMocks.cancelScan.mockReset().mockResolvedValue(undefined);
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
    const cancel = deferred<void>();
    runtimeMocks.startScan.mockReturnValue(start.promise);
    runtimeMocks.cancelScan.mockReturnValue(cancel.promise);

    useBackgroundIndexerStore.getState().enqueueRoot("F:/hardening");
    await flushPromises();
    expect(useBackgroundIndexerStore.getState().isBackgroundIndexing).toBe(true);
    expect(runtimeMocks.startScan).toHaveBeenCalledWith(
      "F:/hardening",
      false,
      "background-job-1",
      "background",
      true
    );

    const cancelling = useBackgroundIndexerStore.getState().cancelBackgroundIndexing();
    expect(useBackgroundIndexerStore.getState().isBackgroundIndexing).toBe(true);
    cancel.resolve();
    await cancelling;

    start.resolve();
    await flushPromises();

    expect(useBackgroundIndexerStore.getState().completedRoots).toEqual([]);
    expect(runtimeMocks.refresh).not.toHaveBeenCalled();
    expect(useBackgroundIndexerStore.getState().currentRoot).toBeNull();
  });

  it("keeps the active job truthful when cancellation RPC fails", async () => {
    const start = deferred<void>();
    runtimeMocks.startScan.mockReturnValue(start.promise);
    runtimeMocks.cancelScan.mockRejectedValue(new Error("cancel unavailable"));

    useBackgroundIndexerStore.getState().enqueueRoot("F:/hardening");
    await flushPromises();
    await useBackgroundIndexerStore.getState().cancelBackgroundIndexing();

    expect(useBackgroundIndexerStore.getState().isBackgroundIndexing).toBe(true);
    expect(useBackgroundIndexerStore.getState().currentRoot).toBe("F:/hardening");
    expect(runtimeMocks.showError).toHaveBeenCalledWith(expect.stringContaining("cancel"));

    start.resolve();
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

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
