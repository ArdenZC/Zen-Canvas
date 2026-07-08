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
import type {
  ClassificationCorrectionRequest,
  FileRecord,
  FileType,
  Lifecycle,
  LibraryFilter,
  LibraryScope,
  Purpose,
  RiskLevel,
  SuggestedAction
} from "../../types/domain";
import type { Translator } from "../../types/ui";
import { libraryScopeLabel, readableError } from "../../utils/viewHelpers";
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
  const { onError, setView, t } = useChromeContext();
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
  const remainingCount = Math.max(0, page.total - page.files.length);
  const selectedFile = page.files.find((file) => file.id === selectedFileId) ?? page.files[0];

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

        <div data-section="ai classification handoff" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line-dark)] bg-[var(--surface-soft)] px-3 py-2">
          <div className="min-w-0">
            <strong className="block text-sm text-[var(--ink)]">分类建议</strong>
            <span className={quietText}>这里用于查看 AI reason、confidence、建议路径，并确认或纠正单个文件。</span>
          </div>
          <button className={cn(buttonSecondary, "min-h-8 px-3 py-1.5 text-xs")} onClick={() => setView("organize")}>
            去智能整理中重新分类
          </button>
        </div>

        {selectedFile ? <SelectedFileClassificationDetails file={selectedFile} /> : null}
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
            remainingCount={remainingCount}
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

function SelectedFileClassificationDetails({ file }: { file: FileRecord }) {
  const isAI = file.matched_rules.some((rule) => rule.startsWith("ai:"));
  const isLowConfidence = file.confidence < 0.65;
  const refresh = useFileLibraryStore((state) => state.refresh);
  const searchQuery = useAppStore((state) => state.searchQuery);
  const showSuccess = useAppStore((state) => state.showSuccess);
  const showError = useAppStore((state) => state.showError);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [correction, setCorrection] = useState<ClassificationCorrectionRequest>(() => correctionFromFile(file));

  useEffect(() => {
    setCorrection(correctionFromFile(file));
    setIsEditing(false);
  }, [file.id]);

  async function confirmClassification() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await tauriApi.confirmClassification(file.id);
      await refresh(searchQuery);
      showSuccess("已确认，并会用于后续学习。");
    } catch (error) {
      showError(readableError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitCorrection() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await tauriApi.correctClassification(file.id, correction);
      await refresh(searchQuery);
      setIsEditing(false);
      showSuccess("已学习你的分类习惯。");
    } catch (error) {
      showError(readableError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="grid gap-2 rounded-xl border border-[var(--line-dark)] bg-[var(--surface-soft)] px-3 py-2 text-xs">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <strong className="truncate text-sm text-[var(--ink)]">{file.name}</strong>
        {isAI ? <InlineBadge tone="info">AI</InlineBadge> : null}
        {file.requires_confirmation ? <InlineBadge tone="warning">需确认</InlineBadge> : null}
        {isLowConfidence ? <InlineBadge tone="warning">低置信度</InlineBadge> : null}
        <InlineBadge tone={file.suggested_action === "Review" ? "warning" : "success"}>{file.suggested_action}</InlineBadge>
      </div>
      <div className="grid gap-1 md:grid-cols-2">
        <span className="truncate text-[var(--muted)]" title={file.suggested_target_path || "无"}>
          建议路径：<strong className="font-medium text-[var(--ink)]">{file.suggested_target_path || "无"}</strong>
        </span>
        <span className="text-[var(--muted)]">
          置信度：<strong className="font-medium text-[var(--ink)]">{Math.round(file.confidence * 100)}%</strong>
        </span>
        <span className="truncate text-[var(--muted)]" title={file.matched_rules.join(", ") || "无"}>
          来源：<strong className="font-medium text-[var(--ink)]">{isAI ? "AI" : file.matched_rules.join(", ") || "无"}</strong>
        </span>
        <span className="truncate text-[var(--muted)]" title={file.classification_reason}>
          原因：<strong className="font-medium text-[var(--ink)]">{file.classification_reason || "无"}</strong>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className={buttonSecondary} onClick={() => void confirmClassification()} disabled={isSubmitting}>
          确认分类正确
        </button>
        <button className={buttonSecondary} onClick={() => setIsEditing((value) => !value)} disabled={isSubmitting}>
          修改分类
        </button>
        <span className={quietText}>确认或修改后，Zen Canvas 会用于学习以后类似文件的分类习惯。</span>
      </div>
      {isEditing && (
        <div className="grid gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
          <div className="grid gap-2 md:grid-cols-2">
            <CorrectionSelect
              label="fileType"
              value={correction.fileType}
              options={FILE_TYPE_OPTIONS}
              onChange={(fileType) => setCorrection((current) => ({ ...current, fileType }))}
            />
            <CorrectionSelect
              label="purpose"
              value={correction.purpose}
              options={PURPOSE_OPTIONS}
              onChange={(purpose) => setCorrection((current) => ({ ...current, purpose }))}
            />
            <CorrectionSelect
              label="lifecycle"
              value={correction.lifecycle}
              options={LIFECYCLE_OPTIONS}
              onChange={(lifecycle) => setCorrection((current) => ({ ...current, lifecycle }))}
            />
            <CorrectionSelect
              label="riskLevel"
              value={correction.riskLevel}
              options={RISK_LEVEL_OPTIONS}
              onChange={(riskLevel) => setCorrection((current) => ({ ...current, riskLevel }))}
            />
            <CorrectionSelect
              label="suggestedAction"
              value={correction.suggestedAction}
              options={SUGGESTED_ACTION_OPTIONS}
              onChange={(suggestedAction) => setCorrection((current) => ({ ...current, suggestedAction }))}
            />
            <label className="grid gap-1">
              <span className={metadataText}>context</span>
              <input
                className={inputSurface}
                value={correction.context}
                onChange={(event) => setCorrection((current) => ({ ...current, context: event.target.value }))}
              />
            </label>
            <label className="grid gap-1">
              <span className={metadataText}>targetTemplate</span>
              <input
                className={inputSurface}
                placeholder="Teaching/Scala"
                value={correction.targetTemplate}
                onChange={(event) => setCorrection((current) => ({ ...current, targetTemplate: event.target.value }))}
              />
            </label>
            <label className="grid gap-1">
              <span className={metadataText}>suggestedName</span>
              <input
                className={inputSurface}
                value={correction.suggestedName ?? ""}
                onChange={(event) => setCorrection((current) => ({ ...current, suggestedName: event.target.value }))}
              />
            </label>
          </div>
          <label className="grid gap-1">
            <span className={metadataText}>reason</span>
            <input
              className={inputSurface}
              value={correction.reason ?? ""}
              onChange={(event) => setCorrection((current) => ({ ...current, reason: event.target.value }))}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className={glassButtonPrimary} onClick={() => void submitCorrection()} disabled={isSubmitting}>
              以后类似文件都这样处理
            </button>
            <button className={buttonSecondary} onClick={() => setIsEditing(false)} disabled={isSubmitting}>
              取消
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function CorrectionSelect<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className={metadataText}>{label}</span>
      <select className={inputSurface} value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function correctionFromFile(file: FileRecord): ClassificationCorrectionRequest {
  return {
    fileType: file.file_type,
    purpose: file.purpose,
    lifecycle: file.lifecycle,
    context: file.context,
    riskLevel: file.risk_level,
    suggestedAction: file.suggested_action,
    targetTemplate: relativeTargetTemplate(file.suggested_target_path),
    suggestedName: file.suggested_name || undefined,
    reason: file.classification_reason || undefined
  };
}

function relativeTargetTemplate(path: string) {
  const value = path.trim().replace(/\\/g, "/");
  if (!value || value.startsWith("/") || value.startsWith("//") || /^[A-Za-z]:\//.test(value)) {
    return "";
  }
  return value;
}

const FILE_TYPE_OPTIONS: readonly FileType[] = [
  "Document",
  "Image",
  "Video",
  "Audio",
  "Code",
  "ArchivePackage",
  "Installer",
  "Spreadsheet",
  "Presentation",
  "Other"
];
const PURPOSE_OPTIONS: readonly Purpose[] = [
  "Project",
  "Teaching",
  "Study",
  "Work",
  "Personal",
  "Career",
  "Finance",
  "Identity",
  "Media",
  "Installer",
  "Temporary",
  "Archive",
  "Unknown"
];
const LIFECYCLE_OPTIONS: readonly Lifecycle[] = [
  "Inbox",
  "Active",
  "Reference",
  "Archive",
  "Disposable",
  "Duplicate",
  "Sensitive"
];
const RISK_LEVEL_OPTIONS: readonly RiskLevel[] = ["Normal", "Sensitive", "System", "Unknown"];
const SUGGESTED_ACTION_OPTIONS: readonly SuggestedAction[] = [
  "Keep",
  "Rename",
  "Move",
  "MoveAndRename",
  "Archive",
  "Review",
  "DeleteCandidate"
];

function InlineBadge({ tone, children }: { tone: "info" | "warning" | "success"; children: string }) {
  return <span className={inlineBadgeClass(tone)}>{children}</span>;
}

function inlineBadgeClass(tone: "info" | "warning" | "success") {
  return cn(
    "inline-flex max-w-[9rem] items-center truncate rounded-full border px-2 py-0.5 text-[10px] font-medium leading-4",
    tone === "info" && "border-blue-400/22 bg-blue-500/8 text-blue-700 dark:text-blue-200",
    tone === "warning" && "border-amber-400/28 bg-amber-500/8 text-amber-700 dark:text-amber-200",
    tone === "success" && "border-emerald-400/24 bg-emerald-500/8 text-emerald-700 dark:text-emerald-200"
  );
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
  remainingCount,
  onLoadMore,
  onError,
  selectedFileId,
  setSelectedFileId,
  t
}: {
  files: FileRecord[];
  hasMore: boolean;
  isLoading: boolean;
  remainingCount: number;
  onLoadMore: () => void;
  onError: (message: string) => void;
  selectedFileId?: string;
  setSelectedFileId: (id: string) => void;
  t: Translator;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
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
  const remainingDisplayCount = Math.min(LIBRARY_PAGE_SIZE, remainingCount);

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

  useEffect(() => {
    const root = parentRef.current;
    const sentinel = loadMoreSentinelRef.current;
    if (!root || !sentinel || !hasMore || isLoading || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        onLoadMore();
      }
    }, {
      root,
      rootMargin: "420px"
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, onLoadMore]);

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
        <div ref={loadMoreSentinelRef} className="h-px" aria-hidden="true" />
        {hasMore && (
          <button className={cn(buttonSecondary, "mx-auto my-3 flex min-h-9 px-3 py-1.5 text-xs")} onClick={onLoadMore} disabled={isLoading}>
            <Plus size={15} />
            {t("loadMoreFiles").replace("{count}", String(remainingDisplayCount))}
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
      <div ref={loadMoreSentinelRef} className="h-px" aria-hidden="true" />
      {hasMore && (
        <button className={cn(buttonSecondary, "mx-auto my-3 flex min-h-9 px-3 py-1.5 text-xs")} onClick={onLoadMore} disabled={isLoading}>
          <Plus size={15} />
          {t("loadMoreFiles").replace("{count}", String(remainingDisplayCount))}
        </button>
      )}
    </section>
  );
}
