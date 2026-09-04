import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { isValidSha } from "./ciEvidence.mjs";

export const RELEASE_QUALIFIED_WORKFLOW_NAME = "CI Full Validation";
export const RELEASE_QUALIFIED_EVENTS = Object.freeze(["workflow_dispatch", "schedule"]);
export const REQUIRED_RELEASE_VALIDATION_JOBS = Object.freeze([
  "Full Validation / source evidence",
  "Full Validation / lane plan",
  "Quality (windows-latest)",
  "Quality (macos-latest)",
  "Package NSIS",
  "Package unsigned DMG",
  "Dependency audit",
]);

function requireExpectedSha(expectedSha) {
  if (!isValidSha(expectedSha)) {
    throw new Error("EXPECTED_SHA must be a full 40-character commit SHA.");
  }
  return expectedSha.toLowerCase();
}

export function selectReleaseQualifiedRun(payload, expectedSha) {
  const normalizedSha = requireExpectedSha(expectedSha);
  const runs = Array.isArray(payload?.workflow_runs) ? payload.workflow_runs : [];
  const successfulRuns = runs.filter((run) =>
    run?.name === RELEASE_QUALIFIED_WORKFLOW_NAME
    && typeof run.head_sha === "string"
    && run.head_sha.toLowerCase() === normalizedSha
    && run.status === "completed"
    && run.conclusion === "success"
    && RELEASE_QUALIFIED_EVENTS.includes(run.event),
  );

  if (successfulRuns.length === 0) {
    throw new Error(
      `No successful ${RELEASE_QUALIFIED_WORKFLOW_NAME} run is recorded for exact SHA ${expectedSha}.`,
    );
  }

  successfulRuns.sort((left, right) => Number(right?.id ?? 0) - Number(left?.id ?? 0));
  return successfulRuns[0];
}

export function assertReleaseQualifiedJobs(payload) {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
  const missing = [];

  for (const requiredName of REQUIRED_RELEASE_VALIDATION_JOBS) {
    const passed = jobs.some((job) =>
      job?.name === requiredName
      && job.status === "completed"
      && job.conclusion === "success",
    );
    if (!passed) missing.push(requiredName);
  }

  if (missing.length > 0) {
    throw new Error(`Release-qualified Full Validation is missing successful required jobs: ${missing.join(", ")}`);
  }

  return true;
}

async function readJsonFromStdin() {
  process.stdin.setEncoding("utf8");
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  if (!raw.trim()) throw new Error("Release qualification verifier requires JSON on stdin.");
  return JSON.parse(raw);
}

function writeGithubOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  fs.appendFileSync(outputPath, `${name}=${String(value)}\n`, "utf8");
}

async function runCli() {
  const mode = process.argv[2];
  const payload = await readJsonFromStdin();

  if (mode === "select-run") {
    const expectedSha = process.env.EXPECTED_SHA ?? "";
    const run = selectReleaseQualifiedRun(payload, expectedSha);
    if (!Number.isFinite(Number(run.id)) || Number(run.id) <= 0) {
      throw new Error("Selected Full Validation run does not expose a valid run id.");
    }
    writeGithubOutput("run_id", run.id);
    writeGithubOutput("run_url", run.html_url ?? "");
    console.log(`release qualification run: ${run.id}${run.html_url ? ` (${run.html_url})` : ""}`);
    return;
  }

  if (mode === "verify-jobs") {
    assertReleaseQualifiedJobs(payload);
    console.log(`release qualification jobs: ${REQUIRED_RELEASE_VALIDATION_JOBS.join(", ")}`);
    return;
  }

  throw new Error(`Unknown release qualification mode: ${mode ?? "<missing>"}.`);
}

const directPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (directPath && directPath === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
