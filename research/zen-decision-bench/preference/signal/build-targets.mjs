#!/usr/bin/env node
// Current-file situations only. This module reads no research artifact.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { sha256 } from "../../src/core.mjs";
import { FOLDERS, ACTIONS, PURPOSES, LIFECYCLES, SIGNAL_SCOPE_FAMILIES, NON_INTERVENTION_SCOPE_FAMILIES } from "./vocabulary.mjs";

// Independently authored situation inventory. Candidate sets are plausible
// destinations, never rankings or answers. Each theme supplies distinct items.
const themes = [
  {
    tag: "authored_learning", axes: ["personal_study_or_delivery", "reusable_or_current"],
    folder: [["module-outline-v3.docx",7],["lab-notes-draft.md",3],["slide-sketch-aug.pptx",24],["worked-examples.xlsx",65],["seminar-handout-rev2.pdf",40],["exercise-plan.docx",11]],
    action: [["open-lesson-draft.docx",2],["course-handout-copy.pdf",46],["session-notes-old.md",260]],
    sets: ["teaching study reference archive","study teaching work","archive teaching study","reference teaching work","archive reference study","study teaching archive"]
  },
  {
    tag: "received_learning", axes: ["received_or_authored", "topic_or_reuse"],
    folder: [["reading-packet-fall.pdf",18],["guest-talk-slides.pptx",90],["practice-sheet-04.xlsx",14],["course-link-index.md",35],["speaker-example.zip",155],["borrowed-diagram.png",72]],
    action: [["new-reading-packet.pdf",1],["seminar-slides-copy.pptx",42],["unlabeled-practice-sheet.xlsx",75]],
    sets: ["reference study teaching archive","study reference archive","teaching reference media","study reference work","archive study reference","media reference study"]
  },
  {
    tag: "active_work", axes: ["live_or_reference", "ownership_unclear"],
    folder: [["client-brief-revision.docx",5],["meeting-actions-sep.md",16],["proposal-table.xlsx",27],["review-markups.pdf",9],["handoff-notes.txt",35],["deliverable-outline.pptx",21]],
    action: [["working-brief.docx",4],["incoming-markups.pdf",2],["status-notes-copy.md",52]],
    sets: ["work reference archive personal","work personal reference","finance work archive","work teaching reference","media work reference","archive work personal"]
  },
  {
    tag: "completed_work", axes: ["closed_or_reusable", "retention_unclear"],
    folder: [["signed-summary.pdf",100],["release-notes-final.md",45],["client-closeout.pptx",210],["handover-checklist.docx",64],["delivery-log.csv",120],["approved-template.docx",160]],
    action: [["completed-report.pdf",70],["delivered-slide-deck.pptx",125],["closure-notes.md",80]],
    sets: ["archive work reference finance","archive finance work","archive personal work","archive reference teaching","archive media work","reference work teaching"]
  },
  {
    tag: "reusable_reference", axes: ["cross_project_or_local", "source_or_copy"],
    folder: [["design-pattern-notes.md",140],["cross-team-checklist.docx",55],["diagram-library.svg",95],["quote-index.csv",250],["method-overview.pdf",180],["workflow-example.txt",40]],
    action: [["reference-checklist.docx",120],["downloaded-method-note.pdf",20],["unverified-snippet.md",6]],
    sets: ["reference work study teaching","reference teaching study","media reference work","archive reference work","personal reference study","reference finance work"]
  },
  {
    tag: "personal_admin", axes: ["household_or_financial", "current_or_old"],
    folder: [["household-renewal.pdf",14],["contact-list-update.csv",3],["appointment-note.md",30],["family-form-scan.png",65],["service-letter.pdf",9],["benefit-overview.docx",110]],
    action: [["open-household-form.pdf",4],["received-service-letter.pdf",7],["old-appointment-note.md",270]],
    sets: ["finance personal archive reference","personal reference finance","media personal archive","personal work reference","archive finance personal","personal study reference"]
  },
  {
    tag: "financial_documents", axes: ["budget_or_record", "current_or_closed"],
    folder: [["expense-summary-q3.xlsx",10],["payment-notice.pdf",6],["budget-worksheet.xlsx",36],["receipt-bundle.zip",150],["account-guide.pdf",280],["renewal-estimate.csv",22]],
    action: [["open-expense-sheet.xlsx",3],["received-payment-notice.pdf",8],["old-budget-copy.xlsx",240]],
    sets: ["finance personal archive work","finance work reference","archive finance work","finance reference personal","archive finance personal","finance study reference"]
  },
  {
    tag: "media_assets", axes: ["source_or_export", "personal_or_project"],
    folder: [["camera-roll-select.png",5],["thumbnail-draft.svg",2],["interview-audio.wav",62],["poster-export-v2.jpg",18],["sample-footage.mp4",100],["style-frame.png",47]],
    action: [["active-poster-draft.svg",1],["new-audio-select.wav",2],["unused-frame-copy.png",230]],
    sets: ["media personal work reference","media work archive","media reference teaching","media study personal","archive media work","media reference personal"]
  },
  {
    tag: "ambiguous_inbox", axes: ["source_unclear", "use_unclear"],
    folder: [["notes-from-call.md",6],["shared-table-v2.xlsx",48],["scan-september.pdf",20],["misc-diagram.svg",120],["follow-up-list.txt",14],["summary-unlabeled.docx",210]],
    action: [["new-unlabeled-notes.md",2],["shared-table-copy.xlsx",80],["unverified-scan.pdf",15]],
    sets: ["personal work reference study","study work reference","finance personal work","media reference personal","archive reference work","teaching study work"]
  },
  {
    tag: "project_reference", axes: ["project_or_reusable", "draft_or_source"],
    folder: [["api-pattern-notes.md",100],["migration-example.sql",160],["process-map.svg",55],["review-playbook.pdf",200],["team-template.docx",72],["implementation-sketch.txt",12]],
    action: [["project-example.sql",130],["reusable-playbook.pdf",190],["unclear-process-map.svg",33]],
    sets: ["work reference archive study","work study reference","media reference work","reference teaching work","archive reference work","finance reference work"]
  },
  {
    tag: "teaching_study_crossover", axes: ["author_or_learner", "current_or_reusable"],
    folder: [["course-exercise-answer.docx",25],["workshop-schedule.xlsx",4],["tutorial-figures.svg",95],["revision-flashcards.pdf",110],["peer-feedback-notes.md",16],["module-source-list.txt",140]],
    action: [["live-workshop-schedule.xlsx",3],["received-feedback-notes.md",8],["older-flashcards.pdf",280]],
    sets: ["study teaching reference work","teaching work study","media study teaching","archive teaching study","reference study teaching","study personal teaching"]
  },
  {
    tag: "stale_material", axes: ["active_or_retired", "provenance_unclear"],
    folder: [["old-onboarding-guide.pdf",400],["retired-project-plan.docx",510],["previous-year-notes.md",360],["legacy-icon-set.zip",480],["expired-draft-summary.txt",300],["superseded-budget.xlsx",275]],
    action: [["retired-guide.pdf",500],["old-plan-copy.docx",340],["undated-summary.txt",190]],
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

function inputFor(name, ordinal, ageDays) {
  const extension = name.slice(name.lastIndexOf(".") + 1);
  if (!Number.isInteger(ageDays) || ageDays < 0) throw new Error(`invalid_age_days:${name}`);
  return {
    name, extension, size: 32000 + ordinal * 1379,
    modified_at_fs: Math.floor(Date.parse(TARGET_AT) / 1000) - ageDays * 86400,
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

function makeRecord(task, ordinal, name, ageDays, theme, choices, axes) {
  const caseId = `zdb03b-target-${String(ordinal + (task === "existing_folder_choice" ? 1 : task === "suggested_action" ? 73 : task === "purpose" ? 109 : 115)).padStart(3, "0")}`;
  const control = controlFor(task, ordinal);
  if (![...SIGNAL_SCOPE_FAMILIES, ...NON_INTERVENTION_SCOPE_FAMILIES].includes(theme)) throw new Error(`invalid_scope_family:${theme}`);
  const scopeTemplate = {
    workspace_mode: control === "cold_start_candidate" ? "assigned_profile_novel" : "assigned_profile_primary",
    task_family: task, parent_family: theme
  };
  const record = {
    schema_version: "zdb.preference_signal_target.v1", case_id: caseId, task,
    input: inputFor(name, Number(caseId.slice(-3)), ageDays), target_at: TARGET_AT,
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
    for (const [itemIndex, [name, ageDays]] of theme.folder.entries()) {
      const ordinal = groupIndex * 6 + itemIndex;
      const ids = theme.sets[itemIndex].split(" ").sort();
      records.push(makeRecord("existing_folder_choice", ordinal, name, ageDays, theme.tag,
        ids.map((id) => ({ id, label: FOLDERS[id] })), theme.axes));
    }
  }
  for (const [groupIndex, theme] of themes.entries()) {
    for (const [itemIndex, [name, ageDays]] of theme.action.entries()) {
      const ordinal = groupIndex * 3 + itemIndex;
      records.push(makeRecord("suggested_action", ordinal, name, ageDays, theme.tag, ACTIONS, theme.axes));
    }
  }
  const purposeNames = [["shared-planning-note.md",20],["course-registration.pdf",40],["family-schedule.xlsx",7],["project-overview.docx",75],["reference-index.csv",160],["mixed-purpose-summary.txt",90]];
  const lifecycleNames = [["working-version.md",2],["dated-copy.docx",80],["undated-export.pdf",55],["reference-card.txt",120],["older-plan.xlsx",260],["received-update.pdf",6]];
  for (const [index, [name, ageDays]] of purposeNames.entries()) records.push(makeRecord("purpose", index, name, ageDays, "purpose_control", PURPOSES, ["purpose_unclear"]));
  for (const [index, [name, ageDays]] of lifecycleNames.entries()) records.push(makeRecord("lifecycle", index, name, ageDays, "lifecycle_control", LIFECYCLES, ["lifecycle_unclear"]));
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
