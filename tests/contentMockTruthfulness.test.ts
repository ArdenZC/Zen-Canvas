import { describe, expect, it } from "vitest";
import { mockInvokeCommand } from "../src/api/browserMockApi";

describe("Task 08 browser mock truthfulness", () => {
  it("does not report native extraction or persistence success", async () => {
    await expect(mockInvokeCommand("preview_content", { request: {} })).rejects.toThrow("browser_mock_content_unavailable");
    await expect(mockInvokeCommand("start_content_run", { request: {} })).rejects.toThrow("browser_mock_content_unavailable");
    await expect(mockInvokeCommand("delete_content_artifact", { request: {} })).rejects.toThrow("browser_mock_content_unavailable");
    await expect(mockInvokeCommand("purge_content_scope", { request: {} })).rejects.toThrow("browser_mock_content_unavailable");
  });
});
