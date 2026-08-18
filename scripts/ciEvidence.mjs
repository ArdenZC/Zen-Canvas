import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const ZERO_SHA_PATTERN = /^0+$/;

export function isValidSha(value) {
  return typeof value === "string" && SHA_PATTERN.test(value);
}

function requiredSha(value, label) {
  if (!isValidSha(value) || ZERO_SHA_PATTERN.test(value)) {
    throw new Error(`${label} must be a 40-character commit SHA.`);
  }
  return value.toLowerCase();
}

function requiredText(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function requiredRepository(value, label) {
  return requiredText(value, label).toLowerCase();
}

function pullRequestEvidence({
  lane,
  repository,
  eventSha,
  selectedRef,
  prBaseSha,
  prHeadSha,
  prHeadRepository,
  prHeadRef,
}) {
  const baseSha = requiredSha(prBaseSha, "PR base SHA");
  const headSha = requiredSha(prHeadSha, "PR head SHA");
  const baseRepository = requiredRepository(repository, "base repository");
  const sourceRepository = requiredRepository(prHeadRepository, "PR head repository");
  const mergeRefSha = requiredSha(eventSha, "pull_request event SHA");

  if (lane === "head_validation") {
    return {
      lane,
      event_name: "pull_request",
      source_repository: sourceRepository,
      checkout_repository: sourceRepository,
      checkout_ref: headSha,
      selected_ref: requiredText(selectedRef, "selected pull-request ref"),
      expected_checkout_sha: headSha,
      expected_pr_base_sha: baseSha,
      expected_pr_head_sha: headSha,
      integration_commit_sha: null,
      diff_base: baseSha,
      diff_head: headSha,
      head_repository_kind: sourceRepository === baseRepository ? "same_repository" : "fork",
      source_is_trusted: false,
      pr_head_ref: prHeadRef || null,
    };
  }

  if (lane === "merge_integration") {
    return {
      lane,
      event_name: "pull_request",
      source_repository: sourceRepository,
      checkout_repository: baseRepository,
      checkout_ref: mergeRefSha,
      selected_ref: requiredText(selectedRef, "selected pull-request ref"),
      expected_checkout_sha: mergeRefSha,
      expected_pr_base_sha: baseSha,
      expected_pr_head_sha: headSha,
      integration_commit_sha: mergeRefSha,
      diff_base: baseSha,
      diff_head: headSha,
      head_repository_kind: sourceRepository === baseRepository ? "same_repository" : "fork",
      source_is_trusted: false,
      pr_head_ref: prHeadRef || null,
    };
  }

  throw new Error(`Unsupported pull_request evidence lane: ${lane}`);
}

export function resolveCiEvidence({
  eventName,
  lane,
  repository,
  eventSha,
  eventBefore,
  selectedRef,
  prBaseSha,
  prHeadSha,
  prHeadRepository,
  prHeadRef,
} = {}) {
  const event = requiredText(eventName, "event name");
  const selected = requiredText(selectedRef, "selected ref");

  if (event === "pull_request") {
    return pullRequestEvidence({
      lane,
      repository,
      eventSha,
      selectedRef: selected,
      prBaseSha,
      prHeadSha,
      prHeadRepository,
      prHeadRef,
    });
  }

  const sourceSha = requiredSha(eventSha, `${event} event SHA`);
  const sourceRepository = requiredRepository(repository, "source repository");

  if (event === "push") {
    const beforeSha = isValidSha(eventBefore) && !ZERO_SHA_PATTERN.test(eventBefore)
      ? eventBefore.toLowerCase()
      : null;
    return {
      lane: lane || "push",
      event_name: event,
      source_repository: sourceRepository,
      checkout_repository: sourceRepository,
      checkout_ref: sourceSha,
      selected_ref: selected,
      expected_checkout_sha: sourceSha,
      expected_pr_base_sha: null,
      expected_pr_head_sha: null,
      integration_commit_sha: null,
      diff_base: beforeSha,
      diff_head: sourceSha,
      head_repository_kind: null,
      source_is_trusted: true,
      pr_head_ref: null,
    };
  }

  if (event === "schedule" || event === "workflow_dispatch") {
    const fullLane = event === "schedule"
      ? "scheduled_full_validation"
      : "manual_full_validation";
    return {
      lane: lane || fullLane,
      event_name: event,
      source_repository: sourceRepository,
      checkout_repository: sourceRepository,
      checkout_ref: sourceSha,
      selected_ref: selected,
      expected_checkout_sha: sourceSha,
      expected_pr_base_sha: null,
      expected_pr_head_sha: null,
      integration_commit_sha: null,
      diff_base: null,
      diff_head: sourceSha,
      head_repository_kind: null,
      source_is_trusted: true,
      pr_head_ref: null,
    };
  }

  throw new Error(`Unsupported CI event: ${event}`);
}

export function assertCheckoutEvidence(expectedSha, actualSha) {
  const expected = requiredSha(expectedSha, "expected checkout SHA");
  const actual = requiredSha(actualSha, "actual checkout SHA");
  if (expected !== actual) {
    throw new Error(`Checked-out commit ${actual} does not match expected commit ${expected}.`);
  }
  return true;
}

function gitValue(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim().toLowerCase();
}

function appendOutput(values) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  fs.appendFileSync(
    outputPath,
    `${Object.entries(values).map(([key, value]) => `${key}=${value ?? ""}`).join("\n")}\n`,
    "utf8",
  );
}

function appendSummary(evidence) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  const lines = [
    "## CI source evidence",
    `- lane: ${evidence.lane}`,
    `- event: ${evidence.event_name}`,
    `- source repository: ${evidence.source_repository}`,
    `- checkout repository: ${evidence.checkout_repository}`,
    `- checkout ref selected: ${evidence.checkout_ref}`,
    `- expected checkout SHA: ${evidence.expected_checkout_sha}`,
    `- actual checkout SHA: ${evidence.actual_checkout_sha}`,
    `- actual checkout tree: ${evidence.actual_checkout_tree}`,
    `- diff_base: ${evidence.diff_base ?? "not_applicable"}`,
    `- diff_head: ${evidence.diff_head ?? "not_applicable"}`,
    `- run identity: ${evidence.run_id || "local"}/${evidence.job_id || "local"}`,
  ];
  fs.appendFileSync(summaryPath, `${lines.join("\n")}\n`, "utf8");
}

export function buildCheckoutEvidence(input = {}) {
  const resolved = resolveCiEvidence(input);
  const actualSha = input.actualCheckoutSha || gitValue(["rev-parse", "HEAD"]);
  const actualTree = input.actualCheckoutTree || gitValue(["rev-parse", "HEAD^{tree}"]);
  assertCheckoutEvidence(resolved.expected_checkout_sha, actualSha);
  if (!isValidSha(actualTree)) {
    throw new Error("actual checkout tree must be a 40-character tree SHA.");
  }

  return {
    schema_version: 1,
    ...resolved,
    actual_checkout_sha: actualSha,
    actual_checkout_tree: actualTree,
    run_id: input.runId || process.env.GITHUB_RUN_ID || null,
    job_id: input.jobId || process.env.GITHUB_JOB || null,
    workflow_ref: input.workflowRef || process.env.GITHUB_WORKFLOW_REF || null,
  };
}

function runCli() {
  const eventName = process.env.EVENT_NAME || process.env.GITHUB_EVENT_NAME;
  const lane = process.env.CI_LANE || undefined;
  const evidence = buildCheckoutEvidence({
    eventName,
    lane,
    repository: process.env.REPOSITORY || process.env.GITHUB_REPOSITORY,
    eventSha: process.env.EVENT_SHA || process.env.GITHUB_SHA,
    eventBefore: process.env.EVENT_BEFORE || undefined,
    selectedRef: process.env.SELECTED_REF || process.env.GITHUB_REF,
    prBaseSha: process.env.PR_BASE || undefined,
    prHeadSha: process.env.PR_HEAD || undefined,
    prHeadRepository: process.env.PR_HEAD_REPOSITORY || undefined,
    prHeadRef: process.env.PR_HEAD_REF || undefined,
  });

  const evidenceDirectory = path.resolve(process.env.CI_EVIDENCE_DIR || ".ci-evidence");
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  const evidencePath = path.join(evidenceDirectory, `${evidence.lane}.json`);
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  appendOutput({
    lane: evidence.lane,
    expected_checkout_sha: evidence.expected_checkout_sha,
    actual_checkout_sha: evidence.actual_checkout_sha,
    actual_checkout_tree: evidence.actual_checkout_tree,
    checkout_sha: evidence.actual_checkout_sha,
    tree_sha: evidence.actual_checkout_tree,
    diff_base: evidence.diff_base,
    diff_head: evidence.diff_head,
    evidence_path: evidencePath,
  });
  appendSummary(evidence);
  console.log(JSON.stringify(evidence, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runCli();
}
