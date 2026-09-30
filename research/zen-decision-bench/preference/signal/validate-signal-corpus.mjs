import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { sha256, stableJson } from "../../src/core.mjs";
import { validatePreferenceCase, scopeMatches, scopeRefinesOrEquals } from "../src/validate-context.mjs";
import { loadFrozenInputs, assembleCorpus, fileHash, FROZEN_INPUTS, ASSEMBLY_ID, CHOICE_ORDER_ID } from "./assemble-signal-corpus.mjs";
const requirePass = (condition, code) => { if (!condition) throw new Error(`STOP:signal_corpus:${code}`); };
const same = (a, b) => stableJson(a) === stableJson(b);
export function validateCorpus(cases, inputs) {
  requirePass(cases.length === 120 && new Set(cases.map(c => c.case_id)).size === 120, "case_inventory");
  const targets = new Map(inputs.targets.map(t => [t.case_id, t]));
  const profiles = new Map(inputs.profiles.map(p => [p.profile_id, p]));
  const assignments = new Map(inputs.assignment.map(a => [a.case_id, a.profile_id]));
  const taskCounts = { existing_folder_choice: 0, suggested_action: 0, purpose: 0, lifecycle: 0 };
  const coldTaskCounts = { ...taskCounts };
  const taxonomy = { designated_novel_workspace: 0, non_intervention_no_history_task: 0, incidental_finite_choice_filtered: 0, unexplained_scope_or_other: 0 };
  const controlCounts = {};
  const counts = [];
  let cold = 0, truths = 0, safety = 0, specific = 0, broadOnly = 0;
  cases.forEach((c, i) => {
    requirePass(c.case_id === `zdb03b-target-${String(i + 1).padStart(3, "0")}`, "contiguous_order");
    requirePass(validatePreferenceCase(c).length === 0, `preference_contract:${c.case_id}`);
    const t = targets.get(c.case_id), pid = assignments.get(c.case_id), p = profiles.get(pid);
    requirePass(t && p, "join");
    requirePass(same(c.input, t.input) && c.task === t.task, "metadata_preservation");
    const expectedScope = { workspace: t.scope_template.workspace_mode === "assigned_profile_novel" ? `zdb03b-novel-${t.case_id}` : p.primary_workspace_id,
      task_family: t.task, parent_family: t.scope_template.parent_family };
    requirePass(same(c.context, { preference_target_scope: expectedScope }), "materialized_scope");
    const ctx = c.preference_context;
    requirePass(ctx.context_id === `zdb03b-context-${c.case_id.slice(-3)}` && ctx.target_at === t.target_at, "context_identity");
    const beforeChoices = inputs.history.filter(h => h.profile_id === pid && h.evidence.task === t.task &&
      Date.parse(h.evidence.observed_at) < Date.parse(t.target_at) && scopeMatches(h.evidence.scope, expectedScope)).map(h => h.evidence);
    const choices = new Set(t.choices.map(x => x.id));
    const expectedEvidence = beforeChoices.filter(e => choices.has(e.decision)).sort((a, b) =>
      a.observed_at < b.observed_at ? -1 : a.observed_at > b.observed_at ? 1 : a.evidence_id < b.evidence_id ? -1 : a.evidence_id > b.evidence_id ? 1 : 0);
    requirePass(same(ctx.preference_evidence, expectedEvidence), "exact_mechanical_evidence");
    const byId = new Map(ctx.preference_evidence.map(e => [e.evidence_id, e]));
    for (const e of ctx.preference_evidence) if (e.kind === "explicit_correction") for (const ref of e.correction_of) {
      const prior = byId.get(ref);
      requirePass(prior && prior.task === e.task && Date.parse(prior.observed_at) < Date.parse(e.observed_at) && scopeRefinesOrEquals(e.scope, prior.scope), "correction_integrity");
    }
    taskCounts[c.task]++;
    controlCounts[t.control_class] = (controlCounts[t.control_class] ?? 0) + 1;
    counts.push(ctx.preference_evidence.length);
    truths += ctx.explicit_user_truth.length;
    safety += ctx.deterministic_rules.length;
    requirePass(ctx.deterministic_rules.every(r => r.authority === "safety_rule"), "no_user_rule");
    if (ctx.cold_start) {
      cold++; coldTaskCounts[c.task]++;
      if (t.scope_template.workspace_mode === "assigned_profile_novel" && beforeChoices.length === 0) taxonomy.designated_novel_workspace++;
      else if (["purpose", "lifecycle"].includes(t.task) && beforeChoices.length === 0) taxonomy.non_intervention_no_history_task++;
      else if (t.scope_template.workspace_mode === "assigned_profile_primary" && t.task === "existing_folder_choice" && beforeChoices.length > 0 && expectedEvidence.length === 0) taxonomy.incidental_finite_choice_filtered++;
      else taxonomy.unexplained_scope_or_other++;
    } else if (ctx.preference_evidence.some(e => e.scope.parent_family !== undefined)) specific++;
    else broadOnly++;
  });
  requirePass(same(taskCounts, { existing_folder_choice: 72, suggested_action: 36, purpose: 6, lifecycle: 6 }), "task_counts");
  requirePass(cold === 55 && 120 - cold === 65, "coverage_55_65");
  requirePass(same(taxonomy, { designated_novel_workspace: 12, non_intervention_no_history_task: 12, incidental_finite_choice_filtered: 31, unexplained_scope_or_other: 0 }), "cold_start_taxonomy");
  requirePass(same(coldTaskCounts, { existing_folder_choice: 39, suggested_action: 4, purpose: 6, lifecycle: 6 }), "cold_task_counts");
  requirePass(truths === 6 && safety === 6, "current_authority_counts");
  // Exact reassembly rejects any added Profile, adjudication, envelope, output or extra case metadata.
  requirePass(same(cases, assembleCorpus(inputs)), "exact_projection_and_choice_order");
  counts.sort((a, b) => a - b);
  return { valid: true, task_counts: taskCounts, control_counts: controlCounts, cold_start_count: cold, non_cold_count: 120 - cold,
    cold_start_taxonomy: taxonomy, cold_start_task_counts: coldTaskCounts, explicit_truth_count: truths, safety_rule_count: safety,
    missing_correction_references: 0, evidence_statistics: { total: counts.reduce((a, b) => a + b, 0), min: counts[0],
      median: (counts[59] + counts[60]) / 2, max: counts.at(-1), specific_scoped_contexts: specific, broad_only_contexts: broadOnly },
    structural_validation: "PASS" };
}
export async function validateSavedCorpus() {
  const inputs = await loadFrozenInputs();
  const bytes = await readFile(new URL("./signal-corpus.v1.jsonl", import.meta.url));
  const cases = bytes.toString("utf8").trim().split(/\r?\n/u).map(JSON.parse);
  const manifest = JSON.parse(await readFile(new URL("./signal-corpus.v1.manifest.json", import.meta.url), "utf8"));
  const summary = validateCorpus(cases, inputs);
  requirePass(manifest.canonical_sha256 === sha256(cases) && manifest.file_sha256 === fileHash(bytes), "manifest_hash");
  for (const [key, value] of Object.entries(summary)) requirePass(same(manifest[key], value), `manifest:${key}`);
  requirePass(manifest.count === 120 && manifest.schema_identity === "zdb.case.v1" && manifest.assembly_identity === ASSEMBLY_ID &&
    manifest.choice_order_identity === CHOICE_ORDER_ID && manifest.research_only === true && manifest.status === "FROZEN — OWNER REVIEW PASSED / AUTHORIZED FOR ZDB-03B3 INPUT" &&
    manifest.owner_freeze?.accepted_content_head === "f1aa255d17f7b6f4749631096332549a5b7fd58b" && manifest.owner_freeze?.corpus_git_blob === "0e483df2063acbc07ee599e3caa379f4a6f404bf", "manifest_state");
  requirePass(same(manifest.input_canonical_sha256, Object.fromEntries(Object.entries(FROZEN_INPUTS).map(([name, hashes]) => [name, hashes[0]]))) &&
    same(manifest.input_file_sha256, Object.fromEntries(Object.entries(FROZEN_INPUTS).map(([name, hashes]) => [name, hashes[1]]))), "manifest_inputs");
  return { ...summary, canonical_sha256: manifest.canonical_sha256, file_sha256: manifest.file_sha256 };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await validateSavedCorpus(), null, 2));
