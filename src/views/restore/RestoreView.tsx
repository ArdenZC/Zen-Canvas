import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { History, RotateCcw, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { tauriApi } from "../../api/tauriApi";
import { useChromeContext } from "../../contexts/AppContexts";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useOperationQueueStore } from "../../store/useOperationQueueStore";
import type { CleanupRestoreResult, CleanupTrashBatch, CleanupTrashItem, OperationLog } from "../../types/domain";
import { formatBytes } from "../../utils/format";
import { buttonGhost, cn, contentPanel, emptyState, glassButtonPrimary } from "../../utils/tw";
import { OperationProgressPanel } from "../timeline/TimelineView";
import { ConfirmDialog, mutedText, pageSurface, panelSurface } from "../shared/ui";
import { HistoryBatchList } from "../history/HistoryBatchList";
import { CleanupInspector, HistoryInspector } from "../history/HistoryInspector";
import {
  cleanupBatchRestorableCount,
  filterHistoryBatches,
  groupCleanupBatches,
  groupOperationLogs,
  historyTime,
  isRestorableCleanupTrashItem,
  resolveOperationRestoreSelection,
  selectionForOperationBatch,
  type OperationHistoryBatch
} from "../history/historyModel";

type HistoryFilter = "all" | "restorable" | "needsReview" | "cleanup";

function replace(text: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((result, [key, value]) => result.replace(`{${key}}`, String(value)), text);
}

function formatDate(value: string) {
  const numeric = Number(value);
  const timestamp = Number.isFinite(numeric) && numeric > 0 ? numeric : Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "-";
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
}

export function RestoreView() {
  const { t } = useChromeContext();
  const logs = useOperationQueueStore((state) => state.operationLogs);
  const restoreOperationLogs = useOperationQueueStore((state) => state.restoreOperationLogs);
  const refreshOperationLogs = useOperationQueueStore((state) => state.refreshOperationLogs);
  const operationProgress = useOperationQueueStore((state) => state.operationProgress);
  const isOperationCanceling = useOperationQueueStore((state) => state.isOperationCanceling);
  const cancelOperations = useOperationQueueStore((state) => state.cancelOperations);
  const lastRestoreResult = useOperationQueueStore((state) => state.lastRestoreResult);
  const restoreError = useOperationQueueStore((state) => state.restoreError);
  const [cleanupBatches, setCleanupBatches] = useState<CleanupTrashBatch[]>([]);
  const [cleanupResult, setCleanupResult] = useState<CleanupRestoreResult | null>(null);
  const [cleanupError, setCleanupError] = useState("");
  const [activeBatchId, setActiveBatchId] = useState("");
  const [activeCleanupBatchId, setActiveCleanupBatchId] = useState("");
  const [selectedOperationIds, setSelectedOperationIds] = useState<Set<string>>(new Set());
  const [selectedCleanupIds, setSelectedCleanupIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isRestoringCleanup, setIsRestoringCleanup] = useState(false);
  const [narrowPane, setNarrowPane] = useState<"list" | "details">("list");
  const confirmTriggerRef = useRef<HTMLButtonElement | null>(null);
  const inspectorScrollRef = useRef<HTMLDivElement | null>(null);
  const isNarrow = useMediaQuery("(max-width: 980px)");

  const batches = useMemo(() => {
    const grouped = groupOperationLogs(logs);
    const filtered = filterHistoryBatches(grouped, query);
    if (filter === "restorable") return filtered.filter((batch) => batch.restorable > 0);
    if (filter === "needsReview") return filtered.filter((batch) => batch.excluded > 0);
    return filter === "cleanup" ? [] : filtered;
  }, [filter, logs, query]);
  const cleanup = useMemo(() => groupCleanupBatches(cleanupBatches), [cleanupBatches]);
  const activeBatch = batches.find((batch) => batch.id === activeBatchId) ?? batches[0];
  const activeCleanupBatch = cleanup.find((batch) => batch.id === activeCleanupBatchId) ?? cleanup[0];
  const operationSelection = useMemo(() => resolveOperationRestoreSelection(logs, selectedOperationIds), [logs, selectedOperationIds]);
  const selectedCleanupItems = useMemo(
    () => cleanup.flatMap((batch) => batch.items).filter((item) => selectedCleanupIds.has(item.id) && isRestorableCleanupTrashItem(item)),
    [cleanup, selectedCleanupIds]
  );
  const selectedCount = operationSelection.executable.length || selectedCleanupItems.length;
  const excludedCount = operationSelection.excludedCount;
  const restoreProgress = operationProgress?.kind === "restore" ? operationProgress : null;
  const busy = Boolean(restoreProgress) || isRestoringCleanup || isPreparing;

  const refreshCleanup = useCallback(async () => {
    try {
      setCleanupError("");
      setCleanupBatches(await tauriApi.listCleanupTrashBatches());
    } catch (error) {
      setCleanupError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    void refreshOperationLogs().catch(() => undefined);
    void refreshCleanup();
  }, [refreshCleanup, refreshOperationLogs]);

  useEffect(() => {
    if (!activeBatchId || !batches.some((batch) => batch.id === activeBatchId)) setActiveBatchId(batches[0]?.id ?? "");
  }, [activeBatchId, batches]);

  useEffect(() => {
    if (!activeCleanupBatchId || !cleanup.some((batch) => batch.id === activeCleanupBatchId)) setActiveCleanupBatchId(cleanup[0]?.id ?? "");
  }, [activeCleanupBatchId, cleanup]);

  useEffect(() => {
    if (!isNarrow) setNarrowPane("list");
  }, [isNarrow]);

  useEffect(() => {
    inspectorScrollRef.current?.scrollTo?.({ top: 0 });
  }, [activeBatch?.id, activeCleanupBatch?.id, filter]);

  useEffect(() => {
    if (!isNarrow || narrowPane !== "details" || confirmOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setNarrowPane("list");
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirmOpen, isNarrow, narrowPane]);

  function toggleBatch(batch: OperationHistoryBatch, checked: boolean) {
    setSelectedCleanupIds(new Set());
    setSelectedOperationIds((current) => selectionForOperationBatch(current, batch.logs, checked));
  }

  function toggleOperation(log: OperationLog, checked: boolean) {
    setSelectedCleanupIds(new Set());
    setSelectedOperationIds((current) => {
      const next = new Set(current);
      if (checked) next.add(log.id); else next.delete(log.id);
      return next;
    });
  }

  function toggleCleanup(item: CleanupTrashItem, checked: boolean) {
    setSelectedOperationIds(new Set());
    setSelectedCleanupIds((current) => {
      const next = new Set(current);
      if (checked && isRestorableCleanupTrashItem(item)) next.add(item.id); else next.delete(item.id);
      return next;
    });
  }

  function changeFilter(next: HistoryFilter) {
    setFilter(next);
    if (next === "cleanup") setSelectedOperationIds(new Set());
    else setSelectedCleanupIds(new Set());
  }

  async function restoreSelected() {
    setConfirmOpen(false);
    if (operationSelection.executable.length) {
      await restoreOperationLogs(operationSelection.executableIds);
      return;
    }
    if (!selectedCleanupItems.length) return;
    setIsRestoringCleanup(true);
    setCleanupError("");
    try {
      const result = await tauriApi.restoreCleanupTrashItems(selectedCleanupItems.map((item) => item.id));
      setCleanupResult(result);
      setSelectedCleanupIds(new Set());
      await refreshCleanup();
    } catch (error) {
      setCleanupError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRestoringCleanup(false);
    }
  }

  async function prepareConfirmation() {
    if (busy) return;
    setIsPreparing(true);
    setRestoreErrorForPreparation("");
    try {
      if (selectedCleanupItems.length) {
        const batchIds = [...new Set(selectedCleanupItems.map((item) => item.batchId))];
        const previews = await Promise.all(batchIds.map((batchId) => tauriApi.previewRestoreCleanupTrash(batchId)));
        const previewItems = previews.flatMap((preview) => preview.items);
        const previewById = new Map(previewItems.map((item) => [item.id, item]));
        const nextSelection = new Set([...selectedCleanupIds].filter((id) => {
          const previewItem = previewById.get(id);
          return Boolean(previewItem && isRestorableCleanupTrashItem(previewItem));
        }));
        setSelectedCleanupIds(nextSelection);
        if (!nextSelection.size) {
          setCleanupError(t("restoreNoExecutableSelected"));
          return;
        }
      } else {
        const authoritative = await refreshOperationLogs();
        const latest = resolveOperationRestoreSelection(authoritative, selectedOperationIds);
        if (!latest.executable.length) {
          setRestoreErrorForPreparation(t("restoreNoExecutableSelected"));
          return;
        }
      }
      setConfirmOpen(true);
    } catch (error) {
      setRestoreErrorForPreparation(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPreparing(false);
    }
  }

  function setRestoreErrorForPreparation(message: string) {
    if (message) useOperationQueueStore.setState({ restoreError: message });
    else if (restoreError) useOperationQueueStore.setState({ restoreError: "" });
  }

  const summary = {
    operations: logs.length,
    restorable: logs.filter((log) => resolveOperationRestoreSelection([log], new Set([log.id])).executable.length > 0).length,
    restored: logs.filter((log) => log.restore_status === "restored").length,
    excluded: logs.filter((log) => !resolveOperationRestoreSelection([log], new Set([log.id])).executable.length).length
  };
  const showCleanup = filter === "cleanup" || cleanup.length > 0;
  const resultCount = lastRestoreResult.length;
  const resultRestored = lastRestoreResult.filter((log) => log.restore_status === "restored").length;
  const resultFailed = lastRestoreResult.filter((log) => log.restore_status === "failed" || log.status === "failed").length;

  return (
    <div className={pageSurface}>
      <div className="mx-auto grid max-w-[1500px] gap-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2"><History size={20} className="text-[var(--zc-primary)]" aria-hidden="true" /><h2 className="text-xl font-semibold">{t("historyWorkspaceTitle")}</h2></div>
            <p className={cn(mutedText, "mt-1 max-w-2xl")}>{t("historyWorkspaceDesc")}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]"><ShieldCheck size={16} aria-hidden="true" />{t("restoreDesc")}</div>
        </header>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            [t("historySummaryOperations"), summary.operations],
            [t("historySummaryRestorable"), summary.restorable],
            [t("historySummaryRestored"), summary.restored],
            [t("historySummaryExcluded"), summary.excluded]
          ].map(([label, value]) => <div key={String(label)} className={cn(contentPanel, "p-3")}><span className="block text-xs text-[var(--muted)]">{label}</span><strong className="mt-1 block text-lg tabular-nums">{value}</strong></div>)}
        </div>

        <section className={cn(panelSurface, "grid gap-4 p-4 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]")}>
          <div className={cn("grid gap-3", isNarrow && narrowPane === "details" && "hidden")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{t("historyBatches")}</h2>
              <span className="text-xs text-[var(--muted)]">{batches.length}</span>
            </div>
            <label className="relative block"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.currentTarget.value)} className="w-full rounded-[var(--zc-radius-field)] border border-[var(--zc-control-border)] bg-[var(--zc-surface)] py-2 pl-9 pr-3 text-sm" placeholder={t("historySearchPlaceholder")} aria-label={t("historySearchPlaceholder")} /></label>
            <div className="flex flex-wrap gap-1" role="group" aria-label={t("historyBatches")}>
              {(["all", "restorable", "needsReview", "cleanup"] as HistoryFilter[]).map((value) => <button key={value} type="button" className={cn(buttonGhost, filter === value && "bg-[var(--zc-primary-soft)] text-[var(--zc-primary)]")} onClick={() => changeFilter(value)}>{t(value === "all" ? "historyFilterAll" : value === "restorable" ? "historyFilterRestorable" : value === "needsReview" ? "historyFilterNeedsReview" : "historyFilterCleanup")}</button>)}
            </div>
            {filter !== "cleanup" && batches.length > 0 && <HistoryBatchList batches={batches} activeBatchId={activeBatch?.id ?? ""} selectedIds={selectedOperationIds} onActiveBatch={(id) => { setActiveBatchId(id); if (isNarrow) setNarrowPane("details"); }} onToggleBatch={toggleBatch} t={t} />}
            {filter !== "cleanup" && batches.length === 0 && <div className={emptyState}>{query ? t("historyNoMatches") : t("historyNoRecords")}</div>}
             {showCleanup && <div className="grid gap-2 border-t border-[var(--zc-border)] pt-3"><div className="flex items-center justify-between"><strong className="text-sm">{t("historyCleanupScope")}</strong><span className="text-xs text-[var(--muted)]">{cleanup.length}</span></div>{cleanup.length ? cleanup.map((batch) => <button key={batch.id} type="button" className={cn(rowButton, batch.id === activeCleanupBatch?.id && "border-[var(--zc-primary)] bg-[var(--zc-primary-soft)]")} onClick={() => { setActiveCleanupBatchId(batch.id); changeFilter("cleanup"); if (isNarrow) setNarrowPane("details"); }}><span className="min-w-0 text-left"><strong className="block text-sm">{formatDate(batch.createdAt)}</strong><span className="block text-xs text-[var(--muted)]">{batch.totalItems} · {formatBytes(batch.totalSize)} · {cleanupBatchRestorableCount(batch)} {t("restorable")}</span></span><Trash2 size={15} aria-hidden="true" /></button>) : <p className={mutedText}>{t("cleanupTrashEmpty")}</p>}</div>}
          </div>

           <div ref={inspectorScrollRef} className={cn("min-w-0 max-h-[min(72vh,760px)] overflow-y-auto", isNarrow && narrowPane === "list" && "hidden")}>
            {filter === "cleanup" ? <CleanupInspector batch={activeCleanupBatch} selectedIds={selectedCleanupIds} onToggle={toggleCleanup} t={t} /> : <HistoryInspector batch={activeBatch} selectedIds={selectedOperationIds} onToggle={toggleOperation} onBack={isNarrow ? () => setNarrowPane("list") : undefined} t={t} />}
          </div>
        </section>

         {(operationSelection.selectedCount > 0 || selectedCleanupItems.length > 0) && <div className={cn(contentPanel, "sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 p-3 shadow-[var(--zc-shadow-floating)]")}><div className="min-w-0"><strong className="text-sm">{replace(t("historyBatchSelected"), { count: selectedCount })}</strong>{excludedCount > 0 && <span className="ml-2 text-xs text-[var(--muted)]">{replace(t("historyExcludedCount"), { count: excludedCount })}</span>}</div><button ref={confirmTriggerRef} type="button" className={glassButtonPrimary} disabled={!selectedCount || busy} onClick={() => void prepareConfirmation()}><RotateCcw size={16} />{busy ? t("restoring") : t("historyRestoreAction")}</button></div>}

        {restoreProgress && <OperationProgressPanel progress={restoreProgress} isCanceling={isOperationCanceling} onCancel={cancelOperations} t={t} />}
        {(resultCount > 0 || restoreError || cleanupResult || cleanupError) && <section className={cn(contentPanel, "grid gap-2 p-4")} aria-live="polite"><strong className="text-sm">{t("historyRestoreResultTitle")}</strong>{resultCount > 0 && <p className={mutedText}>{replace(t("historyRestoreResultLine"), { restored: resultRestored, failed: resultFailed, excluded: Math.max(0, resultCount - resultRestored - resultFailed) })}</p>}{cleanupResult && <p className={mutedText}>{replace(t("historyRestoreResultLine"), { restored: cleanupResult.restored, failed: cleanupResult.failed + cleanupResult.conflicts, excluded: cleanupResult.missing })}</p>}{(restoreError || cleanupError) && <p className="text-sm text-[var(--zc-danger-text)]">{restoreError || cleanupError}</p>}</section>}
      </div>

      <ConfirmDialog open={confirmOpen} tone={selectedCleanupItems.length ? "warning" : "default"} title={t("historyRestoreConfirmTitle")} description={replace(t("historyRestoreConfirmDesc"), { count: selectedCount }) + (excludedCount ? `\n${replace(t("historyRestoreConfirmExcluded"), { count: excludedCount })}` : "")} emphasis={selectedCleanupItems.length ? t("historyCleanupRestoreDesc") : undefined} confirmLabel={t("historyRestoreAction")} cancelLabel={t("cancel")} isProcessing={busy} restoreFocus={() => confirmTriggerRef.current} onCancel={() => setConfirmOpen(false)} onConfirm={() => void restoreSelected()} />
    </div>
  );
}

const rowButton = "flex w-full items-center justify-between gap-3 rounded-[var(--zc-radius-field)] border border-transparent px-3 py-2 text-left transition-colors hover:border-[var(--zc-border)] hover:bg-[var(--zc-surface-raised)]";
