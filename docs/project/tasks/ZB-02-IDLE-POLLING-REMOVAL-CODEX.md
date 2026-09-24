# ZB-02 — Idle Polling Removal — Codex / Agent Brief

Status: **OWNER-DIRECTED IMPLEMENTATION — do not merge autonomously**

Baseline: `master@f6a4785b3532b8b5e4fa9d428efdc51961e83bf7`

Implementation branch: `perf/zb-02-idle-polling-removal`

This Track supersedes the earlier unmerged ZB-02A-only split. The intent is to avoid paying full validation cost for several tiny PRs while still keeping one coherent architectural theme:

> **remove avoidable idle polling and recurring wakeups that provide no user value.**

This Track combines three closely related scopes:

1. Managed AI idle polling;
2. managed File Watcher / reconciliation idle polling;
3. Overview / frontend technical-status polling.

It does **not** absorb Global Index provider/runtime redesign, WebView lifecycle, ResourceGovernor, or platform power/QoS.

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

Then inspect the real owners and tests for:

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
- `src-tauri/src/watcher.rs`
- watcher-related settings/runtime integration
- Overview / scanner health/status frontend owners
- `src-tauri/src/main.rs`
- all relevant tests.

---

## 2. Validation strategy — important

Do **not** run the repository's full validation suite after each internal subtask.

Use this cadence:

### Internal checkpoint validation

After each sub-scope:

- run formatter for touched language;
- run only focused unit/integration tests for the touched subsystem;
- run only the smallest static/type check needed to catch immediate breakage.

Do **not** run full Rust, extended performance, hosted-equivalent quality gates after each checkpoint.

### Final Track validation

Only after all three sub-scopes are complete and integrated on this branch, run the full Track validation once:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
npm run verify:rust
npm run test:performance:architecture
npm run verify:security
```

Run additional repository-routed gates only once at the end.

If a focused checkpoint fails, repair it before continuing. Do not use full-suite runs as the development feedback loop.

---

## 3. Scope A — Managed AI idle polling

Current defect:

```text
ManagedAiWorker
→ wakes about every 250 ms
→ re-reads settings
→ checks policy
→ probes durable queue
→ repeats even when no AI work exists
```

Target:

```text
no eligible work
→ block indefinitely

durable AI eligibility changes
→ explicit coalescing wake

child AI job completes
→ wake coordinator for refill

shutdown
→ explicit wake + prompt join
```

Requirements:

- SQLite AI tables remain the durable queue authority;
- wake signal is in-memory only and cannot carry job payloads;
- no lost wake across check→wait races;
- no second queue;
- no generic event-bus framework;
- no new dependency unless unavoidable and reviewed;
- current provider/scope/fingerprint/user-correction/retry semantics remain unchanged.

Audit wake producers, including at least:

- Global Index ingestion that may enqueue Managed AI jobs;
- Managed Scope add/backfill;
- Managed Scope policy re-enable;
- manual/reanalysis classification;
- Organization Plan analyze-missing;
- AI settings changes that may make work eligible;
- child-job completion;
- startup recovered pending work.

If current macOS activity policy temporarily blocks **known pending work**, a bounded temporary recheck may remain only for that blocked-work state until ZB-03/ZB-09. True idle must not retain a timeout loop.

Focused tests must cover:

- no recurring idle coordinator evaluation;
- explicit wake processes durable work;
- no lost wake;
- child completion refills concurrency;
- settings/policy eligibility wake;
- idle shutdown;
- wake coalescing/no duplicate execution.

---

## 4. Scope B — Managed File Watcher / reconciliation polling

Audit the current watcher implementation before editing.

Known direction from ZB-00:

```text
notify callback
→ bounded event signal
→ worker

current idle behavior:
recv_timeout / periodic wake
+
periodic reconciliation DB/root checks
```

Target:

```text
no filesystem event
→ worker blocks

filesystem event
→ wake
→ bounded coalescing/debounce
→ mark affected roots
→ schedule bounded reconciliation

settings/root lifecycle event
→ explicit wake/reload

shutdown/suspend/resume
→ explicit lifecycle signal
```

Requirements:

- backend watcher reconciliation/root revision remains authoritative;
- no renderer watcher authority;
- no second watcher database;
- overflow/permission/retry/partial states remain truthful;
- do not silently replace watcher correctness with Global Index events in this Track;
- do not rescan every root for every small file event;
- remove periodic idle DB/root reconciliation queries where explicit root/settings lifecycle signals can replace them.

A short debounce after a **real filesystem event** is allowed. That is not idle polling.

If a periodic correctness audit is genuinely required and cannot be removed safely, isolate it as a low-frequency safety audit with written evidence for why event-driven correctness is insufficient. Do not preserve 1-second polling merely for convenience.

Focused tests must cover:

- no-event idle block;
- filesystem event wakes/coalesces;
- relevant root reconciliation occurs;
- settings/root reload wakes;
- shutdown/suspend wakes promptly;
- overflow/permission semantics unchanged.

---

## 5. Scope C — Overview / frontend polling

Audit the exact current 5-second or other technical-status refresh loops before editing.

Goal:

> a hidden or unrelated UI must not keep waking the backend to refresh technical status.

Preferred order:

1. use existing backend/frontend events if authoritative state already emits them;
2. refresh on view activation / visibility/focus when appropriate;
3. refresh after user actions that can change the displayed state;
4. use a slow visible-only fallback only when no event source exists and stale UI would be materially misleading.

Hard requirements:

- no Overview polling while Main UI is hidden/not mounted;
- no Search runtime polling for Overview data;
- do not introduce a new cross-app event bus framework solely for this;
- do not change durable status authority;
- do not make Overview the source of runtime truth.

If a visible-only fallback interval remains, document why. It must stop when the view is not visible/active.

Focused tests must cover:

- no timer when Overview is not active;
- activation performs initial refresh;
- authoritative event/user action refreshes the view where implemented;
- cleanup/unmount removes timers/listeners.

---

## 6. Explicitly out of scope

Do NOT include:

- Global Index coordinator/provider 2-second event-runtime redesign;
- Windows MFT/USN architecture changes;
- macOS Spotlight/FSEvents native loop redesign;
- Main WebView create/destroy lifecycle;
- Search Mini Runtime;
- ResourceGovernor;
- Windows/macOS power/QoS;
- DB pool tuning;
- schema/migrations;
- AI semantic migration;
- Rules/Preference Memory;
- provider/prompt/result changes;
- filesystem mutation/recovery;
- STATUS/ROADMAP;
- W6/RC1/publication.

These belong to later Tracks.

---

## 7. Internal commit/checkpoint structure

Use one branch and one final PR, but keep implementation reviewable.

Suggested commits:

```text
1. refactor: make managed AI worker event-driven
2. refactor: remove managed watcher idle polling
3. refactor: stop inactive Overview status polling
4. test/docs: close ZB-02 idle polling removal
```

Exact commit count may differ.

Do not open/merge separate PRs for A/B/C.

---

## 8. Result evidence

Create:

`docs/project/tasks/ZB-02-IDLE-POLLING-REMOVAL-RESULT.md`

Record a before/after table such as:

| Source | Before | After |
| --- | --- | --- |
| Managed AI | ~250 ms idle coordinator wake | event-driven true-idle block |
| Managed watcher | timeout wake / periodic reconcile | event/lifecycle-driven |
| Overview | recurring technical-status timer | active/event-driven or justified visible-only fallback |

For each source record:

- exact code owner;
- wake/event mechanism;
- any remaining bounded timeout and why;
- deterministic focused test evidence;
- full final validation.

Also record:

- schema changes: NONE;
- durable authority changes: NONE;
- new dependency/framework: NONE unless explicitly reviewed;
- ZB-03 started: NO.

Disposition:

`READY FOR OWNER REVIEW`

or

`BLOCKED`.

---

## 9. Stop conditions

STOP and report rather than broaden the task if any sub-scope requires:

- a generic global event bus;
- a second durable queue/watcher authority;
- schema changes;
- moving durable authority;
- full ResourceGovernor implementation;
- Global Index provider/runtime redesign;
- Search/Main WebView architecture changes;
- weakening watcher overflow/permission/recovery correctness;
- changing AI provider/semantic behavior;
- changing release/current-truth state.

A distinct discovered defect should be recorded, not opportunistically fixed.

---

## 10. Git discipline

Work only on:

`perf/zb-02-idle-polling-removal`

Do not use the earlier `perf/zb-02a-managed-ai-idle-wakeup` branch; it is superseded and unmerged.

Allowed:

- implementation commits;
- focused checkpoint testing;
- one final result document;
- push;
- one Draft PR after full local validation.

Forbidden:

- merge;
- mark Ready;
- update STATUS/ROADMAP;
- start ZB-03.

---

## 11. Definition of Done

ZB-02 is ready for owner review when:

1. Managed AI true-idle 250 ms polling is gone;
2. managed watcher true-idle timeout/reconciliation polling is removed or any remaining safety audit is explicitly justified and materially low-frequency;
3. inactive Overview no longer performs recurring technical-status polling;
4. focused tests prove each subsystem's event-driven lifecycle;
5. no durable authority/schema/provider semantics changed;
6. no generic event-bus framework was introduced;
7. all three scopes coexist correctly on the same branch;
8. full validation is run **once at the end** and is green;
9. result document is complete;
10. ZB-03 has not started.
