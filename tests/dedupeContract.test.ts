import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Task 02 durable dedupe contract", () => {
  it("keeps the durable schema authoritative for fingerprints and duplicate membership", () => {
    const schema = read("src-tauri/src/db/schema.rs");
    const queries = read("src-tauri/src/db/queries/dedupe.rs");

    expect(schema).toContain("CURRENT_SCHEMA_VERSION: i32 = 29");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS file_fingerprints");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS dedupe_runs");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS duplicate_groups");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS duplicate_group_members");
    expect(schema).toContain("CREATE VIEW active_duplicate_membership AS");
    expect(schema).toContain("idx_dedupe_runs_one_active_scope");
    expect(queries).toContain("request_attempt");
    expect(queries).toContain("retry_dedupe_run");
    expect(queries).toContain("scope_snapshot_hash");
    expect(queries).toContain("candidate_sizes");
    expect(queries).toContain("parse_group_cursor");
  });

  it("requires identity checks and bounded hashing before group publication", () => {
    const dedupe = read("src-tauri/src/dedupe.rs");
    const queries = read("src-tauri/src/db/queries/dedupe.rs");
    const physical = read("src-tauri/src/fs_safety/physical.rs");

    expect(dedupe).toContain("sync_channel");
    expect(dedupe).toContain("file_changed_before_hash");
    expect(dedupe).toContain("file_changed_during_hash");
    expect(dedupe).toContain("expected_identity");
    expect(dedupe).toContain("hash_subject_with_identity");
    expect(dedupe).toContain("publish_dedupe_groups");
    expect(queries).toContain("scope_snapshot_hash");
    expect(physical).toContain("capture_physical_identity");
    expect(physical).toContain("UnsupportedLink");
    expect(physical).toContain("PhysicalFileIdentity");
  });

  it("hydrates durable state and rejects stale or gapped renderer events", () => {
    const store = read("src/store/useDedupeStore.ts");
    const api = read("src/api/tauriApi.ts");

    expect(store).toContain("listDedupeRuns(50)");
    expect(store).toContain("getActiveDedupeRun()");
    expect(store).toContain("next.revision < known.revision");
    expect(store).toContain("next.revision > known.revision + 1");
    expect(store).toContain("void current.hydrate()");
    expect(api).toContain('invokeCommand<DedupeRun>("start_dedupe_run"');
    expect(api).toContain('invokeCommand<DedupeRun>("retry_dedupe_run"');
    expect(api).toContain('invokeCommand<DedupeGroupPage>("list_duplicate_groups"');
    expect(api).toContain('listenTo("dedupe-run-updated"');
  });

  it("keeps the duplicate panel read-only and exposes the command permission surface", () => {
    const panel = read("src/views/vault/components/DuplicateGroupsPanel.tsx");
    const matrix = read("docs/security/TAURI_COMMAND_PERMISSION_MATRIX.md");

    expect(panel).toContain("listDuplicateGroupMembers");
    expect(panel).toContain("revealInFolder");
    expect(panel).not.toContain("executeMoves");
    expect(panel).not.toContain("moveCleanupCandidates");
    for (const command of [
      "start_dedupe_run",
      "retry_dedupe_run",
      "cancel_dedupe_run",
      "get_dedupe_run",
      "list_dedupe_runs",
      "get_active_dedupe_run",
      "list_duplicate_groups",
      "get_duplicate_group",
      "list_duplicate_group_members",
      "get_file_duplicate_membership"
    ]) {
      expect(matrix).toContain(`| \`${command}\` |`);
    }
  });
});
