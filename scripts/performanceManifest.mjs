const CARGO_TEST_ARGS = ["--release", "--locked", "--manifest-path", "src-tauri/Cargo.toml"];

function benchmark({
  id,
  label,
  targetArgs,
  testName,
  ignored = true,
  testThreads,
  env = {},
}) {
  return Object.freeze({
    id,
    label,
    targetArgs: Object.freeze([...targetArgs]),
    testName,
    ignored,
    testThreads,
    env: Object.freeze({ ...env }),
  });
}

function precompile(id, targetArgs) {
  return Object.freeze({ id, targetArgs: Object.freeze([...targetArgs]) });
}

export const PERFORMANCE_SUITES = Object.freeze({
  search: Object.freeze({
    label: "Performance / Search",
    precompile: Object.freeze([
      precompile("search-lib", ["--lib"]),
      precompile("fts-benchmark", ["--test", "fts_benchmark"]),
    ]),
    extended: Object.freeze([
      benchmark({
        id: "fts_100k",
        label: "SQLite/FTS 100k",
        targetArgs: ["--test", "fts_benchmark"],
        testName: "fts_benchmark_100k",
      }),
      benchmark({
        id: "global_search_100k",
        label: "Global Search 100k",
        targetArgs: ["--lib"],
        testName: "global_search_performance_100k_synthetic_entries",
      }),
    ]),
    fullOnly: Object.freeze([
      benchmark({
        id: "global_search_1m",
        label: "Global Search 1M",
        targetArgs: ["--lib"],
        testName: "global_search_performance_one_million_synthetic_entries",
      }),
    ]),
    fixtureKeys: Object.freeze([]),
  }),
  "scan-schema": Object.freeze({
    label: "Performance / Scan & Schema",
    precompile: Object.freeze([
      precompile("scan-schema-lib", ["--lib"]),
      precompile("migrations", ["--test", "migrations"]),
    ]),
    extended: Object.freeze([
      benchmark({
        id: "scan_100k",
        label: "Managed Scan 100k",
        targetArgs: ["--lib"],
        testName: "performance_100k_scan_seen_missing_reconcile_and_wal_reader",
      }),
      benchmark({
        id: "schema_28_to_29_100k",
        label: "Schema 28->29 100k migration",
        targetArgs: ["--test", "migrations"],
        testName: "performance_100k_files_schema_28_to_29_and_wal_reader",
      }),
      benchmark({
        id: "schema_29_to_30_100k",
        label: "Schema 29->30 100k migration",
        targetArgs: ["--test", "migrations"],
        testName: "performance_100k_files_schema_29_to_30_analysis_and_wal_reader",
      }),
    ]),
    fullOnly: Object.freeze([]),
    fixtureKeys: Object.freeze([]),
  }),
  "library-content": Object.freeze({
    label: "Performance / Library & Content",
    precompile: Object.freeze([
      precompile("file-library-performance", ["--test", "file_library_performance"]),
      precompile("performance-fixture-builder", ["--test", "performance_fixture_builder"]),
    ]),
    extended: Object.freeze([
      benchmark({
        id: "file_library_100k",
        label: "File Library 100k query matrix",
        targetArgs: ["--test", "file_library_performance"],
        testName: "performance_100k_file_library_query_matrix",
      }),
      benchmark({
        id: "file_library_migration_100k",
        label: "File Library 100k migration",
        targetArgs: ["--test", "file_library_performance"],
        testName: "performance_100k_schema_30_to_31_file_library_migration",
      }),
      benchmark({
        id: "content_migration_100k",
        label: "Content migration 100k",
        targetArgs: ["--test", "file_library_performance"],
        testName: "performance_100k_schema_32_to_33_rule_proposal_migration",
      }),
    ]),
    fullOnly: Object.freeze([
      benchmark({
        id: "file_library_1m",
        label: "File Library 1M query matrix",
        targetArgs: ["--test", "file_library_performance"],
        testName: "performance_1m_file_library_query_matrix",
      }),
      benchmark({
        id: "file_library_migration_1m",
        label: "File Library 1M migration",
        targetArgs: ["--test", "file_library_performance"],
        testName: "performance_1m_schema_30_to_31_file_library_migration",
      }),
      benchmark({
        id: "content_migration_1m",
        label: "Content migration 1M",
        targetArgs: ["--test", "file_library_performance"],
        testName: "performance_1m_schema_32_to_33_rule_proposal_migration",
      }),
    ]),
    fixtureKeys: Object.freeze(["file-library-100k", "file-library-1m"]),
  }),
  intelligence: Object.freeze({
    label: "Performance / Intelligence",
    precompile: Object.freeze([precompile("intelligence-lib", ["--lib"])]),
    extended: Object.freeze([
      benchmark({
        id: "analysis_100k",
        label: "Analysis 100k",
        targetArgs: ["--lib"],
        testName: "performance_task03_analysis_100k_findings_and_wal_reader",
      }),
      benchmark({
        id: "analysis_publication_10k",
        label: "Analysis publication 10k",
        targetArgs: ["--lib"],
        testName: "performance_task03_10k_finding_publication_transaction",
      }),
      benchmark({
        id: "analysis_prune",
        label: "Analysis prune",
        targetArgs: ["--lib"],
        testName: "analysis_prune_uses_one_global_child_first_row_budget_and_wal_reader",
        ignored: false,
      }),
      benchmark({
        id: "dedupe_repository_100k",
        label: "Dedupe repository 100k",
        targetArgs: ["--lib"],
        testName: "performance_task02_repository_100k_and_group_pages",
      }),
      benchmark({
        id: "dedupe_hash_io_bounded",
        label: "Dedupe bounded hash IO",
        targetArgs: ["--lib"],
        testName: "performance_task02_hash_io_1000x16mib_1_worker_and_default_workers",
        env: { ZC_TASK02_IO_FILES: "16", ZC_TASK02_IO_BYTES: "1048576" },
      }),
      benchmark({
        id: "organization_100_1k_10k",
        label: "Organization Plan 100/1k/10k",
        targetArgs: ["--lib"],
        testName: "performance_task06_plan_100_1k_10k_repository",
      }),
      benchmark({
        id: "rule_proposal_100k",
        label: "Rule Proposal 100k impact",
        targetArgs: ["--lib"],
        testName: "performance_task07_rule_proposal_repository_and_impact",
        testThreads: 1,
      }),
    ]),
    fullOnly: Object.freeze([
      benchmark({
        id: "rule_proposal_1m",
        label: "Rule Proposal 1M impact",
        targetArgs: ["--lib"],
        testName: "performance_task07_rule_proposal_repository_and_impact",
        testThreads: 1,
      }),
    ]),
    fixtureKeys: Object.freeze([]),
  }),
});

export const PERFORMANCE_SUITE_NAMES = Object.freeze(Object.keys(PERFORMANCE_SUITES));

export function resolvePerformanceSuite(argv = []) {
  const suiteArguments = argv.filter(
    (argument) => argument === "--suite" || argument.startsWith("--suite="),
  );
  if (suiteArguments.length !== 1 || suiteArguments[0] === "--suite") {
    throw new Error("Specify exactly one performance suite with --suite=<name>.");
  }
  const suite = suiteArguments[0].slice("--suite=".length);
  if (!Object.hasOwn(PERFORMANCE_SUITES, suite)) {
    throw new Error(`Unsupported performance suite: ${suite}`);
  }
  return suite;
}

export function getPerformanceBenchmarks(suiteName, profile) {
  const suite = PERFORMANCE_SUITES[suiteName];
  if (!suite) throw new Error(`Unsupported performance suite: ${suiteName}`);
  if (profile !== "full" && profile !== "extended") {
    throw new Error(`Unsupported performance profile: ${profile}`);
  }
  return profile === "full" ? [...suite.extended, ...suite.fullOnly] : [...suite.extended];
}

export function getPrecompileTargets(suiteName) {
  const suite = PERFORMANCE_SUITES[suiteName];
  if (!suite) throw new Error(`Unsupported performance suite: ${suiteName}`);
  return [...suite.precompile];
}

export function getFixtureKeys(suiteName, profile) {
  const suite = PERFORMANCE_SUITES[suiteName];
  if (!suite) throw new Error(`Unsupported performance suite: ${suiteName}`);
  if (profile === "extended") {
    return suite.fixtureKeys.filter((key) => !key.endsWith("-1m"));
  }
  if (profile === "full") return [...suite.fixtureKeys];
  throw new Error(`Unsupported performance profile: ${profile}`);
}

export { CARGO_TEST_ARGS };
