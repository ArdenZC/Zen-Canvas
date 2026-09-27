# AI-only Product Migration

Status: **ACTIVE — implementation — PM-01 Core Experience**

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

PM-01 changes product behavior, not the core authority model.

### Shared AI readiness

Provide one product-level projection for semantic-feature readiness. It must distinguish at least loading, disabled/not-connected, configuration/runtime failure and ready. This is UI/product readiness only; backend commands continue to enforce their own policy/security gates.

Every gated state must provide a clear route to AI Settings.

### Organize

- A new/refreshed proposal must come from a current Managed AI semantic assessment.
- Remove the `NotManaged → legacy files classification` semantic fallback for current proposal derivation.
- No current assessment means needs-analysis/pending/blocked, never a Rules-derived executable proposal.
- “Generate/Analyze with AI” is the primary product action.
- A file outside an eligible Managed Scope must expose a clear managed-scope/consent action rather than silently fall back.
- Existing still-valid reviewed plans/dry-runs remain reviewable/executable without a live provider; provider availability is required for **new semantic analysis**, not deterministic recovery/execution.

### Cleanup

- A new Cleanup workflow requires AI readiness.
- Deterministic detectors still discover/evidence candidates.
- Before a candidate can enter new executable Safe Trash preview, it must have the required successful conservative AI assessment for that run/revision.
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
