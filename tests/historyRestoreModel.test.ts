import { describe, expect, it } from "vitest";
import type { OperationLog } from "../src/types/domain";
import {
  filterHistoryBatches,
  groupOperationLogs,
  isRestorableLog,
  resolveOperationRestoreSelection,
  restoreEligibility,
  selectionForOperationBatch
} from "../src/views/history/historyModel";

function log(id: string, overrides: Partial<OperationLog> = {}): OperationLog {
  return {
    id,
    batch_id: "batch-1",
    operation_type: "move",
    source_path: `C:/before/${id}.txt`,
    target_path: `C:/after/${id}.txt`,
    old_name: `${id}.txt`,
    new_name: `${id}.txt`,
    status: "success",
    error_message: null,
    created_at: "1710000000000",
    can_undo: true,
    path_before: `C:/before/${id}.txt`,
    path_after: `C:/after/${id}.txt`,
    name_before: `${id}.txt`,
    name_after: `${id}.txt`,
    can_restore: true,
    restored_at: null,
    restore_status: "not_restored",
    restore_error: null,
    ...overrides
  };
}

describe("history restore truth model", () => {
  it("uses mutually exclusive reasons matching backend restore gates", () => {
    expect(restoreEligibility(log("ok"))).toEqual({ executable: true, reason: "restorable" });
    expect(restoreEligibility(log("trash", { operation_type: "move_to_trash" })).reason).toBe("unsupportedOperation");
    expect(restoreEligibility(log("failed", { status: "failed" })).reason).toBe("failedOperation");
    expect(restoreEligibility(log("pending", { restore_status: "pending" })).reason).toBe("pending");
    expect(restoreEligibility(log("restored", { restore_status: "restored" })).reason).toBe("alreadyRestored");
    expect(restoreEligibility(log("blocked", { can_restore: false })).reason).toBe("backendBlocked");
    expect(restoreEligibility(log("retry", { restore_status: "failed" })).reason).toBe("restoreFailed");
    expect(isRestorableLog(log("retry", { restore_status: "failed" }))).toBe(false);
  });

  it("intersects selected ids with authoritative records and deduplicates", () => {
    const records = [log("ok"), log("blocked", { can_restore: false }), log("skipped", { status: "skipped" })];
    const result = resolveOperationRestoreSelection(records, ["ok", "ok", "blocked", "missing"]);
    expect(result.executableIds).toEqual(["ok"]);
    expect(result.selectedCount).toBe(3);
    expect(result.excludedCount).toBe(2);
    expect(result.missingIds).toEqual(["missing"]);
    expect(result.reasonCounts).toMatchObject({ backendBlocked: 1, unavailable: 1 });
  });

  it("keeps missing batch ids separate and recalculates filtered summaries", () => {
    const batches = groupOperationLogs([log("a", { batch_id: "" }), log("b", { batch_id: "" }), log("c", { batch_id: "batch-2" })]);
    expect(batches).toHaveLength(3);
    const filtered = filterHistoryBatches(batches, "c.txt");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].total).toBe(1);
  });

  it("selects only executable records and removes all records on deselect", () => {
    const records = [log("ok"), log("blocked", { can_restore: false })];
    const selected = selectionForOperationBatch(new Set(), records, true);
    expect(selected).toEqual(new Set(["ok"]));
    expect(selectionForOperationBatch(new Set(["ok", "blocked"]), records, false)).toEqual(new Set());
  });
});
