import { spawnSync } from "node:child_process";
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

describe("release qualification CLI", () => {
  it("reads streamed JSON from stdin without synchronous fd reads", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/releaseQualification.mjs", "verify-jobs"],
      {
        input: successfulJobsPayload(),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("release qualification jobs:");
  });
});
