// Frozen transferable research identities from the Owner-reviewed ZDB-03B definition.
export const FOLDERS = Object.freeze({
  teaching: "Teaching", study: "Study", work: "Work", reference: "Reference",
  archive: "Archive", personal: "Personal", finance: "Finance", media: "Media"
});

// Resolver-compatible parent_family identities. Both B1 authors use this
// vocabulary independently; human context_tags are not matching authority.
export const SIGNAL_SCOPE_FAMILIES = Object.freeze([
  "authored_learning", "received_learning", "active_work", "completed_work",
  "reusable_reference", "personal_admin", "financial_documents", "media_assets",
  "ambiguous_inbox", "project_reference", "teaching_study_crossover", "stale_material"
]);
export const NON_INTERVENTION_SCOPE_FAMILIES = Object.freeze([
  "purpose_control", "lifecycle_control"
]);

// Exact order and labels of the accepted ZDB-01 suggested_action choice set.
export const ACTIONS = Object.freeze([
  { id: "keep", label: "Keep" }, { id: "rename", label: "Rename" },
  { id: "move", label: "Move" }, { id: "move_and_rename", label: "Move and rename" },
  { id: "archive", label: "Archive" }, { id: "review", label: "Review" },
  { id: "delete_candidate", label: "Delete candidate" }, { id: "unknown", label: "Unknown" }
]);

export const PURPOSES = Object.freeze([
  { id: "project", label: "Project" }, { id: "teaching", label: "Teaching" },
  { id: "study", label: "Study" }, { id: "work", label: "Work" },
  { id: "personal", label: "Personal" }, { id: "career", label: "Career" },
  { id: "finance", label: "Finance" }, { id: "identity", label: "Identity" },
  { id: "media", label: "Media" }, { id: "installer", label: "Installer" },
  { id: "temporary", label: "Temporary" }, { id: "archive", label: "Archive" },
  { id: "document", label: "Document" }, { id: "duplicate_review", label: "Duplicate Review" },
  { id: "unknown", label: "Unknown" }
]);

export const LIFECYCLES = Object.freeze([
  { id: "inbox", label: "Inbox" }, { id: "active", label: "Active" },
  { id: "reference", label: "Reference" }, { id: "archive", label: "Archive" },
  { id: "disposable", label: "Disposable" }, { id: "duplicate", label: "Duplicate" },
  { id: "sensitive", label: "Sensitive" }, { id: "trash_review", label: "TrashReview" },
  { id: "unknown", label: "Unknown" }
]);
