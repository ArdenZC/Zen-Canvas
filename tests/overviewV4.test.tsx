import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { makeTranslator } from "../src/i18n";
import type { DashboardStats, OperationLog } from "../src/types/domain";
import {
  buildOverviewSummary,
  deriveOverviewScanState,
  selectOverviewBackgroundTasks,
  selectOverviewPriorityTask,
  selectRecentOverviewActivity
} from "../src/views/overview/overviewModel";
import { OverviewPriorityTask } from "../src/views/overview/OverviewPriorityTask";
import { OverviewBackgroundTaskList } from "../src/views/overview/OverviewSections";
import { ScanCancelDialog } from "../src/views/overview/ScanCancelDialog";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const t = makeTranslator("zh");
const stats = (overrides: Partial<DashboardStats> = {}): DashboardStats => ({
  totalFiles: 10,
  totalSize: 1024,
  diskTotalSize: 0,
  diskFreeSize: 0,
  diskUsageRatio: 0,
  duplicateFiles: 0,
  largeFiles: 0,
  sensitiveFiles: 0,
  needsConfirmation: 0,
  byType: {},
  byLifecycle: {},
  lastScannedAt: "2026-07-12T08:00:00Z",
  ...overrides
});

const scan = (overrides: Record<string, unknown> = {}) => ({
  status: "idle" as const,
  isScanning: false,
  isCanceling: false,
  progress: null,
  error: null,
  ...overrides
});

describe("Overview v4", () => {
  it("selects exactly one priority task in the required order", () => {
    expect(selectOverviewPriorityTask({ scan: scan({ status: "error", error: "denied" }), stats: stats({ needsConfirmation: 8 }), cleanupCandidateCount: 4, reclaimableBytes: 900, indexNeedsUpdate: true })).toMatchObject({ kind: "scan-failed" });
    expect(selectOverviewPriorityTask({ scan: scan({ status: "scanning", isScanning: true }), stats: stats({ needsConfirmation: 8 }), cleanupCandidateCount: 4, reclaimableBytes: 900, indexNeedsUpdate: true })).toMatchObject({ kind: "scan-active" });
    expect(selectOverviewPriorityTask({ scan: scan({ status: "canceled", isScanning: true, isCanceling: true }), stats: stats({ needsConfirmation: 8 }), cleanupCandidateCount: 4, reclaimableBytes: 900, indexNeedsUpdate: true })).toMatchObject({ kind: "scan-canceling" });
    expect(selectOverviewPriorityTask({ scan: scan({ status: "error", error: "Permission denied" }), stats: stats(), cleanupCandidateCount: 0, reclaimableBytes: 0, indexNeedsUpdate: false })).toMatchObject({ kind: "scan-permission" });
    expect(selectOverviewPriorityTask({ scan: scan({ status: "completed", progress: { files: 9, errors: 2 } }), stats: stats({ needsConfirmation: 8 }), cleanupCandidateCount: 4, reclaimableBytes: 900, indexNeedsUpdate: true })).toMatchObject({ kind: "scan-partial" });
    expect(selectOverviewPriorityTask({ scan: scan({ status: "canceled", progress: { files: 5 } }), stats: stats({ needsConfirmation: 8 }), cleanupCandidateCount: 4, reclaimableBytes: 900, indexNeedsUpdate: true })).toMatchObject({ kind: "scan-canceled" });
    expect(selectOverviewPriorityTask({ scan: scan(), stats: stats({ needsConfirmation: 8 }), cleanupCandidateCount: 4, reclaimableBytes: 900, indexNeedsUpdate: true })).toMatchObject({ kind: "review" });
    expect(selectOverviewPriorityTask({ scan: scan(), stats: stats(), cleanupCandidateCount: 4, reclaimableBytes: 900, indexNeedsUpdate: true })).toMatchObject({ kind: "cleanup" });
    expect(selectOverviewPriorityTask({ scan: scan(), stats: stats({ totalFiles: 0, totalSize: 0, lastScannedAt: null }), cleanupCandidateCount: 0, reclaimableBytes: 0, indexNeedsUpdate: false })).toMatchObject({ kind: "unindexed" });
    expect(selectOverviewPriorityTask({ scan: scan(), stats: stats(), cleanupCandidateCount: 0, reclaimableBytes: 0, indexNeedsUpdate: true })).toMatchObject({ kind: "update" });
    expect(selectOverviewPriorityTask({ scan: scan(), stats: stats(), cleanupCandidateCount: 0, reclaimableBytes: 0, indexNeedsUpdate: false })).toMatchObject({ kind: "orderly" });
  });

  it("distinguishes scanning, canceling, canceled, partial, completed, failed, and first use", () => {
    expect(deriveOverviewScanState(scan({ isScanning: true, status: "scanning" }), false)).toBe("scanning");
    expect(deriveOverviewScanState(scan({ isScanning: true, isCanceling: true, status: "canceled" }), true)).toBe("canceling");
    expect(deriveOverviewScanState(scan({ status: "canceled" }), true)).toBe("canceled");
    expect(deriveOverviewScanState(scan({ status: "completed", progress: { errors: 2, skipped: 1 } }), true)).toBe("partial");
    expect(deriveOverviewScanState(scan({ status: "completed", progress: { errors: 0, skipped: 0 } }), true)).toBe("completed");
    expect(deriveOverviewScanState(scan({ status: "error", error: "offline" }), true)).toBe("failed");
    expect(deriveOverviewScanState(scan(), false)).toBe("first-use");
  });

  it("uses only real operation logs for recent activity", () => {
    const logs = [
      { id: "old", created_at: "2026-07-10T08:00:00Z", status: "success", operation_type: "move" },
      { id: "new", created_at: "2026-07-12T09:00:00Z", status: "failed", operation_type: "rename" }
    ] as OperationLog[];
    const activity = selectRecentOverviewActivity(logs, t, 3);
    expect(activity.map((item) => item.id)).toEqual(["operation:new", "operation:old"]);
    expect(activity[0]).toMatchObject({ status: "failed", destination: null });
  });

  it("hides background work when idle and exposes only real active or failed tasks", () => {
    expect(selectOverviewBackgroundTasks({ backgroundIndexing: false, pendingRoots: [], failedRoots: [], operationProgress: null, aiProgress: null, isClassifyingWithAI: false })).toEqual([]);
    const tasks = selectOverviewBackgroundTasks({
      backgroundIndexing: true,
      currentRoot: "F:/Documents",
      pendingRoots: ["F:/Downloads"],
      failedRoots: [{ path: "F:/Denied", message: "denied" }],
      operationProgress: { kind: "execute", processed: 2, total: 5, currentPath: "F:/a.txt", batchId: "b" },
      aiProgress: null,
      isClassifyingWithAI: false
    });
    expect(tasks.map((task) => task.kind)).toEqual(["background-index", "operation", "background-failure"]);
  });

  it("builds a relational summary without disk coverage or clutter percentages", () => {
    const summary = buildOverviewSummary(stats({ totalFiles: 12842, needsConfirmation: 42 }), ["F:/Downloads", "F:/Desktop"], t);
    expect(summary).toContain("12,842");
    expect(summary).toContain("42");
    expect(summary).not.toContain("%");
    expect(summary).not.toContain("参考磁盘容量");
  });

  it("renders one and only one primary action", () => {
    const tasks = [
      selectOverviewPriorityTask({ scan: scan(), stats: stats({ totalFiles: 0, totalSize: 0, lastScannedAt: null }), cleanupCandidateCount: 0, reclaimableBytes: 0, indexNeedsUpdate: false }),
      selectOverviewPriorityTask({ scan: scan({ status: "scanning", isScanning: true }), stats: stats(), cleanupCandidateCount: 0, reclaimableBytes: 0, indexNeedsUpdate: false }),
      selectOverviewPriorityTask({ scan: scan({ status: "canceled", isScanning: true, isCanceling: true }), stats: stats(), cleanupCandidateCount: 0, reclaimableBytes: 0, indexNeedsUpdate: false }),
      selectOverviewPriorityTask({ scan: scan({ status: "error", error: "fatal" }), stats: stats(), cleanupCandidateCount: 0, reclaimableBytes: 0, indexNeedsUpdate: false }),
      selectOverviewPriorityTask({ scan: scan({ status: "completed", progress: { files: 9, errors: 2 } }), stats: stats(), cleanupCandidateCount: 0, reclaimableBytes: 0, indexNeedsUpdate: false }),
      selectOverviewPriorityTask({ scan: scan(), stats: stats({ needsConfirmation: 4 }), cleanupCandidateCount: 0, reclaimableBytes: 0, indexNeedsUpdate: false }),
      selectOverviewPriorityTask({ scan: scan(), stats: stats(), cleanupCandidateCount: 3, reclaimableBytes: 1024, indexNeedsUpdate: false }),
      selectOverviewPriorityTask({ scan: scan(), stats: stats(), cleanupCandidateCount: 0, reclaimableBytes: 0, indexNeedsUpdate: false })
    ];
    for (const task of tasks) {
      const html = renderToStaticMarkup(createElement(OverviewPriorityTask, { task, t, onPrimary: vi.fn(), onChooseFolder: vi.fn(), onCancel: vi.fn() }));
      expect(html.match(/data-overview-primary="true"/g)).toHaveLength(1);
    }
  });

  it("hides empty background tasks and uses an accessible in-app cancel dialog", () => {
    expect(renderToStaticMarkup(createElement(OverviewBackgroundTaskList, { tasks: [], t, onRetryIndex: vi.fn() }))).toBe("");
    const dialog = renderToStaticMarkup(createElement(ScanCancelDialog, { open: true, isCanceling: false, t, onConfirm: vi.fn(), onCancel: vi.fn() }));
    expect(dialog).toContain('role="alertdialog"');
    expect(dialog).toContain('aria-modal="true"');
    expect(dialog).toContain("已经完成的目录仍会保留在本地索引中");
  });

  it("removes the old scanner dashboard and keeps existing scan actions wired", () => {
    const scanner = readFileSync(resolve("src/views/scanner/ScannerView.tsx"), "utf8");
    expect(scanner).not.toContain("ScannerDisk");
    expect(scanner).not.toContain("ScannerSummaryChip");
    expect(scanner).not.toContain("clutterRatio");
    expect(scanner).not.toContain("diskTotalSize");
    expect(scanner).not.toContain("percent(");
    expect(scanner).toContain("handleScan");
    expect(scanner).toContain("handleChooseFolders");
    expect(scanner).toContain("await cancelScan()");
    expect(scanner).not.toContain("window.confirm");
    expect(scanner).not.toContain("globalThis.confirm");
  });
});
