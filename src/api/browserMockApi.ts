import type {
  AIConnectionTestResult,
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
  SaveSettingsRequest,
  VersionedAppSettings,
  StorageAnalysis,
  StorageCandidate,
  StorageCleanupScanStatus
} from "../types/domain";
import type { View } from "../types/ui";
import { DEFAULT_SEARCH_HOTKEY } from "../utils/hotkeys";
import type {
  GlobalHotkeyStatus,
  ScanSummary
} from "./tauriApi";

const now = "2026-07-06T09:00:00.000Z";

type MockCleanupRestoreState = Pick<CleanupTrashBatch["items"][number], "status" | "restoredAt" | "message">;

const mockCleanupCreatedAt = Date.now().toString();
const mockCleanupRestoreState = new Map<string, MockCleanupRestoreState>();

const mockFiles: FileRecord[] = [
  file({
    id: "mock-report",
    name: "project-report.pdf",
    path: "C:/Users/Zen/Documents/project-report.pdf",
    directory: "C:/Users/Zen/Documents",
    extension: "pdf",
    size: 2_450_000,
    file_type: "Document",
    purpose: "Work",
    lifecycle: "Active",
    confidence: 0.86
  }),
  file({
    id: "mock-archive",
    name: "old-design-assets.zip",
    path: "C:/Users/Zen/Downloads/old-design-assets.zip",
    directory: "C:/Users/Zen/Downloads",
    extension: "zip",
    size: 84_000_000,
    file_type: "ArchivePackage",
    purpose: "Archive",
    lifecycle: "Archive",
    suggested_action: "Archive",
    confidence: 0.78
  }),
  file({
    id: "mock-duplicate",
    name: "invoice-copy.pdf",
    path: "C:/Users/Zen/Desktop/invoice-copy.pdf",
    directory: "C:/Users/Zen/Desktop",
    extension: "pdf",
    size: 810_000,
    file_type: "Document",
    purpose: "Finance",
    lifecycle: "Duplicate",
    is_duplicate: true,
    suggested_action: "Review",
    requires_confirmation: true,
    confidence: 0.7
  }),
  file({
    id: "mock-private",
    name: "passport-scan.png",
    path: "C:/Users/Zen/Documents/private/passport-scan.png",
    directory: "C:/Users/Zen/Documents/private",
    extension: "png",
    size: 1_280_000,
    file_type: "Image",
    purpose: "Identity",
    lifecycle: "Sensitive",
    risk_level: "Sensitive",
    requires_confirmation: true,
    confidence: 0.91
  }),
  file({
    id: "mock-installer",
    name: "setup-helper.exe",
    path: "C:/Users/Zen/Downloads/setup-helper.exe",
    directory: "C:/Users/Zen/Downloads",
    extension: "exe",
    size: 32_000_000,
    file_type: "Installer",
    purpose: "Installer",
    lifecycle: "Disposable",
    suggested_action: "Review",
    confidence: 0.74
  })
];

const mockRules: Rule[] = [
  {
    id: "mock-rule-sensitive",
    name: "Sensitive files require review",
    source: "system",
    enabled: true,
    priority: 10,
    weight: 0.9,
    root_operator: "AND",
    groups: [],
    action: { risk_level: "Sensitive", suggested_action: "Review" },
    created_at: now,
    updated_at: now
  }
];

export async function mockInvokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  switch (command) {
    case "init_db":
    case "cancel_scan":
    case "cancel_operations":
    case "cancel_cleanup_restore":
    case "cancel_ai_classification":
    case "reveal_in_folder":
    case "reveal_storage_candidate":
    case "quit_app":
    case "activate_search_result":
    case "resize_search_window":
    case "insert_file":
      return undefined as T;
    case "get_paged_files":
      return queryMockFiles(args) as T;
    case "get_stats_summary":
      return mockStats() as T;
    case "search_files":
      return searchMockFiles(String(args?.query ?? ""), Number(args?.limit ?? 12)) as T;
    case "create_scan_job_id":
      return `scan-${args?.jobKind === "background" ? "background" : "foreground"}-${globalThis.crypto.randomUUID()}` as T;
    case "scan_directory":
      return {
        jobId: String(args?.jobId ?? "browser-mock-scan"),
        jobKind: args?.jobKind === "background" ? "background" : "foreground",
        root: String(args?.path ?? "C:/Users/Zen"),
        scanned: mockFiles.length,
        files: mockFiles.length,
        directories: 3,
        skipped: 0,
        errors: 0,
        elapsedMs: 1240
      } satisfies ScanSummary as T;
    case "execute_moves":
      return { logs: [], batch_id: "browser-mock-batch" } satisfies ExecuteOperationResult as T;
    case "restore_moves":
      return mockRestoreMoves(args) as T;
    case "get_operation_logs":
      return mockOperationLogs().slice(0, Number(args?.limit ?? 500)) as T;
    case "get_operation_previews_for_scope":
      return mockOperationPreviews(args) as T;
    case "start_storage_cleanup_scan":
      return "browser-mock-storage-cleanup-job" as T;
    case "get_storage_cleanup_scan_status":
      return mockStorageCleanupStatus(String(args?.jobId ?? "browser-mock-storage-cleanup-job")) as T;
    case "get_storage_cleanup_candidate_page":
      return mockStorageAnalysis() as T;
    case "cancel_storage_cleanup_scan":
      return undefined as T;
    case "move_cleanup_candidates_to_trash":
      return mockCleanupExecutionResult(args) as T;
    case "move_cleanup_candidates_to_safe_trash":
      return mockSafeTrashExecutionResult(args) as T;
    case "analyze_cleanup_candidates_with_ai":
      return mockAnalyzeCleanupCandidatesWithAI(args) as T;
    case "list_cleanup_trash_batches":
      return mockCleanupTrashBatches() as T;
    case "preview_restore_cleanup_trash":
      {
        const batchId = String(args?.batchId ?? "browser-cleanup-batch");
        const batch = mockCleanupTrashBatches().find((item) => item.id === batchId);
        return {
          batchId,
          items: (batch?.items ?? []).map((item) => mockCleanupRestorePreviewItem(item))
        } satisfies CleanupRestorePreview as T;
      }
    case "restore_cleanup_trash_items":
      return mockCleanupRestoreResult(args) as T;
    case "preview_cleanup_candidates":
      return mockCleanupPreviewCandidates(args) as T;
    case "preview_cleanup_operations":
      return mockCleanupPreviewOperations(args) as T;
    case "execute_rules_on_inbox":
    case "execute_rules_for_paths":
    case "execute_rules_for_scope":
      return {
        scanned: mockFiles.length,
        updated: mockFiles.filter((item) => item.classification_status === "unclassified").length,
        skipped: 0,
        needsConfirmation: mockFiles.filter((item) => item.requires_confirmation).length
      } satisfies RuleExecutionSummary as T;
    case "classify_files_with_ai":
      return mockAIClassifyFiles(args) as T;
    case "classify_selected_files_with_ai":
      return mockAIClassifySelectedFiles(args) as T;
    case "confirm_classification":
      return undefined as T;
    case "correct_classification":
      return mockCorrectClassification(args) as T;
    case "get_user_rules":
      return mockRules as T;
    case "save_user_rule":
      return args?.rule as T;
    case "delete_user_rule":
      return true as T;
    case "get_settings":
      return getMockVersionedSettings() as T;
    case "save_settings":
      return saveMockVersionedSettings(args?.request as SaveSettingsRequest) as T;
    case "get_ai_settings":
      return mockAISettings() as T;
    case "get_runtime_capabilities":
      return {
        aiDebugAvailable: true,
        realAIClassificationAvailable: true,
        credentialStoreAvailable: true
      } as T;
    case "save_ai_settings":
      return mockAISettings(args?.settings as AISettings | undefined) as T;
    case "list_ai_provider_presets":
      return mockAIProviderPresets() as T;
    case "test_ai_provider_connection":
      return mockAIConnectionTest(args?.settings as AISettings | undefined) as T;
    case "debug_ai_classification_once":
      return mockAIDebugClassification(args) as T;
    case "get_global_hotkey_status":
    case "register_global_search_hotkey":
      return {
        accelerator: String(args?.accelerator ?? DEFAULT_SEARCH_HOTKEY),
        registered: false,
        error: "Browser mock mode"
      } satisfies GlobalHotkeyStatus as T;
    case "remove_files_by_paths":
    case "upsert_files_by_paths":
      return 0 as T;
    default:
      throw new Error(`Unsupported mock command: ${command}`);
  }
}

export function isTauriRuntimeUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("reading 'invoke'")
    || message.includes("reading \"invoke\"")
    || message.includes("reading 'listen'")
    || message.includes("reading \"listen\"")
    || message.includes("__TAURI_INTERNALS__")
    || message.includes("Tauri");
}

export function isBrowserMockEnabled(): boolean {
  const meta = import.meta as ImportMeta & { env?: { DEV?: boolean } };
  return (Boolean(meta.env?.DEV) || isLocalBrowserPreview()) && !hasTauriRuntime();
}

function hasTauriRuntime(): boolean {
  const candidate = globalThis as typeof globalThis & {
    __TAURI_INTERNALS__?: { transformCallback?: unknown; invoke?: unknown };
    __TAURI__?: unknown;
  };
  return Boolean(
    candidate.__TAURI__
      || (candidate.__TAURI_INTERNALS__
        && typeof candidate.__TAURI_INTERNALS__.transformCallback === "function"
        && typeof candidate.__TAURI_INTERNALS__.invoke === "function")
  );
}

function isLocalBrowserPreview(): boolean {
  const location = globalThis.location;
  if (!location) return false;
  return location.hostname === "localhost"
    || location.hostname === "127.0.0.1"
    || location.hostname === "::1";
}

function queryMockFiles(args?: Record<string, unknown>): FileQueryResult {
  const limit = Number(args?.limit ?? 50);
  const offset = Number(args?.offset ?? 0);
  const query = String(args?.query ?? "").trim().toLowerCase();
  const filter = args?.filter as FileLibraryFilters | null | undefined;
  const filtered = applyLibraryFilter(
    query
      ? mockFiles.filter((item) => `${item.name} ${item.path} ${item.purpose}`.toLowerCase().includes(query))
      : mockFiles,
    filter?.libraryFilter
  );

  return {
    files: filtered.slice(offset, offset + limit),
    total: filtered.length,
    limit,
    offset
  };
}

function searchMockFiles(query: string, limit: number): FileRecord[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return mockFiles
    .filter((item) => `${item.name} ${item.path} ${item.purpose}`.toLowerCase().includes(normalized))
    .slice(0, limit);
}

function applyLibraryFilter(files: FileRecord[], filter?: FileLibraryFilters["libraryFilter"]): FileRecord[] {
  if (!filter || filter === "all") return files;
  if (filter === "active") return files.filter((item) => item.lifecycle === "Active");
  if (filter === "archive") return files.filter((item) => item.lifecycle === "Archive");
  if (filter === "review") return files.filter((item) => item.requires_confirmation);
  if (filter === "duplicate") return files.filter((item) => item.is_duplicate);
  if (filter === "sensitive") return files.filter((item) => item.risk_level === "Sensitive" || item.lifecycle === "Sensitive");
  return files;
}

function mockStats(): DashboardStats {
  const totalSize = mockFiles.reduce((sum, item) => sum + item.size, 0);
  return {
    totalFiles: mockFiles.length,
    totalSize,
    diskTotalSize: 512 * 1024 ** 3,
    diskFreeSize: 210 * 1024 ** 3,
    diskUsageRatio: 0.59,
    duplicateFiles: mockFiles.filter((item) => item.is_duplicate).length,
    largeFiles: mockFiles.filter((item) => item.size > 50 * 1024 ** 2).length,
    sensitiveFiles: mockFiles.filter((item) => item.risk_level === "Sensitive").length,
    needsConfirmation: mockFiles.filter((item) => item.requires_confirmation).length,
    byType: countBy(mockFiles, "file_type"),
    byLifecycle: countBy(mockFiles, "lifecycle"),
    lastScannedAt: now
  };
}

function mockOperationPreviews(args?: Record<string, unknown>): OperationPreviewResult {
  const limit = Number(args?.limit ?? 1000);
  const offset = Number(args?.offset ?? 0);
  const previews: OperationPreview[] = mockFiles
    .filter((item) => item.suggested_action !== "Keep" || item.requires_confirmation)
    .map((item, index) => ({
      id: `preview-${item.id}`,
      fileId: item.id,
      file_id: item.id,
      operation_type: "move",
      source_path: item.path,
      target_path: `C:/Users/Zen/${item.lifecycle}/${item.name}`,
      old_name: item.name,
      new_name: item.name,
      status: "pending",
      risk_level: item.risk_level,
      confidence: item.confidence,
      requires_confirmation: item.requires_confirmation,
      suggested_action: item.suggested_action,
      is_duplicate: item.is_duplicate,
      reason: "Browser mock preview",
      selected_by_default: index === 0,
      is_executable: true,
      editable_new_name: true,
      target_parent_exists: true,
      will_create_parent: false
    }));

  return {
    previews: previews.slice(offset, offset + limit),
    total: previews.length,
    limit,
    offset,
    truncated: false,
    hasMore: offset + limit < previews.length
  };
}

function mockStorageAnalysis(): StorageAnalysis {
  const candidates = [
    {
      id: "storage-safe-node-modules",
      path: "C:/Users/Zen/Projects/demo/node_modules",
      name: "node_modules",
      size: 1_850_000_000,
      tier: "Safe",
      category: "Regenerable development output",
      reason: "Build output or dependency cache can usually be recreated.",
      suggested_action: "MoveToTrash",
      risk_note: "Review project context first: dependency folders can contain linked packages or local patches.",
      trash_allowed: true,
      selected_by_default: true
    },
    {
      id: "storage-safe-build",
      path: "C:/Users/Zen/Projects/demo/build",
      name: "build",
      size: 640_000_000,
      tier: "Safe",
      category: "Regenerable development output",
      reason: "Build output can usually be recreated.",
      suggested_action: "MoveToTrash",
      risk_note: "Confirm this is generated output before adding it to the cleanup list.",
      trash_allowed: true,
      selected_by_default: false
    },
    {
      id: "storage-review-download",
      path: "C:/Users/Zen/Downloads/course-video.mp4",
      name: "course-video.mp4",
      size: 780_000_000,
      tier: "Review",
      category: "Downloads",
      reason: "User-owned content needs review before cleanup.",
      suggested_action: "Reveal",
      risk_note: "Open the location and review it manually.",
      trash_allowed: false,
      selected_by_default: false
    },
    {
      id: "storage-caution-app",
      path: "C:/Program Files/Example",
      name: "Example",
      size: 2_400_000_000,
      tier: "Caution",
      category: "Application",
      reason: "Use the app uninstaller instead of deleting files directly.",
      suggested_action: "UninstallAdvice",
      risk_note: "Manual deletion can leave services and shared components behind.",
      trash_allowed: false,
      selected_by_default: false
    }
  ] satisfies StorageAnalysis["candidates"];

  return {
    total_size: candidates.reduce((sum, candidate) => sum + candidate.size, 0),
    reclaimable_estimate: candidates
      .filter((candidate) => candidate.tier === "Safe" && candidate.trash_allowed)
      .reduce((sum, candidate) => sum + candidate.size, 0),
    review_estimate: candidates
      .filter((candidate) => candidate.tier === "Review")
      .reduce((sum, candidate) => sum + candidate.size, 0),
    candidates,
    denied_paths: [],
    warnings: []
  };
}

let mockOperationLogState: OperationLog[] | null = null;

function mockOperationLogs(): OperationLog[] {
  if (mockOperationLogState) return mockOperationLogState;
  const makeLog = (overrides: Partial<OperationLog>): OperationLog => ({
    id: "history-default",
    batch_id: "history-batch-a",
    operation_type: "move",
    source_path: "C:/Users/Zen/Documents/example.txt",
    target_path: "C:/Users/Zen/Documents/Organized/example.txt",
    old_name: "example.txt",
    new_name: "example.txt",
    status: "success",
    error_message: null,
    created_at: now,
    can_undo: true,
    path_before: "C:/Users/Zen/Documents/example.txt",
    path_after: "C:/Users/Zen/Documents/Organized/example.txt",
    name_before: "example.txt",
    name_after: "example.txt",
    can_restore: true,
    restored_at: null,
    restore_status: "not_restored",
    restore_error: null,
    ...overrides
  });
  mockOperationLogState = [
    makeLog({
      id: "history-a-restored",
      batch_id: "history-batch-a",
      old_name: "brief-final.pdf",
      new_name: "brief-final.pdf",
      source_path: "C:/Users/Zen/Documents/brief-final.pdf",
      target_path: "C:/Users/Zen/Documents/Work/brief-final.pdf",
      path_before: "C:/Users/Zen/Documents/brief-final.pdf",
      path_after: "C:/Users/Zen/Documents/Work/brief-final.pdf",
      restore_status: "restored",
      restored_at: "2026-07-06T09:08:00.000Z",
      can_restore: false
    }),
    makeLog({
      id: "history-a-restorable",
      batch_id: "history-batch-a",
      old_name: "brief-draft.pdf",
      new_name: "brief-draft.pdf",
      source_path: "C:/Users/Zen/Documents/brief-draft.pdf",
      target_path: "C:/Users/Zen/Documents/Work/brief-draft.pdf",
      path_before: "C:/Users/Zen/Documents/brief-draft.pdf",
      path_after: "C:/Users/Zen/Documents/Work/brief-draft.pdf"
    }),
    makeLog({
      id: "history-a-failed",
      batch_id: "history-batch-a",
      status: "failed",
      old_name: "brief-locked.pdf",
      new_name: "brief-locked.pdf",
      can_restore: false,
      restore_status: "failed",
      restore_error: "The previous operation failed before it created a restorable journal entry."
    }),
    makeLog({
      id: "history-a-skipped",
      batch_id: "history-batch-a",
      status: "skipped",
      old_name: "brief-skipped.pdf",
      new_name: "brief-skipped.pdf",
      can_restore: false,
      restore_status: "unavailable",
      restore_error: "The item was skipped and has no restore source."
    }),
    makeLog({
      id: "history-b-restorable",
      batch_id: "history-batch-b",
      old_name: "photo-2026.png",
      new_name: "photo-2026.png",
      source_path: "C:/Users/Zen/Pictures/photo-2026.png",
      target_path: "C:/Users/Zen/Pictures/Archive/photo-2026.png",
      path_before: "C:/Users/Zen/Pictures/photo-2026.png",
      path_after: "C:/Users/Zen/Pictures/Archive/photo-2026.png"
    }),
    makeLog({
      id: "history-b-missing",
      batch_id: "history-batch-b",
      old_name: "missing-source.docx",
      new_name: "missing-source.docx",
      path_before: "",
      path_after: "",
      can_restore: false,
      restore_status: "unavailable",
      restore_error: "The source file is missing from the restore journal."
    }),
    makeLog({
      id: "history-b-canceled",
      batch_id: "history-batch-b",
      old_name: "canceled-upload.zip",
      new_name: "canceled-upload.zip",
      can_restore: false,
      restore_status: "canceled",
      restore_error: "Restore was canceled before this item was processed."
    }),
    makeLog({
      id: "history-c-restorable",
      batch_id: "history-batch-c",
      old_name: "design-system.fig",
      new_name: "design-system.fig",
      source_path: "C:/Users/Zen/Projects/design-system.fig",
      target_path: "C:/Users/Zen/Projects/Archive/design-system.fig",
      path_before: "C:/Users/Zen/Projects/design-system.fig",
      path_after: "C:/Users/Zen/Projects/Archive/design-system.fig"
    })
  ];
  return mockOperationLogState;
}

function mockRestoreMoves(args?: Record<string, unknown>): RestoreMovesResult {
  const ids = Array.isArray((args?.request as Record<string, unknown> | undefined)?.logIds)
    ? ((args?.request as Record<string, unknown>).logIds as unknown[]).map(String)
    : [];
  const source = mockOperationLogs();
  const logs = ids
    .map((id) => source.find((log) => log.id === id))
    .filter((log): log is OperationLog => Boolean(log))
    .map((log) => {
      const outcome: OperationLog["restore_status"] = log.id === "history-a-restorable"
        ? "restored"
        : log.id === "history-b-restorable"
          ? "failed"
          : "canceled";
      return {
        ...log,
        can_restore: false,
        restored_at: outcome === "restored" ? now : null,
        restore_status: outcome,
        restore_error: outcome === "failed" ? "The destination path is occupied by another file." : outcome === "canceled" ? "Restore was canceled before this item was processed." : null
      };
    });
  mockOperationLogState = source.map((log) => logs.find((updated) => updated.id === log.id) ?? log);
  return {
    logs,
    restored: logs.filter((log) => log.restore_status === "restored").length,
    failed: logs.filter((log) => log.restore_status === "failed").length
  };
}

function mockStorageCleanupStatus(jobId: string): StorageCleanupScanStatus {
  return {
    jobId,
    status: "completed",
    progress: {
      jobId,
      scannedEntries: 48,
      currentPath: "C:/Users/Zen/Projects/demo/node_modules",
      totalSize: mockStorageAnalysis().total_size
    },
    analysis: mockStorageAnalysis(),
    error: null,
    startedAt: Date.now().toString(),
    completedAt: Date.now().toString()
  };
}

function mockCleanupExecutionResult(args?: Record<string, unknown>): CleanupExecutionResult {
  const ids = new Set(Array.isArray(args?.ids) ? args.ids.map(String) : []);
  const logs: CleanupExecutionResult["logs"] = mockStorageAnalysis()
    .candidates
    .filter((candidate) => ids.has(candidate.id))
    .map((candidate) => {
      const allowed =
        candidate.tier === "Safe" &&
        candidate.trash_allowed &&
        candidate.suggested_action === "MoveToTrash";
      return {
        path: candidate.path,
        name: candidate.name,
        size: candidate.size,
        status: allowed ? "success" : "skipped",
        message: allowed
          ? "Moved to the system trash. Restore it from the system trash if needed."
          : "Only safe cleanup candidates can be moved."
      };
    });

  return {
    moved: logs.filter((log) => log.status === "success").length,
    skipped: logs.filter((log) => log.status === "skipped").length,
    failed: 0,
    logs
  };
}

function mockSafeTrashExecutionResult(args?: Record<string, unknown>): CleanupExecutionResult {
  const result = mockCleanupExecutionResult(args);
  return {
    ...result,
    logs: result.logs.map((log, index) => ({
      ...log,
      message: log.status === "success"
        ? "Moved to Zen Canvas Safe Trash. Restore it from Recovery records."
        : log.message,
      itemId: `browser-cleanup-item-${index}`,
      trashPath: `C:/Users/Zen/.zen-canvas-trash/items/browser-cleanup-batch/item-${index}/${log.name}`
    }))
  };
}

function mockAnalyzeCleanupCandidatesWithAI(args?: Record<string, unknown>): StorageCandidate[] {
  const requested = new Set(
    Array.isArray(args?.ids)
      ? args.ids.filter((id): id is string => typeof id === "string")
      : []
  );
  return mockStorageAnalysis().candidates
    .filter((candidate) => requested.has(candidate.id))
    .map((candidate) => {
      if (candidate.tier === "Safe") {
        return {
          ...candidate,
          reason: `AI 风险说明：${candidate.reason}`,
          risk_note: candidate.risk_note
            ? `AI 分析后建议：${candidate.risk_note}`
            : "AI 分析后建议：清理前确认没有本地补丁或未提交依赖改动。"
        };
      }
      return {
        ...candidate,
        selected_by_default: false,
        reason: `AI 风险说明：${candidate.reason}`,
        risk_note: candidate.risk_note
          ? `AI 分析后建议：${candidate.risk_note}`
          : "AI 分析后建议：保持人工确认。"
      };
    });
}

function mockCleanupTrashBatches(): CleanupTrashBatch[] {
  const movedAt = mockCleanupCreatedAt;
  const items: CleanupTrashBatch["items"] = [
    {
      id: "browser-cleanup-restorable-0",
      batchId: "browser-cleanup-batch",
      originalPath: "C:/Users/Zen/Projects/demo/node_modules",
      trashPath: "C:/Users/Zen/.zen-canvas-trash/items/browser-cleanup-batch/item-0/node_modules",
      name: "node_modules",
      size: 1_850_000_000,
      movedAt,
      restoredAt: null,
      status: "moved",
      message: "Moved to Zen Canvas Safe Trash."
    },
    {
      id: "browser-cleanup-restorable-1",
      batchId: "browser-cleanup-batch",
      originalPath: "C:/Users/Zen/Projects/demo/dist",
      trashPath: "C:/Users/Zen/.zen-canvas-trash/items/browser-cleanup-batch/item-1/dist",
      name: "dist",
      size: 120_000_000,
      movedAt,
      restoredAt: null,
      status: "moved",
      message: "Moved to Zen Canvas Safe Trash."
    },
    {
      id: "browser-cleanup-conflict",
      batchId: "browser-cleanup-batch",
      originalPath: "C:/Users/Zen/Projects/demo/cache",
      trashPath: "C:/Users/Zen/.zen-canvas-trash/items/browser-cleanup-batch/item-2/cache",
      name: "cache",
      size: 12_000_000,
      movedAt,
      restoredAt: null,
      status: "moved",
      message: "Restore blocked because the original path already exists."
    },
    {
      id: "browser-cleanup-missing",
      batchId: "browser-cleanup-batch",
      originalPath: "C:/Users/Zen/Projects/demo/temp",
      trashPath: "C:/Users/Zen/.zen-canvas-trash/items/browser-cleanup-batch/item-3/temp",
      name: "temp",
      size: 8_000_000,
      movedAt,
      restoredAt: null,
      status: "missing",
      message: "Safe trash path is missing."
    },
    {
      id: "browser-cleanup-restored",
      batchId: "browser-cleanup-batch",
      originalPath: "C:/Users/Zen/Projects/demo/old-build",
      trashPath: "C:/Users/Zen/.zen-canvas-trash/items/browser-cleanup-batch/item-4/old-build",
      name: "old-build",
      size: 14_000_000,
      movedAt,
      restoredAt: "2026-07-06T09:12:00.000Z",
      status: "restored",
      message: "Restored from Zen Canvas Safe Trash."
    }
  ];
  return [
    {
      id: "browser-cleanup-batch",
      createdAt: movedAt,
      root: "C:/Users/Zen/Projects/demo",
      totalItems: 5,
      totalSize: 2_004_000_000,
      status: "success",
      items: items.map((item) => ({
        ...item,
        ...(mockCleanupRestoreState.get(item.id) ?? {})
      }))
    }
  ];
}

function mockCleanupRestorePreviewItem(item: CleanupTrashBatch["items"][number]): CleanupRestorePreview["items"][number] {
  const blockingReason = item.id === "browser-cleanup-conflict"
    ? "conflict"
    : item.id === "browser-cleanup-missing"
      ? "missing"
      : item.status === "restored"
        ? "already restored"
        : item.status === "moved"
          ? null
          : item.status;
  return {
    ...item,
    canRestore: blockingReason === null,
    blockingReason
  };
}

function mockCleanupRestoreResult(args?: Record<string, unknown>): CleanupRestoreResult {
  const ids = Array.isArray(args?.itemIds) ? args.itemIds.map(String) : [];
  const logs = ids.map((itemId) => {
    const item = mockCleanupTrashBatches()[0]?.items.find((candidate) => candidate.id === itemId);
    const status: CleanupRestoreResult["logs"][number]["status"] = item?.id === "browser-cleanup-conflict"
      ? "conflict"
      : item?.status === "missing"
        ? "missing"
        : item?.id === "browser-cleanup-restorable-1"
          ? "failed"
          : item?.status === "moved"
            ? "restored"
            : "failed";
    if (item && status === "restored") {
      mockCleanupRestoreState.set(item.id, {
        status: "restored",
        restoredAt: new Date().toISOString(),
        message: "Restored from Zen Canvas Safe Trash."
      });
    }
    return {
      itemId,
      originalPath: item?.originalPath ?? "",
      trashPath: item?.trashPath ?? "",
      status,
      message: status === "conflict"
        ? "The destination path is occupied by another file."
        : status === "missing"
          ? "The safe trash source is missing."
          : status === "failed"
            ? "Restore failed."
            : "Restored from Zen Canvas Safe Trash."
    };
  });
  return {
    restored: logs.filter((log) => log.status === "restored").length,
    conflicts: logs.filter((log) => log.status === "conflict").length,
    missing: logs.filter((log) => log.status === "missing").length,
    failed: logs.filter((log) => log.status === "failed").length,
    canceled: 0,
    logs
  };
}

function mockCleanupPreviewCandidates(args?: Record<string, unknown>): CleanupPreviewItem[] {
  const ids = new Set(Array.isArray(args?.ids) ? args.ids.map(String) : []);
  return mockStorageAnalysis()
    .candidates
    .filter((candidate) => ids.has(candidate.id))
    .filter((candidate) => candidate.tier === "Safe" && candidate.trash_allowed)
    .map((candidate) => ({
      id: `cleanup-preview-${candidate.id}`,
      candidate_id: candidate.id,
      path: candidate.path,
      name: candidate.name,
      size: candidate.size,
      tier: candidate.tier,
      category: candidate.category,
      reason: candidate.reason,
      operation_type: "move_to_trash_preview",
      target_path: "Recycle Bin",
      status: "pending",
      requires_confirmation: true,
      is_executable: false,
      blocking_reason: "Browser mock preview only"
    }));
}

function mockCleanupPreviewOperations(args?: Record<string, unknown>): OperationPreviewResult {
  const ids = new Set(Array.isArray(args?.ids) ? args.ids.map(String) : []);
  const previews: OperationPreview[] = mockStorageAnalysis()
    .candidates
    .filter((candidate) => ids.has(candidate.id))
    .filter((candidate) => candidate.tier === "Safe" && candidate.trash_allowed)
    .map((candidate) => ({
      id: `cleanup-trash-${candidate.id}`,
      fileId: candidate.id,
      operation_type: "move_to_trash",
      source_path: candidate.path,
      target_path: "Recycle Bin",
      old_name: candidate.name,
      new_name: candidate.name,
      status: "pending",
      risk_level: "Normal",
      confidence: 1,
      requires_confirmation: true,
      suggested_action: "DeleteCandidate",
      is_duplicate: false,
      reason: candidate.reason,
      selected_by_default: true,
      is_executable: true,
      editable_new_name: false,
      target_parent_exists: true,
      will_create_parent: false
    }));

  return {
    previews,
    total: previews.length,
    limit: previews.length,
    offset: 0,
    truncated: false,
    hasMore: false
  };
}

function mockSettings(settings?: AppSettings): AppSettings {
  return settings ?? {
    closeBehavior: "ask",
    folderNamingLanguage: "en",
    defaultScanFolders: [],
    restoreRetentionDays: 30,
    launchAtLogin: false,
    backgroundIndexOnStartup: true,
    searchHotkey: DEFAULT_SEARCH_HOTKEY,
    searchScopeMode: "all",
    customSearchRoots: [],
    organizeRootMode: "current_folder",
    organizeRootPath: undefined,
    useLegacyBuiltinClassificationRules: false,
    useLearnedRulesAsAutoRules: false
  };
}

let persistedMockSettings: AppSettings | undefined;
let mockSettingsRevision = 0;

function getMockVersionedSettings(): VersionedAppSettings {
  return {
    settings: persistedMockSettings ?? mockSettings(),
    revision: mockSettingsRevision
  };
}

function saveMockVersionedSettings(request: SaveSettingsRequest): VersionedAppSettings {
  if (request.expectedRevision !== mockSettingsRevision) {
    throw new Error("settings_revision_conflict");
  }
  persistedMockSettings = request.settings;
  mockSettingsRevision += 1;
  return getMockVersionedSettings();
}

let mockAISettingsState: AISettings | null = null;
let mockApiKeyConfigured = false;

function mockAISettings(settings?: AISettings): AISettings {
  if (settings) {
    const action = settings.apiKeyAction ?? (settings.apiKey.trim() ? "replace" : "preserve");
    if (action === "replace") {
      if (!settings.apiKey.trim()) throw new Error("Replacing the AI API key requires a non-empty value.");
      mockApiKeyConfigured = true;
    } else if (action === "clear") {
      mockApiKeyConfigured = false;
    }
    mockAISettingsState = {
      ...settings,
      apiKey: "",
      apiKeyAction: "preserve",
      apiKeyConfigured: mockApiKeyConfigured
    };
    return { ...mockAISettingsState };
  }
  if (mockAISettingsState) return { ...mockAISettingsState };
  return {
    enabled: false,
    provider: "openai_compatible",
    preset: "deepseek",
    baseUrl: "https://api.deepseek.com",
    chatPath: "/chat/completions",
    apiKey: "",
    apiKeyAction: "preserve",
    apiKeyConfigured: mockApiKeyConfigured,
    model: "deepseek-v4-flash",
    temperature: 0,
    maxTokens: 1024,
    batchSize: 10,
    classificationConcurrency: 2,
    timeoutSeconds: 120,
    sendFullPath: false,
    sendParentPath: true,
    classificationMode: "ai_first",
    cleanupAiEnabled: true,
    forceJsonOutput: false,
    enableThinking: false,
    reasoningEffort: null,
    extraBodyJson: null
  };
}

function mockAIProviderPresets(): AIProviderPreset[] {
  return [
    ["deepseek", "DeepSeek — Recommended", "https://api.deepseek.com", "deepseek-v4-flash", true, true, true],
    ["kimi", "Kimi / Moonshot", "https://api.moonshot.cn/v1", "kimi-k2.7-code-highspeed", true, false, false],
    ["qwen_dashscope", "Qwen / DashScope", "https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen-plus", false, false, false],
    ["zhipu_glm", "Zhipu GLM", "https://open.bigmodel.cn/api/paas/v4", "glm-4.5", false, false, false],
    ["minimax", "MiniMax", "https://api.minimax.chat/v1", "", false, false, false],
    ["baichuan", "Baichuan", "", "", false, false, false],
    ["doubao_ark", "Doubao / Volcengine Ark", "https://ark.cn-beijing.volces.com/api/v3", "", false, false, false],
    ["siliconflow", "SiliconFlow", "https://api.siliconflow.cn/v1", "", false, false, false],
    ["custom_openai_compatible", "Custom OpenAI-compatible", "", "", false, false, false],
    ["ollama", "Ollama — Local model", "http://localhost:11434", "qwen3:8b", false, true, false]
  ].map(([id, label, defaultBaseUrl, defaultModel, supportsResponseFormat, supportsThinking, supportsReasoningEffort]) => ({
    id: id as AIProviderPreset["id"],
    label: String(label),
    providerKind: id === "ollama" ? "ollama" : "openai_compatible",
    defaultBaseUrl: String(defaultBaseUrl),
    defaultChatPath: id === "ollama" ? "/api/chat" : "/chat/completions",
    defaultModel: String(defaultModel),
    supportsResponseFormat: Boolean(supportsResponseFormat),
    supportsJsonMode: true,
    supportsThinking: Boolean(supportsThinking),
    supportsReasoningEffort: Boolean(supportsReasoningEffort)
  }));
}

function mockAIConnectionTest(settings?: AISettings): AIConnectionTestResult {
  const resolved = settings ? { ...settings } : mockAISettings();
  return {
    ok: true,
    message: "{\"ok\":true}",
    model: resolved.model,
    provider: resolved.provider,
    preset: resolved.preset,
    elapsedMs: 32
  };
}

function mockAIDebugClassification(args?: Record<string, unknown>): AIDebugClassificationResult {
  const settings = mockAISettings();
  const fileId = String(args?.target ?? args?.fileId ?? "mock-report");
  const rawResponsePreview = JSON.stringify({
    choices: [
      {
        finish_reason: "stop",
        message: {
          role: "assistant",
          content: JSON.stringify({
            classifications: [
              {
                refId: "f1",
                fileType: "Document",
                purpose: "Work",
                lifecycle: "Active",
                riskLevel: "Normal",
                suggestedAction: "Move",
                targetTemplate: "Work/Reports",
                confidence: 0.86,
                reason: "Browser mock debug response."
              }
            ]
          })
        }
      }
    ]
  }, null, 2);

  return {
    provider: settings.provider,
    preset: settings.preset,
    model: settings.model,
    baseUrl: settings.baseUrl,
    chatPath: settings.chatPath,
    forceJsonOutput: settings.forceJsonOutput,
    enableThinking: settings.enableThinking,
    maxTokens: settings.maxTokens,
    batchSize: settings.batchSize,
    requestUsedResponseFormat: false,
    requestUsedThinkingField: "disabled",
    httpStatus: 200,
    providerResponseSummary: "has_choices=true; choice_count=1; finish_reason=stop; message_keys=[content,role]; content_type=string; content_length=180; has_reasoning_content=false; reasoning_content_length=0",
    rawResponsePreview,
    messageContentPreview: "{\"classifications\":[{\"refId\":\"f1\",\"fileType\":\"Document\"}]}",
    reasoningContentPreview: "",
    extractedContentPreview: "{\"classifications\":[{\"refId\":\"f1\",\"fileType\":\"Document\"}]}",
    cleanedContentPreview: "{\"classifications\":[{\"refId\":\"f1\",\"fileType\":\"Document\"}]}",
    parseStage: "parse_ai_classification_response",
    parseError: null,
    success: true,
    refId: "f1",
    realFileId: fileId,
    path: "C:/Users/Zen/Documents/project-report.pdf",
    modelReturnedRefId: "f1",
    modelReturnedId: null,
    idMappingMatched: true,
    missingOptionalFields: ["suggestedName", "keywords", "context", "requiresConfirmation"],
    fallbackApplied: true,
    itemParseWarnings: ["requiresConfirmation missing; safe fallback applied"]
  };
}

function mockAIClassifyFiles(args?: Record<string, unknown>): RuleExecutionSummary {
  const options = args?.options as {
    pendingOnly?: boolean;
    onlyUnclassified?: boolean;
    onlyLowConfidence?: boolean;
    limit?: number;
    force?: boolean;
    allowOverwriteUserCorrections?: boolean;
  } | null | undefined;
  const limit = Math.max(1, Number(options?.limit ?? mockFiles.length));
  const candidates = mockFiles
    .filter((file) => !options?.pendingOnly || (
      file.classification_status !== "classified"
      || file.confidence < 0.65
      || file.requires_confirmation
    ))
    .filter((file) => !options?.onlyUnclassified || file.classification_status !== "classified")
    .filter((file) => !options?.onlyLowConfidence || file.confidence < 0.65)
    .filter((file) => {
      const protectedByUser = file.matched_rules.some((rule) =>
        rule === "user_correction"
        || rule === "user_confirmed"
        || rule === "manual"
        || rule.startsWith("learned:")
      );
      if (protectedByUser && !options?.allowOverwriteUserCorrections) return false;
      if (options?.force) return true;
      return !(
        file.classification_status === "classified"
        && !file.requires_confirmation
        && file.matched_rules.some((rule) => rule.startsWith("ai:"))
      );
    })
    .slice(0, limit);
  return applyMockAIClassification(candidates);
}

function mockAIClassifySelectedFiles(args?: Record<string, unknown>): RuleExecutionSummary {
  const ids = new Set(Array.isArray(args?.fileIds) ? args.fileIds.map(String) : []);
  return applyMockAIClassification(mockFiles.filter((file) => ids.has(file.id)));
}

function mockCorrectClassification(args?: Record<string, unknown>): void {
  const fileId = String(args?.fileId ?? "");
  const correction = args?.correction as ClassificationCorrectionRequest | undefined;
  const file = mockFiles.find((item) => item.id === fileId);
  if (!file || !correction) return;
  file.file_type = correction.fileType;
  file.purpose = correction.purpose;
  file.lifecycle = correction.lifecycle;
  file.context = correction.context;
  file.risk_level = correction.riskLevel;
  file.suggested_action = correction.suggestedAction;
  file.suggested_target_path = correction.targetTemplate;
  file.suggested_name = correction.suggestedName ?? "";
  file.classification_reason = correction.reason || "User corrected classification.";
  file.classification_status = "classified";
  file.matched_rules = ["learned:browser-mock"];
  file.confidence = 1;
  file.requires_confirmation = correction.riskLevel === "Sensitive" || correction.suggestedAction === "Review";
}

function applyMockAIClassification(files: FileRecord[]): RuleExecutionSummary {
  for (const file of files) {
    file.classification_status = "classified";
    file.classification_reason = "AI browser mock classified this file from metadata only.";
    file.matched_rules = ["ai:browser-mock:model"];
    file.confidence = Math.max(file.confidence, 0.82);
    if (file.purpose === "Unknown") file.purpose = "Work";
    if (file.suggested_action === "Keep") {
      file.suggested_action = "Move";
      file.suggested_target_path = `${file.directory}/ZenCanvas/${file.file_type}`;
    }
    file.requires_confirmation = file.requires_confirmation || file.confidence < 0.65 || file.risk_level === "Sensitive";
  }
  return {
    scanned: files.length,
    updated: files.length,
    skipped: 0,
    needsConfirmation: files.filter((file) => file.requires_confirmation).length
  };
}

function file(overrides: Partial<FileRecord>): FileRecord {
  return {
    id: "mock-file",
    name: "file.txt",
    path: "C:/Users/Zen/Documents/file.txt",
    directory: "C:/Users/Zen/Documents",
    extension: "txt",
    size: 1024,
    file_type: "Document",
    purpose: "Unknown",
    lifecycle: "Inbox",
    context: "Browser mock",
    risk_level: "Normal",
    hash: null,
    created_at: now,
    modified_at: now,
    scanned_at: now,
    last_seen_at: now,
    is_hidden: false,
    is_deleted: false,
    is_duplicate: false,
    suggested_action: "Keep",
    suggested_target_path: "",
    suggested_name: "",
    confidence: 0.5,
    classification_reason: "Browser mock data",
    classification_status: "classified",
    matched_rules: [],
    requires_confirmation: false,
    ...overrides
  };
}

function countBy<T extends keyof FileRecord>(files: FileRecord[], key: T): Record<string, number> {
  return files.reduce<Record<string, number>>((counts, item) => {
    const value = String(item[key]);
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}
