# Pre-PM Cleanup AI Gate Hardening — Result

Status: **IMPLEMENTATION COMPLETE — OWNER REVIEW PASSED — READY TO MERGE; Draft PR #276 remains open**

## Identity and heads

- Issue: [#275 — Pre-PM Cleanup AI Gate Hardening](https://github.com/ArdenZC/Zen-Canvas/issues/275).
- Branch: `hardening/cleanup-ai-gate`.
- PR: [#276 — Draft](https://github.com/ArdenZC/Zen-Canvas/pull/276).
- Baseline / activation point: `master@d76bc1f54892bb3e48ac095ea590dcb170f3aa4e` (PR #272 merge commit).
- Previous Production HEAD reviewed by the owner: `82634370c98f65fefa95f38bc29f1b72ed9af356`.
- Previous final PR docs HEAD: `f15f868e490ce830ffbbe7fd08634ffed1ce0713`.
- Repaired Production HEAD: `be74b5d428be84bf3d4a3af42853c3a59ec3aa2e`.
- Exact-head hosted CI: [36315267257](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36315267257) — **SUCCESS** on the repaired Production HEAD after rerunning only the failed Windows jobs on the same SHA.
- Final docs-content HEAD after the Production commit: `9dbd7159e9b6e7bf8b87f4be8e17474c51539600`.
- Exact PR CI on that SHA: [36316604667](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36316604667) — **SUCCESS** (Windows/macOS Rust quality, Windows/macOS release compile, all routed performance shards, and source/governance checks).
- Production → final docs-content HEAD is docs-only. Changed paths: `docs/project/ARCHITECTURE_MAP.md`, `docs/project/ROADMAP.md`, `docs/project/STATUS.md`, `docs/project/initiatives/pre-pm-cleanup-ai-gate-hardening.md`, and `docs/project/tasks/PRE-PM-CLEANUP-AI-GATE-HARDENING-RESULT.md`; `git diff --exit-code be74b5d428be84bf3d4a3af42853c3a59ec3aa2e 9dbd7159e9b6e7bf8b87f4be8e17474c51539600 -- src-tauri` passed with no Rust changes.

## Owner review response

Owner review comment [5855180648](https://github.com/ArdenZC/Zen-Canvas/pull/276#issuecomment-5855180648) was **CHANGES REQUESTED**. The owner accepted the stale-publication, exact candidate coverage, CAS, source identity, macOS `logicalSize`, and unchanged cleanup-authority work. The remaining blocker was that `has_current_ai_assessment()` existed only under `#[cfg(test)]`, leaving PM-01 without a production backend currentness authority.

That blocker is repaired. The existing predicate now compiles in production, is available inside the Rust crate through `crate::ai::cleanup::has_current_ai_assessment`, and is not a Tauri renderer command. Regression tests invoke this same implementation. No review thread was replied to or resolved.

Owner re-review comment [5855703556](https://github.com/ArdenZC/Zen-Canvas/pull/276#issuecomment-5855703556) is **OWNER REVIEW PASSED**. The owner accepted the production backend currentness predicate, exact repaired Production HEAD evidence, docs-only successor boundary, focused tests, and unchanged mutation-authority chain. No remaining correctness blocker was identified for this Track.

## Current-assessment authority

`ai_assessment` evidence exists != current AI assessment.

`has_current_ai_assessment(db, finding_id)` reloads the durable Finding by ID and returns false unless all of these remain true:

- the current Finding is active and its live source identity matches;
- the candidate ID appears exactly once in a unique requested candidate set, with matching set, source, and candidate-identity fingerprints;
- the expected Finding revision, published revision, and `published` / `compareAndSwap: succeeded` markers agree;
- the Cleanup Analysis Run remains completed at the captured pre-publication revision plus its one transactional aggregate refresh, with the same source-snapshot and detector-set hashes;
- the detector remains completed at the recorded detector revision;
- persisted AI provider settings still match their captured fingerprint; and
- exactly one durable `ai_assessment` row matches `evidence_summary.aiAssessment`.

Future PM-01 Cleanup gating must consume this backend predicate or a richer backend status API. Renderer code must not infer currentness from raw evidence JSON. The predicate grants no filesystem execution authority; the existing Analysis Finding, Preview, confirmation, Safe Trash journal, and Restore boundaries remain in force.

## Completed

- Preserved provider request binding to candidate IDs, Finding revisions, Analysis Run/source snapshot, detector revisions, source identity, and persisted AI settings.
- Kept exact returned candidate coverage and transactional Finding CAS; omitted, duplicated, malformed, unknown, fabricated, or stale candidates do not become current assessments.
- Preserved the macOS `logicalSize` source identity repair, with `size` remaining the reclaim estimate; no schema migration was added.
- Added a production-compiled currentness predicate that re-reads all durable and live inputs and verifies successful CAS plus matching durable evidence.
- Kept AI advisory. Safe Trash, Operation Preview, confirmation, cleanup journals, and Restore remain the execution and recovery authorities.
- Kept PM-01 inactive, made no UI change, and left #270 separate.

## Validation on Production HEAD `be74b5d428be84bf3d4a3af42853c3a59ec3aa2e`

- Cleanup module: `cargo test --manifest-path src-tauri/Cargo.toml --features "desktop-runtime native-qa" --lib ai::cleanup::tests:: -- --test-threads=1` — **39 passed**. Coverage includes exact/omitted/duplicate/fabricated candidates, successful CAS, Finding revision drift, live source changes, Run revision and source-snapshot changes, detector revision/status changes, provider settings changes, missing/mismatched durable evidence, legacy misaligned identity, and the existing equal-size/allocated-size identity regression.
- Durable Analysis tests — **4 passed**: `analysis_ai_assessment_refreshes_run_aggregate_revision_and_durable_evidence`, `analysis_runs_are_idempotent_revisioned_and_retryable_without_overwriting_active_findings`, `schema_30_reopen_preserves_analysis_run_finding_evidence_and_decision`, and `cancelled_and_source_changed_analysis_runs_never_publish_staged_findings`.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check` — **passed**.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --features "desktop-runtime native-qa" --all-targets -- -D warnings` — **passed**.
- `git diff --check` — **passed**.
- `npm run test:governance` on the updated current-truth documents — **passed**.
- Hosted exact-head CI [36315267257](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36315267257) — **SUCCESS**. Windows and Apple Silicon Rust quality, release compiles, source/governance contracts, and all routed performance shards passed. The initial Windows attempt hit an unrelated Browse test’s `DirectoryPermissionDenied` / `DirectoryNotFound` mismatch; the retry of only the failed Windows jobs passed Rust tests, Clippy, and native filesystem smoke on the same SHA. The same Browse test had passed on the previous PR-head CI [36311346048](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36311346048).

## Visual/native verification

No user-facing UI or window permission changed, so visual verification is not applicable. Hosted Windows filesystem smoke and Apple Silicon lifecycle checks are CI evidence, not native product UI acceptance.

## Acceptance and remaining gates

- [x] Reuse existing Analysis Finding/Run/settings authorities and durable evidence; no schema migration.
- [x] Production backend currentness predicate; tests call the production implementation, with no test-only duplicate.
- [x] Exact candidate binding, successful CAS, live source identity, current Run/detector/policy, and matching durable evidence checks.
- [x] Focused Cleanup, durable Analysis, formatting, Clippy, and diff checks passed.
- [x] Exact repaired Production HEAD hosted CI passed.
- Existing pre-fix Findings with allocated-byte `size` but no `logicalSize` remain non-current/stale until a fresh Cleanup Analysis Run; equal-size legacy snapshots retain their previous shape.
- Exact final docs-content HEAD CI [36316604667](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36316604667) passed. Current Final PR HEAD CI [36317296383](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36317296383) also passed. Owner re-review passed in comment `5855703556`.

PM-01 remains **NOT ACTIVE** on the owner design hold in issue #273 / Draft PR #274. #270 remains separate. PR #276 remains **Draft/open**. No Codex Review, Ready transition, merge, or issue close is requested or performed.

Final pre-merge disposition: **OWNER REVIEW PASSED — READY TO MERGE.** After merge, project-truth documents must advance this Track to **COMPLETE / MERGED** and record the merge SHA / merge-after CI.
