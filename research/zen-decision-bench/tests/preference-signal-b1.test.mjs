import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { readJsonl, sha256, validateDataset, caseContentFingerprint } from "../src/core.mjs";
import { buildProfiles } from "../preference/signal/build-profiles.mjs";
import { buildTargets } from "../preference/signal/build-targets.mjs";
import { analyzeProfiles, analyzeTargets, validateSavedPacks } from "../preference/signal/validate-packs.mjs";
import { FOLDERS, ACTIONS, PURPOSES, LIFECYCLES, SIGNAL_SCOPE_FAMILIES, NON_INTERVENTION_SCOPE_FAMILIES } from "../preference/signal/vocabulary.mjs";

const profilePath = new URL("../preference/signal/profiles.v1.jsonl", import.meta.url);
const targetPath = new URL("../preference/signal/targets.v1.jsonl", import.meta.url);
const profiles = await readJsonl(profilePath);
const targets = await readJsonl(targetPath);
const legacy = await readJsonl(new URL("../fixtures/preference-stage-a.v1.jsonl", import.meta.url));
const clone = (value) => structuredClone(value);

describe("ZDB-03B1 independent synthetic packs", () => {
  it("freezes one bounded shared signal vocabulary and separate control families", () => {
    expect(SIGNAL_SCOPE_FAMILIES).toEqual([
      "authored_learning", "received_learning", "active_work", "completed_work", "reusable_reference", "personal_admin",
      "financial_documents", "media_assets", "ambiguous_inbox", "project_reference", "teaching_study_crossover", "stale_material"
    ]);
    expect(NON_INTERVENTION_SCOPE_FAMILIES).toEqual(["purpose_control", "lifecycle_control"]);
    expect(new Set([...SIGNAL_SCOPE_FAMILIES, ...NON_INTERVENTION_SCOPE_FAMILIES]).size).toBe(14);
  });
  it("binds the committed artifacts to deterministic, separate builders and manifests", async () => {
    const result = await validateSavedPacks();
    expect(result.valid, result.profiles.issues.concat(result.targets.issues).join("\n")).toBe(true);
    expect(sha256(buildProfiles())).toBe(sha256(profiles));
    expect(sha256(buildTargets())).toBe(sha256(targets));
    expect(result.profiles.count).toBe(12);
    expect(result.targets.count).toBe(120);
    expect(result.profiles.workspace_unique).toBe(true);
  });

  it("has 12 distinct soft profiles with four folder and three action tendencies each", () => {
    expect(profiles.map((p) => p.profile_id)).toEqual(Array.from({ length: 12 }, (_, i) => `profile-${String(i + 1).padStart(2, "0")}`));
    expect(new Set(profiles.map((p) => p.primary_workspace_id)).size).toBe(12);
    expect(new Set(profiles.map((p) => sha256(p.tendencies))).size).toBe(12);
    for (const profile of profiles) {
      expect(profile.tendencies.filter((t) => t.task === "existing_folder_choice")).toHaveLength(4);
      expect(profile.tendencies.filter((t) => t.task === "suggested_action")).toHaveLength(3);
      expect(profile.exceptions.length).toBeGreaterThanOrEqual(1);
      expect(profile.provenance.category).toBe("synthetic");
      for (const tendency of profile.tendencies) {
        const allowed = tendency.task === "existing_folder_choice" ? Object.keys(FOLDERS) : ACTIONS.map(({ id }) => id);
        expect(allowed).toContain(tendency.preferred_value);
        expect(tendency.contrasted_values.every((value) => allowed.includes(value))).toBe(true);
        expect(["usually", "often", "tends_to"]).toContain(tendency.qualifier);
        expect(SIGNAL_SCOPE_FAMILIES).toContain(tendency.scope_parent_family);
      }
      for (const task of ["existing_folder_choice", "suggested_action"]) {
        const scoped = profile.tendencies.filter((t) => t.task === task);
        expect(new Set(scoped.map((t) => t.scope_parent_family)).size).toBe(scoped.length);
      }
      expect(JSON.stringify(profile)).not.toMatch(/zdb03b-target-|prefa-|"(?:gold|weight|confidence|probability)"/iu);
    }
  });

  it("rejects profile answer leakage, invalid values, numeric strength and missing character", () => {
    const data = clone(profiles);
    data[0].gold = "teaching";
    expect(analyzeProfiles(data).issues).toContain("profile:1:extra:gold");
    delete data[0].gold;
    data[0].tendencies[0].preferred_value = "folder_1";
    expect(analyzeProfiles(data).issues).toContain("profile:1:tendency:1:vocabulary");
    data[0].tendencies[0].preferred_value = "teaching";
    data[0].tendencies[0].weight = 4;
    expect(analyzeProfiles(data).issues.some((issue) => issue.includes("weight"))).toBe(true);
    delete data[0].tendencies[0].weight;
    data[0].tendencies = data[0].tendencies.filter((t) => t.task !== "suggested_action");
    expect(analyzeProfiles(data).issues).toContain("profile:1:tendency_minimum");
  });

  it("rejects missing, unknown, and conflicting exact tendency families", () => {
    const data = clone(profiles);
    delete data[0].tendencies[0].scope_parent_family;
    expect(analyzeProfiles(data).issues).toContain("profile:1:tendency:1:missing:scope_parent_family");
    data[0] = clone(profiles[0]);
    data[0].tendencies[0].scope_parent_family = "invented_family";
    expect(analyzeProfiles(data).issues).toContain("profile:1:tendency:1:scope_family");
    data[0] = clone(profiles[0]);
    data[0].tendencies[1].scope_parent_family = data[0].tendencies[0].scope_parent_family;
    expect(analyzeProfiles(data).issues).toContain("profile:1:tendency:2:family_preference_conflict");
    data[0] = clone(profiles[0]);
    data[0].tendencies[0].context_tags = ["human_description_only"];
    expect(analyzeProfiles(data).valid).toBe(true);
    expect(data[0].tendencies[0].scope_parent_family).toBe(profiles[0].tendencies[0].scope_parent_family);
  });

  it("has exact 120-case IDs, tasks, controls, and neutral symbolic workspaces", () => {
    const result = analyzeTargets(targets, legacy);
    expect(result.valid, result.issues.join("\n")).toBe(true);
    expect(targets.map((t) => t.case_id)).toEqual(Array.from({ length: 120 }, (_, i) => `zdb03b-target-${String(i + 1).padStart(3, "0")}`));
    expect(result.task_counts).toEqual({ existing_folder_choice: 72, lifecycle: 6, purpose: 6, suggested_action: 36 });
    expect(result.control_counts).toEqual({ cold_start_candidate: 12, explicit_truth_control: 6, non_intervention_control: 12, ordinary_preference_signal: 84, safety_control: 6 });
    expect(targets.filter((t) => t.control_class === "cold_start_candidate").every((t) => t.scope_template.workspace_mode === "assigned_profile_novel" && !t.explicit_user_truth && !t.deterministic_rule)).toBe(true);
    expect(targets.filter((t) => t.control_class !== "cold_start_candidate").every((t) => t.scope_template.workspace_mode === "assigned_profile_primary")).toBe(true);
    expect(targets.filter((t) => t.control_class === "explicit_truth_control")).toHaveLength(6);
    expect(targets.filter((t) => t.control_class === "safety_control").every((t) => t.deterministic_rule.decision === "review" && t.task === "suggested_action")).toBe(true);
    expect(targets.filter((t) => ["purpose", "lifecycle"].includes(t.task)).every((t) => t.control_class === "non_intervention_control")).toBe(true);
    expect(targets.filter((t) => ["existing_folder_choice", "suggested_action"].includes(t.task)).every((t) => SIGNAL_SCOPE_FAMILIES.includes(t.scope_template.parent_family) && t.scope_template.parent_family === t.authoring_tags[0])).toBe(true);
    expect(targets.filter((t) => ["purpose", "lifecycle"].includes(t.task)).every((t) => NON_INTERVENTION_SCOPE_FAMILIES.includes(t.scope_template.parent_family) && t.scope_template.parent_family === `${t.task}_control`)).toBe(true);
    expect(SIGNAL_SCOPE_FAMILIES.every((family) => result.scope_family_counts[family] === 9)).toBe(true);
  });

  it("uses target-relative mtime ages with recent, intermediate, and old situations", () => {
    const result = analyzeTargets(targets);
    expect(result.age_band_counts).toEqual({ recent_0_to_30_days: 48, intermediate_31_to_180_days: 51, old_over_180_days: 21 });
    expect([result.age_days_min, result.age_days_max]).toEqual([1, 510]);
    const age = (target) => (Date.parse(target.target_at) / 1000 - target.input.modified_at_fs) / 86400;
    const named = (name) => targets.find((target) => target.input.name === name);
    expect(age(named("working-brief.docx"))).toBe(4);
    expect(age(named("new-reading-packet.pdf"))).toBe(1);
    expect(age(named("old-onboarding-guide.pdf"))).toBe(400);
    expect(age(named("superseded-budget.xlsx"))).toBe(275);
    for (const target of targets) {
      if (/(^|[-_])(new|open|working|active|live|current|in-progress)([-_.]|$)/iu.test(target.input.name)) expect(age(target)).toBeLessThanOrEqual(30);
      if (/(^|[-_])(old|older|stale|retired|previous-year|expired|superseded)([-_.]|$)/iu.test(target.input.name)) expect(age(target)).toBeGreaterThan(180);
    }
    expect(targets.every((target) => target.input.modified_at_fs < Date.parse(target.target_at) / 1000)).toBe(true);
    const data = clone(targets);
    data[0].input.modified_at_fs = Math.floor(Date.parse(data[0].target_at) / 1000) + 86400;
    expect(analyzeTargets(data).issues).toContain("target:1:age_days");
    data[0].input.modified_at_fs = Math.floor(Date.parse(data[0].target_at) / 1000);
    expect(analyzeTargets(data).issues).toContain("target:1:age_days");
    data[0] = clone(targets[0]);
    const recentIndex = targets.findIndex((target) => target.input.name === "new-reading-packet.pdf");
    data[recentIndex].input.modified_at_fs -= 365 * 86400;
    expect(analyzeTargets(data).issues).toContain(`target:${recentIndex + 1}:recent_name_age`);
    data[recentIndex] = clone(targets[recentIndex]);
    const staleIndex = targets.findIndex((target) => target.input.name === "old-onboarding-guide.pdf");
    data[staleIndex].input.modified_at_fs += 365 * 86400;
    expect(analyzeTargets(data).issues).toContain(`target:${staleIndex + 1}:old_name_age`);
  });

  it("uses transferable folder IDs, canonical action ordering, and diverse choice sets", () => {
    const folders = targets.filter((t) => t.task === "existing_folder_choice");
    expect(folders).toHaveLength(72);
    expect(new Set(folders.flatMap((t) => t.choices.map((c) => c.id)))).toEqual(new Set(Object.keys(FOLDERS)));
    expect(folders.every((t) => [3, 4].includes(t.choices.length) && JSON.stringify(t.choices.map((c) => c.id)) === JSON.stringify(t.choices.map((c) => c.id).sort()))).toBe(true);
    expect(Math.max(...Object.values(analyzeTargets(targets).folder_choice_set_frequency))).toBeLessThanOrEqual(12);
    for (const task of ["suggested_action", "purpose", "lifecycle"]) {
      const expected = { suggested_action: ACTIONS, purpose: PURPOSES, lifecycle: LIFECYCLES }[task];
      expect(targets.filter((t) => t.task === task).every((t) => JSON.stringify(t.choices) === JSON.stringify(expected))).toBe(true);
    }
  });

  it("rejects target answer, profile, context, choice-order, and control leakage", () => {
    const data = clone(targets);
    data[0].gold = "teaching";
    expect(analyzeTargets(data).issues).toContain("target:1:extra:gold");
    delete data[0].gold;
    data[0].profile_id = "profile-01";
    expect(analyzeTargets(data).issues.some((issue) => issue.includes("profile_id"))).toBe(true);
    delete data[0].profile_id;
    data[0].preference_context = {};
    expect(analyzeTargets(data).issues.some((issue) => issue.includes("preference_context"))).toBe(true);
    delete data[0].preference_context;
    data[0].choices.reverse();
    expect(analyzeTargets(data).issues).toContain("target:1:folder_order");
    data[0] = clone(targets[0]);
    data[5].scope_template.workspace_mode = "assigned_profile_primary";
    expect(analyzeTargets(data).issues).toContain("target:6:cold_start");
    data[5] = clone(targets[5]);
    data[0].scope_template.parent_family = "neutral_inbox";
    expect(analyzeTargets(data).issues).toContain("target:1:scope_family_mismatch");
  });

  it("keeps content fingerprints distinct from each other and frozen ZDB-03A cases", () => {
    const fingerprints = targets.map((t) => caseContentFingerprint({ task: t.task, input: t.input, context: { scope_template: t.scope_template }, choices: t.choices }));
    expect(new Set(fingerprints).size).toBe(120);
    const old = new Set(legacy.map(caseContentFingerprint));
    expect(fingerprints.every((f) => !old.has(f))).toBe(true);
    expect(targets.every((t) => !t.input.parent.includes("/Teaching") && !t.input.parent.includes("/Study"))).toBe(true);
  });

  it("enforces answer-free bounded schemas", async () => {
    const profileSchema = JSON.parse(await readFile(new URL("../schema/preference-signal-profile.v1.schema.json", import.meta.url), "utf8"));
    const targetSchema = JSON.parse(await readFile(new URL("../schema/preference-signal-target.v1.schema.json", import.meta.url), "utf8"));
    expect(profileSchema.additionalProperties).toBe(false);
    expect(targetSchema.additionalProperties).toBe(false);
    expect(Object.values(targetSchema.$defs).every((definition) => definition.additionalProperties === false)).toBe(true);
    for (const key of ["gold", "acceptable", "abstain_allowed", "expected", "profile_id", "preference_context", "preference_evidence", "history", "provider_prediction"]) {
      expect(targetSchema.properties).not.toHaveProperty(key);
    }
    expect(new RegExp(targetSchema.properties.case_id.pattern).test("zdb03b-target-120")).toBe(true);
    expect(profileSchema.$defs.tendency.required).toContain("scope_parent_family");
    expect(profileSchema.$defs.tendency.properties.scope_parent_family.enum).toEqual(SIGNAL_SCOPE_FAMILIES);
    expect(targetSchema.$defs.scope_template.properties.parent_family.enum).toEqual([...SIGNAL_SCOPE_FAMILIES, ...NON_INTERVENTION_SCOPE_FAMILIES]);
  });

  it("proves builder source separation from counterpart packs and later evidence", async () => {
    const profileSource = await readFile(new URL("../preference/signal/build-profiles.mjs", import.meta.url), "utf8");
    const targetSource = await readFile(new URL("../preference/signal/build-targets.mjs", import.meta.url), "utf8");
    expect(profileSource).not.toMatch(/build-targets|targets\.v1|zdb03b-target-|readFile|createReadStream|fetch\(|process\.env|prefa-|stage-a|\.gold\b/iu);
    expect(targetSource).not.toMatch(/build-profiles|profiles\.v1|profile-[0-9][0-9]|readFile|createReadStream|fetch\(|process\.env|prefa-|stage-a|\.gold\b/iu);
    expect(profileSource).not.toMatch(/(?:from\s+["']|new URL\()[^\n]*(?:history|adjudication|provider|prediction)/iu);
    expect(targetSource).not.toMatch(/(?:from\s+["']|new URL\()[^\n]*(?:history|adjudication|provider|prediction)/iu);
    expect(profileSource).not.toMatch(/context_tags\s*\.|context_tags\s*\[/iu);
    expect(targetSource).not.toMatch(/context_tags/iu);
  });

  it("preserves the locked ZDB-01 and ZDB-03A canonical hashes", async () => {
    const original = await readJsonl(new URL("../fixtures/initial-corpus.v1.jsonl", import.meta.url));
    expect(validateDataset(original).dataset_hash).toBe("d3f45f4922d19713d7c9d187cd66c33469322dc012599d2fde790239c27a1b68");
    expect(sha256(original.filter((record) => record.split === "test"))).toBe("4afd78120d8bcba042752e6b65c9028ac653580d398d14ec338664cac4375c12");
    expect(sha256(legacy)).toBe("76abcb22ac4b2aa2f0bc032839fe643a296d25f2f19b266ace16b3f76df1112a");
  });
});
