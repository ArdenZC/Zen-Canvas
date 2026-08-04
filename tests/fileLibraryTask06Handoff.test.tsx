// @vitest-environment happy-dom

import { StrictMode, act, createElement, useState } from "react";
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
import type { FileLibraryDetail, FileQueryRequestV2, FileQueryResponseV2, FileQuerySpecV2, LibrarySelectionV1 } from "../src/types/domain";
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
  ContentUnderstandingSheet: ({ open, detail, onClose, onRefreshAuthoritativeContentState }: { open: boolean; detail: FileLibraryDetail; onClose: () => void; onRefreshAuthoritativeContentState: () => Promise<unknown> }) => {
    const [outcome, setOutcome] = useState<string | null>(null);
    if (!open) return null;
    return createElement("div", { "data-content-sheet-id": detail.id },
      createElement("button", { type: "button", onClick: () => void onRefreshAuthoritativeContentState().then((result) => setOutcome((result as { status?: string } | undefined)?.status ?? "unknown")).catch(() => setOutcome("rejected")) }, "Refresh content"),
      createElement("button", { type: "button", onClick: onClose }, "Close content"),
      outcome ? createElement("output", { "data-content-refresh-outcome": outcome }, outcome) : null);
  },
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

async function flushFocus() {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
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

  it("converts an explicit multi-selection to one file before opening Content Understanding", async () => {
    const fileA = detail("file-one", "one.txt");
    const fileB = detail("file-two", "two.txt");
    api.query.mockImplementation(async (request: FileQueryRequestV2) => {
      const base = response(request);
      return { ...base, files: [base.files[0], { ...base.files[0], id: fileB.id, name: fileB.name }], totalCount: 2 };
    });
    api.getDetail.mockImplementation((fileId: string) => Promise.resolve(fileId === fileB.id ? fileB : fileA));

    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(VaultView) })));
    await vi.waitFor(() => expect(container.querySelector('[data-library-row="file-one"]')).not.toBeNull());
    await act(async () => useFileLibrarySelectionStore.setState({ selection: { kind: "explicit", fileIds: [fileA.id, fileB.id] } as LibrarySelectionV1, focusedId: fileA.id, anchorIndex: 0 }));
    const rowA = container.querySelector<HTMLElement>('[data-library-row="file-one"]');
    await act(async () => rowA?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 20, clientY: 20 })));
    const contentMenuItem = [...container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((item) => item.textContent?.includes("Open Content Understanding"));
    expect(contentMenuItem).toBeDefined();
    await act(async () => contentMenuItem?.click());

    await vi.waitFor(() => expect(container.querySelector('[data-content-sheet-id="file-one"]')).not.toBeNull());
    expect(useFileLibrarySelectionStore.getState().selection).toEqual({ kind: "explicit", fileIds: [fileA.id] });
    expect(api.getDetail).toHaveBeenCalledTimes(1);
  });

  it("converts an all-matching selection to one file before opening Content Understanding", async () => {
    const fileA = detail("file-one", "one.txt");
    const fileB = detail("file-two", "two.txt");
    api.query.mockImplementation(async (request: FileQueryRequestV2) => {
      const base = response(request);
      return { ...base, files: [base.files[0], { ...base.files[0], id: fileB.id, name: fileB.name }], totalCount: 2 };
    });
    api.getDetail.mockImplementation((fileId: string) => Promise.resolve(fileId === fileB.id ? fileB : fileA));

    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(VaultView) })));
    await vi.waitFor(() => expect(container.querySelector('[data-library-row="file-one"]')).not.toBeNull());
    useFileLibraryQueryStore.setState({ fingerprint: "fp", snapshotRevision: 7 });
    await act(async () => useFileLibrarySelectionStore.setState({ selection: { kind: "all_matching", query: useFileLibraryQueryStore.getState().spec, queryFingerprint: "fp", snapshotRevision: 7, excludedFileIds: [] } as LibrarySelectionV1, focusedId: fileA.id, anchorIndex: 0 }));
    const rowA = container.querySelector<HTMLElement>('[data-library-row="file-one"]');
    await act(async () => rowA?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 20, clientY: 20 })));
    const contentMenuItem = [...container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((item) => item.textContent?.includes("Open Content Understanding"));
    await act(async () => contentMenuItem?.click());

    await vi.waitFor(() => expect(container.querySelector('[data-content-sheet-id="file-one"]')).not.toBeNull());
    expect(useFileLibrarySelectionStore.getState().selection).toEqual({ kind: "explicit", fileIds: [fileA.id] });
    expect(api.getDetail).toHaveBeenCalledTimes(1);
  });

  it("shows the first Content detail failure in the Inspector and keeps the Content Sheet closed until retry succeeds", async () => {
    const fileA = detail("file-one", "one.txt");
    const failedRequest = deferred<FileLibraryDetail>();
    api.getDetail.mockReturnValueOnce(failedRequest.promise);

    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(VaultView) })));
    await vi.waitFor(() => expect(container.querySelector('[data-library-row="file-one"]')).not.toBeNull());
    const rowA = container.querySelector<HTMLElement>('[data-library-row="file-one"]')!;
    await act(async () => rowA.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 20, clientY: 20 })));
    const contentMenuItem = [...container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((item) => item.textContent?.includes("Open Content Understanding"));
    await act(async () => contentMenuItem?.click());
    const rawBackendError = "sqlite_error: C:\\Users\\name\\secret.db internal_code_42 tauri_command=get_file_library_detail";
    failedRequest.reject(new Error(rawBackendError));

    await vi.waitFor(() => expect(chrome.onError).toHaveBeenCalledWith(chrome.t("contentOpenFailed")));
    expect(chrome.onError).not.toHaveBeenCalledWith(rawBackendError);
    expect(useFileLibraryInspectorStore.getState().error).toContain(rawBackendError);
    expect(container.querySelector('[data-content-sheet-id="file-one"]')).toBeNull();
    expect(container.textContent).toContain("Unable to load file details");
    expect(container.textContent).toContain("File details could not be loaded");
    expect(container.textContent).not.toContain("secret.db");
    expect(container.textContent).not.toContain("internal_code_42");
    expect(container.textContent).not.toContain(rawBackendError);
    await flushFocus();
    expect(document.activeElement).toBe(container.querySelector<HTMLElement>('[role="listbox"]'));
    const retry = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "Retry details");
    expect(retry).toBeDefined();

    api.getDetail.mockResolvedValueOnce(fileA);
    await act(async () => retry?.click());
    await vi.waitFor(() => expect(useFileLibraryInspectorStore.getState().detail?.id).toBe(fileA.id));
    expect(container.textContent).not.toContain("Unable to load file details");
    expect(container.querySelector('[data-content-sheet-id="file-one"]')).toBeNull();
    const reopenContent = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("Open Content Understanding"));
    await act(async () => reopenContent?.click());
    await vi.waitFor(() => expect(container.querySelector('[data-content-sheet-id="file-one"]')).not.toBeNull());
  });

  it("deduplicates a Content open against the current mounted Inspector request", async () => {
    const fileA = detail("file-one", "one.txt");
    const pending = deferred<FileLibraryDetail>();
    api.getDetail.mockReturnValue(pending.promise);

    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(VaultView) })));
    await vi.waitFor(() => expect(container.querySelector('[data-library-row="file-one"]')).not.toBeNull());
    const rowA = container.querySelector<HTMLElement>('[data-library-row="file-one"]')!;
    await act(async () => rowA.click());
    await vi.waitFor(() => expect(api.getDetail).toHaveBeenCalledOnce());
    await act(async () => rowA.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 20, clientY: 20 })));
    const contentMenuItem = [...container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((item) => item.textContent?.includes("Open Content Understanding"));
    await act(async () => contentMenuItem?.click());
    expect(api.getDetail).toHaveBeenCalledOnce();

    pending.resolve(fileA);
    await vi.waitFor(() => expect(container.querySelector('[data-content-sheet-id="file-one"]')).not.toBeNull());
    expect(chrome.onError).not.toHaveBeenCalled();
  });

  it("starts A2 for a mounted A to B to A selection and ignores the stale A1 error", async () => {
    const fileA = detail("file-one", "one.txt");
    const fileB = detail("file-two", "two.txt");
    const pendingA1 = deferred<FileLibraryDetail>();
    const pendingB = deferred<FileLibraryDetail>();
    const pendingA2 = deferred<FileLibraryDetail>();
    let aCalls = 0;
    api.query.mockImplementation(async (request: FileQueryRequestV2) => {
      const base = response(request);
      return { ...base, files: [base.files[0], { ...base.files[0], id: fileB.id, name: fileB.name }], totalCount: 2 };
    });
    api.getDetail.mockImplementation((fileId: string) => {
      if (fileId === fileB.id) return pendingB.promise;
      aCalls += 1;
      return aCalls === 1 ? pendingA1.promise : pendingA2.promise;
    });

    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(VaultView) })));
    await vi.waitFor(() => expect(container.querySelector('[data-library-row="file-two"]')).not.toBeNull());
    const rowA = container.querySelector<HTMLElement>('[data-library-row="file-one"]')!;
    const rowB = container.querySelector<HTMLElement>('[data-library-row="file-two"]')!;
    await act(async () => rowA.click());
    await vi.waitFor(() => expect(api.getDetail).toHaveBeenCalledWith(fileA.id));
    await act(async () => rowB.click());
    await vi.waitFor(() => expect(api.getDetail).toHaveBeenCalledWith(fileB.id));
    pendingB.resolve(fileB);
    await vi.waitFor(() => expect(useFileLibraryInspectorStore.getState().detail?.id).toBe(fileB.id));
    await act(async () => rowA.click());
    await vi.waitFor(() => expect(api.getDetail).toHaveBeenCalledTimes(3));
    expect(api.getDetail.mock.calls.map(([fileId]) => fileId)).toEqual([fileA.id, fileB.id, fileA.id]);

    pendingA1.reject(new Error("stale A1 failure"));
    pendingA2.resolve(fileA);
    await vi.waitFor(() => expect(useFileLibraryInspectorStore.getState().detail?.id).toBe(fileA.id));
    expect(useFileLibraryInspectorStore.getState().error).toBeNull();
    expect(chrome.onError).not.toHaveBeenCalledWith("stale A1 failure");
    const contentButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("Open Content Understanding"));
    await act(async () => contentButton?.click());
    await vi.waitFor(() => expect(container.querySelector('[data-content-sheet-id="file-one"]')).not.toBeNull());
  });

  it("preserves an explicit multi-selection while opening a context menu and viewing suggestions", async () => {
    const fileA = detail("file-one", "one.txt");
    const fileB = detail("file-two", "two.txt");
    api.query.mockImplementation(async (request: FileQueryRequestV2) => {
      const base = response(request);
      return { ...base, files: [base.files[0], { ...base.files[0], id: fileB.id, name: fileB.name }], totalCount: 2 };
    });

    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(VaultView) })));
    await vi.waitFor(() => expect(container.querySelector('[data-library-row="file-one"]')).not.toBeNull());
    await act(async () => useFileLibrarySelectionStore.setState({ selection: { kind: "explicit", fileIds: [fileA.id, fileB.id] } as LibrarySelectionV1, focusedId: fileA.id, anchorIndex: 0 }));
    await act(async () => container.querySelector<HTMLElement>('[data-library-row="file-one"]')?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 20, clientY: 20 })));

    expect(useFileLibrarySelectionStore.getState().selection).toEqual({ kind: "explicit", fileIds: [fileA.id, fileB.id] });
    const suggestions = [...container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((item) => item.textContent?.includes(chrome.t("libraryViewSuggestions")));
    await act(async () => suggestions?.click());

    expect(useFileLibrarySelectionStore.getState().selection).toEqual({ kind: "explicit", fileIds: [fileA.id, fileB.id] });
    expect(chrome.setView).toHaveBeenCalledWith("organize");
  });

  it("preserves an all-matching selection while opening a context menu and viewing suggestions", async () => {
    const fileA = detail("file-one", "one.txt");
    api.query.mockImplementation(async (request: FileQueryRequestV2) => response(request, { totalCount: 10 }));

    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(VaultView) })));
    await vi.waitFor(() => expect(container.querySelector('[data-library-row="file-one"]')).not.toBeNull());
    useFileLibraryQueryStore.setState({ fingerprint: "fp", snapshotRevision: 7 });
    const allMatching: LibrarySelectionV1 = { kind: "all_matching", query: useFileLibraryQueryStore.getState().spec, queryFingerprint: "fp", snapshotRevision: 7, excludedFileIds: [] };
    await act(async () => useFileLibrarySelectionStore.setState({ selection: allMatching, focusedId: fileA.id, anchorIndex: 0 }));
    await act(async () => container.querySelector<HTMLElement>('[data-library-row="file-one"]')?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 20, clientY: 20 })));

    expect(useFileLibrarySelectionStore.getState().selection).toEqual(allMatching);
    const suggestions = [...container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((item) => item.textContent?.includes(chrome.t("libraryViewSuggestions")));
    await act(async () => suggestions?.click());

    expect(useFileLibrarySelectionStore.getState().selection).toEqual(allMatching);
    expect(chrome.setView).toHaveBeenCalledWith("organize");
  });

  it("switches to a single file only when the context target is not selected", async () => {
    const fileA = detail("file-one", "one.txt");
    const fileB = detail("file-two", "two.txt");
    api.query.mockImplementation(async (request: FileQueryRequestV2) => {
      const base = response(request);
      return { ...base, files: [base.files[0], { ...base.files[0], id: fileB.id, name: fileB.name }], totalCount: 2 };
    });

    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(VaultView) })));
    await vi.waitFor(() => expect(container.querySelector('[data-library-row="file-one"]')).not.toBeNull());
    await act(async () => useFileLibrarySelectionStore.setState({ selection: { kind: "explicit", fileIds: [fileB.id] } as LibrarySelectionV1, focusedId: fileB.id, anchorIndex: 1 }));
    await act(async () => container.querySelector<HTMLElement>('[data-library-row="file-one"]')?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 20, clientY: 20 })));

    expect(useFileLibrarySelectionStore.getState().selection).toEqual({ kind: "explicit", fileIds: [fileA.id] });
  });

  it("restores listbox focus after Escape closes a keyboard-opened context menu", async () => {
    const fileA = detail("file-one", "one.txt");
    api.getDetail.mockResolvedValue(fileA);

    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(VaultView) })));
    await vi.waitFor(() => expect(container.querySelector('[data-library-row="file-one"]')).not.toBeNull());
    const listbox = container.querySelector<HTMLElement>('[role="listbox"]')!;
    await act(async () => {
      useFileLibrarySelectionStore.setState({ selection: { kind: "explicit", fileIds: [fileA.id] } as LibrarySelectionV1, focusedId: fileA.id, anchorIndex: 0 });
      listbox.focus();
      listbox.dispatchEvent(new KeyboardEvent("keydown", { key: "ContextMenu", bubbles: true }));
    });
    const menu = container.querySelector<HTMLElement>('[role="menu"]')!;
    expect(menu).not.toBeNull();
    await act(async () => menu.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    await flushFocus();

    expect(container.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(listbox);
  });

  it("restores listbox focus after closing Content Sheet opened from the context menu", async () => {
    const fileA = detail("file-one", "one.txt");
    api.getDetail.mockResolvedValue(fileA);

    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(VaultView) })));
    await vi.waitFor(() => expect(container.querySelector('[data-library-row="file-one"]')).not.toBeNull());
    const listbox = container.querySelector<HTMLElement>('[role="listbox"]')!;
    await act(async () => {
      useFileLibrarySelectionStore.setState({ selection: { kind: "explicit", fileIds: [fileA.id] } as LibrarySelectionV1, focusedId: fileA.id, anchorIndex: 0 });
      listbox.focus();
      listbox.dispatchEvent(new KeyboardEvent("keydown", { key: "ContextMenu", bubbles: true }));
    });
    const contentMenuItem = [...container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((item) => item.textContent?.includes("Open Content Understanding"));
    await act(async () => contentMenuItem?.click());
    await vi.waitFor(() => expect(container.querySelector('[data-content-sheet-id="file-one"]')).not.toBeNull());
    const closeButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Close content");
    await act(async () => closeButton?.click());
    await flushFocus();

    expect(container.querySelector('[data-content-sheet-id="file-one"]')).toBeNull();
    expect(document.activeElement).toBe(listbox);
  });

  it("falls back to the current listbox when a saved Content Sheet focus target is removed", async () => {
    const fileA = detail("file-one", "one.txt");
    api.getDetail.mockResolvedValue(fileA);

    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(VaultView) })));
    await vi.waitFor(() => expect(container.querySelector('[data-library-row="file-one"]')).not.toBeNull());
    const listbox = container.querySelector<HTMLElement>('[role="listbox"]')!;
    await act(async () => {
      useFileLibrarySelectionStore.setState({ selection: { kind: "explicit", fileIds: [fileA.id] } as LibrarySelectionV1, focusedId: fileA.id, anchorIndex: 0 });
      listbox.focus();
      listbox.dispatchEvent(new KeyboardEvent("keydown", { key: "ContextMenu", bubbles: true }));
    });
    const contentMenuItem = [...container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((item) => item.textContent?.includes("Open Content Understanding"));
    await act(async () => contentMenuItem?.click());
    await vi.waitFor(() => expect(container.querySelector('[data-content-sheet-id="file-one"]')).not.toBeNull());
    const replacement = document.createElement("div");
    replacement.setAttribute("role", "listbox");
    replacement.tabIndex = 0;
    listbox.replaceWith(replacement);
    const closeButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Close content");
    await act(async () => closeButton?.click());
    await flushFocus();

    expect(document.activeElement).toBe(replacement);
  });

  it("restores a stable library focus target when clicking outside the context menu", async () => {
    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(VaultView) })));
    await vi.waitFor(() => expect(container.querySelector('[data-library-row="file-one"]')).not.toBeNull());
    const listbox = container.querySelector<HTMLElement>('[role="listbox"]')!;
    await act(async () => container.querySelector<HTMLElement>('[data-library-row="file-one"]')?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 20, clientY: 20 })));
    expect(container.querySelector('[role="menu"]')).not.toBeNull();
    await act(async () => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await flushFocus();

    expect(container.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(listbox);
  });

  it("does not steal focus from Filter, Sort, or search when an outside pointer closes the menu", async () => {
    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(VaultView) })));
    await vi.waitFor(() => expect(container.querySelector('[data-library-row="file-one"]')).not.toBeNull());
    const row = container.querySelector<HTMLElement>('[data-library-row="file-one"]')!;
    const targets = [
      container.querySelector<HTMLElement>('[data-section="filter toolbar"] button'),
      container.querySelector<HTMLElement>('button[aria-haspopup="menu"]'),
      container.querySelector<HTMLInputElement>('input[aria-label="Search the File Library"]')
    ];
    for (const target of targets) {
      expect(target).not.toBeNull();
      await act(async () => row.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 20, clientY: 20 })));
      expect(container.querySelector('[role="menu"]')).not.toBeNull();
      await act(async () => {
        target?.focus();
        target?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      });
      await flushFocus();
      expect(container.querySelector('[role="menu"]')).toBeNull();
      expect(document.activeElement).toBe(target);
    }
  });

  it("reports a real Content refresh failure even when the Inspector no longer owns the file", async () => {
    const fileA = detail("file-one", "one.txt");
    api.getDetail.mockResolvedValue(fileA);

    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(VaultView) })));
    await vi.waitFor(() => expect(container.querySelector('[data-library-row="file-one"]')).not.toBeNull());
    const rowA = container.querySelector<HTMLElement>('[data-library-row="file-one"]');
    await act(async () => rowA?.click());
    await vi.waitFor(() => expect(useFileLibraryInspectorStore.getState().selectedId).toBe(fileA.id));
    const contentButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes("Open Content Understanding"));
    await act(async () => contentButton?.click());
    await vi.waitFor(() => expect(container.querySelector('[data-content-sheet-id="file-one"]')).not.toBeNull());

    useFileLibraryInspectorStore.setState({ selectedId: null, detail: null, selectionSummary: null, requestEpoch: 9, isLoading: false, error: null });
    api.getDetail.mockRejectedValueOnce(new Error("detail_refresh_failed"));
    const refreshButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Refresh content");
    await act(async () => refreshButton?.click());

    await vi.waitFor(() => expect(container.querySelector<HTMLElement>('[data-content-refresh-outcome]')?.textContent).toBe("failed"));
    expect(chrome.onError).toHaveBeenCalledWith(chrome.t("contentOpenFailed"));
    expect(chrome.onError).not.toHaveBeenCalledWith("detail_refresh_failed");
  });

  it("does not let a delayed content refresh for Inspector A overwrite Inspector B or reopen a closed sheet", async () => {
    const fileA = detail("file-one", "one.txt");
    const fileB = detail("file-two", "two.txt");
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

    pendingA.reject(new Error("stale A refresh failure"));
    await expect(pendingA.promise).rejects.toThrow("stale A refresh failure");
    await vi.waitFor(() => expect(useFileLibraryInspectorStore.getState().detail?.id).toBe(fileB.id));
    expect(useFileLibraryInspectorStore.getState().detail?.name).toBe(fileB.name);
    expect(container.querySelector('[data-content-sheet-id="file-one"]')).toBeNull();
    expect(chrome.onError).not.toHaveBeenCalledWith("stale A refresh failure");
  });

  it("keeps the latest same-file content refresh and Inspector revision", async () => {
    const fileA = detail("file-one", "one.txt");
    const refreshedA2 = { ...fileA, revision: 3, name: "one-revision-3.txt" };
    const refreshedA1 = { ...fileA, revision: 2, name: "one-revision-2.txt" };
    const pendingFirst = deferred<FileLibraryDetail>();
    const pendingSecond = deferred<FileLibraryDetail>();
    let detailACalls = 0;
    api.getDetail.mockImplementation((fileId: string) => {
      if (fileId !== fileA.id) return Promise.resolve(detail("file-two", "two.txt"));
      detailACalls += 1;
      if (detailACalls === 1) return Promise.resolve(fileA);
      return detailACalls === 2 ? pendingFirst.promise : pendingSecond.promise;
    });
    api.query.mockImplementation(async (request: FileQueryRequestV2) => response(request));

    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(VaultView) })));
    await vi.waitFor(() => expect(api.query).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(container.querySelector('[data-library-row="file-one"]')).not.toBeNull());
    const rowA = container.querySelector<HTMLElement>('[data-library-row="file-one"]');
    await act(async () => rowA?.click());
    await vi.waitFor(() => expect(useFileLibraryInspectorStore.getState().selectedId).toBe(fileA.id));
    const contentButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes("Open Content Understanding"));
    await act(async () => contentButton?.click());
    expect(api.getDetail).toHaveBeenCalledTimes(1);
    const refreshButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Refresh content");
    await act(async () => refreshButton?.click());
    await act(async () => refreshButton?.click());

    pendingSecond.resolve(refreshedA2);
    await vi.waitFor(() => expect(useFileLibraryInspectorStore.getState().detail?.revision).toBe(3));
    pendingFirst.resolve(refreshedA1);
    await expect(pendingFirst.promise).resolves.toMatchObject({ revision: 2 });
    await vi.waitFor(() => expect(useFileLibraryInspectorStore.getState().detail?.revision).toBe(3));
    expect(useFileLibraryInspectorStore.getState().detail?.name).toBe("one-revision-3.txt");
  });
});
