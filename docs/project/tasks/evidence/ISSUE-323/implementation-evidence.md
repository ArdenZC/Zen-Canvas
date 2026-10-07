# Issue #323 implementation evidence

2026-10-07: [implementation result](../../WINDOWS-GLOBAL-INDEX-RECOVERY-323-RESULT.md).

Baseline `e41fda178c6e6c8af48f8af63cc06453e8339c48` / tree `bb74979786955592473f01e76b74d62a3d4ed9b5`. Implementation branch `fix/issue-323-windows-global-index-recovery`. Schema 37 / package 0.1.40 / pipe protocol v3.

Task-owned local logs: `E:\CargoTarget\issue323-evidence`. Initial focused run: 62 passed, two failed, three ignored; existing fixtures still encoded the old string-based classification and were updated to the typed contract without weakening assertions. An intermediate QA compile failed because an incorrect constructor argument was supplied, then corrected to the existing with_wake/database binding. Final focused run including all 11 discontinuity matrix cases: 67 passed, three ignored. Full local Rust library: 1134 passed, three failed, 26 ignored. Untouched exact-baseline Automation subset: 33 passed and the same three failures (current_assessment_needs_no_credential_or_new_enqueue, stale_assessment_checks_fresh_readiness_and_keeps_plan, automatic_current_and_stale_semantics_reuse_shared_admission_without_mutation). Broad Rust is FAIL and remains a review limitation; no credentials or Automation implementation were modified. Broad and hosted conclusions must be recorded against the final implementation HEAD in the PR handoff. No skipped/ignored check is PASS.

Required hosted evidence: `service-recovery.json`, `recovery-trace.log`, original service/SCM/same-image/security evidence and normal background-client route/residency/freshness evidence. No installed-service transport or native Owner PASS is inferred from local force-direct/unit tests. Owner native qualification remains NOT PERFORMED / NOT AUTHORIZED YET.

Automatic user-file mutation authority added = 0. No production database migration or journal/volume mutation. The hosted qualification seeds only its task-owned isolated recovery metadata, explicitly recorded in the result/report. Historical PM-03/#323 evidence remains intact.

## Hosted evidence retention follow-up

Accepted product candidate `251a6371fb9e9bee7d88cb585c233c9c34b86fcd` / tree `7bdcff3eff08b96dc1e082ca1af14a4394c4fd32`: CI [37575501916](https://github.com/ArdenZC/Zen-Canvas/actions/runs/37575501916) SUCCESS, installed-service qualification and routed Windows/macOS Rust gates SUCCESS. Local full Rust failures remain FAIL and distinct. Initial upload retained only aggregate JSON; separately generated recovery report/trace were removed with the disposable task root.

Evidence-only remediation copies only `service-recovery.json` and `recovery-trace.log` to the aggregate JSON sibling directory `RUNNER_TEMP/zb05-global-index-service-evidence-<run_id>-<run_attempt>` before cleanup. Workflow checks all three files and the exact `windows_recovery_rebuild_admitted` event, then explicitly uploads only those files as `windows-global-index-service-qualification` with missing uploads treated as errors. Existing service/profile/VHD cleanup is unchanged. Product source remains byte-identical. Fresh exact-head CI, artifact manifest/report assertions and trace confirmation belong to the final PR handoff. Skipped gates remain SKIPPED. Owner native qualification remains NOT PERFORMED; PR #327 stays Draft and #323 OPEN.
