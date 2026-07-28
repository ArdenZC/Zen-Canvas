import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Task 02 durable dedupe contract", () => {
  it("keeps the durable schema authoritative for fingerprints and duplicate membership", () => {
    const schema = read("src-tauri/src/db/schema.rs");
    const queries = read("src-tauri/src/db/queries/dedupe.rs");

    expect(schema).toContain("CURRENT_SCHEMA_VERSION: i32 = 30");
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

describe("Task 03 durable analysis contract", () => {
  it("uses a fixed detector registry and durable run/finding ledger", () => {
    const schema = read("src-tauri/src/db/schema.rs");
    const analysis = read("src-tauri/src/analysis.rs");
    const queries = read("src-tauri/src/db/queries/analysis.rs");

    expect(schema).toContain("CURRENT_SCHEMA_VERSION: i32 = 30");
    for (const table of [
      "analysis_runs",
      "analysis_run_detectors",
      "analysis_findings",
      "analysis_finding_evidence",
      "analysis_finding_decisions",
      "dedupe_authority_state"
    ]) {
      expect(schema).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(schema).toContain("ON DELETE SET NULL");
    for (const detector of [
      "duplicate_reclaimable_v1",
      "large_file_v1",
      "large_directory_v1",
      "cleanup_heuristics_v1"
    ]) {
      expect(analysis).toContain(detector);
    }
    expect(analysis).toContain("resolve_detector_ids");
    expect(analysis).toContain("stage_analysis_findings");
    expect(queries).toContain("publish_analysis_run");
    expect(queries).toContain("source_changed_during_run");
    expect(queries).toContain("deterministic_finding_id");
    expect(queries).toContain("analysis_finding_decisions");
  });

  it("keeps analysis findings advisory and preserves the existing mutation boundaries", () => {
    const analysis = read("src-tauri/src/analysis.rs");
    const cleanup = read("src-tauri/src/storage_analyzer.rs");
    const aiCleanup = read("src-tauri/src/ai/cleanup.rs");
    const api = read("src/api/tauriApi.ts");

    expect(analysis).toContain("becomes an authority for a run");
    expect(analysis).not.toContain("std::process::Command");
    expect(analysis).not.toContain("execute_moves");
    expect(cleanup).toContain("resolve_analysis_candidates_for_cleanup");
    expect(cleanup).toContain("Storage cleanup finding identity changed");
    expect(cleanup).toContain("move_cleanup_candidates_to_safe_trash");
    expect(aiCleanup).toContain("append_analysis_ai_assessment");
    expect(aiCleanup).not.toContain("execute_moves");
    expect(api).toContain("listAnalysisFindings");
    expect(api).toContain("setAnalysisFindingDecision");
  });

  it("requires durable identity dispatch, detector-owned review contracts, and full selection CAS", () => {
    const analysis = read("src-tauri/src/analysis.rs");
    const queries = read("src-tauri/src/db/queries/analysis.rs");
    const cleanup = read("src-tauri/src/storage_analyzer.rs");
    const aiCleanup = read("src-tauri/src/ai/cleanup.rs");
    const api = read("src/api/tauriApi.ts");

    expect(analysis).toContain('"managed_file" | "file"');
    expect(analysis).toContain('"duplicate_group" => duplicate_group_identity_matches');
    expect(analysis).toContain('"directory" => directory_identity_matches');
    expect(analysis).toContain('"approved_path" => approved_path_identity_matches');
    expect(analysis).toContain('"detectorContract": "review_reveal"');
    expect(analysis).toContain("CLEANUP_HEURISTICS_DETECTOR.to_string()");
    expect(queries).toContain("ANALYSIS_PRUNE_ROW_BUDGET: usize = 1000");
    expect(queries).toContain("refresh_analysis_run_aggregate_tx");
    expect(queries).toContain("revision = revision + 1");
    expect(cleanup).toContain("expected_revision: i64");
    expect(cleanup).toContain("ReviewFindingConfirmation");
    expect(cleanup).toContain("authorize_cleanup_candidate");
    expect(cleanup).not.toContain("move_path_to_system_trash_with_safety");
    expect(aiCleanup).toContain("ANALYSIS_RUN_UPDATED_EVENT");
    expect(api).toContain("expectedRevision: number");
    expect(api).toContain("selections: CleanupFindingSelection[]");
  });

  it("hydrates cleanup from durable revisions and never exposes analysis mutation commands", () => {
    const store = read("src/store/useStorageCleanupStore.ts");
    const view = read("src/views/cleanup/StorageCleanupView.tsx");

    expect(store).toContain("hydrateDurable");
    expect(store).toContain("durableRunRevision");
    expect(store).toContain("run.revision <= currentRevision");
    expect(view).toContain("onAnalysisRunUpdated");
    expect(view).toContain("onAnalysisFindingsPublished");
    expect(view).toContain("knownDetectorRevisions");
    expect(view).toContain("detector.revision <= known");
    expect(view).toContain("hydrateDurable(api, run.id)");
    expect(view).not.toContain("startAnalysisRun");
    expect(view).toContain("setAnalysisFindingDecision");
  });
});
