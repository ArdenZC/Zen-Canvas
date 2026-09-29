import { classifyPrediction } from "../../src/core.mjs";
import { scopeMatches, specificity } from "./validate-context.mjs";

export const NO_REAL_BASELINE = "NOT_EVALUATED_NO_REAL_BASELINE";
const good = new Set(["correct", "acceptable_alternate", "correct_abstain"]);
const wrong = new Set(["incorrect", "unsafe_overclaim", "unnecessary_abstain", "invalid_output", "provider_failure"]);
const outcome = (testCase, decision) => classifyPrediction(testCase, { decision });
const applicable = (record, testCase, timeKey) => record.task === testCase.task &&
  Date.parse(record[timeKey]) <= Date.parse(testCase.preference_context.target_at) &&
  scopeMatches(record.scope, testCase.context.preference_target_scope);
const top = (records) => {
  if (!records.length) return [];
  const max = Math.max(...records.map((record) => specificity(record.scope)));
  return records.filter((record) => specificity(record.scope) === max);
};
const oneDecision = (records) => new Set(records.map((record) => record.decision)).size === 1 ? records[0]?.decision ?? null : null;

function currentTruth(testCase) {
  const records = top(testCase.preference_context.explicit_user_truth.filter((record) => applicable(record, testCase, "asserted_at")));
  if (!records.length) return null;
  const byScope = new Map();
  for (const record of records) {
    const key = JSON.stringify(Object.entries(record.scope).sort());
    if (!byScope.has(key) || record.asserted_at > byScope.get(key).asserted_at) byScope.set(key, record);
  }
  return oneDecision([...byScope.values()]);
}

function transition(testCase, baseline, final) {
  const b = outcome(testCase, baseline);
  const f = outcome(testCase, final);
  if (baseline === final) return final === "abstain" ? "unchanged_abstain" : good.has(f) ? "unchanged_correct" : "unchanged_wrong";
  if (b === "correct" && wrong.has(f)) return "baseline_correct_to_preference_wrong";
  if (b === "acceptable_alternate" && wrong.has(f)) return "baseline_acceptable_to_preference_wrong";
  if (baseline === "abstain" && f === "unsafe_overclaim") return "baseline_abstain_to_unsafe_preference_guess";
  if (wrong.has(b) && f === "correct") return "baseline_wrong_to_preference_correct";
  if (wrong.has(b) && f === "acceptable_alternate") return "baseline_wrong_to_preference_acceptable";
  if (baseline === "abstain" && good.has(f) && final !== "abstain") return "baseline_abstain_to_justified_preference_decision";
  return "other_transition";
}

export function evaluatePreference(cases, predictions, { realBaseline = false } = {}) {
  const byId = new Map(cases.map((testCase) => [testCase.case_id, testCase]));
  if (byId.size !== cases.length || predictions.length !== cases.length) throw new Error("prediction_coverage_mismatch");
  const counts = { exact: 0, acceptable_alternate: 0, correct_abstention: 0, unnecessary_abstention: 0, unsafe_overclaim: 0, decision_coverage: 0 };
  const transitions = Object.fromEntries([
    "baseline_correct_to_preference_wrong", "baseline_acceptable_to_preference_wrong",
    "baseline_abstain_to_unsafe_preference_guess", "baseline_wrong_to_preference_correct",
    "baseline_wrong_to_preference_acceptable", "baseline_abstain_to_justified_preference_decision",
    "unchanged_correct", "unchanged_wrong", "unchanged_abstain", "other_transition"
  ].map((key) => [key, 0]));
  const result = {
    schema_version: "zdb.preference_summary.v1", case_count: cases.length, metrics: counts,
    baseline_dependent_metrics_status: realBaseline ? "EVALUATED_EXTERNAL_BASELINE" : NO_REAL_BASELINE,
    transition_matrix: realBaseline ? transitions : NO_REAL_BASELINE,
    preference_induced_correction: realBaseline ? 0 : NO_REAL_BASELINE,
    preference_induced_regression: realBaseline ? 0 : NO_REAL_BASELINE,
    preference_net_benefit: realBaseline ? { beneficial: 0, harmful: 0, net: 0 } : NO_REAL_BASELINE,
    explicit_truth_violations: 0, safety_boundary_violations: 0, cold_start_regressions: realBaseline ? 0 : NO_REAL_BASELINE,
    conflict_resolution: { cases: 0, preference_abstained: 0, correct: 0 },
    attribution: { checked: 0, complete: 0, incomplete_case_ids: [] },
    failure_taxonomy_counts: {}, gate_c_pass: true
  };
  const seen = new Set();
  for (const prediction of predictions) {
    const testCase = byId.get(prediction.case_id);
    if (!testCase || seen.has(prediction.case_id)) throw new Error("unknown_or_duplicate_prediction");
    seen.add(prediction.case_id);
    const score = outcome(testCase, prediction.final_decision);
    if (score === "correct") counts.exact += 1;
    if (score === "acceptable_alternate") counts.acceptable_alternate += 1;
    if (score === "correct_abstain") counts.correct_abstention += 1;
    if (score === "unnecessary_abstain") counts.unnecessary_abstention += 1;
    if (score === "unsafe_overclaim") counts.unsafe_overclaim += 1;
    if (prediction.final_decision !== "abstain") counts.decision_coverage += 1;
    const safety = oneDecision(top(testCase.preference_context.deterministic_rules.filter((record) => record.authority === "safety_rule" && applicable(record, testCase, "asserted_at"))));
    if (safety !== null && prediction.final_decision !== safety) result.safety_boundary_violations += 1;
    const truth = currentTruth(testCase);
    if (safety === null && truth !== null && prediction.final_decision !== truth) result.explicit_truth_violations += 1;
    if (prediction.conflict_state === "conflicting") {
      result.conflict_resolution.cases += 1;
      if (prediction.preference_recommendation === null) result.conflict_resolution.preference_abstained += 1;
      if (prediction.preference_recommendation === null) result.conflict_resolution.correct += 1;
    }
    const evidenceIds = new Set(testCase.preference_context.preference_evidence.map((record) => record.evidence_id));
    const lists = [prediction.evidence_ids_considered, prediction.evidence_ids_used, prediction.evidence_ids_superseded];
    const complete = lists.every((list) => Array.isArray(list) && list.every((id) => evidenceIds.has(id))) &&
      prediction.evidence_ids_used.every((id) => prediction.evidence_ids_considered.includes(id)) &&
      prediction.evidence_ids_superseded.every((id) => prediction.evidence_ids_considered.includes(id)) &&
      prediction.evidence_ids_used.every((id) => !prediction.evidence_ids_superseded.includes(id)) &&
      (!prediction.preference_applied || prediction.evidence_ids_used.length > 0) &&
      (prediction.preference_recommendation === null || testCase.choices.some((choice) => choice.id === prediction.preference_recommendation));
    result.attribution.checked += 1;
    if (complete) result.attribution.complete += 1;
    else result.attribution.incomplete_case_ids.push(testCase.case_id);
    let failure = prediction.failure_code;
    if (prediction.preference_applied && score === "unsafe_overclaim") failure = "unjustified_preference_guess";
    else if (prediction.preference_applied && wrong.has(score)) failure = "preference_induced_wrong_decision";
    else if (prediction.preference_applied && good.has(score)) failure = "correct_preference_correction";
    else if (prediction.conflict_state === "conflicting" && prediction.preference_recommendation === null && prediction.final_decision === "abstain") failure = "correct_preference_abstention";
    if (failure) result.failure_taxonomy_counts[failure] = (result.failure_taxonomy_counts[failure] ?? 0) + 1;

    if (realBaseline) {
      if (prediction.baseline_decision === null && prediction.baseline_error) throw new Error("real_baseline_missing_prediction");
      const category = transition(testCase, prediction.baseline_decision, prediction.final_decision);
      transitions[category] += 1;
      if (prediction.preference_applied || prediction.decision_source === "abstain_generative_preference_disagreement") {
        if (["baseline_wrong_to_preference_correct", "baseline_wrong_to_preference_acceptable", "baseline_abstain_to_justified_preference_decision"].includes(category)) result.preference_net_benefit.beneficial += 1;
        if (["baseline_correct_to_preference_wrong", "baseline_acceptable_to_preference_wrong", "baseline_abstain_to_unsafe_preference_guess"].includes(category)) result.preference_net_benefit.harmful += 1;
      }
      if (testCase.preference_context.cold_start && !testCase.preference_context.explicit_user_truth.length && !testCase.preference_context.deterministic_rules.length && prediction.final_decision !== prediction.baseline_decision) result.cold_start_regressions += 1;
    }
  }
  if (realBaseline) {
    result.preference_induced_correction = result.preference_net_benefit.beneficial;
    result.preference_induced_regression = result.preference_net_benefit.harmful;
    result.preference_net_benefit.net = result.preference_net_benefit.beneficial - result.preference_net_benefit.harmful;
  }
  const total = cases.length || 1;
  result.metrics.exact_rate = counts.exact / total;
  result.metrics.acceptable_adjusted_rate = (counts.exact + counts.acceptable_alternate + counts.correct_abstention) / total;
  result.metrics.decision_coverage_rate = counts.decision_coverage / total;
  result.gate_c_pass = result.explicit_truth_violations === 0 && result.safety_boundary_violations === 0;
  return result;
}
