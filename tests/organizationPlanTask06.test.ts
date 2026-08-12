import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("Task 06 durable Organization Plan contracts", () => {
  it("retains the schema 32 plan ledger and small-table revisions after later migrations", () => {
    const schema = read("src-tauri/src/db/schema.rs");
    const section = schema.slice(
      schema.indexOf("fn ensure_organization_plan_schema"),
      schema.indexOf("fn ensure_journal_state_triggers")
    );
    expect(schema).toContain("CURRENT_SCHEMA_VERSION: i32 = 34");
    expect(section).toContain("CREATE TABLE IF NOT EXISTS organization_plans");
    expect(section).toContain("CREATE TABLE IF NOT EXISTS organization_plan_items");
    expect(section).toContain("ALTER TABLE user_tags ADD COLUMN revision");
    expect(section).toContain("ALTER TABLE library_saved_views ADD COLUMN revision");
    expect(section).not.toContain("ALTER TABLE files");
    expect(section).not.toContain("ALTER TABLE operation_logs");
    expect(section).not.toContain("CREATE TABLE operation_logs");
    expect(section).not.toContain("CREATE TABLE managed_ai");
  });

  it("keeps plan execution on the existing authoritative preview and operation journal", () => {
    const organization =
      read("src-tauri/src/db/queries/organization/mod.rs") +
      read("src-tauri/src/db/queries/organization/queries.rs");
    const fileOps = read("src-tauri/src/file_ops.rs");
    expect(organization).toContain("operation_preview_from_indexed");
    expect(organization).toContain("authoritative_preview_id");
    expect(organization).toContain("active_operation_batch_id");
    expect(organization).toContain("operation_logs");
    expect(fileOps).toContain("execute_canonical_operations");
    expect(organization).not.toContain("move_to_trash");
    expect(organization).not.toContain("std::fs::read");
    expect(organization).not.toContain("read_to_string");
    expect(organization).not.toContain("std::process::Command");
  });

  it("reuses the managed AI queue and exposes only ID-based main-window commands", () => {
    const organization = read("src-tauri/src/db/queries/organization/mod.rs");
    const repository = read("src-tauri/src/global_index/repository.rs");
    const commands = read("src-tauri/src/db/commands.rs");
    const search = JSON.parse(read("src-tauri/capabilities/search.json")) as { permissions: string[] };
    expect(organization).toContain("enqueue_managed_ai_for_library_files");
    expect(repository).toContain("enqueue_ai_jobs_for_entry");
    expect(organization).not.toContain("CREATE TABLE");
    expect(commands).toContain("require_main_window");
    expect(commands).not.toMatch(/ExecuteOrganizationPlanRequest[\s\S]{0,300}(source_path|target_path)/);
    expect(search.permissions.some((permission) => permission.includes("organization-plan"))).toBe(false);
    expect(search.permissions).not.toContain("allow-resolve-file-library-exact-count-v2");
  });

  it("hydrates review state from the backend and keeps browser execution honest", () => {
    const view = read("src/views/organize/OrganizeSuggestionsView.tsx");
    const store = read("src/store/useOrganizationPlanStore.ts");
    const mock = read("src/api/browserMockApi.ts");
    expect(view).toContain("useOrganizationPlanStore");
    expect(view).toContain("useVirtualizer");
    expect(view).toContain("ConfirmDialog");
    expect(store).not.toContain("queryOrganizationPlanItems");
    expect(store).not.toContain("loadNextPage:");
    expect(store).not.toContain("updateBatch:");
    expect(store).toContain("queryOrganizationPlanGroups");
    expect(store).toContain("requestEpoch");
    expect(store).not.toContain("localStorage");
    expect(view).not.toContain("useOrganizeDecisionStore");
    expect(view).not.toContain("useOperationQueueStore");
    expect(mock).toContain("browser_mock_native_execution_unavailable");
  });

  it("projects complete Plan groups without adding a second ledger or Schema 35", () => {
    const organization =
      read("src-tauri/src/db/queries/organization/mod.rs") +
      read("src-tauri/src/db/queries/organization/queries.rs");
    const domain = read("src/types/domain.ts");
    const api = read("src/api/organizationApi.ts");
    const store = read("src/store/useOrganizationPlanStore.ts");
    expect(organization).toContain("pub struct OrganizationPlanGroupSummaryDto");
    expect(organization).toContain("pub fn query_organization_plan_groups");
    expect(organization).toContain("pub fn query_organization_plan_group_items");
    expect(organization).toContain("pub fn update_organization_plan_group_decision");
    expect(organization).toContain("organization_group_action_not_available");
    expect(organization).toContain("organization_group_changed");
    expect(organization).toContain("expected_projection_fingerprint");
    expect(organization).toContain("expected_item_count");
    expect(organization).toContain("projection_fingerprint");
    expect(organization).toContain("can_accept_all");
    expect(organization).not.toContain("load_organization_plan_group_summaries(");
    expect(organization).toContain("ORGANIZATION_GROUP_SAMPLE_MAX");
    expect(organization).not.toContain("CREATE TABLE");
    expect(organization).not.toContain("schema 35");
    expect(domain).toContain("export interface OrganizationPlanGroupSummary");
    expect(domain).toContain("projectionFingerprint");
    expect(domain).toContain("canAcceptAll");
    expect(domain).not.toContain("groupNextCursor");
    expect(api).toContain('"query_organization_plan_groups"');
    expect(api).toContain('"query_organization_plan_group_items"');
    expect(api).toContain('"update_organization_plan_group_decision"');
    expect(store).toContain("queryOrganizationPlanGroups");
    expect(store).toContain("updateGroupDecision");
    expect(store).toContain("expectedProjectionFingerprint");
    expect(store).not.toContain("items.reduce");
  });
});
