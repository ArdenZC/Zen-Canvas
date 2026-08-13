import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const result = spawnSync(
  process.execPath,
  [path.join(root, "scripts/runPerformanceTest.mjs")],
  {
    cwd: root,
    env: {
      ...process.env,
      ZC_PERFORMANCE_PROFILE: "extended",
    },
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(`Extended performance profile failed to start: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(`Extended performance profile failed with exit code ${result.status}.`);
  process.exit(result.status ?? 1);
}
