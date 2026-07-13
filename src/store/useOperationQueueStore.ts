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
import { applyPreviewNameOverride, createOperationPreviews, readableError } from "../utils/viewHelpers";
import { useAppStore } from "./useAppStore";
import { useFileLibraryStore } from "./useFileLibraryStore";
import { useRulesStore } from "./useRulesStore";
import { useOrganizeDecisionStore } from "./useOrganizeDecisionStore";
import { organizeScopeKey, validateOrganizeFileName } from "../views/organize/organizeModel";
import {
  createRestoreExecutionIntent,
  resolveCleanupRestoreSelection,
  resolveOperationRestoreSelection,
  resolveRestoreExecutionIds,
  restoreIntentMatchesResolution,
  type RestoreExecutionIntent,
  type RestoreResultSummary
} from "../views/history/historyModel";

export const MAX_LOGS = 500;

export type PreviewExecutionIntent =
  | { source: "organize"; scopeKey: string; allowedPreviewIds: Set<string>; initialAllowedCount: number; sessionId: string }
  | { source: "general" }
  | null;

export type RestoreConfirmationOutcome<T> =
  | { status: "executed"; value: T }
  | { status: "stale"; intent: RestoreExecutionIntent }
  | { status: "rejected"; message: string };

export function previewsForExecutionIntent(previews: readonly OperationPreview[], intent: PreviewExecutionIntent) {
  return intent?.source === "organize"
    ? previews.filter((preview) => intent.allowedPreviewIds.has(preview.id))
    : [...previews];
}

export function isPreviewBackendApproved(preview: OperationPreview): boolean {
  return preview.status === "pending" && preview.is_executable !== false && !preview.blocking_reason;
}

export type PreviewExclusionReason = "invalidName" | "blocked" | "outsideWhitelist" | "unavailable";

export type PreviewEligibility =
  | { executable: true; reason: null }
  | { executable: false; reason: PreviewExclusionReason };

export function resolvePreviewEligibility(
  preview: OperationPreview,
  intent: PreviewExecutionIntent
): PreviewEligibility {
  if (intent?.source === "organize" && !intent.allowedPreviewIds.has(preview.id)) {
    return { executable: false, reason: "outsideWhitelist" };
  }
  if (preview.status !== "pending") {
    return { executable: false, reason: "unavailable" };
  }
  if (preview.is_executable === false || Boolean(preview.blocking_reason)) {
    return { executable: false, reason: "blocked" };
  }
  if (preview.operation_type !== "move_to_trash" && validateOrganizeFileName(preview.new_name) !== null) {
    return { executable: false, reason: "invalidName" };
  }
  return { executable: true, reason: null };
}

export function isPreviewExecutable(preview: OperationPreview): boolean {
  return resolvePreviewEligibility(preview, null).executable;
}

export function selectionForPreviewGroup(current: Set<string>, previews: readonly OperationPreview[], select: boolean, intent: PreviewExecutionIntent) {
  const next = new Set(current);
  for (const preview of previewsForExecutionIntent(previews, intent)) {
    if (select) {
      if (resolvePreviewEligibility(preview, intent).executable) next.add(preview.id);
    } else {
      next.delete(preview.id);
    }
  }
  return next;
}

export interface ExecutablePreviewSelection {
  operations: OperationPreview[];
  selectedCount: number;
  excludedCount: number;
  outsideWhitelistCount: number;
  blockedCount: number;
  invalidNameCount: number;
  unavailableCount: number;
}

export function resolveExecutableSelectedPreviews(
  previews: readonly OperationPreview[],
  selectedIds: ReadonlySet<string>,
  intent: PreviewExecutionIntent
): ExecutablePreviewSelection {
  const selectedPreviews: OperationPreview[] = [];
  const presentIds = new Set<string>();
  for (const preview of previews) {
    if (!selectedIds.has(preview.id) || presentIds.has(preview.id)) continue;
    selectedPreviews.push(preview);
    presentIds.add(preview.id);
  }
  const operations: OperationPreview[] = [];
  let outsideWhitelistCount = 0;
  let blockedCount = 0;
  let invalidNameCount = 0;
  let unavailableCount = 0;

  for (const preview of selectedPreviews) {
    const eligibility = resolvePreviewEligibility(preview, intent);
    if (eligibility.executable) {
      operations.push(preview);
    } else if (eligibility.reason === "outsideWhitelist") {
      outsideWhitelistCount += 1;
    } else if (eligibility.reason === "unavailable") {
      unavailableCount += 1;
    } else if (eligibility.reason === "blocked") {
      blockedCount += 1;
    } else {
      invalidNameCount += 1;
    }
  }
  unavailableCount += [...selectedIds].filter((id) => !presentIds.has(id)).length;
  const excludedCount = outsideWhitelistCount + blockedCount + invalidNameCount + unavailableCount;
  return {
    operations,
    selectedCount: selectedIds.size,
    excludedCount,
    outsideWhitelistCount,
    blockedCount,
    invalidNameCount,
    unavailableCount
  };
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

function currentT() {
  return makeTranslator(useAppStore.getState().language);
}

function createRestoreSessionId(source: "operation_logs" | "cleanup_trash") {
  const suffix = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `restore-${source}-${Date.now()}-${suffix}`;
}

function localizedRestoreError(error: unknown, t: ReturnType<typeof currentT>) {
  const technical = readableError(error);
  const normalized = technical.toLocaleLowerCase();
  let message = t("restoreErrorGeneric");
  if (normalized.includes("target file already exists") || normalized.includes("original path already exists") || normalized.includes("already exists") || normalized.includes("原路径已有文件")) {
    message = t("restoreErrorTargetExists");
  } else if (normalized.includes("source file does not exist") || normalized.includes("safe trash path is missing") || normalized.includes("not found") || normalized.includes("不存在") || normalized.includes("缺失")) {
    message = t("restoreErrorSourceMissing");
  } else if (normalized.includes("permission") || normalized.includes("access denied") || normalized.includes("权限")) {
    message = t("restoreErrorPermission");
  } else if (normalized.includes("in use") || normalized.includes("occupied") || normalized.includes("被占用")) {
    message = t("restoreErrorOccupied");
  } else if (normalized.includes("no longer restorable") || normalized.includes("blocked") || normalized.includes("阻止")) {
    message = t("restoreErrorBlocked");
  } else if (normalized.includes("already been restored") || normalized.includes("already restored") || normalized.includes("已经恢复")) {
    message = t("restoreErrorAlreadyRestored");
  } else if (normalized.includes("still being processed") || normalized.includes("processing") || normalized.includes("处理中")) {
    message = t("restoreErrorProcessing");
  } else if (normalized.includes("canceled") || normalized.includes("cancelled") || normalized.includes("取消")) {
    message = t("restoreErrorCanceled");
  }
  return { message, technical };
}

function summarizeOperationRestore(logs: readonly OperationLog[], excluded: number): RestoreResultSummary {
  return {
    requested: logs.length + excluded,
    restored: logs.filter((log) => log.restore_status === "restored").length,
    failed: logs.filter((log) => log.restore_status === "failed").length,
    skipped: logs.filter((log) => log.status === "skipped").length,
    canceled: logs.filter((log) => log.restore_status === "canceled").length,
    conflicts: 0,
    missing: logs.filter((log) => log.restore_status === "unavailable" && /missing|缺失/i.test(log.restore_error ?? "")).length,
    excluded
  };
}

function summarizeCleanupRestore(result: CleanupRestoreResult, excluded: number): RestoreResultSummary {
  return {
    requested: result.restored + result.conflicts + result.missing + result.failed + result.canceled + excluded,
    restored: result.restored,
    failed: result.failed,
    skipped: 0,
    canceled: result.canceled,
    conflicts: result.conflicts,
    missing: result.missing,
    excluded
  };
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

export function operationNeedsCleanupConfirmation(preview: OperationPreview): boolean {
  return preview.operation_type === "move_to_trash"
    || preview.is_duplicate === true
    || preview.suggested_action === "DeleteCandidate"
    || preview.suggested_action === "Review"
    || preview.requires_confirmation
    || preview.risk_level === "Sensitive"
    || preview.risk_level === "System"
    || preview.confidence < 0.7
    || preview.will_create_parent === true;
}

export type OperationConfirmationTone = "default" | "warning" | "danger";

export function operationConfirmationTone(previews: readonly OperationPreview[]): OperationConfirmationTone {
  if (previews.some((preview) => preview.operation_type === "move_to_trash")) return "danger";
  if (previews.some(operationNeedsCleanupConfirmation)) return "warning";
  return "default";
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
    const { operations } = resolveExecutableSelectedPreviews(displayPreviews, selectedOperationIds, executionIntent);
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
  prepareOperationRestoreIntent: async (selectedIds) => {
    const t = currentT();
    const requestedIds = [...new Set(selectedIds instanceof Set ? [...selectedIds] : selectedIds)];
    if (!requestedIds.length) return null;
    try {
      const authoritativeLogs = await get().refreshOperationLogs();
      const resolution = resolveOperationRestoreSelection(authoritativeLogs, requestedIds);
      const intent = createRestoreExecutionIntent(
        "operation_logs",
        resolution,
        createRestoreSessionId("operation_logs")
      );
      set({
        restoreIntent: intent,
        restoreError: resolution.executableCount ? "" : t("restoreNoExecutableSelected"),
        restoreTechnicalError: "",
        lastRestoreResult: [],
        lastRestoreSummary: null,
        cleanupRestoreResult: null,
        cleanupRestoreError: ""
      });
      return resolution.executableCount ? intent : null;
    } catch (error) {
      const copy = localizedRestoreError(error, t);
      set({ restoreError: copy.message, restoreTechnicalError: copy.technical });
      useAppStore.getState().showError(copy.message);
      return null;
    }
  },
  prepareCleanupRestoreIntent: async (items) => {
    const t = currentT();
    const selectedIds = [...new Set(items.map((item) => item.id))];
    if (!selectedIds.length) return null;
    try {
      const batchIds = [...new Set(items.map((item) => item.batchId).filter(Boolean))];
      const previews = (await Promise.all(batchIds.map((batchId) => tauriApi.previewRestoreCleanupTrash(batchId))))
        .flatMap((preview) => preview.items);
      const resolution = resolveCleanupRestoreSelection(previews, selectedIds);
      const intent = {
        ...createRestoreExecutionIntent(
          "cleanup_trash",
          resolution,
          createRestoreSessionId("cleanup_trash")
        ),
        batchIds: new Set(batchIds)
      } satisfies RestoreExecutionIntent;
      set({
        restoreIntent: intent,
        restoreError: resolution.executableCount ? "" : t("restoreNoExecutableSelected"),
        restoreTechnicalError: "",
        lastRestoreResult: [],
        lastRestoreSummary: null,
        cleanupRestoreResult: null,
        cleanupRestoreError: ""
      });
      return resolution.executableCount ? intent : null;
    } catch (error) {
      const copy = localizedRestoreError(error, t);
      set({ cleanupRestoreError: copy.message, restoreTechnicalError: copy.technical });
      useAppStore.getState().showError(copy.message);
      return null;
    }
  },
  confirmOperationRestore: async (sessionId) => {
    const t = currentT();
    const intent = get().restoreIntent;
    if (!intent || intent.source !== "operation_logs" || intent.sessionId !== sessionId) {
      const message = t("historyRestoreSessionExpired");
      set({ restoreError: message, restoreTechnicalError: "" });
      return { status: "rejected", message };
    }

    let authoritativeLogs: OperationLog[];
    try {
      authoritativeLogs = await get().refreshOperationLogs();
    } catch (error) {
      const copy = localizedRestoreError(error, t);
      set({ restoreError: copy.message, restoreTechnicalError: copy.technical });
      useAppStore.getState().showError(copy.message);
      return { status: "rejected", message: copy.message };
    }

    const resolution = resolveOperationRestoreSelection(authoritativeLogs, intent.selectedIds);
    if (!restoreIntentMatchesResolution(intent, resolution)) {
      const nextIntent = createRestoreExecutionIntent(
        "operation_logs",
        resolution,
        createRestoreSessionId("operation_logs"),
        Date.now(),
        intent.revision + 1
      );
      set({ restoreIntent: nextIntent, restoreError: t("historyRestoreEligibilityChanged"), restoreTechnicalError: "" });
      return { status: "stale", intent: nextIntent };
    }

    const actualIds = resolveRestoreExecutionIds(intent.selectedIds, intent, resolution.executableIds);
    const logsById = new Map(resolution.executable.map((log) => [log.id, log]));
    const logs = actualIds.map((id) => logsById.get(id)).filter((log): log is OperationLog => Boolean(log));
    if (!logs.length) {
      const message = t("restoreNoExecutableSelected");
      set({ restoreError: message });
      return { status: "rejected", message };
    }

    set({
      activeOperationKind: "restore",
      isOperationCanceling: false,
      restoreError: "",
      restoreTechnicalError: "",
      lastRestoreResult: [],
      lastRestoreSummary: null,
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
      const summary = summarizeOperationRestore(result.logs, intent.excludedCount);
      set((state) => ({
        operationLogs: state.operationLogs.map((log) => updatedById.get(log.id) ?? log),
        lastRestoreResult: result.logs,
        lastRestoreSummary: summary,
        restoreIntent: null,
        restoreError: "",
        restoreTechnicalError: ""
      }));
      await useFileLibraryStore.getState().refresh(useAppStore.getState().searchQuery).catch(() => undefined);
      const previewScope = get().previewScope;
      if (previewScope) await get().refreshPreviewsForScope(previewScope).catch(() => undefined);
      if (summary.failed > 0) {
        useAppStore.getState().showError(`${t("historyRestoreFailed")}: ${summary.failed.toLocaleString()}`);
      } else if (summary.canceled > 0 && summary.restored === 0) {
        useAppStore.getState().showSuccess(t("operationCanceled"));
      } else {
        useAppStore.getState().showSuccess(`${t("restored")}: ${summary.restored.toLocaleString()}`);
      }
      return { status: "executed", value: result.logs };
    } catch (error) {
      const copy = localizedRestoreError(error, t);
      set({ restoreError: copy.message, restoreTechnicalError: copy.technical });
      useAppStore.getState().showError(copy.message);
      return { status: "rejected", message: copy.message };
    } finally {
      set({
        activeOperationKind: null,
        isOperationCanceling: false,
        operationProgress: null
      });
    }
  },
  confirmCleanupRestore: async (sessionId) => {
    const t = currentT();
    const intent = get().restoreIntent;
    if (!intent || intent.source !== "cleanup_trash" || intent.sessionId !== sessionId) {
      const message = t("historyRestoreSessionExpired");
      set({ cleanupRestoreError: message, restoreTechnicalError: "" });
      return { status: "rejected", message };
    }
    try {
      const batchIds = [...(intent.batchIds ?? [])];
      const previews = (await Promise.all(batchIds.map((batchId) => tauriApi.previewRestoreCleanupTrash(batchId))))
        .flatMap((preview) => preview.items);
      const resolution = resolveCleanupRestoreSelection(previews, intent.selectedIds);
      if (!restoreIntentMatchesResolution(intent, resolution)) {
        const nextIntent = {
          ...createRestoreExecutionIntent(
            "cleanup_trash",
            resolution,
            createRestoreSessionId("cleanup_trash"),
            Date.now(),
            intent.revision + 1
          ),
          batchIds: new Set(batchIds)
        } satisfies RestoreExecutionIntent;
        set({ restoreIntent: nextIntent, cleanupRestoreError: t("historyRestoreEligibilityChanged"), restoreTechnicalError: "" });
        return { status: "stale", intent: nextIntent };
      }

      const actualIds = resolveRestoreExecutionIds(intent.selectedIds, intent, resolution.executableIds);
      if (!actualIds.length) {
        const message = t("restoreNoExecutableSelected");
        set({ cleanupRestoreError: message });
        return { status: "rejected", message };
      }

      const jobId = createRestoreSessionId("cleanup_trash");
      set({
        cleanupRestoreJobId: jobId,
        cleanupRestoreProgress: {
          jobId,
          processed: 0,
          total: actualIds.length,
          currentItemId: actualIds[0] ?? null,
          currentPath: null,
          restored: 0,
          conflicts: 0,
          missing: 0,
          failed: 0,
          canceled: 0,
          cancelRequested: false
        },
        cleanupRestoreResult: null,
        cleanupRestoreError: "",
        restoreTechnicalError: ""
      });

      let unlisten: UnlistenFn | undefined;
      try {
        const listen = (tauriApi as typeof tauriApi & {
          onCleanupRestoreProgress?: (handler: (payload: CleanupRestoreProgressPayload, event: unknown) => void) => Promise<UnlistenFn>;
        }).onCleanupRestoreProgress;
        if (typeof listen === "function") {
          unlisten = await listen((payload) => {
            if (get().cleanupRestoreJobId === payload.jobId) set({ cleanupRestoreProgress: payload });
          });
        }
        const result = await tauriApi.restoreCleanupTrashItems(actualIds, jobId);
        const summary = summarizeCleanupRestore(result, intent.excludedCount);
        set({
          cleanupRestoreResult: result,
          lastRestoreSummary: summary,
          restoreIntent: null,
          cleanupRestoreError: "",
          restoreTechnicalError: ""
        });
        await useFileLibraryStore.getState().refresh(useAppStore.getState().searchQuery).catch(() => undefined);
        await get().refreshOperationLogs().catch(() => undefined);
        const previewScope = get().previewScope;
        if (previewScope) await get().refreshPreviewsForScope(previewScope).catch(() => undefined);
        if (result.failed > 0) {
          useAppStore.getState().showError(`${t("historyRestoreFailed")}: ${result.failed.toLocaleString()}`);
        } else if (result.canceled > 0 && result.restored === 0) {
          useAppStore.getState().showSuccess(t("historyCleanupCanceled"));
        } else {
          useAppStore.getState().showSuccess(`${t("restored")}: ${result.restored.toLocaleString()}`);
        }
        return { status: "executed", value: result };
      } catch (error) {
        const copy = localizedRestoreError(error, t);
        set({ cleanupRestoreError: copy.message, restoreTechnicalError: copy.technical });
        useAppStore.getState().showError(copy.message);
        return { status: "rejected", message: copy.message };
      } finally {
        await unlisten?.();
        set({ cleanupRestoreProgress: null, cleanupRestoreJobId: null });
      }
    } catch (error) {
      const copy = localizedRestoreError(error, t);
      set({ cleanupRestoreError: copy.message, restoreTechnicalError: copy.technical });
      useAppStore.getState().showError(copy.message);
      return { status: "rejected", message: copy.message };
    }
  },
  invalidateRestoreIntent: () => set({ restoreIntent: null }),
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
  cancelCleanupRestore: async () => {
    const jobId = get().cleanupRestoreJobId;
    if (!jobId) return;
    set((state) => ({
      cleanupRestoreProgress: state.cleanupRestoreProgress
        ? { ...state.cleanupRestoreProgress, cancelRequested: true }
        : state.cleanupRestoreProgress
    }));
    try {
      await tauriApi.cancelCleanupRestore(jobId);
    } catch (error) {
      const copy = localizedRestoreError(error, currentT());
      set({ cleanupRestoreError: copy.message, restoreTechnicalError: copy.technical, cleanupRestoreProgress: get().cleanupRestoreProgress ? { ...get().cleanupRestoreProgress!, cancelRequested: false } : null });
      useAppStore.getState().showError(copy.message);
    }
  },
  onRenamePreview: (id, name) => {
    if (get().previewNameOverrides[id] === name) return;
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
