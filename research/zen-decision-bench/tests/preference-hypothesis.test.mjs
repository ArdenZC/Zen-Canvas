import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { readJsonl, sha256, validateDataset } from "../src/core.mjs";
import { validatePreferenceCase } from "../preference/src/validate-context.mjs";
import { aggregatePreference, projectPreferenceCase, runPreferenceArm } from "../preference/src/resolver.mjs";
import { evaluatePreference, NO_REAL_BASELINE } from "../preference/src/evaluate.mjs";

const corpus = await readJsonl(new URL("../fixtures/preference-stage-a.v1.jsonl", import.meta.url));
const byFamily = (family) => structuredClone(corpus.find((record) => record.tags.includes(family)));
const projected = (record) => projectPreferenceCase(record);
const base = (record, decision, error = null) => ({ schema_version: "zdb.prediction.v1", case_id: record.case_id, decision, confidence: null, latency_ms: null, error });
const evidence = (record, kind, decision, day, correctionOf) => {
  const e = {
    schema_version: "zdb.preference_evidence.v1", evidence_id: `${record.case_id}-test-e${record.preference_context.preference_evidence.length + 1}`,
    kind, task: record.task, decision, scope: { workspace: record.context.preference_target_scope.workspace },
    observed_at: `2026-09-${String(day).padStart(2, "0")}T12:00:00.000Z`, provenance: { category: "synthetic", source: "unit-scenario" }
  };
  if (correctionOf) e.correction_of = correctionOf;
  record.preference_context.preference_evidence.push(e);
  record.preference_context.cold_start = false;
  return e.evidence_id;
};
const reset = () => {
  const record = byFamily("cold_start");
  record.preference_context.explicit_user_truth = [];
  record.preference_context.deterministic_rules = [];
  return record;
};

describe("ZDB-03A corpus and locked ZDB boundaries", () => {
  it("keeps the owner-frozen dataset and locked test hashes unchanged", async () => {
    const frozen = await readJsonl(new URL("../fixtures/initial-corpus.v1.jsonl", import.meta.url));
    expect(validateDataset(frozen).dataset_hash).toBe("d3f45f4922d19713d7c9d187cd66c33469322dc012599d2fde790239c27a1b68");
    expect(sha256(frozen.filter((record) => record.split === "test"))).toBe("4afd78120d8bcba042752e6b65c9028ac653580d398d14ec338664cac4375c12");
  });
  it("holds the 60-case candidate and required 40/20 distribution", async () => {
    const manifest = JSON.parse(await readFile(new URL("../fixtures/preference-stage-a.v1.manifest.json", import.meta.url)));
    expect(validateDataset(corpus).valid).toBe(true);
    expect(corpus.every((record) => validatePreferenceCase(record).length === 0)).toBe(true);
    expect(manifest.dataset_hash).toBe(sha256(corpus));
    expect(manifest.case_count).toBe(60);
    expect(manifest.split_counts).toEqual({ pilot: 40, dev: 20, test: 0 });
    expect(manifest.task_counts).toMatchObject({ existing_folder_choice: 36, suggested_action: 18, purpose: 3, lifecycle: 3 });
    expect(Object.values(manifest.scenario_family_counts)).toEqual(Array(10).fill(6));
    expect(manifest.frozen).toBe(false);
  });
  it("rejects invalid cold start, future evidence, future correction, missing linkage and wrong task", () => {
    const record = reset();
    record.preference_context.cold_start = false;
    expect(validatePreferenceCase(record)).toContain("cold_start_evidence_count");
    record.preference_context.cold_start = true;
    const id = evidence(record, "passive_acceptance", "shared_folder", 21);
    expect(validatePreferenceCase(record)).toContain("future_preference_evidence");
    record.preference_context.preference_evidence[0].observed_at = "2026-09-05T12:00:00.000Z";
    evidence(record, "explicit_correction", "course_folder", 22, [id]);
    expect(validatePreferenceCase(record)).toContain("future_preference_evidence");
    record.preference_context.preference_evidence[1].observed_at = "2026-09-10T12:00:00.000Z";
    record.preference_context.preference_evidence[1].correction_of = ["missing"];
    expect(validatePreferenceCase(record)).toContain("correction_of_missing_id");
    record.preference_context.preference_evidence[1].correction_of = [id];
    record.preference_context.preference_evidence[0].observed_at = "2026-09-12T12:00:00.000Z";
    expect(validatePreferenceCase(record)).toContain("correction_of_not_earlier");
    record.preference_context.preference_evidence[0].task = "suggested_action";
    expect(validatePreferenceCase(record)).toContain("preference_evidence_shape");
  });
  it("requires a target scope for non-cold scoped resolution", () => {
    const record = reset();
    evidence(record, "passive_acceptance", "shared_folder", 5);
    delete record.context.preference_target_scope;
    expect(validatePreferenceCase(record)).toContain("preference_target_scope_required");
  });
});

describe("ZDB-03A ordinal preference semantics", () => {
  it("requires 3 passive acceptances, 2 selections, or 1 valid correction", () => {
    for (const kind of ["passive_acceptance", "explicit_selection"]) {
      const record = reset();
      evidence(record, kind, "shared_folder", 4);
      expect(aggregatePreference(projected(record)).recommendation).toBeNull();
      evidence(record, kind, "shared_folder", 6);
      expect(aggregatePreference(projected(record)).recommendation).toBe(kind === "explicit_selection" ? "shared_folder" : null);
      if (kind === "passive_acceptance") {
        evidence(record, kind, "shared_folder", 8);
        expect(aggregatePreference(projected(record)).recommendation).toBe("shared_folder");
      }
    }
    const record = reset();
    const old = evidence(record, "passive_acceptance", "course_folder", 4);
    evidence(record, "explicit_correction", "shared_folder", 8, [old]);
    const result = aggregatePreference(projected(record));
    expect(result.recommendation).toBe("shared_folder");
    expect(result.support_level).toBe("correction_backed");
    expect(result.evidence_ids_superseded).toContain(old);
    expect(result.conflict_state).toBe("superseded");
  });
  it("does not infer an alternative from rejection or ignore an unsuperseded contradiction", () => {
    const rejected = reset();
    evidence(rejected, "explicit_rejection", "course_folder", 4);
    expect(aggregatePreference(projected(rejected)).recommendation).toBeNull();
    const conflict = reset();
    evidence(conflict, "explicit_selection", "shared_folder", 4);
    evidence(conflict, "explicit_selection", "shared_folder", 6);
    evidence(conflict, "explicit_rejection", "shared_folder", 8);
    expect(aggregatePreference(projected(conflict))).toMatchObject({ recommendation: null, conflict_state: "conflicting" });
    const rejectionId = conflict.preference_context.preference_evidence.at(-1).evidence_id;
    evidence(conflict, "explicit_correction", "shared_folder", 10, [rejectionId]);
    expect(aggregatePreference(projected(conflict))).toMatchObject({ recommendation: "shared_folder", conflict_state: "superseded" });
  });
  it("does not fall back from weak narrow evidence to supported broad history", () => {
    const record = byFamily("scope_conflict");
    const broad = record.preference_context.preference_evidence.filter((entry) => entry.scope.global_user);
    record.preference_context.preference_evidence = [...broad, record.preference_context.preference_evidence.find((entry) => entry.scope.workspace)];
    const result = aggregatePreference(projected(record));
    expect(result.recommendation).toBeNull();
    expect(result.matched_specificity).toBe(2);
    expect(result.conflict_state).toBe("weak");
    evidence(record, "explicit_selection", "shared_folder", 16);
    record.preference_context.preference_evidence.at(-1).scope = { ...record.preference_context.preference_evidence.at(-2).scope };
    expect(aggregatePreference(projected(record)).recommendation).toBe("shared_folder");
    const mismatch = reset();
    const id = evidence(mismatch, "explicit_selection", "shared_folder", 4);
    evidence(mismatch, "explicit_selection", "shared_folder", 5);
    mismatch.preference_context.preference_evidence.forEach((entry) => { entry.scope = { workspace: "other-project" }; });
    expect(aggregatePreference(projected(mismatch))).toMatchObject({ recommendation: null, abstention_reason: "scope_mismatch" });
    expect(aggregatePreference(projected(mismatch)).evidence_ids_considered).not.toContain(id);
  });
  it("keeps narrower evidence when a broader correction points at it", () => {
    const record = reset();
    const narrowId = evidence(record, "explicit_selection", "course_folder", 4);
    evidence(record, "explicit_selection", "course_folder", 6);
    const correctionId = evidence(record, "explicit_correction", "shared_folder", 8, [narrowId]);
    record.preference_context.preference_evidence.find((entry) => entry.evidence_id === correctionId).scope = { global_user: true };
    const result = aggregatePreference(projected(record));
    expect(result.evidence_ids_superseded).not.toContain(narrowId);
    expect(result.recommendation).toBe("course_folder");
  });
  it("abstains on equal conflict regardless of evidence ordering or case ID", () => {
    const record = byFamily("equal_conflict");
    const original = aggregatePreference(projected(record));
    record.preference_context.preference_evidence.reverse();
    record.case_id = "another-identifier";
    const reversed = aggregatePreference(projected(record));
    expect(original).toMatchObject({ recommendation: null, conflict_state: "conflicting" });
    expect(reversed).toEqual(original);
  });
});

describe("ZDB-03A authority and arm behavior", () => {
  it("never sees benchmark gold; changing gold and acceptable cannot change a result", () => {
    const record = byFamily("consistent_preference");
    const first = runPreferenceArm(projected(record), "B");
    record.gold = "course_folder";
    record.acceptable = ["archive_folder"];
    expect(runPreferenceArm(projected(record), "B")).toEqual(first);
    expect(projected(record)).not.toHaveProperty("gold");
    expect(() => runPreferenceArm(record, "B")).toThrow(/benchmark_answer_metadata/u);
  });
  it("orders safety, explicit truth, user rule, Preference, then baseline", () => {
    const record = byFamily("consistent_preference");
    const baseline = base(record, "course_folder");
    expect(runPreferenceArm(projected(record), "C", baseline)).toMatchObject({ final_decision: "shared_folder", decision_source: "preference" });
    record.preference_context.deterministic_rules.push({ rule_id: "user", authority: "user_rule", task: record.task, decision: "archive_folder", scope: { global_user: true }, asserted_at: "2026-09-19T12:00:00.000Z" });
    expect(runPreferenceArm(projected(record), "C", baseline)).toMatchObject({ final_decision: "archive_folder", decision_source: "user_rule" });
    record.preference_context.explicit_user_truth.push({ truth_id: "truth", task: record.task, decision: "course_folder", scope: { global_user: true }, asserted_at: "2026-09-19T12:00:00.000Z" });
    expect(runPreferenceArm(projected(record), "C", baseline)).toMatchObject({ final_decision: "course_folder", decision_source: "explicit_user_truth" });
    record.preference_context.deterministic_rules.push({ rule_id: "safety", authority: "safety_rule", task: record.task, decision: "archive_folder", scope: { global_user: true }, asserted_at: "2026-09-19T12:00:00.000Z" });
    expect(runPreferenceArm(projected(record), "C", baseline)).toMatchObject({ final_decision: "archive_folder", decision_source: "safety_rule", preference_applied: false, preference_recommendation: "shared_folder" });
  });
  it("fails closed on contradictory equal-specificity safety and user rules", () => {
    const record = reset();
    for (const authority of ["safety_rule", "user_rule"]) {
      record.preference_context.deterministic_rules = ["course_folder", "shared_folder"].map((decision, index) => ({ rule_id: `${authority}-${index}`, authority, task: record.task, decision, scope: { global_user: true }, asserted_at: "2026-09-19T12:00:00.000Z" }));
      expect(runPreferenceArm(projected(record), "B")).toMatchObject({ final_decision: "abstain", decision_source: "research_error" });
    }
  });
  it("allows a later comparable explicit truth to supersede an older one", () => {
    const record = reset();
    record.preference_context.explicit_user_truth = ["course_folder", "shared_folder"].map((decision, index) => ({ truth_id: `truth-${index}`, task: record.task, decision, scope: { global_user: true }, asserted_at: `2026-09-${index ? "19" : "10"}T12:00:00.000Z` }));
    expect(runPreferenceArm(projected(record), "B")).toMatchObject({ final_decision: "shared_folder", decision_source: "explicit_user_truth" });
  });
  it("preserves cold-start baseline, and B abstains without evidence", () => {
    const record = reset();
    const baseline = base(record, "course_folder");
    expect(runPreferenceArm(projected(record), "B")).toMatchObject({ final_decision: "abstain", preference_recommendation: null });
    for (const arm of ["C", "D"]) expect(runPreferenceArm(projected(record), arm, baseline)).toMatchObject({ final_decision: "course_folder", decision_source: "cold_start_baseline" });
  });
  it("makes C change a differing baseline; D abstains, agrees, or uses supported Preference when baseline unavailable", () => {
    const record = byFamily("consistent_preference");
    const input = projected(record);
    expect(runPreferenceArm(input, "C", base(record, "course_folder"))).toMatchObject({ final_decision: "shared_folder", decision_source: "preference" });
    expect(runPreferenceArm(input, "D", base(record, "course_folder"))).toMatchObject({ final_decision: "abstain", decision_source: "abstain_generative_preference_disagreement" });
    expect(runPreferenceArm(input, "D", base(record, "shared_folder"))).toMatchObject({ final_decision: "shared_folder", decision_source: "generative_preference_agreement" });
    expect(runPreferenceArm(input, "D", null)).toMatchObject({ final_decision: "shared_folder", decision_source: "preference_without_generative", baseline_error: "baseline_unavailable" });
  });
  it("attributes only real input evidence and hard-fails evaluation gates", () => {
    const record = byFamily("safety_conflict");
    const prediction = runPreferenceArm(projected(record), "B");
    const ids = new Set(record.preference_context.preference_evidence.map((entry) => entry.evidence_id));
    expect([...prediction.evidence_ids_considered, ...prediction.evidence_ids_used, ...prediction.evidence_ids_superseded].every((id) => ids.has(id))).toBe(true);
    expect(evaluatePreference([record], [prediction]).baseline_dependent_metrics_status).toBe(NO_REAL_BASELINE);
    const bad = { ...prediction, final_decision: "shared_folder" };
    expect(evaluatePreference([record], [bad])).toMatchObject({ safety_boundary_violations: 1, gate_c_pass: false });
    const truth = byFamily("explicit_truth_conflict");
    const badTruth = { ...runPreferenceArm(projected(truth), "B"), final_decision: "shared_folder" };
    expect(evaluatePreference([truth], [badTruth])).toMatchObject({ explicit_truth_violations: 1, gate_c_pass: false });
  });
  it("accounts for beneficial and harmful external-baseline transitions as raw counts", () => {
    const helpfulCase = byFamily("consistent_preference");
    const helpful = runPreferenceArm(projected(helpfulCase), "C", base(helpfulCase, "course_folder"));
    const harmfulCase = structuredClone(helpfulCase);
    harmfulCase.case_id = "transition-harmful";
    const harmful = {
      ...runPreferenceArm(projected(harmfulCase), "C", base(harmfulCase, "shared_folder")),
      final_decision: "course_folder", decision_source: "preference", preference_applied: true
    };
    const unsafeCase = byFamily("equal_conflict");
    const unsafe = {
      ...runPreferenceArm(projected(unsafeCase), "C", base(unsafeCase, "abstain")),
      final_decision: "course_folder", decision_source: "preference", preference_applied: true
    };
    const summary = evaluatePreference([helpfulCase, harmfulCase, unsafeCase], [helpful, harmful, unsafe], { realBaseline: true });
    expect(summary.transition_matrix).toMatchObject({
      baseline_wrong_to_preference_correct: 1,
      baseline_correct_to_preference_wrong: 1,
      baseline_abstain_to_unsafe_preference_guess: 1
    });
    expect(summary.preference_net_benefit).toEqual({ beneficial: 1, harmful: 2, net: -1 });
  });
  it("emits the bounded research prediction schema without hidden oracle fields", async () => {
    const schema = JSON.parse(await readFile(new URL("../schema/preference-prediction.v1.schema.json", import.meta.url)));
    const record = byFamily("consistent_preference");
    for (const arm of ["B", "C", "D"]) {
      const prediction = runPreferenceArm(projected(record), arm);
      expect(Object.keys(prediction).sort()).toEqual([...schema.required].sort());
      for (const [key, definition] of Object.entries(schema.properties)) {
        if (definition.enum) expect(definition.enum).toContain(prediction[key]);
      }
      expect(prediction).not.toHaveProperty("gold");
      expect(prediction).not.toHaveProperty("acceptable");
      expect(prediction).not.toHaveProperty("split");
    }
  });
});
