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
  activeTierFilter: CleanupTier | "All";
  lastCompletedAt: string | null;
  setSelectedRoots: (roots: string[]) => void;
  startScan: (api: StorageCleanupApi) => Promise<void>;
  applyScanProgress: (progress: StorageCleanupProgress) => void;
  completeScan: (jobId: string, analysis: StorageAnalysis) => void;
  failScan: (jobId: string, message: string) => void;
  cancelScan: (api: Pick<StorageCleanupApi, "cancelStorageCleanupScan">) => Promise<void>;
  setExecutionResult: (result: CleanupExecutionResult | null) => void;
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

  setExecutionResult(result) {
    set({ executionResult: result });
  },

  setSelectedCleanupIds(ids) {
    set({ selectedCleanupIds: new Set(ids) });
  },

  toggleCleanupCandidate(candidate) {
    if (!canSelectForCleanup(candidate)) return;
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
  return candidate.tier === "Safe" && candidate.trash_allowed && candidate.suggested_action === "MoveToTrash";
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
  window.localStorage.setItem(RECENT_SCOPE_KEY, JSON.stringify(roots.slice(0, 4)));
}

function readableStoreError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
