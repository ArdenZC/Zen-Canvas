import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import {
  getPrecompileTargetsForSuites,
  getRequiredBinaryKeys,
  PERFORMANCE_SUITE_NAMES,
  PERFORMANCE_TARGETS,
  PERFORMANCE_BUILD_FEATURES,
  resolvePerformanceSuite,
} from "./performanceManifest.mjs";
import { resolvePerformanceProfile } from "./performanceProfile.mjs";
import {
  createBinaryManifest,
  manifestTargetPath,
  sha256File,
  validateBinaryManifest,
  writeJson,
} from "./performanceArtifactManifest.mjs";
import { createPerformanceBuildIdentity } from "./performanceBuildIdentity.mjs";

const root = process.cwd();
const cargoManifest = path.join(root, "src-tauri", "Cargo.toml");

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

function resolveFeatures(argv) {
  return parseFlag(argv, "--features") ?? process.env.PERF_FEATURES ?? PERFORMANCE_BUILD_FEATURES;
}

function outputRoot(argv) {
  const value = parseFlag(argv, "--output") ?? ".performance-artifacts/binaries";
  return path.resolve(root, value);
}

function cacheRoot(argv) {
  const value = parseFlag(argv, "--cache-root") ?? ".performance-cache/binaries";
  return path.resolve(root, value);
}

function currentCommit() {
  return process.env.PERF_CHECKOUT_SHA
    || process.env.GITHUB_SHA
    || execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
}

function cargoLockSha256() {
  return crypto.createHash("sha256")
    .update(fs.readFileSync(path.join(root, "src-tauri", "Cargo.lock")))
    .digest("hex");
}

function rustVersion() {
  return execFileSync("rustc", ["-Vv"], { cwd: root, encoding: "utf8" }).trim();
}

function resolveRustVersion(argv) {
  const testRustVersion = parseFlag(argv, "--test-rust-version");
  if (testRustVersion === undefined) return rustVersion();
  if (process.env.NODE_ENV !== "test") {
    throw new Error("--test-rust-version is only available when NODE_ENV=test.");
  }
  if (!testRustVersion.trim()) throw new Error("--test-rust-version must not be empty.");
  return testRustVersion;
}

function printOutput(stdout, stderr, includeRawStdout = false) {
  if (stderr) process.stderr.write(stderr);
  if (includeRawStdout && stdout) process.stdout.write(stdout);
  if (includeRawStdout || !stdout) return;
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const message = JSON.parse(line);
      if (message.reason === "compiler-message" && message.message?.rendered) {
        process.stderr.write(message.message.rendered);
      }
    } catch {
      // Ignore non-diagnostic Cargo JSON during a successful Prepare run.
    }
  }
}

function findCompilerExecutable(stdout, target) {
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const message = JSON.parse(line);
      if (
        message.reason === "compiler-artifact"
        && message.target?.name === target.executableStem
        && message.profile?.test === true
        && message.executable
      ) {
        return path.resolve(root, message.executable);
      }
    } catch {
      // Cargo may interleave non-JSON diagnostics; the final fallback handles old output.
    }
  }
  const targetRoot = process.env.CARGO_TARGET_DIR
    ? path.resolve(process.env.CARGO_TARGET_DIR)
    : path.join(root, "src-tauri", "target");
  const depsRoot = path.join(targetRoot, "release", "deps");
  const candidates = fs.existsSync(depsRoot)
    ? fs.readdirSync(depsRoot)
      .filter((name) => name.startsWith(`${target.executableStem}-`) && name.endsWith(".exe"))
      .map((name) => path.join(depsRoot, name))
    : [];
  if (candidates.length === 1) return candidates[0];
  throw new Error(`Cargo did not report one executable for target ${target.id}.`);
}

function compileTarget(target) {
  const started = Date.now();
  const result = spawnSync(
    "cargo",
    [
      "test",
      "--release",
      "--locked",
      "--no-run",
      "--message-format=json-render-diagnostics",
      "--manifest-path",
      cargoManifest,
      ...target.targetArgs,
    ],
    {
      cwd: root,
      env: process.env,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 20 * 1024 * 1024,
    },
  );
  printOutput(result.stdout, result.stderr, result.status !== 0 || Boolean(result.error));
  if (result.error) throw new Error(`Cargo target ${target.id} failed to start: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`Cargo target ${target.id} failed with exit code ${result.status}.`);
  const executable = findCompilerExecutable(result.stdout ?? "", PERFORMANCE_TARGETS[target.targetKey]);
  if (!fs.existsSync(executable)) throw new Error(`Compiled executable is missing: ${executable}`);
  console.log(`[perf-prepare] phase=cargo-compile target=${target.targetKey} ms=${Date.now() - started}`);
  return executable;
}

function targetMetadata(stagingRoot, targetKey, source) {
  const executableName = `${targetKey}.exe`;
  const destination = path.join(stagingRoot, "bin", executableName);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  return {
    targetKey,
    path: `bin/${executableName}`,
    size: fs.statSync(destination).size,
    sha256: sha256File(destination),
  };
}

function clearOutput(rootPath) {
  fs.rmSync(rootPath, { recursive: true, force: true });
  fs.mkdirSync(rootPath, { recursive: true });
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
  const features = resolveFeatures(argv);
  const destinationRoot = outputRoot(argv);
  const reusableCacheBaseRoot = cacheRoot(argv);
  clearOutput(destinationRoot);

  const commit = currentCommit();
  const lockHash = cargoLockSha256();
  const rust = resolveRustVersion(argv);
  const targets = getPrecompileTargetsForSuites(suites);
  const targetKeys = targets.map((target) => target.targetKey);
  const identity = createPerformanceBuildIdentity({ profile, features, targetKeys, rust });
  if (identity.cargoLockSha256 !== lockHash) throw new Error("Performance build identity Cargo.lock hash drifted.");
  const reusableCacheRoot = path.join(reusableCacheBaseRoot, identity.buildIdentity);
  const cacheManifestPath = path.join(reusableCacheRoot, "manifest.json");
  let compiled = new Map();
  let cacheHit = false;

  if (fs.existsSync(cacheManifestPath)) {
    const cacheManifest = validateBinaryManifest(reusableCacheRoot, {
      expectedProfile: profile,
      expectedBuildIdentity: identity.buildIdentity,
      expectedCargoLockSha256: lockHash,
      expectedRustVersion: rust,
      expectedSuites: suites,
      expectedCacheScope: "build-identity",
      requiredTargets: targetKeys,
    });
    compiled = new Map(targetKeys.map((targetKey) => [
      targetKey,
      manifestTargetPath(reusableCacheRoot, cacheManifest, targetKey),
    ]));
    cacheHit = true;
  } else {
    const compileStarted = Date.now();
    for (const target of targets) {
      compiled.set(target.targetKey, compileTarget(target));
    }
    console.log(`[perf-prepare] phase=cargo-compile-total ms=${Date.now() - compileStarted}`);

    clearOutput(reusableCacheRoot);
    const cacheTargets = Object.fromEntries(
      [...compiled.entries()].map(([targetKey, source]) => [
        targetKey,
        targetMetadata(reusableCacheRoot, targetKey, source),
      ]),
    );
    writeJson(
      cacheManifestPath,
      createBinaryManifest({
        commit,
        generatedFromCommit: commit,
        profile,
        suites,
        rustVersion: rust,
        cargoLockSha256: lockHash,
        buildIdentity: identity.buildIdentity,
        runner: identity.runner,
        features,
        cacheScope: "build-identity",
        targets: cacheTargets,
      }),
    );
    validateBinaryManifest(reusableCacheRoot, {
      expectedProfile: profile,
      expectedBuildIdentity: identity.buildIdentity,
      expectedCargoLockSha256: lockHash,
      expectedRustVersion: rust,
      expectedSuites: suites,
      expectedCacheScope: "build-identity",
      requiredTargets: targetKeys,
    });
  }

  console.log(`[perf-prepare] prepared-binary-cache=${cacheHit ? "hit" : "miss"}`);
  console.log(`[perf-prepare] cargo-compile-ms=${cacheHit ? 0 : "recorded"}`);

  const prepareRoot = path.join(destinationRoot, "_prepare");
  const prepareTargets = Object.fromEntries(
    targetKeys.map((targetKey) => [
      targetKey,
      targetMetadata(prepareRoot, targetKey, compiled.get(targetKey)),
    ]),
  );
  writeJson(
    path.join(prepareRoot, "manifest.json"),
    createBinaryManifest({
      commit,
      generatedFromCommit: commit,
      profile,
      suites,
      rustVersion: rust,
      cargoLockSha256: lockHash,
      buildIdentity: identity.buildIdentity,
      runner: identity.runner,
      features,
      cacheScope: "current-run",
      targets: prepareTargets,
    }),
  );
  validateBinaryManifest(prepareRoot, {
    expectedCommit: commit,
    expectedProfile: profile,
    expectedBuildIdentity: identity.buildIdentity,
    expectedCargoLockSha256: lockHash,
    expectedRustVersion: rust,
    expectedSuites: suites,
    expectedCacheScope: "current-run",
    requiredTargets: targetKeys,
  });

  for (const suite of suites) {
    const suiteRoot = path.join(destinationRoot, suite);
    const suiteTargets = Object.fromEntries(getRequiredBinaryKeys(suite).map((targetKey) => [
      targetKey,
      targetMetadata(suiteRoot, targetKey, compiled.get(targetKey)),
    ]));
    writeJson(
      path.join(suiteRoot, "manifest.json"),
      createBinaryManifest({
        commit,
        generatedFromCommit: commit,
        profile,
        suites: [suite],
        rustVersion: rust,
        cargoLockSha256: lockHash,
        buildIdentity: identity.buildIdentity,
        runner: identity.runner,
        features,
        cacheScope: "current-run",
        targets: suiteTargets,
      }),
    );
    validateBinaryManifest(suiteRoot, {
      expectedCommit: commit,
      expectedProfile: profile,
      expectedBuildIdentity: identity.buildIdentity,
      expectedCargoLockSha256: lockHash,
      expectedRustVersion: rust,
      expectedSuites: [suite],
      expectedCacheScope: "current-run",
      requiredTargets: getRequiredBinaryKeys(suite),
    });
  }

  writeOutput({
    suites: suites.join(","),
    profile,
    binary_build_identity: identity.buildIdentity,
    binary_cache_hit: cacheHit ? "true" : "false",
  });
  console.log(`[perf-prepare] prepared-binaries=${destinationRoot}`);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
