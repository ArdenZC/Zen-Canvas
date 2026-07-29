import type { FileQueryFiltersV2, FileType, Lifecycle, RiskLevel, UserTag } from "../../../types/domain";
import type { Translator } from "../../../types/ui";
import { selectSurface, buttonSecondary, buttonGhost, cn } from "../../../utils/tw";

export function FileLibraryFilterPopover({
  filters,
  tags,
  t,
  onFiltersChange,
  onClear,
  onClose
}: {
  filters: FileQueryFiltersV2;
  tags: UserTag[];
  t: Translator;
  onFiltersChange: (value: Partial<FileQueryFiltersV2>) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-[calc(100%+8px)] z-30 flex max-h-[min(70vh,560px)] w-[min(92vw,380px)] flex-col overflow-y-auto overscroll-contain rounded-[var(--zc-radius-floating)] border border-[var(--zc-border-strong)] bg-[var(--zc-surface-floating)] p-4 text-[var(--zc-text-primary)] shadow-[var(--zc-shadow-floating)] backdrop-blur-xl" role="dialog" aria-labelledby="library-filter-title" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } }}>
      <div className="flex items-start justify-between gap-3"><div><h2 id="library-filter-title" className="text-sm font-semibold">{t("libraryFilterTitle")}</h2><p className="mt-1 text-xs text-[var(--zc-text-secondary)]">{t("libraryScopeHint")}</p></div><button type="button" className={buttonGhost} onClick={onClear}>{t("libraryFilterClear")}</button></div>
      <div className="mt-4 grid gap-3">
        <FilterSelect autoFocus label={t("libraryFilterFileType")} value={filters.fileTypes[0] ?? "all"} onChange={(value) => onFiltersChange({ fileTypes: value === "all" ? [] : [value as FileType] })} options={fileTypeOptions(t)} />
        <FilterSelect label={t("libraryFilterLifecycle")} value={filters.lifecycles[0] ?? "all"} onChange={(value) => onFiltersChange({ lifecycles: value === "all" ? [] : [value as Lifecycle] })} options={lifecycleOptions(t)} />
        <FilterSelect label={t("libraryFilterRisk")} value={filters.risks[0] ?? "all"} onChange={(value) => onFiltersChange({ risks: value === "all" ? [] : [value as RiskLevel] })} options={riskOptions(t)} />
        <FilterSelect label={t("libraryFilterDuplicate")} value={filters.duplicate} onChange={(value) => onFiltersChange({ duplicate: value as FileQueryFiltersV2["duplicate"] })} options={matchModeOptions(t, "duplicate")} />
        <FilterSelect label={t("libraryFilterReview")} value={filters.review} onChange={(value) => onFiltersChange({ review: value as FileQueryFiltersV2["review"] })} options={matchModeOptions(t, "review")} />
        <TagSelect label="All tags" value={filters.tagsAllOf} tags={tags} onChange={(value) => onFiltersChange({ tagsAllOf: value })} />
        <TagSelect label="Any tags" value={filters.tagsAnyOf} tags={tags} onChange={(value) => onFiltersChange({ tagsAnyOf: value })} />
        <TagSelect label="Exclude tags" value={filters.tagsNoneOf} tags={tags} onChange={(value) => onFiltersChange({ tagsNoneOf: value })} />
      </div>
      <div className="sticky bottom-0 mt-4 flex justify-end bg-[var(--zc-surface-floating)] pt-2"><button type="button" className={cn(buttonSecondary, "min-h-9 px-3 py-1.5 text-xs")} onClick={onClose}>{t("libraryFilterDone")}</button></div>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange, autoFocus = false }: { label: string; value: string; options: Array<readonly [string, string]>; onChange: (value: string) => void; autoFocus?: boolean }) {
  return <label className="grid gap-1 text-xs font-semibold text-[var(--zc-text-tertiary)]"><span>{label}</span><select autoFocus={autoFocus} className={cn(selectSurface, "min-h-9 py-1.5 text-sm")} value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([option, optionLabel]) => <option value={option} key={option}>{optionLabel}</option>)}</select></label>;
}

function TagSelect({ label, value, tags, onChange }: { label: string; value: string[]; tags: UserTag[]; onChange: (value: string[]) => void }) {
  return <label className="grid gap-1 text-xs font-semibold text-[var(--zc-text-tertiary)]"><span>{label}</span><select multiple className={cn(selectSurface, "min-h-20 py-1.5 text-sm")} value={value} onChange={(event) => onChange([...event.currentTarget.selectedOptions].map((option) => option.value))}>{tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.displayName}</option>)}</select></label>;
}

function fileTypeOptions(t: Translator): Array<readonly [string, string]> {
  const values: FileType[] = ["Document", "Image", "Video", "Audio", "Code", "ArchivePackage", "Installer", "Spreadsheet", "Presentation", "Other"];
  return [["all", t("libraryFilterAllOptions")], ...values.map((value) => [`${value}`, t(`libraryType${value === "ArchivePackage" ? "Archive" : value}` as Parameters<Translator>[0])] as const)];
}

function lifecycleOptions(t: Translator): Array<readonly [string, string]> {
  const values: Lifecycle[] = ["Inbox", "Active", "Reference", "Archive", "Disposable", "Duplicate", "Sensitive", "TrashReview", "Unknown"];
  return [["all", t("libraryFilterAllOptions")], ...values.map((value) => [`${value}`, t(`libraryLifecycle${value}` as Parameters<Translator>[0])] as const)];
}

function riskOptions(t: Translator): Array<readonly [string, string]> {
  const values: RiskLevel[] = ["Normal", "Sensitive", "System", "Caution", "Unknown"];
  return [["all", t("libraryFilterAllOptions")], ...values.map((value) => [`${value}`, t(`libraryRisk${value}` as Parameters<Translator>[0])] as const)];
}

function matchModeOptions(t: Translator, kind: "duplicate" | "review"): Array<readonly [string, string]> {
  return [["any", t(kind === "duplicate" ? "libraryFilterDuplicate" : "libraryFilterReview")], ["only", kind === "duplicate" ? t("libraryFilterDuplicateOnly") : t("libraryFilterReviewOnly")], ["exclude", `${t(kind === "duplicate" ? "libraryFilterDuplicate" : "libraryFilterReview")} · exclude`]];
}
