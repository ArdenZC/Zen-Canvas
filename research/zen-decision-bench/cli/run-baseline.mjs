#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readJsonl, validateDataset } from "../src/core.mjs";

const [datasetPath, adapterPath, outputPath] = process.argv.slice(2);
if (!datasetPath || !adapterPath || !outputPath) {
  console.error("usage: node research/zen-decision-bench/cli/run-baseline.mjs <dataset.jsonl> <adapter.mjs> <out.jsonl>");
  process.exit(2);
}
const dataset = await readJsonl(datasetPath);
const validation = validateDataset(dataset);
if (!validation.valid) throw new Error(`invalid_dataset:${JSON.stringify(validation.issues)}`);

const adapterUrl = pathToFileURL(resolve(adapterPath)).href;
const adapter = await import(adapterUrl);
if (typeof adapter.predict !== "function" || !adapter.metadata) {
  throw new Error("adapter_must_export_metadata_and_predict");
}

const rows = [];
for (const testCase of dataset) {
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
  dataset_hash: validation.dataset_hash,
  adapter: adapter.metadata,
  case_count: rows.length,
  output: outputPath
}, null, 2));
