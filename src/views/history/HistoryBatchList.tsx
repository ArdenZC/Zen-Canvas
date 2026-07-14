import { useEffect, useRef, type RefObject } from "react";
import { AlertCircle, Check, ChevronRight, Circle, CircleOff, RotateCcw } from "lucide-react";
import type { Translator } from "../../types/ui";
import type { OperationLog } from "../../types/domain";
import { cn } from "../../utils/tw";
import { formatDisplayPath } from "../../utils/viewHelpers";
import { historyTime, type OperationHistoryBatch } from "./historyModel";

function executionStateLabel(batch: OperationHistoryBatch, t: Translator) {
  if (batch.executionState === "partial") return t("historyStatusPartial");
  if (batch.executionState === "failed") return t("historyStatusFailed");
  if (batch.executionState === "skipped") return t("historyStatusSkipped");
  if (batch.executionState === "canceled") return t("historyStatusCanceled");
  if (batch.executionState === "success") return t("historyStatusSuccess");
  return t("historyStatusUnavailable");
}

function restoreStateLabel(batch: OperationHistoryBatch, t: Translator) {
  if (batch.restoreState === "restored") return t("historyStatusRestored");
  if (batch.restoreState === "partially_restored") return t("historyStatusPartiallyRestored");
  if (batch.restoreState === "restorable") return t("historyStatusRestorable");
  if (batch.restoreState === "restore_failed") return t("historyStatusRestoreFailed");
  if (batch.restoreState === "restore_canceled") return t("historyStatusRestoreCanceled");
  if (batch.restoreState === "not_restored") return t("historyStatusNotRestored");
  return t("historyStatusUnavailable");
}

function BatchStateIcon({ state }: { state: OperationHistoryBatch["state"] }) {
  if (state === "restored") return <Check size={15} aria-hidden="true" />;
  if (state === "partially_restored" || state === "partial" || state === "restore_failed" || state === "restore_canceled") return <AlertCircle size={15} aria-hidden="true" />;
  if (state === "failed") return <CircleOff size={15} aria-hidden="true" />;
  if (state === "restorable") return <RotateCcw size={15} aria-hidden="true" />;
  return <Circle size={15} aria-hidden="true" />;
}

function BatchCheckbox({
  batch,
  selectedIds,
  onChange,
  t
}: {
  batch: OperationHistoryBatch;
  selectedIds: ReadonlySet<string>;
  onChange: (checked: boolean) => void;
  t: Translator;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const selectable = batch.logs;
  const selected = selectable.filter((log) => selectedIds.has(log.id)).length;
  const selectedAny = batch.logs.some((log) => selectedIds.has(log.id));
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = selected > 0 && selected < selectable.length;
  }, [selectable.length, selected]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={t("historySelectBatch")}
      checked={selectable.length > 0 && selected === selectable.length}
      disabled={selectable.length === 0 && !selectedAny}
      onChange={(event) => onChange(event.currentTarget.checked)}
      onClick={(event) => event.stopPropagation()}
    />
  );
}

export function HistoryBatchList({
  batches,
  activeBatchId,
  selectedIds,
  onActiveBatch,
  onToggleBatch,
  listRef,
  t
}: {
  batches: readonly OperationHistoryBatch[];
  activeBatchId: string;
  selectedIds: ReadonlySet<string>;
  onActiveBatch: (id: string) => void;
  onToggleBatch: (batch: OperationHistoryBatch, checked: boolean) => void;
  listRef?: RefObject<HTMLDivElement | null>;
  t: Translator;
}) {
  const activeIndex = Math.max(0, batches.findIndex((batch) => batch.id === activeBatchId));
  const internalListRef = useRef<HTMLDivElement | null>(null);
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!batches.length) return;
    let nextIndex = activeIndex;
    if (event.key === "ArrowDown") nextIndex = Math.min(batches.length - 1, activeIndex + 1);
    else if (event.key === "ArrowUp") nextIndex = Math.max(0, activeIndex - 1);
    else if (event.key === "PageDown") nextIndex = Math.min(batches.length - 1, activeIndex + 5);
    else if (event.key === "PageUp") nextIndex = Math.max(0, activeIndex - 5);
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = batches.length - 1;
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const batch = batches[activeIndex];
      if (batch) onToggleBatch(batch, batch.logs.some((log) => !selectedIds.has(log.id)));
      return;
    } else return;
    event.preventDefault();
    const batch = batches[nextIndex];
    if (batch) {
      onActiveBatch(batch.id);
      requestAnimationFrame(() => document.getElementById(`history-batch-${batch.id}`)?.scrollIntoView?.({ block: "nearest" }));
    }
  };
  return (
    <div
      ref={listRef ?? internalListRef}
      className="grid gap-1 pr-1"
      role="listbox"
      tabIndex={0}
      aria-label={t("historyBatches")}
      aria-activedescendant={activeBatchId ? `history-batch-${activeBatchId}` : undefined}
      onKeyDown={handleKeyDown}
    >
      {batches.map((batch) => {
        const selected = batch.logs.filter((log) => selectedIds.has(log.id)).length;
        const active = batch.id === activeBatchId;
        const first = batch.logs[0];
        return (
          <div
            id={`history-batch-${batch.id}`}
            key={batch.id}
            role="option"
            aria-selected={active}
            className={cn(
              "grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-[var(--zc-radius-field)] border px-3 py-3 text-left transition-colors",
              active
                ? "border-[var(--zc-border)] bg-[var(--zc-surface-selected)] shadow-[inset_2px_0_0_var(--zc-primary)]"
                : "border-transparent hover:border-[var(--zc-border)] hover:bg-[var(--zc-surface-raised)]"
            )}
            onClick={() => onActiveBatch(batch.id)}
          >
            <BatchCheckbox batch={batch} selectedIds={selectedIds} onChange={(checked) => onToggleBatch(batch, checked)} t={t} />
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className={cn("shrink-0", batch.executionState === "failed" || batch.restoreState === "restore_failed" ? "text-[var(--zc-danger-text)]" : batch.restoreState === "restored" ? "text-[var(--zc-success-text)]" : "text-[var(--zc-primary)]")}><BatchStateIcon state={batch.state} /></span>
                <strong className="truncate text-sm">{historyTime(batch.createdAt) ? new Date(historyTime(batch.createdAt)).toLocaleString() : t("historyTimeUnavailable")}</strong>
              </div>
              <span className="mt-1 block truncate text-xs text-[var(--muted)]" title={first?.path_after || first?.target_path}>
                {first ? formatDisplayPath(first.path_after || first.target_path) : t("historyBatch")}
              </span>
              <span className="mt-1 block text-xs text-[var(--muted)]">
                {t("historyBatchItems").replace("{count}", String(batch.total))} · {executionStateLabel(batch, t)} · {restoreStateLabel(batch, t)} · {batch.restorable} {t("restorable")}
              </span>
              {(batch.failed > 0 || batch.skipped > 0) && <span className="mt-1 block text-[11px] tabular-nums text-[var(--muted)]">{t("historyStatusFailed")}: {batch.failed} · {t("historyStatusSkipped")}: {batch.skipped}</span>}
            </div>
            <ChevronRight size={16} className="mt-1 text-[var(--muted)]" aria-hidden="true" />
            {selected > 0 && <span className="col-start-2 text-xs font-medium text-[var(--zc-primary)]">{t("historyBatchSelected").replace("{count}", String(selected))}</span>}
          </div>
        );
      })}
    </div>
  );
}

export function operationDisplayName(log: OperationLog) {
  return log.name_after || log.new_name || log.name_before || log.old_name || log.path_after || log.target_path;
}
