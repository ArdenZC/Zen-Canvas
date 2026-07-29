import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`Architecture guard failed: ${message}`);
    process.exitCode = 1;
  }
}

const viewFiles = [
  "src/views/hub/HubView.tsx",
  "src/views/restore/RestoreView.tsx",
  "src/views/rules/RulesView.tsx",
  "src/views/scanner/ScannerView.tsx",
  "src/views/settings/SettingsView.tsx",
  "src/views/timeline/TimelineView.tsx",
  "src/views/vault/AssetCard.tsx",
  "src/views/vault/VaultView.tsx"
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
const api = read("src/api/tauriApi.ts");
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
  "src-tauri/src/db/queries/library.rs",
  "src-tauri/src/db/queries/organization.rs",
  "src-tauri/src/db/queries/mod.rs",
  "src-tauri/src/db/queries/operations.rs",
  "src-tauri/src/db/queries/rules_repo.rs"
];
const db = dbFiles.map(read).join("\n");
const benchmarkSource = read("src-tauri/tests/fts_benchmark.rs");
const fileLibraryBenchmarkSource = read("src-tauri/tests/file_library_performance.rs");
const organizationBenchmarkSource = read("src-tauri/src/db/queries/organization.rs");
const requiredBenchmarkScenarios = [
  "english_search",
  "cjk_search",
  "extension_search",
  "scope_query",
  "filter_query",
  "query_filter_query"
];

assert(api.includes("getPagedFiles"), "Tauri API must expose getPagedFiles.");
assert(api.includes("getStatsSummary"), "Tauri API must expose getStatsSummary.");
assert(!api.includes("fetchDatabase"), "Tauri API must not expose giant fetchDatabase.");
assert(!db.includes("fetch_database"), "Rust backend must not register fetch_database.");
assert(fileLibraryStore.includes("LIBRARY_PAGE_SIZE = 50"), "File library page size should remain bounded at 50.");
assert(fileLibraryList.includes("useVirtualizer") && fileLibraryList.includes("shouldTriggerLoadMore") && fileLibraryList.includes("onLoadMore"), "File library must combine virtualization with incremental load-more triggering.");
assert(fileLibraryV2Store.includes("queryFileLibraryV2") && fileLibraryV2Store.includes("nextCursor"), "File Library V2 store must use backend query snapshots and keyset cursors.");
assert(fileLibraryView.includes("loadFirstPage()") && fileLibraryView.includes("onLoadMore={() => void loadNextPage()}"), "Vault must request bounded V2 pages through the canonical store query and backend cursor.");
assert(!fileLibraryView.includes("collectLibraryPages") && !fileLibraryView.includes("getPagedFiles"), "Vault must not retain the renderer full-collection or OFFSET path.");
assert(virtualization.includes("!hasMore || isLoading || rowCount <= 0") && virtualization.includes("lastVisibleRowIndex >= rowCount - 1 - threshold"), "File library load-more trigger must stop when complete or already loading.");
assert(fileLibraryModel.includes("LIBRARY_COLLECTION_MAX_PAGES") && fileLibraryModel.includes("LIBRARY_COLLECTION_MAX_FILES") && fileLibraryModel.includes("if (!newFiles.length)"), "Advanced library collection must retain page, entry, and no-progress bounds.");
assert(!runtimeUi.includes("demoData"), "Runtime UI must not depend on demo data.");
assert(!runtimeUi.includes("window.fileManager"), "Runtime UI must not depend on Electron preload APIs.");
assert(fileLibraryBenchmarkSource.includes("assert_query_plans") && fileLibraryBenchmarkSource.includes("performance_1m_file_library_query_matrix"), "Task 05 performance source must include query-plan and 1M gates.");
assert(organizationBenchmarkSource.includes("performance_task06_plan_100_1k_10k_repository"), "Task 06 performance source must include the 100/1k/10k durable plan benchmark.");
for (const scenario of requiredBenchmarkScenarios) {
  assert(benchmarkSource.includes(scenario), `SQLite benchmark must cover ${scenario}.`);
}

if (!process.exitCode) {
  console.log("Architecture guard passed: paged IPC, bounded library loading, and no legacy full snapshot path.");
} else {
  process.exit(process.exitCode);
}

console.log("Running bounded file-library behavior checks...");
const vitest = spawnSync(
  process.execPath,
  [path.join(root, "node_modules/vitest/vitest.mjs"), "run", "tests/fileLibraryPagination.test.ts", "tests/virtualization.test.ts"],
  { cwd: root, stdio: "inherit" },
);
if (vitest.error || vitest.status !== 0) {
  console.error(vitest.error ? `File-library behavior checks failed to start: ${vitest.error.message}` : `File-library behavior checks failed with exit code ${vitest.status}.`);
  process.exit(vitest.status ?? 1);
}

console.log("Running SQLite/FTS benchmark...");

const benchmark = spawnSync(
  "cargo",
  [
    "test",
    "--release",
    "--manifest-path",
    "src-tauri/Cargo.toml",
    "fts_benchmark_100k",
    "--",
    "--ignored",
    "--nocapture",
  ],
  {
    cwd: root,
    stdio: "inherit",
  },
);

if (benchmark.error) {
  console.error(`SQLite/FTS benchmark failed to start: ${benchmark.error.message}`);
  process.exit(1);
}

if (benchmark.status !== 0) {
  console.error(`SQLite/FTS benchmark failed with exit code ${benchmark.status}.`);
  process.exit(benchmark.status ?? 1);
}

console.log("SQLite/FTS benchmark passed.");

console.log("Running Task 04 global-search 100k benchmark...");
const globalSearchPerformance = spawnSync(
  "cargo",
  [
    "test",
    "--release",
    "--manifest-path",
    "src-tauri/Cargo.toml",
    "global_search_performance_100k_synthetic_entries",
    "--",
    "--ignored",
    "--nocapture",
  ],
  { cwd: root, stdio: "inherit" },
);
if (globalSearchPerformance.error || globalSearchPerformance.status !== 0) {
  console.error(globalSearchPerformance.error
    ? `Task 04 global-search benchmark failed to start: ${globalSearchPerformance.error.message}`
    : `Task 04 global-search benchmark failed with exit code ${globalSearchPerformance.status}.`);
  process.exit(globalSearchPerformance.status ?? 1);
}
console.log("Task 04 global-search 100k benchmark passed.");

console.log("Running managed-scan 100k observation benchmark...");
const scanPerformance = spawnSync(
  "cargo",
  [
    "test",
    "--release",
    "--manifest-path",
    "src-tauri/Cargo.toml",
    "performance_100k_scan_seen_missing_reconcile_and_wal_reader",
    "--",
    "--ignored",
    "--nocapture",
  ],
  { cwd: root, stdio: "inherit" },
);

if (scanPerformance.error) {
  console.error(`Managed-scan benchmark failed to start: ${scanPerformance.error.message}`);
  process.exit(1);
}

if (scanPerformance.status !== 0) {
  console.error(`Managed-scan benchmark failed with exit code ${scanPerformance.status}.`);
  process.exit(scanPerformance.status ?? 1);
}

console.log("Managed-scan 100k observation benchmark passed.");

console.log("Running schema 28->29 100k-file migration/WAL-reader benchmark...");
const migrationPerformance = spawnSync(
  "cargo",
  [
    "test",
    "--release",
    "--manifest-path",
    "src-tauri/Cargo.toml",
    "performance_100k_files_schema_28_to_29_and_wal_reader",
    "--",
    "--ignored",
    "--nocapture",
  ],
  { cwd: root, stdio: "inherit" },
);

if (migrationPerformance.error) {
  console.error(`Schema migration benchmark failed to start: ${migrationPerformance.error.message}`);
  process.exit(1);
}

if (migrationPerformance.status !== 0) {
  console.error(`Schema migration benchmark failed with exit code ${migrationPerformance.status}.`);
  process.exit(migrationPerformance.status ?? 1);
}

console.log("Schema 28->29 migration/WAL-reader benchmark passed.");

console.log("Running schema 29->30 analysis migration/WAL-reader benchmark...");
const analysisMigrationPerformance = spawnSync(
  "cargo",
  [
    "test",
    "--release",
    "--manifest-path",
    "src-tauri/Cargo.toml",
    "performance_100k_files_schema_29_to_30_analysis_and_wal_reader",
    "--",
    "--ignored",
    "--nocapture",
  ],
  { cwd: root, stdio: "inherit" },
);

if (analysisMigrationPerformance.error) {
  console.error(`Task 03 schema migration benchmark failed to start: ${analysisMigrationPerformance.error.message}`);
  process.exit(1);
}

if (analysisMigrationPerformance.status !== 0) {
  console.error(`Task 03 schema migration benchmark failed with exit code ${analysisMigrationPerformance.status}.`);
  process.exit(analysisMigrationPerformance.status ?? 1);
}

console.log("Schema 29->30 analysis migration/WAL-reader benchmark passed.");

console.log("Running Task 03 analysis finding 100k/WAL-reader benchmark...");
const analysisPerformance = spawnSync(
  "cargo",
  [
    "test",
    "--release",
    "--manifest-path",
    "src-tauri/Cargo.toml",
    "performance_task03_analysis_100k_findings_and_wal_reader",
    "--",
    "--ignored",
    "--nocapture",
  ],
  { cwd: root, stdio: "inherit" },
);

if (analysisPerformance.error) {
  console.error(`Task 03 analysis finding benchmark failed to start: ${analysisPerformance.error.message}`);
  process.exit(1);
}

if (analysisPerformance.status !== 0) {
  console.error(`Task 03 analysis finding benchmark failed with exit code ${analysisPerformance.status}.`);
  process.exit(analysisPerformance.status ?? 1);
}

console.log("Task 03 analysis finding 100k/WAL-reader benchmark passed.");

console.log("Running Task 03 10k finding publication benchmark...");
const analysisPublicationPerformance = spawnSync(
  "cargo",
  [
    "test",
    "--release",
    "--manifest-path",
    "src-tauri/Cargo.toml",
    "performance_task03_10k_finding_publication_transaction",
    "--",
    "--ignored",
    "--nocapture",
  ],
  { cwd: root, stdio: "inherit" },
);

if (analysisPublicationPerformance.error) {
  console.error(`Task 03 finding publication benchmark failed to start: ${analysisPublicationPerformance.error.message}`);
  process.exit(1);
}

if (analysisPublicationPerformance.status !== 0) {
  console.error(`Task 03 finding publication benchmark failed with exit code ${analysisPublicationPerformance.status}.`);
  process.exit(analysisPublicationPerformance.status ?? 1);
}

console.log("Task 03 10k finding publication benchmark passed.");

console.log("Running Task 03 global prune budget/WAL-reader check...");
const analysisPrune = spawnSync(
  "cargo",
  [
    "test",
    "--release",
    "--manifest-path",
    "src-tauri/Cargo.toml",
    "analysis_prune_uses_one_global_child_first_row_budget_and_wal_reader",
    "--",
    "--nocapture",
  ],
  { cwd: root, stdio: "inherit" },
);

if (analysisPrune.error) {
  console.error(`Task 03 prune budget check failed to start: ${analysisPrune.error.message}`);
  process.exit(1);
}

if (analysisPrune.status !== 0) {
  console.error(`Task 03 prune budget check failed with exit code ${analysisPrune.status}.`);
  process.exit(analysisPrune.status ?? 1);
}

console.log("Task 03 global prune budget/WAL-reader check passed.");

console.log("Running Task 02 dedupe repository benchmark...");
const dedupePerformance = spawnSync(
  "cargo",
  [
    "test",
    "--release",
    "--manifest-path",
    "src-tauri/Cargo.toml",
    "performance_task02_repository_100k_and_group_pages",
    "--",
    "--ignored",
    "--nocapture",
  ],
  { cwd: root, stdio: "inherit" },
);

if (dedupePerformance.error) {
  console.error(`Task 02 dedupe benchmark failed to start: ${dedupePerformance.error.message}`);
  process.exit(1);
}

if (dedupePerformance.status !== 0) {
  console.error(`Task 02 dedupe benchmark failed with exit code ${dedupePerformance.status}.`);
  process.exit(dedupePerformance.status ?? 1);
}

console.log("Task 02 dedupe repository benchmark passed.");

console.log("Running Task 02 bounded hash IO benchmark with the reduced CI fixture...");
const ioPerformance = spawnSync(
  "cargo",
  [
    "test",
    "--release",
    "--manifest-path",
    "src-tauri/Cargo.toml",
    "performance_task02_hash_io_1000x16mib_1_worker_and_default_workers",
    "--",
    "--ignored",
    "--nocapture",
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      ZC_TASK02_IO_FILES: "16",
      ZC_TASK02_IO_BYTES: "1048576",
    },
    stdio: "inherit",
  },
);

if (ioPerformance.error) {
  console.error(`Task 02 hash IO benchmark failed to start: ${ioPerformance.error.message}`);
  process.exit(1);
}

if (ioPerformance.status !== 0) {
  console.error(`Task 02 hash IO benchmark failed with exit code ${ioPerformance.status}.`);
  process.exit(ioPerformance.status ?? 1);
}

console.log("Task 02 bounded hash IO benchmark passed.");

const task05PerformanceTests = [
  ["performance_100k_file_library_query_matrix", "Task 05 File Library 100k query matrix"],
  ["performance_100k_schema_30_to_31_file_library_migration", "Task 05 schema 30->31 100k migration"],
  ["performance_1m_file_library_query_matrix", "Task 05 File Library 1M query matrix"],
  ["performance_1m_schema_30_to_31_file_library_migration", "Task 05 schema 30->31 1M migration"],
];

for (const [testName, label] of task05PerformanceTests) {
  console.log(`Running ${label} benchmark...`);
  const task05Performance = spawnSync(
    "cargo",
    [
      "test",
      "--release",
      "--manifest-path",
      "src-tauri/Cargo.toml",
      testName,
      "--",
      "--ignored",
      "--nocapture",
    ],
    { cwd: root, stdio: "inherit" },
  );
  if (task05Performance.error || task05Performance.status !== 0) {
    console.error(task05Performance.error
      ? `${label} benchmark failed to start: ${task05Performance.error.message}`
      : `${label} benchmark failed with exit code ${task05Performance.status}.`);
    process.exit(task05Performance.status ?? 1);
  }
  console.log(`${label} benchmark passed.`);
}

console.log("Running Task 06 durable plan 100/1k/10k benchmark...");
const task06Performance = spawnSync(
  "cargo",
  [
    "test",
    "--release",
    "--manifest-path",
    "src-tauri/Cargo.toml",
    "performance_task06_plan_100_1k_10k_repository",
    "--",
    "--ignored",
    "--nocapture",
  ],
  { cwd: root, stdio: "inherit" },
);
if (task06Performance.error || task06Performance.status !== 0) {
  console.error(task06Performance.error
    ? `Task 06 durable plan benchmark failed to start: ${task06Performance.error.message}`
    : `Task 06 durable plan benchmark failed with exit code ${task06Performance.status}.`);
  process.exit(task06Performance.status ?? 1);
}
console.log("Task 06 durable plan 100/1k/10k benchmark passed.");
