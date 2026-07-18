import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isCurrentDedupeEvent } from "../src/store/useScanManagerStore";

describe("scan manager progress callbacks", () => {
  it("accepts dedupe events only for the current parent scan and dedupe job", () => {
    const current = { dedupeJobId: "dedupe-a", parentScanJobId: "scan-a" };

    expect(isCurrentDedupeEvent(current, "scan-a", null)).toBe(true);
    expect(isCurrentDedupeEvent(current, "scan-a", "dedupe-a")).toBe(true);
    expect(isCurrentDedupeEvent(current, "scan-b", null)).toBe(false);
    expect(isCurrentDedupeEvent(current, "scan-a", "dedupe-b")).toBe(false);
  });
  it("does not refresh or reset scope from scan event callbacks", () => {
    const storeSource = readFileSync(
      resolve("src/store/useScanManagerStore.ts"),
      "utf8"
    );
    const progressHandler = storeSource.slice(
      storeSource.indexOf("tauriApi.onScanProgress"),
      storeSource.indexOf("tauriApi.onScanBatch")
    );
    const completeHandler = storeSource.slice(
      storeSource.indexOf("tauriApi.onScanComplete"),
      storeSource.indexOf("tauriApi.onScanError")
    );

    expect(progressHandler).not.toContain("useFileLibraryStore.getState().refresh");
    expect(progressHandler).not.toContain("useFileLibraryStore.getState().setCurrentScanScope");
    expect(completeHandler).not.toContain("useFileLibraryStore.getState().refresh");
    expect(completeHandler).not.toContain("useFileLibraryStore.getState().setCurrentScanScope");
  });

  it("updates scope and refreshes once from scanPaths after all roots finish", () => {
    const storeSource = readFileSync(
      resolve("src/store/useScanManagerStore.ts"),
      "utf8"
    );
    const scanPaths = storeSource.slice(
      storeSource.indexOf("scanPaths: async"),
      storeSource.indexOf("handleScan: async")
    );

    expect(scanPaths).toContain("useFileLibraryStore.getState().setCurrentScanScope(completedScanRoots)");
    expect(scanPaths).toContain("useFileLibraryStore.getState().refresh(useAppStore.getState().searchQuery)");
    expect(scanPaths.indexOf("useFileLibraryStore.getState().setCurrentScanScope(completedScanRoots)"))
      .toBeGreaterThan(scanPaths.indexOf("for (const path of scanRoots)"));
    expect(scanPaths.indexOf("useFileLibraryStore.getState().refresh(useAppStore.getState().searchQuery)"))
      .toBeGreaterThan(scanPaths.indexOf("for (const path of scanRoots)"));
  });

  it("stops a batch scan before starting the next root when cancellation is requested", () => {
    const storeSource = readFileSync(
      resolve("src/store/useScanManagerStore.ts"),
      "utf8"
    );
    const scanPaths = storeSource.slice(
      storeSource.indexOf("scanPaths: async"),
      storeSource.indexOf("handleScan: async")
    );
    const cancelScan = storeSource.slice(
      storeSource.lastIndexOf("cancelScan: async"),
      storeSource.length
    );

    expect(storeSource).toContain("let scanJobCanceled = false");
    expect(storeSource).toContain("activeScanJobId");
    expect(storeSource).toContain("progress.jobId !== activeScanJobId");
    expect(scanPaths).toContain("scanJobCanceled = false");
    expect(scanPaths).toContain('await tauriApi.createScanJobId("foreground")');
    expect(scanPaths).toContain("if (scanJobCanceled) break");
    expect(scanPaths.indexOf("if (scanJobCanceled) break"))
      .toBeLessThan(scanPaths.indexOf("tauriApi.startScan("));
    expect(cancelScan).toContain("scanJobCanceled = true");
    expect(cancelScan).toContain("tauriApi.cancelScan(activeScanJobId)");
    expect(cancelScan).toContain("isCancelingScan: true");
    expect(cancelScan).not.toContain("isScanning: false");
    expect(cancelScan).toContain('status: "canceled"');
  });

  it("keeps scanning locked while cancellation is still settling", () => {
    const storeSource = readFileSync(
      resolve("src/store/useScanManagerStore.ts"),
      "utf8"
    );
    const scanPaths = storeSource.slice(
      storeSource.indexOf("scanPaths: async"),
      storeSource.indexOf("handleScan: async")
    );
    const finallyBlock = scanPaths.slice(
      scanPaths.indexOf("finally"),
      scanPaths.length
    );

    expect(storeSource).toContain("isCancelingScan: boolean");
    expect(scanPaths).toContain("if (get().isScanning) return");
    expect(scanPaths.indexOf("if (get().isScanning) return"))
      .toBeLessThan(scanPaths.indexOf("scanJobCanceled = false"));
    expect(finallyBlock).toContain("isScanning: false");
    expect(finallyBlock).toContain("isCancelingScan: false");
  });

  it("reports canceled scans without showing a success file count or refreshing unscanned roots", () => {
    const storeSource = readFileSync(
      resolve("src/store/useScanManagerStore.ts"),
      "utf8"
    );
    const scanPaths = storeSource.slice(
      storeSource.indexOf("scanPaths: async"),
      storeSource.indexOf("handleScan: async")
    );
    const canceledBranch = scanPaths.slice(
      scanPaths.indexOf("if (scanJobCanceled)"),
      scanPaths.indexOf("useAppStore.getState().showSuccess(`${t(\"success\")}")
    );

    expect(canceledBranch).toContain('status: "canceled"');
    expect(canceledBranch).toContain('showSuccess(t("scanCanceled"))');
    expect(canceledBranch).not.toContain("setCurrentScanScope(scanRoots)");
    expect(canceledBranch).not.toContain('`${t("success")}:');
  });

  it("treats scan-error events as warnings instead of fatal scan failures", () => {
    const storeSource = readFileSync(
      resolve("src/store/useScanManagerStore.ts"),
      "utf8"
    );
    const start = storeSource.indexOf("tauriApi.onScanError");
    const scanErrorHandler = storeSource.slice(
      start,
      storeSource.indexOf("])", start)
    );

    expect(scanErrorHandler).not.toContain('status: "error"');
    expect(scanErrorHandler).toContain("progress.errors");
  });

  it("marks scanState as error only when the scan command rejects", () => {
    const storeSource = readFileSync(
      resolve("src/store/useScanManagerStore.ts"),
      "utf8"
    );
    const scanPaths = storeSource.slice(
      storeSource.indexOf("scanPaths: async"),
      storeSource.indexOf("handleScan: async")
    );

    expect(scanPaths).toContain('status: "error"');
    expect(scanPaths).toContain("readableError(error)");
  });
});
