import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function runNode(args: string[]) {
  return execFileSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

describe("ZDB-03 Preference Memory research activation", () => {
  it("preserves the frozen ZDB corpus and locked test split", () => {
    const dataset = "research/zen-decision-bench/fixtures/initial-corpus.v1.jsonl";
    const manifestPath = "research/zen-decision-bench/fixtures/initial-corpus.v1.manifest.json";
    const validation = JSON.parse(runNode([
      "research/zen-decision-bench/cli/validate-dataset.mjs",
      dataset
    ]));
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

    expect(validation.valid).toBe(true);
    expect(validation.count).toBe(180);
    expect(validation.split_counts).toEqual({ pilot: 120, dev: 30, test: 30 });
    expect(validation.dataset_hash).toBe("d3f45f4922d19713d7c9d187cd66c33469322dc012599d2fde790239c27a1b68");
    expect(validation.split_hashes.test).toBe("4afd78120d8bcba042752e6b65c9028ac653580d398d14ec338664cac4375c12");
    expect(manifest.frozen).toBe(true);
    expect(manifest.test_split_locked).toBe(true);
    expect(manifest.dataset_hash).toBe(validation.dataset_hash);
    expect(manifest.test_split_hash).toBe(validation.split_hashes.test);
  });

  it("keeps preference evidence scoped away from objective safety/file-type authority", () => {
    const schema = JSON.parse(readFileSync(
      "research/zen-decision-bench/schema/preference-evidence.v1.schema.json",
      "utf8"
    ));

    expect(schema.properties.schema_version.const).toBe("zdb.preference_evidence.v1");
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.kind.enum).toEqual([
      "passive_acceptance",
      "explicit_selection",
      "explicit_correction",
      "explicit_rejection"
    ]);
    expect(schema.properties.task.enum).toEqual([
      "purpose",
      "lifecycle",
      "suggested_action",
      "existing_folder_choice"
    ]);
    expect(schema.properties.task.enum).not.toContain("domain_type");
    expect(schema.properties.task.enum).not.toContain("risk_level");
    expect(schema.properties.observed_at.format).toBe("date-time");
    expect(schema.properties.scope.minProperties).toBe(1);
    expect(schema.properties.scope.properties.global_user.const).toBe(true);
    expect(schema.properties).not.toHaveProperty("conflict_state");

    const contextSchema = JSON.parse(readFileSync(
      "research/zen-decision-bench/schema/preference-context.v1.schema.json",
      "utf8"
    ));
    expect(contextSchema.properties.schema_version.const).toBe("zdb.preference_context.v1");
    expect(contextSchema.required).toEqual([
      "schema_version",
      "context_id",
      "target_task",
      "target_at",
      "cold_start",
      "preference_evidence",
      "explicit_user_truth",
      "deterministic_rules",
      "provenance"
    ]);
    expect(contextSchema.properties).not.toHaveProperty("conflict_state");
    expect(contextSchema.properties).not.toHaveProperty("final_decision");
    expect(contextSchema.$defs.scope.properties.global_user.const).toBe(true);
    expect(contextSchema.allOf).toEqual([
      {
        if: { properties: { cold_start: { const: true } }, required: ["cold_start"] },
        then: { properties: { preference_evidence: { maxItems: 0 } } }
      },
      {
        if: { properties: { cold_start: { const: false } }, required: ["cold_start"] },
        then: { properties: { preference_evidence: { minItems: 1 } } }
      }
    ]);
  });

  it("freezes authority, chronology, safety, attribution and anti-leakage semantics", () => {
    const activation = readFileSync(
      "docs/project/tasks/ZDB-03-PREFERENCE-MEMORY-OFFLINE-HYPOTHESIS-ACTIVATION.md",
      "utf8"
    );

    for (const required of [
      "Explicit User Truth != Preference != Rule",
      "Only evidence observed before",
      "No evidence means no inferred preference.",
      "explicit-truth violations",
      "safety-boundary violations",
      "existing_folder_choice",
      "suggested_action",
      "Preference Net Benefit",
      "baseline correct -> preference wrong",
      "baseline abstain -> unsafe preference guess",
      "comparative corpus >= 300 adjudicated cases",
      "ZDB-04+ remain **NOT ACTIVE**"
    ]) {
      expect(activation).toContain(required);
    }

    expect(activation).toContain("Preference is not an instruction");
    expect(activation).toContain("NOT PRODUCTION AUTHORITY");
    expect(activation).toContain("Future corrections must never leak backward.");
    expect(activation).toContain("derived aggregate state over a Preference Context");
    expect(activation).toContain("must **not** contain a precomputed preference recommendation");
    expect(activation).toContain("Preference must not rewrite objective facts");
    expect(activation).toContain("real personal filesystem history");
  });

  it("records ZDB-03 as research-only in Phase 1 and repository-facing docs", () => {
    const phase = readFileSync(
      "docs/project/research/zen-decision-bench/PHASE1-CONTRACT.md",
      "utf8"
    );
    const researchReadme = readFileSync(
      "research/zen-decision-bench/README.md",
      "utf8"
    );
    const preferenceReadme = readFileSync(
      "research/zen-decision-bench/preference/README.md",
      "utf8"
    );

    expect(phase).toContain("ZDB-03 OFFLINE RESEARCH ACTIVE");
    expect(phase).toContain("Preference may not lower deterministic safety");
    expect(researchReadme).toContain("ZDB-03 Preference Memory Offline Hypothesis — **ACTIVE FOR RESEARCH ONLY**");
    expect(researchReadme).toContain("Explicit User Truth != Preference != Rule");
    expect(preferenceReadme).toContain("No production authority");
    expect(preferenceReadme).toContain("existing_folder_choice");
    expect(preferenceReadme).toContain("suggested_action");
  });
});
