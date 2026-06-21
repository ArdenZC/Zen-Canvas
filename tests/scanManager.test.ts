import { describe, expect, it, vi } from "vitest";
import { createScanProgressOptions } from "../src/hooks/useScanManager";

describe("scan manager progress callbacks", () => {
  it("does not refresh full stats from scan batches and refreshes once on completion", async () => {
    const onRefreshData = vi.fn(async () => {});

    const options = createScanProgressOptions(onRefreshData);

    expect(options.onBatch).toBeUndefined();
    options.onComplete?.({
      root: "/test/root",
      scanned: 10,
      files: 8,
      directories: 2,
      skipped: 1,
      errors: 0,
      elapsedMs: 250
    });
    await Promise.resolve();

    expect(onRefreshData).toHaveBeenCalledOnce();
  });
});
