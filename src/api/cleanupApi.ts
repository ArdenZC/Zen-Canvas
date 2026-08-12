import { invokeCommand, listenTo, type EventHandler } from "./core";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type {
  CleanupExecutionResult,
  CleanupFindingSelection,
  CleanupPreviewItem,
  CleanupRestorePreview,
  CleanupRestoreResult,
  CleanupTrashBatch,
  StorageAnalysis,
  StorageCandidate,
  StorageCleanupCompleted,
  StorageCleanupJobMessage,
  StorageCleanupProgress,
  StorageCleanupScanStatus
} from "../types/domain";
import { rejectUnavailableFileMutation } from "../utils/fileMutationCapability";

export const cleanupApi = {
  startStorageCleanupScan(roots: string[]): Promise<string> {
    return invokeCommand<string>("start_storage_cleanup_scan", { roots });
  },
  getStorageCleanupScanStatus(jobId: string): Promise<StorageCleanupScanStatus> {
    return invokeCommand<StorageCleanupScanStatus>("get_storage_cleanup_scan_status", { jobId });
  },
  getStorageCleanupCandidatePage(jobId: string, offset: number, limit = 200): Promise<StorageAnalysis> {
    return invokeCommand<StorageAnalysis>("get_storage_cleanup_candidate_page", { jobId, offset, limit });
  },
  cancelStorageCleanupScan(jobId: string): Promise<void> {
    return invokeCommand<void>("cancel_storage_cleanup_scan", { jobId });
  },
  revealStorageCandidate(path: string): Promise<void> {
    return invokeCommand<void>("reveal_storage_candidate", { path });
  },
  previewCleanupCandidates(jobId: string, selections: CleanupFindingSelection[]): Promise<CleanupPreviewItem[]> {
    return invokeCommand<CleanupPreviewItem[]>("preview_cleanup_candidates", { jobId, selections });
  },
  previewCleanupOperations(jobId: string, selections: CleanupFindingSelection[]) {
    return invokeCommand<import("../types/domain").OperationPreviewResult>("preview_cleanup_operations", { jobId, selections });
  },
  moveCleanupCandidatesToSafeTrash(jobId: string, selections: CleanupFindingSelection[]): Promise<CleanupExecutionResult> {
    const unavailable = rejectUnavailableFileMutation<CleanupExecutionResult>();
    if (unavailable) return unavailable;
    return invokeCommand<CleanupExecutionResult>("move_cleanup_candidates_to_safe_trash", { jobId, selections });
  },
  analyzeCleanupCandidatesWithAI(jobId: string, ids: string[]): Promise<StorageCandidate[]> {
    return invokeCommand<StorageCandidate[]>("analyze_cleanup_candidates_with_ai", { jobId, ids });
  },
  listCleanupTrashBatches(): Promise<CleanupTrashBatch[]> {
    return invokeCommand<CleanupTrashBatch[]>("list_cleanup_trash_batches");
  },
  previewRestoreCleanupTrash(batchId: string): Promise<CleanupRestorePreview> {
    return invokeCommand<CleanupRestorePreview>("preview_restore_cleanup_trash", { batchId });
  },
  restoreCleanupTrashItems(itemIds: string[], jobId?: string): Promise<CleanupRestoreResult> {
    const unavailable = rejectUnavailableFileMutation<CleanupRestoreResult>();
    if (unavailable) return unavailable;
    return invokeCommand<CleanupRestoreResult>("restore_cleanup_trash_items", { itemIds, jobId: jobId ?? null });
  },
  cancelCleanupRestore(jobId: string): Promise<void> {
    return invokeCommand<void>("cancel_cleanup_restore", { jobId });
  },
  onCleanupRestoreProgress(handler: EventHandler<import("../types/domain").CleanupRestoreProgressPayload>): Promise<UnlistenFn> {
    return listenTo("cleanup-restore-progress", handler);
  },
  onStorageCleanupProgress(handler: EventHandler<StorageCleanupProgress>): Promise<UnlistenFn> {
    return listenTo("storage-cleanup-progress", handler);
  },
  onStorageCleanupCompleted(handler: EventHandler<StorageCleanupCompleted>): Promise<UnlistenFn> {
    return listenTo("storage-cleanup-completed", handler);
  },
  onStorageCleanupFailed(handler: EventHandler<StorageCleanupJobMessage>): Promise<UnlistenFn> {
    return listenTo("storage-cleanup-failed", handler);
  },
  onStorageCleanupCancelled(handler: EventHandler<StorageCleanupJobMessage>): Promise<UnlistenFn> {
    return listenTo("storage-cleanup-cancelled", handler);
  }
};

export type CleanupApi = typeof cleanupApi;
