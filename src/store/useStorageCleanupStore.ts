import { create } from "zustand";
import type {
  CleanupExecutionResult,
  CleanupTier,
  StorageAnalysis,
  StorageCandidate,
  StorageCleanupProgress,
  StorageCleanupScanStatus
} from "../types/domain";

const RECENT_SCOPE_KEY = "zen-canvas.storage-cleanup.recent-roots";

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
  scanJobId: string | null;
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
  startScan: (api: StorageCleanupApi) => Promise<void>;
  applyScanProgress: (progress: StorageCleanupProgress) => void;
  completeScan: (jobId: string, analysis: StorageAnalysis) => void;
  failScan: (jobId: string, message: string) => void;
  cancelScan: (api: Pick<StorageCleanupApi, "cancelStorageCleanupScan">) => Promise<void>;
  loadMoreCandidates: (api: StorageCleanupApi) => Promise<void>;
  setExecutionResult: (result: CleanupExecutionResult | null) => void;
  applyAIAnalyzedCandidates: (candidates: StorageCandidate[]) => void;
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
  scanJobId: null,
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
      executionResult: null,
      selectedCleanupIds: new Set(),
      aiAnalyzedCandidateIds: new Set(),
      aiDowngradedCandidateIds: new Set(),
      aiCleanupStatus: "",
      scanError: "",
      scanProgress: null,
      activeTierFilter: "All"
    });
  },

  async startScan(api) {
    const roots = get().selectedRoots;
    if (!roots.length) {
      set({ scanError: "请选择一个磁盘或文件夹。", isScanning: false });
      return;
    }
    set({
      isScanning: true,
      scanError: "",
      executionResult: null,
      scanProgress: null,
      analysis: null,
      selectedCleanupIds: new Set(),
      aiAnalyzedCandidateIds: new Set(),
      aiDowngradedCandidateIds: new Set(),
      aiCleanupStatus: "",
      activeTierFilter: "All"
    });
    try {
      const jobId = await api.startStorageCleanupScan(roots);
      set({ scanJobId: jobId });
    } catch (error) {
      set({
        isScanning: false,
        scanJobId: null,
        scanError: readableStoreError(error)
      });
    }
  },

  applyScanProgress(progress) {
    const { scanJobId } = get();
    if (scanJobId && progress.jobId !== scanJobId) return;
    set({ scanProgress: progress, isScanning: true, scanError: "" });
  },

  completeScan(jobId, analysis) {
    const { scanJobId } = get();
    if (scanJobId && jobId !== scanJobId) return;
    set({
      analysis,
      isScanning: false,
      scanJobId: jobId,
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
    const { scanJobId } = get();
    if (scanJobId && jobId !== scanJobId) return;
    set({
      isScanning: false,
      scanJobId: jobId,
      scanError: message,
      scanProgress: null
    });
  },

  async cancelScan(api) {
    const jobId = get().scanJobId;
    if (!jobId) {
      set({ isScanning: false, scanError: "扫描已取消。" });
      return;
    }
    try {
      await api.cancelStorageCleanupScan(jobId);
    } finally {
      set({ isScanning: false, scanError: "扫描已取消。", scanProgress: null });
    }
  },

  async loadMoreCandidates(api) {
    const { analysis, scanJobId } = get();
    if (!analysis?.has_more || !scanJobId || !api.getStorageCleanupCandidatePage) return;
    const page = await api.getStorageCleanupCandidatePage(scanJobId, analysis.candidates.length, 200);
    if (get().scanJobId !== scanJobId) return;
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

  setExecutionResult(result) {
    set({ executionResult: result });
  },

  applyAIAnalyzedCandidates(candidates) {
    if (!candidates.length) return;
    set((state) => {
      if (!state.analysis) return {};
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
  useStorageCleanupStore.setState({
    selectedRoots: [],
    analysis: null,
    isScanning: false,
    scanJobId: null,
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
