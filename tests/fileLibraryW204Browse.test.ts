import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { makeTranslator } from "../src/i18n";
import { mockFileWorkspaceInvoke } from "../src/api/fileWorkspaceMockApi";
import { adaptBrowsePageCollection } from "../src/views/fileLibrary/presentation/adapters";
import {
  isActivatableLocation,
  locationAvailabilityLabel,
  locationRefSessionId,
  mergeBrowseEntries
} from "../src/views/fileLibrary/browse/browseSourceOwner";
import type { BrowseEntry, BrowsePage, LocationDescriptor } from "../src/types/fileWorkspace";

const t = makeTranslator("en");

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
    expect(owner).not.toContain("all_matching");
    expect(owner).not.toContain("displayPath.split");
    expect(mode).toContain("BrowseEntryList");
    expect(mode).toContain("data-browse-selection-authority");
    expect(list).toContain("navigateInto(entry)");
    expect(list).not.toContain("displayPath.split");
  });
});
