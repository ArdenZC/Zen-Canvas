// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChromeProvider, type ChromeContextValue } from "../src/contexts/AppContexts";
import { makeTranslator } from "../src/i18n";
import { useBackgroundIndexerStore } from "../src/store/useBackgroundIndexerStore";
import { useFileLibraryStore } from "../src/store/useFileLibraryStore";
import { useOperationQueueStore } from "../src/store/useOperationQueueStore";
import { useOrganizationPlanStore } from "../src/store/useOrganizationPlanStore";
import { useScanManagerStore } from "../src/store/useScanManagerStore";
import { useStorageCleanupStore } from "../src/store/useStorageCleanupStore";
import type { AnalysisRun, DashboardStats, OrganizationPlan } from "../src/types/domain";
import { ScannerView } from "../src/views/scanner/ScannerView";

const apiMocks = vi.hoisted(() => ({
  getGlobalIndexStatus: vi.fn(),
  listScanRoots: vi.fn(),
  listManagedScopes: vi.fn(),
  getActiveAnalysisRun: vi.fn(),
  listAnalysisRuns: vi.fn(),
  listContentRuns: vi.fn(),
  listOrganizationPlans: vi.fn()
}));

vi.mock("../src/api/tauriApi", () => ({ tauriApi: apiMocks }));

const t = makeTranslator("zh");
const chrome = {
  t,
  language: "zh",
  setView: vi.fn(),
  view: "scanner"
} as unknown as ChromeContextValue;

const stats = (overrides: Partial<DashboardStats> = {}): DashboardStats => ({
  totalFiles: 20,
  totalSize: 2048,
  diskTotalSize: 0,
  diskFreeSize: 0,
  diskUsageRatio: 0,
  duplicateFiles: 0,
  largeFiles: 0,
  sensitiveFiles: 0,
  needsConfirmation: 0,
  byType: {},
  byLifecycle: {},
  lastScannedAt: "2026-08-02T00:00:00.000Z",
  ...overrides
});

const readyIndex = {
  platform: "browser",
  enabled: true,
  status: "ready",
  processedEntries: 20,
  collectionComplete: true,
  totalEntries: 20,
  indexedVolumes: 1,
  readyVolumes: 1,
  pendingVolumes: 0,
  lastSyncAt: 1,
  lastError: null
};

const reviewPlan = {
  id: "plan-overview",
  title: "Overview plan",
  summary: { pendingReview: 4 },
  effectiveSummary: null,
  updatedAt: 1
} as unknown as OrganizationPlan;

function cleanupRun(reviewCount: number, exactReclaimableBytes: number): AnalysisRun {
  return {
    id: "analysis-overview",
    requestKey: "analysis-overview-request",
    requestAttempt: 1,
    scope: { kind: "approved_cleanup_paths", paths: ["C:/Cleanup"] },
    scopeHash: "scope-overview",
    sourceSnapshot: {},
    sourceSnapshotHash: "snapshot-overview",
    detectorSet: ["cleanup_heuristics_v1:v1"],
    detectorSetHash: "detectors-overview",
    status: "completed",
    phase: "completed",
    revision: 1,
    cancelRequested: false,
    rerunRequired: false,
    detectorsTotal: 1,
    detectorsCompleted: 1,
    detectorsFailed: 0,
    findingsStaged: reviewCount,
    findingsPublished: reviewCount,
    safeCount: 0,
    reviewCount,
    cautionCount: 0,
    exactReclaimableBytes,
    potentialReclaimableBytes: exactReclaimableBytes,
    warningCount: 0,
    errorCount: 0,
    startedAt: 1,
    finishedAt: 2,
    lastCheckpointAt: 2,
    createdAt: 1,
    updatedAt: 2,
    errorCode: null,
    errorMessage: null
  };
}

function configureHealth(overrides: {
  index?: Record<string, unknown>;
  roots?: Record<string, unknown>[];
  analysisRuns?: AnalysisRun[];
  activeAnalysisRun?: AnalysisRun | null;
  contentRuns?: Record<string, unknown>[];
} = {}) {
  apiMocks.listOrganizationPlans.mockResolvedValue([]);
  apiMocks.getGlobalIndexStatus.mockResolvedValue({ ...readyIndex, ...overrides.index });
  apiMocks.listScanRoots.mockResolvedValue(overrides.roots ?? []);
  apiMocks.listManagedScopes.mockResolvedValue([]);
  apiMocks.getActiveAnalysisRun.mockResolvedValue(overrides.activeAnalysisRun ?? null);
  apiMocks.listAnalysisRuns.mockResolvedValue(overrides.analysisRuns ?? []);
  apiMocks.listContentRuns.mockResolvedValue(overrides.contentRuns ?? []);
}

function resetStores() {
  useFileLibraryStore.setState({ scope: { kind: "all" }, stats: stats(), isClassifyingWithAI: false, aiClassificationProgress: null });
  useScanManagerStore.setState({
    selectedFolders: [],
    isScanning: false,
    isCancelingScan: false,
    scanState: { status: "idle", progress: null, entries: [], error: null }
  });
  useBackgroundIndexerStore.setState({ pendingRoots: [], currentRoot: null, isBackgroundIndexing: false, failedRoots: [] });
  useOperationQueueStore.setState({ operationLogs: [], operationProgress: null, activeOperationKind: null, listenersRegistered: false, registrationPromise: null });
  useOrganizationPlanStore.setState({ activePlan: null, plans: [] });
  useStorageCleanupStore.setState({ analysis: null, isScanning: false, scanError: "" });
}

let root: Root;
let container: HTMLDivElement;

async function flush() {
  for (let index = 0; index < 4; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function renderOverview() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(ChromeProvider, { value: chrome, children: createElement(ScannerView) }));
  });
  await flush();
}

function priorityTitle() {
  return container.querySelector("#overview-priority-title")?.textContent ?? "";
}

describe("Overview durable health integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
  });

  it("shows search settings for Global Index no_source", async () => {
    configureHealth({ index: { status: "unavailable", enabled: false, collectionComplete: false, totalEntries: 0, indexedVolumes: 0 } });
    await renderOverview();
    expect(priorityTitle()).toBe("还没有可搜索的位置");
    expect(container.querySelector('[data-overview-primary="true"]')?.textContent).toContain("检查搜索来源");
  });

  it("shows the synchronization entry for watcher reconciliation", async () => {
    configureHealth({ roots: [{ enabled: true, needsReconciliation: true, watcherRevision: 3, watcherAppliedRevision: 2, healthStatus: "reconciliation_required" }] });
    await renderOverview();
    expect(priorityTitle()).toBe("托管位置需要同步");
  });

  it("prioritizes operation attention over ordinary scan work", async () => {
    configureHealth();
    useOperationQueueStore.setState({ operationLogs: [{ status: "manual_review", restore_status: "none" }] as never[], operationProgress: null, activeOperationKind: null });
    expect(useOperationQueueStore.getState().operationProgress).toBeNull();
    await renderOverview();
    expect(useOperationQueueStore.getState().operationProgress).toBeNull();
    expect(priorityTitle()).toBe("有操作需要复核");
  });

  it("uses persisted plan summary when effectiveSummary is deferred", async () => {
    configureHealth();
    useFileLibraryStore.setState({ stats: stats({ needsConfirmation: 99 }) });
    useOrganizationPlanStore.setState({ activePlan: reviewPlan, plans: [reviewPlan] });
    await renderOverview();
    expect(priorityTitle()).toBe("有 4 项需要你确认");
  });

  it("uses the durable cleanup run when the legacy cleanup store is empty", async () => {
    const run = cleanupRun(3, 4096);
    configureHealth({ analysisRuns: [run] });
    await renderOverview();
    expect(priorityTitle()).toBe("有 3 项清理候选");
  });

  it("prefers the durable cleanup run when legacy cleanup data conflicts", async () => {
    const run = cleanupRun(2, 2048);
    configureHealth({ analysisRuns: [run] });
    useStorageCleanupStore.setState({ analysis: { candidate_total: 99, reclaimable_estimate: 99_999 } as never });
    await renderOverview();
    expect(priorityTitle()).toBe("有 2 项清理候选");
  });

  it("shows a failed Content Run from the durable health snapshot", async () => {
    configureHealth({ contentRuns: [{ status: "failed", updatedAt: 2, lastErrorDetail: "内容处理失败" }] });
    await renderOverview();
    expect(priorityTitle()).toBe("内容理解任务需要复核");
  });

  it("derives indexNeedsUpdate from the real Global Index status", async () => {
    configureHealth({ index: { status: "partial", collectionComplete: false, indexedVolumes: 1, readyVolumes: 0, totalEntries: 20 } });
    await renderOverview();
    expect(priorityTitle()).toBe("本地索引可以更新");
  });
});
