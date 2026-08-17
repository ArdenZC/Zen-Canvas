import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { findVaultPaginationArchitectureViolations } from "./performanceArchitectureGuard.mjs";
import { getPerformanceBenchmarks, PERFORMANCE_SUITES } from "./performanceManifest.mjs";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`Architecture guard failed: ${message}`);
    process.exit(1);
  }
}

const viewFiles = [
  "src/views/organize/OrganizeSuggestionsView.tsx",
  "src/views/restore/RestoreView.tsx",
  "src/views/rules/RulesView.tsx",
  "src/views/scanner/ScannerView.tsx",
  "src/views/settings/SettingsView.tsx",
  "src/views/timeline/TimelineView.tsx",
  "src/views/vault/AssetCard.tsx",
  "src/views/vault/VaultView.tsx",
];
const appViews = viewFiles.map(read).join("\n");
const app = read("src/App.tsx");
const appShell = read("src/components/AppShell.tsx");
const fileLibraryStore = read("src/store/useFileLibraryStore.ts");
const fileLibraryV2Store = read("src/store/useFileLibraryV2Store.ts");
const fileLibraryView = read("src/views/vault/VaultView.tsx");
const fileLibraryList = read("src/views/vault/components/FileLibraryList.tsx");
const fileLibraryModel = read("src/views/vault/fileLibraryModel.ts");
const virtualization = read("src/utils/virtualization.ts");
const runtimeUi = [app, appShell, appViews].join("\n");
const api = read("src/api/tauriApi.ts") + read("src/api/libraryApi.ts");
const vaultQueryController = read("src/views/vault/controllers/useVaultQueryController.ts");
const dbFiles = [
  "src-tauri/src/db/commands.rs",
  "src-tauri/src/db/connection.rs",
  "src-tauri/src/db/mod.rs",
  "src-tauri/src/db/schema.rs",
  "src-tauri/src/db/types.rs",
  "src-tauri/src/db/classification/builtin_rules.rs",
  "src-tauri/src/db/classification/engine.rs",
  "src-tauri/src/db/classification/mod.rs",
  "src-tauri/src/db/classification/naming.rs",
  "src-tauri/src/db/queries/files.rs",
  "src-tauri/src/db/queries/library/mod.rs",
  "src-tauri/src/db/queries/library/tags.rs",
  "src-tauri/src/db/queries/library/saved_views.rs",
  "src-tauri/src/db/queries/organization/mod.rs",
  "src-tauri/src/db/queries/organization/cursor.rs",
  "src-tauri/src/db/queries/organization/projection.rs",
  "src-tauri/src/db/queries/organization/queries.rs",
  "src-tauri/src/db/queries/rule_proposals/mod.rs",
  "src-tauri/src/db/queries/rule_proposals/predicate.rs",
  "src-tauri/src/db/queries/analysis/mod.rs",
  "src-tauri/src/db/queries/analysis/projection.rs",
  "src-tauri/src/db/queries/dedupe/mod.rs",
  "src-tauri/src/db/queries/dedupe/projection.rs",
  "src-tauri/src/db/queries/mod.rs",
  "src-tauri/src/db/queries/operations.rs",
  "src-tauri/src/db/queries/rules_repo.rs",
];
const db = dbFiles.map(read).join("\n");
const benchmarkSource = read("src-tauri/tests/fts_benchmark.rs");
const fileLibraryBenchmarkSource = read("src-tauri/tests/file_library_performance.rs");
const organizationBenchmarkSource = read("src-tauri/src/db/queries/organization/mod.rs");
const ruleProposalBenchmarkSource = read("src-tauri/src/db/queries/rule_proposals/mod.rs");
const workspacePerformanceSource = [
  "src-tauri/src/file_workspace/integration/performance/mod.rs",
  "src-tauri/src/file_workspace/integration/performance/harness.rs",
  "src-tauri/src/file_workspace/integration/performance/browse.rs",
  "src-tauri/src/file_workspace/integration/performance/scheduler.rs",
  "src-tauri/src/file_workspace/integration/performance/steady_state.rs",
  "src-tauri/src/file_workspace/integration/performance/resources.rs",
  "src-tauri/src/file_workspace/integration/performance/fixture.rs",
].map(read).join("\n");
const workspaceMetricSource = read("src-tauri/src/file_workspace/integration/performance/metrics.rs");

const workspaceSuite = PERFORMANCE_SUITES["workspace-foundation"];
const workspaceBenchmarkTestNames = Object.freeze({
  workspace_foundation_harness_smoke:
    "file_workspace::integration::performance::harness::harness_smoke",
  workspace_foundation_browse_100k:
    "file_workspace::integration::performance::browse::browse_100k_progressive_bounded_ownership",
  workspace_foundation_browse_session_capacity:
    "file_workspace::integration::performance::browse::browse_session_capacity_remains_bounded",
  workspace_foundation_scheduler_pressure:
    "file_workspace::integration::performance::scheduler::managed_scan_pressure_preserves_foreground_browse_and_releases",
  workspace_foundation_resource_steady_state:
    "file_workspace::integration::performance::steady_state::resource_and_registry_steady_state_after_browse_preview_switches",
  workspace_foundation_windows_private_usage_detector:
    "file_workspace::integration::performance::steady_state::windows_private_usage_detector_catches_sustained_retention",
});
assert(workspaceSuite, "File Workspace/Foundation performance suite must remain in the manifest.");
const workspaceBenchmarks = getPerformanceBenchmarks("workspace-foundation", "full");
for (const [id, testName] of Object.entries(workspaceBenchmarkTestNames)) {
  assert(
    workspaceBenchmarks.some((benchmark) => benchmark.id === id && benchmark.testName === testName),
    `File Workspace/Foundation benchmark ${id} must map to the exact Rust test ${testName}.`,
  );
  const rustTestName = testName.split("::").at(-1);
  assert(
    workspacePerformanceSource.includes(`fn ${rustTestName}(`),
    `File Workspace/Foundation source must retain the exact Rust test function ${rustTestName}.`,
  );
}
assert(
  workspaceBenchmarks.some((benchmark) => benchmark.id === "workspace_foundation_harness_smoke"),
  "File Workspace/Foundation suite must retain its prepared-binary harness benchmark.",
);
assert(
  workspaceBenchmarks.some((benchmark) => benchmark.id === "workspace_foundation_browse_100k"),
  "File Workspace/Foundation suite must retain the real 100k Browse benchmark.",
);
assert(
  workspaceBenchmarks.some((benchmark) => benchmark.id === "workspace_foundation_browse_session_capacity"),
  "File Workspace/Foundation suite must retain bounded multi-session Browse evidence.",
);
assert(
  workspaceBenchmarks.some((benchmark) => benchmark.id === "workspace_foundation_scheduler_pressure"),
  "File Workspace/Foundation suite must retain real managed-scan scheduler pressure evidence.",
);
assert(
  workspaceBenchmarks.some((benchmark) => benchmark.id === "workspace_foundation_resource_steady_state"),
  "File Workspace/Foundation suite must retain resource and registry steady-state evidence.",
);
assert(
  workspacePerformanceSource.includes("FileWorkspaceRuntime")
    && workspacePerformanceSource.includes("open_browse")
    && workspacePerformanceSource.includes("start_enumeration"),
  "File Workspace/Foundation harness must exercise the real runtime Browse path.",
);
assert(
  workspaceMetricSource.includes("[zc-perf]")
    && workspaceMetricSource.includes('schema: 1')
    && workspaceMetricSource.includes('classification'),
  "File Workspace/Foundation metrics must use the stable machine-readable format.",
);
assert(
  workspacePerformanceSource.includes("PROCESS_MEMORY_COUNTERS_EX")
    && workspacePerformanceSource.includes("PrivateUsage"),
  "Windows Workspace Foundation leak evidence must use PROCESS_MEMORY_COUNTERS_EX::PrivateUsage.",
);

assert(api.includes("getPagedFiles"), "Tauri API must expose getPagedFiles.");
assert(api.includes("getStatsSummary"), "Tauri API must expose getStatsSummary.");
assert(!api.includes("fetchDatabase"), "Tauri API must not expose giant fetchDatabase.");
assert(!db.includes("fetch_database"), "Rust backend must not register fetch_database.");
assert(fileLibraryStore.includes("LIBRARY_PAGE_SIZE = 50"), "File library page size should remain bounded at 50.");
assert(
  fileLibraryList.includes("useVirtualizer")
    && fileLibraryList.includes("shouldTriggerLoadMore")
    && fileLibraryList.includes("onLoadMore"),
  "File library must combine virtualization with incremental load-more triggering.",
);
assert(
  fileLibraryV2Store.includes("queryFileLibraryV2") && fileLibraryV2Store.includes("nextCursor"),
  "File Library V2 store must use backend query snapshots and keyset cursors.",
);
for (const violation of findVaultPaginationArchitectureViolations({
  viewSource: fileLibraryView,
  storeSource: fileLibraryV2Store,
  componentSources: { "./controllers/useVaultQueryController": vaultQueryController },
})) {
  assert(false, violation);
}
assert(
  !fileLibraryView.includes("collectLibraryPages") && !fileLibraryView.includes("getPagedFiles"),
  "Vault must not retain the renderer full-collection or OFFSET path.",
);
assert(
  virtualization.includes("!hasMore || isLoading || rowCount <= 0")
    && virtualization.includes("lastVisibleRowIndex >= rowCount - 1 - threshold"),
  "File library load-more trigger must stop when complete or already loading.",
);
assert(
  fileLibraryModel.includes("LIBRARY_COLLECTION_MAX_PAGES")
    && fileLibraryModel.includes("LIBRARY_COLLECTION_MAX_FILES")
    && fileLibraryModel.includes("if (!newFiles.length)"),
  "Advanced library collection must retain page, entry, and no-progress bounds.",
);
assert(!runtimeUi.includes("demoData"), "Runtime UI must not depend on demo data.");
assert(!runtimeUi.includes("window.fileManager"), "Runtime UI must not depend on Electron preload APIs.");
assert(
  fileLibraryBenchmarkSource.includes("assert_query_plans")
    && fileLibraryBenchmarkSource.includes("performance_1m_file_library_query_matrix"),
  "File Library performance source must retain query-plan and 1M gates.",
);
assert(
  organizationBenchmarkSource.includes("performance_task06_plan_100_1k_10k_repository"),
  "Organization performance source must retain the 100/1k/10k durable plan benchmark.",
);
assert(
  ruleProposalBenchmarkSource.includes("performance_task07_rule_proposal_repository_and_impact"),
  "Rule Proposal performance source must retain repository and 1M impact gates.",
);
for (const scenario of [
  "english_search",
  "cjk_search",
  "extension_search",
  "scope_query",
  "filter_query",
  "query_filter_query",
]) {
  assert(benchmarkSource.includes(scenario), `SQLite benchmark must cover ${scenario}.`);
}

console.log("Architecture guard passed: paged IPC, bounded library loading, File Workspace/Foundation performance routing, and no legacy full snapshot path.");

const vitest = spawnSync(
  process.execPath,
  [
    path.join(root, "node_modules/vitest/vitest.mjs"),
    "run",
    "tests/fileLibraryPagination.test.ts",
    "tests/virtualization.test.ts",
    "tests/searchSpotlight.test.ts",
  ],
  { cwd: root, stdio: "inherit" },
);
if (vitest.error) {
  console.error(`Architecture behavior checks failed to start: ${vitest.error.message}`);
  process.exit(1);
}
if (vitest.status !== 0) {
  console.error(`Architecture behavior checks failed with exit code ${vitest.status}.`);
  process.exit(vitest.status ?? 1);
}
