import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import {
  getPrecompileTargetsForSuites,
  getRequiredBinaryKeys,
  PERFORMANCE_SUITE_NAMES,
  PERFORMANCE_TARGETS,
  resolvePerformanceSuite,
} from "./performanceManifest.mjs";
import { resolvePerformanceProfile } from "./performanceProfile.mjs";
import {
  createBinaryManifest,
  sha256File,
  writeJson,
} from "./performanceArtifactManifest.mjs";

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

function outputRoot(argv) {
  const value = parseFlag(argv, "--output") ?? ".performance-artifacts/binaries";
  return path.resolve(root, value);
}

function currentCommit() {
  return process.env.GITHUB_SHA
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

function main(argv) {
  const profile = resolveProfile(argv);
  const suites = resolveSuites(argv);
  const destinationRoot = outputRoot(argv);
  fs.mkdirSync(destinationRoot, { recursive: true });
  const commit = currentCommit();
  const lockHash = cargoLockSha256();
  const rust = rustVersion();
  const targets = getPrecompileTargetsForSuites(suites);
  const compiled = new Map();
  const compileStarted = Date.now();
  for (const target of targets) {
    compiled.set(target.targetKey, compileTarget(target));
  }
  console.log(`[perf-prepare] phase=cargo-compile-total ms=${Date.now() - compileStarted}`);

  const prepareRoot = path.join(destinationRoot, "_prepare");
  const prepareTargets = Object.fromEntries(
    [...compiled.entries()].map(([targetKey, source]) => [
      targetKey,
      targetMetadata(prepareRoot, targetKey, source),
    ]),
  );
  writeJson(
    path.join(prepareRoot, "manifest.json"),
    createBinaryManifest({
      commit,
      profile,
      suites,
      rustVersion: rust,
      cargoLockSha256: lockHash,
      targets: prepareTargets,
    }),
  );

  for (const suite of suites) {
    const suiteRoot = path.join(destinationRoot, suite);
    const targetKeys = getRequiredBinaryKeys(suite);
    const suiteTargets = Object.fromEntries(targetKeys.map((targetKey) => [
      targetKey,
      targetMetadata(suiteRoot, targetKey, compiled.get(targetKey)),
    ]));
    writeJson(
      path.join(suiteRoot, "manifest.json"),
      createBinaryManifest({
        commit,
        profile,
        suites: [suite],
        rustVersion: rust,
        cargoLockSha256: lockHash,
        targets: suiteTargets,
      }),
    );
  }

  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    fs.appendFileSync(outputPath, `suites=${suites.join(",")}\nprofile=${profile}\n`, "utf8");
  }
  console.log(`[perf-prepare] prepared-binaries=${destinationRoot}`);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
