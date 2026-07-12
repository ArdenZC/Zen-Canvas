import type { FileQueryResult, FileRecord, LibraryFilter } from "../../types/domain";

export type LibrarySortKey = "name" | "modified_at" | "size" | "last_opened_at" | "confidence";
export type SortDirection = "asc" | "desc";

export interface LibrarySort {
  key: LibrarySortKey;
  direction: SortDirection;
}

export type SizeFilter = "all" | "small" | "medium" | "large";
export type ModifiedFilter = "all" | "7d" | "30d" | "older";

export interface LibraryAdvancedFilters {
  fileType: FileRecord["file_type"] | "all";
  lifecycle: FileRecord["lifecycle"] | "all";
  riskLevel: FileRecord["risk_level"] | "all";
  size: SizeFilter;
  modified: ModifiedFilter;
  duplicateOnly: boolean;
  reviewOnly: boolean;
}

export const emptyLibraryAdvancedFilters: LibraryAdvancedFilters = {
  fileType: "all",
  lifecycle: "all",
  riskLevel: "all",
  size: "all",
  modified: "all",
  duplicateOnly: false,
  reviewOnly: false
};

export const defaultLibrarySort: LibrarySort = {
  key: "modified_at",
  direction: "desc"
};

export type LibraryErrorKind = "permission" | "load";

export interface LibraryPageCollection {
  page: FileQueryResult;
  complete: boolean;
}

export function appendLibraryPage(current: FileQueryResult, next: FileQueryResult): FileQueryResult {
  return {
    ...next,
    files: [...current.files, ...next.files],
    offset: current.offset
  };
}

export function libraryPageHasMore(page: FileQueryResult): boolean {
  return page.offset + page.files.length < page.total;
}

/**
 * Walks the real paged API without changing the rendering model. The caller
 * can publish each accumulated page to keep virtualization and loading state
 * visible while the truthfulness scan is still in progress.
 */
export async function collectLibraryPages(
  firstPage: FileQueryResult,
  fetchPage: (offset: number) => Promise<FileQueryResult>,
  onPage?: (page: FileQueryResult) => void,
  isCurrentRequest: () => boolean = () => true
): Promise<LibraryPageCollection | null> {
  let page = firstPage;
  onPage?.(page);
  while (libraryPageHasMore(page)) {
    const next = await fetchPage(page.offset + page.files.length);
    if (!isCurrentRequest()) return null;
    if (!next.files.length) return { page, complete: false };
    page = appendLibraryPage(page, next);
    onPage?.(page);
  }
  return { page, complete: true };
}

export function classifyLibraryError(error: unknown): LibraryErrorKind {
  const message = error instanceof Error ? error.message : String(error);
  return /permission|access denied|拒绝访问|权限不足|无法访问/i.test(message) ? "permission" : "load";
}

export function filterLibraryFiles(
  files: FileRecord[],
  libraryFilter: LibraryFilter,
  filters: LibraryAdvancedFilters,
  now = Date.now()
): FileRecord[] {
  return files.filter((file) => {
    if (!matchesLibraryFilter(file, libraryFilter)) return false;
    if (filters.fileType !== "all" && file.file_type !== filters.fileType) return false;
    if (filters.lifecycle !== "all" && file.lifecycle !== filters.lifecycle) return false;
    if (filters.riskLevel !== "all" && file.risk_level !== filters.riskLevel) return false;
    if (filters.duplicateOnly && !file.is_duplicate) return false;
    if (filters.reviewOnly && !file.requires_confirmation) return false;
    if (!matchesSize(file.size, filters.size)) return false;
    if (!matchesModified(file.modified_at, filters.modified, now)) return false;
    return true;
  });
}

export function sortLibraryFiles(files: FileRecord[], sort: LibrarySort): FileRecord[] {
  const direction = sort.direction === "asc" ? 1 : -1;
  return files
    .map((file, index) => ({ file, index }))
    .sort((left, right) => {
      const result = compareFileValue(left.file, right.file, sort.key);
      return result === 0 ? left.index - right.index : result * direction;
    })
    .map(({ file }) => file);
}

export function selectionForRowClick(
  ids: string[],
  index: number,
  options: { additive?: boolean; range?: boolean; anchorIndex?: number; selectedIds?: string[] }
) {
  const id = ids[index];
  if (!id) return { selectedIds: [], focusedId: "", anchorIndex: -1 };
  if (options.range && options.anchorIndex !== undefined && options.anchorIndex >= 0) {
    const start = Math.min(options.anchorIndex, index);
    const end = Math.max(options.anchorIndex, index);
    return { selectedIds: ids.slice(start, end + 1), focusedId: id, anchorIndex: options.anchorIndex };
  }
  if (options.additive) {
    const currentSelection = options.selectedIds ?? [];
    const selectedIds = currentSelection.includes(id)
      ? currentSelection.filter((selectedId) => selectedId !== id)
      : [...currentSelection, id];
    return { selectedIds, focusedId: id, anchorIndex: index };
  }
  return { selectedIds: [id], focusedId: id, anchorIndex: index };
}

export function moveFocusIndex(currentIndex: number, count: number, key: "ArrowUp" | "ArrowDown" | "Home" | "End") {
  if (count <= 0) return -1;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowUp") return Math.max(0, currentIndex - 1);
  return Math.min(count - 1, currentIndex + 1);
}

export function selectionSummary(files: FileRecord[]) {
  const typeCounts = new Map<FileRecord["file_type"], number>();
  for (const file of files) typeCounts.set(file.file_type, (typeCounts.get(file.file_type) ?? 0) + 1);
  const directories = [...new Set(files.map((file) => file.directory).filter(Boolean))];
  return {
    count: files.length,
    totalSize: files.reduce((total, file) => total + file.size, 0),
    typeCounts: [...typeCounts.entries()],
    commonDirectory: directories.length === 1 ? directories[0] : null
  };
}

export type FilePreviewKind = "image" | "pdf" | "text" | "audio" | "video" | "archive" | "folder" | "unsupported";

export function filePreviewKind(file: FileRecord): FilePreviewKind {
  const extension = file.extension.toLowerCase().replace(/^\./, "");
  if (file.file_type === "Image" || ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(extension)) return "image";
  if (extension === "pdf") return "pdf";
  if (file.file_type === "Code" || ["txt", "md", "json", "ts", "tsx", "js", "jsx", "rs", "py", "css", "html"].includes(extension)) return "text";
  if (file.file_type === "Audio") return "audio";
  if (file.file_type === "Video") return "video";
  if (file.file_type === "ArchivePackage" || ["zip", "7z", "rar", "tar", "gz"].includes(extension)) return "archive";
  if (file.is_deleted || file.is_stale) return "unsupported";
  return "unsupported";
}

function matchesLibraryFilter(file: FileRecord, filter: LibraryFilter) {
  if (filter === "all") return true;
  if (filter === "active") return file.lifecycle === "Active";
  if (filter === "archive") return file.lifecycle === "Archive";
  if (filter === "review") return file.requires_confirmation;
  if (filter === "duplicate") return file.is_duplicate;
  return file.risk_level === "Sensitive" || file.lifecycle === "Sensitive";
}

function matchesSize(size: number, filter: SizeFilter) {
  if (filter === "all") return true;
  if (filter === "small") return size < 1024 ** 2;
  if (filter === "medium") return size >= 1024 ** 2 && size < 100 * 1024 ** 2;
  return size >= 100 * 1024 ** 2;
}

function matchesModified(value: string, filter: ModifiedFilter, now: number) {
  if (filter === "all") return true;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  const age = now - timestamp;
  if (filter === "7d") return age <= 7 * 24 * 60 * 60 * 1000;
  if (filter === "30d") return age <= 30 * 24 * 60 * 60 * 1000;
  return age > 30 * 24 * 60 * 60 * 1000;
}

function compareFileValue(left: FileRecord, right: FileRecord, key: LibrarySortKey) {
  if (key === "name") return left.name.localeCompare(right.name, undefined, { sensitivity: "base", numeric: true });
  if (key === "size" || key === "confidence") return numberValue(left[key]) - numberValue(right[key]);
  if (key === "last_opened_at") return dateValue(left.last_opened_at) - dateValue(right.last_opened_at);
  return dateValue(left.modified_at) - dateValue(right.modified_at);
}

function dateValue(value: string | null | undefined) {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberValue(value: number | string | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
