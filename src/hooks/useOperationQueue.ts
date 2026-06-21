import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tauriApi, type OperationProgressPayload } from "../api/tauriApi";
import type { FileRecord, OperationLog, OperationPreview, Rule } from "../types/domain";
import type { Translator } from "../types/ui";
import { applyPreviewNameOverride, createOperationPreviews, readableError } from "../utils/viewHelpers";

export const MAX_LOGS = 500;

export interface OperationQueueOptions {
  files: FileRecord[];
  rules: Rule[];
  t: Translator;
  onRefreshData: () => Promise<void>;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

export function useOperationQueue({
  files,
  rules,
  t,
  onRefreshData,
  onError,
  onSuccess
}: OperationQueueOptions) {
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([]);
  const [selectedOperationIds, setSelectedOperationIds] = useState<Set<string>>(new Set());
  const [previewNameOverrides, setPreviewNameOverrides] = useState<Record<string, string>>({});
  const [operationProgress, setOperationProgress] = useState<OperationProgressPayload | null>(null);
  const [isOperationCanceling, setIsOperationCanceling] = useState(false);
  const activeOperationKindRef = useRef<OperationProgressPayload["kind"] | null>(null);

  const previews = useMemo(() => createOperationPreviews(files), [files]);
  const displayPreviews = useMemo(
    () => previews.map((preview) => applyPreviewNameOverride(preview, previewNameOverrides[preview.id])),
    [previewNameOverrides, previews]
  );
  const previewActionCount = displayPreviews.filter((preview) => preview.status === "pending").length;

  useEffect(() => {
    let cancelled = false;

    async function loadPersistedOperationLogs() {
      try {
        const persistedLogs = await tauriApi.getOperationLogs(MAX_LOGS);
        if (cancelled) return;
        setOperationLogs((current) => mergeOperationLogs(persistedLogs, current));
      } catch (error) {
        if (!cancelled) onError(readableError(error));
      }
    }

    void loadPersistedOperationLogs();

    return () => {
      cancelled = true;
    };
  }, [onError]);

  useEffect(() => {
    setSelectedOperationIds(
      new Set(previews.filter((preview) => preview.selected_by_default).map((preview) => preview.id))
    );
    setPreviewNameOverrides({});
  }, [previews]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void tauriApi.onOperationProgress((payload) => {
      if (activeOperationKindRef.current !== payload.kind) return;
      setOperationProgress(payload);
    }).then((dispose) => {
      if (cancelled) dispose();
      else unlisten = dispose;
    }).catch((error) => {
      if (!cancelled) onError(readableError(error));
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [onError]);

  const runDispatch = useCallback(async () => {
    try {
      const summary = await tauriApi.executeRulesOnInbox(rules);
      await onRefreshData();
      onSuccess(
        `${t("success")}: ${summary.updated.toLocaleString()} / ${summary.scanned.toLocaleString()} (${t("skipped")}: ${summary.skipped.toLocaleString()})`
      );
      return summary;
    } catch (error) {
      onError(readableError(error));
      throw error;
    }
  }, [onError, onRefreshData, onSuccess, rules, t]);

  const executeSelected = useCallback(async () => {
    const operations = displayPreviews.filter(
      (preview) => selectedOperationIds.has(preview.id) && preview.is_executable !== false
    );
    if (!operations.length) return;
    activeOperationKindRef.current = "execute";
    setIsOperationCanceling(false);
    setOperationProgress({
      kind: "execute",
      batchId: "",
      processed: 0,
      total: operations.length,
      currentPath: operations[0]?.source_path ?? ""
    });
    try {
      const result = await tauriApi.executeMoves(operations as OperationPreview[]);
      setOperationLogs((current) => [...result.logs, ...current].slice(0, MAX_LOGS));
      setSelectedOperationIds(new Set());
      await onRefreshData();
      const canceled = result.logs.some((log) => log.status === "skipped");
      onSuccess(canceled ? t("operationCanceled") : t("success"));
    } catch (error) {
      onError(readableError(error));
    } finally {
      activeOperationKindRef.current = null;
      setIsOperationCanceling(false);
      setOperationProgress(null);
    }
  }, [displayPreviews, onError, onRefreshData, onSuccess, selectedOperationIds, t]);

  const restoreOperationLogs = useCallback(async (logs: OperationLog[]) => {
    if (!logs.length) return;
    activeOperationKindRef.current = "restore";
    setIsOperationCanceling(false);
    setOperationProgress({
      kind: "restore",
      batchId: logs[0]?.batch_id ?? "",
      processed: 0,
      total: logs.length,
      currentPath: logs[0]?.path_after ?? ""
    });
    try {
      const result = await tauriApi.restoreMoves(logs);
      const updatedById = new Map(result.logs.map((log) => [log.id, log]));
      setOperationLogs((current) => current.map((log) => updatedById.get(log.id) ?? log));
      await onRefreshData();
      const canceled = result.logs.some((log) => log.restore_status === "canceled");
      onSuccess(canceled ? t("operationCanceled") : `${t("restored")}: ${result.restored.toLocaleString()}`);
    } catch (error) {
      onError(readableError(error));
    } finally {
      activeOperationKindRef.current = null;
      setIsOperationCanceling(false);
      setOperationProgress(null);
    }
  }, [onError, onRefreshData, onSuccess, t]);

  const cancelOperations = useCallback(async () => {
    if (!activeOperationKindRef.current) return;
    setIsOperationCanceling(true);
    try {
      await tauriApi.cancelOperations();
    } catch (error) {
      setIsOperationCanceling(false);
      onError(readableError(error));
    }
  }, [onError]);

  const onRenamePreview = useCallback((id: string, name: string) => {
    setPreviewNameOverrides((current) => ({ ...current, [id]: name }));
  }, []);

  return {
    operationLogs,
    selectedOperationIds,
    setSelectedOperationIds,
    displayPreviews,
    previewActionCount,
    operationProgress,
    isOperationCanceling,
    runDispatch,
    executeSelected,
    restoreOperationLogs,
    cancelOperations,
    onRenamePreview
  };
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
