import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { desktopDir, documentDir, downloadDir, tempDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { useShallow } from "zustand/react/shallow";
import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  HelpCircle,
  Loader2,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  XCircle
} from "lucide-react";
import { tauriApi, type TauriApi } from "../../api/tauriApi";
import { useChromeContext } from "../../contexts/AppContexts";
import { useAppStore } from "../../store/useAppStore";
import {
  canManuallySelectForCleanup,
  cleanupSelectionDisabledReason,
  defaultSelectedCleanupIds,
  storageCleanupErrorMessage,
  useStorageCleanupStore
} from "../../store/useStorageCleanupStore";
import type {
  AnalysisDetector,
  AnalysisFinding,
  AnalysisFindingEvidence,
  AnalysisRun,
  CleanupExecutionResult,
  CleanupTier,
  StorageAnalysis,
  StorageCandidate
} from "../../types/domain";
import type { Translator } from "../../types/ui";
import { formatBytes } from "../../utils/format";
import { compactPath, localizedStableError, readableError } from "../../utils/viewHelpers";
import { localFileMutationUnavailableCode } from "../../utils/fileMutationCapability";
import { buttonSecondary, cn, glassButtonPrimary } from "../../utils/tw";
import {
  ConfirmDialog,
  IconButton,
  MetricCard,
  NoticeBanner,
  StateBlock,
  ToneBadge,
  contentPanel,
  metadataText,
  pageSurface,
  quietText,
  sectionDescription,
  sectionHeading,
  softPanel
} from "../shared/ui";

type StorageCleanupApi = Pick<
  TauriApi,
  | "startStorageCleanupScan"
  | "cancelStorageCleanupScan"
  | "getStorageCleanupScanStatus"
  | "revealStorageCandidate"
  | "moveCleanupCandidatesToSafeTrash"
> &
  Partial<
    Pick<
      TauriApi,
      | "getAISettings"
      | "getStorageCleanupCandidatePage"
      | "analyzeCleanupCandidatesWithAI"
      | "onStorageCleanupProgress"
      | "onStorageCleanupCompleted"
      | "onStorageCleanupFailed"
      | "onStorageCleanupCancelled"
      | "getActiveAnalysisRun"
      | "listAnalysisRuns"
      | "getAnalysisRun"
      | "listAnalysisRunDetectors"
      | "listAnalysisFindings"
      | "listAnalysisFindingEvidence"
      | "setAnalysisFindingDecision"
      | "revalidateAnalysisFinding"
      | "retryAnalysisRun"
      | "cancelAnalysisRun"
      | "onAnalysisRunUpdated"
      | "onAnalysisFindingsPublished"
      | "onAnalysisDetectorUpdated"
    >
  >;

type Props = {
  initialAnalysis?: StorageAnalysis;
  initialRoots?: string[];
  api?: StorageCleanupApi;
  t?: Translator;
};

const FILTERS: Array<CleanupTier | "All"> = ["All", "Safe", "Review", "Caution"];

export function StorageCleanupView(props: Props = {}) {
  if (props.t) return <StorageCleanupPanel {...props} t={props.t} />;
  return <StorageCleanupViewWithContext {...props} />;
}

function StorageCleanupViewWithContext(props: Omit<Props, "t">) {
  const { t, onError } = useChromeContext();
  return <StorageCleanupPanel {...props} t={t} onError={onError} />;
}

function StorageCleanupPanel({
  initialAnalysis,
  initialRoots,
  api = tauriApi,
  t,
  onError
}: Props & { t: Translator; onError?: (message: string) => void }) {
  // Keep this large virtualized view subscribed to the state it renders.  A
  // whole-store subscription caused every progress tick and AI set update to
  // re-render the complete cleanup surface.
  const analysisState = useStorageCleanupStore((state) => state.analysis);
  const displayedJobIdState = useStorageCleanupStore((state) => state.displayedJobId);
  const activeJobIdState = useStorageCleanupStore((state) => state.activeJobId);
  const selectedRootsState = useStorageCleanupStore((state) => state.selectedRoots);
  const selectedCleanupIdsState = useStorageCleanupStore((state) => state.selectedCleanupIds);
  const activeTierFilterState = useStorageCleanupStore((state) => state.activeTierFilter);
  const isScanningState = useStorageCleanupStore((state) => state.isScanning);
  const scanProgressState = useStorageCleanupStore((state) => state.scanProgress);
  const executionResultState = useStorageCleanupStore((state) => state.executionResult);
  const scanErrorState = useStorageCleanupStore((state) => state.scanError);
  const aiCleanupStatusState = useStorageCleanupStore((state) => state.aiCleanupStatus);
  const isAnalyzingWithAIState = useStorageCleanupStore((state) => state.isAnalyzingWithAI);
  const aiAnalyzedCandidateIdsState = useStorageCleanupStore((state) => state.aiAnalyzedCandidateIds);
  const aiDowngradedCandidateIdsState = useStorageCleanupStore((state) => state.aiDowngradedCandidateIds);
  const scanStatusState = useStorageCleanupStore((state) => state.scanStatus);
  const { loadMoreCandidates } = useStorageCleanupStore(
    useShallow((state) => ({ loadMoreCandidates: state.loadMoreCandidates }))
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reviewConfirmCandidate, setReviewConfirmCandidate] = useState<StorageCandidate | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const mutationUnavailable = localFileMutationUnavailableCode();
  const analysis = initialAnalysis ?? analysisState;
  const displayedJobId = initialAnalysis ? null : displayedJobIdState;
  const selectedRoots = initialRoots ?? selectedRootsState;
  const selectedCleanupIds = initialAnalysis
    ? new Set(defaultSelectedCleanupIds(initialAnalysis))
    : selectedCleanupIdsState;
  const activeTierFilter = initialAnalysis ? "All" : activeTierFilterState;
  const isScanning = !initialAnalysis && isScanningState;
  const scanProgress = !initialAnalysis ? scanProgressState : null;
  const executionResult = !initialAnalysis ? executionResultState : null;
  const scanError = !initialAnalysis ? scanErrorState : "";
  const aiCleanupStatus = !initialAnalysis ? aiCleanupStatusState : "";
  const isAnalyzingWithAI = !initialAnalysis && isAnalyzingWithAIState;
  const aiAnalyzedCandidateIds = !initialAnalysis ? aiAnalyzedCandidateIdsState : new Set<string>();
  const aiDowngradedCandidateIds = !initialAnalysis ? aiDowngradedCandidateIdsState : new Set<string>();
  const [localError, setLocalError] = useState("");
  const [cleanupAIReadiness, setCleanupAIReadiness] = useState("");
  const error = localError || (scanError ? storageCleanupErrorMessage(scanError, t) : "");

  useEffect(() => {
    if (initialAnalysis) return undefined;
    const disposers: UnlistenFn[] = [];
    let disposed = false;
    async function wireEvents() {
      const progressOff = await api.onStorageCleanupProgress?.((payload) => {
        useStorageCleanupStore.getState().applyScanProgress(payload);
      });
      const completedOff = await api.onStorageCleanupCompleted?.((payload) => {
        useStorageCleanupStore.getState().completeScan(payload.jobId, payload.analysis);
      });
      const failedOff = await api.onStorageCleanupFailed?.((payload) => {
        useStorageCleanupStore.getState().failScan(payload.jobId, payload.message);
      });
      const cancelledOff = await api.onStorageCleanupCancelled?.((payload) => {
        useStorageCleanupStore.getState().confirmCancelled(payload.jobId, "cleanup_cancelled");
      });
      for (const disposer of [progressOff, completedOff, failedOff, cancelledOff]) {
        if (disposer) disposers.push(disposer);
      }
      if (disposed) {
        while (disposers.length) disposers.pop()?.();
      }
    }
    void wireEvents();
    return () => {
      disposed = true;
      while (disposers.length) disposers.pop()?.();
    };
  }, [api, initialAnalysis, t]);

  useEffect(() => {
    if (initialAnalysis || !api.getActiveAnalysisRun || !api.listAnalysisRuns || !api.onAnalysisRunUpdated) {
      return undefined;
    }
    let disposed = false;
    const disposers: UnlistenFn[] = [];
    void useStorageCleanupStore.getState().hydrateDurable(api);
    async function wireDurableRunEvents() {
      const off = await api.onAnalysisRunUpdated?.((run) => {
        if (!disposed && run.scope.kind === "approved_cleanup_paths") {
          void useStorageCleanupStore.getState().hydrateDurable(api, run.id);
        }
      });
      if (off) disposers.push(off);
      if (disposed) {
        while (disposers.length) disposers.pop()?.();
      }
    }
    void wireDurableRunEvents();
    return () => {
      disposed = true;
      while (disposers.length) disposers.pop()?.();
    };
  }, [api, initialAnalysis]);

  useEffect(() => {
    if (initialAnalysis || !api.getAISettings) {
      setCleanupAIReadiness("");
      return;
    }
    let disposed = false;
    void api.getAISettings()
      .then((settings) => {
        if (disposed) return;
        if (!settings.enabled) {
          setCleanupAIReadiness(t("storageCleanupAIEnableAI"));
        } else if (!settings.cleanupAiEnabled) {
          setCleanupAIReadiness(t("storageCleanupAIEnableCleanup"));
        } else {
          setCleanupAIReadiness("");
        }
      })
      .catch(() => {
        if (!disposed) setCleanupAIReadiness("");
      });
    return () => {
      disposed = true;
    };
  }, [api, initialAnalysis, t]);

  const sortedCandidates = useMemo(() => sortCandidatesBySize(analysis?.candidates ?? []), [analysis]);
  const filteredCandidates = useMemo(
    () => sortedCandidates.filter((candidate) => activeTierFilter === "All" || candidate.tier === activeTierFilter),
    [activeTierFilter, sortedCandidates]
  );
  const tierCounts = useMemo(() => countTiers(sortedCandidates), [sortedCandidates]);
  const selectedCleanupIdsText = [...selectedCleanupIds].join(",");
  const selectedCandidates = sortedCandidates.filter((candidate) => selectedCleanupIds.has(candidate.id));
  const selectedTierCounts = countTiers(selectedCandidates);
  const selectedReclaimable = selectedCandidates
    .reduce((sum, candidate) => sum + candidate.size, 0);
  const deniedCount = analysis?.denied_paths.length ?? 0;
  const warnings = analysis?.warnings ?? [];

  async function chooseScope() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t("storageCleanupChooseScope")
    });
    if (typeof selected === "string" && selected.trim()) {
      useStorageCleanupStore.getState().setSelectedRoots([selected]);
      setLocalError("");
    }
  }

  async function useQuickScope(kind: "downloads" | "desktop" | "documents" | "temp") {
    try {
      const path =
        kind === "downloads"
          ? await downloadDir()
          : kind === "desktop"
            ? await desktopDir()
            : kind === "documents"
              ? await documentDir()
              : await tempDir();
      useStorageCleanupStore.getState().setSelectedRoots([path]);
      setLocalError("");
    } catch (scopeError) {
      reportError(scopeError);
    }
  }

  async function scan() {
    if (!selectedRoots.length) {
      setLocalError(t("storageCleanupScopeRequired"));
      return;
    }
    setLocalError("");
    await useStorageCleanupStore.getState().startScan(api);
  }

  async function cancelScan() {
    await useStorageCleanupStore.getState().cancelScan(api);
  }

  async function reveal(path: string) {
    try {
      await api.revealStorageCandidate(path);
    } catch (revealError) {
      reportError(revealError);
    }
  }

  async function moveSelectedToSafeTrash() {
    if (!selectedCleanupIds.size || isExecuting) return;
    if (!displayedJobId) {
      reportError(t("storageCleanupResultExpired"));
      return;
    }
    setIsExecuting(true);
    setLocalError("");
    try {
      const result: CleanupExecutionResult = await api.moveCleanupCandidatesToSafeTrash(displayedJobId, [...selectedCleanupIds]);
      if (useStorageCleanupStore.getState().displayedJobId !== displayedJobId) return;
      useStorageCleanupStore.getState().setExecutionResult(result);
      setConfirmOpen(false);
      if (!initialAnalysis && selectedRoots.length) {
        await useStorageCleanupStore.getState().startScan(api);
        useStorageCleanupStore.getState().setExecutionResult(result);
      }
    } catch (moveError) {
      reportError(moveError);
    } finally {
      setIsExecuting(false);
    }
  }

  async function analyzeCandidatesWithAI(mode: "all" | "risk" | "selected") {
    if (initialAnalysis || isAnalyzingWithAI || !analysis) return;
    if (!displayedJobId) {
      reportError(t("storageCleanupResultExpired"));
      return;
    }
    const ids = cleanupAIIdsForMode(mode, sortedCandidates, selectedCleanupIds);
    if (!ids.length) {
      reportError(t("storageCleanupAINoTargets"));
      return;
    }
    if (!api.getAISettings || !api.analyzeCleanupCandidatesWithAI) {
      reportError(t("storageCleanupAIUnsupported"));
      return;
    }
    useStorageCleanupStore.getState().setAIAnalyzing(true);
    useStorageCleanupStore.getState().setAICleanupStatus("");
    setLocalError("");
    try {
      const settings = await api.getAISettings();
      ensureCleanupAIReady(settings.enabled, settings.cleanupAiEnabled, settings.provider, settings.apiKey, settings.apiKeyConfigured);
      const candidates = await api.analyzeCleanupCandidatesWithAI(displayedJobId, ids);
      if (useStorageCleanupStore.getState().displayedJobId !== displayedJobId) return;
      useStorageCleanupStore.getState().applyAIAnalyzedCandidates(displayedJobId, candidates);
      const analyzedCounts = countTiers(candidates);
      const message = `${t("storageCleanupAISuccessSummary")
        .replace("{count}", candidates.length.toLocaleString())
        .replace("{safe}", analyzedCounts.Safe.toLocaleString())
        .replace("{review}", analyzedCounts.Review.toLocaleString())
        .replace("{caution}", analyzedCounts.Caution.toLocaleString())}${analyzedCounts.Safe === 0 ? ` ${t("storageCleanupAISuccessNoSafe")}` : ""}`;
      useStorageCleanupStore.getState().setAICleanupStatus(message);
      useAppStore.getState().showSuccess(message);
    } catch (aiError) {
      if (useStorageCleanupStore.getState().displayedJobId !== displayedJobId) return;
      const message = readableCleanupAIError(aiError, t);
      useStorageCleanupStore.getState().setAICleanupStatus(message);
      reportError(message);
    } finally {
      if (useStorageCleanupStore.getState().displayedJobId === displayedJobId) {
        useStorageCleanupStore.getState().setAIAnalyzing(false);
      }
    }
  }

  function toggleSafeCandidate(candidate: StorageCandidate) {
    if (initialAnalysis || !displayedJobId) return;
    if (!selectedCleanupIds.has(candidate.id) && candidate.tier === "Review") {
      setReviewConfirmCandidate(candidate);
      return;
    }
    useStorageCleanupStore.getState().toggleCleanupCandidate(candidate);
  }

  function confirmReviewCandidate() {
    if (!reviewConfirmCandidate) return;
    useStorageCleanupStore.getState().toggleCleanupCandidate(reviewConfirmCandidate);
    setReviewConfirmCandidate(null);
  }

  function reportError(errorValue: unknown) {
    const rawMessage = readableError(errorValue);
    const cleanupMessage = storageCleanupErrorMessage(rawMessage, t);
    const message = cleanupMessage === rawMessage ? localizedStableError(rawMessage, t) : cleanupMessage;
    setLocalError(message);
    onError?.(message);
  }

  return (
    <>
      <div className={cn(pageSurface, "grid content-start gap-4")} data-selected-cleanup-ids={selectedCleanupIdsText}>
        <NoticeBanner tone="info" title={t("storageCleanupChooseScope")}>
          {t("storageCleanupScopeSafetyDesc")}
        </NoticeBanner>

        <section className={cn(contentPanel, "grid gap-3 p-4")}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className={sectionHeading}>{t("storageCleanupCurrentScope")}</h2>
              <p className={sectionDescription}>
                {selectedRoots.length
                  ? selectedRoots.map((root) => t("storageCleanupScopeValue").replace("{path}", root)).join(" / ")
                  : t("storageCleanupNoScopeSelected")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button className={buttonSecondary} onClick={chooseScope}>
                <FolderOpen size={16} />
                <span>{t("storageCleanupChooseFolder")}</span>
              </button>
              <button className={glassButtonPrimary} onClick={scan} disabled={!selectedRoots.length || isScanning}>
                {isScanning ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                <span>{t("storageCleanupScanScope")}</span>
              </button>
              {isScanning && (
                <button
                  className={buttonSecondary}
                  onClick={cancelScan}
                  disabled={scanStatusState === "cancel_requested"}
                >
                  <XCircle size={16} />
                  <span>{t("storageCleanupCancelScan")}</span>
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["downloads", "desktop", "documents", "temp"] as const).map((kind) => (
              <button key={kind} className={buttonSecondary} onClick={() => void useQuickScope(kind)}>
                {quickScopeLabel(kind, t)}
              </button>
            ))}
          </div>
        </section>

        {!initialAnalysis && (
          <DurableAnalysisPanel
            api={api}
            currentRunId={displayedJobIdState ?? activeJobIdState}
          />
        )}

        {isScanning && (
          <NoticeBanner tone="info" title={t("storageCleanupLoading")}>
            <div className="grid gap-1">
              <span>{t("storageCleanupScanningDesc")}</span>
              <span className={metadataText}>
                {t("storageCleanupProgressLine")
                  .replace("{count}", (scanProgress?.scannedEntries ?? 0).toLocaleString())
                  .replace("{size}", formatBytes(scanProgress?.totalSize ?? 0))}
              </span>
              {scanProgress?.currentPath && (
                <span className={quietText} title={scanProgress.currentPath}>
                  {compactPath(scanProgress.currentPath, 110)}
                </span>
              )}
            </div>
          </NoticeBanner>
        )}

        {error && (
          <NoticeBanner tone="danger" title={t("storageCleanupLoadFailed")}>
            {error}
          </NoticeBanner>
        )}

        {!analysis ? (
          <>
            <section className={cn(contentPanel, "grid gap-3 p-4")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className={sectionHeading}>{t("storageCleanupAIPanelTitle")}</h2>
                    <ToneBadge tone="info">{t("storageCleanupAIAnalyzedBadge")}</ToneBadge>
                  </div>
                  <p className={sectionDescription}>{t("storageCleanupAIPanelDesc")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className={buttonSecondary} disabled>
                    <Sparkles size={16} />
                    <span>{t("storageCleanupAIAnalyzeAllShort")}</span>
                  </button>
                  <button className={buttonSecondary} disabled>
                    <Sparkles size={16} />
                    <span>{t("storageCleanupAIAnalyzeRisk")}</span>
                  </button>
                  <button className={buttonSecondary} disabled>
                    <Sparkles size={16} />
                    <span>{t("storageCleanupAIAnalyzeSelected")}</span>
                  </button>
                </div>
              </div>
              <NoticeBanner tone="info">{t("storageCleanupAIScanFirst")}</NoticeBanner>
            </section>
            <StateBlock
              tone="info"
              title={t("storageCleanupChooseScopeEmptyTitle")}
              description={t("storageCleanupChooseScopeEmptyDesc")}
              primaryAction={
                <button className={glassButtonPrimary} onClick={chooseScope}>
                  <FolderOpen size={16} />
                  <span>{t("storageCleanupChooseFolder")}</span>
                </button>
              }
            />
          </>
        ) : (
          <>
            <section className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
              <MetricCard
                label={t("storageCleanupReclaimable")}
                value={formatBytes(analysis.reclaimable_estimate)}
                hint={t("storageCleanupEstimateHint")}
                tone="green"
              />
              <MetricCard
                label={t("storageCleanupReviewEstimate")}
                value={formatBytes(analysis.review_estimate)}
                hint={t("storageCleanupManualReviewHint")}
                tone="amber"
              />
              <MetricCard
                label={t("storageCleanupCautionCount")}
                value={tierCounts.Caution.toLocaleString()}
                hint={t("storageCleanupCautionHint")}
                tone="red"
              />
              <MetricCard
                label={t("storageCleanupDeniedCount")}
                value={deniedCount.toLocaleString()}
                hint={deniedCount > 0 ? t("storageCleanupDeniedLowEstimate") : t("storageCleanupDeniedNone")}
                tone="slate"
              />
            </section>

            {warnings.length > 0 && (
              <NoticeBanner tone="warning" title={t("storageCleanupScopeWarningTitle")}>
                {warnings.join(" ")}
              </NoticeBanner>
            )}

            {deniedCount > 0 && (
              <NoticeBanner tone="warning" title={t("storageCleanupDeniedTitle")}>
                {t("storageCleanupDeniedDesc").replace("{count}", deniedCount.toLocaleString())}
              </NoticeBanner>
            )}

            {executionResult && (
              <NoticeBanner tone={executionResult.failed > 0 ? "warning" : "success"} title={t("storageCleanupExecutionDone")}>
                <div className="grid gap-1">
                  <span>
                    {t("storageCleanupExecutionSummary")
                      .replace("{moved}", executionResult.moved.toLocaleString())
                      .replace("{skipped}", executionResult.skipped.toLocaleString())
                      .replace("{failed}", executionResult.failed.toLocaleString())}
                  </span>
                  <span className={metadataText}>{t("storageCleanupRestoreFromTrash")}</span>
                </div>
              </NoticeBanner>
            )}

            <section className={cn(contentPanel, "grid gap-3 p-4")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className={sectionHeading}>{t("storageCleanupAIPanelTitle")}</h2>
                    <ToneBadge tone="info">{t("storageCleanupAIAnalyzedBadge")}</ToneBadge>
                  </div>
                  <p className={sectionDescription}>{t("storageCleanupAIPanelDesc")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={buttonSecondary}
                    onClick={() => void analyzeCandidatesWithAI("all")}
                    disabled={!displayedJobId || isAnalyzingWithAI || !sortedCandidates.length}
                  >
                    {isAnalyzingWithAI ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    <span>{t("storageCleanupAIAnalyzeAllShort")}</span>
                  </button>
                  <button
                    className={buttonSecondary}
                    onClick={() => void analyzeCandidatesWithAI("risk")}
                    disabled={!displayedJobId || isAnalyzingWithAI || !tierCounts.Review && !tierCounts.Caution}
                  >
                    <Sparkles size={16} />
                    <span>{t("storageCleanupAIAnalyzeRisk")}</span>
                  </button>
                  <button
                    className={buttonSecondary}
                    onClick={() => void analyzeCandidatesWithAI("selected")}
                    disabled={!displayedJobId || isAnalyzingWithAI || !selectedCleanupIds.size}
                  >
                    <Sparkles size={16} />
                    <span>{t("storageCleanupAIAnalyzeSelected")}</span>
                  </button>
                </div>
              </div>
              {!analysis || !sortedCandidates.length ? (
                <NoticeBanner tone="info">{t("storageCleanupAIScanFirst")}</NoticeBanner>
              ) : cleanupAIReadiness ? (
                <NoticeBanner tone="warning">{cleanupAIReadiness}</NoticeBanner>
              ) : isAnalyzingWithAI ? (
                <NoticeBanner tone="info">{t("storageCleanupAIAnalyzing")}</NoticeBanner>
              ) : aiCleanupStatus ? (
                <NoticeBanner tone={aiCleanupStatus.includes("失败") || aiCleanupStatus.includes("failed") ? "warning" : "success"}>
                  {aiCleanupStatus}
                </NoticeBanner>
              ) : (
                <NoticeBanner tone="info">{t("storageCleanupAIReadyHint")}</NoticeBanner>
              )}
            </section>

            <section className={cn(contentPanel, "grid min-h-0 gap-3 p-4")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className={sectionHeading}>{t("storageCleanupTopRanking")}</h2>
                  <p className={sectionDescription}>{t("storageCleanupTopRankingDesc")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={buttonSecondary}
                    onClick={() => void analyzeCandidatesWithAI("all")}
                    disabled={!displayedJobId || isAnalyzingWithAI || !sortedCandidates.length}
                  >
                    {isAnalyzingWithAI ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    <span>{t("storageCleanupAIAnalyzeAll")}</span>
                  </button>
                  <button
                    className={buttonSecondary}
                    onClick={() => void analyzeCandidatesWithAI("risk")}
                    disabled={!displayedJobId || isAnalyzingWithAI || !tierCounts.Review && !tierCounts.Caution}
                  >
                    <Sparkles size={16} />
                    <span>{t("storageCleanupAIAnalyzeRisk")}</span>
                  </button>
                  <button
                    className={buttonSecondary}
                    onClick={() => void analyzeCandidatesWithAI("selected")}
                    disabled={!displayedJobId || isAnalyzingWithAI || !selectedCleanupIds.size}
                  >
                    <Sparkles size={16} />
                    <span>{t("storageCleanupAIAnalyzeSelected")}</span>
                  </button>
                  {FILTERS.map((filter) => (
                    <button
                      key={filter}
                      className={filter === activeTierFilter ? glassButtonPrimary : buttonSecondary}
                      onClick={() => {
                        if (!initialAnalysis) useStorageCleanupStore.getState().setActiveTierFilter(filter);
                      }}
                    >
                      <span>{filterTitle(filter, t)}</span>
                      <span>{filter === "All" ? sortedCandidates.length : tierCounts[filter]}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                {filteredCandidates.length === 0 ? (
                  <StateBlock
                    density="compact"
                    title={t("storageCleanupNoCandidates")}
                    description={t("storageCleanupNoCandidatesDesc")}
                  />
                ) : (
                  <VirtualCandidateList
                    candidates={filteredCandidates}
                    selectedIds={selectedCleanupIds}
                    aiAnalyzedIds={aiAnalyzedCandidateIds}
                    aiDowngradedIds={aiDowngradedCandidateIds}
                    t={t}
                    onToggleSafeCandidate={toggleSafeCandidate}
                    onReveal={reveal}
                  />
                )}
                {!initialAnalysis && analysis?.has_more && (
                  <button className={buttonSecondary} onClick={() => void loadMoreCandidates(api)}>
                    {t("loadMoreFiles").replace(
                      "{count}",
                      Math.max(0, (analysis.candidate_total ?? 0) - analysis.candidates.length).toLocaleString()
                    )}
                  </button>
                )}
              </div>
            </section>

            <footer className={cn(softPanel, "sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 p-3")}>
              <div className="min-w-0">
                <strong className="block text-sm text-[var(--ink)]">
                  已选择 {selectedCleanupIds.size.toLocaleString()} 个清理项
                </strong>
                <span className={quietText}>
                  其中 Safe {selectedTierCounts.Safe.toLocaleString()} 个，Review {selectedTierCounts.Review.toLocaleString()} 个。{" "}
                  {t("storageCleanupSelectedEstimate").replace("{size}", formatBytes(selectedReclaimable))}
                </span>
                {selectedCleanupIds.size === 0 && tierCounts.Review > 0 ? (
                  <span className={cn(quietText, "block")}>当前没有默认可清理的绿色项。Review 项需要你逐个确认后才能加入 Safe Trash。</span>
                ) : selectedCleanupIds.size === 0 && tierCounts.Caution > 0 ? (
                  <span className={cn(quietText, "block")}>谨慎处理项不能直接加入 Safe Trash，请先打开位置人工检查。</span>
                ) : null}
              </div>
              <button
                className={glassButtonPrimary}
                onClick={() => setConfirmOpen(true)}
                disabled={!selectedCleanupIds.size || isExecuting || !displayedJobId || Boolean(mutationUnavailable)}
                title={mutationUnavailable ? t("errorMacosFileMutationSourceBindingUnsupported") : undefined}
              >
                <Trash2 size={17} />
                <span>{t("storageCleanupMoveToSafeTrash")}</span>
              </button>
            </footer>
          </>
        )}
      </div>
      <ConfirmDialog
        open={confirmOpen}
        tone="danger"
        title={t("storageCleanupConfirmSafeTrashTitle")}
        description={t("storageCleanupConfirmSafeTrashDesc")
          .replace("{count}", selectedCleanupIds.size.toLocaleString())
          .replace("{size}", formatBytes(selectedReclaimable))}
        confirmLabel={t("storageCleanupMoveToSafeTrash")}
        cancelLabel={t("cancel")}
        isProcessing={isExecuting}
        disabled={Boolean(mutationUnavailable)}
        onConfirm={moveSelectedToSafeTrash}
        onCancel={() => setConfirmOpen(false)}
      />
      <ConfirmDialog
        open={Boolean(reviewConfirmCandidate)}
        tone="warning"
        title={t("storageCleanupReviewConfirmTitle")}
        description={reviewConfirmCandidate ? `${reviewConfirmCandidate.name}\n${reviewConfirmCandidate.reason}${reviewConfirmCandidate.risk_note ? `\n${reviewConfirmCandidate.risk_note}` : ""}` : undefined}
        emphasis={t("storageCleanupReviewConfirmEmphasis")}
        confirmLabel={t("storageCleanupSelectForTrash")}
        cancelLabel={t("cancel")}
        onConfirm={confirmReviewCandidate}
        onCancel={() => setReviewConfirmCandidate(null)}
      />
    </>
  );
}

function DurableAnalysisPanel({
  api,
  currentRunId
}: {
  api: StorageCleanupApi;
  currentRunId: string | null;
}) {
  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(currentRunId);
  const [run, setRun] = useState<AnalysisRun | null>(null);
  const [detectors, setDetectors] = useState<AnalysisDetector[]>([]);
  const [findings, setFindings] = useState<AnalysisFinding[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [decisionFilter, setDecisionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(null);
  const [evidenceByFinding, setEvidenceByFinding] = useState<Record<string, AnalysisFindingEvidence[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);
  const knownRunRevision = useRef(0);
  const knownDetectorRevisions = useRef(new Map<string, number>());

  const supported = Boolean(api.listAnalysisRuns && api.listAnalysisFindings);

  const loadRuns = useCallback(async () => {
    if (!api.listAnalysisRuns) return;
    try {
      const listed = await api.listAnalysisRuns(20);
      const cleanupRuns = listed.filter((item) => item.scope.kind === "approved_cleanup_paths");
      setRuns(cleanupRuns);
      setSelectedRunId((previous) => {
        if (currentRunId && cleanupRuns.some((item) => item.id === currentRunId)) return currentRunId;
        if (previous && cleanupRuns.some((item) => item.id === previous)) return previous;
        return cleanupRuns[0]?.id ?? null;
      });
    } catch (loadError) {
      setError(readableError(loadError));
    }
  }, [api, currentRunId]);

  const loadFindings = useCallback(async (runId: string, cursor: string | null = null, append = false) => {
    if (!api.listAnalysisFindings) return;
    const requestId = ++requestSequence.current;
    setLoading(true);
    try {
      const page = await api.listAnalysisFindings({
        runId,
        tier: tierFilter === "all" ? undefined : tierFilter,
        category: categoryFilter === "all" ? undefined : categoryFilter,
        decision: decisionFilter === "all" ? undefined : decisionFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
        cursor,
        limit: 30
      });
      if (requestId !== requestSequence.current) return;
      setFindings((previous) => {
        if (!append) return page.findings;
        const existing = new Set(previous.map((finding) => finding.id));
        return [...previous, ...page.findings.filter((finding) => !existing.has(finding.id))];
      });
      setNextCursor(page.nextCursor);
      setError("");
    } catch (loadError) {
      if (requestId === requestSequence.current) setError(readableError(loadError));
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [api, categoryFilter, decisionFilter, statusFilter, tierFilter]);

  const loadRunDetails = useCallback(async (runId: string) => {
    try {
      const [runResult, detectorResult] = await Promise.all([
        api.getAnalysisRun?.(runId),
        api.listAnalysisRunDetectors?.(runId)
      ]);
      if (runResult && runResult.revision >= knownRunRevision.current) {
        knownRunRevision.current = runResult.revision;
        setRun(runResult);
      }
      if (detectorResult) {
        const durableDetectors = detectorResult.filter((detector) => {
          const known = knownDetectorRevisions.current.get(detector.detectorId) ?? 0;
          if (detector.revision < known) return false;
          knownDetectorRevisions.current.set(detector.detectorId, detector.revision);
          return true;
        });
        setDetectors(durableDetectors);
      }
      setError("");
    } catch (loadError) {
      setError(readableError(loadError));
    }
  }, [api]);

  useEffect(() => {
    if (!supported) return;
    void loadRuns();
  }, [loadRuns, supported]);

  useEffect(() => {
    if (!selectedRunId) {
      setRun(null);
      setDetectors([]);
      setFindings([]);
      setNextCursor(null);
      return;
    }
    void loadRunDetails(selectedRunId);
    void loadFindings(selectedRunId);
  }, [loadFindings, loadRunDetails, selectedRunId]);

  useEffect(() => {
    if (!api.onAnalysisRunUpdated) return undefined;
    let disposed = false;
    let disposer: (() => void) | undefined;
    const handleRunEvent = (updatedRun: AnalysisRun) => {
      if (disposed || updatedRun.scope.kind !== "approved_cleanup_paths") return;
      void loadRuns();
      if (!selectedRunId || updatedRun.id !== selectedRunId) return;
      const known = knownRunRevision.current;
      if (updatedRun.revision <= known) return;
      if (known > 0 && updatedRun.revision > known + 1) {
        void loadRunDetails(updatedRun.id);
        void loadFindings(updatedRun.id);
        void useStorageCleanupStore.getState().hydrateDurable(api, updatedRun.id);
        return;
      }
      knownRunRevision.current = updatedRun.revision;
      setRun(updatedRun);
      setRuns((previous) => previous.map((item) => item.id === updatedRun.id ? updatedRun : item));
      void loadFindings(updatedRun.id);
    };
    async function subscribe() {
      const off = await api.onAnalysisRunUpdated?.(handleRunEvent);
      disposer = off;
      if (disposed) disposer?.();
    }
    void subscribe();
    return () => {
      disposed = true;
      disposer?.();
    };
  }, [api, loadFindings, loadRunDetails, loadRuns, selectedRunId]);

  useEffect(() => {
    knownRunRevision.current = 0;
    knownDetectorRevisions.current.clear();
  }, [selectedRunId]);

  useEffect(() => {
    if (!selectedRunId || !api.onAnalysisFindingsPublished) return undefined;
    let disposed = false;
    let disposer: (() => void) | undefined;
    const handlePublishedEvent = (updatedRun: AnalysisRun) => {
      if (disposed || updatedRun.id !== selectedRunId) return;
      const known = knownRunRevision.current;
      if (updatedRun.revision <= known) return;
      if (known > 0 && updatedRun.revision > known + 1) {
        void loadRunDetails(updatedRun.id);
        void loadFindings(updatedRun.id);
        void useStorageCleanupStore.getState().hydrateDurable(api, updatedRun.id);
        return;
      }
      knownRunRevision.current = updatedRun.revision;
      setRun(updatedRun);
      setRuns((previous) => previous.map((item) => item.id === updatedRun.id ? updatedRun : item));
      void loadFindings(updatedRun.id);
    };
    void api.onAnalysisFindingsPublished(handlePublishedEvent).then((off) => {
      disposer = off;
      if (disposed) disposer();
    });
    return () => {
      disposed = true;
      disposer?.();
    };
  }, [api, loadFindings, selectedRunId]);

  useEffect(() => {
    if (!selectedRunId || !api.onAnalysisDetectorUpdated) return undefined;
    let disposed = false;
    let disposer: (() => void) | undefined;
    void api.onAnalysisDetectorUpdated((detector) => {
      if (disposed || detector.runId !== selectedRunId) return;
      const known = knownDetectorRevisions.current.get(detector.detectorId) ?? 0;
      if (detector.revision <= known) return;
      if (known > 0 && detector.revision > known + 1) {
        void loadRunDetails(selectedRunId);
        return;
      }
      knownDetectorRevisions.current.set(detector.detectorId, detector.revision);
      setDetectors((previous) => {
        const found = previous.some((item) => item.detectorId === detector.detectorId);
        return found
          ? previous.map((item) => item.detectorId === detector.detectorId ? detector : item)
          : [...previous, detector];
      });
    }).then((off) => {
      disposer = off;
      if (disposed) disposer();
    });
    return () => {
      disposed = true;
      disposer?.();
    };
  }, [api, loadRunDetails, selectedRunId]);

  if (!supported) return null;

  async function chooseRun(runId: string) {
    setSelectedRunId(runId);
    await useStorageCleanupStore.getState().hydrateDurable(api, runId);
  }

  async function changeRun(action: "cancel" | "retry") {
    if (!selectedRunId) return;
    const method = action === "cancel" ? api.cancelAnalysisRun : api.retryAnalysisRun;
    if (!method) return;
    try {
      const next = await method(selectedRunId);
      knownRunRevision.current = next.revision;
      setRun(next);
      setRuns((previous) => [next, ...previous.filter((item) => item.id !== next.id)].slice(0, 20));
      if (action === "retry") await chooseRun(next.id);
    } catch (runError) {
      setError(readableError(runError));
    }
  }

  async function toggleEvidence(finding: AnalysisFinding) {
    if (expandedFindingId === finding.id) {
      setExpandedFindingId(null);
      return;
    }
    setExpandedFindingId(finding.id);
    if (!api.listAnalysisFindingEvidence || evidenceByFinding[finding.id]) return;
    try {
      const evidence = await api.listAnalysisFindingEvidence(finding.id);
      setEvidenceByFinding((previous) => ({ ...previous, [finding.id]: evidence }));
    } catch (evidenceError) {
      setError(readableError(evidenceError));
    }
  }

  async function updateDecision(
    finding: AnalysisFinding,
    decision: "open" | "acknowledged" | "dismissed" | "snoozed"
  ) {
    if (!api.setAnalysisFindingDecision || !selectedRunId) return;
    try {
      await api.setAnalysisFindingDecision({
        findingKey: finding.findingKey,
        decision,
        snoozedUntil: decision === "snoozed" ? Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 : null,
        expectedRevision: finding.decisionRevision ?? 0
      });
      await loadFindings(selectedRunId);
    } catch (decisionError) {
      setError(readableError(decisionError));
    }
  }

  async function revalidate(finding: AnalysisFinding) {
    if (!api.revalidateAnalysisFinding || !selectedRunId) return;
    try {
      await api.revalidateAnalysisFinding(finding.id);
      await loadFindings(selectedRunId);
    } catch (revalidateError) {
      setError(readableError(revalidateError));
    }
  }

  return (
    <section className={cn(contentPanel, "grid gap-3 p-4")} data-analysis-ledger>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={sectionHeading}>Durable Analysis / Findings</h2>
            {run && <ToneBadge tone={analysisRunTone(run.status)}>{run.status}</ToneBadge>}
          </div>
          <p className={sectionDescription}>
            SQLite durable runs, detector progress, evidence and review decisions; findings never authorize a mutation by themselves.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {run && ["queued", "running", "cancelling"].includes(run.status) && api.cancelAnalysisRun && (
            <button className={buttonSecondary} onClick={() => void changeRun("cancel")}>Cancel run</button>
          )}
          {run && ["completed_with_warnings", "failed", "interrupted", "cancelled"].includes(run.status) && api.retryAnalysisRun && (
            <button className={buttonSecondary} onClick={() => void changeRun("retry")}>Retry run</button>
          )}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(190px,0.35fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-2">
          <span className={metadataText}>Recent cleanup runs</span>
          {runs.length === 0 ? (
            <span className={quietText}>No durable cleanup run has been recorded.</span>
          ) : runs.slice(0, 8).map((item) => (
            <button
              key={item.id}
              className={cn(
                buttonSecondary,
                "justify-between text-left",
                item.id === selectedRunId && "border-[var(--accent)] bg-[var(--accent-soft)]"
              )}
              onClick={() => void chooseRun(item.id)}
            >
              <span className="min-w-0 truncate">{item.id}</span>
              <ToneBadge tone={analysisRunTone(item.status)}>{item.status}</ToneBadge>
            </button>
          ))}
        </div>

        <div className="grid gap-3">
          {run && (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2">
              <MetricCard label="Phase" value={run.phase} hint={`revision ${run.revision}`} tone="blue" />
              <MetricCard label="Safe" value={run.safeCount} hint={formatBytes(run.exactReclaimableBytes)} tone="green" />
              <MetricCard label="Review" value={run.reviewCount} hint={formatBytes(run.potentialReclaimableBytes)} tone="amber" />
              <MetricCard label="Caution" value={run.cautionCount} hint="never executable" tone="red" />
            </div>
          )}
          {detectors.length > 0 && (
            <div className="grid gap-2">
              <span className={metadataText}>Detector progress</span>
              {detectors.map((detector) => (
                <div key={detector.detectorId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-sm">
                  <span>{detector.detectorId}</span>
                  <span className={quietText}>{detector.status} · {detector.findingsPublished.toLocaleString()} published</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedRunId && (
        <>
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3">
            <span className={metadataText}>Finding filters</span>
            <select className={buttonSecondary} value={tierFilter} onChange={(event) => setTierFilter(event.target.value)}>
              <option value="all">All tiers</option>
              <option value="safe">Safe</option>
              <option value="review">Review</option>
              <option value="caution">Caution</option>
            </select>
            <select className={buttonSecondary} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">All categories</option>
              <option value="duplicate_group">Duplicate group</option>
              <option value="large_file">Large file</option>
              <option value="large_directory">Large directory</option>
              <option value="temp_cache">Cleanup heuristic</option>
            </select>
            <select className={buttonSecondary} value={decisionFilter} onChange={(event) => setDecisionFilter(event.target.value)}>
              <option value="all">All decisions</option>
              <option value="open">Open</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="dismissed">Dismissed</option>
              <option value="snoozed">Snoozed</option>
            </select>
            <select className={buttonSecondary} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="active">Active</option>
              <option value="stale">Stale</option>
              <option value="all">All statuses</option>
            </select>
          </div>

          {error && <NoticeBanner tone="warning">{error}</NoticeBanner>}
          {loading && <NoticeBanner tone="info">Loading durable findings…</NoticeBanner>}
          {!loading && findings.length === 0 ? (
            <StateBlock density="compact" tone="info" title="No findings for this run" description="Change the filters or run the approved cleanup analysis again." />
          ) : (
            <div className="grid gap-2">
              {findings.map((finding) => {
                const evidence = evidenceByFinding[finding.id] ?? [];
                const expanded = expandedFindingId === finding.id;
                return (
                  <article key={finding.id} className="grid gap-2 rounded-xl border border-[var(--line)] p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-sm text-[var(--ink)]">{finding.title}</strong>
                          <ToneBadge tone={analysisFindingTone(finding.tier)}>{finding.tier}</ToneBadge>
                          {finding.status !== "active" && <ToneBadge tone="warning">{finding.status}</ToneBadge>}
                          {finding.decision && <ToneBadge tone="slate">{finding.decision}</ToneBadge>}
                        </div>
                        <p className={cn(quietText, "mt-1")}>{finding.reason}</p>
                        {finding.pathSnapshot && <p className={cn(quietText, "truncate")} title={finding.pathSnapshot}>{compactPath(finding.pathSnapshot, 120)}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {finding.pathSnapshot && api.revealStorageCandidate && (
                          <button className={buttonSecondary} onClick={() => void api.revealStorageCandidate?.(finding.pathSnapshot!)}>Reveal</button>
                        )}
                        <button className={buttonSecondary} onClick={() => void toggleEvidence(finding)}>{expanded ? "Hide evidence" : "Evidence"}</button>
                        {finding.status === "stale" && api.revalidateAnalysisFinding && (
                          <button className={buttonSecondary} onClick={() => void revalidate(finding)}>Revalidate</button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--ink-muted)]">
                      <span>Detector: {finding.detectorId}</span>
                      <span>Action: {finding.actionKind}</span>
                      <span>Exact: {formatBytes(finding.exactReclaimableBytes ?? 0)}</span>
                      <span>Potential: {formatBytes(finding.potentialReclaimableBytes)}</span>
                      {finding.category === "duplicate_group" && <span>Read-only duplicate group</span>}
                    </div>
                    {api.setAnalysisFindingDecision && (
                      <div className="flex flex-wrap gap-2">
                        <button className={buttonSecondary} onClick={() => void updateDecision(finding, "acknowledged")}>Acknowledge</button>
                        <button className={buttonSecondary} onClick={() => void updateDecision(finding, "dismissed")}>Dismiss</button>
                        <button className={buttonSecondary} onClick={() => void updateDecision(finding, "snoozed")}>Snooze 7d</button>
                        {finding.decision && <button className={buttonSecondary} onClick={() => void updateDecision(finding, "open")}>Reopen</button>}
                      </div>
                    )}
                    {expanded && (
                      <div className="grid gap-1 rounded-lg bg-[var(--surface-muted)] p-3 text-xs">
                        <span>Identity: {finding.identitySnapshot ? JSON.stringify(finding.identitySnapshot) : "unknown"}</span>
                        <span>Source revision: {finding.revision}</span>
                        {evidence.map((item) => (
                          <span key={item.id}>{item.evidenceKind === "ai_assessment" ? "AI assessment" : item.evidenceKind}: {JSON.stringify(item.value)}</span>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
              {nextCursor && (
                <button className={buttonSecondary} onClick={() => void loadFindings(selectedRunId, nextCursor, true)} disabled={loading}>
                  Load more findings
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function VirtualCandidateList({
  candidates,
  selectedIds,
  aiAnalyzedIds,
  aiDowngradedIds,
  t,
  onToggleSafeCandidate,
  onReveal
}: {
  candidates: StorageCandidate[];
  selectedIds: Set<string>;
  aiAnalyzedIds: Set<string>;
  aiDowngradedIds: Set<string>;
  t: Translator;
  onToggleSafeCandidate: (candidate: StorageCandidate) => void;
  onReveal: (path: string) => void;
}) {
  if (candidates.length <= 20) {
    return (
      <div className="grid gap-3">
        {candidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            selected={selectedIds.has(candidate.id)}
            aiAnalyzed={aiAnalyzedIds.has(candidate.id)}
            aiDowngraded={aiDowngradedIds.has(candidate.id)}
            t={t}
            onToggleSafeCandidate={onToggleSafeCandidate}
            onReveal={onReveal}
          />
        ))}
      </div>
    );
  }
  return <VirtualizedCandidateRows {...{ candidates, selectedIds, aiAnalyzedIds, aiDowngradedIds, t, onToggleSafeCandidate, onReveal }} />;
}

function VirtualizedCandidateRows({
  candidates,
  selectedIds,
  aiAnalyzedIds,
  aiDowngradedIds,
  t,
  onToggleSafeCandidate,
  onReveal
}: {
  candidates: StorageCandidate[];
  selectedIds: Set<string>;
  aiAnalyzedIds: Set<string>;
  aiDowngradedIds: Set<string>;
  t: Translator;
  onToggleSafeCandidate: (candidate: StorageCandidate) => void;
  onReveal: (path: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: candidates.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 230,
    overscan: 5
  });
  return (
    <div ref={scrollRef} className="max-h-[min(56vh,540px)] overflow-auto pr-1" role="list">
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const candidate = candidates[virtualRow.index];
          return (
            <div
              key={candidate.id}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              className="absolute left-0 top-0 w-full pb-3"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
              role="listitem"
            >
              <CandidateCard
                candidate={candidate}
                selected={selectedIds.has(candidate.id)}
                aiAnalyzed={aiAnalyzedIds.has(candidate.id)}
                aiDowngraded={aiDowngradedIds.has(candidate.id)}
                t={t}
                onToggleSafeCandidate={onToggleSafeCandidate}
                onReveal={onReveal}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CandidateCard({
  candidate,
  selected,
  aiAnalyzed,
  aiDowngraded,
  t,
  onToggleSafeCandidate,
  onReveal
}: {
  candidate: StorageCandidate;
  selected: boolean;
  aiAnalyzed: boolean;
  aiDowngraded: boolean;
  t: Translator;
  onToggleSafeCandidate: (candidate: StorageCandidate) => void;
  onReveal: (path: string) => void;
}) {
  const selectable = canManuallySelectForCleanup(candidate);
  const disabledReason = cleanupSelectionDisabledReason(candidate);
  return (
    <article className={cn(softPanel, "grid gap-3 p-3")} data-candidate-id={candidate.id}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <strong className="block truncate text-sm text-[var(--ink)]">{candidate.name}</strong>
          <span className={quietText} title={candidate.path}>{compactPath(candidate.path, 108)}</span>
        </div>
        <ToneBadge tone={tierTone(candidate.tier)}>{formatBytes(candidate.size)}</ToneBadge>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <ToneBadge tone="slate">{candidate.category}</ToneBadge>
        <TierBadge tier={candidate.tier} t={t} />
        {aiAnalyzed && <ToneBadge tone="blue">{t("storageCleanupAIAnalyzedBadge")}</ToneBadge>}
        {selectable && <ToneBadge tone="green">{t("storageCleanupCanMoveToTrash")}</ToneBadge>}
        <ToneBadge tone={candidate.trash_allowed ? "green" : "slate"}>
          {candidate.trash_allowed ? t("storageCleanupTrashAllowed") : t("storageCleanupTrashBlocked")}
        </ToneBadge>
        <ToneBadge tone={candidate.selected_by_default ? "green" : "slate"}>
          {candidate.selected_by_default ? t("storageCleanupSelectedByDefault") : t("storageCleanupNotSelectedByDefault")}
        </ToneBadge>
      </div>
      <div className="grid gap-1">
        <p className={metadataText}>
          {aiAnalyzed ? `${t("storageCleanupAIReasonLabel")}：` : ""}
          {candidate.reason}
        </p>
        {candidate.risk_note && (
          <p className={quietText}>
            {aiAnalyzed ? `${t("storageCleanupAIRiskNoteLabel")}：` : ""}
            {candidate.risk_note}
          </p>
        )}
        {aiDowngraded && (
          <p className="text-xs font-medium text-[var(--warning)]">{t("storageCleanupAIDowngraded")}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {selectable && (
          <button
            className={selected ? glassButtonPrimary : buttonSecondary}
            onClick={() => onToggleSafeCandidate(candidate)}
            aria-pressed={selected}
          >
            <CheckCircle2 size={16} />
            <span>{selected ? t("storageCleanupSelected") : t("storageCleanupSelectForTrash")}</span>
          </button>
        )}
        <IconButton
          aria-label={t("storageCleanupReveal")}
          title={t("storageCleanupReveal")}
          onClick={() => onReveal(candidate.path)}
        >
          <FolderOpen size={16} />
        </IconButton>
        {candidate.tier === "Caution" && (
          <button className={buttonSecondary} onClick={() => onReveal(candidate.path)}>
            <HelpCircle size={16} />
            <span>{t("storageCleanupViewAdvice")}</span>
          </button>
        )}
      </div>
      {!selectable && disabledReason ? (
        <p className={quietText}>{disabledReason}</p>
      ) : candidate.tier === "Review" ? (
        <p className={quietText}>需要人工确认后才能加入 Safe Trash。</p>
      ) : null}
    </article>
  );
}

function TierBadge({ tier, t }: { tier: CleanupTier; t: Translator }) {
  const Icon = tier === "Safe" ? CheckCircle2 : tier === "Review" ? AlertTriangle : ShieldAlert;
  return (
    <ToneBadge tone={tierTone(tier)}>
      <span className="inline-flex items-center gap-1">
        <Icon size={13} />
        <span>{filterTitle(tier, t)}</span>
      </span>
    </ToneBadge>
  );
}

function cleanupAIIdsForMode(
  mode: "all" | "risk" | "selected",
  candidates: StorageCandidate[],
  selectedCleanupIds: Set<string>
) {
  if (mode === "selected") return [...selectedCleanupIds];
  return candidates
    .filter((candidate) => mode === "all" || candidate.tier === "Review" || candidate.tier === "Caution")
    .map((candidate) => candidate.id);
}

function ensureCleanupAIReady(
  enabled: boolean,
  cleanupAiEnabled: boolean,
  provider: string,
  apiKey: string,
  apiKeyConfigured?: boolean
) {
  if (!enabled) {
    throw new Error("ai_disabled");
  }
  if (!cleanupAiEnabled) {
    throw new Error("ai_cleanup_disabled");
  }
  if (provider !== "ollama" && !apiKey.trim() && !apiKeyConfigured) {
    throw new Error("ai_api_key_missing");
  }
}

function readableCleanupAIError(error: unknown, t: Translator) {
  const message = readableError(error);
  const normalized = message.toLowerCase();
  if (message === "ai_disabled" || message.includes("AI 未启用") || message.includes("启用 AI")) {
    return t("storageCleanupAIEnableAI");
  }
  if (message === "ai_cleanup_disabled" || message.includes("AI 空间清理分析") || message.includes("AI 清理分析")) {
    return t("storageCleanupAIEnableCleanup");
  }
  if (message === "ai_api_key_missing" || message.includes("API Key 缺失") || message.includes("当前模型服务需要 API Key")) {
    return t("storageCleanupAIErrorMissingKey");
  }
  if (message.includes("模型返回") || message.includes("Zen Canvas 需要的 JSON")) {
    return withCleanupProviderDetail(t("storageCleanupAIErrorInvalidResponse"), message);
  }
  if (isCleanupRateLimitError(normalized)) {
    return withCleanupProviderDetail(t("storageCleanupAIErrorRateLimit"), message);
  }
  if (isCleanupTimeoutError(normalized)) {
    return withCleanupProviderDetail(t("storageCleanupAIErrorTimeout"), message);
  }
  if (isCleanupHttpStatus(normalized, 400)) {
    return withCleanupProviderDetail(t("storageCleanupAIErrorBadRequest"), message);
  }
  if (isCleanupHttpStatus(normalized, 401) || isCleanupHttpStatus(normalized, 403)) {
    return withCleanupProviderDetail(t("storageCleanupAIErrorAuth"), message);
  }
  if (hasCleanupProviderDetail(normalized)) return message;
  if (normalized.includes("request failed") || normalized.includes("ollama") || normalized.includes("network")) {
    return withCleanupProviderDetail(t("storageCleanupAIErrorNetwork"), message);
  }
  if (normalized.includes("invalid json") || normalized.includes("not valid json") || normalized.includes("json")) {
    return withCleanupProviderDetail(t("storageCleanupAIErrorInvalidResponse"), message);
  }
  if (
    normalized.includes("unsupported value") ||
    normalized.includes("safety") ||
    message.includes("安全") ||
    message.includes("校验")
  ) {
    return withCleanupProviderDetail(t("storageCleanupAIErrorUnsafeResult"), message);
  }
  return message;
}

function isCleanupHttpStatus(normalized: string, status: number) {
  const text = String(status);
  return normalized.includes(`http ${text}`)
    || normalized.includes(`http status ${text}`)
    || normalized.includes(`status ${text}`)
    || normalized.includes(`status=${text}`);
}

function isCleanupRateLimitError(normalized: string) {
  return isCleanupHttpStatus(normalized, 429)
    || normalized.includes("rate limit")
    || normalized.includes("too many request");
}

function isCleanupTimeoutError(normalized: string) {
  return normalized.includes("timeout") || normalized.includes("timed out");
}

function hasCleanupProviderDetail(normalized: string) {
  return normalized.includes("http ")
    || normalized.includes("http status")
    || normalized.includes("status ")
    || normalized.includes("batch ")
    || normalized.includes("provider response summary")
    || normalized.includes("provider error:")
    || normalized.includes("rate limit");
}

function withCleanupProviderDetail(summary: string, detail: string) {
  return detail.includes(summary) ? detail : `${summary}\n${detail}`;
}

function sortCandidatesBySize(candidates: StorageCandidate[]) {
  return [...candidates].sort((left, right) => right.size - left.size || left.path.localeCompare(right.path));
}

function countTiers(candidates: StorageCandidate[]) {
  return candidates.reduce<Record<CleanupTier, number>>(
    (counts, candidate) => {
      counts[candidate.tier] += 1;
      return counts;
    },
    { Safe: 0, Review: 0, Caution: 0 }
  );
}

function quickScopeLabel(kind: "downloads" | "desktop" | "documents" | "temp", t: Translator) {
  if (kind === "downloads") return t("storageCleanupQuickDownloads");
  if (kind === "desktop") return t("storageCleanupQuickDesktop");
  if (kind === "documents") return t("storageCleanupQuickDocuments");
  return t("storageCleanupQuickTemp");
}

function tierTone(tier: CleanupTier): "green" | "amber" | "red" {
  if (tier === "Safe") return "green";
  if (tier === "Review") return "amber";
  return "red";
}

function filterTitle(filter: CleanupTier | "All", t: Translator) {
  if (filter === "All") return t("storageCleanupAllFilter");
  if (filter === "Safe") return t("storageCleanupSafeTier");
  if (filter === "Review") return t("storageCleanupReviewTier");
  return t("storageCleanupCautionTier");
}

function analysisRunTone(status: string): "green" | "amber" | "red" | "slate" | "blue" {
  if (status === "completed") return "green";
  if (status === "completed_with_warnings" || status === "cancelling") return "amber";
  if (status === "failed" || status === "interrupted") return "red";
  if (status === "cancelled") return "slate";
  return "blue";
}

function analysisFindingTone(tier: string): "green" | "amber" | "red" | "slate" {
  if (tier === "safe") return "green";
  if (tier === "review") return "amber";
  if (tier === "caution") return "red";
  return "slate";
}
