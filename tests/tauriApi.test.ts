import { beforeEach, describe, expect, it, vi } from "vitest";
import { tauriApi } from "../src/api/tauriApi";
import type { LibraryScope } from "../src/types/domain";

const apiMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn()
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: apiMocks.invoke
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: apiMocks.listen
}));

describe("tauriApi", () => {
  it("does not expose the legacy unscoped cleanup scan", () => {
    expect("scanStorageCleanup" in tauriApi).toBe(false);
  });

  beforeEach(() => {
    delete (globalThis as typeof globalThis & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    apiMocks.invoke.mockReset().mockResolvedValue({
      files: [],
      total: 0,
      limit: 50,
      offset: 0
    });
    apiMocks.listen.mockReset().mockResolvedValue(() => undefined);
  });

  it("reads backend runtime capabilities before exposing optional UI", async () => {
    await tauriApi.getRuntimeCapabilities();
    expect(apiMocks.invoke).toHaveBeenCalledWith("get_runtime_capabilities", undefined);
  });

  it("sends paged library filters alongside query and scope", async () => {
    const scope: LibraryScope = { kind: "roots", roots: ["F:/Downloads"] };

    await tauriApi.getPagedFiles(50, 25, "pdf", scope, { libraryFilter: "review" });

    expect(apiMocks.invoke).toHaveBeenCalledWith("get_paged_files", {
      limit: 50,
      offset: 25,
      query: "pdf",
      scope,
      filter: { libraryFilter: "review" }
    });
  });

  it("requests operation previews for a full library scope", async () => {
    const scope: LibraryScope = { kind: "roots", roots: ["F:/Downloads"] };

    await tauriApi.getOperationPreviewsForScope(scope, { libraryFilter: "active" }, 500, 1000);

    expect(apiMocks.invoke).toHaveBeenCalledWith("get_operation_previews_for_scope", {
      scope,
      filter: { libraryFilter: "active" },
      limit: 500,
      offset: 1000
    });
  });

  it("calls storage cleanup commands with conservative arguments", async () => {
    await tauriApi.startStorageCleanupScan(["F:/Downloads"]);
    await tauriApi.getStorageCleanupScanStatus("job-1");
    await tauriApi.cancelStorageCleanupScan("job-1");
    await tauriApi.revealStorageCandidate("F:/Downloads/big.zip");
    await tauriApi.previewCleanupCandidates("job-1", ["storage-safe-1"]);
    await tauriApi.previewCleanupOperations("job-1", ["storage-safe-1"]);
    await tauriApi.analyzeCleanupCandidatesWithAI("job-1", ["storage-safe-1"]);
    await tauriApi.moveCleanupCandidatesToTrash("job-1", ["storage-safe-1"]);
    await tauriApi.moveCleanupCandidatesToSafeTrash("job-1", ["storage-safe-1"]);
    await tauriApi.listCleanupTrashBatches();
    await tauriApi.previewRestoreCleanupTrash("batch-1");
    await tauriApi.restoreCleanupTrashItems(["item-1"]);
    await tauriApi.cancelCleanupRestore("cleanup-job-1");

    expect(apiMocks.invoke).toHaveBeenNthCalledWith(1, "start_storage_cleanup_scan", {
      roots: ["F:/Downloads"]
    });
    expect(apiMocks.invoke).toHaveBeenNthCalledWith(2, "get_storage_cleanup_scan_status", {
      jobId: "job-1"
    });
    expect(apiMocks.invoke).toHaveBeenNthCalledWith(3, "cancel_storage_cleanup_scan", {
      jobId: "job-1"
    });
    expect(apiMocks.invoke).toHaveBeenNthCalledWith(4, "reveal_storage_candidate", {
      path: "F:/Downloads/big.zip"
    });
    expect(apiMocks.invoke).toHaveBeenNthCalledWith(5, "preview_cleanup_candidates", {
      jobId: "job-1",
      ids: ["storage-safe-1"]
    });
    expect(apiMocks.invoke).toHaveBeenNthCalledWith(6, "preview_cleanup_operations", {
      jobId: "job-1",
      ids: ["storage-safe-1"]
    });
    expect(apiMocks.invoke).toHaveBeenNthCalledWith(7, "analyze_cleanup_candidates_with_ai", {
      jobId: "job-1",
      ids: ["storage-safe-1"]
    });
    expect(apiMocks.invoke).toHaveBeenNthCalledWith(8, "move_cleanup_candidates_to_trash", {
      jobId: "job-1",
      ids: ["storage-safe-1"]
    });
    expect(apiMocks.invoke).toHaveBeenNthCalledWith(9, "move_cleanup_candidates_to_safe_trash", {
      jobId: "job-1",
      ids: ["storage-safe-1"]
    });
    expect(apiMocks.invoke).toHaveBeenNthCalledWith(10, "list_cleanup_trash_batches", undefined);
    expect(apiMocks.invoke).toHaveBeenNthCalledWith(11, "preview_restore_cleanup_trash", {
      batchId: "batch-1"
    });
    expect(apiMocks.invoke).toHaveBeenNthCalledWith(12, "restore_cleanup_trash_items", {
      itemIds: ["item-1"],
      jobId: null
    });
    expect(apiMocks.invoke).toHaveBeenNthCalledWith(13, "cancel_cleanup_restore", {
      jobId: "cleanup-job-1"
    });
  });

  it("sends explicit rule execution mode for scoped rule runs", async () => {
    const scope: LibraryScope = { kind: "roots", roots: ["F:/Downloads"] };

    await tauriApi.executeRulesForScope(scope, [], "all_changed_or_rule_changed");

    expect(apiMocks.invoke).toHaveBeenCalledWith("execute_rules_for_scope", {
      scope,
      rules: [],
      mode: "all_changed_or_rule_changed"
    });
  });

  it("exposes AI classification cancellation and progress events", async () => {
    apiMocks.listen.mockResolvedValueOnce(() => undefined);

    await tauriApi.cancelAIClassification();
    await tauriApi.onAIClassificationProgress(() => undefined);

    expect(apiMocks.invoke).toHaveBeenCalledWith("cancel_ai_classification", undefined);
    expect(apiMocks.listen).toHaveBeenCalledWith("ai-classification-progress", expect.any(Function));
  });

  it("reads and refreshes global hotkey registration status", async () => {
    await tauriApi.getGlobalHotkeyStatus();
    await tauriApi.registerGlobalSearchHotkey("Alt+Space");

    expect(apiMocks.invoke).toHaveBeenNthCalledWith(1, "get_global_hotkey_status", undefined);
    expect(apiMocks.invoke).toHaveBeenNthCalledWith(2, "register_global_search_hotkey", {
      accelerator: "Alt+Space"
    });
  });

  it("subscribes to the native global-search fallback event", async () => {
    apiMocks.listen.mockResolvedValueOnce(() => undefined);

    await tauriApi.onGlobalSearchRequested(() => undefined);

    expect(apiMocks.listen).toHaveBeenCalledWith("global-search-requested", expect.any(Function));
  });

  it("falls back to browser mock data when the Tauri runtime is unavailable in dev", async () => {
    apiMocks.invoke.mockRejectedValueOnce(new Error("Cannot read properties of undefined (reading 'invoke')"));

    const result = await tauriApi.getPagedFiles(50, 0, "report", { kind: "all" });

    expect(result.files.length).toBeGreaterThan(0);
    expect(result.files[0].name).toContain("report");
  });

  it("treats partial Tauri internals as unavailable in browser preview", async () => {
    (globalThis as typeof globalThis & { __TAURI_INTERNALS__?: { transformCallback?: unknown } }).__TAURI_INTERNALS__ = {};
    apiMocks.invoke.mockRejectedValueOnce(new Error("Cannot read properties of undefined (reading 'transformCallback')"));

    const result = await tauriApi.getPagedFiles(50, 0, "report", { kind: "all" });

    expect(result.files.length).toBeGreaterThan(0);
    expect(result.files[0].name).toContain("report");
  });

  it("returns a noop listener when the Tauri event runtime is unavailable in dev", async () => {
    const { listen } = await import("@tauri-apps/api/event");
    vi.mocked(listen).mockRejectedValueOnce(new Error("Cannot read properties of undefined (reading 'listen')"));

    const dispose = await tauriApi.onSearchNavigate(() => undefined);

    expect(dispose()).toBeUndefined();
  });
});
