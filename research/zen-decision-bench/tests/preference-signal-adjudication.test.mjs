import { describe, expect, it } from "vitest";
import { validateBlindAdjudication } from "../preference/signal/validate-adjudication.mjs";

describe("ZDB-03B2 Owner blind adjudication", () => {
  it("matches frozen Profile + Target + Assignment without History input", async () => {
    const result = await validateBlindAdjudication();
    expect(result.valid, result.issues.join("\n")).toBe(true);
    expect(result.count).toBe(120);
    expect(result.canonical_sha256).toBe("498a511c4cfba87daaed7db5197c35aed96de34862feede43c500d9eb5d3ad50");
    expect(result.file_sha256).toBe("7f87770e30dae42a735b26b620209fabcd59eac1e449aad528de68523d56abbf");
  });
});
