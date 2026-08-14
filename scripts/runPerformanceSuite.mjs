import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import {
  getFixtureWorkingFiles,
  getPerformanceBenchmarks,
  getRequiredBinaryKeys,
  resolvePerformanceSuite,
} from "./performanceManifest.mjs";
import { resolvePerformanceProfile } from "./performanceProfile.mjs";
import {
  manifestTargetPath,
  validateBinaryManifest,
  validateFixtureManifest,
} from "./performanceArtifactManifest.mjs";
import { runPreparedTestBinary } from "./runPreparedPerformanceBinary.mjs";

const root = process.cwd();

function parseValue(argv, name) {
  const index = argv.findIndex((argument) => argument === name || argument.startsWith(`${name}=`));
  if (index < 0) return undefined;
  const argument = argv[index];
  if (argument.startsWith(`${name}=`)) return argument.slice(name.length + 1);
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
  return value;
}

function parseArguments(argv) {
  const allowed = ["--suite", "--profile", "--prepared-binaries", "--fixture-root", "--prepare-missing-fixtures"];
  for (const argument of argv) {
    if (argument === "--prepare-missing-fixtures") continue;
    if (!allowed.some((name) => argument === name || argument.startsWith(`${name}=`))) {
      throw new Error(`Unknown performance suite argument: ${argument}`);
    }
  }
  const suiteValue = parseValue(argv, "--suite");
  const profileValue = parseValue(argv, "--profile");
  return {
    suite: resolvePerformanceSuite(suiteValue ? [`--suite=${suiteValue}`] : []),
    profile: resolvePerformanceProfile(profileValue ? [`--profile=${profileValue}`] : []),
    preparedBinaries: parseValue(argv, "--prepared-binaries"),
    fixtureRoot: parseValue(argv, "--fixture-root"),
    prepareMissing: argv.includes("--prepare-missing-fixtures"),
  };
}

function currentCommit() {
  return process.env.GITHUB_SHA
    || execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
}

function runPreparation(suite, profile) {
  const artifactRoot = path.join(root, ".performance-artifacts");
  const commands = [
    ["preparePerformanceBinaries.mjs", [`--suites=${suite}`, `--profile=${profile}`, `--output=${path.join(artifactRoot, "binaries")}`]],
    ["preparePerformanceFixtures.mjs", [`--suites=${suite}`, `--profile=${profile}`, `--prepared-binaries=${path.join(artifactRoot, "binaries")}`, `--cache-root=${path.join(root, ".tmp-performance-fixtures", "cache")}`, `--output=${path.join(artifactRoot, "fixtures")}`]],
  ];
  for (const [script, args] of commands) {
    const result = spawnSync(process.execPath, [path.join(root, "scripts", script), ...args], {
      cwd: root,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });
    if (result.error) throw new Error(`${script} failed to start: ${result.error.message}`);
    if (result.status !== 0) throw new Error(`${script} failed with exit code ${result.status}.`);
  }
  return {
    preparedBinaries: path.join(artifactRoot, "binaries", suite),
    fixtureRoot: path.join(artifactRoot, "fixtures"),
  };
}

function appendSummary(suite, profile, elapsedMs) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  fs.appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `- ${suite} (${profile}) wall-clock: ${(elapsedMs / 1000).toFixed(3)}s\n`,
    "utf8",
  );
}

function main(argv) {
  const selection = parseArguments(argv);
  const { suite, profile } = selection;
  let preparedBinaries = selection.preparedBinaries
    ? path.resolve(root, selection.preparedBinaries)
    : undefined;
  let fixtureRoot = selection.fixtureRoot
    ? path.resolve(root, selection.fixtureRoot)
    : undefined;
  if (!preparedBinaries) {
    const isCi = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
    if (isCi && !selection.prepareMissing) {
      throw new Error("CI performance shards require --prepared-binaries; refusing to build in the consumer shard.");
    }
    if (!selection.prepareMissing) {
      throw new Error("Prepared binaries are required. Use --prepare-missing-fixtures for explicit local preparation.");
    }
    const prepared = runPreparation(suite, profile);
    preparedBinaries = prepared.preparedBinaries;
    fixtureRoot = prepared.fixtureRoot;
  }

  const benchmarks = getPerformanceBenchmarks(suite, profile);
  const binaryManifest = validateBinaryManifest(preparedBinaries, {
    expectedCommit: currentCommit(),
    expectedProfile: profile,
    requiredTargets: getRequiredBinaryKeys(suite),
  });
  const requiredFixtures = getFixtureWorkingFiles(suite, profile);
  if (requiredFixtures.length > 0) {
    if (!fixtureRoot) throw new Error(`Suite ${suite} requires --fixture-root.`);
    validateFixtureManifest(fixtureRoot, {
      expectedCommit: currentCommit(),
      expectedProfile: profile,
      requiredFiles: requiredFixtures,
    });
  }

  const benchmarkEnv = {
    ...process.env,
    ZC_PERFORMANCE_PROFILE: profile,
    ZC_PERF_SUITE: suite,
    ZC_FTS_FULL_PROFILE: String(profile === "full"),
    ZC_PERF_FIXTURE_REQUIRED: requiredFixtures.length > 0 ? "1" : "0",
    ...(fixtureRoot ? {
      ZC_PERF_FIXTURE_ROOT: fixtureRoot,
      ZC_PERF_PREPARED_WORKING_COPY: "1",
    } : {}),
  };
  const started = Date.now();
  for (const benchmark of benchmarks) {
    const benchmarkStarted = Date.now();
    console.log(`Running ${benchmark.label} from prepared binary...`);
    runPreparedTestBinary({
      executable: manifestTargetPath(preparedBinaries, binaryManifest, benchmark.targetKey),
      testName: benchmark.testName,
      ignored: benchmark.ignored,
      testThreads: benchmark.testThreads,
      cwd: root,
      env: { ...benchmarkEnv, ...benchmark.env },
      timeoutMs: 45 * 60 * 1000,
    });
    console.log(
      `[perf-phase] suite=${suite} phase=benchmark id=${benchmark.id} ms=${Date.now() - benchmarkStarted}`,
    );
  }
  const elapsedMs = Date.now() - started;
  console.log(`${suite} ${profile} performance suite passed in ${(elapsedMs / 1000).toFixed(3)}s.`);
  appendSummary(suite, profile, elapsedMs);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
