import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  getFixtureWorkingFilesForSuites,
  PERFORMANCE_SUITE_NAMES,
  resolvePerformanceSuite,
} from "./performanceManifest.mjs";
import { resolvePerformanceProfile } from "./performanceProfile.mjs";
import {
  createFixtureManifest,
  manifestTargetPath,
  sha256File,
  validateBinaryManifest,
  writeJson,
} from "./performanceArtifactManifest.mjs";
import { runPreparedTestBinary } from "./runPreparedPerformanceBinary.mjs";

const root = process.cwd();

function parseFlag(argv, name) {
  const index = argv.findIndex((argument) => argument === name || argument.startsWith(`${name}=`));
  if (index < 0) return undefined;
  const argument = argv[index];
  if (argument.startsWith(`${name}=`)) return argument.slice(name.length + 1);
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
  return value;
}

function resolveSuites(argv) {
  if (argv.includes("--all")) return [...PERFORMANCE_SUITE_NAMES];
  const value = parseFlag(argv, "--suites")
    ?? process.env.PERF_SUITES
    ?? PERFORMANCE_SUITE_NAMES.filter((suite) => {
      const key = suite.replaceAll("-", "_").replaceAll("/", "_");
      return process.env[`PERF_${key.toUpperCase()}`] === "true";
    }).join(",");
  if (!value) throw new Error("Specify --suites=<comma-separated names> or --all.");
  const suites = [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
  if (suites.length === 0) throw new Error("At least one performance suite is required.");
  for (const suite of suites) resolvePerformanceSuite([`--suite=${suite}`]);
  return suites;
}

function resolveProfile(argv) {
  const value = parseFlag(argv, "--profile");
  return resolvePerformanceProfile(value ? [`--profile=${value}`] : []);
}

function resolvePath(argv, name, fallback) {
  return path.resolve(root, parseFlag(argv, name) ?? fallback);
}

function currentCommit() {
  return process.env.GITHUB_SHA
    || execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
}

function writeOutput(values) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `${Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n")}\n`,
    "utf8",
  );
}

function main(argv) {
  const profile = resolveProfile(argv);
  const suites = resolveSuites(argv);
  const cacheRoot = resolvePath(
    argv,
    "--cache-root",
    process.env.ZC_PERF_FIXTURE_CACHE_ROOT ?? ".tmp-performance-fixtures/cache",
  );
  const outputRoot = resolvePath(
    argv,
    "--output",
    process.env.ZC_PERF_FIXTURE_OUTPUT_ROOT ?? ".performance-artifacts/fixtures",
  );
  const binariesRoot = resolvePath(argv, "--prepared-binaries", ".performance-artifacts/binaries");
  const requiredFiles = getFixtureWorkingFilesForSuites(suites, profile);
  if (requiredFiles.length === 0) {
    console.log(`[perf-prepare] no reusable fixtures required for suites=${suites.join(",")} profile=${profile}`);
    writeOutput({ fixture_cache_hit: "true" });
    return;
  }

  fs.mkdirSync(cacheRoot, { recursive: true });
  fs.mkdirSync(outputRoot, { recursive: true });
  const baseRows = profile === "full" ? [100_000, 1_000_000] : [100_000];
  const baseFiles = baseRows.map((rowCount) => path.join(cacheRoot, `file-library-${rowCount}.sqlite3`));
  const cacheHitBeforeBuild = baseFiles.every((file) => fs.existsSync(file));
  const builderManifestRoot = path.join(binariesRoot, "_prepare");
  const binaryManifest = validateBinaryManifest(builderManifestRoot, {
    expectedCommit: currentCommit(),
    expectedProfile: profile,
    requiredTargets: ["fixtureBuilder"],
  });
  const builder = manifestTargetPath(builderManifestRoot, binaryManifest, "fixtureBuilder");
  const started = Date.now();
  runPreparedTestBinary({
    executable: builder,
    testName: "build_requested_performance_fixtures",
    cwd: root,
    env: {
      ...process.env,
      ZC_PERF_FIXTURE_ROOT: cacheRoot,
      ZC_PERF_FIXTURE_WORKING_ROOT: outputRoot,
      ZC_PERF_FIXTURE_REQUIRED: "0",
      ZC_PERF_FIXTURE_BUILD: "1",
      ZC_PERFORMANCE_PROFILE: profile,
    },
    timeoutMs: 45 * 60 * 1000,
  });
  console.log(
    `[perf-prepare] phase=fixture-generation cache=${cacheHitBeforeBuild ? "hit" : "miss"} ms=${Date.now() - started}`,
  );

  const files = {};
  for (const relativePath of requiredFiles) {
    const filePath = path.join(outputRoot, relativePath);
    if (!fs.existsSync(filePath)) throw new Error(`Prepared fixture is missing: ${filePath}`);
    files[relativePath] = { size: fs.statSync(filePath).size, sha256: sha256File(filePath) };
  }
  writeJson(
    path.join(outputRoot, "manifest.json"),
    createFixtureManifest({
      commit: currentCommit(),
      profile,
      suites,
      schemaVersion: 34,
      fixtureFormatVersion: 1,
      files,
    }),
  );
  writeOutput({
    fixture_cache_hit: cacheHitBeforeBuild ? "true" : "false",
    fixture_files: requiredFiles.length,
  });
  console.log(`[perf-prepare] phase=fixture-validation files=${requiredFiles.length} ms=0`);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
