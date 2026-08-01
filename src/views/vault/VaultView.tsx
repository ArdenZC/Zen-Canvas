import { Bookmark, ChevronDown, FolderSearch, Layers, SlidersHorizontal, Tag } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { tauriApi } from "../../api/tauriApi";
import { useChromeContext } from "../../contexts/AppContexts";
import { useDebounce } from "../../hooks/useDebounce";
import { useFileLibraryStore } from "../../store/useFileLibraryStore";
import {
  cloneFileQuerySpec,
  emptyFileQueryFilters,
  resolveLegacyLibraryScope,
  selectedLoadedIds,
  useFileLibraryInspectorStore,
  useFileLibraryQueryStore,
  useFileLibraryResultStore,
  useFileLibrarySavedViewStore,
  useFileLibrarySelectionStore,
  useFileLibraryTagStore
} from "../../store/useFileLibraryV2Store";
import { useScanManagerStore } from "../../store/useScanManagerStore";
import type { FileLibraryDetail, FileLibrarySummary, FileQueryFiltersV2, LibrarySavedView } from "../../types/domain";
import { libraryScopeLabel, readableError } from "../../utils/viewHelpers";
import { buttonGhost, buttonSecondary, buttonSubtle, cn, glassButtonPrimary, raisedSurface } from "../../utils/tw";
import { InspectorLayout, MetricStrip, NoticeBanner, SearchField, StateBlock, pageFrame } from "../shared/ui";
import { FileLibraryFilterPopover } from "./components/FileLibraryFilterPopover";
import { FileLibraryInspector, FileLibraryPreviewDialog, libraryRevealLabel } from "./components/FileLibraryInspector";
import { FileLibraryList } from "./components/FileLibraryList";
import { LibraryMetadataManagerDialog } from "./components/LibraryMetadataManagerDialog";
import { DuplicateGroupsPanel } from "./components/DuplicateGroupsPanel";

type ContextMenuState = { file: FileLibrarySummary; x: number; y: number };

export function VaultView() {
  const { onError, setView, t, language } = useChromeContext();
  const legacyScope = useFileLibraryStore((state) => state.scope);
  const stats = useFileLibraryStore((state) => state.stats);
  const setLegacyScope = useFileLibraryStore((state) => state.setScope);
  const handleChooseFolders = useScanManagerStore((state) => state.handleChooseFolders);
  const querySpec = useFileLibraryQueryStore((state) => state.spec);
  const [librarySearch, setLibrarySearch] = useState(() => querySpec.text ?? "");
  const debouncedSearchQuery = useDebounce(librarySearch, 300);
  const setQuerySpec = useFileLibraryQueryStore((state) => state.setSpec);
  const scopeHealth = useFileLibraryQueryStore((state) => state.scopeHealth);
  const files = useFileLibraryResultStore((state) => state.files);
  const totalCount = useFileLibraryResultStore((state) => state.totalCount);
  const isCountLoading = useFileLibraryResultStore((state) => state.isCountLoading);
  const hasMore = useFileLibraryResultStore((state) => state.hasMore);
  const isLoading = useFileLibraryResultStore((state) => state.isLoading);
  const resultState = useFileLibraryResultStore((state) => state.resultState);
  const resultError = useFileLibraryResultStore((state) => state.error);
  const loadFirstPage = useFileLibraryResultStore((state) => state.loadFirstPage);
  const loadNextPage = useFileLibraryResultStore((state) => state.loadNextPage);
  const refreshResults = useFileLibraryResultStore((state) => state.refresh);
  const clearResults = useFileLibraryResultStore((state) => state.clear);
  const selection = useFileLibrarySelectionStore((state) => state.selection);
  const focusedId = useFileLibrarySelectionStore((state) => state.focusedId);
  const setExplicitSelection = useFileLibrarySelectionStore((state) => state.setExplicit);
  const toggleSelection = useFileLibrarySelectionStore((state) => state.toggle);
  const selectAllMatching = useFileLibrarySelectionStore((state) => state.selectAllMatching);
  const clearSelection = useFileLibrarySelectionStore((state) => state.clear);
  const detail = useFileLibraryInspectorStore((state) => state.detail);
  const selectionSummary = useFileLibraryInspectorStore((state) => state.selectionSummary);
  const isInspectorLoading = useFileLibraryInspectorStore((state) => state.isLoading);
  const loadDetail = useFileLibraryInspectorStore((state) => state.loadDetail);
  const loadSelectionSummary = useFileLibraryInspectorStore((state) => state.loadSelectionSummary);
  const clearInspector = useFileLibraryInspectorStore((state) => state.clear);
  const tags = useFileLibraryTagStore((state) => state.tags);
  const loadTags = useFileLibraryTagStore((state) => state.load);
  const mutateTags = useFileLibraryTagStore((state) => state.mutate);
  const savedViews = useFileLibrarySavedViewStore((state) => state.views);
  const activeViewId = useFileLibrarySavedViewStore((state) => state.activeViewId);
  const loadSavedViews = useFileLibrarySavedViewStore((state) => state.load);
  const setActiveViewId = useFileLibrarySavedViewStore((state) => state.setActiveViewId);
  const [scopeReady, setScopeReady] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [metadataManager, setMetadataManager] = useState<"tags" | "saved_views" | null>(null);
  const [previewFile, setPreviewFile] = useState<FileLibraryDetail | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const sortButtonRef = useRef<HTMLButtonElement | null>(null);
  const scopeSignature = `${legacyScope.kind}:${legacyScope.kind === "all" ? "" : `${legacyScope.roots.join("\n")}:${legacyScope.kind === "current_scan" ? legacyScope.scanSessionId ?? "" : ""}`}`;
  const querySpecSignature = JSON.stringify(querySpec);
  const selectedIds = selectedLoadedIds(files, selection);
  const selectedFiles = files.filter((file) => selectedIds.includes(file.id));
  const isEmptyCurrentScanScope = legacyScope.kind === "current_scan" && legacyScope.roots.length === 0 && !legacyScope.scanSessionId;
  const remainingCount = totalCount === null ? 0 : Math.max(0, totalCount - files.length);
  const activeFilterCount = countActiveFilters(querySpec.filters);
  const scopeText = libraryScopeLabel(legacyScope, t("allIndexedFiles"), t("noFolderSelected"));
  const isNoIndexState = !stats.lastScannedAt && legacyScope.kind === "all" && totalCount === 0 && !isLoading && !resultError;
  const showLibraryControls = !isNoIndexState;
  const sortOptions = useMemo(() => [
    { key: "modified" as const, label: t("librarySortModified") },
    { key: "created" as const, label: t("librarySortCreated") },
    { key: "name" as const, label: t("librarySortName") },
    { key: "size" as const, label: t("librarySortSize") },
    { key: "confidence" as const, label: t("librarySortConfidence") },
    { key: "relevance" as const, label: t("librarySortRelevance") }
  ], [t]);
  const currentSortLabel = sortOptions.find((option) => option.key === querySpec.sort.kind)?.label ?? t("librarySortModified");

  useEffect(() => {
    void loadTags();
    void loadSavedViews();
  }, [loadSavedViews, loadTags]);

  useEffect(() => {
    let cancelled = false;
    setScopeReady(false);
    if (isEmptyCurrentScanScope) {
      clearResults();
      setScopeReady(true);
      return () => { cancelled = true; };
    }
    void resolveLegacyLibraryScope(legacyScope).then((scope) => {
      if (cancelled) return;
      const current = useFileLibraryQueryStore.getState().spec;
      setQuerySpec({ ...current, scope });
      setScopeReady(true);
    }).catch((error) => {
      if (cancelled) return;
      setScopeReady(true);
      onError(readableError(error));
    });
    return () => { cancelled = true; };
  }, [clearResults, isEmptyCurrentScanScope, legacyScope, onError, scopeSignature, setQuerySpec]);

  useEffect(() => {
    if (!scopeReady || isEmptyCurrentScanScope) return;
    const spec = cloneFileQuerySpec({
      ...querySpec,
      text: debouncedSearchQuery.trim() || null,
      sort: querySpec.sort.kind === "relevance" && !debouncedSearchQuery.trim()
        ? { kind: "modified", direction: "desc" }
        : querySpec.sort
    });
    const nextSignature = JSON.stringify(spec);
    if (nextSignature !== querySpecSignature) {
      setQuerySpec(spec);
      return;
    }
    void loadFirstPage();
  }, [debouncedSearchQuery, isEmptyCurrentScanScope, loadFirstPage, querySpecSignature, scopeReady, setQuerySpec]);

  useEffect(() => {
    clearSelection();
    setActiveViewId(null);
  }, [clearSelection, debouncedSearchQuery, querySpecSignature, setActiveViewId]);

  useEffect(() => {
    if (!selection) {
      clearInspector();
    } else if (selectedIds.length === 1) {
      void loadDetail(selectedIds[0]);
    } else {
      void loadSelectionSummary(selection);
    }
  }, [clearInspector, loadDetail, loadSelectionSummary, selectedIds, selection]);

  useEffect(() => {
    if (!contextMenu) return;
    const closeOnPointer = () => setContextMenu(null);
    const closeOnKey = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); setContextMenu(null); } };
    document.addEventListener("pointerdown", closeOnPointer);
    document.addEventListener("keydown", closeOnKey);
    return () => { document.removeEventListener("pointerdown", closeOnPointer); document.removeEventListener("keydown", closeOnKey); };
  }, [contextMenu]);

  const updateFilters = useCallback((value: Partial<FileQueryFiltersV2>) => {
    setQuerySpec({ ...useFileLibraryQueryStore.getState().spec, filters: { ...useFileLibraryQueryStore.getState().spec.filters, ...value } });
  }, [setQuerySpec]);

  function closeFilterPopover() {
    setIsFilterOpen(false);
    requestAnimationFrame(() => filterButtonRef.current?.focus());
  }

  function closeSortPopover() {
    setIsSortOpen(false);
    requestAnimationFrame(() => sortButtonRef.current?.focus());
  }

  function clearFilters() {
    setQuerySpec({ ...useFileLibraryQueryStore.getState().spec, filters: { ...emptyFileQueryFilters } });
    clearSelection();
  }

  function setSort(kind: typeof querySpec.sort.kind) {
    const current = useFileLibraryQueryStore.getState().spec.sort;
    setQuerySpec({ ...useFileLibraryQueryStore.getState().spec, sort: { kind, direction: current.kind === kind && current.direction === "desc" ? "asc" : "desc" } });
    closeSortPopover();
  }

  function selectRow(event: MouseEvent<HTMLDivElement>, index: number) {
    const file = files[index];
    if (!file) return;
    const ids = files.map((item) => item.id);
    if (event.shiftKey) toggleSelection(file.id, ids, true);
    else if (event.metaKey || event.ctrlKey) toggleSelection(file.id, ids);
    else setExplicitSelection([file.id], file.id, index);
    setContextMenu(null);
  }

  function selectAllLoaded() {
    setExplicitSelection(files.map((file) => file.id), files[0]?.id ?? "", files.length ? 0 : -1);
  }

  function focusList() {
    document.querySelector<HTMLElement>('[role="listbox"]')?.focus();
  }

  function handleListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const ids = files.map((file) => file.id);
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      selectAllLoaded();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (contextMenu) setContextMenu(null);
      else if (previewFile) { setPreviewFile(null); focusList(); }
      else clearSelection();
      return;
    }
    if (event.key === "ContextMenu" || (event.shiftKey && (event.key === "F10" || event.key === "ContextMenu"))) {
      event.preventDefault();
      const file = files.find((item) => item.id === focusedId) ?? files[0];
      if (file) openContextMenu(file);
      return;
    }
    const navigationKeys = ["ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"];
    if (navigationKeys.includes(event.key)) {
      event.preventDefault();
      if (!ids.length) return;
      const currentIndex = Math.max(0, ids.indexOf(focusedId));
      const step = event.key === "PageUp" ? -10 : event.key === "PageDown" ? 10 : event.key === "Home" ? -currentIndex : event.key === "End" ? ids.length : event.key === "ArrowUp" ? -1 : 1;
      const nextIndex = Math.max(0, Math.min(ids.length - 1, currentIndex + step));
      if (event.shiftKey) toggleSelection(ids[nextIndex], ids, true);
      else setExplicitSelection([ids[nextIndex]], ids[nextIndex], nextIndex);
      document.getElementById(`library-row-${ids[nextIndex]}`)?.scrollIntoView({ block: "nearest" });
      return;
    }
    if (event.key === "Enter" || event.key === " " || event.key === "Space") {
      event.preventDefault();
      const file = files.find((item) => item.id === focusedId) ?? files[0];
      if (file) void openPreview(file);
    }
  }

  function handleContextMenu(event: MouseEvent<HTMLDivElement>, index: number) {
    event.preventDefault();
    const file = files[index];
    if (!file) return;
    if (!selectedIds.includes(file.id)) setExplicitSelection([file.id], file.id, index);
    openContextMenu(file, event.clientX, event.clientY);
  }

  function openContextMenu(file: FileLibrarySummary, anchorX?: number, anchorY?: number) {
    const row = document.getElementById(`library-row-${file.id}`);
    const rect = row?.getBoundingClientRect();
    const width = 260;
    const height = 220;
    setContextMenu({ file, x: Math.max(8, Math.min(anchorX ?? rect?.left ?? 8, window.innerWidth - width - 8)), y: Math.max(8, Math.min(anchorY ?? rect?.bottom ?? 8, window.innerHeight - height - 8)) });
  }

  async function openPreview(file: FileLibrarySummary) {
    try {
      const loaded = await tauriApi.getFileLibraryDetail(file.id);
      setPreviewFile(loaded);
      setContextMenu(null);
    } catch (error) {
      onError(readableError(error));
    }
  }

  async function revealFile(fileId: string) {
    try {
      await tauriApi.revealFileLibraryEntry(fileId);
    } catch (error) {
      onError(readableError(error));
    }
  }

  async function toggleTag(tagId: string, operation: "add" | "remove") {
    if (!selection) return;
    try {
      await mutateTags({ selection, tagIds: [tagId], operation, expectedCount: selectionSummary?.count ?? null });
      await refreshResults();
      if (selectedIds.length === 1) await loadDetail(selectedIds[0]);
    } catch (error) {
      onError(readableError(error));
    }
  }

  function applySavedView(view: LibrarySavedView | null) {
    setActiveViewId(view?.id ?? null);
    if (!view) return;
    setQuerySpec(cloneFileQuerySpec(view.query));
    setLibrarySearch(view.query.text ?? "");
  }

  function libraryState() {
    if (resultState === "snapshot_expired" || resultError === "library_snapshot_expired") return null;
    if (resultError || resultState === "failed") return { tone: "error" as const, title: t("libraryLoadFailedTitle"), description: resultError ?? t("libraryLoadFailedDesc"), primaryAction: <button className={buttonSecondary} onClick={() => void refreshResults()}>{t("libraryRetry")}</button> };
    if (isLoading && totalCount === 0) return { tone: "info" as const, title: t("libraryLoadingResults"), description: t("libraryScopeHint") };
    if (isNoIndexState) return { tone: "info" as const, title: t("libraryNoScanTitle"), description: t("libraryNoScanDesc"), primaryAction: <button className={glassButtonPrimary} onClick={() => setView("scanner")}><Layers size={16} />{t("libraryGoToOverview")}</button> };
    if (isEmptyCurrentScanScope) return { tone: "info" as const, title: t("noCurrentScanTitle"), description: t("noCurrentScanDesc"), primaryAction: <button className={glassButtonPrimary} onClick={() => setView("scanner")}><Layers size={16} />{t("libraryGoToOverview")}</button>, secondaryAction: <button className={buttonSecondary} onClick={() => setLegacyScope({ kind: "all" })}>{t("viewAllIndexedFiles")}</button> };
    if (totalCount !== null && totalCount > 0) return null;
    if (librarySearch.trim()) return { tone: "neutral" as const, title: t("libraryNoSearchTitle"), description: t("libraryNoSearchDesc") };
    if (activeFilterCount) return { tone: "neutral" as const, title: t("libraryNoFilterTitle"), description: t("libraryNoFilterDesc") };
    return { tone: "neutral" as const, title: t("libraryNoScopeFilesTitle"), description: t("libraryNoScopeFilesDesc"), secondaryAction: <button className={buttonSecondary} onClick={() => setLegacyScope({ kind: "all" })}>{t("viewAllIndexedFiles")}</button> };
  }

  const state = libraryState();
  const selectionLabel = selection?.kind === "all_matching"
    ? replaceCopy(t("librarySelectionAll"), { count: totalCount === null ? t("libraryCountPending") : totalCount.toLocaleString(), excluded: selection.excludedFileIds.length.toLocaleString() })
    : selectedIds.length ? replaceCopy(t("librarySelectionLoaded"), { count: selectedIds.length.toLocaleString() }) : t("librarySelectionNone");
  const resultCountLabel = isLoading
    ? t("loading")
    : isCountLoading || totalCount === null
      ? replaceCopy(t("libraryResultCountDeferred"), { loaded: files.length.toLocaleString() })
      : replaceCopy(t("libraryResultCountExact"), { loaded: files.length.toLocaleString(), total: totalCount.toLocaleString() });

  return (
    <div className={cn(pageFrame, "gap-3 overflow-x-hidden")}>
      <section className={cn(raisedSurface, "relative z-20 grid shrink-0 gap-2 px-3 py-2")}>
        <div data-section="scope bar" className="flex min-w-0 flex-wrap items-center justify-between gap-2" aria-label={scopeText}><span className="truncate text-xs text-[var(--zc-text-secondary)]">{scopeText}{scopeHealth && scopeHealth.state !== "healthy" ? ` · ${scopeHealthLabel(scopeHealth.state, t)}` : ""}</span><div className="flex flex-wrap items-center gap-2">{legacyScope.kind !== "all" && !isEmptyCurrentScanScope ? <button className={cn(buttonGhost, "min-h-8 px-2.5 py-1.5 text-xs")} onClick={() => setLegacyScope({ kind: "all" })}><Layers size={15} />{t("viewAllIndexedFiles")}</button> : null}<button className={cn(buttonGhost, "min-h-8 px-2.5 py-1.5 text-xs")} onClick={() => void handleChooseFolders()}><FolderSearch size={15} />{t("switchScanDirectory")}</button></div></div>
        {showLibraryControls ? <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div data-section="search bar" className="min-w-[min(100%,320px)] flex-1"><SearchField value={librarySearch} onChange={(event) => setLibrarySearch(event.currentTarget.value)} onClear={() => setLibrarySearch("")} label={t("librarySearchLabel")} clearLabel={t("librarySearchClear")} placeholder={legacyScope.kind === "all" ? t("librarySearchPlaceholder") : t("librarySearchPlaceholderScoped")} className="min-w-0" /></div>
          <div className="relative" data-section="filter toolbar"><button ref={filterButtonRef} className={cn(buttonSubtle, "min-h-9 px-3 py-1.5 text-xs")} aria-expanded={isFilterOpen} aria-controls="library-filter-popover" aria-haspopup="dialog" onClick={() => { setIsFilterOpen((value) => !value); setIsSortOpen(false); }}><SlidersHorizontal size={15} />{t("libraryFilterButton")}{activeFilterCount ? <span className="tabular-nums text-[var(--zc-primary)]">{activeFilterCount}</span> : null}</button>{isFilterOpen ? <div id="library-filter-popover"><FileLibraryFilterPopover filters={querySpec.filters} tags={tags} t={t} onFiltersChange={updateFilters} onClear={clearFilters} onClose={closeFilterPopover} /></div> : null}</div>
          <div className="relative"><button ref={sortButtonRef} className={cn(buttonSubtle, "min-h-9 px-3 py-1.5 text-xs")} aria-expanded={isSortOpen} aria-haspopup="menu" onClick={() => { setIsSortOpen((value) => !value); setIsFilterOpen(false); }}><span>{currentSortLabel}</span><ChevronDown size={14} /></button>{isSortOpen ? <div className="absolute right-0 top-[calc(100%+8px)] z-30 grid min-w-48 rounded-[var(--zc-radius-floating)] border border-[var(--zc-border-strong)] bg-[var(--zc-surface-floating)] p-2 shadow-[var(--zc-shadow-floating)] backdrop-blur-xl" role="menu" aria-label={t("librarySortMenuLabel")}><div className="grid gap-1">{sortOptions.map((option) => <button key={option.key} role="menuitemradio" aria-checked={querySpec.sort.kind === option.key} className={cn("flex min-h-9 items-center justify-between rounded-[var(--zc-radius-control)] px-3 text-left text-sm", querySpec.sort.kind === option.key ? "bg-[var(--zc-surface-selected)] text-[var(--zc-text-primary)]" : "text-[var(--zc-text-secondary)] hover:bg-[var(--zc-surface-hover)]")} onClick={() => setSort(option.key)}>{option.label}<span className="text-xs">{querySpec.sort.kind === option.key ? querySpec.sort.direction === "desc" ? "↓" : "↑" : ""}</span></button>)}</div></div> : null}</div>
          <select className={cn(buttonSubtle, "min-h-9 max-w-48 px-2 text-xs")} value={activeViewId ?? ""} onChange={(event) => applySavedView(savedViews.find((view) => view.id === event.target.value) ?? null)} aria-label={t("librarySavedViewsLabel")}><option value="">{t("librarySavedViewsPlaceholder")}</option>{savedViews.map((view) => <option key={view.id} value={view.id}>{view.displayName}{view.invalidReferences.length ? ` · ${t("librarySavedViewInvalid")}` : ""}</option>)}</select>
        </div> : null}
        {showLibraryControls ? <div className="flex flex-wrap items-center gap-2" data-section="saved views and tags"><button data-library-manager="saved_views" className={cn(buttonSubtle, "min-h-8 px-2 text-xs")} onClick={() => setMetadataManager("saved_views")}><Bookmark size={14} />{t("libraryManageSavedViews")}</button><button data-library-manager="tags" className={cn(buttonSubtle, "min-h-8 px-2 text-xs")} onClick={() => setMetadataManager("tags")}><Tag size={14} />{t("libraryManageTags")}{tags.length ? ` · ${tags.length}` : ""}</button></div> : null}
        {showLibraryControls ? <div data-section="applied filters" className="flex min-h-0 flex-wrap items-center gap-1.5" aria-label={t("libraryAppliedFilters")}><span className="text-xs text-[var(--zc-text-tertiary)]">{activeFilterCount ? replaceCopy(t("libraryFiltersAppliedCount"), { count: activeFilterCount }) : t("libraryFilterAllOptions")}</span>{activeFilterCount ? <button className="text-xs text-[var(--zc-primary)] underline" onClick={clearFilters}>{t("libraryFilterClear")}</button> : null}</div> : null}
        {showLibraryControls ? <MetricStrip ariaLabel={t("libraryMetricsLabel")} density="compact" items={[{ label: t("libraryResultCountLabel"), value: resultCountLabel }, { label: t("librarySelectionLabel"), value: selectionLabel }]} /> : null}
        {showLibraryControls && selection?.kind === "explicit" && selectedIds.length === files.length && totalCount !== null && totalCount > files.length ? <button className="justify-self-start text-xs text-[var(--zc-primary)] underline" onClick={selectAllMatching}>{t("librarySelectAllMatching")}</button> : null}
      </section>

      <DuplicateGroupsPanel />
      {resultState === "snapshot_expired" || resultError === "library_snapshot_expired" ? (
        <NoticeBanner
          tone="warning"
          title={t("librarySnapshotExpiredTitle")}
          action={<button className={buttonSecondary} onClick={() => void refreshResults()}>{t("librarySnapshotRefresh")}</button>}
        >
          {t("librarySnapshotExpiredDesc")}
        </NoticeBanner>
      ) : null}
      <InspectorLayout
        className={showInspectorLayout(isNoIndexState)}
        main={<section className={cn(raisedSurface, "min-h-0 overflow-hidden max-[1100px]:min-h-[340px]")} aria-label={t("fileLibrary")}>{state ? <StateBlock tone={state.tone} title={state.title} description={state.description} primaryAction={state.primaryAction} secondaryAction={state.secondaryAction} /> : <FileLibraryList files={files} selectedIds={selectedIds} focusedId={focusedId} hasMore={hasMore} isLoading={isLoading} remainingCount={remainingCount} language={language} t={t} onKeyDown={handleListKeyDown} onRowClick={selectRow} onRowDoubleClick={(event, index) => { event.preventDefault(); const file = files[index]; if (file) void openPreview(file); }} onRowContextMenu={handleContextMenu} onLoadMore={() => void loadNextPage()} />}</section>}
        inspector={!isNoIndexState ? <FileLibraryInspector selectedIds={selectedIds} selectedFiles={selectedFiles} detail={detail} selectionSummary={selectionSummary} isLoading={isInspectorLoading} language={language} t={t} onPreview={(file) => setPreviewFile(file)} onReveal={(fileId) => void revealFile(fileId)} onViewSuggestions={() => setView("organize")} onClearSelection={clearSelection} availableTags={tags} onToggleTag={(tagId, operation) => void toggleTag(tagId, operation)} /> : undefined}
        inspectorLabel={t("libraryInspector")}
      />
      <p className="sr-only" aria-live="polite" aria-atomic="true">{selectionLabel}</p>
      {contextMenu ? <LibraryContextMenu context={contextMenu} t={t} onClose={() => setContextMenu(null)} onPreview={() => void openPreview(contextMenu.file)} onReveal={() => void revealFile(contextMenu.file.id)} onViewSuggestions={() => setView("organize")} onClearSelection={clearSelection} /> : null}
      <FileLibraryPreviewDialog file={previewFile} language={language} t={t} onClose={() => { setPreviewFile(null); focusList(); }} onReveal={(fileId) => void revealFile(fileId)} />
      <LibraryMetadataManagerDialog
        kind={metadataManager}
        query={cloneFileQuerySpec({ ...querySpec, text: debouncedSearchQuery.trim() || null })}
        selection={selection}
        selectionCount={selectionSummary?.count ?? (selection?.kind === "all_matching" ? totalCount : selectedIds.length)}
        activeViewId={activeViewId}
        onApplyView={(view) => { applySavedView(view); setMetadataManager(null); }}
        onMutated={async () => {
          await refreshResults();
          if (selectedIds.length === 1) await loadDetail(selectedIds[0]);
          else if (selection) await loadSelectionSummary(selection);
        }}
        onClose={() => setMetadataManager(null)}
      />
    </div>
  );
}

function countActiveFilters(filters: FileQueryFiltersV2) {
  return filters.fileTypes.length + filters.purposes.length + filters.lifecycles.length + filters.risks.length + filters.tagsAllOf.length + filters.tagsAnyOf.length + filters.tagsNoneOf.length + Number(filters.sizeMin !== null || filters.sizeMax !== null) + Number(filters.modifiedFrom !== null || filters.modifiedTo !== null) + Number(filters.createdFrom !== null || filters.createdTo !== null) + Number(filters.duplicate !== "any") + Number(filters.review !== "any");
}

function showInspectorLayout(noIndex: boolean) {
  return noIndex ? "max-[1100px]:grid-cols-1" : "";
}

function replaceCopy(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((copy, [key, value]) => copy.replaceAll(`{${key}}`, String(value)), template);
}

function scopeHealthLabel(state: string, t: ReturnType<typeof import("../../i18n").makeTranslator>) {
  if (state === "permission_required") return t("libraryScopeHealthPermission");
  if (state === "reconciliation_required") return t("libraryScopeHealthReconciliation");
  if (state === "partial" || state === "degraded") return t("libraryScopeHealthPartial");
  if (state === "retry_exhausted") return t("libraryScopeHealthRetry");
  return t("libraryScopeHealthUnavailable");
}

function LibraryContextMenu({ context, t, onClose, onPreview, onReveal, onViewSuggestions, onClearSelection }: { context: ContextMenuState; t: ReturnType<typeof import("../../i18n").makeTranslator>; onClose: () => void; onPreview: () => void; onReveal: () => void; onViewSuggestions: () => void; onClearSelection: () => void }) {
  const itemRefs = useRef<HTMLButtonElement[]>([]);
  const items = [
    { label: t("libraryPreview"), action: onPreview },
    { label: libraryRevealLabel(t), action: () => { onReveal(); onClose(); } },
    { label: t("libraryViewSuggestions"), action: () => { onViewSuggestions(); onClose(); } },
    { label: t("libraryClearSelection"), action: () => { onClearSelection(); onClose(); } }
  ];
  useEffect(() => { itemRefs.current[0]?.focus(); }, []);
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const focusable = itemRefs.current.filter(Boolean);
    const activeIndex = focusable.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) { event.preventDefault(); if (!focusable.length) return; const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? focusable.length - 1 : event.key === "ArrowDown" ? (activeIndex + 1 + focusable.length) % focusable.length : (activeIndex - 1 + focusable.length) % focusable.length; focusable[nextIndex]?.focus(); return; }
    if (event.key === "Tab") { event.preventDefault(); if (focusable.length) focusable[(activeIndex + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length]?.focus(); return; }
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (activeIndex >= 0) items[activeIndex]?.action(); }
  }
  return <div className="fixed z-50 grid max-h-screen min-w-52 gap-1 overflow-y-auto overscroll-contain rounded-[var(--zc-radius-floating)] border border-[var(--zc-border-strong)] bg-[var(--zc-surface-floating)] p-2 shadow-[var(--zc-shadow-floating)] backdrop-blur-xl" style={{ left: context.x, top: context.y }} role="menu" aria-label={t("libraryContextMenu")} tabIndex={-1} onKeyDown={handleKeyDown} onPointerDown={(event) => event.stopPropagation()}><p className="truncate px-3 py-1 text-xs font-semibold text-[var(--zc-text-tertiary)]" title={context.file.name}>{context.file.name}</p>{items.map((item, index) => <button key={item.label} ref={(element) => { if (element) itemRefs.current[index] = element; }} type="button" role="menuitem" className="flex min-h-9 items-center rounded-[var(--zc-radius-control)] px-3 text-left text-sm text-[var(--zc-text-secondary)] hover:bg-[var(--zc-surface-hover)] hover:text-[var(--zc-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--zc-focus-ring)]" onClick={item.action}>{item.label}</button>)}</div>;
}
