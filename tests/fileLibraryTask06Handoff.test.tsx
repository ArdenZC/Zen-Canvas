// @vitest-environment happy-dom

import { StrictMode, act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChromeProvider, type ChromeContextValue } from "../src/contexts/AppContexts";
import { makeTranslator } from "../src/i18n";
import { useAppStore } from "../src/store/useAppStore";
import { emptyStats, useFileLibraryStore } from "../src/store/useFileLibraryStore";
import {
  cloneFileQuerySpec,
  defaultFileLibraryQuerySpec,
  useFileLibraryQueryStore,
  useFileLibraryResultStore,
  useFileLibrarySavedViewStore,
  useFileLibrarySelectionStore,
  useFileLibraryTagStore
} from "../src/store/useFileLibraryV2Store";
import type { FileQueryRequestV2, FileQueryResponseV2, FileQuerySpecV2 } from "../src/types/domain";
import { VaultView } from "../src/views/vault/VaultView";

const api = vi.hoisted(() => ({
  query: vi.fn(),
  exactCount: vi.fn(),
  listTags: vi.fn(),
  listViews: vi.fn(),
  listRoots: vi.fn()
}));

vi.mock("../src/api/tauriApi", () => ({
  tauriApi: {
    queryFileLibraryV2: api.query,
    resolveFileLibraryExactCountV2: api.exactCount,
    listUserTags: api.listTags,
    listLibrarySavedViews: api.listViews,
    listScanRoots: api.listRoots,
    getFileLibraryDetail: vi.fn(),
    getFileLibrarySelectionSummary: vi.fn(),
    revealFileLibraryEntry: vi.fn(),
    mutateFileUserTags: vi.fn()
  }
}));

vi.mock("../src/views/vault/components/DuplicateGroupsPanel", () => ({
  DuplicateGroupsPanel: () => null
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
  api.query.mockReset().mockImplementation(async (request: FileQueryRequestV2) => response(request));
  api.exactCount.mockReset();
  api.listTags.mockReset().mockResolvedValue([]);
  api.listViews.mockReset().mockResolvedValue([]);
  api.listRoots.mockReset().mockResolvedValue([{ id: "root-one", normalizedPath: "C:/Data" }]);
  useAppStore.setState({ searchQuery: "" });
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
  useFileLibraryTagStore.setState({ tags: [], isLoading: false, error: null });
  useFileLibrarySavedViewStore.setState({ views: [], activeViewId: null, isLoading: false, error: null });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
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

    await act(async () => useAppStore.getState().setSearchQuery("report"));
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
});
