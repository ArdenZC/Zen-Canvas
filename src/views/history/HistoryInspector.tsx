import { ArrowLeft, ChevronRight, ExternalLink, FileWarning, RotateCcw } from "lucide-react";
import type { CleanupTrashBatch, CleanupTrashItem, OperationLog } from "../../types/domain";
import type { Translator } from "../../types/ui";
import { buttonGhost, buttonSecondary, cn } from "../../utils/tw";
import { compactPath, formatDisplayPath } from "../../utils/viewHelpers";
import { mutedText, rowSurface } from "../shared/ui";
import {
  cleanupBatchRestorableCount,
  isRestorableCleanupTrashItem,
  isRestorableLog,
  restoreEligibility,
  type OperationHistoryBatch
} from "./historyModel";
import { operationDisplayName } from "./HistoryBatchList";

function replaceCount(text: string, count: number) {
  return text.replace("{count}", String(count));
}

export function restoreEligibilityLabel(log: OperationLog, t: Translator) {
  const reason = restoreEligibility(log).reason;
  const key = `historyEligibility${reason.charAt(0).toUpperCase()}${reason.slice(1)}` as Parameters<Translator>[0];
  return t(key);
}

export function operationStatusLabel(log: OperationLog, t: Translator) {
  if (log.status === "failed") return t("historyStatusFailed");
  if (log.status === "skipped") return t("historyStatusSkipped");
  return log.restore_status === "restored" ? t("restored") : t("historyStatusSuccess");
}

export function operationTypeLabel(log: OperationLog, t: Translator) {
  if (log.operation_type === "move") return t("operationMove");
  if (log.operation_type === "rename") return t("operationRename");
  if (log.operation_type === "move_rename") return t("operationMoveRename");
  if (log.operation_type === "move_to_trash") return t("operationMoveToTrash");
  return log.operation_type;
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
  if (!batch) return <div className="grid min-h-56 place-items-center text-sm text-[var(--muted)]">{t("historyNoSelection")}</div>;
  return (
    <section aria-labelledby="history-inspector-title" className="grid gap-3">
      <div className="flex items-start gap-3">
        {onBack && <button type="button" className={buttonSecondary} onClick={onBack} aria-label={t("historyInspectorBack")}><ArrowLeft size={16} /></button>}
        <div className="min-w-0">
          <h2 id="history-inspector-title" className="text-base font-semibold">{t("historyInspector")}</h2>
          <p className={cn(mutedText, "mt-1")}>{batch.total} · {batch.restorable} {t("restorable")}</p>
        </div>
      </div>
      <div className="grid gap-2" role="list" aria-label={t("historyInspector")}>
        {batch.logs.map((log) => {
          const eligible = isRestorableLog(log);
          return (
            <div className={cn(rowSurface, "grid gap-2")} key={log.id} role="listitem">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  aria-label={`${t("historySelectItem")}: ${operationDisplayName(log)}`}
                  checked={selectedIds.has(log.id)}
                  disabled={!eligible && !selectedIds.has(log.id)}
                  onChange={(event) => onToggle(log, event.currentTarget.checked)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="truncate text-sm">{operationDisplayName(log)}</strong>
                    <span className="text-xs text-[var(--muted)]">{operationTypeLabel(log, t)}</span>
                    <span className="rounded-full border border-[var(--zc-border)] px-2 py-0.5 text-[11px] text-[var(--muted)]">{operationStatusLabel(log, t)}</span>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-[var(--muted)]">
                    <span className="truncate" title={log.path_before || log.source_path}>{compactPath(formatDisplayPath(log.path_before || log.source_path), 68)}</span>
                    <span className="flex items-center gap-1"><ChevronRight size={12} aria-hidden="true" /> <span className="truncate" title={log.path_after || log.target_path}>{compactPath(formatDisplayPath(log.path_after || log.target_path), 68)}</span></span>
                  </div>
                  <p className={cn("mt-2 text-xs", eligible ? "text-[var(--zc-success-text)]" : "text-[var(--muted)]")}>
                    {restoreEligibilityLabel(log, t)}
                  </p>
                  {(log.restore_error || log.error_message) && <p className="mt-1 text-xs text-[var(--zc-danger-text)]">{log.restore_error || log.error_message}</p>}
                </div>
                <button type="button" className={buttonGhost} aria-label={`${t("historyOpenPath")}: ${operationDisplayName(log)}`} title={log.path_after || log.target_path}>
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

export function CleanupInspector({
  batch,
  selectedIds,
  onToggle,
  t
}: {
  batch: CleanupTrashBatch | undefined;
  selectedIds: ReadonlySet<string>;
  onToggle: (item: CleanupTrashItem, checked: boolean) => void;
  t: Translator;
}) {
  if (!batch) return <div className="grid min-h-40 place-items-center text-sm text-[var(--muted)]">{t("cleanupTrashEmpty")}</div>;
  return (
    <section className="grid gap-3" aria-labelledby="cleanup-inspector-title">
      <div>
        <h2 id="cleanup-inspector-title" className="text-base font-semibold">{t("historyCleanupScope")}</h2>
        <p className={cn(mutedText, "mt-1")}>{t("historyCleanupRestoreDesc")}</p>
      </div>
      <div className="grid gap-2" role="list">
        {batch.items.map((item) => {
          const eligible = isRestorableCleanupTrashItem(item);
          return (
            <div key={item.id} className={cn(rowSurface, "grid gap-2")} role="listitem">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  aria-label={`${t("historySelectItem")}: ${item.name}`}
                  checked={selectedIds.has(item.id)}
                  disabled={!eligible && !selectedIds.has(item.id)}
                  onChange={(event) => onToggle(item, event.currentTarget.checked)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><RotateCcw size={15} aria-hidden="true" /><strong className="truncate text-sm">{item.name}</strong></div>
                  <p className="mt-2 text-xs text-[var(--muted)]">{compactPath(item.originalPath, 72)}</p>
                  <p className={cn("mt-1 text-xs", eligible ? "text-[var(--zc-success-text)]" : "text-[var(--muted)]")}>
                    {eligible ? t("cleanupTrashMoved") : item.status === "restored" ? t("restored") : t("unavailable")}
                  </p>
                  {item.message && <p className="mt-1 text-xs text-[var(--muted)]">{item.message}</p>}
                </div>
                {!eligible && <FileWarning size={16} className="text-[var(--muted)]" aria-hidden="true" />}
              </div>
            </div>
          );
        })}
      </div>
      <p className={mutedText}>{replaceCount(t("historyBatchItems"), cleanupBatchRestorableCount(batch))} {t("restorable")}</p>
    </section>
  );
}
