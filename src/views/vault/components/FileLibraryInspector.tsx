import { Info, TriangleAlert, X } from "lucide-react";
import { useRef } from "react";
import type { FileLibraryDetail, FileLibrarySelectionSummary, FileLibrarySummary, UserTag } from "../../../types/domain";
import type { Language } from "../../../i18n";
import type { Translator } from "../../../types/ui";
import { formatBytes, formatDate } from "../../../utils/format";
import { compactPath, formatDisplayPath } from "../../../utils/viewHelpers";
import { buttonSecondary, cn, floatingSurface, glassButtonPrimary } from "../../../utils/tw";
import { ModalPortal } from "../../../components/modal/ModalPortal";
import { FileTypeIcon } from "../../../components/FileTypeIcon";
import { contentPolicyLabel, contentStatusLabel } from "./ContentUnderstandingSheet";

export function FileLibraryInspector({
  selectedIds,
  selectedFiles,
  detail,
  selectionSummary,
  isLoading,
  error,
  language,
  t,
  onPreview,
  onReveal,
  onViewSuggestions,
  onOpenContentUnderstanding,
  onClearSelection,
  onRetryDetail,
  availableTags = [],
  onToggleTag
}: {
  selectedIds: string[];
  selectedFiles: FileLibrarySummary[];
  detail: FileLibraryDetail | null;
  selectionSummary: FileLibrarySelectionSummary | null;
  isLoading: boolean;
  error: string | null;
  language: Language;
  t: Translator;
  onPreview: (file: FileLibraryDetail) => void;
  onReveal: (fileId: string) => void;
  onViewSuggestions: () => void;
  onOpenContentUnderstanding: (file: FileLibraryDetail, trigger: HTMLElement) => void;
  onClearSelection: () => void;
  onRetryDetail: () => void;
  availableTags?: UserTag[];
  onToggleTag?: (tagId: string, operation: "add" | "remove") => void;
}) {
  void selectedFiles;
  return (
    <aside className="min-h-0 overflow-auto border-l border-[var(--zc-divider)] bg-[var(--zc-surface-subtle)] p-4" aria-labelledby="library-inspector-title">
      <h2 id="library-inspector-title" className="text-base font-semibold text-[var(--zc-text-primary)]">{t("libraryInspector")}</h2>
      <div className="mt-3">
        {selectedIds.length === 0 ? <EmptyInspector t={t} /> : null}
        {selectedIds.length > 1 ? (
          <MultiInspector summary={selectionSummary} selectedCount={selectedIds.length} t={t} onViewSuggestions={onViewSuggestions} onClearSelection={onClearSelection} />
        ) : null}
        {selectedIds.length === 1 ? (
          isLoading ? <LoadingInspector t={t} /> : error ? <DetailErrorInspector error={error} t={t} onRetry={onRetryDetail} /> : detail ? (
            <SingleInspector detail={detail} language={language} t={t} onPreview={onPreview} onReveal={onReveal} onViewSuggestions={onViewSuggestions} onOpenContentUnderstanding={onOpenContentUnderstanding} availableTags={availableTags} onToggleTag={onToggleTag} />
          ) : <MissingInspector t={t} />
        ) : null}
      </div>
    </aside>
  );
}

export function libraryRevealLabel(t: Translator) {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
    ? t("libraryRevealInFinder")
    : t("libraryRevealFile");
}

export function FileLibraryPreviewDialog({
  file,
  language,
  t,
  onClose,
  onReveal,
  restoreFocus
}: {
  file: FileLibraryDetail | null;
  language: Language;
  t: Translator;
  onClose: () => void;
  onReveal: (fileId: string) => void;
  restoreFocus?: () => HTMLElement | null;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  if (!file) return null;
  return (
    <ModalPortal initialFocusRef={closeRef} restoreFocus={restoreFocus} onEscape={() => onCloseRef.current()}>
      <div className="fixed inset-0 z-40 grid place-items-center bg-black/20 p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCloseRef.current(); }}>
        <section className={cn(floatingSurface, "grid w-full max-w-xl gap-4 p-5")} role="dialog" aria-modal="true" aria-labelledby="library-preview-title">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--zc-text-tertiary)]">{previewTitle(file, t)}</p>
              <h2 id="library-preview-title" className="mt-1 truncate text-lg font-semibold text-[var(--zc-text-primary)]" title={file.name}>{file.name}</h2>
            </div>
            <button ref={closeRef} type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--zc-radius-control)] text-[var(--zc-text-secondary)] hover:bg-[var(--zc-surface-hover)]" aria-label={t("libraryPreviewClose")} title={t("libraryPreviewClose")} onClick={onCloseRef.current}>
              <X size={17} />
            </button>
          </div>
          <PreviewSurface file={file} t={t} />
          <div className="flex flex-wrap justify-end gap-2">
            <button className={buttonSecondary} onClick={() => onReveal(file.id)}>{libraryRevealLabel(t)}</button>
            <button className={glassButtonPrimary} onClick={onClose}>{t("libraryPreviewClose")}</button>
          </div>
          <p className="text-xs text-[var(--zc-text-tertiary)]">{formatDate(String(file.modifiedAt), language)} · {formatBytes(file.size)}</p>
        </section>
      </div>
    </ModalPortal>
  );
}

function EmptyInspector({ t }: { t: Translator }) {
  return <div className="grid min-h-40 place-items-center gap-3 border-y border-[var(--zc-divider)] py-6 text-center"><Info size={22} className="text-[var(--zc-info-text)]" aria-hidden="true" /><p className="max-w-xs text-sm leading-6 text-[var(--zc-text-secondary)]">{t("libraryInspectorEmpty")}</p></div>;
}

function LoadingInspector({ t }: { t: Translator }) {
  return <div className="grid min-h-40 place-items-center gap-3 border-y border-[var(--zc-divider)] py-6 text-center"><Info size={22} className="text-[var(--zc-info-text)]" aria-hidden="true" /><p className="max-w-xs text-sm leading-6 text-[var(--zc-text-secondary)]">{t("libraryLoadingResults")}</p></div>;
}

function MissingInspector({ t }: { t: Translator }) {
  return <div className="grid min-h-40 place-items-center gap-3 border-y border-[var(--zc-divider)] py-6 text-center"><Info size={22} className="text-[var(--zc-warning-text)]" aria-hidden="true" /><p className="max-w-xs text-sm leading-6 text-[var(--zc-text-secondary)]">{t("libraryFileNotFound")}</p></div>;
}

function DetailErrorInspector({ error, t, onRetry }: { error: string; t: Translator; onRetry: () => void }) {
  void error;
  return <div className="grid min-h-40 place-items-center gap-3 border-y border-[var(--zc-divider)] py-6 text-center"><TriangleAlert size={22} className="text-[var(--zc-danger-text)]" aria-hidden="true" /><div className="grid gap-1"><p className="text-sm font-semibold text-[var(--zc-text-primary)]">{t("libraryDetailLoadFailedTitle")}</p><p className="max-w-xs text-sm leading-6 text-[var(--zc-text-secondary)]">{t("libraryDetailLoadFailedDesc")}</p></div><button type="button" className={buttonSecondary} onClick={onRetry}>{t("libraryDetailRetry")}</button></div>;
}

function MultiInspector({ summary, selectedCount, t, onViewSuggestions, onClearSelection }: { summary: FileLibrarySelectionSummary | null; selectedCount: number; t: Translator; onViewSuggestions: () => void; onClearSelection: () => void }) {
  return (
    <div className="grid gap-4">
      <div className="border-b border-[var(--zc-divider)] pb-3">
        <p className="text-lg font-semibold text-[var(--zc-text-primary)]">{t("librarySelectedCount").replace("{count}", String(summary?.count ?? selectedCount))}</p>
        <p className="mt-1 text-sm text-[var(--zc-text-secondary)]">{t("librarySelectedTotalSize").replace("{size}", formatBytes(summary?.totalSize ?? 0))}</p>
      </div>
      <dl className="grid gap-3 text-sm">
        {summary?.typeCounts.length ? <div><dt className="text-xs font-semibold text-[var(--zc-text-tertiary)]">{t("librarySelectedTypes")}</dt><dd className="mt-1 text-[var(--zc-text-primary)]">{summary.typeCounts.map((item) => `${item.fileType} ×${item.count}`).join(" · ")}</dd></div> : null}
        {summary?.excludedCount ? <div><dt className="text-xs font-semibold text-[var(--zc-text-tertiary)]">{t("librarySelectedLoadedCount")}</dt><dd className="mt-1 text-[var(--zc-warning-text)]">{summary.excludedCount}</dd></div> : null}
      </dl>
      <div className="flex flex-wrap gap-2">
        <button className={buttonSecondary} onClick={onViewSuggestions}>{t("libraryViewSuggestions")}</button>
        <button className="text-sm font-medium text-[var(--zc-text-secondary)] underline-offset-2 hover:underline" onClick={onClearSelection}>{t("libraryClearSelection")}</button>
      </div>
      <p className="text-xs leading-5 text-[var(--zc-text-tertiary)]">{t("librarySelectionSafety")}</p>
    </div>
  );
}

function SingleInspector({ detail, language, t, onPreview, onReveal, onViewSuggestions, onOpenContentUnderstanding, availableTags, onToggleTag }: { detail: FileLibraryDetail; language: Language; t: Translator; onPreview: (file: FileLibraryDetail) => void; onReveal: (fileId: string) => void; onViewSuggestions: () => void; onOpenContentUnderstanding: (file: FileLibraryDetail, trigger: HTMLElement) => void; availableTags: UserTag[]; onToggleTag?: (tagId: string, operation: "add" | "remove") => void }) {
  const missing = detail.isStale;
  const selectedTagIds = new Set(detail.tags.map((tag) => tag.id));
  return (
    <div className="grid gap-4">
      <PreviewSurface file={detail} t={t} />
      <div className="min-w-0 border-b border-[var(--zc-divider)] pb-3"><h3 className="break-words text-lg font-semibold text-[var(--zc-text-primary)]">{detail.name}</h3><p className="mt-1 text-sm text-[var(--zc-text-secondary)]">{detail.fileType} · {detail.purpose}</p></div>
      <dl className="grid gap-3 text-sm">
        <InspectorField label={t("libraryCurrentStatus")} value={missing ? t("libraryFileNotFound") : t("libraryReady")} tone={missing ? "warning" : "normal"} />
        <InspectorField label={t("libraryClassification")} value={detail.suggestedAction || t("unknown")} />
        <InspectorField label={t("lifecycle")} value={detail.lifecycle} />
        <InspectorField label={t("risk")} value={detail.risk} />
        <InspectorField label={t("libraryClassificationReason")} value={detail.classificationReason || t("unknown")} />
        <InspectorField label={t("confidence")} value={confidenceLabel(detail.confidence, t)} />
        <InspectorField label={t("fileModified")} value={formatDate(String(detail.modifiedAt), language)} />
        <InspectorField label={t("fileLocation")} value={compactPath(formatDisplayPath(detail.path), 44)} title={formatDisplayPath(detail.path)} />
      </dl>
      <section className="grid gap-2 border-t border-[var(--zc-divider)] pt-3" aria-labelledby="content-understanding-title">
        <div><h3 id="content-understanding-title" className="text-sm font-semibold text-[var(--zc-text-primary)]">{t("contentUnderstandingTitle")}</h3><p className="mt-1 text-xs leading-5 text-[var(--zc-text-secondary)]">{t("contentSourceUnchanged")}</p></div>
        <InspectorField label={t("contentStatus")} value={contentStatusLabel(detail.contentStatus, t)} />
        <InspectorField label={t("contentPolicy")} value={detail.contentPolicy ? contentPolicyLabel(detail.contentPolicy, t) : t("contentPolicyPerRoot")} />
        <button type="button" className={buttonSecondary} onClick={(event) => onOpenContentUnderstanding(detail, event.currentTarget)}>{t("contentOpen")}</button>
      </section>
      {availableTags.length ? <section className="grid gap-2 border-t border-[var(--zc-divider)] pt-3"><h3 className="text-xs font-semibold text-[var(--zc-text-tertiary)]">{t("libraryTags")}</h3><div className="flex flex-wrap gap-1.5">{availableTags.map((tag) => { const active = selectedTagIds.has(tag.id); return <button key={tag.id} type="button" className={cn("rounded-full border px-2 py-1 text-xs", active ? "border-[var(--zc-primary)] bg-[var(--zc-surface-selected)] text-[var(--zc-text-primary)]" : "border-[var(--zc-divider)] text-[var(--zc-text-secondary)]")} onClick={() => onToggleTag?.(tag.id, active ? "remove" : "add")} aria-pressed={active}>{tag.displayName}</button>; })}</div></section> : null}
      <div className="flex flex-wrap gap-2">{!missing ? <button className={buttonSecondary} onClick={() => onPreview(detail)}>{t("libraryPreview")}</button> : null}<button className={buttonSecondary} onClick={() => onReveal(detail.id)}>{libraryRevealLabel(t)}</button><button className={glassButtonPrimary} onClick={onViewSuggestions}>{t("libraryViewSuggestions")}</button></div>
    </div>
  );
}

function InspectorField({ label, value, title, tone = "normal" }: { label: string; value: string; title?: string; tone?: "normal" | "warning" }) {
  return <div className="min-w-0"><dt className="text-xs font-semibold text-[var(--zc-text-tertiary)]">{label}</dt><dd className={cn("mt-0.5 truncate text-sm", tone === "warning" ? "text-[var(--zc-warning-text)]" : "text-[var(--zc-text-primary)]")} title={title ?? value}>{value}</dd></div>;
}

function PreviewSurface({ file, t }: { file: FileLibraryDetail; t: Translator }) {
  const missing = file.isStale;
  return <div className="grid min-h-36 place-items-center gap-2 border-y border-[var(--zc-divider)] bg-[var(--zc-surface)] px-4 py-5 text-center" data-library-preview-kind={file.extension.toLowerCase() === "pdf" ? "pdf" : "metadata"}>{missing ? <TriangleAlert size={30} className="text-[var(--zc-warning-text)]" aria-hidden="true" /> : <FileTypeIcon file={{ file_type: file.fileType as never, extension: file.extension }} size={30} className="text-[var(--zc-info-text)]" />}<strong className="text-sm text-[var(--zc-text-primary)]">{missing ? t("libraryFileUnavailableTitle") : previewTitle(file, t)}</strong><span className="max-w-xs text-xs leading-5 text-[var(--zc-text-secondary)]">{missing ? t("libraryFileUnavailableDesc") : t("libraryPreviewUnavailable")}</span></div>;
}

function previewTitle(file: FileLibraryDetail, t: Translator) {
  if (file.extension.toLowerCase() === "pdf") return t("libraryPreviewPdfFile");
  return t("libraryPreviewUnavailable");
}

function confidenceLabel(confidence: number, t: Translator) {
  if (confidence >= 0.8) return t("libraryConfidenceHigh");
  if (confidence >= 0.65) return t("libraryConfidenceMedium");
  return t("libraryConfidenceLow");
}
