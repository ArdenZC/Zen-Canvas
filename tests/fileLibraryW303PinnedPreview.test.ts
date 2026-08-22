// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import type { FileWorkspaceApi } from "../src/api/fileWorkspaceApi";
import { FileWorkspaceController } from "../src/fileWorkspace";
import { adaptLibraryCollection, adaptLibrarySummary } from "../src/views/fileLibrary/presentation/adapters";
import type { FileLibrarySummary } from "../src/types/domain";
import type { PreviewCapabilities, PreviewSnapshot, PreviewSourceRef } from "../src/types/fileWorkspace";
import {
  PreviewExperienceController,
  type PreviewPinnedHandoff
} from "../src/views/fileLibrary/preview/previewExperienceController";
import { previewSourceFromEntry } from "../src/views/fileLibrary/preview/previewSource";
import {
  createPreviewSiblingNavigation,
  previewSiblingNavigationState
} from "../src/views/fileLibrary/preview/previewSiblingNavigation";

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
  const starts: Array<{
    previewId: string;
    requestId: string;
    source: PreviewSourceRef;
    deferred: ReturnType<typeof deferred<PreviewSnapshot>>;
  }> = [];
  const createCalls: PreviewSnapshot["hostKind"][] = [];
  const disposeCalls: string[] = [];
  const api: FileWorkspaceApi = {
    browseOpen: async () => { throw new Error("unused"); },
    browseRestore: async () => { throw new Error("unused"); },
    locationBrowse: async () => { throw new Error("unused"); },
    browseStartEnumeration: async () => ({ sessionId: "session", requestId: "request", enumerationId: "enumeration", entries: [], completion: "complete" }),
    browseNextPage: async () => ({ sessionId: "session", requestId: "request", enumerationId: "enumeration", entries: [], completion: "complete" }),
    browseCancel: async () => undefined,
    browseReleasePage: async () => undefined,
    browseReleasePath: async () => undefined,
    browseRetainPath: async () => undefined,
    browseDispose: async () => undefined,
    locationList: async () => [],
    changeStart: async () => ({ monitorId: "monitor", sessionId: "session", pathRef: { id: "path" } }),
    changePending: async () => null,
    changeRefresh: async () => ({ sessionId: "session", requestId: "request", enumerationId: "enumeration", entries: [], completion: "complete" }),
    changeDispose: async () => undefined,
    readEligibility: async ({ source }) => ({ source, eligibility: "eligible" }),
    thumbnailRequest: async () => ({ cacheKey: "cache", bytes: new Uint8Array() }),
    thumbnailCancel: async () => true,
    previewCreate: async ({ requestId, source, hostKind }) => {
      const snapshot = makeSnapshot(`preview-${records.size + 1}`, requestId, source);
      records.set(snapshot.previewId, snapshot);
      createCalls.push(hostKind);
      return snapshot;
    },
    previewSnapshot: async ({ previewId }) => records.get(previewId) ?? makeSnapshot(previewId, "missing", { kind: "managed", fileId: "missing" }),
    previewStart: async ({ previewId }) => {
      const current = records.get(previewId);
      if (!current) throw new Error("preview_missing");
      const pending = deferred<PreviewSnapshot>();
      starts.push({ previewId, requestId: current.requestId, source: current.source, deferred: pending });
      return pending.promise;
    },
    previewCancel: async () => true,
    previewDispose: async ({ previewId }) => {
      disposeCalls.push(previewId);
      records.delete(previewId);
      return true;
    },
    previewSwitchSource: async ({ previewId, requestId, source }) => {
      const next = makeSnapshot(previewId, requestId, source, "resolving");
      records.set(previewId, next);
      return next;
    },
    previewAssetRequest: async () => { throw new Error("unused"); }
  };
  return { api, starts, createCalls, disposeCalls };
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

function source(id: string, snapshotRevision = 1) {
  return previewSourceFromEntry(
    adaptLibrarySummary(summary(id)),
    adaptLibraryCollection({ queryFingerprint: "query", snapshotRevision })
  )!;
}

async function flush() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("W3-03 pinned Preview and bounded sibling navigation", () => {
  it("uses one backend session for a typed Floating to Pinned handoff", async () => {
    const fixture = makePreviewApi();
    const handoffs: PreviewPinnedHandoff[] = [];
    const workspace = new FileWorkspaceController(fixture.api);
    const controller = new PreviewExperienceController(workspace, undefined, (handoff) => {
      handoffs.push(handoff);
      return true;
    });
    const current = source("file-a");
    const trigger = document.body.appendChild(document.createElement("button"));

    expect(controller.open(current, trigger)).toBe(true);
    await flush();
    const previewId = controller.getState().previewId;
    expect(previewId).toBe("preview-1");
    expect(fixture.createCalls).toEqual(["zen_floating"]);

    expect(controller.pin()).toBe(true);
    expect(controller.getState().host).toBe("pinned");
    expect(handoffs).toHaveLength(1);
    expect(handoffs[0]).toEqual(expect.objectContaining({
      fromHost: "zen_floating",
      toHost: "zen_pinned",
      previewId,
      source: { kind: "managed", fileId: "file-a" }
    }));
    expect(JSON.stringify(handoffs[0])).not.toContain("path");
    expect(fixture.starts).toHaveLength(1);
    expect(fixture.disposeCalls).toHaveLength(0);

    fixture.starts[0]!.deferred.resolve(makeSnapshot(previewId!, fixture.starts[0]!.requestId, current.previewSource, "ready"));
    await flush();
    expect(controller.getState().host).toBe("pinned");
    expect(controller.getState().snapshot?.source).toEqual(current.previewSource);

    controller.close("unpin");
    await flush();
    expect(fixture.createCalls).toHaveLength(1);
    expect(fixture.disposeCalls).toEqual([previewId]);
  });

  it("rejects a failed handoff without changing the Floating host", async () => {
    const fixture = makePreviewApi();
    const workspace = new FileWorkspaceController(fixture.api);
    const controller = new PreviewExperienceController(workspace, undefined, () => false);
    const current = source("file-a");
    const trigger = document.body.appendChild(document.createElement("button"));

    controller.open(current, trigger);
    await flush();
    expect(controller.pin()).toBe(false);
    expect(controller.getState().host).toBe("floating");
    expect(fixture.disposeCalls).toHaveLength(0);
    controller.close("button");
  });

  it("clears stale content and exposes no-source while Pinned", async () => {
    const fixture = makePreviewApi();
    const workspace = new FileWorkspaceController(fixture.api);
    const controller = new PreviewExperienceController(workspace, undefined, () => true);
    const current = source("file-a");
    const trigger = document.body.appendChild(document.createElement("button"));

    controller.open(current, trigger);
    await flush();
    controller.pin();
    fixture.starts[0]!.deferred.resolve(makeSnapshot("preview-1", fixture.starts[0]!.requestId, current.previewSource, "ready"));
    await flush();

    controller.observeSource(null);
    await flush();
    const state = controller.getState();
    expect(state.visible).toBe(true);
    expect(state.host).toBe("pinned");
    expect(state.source).toBeNull();
    expect(state.snapshot).toBeNull();
    expect(state.phase).toBe("no_source");
    expect(fixture.disposeCalls).toEqual(["preview-1"]);
  });

  it("invalidates sibling windows by source generation and never expands hidden selection", () => {
    const current = source("file-b");
    const move = vi.fn(async () => true);
    const projection = createPreviewSiblingNavigation({
      source: "library",
      generation: current.generation,
      currentKey: current.key,
      currentIndex: 1,
      loadedCount: 3,
      hasMore: false,
      move
    });
    const state = previewSiblingNavigationState(projection, current);
    expect(state).toEqual(expect.objectContaining({ previousAvailable: true, nextAvailable: true }));
    expect(JSON.stringify(projection)).not.toContain("all_matching");
    expect(JSON.stringify(projection)).not.toContain("path");

    expect(previewSiblingNavigationState(projection, source("file-b", 2))).toBeNull();
    expect(previewSiblingNavigationState({ ...projection, currentIndex: 3 }, current)).toBeNull();
    expect(previewSiblingNavigationState({ ...projection, currentIndex: 2, loadedCount: 3, hasMore: true }, current)?.nextAvailable).toBe(true);
  });

  it("delegates navigation to the owner and serializes the busy state", async () => {
    const fixture = makePreviewApi();
    const workspace = new FileWorkspaceController(fixture.api);
    const controller = new PreviewExperienceController(workspace);
    const current = source("file-a");
    const trigger = document.body.appendChild(document.createElement("button"));
    const move = deferred<boolean>();
    const projection = createPreviewSiblingNavigation({
      source: "library",
      generation: current.generation,
      currentKey: current.key,
      currentIndex: 0,
      loadedCount: 2,
      hasMore: false,
      move: () => move.promise
    });

    controller.open(current, trigger);
    await flush();
    controller.setSiblingNavigation(projection);
    const moving = controller.moveSibling("next");
    await flush();
    expect(controller.getState().navigationBusy).toBe(true);
    move.resolve(true);
    await expect(moving).resolves.toBe(true);
    expect(controller.getState().navigationBusy).toBe(false);
    controller.close("button");
  });
});
