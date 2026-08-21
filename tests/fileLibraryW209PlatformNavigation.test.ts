// @vitest-environment happy-dom

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceSession } from "../src/fileWorkspace";
import { makeTranslator } from "../src/i18n";
import type { LocationDescriptor, NavigationTarget } from "../src/types/fileWorkspace";
import type { FileQuerySpecV2, LibrarySavedView, UserTag } from "../src/types/domain";
import { FileLibraryNavigation, groupBrowseLocations, locationIdentity } from "../src/views/fileLibrary/navigation/FileLibraryNavigation";
import { WorkspaceCommandBar } from "../src/views/fileLibrary/FileLibraryWorkspace";
import type { FileLibraryExperienceController, FileLibraryExperienceState } from "../src/views/fileLibrary/fileLibraryExperience";
import {
  applyLibraryNavigationTarget,
  createLibraryNavigationSurface
} from "../src/views/fileLibrary/library/libraryNavigationSurface";
import type { LibrarySourceOwner } from "../src/views/fileLibrary/library/librarySourceOwner";

const t = makeTranslator("en");

function location(overrides: Partial<LocationDescriptor> = {}): LocationDescriptor {
  return {
    ref: { kind: "managed", scanRootId: "root-1" },
    displayName: "Managed root",
    kind: "local",
    availability: "available",
    freshness: "current",
    capabilities: {
      canBrowse: true,
      canReadMetadata: false,
      canPreview: false,
      canWatch: false,
      canRequestMaterialization: false,
      canAddToLibrary: false
    },
    ...overrides
  };
}

function experienceState(locations: LocationDescriptor[]): FileLibraryExperienceState {
  const session = new WorkspaceSession({ initialTarget: { kind: "library", source: "custom", key: "w2-09" } });
  return {
    mode: "library",
    detachedBrowse: false,
    workspace: {
      session: session.getState(),
      suspended: false,
      browse: null,
      page: null,
      change: null,
      pendingChange: null,
      locations,
      lastEligibility: null,
      previews: {}
    }
  };
}

function query(overrides: Partial<FileQuerySpecV2> = {}): FileQuerySpecV2 {
  return {
    scope: { kind: "all_enabled_roots" },
    text: null,
    filters: {
      fileTypes: [],
      purposes: [],
      lifecycles: [],
      risks: [],
      sizeMin: null,
      sizeMax: null,
      modifiedFrom: null,
      modifiedTo: null,
      createdFrom: null,
      createdTo: null,
      duplicate: "any",
      review: "any",
      tagsAllOf: [],
      tagsAnyOf: [],
      tagsNoneOf: []
    },
    sort: { kind: "modified", direction: "desc" },
    ...overrides
  };
}

function librarySource(overrides: Partial<LibrarySourceOwner> = {}) {
  return {
    scope: { kind: "all" },
    querySpec: query(),
    activeViewId: null,
    savedViews: [] as LibrarySavedView[],
    tags: [] as UserTag[],
    setScope: vi.fn(),
    clearFilters: vi.fn(),
    handleLibrarySearchChange: vi.fn(),
    updateFilters: vi.fn(),
    applySavedView: vi.fn(),
    ...overrides
  } as unknown as LibrarySourceOwner;
}

describe("W2-09 platform navigation and managed/unmanaged contracts", () => {
  it("groups only by explicit LocationDescriptor kind and preserves backend order", () => {
    const external = location({
      ref: { kind: "ephemeral", browseSessionId: "session", locationId: "external" },
      displayName: "External",
      kind: "external"
    });
    const local = location({ displayName: "Local" });
    const groups = groupBrowseLocations([external, local]);

    expect(groups.map((group) => group.kind)).toEqual(["local", "external"]);
    expect(groups[0]?.locations[0]?.displayName).toBe("Local");
    expect(groups[1]?.locations[0]?.displayName).toBe("External");
    expect(locationIdentity(external)).toBe("ephemeral:session:external");
  });

  it("uses opaque LocationRef actions and shows managed/browse-only status without an admission button", () => {
    const browseLocation = location({
      ref: { kind: "ephemeral", browseSessionId: "session", locationId: "external" },
      displayName: "External drive",
      kind: "external"
    });
    const controller = {
      workspace: { loadLocations: vi.fn(async () => [browseLocation]) },
      navigate: vi.fn(),
      browseLocation: vi.fn(async () => null)
    } as unknown as FileLibraryExperienceController;
    const html = renderToStaticMarkup(createElement(FileLibraryNavigation, {
      controller,
      state: experienceState([browseLocation]),
      layout: "large",
      t,
      onClose: vi.fn()
    }));

    expect(html).toContain("Browse only");
    expect(html).not.toContain("Add to Library");
    expect(html).toContain('data-file-library-location-managed="false"');
  });

  it("keeps the command-bar navigation control accessible and avoids the old drawer authority", () => {
    const html = renderToStaticMarkup(createElement(WorkspaceCommandBar, {
      mode: "library",
      targetLabel: t("fileLibrary"),
      canGoBack: false,
      canGoForward: false,
      onBack: vi.fn(),
      onForward: vi.fn(),
      onModeChange: vi.fn(),
      navigationOpen: false,
      onNavigationToggle: vi.fn(),
      t
    }));

    expect(html).toContain('data-file-library-nav-toggle="true"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("data-navigation-drawer-layer");
    expect(html).not.toContain("file-library-navigation-trigger");
  });

  it("binds semantic navigation entries to Query V2 operations and omits fake Recent", () => {
    const savedView: LibrarySavedView = {
      id: "saved-1",
      displayName: "Work files",
      query: query({ text: "work" }),
      queryFingerprint: "fingerprint",
      position: 0,
      createdAt: 1,
      updatedAt: 1,
      revision: 1,
      invalidReferences: []
    };
    const tag: UserTag = { id: "tag-1", displayName: "Important", colorToken: "blue", usageCount: 2, createdAt: 1, updatedAt: 1, revision: 1 };
    const source = librarySource({ savedViews: [savedView], tags: [tag] });
    const controller = { navigate: vi.fn() } as unknown as FileLibraryExperienceController;
    const surface = createLibraryNavigationSurface({
      source,
      controller,
      currentTarget: { kind: "library", source: "custom", key: "all" },
      t
    });

    expect(surface.all.target).toEqual({ kind: "library", source: "custom", key: "all" });
    expect(surface.types.map((entry) => entry.id)).toContain("type:Image");
    expect(surface.savedViews[0]?.target).toEqual({ kind: "library", source: "custom", key: "saved:saved-1" });
    expect(surface.tags[0]?.target).toEqual({ kind: "library", source: "custom", key: "tag:tag-1" });
    expect(surface.types.some((entry) => entry.id === "recent")).toBe(false);

    surface.types.find((entry) => entry.id === "type:Image")?.activate();
    expect(source.updateFilters).toHaveBeenCalledWith({ fileTypes: ["Image"] });
    expect(controller.navigate).toHaveBeenCalledWith({ kind: "library", source: "custom", key: "type:Image" });
  });

  it("derives active state from the Query V2 facet as well as the navigation target", () => {
    const source = librarySource({ querySpec: query({ filters: { ...query().filters, fileTypes: ["Image"] } }) });
    const surface = createLibraryNavigationSurface({
      source,
      controller: { navigate: vi.fn() } as unknown as FileLibraryExperienceController,
      currentTarget: { kind: "library", source: "custom", key: "type:Image" },
      t
    });

    expect(surface.types.find((entry) => entry.id === "type:Image")?.active).toBe(true);
    expect(surface.types.find((entry) => entry.id === "type:Document")?.active).toBe(false);

    const changedSource = librarySource({ querySpec: query() });
    expect(applyLibraryNavigationTarget(
      { kind: "library", source: "custom", key: "type:Image" },
      changedSource
    )).toBe(true);
    expect(changedSource.updateFilters).toHaveBeenCalledWith({ fileTypes: ["Image"] });
  });
});
