import { describe, expect, it } from "vitest";
import {
  evaluateW201CompactGate,
  evaluateW201ProjectionGate,
  evaluateW201ResponsiveGate,
  evaluateW201VirtualizationInteraction,
  W201_VIEWPORTS
} from "../scripts/w2-01-browser-gate.mjs";

function compactMeasurement(overrides: Record<string, unknown> = {}) {
  return {
    viewportContract: {
      requested: W201_VIEWPORTS.compact,
      innerWidth: 980,
      innerHeight: 680,
      documentClientWidth: 980,
      documentClientHeight: 680,
      root: { top: 0, bottom: 680, height: 680, left: 0, right: 980, width: 980 },
      matchesRequested: true
    },
    bounds: {
      root: { top: 0, bottom: 680, height: 680, left: 0, right: 980, width: 980 },
      titlebar: { top: 0, bottom: 48, height: 48, left: 0, right: 980, width: 980 },
      viewStage: { top: 48, bottom: 680, height: 632, left: 0, right: 980, width: 980 },
      workspace: { top: 48, bottom: 680, height: 632, left: 0, right: 980, width: 980 },
      workspaceBody: { top: 133, bottom: 680, height: 547, left: 228, right: 980, width: 752 },
      contentSlot: { top: 133, bottom: 680, height: 547, left: 228, right: 980, width: 752 },
      legacyLibraryAdapter: { top: 133, bottom: 680, height: 547, left: 228, right: 980, width: 752 },
      fileLibraryList: { top: 501, bottom: 679, height: 178, left: 229, right: 979, width: 750 }
    },
    scrollOwnership: {
      document: { clientHeight: 680, scrollHeight: 680, scrollTop: 0, overflowY: "hidden" },
      body: { clientHeight: 680, scrollHeight: 680, scrollTop: 0, overflowY: "hidden" },
      viewStage: { clientHeight: 632, scrollHeight: 632, scrollTop: 0, overflowY: "hidden" },
      workspace: { clientHeight: 632, scrollHeight: 632, scrollTop: 0, overflowY: "hidden" },
      fileLibraryList: { clientHeight: 178, scrollHeight: 2700, scrollTop: 0, overflowY: "auto" },
      fileLibraryListSelector: "tanstack-virtualizer",
      ancestorOverflow: []
    },
    virtualization: {
      logicalCount: 50,
      hasMore: true,
      allResultsLoaded: false,
      mountedRowCount: 12,
      firstMountedRowIndex: 0,
      lastMountedRowIndex: 11,
      mountedRowIndices: Array.from({ length: 12 }, (_, index) => index)
    },
    page: {
      documentClientHeight: 680,
      documentScrollHeight: 680,
      bodyClientHeight: 680,
      bodyScrollHeight: 680,
      unintendedVerticalScroll: false
    },
    ...overrides
  };
}

function responsiveMeasurement() {
  return compactMeasurement({
    viewportContract: {
      requested: W201_VIEWPORTS.wide,
      innerWidth: 1600,
      innerHeight: 900,
      documentClientWidth: 1600,
      documentClientHeight: 900,
      root: { top: 0, bottom: 900, height: 900, left: 0, right: 1600, width: 1600 },
      matchesRequested: true
    },
    bounds: {
      ...compactMeasurement().bounds,
      root: { top: 0, bottom: 900, height: 900, left: 0, right: 1600, width: 1600 },
      titlebar: { top: 0, bottom: 48, height: 48, left: 0, right: 1600, width: 1600 },
      viewStage: { top: 48, bottom: 900, height: 852, left: 0, right: 1600, width: 1600 },
      workspace: { top: 48, bottom: 900, height: 852, left: 0, right: 1600, width: 1600 },
      workspaceBody: { top: 107, bottom: 900, height: 793, left: 0, right: 1600, width: 1600 },
      contentSlot: { top: 107, bottom: 900, height: 793, left: 0, right: 1600, width: 1600 },
      legacyLibraryAdapter: { top: 107, bottom: 900, height: 793, left: 0, right: 1600, width: 1600 },
      fileLibraryList: { top: 638, bottom: 899, height: 261, left: 0, right: 1200, width: 1200 }
    },
    scrollOwnership: {
      ...compactMeasurement().scrollOwnership,
      document: { clientHeight: 900, scrollHeight: 900, scrollTop: 0, overflowY: "hidden" },
      body: { clientHeight: 900, scrollHeight: 900, scrollTop: 0, overflowY: "hidden" },
      viewStage: { clientHeight: 852, scrollHeight: 852, scrollTop: 0, overflowY: "hidden" },
      workspace: { clientHeight: 852, scrollHeight: 852, scrollTop: 0, overflowY: "hidden" },
      contentSlot: { clientHeight: 793, scrollHeight: 793, scrollTop: 0, overflowY: "hidden" },
      legacyLibraryAdapter: { clientHeight: 793, scrollHeight: 793, scrollTop: 0, overflowY: "hidden" },
      vaultRoot: { clientHeight: 793, scrollHeight: 793, scrollTop: 0, overflowY: "hidden" },
      resultRegion: { clientHeight: 263, scrollHeight: 263, scrollTop: 0, overflowY: "hidden" },
      resultMain: { clientHeight: 263, scrollHeight: 263, scrollTop: 0, overflowY: "auto" },
      resultSection: { clientHeight: 261, scrollHeight: 261, scrollTop: 0, overflowY: "hidden" },
      fileLibraryList: { clientHeight: 261, scrollHeight: 2700, scrollTop: 0, overflowY: "auto" },
      fileLibraryListSelector: "tanstack-virtualizer"
    }
  });
}

describe("W2-01 browser gate evaluator contract", () => {
  it("accepts bounded Compact layout with the listbox as the virtualizer owner", () => {
    const result = evaluateW201CompactGate(compactMeasurement());
    expect(result.passed).toBe(true);
    expect(result.hardAssertionSummary.compactLibraryClippingDetected).toBe(false);
  });

  it("rejects the pre-seam page-level overflow failure", () => {
    const result = evaluateW201CompactGate(compactMeasurement({
      bounds: {
        ...compactMeasurement().bounds,
        contentSlot: { top: 133, bottom: 1350, height: 1217, left: 228, right: 980, width: 752 },
        legacyLibraryAdapter: { top: 133, bottom: 1350, height: 1217, left: 228, right: 980, width: 752 },
        fileLibraryList: { top: 1170, bottom: 1348, height: 178, left: 229, right: 979, width: 750 }
      },
      page: {
        documentClientHeight: 680,
        documentScrollHeight: 1350,
        bodyClientHeight: 680,
        bodyScrollHeight: 1350,
        unintendedVerticalScroll: true
      }
    }));
    expect(result.passed).toBe(false);
    expect(result.hardAssertionSummary.contentSlotWithinWorkspaceBody).toBe(false);
    expect(result.hardAssertionSummary.noUnintendedPageScroll).toBe(false);
  });

  it("requires real scrolling and a changed virtual range", () => {
    const before = compactMeasurement();
    const after = compactMeasurement({
      scrollOwnership: {
        ...before.scrollOwnership,
        fileLibraryList: { ...before.scrollOwnership.fileLibraryList, scrollTop: 446, scrollHeight: 6834 }
      },
      virtualization: {
        ...before.virtualization,
        logicalCount: 130,
        hasMore: false,
        allResultsLoaded: true,
        mountedRowCount: 20,
        firstMountedRowIndex: 80,
        lastMountedRowIndex: 99,
        mountedRowIndices: Array.from({ length: 20 }, (_, index) => index + 80)
      }
    });
    const result = evaluateW201VirtualizationInteraction(before, after);
    expect(result.passed).toBe(true);
  });

  it("accepts Wide/Medium bounded layout without a second result scroll owner", () => {
    const result = evaluateW201ResponsiveGate(responsiveMeasurement(), W201_VIEWPORTS.wide);
    expect(result.passed).toBe(true);
    expect(result.hardAssertionSummary.noDoubleResultScroll).toBe(true);
  });

  it("rejects an outer result container that also scrolls", () => {
    const measurement = responsiveMeasurement();
    const result = evaluateW201ResponsiveGate({
      ...measurement,
      scrollOwnership: {
        ...measurement.scrollOwnership,
        resultRegion: { clientHeight: 263, scrollHeight: 500, scrollTop: 0, overflowY: "auto" }
      }
    }, W201_VIEWPORTS.wide);
    expect(result.passed).toBe(false);
    expect(result.hardAssertionSummary.noDoubleResultScroll).toBe(false);
  });

  it("fails when a CSS overflow owner exists without usable scroll range", () => {
    const result = evaluateW201CompactGate(compactMeasurement({
      scrollOwnership: {
        ...compactMeasurement().scrollOwnership,
        fileLibraryList: { clientHeight: 0, scrollHeight: 0, scrollTop: 0, overflowY: "auto" }
      },
      bounds: {
        ...compactMeasurement().bounds,
        fileLibraryList: { top: 680, bottom: 680, height: 0, left: 229, right: 979, width: 750 }
      }
    }));
    expect(result.passed).toBe(false);
    expect(result.hardAssertionSummary.fileLibraryListOwnsOverflow).toBe(false);
    expect(result.hardAssertionSummary.contentReachableWithoutClipping).toBe(false);
  });

  it("keeps detached Browse bounded without mounting the legacy adapter", () => {
    const measurement = compactMeasurement({
      bounds: {
        ...compactMeasurement().bounds,
        legacyLibraryAdapter: null,
        fileLibraryList: null
      },
      scrollOwnership: {
        ...compactMeasurement().scrollOwnership,
        legacyLibraryAdapter: null,
        fileLibraryList: null
      },
      virtualization: {
        logicalCount: null,
        hasMore: null,
        allResultsLoaded: false,
        mountedRowCount: 0,
        firstMountedRowIndex: null,
        lastMountedRowIndex: null,
        mountedRowIndices: []
      }
    });
    const result = evaluateW201ProjectionGate(measurement, W201_VIEWPORTS.compact, "detached-browse");
    expect(result.passed).toBe(true);
  });

  it("keeps ordinary Overview outside the File Library workspace", () => {
    const base = compactMeasurement();
    const measurement = {
      ...base,
      bounds: {
        ...base.bounds,
        viewStage: null,
        workspace: null,
        workspaceBody: null,
        contentSlot: null,
        legacyLibraryAdapter: null,
        fileLibraryList: null
      },
      scrollOwnership: {
        ...base.scrollOwnership,
        viewStage: null,
        workspace: null,
        workspaceBody: null,
        contentSlot: null,
        legacyLibraryAdapter: null,
        fileLibraryList: null
      }
    };
    const result = evaluateW201ProjectionGate(measurement, W201_VIEWPORTS.compact, "overview");
    expect(result.passed).toBe(true);
  });
});
