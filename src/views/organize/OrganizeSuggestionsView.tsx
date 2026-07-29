import { useVirtualizer } from "@tanstack/react-virtual";
import { Check, CircleMinus, Edit3, History, ListRestart, Play, Plus, RefreshCw, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useChromeContext } from "../../contexts/AppContexts";
import {
  useFileLibraryQueryStore,
  useFileLibraryResultStore,
  useFileLibrarySelectionStore
} from "../../store/useFileLibraryV2Store";
import { useOrganizationPlanStore } from "../../store/useOrganizationPlanStore";
import type { LibrarySelectionV1, OrganizationPlanItem } from "../../types/domain";
import { buttonGhost, buttonSecondary, buttonSubtle, cn, contentSurface, glassButtonPrimary, inputSurface, raisedSurface } from "../../utils/tw";
import { ConfirmDialog, StateBlock, pageFrame } from "../shared/ui";

const ROW_HEIGHT = 74;

export function OrganizeSuggestionsView() {
  const { setView } = useChromeContext();
  const plans = useOrganizationPlanStore((state) => state.plans);
  const plan = useOrganizationPlanStore((state) => state.activePlan);
  const items = useOrganizationPlanStore((state) => state.items);
  const hasMore = useOrganizationPlanStore((state) => state.hasMore);
  const dryRun = useOrganizationPlanStore((state) => state.dryRun);
  const executionResult = useOrganizationPlanStore((state) => state.executionResult);
  const isLoading = useOrganizationPlanStore((state) => state.isLoading);
  const isMutating = useOrganizationPlanStore((state) => state.isMutating);
  const error = useOrganizationPlanStore((state) => state.error);
  const loadPlans = useOrganizationPlanStore((state) => state.loadPlans);
  const createPlan = useOrganizationPlanStore((state) => state.createPlan);
  const openPlan = useOrganizationPlanStore((state) => state.openPlan);
  const loadNextPage = useOrganizationPlanStore((state) => state.loadNextPage);
  const updateDecision = useOrganizationPlanStore((state) => state.updateDecision);
  const updateBatch = useOrganizationPlanStore((state) => state.updateBatch);
  const refreshPlan = useOrganizationPlanStore((state) => state.refreshPlan);
  const analyzeMissing = useOrganizationPlanStore((state) => state.analyzeMissing);
  const createDryRun = useOrganizationPlanStore((state) => state.createDryRun);
  const executeDryRun = useOrganizationPlanStore((state) => state.executeDryRun);
  const cancelPlan = useOrganizationPlanStore((state) => state.cancelPlan);
  const librarySelection = useFileLibrarySelectionStore((state) => state.selection);
  const query = useFileLibraryQueryStore((state) => state);
  const totalCount = useFileLibraryResultStore((state) => state.totalCount);
  const [activeId, setActiveId] = useState("");
  const [batchIds, setBatchIds] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState("");
  const [confirmExecution, setConfirmExecution] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    if (!plan && plans[0]) void openPlan(plans[0].id);
  }, [openPlan, plan, plans]);

  useEffect(() => {
    if (!items.length) {
      setActiveId("");
      return;
    }
    if (!items.some((item) => item.id === activeId)) setActiveId(items[0].id);
  }, [activeId, items]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8
  });
  const virtualRows = virtualizer.getVirtualItems();
  const activeItem = items.find((item) => item.id === activeId) ?? null;
  const mountedActiveId = virtualRows.some((row) => items[row.index]?.id === activeId)
    ? `organization-item-${activeId}`
    : undefined;
  const selectedItems = items.filter((item) => batchIds.has(item.id));
  const safeItems = selectedItems.filter(isSafeBatchItem);
  const needsAnalysisCount = items.filter((item) => item.validity === "needs_analysis").length;
  const acceptedCount = items.filter((item) => item.decision === "accepted" || item.decision === "edited").length;
  const canReview = plan && ["ready", "stale", "partially_completed"].includes(plan.status);
  const canDryRun = plan && ["ready", "partially_completed"].includes(plan.status) && acceptedCount > 0;

  useEffect(() => {
    const last = virtualRows.at(-1);
    if (last && hasMore && last.index >= items.length - 10 && !isLoading) void loadNextPage();
  }, [hasMore, isLoading, items.length, loadNextPage, virtualRows]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [contextMenu]);

  function planSource(): { source: LibrarySelectionV1; expectedCount: number } | null {
    if (librarySelection?.kind === "explicit") {
      return { source: librarySelection, expectedCount: librarySelection.fileIds.length };
    }
    if (librarySelection?.kind === "all_matching" && totalCount !== null) {
      return { source: librarySelection, expectedCount: totalCount };
    }
    if (query.fingerprint && query.snapshotRevision !== null && totalCount !== null) {
      return {
        source: {
          kind: "all_matching",
          query: query.spec,
          queryFingerprint: query.fingerprint,
          snapshotRevision: query.snapshotRevision,
          excludedFileIds: []
        },
        expectedCount: totalCount
      };
    }
    return null;
  }

  async function handleCreatePlan() {
    const source = planSource();
    if (!source) {
      setView("library");
      return;
    }
    await createPlan(source.source, source.expectedCount, title);
    setTitle("");
  }

  function toggleBatch(itemId: string) {
    setBatchIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  async function mutate(item: OrganizationPlanItem | null, decision: "accepted" | "kept" | "undecided", edited?: string) {
    if (!item || !canReview) return;
    await updateDecision(item, edited ? "edited" : decision, edited);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey || !items.length) return;
    const index = Math.max(0, items.findIndex((item) => item.id === activeId));
    let nextIndex = index;
    if (event.key === "ArrowDown") nextIndex = Math.min(items.length - 1, index + 1);
    else if (event.key === "ArrowUp") nextIndex = Math.max(0, index - 1);
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = items.length - 1;
    else if (event.key === "PageDown") nextIndex = Math.min(items.length - 1, index + 8);
    else if (event.key === "PageUp") nextIndex = Math.max(0, index - 8);
    else if (event.key === " " || event.key === "Space") {
      event.preventDefault();
      if (activeItem) toggleBatch(activeItem.id);
      return;
    } else if (event.key.toLowerCase() === "k") {
      event.preventDefault();
      void mutate(activeItem, "kept");
      return;
    } else if (event.key.toLowerCase() === "e") {
      if (activeItem?.authoritativePreviewId) {
        event.preventDefault();
        setEditedName(activeItem.editedName ?? activeItem.proposedName);
        setEditingId(activeItem.id);
      }
      return;
    } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault();
      setContextMenu({ x: 24, y: 96 });
      return;
    } else return;
    event.preventDefault();
    const next = items[nextIndex];
    setActiveId(next.id);
    virtualizer.scrollToIndex(nextIndex, { align: "auto" });
  }

  function openContextMenu(event: MouseEvent, item: OrganizationPlanItem) {
    event.preventDefault();
    setActiveId(item.id);
    setContextMenu({ x: event.clientX, y: event.clientY });
  }

  return (
    <div className={cn(pageFrame, "gap-3 overflow-hidden")}>
      <section className={cn(raisedSurface, "grid shrink-0 gap-3 px-4 py-3")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-[var(--zc-text-primary)]">AI Organization Preview</h1>
            <p className="mt-1 text-xs text-[var(--zc-text-secondary)]">Plans are durable review artifacts. AI suggests; only your confirmed dry run can execute existing safe operations.</p>
          </div>
          <button className={cn(buttonSecondary, "min-h-9 px-3")} onClick={() => setView("restore")}><History size={15} />History & Restore</button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input className={cn(inputSurface, "min-h-9 min-w-48 flex-1 px-3 text-sm")} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional plan title" aria-label="New plan title" />
          <button className={cn(buttonSecondary, "min-h-9 px-3")} disabled={isMutating} onClick={() => void handleCreatePlan()}><Plus size={15} />New Plan</button>
          <select className={cn(inputSurface, "min-h-9 min-w-56 px-2 text-sm")} value={plan?.id ?? ""} onChange={(event) => void openPlan(event.target.value)} aria-label="Continue an organization plan">
            <option value="">Continue Later…</option>
            {plans.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.status} · {item.materializedCount}</option>)}
          </select>
        </div>
      </section>

      {error ? <StateBlock tone="error" title="Organization plan needs attention" description={error} primaryAction={<button className={buttonSecondary} onClick={() => plan ? void openPlan(plan.id) : void loadPlans()}>Retry</button>} /> : null}
      {!plan && !isLoading ? <StateBlock tone="info" title="Create a durable review plan" description="Select files or an exact all-matching result in File Library, then create a plan. No files are moved during plan creation." primaryAction={<button className={buttonSecondary} onClick={() => setView("library")}>Open File Library</button>} /> : null}

      {plan ? (
        <>
          <section className={cn(raisedSurface, "flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3")} aria-live="polite">
            <div className="min-w-0">
              <strong className="block truncate text-sm">{plan.title}</strong>
              <span className="text-xs text-[var(--zc-text-tertiary)]">{plan.status} · revision {plan.revision} · {plan.materializedCount.toLocaleString()} materialized · {acceptedCount.toLocaleString()} accepted</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={buttonSubtle} disabled={isMutating || !needsAnalysisCount} onClick={() => void analyzeMissing()}><Sparkles size={14} />Analyze Missing ({needsAnalysisCount})</button>
              <button className={buttonSubtle} disabled={isMutating || !["stale", "ready", "partially_completed"].includes(plan.status)} onClick={() => void refreshPlan()}><RefreshCw size={14} />Refresh Stale</button>
              <button className={buttonSubtle} disabled={isMutating || !canReview} onClick={() => void cancelPlan()}><X size={14} />Cancel Plan</button>
              <button className={cn(glassButtonPrimary, "min-h-9 px-4")} disabled={isMutating || !canDryRun} onClick={() => void createDryRun()}><Play size={15} />Dry Run</button>
            </div>
          </section>

          <section className={cn(contentSurface, "grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(280px,360px)] overflow-hidden max-[900px]:grid-cols-1")}>
            <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-[var(--zc-divider)] px-3 py-2 text-xs">
                <span>{batchIds.size} selected</span>
                <button className={buttonSubtle} disabled={!safeItems.length || isMutating} onClick={() => void updateBatch(safeItems, "accepted")}><Check size={13} />Accept Safe ({safeItems.length})</button>
                <button className={buttonSubtle} disabled={!selectedItems.length || isMutating} onClick={() => void updateBatch(selectedItems, "kept")}><CircleMinus size={13} />Keep</button>
                <button className={buttonSubtle} disabled={!selectedItems.length || isMutating} onClick={() => void updateBatch(selectedItems, "undecided")}><ListRestart size={13} />Clear</button>
              </div>
              <div
                ref={listRef}
                className="relative min-h-0 overflow-auto outline-none"
                role="listbox"
                tabIndex={0}
                aria-label="Organization plan items"
                aria-activedescendant={mountedActiveId}
                onKeyDown={handleKeyDown}
              >
                <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
                  {virtualRows.map((virtualRow) => {
                    const item = items[virtualRow.index];
                    const active = item.id === activeId;
                    return (
                      <button
                        key={item.id}
                        id={`organization-item-${item.id}`}
                        role="option"
                        aria-selected={active}
                        className={cn("absolute left-0 top-0 grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 border-b border-[var(--zc-divider)] px-3 py-2 text-left hover:bg-[var(--zc-surface-hover)]", active && "bg-[var(--zc-surface-selected)]")}
                        style={{ height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }}
                        onClick={() => setActiveId(item.id)}
                        onContextMenu={(event) => openContextMenu(event, item)}
                      >
                        <input type="checkbox" checked={batchIds.has(item.id)} onChange={() => toggleBatch(item.id)} onClick={(event) => event.stopPropagation()} aria-label={`Select ${item.sourceNameSnapshot} for batch decision`} />
                        <span className="min-w-0">
                          <strong className="block truncate text-sm">{item.sourceNameSnapshot}</strong>
                          <span className="block truncate text-xs text-[var(--zc-text-tertiary)]">{item.proposalKind} · {item.validity} · {item.decision}</span>
                        </span>
                        <span className="text-xs tabular-nums text-[var(--zc-text-secondary)]">{Math.round(item.confidence * 100)}%</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <aside className="min-h-0 overflow-auto border-l border-[var(--zc-divider)] p-4 max-[900px]:border-l-0 max-[900px]:border-t" aria-label="Organization item inspector">
              {activeItem ? (
                <div className="grid gap-4">
                  <div><span className="text-xs text-[var(--zc-text-tertiary)]">From</span><p className="break-all text-sm">{activeItem.sourcePathSnapshot}</p></div>
                  <div><span className="text-xs text-[var(--zc-text-tertiary)]">To</span><p className="break-all text-sm">{activeItem.editedName ? `${activeItem.proposedTargetDirectory}/${activeItem.editedName}` : activeItem.proposedTargetPath}</p></div>
                  <div className="grid grid-cols-2 gap-2 text-xs"><span>Risk: {activeItem.riskLevel}</span><span>Validity: {activeItem.validity}</span><span>Decision: {activeItem.decision}</span><span>Revision: {activeItem.revision}</span></div>
                  {activeItem.blockingDetail ? <p className="rounded-md bg-[var(--zc-warning-surface)] p-3 text-xs text-[var(--zc-warning-text)]">{activeItem.blockingDetail}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    <button className={buttonSecondary} disabled={!canReview || activeItem.validity !== "ready" || isMutating} onClick={() => void mutate(activeItem, "accepted")}><Check size={14} />Accept</button>
                    <button className={buttonSubtle} disabled={!canReview || isMutating} onClick={() => void mutate(activeItem, "kept")}><CircleMinus size={14} />Keep</button>
                    <button className={buttonSubtle} disabled={!canReview || !activeItem.authoritativePreviewId || isMutating} onClick={() => { setEditedName(activeItem.editedName ?? activeItem.proposedName); setEditingId(activeItem.id); }}><Edit3 size={14} />Edit filename</button>
                    <button className={buttonGhost} disabled={!canReview || isMutating} onClick={() => void mutate(activeItem, "undecided")}><ListRestart size={14} />Clear</button>
                  </div>
                  {editingId === activeItem.id ? <div className="grid gap-2 rounded-lg border border-[var(--zc-divider)] p-3"><label className="text-xs" htmlFor="organization-edited-name">Edited filename</label><input id="organization-edited-name" className={cn(inputSurface, "min-h-9 px-2")} value={editedName} onChange={(event) => setEditedName(event.target.value)} autoFocus /><div className="flex gap-2"><button className={buttonSecondary} onClick={() => { void mutate(activeItem, "accepted", editedName); setEditingId(null); }}>Save</button><button className={buttonGhost} onClick={() => setEditingId(null)}>Cancel</button></div></div> : null}
                </div>
              ) : <p className="text-sm text-[var(--zc-text-tertiary)]">Select an item to review its authoritative proposal.</p>}
            </aside>
          </section>
        </>
      ) : null}

      {dryRun ? (
        <section className={cn(raisedSurface, "shrink-0 p-4")} role="status" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><strong className="text-sm">Dry run ready</strong><p className="text-xs text-[var(--zc-text-tertiary)]">{dryRun.executableCount} executable · {dryRun.blockedCount} blocked · {dryRun.staleCount} stale · {dryRun.totalBytes.toLocaleString()} bytes · batch limit {dryRun.executionBatchLimit}</p></div>
            <button className={buttonSecondary} disabled={!dryRun.executableCount || isMutating} onClick={() => setConfirmExecution(true)}>Review & Confirm Execution</button>
          </div>
        </section>
      ) : null}

      {executionResult ? <p className="sr-only" aria-live="assertive">Execution finished: {executionResult.succeededCount} succeeded, {executionResult.failedCount} failed, {executionResult.skippedCount} skipped.</p> : null}

      {contextMenu && activeItem ? <div className={cn(raisedSurface, "fixed z-50 grid min-w-40 gap-1 p-1")} style={{ left: contextMenu.x, top: contextMenu.y }} role="menu"><button className={buttonGhost} role="menuitem" onClick={() => void mutate(activeItem, "accepted")}>Accept</button><button className={buttonGhost} role="menuitem" onClick={() => void mutate(activeItem, "kept")}>Keep</button><button className={buttonGhost} role="menuitem" onClick={() => { setEditedName(activeItem.proposedName); setEditingId(activeItem.id); }}>Edit filename</button></div> : null}

      <ConfirmDialog
        open={confirmExecution}
        tone="warning"
        title="Execute this reviewed dry run?"
        description={dryRun ? `${dryRun.executableCount} existing journaled file operation(s) will run. No delete or trash operation is permitted. Any live change invalidates this dry run.` : ""}
        confirmLabel="Confirm safe execution"
        cancelLabel="Back to review"
        onCancel={() => setConfirmExecution(false)}
        onConfirm={() => { setConfirmExecution(false); void executeDryRun(); }}
      />
    </div>
  );
}

function isSafeBatchItem(item: OrganizationPlanItem) {
  return item.validity === "ready"
    && item.riskLevel === "Normal"
    && item.confidence >= 0.8
    && !item.requiresConfirmation
    && item.authoritativePreviewId !== null
    && item.blockingCode === null;
}
