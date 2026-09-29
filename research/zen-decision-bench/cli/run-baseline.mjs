#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readJsonl, validateDataset } from "../src/core.mjs";

const [datasetPath, adapterPath, outputPath, ...optionArgs] = process.argv.slice(2);
if (!datasetPath || !adapterPath || !outputPath) {
  console.error("usage: node research/zen-decision-bench/cli/run-baseline.mjs <dataset.jsonl> <adapter.mjs> <out.jsonl> [--split pilot|dev|test] [--manifest corpus-manifest.json] [--run-manifest out.run.json]");
  process.exit(2);
}

let split = null;
let manifestPath = null;
let runManifestPath = null;
for (let index = 0; index < optionArgs.length; index += 1) {
  const arg = optionArgs[index];
  if (arg.startsWith("--split=")) split = arg.slice("--split=".length);
  else if (arg === "--split") split = optionArgs[index += 1] ?? null;
  else if (arg.startsWith("--manifest=")) manifestPath = arg.slice("--manifest=".length);
  else if (arg === "--manifest") manifestPath = optionArgs[index += 1] ?? null;
  else if (arg.startsWith("--run-manifest=")) runManifestPath = arg.slice("--run-manifest=".length);
  else if (arg === "--run-manifest") runManifestPath = optionArgs[index += 1] ?? null;
  else throw new Error(`unknown_option:${arg}`);
}
if (split !== null && !["pilot", "dev", "test"].includes(split)) throw new Error(`invalid_split:${split}`);
runManifestPath ||= `${outputPath}.run.json`;

function gitValue(args) {
  try {
    return execFileSync("git", args, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return null;
  }
}

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableErrorCode(error) {
  const message = String(error instanceof Error ? error.message : error).trim();
  if (!message) return "unknown_error";
  if (/^[A-Za-z0-9_\-]+$/u.test(message)) return message;
  const http = message.match(/^provider_http_(\d{3})/u);
  if (http) return `provider_http_${http[1]}`;
  return "unclassified_error";
}

function aggregateUsage(rows) {
  const fields = [
    "prompt_tokens",
    "completion_tokens",
    "total_tokens",
    "prompt_cache_hit_tokens",
    "prompt_cache_miss_tokens"
  ];
  const totals = Object.fromEntries(fields.map((field) => [field, 0]));
  let measuredCases = 0;
  for (const row of rows) {
    const usage = row.telemetry?.provider_usage;
    if (usage?.status !== "MEASURED_PROVIDER_RESPONSE") continue;
    measuredCases += 1;
    for (const field of fields) {
      if (typeof usage[field] === "number" && Number.isFinite(usage[field])) totals[field] += usage[field];
    }
  }
  return measuredCases
    ? { status: "MEASURED_PROVIDER_RESPONSE", measured_case_count: measuredCases, ...totals }
    : { status: "UNAVAILABLE", measured_case_count: 0 };
}

const dataset = await readJsonl(datasetPath);
const validation = validateDataset(dataset);
if (!validation.valid) throw new Error(`invalid_dataset:${JSON.stringify(validation.issues)}`);

const selectedDataset = split ? dataset.filter((record) => record.split === split) : dataset;
if (!selectedDataset.length) throw new Error(`empty_split:${split}`);
const selectedValidation = validateDataset(selectedDataset);
if (!selectedValidation.valid) throw new Error(`invalid_selected_dataset:${JSON.stringify(selectedValidation.issues)}`);

const adapterUrl = pathToFileURL(resolve(adapterPath)).href;
const adapter = await import(adapterUrl);
if (typeof adapter.predict !== "function" || !adapter.metadata) {
  throw new Error("adapter_must_export_metadata_and_predict");
}
const adapterRunMetadata = typeof adapter.describeRun === "function"
  ? adapter.describeRun()
  : adapter.metadata;
const isLiveProvider = adapterRunMetadata.evidence_status === "LIVE_PROVIDER_REQUIRED";

let corpusManifest = null;
if (manifestPath) {
  corpusManifest = JSON.parse(await readFile(manifestPath, "utf8"));
}
if (isLiveProvider) {
  if (split !== "pilot") throw new Error("live_zdb_baseline_requires_pilot_split");
  if (!corpusManifest) throw new Error("live_zdb_baseline_requires_frozen_manifest");
  if (corpusManifest.frozen !== true) throw new Error("live_zdb_baseline_requires_frozen_dataset");
  if (corpusManifest.dataset_hash !== validation.dataset_hash) throw new Error("live_zdb_baseline_dataset_hash_mismatch");
  if (corpusManifest.test_split_locked !== true) throw new Error("live_zdb_baseline_requires_locked_test_split");
  if (corpusManifest.live_baseline?.first_allowed_split !== "pilot") throw new Error("live_zdb_baseline_manifest_split_mismatch");
}

const runnerCommit = process.env.ZDB_RUNNER_COMMIT?.trim() || gitValue(["rev-parse", "HEAD"]);
const trackedWorktreeState = gitValue(["status", "--porcelain", "--untracked-files=no"]);
const trackedWorktreeClean = trackedWorktreeState === "";
if (isLiveProvider && !runnerCommit) throw new Error("live_zdb_baseline_requires_runner_commit");
if (isLiveProvider && !trackedWorktreeClean) throw new Error("live_zdb_baseline_requires_clean_tracked_worktree");

const startedAt = new Date().toISOString();
const internalRows = [];
for (const testCase of selectedDataset) {
  const started = performance.now();
  try {
    const result = await adapter.predict(testCase);
    internalRows.push({
      prediction: {
        schema_version: "zdb.prediction.v1",
        case_id: testCase.case_id,
        decision: result?.decision ?? null,
        confidence: typeof result?.confidence === "number" ? result.confidence : null,
        latency_ms: performance.now() - started,
        error: null
      },
      telemetry: result?.telemetry ?? null
    });
  } catch (error) {
    internalRows.push({
      prediction: {
        schema_version: "zdb.prediction.v1",
        case_id: testCase.case_id,
        decision: null,
        confidence: null,
        latency_ms: performance.now() - started,
        error: stableErrorCode(error)
      },
      telemetry: null
    });
  }
}
const rows = internalRows.map((row) => row.prediction);
const predictionText = rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, predictionText, "utf8");

const providerUsage = aggregateUsage(internalRows);
const responseModels = [...new Set(
  internalRows
    .map((row) => row.telemetry?.response_model)
    .filter((value) => typeof value === "string" && value)
)].sort();
const failureTaxonomy = {};
for (const row of rows) {
  if (!row.error) continue;
  failureTaxonomy[row.error] = (failureTaxonomy[row.error] ?? 0) + 1;
}
const succeeded = rows.length - Object.values(failureTaxonomy).reduce((sum, value) => sum + value, 0);
const finishedAt = new Date().toISOString();

const runManifest = {
  schema_version: "zdb.run.v2",
  evidence_status: isLiveProvider ? "LIVE_PROVIDER_RUN" : adapterRunMetadata.evidence_status,
  started_at: startedAt,
  finished_at: finishedAt,
  source_dataset_hash: validation.dataset_hash,
  dataset_hash: selectedValidation.dataset_hash,
  split: split ?? "all",
  source_case_count: dataset.length,
  case_count: rows.length,
  frozen_corpus: corpusManifest ? {
    manifest_path: manifestPath,
    frozen: corpusManifest.frozen,
    dataset_hash: corpusManifest.dataset_hash,
    test_split_locked: corpusManifest.test_split_locked,
    test_split_hash: corpusManifest.test_split_hash
  } : null,
  runner: {
    commit: runnerCommit ?? "UNAVAILABLE",
    tracked_worktree_clean: trackedWorktreeClean,
    node: process.version,
    platform: process.platform,
    arch: process.arch
  },
  adapter: adapterRunMetadata,
  retry_policy: {
    policy: "none",
    max_attempts_per_case: 1,
    retries_performed: 0
  },
  request_summary: {
    attempted: rows.length,
    succeeded,
    failed: rows.length - succeeded,
    failure_taxonomy: failureTaxonomy
  },
  provider_usage: providerUsage,
  provider_response_models: responseModels,
  monetary_cost: isLiveProvider
    ? {
        status: "UNAVAILABLE_NO_FROZEN_PRICE_SOURCE",
        amount: null,
        currency: null,
        method: "token usage is measured when returned by the provider; no mutable external price table is embedded in benchmark evidence"
      }
    : {
        status: "NOT_APPLICABLE_FIXTURE",
        amount: null,
        currency: null,
        method: "deterministic fixture"
      },
  random_seed: null,
  predictions: {
    path: outputPath,
    sha256: sha256Text(predictionText)
  },
  run_manifest_path: runManifestPath
};

await mkdir(dirname(runManifestPath), { recursive: true });
await writeFile(runManifestPath, JSON.stringify(runManifest, null, 2) + "\n", "utf8");
console.log(JSON.stringify(runManifest, null, 2));
