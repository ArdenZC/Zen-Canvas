import { beforeEach, describe, expect, it, vi } from "vitest";
import { tauriApi } from "../src/api/tauriApi";
import type { LibraryScope } from "../src/types/domain";

const apiMocks = vi.hoisted(() => ({
  invoke: vi.fn()
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: apiMocks.invoke
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn()
}));

describe("tauriApi", () => {
  beforeEach(() => {
    delete (globalThis as typeof globalThis & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    apiMocks.invoke.mockReset().mockResolvedValue({
      files: [],
      total: 0,
      limit: 50,
      offset: 0
    });
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
    await tauriApi.scanStorageCleanup();
    await tauriApi.revealStorageCandidate("F:/Downloads/big.zip");
    await tauriApi.previewCleanupCandidates(["storage-safe-1"]);
    await tauriApi.previewCleanupOperations(["storage-safe-1"]);

    expect(apiMocks.invoke).toHaveBeenNthCalledWith(1, "scan_storage_cleanup", undefined);
    expect(apiMocks.invoke).toHaveBeenNthCalledWith(2, "reveal_storage_candidate", {
      path: "F:/Downloads/big.zip"
    });
    expect(apiMocks.invoke).toHaveBeenNthCalledWith(3, "preview_cleanup_candidates", {
      ids: ["storage-safe-1"]
    });
    expect(apiMocks.invoke).toHaveBeenNthCalledWith(4, "preview_cleanup_operations", {
      ids: ["storage-safe-1"]
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

  it("reads and refreshes global hotkey registration status", async () => {
    await tauriApi.getGlobalHotkeyStatus();
    await tauriApi.registerGlobalSearchHotkey("Alt+Space");

    expect(apiMocks.invoke).toHaveBeenNthCalledWith(1, "get_global_hotkey_status", undefined);
    expect(apiMocks.invoke).toHaveBeenNthCalledWith(2, "register_global_search_hotkey", {
      accelerator: "Alt+Space"
    });
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
