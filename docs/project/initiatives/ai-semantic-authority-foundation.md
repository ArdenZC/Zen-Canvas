# AI Semantic Authority Foundation

Status: **ACTIVE — implementation complete; OWNER REVIEW PASSED — READY TO MERGE; backend semantic-authority contract and deterministic consumption adapters only**

Issue: [#271 — AI Semantic Authority Foundation](https://github.com/ArdenZC/Zen-Canvas/issues/271)

Branch: `ai/semantic-authority-foundation`

Activation baseline: `master@cc8870f63bd83033f3c7b79afa96bf3ce11821f7`.

## Product principle

**AI interprets and proposes. Deterministic Zen authorities validate, derive mutation intent, preview, confirm, execute and restore.**

No AI provider response is filesystem authority.

## Existing pieces to preserve

- Managed AI durable queue and Managed Scope provider/privacy/fingerprint/user-correction gates.
- File Library Query V2 and managed scan authority.
- durable Organization Plan / Plan Item ledger.
- authoritative Operation Preview, filesystem identity/safety checks and operation journal.
- Analysis Run / Finding / Evidence / Decision lifecycle for Cleanup.
- Safe Trash / Restore.
- provider abstraction, settings and secret redaction.
- Rule Proposal deterministic validator/impact/apply flow.

## Confirmed semantic-authority gap

Organization Plan `analyze_organization_plan_items` correctly enqueues managed files through the durable Managed AI owner. Managed AI completion writes validated JSON to `ai_analysis_state.classification_json`.

But `refresh_organization_plan` derives proposals from the legacy `files` classification/proposal columns and has no explicit read/adapter from the current Managed AI result. A provider result can therefore be durable and valid without a defined semantic-consumption boundary for Plan proposal derivation.

Cleanup is separate: it directly calls the configured provider and appends conservative enrichment to the Analysis Finding authority. This lifecycle is intentional and must not be migrated into the Managed AI queue.

## Authority model

### 1. SemanticAssessmentV1

Introduce one typed, versioned backend semantic contract. Exact type names may differ.

It should contain bounded semantic facts/intents such as:
- ref/source binding;
- file type;
- purpose;
- lifecycle;
- risk level;
- suggested action intent;
- confidence;
- reason;
- optional bounded relative organization hint / suggested filename if the existing deterministic target builder can safely consume it;
- confirmation/review intent where appropriate.

It must **not** contain authoritative:
- absolute filesystem target path;
- source path supplied back as authority;
- operation IDs/batch IDs;
- raw shell/command/tool instructions;
- trash/delete permission;
- overwrite permission;
- confirmation bypass;
- journal state.

Unsupported enums, unbounded text and malformed versions fail closed.

### 2. Managed AI

Managed AI remains durable semantic owner for explicitly managed files.

Provider output is canonicalized into SemanticAssessmentV1 before successful persistence. Completion still requires current managed scope, source/provider, fingerprint and user-correction validity.

Existing stored `classification_json` must remain readable. Prefer backward-compatible decoding/canonicalization over a new durable table. A schema migration is allowed only if review proves the current field cannot safely carry the versioned contract.

### 3. Organization Plan adapter

Plan consumes a current semantic assessment through a backend-only adapter that revalidates:
- library/global identity binding;
- managed scope eligibility;
- input fingerprint;
- user-correction state;
- provider/policy state;
- semantic schema/version.

The adapter produces **proposal inputs**, not file operations.

Target directories/names/paths must still be derived by deterministic Zen code from:
- authoritative source facts;
- versioned app settings / organize root;
- safe relative semantic hints;
- filename/extension policy.

Then existing Operation Preview determines whether move/rename is actually executable.

Plan revision, proposal fingerprint, review reasons, decision CAS, dry-run fingerprint and execution journal remain authoritative.

### 4. Cleanup adapter

Cleanup may reuse SemanticAssessmentV1 vocabulary/parser primitives where semantically compatible, but Analysis Finding remains the durable owner.

The existing conservative rule remains binding:
- AI can raise risk/tier;
- AI can disable action/trash eligibility;
- AI cannot lower detector risk to make something executable;
- AI cannot create direct mutation authority.

Do not enqueue Cleanup into `ai_jobs`.

### 5. Rule Proposal / Rules

Rule Proposal remains **policy authoring assistance**, not file semantic authority.

Applying a proposal creates/updates a disabled canonical user rule only after deterministic preview/validation/confirmation.

Rules remain in the product for compatibility and future Policy/Safety/Preference use. This Track does not delete Rules or make them the default semantic engine.

## Next product stage

After this foundation merges, a separate AI-only Product Migration Track may:
- make Organize and Cleanup explicitly AI-first/AI-required where intended;
- transform Automation from rule-centric authoring toward AI intent + policy + fresh analysis;
- demote Rules navigation or reshape Rules into Policy/Preferences/Triggers;
- redesign first-run onboarding to present AI, Search, Preview, Organize, Cleanup and History/Restore.

Those are deliberately outside this backend foundation.

## Platform residual

#270 continues to block macOS resident/release qualification. It is not folded into semantic authority and must not be relabeled PASS.


## Owner review closeout

Owner review passed on Production HEAD `c0454b280e15eae4f727840e21849cbe6dd7b08f` and docs-only Final HEAD `c9d873319d9a192f78a3f45695d019fbdeb67f18`.

Accepted invariants:

- provider semantics remain advisory and cannot carry filesystem-operation authority;
- Managed AI durable ownership/scope/provider/fingerprint/user-correction gates remain intact;
- Organization Plan consumes current semantics only through backend revalidation and deterministic target derivation;
- Operation Preview, Plan decision/CAS, dry run, journal, Safe Trash and Restore remain mutation authorities;
- Cleanup remains on its Analysis Finding lifecycle;
- Rule Proposal remains policy authoring, not per-file semantic authority;
- no schema migration or second semantic/job authority was added.

Hosted CI `36293630071` (Production HEAD) and `36294160138` (pre-closeout Final HEAD) are successful.

The next product stage is a separate AI-only Product Migration Track. #270 remains a separate macOS resident/release compatibility issue.
