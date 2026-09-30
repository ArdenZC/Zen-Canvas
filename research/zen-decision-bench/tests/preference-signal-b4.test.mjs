import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { loadScreenInputs, eligible, primary, jsonlText } from "../preference/signal/screen-inputs.mjs";
import { generateArms, compareScreen, screenDisposition } from "../preference/signal/compare-preference-screen.mjs";
import { deterministicComparison } from "../preference/signal/run-preference-screen.mjs";
import { projectPreferenceCase, runPreferenceArm } from "../preference/src/resolver.mjs";
import { evaluatePreference, NO_REAL_BASELINE } from "../preference/src/evaluate.mjs";

const data = await loadScreenInputs();
const arms = generateArms(data.cases, data.baseline);
const identity = { candidate_runner_commit: "test-only-not-frozen" };
const result = compareScreen(data, arms, identity);

describe("ZDB-03B4 offline frozen screen", () => {
  it("binds the exact frozen 120-case chain and 116/4 plus 104/4 inventory", () => {
    expect(data.frozenTree.hash_drift).toBe(0);
    expect(data.baseline.filter(eligible)).toHaveLength(116);
    expect(data.cases.filter((c, i) => primary(c) && eligible(data.baseline[i]))).toHaveLength(104);
    expect(data.corpus.cold_start_count).toBe(55);
  });
  it("runs each frozen arm for all 120 cases, with B independent of baseline", () => {
    for (const arm of ["B", "C", "D"]) {
      expect(arms[arm]).toHaveLength(120);
      expect(arms[arm].map(p => p.case_id)).toEqual(data.cases.map(c => c.case_id));
      expect(arms[arm].every(p => p.schema_version === "zdb.preference_prediction.v1")).toBe(true);
    }
    expect(generateArms(data.cases, data.baseline.map(p => ({ ...p, decision: null, error: "test_unavailable" }))).B).toEqual(arms.B);
    for (const arm of ["C", "D"]) data.baseline.forEach((p, i) => {
      expect(arms[arm][i].baseline_decision).toBe(p.decision);
      expect(arms[arm][i].baseline_error).toBe(p.error);
    });
  });
  it("excludes all answer and current input metadata from projection and predictions for all 120", () => {
    for (const [i, c] of data.cases.entries()) {
      const mutations = [
        { gold: c.choices.find(x => x.id !== c.gold)?.id ?? "abstain", acceptable: [] },
        { acceptable: c.acceptable.length ? [] : c.choices.filter(x => x.id !== c.gold).map(x => x.id) },
        { split: c.split === "pilot" ? "dev" : "pilot" },
        { input: { ...c.input, name: "unrelated-name.txt", text_excerpt: "unrelated content", relative_path: "unrelated/location.txt" } },
        { ambiguity: c.ambiguity === "material" ? "none" : "material" }
      ];
      for (const mutation of [...mutations, Object.assign({}, ...mutations, { acceptable: [] })]) {
        const changed = { ...structuredClone(c), ...mutation };
        expect(projectPreferenceCase(changed)).toEqual(projectPreferenceCase(c));
        for (const arm of ["B", "C", "D"]) expect(runPreferenceArm(projectPreferenceCase(changed), arm, arm === "B" ? null : data.baseline[i])).toEqual(arms[arm][i]);
      }
      for (const field of ["gold", "acceptable", "split", "input", "ambiguity"]) expect(projectPreferenceCase(c)).not.toHaveProperty(field);
    }
  });
  it("uses dual evaluation and preserves four failures outside transition accounting", () => {
    for (const arm of ["B", "C", "D"]) {
      expect(result.summary.arms[arm].full_coverage.case_count).toBe(120);
      expect(result.summary.arms[arm].full_coverage.transition_matrix).toBe(NO_REAL_BASELINE);
    }
    expect(() => evaluatePreference(data.cases, arms.C, { realBaseline: true })).toThrow("real_baseline_missing_prediction");
    expect(result.transitions).toHaveLength(104);
    expect(result.unavailable).toHaveLength(4);
    const ids = new Set(result.transitions.map(t => t.case_id));
    for (const row of result.unavailable) {
      expect(ids.has(row.case_id)).toBe(false);
      expect(row).not.toHaveProperty("baseline_decision");
      expect(row.baseline_error).toBe("managed_ai_missing_field");
      expect(Object.keys(row.arms)).toEqual(["B", "C", "D"]);
    }
    expect(result.summary.primary_arm_c.net_benefit).toBe(result.summary.primary_arm_c.beneficial - result.summary.primary_arm_c.harmful);
    for (const row of result.transitions) expect(row.changed).toBe(row.preference_applied && row.arm_c_final_decision !== row.baseline_decision);
  });
  it("serializes identical predictions and evidence twice without answer fields", async () => {
    expect(deterministicComparison(data, identity).files).toEqual(result.files);
    const schema = JSON.parse(await readFile(new URL("../schema/preference-prediction.v1.schema.json", import.meta.url), "utf8"));
    for (const arm of ["B", "C", "D"]) {
      expect(jsonlText(arms[arm])).toBe(result.files[`arm-${arm.toLowerCase()}.jsonl`]);
      for (const p of arms[arm]) {
        expect(Object.keys(p).sort()).toEqual(schema.required.toSorted());
        for (const [key, value] of Object.entries(p)) {
          const rule = schema.properties[key];
          if (rule.const !== undefined) expect(value).toBe(rule.const);
          if (rule.enum) expect(rule.enum).toContain(value);
          if (rule.type) expect(Array.isArray(rule.type) ? rule.type : [rule.type]).toContain(value === null ? "null" : Array.isArray(value) ? "array" : typeof value === "number" && Number.isInteger(value) ? "integer" : typeof value);
        }
      }
    }
  });
  it("applies gate blocking before low delta before direction", () => {
    expect(screenDisposition(false, 30, 20, 0)).toBe("SCREEN_BLOCKED");
    expect(screenDisposition(true, 9, 9, 0)).toBe("INCONCLUSIVE_LOW_DELTA");
    expect(screenDisposition(true, 9, 0, 9)).toBe("INCONCLUSIVE_LOW_DELTA");
    expect(screenDisposition(true, 10, 5, 5)).toBe("NO_DIRECTIONAL_SIGNAL");
    expect(screenDisposition(true, 10, 6, 4)).toBe("DIRECTIONAL_SIGNAL_PRESENT");
  });
  it("checks attribution across 360 and keeps all controls visible", () => {
    expect(result.hardGates.gates.attribution.checked).toBe(360);
    expect(result.hardGates.gates.purpose_lifecycle_non_intervention.checked_predictions).toBe(36);
    for (const arm of ["B", "C", "D"]) {
      expect(Object.keys(result.summary.arms[arm].per_profile)).toHaveLength(12);
      expect(Object.values(result.summary.arms[arm].per_profile).every(s => s.case_count === 10)).toBe(true);
    }
  });
  it("blocks on a hard-gate failure without repairing predictions", () => {
    const altered = structuredClone(arms);
    const truthIndex = data.cases.findIndex(c => c.preference_context.explicit_user_truth.length > 0);
    altered.B[truthIndex].final_decision = "abstain";
    altered.B[truthIndex].evidence_ids_used = ["outside-context"];
    const blocked = compareScreen(data, altered, identity);
    expect(blocked.hardGates.gates.explicit_user_truth.pass).toBe(false);
    expect(blocked.hardGates.gates.attribution.pass).toBe(false);
    expect(blocked.summary.screen_disposition).toBe("SCREEN_BLOCKED");
    expect(JSON.parse(blocked.files["arm-b.jsonl"].trim().split("\n")[truthIndex]).evidence_ids_used).toEqual(["outside-context"]);
  });
  it("has a closed provider-free dependency graph", async () => {
    const seen = new Set();
    const allowedBuiltins = new Set(["node:fs/promises", "node:crypto", "node:child_process", "node:url"]);
    async function visit(url) {
      if (seen.has(url.href)) return;
      seen.add(url.href);
      const source = await readFile(url, "utf8");
      expect(source).not.toMatch(/DEEPSEEK_API_KEY|\bfetch\s*\(|api\.deepseek|https?\.request|\bimport\s*\(|\brequire\s*\(/iu);
      const imports = [...source.matchAll(/(?:import|export)\s+(?:[^;]*?\s+from\s+)?["']([^"']+)["']/gu)].map(m => m[1]);
      for (const specifier of imports) {
        expect(specifier).not.toMatch(/adapter|generative-contract|run-generative|check-generative|provider|http/iu);
        if (specifier.startsWith("node:")) expect(allowedBuiltins.has(specifier)).toBe(true);
        else { expect(specifier.startsWith(".")).toBe(true); await visit(new URL(specifier, url)); }
      }
      // The only subprocess calls reachable by B4 are the static git wrapper.
      if (source.includes("execFileSync")) expect(source).toMatch(/execFileSync\("git", args/);
    }
    await visit(new URL("../preference/signal/run-preference-screen.mjs", import.meta.url));
    expect(seen.size).toBeGreaterThan(5);
  });
});
