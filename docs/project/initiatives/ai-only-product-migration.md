# AI-only Product Migration

Status: **ACTIVE — implementation — PM-01 Core Experience on `product/pm-01-ai-only-core-experience`**

Issue: [#273 — AI-only Product Migration](https://github.com/ArdenZC/Zen-Canvas/issues/273)

Superseded historical activation: PR #274 — **CLOSED / not merged**.

Fresh activation authority: [PM-01 Core Experience Activation](../tasks/AI-ONLY-PM-01-CORE-EXPERIENCE-ACTIVATION.md).

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

PM-03 later owns remaining hierarchy/compatibility migration closeout.

PM-01 must not create automation-intent tables, schedules, autonomous mutation, System One/Laya/Jev runtime integration, Preference Memory persistence, RAG/vector store, agent/tool/shell execution or release publication.

## Research boundary

Issue #283 is parallel research only and is not a PM-01 merge gate.

Production adoption of System One or Preference Memory requires later benchmark evidence and separate architecture review.

## Activation rule

Activation baseline: `master@189c0fd522579d643216e313d6fcb6bcc8467ab7`.

Implementation branch: `product/pm-01-ai-only-core-experience`.

This record is **ACTIVE — implementation**. Production code may change only within the PM-01 scope and safety boundaries above.
