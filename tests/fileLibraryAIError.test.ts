import { describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  getAISettings: vi.fn()
}));

vi.mock("../src/api/tauriApi", () => ({
  tauriApi: apiMocks
}));

import { readableAIClassificationError } from "../src/store/useFileLibraryStore";

describe("AI classification error messages", () => {
  it("shows rate limit guidance for HTTP 429 without blaming API keys", () => {
    const message = readableAIClassificationError(
      new Error("AI classification batch 3/50 failed. Provider error: HTTP 429 rate limit")
    );

    expect(message).toContain("限流");
    expect(message).toContain("降低 Batch Size");
    expect(message).toContain("HTTP 429");
    expect(message).not.toContain("检查 API Key");
  });

  it("shows timeout guidance with batch size and timeout settings", () => {
    const message = readableAIClassificationError(
      new Error("AI classification batch 2/10 failed. Provider error: request timeout")
    );

    expect(message).toContain("模型请求超时");
    expect(message).toContain("降低 Batch Size");
    expect(message).toContain("提高 Timeout Seconds");
  });

  it("shows parameter guidance for HTTP 400", () => {
    const message = readableAIClassificationError(
      new Error("AI classification batch 1/5 failed. Provider error: HTTP 400 invalid request")
    );

    expect(message).toContain("模型服务拒绝了请求参数");
    expect(message).toContain("response_format");
    expect(message).toContain("thinking");
  });

  it("preserves concrete provider diagnostics", () => {
    const detail = "AI classification batch 1/2 failed. Provider error: HTTP 500 provider response summary: has_choices=false";

    expect(readableAIClassificationError(new Error(detail))).toContain(detail);
  });

  it("uses the generic connection message only for unknown network errors", () => {
    const message = readableAIClassificationError(new Error("network request failed"));

    expect(message).toBe("无法连接到模型服务，请检查 Base URL、Chat Path、网络和 API Key。");
  });
});
