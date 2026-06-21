import { describe, expect, it } from "vitest";
import { shouldIncludeScanEntries } from "../src/hooks/useScanProgress";

describe("scan progress entry transport", () => {
  it("only requests scan batch entries when retention is explicitly enabled", () => {
    expect(shouldIncludeScanEntries({})).toBe(false);
    expect(shouldIncludeScanEntries({ keepEntries: false })).toBe(false);
    expect(shouldIncludeScanEntries({ keepEntries: true })).toBe(true);
  });
});
