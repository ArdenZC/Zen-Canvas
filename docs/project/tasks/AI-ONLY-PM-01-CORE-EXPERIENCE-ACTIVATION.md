# AI-only Product Migration — PM-01 Core Experience Activation

## Identity

- Initiative: [#273](https://github.com/ArdenZC/Zen-Canvas/issues/273)
- Branch: `product/ai-only-core-experience`
- Baseline: `master@d76bc1f54892bb3e48ac095ea590dcb170f3aa4e`
- Track: **implementation — product behavior/UI plus the minimum backend fail-closed gates**
- PM-02 Automation architecture: **OUT OF SCOPE**

## Mandatory reading

- `docs/project/initiatives/ai-only-product-migration.md`
- `docs/project/initiatives/ai-semantic-authority-foundation.md`
- `docs/project/ARCHITECTURE_MAP.md`
- `src-tauri/src/db/queries/organization/semantic.rs`
- `src-tauri/src/ai/cleanup.rs`
- `src/views/organize/OrganizeSuggestionsView.tsx`
- `src/views/cleanup/StorageCleanupView.tsx`
- `src/store/useAIProcessingModeStore.ts`
- `src/components/OnboardingDialog.tsx`
- `src/views/settings/SettingsView.tsx`
- `src/views/settings/controllers/useSettingsGlobalIndexController.ts`

## A. Product readiness

Introduce a shared frontend product-readiness model for semantic features, based on existing AI settings/runtime capability projections.

At minimum distinguish:

- loading;
- not connected / disabled;
- configuration/runtime unavailable;
- ready.

Do not make frontend readiness a security authority. Backend Organize/Cleanup operations must still fail closed independently.

Use one reusable Connect AI action that routes to the existing AI Settings section.

Do not add provider ping polling to idle UI.

## B. Organize becomes AI-only for new semantics

The critical backend change:

`AssessmentResolution::NotManaged`

must no longer produce a new proposal from legacy `files` classification fields.

For current/new proposal derivation:

- no eligible Managed Scope/current assessment → needs-analysis or explicit blocked/review state;
- pending assessment → needs-analysis;
- valid current V1/V0 Managed AI assessment → deterministic proposal;
- stale/malformed/policy-invalid assessment → blocked/review.

Keep historical materialized plan evidence readable.

Do not erase old `files` fields or remove legacy schema in PM-01.

### UI flow

When AI is unavailable:
- show a full semantic-feature gate with Connect AI;
- allow navigation away;
- do not show a fake Rules-generated suggestion flow.

When AI is ready:
- creating a plan should lead naturally into AI analysis;
- “Analyze/Generate with AI” is primary, not a hidden overflow action;
- surface analysis progress and needs-analysis count;
- if files are outside eligible Managed Scope, show a clear route to manage/consent scopes.

Existing valid reviewed items/dry-runs remain executable without live provider if all deterministic authority checks still pass.

## C. Cleanup AI stage becomes required for new execution

Do not move Cleanup into Managed AI queue.

Continue:

`detectors → Analysis Finding/Evidence → direct Cleanup AI conservative assessment → Preview → confirmation → Safe Trash`

For newly created/current runs:

- AI disabled/unavailable blocks starting the semantic cleanup workflow with Connect AI guidance;
- eligible findings that can be selected for Safe Trash must have a successful AI assessment bound to the current finding/run revision;
- provider failure/cancel leaves evidence visible but cannot silently fall back to detector-only executable selection;
- AI may raise tier/risk, disable action, or require more review;
- AI can never grant trash/delete eligibility.

Prefer backend enforcement in Preview/selection eligibility, not only button disabling.

Do not weaken historical restore/recovery.

## D. Onboarding

Replace the current 2-step story with a bounded first-run sequence that presents the actual product:

1. **Private and reversible** — local index, explicit review, Safe Trash/History;
2. **Connect AI** — local or cloud mode, with Configure AI CTA and clear skip;
3. **Choose files + AI scope** — scan/index folder plus explicit Managed Scope consent/policy;
4. **What Zen does** — Files/Search/Preview, AI Organize, AI Cleanup, History/Restore.

Do not embed a second provider-settings implementation. Reuse/navigate to existing AI Settings.

If AI is skipped, onboarding can complete; Organize/Cleanup remain gated later.

Preserve accessibility/focus/escape behavior and browser-testability.

## E. Rules / Automation PM-01 boundary

Do not redesign Rule Repository or Automation in this PR.

Allowed changes:
- remove copy that implies Rules are the semantic engine for Organize/Cleanup;
- mark Rule Library/Automation settings as Advanced/Policies/Compatibility if necessary for coherence;
- remove ordinary CTAs that tell users to “run rules to generate semantic suggestions” if they conflict with AI-only behavior.

Do not:
- create automation-intent tables;
- add triggers/schedules;
- delete rule schema;
- delete Rule Proposal;
- change Rule execution authority.

PM-02 owns that architecture.

## F. Tests

Required backend:
- NotManaged current Organization projection never falls back to Rules/legacy files semantic proposal;
- valid Managed AI semantics still derive deterministic target/preview;
- already-reviewed valid Plan can proceed without live provider if no new semantic analysis is needed;
- Cleanup preview/execution eligibility fails closed without required current AI assessment;
- AI assessment cannot elevate Cleanup executability.

Required frontend:
- AI unavailable Organize gate + Settings CTA;
- AI unavailable Cleanup gate + Settings CTA;
- AI-ready Organize primary AI analysis flow;
- managed-scope missing state;
- Cleanup AI failure/cancel leaves execution blocked;
- onboarding all steps, skip AI, configure-AI navigation, scan folder/managed-scope consent and final capability story;
- non-semantic Files/Search/Preview/History navigation remains available without AI.

Update browser mock APIs without faking backend authority.

## G. Visual/product evidence

Because PM-01 changes primary UI:

- browser evidence for default + compact/narrow where relevant;
- Organize: AI disconnected, ready/needs-analysis, analysis progress, review/dry-run state;
- Cleanup: AI disconnected, analysis running/failure, reviewed executable preview;
- Onboarding: every step;
- no console errors/warnings attributable to PM-01.

Native owner evidence is not automatically required for every commit, but final owner review may request Windows exact-head captures if browser evidence cannot prove state/layout behavior. Do not claim macOS native acceptance; #270 remains open.

## H. Validation

Focused during development, then one exact-head full hosted CI.

Do not repeatedly run full CI for every UI tweak.

Create:

`docs/project/tasks/AI-ONLY-PM-01-CORE-EXPERIENCE-RESULT.md`

Pre-owner disposition only:

`IMPLEMENTATION COMPLETE — READY FOR OWNER REVIEW`

Never self-declare owner PASS/Ready/Merge.

## Scope guard

No PM-02 Automation schema/runtime, autonomous/scheduled execution, agent/tool/shell runtime, RAG/vector store, release publication or #270 repair. Preserve all #272 deterministic mutation authorities.
