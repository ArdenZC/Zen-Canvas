import { create } from "zustand";
import { open } from "@tauri-apps/plugin-dialog";
import type { UnlistenFn } from "@tauri-apps/api/event";
import {
  tauriApi,
  type DedupeCompletePayload,
  type DedupeProgressPayload,
  type ScanBatchPayload,
  type ScanProgressPayload,
  type ScanSummary,
  type ScannedEntry
} from "../api/tauriApi";
import { enabledScanRootPaths } from "../hooks/useAppSettings";
import { makeTranslator } from "../i18n";
import type { ScanRootSetting } from "../types/domain";
import { readableError } from "../utils/viewHelpers";
import { useAppStore } from "./useAppStore";
import { useFileLibraryStore } from "./useFileLibraryStore";

export type ScanStatus = "idle" | "scanning" | "completed" | "canceled" | "error";

export interface ScanStateData {
  status: ScanStatus;
  progress: ScanProgressPayload | null;
  entries: ScannedEntry[];
  error: string | null;
}

const initialScanState: ScanStateData = {
  status: "idle",
  progress: null,
  entries: [],
  error: null
};

let scanJobCanceled = false;
let activeScanJobId: string | null = null;
let activeDedupeParentScanJobId: string | null = null;
let activeDedupeJobId: string | null = null;

export function isCurrentDedupeEvent(
  payload: Pick<DedupeProgressPayload, "dedupeJobId" | "parentScanJobId">,
  parentScanJobId: string | null,
  dedupeJobId: string | null
) {
  return payload.parentScanJobId === parentScanJobId
    && (dedupeJobId === null || payload.dedupeJobId === dedupeJobId);
}

function createScanJobId(kind: "foreground" | "background") {
  const suffix = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `scan-${kind}-${suffix}`;
}

export interface ScanManagerStore {
  selectedFolders: string[];
  defaultScanRoots: ScanRootSetting[];
  isScanning: boolean;
  isCancelingScan: boolean;
  scanState: ScanStateData;
  listenersRegistered: boolean;
  registrationPromise: Promise<void> | null;
  unlisteners: UnlistenFn[];
  initializeScanListeners: () => Promise<void>;
  setDefaultScanRoots: (roots: ScanRootSetting[]) => void;
  reset: () => void;
  scanPath: (path: string) => Promise<void>;
  scanPaths: (paths: string[]) => Promise<void>;
  handleScan: () => Promise<void>;
  handleChooseFolders: () => Promise<void>;
  cancelScan: () => Promise<void>;
}

function currentT() {
  return makeTranslator(useAppStore.getState().language);
}

async function askForScanPath() {
  const t = currentT();
  const selectedPath = await open({
    directory: true,
    multiple: false,
    title: t("folderPickerTitle"),
    defaultPath: useScanManagerStore.getState().selectedFolders[0]
  });

  if (Array.isArray(selectedPath)) return selectedPath[0]?.trim() ?? "";
  return selectedPath?.trim() ?? "";
}

export const useScanManagerStore = create<ScanManagerStore>((set, get) => ({
  selectedFolders: [],
  defaultScanRoots: [],
  isScanning: false,
  isCancelingScan: false,
  scanState: initialScanState,
  listenersRegistered: false,
  registrationPromise: null,
  unlisteners: [],
  initializeScanListeners: () => {
    if (get().listenersRegistered) return Promise.resolve();
    const registrationPromise = get().registrationPromise;
    if (registrationPromise) return registrationPromise;

    const promise = (async () => {
      try {
        const unlisteners = await Promise.all([
          tauriApi.onScanProgress((progress) => {
            if (progress.jobId !== activeScanJobId) return;
            set((state) => ({
              scanState: {
                ...state.scanState,
                status: scanJobCanceled ? "canceled" : "scanning",
                progress,
                error: null
              }
            }));
          }),
          tauriApi.onScanBatch((batch: ScanBatchPayload) => {
            if (batch.jobId !== activeScanJobId) return;
            set((state) => ({
              scanState: {
                ...state.scanState,
                status: scanJobCanceled ? "canceled" : "scanning",
                progress: batch.progress,
                error: null
              }
            }));
          }),
          tauriApi.onScanComplete((summary: ScanSummary) => {
            if (summary.jobId !== activeScanJobId) return;
            set((state) => ({
              scanState: {
                ...state.scanState,
                status: scanJobCanceled ? "canceled" : "completed",
                progress: summary,
                error: null
              }
            }));
          }),
          tauriApi.onScanCanceled((summary: ScanSummary) => {
            if (summary.jobId !== activeScanJobId) return;
            set((state) => ({
              scanState: {
                ...state.scanState,
                status: "canceled",
                progress: summary,
                error: null
              }
            }));
          }),
          tauriApi.onScanError((payload) => {
            if (payload.jobId !== activeScanJobId) return;
            set((state) => ({
              scanState: {
                ...state.scanState,
                status: state.scanState.status === "idle" ? "scanning" : state.scanState.status,
                progress: state.scanState.progress
                  ? {
                      ...state.scanState.progress,
                      errors: state.scanState.progress.errors + 1
                    }
                  : {
                      root: payload.root,
                      jobId: payload.jobId,
                      jobKind: payload.jobKind,
                      scanned: 0,
                      files: 0,
                      directories: 0,
                      skipped: 0,
                      errors: 1,
                      elapsedMs: 0
                    },
                error: null
              }
            }));
          }),
          tauriApi.onDedupeProgress((payload) => {
            if (!isCurrentDedupeEvent(payload, activeDedupeParentScanJobId, activeDedupeJobId)) {
              return;
            }
            activeDedupeJobId ??= payload.dedupeJobId;
          }),
          tauriApi.onDedupeComplete((payload: DedupeCompletePayload) => {
            if (!isCurrentDedupeEvent(payload, activeDedupeParentScanJobId, activeDedupeJobId)) {
              return;
            }
            activeDedupeJobId = null;
            activeDedupeParentScanJobId = null;
            if (payload.status === "completed") {
              void useFileLibraryStore.getState().refresh(useAppStore.getState().searchQuery);
            }
          })
        ]);
        set({ listenersRegistered: true, registrationPromise: null, unlisteners });
      } catch (error) {
        set((state) => ({
          registrationPromise: null,
          scanState: {
            ...state.scanState,
            status: "error",
            error: readableError(error)
          }
        }));
        useAppStore.getState().showError(readableError(error));
      }
    })();
    set({ registrationPromise: promise });
    return promise;
  },
  setDefaultScanRoots: (roots) => set({ defaultScanRoots: roots }),
  reset: () => set({ scanState: initialScanState, isCancelingScan: false }),
  scanPath: async (path) => {
    await get().scanPaths([path]);
  },
  scanPaths: async (paths) => {
    if (get().isScanning) return;

    const t = currentT();
    const scanRoots = paths.map((path) => path.trim()).filter(Boolean);
    if (!scanRoots.length) {
      useAppStore.getState().showError(t("noFolderSelected"));
      return;
    }

    scanJobCanceled = false;
    set({
      selectedFolders: scanRoots,
      isScanning: true,
      isCancelingScan: false,
      scanState: initialScanState
    });

    try {
      let totalFiles = 0;
      const completedScanRoots: string[] = [];
      for (const [index, path] of scanRoots.entries()) {
        if (scanJobCanceled) break;
        activeScanJobId = createScanJobId("foreground");
        if (index === scanRoots.length - 1) {
          activeDedupeParentScanJobId = activeScanJobId;
          activeDedupeJobId = null;
        }
        const summary = await tauriApi.startScan(
          path,
          false,
          activeScanJobId,
          "foreground",
          index === scanRoots.length - 1
        );
        if (scanJobCanceled) break;
        totalFiles += summary.files;
        completedScanRoots.push(path);
      }

      if (scanJobCanceled) {
        set((state) => ({
          scanState: {
            ...state.scanState,
            status: "canceled",
            error: null
          }
        }));
        if (completedScanRoots.length) {
          useFileLibraryStore.getState().setCurrentScanScope(completedScanRoots);
          await useFileLibraryStore.getState().refresh(useAppStore.getState().searchQuery);
        }
        useAppStore.getState().showSuccess(t("scanCanceled"));
        return;
      }

      useFileLibraryStore.getState().setCurrentScanScope(completedScanRoots);
      await useFileLibraryStore.getState().refresh(useAppStore.getState().searchQuery);
      useAppStore.getState().showSuccess(`${t("success")}: ${totalFiles.toLocaleString()} ${t("files")}`);
    } catch (error) {
      const message = readableError(error);
      set((state) => ({
        scanState: {
          ...state.scanState,
          status: "error",
          error: message
        }
      }));
      useAppStore.getState().showError(message);
    } finally {
      activeScanJobId = null;
      set({ isScanning: false, isCancelingScan: false });
    }
  },
  handleScan: async () => {
    try {
      const { defaultScanRoots, scanPaths } = get();
      const defaultPaths = enabledScanRootPaths(defaultScanRoots);
      const paths = defaultPaths.length ? defaultPaths : [await askForScanPath()].filter(Boolean);
      await scanPaths(paths);
    } catch (error) {
      useAppStore.getState().showError(readableError(error));
    }
  },
  handleChooseFolders: async () => {
    try {
      const path = await askForScanPath();
      if (path) await get().scanPath(path);
    } catch (error) {
      useAppStore.getState().showError(readableError(error));
    }
  },
  cancelScan: async () => {
    if (!get().isScanning || get().isCancelingScan) return;
    scanJobCanceled = true;
    set((state) => ({
      isCancelingScan: true,
      scanState: {
        ...state.scanState,
        status: "canceled",
        error: null
      }
    }));
    try {
      if (!activeScanJobId) return;
      await tauriApi.cancelScan(activeScanJobId);
    } catch (error) {
      scanJobCanceled = false;
      const message = readableError(error);
      set((state) => ({
        isCancelingScan: false,
        scanState: {
          ...state.scanState,
          status: "scanning",
          error: message
        }
      }));
      useAppStore.getState().showError(message);
    }
  }
}));
