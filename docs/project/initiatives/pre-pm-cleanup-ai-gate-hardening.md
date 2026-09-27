# Pre-PM Cleanup AI Gate Hardening

Status: **ACTIVE — implementation — implementation complete; OWNER REVIEW PASSED — READY TO MERGE after owner re-review comment 5855703556; Production HEAD CI passed; Draft PR #276 remains open**

Issue: [#275 — Pre-PM Cleanup AI Gate Hardening](https://github.com/ArdenZC/Zen-Canvas/issues/275)

Branch: `hardening/cleanup-ai-gate`

Activation baseline: `master@d76bc1f54892bb3e48ac095ea590dcb170f3aa4e` (PR #272 merge commit).

Previous Production HEAD reviewed by the owner: `82634370c98f65fefa95f38bc29f1b72ed9af356`. Repaired Production HEAD: `be74b5d428be84bf3d4a3af42853c3a59ec3aa2e`; exact-head hosted CI [36315267257](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36315267257) passed.

## Objective

Close the two Cleanup AI correctness gaps found before PM-01 can be considered:

1. a provider result can become stale while the provider is running;
2. a returned batch does not prove exact per-candidate coverage.

Provider output remains advisory. Cleanup Analysis Finding, Preview, Safe Trash, confirmation, journals and Restore remain the current durable authorities.

## Cross-platform source identity finding

The macOS storage analyzer may report allocated bytes as the cleanup reclaim estimate, while filesystem metadata reports the file's logical byte length. A 29-byte fixture can therefore have a 4096-byte cleanup `size`. Comparing those different quantities made live source identity appear stale and blocked Cleanup AI before its provider call. The Finding keeps `size` as the reclaim estimate and records `logicalSize` only when the two values differ; live revalidation compares metadata length against `logicalSize`. This adds no schema or authority and leaves equal-size identity snapshots unchanged.

## Scope

- Bind provider work to the exact backend candidate manifest, Finding revisions, Analysis Run/source snapshot, detector revisions and persisted AI settings fingerprint.
- Revalidate provider policy, run/detector state, Finding revisions and live source identity after all provider batches return.
- Preserve exact source binding when a macOS allocated-byte reclaim estimate differs from logical file length.
- Publish only exact candidate IDs returned once, through one immediate database transaction that repeats the precondition checks and uses Finding revision CAS.
- Record requested/returned/omitted/duplicate/unknown coverage, source and candidate fingerprints, policy/run/detector revisions and publication CAS result in existing Analysis Finding evidence.
- Expose `has_current_ai_assessment` as a production-compiled backend-only predicate for future PM-01 gating; it re-reads current durable state and does not expose a Tauri renderer command.
- Keep omitted, duplicated, malformed, unknown and stale results out of current assessment evidence; do not persist an unchanged deterministic fallback as an AI result.
- Add real Analysis Run/Finding lifecycle and concurrency coverage.
- Cover allocated-size versus logical-size identity with a regression test that requires a mismatch on macOS.

## Boundaries

- No schema migration, second AI queue, second Finding authority or new cleanup execution/recovery authority.
- No change to Operation Preview, explicit confirmation, Safe Trash, cleanup journal or Restore.
- No PM-01 UI/product work, no SemanticAssessmentV1 reimplementation and no change to #270.
- PM-01 remains **NOT ACTIVE** on the owner design hold associated with issue #273 / Draft PR #274.

## Acceptance

- Candidate coverage is exact and identity-bound; provider order cannot reassign outputs.
- Source, Finding, Analysis Run, detector and AI settings changes block publication.
- Concurrent provider requests cannot overwrite a newer Finding revision.
- Evidence exists only for eligible unique returned candidates and records successful CAS publication.
- `ai_assessment` evidence exists != current AI assessment; consumers use the backend predicate or a richer backend status API, never renderer-side evidence JSON interpretation.
- Focused parsing, publication, safety, durable-lifecycle and race tests pass on the production SHA.
- Exact-head hosted CI passed and owner re-review passed in comment `5855703556`; merge remains the only closeout gate before this initiative becomes COMPLETE / MERGED. PM-01 remains separately held.

Production-code validation is bound to the exact Production HEAD above. The current-truth docs update follows it as a docs-only successor and remains independently subject to its PR checks.

See [the result record](../tasks/PRE-PM-CLEANUP-AI-GATE-HARDENING-RESULT.md) and [Draft PR #276](https://github.com/ArdenZC/Zen-Canvas/pull/276).
