import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFsWatcher } from "../src/hooks/useFsWatcher";

const reactMock = vi.hoisted(() => ({
  refs: [] as Array<{ current: unknown }>,
  effects: [] as Array<{ cleanup?: void | (() => void); deps?: unknown[] }>,
  refIndex: 0,
  effectIndex: 0
}));

const apiMocks = vi.hoisted(() => ({
  getRuntimeCapabilities: vi.fn(),
  onWatcherReconciliationStatus: vi.fn(),
  onFsEvent: vi.fn(),
  onFsWatcherWarning: vi.fn()
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
    reactMock.effects[index] = { deps, cleanup: effect() };
  }
}));

vi.mock("../src/api/tauriApi", () => ({
  tauriApi: {
    getRuntimeCapabilities: apiMocks.getRuntimeCapabilities,
    onWatcherReconciliationStatus: apiMocks.onWatcherReconciliationStatus,
    onFsEvent: apiMocks.onFsEvent,
    onFsWatcherWarning: apiMocks.onFsWatcherWarning
  }
}));

describe("Rust-owned watcher projection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reactMock.refs = [];
    reactMock.effects = [];
    reactMock.refIndex = 0;
    reactMock.effectIndex = 0;
    apiMocks.getRuntimeCapabilities.mockReset().mockResolvedValue({ backendWatcherReconciliation: true });
    apiMocks.onWatcherReconciliationStatus.mockReset().mockResolvedValue(() => {});
    apiMocks.onFsEvent.mockReset().mockResolvedValue(() => {});
    apiMocks.onFsWatcherWarning.mockReset().mockResolvedValue(() => {});
  });

  afterEach(() => {
    reactMock.effects.forEach((entry) => entry.cleanup?.());
    vi.useRealTimers();
  });

  it("does not call renderer mutation RPCs and rejects old root revisions", async () => {
    const refresh = vi.fn(async () => {});
    useFsWatcher({ enabled: true, onRefreshData: refresh });
    await Promise.resolve();
    await Promise.resolve();

    expect(apiMocks.onWatcherReconciliationStatus).toHaveBeenCalledOnce();
    expect(apiMocks.onFsEvent).not.toHaveBeenCalled();

    const handler = apiMocks.onWatcherReconciliationStatus.mock.calls[0][0] as (payload: unknown) => void;
    handler({
      scanRootId: "root-1",
      rootRevision: 4,
      watcherRevision: 2,
      watcherAppliedRevision: 2,
      pending: false,
      needsReconciliation: false,
      healthStatus: "healthy"
    });
    handler({
      scanRootId: "root-1",
      rootRevision: 3,
      watcherRevision: 1,
      watcherAppliedRevision: 1,
      pending: true,
      needsReconciliation: true,
      healthStatus: "reconciliation_required"
    });
    handler({
      scanRootId: "root-1",
      rootRevision: 5,
      watcherRevision: 3,
      watcherAppliedRevision: 2,
      pending: true,
      needsReconciliation: true,
      healthStatus: "reconciliation_required"
    });

    await vi.advanceTimersByTimeAsync(100);
    expect(refresh).toHaveBeenCalledOnce();
  });
});
