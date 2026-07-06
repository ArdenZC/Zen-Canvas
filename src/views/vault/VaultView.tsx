import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion } from "motion/react";
import { FolderSearch, Layers, Plus, Search } from "lucide-react";
import { tauriApi } from "../../api/tauriApi";
import { useChromeContext } from "../../contexts/AppContexts";
import { useDebounce } from "../../hooks/useDebounce";
import { useAppStore } from "../../store/useAppStore";
import { LIBRARY_PAGE_SIZE, useFileLibraryStore } from "../../store/useFileLibraryStore";
import { useScanManagerStore } from "../../store/useScanManagerStore";
import type { FileRecord, LibraryFilter, LibraryScope } from "../../types/domain";
import type { Translator } from "../../types/ui";
import { libraryScopeLabel } from "../../utils/viewHelpers";
import { shouldTriggerLoadMore, shouldVirtualizeList } from "../../utils/virtualization";
import { buttonSecondary, cn, glassButtonPrimary, inputSurface, virtualList, virtualSpacer } from "../../utils/tw";
import {
  StateBlock,
  inlineActions,
  listMotion,
  metadataText,
  pageFrame,
  quietText,
  toolbarSurface
} from "../shared/ui";
import { AssetCard } from "./AssetCard";

const ASSET_GRID_MAX_COLUMNS = 5;
const ASSET_GRID_ROW_HEIGHT = 172;

export function VaultView() {
  const { onError, t } = useChromeContext();
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);
  const hasMore = page.files.length < page.total;

  const loadPage = useCallback(async (offset: number, append: boolean) => {
    const requestId = ++requestIdRef.current;
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
      if (!append && next.files[0]) setSelectedFileId(next.files[0].id);
      await loadStats(scope);
    } catch (caught) {
      if (requestId === requestIdRef.current) setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [debouncedSearchQuery, libraryFilter, loadStats, scope, setPage, setSelectedFileId]);

  useEffect(() => {
    void loadPage(0, false);
  }, [loadPage]);

  const loadMore = useCallback(() => {
    void loadPage(page.files.length, true);
  }, [loadPage, page.files.length]);

  const filters = useMemo(() => [
    { key: "all", label: t("libraryAllFiles"), description: t("libraryAllFilesDesc"), tone: "slate" },
    { key: "active", label: t("libraryActiveFiles"), description: t("libraryActiveFilesDesc"), tone: "green" },
    { key: "archive", label: t("libraryArchiveFiles"), description: t("libraryArchiveFilesDesc"), tone: "purple" },
    { key: "review", label: t("libraryReviewFiles"), description: t("libraryReviewFilesDesc"), tone: "amber" },
    { key: "duplicate", label: t("libraryDuplicateFiles"), description: t("libraryDuplicateFilesDesc"), tone: "amber" },
    { key: "sensitive", label: t("librarySensitiveFiles"), description: t("librarySensitiveFilesDesc"), tone: "red" }
  ] satisfies Array<{ key: LibraryFilter; label: string; description: string; tone: "blue" | "green" | "amber" | "red" | "slate" | "purple" }>, [t]);
  const scopeText = libraryScopeLabel(scope, t("allIndexedFiles"), t("noFolderSelected"));
  const scopedSearchPlaceholder = scope.kind === "all" ? t("librarySearchPlaceholder") : t("librarySearchPlaceholderScoped");
  const isEmptyCurrentScanScope = scope.kind === "current_scan" && scope.roots.length === 0;
  const activeFilterLabel = filters.find((filter) => filter.key === libraryFilter)?.label ?? t("libraryFilterAll");
  const activeFilterDescription = filters.find((filter) => filter.key === libraryFilter)?.description ?? "";
  const libraryState = resolveLibraryState({
    error,
    isEmptyCurrentScanScope,
    isLoading,
    lastScannedAt: stats.lastScannedAt,
    libraryFilter,
    pageTotal: page.total,
    scope,
    searchQuery
  });

  return (
    <div className={cn(pageFrame, "gap-3 overflow-hidden")}>
      <section className={cn(toolbarSurface, "grid shrink-0 gap-2 px-3 py-2")}>
        <div data-section="scope bar" className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 text-sm">
            <span className={quietText}>{t("currentScope")}</span>
            <strong className="ml-2 inline-block max-w-[52vw] truncate align-bottom text-[var(--ink)]">{scopeText}</strong>
          </div>
          <div className={inlineActions}>
            {scope.kind !== "all" && (
              <button className={cn(buttonSecondary, "min-h-8 px-3 py-1.5 text-xs")} onClick={() => setScope({ kind: "all" })}>
                <Layers size={15} />
                <span>{t("viewAllIndexedFiles")}</span>
              </button>
            )}
            <button className={cn(buttonSecondary, "min-h-8 px-3 py-1.5 text-xs")} onClick={() => void handleChooseFolders()}>
              <FolderSearch size={15} />
              <span>{t("switchScanDirectory")}</span>
            </button>
          </div>
        </div>

        <div className="grid min-w-0 gap-2 xl:grid-cols-[minmax(260px,360px)_minmax(0,1fr)] xl:items-center">
          <label data-section="search bar" className={cn(inputSurface, "flex min-h-9 items-center gap-2 px-3")}>
            <Search size={15} className="text-[var(--muted)]" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={scopedSearchPlaceholder}
              className="min-w-0 flex-1 bg-transparent outline-none"
              aria-label={t("search")}
            />
          </label>
          <div data-section="filter toolbar" className="flex min-w-0 flex-wrap items-center gap-1.5">
            {filters.map((filter) => {
              const active = libraryFilter === filter.key;
              return (
                <button
                  key={filter.key}
                  className={filterPillClass(active, filter.tone)}
                  onClick={() => setLibraryFilter(filter.key)}
                  aria-pressed={libraryFilter === filter.key}
                  title={filter.description}
                >
                  <span className={filterDotClass(filter.tone)} aria-hidden="true" />
                  <span className="truncate">{filter.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div data-section="result count" className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className={metadataText}>
            {t("libraryShowing").replace("{visible}", String(page.files.length)).replace("{total}", String(page.total))}
            {" / "}
            {t("currentLibraryFilter")}: <strong className="text-[var(--ink)]">{activeFilterLabel}</strong>
          </span>
          <span className={quietText}>{isLoading ? t("libraryLoadingResults") : activeFilterDescription || t("libraryScopeHint")}</span>
        </div>
      </section>

      {libraryState ? (
        <StateBlock
          tone={libraryState.tone}
          title={libraryState.title}
          description={libraryState.description}
          primaryAction={libraryState.primaryAction}
          secondaryAction={libraryState.secondaryAction}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden">
          <VirtualAssetGrid
            files={page.files}
            hasMore={hasMore}
            isLoading={isLoading}
            onLoadMore={loadMore}
            onError={onError}
            selectedFileId={selectedFileId}
            setSelectedFileId={setSelectedFileId}
            t={t}
          />
        </div>
      )}
    </div>
  );

  function resolveLibraryState({
    error,
    isEmptyCurrentScanScope,
    isLoading,
    lastScannedAt,
    libraryFilter,
    pageTotal,
    scope,
    searchQuery
  }: {
    error: string;
    isEmptyCurrentScanScope: boolean;
    isLoading: boolean;
    lastScannedAt: string | null;
    libraryFilter: LibraryFilter;
    pageTotal: number;
    scope: LibraryScope;
    searchQuery: string;
  }) {
    if (error) {
      return {
        tone: "error" as const,
        title: t("libraryLoadFailedTitle"),
        description: error
      };
    }
    if (isLoading && pageTotal === 0) {
      return {
        tone: "info" as const,
        title: t("libraryLoadingResults"),
        description: t("libraryScopeHint")
      };
    }
    if (isEmptyCurrentScanScope) {
      return {
        tone: "info" as const,
        title: t("noCurrentScanTitle"),
        description: t("noCurrentScanDesc"),
        primaryAction: (
          <button className={glassButtonPrimary} onClick={() => void handleChooseFolders()}>
            <FolderSearch size={16} />
            <span>{t("chooseFolderScan")}</span>
          </button>
        ),
        secondaryAction: (
          <button className={buttonSecondary} onClick={() => setScope({ kind: "all" })}>
            <Layers size={16} />
            <span>{t("viewAllIndexedFiles")}</span>
          </button>
        )
      };
    }
    if (pageTotal > 0) return null;
    if (searchQuery.trim()) {
      return {
        tone: "neutral" as const,
        title: t("libraryNoSearchTitle"),
        description: t("libraryNoSearchDesc")
      };
    }
    if (libraryFilter !== "all") {
      return {
        tone: "neutral" as const,
        title: t("libraryNoFilterTitle"),
        description: t("libraryNoFilterDesc")
      };
    }
    if (!lastScannedAt && scope.kind === "all") {
      return {
        tone: "info" as const,
        title: t("libraryNoScanTitle"),
        description: t("libraryNoScanDesc"),
        primaryAction: (
          <button className={glassButtonPrimary} onClick={() => void handleChooseFolders()}>
            <FolderSearch size={16} />
            <span>{t("chooseFolderScan")}</span>
          </button>
        )
      };
    }
    return {
      tone: "neutral" as const,
      title: t("libraryNoScopeFilesTitle"),
      description: t("libraryNoScopeFilesDesc"),
      secondaryAction: (
        <button className={buttonSecondary} onClick={() => setScope({ kind: "all" })}>
          <Layers size={16} />
          <span>{t("viewAllIndexedFiles")}</span>
        </button>
      )
    };
  }
}

function filterPillClass(active: boolean, tone: "blue" | "green" | "amber" | "red" | "slate" | "purple") {
  return cn(
    "inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-[background,border-color,color,box-shadow]",
    active
      ? "border-blue-400/55 bg-blue-500/12 text-[var(--ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]"
      : "border-[var(--line-dark)] bg-[var(--surface-soft)] text-[var(--muted)] hover:border-blue-400/30 hover:bg-[var(--surface)] hover:text-[var(--ink)]",
    tone === "red" && !active && "text-red-700 dark:text-red-200",
    tone === "amber" && !active && "text-amber-700 dark:text-amber-200"
  );
}

function filterDotClass(tone: "blue" | "green" | "amber" | "red" | "slate" | "purple") {
  if (tone === "green") return "h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500";
  if (tone === "amber") return "h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500";
  if (tone === "red") return "h-1.5 w-1.5 shrink-0 rounded-full bg-red-500";
  if (tone === "purple") return "h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500";
  if (tone === "slate") return "h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400";
  return "h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500";
}

function VirtualAssetGrid({
  files,
  hasMore,
  isLoading,
  onLoadMore,
  onError,
  selectedFileId,
  setSelectedFileId,
  t
}: {
  files: FileRecord[];
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  onError: (message: string) => void;
  selectedFileId?: string;
  setSelectedFileId: (id: string) => void;
  t: Translator;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState(3);
  const shouldVirtualize = shouldVirtualizeList(files.length);
  const rowCount = Math.ceil(files.length / columns);
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ASSET_GRID_ROW_HEIGHT,
    overscan: 4
  });
  const lastVisibleRowIndex = rowVirtualizer.getVirtualItems().at(-1)?.index ?? -1;

  useEffect(() => {
    const node = parentRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      const nextColumns = Math.max(1, Math.min(ASSET_GRID_MAX_COLUMNS, Math.floor(width / 260)));
      setColumns(nextColumns || 1);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (shouldTriggerLoadMore(lastVisibleRowIndex, rowCount, hasMore, isLoading)) {
      onLoadMore();
    }
  }, [hasMore, isLoading, lastVisibleRowIndex, onLoadMore, rowCount]);

  const handleScroll = useCallback(() => {
    const node = parentRef.current;
    if (!node || !hasMore || isLoading) return;
    if (node.scrollTop + node.clientHeight >= node.scrollHeight - 420) onLoadMore();
  }, [hasMore, isLoading, onLoadMore]);

  if (!shouldVirtualize) {
    return (
      <section ref={parentRef} className={cn("h-full min-h-0 pr-1", virtualList)} onScroll={handleScroll}>
        <motion.div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3" variants={listMotion} initial="hidden" animate="show">
          {files.map((file) => (
            <AssetCard
              file={file}
              isSelected={selectedFileId === file.id}
              key={file.id}
              onError={onError}
              setSelectedFileId={setSelectedFileId}
              t={t}
            />
          ))}
        </motion.div>
        {hasMore && (
          <button className={cn(buttonSecondary, "mx-auto my-3 flex min-h-9 px-3 py-1.5 text-xs")} onClick={onLoadMore} disabled={isLoading}>
            <Plus size={15} />
            {t("loadMoreFiles").replace("{count}", String(Math.min(LIBRARY_PAGE_SIZE, files.length)))}
          </button>
        )}
      </section>
    );
  }

  return (
    <section ref={parentRef} className={cn("h-full min-h-0 pr-1", virtualList)} onScroll={handleScroll}>
      <div className={virtualSpacer} style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const start = virtualRow.index * columns;
          const rowFiles = files.slice(start, start + columns);
          return (
            <div
              className="absolute left-0 top-0 grid w-full gap-3"
              key={virtualRow.key}
              style={{
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              {rowFiles.map((file) => (
                <AssetCard
                  file={file}
                  isSelected={selectedFileId === file.id}
                  key={file.id}
                  onError={onError}
                  setSelectedFileId={setSelectedFileId}
                  t={t}
                />
              ))}
            </div>
          );
        })}
      </div>
      {hasMore && (
        <button className={cn(buttonSecondary, "mx-auto my-3 flex min-h-9 px-3 py-1.5 text-xs")} onClick={onLoadMore} disabled={isLoading}>
          <Plus size={15} />
          {t("loadMoreFiles").replace("{count}", String(Math.min(LIBRARY_PAGE_SIZE, files.length)))}
        </button>
      )}
    </section>
  );
}
