// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FileWorkspaceApi } from "../src/api/fileWorkspaceApi";
import { FileWorkspaceController } from "../src/fileWorkspace";
import { makeTranslator } from "../src/i18n";
import type { FileLibrarySummary } from "../src/types/domain";
import type {
  BrowsePage,
  PreviewCapabilities,
  PreviewSnapshot
} from "../src/types/fileWorkspace";
import { adaptBrowseEntry, adaptLibraryCollection, adaptLibrarySummary } from "../src/views/fileLibrary/presentation/adapters";
import { createLibraryInteractionProjection } from "../src/views/fileLibrary/list/interactionAdapters";
import { SharedFileList } from "../src/views/fileLibrary/list/SharedFileList";
import {
  PreviewExperienceController,
  type PreviewSpaceEvent
} from "../src/views/fileLibrary/preview/previewExperienceController";
import { previewSourceFromEntry } from "../src/views/fileLibrary/preview/previewSource";

const t = makeTranslator("en");
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

function makePreviewApi() {
  const records = new Map<string, PreviewSnapshot>();
  const starts: Array<{ previewId: string; deferred: ReturnType<typeof deferred<PreviewSnapshot>> }> = [];
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
      starts.push({ previewId, deferred: pending });
      return pending.promise;
    },
    previewCancel,
    previewDispose,
    previewSwitchSource: async ({ previewId, requestId, source }) => {
      const snapshot = records.get(previewId);
      if (!snapshot) throw new Error("preview_missing");
      const next = makeSnapshot(previewId, requestId, source, "resolving");
      records.set(previewId, next);
      return next;
    },
    previewAssetRequest: async () => { throw new Error("unused"); }
  };
  return { api, starts, previewCancel, previewDispose };
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
  vi.unstubAllGlobals();
});
