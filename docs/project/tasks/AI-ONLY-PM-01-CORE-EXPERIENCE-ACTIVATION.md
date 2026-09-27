# AI-only Product Migration — PM-01 Core Experience Activation

## Identity

- Initiative: [#273](https://github.com/ArdenZC/Zen-Canvas/issues/273)
- Branch: `product/ai-only-core-experience`
- Baseline: `master@d76bc1f54892bb3e48ac095ea590dcb170f3aa4e`
- Track: **DESIGN HOLD — owner deep-audit amendment must be satisfied before production implementation resumes**
- PM-02 Automation architecture: **OUT OF SCOPE**
- Owner deep-audit amendment: [AI-ONLY-PM-01-OWNER-DEEP-AUDIT-AMENDMENT.md](AI-ONLY-PM-01-OWNER-DEEP-AUDIT-AMENDMENT.md) — **BINDING**

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

Do **not** implement one global AI-ready boolean.

Define a shared presentation model over three distinct backend/product predicates:

1. provider readiness — loading / disabled / configuration invalid / configured;
2. Organize feature readiness — configured provider + eligible Managed Scope + current local/cloud scope policy;
3. Cleanup feature readiness — configured provider + Cleanup AI enabled + explicit Cleanup local/cloud data-sharing policy.

Network reachability is not an idle readiness predicate. It remains unknown until an explicit provider request or connection test.

The existing `useAIProcessingModeStore` may remain a lightweight presentation input, but `enabled + provider` is not sufficient to claim feature readiness.

Do not make frontend readiness a security authority. Backend Organize/Cleanup commands must fail closed independently.

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

## C. Cleanup AI assessment becomes required semantic evidence for new/current executable findings

Do not move Cleanup into Managed AI queue.

Continue:

`detectors → Analysis Finding/Evidence → direct Cleanup AI conservative assessment → Preview → confirmation → Safe Trash`

For newly created/current runs:

- deterministic detectors may still discover and display facts while the provider is unavailable; they cannot by themselves make a finding PM-01 executable;
- **generating or refreshing** the semantic Cleanup assessment requires Cleanup feature readiness and, for cloud, current consent;
- eligible findings that can be selected for Safe Trash must have a **versioned successful AI assessment envelope** bound to the current finding/run revision and current identity;
- once that assessment is current, later Preview/confirmation/Safe Trash does **not** require a live provider merely to execute already-derived evidence; provider availability is not filesystem execution authority;
- provider failure/cancel leaves deterministic findings visible but cannot silently fall back to detector-only executable selection;
- AI may raise tier/risk, disable action, or require more review;
- AI can never grant trash/delete eligibility.

The required assessment protocol is binding:

```text
load active finding + expected revision
→ verify run / scope / path / physical identity
→ construct bounded provider input
→ provider call
→ parse strict schema
→ prove exact candidate-ID bijection
→ conservative merge
→ revalidate finding active + revision + identity
→ CAS publish versioned assessment envelope
→ only then mark assessment current
```

Strict provider coverage means every requested candidate appears exactly once. Missing, duplicate or unknown candidate IDs fail the entire batch and publish no successful assessment for that batch.

The persisted envelope must include at least schema version, finding/run IDs, input/result finding revisions, provider kind/preset/model audit identity, assessed timestamp, deterministic input binding/fingerprint and conservative result payload. Prefer the existing Analysis Finding evidence JSON unless a schema migration is proven necessary.

A user triage decision uses the separate decision revision and does not by itself invalidate an assessment. Any later finding revision change does.

Preview **and** execution must enforce current assessment server-side. Frontend button state is not authority.

Cleanup consent is distinct from Managed Scope consent. A Cleanup AI request always includes the candidate name/metadata and may include parent/full path according to privacy settings. Cloud Cleanup must have explicit Cleanup cloud-consent/policy; an Organize Managed Scope cloud permission cannot be borrowed silently.

Pass explicit `AITraceContext { operation: CleanupAnalysis, ... }` for Cleanup requests so diagnostics are truthful without adding request bodies to trace metadata.

Do not weaken historical restore/recovery.

## D. Onboarding

Replace the current 2-step story with a bounded first-run sequence that presents the actual product:

1. **Private and reversible** — local index, explicit review, Safe Trash/History;
2. **Connect AI** — local or cloud mode, with Configure AI CTA and clear skip;
3. **Choose files + AI scope** — scan/index folder plus explicit **Organize Managed Scope** consent/policy; explain that Cleanup cloud data sharing is a separate permission and never implied by choosing a folder;
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
- Cleanup stale-publication CAS: finding revision or identity changes during provider work publish zero successful assessment;
- Cleanup provider result must exactly cover requested IDs; missing/duplicate/unknown IDs fail closed;
- current assessment envelope binding and invalidation across reassessment/finding revision changes;
- user decision revision does not itself invalidate a current assessment;
- Cleanup preview/execution eligibility fails closed without required current AI assessment;
- cloud Cleanup without explicit Cleanup consent fails closed even when the same path has Managed Scope cloud permission;
- Cleanup diagnostics identify `CleanupAnalysis`;
- AI assessment cannot elevate Cleanup executability.

Required frontend:
- provider readiness vs Organize/Cleanup feature readiness are rendered distinctly;
- AI unavailable Organize gate + Settings CTA;
- current semantic explanation/reason state and stale/unavailable explanation state;
- AI unavailable Cleanup **assessment-generation** gate + Settings CTA while deterministic findings remain inspectable;
- a current already-published Cleanup assessment remains reviewable/executable through deterministic safety even if the provider later becomes unavailable;
- Cleanup cloud-consent missing state + policy CTA;
- AI-ready Organize primary AI analysis flow;
- managed-scope missing state;
- Cleanup AI failure/cancel leaves affected findings non-executable until a successful current assessment exists, without blocking unrelated already-assessed findings;
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


## Owner deep-audit stop condition

The binding owner amendment is [AI-ONLY-PM-01-OWNER-DEEP-AUDIT-AMENDMENT.md](AI-ONLY-PM-01-OWNER-DEEP-AUDIT-AMENDMENT.md).

Do not start production implementation while #274 is under the owner deep-audit hold. The hold is lifted only by an explicit owner comment after the amended taskbook/risk truth is reviewed.
