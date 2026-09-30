import { readFile } from "node:fs/promises";
import { sha256, stableJson, readJsonl } from "../../src/core.mjs";
import { PROFILE_HASH, PROFILE_IDS, loadProfiles, fileHash, isMain } from "./b2a-artifact-io.mjs";
import { buildAssignment, loadTargetIds, ASSIGNMENT_SEED, TARGET_HASH } from "./build-assignment.mjs";
import { buildHistory, GENERATOR_ID, HISTORY_START, HISTORY_STEP_MS } from "./build-history.mjs";
import { validateScope, scopeRefinesOrEquals } from "../src/validate-context.mjs";
const exact = (object, required, optional = []) => object && typeof object === "object" && !Array.isArray(object) &&
  required.every((key) => Object.hasOwn(object, key)) && Object.keys(object).every((key) => [...required, ...optional].includes(key));
const ensure = (condition, message) => { if (!condition) throw new Error(`invalid_b2a:${message}`); };
const countByProfile = (records) => Object.fromEntries(PROFILE_IDS.map((id) => [id, records.filter((r) => r.profile_id === id).length]));
export function validateAssignment(records, ids) {
  ensure(ASSIGNMENT_SEED === "27418e52bb5e483ef523d2cdc1045dfb17a1ec45238b8f0cf67d431f0163bfaf", "seed");
  ensure(records.length === 120 && new Set(records.map((r) => r.case_id)).size === 120, "assignment_count");
  const ranked = ids.map((case_id) => ({ case_id, rank_key: sha256(`${ASSIGNMENT_SEED}|${case_id}`) }))
    .sort((a, b) => a.rank_key < b.rank_key ? -1 : a.rank_key > b.rank_key ? 1 : 0);
  records.forEach((r, i) => {
    ensure(exact(r, ["schema_version", "case_id", "rank_key", "rank_index", "profile_id"]), "assignment_shape");
    ensure(r.schema_version === "zdb.preference_signal_assignment.v1" && r.rank_index === i &&
      r.case_id === ranked[i].case_id && r.rank_key === ranked[i].rank_key && r.profile_id === PROFILE_IDS[i % 12], "assignment_derivation");
  });
  ensure(Object.values(countByProfile(records)).every((n) => n === 10), "assignment_balance");
  ensure(stableJson(records) === stableJson(buildAssignment(ids)), "assignment_reproducibility");
  return { valid: true, count: 120, cases_per_profile: 10, seed: ASSIGNMENT_SEED, derivation: "PASS" };
}
export function validateHistory(records, profiles) {
  ensure(records.length === 288, "history_count");
  ensure(Object.values(countByProfile(records)).every((n) => n === 24), "history_balance");
  const byProfile = new Map(profiles.map((p) => [p.profile_id, p]));
  const seen = new Map();
  const offsets = new Map();
  for (const r of records) {
    ensure(exact(r, ["schema_version", "profile_id", "evidence"]) && r.schema_version === "zdb.preference_signal_history_episode.v1", "envelope");
    const p = byProfile.get(r.profile_id);
    ensure(p, "profile_identity");
    const e = r.evidence;
    ensure(exact(e, ["schema_version", "evidence_id", "kind", "task", "decision", "scope", "observed_at", "provenance"], ["correction_of", "tags"]), "evidence_shape");
    ensure(e.schema_version === "zdb.preference_evidence.v1" && ["passive_acceptance", "explicit_selection", "explicit_correction", "explicit_rejection"].includes(e.kind), "evidence_identity_kind");
    const offset = offsets.get(r.profile_id) ?? 0;
    ensure(e.evidence_id === `${r.profile_id}-history-${String(offset + 1).padStart(3, "0")}` && !seen.has(e.evidence_id), "evidence_id");
    offsets.set(r.profile_id, offset + 1);
    ensure(e.observed_at === new Date(Date.parse(HISTORY_START) + offset * HISTORY_STEP_MS).toISOString() &&
      Date.parse(e.observed_at) < Date.parse("2026-09-01T00:00:00.000Z"), "chronology");
    ensure(exact(e.provenance, ["category", "source"]) && e.provenance.category === "synthetic" && e.provenance.source === GENERATOR_ID, "provenance");
    ensure(validateScope(e.scope) && exact(e.scope, ["workspace", "task_family"], ["parent_family"]) &&
      e.scope.workspace === p.primary_workspace_id && e.scope.task_family === e.task, "scope");
    const tendencies = p.tendencies.filter((t) => t.task === e.task && (!e.scope.parent_family || t.scope_parent_family === e.scope.parent_family));
    ensure(tendencies.some((t) => [t.preferred_value, ...t.contrasted_values].includes(e.decision)), "profile_value");
    ensure(Array.isArray(e.tags) && e.tags.length === 3 && new Set(e.tags).size === 3 &&
      tendencies.some((t) => t.tendency_id === e.tags[1]) &&
      ["F1", "F2", "F3", "F4", "A1", "A2", "A3", "broad_folder", "broad_action"].includes(e.tags[0]) &&
      e.tags[2] === (e.scope.parent_family ? "specific" : "broad"), "tags");
    if (e.kind === "explicit_correction") {
      ensure(Array.isArray(e.correction_of) && e.correction_of.length === 1, "correction_shape");
      const prior = seen.get(e.correction_of[0]);
      ensure(prior && prior.profile_id === r.profile_id && prior.evidence.task === e.task &&
        Date.parse(prior.evidence.observed_at) < Date.parse(e.observed_at) &&
        scopeRefinesOrEquals(e.scope, prior.evidence.scope) && stableJson(e.scope) === stableJson(prior.evidence.scope), "correction_link");
    } else ensure(e.correction_of === undefined, "unexpected_correction_link");
    seen.set(e.evidence_id, r);
  }
  ensure(!/zdb03b-target-|"(?:case_id|rank_index|rank_key|gold|acceptable|abstain_allowed|adjudication|provider|preference_context)"/iu.test(JSON.stringify(records)), "forbidden_history_data");
  ensure(stableJson(records) === stableJson(buildHistory(profiles)), "exact_history_template");
  return { valid: true, count: 288, episodes_per_profile: 24, shape: "PASS", chronology: "PASS", correction_links: "PASS", profile_values: "PASS", scope_isolation: "PASS", template: "PASS" };
}
async function validateManifest(name, records, required) {
  const bytes = await readFile(new URL(`./${name}.v1.jsonl`, import.meta.url));
  const manifest = JSON.parse(await readFile(new URL(`./${name}.v1.manifest.json`, import.meta.url), "utf8"));
  ensure(manifest.canonical_sha256 === sha256(records) && manifest.file_sha256 === fileHash(bytes) &&
    manifest.count === records.length && manifest.research_only === true && manifest.artifact_file === `${name}.v1.jsonl`, `${name}_manifest_hash`);
  for (const [key, value] of Object.entries(required)) ensure(manifest[key] === value, `${name}_manifest_${key}`);
  return { canonical_sha256: manifest.canonical_sha256, file_sha256: manifest.file_sha256 };
}
export async function validateSavedAssignment() {
  const profiles = await loadProfiles();
  ensure(profiles.length === 12, "frozen_profiles");
  const records = await readJsonl(new URL("./assignment.v1.jsonl", import.meta.url));
  return { ...validateAssignment(records, await loadTargetIds()), ...await validateManifest("assignment", records, {
    schema_version: "zdb.preference_signal_assignment_manifest.v1", schema_identity: "zdb.preference_signal_assignment.v1",
    profile_pack_hash: PROFILE_HASH, target_pack_hash: TARGET_HASH, assignment_seed: ASSIGNMENT_SEED,
    algorithm_identity: "zdb-03b-assignment-v1", rank_index_origin: 0, cases_per_profile: 10,
    status: "FROZEN — DETERMINISTIC FROM OWNER-FROZEN B1 INPUTS" }) };
}
export async function validateSavedHistory() {
  const records = await readJsonl(new URL("./history.v1.jsonl", import.meta.url));
  return { ...validateHistory(records, await loadProfiles()), ...await validateManifest("history", records, {
    schema_version: "zdb.preference_signal_history_manifest.v1", schema_identity: "zdb.preference_signal_history_episode.v1",
    profile_pack_hash: PROFILE_HASH, generator_identity: GENERATOR_ID, episodes_per_profile: 24,
    structural_validation: "PASS", status: "FROZEN PRE-ADJUDICATION — OWNER CONTENT BLIND",
    owner_state: "HASH FROZEN — OWNER HAS NOT INSPECTED HISTORY CONTENT" }) };
}
if (isMain(import.meta.url)) {
  const mode = process.argv[2] ?? "all";
  ensure(["all", "assignment", "history"].includes(mode), "validator_mode");
  const result = {};
  if (mode !== "history") result.assignment = await validateSavedAssignment();
  if (mode !== "assignment") result.history = await validateSavedHistory();
  console.log(JSON.stringify(result, null, 2));
}
