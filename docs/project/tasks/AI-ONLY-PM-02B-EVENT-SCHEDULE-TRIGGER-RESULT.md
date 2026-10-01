# PM-02B — Event / Schedule Trigger Result

Status: **IMPLEMENTATION COMPLETE — READY FOR OWNER REVIEW / NATIVE ACCEPTANCE PENDING**. PM-03 remains **NOT ACTIVE**. Draft implementation [PR #317](https://github.com/ArdenZC/Zen-Canvas/pull/317) references initiative #273 and merged activation #316; no merge or auto-merge is authorized.

Exact implementation base: `master@91589a89974324e821b4963b062c3070949252a8`. Branch: `product/pm-02b-event-schedule-triggers`, isolated worktree. Schema exactly 37; package remains 0.1.40. Accepted PM-02A result and frozen research history are unchanged.

## Implemented contract

- Strict Trigger V2: Manual, Schedule (explicit IANA zone, HH:MM and normalized ISO weekdays), managed_scope_change. Run now remains manual for every enabled trigger. Policy remains review-required / autoExecute false.
- One durable trigger-state row per automatic Intent, exact revision, bounded root maps, next schedule/event due, last outcome and claimed cause. Editing/toggling/archiving atomically clears debt. Manual Intents have no runtime row. [Schema 37](../SCHEMA_37_AUTOMATION_TRIGGERS.md) documents migration, constraints, fields and indexes.
- Existing scanner/watcher publication owns the filesystem-only root clock. Creation, removal, rename, size/mtime, physical replacement and stale/live changes count once/root/transaction. Tags/classification/AI/presentation do not. Nullable publication-side filesystem observation digest distinguishes equal-size/equal-mtime replacement; existing helper is read-only. No second watcher or mutation identity authority.
- Five-second settle extends across a burst; pending maps retain maximum revisions. Startup/wake and postcommit hints reconcile durable clocks, including lost hints. Unhealthy scopes hold event delivery without spinning; newly enabled all-scope roots baseline current revisions. Explicit disabled scopes fail closed.
- One condition-variable coordinator waits indefinitely when idle, otherwise at the nearest deadline. Existing WorkScheduler Background CPU=1/IO=1/open-handles=1 admission and RuntimeResourceGovernor own policy and fairness. Deferral retains cause/cursor; scheduler cancellation/backpressure waits; no application polling, per-Intent threads or new AI queue.
- Jiff 0.2.37 is the only new direct dependency; bundled IANA tzdb/lockfile. Fold chooses earlier instant once. Gap chooses the actual first valid transition instant on that date. Daily/weekly/custom recurrence and bounded newest-only catch-up do not replay missed backlog.
- Backend-reserved deterministic auto keys bind Intent/revision/cause. Claimed cause freezes before admission; crash after atomic Plan+Run publication before cursor advancement retries the same key despite later time/root revisions. Manual spoofing is rejected.
- Shared manual/automatic service resolves fresh Query V2 and uses existing Plan materialization and Managed AI readiness/consent/currentness/admission. Current valid assessments need no new provider readiness. Automatic paths cannot accept decisions, request Dry Run, execute, or mutate files.
- The latest referenced draft/building/ready/executing Plan suppresses a new automatic Plan: blocked automation_review_pending Run references the existing Plan and consumes only that cause. Completing it does not replay the skip; a later distinct cause can prepare a new Plan. Manual behavior remains unchanged.
- macOS pauses through existing lifecycle ownership and recovers before resume. Windows narrow event-driven native power callback provides suspend/resume hints because relative Condvar behavior cannot be proven here. No Windows timer/power polling. Teardown cancels admission, joins coordinator before AI shutdown, unregisters callbacks; failed unregister retains context safely. [ADR-0011](../DECISIONS/0011-automation-trigger-boundary.md) records ownership/decomposition.
- Bilingual editor supports daily/weekdays/custom, explicit zone/time, backend next due, actual Run source, resource-deferred and review-pending skip states. One backend event subscription refreshes projections; no UI polling. Plan handoff/Advanced Rules remain existing owners. Eight renderer commands retain main-window permission classification; no new automatic renderer command.

## Validation and evidence

Local frontend: typecheck PASS; final full Vitest **172 files / 1780 tests PASS**, including fixture reset/spoof and event-unsubscribe checks. Production frontend build and performance architecture (28 tests) PASS. Browser mock at desktop 1440×960 and narrow 760×900 PASS: schedule/event/custom editing, manual generation on configured automatic trigger, focus restore, no horizontal overflow, Plan handoff and Advanced Rules. Browser plugin is unavailable; existing Playwright used. [Measurements](evidence/PM-02B/browser-measurements.json) are presentation evidence only.

Focused backend Automation tests: **32 PASS**. Core database tests: **129 PASS / 2 intentional benchmark ignores**. Migration integration: **8 PASS / 2 intentional benchmark ignores**. Scanner/watcher tests: **26 PASS / 1 intentional benchmark ignore**, including actual publication clock/rollback ownership. Performance fixture builder: **100k Schema 37 build PASS**. Linux desktop-runtime compile PASS using the explicit uncommitted harness. Automation test responsibilities are separated into calendar/migration/publication/recovery/runtime/service modules. These tests cover migration/history/idempotent reopen, strict V2, calendar/zone/DST, latest-only catch-up and stable crash claim, pause/edit reset, manual-all-triggers/spoof rejection, two-root event burst/lost wake/reconciliation/new root baseline, review suppression, existing AI currentness/admission, actual filesystem publication and physical replacement, idle/defer/release/cancel/shutdown. Historical migration fixtures and current/performance schema identities are updated to 37; future rejection uses 38.

The Linux harness temporarily supplies the baseline's Linux keyring dependency and existing extracted GTK/WebKit sysroot; this workaround is not committed and does not qualify native Windows/macOS builds. Last full Linux suite: **959 PASS / 25 unsupported native Browse/preview/execution failures / 23 intentional benchmark ignores**, before the final schema constraint/tag-observation tests, which pass in focused validation. No tests were weakened or skipped for this implementation; supported Windows/macOS CI must provide the mandatory platform lanes. Exact-head/tree CI evidence is tracked by the [PR checks](https://github.com/ArdenZC/Zen-Canvas/pull/317/checks) and will be pinned in the final PR handoff. The CI source-evidence artifact is authoritative for the final committed source identity.

[Windows native qualification](evidence/PM-02B/windows-native-qualification.md): **NOT RUN / OWNER VERIFICATION PENDING**. Real suspend/resume **UNVERIFIED**. No native PASS claim is made. Native Owner evidence is required for acceptance; Linux/browser checks do not replace it.

## Preserved boundaries

Provider adapters/parsers/semantic policy, Organization execution/Dry Run/decision authority, Cleanup/trash/operation journals, Rule AST/watcher Rule behavior, scheduler fairness and governor ownership, frozen research/runtime and package version are unchanged. PM-02A accepted history remains intact. Research #283/#270 remains separate; PM-03, Preference Memory production, System One/Laya/Jev, Cleanup automation, release publication and autonomous mutation remain inactive.


## Browser QA / changed-file audit

Flow: Settings → Automation → create schedule/event/custom Intent → manual Generate plan → existing Organize Plan → Advanced Rules. Desktop 1440×960 (English/Chinese) and narrow 760×900 use the presentation mock, no real timers/watchers/providers.

| Check | Result |
| --- | --- |
| Page identity, meaningful Automation content | PASS: Vite local app, Automation heading and nonempty page title |
| Blank page / framework overlay | PASS |
| App console / page errors | PASS: zero relevant errors |
| Trigger editor and fixed policy | PASS: explicit time/zone/day selection; never-auto-file-change copy |
| Interaction / modal focus / Plan handoff | PASS |
| Narrow horizontal overflow | PASS: none |
| Native timer/watcher/resume acceptance | NOT QUALIFIED by browser mock |

Screenshots: [English schedule](evidence/PM-02B/desktop-blocked-editor.png), [narrow managed-change](evidence/PM-02B/narrow-pending-editor.png), [Chinese custom days](evidence/PM-02B/desktop-current-zh-editor.png). Existing Playwright was used because the Browser plugin is not available. A Browser plugin installation can provide in-app inspection for later UI work.

Changed-file inventory: Automation schema/types/repository/calendar/state/runtime/shared service; Database wake attachment and existing scanner publication; main lifecycle wiring and narrow Windows callback; Trigger editor/workspace/API/mock/bilingual copy; Automation/calendar/recovery/service/runtime/publication/migration/permission guards; historical migration/current-schema/performance fixture assertions; current STATUS/ROADMAP/initiative/Product/Architecture, accepted-scope ADR, Schema 37, this result and PM-02B evidence. The exact file inventory is the Draft PR diff. No protected provider/parser/semantic/execution/Cleanup/trash/journal/Rule-AST/scheduler/governor/frozen-research/package implementation changed; historical tests in those areas change only current schema expectations or remove future schema additions in downgrade fixtures.

Security: npm high-severity audit threshold PASS (two pre-existing moderate Vitest/mocker advisories, no dependency change). Local cargo-audit is not installed; Rust advisory validation is required in hosted CI. Jiff disables system-zone discovery and uses the pinned bundled IANA database for consistent explicit-zone behavior across hosts. No baseline dependency version was upgraded.
