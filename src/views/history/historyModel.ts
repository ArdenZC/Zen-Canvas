import type { CleanupTrashBatch, CleanupTrashItem, OperationLog } from "../../types/domain";

/**
 * Restore eligibility is deliberately ordered to mirror the Rust restore
 * command.  The first matching reason is the only reason shown to users.
 * Keeping this in one pure module prevents the list, inspector and store from
 * disagreeing about what the backend can accept.
 */
export type RestoreEligibilityReason =
  | "restorable"
  | "alreadyRestored"
  | "unsupportedOperation"
  | "failedOperation"
  | "pending"
  | "backendBlocked"
  | "unavailable"
  | "missingSource"
  | "restoreFailed"
  | "canceled";

export interface RestoreEligibility {
  executable: boolean;
  reason: RestoreEligibilityReason;
}

export function restoreEligibility(log: OperationLog): RestoreEligibility {
  if (log.operation_type === "move_to_trash") return { executable: false, reason: "unsupportedOperation" };
  if (log.status !== "success") return { executable: false, reason: "failedOperation" };
  if (log.restore_status === "restored") return { executable: false, reason: "alreadyRestored" };
  if (log.restore_status === "pending") return { executable: false, reason: "pending" };
  if (log.restore_status === "unavailable") return { executable: false, reason: "unavailable" };
  if (log.restore_status === "failed") return { executable: false, reason: "restoreFailed" };
  if (log.restore_status === "canceled") return { executable: false, reason: "canceled" };
  if (!log.can_restore) return { executable: false, reason: "backendBlocked" };
  if (!log.path_before || !log.path_after) return { executable: false, reason: "missingSource" };
  return { executable: true, reason: "restorable" };
}

export function isRestorableLog(log: OperationLog) {
  return restoreEligibility(log).executable;
}

export interface RestoreSelectionResolution {
  selectedCount: number;
  executable: OperationLog[];
  executableIds: string[];
  excludedCount: number;
  missingIds: string[];
  reasonCounts: Partial<Record<RestoreEligibilityReason, number>>;
}

export function resolveOperationRestoreSelection(
  logs: readonly OperationLog[],
  selectedIds: ReadonlySet<string> | readonly string[]
): RestoreSelectionResolution {
  const ids = [...new Set(selectedIds instanceof Set ? [...selectedIds] : selectedIds)];
  const byId = new Map(logs.map((log) => [log.id, log]));
  const executable: OperationLog[] = [];
  const reasonCounts: Partial<Record<RestoreEligibilityReason, number>> = {};
  const missingIds: string[] = [];
  for (const id of ids) {
    const log = byId.get(id);
    if (!log) {
      missingIds.push(id);
      reasonCounts.unavailable = (reasonCounts.unavailable ?? 0) + 1;
      continue;
    }
    const eligibility = restoreEligibility(log);
    if (eligibility.executable) executable.push(log);
    else reasonCounts[eligibility.reason] = (reasonCounts[eligibility.reason] ?? 0) + 1;
  }
  return {
    selectedCount: ids.length,
    executable,
    executableIds: executable.map((log) => log.id),
    excludedCount: ids.length - executable.length,
    missingIds,
    reasonCounts
  };
}

export function selectionForOperationBatch(
  current: ReadonlySet<string>,
  logs: readonly OperationLog[],
  select: boolean
) {
  const next = new Set(current);
  for (const log of logs) {
    if (select) {
      if (isRestorableLog(log)) next.add(log.id);
    } else {
      next.delete(log.id);
    }
  }
  return next;
}

export interface OperationHistoryBatch {
  id: string;
  createdAt: string;
  logs: OperationLog[];
  total: number;
  success: number;
  failed: number;
  skipped: number;
  restored: number;
  restorable: number;
  excluded: number;
}

function timeValue(value: string) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function historyTime(value: string) {
  return timeValue(value);
}

export function groupOperationLogs(logs: readonly OperationLog[]): OperationHistoryBatch[] {
  const groups = new Map<string, OperationLog[]>();
  for (const log of logs) {
    // Logs without a backend batch id are each a distinct operation.  Merging
    // them into one synthetic batch loses selection and summary truthfulness.
    const id = log.batch_id || `unbatched-${log.created_at}-${log.id}`;
    const group = groups.get(id) ?? [];
    group.push(log);
    groups.set(id, group);
  }
  return [...groups.entries()]
    .map(([id, entries]) => {
      const batchLogs = [...entries].sort((a, b) => timeValue(b.created_at) - timeValue(a.created_at));
      const excluded = batchLogs.filter((log) => !isRestorableLog(log)).length;
      return {
        id,
        createdAt: batchLogs[0]?.created_at ?? "",
        logs: batchLogs,
        total: batchLogs.length,
        success: batchLogs.filter((log) => log.status === "success").length,
        failed: batchLogs.filter((log) => log.status === "failed").length,
        skipped: batchLogs.filter((log) => log.status === "skipped").length,
        restored: batchLogs.filter((log) => log.restore_status === "restored").length,
        restorable: batchLogs.filter(isRestorableLog).length,
        excluded
      };
    })
    .sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt));
}

export function matchesHistoryFilter(log: OperationLog, query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;
  return [log.id, log.operation_type, log.source_path, log.target_path, log.path_before, log.path_after, log.old_name, log.new_name]
    .some((value) => value.toLocaleLowerCase().includes(normalized));
}

export function filterHistoryBatches(batches: readonly OperationHistoryBatch[], query: string) {
  if (!query.trim()) return [...batches];
  return batches
    .map((batch) => ({ ...batch, logs: batch.logs.filter((log) => matchesHistoryFilter(log, query)) }))
    .filter((batch) => batch.logs.length > 0)
    .map((batch) => ({
      ...batch,
      total: batch.logs.length,
      success: batch.logs.filter((log) => log.status === "success").length,
      failed: batch.logs.filter((log) => log.status === "failed").length,
      skipped: batch.logs.filter((log) => log.status === "skipped").length,
      restored: batch.logs.filter((log) => log.restore_status === "restored").length,
      restorable: batch.logs.filter(isRestorableLog).length,
      excluded: batch.logs.filter((log) => !isRestorableLog(log)).length
    }));
}

export function isRestorableCleanupTrashItem(item: CleanupTrashItem) {
  return item.status === "moved";
}

export function cleanupBatchRestorableCount(batch: CleanupTrashBatch) {
  return batch.items.filter(isRestorableCleanupTrashItem).length;
}

export function groupCleanupBatches(batches: readonly CleanupTrashBatch[]) {
  return [...batches].sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt));
}

export function reasonCountTotal(counts: Partial<Record<RestoreEligibilityReason, number>>) {
  return Object.values(counts).reduce((total, count) => total + (count ?? 0), 0);
}
