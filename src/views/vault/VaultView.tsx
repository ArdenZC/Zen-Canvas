import { ChevronDown, FolderSearch, Layers, Search, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { tauriApi } from "../../api/tauriApi";
import { useChromeContext } from "../../contexts/AppContexts";
import { useDebounce } from "../../hooks/useDebounce";
import { useAppStore } from "../../store/useAppStore";
import { emptyPage, LIBRARY_PAGE_SIZE, useFileLibraryStore } from "../../store/useFileLibraryStore";
import { useScanManagerStore } from "../../store/useScanManagerStore";
import type { FileRecord, LibraryFilter } from "../../types/domain";
import { libraryScopeLabel, readableError } from "../../utils/viewHelpers";
import { buttonGhost, buttonSecondary, buttonSubtle, cn, glassButtonPrimary, inputSurface, raisedSurface } from "../../utils/tw";
import { StateBlock, pageFrame, quietText } from "../shared/ui";
import { FileClassificationDetails } from "./components/FileClassificationDetails";
import { FileLibraryFilterPopover } from "./components/FileLibraryFilterPopover";
import { FileLibraryInspector, FileLibraryPreviewDialog } from "./components/FileLibraryInspector";
import { FileLibraryList } from "./components/FileLibraryList";
import {
  defaultLibrarySort,
  emptyLibraryAdvancedFilters,
  filterLibraryFiles,
  moveFocusIndex,
  selectionForRowClick,
  sortLibraryFiles,
  type LibraryAdvancedFilters,
  type LibrarySort,
  type LibrarySortKey
} from "./fileLibraryModel";

type ContextMenuState = { file: FileRecord; x: number; y: number };

export function VaultView() {
  const { onError, setView, t, language } = useChromeContext();
  const searchQuery = useAppStore((state) => state.searchQuery);
  const setSearchQuery = useAppStore((state) => state.setSearchQuery);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const page = useFileLibraryStore((state) => state.libraryPage);
  const scope = useFileLibraryStore((state) => state.scope);
  const stats = useFileLibraryStore((state) => state.stats);
  const selectedFileId = useFileLibraryStore((state) => state.selectedFileId);
  const setScope = useFileLibraryStore((state) => state.setScope);
  const setPage = useFileLibraryStore((state) => state.setLibraryPage);
  const setSelectedFileId = useFileLibraryStore((state) => state.setSelectedFileId);
  const loadStats = useFileLibraryStore((state) => state.loadStats);
  const libraryFilter = useFileLibraryStore((state) => state.libraryFilter);
  const setLibraryFilter = useFileLibraryStore((state) => state.setLibraryFilter);
  const handleChooseFolders = useScanManagerStore((state) => state.handleChooseFolders);
  const [advancedFilters, setAdvancedFilters] = useState<LibraryAdvancedFilters>(emptyLibraryAdvancedFilters);
  const [sort, setSort] = useState<LibrarySort>(defaultLibrarySort);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [focusedId, setFocusedId] = useState("");
  const [anchorIndex, setAnchorIndex] = useState(-1);
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const requestIdRef = useRef(0);
  const didMountRef = useRef(false);
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const sortButtonRef = useRef<HTMLButtonElement | null>(null);
  const scopeSignature = `${scope.kind}:${scope.kind === "all" ? "" : scope.roots.join("\n")}`;
  const hasAdvancedFilters = Object.entries(advancedFilters).some(([key, value]) => {
    if (key === "duplicateOnly" || key === "reviewOnly") return value === true;
    return value !== "all";
  });
  const filteredFiles = useMemo(
    () => filterLibraryFiles(page.files, libraryFilter, advancedFilters),
    [advancedFilters, libraryFilter, page.files]
  );
  const visibleFiles = useMemo(() => sortLibraryFiles(filteredFiles, sort), [filteredFiles, sort]);
  const selectedFiles = selectedIds.map((id) => page.files.find((file) => file.id === id)).filter((file): file is FileRecord => Boolean(file));
  const hasMore = page.files.length < page.total;
  const remainingCount = Math.max(0, page.total - page.files.length);
  const scopeText = libraryScopeLabel(scope, t("allIndexedFiles"), t("noFolderSelected"));
  const isEmptyCurrentScanScope = scope.kind === "current_scan" && scope.roots.length === 0;
  const showOpenedSort = page.files.some((file) => Boolean(file.last_opened_at));
  const sortOptions = useMemo(() => {
    const options: Array<{ key: LibrarySortKey; label: string }> = [
      { key: "name", label: t("librarySortName") },
      { key: "modified_at", label: t("librarySortModified") },
      { key: "size", label: t("librarySortSize") },
      { key: "confidence", label: t("librarySortConfidence") }
    ];
    if (showOpenedSort) options.splice(3, 0, { key: "last_opened_at", label: t("librarySortOpened") });
    return options;
  }, [showOpenedSort, t]);
  const currentSortLabel = sortOptions.find((option) => option.key === sort.key)?.label ?? t("librarySortModified");

  const loadPage = useCallback(async (offset: number, append: boolean) => {
    const requestId = ++requestIdRef.current;
    if (scope.kind === "current_scan" && scope.roots.length === 0) {
      setPage(emptyPage);
      setSelectedFileId("");
      setIsLoading(false);
      setError("");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const filters = libraryFilter === "all" ? undefined : { libraryFilter };
      const next = await tauriApi.getPagedFiles(LIBRARY_PAGE_SIZE, offset, debouncedSearchQuery, scope, filters);
      if (requestId !== requestIdRef.current) return;
      setPage((current) => append
        ? { ...next, files: [...current.files, ...next.files], offset: current.offset }
        : next
      );
      if (!append && next.files[0]) {
        const currentSelectedId = useFileLibraryStore.getState().selectedFileId;
        const nextSelectedId = currentSelectedId && next.files.some((file) => file.id === currentSelectedId)
          ? currentSelectedId
          : next.files[0].id;
        setSelectedFileId(nextSelectedId);
        setFocusedId(nextSelectedId);
      }
      await loadStats(scope);
    } catch (caught) {
      if (requestId === requestIdRef.current) setError(readableError(caught));
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [debouncedSearchQuery, libraryFilter, loadStats, scope, setPage, setSelectedFileId]);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    requestIdRef.current += 1;
    setPage(emptyPage);
    setSelectedIds([]);
    setFocusedId("");
    setAnchorIndex(-1);
    setSelectedFileId("");
  }, [libraryFilter, scopeSignature, searchQuery, setPage, setSelectedFileId]);

  useEffect(() => {
    void loadPage(0, false);
  }, [loadPage]);

  useEffect(() => {
    if (isEmptyCurrentScanScope) {
      if (selectedIds.length > 0) setSelectedIds([]);
      if (focusedId) setFocusedId("");
      return;
    }
    if (selectedIds.length === 0 && selectedFileId && page.files.some((file) => file.id === selectedFileId)) {
      setSelectedIds([selectedFileId]);
      setFocusedId(selectedFileId);
      setAnchorIndex(page.files.findIndex((file) => file.id === selectedFileId));
    }
  }, [focusedId, isEmptyCurrentScanScope, page.files, selectedFileId, selectedIds.length]);

  useEffect(() => {
    if (!contextMenu) return;
    const closeOnPointer = () => setContextMenu(null);
    const closeOnKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeContextMenu();
      }
    };
    document.addEventListener("pointerdown", closeOnPointer);
    document.addEventListener("keydown", closeOnKey);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointer);
      document.removeEventListener("keydown", closeOnKey);
    };
  }, [contextMenu]);

  function closeFilterPopover() {
    setIsFilterOpen(false);
    requestAnimationFrame(() => filterButtonRef.current?.focus());
  }

  function closeSortPopover() {
    setIsSortOpen(false);
    requestAnimationFrame(() => sortButtonRef.current?.focus());
  }

  function closeContextMenu() {
    setContextMenu(null);
    requestAnimationFrame(focusList);
  }

  function clearFilters() {
    setLibraryFilter("all");
    setAdvancedFilters(emptyLibraryAdvancedFilters);
    clearSelection();
  }

  function focusList() {
    document.querySelector<HTMLElement>('[role="listbox"]')?.focus();
  }

  function updateSelection(nextIds: string[], nextFocusedId: string, nextAnchorIndex: number) {
    setSelectedIds(nextIds);
    setFocusedId(nextFocusedId);
    setAnchorIndex(nextAnchorIndex);
    setSelectedFileId(nextFocusedId || nextIds[0] || "");
  }

  function selectRow(event: MouseEvent<HTMLDivElement>, index: number) {
    const ids = visibleFiles.map((file) => file.id);
    const next = selectionForRowClick(ids, index, {
      additive: event.metaKey || event.ctrlKey,
      range: event.shiftKey,
      anchorIndex,
      selectedIds
    });
    updateSelection(next.selectedIds, next.focusedId, next.anchorIndex);
    setContextMenu(null);
  }

  function selectAll() {
    const ids = visibleFiles.map((file) => file.id);
    updateSelection(ids, ids[0] ?? "", ids.length ? 0 : -1);
  }

  function clearSelection() {
    updateSelection([], "", -1);
  }

  async function revealFile(path: string) {
    try {
      await tauriApi.revealInFolder(path);
    } catch (caught) {
      onError(readableError(caught));
    }
  }

  async function openFile(file: FileRecord | undefined) {
    if (!file) return;
    await revealFile(file.path);
  }

  function openPreview(file: FileRecord | undefined) {
    if (!file) return;
    setContextMenu(null);
    setPreviewFile(file);
  }

  function handleListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const ids = visibleFiles.map((file) => file.id);
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      selectAll();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (contextMenu) {
        setContextMenu(null);
      } else if (previewFile) {
        setPreviewFile(null);
        focusList();
      } else {
        clearSelection();
      }
      return;
    }
    if (event.key === "ContextMenu" || (event.shiftKey && (event.key === "F10" || event.key === "ContextMenu"))) {
      event.preventDefault();
      const focusedIndex = Math.max(0, ids.indexOf(focusedId));
      const file = visibleFiles[focusedIndex] ?? visibleFiles[0];
      if (file) {
        if (!selectedIds.includes(file.id)) {
          const next = selectionForRowClick(ids, focusedIndex, { selectedIds });
          updateSelection(next.selectedIds, next.focusedId, next.anchorIndex);
        }
        setContextMenu({ file, x: 220, y: 140 });
      }
      return;
    }
    const isArrow = event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "Home" || event.key === "End";
    if (isArrow) {
      event.preventDefault();
      const currentIndex = Math.max(0, ids.indexOf(focusedId));
      const nextIndex = moveFocusIndex(currentIndex, ids.length, event.key as "ArrowUp" | "ArrowDown" | "Home" | "End");
      if (nextIndex < 0) return;
      if (event.shiftKey) {
        const next = selectionForRowClick(ids, nextIndex, { range: true, anchorIndex: anchorIndex >= 0 ? anchorIndex : currentIndex, selectedIds });
        updateSelection(next.selectedIds, next.focusedId, next.anchorIndex);
      } else {
        const next = selectionForRowClick(ids, nextIndex, { selectedIds });
        updateSelection(next.selectedIds, next.focusedId, next.anchorIndex);
      }
      document.getElementById(`library-row-${ids[nextIndex]}`)?.scrollIntoView({ block: "nearest" });
      return;
    }
    const isSpace = event.key === " " || event.key === "Space";
    if (event.key === "Enter") {
      event.preventDefault();
      void openFile(visibleFiles.find((file) => file.id === focusedId) ?? visibleFiles[0]);
      return;
    }
    if (isSpace) {
      event.preventDefault();
      openPreview(visibleFiles.find((file) => file.id === focusedId) ?? visibleFiles[0]);
    }
  }

  function handleContextMenu(event: MouseEvent<HTMLDivElement>, index: number) {
    event.preventDefault();
    const file = visibleFiles[index];
    if (!file) return;
    if (!selectedIds.includes(file.id)) {
      const next = selectionForRowClick(visibleFiles.map((item) => item.id), index, { selectedIds });
      updateSelection(next.selectedIds, next.focusedId, next.anchorIndex);
    }
    setContextMenu({
      file,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - 260)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 230))
    });
  }

  function libraryState() {
    if (error) {
      const permission = /permission|access denied|权限|拒绝访问/i.test(error);
      return { tone: "error" as const, title: permission ? t("libraryPermissionState") : t("libraryLoadFailedTitle"), description: error, primaryAction: <button className={buttonSecondary} onClick={() => void loadPage(0, false)}>{t("libraryRetry")}</button> };
    }
    if (isLoading && page.total === 0) return { tone: "info" as const, title: t("libraryLoadingResults"), description: t("libraryScopeHint") };
    if (!stats.lastScannedAt && scope.kind === "all") return { tone: "info" as const, title: t("libraryNoScanTitle"), description: t("libraryNoScanDesc"), primaryAction: <button className={glassButtonPrimary} onClick={() => setView("scanner")}><Layers size={16} />{t("libraryGoToOverview")}</button> };
    if (isEmptyCurrentScanScope) return { tone: "info" as const, title: t("noCurrentScanTitle"), description: t("noCurrentScanDesc"), primaryAction: <button className={glassButtonPrimary} onClick={() => setView("scanner")}><Layers size={16} />{t("libraryGoToOverview")}</button>, secondaryAction: <button className={buttonSecondary} onClick={() => setScope({ kind: "all" })}>{t("viewAllIndexedFiles")}</button> };
    if (page.total > 0 && visibleFiles.length === 0) return { tone: "neutral" as const, title: hasAdvancedFilters ? t("libraryNoFilterTitle") : t("libraryNoSearchTitle"), description: hasAdvancedFilters ? t("libraryNoFilterDesc") : t("libraryNoSearchDesc") };
    if (page.total > 0) return null;
    if (searchQuery.trim()) return { tone: "neutral" as const, title: t("libraryNoSearchTitle"), description: t("libraryNoSearchDesc") };
    if (libraryFilter !== "all" || hasAdvancedFilters) return { tone: "neutral" as const, title: t("libraryNoFilterTitle"), description: t("libraryNoFilterDesc") };
    return { tone: "neutral" as const, title: t("libraryNoScopeFilesTitle"), description: t("libraryNoScopeFilesDesc"), secondaryAction: <button className={buttonSecondary} onClick={() => setScope({ kind: "all" })}>{t("viewAllIndexedFiles")}</button> };
  }

  const state = libraryState();
  const activeFilterCount = (libraryFilter !== "all" ? 1 : 0) + Object.values(advancedFilters).filter((value) => value !== "all" && value !== false).length;

  return (
    <div className={cn(pageFrame, "gap-3")}>
      <section className={cn(raisedSurface, "relative z-20 grid shrink-0 gap-2 px-3 py-2")}>
        <div data-section="scope bar" className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className={quietText}>{t("currentScope")}</span>
            <span className="min-w-0 truncate font-semibold text-[var(--zc-text-primary)]" title={scopeText}>{scopeText}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {scope.kind !== "all" ? <button className={cn(buttonGhost, "min-h-8 px-2.5 py-1.5 text-xs")} onClick={() => setScope({ kind: "all" })}><Layers size={15} />{t("viewAllIndexedFiles")}</button> : null}
            <button className={cn(buttonGhost, "min-h-8 px-2.5 py-1.5 text-xs")} onClick={() => void handleChooseFolders()}><FolderSearch size={15} />{t("switchScanDirectory")}</button>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <label data-section="search bar" className={cn(inputSurface, "flex min-h-9 min-w-[min(100%,320px)] flex-1 items-center gap-2 px-3")}>
            <Search size={15} className="shrink-0 text-[var(--zc-text-tertiary)]" aria-hidden="true" />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={scope.kind === "all" ? t("librarySearchPlaceholder") : t("librarySearchPlaceholderScoped")} className="min-w-0 flex-1 bg-transparent outline-none" aria-label={t("search")} />
          </label>
          <div className="relative" data-section="filter toolbar">
            <button ref={filterButtonRef} className={cn(buttonSubtle, "min-h-9 px-3 py-1.5 text-xs")} aria-expanded={isFilterOpen} aria-controls="library-filter-popover" aria-haspopup="dialog" onClick={() => { setIsFilterOpen((value) => !value); setIsSortOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape" && isFilterOpen) { event.preventDefault(); closeFilterPopover(); } }}><SlidersHorizontal size={15} />{t("libraryFilterButton")}{activeFilterCount ? <span className="tabular-nums text-[var(--zc-primary)]">{activeFilterCount}</span> : null}</button>
             {isFilterOpen ? <div id="library-filter-popover"><FileLibraryFilterPopover libraryFilter={libraryFilter} filters={advancedFilters} t={t} onLibraryFilterChange={(value) => { setLibraryFilter(value); clearSelection(); }} onFiltersChange={(value) => { setAdvancedFilters((current) => ({ ...current, ...value })); clearSelection(); }} onClear={clearFilters} onClose={closeFilterPopover} /></div> : null}
          </div>
          <div className="relative">
            <button ref={sortButtonRef} className={cn(buttonSubtle, "min-h-9 px-3 py-1.5 text-xs")} aria-expanded={isSortOpen} aria-haspopup="menu" onClick={() => { setIsSortOpen((value) => !value); setIsFilterOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape" && isSortOpen) { event.preventDefault(); closeSortPopover(); } }}><span>{currentSortLabel}</span><ChevronDown size={14} /></button>
             {isSortOpen ? <div className="absolute right-0 top-[calc(100%+8px)] z-30 grid min-w-48 gap-1 rounded-[var(--zc-radius-floating)] border border-[var(--zc-border-strong)] bg-[var(--zc-surface-floating)] p-2 shadow-[var(--zc-shadow-floating)] backdrop-blur-xl" role="menu" aria-label={t("librarySort")} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeSortPopover(); } }}>
              {sortOptions.map((option, index) => <button autoFocus={index === 0} key={option.key} role="menuitemradio" aria-checked={sort.key === option.key} className={cn("flex min-h-9 items-center justify-between rounded-[var(--zc-radius-control)] px-3 text-left text-sm", sort.key === option.key ? "bg-[var(--zc-surface-selected)] text-[var(--zc-text-primary)]" : "text-[var(--zc-text-secondary)] hover:bg-[var(--zc-surface-hover)]")} onClick={() => { setSort({ key: option.key, direction: sort.key === option.key && sort.direction === "desc" ? "asc" : "desc" }); closeSortPopover(); }}>{option.label}<span className="text-xs">{sort.key === option.key ? sort.direction === "desc" ? "↓" : "↑" : ""}</span></button>)}
              <button role="menuitem" className="border-t border-[var(--zc-divider)] px-3 pt-2 text-left text-xs text-[var(--zc-text-secondary)]" onClick={() => setSort((current) => ({ ...current, direction: current.direction === "desc" ? "asc" : "desc" }))}>{sort.direction === "desc" ? t("librarySortDescending") : t("librarySortAscending")}</button>
            </div> : null}
          </div>
        </div>
        <div data-section="applied filters" className="flex min-h-0 flex-wrap items-center gap-1.5" aria-label={t("libraryAppliedFilters")}>
          {libraryFilter !== "all" ? <FilterChip label={filterLabel(libraryFilter, t)} onRemove={() => setLibraryFilter("all")} /> : null}
          {advancedFilters.fileType !== "all" ? <FilterChip label={t(`libraryType${advancedFilters.fileType === "ArchivePackage" ? "Archive" : advancedFilters.fileType}` as Parameters<typeof t>[0])} onRemove={() => setAdvancedFilters((current) => ({ ...current, fileType: "all" }))} /> : null}
          {advancedFilters.lifecycle !== "all" ? <FilterChip label={t(`libraryLifecycle${advancedFilters.lifecycle}` as Parameters<typeof t>[0])} onRemove={() => setAdvancedFilters((current) => ({ ...current, lifecycle: "all" }))} /> : null}
          {advancedFilters.riskLevel !== "all" ? <FilterChip label={t(`libraryRisk${advancedFilters.riskLevel}` as Parameters<typeof t>[0])} onRemove={() => setAdvancedFilters((current) => ({ ...current, riskLevel: "all" }))} /> : null}
          {advancedFilters.size !== "all" ? <FilterChip label={t(`libraryFilter${advancedFilters.size[0].toUpperCase()}${advancedFilters.size.slice(1)}` as Parameters<typeof t>[0])} onRemove={() => setAdvancedFilters((current) => ({ ...current, size: "all" }))} /> : null}
          {advancedFilters.modified !== "all" ? <FilterChip label={t(advancedFilters.modified === "7d" ? "libraryFilterRecent7" : advancedFilters.modified === "30d" ? "libraryFilterRecent30" : "libraryFilterOlder")} onRemove={() => setAdvancedFilters((current) => ({ ...current, modified: "all" }))} /> : null}
          {advancedFilters.duplicateOnly ? <FilterChip label={t("libraryFilterDuplicateOnly")} onRemove={() => setAdvancedFilters((current) => ({ ...current, duplicateOnly: false }))} /> : null}
          {advancedFilters.reviewOnly ? <FilterChip label={t("libraryFilterReviewOnly")} onRemove={() => setAdvancedFilters((current) => ({ ...current, reviewOnly: false }))} /> : null}
        </div>
        <div data-section="result count" className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--zc-text-tertiary)]">
          <span>{t("libraryShowing").replace("{visible}", String(visibleFiles.length)).replace("{total}", String(page.total))}</span>
          <span>{selectedIds.length ? t("librarySelectedCount").replace("{count}", String(selectedIds.length)) : t("libraryScopeHint")}</span>
        </div>
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px] gap-4 overflow-hidden max-[1100px]:grid-cols-1 max-[1100px]:overflow-auto">
        <section className={cn(raisedSurface, "min-h-0 overflow-hidden max-[1100px]:min-h-[340px]")} aria-label={t("fileLibrary")}>
          {state ? <StateBlock tone={state.tone} title={state.title} description={state.description} primaryAction={state.primaryAction} secondaryAction={state.secondaryAction} /> : <FileLibraryList files={visibleFiles} selectedIds={selectedIds} focusedId={focusedId} hasMore={hasMore} isLoading={isLoading} remainingCount={remainingCount} language={language} t={t} onKeyDown={handleListKeyDown} onRowClick={selectRow} onRowDoubleClick={(event, index) => { event.preventDefault(); void openFile(visibleFiles[index]); }} onRowContextMenu={handleContextMenu} onLoadMore={() => void loadPage(page.files.length, true)} />}
        </section>
        <FileLibraryInspector selectedIds={selectedIds} selectedFiles={selectedFiles} language={language} t={t} onPreview={openPreview} onReveal={(path) => void revealFile(path)} onViewSuggestions={() => setView("organize")} onClearSelection={clearSelection} classificationDetails={selectedFiles[0] ? <FileClassificationDetails file={selectedFiles[0]} t={t} /> : null} />
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">{selectedIds.length ? t("librarySelectedCount").replace("{count}", String(selectedIds.length)) : ""}</p>
      {contextMenu ? <LibraryContextMenu context={contextMenu} t={t} onClose={closeContextMenu} onPreview={() => openPreview(contextMenu.file)} onReveal={() => void revealFile(contextMenu.file.path)} onViewSuggestions={() => setView("organize")} onClearSelection={clearSelection} /> : null}
      <FileLibraryPreviewDialog file={previewFile} language={language} t={t} onClose={() => { setPreviewFile(null); focusList(); }} onReveal={(path) => void revealFile(path)} />
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return <button type="button" className="inline-flex min-h-7 items-center gap-1 rounded-md border border-[var(--zc-border)] bg-[var(--zc-surface-subtle)] px-2 text-xs text-[var(--zc-text-secondary)] hover:border-[var(--zc-control-border-hover)] hover:text-[var(--zc-text-primary)]" onClick={onRemove} aria-label={`${label} ×`}>{label} <span aria-hidden="true">×</span></button>;
}

function LibraryContextMenu({ context, t, onClose, onPreview, onReveal, onViewSuggestions, onClearSelection }: { context: ContextMenuState; t: ReturnType<typeof import("../../i18n").makeTranslator>; onClose: () => void; onPreview: () => void; onReveal: () => void; onViewSuggestions: () => void; onClearSelection: () => void }) {
  return <div className="fixed z-50 grid min-w-52 gap-1 rounded-[var(--zc-radius-floating)] border border-[var(--zc-border-strong)] bg-[var(--zc-surface-floating)] p-2 shadow-[var(--zc-shadow-floating)] backdrop-blur-xl" style={{ left: context.x, top: context.y }} role="menu" aria-label={t("libraryContextMenu")} onPointerDown={(event) => event.stopPropagation()}>
    <p className="truncate px-3 py-1 text-xs font-semibold text-[var(--zc-text-tertiary)]" title={context.file.name}>{context.file.name}</p>
    <button role="menuitem" className={menuItemClass} onClick={onPreview}>{t("libraryPreview")}</button>
    <button role="menuitem" className={menuItemClass} onClick={() => { onReveal(); onClose(); }}>{t("libraryRevealFile")}</button>
    <button role="menuitem" className={menuItemClass} onClick={() => { onViewSuggestions(); onClose(); }}>{t("libraryViewSuggestions")}</button>
    <button role="menuitem" className={menuItemClass} onClick={() => { onClearSelection(); onClose(); }}>{t("libraryClearSelection")}</button>
  </div>;
}

const menuItemClass = "flex min-h-9 items-center rounded-[var(--zc-radius-control)] px-3 text-left text-sm text-[var(--zc-text-secondary)] hover:bg-[var(--zc-surface-hover)] hover:text-[var(--zc-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--zc-focus-ring)]";

function filterLabel(filter: LibraryFilter, t: ReturnType<typeof import("../../i18n").makeTranslator>) {
  const key = filter === "all" ? "libraryFilterAll" : filter === "active" ? "libraryFilterActive" : filter === "archive" ? "libraryFilterArchive" : filter === "review" ? "libraryFilterReview" : filter === "duplicate" ? "libraryFilterDuplicate" : "libraryFilterSensitive";
  return t(key);
}
