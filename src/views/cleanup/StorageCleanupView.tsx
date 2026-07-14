import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { desktopDir, documentDir, downloadDir, tempDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
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
  useStorageCleanupStore
} from "../../store/useStorageCleanupStore";
import type {
  CleanupExecutionResult,
  CleanupTier,
  StorageAnalysis,
  StorageCandidate
} from "../../types/domain";
import type { Translator } from "../../types/ui";
import { formatBytes } from "../../utils/format";
import { compactPath, readableError } from "../../utils/viewHelpers";
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
      | "scanStorageCleanup"
      | "onStorageCleanupProgress"
      | "onStorageCleanupCompleted"
      | "onStorageCleanupFailed"
      | "onStorageCleanupCancelled"
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
  const store = useStorageCleanupStore();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reviewConfirmCandidate, setReviewConfirmCandidate] = useState<StorageCandidate | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const analysis = initialAnalysis ?? store.analysis;
  const selectedRoots = initialRoots ?? store.selectedRoots;
  const selectedCleanupIds = initialAnalysis
    ? new Set(defaultSelectedCleanupIds(initialAnalysis))
    : store.selectedCleanupIds;
  const activeTierFilter = initialAnalysis ? "All" : store.activeTierFilter;
  const isScanning = !initialAnalysis && store.isScanning;
  const scanProgress = !initialAnalysis ? store.scanProgress : null;
  const executionResult = !initialAnalysis ? store.executionResult : null;
  const scanError = !initialAnalysis ? store.scanError : "";
  const aiCleanupStatus = !initialAnalysis ? store.aiCleanupStatus : "";
  const isAnalyzingWithAI = !initialAnalysis && store.isAnalyzingWithAI;
  const loadMoreCandidates = store.loadMoreCandidates;
  const aiAnalyzedCandidateIds = !initialAnalysis ? store.aiAnalyzedCandidateIds : new Set<string>();
  const aiDowngradedCandidateIds = !initialAnalysis ? store.aiDowngradedCandidateIds : new Set<string>();
  const [localError, setLocalError] = useState("");
  const [cleanupAIReadiness, setCleanupAIReadiness] = useState("");
  const error = localError || scanError;

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
        useStorageCleanupStore.getState().failScan(payload.jobId, t("scanCanceled"));
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
    setIsExecuting(true);
    setLocalError("");
    try {
      const result: CleanupExecutionResult = await api.moveCleanupCandidatesToSafeTrash([...selectedCleanupIds]);
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
      const candidates = await api.analyzeCleanupCandidatesWithAI(ids);
      useStorageCleanupStore.getState().applyAIAnalyzedCandidates(candidates);
      const analyzedCounts = countTiers(candidates);
      const message = `AI 已分析 ${candidates.length.toLocaleString()} 个候选：可安全清理 ${analyzedCounts.Safe.toLocaleString()} 个，需要人工判断 ${analyzedCounts.Review.toLocaleString()} 个，谨慎处理 ${analyzedCounts.Caution.toLocaleString()} 个。${analyzedCounts.Safe === 0 ? " AI 未发现可自动加入清理清单的项目。请查看 Review 项的风险说明，人工确认后再加入 Safe Trash。" : ""}`;
      useStorageCleanupStore.getState().setAICleanupStatus(message);
      useAppStore.getState().showSuccess(message);
    } catch (aiError) {
      const message = readableCleanupAIError(aiError);
      useStorageCleanupStore.getState().setAICleanupStatus(message);
      reportError(message);
    } finally {
      useStorageCleanupStore.getState().setAIAnalyzing(false);
    }
  }

  function toggleSafeCandidate(candidate: StorageCandidate) {
    if (initialAnalysis) return;
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
    const message = readableError(errorValue);
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
                <button className={buttonSecondary} onClick={cancelScan}>
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
                    disabled={Boolean(initialAnalysis) || isAnalyzingWithAI || !sortedCandidates.length}
                  >
                    {isAnalyzingWithAI ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    <span>{t("storageCleanupAIAnalyzeAllShort")}</span>
                  </button>
                  <button
                    className={buttonSecondary}
                    onClick={() => void analyzeCandidatesWithAI("risk")}
                    disabled={Boolean(initialAnalysis) || isAnalyzingWithAI || !tierCounts.Review && !tierCounts.Caution}
                  >
                    <Sparkles size={16} />
                    <span>{t("storageCleanupAIAnalyzeRisk")}</span>
                  </button>
                  <button
                    className={buttonSecondary}
                    onClick={() => void analyzeCandidatesWithAI("selected")}
                    disabled={Boolean(initialAnalysis) || isAnalyzingWithAI || !selectedCleanupIds.size}
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
                    disabled={Boolean(initialAnalysis) || isAnalyzingWithAI || !sortedCandidates.length}
                  >
                    {isAnalyzingWithAI ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    <span>{t("storageCleanupAIAnalyzeAll")}</span>
                  </button>
                  <button
                    className={buttonSecondary}
                    onClick={() => void analyzeCandidatesWithAI("risk")}
                    disabled={Boolean(initialAnalysis) || isAnalyzingWithAI || !tierCounts.Review && !tierCounts.Caution}
                  >
                    <Sparkles size={16} />
                    <span>{t("storageCleanupAIAnalyzeRisk")}</span>
                  </button>
                  <button
                    className={buttonSecondary}
                    onClick={() => void analyzeCandidatesWithAI("selected")}
                    disabled={Boolean(initialAnalysis) || isAnalyzingWithAI || !selectedCleanupIds.size}
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
                disabled={!selectedCleanupIds.size || isExecuting || Boolean(initialAnalysis)}
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
    throw new Error("请先在设置中启用 AI。");
  }
  if (!cleanupAiEnabled) {
    throw new Error("请开启 AI 空间清理分析。");
  }
  if (provider !== "ollama" && !apiKey.trim() && !apiKeyConfigured) {
    throw new Error("当前模型服务需要 API Key，请在 AI 设置中填写。");
  }
}

function readableCleanupAIError(error: unknown) {
  const message = readableError(error);
  const normalized = message.toLowerCase();
  if (message.includes("模型返回") || message.includes("Zen Canvas 需要的 JSON")) return message;
  if (message.includes("AI 空间清理分析") || message.includes("AI 清理分析")) return "请开启 AI 空间清理分析。";
  if (message.includes("AI 未启用") || message.includes("启用 AI")) return "请先在设置中启用 AI。";
  if (isCleanupRateLimitError(normalized)) {
    return withCleanupProviderDetail("模型服务请求过快或达到限流，请减少本次处理数量或稍后重试。", message);
  }
  if (isCleanupTimeoutError(normalized)) {
    return withCleanupProviderDetail("模型请求超时，请减少本次处理数量、稍后重试，或改用更稳定的模型。", message);
  }
  if (isCleanupHttpStatus(normalized, 400)) {
    return withCleanupProviderDetail("模型服务拒绝了请求参数，请检查 AI 服务配置后重试。", message);
  }
  if (isCleanupHttpStatus(normalized, 401) || isCleanupHttpStatus(normalized, 403)) {
    return withCleanupProviderDetail("模型服务认证或权限失败，请检查 API Key 和模型权限。", message);
  }
  if (message.includes("API Key 缺失") || message.includes("当前模型服务需要 API Key")) return "当前模型服务需要 API Key，请在 AI 设置中填写。";
  if (hasCleanupProviderDetail(normalized)) return message;
  if (normalized.includes("request failed") || normalized.includes("ollama") || normalized.includes("network")) return "无法连接到模型服务，请检查 Base URL、Chat Path、网络和 API Key。";
  if (normalized.includes("invalid json") || normalized.includes("not valid json") || normalized.includes("json")) {
    return "模型没有返回有效结果，请换用更稳定的模型或稍后重试。";
  }
  if (
    normalized.includes("unsupported value") ||
    normalized.includes("safety") ||
    message.includes("安全") ||
    message.includes("校验")
  ) {
    return "AI 返回了不安全的路径或操作，Zen Canvas 已拒绝应用该结果。";
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
