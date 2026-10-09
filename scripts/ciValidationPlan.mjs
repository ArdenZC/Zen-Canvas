import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { isValidSha } from "./ciEvidence.mjs";

const PULL_REQUEST_LANES = Object.freeze(["head_validation", "merge_integration"]);
const ZERO_SHA_PATTERN = /^0+$/;

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function laneForEvent(eventName, requestedLane) {
  const explicitLane = asString(requestedLane);
  if (explicitLane) return explicitLane;
  if (eventName === "workflow_dispatch") return "manual_full_validation";
  if (eventName === "schedule") return "scheduled_full_validation";
  return "push";
}

function outputTreeValue(value) {
  return value === null ? "not_applicable" : String(value);
}

function parseBoolean(value, name) {
  if (value === true || value === false) return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false.`);
}

function parseLanes(value) {
  if (Array.isArray(value)) return [...value];
  const text = asString(value);
  if (!text) return [];
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("validation_lanes must be a JSON array.");
  }
  if (!Array.isArray(parsed)) throw new Error("validation_lanes must be a JSON array.");
  return [...parsed];
}

function parseLaneJobExpectations(value) {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error("matrix_job_expectations must be a JSON object.");
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("matrix_job_expectations must be a JSON object.");
  }

  const expectations = {};
  for (const [jobId, expected] of Object.entries(parsed)) {
    if (!/^[a-z0-9-]+$/u.test(jobId)) {
      throw new Error("matrix_job_expectations contains an invalid job id.");
    }
    try {
      expectations[jobId] = parseBoolean(expected, "matrix_job_expectations entry");
    } catch {
      throw new Error("matrix_job_expectations values must be true or false.");
    }
  }
  return expectations;
}

function resultForExpectedMatrixJob(results, jobId, lane) {
  const matchingResults = results.filter((result) =>
    result?.job_id === jobId && result?.lane === lane,
  );
  if (matchingResults.length !== 1) return "missing";
  return asString(matchingResults[0]?.result).toLowerCase() || "missing";
}

/**
 * Read only sanitized lane result artifacts. The workflow publishes one
 * record per matrix job after validation, with no GitHub credential data.
 */
export function readValidationLaneJobResults(directory, runAttempt) {
  const root = asString(directory);
  if (!root) throw new Error("lane_job_results_directory is missing.");
  const attempt = asString(runAttempt);
  if (!/^\d+$/u.test(attempt) || Number(attempt) < 1) {
    throw new Error("lane_job_results_run_attempt must be a positive integer.");
  }

  let artifactDirectories;
  try {
    artifactDirectories = fs.readdirSync(root, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return [];
    throw error;
  }

  const results = [];
  for (const entry of artifactDirectories) {
    if (!entry.isDirectory() || !entry.name.startsWith("ci-lane-result-")) continue;
    const resultPath = path.join(root, entry.name, "ci-lane-result.json");
    const resultStat = fs.lstatSync(resultPath);
    if (!resultStat.isFile()) {
      throw new Error("lane result artifact does not contain a regular ci-lane-result.json file.");
    }

    const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
    const jobId = asString(result?.job_id);
    const lane = asString(result?.lane);
    const resultAttempt = asString(result?.run_attempt);
    const jobResult = asString(result?.result).toLowerCase();
    if (
      !/^[a-z0-9-]+$/u.test(jobId)
      || !PULL_REQUEST_LANES.includes(lane)
      || resultAttempt !== attempt
      || !jobResult
    ) {
      throw new Error("lane result artifact contains an invalid record.");
    }
    if (entry.name !== "ci-lane-result-" + attempt + "-" + jobId + "-" + lane) {
      throw new Error("lane result artifact name does not match its record.");
    }
    results.push({ job_id: jobId, lane, run_attempt: resultAttempt, result: jobResult });
  }
  return results;
}

/**
 * Summarize only routed matrix domains. Every expected domain must have one
 * actual successful result artifact for each required lane. Unrouted domains
 * stay skipped in their owning workflow checks and never count as success.
 */
export function summarizeValidationLaneResults(results = [], lanesValue, expectationsValue = {}) {
  const lanes = parseLanes(lanesValue);
  const expectations = parseLaneJobExpectations(expectationsValue);
  const requiredJobIds = Object.entries(expectations)
    .filter(([, expected]) => expected)
    .map(([jobId]) => jobId);

  return Object.fromEntries(lanes.map((lane) => {
    if (requiredJobIds.length === 0) return [lane, "not_required"];
    const laneResults = requiredJobIds.map((jobId) =>
      resultForExpectedMatrixJob(results, jobId, lane),
    );
    const failure = laneResults.find((result) => result !== "success");
    return [lane, failure ?? "success"];
  }));
}

export function validationLaneResultsForPlan(validationLanes, laneResults = {}) {
  const lanes = parseLanes(validationLanes);
  return {
    headValidationResult: lanes.includes("head_validation")
      ? laneResults.head_validation ?? "missing"
      : null,
    integrationValidationResult: lanes.includes("merge_integration")
      ? laneResults.merge_integration ?? "missing"
      : null,
  };
}

function fallbackPlan(eventName, validationLane) {
  const isPullRequest = eventName === "pull_request";
  return {
    schema_version: 1,
    plan_valid: false,
    event_name: eventName,
    tree_equivalent: isPullRequest ? false : null,
    head_validation_required: isPullRequest,
    validation_lanes: isPullRequest ? [...PULL_REQUEST_LANES] : [laneForEvent(eventName, validationLane)],
    head_checkout_sha: null,
    head_tree_sha: null,
    integration_checkout_sha: null,
    integration_tree_sha: null,
    event_checkout_sha: null,
    event_tree_sha: null,
    reason: "Validation plan inputs were incomplete or failed closed.",
  };
}

function requireSha(value, label) {
  if (!isValidSha(value) || ZERO_SHA_PATTERN.test(value)) {
    throw new Error(`${label} must be a full non-zero 40-character SHA.`);
  }
  return value.toLowerCase();
}

/**
 * Build the validation lanes from evidence produced by the source and
 * merge-integration checkouts. A pull request only skips duplicate expensive
 * validation when both independently recorded trees are equal.
 */
export function buildValidationPlan(input = {}) {
  const eventName = asString(input.eventName);
  const validationLane = laneForEvent(eventName, input.validationLane);
  const fallback = fallbackPlan(eventName, validationLane);

  if (!eventName) return { ...fallback, reason: "eventName is required." };

  const sourceEvidenceResult = asString(input.sourceEvidenceResult);
  const changeScopeResult = asString(input.changeScopeResult);
  if (sourceEvidenceResult !== "success") {
    return { ...fallback, reason: `source-evidence result was ${sourceEvidenceResult || "missing"}.` };
  }
  if (eventName === "pull_request" && changeScopeResult !== "success") {
    return { ...fallback, reason: `change-scope result was ${changeScopeResult || "missing"}.` };
  }

  if (eventName === "pull_request") {
    try {
      const headCheckoutSha = requireSha(input.headCheckoutSha, "head_checkout_sha");
      const headTreeSha = requireSha(input.headTreeSha, "head_tree_sha");
      const integrationCheckoutSha = requireSha(input.integrationCheckoutSha, "integration_checkout_sha");
      const integrationTreeSha = requireSha(input.integrationTreeSha, "integration_tree_sha");
      const prHeadSha = requireSha(input.prHeadSha, "pr_head_sha");
      const eventSha = requireSha(input.eventSha, "event_sha");

      if (headCheckoutSha !== prHeadSha) {
        return { ...fallback, reason: "head_checkout_sha does not match pr_head_sha." };
      }
      if (integrationCheckoutSha !== eventSha) {
        return { ...fallback, reason: "integration_checkout_sha does not match event_sha." };
      }

      const treeEquivalent = headTreeSha === integrationTreeSha;
      return {
        schema_version: 1,
        plan_valid: true,
        event_name: eventName,
        tree_equivalent: treeEquivalent,
        head_validation_required: !treeEquivalent,
        validation_lanes: treeEquivalent ? ["merge_integration"] : [...PULL_REQUEST_LANES],
        head_checkout_sha: headCheckoutSha,
        head_tree_sha: headTreeSha,
        integration_checkout_sha: integrationCheckoutSha,
        integration_tree_sha: integrationTreeSha,
        reason: treeEquivalent
          ? "PR head and merge-integration trees are equivalent; substantive validation runs once on the integration lane."
          : "PR head and merge-integration trees differ; applicable substantive validation is required on both lanes.",
      };
    } catch (error) {
      return { ...fallback, reason: error instanceof Error ? error.message : String(error) };
    }
  }

  try {
    const eventCheckoutSha = requireSha(
      input.eventCheckoutSha ?? input.integrationCheckoutSha,
      "event_checkout_sha",
    );
    const eventTreeSha = requireSha(
      input.eventTreeSha ?? input.integrationTreeSha,
      "event_tree_sha",
    );
    return {
      schema_version: 1,
      plan_valid: true,
      event_name: eventName,
      tree_equivalent: null,
      head_validation_required: false,
      validation_lanes: [validationLane],
      head_checkout_sha: null,
      head_tree_sha: null,
      integration_checkout_sha: null,
      integration_tree_sha: null,
      event_checkout_sha: eventCheckoutSha,
      event_tree_sha: eventTreeSha,
      reason: `Non-PR ${validationLane} runs its applicable validation once on the immutable event checkout.`,
    };
  } catch (error) {
    return { ...fallback, reason: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Validate the plan contract consumed by aggregate jobs. PR callers must
 * explicitly identify routed matrix domains and provide their actual lane
 * outcomes; non-PR callers retain the single immutable event lane.
 */
export function evaluateValidationAggregate(input = {}) {
  const eventName = asString(input.eventName);
  const planResult = asString(input.planResult);
  if (planResult !== "success") {
    return { pass: false, reason: `validation-plan result was ${planResult || "missing"}.` };
  }
  if (input.planValid !== undefined && input.planValid !== null) {
    try {
      if (!parseBoolean(input.planValid, "plan_valid")) {
        return { pass: false, reason: "validation-plan reported plan_valid=false." };
      }
    } catch (error) {
      return { pass: false, reason: error instanceof Error ? error.message : String(error) };
    }
  }

  let lanes;
  try {
    lanes = parseLanes(input.validationLanes);
  } catch (error) {
    return { pass: false, reason: error instanceof Error ? error.message : String(error) };
  }

  const isPullRequest = eventName === "pull_request";
  let treeEquivalent;
  try {
    treeEquivalent = isPullRequest ? parseBoolean(input.treeEquivalent, "tree_equivalent") : null;
  } catch (error) {
    return { pass: false, reason: error instanceof Error ? error.message : String(error) };
  }

  const expectedLanes = isPullRequest
    ? (treeEquivalent ? ["merge_integration"] : [...PULL_REQUEST_LANES])
    : [laneForEvent(eventName, input.validationLane)];
  if (JSON.stringify(lanes) !== JSON.stringify(expectedLanes)) {
    return {
      pass: false,
      reason: `validation lanes ${JSON.stringify(lanes)} do not match required lanes ${JSON.stringify(expectedLanes)}.`,
    };
  }

  const expectedHeadRequired = isPullRequest && !treeEquivalent;
  const headRequired = input.headValidationRequired === true
    || input.headValidationRequired === "true";
  if (headRequired !== expectedHeadRequired) {
    return {
      pass: false,
      reason: `head_validation_required=${headRequired} does not match tree equivalence.`,
    };
  }

  const laneJobResult = input.laneJobResult === undefined || input.laneJobResult === null
    ? null
    : asString(input.laneJobResult);
  if (laneJobResult !== null && laneJobResult !== "success") {
    return { pass: false, reason: `required validation lane result was ${laneJobResult || "missing"}.` };
  }

  const headValidationResult = input.headValidationResult === undefined || input.headValidationResult === null
    ? null
    : asString(input.headValidationResult).toLowerCase();
  const integrationValidationResult = input.integrationValidationResult === undefined || input.integrationValidationResult === null
    ? null
    : asString(input.integrationValidationResult).toLowerCase();

  if (isPullRequest) {
    let laneValidationRequired;
    try {
      laneValidationRequired = parseBoolean(input.laneValidationRequired, "lane_validation_required");
    } catch (error) {
      return { pass: false, reason: error instanceof Error ? error.message : String(error) };
    }

    if (!laneValidationRequired) {
      const requiredLaneResults = treeEquivalent
        ? [integrationValidationResult]
        : [headValidationResult, integrationValidationResult];
      if (requiredLaneResults.some((result) => result !== "not_required")) {
        return {
          pass: false,
          reason: "an unrouted validation lane must be explicitly classified not_required.",
        };
      }
    } else if (treeEquivalent) {
      if (headValidationResult !== null && headValidationResult !== "not_required") {
        return {
          pass: false,
          reason: "equivalent trees must not claim a head validation result of " + headValidationResult + ".",
        };
      }
      if (integrationValidationResult !== "success") {
        return {
          pass: false,
          reason: "equivalent trees require merge-integration success, got "
            + (integrationValidationResult || "missing") + ".",
        };
      }
    } else {
      if (headValidationResult !== "success") {
        return {
          pass: false,
          reason: "non-equivalent trees require head validation success, got "
            + (headValidationResult || "missing") + ".",
        };
      }
      if (integrationValidationResult !== "success") {
        return {
          pass: false,
          reason: "non-equivalent trees require merge-integration success, got "
            + (integrationValidationResult || "missing") + ".",
        };
      }
    }
  }

  return {
    pass: true,
    reason: isPullRequest && treeEquivalent
      ? "Equivalent-tree shortcut is valid; merge integration is the sole substantive lane."
      : isPullRequest
        ? "Non-equivalent trees require successful head and merge-integration lanes."
        : "Non-PR validation has one immutable event lane.",
    expected_lanes: expectedLanes,
  };
}

function appendOutput(values) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  fs.appendFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
}

function appendSummary(plan) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  const lines = [
    "## CI validation plan",
    `- plan valid: ${plan.plan_valid}`,
    `- event: ${plan.event_name}`,
    `- head checkout SHA: ${plan.head_checkout_sha ?? "n/a"}`,
    `- head tree SHA: ${plan.head_tree_sha ?? "n/a"}`,
    `- integration checkout SHA: ${plan.integration_checkout_sha ?? "n/a"}`,
    `- integration tree SHA: ${plan.integration_tree_sha ?? "n/a"}`,
    `- event checkout SHA: ${plan.event_checkout_sha ?? "n/a"}`,
    `- event tree SHA: ${plan.event_tree_sha ?? "n/a"}`,
    `- tree equivalent: ${plan.tree_equivalent === null ? "not applicable" : plan.tree_equivalent}`,
    `- head validation required: ${plan.head_validation_required}`,
    `- validation lanes: ${plan.validation_lanes.join(", ")}`,
    `- reason: ${plan.reason}`,
  ];
  fs.appendFileSync(summaryPath, `${lines.join("\n")}\n`, "utf8");
}

function runPlanCli() {
  const eventName = asString(process.env.EVENT_NAME || process.env.GITHUB_EVENT_NAME);
  const plan = buildValidationPlan({
    eventName,
    sourceEvidenceResult: process.env.SOURCE_EVIDENCE_RESULT,
    changeScopeResult: process.env.CHANGE_SCOPE_RESULT,
    validationLane: process.env.VALIDATION_LANE,
    headCheckoutSha: process.env.HEAD_CHECKOUT_SHA,
    headTreeSha: process.env.HEAD_TREE_SHA,
    integrationCheckoutSha: process.env.INTEGRATION_CHECKOUT_SHA,
    integrationTreeSha: process.env.INTEGRATION_TREE_SHA,
    eventCheckoutSha: process.env.EVENT_CHECKOUT_SHA,
    eventTreeSha: process.env.EVENT_TREE_SHA,
    prHeadSha: process.env.PR_HEAD_SHA,
    eventSha: process.env.EVENT_SHA,
  });
  appendOutput({
    plan_valid: String(plan.plan_valid),
    tree_equivalent: outputTreeValue(plan.tree_equivalent),
    head_validation_required: String(plan.head_validation_required),
    validation_lanes: JSON.stringify(plan.validation_lanes),
    head_checkout_sha: plan.head_checkout_sha ?? "",
    head_tree_sha: plan.head_tree_sha ?? "",
    integration_checkout_sha: plan.integration_checkout_sha ?? "",
    integration_tree_sha: plan.integration_tree_sha ?? "",
    event_checkout_sha: plan.event_checkout_sha ?? "",
    event_tree_sha: plan.event_tree_sha ?? "",
    reason: plan.reason,
  });
  appendSummary(plan);
  console.log(JSON.stringify(plan, null, 2));
}

function runAggregateCli() {
  const eventName = asString(process.env.EVENT_NAME || process.env.GITHUB_EVENT_NAME);
  let headValidationResult = process.env.HEAD_VALIDATION_RESULT;
  let integrationValidationResult = process.env.INTEGRATION_VALIDATION_RESULT;
  let laneValidationRequired = false;

  if (eventName === "pull_request") {
    try {
      const expectations = parseLaneJobExpectations(process.env.MATRIX_JOB_EXPECTATIONS);
      const requiredJobIds = Object.values(expectations).some(Boolean);
      laneValidationRequired = requiredJobIds;
      if (requiredJobIds) {
        const laneJobResults = readValidationLaneJobResults(
          process.env.LANE_JOB_RESULTS_DIRECTORY,
          process.env.GITHUB_RUN_ATTEMPT,
        );
        const laneResults = summarizeValidationLaneResults(
          laneJobResults,
          process.env.VALIDATION_LANES,
          expectations,
        );
        ({ headValidationResult, integrationValidationResult } =
          validationLaneResultsForPlan(process.env.VALIDATION_LANES, laneResults));
      } else {
        headValidationResult = "not_required";
        integrationValidationResult = "not_required";
      }
    } catch (error) {
      console.error(
        "[ci-validation-plan] Could not collect required lane results: "
          + (error instanceof Error ? error.message : String(error)),
      );
      laneValidationRequired = true;
      headValidationResult = "missing";
      integrationValidationResult = "missing";
    }
  }

  const result = evaluateValidationAggregate({
    eventName,
    planResult: process.env.PLAN_RESULT,
    treeEquivalent: process.env.TREE_EQUIVALENT,
    headValidationRequired: process.env.HEAD_VALIDATION_REQUIRED,
    validationLanes: process.env.VALIDATION_LANES,
    validationLane: process.env.VALIDATION_LANE,
    laneJobResult: process.env.LANE_JOB_RESULT,
    headValidationResult,
    integrationValidationResult,
    laneValidationRequired,
    planValid: process.env.PLAN_VALID,
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.pass) {
    console.error("[ci-validation-plan] " + result.reason);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.includes("--aggregate")) runAggregateCli();
  else runPlanCli();
}
