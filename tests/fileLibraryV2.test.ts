import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { mockInvokeCommand } from "../src/api/browserMockApi";
import { tauriApi } from "../src/api/tauriApi";
import {
  defaultFileLibraryQuerySpec,
  useFileLibraryQueryStore,
  useFileLibrarySelectionStore
} from "../src/store/useFileLibraryV2Store";
import type {
  FileQueryRequestV2,
  FileQueryResponseV2,
  LibrarySavedView,
  LibrarySelectionV1,
  UserTag
} from "../src/types/domain";

function read(relativePath: string) {
  return readFileSync(resolve(relativePath), "utf8");
}

function request(overrides: Partial<FileQueryRequestV2> = {}): FileQueryRequestV2 {
  return {
    version: 2,
    requestId: `task05-${Date.now()}`,
    query: {
      ...defaultFileLibraryQuerySpec,
      filters: {
        ...defaultFileLibraryQuerySpec.filters,
        fileTypes: [],
        purposes: [],
        lifecycles: [],
        risks: [],
        tagsAllOf: [],
        tagsAnyOf: [],
        tagsNoneOf: []
      }
    },
    pageSize: 2,
    cursor: null,
    ...overrides
  };
}

describe("Task 05 File Library Query V2 contracts", () => {
  it("keeps query, summary/detail, selection, tags and Saved Views server-authoritative", () => {
    const vault = read("src/views/vault/VaultView.tsx");
    const store = read("src/store/useFileLibraryV2Store.ts");
    const library = read("src-tauri/src/db/queries/library.rs");
    const commands = read("src-tauri/src/db/commands.rs");

    expect(vault).not.toContain("collectLibraryPages");
    expect(vault).not.toContain("getPagedFiles");
    expect(store).toContain("queryFileLibraryV2");
    expect(store).toContain("useFileLibraryQueryStore");
    expect(store).toContain("useFileLibraryResultStore");
    expect(store).toContain("useFileLibrarySelectionStore");
    expect(store).toContain("useFileLibraryInspectorStore");
    expect(store).toContain("useFileLibraryTagStore");
    expect(store).toContain("useFileLibrarySavedViewStore");
    expect(library).toContain("FileQuerySpecV2");
    expect(library).toContain("LIMIT ?");
    const queryImplementation = library.slice(
      library.indexOf("pub fn query_file_library_v2"),
      library.indexOf("pub fn resolve_file_library_exact_count_v2")
    );
    expect(queryImplementation).not.toContain("OFFSET");
    expect(library).not.toContain("GlobalIndex");
    expect(library).toContain("LibrarySelectionV1");
    expect(library).toContain("bump_library_query_revision_in_transaction");
    expect(library).not.toContain("suggested_name, content_hash");
    expect(commands).toContain("resolve_file_library_path(&file_id)");
    expect(commands).toContain("file_id: String");
  });

  it("keeps all_matching selection bound to the canonical query snapshot", () => {
    useFileLibrarySelectionStore.getState().clear();
    useFileLibraryQueryStore.getState().setSpec(defaultFileLibraryQuerySpec);
    useFileLibraryQueryStore.getState().applyResponse({
      version: 2,
      requestId: "selection-contract",
      queryFingerprint: "fingerprint",
      snapshotRevision: 7,
      files: [],
      totalCount: 0,
      countState: "exact",
      countToken: null,
      nextCursor: null,
      hasMore: false,
      resultState: "empty",
      scopeHealth: { state: "healthy", roots: [], invalidReferences: [], message: null }
    });

    useFileLibrarySelectionStore.getState().selectAllMatching();
    const selected = useFileLibrarySelectionStore.getState().selection;
    expect(selected).toMatchObject({
      kind: "all_matching",
      queryFingerprint: "fingerprint",
      snapshotRevision: 7,
      excludedFileIds: []
    });
    if (selected?.kind === "all_matching") {
      useFileLibrarySelectionStore.getState().toggle("file-excluded", [], false);
      expect(useFileLibrarySelectionStore.getState().selection).toMatchObject({
        kind: "all_matching",
        excludedFileIds: ["file-excluded"]
      });
    }
    useFileLibrarySelectionStore.getState().clear();
  });

  it("keeps browser mock parity without pretending to reveal or persist natively", async () => {
    const first = await mockInvokeCommand<FileQueryResponseV2>("query_file_library_v2", {
      request: request()
    });
    expect(first.version).toBe(2);
    expect(first.files.length).toBeLessThanOrEqual(2);
    expect(first.queryFingerprint).toHaveLength(64);
    expect(first.files[0]).not.toHaveProperty("path");

    if (first.nextCursor) {
      const second = await mockInvokeCommand<FileQueryResponseV2>("query_file_library_v2", {
        request: request({ cursor: first.nextCursor })
      });
      expect(second.files.map((file) => file.id)).not.toEqual(first.files.map((file) => file.id));
    }

    const tagName = `Task 05 ${Date.now()}`;
    const tag = await mockInvokeCommand<UserTag>("create_user_tag", {
      request: { displayName: tagName, colorToken: "blue" }
    });
    const selection: LibrarySelectionV1 = { kind: "explicit", fileIds: ["mock-report"] };
    await mockInvokeCommand("mutate_file_user_tags", {
      request: { selection, tagIds: [tag.id], operation: "add", expectedCount: 1 }
    });
    const tagged = await mockInvokeCommand<FileQueryResponseV2>("query_file_library_v2", {
      request: request({
        query: {
          ...request().query,
          filters: { ...request().query.filters, tagsAllOf: [tag.id] }
        }
      })
    });
    expect(tagged.files.map((file) => file.id)).toContain("mock-report");

    const view = await mockInvokeCommand<LibrarySavedView>("create_library_saved_view", {
      request: { displayName: `Task 05 View ${Date.now()}`, query: request().query, position: 0 }
    });
    expect(view.query).not.toHaveProperty("cursor");
    expect(JSON.stringify(view)).not.toContain("selectedIds");
    await expect(mockInvokeCommand("reveal_file_library_entry", { fileId: "mock-report" })).rejects.toThrow("browser_mock_reveal_unavailable");
  });

  it("keeps production mutation paths on the single revision owner", () => {
    for (const relativePath of [
      "src-tauri/src/db/queries/files.rs",
      "src-tauri/src/db/queries/scan.rs",
      "src-tauri/src/db/queries/dedupe.rs",
      "src-tauri/src/db/classification/engine.rs",
      "src-tauri/src/ai/classification.rs",
      "src-tauri/src/db/learning.rs"
    ]) {
      expect(read(relativePath), relativePath).toContain("bump_library_query_revision_in_transaction");
    }
    expect(tauriApi.revealFileLibraryEntry.length).toBe(1);
  });

  it("keeps browser organization review durable in memory but denies native execution", async () => {
    const plan = await mockInvokeCommand<any>("create_organization_plan", {
      request: {
        version: 1,
        requestId: "browser-plan-contract",
        title: "Browser review",
        source: { kind: "explicit", fileIds: ["mock-report"] },
        expectedCount: 1
      }
    });
    expect(plan).toMatchObject({ status: "ready", materializedCount: 1, revision: 1 });
    const page = await mockInvokeCommand<any>("query_organization_plan_items", {
      request: { planId: plan.id, pageSize: 100, cursor: null }
    });
    expect(page.items).toHaveLength(1);
    const changed = await mockInvokeCommand<any>("update_organization_plan_decisions", {
      request: {
        planId: plan.id,
        expectedPlanRevision: 1,
        mutations: [{
          itemId: page.items[0].id,
          expectedItemRevision: 1,
          decision: "accepted"
        }]
      }
    });
    expect(changed.revision).toBe(2);
    const dryRun = await mockInvokeCommand<any>("get_organization_plan_dry_run", {
      request: { planId: plan.id, expectedPlanRevision: 2, itemIds: [], allAccepted: true }
    });
    expect(dryRun.executableCount).toBeGreaterThanOrEqual(0);
    await expect(mockInvokeCommand("execute_organization_plan", {
      request: {
        planId: plan.id,
        expectedPlanRevision: 2,
        dryRunFingerprint: dryRun.dryRunFingerprint,
        itemIds: [],
        allAccepted: true,
        confirmed: true
      }
    })).rejects.toThrow("browser_mock_native_execution_unavailable");
  });

  it("resolves browser group review through the plan revision and group-item projection", async () => {
    const plan = await mockInvokeCommand<any>("create_organization_plan", {
      request: {
        version: 1,
        requestId: "browser-group-contract",
        title: "Browser group review",
        source: { kind: "explicit", fileIds: ["mock-report"] },
        expectedCount: 1
      }
    });
    const groups = await mockInvokeCommand<any>("query_organization_plan_groups", {
      request: { planId: plan.id, pageSize: 100, cursor: null }
    });
    expect(groups.groups).toHaveLength(1);
    const group = groups.groups[0];
    const members = await mockInvokeCommand<any>("query_organization_plan_group_items", {
      request: { planId: plan.id, groupId: group.groupId, pageSize: 100, cursor: null }
    });
    expect(members.items).toHaveLength(1);

    const kept = await mockInvokeCommand<any>("update_organization_plan_group_decision", {
      request: { planId: plan.id, groupId: group.groupId, expectedPlanRevision: plan.revision, decision: "kept" }
    });
    expect(kept.plan.revision).toBe(plan.revision + 1);
    expect(kept.group.excludedCount).toBe(1);
    await expect(mockInvokeCommand("update_organization_plan_group_decision", {
      request: { planId: plan.id, groupId: group.groupId, expectedPlanRevision: plan.revision, decision: "accepted" }
    })).rejects.toThrow("organization_plan_revision_conflict");
  });
});
