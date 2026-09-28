#!/usr/bin/env node
import { evaluate, readJsonl } from "../src/core.mjs";

const datasetPath = process.argv[2];
const predictionPath = process.argv[3];
if (!datasetPath || !predictionPath) {
  console.error("usage: node research/zen-decision-bench/cli/evaluate-predictions.mjs <dataset.jsonl> <predictions.jsonl>");
  process.exit(2);
}
const [dataset, predictions] = await Promise.all([readJsonl(datasetPath), readJsonl(predictionPath)]);
const result = evaluate(dataset, predictions);
console.log(JSON.stringify(result, null, 2));
