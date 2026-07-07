import { create } from "zustand";
import { tauriApi } from "../api/tauriApi";
import { readableError } from "../utils/viewHelpers";
import { useAppStore } from "./useAppStore";
import { useFileLibraryStore } from "./useFileLibraryStore";
import { useScanManagerStore } from "./useScanManagerStore";

export interface BackgroundIndexFailure {
  path: string;
  message: string;
}

export interface BackgroundIndexerStore {
  pendingRoots: string[];
  currentRoot: string | null;
  isBackgroundIndexing: boolean;
  failedRoots: BackgroundIndexFailure[];
  completedRoots: string[];
  enqueueRoot: (path: string) => void;
  enqueueRoots: (paths: string[]) => void;
  cancelBackgroundIndexing: () => Promise<void>;
}

const BACKGROUND_INDEXER_FOREGROUND_WAIT_MS = 1200;
const MAX_BACKGROUND_INDEX_HISTORY = 6;

let isProcessingBackgroundQueue = false;
let isCancelingBackgroundQueue = false;

export const useBackgroundIndexerStore = create<BackgroundIndexerStore>((set, get) => ({
  pendingRoots: [],
  currentRoot: null,
  isBackgroundIndexing: false,
  failedRoots: [],
  completedRoots: [],
  enqueueRoot: (path) => get().enqueueRoots([path]),
  enqueueRoots: (paths) => {
    const normalizedPaths = uniqueNormalizedRoots(paths);
    if (!normalizedPaths.length) return;

    set((state) => {
      const knownRoots = new Set([
        ...state.pendingRoots.map(normalizeRoot),
        ...(state.currentRoot ? [normalizeRoot(state.currentRoot)] : [])
      ]);
      const nextRoots = normalizedPaths.filter((path) => !knownRoots.has(normalizeRoot(path)));
      if (!nextRoots.length) return state;
      return { pendingRoots: [...state.pendingRoots, ...nextRoots] };
    });

    scheduleBackgroundIndexing();
  },
  cancelBackgroundIndexing: async () => {
    isCancelingBackgroundQueue = true;
    set({ pendingRoots: [], currentRoot: null, isBackgroundIndexing: false });
    try {
      await tauriApi.cancelScan();
    } catch {
      // The scan command may not be active; cancellation is best-effort.
    } finally {
      isCancelingBackgroundQueue = false;
    }
  }
}));

function scheduleBackgroundIndexing() {
  if (isProcessingBackgroundQueue) return;
  isProcessingBackgroundQueue = true;
  void processBackgroundQueue().finally(() => {
    isProcessingBackgroundQueue = false;
    if (useBackgroundIndexerStore.getState().pendingRoots.length > 0) {
      scheduleBackgroundIndexing();
    }
  });
}

async function processBackgroundQueue() {
  while (true) {
    if (isCancelingBackgroundQueue) return;

    if (useScanManagerStore.getState().isScanning) {
      useBackgroundIndexerStore.setState({ currentRoot: null, isBackgroundIndexing: false });
      await delay(BACKGROUND_INDEXER_FOREGROUND_WAIT_MS);
      continue;
    }

    const root = useBackgroundIndexerStore.getState().pendingRoots[0];
    if (!root) {
      useBackgroundIndexerStore.setState({ currentRoot: null, isBackgroundIndexing: false });
      return;
    }

    useBackgroundIndexerStore.setState((state) => ({
      pendingRoots: state.pendingRoots.slice(1),
      currentRoot: root,
      isBackgroundIndexing: true
    }));

    try {
      await tauriApi.startScan(root, false);
      if (!isCancelingBackgroundQueue) {
        useBackgroundIndexerStore.setState((state) => ({
          completedRoots: [root, ...state.completedRoots.filter((item) => normalizeRoot(item) !== normalizeRoot(root))]
            .slice(0, MAX_BACKGROUND_INDEX_HISTORY),
          failedRoots: state.failedRoots.filter((item) => normalizeRoot(item.path) !== normalizeRoot(root))
        }));
        await useFileLibraryStore.getState().refresh(useAppStore.getState().searchQuery);
      }
    } catch (error) {
      if (!isCancelingBackgroundQueue) {
        const message = readableError(error);
        useBackgroundIndexerStore.setState((state) => ({
          failedRoots: [
            { path: root, message },
            ...state.failedRoots.filter((item) => normalizeRoot(item.path) !== normalizeRoot(root))
          ].slice(0, MAX_BACKGROUND_INDEX_HISTORY)
        }));
      }
    } finally {
      useBackgroundIndexerStore.setState((state) => ({
        currentRoot: state.currentRoot === root ? null : state.currentRoot,
        isBackgroundIndexing: false
      }));
    }
  }
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function uniqueNormalizedRoots(paths: string[]) {
  const seen = new Set<string>();
  const roots: string[] = [];
  for (const path of paths) {
    const normalized = normalizeRoot(path);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    roots.push(path.trim());
  }
  return roots;
}

function normalizeRoot(path: string) {
  return path.trim().replace(/\\+/g, "/").replace(/\/+$/g, "").toLowerCase();
}
