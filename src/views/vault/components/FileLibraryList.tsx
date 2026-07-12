import { AlertTriangle, Archive, File, FileCode2, FileImage, FileText, Folder, Music2, Package, Video } from "lucide-react";
import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { FileRecord } from "../../../types/domain";
import type { Language } from "../../../i18n";
import type { Translator } from "../../../types/ui";
import { LIBRARY_PAGE_SIZE } from "../../../store/useFileLibraryStore";
import { formatBytes, formatDate } from "../../../utils/format";
import { compactPath, formatDisplayPath } from "../../../utils/viewHelpers";
import { buttonSecondary, cn, virtualList, virtualSpacer } from "../../../utils/tw";
import { shouldTriggerLoadMore } from "../../../utils/virtualization";
import { filePreviewKind } from "../fileLibraryModel";

const ROW_HEIGHT = 52;

export function FileLibraryList({
  files,
  selectedIds,
  focusedId,
  hasMore,
  isLoading,
  remainingCount,
  language,
  t,
  onKeyDown,
  onRowClick,
  onRowDoubleClick,
  onRowContextMenu,
  onLoadMore
}: {
  files: FileRecord[];
  selectedIds: string[];
  focusedId: string;
  hasMore: boolean;
  isLoading: boolean;
  remainingCount: number;
  language: Language;
  t: Translator;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onRowClick: (event: React.MouseEvent<HTMLDivElement>, index: number) => void;
  onRowDoubleClick: (event: React.MouseEvent<HTMLDivElement>, index: number) => void;
  onRowContextMenu: (event: React.MouseEvent<HTMLDivElement>, index: number) => void;
  onLoadMore: () => void;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8
  });
  const lastVisibleIndex = rowVirtualizer.getVirtualItems().at(-1)?.index ?? -1;
  const remainingDisplayCount = Math.min(LIBRARY_PAGE_SIZE, remainingCount);

  useEffect(() => {
    if (shouldTriggerLoadMore(lastVisibleIndex, files.length, hasMore, isLoading)) onLoadMore();
  }, [files.length, hasMore, isLoading, lastVisibleIndex, onLoadMore]);

  useEffect(() => {
    if (!focusedId) return;
    const index = files.findIndex((file) => file.id === focusedId);
    if (index >= 0) rowVirtualizer.scrollToIndex(index, { align: "auto" });
  }, [files, focusedId, rowVirtualizer]);

  return (
    <div
      ref={parentRef}
      className={cn("h-full min-h-0", virtualList)}
      role="listbox"
      aria-label={t("fileLibrary")}
      aria-multiselectable="true"
      aria-activedescendant={focusedId ? `library-row-${focusedId}` : undefined}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div className={cn("grid min-w-[560px] grid-cols-[minmax(220px,1.5fr)_minmax(160px,1fr)_132px_92px] items-center gap-3 border-b border-[var(--zc-divider)] px-3 py-2 text-[11px] font-semibold text-[var(--zc-text-tertiary)]", "max-[1100px]:min-w-0 max-[1100px]:grid-cols-[minmax(0,1fr)_92px]")} role="presentation">
        <span>{t("fileName")}</span>
        <span className="max-[1100px]:hidden">{t("fileLocation")}</span>
        <span className="max-[1100px]:hidden">{t("fileModified")}</span>
        <span className="text-right">{t("fileSize")}</span>
      </div>
      {files.length === 0 ? (
        <div className="grid min-h-32 place-items-center px-4 text-sm text-[var(--zc-text-secondary)]">{t("libraryNoSearchTitle")}</div>
      ) : (
        <div className={virtualSpacer} style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const file = files[virtualRow.index];
            if (!file) return null;
            const selected = selectedIds.includes(file.id);
            const focused = file.id === focusedId;
            return (
              <FileLibraryRow
                key={file.id}
                file={file}
                selected={selected}
                focused={focused}
                language={language}
                t={t}
                style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}
                onClick={(event) => onRowClick(event, virtualRow.index)}
                onDoubleClick={(event) => onRowDoubleClick(event, virtualRow.index)}
                onContextMenu={(event) => onRowContextMenu(event, virtualRow.index)}
              />
            );
          })}
        </div>
      )}
      {hasMore ? (
        <button className={cn(buttonSecondary, "mx-auto my-3 flex min-h-9 px-3 py-1.5 text-xs")} onClick={onLoadMore} disabled={isLoading}>
          <span>{isLoading ? t("libraryLoadingMore") : t("loadMoreFiles").replace("{count}", String(remainingDisplayCount))}</span>
        </button>
      ) : files.length > 0 ? (
        <p className="py-3 text-center text-xs text-[var(--zc-text-tertiary)]">{t("libraryLoadedAll")}</p>
      ) : null}
    </div>
  );
}

function FileLibraryRow({
  file,
  selected,
  focused,
  language,
  t,
  style,
  onClick,
  onDoubleClick,
  onContextMenu
}: {
  file: FileRecord;
  selected: boolean;
  focused: boolean;
  language: Language;
  t: Translator;
  style: React.CSSProperties;
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  onDoubleClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  onContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void;
}) {
  const Icon = fileIcon(file);
  const missing = file.is_deleted || file.is_stale;
  const path = compactPath(formatDisplayPath(file.directory), 54);
  return (
    <div
      id={`library-row-${file.id}`}
      className={cn(
        "absolute left-0 top-0 grid min-w-[560px] w-full grid-cols-[minmax(220px,1.5fr)_minmax(160px,1fr)_132px_92px] items-center gap-3 border-b border-[var(--zc-divider)] px-3 text-left text-sm transition-[background,border-color,box-shadow] duration-[var(--zc-duration-fast)] max-[1100px]:min-w-0 max-[1100px]:grid-cols-[minmax(0,1fr)_92px]",
        "hover:bg-[var(--zc-surface-hover)]",
        selected && "bg-[var(--zc-surface-selected)]",
        focused && "outline outline-2 outline-offset-[-2px] outline-[var(--zc-focus-ring)]"
      )}
      style={style}
      role="option"
      aria-selected={selected}
      aria-label={`${file.name}, ${path}${missing ? `, ${t("libraryFileNotFound")}` : ""}`}
      data-library-row={file.id}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-[var(--zc-radius-control)] border border-[var(--zc-divider)] bg-[var(--zc-surface-subtle)] text-[var(--zc-text-secondary)]" aria-hidden="true">
          <Icon size={17} />
          {missing ? <AlertTriangle size={13} className="absolute -right-1 -top-1 rounded-full bg-[var(--zc-surface)] text-[var(--zc-warning-text)]" /> : null}
        </span>
        <div className="min-w-0">
          <p className={cn("truncate font-medium text-[var(--zc-text-primary)]", missing && "text-[var(--zc-text-secondary)]")} title={file.name}>{file.name}</p>
          <p className={cn("truncate text-xs text-[var(--zc-text-secondary)]", missing && "text-[var(--zc-warning-text)]")} aria-label={missing ? t("libraryFileNotFound") : undefined}>{missing ? t("libraryFileNotFound") : `${typeLabel(file, t)} · ${purposeLabel(file, t)}`}</p>
        </div>
      </div>
      <span className="truncate text-xs text-[var(--zc-text-secondary)] max-[1100px]:hidden" title={formatDisplayPath(file.directory)}>{path}</span>
      <time className="truncate text-xs text-[var(--zc-text-secondary)] max-[1100px]:hidden" dateTime={file.modified_at}>{formatDate(file.modified_at, language)}</time>
      <span className="truncate text-right text-xs tabular-nums text-[var(--zc-text-primary)]">{formatBytes(file.size)}</span>
    </div>
  );
}

function fileIcon(file: FileRecord) {
  const kind = filePreviewKind(file);
  if (kind === "image") return FileImage;
  if (kind === "text") return FileCode2;
  if (kind === "audio") return Music2;
  if (kind === "video") return Video;
  if (kind === "archive") return Archive;
  if (kind === "folder") return Folder;
  if (file.file_type === "Installer") return Package;
  if (file.file_type === "Document") return FileText;
  return File;
}

export function typeLabel(file: FileRecord, t: Translator) {
  const key = `libraryType${file.file_type === "ArchivePackage" ? "Archive" : file.file_type}` as Parameters<Translator>[0];
  return t(key);
}

export function purposeLabel(file: FileRecord, t: Translator) {
  return t(`libraryPurpose${file.purpose}` as Parameters<Translator>[0]);
}

export function lifecycleLabel(file: FileRecord, t: Translator) {
  return t(`libraryLifecycle${file.lifecycle}` as Parameters<Translator>[0]);
}

export function riskLabel(risk: FileRecord["risk_level"], t: Translator) {
  return t(`libraryRisk${risk}` as Parameters<Translator>[0]);
}
