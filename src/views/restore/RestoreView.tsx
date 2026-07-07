import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, RotateCcw, X } from "lucide-react";
import { tauriApi } from "../../api/tauriApi";
import { useChromeContext } from "../../contexts/AppContexts";
import { useOperationQueueStore } from "../../store/useOperationQueueStore";
import type { CleanupRestoreResult, CleanupTrashBatch, CleanupTrashItem, OperationLog } from "../../types/domain";
import type { Translator } from "../../types/ui";
import { formatBytes } from "../../utils/format";
import { compactPath } from "../../utils/viewHelpers";
import { cn, emptyState, glassButtonPrimary, sectionTitle } from "../../utils/tw";
import { OperationProgressPanel } from "../timeline/TimelineView";
import { compactRowSurface, mutedText, pageSurface, panelSurface, rowSurface, SectionTitle } from "../shared/ui";

export function RestoreView() {
  const { t } = useChromeContext();
  const logs = useOperationQueueStore((state) => state.operationLogs);
  const onRestore = useOperationQueueStore((state) => state.restoreOperationLogs);
  const operationProgress = useOperationQueueStore((state) => state.operationProgress);
  const isOperationCanceling = useOperationQueueStore((state) => state.isOperationCanceling);
  const cancelOperations = useOperationQueueStore((state) => state.cancelOperations);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedCleanupBatchId, setSelectedCleanupBatchId] = useState("");
  const [cleanupTrashBatches, setCleanupTrashBatches] = useState<CleanupTrashBatch[]>([]);
  const [cleanupRestoreResult, setCleanupRestoreResult] = useState<CleanupRestoreResult | null>(null);
  const [isRestoringCleanupTrash, setIsRestoringCleanupTrash] = useState(false);
  const batches = useMemo(() => groupOperationLogs(logs), [logs]);
  const selectedBatch = batches.find((batch) => batch.batchId === selectedBatchId) ?? batches[0];
  const selectedCleanupBatch =
    cleanupTrashBatches.find((batch) => batch.id === selectedCleanupBatchId) ?? cleanupTrashBatches[0];
  const restorableCleanupItems = selectedCleanupBatch?.items.filter(isRestorableCleanupTrashItem) ?? [];
  const restorableLogs = selectedBatch?.logs.filter(isRestorableLog) ?? [];
  const restoreProgress = operationProgress?.kind === "restore" ? operationProgress : null;
  const isRestoring = Boolean(restoreProgress);
  const historyLogs = useMemo(
    () => [...logs].sort((a, b) => logTimeValue(b.created_at) - logTimeValue(a.created_at)).slice(0, 8),
    [logs]
  );

  useEffect(() => {
    if (!batches.length) {
      setSelectedBatchId("");
      return;
    }
    if (!selectedBatchId || !batches.some((batch) => batch.batchId === selectedBatchId)) {
      setSelectedBatchId(batches[0].batchId);
    }
  }, [batches, selectedBatchId]);

  useEffect(() => {
    void refreshCleanupTrashBatches();
  }, []);

  useEffect(() => {
    if (!cleanupTrashBatches.length) {
      setSelectedCleanupBatchId("");
      return;
    }
    if (!selectedCleanupBatchId || !cleanupTrashBatches.some((batch) => batch.id === selectedCleanupBatchId)) {
      setSelectedCleanupBatchId(cleanupTrashBatches[0].id);
    }
  }, [cleanupTrashBatches, selectedCleanupBatchId]);

  async function restoreSelectedBatch() {
    if (!restorableLogs.length || isRestoring) return;
    await onRestore(restorableLogs);
  }

  async function refreshCleanupTrashBatches() {
    const batches = await tauriApi.listCleanupTrashBatches();
    setCleanupTrashBatches(batches);
  }

  async function restoreCleanupTrashItems() {
    if (!restorableCleanupItems.length || isRestoringCleanupTrash) return;
    setIsRestoringCleanupTrash(true);
    try {
      const result = await tauriApi.restoreCleanupTrashItems(restorableCleanupItems.map((item) => item.id));
      setCleanupRestoreResult(result);
      await refreshCleanupTrashBatches();
    } finally {
      setIsRestoringCleanupTrash(false);
    }
  }

  return (
    <div className={pageSurface}>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
      <section className={panelSurface}>
        <SectionTitle title={t("restoreRecords")} body={t("restoreDesc")} />
        {batches.length ? (
          <div className="grid gap-2">
            {batches.map((batch) => (
              <button
                className={cn(
                  rowSurface,
                  "w-full",
                  batch.batchId === selectedBatch?.batchId && "border-blue-400/60 bg-blue-500/10"
                )}
                key={batch.batchId}
                onClick={() => setSelectedBatchId(batch.batchId)}
              >
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <RotateCcw size={16} />
                  <strong>{formatLogDate(batch.createdAt)}</strong>
                </div>
                <div>
                  <strong className="block text-sm">{batch.total} {t("items")} / {batch.restorable} {t("restorable")}</strong>
                  <small className={mutedText}>
                    {t("success")}: {batch.success} · {t("failed")}: {batch.failed} · {t("restored")}: {batch.restored}
                  </small>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className={emptyState}>{t("noRestoreRecords")}</div>
        )}
        <div className="my-5 h-px bg-[var(--line-dark)]" />
        <SectionTitle title={t("cleanupTrashRecords")} body={t("cleanupTrashRecordsDesc")} />
        {cleanupTrashBatches.length ? (
          <div className="grid gap-2">
            {cleanupTrashBatches.map((batch) => (
              <button
                className={cn(
                  rowSurface,
                  "w-full",
                  batch.id === selectedCleanupBatch?.id && "border-emerald-400/60 bg-emerald-500/10"
                )}
                key={batch.id}
                onClick={() => setSelectedCleanupBatchId(batch.id)}
              >
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <RotateCcw size={16} />
                  <strong>{formatLogDate(batch.createdAt)}</strong>
                </div>
                <div>
                  <strong className="block text-sm">{batch.totalItems} {t("items")} / {formatBytes(batch.totalSize)}</strong>
                  <small className={mutedText}>
                    {batch.items.filter(isRestorableCleanupTrashItem).length} {t("restorable")}
                  </small>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className={emptyState}>{t("cleanupTrashEmpty")}</div>
        )}
        <div className="my-5 h-px bg-[var(--line-dark)]" />
        <SectionTitle title={t("operationHistory")} body={t("timeMachineDesc")} />
        {historyLogs.length ? (
          <div className="grid gap-2">
            {historyLogs.map((log) => (
              <div className={cn(compactRowSurface, "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3")} key={log.id}>
                <span className={cn("h-2.5 w-2.5 rounded-full", log.status === "success" ? "bg-emerald-500" : "bg-red-500")} />
                <div>
                  <strong className="block truncate text-sm">{log.new_name || log.old_name}</strong>
                  <span className="block text-xs text-[var(--muted)]">{log.operation_type} · {formatLogDate(log.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={cn(emptyState, "min-h-20")}>{t("noOperationHistory")}</div>
        )}
      </section>

      <section className={panelSurface}>
        {selectedCleanupBatch && (
          <div className="mb-5 grid gap-3">
            <div className={cn(sectionTitle, "items-center")}>
              <div>
                <h2>{t("cleanupTrashRestore")}</h2>
                <p>{t("cleanupTrashRestoreBlockedDesc")}</p>
              </div>
              <button
                className={glassButtonPrimary}
                disabled={!restorableCleanupItems.length || isRestoringCleanupTrash}
                onClick={restoreCleanupTrashItems}
              >
                <RotateCcw size={16} />
                {isRestoringCleanupTrash ? t("restoring") : t("cleanupTrashRestore")}
              </button>
            </div>
            {cleanupRestoreResult && (
              <div className={compactRowSurface}>
                <strong className="block text-sm">{t("storageCleanupExecutionDone")}</strong>
                <small className={mutedText}>
                  {t("restored")}: {cleanupRestoreResult.restored} · {t("failed")}: {cleanupRestoreResult.failed} · missing: {cleanupRestoreResult.missing}
                </small>
              </div>
            )}
            <div className="grid gap-2">
              {selectedCleanupBatch.items.map((item) => (
                <div
                  className={cn(
                    rowSurface,
                    isRestorableCleanupTrashItem(item) ? "border-emerald-400/40 bg-emerald-500/10" : "border-slate-400/20 opacity-80"
                  )}
                  key={item.id}
                >
                  <div className="mb-2 flex items-center gap-2 text-sm">
                    {isRestorableCleanupTrashItem(item) ? <Check size={15} /> : <X size={15} />}
                    <strong>{cleanupTrashStatusLabel(item, t)}</strong>
                  </div>
                  <strong className="block truncate text-sm">{item.name}</strong>
                  <div className="mt-2 flex min-w-0 items-center gap-2 text-xs text-[var(--muted)]">
                    <span title={item.trashPath}>{compactPath(item.trashPath, 48)}</span>
                    <ChevronRight size={14} />
                    <span title={item.originalPath}>{compactPath(item.originalPath, 48)}</span>
                  </div>
                  {item.message && <small className="mt-2 block text-xs text-[var(--muted)]">{item.message}</small>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={cn(sectionTitle, "items-center")}>
          <div>
            <h2>{t("restorePreview")}</h2>
            <p>{t("restorePreviewDesc")}</p>
          </div>
          <button
            className={glassButtonPrimary}
            disabled={!restorableLogs.length || isRestoring}
            onClick={restoreSelectedBatch}
          >
            <RotateCcw size={16} />
            {isRestoring ? t("restoring") : t("restoreBatch")}
          </button>
        </div>
        {restoreProgress && (
          <OperationProgressPanel
            progress={restoreProgress}
            isCanceling={isOperationCanceling}
            onCancel={cancelOperations}
            t={t}
          />
        )}
        {selectedBatch ? (
          <div className="grid gap-2">
            {selectedBatch.logs.map((log) => {
              const isRestorable = isRestorableLog(log);
              return (
                <div className={cn(rowSurface, isRestorable ? "border-emerald-400/40 bg-emerald-500/10" : "border-slate-400/20 opacity-80")} key={log.id}>
                  <div className="mb-2 flex items-center gap-2 text-sm">
                    {isRestorable ? <Check size={15} /> : <X size={15} />}
                    <strong>{restoreStatusLabel(log, t)}</strong>
                  </div>
                  <div>
                    <strong className="block truncate text-sm">{log.new_name || log.old_name}</strong>
                    <div className="mt-2 flex min-w-0 items-center gap-2 text-xs text-[var(--muted)]">
                      <span title={log.path_after}>{compactPath(log.path_after, 48)}</span>
                      <ChevronRight size={14} />
                      <span title={log.path_before}>{compactPath(log.path_before, 48)}</span>
                    </div>
                    {log.operation_type === "move_to_trash" && (
                      <small className="mt-2 block text-xs text-[var(--muted)]">{t("restoreFromSystemTrash")}</small>
                    )}
                    {(log.restore_error || log.error_message) && (
                      <small className="mt-2 block text-xs text-red-500">{log.restore_error || log.error_message}</small>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={cn(emptyState, "min-h-20")}>{t("noRestorePreview")}</div>
        )}
      </section>
      </div>
    </div>
  );
}

interface OperationLogBatch {
  batchId: string;
  createdAt: string;
  logs: OperationLog[];
  total: number;
  success: number;
  failed: number;
  restored: number;
  restorable: number;
}

function groupOperationLogs(logs: OperationLog[]): OperationLogBatch[] {
  const groups = new Map<string, OperationLog[]>();
  for (const log of logs) {
    const key = log.batch_id || "batch";
    const group = groups.get(key) ?? [];
    group.push(log);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([batchId, batchLogs]) => {
      const sortedLogs = [...batchLogs].sort((a, b) => logTimeValue(b.created_at) - logTimeValue(a.created_at));
      return {
        batchId,
        createdAt: sortedLogs[0]?.created_at ?? "",
        logs: sortedLogs,
        total: sortedLogs.length,
        success: sortedLogs.filter((log) => log.status === "success").length,
        failed: sortedLogs.filter((log) => log.status === "failed").length,
        restored: sortedLogs.filter((log) => log.restore_status === "restored").length,
        restorable: sortedLogs.filter(isRestorableLog).length
      };
    })
    .sort((a, b) => logTimeValue(b.createdAt) - logTimeValue(a.createdAt));
}

function isRestorableLog(log: OperationLog): boolean {
  return (
    log.operation_type !== "move_to_trash" &&
    log.status === "success" &&
    log.can_restore &&
    (log.restore_status === "not_restored" || log.restore_status === "failed" || log.restore_status === "canceled")
  );
}

function isRestorableCleanupTrashItem(item: CleanupTrashItem): boolean {
  return item.status === "moved";
}

function cleanupTrashStatusLabel(item: CleanupTrashItem, t: Translator): string {
  if (item.status === "restored") return t("restored");
  if (item.status === "missing") return t("unavailable");
  if (item.status === "failed") return t("failed");
  if (isRestorableCleanupTrashItem(item)) return t("cleanupTrashMoved");
  return item.status;
}

function restoreStatusLabel(log: OperationLog, t: Translator): string {
  if (log.operation_type === "move_to_trash") return t("restoreFromSystemTrash");
  if (log.restore_status === "restored") return t("restored");
  if (log.restore_status === "failed") return t("failed");
  if (log.restore_status === "canceled") return t("operationCanceled");
  if (isRestorableLog(log)) return t("restorable");
  if (log.status === "skipped") return t("skipped");
  return t("unavailable");
}

function formatLogDate(value: string): string {
  const timestamp = logTimeValue(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "-";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function logTimeValue(value: string): number {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

