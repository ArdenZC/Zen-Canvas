import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  getPrecompileTargetsForSuites,
  PERFORMANCE_SUITE_NAMES,
} from "./performanceManifest.mjs";
import { resolvePerformanceProfile } from "./performanceProfile.mjs";
import { createPerformanceBuildIdentity } from "./performanceBuildIdentity.mjs";
import { createPerformanceFixtureIdentity } from "./performanceFixtureIdentity.mjs";

const root = process.cwd();

function parseProfile(argv) {
  const argument = argv.find((value) => value === "--profile" || value.startsWith("--profile="));
  if (argument === "--profile") throw new Error("--profile requires a value.");
  return resolvePerformanceProfile(argument ? [argument] : []);
}

function runNode(script, args) {
  const result = spawnSync(process.execPath, [path.join(root, "scripts", script), ...args], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw new Error(`${script} failed to start: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${script} failed with exit code ${result.status}.`);
}

function main(argv) {
  const profile = parseProfile(argv);
  const artifactRoot = path.join(root, ".performance-artifacts");
  const binariesRoot = path.join(artifactRoot, "binaries");
  const binaryIdentity = createPerformanceBuildIdentity({
    profile,
    targetKeys: getPrecompileTargetsForSuites(PERFORMANCE_SUITE_NAMES).map((target) => target.targetKey),
  });
  const fixtureIdentity = createPerformanceFixtureIdentity({ profile });
  const fixturesRoot = path.join(
    root,
    ".tmp-performance-fixtures",
    "cache",
    fixtureIdentity.fixtureIdentity,
  );
  runNode("preparePerformanceBinaries.mjs", [
    "--all",
    `--profile=${profile}`,
    `--output=${binariesRoot}`,
  ]);
  runNode("preparePerformanceFixtures.mjs", [
    "--all",
    `--profile=${profile}`,
    `--prepared-binaries=${binariesRoot}`,
    `--cache-root=${path.join(root, ".tmp-performance-fixtures", "cache")}`,
    `--fixture-identity=${fixtureIdentity.fixtureIdentity}`,
  ]);
  const started = Date.now();
  for (const suite of PERFORMANCE_SUITE_NAMES) {
    const args = [
      `--suite=${suite}`,
      `--profile=${profile}`,
      `--prepared-binaries=${path.join(binariesRoot, suite)}`,
      `--build-identity=${binaryIdentity.buildIdentity}`,
    ];
    if (suite === "library-content") {
      args.push(`--fixture-root=${fixturesRoot}`);
      args.push(`--fixture-identity=${fixtureIdentity.fixtureIdentity}`);
    }
    runNode("runPerformanceSuite.mjs", args);
  }
  console.log(`All ${profile} performance suites passed in ${((Date.now() - started) / 1000).toFixed(3)}s.`);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
