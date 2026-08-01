// @vitest-environment happy-dom

import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tauriApi } from "../src/api/tauriApi";
import { makeTranslator } from "../src/i18n";
import type { ContentScopePolicy, FileLibraryDetail } from "../src/types/domain";
import { resetModalInfrastructureForTests } from "../src/components/modal/ModalPortal";
import { ContentUnderstandingSheet } from "../src/views/vault/components/ContentUnderstandingSheet";

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

async function flush(count = 3) {
  for (let index = 0; index < count; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function findButton(text: string): HTMLButtonElement {
  const button = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes(text));
  if (!button) throw new Error(`button not found: ${text}`);
  return button;
}

function Harness() {
  const [current, setCurrent] = useState(() => detail());
  const refresh = async () => {
    const refreshed = await tauriApi.getFileLibraryDetail(current.id);
    setCurrent(refreshed);
  };
  return <ContentUnderstandingSheet open detail={current} t={t} onClose={() => undefined} onRefreshDetail={refresh} />;
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
    expect(container.textContent).toContain("内容状态已变化");
    expect(container.textContent).toContain("Concurrent summary");
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
    vi.spyOn(tauriApi, "getContentRun").mockResolvedValue(run as never);
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
  });
});
