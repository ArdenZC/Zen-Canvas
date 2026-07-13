import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { History, RotateCcw, Search, ShieldCheck, Trash2 } from "lucide-react";
import { tauriApi } from "../../api/tauriApi";
import { useChromeContext } from "../../contexts/AppContexts";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useOperationQueueStore } from "../../store/useOperationQueueStore";
import type { CleanupRestorePreviewItem, CleanupTrashBatch, CleanupTrashItem, OperationLog } from "../../types/domain";
import { formatBytes } from "../../utils/format";
import { buttonGhost, cn, contentPanel, emptyState, glassButtonPrimary } from "../../utils/tw";
import { OperationProgressPanel } from "../timeline/TimelineView";
import { ConfirmDialog, mutedText, pageSurface, panelSurface } from "../shared/ui";
import { HistoryBatchList } from "../history/HistoryBatchList";
import { CleanupInspector, HistoryInspector } from "../history/HistoryInspector";
import {
  cleanupBatchRestorableCount,
  filterCleanupBatches,
  filterHistoryBatches,
  groupCleanupBatches,
  groupOperationLogs,
  historyTime,
  resolveCleanupRestoreSelection,
  resolveHistorySummary,
  resolveOperationRestoreSelection,
  selectionForOperationBatch,
  type HistoryFilter,
  type OperationHistoryBatch
} from "../history/historyModel";

type ViewFilter = HistoryFilter | "cleanup";

function replace(text: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((result, [key, value]) => result.replace(`{${key}}`, String(value)), text);
}

function formatDate(value: string, t: ReturnType<typeof useChromeContext>["t"]) {
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

export function RestoreView() {
  const { t } = useChromeContext();
  const logs = useOperationQueueStore((state) => state.operationLogs);
  const restoreIntent = useOperationQueueStore((state) => state.restoreIntent);
  const prepareOperationRestoreIntent = useOperationQueueStore((state) => state.prepareOperationRestoreIntent);
  const prepareCleanupRestoreIntent = useOperationQueueStore((state) => state.prepareCleanupRestoreIntent);
  const confirmOperationRestore = useOperationQueueStore((state) => state.confirmOperationRestore);
  const confirmCleanupRestore = useOperationQueueStore((state) => state.confirmCleanupRestore);
  const invalidateRestoreIntent = useOperationQueueStore((state) => state.invalidateRestoreIntent);
  const refreshOperationLogs = useOperationQueueStore((state) => state.refreshOperationLogs);
  const operationProgress = useOperationQueueStore((state) => state.operationProgress);
  const activeOperationKind = useOperationQueueStore((state) => state.activeOperationKind);
  const isOperationCanceling = useOperationQueueStore((state) => state.isOperationCanceling);
  const cancelOperations = useOperationQueueStore((state) => state.cancelOperations);
  const cancelCleanupRestore = useOperationQueueStore((state) => state.cancelCleanupRestore);
  const cleanupRestoreProgress = useOperationQueueStore((state) => state.cleanupRestoreProgress);
  const cleanupRestoreResult = useOperationQueueStore((state) => state.cleanupRestoreResult);
  const lastRestoreResult = useOperationQueueStore((state) => state.lastRestoreResult);
  const lastRestoreSummary = useOperationQueueStore((state) => state.lastRestoreSummary);
  const restoreError = useOperationQueueStore((state) => state.restoreError);
  const cleanupRestoreError = useOperationQueueStore((state) => state.cleanupRestoreError);
  const restoreTechnicalError = useOperationQueueStore((state) => state.restoreTechnicalError);
  const [cleanupBatches, setCleanupBatches] = useState<CleanupTrashBatch[]>([]);
  const [cleanupPreviewItems, setCleanupPreviewItems] = useState<CleanupRestorePreviewItem[]>([]);
  const [cleanupLoadError, setCleanupLoadError] = useState("");
  const [activeBatchId, setActiveBatchId] = useState("");
  const [activeCleanupBatchId, setActiveCleanupBatchId] = useState("");
  const [selectedOperationIds, setSelectedOperationIds] = useState<Set<string>>(new Set());
  const [selectedCleanupIds, setSelectedCleanupIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ViewFilter>("all");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [narrowPane, setNarrowPane] = useState<"list" | "details">("list");
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const confirmTriggerRef = useRef<HTMLButtonElement | null>(null);
  const inspectorScrollRef = useRef<HTMLDivElement | null>(null);
  const isNarrow = useMediaQuery("(max-width: 980px)");

  const operationBatches = useMemo(() => {
    const grouped = groupOperationLogs(logs);
    return filterHistoryBatches(grouped, query, filter === "cleanup" ? "all" : filter);
  }, [filter, logs, query]);
  const cleanup = useMemo(
    () => filterCleanupBatches(groupCleanupBatches(cleanupBatches), query, cleanupPreviewItems),
    [cleanupBatches, cleanupPreviewItems, query]
  );
  const activeBatch = operationBatches.find((batch) => batch.id === activeBatchId) ?? operationBatches[0];
  const activeCleanupBatch = cleanup.find((batch) => batch.id === activeCleanupBatchId) ?? cleanup[0];
  const operationSelection = useMemo(
    () => resolveOperationRestoreSelection(logs, selectedOperationIds),
    [logs, selectedOperationIds]
  );
  const cleanupSelection = useMemo(
    () => resolveCleanupRestoreSelection(cleanupPreviewItems, selectedCleanupIds),
    [cleanupPreviewItems, selectedCleanupIds]
  );
  const cleanupPreviewById = useMemo(
    () => new Map(cleanupPreviewItems.map((item) => [item.id, item])),
    [cleanupPreviewItems]
  );
  const selectedCleanupItems = useMemo(
    () => cleanup.flatMap((batch) => batch.items).filter((item) => selectedCleanupIds.has(item.id)),
    [cleanup, selectedCleanupIds]
  );
  const selectedMode = selectedOperationIds.size > 0 ? "operation_logs" : selectedCleanupIds.size > 0 ? "cleanup_trash" : null;
  const selectedResolution = selectedMode === "operation_logs" ? operationSelection : cleanupSelection;
  const selectedCount = selectedResolution.selectedCount;
  const executableCount = selectedResolution.executableCount;
  const excludedCount = selectedResolution.excludedCount;
  const summary = useMemo(
    () => resolveHistorySummary(logs, cleanupBatches.flatMap((batch) => batch.items), cleanupPreviewItems),
    [cleanupBatches, cleanupPreviewItems, logs]
  );
  const restoreProgress = operationProgress?.kind === "restore" ? operationProgress : null;
  const busy = Boolean(restoreProgress) || Boolean(cleanupRestoreProgress) || isPreparing || activeOperationKind === "restore";
  const showCleanup = filter === "cleanup";
  const visibleError = selectedMode === "cleanup_trash" ? cleanupRestoreError : restoreError;

  const refreshCleanup = useCallback(async () => {
    try {
      setCleanupLoadError("");
      const batches = await tauriApi.listCleanupTrashBatches();
      const previews = await Promise.all(
        batches.map(async (batch) => {
          try {
            return await tauriApi.previewRestoreCleanupTrash(batch.id);
          } catch {
            return { batchId: batch.id, items: [] };
          }
        })
      );
      setCleanupBatches(batches);
      setCleanupPreviewItems(previews.flatMap((preview) => preview.items));
    } catch (error) {
      setCleanupLoadError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    void refreshOperationLogs().catch(() => undefined);
    void refreshCleanup();
  }, [refreshCleanup, refreshOperationLogs]);

  useEffect(() => {
    if (!activeBatchId || !operationBatches.some((batch) => batch.id === activeBatchId)) setActiveBatchId(operationBatches[0]?.id ?? "");
  }, [activeBatchId, operationBatches]);

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
    setSelectedOperationIds(new Set());
    setSelectedCleanupIds(new Set());
    invalidateRestoreIntent();
  }, [filter, invalidateRestoreIntent, query]);

  useEffect(() => () => invalidateRestoreIntent(), [invalidateRestoreIntent]);

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
    invalidateRestoreIntent();
    setSelectedCleanupIds(new Set());
    setSelectedOperationIds((current) => selectionForOperationBatch(current, batch.logs, checked));
  }

  function toggleOperation(log: OperationLog, checked: boolean) {
    invalidateRestoreIntent();
    setSelectedCleanupIds(new Set());
    setSelectedOperationIds((current) => {
      const next = new Set(current);
      if (checked) next.add(log.id);
      else next.delete(log.id);
      return next;
    });
  }

  function toggleCleanup(item: CleanupTrashItem, checked: boolean) {
    invalidateRestoreIntent();
    setSelectedOperationIds(new Set());
    setSelectedCleanupIds((current) => {
      const next = new Set(current);
      if (checked) next.add(item.id);
      else next.delete(item.id);
      return next;
    });
  }

  function changeFilter(next: ViewFilter) {
    setFilter(next);
    setSelectedOperationIds(new Set());
    setSelectedCleanupIds(new Set());
    invalidateRestoreIntent();
  }

  async function prepareConfirmation() {
    if (busy) return;
    setIsPreparing(true);
    setShowTechnicalDetails(false);
    try {
      const intent = selectedMode === "operation_logs"
        ? await prepareOperationRestoreIntent(selectedOperationIds)
        : selectedMode === "cleanup_trash"
          ? await prepareCleanupRestoreIntent(selectedCleanupItems)
          : null;
      if (intent) setConfirmOpen(true);
    } finally {
      setIsPreparing(false);
    }
  }

  async function confirmRestore() {
    if (!restoreIntent) return;
    const outcome = restoreIntent.source === "operation_logs"
      ? await confirmOperationRestore(restoreIntent.sessionId)
      : await confirmCleanupRestore(restoreIntent.sessionId);
    if (outcome.status !== "executed") return;
    setConfirmOpen(false);
    if (restoreIntent.source === "operation_logs") setSelectedOperationIds(new Set());
    else {
      setSelectedCleanupIds(new Set());
      await refreshCleanup();
    }
  }

  function cancelConfirmation() {
    setConfirmOpen(false);
    invalidateRestoreIntent();
  }

  const filterButtons: Array<{ value: ViewFilter; key: Parameters<typeof t>[0] }> = [
    { value: "all", key: "historyFilterAll" },
    { value: "restorable", key: "historyFilterRestorable" },
    { value: "restored", key: "historyFilterRestored" },
    { value: "success", key: "historyFilterSuccess" },
    { value: "failed", key: "historyFilterFailed" },
    { value: "skipped", key: "historyFilterSkipped" },
    { value: "canceled", key: "historyFilterCanceled" },
    { value: "needsReview", key: "historyFilterNeedsReview" },
    { value: "cleanup", key: "historyFilterCleanup" }
  ];
  const intentCount = restoreIntent?.executableCount ?? executableCount;
  const intentExcluded = restoreIntent?.excludedCount ?? excludedCount;
  const confirmDescription = restoreIntent
    ? replace(t("historyRestoreConfirmDesc"), { count: intentCount })
      + (intentExcluded ? `\n${replace(t("historyRestoreConfirmExcluded"), { count: intentExcluded })}` : "")
    : "";
  const confirmError = visibleError && restoreIntent ? `\n${visibleError}` : undefined;

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
            { label: t("historySummaryOperations"), value: summary.operations, hint: `${summary.operationRestorable} ${t("restorable")}` },
            { label: t("historySummaryRestorable"), value: summary.restorable, hint: `${t("historySummaryOperationRestorable")}: ${summary.operationRestorable} · ${t("historySummaryCleanupRestorable")}: ${summary.cleanupRestorable}` },
            { label: t("historySummaryRestored"), value: summary.restored, hint: t("historyRestoreSuccess") },
            { label: t("historySummaryExcluded"), value: summary.unavailable, hint: t("historyStatusUnavailable") }
          ].map((card) => <div key={card.label} className={cn(contentPanel, "p-3")}><span className="block text-xs text-[var(--muted)]">{card.label}</span><strong className="mt-1 block text-lg tabular-nums">{card.value}</strong><span className="mt-1 block truncate text-[11px] text-[var(--muted)]" title={card.hint}>{card.hint}</span></div>)}
        </div>

        <section className={cn(panelSurface, "grid gap-4 p-4 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]")}>
          <div className={cn("grid min-w-0 gap-3", isNarrow && narrowPane === "details" && "hidden")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{showCleanup ? t("historyCleanupScope") : t("historyBatches")}</h2>
              <span className="text-xs text-[var(--muted)] tabular-nums">{showCleanup ? cleanup.length : operationBatches.length}</span>
            </div>
            <label className="relative block"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.currentTarget.value)} className="w-full rounded-[var(--zc-radius-field)] border border-[var(--zc-control-border)] bg-[var(--zc-surface)] py-2 pl-9 pr-3 text-sm" placeholder={t("historySearchPlaceholder")} aria-label={t("historySearchPlaceholder")} /></label>
            <div className="flex max-w-full flex-wrap gap-1" role="group" aria-label={t("historyBatches")}>
              {filterButtons.map(({ value, key }) => <button key={value} type="button" className={cn(buttonGhost, "shrink-0", filter === value && "bg-[var(--zc-primary-soft)] text-[var(--zc-primary)]")} onClick={() => changeFilter(value)}>{t(key)}</button>)}
            </div>
            {!showCleanup && operationBatches.length > 0 && <HistoryBatchList batches={operationBatches} activeBatchId={activeBatch?.id ?? ""} selectedIds={selectedOperationIds} onActiveBatch={(id) => { setActiveBatchId(id); if (isNarrow) setNarrowPane("details"); }} onToggleBatch={toggleBatch} t={t} />}
            {!showCleanup && operationBatches.length === 0 && <div className={emptyState}>{query ? t("historyNoMatches") : t("historyNoRecords")}</div>}
            {showCleanup && cleanup.length > 0 && <div className="grid gap-2">{cleanup.map((batch) => <button key={batch.id} type="button" className={cn(rowButton, batch.id === activeCleanupBatch?.id && "border-[var(--zc-primary)] bg-[var(--zc-primary-soft)]")} onClick={() => { setActiveCleanupBatchId(batch.id); if (isNarrow) setNarrowPane("details"); }}><span className="min-w-0 text-left"><strong className="block text-sm">{formatDate(batch.createdAt, t)}</strong><span className="block truncate text-xs text-[var(--muted)]">{batch.totalItems} · {formatBytes(batch.totalSize)} · {cleanupBatchRestorableCount(batch, cleanupPreviewItems)} {t("restorable")}</span></span><Trash2 size={15} aria-hidden="true" /></button>)}</div>}
            {showCleanup && cleanup.length === 0 && <div className={emptyState}>{query ? t("historyNoMatches") : cleanupLoadError || t("cleanupTrashEmpty")}</div>}
          </div>

          <div ref={inspectorScrollRef} className={cn("min-w-0 max-h-[min(72vh,760px)] overflow-y-auto", isNarrow && narrowPane === "list" && "hidden")}>
            {showCleanup
              ? <CleanupInspector batch={activeCleanupBatch} previewById={cleanupPreviewById} selectedIds={selectedCleanupIds} onToggle={toggleCleanup} t={t} />
              : <HistoryInspector batch={activeBatch} selectedIds={selectedOperationIds} onToggle={toggleOperation} onBack={isNarrow ? () => setNarrowPane("list") : undefined} t={t} />}
          </div>
        </section>

        {selectedCount > 0 && <div className={cn(contentPanel, "sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 p-3 shadow-[var(--zc-shadow-floating)]")}><div className="min-w-0"><strong className="block text-sm tabular-nums">{replace(t("historySelectedCount"), { count: selectedCount })}</strong><span className="block text-xs text-[var(--muted)] tabular-nums">{replace(t("historyExecutableCount"), { count: executableCount })} · {replace(t("historyExcludedCount"), { count: excludedCount })}</span></div><button ref={confirmTriggerRef} type="button" className={glassButtonPrimary} disabled={!executableCount || busy} onClick={() => void prepareConfirmation()}><RotateCcw size={16} />{busy ? t("restoring") : replace(t("historyRestoreActionCount"), { count: executableCount })}</button></div>}

        {restoreProgress && <OperationProgressPanel progress={restoreProgress} isCanceling={isOperationCanceling} onCancel={cancelOperations} t={t} />}
        {cleanupRestoreProgress && <section className={cn(contentPanel, "grid gap-2 p-4")} aria-live="polite"><strong className="text-sm">{t("historyCleanupProgressTitle")}</strong><p className={mutedText}>{replace(t("historyCleanupProgressLine"), { processed: cleanupRestoreProgress.processed, total: cleanupRestoreProgress.total, path: cleanupRestoreProgress.currentPath || cleanupRestoreProgress.currentItemId || "-" })}</p><p className={cn(mutedText, "tabular-nums")}>{replace(t("historyCleanupProgressCounts"), { restored: cleanupRestoreProgress.restored, conflicts: cleanupRestoreProgress.conflicts, missing: cleanupRestoreProgress.missing, failed: cleanupRestoreProgress.failed, canceled: cleanupRestoreProgress.canceled })}</p><button type="button" className="justify-self-start text-sm text-[var(--zc-primary)] disabled:opacity-60" disabled={cleanupRestoreProgress.cancelRequested} onClick={() => void cancelCleanupRestore()}>{cleanupRestoreProgress.cancelRequested ? t("operationCanceling") : t("cancel")}</button></section>}

        {(lastRestoreResult.length > 0 || cleanupRestoreResult || lastRestoreSummary || visibleError || restoreTechnicalError) && <section className={cn(contentPanel, "grid gap-2 p-4")} aria-live="polite"><strong className="text-sm">{t("historyRestoreResultTitle")}</strong>{cleanupRestoreResult && lastRestoreSummary ? <p className={mutedText}>{replace(t("historyCleanupRestoreResultLine"), { restored: lastRestoreSummary.restored, conflicts: lastRestoreSummary.conflicts, missing: lastRestoreSummary.missing, failed: lastRestoreSummary.failed, canceled: lastRestoreSummary.canceled, excluded: lastRestoreSummary.excluded })}</p> : lastRestoreSummary ? <p className={mutedText}>{replace(t("historyRestoreResultLine"), { restored: lastRestoreSummary.restored, failed: lastRestoreSummary.failed, skipped: lastRestoreSummary.skipped, canceled: lastRestoreSummary.canceled, excluded: lastRestoreSummary.excluded })}</p> : null}{visibleError && <p className="text-sm text-[var(--zc-danger-text)]">{visibleError}</p>}{restoreTechnicalError && <div><button type="button" className="text-xs text-[var(--zc-primary)]" aria-expanded={showTechnicalDetails} onClick={() => setShowTechnicalDetails((value) => !value)}>{showTechnicalDetails ? t("historyRestoreHideTechnical") : t("historyRestoreShowTechnical")}</button>{showTechnicalDetails && <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-[var(--zc-radius-control)] bg-[var(--zc-surface-subtle)] p-2 text-[11px] text-[var(--muted)]">{restoreTechnicalError}</pre>}</div>}</section>}
      </div>

      <ConfirmDialog open={confirmOpen} tone={restoreIntent?.source === "cleanup_trash" ? "warning" : "default"} title={t("historyRestoreConfirmTitle")} description={confirmDescription + (confirmError ?? "")} emphasis={restoreIntent ? `${replace(t("historySelectedCount"), { count: restoreIntent.selectedCount })} · ${replace(t("historyExecutableCount"), { count: restoreIntent.executableCount })} · ${replace(t("historyExcludedCount"), { count: restoreIntent.excludedCount })}` : undefined} confirmLabel={replace(t("historyRestoreActionCount"), { count: intentCount })} cancelLabel={t("cancel")} isProcessing={busy} restoreFocus={() => confirmTriggerRef.current} onCancel={cancelConfirmation} onConfirm={() => void confirmRestore()} />
    </div>
  );
}

const rowButton = "flex w-full items-center justify-between gap-3 rounded-[var(--zc-radius-field)] border border-transparent px-3 py-2 text-left transition-colors hover:border-[var(--zc-border)] hover:bg-[var(--zc-surface-raised)]";
