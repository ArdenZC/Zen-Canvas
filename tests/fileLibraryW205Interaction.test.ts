// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeTranslator } from "../src/i18n";
import type { FileLibrarySummary } from "../src/types/domain";
import type { BrowseEntry } from "../src/types/fileWorkspace";
import { adaptBrowseEntry, adaptLibrarySummary } from "../src/views/fileLibrary/presentation/adapters";
import type { BrowseSourceOwner } from "../src/views/fileLibrary/browse/browseSourceOwner";
import type { LibrarySourceOwner } from "../src/views/fileLibrary/library/librarySourceOwner";
import {
  createBrowseInteractionProjection,
  createLibraryInteractionProjection,
  selectionIntentFromModifiers
} from "../src/views/fileLibrary/list/interactionAdapters";
import { SharedFileList } from "../src/views/fileLibrary/list/SharedFileList";

const t = makeTranslator("en");
let root: Root | null = null;
let container: HTMLDivElement | null = null;

function librarySummary(id: string): FileLibrarySummary {
  return {
    id,
    name: `${id}.txt`,
    extension: "txt",
    displayDirectory: "C:/Library",
    size: 12,
    modifiedAt: 7,
    createdAt: 6,
    isDirectory: false,
    fileType: "Document",
    purpose: "Work",
    lifecycle: "Active",
    risk: "Low",
    confidence: 1,
    isDuplicate: false,
    requiresReview: false,
    isStale: false,
    tags: [],
    tagCount: 0
  };
}

function browseEntry(id: string, kind: BrowseEntry["kind"] = "file"): BrowseEntry {
  return {
    ref: { kind: "ephemeral", browseSessionId: "browse-session", entryId: id },
    pathRef: kind === "directory" ? { id: `path-${id}` } : undefined,
    name: `${id}.txt`,
    displayPath: `${id}.txt`,
    kind,
    materialization: "unknown"
  };
}

function librarySource(files: FileLibrarySummary[], overrides: Record<string, unknown> = {}) {
  return {
    source: "library",
    files,
    totalCount: files.length,
    collection: null,
    focusedId: files[0]?.id ?? "",
    selection: null,
    selectionContainsFileId: vi.fn(() => false),
    hasMore: false,
    isLoading: false,
    loadNextPage: vi.fn(async () => undefined),
    setExplicitSelection: vi.fn(),
    toggleSelection: vi.fn(),
    selectAllMatching: vi.fn(),
    clearSelection: vi.fn(),
    ...overrides
  } as unknown as LibrarySourceOwner;
}

function browseSource(entries: ReturnType<typeof adaptBrowseEntry>[], overrides: Record<string, unknown> = {}) {
  return {
    entries,
    collection: null,
    focusedId: entries[0]?.entryRef.entryId ?? null,
    selectedIds: new Set<string>(),
    hasMore: false,
    enumerationState: "complete",
    loadNextPage: vi.fn(async () => undefined),
    selectEntry: vi.fn(),
    selectAllLoaded: vi.fn(),
    clearSelection: vi.fn(),
    setFocusedId: vi.fn(),
    ...overrides
  } as unknown as BrowseSourceOwner;
}

afterEach(() => {
  if (root !== null) {
    act(() => root?.unmount());
    root = null;
  }
  container?.remove();
  container = null;
  document.body.innerHTML = "";
});

describe("W2-05 interaction convergence", () => {
  it("keeps Library and Browse projections discriminated and source-bound", () => {
    const library = createLibraryInteractionProjection(librarySource([librarySummary("library-1")]));
    const browse = createBrowseInteractionProjection(browseSource([adaptBrowseEntry(browseEntry("browse-1"))]));

    expect(library.source).toBe("library");
    expect(library.capabilities.selectAll).toBe("all_matching");
    expect(browse.source).toBe("browse");
    expect(browse.capabilities.selectAll).toBe("loaded");
    expect(library.entryAt(0)?.source).toBe("library");
    expect(browse.entryAt(0)?.source).toBe("browse");
    expect(selectionIntentFromModifiers({ shiftKey: true, metaKey: false, ctrlKey: false })).toBe("range");
    expect(selectionIntentFromModifiers({ shiftKey: false, metaKey: true, ctrlKey: false })).toBe("toggle");
  });

  it("routes Library Ctrl/Cmd+A to compact all_matching without logical ID materialization", () => {
    const files = [librarySummary("library-1")];
    const source = librarySource(files, { totalCount: 100_000, hasMore: true });
    const projection = createLibraryInteractionProjection(source);

    expect(projection.rowCount).toBe(100_000);
    expect(projection.loadedRowCount).toBe(1);
    projection.actions.selectAll();

    expect(source.selectAllMatching).toHaveBeenCalledTimes(1);
    expect(source.setExplicitSelection).not.toHaveBeenCalled();
    expect(source.toggleSelection).not.toHaveBeenCalled();
    expect(projection.entryAt(99_999)).toBeUndefined();
  });

  it("routes Browse Select All to loaded entries only and preserves source-local range/toggle", () => {
    const entries = ["browse-1", "browse-2", "browse-3"].map((id) => adaptBrowseEntry(browseEntry(id)));
    const source = browseSource(entries, { hasMore: true, enumerationState: "partial" });
    const projection = createBrowseInteractionProjection(source);

    expect(projection.rowCount).toBe(3);
    projection.actions.selectAll();
    projection.actions.select(entries[1]!, 1, "toggle");
    projection.actions.select(entries[2]!, 2, "range");

    expect(source.selectAllLoaded).toHaveBeenCalledTimes(1);
    expect(source.selectEntry).toHaveBeenNthCalledWith(1, "browse-2", "toggle");
    expect(source.selectEntry).toHaveBeenNthCalledWith(2, "browse-3", "range");
  });

  it("keeps focus projection independent from mounted row membership", () => {
    const entries = ["browse-1", "browse-2"].map((id) => adaptBrowseEntry(browseEntry(id)));
    const source = browseSource(entries, { focusedId: "browse-2" });
    const projection = createBrowseInteractionProjection(source);

    expect(projection.focusedIndex).toBe(1);
    projection.actions.focus(entries[1]!, 1);
    expect(source.setFocusedId).toHaveBeenCalledWith("browse-2");
    expect(projection.entryAt(1)?.renderKey).toContain("browse-2");
  });

  it("keeps the final Library/Browse render surface shared and renderKey presentation-only", () => {
    const libraryMode = readFileSync(resolve("src/views/fileLibrary/library/LibraryMode.tsx"), "utf8");
    const browseMode = readFileSync(resolve("src/views/fileLibrary/browse/BrowseMode.tsx"), "utf8");
    const list = readFileSync(resolve("src/views/fileLibrary/list/SharedFileList.tsx"), "utf8");

    expect(libraryMode).toContain("SharedFileList");
    expect(browseMode).toContain("SharedFileList");
    expect(libraryMode).not.toContain("<FileLibraryList");
    expect(browseMode).not.toContain("BrowseEntryList");
    expect(list).toContain("key={entry.renderKey}");
    expect(list).not.toContain("parseRenderKey");
    expect(list).not.toContain("entry.renderKey.split");
    expect(list).toContain("entryAt(virtualRow.index)");
  });

  it("mounts a bounded virtual row window for a large logical projection", async () => {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    const files = [librarySummary("library-1"), librarySummary("library-2")];
    const source = librarySource(files, { totalCount: 100_000 });
    const projection = createLibraryInteractionProjection(source);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(createElement(SharedFileList, {
        interaction: projection,
        language: "en",
        t,
        ariaLabel: "Files"
      }));
      await Promise.resolve();
    });

    const list = container.querySelector('[role="listbox"]');
    expect(list?.getAttribute("data-file-library-logical-count")).toBe("100000");
    expect(container.querySelectorAll('[role="option"]').length).toBeLessThan(100);
    vi.unstubAllGlobals();
  });
});
