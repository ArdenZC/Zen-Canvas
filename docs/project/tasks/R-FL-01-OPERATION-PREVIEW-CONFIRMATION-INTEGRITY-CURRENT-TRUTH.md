# R-FL-01 — Operation Preview Confirmation Integrity Current Truth

Status: **COMPLETE / CLOSED**

Last verified: 2026-08-27

## Canonical identities

- PHASE A taskbook PR: **#155** — `R-FL-01: freeze operation preview confirmation remediation`.
- PHASE A taskbook squash merge: `master@f672dbbccc270b04d17f4b520c147e8d1b4ba00d`.
- PHASE A taskbook merge tree: `fbab1135bbf630558a440aa7efe972babc536cbc`.
- Production PR: **#156** — `R-FL-01: enforce authoritative operation previews`.
- Final independently reviewed production head: `67ba1d6937327059063f563ad57196f6ae6ff0a7`.
- Final independently reviewed production tree: `ccf1556be0ff046445108ce5d73940e40aeb77c5`.
- Final exact-head hosted CI: run `33048197786` / CI `#1041` — **SUCCESS**.
- Production squash merge: `master@01978a6428c92b0587658f2c53d73c084afcf9f3`.
- Production merge tree: `ccf1556be0ff046445108ce5d73940e40aeb77c5`.

The production squash-merge tree is exactly the final independently reviewed PR tree.

## Independent review record

Independent ChatGPT audit remained the acceptance authority; **Codex Review was not used as acceptance evidence**.

Historical blocker reviews remain provenance only:

- review `5037700322` on `2c452ba6617284f12e76095d446774be340365ac` — blockers = 3; stale refresh, parent-creation fingerprint coverage and positive macOS Permanent Delete execution required remediation;
- review `5038028203` on `d0f88501bcac84f5b3204b7206b332291182f847` — previous blockers closed, one macOS native-qa Clippy blocker remained.

Final exact-head acceptance:

- review `5038363479` on `67ba1d6937327059063f563ad57196f6ae6ff0a7` / tree `ccf1556be0ff046445108ce5d73940e40aeb77c5` — **BLOCKERS = 0**.

GitHub does not permit the PR author's account to approve its own PR, so the external acceptance was recorded as an exact-head review `COMMENT`; the governance decision and evidence are unchanged.

## P1-A final disposition — CLOSED

Operation Preview confirmation integrity is now fail-closed and backend-authoritative:

- every executable selection carries the backend-issued `operationFingerprint` and matching `expectedRevision`;
- the backend re-resolves the current authoritative preview and validates preview ID, file ID, current fingerprint/revision and physical/indexed identity before journal admission;
- missing, empty or stale confirmation revisions fail with `operation_preview_stale` before journal or filesystem side effects;
- whole-batch admission is atomic: one stale selection rejects the entire requested batch;
- renderer IPC still does not gain authority for source path, target path, operation type, risk, executable state, strategy or conflict policy;
- explicit `newName` remains only a backend-normalized user parameter;
- stale confirmation reacquires the appropriate current authoritative preview and requires a new explicit user confirmation; execution is never automatically retried;
- stale Permanent Delete intent is refreshed through the dedicated backend Permanent Delete preview authority rather than being converted to an ordinary preview.

The single backend-issued `operationFingerprint` remains the confirmation revision identity. Its canonical semantics cover confirmation-relevant operation/source/target/provider facts, risk, confirmation requirement, executable/blocking state and parent-creation behavior. No parallel consent version or renderer-owned revision authority was introduced.

## P1-B final disposition — CLOSED

Permanent Delete preview and execution authority are now coherent:

- File Library and legacy Vault no longer fabricate executable `permanent-delete-${fileId}` previews;
- supported macOS obtains a deterministic, file-bound, intent-distinct backend Permanent Delete `OperationPreview`;
- Windows and browser mock runtimes remain explicitly unsupported for Permanent Delete; Windows capability was not expanded;
- preview eligibility and cleanup execution eligibility use the same backend safety policy rather than allowing a preview that the existing executor will inevitably reject;
- a current confirmed Permanent Delete continues through the normal `execute_moves` admission, existing operation journal, existing source-claim/quarantine path, existing filesystem-safety identity checks and existing durable operation outcome/recovery semantics;
- no second delete executor, mutation journal, recovery ledger, renderer path authority or renderer operation-type authority was introduced.

## Required T1–T16 evidence

The final implementation retains the frozen R-FL-01 HARD test matrix. Local Windows implementation validation passed the applicable frontend/Rust/remediation/performance/governance/security gates, including focused stale/fingerprint/batch tests. Platform-specific macOS evidence was then obtained on the final exact head in hosted CI.

Final Apple Silicon macOS run `33048197786` executed, rather than skipped, the R-FL-01 native tests:

- T11 stale Permanent Delete keeps the source and creates no journal admission: **PASS**;
- T16 current backend-authoritative Permanent Delete proceeds through the existing journal/source-claim/quarantine path to durable successful deletion: **PASS**.

The macOS main Rust suite reported `893 passed; 0 failed; 24 ignored`; `desktop-runtime native-qa` Clippy with `-D warnings` passed. Windows Rust tests, Clippy and native hardening also passed on the same exact PR head. Frontend/architecture/browser, release compile, routing/governance and required performance lanes passed in CI `#1041`.

T15 independently proves risk-only and `requires_confirmation`-only changes invalidate old consent. The parent-creation remediation also proves a change in `will_create_parent` changes the canonical fingerprint and old-fingerprint normal Execute admission fails stale with zero journal and filesystem mutation.

## Explicitly unverified / deferred evidence

One pre-existing macOS race fixture remains explicitly outside R-FL-01 acceptance:

- the real cross-volume APFS source-mutation fixture reports `SKIPPED — REAL FIXTURE NOT PROVIDED; NOT VERIFIED` when `ZEN_CANVAS_EXTERNAL_APFS_FIXTURE` is unavailable.

This is retained as truthful fixture-dependent evidence. It was not reclassified as PASS and is not an R-FL-01 T1–T16 acceptance requirement. No other R-FL-01 blocker or stop condition remains open.

## Final authority / compatibility truth

R-FL-01 changed confirmation integrity and Permanent Delete preview acquisition only. It did **not** change:

- the operation journal schema;
- Safe Trash or restore authority;
- the permanent-delete filesystem algorithm/source-claim authority;
- database schema version;
- package version;
- installer/product packaging;
- ADR-0006;
- the W4-04 production CLSID, `ThreadingModel`, Prevhost AppID, 512 KiB ingress ceiling, 16-extension production matrix, `SystemFileAssociations` strategy, foreign-handler conflict rule, Low IL isolation or real Explorer acceptance requirements.

## Completion decision

R-FL-01 is **COMPLETE / CLOSED**.

The completion gate is satisfied because:

1. the PHASE A taskbook merged and supplied the exact implementation baseline;
2. production PR #156 merged from the exact reviewed head;
3. final independent review recorded blockers = 0;
4. exact-head hosted CI `33048197786` succeeded;
5. required T1–T16 evidence, including Apple Silicon T11/T16, is recorded;
6. P1-A and P1-B are both CLOSED;
7. no R-FL-01 stop condition remains unresolved.

## W4-04 sequencing

This closeout does **not** itself start W4-04 production implementation.

The next governance action is a narrow **W4-04 execution-baseline amendment**. That amendment must point W4-04 to the exact post-closeout `master` commit produced when this current-truth PR merges, and must preserve every frozen W4-04 architecture/product decision unchanged. Only after that amendment is independently accepted and merged may a fresh W4-04 implementation branch be created from the amended exact baseline.

W4-05+ remain downstream-gated. W5 remains **NOT AUTHORIZED / NOT ACTIVE**.
