import type {
  AppSettings,
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
  StorageAnalysis
} from "../types/domain";
import type { View } from "../types/ui";
import { DEFAULT_SEARCH_HOTKEY } from "../utils/hotkeys";
import type {
  GlobalHotkeyStatus,
  RuleExecutionSummary,
  ScanSummary
} from "./tauriApi";

const now = "2026-07-06T09:00:00.000Z";

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
    case "scan_directory":
      return {
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
      return { logs: [], restored: 0, failed: 0 } satisfies RestoreMovesResult as T;
    case "get_operation_logs":
      return [] satisfies OperationLog[] as T;
    case "get_operation_previews_for_scope":
      return mockOperationPreviews(args) as T;
    case "scan_storage_cleanup":
      return mockStorageAnalysis() as T;
    case "preview_cleanup_candidates":
      return mockCleanupPreviewCandidates(args) as T;
    case "execute_rules_on_inbox":
    case "execute_rules_for_paths":
    case "execute_rules_for_scope":
      return {
        scanned: mockFiles.length,
        updated: mockFiles.filter((item) => item.classification_status === "unclassified").length,
        skipped: 0,
        needsConfirmation: mockFiles.filter((item) => item.requires_confirmation).length
      } satisfies RuleExecutionSummary as T;
    case "get_user_rules":
      return mockRules as T;
    case "save_user_rule":
      return args?.rule as T;
    case "delete_user_rule":
      return true as T;
    case "get_settings":
    case "save_settings":
      return mockSettings(args?.settings as AppSettings | undefined) as T;
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
      return undefined as T;
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
    denied_paths: []
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
    organizeRootPath: undefined
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
