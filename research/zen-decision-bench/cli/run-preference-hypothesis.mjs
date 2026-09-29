#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { readJsonl, validateDataset, validatePrediction } from "../src/core.mjs";
import { validatePreferenceCase } from "../preference/src/validate-context.mjs";
import { projectPreferenceCase, runPreferenceArm } from "../preference/src/resolver.mjs";
import { evaluatePreference } from "../preference/src/evaluate.mjs";

const args = process.argv.slice(2);
if (!args.length) {
  console.error("usage: run-preference-hypothesis.mjs <candidate.jsonl> --arm B|C|D --out predictions.jsonl --summary summary.json [--baseline predictions.jsonl --baseline-run run.json]");
  process.exit(2);
}
const datasetPath = args.shift();
const options = {};
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (!arg.startsWith("--")) throw new Error(`unknown_argument:${arg}`);
  const [name, inline] = arg.slice(2).split("=", 2);
  if (!["arm", "out", "summary", "baseline", "baseline-run"].includes(name) || options[name] !== undefined) throw new Error(`unknown_or_duplicate_option:${arg}`);
  options[name] = inline ?? args[++index];
  if (!options[name]) throw new Error(`missing_option_value:${name}`);
}
if (!["B", "C", "D"].includes(options.arm) || !options.out || !options.summary) throw new Error("arm_out_summary_required");
if (options.arm === "B" && (options.baseline || options["baseline-run"])) throw new Error("arm_b_does_not_take_baseline");
if (options["baseline-run"] && !options.baseline) throw new Error("baseline_run_requires_baseline");
const cases = await readJsonl(datasetPath);
const validation = validateDataset(cases);
if (!validation.valid) throw new Error(`invalid_dataset:${JSON.stringify(validation.issues)}`);
for (const testCase of cases) {
  const errors = validatePreferenceCase(testCase);
  if (errors.length) throw new Error(`invalid_preference_case:${testCase.case_id}:${errors.join(",")}`);
}
let baselineMap = null;
let realBaseline = false;
if (options.baseline) {
  const baseline = await readJsonl(options.baseline);
  const expected = new Set(cases.map((record) => record.case_id));
  if (baseline.length !== cases.length || new Set(baseline.map((record) => record.case_id)).size !== cases.length || baseline.some((record) => !expected.has(record.case_id) || validatePrediction(record).length)) throw new Error("baseline_dataset_identity_or_schema_mismatch");
  baselineMap = new Map(baseline.map((record) => [record.case_id, record]));
  if (options["baseline-run"]) {
    const run = JSON.parse(await readFile(options["baseline-run"], "utf8"));
    const predictionHash = createHash("sha256").update(await readFile(options.baseline)).digest("hex");
    if (run.schema_version !== "zdb.run.v2" || run.dataset_hash !== validation.dataset_hash || run.predictions?.sha256 !== predictionHash || run.case_count !== cases.length) throw new Error("baseline_run_evidence_mismatch");
    realBaseline = true;
  }
}
const predictions = cases.map((testCase) => runPreferenceArm(projectPreferenceCase(testCase), options.arm, baselineMap?.get(testCase.case_id) ?? null));
const result = evaluatePreference(cases, predictions, { realBaseline });
result.dataset_hash = validation.dataset_hash;
result.arm = options.arm;
result.baseline_evidence = realBaseline ? "MATCHING_HASH_BOUND_EXTERNAL_RUN" : baselineMap ? "EXTERNAL_FILE_UNVERIFIED_NOT_EFFECTIVENESS_EVIDENCE" : "NONE";
await mkdir(dirname(options.out), { recursive: true });
await mkdir(dirname(options.summary), { recursive: true });
await writeFile(options.out, predictions.map((record) => JSON.stringify(record)).join("\n") + "\n", "utf8");
await writeFile(options.summary, JSON.stringify(result, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ arm: options.arm, cases: cases.length, baseline_evidence: result.baseline_evidence, gate_c_pass: result.gate_c_pass, explicit_truth_violations: result.explicit_truth_violations, safety_boundary_violations: result.safety_boundary_violations, attribution: result.attribution, summary: options.summary }, null, 2));
if (!result.gate_c_pass || result.attribution.complete !== result.attribution.checked) process.exitCode = 1;
