export type FileType =
  | "Document"
  | "Image"
  | "Video"
  | "Audio"
  | "Code"
  | "ArchivePackage"
  | "Installer"
  | "Spreadsheet"
  | "Presentation"
  | "Other";

export type Purpose =
  | "Project"
  | "Teaching"
  | "Study"
  | "Work"
  | "Personal"
  | "Career"
  | "Finance"
  | "Identity"
  | "Media"
  | "Installer"
  | "Temporary"
  | "Archive"
  | "Unknown";

export type Lifecycle =
  | "Inbox"
  | "Active"
  | "Reference"
  | "Archive"
  | "Disposable"
  | "Duplicate"
  | "Sensitive";

export type RiskLevel = "Normal" | "Sensitive" | "System" | "Unknown";

export type SuggestedAction =
  | "Keep"
  | "Rename"
  | "Move"
  | "MoveAndRename"
  | "Archive"
  | "Review"
  | "DeleteCandidate";

export type DispatchZone = "CoreAssets" | "QuietArchive" | "PrivacyVault" | "CleanupLane";
export type SearchSourceType = "user_space" | "folder" | "cloud" | "external";
export type RestoreStatus = "not_restored" | "restored" | "failed" | "unavailable" | "canceled";
export type CleanupTier = "Safe" | "Review" | "Caution";
export type CleanupActionKind = "MoveToTrash" | "Reveal" | "UninstallAdvice" | "AppInternalCleanup" | "None";
export type OperationType = "move" | "rename" | "move_rename" | "move_to_trash";
export type ClassificationStatus = "unclassified" | "classified";
export type FolderNamingLanguage = "en" | "zh";
export type CloseBehavior = "ask" | "minimize" | "quit";
export type RestoreRetentionDays = 15 | 30 | 60 | 90;
export type RuleExecutionMode = "inbox_only" | "all_changed_or_rule_changed";
export type SearchScopeMode = "all" | "current_scan" | "custom_roots";
export type OrganizeRootMode = "current_folder" | "zen_canvas_folder" | "custom_root";
export type AIProviderKind = "openai_compatible" | "ollama";
export type AIProviderPresetId =
  | "deepseek"
  | "kimi"
  | "qwen_dashscope"
  | "zhipu_glm"
  | "minimax"
  | "baichuan"
  | "doubao_ark"
  | "siliconflow"
  | "custom_openai_compatible"
  | "ollama";
export type AIClassificationMode = "ai_first" | "rules_first" | "hybrid";

export interface AIProviderPreset {
  id: AIProviderPresetId;
  label: string;
  providerKind: AIProviderKind;
  defaultBaseUrl: string;
  defaultChatPath: string;
  defaultModel: string;
  apiKeyEnvHint?: string;
  supportsResponseFormat: boolean;
  supportsJsonMode?: boolean;
  supportsThinking: boolean;
  supportsReasoningEffort: boolean;
  extraBodyStrategy?: string;
  docsUrl?: string | null;
}

export interface AISettings {
  enabled: boolean;
  provider: AIProviderKind;
  preset: AIProviderPresetId;
  baseUrl: string;
  chatPath: string;
  apiKey: string;
  apiKeyConfigured?: boolean;
  model: string;
  temperature: number;
  maxTokens: number;
  batchSize: number;
  classificationConcurrency: number;
  timeoutSeconds: number;
  sendFullPath: boolean;
  sendParentPath: boolean;
  classificationMode: AIClassificationMode;
  cleanupAiEnabled: boolean;
  forceJsonOutput: boolean;
  enableThinking: boolean;
  reasoningEffort: string | null;
  extraBodyJson: string | null;
}

export interface AIConnectionTestResult {
  ok: boolean;
  message: string;
  model: string | null;
  provider: AIProviderKind | null;
  preset: AIProviderPresetId | null;
  elapsedMs: number;
}

export interface AIDebugClassificationResult {
  provider: AIProviderKind;
  preset: AIProviderPresetId;
  model: string;
  baseUrl: string;
  chatPath: string;
  forceJsonOutput: boolean;
  enableThinking: boolean;
  maxTokens: number;
  batchSize: number;
  requestUsedResponseFormat: boolean;
  requestUsedThinkingField: string | null;
  httpStatus: number;
  providerResponseSummary: string;
  rawResponsePreview: string;
  messageContentPreview: string;
  reasoningContentPreview: string;
  extractedContentPreview: string;
  cleanedContentPreview: string;
  parseStage: string;
  parseError: string | null;
  success: boolean;
  refId: string;
  realFileId: string;
  path: string;
  modelReturnedRefId: string | null;
  modelReturnedId: string | null;
  idMappingMatched: boolean;
  missingOptionalFields: string[];
  fallbackApplied: boolean;
  itemParseWarnings: string[];
}

export interface AIClassificationProgressPayload {
  jobId: string;
  processed: number;
  total: number;
  batchIndex: number;
  batchCount: number;
  completedBatches: number;
  failedBatches: number;
  updated: number;
  skipped: number;
  needsConfirmation: number;
  stage: string;
  currentFilePreview: string;
  elapsedMs: number;
  estimatedRemainingMs?: number | null;
}

export interface RuleExecutionSummary {
  scanned: number;
  updated: number;
  skipped: number;
  needsConfirmation: number;
  failedBatches?: number;
  failedFiles?: number;
  warning?: string;
}

export interface ClassificationCorrectionRequest {
  fileType: FileType;
  purpose: Purpose;
  lifecycle: Lifecycle;
  context: string;
  riskLevel: RiskLevel;
  suggestedAction: SuggestedAction;
  targetTemplate: string;
  suggestedName?: string;
  reason?: string;
}

export interface ScanRootSetting {
  id: string;
  path: string;
  label: string;
  enabled: boolean;
  createdAt: string;
}

export interface SearchRootSetting {
  id: string;
  path: string;
  label: string;
  enabled: boolean;
  createdAt: string;
}

export type LibraryScope =
  | { kind: "current_scan"; roots: string[]; scanSessionId?: string }
  | { kind: "roots"; roots: string[] }
  | { kind: "all" };

export type LibraryFilter = "all" | "active" | "archive" | "review" | "duplicate" | "sensitive";

export interface FileLibraryFilters {
  libraryFilter?: LibraryFilter;
}

export interface AppSettings {
  closeBehavior: CloseBehavior;
  folderNamingLanguage: FolderNamingLanguage;
  defaultScanFolders: ScanRootSetting[];
  restoreRetentionDays: RestoreRetentionDays;
  launchAtLogin: boolean;
  backgroundIndexOnStartup: boolean;
  searchHotkey: string;
  searchScopeMode: SearchScopeMode;
  customSearchRoots: SearchRootSetting[];
  organizeRootMode: OrganizeRootMode;
  organizeRootPath?: string | null;
  useLegacyBuiltinClassificationRules: boolean;
  useLearnedRulesAsAutoRules: boolean;
}

export interface FileRecord {
  id: string;
  name: string;
  path: string;
  directory: string;
  extension: string;
  size: number;
  file_type: FileType;
  purpose: Purpose;
  lifecycle: Lifecycle;
  context: string;
  risk_level: RiskLevel;
  hash: string | null;
  created_at: string;
  modified_at: string;
  scanned_at: string;
  last_seen_at: string;
  is_hidden: boolean;
  is_deleted: boolean;
  is_duplicate: boolean;
  suggested_action: SuggestedAction;
  suggested_target_path: string;
  suggested_name: string;
  confidence: number;
  classification_reason: string;
  classification_status: ClassificationStatus;
  matched_rules: string[];
  requires_confirmation: boolean;
  dispatch_zone?: DispatchZone;
  recommended_folder?: string;
  folder_reuse_candidate?: string;
  folder_rename_suggestion?: string;
  dispatch_reason?: string;
  next_action?: string;
  last_opened_at?: string | null;
  open_count?: number;
  indexed_at?: string;
  source_id?: string;
  is_stale?: boolean;
}

export interface ScanRoot {
  id: string;
  path: string;
  platform: NodeJS.Platform | string;
  enabled: boolean;
  last_scanned_at: string | null;
  created_at: string;
  disk_total_size?: number | null;
  disk_free_size?: number | null;
  scanned_size?: number;
  indexed_file_count?: number;
  skipped_count?: number;
  summarized_count?: number;
}

export type RuleSource = "system" | "user" | "session" | "ai" | "learned";
export type RuleOperator = "AND" | "OR";

export type ConditionField =
  | "name"
  | "extension"
  | "file_type"
  | "path"
  | "directory"
  | "size"
  | "modified_at"
  | "is_duplicate"
  | "risk_level";

export type ConditionOperator =
  | "contains"
  | "equals"
  | "startsWith"
  | "endsWith"
  | "greaterThan"
  | "lessThan"
  | "olderThanDays"
  | "newerThanDays"
  | "is";

export interface RuleCondition {
  id: string;
  field: ConditionField;
  operator: ConditionOperator;
  value: string | number | boolean;
}

export interface RuleConditionGroup {
  id: string;
  operator: RuleOperator;
  conditions: RuleCondition[];
}

export interface RuleAction {
  purpose?: Purpose;
  lifecycle?: Lifecycle;
  context?: string;
  risk_level?: RiskLevel;
  suggested_action?: SuggestedAction;
  target_template?: string;
  rename_template?: string;
}

export interface Rule {
  id: string;
  name: string;
  source: RuleSource;
  enabled: boolean;
  priority: number;
  weight: number;
  root_operator: RuleOperator;
  groups: RuleConditionGroup[];
  action: RuleAction;
  created_at: string;
  updated_at: string;
}

export interface FileQuery {
  search?: string;
  fileType?: FileType | "All";
  purpose?: Purpose | "All";
  lifecycle?: Lifecycle | "All";
  riskLevel?: RiskLevel | "All";
  sourceDirectory?: string;
  sortBy?: "name" | "size" | "modified_at" | "confidence";
  sortDirection?: "asc" | "desc";
  onlyActionable?: boolean;
  onlyNeedsConfirmation?: boolean;
  roots?: string[];
  limit?: number;
  offset?: number;
}

export interface FileQueryResult {
  files: FileRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface DashboardStats {
  totalFiles: number;
  totalSize: number;
  diskTotalSize: number;
  diskFreeSize: number;
  diskUsageRatio: number;
  duplicateFiles: number;
  largeFiles: number;
  sensitiveFiles: number;
  needsConfirmation: number;
  byType: Record<string, number>;
  byLifecycle: Record<string, number>;
  lastScannedAt: string | null;
}

export interface OperationPreview {
  id: string;
  fileId: string;
  file_id?: string;
  operation_type: OperationType;
  source_path: string;
  target_path: string;
  old_name: string;
  new_name: string;
  status: "pending" | "success" | "failed" | "skipped";
  risk_level: RiskLevel;
  confidence: number;
  requires_confirmation: boolean;
  suggested_action?: SuggestedAction;
  is_duplicate?: boolean;
  reason: string;
  selected_by_default?: boolean;
  is_executable?: boolean;
  blocking_reason?: string;
  editable_new_name?: boolean;
  batch_id?: string;
  target_parent_exists?: boolean;
  will_create_parent?: boolean;
}

export interface OperationPreviewResult {
  previews: OperationPreview[];
  total: number;
  limit: number;
  offset: number;
  truncated: boolean;
  hasMore: boolean;
}

export interface StorageCandidate {
  id: string;
  path: string;
  name: string;
  size: number;
  tier: CleanupTier;
  category: string;
  reason: string;
  suggested_action: CleanupActionKind;
  risk_note: string | null;
  trash_allowed: boolean;
  selected_by_default: boolean;
}

export interface StorageAnalysis {
  total_size: number;
  reclaimable_estimate: number;
  review_estimate: number;
  candidates: StorageCandidate[];
  denied_paths: string[];
  warnings?: string[];
  candidate_total?: number;
  candidate_offset?: number;
  candidate_limit?: number;
  has_more?: boolean;
}

export interface StorageCleanupProgress {
  jobId: string;
  scannedEntries: number;
  currentPath: string | null;
  totalSize: number;
}

export interface StorageCleanupScanStatus {
  jobId: string;
  status: "running" | "completed" | "failed" | "cancelled";
  progress: StorageCleanupProgress;
  analysis: StorageAnalysis | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface StorageCleanupCompleted {
  jobId: string;
  analysis: StorageAnalysis;
}

export interface StorageCleanupJobMessage {
  jobId: string;
  message: string;
}

export interface CleanupPreviewItem {
  id: string;
  candidate_id: string;
  path: string;
  name: string;
  size: number;
  tier: CleanupTier;
  category: string;
  reason: string;
  operation_type: "move_to_trash_preview";
  target_path: string;
  status: "pending" | "success" | "failed" | "skipped";
  requires_confirmation: boolean;
  is_executable: boolean;
  blocking_reason: string | null;
}

export interface CleanupExecutionLog {
  path: string;
  name: string;
  size: number;
  status: "success" | "skipped" | "failed";
  message: string;
  itemId?: string | null;
  trashPath?: string | null;
}

export interface CleanupExecutionResult {
  moved: number;
  skipped: number;
  failed: number;
  logs: CleanupExecutionLog[];
}

export interface CleanupTrashItem {
  id: string;
  batchId: string;
  originalPath: string;
  trashPath: string;
  name: string;
  size: number;
  movedAt: string;
  restoredAt: string | null;
  status: "pending" | "moved" | "restored" | "missing" | "failed";
  message: string | null;
}

export interface CleanupTrashBatch {
  id: string;
  createdAt: string;
  root: string | null;
  totalItems: number;
  totalSize: number;
  status: "pending" | "success" | "partial_failed";
  items: CleanupTrashItem[];
}

export interface CleanupRestorePreview {
  batchId: string;
  items: CleanupTrashItem[];
}

export interface CleanupRestoreLog {
  itemId: string;
  originalPath: string;
  trashPath: string;
  status: "restored" | "conflict" | "missing" | "failed";
  message: string;
}

export interface CleanupRestoreResult {
  restored: number;
  conflicts: number;
  missing: number;
  failed: number;
  logs: CleanupRestoreLog[];
}

export interface OperationLog {
  id: string;
  batch_id: string;
  operation_type: string;
  source_path: string;
  target_path: string;
  old_name: string;
  new_name: string;
  status: "success" | "failed" | "skipped";
  error_message: string | null;
  created_at: string;
  can_undo: boolean;
  path_before: string;
  path_after: string;
  name_before: string;
  name_after: string;
  can_restore: boolean;
  restored_at: string | null;
  restore_status: RestoreStatus;
  restore_error: string | null;
}

export interface ExecuteOperationRequest {
  operations: Array<{
    id: string;
    fileId: string;
    newName?: string;
  }>;
}

export interface ExecuteOperationResult {
  logs: OperationLog[];
  batch_id: string;
}

export interface RestoreMovesResult {
  logs: OperationLog[];
  restored: number;
  failed: number;
}

export interface SearchSource {
  id: string;
  label: string;
  path: string;
  type: SearchSourceType;
  enabled: boolean;
  is_stale: boolean;
  indexed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SearchIndexState {
  total_files: number;
  indexed_files: number;
  last_indexed_at: string | null;
  stale_sources: number;
}

export interface SearchQuery {
  query: string;
  limit?: number;
  sourceIds?: string[];
}

export interface SearchResult {
  file: FileRecord;
  score: number;
  matched_text: string;
}

export interface RestoreBatch {
  batch_id: string;
  created_at: string;
  total: number;
  success: number;
  failed: number;
  skipped: number;
  restorable: number;
  restored: number;
  expires_at: string;
}

export interface RestorePreviewItem {
  log_id: string;
  batch_id: string;
  operation_type: string;
  current_path: string;
  restore_path: string;
  old_name: string;
  new_name: string;
  can_restore: boolean;
  blocking_reason: string | null;
}

export interface RestorePreview {
  batch_id: string;
  items: RestorePreviewItem[];
}

export interface RestoreBatchResult {
  batch_id: string;
  restored: number;
  failed: number;
  skipped: number;
  items: RestorePreviewItem[];
}

export interface ScanResult {
  roots: ScanRoot[];
  files: FileRecord[];
  skipped: Array<{ path: string; reason: string }>;
  scannedAt: string;
  canceled?: boolean;
}

export interface FolderScanResult extends ScanResult {
  canceled: boolean;
  selectedPaths: string[];
}

export type ScanPhase = "queued" | "scanning" | "indexing" | "done" | "canceled" | "error";

export interface ScanProgress {
  scanId: string;
  phase: ScanPhase;
  currentPath: string | null;
  scannedFiles: number;
  indexedFiles: number;
  skipped: number;
  summarized: number;
  rootsTotal: number;
  rootsDone: number;
  message?: string;
}

export interface AppSnapshot {
  stats: DashboardStats;
  files: FileRecord[];
  rules: Rule[];
  operations: OperationLog[];
  scanRoots: ScanRoot[];
  searchSources: SearchSource[];
  searchIndex: SearchIndexState;
}
