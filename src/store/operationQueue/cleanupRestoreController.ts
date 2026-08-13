import type { UnlistenFn } from "@tauri-apps/api/event";
import { tauriApi } from "../../api/tauriApi";
import type {
  CleanupRestoreProgressPayload,
  CleanupRestorePreviewItem,
  CleanupRestoreResult,
  CleanupTrashItem
} from "../../types/domain";
import {
  createRestoreExecutionIntent,
  resolveCleanupRestoreSelection,
  resolveRestoreExecutionIds,
  restoreIntentMatchesResolution,
  type CleanupPreviewAuthority,
  type RestoreExecutionIntent
} from "../../views/history/historyModel";
import type { RestoreConfirmationOutcome } from "../useOperationQueueStore";
import { useAppStore } from "../useAppStore";
import type { OperationQueueControllerContext } from "./controllerTypes";
import {
  createRestoreSessionId,
  currentT,
  localizedRestoreError,
  summarizeCleanupRestore
} from "./restoreIntentResolver";

export async function prepareCleanupRestoreIntent(
  { set }: OperationQueueControllerContext,
  items: readonly CleanupTrashItem[]
): Promise<RestoreExecutionIntent | null> {
  const t = currentT();
  const selectedIds = [...new Set(items.map((item) => item.id))];
  if (!selectedIds.length) return null;
  try {
    const batchIds = [...new Set(items.map((item) => item.batchId).filter(Boolean))];
    const previews = await Promise.all(batchIds.map((batchId) => tauriApi.previewRestoreCleanupTrash(batchId)));
    const authorities = new Map<string, CleanupPreviewAuthority>();
    for (const preview of previews) {
      for (const item of preview.items) authorities.set(item.id, { state: "ready", preview: item });
    }
    const resolution = resolveCleanupRestoreSelection(items, selectedIds, authorities);
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
}

export async function confirmCleanupRestore(
  { get, set }: OperationQueueControllerContext,
  sessionId: string
): Promise<RestoreConfirmationOutcome<CleanupRestoreResult>> {
  const t = currentT();
  const intent = get().restoreIntent;
  if (!intent || intent.source !== "cleanup_trash" || intent.sessionId !== sessionId) {
    const message = t("historyRestoreSessionExpired");
    set({ cleanupRestoreError: message, restoreTechnicalError: "" });
    return { status: "rejected", message };
  }
  try {
    const batchIds = [...(intent.batchIds ?? [])];
    const previews = await Promise.all(batchIds.map((batchId) => tauriApi.previewRestoreCleanupTrash(batchId)));
    const authorities = new Map<string, CleanupPreviewAuthority>();
    for (const preview of previews) {
      for (const item of preview.items) authorities.set(item.id, { state: "ready", preview: item });
    }
    const authoritativeItems = [...intent.selectedIds]
      .map((id) => authorities.get(id)?.preview)
      .filter((item): item is CleanupRestorePreviewItem => Boolean(item));
    const resolution = resolveCleanupRestoreSelection(authoritativeItems, intent.selectedIds, authorities);
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
      await import("../useFileLibraryStore").then(({ useFileLibraryStore }) =>
        useFileLibraryStore.getState().refresh(useAppStore.getState().searchQuery).catch(() => undefined)
      );
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
}

export async function cancelCleanupRestore({ get, set }: OperationQueueControllerContext): Promise<void> {
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
    set({
      cleanupRestoreError: copy.message,
      restoreTechnicalError: copy.technical,
      cleanupRestoreProgress: get().cleanupRestoreProgress
        ? { ...get().cleanupRestoreProgress!, cancelRequested: false }
        : null
    });
    useAppStore.getState().showError(copy.message);
  }
}
