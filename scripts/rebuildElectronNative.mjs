import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const electronVersion = require("electron/package.json").version;
const rebuildCli = path.join(path.dirname(require.resolve("@electron/rebuild")), "cli.js");
const args = ["-f", "-w", "better-sqlite3", "-v", electronVersion];

const result = spawnSync(process.execPath, [rebuildCli, ...args], { stdio: "inherit" });

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
