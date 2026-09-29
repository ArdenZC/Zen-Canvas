#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readJsonl, validateDataset } from "../src/core.mjs";

const [datasetPath, adapterPath, outputPath, ...optionArgs] = process.argv.slice(2);
if (!datasetPath || !adapterPath || !outputPath) {
  console.error("usage: node research/zen-decision-bench/cli/run-baseline.mjs <dataset.jsonl> <adapter.mjs> <out.jsonl> [--split pilot|dev|test]");
  process.exit(2);
}
let split = null;
for (let index = 0; index < optionArgs.length; index += 1) {
  const arg = optionArgs[index];
  if (arg.startsWith("--split=")) split = arg.slice("--split=".length);
  else if (arg === "--split") split = optionArgs[index += 1] ?? null;
  else throw new Error(`unknown_option:${arg}`);
}
if (split !== null && !["pilot", "dev", "test"].includes(split)) throw new Error(`invalid_split:${split}`);
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

const rows = [];
for (const testCase of selectedDataset) {
  const started = performance.now();
  try {
    const result = await adapter.predict(testCase);
    rows.push({
      schema_version: "zdb.prediction.v1",
      case_id: testCase.case_id,
      decision: result?.decision ?? null,
      confidence: typeof result?.confidence === "number" ? result.confidence : null,
      latency_ms: performance.now() - started,
      error: null
    });
  } catch (error) {
    rows.push({
      schema_version: "zdb.prediction.v1",
      case_id: testCase.case_id,
      decision: null,
      confidence: null,
      latency_ms: performance.now() - started,
      error: String(error instanceof Error ? error.message : error)
    });
  }
}
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, rows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
console.log(JSON.stringify({
  schema_version: "zdb.run.v1",
  source_dataset_hash: validation.dataset_hash,
  dataset_hash: selectedValidation.dataset_hash,
  split: split ?? "all",
  adapter: adapter.metadata,
  case_count: rows.length,
  output: outputPath
}, null, 2));
