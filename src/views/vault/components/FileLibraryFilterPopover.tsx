import type { FileRecord, LibraryFilter } from "../../../types/domain";
import type { Translator } from "../../../types/ui";
import { selectSurface, buttonSecondary, buttonGhost, cn } from "../../../utils/tw";
import type { LibraryAdvancedFilters, ModifiedFilter, SizeFilter } from "../fileLibraryModel";

export function FileLibraryFilterPopover({
  libraryFilter,
  filters,
  t,
  onLibraryFilterChange,
  onFiltersChange,
  onClear,
  onClose
}: {
  libraryFilter: LibraryFilter;
  filters: LibraryAdvancedFilters;
  t: Translator;
  onLibraryFilterChange: (value: LibraryFilter) => void;
  onFiltersChange: (value: Partial<LibraryAdvancedFilters>) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-[calc(100%+8px)] z-30 flex max-h-[min(70vh,560px)] w-[min(92vw,360px)] flex-col overflow-y-auto overscroll-contain rounded-[var(--zc-radius-floating)] border border-[var(--zc-border-strong)] bg-[var(--zc-surface-floating)] p-4 text-[var(--zc-text-primary)] shadow-[var(--zc-shadow-floating)] backdrop-blur-xl" role="dialog" aria-labelledby="library-filter-title" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="library-filter-title" className="text-sm font-semibold">{t("libraryFilterTitle")}</h2>
          <p className="mt-1 text-xs text-[var(--zc-text-secondary)]">{t("libraryScopeHint")}</p>
        </div>
        <button type="button" className={buttonGhost} onClick={onClear}>{t("libraryFilterClear")}</button>
      </div>
      <div className="mt-4 grid gap-3">
        <FilterSelect autoFocus label={t("libraryFilterAllOptions")} value={libraryFilter} onChange={(value) => onLibraryFilterChange(value as LibraryFilter)} options={libraryFilterOptions(t)} />
        <FilterSelect label={t("libraryFilterFileType")} value={filters.fileType} onChange={(value) => onFiltersChange({ fileType: value as LibraryAdvancedFilters["fileType"] })} options={fileTypeOptions(t)} />
        <FilterSelect label={t("libraryFilterLifecycle")} value={filters.lifecycle} onChange={(value) => onFiltersChange({ lifecycle: value as LibraryAdvancedFilters["lifecycle"] })} options={lifecycleOptions(t)} />
        <FilterSelect label={t("libraryFilterRisk")} value={filters.riskLevel} onChange={(value) => onFiltersChange({ riskLevel: value as LibraryAdvancedFilters["riskLevel"] })} options={riskOptions(t)} />
        <FilterSelect label={t("libraryFilterSize")} value={filters.size} onChange={(value) => onFiltersChange({ size: value as SizeFilter })} options={[
          ["all", t("libraryFilterAllOptions")],
          ["small", t("libraryFilterSmall")],
          ["medium", t("libraryFilterMedium")],
          ["large", t("libraryFilterLarge")]
        ]} />
        <FilterSelect label={t("libraryFilterModified")} value={filters.modified} onChange={(value) => onFiltersChange({ modified: value as ModifiedFilter })} options={[
          ["all", t("libraryFilterAllOptions")],
          ["7d", t("libraryFilterRecent7")],
          ["30d", t("libraryFilterRecent30")],
          ["older", t("libraryFilterOlder")]
        ]} />
        <label className="flex min-h-9 items-center gap-2 text-sm text-[var(--zc-text-secondary)]">
          <input type="checkbox" checked={filters.duplicateOnly} onChange={(event) => onFiltersChange({ duplicateOnly: event.target.checked })} />
          <span>{t("libraryFilterDuplicateOnly")}</span>
        </label>
        <label className="flex min-h-9 items-center gap-2 text-sm text-[var(--zc-text-secondary)]">
          <input type="checkbox" checked={filters.reviewOnly} onChange={(event) => onFiltersChange({ reviewOnly: event.target.checked })} />
          <span>{t("libraryFilterReviewOnly")}</span>
        </label>
        <p className="text-xs leading-5 text-[var(--zc-text-tertiary)]">{t("libraryNoTagFilter")}</p>
      </div>
      <div className="sticky bottom-0 mt-4 flex justify-end bg-[var(--zc-surface-floating)] pt-2">
        <button type="button" className={cn(buttonSecondary, "min-h-9 px-3 py-1.5 text-xs")} onClick={onClose}>{t("libraryFilterDone")}</button>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange, autoFocus = false }: { label: string; value: string; options: Array<readonly [string, string]>; onChange: (value: string) => void; autoFocus?: boolean }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-[var(--zc-text-tertiary)]">
      <span>{label}</span>
      <select autoFocus={autoFocus} className={cn(selectSurface, "min-h-9 py-1.5 text-sm")} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([option, optionLabel]) => <option value={option} key={option}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function libraryFilterOptions(t: Translator): Array<readonly [string, string]> {
  return [
    ["all", t("libraryFilterAllOptions")],
    ["active", t("libraryFilterActive")],
    ["archive", t("libraryFilterArchive")],
    ["review", t("libraryFilterReview")],
    ["duplicate", t("libraryFilterDuplicate")],
    ["sensitive", t("libraryFilterSensitive")]
  ];
}

function fileTypeOptions(t: Translator): Array<readonly [string, string]> {
  const values: Array<FileRecord["file_type"]> = ["Document", "Image", "Video", "Audio", "Code", "ArchivePackage", "Installer", "Spreadsheet", "Presentation", "Other"];
  return [["all", t("libraryFilterAllOptions")], ...values.map((value) => [`${value}`, t(`libraryType${value === "ArchivePackage" ? "Archive" : value}` as Parameters<Translator>[0])] as const)];
}

function lifecycleOptions(t: Translator): Array<readonly [string, string]> {
  const values: Array<FileRecord["lifecycle"]> = ["Inbox", "Active", "Reference", "Archive", "Disposable", "Duplicate", "Sensitive"];
  return [["all", t("libraryFilterAllOptions")], ...values.map((value) => [`${value}`, t(`libraryLifecycle${value}` as Parameters<Translator>[0])] as const)];
}

function riskOptions(t: Translator): Array<readonly [string, string]> {
  const values: Array<FileRecord["risk_level"]> = ["Normal", "Sensitive", "System", "Unknown"];
  return [["all", t("libraryFilterAllOptions")], ...values.map((value) => [`${value}`, t(`libraryRisk${value}` as Parameters<Translator>[0])] as const)];
}
