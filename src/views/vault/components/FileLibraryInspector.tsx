import { Archive, File, FileCode2, FileImage, FileText, Folder, Info, Music2, Package, Video, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import type { FileRecord } from "../../../types/domain";
import type { Language } from "../../../i18n";
import type { Translator } from "../../../types/ui";
import { formatBytes, formatDate } from "../../../utils/format";
import { compactPath, formatDisplayPath } from "../../../utils/viewHelpers";
import { buttonSecondary, cn, floatingSurface, glassButtonPrimary } from "../../../utils/tw";
import { filePreviewKind, selectionSummary } from "../fileLibraryModel";
import { purposeLabel, typeLabel } from "./FileLibraryList";

export function FileLibraryInspector({
  selectedIds,
  selectedFiles,
  language,
  t,
  onPreview,
  onReveal,
  onViewSuggestions,
  onClearSelection,
  classificationDetails
}: {
  selectedIds: string[];
  selectedFiles: FileRecord[];
  language: Language;
  t: Translator;
  onPreview: (file: FileRecord) => void;
  onReveal: (path: string) => void;
  onViewSuggestions: () => void;
  onClearSelection: () => void;
  classificationDetails?: ReactNode;
}) {
  return (
    <aside className="min-h-0 overflow-auto border-l border-[var(--zc-divider)] bg-[var(--zc-surface-subtle)] p-4" aria-labelledby="library-inspector-title">
      <h2 id="library-inspector-title" className="text-base font-semibold text-[var(--zc-text-primary)]">{t("libraryInspector")}</h2>
      <div className="mt-3">
        {selectedIds.length === 0 ? <EmptyInspector t={t} /> : null}
        {selectedIds.length > 1 ? (
          <MultiInspector files={selectedFiles} t={t} onReveal={onReveal} onViewSuggestions={onViewSuggestions} onClearSelection={onClearSelection} />
        ) : null}
        {selectedIds.length === 1 ? (
          selectedFiles[0] ? (
            <SingleInspector file={selectedFiles[0]} language={language} t={t} onPreview={onPreview} onReveal={onReveal} onViewSuggestions={onViewSuggestions} />
          ) : <MissingInspector t={t} />
        ) : null}
      </div>
      {selectedIds.length === 1 && selectedFiles[0] ? classificationDetails : null}
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
  onReveal
}: {
  file: FileRecord | null;
  language: Language;
  t: Translator;
  onClose: () => void;
  onReveal: (path: string) => void;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!file) return;
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "Tab") {
        const dialog = closeRef.current?.closest<HTMLElement>('[role="dialog"]');
        const focusable = dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [file, onClose]);

  if (!file) return null;
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/20 p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={cn(floatingSurface, "grid w-full max-w-xl gap-4 p-5")} role="dialog" aria-modal="true" aria-labelledby="library-preview-title">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[var(--zc-text-tertiary)]">{previewTitle(file, t)}</p>
            <h2 id="library-preview-title" className="mt-1 truncate text-lg font-semibold text-[var(--zc-text-primary)]" title={file.name}>{file.name}</h2>
          </div>
          <button ref={closeRef} type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--zc-radius-control)] text-[var(--zc-text-secondary)] hover:bg-[var(--zc-surface-hover)]" aria-label={t("libraryPreviewClose")} title={t("libraryPreviewClose")} onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <PreviewSurface file={file} t={t} />
        <div className="flex flex-wrap justify-end gap-2">
          <button className={buttonSecondary} onClick={() => onReveal(file.path)}>{libraryRevealLabel(t)}</button>
          <button className={glassButtonPrimary} onClick={onClose}>{t("libraryPreviewClose")}</button>
        </div>
        <p className="text-xs text-[var(--zc-text-tertiary)]">{formatDate(file.modified_at, language)} · {formatBytes(file.size)}</p>
      </section>
    </div>
  );
}

function EmptyInspector({ t }: { t: Translator }) {
  return (
    <div className="grid min-h-40 place-items-center gap-3 border-y border-[var(--zc-divider)] py-6 text-center">
      <Info size={22} className="text-[var(--zc-info-text)]" aria-hidden="true" />
      <p className="max-w-xs text-sm leading-6 text-[var(--zc-text-secondary)]">{t("libraryInspectorEmpty")}</p>
    </div>
  );
}

function MissingInspector({ t }: { t: Translator }) {
  return (
    <div className="grid min-h-40 place-items-center gap-3 border-y border-[var(--zc-divider)] py-6 text-center">
      <Info size={22} className="text-[var(--zc-warning-text)]" aria-hidden="true" />
      <p className="max-w-xs text-sm leading-6 text-[var(--zc-text-secondary)]">{t("libraryFileNotFound")}</p>
    </div>
  );
}

function MultiInspector({
  files,
  t,
  onReveal,
  onViewSuggestions,
  onClearSelection
}: {
  files: FileRecord[];
  t: Translator;
  onReveal: (path: string) => void;
  onViewSuggestions: () => void;
  onClearSelection: () => void;
}) {
  const summary = selectionSummary(files);
  return (
    <div className="grid gap-4">
      <div className="border-b border-[var(--zc-divider)] pb-3">
        <p className="text-lg font-semibold text-[var(--zc-text-primary)]">{t("librarySelectedCount").replace("{count}", String(summary.count))}</p>
        <p className="mt-1 text-sm text-[var(--zc-text-secondary)]">{t("librarySelectedTotalSize").replace("{size}", formatBytes(summary.totalSize))}</p>
      </div>
      <dl className="grid gap-3 text-sm">
        <div><dt className="text-xs font-semibold text-[var(--zc-text-tertiary)]">{t("librarySelectedTypes")}</dt><dd className="mt-1 text-[var(--zc-text-primary)]">{summary.typeCounts.map(([type, count]) => `${typeLabel({ file_type: type } as FileRecord, t)} ×${count}`).join(" · ")}</dd></div>
        {summary.commonDirectory ? <div><dt className="text-xs font-semibold text-[var(--zc-text-tertiary)]">{t("libraryCommonPath")}</dt><dd className="mt-1 truncate text-[var(--zc-text-primary)]" title={formatDisplayPath(summary.commonDirectory)}>{compactPath(summary.commonDirectory, 44)}</dd></div> : null}
      </dl>
      <div className="flex flex-wrap gap-2">
        {summary.commonDirectory ? <button className={buttonSecondary} onClick={() => onReveal(summary.commonDirectory!)}>{libraryRevealLabel(t)}</button> : null}
        <button className={buttonSecondary} onClick={onViewSuggestions}>{t("libraryViewSuggestions")}</button>
        <button className="text-sm font-medium text-[var(--zc-text-secondary)] underline-offset-2 hover:underline" onClick={onClearSelection}>{t("libraryClearSelection")}</button>
      </div>
      <p className="text-xs leading-5 text-[var(--zc-text-tertiary)]">{t("librarySelectionSafety")}</p>
    </div>
  );
}

function SingleInspector({
  file,
  language,
  t,
  onPreview,
  onReveal,
  onViewSuggestions
}: {
  file: FileRecord;
  language: Language;
  t: Translator;
  onPreview: (file: FileRecord) => void;
  onReveal: (path: string) => void;
  onViewSuggestions: () => void;
}) {
  const missing = file.is_deleted || file.is_stale;
  return (
    <div className="grid gap-4">
      <PreviewSurface file={file} t={t} />
      <div className="min-w-0 border-b border-[var(--zc-divider)] pb-3">
        <h3 className="break-words text-lg font-semibold text-[var(--zc-text-primary)]">{file.name}</h3>
        <p className="mt-1 text-sm text-[var(--zc-text-secondary)]">{typeLabel(file, t)} · {purposeLabel(file, t)}</p>
      </div>
      <dl className="grid gap-3 text-sm">
        <InspectorField label={t("libraryCurrentStatus")} value={missing ? t("libraryFileNotFound") : t("libraryReady")} tone={missing ? "warning" : "normal"} />
        <InspectorField label={t("libraryClassification")} value={actionLabel(file, t)} />
        <InspectorField label={t("lifecycle")} value={t(`libraryLifecycle${file.lifecycle}` as Parameters<Translator>[0])} />
        <InspectorField label={t("risk")} value={t(`libraryRisk${file.risk_level}` as Parameters<Translator>[0])} />
        {file.suggested_target_path ? <InspectorField label={t("librarySuggestedDestination")} value={compactPath(formatDisplayPath(file.suggested_target_path), 44)} /> : null}
        <InspectorField label={t("libraryClassificationReason")} value={file.classification_reason || t("unknown")} />
        <InspectorField label={t("confidence")} value={confidenceLabel(file.confidence, t)} />
        <InspectorField label={t("fileModified")} value={formatDate(file.modified_at, language)} />
        <InspectorField label={t("fileLocation")} value={compactPath(formatDisplayPath(file.path), 44)} title={formatDisplayPath(file.path)} />
      </dl>
      <div className="flex flex-wrap gap-2">
        {!missing ? <button className={buttonSecondary} onClick={() => onPreview(file)}>{t("libraryPreview")}</button> : null}
        <button className={buttonSecondary} onClick={() => onReveal(file.path)}>{libraryRevealLabel(t)}</button>
        <button className={glassButtonPrimary} onClick={onViewSuggestions}>{t("libraryViewSuggestions")}</button>
      </div>
    </div>
  );
}

function InspectorField({ label, value, title, tone = "normal" }: { label: string; value: string; title?: string; tone?: "normal" | "warning" }) {
  return <div className="min-w-0"><dt className="text-xs font-semibold text-[var(--zc-text-tertiary)]">{label}</dt><dd className={cn("mt-0.5 truncate text-sm", tone === "warning" ? "text-[var(--zc-warning-text)]" : "text-[var(--zc-text-primary)]")} title={title ?? value}>{value}</dd></div>;
}

function PreviewSurface({ file, t }: { file: FileRecord; t: Translator }) {
  const missing = file.is_deleted || file.is_stale;
  const kind = missing ? "unsupported" : filePreviewKind(file);
  const Icon = previewIcon(kind);
  return (
    <div className="grid min-h-36 place-items-center gap-2 border-y border-[var(--zc-divider)] bg-[var(--zc-surface)] px-4 py-5 text-center" data-library-preview-kind={kind}>
      <Icon size={30} className="text-[var(--zc-info-text)]" aria-hidden="true" />
      <strong className="text-sm text-[var(--zc-text-primary)]">{missing ? t("libraryFileNotFound") : previewTitle(file, t)}</strong>
      <span className="max-w-xs text-xs leading-5 text-[var(--zc-text-secondary)]">{missing ? t("libraryFileNotFound") : t("libraryPreviewUnavailable")}</span>
    </div>
  );
}

function previewIcon(kind: ReturnType<typeof filePreviewKind>) {
  if (kind === "image") return FileImage;
  if (kind === "pdf") return FileText;
  if (kind === "text") return FileCode2;
  if (kind === "audio") return Music2;
  if (kind === "video") return Video;
  if (kind === "archive") return Archive;
  if (kind === "folder") return Folder;
  if (kind === "unsupported") return Info;
  return Package;
}

function previewTitle(file: FileRecord, t: Translator) {
  const key = `libraryPreview${filePreviewKind(file).replace(/^./, (value) => value.toUpperCase())}` as Parameters<Translator>[0];
  return t(key);
}

function actionLabel(file: FileRecord, t: Translator) {
  const key = `libraryAction${file.suggested_action}` as Parameters<Translator>[0];
  return t(key);
}

function confidenceLabel(confidence: number, t: Translator) {
  if (confidence >= 0.8) return t("libraryConfidenceHigh");
  if (confidence >= 0.65) return t("libraryConfidenceMedium");
  return t("libraryConfidenceLow");
}
