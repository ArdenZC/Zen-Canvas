#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { evaluate, readJsonl, validateDataset } from "../src/core.mjs";

const datasetPath = process.argv[2];
const predictionPath = process.argv[3];
const optionArgs = process.argv.slice(4);
if (!datasetPath || !predictionPath) {
  console.error("usage: node research/zen-decision-bench/cli/evaluate-predictions.mjs <dataset.jsonl> <predictions.jsonl> [--split pilot|dev|test] [--run-manifest run.json] [--out summary.json]");
  process.exit(2);
}
let split = null;
let outputPath = null;
let runManifestPath = null;
for (let index = 0; index < optionArgs.length; index += 1) {
  const arg = optionArgs[index];
  if (arg.startsWith("--split=")) split = arg.slice("--split=".length);
  else if (arg === "--split") split = optionArgs[index += 1] ?? null;
  else if (arg.startsWith("--out=")) outputPath = arg.slice("--out=".length);
  else if (arg === "--out") outputPath = optionArgs[index += 1] ?? null;
  else if (arg.startsWith("--run-manifest=")) runManifestPath = arg.slice("--run-manifest=".length);
  else if (arg === "--run-manifest") runManifestPath = optionArgs[index += 1] ?? null;
  else throw new Error(`unknown_option:${arg}`);
}
if (split !== null && !["pilot", "dev", "test"].includes(split)) throw new Error(`invalid_split:${split}`);

const [dataset, predictions, predictionText] = await Promise.all([
  readJsonl(datasetPath),
  readJsonl(predictionPath),
  readFile(predictionPath, "utf8")
]);
const sourceValidation = validateDataset(dataset);
if (!sourceValidation.valid) throw new Error(`invalid_dataset:${JSON.stringify(sourceValidation.issues)}`);
const selectedDataset = split ? dataset.filter((record) => record.split === split) : dataset;
if (!selectedDataset.length) throw new Error(`empty_split:${split}`);
const selectedValidation = validateDataset(selectedDataset);
if (!selectedValidation.valid) throw new Error(`invalid_selected_dataset:${JSON.stringify(selectedValidation.issues)}`);

const predictionsSha256 = createHash("sha256").update(predictionText).digest("hex");
let runManifest = null;
if (runManifestPath) {
  runManifest = JSON.parse(await readFile(runManifestPath, "utf8"));
  if (runManifest.schema_version !== "zdb.run.v2") throw new Error("evaluation_run_manifest_schema_mismatch");
  if (runManifest.source_dataset_hash !== sourceValidation.dataset_hash) throw new Error("evaluation_run_source_dataset_hash_mismatch");
  if (runManifest.dataset_hash !== selectedValidation.dataset_hash) throw new Error("evaluation_run_selected_dataset_hash_mismatch");
  if (runManifest.split !== (split ?? "all")) throw new Error("evaluation_run_split_mismatch");
  if (runManifest.case_count !== predictions.length) throw new Error("evaluation_run_case_count_mismatch");
  if (runManifest.predictions?.sha256 !== predictionsSha256) throw new Error("evaluation_run_predictions_hash_mismatch");
}

const result = evaluate(selectedDataset, predictions);
result.source_dataset_hash = sourceValidation.dataset_hash;
result.selection = {
  split: split ?? "all",
  source_case_count: dataset.length,
  selected_case_count: selectedDataset.length
};
result.predictions = {
  path: predictionPath,
  sha256: predictionsSha256,
  case_count: predictions.length
};
result.run_evidence = runManifestPath ? {
  path: runManifestPath,
  schema_version: runManifest.schema_version,
  runner_commit: runManifest.runner?.commit ?? null,
  predictions_sha256: runManifest.predictions?.sha256 ?? null
} : null;

const summaryText = JSON.stringify(result, null, 2) + "\n";
if (outputPath) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, summaryText, "utf8");
}
console.log(summaryText.trimEnd());
