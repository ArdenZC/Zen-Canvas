import { spawn } from "node:child_process";
import path from "node:path";

const vitestEntry = path.join("node_modules", "vitest", "vitest.mjs");
const child = spawn(process.execPath, [vitestEntry, "run", "tests/searchPerformance.test.ts"], {
  stdio: "inherit",
  env: {
    ...process.env,
    RUN_PERF_100K: "1"
  }
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
