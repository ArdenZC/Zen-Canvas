import { describe, expect, it } from "vitest";

import { normalizePathLike, samePathLike } from "../src/utils/viewHelpers";

describe("path identity", () => {
  it("compares Windows drive paths case-insensitively", () => {
    expect(samePathLike("C:\\Users\\Zen\\Report.md", "c:/users/zen/report.md")).toBe(true);
  });

  it("preserves case for POSIX paths", () => {
    expect(normalizePathLike("/home/zen/Report.md")).toBe("/home/zen/Report.md");
    expect(samePathLike("/home/zen/Report.md", "/home/zen/report.md")).toBe(false);
  });
});
