import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();

function run(label, command, args, options = {}) {
  console.log(`Running ${label}...`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    ...options,
  });
  if (result.error) {
    console.error(`${label} failed to start: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`${label} failed with exit code ${result.status}.`);
    process.exit(result.status ?? 1);
  }
  console.log(`${label} passed.`);
}

run(
  "bounded UI behavior checks",
  process.execPath,
  [
    path.join(root, "node_modules/vitest/vitest.mjs"),
    "run",
    "tests/fileLibraryPagination.test.ts",
    "tests/virtualization.test.ts",
    "tests/searchSpotlight.test.ts",
  ],
);

// Keep one 100k complexity sentinel in every code PR. The remaining large
// migration, scan, dedupe, and analysis suites run only in the explicit full
// validation workflow, scheduled validation, or the master push gate.
run(
  "100k SQLite/FTS complexity sentinel",
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
);
