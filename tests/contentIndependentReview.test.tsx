// @vitest-environment happy-dom

import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tauriApi } from "../src/api/tauriApi";
import { makeTranslator } from "../src/i18n";
import type { ContentScopePolicy, FileLibraryDetail } from "../src/types/domain";
import { resetModalInfrastructureForTests } from "../src/components/modal/ModalPortal";
import { ContentUnderstandingSheet, type ContentRefreshResult } from "../src/views/vault/components/ContentUnderstandingSheet";

const t = makeTranslator("zh");
let root: Root;
let container: HTMLDivElement;

const policy: ContentScopePolicy = {
  rootId: "root-content",
  rootRevision: 4,
  enabled: true,
  extractorFamilies: ["plain_text"],
  maxBytes: 1024,
  maxChars: 1024,
  maxPages: 10,
  maxRows: 10,
  rawRetentionMode: "none",
  rawRetentionChars: 0,
  localAllowed: true,
  cloudAllowed: false,
  policyRevision: 2,
  updatedAt: 1
};

function detail(overrides: Partial<FileLibraryDetail> = {}): FileLibraryDetail {
  return {
    id: "file-content",
    name: "notes.txt",
    path: "C:/Root/notes.txt",
    directory: "C:/Root",
    extension: "txt",
    size: 100,
    modifiedAt: 1,
    createdAt: 1,
    isDirectory: false,
    fileType: "Document",
    purpose: "Work",
    lifecycle: "Active",
    context: "notes",
    risk: "Normal",
    confidence: 0.9,
    classificationStatus: "classified",
    classificationReason: "rule",
    matchedRules: [],
    suggestedAction: "Keep",
    suggestedTargetPath: "C:/Root/notes.txt",
    suggestedName: "notes.txt",
    isDuplicate: false,
    requiresReview: false,
    isStale: false,
    lastSeenAt: 1,
    scanRootId: "root-content",
    scanRootName: "Root",
    scopeHealth: "healthy",
    duplicateGroupId: null,
    duplicateGroupSize: 0,
    tags: [],
    activeFindings: [],
    safeActions: [],
    revision: 7,
    contentStatus: "ready",
    contentPolicy: "enabled",
    contentSummary: "Old summary",
    contentKeywords: ["old"],
    contentLanguage: "en",
    contentProvenance: "local",
    contentTruncated: false,
    contentTextRetained: false,
    contentRevision: 2,
    ...overrides
  };
}

function contentRun(overrides: Record<string, unknown> = {}) {
  return {
    id: "content-run-race",
    scope: { kind: "roots", scanRootIds: ["root-content"] },
    mode: "local",
    providerMode: "none",
    status: "running",
    expectedLibraryRevision: 7,
    candidateFingerprint: "candidate",
    candidateResolver: "managed",
    byteBudget: 1024,
    charBudget: 1024,
    requestedCount: 3,
    materializedCount: 3,
    completedCount: 0,
    blockedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    providerRevision: 0,
    providerConfirmed: false,
    cancelRequested: false,
    revision: 1,
    lastErrorCode: null,
    lastErrorDetail: null,
    createdAt: 1,
    updatedAt: 1,
    completedAt: null,
    ...overrides
  } as any;
}

function contentPreview() {
  return {
    version: 1,
    requestId: "content-preview",
    scopeHealth: { scope: { kind: "roots", scanRootIds: ["root-content"] }, health: { state: "healthy", roots: [], invalidReferences: [], message: null }, rootIds: ["root-content"], policyRevisions: [] },
    exactCount: 1,
    deferredCount: 0,
    exactState: "exact",
    candidateResolver: "managed",
    candidateFingerprint: "candidate",
    perFileByteBudget: 1024,
    perFileCharBudget: 1024,
    totalByteBudget: 1024,
    totalCharBudget: 1024,
    byteBudget: 1024,
    charBudget: 1024,
    supportedCount: 1,
    unsupportedCount: 0,
    blockedCount: 0,
    failedCount: 0,
    supportedFormats: ["txt"],
    unsupportedFormats: [],
    blockedReasons: [],
    localAllowed: true,
    cloudAllowed: false,
    rawRetentionDisclosure: "none",
    sample: [],
    libraryRevision: 7,
    policyFingerprint: "policy",
    previewFingerprint: "preview",
    requiresConfirmation: true
  } as never;
}

async function flush(count = 3) {
  for (let index = 0; index < count; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function flushMicrotasks(count = 8) {
  for (let index = 0; index < count; index += 1) {
    await act(async () => { await Promise.resolve(); });
  }
}

function findButton(text: string): HTMLButtonElement {
  const button = [...document.body.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes(text));
  if (!button) throw new Error(`button not found: ${text}`);
  return button;
}

function Harness() {
  const [current, setCurrent] = useState(() => detail());
  const refresh = async () => {
    const refreshed = await tauriApi.getFileLibraryDetail(current.id);
    const refreshedPolicy = refreshed.scanRootId
      ? await tauriApi.getContentScopePolicy(refreshed.scanRootId)
      : null;
    setCurrent(refreshed);
    return { status: "applied" as const, detail: refreshed, policy: refreshedPolicy };
  };
  return <ContentUnderstandingSheet open detail={current} t={t} onClose={() => undefined} onRefreshAuthoritativeContentState={refresh} />;
}

describe("Content Understanding independent review behavior", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="test-root"></div>';
    container = document.getElementById("test-root") as HTMLDivElement;
    root = createRoot(container);
    vi.spyOn(tauriApi, "getContentScopePolicy").mockResolvedValue(policy);
    vi.spyOn(tauriApi, "listContentRuns").mockResolvedValue([]);
  });

  afterEach(() => {
    act(() => root.unmount());
    resetModalInfrastructureForTests();
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("refreshes the open sheet after rebuild and uses the refreshed revision for delete", async () => {
    const rebuilt = detail({ revision: 8, contentRevision: 3, contentSummary: "New summary", contentKeywords: ["new"] });
    const purged = detail({ revision: 9, contentRevision: null, contentSummary: null, contentKeywords: [] });
    const getDetail = vi.spyOn(tauriApi, "getFileLibraryDetail").mockResolvedValueOnce(rebuilt).mockResolvedValueOnce(purged);
    const rebuild = vi.spyOn(tauriApi, "rebuildContentArtifact").mockResolvedValue({} as never);
    const remove = vi.spyOn(tauriApi, "deleteContentArtifact").mockResolvedValue(true);

    await act(async () => root.render(createElement(Harness)));
    await flush();
    expect(container.textContent).toContain("Old summary");

    await act(async () => findButton("重建内容").click());
    const confirmRebuild = [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find((button) => button.textContent === "确认");
    await act(async () => confirmRebuild?.click());
    await flush();
    expect(rebuild).toHaveBeenCalledWith("file-content", 2, true);
    expect(container.textContent).toContain("New summary");
    expect(container.textContent).toContain("new");

    await act(async () => findButton("删除内容数据").click());
    const confirmDelete = [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find((button) => button.textContent === "确认");
    await act(async () => confirmDelete?.click());
    await flush();
    expect(remove).toHaveBeenCalledWith("file-content", 3, true);
    expect(getDetail).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("当前文件还没有内容产物");
  });

  it("refreshes the detail and explains a revision conflict", async () => {
    const refreshed = detail({ revision: 9, contentRevision: 4, contentSummary: "Concurrent summary", contentKeywords: ["concurrent"] });
    const getDetail = vi.spyOn(tauriApi, "getFileLibraryDetail").mockResolvedValue(refreshed);
    const rebuild = vi.spyOn(tauriApi, "rebuildContentArtifact").mockRejectedValue(new Error("content_revision_conflict"));

    await act(async () => root.render(createElement(Harness)));
    await flush();
    await act(async () => findButton("重建内容").click());
    const confirmRebuild = [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find((button) => button.textContent === "确认");
    await act(async () => confirmRebuild?.click());
    await flush();

    expect(rebuild).toHaveBeenCalledWith("file-content", 2, true);
    expect(getDetail).toHaveBeenCalledWith("file-content");
    expect(container.textContent).toContain("内容或策略状态已变化，请基于最新状态重新确认。");
    expect(container.textContent).toContain("Concurrent summary");
  });

  it("refreshes policy after a save conflict and uses the new revision on a manual retry", async () => {
    const refreshed = detail({ revision: 9, contentRevision: 4, contentSummary: "Concurrent policy summary" });
    const latestPolicy = { ...policy, rootRevision: 5, policyRevision: 3, enabled: false };
    const getDetail = vi.spyOn(tauriApi, "getFileLibraryDetail").mockResolvedValue(refreshed);
    const getPolicy = vi.spyOn(tauriApi, "getContentScopePolicy")
      .mockResolvedValueOnce(policy)
      .mockResolvedValueOnce(latestPolicy)
      .mockResolvedValue(latestPolicy);
    const save = vi.spyOn(tauriApi, "setContentScopePolicy")
      .mockRejectedValueOnce(new Error("content_policy_revision_conflict"))
      .mockResolvedValue(latestPolicy);

    await act(async () => root.render(createElement(Harness)));
    await flush();
    await act(async () => findButton("保存根目录策略").click());
    const firstConfirm = [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find((button) => button.textContent === "确认");
    await act(async () => firstConfirm?.click());
    await flush();

    expect(save).toHaveBeenNthCalledWith(1, expect.objectContaining({ expectedRootRevision: 4, expectedPolicyRevision: 2 }));
    expect(getDetail).toHaveBeenCalledWith("file-content");
    expect(getPolicy).toHaveBeenCalledWith("root-content");
    expect(container.textContent).toContain("内容或策略状态已变化，请基于最新状态重新确认。");

    await act(async () => findButton("保存根目录策略").click());
    const secondConfirm = [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find((button) => button.textContent === "确认");
    await act(async () => secondConfirm?.click());
    await flush();
    expect(save).toHaveBeenNthCalledWith(2, expect.objectContaining({ expectedRootRevision: 5, expectedPolicyRevision: 3 }));
    expect(getDetail).toHaveBeenCalledTimes(2);
  });

  it("refreshes policy after purge conflict without automatically retrying", async () => {
    const refreshed = detail({ revision: 10, contentRevision: 4, contentSummary: "Purge changed" });
    const latestPolicy = { ...policy, rootRevision: 6, policyRevision: 4 };
    vi.spyOn(tauriApi, "getFileLibraryDetail").mockResolvedValue(refreshed);
    vi.spyOn(tauriApi, "getContentScopePolicy")
      .mockResolvedValueOnce(policy)
      .mockResolvedValueOnce(latestPolicy)
      .mockResolvedValue(latestPolicy);
    const purge = vi.spyOn(tauriApi, "purgeContentScope")
      .mockRejectedValueOnce(new Error("content_policy_revision_conflict"))
      .mockResolvedValue(0);

    await act(async () => root.render(createElement(Harness)));
    await flush();
    await act(async () => findButton("清空此根目录内容").click());
    const firstConfirm = [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find((button) => button.textContent === "确认");
    await act(async () => firstConfirm?.click());
    await flush();
    expect(purge).toHaveBeenCalledOnce();
    expect(purge.mock.calls[0]?.[0]?.expectedPolicyRevisions[0]).toMatchObject({ rootRevision: 4, policyRevision: 2 });
    expect(container.textContent).toContain("内容或策略状态已变化，请基于最新状态重新确认。");

    await act(async () => findButton("清空此根目录内容").click());
    const secondConfirm = [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find((button) => button.textContent === "确认");
    await act(async () => secondConfirm?.click());
    await flush();
    expect(purge).toHaveBeenCalledTimes(2);
    expect(purge.mock.calls[1]?.[0]?.expectedPolicyRevisions[0]).toMatchObject({ rootRevision: 6, policyRevision: 4 });
  });

  it("keeps the conflict error and does not retry when authoritative refresh fails", async () => {
    const getDetail = vi.spyOn(tauriApi, "getFileLibraryDetail").mockRejectedValue(new Error("detail_refresh_failed"));
    const save = vi.spyOn(tauriApi, "setContentScopePolicy").mockRejectedValue(new Error("content_policy_revision_conflict"));

    await act(async () => root.render(createElement(Harness)));
    await flush();
    await act(async () => findButton("保存根目录策略").click());
    const confirm = [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find((button) => button.textContent === "确认");
    await act(async () => confirm?.click());
    await flush();

    expect(save).toHaveBeenCalledOnce();
    expect(getDetail).toHaveBeenCalledWith("file-content");
    expect(container.textContent).toContain("内容任务未能完成");
  });

  it("refreshes the detail once when a content run reaches a terminal state", async () => {
    const run = {
      id: "content-run-terminal",
      scope: { kind: "roots", scanRootIds: ["root-content"] },
      mode: "local",
      providerMode: "none",
      status: "completed",
      expectedLibraryRevision: 7,
      candidateFingerprint: "candidate",
      candidateResolver: "managed",
      byteBudget: 1024,
      charBudget: 1024,
      requestedCount: 1,
      materializedCount: 1,
      completedCount: 1,
      blockedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      providerRevision: 0,
      providerConfirmed: false,
      cancelRequested: false,
      revision: 1,
      lastErrorCode: null,
      lastErrorDetail: null,
      createdAt: 1,
      updatedAt: 2,
      completedAt: 2
    };
    const refreshed = detail({ revision: 8, contentRevision: 3, contentSummary: "Terminal summary", contentKeywords: ["terminal"] });
    const getDetail = vi.spyOn(tauriApi, "getFileLibraryDetail").mockResolvedValue(refreshed);
    vi.spyOn(tauriApi, "previewContent").mockResolvedValue({
      version: 1,
      requestId: "content-preview",
      scopeHealth: { scope: { kind: "roots", scanRootIds: ["root-content"] }, health: { state: "healthy", roots: [], invalidReferences: [], message: null }, rootIds: ["root-content"], policyRevisions: [] },
      exactCount: 1,
      deferredCount: 0,
      exactState: "exact",
      candidateResolver: "managed",
      candidateFingerprint: "candidate",
      perFileByteBudget: 1024,
      perFileCharBudget: 1024,
      totalByteBudget: 1024,
      totalCharBudget: 1024,
      byteBudget: 1024,
      charBudget: 1024,
      supportedCount: 1,
      unsupportedCount: 0,
      blockedCount: 0,
      failedCount: 0,
      supportedFormats: ["txt"],
      unsupportedFormats: [],
      blockedReasons: [],
      localAllowed: true,
      cloudAllowed: false,
      rawRetentionDisclosure: "none",
      sample: [],
      libraryRevision: 7,
      policyFingerprint: "policy",
      previewFingerprint: "preview",
      requiresConfirmation: true
    } as never);
    const start = vi.spyOn(tauriApi, "startContentRun").mockResolvedValue(run as never);
    const getRun = vi.spyOn(tauriApi, "getContentRun").mockResolvedValue(run as never);
    vi.spyOn(tauriApi, "queryContentRunItems").mockResolvedValue({ items: [], nextCursor: null, hasMore: false } as never);

    await act(async () => root.render(createElement(Harness)));
    await flush();
    await act(async () => findButton("预览本地提取").click());
    await flush();
    await act(async () => findButton("确认并启动").click());
    await flush(6);

    expect(start).toHaveBeenCalledOnce();
    expect(getDetail).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("Terminal summary");

    const terminalPollCalls = getRun.mock.calls.length;
    vi.useFakeTimers();
    await act(async () => { await vi.advanceTimersByTimeAsync(8_000); });
    expect(getRun.mock.calls.length).toBe(terminalPollCalls);
    expect(getDetail).toHaveBeenCalledOnce();
  });

  it("keeps the newer terminal refresh and stays silent when the older refresh is superseded", async () => {
    const run = contentRun({ id: "content-run-superseded", status: "completed", revision: 2, completedCount: 1, completedAt: 2 });
    const refreshedB = detail({ revision: 9, contentRevision: 4, contentSummary: "Refresh B" });
    const refreshedA = detail({ revision: 8, contentRevision: 3, contentSummary: "Refresh A" });
    let resolveA: (value: FileLibraryDetail) => void = () => undefined;
    let resolveB: (value: FileLibraryDetail) => void = () => undefined;
    let detailCalls = 0;
    const getDetail = vi.spyOn(tauriApi, "getFileLibraryDetail").mockImplementation(() => {
      detailCalls += 1;
      return detailCalls === 1
        ? new Promise<FileLibraryDetail>((resolve) => { resolveA = resolve; })
        : new Promise<FileLibraryDetail>((resolve) => { resolveB = resolve; });
    });
    vi.spyOn(tauriApi, "previewContent").mockResolvedValue(contentPreview());
    vi.spyOn(tauriApi, "startContentRun").mockResolvedValue(run as never);
    vi.spyOn(tauriApi, "getContentRun").mockResolvedValue(run as never);
    vi.spyOn(tauriApi, "queryContentRunItems").mockResolvedValue({ runId: run.id, items: [], nextCursor: null, hasMore: false });
    let refreshEpoch = 0;
    function RaceHarness() {
      const [current, setCurrent] = useState(() => detail());
      const refresh = async () => {
        const ownerEpoch = ++refreshEpoch;
        const refreshed = await tauriApi.getFileLibraryDetail(current.id);
        if (ownerEpoch !== refreshEpoch) return { status: "superseded" as const };
        const refreshedPolicy = refreshed.scanRootId
          ? await tauriApi.getContentScopePolicy(refreshed.scanRootId)
          : null;
        if (ownerEpoch !== refreshEpoch) return { status: "superseded" as const };
        setCurrent(refreshed);
        return { status: "applied" as const, detail: refreshed, policy: refreshedPolicy };
      };
      return <ContentUnderstandingSheet open detail={current} t={t} onClose={() => undefined} onRefreshAuthoritativeContentState={refresh} />;
    }

    await act(async () => root.render(createElement(RaceHarness)));
    await flush();
    await act(async () => findButton("预览本地提取").click());
    await flush();
    await act(async () => findButton("确认并启动").click());
    await flush(6);
    expect(getDetail).toHaveBeenCalledOnce();

    await act(async () => findButton("刷新任务").click());
    await vi.waitFor(() => expect(getDetail).toHaveBeenCalledTimes(2));
    resolveB(refreshedB);
    await flush(8);
    expect(container.textContent).toContain("Refresh B");

    resolveA(refreshedA);
    await flush(8);
    expect(container.textContent).toContain("Refresh B");
    expect(container.textContent).not.toContain("Refresh A");
    expect(container.textContent).not.toContain("内容任务未能完成");
    expect(getDetail).toHaveBeenCalledTimes(2);
  });

  it("keeps the newest run revision when an older polling generation resolves later", async () => {
    const initialRun = contentRun({ status: "running", revision: 1 });
    const newerRun = contentRun({ status: "completed", revision: 3, completedCount: 3, updatedAt: 3, completedAt: 3 });
    const olderRun = contentRun({ status: "running", revision: 2, completedCount: 1, updatedAt: 2 });
    let resolveOlder: (value: any) => void = () => undefined;
    const firstPoll = new Promise<any>((resolve) => { resolveOlder = resolve; });
    vi.spyOn(tauriApi, "previewContent").mockResolvedValue(contentPreview());
    vi.spyOn(tauriApi, "startContentRun").mockResolvedValue(initialRun);
    const getRun = vi.spyOn(tauriApi, "getContentRun").mockReturnValueOnce(firstPoll).mockResolvedValue(newerRun);
    vi.spyOn(tauriApi, "queryContentRunItems").mockResolvedValue({ runId: initialRun.id, items: [], nextCursor: null, hasMore: false });
    vi.spyOn(tauriApi, "getFileLibraryDetail").mockResolvedValue(detail({ revision: 8, contentRevision: 3, contentSummary: "Newest" }));

    await act(async () => root.render(createElement(Harness)));
    await flush();
    await act(async () => findButton("预览本地提取").click());
    await flush();
    await act(async () => findButton("确认并启动").click());
    await flush(6);
    expect(getRun).toHaveBeenCalledOnce();

    await act(async () => findButton("刷新任务").click());
    await flush(6);
    resolveOlder(olderRun);
    await flush(6);

    expect(getRun.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(container.textContent).toContain("已完成");
    expect(container.textContent).toContain("3/3");
  });

  it("claims terminal refresh before awaiting, retries after failure, and does not refresh twice after success", async () => {
    const run = contentRun({ status: "completed", revision: 2, completedCount: 1, completedAt: 2 });
    const refreshed = detail({ revision: 8, contentRevision: 3, contentSummary: "Retried terminal" });
    vi.spyOn(tauriApi, "previewContent").mockResolvedValue(contentPreview());
    vi.spyOn(tauriApi, "startContentRun").mockResolvedValue(run);
    vi.spyOn(tauriApi, "getContentRun").mockResolvedValue(run);
    vi.spyOn(tauriApi, "queryContentRunItems").mockResolvedValue({ runId: run.id, items: [], nextCursor: null, hasMore: false });
    const getDetail = vi.spyOn(tauriApi, "getFileLibraryDetail").mockRejectedValueOnce(new Error("first_terminal_refresh_failed")).mockResolvedValue(refreshed);

    await act(async () => root.render(createElement(Harness)));
    await flush();
    await act(async () => findButton("预览本地提取").click());
    await flush();
    await act(async () => findButton("确认并启动").click());
    await flush(6);
    expect(getDetail).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("内容任务未能完成");

    await act(async () => findButton("刷新任务").click());
    await flush(6);
    expect(getDetail).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("Retried terminal");

    await act(async () => findButton("刷新任务").click());
    await flush(6);
    expect(getDetail).toHaveBeenCalledTimes(2);
  });

  it("keeps a superseded terminal refresh silent when the Sheet closes", async () => {
    const run = contentRun({ id: "content-run-close-superseded", status: "completed", revision: 2, completedCount: 1, completedAt: 2 });
    let resolveRefresh: (result: ContentRefreshResult) => void = () => undefined;
    const refresh = vi.fn(() => new Promise<ContentRefreshResult>((resolve) => { resolveRefresh = resolve; }));
    vi.spyOn(tauriApi, "previewContent").mockResolvedValue(contentPreview());
    vi.spyOn(tauriApi, "startContentRun").mockResolvedValue(run as never);
    vi.spyOn(tauriApi, "getContentRun").mockResolvedValue(run as never);
    vi.spyOn(tauriApi, "queryContentRunItems").mockResolvedValue({ runId: run.id, items: [], nextCursor: null, hasMore: false });
    function ClosableHarness() {
      const [open, setOpen] = useState(true);
      return open ? <ContentUnderstandingSheet open detail={detail()} t={t} onClose={() => setOpen(false)} onRefreshAuthoritativeContentState={refresh} /> : null;
    }

    await act(async () => root.render(createElement(ClosableHarness)));
    await flush();
    await act(async () => findButton("预览本地提取").click());
    await flush();
    await act(async () => findButton("确认并启动").click());
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());

    const closeButton = document.querySelector<HTMLButtonElement>('[aria-label="关闭"]');
    expect(closeButton).toBeTruthy();
    await act(async () => closeButton?.click());
    resolveRefresh({ status: "superseded" });
    await flush(8);

    expect(container.textContent).toBe("");
    expect(container.textContent).not.toContain("内容任务未能完成");
  });

  it("does not write a pending poll after the sheet is closed", async () => {
    const run = contentRun({ status: "running", revision: 1 });
    let resolvePoll: (value: any) => void = () => undefined;
    const pendingPoll = new Promise<any>((resolve) => { resolvePoll = resolve; });
    vi.spyOn(tauriApi, "previewContent").mockResolvedValue(contentPreview());
    vi.spyOn(tauriApi, "startContentRun").mockResolvedValue(run);
    vi.spyOn(tauriApi, "getContentRun").mockReturnValue(pendingPoll);
    vi.spyOn(tauriApi, "queryContentRunItems").mockResolvedValue({ runId: run.id, items: [], nextCursor: null, hasMore: false });
    function ClosableHarness() {
      const [open, setOpen] = useState(true);
      return open ? <ContentUnderstandingSheet open detail={detail()} t={t} onClose={() => setOpen(false)} /> : null;
    }

    await act(async () => root.render(createElement(ClosableHarness)));
    await flush();
    await act(async () => findButton("预览本地提取").click());
    await flush();
    await act(async () => findButton("确认并启动").click());
    await flush(6);
    const closeButton = document.querySelector<HTMLButtonElement>('[aria-label="关闭"]');
    expect(closeButton).toBeTruthy();
    await act(async () => closeButton?.click());
    resolvePoll(contentRun({ status: "completed", revision: 2, completedCount: 1, completedAt: 2 }));
    await flush(6);

    expect(container.textContent).toBe("");
  });
});
