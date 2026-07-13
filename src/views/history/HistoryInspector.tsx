import { useState } from "react";
import { ArrowLeft, ExternalLink, FileWarning, RotateCcw } from "lucide-react";
import { tauriApi } from "../../api/tauriApi";
import type { CleanupRestorePreviewItem, CleanupTrashBatch, CleanupTrashItem, OperationLog } from "../../types/domain";
import type { Translator } from "../../types/ui";
import { buttonGhost, buttonSecondary, cn } from "../../utils/tw";
import { compactPath, formatDisplayPath } from "../../utils/viewHelpers";
import { mutedText, rowSurface } from "../shared/ui";
import {
  cleanupRestoreEligibility,
  cleanupBatchRestorableCount,
  type CleanupPreviewState,
  historyTime,
  isRestorableCleanupTrashItem,
  isRestorableLog,
  restoreEligibility,
  type OperationHistoryBatch
} from "./historyModel";
import { operationDisplayName } from "./HistoryBatchList";

function replaceCount(text: string, count: number) {
  return text.replace("{count}", String(count));
}

function formatDate(value: string, t: Translator) {
  const timestamp = historyTime(value);
  if (!timestamp) return t("historyTimeUnavailable");
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function localizedRestoreMessage(message: string | null | undefined, t: Translator) {
  const normalized = (message ?? "").toLocaleLowerCase();
  if (!normalized) return "";
  if (normalized.includes("target file already exists") || normalized.includes("original path already exists") || normalized.includes("already exists") || normalized.includes("原路径已有文件")) return t("restoreErrorTargetExists");
  if (normalized.includes("source file does not exist") || normalized.includes("safe trash path is missing") || normalized.includes("not found") || normalized.includes("不存在") || normalized.includes("缺失")) return t("restoreErrorSourceMissing");
  if (normalized.includes("permission") || normalized.includes("access denied") || normalized.includes("权限")) return t("restoreErrorPermission");
  if (normalized.includes("in use") || normalized.includes("occupied") || normalized.includes("被占用")) return t("restoreErrorOccupied");
  if (normalized.includes("no longer restorable") || normalized.includes("blocked") || normalized.includes("阻止")) return t("restoreErrorBlocked");
  if (normalized.includes("already restored") || normalized.includes("已经恢复")) return t("restoreErrorAlreadyRestored");
  if (normalized.includes("processing") || normalized.includes("处理中")) return t("restoreErrorProcessing");
  if (normalized.includes("canceled") || normalized.includes("cancelled") || normalized.includes("取消")) return t("restoreErrorCanceled");
  return t("restoreErrorGeneric");
}

export function restoreEligibilityLabel(log: OperationLog, t: Translator) {
  const reason = restoreEligibility(log).reason;
  const key = `historyEligibility${reason.charAt(0).toUpperCase()}${reason.slice(1)}` as Parameters<Translator>[0];
  return t(key);
}

export function operationStatusLabel(log: OperationLog, t: Translator) {
  if (log.restore_status === "restored") return t("historyStatusRestored");
  if (log.restore_status === "canceled") return t("historyStatusRestoreCanceled");
  if (log.restore_status === "failed") return t("historyStatusRestoreFailed");
  return operationExecutionStatusLabel(log, t);
}

function operationExecutionStatusLabel(log: OperationLog, t: Translator) {
  if (log.status === "failed") return t("historyStatusFailed");
  if (log.status === "skipped") return t("historyStatusSkipped");
  return t("historyStatusSuccess");
}

function operationRestoreStatusLabel(log: OperationLog, t: Translator) {
  if (log.restore_status === "restored") return t("historyStatusRestored");
  if (log.restore_status === "canceled") return t("historyStatusRestoreCanceled");
  if (log.restore_status === "failed") return t("historyStatusRestoreFailed");
  if (log.restore_status === "pending") return t("historyEligibilityPending");
  if (log.restore_status === "unavailable") return t("historyStatusUnavailable");
  return t("historyStatusNotRestored");
}

function batchStateLabel(value: OperationHistoryBatch["executionState"] | OperationHistoryBatch["restoreState"], t: Translator) {
  if (value === "success") return t("historyStatusSuccess");
  if (value === "partial") return t("historyStatusPartial");
  if (value === "failed") return t("historyStatusFailed");
  if (value === "skipped") return t("historyStatusSkipped");
  if (value === "canceled" || value === "restore_canceled") return t("historyStatusRestoreCanceled");
  if (value === "restored") return t("historyStatusRestored");
  if (value === "partially_restored") return t("historyStatusPartiallyRestored");
  if (value === "restorable") return t("historyStatusRestorable");
  if (value === "restore_failed") return t("historyStatusRestoreFailed");
  if (value === "not_restored") return t("historyStatusNotRestored");
  return t("historyStatusUnavailable");
}

export function operationTypeLabel(log: OperationLog, t: Translator) {
  if (log.operation_type === "move") return t("operationMove");
  if (log.operation_type === "rename") return t("operationRename");
  if (log.operation_type === "move_rename") return t("operationMoveRename");
  if (log.operation_type === "move_to_trash") return t("operationMoveToTrash");
  return log.operation_type;
}

function operationCurrentPath(log: OperationLog) {
  return log.restore_status === "restored"
    ? log.path_before || log.source_path || log.target_path
    : log.path_after || log.target_path || log.path_before || log.source_path;
}

function operationOriginalPath(log: OperationLog) {
  return log.path_before || log.source_path || log.path_after || log.target_path;
}

function DetailRow({ label, value, title }: { label: string; value: string; title?: string }) {
  return <div className="grid min-w-0 gap-0.5"><dt className="text-[11px] font-semibold text-[var(--zc-text-tertiary)]">{label}</dt><dd className="min-w-0 truncate text-xs text-[var(--muted)]" title={title ?? value}>{value || "-"}</dd></div>;
}

export function HistoryInspector({
  batch,
  selectedIds,
  onToggle,
  onBack,
  t
}: {
  batch: OperationHistoryBatch | undefined;
  selectedIds: ReadonlySet<string>;
  onToggle: (log: OperationLog, checked: boolean) => void;
  onBack?: () => void;
  t: Translator;
}) {
  const [technicalOpen, setTechnicalOpen] = useState<Set<string>>(new Set());
  const [revealError, setRevealError] = useState<Record<string, string>>({});
  if (!batch) return <div className="grid min-h-56 place-items-center text-sm text-[var(--muted)]">{t("historyNoSelection")}</div>;

  async function reveal(log: OperationLog) {
    const path = operationCurrentPath(log);
    try {
      setRevealError((current) => ({ ...current, [log.id]: "" }));
      await tauriApi.revealInFolder(path);
    } catch {
      setRevealError((current) => ({ ...current, [log.id]: t("historyPathRevealFailed") }));
    }
  }

  function toggleTechnical(id: string) {
    setTechnicalOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section aria-labelledby="history-inspector-title" className="grid gap-3">
      <div className="flex items-start gap-3">
        {onBack && <button type="button" className={buttonSecondary} onClick={onBack} aria-label={t("historyInspectorBack")}><ArrowLeft size={16} /></button>}
        <div className="min-w-0">
          <h2 id="history-inspector-title" className="text-base font-semibold">{t("historyInspector")}</h2>
          <p className={cn(mutedText, "mt-1 tabular-nums")}>{batch.total} · {t("historyOperationStatus")}: {batchStateLabel(batch.executionState, t)} · {t("historyRestoreStatus")}: {batchStateLabel(batch.restoreState, t)} · {batch.success} {t("historyStatusSuccess")} · {batch.failed} {t("historyStatusFailed")} · {batch.restorable} {t("restorable")}</p>
        </div>
      </div>
      <div className="grid gap-2" role="list" aria-label={t("historyInspector")}>
        {batch.logs.map((log) => {
          const eligible = isRestorableLog(log);
          const currentPath = operationCurrentPath(log);
          const originalPath = operationOriginalPath(log);
          const rawError = log.restore_error || log.error_message;
          const technical = technicalOpen.has(log.id);
          return (
            <div className={cn(rowSurface, "grid gap-2")} key={log.id} role="listitem">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  aria-label={`${t("historySelectItem")}: ${operationDisplayName(log)}`}
                  checked={selectedIds.has(log.id)}
                  onChange={(event) => onToggle(log, event.currentTarget.checked)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="truncate text-sm" title={operationDisplayName(log)}>{operationDisplayName(log)}</strong>
                    <span className="text-xs text-[var(--muted)]">{operationTypeLabel(log, t)}</span>
                    <span className="rounded-full border border-[var(--zc-border)] px-2 py-0.5 text-[11px] text-[var(--muted)]">{t("historyOperationStatus")}: {operationExecutionStatusLabel(log, t)}</span>
                    <span className="rounded-full border border-[var(--zc-border)] px-2 py-0.5 text-[11px] text-[var(--muted)]">{t("historyRestoreStatus")}: {operationRestoreStatusLabel(log, t)}</span>
                  </div>
                  <dl className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    <DetailRow label={t("historyCreatedAt")} value={formatDate(log.created_at, t)} />
                    <DetailRow label={t("historyRestoreEligibility")} value={restoreEligibilityLabel(log, t)} />
                    <DetailRow label={t("historyOriginalPath")} value={compactPath(formatDisplayPath(originalPath), 68)} title={formatDisplayPath(originalPath)} />
                    <DetailRow label={t("historyCurrentPath")} value={compactPath(formatDisplayPath(currentPath), 68)} title={formatDisplayPath(currentPath)} />
                  </dl>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className={cn("font-medium", eligible ? "text-[var(--zc-success-text)]" : "text-[var(--muted)]")}>{restoreEligibilityLabel(log, t)}</span>
                    {rawError && <button type="button" className="text-[var(--zc-primary)]" aria-expanded={technical} onClick={() => toggleTechnical(log.id)}>{technical ? t("historyRestoreHideTechnical") : t("historyRestoreShowTechnical")}</button>}
                  </div>
                  {revealError[log.id] && <p className="mt-1 text-xs text-[var(--zc-danger-text)]">{revealError[log.id]}</p>}
                  {rawError && <p className="mt-1 text-xs text-[var(--zc-danger-text)]">{localizedRestoreMessage(rawError, t)}</p>}
                  {technical && rawError && <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-[var(--zc-radius-control)] bg-[var(--zc-surface-subtle)] p-2 text-[11px] text-[var(--muted)]">{rawError}</pre>}
                </div>
                <button type="button" className={buttonGhost} aria-label={`${t("historyOpenPath")}: ${operationDisplayName(log)}`} title={formatDisplayPath(currentPath)} onClick={() => void reveal(log)}>
                  <ExternalLink size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function cleanupStatusLabel(item: CleanupTrashItem, preview: CleanupRestorePreviewItem | undefined, previewState: CleanupPreviewState, t: Translator) {
  if (previewState === "loading") return t("cleanupPreviewLoading");
  if (previewState === "failed") return t("cleanupPreviewFailed");
  if (previewState === "unavailable" || !preview) return t("cleanupPreviewUnavailable");
  const eligibility = cleanupRestoreEligibility(preview, previewState);
  if (eligibility.executable) return t("cleanupTrashMoved");
  if (eligibility.reason === "conflict") return t("historyCleanupConflict");
  if (eligibility.reason === "missing") return t("historyCleanupMissing");
  if (eligibility.reason === "failed") return t("historyCleanupFailed");
  if (eligibility.reason === "pending") return t("historyEligibilityPending");
  if (item.status === "restored") return t("restored");
  return t("historyStatusUnavailable");
}

export function CleanupInspector({
  batch,
  previewById,
  previewState,
  previewError,
  onRetry,
  onBack,
  selectedIds,
  onToggle,
  t
}: {
  batch: CleanupTrashBatch | undefined;
  previewById: ReadonlyMap<string, CleanupRestorePreviewItem>;
  previewState: CleanupPreviewState;
  previewError?: string;
  onRetry?: () => void;
  onBack?: () => void;
  selectedIds: ReadonlySet<string>;
  onToggle: (item: CleanupTrashItem, checked: boolean) => void;
  t: Translator;
}) {
  const [technicalOpen, setTechnicalOpen] = useState<Set<string>>(new Set());
  const [revealError, setRevealError] = useState<Record<string, string>>({});
  if (!batch) return <div className="grid min-h-40 place-items-center text-sm text-[var(--muted)]">{t("cleanupTrashEmpty")}</div>;

  async function reveal(item: CleanupTrashItem) {
    const path = item.status === "restored" ? item.originalPath : item.trashPath;
    try {
      setRevealError((current) => ({ ...current, [item.id]: "" }));
      await tauriApi.revealInFolder(path);
    } catch {
      setRevealError((current) => ({ ...current, [item.id]: t("historyPathRevealFailed") }));
    }
  }

  function toggleTechnical(id: string) {
    setTechnicalOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="grid gap-3" aria-labelledby="cleanup-inspector-title">
      <div>
        <div className="flex items-start gap-2">{onBack && <button type="button" className={buttonSecondary} onClick={onBack} aria-label={t("historyInspectorBack")}><ArrowLeft size={16} /></button>}<h2 id="cleanup-inspector-title" className="text-base font-semibold">{t("historyCleanupScope")}</h2></div>
        <p className={cn(mutedText, "mt-1")}>{t("historyCleanupRestoreDesc")}</p>
        {previewState !== "ready" && <div className={cn("mt-2 flex flex-wrap items-center gap-2 rounded-[var(--zc-radius-control)] border px-3 py-2 text-xs", previewState === "failed" ? "border-[var(--zc-danger-border)] text-[var(--zc-danger-text)]" : "border-[var(--zc-control-border)] text-[var(--muted)]")} role="status"><span>{previewState === "loading" ? t("cleanupPreviewLoading") : previewState === "failed" ? t("cleanupPreviewFailed") : t("cleanupPreviewUnavailable")}</span>{previewError && <button type="button" className="text-[var(--zc-primary)]" title={previewError} onClick={() => setTechnicalOpen((current) => new Set(current).add("__preview__"))}>{t("historyRestoreShowTechnical")}</button>}{onRetry && <button type="button" className={buttonSecondary} disabled={previewState === "loading"} onClick={onRetry}>{t("cleanupPreviewRetry")}</button>}{technicalOpen.has("__preview__") && previewError && <pre className="basis-full whitespace-pre-wrap break-words">{previewError}</pre>}</div>}
      </div>
      <div className="grid gap-2" role="list">
        {batch.items.map((item) => {
          const preview = previewById.get(item.id);
          const eligible = previewState === "ready" && Boolean(preview) && isRestorableCleanupTrashItem(item, preview, previewState);
          const currentPath = item.status === "restored" ? item.originalPath : item.trashPath;
          const technical = technicalOpen.has(item.id);
          const rawMessage = previewState === "failed" ? previewError || "" : item.message || preview?.blockingReason || "";
          return (
            <div key={item.id} className={cn(rowSurface, "grid gap-2")} role="listitem">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                    aria-label={`${t("historySelectItem")}: ${item.name}`}
                    checked={selectedIds.has(item.id)}
                    disabled={previewState !== "ready" || !preview}
                    onChange={(event) => onToggle(item, event.currentTarget.checked)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><RotateCcw size={15} aria-hidden="true" /><strong className="truncate text-sm" title={item.name}>{item.name}</strong></div>
                  <dl className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    <DetailRow label={t("historyCreatedAt")} value={formatDate(item.movedAt, t)} />
                    <DetailRow label={t("historyRestoreEligibility")} value={cleanupStatusLabel(item, preview, previewState, t)} />
                    <DetailRow label={t("historyCleanupOriginalPath")} value={compactPath(formatDisplayPath(item.originalPath), 68)} title={formatDisplayPath(item.originalPath)} />
                    <DetailRow label={t("historyCleanupCurrentPath")} value={compactPath(formatDisplayPath(currentPath), 68)} title={formatDisplayPath(currentPath)} />
                  </dl>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className={cn("font-medium", eligible ? "text-[var(--zc-success-text)]" : "text-[var(--muted)]")}>{cleanupStatusLabel(item, preview, previewState, t)}</span>
                    {rawMessage && <button type="button" className="text-[var(--zc-primary)]" aria-expanded={technical} onClick={() => toggleTechnical(item.id)}>{technical ? t("historyRestoreHideTechnical") : t("historyRestoreShowTechnical")}</button>}
                  </div>
                  {revealError[item.id] && <p className="mt-1 text-xs text-[var(--zc-danger-text)]">{revealError[item.id]}</p>}
                  {technical && rawMessage && <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-[var(--zc-radius-control)] bg-[var(--zc-surface-subtle)] p-2 text-[11px] text-[var(--muted)]">{rawMessage}</pre>}
                </div>
                <button type="button" className={buttonGhost} aria-label={`${t("historyOpenPath")}: ${item.name}`} title={formatDisplayPath(currentPath)} onClick={() => void reveal(item)}>
                  <ExternalLink size={15} />
                </button>
                {!eligible && <FileWarning size={16} className="text-[var(--muted)]" aria-hidden="true" />}
              </div>
            </div>
          );
        })}
      </div>
      <p className={cn(mutedText, "tabular-nums")}>{previewState === "ready" ? replaceCount(t("historyBatchItems"), cleanupBatchRestorableCount(batch, [...previewById.values()])) : t("cleanupPreviewUnavailable")}{previewState === "ready" && ` ${t("restorable")}`}</p>
    </section>
  );
}
