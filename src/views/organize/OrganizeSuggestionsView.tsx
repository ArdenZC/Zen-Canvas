import { FolderSearch, Layers, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useChromeContext } from "../../contexts/AppContexts";
import { useFileLibraryStore } from "../../store/useFileLibraryStore";
import { useOperationQueueStore } from "../../store/useOperationQueueStore";
import { useOrganizeDecisionStore } from "../../store/useOrganizeDecisionStore";
import { useScanManagerStore } from "../../store/useScanManagerStore";
import { libraryScopeLabel } from "../../utils/viewHelpers";
import { buttonGhost, buttonSecondary, cn, contentSurface, raisedSurface } from "../../utils/tw";
import { ConfirmDialog, StateBlock, pageFrame } from "../shared/ui";
import { OrganizeBatchToolbar } from "./OrganizeBatchToolbar";
import { OrganizeDecisionBar } from "./OrganizeDecisionBar";
import { OrganizeSuggestionInspector } from "./OrganizeSuggestionInspector";
import { OrganizeSuggestionList } from "./OrganizeSuggestionList";
import { OrganizeTargetDialog } from "./OrganizeTargetDialog";
import {
  buildOrganizeSuggestions,
  organizeScopeKey,
  organizeSpaceAction,
  previewIdsForOrganizeDecisions,
  shouldIgnoreOrganizeShortcut,
  summarizeOrganizeDecisions,
  type OrganizeDecision,
  type OrganizeSuggestion
} from "./organizeModel";

const AI_ANALYSIS_LIMIT = 100;
const NARROW_ORGANIZE_QUERY = "(max-width: 1100px)";

export function OrganizeSuggestionsView() {
  const { t, setView } = useChromeContext();
  const files = useFileLibraryStore((state) => state.organizeQueue);
  const total = useFileLibraryStore((state) => state.organizeQueueTotal);
  const truncated = useFileLibraryStore((state) => state.organizeQueueTruncated);
  const queueLoading = useFileLibraryStore((state) => state.isLoadingOrganizeQueue);
  const queueError = useFileLibraryStore((state) => state.organizeQueueError);
  const loadOrganizeQueue = useFileLibraryStore((state) => state.loadOrganizeQueue);
  const scope = useFileLibraryStore((state) => state.scope);
  const setScope = useFileLibraryStore((state) => state.setScope);
  const isAnalyzing = useFileLibraryStore((state) => state.isClassifyingWithAI);
  const analysisProgress = useFileLibraryStore((state) => state.aiClassificationProgress);
  const classifyCurrentScopeWithAI = useFileLibraryStore((state) => state.classifyCurrentScopeWithAI);
  const cancelAIClassification = useFileLibraryStore((state) => state.cancelAIClassification);
  const handleChooseFolders = useScanManagerStore((state) => state.handleChooseFolders);
  const previews = useOperationQueueStore((state) => state.previews);
  const refreshPreviewsForFiles = useOperationQueueStore((state) => state.refreshPreviewsForFiles);
  const startOrganizePreviewSession = useOperationQueueStore((state) => state.startOrganizePreviewSession);
  const onRenamePreview = useOperationQueueStore((state) => state.onRenamePreview);
  const decisions = useOrganizeDecisionStore((state) => state.decisions);
  const syncSuggestions = useOrganizeDecisionStore((state) => state.syncSuggestions);
  const setDecision = useOrganizeDecisionStore((state) => state.setDecision);
  const clearDecision = useOrganizeDecisionStore((state) => state.clearDecision);
  const [activeId, setActiveId] = useState("");
  const [batchMode, setBatchMode] = useState(false);
  const [batchIds, setBatchIds] = useState<Set<string>>(new Set());
  const [targetFileId, setTargetFileId] = useState<string | null>(null);
  const [confirmReanalysis, setConfirmReanalysis] = useState(false);
  const [narrowPane, setNarrowPane] = useState<"list" | "details">("list");
  const isNarrowLayout = useNarrowOrganizeLayout();
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState(false);
  const [analysisFailed, setAnalysisFailed] = useState(false);
  const inspectorRef = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const workspaceRequestRef = useRef(0);
  const isEmptyCurrentScanScope = scope.kind === "current_scan" && scope.roots.length === 0;
  const scopeText = libraryScopeLabel(scope, t("allIndexedFiles"), t("noFolderSelected"));

  const loadWorkspace = useCallback(async () => {
    const requestId = ++workspaceRequestRef.current;
    if (isEmptyCurrentScanScope) {
      setWorkspaceLoading(false);
      return;
    }
    setWorkspaceLoading(true);
    setWorkspaceError(false);
    try {
      await loadOrganizeQueue(scope);
      if (requestId !== workspaceRequestRef.current) return;
      const currentFiles = useFileLibraryStore.getState().organizeQueue;
      await refreshPreviewsForFiles(scope, new Set(currentFiles.map((file) => file.id)));
      if (requestId !== workspaceRequestRef.current) return;
    } catch {
      if (requestId === workspaceRequestRef.current) setWorkspaceError(true);
    } finally {
      if (requestId === workspaceRequestRef.current) setWorkspaceLoading(false);
    }
  }, [isEmptyCurrentScanScope, loadOrganizeQueue, refreshPreviewsForFiles, scope]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (workspaceLoading) return;
    syncSuggestions(scope, files, previews);
  }, [files, previews, scope, syncSuggestions, workspaceLoading]);

  const suggestions = useMemo(
    () => buildOrganizeSuggestions(files, previews, scope, decisions),
    [decisions, files, previews, scope]
  );
  const activeSuggestion = suggestions.find((suggestion) => suggestion.file.id === activeId) ?? suggestions[0] ?? null;
  const targetSuggestion = suggestions.find((suggestion) => suggestion.file.id === targetFileId) ?? null;
  const summary = useMemo(() => summarizeOrganizeDecisions(suggestions), [suggestions]);
  const selectedBatchSuggestions = suggestions.filter((suggestion) => batchIds.has(suggestion.file.id));
  const safeBatchSuggestions = selectedBatchSuggestions.filter((suggestion) => suggestion.safeForBatch);
  const keepableBatchSuggestions = selectedBatchSuggestions.filter((suggestion) => suggestion.decision !== "blocked");
  const clearableBatchSuggestions = selectedBatchSuggestions.filter((suggestion) => ["accepted", "kept", "edited"].includes(suggestion.decision));
  const blockedBatchCount = selectedBatchSuggestions.filter((suggestion) => suggestion.decision === "blocked").length;
  const needsReviewBatchCount = selectedBatchSuggestions.filter((suggestion) => suggestion.decision === "needs-review").length;

  useEffect(() => {
    if (inspectorRef.current) inspectorRef.current.scrollTop = 0;
  }, [activeSuggestion?.file.id]);

  useEffect(() => {
    if (!isNarrowLayout && narrowPane !== "list") setNarrowPane("list");
  }, [isNarrowLayout, narrowPane]);

  useEffect(() => {
    if (!suggestions.length) {
      if (activeId) setActiveId("");
      return;
    }
    if (!suggestions.some((suggestion) => suggestion.file.id === activeId)) setActiveId(suggestions[0].file.id);
  }, [activeId, suggestions]);

  useEffect(() => {
    for (const suggestion of suggestions) {
      const displayedPreview = suggestion.preview
        ? useOperationQueueStore.getState().displayPreviews.find((preview) => preview.id === suggestion.preview?.id)
        : null;
      if (suggestion.decision === "edited" && suggestion.preview && suggestion.editedName && displayedPreview?.new_name !== suggestion.editedName) {
        onRenamePreview(suggestion.preview.id, suggestion.editedName);
      }
    }
  }, [onRenamePreview, suggestions]);

  function applyDecision(suggestion: OrganizeSuggestion | null, state: OrganizeDecision, editedName?: string) {
    if (!suggestion) return false;
    return setDecision(scope, suggestion.file, suggestion.preview, state, editedName);
  }

  function handleListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (shouldIgnoreOrganizeShortcut(event.nativeEvent)) return;
    const index = Math.max(0, suggestions.findIndex((suggestion) => suggestion.file.id === activeSuggestion?.file.id));
    let nextIndex = index;
    if (event.key === "ArrowDown") nextIndex = Math.min(suggestions.length - 1, index + 1);
    else if (event.key === "ArrowUp") nextIndex = Math.max(0, index - 1);
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = Math.max(0, suggestions.length - 1);
    else if (event.key === " " || event.key === "Space") {
      event.preventDefault();
      if (organizeSpaceAction(batchMode) === "toggle-batch" && activeSuggestion) toggleBatch(activeSuggestion.file.id);
      else applyDecision(activeSuggestion, "accepted");
      return;
    } else if (event.key.toLowerCase() === "k") {
      event.preventDefault();
      applyDecision(activeSuggestion, "kept");
      return;
    } else if (event.key.toLowerCase() === "e") {
      if (activeSuggestion?.canEdit) {
        event.preventDefault();
        setTargetFileId(activeSuggestion.file.id);
      }
      return;
    } else if (event.key === "Escape") {
      if (batchMode) {
        event.preventDefault();
        setBatchMode(false);
        setBatchIds(new Set());
        requestAnimationFrame(() => listRef.current?.focus());
      }
      return;
    } else if (event.key === "Enter") {
      event.preventDefault();
      openInspectorDetails();
      return;
    } else return;
    event.preventDefault();
    const next = suggestions[nextIndex];
    if (next) {
      setActiveId(next.file.id);
      document.getElementById(`organize-suggestion-${next.file.id}`)?.scrollIntoView({ block: "nearest" });
    }
  }

  function openInspectorDetails() {
    if (!activeSuggestion || !isNarrowLayout) return;
    setNarrowPane("details");
    requestAnimationFrame(() => inspectorRef.current?.focus());
  }

  function returnToSuggestionList() {
    if (!isNarrowLayout) return;
    setNarrowPane("list");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const activeRow = activeSuggestion ? document.getElementById(`organize-suggestion-${activeSuggestion.file.id}`) : null;
        (activeRow ?? listRef.current)?.focus();
      });
    });
  }

  function toggleBatch(fileId: string) {
    setBatchIds((current) => {
      const next = new Set(current);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }

  function applyBatch(state: "accepted" | "kept" | "undecided") {
    const targets = state === "accepted" ? safeBatchSuggestions : state === "kept" ? keepableBatchSuggestions : clearableBatchSuggestions;
    for (const suggestion of targets) {
      if (state === "undecided") clearDecision(scope, suggestion.file, suggestion.preview);
      else applyDecision(suggestion, state);
    }
  }

  async function analyzePending() {
    setAnalysisFailed(false);
    try {
      await classifyCurrentScopeWithAI({ pendingOnly: true, force: false, limit: AI_ANALYSIS_LIMIT });
      await loadWorkspace();
    } catch {
      setAnalysisFailed(true);
    }
  }

  async function rerunAnalysis() {
    setConfirmReanalysis(false);
    setAnalysisFailed(false);
    try {
      await classifyCurrentScopeWithAI({ force: true, allowOverwriteUserCorrections: false, limit: AI_ANALYSIS_LIMIT });
      await loadWorkspace();
    } catch {
      setAnalysisFailed(true);
    }
  }

  function openPreview() {
    const ids = previewIdsForOrganizeDecisions(suggestions);
    startOrganizePreviewSession(organizeScopeKey(scope), ids);
    setView("preview");
  }
  const closeTargetDialog = useCallback(() => setTargetFileId(null), []);

  if (isEmptyCurrentScanScope) {
    return (
      <div className={cn(pageFrame, "gap-3 overflow-auto")}>
        <StateBlock
          tone="info"
          title={t("noOrganizeScopeTitle")}
          description={t("noOrganizeScopeDesc")}
          primaryAction={<button className={buttonSecondary} onClick={() => void handleChooseFolders()}><FolderSearch size={16} />{t("chooseFolderScan")}</button>}
          secondaryAction={<button className={buttonGhost} onClick={() => setScope({ kind: "all" })}><Layers size={16} />{t("viewAllIndexedFiles")}</button>}
        />
      </div>
    );
  }

  const loading = workspaceLoading || queueLoading;
  const permissionError = /permission|access denied|权限|拒绝访问/i.test(queueError);
  return (
    <div className={cn(pageFrame, "gap-3 overflow-x-hidden")}>
      <section className={cn(raisedSurface, "grid shrink-0 gap-3 px-4 py-3")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <strong className="block text-sm text-[var(--zc-text-primary)]">{t("currentOrganizeScope")}: {scopeText}</strong>
            <span className="mt-1 block text-xs text-[var(--zc-text-secondary)]">{loading ? t("organizeLoadingSuggestions") : truncated ? t("organizeShowingLimited").replace("{visible}", files.length.toLocaleString()).replace("{total}", total.toLocaleString()) : t("organizeShowingSuggestions").replace("{count}", files.length.toLocaleString())}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={cn(buttonGhost, "min-h-8 px-3 py-1.5 text-xs")} disabled={loading} onClick={() => void loadWorkspace()}><RefreshCw size={14} />{t("reload")}</button>
            <button className={cn(buttonSecondary, "min-h-8 px-3 py-1.5 text-xs")} disabled={loading || isAnalyzing} onClick={() => void analyzePending()}><Sparkles size={14} />{t("organizeAnalyzePending")}</button>
            <button className={cn(buttonGhost, "min-h-8 px-3 py-1.5 text-xs")} disabled={loading || isAnalyzing} onClick={() => setConfirmReanalysis(true)}>{t("organizeReanalyzeScope")}</button>
            {!batchMode ? <button className={cn(buttonSecondary, "min-h-8 px-3 py-1.5 text-xs")} disabled={!suggestions.length} onClick={() => setBatchMode(true)}>{t("organizeBatchEnter")}</button> : null}
          </div>
        </div>
        <p className="text-xs leading-5 text-[var(--zc-text-tertiary)]">{t("organizeSafetyHint")}</p>
        {isAnalyzing ? <div className="flex items-center justify-between gap-3 text-xs text-[var(--zc-info-text)]" role="status" aria-live="polite"><span>{analysisProgress ? t("organizeAnalysisProgress").replace("{processed}", analysisProgress.processed.toLocaleString()).replace("{total}", analysisProgress.total.toLocaleString()) : t("organizeAnalyzingFiles")}</span><button className={cn(buttonGhost, "min-h-7 px-2 py-1 text-xs")} onClick={() => void cancelAIClassification()}>{t("cancel")}</button></div> : analysisFailed ? <p className="text-xs text-[var(--zc-warning-text)]" role="status">{t("organizeAnalysisFailed")}</p> : null}
      </section>

      {queueError || workspaceError ? (
        <StateBlock tone="error" title={permissionError ? t("libraryPermissionState") : t("organizeLoadFailedTitle")} description={permissionError ? t("libraryPermissionDesc") : t("organizeLoadFailedDesc")} primaryAction={<button className={buttonSecondary} onClick={() => void loadWorkspace()}>{t("libraryRetry")}</button>} />
      ) : loading && !files.length ? (
        <StateBlock tone="info" title={t("organizeLoadingSuggestions")} description={t("organizeLoadingSuggestionsDesc")} />
      ) : !files.length ? (
        <StateBlock tone="neutral" title={t("organizeEmptyTitle")} description={t("organizeEmptyDesc")} secondaryAction={<button className={buttonSecondary} onClick={() => void analyzePending()}>{t("organizeAnalyzePending")}</button>} />
      ) : (
        <>
          <section className={cn(contentSurface, "grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px] overflow-hidden max-[1100px]:grid-cols-1")} data-narrow-pane={isNarrowLayout ? narrowPane : undefined}>
            <div id="organize-suggestion-pane" className={cn("grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden", isNarrowLayout && narrowPane === "details" && "hidden")}>
              {isNarrowLayout ? <div className="flex items-center justify-between gap-3 border-b border-[var(--zc-divider)] bg-[var(--zc-surface-subtle)] px-3 py-2">
                <span className="min-w-0 truncate text-xs text-[var(--zc-text-secondary)]">{activeSuggestion?.file.name}</span>
                <button className={cn(buttonSecondary, "min-h-8 shrink-0 px-3 py-1.5 text-xs")} type="button" aria-controls="organize-inspector" aria-label={activeSuggestion ? t("organizeDetailsForFile").replace("{name}", activeSuggestion.file.name) : t("organizeViewFileDetails")} onClick={openInspectorDetails}><FolderSearch size={14} aria-hidden="true" />{t("organizeViewFileDetails")}</button>
              </div> : null}
              {batchMode ? <OrganizeBatchToolbar selectedCount={batchIds.size} safeCount={safeBatchSuggestions.length} keepableCount={keepableBatchSuggestions.length} clearableCount={clearableBatchSuggestions.length} blockedCount={blockedBatchCount} needsReviewCount={needsReviewBatchCount} t={t} onAcceptSafe={() => applyBatch("accepted")} onKeep={() => applyBatch("kept")} onClear={() => applyBatch("undecided")} onExit={() => { setBatchMode(false); setBatchIds(new Set()); requestAnimationFrame(() => listRef.current?.focus()); }} /> : <div className="border-b border-[var(--zc-divider)] px-3 py-2 text-xs text-[var(--zc-text-tertiary)]">{t("organizeClickOnlyViews")}</div>}
              <OrganizeSuggestionList suggestions={suggestions} activeId={activeSuggestion?.file.id ?? ""} batchMode={batchMode} batchIds={batchIds} t={t} onActivate={setActiveId} onToggleBatch={toggleBatch} onKeyDown={handleListKeyDown} listRef={listRef} />
            </div>
            <OrganizeSuggestionInspector suggestion={activeSuggestion} t={t} inspectorRef={inspectorRef} isNarrowLayout={isNarrowLayout} narrowVisible={narrowPane === "details"} onAccept={() => applyDecision(activeSuggestion, "accepted")} onKeep={() => applyDecision(activeSuggestion, "kept")} onEdit={() => activeSuggestion && setTargetFileId(activeSuggestion.file.id)} onClear={() => activeSuggestion && clearDecision(scope, activeSuggestion.file, activeSuggestion.preview)} onReturnToList={returnToSuggestionList} />
          </section>
          <OrganizeDecisionBar summary={summary} t={t} onPreview={openPreview} />
        </>
      )}

      <OrganizeTargetDialog suggestion={targetSuggestion} t={t} onClose={closeTargetDialog} onSave={(name) => { if (targetSuggestion && applyDecision(targetSuggestion, "edited", name)) onRenamePreview(targetSuggestion.preview!.id, name); closeTargetDialog(); }} />
      <ConfirmDialog open={confirmReanalysis} tone="warning" title={t("organizeReanalyzeConfirmTitle")} description={t("organizeReanalyzeConfirmDesc")} confirmLabel={t("organizeReanalyzeConfirmAction")} cancelLabel={t("cancel")} onCancel={() => setConfirmReanalysis(false)} onConfirm={() => void rerunAnalysis()} />
    </div>
  );
}

function useNarrowOrganizeLayout() {
  const readMatch = () => typeof window !== "undefined"
    && (window.matchMedia?.(NARROW_ORGANIZE_QUERY).matches ?? window.innerWidth <= 1100);
  const [matches, setMatches] = useState(readMatch);
  useEffect(() => {
    const mediaQuery = window.matchMedia?.(NARROW_ORGANIZE_QUERY);
    const update = (event?: MediaQueryListEvent) => setMatches(event?.matches ?? mediaQuery?.matches ?? window.innerWidth <= 1100);
    const updateFromResize = () => update();
    update();
    if (mediaQuery) mediaQuery.addEventListener("change", update);
    else window.addEventListener("resize", updateFromResize);
    return () => {
      if (mediaQuery) mediaQuery.removeEventListener("change", update);
      else window.removeEventListener("resize", updateFromResize);
    };
  }, []);
  return matches;
}
