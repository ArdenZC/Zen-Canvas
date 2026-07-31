import { Info, TriangleAlert, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { tauriApi } from "../../../api/tauriApi";
import type { ContentScopePolicy, FileLibraryDetail, FileLibraryScopeV2, FileLibrarySelectionSummary, FileLibrarySummary, UserTag } from "../../../types/domain";
import type { Language } from "../../../i18n";
import type { Translator } from "../../../types/ui";
import { formatBytes, formatDate } from "../../../utils/format";
import { compactPath, formatDisplayPath } from "../../../utils/viewHelpers";
import { buttonSecondary, cn, floatingSurface, glassButtonPrimary } from "../../../utils/tw";
import { ModalPortal } from "../../../components/modal/ModalPortal";
import { FileTypeIcon } from "../../../components/FileTypeIcon";

export function FileLibraryInspector({
  selectedIds,
  selectedFiles,
  detail,
  selectionSummary,
  isLoading,
  language,
  t,
  onPreview,
  onReveal,
  onViewSuggestions,
  onClearSelection,
  availableTags = [],
  onToggleTag
}: {
  selectedIds: string[];
  selectedFiles: FileLibrarySummary[];
  detail: FileLibraryDetail | null;
  selectionSummary: FileLibrarySelectionSummary | null;
  isLoading: boolean;
  language: Language;
  t: Translator;
  onPreview: (file: FileLibraryDetail) => void;
  onReveal: (fileId: string) => void;
  onViewSuggestions: () => void;
  onClearSelection: () => void;
  availableTags?: UserTag[];
  onToggleTag?: (tagId: string, operation: "add" | "remove") => void;
}) {
  return (
    <aside className="min-h-0 overflow-auto border-l border-[var(--zc-divider)] bg-[var(--zc-surface-subtle)] p-4" aria-labelledby="library-inspector-title">
      <h2 id="library-inspector-title" className="text-base font-semibold text-[var(--zc-text-primary)]">{t("libraryInspector")}</h2>
      <div className="mt-3">
        {selectedIds.length === 0 ? <EmptyInspector t={t} /> : null}
        {selectedIds.length > 1 ? (
          <MultiInspector summary={selectionSummary} selectedCount={selectedIds.length} t={t} onViewSuggestions={onViewSuggestions} onClearSelection={onClearSelection} />
        ) : null}
        {selectedIds.length === 1 ? (
          isLoading ? <LoadingInspector t={t} /> : detail ? (
            <SingleInspector detail={detail} language={language} t={t} onPreview={onPreview} onReveal={onReveal} onViewSuggestions={onViewSuggestions} availableTags={availableTags} onToggleTag={onToggleTag} />
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
  onReveal
}: {
  file: FileLibraryDetail | null;
  language: Language;
  t: Translator;
  onClose: () => void;
  onReveal: (fileId: string) => void;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  if (!file) return null;
  return (
    <ModalPortal initialFocusRef={closeRef} onEscape={() => onCloseRef.current()}>
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

function SingleInspector({ detail, language, t, onPreview, onReveal, onViewSuggestions, availableTags, onToggleTag }: { detail: FileLibraryDetail; language: Language; t: Translator; onPreview: (file: FileLibraryDetail) => void; onReveal: (fileId: string) => void; onViewSuggestions: () => void; availableTags: UserTag[]; onToggleTag?: (tagId: string, operation: "add" | "remove") => void }) {
  const missing = detail.isStale;
  const [contentBusy, setContentBusy] = useState(false);
  const [contentMessage, setContentMessage] = useState<string | null>(null);
  const [contentPolicy, setContentPolicy] = useState<ContentScopePolicy | null>(null);
  const selectedTagIds = new Set(detail.tags.map((tag) => tag.id));
  const contentLabel = language === "zh" ? "内容理解" : "Content understanding";
  const contentStatus = detail.contentStatus ?? (language === "zh" ? "未分析" : "Not analyzed");
  const contentScope: FileLibraryScopeV2 | null = detail.scanRootId ? { kind: "roots", scanRootIds: [detail.scanRootId] } : null;
  useEffect(() => {
    let active = true;
    setContentPolicy(null);
    if (detail.scanRootId) {
      void tauriApi.getContentScopePolicy(detail.scanRootId)
        .then((policy) => { if (active) setContentPolicy(policy); })
        .catch(() => { if (active) setContentPolicy(null); });
    }
    return () => { active = false; };
  }, [detail.scanRootId]);
  async function contentRequest() {
    if (!contentScope || !detail.scanRootId) return null;
    const policy = contentPolicy ?? await tauriApi.getContentScopePolicy(detail.scanRootId);
    return {
      request: { version: 1 as const, requestId: crypto.randomUUID(), scope: contentScope, selectionFileIds: [detail.id], mode: "local" as const, expectedLibraryRevision: detail.revision, expectedPolicyRevisions: [{ rootId: detail.scanRootId, rootRevision: policy.rootRevision, policyRevision: policy.policyRevision }], providerMode: "none" as const },
      policy
    };
  }
  async function previewLocal() {
    if (!contentScope || !detail.scanRootId) return;
    setContentBusy(true); setContentMessage(null);
    try {
      const prepared = await contentRequest();
      if (!prepared) return;
      const preview = await tauriApi.previewContent(prepared.request);
      setContentMessage(language === "zh"
        ? `预览：可分析 ${preview.supportedCount} 个，不支持 ${preview.unsupportedCount} 个，阻断 ${preview.blockedCount} 个；预算 ${preview.byteBudget} 字节/${preview.charBudget} 字符。预览不会读取正文或启动任务。`
        : `Preview: ${preview.supportedCount} supported, ${preview.unsupportedCount} unsupported, ${preview.blockedCount} blocked; budget ${preview.byteBudget} bytes/${preview.charBudget} chars. No extraction or run was started.`);
    } catch (error) { setContentMessage(String(error)); }
    finally { setContentBusy(false); }
  }
  async function analyzeLocal() {
    if (!contentScope || !detail.scanRootId) return;
    setContentBusy(true); setContentMessage(null);
    try {
      const prepared = await contentRequest();
      if (!prepared) return;
      const preview = await tauriApi.previewContent(prepared.request);
      await tauriApi.startContentRun({ ...prepared.request, previewFingerprint: preview.previewFingerprint, confirmed: true });
      setContentMessage(language === "zh" ? "已完成本地内容分析；重新选择文件以刷新详情。" : "Local analysis completed; reselect the file to refresh.");
    } catch (error) { setContentMessage(String(error)); }
    finally { setContentBusy(false); }
  }
  async function rebuildContent() {
    if (!detail.contentRevision) return;
    setContentBusy(true); setContentMessage(null);
    try { await tauriApi.rebuildContentArtifact(detail.id, detail.contentRevision, true); setContentMessage(language === "zh" ? "内容产物已重建。" : "Content artifact rebuilt."); }
    catch (error) { setContentMessage(String(error)); }
    finally { setContentBusy(false); }
  }
  async function deleteContent() {
    if (!detail.contentRevision) return;
    setContentBusy(true); setContentMessage(null);
    try { await tauriApi.deleteContentArtifact(detail.id, detail.contentRevision, true); setContentMessage(language === "zh" ? "内容数据已删除，源文件未变更。" : "Content data deleted; the source file was not changed."); }
    catch (error) { setContentMessage(String(error)); }
    finally { setContentBusy(false); }
  }
  async function understandWithProvider() {
    if (!detail.contentRevision) return;
    setContentBusy(true); setContentMessage(null);
    try {
      const result = await tauriApi.understandContentArtifacts({
        version: 1,
        artifactIds: [`content-artifact-${detail.id}`],
        expectedRevisions: [detail.contentRevision],
        confirmed: true
      });
      setContentMessage(language === "zh"
        ? `Provider 理解完成：${result.processedCount} 个，阻断 ${result.blockedCount} 个。`
        : `Provider understanding: ${result.processedCount} processed, ${result.blockedCount} blocked.`);
    } catch (error) { setContentMessage(String(error)); }
    finally { setContentBusy(false); }
  }
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
        <h3 id="content-understanding-title" className="text-xs font-semibold text-[var(--zc-text-tertiary)]">{contentLabel}</h3>
        <InspectorField label={language === "zh" ? "状态" : "Status"} value={contentStatus} />
        <InspectorField label={language === "zh" ? "策略" : "Policy"} value={detail.contentPolicy ?? (contentPolicy ? (contentPolicy.enabled ? (language === "zh" ? "已启用" : "Enabled") : (language === "zh" ? "已关闭" : "Disabled")) : (language === "zh" ? "按根目录配置" : "Per-root policy"))} />
        {detail.contentSummary ? <InspectorField label={language === "zh" ? "摘要" : "Summary"} value={detail.contentSummary} /> : null}
        {detail.contentKeywords?.length ? <InspectorField label={language === "zh" ? "关键词" : "Keywords"} value={detail.contentKeywords.join(", ")} /> : null}
        {detail.contentLanguage ? <InspectorField label={language === "zh" ? "语言" : "Language"} value={detail.contentLanguage} /> : null}
        {detail.contentProvenance ? <InspectorField label={language === "zh" ? "来源" : "Provenance"} value={detail.contentProvenance} /> : null}
        {detail.contentRevision ? <InspectorField label={language === "zh" ? "截断/保留" : "Truncated / retained"} value={`${detail.contentTruncated ? "yes" : "no"} / ${detail.contentTextRetained ? "yes" : "no"}`} /> : null}
        <p className="text-xs leading-5 text-[var(--zc-text-tertiary)]">
          {language === "zh" ? "内容分析默认关闭；本地提取会读取所选正文。云端理解仅在每次确认后发送有界文本，不发送路径或文件名。保留正文仅按根目录策略有界保留（默认不保留，最多 7 天/4 MiB）。删除内容数据不会删除源文件。" : "Content analysis is off by default. Local extraction reads the selected file; cloud understanding sends bounded text only after confirmation and never sends paths or filenames. Retained text is per-root, bounded (none by default, at most 7 days/4 MiB). Deleting content data never deletes the source file."}
        </p>
        <div className="flex flex-wrap gap-2">
          {!missing && contentScope ? <button type="button" className={buttonSecondary} disabled={contentBusy} onClick={() => void previewLocal()}>{language === "zh" ? "预览内容分析" : "Preview content"}</button> : null}
          {!missing && contentScope ? <button type="button" className={buttonSecondary} disabled={contentBusy} onClick={() => void analyzeLocal()}>{language === "zh" ? "本地分析" : "Analyze local"}</button> : null}
          {detail.contentRevision ? <button type="button" className={buttonSecondary} disabled={contentBusy} onClick={() => void understandWithProvider()}>{language === "zh" ? "Provider 理解" : "Understand with provider"}</button> : null}
          {detail.contentRevision ? <button type="button" className={buttonSecondary} disabled={contentBusy} onClick={() => void rebuildContent()}>{language === "zh" ? "重建内容" : "Rebuild"}</button> : null}
          {detail.contentRevision ? <button type="button" className="text-xs text-[var(--zc-danger-text)] underline-offset-2 hover:underline" disabled={contentBusy} onClick={() => void deleteContent()}>{language === "zh" ? "删除内容数据" : "Delete content data"}</button> : null}
        </div>
        {contentMessage ? <p className="text-xs text-[var(--zc-text-secondary)]" aria-live="polite">{contentMessage}</p> : null}
      </section>
      {availableTags.length ? <section className="grid gap-2 border-t border-[var(--zc-divider)] pt-3"><h3 className="text-xs font-semibold text-[var(--zc-text-tertiary)]">Tags</h3><div className="flex flex-wrap gap-1.5">{availableTags.map((tag) => { const active = selectedTagIds.has(tag.id); return <button key={tag.id} type="button" className={cn("rounded-full border px-2 py-1 text-xs", active ? "border-[var(--zc-primary)] bg-[var(--zc-surface-selected)] text-[var(--zc-text-primary)]" : "border-[var(--zc-divider)] text-[var(--zc-text-secondary)]")} onClick={() => onToggleTag?.(tag.id, active ? "remove" : "add")} aria-pressed={active}>{tag.displayName}</button>; })}</div></section> : null}
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
