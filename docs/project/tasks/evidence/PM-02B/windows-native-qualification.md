# PM-02B Windows native qualification

Status: **NOT RUN — OWNER VERIFICATION PENDING**. The implementation environment is Linux x86_64, with no attached Windows desktop, native application binary, Windows power lifecycle or second-instance/window delivery harness. Linux Rust tests and browser mock screenshots are not Windows/native PASS evidence.

Use an isolated disposable application data directory and temporary managed root. Record the exact source/binary SHA and package version 0.1.40, and verify the database upgrades 36→37. Do not use the Owner's production files or overwrite PM-02A evidence.

| Required native row | Current result / evidence to collect |
| --- | --- |
| Explicit zone/minute/day schedule and backend next due | NOT RUN: one schedule occurrence, source=schedule, one Run/Plan, fixed review-required/never-auto-execute |
| Manual Run now for schedule/event/manual | NOT RUN: source=manual; configured trigger unchanged; reserved auto namespace cannot be submitted |
| Managed disposable create/change/remove/rename | NOT RUN: existing watcher/scanner owner, filesystem clock only, source=managed_scope_change |
| Burst inside five seconds | NOT RUN: settle extends, maximum revisions, one Plan/Run, no per-file trigger rows |
| Metadata-only tag/classification/AI publication | NOT RUN: global revision may change, root clock/cause/automatic Run do not |
| Restart with overdue schedule / lost watcher wake / claim | NOT RUN: only newest overdue schedule; exact claimed key reuses receipt/Plan; no replay backlog |
| Pause/edit/re-enable | NOT RUN: discard old debt, future due/current root baseline; no historical Run deletion |
| Existing Plan pending review | NOT RUN: blocked automation_review_pending references existing Plan, consumes cause, no refreshed decisions or hidden backlog |
| Background/tray operation and resource defer | NOT RUN: retained cause, existing Background admission, zero polling; no unwanted foreground window |
| Native narrow window + modal focus/keyboard | NOT RUN: bilingual controls wrap, focus restored, manual Run/Plan handoff and Advanced Rules remain usable |
| Teardown/restart | NOT RUN: coordinator join/cancel, no retained lease or callback, no duplicate automatic occurrence |
| Real suspend/resume | UNVERIFIED: native event adapter is implemented; prompt recovery/no duplicate occurrence/no busy polling require hardware validation |

A real suspend row may remain explicitly UNVERIFIED per activation. The remaining mandatory native rows still require Owner evidence before implementation acceptance. This document deliberately contains no fabricated native logs, screenshots or PASS rows.
