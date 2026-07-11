import { invoke } from "@tauri-apps/api/core";
import { listen, type Event, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  AIConnectionTestResult,
  AIClassificationProgressPayload,
  AIDebugClassificationResult,
  AIProviderPreset,
  AISettings,
  AppSettings,
  ClassificationCorrectionRequest,
  CleanupRestorePreview,
  CleanupRestoreResult,
  CleanupTrashBatch,
  CleanupExecutionResult,
  CleanupPreviewItem,
  DashboardStats,
  ExecuteOperationRequest,
  ExecuteOperationResult,
  FileLibraryFilters,
  FileQueryResult,
  FileRecord,
  LibraryScope,
  OperationLog,
  OperationPreview,
  OperationPreviewResult,
  RestoreMovesResult,
  Rule,
  RuleExecutionMode,
  RuleExecutionSummary,
  StorageAnalysis,
  StorageCandidate,
  StorageCleanupCompleted,
  StorageCleanupJobMessage,
  StorageCleanupProgress,
  StorageCleanupScanStatus
} from "../types/domain";
import type { View } from "../types/ui";
import type { SearchNavigatePayload } from "../utils/searchNavigation";
import { isBrowserMockEnabled, mockInvokeCommand } from "./browserMockApi";

export interface ScannedEntry {
  path: string;
  name: string;
  extension: string;
  size: number;
  mtime: number;
  isDir: boolean;
  stateCode: number;
}

export interface ScanProgressPayload {
  jobId: string;
  jobKind: "foreground" | "background";
  root: string;
  scanned: number;
  files: number;
  directories: number;
  skipped: number;
  errors: number;
  elapsedMs: number;
}

export interface ScanBatchPayload {
  jobId: string;
  jobKind: "foreground" | "background";
  root: string;
  batchIndex: number;
  entries: ScannedEntry[];
  progress: ScanProgressPayload;
}

export type ScanSummary = ScanProgressPayload;

export interface OperationProgressPayload {
  kind: "execute" | "restore";
  batchId: string;
  processed: number;
  total: number;
  currentPath: string;
}

export interface GlobalHotkeyErrorPayload {
  message: string;
}

export interface GlobalHotkeyStatus {
  accelerator: string;
  registered: boolean;
  error: string | null;
}

export interface TauriSearchFileResult {
  id: string;
  path: string;
  name: string;
  extension: string;
  size: number;
  mtime: number;
  isDir: boolean;
  stateCode: number;
  rank: number;
}

type EventHandler<T> = (payload: T, event: Event<T>) => void;

async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    if (isBrowserMockEnabled()) {
      return mockInvokeCommand<T>(command, args);
    }
    throw error;
  }
}

async function listenTo<T>(eventName: string, handler: EventHandler<T>): Promise<UnlistenFn> {
  try {
    return await listen<T>(eventName, (event) => handler(event.payload, event));
  } catch (error) {
    if (isBrowserMockEnabled()) {
      return () => undefined;
    }
    throw error;
  }
}

export const tauriApi = {
  getPagedFiles(
    limit = 50,
    offset = 0,
    query?: string,
    scope?: LibraryScope,
    filters?: FileLibraryFilters
  ): Promise<FileQueryResult> {
    const normalizedQuery = query?.trim();
    return invokeCommand<FileQueryResult>("get_paged_files", {
      limit,
      offset,
      query: normalizedQuery ? normalizedQuery : null,
      scope: scope ?? null,
      filter: filters ?? null
    });
  },

  getStatsSummary(scope?: LibraryScope): Promise<DashboardStats> {
    return invokeCommand<DashboardStats>("get_stats_summary", { scope: scope ?? null });
  },

  searchFiles(query: string, limit = 12, scope?: LibraryScope): Promise<FileRecord[]> {
    return invokeCommand<FileRecord[]>("search_files", { query, limit, scope: scope ?? null });
  },

  startScan(
    path: string,
    includeEntries = false,
    jobId: string,
    jobKind: "foreground" | "background",
    runDedupe = true
  ): Promise<ScanSummary> {
    return invokeCommand<ScanSummary>("scan_directory", { path, includeEntries, jobId, jobKind, runDedupe });
  },

  cancelScan(jobId: string): Promise<void> {
    return invokeCommand<void>("cancel_scan", { jobId });
  },

  executeMoves(operations: OperationPreview[]): Promise<ExecuteOperationResult> {
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
    return invokeCommand<RestoreMovesResult>("restore_moves", {
      request: { logIds: logs.map((log) => log.id) }
    });
  },

  cancelOperations(): Promise<void> {
    return invokeCommand<void>("cancel_operations");
  },

  getOperationLogs(limit = 500): Promise<OperationLog[]> {
    return invokeCommand<OperationLog[]>("get_operation_logs", { limit });
  },

  getOperationPreviewsForScope(
    scope: LibraryScope,
    filters?: FileLibraryFilters,
    limit?: number,
    offset?: number
  ): Promise<OperationPreviewResult> {
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

  previewCleanupCandidates(jobId: string, ids: string[]): Promise<CleanupPreviewItem[]> {
    return invokeCommand<CleanupPreviewItem[]>("preview_cleanup_candidates", { jobId, ids });
  },

  previewCleanupOperations(jobId: string, ids: string[]): Promise<OperationPreviewResult> {
    return invokeCommand<OperationPreviewResult>("preview_cleanup_operations", { jobId, ids });
  },

  moveCleanupCandidatesToTrash(jobId: string, ids: string[]): Promise<CleanupExecutionResult> {
    return invokeCommand<CleanupExecutionResult>("move_cleanup_candidates_to_trash", { jobId, ids });
  },

  moveCleanupCandidatesToSafeTrash(jobId: string, ids: string[]): Promise<CleanupExecutionResult> {
    return invokeCommand<CleanupExecutionResult>("move_cleanup_candidates_to_safe_trash", { jobId, ids });
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

  restoreCleanupTrashItems(itemIds: string[]): Promise<CleanupRestoreResult> {
    return invokeCommand<CleanupRestoreResult>("restore_cleanup_trash_items", { itemIds });
  },

  executeRulesOnInbox(rules: Rule[]): Promise<RuleExecutionSummary> {
    return invokeCommand<RuleExecutionSummary>("execute_rules_on_inbox", { rules });
  },

  executeRulesForPaths(paths: string[], rules: Rule[]): Promise<RuleExecutionSummary> {
    return invokeCommand<RuleExecutionSummary>("execute_rules_for_paths", { paths, rules });
  },

  executeRulesForScope(
    scope: LibraryScope,
    rules: Rule[],
    mode: RuleExecutionMode = "inbox_only"
  ): Promise<RuleExecutionSummary> {
    return invokeCommand<RuleExecutionSummary>("execute_rules_for_scope", { scope, rules, mode });
  },

  classifyFilesWithAI(
    scope: LibraryScope,
  options?: {
    pendingOnly?: boolean;
    onlyUnclassified?: boolean;
    onlyLowConfidence?: boolean;
    limit?: number;
    force?: boolean;
    allowOverwriteUserCorrections?: boolean;
  }
): Promise<RuleExecutionSummary> {
    return invokeCommand<RuleExecutionSummary>("classify_files_with_ai", { scope, options: options ?? null });
  },

  classifySelectedFilesWithAI(fileIds: string[]): Promise<RuleExecutionSummary> {
    return invokeCommand<RuleExecutionSummary>("classify_selected_files_with_ai", { fileIds });
  },

  cancelAIClassification(): Promise<void> {
    return invokeCommand<void>("cancel_ai_classification");
  },

  confirmClassification(fileId: string): Promise<void> {
    return invokeCommand<void>("confirm_classification", { fileId });
  },

  correctClassification(fileId: string, correction: ClassificationCorrectionRequest): Promise<void> {
    return invokeCommand<void>("correct_classification", { fileId, correction });
  },

  getUserRules(): Promise<Rule[]> {
    return invokeCommand<Rule[]>("get_user_rules");
  },

  saveUserRule(rule: Rule): Promise<Rule> {
    return invokeCommand<Rule>("save_user_rule", { rule });
  },

  deleteUserRule(id: string): Promise<boolean> {
    return invokeCommand<boolean>("delete_user_rule", { id });
  },

  getSettings(): Promise<AppSettings> {
    return invokeCommand<AppSettings>("get_settings");
  },

  saveSettings(settings: AppSettings): Promise<AppSettings> {
    return invokeCommand<AppSettings>("save_settings", { settings });
  },

  getAISettings(): Promise<AISettings> {
    return invokeCommand<AISettings>("get_ai_settings");
  },

  saveAISettings(settings: AISettings): Promise<AISettings> {
    return invokeCommand<AISettings>("save_ai_settings", { settings });
  },

  listAIProviderPresets(): Promise<AIProviderPreset[]> {
    return invokeCommand<AIProviderPreset[]>("list_ai_provider_presets");
  },

  testAIProviderConnection(settings?: AISettings): Promise<AIConnectionTestResult> {
    return invokeCommand<AIConnectionTestResult>("test_ai_provider_connection", { settings: settings ?? null });
  },

  debugAIClassificationOnce(target: string): Promise<AIDebugClassificationResult> {
    return invokeCommand<AIDebugClassificationResult>("debug_ai_classification_once", { target });
  },

  getGlobalHotkeyStatus(): Promise<GlobalHotkeyStatus | null> {
    return invokeCommand<GlobalHotkeyStatus | null>("get_global_hotkey_status");
  },

  registerGlobalSearchHotkey(accelerator: string): Promise<GlobalHotkeyStatus> {
    return invokeCommand<GlobalHotkeyStatus>("register_global_search_hotkey", { accelerator });
  },

  quitApp(): Promise<void> {
    return invokeCommand<void>("quit_app");
  },

  activateSearchResult(view: View, fileId: string | null): Promise<void> {
    return invokeCommand<void>("activate_search_result", { view, fileId });
  },

  resizeSearchWindow(expanded: boolean): Promise<void> {
    return invokeCommand<void>("resize_search_window", { expanded });
  },

  initDatabase(): Promise<void> {
    return invokeCommand<void>("init_db");
  },

  insertFile(file: Pick<FileRecord, "id" | "path" | "name" | "extension" | "size"> & {
    mtime: number;
    isDir: boolean;
    stateCode: number;
  }): Promise<void> {
    return invokeCommand<void>("insert_file", { file });
  },

  removeFilesByPaths(paths: string[]): Promise<number> {
    return invokeCommand<number>("remove_files_by_paths", { paths });
  },

  // Backed by the legacy remove_files_by_paths command; the backend now marks
  // records stale instead of deleting index rows.
  markFilesStaleByPaths(paths: string[]): Promise<number> {
    return invokeCommand<number>("remove_files_by_paths", { paths });
  },

  upsertFilesByPaths(paths: string[]): Promise<number> {
    return invokeCommand<number>("upsert_files_by_paths", { paths });
  },

  onScanProgress(handler: EventHandler<ScanProgressPayload>): Promise<UnlistenFn> {
    return listenTo("scan-progress", handler);
  },

  onScanBatch(handler: EventHandler<ScanBatchPayload>): Promise<UnlistenFn> {
    return listenTo("scan-batch", handler);
  },

  onScanComplete(handler: EventHandler<ScanSummary>): Promise<UnlistenFn> {
    return listenTo("scan-complete", handler);
  },

  onScanCanceled(handler: EventHandler<ScanSummary>): Promise<UnlistenFn> {
    return listenTo("scan-canceled", handler);
  },

  onScanError(handler: EventHandler<{ jobId: string; jobKind: "foreground" | "background"; root: string; path: string; message: string }>): Promise<UnlistenFn> {
    return listenTo("scan-error", handler);
  },

  onOperationProgress(handler: EventHandler<OperationProgressPayload>): Promise<UnlistenFn> {
    return listenTo("operation-progress", handler);
  },

  onSearchNavigate(handler: EventHandler<SearchNavigatePayload>): Promise<UnlistenFn> {
    return listenTo("search-navigate", handler);
  },

  onGlobalHotkeyRegistrationFailed(handler: EventHandler<GlobalHotkeyErrorPayload>): Promise<UnlistenFn> {
    return listenTo("global-hotkey-registration-failed", handler);
  },

  onFsEvent<T>(handler: EventHandler<T>): Promise<UnlistenFn> {
    return listenTo("fs-event", handler);
  },

  onFsWatcherWarning<T>(handler: EventHandler<T>): Promise<UnlistenFn> {
    return listenTo("fs-watcher-warning", handler);
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
  },

  onAIClassificationProgress(handler: EventHandler<AIClassificationProgressPayload>): Promise<UnlistenFn> {
    return listenTo("ai-classification-progress", handler);
  }
};

export type TauriApi = typeof tauriApi;
