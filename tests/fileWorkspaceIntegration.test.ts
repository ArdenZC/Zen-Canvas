import { describe, expect, it, vi } from "vitest";
import {
  FileWorkspaceController,
  type FileWorkspaceApi,
  type FileWorkspaceControllerState
} from "../src/fileWorkspace";
import { mockFileWorkspaceInvoke } from "../src/api/fileWorkspaceMockApi";
import type { BrowsePage } from "../src/types/fileWorkspace";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function fakeApi(overrides: Partial<FileWorkspaceApi> = {}): FileWorkspaceApi {
  const emptyPage = async (): Promise<BrowsePage> => ({
    sessionId: "session",
    requestId: "request",
    enumerationId: "enumeration",
    entries: [],
    completion: "complete"
  });
  return {
    browseOpen: async () => ({
      sessionId: "session",
      location: {
        ref: { kind: "ephemeral", browseSessionId: "session", locationId: "location" },
        displayName: "Browse",
        kind: "unknown",
        availability: "unknown",
        freshness: "not_applicable",
        capabilities: {
          canBrowse: false,
          canReadMetadata: false,
          canPreview: false,
          canWatch: false,
          canRequestMaterialization: false,
          canAddToLibrary: false
        }
      },
      rootPathRef: { id: "root" }
    }),
    browseRestore: async () => { throw new Error("unused"); },
    browseStartEnumeration: emptyPage,
    browseNextPage: emptyPage,
    browseCancel: async () => undefined,
    browseReleasePage: async () => undefined,
    browseReleasePath: async () => undefined,
    browseDispose: async () => undefined,
    locationList: async () => [],
    changeStart: async () => ({ monitorId: "monitor", sessionId: "session", pathRef: { id: "root" } }),
    changePending: async () => null,
    changeRefresh: emptyPage,
    changeDispose: async () => undefined,
    readEligibility: async ({ source }) => ({ source, eligibility: "eligible" }),
    thumbnailRequest: async () => ({ cacheKey: "mock", bytes: [] }),
    thumbnailCancel: async () => true,
    previewCreate: async () => { throw new Error("unused"); },
    previewSnapshot: async () => { throw new Error("unused"); },
    previewStart: async () => { throw new Error("unused"); },
    previewCancel: async () => true,
    previewDispose: async () => true,
    previewSwitchSource: async () => { throw new Error("unused"); },
    ...overrides
  };
}

describe("W1-10 File Workspace integration", () => {
  it("rejects a late Browse admission after WorkspaceSession navigation", async () => {
    const admission = deferred<Awaited<ReturnType<FileWorkspaceApi["browseOpen"]>>>();
    const dispose = vi.fn(async () => undefined);
    const controller = new FileWorkspaceController(fakeApi({
      browseOpen: () => admission.promise,
      browseDispose: dispose
    }));
    const result = controller.openBrowse({
      platform: "windows",
      routingHint: "C:/Documents"
    });

    controller.navigate({ kind: "library", source: "search", key: "latest" });
    admission.resolve((await fakeApi().browseOpen({ platform: "windows", routingHint: "C:/Documents" })));

    await expect(result).resolves.toBeNull();
    expect(dispose).toHaveBeenCalledWith({ sessionId: "session" });
    expect(controller.getState().session.currentTarget?.kind).toBe("library");
  });

  it("cancels a late Thumbnail publication after navigation", async () => {
    const thumbnail = deferred<{ cacheKey: string; bytes: number[] }>();
    const cancel = vi.fn(async () => true);
    const controller = new FileWorkspaceController(fakeApi({
      thumbnailRequest: () => thumbnail.promise,
      thumbnailCancel: cancel
    }));
    const request = controller.requestThumbnail({
      requestId: "thumbnail-1",
      source: { kind: "managed", fileId: "file-1" },
      variant: "small",
      workClass: "interactive"
    });

    controller.navigate({ kind: "library", source: "search", key: "latest" });
    thumbnail.resolve({ cacheKey: "logical-key", bytes: [1, 2] });

    await expect(request).resolves.toBeNull();
    expect(cancel).toHaveBeenCalledWith({ requestId: "thumbnail-1" });
  });

  it("keeps Browse pages in controller state without a Query V2 store", async () => {
    const states: FileWorkspaceControllerState[] = [];
    const page: BrowsePage = {
      sessionId: "session",
      requestId: "request",
      enumerationId: "enumeration",
      entries: [],
      completion: "complete"
    };
    const controller = new FileWorkspaceController(fakeApi({
      browseStartEnumeration: async () => page
    }));
    controller.subscribe((state) => states.push(state));
    await controller.openBrowse({ platform: "windows", routingHint: "C:/Documents" });
    await controller.startEnumeration();

    expect(controller.getState().page).toEqual(page);
    expect(states.at(-1)?.page).toEqual(page);
  });
});

describe("File Workspace browser mock", () => {
  it("re-resolves restore routing into fresh opaque refs and rejects stale cursors", async () => {
    const first = await mockFileWorkspaceInvoke<Awaited<ReturnType<FileWorkspaceApi["browseOpen"]>>>(
      "file_workspace_browse_open",
      { request: { platform: "windows", routingHint: "C:/Documents" } }
    );
    const firstPage = await mockFileWorkspaceInvoke<BrowsePage>(
      "file_workspace_browse_start_enumeration",
      { request: { sessionId: first.sessionId, requestId: "r1", pathRef: first.rootPathRef, pageSize: 1 } }
    );
    const second = await mockFileWorkspaceInvoke<Awaited<ReturnType<FileWorkspaceApi["browseOpen"]>>>(
      "file_workspace_browse_restore",
      {
        request: {
          locator: {
            kind: "browse",
            platform: "windows",
            routingHint: "C:/Documents"
          }
        }
      }
    );

    expect(second.sessionId).not.toBe(first.sessionId);
    expect(JSON.stringify(second)).not.toContain("C:/Documents");
    await mockFileWorkspaceInvoke(
      "file_workspace_browse_start_enumeration",
      { request: { sessionId: first.sessionId, requestId: "r2", pathRef: first.rootPathRef, pageSize: 1 } }
    );
    await expect(mockFileWorkspaceInvoke(
      "file_workspace_browse_next_page",
      { request: { sessionId: first.sessionId, cursor: firstPage.nextCursor, pageSize: 1 } }
    )).rejects.toThrow("browse_cursor_invalid");

    await mockFileWorkspaceInvoke("file_workspace_browse_dispose", { request: { sessionId: first.sessionId } });
    await mockFileWorkspaceInvoke("file_workspace_browse_dispose", { request: { sessionId: second.sessionId } });
  });

  it("exposes only metadata fallback for Preview and explicitly rejects Thumbnail", async () => {
    const source = { kind: "managed" as const, fileId: "file-1" };
    const preview = await mockFileWorkspaceInvoke<Awaited<ReturnType<FileWorkspaceApi["previewCreate"]>>>(
      "file_workspace_preview_create",
      { request: { requestId: "preview-1", source, hostKind: "zen_floating" } }
    );
    const started = await mockFileWorkspaceInvoke<Awaited<ReturnType<FileWorkspaceApi["previewStart"]>>>(
      "file_workspace_preview_start",
      { request: { previewId: preview.previewId } }
    );

    expect(started.state).toBe("ready");
    expect(started.representation?.representation.family).toBe("metadata");
    await expect(mockFileWorkspaceInvoke(
      "file_workspace_thumbnail_request",
      {
        request: {
          requestId: "thumb-1",
          source,
          variant: "small",
          workClass: "interactive"
        }
      }
    )).rejects.toThrow("thumbnail_renderer_unsupported_browser_mock");

    await mockFileWorkspaceInvoke("file_workspace_preview_dispose", { request: { previewId: preview.previewId } });
  });
});
