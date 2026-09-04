import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";
import { REQUIRED_RELEASE_VALIDATION_JOBS } from "../scripts/releaseQualification.mjs";

function successfulJobsPayload() {
  return JSON.stringify({
    jobs: REQUIRED_RELEASE_VALIDATION_JOBS.map((name) => ({
      name,
      status: "completed",
      conclusion: "success",
    })),
  });
}

function runWithDelayedChunkedStdin(payload: string) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["scripts/releaseQualification.mjs", "verify-jobs"],
      { stdio: ["pipe", "pipe", "pipe"] },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));

    const midpoint = Math.floor(payload.length / 2);
    setTimeout(() => {
      child.stdin.write(payload.slice(0, midpoint));
      setTimeout(() => {
        child.stdin.end(payload.slice(midpoint));
      }, 25);
    }, 100);
  });
}

describe("release qualification CLI", () => {
  it("waits for delayed chunked pipe input instead of synchronously reading an empty nonblocking fd", async () => {
    const result = await runWithDelayedChunkedStdin(successfulJobsPayload());

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("release qualification jobs:");
  });
});
