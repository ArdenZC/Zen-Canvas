import { create } from "zustand";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { tauriApi, type OperationProgressPayload } from "../api/tauriApi";
import { makeTranslator } from "../i18n";
import type {
  CleanupRestoreProgressPayload,
  CleanupRestorePreviewItem,
  CleanupRestoreResult,
  CleanupTrashItem,
  FileRecord,
  LibraryScope,
  OperationLog,
  OperationPreview,
  OperationPreviewResult,
  RuleExecutionSummary
} from "../types/domain";
import { applyPreviewNameOverride, createOperationPreviews, localId, localizedStableError, readableError } from "../utils/viewHelpers";
import { useAppStore } from "./useAppStore";
import { useFileLibraryStore } from "./useFileLibraryStore";
import { resolveLegacyLibraryScope } from "./useFileLibraryV2Store";
import { useRulesStore } from "./useRulesStore";
import { useOrganizeDecisionStore } from "./useOrganizeDecisionStore";
import { organizeScopeKey, validateOrganizeFileName, validateOrganizeFileNameForOriginal } from "../views/organize/organizeModel";
import {
  createRestoreExecutionIntent,
  resolveCleanupRestoreSelection,
  resolveOperationRestoreSelection,
  resolveRestoreExecutionIds,
  restoreIntentMatchesResolution,
  type CleanupPreviewAuthority,
  type RestoreExecutionIntent,
  type RestoreResultSummary
} from "../views/history/historyModel";
import {
  isPreviewExecutable,
  mergeOperationLogs,
  previewsForExecutionIntent,
  resolveExecutableSelectedPreviews,
  resolvePreviewEligibility,
  type PreviewExecutionIntent
} from "./operationQueue/selectors";
import {
  cancelCleanupRestore,
  confirmCleanupRestore,
  prepareCleanupRestoreIntent
} from "./operationQueue/cleanupRestoreController";
import { executeSelected, runDispatch } from "./operationQueue/operationExecutionController";
import { cancelOperations, initializeOperationQueue } from "./operationQueue/operationProgressController";
import {
  confirmOperationRestore,
  prepareOperationRestoreIntent
} from "./operationQueue/operationRestoreController";
import type { OperationQueueControllerContext } from "./operationQueue/controllerTypes";
export {
  isPreviewBackendApproved,
  isPreviewExecutable,
  mergeOperationLogs,
  operationConfirmationTone,
  operationNeedsCleanupConfirmation,
  previewsForExecutionIntent,
  resolveExecutableSelectedPreviews,
  resolvePreviewEligibility,
  selectionForPreviewGroup
} from "./operationQueue/selectors";
export type {
  ExecutablePreviewSelection,
  OperationConfirmationTone,
  PreviewEligibility,
  PreviewExecutionIntent,
  PreviewExclusionReason
} from "./operationQueue/selectors";

export const MAX_LOGS = 500;

export type RestoreConfirmationOutcome<T> =
  | { status: "executed"; value: T }
  | { status: "stale"; intent: RestoreExecutionIntent }
  | { status: "rejected"; message: string };

export interface OperationQueueStore {
  operationLogs: OperationLog[];
  selectedOperationIds: Set<string>;
  previewNameOverrides: Record<string, string>;
  previews: OperationPreview[];
  displayPreviews: OperationPreview[];
  previewScope: LibraryScope | null;
  previewTotal: number;
  previewLimit: number;
  previewOffset: number;
  previewTruncated: boolean;
  previewHasMore: boolean;
  previewActionCount: number;
  lastExecutionLogs: OperationLog[];
  lastRestoreResult: OperationLog[];
  lastRestoreSummary: RestoreResultSummary | null;
  cleanupRestoreResult: CleanupRestoreResult | null;
  cleanupRestoreProgress: CleanupRestoreProgressPayload | null;
  cleanupRestoreJobId: string | null;
  cleanupRestoreError: string;
  restoreTechnicalError: string;
  restoreError: string;
  restoreIntent: RestoreExecutionIntent | null;
  executionIntent: PreviewExecutionIntent;
  executionError: string;
  previewRequestId: number;
  operationProgress: OperationProgressPayload | null;
  isOperationCanceling: boolean;
  activeOperationKind: OperationProgressPayload["kind"] | null;
  listenersRegistered: boolean;
  registrationPromise: Promise<void> | null;
  unlistener?: UnlistenFn;
  initializeOperationQueue: () => Promise<void>;
  loadPersistedOperationLogs: () => Promise<void>;
  refreshOperationLogs: () => Promise<OperationLog[]>;
  syncPreviews: (files: FileRecord[]) => void;
  setPreviewResult: (result: OperationPreviewResult, scope: LibraryScope) => void;
  refreshPreviewsForScope: (scope: LibraryScope) => Promise<OperationPreviewResult>;
  refreshPreviewsForFiles: (scope: LibraryScope, fileIds: Set<string>) => Promise<OperationPreviewResult | null>;
  loadMorePreviews: () => Promise<void>;
  setSelectedOperationIds: (ids: Set<string>) => void;
  startOrganizePreviewSession: (scopeKey: string, allowedPreviewIds: Set<string>) => void;
  clearExecutionIntent: () => void;
  runDispatch: (confirmed: boolean) => Promise<RuleExecutionSummary>;
  executeSelected: (confirmed: boolean) => Promise<OperationLog[]>;
  prepareOperationRestoreIntent: (selectedIds: ReadonlySet<string> | readonly string[]) => Promise<RestoreExecutionIntent | null>;
  prepareCleanupRestoreIntent: (items: readonly CleanupTrashItem[]) => Promise<RestoreExecutionIntent | null>;
  confirmOperationRestore: (sessionId: string) => Promise<RestoreConfirmationOutcome<OperationLog[]>>;
  confirmCleanupRestore: (sessionId: string) => Promise<RestoreConfirmationOutcome<CleanupRestoreResult>>;
  invalidateRestoreIntent: () => void;
  cancelOperations: () => Promise<void>;
  cancelCleanupRestore: () => Promise<void>;
  onRenamePreview: (id: string, name: string) => void;
}

function applyOverrides(
  previews: OperationPreview[],
  previewNameOverrides: Record<string, string>
) {
  return previews.map((preview) => {
    const override = previewNameOverrides[preview.id];
    if (override !== undefined && validateOrganizeFileName(override) !== null) return { ...preview, new_name: override };
    return applyPreviewNameOverride(preview, override);
  });
}

function previewActionCount(displayPreviews: OperationPreview[]) {
  return displayPreviews.filter((preview) => preview.status === "pending").length;
}

function defaultSelectedPreviewIds(previews: OperationPreview[]) {
  return new Set(
    previews
      .filter((preview) => preview.selected_by_default && isPreviewExecutable(preview))
      .map((preview) => preview.id)
  );
}

function reconcileExecutionIntent(intent: PreviewExecutionIntent, previews: OperationPreview[]) {
  if (intent?.source !== "organize") return intent;
  const valid = new Set(previews.map((preview) => preview.id));
  return { ...intent, allowedPreviewIds: new Set([...intent.allowedPreviewIds].filter((id) => valid.has(id))) };
}

export const useOperationQueueStore = create<OperationQueueStore>((set, get) => ({
  operationLogs: [],
  selectedOperationIds: new Set(),
  previewNameOverrides: {},
  previews: [],
  displayPreviews: [],
  previewScope: null,
  previewTotal: 0,
  previewLimit: 0,
  previewOffset: 0,
  previewTruncated: false,
  previewHasMore: false,
  previewActionCount: 0,
  lastExecutionLogs: [],
  lastRestoreResult: [],
  lastRestoreSummary: null,
  cleanupRestoreResult: null,
  cleanupRestoreProgress: null,
  cleanupRestoreJobId: null,
  cleanupRestoreError: "",
  restoreTechnicalError: "",
  restoreError: "",
  restoreIntent: null,
  executionIntent: null,
  executionError: "",
  previewRequestId: 0,
  operationProgress: null,
  isOperationCanceling: false,
  activeOperationKind: null,
  listenersRegistered: false,
  registrationPromise: null,
  initializeOperationQueue: () => initializeOperationQueue({ get, set }),
  loadPersistedOperationLogs: async () => {
    try {
      const persistedLogs = await tauriApi.getOperationLogs(MAX_LOGS);
      set((state) => ({
        operationLogs: mergeOperationLogs(persistedLogs, state.operationLogs)
      }));
    } catch (error) {
      useAppStore.getState().showError(readableError(error));
    }
  },
  refreshOperationLogs: async () => {
    const persistedLogs = await tauriApi.getOperationLogs(MAX_LOGS);
    set((state) => ({ operationLogs: mergeOperationLogs(persistedLogs, state.operationLogs) }));
    return persistedLogs;
  },
  syncPreviews: (files) => {
    const previews = createOperationPreviews(files);
    const displayPreviews = applyOverrides(previews, {});
    set({
      previews,
      displayPreviews,
      previewNameOverrides: {},
      selectedOperationIds: defaultSelectedPreviewIds(previews),
      previewScope: null,
      previewTotal: previews.length,
      previewLimit: previews.length,
      previewOffset: 0,
      previewTruncated: false,
      previewHasMore: false,
      previewActionCount: previewActionCount(displayPreviews)
    });
  },
  setPreviewResult: (result, scope) => {
    const displayPreviews = applyOverrides(result.previews, {});
    set((state) => {
      const scopedIntent = state.executionIntent?.source === "organize" && state.executionIntent.scopeKey !== organizeScopeKey(scope)
        ? null
        : state.executionIntent;
      const executionIntent = reconcileExecutionIntent(scopedIntent, result.previews);
      const allowed = executionIntent?.source === "organize" ? executionIntent.allowedPreviewIds : null;
      return {
      previews: result.previews,
      displayPreviews,
      previewNameOverrides: {},
      previewScope: scope,
      previewTotal: result.total,
      previewLimit: result.limit,
      previewOffset: result.offset,
      previewTruncated: result.truncated,
      previewHasMore: result.hasMore,
      previewActionCount: previewActionCount(displayPreviews),
      executionIntent,
      selectedOperationIds: allowed
        ? new Set([...state.selectedOperationIds].filter((id) => allowed.has(id)))
        : defaultSelectedPreviewIds(result.previews)
      };
    });
  },
  refreshPreviewsForScope: async (scope) => {
    const result = await tauriApi.getOperationPreviewsForScope(scope);
    get().setPreviewResult(result, scope);
    return result;
  },
  refreshPreviewsForFiles: async (scope, fileIds) => {
    const requestId = get().previewRequestId + 1;
    set({
      previewRequestId: requestId,
      previews: [],
      displayPreviews: [],
      previewNameOverrides: {},
      previewTotal: 0,
      previewHasMore: false,
      previewTruncated: false
    });
    const matched = new Map<string, OperationPreview>();
    const scannedPreviewIds = new Set<string>();
    const matchedFileIds = new Set<string>();
    const limit = Math.min(500, Math.max(100, fileIds.size));
    let offset = 0;
    let pages = 0;
    let scannedEntries = 0;
    const maxPages = 24;
    const maxEntries = 12_000;
    type PreviewScanStopReason = "all-targets-found" | "backend-complete" | "empty-page" | "repeated-page" | "offset-stalled" | "page-limit" | "entry-limit";
    let stopReason: PreviewScanStopReason | null = fileIds.size === 0 ? "all-targets-found" : null;
    while (!stopReason) {
      if (pages >= maxPages) {
        stopReason = "page-limit";
        break;
      }
      if (scannedEntries >= maxEntries) {
        stopReason = "entry-limit";
        break;
      }
      const page = await tauriApi.getOperationPreviewsForScope(scope, undefined, limit, offset);
      if (get().previewRequestId !== requestId) return null;
      if (!page.previews.length) {
        stopReason = "empty-page";
        break;
      }
      let newPreviewIds = 0;
      for (const preview of page.previews) {
        if (!scannedPreviewIds.has(preview.id)) {
          scannedPreviewIds.add(preview.id);
          newPreviewIds += 1;
        }
        const fileId = preview.fileId || preview.file_id || "";
        if (fileIds.has(fileId) && !matched.has(preview.id)) {
          matched.set(preview.id, preview);
          matchedFileIds.add(fileId);
        }
      }
      pages += 1;
      scannedEntries += page.previews.length;
      if (matchedFileIds.size >= fileIds.size) {
        stopReason = "all-targets-found";
        break;
      }
      if (!page.hasMore) {
        stopReason = "backend-complete";
        break;
      }
      if (newPreviewIds === 0) {
        stopReason = "repeated-page";
        break;
      }
      if (scannedEntries >= maxEntries) {
        stopReason = "entry-limit";
        break;
      }
      if (pages >= maxPages) {
        stopReason = "page-limit";
        break;
      }
      const authoritativeNextOffset = (page as OperationPreviewResult & { nextOffset?: number }).nextOffset;
      const nextOffset = authoritativeNextOffset ?? page.offset + page.previews.length;
      if (!Number.isFinite(nextOffset) || nextOffset <= offset) {
        stopReason = "offset-stalled";
        break;
      }
      offset = nextOffset;
    }
    if (get().previewRequestId !== requestId) return null;
    const previews = [...matched.values()];
    const truncated = matchedFileIds.size < fileIds.size
      && (stopReason === "repeated-page" || stopReason === "offset-stalled" || stopReason === "page-limit" || stopReason === "entry-limit");
    const result: OperationPreviewResult = { previews, total: previews.length, limit, offset: 0, truncated, hasMore: false };
    get().setPreviewResult(result, scope);
    return result;
  },
  loadMorePreviews: async () => {
    const state = get();
    if (!state.previewScope || !state.previewHasMore) return;

    const limit = state.previewLimit || 1000;
    const offset = state.previewOffset + state.previews.length;
    try {
      const result = await tauriApi.getOperationPreviewsForScope(
        state.previewScope,
        undefined,
        limit,
        offset
      );
      set((current) => {
        const seen = new Set(current.previews.map((preview) => preview.id));
        const appended = result.previews.filter((preview) => !seen.has(preview.id));
        const previews = [...current.previews, ...appended];
        const selectedOperationIds = new Set(current.selectedOperationIds);
        for (const id of defaultSelectedPreviewIds(appended)) {
          selectedOperationIds.add(id);
        }
        const displayPreviews = applyOverrides(previews, current.previewNameOverrides);
        return {
          previews,
          displayPreviews,
          selectedOperationIds,
          previewTotal: result.total,
          previewLimit: result.limit,
          previewTruncated: result.truncated,
          previewHasMore: result.hasMore,
          previewActionCount: previewActionCount(displayPreviews)
        };
      });
    } catch (error) {
      useAppStore.getState().showError(readableError(error));
      throw error;
    }
  },
  setSelectedOperationIds: (ids) => set((state) => {
    const allowed = state.executionIntent?.source === "organize" ? state.executionIntent.allowedPreviewIds : null;
    return { selectedOperationIds: allowed ? new Set([...ids].filter((id) => allowed.has(id))) : ids };
  }),
  startOrganizePreviewSession: (scopeKey, allowedPreviewIds) => set({
    executionIntent: { source: "organize", scopeKey, allowedPreviewIds: new Set(allowedPreviewIds), initialAllowedCount: allowedPreviewIds.size, sessionId: localId("organize-preview") },
    selectedOperationIds: new Set(allowedPreviewIds),
    lastExecutionLogs: [],
    executionError: ""
  }),
  clearExecutionIntent: () => set({ executionIntent: null, selectedOperationIds: new Set(), lastExecutionLogs: [], executionError: "" }),
  runDispatch: (confirmed) => runDispatch({ get, set }, confirmed),
  executeSelected: (confirmed) => executeSelected({ get, set }, confirmed),
  prepareOperationRestoreIntent: (selectedIds) => prepareOperationRestoreIntent({ get, set }, selectedIds),
  prepareCleanupRestoreIntent: (items) => prepareCleanupRestoreIntent({ get, set }, items),
  confirmOperationRestore: (sessionId) => confirmOperationRestore({ get, set }, sessionId),
  confirmCleanupRestore: (sessionId) => confirmCleanupRestore({ get, set }, sessionId),
  invalidateRestoreIntent: () => set({ restoreIntent: null }),
  cancelOperations: () => cancelOperations({ get, set }),
  cancelCleanupRestore: () => cancelCleanupRestore({ get, set }),
  onRenamePreview: (id, name) => {
    if (get().previewNameOverrides[id] === name) return;
    set((state) => {
      const preview = state.previews.find((item) => item.id === id);
      if (!preview) return {};
      if (state.executionIntent?.source === "organize" && validateOrganizeFileNameForOriginal(preview.old_name, name) === null) {
        useOrganizeDecisionStore.getState().setEditedNameForPreview(state.executionIntent.scopeKey, preview, name);
      }
      const previewNameOverrides = { ...state.previewNameOverrides, [id]: name };
      const displayPreviews = applyOverrides(state.previews, previewNameOverrides);
      return {
        previewNameOverrides,
        displayPreviews,
        previewActionCount: previewActionCount(displayPreviews)
      };
    });
  }
}));
