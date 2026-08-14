import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getFixtureKeys, resolvePerformanceSuite } from "./performanceManifest.mjs";
import { resolvePerformanceProfile } from "./performanceProfile.mjs";

const root = process.cwd();

function parseArguments(argv) {
  const suiteArgument = argv.find((argument) => argument.startsWith("--suite="));
  const profileArgument = argv.find((argument) => argument.startsWith("--profile="));
  if (!suiteArgument || !profileArgument) {
    throw new Error("Fixture preparation requires --suite=<name> and --profile=<profile>.");
  }
  return {
    suite: resolvePerformanceSuite([suiteArgument]),
    profile: resolvePerformanceProfile([profileArgument]),
  };
}

function fixtureRoot() {
  return process.env.ZC_PERF_FIXTURE_ROOT
    ? path.resolve(process.env.ZC_PERF_FIXTURE_ROOT)
    : path.join(root, ".tmp-performance-fixtures");
}

let selection;
try {
  selection = parseArguments(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const { suite, profile } = selection;
const cacheRoot = fixtureRoot();
const fixtureKeys = getFixtureKeys(suite, profile);
fs.mkdirSync(cacheRoot, { recursive: true });

const metadataPath = path.join(cacheRoot, `${suite}-${profile}.metadata.json`);
const metadata = {
  formatVersion: 1,
  schemaVersion: 34,
  suite,
  profile,
  fixtureKeys,
};
if (fs.existsSync(metadataPath)) {
  const existing = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  if (
    existing.formatVersion !== metadata.formatVersion
    || existing.schemaVersion !== metadata.schemaVersion
    || existing.suite !== metadata.suite
    || existing.profile !== metadata.profile
    || JSON.stringify(existing.fixtureKeys) !== JSON.stringify(metadata.fixtureKeys)
  ) {
    throw new Error(`Performance fixture metadata is incompatible: ${metadataPath}`);
  }
}
fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

if (suite !== "library-content" || fixtureKeys.length === 0) {
  console.log(`No reusable database fixtures required for ${suite} (${profile}).`);
  process.exit(0);
}

const builderEnv = {
  ...process.env,
  ZC_PERF_FIXTURE_ROOT: cacheRoot,
  ZC_PERF_FIXTURE_REQUIRED: "0",
  ZC_PERF_FIXTURE_BUILD: "1",
  ZC_PERFORMANCE_PROFILE: profile,
};
const result = spawnSync(
  "cargo",
  [
    "test",
    "--release",
    "--locked",
    "--manifest-path",
    "src-tauri/Cargo.toml",
    "--test",
    "performance_fixture_builder",
    "build_requested_performance_fixtures",
    "--",
    "--ignored",
    "--nocapture",
  ],
  {
    cwd: root,
    env: builderEnv,
    stdio: "inherit",
  },
);
if (result.error) {
  console.error(`Performance fixture builder failed to start: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(`Performance fixture builder failed with exit code ${result.status}.`);
  process.exit(result.status ?? 1);
}

const tempRoot = os.tmpdir();
console.log(`Reusable performance fixtures ready at ${cacheRoot}; process temp root is ${tempRoot}.`);
