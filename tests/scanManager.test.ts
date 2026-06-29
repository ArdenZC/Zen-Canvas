import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("scan manager progress callbacks", () => {
  it("refreshes file data only from scan-complete and not scan-progress", () => {
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
    expect(completeHandler).toContain("useFileLibraryStore.getState().refresh");
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
