# AI-only Product Migration

Status: **ACTIVE INITIATIVE / SPECIFICATION ONLY — PM-01 COMPLETE / MERGED; PM-02A COMPLETE / MERGED / OWNER REVIEW PASSED / MERGE-AFTER CI SUCCESS; PM-02B ACTIVATION UNDER OWNER REVIEW / IMPLEMENTATION NOT ACTIVE; PM-03 NOT ACTIVE**

Issue: [#273 — AI-only Product Migration](https://github.com/ArdenZC/Zen-Canvas/issues/273)

Superseded historical activation: PR #274 — **CLOSED / not merged**.

Accepted PM-01 authority: [PM-01 Core Experience Activation](../tasks/AI-ONLY-PM-01-CORE-EXPERIENCE-ACTIVATION.md).

Merged PM-02A authority (PR #312): [Automation Intent Foundation Activation](../tasks/AI-ONLY-PM-02A-AUTOMATION-INTENT-FOUNDATION-ACTIVATION.md).

Deep-audit closure: [PM-01 Deep-Audit Closure](../tasks/AI-ONLY-PM-01-DEEP-AUDIT-CLOSURE.md).

## Product direction

Zen moves from optional AI enrichment plus legacy semantic fallback to an **AI-required semantic product experience** for new/refreshed Organize and new executable Cleanup work:

```text
AI analysis / semantic evidence
→ deterministic Zen proposal and safety authority
→ review / confirmation
→ Operation Preview or Cleanup Preview
→ journal / Safe Trash / Restore
```

Without configured/consented AI, non-semantic capabilities remain available:

- Files / Browse;
- Global Search;
- Quick Preview;
- History / Restore;
- Settings / diagnostics.

Organize/Cleanup must show explicit feature-specific gating rather than silently reverting to Rules or legacy classification.

## Accepted foundations — do not rebuild

PM-01 starts after these merged foundations:

- #272 — AI Semantic Authority Foundation: canonical `SemanticAssessmentV1`, Managed AI binding, deterministic Organization target derivation.
- #276 — Cleanup AI Gate Hardening: exact provider candidate coverage, stale-publication CAS, durable/current assessment predicate and conservative publication.
- #279 — AI Readiness + Consent Contract: backend provider readiness plus separate Managed and Content readiness/consent projections.
- #285 — Cleanup AI Data-Sharing Consent Gate: separate fail-closed Cleanup local/cloud permission, Cleanup readiness/currentness/disclosure and backend enforcement.

PM-01 must **consume** these authorities. It must not create a parallel readiness store, semantic ledger, Cleanup queue, provider runtime or mutation authority.

## PM-01 product behavior

### Organize

- New/refreshed proposal semantics require current Managed AI assessment.
- `AssessmentResolution::NotManaged` must not fall back to legacy `files` classification/rules as current semantic authority.
- Missing/ineligible/stale/pending semantics produce needs-analysis or explicit blocked state.
- Existing still-valid reviewed plans/dry-runs remain deterministic durable evidence and do not require a live provider merely to execute/recover.
- Current product UI must expose a truthful explanation from the current semantic binding rather than legacy Rules/classification copy.

### Cleanup

- Deterministic detectors remain fact/discovery authority.
- For new/current execution eligibility, each selected executable finding must have a current successful conservative AI assessment proven by the merged backend currentness predicate or an equivalent richer backend status.
- Generating/refreshing assessment requires current Cleanup readiness/consent.
- Once a current assessment exists, Preview/confirmation/Safe Trash does not require provider reachability solely to execute already-derived evidence.
- AI cannot grant trash eligibility, lower deterministic risk, bypass acknowledgement/Preview/identity/confirmation or issue permanent delete.
- Failed/cancelled/stale/incomplete AI assessment leaves deterministic findings inspectable but not newly executable.
- Cleanup diagnostics must identify `CleanupAnalysis`, not default FileClassification.

### Product readiness

Use backend readiness context, not one frontend boolean:

- provider readiness;
- Organize/Managed readiness;
- Cleanup readiness.

A shared Connect AI affordance is allowed. Renderer state remains presentation only.

### Onboarding and product truth

First-run guidance should communicate:

1. private/reversible safety model;
2. Connect AI / local vs cloud provider, with explicit skip;
3. choose/index folders and explicit Managed Scope permission;
4. Cleanup sharing is a separate permission;
5. Files/Search/Preview → AI Organize → AI Cleanup → History/Restore.

Skipping AI is allowed; semantic features remain visibly gated.

PM-01 must remove or correct current copy that claims:
- Rules are the semantic engine for Organize/Cleanup;
- Preference Memory is already an active input to the durable Managed AI worker;
- AI-off means semantic organization continues through local Rules as the equivalent product mode.

Do not implement Preference Memory in PM-01.

## PM-02 / PM-03 boundary

PM-02 separately owns Automation Intent / Trigger / Policy architecture.

PM-02 is now decomposed into separately gated slices:

- **PM-02A — Automation Intent Foundation:** **COMPLETE / MERGED through PR #313; OWNER REVIEW PASSED; merge-after master CI 36821813846 SUCCESS.** Durable Organize-plan intent, manual trigger, fixed review-required / never-auto-execute policy, durable run receipt, fresh Query V2 snapshot resolution and Organization Plan handoff. Windows native + restart acceptance is PASS. See the [bounded implementation result](../tasks/AI-ONLY-PM-02A-AUTOMATION-INTENT-FOUNDATION-RESULT.md).
- **PM-02B — Event / Schedule Triggers:** dedicated [activation taskbook](../tasks/AI-ONLY-PM-02B-EVENT-SCHEDULE-TRIGGER-ACTIVATION.md) is **OWNER REVIEW PENDING**. It proposes bounded Schedule + Managed-scope-change triggers, startup/wake recovery only, durable coalescing/idempotence and existing WorkScheduler/RuntimeResourceGovernor admission. Implementation remains **NOT ACTIVE** until activation merge.
- Any additional workflow kinds or richer planner semantics require another bounded activation.

PM-03 later owns remaining hierarchy/compatibility migration closeout.

PM-02A must preserve Rule Repository V2 and existing Organization/Managed AI authorities. It must not create schedule loops, autonomous mutation, a second scheduler/AI queue, System One/Laya/Jev runtime integration, Preference Memory persistence, RAG/vector store, agent/tool/shell execution or release publication.

## Research boundary

Issue #283 is parallel/non-blocking research. Its bounded ZDB-03B screen is complete and frozen at `INCONCLUSIVE_LOW_DELTA`; the Owner disposition pauses further comparative execution and keeps the >=300 Stage-B corpus inactive.

PM-02A does not consume Preference Memory as production authority.

Production adoption of System One or Preference Memory requires later benchmark evidence and separate architecture review.

## Current activation rule

PM-01 is complete.

PM-02A is **COMPLETE / MERGED / OWNER REVIEW PASSED** through PR #313 at `master@195e3b18b4bfa718276829f9ed35414714689a7f`; merge-after master CI `36821813846` is **SUCCESS**.

Current PM-02B activation baseline:

`master@5a4b67e1f0d2d5b3d6bd26c1d19df16a992fea98`

Current activation taskbook:

`docs/project/tasks/AI-ONLY-PM-02B-EVENT-SCHEDULE-TRIGGER-ACTIVATION.md`

PM-02B activation is **OWNER REVIEW PENDING / SPECIFICATION ONLY**. Production implementation remains **NOT ACTIVE** until the dedicated activation PR passes Owner review and merges.

Merge of that activation may authorize only PM-02B Event / Schedule Trigger implementation. PM-03, Cleanup automation, startup-as-a-user-trigger, Preference Memory production, System One, Laya/Jev, general agents and autonomous filesystem mutation remain separately gated.
