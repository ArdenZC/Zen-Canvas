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
  CleanupFindingSelection,
  CleanupPreviewItem,
  DashboardStats,
  DedupeGroup,
  DedupeGroupMember,
  DedupeGroupPage,
  DedupeRun,
  AnalysisDetector,
  AnalysisDetectorDescriptor,
  AnalysisFinding,
  AnalysisFindingDecision,
  AnalysisFindingEvidence,
  AnalysisFindingPage,
  AnalysisRun,
  AnalysisScopeRequest,
  DedupeAuthority,
  CreateLibrarySavedViewRequest,
  CreateUserTagRequest,
  DeleteLibrarySavedViewRequest,
  DeleteUserTagRequest,
  StartAnalysisRunRequest,
  StartDedupeRunRequest,
  ExecuteOperationRequest,
  ExecuteOperationResult,
  FileLibraryFilters,
  FileLibraryScopeV2,
  FileLibraryDetail,
  FileLibrarySelectionSummary,
  FileQueryRequestV2,
  FileQueryResponseV2,
  ResolveFileLibraryExactCountRequestV2,
  ResolveFileLibraryExactCountResponseV2,
  FileQueryResult,
  FileRecord,
  GlobalIndexSource,
  GlobalIndexStatus,
  GlobalSearchRequest,
  GlobalSearchResponse,
  LibraryScope,
  LibrarySavedView,
  LibrarySelectionV1,
  ManagedScope,
  MutateFileUserTagsRequest,
  MutateFileUserTagsResult,
  OperationLog,
  OperationPreview,
  OperationPreviewResult,
  OrganizationPlan,
  OrganizationPlanDryRun,
  OrganizationPlanGroupItemPage,
  OrganizationPlanGroupPage,
  OrganizationPlanItemPage,
  UpdateOrganizationPlanGroupDecisionResult,
  ExecuteOrganizationPlanResult,
  RestoreMovesResult,
  RuntimeCapabilities,
  Rule,
  RuleCatalogState,
  RuleDraftV2,
  RuleExecutionMode,
  RuleExecutionResultV2,
  RuleExecutionSummary,
  RuleMutationResultV2,
  RuleProposal,
  RuleProposalImpact,
  RuleProposalPage,
  ApplyRuleProposalResult,
  ContentArtifact,
  ContentArtifactPage,
  ContentPreview,
  ContentPreviewRequest,
  ContentRun,
  ContentRunItem,
  ContentScopePolicy,
  SaveSettingsRequest,
  StorageAnalysis,
  StorageCandidate,
  StorageCleanupCompleted,
  StorageCleanupJobMessage,
  StorageCleanupProgress,
  StorageCleanupScanStatus,
  VersionedAppSettings,
  UpdateLibrarySavedViewRequest,
  UpdateUserTagRequest,
  UserTag,
  UpdateManagedScopePolicyRequest
} from "../types/domain";
import { rejectUnavailableFileMutation } from "../utils/fileMutationCapability";
import type { View } from "../types/ui";
import type { SearchNavigatePayload, SearchSettingsTarget } from "../utils/searchNavigation";
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
  watcherRevision: number;
  watcherAppliedRevision: number;
  watcherLastEventAt: number | null;
  watcherLastAppliedAt: number | null;
  watcherLastErrorCode: string | null;
  watcherLastErrorMessage: string | null;
  watcherRuleRecoveryRequired?: boolean;
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
  watcherRevisionAtStart: number;
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

export interface WatcherReconciliationStatus {
  scanRootId: string;
  path: string;
  rootRevision: number;
  watcherRevision: number;
  watcherAppliedRevision: number;
  pending: boolean;
  needsReconciliation: boolean;
  healthStatus: string;
  activeRunId: string | null;
  lastEventAt: number | null;
  lastAppliedAt: number | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  pendingBatch?: number;
  timestamp: number;
}

export interface DedupeProgressPayload {
  dedupeJobId: string;
  parentScanJobId: string | null;
  processed: number;
  total: number;
  status: string;
  phase?: string;
  processedBytes?: number;
  totalBytes?: number;
  revision?: number;
  warningCount?: number;
  errorCount?: number;
}

export interface DedupeCompletePayload {
  dedupeJobId: string;
  parentScanJobId: string | null;
  status: "completed" | "completed_with_warnings" | "cancelled" | "failed" | "interrupted";
  success: boolean;
  error: string | null;
  phase?: string;
  revision?: number;
  processedBytes?: number;
  totalBytes?: number;
  warningCount?: number;
  errorCode?: string | null;
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
  requestedAccelerator: string;
  effectiveAccelerator: string | null;
  registered: boolean;
  error: string | null;
  revision: number;
}

export type SearchWindowPhase =
  | "hidden"
  | "showing"
  | "visible_collapsed"
  | "visible_expanded"
  | "hiding";

export interface SearchWindowSnapshot {
  sessionId: number;
  revision: number;
  phase: SearchWindowPhase;
}

export interface MainWindowReadyRequest {
  nonce: number;
  sessionId: number | null;
  revision: number | null;
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

  queryFileLibraryV2(request: FileQueryRequestV2): Promise<FileQueryResponseV2> {
    return invokeCommand<FileQueryResponseV2>("query_file_library_v2", { request });
  },

  resolveFileLibraryExactCountV2(
    request: ResolveFileLibraryExactCountRequestV2
  ): Promise<ResolveFileLibraryExactCountResponseV2> {
    return invokeCommand<ResolveFileLibraryExactCountResponseV2>(
      "resolve_file_library_exact_count_v2",
      { request }
    );
  },

  getFileLibraryDetail(fileId: string): Promise<FileLibraryDetail> {
    return invokeCommand<FileLibraryDetail>("get_file_library_detail", { fileId });
  },

  getFileLibrarySelectionSummary(selection: LibrarySelectionV1): Promise<FileLibrarySelectionSummary> {
    return invokeCommand<FileLibrarySelectionSummary>("get_file_library_selection_summary", { selection });
  },

  revealFileLibraryEntry(fileId: string): Promise<void> {
    return invokeCommand<void>("reveal_file_library_entry", { fileId });
  },

  listUserTags(): Promise<UserTag[]> {
    return invokeCommand<UserTag[]>("list_user_tags");
  },

  createUserTag(request: CreateUserTagRequest): Promise<UserTag> {
    return invokeCommand<UserTag>("create_user_tag", { request });
  },

  updateUserTag(request: UpdateUserTagRequest): Promise<UserTag> {
    return invokeCommand<UserTag>("update_user_tag", { request });
  },

  deleteUserTag(request: DeleteUserTagRequest): Promise<boolean> {
    return invokeCommand<boolean>("delete_user_tag", { request });
  },

  mutateFileUserTags(request: MutateFileUserTagsRequest): Promise<MutateFileUserTagsResult> {
    return invokeCommand<MutateFileUserTagsResult>("mutate_file_user_tags", { request });
  },

  listLibrarySavedViews(): Promise<LibrarySavedView[]> {
    return invokeCommand<LibrarySavedView[]>("list_library_saved_views");
  },

  createLibrarySavedView(request: CreateLibrarySavedViewRequest): Promise<LibrarySavedView> {
    return invokeCommand<LibrarySavedView>("create_library_saved_view", { request });
  },

  updateLibrarySavedView(request: UpdateLibrarySavedViewRequest): Promise<LibrarySavedView> {
    return invokeCommand<LibrarySavedView>("update_library_saved_view", { request });
  },

  deleteLibrarySavedView(request: DeleteLibrarySavedViewRequest): Promise<boolean> {
    return invokeCommand<boolean>("delete_library_saved_view", { request });
  },

  createOrganizationPlan(request: {
    version: 1;
    requestId: string;
    title?: string | null;
    source: LibrarySelectionV1;
    expectedCount?: number | null;
  }): Promise<OrganizationPlan> {
    return invokeCommand<OrganizationPlan>("create_organization_plan", { request });
  },

  listOrganizationPlans(): Promise<OrganizationPlan[]> {
    return invokeCommand<OrganizationPlan[]>("list_organization_plans");
  },

  getOrganizationPlan(planId: string): Promise<OrganizationPlan> {
    return invokeCommand<OrganizationPlan>("get_organization_plan", { planId });
  },

  queryOrganizationPlanItems(request: {
    planId: string;
    cursor?: string | null;
    pageSize: number;
  }): Promise<OrganizationPlanItemPage> {
    return invokeCommand<OrganizationPlanItemPage>("query_organization_plan_items", { request });
  },

  queryOrganizationPlanGroups(request: {
    planId: string;
    cursor?: string | null;
    pageSize: number;
  }): Promise<OrganizationPlanGroupPage> {
    return invokeCommand<OrganizationPlanGroupPage>("query_organization_plan_groups", { request });
  },

  queryOrganizationPlanGroupItems(request: {
    planId: string;
    groupId: string;
    cursor?: string | null;
    pageSize: number;
  }): Promise<OrganizationPlanGroupItemPage> {
    return invokeCommand<OrganizationPlanGroupItemPage>("query_organization_plan_group_items", { request });
  },

  updateOrganizationPlanDecisions(request: {
    planId: string;
    expectedPlanRevision: number;
    safeBatch?: boolean;
    mutations: Array<{
      itemId: string;
      expectedItemRevision: number;
      decision: "accepted" | "kept" | "edited" | "undecided";
      editedFilename?: string | null;
    }>;
  }): Promise<OrganizationPlan> {
    return invokeCommand<OrganizationPlan>("update_organization_plan_decisions", { request });
  },

  updateOrganizationPlanGroupDecision(request: {
    planId: string;
    groupId: string;
    expectedPlanRevision: number;
    decision: "accepted" | "kept" | "undecided";
  }): Promise<UpdateOrganizationPlanGroupDecisionResult> {
    return invokeCommand<UpdateOrganizationPlanGroupDecisionResult>("update_organization_plan_group_decision", { request });
  },

  refreshOrganizationPlan(request: { planId: string; expectedPlanRevision: number }): Promise<OrganizationPlan> {
    return invokeCommand<OrganizationPlan>("refresh_organization_plan", { request });
  },

  cancelOrganizationPlan(request: { planId: string; expectedPlanRevision: number }): Promise<OrganizationPlan> {
    return invokeCommand<OrganizationPlan>("cancel_organization_plan", { request });
  },

  deleteOrganizationPlan(request: { planId: string; expectedPlanRevision: number; confirmed: boolean }): Promise<boolean> {
    return invokeCommand<boolean>("delete_organization_plan", { request });
  },

  analyzeOrganizationPlanItems(request: {
    planId: string;
    expectedPlanRevision: number;
    itemIds?: string[];
  }): Promise<{ planId: string; queuedCount: number; requiresRefresh: boolean }> {
    return invokeCommand("analyze_organization_plan_items", { request });
  },

  getOrganizationPlanDryRun(request: {
    planId: string;
    expectedPlanRevision: number;
    itemIds?: string[];
    allAccepted: boolean;
  }): Promise<OrganizationPlanDryRun> {
    return invokeCommand<OrganizationPlanDryRun>("get_organization_plan_dry_run", { request });
  },

  executeOrganizationPlan(request: {
    planId: string;
    expectedPlanRevision: number;
    dryRunFingerprint: string;
    itemIds?: string[];
    allAccepted: boolean;
    confirmed: boolean;
  }): Promise<ExecuteOrganizationPlanResult> {
    return invokeCommand<ExecuteOrganizationPlanResult>("execute_organization_plan", { request });
  },

  getStatsSummary(scope?: LibraryScope): Promise<DashboardStats> {
    return invokeCommand<DashboardStats>("get_stats_summary", { scope: scope ?? null });
  },

  searchFiles(query: string, limit = 12, scope?: LibraryScope): Promise<FileRecord[]> {
    return invokeCommand<FileRecord[]>("search_files", { query, limit, scope: scope ?? null });
  },

  searchGlobalEntries(request: GlobalSearchRequest): Promise<GlobalSearchResponse> {
    return invokeCommand<GlobalSearchResponse>("search_global_entries", { request });
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

  startDedupeRun(request: StartDedupeRunRequest): Promise<DedupeRun> {
    return invokeCommand<DedupeRun>("start_dedupe_run", { request });
  },

  retryDedupeRun(runId: string): Promise<DedupeRun> {
    return invokeCommand<DedupeRun>("retry_dedupe_run", { runId });
  },

  cancelDedupeRun(runId: string): Promise<DedupeRun> {
    return invokeCommand<DedupeRun>("cancel_dedupe_run", { runId });
  },

  getDedupeRun(runId: string): Promise<DedupeRun> {
    return invokeCommand<DedupeRun>("get_dedupe_run", { runId });
  },

  listDedupeRuns(limit = 20): Promise<DedupeRun[]> {
    return invokeCommand<DedupeRun[]>("list_dedupe_runs", { limit });
  },

  getActiveDedupeRun(): Promise<DedupeRun | null> {
    return invokeCommand<DedupeRun | null>("get_active_dedupe_run");
  },

  listAnalysisDetectors(): Promise<AnalysisDetectorDescriptor[]> {
    return invokeCommand<AnalysisDetectorDescriptor[]>("list_analysis_detectors");
  },

  startAnalysisRun(request: StartAnalysisRunRequest): Promise<AnalysisRun> {
    return invokeCommand<AnalysisRun>("start_analysis_run", { request });
  },

  cancelAnalysisRun(runId: string): Promise<AnalysisRun> {
    return invokeCommand<AnalysisRun>("cancel_analysis_run", { runId });
  },

  retryAnalysisRun(runId: string): Promise<AnalysisRun> {
    return invokeCommand<AnalysisRun>("retry_analysis_run", { runId });
  },

  getAnalysisRun(runId: string): Promise<AnalysisRun> {
    return invokeCommand<AnalysisRun>("get_analysis_run", { runId });
  },

  getActiveAnalysisRun(): Promise<AnalysisRun | null> {
    return invokeCommand<AnalysisRun | null>("get_active_analysis_run");
  },

  listAnalysisRuns(limit = 20): Promise<AnalysisRun[]> {
    return invokeCommand<AnalysisRun[]>("list_analysis_runs", { limit });
  },

  listAnalysisRunDetectors(runId: string): Promise<AnalysisDetector[]> {
    return invokeCommand<AnalysisDetector[]>("list_analysis_run_detectors", { runId });
  },

  listAnalysisFindings(options: {
    runId?: string;
    detectorId?: string;
    tier?: string;
    category?: string;
    decision?: string;
    status?: string;
    executableOnly?: boolean;
    cursor?: string | null;
    limit?: number;
  } = {}): Promise<AnalysisFindingPage> {
    return invokeCommand<AnalysisFindingPage>("list_analysis_findings", {
      runId: options.runId ?? null,
      detectorId: options.detectorId ?? null,
      tier: options.tier ?? null,
      category: options.category ?? null,
      decision: options.decision ?? null,
      status: options.status ?? null,
      executableOnly: options.executableOnly ?? false,
      cursor: options.cursor ?? null,
      limit: options.limit ?? 100
    });
  },

  getAnalysisFinding(findingId: string): Promise<AnalysisFinding | null> {
    return invokeCommand<AnalysisFinding | null>("get_analysis_finding", { findingId });
  },

  listAnalysisFindingEvidence(findingId: string): Promise<AnalysisFindingEvidence[]> {
    return invokeCommand<AnalysisFindingEvidence[]>("list_analysis_finding_evidence", { findingId });
  },

  getDedupeAuthority(): Promise<DedupeAuthority> {
    return invokeCommand<DedupeAuthority>("get_dedupe_authority");
  },

  setAnalysisFindingDecision(request: {
    findingKey: string;
    decision: AnalysisFindingDecision["decision"];
    snoozedUntil?: number | null;
    note?: string | null;
    expectedRevision: number;
  }): Promise<AnalysisFindingDecision> {
    return invokeCommand<AnalysisFindingDecision>("set_analysis_finding_decision", {
      findingKey: request.findingKey,
      decision: request.decision,
      snoozedUntil: request.snoozedUntil ?? null,
      note: request.note ?? null,
      expectedRevision: request.expectedRevision
    });
  },

  revalidateAnalysisFinding(findingId: string): Promise<AnalysisFinding> {
    return invokeCommand<AnalysisFinding>("revalidate_analysis_finding", { findingId });
  },

  listDuplicateGroups(cursor?: string | null, limit = 50): Promise<DedupeGroupPage> {
    return invokeCommand<DedupeGroupPage>("list_duplicate_groups", {
      cursor: cursor ?? null,
      limit
    });
  },

  getDuplicateGroup(groupId: string): Promise<DedupeGroup | null> {
    return invokeCommand<DedupeGroup | null>("get_duplicate_group", { groupId });
  },

  listDuplicateGroupMembers(groupId: string): Promise<DedupeGroupMember[]> {
    return invokeCommand<DedupeGroupMember[]>("list_duplicate_group_members", { groupId });
  },

  getFileDuplicateMembership(fileId: string): Promise<DedupeGroup[]> {
    return invokeCommand<DedupeGroup[]>("get_file_duplicate_membership", { fileId });
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

  previewCleanupCandidates(jobId: string, selections: CleanupFindingSelection[]): Promise<CleanupPreviewItem[]> {
    return invokeCommand<CleanupPreviewItem[]>("preview_cleanup_candidates", { jobId, selections });
  },

  previewCleanupOperations(jobId: string, selections: CleanupFindingSelection[]): Promise<OperationPreviewResult> {
    return invokeCommand<OperationPreviewResult>("preview_cleanup_operations", { jobId, selections });
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

  executeRulesForScopeV2(
    scope: FileLibraryScopeV2,
    expectedCatalogRevision: number,
    mode: RuleExecutionMode = "inbox_only",
    confirmed = true
  ): Promise<RuleExecutionResultV2> {
    return invokeCommand<RuleExecutionResultV2>("execute_rules_for_scope_v2", {
      request: { scope, mode, expectedCatalogRevision, confirmed }
    });
  },

  getContentScopePolicy(rootId: string): Promise<ContentScopePolicy> {
    return invokeCommand<ContentScopePolicy>("get_content_scope_policy", { rootId });
  },

  getContentCatalogRevision(): Promise<number> {
    return invokeCommand<number>("get_content_catalog_revision");
  },

  setContentScopePolicy(request: {
    version: 1;
    rootId: string;
    expectedRootRevision: number;
    expectedPolicyRevision: number;
    confirmed: boolean;
    policy: ContentScopePolicy;
  }): Promise<ContentScopePolicy> {
    return invokeCommand<ContentScopePolicy>("set_content_scope_policy", { request });
  },

  previewContent(request: ContentPreviewRequest): Promise<ContentPreview> {
    return invokeCommand<ContentPreview>("preview_content", { request });
  },

  startContentRun(request: ContentPreviewRequest & {
    previewFingerprint: string;
    confirmed: boolean;
  }): Promise<ContentRun> {
    return invokeCommand<ContentRun>("start_content_run", { request });
  },

  getContentRun(runId: string): Promise<ContentRun> {
    return invokeCommand<ContentRun>("get_content_run", { runId });
  },

  listContentRuns(limit = 50, cursor?: string | null): Promise<ContentRun[]> {
    return invokeCommand<ContentRun[]>("list_content_runs", { request: { limit, cursor: cursor ?? null } });
  },

  cancelContentRun(runId: string, expectedRevision: number, confirmed = true): Promise<ContentRun> {
    return invokeCommand<ContentRun>("cancel_content_run", { request: { runId, expectedRevision, confirmed } });
  },

  queryContentRunItems(runId: string, limit = 100, cursor?: number | null): Promise<{ runId: string; items: ContentRunItem[]; nextCursor: number | null; hasMore: boolean }> {
    return invokeCommand("query_content_run_items", { request: { runId, limit, cursor: cursor ?? null } });
  },

  getContentArtifact(fileId: string): Promise<ContentArtifact | null> {
    return invokeCommand<ContentArtifact | null>("get_content_artifact", { fileId });
  },

  queryContentArtifacts(request: { query: string; scope: FileLibraryScopeV2; expectedLibraryRevision: number; expectedContentRevision: number; limit: number; cursor?: string | null }): Promise<ContentArtifactPage> {
    return invokeCommand<ContentArtifactPage>("query_content_artifacts", { request });
  },

  rebuildContentArtifact(fileId: string, expectedRevision: number, confirmed = true): Promise<ContentArtifact> {
    return invokeCommand<ContentArtifact>("rebuild_content_artifact", { request: { fileId, expectedRevision, confirmed } });
  },

  deleteContentArtifact(fileId: string, expectedRevision: number, confirmed = true): Promise<boolean> {
    return invokeCommand<boolean>("delete_content_artifact", { request: { fileId, expectedRevision, confirmed } });
  },

  purgeContentScope(request: { version: 1; scope: FileLibraryScopeV2; expectedLibraryRevision: number; expectedPolicyRevisions: Array<{ rootId: string; rootRevision: number; policyRevision: number }>; confirmed: boolean }): Promise<number> {
    return invokeCommand<number>("purge_content_scope", { request });
  },

  understandContentArtifacts(request: { version: 1; artifactIds: string[]; expectedRevisions: number[]; runId: string; expectedRunRevision: number; confirmed: boolean }): Promise<{ processedCount: number; blockedCount: number; reason: string | null }> {
    return invokeCommand("understand_content_artifacts", { request });
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

  getRuleCatalogState(): Promise<RuleCatalogState> {
    return invokeCommand<RuleCatalogState>("get_rule_catalog_state");
  },

  listUserRulesV2(): Promise<Rule[]> {
    return invokeCommand<Rule[]>("list_user_rules_v2");
  },

  createUserRuleV2(draft: RuleDraftV2, expectedCatalogRevision: number): Promise<RuleMutationResultV2> {
    return invokeCommand<RuleMutationResultV2>("create_user_rule_v2", {
      request: {
        version: 2,
        requestId: crypto.randomUUID(),
        expectedCatalogRevision,
        draft
      }
    });
  },

  updateUserRuleV2(
    ruleId: string,
    expectedRuleRevision: number,
    expectedCatalogRevision: number,
    draft: RuleDraftV2
  ): Promise<RuleMutationResultV2> {
    return invokeCommand<RuleMutationResultV2>("update_user_rule_v2", {
      request: { ruleId, expectedRuleRevision, expectedCatalogRevision, draft }
    });
  },

  setUserRuleEnabledV2(
    ruleId: string,
    expectedRuleRevision: number,
    expectedCatalogRevision: number,
    enabled: boolean
  ): Promise<RuleMutationResultV2> {
    return invokeCommand<RuleMutationResultV2>("set_user_rule_enabled_v2", {
      request: { ruleId, expectedRuleRevision, expectedCatalogRevision, enabled }
    });
  },

  deleteUserRuleV2(
    ruleId: string,
    expectedRuleRevision: number,
    expectedCatalogRevision: number,
    confirmed = true
  ): Promise<RuleCatalogState> {
    return invokeCommand<RuleCatalogState>("delete_user_rule_v2", {
      request: { ruleId, expectedRuleRevision, expectedCatalogRevision, confirmed }
    });
  },

  createRuleProposal(request: {
    version: 1;
    requestId: string;
    prompt: string;
    intentKind: "create" | "update";
    proposalId?: string | null;
    targetRuleId?: string | null;
    expectedProposalRevision?: number | null;
    expectedTargetRuleRevision?: number | null;
  }): Promise<RuleProposal> {
    return invokeCommand<RuleProposal>("create_rule_proposal", { request });
  },

  regenerateRuleProposal(request: {
    version: 1;
    requestId: string;
    prompt: string;
    intentKind: "create" | "update";
    proposalId: string;
    expectedProposalRevision: number;
    targetRuleId?: string | null;
    expectedTargetRuleRevision?: number | null;
  }): Promise<RuleProposal> {
    return invokeCommand<RuleProposal>("regenerate_rule_proposal", { request });
  },

  getRuleProposal(proposalId: string): Promise<RuleProposal> {
    return invokeCommand<RuleProposal>("get_rule_proposal", { proposalId });
  },

  listRuleProposals(pageSize = 50, cursor?: string | null): Promise<RuleProposalPage> {
    return invokeCommand<RuleProposalPage>("list_rule_proposals", {
      request: { pageSize, cursor: cursor ?? null }
    });
  },

  cancelRuleProposal(proposalId: string, expectedProposalRevision: number): Promise<RuleProposal> {
    return invokeCommand<RuleProposal>("cancel_rule_proposal", {
      request: { proposalId, expectedProposalRevision }
    });
  },

  deleteRuleProposal(
    proposalId: string,
    expectedProposalRevision: number,
    confirmed = true
  ): Promise<boolean> {
    return invokeCommand<boolean>("delete_rule_proposal", {
      request: { proposalId, expectedProposalRevision, confirmed }
    });
  },

  replaceRuleProposalCandidate(
    proposalId: string,
    expectedProposalRevision: number,
    candidate: RuleDraftV2
  ): Promise<RuleProposal> {
    return invokeCommand<RuleProposal>("replace_rule_proposal_candidate", {
      request: { proposalId, expectedProposalRevision, candidate }
    });
  },

  previewRuleProposal(
    proposalId: string,
    expectedProposalRevision: number,
    scope: FileLibraryScopeV2,
    pageSize = 20
  ): Promise<RuleProposalImpact> {
    return invokeCommand<RuleProposalImpact>("preview_rule_proposal", {
      request: { proposalId, expectedProposalRevision, scope, pageSize }
    });
  },

  resolveRuleProposalExactImpact(
    proposalId: string,
    expectedProposalRevision: number,
    impactToken: string
  ): Promise<RuleProposalImpact> {
    return invokeCommand<RuleProposalImpact>("resolve_rule_proposal_exact_impact", {
      request: { proposalId, expectedProposalRevision, impactToken }
    });
  },

  applyRuleProposal(request: {
    proposalId: string;
    expectedProposalRevision: number;
    expectedCatalogRevision: number;
    expectedTargetRuleRevision?: number | null;
    previewFingerprint: string;
    confirmed: boolean;
  }): Promise<ApplyRuleProposalResult> {
    return invokeCommand<ApplyRuleProposalResult>("apply_rule_proposal", { request });
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

  activateSearchResult(
    view: View,
    fileId: string | null,
    snapshot?: Pick<SearchWindowSnapshot, "sessionId" | "revision">,
    settingsTarget?: SearchSettingsTarget | null
  ): Promise<void> {
    return invokeCommand<void>("activate_search_result", {
      request: {
        sessionId: snapshot?.sessionId ?? null,
        expectedRevision: snapshot?.revision ?? null,
        view,
        fileId,
        settingsTarget: settingsTarget ?? null
      }
    });
  },

  getSearchWindowState(): Promise<SearchWindowSnapshot> {
    return invokeCommand<SearchWindowSnapshot>("get_search_window_state");
  },

  searchWindowReady(snapshot: SearchWindowSnapshot): Promise<SearchWindowSnapshot> {
    return invokeCommand<SearchWindowSnapshot>("search_window_ready", {
      request: { sessionId: snapshot.sessionId, expectedRevision: snapshot.revision }
    });
  },

  resizeSearchWindow(snapshot: SearchWindowSnapshot, expanded: boolean): Promise<SearchWindowSnapshot> {
    return invokeCommand<SearchWindowSnapshot>("resize_search_window", {
      request: {
        sessionId: snapshot.sessionId,
        expectedRevision: snapshot.revision,
        expanded
      }
    });
  },

  hideSearchWindow(snapshot: SearchWindowSnapshot): Promise<SearchWindowSnapshot> {
    return invokeCommand<SearchWindowSnapshot>("hide_search_window_command", {
      request: { sessionId: snapshot.sessionId, expectedRevision: snapshot.revision }
    });
  },

  markMainWindowReady(ready: boolean): Promise<void> {
    return invokeCommand<void>("mark_main_window_ready", { ready });
  },

  acknowledgeMainWindowReady(nonce: number): Promise<void> {
    return invokeCommand<void>("acknowledge_main_window_ready", { nonce });
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

  onDedupeRunUpdated(handler: EventHandler<DedupeRun>): Promise<UnlistenFn> {
    return listenTo("dedupe-run-updated", handler);
  },

  onAnalysisRunUpdated(handler: EventHandler<AnalysisRun>): Promise<UnlistenFn> {
    return listenTo("analysis-run-updated", handler);
  },

  onAnalysisDetectorUpdated(handler: EventHandler<AnalysisDetector>): Promise<UnlistenFn> {
    return listenTo("analysis-detector-updated", handler);
  },

  onAnalysisFindingsPublished(handler: EventHandler<AnalysisRun>): Promise<UnlistenFn> {
    return listenTo("analysis-findings-published", handler);
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

  onSearchWindowState(handler: EventHandler<SearchWindowSnapshot>): Promise<UnlistenFn> {
    return listenTo("search-window-state", handler);
  },

  onMainWindowReadyRequest(handler: EventHandler<MainWindowReadyRequest>): Promise<UnlistenFn> {
    return listenTo("search-main-ready-request", handler);
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

  onWatcherReconciliationStatus(
    handler: EventHandler<WatcherReconciliationStatus>
  ): Promise<UnlistenFn> {
    return listenTo("watcher-reconciliation-status", handler);
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
