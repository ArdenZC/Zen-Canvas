# AI-only Product Migration — PM-01 Core Experience Activation

## Identity

- Initiative: [#273](https://github.com/ArdenZC/Zen-Canvas/issues/273)
- Branch: `product/pm-01-ai-only-core`
- Fresh baseline: `master@17599b3344616a43686a376b790cb8bae1f52fa7`
- Track: **ACTIVE — implementation**
- Owner deep-audit hold: **RELEASED** by #273 comment `5859384589`
- Superseded Draft PR #274: **CLOSED / historical evidence only**
- PM-02 Automation architecture: **OUT OF SCOPE**
- Research lane #283: **PARALLEL / NON-BLOCKING / NON-PRODUCTION**

## Mandatory reading

Before production changes, read:

- `docs/project/initiatives/ai-only-product-migration.md`
- `docs/project/tasks/AI-ONLY-PM-01-DEEP-AUDIT-CLOSURE.md`
- `docs/project/ARCHITECTURE_MAP.md`
- #276 Cleanup hardening result/current predicate
- #279 AI readiness/consent result
- #285 Cleanup data-sharing consent result
- `src-tauri/src/db/queries/organization/semantic.rs`
- `src-tauri/src/ai/readiness.rs`
- `src-tauri/src/ai/cleanup.rs`
- `src-tauri/src/ai/cleanup/publication.rs`
- active Organization Plan backend + view/store
- `src/views/cleanup/StorageCleanupView.tsx`
- `src/components/OnboardingDialog.tsx`
- `src/components/AppShell.tsx`
- `src/views/settings/SettingsView.tsx`
- active i18n/product copy for Organize/Cleanup/Rules/learning history.

Do not copy old #274 baseline/hold state back into current truth.

## A. Product readiness projection

Do not implement one global `aiReady` boolean.

Required presentation model:

1. provider readiness;
2. Organize readiness for backend-owned Managed Scope/context;
3. Cleanup readiness.

The backend is authority.

If the renderer cannot currently query the merged readiness module, add the smallest read-only Tauri/API projection necessary. It may return status/reason/provider mode/disclosure/current binding and backend-owned context IDs. It must not:

- persist another readiness flag;
- accept renderer-provided consent;
- authorize mutation;
- ping providers while idle.

All semantic gates need a clear Configure/Connect AI recovery path.

Mounted tests must prove provider-ready does not imply Organize/Cleanup-ready.

## B. Organize AI-only semantic derivation

Audit `current_organization_projection` and every caller that can create/refresh a plan.

New/current proposal rules:

- current valid Managed AI assessment → deterministic proposal;
- no eligible Managed Scope → explicit not-managed/needs-analysis state;
- pending/stale/malformed assessment → needs-analysis/blocked;
- legacy classification/rule fields → compatibility/history only, not new proposal authority.

No code path may silently derive a new executable proposal from legacy `files.file_type/purpose/lifecycle/suggested_action/target` when current Managed semantics are absent.

Preserve already-reviewed valid Plan/dry-run execution according to existing deterministic currentness checks.

Add backend behavior tests for NotManaged/current/stale cases and frontend tests for unavailable/needs-analysis/ready states.

## C. Cleanup required-assessment gate

Do not rebuild #276 or #285.

Use:

- #276 exact coverage + CAS + durable/current assessment predicate;
- #285 Cleanup readiness and local/cloud consent.

For new/current selected executable findings:

- missing/stale/failed current assessment → Preview/execution eligibility fails closed;
- deterministic finding remains inspectable;
- current assessment may remain executable through deterministic safety if provider later becomes unavailable;
- one finding's failed reassessment does not invalidate unrelated current findings;
- AI never elevates deterministic executability.

Server-side Preview **and** execution checks are required. Frontend button state is presentation only.

Required tests include:

- missing assessment rejected;
- stale finding revision rejected;
- decision revision alone does not invalidate current assessment;
- current assessment accepted without live provider;
- cloud consent missing blocks assessment generation even if Managed Scope cloud permission exists;
- current local/cloud Cleanup readiness rendered distinctly.

## D. Semantic explanation / copy

The active Organization Plan page must not use legacy Rule/classification explanation as the current AI reason.

Prefer a live/read-only projection of current validated semantic reason/context/source/version tied to the same proposal/currentness fingerprint.

Do not add a second semantic ledger unless owner architecture review proves live projection insufficient.

Correct active copy including, where still present/called:

- AI-disabled descriptions that imply Rules perform semantic organization;
- generic “local rules or classification analysis” Organize reason;
- Operation Preview CTA that instructs running Rules for semantic suggestions;
- Rules/Automation copy that describes Rules as the source of new Organize suggestions;
- learning-history copy that claims current Preference Memory use;
- shell AI summary that contradicts the actual provider state.

Caller-zero/dead compatibility components are not automatically in scope; do not delete them without a bounded retirement proof.

## E. Cleanup trace context

Cleanup provider requests must pass explicit `AITraceContext` with operation `CleanupAnalysis` and bounded job/batch/target metadata.

No path/name/request body in trace metadata.

Add a behavior/contract test that Cleanup traces no longer default to `FileClassification`.

## F. Onboarding

Implement a bounded first-run sequence covering:

1. Private + reversible;
2. Connect AI / local-cloud explanation / skip;
3. files/index + Organize Managed Scope; explicitly distinguish Cleanup sharing permission;
4. product capabilities and next actions.

Reuse existing Settings/provider flows.

Preserve accessibility, Escape/focus behavior, restartability and browser-testability.

Skipping AI completes onboarding but leaves Organize/Cleanup visibly gated.

## G. Rules / Automation PM-01 boundary

Allowed:

- remove live copy/CTA that claims Rules generate current AI-only Organize/Cleanup semantics;
- relabel current Rules/Automation as Advanced / Policies / Compatibility where needed for truth.

Forbidden:

- Automation Intent/Trigger tables;
- schedules/triggers;
- autonomous execution;
- Rule schema deletion;
- changing Rule execution authority.

## H. Preference Memory truth

The production Managed AI worker does not currently consume Preference Memory.

PM-01 must make copy truthful.

Do not add a Preference Memory authority, schema, runtime, fine-tuning path or System One integration. Issue #283 is separate research.

## I. Visual/product evidence

Because PM-01 changes primary experience, capture browser evidence at exact production head for:

Organize:
- provider disconnected/config invalid;
- missing Managed Scope/consent;
- needs-analysis/progress;
- ready current AI proposal + explanation;
- reviewed/dry-run state.

Cleanup:
- provider disconnected/config invalid;
- missing Cleanup consent;
- deterministic findings visible but assessment not executable;
- analysis running/failure/retry;
- current assessed finding review/Preview state;
- provider later unavailable but current assessment remains deterministically reviewable.

Onboarding:
- every step;
- Configure AI navigation;
- skip AI;
- scope/consent explanation;
- final core-capabilities state.

Also run compact/narrow evidence where layout changes materially.

No console errors/warnings attributable to PM-01.

## J. Validation

During development use focused tests.

Before owner review:

- relevant backend focused suites;
- relevant mounted frontend suites;
- `npm run test:governance`;
- frontend build;
- Rust fmt;
- Rust tests;
- Clippy `--all-targets -- -D warnings`;
- diff-check;
- one exact-head full hosted CI.

Create:

`docs/project/tasks/AI-ONLY-PM-01-CORE-EXPERIENCE-RESULT.md`

Pre-owner disposition only:

`IMPLEMENTATION COMPLETE — READY FOR OWNER REVIEW`

Never self-declare owner PASS/merge.

## Scope guard

No PM-02 runtime, autonomous/scheduled mutation, agent/tool/shell runtime, RAG/vector DB, System One production integration, Preference Memory productionization, release publication or #270 repair.
