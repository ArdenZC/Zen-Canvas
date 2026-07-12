import { create } from "zustand";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { tauriApi, type OperationProgressPayload } from "../api/tauriApi";
import { makeTranslator } from "../i18n";
import type { FileRecord, LibraryScope, OperationLog, OperationPreview, OperationPreviewResult, RuleExecutionSummary } from "../types/domain";
import { applyPreviewNameOverride, createOperationPreviews, readableError } from "../utils/viewHelpers";
import { useAppStore } from "./useAppStore";
import { useFileLibraryStore } from "./useFileLibraryStore";
import { useRulesStore } from "./useRulesStore";
import { useOrganizeDecisionStore } from "./useOrganizeDecisionStore";
import { organizeScopeKey, validateOrganizeFileName } from "../views/organize/organizeModel";

export const MAX_LOGS = 500;

export type PreviewExecutionIntent =
  | { source: "organize"; scopeKey: string; allowedPreviewIds: Set<string>; initialAllowedCount: number; sessionId: string }
  | { source: "general" }
  | null;

export function previewsForExecutionIntent(previews: readonly OperationPreview[], intent: PreviewExecutionIntent) {
  return intent?.source === "organize"
    ? previews.filter((preview) => intent.allowedPreviewIds.has(preview.id))
    : [...previews];
}

export function selectionForPreviewGroup(current: Set<string>, previews: readonly OperationPreview[], select: boolean, intent: PreviewExecutionIntent) {
  const next = new Set(current);
  for (const preview of previewsForExecutionIntent(previews, intent)) {
    if (preview.is_executable === false) continue;
    if (select) next.add(preview.id);
    else next.delete(preview.id);
  }
  return next;
}

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
  restoreOperationLogs: (logs: OperationLog[]) => Promise<void>;
  cancelOperations: () => Promise<void>;
  onRenamePreview: (id: string, name: string) => void;
}

function currentT() {
  return makeTranslator(useAppStore.getState().language);
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
      .filter((preview) => preview.selected_by_default && preview.is_executable !== false)
      .map((preview) => preview.id)
  );
}

function reconcileExecutionIntent(intent: PreviewExecutionIntent, previews: OperationPreview[]) {
  if (intent?.source !== "organize") return intent;
  const valid = new Set(previews.map((preview) => preview.id));
  return { ...intent, allowedPreviewIds: new Set([...intent.allowedPreviewIds].filter((id) => valid.has(id))) };
}

export function operationNeedsCleanupConfirmation(preview: OperationPreview): boolean {
  return preview.operation_type === "move_to_trash"
    || preview.is_duplicate === true
    || preview.suggested_action === "DeleteCandidate"
    || preview.suggested_action === "Review"
    || preview.requires_confirmation
    || preview.risk_level === "Sensitive"
    || preview.risk_level === "System";
}

export function mergeOperationLogs(persisted: OperationLog[], current: OperationLog[]): OperationLog[] {
  const seen = new Set<string>();
  const merged: OperationLog[] = [];
  for (const log of [...current, ...persisted]) {
    if (seen.has(log.id)) continue;
    seen.add(log.id);
    merged.push(log);
  }
  return merged.slice(0, MAX_LOGS);
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
  executionIntent: null,
  executionError: "",
  previewRequestId: 0,
  operationProgress: null,
  isOperationCanceling: false,
  activeOperationKind: null,
  listenersRegistered: false,
  registrationPromise: null,
  initializeOperationQueue: () => {
    if (get().listenersRegistered) return Promise.resolve();
    const registrationPromise = get().registrationPromise;
    if (registrationPromise) return registrationPromise;

    const promise = (async () => {
      try {
        await get().loadPersistedOperationLogs();
        const unlistener = await tauriApi.onOperationProgress((payload) => {
          if (get().activeOperationKind !== payload.kind) return;
          set({ operationProgress: payload });
        });
        set({ listenersRegistered: true, registrationPromise: null, unlistener });
      } catch (error) {
        set({ registrationPromise: null });
        useAppStore.getState().showError(readableError(error));
      }
    })();
    set({ registrationPromise: promise });
    return promise;
  },
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
    const limit = Math.min(500, Math.max(100, fileIds.size));
    let offset = 0;
    let hasMore = true;
    let pages = 0;
    while (hasMore && matched.size < fileIds.size && pages < 8) {
      const page = await tauriApi.getOperationPreviewsForScope(scope, undefined, limit, offset);
      if (get().previewRequestId !== requestId) return null;
      let additions = 0;
      for (const preview of page.previews) {
        const fileId = preview.fileId || preview.file_id || "";
        if (fileIds.has(fileId) && !matched.has(preview.id)) {
          matched.set(preview.id, preview);
          additions += 1;
        }
      }
      pages += 1;
      hasMore = page.hasMore;
      offset += page.previews.length;
      if (!page.previews.length || additions === 0) break;
    }
    if (get().previewRequestId !== requestId) return null;
    const previews = [...matched.values()];
    const result: OperationPreviewResult = { previews, total: previews.length, limit, offset: 0, truncated: hasMore, hasMore: false };
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
    executionIntent: { source: "organize", scopeKey, allowedPreviewIds: new Set(allowedPreviewIds), initialAllowedCount: allowedPreviewIds.size, sessionId: `${Date.now()}-${Math.random().toString(36).slice(2)}` },
    selectedOperationIds: new Set(allowedPreviewIds),
    lastExecutionLogs: [],
    executionError: ""
  }),
  clearExecutionIntent: () => set({ executionIntent: null, selectedOperationIds: new Set(), lastExecutionLogs: [], executionError: "" }),
  runDispatch: async (confirmed) => {
    const t = currentT();
    if (!confirmed) {
      return { scanned: 0, updated: 0, skipped: 0, needsConfirmation: 0 };
    }
    try {
      const scope = useFileLibraryStore.getState().scope;
      const summary = await tauriApi.executeRulesForScope(
        scope,
        useRulesStore.getState().rules,
        "inbox_only"
      );
      await useFileLibraryStore.getState().refresh(useAppStore.getState().searchQuery);
      await get().refreshPreviewsForScope(scope);
      useAppStore.getState().showSuccess(
        `${t("success")}: ${summary.updated.toLocaleString()} / ${summary.scanned.toLocaleString()} (${t("skipped")}: ${summary.skipped.toLocaleString()})`
      );
      return summary;
    } catch (error) {
      useAppStore.getState().showError(readableError(error));
      throw error;
    }
  },
  executeSelected: async (confirmed) => {
    const t = currentT();
    if (!confirmed) return [];
    const { displayPreviews, selectedOperationIds, executionIntent } = get();
    const allowed = executionIntent?.source === "organize" ? executionIntent.allowedPreviewIds : null;
    const operations = displayPreviews.filter(
      (preview) => selectedOperationIds.has(preview.id) && (!allowed || allowed.has(preview.id)) && preview.is_executable !== false
    ).filter((preview) => preview.operation_type === "move_to_trash" || validateOrganizeFileName(preview.new_name) === null);
    if (!operations.length) return [];

    set({
      activeOperationKind: "execute",
      lastExecutionLogs: [],
      executionError: "",
      isOperationCanceling: false,
      operationProgress: {
        kind: "execute",
        batchId: "",
        processed: 0,
        total: operations.length,
        currentPath: operations[0]?.source_path ?? ""
      }
    });

    try {
      const result = await tauriApi.executeMoves(operations as OperationPreview[]);
      set((state) => ({
        operationLogs: [...result.logs, ...state.operationLogs].slice(0, MAX_LOGS),
        lastExecutionLogs: result.logs,
        selectedOperationIds: new Set()
      }));
      await useFileLibraryStore.getState().refresh(useAppStore.getState().searchQuery);
      const previewScope = get().previewScope;
      if (previewScope) await get().refreshPreviewsForScope(previewScope);
      const succeeded = result.logs.filter((log) => log.status === "success").length;
      const failed = result.logs.filter((log) => log.status === "failed").length;
      const skipped = result.logs.filter((log) => log.status === "skipped").length;
      if (failed > 0) {
        useAppStore.getState().showError(`${t("failed")}: ${failed.toLocaleString()}`);
      } else if (succeeded === 0 && skipped > 0) {
        useAppStore.getState().showSuccess(t("operationCanceled"));
      } else {
        useAppStore.getState().showSuccess(`${t("success")}: ${succeeded.toLocaleString()}${skipped ? ` (${t("skipped")}: ${skipped.toLocaleString()})` : ""}`);
      }
      return result.logs;
    } catch (error) {
      const message = readableError(error);
      set({ executionError: message });
      useAppStore.getState().showError(message);
      return [];
    } finally {
      set({
        activeOperationKind: null,
        isOperationCanceling: false,
        operationProgress: null
      });
    }
  },
  restoreOperationLogs: async (logs) => {
    const t = currentT();
    if (!logs.length) return;

    set({
      activeOperationKind: "restore",
      isOperationCanceling: false,
      operationProgress: {
        kind: "restore",
        batchId: logs[0]?.batch_id ?? "",
        processed: 0,
        total: logs.length,
        currentPath: logs[0]?.path_after ?? ""
      }
    });

    try {
      const result = await tauriApi.restoreMoves(logs);
      const updatedById = new Map(result.logs.map((log) => [log.id, log]));
      set((state) => ({
        operationLogs: state.operationLogs.map((log) => updatedById.get(log.id) ?? log)
      }));
      await useFileLibraryStore.getState().refresh(useAppStore.getState().searchQuery);
      const previewScope = get().previewScope;
      if (previewScope) await get().refreshPreviewsForScope(previewScope);
      const canceled = result.logs.every((log) => log.restore_status === "canceled");
      if (result.failed > 0) {
        useAppStore.getState().showError(`${t("failed")}: ${result.failed.toLocaleString()}`);
      } else {
        useAppStore.getState().showSuccess(canceled ? t("operationCanceled") : `${t("restored")}: ${result.restored.toLocaleString()}`);
      }
    } catch (error) {
      useAppStore.getState().showError(readableError(error));
    } finally {
      set({
        activeOperationKind: null,
        isOperationCanceling: false,
        operationProgress: null
      });
    }
  },
  cancelOperations: async () => {
    if (!get().activeOperationKind) return;
    set({ isOperationCanceling: true });
    try {
      await tauriApi.cancelOperations();
    } catch (error) {
      set({ isOperationCanceling: false });
      useAppStore.getState().showError(readableError(error));
    }
  },
  onRenamePreview: (id, name) => {
    set((state) => {
      const preview = state.previews.find((item) => item.id === id);
      if (!preview) return {};
      if (state.executionIntent?.source === "organize" && validateOrganizeFileName(name) === null) {
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
