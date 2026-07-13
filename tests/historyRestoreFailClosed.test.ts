import { describe, expect, it } from "vitest";
import type { CleanupRestorePreviewItem, CleanupTrashItem, OperationLog } from "../src/types/domain";
import {
  cleanupRestoreEligibility,
  groupOperationLogs,
  resolveCleanupRestoreSelection,
  resolveHistoryBatchExecutionState,
  resolveHistoryBatchRestoreState,
  resolveHistoryBatchState,
  resolveHistorySummary,
  type CleanupPreviewAuthority
} from "../src/views/history/historyModel";

function cleanupItem(id: string, batchId = "cleanup-batch"): CleanupTrashItem {
  return {
    id,
    batchId,
    originalPath: `C:/original/${id}.txt`,
    trashPath: `C:/.zen-canvas-trash/${id}.txt`,
    name: `${id}.txt`,
    size: 10,
    movedAt: "1710000000000",
    restoredAt: null,
    status: "moved",
    message: null
  };
}

function preview(item: CleanupTrashItem, canRestore = true, blockingReason: string | null = null): CleanupRestorePreviewItem {
  return { ...item, canRestore, blockingReason };
}

function log(id: string, overrides: Partial<OperationLog> = {}): OperationLog {
  return {
    id,
    batch_id: "batch",
    operation_type: "move",
    source_path: `C:/before/${id}.txt`,
    target_path: `C:/after/${id}.txt`,
    old_name: id,
    new_name: id,
    status: "success",
    error_message: null,
    created_at: "1710000000000",
    can_undo: true,
    path_before: `C:/before/${id}.txt`,
    path_after: `C:/after/${id}.txt`,
    name_before: id,
    name_after: id,
    can_restore: true,
    restored_at: null,
    restore_status: "not_restored",
    restore_error: null,
    ...overrides
  };
}

describe("history restore fail-closed authority", () => {
  it("never treats a database moved status as cleanup restore authority", () => {
    const item = cleanupItem("moved");
    expect(cleanupRestoreEligibility()).toEqual({ executable: false, reason: "unavailable" });
    expect(cleanupRestoreEligibility(undefined, "failed")).toEqual({ executable: false, reason: "unavailable" });
    expect(cleanupRestoreEligibility(preview(item))).toEqual({ executable: true, reason: "restorable" });
    expect(cleanupRestoreEligibility(preview(item), "failed")).toEqual({ executable: false, reason: "unavailable" });
  });

  it("keeps failed and missing batch previews unavailable, then updates without reload on retry", () => {
    const ready = cleanupItem("ready", "good");
    const failed = cleanupItem("failed", "bad");
    const authorities = new Map<string, CleanupPreviewAuthority>([
      [ready.id, { state: "ready", preview: preview(ready) }],
      [failed.id, { state: "failed", error: "preview offline" }]
    ]);
    const first = resolveCleanupRestoreSelection([ready, failed], [ready.id, failed.id], authorities);
    expect(first.executableIds).toEqual([ready.id]);
    expect(first.reasonCounts).toEqual({ unavailable: 1 });
    expect(first.excludedCount).toBe(1);

    authorities.set(failed.id, { state: "ready", preview: preview(failed) });
    const retried = resolveCleanupRestoreSelection([ready, failed], [ready.id, failed.id], authorities);
    expect(retried.executableIds).toEqual([ready.id, failed.id]);
    expect(retried.excludedCount).toBe(0);
  });

  it("marks a successful preview with a missing item id as unavailable", () => {
    const item = cleanupItem("missing-from-preview");
    const authorities = new Map<string, CleanupPreviewAuthority>();
    const resolution = resolveCleanupRestoreSelection([item], [item.id], authorities);
    expect(resolution.executableCount).toBe(0);
    expect(resolution.missingIds).toEqual([]);
    expect(resolution.reasonCounts).toEqual({ unavailable: 1 });
  });

  it("keeps original execution and restore states independently visible", () => {
    const mixed = [
      log("restored", { restore_status: "restored" }),
      log("failed", { status: "failed", can_restore: false, restore_status: "failed" })
    ];
    expect(resolveHistoryBatchExecutionState(mixed)).toBe("partial");
    expect(resolveHistoryBatchRestoreState(mixed)).toBe("restore_failed");
    expect(resolveHistoryBatchState(mixed)).toBe("partial");

    const allRestored = [log("one", { restore_status: "restored" }), log("two", { restore_status: "restored" })];
    expect(resolveHistoryBatchRestoreState(allRestored)).toBe("restored");
    expect(resolveHistoryBatchState(allRestored)).toBe("restored");

    const failedOriginal = [log("failed-original", { status: "failed", can_restore: false, restore_status: "failed" })];
    const batch = groupOperationLogs(failedOriginal)[0];
    expect(batch.executionState).toBe("failed");
    expect(batch.restoreState).toBe("restore_failed");
    expect(batch.state).toBe("failed");
  });

  it("does not count failed cleanup previews as restorable or known excluded statistics", () => {
    const item = cleanupItem("preview-failed");
    const authorities = new Map<string, CleanupPreviewAuthority>([[item.id, { state: "failed", error: "offline" }]]);
    const summary = resolveHistorySummary([], [item], [], authorities);
    expect(summary.cleanupRestorable).toBe(0);
    expect(summary.restorable).toBe(0);
    expect(summary.unavailable).toBe(0);
  });
});
