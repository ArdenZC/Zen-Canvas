import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import { sha256, stableJson } from "../src/core.mjs";
import { scopeMatches, validatePreferenceCase } from "../preference/src/validate-context.mjs";
import { assembleCorpus, loadFrozenInputs, orderChoices, selectHistory, writeCorpus, FROZEN_INPUTS } from "../preference/signal/assemble-signal-corpus.mjs";
import { validateCorpus, validateSavedCorpus } from "../preference/signal/validate-signal-corpus.mjs";
const inputs = await loadFrozenInputs();
const cases = assembleCorpus(inputs);
const copy = structuredClone;
const same = (a, b) => stableJson(a) === stableJson(b);
const publicProjection = c => ({ task: c.task, input: c.input, choices: c.choices });
describe("B2C mechanical assembly only", () => {
  it("pins all five source identities and the candidate hashes", async () => {
    expect(Object.values(FROZEN_INPUTS).map(x => x[0])).toEqual([
      "371519fe7c9f28d3c686e0299c223d64a57b00571777cab498668667498137b1", "96f975ef10148a49f47068c578dd76ccd69ab3cf3f81167de2e227de32b735c4",
      "4833443e85bf2a69c74b175b8e618a98eebab6444f1da05418fbf926582d6a0b", "c2be8a2949c0daef12fe821010b72ca84ef999deb941a6f8bd0505dc8a7e2f44",
      "498a511c4cfba87daaed7db5197c35aed96de34862feede43c500d9eb5d3ad50"]);
    for (const [name, hashes] of Object.entries(FROZEN_INPUTS)) expect(sha256(inputs[name])).toBe(hashes[0]);
    const summary = await validateSavedCorpus();
    expect(summary.canonical_sha256).toBe("0a96faa752b488f9c507ee2d0ca64e439820f85697872a64a5972c2840693349");
    expect(summary.file_sha256).toBe("e10cd216a0f6692511ec0049dccf37b51f306bd39625b858efcbac35ebac3c8a");
  });
  it("validates exact case inventory, contracts, task counts and taxonomy", () => {
    const result = validateCorpus(cases, inputs);
    expect(cases.length).toBe(120);
    expect(cases.every(c => validatePreferenceCase(c).length === 0)).toBe(true);
    expect(result.task_counts).toEqual({ existing_folder_choice: 72, suggested_action: 36, purpose: 6, lifecycle: 6 });
    expect(result.cold_start_count).toBe(55); expect(result.non_cold_count).toBe(65);
    expect(result.cold_start_taxonomy).toEqual({ designated_novel_workspace: 12, non_intervention_no_history_task: 12, incidental_finite_choice_filtered: 31, unexplained_scope_or_other: 0 });
    expect(result.cold_start_task_counts).toEqual({ existing_folder_choice: 39, suggested_action: 4, purpose: 6, lifecycle: 6 });
    expect(result.explicit_truth_count).toBe(6); expect(result.safety_rule_count).toBe(6);
    expect(result.missing_correction_references).toBe(0);
  });
  it("proves pre-choice scope matching and zero representability for all 31 incidental cases", () => {
    let incidental = 0;
    for (const c of cases) {
      const t = inputs.targets.find(t => t.case_id === c.case_id);
      if (!c.preference_context.cold_start || t.scope_template.workspace_mode !== "assigned_profile_primary" || t.task !== "existing_folder_choice") continue;
      const pid = inputs.assignment.find(a => a.case_id === c.case_id).profile_id;
      const before = inputs.history.filter(h => h.profile_id === pid && h.evidence.task === t.task &&
        Date.parse(h.evidence.observed_at) < Date.parse(t.target_at) && scopeMatches(h.evidence.scope, c.context.preference_target_scope));
      expect(before.length > 0).toBe(true);
      expect(before.every(h => !t.choices.some(x => x.id === h.evidence.decision))).toBe(true);
      incidental++;
    }
    expect(incidental).toBe(31);
  });
  it("independently derives choice ordering and preserves other task orders", () => {
    for (const t of inputs.targets) {
      const original = copy(t.choices);
      const expected = t.task === "existing_folder_choice" ? [...original].sort((a, b) => {
        const key = id => sha256(`zdb-03b-choice-order-v1|96f975ef10148a49f47068c578dd76ccd69ab3cf3f81167de2e227de32b735c4|${t.case_id}|${id}`);
        return key(a.id) < key(b.id) ? -1 : 1;
      }) : original;
      expect(same(orderChoices(t), expected)).toBe(true);
      expect(same(t.choices, original)).toBe(true);
    }
  });
  it("is deterministic across all input file orders and does not mutate sources", () => {
    const before = stableJson(inputs);
    const reversed = Object.fromEntries(Object.entries(inputs).map(([k, rows]) => [k, [...rows].reverse()]));
    expect(same(assembleCorpus(reversed), cases)).toBe(true);
    expect(stableJson(inputs)).toBe(before);
  });
  it("isolates every answer/rationale/authority mutation from scope, choices and context", () => {
    const altered = copy(inputs);
    altered.adjudication.forEach(a => {
      a.gold = "abstain"; a.acceptable = []; a.abstain_allowed = true;
      a.rationale = "test-only changed answer provenance"; a.adjudication_rationale = "changed";
      a.profile_tendency_ids_consulted = ["changed"]; a.authority_basis = "changed"; a.authority_refs = ["changed"];
    });
    const changed = assembleCorpus(altered);
    expect(same(changed.map(({ gold, acceptable, abstain_allowed, ...rest }) => rest), cases.map(({ gold, acceptable, abstain_allowed, ...rest }) => rest))).toBe(true);
    expect(changed.every(c => c.gold === "abstain" && c.abstain_allowed && c.acceptable.length === 0)).toBe(true);
  });
  it("isolates History mutations from the test-only provider-facing projection", () => {
    const changed = copy(inputs);
    changed.history = []; // Changes all contexts while preserving current-file metadata and finite choices.
    const altered = assembleCorpus(changed);
    expect(same(altered.map(publicProjection), cases.map(publicProjection))).toBe(true);
    expect(altered.every(c => c.preference_context.cold_start)).toBe(true);
    expect(() => validateCorpus(altered, changed)).toThrow("coverage_55_65");
  });
  it("never consumes Profile tendencies or adjudication provenance", () => {
    const poison = copy(inputs);
    for (const p of poison.profiles) for (const key of ["brief", "tendencies", "context_tags", "preferred_value"]) {
      Object.defineProperty(p, key, { get() { throw new Error("forbidden_profile_read"); } });
    }
    for (const a of poison.adjudication) for (const key of ["rationale", "authority_basis", "authority_refs", "profile_tendency_ids_consulted", "adjudicated_by", "adjudication_blindness"]) {
      Object.defineProperty(a, key, { get() { throw new Error("forbidden_adjudication_read"); } });
    }
    expect(same(assembleCorpus(poison), cases)).toBe(true);
    expect(/"(?:profile_id|primary_workspace_id|preferred_value|context_tags|authority_basis|authority_refs|adjudicated_by|adjudication_blindness|recommendation|support_level|provider_prediction)"/u.test(JSON.stringify(cases))).toBe(false);
  });
  it("fails closed on orphaned correction references without repairing evidence", () => {
    const c = cases.find(c => c.preference_context.preference_evidence.some(e => e.kind === "explicit_correction"));
    const t = inputs.targets.find(t => t.case_id === c.case_id);
    const pid = inputs.assignment.find(a => a.case_id === t.case_id).profile_id;
    const history = copy(inputs.history);
    history.find(h => h.profile_id === pid && h.evidence.kind === "explicit_correction").evidence.correction_of = ["missing"];
    expect(() => selectHistory(t, pid, c.context.preference_target_scope, history)).toThrow("missing_correction_reference");
  });
  it("rejects case metadata leakage and altered scopes/evidence/order", () => {
    for (const mutate of [x => x[0].profile_id = "forbidden", x => x[0].context.preference_target_scope.workspace = "wrong",
      x => x.reverse(), x => x.pop(), x => x.find(c => c.preference_context.preference_evidence.length).preference_context.preference_evidence.pop()]) {
      const bad = copy(cases); mutate(bad); expect(() => validateCorpus(bad, inputs)).toThrow();
    }
  });
  it("retains frozen Owner state and refuses overwrite", async () => {
    await expect(writeCorpus()).rejects.toThrow("corpus_artifact_already_exists");
    const m = JSON.parse(await readFile(new URL("../preference/signal/signal-corpus.v1.manifest.json", import.meta.url), "utf8"));
    expect(m.status).toBe("FROZEN — OWNER REVIEW PASSED / AUTHORIZED FOR ZDB-03B3 INPUT");\n    expect(m.owner_freeze.accepted_content_head).toBe("f1aa255d17f7b6f4749631096332549a5b7fd58b");\n    expect(m.owner_freeze.corpus_git_blob).toBe("0e483df2063acbc07ee599e3caa379f4a6f404bf");
  });
  it("has a closed research-only dependency graph without network/credentials/resolver", async () => {
    const visited = new Set();
    async function visit(url) {
      if (visited.has(url.href)) return;
      visited.add(url.href);
      const source = await readFile(url, "utf8");
      const ast = ts.createSourceFile(url.href, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
      const local = [];
      function walk(n) {
        if (ts.isImportDeclaration(n)) {
          const spec = n.moduleSpecifier.text;
          expect(/resolver|evaluate|provider|src-tauri|build-history|build-assignment/u.test(spec)).toBe(false);
          if (spec.startsWith("node:")) expect(["node:fs/promises", "node:crypto", "node:url"]).toContain(spec);
          else local.push(new URL(spec, url));
        }
        if (ts.isCallExpression(n)) expect(n.expression.kind === ts.SyntaxKind.ImportKeyword || /^(?:fetch|eval|Function|require)$/u.test(n.expression.getText(ast))).toBe(false);
        if (ts.isPropertyAccessExpression(n)) expect(n.getText(ast).startsWith("process.env")).toBe(false);
        ts.forEachChild(n, walk);
      }
      walk(ast);
      for (const child of local) await visit(child);
    }
    await visit(new URL("../preference/signal/assemble-signal-corpus.mjs", import.meta.url));
    expect(visited.size).toBe(4);
  });
});
