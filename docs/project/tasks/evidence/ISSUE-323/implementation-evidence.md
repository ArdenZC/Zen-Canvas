# Issue #323 implementation evidence

2026-10-07: [implementation result](../../WINDOWS-GLOBAL-INDEX-RECOVERY-323-RESULT.md).

Baseline `e41fda178c6e6c8af48f8af63cc06453e8339c48` / tree `bb74979786955592473f01e76b74d62a3d4ed9b5`. Implementation branch `fix/issue-323-windows-global-index-recovery`. Schema 37 / package 0.1.40 / pipe protocol v3.

Task-owned local logs: `E:\CargoTarget\issue323-evidence`. Initial focused run: 62 passed, two failed, three ignored; existing fixtures still encoded the old string-based classification and were updated to the typed contract without weakening assertions. An intermediate QA compile failed because an incorrect constructor argument was supplied, then corrected to the existing with_wake/database binding. Final focused run including all 11 discontinuity matrix cases: 67 passed, three ignored. Full local Rust library: 1134 passed, three failed, 26 ignored. Untouched exact-baseline Automation subset: 33 passed and the same three failures (current_assessment_needs_no_credential_or_new_enqueue, stale_assessment_checks_fresh_readiness_and_keeps_plan, automatic_current_and_stale_semantics_reuse_shared_admission_without_mutation). Broad Rust is FAIL and remains a review limitation; no credentials or Automation implementation were modified. Broad and hosted conclusions must be recorded against the final implementation HEAD in the PR handoff. No skipped/ignored check is PASS.

Required hosted evidence: `service-recovery.json`, `recovery-trace.log`, original service/SCM/same-image/security evidence and normal background-client route/residency/freshness evidence. No installed-service transport or native Owner PASS is inferred from local force-direct/unit tests. At the historical implementation checkpoint, Owner native qualification was NOT PERFORMED / NOT AUTHORIZED YET; later separate native qualification and Owner disposition are recorded below.

Automatic user-file mutation authority added = 0. No production database migration or journal/volume mutation. The hosted qualification seeds only its task-owned isolated recovery metadata, explicitly recorded in the result/report. Historical PM-03/#323 evidence remains intact.

## Hosted evidence retention follow-up

Accepted product candidate `251a6371fb9e9bee7d88cb585c233c9c34b86fcd` / tree `7bdcff3eff08b96dc1e082ca1af14a4394c4fd32`: CI [37575501916](https://github.com/ArdenZC/Zen-Canvas/actions/runs/37575501916) SUCCESS, installed-service qualification and routed Windows/macOS Rust gates SUCCESS. Local full Rust failures remain FAIL and distinct. Initial upload retained only aggregate JSON; separately generated recovery report/trace were removed with the disposable task root.

Evidence-only remediation copies only `service-recovery.json` and `recovery-trace.log` to the aggregate JSON sibling directory `RUNNER_TEMP/zb05-global-index-service-evidence-<run_id>-<run_attempt>` before cleanup. Workflow checks all three files and the exact `windows_recovery_rebuild_admitted` event, then explicitly uploads only those files as `windows-global-index-service-qualification` with missing uploads treated as errors. Existing service/profile/VHD cleanup is unchanged. Product source remains byte-identical. Fresh exact-head CI, artifact manifest/report assertions and trace confirmation belong to the final PR handoff. Skipped gates remain SKIPPED. At that historical retention checkpoint, native qualification remained NOT PERFORMED; PR #327 stays Draft and #323 OPEN.

## 2026-10-08 Owner native disposition and documentation closeout

**#323 SCOPED WINDOWS NATIVE RECOVERY OWNER ACCEPTED WITH EVIDENCE EXCEPTIONS — DOCUMENTATION CLOSEOUT AUTHORIZED** at frozen HEAD `2e0d75416c6ebdfb37df753632d31c479875759b` / tree `dd7cb01c31ac5edc5f65de6742b467f735f99735`. The [result](../../WINDOWS-GLOBAL-INDEX-RECOVERY-323-RESULT.md#owner-accepted-scoped-native-closeout) records the acceptance and exceptions in detail. PR #327 remains OPEN / Draft; #323 remains OPEN.

Original native root `E:/CargoTarget/issue323-hyperv-owner-native-20261007`: 105/105 payload size/hash checks PASS; manifest SHA-256 `255BD18271B1A5CD614ADC7688DBC904894F85DA017C26FEE09B601032948F20`. Independent audit root `E:/CargoTarget/issue323-owner-evidence-audit-20261008-024155` contains the 24-record matrix and post-audit preservation check. Original files, including historical INCOMPLETE `qualification-report.json`, remain unchanged.

- Native Quit-associated durable `paused / NULL` and post-seed full-index recovery to repaired `ready / NULL` are Owner accepted within the retained observation/attestation boundaries.
- Initial Phase-A pre-Quit PID remains UNVERIFIED and is **explicitly waived by Owner**; no later PID substitutes for it.
- Initial seeded `rebuild_required` is **not directly observed**. Later natural cursor-discontinuity recovery remains separate. Accepted deterministic/hosted transport and Background-admission evidence stays **ACCEPTED DETERMINISTIC EVIDENCE**, not native observation.
- Recorded sentinel identity and nine zero business-table counts support bounded mutation safety. Internal SQLite/Global Index/FTS/evidence writes are accounted separately. The overwritten initial count-report is not an original startup baseline; preserved pre-Pause DB/WAL supplies the measured baseline. No exhaustive transient/OS-wide mutation claim is made.
- [#328](https://github.com/ArdenZC/Zen-Canvas/issues/328) separately tracks transient SQLite-lock/unavailable degradation; [#329](https://github.com/ArdenZC/Zen-Canvas/issues/329) tracks clean-install Onboarding scan-scope save failure. Recovery/dismissal does not establish either fixed. Tracking only; no new implementation activated.

Successor validation is retained in `E:/CargoTarget/issue323-owner-documentation-closeout-20261008`: exact successor identity, production blob/tree equivalence, fresh CI run/conclusion, merge-integration tree and applicable artifacts. The documentation commit does not self-reference a future SHA/run or promote prior validation to its new HEAD. No native rerun or production/runtime change is performed. Stop: **#323 FINAL DOCUMENTATION CLOSEOUT CANDIDATE — READY FOR OWNER REVIEW**.


## Post-merge closure record — 2026-10-08

Approved documentation successor `4ceafaba64f0bdfbc19385eed471ae107c3fe466` was squash-merged through PR #327 as `master@1619e335468c432da5a5b3a6e246e1ea1c7db32c`, tree `70c1e97eb68a01506a796140277af640a5e0fe60`. Merge-after master CI 37722150775 is **SUCCESS**. Issue #323 is **CLOSED / completed**.

This closure preserves every earlier evidence classification. The original 105-file package and historical INCOMPLETE qualification report remain immutable; closure does not promote the missing Phase-A PID or uncaptured seeded `rebuild_required` transient to native PASS. #328 and #329 remain separate OPEN product defects.
