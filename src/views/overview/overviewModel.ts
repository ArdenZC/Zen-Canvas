import type { ScanProgressPayload } from "../../api/tauriApi";
import type { DashboardStats, OperationLog } from "../../types/domain";
import type { Translator } from "../../types/ui";
import { formatBytes, formatDate } from "../../utils/format";
import { compactPath, formatDisplayPath } from "../../utils/viewHelpers";

export type OverviewScanState =
  | "first-use"
  | "idle"
  | "scanning"
  | "canceling"
  | "canceled"
  | "completed"
  | "partial"
  | "failed";

export interface OverviewScanSnapshot {
  status: "idle" | "scanning" | "completed" | "canceled" | "error";
  isScanning: boolean;
  isCanceling: boolean;
  progress: Partial<ScanProgressPayload> | null;
  error: string | null;
}

export type OverviewPriorityKind =
  | "scan-failed"
  | "scan-permission"
  | "scan-active"
  | "scan-canceling"
  | "scan-canceled"
  | "scan-partial"
  | "review"
  | "cleanup"
  | "unindexed"
  | "update"
  | "orderly";

export interface OverviewPriorityTaskModel {
  kind: OverviewPriorityKind;
  count?: number;
  bytes?: number;
  fileCount?: number;
  error?: string;
  path?: string;
}

export function deriveOverviewScanState(scan: OverviewScanSnapshot, hasIndexedData: boolean): OverviewScanState {
  if (scan.isCanceling) return "canceling";
  if (scan.status === "error") return "failed";
  if (scan.status === "canceled") return "canceled";
  if (scan.isScanning || scan.status === "scanning") return "scanning";
  if (scan.status === "completed") {
    return (scan.progress?.errors ?? 0) > 0 ? "partial" : "completed";
  }
  return hasIndexedData ? "idle" : "first-use";
}

export function selectOverviewPriorityTask(input: {
  scan: OverviewScanSnapshot;
  stats: DashboardStats;
  cleanupCandidateCount: number;
  reclaimableBytes: number;
  indexNeedsUpdate: boolean;
}): OverviewPriorityTaskModel {
  const { scan, stats } = input;
  const scanState = deriveOverviewScanState(scan, stats.totalFiles > 0 || stats.totalSize > 0);
  if (scanState === "scanning") {
    return {
      kind: "scan-active",
      fileCount: scan.progress?.files ?? 0,
      path: scan.progress?.root
    };
  }
  if (scanState === "canceling") {
    return { kind: "scan-canceling", fileCount: scan.progress?.files ?? 0, path: scan.progress?.root };
  }
  if (scanState === "failed") {
    return { kind: isPermissionError(scan.error) ? "scan-permission" : "scan-failed", error: scan.error ?? undefined };
  }
  if (scanState === "partial") {
    return { kind: "scan-partial", count: scan.progress?.errors ?? 0, fileCount: scan.progress?.files ?? stats.totalFiles };
  }
  if (scanState === "canceled") return { kind: "scan-canceled", fileCount: scan.progress?.files ?? stats.totalFiles };
  if (stats.needsConfirmation > 0) return { kind: "review", count: stats.needsConfirmation };
  if (input.cleanupCandidateCount > 0 && input.reclaimableBytes > 0) {
    return { kind: "cleanup", count: input.cleanupCandidateCount, bytes: input.reclaimableBytes };
  }
  if (stats.totalFiles <= 0 && stats.totalSize <= 0) return { kind: "unindexed" };
  if (input.indexNeedsUpdate) return { kind: "update" };
  return { kind: "orderly", fileCount: stats.totalFiles };
}

export interface OverviewActivity {
  id: string;
  createdAt: string;
  title: string;
  description: string;
  status: "success" | "failed" | "skipped";
  destination: null;
}

export function selectRecentOverviewActivity(
  logs: OperationLog[],
  t: Translator,
  limit = 4
): OverviewActivity[] {
  return logs.map((log) => {
    const path = log.path_after || log.target_path || log.path_before || log.source_path || "";
    return {
      id: `operation:${log.id}`,
      createdAt: log.created_at,
      title: operationActivityTitle(log.operation_type, log.status, t),
      description: path ? compactPath(formatDisplayPath(path), 72) : "",
      status: log.status,
      destination: null
    };
  })
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, limit);
}

function isPermissionError(error: string | null) {
  const normalized = (error ?? "").toLowerCase();
  return normalized.includes("permission")
    || normalized.includes("access denied")
    || normalized.includes("permission denied")
    || normalized.includes("权限")
    || normalized.includes("拒绝访问");
}

export function operationActivityTitle(
  operationType: string,
  status: OperationLog["status"],
  t: Translator
) {
  const normalized = operationType.toLowerCase();
  const type = normalized.includes("restore")
    ? "restore"
    : normalized.includes("trash") || normalized.includes("clean")
      ? "cleanup"
      : normalized.includes("rename")
        ? "rename"
        : "organize";
  if (type === "restore") {
    if (status === "failed") return t("overviewActivityRestoreFailed");
    if (status === "skipped") return t("overviewActivityRestoreSkipped");
    return t("overviewActivityRestored");
  }
  if (type === "cleanup") {
    if (status === "failed") return t("overviewActivityCleanupFailed");
    if (status === "skipped") return t("overviewActivityCleanupSkipped");
    return t("overviewActivityCleaned");
  }
  if (type === "rename") {
    if (status === "failed") return t("overviewActivityRenameFailed");
    if (status === "skipped") return t("overviewActivityRenameSkipped");
    return t("overviewActivityRenamed");
  }
  if (status === "failed") return t("overviewActivityOrganizeFailed");
  if (status === "skipped") return t("overviewActivityOrganizeSkipped");
  return t("overviewActivityOrganized");
}

export interface OverviewBackgroundTask {
  kind: "background-index" | "operation" | "ai" | "background-failure";
  currentPath?: string;
  processed?: number;
  total?: number;
  pending?: number;
  message?: string;
}

export function selectOverviewBackgroundTasks(input: {
  backgroundIndexing: boolean;
  currentRoot?: string | null;
  pendingRoots: string[];
  failedRoots: Array<{ path: string; message: string }>;
  operationProgress: { kind: "execute" | "restore"; processed: number; total: number; currentPath: string; batchId: string } | null;
  aiProgress: { processed?: number; total?: number; currentPath?: string } | null;
  isClassifyingWithAI: boolean;
}): OverviewBackgroundTask[] {
  const tasks: OverviewBackgroundTask[] = [];
  if (input.backgroundIndexing || input.pendingRoots.length > 0) {
    tasks.push({
      kind: "background-index",
      currentPath: input.currentRoot ?? input.pendingRoots[0],
      pending: input.pendingRoots.length
    });
  }
  if (input.operationProgress) {
    tasks.push({
      kind: "operation",
      currentPath: input.operationProgress.currentPath,
      processed: input.operationProgress.processed,
      total: input.operationProgress.total
    });
  }
  if (input.isClassifyingWithAI) {
    tasks.push({
      kind: "ai",
      currentPath: input.aiProgress?.currentPath,
      processed: input.aiProgress?.processed,
      total: input.aiProgress?.total
    });
  }
  if (input.failedRoots.length > 0) {
    tasks.push({
      kind: "background-failure",
      currentPath: input.failedRoots[0].path,
      message: input.failedRoots[0].message,
      total: input.failedRoots.length
    });
  }
  return tasks;
}

export function buildOverviewSummary(stats: DashboardStats, roots: string[], t: Translator) {
  if (stats.totalFiles <= 0 || !stats.lastScannedAt) return t("overviewSummaryFirstUse");
  const scope = roots.length > 0
    ? roots.slice(0, 2).map((root) => compactPath(formatDisplayPath(root), 28)).join(t("overviewSummaryScopeJoin"))
    : t("overviewSummaryIndexedScope");
  return t("overviewSummaryScanned")
    .replace("{time}", formatDate(stats.lastScannedAt))
    .replace("{count}", stats.totalFiles.toLocaleString())
    .replace("{size}", formatBytes(stats.totalSize))
    .replace("{scope}", scope)
    .replace("{review}", stats.needsConfirmation.toLocaleString());
}
