import { Info, TriangleAlert, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { tauriApi } from "../../../api/tauriApi";
import type { ContentPreview, ContentPreviewRequest, ContentRun, ContentRunItem, ContentScopePolicy, FileLibraryDetail, FileLibraryScopeV2, FileLibrarySelectionSummary, FileLibrarySummary, UserTag } from "../../../types/domain";
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
  const [contentPreview, setContentPreview] = useState<ContentPreview | null>(null);
  const [pendingContentRequest, setPendingContentRequest] = useState<ContentPreviewRequest | null>(null);
  const [contentRun, setContentRun] = useState<ContentRun | null>(null);
  const [contentRunItems, setContentRunItems] = useState<ContentRunItem[]>([]);
  const [recentContentRuns, setRecentContentRuns] = useState<ContentRun[]>([]);
  const [contentConfirmation, setContentConfirmation] = useState<{ message: string; action: () => Promise<void> } | null>(null);
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
  useEffect(() => {
    let active = true;
    if (!detail.scanRootId) return () => { active = false; };
    void tauriApi.listContentRuns(10)
      .then((runs) => { if (active) setRecentContentRuns(runs); })
      .catch(() => { if (active) setRecentContentRuns([]); });
    return () => { active = false; };
  }, [detail.scanRootId]);
  useEffect(() => {
    if (!contentRun) return;
    let active = true;
    const refresh = async () => {
      try {
        const [run, page] = await Promise.all([
          tauriApi.getContentRun(contentRun.id),
          tauriApi.queryContentRunItems(contentRun.id, 100)
        ]);
        if (active) {
          setContentRun(run);
          setContentRunItems(page.items);
        }
      } catch (error) {
        if (active) setContentMessage(String(error));
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, [contentRun?.id]);
  async function contentRequest(mode: ContentPreviewRequest["mode"] = "local", providerMode: ContentPreviewRequest["providerMode"] = "none") {
    if (!contentScope || !detail.scanRootId) return null;
    const policy = contentPolicy ?? await tauriApi.getContentScopePolicy(detail.scanRootId);
    return {
      request: { version: 1 as const, requestId: crypto.randomUUID(), scope: contentScope, selectionFileIds: [detail.id], mode, expectedLibraryRevision: detail.revision, expectedPolicyRevisions: [{ rootId: detail.scanRootId, rootRevision: policy.rootRevision, policyRevision: policy.policyRevision }], providerMode },
      policy
    };
  }
  async function previewContentRun(mode: ContentPreviewRequest["mode"] = "local", providerMode: ContentPreviewRequest["providerMode"] = "none") {
    if (!contentScope || !detail.scanRootId) return;
    setContentBusy(true); setContentMessage(null);
    try {
      const prepared = await contentRequest(mode, providerMode);
      if (!prepared) return;
      const preview = await tauriApi.previewContent(prepared.request);
      setContentPreview(preview);
      setPendingContentRequest(prepared.request);
      setContentMessage(language === "zh" ? "预览已生成，请在审核对话框中单独确认后启动任务。" : "Preview ready. Review it and confirm separately before starting the run.");
    } catch (error) { setContentMessage(String(error)); }
    finally { setContentBusy(false); }
  }
  async function confirmContentRun() {
    if (!contentPreview || !pendingContentRequest) return;
    setContentBusy(true); setContentMessage(null);
    try {
      const run = await tauriApi.startContentRun({ ...pendingContentRequest, previewFingerprint: contentPreview.previewFingerprint, confirmed: true });
      setContentRun(run);
      setContentPreview(null);
      setPendingContentRequest(null);
      setContentMessage(language === "zh" ? `任务已启动：${run.status}（${run.completedCount}/${run.requestedCount}）` : `Run started: ${run.status} (${run.completedCount}/${run.requestedCount}).`);
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
    await previewContentRun("understand", "existing_interactive_provider");
  }
  async function saveContentPolicy() {
    if (!contentPolicy || !detail.scanRootId) return;
    setContentBusy(true); setContentMessage(null);
    try {
      const saved = await tauriApi.setContentScopePolicy({
        version: 1,
        rootId: detail.scanRootId,
        expectedRootRevision: contentPolicy.rootRevision,
        expectedPolicyRevision: contentPolicy.policyRevision,
        confirmed: true,
        policy: contentPolicy
      });
      setContentPolicy(saved);
      setContentMessage(language === "zh" ? "根目录策略已保存。" : "Per-root policy saved.");
    } catch (error) { setContentMessage(String(error)); }
    finally { setContentBusy(false); }
  }
  async function cancelContentRun() {
    if (!contentRun) return;
    setContentBusy(true);
    try {
      const run = await tauriApi.cancelContentRun(contentRun.id, contentRun.revision, true);
      setContentRun(run);
    } catch (error) { setContentMessage(String(error)); }
    finally { setContentBusy(false); }
  }
  async function purgeContent() {
    if (!contentScope || !contentPolicy) return;
    setContentBusy(true); setContentMessage(null);
    try {
      const deleted = await tauriApi.purgeContentScope({
        version: 1,
        scope: contentScope,
        expectedLibraryRevision: detail.revision,
        expectedPolicyRevisions: [{ rootId: contentPolicy.rootId, rootRevision: contentPolicy.rootRevision, policyRevision: contentPolicy.policyRevision }],
        confirmed: true
      });
      setContentMessage(language === "zh" ? `已清空 ${deleted} 个内容产物；源文件未变更。` : `Purged ${deleted} content artifacts; source files were not changed.`);
    } catch (error) { setContentMessage(String(error)); }
    finally { setContentBusy(false); }
  }
  function requestContentConfirmation(message: string, action: () => Promise<void>) {
    setContentConfirmation({ message, action });
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
        {contentPolicy ? <fieldset className="grid gap-2 rounded border border-[var(--zc-divider)] p-2 text-xs">
          <legend className="px-1 font-semibold text-[var(--zc-text-tertiary)]">{language === "zh" ? "根目录授权" : "Per-root authorization"}</legend>
          <label className="flex items-center gap-2"><input type="checkbox" checked={contentPolicy.enabled} onChange={(event) => setContentPolicy({ ...contentPolicy, enabled: event.target.checked })} />{language === "zh" ? "启用内容分析" : "Enable content analysis"}</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={contentPolicy.localAllowed} onChange={(event) => setContentPolicy({ ...contentPolicy, localAllowed: event.target.checked })} />{language === "zh" ? "允许本地提取" : "Allow local extraction"}</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={contentPolicy.cloudAllowed} onChange={(event) => setContentPolicy({ ...contentPolicy, cloudAllowed: event.target.checked })} />{language === "zh" ? "允许云端发送（每次任务仍需确认）" : "Allow cloud send (each run still requires confirmation)"}</label>
          <label className="flex items-center justify-between gap-2">{language === "zh" ? "单文件字节上限" : "Per-file byte limit"}<input className="w-28 rounded border border-[var(--zc-divider)] bg-[var(--zc-surface)] px-1 py-0.5" type="number" min={1024} max={67108864} value={contentPolicy.maxBytes} onChange={(event) => setContentPolicy({ ...contentPolicy, maxBytes: Number(event.target.value) })} /></label>
          <label className="flex items-center justify-between gap-2">{language === "zh" ? "单文件字符上限" : "Per-file char limit"}<input className="w-28 rounded border border-[var(--zc-divider)] bg-[var(--zc-surface)] px-1 py-0.5" type="number" min={256} max={262144} value={contentPolicy.maxChars} onChange={(event) => setContentPolicy({ ...contentPolicy, maxChars: Number(event.target.value) })} /></label>
          <button type="button" className={buttonSecondary} disabled={contentBusy} onClick={() => requestContentConfirmation(language === "zh" ? "确认保存此根目录内容策略？" : "Save this per-root content policy?", saveContentPolicy)}>{language === "zh" ? "保存根目录策略" : "Save root policy"}</button>
        </fieldset> : null}
        {detail.contentSummary ? <InspectorField label={language === "zh" ? "摘要" : "Summary"} value={detail.contentSummary} /> : null}
        {detail.contentKeywords?.length ? <InspectorField label={language === "zh" ? "关键词" : "Keywords"} value={detail.contentKeywords.join(", ")} /> : null}
        {detail.contentLanguage ? <InspectorField label={language === "zh" ? "语言" : "Language"} value={detail.contentLanguage} /> : null}
        {detail.contentProvenance ? <InspectorField label={language === "zh" ? "来源" : "Provenance"} value={detail.contentProvenance} /> : null}
        {detail.contentRevision ? <InspectorField label={language === "zh" ? "截断/保留" : "Truncated / retained"} value={`${detail.contentTruncated ? "yes" : "no"} / ${detail.contentTextRetained ? "yes" : "no"}`} /> : null}
        <p className="text-xs leading-5 text-[var(--zc-text-tertiary)]">
          {language === "zh" ? "内容分析默认关闭；本地提取会读取所选正文。云端理解仅在每次确认后发送有界文本，不发送路径或文件名。保留正文仅按根目录策略有界保留（默认不保留，最多 7 天/4 MiB）。删除内容数据不会删除源文件。" : "Content analysis is off by default. Local extraction reads the selected file; cloud understanding sends bounded text only after confirmation and never sends paths or filenames. Retained text is per-root, bounded (none by default, at most 7 days/4 MiB). Deleting content data never deletes the source file."}
        </p>
        <div className="flex flex-wrap gap-2">
          {!missing && contentScope ? <button type="button" className={buttonSecondary} disabled={contentBusy} onClick={() => void previewContentRun()}>{language === "zh" ? "预览内容分析" : "Preview content"}</button> : null}
          {!missing && contentScope ? <button type="button" className={buttonSecondary} disabled={contentBusy} onClick={() => void previewContentRun("local", "none")}>{language === "zh" ? "审核并启动本地分析" : "Review and start local"}</button> : null}
          {detail.contentRevision ? <button type="button" className={buttonSecondary} disabled={contentBusy} onClick={() => void understandWithProvider()}>{language === "zh" ? "Provider 理解" : "Understand with provider"}</button> : null}
          {detail.contentRevision ? <button type="button" className={buttonSecondary} disabled={contentBusy} onClick={() => requestContentConfirmation(language === "zh" ? "确认重建此内容产物？" : "Rebuild this content artifact?", rebuildContent)}>{language === "zh" ? "重建内容" : "Rebuild"}</button> : null}
          {detail.contentRevision ? <button type="button" className="text-xs text-[var(--zc-danger-text)] underline-offset-2 hover:underline" disabled={contentBusy} onClick={() => requestContentConfirmation(language === "zh" ? "确认删除内容数据？源文件不会删除。" : "Delete content data? The source file will not be changed.", deleteContent)}>{language === "zh" ? "删除内容数据" : "Delete content data"}</button> : null}
          {contentScope && contentPolicy ? <button type="button" className="text-xs text-[var(--zc-danger-text)] underline-offset-2 hover:underline" disabled={contentBusy} onClick={() => requestContentConfirmation(language === "zh" ? "确认清空此根目录的内容索引？源文件不会删除。" : "Purge content data for this root? Source files will not be changed.", purgeContent)}>{language === "zh" ? "清空此根目录内容" : "Purge root content"}</button> : null}
        </div>
        {contentRun ? <section className="grid gap-2 rounded border border-[var(--zc-divider)] p-2 text-xs" aria-live="polite">
          <div className="flex items-center justify-between gap-2"><strong>{language === "zh" ? "任务进度" : "Run progress"}</strong><span>{contentRun.status}</span></div>
          <p>{contentRun.completedCount}/{contentRun.requestedCount} · {language === "zh" ? "阻断" : "blocked"} {contentRun.blockedCount} · {language === "zh" ? "失败" : "failed"} {contentRun.failedCount}</p>
          <p className="text-[var(--zc-text-tertiary)]">{language === "zh" ? "项目状态" : "Item states"}: {contentRunItems.filter((item) => item.status === "completed").length} completed / {contentRunItems.filter((item) => item.providerStatus === "completed").length} provider completed</p>
          <div className="flex flex-wrap gap-2"><button type="button" className={buttonSecondary} disabled={contentBusy} onClick={() => requestContentConfirmation(language === "zh" ? "确认取消任务？" : "Cancel this run?", cancelContentRun)}>{language === "zh" ? "取消任务" : "Cancel run"}</button><button type="button" className={buttonSecondary} disabled={contentBusy} onClick={() => setContentRun({ ...contentRun })}>{language === "zh" ? "重新挂载/刷新" : "Remount / refresh"}</button></div>
        </section> : null}
        {recentContentRuns.length ? <p className="text-xs text-[var(--zc-text-tertiary)]">{language === "zh" ? `最近任务：${recentContentRuns.length} 个（崩溃恢复状态会保留在列表中）。` : `${recentContentRuns.length} recent durable runs (interrupted/recovery states remain visible).`}</p> : null}
        <ContentSearchPanel scope={contentScope} expectedLibraryRevision={detail.revision} language={language} />
        {contentMessage ? <p className="text-xs text-[var(--zc-text-secondary)]" aria-live="polite">{contentMessage}</p> : null}
      </section>
      {contentPreview && pendingContentRequest ? <ContentReviewDialog language={language} preview={contentPreview} mode={pendingContentRequest.mode} busy={contentBusy} onCancel={() => { setContentPreview(null); setPendingContentRequest(null); }} onConfirm={() => void confirmContentRun()} /> : null}
      {contentConfirmation ? <ContentConfirmationDialog language={language} message={contentConfirmation.message} busy={contentBusy} onCancel={() => setContentConfirmation(null)} onConfirm={() => { const action = contentConfirmation.action; setContentConfirmation(null); void action(); }} /> : null}
      {availableTags.length ? <section className="grid gap-2 border-t border-[var(--zc-divider)] pt-3"><h3 className="text-xs font-semibold text-[var(--zc-text-tertiary)]">Tags</h3><div className="flex flex-wrap gap-1.5">{availableTags.map((tag) => { const active = selectedTagIds.has(tag.id); return <button key={tag.id} type="button" className={cn("rounded-full border px-2 py-1 text-xs", active ? "border-[var(--zc-primary)] bg-[var(--zc-surface-selected)] text-[var(--zc-text-primary)]" : "border-[var(--zc-divider)] text-[var(--zc-text-secondary)]")} onClick={() => onToggleTag?.(tag.id, active ? "remove" : "add")} aria-pressed={active}>{tag.displayName}</button>; })}</div></section> : null}
      <div className="flex flex-wrap gap-2">{!missing ? <button className={buttonSecondary} onClick={() => onPreview(detail)}>{t("libraryPreview")}</button> : null}<button className={buttonSecondary} onClick={() => onReveal(detail.id)}>{libraryRevealLabel(t)}</button><button className={glassButtonPrimary} onClick={onViewSuggestions}>{t("libraryViewSuggestions")}</button></div>
    </div>
  );
}

function ContentReviewDialog({ language, preview, mode, busy, onCancel, onConfirm }: { language: Language; preview: ContentPreview; mode: ContentPreviewRequest["mode"]; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  return <ModalPortal initialFocusRef={closeRef} onEscape={onCancel}>
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/20 p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className={cn(floatingSurface, "grid w-full max-w-2xl gap-4 p-5")} role="dialog" aria-modal="true" aria-labelledby="content-review-title">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-[var(--zc-text-tertiary)]">{language === "zh" ? "内容任务审核" : "Content run review"}</p><h2 id="content-review-title" className="mt-1 text-lg font-semibold text-[var(--zc-text-primary)]">{mode === "local" ? (language === "zh" ? "本地提取" : "Local extraction") : (language === "zh" ? "本地提取 + Provider" : "Local extraction + provider")}</h2></div><button ref={closeRef} type="button" className="grid h-9 w-9 place-items-center rounded" onClick={onCancel} aria-label={language === "zh" ? "关闭" : "Close"}><X size={17} /></button></div>
        <dl className="grid grid-cols-2 gap-3 text-sm"><InspectorField label={language === "zh" ? "范围" : "Scope"} value={preview.scopeHealth.rootIds.join(", ") || (language === "zh" ? "空范围" : "Empty scope")} /><InspectorField label={language === "zh" ? "候选" : "Candidates"} value={`${preview.exactState}: ${preview.exactCount}${preview.deferredCount == null ? "" : ` (deferred ${preview.deferredCount})`}`} /><InspectorField label={language === "zh" ? "支持/不支持/阻断" : "Supported / unsupported / blocked"} value={`${preview.supportedCount} / ${preview.unsupportedCount} / ${preview.blockedCount}`} /><InspectorField label={language === "zh" ? "预算（每文件）" : "Per-file budget"} value={`${preview.perFileByteBudget} bytes / ${preview.perFileCharBudget} chars`} /><InspectorField label={language === "zh" ? "预算（总任务）" : "Total run budget"} value={`${preview.totalByteBudget} bytes / ${preview.totalCharBudget} chars`} /><InspectorField label={language === "zh" ? "格式" : "Formats"} value={preview.supportedFormats.join(", ") || "—"} /></dl>
        {preview.blockedReasons.length ? <p className="text-xs text-[var(--zc-warning-text)]">{language === "zh" ? "阻断原因：" : "Blocked reasons: "}{preview.blockedReasons.join(", ")}</p> : null}
        <p className="text-xs leading-5 text-[var(--zc-text-tertiary)]">{preview.rawRetentionDisclosure} {language === "zh" ? "Provider 仅发送有界正文，不发送路径/文件名；任务会固定此预览指纹。" : "The provider receives bounded text only, never paths or filenames; the run is bound to this preview fingerprint."}</p>
        <div className="flex justify-end gap-2"><button type="button" className={buttonSecondary} disabled={busy} onClick={onCancel}>{language === "zh" ? "取消" : "Cancel"}</button><button type="button" className={glassButtonPrimary} disabled={busy || preview.exactState === "deferred" || preview.supportedCount === 0} onClick={onConfirm}>{language === "zh" ? "确认并启动" : "Confirm and start"}</button></div>
      </section>
    </div>
  </ModalPortal>;
}

function ContentConfirmationDialog({ language, message, busy, onCancel, onConfirm }: { language: Language; message: string; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  return <ModalPortal initialFocusRef={closeRef} onEscape={onCancel}>
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/20 p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className={cn(floatingSurface, "grid w-full max-w-md gap-4 p-5")} role="dialog" aria-modal="true" aria-labelledby="content-confirm-title">
        <div className="flex items-start justify-between gap-3"><h2 id="content-confirm-title" className="text-base font-semibold text-[var(--zc-text-primary)]">{language === "zh" ? "需要确认" : "Confirmation required"}</h2><button ref={closeRef} type="button" className="grid h-9 w-9 place-items-center rounded" onClick={onCancel} aria-label={language === "zh" ? "关闭" : "Close"}><X size={17} /></button></div>
        <p className="text-sm leading-6 text-[var(--zc-text-secondary)]">{message}</p>
        <div className="flex justify-end gap-2"><button type="button" className={buttonSecondary} disabled={busy} onClick={onCancel}>{language === "zh" ? "取消" : "Cancel"}</button><button type="button" className={glassButtonPrimary} disabled={busy} onClick={onConfirm}>{language === "zh" ? "确认" : "Confirm"}</button></div>
      </section>
    </div>
  </ModalPortal>;
}

function ContentSearchPanel({ scope, expectedLibraryRevision, language }: { scope: FileLibraryScopeV2 | null; expectedLibraryRevision: number; language: Language }) {
  const [query, setQuery] = useState("");
  const [contentRevision, setContentRevision] = useState<number | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [results, setResults] = useState<Array<{ id: string; summary: string | null }>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  const search = async (reset: boolean) => {
    if (!scope) return;
    const requestSequence = ++sequence.current;
    setBusy(true); setMessage(null);
    try {
      const revision = reset || contentRevision == null ? await tauriApi.getContentCatalogRevision() : contentRevision;
      const page = await tauriApi.queryContentArtifacts({ query, scope, expectedLibraryRevision, expectedContentRevision: revision, limit: 10, cursor: reset ? null : cursor });
      if (requestSequence !== sequence.current) return;
      setContentRevision(page.contentRevision);
      setResults((current) => reset ? page.artifacts : [...current, ...page.artifacts]);
      setCursor(page.nextCursor);
    } catch (error) {
      if (requestSequence !== sequence.current) return;
      setMessage(String(error).includes("stale") || String(error).includes("revision") ? (language === "zh" ? "内容索引已变化，已阻止旧游标；请重新挂载搜索。" : "Content index changed; the stale cursor was rejected. Remount the search.") : String(error));
      setCursor(null);
    } finally { if (requestSequence === sequence.current) setBusy(false); }
  };
  return <section className="grid gap-2 rounded border border-[var(--zc-divider)] p-2" aria-labelledby="content-search-title">
    <h4 id="content-search-title" className="text-xs font-semibold text-[var(--zc-text-tertiary)]">{language === "zh" ? "内容搜索" : "Content Search"}</h4>
    <div className="flex gap-2"><input className="min-w-0 flex-1 rounded border border-[var(--zc-divider)] bg-[var(--zc-surface)] px-2 py-1 text-xs" value={query} onChange={(event) => { setQuery(event.target.value); setCursor(null); }} placeholder={language === "zh" ? "摘要/关键词/语言" : "Summary / keywords / language"} /><button type="button" className={buttonSecondary} disabled={busy || !scope} onClick={() => void search(true)}>{language === "zh" ? "搜索" : "Search"}</button></div>
    {results.length ? <ul className="grid gap-1 text-xs">{results.map((item) => <li key={item.id} className="truncate text-[var(--zc-text-secondary)]">{item.summary || item.id}</li>)}</ul> : null}
    {cursor ? <button type="button" className="text-left text-xs underline" disabled={busy} onClick={() => void search(false)}>{language === "zh" ? "加载更多" : "Load more"}</button> : null}
    {message ? <p className="text-xs text-[var(--zc-warning-text)]" aria-live="polite">{message}</p> : null}
  </section>;
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
