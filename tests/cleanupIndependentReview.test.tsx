// @vitest-environment happy-dom

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeTranslator } from "../src/i18n";
import type { AnalysisFinding, AnalysisRun } from "../src/types/domain";
import { StorageCleanupView } from "../src/views/cleanup/StorageCleanupView";

const t = makeTranslator("zh");
let root: Root;
let container: HTMLDivElement;

const CleanupView = StorageCleanupView as unknown as (props: Record<string, unknown>) => ReactElement;

function makeRun(id: string, status: string, reviewCount = 0): AnalysisRun {
  return {
    id,
    requestKey: `request-${id}`,
    requestAttempt: 1,
    scope: { kind: "approved_cleanup_paths", paths: ["C:/Root"] },
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
    findingsStaged: reviewCount,
    findingsPublished: reviewCount,
    safeCount: 0,
    reviewCount,
    cautionCount: 0,
    exactReclaimableBytes: 0,
    potentialReclaimableBytes: reviewCount,
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
    primarySubjectId: `C:/Root/item-${index}`,
    pathSnapshot: `C:/Root/item-${index}`,
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
});
