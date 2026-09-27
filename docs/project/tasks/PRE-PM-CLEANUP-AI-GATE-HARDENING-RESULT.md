# Pre-PM Cleanup AI Gate Hardening — Result

Status: **IMPLEMENTATION COMPLETE — READY FOR OWNER REVIEW; Production HEAD CI passed; Draft PR #276 remains open**

## Identity and heads

- Issue: [#275 — Pre-PM Cleanup AI Gate Hardening](https://github.com/ArdenZC/Zen-Canvas/issues/275).
- Branch: `hardening/cleanup-ai-gate`.
- PR: [#276 — Draft](https://github.com/ArdenZC/Zen-Canvas/pull/276).
- Baseline / activation point: `master@d76bc1f54892bb3e48ac095ea590dcb170f3aa4e` (PR #272 merge commit).
- Validated Production HEAD: `82634370c98f65fefa95f38bc29f1b72ed9af356`.
- Exact-head hosted CI: run [36310434782](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36310434782) — **SUCCESS** on the Production HEAD. The current-truth docs update is a docs-only successor and does not change the production evidence binding.

## Root cause

Before this change, provider outputs were collected into a map where repeated IDs overwrote prior responses. Missing outputs fell back to the unchanged deterministic Finding and were still appended as AI evidence. Publication read the latest Finding and checked only that it remained active; it did not compare the revision captured before provider work, bind evidence to the exact request candidate set, or revalidate run/source/detector/provider-policy state.

Hosted macOS CI then exposed a second source-identity mismatch: Cleanup's reclaim estimate can be allocated bytes (4096 for a 29-byte fixture), while `metadata.len()` is the logical file length. The approved-path identity check compared those unlike values and rejected valid current Findings before provider work. The identity snapshot now preserves `size` as the reclaim estimate and adds `logicalSize` only when it differs; revalidation checks the live metadata length against that field and still compares the full identity snapshot.

## Completed

- Captured exact requested Finding revisions, Analysis Run revision/source snapshot/detector-set hash, detector revisions, source identity snapshots, candidate-set identity and persisted `ai_settings_v1` row fingerprint before provider work.
- Preserved macOS source identity for files whose allocated-byte reclaim estimate differs from logical length; no migration or cleanup authority change was needed.
- Waited for every provider batch before publication; revalidated current AI settings, run status/revision/snapshot, detector state, every Finding precondition and live source identity.
- Parsed response envelopes and candidate objects strictly. Unknown authority fields fail closed. Candidate IDs bind outputs to the backend request manifest; response ordering is irrelevant.
- Aggregated exact coverage across batches. A candidate is eligible only if its ID is a requested backend ID returned exactly once. Omitted and duplicate candidates receive no AI evidence; unknown IDs are rejected and counted; malformed/stale output publishes nothing.
- Published all eligible candidates in a single immediate transaction. The transaction repeats the run, settings, detector, identity and revision preconditions; Finding updates use expected revision CAS. CAS loss rolls back the invocation.
- Stored candidate/request fingerprints, coverage counts, source/run/detector/policy bindings and a successful CAS/published revision marker in existing Analysis Finding evidence. No deterministic fallback is labeled as AI evidence.
- Kept deterministic safety and the Preview → confirmation → Safe Trash journal → Restore chain unchanged. No schema migration was needed.
- Split the publication lifecycle and its real-path fixtures into `cleanup/publication.rs` and `cleanup/tests.rs` to keep the main AI cleanup module cohesive.

## Authority and compatibility paths

- Analysis Finding/Evidence/Decision remains the Cleanup semantic/persistence authority.
- Existing `Analysis Run` and Finding revisions, detector revisions, live identity validation, provider settings and `analysis_finding_evidence` express the required currentness checks.
- Existing frontend return shape receives only actually published Findings; omitted candidates remain skipped instead of being counted as assessed.
- Safe Trash execution, operation previews, confirmation, journals and Restore are unchanged and remain independently authoritative.
- No schema migration, second AI queue, renderer path authority, new filesystem authority or product UI change was introduced.

## Validation on Production HEAD `82634370c98f65fefa95f38bc29f1b72ed9af356`

- `cargo test --manifest-path src-tauri/Cargo.toml --features "desktop-runtime native-qa" --lib ai::cleanup::tests:: -- --test-threads=1` — **29 passed**, including the allocated-size/logical-size identity regression, real Analysis Run/Finding publication, omission/duplicate/unknown coverage, malformed authority fields, reordered IDs, source and provider-policy changes, run replacement, concurrent stale CAS, and empty requests.
- `cargo fmt --all -- --check` — **passed**.
- `git diff --check` — **passed**.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --features "desktop-runtime native-qa" --all-targets -- -D warnings` — **passed**.
- Hosted exact-head run [36310434782](https://github.com/ArdenZC/Zen-Canvas/actions/runs/36310434782) — **SUCCESS**. Windows/macOS Rust quality, release compiles, all routed performance shards, Windows native filesystem smoke, macOS lifecycle/race/Quick Look steps, source checkout and validation contracts passed. Docs-only and unrelated optional package lanes were skipped by routing.
- Earlier exact-head CI attempts `36307749089`, `36308871887` and `36309515624` were diagnostic failures on preceding commits; the last exposed the macOS allocated-size/logical-size mismatch. They are superseded for acceptance by the successful run on `82634370`.

## Visual/native verification

No user-facing UI, window permission or visual state changed. Native visual verification is not applicable to this backend-only gate. Hosted CI macOS lifecycle and Windows filesystem smoke are test evidence, not native product UI acceptance.

## Acceptance and remaining gates

- [x] Reuse existing Finding/Run/policy revisions and durable evidence; no schema migration.
- [x] Exact returned candidate ID and coverage semantics; no fallback evidence.
- [x] Post-provider validation and transactional Finding revision CAS.
- [x] Focused local parsing, safety, lifecycle and concurrency tests.
- [x] Exact Production HEAD hosted CI passed on `82634370c98f65fefa95f38bc29f1b72ed9af356`.
- Existing pre-fix findings whose stored `size` is an allocated-byte estimate and lack `logicalSize` continue to fail closed as stale; a fresh Cleanup Analysis Run records the corrected identity snapshot. Equal-size legacy snapshots retain their previous shape.
- Direct owner review is the next project decision; no review submission has been requested or recorded.

PM-01 remains **NOT ACTIVE** and on the owner design hold in issue #273 / Draft PR #274. #270 remains separate. No Codex Review, Ready transition or merge is requested or performed.

Final disposition: **READY FOR OWNER REVIEW — production-head hosted CI passed; PR #276 remains Draft/open and owner review is pending.**
