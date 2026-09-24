# ZB-03 — Runtime Resource Governance — Codex / Agent Brief

Status: **OWNER-DIRECTED IMPLEMENTATION — do not merge autonomously**

Baseline: `master@ea942b433ea7ad68297f731972f5bda49c7318b8`

Implementation branch: `perf/zb-03-runtime-resource-governance`

Parent direction:

- `docs/project/MASTER_DEVELOPMENT_PLAN.md`
- `docs/project/tasks/ZB-00-RUNTIME-RESOURCE-LIFECYCLE-FREEZE.md`
- `docs/project/tasks/ZB-01-DATABASE-RESIDENT-FOOTPRINT-RESULT.md`
- `docs/project/tasks/ZB-02-IDLE-POLLING-REMOVAL-RESULT.md`

This is one **medium-granularity Track**. Do not split it into separate PRs for Windows/macOS/scheduler/content/AI unless a stop condition is hit.

The Track goal is:

> **Zen should admit, bound and tag expensive background work according to current system conditions without creating a second scheduler, persistent policy engine, or idle monitor.**

ZB-03 owns resource admission and efficiency policy only. It does not own durable job truth, filesystem truth, AI semantics, WebView lifecycle or Global Search provider architecture.

---

## 1. Required read set

Read completely before editing:

1. `AGENTS.md`
2. `docs/project/STATUS.md`
3. `docs/project/ROADMAP.md`
4. `docs/project/MASTER_DEVELOPMENT_PLAN.md`
5. `docs/project/ARCHITECTURE_MAP.md`
6. `docs/project/DEVELOPMENT_WORKFLOW.md`
7. `docs/project/CODE_MAINTAINABILITY.md`
8. `docs/project/tasks/ZB-00-RUNTIME-RESOURCE-LIFECYCLE-FREEZE.md`
9. `docs/project/tasks/ZB-01-DATABASE-RESIDENT-FOOTPRINT-RESULT.md`
10. `docs/project/tasks/ZB-02-IDLE-POLLING-REMOVAL-RESULT.md`
11. this taskbook.

Then inspect real owners and tests:

- `src-tauri/src/scheduler.rs`
- `src-tauri/src/platform/macos/activity.rs`
- `src-tauri/src/platform/macos/lifecycle.rs`
- current Windows platform modules and `windows-sys` features
- `src-tauri/src/main.rs`
- `src-tauri/src/scanner.rs`
- `src-tauri/src/dedupe.rs`
- `src-tauri/src/analysis.rs`
- `src-tauri/src/content.rs`
- `src-tauri/src/storage_analyzer.rs`
- `src-tauri/src/global_index/managed_worker_hardened.rs`
- File Workspace / Preview scheduler adapters and performance tests.

Audit all direct use of:

- `MacActivitySnapshot::current()`
- `policy_for(...)`
- `allow_nonessential_background_work()`
- fixed sleeps used only to wait for resource/power eligibility
- `available_parallelism()` used to size background workers independently of WorkScheduler.

---

## 2. Supported-platform contract

The optimization target is intentionally narrow:

- Windows 10 and later;
- macOS on Apple Silicon only.

Do not add Linux or Intel-macOS compatibility work.

Do not freeze a narrower Windows build number in project truth during this Track.

---

## 3. Existing authority — must be preserved

`WorkScheduler` is already the process-local expensive-work admission authority.

ZB-03 MUST NOT create:

- `ResourceSchedulerV2`;
- a second queue;
- a second durable job runtime;
- a renderer-side scheduler;
- a persistent resource-policy table;
- a generic task executor that takes durable ownership from existing authorities.

The new component may be called `RuntimeResourceGovernor` (or an equivalently narrow name), but its responsibility is only:

```text
observe transient platform/runtime pressure
        ↓
produce an admission/capacity/QoS decision
        ↓
existing WorkScheduler / bounded worker owners consume it
```

It must not own durable tasks.

---

## 4. RuntimeResourceGovernor contract

Implement a small transient governor with injectable/testable platform facts.

Conceptual input:

```text
platform
power-saving / low-power state
thermal state where available
AC/battery fact where useful
requested WorkClass
configured resource capacity
```

Conceptual output:

```text
allow_background
effective CPU / IO / provider-network limits
efficiency QoS intent
optional reason code for tests/diagnostics
```

The exact structs may differ.

Hard requirements:

- no SQLite persistence;
- no frontend/localStorage authority;
- no always-on sampling timer;
- no cloud/telemetry;
- thread-safe;
- cheap snapshot/read path;
- deterministic injected snapshots for tests;
- policy affects **when/how much** work runs, never what durable state is true.

---

## 5. Platform policy direction

### 5.1 Windows 10+

Use supported native Windows facts.

At minimum audit/consider:

- `GetSystemPowerStatus`;
- `SYSTEM_POWER_STATUS.SystemStatusFlag` for Battery Saver;
- AC/battery status where useful;
- existing `windows-sys` dependency before adding any crate.

The normal admission path may query a cheap current snapshot on demand. Do not add a periodic Windows power polling thread.

Background work should become more conservative when Battery Saver is active.

Do not reduce foreground/user-interactive correctness work to a background class merely to save power.

### 5.2 macOS Apple Silicon

Reuse the existing:

- `NSProcessInfo.thermalState`;
- `isLowPowerModeEnabled`;
- existing `MacActivitySnapshot` behavior.

Where practical, native notifications for power/thermal changes may wake blocked resource admission:

- power-state change notification;
- thermal-state change notification.

Do not create a periodic macOS activity monitor.

Preserve existing safety semantics:

- serious/critical thermal state may pause nonessential background work;
- low-power mode should bound background concurrency;
- interactive work must remain usable.

### 5.3 Unknown/unavailable state

Unknown platform pressure must fail conservatively but not make the product unusable.

Do not interpret “unknown” as “run unbounded”.

---

## 6. WorkScheduler integration

Prefer adapting the existing `PlatformResourcePolicy` seam instead of inserting policy checks throughout the codebase.

The final ownership should look like:

```text
existing durable authority
        ↓
WorkRequest
        ↓
WorkScheduler
        ↓
RuntimeResourceGovernor-backed policy
        ↓
ResourceLease
```

The governor is policy; WorkScheduler remains admission/queue/fairness authority.

### 6.1 Preserve WorkClass priority

Existing:

- `Foreground`
- `Interactive`
- `Background`

remain the work classes.

Do not add many new priority enums merely for this Track.

### 6.2 Dynamic capacity

A policy change may affect future grants and queued work.

Do not revoke an already-granted lease in a way that corrupts durable work.

Filesystem mutation/recovery correctness always outranks resource optimization.

### 6.3 Scheduler waiting

Audit the current scheduler's repeated ~50 ms timed wake while waiting for a lease.

Target:

> **A queued request should not wake every 50 ms merely to rediscover that nothing changed.**

Use condition-variable/event wakeups for:

- resource release;
- cancellation;
- superseding request;
- policy/governor change;
- shutdown/lifecycle where applicable.

A timeout is allowed only when required for:

- caller deadline;
- a documented external cancellation source that cannot signal;
- a known policy-blocked request when the platform has no usable change notification.

If such a fallback remains, isolate it to the blocked/active state and make it materially slower than 50 ms.

True idle with an empty scheduler queue must have no governor/scheduler timer.

---

## 7. Background heavy-authority migration

Audit and migrate the **existing direct resource policy islands** so they converge on the governor / WorkScheduler instead of separately interpreting macOS activity.

At minimum cover the following authorities.

### 7.1 Managed scan

Managed scan already uses `ManagedScanResourceLeaseAdapter`.

Preserve that authority and make sure its Background/Foreground class receives the new governor decision.

Do not redesign scan durability.

### 7.2 Dedupe hashing

Current dedupe computes its own worker count and directly applies macOS activity policy.

Move resource/concurrency policy toward the shared governor.

Requirements:

- durable dedupe run remains the authority;
- bounded hash worker pool remains bounded;
- background dedupe must not independently ignore the shared capacity decision;
- no second scheduler;
- cancellation semantics unchanged.

### 7.3 Analysis

Current Analysis can sleep/recheck every 250 ms while macOS activity policy blocks work.

Replace this policy polling with shared governor admission/wait signaling.

No 250 ms power-policy polling loop should remain in true policy-blocked wait if the governor can signal change.

Analysis run/status/finding semantics remain unchanged.

### 7.4 Content Understanding

Current Content processing also directly waits on macOS activity policy.

Migrate the same way:

- shared policy;
- event/condition-based blocked wait where possible;
- no durable schema/state changes;
- content extraction/publication semantics unchanged.

### 7.5 Managed AI

ZB-02 already made true idle event-driven.

Replace its direct macOS policy decision with the shared governor decision where this can be done without weakening the ZB-02 wake contract.

The existing 5-second activity-policy fallback should disappear if ZB-03 provides a reliable governor-change wake.

If a platform-specific fallback must remain on Windows because no event source is installed, document it as **known queued work only**, never true idle.

### 7.6 Storage/Cleanup analysis

Audit storage analysis / cleanup scanning for expensive independent worker admission.

Integrate only the non-destructive analysis/scanning portions where the shared scheduler cleanly fits.

Do **not** put Safe Trash, restore, operation journal recovery, or destructive execution behind a resource policy that could interrupt safety-critical completion.

---

## 8. Efficiency QoS

This Track may add **best-effort thread efficiency hints** for non-interactive background compute/I/O workers.

### Windows

Prefer existing native APIs and existing `windows-sys`.

For background worker threads, audit/use thread-level power throttling / EcoQoS semantics where supported.

Do not apply process-wide EcoQoS to Zen's UI/interactive process.

Foreground/interactive work must not be accidentally tagged as background efficiency work.

### macOS

Use supported QoS mechanisms only at a narrow background worker boundary.

Do not introduce unsafe platform FFI merely for a cosmetic label if no safe/testable seam exists.

If macOS worker QoS cannot be implemented cleanly inside this Track, keep governor admission/concurrency correct and record QoS tagging as a bounded follow-up finding rather than adding risky infrastructure.

### QoS rules

- QoS is an execution hint, not durable state;
- failure to set a hint must not corrupt/cancel work;
- tests should validate decision/wiring through abstractions rather than assume CI hardware scheduling behavior.

---

## 9. Policy baseline

Do not invent aggressive throttling without evidence.

Preserve current product behavior where possible and centralize it.

Recommended initial semantics:

### Healthy / normal

- configured scheduler capacity;
- background allowed.

### Windows Battery Saver

- new nonessential Background work may be denied/deferred;
- Foreground/Interactive remain admitted subject to bounded capacity;
- do not cancel a safety-critical active operation.

### macOS Low Power

- preserve bounded background work semantics, with reduced CPU parallelism;
- no unbounded worker count.

### macOS Serious/Critical thermal

- new nonessential Background work denied/deferred;
- interactive work remains possible at conservative capacity;
- no new heavy parallel fan-out.

### Unknown pressure

- bounded conservative capacity;
- no unbounded fallback.

Exact numeric CPU limits should reuse/reconcile current reviewed behavior rather than proliferate magic numbers.

---

## 10. Resource-change wake model

The governor may expose a tiny process-local generation/notification seam so queued policy-blocked work can re-evaluate promptly.

This signal means only:

> “transient resource policy may have changed.”

It must not carry durable job payloads.

Coalescing is allowed.

Do not create a general application event bus.

If no native change event is available on a platform, a slow fallback is acceptable **only while known work is blocked by policy**.

No idle polling.

---

## 11. Tests required

Use injected platform snapshots; do not depend on CI machines actually entering Battery Saver or thermal stress.

At minimum prove:

### 11.1 Governor decisions

- Windows normal vs Battery Saver;
- macOS normal / Low Power / serious / critical;
- unknown state remains bounded;
- Foreground/Interactive are not accidentally treated like Background.

### 11.2 WorkScheduler integration

- Background grant obeys governor;
- Foreground/Interactive can proceed under constrained policy;
- effective capacity is reduced when expected;
- capacity is restored after policy returns to normal;
- no second scheduler exists.

### 11.3 No periodic scheduler wake

Instrument the waiting path.

With a queued request and no state change, prove there is no unconditional 50 ms wake loop.

Policy/resource/cancellation notifications must wake promptly.

### 11.4 Analysis / Content blocked wait

Prove they wait on shared resource eligibility rather than a 250 ms sleep loop.

Cancellation must still wake/exit promptly.

### 11.5 Managed AI

Prove ZB-02 true-idle behavior remains intact.

A policy change with known pending work wakes it without restoring a true-idle timer.

### 11.6 Dedupe

Prove worker count/admission is bounded by governor/shared capacity and cancellation remains correct.

### 11.7 QoS abstraction

Where QoS is implemented:

- Background selects efficiency mode;
- Interactive/Foreground do not;
- native-call failure degrades safely.

---

## 12. Internal checkpoint / validation strategy

This is one Track and one PR.

Do not run full repository validation after every sub-scope.

Suggested internal checkpoints:

1. governor + scheduler policy;
2. scheduler wait wakeup behavior;
3. AI/Analysis/Content policy migration;
4. dedupe/storage worker integration;
5. platform QoS;
6. final result/validation.

At each checkpoint run only:

- formatter for touched code;
- focused unit/integration tests;
- narrow Clippy/type checks as needed.

Run the expensive full validation **once at the end**.

---

## 13. Final validation

After all ZB-03 scopes are integrated:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
npm run verify:rust
npm run test:performance:architecture
npm run verify:security
npm run typecheck
npm test
```

Run current routed extended performance/native checks once.

Create one Draft PR and let Hosted CI provide the final Windows/macOS integration proof.

Do not repeatedly run full extended profiles after small repair commits; use focused tests, then final Hosted CI.

---

## 14. Result document

Create:

`docs/project/tasks/ZB-03-RUNTIME-RESOURCE-GOVERNANCE-RESULT.md`

Record:

- baseline;
- production HEAD;
- final HEAD;
- changed files;
- governor ownership/contract;
- Windows policy;
- macOS policy;
- WorkScheduler changes;
- eliminated fixed resource-policy polling;
- remaining timeouts and exact justification;
- authorities migrated;
- QoS implementation/follow-up;
- focused checkpoint evidence;
- final local validation;
- Hosted CI;
- unexpected findings;
- confirmation that durable authorities/schema remain unchanged;
- confirmation that ZB-04/WebView lifecycle and Native Global Search were not started.

Disposition:

`READY FOR OWNER REVIEW`

or

`BLOCKED`.

---

## 15. Explicit non-goals

Do NOT include:

- Main WebView create/destroy lifecycle;
- Search Mini Runtime;
- Global Index 2-second provider/runtime redesign;
- MFT/USN architecture changes;
- Spotlight/FSEvents provider redesign;
- AI semantic migration;
- Rules/Preference Memory;
- schema/migrations;
- new durable job tables;
- filesystem mutation/recovery redesign;
- process-wide telemetry;
- user-facing performance settings;
- Linux;
- Intel macOS;
- STATUS/ROADMAP;
- W6/RC1/publication changes.

---

## 16. Stop conditions

STOP and report if implementation requires:

- a second scheduler or generic executor;
- a persistent resource-policy database;
- a broad event-bus framework;
- destructive operation interruption to satisfy power policy;
- schema changes;
- Global Index provider redesign;
- WebView lifecycle redesign;
- platform-specific unsafe code with unclear correctness boundary;
- changing durable job authority;
- large dependency additions.

A newly discovered unrelated performance defect should be recorded, not opportunistically absorbed.

---

## 17. Git discipline

Work only on:

`perf/zb-03-runtime-resource-governance`

Allowed:

- implementation commits;
- focused checkpoint tests;
- one Result document;
- one Draft PR.

Forbidden:

- merge;
- mark Ready;
- update STATUS/ROADMAP;
- start WebView lifecycle / Native Global Search tracks.

---

## 18. Definition of Done

ZB-03 is ready for owner review only when:

1. one shared transient governor drives resource policy;
2. WorkScheduler remains the sole process-local admission authority;
3. Windows Battery Saver and macOS Low Power/thermal conditions affect background admission/concurrency;
4. true idle creates no governor sampling timer;
5. scheduler/resource-policy waits no longer rely on unconditional 50 ms or 250 ms wake loops where explicit wake is available;
6. Managed AI retains ZB-02 true-idle behavior;
7. Analysis/Content/Dedupe no longer maintain independent conflicting macOS policy islands;
8. destructive/recovery correctness is untouched;
9. QoS hints, if implemented, are background-only and best-effort;
10. full validation is run once at Track end and green;
11. Result document is complete;
12. WebView lifecycle and Native Global Search redesign have not started.
