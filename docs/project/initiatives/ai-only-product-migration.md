# AI-only Product Migration

Status: **ACTIVE — PM-01 DESIGN HOLD pending owner deep-audit closure; production implementation not authorized yet**

Issue: [#273 — AI-only Product Migration](https://github.com/ArdenZC/Zen-Canvas/issues/273)

Activation baseline: `master@d76bc1f54892bb3e48ac095ea590dcb170f3aa4e`.

## Direction

Zen moves from “AI optional enhancement + Rules semantic fallback” to an AI-required semantic workflow:

`AI analysis → deterministic proposal/safety → review/confirmation → journal/restore`

Without AI, non-semantic capabilities remain useful: Files/Browse, Search, Preview, History/Restore and Settings.

## Immutable safety boundary

The PR #272 foundation remains authoritative:

- Managed AI owns per-file semantic assessments.
- Organization Plan owns durable review state.
- Zen derives target paths deterministically.
- Operation Preview owns executable mutation preview.
- Cleanup Analysis Finding owns cleanup review truth.
- Safe Trash / operation journal / Restore own mutation and recovery.
- Provider JSON never owns filesystem mutation authority.

## PM-01 — Core Experience

Branch: `product/ai-only-core-experience`.

Binding audit amendment: [AI-ONLY-PM-01-OWNER-DEEP-AUDIT-AMENDMENT.md](../tasks/AI-ONLY-PM-01-OWNER-DEEP-AUDIT-AMENDMENT.md). While the amendment hold is active, this branch remains docs/design-only.

PM-01 changes product behavior, not the core authority model.

### AI readiness

Use one shared presentation language, but do not collapse readiness into one boolean.

- provider readiness: loading / disabled / configuration invalid / configured;
- Organize readiness: provider + eligible Managed Scope + local/cloud scope policy;
- Cleanup readiness: provider + Cleanup AI enabled + distinct Cleanup local/cloud data-sharing policy.

Network reachability is not polled while idle. Backend commands continue to enforce their own feature-specific policy/security gates.

Every gated state must provide a clear route to AI Settings.

### Organize

- A new/refreshed proposal must come from a current Managed AI semantic assessment.
- Remove the `NotManaged → legacy files classification` semantic fallback for current proposal derivation.
- No current assessment means needs-analysis/pending/blocked, never a Rules-derived executable proposal.
- “Generate/Analyze with AI” is the primary product action.
- A file outside an eligible Managed Scope must expose a clear managed-scope/consent action rather than silently fall back.
- Existing still-valid reviewed plans/dry-runs remain reviewable/executable without a live provider; provider availability is required for **new semantic analysis**, not deterministic recovery/execution.

### Cleanup

- A new Cleanup workflow requires Cleanup feature readiness, not merely a globally enabled provider.
- Deterministic detectors still discover/evidence candidates.
- Before a candidate can enter new executable Safe Trash preview, it must have a versioned successful conservative AI assessment bound to the exact current finding revision/identity.
- Provider batches must cover requested candidate IDs exactly once; missing/duplicate/unknown results fail closed.
- Provider results publish only through post-request finding-revision/identity CAS, preventing stale AI publication.
- Cleanup cloud data-sharing consent is separate from Organize Managed Scope consent.
- AI can only preserve or reduce executability; it cannot create trash/delete authority.
- Provider failure/cancellation leaves findings inspectable but execution blocked until AI assessment succeeds.
- Historical runs/history remain readable and restore remains usable.

### Onboarding

Expand first-run guidance to cover:

1. privacy/safety model;
2. Connect AI / configure provider;
3. choose/index folders and explicit AI-managed-scope consent;
4. core product story: Files/Search/Preview → AI Organize → AI Cleanup → History/Restore.

Users may skip AI. If skipped, semantic surfaces remain visibly gated rather than using Rules fallback.

## PM-02 — Automation Intent + Policies

PM-02 is a separate architecture/implementation gate.

Target direction:

`saved user intent/trigger → fresh Managed AI analysis → deterministic policies/safety → Organization/Cleanup plan → explicit review/confirmation`

Existing Rules move toward Policy/Safety/Preferences/Triggers or compatibility. Do not treat `executeRulesForScopeV2` as the future semantic engine.

PM-01 must not create the durable Automation Intent/Trigger schema opportunistically.

## PM-03 — Migration closeout

Later work may demote/rename legacy Rule Library surfaces, remove stale rule-centric copy/routes, and perform final browser/native product regression.

## Non-goals

No agent/tool/shell runtime, RAG/vector store, autonomous filesystem changes, release publication or #270 repair.


## Owner deep-audit hold

PM-01 production code is paused while the owner deep-audit amendment is active. The audit found required-AI contract gaps in Cleanup assessment currentness, exact provider coverage, durable assessment binding, feature-specific consent/readiness and diagnostic labeling. These are design-contract corrections, not a rollback of PR #272.

The hold is released only by explicit owner disposition after the amended taskbook and risk truth are reviewed.
