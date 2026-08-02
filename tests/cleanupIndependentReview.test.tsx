// @vitest-environment happy-dom

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeTranslator } from "../src/i18n";
import type { AnalysisFinding, AnalysisRun } from "../src/types/domain";
import { StorageCleanupView } from "../src/views/cleanup/StorageCleanupView";

const dialogMocks = vi.hoisted(() => ({ open: vi.fn() }));
const pathMocks = vi.hoisted(() => ({
  desktopDir: vi.fn(),
  documentDir: vi.fn(),
  downloadDir: vi.fn(),
  tempDir: vi.fn()
}));

vi.mock("@tauri-apps/plugin-dialog", () => dialogMocks);
vi.mock("@tauri-apps/api/path", () => pathMocks);

const t = makeTranslator("zh");
let root: Root;
let container: HTMLDivElement;

const CleanupView = StorageCleanupView as unknown as (props: Record<string, unknown>) => ReactElement;

function makeRun(id: string, status: string, reviewCount = 0, options: { paths?: string[]; safeCount?: number } = {}): AnalysisRun {
  const paths = options.paths ?? ["C:/Root"];
  const safeCount = options.safeCount ?? 0;
  const findingsCount = reviewCount + safeCount;
  return {
    id,
    requestKey: `request-${id}`,
    requestAttempt: 1,
    scope: { kind: "approved_cleanup_paths", paths },
    scopeHash: `scope-${id}`,
    sourceSnapshot: {},
    sourceSnapshotHash: `snapshot-${id}`,
    detectorSet: ["cleanup_heuristics_v1:v1"],
    detectorSetHash: `detectors-${id}`,
    status,
    phase: status === "completed" || status === "cancelled" ? "completed" : "running_detectors",
    revision: 2,
    cancelRequested: false,
    rerunRequired: false,
    detectorsTotal: 1,
    detectorsCompleted: status === "completed" ? 1 : 0,
    detectorsFailed: 0,
    findingsStaged: findingsCount,
    findingsPublished: findingsCount,
    safeCount,
    reviewCount,
    cautionCount: 0,
    exactReclaimableBytes: 0,
    potentialReclaimableBytes: findingsCount,
    warningCount: 0,
    errorCount: 0,
    startedAt: 1,
    finishedAt: status === "completed" ? 2 : null,
    lastCheckpointAt: 2,
    createdAt: 1,
    updatedAt: 2,
    errorCode: null,
    errorMessage: null
  };
}

function makeFinding(run: AnalysisRun, index: number): AnalysisFinding {
  const rootPath = (Array.isArray(run.scope.paths) ? run.scope.paths[0] : "C:/Root") as string;
  return {
    id: `finding-${index}`,
    findingKey: `finding-key-${index}`,
    runId: run.id,
    detectorId: "cleanup_heuristics_v1",
    detectorVersion: 1,
    scopeHash: run.scopeHash,
    status: "active",
    tier: "review",
    category: "review",
    actionKind: "safe_trash_candidate",
    title: `Review ${index}`,
    reason: "Needs confirmation",
    riskNote: null,
    confidence: "estimated",
    sizeBytes: 1,
    exactReclaimableBytes: null,
    potentialReclaimableBytes: 1,
    requiresConfirmation: true,
    executable: true,
    primarySubjectKind: "approved_path",
    primarySubjectId: `${rootPath}/item-${index}`,
    pathSnapshot: `${rootPath}/item-${index}`,
    identitySnapshot: {},
    evidenceSummary: {},
    revision: 1,
    createdAt: 1,
    updatedAt: 1,
    publishedAt: 1,
    staleAt: null,
    decision: null,
    snoozedUntil: null,
    decisionRevision: null
  };
}

function makeSafeFinding(run: AnalysisRun, index: number): AnalysisFinding {
  return {
    ...makeFinding(run, index),
    tier: "safe",
    category: "safe",
    title: `Safe ${index}`,
    requiresConfirmation: false
  };
}

function scopeButton(): HTMLButtonElement {
  const section = container.querySelector<HTMLElement>("[data-cleanup-scope]");
  const found = [...(section?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((button) => /扫描|重新扫描/.test(button.textContent ?? ""));
  if (!found) throw new Error("scope scan button not found");
  return found;
}

function button(text: string): HTMLButtonElement {
  const found = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes(text));
  if (!found) throw new Error(`button not found: ${text}`);
  return found;
}

async function flush(count = 3) {
  for (let index = 0; index < count; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function commonApi(run: AnalysisRun, overrides: Record<string, unknown> = {}) {
  return {
    listAnalysisDetectors: async () => [],
    startAnalysisRun: async () => run,
    getActiveAnalysisRun: async () => null,
    listAnalysisRuns: async () => [],
    getAnalysisRun: async () => run,
    listAnalysisRunDetectors: async () => [],
    listAnalysisFindings: async () => ({ findings: [], nextCursor: null, limit: 100 }),
    onAnalysisRunUpdated: async () => () => undefined,
    onAnalysisFindingsPublished: async () => () => undefined,
    onAnalysisDetectorUpdated: async () => () => undefined,
    ...overrides
  } as any;
}

describe("Cleanup independent review behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="test-root"></div>';
    container = document.getElementById("test-root") as HTMLDivElement;
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = "";
  });

  it("creates one request key per scan intent and blocks duplicate submission", async () => {
    const runA = makeRun("run-a", "completed");
    const runB = makeRun("run-b", "completed");
    const requests: Array<{ requestKey?: string | null }> = [];
    const startAnalysisRun = vi.fn(async (request: { requestKey?: string | null }) => {
      requests.push(request);
      return requests.length === 1 ? runA : runB;
    });
    const api = commonApi(runA, {
      startAnalysisRun,
      getAnalysisRun: vi.fn(async (id: string) => id === runA.id ? runA : runB)
    });

    await act(async () => root.render(createElement(CleanupView, { initialRoots: ["C:/Root"], api, t })));
    await flush();
    await act(async () => {
      scopeButton().click();
      scopeButton().click();
    });
    await flush();
    expect(startAnalysisRun).toHaveBeenCalledOnce();
    expect(requests[0]?.requestKey).toMatch(/^cleanup-/);

    await act(async () => scopeButton().click());
    await flush();
    expect(startAnalysisRun).toHaveBeenCalledTimes(2);
    expect(requests[1]?.requestKey).toMatch(/^cleanup-/);
    expect(requests[1]?.requestKey).not.toBe(requests[0]?.requestKey);
  });

  it("uses a fresh request key after a canceled run", async () => {
    const running = makeRun("run-running", "running");
    const canceled = { ...running, status: "cancelled", phase: "completed" as const, cancelRequested: false };
    const fresh = makeRun("run-fresh", "completed");
    const requests: Array<{ requestKey?: string | null }> = [];
    let canceledAt = false;
    const startAnalysisRun = vi.fn(async (request: { requestKey?: string | null }) => {
      requests.push(request);
      return requests.length === 1 ? running : fresh;
    });
    const cancelAnalysisRun = vi.fn(async () => {
      canceledAt = true;
      return canceled;
    });
    const api = commonApi(running, {
      startAnalysisRun,
      cancelAnalysisRun,
      getAnalysisRun: vi.fn(async (id: string) => id === running.id ? (canceledAt ? canceled : running) : fresh)
    });

    await act(async () => root.render(createElement(CleanupView, { initialRoots: ["C:/Root"], api, t })));
    await flush();
    await act(async () => scopeButton().click());
    await flush();
    await act(async () => button("取消扫描").click());
    await flush();
    await act(async () => scopeButton().click());
    await flush();
    expect(cancelAnalysisRun).toHaveBeenCalledOnce();
    expect(requests).toHaveLength(2);
    expect(requests[0]?.requestKey).not.toBe(requests[1]?.requestKey);
  });

  it("collects and batches the complete Review tier instead of only loaded findings", async () => {
    const run = makeRun("run-ai", "completed", 205);
    const allIds = Array.from({ length: 205 }, (_, index) => `finding-${index}`);
    const listAnalysisFindings = vi.fn(async (request: { tier?: string; cursor?: string | null }) => {
      if (request.tier !== "review") return { findings: [], nextCursor: null, limit: 100 };
      const offset = Number(request.cursor ?? 0);
      const pageIds = allIds.slice(offset, offset + 100);
      const next = offset + pageIds.length < allIds.length ? String(offset + pageIds.length) : null;
      return { findings: pageIds.map((_, index) => makeFinding(run, offset + index)), nextCursor: next, limit: 100 };
    });
    const analyzeCleanupCandidatesWithAI = vi.fn(async (_runId: string, _findingIds: string[]) => []);
    const api = commonApi(run, {
      listAnalysisRuns: async () => [run],
      getAnalysisRun: async () => run,
      listAnalysisFindings,
      getAISettings: async () => ({ enabled: true, cleanupAiEnabled: true }),
      analyzeCleanupCandidatesWithAI
    });

    await act(async () => root.render(createElement(CleanupView, { api, t })));
    await flush();
    await act(async () => button("需人工判断").click());
    await flush();
    await act(async () => button("重新核验需确认项目").click());
    await flush(8);

    expect(analyzeCleanupCandidatesWithAI).toHaveBeenCalledTimes(5);
    const submitted = analyzeCleanupCandidatesWithAI.mock.calls.flatMap((call) => call[1] as string[]);
    expect(submitted).toHaveLength(205);
    expect(new Set(submitted)).toEqual(new Set(allIds));
    expect(container.textContent).toContain("共 205 项");
  });

  it("stops an in-flight AI recheck without starting another batch", async () => {
    const run = makeRun("run-ai-cancel", "completed", 60);
    const findings = Array.from({ length: 60 }, (_, index) => makeFinding(run, index));
    let resolveBatch: (value: AnalysisFinding[]) => void = () => undefined;
    const analyzeCleanupCandidatesWithAI = vi.fn(() => new Promise<AnalysisFinding[]>((resolve) => { resolveBatch = resolve; }));
    const api = commonApi(run, {
      listAnalysisRuns: async () => [run],
      getAnalysisRun: async () => run,
      listAnalysisFindings: async () => ({ findings, nextCursor: null, limit: 100 }),
      getAISettings: async () => ({ enabled: true, cleanupAiEnabled: true }),
      analyzeCleanupCandidatesWithAI
    });

    await act(async () => root.render(createElement(CleanupView, { api, t })));
    await flush();
    await act(async () => button("需人工判断").click());
    await flush();
    await act(async () => button("重新核验需确认项目").click());
    await flush(5);
    expect(analyzeCleanupCandidatesWithAI).toHaveBeenCalledOnce();

    await act(async () => button("停止重新核验").click());
    resolveBatch([]);
    await flush(5);

    expect(analyzeCleanupCandidatesWithAI).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("重新核验已停止");
  });

  it("clears the old run, selection, preview, and execution surface when a folder scope changes", async () => {
    const runA = makeRun("run-scope-a", "completed", 0, { paths: ["C:/RootA"], safeCount: 1 });
    const safeFinding = { ...makeSafeFinding(runA, 0), exactReclaimableBytes: 0, potentialReclaimableBytes: 5, sizeBytes: 1 };
    const listAnalysisRuns = vi.fn(async () => [runA]);
    const startAnalysisRun = vi.fn(async () => runA);
    const moveCleanupCandidatesToSafeTrash = vi.fn(async () => ({ moved: 1, skipped: 0, failed: 0 }));
    const api = commonApi(runA, {
      listAnalysisRuns,
      getAnalysisRun: vi.fn(async () => runA),
      listAnalysisFindings: vi.fn(async (request: { tier?: string }) => ({
        findings: request.tier === "safe" ? [safeFinding] : [],
        nextCursor: null,
        limit: 100
      })),
      startAnalysisRun,
      moveCleanupCandidatesToSafeTrash,
      previewCleanupOperations: vi.fn(async () => ({ total: 1, previews: [], truncated: false, hasMore: false }))
    });
    dialogMocks.open.mockResolvedValue("C:/RootB");

    await act(async () => root.render(createElement(CleanupView, { initialRoots: ["C:/RootA"], api, t })));
    await flush(6);
    expect(container.querySelector(`[data-analysis-run-id="${runA.id}"]`)).not.toBeNull();
    expect(container.querySelector("[data-cleanup-selection-summary]")).not.toBeNull();
    expect(container.textContent).toContain("5 B");

    await act(async () => button(t("storageCleanupMoveToSafeTrash")).click());
    await flush(4);
    expect(container.textContent).toContain(t("storageCleanupPreviewReadyTitle"));

    await act(async () => button(t("storageCleanupChooseFolder")).click());
    await flush(4);

    expect(container.querySelector(`[data-analysis-run-id="${runA.id}"]`)).toBeNull();
    expect(container.querySelector("[data-cleanup-selection-summary]")).toBeNull();
    expect(container.textContent).not.toContain(t("storageCleanupPreviewReadyTitle"));
    expect(container.textContent).toContain("C:/RootB");
    expect(startAnalysisRun).not.toHaveBeenCalled();
    expect(moveCleanupCandidatesToSafeTrash).not.toHaveBeenCalled();
    expect(await listAnalysisRuns.mock.results[0]?.value).toEqual([runA]);
  });

  it("clears the old run when a quick scope is selected without starting a scan", async () => {
    const runA = makeRun("run-quick-a", "completed", 0, { paths: ["C:/RootA"], safeCount: 1 });
    const safeFinding = makeSafeFinding(runA, 0);
    const startAnalysisRun = vi.fn(async () => runA);
    const api = commonApi(runA, {
      listAnalysisRuns: vi.fn(async () => [runA]),
      getAnalysisRun: vi.fn(async () => runA),
      listAnalysisFindings: vi.fn(async (request: { tier?: string }) => ({
        findings: request.tier === "safe" ? [safeFinding] : [],
        nextCursor: null,
        limit: 100
      })),
      startAnalysisRun
    });
    pathMocks.downloadDir.mockResolvedValue("C:/Downloads");

    await act(async () => root.render(createElement(CleanupView, { initialRoots: ["C:/RootA"], api, t })));
    await flush(6);
    expect(container.querySelector(`[data-analysis-run-id="${runA.id}"]`)).not.toBeNull();
    expect(container.querySelector("[data-cleanup-selection-summary]")).not.toBeNull();

    await act(async () => button(t("storageCleanupQuickDownloads")).click());
    await flush(4);

    expect(container.querySelector(`[data-analysis-run-id="${runA.id}"]`)).toBeNull();
    expect(container.querySelector("[data-cleanup-selection-summary]")).toBeNull();
    expect(container.textContent).toContain("C:/Downloads");
    expect(startAnalysisRun).not.toHaveBeenCalled();
  });

  it("clears the old run when the initialRoots prop changes", async () => {
    const runA = makeRun("run-prop-a", "completed", 0, { paths: ["C:/RootA"], safeCount: 1 });
    const safeFinding = makeSafeFinding(runA, 0);
    const startAnalysisRun = vi.fn(async () => runA);
    const api = commonApi(runA, {
      listAnalysisRuns: vi.fn(async () => [runA]),
      getAnalysisRun: vi.fn(async () => runA),
      listAnalysisFindings: vi.fn(async (request: { tier?: string }) => ({
        findings: request.tier === "safe" ? [safeFinding] : [],
        nextCursor: null,
        limit: 100
      })),
      startAnalysisRun
    });

    await act(async () => root.render(createElement(CleanupView, { initialRoots: ["C:/RootA"], api, t })));
    await flush(6);
    expect(container.querySelector(`[data-analysis-run-id="${runA.id}"]`)).not.toBeNull();

    await act(async () => root.render(createElement(CleanupView, { initialRoots: ["C:/RootB"], api, t })));
    await flush(4);

    expect(container.querySelector(`[data-analysis-run-id="${runA.id}"]`)).toBeNull();
    expect(container.querySelector("[data-cleanup-selection-summary]")).toBeNull();
    expect(container.textContent).toContain("C:/RootB");
    expect(startAnalysisRun).not.toHaveBeenCalled();
  });
});
