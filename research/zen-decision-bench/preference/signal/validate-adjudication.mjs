#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { readJsonl, sha256 } from "../../src/core.mjs";

const profilePath = new URL("./profiles.v1.jsonl", import.meta.url);
const targetPath = new URL("./targets.v1.jsonl", import.meta.url);
const assignmentPath = new URL("./assignment.v1.jsonl", import.meta.url);
const adjudicationPath = new URL("./adjudication.v1.jsonl", import.meta.url);
const manifestPath = new URL("./adjudication.v1.manifest.json", import.meta.url);

const hashFile = (bytes) => createHash("sha256").update(bytes).digest("hex");
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

export async function validateBlindAdjudication() {
  const [profiles, targets, assignments, adjudication, manifest, adjudicationBytes] = await Promise.all([
    readJsonl(profilePath), readJsonl(targetPath), readJsonl(assignmentPath), readJsonl(adjudicationPath),
    readFile(manifestPath, "utf8").then(JSON.parse), readFile(adjudicationPath)
  ]);
  const issues = [];
  const pm = new Map(profiles.map((p) => [p.profile_id, p]));
  const tm = new Map(targets.map((t) => [t.case_id, t]));
  const am = new Map(assignments.map((a) => [a.case_id, a]));
  const seen = new Set();
  if (adjudication.length !== 120) issues.push("count");
  for (const row of adjudication) {
    if (seen.has(row.case_id)) issues.push(row.case_id + ":duplicate");
    seen.add(row.case_id);
    const target = tm.get(row.case_id);
    const assignment = am.get(row.case_id);
    const profile = pm.get(row.profile_id);
    if (!target || !assignment || !profile) { issues.push(row.case_id + ":source"); continue; }
    if (row.schema_version !== "zdb.preference_signal_adjudication.v1" || row.profile_id !== assignment.profile_id) issues.push(row.case_id + ":identity");
    const choices = new Set(target.choices.map(({ id }) => id));
    if (row.gold !== "abstain" && !choices.has(row.gold)) issues.push(row.case_id + ":gold");
    if (row.gold === "abstain" && row.abstain_allowed !== true) issues.push(row.case_id + ":abstain");
    if (!Array.isArray(row.acceptable) || new Set(row.acceptable).size !== row.acceptable.length || row.acceptable.some((id) => !choices.has(id) || id === row.gold)) issues.push(row.case_id + ":acceptable");
    if (row.adjudicated_by !== "owner" || row.adjudication_blindness !== "history_unseen") issues.push(row.case_id + ":blindness");
    const matching = profile.tendencies.filter((x) => x.task === target.task && x.scope_parent_family === target.scope_template.parent_family).map((x) => x.tendency_id).sort();
    if (JSON.stringify([...row.profile_tendency_ids_consulted].sort()) !== JSON.stringify(matching)) issues.push(row.case_id + ":tendency_refs");
    if (target.control_class === "explicit_truth_control") {
      if (row.gold !== target.explicit_user_truth?.decision || row.authority_basis !== "explicit_user_truth" || !row.authority_refs.includes(target.explicit_user_truth?.truth_id)) issues.push(row.case_id + ":truth");
    } else if (target.control_class === "safety_control") {
      if (row.gold !== target.deterministic_rule?.decision || row.authority_basis !== "safety_rule" || !row.authority_refs.includes(target.deterministic_rule?.rule_id)) issues.push(row.case_id + ":safety");
    }
    for (const forbidden of ["history", "preference_context", "provider_prediction", "resolver_recommendation"]) if (own(row, forbidden)) issues.push(row.case_id + ":forbidden:" + forbidden);
  }
  if (seen.size !== 120) issues.push("case_coverage");
  if (manifest.count !== 120 || manifest.canonical_sha256 !== sha256(adjudication) || manifest.file_sha256 !== hashFile(adjudicationBytes) ||
      manifest.profile_pack_canonical_sha256 !== "371519fe7c9f28d3c686e0299c223d64a57b00571777cab498668667498137b1" ||
      manifest.target_pack_canonical_sha256 !== "96f975ef10148a49f47068c578dd76ccd69ab3cf3f81167de2e227de32b735c4" ||
      manifest.assignment_canonical_sha256 !== "4833443e85bf2a69c74b175b8e618a98eebab6444f1da05418fbf926582d6a0b" ||
      manifest.history_content_inspected_at_freeze !== false) issues.push("manifest");
  return { valid: issues.length === 0, issues, count: adjudication.length, canonical_sha256: sha256(adjudication), file_sha256: hashFile(adjudicationBytes) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = await validateBlindAdjudication();
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exitCode = 1;
}
