import { describe, expect, it, vi } from "vitest";
import { installMainReadinessListenerBeforeReady } from "../src/utils/mainWindowReadiness";

describe("Main window readiness listener ordering", () => {
  it("reports ready only after the nonce request listener is installed", async () => {
    const order: string[] = [];
    let installListener!: (unlisten: () => void) => void;
    const ready = installMainReadinessListenerBeforeReady(
      () => new Promise((resolve) => { installListener = resolve; }),
      async () => { order.push("ready"); },
      () => false
    );

    await Promise.resolve();
    expect(order).toEqual([]);
    order.push("listener-installed");
    installListener(() => order.push("unlisten"));
    await ready;
    expect(order).toEqual(["listener-installed", "ready"]);
  });

  it("unlistens without reporting ready if the Main generation was disposed during registration", async () => {
    const unlisten = vi.fn();
    const markReady = vi.fn(async () => undefined);
    const installed = await installMainReadinessListenerBeforeReady(
      async () => unlisten,
      markReady,
      () => true
    );

    expect(installed).toBeUndefined();
    expect(unlisten).toHaveBeenCalledOnce();
    expect(markReady).not.toHaveBeenCalled();
  });

  it("removes the listener when readiness cannot be recorded", async () => {
    const unlisten = vi.fn();
    const error = new Error("stale Main generation");
    await expect(installMainReadinessListenerBeforeReady(
      async () => unlisten,
      async () => { throw error; },
      () => false
    )).rejects.toBe(error);
    expect(unlisten).toHaveBeenCalledOnce();
  });
});
