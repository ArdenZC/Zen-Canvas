# ZB-00 — Runtime Resource & Lifecycle Freeze

Status: **OWNER-DIRECTED / DOCUMENTATION-ONLY FREEZE — no production implementation authorized by this document**

Baseline: `master@4c22ba271fb91a508a7c4b3a5f5ce5aba7485eb5`

Branch: `docs/zb-00-runtime-resource-lifecycle-freeze`

Purpose: freeze the runtime/lifecycle/resource contract that later Zero-Burden implementation Tracks must obey.

This task does **not** activate a new release/publication phase, does not close W6, does not alter RC1, and does not authorize public release. Current project/release truth remains owned by `docs/project/STATUS.md`.

The product direction is:

> **Instant when invoked. Invisible when idle. Polite while working.**

And the engineering rule is:

> **Nothing exists or wakes unless it is currently providing user value, preserving safety, or maintaining the minimum native search contract.**

---

## 0. Source-of-truth and baseline note

At this freeze baseline, remote `master` is one documentation-only commit ahead of the production baseline recorded in `STATUS.md`:

- repository HEAD used for this freeze: `4c22ba271fb91a508a7c4b3a5f5ce5aba7485eb5`;
- `STATUS.md` latest merged production baseline: `7df0841bfb8dab1cd62d96650659f103355f0211`;
- the one-commit difference is documentation/governance only.

ZB-00 binds its source inspection to the real repository HEAD above. It does not rewrite the existing production-baseline wording in `STATUS.md`.

---

## 1. Required authority set

Every implementation Track derived from this freeze must begin from the repository constitution and current production owners, not from this document alone.

Required governance/architecture authorities:

1. `AGENTS.md`
2. `docs/project/STATUS.md`
3. `docs/project/ROADMAP.md`
4. `docs/project/MASTER_DEVELOPMENT_PLAN.md`
5. `docs/project/ARCHITECTURE_MAP.md`
6. `docs/project/DEVELOPMENT_WORKFLOW.md`
7. `docs/project/CODE_MAINTAINABILITY.md`
8. `docs/security/SUPPORTED_PLATFORMS.md`
9. `docs/security/TAURI_COMMAND_PERMISSION_MATRIX.md`
10. `docs/security/MACOS_MUTATION_THREAT_MODEL.md`
11. applicable accepted ADRs under `docs/project/DECISIONS/`
12. `docs/design/SYSTEM_WIDE_SEARCH_AI_INDEX.md`
13. applicable W1–W6 current-truth/spec/closeout records for the touched domain.

If this freeze conflicts with a stricter accepted filesystem, identity, persistence, provider, recovery, permission, Preview, mutation or release contract, the stricter contract wins.

---

## 2. Product platform direction

### 2.1 macOS

Existing repository truth remains binding:

- macOS 13 or later;
- Apple Silicon only;
- Intel Mac, Universal binaries, Rosetta and Linux are not product targets.

Zero-Burden implementation may optimize directly for Apple Silicon, native AppKit/Foundation/Spotlight/FSEvents/QoS/thermal/Low Power facilities, provided existing safety/provider authorities remain unchanged.

### 2.2 Windows

Owner product direction is Windows 10 and later.

ZB-00 does **not** silently invent a more specific minimum Windows build. The current supported-platform authority does not yet freeze an exact Windows 10 build number.

If a later Track wants to narrow product support to a specific Windows 10 release/build, that is a supported-platform truth change and requires the governance/ADR path required by `AGENTS.md` and `DEVELOPMENT_WORKFLOW.md`.

### 2.3 Platform-native optimization rule

Shared code owns contracts and orchestration. Platform code owns native mechanism.

Do not create fake symmetry such as:

- making macOS build an Everything-style full filesystem crawler when Spotlight is the platform metadata authority;
- making Windows ignore MFT/USN in favor of a generic recursive scanner;
- adding Intel/Rosetta compatibility branches;
- using a generic lowest-common-denominator power/QoS layer when native supported-platform APIs are available.

---

## 3. Zero-Burden product invariants

The following are binding.

### ZB-I1 — Search everything lightly

System-wide search is a **metadata** feature, not a content-understanding feature.

Default system-wide search must remain independent from File Library admission and AI/content scope.

Allowed global metadata includes bounded fields such as:

- name;
- path;
- extension;
- file/directory kind;
- native identity;
- size;
- timestamps;
- basic filesystem/source flags.

Global search must not imply default:

- content extraction;
- OCR;
- embeddings;
- document parsing;
- file hashing;
- duplicate detection;
- thumbnail generation;
- AI classification.

### ZB-I2 — Understand only what is needed

Content extraction and semantic understanding are user/scope driven. They are not a prerequisite for ordinary global filename/path search.

### ZB-I3 — Run AI only when asked or explicitly scheduled

No AI provider/model/network/local-inference activity is allowed merely because:

- the app started;
- a file changed;
- Global Index observed a new entry;
- the main window is hidden;
- a managed scope exists.

Durable AI queue/state may remain authoritative. Idle AI execution activity must be zero.

### ZB-I4 — Consume resources only when useful

No subsystem may own periodic wakeups merely to ask whether work exists when an event/condition variable/channel/native callback can express the same state.

### ZB-I5 — Touch files only after the existing safety chain

This freeze does not modify the mutation chain:

```text
intent
→ authoritative Operation Preview
→ explicit confirmation where required
→ backend revalidation / identity checks
→ durable journal or Safe Trash
→ filesystem mutation
→ durable outcome
→ History / Restore
```

### ZB-I6 — State may remain resident; work must not

A durable authority or lightweight registry may remain allocated while idle.

That does not authorize:

- an active worker loop;
- polling;
- scanning;
- hashing;
- network calls;
- hidden WebView work;
- speculative precomputation.

---

## 4. Durable authorities that ZB MUST NOT move

Zero-Burden work changes **lifecycle, scheduling and resource admission**, not product truth ownership.

The following existing authorities are frozen:

| Domain | Frozen authority |
| --- | --- |
| Global Search | Global Index / Global Search repository and backend ordering |
| Managed browsing | File Library Query V2 |
| Cross-page managed selection | `LibrarySelectionV1` plus backend resolution |
| Ephemeral Browse | `BrowseService` session/request/enumeration/opaque refs |
| Preview lifecycle/publication | Rust `PreviewSession` + Provider Registry + sourceVersion |
| Preview content read/materialization | `MaterializationReadGate` and authoritative platform open/revalidation |
| Expensive-work admission | existing process-wide `WorkScheduler` |
| Scan truth | durable scan roots/sessions/runs |
| Watcher health | backend watcher reconciliation/root revisions |
| Duplicate truth | durable Dedupe runs/groups/members/fingerprints |
| Storage analysis | durable Analysis Run/Finding/Evidence/Decision |
| Organization | Organization Plan / Plan Item ledger |
| Rules | Rule Repository V2 + catalog revision |
| Content | Content Scope Policy / Content Run / Content Artifact |
| File mutation | authoritative Operation Preview + operation journal |
| Cleanup | Safe Trash + cleanup journal |
| Restore | operation/cleanup ledgers + identity revalidation |
| Managed AI | existing durable managed-AI queue + provider policy |
| Settings | persisted versioned settings contracts |

No ZB implementation may create a second queue, second durable runtime ledger, second scheduler, second watcher truth source, second search index, second Preview/read authority, second mutation/recovery path or second settings authority.

---

## 5. ResourceGovernor contract

ZB introduces one new **ephemeral policy owner**:

`RuntimeResourceGovernor` (exact production symbol may differ).

It is **not**:

- a durable job runtime;
- a queue;
- a scheduler replacement;
- a persistence layer;
- a mutation authority;
- a provider authority.

It consumes transient signals such as:

- main/search window lifecycle;
- focus/visibility;
- user-initiated active work;
- OS power mode;
- battery/Low Power state;
- thermal state where available;
- suspension/resume;
- bounded memory/resource pressure signals where implemented.

It produces a transient policy snapshot consumed by `WorkScheduler` and approved adapters.

`WorkScheduler` remains the single expensive-work admission authority.

---

## 6. Runtime modes

The application runtime must converge on the following logical modes.

### 6.1 DORMANT_RESIDENT

Purpose: tray/hotkey/system-wide search availability.

Allowed resident state:

- native/Tauri resident process;
- tray/menu authority;
- global hotkey;
- minimal settings/runtime state needed for the above;
- minimal SQLite/search authority;
- Global Index state/native metadata change bridge;
- `RuntimeResourceGovernor`;
- `WorkScheduler` state;
- lightweight empty job registries/cancellation registries;
- required platform lifecycle subscriptions.

Forbidden active work:

- Main WebView;
- Search WebView unless deliberately warm and still inside a measured short-lived warm policy;
- Managed AI worker polling;
- managed scan;
- dedupe hashing;
- cleanup analysis;
- content extraction;
- thumbnail/Preview pre-generation;
- React timers;
- periodic DB health queries;
- cloud/network AI activity.

Target steady state:

- CPU approximately idle;
- network zero;
- no app-owned periodic DB polling;
- no unexplained disk writes;
- no active AI;
- no speculative file reads.

### 6.2 SEARCH_ACTIVE

Purpose: global shortcut/search interaction.

Allowed:

- lightweight SearchApp/Search WebView;
- Global Index query;
- commands allowed by the existing search capability;
- Open/Reveal by existing ID-only backend revalidation path;
- narrowly reviewed Preview bridge only when explicitly invoked.

Forbidden:

- loading/starting Cleanup, Organize, AI, managed scan, rules mutation, full File Library runtime merely because Search is visible;
- Search Window filesystem mutation authority;
- renderer-supplied arbitrary path activation.

### 6.3 MAIN_FOREGROUND

Purpose: full interactive Zen workspace.

Interactive work receives priority over opportunistic/background work.

Large views/services remain lazy where possible.

### 6.4 USER_TASK_ACTIVE

Purpose: work explicitly requested by the user, e.g.:

- AI Organize;
- Cleanup analysis;
- managed scan;
- duplicate analysis;
- content understanding;
- explicit maintenance/rebuild.

User request permits work; it does not permit unbounded work.

All expensive work must remain bounded, cancellable and admitted through existing authorities.

### 6.5 BACKGROUND_CONTINUATION

A user explicitly started work, then hid/closed the UI.

The task may continue only if its product semantics say it should continue.

Required behavior:

- lower priority/QoS where supported;
- lower concurrency where policy requires;
- keep durable progress/checkpoints;
- no hidden UI polling;
- do not invent new user decisions while hidden;
- tasks waiting for confirmation remain waiting.

### 6.6 CONSTRAINED

Entered for conditions such as:

- Windows Battery Saver / equivalent supported power mode;
- macOS Low Power Mode;
- serious/critical thermal pressure;
- other accepted resource-pressure states.

Allowed:

- interactive work needed for current user action;
- safety-critical mutation/recovery progression to a safe checkpoint;
- minimal search availability.

Opportunistic work must defer/pause.

### 6.7 SUSPENDED / RECONCILE_REQUIRED

OS sleep/unmount/lifecycle transitions remain platform-owned.

Nonessential work stops.

On wake/mount, durable state may be reconciled, but expensive non-safety work is not automatically entitled to resume at full speed.

---

## 7. Startup contract

Startup work is divided into four classes.

### Tier 0 — Safety critical

May run before/around UI readiness when bounded and required for correctness:

- operation journal reconciliation;
- cleanup/Safe Trash journal reconciliation;
- mutation recovery state validation;
- equivalent safety-critical consistency checks.

This tier may never be broadened to hide ordinary analysis/maintenance.

### Tier 1 — Instant infrastructure

May become available immediately:

- tray;
- hotkey;
- search IPC/query authority;
- native metadata change subscription;
- ResourceGovernor.

Must be near-idle when unused.

### Tier 2 — Opportunistic

Must not block interactive readiness:

- Global Index catch-up/rebuild beyond the minimum needed for current query;
- retention prune;
- DB maintenance;
- cache cleanup;
- nonessential reconciliation.

### Tier 3 — User requested

Must not run simply because the app started:

- managed scan;
- dedupe hashing;
- cleanup analysis;
- content extraction;
- AI jobs;
- expensive thumbnail generation;
- semantic classification.

---

## 8. Recovery is not resume

This distinction is binding.

### 8.1 Safety recovery

Filesystem mutation/recovery may need immediate bounded reconciliation to preserve user data and journal truth.

Existing mutation contracts remain unchanged.

### 8.2 Analysis/job recovery

For non-mutating expensive work:

- recover durable state;
- mark resumable/reconcilable;
- do not automatically consume CPU/IO/network merely because a durable row says the job was previously running.

Examples:

- Dedupe;
- Analysis;
- Content extraction;
- Managed AI.

A later implementation may define narrowly reviewed resume behavior, but it must pass ResourceGovernor admission and must not borrow the filesystem-mutation safety exception.

---

## 9. WebView ownership freeze

### 9.1 Main WebView

Long-term target:

```text
resident startup
→ no Main WebView

user opens Zen
→ create Main WebView
→ hydrate small UI session
→ query durable backend state

close to background
→ persist small UI session
→ dispose UI-only/native Preview resources
→ destroy Main WebView
→ return to resident core
```

The current `hide()` behavior is not the final Resident contract.

Destroying the Main WebView must not:

- cancel/commit file mutations incorrectly;
- bypass outstanding confirmation;
- lose durable user-task state;
- convert renderer state into durable truth.

### 9.2 Search WebView

Long-term target:

```text
resident startup
→ no Search WebView

hotkey
→ lazy create / show SearchApp

close
→ optional measured short warm state
→ destroy after the accepted warm policy
```

No arbitrary warm timeout is frozen by ZB-00. Measure cold latency, warm latency and memory return first.

### 9.3 Search frontend runtime

Search must become a real mini runtime rather than the full `App` with branches disabled.

Preferred topology:

```text
frontend bootstrap
├─ MainApp
└─ SearchApp
```

SearchApp may depend only on the minimal theme/i18n/search/command/navigation bridge required by the search capability.

It must not initialize unrelated full-app stores/services merely because they are imported by `AppRuntimeProviders`.

---

## 10. FileWorkspaceRuntime ownership

`FileWorkspaceRuntime` already owns bounded disposal of Browse/Preview/Thumbnail/native-preview resources.

ZB reuses that cleanup authority.

Allowed direction:

- lazy/runtime-owned creation for Main UI and explicit Preview use;
- deterministic `dispose()` when the owning UI/runtime is gone;
- recreate on later demand.

Forbidden:

- replacing `PreviewSession`;
- replacing `MaterializationReadGate`;
- turning runtime disposal into a new source authority;
- handing raw filesystem paths to the renderer;
- keeping Preview/thumbnail/native host resources alive solely to make reopen faster without an accepted measured cache policy.

---

## 11. Database resident-footprint freeze

Current DB pool has `max_size(8)` and no explicit `min_idle`.

ZB-01 is allowed to reduce resident idle connections while preserving burst capacity.

Frozen intent:

```text
resident:
minimal idle DB connections

interactive/heavy:
elastic connections up to reviewed maximum

settled again:
return toward resident minimum
```

ZB-00 does **not** authorize:

- schema changes;
- query-authority changes;
- migration of `files.id`;
- replacing SQLite;
- changing durable table semantics.

SQLite mmap/cache/PRAGMA tuning must be evidence-driven; no arbitrary tuning is frozen here.

---

## 12. Polling-removal freeze

Known periodic wakeups identified at this baseline include:

- Managed AI worker: ~250 ms polling;
- backend managed watcher worker: ~250 ms receive timeout;
- watcher reconciliation DB scheduling: ~1 s;
- Global Index coordinator: provider/default ~2 s cycle;
- Overview health refresh: ~5 s;
- macOS lifecycle/Spotlight/FSEvents stop/run-loop handling: bounded ~250 ms run-loop cycles.

The required direction is:

```text
polling
→ native event / channel / condvar / explicit wake
```

Do not “solve” this merely by changing 250 ms to 2 s or 5 s to 60 s unless the periodic action is itself the reviewed product requirement.

Shutdown/cancellation responsiveness must be retained through explicit wake/stop mechanisms rather than timer polling where feasible.

---

## 13. Global Search runtime freeze

### 13.1 Search domain separation

These remain separate:

```text
Global Search metadata
≠ File Library managed truth
≠ Content Search / semantic understanding
≠ Managed AI
```

A file may be globally searchable while unmanaged and AI-ineligible.

### 13.2 Windows

Preferred full-volume path:

```text
NTFS
→ MFT initial metadata
→ USN incremental metadata
→ Global Index
```

The existing `ZenCanvasGlobalIndex` service remains a privileged **metadata provider/sensor**, not a general Zen authority.

ZB does not authorize moving into the LocalSystem service:

- Global Index SQLite ownership;
- settings authority;
- AI;
- file mutation;
- arbitrary path commands;
- Preview;
- File Library;
- cleanup/restore.

The service command whitelist and same-product/same-session validation remain security boundaries.

Service auto-start may remain until real idle measurements justify a different SCM startup policy.

### 13.3 Full-volume recursive fallback prohibition

A supported fixed/local full-volume native-provider failure must **not** silently become an expensive recursive whole-volume crawl.

Required result:

- degraded / permission-required / rebuild-required / partial truth;
- explicit user-visible source state;
- reviewed explicit fallback only where appropriate.

Recursive crawling remains appropriate only for a deliberately approved bounded folder/source case or a separately reviewed provider.

### 13.4 macOS

Preferred path:

```text
Spotlight / NSMetadataQuery
+ native update notifications
+ FSEvents only for durable gap/reconcile signals
→ Global Index
```

Zen must not create a second full-machine generic crawler merely to duplicate Spotlight.

Spotlight/FSEvents lifecycle should move toward native event blocking/wake rather than timer-driven polling loops.

---

## 14. Managed File Watcher freeze

The managed watcher authority remains backend reconciliation + root revisions.

Allowed ZB change:

- replace idle polling with event-driven wake;
- coalesce actual events;
- map affected paths/roots to bounded reconciliation;
- defer reconciliation under ResourceGovernor when safe.

Forbidden:

- renderer becoming watcher truth;
- a second watcher database;
- losing distinct permission/reconciliation/partial/retry states;
- automatic whole-root rescans on every small event;
- silently coupling watcher changes to dedupe or AI.

A later authority review may decide whether Global Index change events can supply some managed invalidation signals. Until that review is accepted, do not delete the managed watcher simply because the two systems observe overlapping filesystem changes.

---

## 15. AI runtime freeze

The durable managed-AI queue/provider policy remains authoritative.

Execution lifecycle changes are allowed.

Target:

```text
no eligible AI work
→ no polling AI worker activity

eligible explicit work arrives
→ event wake / on-demand consumer
→ bounded execution
→ queue drains
→ worker blocks indefinitely or terminates
```

Cloud/network activity when no AI work exists must be zero.

Local model loading must be demand-driven.

AI execution must continue to honor managed scope/provider/consent/fingerprint/user-correction guards.

---

## 16. Heavy-work admission freeze

All expensive work must converge on `WorkScheduler` + `RuntimeResourceGovernor` policy.

Examples:

- scan;
- dedupe;
- content extraction;
- Preview/Thumbnail;
- Global Index rebuild/catch-up;
- AI;
- cleanup analysis.

Existing subsystem-specific bounds may remain as local safety ceilings, but they must not become independent product-level scheduling authorities.

### Dedupe

Current bounded hashing uses a small worker pool and is already safer than unbounded spawning.

ZB may change its effective concurrency/admission.

ZB must not change duplicate truth/fingerprint/group semantics merely to implement resource policy.

---

## 17. Platform power/QoS freeze

### Windows

Allowed future native policy inputs include supported Windows power/battery/visibility/QoS facilities.

Preferred implementation is event-driven.

Background worker QoS may be lowered independently from interactive UI/search work.

Do not place the entire interactive process into a process-wide background mode that degrades current user interaction merely for convenience.

### Apple Silicon

Use Apple QoS/Low Power/thermal semantics rather than manual P-core/E-core affinity.

Do not bind workers directly to performance/efficiency cores.

Policy intent:

- interactive current-user work remains responsive;
- utility/background work yields;
- Low Power/serious thermal states pause/defer opportunistic work;
- safety-critical operations reach a safe checkpoint.

---

## 18. Settings behavior freeze

ZB may simplify misleading background-index settings only through an explicit migration plan.

In particular, current `backgroundIndexOnStartup` behavior mixes managed scan semantics with startup lifecycle.

Future UI/settings should distinguish concepts such as:

- keep Global Search metadata fresh;
- refresh Managed Library;
- run duplicate analysis.

Do not silently reinterpret an existing persisted user setting into a different permission or AI/content scope.

---

## 19. Files/interfaces allowed to change in later ZB Tracks

The following matrix is an **allowed responsibility envelope**, not blanket authorization.

| Area | Typical files | Allowed ZB change | Must preserve |
| --- | --- | --- | --- |
| composition/startup | `src-tauri/src/main.rs` | lifecycle composition, lazy owners, startup admission | durable authorities; safety recovery |
| scheduler | `src-tauri/src/scheduler.rs` | ResourceGovernor policy input, dynamic capacities/admission | one global WorkScheduler |
| DB pool | `src-tauri/src/db/connection.rs` | idle pool footprint/diagnostics | SQLite authority/schema/query semantics |
| Global Index orchestration | `src-tauri/src/global_index/coordinator.rs` | event-driven wake/pause/resume | repository/provider/search semantics |
| Windows index provider/service | `src-tauri/src/global_index/windows/**` | event/resource lifecycle, provider fallback hardening | metadata-only service, permission boundary, MFT/USN truth |
| macOS index provider | `src-tauri/src/global_index/macos/**` | native run-loop/event lifecycle | Spotlight/FSEvents authority semantics |
| AI execution | `managed_worker_hardened.rs` | on-demand/event-driven consumer lifecycle | queue/provider/scope/consent validation |
| watcher | `src-tauri/src/watcher.rs` | blocking/event-driven worker, coalescing | reconciliation truth/root health |
| scanner | `src-tauri/src/scanner.rs` | admission/defer/resume policy | durable scan semantics |
| dedupe | `src-tauri/src/dedupe.rs` | scheduler admission/concurrency | fingerprint/group truth |
| File Workspace runtime | `file_workspace/integration/runtime.rs` | lazy creation/owner/dispose integration | PreviewSession/ReadGate/Provider authorities |
| app/window control | `src-tauri/src/app_control.rs` | lazy WebViews, Resident/Main/Search lifecycle | Search permission/ID-only activation |
| frontend bootstrap | `src/main.tsx`, `src/App.tsx` | separate MainApp/SearchApp entry/composition | frontend remains projection |
| app runtime | `src/components/AppRuntimeProviders.tsx` | split focused lifecycle owners; remove unrelated Search runtime work | settings/rules/query authorities |
| window behavior | `src/hooks/useWindowBehavior.ts` | Resident transition instead of hide-only | user close semantics, no hidden execution surprise |
| overview | `src/views/scanner/ScannerView.tsx` | events/visible-only fallback refresh | durable status truth |
| Tauri window config | `src-tauri/tauri.conf.json` | programmatic Main/Search creation in the owning Track | permissions, packaging, platform contracts |
| settings | `src-tauri/src/settings.rs` + frontend settings | explicit lifecycle setting migration | persisted-version/settings authority |

Any implementation that needs to move beyond this envelope must stop for architecture review.

---

## 20. W0–W6 safety/authority surfaces ZB MUST NOT opportunistically rewrite

The following are out of scope unless a separate accepted task/ADR explicitly opens them:

- `src-tauri/src/file_ops/**` mutation semantics;
- `src-tauri/src/fs_safety/**` identity/safety semantics;
- Operation Preview correctness/confirmation chain;
- operation journal/recovery strategy;
- Safe Trash layout/journal semantics;
- Restore identity/recovery semantics;
- macOS mutation strategy and provider coordination;
- `MaterializationReadGate` eligibility/actual-open authority;
- `PreviewSession` stale-publication/sourceVersion authority;
- production Preview Provider Registry ordering/capability truth;
- File Library Query V2 query/count/snapshot semantics;
- `LibrarySelectionV1` authority;
- Rule Repository V2 mutation authority;
- Organization Plan ledger semantics;
- managed Content policy/run/artifact semantics;
- Search Window capability expansion;
- arbitrary path activation from renderer/Search Window;
- database schema merely for lifecycle convenience;
- files.id migration;
- installer/service privilege broadening;
- RC1/release/publication state.

If a ZB task discovers that correctness requires one of these changes, it must stop and return to architecture/governance review.

---

## 21. Search Window permission freeze

Search remains intentionally restricted.

ZB lifecycle changes must preserve:

- ID-only search result activation;
- backend revalidation of trusted/enabled source, stale state, live existence/object identity;
- fixed navigation DTO/targets;
- no arbitrary filesystem paths;
- no settings write from Search capability;
- no rule mutation;
- no scan/cleanup/restore/file-operation mutation;
- no AI execution permission;
- no rebuild permission unless explicitly already authorized by the owning capability.

Lazy window creation is not permission expansion.

---

## 22. Memory/cache freeze

ZB cares about **return-to-idle**, not only leak freedom.

Required lifecycle test shape:

```text
open/browse/preview
→ perform bounded work
→ close/dispose/hide
→ settle
→ memory/handles/resources return near baseline
```

Caches must be classified as:

- essential;
- reusable;
- disposable.

Disposable caches must be bounded and evictable.

A later Track may add memory-pressure driven shrinking, but it must not turn cache state into durable product truth.

---

## 23. Resident idle acceptance contract

Before absolute thresholds are frozen, Resident acceptance is qualitative and behavior-based.

Settled DORMANT_RESIDENT must prove:

1. no Main WebView;
2. no Search WebView except an explicitly measured temporary warm state;
3. no active AI worker polling;
4. no managed scan/dedupe/analysis/content worker;
5. no app-owned periodic DB status polling;
6. no network traffic from AI/content features;
7. no unexplained steady disk writes/WAL growth;
8. Global Index work occurs only for actual change/catch-up/rebuild events;
9. lightweight native subscriptions may remain blocked/asleep;
10. task registries and scheduler state may remain resident but inactive;
11. resource counts plateau after repeated use;
12. foreground Search/UI remains responsive when background work is permitted.

---

## 24. Measurement set for later qualification

Long-run/resource QA must observe more than instantaneous CPU percentage.

Measure where the platform permits:

- process CPU time;
- wakeups/context switches;
- Private Commit / PrivateUsage;
- working set/RSS as diagnostic;
- thread count;
- handle/file-descriptor count;
- SQLite connection count;
- disk reads/writes/IOPS;
- DB WAL growth;
- network bytes;
- GPU activity if relevant;
- native host/Preview resource counts;
- WebView process count/working set;
- cold Search create latency;
- warm Search show latency;
- MainApp cold create/reopen latency;
- resource return after hide/destroy;
- 8h resident stability;
- repeated Search/Main open-close cycles.

Do not weaken existing performance gates.

---

## 25. Initial ZB implementation sequence

ZB-00 freezes sequence; it does not implement it.

```text
ZB-00  Runtime Resource & Lifecycle Freeze                 THIS DOCUMENT
  ↓
ZB-01  Database Resident Footprint
  ↓
ZB-02  Idle Polling Removal
  ↓
ZB-03  RuntimeResourceGovernor v1
  ↓
ZB-07  Background Work Admission / Recovery-vs-Resume
  ↓
ZB-04  Search Mini Runtime + lazy Search WebView
  ↓
ZB-05  Programmatic Main WebView / Resident transition
  ↓
ZB-06  FileWorkspaceRuntime lazy lifecycle
  ↓
ZB-08  Global Search native-first event runtime
  ↓
ZB-09  Windows/macOS Power + QoS
  ↓
ZB-10  Heavy-worker admission unification
  ↓
ZB-11  Resident / long-run qualification
```

Numbers reflect the previously reviewed conceptual decomposition; execution may serialize further if a dependency is discovered.

No ZB implementation Track is active merely because this freeze exists.

---

## 26. ZB-01 scope gate

The first recommended implementation Track is deliberately small:

**Database Resident Footprint**

Allowed:

- preserve `max_size` burst capacity unless evidence says otherwise;
- explicitly reduce the idle pool target;
- add diagnostics/tests proving connection lifecycle;
- verify no correctness/recovery regression.

Not allowed:

- schema/query rewrite;
- global DB abstraction rewrite;
- changing durable authority;
- combining unrelated polling/WebView work into ZB-01.

This narrow first step validates the Zero-Burden workflow before larger lifecycle work.

---

## 27. Stop conditions

STOP a ZB implementation and return to architecture review if it requires:

- moving durable authority;
- adding a second scheduler/job runtime/index/watcher truth source;
- broadening Search Window permissions;
- changing filesystem mutation/recovery strategy;
- changing Safe Trash/Restore semantics;
- changing Preview Read Gate/PreviewSession authority;
- moving arbitrary product authority into the Windows LocalSystem index service;
- enabling raw renderer filesystem paths;
- changing database schema solely to make lifecycle easier;
- changing supported-platform truth without the required ADR/governance path;
- making Global Search depend on File Library or AI admission;
- allowing a native-provider failure to silently trigger full-volume recursive crawl;
- allowing hidden/minimized UI to authorize actions that still require user confirmation;
- weakening fail-closed behavior to improve perceived speed;
- weakening existing W0–W6 performance/security/release gates.

---

## 28. Definition of success

Zero-Burden succeeds when Zen has four clearly different resource shapes:

```text
DORMANT
≈ native resident utility

SEARCH
≈ lightweight launcher

MAIN
≈ interactive file workspace

USER TASK
≈ bounded compute/IO service
```

And every path returns toward:

```text
DONE
→ release resources
→ DORMANT
```

The product-level rules remain:

> **Search everything lightly.**  
> **Understand only what is needed.**  
> **Run AI only when asked.**  
> **Consume resources only when useful.**  
> **Touch files only after approval.**
