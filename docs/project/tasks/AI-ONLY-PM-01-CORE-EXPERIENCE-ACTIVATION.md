# AI-only Product Migration — PM-01 Core Experience Activation

Status: **ACTIVE — implementation**

Product-direction issue: [#273](https://github.com/ArdenZC/Zen-Canvas/issues/273)

Historical superseded PR: #274 — closed/not merged.

Fresh implementation branch: `product/pm-01-ai-only-core-experience`.

Activation baseline: `master@189c0fd522579d643216e313d6fcb6bcc8467ab7`.

## Mandatory foundations

Do not reproduce foundation work already merged:

- #272 — `SemanticAssessmentV1` / Managed AI / Organization authority;
- #276 — Cleanup exact coverage, CAS publication, current-assessment predicate;
- #279 — provider + Managed + Content readiness;
- #285 — distinct Cleanup local/cloud sharing consent + Cleanup readiness/enforcement.

Read:

- `docs/project/initiatives/ai-only-product-migration.md`
- `docs/project/tasks/AI-ONLY-PM-01-DEEP-AUDIT-CLOSURE.md`
- `docs/project/ARCHITECTURE_MAP.md`
- `src-tauri/src/ai/readiness.rs`
- `src-tauri/src/db/queries/organization/semantic.rs`
- `src-tauri/src/ai/cleanup.rs`
- `src-tauri/src/ai/cleanup/publication.rs`
- current Organize/Cleanup/Onboarding/Settings frontend surfaces and mounted tests.

## A. Organize AI-only current semantics

Backend requirement:

- remove current `AssessmentResolution::NotManaged` legacy semantic proposal fallback;
- no current eligible Managed assessment -> explicit unavailable/needs-analysis state;
- stale/malformed/policy-invalid assessment remains blocked;
- valid current Managed semantics continue through deterministic Zen target/Plan/Preview authority;
- historical reviewed plans remain readable/executable subject to their existing deterministic safety/currentness checks.

Do not delete legacy classification fields/schema in PM-01.

Tests:
- NotManaged never derives a new legacy semantic proposal;
- valid current V1/V0 semantics still derive the same deterministic target/preview;
- reviewed valid plan does not require live provider only for execution/recovery.

## B. Active semantic explanation

The active Organization Plan product surface must stop using vague Rules/classification fallback copy.

Expose a read-only explanation projection bound to the same current semantic proposal/fingerprint. Prefer projection from already-validated `SemanticAssessmentV1`; do not create a second durable semantic ledger merely for display.

Explanation stale/current behavior must match proposal stale/current behavior.

## C. Cleanup execution gate

Generating/refreshing a Cleanup assessment uses backend Cleanup readiness from #285.

New/current Cleanup execution eligibility must fail closed unless selected executable findings have current successful conservative AI assessment evidence from #276.

Important distinction:

- **assessment generation** requires provider readiness + Cleanup consent;
- **execution of already-current evidence** does not require live provider availability solely because the provider is later offline.

Provider failure/timeout/cancel/incomplete/stale result leaves affected findings inspectable but non-executable; unrelated already-current assessments remain usable.

Backend Preview/execution, not just frontend buttons, must enforce the assessment predicate.

## D. Cleanup diagnostics

Cleanup provider requests currently default `trace_context: None`.

PM-01 must pass bounded `AITraceContext` with `CleanupAnalysis` plus job/batch/target identifiers appropriate to existing trace policy.

Do not add path/name/request body to trace metadata merely to fix operation labeling.

## E. Feature readiness UX

Use the merged backend readiness model.

UI states must distinguish:

- provider disabled/config invalid/missing credential;
- Organize missing/ineligible Managed Scope consent/current semantic state;
- Cleanup feature disabled or local/cloud Cleanup consent missing.

Use one shared route/CTA to existing AI Settings where appropriate.

Do not add idle network polling.

Do not let frontend readiness become backend authority.

## F. Onboarding

Build a bounded first-run story:

1. private + reversible;
2. Connect AI / local vs cloud / explicit skip;
3. choose/index folders + Managed AI scope consent;
4. explain separate Cleanup sharing permission;
5. core capability story: Files/Search/Preview → AI Organize → AI Cleanup → History/Restore.

Do not embed a second provider-settings implementation.

Skipping AI completes onboarding but leaves Organize/Cleanup visibly gated.

Preserve focus/Escape/accessibility and browser-testability.

## G. Product-truth / Rules / Preference copy

Correct active production copy that conflicts with AI-only truth, including:

- AI-disabled descriptions that imply Rules provide an equivalent organization semantic mode;
- Organize explanation/copy that says suggestions come from local rules/classification;
- Operation Preview empty-state CTAs that tell users to run Rules to generate Organize semantics;
- ordinary Rules/Automation copy that presents Rules as the future semantic suggestion engine;
- learning-history copy that claims current Preference Memory input when production Managed AI does not consume it.

Allowed: relabel Rules/Automation toward Advanced / Policies / Compatibility where needed.

Not allowed: PM-02 automation architecture or new Preference Memory authority.

## H. Backend/frontend behavior tests

Backend minimum:
- Organize no legacy semantic fallback;
- current Managed semantic path preserved;
- reviewed valid plan execution independent of live provider;
- Cleanup Preview/execution blocks missing/stale assessment;
- current Cleanup assessment remains usable after provider later unavailable;
- Cleanup readiness/consent remains distinct from Managed/Content permission;
- Cleanup diagnostics operation is `CleanupAnalysis`;
- AI cannot elevate deterministic Cleanup executability.

Frontend/mounted minimum:
- provider vs Organize vs Cleanup readiness states;
- Connect AI / scope/consent recovery CTAs;
- Cleanup deterministic findings remain inspectable while assessment generation is blocked;
- already-current assessed finding remains reviewable when provider later unavailable;
- onboarding all steps + skip/configure paths;
- product copy no longer claims Rules/Preference Memory as current semantic authority;
- Files/Search/Preview/History remain available without AI.

Update browser mock API only as presentation test support; do not fake authority.

## I. Evidence / validation

During implementation use focused tests.

Before owner review:
- one exact-head full hosted CI;
- browser evidence for Organize disconnected/needs-analysis/ready/review states;
- Cleanup disconnected/consent-missing/analysis-failure/current-assessment/preview states;
- onboarding steps at default and compact/narrow layouts where relevant;
- no PM-01-attributable console errors/warnings.

Create `docs/project/tasks/AI-ONLY-PM-01-CORE-EXPERIENCE-RESULT.md`.

Pre-owner final disposition only:

`IMPLEMENTATION COMPLETE — READY FOR OWNER REVIEW`

Owner review is direct diff/evidence review; Codex Review is not merge authority.

## Scope guard

No PM-02 schema/runtime, autonomous/scheduled execution, agent/tool/shell runtime, RAG/vector store, System One/Laya/Jev production integration, Preference Memory persistence, release publication or #270 repair.

## Activation disposition

**ACTIVE — implementation.** The fresh branch is based on the reviewed post-Pre-PM master. Production implementation is authorized only within this taskbook; owner review remains required before merge and before PM-02.
