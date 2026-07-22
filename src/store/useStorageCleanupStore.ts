import { create } from "zustand";
import type {
  CleanupExecutionResult,
  CleanupTier,
  StorageAnalysis,
  StorageCandidate,
  StorageCleanupProgress,
  StorageCleanupScanStatus
} from "../types/domain";
import type { Translator } from "../types/ui";

const RECENT_SCOPE_KEY = "zen-canvas.storage-cleanup.recent-roots";
const CLEANUP_CANCEL_POLL_INTERVAL_MS = 250;
const CLEANUP_CANCEL_MAX_WAIT_MS = 10_000;
let cancellationPollGeneration = 0;

type StorageCleanupApi = {
  startStorageCleanupScan(roots: string[]): Promise<string>;
  cancelStorageCleanupScan(jobId: string): Promise<void>;
  getStorageCleanupScanStatus(jobId: string): Promise<StorageCleanupScanStatus>;
  getStorageCleanupCandidatePage?(jobId: string, offset: number, limit?: number): Promise<StorageAnalysis>;
};

interface StorageCleanupStore {
  selectedRoots: string[];
  analysis: StorageAnalysis | null;
  isScanning: boolean;
  scanStatus: StorageCleanupScanStatus["status"] | "idle" | "cancel_requested";
  activeJobId: string | null;
  cancelRequestedJobId: string | null;
  displayedJobId: string | null;
  scanProgress: StorageCleanupProgress | null;
  scanError: string;
  executionResult: CleanupExecutionResult | null;
  selectedCleanupIds: Set<string>;
  aiAnalyzedCandidateIds: Set<string>;
  aiDowngradedCandidateIds: Set<string>;
  aiCleanupStatus: string;
  isAnalyzingWithAI: boolean;
  activeTierFilter: CleanupTier | "All";
  lastCompletedAt: string | null;
  setSelectedRoots: (roots: string[]) => void;
  beginDisplayingJob: (jobId: string) => void;
  displayJob: (api: StorageCleanupApi, jobId: string) => Promise<void>;
  startScan: (api: StorageCleanupApi) => Promise<void>;
  applyScanProgress: (progress: StorageCleanupProgress) => void;
  completeScan: (jobId: string, analysis: StorageAnalysis) => void;
  failScan: (jobId: string, message: string) => void;
  confirmCancelled: (jobId: string, message: string) => void;
  cancelScan: (api: Pick<StorageCleanupApi, "cancelStorageCleanupScan" | "getStorageCleanupScanStatus">) => Promise<void>;
  loadMoreCandidates: (api: StorageCleanupApi) => Promise<void>;
  setExecutionResult: (result: CleanupExecutionResult | null) => void;
  applyAIAnalyzedCandidates: (jobId: string, candidates: StorageCandidate[]) => void;
  setAICleanupStatus: (status: string) => void;
  setAIAnalyzing: (isAnalyzing: boolean) => void;
  setSelectedCleanupIds: (ids: Set<string>) => void;
  toggleCleanupCandidate: (candidate: StorageCandidate) => void;
  setActiveTierFilter: (filter: CleanupTier | "All") => void;
  clearAnalysis: () => void;
}

export const useStorageCleanupStore = create<StorageCleanupStore>((set, get) => ({
  selectedRoots: loadRecentRoots(),
  analysis: null,
  isScanning: false,
  scanStatus: "idle",
  activeJobId: null,
  cancelRequestedJobId: null,
  displayedJobId: null,
  scanProgress: null,
  scanError: "",
  executionResult: null,
  selectedCleanupIds: new Set(),
  aiAnalyzedCandidateIds: new Set(),
  aiDowngradedCandidateIds: new Set(),
  aiCleanupStatus: "",
  isAnalyzingWithAI: false,
  activeTierFilter: "All",
  lastCompletedAt: null,

  setSelectedRoots(roots) {
    const cleaned = roots.map((root) => root.trim()).filter(Boolean);
    rememberRecentRoots(cleaned);
    set({
      selectedRoots: cleaned,
      analysis: null,
      displayedJobId: null,
      executionResult: null,
      selectedCleanupIds: new Set(),
      aiAnalyzedCandidateIds: new Set(),
      aiDowngradedCandidateIds: new Set(),
      aiCleanupStatus: "",
      scanError: "",
      scanProgress: null,
      scanStatus: "idle",
      cancelRequestedJobId: null,
      activeTierFilter: "All"
    });
  },

  async startScan(api) {
    const roots = get().selectedRoots;
    if (!roots.length) {
      set({ scanError: "cleanup_scope_required", isScanning: false, scanStatus: "idle" });
      return;
    }
    set({
      isScanning: true,
      scanStatus: "running",
      cancelRequestedJobId: null,
      scanError: "",
      executionResult: null,
      scanProgress: null,
      analysis: null,
      activeJobId: null,
      displayedJobId: null,
      selectedCleanupIds: new Set(),
      aiAnalyzedCandidateIds: new Set(),
      aiDowngradedCandidateIds: new Set(),
      aiCleanupStatus: "",
      activeTierFilter: "All"
    });
    try {
      const jobId = await api.startStorageCleanupScan(roots);
      set({ activeJobId: jobId, scanStatus: "running", cancelRequestedJobId: null });
      try {
        const status = await api.getStorageCleanupScanStatus(jobId);
        if (get().activeJobId !== jobId) return;
        if (status.status === "completed" && status.analysis) {
          get().completeScan(jobId, status.analysis);
        } else if (status.status === "failed") {
          get().failScan(jobId, status.error || "cleanup_scan_not_completed");
        } else if (status.status === "cancelled") {
          get().confirmCancelled(jobId, status.error || "cleanup_cancelled");
        } else {
          get().applyScanProgress(status.progress);
        }
      } catch {
        // Event delivery remains authoritative when the immediate status check is unavailable.
      }
    } catch (error) {
      set({
        isScanning: false,
        scanStatus: "failed",
        activeJobId: null,
        cancelRequestedJobId: null,
        scanError: readableStoreError(error)
      });
    }
  },

  applyScanProgress(progress) {
    const { activeJobId } = get();
    if (!activeJobId || progress.jobId !== activeJobId) return;
    set((state) => ({
      scanProgress: progress,
      isScanning: true,
      scanStatus: state.cancelRequestedJobId === activeJobId ? "cancel_requested" : "running",
      scanError: ""
    }));
  },

  completeScan(jobId, analysis) {
    const { activeJobId } = get();
    if (jobId !== activeJobId) return;
    cancellationPollGeneration += 1;
    set({
      analysis,
      isScanning: false,
      scanStatus: "completed",
      activeJobId: null,
      cancelRequestedJobId: null,
      displayedJobId: jobId,
      scanProgress: null,
      scanError: "",
      selectedCleanupIds: new Set(defaultSelectedCleanupIds(analysis)),
      aiAnalyzedCandidateIds: new Set(),
      aiDowngradedCandidateIds: new Set(),
      aiCleanupStatus: "",
      lastCompletedAt: new Date().toISOString()
    });
  },

  failScan(jobId, message) {
    const { activeJobId } = get();
    if (jobId !== activeJobId) return;
    cancellationPollGeneration += 1;
    set({
      isScanning: false,
      scanStatus: "failed",
      activeJobId: null,
      cancelRequestedJobId: null,
      scanError: message,
      scanProgress: null
    });
  },

  confirmCancelled(jobId, message) {
    const { activeJobId } = get();
    if (jobId !== activeJobId) return;
    cancellationPollGeneration += 1;
    set({
      isScanning: false,
      scanStatus: "cancelled",
      activeJobId: null,
      cancelRequestedJobId: null,
      scanError: message,
      scanProgress: null
    });
  },

  async cancelScan(api) {
    const jobId = get().activeJobId;
    if (!jobId) {
      set({ scanError: "cleanup_no_active_scan" });
      return;
    }
    if (get().cancelRequestedJobId === jobId) return;
    const pollGeneration = ++cancellationPollGeneration;
    set({ scanStatus: "cancel_requested", cancelRequestedJobId: jobId, scanError: "" });
    try {
      await api.cancelStorageCleanupScan(jobId);
      if (get().activeJobId !== jobId || get().cancelRequestedJobId !== jobId) return;
      void waitForCancellationConfirmation(api, jobId, pollGeneration);
    } catch (error) {
      if (get().activeJobId === jobId && get().cancelRequestedJobId === jobId) {
        set({
          scanStatus: "running",
          cancelRequestedJobId: null,
          scanError: `cleanup_cancel_failed:${readableStoreError(error)}`
        });
      }
    }
  },

  async loadMoreCandidates(api) {
    const { analysis, displayedJobId } = get();
    if (!analysis?.has_more || !displayedJobId || !api.getStorageCleanupCandidatePage) return;
    const offset = analysis.candidates.length;
    const page = await api.getStorageCleanupCandidatePage(displayedJobId, offset, 200);
    if (get().displayedJobId !== displayedJobId) return;
    if ((get().analysis?.candidates.length ?? 0) !== offset) return;
    set((state) => {
      if (!state.analysis) return state;
      const seen = new Set(state.analysis.candidates.map((candidate) => candidate.id));
      const appended = page.candidates.filter((candidate) => !seen.has(candidate.id));
      const candidates = [...state.analysis.candidates, ...appended];
      const selectedCleanupIds = new Set(state.selectedCleanupIds);
      for (const id of defaultSelectedCleanupIds({ ...page, candidates: appended })) {
        selectedCleanupIds.add(id);
      }
      return {
        analysis: { ...page, candidates, candidate_offset: 0 },
        selectedCleanupIds
      };
    });
  },

  beginDisplayingJob(jobId) {
    set({
      displayedJobId: jobId,
      analysis: null,
      executionResult: null,
      selectedCleanupIds: new Set(),
      aiAnalyzedCandidateIds: new Set(),
      aiDowngradedCandidateIds: new Set(),
      aiCleanupStatus: "",
      isAnalyzingWithAI: false,
      activeTierFilter: "All"
    });
  },

  async displayJob(api, jobId) {
    get().beginDisplayingJob(jobId);
    if (!api.getStorageCleanupCandidatePage) {
      set({ scanError: "cleanup_candidate_load_failed" });
      return;
    }
    try {
      const page = await api.getStorageCleanupCandidatePage(jobId, 0, 200);
      if (get().displayedJobId !== jobId) return;
      set({
        analysis: page,
        scanError: "",
        selectedCleanupIds: new Set(defaultSelectedCleanupIds(page))
      });
    } catch (error) {
      if (get().displayedJobId === jobId) {
        set({ scanError: readableStoreError(error) });
      }
    }
  },

  setExecutionResult(result) {
    set({ executionResult: result });
  },

  applyAIAnalyzedCandidates(jobId, candidates) {
    if (!candidates.length) return;
    set((state) => {
      if (!state.analysis || state.displayedJobId !== jobId) return {};
      const updates = new Map(candidates.map((candidate) => [candidate.id, candidate]));
      const updatedCandidates = state.analysis.candidates.map((candidate) => updates.get(candidate.id) ?? candidate);
      const updatedAnalysis = rebuildStorageAnalysis(state.analysis, updatedCandidates);
      const aiAnalyzedCandidateIds = new Set(state.aiAnalyzedCandidateIds);
      const aiDowngradedCandidateIds = new Set(state.aiDowngradedCandidateIds);
      for (const candidate of candidates) {
        aiAnalyzedCandidateIds.add(candidate.id);
        const before = state.analysis.candidates.find((item) => item.id === candidate.id);
        if (before && isConservativeAIDowngrade(before, candidate)) {
          aiDowngradedCandidateIds.add(candidate.id);
        }
      }
      const selectedCleanupIds = new Set(
        [...state.selectedCleanupIds].filter((id) => {
          const candidate = updatedCandidates.find((item) => item.id === id);
          return candidate ? canManuallySelectForCleanup(candidate) : false;
        })
      );
      return {
        analysis: updatedAnalysis,
        selectedCleanupIds,
        aiAnalyzedCandidateIds,
        aiDowngradedCandidateIds
      };
    });
  },

  setAICleanupStatus(status) {
    set({ aiCleanupStatus: status });
  },

  setAIAnalyzing(isAnalyzing) {
    set({ isAnalyzingWithAI: isAnalyzing });
  },

  setSelectedCleanupIds(ids) {
    set({ selectedCleanupIds: new Set(ids) });
  },

  toggleCleanupCandidate(candidate) {
    if (!canManuallySelectForCleanup(candidate)) return;
    set((state) => {
      const selectedCleanupIds = new Set(state.selectedCleanupIds);
      if (selectedCleanupIds.has(candidate.id)) selectedCleanupIds.delete(candidate.id);
      else selectedCleanupIds.add(candidate.id);
      return { selectedCleanupIds };
    });
  },

  setActiveTierFilter(filter) {
    set({ activeTierFilter: filter });
  },

  clearAnalysis() {
    set({
      analysis: null,
      displayedJobId: null,
      executionResult: null,
      selectedCleanupIds: new Set(),
      aiAnalyzedCandidateIds: new Set(),
      aiDowngradedCandidateIds: new Set(),
      aiCleanupStatus: "",
      isAnalyzingWithAI: false,
      scanError: "",
      scanProgress: null,
      activeTierFilter: "All"
    });
  }
}));

export function resetStorageCleanupStoreForTest() {
  cancellationPollGeneration += 1;
  useStorageCleanupStore.setState({
    selectedRoots: [],
    analysis: null,
    isScanning: false,
    scanStatus: "idle",
    activeJobId: null,
    cancelRequestedJobId: null,
    displayedJobId: null,
    scanProgress: null,
    scanError: "",
    executionResult: null,
    selectedCleanupIds: new Set(),
    aiAnalyzedCandidateIds: new Set(),
    aiDowngradedCandidateIds: new Set(),
    aiCleanupStatus: "",
    isAnalyzingWithAI: false,
    activeTierFilter: "All",
    lastCompletedAt: null
  });
}

export function defaultSelectedCleanupIds(analysis?: StorageAnalysis | null): string[] {
  return (analysis?.candidates ?? [])
    .filter((candidate) => canSelectForCleanup(candidate) && candidate.selected_by_default)
    .map((candidate) => candidate.id);
}

export function canSelectForCleanup(candidate: StorageCandidate) {
  return canAutoSelectForCleanup(candidate);
}

export function canAutoSelectForCleanup(candidate: StorageCandidate) {
  return candidate.tier === "Safe" && candidate.trash_allowed && candidate.suggested_action === "MoveToTrash";
}

export function canManuallySelectForCleanup(candidate: StorageCandidate) {
  return candidate.tier !== "Caution" && candidate.trash_allowed && candidate.suggested_action === "MoveToTrash";
}

export function cleanupSelectionDisabledReason(candidate: StorageCandidate) {
  if (candidate.tier === "Caution") return "谨慎处理项不能直接清理，请先人工检查。";
  if (!candidate.trash_allowed) return "该路径不允许移动到 Safe Trash。";
  if (candidate.suggested_action !== "MoveToTrash") {
    return "该项建议为 Reveal / AppInternalCleanup / UninstallAdvice，不是文件移动清理。";
  }
  if (candidate.tier === "Review") return "需要人工确认后才能加入 Safe Trash。";
  return "";
}

function rebuildStorageAnalysis(previous: StorageAnalysis, candidates: StorageCandidate[]): StorageAnalysis {
  return {
    ...previous,
    candidates,
    reclaimable_estimate: candidates
      .filter((candidate) => candidate.tier === "Safe" && candidate.trash_allowed)
      .reduce((sum, candidate) => sum + candidate.size, 0),
    review_estimate: candidates
      .filter((candidate) => candidate.tier === "Review")
      .reduce((sum, candidate) => sum + candidate.size, 0)
  };
}

function isConservativeAIDowngrade(before: StorageCandidate, after: StorageCandidate) {
  return tierRank(after.tier) > tierRank(before.tier)
    || (before.trash_allowed && !after.trash_allowed)
    || (before.selected_by_default && !after.selected_by_default)
    || (before.suggested_action === "MoveToTrash" && after.suggested_action !== "MoveToTrash");
}

function tierRank(tier: CleanupTier) {
  if (tier === "Safe") return 0;
  if (tier === "Review") return 1;
  return 2;
}

function loadRecentRoots(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_SCOPE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function rememberRecentRoots(roots: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENT_SCOPE_KEY, JSON.stringify(roots.slice(0, 4)));
  } catch {
    // Recent roots are optional convenience state.
  }
}

function readableStoreError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function waitForCancellationConfirmation(
  api: Pick<StorageCleanupApi, "getStorageCleanupScanStatus">,
  jobId: string,
  pollGeneration: number
) {
  const deadline = Date.now() + CLEANUP_CANCEL_MAX_WAIT_MS;
  let firstPoll = true;
  while (Date.now() <= deadline) {
    const state = useStorageCleanupStore.getState();
    if (
      cancellationPollGeneration !== pollGeneration
      || state.activeJobId !== jobId
      || state.cancelRequestedJobId !== jobId
    ) {
      return;
    }

    if (!firstPoll) await wait(CLEANUP_CANCEL_POLL_INTERVAL_MS);
    firstPoll = false;

    let status: StorageCleanupScanStatus | undefined;
    try {
      status = await api.getStorageCleanupScanStatus(jobId);
    } catch {
      continue;
    }
    if (!status || status.jobId !== jobId) return;
    if (status.status === "cancelled") {
      useStorageCleanupStore.getState().confirmCancelled(jobId, status.error || "cleanup_cancelled");
      return;
    }
    if (status.status === "completed") {
      if (status.analysis) useStorageCleanupStore.getState().completeScan(jobId, status.analysis);
      else useStorageCleanupStore.getState().failScan(jobId, "cleanup_scan_completed_without_analysis");
      return;
    }
    if (status.status === "failed") {
      useStorageCleanupStore.getState().failScan(jobId, status.error || "cleanup_scan_not_completed");
      return;
    }
  }

  const state = useStorageCleanupStore.getState();
  if (state.activeJobId === jobId && state.cancelRequestedJobId === jobId) {
    cancellationPollGeneration += 1;
    setStoreCancelWaitTimeout();
  }
}

function setStoreCancelWaitTimeout() {
  useStorageCleanupStore.setState({
    scanStatus: "running",
    cancelRequestedJobId: null,
    scanError: "cleanup_cancel_waiting"
  });
}

export function storageCleanupErrorMessage(error: string, t: Translator) {
  if (error === "cleanup_scope_required") return t("storageCleanupScopeRequired");
  if (error === "cleanup_no_active_scan") return t("storageCleanupNoActiveScan");
  if (error === "cleanup_candidate_load_failed") return t("storageCleanupCandidateLoadFailed");
  if (error === "cleanup_scan_not_completed") return t("storageCleanupScanNotCompleted");
  if (error === "cleanup_scan_completed_without_analysis") return t("storageCleanupScanMissingAnalysis");
  if (error === "cleanup_cancelled") return t("scanCanceled");
  if (error === "cleanup_cancel_waiting") return t("storageCleanupCancelWaiting");
  if (error.startsWith("system_trash_source_binding_unsupported")) {
    return t("errorSystemTrashSourceBindingUnsupported");
  }
  if (error.startsWith("restore_pending_reconciliation")) return t("errorRestorePendingReconciliation");
  if (error.startsWith("claim_identity_mismatch")) return t("errorClaimIdentityMismatch");
  if (error.startsWith("manual_review_required")) return t("errorManualReviewRequired");
  if (error.startsWith("cleanup_cancel_failed")) return t("storageCleanupCancelFailed");
  return error;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => globalThis.setTimeout(resolve, ms));
}
