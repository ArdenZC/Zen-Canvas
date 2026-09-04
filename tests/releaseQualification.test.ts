import { describe, expect, it } from "vitest";
import {
  assertReleaseQualifiedJobs,
  RELEASE_QUALIFIED_WORKFLOW_NAME,
  REQUIRED_RELEASE_VALIDATION_JOBS,
  selectReleaseQualifiedRun,
} from "../scripts/releaseQualification.mjs";

const RELEASE_SHA = "a".repeat(40);
const OTHER_SHA = "b".repeat(40);

function fullValidationRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    name: RELEASE_QUALIFIED_WORKFLOW_NAME,
    head_sha: RELEASE_SHA,
    status: "completed",
    conclusion: "success",
    event: "workflow_dispatch",
    html_url: "https://example.invalid/run/42",
    ...overrides,
  };
}

function successfulRequiredJobs() {
  return REQUIRED_RELEASE_VALIDATION_JOBS.map((name) => ({
    name,
    status: "completed",
    conclusion: "success",
  }));
}

describe("release qualification", () => {
  it("rejects a green docs-only ordinary CI by construction", () => {
    const payload = {
      workflow_runs: [
        {
          id: 99,
          name: "CI",
          head_sha: RELEASE_SHA,
          status: "completed",
          conclusion: "success",
          event: "pull_request",
        },
      ],
    };

    expect(() => selectReleaseQualifiedRun(payload, RELEASE_SHA)).toThrow(
      "No successful CI Full Validation run",
    );
  });

  it("requires exact SHA and a successful completed Full Validation event", () => {
    for (const run of [
      fullValidationRun({ head_sha: OTHER_SHA }),
      fullValidationRun({ status: "in_progress", conclusion: null }),
      fullValidationRun({ conclusion: "failure" }),
      fullValidationRun({ conclusion: "cancelled" }),
      fullValidationRun({ event: "pull_request" }),
      fullValidationRun({ event: "push" }),
    ]) {
      expect(() => selectReleaseQualifiedRun({ workflow_runs: [run] }, RELEASE_SHA)).toThrow(
        "No successful CI Full Validation run",
      );
    }
  });

  it("accepts manual or scheduled exact-SHA Full Validation and chooses the newest passing run", () => {
    const selected = selectReleaseQualifiedRun(
      {
        workflow_runs: [
          fullValidationRun({ id: 40, event: "schedule" }),
          fullValidationRun({ id: 41, event: "workflow_dispatch" }),
          fullValidationRun({ id: 100, head_sha: OTHER_SHA }),
        ],
      },
      RELEASE_SHA,
    );

    expect(selected.id).toBe(41);
  });

  it("rejects malformed or non-exact expected SHA input", () => {
    expect(() => selectReleaseQualifiedRun({ workflow_runs: [fullValidationRun()] }, "main")).toThrow(
      "EXPECTED_SHA must be a full 40-character commit SHA",
    );
  });

  it("requires source evidence, both platform quality gates, current packages, and dependency audit", () => {
    expect(assertReleaseQualifiedJobs({ jobs: successfulRequiredJobs() })).toBe(true);

    for (const requiredName of REQUIRED_RELEASE_VALIDATION_JOBS) {
      const jobs = successfulRequiredJobs().filter((job) => job.name !== requiredName);
      expect(() => assertReleaseQualifiedJobs({ jobs })).toThrow(requiredName);
    }
  });

  it("does not accept a required job that was skipped, cancelled, failed, or incomplete", () => {
    for (const replacement of [
      { status: "completed", conclusion: "skipped" },
      { status: "completed", conclusion: "cancelled" },
      { status: "completed", conclusion: "failure" },
      { status: "in_progress", conclusion: null },
    ]) {
      const jobs = successfulRequiredJobs();
      jobs[0] = { name: REQUIRED_RELEASE_VALIDATION_JOBS[0], ...replacement };
      expect(() => assertReleaseQualifiedJobs({ jobs })).toThrow(
        REQUIRED_RELEASE_VALIDATION_JOBS[0],
      );
    }
  });
});
