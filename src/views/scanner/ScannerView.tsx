import { useState } from "react";
import { useChromeContext } from "../../contexts/AppContexts";
import { useBackgroundIndexerStore } from "../../store/useBackgroundIndexerStore";
import { useFileLibraryStore } from "../../store/useFileLibraryStore";
import { useOperationQueueStore } from "../../store/useOperationQueueStore";
import { useScanManagerStore } from "../../store/useScanManagerStore";
import { useStorageCleanupStore } from "../../store/useStorageCleanupStore";
import { cn } from "../../utils/tw";
import { PageHeader, pageSurface } from "../shared/ui";
import { OverviewPriorityTask } from "../overview/OverviewPriorityTask";
import { ScanTaskPanel } from "../overview/ScanTaskPanel";
import { ScanCancelDialog } from "../overview/ScanCancelDialog";
import {
  OverviewBackgroundTaskList,
  OverviewRecentActivityList,
  OverviewSpaceSummary
} from "../overview/OverviewSections";
import {
  buildOverviewSummary,
  deriveOverviewScanState,
  selectOverviewBackgroundTasks,
  selectOverviewPriorityTask,
  selectRecentOverviewActivity,
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
  const cleanupAnalysis = useStorageCleanupStore((state) => state.analysis);
  const isCleanupScanning = useStorageCleanupStore((state) => state.isScanning);
  const cleanupScanError = useStorageCleanupStore((state) => state.scanError);

  const scanSnapshot = {
    status: scanState.status,
    isScanning,
    isCanceling: isCancelingScan,
    progress: scanState.progress,
    error: scanState.error
  };
  const hasIndexedData = stats.totalFiles > 0 || stats.totalSize > 0;
  const scanVisualState = deriveOverviewScanState(scanSnapshot, hasIndexedData);
  const completedCleanupAnalysis = cleanupAnalysis && !isCleanupScanning && !cleanupScanError ? cleanupAnalysis : null;
  const cleanupCandidateCount = completedCleanupAnalysis
    ? completedCleanupAnalysis.candidate_total ?? completedCleanupAnalysis.candidates.length
    : 0;
  const priorityTask = selectOverviewPriorityTask({
    scan: scanSnapshot,
    stats,
    cleanupCandidateCount,
    reclaimableBytes: completedCleanupAnalysis?.reclaimable_estimate ?? 0,
    indexNeedsUpdate: false
  });
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
  const summary = buildOverviewSummary(stats, overviewRoots, t);
  const scanFallbackPath = scanState.progress?.root || selectedFolders[0] || scopeRoots[0] || "";

  function runPrimaryAction(task: OverviewPriorityTaskModel) {
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
      <PageHeader title={t("overview")} description={t("overviewDescription")} />

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
      <OverviewRecentActivityList activities={activities} t={t} />
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
