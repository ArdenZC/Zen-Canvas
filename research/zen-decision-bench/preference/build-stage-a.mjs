#!/usr/bin/env node
// Reproducible synthetic conformance fixture only. Historical choices and
// expected outputs share a positional template, so this is not signal evidence.
// No frozen ZDB case or provider result is read. Do not rerun after corpus freeze.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { sha256, validateDataset } from "../src/core.mjs";

const families = [
  "cold_start", "consistent_preference", "single_correction", "repeated_correction",
  "scope_conflict", "recency_conflict", "equal_conflict", "sparse_evidence",
  "safety_conflict", "explicit_truth_conflict"
];
const source = { category: "synthetic", source: "zdb-03a-stage-a-authored-scenarios" };
const targetAt = "2026-09-20T12:00:00.000Z";
const when = (day) => `2026-09-${String(day).padStart(2, "0")}T12:00:00.000Z`;
const tasks = {
  existing_folder_choice: ["course_folder", "shared_folder", "archive_folder"],
  suggested_action: ["keep", "archive", "review"],
  purpose: ["teaching", "reference", "client"],
  lifecycle: ["active", "completed", "archived"]
};

function taskFor(familyIndex, variant) {
  if (familyIndex < 6) {
    if (variant < 3) return "existing_folder_choice";
    if (variant < 5) return "suggested_action";
    return familyIndex % 2 === 0 ? "purpose" : "lifecycle";
  }
  const folderCount = familyIndex < 8 ? 5 : 4;
  return variant < folderCount ? "existing_folder_choice" : "suggested_action";
}

function makeCase(family, familyIndex, variant) {
  const task = taskFor(familyIndex, variant);
  const caseId = `prefa-${familyIndex + 1}-${variant + 1}`;
  const [broad, preferred, third] = tasks[task];
  const workspace = `stage-a-project-${familyIndex + 1}-${variant + 1}`;
  const narrow = { workspace, task_family: task };
  const targetScope = { ...narrow, purpose: variant % 2 ? "teaching" : "reference" };
  const evidence = [];
  const truth = [];
  const rules = [];
  const add = (kind, decision, day, scope = narrow, correctionOf = undefined) => {
    const record = {
      schema_version: "zdb.preference_evidence.v1",
      evidence_id: `${caseId}-e${evidence.length + 1}`,
      kind, task, decision, scope, observed_at: when(day), provenance: source
    };
    if (correctionOf) record.correction_of = correctionOf;
    evidence.push(record);
    return record.evidence_id;
  };
  const passive = (choice, days, scope = narrow) => days.map((day) => add("passive_acceptance", choice, day, scope));
  const select = (choice, days, scope = narrow) => days.map((day) => add("explicit_selection", choice, day, scope));
  let expected = preferred;
  let narrative;

  switch (family) {
    case "cold_start":
      narrative = "A newly opened project has no recorded prior choice for this decision.";
      expected = "abstain";
      if (variant === 1) {
        truth.push({ truth_id: `${caseId}-truth`, task, decision: preferred, scope: narrow, asserted_at: when(20) });
        expected = preferred;
        narrative += " The user directly stated the current destination.";
      } else if (variant === 2) {
        rules.push({ rule_id: `${caseId}-rule`, authority: "user_rule", task, decision: preferred, scope: narrow, asserted_at: when(20) });
        expected = preferred;
        narrative += " An existing user-authored deterministic rule applies.";
      }
      break;
    case "consistent_preference":
      narrative = "Earlier comparable items in this project repeatedly went to the same choice.";
      if (variant % 2) passive(preferred, [3, 6, 9]);
      else select(preferred, [6, 9]);
      break;
    case "single_correction": {
      narrative = "Several older acceptances were later explicitly corrected in this project.";
      const old = passive(broad, [2, 4, 6, 8, 10]);
      add("explicit_correction", preferred, 15, narrow, old);
      break;
    }
    case "repeated_correction": {
      narrative = "Two direct corrections identify older project choices as mistaken.";
      const old = passive(broad, [2, 4, 6, 8, 10]);
      add("explicit_correction", preferred, 14, narrow, old.slice(0, 3));
      add("explicit_correction", preferred, 16, narrow, old.slice(3));
      break;
    }
    case "scope_conflict":
      narrative = "A broad historical habit differs from observations inside this project.";
      passive(broad, [2, 5, 8], { global_user: true });
      select(preferred, variant === 1 ? [13] : [13, 15]);
      if (variant === 1) expected = "abstain";
      break;
    case "recency_conflict": {
      narrative = "A late linked correction changes the meaning of older repeated choices.";
      const old = passive(broad, [2, 5, 8, 10]);
      add("explicit_correction", preferred, 18, narrow, old);
      break;
    }
    case "equal_conflict":
      narrative = "The project has comparable, unlinked positive observations for two choices.";
      select(broad, [3, 9]);
      select(preferred, [5, 11]);
      expected = "abstain";
      break;
    case "sparse_evidence":
      narrative = "The only available history is too sparse or purely negative.";
      if (variant === 0) add("explicit_rejection", broad, 10);
      else if (variant % 2) select(preferred, [10]);
      else passive(preferred, variant === 2 ? [8, 10] : [10]);
      expected = "abstain";
      break;
    case "safety_conflict":
      narrative = "The user's historical tendency meets an existing safety restriction.";
      select(preferred, [6, 10]);
      rules.push({ rule_id: `${caseId}-safety`, authority: "safety_rule", task, decision: third, scope: narrow, asserted_at: when(19) });
      expected = third;
      break;
    case "explicit_truth_conflict":
      narrative = "A direct current statement contradicts a historical preference.";
      select(preferred, [5, 9]);
      truth.push({ truth_id: `${caseId}-truth`, task, decision: broad, scope: narrow, asserted_at: when(19) });
      if (variant === 1) rules.push({ rule_id: `${caseId}-rule`, authority: "user_rule", task, decision: preferred, scope: narrow, asserted_at: when(18) });
      expected = broad;
      break;
  }

  return {
    schema_version: "zdb.case.v1", case_id: caseId, task,
    input: { narrative, target_item: `synthetic-item-${familyIndex + 1}-${variant + 1}`, item_type: task === "existing_folder_choice" ? "document" : "mixed" },
    context: { preference_target_scope: targetScope },
    choices: tasks[task].map((id) => ({ id, label: id.replaceAll("_", " ") })),
    gold: expected, abstain_allowed: expected === "abstain", ambiguity: expected === "abstain" ? "material" : "bounded",
    preference_context: {
      schema_version: "zdb.preference_context.v1", context_id: `${caseId}-context`, target_task: task,
      target_at: targetAt, cold_start: evidence.length === 0, preference_evidence: evidence,
      explicit_user_truth: truth, deterministic_rules: rules, provenance: source
    },
    provenance: source, split: variant < 4 ? "pilot" : "dev", tags: ["zdb-03a", family, "synthetic"]
  };
}

const records = families.flatMap((family, index) => Array.from({ length: 6 }, (_, variant) => makeCase(family, index, variant)));
const validation = validateDataset(records);
if (!validation.valid) throw new Error(`stage_a_invalid:${JSON.stringify(validation.issues)}`);
const counts = Object.fromEntries(families.map((family) => [family, records.filter((record) => record.tags.includes(family)).length]));
const outputPath = fileURLToPath(new URL("../fixtures/preference-stage-a.v1.jsonl", import.meta.url));
const data = records.map((record) => JSON.stringify(record)).join("\n") + "\n";
const manifest = {
  schema_version: "zdb.preference_stage_a_manifest.v1", corpus_file: "preference-stage-a.v1.jsonl",
  status: "CONFORMANCE-ONLY — NOT ELIGIBLE FOR ZDB-03B SIGNAL/EFFECTIVENESS EVIDENCE",
  owner_review: "RE-REVIEW PENDING AFTER REQUIRED CHANGES", frozen: false,
  case_count: records.length, split_counts: validation.split_counts, task_counts: validation.task_counts,
  scenario_family_counts: counts, dataset_hash: validation.dataset_hash,
  file_sha256: createHash("sha256").update(data).digest("hex"),
  creation_commit: null,
  research_only: true, superiority_evidence: false,
  eligible_for_zdb_03b_signal: false, eligible_for_effectiveness_evidence: false,
  accepted_purpose: ["schema_validity", "chronology", "cold_start", "scope_resolution", "correction_semantics", "rejection_semantics", "authority_precedence", "conflict_handling", "attribution", "evaluator_accounting", "gold_isolation"],
  forbidden_claims: ["preference_improves_accuracy", "preference_improves_deepseek", "preference_net_benefit", "generative_preference_superiority", "system_one_value", "production_readiness"],
  evidence_note: "Owner Review found family-coded gold-position structure from shared positional choice construction. Preserve this 60-case JSONL byte-for-byte as a deterministic conformance fixture only. It may be accepted for conformance after Owner re-review, but must never become the ZDB-03B signal/effectiveness corpus. No provider results or real user history were used."
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, data, "utf8");
await writeFile(fileURLToPath(new URL("../fixtures/preference-stage-a.v1.manifest.json", import.meta.url)), JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ valid: true, dataset_hash: manifest.dataset_hash, file_sha256: manifest.file_sha256, counts: { cases: records.length, tasks: validation.task_counts, splits: validation.split_counts, scenarios: counts } }, null, 2));
