import { tauriApi } from "../../api/tauriApi";
import { makeTranslator } from "../../i18n";
import type { OperationLog, OperationPreview, RuleExecutionSummary } from "../../types/domain";
import { applyPreviewNameOverride, localizedStableError, readableError } from "../../utils/viewHelpers";
import { useAppStore } from "../useAppStore";
import { useFileLibraryStore } from "../useFileLibraryStore";
import { resolveLegacyLibraryScope } from "../useFileLibraryV2Store";
import { useRulesStore } from "../useRulesStore";
import {
  requiresExplicitMaterialization,
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
  let { operations } = resolveExecutableSelectedPreviews(
    displayPreviews,
    selectedOperationIds,
    executionIntent
  );
  if (!operations.length) return [];

  const materializationTargets = operations.filter(requiresExplicitMaterialization);

  set({
    activeOperationKind: materializationTargets.length ? "materialize" : "execute",
    lastExecutionLogs: [],
    executionError: "",
    isOperationCanceling: false,
    operationProgress: {
      kind: materializationTargets.length ? "materialize" : "execute",
      batchId: "",
      processed: 0,
      total: materializationTargets.length || operations.length,
      currentPath: operations[0]?.source_path ?? ""
    }
  });

  try {
    const initialCanonicalById = new Map(get().previews.map((preview) => [preview.id, preview]));
    const nameOverrides = get().previewNameOverrides;
    const materializedFingerprints = new Map<string, string>();
    for (const [index, preview] of materializationTargets.entries()) {
      set({
        operationProgress: {
          kind: "materialize",
          batchId: preview.id,
          processed: index,
          total: materializationTargets.length,
          currentPath: preview.source_path
        }
      });
      const materialized = await tauriApi.materializeProviderPreview(preview);
      if (materialized.previewId !== preview.id || materialized.fileId !== preview.fileId) {
        throw new Error("The authoritative preview changed during materialization; refresh it before executing.");
      }
      const nextFingerprint = materialized.nextOperationFingerprint;
      if (!nextFingerprint) {
        throw new Error("The authoritative preview did not return a post-materialization fingerprint.");
      }
      materializedFingerprints.set(preview.id, nextFingerprint);
    }
    if (materializationTargets.length) {
      const previewScope = get().previewScope;
      const previewSelection = get().previewSelection;
      let freshPreviews: OperationPreview[];
      if (previewScope) {
        if (previewSelection) {
          await get().refreshPreviewsForSelection(previewScope, previewSelection);
        } else {
          await get().refreshPreviewsForScope(previewScope);
        }
        freshPreviews = get().previews;
      } else {
        freshPreviews = await tauriApi.getOperationPreviewsByFileIds(
          operations.map((operation) => operation.fileId)
        );
      }

      const freshById = new Map(freshPreviews.map((preview) => [preview.id, preview]));
      for (const original of operations) {
        const fresh = freshById.get(original.id);
        const baseline = initialCanonicalById.get(original.id) ?? original;
        if (!fresh
          || fresh.fileId !== baseline.fileId
          || fresh.source_path !== baseline.source_path
          || fresh.target_path !== baseline.target_path
          || fresh.operation_type !== baseline.operation_type
          || fresh.conflict_policy !== baseline.conflict_policy
          || fresh.providerIdentityFingerprint !== baseline.providerIdentityFingerprint
          || (materializedFingerprints.has(original.id)
            && fresh.operationFingerprint !== materializedFingerprints.get(original.id))) {
          throw new Error("The authoritative preview changed during materialization; refresh it before executing.");
        }
      }

      const freshDisplayPreviews = freshPreviews.map((preview) =>
        applyPreviewNameOverride(preview, nameOverrides[preview.id])
      );
      const refreshedSelection = resolveExecutableSelectedPreviews(
        freshDisplayPreviews,
        selectedOperationIds,
        executionIntent
      );
      const originalIds = new Set(operations.map((operation) => operation.id));
      const refreshedIds = new Set(refreshedSelection.operations.map((operation) => operation.id));
      if (refreshedSelection.operations.length !== operations.length
        || [...originalIds].some((id) => !refreshedIds.has(id))) {
        throw new Error("The authoritative preview is no longer executable; refresh it before executing.");
      }
      operations = refreshedSelection.operations;
      if (previewScope) {
        const validOverrides = Object.fromEntries(
          Object.entries(nameOverrides).filter(([id]) => freshById.has(id))
        );
        set({
          previewNameOverrides: validOverrides,
          displayPreviews: freshDisplayPreviews
        });
      }
      set({
        activeOperationKind: "execute",
        operationProgress: {
          kind: "execute",
          batchId: "",
          processed: 0,
          total: operations.length,
          currentPath: operations[0]?.source_path ?? ""
        }
      });
    }
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
    const message = /operation_preview_stale|authoritative preview/i.test(technicalMessage)
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
