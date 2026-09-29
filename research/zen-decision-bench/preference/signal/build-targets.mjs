#!/usr/bin/env node
// Current-file situations only. This module reads no research artifact.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { sha256 } from "../../src/core.mjs";
import { FOLDERS, ACTIONS, PURPOSES, LIFECYCLES } from "./vocabulary.mjs";

// Independently authored situation inventory. Candidate sets are plausible
// destinations, never rankings or answers. Each theme supplies distinct items.
const themes = [
  {
    tag: "authored_learning", axes: ["personal_study_or_delivery", "reusable_or_current"],
    folder: ["module-outline-v3.docx","lab-notes-draft.md","slide-sketch-aug.pptx","worked-examples.xlsx","seminar-handout-rev2.pdf","exercise-plan.docx"],
    action: ["open-lesson-draft.docx","course-handout-copy.pdf","session-notes-old.md"],
    sets: ["teaching study reference archive","study teaching work","archive teaching study","reference teaching work","archive reference study","study teaching archive"]
  },
  {
    tag: "received_learning", axes: ["received_or_authored", "topic_or_reuse"],
    folder: ["reading-packet-fall.pdf","guest-talk-slides.pptx","practice-sheet-04.xlsx","course-link-index.md","speaker-example.zip","borrowed-diagram.png"],
    action: ["new-reading-packet.pdf","seminar-slides-copy.pptx","unlabeled-practice-sheet.xlsx"],
    sets: ["reference study teaching archive","study reference archive","teaching reference media","study reference work","archive study reference","media reference study"]
  },
  {
    tag: "active_work", axes: ["live_or_reference", "ownership_unclear"],
    folder: ["client-brief-revision.docx","meeting-actions-sep.md","proposal-table.xlsx","review-markups.pdf","handoff-notes.txt","deliverable-outline.pptx"],
    action: ["working-brief.docx","incoming-markups.pdf","status-notes-copy.md"],
    sets: ["work reference archive personal","work personal reference","finance work archive","work teaching reference","media work reference","archive work personal"]
  },
  {
    tag: "completed_work", axes: ["closed_or_reusable", "retention_unclear"],
    folder: ["signed-summary.pdf","release-notes-final.md","client-closeout.pptx","handover-checklist.docx","delivery-log.csv","approved-template.docx"],
    action: ["completed-report.pdf","delivered-slide-deck.pptx","closure-notes.md"],
    sets: ["archive work reference finance","archive finance work","archive personal work","archive reference teaching","archive media work","reference work teaching"]
  },
  {
    tag: "reusable_reference", axes: ["cross_project_or_local", "source_or_copy"],
    folder: ["design-pattern-notes.md","cross-team-checklist.docx","diagram-library.svg","quote-index.csv","method-overview.pdf","workflow-example.txt"],
    action: ["reference-checklist.docx","downloaded-method-note.pdf","unverified-snippet.md"],
    sets: ["reference work study teaching","reference teaching study","media reference work","archive reference work","personal reference study","reference finance work"]
  },
  {
    tag: "personal_admin", axes: ["household_or_financial", "current_or_old"],
    folder: ["household-renewal.pdf","contact-list-update.csv","appointment-note.md","family-form-scan.png","service-letter.pdf","benefit-overview.docx"],
    action: ["open-household-form.pdf","received-service-letter.pdf","old-appointment-note.md"],
    sets: ["finance personal archive reference","personal reference finance","media personal archive","personal work reference","archive finance personal","personal study reference"]
  },
  {
    tag: "financial_documents", axes: ["budget_or_record", "current_or_closed"],
    folder: ["expense-summary-q3.xlsx","payment-notice.pdf","budget-worksheet.xlsx","receipt-bundle.zip","account-guide.pdf","renewal-estimate.csv"],
    action: ["open-expense-sheet.xlsx","received-payment-notice.pdf","old-budget-copy.xlsx"],
    sets: ["finance personal archive work","finance work reference","archive finance work","finance reference personal","archive finance personal","finance study reference"]
  },
  {
    tag: "media_assets", axes: ["source_or_export", "personal_or_project"],
    folder: ["camera-roll-select.png","thumbnail-draft.svg","interview-audio.wav","poster-export-v2.jpg","sample-footage.mp4","style-frame.png"],
    action: ["active-poster-draft.svg","new-audio-select.wav","unused-frame-copy.png"],
    sets: ["media personal work reference","media work archive","media reference teaching","media study personal","archive media work","media reference personal"]
  },
  {
    tag: "ambiguous_inbox", axes: ["source_unclear", "use_unclear"],
    folder: ["notes-from-call.md","shared-table-v2.xlsx","scan-september.pdf","misc-diagram.svg","follow-up-list.txt","summary-unlabeled.docx"],
    action: ["new-unlabeled-notes.md","shared-table-copy.xlsx","unverified-scan.pdf"],
    sets: ["personal work reference study","study work reference","finance personal work","media reference personal","archive reference work","teaching study work"]
  },
  {
    tag: "project_reference", axes: ["project_or_reusable", "draft_or_source"],
    folder: ["api-pattern-notes.md","migration-example.sql","process-map.svg","review-playbook.pdf","team-template.docx","implementation-sketch.txt"],
    action: ["project-example.sql","reusable-playbook.pdf","unclear-process-map.svg"],
    sets: ["work reference archive study","work study reference","media reference work","reference teaching work","archive reference work","finance reference work"]
  },
  {
    tag: "teaching_study_crossover", axes: ["author_or_learner", "current_or_reusable"],
    folder: ["course-exercise-answer.docx","workshop-schedule.xlsx","tutorial-figures.svg","revision-flashcards.pdf","peer-feedback-notes.md","module-source-list.txt"],
    action: ["live-workshop-schedule.xlsx","received-feedback-notes.md","older-flashcards.pdf"],
    sets: ["study teaching reference work","teaching work study","media study teaching","archive teaching study","reference study teaching","study personal teaching"]
  },
  {
    tag: "stale_material", axes: ["active_or_retired", "provenance_unclear"],
    folder: ["old-onboarding-guide.pdf","retired-project-plan.docx","previous-year-notes.md","legacy-icon-set.zip","expired-draft-summary.txt","superseded-budget.xlsx"],
    action: ["retired-guide.pdf","old-plan-copy.docx","undated-summary.txt"],
    sets: ["archive work reference personal","archive teaching study","archive personal finance","archive media reference","archive finance work","archive study personal"]
  }
];

const coldFolder = new Set([5,11,17,23,29,35,41,47]);
const coldAction = new Set([5,14,23,32]);
const truthFolder = new Set([2,14,26]);
const truthAction = new Set([2,17,29]);
const safetyAction = new Set([3,9,15,21,27,33]);
const TARGET_AT = "2026-09-25T12:00:00.000Z";
const ASSERTED_AT = "2026-09-24T12:00:00.000Z";
// Direct current user authority for six control cases, authored independently
// of latent profiles. These are fixture instructions, not adjudicated outcomes.
const directInstructions = {
  "zdb03b-target-003": { decision: "teaching", statement: "The current user asks to place this slide sketch in Teaching for a class session." },
  "zdb03b-target-015": { decision: "work", statement: "The current user asks to keep this proposal table with active Work material." },
  "zdb03b-target-027": { decision: "reference", statement: "The current user asks to place this diagram library in Reference for reuse." },
  "zdb03b-target-075": { decision: "keep", statement: "The current user asks to keep these session notes available for a follow-up." },
  "zdb03b-target-090": { decision: "archive", statement: "The current user asks to archive this old appointment note." },
  "zdb03b-target-102": { decision: "review", statement: "The current user asks to review this unclear process map before acting." }
};

function inputFor(name, ordinal) {
  const extension = name.slice(name.lastIndexOf(".") + 1);
  return {
    name, extension, size: 32000 + ordinal * 1379,
    modified_at_fs: 1758672000 + ordinal * 67,
    parent: ordinal % 2 === 0 ? "C:/ZDB03B/Inbox" : "C:/ZDB03B/Downloads",
    is_directory: false
  };
}

function controlFor(task, ordinal) {
  if (task === "existing_folder_choice") {
    if (coldFolder.has(ordinal)) return "cold_start_candidate";
    if (truthFolder.has(ordinal)) return "explicit_truth_control";
  }
  if (task === "suggested_action") {
    if (coldAction.has(ordinal)) return "cold_start_candidate";
    if (truthAction.has(ordinal)) return "explicit_truth_control";
    if (safetyAction.has(ordinal)) return "safety_control";
  }
  return ["purpose", "lifecycle"].includes(task) ? "non_intervention_control" : "ordinary_preference_signal";
}

function makeRecord(task, ordinal, name, theme, choices, axes) {
  const caseId = `zdb03b-target-${String(ordinal + (task === "existing_folder_choice" ? 1 : task === "suggested_action" ? 73 : task === "purpose" ? 109 : 115)).padStart(3, "0")}`;
  const control = controlFor(task, ordinal);
  const scopeTemplate = {
    workspace_mode: control === "cold_start_candidate" ? "assigned_profile_novel" : "assigned_profile_primary",
    task_family: task, parent_family: "neutral_inbox"
  };
  const record = {
    schema_version: "zdb.preference_signal_target.v1", case_id: caseId, task,
    input: inputFor(name, Number(caseId.slice(-3))), target_at: TARGET_AT,
    choices, ambiguity: { level: task === "purpose" || task === "lifecycle" ? "bounded" : "material", axes },
    authoring_tags: [theme, "synthetic_current_item"], scope_template: scopeTemplate,
    control_class: control,
    provenance: { category: "synthetic", source: "zdb-03b1-independent-target-authoring" }
  };
  if (control === "explicit_truth_control") {
    // Current direct authority is allowed here; it is not benchmark adjudication.
    const instruction = directInstructions[caseId];
    if (!instruction || !choices.some(({ id }) => id === instruction.decision)) throw new Error(`invalid_direct_instruction:${caseId}`);
    record.explicit_user_truth = {
      truth_id: `${caseId}-truth`, task, decision: instruction.decision,
      statement: instruction.statement,
      scope_template: scopeTemplate, asserted_at: ASSERTED_AT
    };
  }
  if (control === "safety_control") {
    record.deterministic_rule = {
      rule_id: `${caseId}-safety`, authority: "safety_rule", task,
      decision: "review", statement: "A synthetic approval prerequisite is unresolved; require review before an automated change.",
      scope_template: scopeTemplate, asserted_at: ASSERTED_AT
    };
  }
  return record;
}

export function buildTargets() {
  const records = [];
  for (const [groupIndex, theme] of themes.entries()) {
    for (const [itemIndex, name] of theme.folder.entries()) {
      const ordinal = groupIndex * 6 + itemIndex;
      const ids = theme.sets[itemIndex].split(" ").sort();
      records.push(makeRecord("existing_folder_choice", ordinal, name, theme.tag,
        ids.map((id) => ({ id, label: FOLDERS[id] })), theme.axes));
    }
  }
  for (const [groupIndex, theme] of themes.entries()) {
    for (const [itemIndex, name] of theme.action.entries()) {
      const ordinal = groupIndex * 3 + itemIndex;
      records.push(makeRecord("suggested_action", ordinal, name, theme.tag, ACTIONS, theme.axes));
    }
  }
  const purposeNames = ["shared-planning-note.md","course-registration.pdf","family-schedule.xlsx","project-overview.docx","reference-index.csv","mixed-purpose-summary.txt"];
  const lifecycleNames = ["working-version.md","dated-copy.docx","undated-export.pdf","reference-card.txt","older-plan.xlsx","received-update.pdf"];
  for (const [index, name] of purposeNames.entries()) records.push(makeRecord("purpose", index, name, "purpose_control", PURPOSES, ["purpose_unclear"]));
  for (const [index, name] of lifecycleNames.entries()) records.push(makeRecord("lifecycle", index, name, "lifecycle_control", LIFECYCLES, ["lifecycle_unclear"]));
  return records;
}

export async function writeTargets() {
  const records = buildTargets();
  const data = records.map((record) => JSON.stringify(record)).join("\n") + "\n";
  const output = new URL("./targets.v1.jsonl", import.meta.url);
  const counts = (key) => Object.fromEntries([...new Set(records.map((record) => record[key]))].sort().map((value) => [value, records.filter((record) => record[key] === value).length]));
  const manifest = {
    schema_version: "zdb.preference_signal_target_manifest.v1",
    schema_identity: "zdb.preference_signal_target.v1",
    artifact_file: "targets.v1.jsonl", count: records.length,
    canonical_sha256: sha256(records), file_sha256: createHash("sha256").update(data).digest("hex"),
    task_counts: counts("task"), control_counts: counts("control_class"),
    creation_commit: null, provenance: "synthetic_independent_target_authoring",
    research_only: true, status: "CANDIDATE — OWNER REVIEW REQUIRED",
    owner_state: "OWNER REVIEW PENDING", next_gate: "Owner review and freeze of both B1 packs before B2"
  };
  await mkdir(dirname(fileURLToPath(output)), { recursive: true });
  await writeFile(output, data, "utf8");
  await writeFile(new URL("./targets.v1.manifest.json", import.meta.url), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  return manifest;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(JSON.stringify(await writeTargets(), null, 2));
}
