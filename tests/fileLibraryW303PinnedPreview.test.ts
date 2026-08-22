// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import type { FileWorkspaceApi } from "../src/api/fileWorkspaceApi";
import { FileWorkspaceController } from "../src/fileWorkspace";
import { adaptLibraryCollection, adaptLibrarySummary } from "../src/views/fileLibrary/presentation/adapters";
import type { FileLibrarySummary } from "../src/types/domain";
import type {
  BrowseEntry,
  BrowsePage,
  PreviewCapabilities,
  PreviewHostKind,
  PreviewSnapshot,
  PreviewSourceRef
} from "../src/types/fileWorkspace";
import { scanNextBrowsePages } from "../src/views/fileLibrary/browse/browseSourceOwner";
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
  state: PreviewSnapshot["state"] = "idle",
  hostKind: PreviewHostKind = "zen_floating"
): PreviewSnapshot {
  return {
    previewId,
    sessionId: previewId,
    requestId,
    source,
    hostKind,
    state,
    effectiveCapabilities: capabilities
  };
}

function makePreviewApi({ deferSwitch = false } = {}) {
  const records = new Map<string, PreviewSnapshot>();
  let nextPreviewId = 1;
  const starts: Array<{
    previewId: string;
    requestId: string;
    source: PreviewSourceRef;
    hostKind: PreviewHostKind;
    deferred: ReturnType<typeof deferred<PreviewSnapshot>>;
  }> = [];
  const switches: Array<{
    previewId: string;
    requestId: string;
    source: PreviewSourceRef;
    deferred: ReturnType<typeof deferred<PreviewSnapshot>>;
  }> = [];
  const createCalls: Array<{
    previewId: string;
    source: PreviewSourceRef;
    hostKind: PreviewHostKind;
  }> = [];
  const cancelCalls: string[] = [];
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
      const previewId = `preview-${nextPreviewId}`;
      nextPreviewId += 1;
      const snapshot = makeSnapshot(previewId, requestId, source, "idle", hostKind);
      records.set(snapshot.previewId, snapshot);
      createCalls.push({ previewId, source, hostKind });
      return snapshot;
    },
    previewSnapshot: async ({ previewId }) => records.get(previewId) ?? makeSnapshot(previewId, "missing", { kind: "managed", fileId: "missing" }),
    previewStart: async ({ previewId }) => {
      const current = records.get(previewId);
      if (!current) throw new Error("preview_missing");
      const pending = deferred<PreviewSnapshot>();
      starts.push({
        previewId,
        requestId: current.requestId,
        source: current.source,
        hostKind: current.hostKind,
        deferred: pending
      });
      return pending.promise;
    },
    previewCancel: async ({ previewId }) => {
      cancelCalls.push(previewId);
      return true;
    },
    previewDispose: async ({ previewId }) => {
      disposeCalls.push(previewId);
      records.delete(previewId);
      return true;
    },
    previewSwitchSource: async ({ previewId, requestId, source }) => {
      const current = records.get(previewId);
      if (current === undefined) throw new Error("preview_missing");
      if (deferSwitch) {
        const pending = deferred<PreviewSnapshot>();
        switches.push({ previewId, requestId, source, deferred: pending });
        return pending.promise;
      }
      const next = makeSnapshot(previewId, requestId, source, "resolving", current.hostKind);
      records.set(previewId, next);
      return next;
    },
    previewAssetRequest: async () => { throw new Error("unused"); }
  };
  function resolveStart(pending: (typeof starts)[number], state: PreviewSnapshot["state"] = "ready") {
    pending.deferred.resolve(makeSnapshot(
      pending.previewId,
      pending.requestId,
      pending.source,
      state,
      pending.hostKind
    ));
  }

  function resolveSwitch(pending: (typeof switches)[number]) {
    const current = records.get(pending.previewId);
    if (current === undefined) throw new Error("preview_missing");
    const next = makeSnapshot(
      pending.previewId,
      pending.requestId,
      pending.source,
      "resolving",
      current.hostKind
    );
    records.set(pending.previewId, next);
    pending.deferred.resolve(next);
  }

  function getBackendPreview(previewId: string) {
    return records.get(previewId);
  }

  return {
    api,
    starts,
    switches,
    createCalls,
    cancelCalls,
    disposeCalls,
    resolveStart,
    resolveSwitch,
    getBackendPreview
  };
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
  it("stages truthful Pinned backend identity before committing the Context handoff", async () => {
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
    expect(fixture.createCalls.map((call) => call.hostKind)).toEqual(["zen_floating"]);

    await expect(controller.pin()).resolves.toBe(true);
    expect(controller.getState().host).toBe("pinned");
    expect(controller.getState().previewId).toBe("preview-2");
    expect(handoffs).toHaveLength(1);
    expect(handoffs[0]).toEqual(expect.objectContaining({
      fromHost: "zen_floating",
      toHost: "zen_pinned",
      previewId,
      stagedPreviewId: "preview-2",
      source: { kind: "managed", fileId: "file-a" }
    }));
    expect(JSON.stringify(handoffs[0])).not.toContain("path");
    expect(fixture.createCalls.map((call) => call.hostKind)).toEqual(["zen_floating", "zen_pinned"]);
    expect(fixture.starts).toHaveLength(2);
    expect(fixture.disposeCalls).toEqual([previewId]);
    expect(fixture.cancelCalls).toEqual([previewId]);

    fixture.resolveStart(fixture.starts[1]!);
    await flush();
    expect(controller.getState().host).toBe("pinned");
    expect(controller.getState().snapshot?.source).toEqual(current.previewSource);
    expect(controller.getState().snapshot?.hostKind).toBe("zen_pinned");
    expect(fixture.getBackendPreview("preview-2")?.hostKind).toBe("zen_pinned");

    // A superseded Floating completion is deliberately late and must not
    // publish over the accepted Pinned snapshot.
    fixture.resolveStart(fixture.starts[0]!);
    await flush();
    expect(controller.getState().snapshot?.source).toEqual(current.previewSource);
    expect(controller.getState().snapshot?.hostKind).toBe("zen_pinned");

    controller.close("unpin");
    await flush();
    expect(fixture.createCalls).toHaveLength(2);
    expect(fixture.disposeCalls).toEqual([previewId, "preview-2"]);
  });

  it("rejects a failed handoff without changing the Floating host", async () => {
    const fixture = makePreviewApi();
    const workspace = new FileWorkspaceController(fixture.api);
    const controller = new PreviewExperienceController(workspace, undefined, () => false);
    const current = source("file-a");
    const trigger = document.body.appendChild(document.createElement("button"));

    controller.open(current, trigger);
    await flush();
    await expect(controller.pin()).resolves.toBe(false);
    expect(controller.getState().host).toBe("floating");
    expect(controller.getState().previewId).toBe("preview-1");
    expect(fixture.createCalls.map((call) => call.hostKind)).toEqual(["zen_floating", "zen_pinned"]);
    expect(fixture.disposeCalls).toEqual(["preview-2"]);
    expect(fixture.getBackendPreview("preview-1")).toEqual(expect.objectContaining({ hostKind: "zen_floating" }));
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
    await expect(controller.pin()).resolves.toBe(true);
    fixture.resolveStart(fixture.starts[1]!);
    await flush();

    controller.observeSource(null);
    await flush();
    const state = controller.getState();
    expect(state.visible).toBe(true);
    expect(state.host).toBe("pinned");
    expect(state.source).toBeNull();
    expect(state.snapshot).toBeNull();
    expect(state.phase).toBe("no_source");
    expect(fixture.disposeCalls).toEqual(["preview-1", "preview-2"]);

    const next = source("file-b");
    controller.observeSource(next);
    await flush();
    expect(fixture.createCalls.map((call) => call.hostKind)).toEqual(["zen_floating", "zen_pinned", "zen_pinned"]);
    expect(controller.getState().host).toBe("pinned");
    expect(controller.getState().snapshot?.hostKind).toBe("zen_pinned");
    expect(controller.getState().snapshot?.source).toEqual(next.previewSource);
    expect(fixture.getBackendPreview(controller.getState().previewId!)?.hostKind).toBe("zen_pinned");
    expect(controller.getState().snapshot?.source).not.toEqual(current.previewSource);
  });

  it("bounds repeated Pin while the staged Pinned session is pending", async () => {
    const fixture = makePreviewApi();
    const workspace = new FileWorkspaceController(fixture.api);
    const controller = new PreviewExperienceController(workspace, undefined, () => true);
    const current = source("file-a");
    const trigger = document.body.appendChild(document.createElement("button"));

    controller.open(current, trigger);
    await flush();
    const firstPin = controller.pin();
    const repeatedPin = controller.pin();
    await expect(firstPin).resolves.toBe(true);
    await expect(repeatedPin).resolves.toBe(true);
    expect(fixture.createCalls.map((call) => call.hostKind)).toEqual(["zen_floating", "zen_pinned"]);
    expect(fixture.disposeCalls).toEqual(["preview-1"]);
  });

  it("moves Browse query Next across an empty intermediary page", async () => {
    const entry = (id: string): BrowseEntry => ({
      ref: { kind: "ephemeral", browseSessionId: "browse-session", entryId: id },
      name: `${id}.txt`,
      displayPath: `${id}.txt`,
      kind: "file",
      materialization: "unknown"
    });
    const page = (entries: BrowseEntry[], completion: BrowsePage["completion"], nextCursor?: string): BrowsePage => ({
      sessionId: "browse-session",
      requestId: "browse-request",
      enumerationId: "browse-enumeration",
      entries,
      completion,
      ...(nextCursor === undefined ? {} : { nextCursor })
    });
    const pages = [
      page([], "partial", "cursor-b"),
      page([entry("visible-b")], "complete")
    ];
    let calls = 0;
    const result = await scanNextBrowsePages({
      loadPage: async () => pages[calls++] ?? null,
      scanEmptyPages: true,
      isCurrent: () => true,
      isPageAcceptable: (nextPage) => nextPage.sessionId === "browse-session"
        && nextPage.enumerationId === "browse-enumeration"
    });

    expect(calls).toBe(2);
    expect(result.stale).toBe(false);
    expect(result.failed).toBe(false);
    expect(result.entries.map((item) => item.ref.entryId)).toEqual(["visible-b"]);
  });

  it("fails closed when Browse query Next loses generation during the scan", async () => {
    const firstPage = deferred<BrowsePage>();
    let current = true;
    let calls = 0;
    const scanning = scanNextBrowsePages({
      loadPage: async () => {
        calls += 1;
        return firstPage.promise;
      },
      scanEmptyPages: true,
      isCurrent: () => current
    });

    firstPage.resolve({
      sessionId: "browse-session",
      requestId: "browse-request",
      enumerationId: "browse-enumeration",
      entries: [],
      completion: "partial",
      nextCursor: "cursor-next"
    });
    current = false;
    const result = await scanning;

    expect(result.stale).toBe(true);
    expect(result.failed).toBe(false);
    expect(result.entries).toHaveLength(0);
    expect(calls).toBe(1);
  });

  it("keeps Pinned deferred source switches truthful through the existing latest-wins queue", async () => {
    const fixture = makePreviewApi({ deferSwitch: true });
    const workspace = new FileWorkspaceController(fixture.api);
    const controller = new PreviewExperienceController(workspace, undefined, () => true);
    const first = source("file-a");
    const second = source("file-b");
    const third = source("file-c");
    const fourth = source("file-d");
    const trigger = document.body.appendChild(document.createElement("button"));

    controller.open(first, trigger);
    await flush();
    await expect(controller.pin()).resolves.toBe(true);
    const pinnedPreviewId = controller.getState().previewId!;
    expect(fixture.starts).toHaveLength(2);

    controller.observeSource(second);
    await flush();
    expect(fixture.switches).toHaveLength(1);
    controller.observeSource(third);
    controller.observeSource(fourth);
    await flush();
    expect(fixture.switches).toHaveLength(1);
    expect(controller.getState().source?.previewSource).toEqual(fourth.previewSource);
    expect(workspace.getState().previews[pinnedPreviewId]?.source).toEqual(first.previewSource);

    fixture.resolveSwitch(fixture.switches[0]!);
    await flush();
    expect(fixture.switches).toHaveLength(2);
    expect(fixture.switches[1]?.source).toEqual(fourth.previewSource);
    expect(fixture.getBackendPreview(pinnedPreviewId)?.source).toEqual(second.previewSource);

    fixture.resolveSwitch(fixture.switches[1]!);
    await flush();
    expect(fixture.starts).toHaveLength(3);
    expect(fixture.getBackendPreview(pinnedPreviewId)).toEqual(expect.objectContaining({
      source: fourth.previewSource,
      hostKind: "zen_pinned"
    }));
    expect(workspace.getState().previews[pinnedPreviewId]?.source).toEqual(fourth.previewSource);

    fixture.resolveStart(fixture.starts[2]!);
    await flush();
    expect(controller.getState().host).toBe("pinned");
    expect(controller.getState().source?.previewSource).toEqual(fourth.previewSource);
    expect(controller.getState().snapshot?.source).toEqual(fourth.previewSource);
    expect(controller.getState().snapshot?.hostKind).toBe("zen_pinned");
    expect(workspace.getState().previews[pinnedPreviewId]?.source).toEqual(fourth.previewSource);
    expect(workspace.getState().previews[pinnedPreviewId]?.hostKind).toBe("zen_pinned");

    // Both the old Floating start and the slow Pinned-A start arrive late.
    fixture.resolveStart(fixture.starts[1]!);
    fixture.resolveStart(fixture.starts[0]!);
    await flush();
    expect(controller.getState().snapshot?.source).toEqual(fourth.previewSource);
    expect(workspace.getState().previews[pinnedPreviewId]?.source).toEqual(fourth.previewSource);
    expect(fixture.getBackendPreview(pinnedPreviewId)?.source).toEqual(fourth.previewSource);
    expect(fixture.cancelCalls).toEqual(["preview-1"]);
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
