# AI-only PM-01 — Deep-Audit Closure

Status: **PRE-PM HOLD PREREQUISITES SATISFIED — PM-01 READY FOR FRESH ACTIVATION**

Historical audit source: superseded PR #274 / `AI-ONLY-PM-01-OWNER-DEEP-AUDIT-AMENDMENT.md`.

The old amendment remains historical evidence; this document maps its merge-blocking findings to the merged foundations and separates remaining PM-01 product work from prerequisite work.

## Merge-blocking foundation findings

### A. Cleanup stale-publication race — CLOSED

Closed by #276.

Current production uses exact expected revisions, live identity/policy revalidation and transactional CAS publication.

### B. Cleanup provider coverage — CLOSED

Closed by #276.

Requested candidate coverage is exact: missing/duplicate/unknown candidate results fail closed rather than creating successful current assessment truth.

### C. Durable Cleanup assessment currentness — CLOSED

Closed by #276.

The backend currentness predicate binds current Finding/source/run/detector/provider/settings state and durable assessment evidence.

### D. Distinct Cleanup data-sharing consent — CLOSED

Closed by #285.

Cleanup has separate local/cloud policy in existing AI settings, backend readiness/disclosure/currentness and configured-provider enforcement. Managed Scope or Content consent cannot satisfy it.

### E. One global AI-ready boolean is insufficient — CLOSED AS FOUNDATION

Closed by #279 + #285.

`crate::ai::readiness` now owns derived provider, Managed, Content and Cleanup readiness contexts without a second persisted readiness store.

PM-01 still owns product consumption/presentation of these contexts.

## Remaining PM-01 work — NOT prerequisite foundation

These audit findings remain in PM-01 scope:

- remove current Organize legacy semantic fallback;
- gate new Cleanup execution on current successful assessment evidence;
- preserve already-reviewed deterministic plan/assessment execution without requiring live provider;
- fix active Organization semantic explanation/currentness projection;
- label Cleanup diagnostics as `CleanupAnalysis`;
- correct Rules/Automation/AI-disabled copy;
- correct Preference Memory overstatement without implementing Preference Memory;
- expand onboarding/product feature gating.

## Non-blocking audit notes

The historical amendment also recorded broader hardening/governance observations such as Ollama redirect policy, large-module debt and legacy planning docs. They remain separate unless a current PM-01 change directly touches or invalidates them.

## Hold disposition

The historical #274 design hold is **RELEASED**.

#274 remains closed/superseded and must not be resurrected as the implementation baseline.

PM-01 must begin on a fresh branch from current master using the new initiative/taskbook authority.
