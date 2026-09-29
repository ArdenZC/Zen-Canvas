#!/usr/bin/env node
// Synthetic tendency authoring only. This module reads no research artifact.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { sha256 } from "../../src/core.mjs";
import { FOLDERS, ACTIONS, SIGNAL_SCOPE_FAMILIES } from "./vocabulary.mjs";

// Each row was authored as an independent latent habit, without case metadata.
// Tuple: context tag, soft favorite, contrasted valid alternative.
const profiles = [
  {
    brief: "Course creator who separates reusable source material from class delivery and hesitates on mixed administrative items.",
    folders: [["draft_lessons","teaching","study"],["received_reading","study","teaching"],["reusable_diagrams","reference","teaching"],["finished_course","archive","teaching"]],
    actions: [["active_draft","keep","move"],["finished_course","archive","keep"],["unclear_owner","review","move"]],
    exception: "A mixed teaching and study handout can belong in either area until its actual use is known."
  },
  {
    brief: "Independent researcher who keeps reading notes close to study work but files durable citations separately.",
    folders: [["reading_notes","study","reference"],["citation_library","reference","study"],["client_excerpt","work","reference"],["retired_notes","archive","study"]],
    actions: [["live_notes","keep","archive"],["dated_excerpt","move","keep"],["unclear_citation","review","archive"]],
    exception: "A citation used in both client and personal study work may need review before placement."
  },
  {
    brief: "Project lead who favors active work folders and makes separate room for durable patterns after delivery.",
    folders: [["active_deliverable","work","archive"],["shared_pattern","reference","work"],["completed_delivery","archive","work"],["private_admin","personal","work"]],
    actions: [["active_handoff","move","keep"],["finished_milestone","archive","keep"],["unclear_revision","review","move"]],
    exception: "A client template might be reusable or contract-specific; this profile leaves that judgment open."
  },
  {
    brief: "Family administrator who keeps personal records together but treats financial documents as a distinct area.",
    folders: [["household_note","personal","reference"],["payment_record","finance","personal"],["shared_photo","media","personal"],["expired_form","archive","personal"]],
    actions: [["current_form","keep","archive"],["closed_statement","archive","keep"],["unclear_bill","review","archive"]],
    exception: "A form with both identity and payment details may need a direct decision rather than a habit."
  },
  {
    brief: "Visual producer who collects media assets apart from general work and preserves reusable design references.",
    folders: [["source_photo","media","work"],["client_export","work","media"],["style_reference","reference","media"],["completed_asset","archive","media"]],
    actions: [["working_asset","keep","archive"],["new_export","move","keep"],["unclear_license","review","move"]],
    exception: "A licensed image can be a reusable reference or a one-project asset, depending on rights."
  },
  {
    brief: "Learner who separates current exercises from reference manuals and moves finished material out of active study.",
    folders: [["course_exercise","study","teaching"],["general_manual","reference","study"],["finished_module","archive","study"],["career_portfolio","work","study"]],
    actions: [["open_exercise","keep","move"],["closed_module","archive","keep"],["unclear_assignment","review","archive"]],
    exception: "A lesson that later becomes teaching material can change its natural destination."
  },
  {
    brief: "Consultant who favors client work for live artifacts, keeps reusable methods in reference, and reviews stale requests.",
    folders: [["live_contract","work","finance"],["method_note","reference","work"],["invoice_copy","finance","work"],["delivered_packet","archive","work"]],
    actions: [["live_request","move","keep"],["signed_delivery","archive","move"],["stale_request","review","archive"]],
    exception: "A contract appendix that doubles as a method template may deserve explicit review."
  },
  {
    brief: "Archive-minded editor who preserves active drafts but tends to separate old editions and reusable excerpts.",
    folders: [["current_draft","work","archive"],["older_edition","archive","work"],["quotation_bank","reference","work"],["personal_journal","personal","reference"]],
    actions: [["current_edit","keep","archive"],["superseded_edit","archive","keep"],["unclear_version","review","archive"]],
    exception: "An older edition still cited in current work may remain active."
  },
  {
    brief: "Finance-oriented organizer who keeps statements distinct, while treating mixed household records conservatively.",
    folders: [["tax_statement","finance","archive"],["family_receipt","personal","finance"],["financial_guide","reference","finance"],["closed_budget","archive","finance"]],
    actions: [["open_statement","keep","archive"],["closed_budget","archive","keep"],["unclear_receipt","review","move"]],
    exception: "A receipt used for both household memory and tax documentation needs a current instruction."
  },
  {
    brief: "Community tutor who favors shareable teaching material, but keeps personal practice and recorded media apart.",
    folders: [["shared_lesson","teaching","study"],["own_practice","study","teaching"],["recording","media","teaching"],["general_explanation","reference","teaching"]],
    actions: [["class_handout","move","keep"],["retired_session","archive","move"],["unclear_recording","review","archive"]],
    exception: "A recording that includes private learner details may need separate handling."
  },
  {
    brief: "Generalist who keeps reusable material in reference and live work in a work area, with caution on mixed inbox items.",
    folders: [["reusable_checklist","reference","work"],["active_brief","work","reference"],["personal_plan","personal","work"],["old_reference","archive","reference"]],
    actions: [["active_inbox","keep","move"],["stable_resource","move","keep"],["ambiguous_inbox","review","move"]],
    exception: "A checklist tied to one client can be work-specific despite its reusable appearance."
  },
  {
    brief: "Multimedia student who studies source material, stores finished media separately, and reviews unclear lifecycle states.",
    folders: [["practice_clip","study","media"],["finished_visual","media","study"],["tutorial_reference","reference","study"],["past_project","archive","media"]],
    actions: [["in_progress_clip","keep","archive"],["completed_export","move","keep"],["unclear_derivative","review","archive"]],
    exception: "A finished clip still needed for study can remain with the active coursework."
  }
];

const qualifiers = ["usually", "often", "tends_to"];
// Exact, resolver-compatible family identity authored per latent context.
// Human context tags remain descriptive and are never used for fuzzy matching.
const scopeFamilyByContext = {
  draft_lessons: "authored_learning", received_reading: "received_learning", reusable_diagrams: "reusable_reference", finished_course: "completed_work",
  active_draft: "authored_learning", unclear_owner: "ambiguous_inbox",
  reading_notes: "authored_learning", citation_library: "reusable_reference", client_excerpt: "project_reference", retired_notes: "stale_material",
  live_notes: "authored_learning", dated_excerpt: "reusable_reference", unclear_citation: "ambiguous_inbox",
  active_deliverable: "active_work", shared_pattern: "reusable_reference", completed_delivery: "completed_work", private_admin: "personal_admin",
  active_handoff: "active_work", finished_milestone: "completed_work", unclear_revision: "ambiguous_inbox",
  household_note: "personal_admin", payment_record: "financial_documents", shared_photo: "media_assets", expired_form: "stale_material",
  current_form: "personal_admin", closed_statement: "financial_documents", unclear_bill: "ambiguous_inbox",
  source_photo: "media_assets", client_export: "active_work", style_reference: "reusable_reference", completed_asset: "completed_work",
  working_asset: "media_assets", new_export: "active_work", unclear_license: "ambiguous_inbox",
  course_exercise: "authored_learning", general_manual: "received_learning", finished_module: "completed_work", career_portfolio: "active_work",
  open_exercise: "authored_learning", closed_module: "completed_work", unclear_assignment: "ambiguous_inbox",
  live_contract: "active_work", method_note: "reusable_reference", invoice_copy: "financial_documents", delivered_packet: "completed_work",
  live_request: "active_work", signed_delivery: "completed_work", stale_request: "stale_material",
  current_draft: "active_work", older_edition: "stale_material", quotation_bank: "reusable_reference", personal_journal: "personal_admin",
  current_edit: "active_work", superseded_edit: "stale_material", unclear_version: "ambiguous_inbox",
  tax_statement: "financial_documents", family_receipt: "personal_admin", financial_guide: "reusable_reference", closed_budget: "completed_work",
  open_statement: "financial_documents", unclear_receipt: "ambiguous_inbox",
  shared_lesson: "authored_learning", own_practice: "teaching_study_crossover", recording: "media_assets", general_explanation: "reusable_reference",
  class_handout: "authored_learning", retired_session: "stale_material", unclear_recording: "ambiguous_inbox",
  reusable_checklist: "reusable_reference", active_brief: "active_work", personal_plan: "personal_admin", old_reference: "stale_material",
  active_inbox: "active_work", stable_resource: "reusable_reference", ambiguous_inbox: "ambiguous_inbox",
  practice_clip: "teaching_study_crossover", finished_visual: "media_assets", tutorial_reference: "reusable_reference", past_project: "stale_material",
  in_progress_clip: "teaching_study_crossover", completed_export: "media_assets", unclear_derivative: "ambiguous_inbox"
};
function tendency(profileId, task, item, index) {
  const [context, preferred, contrasted] = item;
  const qualifier = qualifiers[index % qualifiers.length];
  const vocabulary = task === "existing_folder_choice" ? FOLDERS : Object.fromEntries(ACTIONS.map(({ id, label }) => [id, label]));
  if (!vocabulary[preferred] || !vocabulary[contrasted] || preferred === contrasted) throw new Error("invalid_tendency_vocabulary");
  const scopeParentFamily = scopeFamilyByContext[context];
  if (!SIGNAL_SCOPE_FAMILIES.includes(scopeParentFamily)) throw new Error(`invalid_scope_family:${context}`);
  const lead = { usually: "Usually favors", often: "Often favors", tends_to: "Tends to favor" }[qualifier];
  return {
    tendency_id: `${profileId}-${task === "existing_folder_choice" ? "folder" : "action"}-${index + 1}`,
    task, statement: `${lead} ${vocabulary[preferred]} over ${vocabulary[contrasted]} for ${context.replaceAll("_", " ")}, when context permits.`,
    context_tags: [context], scope_parent_family: scopeParentFamily,
    preferred_value: preferred, contrasted_values: [contrasted], qualifier
  };
}

export function buildProfiles() {
  return profiles.map((row, index) => {
    const profileId = `profile-${String(index + 1).padStart(2, "0")}`;
    return {
      schema_version: "zdb.preference_signal_profile.v1",
      profile_id: profileId,
      primary_workspace_id: `zdb03b-workspace-${String(index + 1).padStart(2, "0")}`,
      brief: row.brief,
      tendencies: [
        ...row.folders.map((item, i) => tendency(profileId, "existing_folder_choice", item, i)),
        ...row.actions.map((item, i) => tendency(profileId, "suggested_action", item, i))
      ],
      exceptions: [row.exception],
      provenance: { category: "synthetic", source: "zdb-03b1-independent-profile-authoring" }
    };
  });
}

export async function writeProfiles() {
  const records = buildProfiles();
  const data = records.map((record) => JSON.stringify(record)).join("\n") + "\n";
  const output = new URL("./profiles.v1.jsonl", import.meta.url);
  const manifest = {
    schema_version: "zdb.preference_signal_profile_manifest.v1",
    schema_identity: "zdb.preference_signal_profile.v1",
    artifact_file: "profiles.v1.jsonl", count: records.length,
    canonical_sha256: sha256(records), file_sha256: createHash("sha256").update(data).digest("hex"),
    creation_commit: null, provenance: "synthetic_independent_profile_authoring",
    research_only: true, status: "CANDIDATE — OWNER REVIEW REQUIRED",
    owner_state: "OWNER REVIEW PENDING", next_gate: "Owner review and freeze of both B1 packs before B2"
  };
  await mkdir(dirname(fileURLToPath(output)), { recursive: true });
  await writeFile(output, data, "utf8");
  await writeFile(new URL("./profiles.v1.manifest.json", import.meta.url), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  return manifest;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(JSON.stringify(await writeProfiles(), null, 2));
}
