import { describe, expect, it } from "vitest";
import { mockInvokeCommand } from "../src/api/browserMockApi";

describe("browser mock command contract", () => {
  it("throws for commands that were not explicitly registered", async () => {
    await expect(mockInvokeCommand("misspelled_command")).rejects.toThrow(
      "Unsupported mock command: misspelled_command"
    );
  });
});
