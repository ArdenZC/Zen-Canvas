# ZB-05 — Native Global Search Runtime — Codex / Agent Brief

Status: **OWNER-DIRECTED IMPLEMENTATION — do not merge autonomously**

Baseline: `master@e4ef09fb27bae97081fba0fa850f5ad62a9b1b50`

Implementation branch: `perf/zb-05-native-global-search-runtime`

Parent direction:

- `docs/project/MASTER_DEVELOPMENT_PLAN.md`
- `docs/project/tasks/ZB-00-RUNTIME-RESOURCE-LIFECYCLE-FREEZE.md`
- `docs/project/tasks/ZB-01-DATABASE-RESIDENT-FOOTPRINT-RESULT.md`
- `docs/project/tasks/ZB-02-IDLE-POLLING-REMOVAL-RESULT.md`
- `docs/project/tasks/ZB-03-RUNTIME-RESOURCE-GOVERNANCE-RESULT.md`
- `docs/project/tasks/ZB-04-ON-DEMAND-UI-RUNTIME-RESULT.md`

This is one **medium-granularity Track**.

Do not split Windows / macOS / coordinator / fallback work into separate PRs unless a stop condition is hit.

The Track goal is:

> **Turn the already-existing native Global Index providers into the default event-driven metadata-search runtime, so Zen can search supported local storage without prior File Library admission while true idle no longer wakes every 2 seconds.**

This is **not** a rewrite of Global Search.

Windows MFT/USN, the Windows metadata service, macOS Spotlight/FSEvents, the Global Index SQLite tables and Search V2 already exist and remain the authority.

---

## 1. Required read set

Read completely before editing:

1. `AGENTS.md`
2. `docs/project/README.md`
3. `docs/project/STATUS.md`
4. `docs/project/ROADMAP.md`
5. `docs/project/MASTER_DEVELOPMENT_PLAN.md`
6. `docs/project/ARCHITECTURE_MAP.md`
7. `docs/project/DEVELOPMENT_WORKFLOW.md`
8. `docs/project/CODE_MAINTAINABILITY.md`
9. `docs/project/tasks/ZB-00-RUNTIME-RESOURCE-LIFECYCLE-FREEZE.md`
10. `docs/project/tasks/ZB-01-DATABASE-RESIDENT-FOOTPRINT-RESULT.md`
11. `docs/project/tasks/ZB-02-IDLE-POLLING-REMOVAL-RESULT.md`
12. `docs/project/tasks/ZB-03-RUNTIME-RESOURCE-GOVERNANCE-RESULT.md`
13. `docs/project/tasks/ZB-04-ON-DEMAND-UI-RUNTIME-RESULT.md`
14. this taskbook.

Then inspect all real owners/tests, including:

### Shared Global Index

- `src-tauri/src/global_index/coordinator.rs`
- `src-tauri/src/global_index/models.rs`
- `src-tauri/src/global_index/repository.rs`
- `src-tauri/src/global_index/search.rs`
- `src-tauri/src/global_index/commands.rs`
- `src-tauri/src/global_index/tests.rs`
- `src-tauri/tests/global_search_hardening.rs`
- `src-tauri/src/main.rs`

### Windows

- `src-tauri/src/global_index/windows/mod.rs`
- `src-tauri/src/global_index/windows/mft.rs`
- `src-tauri/src/global_index/windows/usn.rs`
- `src-tauri/src/global_index/windows/volumes.rs`
- `src-tauri/src/global_index/windows/fallback.rs`
- `src-tauri/src/global_index/windows/service.rs`
- `src-tauri/src/global_index/windows/service_host.rs`
- installer/service lifecycle contracts and tests.

### macOS

- `src-tauri/src/global_index/macos/mod.rs`
- `src-tauri/src/global_index/macos/spotlight.rs`
- `src-tauri/src/global_index/macos/fsevents.rs`
- macOS lifecycle/provider tests.

### Runtime governance

- `src-tauri/src/scheduler.rs`
- `src-tauri/src/resource_governor.rs`
- platform QoS helpers.

Before editing, audit every use of:

- `incremental_poll_interval`;
- `wait_for_next_reconcile`;
- `thread::sleep` in Global Index runtime paths;
- `runUntilDate` / bounded native run-loop polling;
- recursive Global Index fallback selection;
- `PROVIDER_WINDOWS_RECURSIVE_FALLBACK`;
- source `enabled` defaults;
- provider/source discovery;
- `start_global_index`, `resume_global_index`, `rebuild_global_index_source`, `set_global_index_source_enabled`.

---

## 2. Current implementation facts

At baseline:

### Shared coordinator

`GlobalIndexCoordinator` starts one `zen-canvas-global-index` thread.

`run_index()` currently:

1. discovers sources;
2. updates volume state;
3. runs initial / rebuild / incremental provider work;
4. sleeps through `wait_for_next_reconcile()`;
5. repeats.

The default provider interval is 2 seconds, implemented as ~100 ms sleep steps.

Therefore settled Global Index still wakes repeatedly even when no filesystem/source change exists.

### Windows

The current implementation already contains:

- fixed/removable/network volume discovery;
- NTFS MFT initial collection;
- USN incremental synchronization;
- journal-id/cursor validation;
- rebuild-on-gap behavior;
- directory rename subtree reconcile;
- a versioned same-executable named-pipe metadata service;
- direct-provider fallback for development/recovery;
- recursive provider and a native watcher signal.

The installed service is already explicitly scoped as a metadata sensor/provider.

Do not redesign it into a generic daemon.

### macOS

The current implementation already contains:

- Spotlight / `NSMetadataQuery` baseline collection;
- `NSMetadataQueryDidUpdateNotification` incremental updates;
- FSEvents reconciliation signals/checkpoint;
- bounded pending-update coalescing;
- permission / Spotlight unavailable / external-not-indexed / FSEvents failure statuses.

The callbacks already know when work may exist, but the coordinator only drains them on the shared periodic cycle.

---

## 3. Binding product contract

Global Search is **Level 1 — Searchable**, not File Library membership.

Supported default metadata may include:

- name;
- path;
- kind/directory flag;
- extension;
- size;
- filesystem timestamps;
- bounded platform metadata;
- stable/native identity.

Searchable does **not** imply:

- File Library membership;
- content extraction;
- hashing;
- thumbnail generation;
- Dedupe;
- AI;
- cloud upload;
- mutation authorization.

Do not collapse Searchable / Managed / AI-readable state.

No Content Understanding prerequisite may be added to Global Search.

---

## 4. End-state architecture

Target:

```text
startup / explicit start
→ one immediate discovery + catch-up cycle
→ establish native provider wake sources
→ coordinator blocks

native metadata/source event
→ coalesced wake
→ discover/reconcile relevant durable truth
→ bounded provider work
→ checkpoint/status commit
→ block again
```

True idle:

```text
no source change
no filesystem metadata change
no command
no lifecycle transition
→ no 2-second coordinator wake
→ no repeated source discovery
→ no repeated SQLite status churn
```

Durable truth remains:

```text
global_volumes
global_entries
global_entries_fts
journal/checkpoint state
```

Native event signals are ephemeral wake hints only.

They must not become a second durable queue.

---

## 5. Shared GlobalIndexWake contract

Introduce one narrow coalescing process-local wake mechanism owned by Global Index orchestration.

Exact naming may differ.

Conceptually:

```text
GlobalIndexWake
  notify(reason)
  wait()
  shutdown()
```

Allowed wake reasons may include a small enum for diagnostics/tests, such as:

- startup;
- provider_change;
- source_topology;
- explicit_command;
- lifecycle_resume;
- retry_after_known_failure;
- shutdown.

Do not carry:

- file paths;
- file contents;
- arbitrary provider payloads;
- durable jobs.

The wake means only:

> “Global Index durable/provider truth may need re-evaluation.”

Coalescing is expected.

Unbounded event queues are forbidden.

---

## 6. Coordinator lifecycle

Replace the unconditional 2-second reconcile loop.

### Required behavior

Initial start:

```text
start
→ one immediate cycle
→ block
```

Provider change:

```text
native provider signal
→ wake
→ incremental/catch-up cycle
→ block
```

Commands:

- start;
- resume;
- rebuild;
- source enable/disable

must explicitly wake or directly schedule the coordinator.

Do not rely on a future timer.

Pause/shutdown:

- must wake a blocked coordinator;
- must join promptly;
- must not wait for a 2-second timeout.

### Remove

The end state must not depend on:

- `incremental_poll_interval()`;
- `wait_for_next_reconcile()`;
- unconditional 100 ms sleep steps;
- a replacement fixed 1/2/5 second true-idle coordinator timer.

### Known-failure retries

A timer may remain only for a **known transient failure with useful pending work**, not true idle.

Examples may include a temporary service connection failure where no safe direct provider is available.

Requirements:

- bounded backoff;
- no busy retry;
- reason documented;
- reset after success;
- permission-required / unsupported source should not retry every few seconds forever.

---

## 7. Windows event-driven runtime

### 7.1 Preserve authority

For supported NTFS fixed/local volumes:

```text
MFT = initial metadata collection
USN = incremental durable change authority
Global Index SQLite = search projection
```

A native change signal may wake the desktop coordinator, but it does not replace USN.

### 7.2 Preferred wake design

Do not change the Windows service protocol merely to satisfy architecture aesthetics if a narrower solution works.

Preferred bounded design:

- use an existing/native Windows filesystem change mechanism as a **wake-only signal** for already-enabled volumes;
- coalesce changes to one coordinator wake;
- after wake, the existing service/direct MFT/USN provider reads authoritative journal changes.

The existing `notify`/ReadDirectoryChanges-backed watcher infrastructure may be generalized for this purpose if it remains signal-only.

For NTFS:

> watcher event/overflow = “check USN now”, not “this event is truth”.

USN cursor continuity remains the correctness authority.

### 7.3 Alternative native USN wait

A blocking USN journal wait is also acceptable if implemented safely.

Microsoft's `READ_USN_JOURNAL_DATA_V0` supports a nonzero `BytesToWaitFor`; at end-of-journal the OS can keep the read pending until data arrives or I/O is canceled.

If choosing this design:

- shutdown/cancellation must explicitly cancel/unblock the native I/O;
- no thread may become permanently unjoinable;
- multi-volume behavior must remain bounded;
- do not hold the service's indexing operation lock indefinitely merely to wait.

Do not introduce a complex async I/O subsystem solely for this Track.

If safe cancellation cannot be demonstrated, use the wake-signal design instead.

### 7.4 Service boundary

Keep the current service as metadata-only.

Do not add:

- AI;
- settings authority;
- File Library management;
- Preview;
- mutation;
- cleanup/restore;
- arbitrary path commands.

Prefer keeping the current v3 request protocol unchanged unless a protocol change is demonstrably necessary.

If the protocol must change, STOP and obtain owner architecture review before implementation.

### 7.5 Service unavailable

If the installed service is unavailable:

- direct MFT/USN may remain a development/recovery path;
- if direct native access lacks permission, report truthful permission/unavailable state;
- do not silently start a whole-volume recursive crawl.

---

## 8. Windows recursive fallback policy — important

The current code can automatically persist/switch an NTFS source to:

`windows_recursive_fallback`

after native-provider failure.

That no longer matches the Master Plan.

### Fixed/internal NTFS

If MFT/USN fails:

```text
permission/unavailable/rebuild/error
→ truthful degraded source state
→ keep existing searchable rows according to stale/source rules
→ NO silent full-volume recursive crawl
```

A fixed NTFS native-provider failure must not become an expensive hidden recursive scan.

### Fixed non-NTFS

Current discovery can mark any fixed volume enabled even when the provider is recursive fallback.

Do not auto-run a whole-volume recursive crawl merely because the drive is fixed.

For new discovery, native-supported fixed/local sources may be enabled by default.

Unsupported fixed filesystems should remain visible as source capability/status, but not silently recursively indexed by default.

Do not add a schema migration to represent consent.

### Existing persisted recursive fallback

A persisted `windows_recursive_fallback` value from the old automatic failure path is **not evidence of explicit user consent**, because the current product has no durable explicit “allow full-volume crawler” authority.

Do not preserve it as a reason to auto-crawl a fixed NTFS volume indefinitely.

Normalize/route fixed NTFS back toward the native provider contract without losing truthful error state.

### Development/test fallback

The recursive provider may remain for:

- bounded tests;
- explicit fixture/recovery scenarios;
- source types where the current product explicitly authorizes it.

It must not be the invisible default “Everything search” implementation.

---

## 9. Windows source-change signal

The provider must also handle changes in source availability.

For already-known enabled volumes, filesystem change signals cover ordinary metadata change.

Volume topology is rarer.

Preferred:

- native volume/device notification if it can be implemented narrowly and safely.

If a broad Windows device-notification subsystem would materially expand scope, a very slow topology-only safety audit is acceptable.

Such an audit must:

- be no more frequent than necessary (target >= 5 minutes);
- only call cheap volume discovery/descriptor APIs;
- never perform MFT/USN/recursive indexing merely because the audit fired;
- disappear from the hot incremental path;
- be documented as a source-topology fallback, not index polling.

Also trigger source discovery on:

- app/runtime resume;
- explicit start/resume/rebuild;
- source settings actions.

Do not reintroduce a 2-second source discovery loop.

---

## 10. macOS event-driven runtime

### 10.1 Spotlight callbacks

`NSMetadataQueryDidUpdateNotification` already produces:

- upserts;
- stale IDs;
- full-reconcile signals.

Whenever `PendingUpdates` changes from native callback activity, notify the shared Global Index wake.

Do not wait for a 2-second coordinator tick.

### 10.2 FSEvents

FSEvents remains a reconciliation/checkpoint signal.

On:

- root changed;
- mount/unmount;
- dropped events;
- wrapped event IDs;
- other full-reconcile conditions

update pending state and wake the coordinator.

FSEvents does not become the row-level metadata truth when Spotlight can provide stronger metadata.

### 10.3 Pending bounds

Preserve the existing bounded pending-update policy.

Overflow must continue to become:

`full_reconcile = true`

rather than an unbounded in-memory event log.

### 10.4 Native run loops

Current Spotlight/FSEvents worker loops use ~250 ms bounded run-loop calls partly to observe stop flags.

Audit whether they can block on the native run loop and be explicitly stopped/woken on pause/shutdown.

Preferred end state:

- native callback/run loop blocks when idle;
- pause/shutdown explicitly stops/wakes it;
- no four-times-per-second “check stop flag” wake.

Do not add risky platform FFI merely to remove a harmless bounded native run-loop pump without a safe stop path.

If one native run-loop timeout remains:

- prove it does not perform SQLite/source discovery/index work;
- record it separately from coordinator polling;
- explain why a safe explicit stop is unavailable.

Coordinator 2-second polling still must be removed.

### 10.5 Spotlight degradation

Preserve truthful states:

- permission_required;
- spotlight_unavailable;
- spotlight_not_indexed;
- spotlight_external_not_indexed;
- fsevents_unavailable.

Do not silently substitute a full-machine recursive crawler.

---

## 11. External/removable/network source policy

Master direction:

- supported internal/local native metadata source may participate by default;
- removable/external/network/NAS should remain explicit/configurable;
- scheduled/manual refresh may be lighter and more truthful than permanent realtime observation.

Windows already defaults only fixed drives to enabled.

Preserve or strengthen that behavior.

Do not automatically enable:

- removable;
- optical;
- network.

On macOS, do not silently broaden default coverage of external volumes during this Track.

If the existing single Spotlight source makes precise external opt-in impossible without schema/model redesign:

- do not add schema;
- preserve truthful current behavior;
- record the limitation/follow-up;
- do not claim external-storage policy is fully solved.

---

## 12. WorkScheduler / ResourceGovernor integration

ZB-03 excluded Global Index provider redesign. ZB-05 must now close that gap without creating a second scheduler.

Heavy work such as:

- initial MFT/Spotlight baseline collection;
- explicit rebuild;
- full reconcile after history gap/overflow;
- recursive fallback fixture work where explicitly allowed

must participate in the existing Background resource admission where practical.

Use existing:

- `WorkScheduler`;
- `RuntimeResourceGovernor`;
- Background QoS helpers.

The desktop may acquire a Background lease before invoking a heavy service/provider operation.

Do not put tiny bounded incremental event-drain work behind an expensive scheduling ceremony if that would increase latency more than it saves.

Do not interrupt a provider in a way that corrupts journal/checkpoint truth.

The Windows service remains a separate metadata process. Do not add a second persistent scheduler to it.

Best-effort background thread QoS inside heavy service work is acceptable if it reuses existing narrow platform helpers.

---

## 13. Search semantics remain unchanged

Do not redesign:

- Search V2 request/response;
- ranking tiers;
- FTS weights;
- punctuation behavior;
- cursor contract;
- result ID;
- open/reveal revalidation;
- Search capability boundary.

The purpose of ZB-05 is to keep the existing index fresh more efficiently and make the native provider the truthful default.

Search may continue returning:

- partial;
- pending;
- failed;
- no_source;
- complete

according to existing source/index truth.

Do not lie “complete” while a source is degraded/rebuilding.

---

## 14. Source/status notifications

A narrow Global Index status/source-change event may be added for active UI consumers if useful.

It must project existing durable status.

It must not become a new state authority.

Do not build a generic app event bus.

Do not remove the ZB-02 Overview 60-second visible-only fallback unless **all** status facts it displays have authoritative events; Content Run currently remains a separate concern.

---

## 15. Lost-wakeup / race requirements

The event-driven coordinator must be race-safe around:

```text
finish durable catch-up
→ decide idle
→ begin wait
```

A provider signal arriving in that boundary must not leave pending native changes asleep forever.

Use a generation/token/condvar/channel primitive with preserved wake semantics.

Coalescing is allowed.

Lost wake is not.

Tests must explicitly cover this race.

---

## 16. Error/recovery semantics

Preserve:

- USN journal ID validation;
- journal history-gap rebuild requirement;
- directory rename subtree correctness;
- stale-entry semantics;
- source unavailable truth;
- macOS dropped-event full reconcile;
- Spotlight permission/indexing truth;
- service authentication/protocol validation.

Do not turn:

- unavailable;
- permission denied;
- external disconnected;
- Spotlight not indexed

into file deletion.

Do not delete durable rows merely because a provider temporarily disappears.

---

## 17. Tests required

Use injected/fake providers for event orchestration tests.

Do not make the main correctness suite depend on a real C: MFT, Spotlight database or installed service.

### 17.1 Coordinator true idle

Prove:

- after initial cycle, no event means no repeated discover/index/status cycle;
- no 2-second polling;
- no 100 ms wait loop.

Use deterministic counters rather than long sleeps.

### 17.2 Wake coalescing

Many provider events:

- coalesce;
- do not create unbounded memory;
- result in bounded catch-up;
- do not duplicate durable rows.

### 17.3 Lost wake

Exercise event arrival at the cycle→wait boundary.

The next cycle must run without a periodic timer.

### 17.4 Explicit commands

Prove:

- rebuild wakes immediately;
- enable/disable wakes/reconciles immediately;
- pause/shutdown wake blocked coordinator and join promptly;
- resume runs an immediate catch-up.

### 17.5 Windows NTFS

Prove:

- MFT baseline remains initial authority;
- USN remains incremental authority;
- native wake only triggers USN catch-up;
- watcher overflow/change signal does not itself mutate durable rows;
- directory rename/rebuild behavior remains intact.

### 17.6 Windows fallback policy

Prove:

- native NTFS permission failure does not trigger recursive full-volume indexing;
- persisted old recursive-fallback state on fixed NTFS does not silently auto-crawl;
- unsupported fixed filesystem is not auto-recursively indexed by default;
- removable/network remain disabled by default.

### 17.7 Windows service

Prove existing:

- request validation;
- same-executable/local-session security;
- SCM-only shutdown;
- service/direct routing;
- protocol compatibility

remain intact.

If protocol is unchanged, add an explicit contract test guarding the version/frame shape.

### 17.8 macOS

Prove:

- Spotlight update callback wakes coordinator;
- FSEvents reconcile signal wakes coordinator;
- pending overflow still becomes full reconcile;
- permission/degraded statuses persist;
- callback wake does not create a second durable event queue;
- shutdown/pause stop native watchers promptly.

### 17.9 Resource governance

Prove heavy initial/rebuild/reconcile admission respects existing Background policy without changing durable correctness.

---

## 18. Measurement / evidence

ZB-05 must record before/after idle behavior.

### Before

```text
settled coordinator:
~1 cycle / 2 seconds
source discovery repeated
incremental provider probe repeated
```

### After

```text
settled coordinator:
0 periodic reconcile cycles
native/provider signals wake on change
explicit commands/lifecycle wake as needed
```

Record:

- coordinator cycle counter;
- source discovery counter;
- idle DB/status-write counter where practical;
- event coalescing count;
- provider wake→durable update latency.

Do not claim zero total process wakeups; other native/service/lifecycle components exist.

The claim must be scoped to Global Index coordinator/provider work.

---

## 19. Windows native smoke

Because this Track directly changes Windows Global Index runtime, perform one bounded native smoke after implementation.

Use an isolated candidate profile/identifier as established in prior W6/ZB tracks.

Do not modify the production SQLite profile.

Do not uninstall/reconfigure the production Global Index service merely to test.

Prefer keeping the service protocol compatible so the existing installed service can provide read-only metadata to the isolated candidate.

If the implementation requires replacing/upgrading the installed service for validation, STOP and request owner approval before touching SCM.

### Smoke requirements

At minimum:

1. isolated candidate reaches Global Index ready/partial truthfully;
2. Search finds a task-owned test file on an enabled fixed NTFS source;
3. create/rename/delete a **task-owned disposable file only**;
4. observe event-driven freshness without waiting for a fixed 2-second poll;
5. verify delete becomes stale/not returned;
6. settle to idle;
7. observe no repeated coordinator cycle during a bounded idle window;
8. candidate profile remains isolated;
9. production service remains installed/running/unchanged unless owner explicitly approved otherwise.

Record event→search freshness latency as diagnostic evidence.

Do not freeze a hard product threshold in this Track.

---

## 20. macOS evidence

No owner Apple Silicon GUI host is currently guaranteed.

Use:

- deterministic macOS provider tests;
- hosted Apple Silicon/macOS compile/native performance lanes where available.

Do not claim full manual macOS native qualification without a real host.

If hosted CI can run a safe Spotlight/FSEvents fixture, use it.

Otherwise record the native-host limitation honestly.

---

## 21. Performance / resource evidence

Measure where practical:

- initial baseline throughput;
- incremental change latency;
- idle coordinator CPU/wake behavior;
- DB growth / entry count;
- memory of pending event structures;
- no unbounded queue growth.

Do not optimize ranking/query SQL in this Track unless a regression is directly caused by the runtime changes.

Existing Global Search performance gates remain authoritative.

---

## 22. Internal checkpoint / validation strategy

This remains **one branch and one PR**.

Suggested checkpoints:

1. shared wake + coordinator event loop;
2. Windows native wake/fallback policy;
3. macOS callback wake/native lifecycle;
4. WorkScheduler/resource integration;
5. focused cross-platform correctness;
6. native Windows smoke + final result.

At each checkpoint run only:

- formatter;
- focused tests;
- narrow Clippy/type checks.

Do not run the full repository suite after each checkpoint.

---

## 23. Final validation

After all scopes are integrated, run the expensive local validation once:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
npm run typecheck
npm test
npm run verify:rust
npm run test:performance:architecture
npm run verify:security
npm run build:frontend
npm run check:rust:release
```

Run routed Global Search / relevant extended performance/native checks once.

Create one Draft PR.

Use Hosted CI for final Windows/macOS integration proof.

After small owner-review repairs, use focused local tests and Hosted CI rather than repeatedly running the full extended suite.

---

## 24. Result document

Create:

`docs/project/tasks/ZB-05-NATIVE-GLOBAL-SEARCH-RUNTIME-RESULT.md`

Record:

- baseline;
- Production HEAD;
- Final HEAD;
- changed files;
- shared wake architecture;
- removed 2-second/100ms polling;
- Windows native wake design;
- Windows service protocol unchanged/changed;
- MFT/USN authority confirmation;
- recursive fallback policy changes;
- Windows fixed/removable/network defaults;
- macOS Spotlight/FSEvents wake design;
- any remaining native run-loop timeout and exact reason;
- WorkScheduler/ResourceGovernor integration;
- error/rebuild/permission semantics;
- coordinator idle evidence;
- event freshness evidence;
- Windows native smoke;
- macOS hosted evidence/limitation;
- focused checkpoint validation;
- final full validation;
- Hosted CI;
- unexpected findings;
- local task hygiene state;
- confirmation Search ranking/schema/durable authority unchanged;
- confirmation AI semantic migration/onboarding was not started.

Disposition:

`READY FOR OWNER REVIEW`

or

`BLOCKED`.

---

## 25. Explicit non-goals

Do NOT include:

- Search ranking redesign;
- semantic/vector search;
- content search in Global Search;
- OCR/content extraction;
- AI semantic authority migration;
- Rules/Preference Memory;
- onboarding redesign;
- new Global Index schema merely for this Track;
- File Library scan/watcher ownership rewrite;
- filesystem mutation/recovery changes;
- Preview changes;
- generic service/job daemon;
- process-wide telemetry;
- Linux;
- Intel macOS;
- STATUS/ROADMAP;
- release/publication changes.

---

## 26. Stop conditions

STOP and report rather than broadening scope if:

- correct event-driven Windows operation requires replacing the installed service during local validation;
- service protocol must be changed materially;
- event correctness appears to require a second durable event queue;
- source consent/fallback requires a schema migration;
- native NTFS correctness would be weakened by using watcher events as row truth;
- macOS correctness would be weakened by using FSEvents as row metadata truth;
- a generic OS device-monitoring framework is proposed;
- Search ranking/query semantics must change;
- File Library/AI authority would need to move;
- recursive whole-volume crawling is proposed as the silent default fallback.

Record the finding and return to owner review.

---

## 27. Git discipline

Work only on:

`perf/zb-05-native-global-search-runtime`

Allowed:

- implementation commits;
- focused checkpoint tests;
- one Result document;
- one Draft PR.

Forbidden:

- merge;
- mark Ready;
- update STATUS/ROADMAP;
- start AI semantic migration;
- start onboarding/experience phase.

---

## 28. Definition of Done

ZB-05 is ready for owner review only when:

1. the Global Index coordinator no longer wakes every 2 seconds in true idle;
2. no replacement short fixed idle polling loop exists;
3. Windows NTFS stays MFT baseline + USN incremental;
4. Windows native change signals only wake USN catch-up and are not row truth;
5. fixed NTFS native failure no longer silently falls back to full recursive crawling;
6. unsupported/removable/network sources are not silently whole-volume indexed by default;
7. the Windows metadata service remains metadata-only and least-privilege;
8. macOS Spotlight/FSEvents callbacks wake incremental/reconcile work directly;
9. pending native events remain bounded/coalesced;
10. pause/shutdown/rebuild/source-setting operations wake promptly and are race-safe;
11. heavy baseline/rebuild work participates in existing ZB-03 resource admission where practical;
12. Search V2/ranking/schema/open/reveal semantics remain unchanged;
13. Windows native smoke proves event freshness and settled idle behavior without modifying production user data;
14. macOS automated/hosted evidence is honest about host limitations;
15. full validation is run once at Track end and green;
16. Result is complete;
17. AI semantic migration and experience/onboarding work have not started.
