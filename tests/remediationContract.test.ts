import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const cleanup = source("src-tauri/src/storage_analyzer.rs");
const cleanupAI = source("src-tauri/src/ai/cleanup.rs");
const settings = source("src-tauri/src/settings.rs");
const aiSettings = source("src-tauri/src/ai/settings.rs");
const aiValidation = source("src-tauri/src/ai/openai_compatible.rs") + source("src-tauri/src/ai/settings.rs");
const fileOps = source("src-tauri/src/file_ops.rs");
const schema = source("src-tauri/src/db/schema.rs");
const safeTrash = cleanup;
const dedupe = source("src-tauri/src/dedupe.rs");
const ids = source("src-tauri/src/ids.rs");
const capabilities = source("src-tauri/src/runtime_capabilities.rs");
const api = source("src/api/tauriApi.ts");
const packageJson = source("package.json");
const workflows = source(".github/workflows/ci.yml") + source(".github/workflows/release-build.yml");
const supportedPlatforms = source("docs/security/SUPPORTED_PLATFORMS.md");

describe("remediation contracts", () => {
  it("requires jobId at every cleanup candidate command boundary", () => {
    for (const command of [
      "preview_cleanup_candidates",
      "preview_cleanup_operations",
      "move_cleanup_candidates_to_trash",
      "move_cleanup_candidates_to_safe_trash"
    ]) {
      expect(cleanup).toMatch(new RegExp(`pub fn ${command}[\\s\\S]{0,220}?job_id: String`));
    }
    expect(cleanupAI).toMatch(/pub async fn analyze_cleanup_candidates_with_ai[\s\S]{0,220}?job_id: String/);
    for (const method of [
      "previewCleanupCandidates",
      "previewCleanupOperations",
      "moveCleanupCandidatesToTrash",
      "moveCleanupCandidatesToSafeTrash",
      "analyzeCleanupCandidatesWithAI"
    ]) {
      expect(api).toMatch(new RegExp(`${method}\\(jobId: string, ids: string\\[\\]\\)`));
    }
  });

  it("keeps cleanup candidates job-scoped and cross-job resolution atomic", () => {
    expect(cleanup).toContain("jobs: Mutex<HashMap<String, StorageCleanupJob>>");
    expect(cleanup).toContain("job.candidates_by_id.get(id).cloned().ok_or_else");
    expect(cleanup).toContain("does not belong to job {job_id}");
    expect(cleanup).not.toMatch(/latest_candidates/i);
  });

  it("requires settings CAS revision and rejects stale writers", () => {
    expect(settings).toMatch(/pub struct SaveSettingsRequest[\s\S]*expected_revision: i64/);
    expect(settings).toContain("WHERE key = ?2 AND revision = ?3");
    expect(settings).toContain("SettingsError::RevisionConflict");
    expect(api).toContain("saveSettings(request: SaveSettingsRequest)");
  });

  it("requires file identity for operation and Safe Trash recovery", () => {
    expect(fileOps).toContain("source_quick_hash");
    expect(fileOps).toContain("target_platform_file_id");
    expect(fileOps).toContain("mark_restore_manual_review");
    expect(safeTrash).toContain("trash_quick_hash");
    expect(safeTrash).toContain("trash_platform_file_id");
    expect(schema).toContain("legacy_unverified");
    expect(safeTrash).toContain("manual_review");
  });

  it("isolates dedupe cancellation per job", () => {
    expect(dedupe).toContain("jobs: HashMap<String, DedupeJob>");
    expect(dedupe).toContain("scan_to_dedupe: HashMap<String, String>");
    expect(dedupe).not.toContain("DEDUPE_CANCEL_REQUESTED");
    expect(dedupe).not.toContain("DEDUPE_RUNNING");
  });

  it("uses collision-resistant UUID job IDs", () => {
    expect(ids).toContain("uuid::Uuid::now_v7()");
    expect(ids).toContain("concurrent_uuid_job_ids_do_not_collide");
    expect(ids).not.toMatch(/SystemTime|UNIX_EPOCH|DefaultHasher/);
  });

  it("keeps AI credential changes explicit, verified, and secret-free", () => {
    expect(aiSettings).toContain("ApiKeyAction::Preserve");
    expect(aiSettings).toContain("verify_credential_change(");
    expect(aiSettings).toContain("credential read-back verification failed");
    expect(aiSettings).toContain("persisted.api_key.clear()");
    expect(aiSettings).toContain("failed to read API key from system credential store");
    expect(aiSettings).not.toMatch(/OnceLock\s*<\s*Mutex\s*<\s*String\s*>\s*>/);
  });

  it("hides debug controls in production while retaining real AI", () => {
    expect(capabilities).toContain("production_capabilities_hide_ai_debug_without_disabling_real_ai");
    expect(capabilities).toContain("assert!(!release.ai_debug_available)");
    expect(capabilities).toContain("assert!(release.real_ai_classification_available)");
  });

  it("validates cloud URLs and rejects reserved Extra Body fields", () => {
    expect(aiValidation).toContain("Release builds require HTTPS for non-local AI providers");
    expect(aiValidation).toContain("extra_body_cannot_override_reserved_fields");
    for (const field of ["model", "messages", "stream", "temperature", "max_tokens", "response_format", "thinking"]) {
      expect(aiValidation).toContain(`\"${field}\"`);
    }
  });

  it("keeps revision and identity migrations in the current schema", () => {
    expect(schema).toMatch(/CURRENT_SCHEMA_VERSION: i32 = (?:2[0-9]|[3-9][0-9])/);
    expect(schema).toContain("ALTER TABLE app_settings ADD COLUMN revision");
    expect(schema).toContain("ALTER TABLE operation_logs ADD COLUMN source_quick_hash");
    expect(schema).toContain("ALTER TABLE cleanup_trash_items ADD COLUMN identity_status");
    expect(schema).toContain("restore_status = 'manual_review'");
  });

  it("does not suppress the remediated RustSec advisories", () => {
    const auditSurfaces = `${packageJson}\n${workflows}`;
    expect(auditSurfaces).not.toContain("--ignore RUSTSEC-2026-0194");
    expect(auditSurfaces).not.toContain("--ignore RUSTSEC-2026-0195");
    expect(packageJson).toContain("cargo audit --file src-tauri/Cargo.lock");
  });

  it("keeps the supported-platform policy Windows/macOS-only", () => {
    expect(supportedPlatforms).toContain("Windows");
    expect(supportedPlatforms).toContain("macOS");
    expect(supportedPlatforms).toMatch(/Linux is not a supported product platform/);
    expect(workflows).toContain("os: [windows-latest, macos-latest]");
    expect(workflows).not.toContain("ubuntu-latest");
    expect(workflows).not.toContain("Linux Tauri dependencies");
  });
});
