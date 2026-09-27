# AI-only Product Migration

Status: **ACTIVE — PM-01 implementation — owner deep-audit hold RELEASED**

Owner: Zen Canvas

Product-direction issue: [#273 — AI-only Product Migration](https://github.com/ArdenZC/Zen-Canvas/issues/273)

Branch: `product/pm-01-ai-only-core`

Fresh activation baseline: `master@17599b3344616a43686a376b790cb8bae1f52fa7`

Superseded activation: PR #274 — **CLOSED / not merged / historical design-audit evidence only**.

Owner hold-release comment: `5859384589`.

## Product direction

Zen moves from “AI optional enhancement + Rules semantic fallback” to an AI-required semantic product flow for **new semantic work**:

```text
AI analysis
→ deterministic Zen proposal/safety authority
→ explicit review/confirmation
→ journal / Safe Trash / Restore
```

Without configured/authorized AI, Zen still supports non-semantic capabilities such as Files/Browse, Global Search, Quick Preview, History/Restore and Settings/diagnostics.

Existing still-valid reviewed/durable plans, historical operations and recovery remain usable according to their existing deterministic authority; live provider availability is required for new/refresh semantic analysis, not for already-derived safe recovery/execution evidence.

## Immutable authority boundary

PM-01 must not weaken the merged foundations:

- Managed AI owns current per-file `SemanticAssessmentV1`.
- Organization Plan owns durable organization review state.
- Zen derives target paths deterministically.
- Operation Preview owns executable mutation preview.
- Cleanup Analysis Finding owns deterministic cleanup review truth.
- #276 owns successful/current Cleanup AI assessment publication/currentness and exact provider coverage.
- #279 owns provider/Managed/Content readiness/currentness foundations.
- #285 owns distinct Cleanup local/cloud data-sharing consent and backend Cleanup readiness/enforcement.
- explicit confirmation, Safe Trash, journals and Restore remain mutation/recovery authority.
- provider JSON and renderer state never become filesystem authority.

## Deep-audit closure

Binding closure detail: [AI-only PM-01 Deep-Audit Closure Map](../tasks/AI-ONLY-PM-01-DEEP-AUDIT-CLOSURE.md).

The owner hold is released because the missing foundations are merged:

- stale Cleanup publication race — closed by #276;
- exact provider coverage — closed by #276;
- durable/current assessment binding — closed by #276;
- distinct Cleanup data-sharing consent — closed by #285;
- feature-specific readiness foundation — closed by #279 + #285.

The remaining Preference Memory finding is **not** a missing foundation. PM-01 must correct product truth and must not opportunistically introduce a production Preference Memory authority.

## PM-01 scope

### 1. Feature-specific product readiness

The UI must distinguish:

- provider readiness;
- Organize readiness for a concrete backend-owned Managed Scope/context;
- Cleanup readiness.

Use backend-derived read-only projections/currentness. If no renderer-safe API exists, PM-01 may add a focused read-only Tauri/API projection that wraps existing backend readiness functions. It must not persist another readiness flag or accept renderer permission overrides.

Every gated semantic state must expose clear recovery to existing AI Settings / scope policy.

Do not add idle provider ping polling.

### 2. Organize becomes AI-only for new/refreshed semantics

For new/current proposal derivation:

- no eligible Managed Scope/current validated `SemanticAssessmentV1` → needs-analysis / blocked;
- pending assessment → needs-analysis;
- stale/malformed/policy-invalid assessment → blocked/review;
- valid current Managed AI semantics → deterministic target/proposal path;
- legacy `files` classification/rule fields may remain compatibility/history data but cannot create a new executable proposal.

Already-reviewed still-valid deterministic plan/dry-run evidence remains governed by existing plan/preview/currentness checks rather than live-provider presence.

The primary product action should be Analyze/Generate with AI, with first-class managed-scope/consent recovery.

### 3. Cleanup assessment is required evidence for new executable findings

Continue the accepted architecture:

```text
detectors
→ Analysis Finding/Evidence
→ direct conservative Cleanup AI assessment
→ current-assessment predicate
→ Preview
→ confirmation
→ Safe Trash
```

For newly created/current findings:

- detectors may discover and display facts without AI;
- a finding cannot become newly executable without a successful current AI assessment;
- provider failure/cancel/stale/partial coverage leaves the finding inspectable but non-executable;
- unrelated findings with current assessments remain independently reviewable;
- AI can only preserve/reduce executability, never grant trash/delete authority;
- after a current assessment exists, later deterministic Preview/confirmation/Safe Trash does not require live provider availability unless semantic reassessment is needed.

Use the #276 predicate and #285 readiness/consent; do not create a second Cleanup AI queue or assessment ledger.

### 4. Current semantic explanation / product truth

Active Organize and Operation Preview surfaces must stop using Rules-first or generic legacy-classification copy for current AI proposals.

Expose a **read-only explanation projection bound to the same current semantic proposal/fingerprint**. Prefer projecting already-validated `SemanticAssessmentV1` reason/context/source/version; do not add a second durable semantic ledger merely for display.

Correct active product copy that implies:

- Rules are the current Organize semantic engine;
- AI-disabled means “organization rules” substitute for AI semantics;
- Preference Memory is already used by the current Managed AI worker.

Existing feedback/history capture may remain.

### 5. Cleanup diagnostic truth

Cleanup provider calls must carry explicit bounded trace context with operation `CleanupAnalysis`, not the default `FileClassification`.

Do not add local paths, candidate names or request bodies to trace metadata merely to fix labeling.

### 6. Onboarding / core product story

First-run guidance must communicate:

1. private/reversible safety model — AI proposes, Zen validates/previews/confirms, History/Restore exists;
2. Connect AI — local/cloud provider configuration with explicit skip;
3. choose/index files plus Organize Managed Scope policy; explain Cleanup sharing is separate;
4. core capabilities — Files/Search/Preview → AI Organize → AI Cleanup → History/Restore.

Do not duplicate provider Settings. Skipping AI is allowed; semantic features then remain visibly gated.

### 7. Rules / Automation boundary

PM-01 may remove active copy/CTAs that falsely present Rules as the semantic source for Organize/Cleanup, and may label current Rules surfaces as Advanced / Policies / Compatibility where necessary.

PM-01 must not create Automation Intent/Trigger persistence, scheduling, autonomous execution or PM-02 runtime.

## Research boundary

Issue #283 and the accepted System One / Preference Memory research lane may proceed in parallel, but it is not a PM-01 merge gate.

PM-01 must not add:

- Laya/Jev/System One runtime dependency;
- production Preference Memory schema/service/authority;
- per-user model fine-tuning;
- benchmark-driven semantic routing.

## Non-goals

- agent/tool/shell/MCP runtime;
- embeddings/vector DB/RAG;
- autonomous/scheduled filesystem mutation;
- new mutation authority;
- Global Search/Preview redesign;
- release publication or #270 work;
- Rules schema deletion;
- PM-02 Automation Intent/Trigger architecture;
- unrelated architecture refactoring.

## Gate

PM-01 must reach **IMPLEMENTATION COMPLETE — READY FOR OWNER REVIEW** with exact-head hosted CI and browser/product evidence before owner review.

PM-02 remains blocked until direct owner review/merge of PM-01.
