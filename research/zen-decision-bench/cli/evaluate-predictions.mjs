#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { evaluate, readJsonl, validateDataset } from "../src/core.mjs";

const datasetPath = process.argv[2];
const predictionPath = process.argv[3];
const optionArgs = process.argv.slice(4);
if (!datasetPath || !predictionPath) {
  console.error("usage: node research/zen-decision-bench/cli/evaluate-predictions.mjs <dataset.jsonl> <predictions.jsonl> [--split pilot|dev|test] [--out summary.json]");
  process.exit(2);
}
let split = null;
let outputPath = null;
for (let index = 0; index < optionArgs.length; index += 1) {
  const arg = optionArgs[index];
  if (arg.startsWith("--split=")) split = arg.slice("--split=".length);
  else if (arg === "--split") split = optionArgs[index += 1] ?? null;
  else if (arg.startsWith("--out=")) outputPath = arg.slice("--out=".length);
  else if (arg === "--out") outputPath = optionArgs[index += 1] ?? null;
  else throw new Error(`unknown_option:${arg}`);
}
if (split !== null && !["pilot", "dev", "test"].includes(split)) throw new Error(`invalid_split:${split}`);

const [dataset, predictions] = await Promise.all([readJsonl(datasetPath), readJsonl(predictionPath)]);
const sourceValidation = validateDataset(dataset);
if (!sourceValidation.valid) throw new Error(`invalid_dataset:${JSON.stringify(sourceValidation.issues)}`);
const selectedDataset = split ? dataset.filter((record) => record.split === split) : dataset;
if (!selectedDataset.length) throw new Error(`empty_split:${split}`);

const result = evaluate(selectedDataset, predictions);
result.source_dataset_hash = sourceValidation.dataset_hash;
result.selection = {
  split: split ?? "all",
  source_case_count: dataset.length,
  selected_case_count: selectedDataset.length
};

const summaryText = JSON.stringify(result, null, 2) + "\n";
if (outputPath) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, summaryText, "utf8");
}
console.log(summaryText.trimEnd());
