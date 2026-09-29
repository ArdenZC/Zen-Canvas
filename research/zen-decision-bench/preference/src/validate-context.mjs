import { validateCase } from "../../src/core.mjs";

export const PREFERENCE_TASKS = Object.freeze(["purpose", "lifecycle", "suggested_action", "existing_folder_choice"]);
export const SCOPE_DIMENSIONS = Object.freeze(["global_user", "workspace", "managed_folder", "parent_family", "task_family", "domain_type", "purpose", "lifecycle"]);
const KINDS = new Set(["passive_acceptance", "explicit_selection", "explicit_correction", "explicit_rejection"]);
const PROVENANCE = new Set(["synthetic", "repo_fixture", "manual_nonsensitive"]);
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const nonempty = (value) => typeof value === "string" && value.length > 0;
const only = (value, keys) => Object.keys(value).every((key) => keys.includes(key));
const validTime = (value) => typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;

export function validateScope(scope) {
  if (!object(scope) || !Object.keys(scope).length || !only(scope, SCOPE_DIMENSIONS)) return false;
  return Object.entries(scope).every(([key, value]) => key === "global_user" ? value === true :
    key === "task_family" ? PREFERENCE_TASKS.includes(value) : nonempty(value));
}

function validateProvenance(provenance) {
  return object(provenance) && only(provenance, ["category", "source"]) && PROVENANCE.has(provenance.category) && nonempty(provenance.source);
}

function validRecord(record, keys, required) {
  return object(record) && only(record, keys) && required.every((key) => own(record, key));
}

export function validatePreferenceCase(testCase) {
  const errors = [...validateCase(testCase)];
  if (!object(testCase)) return errors;
  if (!PREFERENCE_TASKS.includes(testCase.task)) errors.push("preference_target_task");
  const choiceIds = new Set((testCase.choices ?? []).map((choice) => choice.id));
  const targetScope = testCase.context?.preference_target_scope;
  const ctx = testCase.preference_context;
  if (!object(ctx)) return [...new Set([...errors, "preference_context_required"])];
  if (!validRecord(ctx, ["schema_version", "context_id", "target_task", "target_at", "cold_start", "preference_evidence", "explicit_user_truth", "deterministic_rules", "provenance"],
    ["schema_version", "context_id", "target_task", "target_at", "cold_start", "preference_evidence", "explicit_user_truth", "deterministic_rules", "provenance"])) errors.push("preference_context_shape");
  if (ctx.schema_version !== "zdb.preference_context.v1" || !nonempty(ctx.context_id) || ctx.target_task !== testCase.task || !validTime(ctx.target_at) || typeof ctx.cold_start !== "boolean" || !validateProvenance(ctx.provenance)) errors.push("preference_context_fields");
  if (!Array.isArray(ctx.preference_evidence) || !Array.isArray(ctx.explicit_user_truth) || !Array.isArray(ctx.deterministic_rules)) return [...new Set([...errors, "preference_context_arrays"])];
  if (ctx.cold_start !== (ctx.preference_evidence.length === 0)) errors.push("cold_start_evidence_count");
  if (!ctx.cold_start && !validateScope(targetScope)) errors.push("preference_target_scope_required");
  if (targetScope !== undefined && !validateScope(targetScope)) errors.push("preference_target_scope");
  const targetTime = Date.parse(ctx.target_at);
  const ids = new Set();
  for (const e of ctx.preference_evidence) {
    if (!validRecord(e, ["schema_version", "evidence_id", "kind", "task", "decision", "scope", "observed_at", "correction_of", "provenance", "tags"],
      ["schema_version", "evidence_id", "kind", "task", "decision", "scope", "observed_at", "provenance"]) ||
      e.schema_version !== "zdb.preference_evidence.v1" || !nonempty(e.evidence_id) || !KINDS.has(e.kind) ||
      e.task !== testCase.task || !choiceIds.has(e.decision) || !validateScope(e.scope) || !validTime(e.observed_at) || !validateProvenance(e.provenance) ||
      (e.tags !== undefined && (!Array.isArray(e.tags) || new Set(e.tags).size !== e.tags.length || e.tags.some((tag) => !nonempty(tag))))) errors.push("preference_evidence_shape");
    if (ids.has(e.evidence_id)) errors.push("duplicate_evidence_id");
    ids.add(e.evidence_id);
    if (validTime(e.observed_at) && !(Date.parse(e.observed_at) < targetTime)) errors.push("future_preference_evidence");
    if (e.kind === "explicit_correction") {
      if (!Array.isArray(e.correction_of) || !e.correction_of.length || new Set(e.correction_of).size !== e.correction_of.length || e.correction_of.some((id) => !nonempty(id))) errors.push("correction_of_required");
    } else if (e.correction_of !== undefined && (!Array.isArray(e.correction_of) || new Set(e.correction_of).size !== e.correction_of.length)) errors.push("correction_of_shape");
  }
  const byId = new Map(ctx.preference_evidence.map((e) => [e.evidence_id, e]));
  for (const e of ctx.preference_evidence.filter((entry) => entry.kind === "explicit_correction")) {
    for (const id of e.correction_of ?? []) {
      const referenced = byId.get(id);
      if (!referenced) errors.push("correction_of_missing_id");
      else if (referenced.task !== e.task) errors.push("correction_of_task_mismatch");
      else if (!(Date.parse(referenced.observed_at) < Date.parse(e.observed_at))) errors.push("correction_of_not_earlier");
    }
    if (validateScope(targetScope) && !scopeMatches(e.scope, targetScope)) errors.push("correction_scope_mismatch");
  }
  for (const truth of ctx.explicit_user_truth) {
    if (!validRecord(truth, ["truth_id", "task", "decision", "scope", "asserted_at"], ["truth_id", "task", "decision", "scope", "asserted_at"]) ||
      !nonempty(truth.truth_id) || truth.task !== testCase.task || !choiceIds.has(truth.decision) || !validateScope(truth.scope) || !validTime(truth.asserted_at)) errors.push("explicit_truth_shape");
    if (validTime(truth.asserted_at) && !(Date.parse(truth.asserted_at) <= targetTime)) errors.push("future_explicit_truth");
  }
  for (const rule of ctx.deterministic_rules) {
    if (!validRecord(rule, ["rule_id", "authority", "task", "decision", "scope", "asserted_at"], ["rule_id", "authority", "task", "decision", "scope", "asserted_at"]) ||
      !nonempty(rule.rule_id) || !["user_rule", "safety_rule"].includes(rule.authority) || rule.task !== testCase.task || !choiceIds.has(rule.decision) || !validateScope(rule.scope) || !validTime(rule.asserted_at)) errors.push("deterministic_rule_shape");
    if (validTime(rule.asserted_at) && !(Date.parse(rule.asserted_at) <= targetTime)) errors.push("future_deterministic_rule");
  }
  return [...new Set(errors)];
}

export function scopeMatches(scope, targetScope) {
  return Object.entries(scope).every(([key, value]) => key === "global_user" ? value === true : targetScope?.[key] === value);
}

// Refinement is constraint inclusion, not equal or greater dimension count.
// global_user is the broad root, so any valid scoped record can refine it.
export function scopeRefinesOrEquals(correctionScope, priorScope) {
  return Object.entries(priorScope).every(([key, value]) => key === "global_user" || correctionScope[key] === value);
}

export function specificity(scope) {
  return Object.keys(scope).filter((key) => key !== "global_user").length;
}
