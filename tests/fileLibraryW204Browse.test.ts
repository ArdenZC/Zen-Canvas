// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FileWorkspaceApi } from "../src/api/fileWorkspaceApi";
import { FileWorkspaceController, WorkspaceSession } from "../src/fileWorkspace";
import { makeTranslator } from "../src/i18n";
import { mockFileWorkspaceInvoke } from "../src/api/fileWorkspaceMockApi";
import { FileLibraryExperienceProvider, useFileLibraryExperience } from "../src/views/fileLibrary/FileLibraryExperienceProvider";
import {
  FileLibraryExperienceController,
  LEGACY_LIBRARY_MIGRATION_TARGET
} from "../src/views/fileLibrary/fileLibraryExperience";
import { adaptBrowsePageCollection } from "../src/views/fileLibrary/presentation/adapters";
import {
  appendBrowseBreadcrumb,
  browseBreadcrumbChainForPath,
  browseBreadcrumbKey,
  browseEnumerationStateForPage,
  createBrowseBreadcrumb,
  isActivatableLocation,
  locationAvailabilityLabel,
  locationRefSessionId,
  mergeBrowseEntries,
  useBrowseSourceOwner,
  type BrowseSourceOwner
} from "../src/views/fileLibrary/browse/browseSourceOwner";
import type { BrowseEntry, BrowseOpenResponse, BrowsePage, LocationDescriptor } from "../src/types/fileWorkspace";

const t = makeTranslator("en");

let mountedRoot: Root | null = null;
let mountedContainer: HTMLDivElement | null = null;

function browseResponse(sessionId: string, canWatch: boolean): BrowseOpenResponse {
  return {
    sessionId,
    location: {
      ref: { kind: "ephemeral", browseSessionId: sessionId, locationId: `location-${sessionId}` },
      displayName: "Fixture root",
      kind: "local",
      availability: "available",
      freshness: "current",
      capabilities: {
        canBrowse: true,
        canReadMetadata: true,
        canPreview: false,
        canWatch,
        canRequestMaterialization: false,
        canAddToLibrary: false
      }
    },
    rootPathRef: { id: `root-${sessionId}` }
  };
}

function pageFor(sessionId: string, requestId: string, marker: string): BrowsePage {
  return {
    sessionId,
    requestId,
    enumerationId: `enumeration-${marker}`,
    entries: [{
      ref: { kind: "ephemeral", browseSessionId: sessionId, entryId: `entry-${marker}` },
      name: marker,
      displayPath: marker,
      kind: "file",
      materialization: "unknown"
    }],
    completion: "complete",
    knownCount: 1
  };
}

function sourceOwnerApi(options: {
  canWatch?: boolean;
  responses?: BrowseOpenResponse[];
  changePending?: FileWorkspaceApi["changePending"];
  changeRefresh?: FileWorkspaceApi["changeRefresh"];
} = {}) {
  const canWatch = options.canWatch ?? true;
  const responses = options.responses ?? [browseResponse("session-1", canWatch)];
  let responseIndex = 0;
  const browseOpen = vi.fn(async () => responses[Math.min(responseIndex++, responses.length - 1)]!);
  const browseStartEnumeration = vi.fn(async ({ sessionId, requestId }: Parameters<FileWorkspaceApi["browseStartEnumeration"]>[0]) =>
    pageFor(sessionId, requestId, `start-${sessionId}-${browseStartEnumeration.mock.calls.length}`));
  const monitorSessions = new Map<string, string>();
  const changeStart = vi.fn(async ({ sessionId, pathRef }: Parameters<FileWorkspaceApi["changeStart"]>[0]) => {
    const monitorId = `monitor-${sessionId}-${pathRef.id}`;
    monitorSessions.set(monitorId, sessionId);
    return { monitorId, sessionId, pathRef };
  });
  const changePending = options.changePending ?? vi.fn(async () => null);
  const changeRefresh = options.changeRefresh ?? vi.fn(async ({ monitorId }: Parameters<FileWorkspaceApi["changeRefresh"]>[0]) => {
    const sessionId = monitorSessions.get(monitorId) ?? "session-1";
    return pageFor(sessionId, `refresh-${monitorId}`, `change-${monitorId}`);
  });
  const api: FileWorkspaceApi = {
    browseOpen,
    browseRestore: async () => { throw new Error("restore not used"); },
    locationBrowse: async () => { throw new Error("location browse not used"); },
    browseStartEnumeration,
    browseNextPage: async ({ sessionId, cursor }) => pageFor(sessionId, cursor, `next-${cursor}`),
    browseCancel: async () => undefined,
    browseReleasePage: async () => undefined,
    browseReleasePath: async () => undefined,
    browseRetainPath: async () => undefined,
    browseDispose: async () => undefined,
    locationList: async () => [],
    changeStart,
    changePending,
    changeRefresh,
    changeDispose: async () => undefined,
    readEligibility: async ({ source }) => ({ source, eligibility: "eligible" }),
    thumbnailRequest: async () => ({ cacheKey: "fixture", bytes: new Uint8Array() }),
    thumbnailCancel: async () => true,
    previewCreate: async () => { throw new Error("preview not used"); },
    previewSnapshot: async () => { throw new Error("preview not used"); },
    previewStart: async () => { throw new Error("preview not used"); },
    previewCancel: async () => true,
    previewDispose: async () => true,
    previewSwitchSource: async () => { throw new Error("preview not used"); }
  };
  return { api, browseOpen, browseStartEnumeration, changeStart, changePending, changeRefresh };
}

async function settleSourceOwner() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 0));
    await Promise.resolve();
  });
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function mountSourceOwner(api: FileWorkspaceApi) {
  const workspace = new FileWorkspaceController(
    api,
    new WorkspaceSession({ initialTarget: LEGACY_LIBRARY_MIGRATION_TARGET })
  );
  const experience = new FileLibraryExperienceController(workspace);
  let latestSource: BrowseSourceOwner | null = null;
  function Probe() {
    const { controller, state } = useFileLibraryExperience();
    const source = useBrowseSourceOwner({ controller, state, t });
    latestSource = source;
    return createElement("output", { "data-w204-change-state": source.changeState });
  }
  mountedContainer = document.createElement("div");
  document.body.appendChild(mountedContainer);
  mountedRoot = createRoot(mountedContainer);
  await act(async () => {
    mountedRoot!.render(createElement(
      FileLibraryExperienceProvider,
      { active: true, controller: experience, children: createElement(Probe) }
    ));
  });
  await settleSourceOwner();
  return {
    experience,
    source: () => {
      if (latestSource === null) throw new Error("Browse source owner has not rendered");
      return latestSource;
    }
  };
}

afterEach(async () => {
  if (mountedRoot !== null) {
    const root = mountedRoot;
    mountedRoot = null;
    await act(async () => {
      root.unmount();
      await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 0));
    });
  }
  mountedContainer?.remove();
  mountedContainer = null;
  document.body.innerHTML = "";
});

function browseEntry(overrides: Partial<BrowseEntry> = {}): BrowseEntry {
  return {
    ref: { kind: "ephemeral", browseSessionId: "session-1", entryId: "entry-1" },
    pathRef: { id: "path-1" },
    name: "Folder",
    displayPath: "Folder",
    kind: "directory",
    materialization: "unknown",
    ...overrides
  };
}

function location(availability: LocationDescriptor["availability"], canBrowse: boolean): LocationDescriptor {
  return {
    ref: { kind: "managed", scanRootId: `root-${availability}` },
    displayName: "Location",
    kind: "local",
    availability,
    freshness: "current",
    capabilities: {
      canBrowse,
      canReadMetadata: false,
      canPreview: false,
      canWatch: false,
      canRequestMaterialization: false,
      canAddToLibrary: false
    }
  };
}

describe("W2-04 Browse source owner contracts", () => {
  it("deduplicates within the live session and preserves opaque directory refs", () => {
    const first = browseEntry();
    const duplicate = browseEntry({ name: "Updated display name" });
    const merged = mergeBrowseEntries([], [first, duplicate]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.displayName).toBe("Folder");
    expect(merged[0]?.entryRef).toEqual(first.ref);
    expect(merged[0]?.pathRef).toEqual(first.pathRef);
    expect(locationRefSessionId({ kind: "ephemeral", browseSessionId: "session-1", locationId: "location-1" })).toBe("session-1");
    expect(locationRefSessionId({ kind: "managed", scanRootId: "root-1" })).toBeNull();
  });

  it("publishes exact collection count only for complete Browse truth", () => {
    const partial: BrowsePage = {
      sessionId: "session-1",
      requestId: "request-1",
      enumerationId: "enumeration-1",
      entries: [browseEntry()],
      nextCursor: "cursor-1",
      completion: "partial"
    };
    const complete: BrowsePage = {
      ...partial,
      requestId: "request-2",
      enumerationId: "enumeration-2",
      nextCursor: undefined,
      completion: "complete",
      knownCount: 1
    };

    expect(adaptBrowsePageCollection(partial).provenance).toEqual({
      sessionId: "session-1",
      requestId: "request-1",
      enumerationId: "enumeration-1",
      completion: "partial"
    });
    expect(adaptBrowsePageCollection(complete).provenance.knownCount).toBe(1);
    expect(browseEnumerationStateForPage({ completion: "partial" })).toBe("partial");
    expect(browseEnumerationStateForPage({ completion: "complete" })).toBe("complete");
  });

  it("projects breadcrumb ancestry by path identity, including branch navigation", () => {
    const sessionId = "session-1";
    const root = createBrowseBreadcrumb(sessionId, { id: "root" }, "Root");
    const a = createBrowseBreadcrumb(sessionId, { id: "a" }, "A");
    const b = createBrowseBreadcrumb(sessionId, { id: "b" }, "B");
    const c = createBrowseBreadcrumb(sessionId, { id: "c" }, "C");
    const chains = new Map<string, readonly ReturnType<typeof createBrowseBreadcrumb>[]>();
    chains.set(browseBreadcrumbKey(sessionId, root.pathRef), [root]);
    chains.set(browseBreadcrumbKey(sessionId, a.pathRef), appendBrowseBreadcrumb([root], a));
    chains.set(browseBreadcrumbKey(sessionId, b.pathRef), appendBrowseBreadcrumb([root, a], b));

    const branchFromA = appendBrowseBreadcrumb(
      browseBreadcrumbChainForPath(chains, sessionId, a.pathRef)!,
      c
    );
    chains.set(browseBreadcrumbKey(sessionId, c.pathRef), branchFromA);

    expect(browseBreadcrumbChainForPath(chains, sessionId, b.pathRef)?.map((item) => item.label)).toEqual([
      "Root", "A", "B"
    ]);
    expect(browseBreadcrumbChainForPath(chains, sessionId, a.pathRef)?.map((item) => item.label)).toEqual([
      "Root", "A"
    ]);
    expect(browseBreadcrumbChainForPath(chains, sessionId, c.pathRef)?.map((item) => item.label)).toEqual([
      "Root", "A", "C"
    ]);
    expect(browseBreadcrumbChainForPath(chains, "session-2", a.pathRef)).toBeNull();
    expect(browseBreadcrumbChainForPath(chains, sessionId, { id: "stale" })).toBeNull();
  });

  it("starts no monitor for a non-watchable target and falls back to ordinary enumeration without polling", async () => {
    const fixture = sourceOwnerApi({ canWatch: false });
    const mounted = await mountSourceOwner(fixture.api);
    await act(async () => {
      await mounted.experience.openBrowse({ platform: "windows", routingHint: "fixture" });
    });
    await settleSourceOwner();

    expect(fixture.changeStart).not.toHaveBeenCalled();
    expect(fixture.changePending).not.toHaveBeenCalled();
    expect(mounted.source().changeState).toBe("unavailable");

    await act(async () => {
      await mounted.source().refreshEnumeration();
    });
    expect(fixture.changePending).not.toHaveBeenCalled();
    expect(fixture.browseStartEnumeration).toHaveBeenCalledTimes(2);
  });

  it("checks an active monitor once and refreshes through the existing change seam when a hint exists", async () => {
    const pending = vi.fn(async () => ({
      monitorId: "monitor-session-1-root-session-1",
      sequence: 1,
      hint: { kind: "content_changed" as const }
    }));
    const fixture = sourceOwnerApi({ changePending: pending });
    const mounted = await mountSourceOwner(fixture.api);
    await act(async () => {
      await mounted.experience.openBrowse({ platform: "windows", routingHint: "fixture" });
    });
    await settleSourceOwner();

    expect(fixture.changeStart).toHaveBeenCalledTimes(1);
    expect(fixture.changePending).not.toHaveBeenCalled();
    const initialEnumerations = fixture.browseStartEnumeration.mock.calls.length;

    await act(async () => {
      await mounted.source().refreshEnumeration();
    });
    await settleSourceOwner();

    expect(fixture.changePending).toHaveBeenCalledTimes(1);
    expect(fixture.changeRefresh).toHaveBeenCalledTimes(1);
    expect(fixture.browseStartEnumeration).toHaveBeenCalledTimes(initialEnumerations);
    expect(mounted.source().changeState).toBe("watching");
    expect(mounted.source().completion).toBe("complete");
  });

  it("uses ordinary enumeration when a watch monitor reports no hint", async () => {
    const fixture = sourceOwnerApi({
      changePending: vi.fn(async () => null),
    });
    const mounted = await mountSourceOwner(fixture.api);
    await act(async () => {
      await mounted.experience.openBrowse({ platform: "windows", routingHint: "fixture-a" });
    });
    await settleSourceOwner();
    expect(fixture.changeStart).toHaveBeenCalledTimes(1);

    await act(async () => {
      await mounted.source().refreshEnumeration();
    });
    await settleSourceOwner();
    expect(fixture.changePending).toHaveBeenCalledTimes(1);
    expect(fixture.changeRefresh).not.toHaveBeenCalled();
    expect(fixture.browseStartEnumeration).toHaveBeenCalledTimes(2);
    expect(mounted.source().changeState).toBe("watching");
  });

  it("ignores a stale change refresh after the Browse target switches", async () => {
    const refresh = deferred<BrowsePage>();
    const responses = [browseResponse("session-1", true), browseResponse("session-2", true)];
    const pending = vi.fn(async () => ({
      monitorId: "monitor-session-1-root-session-1",
      sequence: 2,
      hint: { kind: "uncertain" as const }
    }));
    const fixture = sourceOwnerApi({
      responses,
      changePending: pending,
      changeRefresh: vi.fn(async () => refresh.promise)
    });
    const mounted = await mountSourceOwner(fixture.api);
    await act(async () => {
      await mounted.experience.openBrowse({ platform: "windows", routingHint: "fixture-a" });
    });
    await settleSourceOwner();

    let refreshPromise!: Promise<void>;
    await act(async () => {
      refreshPromise = mounted.source().refreshEnumeration();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fixture.changePending).toHaveBeenCalledTimes(1);
    expect(fixture.changeRefresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      await mounted.experience.openBrowse({ platform: "windows", routingHint: "fixture-b" });
    });
    await settleSourceOwner();
    expect(fixture.changeStart).toHaveBeenCalledTimes(2);

    refresh.resolve(pageFor("session-1", "late-refresh", "late-old-session"));
    await act(async () => {
      await refreshPromise;
    });
    await settleSourceOwner();

    expect(mounted.source().sessionId).toBe("session-2");
    expect(mounted.source().entries.some((entry) => entry.displayName === "late-old-session")).toBe(false);
  });

  it("fails closed for unavailable location descriptors", () => {
    expect(isActivatableLocation(location("available", true))).toBe(true);
    for (const availability of ["offline", "disconnected", "permission_denied", "authentication_required", "not_found", "unknown"] as const) {
      expect(isActivatableLocation(location(availability, true))).toBe(false);
      expect(locationAvailabilityLabel(availability, t)).not.toBe("");
    }
    expect(isActivatableLocation(location("available", false))).toBe(false);
  });

  it("keeps the browser mock location surface split between openable and unavailable entries", async () => {
    const locations = await mockFileWorkspaceInvoke<LocationDescriptor[]>("file_workspace_location_list");
    expect(locations[0]).toMatchObject({ availability: "available", capabilities: { canBrowse: true } });
    expect(locations.some((entry) => entry.availability === "offline" && !entry.capabilities.canBrowse)).toBe(true);
  });

  it("keeps Browse presentation source-local and path-ref based", () => {
    const owner = readFileSync(resolve("src/views/fileLibrary/browse/browseSourceOwner.ts"), "utf8");
    const mode = readFileSync(resolve("src/views/fileLibrary/browse/BrowseMode.tsx"), "utf8");
    const list = readFileSync(resolve("src/views/fileLibrary/browse/BrowseEntryList.tsx"), "utf8");

    expect(owner).toContain("adaptBrowseEntry");
    expect(owner).toContain("pathRef");
    expect(owner).toContain("page.completion");
    expect(owner).not.toContain("state.workspace.session.history");
    expect(owner).not.toContain('page.nextCursor === undefined ? "complete"');
    expect(owner).not.toContain("all_matching");
    expect(owner).not.toContain("displayPath.split");
    expect(mode).toContain("BrowseEntryList");
    expect(mode).toContain("data-browse-selection-authority");
    expect(list).toContain("navigateInto(entry)");
    expect(list).not.toContain("displayPath.split");
  });
});
