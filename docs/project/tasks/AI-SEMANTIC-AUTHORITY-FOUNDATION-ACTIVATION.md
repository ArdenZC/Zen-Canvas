# AI Semantic Authority Foundation — Activation

## Identity

- Issue: [#271](https://github.com/ArdenZC/Zen-Canvas/issues/271)
- Branch: `ai/semantic-authority-foundation`
- Baseline: `master@cc8870f63bd83033f3c7b79afa96bf3ce11821f7`
- Track type: **implementation — backend authority foundation**
- UI/product migration: **NOT AUTHORIZED in this Track**

## Mandatory reading

Before implementation, read:
- `docs/project/initiatives/ai-semantic-authority-foundation.md`
- `docs/project/ARCHITECTURE_MAP.md`
- `docs/remediation/LEGACY_RETIREMENT_PLAN.md`
- `src-tauri/src/global_index/managed_worker_hardened.rs`
- `src-tauri/src/global_index/managed_scope.rs`
- `src-tauri/src/global_index/legacy_queue.rs`
- `src-tauri/src/ai/classification.rs`
- `src-tauri/src/ai/cleanup.rs`
- `src-tauri/src/db/queries/organization/mod.rs`
- `src-tauri/src/db/queries/analysis/mod.rs`
- `src-tauri/src/rule_proposals.rs`
- `src-tauri/src/db/queries/rule_proposals/mod.rs`

## Phase A — freeze the current map

Before code changes, record a KEEP / REWORK / RENAME / MERGE / REMOVE matrix in the Result for:

| Component | Starting disposition |
| --- | --- |
| Managed AI durable queue | KEEP |
| Managed Scope consent/provider policy | KEEP |
| `ai_analysis_state` durable per-file assessment slot | KEEP / REWORK payload contract |
| `global_index/legacy_queue.rs` compatibility adapter | KEEP for this Track; retirement remains TD-006 |
| direct legacy AI classification provider path | KEEP test/compatibility only; do not restore as production authority |
| Organization Plan ledger/dry-run/execution | KEEP |
| Organization Plan semantic consumption | REWORK |
| Cleanup Analysis Finding lifecycle | KEEP |
| Cleanup AI schema/parser | MERGE shared vocabulary where safe; keep lifecycle |
| Rule Proposal durable workflow | KEEP |
| Rules as semantic default | DO NOT EXPAND; future product REWORK |
| Automation rule-centric UX | FUTURE REWORK; no code change here |
| onboarding | FUTURE REWORK; no code change here |

## Phase B — SemanticAssessmentV1

Create one typed, versioned semantic assessment contract in the Rust backend.

Requirements:

1. strict serde schema / deny unexpected authority-bearing fields where practical;
2. bounded strings and allowed enum vocabularies;
3. confidence finite and 0..=1;
4. explicit version;
5. input/source binding cannot be supplied by renderer;
6. no absolute target path authority;
7. no delete/trash permission;
8. no operation/journal/confirmation authority;
9. deterministic canonical serialization/fingerprint if persisted.

Prefer extracting/reusing existing classification enum/sanitization logic instead of cloning divergent enum lists.

Do not make a generic Agent/tool schema.

## Phase C — Managed AI canonical persistence

Change Managed AI provider response validation so a completed job persists canonical SemanticAssessmentV1 JSON.

Preserve:
- current `refId = managed:<global_entry_id>` binding;
- metadata-only input policy;
- optional parent/full-path settings;
- provider and Managed Scope policy;
- before/after fingerprint validation;
- user-correction gate;
- bounded response storage;
- recovery/cancellation/retry behavior.

Backwards compatibility:
- existing completed rows with the old managed classification JSON must decode through an explicit V0/legacy adapter into V1 or remain safely readable;
- do not silently mark old valid assessments corrupt;
- malformed legacy data fails closed.

Do not migrate `files.id`, Global Index identity or Managed Scope ownership.

## Phase D — Organization Plan semantic adapter

Implement a backend-only resolver such as:

`resolve_current_semantic_assessment_for_library_file(...)`

Exact API may differ.

It must prove that the assessment belongs to the current authoritative file and remains valid.

Then update Organization Plan refresh/materialization logic so a `needs_analysis` item can become a deterministic proposal after the Managed AI assessment completes **without requiring an unrelated legacy direct-classification write into `files`**.

Critical rules:

- AI semantic fields are advisory proposal inputs.
- backend derives target using existing organize-root/settings/path builder and safe filename normalization.
- if there is no safe target derivation, keep/review rather than fabricate a path.
- low confidence, sensitive risk, unsupported actions, extension changes, collision, source changes and confirmation remain review/blocking reasons.
- accepted/edited plan items whose semantic assessment changes must go stale/needs-review using existing proposal fingerprint/CAS behavior.
- provider result cannot directly create an executable Operation Preview.
- current dry run and execution path remain unchanged.

Add end-to-end backend tests:

`needs_analysis → enqueue → completed semantic assessment → refresh plan → deterministic proposal → authoritative preview → user decision required → dry run`

and failure cases for stale fingerprint, removed scope, user correction, invalid semantic JSON and malicious raw path fields.

## Phase E — Cleanup vocabulary convergence

Do **not** route Cleanup through Managed AI.

Extract only clearly shared semantic enum/text/confidence validation where useful.

Keep `append_analysis_ai_assessment` conservative authority exactly or stronger:
- no risk downgrade to executable;
- no new trash permission;
- no default selection escalation.

Tests must show a Semantic Assessment cannot bypass detector/Analysis Finding safety.

## Phase F — Rule Proposal separation

No major Rule Proposal rewrite is expected.

Add/adjust architecture/tests so:
- Rule Proposal is policy authoring;
- it does not become a per-file semantic source;
- apply remains disabled-rule creation/update;
- it does not invoke Managed AI classification, Organization Plan execution or filesystem operations.

## Required negative-security tests

Provider/renderer-controlled JSON must not be able to:
- set an arbitrary absolute target;
- target outside organize root through `..` or drive/UNC syntax;
- change extension without policy;
- request DeleteCandidate/MoveToTrash and gain executable authority;
- set `requiresConfirmation=false` to bypass risk review;
- inject operation IDs/batch IDs;
- inject shell/script/tool instructions;
- override current source identity/fingerprint;
- overwrite a user-corrected assessment;
- revive stale/disabled-scope work.

## Schema rule

Default stance: **no new durable semantic table**.

Use the existing durable Managed AI assessment slot if it can carry the versioned canonical payload safely. If a migration is truly needed, stop and document why before adding it; do not create a parallel semantic database.

## Validation

Focused during development:
- Managed AI hardening tests;
- semantic schema/legacy decode tests;
- Organization Plan tests;
- Cleanup safety tests;
- Rule Proposal boundary tests;
- migration tests only if schema actually changes;
- `cargo fmt --check`;
- narrow Clippy;
- `git diff --check`;
- affected frontend/contract tests.

Final exact-head:
- normal full Hosted CI;
- relevant routed performance suites;
- no native visual acceptance is required because this Track does not change UI.

## Result

Create:

`docs/project/tasks/AI-SEMANTIC-AUTHORITY-FOUNDATION-RESULT.md`

Record:
- baseline;
- Production HEAD;
- Final HEAD;
- architecture disposition matrix;
- semantic schema;
- legacy compatibility;
- Organization Plan end-to-end evidence;
- Cleanup safety evidence;
- Rule Proposal separation evidence;
- schema disposition;
- CI;
- residuals;
- #270 remains separate;
- next-product-stage gate.

Allowed pre-owner disposition:

`IMPLEMENTATION COMPLETE — READY FOR OWNER REVIEW`

Do not write `OWNER REVIEW PASSED` yourself.

## Scope guard

Do not:
- remove Rules navigation;
- redesign Automation;
- redesign onboarding;
- make Organize/Cleanup autonomous;
- add agent/tools/shell execution;
- add embeddings/vector DB/RAG;
- change release state;
- fix #270 inside this PR;
- use Codex Review.

Owner review is direct ChatGPT diff/evidence review.
