import { describe, expect, it } from "vitest";
import { SpotlightQueryController } from "../src/components/spotlight/spotlightQueryController";

function response(requestId: string, sourceRevision = "revision-1") {
  return { requestId, sourceRevision };
}

describe("SpotlightQueryController", () => {
  it("uses a distinct request identity for repeated identical queries", () => {
    const controller = new SpotlightQueryController();
    controller.openSession(7);

    const first = controller.nextRequest("report", 80);
    const second = controller.nextRequest("report", 80);

    expect(first.requestId).not.toBe(second.requestId);
    expect(first.query).toBe(second.query);
    expect(controller.accepts(response(first.requestId))).toBe(false);
    expect(controller.accepts(response(second.requestId))).toBe(true);
  });

  it("accepts only the final response from a thirty-request burst", () => {
    const controller = new SpotlightQueryController();
    controller.openSession(11);
    const requests = Array.from({ length: 30 }, (_, index) =>
      controller.nextRequest(`report-${index}`, 80)
    );

    for (const stale of requests.slice(0, -1)) {
      expect(controller.accepts(response(stale.requestId))).toBe(false);
    }
    expect(controller.accepts(response(requests.at(-1)!.requestId))).toBe(true);
  });

  it("rejects responses from the previous open session", () => {
    const controller = new SpotlightQueryController();
    controller.openSession(7);
    const oldRequest = controller.nextRequest("report", 80);

    controller.openSession(8);
    const currentRequest = controller.nextRequest("report", 80);

    expect(controller.accepts(response(oldRequest.requestId))).toBe(false);
    expect(controller.accepts(response(currentRequest.requestId))).toBe(true);
  });

  it("detects a source revision change exactly once for a stable replacement", () => {
    const controller = new SpotlightQueryController();
    controller.openSession(1);

    expect(controller.acceptSourceRevision("revision-1")).toBe(false);
    expect(controller.acceptSourceRevision("revision-2")).toBe(true);
    expect(controller.acceptSourceRevision("revision-2")).toBe(false);
  });
});
