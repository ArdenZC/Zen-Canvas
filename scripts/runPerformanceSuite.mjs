import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  getFixtureKeys,
  getPerformanceBenchmarks,
  getPrecompileTargets,
  resolvePerformanceSuite,
} from "./performanceManifest.mjs";
import { resolvePerformanceProfile } from "./performanceProfile.mjs";

const root = process.cwd();

function parseArguments(argv) {
  let suite;
  let profile;
  for (const argument of argv) {
    if (argument.startsWith("--suite=") || argument === "--suite") {
      suite = argument;
    } else if (argument.startsWith("--profile=") || argument === "--profile") {
      profile = argument;
    } else {
      throw new Error(`Unknown performance suite argument: ${argument}`);
    }
  }
  return {
    suite: resolvePerformanceSuite(suite ? [suite] : []),
    profile: resolvePerformanceProfile(profile ? [profile] : []),
  };
}

function run(label, command, args, env) {
  console.log(`Running ${label}...`);
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: "inherit",
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

function cargoArgs(targetArgs, testName, { ignored = true, testThreads } = {}) {
  return [
    "test",
    "--release",
    "--locked",
    "--manifest-path",
    "src-tauri/Cargo.toml",
    ...targetArgs,
    ...(testName ? [testName] : []),
    "--",
    ...(ignored ? ["--ignored"] : []),
    "--nocapture",
    ...(testThreads ? [`--test-threads=${testThreads}`] : []),
  ];
}

function appendSummary(suite, profile, elapsedMs) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  fs.appendFileSync(
    summaryPath,
    `- ${suite} (${profile}) wall-clock: ${(elapsedMs / 1000).toFixed(3)}s\n`,
    "utf8",
  );
}

let selection;
try {
  selection = parseArguments(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const { suite, profile } = selection;
const benchmarkEnv = {
  ...process.env,
  ZC_PERFORMANCE_PROFILE: profile,
  ZC_PERF_SUITE: suite,
  ZC_FTS_FULL_PROFILE: String(profile === "full"),
  ZC_PERF_FIXTURE_REQUIRED: getFixtureKeys(suite, profile).length > 0 ? "1" : "0",
};
const started = Date.now();

run(
  "Performance fixture preparation",
  process.execPath,
  [path.join(root, "scripts/preparePerformanceFixtures.mjs"), `--suite=${suite}`, `--profile=${profile}`],
  benchmarkEnv,
);

for (const target of getPrecompileTargets(suite)) {
  run(
    `Precompile ${target.id}`,
    "cargo",
    [
      "test",
      "--release",
      "--locked",
      "--no-run",
      "--manifest-path",
      "src-tauri/Cargo.toml",
      ...target.targetArgs,
    ],
    benchmarkEnv,
  );
}

for (const benchmark of getPerformanceBenchmarks(suite, profile)) {
  run(
    benchmark.label,
    "cargo",
    cargoArgs(benchmark.targetArgs, benchmark.testName, benchmark),
    { ...benchmarkEnv, ...benchmark.env },
  );
}

const elapsedMs = Date.now() - started;
console.log(`${suite} ${profile} performance suite passed in ${(elapsedMs / 1000).toFixed(3)}s.`);
appendSummary(suite, profile, elapsedMs);
