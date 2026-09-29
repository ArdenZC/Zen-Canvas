import { scopeMatches, scopeRefinesOrEquals, specificity, validatePreferenceCase } from "./validate-context.mjs";

const sortedIds = (records, key = "evidence_id") => records.map((record) => record[key]).sort();
const unique = (values) => [...new Set(values)].sort();
const comparable = (left, right) => JSON.stringify(Object.entries(left).sort()) === JSON.stringify(Object.entries(right).sort());
const applicable = (record, input, timestamp) => record.task === input.task &&
  (timestamp === "observed_at" ? Date.parse(record[timestamp]) < Date.parse(input.preference_context.target_at) : Date.parse(record[timestamp]) <= Date.parse(input.preference_context.target_at)) &&
  scopeMatches(record.scope, input.target_scope);

// This is the only case -> resolver projection. No gold, acceptable, split,
// score class, ambiguity, input text, or expected answer crosses this boundary.
export function projectPreferenceCase(testCase) {
  const errors = validatePreferenceCase(testCase);
  if (errors.length) throw new Error(`invalid_preference_case:${testCase?.case_id}:${errors.join(",")}`);
  return structuredClone({
    case_id: testCase.case_id,
    task: testCase.task,
    choices: testCase.choices.map(({ id }) => id),
    target_scope: testCase.context.preference_target_scope,
    preference_context: testCase.preference_context
  });
}

function topSpecificity(records) {
  if (!records.length) return { records: [], specificity: null };
  const max = Math.max(...records.map((record) => specificity(record.scope)));
  return { records: records.filter((record) => specificity(record.scope) === max), specificity: max };
}

function authority(records, input, timestamp, kind) {
  const relevant = topSpecificity(records.filter((record) => applicable(record, input, timestamp)));
  if (!relevant.records.length) return { decision: null, error: null };
  let active = relevant.records;
  if (kind === "truth") {
    const scopeGroups = new Map();
    for (const record of active) {
      const key = JSON.stringify(Object.entries(record.scope).sort());
      const previous = scopeGroups.get(key);
      if (!previous || Date.parse(record.asserted_at) > Date.parse(previous.asserted_at)) scopeGroups.set(key, record);
      else if (record.asserted_at === previous.asserted_at && record.decision !== previous.decision) return { decision: null, error: "contradictory_explicit_truth" };
    }
    active = [...scopeGroups.values()];
    if (active.length > 1 && !active.every((record) => comparable(record.scope, active[0].scope))) {
      // Equally specific but non-identical overlapping scopes cannot silently
      // supersede one another by chronology alone.
      const decisions = unique(active.map((record) => record.decision));
      if (decisions.length > 1) return { decision: null, error: "incomparable_explicit_truth" };
    }
  }
  const decisions = unique(active.map((record) => record.decision));
  if (decisions.length !== 1) return { decision: null, error: `contradictory_${kind}` };
  return { decision: decisions[0], error: null };
}

export function aggregatePreference(input) {
  if ("gold" in input || "acceptable" in input || "split" in input || "input" in input || "ambiguity" in input) throw new Error("benchmark_answer_metadata_at_resolver_boundary");
  const evidence = input.preference_context.preference_evidence;
  const relevant = evidence.filter((record) => applicable(record, input, "observed_at"));
  const empty = {
    recommendation: null, support_level: "none", support_basis: "none", evidence_ids_considered: sortedIds(relevant),
    evidence_ids_used: [], evidence_ids_superseded: [], matched_specificity: null,
    matched_scope_dimensions: [], latest_correction_at: null, conflict_state: "none",
    abstention_reason: evidence.length ? "scope_mismatch" : "no_preference_evidence"
  };
  if (!relevant.length) return empty;
  const byId = new Map(evidence.map((record) => [record.evidence_id, record]));
  const superseded = new Set();
  for (const correction of relevant.filter((record) => record.kind === "explicit_correction")) {
    for (const id of correction.correction_of) {
      const prior = byId.get(id);
      if (prior && relevant.includes(prior) && scopeRefinesOrEquals(correction.scope, prior.scope)) superseded.add(id);
    }
  }
  const active = relevant.filter((record) => !superseded.has(record.evidence_id));
  const top = topSpecificity(active);
  const atTop = top.records;
  const dims = unique(atTop.flatMap((record) => Object.keys(record.scope).filter((key) => key !== "global_user")));
  const positive = atTop.filter((record) => record.kind !== "explicit_rejection");
  const negative = atTop.filter((record) => record.kind === "explicit_rejection");
  const candidates = unique(positive.map((record) => record.decision));
  const sufficient = candidates.filter((decision) => {
    const supporting = positive.filter((record) => record.decision === decision);
    return supporting.some((record) => record.kind === "explicit_correction") ||
      supporting.filter((record) => record.kind === "explicit_selection").length >= 2 ||
      supporting.filter((record) => record.kind === "passive_acceptance").length >= 3;
  });
  const correctionTimes = atTop.filter((record) => record.kind === "explicit_correction").map((record) => record.observed_at).sort();
  const contradiction = sufficient.length > 1 ||
    (sufficient.length === 1 && (candidates.some((candidate) => candidate !== sufficient[0]) || negative.some((record) => record.decision === sufficient[0])));
  const recommendation = sufficient.length === 1 && !contradiction ? sufficient[0] : null;
  const conflictState = contradiction || candidates.length > 1 ? "conflicting" :
    recommendation && [...superseded].some((id) => byId.get(id).decision !== recommendation || byId.get(id).kind === "explicit_rejection") ? "superseded" :
      recommendation ? "none" : "weak";
  const used = recommendation ? positive.filter((record) => record.decision === recommendation) : atTop;
  const supportLevel = recommendation ? used.some((record) => record.kind === "explicit_correction") ? "correction_backed" : "supported" : "weak";
  const supportBasis = recommendation ? used.some((record) => record.kind === "explicit_correction") ? "explicit_correction" :
    used.filter((record) => record.kind === "explicit_selection").length >= 2 ? "consistent_explicit_selection" : "consistent_passive_acceptance" :
    conflictState === "conflicting" ? "conflict" : "insufficient";
  return {
    recommendation, support_level: supportLevel, support_basis: supportBasis,
    evidence_ids_considered: sortedIds(relevant), evidence_ids_used: sortedIds(used),
    evidence_ids_superseded: [...superseded].sort(), matched_specificity: top.specificity,
    matched_scope_dimensions: dims, latest_correction_at: correctionTimes.at(-1) ?? null,
    conflict_state: conflictState,
    abstention_reason: recommendation ? null : conflictState === "conflicting" ? "conflicting_preference_evidence" : "weak_preference_evidence"
  };
}

function baselineStatus(baseline, input) {
  if (baseline === null || baseline === undefined) return { decision: null, error: "baseline_unavailable" };
  if (baseline.case_id !== input.case_id || baseline.schema_version !== "zdb.prediction.v1") throw new Error("baseline_identity_mismatch");
  if (baseline.error) return { decision: null, error: baseline.error };
  if (baseline.decision === null) return { decision: null, error: "baseline_unavailable" };
  if (baseline.decision !== "abstain" && !input.choices.includes(baseline.decision)) throw new Error("baseline_invalid_choice");
  return { decision: baseline.decision, error: null };
}

export function runPreferenceArm(input, arm, baseline = null) {
  if ("gold" in input || "acceptable" in input || "split" in input || "input" in input || "ambiguity" in input) throw new Error("benchmark_answer_metadata_at_resolver_boundary");
  if (!["B", "C", "D"].includes(arm)) throw new Error("unsupported_preference_arm");
  const context = input.preference_context;
  const pref = aggregatePreference(input);
  const base = arm === "B" ? { decision: null, error: null } : baselineStatus(baseline, input);
  const safety = authority(context.deterministic_rules.filter((record) => record.authority === "safety_rule"), input, "asserted_at", "safety_rule");
  const truth = authority(context.explicit_user_truth, input, "asserted_at", "truth");
  const userRule = authority(context.deterministic_rules.filter((record) => record.authority === "user_rule"), input, "asserted_at", "user_rule");
  let decision = "abstain";
  let source = "abstain_weak_preference";
  let reason = pref.abstention_reason;
  let failure = null;
  if (safety.error || (!safety.decision && truth.error) || (!safety.decision && !truth.decision && userRule.error)) {
    source = "research_error";
    reason = safety.error ?? truth.error ?? userRule.error;
    failure = "unclassified_research_error";
  } else if (safety.decision) {
    decision = safety.decision; source = "safety_rule"; reason = null;
  } else if (truth.decision) {
    decision = truth.decision; source = "explicit_user_truth"; reason = null;
  } else if (userRule.decision) {
    decision = userRule.decision; source = "user_rule"; reason = null;
  } else if (arm === "B") {
    if (pref.recommendation) { decision = pref.recommendation; source = "preference"; reason = null; }
    else if (pref.conflict_state === "conflicting") source = "abstain_conflict";
  } else if (arm === "C") {
    if (pref.recommendation) {
      decision = pref.recommendation;
      source = base.decision === null ? "preference_without_generative" : "preference";
      reason = null;
    } else if (base.decision !== null) {
      decision = base.decision; source = context.cold_start ? "cold_start_baseline" : "generative_baseline"; reason = null;
    } else if (pref.conflict_state === "conflicting") source = "abstain_conflict";
  } else if (pref.recommendation && base.decision === null) {
    decision = pref.recommendation; source = "preference_without_generative"; reason = null;
  } else if (pref.recommendation && pref.recommendation === base.decision) {
    decision = pref.recommendation; source = "generative_preference_agreement"; reason = null;
  } else if (pref.recommendation && base.decision !== null) {
    source = "abstain_generative_preference_disagreement";
    reason = "generative_preference_disagreement";
  } else if (base.decision !== null) {
    decision = base.decision; source = context.cold_start ? "cold_start_baseline" : "generative_baseline"; reason = null;
  } else if (pref.conflict_state === "conflicting") source = "abstain_conflict";

  if (source !== "research_error") {
    if (reason === "scope_mismatch") failure = "scope_mismatch";
    else if (reason === "no_preference_evidence") failure = "no_preference_evidence";
    else if (reason === "weak_preference_evidence") failure = "weak_preference_evidence";
    else if (reason === "conflicting_preference_evidence") failure = "conflicting_preference_evidence";
    else if (reason === "generative_preference_disagreement") failure = "generative_preference_disagreement";
  }
  const preferenceApplied = ["preference", "preference_without_generative", "generative_preference_agreement"].includes(source);
  return {
    schema_version: "zdb.preference_prediction.v1", case_id: input.case_id, arm,
    baseline_decision: base.decision, baseline_error: base.error,
    preference_recommendation: pref.recommendation, final_decision: decision, decision_source: source,
    preference_applied: preferenceApplied, support_level: pref.support_level, support_basis: pref.support_basis,
    evidence_ids_considered: pref.evidence_ids_considered, evidence_ids_used: pref.evidence_ids_used,
    evidence_ids_superseded: pref.evidence_ids_superseded, matched_specificity: pref.matched_specificity,
    matched_scope_dimensions: pref.matched_scope_dimensions, latest_correction_at: pref.latest_correction_at,
    conflict_state: pref.conflict_state, abstention_reason: reason, failure_code: failure
  };
}
