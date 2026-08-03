// @vitest-environment happy-dom

import { StrictMode, act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChromeProvider, type ChromeContextValue } from "../src/contexts/AppContexts";
import { makeTranslator } from "../src/i18n";
import { emptyStats, useFileLibraryStore } from "../src/store/useFileLibraryStore";
import {
  cloneFileQuerySpec,
  defaultFileLibraryQuerySpec,
  useFileLibraryInspectorStore,
  useFileLibraryQueryStore,
  useFileLibraryResultStore,
  useFileLibrarySavedViewStore,
  useFileLibrarySelectionStore,
  useFileLibraryTagStore
} from "../src/store/useFileLibraryV2Store";
import type { FileLibraryDetail, FileQueryRequestV2, FileQueryResponseV2, FileQuerySpecV2 } from "../src/types/domain";
import { VaultView } from "../src/views/vault/VaultView";

const api = vi.hoisted(() => ({
  query: vi.fn(),
  exactCount: vi.fn(),
  listTags: vi.fn(),
  listViews: vi.fn(),
  listRoots: vi.fn(),
  getDetail: vi.fn(),
  getPolicy: vi.fn()
}));

vi.mock("../src/api/tauriApi", () => ({
  tauriApi: {
    queryFileLibraryV2: api.query,
    resolveFileLibraryExactCountV2: api.exactCount,
    listUserTags: api.listTags,
    listLibrarySavedViews: api.listViews,
    listScanRoots: api.listRoots,
    getFileLibraryDetail: api.getDetail,
    getContentScopePolicy: api.getPolicy,
    getFileLibrarySelectionSummary: vi.fn(),
    revealFileLibraryEntry: vi.fn(),
    mutateFileUserTags: vi.fn()
  }
}));

vi.mock("../src/views/vault/components/DuplicateGroupsPanel", () => ({
  DuplicateGroupsPanel: () => null
}));

vi.mock("../src/views/vault/components/ContentUnderstandingSheet", () => ({
  ContentUnderstandingSheet: ({ open, detail, onClose, onRefreshAuthoritativeContentState }: { open: boolean; detail: FileLibraryDetail; onClose: () => void; onRefreshAuthoritativeContentState: () => Promise<unknown> }) => open
    ? createElement("div", { "data-content-sheet-id": detail.id },
      createElement("button", { type: "button", onClick: () => void onRefreshAuthoritativeContentState() }, "Refresh content"),
      createElement("button", { type: "button", onClick: onClose }, "Close content"))
    : null,
  contentStatusLabel: (status: string) => status,
  contentPolicyLabel: (policy: string) => policy
}));

const chrome = {
  t: makeTranslator("en"),
  language: "en",
  view: "library",
  setView: vi.fn(),
  onError: vi.fn()
} as unknown as ChromeContextValue;

let container: HTMLDivElement;
let root: Root;
const nativeClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
const nativeClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
const nativeOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
const nativeOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");

function response(request: FileQueryRequestV2, overrides: Partial<FileQueryResponseV2> = {}): FileQueryResponseV2 {
  return {
    version: 2,
    requestId: request.requestId,
    queryFingerprint: `fp-${JSON.stringify(request.query).length}`,
    snapshotRevision: 7,
    files: [{
      id: "file-one",
      name: "one.txt",
      extension: "txt",
      displayDirectory: "C:/Data",
      size: 1,
      modifiedAt: 2,
      createdAt: 1,
      isDirectory: false,
      fileType: "Document",
      purpose: "Work",
      lifecycle: "Active",
      risk: "Normal",
      confidence: 0.9,
      isDuplicate: false,
      requiresReview: false,
      isStale: false,
      tags: [],
      tagCount: 0
    }],
    totalCount: 1,
    countState: "exact",
    countToken: null,
    nextCursor: null,
    hasMore: false,
    resultState: "complete",
    scopeHealth: { state: "healthy", roots: [], invalidReferences: [], message: null },
    ...overrides
  };
}

function detail(id: string, name: string): FileLibraryDetail {
  return {
    id,
    name,
    path: `C:/Data/${name}`,
    directory: "C:/Data",
    extension: "txt",
    size: 1,
    modifiedAt: 2,
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
    suggestedTargetPath: `C:/Data/${name}`,
    suggestedName: name,
    isDuplicate: false,
    requiresReview: false,
    isStale: false,
    lastSeenAt: 2,
    scanRootId: "root-one",
    scanRootName: "Data",
    scopeHealth: "healthy",
    duplicateGroupId: null,
    duplicateGroupSize: 0,
    tags: [],
    activeFindings: [],
    safeActions: [],
    revision: 1,
    contentStatus: "ready",
    contentPolicy: "enabled",
    contentSummary: `${name} summary`,
    contentKeywords: [name],
    contentLanguage: "en",
    contentProvenance: "local",
    contentTruncated: false,
    contentTextRetained: false,
    contentRevision: 1
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 600 });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 800 });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: 600 });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, value: 800 });
  api.query.mockReset().mockImplementation(async (request: FileQueryRequestV2) => response(request));
  api.exactCount.mockReset();
  api.listTags.mockReset().mockResolvedValue([]);
  api.listViews.mockReset().mockResolvedValue([]);
  api.listRoots.mockReset().mockResolvedValue([{ id: "root-one", normalizedPath: "C:/Data" }]);
  api.getDetail.mockReset();
  api.getPolicy.mockReset().mockResolvedValue(null);
  useFileLibraryStore.setState({
    scope: { kind: "all" },
    stats: { ...emptyStats, lastScannedAt: "2026-07-29T00:00:00Z" },
    loadStats: vi.fn().mockResolvedValue(undefined)
  });
  useFileLibraryQueryStore.setState({
    spec: cloneFileQuerySpec(defaultFileLibraryQuerySpec),
    fingerprint: null,
    snapshotRevision: null,
    scopeHealth: null
  });
  useFileLibraryResultStore.getState().clear();
  useFileLibrarySelectionStore.getState().clear();
  useFileLibraryInspectorStore.setState({ detail: null, selectionSummary: null, selectedId: null, requestEpoch: 0, isLoading: false, error: null });
  useFileLibraryTagStore.setState({ tags: [], isLoading: false, error: null });
  useFileLibrarySavedViewStore.setState({ views: [], activeViewId: null, isLoading: false, error: null });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  if (nativeClientHeight) Object.defineProperty(HTMLElement.prototype, "clientHeight", nativeClientHeight);
  else delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
  if (nativeClientWidth) Object.defineProperty(HTMLElement.prototype, "clientWidth", nativeClientWidth);
  else delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
  if (nativeOffsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", nativeOffsetHeight);
  else delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight;
  if (nativeOffsetWidth) Object.defineProperty(HTMLElement.prototype, "offsetWidth", nativeOffsetWidth);
  else delete (HTMLElement.prototype as { offsetWidth?: number }).offsetWidth;
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
});

describe("Task 06 File Library handoff interactions", () => {
  it("mounts Vault in Strict Mode and issues one request for each committed query intent", async () => {
    await act(async () => {
      root.render(createElement(StrictMode, null, createElement(ChromeProvider, { value: chrome, children: createElement(VaultView) })));
    });
    await vi.waitFor(() => expect(api.query).toHaveBeenCalledTimes(1));

    await act(async () => useFileLibraryQueryStore.getState().setSpec({
      ...useFileLibraryQueryStore.getState().spec,
      filters: { ...useFileLibraryQueryStore.getState().spec.filters, review: "only" }
    }));
    await vi.waitFor(() => expect(api.query).toHaveBeenCalledTimes(2));

    await act(async () => useFileLibraryQueryStore.getState().setSpec({
      ...useFileLibraryQueryStore.getState().spec,
      sort: { kind: "name", direction: "asc" }
    }));
    await vi.waitFor(() => expect(api.query).toHaveBeenCalledTimes(3));

    await act(async () => {
      useFileLibrarySavedViewStore.setState({
        activeViewId: "view-one",
        views: [{
          id: "view-one",
          displayName: "View one",
          query: { ...cloneFileQuerySpec(defaultFileLibraryQuerySpec), filters: { ...defaultFileLibraryQuerySpec.filters, duplicate: "only" } },
          queryFingerprint: "saved",
          position: 0,
          createdAt: 1,
          updatedAt: 1,
          revision: 1,
          invalidReferences: []
        }]
      });
    });
    const select = container.querySelector<HTMLSelectElement>('select[aria-label="Saved Views"]')!;
    await act(async () => {
      select.value = "view-one";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await vi.waitFor(() => expect(api.query).toHaveBeenCalledTimes(4));

    const searchInput = container.querySelector<HTMLInputElement>('input[aria-label="Search the File Library"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(searchInput, "report");
      searchInput.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "report" }));
    });
    await new Promise((resolve) => setTimeout(resolve, 340));
    await vi.waitFor(() => expect(api.query).toHaveBeenCalledTimes(5));
    expect(api.query).toHaveBeenCalledTimes(5);
  });

  it("publishes only the latest response and preserves rows on snapshot expiry", async () => {
    const oldResult = deferred<FileQueryResponseV2>();
    const newResult = deferred<FileQueryResponseV2>();
    api.query
      .mockImplementationOnce(() => oldResult.promise)
      .mockImplementationOnce(() => newResult.promise);
    const oldSpec: FileQuerySpecV2 = { ...cloneFileQuerySpec(defaultFileLibraryQuerySpec), text: "old" };
    const newSpec: FileQuerySpecV2 = { ...cloneFileQuerySpec(defaultFileLibraryQuerySpec), text: "new" };
    const oldLoad = useFileLibraryResultStore.getState().loadFirstPage(oldSpec);
    const newLoad = useFileLibraryResultStore.getState().loadFirstPage(newSpec);
    newResult.resolve(response({ version: 2, requestId: "new", query: newSpec, pageSize: 50, cursor: null }, {
      files: [{ ...response({ version: 2, requestId: "new", query: newSpec, pageSize: 50 }).files[0], id: "new-file", name: "new.txt" }]
    }));
    await newLoad;
    oldResult.resolve(response({ version: 2, requestId: "old", query: oldSpec, pageSize: 50, cursor: null }, {
      files: [{ ...response({ version: 2, requestId: "old", query: oldSpec, pageSize: 50 }).files[0], id: "old-file", name: "old.txt" }]
    }));
    await oldLoad;
    expect(useFileLibraryResultStore.getState().files.map((file) => file.id)).toEqual(["new-file"]);

    useFileLibraryQueryStore.setState({ fingerprint: "fp", snapshotRevision: 7 });
    useFileLibrarySelectionStore.setState({
      selection: {
        kind: "all_matching",
        query: newSpec,
        queryFingerprint: "fp",
        snapshotRevision: 7,
        excludedFileIds: []
      }
    });
    useFileLibraryResultStore.setState({ nextCursor: "cursor", hasMore: true });
    api.query.mockRejectedValueOnce(new Error("library_snapshot_expired"));
    await useFileLibraryResultStore.getState().loadNextPage();
    expect(useFileLibraryResultStore.getState().files.map((file) => file.id)).toEqual(["new-file"]);
    expect(useFileLibraryResultStore.getState().resultState).toBe("snapshot_expired");
    expect(useFileLibrarySelectionStore.getState().selection).toBeNull();
  });

  it("does not let a delayed content refresh for Inspector A overwrite Inspector B or reopen a closed sheet", async () => {
    const fileA = detail("file-one", "one.txt");
    const fileB = detail("file-two", "two.txt");
    const refreshedA = detail("file-one", "one-refreshed.txt");
    const pendingA = deferred<FileLibraryDetail>();
    let detailACalls = 0;
    api.getDetail.mockImplementation((fileId: string) => {
      if (fileId === fileA.id) {
        detailACalls += 1;
        return detailACalls === 1 ? Promise.resolve(fileA) : pendingA.promise;
      }
      return Promise.resolve(fileB);
    });
    api.getPolicy.mockResolvedValue(null);
    api.query.mockImplementation(async (request: FileQueryRequestV2) => {
      const base = response(request);
      return { ...base, files: [...base.files, { ...base.files[0], id: fileB.id, name: fileB.name }], totalCount: 2 };
    });

    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(VaultView) })));
    await vi.waitFor(() => expect(api.query).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(container.querySelector('[data-library-row="file-one"]')).not.toBeNull());
    const rowA = container.querySelector<HTMLElement>('[data-library-row="file-one"]');
    const rowB = container.querySelector<HTMLElement>('[data-library-row="file-two"]');
    expect(rowA).not.toBeNull();
    expect(rowB).not.toBeNull();

    await act(async () => rowA?.click());
    await vi.waitFor(() => expect(useFileLibraryInspectorStore.getState().selectedId).toBe(fileA.id));
    const contentButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes("Open Content Understanding"));
    expect(contentButton).toBeDefined();
    await act(async () => contentButton?.click());
    expect(container.querySelector('[data-content-sheet-id="file-one"]')).not.toBeNull();

    const refreshButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Refresh content");
    expect(refreshButton).toBeDefined();
    await act(async () => refreshButton?.click());
    const closeButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Close content");
    expect(closeButton).toBeDefined();
    await act(async () => closeButton?.click());
    await act(async () => rowB?.click());
    await vi.waitFor(() => expect(useFileLibraryInspectorStore.getState().selectedId).toBe(fileB.id));
    await vi.waitFor(() => expect(useFileLibraryInspectorStore.getState().detail?.id).toBe(fileB.id));

    pendingA.resolve(refreshedA);
    await act(async () => { await pendingA.promise; });
    await vi.waitFor(() => expect(useFileLibraryInspectorStore.getState().detail?.id).toBe(fileB.id));
    expect(useFileLibraryInspectorStore.getState().detail?.name).toBe(fileB.name);
    expect(container.querySelector('[data-content-sheet-id="file-one"]')).toBeNull();
  });
});
