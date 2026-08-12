import { FileSearch, Loader2, ShieldCheck, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { isBrowserMockEnabled } from "../../../api/browserMockApi";
import { tauriApi } from "../../../api/tauriApi";
import { ModalPortal } from "../../../components/modal/ModalPortal";
import type {
  ContentPreview,
  ContentPreviewRequest,
  ContentRun,
  ContentRunItem,
  ContentScopePolicy,
  FileLibraryDetail,
  FileLibraryScopeV2
} from "../../../types/domain";
import type { Translator } from "../../../types/ui";
import { buttonSecondary, cn, floatingSurface, glassButtonPrimary, inputSurface } from "../../../utils/tw";
import { readableError } from "../../../utils/viewHelpers";
import { ConfirmDialog, MetricStrip, NoticeBanner, SideSheet, mutedText, panelSurface } from "../../shared/ui";

interface Props {
  open: boolean;
  detail: FileLibraryDetail;
  t: Translator;
  onClose: () => void;
  restoreFocus?: () => HTMLElement | null;
  onRefreshDetail?: () => Promise<void>;
  onRefreshAuthoritativeContentState?: () => Promise<ContentRefreshResult>;
}

export type ContentRefreshResult =
  | { status: "applied"; detail: FileLibraryDetail; policy: ContentScopePolicy | null }
  | { status: "superseded" }
  | { status: "failed"; error?: unknown };

type Confirmation = { description: string; action: () => Promise<void> } | null;
type ContentRefreshClaim = { ownerEpoch: number; status: "pending" | "applied" };

export function ContentUnderstandingSheet({ open, detail, t, onClose, restoreFocus, onRefreshDetail, onRefreshAuthoritativeContentState }: Props) {
  const [contentBusy, setContentBusy] = useState(false);
  const [contentMessage, setContentMessage] = useState<string | null>(null);
  const [contentPolicy, setContentPolicy] = useState<ContentScopePolicy | null>(null);
  const [policyDirty, setPolicyDirty] = useState(false);
  const policyDirtyRef = useRef(false);
  const [contentPreview, setContentPreview] = useState<ContentPreview | null>(null);
  const [pendingContentRequest, setPendingContentRequest] = useState<ContentPreviewRequest | null>(null);
  const [contentRun, setContentRun] = useState<ContentRun | null>(null);
  const [contentRunItems, setContentRunItems] = useState<ContentRunItem[]>([]);
  const [contentRunRefreshKey, setContentRunRefreshKey] = useState(0);
  const [recentContentRuns, setRecentContentRuns] = useState<ContentRun[]>([]);
  const [contentConfirmation, setContentConfirmation] = useState<Confirmation>(null);
  const refreshedContentRuns = useRef(new Map<string, ContentRefreshClaim>());
  const contentRunRef = useRef<ContentRun | null>(null);
  const contentHydrationEpoch = useRef(0);
  const pollEpoch = useRef(0);
  const contentScope: FileLibraryScopeV2 | null = detail?.scanRootId ? { kind: "roots", scanRootIds: [detail.scanRootId] } : null;
  const updatePolicyDirty = (dirty: boolean) => {
    policyDirtyRef.current = dirty;
    setPolicyDirty(dirty);
  };

  useEffect(() => {
    const hydrationEpoch = contentHydrationEpoch.current + 1;
    contentHydrationEpoch.current = hydrationEpoch;
    const detailId = detail?.id ?? "";
    const scanRootId = detail?.scanRootId ?? null;
    const ownsHydration = () => contentHydrationEpoch.current === hydrationEpoch
      && open
      && detail?.id === detailId
      && detail?.scanRootId === scanRootId;

    if (!open || !detail) {
      return () => {
        if (contentHydrationEpoch.current === hydrationEpoch) contentHydrationEpoch.current += 1;
      };
    }
    setContentPolicy(null);
    updatePolicyDirty(false);
    setContentPreview(null);
    setPendingContentRequest(null);
    setContentRun(null);
    contentRunRef.current = null;
    setContentRunItems([]);
    setContentRunRefreshKey(0);
    setContentMessage(null);
    setContentConfirmation(null);
    refreshedContentRuns.current.clear();
    if (!scanRootId) {
      setRecentContentRuns([]);
      return () => {
        if (contentHydrationEpoch.current === hydrationEpoch) contentHydrationEpoch.current += 1;
      };
    }
    void Promise.all([
      tauriApi.getContentScopePolicy(scanRootId),
      tauriApi.listContentRuns(10),
      tauriApi.getActiveContentRunForFile(detailId)
    ]).then(async ([policy, runs, activeRun]) => {
      if (!ownsHydration()) return;
      setContentPolicy(policy);
      updatePolicyDirty(false);
      setRecentContentRuns(runs);
      if (!activeRun || isTerminalContentRun(activeRun.run.status)) return;
      contentRunRef.current = activeRun.run;
      setContentRun(activeRun.run);
      setContentRunItems(activeRun.items);
    }).catch((error) => {
      if (!ownsHydration()) return;
      setContentMessage(contentError(error, t));
      setRecentContentRuns([]);
    });
    return () => {
      if (contentHydrationEpoch.current === hydrationEpoch) contentHydrationEpoch.current += 1;
    };
  }, [detail?.id, detail?.scanRootId, open, t]);

  useEffect(() => {
    if (!open || !contentRun?.id) return;
    const detailId = detail.id;
    const runId = contentRun.id;
    const currentPollEpoch = pollEpoch.current + 1;
    pollEpoch.current = currentPollEpoch;
    let disposed = false;
    let pollInFlight = false;
    let timer: number | null = null;
    let shouldContinuePolling = true;
    const ownsPoll = () => !disposed
      && currentPollEpoch === pollEpoch.current
      && detail.id === detailId
      && contentRunRef.current?.id === runId;
    const schedule = () => {
      if (shouldContinuePolling && ownsPoll()) timer = window.setTimeout(() => void refresh().catch(() => undefined), 2000);
    };
    const refresh = async () => {
      if (!ownsPoll() || pollInFlight) return;
      pollInFlight = true;
      try {
        const nextRun = await tauriApi.getContentRun(runId);
        if (!ownsPoll()) return;
        const previousRun = contentRunRef.current;
        if (previousRun && previousRun.id === runId && nextRun.revision < previousRun.revision) return;
        const previousTerminal = previousRun && isTerminalContentRun(previousRun.status);
        const nextTerminal = isTerminalContentRun(nextRun.status);
        if (previousRun && previousRun.revision === nextRun.revision && previousTerminal && !nextTerminal) return;
        const page = await tauriApi.queryContentRunItems(runId, 100);
        if (!ownsPoll()) return;
        contentRunRef.current = nextRun;
        setContentRun(nextRun);
        if (page.runId === runId) setContentRunItems(page.items);
        const existingClaim = refreshedContentRuns.current.get(runId);
        if (nextTerminal && existingClaim?.status === "applied") {
          shouldContinuePolling = false;
        } else if (nextTerminal && (!existingClaim || existingClaim.status === "pending")) {
          refreshedContentRuns.current.set(runId, { ownerEpoch: currentPollEpoch, status: "pending" });
          const refreshed = await refreshAuthoritativeContentState();
          if (!ownsPoll()) return;
          const currentClaim = refreshedContentRuns.current.get(runId);
          if (currentClaim?.ownerEpoch !== currentPollEpoch) return;
          if (refreshed.status === "applied") {
            currentClaim.status = "applied";
            shouldContinuePolling = false;
          }
          else if (refreshed.status === "failed") {
            refreshedContentRuns.current.delete(runId);
            setContentMessage(t("contentOperationFailed"));
          }
        }
      } catch (error) {
        if (ownsPoll()) setContentMessage(contentError(error, t));
      } finally {
        pollInFlight = false;
        if (shouldContinuePolling) schedule();
      }
    };
    void refresh().catch(() => undefined);
    return () => {
      disposed = true;
      pollEpoch.current += 1;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [contentRun?.id, contentRunRefreshKey, detail.id, onRefreshAuthoritativeContentState, onRefreshDetail, open, t]);

  if (!open) return null;

  const missing = detail.isStale;
  const contentStatus = contentStatusLabel(detail.contentStatus, t);
  const policyStatus = detail.contentPolicy
     ? contentPolicyLabel(detail.contentPolicy, t)
     : contentPolicy
       ? contentPolicy.enabled ? t("contentPolicyEnabled") : t("contentPolicyDisabled")
       : t("contentPolicyPerRoot");

  async function getContentRequest(mode: ContentPreviewRequest["mode"], providerMode: ContentPreviewRequest["providerMode"]) {
    if (!contentScope || !detail.scanRootId) return null;
    const policy = contentPolicy ?? await tauriApi.getContentScopePolicy(detail.scanRootId);
    if (!contentPolicy) {
      setContentPolicy(policy);
      updatePolicyDirty(false);
    }
    return {
      request: {
        version: 1 as const,
        requestId: crypto.randomUUID(),
        scope: contentScope,
        selectionFileIds: [detail.id],
        mode,
        expectedLibraryRevision: detail.revision,
        expectedPolicyRevisions: [{ rootId: detail.scanRootId, rootRevision: policy.rootRevision, policyRevision: policy.policyRevision }],
        providerMode
      },
      policy
    };
  }

  async function previewContentRun(mode: ContentPreviewRequest["mode"], providerMode: ContentPreviewRequest["providerMode"]) {
    setContentBusy(true);
    setContentMessage(null);
    try {
      const prepared = await getContentRequest(mode, providerMode);
      if (!prepared) return;
      const preview = await tauriApi.previewContent(prepared.request);
      setContentPreview(preview);
      setPendingContentRequest(prepared.request);
      setContentMessage(t("contentPreviewReady"));
    } catch (error) {
      setContentMessage(contentError(error, t));
    } finally {
      setContentBusy(false);
    }
  }

  async function confirmContentRun() {
    if (!contentPreview || !pendingContentRequest) return;
    setContentBusy(true);
    setContentMessage(null);
    try {
      const run = await tauriApi.startContentRun({
        ...pendingContentRequest,
        previewFingerprint: contentPreview.previewFingerprint,
        confirmed: true
      });
       contentRunRef.current = run;
       setContentRun(run);
      setContentPreview(null);
      setPendingContentRequest(null);
      setContentMessage(replaceCopy(t("contentRunStarted"), {
        status: contentRunStatusLabel(run.status, t),
        completed: run.completedCount,
        requested: run.requestedCount
      }));
    } catch (error) {
      setContentMessage(contentError(error, t));
    } finally {
      setContentBusy(false);
    }
  }

  async function saveContentPolicy() {
    if (!contentPolicy || !detail.scanRootId) return;
    setContentBusy(true);
    setContentMessage(null);
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
      updatePolicyDirty(false);
      const outcome = await refreshAuthoritativeContentState();
      if (outcome.status === "applied") setContentMessage(t("contentPolicySaved"));
      else if (outcome.status === "failed") setContentMessage(t("contentOperationFailed"));
    } catch (error) {
      if (isContentRevisionConflict(error)) {
        const outcome = await refreshAuthoritativeContentState();
        if (outcome.status === "applied") setContentMessage(t("contentRevisionChanged"));
        else if (outcome.status === "failed") setContentMessage(t("contentOperationFailed"));
      } else setContentMessage(t("contentSavePolicyFailed"));
    } finally {
      setContentBusy(false);
    }
  }

  async function cancelContentRun() {
    if (!contentRun) return;
    setContentBusy(true);
    try {
      const run = await tauriApi.cancelContentRun(contentRun.id, contentRun.revision, true);
       contentRunRef.current = run;
       setContentRun(run);
    } catch (error) {
      setContentMessage(contentError(error, t));
    } finally {
      setContentBusy(false);
    }
  }

  async function rebuildContent() {
    if (!detail.contentRevision) return;
    setContentBusy(true);
    setContentMessage(null);
    try {
      await tauriApi.rebuildContentArtifact(detail.id, detail.contentRevision, true);
      const outcome = await refreshAuthoritativeContentState();
      if (outcome.status === "applied") setContentMessage(t("contentArtifactRebuilt"));
      else if (outcome.status === "failed") setContentMessage(t("contentOperationFailed"));
    } catch (error) {
      if (isContentRevisionConflict(error)) {
        const outcome = await refreshAuthoritativeContentState();
        if (outcome.status === "applied") setContentMessage(t("contentRevisionChanged"));
        else if (outcome.status === "failed") setContentMessage(t("contentOperationFailed"));
      } else setContentMessage(contentError(error, t));
    } finally {
      setContentBusy(false);
    }
  }

  async function deleteContent() {
    if (!detail.contentRevision) return;
    setContentBusy(true);
    setContentMessage(null);
    try {
      await tauriApi.deleteContentArtifact(detail.id, detail.contentRevision, true);
      const outcome = await refreshAuthoritativeContentState();
      if (outcome.status === "applied") setContentMessage(t("contentDataDeleted"));
      else if (outcome.status === "failed") setContentMessage(t("contentOperationFailed"));
    } catch (error) {
      if (isContentRevisionConflict(error)) {
        const outcome = await refreshAuthoritativeContentState();
        if (outcome.status === "applied") setContentMessage(t("contentRevisionChanged"));
        else if (outcome.status === "failed") setContentMessage(t("contentOperationFailed"));
      } else setContentMessage(contentError(error, t));
    } finally {
      setContentBusy(false);
    }
  }

  async function purgeContent() {
    if (!contentScope || !contentPolicy) return;
    setContentBusy(true);
    setContentMessage(null);
    try {
      const deleted = await tauriApi.purgeContentScope({
        version: 1,
        scope: contentScope,
        expectedLibraryRevision: detail.revision,
        expectedPolicyRevisions: [{ rootId: contentPolicy.rootId, rootRevision: contentPolicy.rootRevision, policyRevision: contentPolicy.policyRevision }],
        confirmed: true
      });
      const outcome = await refreshAuthoritativeContentState();
      if (outcome.status === "applied") setContentMessage(replaceCopy(t("contentPurged"), { count: deleted }));
      else if (outcome.status === "failed") setContentMessage(t("contentOperationFailed"));
    } catch (error) {
      if (isContentRevisionConflict(error)) {
        const outcome = await refreshAuthoritativeContentState();
        if (outcome.status === "applied") setContentMessage(t("contentRevisionChanged"));
        else if (outcome.status === "failed") setContentMessage(t("contentOperationFailed"));
      } else setContentMessage(contentError(error, t));
    } finally {
      setContentBusy(false);
    }
  }

  function requestConfirmation(description: string, action: () => Promise<void>) {
    setContentConfirmation({ description, action });
  }

  async function refreshAuthoritativeContentState(): Promise<ContentRefreshResult> {
    try {
      if (onRefreshAuthoritativeContentState) {
        const refreshed = await onRefreshAuthoritativeContentState();
        if (refreshed.status === "applied") {
          applyAuthoritativePolicy(refreshed.policy);
        }
        return refreshed;
      } else {
        await onRefreshDetail?.();
        const refreshedPolicy = detail.scanRootId
          ? await tauriApi.getContentScopePolicy(detail.scanRootId)
          : null;
        applyAuthoritativePolicy(refreshedPolicy);
        return { status: "applied", detail, policy: refreshedPolicy };
      }
    } catch (error) {
      return { status: "failed", error };
    }
  }

  function applyAuthoritativePolicy(refreshedPolicy: ContentScopePolicy | null) {
    if (policyDirtyRef.current) {
      if (refreshedPolicy) {
        setContentPolicy((draft) => draft ? mergeContentPolicyDraft(draft, refreshedPolicy) : refreshedPolicy);
      }
      return;
    }
    setContentPolicy(refreshedPolicy);
    updatePolicyDirty(false);
  }

  return (
    <SideSheet
      open
      title={t("contentUnderstandingTitle")}
      description={t("contentUnderstandingDesc")}
      closeLabel={t("close")}
      modalId="content-understanding"
      restoreFocus={restoreFocus}
      onClose={onClose}
    >
      <div className="grid gap-5">
        <section className="grid gap-3 border-b border-[var(--zc-divider)] pb-4" aria-labelledby="content-status-title">
          <div className="flex items-start gap-2"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-[var(--zc-success-text)]" aria-hidden="true" /><div><h3 id="content-status-title" className="text-sm font-semibold">{t("contentStatus")}</h3><p className={cn(mutedText, "mt-1")}>{t("contentSourceUnchanged")}</p></div></div>
          <MetricStrip
            ariaLabel={t("contentStatus")}
            density="compact"
            items={[
              { label: t("contentStatus"), value: contentStatus },
              { label: t("contentPolicy"), value: policyStatus }
            ]}
          />
          {isBrowserMockEnabled() ? <p className={cn(mutedText, "text-xs")}>{t("contentBrowserMock")}</p> : null}
        </section>

        <section className="grid gap-3 border-b border-[var(--zc-divider)] pb-4" aria-labelledby="content-policy-title">
          <div><h3 id="content-policy-title" className="text-sm font-semibold">{t("contentPolicyTitle")}</h3>{contentPolicy ? <p className={cn(mutedText, "mt-1")}>{contentPolicy.enabled ? t("contentPolicyEnabledDesc") : t("contentPolicyOffDesc")}</p> : null}</div>
          {!detail.scanRootId ? <NoticeBanner tone="info" title={t("contentNoRootTitle")}>{t("contentNoRootDesc")}</NoticeBanner> : contentPolicy ? (
            <fieldset className={cn(panelSurface, "grid gap-3 p-3")}>
              <legend className="px-1 text-xs font-semibold text-[var(--zc-text-tertiary)]">{t("contentPolicy")}</legend>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={contentPolicy.enabled} onChange={(event) => { updatePolicyDirty(true); setContentPolicy({ ...contentPolicy, enabled: event.target.checked }); }} />{t("contentEnableAnalysis")}</label>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={contentPolicy.localAllowed} onChange={(event) => { updatePolicyDirty(true); setContentPolicy({ ...contentPolicy, localAllowed: event.target.checked }); }} />{t("contentAllowLocal")}</label>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={contentPolicy.cloudAllowed} onChange={(event) => { updatePolicyDirty(true); setContentPolicy({ ...contentPolicy, cloudAllowed: event.target.checked }); }} />{t("contentAllowCloud")}</label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1 text-xs text-[var(--zc-text-secondary)]">{t("contentPerFileByteLimit")}<input className={inputSurface} type="number" min={1024} max={67108864} value={contentPolicy.maxBytes} onChange={(event) => { updatePolicyDirty(true); setContentPolicy({ ...contentPolicy, maxBytes: Number(event.target.value) }); }} /></label>
                <label className="grid gap-1 text-xs text-[var(--zc-text-secondary)]">{t("contentPerFileCharLimit")}<input className={inputSurface} type="number" min={256} max={262144} value={contentPolicy.maxChars} onChange={(event) => { updatePolicyDirty(true); setContentPolicy({ ...contentPolicy, maxChars: Number(event.target.value) }); }} /></label>
              </div>
              {!contentPolicy.enabled ? <NoticeBanner tone="warning" title={t("contentPolicyOffTitle")}>{t("contentPolicyOffDesc")}</NoticeBanner> : null}
              {policyDirty ? <p className="text-xs text-[var(--zc-warning-text)]">{t("contentSavePolicyFirst")}</p> : null}
              <button type="button" className={buttonSecondary} disabled={contentBusy} onClick={() => requestConfirmation(t("contentSavePolicyConfirm"), saveContentPolicy)}>{t("contentSaveRootPolicy")}</button>
            </fieldset>
          ) : <p className={mutedText}>{t("contentPolicyLoading")}</p>}
        </section>

        <section className="grid gap-3 border-b border-[var(--zc-divider)] pb-4" aria-labelledby="content-run-title">
          <div><h3 id="content-run-title" className="text-sm font-semibold">{t("contentPreviewAndRun")}</h3><p className={cn(mutedText, "mt-1")}>{t("contentSourceUnchanged")}</p></div>
          <div className="flex flex-wrap gap-2">
            {!missing && contentScope ? <button type="button" className={buttonSecondary} disabled={contentBusy || policyDirty || !contentPolicy?.enabled || !contentPolicy.localAllowed} onClick={() => void previewContentRun("local", "none").catch(() => undefined)}><FileSearch size={15} />{t("contentPreviewLocal")}</button> : null}
            {!missing && contentScope && detail.contentRevision ? <button type="button" className={buttonSecondary} disabled={contentBusy || policyDirty || !contentPolicy?.enabled || !contentPolicy.cloudAllowed} onClick={() => void previewContentRun("understand", "existing_interactive_provider").catch(() => undefined)}><Sparkles size={15} />{t("contentProviderUnderstanding")}</button> : null}
          </div>
          {contentPreview && pendingContentRequest ? <ContentReviewDialog detail={detail} preview={contentPreview} request={pendingContentRequest} busy={contentBusy} t={t} onCancel={() => { setContentPreview(null); setPendingContentRequest(null); }} onConfirm={() => void confirmContentRun().catch(() => undefined)} /> : null}
          {contentRun ? <div className={cn(panelSurface, "grid gap-3 p-3")} aria-live="polite">
            <MetricStrip
              ariaLabel={t("contentRunProgress")}
              density="compact"
              items={[
                { label: t("contentRunStatus"), value: contentRunStatusLabel(contentRun.status, t) },
                { label: t("contentCompleted"), value: `${contentRun.completedCount}/${contentRun.requestedCount}` },
                { label: t("contentBlocked"), value: contentRun.blockedCount.toLocaleString(), tone: "amber" },
                { label: t("contentFailed"), value: contentRun.failedCount.toLocaleString(), tone: contentRun.failedCount ? "red" : "slate" }
              ]}
            />
            <p className={cn(mutedText, "text-xs")}>{t("contentItemStates")}{contentRunItems.length ? ` ${replaceCopy(t("contentLoadedItems"), { count: contentRunItems.length })}` : ""}</p>
            <div className="flex flex-wrap gap-2">
              {!isTerminalContentRun(contentRun.status) ? <button type="button" className={buttonSecondary} disabled={contentBusy} onClick={() => requestConfirmation(t("contentCancelRunConfirm"), cancelContentRun)}>{t("contentCancelRun")}</button> : null}
               <button type="button" className={buttonSecondary} disabled={contentBusy} onClick={() => setContentRunRefreshKey((current) => current + 1)}>{t("contentRefreshRun")}</button>
            </div>
          </div> : null}
        </section>

        <section className="grid gap-3 border-b border-[var(--zc-divider)] pb-4" aria-labelledby="content-artifact-title">
          <div><h3 id="content-artifact-title" className="text-sm font-semibold">{t("contentArtifactTitle")}</h3><p className={cn(mutedText, "mt-1")}>{t("contentSourceUnchanged")}</p></div>
          {detail.contentRevision ? <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {detail.contentSummary ? <ContentField label={t("contentSummary")} value={detail.contentSummary} /> : null}
            {detail.contentKeywords?.length ? <ContentField label={t("contentKeywords")} value={detail.contentKeywords.join(", ")} /> : null}
            {detail.contentLanguage ? <ContentField label={t("contentLanguage")} value={detail.contentLanguage} /> : null}
            {detail.contentProvenance ? <ContentField label={t("contentProvenance")} value={detail.contentProvenance} /> : null}
            <ContentField label={t("contentTruncatedRetained")} value={`${detail.contentTruncated ? t("contentYes") : t("contentNo")} / ${detail.contentTextRetained ? t("contentYes") : t("contentNo")}`} />
          </dl> : <p className={mutedText}>{t("contentNoArtifact")}</p>}
          <div className="flex flex-wrap gap-2">
            {detail.contentRevision ? <button type="button" className={buttonSecondary} disabled={contentBusy} onClick={() => requestConfirmation(t("contentRebuildConfirm"), rebuildContent)}>{t("contentRebuild")}</button> : null}
            {detail.contentRevision ? <button type="button" className="text-sm font-medium text-[var(--zc-danger-text)] underline-offset-2 hover:underline" disabled={contentBusy} onClick={() => requestConfirmation(t("contentDeleteConfirm"), deleteContent)}>{t("contentDeleteData")}</button> : null}
            {contentScope && contentPolicy ? <button type="button" className="text-sm font-medium text-[var(--zc-danger-text)] underline-offset-2 hover:underline" disabled={contentBusy} onClick={() => requestConfirmation(t("contentPurgeConfirm"), purgeContent)}>{t("contentPurgeRoot")}</button> : null}
          </div>
        </section>

        <section className="grid gap-3 border-b border-[var(--zc-divider)] pb-4" aria-labelledby="content-recent-title">
          <h3 id="content-recent-title" className="text-sm font-semibold">{t("contentRecentRuns")}</h3>
          {recentContentRuns.length ? <ul className="grid gap-2 text-sm">{recentContentRuns.map((run) => <li key={run.id} className="flex items-center justify-between gap-3 rounded-[var(--zc-radius-row)] border border-[var(--zc-border)] px-3 py-2"><span>{contentRunStatusLabel(run.status, t)}</span><span className="tabular-nums text-[var(--zc-text-secondary)]">{run.completedCount}/{run.requestedCount}</span></li>)}</ul> : <p className={mutedText}>{t("contentNoRecentRuns")}</p>}
          {recentContentRuns.length ? <p className={cn(mutedText, "text-xs")}>{replaceCopy(t("contentRecentRunsCount"), { count: recentContentRuns.length })}</p> : null}
        </section>

        <ContentSearchPanel scope={contentScope} expectedLibraryRevision={detail.revision} t={t} />
        {contentMessage ? <p className="text-sm text-[var(--zc-text-secondary)]" aria-live="polite">{contentMessage}</p> : null}
      </div>

      <ConfirmDialog
        open={Boolean(contentConfirmation)}
        tone="warning"
        title={t("contentConfirmationTitle")}
        description={contentConfirmation?.description}
        confirmLabel={t("contentConfirm")}
        cancelLabel={t("contentCancel")}
        isProcessing={contentBusy}
        onCancel={() => setContentConfirmation(null)}
        onConfirm={() => {
          if (!contentConfirmation) return;
          const action = contentConfirmation.action;
          setContentConfirmation(null);
          void action().catch(() => undefined);
        }}
      />
    </SideSheet>
  );
}

function ContentReviewDialog({ detail, preview, request, busy, t, onCancel, onConfirm }: { detail: FileLibraryDetail; preview: ContentPreview; request: ContentPreviewRequest; busy: boolean; t: Translator; onCancel: () => void; onConfirm: () => void }) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const scopeLabel = detail.scanRootName ?? t("contentPolicyPerRoot");
  return <ModalPortal initialFocusRef={closeRef} onEscape={onCancel}>
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/20 p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className={cn(floatingSurface, "grid w-full max-w-2xl gap-4 p-5")} role="dialog" aria-modal="true" aria-labelledby="content-review-title">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-[var(--zc-text-tertiary)]">{t("contentReviewTitle")}</p><h2 id="content-review-title" className="mt-1 text-lg font-semibold text-[var(--zc-text-primary)]">{request.mode === "local" ? t("contentLocalExtraction") : t("contentLocalAndProvider")}</h2></div><button ref={closeRef} type="button" className="grid h-9 w-9 place-items-center rounded" onClick={onCancel} aria-label={t("close")}><X size={17} /></button></div>
         <dl className="grid grid-cols-2 gap-3 text-sm"><ContentField label={t("contentScope")} value={scopeLabel} /><ContentField label={t("contentCandidates")} value={`${preview.exactCount}${preview.deferredCount == null ? "" : ` · ${preview.deferredCount} ${t("contentDeferred")}`}`} /><ContentField label={t("contentSupportedUnsupportedBlocked")} value={`${preview.supportedCount} / ${preview.unsupportedCount} / ${preview.blockedCount}`} /><ContentField label={t("contentBudgetPerFile")} value={replaceCopy(t("contentBudgetFormat"), { bytes: preview.perFileByteBudget.toLocaleString(), chars: preview.perFileCharBudget.toLocaleString() })} /><ContentField label={t("contentBudgetTotal")} value={replaceCopy(t("contentBudgetFormat"), { bytes: preview.totalByteBudget.toLocaleString(), chars: preview.totalCharBudget.toLocaleString() })} /><ContentField label={t("contentFormats")} value={preview.supportedFormats.join(", ") || t("contentNoFormats")} /><ContentField label={t("contentUnsupportedFormats")} value={preview.unsupportedFormats.join(", ") || t("contentNoFormats")} /><ContentField label={t("contentLocalCloudConsent")} value={`${preview.localAllowed ? t("contentAllowed") : t("contentDenied")} / ${preview.cloudAllowed ? t("contentAllowed") : t("contentDenied")}`} /></dl>
         {preview.blockedReasons.length ? <p className="text-xs text-[var(--zc-warning-text)]">{t("contentBlockedReasons")}: {preview.blockedReasons.map((reason) => contentBlockedReasonLabel(reason, t)).join("、")}</p> : null}
        {preview.sample.length ? <div className="grid gap-1"><strong className="text-xs">{t("contentSampleFiles")}</strong><ul className="grid gap-1 text-xs text-[var(--zc-text-secondary)]">{preview.sample.slice(0, 5).map((sample) => <li key={sample.fileId} className="truncate">{sample.name}</li>)}</ul></div> : <p className={mutedText}>{t("contentSampleNone")}</p>}
         <p className="text-xs leading-5 text-[var(--zc-text-tertiary)]">{t("contentRetentionDisclosure")} {request.mode === "local" ? t("contentLocalDisclosure") : t("contentProviderDisclosure")}</p>
        <div className="flex justify-end gap-2"><button type="button" className={buttonSecondary} disabled={busy} onClick={onCancel}>{t("contentCancel")}</button><button type="button" className={glassButtonPrimary} disabled={busy || preview.exactState === "deferred" || preview.supportedCount === 0} onClick={onConfirm}>{t("contentConfirmStart")}</button></div>
      </section>
    </div>
  </ModalPortal>;
}

function ContentSearchPanel({ scope, expectedLibraryRevision, t }: { scope: FileLibraryScopeV2 | null; expectedLibraryRevision: number; t: Translator }) {
  const [query, setQuery] = useState("");
  const [contentRevision, setContentRevision] = useState<number | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [results, setResults] = useState<Array<{ id: string; summary: string | null }>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const requestEpoch = useRef(0);
  const search = async (reset: boolean) => {
    if (!scope) return;
    const epoch = ++requestEpoch.current;
    const submittedQuery = query;
    setBusy(true);
    setMessage(null);
    try {
      const revision = reset || contentRevision == null ? await tauriApi.getContentCatalogRevision() : contentRevision;
      if (epoch !== requestEpoch.current) return;
      const page = await tauriApi.queryContentArtifacts({ query: submittedQuery, scope, expectedLibraryRevision, expectedContentRevision: revision, limit: 10, cursor: reset ? null : cursor });
      if (epoch !== requestEpoch.current) return;
      setContentRevision(page.contentRevision);
      setResults((current) => reset ? page.artifacts : [...current, ...page.artifacts]);
      setCursor(page.nextCursor);
    } catch (error) {
      if (epoch !== requestEpoch.current) return;
      const messageText = readableError(error);
      setMessage(messageText.includes("browser_mock_content_unavailable") ? t("contentSearchUnavailable") : messageText.includes("stale") || messageText.includes("revision") ? t("contentSearchRemount") : t("contentSearchFailed"));
      setCursor(null);
    } finally {
      if (epoch === requestEpoch.current) setBusy(false);
    }
  };
  return <section className="grid gap-2" aria-labelledby="content-search-title"><h3 id="content-search-title" className="text-sm font-semibold">{t("contentSearchTitle")}</h3><div className="flex min-w-0 gap-2"><input className={cn(inputSurface, "min-w-0 flex-1")} value={query} onChange={(event) => { requestEpoch.current += 1; setQuery(event.target.value); setCursor(null); setContentRevision(null); setResults([]); setMessage(null); setBusy(false); }} placeholder={t("contentSearchPlaceholder")} /><button type="button" className={buttonSecondary} disabled={busy || !scope} onClick={() => void search(true).catch(() => undefined)}>{busy ? <Loader2 size={14} className="animate-spin" /> : null}{t("contentSearchAction")}</button></div>{results.length ? <ul className="grid gap-1 text-xs">{results.map((item) => <li key={item.id} className="truncate text-[var(--zc-text-secondary)]">{item.summary || t("contentNoArtifact")}</li>)}</ul> : message ? null : <p className={mutedText}>{t("contentSearchEmpty")}</p>}{cursor ? <button type="button" className="justify-self-start text-xs text-[var(--zc-primary)] underline" disabled={busy} onClick={() => void search(false).catch(() => undefined)}>{t("contentLoadMore")}</button> : null}{message ? <p className="text-xs text-[var(--zc-warning-text)]" aria-live="polite">{message}</p> : null}</section>;
}

function ContentField({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs font-semibold text-[var(--zc-text-tertiary)]">{label}</dt><dd className="mt-0.5 break-words text-sm text-[var(--zc-text-primary)]">{value}</dd></div>;
}

export function contentStatusLabel(status: string | null | undefined, t: Translator) {
  const normalized = String(status ?? "not_analyzed").toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  if (normalized === "ready" || normalized === "completed") return t("contentStatusReady");
  if (normalized === "updating" || normalized === "running") return t("contentStatusUpdating");
  if (normalized === "stale") return t("contentStatusStale");
  if (normalized === "needs_attention" || normalized === "needs_review") return t("contentStatusNeedsAttention");
  if (normalized === "not_analyzed" || normalized === "none" || normalized === "") return t("contentStatusNotAnalyzed");
  return t("contentStatusUnknown");
}

export function contentPolicyLabel(policy: string | null | undefined, t: Translator) {
  const normalized = String(policy ?? "").toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  if (normalized === "enabled" || normalized === "on") return t("contentPolicyEnabled");
  if (normalized === "disabled" || normalized === "off") return t("contentPolicyDisabled");
  return t("contentPolicyUnavailable");
}

function isTerminalContentRun(status: string | null | undefined): boolean {
  const normalized = String(status ?? "").toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  return ["completed", "failed", "canceled", "cancelled", "partially_completed"].includes(normalized);
}

function contentRunStatusLabel(status: string | null | undefined, t: Translator) {
  const normalized = String(status ?? "").toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  if (normalized === "preparing" || normalized === "queued") return t("contentRunPreparing");
  if (normalized === "extracting" || normalized === "running" || normalized === "provider_running") return t("contentRunExtracting");
  if (normalized === "completed" || normalized === "complete") return t("contentRunCompleted");
  if (normalized === "partially_completed") return t("contentRunPartiallyCompleted");
  if (normalized === "unsupported") return t("contentRunUnsupported");
  if (normalized === "failed") return t("contentRunFailed");
  if (normalized === "canceled" || normalized === "cancelled") return t("contentRunCanceled");
  return t("contentRunUnknown");
}

function contentError(error: unknown, t: Translator) {
  const message = readableError(error);
  if (message.includes("browser_mock_content_unavailable")) return t("contentSearchUnavailable");
  if (message.includes("stale") || message.includes("revision")) return t("contentRevisionChanged");
  return t("contentOperationFailed");
}

function mergeContentPolicyDraft(draft: ContentScopePolicy, authoritative: ContentScopePolicy): ContentScopePolicy {
  return {
    ...authoritative,
    enabled: draft.enabled,
    extractorFamilies: draft.extractorFamilies,
    maxBytes: draft.maxBytes,
    maxChars: draft.maxChars,
    maxPages: draft.maxPages,
    maxRows: draft.maxRows,
    rawRetentionMode: draft.rawRetentionMode,
    rawRetentionChars: draft.rawRetentionChars,
    localAllowed: draft.localAllowed,
    cloudAllowed: draft.cloudAllowed
  };
}

function isContentRevisionConflict(error: unknown): boolean {
  const message = readableError(error).toLowerCase();
  return message.includes("revision") || message.includes("stale") || message.includes("cas");
}

function contentBlockedReasonLabel(reason: string, t: Translator) {
  const normalized = reason.toLowerCase();
  if (normalized.includes("policy") || normalized.includes("permission") || normalized.includes("symlink")) return t("contentBlockedPolicy");
  if (normalized.includes("ocr")) return t("contentBlockedOcr");
  if (normalized.includes("unsupported") || normalized.includes("not_supported") || normalized.includes("legacy_office") || normalized.includes("archive")) return t("contentBlockedUnsupported");
  if (normalized.includes("limit") || normalized.includes("timeout") || normalized.includes("encrypted")) return t("contentBlockedSafetyLimit");
  return t("contentBlockedGeneric");
}

function replaceCopy(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((copy, [key, value]) => copy.replaceAll(`{${key}}`, String(value)), template);
}
