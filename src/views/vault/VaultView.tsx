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
import { buttonSecondary, buttonSubtle, cn, glassButtonPrimary, inputSurface, virtualList, virtualSpacer } from "../../utils/tw";
import {
  NoticeBanner,
  StateBlock,
  ToneBadge,
  inlineActions,
  listMotion,
  metadataText,
  pageFrame,
  quietText,
  scopeBarSurface,
  toolbarSurface
} from "../shared/ui";
import { AssetCard } from "./AssetCard";

const ASSET_GRID_ROW_HEIGHT = 246;

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
  const sentinelRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || isLoading) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        loadMore();
      }
    }, { rootMargin: "320px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isLoading, loadMore]);

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
    <div className={cn(pageFrame, "gap-4")}>
      <section data-section="scope bar" className={cn(scopeBarSurface, "flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3")}>
        <div className="min-w-0">
          <span className={quietText}>{t("currentScope")}</span>
          <strong className="mt-1 block truncate text-sm text-[var(--ink)]">{scopeText}</strong>
        </div>
        <div className={inlineActions}>
          <button className={buttonSecondary} onClick={() => setScope({ kind: "all" })} disabled={scope.kind === "all"}>
            <Layers size={16} />
            <span>{t("viewAllIndexedFiles")}</span>
          </button>
          <button className={buttonSecondary} onClick={() => void handleChooseFolders()}>
            <FolderSearch size={16} />
            <span>{t("switchScanDirectory")}</span>
          </button>
        </div>
      </section>

      <section className={cn(toolbarSurface, "grid shrink-0 gap-3 px-4 py-3")}>
        <label data-section="search bar" className={cn(inputSurface, "flex items-center gap-2 px-3")}>
          <Search size={16} className="text-[var(--muted)]" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={scopedSearchPlaceholder}
            className="min-w-0 flex-1 bg-transparent outline-none"
            aria-label={t("search")}
          />
        </label>
        <div data-section="filter toolbar" className="flex flex-wrap items-center gap-2">
          {filters.map((filter) => (
            <button
              key={filter.key}
              className={filterPillClass(libraryFilter === filter.key)}
              onClick={() => setLibraryFilter(filter.key)}
              aria-pressed={libraryFilter === filter.key}
              title={filter.description}
            >
              <ToneBadge tone={filter.tone}>{filter.label}</ToneBadge>
            </button>
          ))}
        </div>
        <div data-section="result count" className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className={metadataText}>
            {t("libraryShowing").replace("{visible}", String(page.files.length)).replace("{total}", String(page.total))}
            {" / "}
            {t("currentLibraryFilter")}: <strong className="text-[var(--ink)]">{activeFilterLabel}</strong>
          </span>
          <span className={metadataText}>{isLoading ? t("libraryLoadingResults") : activeFilterDescription}</span>
        </div>
      </section>

      <NoticeBanner tone="info">{t("libraryScopeHint")}</NoticeBanner>

      {libraryState ? (
        <StateBlock
          tone={libraryState.tone}
          title={libraryState.title}
          description={libraryState.description}
          primaryAction={libraryState.primaryAction}
          secondaryAction={libraryState.secondaryAction}
        />
      ) : (
        <div className="min-h-0 flex-1">
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
          <div ref={sentinelRef} className="h-1" />
          {hasMore && (
            <button className={cn(buttonSecondary, "mx-auto mt-3 flex")} onClick={loadMore} disabled={isLoading}>
              <Plus size={16} />
              {t("loadMoreFiles").replace("{count}", String(Math.min(page.limit, page.total - page.files.length)))}
            </button>
          )}
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

function filterPillClass(active: boolean) {
  return cn(
    buttonSubtle,
    "min-h-8 rounded-full px-1.5 py-1 text-xs",
    active && "border-blue-400/45 bg-blue-500/12 text-[var(--ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
  );
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
  const [columns, setColumns] = useState(4);
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
      const nextColumns = Math.max(1, Math.min(4, Math.floor(width / 230)));
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

  if (!shouldVirtualize) {
    return (
      <motion.section className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3" variants={listMotion} initial="hidden" animate="show">
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
      </motion.section>
    );
  }

  return (
    <section ref={parentRef} className={cn("min-h-80 flex-1", virtualList)}>
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
    </section>
  );
}
