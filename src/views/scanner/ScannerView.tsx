import { useEffect, useState } from "react";
import { tauriApi, type ScanRootDto } from "../../api/tauriApi";
import { requestSettingsSection } from "../../components/spotlight/commandRegistry";
import { useChromeContext } from "../../contexts/AppContexts";
import { useBackgroundIndexerStore } from "../../store/useBackgroundIndexerStore";
import { useFileLibraryStore } from "../../store/useFileLibraryStore";
import { useOrganizationPlanStore } from "../../store/useOrganizationPlanStore";
import { useOperationQueueStore } from "../../store/useOperationQueueStore";
import { useScanManagerStore } from "../../store/useScanManagerStore";
import { cn } from "../../utils/tw";
import { summarizeWatcherHealth } from "../../utils/watcherPresentation";
import { pageSurface } from "../shared/ui";
import { OverviewPriorityTask } from "../overview/OverviewPriorityTask";
import { ScanTaskPanel } from "../overview/ScanTaskPanel";
import { ScanCancelDialog } from "../overview/ScanCancelDialog";
import {
  OverviewBackgroundTaskList,
  OverviewRecentActivityList,
  OverviewSpaceSummary,
  OverviewSystemCoverage,
  type OverviewSystemCoverageModel
} from "../overview/OverviewSections";
import {
  buildOverviewSummary,
  deriveOverviewScanState,
  selectOverviewBackgroundTasks,
  selectOverviewPriorityTask,
  selectRecentOverviewActivity,
  type OverviewHealthSnapshot,
  type OverviewPriorityTaskModel
} from "../overview/overviewModel";

export function ScannerView() {
  const { setView, t, language } = useChromeContext();
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const scope = useFileLibraryStore((state) => state.scope);
  const stats = useFileLibraryStore((state) => state.stats);
  const isClassifyingWithAI = useFileLibraryStore((state) => state.isClassifyingWithAI);
  const aiClassificationProgress = useFileLibraryStore((state) => state.aiClassificationProgress);
  const selectedFolders = useScanManagerStore((state) => state.selectedFolders);
  const isScanning = useScanManagerStore((state) => state.isScanning);
  const isCancelingScan = useScanManagerStore((state) => state.isCancelingScan);
  const scanState = useScanManagerStore((state) => state.scanState);
  const handleChooseFolders = useScanManagerStore((state) => state.handleChooseFolders);
  const handleScan = useScanManagerStore((state) => state.handleScan);
  const cancelScan = useScanManagerStore((state) => state.cancelScan);
  const operationLogs = useOperationQueueStore((state) => state.operationLogs);
  const operationProgress = useOperationQueueStore((state) => state.operationProgress);
  const pendingRoots = useBackgroundIndexerStore((state) => state.pendingRoots);
  const currentBackgroundRoot = useBackgroundIndexerStore((state) => state.currentRoot);
  const isBackgroundIndexing = useBackgroundIndexerStore((state) => state.isBackgroundIndexing);
  const failedRoots = useBackgroundIndexerStore((state) => state.failedRoots);
  const enqueueBackgroundRoot = useBackgroundIndexerStore((state) => state.enqueueRoot);
  const activePlan = useOrganizationPlanStore((state) => state.activePlan);
  const plans = useOrganizationPlanStore((state) => state.plans);
  const loadPlans = useOrganizationPlanStore((state) => state.loadPlans);
  const [globalIndexStatus, setGlobalIndexStatus] = useState<Awaited<ReturnType<typeof tauriApi.getGlobalIndexStatus>> | null>(null);
  const [scanRoots, setScanRoots] = useState<ScanRootDto[]>([]);
  const [managedScopes, setManagedScopes] = useState<Awaited<ReturnType<typeof tauriApi.listManagedScopes>>>([]);
  const [activeAnalysisRun, setActiveAnalysisRun] = useState<Awaited<ReturnType<typeof tauriApi.getActiveAnalysisRun>>>(null);
  const [analysisRuns, setAnalysisRuns] = useState<Awaited<ReturnType<typeof tauriApi.listAnalysisRuns>>>([]);
  const [contentRuns, setContentRuns] = useState<Awaited<ReturnType<typeof tauriApi.listContentRuns>>>([]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    let disposed = false;
    const refreshHealth = async () => {
      const [indexResult, rootsResult, managedScopesResult, analysisResult, analysisRunsResult, contentResult] = await Promise.allSettled([
        tauriApi.getGlobalIndexStatus(),
        tauriApi.listScanRoots(),
        tauriApi.listManagedScopes(),
        tauriApi.getActiveAnalysisRun(),
        tauriApi.listAnalysisRuns(20),
        tauriApi.listContentRuns(10)
      ]);
      if (disposed) return;
      if (indexResult.status === "fulfilled") setGlobalIndexStatus(indexResult.value);
      if (rootsResult.status === "fulfilled") setScanRoots(rootsResult.value);
      if (managedScopesResult.status === "fulfilled") setManagedScopes(managedScopesResult.value);
      if (analysisResult.status === "fulfilled") setActiveAnalysisRun(analysisResult.value);
      if (analysisRunsResult.status === "fulfilled") setAnalysisRuns(analysisRunsResult.value);
      if (contentResult.status === "fulfilled") setContentRuns(contentResult.value);
    };
    void refreshHealth();
    const timer = window.setInterval(() => { void refreshHealth(); }, 5000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);

  const scanSnapshot = {
    status: scanState.status,
    isScanning,
    isCanceling: isCancelingScan,
    progress: scanState.progress,
    error: scanState.error
  };
  const hasIndexedData = stats.totalFiles > 0 || stats.totalSize > 0;
  const scanVisualState = deriveOverviewScanState(scanSnapshot, hasIndexedData);
  const activities = selectRecentOverviewActivity(operationLogs, t);
  const backgroundTasks = selectOverviewBackgroundTasks({
    backgroundIndexing: isBackgroundIndexing,
    currentRoot: currentBackgroundRoot,
    pendingRoots,
    failedRoots,
    operationProgress,
    aiProgress: aiClassificationProgress ? {
      processed: aiClassificationProgress.processed,
      total: aiClassificationProgress.total,
      currentPath: aiClassificationProgress.currentFilePreview
    } : null,
    isClassifyingWithAI
  });
  const scopeRoots = scope.kind === "all" ? [] : scope.roots;
  const overviewRoots = scopeRoots.length > 0 ? scopeRoots : selectedFolders;
  const summary = buildOverviewSummary(stats, overviewRoots, t, language);
  const scanFallbackPath = scanState.progress?.root || selectedFolders[0] || scopeRoots[0] || "";
  const latestContentRun = contentRuns
    .slice()
    .sort((left, right) => right.updatedAt - left.updatedAt)[0]
    ?? null;
  const cleanupRun = (activeAnalysisRun?.scope?.kind === "approved_cleanup_paths" ? activeAnalysisRun : null)
    ?? analysisRuns
      .filter((run) => run.scope?.kind === "approved_cleanup_paths")
      .sort((left, right) => right.updatedAt - left.updatedAt)[0]
    ?? null;
  const watcherHealth = summarizeWatcherHealth(scanRoots.filter((root) => root.enabled));
  const operationAttentionCount = operationLogs.filter((log) => log.status === "failed" || log.status === "manual_review" || String(log.restore_status).includes("failed") || String(log.restore_status).includes("manual_review") || String(log.restore_status).includes("conflict")).length;
  const globalIndexNoSource = globalIndexStatus
    ? globalIndexStatus.status === "no_source"
      || (!globalIndexStatus.enabled && globalIndexStatus.indexedVolumes === 0)
      || (globalIndexStatus.status === "unavailable" && globalIndexStatus.totalEntries === 0 && globalIndexStatus.indexedVolumes === 0)
    : false;
  const health: OverviewHealthSnapshot = {
    globalIndex: globalIndexStatus ? {
      status: globalIndexStatus.status,
      collectionComplete: globalIndexStatus.collectionComplete,
      lastError: globalIndexStatus.lastError,
      enabled: globalIndexStatus.enabled,
      noSource: globalIndexNoSource
    } : null,
    watcher: watcherHealth,
    plan: activePlan ?? plans[0] ?? null,
    cleanupRun,
    contentRun: latestContentRun,
    operation: { active: operationProgress != null, attentionCount: operationAttentionCount }
  };
  const indexNeedsUpdate = Boolean(globalIndexStatus && (
    globalIndexStatus.status !== "ready" || !globalIndexStatus.collectionComplete
  ));
  const priorityTask = selectOverviewPriorityTask({
    scan: scanSnapshot,
    stats,
    cleanupCandidateCount: 0,
    reclaimableBytes: 0,
    indexNeedsUpdate,
    health
  });
  const systemCoverage: OverviewSystemCoverageModel = {
    search: globalIndexStatus
      ? (globalIndexStatus.status === "ready" && globalIndexStatus.collectionComplete && !globalIndexNoSource ? "ready" : globalIndexNoSource || ["permission_required", "error", "unavailable", "no_source"].includes(globalIndexStatus.status) ? "attention" : "partial")
      : "unknown",
    managedCount: managedScopes.filter((scope) => scope.enabled).length,
    managedTotal: managedScopes.length,
    managedAttention: watcherHealth.stale,
    contentEnabled: managedScopes.filter((scope) => scope.allowLocalAi || scope.allowCloudAi).length,
    contentTotal: managedScopes.length
  };

  function runPrimaryAction(task: OverviewPriorityTaskModel) {
    if (task.kind === "search-permission") {
      setView("settings");
      requestSettingsSection("settings-global-index");
      return;
    }
    if (task.kind === "operation") {
      setView("restore");
      return;
    }
    if (task.kind === "content-failure") {
      setView("library");
      return;
    }
    if (task.kind === "managed-root-stale") {
      setView("settings");
      requestSettingsSection("settings-files-scan");
      return;
    }
    if (task.kind === "review") {
      setView("organize");
      return;
    }
    if (task.kind === "cleanup") {
      setView("cleanup");
      return;
    }
    if (task.kind === "scan-active" || task.kind === "scan-canceling" || task.kind === "scan-partial") {
      document.getElementById("overview-scan-task")?.scrollIntoView({ block: "nearest" });
      return;
    }
    if (task.kind === "orderly") {
      void handleChooseFolders();
      return;
    }
    void handleScan();
  }

  async function confirmCancelScan() {
    await cancelScan();
    setIsCancelDialogOpen(false);
  }

  return (
    <div className={cn(pageSurface, "grid content-start gap-5 pb-8")}>
      <OverviewPriorityTask
        task={priorityTask}
        t={t}
        onPrimary={() => runPrimaryAction(priorityTask)}
        onChooseFolder={() => void handleChooseFolders()}
        onCancel={() => setIsCancelDialogOpen(true)}
      />

      <ScanTaskPanel
        state={scanVisualState}
        progress={scanState.progress}
        error={scanState.error}
        fallbackPath={scanFallbackPath}
        t={t}
        language={language}
      />

      <OverviewSpaceSummary summary={summary} t={t} />
      <OverviewSystemCoverage coverage={systemCoverage} t={t} />
      <OverviewRecentActivityList activities={activities} t={t} language={language} />
      <OverviewBackgroundTaskList
        tasks={backgroundTasks}
        t={t}
        onRetryIndex={(path) => enqueueBackgroundRoot(path, { force: true })}
      />

      <ScanCancelDialog
        open={isCancelDialogOpen}
        isCanceling={isCancelingScan}
        t={t}
        onConfirm={confirmCancelScan}
        onCancel={() => setIsCancelDialogOpen(false)}
      />
    </div>
  );
}
