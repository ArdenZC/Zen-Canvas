import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const result = spawnSync(
  process.execPath,
  [path.join(root, "scripts/runPerformanceProfile.mjs"), ...process.argv.slice(2)],
  { cwd: root, env: process.env, stdio: "inherit" },
);

if (result.error) {
  console.error(`Performance profile compatibility runner failed to start: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
