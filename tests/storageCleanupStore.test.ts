import { describe, expect, it, vi, beforeEach } from "vitest";
import type { StorageAnalysis } from "../src/types/domain";
import {
  canAutoSelectForCleanup,
  canManuallySelectForCleanup,
  cleanupSelectionDisabledReason,
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
    expect(remountedState.activeJobId).toBe("job-1");
    expect(remountedState.displayedJobId).toBeNull();
    expect(remountedState.scanProgress?.scannedEntries).toBe(12);
    expect(remountedState.scanProgress?.currentPath).toBe("F:/scope/file.tmp");
  });

  it("stores completed analysis, default safe selections, and execution result", () => {
    useStorageCleanupStore.setState({ activeJobId: "job-1" });
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
    expect(state.activeJobId).toBeNull();
    expect(state.displayedJobId).toBe("job-1");
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
    useStorageCleanupStore.setState({ isScanning: true, activeJobId: "job-1" });

    await useStorageCleanupStore.getState().cancelScan(api);

    expect(api.cancelStorageCleanupScan).toHaveBeenCalledWith("job-1");
    expect(useStorageCleanupStore.getState().isScanning).toBe(true);
    expect(useStorageCleanupStore.getState().scanStatus).toBe("cancel_requested");
    expect(useStorageCleanupStore.getState().activeJobId).toBe("job-1");
  });

  it("only enters cancelled after the backend confirms the terminal state", async () => {
    const api = {
      startStorageCleanupScan: vi.fn(),
      cancelStorageCleanupScan: vi.fn().mockResolvedValue(undefined),
      getStorageCleanupScanStatus: vi.fn().mockResolvedValue({
        jobId: "job-1",
        status: "cancelled" as const,
        progress: null,
        analysis: null,
        error: null,
        startedAt: "1",
        completedAt: "2"
      })
    };
    useStorageCleanupStore.setState({ isScanning: true, activeJobId: "job-1", scanStatus: "running" });

    await useStorageCleanupStore.getState().cancelScan(api);
    await Promise.resolve();

    expect(api.getStorageCleanupScanStatus).toHaveBeenCalledWith("job-1");
    expect(useStorageCleanupStore.getState().isScanning).toBe(false);
    expect(useStorageCleanupStore.getState().scanStatus).toBe("cancelled");
    expect(useStorageCleanupStore.getState().activeJobId).toBeNull();
  });

  it("restores running state when the cancel request fails", async () => {
    const api = {
      startStorageCleanupScan: vi.fn(),
      cancelStorageCleanupScan: vi.fn().mockRejectedValue(new Error("offline")),
      getStorageCleanupScanStatus: vi.fn()
    };
    useStorageCleanupStore.setState({ isScanning: true, activeJobId: "job-1", scanStatus: "running" });

    await useStorageCleanupStore.getState().cancelScan(api);

    expect(useStorageCleanupStore.getState().isScanning).toBe(true);
    expect(useStorageCleanupStore.getState().scanStatus).toBe("running");
    expect(useStorageCleanupStore.getState().cancelRequestedJobId).toBeNull();
    expect(useStorageCleanupStore.getState().scanError).toContain("cleanup_cancel_failed");
  });

  it("keeps the active job running when cancellation never reaches a terminal state", async () => {
    vi.useFakeTimers();
    try {
      const api = {
        startStorageCleanupScan: vi.fn(),
        cancelStorageCleanupScan: vi.fn().mockResolvedValue(undefined),
        getStorageCleanupScanStatus: vi.fn().mockResolvedValue({
          jobId: "job-1",
          status: "running" as const,
          progress: null,
          analysis: null,
          error: null,
          startedAt: "1",
          completedAt: null
        })
      };
      useStorageCleanupStore.setState({ isScanning: true, activeJobId: "job-1", scanStatus: "running" });

      await useStorageCleanupStore.getState().cancelScan(api);
      await vi.advanceTimersByTimeAsync(10_500);

      const state = useStorageCleanupStore.getState();
      expect(state.isScanning).toBe(true);
      expect(state.activeJobId).toBe("job-1");
      expect(state.scanStatus).toBe("running");
      expect(state.cancelRequestedJobId).toBeNull();
      expect(state.scanError).toBe("cleanup_cancel_waiting");
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores progress and terminal events from an old job after a new job is active", () => {
    useStorageCleanupStore.setState({
      isScanning: true,
      activeJobId: "job-new",
      scanStatus: "running"
    });

    useStorageCleanupStore.getState().applyScanProgress({
      jobId: "job-old",
      scannedEntries: 99,
      currentPath: "F:/old/file.tmp",
      totalSize: 999
    });
    useStorageCleanupStore.getState().completeScan("job-old", analysis);
    useStorageCleanupStore.getState().confirmCancelled("job-old", "cleanup_cancelled");

    const state = useStorageCleanupStore.getState();
    expect(state.isScanning).toBe(true);
    expect(state.activeJobId).toBe("job-new");
    expect(state.scanStatus).toBe("running");
    expect(state.scanProgress).toBeNull();
  });

  it("reconciles a job that completes before the start call returns", async () => {
    const api = {
      startStorageCleanupScan: vi.fn().mockResolvedValue("job-fast"),
      cancelStorageCleanupScan: vi.fn().mockResolvedValue(undefined),
      getStorageCleanupScanStatus: vi.fn().mockResolvedValue({
        jobId: "job-fast",
        status: "completed" as const,
        progress: {
          jobId: "job-fast",
          scannedEntries: 1,
          currentPath: null,
          totalSize: 100
        },
        analysis,
        error: null,
        startedAt: "1",
        completedAt: "2"
      })
    };
    useStorageCleanupStore.getState().setSelectedRoots(["F:/scope"]);

    await useStorageCleanupStore.getState().startScan(api);

    const state = useStorageCleanupStore.getState();
    expect(api.getStorageCleanupScanStatus).toHaveBeenCalledWith("job-fast");
    expect(state.activeJobId).toBeNull();
    expect(state.displayedJobId).toBe("job-fast");
    expect(state.analysis?.candidates[0].id).toBe("safe-cache");
  });

  it("switching displayed jobs clears selection and old candidate pages", () => {
    useStorageCleanupStore.setState({ activeJobId: "job-a" });
    useStorageCleanupStore.getState().completeScan("job-a", analysis);
    expect(useStorageCleanupStore.getState().selectedCleanupIds.size).toBe(1);

    useStorageCleanupStore.getState().beginDisplayingJob("job-b");

    const state = useStorageCleanupStore.getState();
    expect(state.displayedJobId).toBe("job-b");
    expect(state.analysis).toBeNull();
    expect([...state.selectedCleanupIds]).toEqual([]);
    expect([...state.aiAnalyzedCandidateIds]).toEqual([]);
    expect(state.executionResult).toBeNull();
  });

  it("loads the first page when switching to a retained job", async () => {
    const firstPage = deferred<StorageAnalysis>();
    const api = cleanupPagingApi(() => firstPage.promise);
    useStorageCleanupStore.setState({ activeJobId: "job-a" });
    useStorageCleanupStore.getState().completeScan("job-a", analysis);

    const switching = useStorageCleanupStore.getState().displayJob(api, "job-b");
    expect(useStorageCleanupStore.getState().displayedJobId).toBe("job-b");
    expect(useStorageCleanupStore.getState().analysis).toBeNull();
    expect(useStorageCleanupStore.getState().selectedCleanupIds.size).toBe(0);

    firstPage.resolve(pageWithCandidate("job-b-first"));
    await switching;

    const state = useStorageCleanupStore.getState();
    expect(api.getStorageCleanupCandidatePage).toHaveBeenCalledWith("job-b", 0, 200);
    expect(state.analysis?.candidates[0].id).toBe("job-b-first");
    expect(state.selectedCleanupIds.has("job-b-first")).toBe(true);
  });

  it("does not allow an old job page response to overwrite the displayed job", async () => {
    const oldPage = deferred<StorageAnalysis>();
    const api = cleanupPagingApi(() => oldPage.promise);
    useStorageCleanupStore.setState({
      displayedJobId: "job-a",
      analysis: { ...analysis, has_more: true }
    });

    const pending = useStorageCleanupStore.getState().loadMoreCandidates(api);
    useStorageCleanupStore.getState().beginDisplayingJob("job-b");
    oldPage.resolve(pageWithCandidate("old-page"));
    await pending;

    const state = useStorageCleanupStore.getState();
    expect(state.displayedJobId).toBe("job-b");
    expect(state.analysis).toBeNull();
  });

  it("ignores an out-of-order page response for the same job", async () => {
    const first = deferred<StorageAnalysis>();
    const second = deferred<StorageAnalysis>();
    const api = cleanupPagingApi(vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise));
    useStorageCleanupStore.setState({
      displayedJobId: "job-a",
      analysis: { ...analysis, has_more: true }
    });

    const firstPending = useStorageCleanupStore.getState().loadMoreCandidates(api);
    const secondPending = useStorageCleanupStore.getState().loadMoreCandidates(api);
    second.resolve(pageWithCandidate("second-page"));
    await secondPending;
    first.resolve(pageWithCandidate("first-page"));
    await firstPending;

    const ids = useStorageCleanupStore.getState().analysis?.candidates.map((candidate) => candidate.id);
    expect(ids).toEqual(["safe-cache", "second-page"]);
  });

  it("ignores AI candidate updates from a previously displayed job", () => {
    useStorageCleanupStore.setState({ displayedJobId: "job-b", analysis });
    const stale = [{ ...analysis.candidates[0], reason: "stale AI result" }];

    useStorageCleanupStore.getState().applyAIAnalyzedCandidates("job-a", stale);

    expect(useStorageCleanupStore.getState().analysis?.candidates[0].reason).toBe("Regenerable");
  });

  it("separates default safe cleanup selection from manual review selection", () => {
    const safe = analysis.candidates[0];
    const review = {
      ...safe,
      id: "review-cache",
      tier: "Review" as const,
      selected_by_default: false
    };
    const caution = {
      ...safe,
      id: "caution-cache",
      tier: "Caution" as const,
      selected_by_default: false
    };
    const blocked = {
      ...safe,
      id: "blocked-cache",
      trash_allowed: false,
      selected_by_default: false
    };

    expect(canAutoSelectForCleanup(safe)).toBe(true);
    expect(canAutoSelectForCleanup(review)).toBe(false);
    expect(canManuallySelectForCleanup(review)).toBe(true);
    expect(canManuallySelectForCleanup(caution)).toBe(false);
    expect(canManuallySelectForCleanup(blocked)).toBe(false);
    expect(cleanupSelectionDisabledReason(caution)).toContain("谨慎处理项不能直接清理");
    expect(cleanupSelectionDisabledReason(blocked)).toContain("不允许移动到 Safe Trash");
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function cleanupPagingApi(getPage: (jobId: string, offset: number, limit?: number) => Promise<StorageAnalysis>) {
  return {
    startStorageCleanupScan: vi.fn(),
    cancelStorageCleanupScan: vi.fn(),
    getStorageCleanupScanStatus: vi.fn(),
    getStorageCleanupCandidatePage: vi.fn(getPage)
  };
}

function pageWithCandidate(id: string): StorageAnalysis {
  return {
    ...analysis,
    candidates: [{ ...analysis.candidates[0], id }],
    candidate_offset: 1,
    candidate_total: 2,
    candidate_limit: 200,
    has_more: false
  };
}
