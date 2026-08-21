import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  WorkspaceSession,
  isWorkspacePresentationState
} from "../src/fileWorkspace";
import type { NavigationTarget } from "../src/types/fileWorkspace";
import { nextGridIndex, thumbnailVariantForCell } from "../src/views/fileLibrary/list/SharedFileGrid";

const libraryTarget: NavigationTarget = { kind: "library", source: "custom", key: "all" };
const browseTarget: NavigationTarget = {
  kind: "browse",
  location: { kind: "ephemeral", browseSessionId: "browse-session", locationId: "location" },
  pathRef: { id: "root" }
};

describe("W2-06 shared Grid contracts", () => {
  it("maps cell geometry to the bounded backend variants", () => {
    expect(thumbnailVariantForCell(96, 1)).toBe("small");
    expect(thumbnailVariantForCell(144, 1)).toBe("medium");
    expect(thumbnailVariantForCell(176, 2)).toBe("large");
    expect(thumbnailVariantForCell(10_000, 4)).toBe("large");
  });

  it("keeps grid keyboard movement logical and bounded to loaded source rows", () => {
    expect(nextGridIndex("ArrowRight", 0, 20, 4, null)).toBe(1);
    expect(nextGridIndex("ArrowDown", 1, 20, 4, null)).toBe(5);
    expect(nextGridIndex("End", 4, 6, 4, null)).toBe(5);
    expect(nextGridIndex("ArrowDown", 4, 6, 4, null)).toBe(5);
  });

  it("restores view mode per target without adding a navigation entry", () => {
    const session = new WorkspaceSession({ initialTarget: libraryTarget });
    expect(session.setPresentation({ viewMode: "grid", scrollAnchor: "library:top" })).toBe(true);
    expect(session.getState().history).toHaveLength(1);
    expect(session.getState().presentation).toEqual({ viewMode: "grid", scrollAnchor: "library:top" });

    expect(session.navigate(browseTarget)).toBe(true);
    expect(session.getState().presentation).toEqual({});
    expect(session.back()).toBe(true);
    expect(session.getState().presentation).toEqual({ viewMode: "grid", scrollAnchor: "library:top" });
  });

  it("accepts only bounded presentation state", () => {
    expect(isWorkspacePresentationState({ viewMode: "grid", scrollAnchor: "row-1" })).toBe(true);
    expect(isWorkspacePresentationState({ viewMode: "gallery" })).toBe(false);
    expect(isWorkspacePresentationState({ viewMode: "grid", sourceGeneration: "caller" })).toBe(false);
  });

  it("keeps Grid source-neutral and delegates thumbnail demand to the existing seam", () => {
    const grid = readFileSync(resolve("src/views/fileLibrary/list/SharedFileGrid.tsx"), "utf8");
    expect(grid).toContain("PresentationInteractionProjection");
    expect(grid).toContain("useVirtualizer");
    expect(grid).toContain("controller.requestThumbnail(request)");
    expect(grid).toContain("controller.cancelThumbnail(requestId)");
    expect(grid).toContain("interaction.actions.selectAll()");
    expect(grid).not.toContain("sourceGeneration");
    expect(grid).not.toContain("displayPath");
  });
});
