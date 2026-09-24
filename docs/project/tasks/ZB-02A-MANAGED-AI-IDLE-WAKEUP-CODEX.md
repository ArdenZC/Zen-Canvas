# ZB-02A — Managed AI Idle Wakeup — Codex / Agent Brief

Status: **OWNER-DIRECTED IMPLEMENTATION — do not merge autonomously**

Baseline: `master@f6a4785b3532b8b5e4fa9d428efdc51961e83bf7`

Implementation branch: `perf/zb-02a-managed-ai-idle-wakeup`

Parent direction:

- `docs/project/MASTER_DEVELOPMENT_PLAN.md`
- `docs/project/tasks/ZB-00-RUNTIME-RESOURCE-LIFECYCLE-FREEZE.md`

ZB-02 is the Idle Polling Removal program. It is deliberately split into smaller implementation tracks.

ZB-02A handles **Managed AI only**.

It MUST NOT absorb:

- managed File Watcher polling;
- watcher reconciliation polling;
- Overview polling;
- Global Index coordinator polling;
- Main/Search WebView lifecycle;
- ResourceGovernor;
- Windows/macOS power-policy redesign.

Those remain later ZB tracks.

---

## 0. Objective

Current Managed AI execution creates a permanent worker thread at app startup.

The worker currently wakes approximately every 250 ms even when:

- AI is disabled;
- there are no pending AI jobs;
- no user is using AI;
- no Managed Scope changed;
- no provider/settings changed.

Current shape:

```text
App startup
→ ManagedAiWorker::start()
→ permanent worker
→ check settings
→ check activity policy
→ claim queue
→ sleep 250 ms
→ repeat forever
```

Target shape:

```text
App startup
→ Managed AI execution authority exists

NO eligible work
→ worker blocks indefinitely
→ no recurring DB/settings polling

AI-relevant event
→ explicit wake signal
→ worker re-evaluates settings/policy/queue
→ starts bounded work

job completion
→ explicit wake
→ refill concurrency if needed

queue drained
→ block again
```

Core acceptance statement:

> **Managed AI idle must no longer depend on a 250 ms polling loop.**

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
10. this taskbook.

Then inspect the real implementation and tests:

- `src-tauri/src/global_index/managed_worker_hardened.rs`
- `src-tauri/src/global_index/repository.rs`
- `src-tauri/src/global_index/managed_scope.rs`
- `src-tauri/src/global_index/legacy_queue.rs`
- `src-tauri/src/global_index/coordinator.rs`
- `src-tauri/src/global_index/commands.rs`
- `src-tauri/src/ai/classification.rs`
- `src-tauri/src/ai/settings.rs`
- `src-tauri/src/db/queries/organization/mod.rs`
- `src-tauri/src/db/commands.rs`
- `src-tauri/src/main.rs`
- all Managed AI hardening/queue tests.

Do a call-site audit for every path that can create, re-enable or make an AI job eligible before choosing the final wake wiring.

---

## 2. Frozen authorities

Do not change the durable Managed AI model.

The following remain authoritative:

- `ai_jobs`;
- `ai_job_items`;
- `ai_analysis_state`;
- Managed Scope policy;
- provider policy;
- scope/provider/entry/fingerprint validation;
- user-correction guard;
- retry/failure semantics;
- persisted queue status;
- configured classification concurrency bounds.

This task changes **how an execution worker is awakened**, not what AI work is true or allowed.

No second AI queue or second durable runtime is permitted.

---

## 3. Current implementation facts

At baseline, `ManagedAiWorker::start(db)` spawns:

`zen-canvas-managed-ai-worker`

The worker:

1. calls `reset_running_managed_ai_jobs()`;
2. loops until stop;
3. reaps finished child jobs;
4. reads AI settings;
5. evaluates current activity policy;
6. claims pending Managed AI jobs up to bounded concurrency;
7. sleeps 250 ms;
8. repeats.

There is also a 250 ms sleep on the current macOS activity-policy blocked path.

The main idle defect is not Managed AI job execution itself.

The defect is:

> **the execution authority wakes repeatedly when no useful Managed AI work exists.**

---

## 4. Required architecture

Implement one narrow **ephemeral wake mechanism** for Managed AI execution.

Suitable primitives include:

- bounded/coalescing `sync_channel`;
- condition variable with a generation counter;
- park/unpark with race-safe wake-token semantics;
- an equivalent standard-library primitive.

Do not add a new crate solely to wake this worker unless the existing standard-library/runtime tools are proven insufficient.

The wake primitive must be:

- in-memory only;
- non-durable;
- coalescing/bounded;
- race-safe;
- cheap to clone/pass to producers;
- unable to carry arbitrary work payloads.

The durable queue remains SQLite.

Conceptually:

```text
producer commits durable queue/policy/settings change
        ↓
ManagedAiWakeSignal.notify()
        ↓
worker wakes
        ↓
SQLite remains source of truth
```

The wake signal means only:

> “Managed AI eligibility may have changed; re-check durable truth.”

It must never become a second queue.

---

## 5. Lost-wakeup requirement

The implementation MUST be race-safe around:

```text
check durable queue
        ↓
decide no work
        ↓
start waiting
```

A producer that commits work between those steps must not leave the worker sleeping forever.

Use a primitive whose semantics explicitly preserve or generation-track wakeups.

Do not implement:

```text
AtomicBool event_seen
+
sleep
```

or another hand-written race-prone edge trigger.

Spurious/coalesced wakeups are acceptable.

Lost durable work is not.

---

## 6. Required wake producers

Before implementation, audit all producers. At minimum cover these baseline categories.

### A. Global Index ingestion

Global entry upsert can enqueue Managed AI jobs for covered Managed Scopes.

The Global Index path must explicitly wake Managed AI execution after a successful durable batch that may have created eligible work.

It is acceptable for this producer to generate an occasional spurious wake after a successful relevant batch.

It is not acceptable to wake on a fixed timer.

### B. Managed Scope creation/backfill

Adding a Managed Scope can backfill entries and create initial Managed AI jobs.

After successful scope creation/backfill, execution must be woken when work may now exist.

### C. Managed Scope policy re-enable

`update_managed_scope_policy` can move previously blocked jobs back to `pending`.

This transition must wake execution.

A policy change that only disables work does not need to create background execution.

### D. Manual/reanalysis classification queue

User-triggered classification/reanalysis through the legacy compatibility bridge can enqueue/reopen jobs.

A successful enqueue must wake execution.

### E. Organization Plan “analyze missing”

`analyze_organization_plan_items` can enqueue Managed AI work.

If `queued_count > 0`, execution must wake.

### F. AI settings

Saving AI settings can change eligibility:

- disabled → enabled;
- provider changes;
- credentials/provider configuration becomes usable.

After a successful persisted settings change that may make pending/blocked work eligible, wake execution.

Do not wake before persistence succeeds.

### G. Worker job completion

When an active child AI job finishes, wake the coordinator worker so it can:

- reap the finished handle;
- refill available concurrency from durable pending work;
- return to blocking state if drained.

Do not rely on a 250 ms timer to notice completed child jobs.

### H. Startup

Startup still needs one initial evaluation because durable pending/running-recovered jobs may already exist from the previous process.

The worker may self-signal once after:

`reset_running_managed_ai_jobs()`

or otherwise perform one initial pass before entering event-driven waiting.

Startup must not turn back into a permanent timer.

---

## 7. Producer wiring boundaries

Prefer explicit wake wiring at execution/orchestration boundaries.

Do not silently make every SQLite write wake Managed AI.

Avoid turning `Database` into a generic process event bus solely for this Track.

A reasonable direction is a small cloneable notifier owned by Managed AI execution and supplied only to producers that can affect Managed AI eligibility.

Possible integration points include:

- `ManagedAiWorker::notifier()`;
- Global Index coordinator holding an optional/explicit Managed AI wake handle;
- Tauri command wrappers notifying after successful DB operations;
- narrow orchestration adapters.

The exact symbol/API may differ.

The implementation must remain understandable from ownership alone.

If the only workable design appears to require embedding a generic event bus inside `Database`, STOP and request architecture review instead of building a framework.

---

## 8. Activity-policy blocked work

ZB-03 will later create the unified RuntimeResourceGovernor.

ZB-02A must not prematurely implement that architecture.

Current Managed AI execution consults the existing macOS activity policy.

If durable AI work is known to exist but current activity policy temporarily forbids nonessential background work, ZB-02A may retain a **bounded fallback recheck timeout only for that blocked-work condition** if there is no existing native wake source available yet.

This exception must satisfy all of the following:

- no timeout while there is no known/possible AI work;
- no 250 ms idle polling;
- clearly isolated and documented as temporary until ZB-03/ZB-09 power-event integration;
- materially slower than the former busy wake loop;
- no repeated queue/settings polling in true idle state.

Do not expand ZB-02A into macOS power notification redesign.

---

## 9. Shutdown requirement

Current shutdown sets a stop flag and joins the worker.

After moving to indefinite blocking:

`shutdown()`

MUST explicitly wake the worker.

Required:

```text
shutdown
→ set stop
→ notify/unpark
→ worker observes stop
→ joins active children according to existing semantics
→ join returns promptly
```

Do not leave shutdown dependent on timeout expiry.

Add a focused test for idle shutdown.

---

## 10. Concurrency semantics

Preserve current bounded concurrency semantics:

```text
classification_concurrency
clamped to 1..4
then constrained by current activity policy
```

ZB-02A does not redesign concurrency values.

When at max active concurrency:

- queue notifications may coalesce;
- worker must not spin;
- child completion must wake the worker;
- the worker must refill available slots from durable queue truth.

No job may be executed twice because of repeated wake signals.

---

## 11. Settings and provider semantics

Do not move provider/settings authority into the wake mechanism.

The worker must still re-read current durable settings after wake.

A wake signal cannot carry:

- API keys;
- provider configuration;
- scope IDs;
- file paths;
- job payloads.

It only announces that durable eligibility may have changed.

Cloud consent/provider validation remains unchanged.

---

## 12. Tests required

Add deterministic focused tests.

At minimum prove:

### 12.1 True idle no recurring polling

With:

- no pending eligible jobs;
- no wake events;

the worker must not repeatedly call queue/settings evaluation on a 250 ms cadence.

Prefer an instrumented test seam/counter over wall-clock inference.

A short wall-clock guard may prove absence of repeated execution, but the primary assertion should be deterministic where possible.

### 12.2 Explicit wake processes durable work

Create durable eligible work, emit the wake, and prove processing begins/completes through the existing queue semantics.

Use a deterministic/fake provider seam already present in tests if available.

Do not make unit tests depend on real Ollama/OpenAI/network.

### 12.3 No lost wakeup

Exercise the boundary where work becomes durable around the worker entering its wait state.

The test must prove the job is eventually observed without periodic polling.

### 12.4 Job completion refills concurrency

With concurrency >1 or a controlled sequence:

- active job finishes;
- completion wake is emitted;
- another pending job is picked up;
- no timer is required.

### 12.5 Settings/policy wake

At least one test must prove previously ineligible/blocked work becomes discoverable after an explicit settings/policy wake event.

### 12.6 Idle shutdown

A worker blocked with no work must shut down promptly after `shutdown()`.

Do not use a 250 ms timeout as the reason shutdown succeeds.

### 12.7 Wake coalescing

Multiple quick notifications must not:

- enqueue duplicate durable jobs;
- cause duplicate execution;
- create unbounded memory growth.

---

## 13. Observability / evidence

ZB-02A must produce direct evidence of wake behavior.

Add only narrow test/debug evidence needed for this Track.

Record before:

```text
idle worker:
~4 coordinator wake cycles / second
settings/queue re-evaluated repeatedly
```

Record after:

```text
idle worker:
0 periodic coordinator wake cycles attributable to Managed AI

wake reasons:
startup / durable-work-producer / settings-or-policy / child-completion / shutdown
```

Do not add production telemetry or renderer diagnostics.

If exact OS wakeup counts are noisy, deterministic worker-loop counters in tests are sufficient for correctness evidence.

---

## 14. Allowed production files

Expected production changes may include a small subset of:

- `src-tauri/src/global_index/managed_worker_hardened.rs`
- `src-tauri/src/global_index/coordinator.rs`
- `src-tauri/src/global_index/commands.rs`
- `src-tauri/src/ai/classification.rs`
- `src-tauri/src/ai/settings.rs`
- `src-tauri/src/db/commands.rs`
- `src-tauri/src/main.rs`

If needed for an explicit producer boundary:

- `src-tauri/src/global_index/managed_scope.rs`
- `src-tauri/src/global_index/legacy_queue.rs`
- `src-tauri/src/db/queries/organization/mod.rs`

Tests may change alongside them.

This list is an envelope, not a requirement to touch all files.

Minimize the actual diff.

---

## 15. Explicit non-goals

Do NOT change:

- durable AI tables/schema;
- queue status vocabulary;
- retry count;
- provider request/response semantics;
- user-correction semantics;
- Managed Scope definitions;
- AI prompts/results;
- semantic classification model;
- AI-only product migration;
- WorkScheduler architecture;
- ResourceGovernor;
- watcher behavior;
- Global Index 2-second polling loop;
- Overview 5-second polling;
- Search/Main WebView lifecycle;
- DB pool configuration;
- SQLite PRAGMAs;
- dependencies merely for wake signaling;
- STATUS/ROADMAP;
- W6/RC1/release/publication state.

Do not start ZB-02B.

---

## 16. Validation

Run focused Managed AI/global-index tests first.

At minimum identify and run the real current filters covering:

- managed worker hardening;
- managed scope queueing/policy;
- legacy queue;
- global index integration;
- organization analyze queue path;
- AI settings save behavior.

Then run:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
npm run verify:rust
npm run test:performance:architecture
npm run verify:security
```

Use current repository routing for any additional required gates.

Do not lower thresholds.

Do not add sleep-heavy flaky tests merely to prove a wake mechanism.

---

## 17. Result document

Create:

`docs/project/tasks/ZB-02A-MANAGED-AI-IDLE-WAKEUP-RESULT.md`

Record:

- baseline;
- final branch/head;
- changed files;
- exact old polling behavior;
- exact new wake architecture;
- audited producer list;
- temporary activity-policy blocked-work fallback, if any;
- deterministic no-idle-polling evidence;
- lost-wakeup evidence;
- child-completion/refill evidence;
- shutdown evidence;
- validation results;
- unexpected findings;
- confirmation that durable AI authority/schema did not change;
- confirmation ZB-02B was not started.

Disposition:

`READY FOR OWNER REVIEW`

or

`BLOCKED`.

---

## 18. Stop conditions

STOP instead of expanding scope if:

- a second durable queue seems necessary;
- a generic process event bus seems necessary;
- Database would need to become a broad event dispatcher;
- queue correctness would require schema changes;
- provider semantics need redesign;
- eliminating idle polling requires implementing full ZB-03 ResourceGovernor first;
- Global Index authority needs redesign rather than a narrow wake notification;
- command permission boundaries need expansion;
- tests expose a distinct queue correctness bug unrelated to wake scheduling;
- production changes expand into watcher/Overview/WebView polling.

Record the finding and return to owner review.

---

## 19. Git discipline

Work only on:

`perf/zb-02a-managed-ai-idle-wakeup`

The taskbook commit is already on that branch.

Allowed:

- implementation commits;
- focused result documentation;
- push;
- Draft PR if needed after local validation.

Forbidden:

- merge;
- mark Ready;
- delete branch;
- update STATUS/ROADMAP;
- start ZB-02B.

---

## 20. Definition of Done

ZB-02A is ready for owner review only when:

1. the 250 ms true-idle Managed AI polling loop is gone;
2. no eligible AI work means no recurring Managed AI DB/settings evaluation;
3. all known durable-work eligibility producers explicitly wake execution;
4. wakeups cannot be lost across check→wait races;
5. job completion refills concurrency without a timer;
6. idle shutdown wakes and joins promptly;
7. durable queue/provider/scope/user-correction authority is unchanged;
8. no new dependency/framework/second queue was created;
9. full Rust/required gates are green;
10. result document is complete;
11. ZB-02B has not started.
