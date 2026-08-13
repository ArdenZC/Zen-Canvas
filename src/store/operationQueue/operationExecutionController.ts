import { tauriApi } from "../../api/tauriApi";
import { makeTranslator } from "../../i18n";
import type { OperationLog, OperationPreview, RuleExecutionSummary } from "../../types/domain";
import { localizedStableError, readableError } from "../../utils/viewHelpers";
import { useAppStore } from "../useAppStore";
import { useFileLibraryStore } from "../useFileLibraryStore";
import { resolveLegacyLibraryScope } from "../useFileLibraryV2Store";
import { useRulesStore } from "../useRulesStore";
import {
  resolveExecutableSelectedPreviews,
  type PreviewExecutionIntent
} from "./selectors";
import type { OperationQueueControllerContext } from "./controllerTypes";

export async function runDispatch(
  { get }: OperationQueueControllerContext,
  confirmed: boolean
): Promise<RuleExecutionSummary> {
  const t = makeTranslator(useAppStore.getState().language);
  if (!confirmed) {
    return { scanned: 0, updated: 0, skipped: 0, needsConfirmation: 0 };
  }
  try {
    const scope = useFileLibraryStore.getState().scope;
    const durableScope = await resolveLegacyLibraryScope(scope);
    const { summary } = await tauriApi.executeRulesForScopeV2(
      durableScope,
      useRulesStore.getState().catalogRevision,
      "inbox_only",
      true
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
}

export async function executeSelected(
  { get, set }: OperationQueueControllerContext,
  confirmed: boolean
): Promise<OperationLog[]> {
  const t = makeTranslator(useAppStore.getState().language);
  if (!confirmed) return [];
  const { displayPreviews, selectedOperationIds, executionIntent } = get();
  const { operations } = resolveExecutableSelectedPreviews(
    displayPreviews,
    selectedOperationIds,
    executionIntent
  );
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
      operationLogs: [...result.logs, ...state.operationLogs].slice(0, 500),
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
      useAppStore.getState().showSuccess(
        `${t("success")}: ${succeeded.toLocaleString()}${skipped ? ` (${t("skipped")}: ${skipped.toLocaleString()})` : ""}`
      );
    }
    return result.logs;
  } catch (error) {
    const technicalMessage = readableError(error);
    const message = /authoritative preview/i.test(technicalMessage)
      ? t("organizePreviewInvalidated")
      : localizedStableError(error, t);
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
}

export type { PreviewExecutionIntent };
