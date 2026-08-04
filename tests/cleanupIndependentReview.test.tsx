// @vitest-environment happy-dom

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeTranslator } from "../src/i18n";
import type { AnalysisFinding, AnalysisRun } from "../src/types/domain";
import { reconcileAuthoritativeFindingUpdates, StorageCleanupView } from "../src/views/cleanup/StorageCleanupView";

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

function findingButton(findingId: string, text: string): HTMLButtonElement {
  const row = container.querySelector<HTMLElement>(`[data-analysis-finding-id="${findingId}"]`);
  const found = [...(row?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((item) => item.textContent?.includes(text));
  if (!found) throw new Error(`finding button not found: ${findingId} / ${text}`);
  return found;
}

function reactOnClick(button: HTMLButtonElement): (() => void) | null {
  const propsKey = Object.keys(button).find((key) => key.startsWith("__reactProps$"));
  if (!propsKey) return null;
  const props = (button as unknown as Record<string, { onClick?: unknown }>)[propsKey];
  return typeof props?.onClick === "function" ? props.onClick as () => void : null;
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

  it("keeps the cleanup scope locked while the start request is pending", async () => {
    const runA = makeRun("run-scan-old", "completed", 0, { paths: ["C:/RootA"] });
    const requests: Array<{ scope?: { paths?: string[] }; requestKey?: string | null }> = [];
    let resolveOld: (run: AnalysisRun) => void = () => undefined;
    const startAnalysisRun = vi.fn((request: { scope?: { paths?: string[] }; requestKey?: string | null }) => {
      requests.push(request);
      return new Promise<AnalysisRun>((resolve) => { resolveOld = resolve; });
    });
    const api = commonApi(runA, {
      listAnalysisRuns: async () => [],
      startAnalysisRun,
      getAnalysisRun: vi.fn(async () => runA)
    });
    await act(async () => root.render(createElement(CleanupView, { initialRoots: ["C:/RootA"], api, t })));
    await flush(3);
    await act(async () => scopeButton().click());
    await flush(2);
    expect(startAnalysisRun).toHaveBeenCalledOnce();
    expect(button(t("storageCleanupChooseFolder")).disabled).toBe(true);
    expect(scopeButton().disabled).toBe(true);
    resolveOld(runA);
    await flush(8);
    expect(container.querySelector(`[data-analysis-run-id="${runA.id}"]`)).not.toBeNull();
    expect(scopeButton().disabled).toBe(false);
  });

  it("does not let a settled scan finally clear a newer cancel mutation lock", async () => {
    const running = makeRun("run-scan-cancel-owner", "running");
    const canceled = { ...running, status: "cancelled", phase: "completed" as const };
    let resolveStartDetails: (run: AnalysisRun) => void = () => undefined;
    let resolveCancelDetails: (run: AnalysisRun) => void = () => undefined;
    let detailCalls = 0;
    const startAnalysisRun = vi.fn(async () => running);
    const cancelAnalysisRun = vi.fn(async () => canceled);
    const api = commonApi(running, {
      listAnalysisRuns: async () => [],
      startAnalysisRun,
      cancelAnalysisRun,
      getAnalysisRun: vi.fn(() => {
        detailCalls += 1;
        return new Promise<AnalysisRun>((resolve) => {
          if (detailCalls === 1) resolveStartDetails = resolve;
          else resolveCancelDetails = resolve;
        });
      })
    });

    await act(async () => root.render(createElement(CleanupView, { initialRoots: ["C:/Root"], api, t })));
    await flush(3);
    await act(async () => scopeButton().click());
    await vi.waitFor(() => expect(startAnalysisRun).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(button(t("storageCleanupCancelScan"))).toBeDefined());

    await act(async () => button(t("storageCleanupCancelScan")).click());
    await vi.waitFor(() => expect(cancelAnalysisRun).toHaveBeenCalledOnce());
    expect(scopeButton().disabled).toBe(true);

    resolveStartDetails(running);
    await flush(6);
    expect(scopeButton().disabled).toBe(true);

    resolveCancelDetails(canceled);
    await flush(8);
    expect(scopeButton().disabled).toBe(false);
  });

  it("reports a pending scan failure and releases the cleanup mutation lock", async () => {
    const runA = makeRun("run-scan-error-old", "completed", 0, { paths: ["C:/RootA"] });
    let rejectOld: (error: unknown) => void = () => undefined;
    const startAnalysisRun = vi.fn((request: { scope?: { paths?: string[] }; requestKey?: string | null }) => {
      return new Promise<AnalysisRun>((_, reject) => { rejectOld = reject; });
    });
    const onError = vi.fn();
    const api = commonApi(runA, {
      listAnalysisRuns: async () => [],
      startAnalysisRun,
      getAnalysisRun: vi.fn(async () => runA)
    });
    await act(async () => root.render(createElement(CleanupView, { initialRoots: ["C:/RootA"], api, t, onError })));
    await flush(3);
    await act(async () => scopeButton().click());
    await flush(2);
    expect(startAnalysisRun).toHaveBeenCalledOnce();
    expect(scopeButton().disabled).toBe(true);

    rejectOld(new Error("scope_a_failed"));
    await flush(8);

    expect(onError).toHaveBeenCalledWith(expect.stringContaining("scope_a_failed"));
    expect(scopeButton().disabled).toBe(false);

    await act(async () => scopeButton().click());
    expect(startAnalysisRun).toHaveBeenCalledTimes(2);
  });

  it("does not allow a second scan until the first scan settles", async () => {
    const runA = makeRun("run-scan-lock-old", "completed", 0, { paths: ["C:/RootA"] });
    const runB = makeRun("run-scan-lock-new", "completed", 0, { paths: ["C:/RootB"] });
    const requests: Array<{ scope?: { paths?: string[] }; requestKey?: string | null }> = [];
    let rejectOld: (error: unknown) => void = () => undefined;
    let resolveNew: (run: AnalysisRun) => void = () => undefined;
    const startAnalysisRun = vi.fn((request: { scope?: { paths?: string[] }; requestKey?: string | null }) => {
      requests.push(request);
      if (requests.length === 1) return new Promise<AnalysisRun>((_, reject) => { rejectOld = reject; });
      return new Promise<AnalysisRun>((resolve) => { resolveNew = resolve; });
    });
    const onError = vi.fn();
    const api = commonApi(runA, {
      listAnalysisRuns: async () => [],
      startAnalysisRun,
      getAnalysisRun: vi.fn(async (id: string) => id === runB.id ? runB : runA)
    });
    await act(async () => root.render(createElement(CleanupView, { initialRoots: ["C:/RootA"], api, t, onError })));
    await flush(3);
    await act(async () => scopeButton().click());
    await flush(2);
    expect(startAnalysisRun).toHaveBeenCalledOnce();
    expect(scopeButton().disabled).toBe(true);
    rejectOld(new Error("scope_a_failed"));
    await flush(6);
    expect(onError).toHaveBeenCalledWith(expect.stringContaining("scope_a_failed"));
    expect(scopeButton().disabled).toBe(false);

    await act(async () => scopeButton().click());
    await flush(3);
    expect(startAnalysisRun).toHaveBeenCalledTimes(2);
    expect(scopeButton().disabled).toBe(true);
    resolveNew(runB);
    await flush(8);
    expect(container.querySelector(`[data-analysis-run-id="${runB.id}"]`)).not.toBeNull();
    expect(scopeButton().disabled).toBe(false);
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
    const staleStartHandler = reactOnClick(button("重新核验需确认项目"));
    await act(async () => button("重新核验需确认项目").click());
    await flush(5);
    expect(analyzeCleanupCandidatesWithAI).toHaveBeenCalledOnce();

    await act(async () => button("停止重新核验").click());
    expect(button(t("storageCleanupAIRecheckCanceling")).disabled).toBe(true);
    await act(async () => staleStartHandler?.());
    expect(analyzeCleanupCandidatesWithAI).toHaveBeenCalledOnce();
    resolveBatch([]);
    await flush(5);

    expect(analyzeCleanupCandidatesWithAI).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("重新核验已停止");
    expect(container.textContent).not.toContain("停止重新核验");

    await act(async () => button("重新核验需确认项目").click());
    await flush(5);
    expect(analyzeCleanupCandidatesWithAI).toHaveBeenCalledTimes(2);
    resolveBatch([]);
    await flush(5);
  });

  it("keeps an AI operation owned by the same run when the durable run revision advances", async () => {
    const run = makeRun("run-ai-self-revision", "completed", 1);
    const selected = { ...makeFinding(run, 0), decision: "acknowledged" as const, decisionRevision: 1 };
    let currentRun = run;
    let resolveAI: (value: AnalysisFinding[]) => void = () => undefined;
    let onRunUpdate: ((updated: AnalysisRun) => void) | null = null;
    const analyzeCleanupCandidatesWithAI = vi.fn(() => new Promise<AnalysisFinding[]>((resolve) => { resolveAI = resolve; }));
    const api = commonApi(run, {
      listAnalysisRuns: async () => [run],
      getAnalysisRun: vi.fn(async () => currentRun),
      listAnalysisFindings: async () => ({ findings: [selected], nextCursor: null, limit: 100 }),
      getAnalysisFinding: vi.fn(async () => selected),
      getAISettings: async () => ({ enabled: true, cleanupAiEnabled: true }),
      analyzeCleanupCandidatesWithAI,
      onAnalysisRunUpdated: async (handler: (updated: AnalysisRun) => void) => {
        onRunUpdate = handler;
        return () => undefined;
      }
    });

    await act(async () => root.render(createElement(CleanupView, { api, t })));
    await flush(8);
    await act(async () => button("需人工判断").click());
    await flush(4);
    await act(async () => button("重新核验需确认项目").click());
    await vi.waitFor(() => expect(analyzeCleanupCandidatesWithAI).toHaveBeenCalledOnce());

    currentRun = { ...run, revision: run.revision + 1 };
    await act(async () => onRunUpdate?.(currentRun));
    await flush(6);
    resolveAI([selected]);
    await flush(12);

    expect(api.getAnalysisFinding).toHaveBeenCalledWith(selected.id);
    expect(container.textContent).not.toContain("停止重新核验");
  });

  it("releases AI busy state when cancellation supersedes terminal run refresh", async () => {
    const run = makeRun("run-ai-cancel-refresh", "completed", 1);
    const selected = { ...makeFinding(run, 0), decision: "acknowledged" as const, decisionRevision: 1 };
    let getRunCalls = 0;
    let resolveTerminalRefresh: (value: AnalysisRun) => void = () => undefined;
    const terminalRefresh = new Promise<AnalysisRun>((resolve) => { resolveTerminalRefresh = resolve; });
    const api = commonApi(run, {
      listAnalysisRuns: async () => [run],
      getAnalysisRun: vi.fn(async () => {
        getRunCalls += 1;
        return getRunCalls === 1 ? run : terminalRefresh;
      }),
      listAnalysisFindings: async () => ({ findings: [selected], nextCursor: null, limit: 100 }),
      getAnalysisFinding: vi.fn(async () => selected),
      getAISettings: async () => ({ enabled: true, cleanupAiEnabled: true }),
      analyzeCleanupCandidatesWithAI: vi.fn(async () => [selected])
    });

    await act(async () => root.render(createElement(CleanupView, { api, t })));
    await flush(8);
    await act(async () => button("需人工判断").click());
    await flush(4);
    await act(async () => button("重新核验需确认项目").click());
    await vi.waitFor(() => expect(getRunCalls).toBe(2));

    await act(async () => button("停止重新核验").click());
    resolveTerminalRefresh(run);
    await flush(8);

    expect([...container.querySelectorAll<HTMLButtonElement>("button")].some((item) => item.textContent?.includes("停止重新核验"))).toBe(false);
    expect([...container.querySelectorAll<HTMLButtonElement>("button")].some((item) => item.textContent?.includes("重新核验需确认项目"))).toBe(true);
  });

  it("keeps a saved finding handler locked during AI and mutation work", async () => {
    const run = makeRun("run-toggle-lock", "completed", 1);
    const finding = { ...makeFinding(run, 0), decision: "acknowledged" as const, decisionRevision: 1 };
    let resolveAI: (value: AnalysisFinding[]) => void = () => undefined;
    let resolvePreview: (value: { total: number; previews: never[]; truncated: boolean; hasMore: boolean }) => void = () => undefined;
    const analyzeCleanupCandidatesWithAI = vi.fn(() => new Promise<AnalysisFinding[]>((resolve) => { resolveAI = resolve; }));
    const previewCleanupOperations = vi.fn(() => new Promise<{ total: number; previews: never[]; truncated: boolean; hasMore: boolean }>((resolve) => { resolvePreview = resolve; }));
    const api = commonApi(run, {
      listAnalysisRuns: async () => [run],
      getAnalysisRun: async () => run,
      listAnalysisFindings: async () => ({ findings: [finding], nextCursor: null, limit: 100 }),
      getAnalysisFinding: async () => finding,
      getAISettings: async () => ({ enabled: true, cleanupAiEnabled: true }),
      analyzeCleanupCandidatesWithAI,
      previewCleanupOperations
    });

    await act(async () => root.render(createElement(CleanupView, { api, t })));
    await flush(8);
    await act(async () => button("需人工判断").click());
    await flush(4);

    const aiHandler = reactOnClick(findingButton(finding.id, t("storageCleanupSelectForTrash")));
    expect(aiHandler).toBeTypeOf("function");
    await act(async () => button("重新核验需确认项目").click());
    await vi.waitFor(() => expect(analyzeCleanupCandidatesWithAI).toHaveBeenCalledOnce());
    await act(async () => aiHandler?.());
    expect(container.querySelector("[data-cleanup-selection-summary]")).toBeNull();

    resolveAI([]);
    await flush(10);
    await act(async () => findingButton(finding.id, t("storageCleanupSelectForTrash")).click());
    await flush(2);
    expect(container.querySelector("[data-cleanup-selection-summary]")).not.toBeNull();

    const mutationHandler = reactOnClick(findingButton(finding.id, t("storageCleanupSelected")));
    expect(mutationHandler).toBeTypeOf("function");
    await act(async () => button(t("storageCleanupMoveToSafeTrash")).click());
    await vi.waitFor(() => expect(previewCleanupOperations).toHaveBeenCalledOnce());
    await act(async () => mutationHandler?.());
    expect(container.querySelector("[data-cleanup-selection-summary]")).not.toBeNull();

    resolvePreview({ total: 1, previews: [], truncated: false, hasMore: false });
    await flush(8);
  });

  it("keeps Safe Trash mutation ownership through completion", async () => {
    const run = makeRun("run-safe-trash-lock", "completed", 1);
    const finding = { ...makeFinding(run, 0), decision: "acknowledged" as const, decisionRevision: 1 };
    let resolveMove: (value: { moved: number; skipped: number; failed: number }) => void = () => undefined;
    const previewCleanupOperations = vi.fn(async () => ({ total: 1, previews: [], truncated: false, hasMore: false }));
    const moveCleanupCandidatesToSafeTrash = vi.fn(() => new Promise<{ moved: number; skipped: number; failed: number }>((resolve) => { resolveMove = resolve; }));
    const api = commonApi(run, {
      listAnalysisRuns: async () => [run],
      listAnalysisFindings: async (request: { tier?: string }) => ({ findings: request.tier === "review" ? [finding] : [], nextCursor: null, limit: 100 }),
      getAnalysisRun: async () => run,
      previewCleanupOperations,
      moveCleanupCandidatesToSafeTrash
    });

    await act(async () => root.render(createElement(CleanupView, { api, t })));
    await flush(8);
    await act(async () => button("需人工判断").click());
    await flush(5);
    await act(async () => findingButton(finding.id, t("storageCleanupSelectForTrash")).click());
    await flush(3);

    const stalePreviewHandler = reactOnClick(button(t("storageCleanupMoveToSafeTrash")));
    await act(async () => button(t("storageCleanupMoveToSafeTrash")).click());
    await flush(5);
    expect(previewCleanupOperations).toHaveBeenCalledOnce();

    await act(async () => button(t("storageCleanupPreviewConfirm")).click());
    await flush(3);
    const confirmMove = [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find((item) => item.textContent?.includes(t("storageCleanupMoveToSafeTrash")));
    expect(confirmMove).toBeDefined();
    const staleMoveHandler = reactOnClick(confirmMove!);
    await act(async () => confirmMove?.click());
    await vi.waitFor(() => expect(moveCleanupCandidatesToSafeTrash).toHaveBeenCalledOnce());
    expect(button("需人工判断").disabled).toBe(true);
    expect(button("可安全清理").disabled).toBe(true);
    expect(findingButton(finding.id, t("storageCleanupSelected")).disabled).toBe(true);
    expect(container.querySelector("[data-cleanup-selection-summary]")).not.toBeNull();

    await act(async () => stalePreviewHandler?.());
    await act(async () => staleMoveHandler?.());
    expect(previewCleanupOperations).toHaveBeenCalledOnce();
    expect(moveCleanupCandidatesToSafeTrash).toHaveBeenCalledOnce();

    resolveMove({ moved: 1, skipped: 0, failed: 0 });
    await flush(10);
    expect(container.textContent).toContain(t("storageCleanupExecutionDone"));
    expect(container.querySelector("[data-cleanup-selection-summary]")).toBeNull();
    expect(button("需人工判断").disabled).toBe(false);
  });

  it("removes a selected Review finding after AI returns an authoritative Caution revision and clears preview", async () => {
    const run = makeRun("run-ai-reconcile-caution", "completed", 1);
    const selected = { ...makeFinding(run, 0), decision: "acknowledged" as const, decisionRevision: 1 };
    const caution = { ...selected, tier: "caution", category: "caution", executable: false, decision: null, decisionRevision: null, revision: 2 };
    let aiUpdated = false;
    const listAnalysisFindings = vi.fn(async (request: { tier?: string }) => ({
      findings: request.tier === "review" && !aiUpdated ? [selected] : [],
      nextCursor: null,
      limit: 100
    }));
    const previewCleanupOperations = vi.fn(async () => ({ total: 1, previews: [], truncated: false, hasMore: false }));
    const analyzeCleanupCandidatesWithAI = vi.fn(async () => {
      aiUpdated = true;
      return [{ id: selected.id }] as any;
    });
    const api = commonApi(run, {
      listAnalysisRuns: async () => [run],
      getAnalysisRun: async () => aiUpdated ? { ...run, reviewCount: 0, cautionCount: 1 } : run,
      listAnalysisFindings,
      getAnalysisFinding: async () => aiUpdated ? caution : selected,
      getAISettings: async () => ({ enabled: true, cleanupAiEnabled: true }),
      analyzeCleanupCandidatesWithAI,
      previewCleanupOperations
    });

    await act(async () => root.render(createElement(CleanupView, { api, t })));
    await flush(8);
    await act(async () => button("需人工判断").click());
    await flush(6);
    await act(async () => button(t("storageCleanupSelectForTrash")).click());
    await flush(3);
    expect(container.querySelector("[data-cleanup-selection-summary]")).not.toBeNull();

    await act(async () => button(t("storageCleanupMoveToSafeTrash")).click());
    await flush(4);
    expect(container.textContent).toContain(t("storageCleanupPreviewReadyTitle"));

    await act(async () => button("重新核验需确认项目").click());
    await flush(10);

    expect(analyzeCleanupCandidatesWithAI).toHaveBeenCalledOnce();
    expect(container.querySelector("[data-cleanup-selection-summary]")).toBeNull();
    expect(container.textContent).not.toContain(t("storageCleanupPreviewReadyTitle"));
    expect(previewCleanupOperations).toHaveBeenCalledOnce();
  });

  it("fails closed when a successful AI mutation cannot be read back", async () => {
    const run = makeRun("run-ai-readback-failure", "completed", 1);
    const selected = { ...makeFinding(run, 0), decision: "acknowledged" as const, decisionRevision: 1 };
    const previewCleanupOperations = vi.fn(async () => ({ total: 1, previews: [], truncated: false, hasMore: false }));
    const analyzeCleanupCandidatesWithAI = vi.fn(async () => [{ id: selected.id }] as any);
    const listAnalysisFindings = vi.fn(async (request: { tier?: string }) => ({
      findings: request.tier === "review" ? [selected] : [],
      nextCursor: null,
      limit: 100
    }));
    const api = commonApi(run, {
      listAnalysisRuns: async () => [run],
      listAnalysisFindings,
      getAISettings: async () => ({ enabled: true, cleanupAiEnabled: true }),
      analyzeCleanupCandidatesWithAI,
      getAnalysisFinding: vi.fn(async () => { throw new Error("readback_failed"); }),
      previewCleanupOperations,
      getAnalysisRun: async () => ({ ...run, reviewCount: 1 })
    });

    await act(async () => root.render(createElement(CleanupView, { api, t })));
    await flush(8);
    await act(async () => button("需人工判断").click());
    await flush(5);
    await act(async () => findingButton(selected.id, t("storageCleanupSelectForTrash")).click());
    await flush(2);
    await act(async () => button(t("storageCleanupMoveToSafeTrash")).click());
    await flush(4);
    expect(container.textContent).toContain(t("storageCleanupPreviewReadyTitle"));
    await act(async () => button("重新核验需确认项目").click());
    await flush(10);

    expect(container.querySelector("[data-cleanup-selection-summary]")).toBeNull();
    expect(container.textContent).not.toContain(t("storageCleanupPreviewReadyTitle"));
    expect(container.textContent).toContain("已处理 1");
    expect(container.textContent).toContain("权威读回失败 1");
    expect(container.textContent).not.toContain("AI 更新失败 1");
    expect(previewCleanupOperations).toHaveBeenCalledOnce();
  });

  it("keeps Safe selection while removing only the failed Review readback", async () => {
    const run = makeRun("run-ai-readback-partial", "completed", 2, { safeCount: 1 });
    const safe = makeSafeFinding(run, 0);
    const reviewA = { ...makeFinding(run, 1), decision: "acknowledged" as const, decisionRevision: 1 };
    const reviewB = { ...makeFinding(run, 2), decision: "acknowledged" as const, decisionRevision: 1 };
    const refreshedA = { ...reviewA, revision: 2, decisionRevision: 2, updatedAt: 2 };
    const previewCleanupOperations = vi.fn(async (_runId: string, selections: Array<{ findingId: string }>) => {
      expect(new Set(selections.map((selection) => selection.findingId))).toEqual(new Set([safe.id, reviewA.id]));
      return { total: 2, previews: [], truncated: false, hasMore: false };
    });
    const api = commonApi(run, {
      listAnalysisRuns: async () => [run],
      listAnalysisFindings: async (request: { tier?: string }) => ({
        findings: request.tier === "safe" ? [safe] : request.tier === "review" ? [reviewA, reviewB] : [],
        nextCursor: null,
        limit: 100
      }),
      getAISettings: async () => ({ enabled: true, cleanupAiEnabled: true }),
      analyzeCleanupCandidatesWithAI: async () => [{ id: reviewA.id }, { id: reviewB.id }] as any,
      getAnalysisFinding: vi.fn(async (id: string) => id === reviewA.id ? refreshedA : (() => { throw new Error("partial_readback"); })()),
      previewCleanupOperations,
      getAnalysisRun: async () => run
    });

    await act(async () => root.render(createElement(CleanupView, { api, t })));
    await flush(8);
    await act(async () => button("需人工判断").click());
    await flush(5);
    await act(async () => findingButton(reviewA.id, t("storageCleanupSelectForTrash")).click());
    await act(async () => findingButton(reviewB.id, t("storageCleanupSelectForTrash")).click());
    await flush(2);
    await act(async () => button("重新核验需确认项目").click());
    await flush(10);

    expect(container.querySelector("[data-cleanup-selection-summary]")).not.toBeNull();
    await act(async () => button(t("storageCleanupMoveToSafeTrash")).click());
    await flush(4);
    expect(previewCleanupOperations).toHaveBeenCalledOnce();
  });

  it("removes uncertain selections conservatively when the AI mutation fails", async () => {
    const run = makeRun("run-ai-mutation-failure", "completed", 1);
    const selected = { ...makeFinding(run, 0), decision: "acknowledged" as const, decisionRevision: 1 };
    const analyzeCleanupCandidatesWithAI = vi.fn(async () => { throw new Error("ai_failed_after_partial_persist"); });
    const api = commonApi(run, {
      listAnalysisRuns: async () => [run],
      listAnalysisFindings: async (request: { tier?: string }) => ({ findings: request.tier === "review" ? [selected] : [], nextCursor: null, limit: 100 }),
      getAISettings: async () => ({ enabled: true, cleanupAiEnabled: true }),
      analyzeCleanupCandidatesWithAI,
      getAnalysisFinding: async () => selected,
      getAnalysisRun: async () => run
    });

    await act(async () => root.render(createElement(CleanupView, { api, t })));
    await flush(8);
    await act(async () => button("需人工判断").click());
    await flush(5);
    await act(async () => findingButton(selected.id, t("storageCleanupSelectForTrash")).click());
    await flush(2);
    await act(async () => button("重新核验需确认项目").click());
    await flush(10);

    expect(container.querySelector("[data-cleanup-selection-summary]")).toBeNull();
    expect(container.textContent).toContain("AI 更新失败 1");
  });

  it("does not let a pending AI recheck change the active tier", async () => {
    const run = makeRun("run-ai-tier-race", "completed", 1, { safeCount: 1 });
    const review = { ...makeFinding(run, 0), decision: "acknowledged" as const, decisionRevision: 1 };
    const safe = makeSafeFinding(run, 1);
    let resolveAI: (value: any[]) => void = () => undefined;
    const api = commonApi(run, {
      listAnalysisRuns: async () => [run],
      listAnalysisFindings: async (request: { tier?: string }) => ({ findings: request.tier === "review" ? [review] : request.tier === "safe" ? [safe] : [], nextCursor: null, limit: 100 }),
      getAISettings: async () => ({ enabled: true, cleanupAiEnabled: true }),
      analyzeCleanupCandidatesWithAI: vi.fn(() => new Promise<any[]>((resolve) => { resolveAI = resolve; })),
      getAnalysisFinding: async () => review,
      getAnalysisRun: async () => run
    });

    await act(async () => root.render(createElement(CleanupView, { api, t })));
    await flush(8);
    await act(async () => button("需人工判断").click());
    await flush(5);
    await act(async () => button("重新核验需确认项目").click());
    await flush(5);
    await act(async () => button("可安全清理").click());
    await flush(5);
    expect(button("需人工判断").getAttribute("aria-pressed")).toBe("true");
    expect(button("可安全清理").disabled).toBe(true);
    resolveAI([{ id: review.id }]);
    await flush(10);

    expect(container.querySelector('[data-analysis-finding-id="finding-0"]')).not.toBeNull();
    expect(container.querySelector('[data-analysis-finding-id="finding-1"]')).toBeNull();
  });

  it("does not let a pending Review acknowledgement change the active tier", async () => {
    const run = makeRun("run-ack-tier-race", "completed", 1);
    const review = makeFinding(run, 0);
    const caution = { ...review, id: "finding-caution", tier: "caution" as const, category: "caution" as const, executable: false, requiresConfirmation: false, revision: 2 };
    let resolveDecision: (value: { decision: "acknowledged" }) => void = () => undefined;
    const setAnalysisFindingDecision = vi.fn(() => new Promise<{ decision: "acknowledged" }>((resolve) => { resolveDecision = resolve; }));
    const api = commonApi(run, {
      listAnalysisRuns: async () => [run],
      listAnalysisFindings: async (request: { tier?: string }) => ({
        findings: request.tier === "review" ? [review] : request.tier === "caution" ? [caution] : [],
        nextCursor: null,
        limit: 100
      }),
      getAnalysisFinding: async () => review,
      setAnalysisFindingDecision,
      getAnalysisRun: async () => run
    });

    await act(async () => root.render(createElement(CleanupView, { api, t })));
    await flush(8);
    await act(async () => button("需人工判断").click());
    await flush(5);
    await act(async () => findingButton(review.id, t("storageCleanupFindingAcknowledge")).click());
    await flush(3);
    await act(async () => button(t("storageCleanupReviewConfirmAction")).click());
    await flush(3);
    expect(setAnalysisFindingDecision).toHaveBeenCalledOnce();

    await act(async () => button("谨慎处理").click());
    await flush(5);
    expect(button("需人工判断").getAttribute("aria-pressed")).toBe("true");
    expect(button("谨慎处理").disabled).toBe(true);
    resolveDecision({ decision: "acknowledged" });
    await flush(8);

    expect(container.querySelector('[data-analysis-finding-id="finding-0"]')).not.toBeNull();
    expect(container.querySelector('[data-analysis-finding-id="finding-caution"]')).toBeNull();
  });

  it("does not let a pending stale-finding revalidation change the active tier", async () => {
    const run = makeRun("run-revalidate-tier-race", "completed", 1, { safeCount: 1 });
    const staleReview = { ...makeFinding(run, 0), status: "stale" as const };
    const safe = makeSafeFinding(run, 1);
    let resolveRevalidation: (value: AnalysisFinding) => void = () => undefined;
    const revalidateAnalysisFinding = vi.fn(() => new Promise<AnalysisFinding>((resolve) => { resolveRevalidation = resolve; }));
    const api = commonApi(run, {
      listAnalysisRuns: async () => [run],
      listAnalysisFindings: async (request: { tier?: string }) => ({
        findings: request.tier === "review" ? [staleReview] : request.tier === "safe" ? [safe] : [],
        nextCursor: null,
        limit: 100
      }),
      revalidateAnalysisFinding,
      getAnalysisRun: async () => run
    });

    await act(async () => root.render(createElement(CleanupView, { api, t })));
    await flush(8);
    await act(async () => button("需人工判断").click());
    await flush(5);
    await act(async () => findingButton(staleReview.id, t("storageCleanupFindingRecheck")).click());
    await flush(3);
    expect(revalidateAnalysisFinding).toHaveBeenCalledOnce();

    await act(async () => button("可安全清理").click());
    await flush(5);
    expect(button("需人工判断").getAttribute("aria-pressed")).toBe("true");
    expect(button("可安全清理").disabled).toBe(true);
    resolveRevalidation({ ...staleReview, status: "active", revision: 2 });
    await flush(8);

    expect(container.querySelector('[data-analysis-finding-id="finding-0"]')).not.toBeNull();
    expect(container.querySelector('[data-analysis-finding-id="finding-1"]')).toBeNull();
  });

  it("keeps a selected Review finding on a new authoritative revision and uses that revision for Preview", async () => {
    const run = makeRun("run-ai-reconcile-review", "completed", 1);
    const selected = { ...makeFinding(run, 0), decision: "acknowledged" as const, decisionRevision: 1 };
    const refreshed = { ...selected, revision: 2, decisionRevision: 2, updatedAt: 2 };
    let aiUpdated = false;
    const listAnalysisFindings = vi.fn(async (request: { tier?: string }) => ({
      findings: request.tier === "review" ? [aiUpdated ? refreshed : selected] : [],
      nextCursor: null,
      limit: 100
    }));
    const previewCleanupOperations = vi.fn(async (_runId: string, selections: Array<{ findingId: string; expectedRevision: number; reviewConfirmation?: { decisionRevision: number } }>) => {
      expect(selections).toEqual([{ findingId: selected.id, expectedRevision: 2, reviewConfirmation: { decisionRevision: 2 } }]);
      return { total: 1, previews: [], truncated: false, hasMore: false };
    });
    const analyzeCleanupCandidatesWithAI = vi.fn(async () => {
      aiUpdated = true;
      return [{ id: selected.id }] as any;
    });
    const api = commonApi(run, {
      listAnalysisRuns: async () => [run],
      getAnalysisRun: async () => run,
      listAnalysisFindings,
      getAnalysisFinding: async () => refreshed,
      getAISettings: async () => ({ enabled: true, cleanupAiEnabled: true }),
      analyzeCleanupCandidatesWithAI,
      previewCleanupOperations
    });

    await act(async () => root.render(createElement(CleanupView, { api, t })));
    await flush(8);
    await act(async () => button("需人工判断").click());
    await flush(6);
    await act(async () => button(t("storageCleanupSelectForTrash")).click());
    await flush(3);
    await act(async () => button("重新核验需确认项目").click());
    await flush(10);

    expect(container.querySelector("[data-cleanup-selection-summary]")).not.toBeNull();
    await act(async () => button(t("storageCleanupMoveToSafeTrash")).click());
    await flush(4);
    expect(previewCleanupOperations).toHaveBeenCalledOnce();
  });

  it("preserves safe and skipped selections while reconciling only returned authoritative findings", () => {
    const run = makeRun("run-ai-reconcile-pure", "completed", 1, { safeCount: 1 });
    const safe = makeSafeFinding(run, 0);
    const review = { ...makeFinding(run, 1), decision: "acknowledged" as const, decisionRevision: 1 };
    const caution = { ...review, tier: "caution", executable: false, revision: 2 };
    expect(reconcileAuthoritativeFindingUpdates(new Set([safe.id, review.id]), [caution])).toEqual(new Set([safe.id]));
    expect(reconcileAuthoritativeFindingUpdates(new Set([safe.id, review.id]), [])).toEqual(new Set([safe.id, review.id]));
  });

  it("keeps the cleanup scope locked while an AI result is pending", async () => {
    const run = makeRun("run-ai-scope-race", "completed", 1, { paths: ["C:/RootA"] });
    const selected = { ...makeFinding(run, 0), decision: "acknowledged" as const, decisionRevision: 1 };
    let resolveAI: (value: any[]) => void = () => undefined;
    const analyzeCleanupCandidatesWithAI = vi.fn(() => new Promise<any[]>((resolve) => { resolveAI = resolve; }));
    const getAnalysisFinding = vi.fn(async () => selected);
    const api = commonApi(run, {
      listAnalysisRuns: async () => [run],
      getAnalysisRun: async () => run,
      listAnalysisFindings: async (request: { tier?: string }) => ({
        findings: request.tier === "review" ? [selected] : [],
        nextCursor: null,
        limit: 100
      }),
      getAnalysisFinding,
      getAISettings: async () => ({ enabled: true, cleanupAiEnabled: true }),
      analyzeCleanupCandidatesWithAI
    });
    dialogMocks.open.mockResolvedValue("C:/RootB");

    await act(async () => root.render(createElement(CleanupView, { initialRoots: ["C:/RootA"], api, t })));
    await flush(8);
    await act(async () => button("需人工判断").click());
    await flush(6);
    await act(async () => button("重新核验需确认项目").click());
    await flush(5);
    expect(analyzeCleanupCandidatesWithAI).toHaveBeenCalledOnce();

    await act(async () => button(t("storageCleanupChooseFolder")).click());
    await flush(4);
    expect(dialogMocks.open).not.toHaveBeenCalled();
    resolveAI([{ id: selected.id }]);
    await flush(8);

    expect(getAnalysisFinding).toHaveBeenCalledWith(selected.id);
    expect(container.textContent).toContain("C:/RootA");
    expect(container.querySelector(`[data-analysis-run-id="${run.id}"]`)).not.toBeNull();
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

  it("does not hydrate the newest run when it belongs to a different initial scope", async () => {
    const runA = makeRun("run-latest-a", "completed", 0, { paths: ["C:/RootA"], safeCount: 1 });
    const getAnalysisRun = vi.fn(async () => runA);
    const api = commonApi(runA, {
      listAnalysisRuns: async () => [runA],
      getAnalysisRun
    });

    await act(async () => root.render(createElement(CleanupView, { initialRoots: ["C:/RootB"], api, t })));
    await flush(6);

    expect(getAnalysisRun).not.toHaveBeenCalled();
    expect(container.querySelector(`[data-analysis-run-id="${runA.id}"]`)).toBeNull();
    expect(container.querySelector("[data-cleanup-selection-summary]")).toBeNull();
    expect(container.textContent).toContain("C:/RootB");
    expect(container.textContent).not.toContain("C:/RootA");
  });

  it("hydrates the older run that exactly matches the requested scope", async () => {
    const runA = makeRun("run-latest-a", "completed", 0, { paths: ["C:/RootA"], safeCount: 1 });
    const runB = makeRun("run-older-b", "completed", 0, { paths: ["c:\\RootB\\"], safeCount: 1 });
    const getAnalysisRun = vi.fn(async (id: string) => id === runB.id ? runB : runA);
    const api = commonApi(runA, {
      listAnalysisRuns: async () => [runA, runB],
      getAnalysisRun,
      listAnalysisFindings: async (request: { tier?: string }) => ({
        findings: request.tier === "safe" ? [makeSafeFinding(runB, 0)] : [],
        nextCursor: null,
        limit: 100
      })
    });

    await act(async () => root.render(createElement(CleanupView, { initialRoots: ["C:/RootB"], api, t })));
    await flush(8);

    expect(getAnalysisRun).toHaveBeenCalledWith(runB.id);
    expect(getAnalysisRun).not.toHaveBeenCalledWith(runA.id);
    expect(container.querySelector(`[data-analysis-run-id="${runB.id}"]`)).not.toBeNull();
    expect(container.querySelector(`[data-analysis-run-id="${runA.id}"]`)).toBeNull();
  });

  it("hydrates the newest legal cleanup run and restores its scope when no scope was selected", async () => {
    const runA = makeRun("run-empty-scope-a", "completed", 0, { paths: ["C:/RootA"], safeCount: 1 });
    const getAnalysisRun = vi.fn(async () => runA);
    const api = commonApi(runA, {
      listAnalysisRuns: async () => [runA],
      getAnalysisRun
    });

    await act(async () => root.render(createElement(CleanupView, { api, t })));
    await flush(8);

    expect(getAnalysisRun).toHaveBeenCalledWith(runA.id);
    expect(container.querySelector(`[data-analysis-run-id="${runA.id}"]`)).not.toBeNull();
    expect(container.textContent).toContain("C:/RootA");
  });

  it("does not let a delayed hydration response replace a newly selected scope", async () => {
    const runA = makeRun("run-delayed-a", "completed", 0, { paths: ["C:/RootA"], safeCount: 1 });
    let resolveRuns: (runs: AnalysisRun[]) => void = () => undefined;
    const listAnalysisRuns = vi.fn(() => new Promise<AnalysisRun[]>((resolve) => {
      resolveRuns = resolve;
    }));
    const getAnalysisRun = vi.fn(async () => runA);
    const api = commonApi(runA, { listAnalysisRuns, getAnalysisRun });

    await act(async () => root.render(createElement(CleanupView, { initialRoots: ["C:/RootA"], api, t })));
    await flush(2);
    await act(async () => root.render(createElement(CleanupView, { initialRoots: ["C:/RootB"], api, t })));
    await flush(2);
    await act(async () => resolveRuns([runA]));
    await flush(6);

    expect(getAnalysisRun).not.toHaveBeenCalled();
    expect(container.querySelector(`[data-analysis-run-id="${runA.id}"]`)).toBeNull();
    expect(container.textContent).toContain("C:/RootB");
    expect(container.textContent).not.toContain("C:/RootA");
  });

  it("hydrates a durable run when initialRoots contain canonical duplicate paths", async () => {
    const run = makeRun("run-canonical-b", "completed", 0, { paths: ["C:/RootB"], safeCount: 1 });
    const getAnalysisRun = vi.fn(async () => run);
    const api = commonApi(run, {
      listAnalysisRuns: async () => [run],
      getAnalysisRun
    });

    await act(async () => root.render(createElement(CleanupView, {
      initialRoots: ["C:/RootB", "c:\\RootB\\", "C:\\ROOTB"],
      api,
      t
    })));
    await flush(8);

    expect(getAnalysisRun).toHaveBeenCalledWith(run.id);
    expect(container.querySelector(`[data-analysis-run-id="${run.id}"]`)).not.toBeNull();
    expect(container.textContent).toContain("C:/RootB");
  });

  it("matches canonical duplicate roots regardless of order", async () => {
    const run = makeRun("run-canonical-ab", "completed", 0, { paths: ["c:\\rootb\\", "C:/ROOTA"], safeCount: 1 });
    const getAnalysisRun = vi.fn(async () => run);
    const api = commonApi(run, {
      listAnalysisRuns: async () => [run],
      getAnalysisRun
    });

    await act(async () => root.render(createElement(CleanupView, {
      initialRoots: ["C:/RootA", "C:/RootB", "c:\\roota\\"],
      api,
      t
    })));
    await flush(8);

    expect(getAnalysisRun).toHaveBeenCalledWith(run.id);
    expect(container.querySelector(`[data-analysis-run-id="${run.id}"]`)).not.toBeNull();
  });

  it("does not match a two-root scope with a one-root durable run", async () => {
    const run = makeRun("run-only-a", "completed", 0, { paths: ["C:/RootA"], safeCount: 1 });
    const getAnalysisRun = vi.fn(async () => run);
    const api = commonApi(run, {
      listAnalysisRuns: async () => [run],
      getAnalysisRun
    });

    await act(async () => root.render(createElement(CleanupView, {
      initialRoots: ["C:/RootA", "C:/RootB"],
      api,
      t
    })));
    await flush(8);

    expect(getAnalysisRun).not.toHaveBeenCalled();
    expect(container.querySelector(`[data-analysis-run-id="${run.id}"]`)).toBeNull();
  });

  it("deduplicates canonical roots in a new scan request while preserving the first display path", async () => {
    const run = makeRun("run-new-scan", "completed", 0, { paths: ["C:/RootA", "C:/RootB"] });
    const requests: Array<{ scope?: { paths?: string[] } }> = [];
    const startAnalysisRun = vi.fn(async (request: { scope?: { paths?: string[] } }) => {
      requests.push(request);
      return run;
    });
    const api = commonApi(run, {
      listAnalysisRuns: async () => [],
      startAnalysisRun,
      getAnalysisRun: vi.fn(async () => run)
    });

    await act(async () => root.render(createElement(CleanupView, {
      initialRoots: ["C:/RootA", "c:\\roota\\", "C:/RootB", "C:\\ROOTB"],
      api,
      t
    })));
    await flush(6);
    await act(async () => scopeButton().click());
    await flush(8);

    expect(startAnalysisRun).toHaveBeenCalledOnce();
    expect(requests[0]?.scope?.paths).toEqual(["C:/RootA", "C:/RootB"]);
  });

  it("remeasures an expanded virtual finding row before positioning the following row", async () => {
    const run = makeRun("run-virtual-measure", "completed", 0, { safeCount: 2 });
    const nativeOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get() {
        const findingId = this.getAttribute("data-analysis-finding-id");
        if (findingId === "finding-0" && this.querySelector("[data-finding-evidence]")) return 420;
        if (findingId) return 238;
        return 600;
      }
    });
    const api = commonApi(run, {
      listAnalysisRuns: async () => [run],
      getAnalysisRun: async () => run,
      listAnalysisFindings: async (request: { tier?: string }) => ({
        findings: request.tier === "safe" ? [makeSafeFinding(run, 0), makeSafeFinding(run, 1)] : [],
        nextCursor: null,
        limit: 100
      }),
      listAnalysisFindingEvidence: async () => [{ id: "evidence-0", findingId: "finding-0", evidenceKind: "path", subjectKind: "file", subjectId: null, pathSnapshot: "C:/Root/item-0", value: {}, createdAt: 1 }]
    });

    try {
      await act(async () => root.render(createElement(CleanupView, { api, t })));
      await flush(8);
      const virtualList = container.querySelector<HTMLElement>("[data-cleanup-findings] .relative");
      const initialTotalSize = Number.parseFloat(virtualList?.style.height ?? "0");
      const secondRow = container.querySelector<HTMLElement>('[data-analysis-finding-id="finding-1"]');
      expect(secondRow?.style.transform).toBe("translateY(238px)");

      const evidenceButton = [...(container.querySelector('[data-analysis-finding-id="finding-0"]')?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((button) => button.textContent?.includes("查看证据"));
      expect(evidenceButton).toBeDefined();
      await act(async () => evidenceButton?.click());
      await flush(8);

      expect(container.querySelector('[data-analysis-finding-id="finding-0"] [data-finding-evidence]')).not.toBeNull();
      expect(Number.parseFloat(virtualList?.style.height ?? "0")).toBeGreaterThan(initialTotalSize);
      expect(container.querySelector<HTMLElement>('[data-analysis-finding-id="finding-1"]')?.style.transform).toBe("translateY(420px)");
    } finally {
      if (nativeOffsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", nativeOffsetHeight);
      else delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight;
    }
  });

  it("keeps two concurrently loaded evidence panels expanded", async () => {
    const run = makeRun("run-evidence-race", "completed", 0, { safeCount: 2 });
    const first = makeSafeFinding(run, 0);
    const second = makeSafeFinding(run, 1);
    let resolveFirst: (value: any[]) => void = () => undefined;
    let resolveSecond: (value: any[]) => void = () => undefined;
    const evidence = (findingId: string) => [{ id: `evidence-${findingId}`, findingId, evidenceKind: "path", subjectKind: "file", subjectId: null, pathSnapshot: `C:/Root/${findingId}`, value: {}, createdAt: 1 }];
    const api = commonApi(run, {
      listAnalysisRuns: async () => [run],
      listAnalysisFindings: async (request: { tier?: string }) => ({ findings: request.tier === "safe" ? [first, second] : [], nextCursor: null, limit: 100 }),
      listAnalysisFindingEvidence: vi.fn((findingId: string) => findingId === first.id
        ? new Promise<any[]>((resolve) => { resolveFirst = resolve; })
        : new Promise<any[]>((resolve) => { resolveSecond = resolve; }))
    });

    await act(async () => root.render(createElement(CleanupView, { api, t })));
    await flush(8);
    await act(async () => findingButton(first.id, "查看证据").click());
    await act(async () => findingButton(second.id, "查看证据").click());
    resolveSecond(evidence(second.id));
    resolveFirst(evidence(first.id));
    await flush(8);

    expect(container.querySelector(`[data-analysis-finding-id="${first.id}"] [data-finding-evidence]`)).not.toBeNull();
    expect(container.querySelector(`[data-analysis-finding-id="${second.id}"] [data-finding-evidence]`)).not.toBeNull();
  });

  it("matches Windows extended-length drive and UNC paths", async () => {
    const driveRun = makeRun("run-extended-drive", "completed", 0, { paths: ["C:/Root"], safeCount: 1 });
    const uncRun = makeRun("run-extended-unc", "completed", 0, { paths: ["\\\\server\\share"], safeCount: 1 });
    const getAnalysisRun = vi.fn(async (id: string) => id === driveRun.id ? driveRun : uncRun);
    const driveApi = commonApi(driveRun, {
      listAnalysisRuns: async () => [driveRun],
      getAnalysisRun
    });

    await act(async () => root.render(createElement(CleanupView, {
      initialRoots: ["\\\\?\\C:\\Root"],
      api: driveApi,
      t
    })));
    await flush(8);
    expect(getAnalysisRun).toHaveBeenCalledWith(driveRun.id);

    act(() => root.unmount());
    document.body.innerHTML = '<div id="test-root"></div>';
    container = document.getElementById("test-root") as HTMLDivElement;
    root = createRoot(container);
    const uncApi = commonApi(uncRun, {
      listAnalysisRuns: async () => [uncRun],
      getAnalysisRun
    });
    await act(async () => root.render(createElement(CleanupView, {
      initialRoots: ["\\\\?\\UNC\\server\\share"],
      api: uncApi,
      t
    })));
    await flush(8);

    expect(getAnalysisRun).toHaveBeenCalledWith(uncRun.id);
  });
});
