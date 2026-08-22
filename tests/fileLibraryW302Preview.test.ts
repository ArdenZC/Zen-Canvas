// @vitest-environment happy-dom

import { act, createElement, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FileWorkspaceApi } from "../src/api/fileWorkspaceApi";
import { FileWorkspaceController } from "../src/fileWorkspace";
import { makeTranslator } from "../src/i18n";
import type { FileLibrarySummary } from "../src/types/domain";
import type {
  BrowseEntry,
  BrowsePage,
  PreviewCapabilities,
  PreviewSnapshot,
  PreviewSourceRef
} from "../src/types/fileWorkspace";
import { adaptBrowseEntry, adaptLibraryCollection, adaptLibrarySummary } from "../src/views/fileLibrary/presentation/adapters";
import {
  createBrowseInteractionProjection,
  createLibraryInteractionProjection
} from "../src/views/fileLibrary/list/interactionAdapters";
import type { PresentationInteractionProjection } from "../src/views/fileLibrary/list/interactionContracts";
import type { PresentationEntry } from "../src/views/fileLibrary/presentation/contracts";
import { SharedFileGrid } from "../src/views/fileLibrary/list/SharedFileGrid";
import { SharedFileList } from "../src/views/fileLibrary/list/SharedFileList";
import type { BrowseSourceOwner } from "../src/views/fileLibrary/browse/browseSourceOwner";
import type { LibrarySourceOwner } from "../src/views/fileLibrary/library/librarySourceOwner";
import {
  PreviewExperienceController,
  type PreviewSpaceEvent
} from "../src/views/fileLibrary/preview/previewExperienceController";
import { previewSourceFromEntry } from "../src/views/fileLibrary/preview/previewSource";

const t = makeTranslator("en");
const nativeClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
const nativeClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
const nativeOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
const capabilities: PreviewCapabilities = {
  canSearch: false,
  canZoom: false,
  canPlayback: false,
  canSelectText: false,
  canNavigateInternal: false,
  canNavigateSiblings: false,
  canOpenExternal: false,
  canReveal: false,
  canRequestMaterialization: false
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function emptyPage(): BrowsePage {
  return {
    sessionId: "session",
    requestId: "request",
    enumerationId: "enumeration",
    entries: [],
    completion: "complete"
  };
}

function makeSnapshot(
  previewId: string,
  requestId: string,
  source: PreviewSnapshot["source"],
  state: PreviewSnapshot["state"] = "idle"
): PreviewSnapshot {
  return {
    previewId,
    sessionId: previewId,
    requestId,
    source,
    hostKind: "zen_floating",
    state,
    effectiveCapabilities: capabilities
  };
}

function makePreviewApi({ deferSwitch = false } = {}) {
  const records = new Map<string, PreviewSnapshot>();
  const starts: Array<{
    previewId: string;
    requestId: string;
    source: PreviewSourceRef;
    deferred: ReturnType<typeof deferred<PreviewSnapshot>>;
  }> = [];
  const switches: Array<{
    previewId: string;
    requestId: string;
    source: PreviewSourceRef;
    deferred: ReturnType<typeof deferred<PreviewSnapshot>>;
  }> = [];
  const previewCancel = vi.fn(async () => true);
  const previewDispose = vi.fn(async ({ previewId }: { previewId: string }) => {
    records.delete(previewId);
    return true;
  });
  const api: FileWorkspaceApi = {
    browseOpen: async () => { throw new Error("unused"); },
    browseRestore: async () => { throw new Error("unused"); },
    locationBrowse: async () => { throw new Error("unused"); },
    browseStartEnumeration: async () => emptyPage(),
    browseNextPage: async () => emptyPage(),
    browseCancel: async () => undefined,
    browseReleasePage: async () => undefined,
    browseReleasePath: async () => undefined,
    browseRetainPath: async () => undefined,
    browseDispose: async () => undefined,
    locationList: async () => [],
    changeStart: async () => ({ monitorId: "monitor", sessionId: "session", pathRef: { id: "path" } }),
    changePending: async () => null,
    changeRefresh: async () => emptyPage(),
    changeDispose: async () => undefined,
    readEligibility: async ({ source }) => ({ source, eligibility: "eligible" }),
    thumbnailRequest: async () => ({ cacheKey: "cache", bytes: new Uint8Array() }),
    thumbnailCancel: async () => true,
    previewCreate: async ({ requestId, source }) => {
      const snapshot = makeSnapshot(`preview-${records.size + 1}`, requestId, source);
      records.set(snapshot.previewId, snapshot);
      return snapshot;
    },
    previewSnapshot: async ({ previewId }) => records.get(previewId) ?? makeSnapshot(previewId, "missing", { kind: "managed", fileId: "missing" }),
    previewStart: async ({ previewId }) => {
      const snapshot = records.get(previewId);
      if (!snapshot) throw new Error("preview_missing");
      const pending = deferred<PreviewSnapshot>();
      starts.push({ previewId, requestId: snapshot.requestId, source: snapshot.source, deferred: pending });
      return pending.promise;
    },
    previewCancel,
    previewDispose,
    previewSwitchSource: async ({ previewId, requestId, source }) => {
      const snapshot = records.get(previewId);
      if (!snapshot) throw new Error("preview_missing");
      const next = makeSnapshot(previewId, requestId, source, "resolving");
      if (deferSwitch) {
        const pending = deferred<PreviewSnapshot>();
        switches.push({ previewId, requestId, source, deferred: pending });
        return pending.promise;
      }
      records.set(previewId, next);
      return next;
    },
    previewAssetRequest: async () => { throw new Error("unused"); }
  };
  function resolveSwitch(pending: (typeof switches)[number]) {
    const next = makeSnapshot(pending.previewId, pending.requestId, pending.source, "resolving");
    records.set(pending.previewId, next);
    pending.deferred.resolve(next);
  }

  function resolveStart(pending: (typeof starts)[number]) {
    pending.deferred.resolve(makeSnapshot(pending.previewId, pending.requestId, pending.source, "ready"));
  }

  return { api, starts, switches, resolveSwitch, resolveStart, previewCancel, previewDispose };
}

function summary(id: string): FileLibrarySummary {
  return {
    id,
    name: `${id}.txt`,
    extension: "txt",
    displayDirectory: "Documents",
    size: 12,
    modifiedAt: 1,
    createdAt: 1,
    isDirectory: false,
    fileType: "text",
    purpose: "document",
    lifecycle: "active",
    risk: "low",
    confidence: 1,
    isDuplicate: false,
    requiresReview: false,
    isStale: false,
    tags: [],
    tagCount: 0
  };
}

function source(id: string) {
  const entry = adaptLibrarySummary(summary(id));
  return previewSourceFromEntry(entry, adaptLibraryCollection({ queryFingerprint: "query", snapshotRevision: 1 }));
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

function browseEntry(id: string): BrowseEntry {
  return {
    ref: { kind: "ephemeral", browseSessionId: "browse-session", entryId: id },
    name: `${id}.md`,
    displayPath: `${id}.md`,
    kind: "file",
    materialization: "unknown"
  };
}

function keyboardInteractionModel(source: "library" | "browse") {
  const focusedId = { value: null as string | null };
  const focusCalls = vi.fn();
  const selectionCalls = {
    select: vi.fn(),
    selectAll: vi.fn(),
    clearSelection: vi.fn(),
    toggle: vi.fn()
  };
  const libraryFiles = [summary("library-a"), summary("library-b")];
  const entries = source === "library"
    ? libraryFiles.map((file) => adaptLibrarySummary(file))
    : [adaptBrowseEntry(browseEntry("browse-a")), adaptBrowseEntry(browseEntry("browse-b"))];

  if (source === "library") {
    const owner = {
      files: libraryFiles,
      totalCount: entries.length,
      collection: null,
      get focusedId() { return focusedId.value; },
      selection: null,
      selectionContainsFileId: () => false,
      hasMore: false,
      isLoading: false,
      loadNextPage: async () => undefined,
      setExplicitSelection: selectionCalls.select,
      setFocusedId: vi.fn((id: string | null) => {
        focusedId.value = id;
        focusCalls(id);
      }),
      toggleSelection: selectionCalls.toggle,
      selectAllMatching: selectionCalls.selectAll,
      clearSelection: selectionCalls.clearSelection
    } as unknown as LibrarySourceOwner;
    return {
      entries,
      focusedId,
      focusCalls,
      selectionCalls,
      projection: () => createLibraryInteractionProjection(owner)
    };
  }

  const browseEntries = entries as ReturnType<typeof adaptBrowseEntry>[];
  const owner = {
    entries: browseEntries,
    collection: null,
    get focusedId() { return focusedId.value; },
    selectedIds: new Set<string>(),
    hasMore: false,
    enumerationState: "complete",
    loadNextPage: async () => undefined,
    selectEntry: selectionCalls.select,
    selectAllLoaded: selectionCalls.selectAll,
    clearSelection: selectionCalls.clearSelection,
    setFocusedId: vi.fn((id: string | null) => {
      focusedId.value = id;
      focusCalls(id);
    })
  } as unknown as BrowseSourceOwner;
  return {
    entries,
    focusedId,
    focusCalls,
    selectionCalls,
    projection: () => createBrowseInteractionProjection(owner)
  };
}

function previewControllerStub() {
  return {
    requestThumbnail: vi.fn(async () => null),
    cancelThumbnail: vi.fn(async () => undefined)
  } as unknown as FileWorkspaceController;
}

async function mountPreviewSurface(
  kind: "list" | "grid",
  interaction: PresentationInteractionProjection,
  onPreview: (entry: PresentationEntry, trigger: HTMLElement, event: ReactKeyboardEvent<HTMLDivElement>) => boolean
) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 640 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 240 });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: 240 });
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  const render = async (nextInteraction: PresentationInteractionProjection) => {
    await act(async () => {
      if (kind === "list") {
        root.render(createElement(SharedFileList, {
          interaction: nextInteraction,
          language: "en",
          t,
          ariaLabel: "Files",
          onPreview
        }));
      } else {
        root.render(createElement(SharedFileGrid, {
          interaction: nextInteraction,
          language: "en",
          t,
          controller: previewControllerStub(),
          ariaLabel: "Files",
          onPreview
        }));
      }
      await Promise.resolve();
    });
  };
  await render(interaction);
  const surface = container.querySelector<HTMLElement>(kind === "list" ? "[role='listbox']" : "[role='grid']");
  if (surface === null) throw new Error(`SharedFile${kind === "list" ? "List" : "Grid"} did not mount`);
  return { container, root, render, surface };
}

describe("W3-02 Zen floating quick preview", () => {
  it("keeps source refs opaque and bounded to the loaded collection", () => {
    const library = source("file-a");
    expect(library?.previewSource).toEqual({ kind: "managed", fileId: "file-a" });
    expect(JSON.stringify(library)).not.toContain("path");

    const browseEntry = adaptBrowseEntry({
      ref: { kind: "ephemeral", browseSessionId: "browse-1", entryId: "entry-1" },
      pathRef: { id: "opaque-folder-ref" },
      name: "notes.md",
      displayPath: "not-an-authority",
      kind: "file",
      materialization: "unknown"
    });
    const browse = previewSourceFromEntry(browseEntry, {
      source: "browse",
      provenance: {
        sessionId: "browse-1",
        requestId: "request-1",
        enumerationId: "enumeration-1",
        completion: "complete",
        knownCount: 1
      }
    });
    expect(browse?.previewSource).toEqual({ kind: "ephemeral", browseSessionId: "browse-1", entryId: "entry-1" });
    expect(JSON.stringify(browse)).not.toContain("opaque-folder-ref");
  });

  it.each([
    ["library", "list"],
    ["library", "grid"],
    ["browse", "list"],
    ["browse", "grid"]
  ] as const)("requires source-owned focus before Space Preview (%s %s)", async (sourceKind, surfaceKind) => {
    const model = keyboardInteractionModel(sourceKind);
    const onPreview = vi.fn((_entry: PresentationEntry) => true);
    const mounted = await mountPreviewSurface(surfaceKind, model.projection(), onPreview);
    expect(model.projection().focusedIndex).toBe(-1);

    mounted.surface.focus();
    const noFocusSpace = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    mounted.surface.dispatchEvent(noFocusSpace);

    expect(onPreview).not.toHaveBeenCalled();
    expect(noFocusSpace.defaultPrevented).toBe(false);
    expect(model.focusedId.value).toBeNull();
    expect(model.focusCalls).not.toHaveBeenCalled();
    expect(model.selectionCalls.select).not.toHaveBeenCalled();
    expect(model.selectionCalls.selectAll).not.toHaveBeenCalled();
    expect(model.selectionCalls.clearSelection).not.toHaveBeenCalled();
    expect(model.selectionCalls.toggle).not.toHaveBeenCalled();

    const arrowDown = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true });
    mounted.surface.dispatchEvent(arrowDown);
    expect(model.focusCalls).toHaveBeenCalledWith(model.entries[0]!.source === "library"
      ? model.entries[0]!.entryRef.fileId
      : model.entries[0]!.entryRef.entryId);

    await mounted.render(model.projection());
    expect(model.projection().focusedIndex).toBe(0);
    const focusedSpace = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    mounted.surface.dispatchEvent(focusedSpace);

    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onPreview.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      source: sourceKind,
      entryRef: model.entries[0]!.entryRef,
      displayName: model.entries[0]!.displayName
    }));
    expect(focusedSpace.defaultPrevented).toBe(true);
    mounted.root.unmount();
    mounted.container.remove();
  });

  it("opens shell-first, invalidates stale A/B results, and publishes only C", async () => {
    const { api, starts } = makePreviewApi();
    const workspace = new FileWorkspaceController(api);
    const controller = new PreviewExperienceController(workspace);
    const first = source("file-a")!;
    const second = source("file-b")!;
    const third = source("file-c")!;
    const trigger = document.body.appendChild(document.createElement("button"));
    const snapshots: Array<PreviewSnapshot | null> = [];
    controller.subscribe((state) => snapshots.push(state.snapshot));

    expect(controller.open(first, trigger)).toBe(true);
    expect(controller.getState().visible).toBe(true);
    expect(controller.getState().phase).toBe("resolving");
    expect(controller.getState().snapshot).toBeNull();

    await flush();
    expect(starts).toHaveLength(1);
    expect(controller.open(second, trigger)).toBe(true);
    await flush();
    expect(starts).toHaveLength(2);
    expect(controller.open(third, trigger)).toBe(true);
    await flush();
    expect(starts).toHaveLength(3);

    starts[0]!.deferred.resolve(makeSnapshot("preview-1", "w3-02-preview-1-1", first.previewSource, "ready"));
    starts[1]!.deferred.resolve(makeSnapshot("preview-1", "w3-02-preview-2-2", second.previewSource, "ready"));
    starts[2]!.deferred.resolve(makeSnapshot("preview-1", "w3-02-preview-3-3", third.previewSource, "ready"));
    await flush();

    expect(controller.getState().source?.previewSource).toEqual(third.previewSource);
    expect(controller.getState().phase).toBe("metadata_fallback");
    expect(snapshots.filter((snapshot) => snapshot?.state === "ready").every((snapshot) => snapshot?.source === third.previewSource)).toBe(true);
  });

  it("keeps C as the latest source when C resolves before late B and A", async () => {
    const { api, starts, switches, resolveStart, resolveSwitch, previewCancel, previewDispose } = makePreviewApi({ deferSwitch: true });
    const workspace = new FileWorkspaceController(api);
    const controller = new PreviewExperienceController(workspace);
    const first = source("file-a")!;
    const second = source("file-b")!;
    const third = source("file-c")!;
    const trigger = document.body.appendChild(document.createElement("button"));

    expect(controller.open(first, trigger)).toBe(true);
    await flush();
    expect(starts).toHaveLength(1);
    expect(controller.open(second, trigger)).toBe(true);
    await flush();
    expect(switches).toHaveLength(1);
    expect(controller.open(third, trigger)).toBe(true);
    await flush();
    expect(switches).toHaveLength(2);

    resolveSwitch(switches[1]!);
    await flush();
    expect(starts).toHaveLength(2);
    resolveStart(starts[1]!);
    await flush();

    resolveSwitch(switches[0]!);
    await flush();
    resolveStart(starts[0]!);
    await flush();

    const cached = workspace.getState().previews[controller.getState().previewId!];
    expect(controller.getState().visible).toBe(true);
    expect(controller.getState().source?.previewSource).toEqual(third.previewSource);
    expect(controller.getState().snapshot?.source).toEqual(third.previewSource);
    expect(cached?.source).toEqual(third.previewSource);
    expect(previewCancel).not.toHaveBeenCalled();
    expect(previewDispose).not.toHaveBeenCalled();
  });

  it("keeps C when B resolves before the latest C switch", async () => {
    const { api, starts, switches, resolveStart, resolveSwitch } = makePreviewApi({ deferSwitch: true });
    const workspace = new FileWorkspaceController(api);
    const controller = new PreviewExperienceController(workspace);
    const first = source("file-a")!;
    const second = source("file-b")!;
    const third = source("file-c")!;
    const trigger = document.body.appendChild(document.createElement("button"));

    controller.open(first, trigger);
    await flush();
    controller.open(second, trigger);
    await flush();
    controller.open(third, trigger);
    await flush();

    resolveSwitch(switches[0]!);
    await flush();
    expect(workspace.getState().previews["preview-1"]?.source).not.toEqual(second.previewSource);
    resolveSwitch(switches[1]!);
    await flush();
    expect(starts).toHaveLength(2);
    resolveStart(starts[1]!);
    await flush();
    resolveStart(starts[0]!);
    await flush();

    expect(controller.getState().snapshot?.source).toEqual(third.previewSource);
    expect(workspace.getState().previews["preview-1"]?.source).toEqual(third.previewSource);
  });

  it("does not let a late A start overwrite the cache after switching to B", async () => {
    const { api, starts, resolveStart } = makePreviewApi();
    const workspace = new FileWorkspaceController(api);
    const controller = new PreviewExperienceController(workspace);
    const first = source("file-a")!;
    const second = source("file-b")!;
    const trigger = document.body.appendChild(document.createElement("button"));

    controller.open(first, trigger);
    await flush();
    controller.open(second, trigger);
    await flush();
    expect(starts).toHaveLength(2);

    resolveStart(starts[1]!);
    await flush();
    resolveStart(starts[0]!);
    await flush();

    expect(controller.getState().snapshot?.source).toEqual(second.previewSource);
    expect(workspace.getState().previews["preview-1"]?.source).toEqual(second.previewSource);
  });

  it("guards input, IME and Alt+Space, and disposes one pending session once", async () => {
    const { api, starts, previewCancel, previewDispose } = makePreviewApi();
    const workspace = new FileWorkspaceController(api);
    const controller = new PreviewExperienceController(workspace);
    const current = source("file-a")!;
    const trigger = document.body.appendChild(document.createElement("button"));
    const input = document.body.appendChild(document.createElement("input"));
    const menu = document.body.appendChild(document.createElement("div"));
    menu.setAttribute("role", "menu");
    const guarded = (overrides: Partial<PreviewSpaceEvent>): PreviewSpaceEvent => ({
      altKey: false,
      isComposing: false,
      target: input,
      ...overrides
    });

    expect(controller.handleSpace(current, trigger, guarded({}))).toBe(false);
    expect(controller.handleSpace(current, trigger, guarded({ target: trigger, isComposing: true }))).toBe(false);
    expect(controller.handleSpace(current, trigger, guarded({ target: trigger, altKey: true }))).toBe(false);
    expect(controller.handleSpace(current, trigger, guarded({ target: trigger, repeat: true }))).toBe(false);
    expect(controller.handleSpace(current, trigger, guarded({ target: menu }))).toBe(false);
    expect(controller.handleSpace(current, trigger, guarded({ target: trigger, defaultPrevented: true }))).toBe(false);
    expect(controller.handleSpace(null, trigger, guarded({ target: trigger }))).toBe(false);

    expect(controller.handleSpace(current, trigger, guarded({ target: trigger }))).toBe(true);
    await flush();
    expect(starts).toHaveLength(1);
    expect(controller.handleSpace(current, trigger, guarded({ target: trigger }))).toBe(true);
    await flush();
    expect(previewCancel).toHaveBeenCalledTimes(1);
    expect(previewDispose).toHaveBeenCalledTimes(1);

    starts[0]!.deferred.resolve(makeSnapshot("preview-1", "w3-02-preview-1-1", current.previewSource, "ready"));
    await flush();
    expect(previewCancel).toHaveBeenCalledTimes(1);
    expect(previewDispose).toHaveBeenCalledTimes(1);
  });

  it("leaves Enter alone and consumes Space only when preview accepts it", async () => {
    const entry = adaptLibrarySummary(summary("file-a"));
    const interaction = createLibraryInteractionProjection({
      files: [summary("file-a")],
      totalCount: 1,
      collection: adaptLibraryCollection({ queryFingerprint: "query", snapshotRevision: 1 }),
      focusedId: "file-a",
      selection: null,
      selectionContainsFileId: () => false,
      hasMore: false,
      isLoading: false,
      loadNextPage: async () => undefined,
      setExplicitSelection: () => undefined,
      setFocusedId: () => undefined,
      toggleSelection: () => undefined,
      selectAllMatching: () => undefined,
      clearSelection: () => undefined
    });
    const onPreview = vi.fn(() => true);
    const container = document.body.appendChild(document.createElement("div"));
    const root: Root = createRoot(container);
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 220 });
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: 220 });
    class ResizeObserverStub { observe() {} disconnect() {} }
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);

    await act(async () => {
      root.render(createElement(SharedFileList, {
        interaction,
        language: "en",
        t,
        ariaLabel: "Files",
        onPreview
      }));
      await Promise.resolve();
    });
    const list = container.querySelector<HTMLElement>("[role='listbox']");
    expect(list).not.toBeNull();
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    list!.dispatchEvent(enter);
    expect(onPreview).not.toHaveBeenCalled();
    expect(enter.defaultPrevented).toBe(false);
    const space = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    list!.dispatchEvent(space);
    expect(onPreview).toHaveBeenCalledWith(entry, list, expect.anything());
    expect(space.defaultPrevented).toBe(true);
    root.unmount();
  });
});

afterEach(() => {
  document.body.innerHTML = "";
  if (nativeClientWidth) Object.defineProperty(HTMLElement.prototype, "clientWidth", nativeClientWidth);
  else delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
  if (nativeClientHeight) Object.defineProperty(HTMLElement.prototype, "clientHeight", nativeClientHeight);
  else delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
  if (nativeOffsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", nativeOffsetHeight);
  else delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight;
  vi.unstubAllGlobals();
});
