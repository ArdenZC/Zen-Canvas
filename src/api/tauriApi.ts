import { invoke } from "@tauri-apps/api/core";
import { listen, type Event, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  AIConnectionTestResult,
  AIClassificationProgressPayload,
  AIDebugClassificationResult,
  AIModelInfo,
  AIRequestTrace,
  AIProviderPreset,
  AISettings,
  AddManagedScopeRequest,
  AiManagementStatus,
  ClassificationCorrectionRequest,
  CleanupRestoreProgressPayload,
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
  GlobalIndexSource,
  GlobalIndexStatus,
  GlobalSearchResult,
  LibraryScope,
  ManagedScope,
  OperationLog,
  OperationPreview,
  OperationPreviewResult,
  RestoreMovesResult,
  RuntimeCapabilities,
  Rule,
  RuleExecutionMode,
  RuleExecutionSummary,
  SaveSettingsRequest,
  StorageAnalysis,
  StorageCandidate,
  StorageCleanupCompleted,
  StorageCleanupJobMessage,
  StorageCleanupProgress,
  StorageCleanupScanStatus,
  VersionedAppSettings,
  UpdateManagedScopePolicyRequest
} from "../types/domain";
import { rejectUnavailableFileMutation } from "../utils/fileMutationCapability";
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

export interface ManagedScanRequest {
  roots: string[];
  requestKey?: string | null;
  dedupe: boolean;
}

export interface ScanRootDto {
  id: string;
  normalizedPath: string;
  displayName: string;
  sourceKind: string;
  enabled: boolean;
  healthStatus: string;
  currentGeneration: number;
  activeRunId: string | null;
  activeGeneration: number | null;
  revision: number;
  lastSuccessfulGeneration: number | null;
  lastFullScanAt: number | null;
  needsReconciliation: boolean;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ScanSessionRootDto {
  sessionId: string;
  requestedIndex: number;
  requestedPath: string;
  normalizedRequestedPath: string;
  resolution: string;
  effectiveRootId: string | null;
  effectivePath: string | null;
  effectiveIndex: number | null;
  runId: string | null;
  status: string;
  reason: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ScanRunDto {
  id: string;
  scanRootId: string;
  rootPath: string;
  generation: number;
  parentSessionId: string | null;
  status: string;
  phase: string;
  scannedFiles: number;
  scannedDirectories: number;
  processedBytes: number;
  warningsCount: number;
  errorsCount: number;
  metadataErrorCount: number;
  coverageErrorCount: number;
  coverageComplete: boolean;
  staleReconciliationAllowed: boolean;
  cancelRequested: boolean;
  revision: number;
  sessionRevision: number;
  startedAt: number | null;
  finishedAt: number | null;
  lastCheckpointAt: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  resultJson: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ScanSessionDto {
  id: string;
  requestKey: string | null;
  canonicalRequestHash: string | null;
  status: string;
  phase: string;
  cancelRequested: boolean;
  requestedRootCount: number;
  effectiveRootCount: number;
  completedRootCount: number;
  failedRootCount: number;
  cancelledRootCount: number;
  coveredRootCount: number;
  unstartedRootCount: number;
  dedupeRequested: boolean;
  dedupeDispatchState: string;
  dedupeAttemptCount: number;
  dedupeJobId: string | null;
  dedupeLastError: string | null;
  scannedFiles: number;
  scannedDirectories: number;
  warningsCount: number;
  errorsCount: number;
  revision: number;
  startedAt: number | null;
  finishedAt: number | null;
  lastCheckpointAt: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  resultJson: string | null;
  createdAt: number;
  updatedAt: number;
  roots: ScanSessionRootDto[];
}

export interface ManagedScanStartDto {
  session: ScanSessionDto;
  runs: ScanRunDto[];
}

export interface ManagedScanSnapshotDto {
  session: ScanSessionDto;
  runs: ScanRunDto[];
}

export interface ManagedScanEvent {
  eventId: string;
  runId: string;
  scanRootId: string;
  parentSessionId: string | null;
  generation: number;
  runRevision: number;
  sessionRevision: number;
  status: string;
  runPhase: string;
  sessionPhase: string;
  scannedFiles: number;
  scannedDirectories: number;
  processedBytes: number;
  warningsCount: number;
  errorsCount: number;
  currentPath: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  timestamp: number;
}

export interface DedupeProgressPayload {
  dedupeJobId: string;
  parentScanJobId: string | null;
  processed: number;
  total: number;
  status: "running";
}

export interface DedupeCompletePayload {
  dedupeJobId: string;
  parentScanJobId: string | null;
  status: "completed" | "cancelled" | "failed";
  success: boolean;
  error: string | null;
}

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

  searchGlobalEntries(query: string, limit = 80, offset = 0): Promise<GlobalSearchResult[]> {
    return invokeCommand<GlobalSearchResult[]>("search_global_entries", { query, limit, offset });
  },

  getGlobalIndexStatus(): Promise<GlobalIndexStatus> {
    return invokeCommand<GlobalIndexStatus>("get_global_index_status");
  },

  listGlobalIndexSources(): Promise<GlobalIndexSource[]> {
    return invokeCommand<GlobalIndexSource[]>("list_global_index_sources");
  },

  startGlobalIndex(): Promise<void> {
    return invokeCommand<void>("start_global_index");
  },

  pauseGlobalIndex(): Promise<void> {
    return invokeCommand<void>("pause_global_index");
  },

  resumeGlobalIndex(): Promise<void> {
    return invokeCommand<void>("resume_global_index");
  },

  rebuildGlobalIndexSource(sourceId?: string): Promise<void> {
    return invokeCommand<void>("rebuild_global_index_source", { sourceId: sourceId ?? null });
  },

  setGlobalIndexSourceEnabled(sourceId: string, enabled: boolean): Promise<void> {
    return invokeCommand<void>("set_global_index_source_enabled", { sourceId, enabled });
  },

  openGlobalSearchResult(entryId: string): Promise<void> {
    return invokeCommand<void>("open_global_search_result", { entryId });
  },

  revealGlobalSearchResult(entryId: string): Promise<void> {
    return invokeCommand<void>("reveal_global_search_result", { entryId });
  },

  listManagedScopes(): Promise<ManagedScope[]> {
    return invokeCommand<ManagedScope[]>("list_managed_scopes");
  },

  addManagedScope(request: AddManagedScopeRequest): Promise<ManagedScope> {
    return invokeCommand<ManagedScope>("add_managed_scope", { request });
  },

  removeManagedScope(id: string): Promise<boolean> {
    return invokeCommand<boolean>("remove_managed_scope", { id });
  },

  updateManagedScopePolicy(request: UpdateManagedScopePolicyRequest): Promise<ManagedScope> {
    return invokeCommand<ManagedScope>("update_managed_scope_policy", { request });
  },

  getAiManagementStatus(): Promise<AiManagementStatus> {
    return invokeCommand<AiManagementStatus>("get_ai_management_status");
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

  startManagedScan(request: ManagedScanRequest): Promise<ManagedScanStartDto> {
    return invokeCommand<ManagedScanStartDto>("start_managed_scan", { request });
  },

  getManagedScanSnapshot(sessionId: string): Promise<ManagedScanSnapshotDto> {
    return invokeCommand<ManagedScanSnapshotDto>("get_managed_scan_snapshot", { sessionId });
  },

  cancelScanRun(runId: string): Promise<ScanRunDto> {
    return invokeCommand<ScanRunDto>("cancel_scan_run", { runId });
  },

  getScanRun(runId: string): Promise<ScanRunDto> {
    return invokeCommand<ScanRunDto>("get_scan_run", { runId });
  },

  listScanRuns(sessionId?: string, rootId?: string, limit = 100): Promise<ScanRunDto[]> {
    return invokeCommand<ScanRunDto[]>("list_scan_runs", {
      sessionId: sessionId ?? null,
      rootId: rootId ?? null,
      limit
    });
  },

  listScanRoots(): Promise<ScanRootDto[]> {
    return invokeCommand<ScanRootDto[]>("list_scan_roots");
  },

  getScanRootHealth(rootId?: string, path?: string): Promise<ScanRootDto> {
    return invokeCommand<ScanRootDto>("get_scan_root_health", {
      rootId: rootId ?? null,
      path: path ?? null
    });
  },

  retryInterruptedScan(runId: string): Promise<ManagedScanStartDto> {
    return invokeCommand<ManagedScanStartDto>("retry_interrupted_scan", { runId });
  },

  createScanJobId(jobKind: "foreground" | "background"): Promise<string> {
    return invokeCommand<string>("create_scan_job_id", { jobKind });
  },

  cancelScan(jobId: string): Promise<void> {
    return invokeCommand<void>("cancel_scan", { jobId });
  },

  cancelDedupe(jobId: string): Promise<void> {
    return invokeCommand<void>("cancel_dedupe", { jobId });
  },

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
    const unavailable = rejectUnavailableFileMutation<CleanupExecutionResult>();
    if (unavailable) return unavailable;
    return invokeCommand<CleanupExecutionResult>("move_cleanup_candidates_to_trash", { jobId, ids });
  },

  moveCleanupCandidatesToSafeTrash(jobId: string, ids: string[]): Promise<CleanupExecutionResult> {
    const unavailable = rejectUnavailableFileMutation<CleanupExecutionResult>();
    if (unavailable) return unavailable;
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

  restoreCleanupTrashItems(itemIds: string[], jobId?: string): Promise<CleanupRestoreResult> {
    const unavailable = rejectUnavailableFileMutation<CleanupRestoreResult>();
    if (unavailable) return unavailable;
    return invokeCommand<CleanupRestoreResult>("restore_cleanup_trash_items", { itemIds, jobId: jobId ?? null });
  },

  cancelCleanupRestore(jobId: string): Promise<void> {
    return invokeCommand<void>("cancel_cleanup_restore", { jobId });
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

  getSettings(): Promise<VersionedAppSettings> {
    return invokeCommand<VersionedAppSettings>("get_settings");
  },

  saveSettings(request: SaveSettingsRequest): Promise<VersionedAppSettings> {
    return invokeCommand<VersionedAppSettings>("save_settings", { request });
  },

  getAISettings(): Promise<AISettings> {
    return invokeCommand<AISettings>("get_ai_settings");
  },

  getRuntimeCapabilities(): Promise<RuntimeCapabilities> {
    return invokeCommand<RuntimeCapabilities>("get_runtime_capabilities");
  },

  saveAISettings(settings: AISettings): Promise<AISettings> {
    return invokeCommand<AISettings>("save_ai_settings", { settings });
  },

  listAIProviderPresets(): Promise<AIProviderPreset[]> {
    return invokeCommand<AIProviderPreset[]>("list_ai_provider_presets");
  },

  listAIModels(settings?: AISettings): Promise<AIModelInfo[]> {
    return invokeCommand<AIModelInfo[]>("list_ai_models", { settings: settings ?? null });
  },

  testAIProviderConnection(settings?: AISettings): Promise<AIConnectionTestResult> {
    return invokeCommand<AIConnectionTestResult>("test_ai_provider_connection", { settings: settings ?? null });
  },

  listAIRequestTraces(): Promise<AIRequestTrace[]> {
    return invokeCommand<AIRequestTrace[]>("list_ai_request_traces");
  },

  clearAIRequestTraces(): Promise<void> {
    return invokeCommand<void>("clear_ai_request_traces");
  },

  exportAIRequestTraces(): Promise<string> {
    return invokeCommand<string>("export_ai_request_traces");
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

  onManagedScanEvent(handler: EventHandler<ManagedScanEvent>): Promise<UnlistenFn> {
    return listenTo("scan-run-updated", handler);
  },

  onDedupeProgress(handler: EventHandler<DedupeProgressPayload>): Promise<UnlistenFn> {
    return listenTo("dedupe-progress", handler);
  },

  onDedupeComplete(handler: EventHandler<DedupeCompletePayload>): Promise<UnlistenFn> {
    return listenTo("dedupe-complete", handler);
  },

  onOperationProgress(handler: EventHandler<OperationProgressPayload>): Promise<UnlistenFn> {
    return listenTo("operation-progress", handler);
  },

  onCleanupRestoreProgress(handler: EventHandler<CleanupRestoreProgressPayload>): Promise<UnlistenFn> {
    return listenTo("cleanup-restore-progress", handler);
  },

  onSearchNavigate(handler: EventHandler<SearchNavigatePayload>): Promise<UnlistenFn> {
    return listenTo("search-navigate", handler);
  },

  onGlobalSearchRequested(handler: EventHandler<null>): Promise<UnlistenFn> {
    return listenTo("global-search-requested", handler);
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
