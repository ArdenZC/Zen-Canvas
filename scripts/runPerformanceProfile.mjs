import path from "node:path";
import { spawnSync } from "node:child_process";
import { PERFORMANCE_SUITE_NAMES } from "./performanceManifest.mjs";
import { resolvePerformanceProfile } from "./performanceProfile.mjs";

const root = process.cwd();
let profile;
try {
  profile = resolvePerformanceProfile(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const started = Date.now();
for (const suite of PERFORMANCE_SUITE_NAMES) {
  console.log(`Running compatibility performance suite ${suite} (${profile})...`);
  const result = spawnSync(
    process.execPath,
    [path.join(root, "scripts/runPerformanceSuite.mjs"), `--suite=${suite}`, `--profile=${profile}`],
    { cwd: root, env: process.env, stdio: "inherit" },
  );
  if (result.error) {
    console.error(`${suite} performance suite failed to start: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`${suite} performance suite failed with exit code ${result.status}.`);
    process.exit(result.status ?? 1);
  }
}

console.log(`All ${profile} performance suites passed in ${((Date.now() - started) / 1000).toFixed(3)}s.`);
