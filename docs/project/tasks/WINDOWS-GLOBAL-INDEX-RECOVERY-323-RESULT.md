# Windows Global Index Recovery Remediation — #323 implementation result

Date: 2026-10-07 (Asia/Shanghai)

Disposition: **IMPLEMENTATION COMPLETE — OWNER CODE / CI REVIEW PENDING**. Draft implementation PR only. Native Owner qualification is not authorized or performed; issue #323 remains OPEN. AI-only Product Migration #273 remains completed/closed.

## Identity and frozen boundaries

Starting HEAD `e41fda178c6e6c8af48f8af63cc06453e8339c48` / tree `bb74979786955592473f01e76b74d62a3d4ed9b5`; baseline CI [37569956109](https://github.com/ArdenZC/Zen-Canvas/actions/runs/37569956109) SUCCESS. Branch `fix/issue-323-windows-global-index-recovery`. Final implementation SHA/tree, Draft PR identity and fresh hosted status are recorded in its PR handoff, not substituted by baseline CI.

Schema 37 / package 0.1.40 / IPC protocol 3 unchanged. No wire fields, command permissions, database migrations, service/coordinator count, named-pipe transport, scheduler/governor ownership or filesystem execution authority changed. **automatic user-file mutation authority added = 0**. Operation Preview/Journal, Safe Trash, Restore, Cleanup/Automation/Rule execution and Managed AI semantic authority are untouched. No PM-03, #270, #283, Preference Memory, System One/Laya/Jev, generic debt, File Library/Vault retirement or release work is absorbed.

## Typed error / v3 response contract

`GlobalIndexError` adds two internal variants: `RebuildRequired(String)` for recovery diagnostics and `WindowsIo(u32)` for native DeviceIoControl error identity. Existing Paused/Provider/Database remain.

`windows/service_errors.rs` is the bounded response mapping shared by the existing service host and desktop provider. `IndexServiceResponse.error_code` carries:

| Typed operation outcome | error_code | Service status / desktop reconstruction |
| --- | --- | --- |
| Paused | `index_paused` | paused / Paused |
| RebuildRequired | `index_rebuild_required` | rebuild_required / RebuildRequired |
| Provider or WindowsIo | `index_permission_required` | permission_required / Provider |
| Database / validation generic failure | `index_failed` | error or existing service status / bounded generic Provider |
| Unknown or absent code | unchanged wire field | bounded generic Provider; message/status never imply Paused/RebuildRequired |

Diagnostic messages remain text only. v3 six-field response/frame shape and existing request/security validation are unchanged. Pause/SCM shutdown ownership remains intact. A typed Paused result sets service lifecycle paused without a last_error; desktop coordinator records durable paused even if its own local cancellation flag was not set (service Pause can originate independently).

## Recovery and removed string classifiers

All previously owned USN discontinuities persist durable `global_volumes.index_status = rebuild_required` and return typed RebuildRequired: journal ID change, cursor below FirstUsn/above NextUsn, native journal-history read failures 1178/1179/1181, short continuation page, parse failure, non-continuous cursor and directory rename reconciliation. Provider preserves that variant without writing permission_required. Genuine other provider/native I/O failures retain the existing permission/provider degradation path.

Removed correctness-critical matching:

- `DirectWindowsGlobalIndexProvider::resume_incremental_sync`: `.contains("rebuild required")`;
- USN journal-history detection: message substrings `1181` / `1178` / `1179`;
- MFT integrity classification: message prefixes `mft_integrity:` / `windows_mft_baseline_empty:`;
- native Win32 I/O classification: formatted `Win32 error {code}` substring.

MFT parser/empty-baseline integrity failures use the same typed rebuild classification. Existing message text is retained for diagnosis; arbitrary text with those words/codes does not control recovery.

Coordinator records RebuildRequired durably and uses the existing RecoveryRequired wake hint. The next eligible cycle selects the existing Background WorkScheduler/RuntimeResourceGovernor-admitted MFT rebuild, with no new polling/retry loop. A successful rebuild refreshes last_full_index_at and can progress indexing → ready with a new checkpoint. No second recovery store is introduced.

## Deterministic and hosted evidence

Focused Global Index suite: **67 passed, 3 ignored** on the final implementation source. Coverage includes typed v3 roundtrip/unknown-code fallback/message spoofing, durable USN condition matrix through provider propagation, and actual coordinator cycles proving Paused (with/without desktop cancellation), rebuild preservation, next admitted rebuild/ready/checkpoint and genuine permission failure separation. Rust formatting and Clippy (desktop-runtime/native-qa, all targets, warnings denied) PASS. Full local Rust library tests: 1134 passed, 3 failed, 26 ignored. The same three Automation readiness failures reproduce on the untouched exact baseline (33 passed, 3 failed in its Automation subset); broad Rust remains FAIL, not waived or promoted to PASS. No Automation code or credentials were changed. Documentation/governance and routing evidence are recorded in the PR handoff. Pending/failed/skipped checks are not PASS.

Architecture/performance guard: **PASS**, three files / 30 tests. Frontend production build **PASS** (existing PDF dynamic-import warning); this checks the desktop assets, not native acceptance. No production frontend change.

Hosted installed-service regression extends `scripts/qualifyWindowsGlobalIndexService.ps1`: after the existing same-image/SCM/security checks, the actual candidate built with `native-qa` runs a feature-gated CLI regression using the installed service pipe and the production coordinator cycle. Direct-provider fallback fails qualification. A first streamed initial-index SourceProvider event requests real service Pause; Paused must survive transport into durable paused without an error. The isolated qualification DB then seeds journal ID `18446744073709551615`, cursor `9223372036854775807`, prior full-index timestamp 1; real incremental sync must return typed/durable rebuild_required, then the next admitted service MFT rebuild must reach ready with a non-empty baseline.

Admission is proved by the existing production Background gate trace. Recovery trace/report are generated separately; original background-client service-route/idle accounting is cleared before normal residency/freshness checks so this new regression cannot satisfy those checks accidentally. No service-side fake fault, force-direct shortcut, journal deletion/configuration change or production-volume corruption is used. Only existing task-owned VHD/profile fixtures are used. Accepted product candidate `251a6371fb9e9bee7d88cb585c233c9c34b86fcd` / tree `7bdcff3eff08b96dc1e082ca1af14a4394c4fd32` passed exact-head hosted CI [37575501916](https://github.com/ArdenZC/Zen-Canvas/actions/runs/37575501916), including installed-service qualification and the routed Windows/macOS Rust gates. That first artifact retained only aggregate JSON: the separately generated recovery files were deleted with the task root. This evidence-retention defect does not invalidate the observed hosted execution or relabel the local Rust failures.

The evidence-only follow-up preserves exactly `zb05-global-index-service-evidence.json`, `service-recovery.json` and `recovery-trace.log` in a sibling task-owned `RUNNER_TEMP/zb05-global-index-service-evidence-<run_id>-<run_attempt>` directory, outside disposable profile/VHD cleanup. The named `windows-global-index-service-qualification` artifact explicitly uploads those three files. Missing any file, or missing the exact `windows_recovery_rebuild_admitted` trace event, fails the job; empty uploads are errors. Product source remains byte-identical to the accepted candidate. Fresh follow-up exact-head CI and downloaded artifact verification are recorded in the PR handoff; the earlier CI is not evidence for a later HEAD.

## Review limitations and stop

The deterministic suite and automated hosted service regression are separate from native Owner qualification. No installation or recovery test was performed on the Owner's Sandbox/real-user profile in this task. Owner code/CI review must authorize that later native stage. The real concurrent service Pause regression passed the accepted product candidate's hosted gate; that automated evidence is separate from Owner native acceptance.

Historical PM-03 Global Index degradation evidence remains unchanged. #323 remains OPEN; Draft PR remains Draft/unmerged. Stop at **#323 IMPLEMENTATION COMPLETE — READY FOR OWNER CODE / CI REVIEW**; no native Owner qualification, Ready transition, merge, issue closure or release publication.
