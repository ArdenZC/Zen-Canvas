import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifyFsWatchEvent,
  watcherQueueSnapshotFromEvent,
  mergeWatcherQueues,
  takeWatcherQueueBatch,
  WatcherRetryQueue,
  WATCHER_MAX_ATTEMPTS,
  type FsWatchEvent
} from "../src/hooks/fsWatcherQueue";
import { useFsWatcher } from "../src/hooks/useFsWatcher";

type EffectEntry = {
  deps?: unknown[];
  cleanup?: void | (() => void);
};

const reactMock = vi.hoisted(() => ({
  refs: [] as Array<{ current: unknown }>,
  effects: [] as EffectEntry[],
  refIndex: 0,
  effectIndex: 0
}));

const apiMocks = vi.hoisted(() => ({
  listen: vi.fn(),
  markFilesStaleByPaths: vi.fn(),
  upsertFilesByPaths: vi.fn(),
  executeAuthoritativeRulesForPaths: vi.fn()
}));

vi.mock("react", () => ({
  useRef: (initialValue: unknown) => {
    const index = reactMock.refIndex++;
    reactMock.refs[index] ??= { current: initialValue };
    return reactMock.refs[index];
  },
  useEffect: (effect: () => void | (() => void), deps?: unknown[]) => {
    const index = reactMock.effectIndex++;
    const previous = reactMock.effects[index];
    const changed = !previous || !deps || !previous.deps || deps.some((dep, depIndex) => dep !== previous.deps?.[depIndex]);
    if (!changed) return;
    previous?.cleanup?.();
    reactMock.effects[index] = {
      deps,
      cleanup: effect()
    };
  }
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: apiMocks.listen
}));

vi.mock("../src/api/tauriApi", () => ({
  tauriApi: {
    markFilesStaleByPaths: apiMocks.markFilesStaleByPaths,
    upsertFilesByPaths: apiMocks.upsertFilesByPaths,
    executeAuthoritativeRulesForPaths: apiMocks.executeAuthoritativeRulesForPaths,
    onFsEvent: (handler: (payload: FsWatchEvent) => void) => apiMocks.listen("fs-event", handler),
    onFsWatcherWarning: (handler: (payload: { message: string; path?: string; limit?: number }) => void) =>
      apiMocks.listen("fs-watcher-warning", handler)
  }
}));

describe("fs watcher event routing", () => {
  it("routes remove events to the stale queue", () => {
    expect(classifyFsWatchEvent({ eventType: "remove", paths: ["a.txt"] })).toBe("stale");
    expect(classifyFsWatchEvent({ deleted: true, path: "a.txt" })).toBe("stale");
  });

  it("routes modified events to the upsert queue", () => {
    expect(classifyFsWatchEvent({ eventType: "modified", paths: ["a.txt"] })).toBe("upsert");
    expect(classifyFsWatchEvent({ event_type: "changed", path: "a.txt" })).toBe("upsert");
  });

  it("ignores read-only and unknown events", () => {
    expect(classifyFsWatchEvent({ eventType: "accessed", paths: ["a.txt"] })).toBe("ignore");
    expect(classifyFsWatchEvent({ eventType: "other", paths: ["a.txt"] })).toBe("ignore");
  });

  it("lets stale win when the same path appears in both queues", () => {
    const merged = mergeWatcherQueues(new Set(["a.txt", "stale.txt"]), new Set(["a.txt"]));

    expect(merged.stale).toEqual(["a.txt", "stale.txt"]);
    expect(merged.upsert).toEqual([]);
  });

  it("routes rename old paths stale and new paths upsert", () => {
    const snapshot = watcherQueueSnapshotFromEvent({
      eventType: "renamed",
      paths: ["old.txt", "new.txt"],
      stalePaths: ["old.txt"],
      upsertPaths: ["new.txt"]
    });

    expect(snapshot).toEqual({
      stale: ["old.txt"],
      upsert: ["new.txt"]
    });
  });

  it("keeps delete and create event routing explicit", () => {
    expect(watcherQueueSnapshotFromEvent({ eventType: "deleted", paths: ["gone.txt"] })).toEqual({
      stale: ["gone.txt"],
      upsert: []
    });
    expect(watcherQueueSnapshotFromEvent({ eventType: "created", paths: ["new.txt"] })).toEqual({
      stale: [],
      upsert: ["new.txt"]
    });
  });

  it("takes bounded watcher batches and leaves the remainder queued", () => {
    const staleQueue = new Set(["stale-1.txt", "shared.txt", "stale-2.txt"]);
    const upsertQueue = new Set(["upsert-1.txt", "shared.txt", "upsert-2.txt"]);

    const first = takeWatcherQueueBatch(staleQueue, upsertQueue, 3);

    expect(first).toEqual({
      stale: ["stale-1.txt"],
      upsert: ["upsert-1.txt", "upsert-2.txt"]
    });
    expect(Array.from(staleQueue)).toEqual(["shared.txt", "stale-2.txt"]);
    expect(upsertQueue.size).toBe(0);

    const second = takeWatcherQueueBatch(staleQueue, upsertQueue, 3);

    expect(second).toEqual({
      stale: ["shared.txt", "stale-2.txt"],
      upsert: []
    });
    expect(staleQueue.size).toBe(0);
    expect(upsertQueue.size).toBe(0);
  });

  it("retains a failed item until the next attempt succeeds", () => {
    const queue = new WatcherRetryQueue();
    queue.enqueue("a.txt", "stale", 0);
    const first = queue.takeReady(0, 10);
    expect(first).toHaveLength(1);

    expect(queue.markFailure(first[0], 0)).toBe(false);
    expect(queue.takeReady(249, 10)).toEqual([]);
    const second = queue.takeReady(250, 10);
    expect(second[0]?.attempts).toBe(1);
    expect(queue.markSuccess(second[0])).toBe(true);
    expect(queue.itemsForTest()).toEqual([]);
  });

  it("lets a newer event invalidate an older retry and preserves classification independence", () => {
    const queue = new WatcherRetryQueue();
    queue.enqueue("a.txt", "upsert", 0);
    const upsert = queue.takeReady(0, 10)[0];
    expect(queue.markFailure(upsert, 0)).toBe(false);
    queue.enqueue("a.txt", "stale", 100);
    expect(queue.markSuccess(upsert)).toBe(false);

    const stale = queue.takeReady(100, 10)[0];
    expect(stale.action).toBe("stale");
    queue.enqueue("a.txt", "classify", 200);
    expect(queue.markSuccess(stale)).toBe(false);
    const classify = queue.takeReady(200, 10)[0];
    expect(classify.action).toBe("classify");
  });

  it("keeps permanently failed work visible instead of dropping it", () => {
    const queue = new WatcherRetryQueue();
    queue.enqueue("a.txt", "upsert", 0);
    let now = 0;
    for (let attempt = 0; attempt < WATCHER_MAX_ATTEMPTS; attempt += 1) {
      const item = queue.takeReady(now, 10)[0];
      expect(item).toBeDefined();
      expect(queue.markFailure(item, now)).toBe(attempt + 1 >= WATCHER_MAX_ATTEMPTS);
      now += 10_000;
    }
    expect(queue.itemsForTest()[0]?.state).toBe("permanently_failed");
    expect(queue.hasReadyOrWaiting()).toBe(false);
  });
});

describe("fs watcher hook registration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetHookHarness();
    apiMocks.listen.mockReset().mockResolvedValue(() => {});
    apiMocks.markFilesStaleByPaths.mockReset().mockResolvedValue(0);
    apiMocks.upsertFilesByPaths.mockReset().mockResolvedValue(1);
    apiMocks.executeAuthoritativeRulesForPaths.mockReset().mockResolvedValue({
      scanned: 1,
      updated: 1,
      skipped: 0,
      needsConfirmation: 0
    });
  });

  afterEach(() => {
    cleanupHookHarness();
    vi.useRealTimers();
  });

  it("keeps queued fs events when rules change during the debounce window", async () => {
    const onRefreshData = vi.fn(async () => {});

    renderWatcher({ onRefreshData });

    const handler = apiMocks.listen.mock.calls[0][1] as (payload: FsWatchEvent) => void;
    handler({ eventType: "created", paths: ["F:/Projects/new.txt"] });

    renderWatcher({ onRefreshData });
    await flushPromises();

    expect(apiMocks.listen).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(500);
    await flushPromises();

    expect(apiMocks.upsertFilesByPaths).toHaveBeenCalledWith(["F:/Projects/new.txt"]);
    expect(apiMocks.executeAuthoritativeRulesForPaths).toHaveBeenCalledWith(["F:/Projects/new.txt"]);
    expect(onRefreshData).toHaveBeenCalledOnce();
    expect(onRefreshData).toHaveBeenCalledOnce();
  });

  it("keeps rename and move classification scoped to the new path", async () => {
    const onRefreshData = vi.fn(async () => {});

    renderWatcher({ onRefreshData });
    const handler = apiMocks.listen.mock.calls[0][1] as (payload: FsWatchEvent) => void;
    handler({
      eventType: "renamed",
      stalePaths: ["F:/Projects/old.txt"],
      upsertPaths: ["F:/Archive/new.txt"],
      paths: ["F:/Projects/old.txt", "F:/Archive/new.txt"]
    });

    await vi.advanceTimersByTimeAsync(500);
    await flushPromises();

    expect(apiMocks.markFilesStaleByPaths).toHaveBeenCalledWith(["F:/Projects/old.txt"]);
    expect(apiMocks.upsertFilesByPaths).toHaveBeenCalledWith(["F:/Archive/new.txt"]);
    expect(apiMocks.executeAuthoritativeRulesForPaths).toHaveBeenCalledWith(["F:/Archive/new.txt"]);
    expect(apiMocks.executeAuthoritativeRulesForPaths).not.toHaveBeenCalledWith(["F:/Projects/old.txt"]);
  });

  it("does not re-register the fs-event listener when rules change", async () => {
    const onRefreshData = vi.fn(async () => {});

    renderWatcher({ onRefreshData });
    await flushPromises();

    expect(apiMocks.listen).toHaveBeenCalledTimes(2);
    expect(apiMocks.listen).toHaveBeenCalledWith("fs-event", expect.any(Function));
    expect(apiMocks.listen).toHaveBeenCalledWith("fs-watcher-warning", expect.any(Function));

    renderWatcher({ onRefreshData });
    await flushPromises();

    expect(apiMocks.listen).toHaveBeenCalledTimes(2);
  });

  it("removes a queued upsert when a stale event arrives for the same path", async () => {
    const onRefreshData = vi.fn(async () => {});

    renderWatcher({ onRefreshData });

    const handler = apiMocks.listen.mock.calls[0][1] as (payload: FsWatchEvent) => void;
    handler({ eventType: "created", paths: ["F:/Projects/shared.txt"] });
    handler({ eventType: "deleted", paths: ["F:/Projects/shared.txt"] });

    vi.advanceTimersByTime(500);
    await flushPromises();

    expect(apiMocks.markFilesStaleByPaths).toHaveBeenCalledWith(["F:/Projects/shared.txt"]);
    expect(apiMocks.upsertFilesByPaths).not.toHaveBeenCalled();
  });

  it("deduplicates repeated reconciliation work before canonical classification", async () => {
    const onRefreshData = vi.fn(async () => {});

    renderWatcher({ onRefreshData });
    const handler = apiMocks.listen.mock.calls[0][1] as (payload: FsWatchEvent) => void;
    handler({ eventType: "created", paths: ["F:/Projects/repeated.txt"] });
    handler({ eventType: "modified", paths: ["F:/Projects/repeated.txt"] });

    await vi.advanceTimersByTimeAsync(500);
    await flushPromises();

    expect(apiMocks.upsertFilesByPaths).toHaveBeenCalledTimes(1);
    expect(apiMocks.executeAuthoritativeRulesForPaths).toHaveBeenCalledTimes(1);
  });

  it("rolls back a partial legacy listener group and permits a clean retry", async () => {
    const firstCleanup = vi.fn();
    const onError = vi.fn();
    apiMocks.listen
      .mockResolvedValueOnce(firstCleanup)
      .mockRejectedValueOnce(new Error("warning listener failed"));

    renderWatcher({ onRefreshData: vi.fn(async () => {}), onError });
    await flushPromises();
    await flushPromises();

    expect(firstCleanup).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith("warning listener failed");

    apiMocks.listen.mockReset().mockResolvedValue(() => {});
    renderWatcher({ onRefreshData: vi.fn(async () => {}), onError });
    await flushPromises();
    expect(apiMocks.listen).toHaveBeenCalledTimes(2);
  });

  it("shows watcher partial-index warnings to the user", async () => {
    const onRefreshData = vi.fn(async () => {});
    const onError = vi.fn();

    renderWatcher({ onRefreshData, onError });
    await flushPromises();

    const warningHandler = apiMocks.listen.mock.calls.find(([eventName]) => eventName === "fs-watcher-warning")?.[1] as
      | ((payload: { message: string; path?: string; limit?: number }) => void)
      | undefined;

    expect(warningHandler).toBeTypeOf("function");

    warningHandler?.({
      message: "Watcher deep upsert reached entry limit",
      path: "F:/Large",
      limit: 5000
    });

    expect(onError).toHaveBeenCalledWith("该目录项目过多，仅部分更新，请手动运行完整扫描。");
  });

  it("retries a failed upsert without losing the event", async () => {
    const onRefreshData = vi.fn(async () => {});
    apiMocks.upsertFilesByPaths
      .mockRejectedValueOnce(new Error("temporary upsert failure"))
      .mockResolvedValueOnce(1);

    renderWatcher({ onRefreshData });
    const handler = apiMocks.listen.mock.calls[0][1] as (payload: FsWatchEvent) => void;
    handler({ eventType: "created", paths: ["F:/Projects/retry.txt"] });

    await vi.advanceTimersByTimeAsync(500);
    await flushPromises();
    expect(apiMocks.upsertFilesByPaths).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();
    expect(apiMocks.upsertFilesByPaths).toHaveBeenCalledTimes(2);
    expect(apiMocks.upsertFilesByPaths).toHaveBeenLastCalledWith(["F:/Projects/retry.txt"]);
  });

  it("uses the backend-owned canonical classifier after a successful upsert", async () => {
    const onRefreshData = vi.fn(async () => {});

    renderWatcher({ onRefreshData });
    const handler = apiMocks.listen.mock.calls[0][1] as (payload: FsWatchEvent) => void;
    handler({ eventType: "created", paths: ["F:/Projects/classify.txt"] });

    await vi.advanceTimersByTimeAsync(500);
    await flushPromises();
    expect(apiMocks.upsertFilesByPaths).toHaveBeenCalledTimes(1);
    expect(apiMocks.executeAuthoritativeRulesForPaths).toHaveBeenCalledWith(["F:/Projects/classify.txt"]);
    expect(onRefreshData).toHaveBeenCalledOnce();
  });

  it("fails closed when the canonical watcher classifier rejects", async () => {
    const onRefreshData = vi.fn(async () => {});
    const onError = vi.fn();
    apiMocks.executeAuthoritativeRulesForPaths.mockRejectedValueOnce(new Error("classifier unavailable"));

    renderWatcher({ onRefreshData, onError });
    const handler = apiMocks.listen.mock.calls[0][1] as (payload: FsWatchEvent) => void;
    handler({ eventType: "created", paths: ["F:/Projects/classify-failed.txt"] });

    await vi.advanceTimersByTimeAsync(500);
    await flushPromises();

    expect(apiMocks.executeAuthoritativeRulesForPaths).toHaveBeenCalledWith(["F:/Projects/classify-failed.txt"]);
    expect(onError).toHaveBeenCalled();
  });

  it("does not watch disabled roots or classify events outside the enabled adapter", () => {
    const onRefreshData = vi.fn(async () => {});

    renderWatcher({ enabled: false, onRefreshData });

    expect(apiMocks.listen).not.toHaveBeenCalled();
    expect(apiMocks.upsertFilesByPaths).not.toHaveBeenCalled();
    expect(apiMocks.executeAuthoritativeRulesForPaths).not.toHaveBeenCalled();
  });

  it("cleans the legacy timer and queue before unmount so no mutation starts afterward", async () => {
    const onRefreshData = vi.fn(async () => {});

    renderWatcher({ onRefreshData });
    const handler = apiMocks.listen.mock.calls[0][1] as (payload: FsWatchEvent) => void;
    handler({ eventType: "created", paths: ["F:/Projects/unmounted.txt"] });

    cleanupHookHarness();
    await vi.advanceTimersByTimeAsync(2_000);
    await flushPromises();

    expect(apiMocks.markFilesStaleByPaths).not.toHaveBeenCalled();
    expect(apiMocks.upsertFilesByPaths).not.toHaveBeenCalled();
  });
});

function renderWatcher({
  enabled = true,
  onRefreshData,
  onError
}: {
  enabled?: boolean;
  onRefreshData: () => Promise<void>;
  onError?: (message: string) => void;
}) {
  reactMock.refIndex = 0;
  reactMock.effectIndex = 0;
  useFsWatcher({ enabled, onRefreshData, onError });
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function resetHookHarness() {
  cleanupHookHarness();
  reactMock.refs = [];
  reactMock.effects = [];
  reactMock.refIndex = 0;
  reactMock.effectIndex = 0;
}

function cleanupHookHarness() {
  for (const effect of reactMock.effects) {
    effect.cleanup?.();
  }
  reactMock.effects = [];
}
