import { describe, expect, it, vi } from "vitest";
import {
  FileWorkspaceController,
  type FileWorkspaceApi
} from "../src/fileWorkspace";
import type { BrowsePage } from "../src/types/fileWorkspace";
import { FileLibraryExperienceController } from "../src/views/fileLibrary/fileLibraryExperienceController";

function fakeApi(overrides: Partial<FileWorkspaceApi> = {}): FileWorkspaceApi {
  const browseResponse = {
    sessionId: "browse-session",
    location: {
      ref: {
        kind: "ephemeral" as const,
        browseSessionId: "browse-session",
        locationId: "location"
      },
      displayName: "Documents",
      kind: "unknown" as const,
      availability: "unknown" as const,
      freshness: "not_applicable" as const,
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
  };
  const emptyPage = async (): Promise<BrowsePage> => ({
    sessionId: "browse-session",
    requestId: "request",
    enumerationId: "enumeration",
    entries: [],
    completion: "complete"
  });

  return {
    browseOpen: async () => browseResponse,
    browseRestore: async () => browseResponse,
    browseStartEnumeration: emptyPage,
    browseNextPage: emptyPage,
    browseCancel: async () => undefined,
    browseReleasePage: async () => undefined,
    browseReleasePath: async () => undefined,
    browseRetainPath: async () => undefined,
    browseDispose: async () => undefined,
    locationList: async () => [],
    changeStart: async () => ({
      monitorId: "monitor",
      sessionId: "browse-session",
      pathRef: { id: "root" }
    }),
    changePending: async () => null,
    changeRefresh: emptyPage,
    changeDispose: async () => undefined,
    readEligibility: async ({ source }) => ({ source, eligibility: "eligible" }),
    thumbnailRequest: async () => ({ cacheKey: "mock", bytes: new Uint8Array() }),
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

describe("W2-01 File Library experience controller", () => {
  it("seeds one neutral migration target without pretending to know Query V2 semantics", async () => {
    const controller = new FileLibraryExperienceController(
      new FileWorkspaceController(fakeApi())
    );

    const state = controller.getSnapshot();
    expect(state.mode).toBe("library");
    expect(state.activeTarget).toEqual({
      kind: "library",
      source: "custom",
      key: "legacy_library"
    });
    expect(state.workspace.session.history).toHaveLength(1);
    expect(state.workspace.session.presentation.viewMode).toBe("list");
    expect(state.canGoBack).toBe(false);
    expect(state.canGoForward).toBe(false);

    await controller.dispose();
  });

  it("projects first-entry Browse without fabricating a location target or history entry", async () => {
    const controller = new FileLibraryExperienceController(
      new FileWorkspaceController(fakeApi())
    );
    const initialHistory = controller.getSnapshot().workspace.session.history;

    expect(controller.switchMode("browse")).toBe(true);
    const browse = controller.getSnapshot();
    expect(browse.mode).toBe("browse");
    expect(browse.isDetachedMode).toBe(true);
    expect(browse.activeTarget).toBeNull();
    expect(browse.hasBrowseTarget).toBe(false);
    expect(browse.workspace.session.history).toEqual(initialHistory);
    expect(browse.canGoBack).toBe(false);
    expect(browse.canGoForward).toBe(false);

    expect(controller.switchMode("library")).toBe(true);
    const library = controller.getSnapshot();
    expect(library.mode).toBe("library");
    expect(library.isDetachedMode).toBe(false);
    expect(library.activeTarget?.kind).toBe("library");
    expect(library.workspace.session.history).toEqual(initialHistory);

    await controller.dispose();
  });

  it("returns to a live Browse target through FileWorkspaceController with preserved presentation", async () => {
    const browseRestore = vi.fn(async () => { throw new Error("live mode return must not restore"); });
    const workspace = new FileWorkspaceController(fakeApi({ browseRestore }));
    const controller = new FileLibraryExperienceController(workspace);

    await workspace.openBrowse({
      platform: "windows",
      routingHint: "C:/Documents",
      displayHint: "Documents"
    });
    expect(controller.getSnapshot().mode).toBe("browse");

    workspace.session.setPresentation({
      viewMode: "grid",
      scrollAnchor: "browse-anchor"
    });
    expect(controller.switchMode("library")).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(controller.getSnapshot().mode).toBe("library");

    workspace.session.setPresentation({
      viewMode: "list",
      scrollAnchor: "library-anchor"
    });
    expect(controller.switchMode("browse")).toBe(true);

    const returned = controller.getSnapshot();
    expect(returned.mode).toBe("browse");
    expect(returned.activeTarget?.kind).toBe("browse");
    expect(returned.workspace.session.presentation).toEqual({
      viewMode: "grid",
      scrollAnchor: "browse-anchor"
    });
    expect(returned.workspace.browse?.location.displayName).toBe("Documents");
    expect(browseRestore).not.toHaveBeenCalled();

    await controller.dispose();
  });

  it("keeps Back/Forward owned by WorkspaceSession after a mode return", async () => {
    const browseRestore = vi.fn(async () => { throw new Error("live history must not restore"); });
    const workspace = new FileWorkspaceController(fakeApi({ browseRestore }));
    const controller = new FileLibraryExperienceController(workspace);

    await workspace.openBrowse({ platform: "windows", routingHint: "C:/Documents" });
    expect(controller.switchMode("library")).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(controller.switchMode("browse")).toBe(true);

    const browseIndex = controller.getSnapshot().workspace.session.historyIndex;
    expect(await controller.goBack()).toBe(true);
    expect(controller.getSnapshot().mode).toBe("library");
    expect(controller.getSnapshot().workspace.session.historyIndex).toBe(browseIndex - 1);

    expect(await controller.goForward()).toBe(true);
    expect(controller.getSnapshot().mode).toBe("browse");
    expect(controller.getSnapshot().workspace.session.historyIndex).toBe(browseIndex);
    expect(browseRestore).not.toHaveBeenCalled();

    await controller.dispose();
  });
});
