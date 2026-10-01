# AI-only PM-02B — Event / Schedule Trigger Activation

Last verified: 2026-10-01

Status: **OWNER REVIEW PENDING — MERGE ACTIVATES PM-02B IMPLEMENTATION ONLY**

Initiative: AI-only Product Migration / issue #273

Activation baseline: `master@5a4b67e1f0d2d5b3d6bd26c1d19df16a992fea98`

Accepted predecessor: PM-02A / PR #313 — **COMPLETE / MERGED / OWNER REVIEW PASSED / MERGE-AFTER CI SUCCESS**

Current database schema: **36**

---

## 1. Purpose

PM-02B extends the accepted PM-02A Automation Intent / Run authority from explicit user-triggered plan generation to **bounded background plan preparation**.

The first PM-02B product contract is:

```text
Automation Intent
        +
one configured trigger
        ↓
backend-owned trigger receipt / idempotence
        ↓
fresh Query V2 scope snapshot
        ↓
existing Organization Plan
        ↓
existing Managed AI admission if fresh semantic work is needed
        ↓
reviewable plan
        ↓
STOP
```

PM-02B adds only two automatic trigger kinds:

1. **Schedule**
2. **Managed scope changed**

Manual **Run now / Generate plan** remains available for every enabled Intent.

PM-02B still does **not** execute a plan or mutate files.

---

## 2. Starting truth

PM-02A established and merged:

- Schema 36;
- `automation_intents`;
- `automation_runs`;
- durable Query V2 scope;
- workflow = `organize_plan` only;
- trigger = manual only;
- review required;
- auto-execute = false;
- fresh backend snapshot per Run;
- existing Organization Plan authority;
- existing Managed AI queue/readiness/consent authority;
- request-key idempotence;
- Windows native + restart acceptance;
- no second scheduler/queue;
- no filesystem mutation.

Current trigger storage is deliberately strict:

```json
{ "version": 1, "kind": "manual" }
```

Current Run trigger kind is also restricted to `manual`.

Existing watcher-driven Rule execution remains Rule behavior and is not Automation authority.

Existing runtime owners include:

- `src-tauri/src/watcher.rs` — backend file watcher/reconciliation;
- scan/root durable ledgers;
- `WorkScheduler` — process-local resource admission;
- `RuntimeResourceGovernor` — platform background policy;
- existing Managed AI worker/queue;
- existing macOS lifecycle controller;
- existing app autostart / `--background` path.

PM-02B must extend these owners rather than duplicate them.

---

## 3. PM-02B product boundary

### Activated after this taskbook merges

PM-02B may implement:

- manual trigger compatibility;
- calendar schedule trigger;
- managed-scope-change trigger;
- durable trigger progress/state;
- missed-trigger recovery;
- event coalescing;
- background WorkScheduler admission;
- restart/sleep/wake recovery;
- auto-generated **reviewable** Organization Plans;
- run history that identifies trigger source.

### Still NOT ACTIVE

PM-02B does not authorize:

- startup-as-a-user-trigger;
- login-trigger semantics;
- idle trigger;
- battery trigger;
- arbitrary cron expressions;
- arbitrary shell/system events;
- webhook/network triggers;
- email/calendar triggers;
- Cleanup automation;
- automatic Organization Plan execution;
- automatic move/rename/delete/trash;
- general agent/tool runtime;
- Preference Memory production;
- System One;
- Laya/Jev runtime;
- RAG/vector storage;
- PM-03 migration closeout.

Startup and wake are **recovery opportunities**, not a third user-configurable trigger.

---

## 4. Non-negotiable safety invariant

For PM-02B:

```text
automatic trigger
≠
automatic file change
```

A background-triggered Automation Run may:

- resolve current scope;
- materialize an Organization Plan;
- consume current Managed AI assessments;
- enqueue permitted missing Managed AI work;
- persist a Run receipt;
- make the Plan visible for later review.

It may never call:

- `execute_organization_plan`;
- Operation execution;
- Cleanup execution;
- Safe Trash mutation;
- permanent delete;
- shell/process execution.

Every file mutation remains behind the existing user review / Dry Run / Preview / confirmation / identity revalidation / journal / Safe Trash / Restore authority chain.

---

## 5. Trigger model

PM-02B replaces the manual-only trigger envelope with **AutomationTriggerV2**.

Existing PM-02A manual intents migrate semantically to V2 manual.

Allowed V2 trigger shapes are exactly:

### 5.1 Manual

```json
{
  "version": 2,
  "kind": "manual"
}
```

This means no automatic trigger.

### 5.2 Schedule

```json
{
  "version": 2,
  "kind": "schedule",
  "timeZone": "America/Los_Angeles",
  "localTime": "09:00",
  "weekdays": [1, 2, 3, 4, 5]
}
```

Contract:

- IANA timezone identifier;
- local time precision is one minute;
- weekdays use ISO values 1=Monday through 7=Sunday;
- weekdays are non-empty, sorted and deduplicated;
- no seconds;
- no arbitrary cron;
- no interval string parser;
- unknown fields fail closed.

“Daily” is represented by all seven weekdays.

### 5.3 Managed scope changed

```json
{
  "version": 2,
  "kind": "managed_scope_change"
}
```

This means:

> after query-visible file state in one of the Intent's managed roots changes and the owning root becomes current/healthy, prepare one new review plan after the fixed settle/coalescing window.

The fixed settle window is backend policy, not a user-tunable timing DSL.

---

## 6. Manual Run now remains available

PM-02A tied manual execution to `trigger.kind=manual`.

PM-02B changes that product rule:

> **Run now is an explicit user action available for every enabled, non-archived Intent, regardless of configured automatic trigger.**

Therefore:

- a scheduled Intent may still be run manually;
- a managed-scope-change Intent may still be run manually;
- manual Run receipts use `trigger_kind=manual`;
- the configured trigger is not rewritten by Run now.

This is not multiple persisted triggers. It is one configured automatic trigger plus an always-available explicit user action.

Existing PM-02A request-key semantics remain in force for Run now.

---

## 7. Schema 37 authorization

PM-02B may migrate exactly:

`36 → 37`

Do not create Schema 38.

Schema 37 is authorized only for trigger expansion/recovery.

Expected bounded changes:

1. migrate existing trigger JSON from V1 manual to V2 manual;
2. permit Run `trigger_kind`:
   - `manual`;
   - `schedule`;
   - `managed_scope_change`;
3. add sanitized trigger context to Run receipts if needed;
4. add one durable per-Intent trigger-state authority;
5. add one monotonic managed-root query-visible change revision if needed to make watcher/scan recovery durable.

Do not add unrelated schema work.

---

## 8. Managed root change clock

PM-02B must not build a second filesystem watcher.

Existing watcher/scanner owners remain authoritative.

To make event-trigger recovery durable without storing raw watcher paths, PM-02B may add one monotonic field to the existing managed root authority, conceptually:

```text
scan_roots.library_change_revision
```

Rules:

- starts at 0;
- monotonic;
- increments at most once per root-owned business transaction;
- increments only when query-visible file state under that root actually changes;
- watcher exact mutation and scan/reconciliation publication update it through their existing transactions;
- no increment for access-only events;
- no increment solely because a watcher callback occurred;
- no raw path list is persisted for Automation;
- the field is an observer/change clock, not a replacement for generation/watcher/reconciliation truth.

Existing:

- `watcher_revision`;
- `watcher_applied_revision`;
- scan generation;
- health/reconciliation state

remain the owning correctness facts.

The Automation trigger may consume the change clock only after the root is current enough to produce a truthful Query V2 snapshot.

---

## 9. Durable trigger state

PM-02B may add one logical durable record:

`AutomationTriggerStateV1`

Expected table:

`automation_trigger_state`

Minimum semantic state:

```text
intent_id
intent_revision
next_due_at?
pending_event_due_at?
pending_root_revisions_json
consumed_root_revisions_json
last_trigger_key?
last_triggered_at?
last_error_code?
updated_at
```

Rules:

- one row per automatic-trigger Intent;
- no state row is required for V2 manual-only Intents;
- state is bound to exact Intent revision;
- editing trigger/scope resets/rebuilds trigger state atomically;
- disabling/pausing stops delivery;
- archived Intents never deliver;
- raw paths, filenames and content are forbidden;
- root cursor maps contain only durable root IDs and monotonic revisions;
- maps are bounded by the same durable root-count constraints as Query V2.

This table is trigger recovery state, not a general job queue.

---

## 10. Event trigger semantics

A managed-scope-change trigger observes only durable roots included by the Intent's current Query V2 scope.

### Explicit roots

For:

```text
roots { scanRootIds }
```

only those current enabled roots participate.

### All enabled roots

For:

```text
all_enabled_roots
```

the participating set is resolved from current enabled managed roots.

Newly enabled roots are baselined to their current change revision; PM-02B does not replay their historical lifetime as an event storm.

Disabled/removed explicit roots retain PM-02A fail-closed scope behavior.

### Publication rule

Watcher/scanner code may only publish a lightweight Automation wake **after** its own durable transaction succeeds.

The wake is a hint.

Durable root change revisions + Automation trigger state are the recovery authority.

Lost process-local wakes must therefore be recoverable after restart.

---

## 11. Event coalescing

Filesystem save operations often create multiple create/write/rename notifications.

PM-02B must not produce one Plan per low-level event.

Requirements:

- existing watcher batching/coalescing stays unchanged;
- Automation adds a fixed backend settle window of **5 seconds**;
- multiple relevant root revisions during the window collapse into one pending trigger cause;
- the pending cause stores only the maximum durable change revision per root;
- a new event during the settle window extends/replaces the pending due time;
- one coalesced event trigger produces at most one logical Run.

No recurring debounce poll is allowed.

Use one wake/deadline.

---

## 12. Schedule semantics

Schedule authority is calendar-based, not “sleep N seconds forever”.

The backend owns recurrence math.

Required semantics:

- explicit IANA timezone is stored with the Intent;
- schedule does not silently follow a later machine timezone change;
- user edits the Intent to change timezone;
- weekdays + local minute define occurrences;
- one logical occurrence corresponds to one deterministic trigger key.

### DST

Do not hand-roll timezone rules.

Implementation must use one existing or narrowly added audited timezone library.

Required deterministic behavior:

- ambiguous fall-back local time fires **once**, using the earlier valid occurrence;
- nonexistent spring-forward local time fires at the first valid instant after the gap on that local date;
- the trigger key is based on the logical local schedule occurrence, so DST ambiguity cannot create two Runs.

No network time service is introduced.

---

## 13. Missed schedule / startup / wake semantics

Zen Canvas is not authorized to create a new OS daemon, Windows Task Scheduler entry, launchd agent or service for PM-02B.

If the process is not running, it cannot fire at the exact scheduled instant.

Existing user-controlled app autostart/background launch remains unchanged.

When the process starts or wakes:

- recompute trigger truth from durable state;
- if one or more schedule occurrences were missed, collapse them to **one newest missed occurrence**;
- never replay an unbounded backlog;
- after the catch-up attempt, advance to the next future occurrence;
- record the number of older collapsed missed occurrences in sanitized trigger context if available.

Startup itself is not a trigger.

A paused/disabled Intent accumulates no catch-up debt. Re-enabling starts from the next future occurrence.

Editing a schedule similarly discards the old schedule backlog and computes a new future occurrence.

---

## 14. Clock-change boundary

PM-02B adds no recurring clock poll.

The Trigger Coordinator recomputes wall-clock truth on:

- process start;
- trigger configuration mutation;
- watcher/root-change wake;
- existing lifecycle wake where available;
- completion of its nearest-deadline wait.

A manual system clock change while the process is otherwise totally idle does not justify a polling loop.

The next explicit coordinator wake must reconcile the schedule against current wall-clock time and still obey one-catch-up-only semantics.

---

## 15. Trigger Coordinator runtime

PM-02B may add one process-local:

`AutomationTriggerCoordinator`

This is **not** a general scheduler and owns no durable job lifecycle.

Its responsibilities are only:

- read durable trigger state;
- wait for the nearest trigger deadline;
- receive explicit wake hints;
- select a due trigger;
- request existing WorkScheduler background admission;
- call the shared Automation Run orchestration;
- advance durable trigger state after an idempotent receipt exists.

Requirements:

- one coordinator, not one thread per Intent;
- no `setInterval`;
- no periodic DB poll;
- when no automatic Intent/deadline exists, wait indefinitely;
- no provider/network call by the coordinator;
- no filesystem watching by the coordinator;
- no new general worker pool;
- shutdown must join promptly.

---

## 16. WorkScheduler / RuntimeResourceGovernor boundary

Automatic plan generation is background work.

Before automatic orchestration, PM-02B must request existing:

`WorkScheduler`

admission as:

`WorkClass::Background`

using a small bounded CPU/IO/open-handle hint appropriate to plan materialization.

`RuntimeResourceGovernor` remains platform policy authority.

Do not create a second capacity system.

If background policy/resource admission blocks:

- do not mark the trigger consumed;
- do not spin;
- leave durable trigger state pending;
- wait through existing scheduler admission/wake behavior;
- after admission, revalidate the Intent revision, enabled state and trigger cause before materializing a Plan.

Manual Run now keeps its existing explicit-user-action behavior and is not reclassified as a background trigger.

---

## 17. Shared automatic-run orchestration

PM-02B must refactor only as needed so manual and automatic Runs share one backend-owned plan-generation path.

Automatic trigger order:

1. select durable due trigger state;
2. load exact Intent revision;
3. require enabled and not archived;
4. require expected configured trigger kind;
5. acquire existing background WorkScheduler admission;
6. revalidate Intent revision/trigger state;
7. revalidate Query V2 scope;
8. resolve fresh current library snapshot;
9. enforce outstanding-review suppression;
10. materialize through existing Organization Plan authority;
11. consume current Managed AI assessment where valid;
12. request existing Managed AI work only where needed and permitted;
13. persist/update durable Automation Run receipt;
14. advance only the trigger state represented by that exact deterministic cause;
15. stop.

No automatic Run reaches Dry Run or execution.

---

## 18. Automatic trigger idempotence

Automatic trigger request identity is backend-generated and deterministic.

Reserve a backend namespace that manual callers cannot use.

Conceptually:

### Schedule

```text
auto:schedule:
hash(intent_id, intent_revision, logical_schedule_occurrence)
```

### Managed scope changed

```text
auto:managed-scope-change:
hash(intent_id, intent_revision, sorted root_id/change_revision cause)
```

Requirements:

- manual request keys using the reserved automatic namespace fail closed;
- crash after Plan/Run persistence but before trigger-state advancement must replay the same request key;
- retry returns the existing durable Run/Plan rather than creating a duplicate;
- trigger state advances only after an existing/created receipt is proven.

---

## 19. Trigger context in Run history

PM-02B may add one sanitized trigger-context projection/column to `automation_runs`.

It may contain only bounded metadata such as:

### Manual

```json
{ "version": 1, "kind": "manual" }
```

### Schedule

```json
{
  "version": 1,
  "kind": "schedule",
  "scheduledFor": 1790870400,
  "timeZone": "America/Los_Angeles",
  "localOccurrence": "2026-10-01T09:00",
  "collapsedMissedCount": 0
}
```

### Managed scope changed

```json
{
  "version": 1,
  "kind": "managed_scope_change",
  "roots": [
    { "rootId": "root-a", "fromRevision": 10, "toRevision": 14 }
  ]
}
```

Forbidden:

- raw paths;
- filenames;
- file IDs;
- file content;
- provider responses;
- credentials.

---

## 20. Outstanding-review suppression

Automatic triggers must not flood the user with overlapping review plans.

Before an automatic Plan is materialized, inspect the latest Plan referenced by the same Intent.

If an existing referenced Plan is still in a live user-review/execution state such as:

- `draft`;
- `building`;
- `ready`;
- `executing`;

the automatic trigger must:

- create/return an idempotent **blocked** Run receipt for the trigger cause;
- use a stable code such as `automation_review_pending`;
- reference the existing Plan when safe/useful;
- create **no new Organization Plan**;
- consume that trigger cause.

No background trigger may refresh/overwrite the user's existing Plan decisions.

Manual Run now retains existing PM-02A behavior and is not changed by this suppression rule.

---

## 21. Managed AI / privacy boundary

Automatic plan generation may cause missing semantic work to be enqueued only under existing Managed AI authority.

Enabling an automatic trigger does not create new upload permission.

UI must truthfully disclose:

> Automatic plan preparation may use your existing Managed AI processing permissions for files already allowed by Managed Scope / local-cloud consent.

If permission/readiness is absent:

- Plan remains truthful;
- analysis is blocked/pending as in PM-02A;
- no provider call occurs;
- no Rules semantic fallback occurs.

Revoking existing cloud/local consent immediately affects later automatic Runs.

No hidden background upload permission is stored in Automation.

---

## 22. App background / autostart boundary

PM-02B may run while the existing Zen Canvas process is already alive in its supported background/autostart mode.

It must not:

- force-enable autostart;
- create a new login item;
- create a Windows service;
- create a launch daemon;
- show the main window merely because an automatic trigger fired.

The product must communicate:

> Scheduled/event plans run while Zen is running. If a schedule is missed while Zen is closed or asleep, Zen prepares at most one catch-up plan when it next starts/wakes.

---

## 23. Lifecycle semantics

### Process startup

- recover trigger state;
- rebuild next schedule deadlines;
- compare managed-root change cursors;
- perform at most one missed schedule catch-up per Intent;
- recover pending event causes;
- do not run a special startup trigger.

### macOS sleep/wake

Integrate with the existing lifecycle owner.

On sleep/unmount:

- stop admitting new automatic triggers;
- cancel/wake the coordinator as needed for prompt lifecycle transition;
- do not corrupt durable pending trigger state.

On wake/mount recovery:

- existing scan/watcher recovery runs first;
- trigger coordinator then re-evaluates due schedules/pending healthy root changes.

### Windows

Do not introduce a separate periodic power monitor.

Existing scheduler/resource-policy behavior and the coordinator's deadline wait remain the first-slice authority.

After resume/next wake, current wall-clock/durable state is revalidated before delivery.

---

## 24. Scope health and partial state

A managed-scope-change event may become pending while its root is reconciling.

Do not generate a Plan from a partial/unhealthy root.

The trigger remains pending until:

- current Query V2 scope health is suitable;
- relevant watcher/scanner publication is durable;
- current root change revisions are known.

If an explicit root is removed/disabled so the durable Intent is no longer valid:

- fail closed;
- preserve a sanitized trigger error;
- do not silently widen the scope.

---

## 25. Commands / permissions

PM-02B should avoid unnecessary new renderer mutation commands.

Existing Intent CRUD commands may accept V2 trigger configuration.

Read projections may expose:

- trigger kind;
- next scheduled time;
- pending/deferred state;
- last automatic Run status.

Automatic delivery is internal backend behavior and does not need a renderer command.

All existing command permission classes remain:

- reads → `read_only`;
- Intent mutation / Run now → `main_state_mutation`;
- Search Window receives no Automation mutations.

No PM-02B command receives filesystem-mutation permission.

---

## 26. UI / product surface

Automation remains Intent-first.

Intent cards should show:

- title;
- workflow;
- scope summary;
- trigger;
- enabled/paused;
- next schedule when applicable;
- latest Run outcome;
- outstanding review warning when applicable.

Trigger editor choices:

1. **Manual**
2. **Schedule**
3. **When managed files change**

### Schedule editor

Allow:

- local time;
- timezone;
- daily/weekdays/custom weekday selection.

Do not expose cron.

### Managed scope changed

Explain:

- waits for managed file changes to settle;
- generates a review plan only after current managed scope truth is available;
- never changes files automatically.

### Fixed safety facts

Always show:

- Review required;
- Automatic file changes: Never.

### Run now

Remain available for all enabled Intents.

---

## 27. Run history

Run history must distinguish:

- Manual;
- Scheduled;
- Files changed.

For automatic Runs show truthful outcomes such as:

- plan ready for review;
- analysis pending;
- analysis blocked;
- deferred by resource policy;
- skipped because an earlier Plan still needs review;
- scope unavailable.

Do not display raw root IDs in normal product copy unless diagnostics explicitly needs them.

---

## 28. Zero-burden requirements

PM-02B is only acceptable if true idle remains calm.

Mandatory:

- no periodic renderer timer;
- no `setInterval`;
- no DB polling loop;
- no second watcher;
- no per-Intent thread;
- no per-root Automation watcher;
- no network connectivity monitor;
- no AI request merely because an Intent exists;
- no schedule work when no scheduled Intent exists.

One process-local coordinator waiting on a condvar/deadline is allowed.

Existing WorkScheduler internal resource-policy recheck behavior remains existing authority and must not be duplicated in Automation.

---

## 29. Schema 37 migration evidence

Required:

- fresh Schema 36 → 37;
- representative populated 36 → 37;
- PM-02A V1 manual trigger rows become V2 manual with identical product semantics;
- existing Run history remains readable;
- existing request keys remain valid;
- current Schema 37 reopen is idempotent;
- new trigger-state table/indexes correct;
- managed-root change revision defaults preserve existing scan/watcher truth;
- no Rule/Organization/operation/cleanup/research data drift;
- performance fixture schema identity updated consistently.

Package version remains unchanged unless separately authorized.

---

## 30. Schedule tests

Mandatory deterministic tests:

- V2 manual/schedule/event validation;
- weekday normalization;
- invalid timezone rejected;
- invalid local time rejected;
- next daily/weekly occurrence;
- fall-back ambiguous time fires once;
- spring-forward nonexistent local time resolves to first valid post-gap instant;
- deterministic occurrence key;
- process restart before due;
- process restart after one missed due;
- multiple missed occurrences collapse to one latest catch-up;
- paused/disabled interval accrues no catch-up debt;
- schedule edit discards old backlog;
- same due occurrence cannot create duplicate Run/Plan.

Time tests must use an injected/fake clock.

Do not sleep real minutes in unit tests.

---

## 31. Managed-change tests

Mandatory:

- real watcher mutation advances root change clock only after durable query-visible mutation;
- access-only event does not advance;
- repeated low-level save events coalesce;
- 5-second settle represented through fake clock, not wall sleep;
- two roots coalesce into one cause;
- root remains pending during reconciliation;
- healthy completion releases pending cause;
- crash/restart reconstructs pending event from durable state;
- same root revision cannot deliver twice;
- all-enabled-roots current set handled correctly;
- new root baseline does not replay historical changes;
- explicit removed root fails closed;
- no raw paths persisted in trigger state/Run context;
- existing watcher Rule execution remains unchanged.

---

## 32. Runtime / admission tests

Mandatory:

- no automatic trigger thread when runtime disabled/no auto Intents, where architecture permits lazy startup;
- one coordinator owns deadlines;
- coordinator idle wait is non-polling;
- WorkScheduler request class is Background;
- resource PolicyDenied/WouldBlock does not consume trigger;
- trigger fires after later admission;
- foreground/interactive work remains prioritized by existing scheduler;
- coordinator shutdown joins;
- sleep/wake recovery does not duplicate delivery;
- background launch does not open main window.

---

## 33. Automatic Run tests

Mandatory:

- automatic Run uses fresh current Query V2 snapshot;
- current assessments consumed without provider call;
- missing semantic work uses existing Managed AI queue;
- blocked readiness keeps Plan truth;
- deterministic automatic request key;
- crash after Run persistence / before cursor advance reuses same Run;
- automatic reserved key namespace cannot be spoofed by manual request;
- existing live review Plan suppresses a second auto Plan;
- blocked receipt links existing Plan when appropriate;
- no automatic Run calls Dry Run or execution;
- zero filesystem mutation.

---

## 34. Existing authority regressions

Re-run and preserve:

- PM-02A manual Run tests;
- Schema 36→37 migration;
- Query V2;
- watcher backend/reconciliation;
- scanner generation/recovery;
- Rule watcher execution;
- Organization Plan materialization/review;
- Managed AI queue/currentness;
- WorkScheduler/RuntimeResourceGovernor;
- app background/autostart behavior;
- macOS lifecycle;
- permission matrix;
- operation/cleanup/restore safety.

Do not weaken existing assertions to make PM-02B pass.

---

## 35. Browser/mock boundary

Browser fixtures may model schedule/event UI but are not runtime evidence.

Mocks must model:

- deterministic next schedule;
- pending event state;
- resource deferred state;
- outstanding-review suppression;
- trigger source in Run history.

Mocks must never pretend to run a real wall-clock scheduler or native watcher.

---

## 36. Native evidence

Before PM-02B Owner closeout, collect real Windows native evidence with disposable test data.

At minimum:

### Scheduled

- create a schedule Intent with a near-future occurrence;
- leave the app running;
- observe exactly one automatic Run;
- verify a reviewable/blocked truthful Plan;
- verify zero filesystem mutation;
- restart and prove no duplicate for the same occurrence.

### Managed scope changed

- create an event-trigger Intent;
- change one disposable file inside the managed root;
- observe watcher/scanner truth settle;
- observe exactly one coalesced automatic Run;
- perform a short burst of changes and prove coalescing;
- verify zero filesystem mutation;
- restart and prove delivered change revisions do not replay.

### Product

- Run now remains available;
- next schedule/status display truthful;
- pause prevents automatic Runs;
- Advanced Rules remains separate;
- no startup-trigger control;
- no auto-execute control.

Do not use real personal files.

Do not require a live cloud credential.

A truthful blocked-analysis Plan is valid evidence.

Real macOS GUI PASS must not be claimed without a supported host; hosted macOS lifecycle/Rust coverage remains mandatory.

---

## 37. Documentation closeout

Implementation must update:

- STATUS;
- ROADMAP;
- AI-only Product Migration initiative;
- PRODUCT_MAP;
- ARCHITECTURE_MAP;
- permission matrix;
- schema documentation;
- Automation product copy;
- PM-02B result/evidence.

Existing PM-02A result remains historical accepted authority and should not be rewritten as if it had schedule/event behavior.

---

## 38. Explicit non-goals

PM-02B does **not** authorize:

- direct “Run on app startup” trigger;
- arbitrary cron;
- arbitrary OS event subscriptions;
- webhook/network/email/calendar triggers;
- OS task scheduler / launchd job;
- new daemon/service;
- second filesystem watcher;
- second WorkScheduler;
- second RuntimeResourceGovernor;
- second Managed AI queue;
- automatic Plan execution;
- Cleanup automation;
- autonomous filesystem mutation;
- shell/process/tool execution;
- generic agent loop;
- Preference Memory production;
- System One;
- Laya/Jev runtime;
- RAG/vector DB;
- PM-03;
- release publication.

---

## 39. Stop conditions

STOP and return to Owner if implementation appears to require:

- Schema 38+;
- changing Organization Plan authority;
- changing PM-01 semantic/currentness authority;
- a new AI provider contract;
- a new cloud/background-upload consent model;
- another watcher;
- another scheduler/resource governor;
- a periodic polling loop;
- an OS service/daemon/task scheduler;
- automatic filesystem execution;
- startup-trigger user behavior;
- broad Rule redesign;
- Search Window mutation permission;
- Preference Memory/System One/Laya/Jev;
- weakening watcher reconciliation or Query V2 scope health.

Do not work around a STOP.

---

## 40. Recommended implementation sequence

After activation merge:

1. Schema 37 + AutomationTriggerV2 migration;
2. managed-root change clock + trigger-state repository;
3. shared manual/automatic orchestration;
4. Trigger Coordinator with fake-clock test harness;
5. WorkScheduler background admission;
6. watcher/scanner lightweight wake hooks;
7. lifecycle/startup recovery;
8. TS contracts/API/mocks;
9. Automation trigger editor/history UI;
10. full regression + zero-burden tests;
11. Windows native schedule/event evidence;
12. result/governance closeout;
13. Owner review.

Use one dedicated Draft implementation PR.

Suggested branch:

`product/pm-02b-event-schedule-triggers`

Suggested title:

`product: add PM-02B event and schedule triggers`

Do not merge automatically.

---

## 41. Required implementation handoff

Return:

- starting master SHA;
- branch;
- final PR head;
- schema 36→37 proof;
- exact trigger JSON contracts;
- trigger-state schema/indexes;
- root change-clock integration points;
- Trigger Coordinator ownership;
- proof of non-polling idle;
- schedule/DST/catch-up evidence;
- event/reconciliation/coalescing evidence;
- WorkScheduler/ResourceGovernor admission evidence;
- automatic request-key/idempotence proof;
- outstanding-review suppression proof;
- Managed AI consent/readiness proof;
- proof of zero filesystem mutation;
- manual Run-now regression;
- Rule watcher compatibility;
- Windows native schedule/event/restart evidence;
- hosted Windows/macOS CI;
- changed-file inventory;
- all remaining PM-03 and research gates.

Stop at:

**PM-02B EVENT / SCHEDULE TRIGGER IMPLEMENTATION COMPLETE — READY FOR OWNER REVIEW**

Do not start PM-03.

---

## Activation disposition

Owner review is pending.

Merge of this activation taskbook may activate only:

**PM-02B — Event / Schedule Trigger implementation**

It does not activate PM-03, Cleanup automation, startup-trigger behavior, Preference Memory production, System One, Laya/Jev, general agents, or autonomous filesystem mutation.
