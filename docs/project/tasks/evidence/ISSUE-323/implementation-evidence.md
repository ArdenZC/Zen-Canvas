# Issue #323 implementation evidence

2026-10-07: [implementation result](../../WINDOWS-GLOBAL-INDEX-RECOVERY-323-RESULT.md).

Baseline `e41fda178c6e6c8af48f8af63cc06453e8339c48` / tree `bb74979786955592473f01e76b74d62a3d4ed9b5`. Implementation branch `fix/issue-323-windows-global-index-recovery`. Schema 37 / package 0.1.40 / pipe protocol v3.

Task-owned local logs: `E:\CargoTarget\issue323-evidence`. Initial focused run: 62 passed, two failed, three ignored; existing fixtures still encoded the old string-based classification and were updated to the typed contract without weakening assertions. An intermediate QA compile failed because an incorrect constructor argument was supplied, then corrected to the existing with_wake/database binding. Final focused run including all 11 discontinuity matrix cases: 67 passed, three ignored. Full local Rust library: 1134 passed, three failed, 26 ignored. Untouched exact-baseline Automation subset: 33 passed and the same three failures (current_assessment_needs_no_credential_or_new_enqueue, stale_assessment_checks_fresh_readiness_and_keeps_plan, automatic_current_and_stale_semantics_reuse_shared_admission_without_mutation). Broad Rust is FAIL and remains a review limitation; no credentials or Automation implementation were modified. Broad and hosted conclusions must be recorded against the final implementation HEAD in the PR handoff. No skipped/ignored check is PASS.

Required hosted evidence: `service-recovery.json`, `recovery-trace.log`, original service/SCM/same-image/security evidence and normal background-client route/residency/freshness evidence. No installed-service transport or native Owner PASS is inferred from local force-direct/unit tests. Owner native qualification remains NOT PERFORMED / NOT AUTHORIZED YET.

Automatic user-file mutation authority added = 0. No production database migration or journal/volume mutation. The hosted qualification seeds only its task-owned isolated recovery metadata, explicitly recorded in the result/report. Historical PM-03/#323 evidence remains intact.
