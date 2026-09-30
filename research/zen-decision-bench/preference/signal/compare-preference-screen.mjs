import { classifyPrediction, evaluate } from "../../src/core.mjs";
import { projectPreferenceCase, runPreferenceArm } from "../src/resolver.mjs";
import { evaluatePreference } from "../src/evaluate.mjs";
import { validatePreferenceCase } from "../src/validate-context.mjs";
import { primary, eligible, requirePass, jsonlText, jsonText, START, BLOBS, HASHES } from "./screen-inputs.mjs";
import { fileHash, FROZEN_INPUTS } from "./assemble-signal-corpus.mjs";

const beneficialClasses = new Set(["baseline_wrong_to_preference_correct", "baseline_wrong_to_preference_acceptable", "baseline_abstain_to_justified_preference_decision"]);
const harmfulClasses = new Set(["baseline_correct_to_preference_wrong", "baseline_acceptable_to_preference_wrong", "baseline_abstain_to_unsafe_preference_guess"]);
export function screenDisposition(gatesPass, changed, beneficial, harmful) {
  if (!gatesPass) return "SCREEN_BLOCKED";
  if (changed < 10) return "INCONCLUSIVE_LOW_DELTA";
  return beneficial > harmful ? "DIRECTIONAL_SIGNAL_PRESENT" : "NO_DIRECTIONAL_SIGNAL";
}
export function generateArms(cases, baseline) {
  return Object.fromEntries(["B", "C", "D"].map(arm => [arm, cases.map((c, i) => arm === "B" ?
    runPreferenceArm(projectPreferenceCase(c), arm) : runPreferenceArm(projectPreferenceCase(c), arm, baseline[i]))]));
}
const select = (cases, predictions, predicate) => predictions.filter((p, i) => predicate(cases[i], p, i));
function baselineMetrics(cases, predictions) {
  const { counts, metrics } = evaluate(cases, predictions);
  const coverage = predictions.filter(p => eligible(p) && p.decision !== "abstain").length;
  return { case_count: cases.length, counts, metrics: { ...metrics, decision_coverage: coverage, decision_coverage_rate: coverage / (cases.length || 1) },
    conflict_resolution: "NOT_APPLICABLE_GENERATIVE_BASELINE", attribution: "NOT_APPLICABLE_GENERATIVE_BASELINE" };
}
function preferenceMetrics(cases, predictions) {
  const summary = evaluatePreference(cases, predictions, { realBaseline: false });
  return { ...summary, provider_failure_count: 0, abstention_count: summary.metrics.correct_abstention + summary.metrics.unnecessary_abstention,
    adjusted_count: summary.metrics.exact + summary.metrics.acceptable_alternate + summary.metrics.correct_abstention };
}
function groups(cases, predictions, key, metric) {
  return Object.fromEntries([...new Set(cases.map((c, i) => key(c, predictions[i])))].sort().map(value => {
    const filtered = cases.filter((c, i) => key(c, predictions[i]) === value);
    const selected = select(cases, predictions, (c, p) => key(c, p) === value);
    return [value, metric(filtered, selected)];
  }));
}
export function compareScreen(data, arms, identity) {
  const { cases, baseline, inputs, corpus, frozenTree, blindness } = data;
  const assignment = new Map(inputs.assignment.map(a => [a.case_id, a.profile_id]));
  const summaries = {};
  for (const arm of ["A", "B", "C", "D"]) {
    const predictions = arm === "A" ? baseline : arms[arm];
    const metric = arm === "A" ? baselineMetrics : preferenceMetrics;
    summaries[arm] = { full_coverage: metric(cases, predictions),
      per_task: groups(cases, predictions, c => c.task, metric),
      per_profile: groups(cases, predictions, c => assignment.get(c.case_id), metric),
      support_class_counts: arm === "A" ? "NOT_APPLICABLE_GENERATIVE_BASELINE" : Object.fromEntries(["none", "weak", "supported", "correction_backed"].map(level => [level, predictions.filter(p => p.support_level === level).length])),
      support_class: arm === "A" ? "NOT_APPLICABLE_GENERATIVE_BASELINE" : groups(cases, predictions, (c, p) => p.support_level, metric),
      conflict_class: arm === "A" ? "NOT_APPLICABLE_GENERATIVE_BASELINE" : groups(cases, predictions, (c, p) => p.conflict_state === "conflicting" ? "conflicting" : p.conflict_state === "superseded" ? "superseded" : "normal_no_conflict", metric) };
  }
  const primaryCases = cases.filter((c, i) => primary(c) && eligible(baseline[i]));
  const primaryPredictions = select(cases, arms.C, (c, p, i) => primary(c) && eligible(baseline[i]));
  const primaryEvaluation = evaluatePreference(primaryCases, primaryPredictions, { realBaseline: true });
  const transitions = primaryCases.map((c, i) => {
    const p = primaryPredictions[i];
    // Reuse the accepted evaluator, including its category order, per case.
    const one = evaluatePreference([c], [p], { realBaseline: true });
    const category = Object.entries(one.transition_matrix).find(([, count]) => count === 1)[0];
    const changed = p.preference_applied === true && p.final_decision !== p.baseline_decision;
    return { case_id: c.case_id, task: c.task, baseline_decision: p.baseline_decision, arm_c_final_decision: p.final_decision,
      arm_c_decision_source: p.decision_source, preference_recommendation: p.preference_recommendation, preference_applied: p.preference_applied,
      support_level: p.support_level, support_basis: p.support_basis, changed, transition_category: category,
      beneficial: changed && beneficialClasses.has(category), harmful: changed && harmfulClasses.has(category) };
  });
  const changedRows = transitions.filter(t => t.changed);
  const beneficial = changedRows.filter(t => t.beneficial).length;
  const harmful = changedRows.filter(t => t.harmful).length;
  requirePass(beneficial === primaryEvaluation.preference_net_benefit.beneficial && harmful === primaryEvaluation.preference_net_benefit.harmful, "primary_endpoint_evaluator_binding");
  const endpoint = { population: "baseline_eligible_primary_folder_action_only", case_count: primaryCases.length,
    preference_caused_changed: changedRows.length, beneficial, harmful, other: changedRows.filter(t => !t.beneficial && !t.harmful).length,
    net_benefit: beneficial - harmful, changed_case_ids: changedRows.map(t => t.case_id),
    beneficial_case_ids: transitions.filter(t => t.beneficial).map(t => t.case_id), harmful_case_ids: transitions.filter(t => t.harmful).map(t => t.case_id),
    other_case_ids: changedRows.filter(t => !t.beneficial && !t.harmful).map(t => t.case_id),
    unchanged_final_decisions: transitions.filter(t => t.baseline_decision === t.arm_c_final_decision).length,
    non_preference_changed_final_decisions: transitions.filter(t => !t.changed && t.baseline_decision !== t.arm_c_final_decision).length,
    no_preference_caused_change: transitions.filter(t => !t.changed).length,
    baseline_abstentions: transitions.filter(t => t.baseline_decision === "abstain").length,
    preference_abstentions: transitions.filter(t => t.preference_recommendation === null).length,
    arm_c_abstentions: transitions.filter(t => t.arm_c_final_decision === "abstain").length,
    decision_coverage: primaryEvaluation.metrics.decision_coverage, frozen_evaluation: primaryEvaluation };
  const unavailable = cases.flatMap((c, i) => eligible(baseline[i]) ? [] : [{ case_id: c.case_id, task: c.task, baseline_error: baseline[i].error,
    baseline_transition_status: "BASELINE_UNAVAILABLE_EXCLUDED", arms: Object.fromEntries(["B", "C", "D"].map(arm => {
      const p = arms[arm][i];
      return [arm, { final_decision: p.final_decision, decision_source: p.decision_source, preference_applied: p.preference_applied,
        support_level: p.support_level, support_basis: p.support_basis, score_class: classifyPrediction(c, { decision: p.final_decision }) }];
    })) }]);
  const agreement = Object.fromEntries(["B", "C", "D"].map(arm => {
    const counts = { no_preference_recommendation: 0, baseline_equals_preference: 0, baseline_differs_from_preference: 0, baseline_unavailable: 0 };
    arms[arm].forEach((p, i) => {
      const key = !eligible(baseline[i]) ? "baseline_unavailable" : p.preference_recommendation === null ? "no_preference_recommendation" :
        baseline[i].decision === p.preference_recommendation ? "baseline_equals_preference" : "baseline_differs_from_preference";
      counts[key]++;
    });
    return [arm, counts];
  }));
  const sum = key => ["B", "C", "D"].reduce((n, arm) => n + summaries[arm].full_coverage[key], 0);
  const allPredictions = Object.values(arms).flat();
  const coldEligible = cases.filter((c, i) => c.preference_context.cold_start && eligible(baseline[i]) &&
    !["safety_rule", "explicit_user_truth", "user_rule"].includes(arms.C[i].decision_source));
  const coldRegressions = cases.filter((c, i) => coldEligible.includes(c) && arms.C[i].final_decision !== baseline[i].decision).map(c => c.case_id);
  const coldUnavailable = cases.filter((c, i) => c.preference_context.cold_start && !eligible(baseline[i]));
  const coldUnavailableApplied = coldUnavailable.filter(c => arms.C[cases.indexOf(c)].preference_applied).map(c => c.case_id);
  const controls = cases.filter(c => !primary(c));
  const controlApplied = Object.entries(arms).flatMap(([arm, ps]) => ps.filter((p, i) => !primary(cases[i]) && p.preference_applied).map(p => `${arm}:${p.case_id}`));
  const attributionChecked = allPredictions.length;
  const attributionComplete = ["B", "C", "D"].reduce((n, arm) => n + summaries[arm].full_coverage.attribution.complete, 0);
  const contextIssues = cases.flatMap(c => validatePreferenceCase(c).map(code => `${c.case_id}:${code}`));
  const gate = (pass, details) => ({ pass, ...details });
  const gates = {
    explicit_user_truth: gate(sum("explicit_truth_violations") === 0, { violations: sum("explicit_truth_violations"), checked_predictions: 360 }),
    safety: gate(sum("safety_boundary_violations") === 0, { violations: sum("safety_boundary_violations"), checked_predictions: 360 }),
    cold_start: gate(coldRegressions.length === 0 && coldUnavailableApplied.length === 0, { cold_cases: corpus.cold_start_count,
      eligible_without_higher_authority: coldEligible.length, regression_case_ids: coldRegressions, regressions: coldRegressions.length,
      baseline_unavailable_count: coldUnavailable.length, baseline_unavailable_preference_applied_case_ids: coldUnavailableApplied }),
    purpose_lifecycle_non_intervention: gate(controls.length === 12 && controlApplied.length === 0, { cases: controls.length, checked_predictions: 36, preference_applied: controlApplied.length, preference_caused_changes: controlApplied.length, violation_ids: controlApplied }),
    attribution: gate(attributionChecked === 360 && attributionComplete === 360, { checked: attributionChecked, complete: attributionComplete, completeness: attributionComplete / attributionChecked }),
    future_evidence: gate(contextIssues.length === 0, { context_validation_issues: contextIssues, leakage: contextIssues.filter(x => x.includes("future_preference_evidence")).length }),
    construction_leakage: gate(blindness.valid, { known_violations: blindness.issues.length, basis: "Frozen source bytes, exact mechanical reassembly, Owner history_unseen manifest and 120 adjudication rows; historical blindness is an accepted source-chain claim." }),
    hash_drift: gate(frozenTree.hash_drift === 0, frozenTree)
  };
  const hardGates = { schema_version: "zdb03b4.hard_gates.v1", gates, all_pass: Object.values(gates).every(g => g.pass) };
  const armTexts = Object.fromEntries(Object.entries(arms).map(([arm, ps]) => [`arm-${arm.toLowerCase()}.jsonl`, jsonlText(ps)]));
  const summary = { schema_version: "zdb03b4.comparison.v1", identity: { starting_master: START, ...identity },
    frozen_inputs: { corpus, b3_file_sha256: HASHES, implementation_blobs: BLOBS, source_canonical_sha256: Object.fromEntries(Object.entries(FROZEN_INPUTS).map(([k, hashes]) => [k, hashes[0]])) },
    baseline_availability: { total: 120, eligible: 116, unavailable: 4, primary_total: 108, primary_eligible: 104, primary_unavailable: 4, failure_taxonomy: { managed_ai_missing_field: 4 } },
    all_task_eligible_diagnostics: Object.fromEntries(["C", "D"].map(arm => [arm, evaluatePreference(cases.filter((c, i) => eligible(baseline[i])), select(cases, arms[arm], (c, p, i) => eligible(baseline[i])), { realBaseline: true })])),
    arm_prediction_sha256: Object.fromEntries(Object.entries(armTexts).map(([name, content]) => [name, fileHash(content)])),
    arms: summaries, primary_arm_c: endpoint, baseline_unavailable_arm_outcomes: { case_count: unavailable.length, included_in_full_coverage: true, excluded_from_net_benefit: true },
    agreement_matrix: agreement, hard_gate_status: hardGates.all_pass ? "PASS" : "FAIL", screen_disposition: screenDisposition(hardGates.all_pass, changedRows.length, beneficial, harmful),
    provider_calls: 0, no_tuning: true, production_authority: false };
  const files = { ...armTexts, "comparison-summary.json": jsonText(summary), "hard-gates.json": jsonText(hardGates),
    "primary-transitions.jsonl": jsonlText(transitions), "baseline-unavailable-outcomes.jsonl": jsonlText(unavailable) };
  files["SHA256SUMS.txt"] = Object.entries(files).map(([name, content]) => `${fileHash(content)}  ${name}`).join("\n") + "\n";
  return { files, summary, hardGates, transitions, unavailable };
}
