import { describe, expect, it } from "vitest";
import { computeFileLibraryFilterPopoverPlacement } from "../src/views/vault/components/FileLibraryFilterPopover";

describe("File Library filter popover placement", () => {
  it("keeps a right-aligned filter inside the File Library workspace at the observed 1282x862 native window size", () => {
    const placement = computeFileLibraryFilterPopoverPlacement({
      anchor: { left: 360, right: 430, top: 112, bottom: 148 },
      boundary: { left: 238, right: 1270, top: 76, bottom: 850 },
      viewportWidth: 1282,
      viewportHeight: 862
    });

    expect(placement.side).toBe("below");
    expect(placement.left).toBeGreaterThanOrEqual(250);
    expect(placement.left + placement.width).toBeLessThanOrEqual(1258);
    expect(placement.top).toBeGreaterThanOrEqual(156);
    expect((placement.top ?? 0) + placement.maxHeight).toBeLessThanOrEqual(838);
  });

  it("flips above the trigger when the lower workspace edge cannot hold the filter panel", () => {
    const placement = computeFileLibraryFilterPopoverPlacement({
      anchor: { left: 910, right: 1010, top: 724, bottom: 760 },
      boundary: { left: 220, right: 1260, top: 72, bottom: 842 },
      viewportWidth: 1282,
      viewportHeight: 862
    });

    expect(placement.side).toBe("above");
    expect(placement.bottom).toBeGreaterThanOrEqual(110);
    expect(placement.maxHeight).toBeLessThanOrEqual(560);
  });

  it("shrinks to a compact workspace instead of crossing the workspace boundary", () => {
    const placement = computeFileLibraryFilterPopoverPlacement({
      anchor: { left: 238, right: 314, top: 104, bottom: 140 },
      boundary: { left: 226, right: 530, top: 72, bottom: 650 },
      viewportWidth: 980,
      viewportHeight: 680
    });

    expect(placement.width).toBe(280);
    expect(placement.left).toBe(238);
    expect(placement.left + placement.width).toBe(518);
  });
});
