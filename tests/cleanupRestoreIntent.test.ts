import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CleanupRestorePreview, CleanupRestoreResult, CleanupTrashItem } from "../src/types/domain";

const api = vi.hoisted(() => ({
  previewRestoreCleanupTrash: vi.fn(),
  restoreCleanupTrashItems: vi.fn(),
  getOperationLogs: vi.fn()
}));

vi.mock("../src/api/tauriApi", () => ({ tauriApi: api }));

import { useFileLibraryStore } from "../src/store/useFileLibraryStore";
import { useOperationQueueStore } from "../src/store/useOperationQueueStore";

function item(id: string, batchId = "batch-1"): CleanupTrashItem {
  return {
    id,
    batchId,
    originalPath: `C:/before/${id}.txt`,
    trashPath: `C:/.zen-canvas-trash/${id}.txt`,
    name: `${id}.txt`,
    size: 1,
    movedAt: "1710000000000",
    restoredAt: null,
    status: "moved",
    message: null
  };
}

function preview(items: CleanupTrashItem[], canRestore = true): CleanupRestorePreview {
  return {
    batchId: items[0]?.batchId ?? "batch-1",
    items: items.map((current) => ({ ...current, canRestore, blockingReason: canRestore ? null : "conflict" }))
  };
}

const successResult: CleanupRestoreResult = {
  restored: 2,
  conflicts: 0,
  missing: 0,
  failed: 0,
  canceled: 0,
  logs: []
};

describe("cleanup restore confirmation intent", () => {
  const first = item("first");
  const second = item("second");

  beforeEach(() => {
    api.previewRestoreCleanupTrash.mockReset();
    api.restoreCleanupTrashItems.mockReset();
    api.getOperationLogs.mockReset().mockResolvedValue([]);
    useFileLibraryStore.setState({ refresh: vi.fn(async () => undefined) });
    useOperationQueueStore.setState({
      restoreIntent: null,
      cleanupRestoreError: "",
      restoreTechnicalError: "",
      cleanupRestoreResult: null,
      cleanupRestoreProgress: null,
      cleanupRestoreJobId: null,
      lastRestoreSummary: null
    });
  });

  it("fails closed when a related batch preview rejects", async () => {
    api.previewRestoreCleanupTrash.mockRejectedValue(new Error("preview offline"));
    const intent = await useOperationQueueStore.getState().prepareCleanupRestoreIntent([first]);
    expect(intent).toBeNull();
    expect(useOperationQueueStore.getState().restoreIntent).toBeNull();
    expect(useOperationQueueStore.getState().cleanupRestoreError).toBeTruthy();
    expect(useOperationQueueStore.getState().restoreTechnicalError).toContain("preview offline");
  });

  it("keeps missing item ids excluded while allowing the verified intersection", async () => {
    api.previewRestoreCleanupTrash.mockResolvedValue(preview([first]));
    const intent = await useOperationQueueStore.getState().prepareCleanupRestoreIntent([first, second]);
    expect(intent?.allowedIds).toEqual(new Set([first.id]));
    expect(intent?.selectedCount).toBe(2);
    expect(intent?.excludedCount).toBe(1);
    expect(intent?.reasonCounts).toEqual({ unavailable: 1 });
  });

  it("re-previews on confirm and creates a new revision when authority changes", async () => {
    api.previewRestoreCleanupTrash.mockResolvedValueOnce(preview([first, second]));
    const intent = await useOperationQueueStore.getState().prepareCleanupRestoreIntent([first, second]);
    expect(intent).not.toBeNull();
    api.previewRestoreCleanupTrash.mockResolvedValueOnce(preview([first, second], false));
    const result = await useOperationQueueStore.getState().confirmCleanupRestore(intent!.sessionId);
    expect(result.status).toBe("stale");
    expect(api.restoreCleanupTrashItems).not.toHaveBeenCalled();
    expect(useOperationQueueStore.getState().restoreIntent?.revision).toBe(2);
  });

  it("deduplicates selected ids, accepts reordered backend preview, and clears used intent after success", async () => {
    api.previewRestoreCleanupTrash.mockResolvedValueOnce(preview([second, first]));
    const intent = await useOperationQueueStore.getState().prepareCleanupRestoreIntent([first, second, first]);
    expect(intent?.selectedIds).toEqual(new Set([first.id, second.id]));
    api.previewRestoreCleanupTrash.mockResolvedValueOnce(preview([first, second]));
    api.restoreCleanupTrashItems.mockResolvedValue(successResult);
    const result = await useOperationQueueStore.getState().confirmCleanupRestore(intent!.sessionId);
    expect(result.status).toBe("executed");
    expect(api.restoreCleanupTrashItems).toHaveBeenCalledWith([first.id, second.id], expect.any(String));
    expect(useOperationQueueStore.getState().restoreIntent).toBeNull();
  });
});
