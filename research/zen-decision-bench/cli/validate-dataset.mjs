#!/usr/bin/env node
import { readJsonl, validateDataset } from "../src/core.mjs";

const path = process.argv[2];
if (!path) {
  console.error("usage: node research/zen-decision-bench/cli/validate-dataset.mjs <dataset.jsonl>");
  process.exit(2);
}
const records = await readJsonl(path);
const result = validateDataset(records);
console.log(JSON.stringify(result, null, 2));
if (!result.valid) process.exit(1);
