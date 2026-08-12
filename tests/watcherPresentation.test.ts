import { describe, expect, it } from "vitest";
import { deriveWatcherPresentation, summarizeWatcherHealth, watcherHealthAttentionCount } from "../src/utils/watcherPresentation";

describe("watcher presentation authority", () => {
  it("keeps the safety and coverage priority stable", () => {
    expect(deriveWatcherPresentation({ healthStatus: "permission_required", needsReconciliation: true }).state).toBe("permission_required");
    expect(deriveWatcherPresentation({ healthStatus: "reconciliation_required", lastErrorCode: "watcher_retry_exhausted" }).state).toBe("retry_exhausted");
    expect(deriveWatcherPresentation({ healthStatus: "degraded", needsReconciliation: true, activeRunId: "scan-1" }).state).toBe("partial");
    expect(deriveWatcherPresentation({ healthStatus: "reconciliation_required", activeRunId: "scan-1" }).state).toBe("reconciliation_required");
    expect(deriveWatcherPresentation({ pending: true, activeRunId: "scan-1" }).state).toBe("scanning");
    expect(deriveWatcherPresentation({ healthStatus: "healthy", watcherRevision: 4, watcherAppliedRevision: 3 }).state).toBe("scanning");
    expect(deriveWatcherPresentation({ healthStatus: "stale" }).state).toBe("stale");
    expect(deriveWatcherPresentation({ healthStatus: "healthy", activeRunId: "scan-1" }).state).toBe("scanning");
    expect(deriveWatcherPresentation({ healthStatus: "healthy" }).state).toBe("healthy");
    expect(deriveWatcherPresentation({ healthStatus: "unknown" }).state).toBe("unknown");
  });

  it("projects mutually exclusive durable counts for Overview", () => {
    expect(summarizeWatcherHealth([
      { healthStatus: "permission_required", needsReconciliation: true },
      { healthStatus: "degraded", needsReconciliation: true },
      { healthStatus: "reconciliation_required", lastErrorCode: "watcher_retry_exhausted" },
      { healthStatus: "stale" },
      { healthStatus: "scanning", activeRunId: "scan-1" }
    ])).toEqual({
      permissionRequired: 1,
      reconciliationRequired: 0,
      partialCoverage: 1,
      retryExhausted: 1,
      stale: 3
    });
  });

  it("counts permission failures with stale coverage without double-counting", () => {
    const permissionOnly = summarizeWatcherHealth([{ healthStatus: "permission_required" }]);
    expect(permissionOnly).toMatchObject({ permissionRequired: 1, stale: 0 });
    expect(watcherHealthAttentionCount(permissionOnly)).toBe(1);

    const reconciliationOnly = summarizeWatcherHealth([{ healthStatus: "reconciliation_required" }]);
    expect(reconciliationOnly).toMatchObject({ permissionRequired: 0, stale: 1 });
    expect(watcherHealthAttentionCount(reconciliationOnly)).toBe(1);

    const mixed = summarizeWatcherHealth([
      { healthStatus: "permission_required" },
      { healthStatus: "partial" }
    ]);
    expect(watcherHealthAttentionCount(mixed)).toBe(2);

    const retryExhausted = summarizeWatcherHealth([{ healthStatus: "retry_exhausted" }]);
    expect(retryExhausted).toMatchObject({ retryExhausted: 1, stale: 1 });
    expect(watcherHealthAttentionCount(retryExhausted)).toBe(1);

    const healthy = summarizeWatcherHealth([{ healthStatus: "healthy" }]);
    expect(watcherHealthAttentionCount(healthy)).toBe(0);
  });
});
