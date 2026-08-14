import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  createBinaryManifest,
  createFixtureManifest,
  readJson,
  sha256File,
  validateBinaryManifest,
  validateFixtureManifest,
  writeJson,
} from "../scripts/performanceArtifactManifest.mjs";
import {
  getFixtureWorkingFiles,
  getPerformanceBenchmarks,
  getPrecompileTargets,
  getPrecompileTargetsForSuites,
  getRequiredBinaryKeys,
  PERFORMANCE_SUITE_NAMES,
  PERFORMANCE_SUITES,
} from "../scripts/performanceManifest.mjs";
import { buildPreparedTestArgs, runPreparedTestBinary } from "../scripts/runPreparedPerformanceBinary.mjs";
import { resolvePerformanceProfile } from "../scripts/performanceProfile.mjs";
import { createPerformanceBuildIdentity } from "../scripts/performanceBuildIdentity.mjs";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("performance profile and manifest contract", () => {
  it("supports exactly the four named suites and two profiles", () => {
    expect(PERFORMANCE_SUITE_NAMES).toEqual(["search", "scan-schema", "library-content", "intelligence"]);
    expect(Object.keys(PERFORMANCE_SUITES)).toEqual([...PERFORMANCE_SUITE_NAMES]);
    expect(resolvePerformanceProfile([])).toBe("full");
    expect(resolvePerformanceProfile(["--profile=extended"])).toBe("extended");
    expect(() => resolvePerformanceProfile(["--profile=pr"])).toThrow("Unsupported performance profile: pr");
  });

  it("keeps one benchmark in exactly one suite and retains every 1M gate in Full", () => {
    const ids = new Set<string>();
    for (const suite of PERFORMANCE_SUITE_NAMES) {
      const extended = getPerformanceBenchmarks(suite, "extended") as Array<{ id: string }>;
      const full = getPerformanceBenchmarks(suite, "full") as Array<{ id: string }>;
      expect(extended.every((benchmark) => !benchmark.id.includes("1m"))).toBe(true);
      expect(new Set(full.map((benchmark) => benchmark.id)).size).toBe(full.length);
      for (const benchmark of extended) expect(full.some((item) => item.id === benchmark.id)).toBe(true);
      for (const benchmark of full) {
        expect(ids.has(benchmark.id)).toBe(false);
        ids.add(benchmark.id);
      }
      expect(getPrecompileTargets(suite).length).toBeGreaterThan(0);
      expect(getRequiredBinaryKeys(suite).length).toBeGreaterThan(0);
    }
    expect(ids.has("global_search_1m")).toBe(true);
    expect(ids.has("file_library_1m")).toBe(true);
    expect(ids.has("file_library_migration_1m")).toBe(true);
    expect(ids.has("content_migration_1m")).toBe(true);
    expect(ids.has("rule_proposal_1m")).toBe(true);
  });

  it("deduplicates shared Cargo targets in the single Prepare plan", () => {
    const targets = getPrecompileTargetsForSuites([...PERFORMANCE_SUITE_NAMES]);
    expect(targets.map((target) => target.targetKey)).toEqual([
      "lib",
      "fts",
      "migrations",
      "fileLibrary",
      "fixtureBuilder",
    ]);
  });

  it("keeps fixture ownership explicit and profile-sized", () => {
    expect(getFixtureWorkingFiles("search", "full")).toEqual([]);
    expect(getFixtureWorkingFiles("library-content", "extended")).toHaveLength(3);
    expect(getFixtureWorkingFiles("library-content", "full")).toHaveLength(6);
    expect(getFixtureWorkingFiles("library-content", "full")).toContain("file-library-1000000-content-migration.sqlite3");
  });

  it("rejects unknown suite arguments before starting a prepared binary", () => {
    const result = spawnSync(
      process.execPath,
      [path.join(process.cwd(), "scripts/runPerformanceSuite.mjs"), "--suite=unknown", "--profile=extended"],
      { cwd: process.cwd(), env: process.env, encoding: "utf8" },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unsupported performance suite: unknown");
  });

  it("fails closed when CI consumers lack prepared binaries or fixtures", () => {
    const script = path.join(process.cwd(), "scripts/runPerformanceSuite.mjs");
    const missingBinary = spawnSync(
      process.execPath,
      [script, "--suite=search", "--profile=extended"],
      {
        cwd: process.cwd(),
        env: { ...process.env, CI: "true", GITHUB_ACTIONS: "true" },
        encoding: "utf8",
      },
    );
    expect(missingBinary.status).toBe(1);
    expect(missingBinary.stderr).toContain("CI performance shards require --prepared-binaries");

    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zen-canvas-performance-missing-fixture-"));
    const binary = path.join(tempRoot, "fileLibrary.exe");
    const libraryIdentity = createPerformanceBuildIdentity({
      profile: "extended",
      targetKeys: getPrecompileTargetsForSuites(["library-content"]).map((target) => target.targetKey),
    });
    fs.writeFileSync(binary, "prepared-binary");
    writeJson(path.join(tempRoot, "manifest.json"), createBinaryManifest({
      commit: "commit-1",
      profile: "extended",
      suites: ["library-content"],
      rustVersion: "rustc test",
      cargoLockSha256: libraryIdentity.cargoLockSha256,
      buildIdentity: libraryIdentity.buildIdentity,
      targets: {
        fileLibrary: { path: "fileLibrary.exe", size: fs.statSync(binary).size, sha256: sha256File(binary) },
      },
    }));
    const missingFixture = spawnSync(
      process.execPath,
      [script, "--suite=library-content", "--profile=extended", `--prepared-binaries=${tempRoot}`],
      {
        cwd: process.cwd(),
        env: { ...process.env, CI: "true", GITHUB_ACTIONS: "true", GITHUB_SHA: "commit-1" },
        encoding: "utf8",
      },
    );
    expect(missingFixture.status).toBe(1);
    expect(missingFixture.stderr).toContain("requires --fixture-root");
  });

  it("moves compilation and fixture preparation out of the consumer runner", () => {
    const suite = read("scripts/runPerformanceSuite.mjs");
    const prepareBinaries = read("scripts/preparePerformanceBinaries.mjs");
    const prepareFixtures = read("scripts/preparePerformanceFixtures.mjs");
    expect(suite).toContain("--prepared-binaries");
    expect(suite).toContain("CI performance shards require --prepared-binaries");
    expect(suite).toContain("runPreparedTestBinary");
    expect(suite).not.toContain("cargo test");
    expect(suite).not.toContain('"--no-run"');
    expect(suite).toContain("prepareMissing");
    expect(prepareBinaries).toContain('"--no-run"');
    expect(prepareBinaries).toContain("cargo");
    expect(prepareFixtures).toContain("runPreparedTestBinary");
    expect(prepareFixtures).not.toContain("cargo test");
    expect(read("scripts/runPerformanceProfile.mjs")).toContain("preparePerformanceBinaries.mjs");
  });

  it("preserves direct Rust test-binary CLI semantics and exit propagation", () => {
    expect(buildPreparedTestArgs("test_name", { ignored: true, testThreads: 1 })).toEqual([
      "test_name",
      "--exact",
      "--ignored",
      "--nocapture",
      "--test-threads=1",
    ]);
    const calls: Array<{ command: string; args: string[] }> = [];
    runPreparedTestBinary({
      executable: "fake.exe",
      testName: "passing_test",
      cwd: process.cwd(),
      env: process.env,
      spawnImpl: (command: string, args: string[]) => {
        calls.push({ command, args });
        return { status: 0, signal: null };
      },
    });
    expect(calls[0]).toEqual({
      command: "fake.exe",
      args: ["passing_test", "--exact", "--ignored", "--nocapture"],
    });
    expect(() => runPreparedTestBinary({
      executable: "fake.exe",
      testName: "failing_test",
      cwd: process.cwd(),
      env: process.env,
      spawnImpl: () => ({ status: 1, signal: null, stdout: "out", stderr: "err" }),
    })).toThrow(/exit code 1/);
    expect(() => runPreparedTestBinary({
      executable: "missing.exe",
      testName: "missing_test",
      cwd: process.cwd(),
      env: process.env,
      spawnImpl: () => ({
        status: null,
        signal: null,
        error: new Error("not found"),
      }),
    })).toThrow("not found");
    expect(() => runPreparedTestBinary({
      executable: "fake.exe",
      testName: "timeout_test",
      cwd: process.cwd(),
      env: process.env,
      spawnImpl: () => ({
        status: null,
        signal: null,
        error: new Error("timed out"),
      }),
    })).toThrow("timed out");
  });

  it("validates binary commit/hash/path and fixture manifest contracts", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zen-canvas-performance-artifact-"));
    const binary = path.join(tempRoot, "bin.exe");
    fs.writeFileSync(binary, "prepared-binary");
    writeJson(path.join(tempRoot, "manifest.json"), createBinaryManifest({
      commit: "commit-1",
      profile: "extended",
      suites: ["search"],
      rustVersion: "rustc test",
      cargoLockSha256: "lock-hash",
      buildIdentity: "build-identity-1",
      targets: {
        lib: { path: "bin.exe", size: fs.statSync(binary).size, sha256: sha256File(binary) },
      },
    }));
    expect(validateBinaryManifest(tempRoot, {
      expectedCommit: "commit-1",
      expectedProfile: "extended",
      requiredTargets: ["lib"],
    }).commit).toBe("commit-1");
    fs.writeFileSync(binary, "tampered-binary");
    expect(() => validateBinaryManifest(tempRoot, {
      expectedCommit: "commit-1",
      requiredTargets: ["lib"],
    })).toThrow("hash mismatch");
    fs.writeFileSync(binary, "prepared-binary");
    expect(() => validateBinaryManifest(tempRoot, { expectedCommit: "wrong" })).toThrow("commit mismatch");

    const fixture = path.join(tempRoot, "fixture.sqlite3");
    fs.writeFileSync(fixture, "fixture");
    writeJson(path.join(tempRoot, "manifest.json"), createFixtureManifest({
      commit: "commit-1",
      profile: "extended",
      suites: ["library-content"],
      schemaVersion: 34,
      fixtureFormatVersion: 1,
      fixtureIdentity: "fixture-identity-1",
      rowCounts: [100_000],
      files: { "fixture.sqlite3": { size: fs.statSync(fixture).size, sha256: sha256File(fixture) } },
    }));
    expect(validateFixtureManifest(tempRoot, {
      expectedProfile: "extended",
      expectedFixtureIdentity: "fixture-identity-1",
      expectedSchemaVersion: 34,
      expectedFixtureFormatVersion: 1,
      expectedRowCounts: [100_000],
      requiredFiles: ["fixture.sqlite3"],
    }).schemaVersion).toBe(34);
    expect(() => validateFixtureManifest(tempRoot, { expectedFixtureIdentity: "wrong" }))
      .toThrow("identity mismatch");
  });

  it("reuses a build-identity binary cache without invoking Cargo and refreshes provenance", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zen-canvas-performance-binary-cache-"));
    const cacheRoot = path.join(tempRoot, "cache");
    const outputRoot = path.join(tempRoot, "output");
    const identity = createPerformanceBuildIdentity({
      profile: "extended",
      targetKeys: getPrecompileTargetsForSuites(["search"]).map((target) => target.targetKey),
    });
    const cacheEntryRoot = path.join(cacheRoot, identity.buildIdentity);
    const rustVersion = execFileSync("rustc", ["-Vv"], { encoding: "utf8" }).trim();
    const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const targets = Object.fromEntries(getPrecompileTargetsForSuites(["search"]).map((target) => {
      const relativePath = `bin/${target.targetKey}.exe`;
      const targetPath = path.join(cacheEntryRoot, relativePath);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, `cached-${target.targetKey}`);
      return [target.targetKey, {
        targetKey: target.targetKey,
        path: relativePath,
        size: fs.statSync(targetPath).size,
        sha256: sha256File(targetPath)
      }];
    }));
    writeJson(path.join(cacheEntryRoot, "manifest.json"), createBinaryManifest({
      commit: "older-run-commit",
      generatedFromCommit: "older-run-commit",
      profile: "extended",
      suites: ["search"],
      rustVersion,
      cargoLockSha256: identity.cargoLockSha256,
      buildIdentity: identity.buildIdentity,
      runner: identity.runner,
      cacheScope: "build-identity",
      targets
    }));

    const result = spawnSync(
      process.execPath,
      [
        path.join(process.cwd(), "scripts/preparePerformanceBinaries.mjs"),
        "--suites=search",
        "--profile=extended",
        `--cache-root=${cacheRoot}`,
        `--output=${outputRoot}`
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          GITHUB_SHA: commit
        },
        encoding: "utf8"
      }
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[perf-prepare] prepared-binary-cache=hit");
    expect(result.stdout).toContain("[perf-prepare] cargo-compile-ms=0");
    expect(result.stdout).not.toContain("phase=cargo-compile");
    const currentRun = readJson(path.join(outputRoot, "_prepare", "manifest.json")) as {
      commit: string;
      generatedFromCommit: string;
      buildIdentity: string;
    };
    expect(currentRun.commit).toBe(commit);
    expect(currentRun.generatedFromCommit).toBe(commit);
    expect(currentRun.buildIdentity).toBe(identity.buildIdentity);
  });

  it("keeps binary cache identity independent of commit and run-attempt metadata", () => {
    const first = createPerformanceBuildIdentity({
      profile: "full",
      runnerOs: "Windows",
      runnerArch: "X64"
    });
    const second = createPerformanceBuildIdentity({
      profile: "full",
      runnerOs: "Windows",
      runnerArch: "X64"
    });

    expect(second.buildIdentity).toBe(first.buildIdentity);
    expect(JSON.stringify(first.payload)).not.toContain("GITHUB_SHA");
    expect(JSON.stringify(first.payload)).not.toContain("GITHUB_RUN_ID");
    expect(JSON.stringify(first.payload)).not.toContain("package.json");
    expect(JSON.stringify(first.payload)).not.toContain("docs/");
  });

  it("separates binary cache identities by profile and prepared target set", () => {
    const search = createPerformanceBuildIdentity({
      profile: "full",
      targetKeys: getPrecompileTargetsForSuites(["search"]).map((target) => target.targetKey),
    });
    const all = createPerformanceBuildIdentity({
      profile: "full",
      targetKeys: getPrecompileTargetsForSuites([...PERFORMANCE_SUITE_NAMES]).map((target) => target.targetKey),
    });
    const extended = createPerformanceBuildIdentity({
      profile: "extended",
      targetKeys: getPrecompileTargetsForSuites([...PERFORMANCE_SUITE_NAMES]).map((target) => target.targetKey),
    });

    expect(search.buildIdentity).not.toBe(all.buildIdentity);
    expect(all.buildIdentity).not.toBe(extended.buildIdentity);
    const inputs = all.payload.inputs as Array<{ path: string }>;
    expect(inputs.some((input) => input.path === "src-tauri/src/db/queries/library/mod.rs")).toBe(true);
    expect(inputs.some((input) => input.path === "src-tauri/Cargo.lock")).toBe(true);
    expect(inputs.some((input) => input.path === "package.json")).toBe(false);
    expect(inputs.some((input) => input.path.startsWith("docs/"))).toBe(false);
  });

  it("keeps the PR compatibility command bounded and preserves gates", () => {
    const source = read("scripts/runPerformanceTestPr.mjs");
    expect(source).toContain('ZC_PERFORMANCE_PROFILE: "extended"');
    expect(source).toContain('ZC_FTS_FULL_PROFILE: "false"');
    expect(source).toContain("fts_benchmark_100k");
    expect(source).toContain('"--locked"');
    expect(source.match(/fts_benchmark_100k/g)).toHaveLength(1);
    const fts = read("src-tauri/tests/fts_benchmark.rs");
    const library = read("src-tauri/tests/file_library_performance.rs");
    expect(fts).toContain("const DEFAULT_ROWS: usize = 100_000");
    expect(fts).toContain("const DEFAULT_P95_MS: f64 = 1_000.0");
    expect(fts).toContain("if full_profile");
    expect(fts).not.toContain("INSERT_BATCH_SIZE");
    expect(library).toContain("seed_library_for_benchmark");
    expect(library).toContain("performance_1m_file_library_query_matrix");
    expect(library).toContain("performance_1m_schema_32_to_33_rule_proposal_migration");
    expect(read("src-tauri/src/db/queries/rule_proposals/mod.rs")).toContain("for index in 100_000..1_000_000_usize");
  });
});
