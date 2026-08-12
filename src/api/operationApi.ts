import { invokeCommand, listenTo, type EventHandler } from "./core";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type {
  ExecuteOperationRequest,
  ExecuteOperationResult,
  FileLibraryFilters,
  LibraryScope,
  OperationLog,
  OperationPreview,
  OperationPreviewResult,
  RestoreMovesResult
} from "../types/domain";
import { rejectUnavailableFileMutation } from "../utils/fileMutationCapability";
import type { OperationProgressPayload } from "./types";

export const operationApi = {
  executeMoves(operations: OperationPreview[]): Promise<ExecuteOperationResult> {
    const unavailable = rejectUnavailableFileMutation<ExecuteOperationResult>();
    if (unavailable) return unavailable;
    const request: ExecuteOperationRequest = {
      operations: operations.map((operation) => ({
        id: operation.id,
        fileId: operation.fileId,
        ...(operation.new_name !== operation.old_name ? { newName: operation.new_name } : {})
      }))
    };
    return invokeCommand<ExecuteOperationResult>("execute_moves", { request });
  },
  restoreMoves(logs: OperationLog[]): Promise<RestoreMovesResult> {
    const unavailable = rejectUnavailableFileMutation<RestoreMovesResult>();
    if (unavailable) return unavailable;
    return invokeCommand<RestoreMovesResult>("restore_moves", { request: { logIds: logs.map((log) => log.id) } });
  },
  cancelOperations(): Promise<void> {
    return invokeCommand<void>("cancel_operations");
  },
  getOperationLogs(limit = 500): Promise<OperationLog[]> {
    return invokeCommand<OperationLog[]>("get_operation_logs", { limit });
  },
  getOperationPreviewsForScope(scope: LibraryScope, filters?: FileLibraryFilters, limit?: number, offset?: number): Promise<OperationPreviewResult> {
    return invokeCommand<OperationPreviewResult>("get_operation_previews_for_scope", {
      scope,
      filter: filters ?? null,
      limit,
      offset
    });
  },
  revealInFolder(path: string): Promise<void> {
    return invokeCommand<void>("reveal_in_folder", { path });
  },
  onOperationProgress(handler: EventHandler<OperationProgressPayload>): Promise<UnlistenFn> {
    return listenTo("operation-progress", handler);
  }
};

export type OperationApi = typeof operationApi;
