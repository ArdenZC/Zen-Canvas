import { useEffect, useRef } from "react";
import { Check, ChevronRight, Circle } from "lucide-react";
import type { Translator } from "../../types/ui";
import type { OperationLog } from "../../types/domain";
import { cn } from "../../utils/tw";
import { formatDisplayPath } from "../../utils/viewHelpers";
import { isRestorableLog, type OperationHistoryBatch } from "./historyModel";

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
  const eligible = batch.logs.filter(isRestorableLog);
  const selected = eligible.filter((log) => selectedIds.has(log.id)).length;
  const selectedAny = batch.logs.some((log) => selectedIds.has(log.id));
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = selected > 0 && selected < eligible.length;
  }, [eligible.length, selected]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={t("historySelectBatch")}
      checked={eligible.length > 0 && selected === eligible.length}
      disabled={eligible.length === 0 && !selectedAny}
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
  t
}: {
  batches: readonly OperationHistoryBatch[];
  activeBatchId: string;
  selectedIds: ReadonlySet<string>;
  onActiveBatch: (id: string) => void;
  onToggleBatch: (batch: OperationHistoryBatch, checked: boolean) => void;
  t: Translator;
}) {
  const activeIndex = Math.max(0, batches.findIndex((batch) => batch.id === activeBatchId));
  const listRef = useRef<HTMLDivElement | null>(null);
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!batches.length) return;
    let nextIndex = activeIndex;
    if (event.key === "ArrowDown") nextIndex = Math.min(batches.length - 1, activeIndex + 1);
    else if (event.key === "ArrowUp") nextIndex = Math.max(0, activeIndex - 1);
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = batches.length - 1;
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const batch = batches[activeIndex];
      if (batch) onToggleBatch(batch, batch.logs.filter(isRestorableLog).some((log) => !selectedIds.has(log.id)));
      return;
    } else return;
    event.preventDefault();
    const batch = batches[nextIndex];
    if (batch) onActiveBatch(batch.id);
  };
  return (
    <div
      ref={listRef}
      className="grid max-h-[min(62vh,680px)] gap-1 overflow-y-auto pr-1"
      role="listbox"
      tabIndex={0}
      aria-label={t("historyBatches")}
      aria-activedescendant={activeBatchId ? `history-batch-${activeBatchId}` : undefined}
      onKeyDown={handleKeyDown}
    >
      {batches.map((batch) => {
        const eligible = batch.logs.filter(isRestorableLog);
        const selected = eligible.filter((log) => selectedIds.has(log.id)).length;
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
                ? "border-[var(--zc-primary)] bg-[var(--zc-primary-soft)]"
                : "border-transparent hover:border-[var(--zc-border)] hover:bg-[var(--zc-surface-raised)]"
            )}
            onClick={() => onActiveBatch(batch.id)}
          >
            <BatchCheckbox batch={batch} selectedIds={selectedIds} onChange={(checked) => onToggleBatch(batch, checked)} t={t} />
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                {first?.status === "success" ? <Check size={15} className="text-[var(--zc-success-text)]" aria-hidden="true" /> : <Circle size={15} className="text-[var(--muted)]" aria-hidden="true" />}
                <strong className="truncate text-sm">{batch.createdAt ? new Date(Number(batch.createdAt) || batch.createdAt).toLocaleString() : t("historyBatch")}</strong>
              </div>
              <span className="mt-1 block truncate text-xs text-[var(--muted)]" title={first?.path_after || first?.target_path}>
                {first ? formatDisplayPath(first.path_after || first.target_path) : t("historyBatch")}
              </span>
              <span className="mt-1 block text-xs text-[var(--muted)]">
                {t("historyBatchItems").replace("{count}", String(batch.total))} · {batch.restorable} {t("restorable")}
              </span>
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
