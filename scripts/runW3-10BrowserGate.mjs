import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const actualCheckoutSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const sourceHead = process.env.W310_SOURCE_HEAD ?? process.env.GITHUB_SHA ?? actualCheckoutSha;
const expectedCheckoutSha = process.env.W310_EXPECTED_CHECKOUT_SHA ?? actualCheckoutSha;

const gates = [
  {
    script: "runW3-10PhaseABrowserHarness.mjs",
    env: {
      W310_SOURCE_HEAD: sourceHead,
      W310_EXPECTED_CHECKOUT_SHA: expectedCheckoutSha,
    },
  },
  {
    script: "runW3-09BrowserGate.mjs",
    env: {
      W309_SOURCE_HEAD: sourceHead,
      W309_EXPECTED_CHECKOUT_SHA: expectedCheckoutSha,
    },
  },
];

for (const gate of gates) {
  const result = spawnSync(
    process.execPath,
    [path.resolve("scripts", gate.script)],
    {
      cwd: process.cwd(),
      env: { ...process.env, ...gate.env },
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`[w3-10-real] PASS sourceHead=${sourceHead} actualSha=${actualCheckoutSha}`);
