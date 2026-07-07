import { describe, expect, it, vi, beforeEach } from "vitest";
import type { StorageAnalysis } from "../src/types/domain";
import {
  resetStorageCleanupStoreForTest,
  useStorageCleanupStore
} from "../src/store/useStorageCleanupStore";

const analysis: StorageAnalysis = {
  total_size: 100,
  reclaimable_estimate: 60,
  review_estimate: 40,
  denied_paths: [],
  warnings: [],
  candidates: [
    {
      id: "safe-cache",
      path: "F:/scope/node_modules",
      name: "node_modules",
      size: 60,
      tier: "Safe",
      category: "Developer cache",
      reason: "Regenerable",
      suggested_action: "MoveToTrash",
      risk_note: null,
      trash_allowed: true,
      selected_by_default: true
    }
  ]
};

describe("useStorageCleanupStore", () => {
  beforeEach(() => {
    resetStorageCleanupStoreForTest();
  });

  it("keeps scan state outside the page lifecycle", async () => {
    const api = {
      startStorageCleanupScan: vi.fn().mockResolvedValue("job-1"),
      cancelStorageCleanupScan: vi.fn().mockResolvedValue(undefined),
      getStorageCleanupScanStatus: vi.fn()
    };

    useStorageCleanupStore.getState().setSelectedRoots(["F:/scope"]);
    await useStorageCleanupStore.getState().startScan(api);
    useStorageCleanupStore.getState().applyScanProgress({
      jobId: "job-1",
      scannedEntries: 12,
      currentPath: "F:/scope/file.tmp",
      totalSize: 4096
    });

    const remountedState = useStorageCleanupStore.getState();
    expect(remountedState.selectedRoots).toEqual(["F:/scope"]);
    expect(remountedState.isScanning).toBe(true);
    expect(remountedState.scanJobId).toBe("job-1");
    expect(remountedState.scanProgress?.scannedEntries).toBe(12);
    expect(remountedState.scanProgress?.currentPath).toBe("F:/scope/file.tmp");
  });

  it("stores completed analysis, default safe selections, and execution result", () => {
    useStorageCleanupStore.getState().completeScan("job-1", analysis);
    useStorageCleanupStore.getState().setExecutionResult({
      moved: 1,
      skipped: 0,
      failed: 0,
      logs: [
        {
          path: "F:/scope/node_modules",
          name: "node_modules",
          size: 60,
          status: "success",
          message: "Moved to Zen Canvas Safe Trash"
        }
      ]
    });

    const state = useStorageCleanupStore.getState();
    expect(state.analysis?.total_size).toBe(100);
    expect(state.selectedCleanupIds.has("safe-cache")).toBe(true);
    expect(state.executionResult?.moved).toBe(1);
    expect(state.lastCompletedAt).toBeTruthy();
  });

  it("cancels the active scan job through the API", async () => {
    const api = {
      startStorageCleanupScan: vi.fn(),
      cancelStorageCleanupScan: vi.fn().mockResolvedValue(undefined),
      getStorageCleanupScanStatus: vi.fn()
    };
    useStorageCleanupStore.setState({ isScanning: true, scanJobId: "job-1" });

    await useStorageCleanupStore.getState().cancelScan(api);

    expect(api.cancelStorageCleanupScan).toHaveBeenCalledWith("job-1");
    expect(useStorageCleanupStore.getState().isScanning).toBe(false);
    expect(useStorageCleanupStore.getState().scanError).toContain("取消");
  });
});
