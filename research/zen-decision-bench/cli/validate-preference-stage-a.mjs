#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readJsonl, sha256, validateDataset } from "../src/core.mjs";
import { validatePreferenceCase } from "../preference/src/validate-context.mjs";

const path = process.argv[2];
if (!path) throw new Error("usage: validate-preference-stage-a.mjs <candidate-corpus.jsonl> [manifest.json]");
const cases = await readJsonl(path);
const general = validateDataset(cases);
const issues = [...general.issues];
for (const [index, testCase] of cases.entries()) {
  const errors = validatePreferenceCase(testCase);
  if (errors.length) issues.push({ index, case_id: testCase.case_id, errors });
  if (!/^prefa-/u.test(testCase.case_id)) issues.push({ index, case_id: testCase.case_id, errors: ["case_id_namespace"] });
  if (!testCase.tags.includes("synthetic")) issues.push({ index, case_id: testCase.case_id, errors: ["synthetic_tag"] });
}
const families = ["cold_start", "consistent_preference", "single_correction", "repeated_correction", "scope_conflict", "recency_conflict", "equal_conflict", "sparse_evidence", "safety_conflict", "explicit_truth_conflict"];
const counts = Object.fromEntries(families.map((family) => [family, cases.filter((testCase) => testCase.tags.includes(family)).length]));
for (const family of families) {
  const group = cases.filter((testCase) => testCase.tags.includes(family));
  if (group.length !== 6 || group.filter((record) => record.split === "pilot").length !== 4 || group.filter((record) => record.split === "dev").length !== 2) issues.push({ family, errors: ["scenario_distribution"] });
}
if (cases.length !== 60 || general.task_counts.existing_folder_choice !== 36 || general.task_counts.suggested_action !== 18 || general.task_counts.purpose !== 3 || general.task_counts.lifecycle !== 3 || general.task_counts.domain_type !== 0 || general.task_counts.risk_level !== 0 || general.split_counts.pilot !== 40 || general.split_counts.dev !== 20 || general.split_counts.test !== 0) issues.push({ errors: ["stage_a_distribution"] });
const fileSha = createHash("sha256").update(await readFile(path)).digest("hex");
if (process.argv[3]) {
  const manifest = JSON.parse(await readFile(process.argv[3], "utf8"));
  if (manifest.dataset_hash !== sha256(cases) || manifest.file_sha256 !== fileSha || manifest.case_count !== cases.length || JSON.stringify(manifest.scenario_family_counts) !== JSON.stringify(counts)) issues.push({ errors: ["manifest_mismatch"] });
}
const result = { valid: issues.length === 0, count: cases.length, dataset_hash: general.dataset_hash, file_sha256: fileSha, task_counts: general.task_counts, split_counts: general.split_counts, scenario_family_counts: counts, issues };
console.log(JSON.stringify(result, null, 2));
if (!result.valid) process.exitCode = 1;
