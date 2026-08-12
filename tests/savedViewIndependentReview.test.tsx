// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tauriApi } from "../src/api/tauriApi";
import { ChromeProvider, type ChromeContextValue } from "../src/contexts/AppContexts";
import { makeTranslator } from "../src/i18n";
import { useFileLibraryStore, emptyStats } from "../src/store/useFileLibraryStore";
import { defaultFileLibraryQuerySpec, useFileLibraryQueryStore, useFileLibraryResultStore, useFileLibrarySavedViewStore, useFileLibrarySelectionStore } from "../src/store/useFileLibraryV2Store";
import type { FileLibrarySummary, FileQuerySpecV2, LibrarySavedView } from "../src/types/domain";
import { VaultView } from "../src/views/vault/VaultView";

const t = makeTranslator("zh");
const chrome = { t, setView: vi.fn(), language: "zh", view: "library" } as unknown as ChromeContextValue;
let root: Root;
let container: HTMLDivElement;
const nativeOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
const nativeOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");

const savedQuery: FileQuerySpecV2 = {
  ...defaultFileLibraryQuerySpec,
  text: "report",
  scope: { kind: "all_enabled_roots" }
};

const savedView: LibrarySavedView = {
  id: "view-report",
  displayName: "Reports",
  query: savedQuery,
  queryFingerprint: "saved-report",
  position: 0,
  createdAt: 1,
  updatedAt: 1,
  revision: 1,
  invalidReferences: []
};

const libraryFile: FileLibrarySummary = {
  id: "file-report",
  name: "report.pdf",
  extension: "pdf",
  displayDirectory: "C:/Documents",
  size: 1024,
  modifiedAt: 1,
  createdAt: 1,
  isDirectory: false,
  fileType: "Document",
  purpose: "Work",
  lifecycle: "Active",
  risk: "Normal",
  confidence: 0.95,
  isDuplicate: false,
  requiresReview: false,
  isStale: false,
  tags: [],
  tagCount: 0
};

async function flush(ms = 0) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

describe("Saved View independent review behavior", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="test-root"></div>';
    container = document.getElementById("test-root") as HTMLDivElement;
    root = createRoot(container);
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: 600 });
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, value: 800 });
    useFileLibraryStore.setState({ scope: { kind: "all" }, stats: { ...emptyStats, totalFiles: 1, lastScannedAt: "2026-08-02T00:00:00.000Z" } });
    useFileLibraryQueryStore.setState({ spec: { ...defaultFileLibraryQuerySpec, scope: { kind: "all_enabled_roots" } }, fingerprint: null, snapshotRevision: null, scopeHealth: null });
    useFileLibraryResultStore.setState({ files: [], totalCount: 0, isLoading: false, resultState: "empty", error: null });
    useFileLibrarySelectionStore.setState({ selection: null, focusedId: "", anchorIndex: -1 });
    useFileLibrarySavedViewStore.setState({ views: [], activeViewId: null, isLoading: false, error: null });
    vi.spyOn(tauriApi, "listUserTags").mockResolvedValue([]);
    vi.spyOn(tauriApi, "listLibrarySavedViews").mockResolvedValue([savedView]);
    vi.spyOn(tauriApi, "deleteLibrarySavedView").mockResolvedValue(true);
    vi.spyOn(tauriApi, "queryFileLibraryV2").mockResolvedValue({
      version: 2,
      requestId: "library-test",
      queryFingerprint: "query-report",
      snapshotRevision: 1,
      files: [libraryFile],
      totalCount: 1,
      countState: "exact",
      countToken: null,
      nextCursor: null,
      hasMore: false,
      resultState: "empty",
      scopeHealth: { state: "healthy", roots: [], invalidReferences: [], message: null }
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    if (nativeOffsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", nativeOffsetHeight);
    else delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight;
    if (nativeOffsetWidth) Object.defineProperty(HTMLElement.prototype, "offsetWidth", nativeOffsetWidth);
    else delete (HTMLElement.prototype as { offsetWidth?: number }).offsetWidth;
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("keeps the active view through debounce and query loading, then clears it on user search", async () => {
    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(VaultView) })));
    await flush(10);
    const select = container.querySelector<HTMLSelectElement>('select[aria-label="已保存视图"]');
    expect(select).toBeTruthy();
    select!.value = savedView.id;
    await act(async () => select?.dispatchEvent(new Event("change", { bubbles: true })));
    await flush(10);
    expect(useFileLibrarySavedViewStore.getState().activeViewId).toBe(savedView.id);
    await flush(350);
    await flush(10);
    expect(useFileLibrarySavedViewStore.getState().activeViewId).toBe(savedView.id);

    const fileRow = container.querySelector<HTMLElement>('[role="option"][aria-label*="report.pdf"]');
    expect(fileRow).toBeTruthy();
    await act(async () => fileRow?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await flush(2);
    expect(useFileLibrarySavedViewStore.getState().activeViewId).toBe(savedView.id);

    const filterButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("筛选"));
    expect(filterButton).toBeTruthy();
    await act(async () => filterButton?.click());
    await flush();
    const fileTypeFilter = container.querySelector<HTMLSelectElement>("#library-filter-popover select");
    expect(fileTypeFilter).toBeTruthy();
    const setFilterValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    await act(async () => {
      setFilterValue?.call(fileTypeFilter, "Document");
      fileTypeFilter?.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush(2);
    expect(useFileLibrarySavedViewStore.getState().activeViewId).toBeNull();

    const input = container.querySelector<HTMLInputElement>('input[aria-label="在文件库中搜索"]');
    expect(input).toBeTruthy();
    const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setInputValue?.call(input, "changed");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await flush(10);
    expect(useFileLibrarySavedViewStore.getState().activeViewId).toBeNull();
  });

  it("clears the active id when the current saved view is deleted", async () => {
    await act(async () => root.render(createElement(ChromeProvider, { value: chrome, children: createElement(VaultView) })));
    await flush(2);
    const select = container.querySelector<HTMLSelectElement>('select[aria-label="已保存视图"]');
    expect(select).toBeTruthy();
    select!.value = savedView.id;
    await act(async () => select?.dispatchEvent(new Event("change", { bubbles: true })));
    await flush(4);
    expect(useFileLibrarySavedViewStore.getState().activeViewId).toBe(savedView.id);

    const manager = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("管理已保存视图"));
    expect(manager).toBeTruthy();
    await act(async () => manager?.click());
    await flush();
    const deleteButton = container.querySelector<HTMLButtonElement>('button[aria-label="删除 Reports"]');
    expect(deleteButton).toBeTruthy();
    await act(async () => deleteButton?.click());
    await flush();
    const confirm = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("删除视图"));
    expect(confirm).toBeTruthy();
    await act(async () => confirm?.click());
    await flush(4);

    expect(tauriApi.deleteLibrarySavedView).toHaveBeenCalledWith({ id: savedView.id, expectedRevision: savedView.revision });
    expect(useFileLibrarySavedViewStore.getState().activeViewId).toBeNull();
  });
});
