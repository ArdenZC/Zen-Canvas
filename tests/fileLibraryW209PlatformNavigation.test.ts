// @vitest-environment happy-dom

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceSession } from "../src/fileWorkspace";
import { makeTranslator } from "../src/i18n";
import type { LocationDescriptor } from "../src/types/fileWorkspace";
import { FileLibraryNavigation, groupBrowseLocations, locationIdentity } from "../src/views/fileLibrary/navigation/FileLibraryNavigation";
import { WorkspaceCommandBar } from "../src/views/fileLibrary/FileLibraryWorkspace";
import type { FileLibraryExperienceController, FileLibraryExperienceState } from "../src/views/fileLibrary/fileLibraryExperience";

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
});
