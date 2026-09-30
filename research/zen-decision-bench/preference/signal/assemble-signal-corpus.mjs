import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { sha256 } from "../../src/core.mjs";
import { scopeMatches } from "../src/validate-context.mjs";
import { validateCorpus } from "./validate-signal-corpus.mjs";
export const ASSEMBLY_ID = "zdb-03b2c-mechanical-assembly-v1";
export const CHOICE_ORDER_ID = "zdb-03b-choice-order-v1";
export const FROZEN_INPUTS = Object.freeze({
  profiles: ["371519fe7c9f28d3c686e0299c223d64a57b00571777cab498668667498137b1", "211a879964dfa6bccbadd78e4ad739f4d8324a71dbd974f9fc7a81d0f27ed5fe"],
  targets: ["96f975ef10148a49f47068c578dd76ccd69ab3cf3f81167de2e227de32b735c4", "b414f7510345c95e0629f34780dce1125b0f71c12a84cdf5c555d01d1c5217aa"],
  assignment: ["4833443e85bf2a69c74b175b8e618a98eebab6444f1da05418fbf926582d6a0b", "f05291e3bf421538b66ed2caf8ae599f2fcea4ff3e263f9d9088764091d684ef"],
  history: ["c2be8a2949c0daef12fe821010b72ca84ef999deb941a6f8bd0505dc8a7e2f44", "a463442fcc837bbbfa542a9423b1370cef655c12ffa14e2e3cd3a67d57c6b6af"],
  adjudication: ["498a511c4cfba87daaed7db5197c35aed96de34862feede43c500d9eb5d3ad50", "7f87770e30dae42a735b26b620209fabcd59eac1e449aad528de68523d56abbf"]
});
export const fileHash = bytes => createHash("sha256").update(bytes).digest("hex");
export async function loadFrozenInputs() {
  const inputs = {};
  for (const [name, [canonical, raw]] of Object.entries(FROZEN_INPUTS)) {
    const bytes = await readFile(new URL(`./${name}.v1.jsonl`, import.meta.url));
    const rows = bytes.toString("utf8").trim().split(/\r?\n/u).map(JSON.parse);
    if (sha256(rows) !== canonical || fileHash(bytes) !== raw) throw new Error(`STOP:frozen_input_hash:${name}`);
    inputs[name] = rows;
  }
  return inputs;
}
export function materializeScope(target, profile) {
  const mode = target.scope_template.workspace_mode;
  if (!["assigned_profile_primary", "assigned_profile_novel"].includes(mode)) throw new Error("STOP:workspace_mode");
  return { workspace: mode === "assigned_profile_novel" ? `zdb03b-novel-${target.case_id}` : profile.primary_workspace_id,
    task_family: target.task, parent_family: target.scope_template.parent_family };
}
const lex = (a, b) => a < b ? -1 : a > b ? 1 : 0;
export function orderChoices(target) {
  const choices = structuredClone(target.choices);
  if (target.task === "existing_folder_choice") choices.sort((a, b) => lex(
    sha256(`${CHOICE_ORDER_ID}|${FROZEN_INPUTS.targets[0]}|${target.case_id}|${a.id}`),
    sha256(`${CHOICE_ORDER_ID}|${FROZEN_INPUTS.targets[0]}|${target.case_id}|${b.id}`)));
  return choices;
}
export function selectHistory(target, profileId, scope, history) {
  const ids = new Set(target.choices.map(c => c.id));
  const evidence = history.filter(h => h.profile_id === profileId).map(h => h.evidence)
    .filter(e => e.task === target.task && Date.parse(e.observed_at) < Date.parse(target.target_at) && scopeMatches(e.scope, scope) && ids.has(e.decision))
    .sort((a, b) => lex(a.observed_at, b.observed_at) || lex(a.evidence_id, b.evidence_id));
  const included = new Set(evidence.map(e => e.evidence_id));
  for (const e of evidence) if (e.kind === "explicit_correction" && e.correction_of.some(id => !included.has(id))) throw new Error(`STOP:missing_correction_reference:${target.case_id}`);
  return structuredClone(evidence);
}
function uniqueMap(rows, key) {
  const map = new Map(rows.map(r => [r[key], r]));
  if (map.size !== rows.length) throw new Error(`STOP:duplicate_join_key:${key}`);
  return map;
}
export function assembleCorpus(inputs) {
  const profiles = uniqueMap(inputs.profiles, "profile_id");
  const assignments = uniqueMap(inputs.assignment, "case_id");
  const answers = uniqueMap(inputs.adjudication, "case_id");
  uniqueMap(inputs.targets, "case_id");
  return [...inputs.targets].sort((a, b) => Number(a.case_id.slice(-3)) - Number(b.case_id.slice(-3))).map(target => {
    const assigned = assignments.get(target.case_id);
    const profile = profiles.get(assigned?.profile_id);
    const answer = answers.get(target.case_id);
    if (!profile || !answer || answer.profile_id !== assigned.profile_id) throw new Error(`STOP:join_identity:${target.case_id}`);
    const scope = materializeScope(target, profile);
    const evidence = selectHistory(target, assigned.profile_id, scope, inputs.history);
    const truth = target.explicit_user_truth;
    const rule = target.deterministic_rule;
    return { schema_version: "zdb.case.v1", case_id: target.case_id, task: target.task, input: structuredClone(target.input),
      context: { preference_target_scope: scope }, choices: orderChoices(target),
      gold: answer.gold, acceptable: structuredClone(answer.acceptable), abstain_allowed: answer.abstain_allowed,
      ambiguity: target.ambiguity.level, provenance: { category: "synthetic", source: ASSEMBLY_ID }, split: "pilot",
      tags: ["zdb-03b", "signal-screen", target.control_class, target.scope_template.parent_family],
      preference_context: { schema_version: "zdb.preference_context.v1", context_id: `zdb03b-context-${target.case_id.slice(-3)}`,
        target_task: target.task, target_at: target.target_at, cold_start: evidence.length === 0, preference_evidence: evidence,
        explicit_user_truth: truth ? [{ truth_id: truth.truth_id, task: truth.task, decision: truth.decision, scope: structuredClone(scope), asserted_at: truth.asserted_at }] : [],
        deterministic_rules: rule ? [{ rule_id: rule.rule_id, authority: rule.authority, task: rule.task, decision: rule.decision, scope: structuredClone(scope), asserted_at: rule.asserted_at }] : [],
        provenance: { category: "synthetic", source: ASSEMBLY_ID } } };
  });
}
export async function writeCorpus() {
  const inputs = await loadFrozenInputs();
  const cases = assembleCorpus(inputs);
  const summary = validateCorpus(cases, inputs);
  const data = cases.map(JSON.stringify).join("\n") + "\n";
  const manifest = { schema_version: "zdb.preference_signal_corpus_manifest.v1", schema_identity: "zdb.case.v1",
    assembly_identity: ASSEMBLY_ID, choice_order_identity: CHOICE_ORDER_ID, count: cases.length,
    input_canonical_sha256: Object.fromEntries(Object.entries(FROZEN_INPUTS).map(([name, hashes]) => [name, hashes[0]])),
    input_file_sha256: Object.fromEntries(Object.entries(FROZEN_INPUTS).map(([name, hashes]) => [name, hashes[1]])),
    canonical_sha256: sha256(cases), file_sha256: fileHash(data), ...summary,
    research_only: true, status: "CANDIDATE — OWNER CORPUS FREEZE REQUIRED BEFORE B3" };
  for (const suffix of ["jsonl", "manifest.json"]) {
    try { await readFile(new URL(`./signal-corpus.v1.${suffix}`, import.meta.url)); }
    catch (e) { if (e.code === "ENOENT") continue; throw e; }
    throw new Error("STOP:corpus_artifact_already_exists");
  }
  await writeFile(new URL("./signal-corpus.v1.jsonl", import.meta.url), data);
  await writeFile(new URL("./signal-corpus.v1.manifest.json", import.meta.url), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await writeCorpus(), null, 2));
