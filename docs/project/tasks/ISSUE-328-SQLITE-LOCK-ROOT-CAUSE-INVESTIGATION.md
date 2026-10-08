# Issue #328 SQLite Lock Root-Cause Investigation

## Scope and disposition

This branch is an investigation-only continuation of the authorized Issue #328
track. The source changes add a test-only SQLite fixture and this report. No
production Rust behavior, schema, package version, IPC contract, retry policy,
busy timeout, journal mode, Settings rollback, or watcher behavior changes.

**Historical root cause: unresolved.** The native qualification record contains
the text `database is locked`, but not the native SQLite result code, operation,
connection role, transaction boundary, lock holder, or observer implementation.
The reproducer below proves that a normal second writer against the product
database pool can produce `SQLITE_BUSY`; it does not identify the historical
holder.

**#329 correlation: POSSIBLE SHARED CONTENTION.** The two issue paths can
contend for SQLite's one-writer slot in the same application database. The
historical #329 transaction stage and lock owner are not available, so a shared
historical root cause is not proved.

## Exact baseline and historical observation

- Baseline: `master@7a2e1b31bb4ac49aa8e8d2378fc9adb6bb64034f`.
- Baseline tree: `79bb2dad6d13a0b579b70b78972ab0d5f7736b47`.
- Baseline merge-after CI: `37728983824`, SUCCESS (owner activation record).
- Investigation branch: `research/issue-328-sqlite-lock-root-cause`.
- The baseline was clean before this test-only investigation change.
- At closeout, live `origin/master` is `6f0b850bc457720bf5f58ae36867f32ad34bdb6f`
  after docs-only PR #334. The compared files for this investigation's SQLite,
  Global Index, Settings, watcher, startup, and CI-routing owners are unchanged
  from the required baseline. This branch remains anchored at the required
  baseline; no rebase was performed.

Issue #328 records the following Windows native qualification observations on
2026-10-07 (-07:00):

| Time | Observed Global Index state |
| --- | --- |
| 07:55:32.4049526 | `unavailable`; diagnostic `database error: sqlite error: database is locked` |
| 07:55:33.0597131 | `indexing / NULL`, 654.7605 ms later |
| 07:56:41.4231579 | First repaired `ready / NULL` with refreshed full-index timestamp and journal checkpoint |

The 654.7605 ms value is the interval between two observed state records. It is
not a measured SQLite lock duration. The retained JSONL and audit files are on
the owner's Windows `E:` drive and were not mounted for this investigation. The
poller source, its SQLite flags, its transaction lifetime, and the error's
native/extended code remain unavailable.

## SQLite configuration and ownership

`src-tauri/src/db/connection.rs` owns the product database pool:

- `Database::open` creates an `r2d2` pool with `max_size(8)` and
  `min_idle(Some(1))`; clones share the pool.
- Every pooled connection is initialized with `journal_mode=WAL`,
  `synchronous=NORMAL`, `foreign_keys=ON`, `temp_store=MEMORY`,
  `mmap_size=3,000,000,000`, and `busy_timeout=5 seconds`.
- `Database::conn()` checks out a pooled connection for each operation. There
  is no process-wide mutex serializing all database calls. Independent pooled
  connections can be active at once; SQLite still permits only one writer to
  the database at a time.
- The interactive desktop opens the profile database at
  `%appdata%/zen-canvas.sqlite3` through `database_path` in `src-tauri/src/lib.rs`.
  SQLite manages the associated `-wal` and `-shm` files. The Windows Global
  Index service communicates with the desktop over named-pipe IPC and does not
  open this database in the inspected service implementation. The desktop's
  `DatabaseIndexSink` performs durable Global Index writes.
- Windows MFT enumeration uses a separate temporary staging database with
  `journal_mode=OFF`; it publishes batches/checkpoints through the sink. It is
  not the profile database.
- No production `PRAGMA wal_checkpoint` call was found. SQLite may perform its
  normal automatic checkpoint work; this source inventory does not prove the
  observer's interaction with those checkpoints.

WAL lets readers use committed snapshots while a writer appends to the WAL. It
does not permit two simultaneous writers. A long-lived WAL reader can constrain
checkpoint progress/WAL recycling, but does not ordinarily take the writer
slot. This is exercised by the read-only observer test below.

## Bounded lock-owner map

| Candidate owner or contender | Database/connection and work | Transaction boundary | Expected lifetime and classification | Evidence and assessment |
| --- | --- | --- | --- | --- |
| Global Index startup/recovery | Desktop pool; `global_volumes`, then provider publication into `global_entries` and related managed-AI queue state | Volume state/upsert calls are single autocommit statements; `upsert_global_entries_batch` uses a deferred transaction spanning the batch and commits once | A single statement should be short; batch duration scales with entries and queue work. No production duration is instrumented. Single-writer serialization is architectural; an unnecessarily large batch is unproved. | Real product writer path. The coordinator starts an immediate first cycle on a worker thread. Exact historical statement/holder is unknown. |
| Main startup recovery | Same desktop `Database` pool; recovery/prune work for dedupe, analysis, content, scan state, operation journal, organization plans, rule proposals, and cleanup | Each subsystem's own operation/transaction | Synchronous setup phase; duration depends on durable rows and subsystem work. It finishes before the coordinator starts, so these calls do not overlap that first cycle on the same setup thread. Later background jobs can overlap. | The initial sequence at `main.rs` lines 108-125 is sequential. No timing evidence ties it to the observed native lock. |
| Settings CAS | Same pool; reads and updates `app_settings` (and may bump catalog revision) | Default rusqlite deferred transaction; SELECT then CAS UPDATE then commit | Short read/update/commit transaction by structure; no production timing evidence. Upgrade conflict can return immediately. | Deterministic test returns primary `SQLITE_BUSY` during the write upgrade while another writer holds the slot. Measured 5 ms in the local SQLite build; the configured timeout does not force this upgrade to wait. |
| Watcher-root synchronization | Same pool; `scan_roots`, duplicate groups, analysis findings, dedupe authority and watcher-root transitions | `BEGIN IMMEDIATE` through `TransactionBehavior::Immediate`; one transaction through commit | Holds the writer slot from begin through several reads/writes and loops over roots/findings. Lifetime is data-dependent and unmeasured; this is a broad transaction boundary, but no excessive production duration is proved. | Deterministic test returns `SQLITE_BUSY` at begin after about five seconds under the synthetic held writer. This code runs during startup after Global Index has started, and in Settings reload. |
| Managed AI / scan / automation workers | Same desktop pool; their durable queue/run/revision tables | Subsystem-specific statements and transactions | Lifetime depends on each subsystem's operation; no common duration or lock order was found. | They start at different points during setup or in response to later events. They are plausible competing writers, but no historical trace identifies one. |
| Qualification observer | External process or QA code; exact connection/copy procedure is unknown | Unknown | Unknown. A read-only snapshot can constrain checkpoint progress; no observer transaction duration was retained. | A read-only WAL poller is not shown to hold the writer slot in the same-file test. The exact observer remains unresolved. |
| Windows Global Index service | Named-pipe service/provider path; no product DB open found | No product-database transaction in the service source | No product database writer lifetime in the service process. | Not the profile SQLite lock holder based on inspected source. The desktop owns the DB sink. |

Startup ordering matters: synchronous recovery/prune calls run before the
Global Index coordinator starts at `main.rs` around line 160. The coordinator
then starts its worker and immediately runs a cycle. Setup continues with
settings/autostart synchronization, pruning, `sync_file_library_watcher_roots`
and watcher recovery/reload. This leaves a real overlap window between Global
Index DB writes and later startup DB writes. It establishes a possible overlap,
not the historical lock owner.

The bounded lock graph is:

```text
main-thread recovery/prune work (finishes)
  → Global Index worker starts an immediate cycle and may write global_volumes / global_entries
  ↔ startup continues and may enter sync_file_library_watcher_roots (BEGIN IMMEDIATE)
  → watcher recovery/reload and later scan/automation work

Onboarding Settings save: settings CAS (deferred read → write → commit)
  → root sync (BEGIN IMMEDIATE → scan_roots and related state → commit)
  → watcher reload/reconciliation
```

The double arrow marks a source-supported overlap window, not an observed lock
order or proof that those operations overlapped in the historical run.

## Deterministic reproduction and exact failure class

`src-tauri/src/global_index/lock_contention_tests.rs` uses a unique temporary
database and channel barriers, not sleeps, to hold/release a transaction.
The holder checks out a second connection from the real `Database` pool,
executes `BEGIN IMMEDIATE`, updates the fixture `global_volumes` row and waits
for an explicit release signal. The contender calls production DB/settings
methods on the other pooled connection.

1. **Global Index status write:**
   `Database::update_global_volume_state` issues an autocommit `UPDATE
   global_volumes`. While the fixture holder owns the WAL writer slot, it fails
   with primary and extended result `SQLITE_BUSY` / `5` (not `SQLITE_LOCKED` / `6`)
   after the five-second busy timeout (observed 5,015 ms in the final candidate
   run). A WAL status read still sees the previous committed `indexing` state.
   Releasing the holder lets the same state update succeed and the durable
   status reach `ready`.
2. **Read-only WAL observer:** a separate connection opens with
   `SQLITE_OPEN_READ_ONLY`, `query_only=ON`, starts a read transaction and holds
   a snapshot. The product status write succeeds while the reader is held
   (observed 0 ms). This does not simulate file copying or the unavailable
   historical poller.
3. **#329 correlation:** the real `save_app_settings_cas` call fails with
   primary/extended `SQLITE_BUSY` / `5` during its deferred transaction's
   `app_settings` UPDATE, before the busy timeout elapses (observed 5 ms). This
   is a deferred read-to-write upgrade conflict. The real
   `sync_file_library_watcher_roots` call fails with `SQLITE_BUSY` / `5` at
   `BEGIN IMMEDIATE` after about five seconds (observed 5,008 ms). Once the
   holder releases, CAS and root synchronization both succeed and the root is
   durable.

These tests exercise `SQLITE_BUSY` during DML and `BEGIN IMMEDIATE` only. They
do not reproduce `SQLITE_LOCKED`, checkpoint contention, a schema operation,
or the exact historical native operation. The reported code 5 is the primary
and extended result for this fixture; it does not classify the historical
diagnostic.

The #329 test intentionally separates those boundaries. In production,
`save_settings` performs the CAS before calling `reload_file_watcher_for_settings`;
a CAS failure returns before watcher reload. The test separately calls the
next root-sync DB boundary to classify it. It does not instantiate a Tauri
`AppHandle` or test watcher restart/reconciliation.

The new reproducer was injected as test-only code into a separate worktree at
the exact baseline and passed all 3 cases there as well. The current production
database code already exhibits this ordinary SQLite writer contention; the
investigation tests did not introduce it.

## State mapping and recovery semantics

No generic `SQLITE_BUSY -> unavailable` mapping was found:

- `global_index_status_from_connection` derives `unavailable` when there are
  zero enabled sources or when an enabled source is already durably marked
  unavailable. It derives `error` for a source in the durable error state.
- `run_index_cycle` maps a provider operation error to `error`, unless a
  degraded durable state (including `unavailable`) already exists, in which
  case it preserves that state while recording the operation error. A database
  failure on a direct `?`-propagated read/write exits the cycle before this
  mapping can complete.
- The rusqlite error retains whether the low-level result is `SQLITE_BUSY` or
  `SQLITE_LOCKED`, but the coordinator has no dedicated transient-resource
  branch or database busy retry policy; these failures flow through ordinary
  database/provider error handling.
- `get_global_index_status` propagates a failed DB read as a command error.
  The Settings Global Index controller represents command-load failure as
  `loadState=error`; it does not convert a DB read error into the durable
  `unavailable` status.
- The reproducer shows a failed status write leaving the prior committed state
  (`indexing`) visible. That is the truthful projection for the failed write.

**Recommendation:** keep transient SQLite contention distinct from a genuine
missing/unavailable provider or source. Preserve the last committed truthful
state on `SQLITE_BUSY`. If a future exact trace confirms a transient Global
Index publication failure, the smallest likely repair category is a bounded
retry admitted through the existing event-driven coordinator/wake path, not a
global timeout increase or a polling loop. If native evidence instead finds a
writer transaction routinely occupying the slot for seconds, shorten that
proved transaction first. Neither category is implemented or authorized here.

## Timeout and retry analysis

1. A five-second SQLite busy timeout already exists on every pooled
   connection.
2. The historical 654.7605 ms state-transition gap is not lock duration, so it
   cannot be compared with the timeout. In deterministic tests, an autocommit
   status update and `BEGIN IMMEDIATE` wait about five seconds; a deferred CAS
   write upgrade returns immediately. Historical `SQLITE_BUSY` versus
   `SQLITE_LOCKED`, extended result, operation and wait duration remain unknown.
3. Increasing the timeout could hide an unnecessarily long writer and add
   startup/settings latency; it would not fix a deferred transaction upgrade
   that returns `SQLITE_BUSY` immediately.
4. The tested status write sets one row's state and is safe to retry only after
   confirming the failed statement did not commit and that no newer transition
   superseded it; replaying a stale status can overwrite a newer transition.
   Settings CAS has a revision guard; replaying with a stale revision is
   rejected, and an ambiguous commit requires a reread. Root synchronization
   is a multi-table state transition, so a generic retry loop should not be
   assumed safe without rechecking its boundary and idempotence. Entry-batch
   replay semantics also need operation-level review before adding retry.
5. No general SQLite busy retry exists in the Global Index coordinator. A
   propagated cycle error ends that worker invocation; the thread records its
   error and `running=false`. Provider background admission is not a database
   busy retry policy.
6. Any future retry should be bounded and use existing event-driven admission
   so it does not create a hot loop or reorder durable source-state transitions.

## Qualification observer classification

**Classification: UNRESOLVED.** The issue identifies high-frequency read-only
polling, but the observer's actual SQLite URI/open flags, transaction
duration, connection reuse, and DB/WAL/SHM copy procedure were not available.
The test establishes that a read-only snapshot on the same WAL database does
not block a writer. It does not prove that long reads cannot constrain
checkpoint progress, that the poller used the same mode, or that it did not
copy database files. Sequential copying of a live DB/WAL/SHM set is not an
atomic SQLite snapshot and may produce inconsistent evidence; no inspected
source shows that copying itself takes SQLite's writer lock.

Ordinary product reads and realistic read-only monitoring should be tolerated.
This investigation does not classify the observer as the cause or dismiss the
product defect as a test artifact.

## Validation record

Local execution used the pinned Rust 1.97.1 toolchain in the validation
container. The repository targets Windows and macOS; Linux validation needed a
temporary, uncommitted `keyring` Linux backend entry so Rust could compile the
unconditionally referenced keyring module. The manifest and lockfile workaround
will be removed before commit; it is not part of this change.

| Check | Result |
| --- | --- |
| New contention tests on candidate | 3 passed; plain `SQLITE_BUSY` extended code 5; status update 5,015 ms, CAS 5 ms, root sync 5,008 ms |
| Same tests injected into untouched baseline | 3 passed; same behavior reproduced (5,016 ms / 4 ms / 5,007 ms in that run) |
| `global_index::` candidate suite | 34 passed, 4 failed, 2 ignored; the same four failures and counts reproduced on baseline |
| `db::` candidate suite | 265 passed, 4 failed, 6 ignored; the same four failures and counts reproduced on baseline |
| `watcher::` | 24 passed |
| `settings::` | 10 passed |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS on the final test source |
| `cargo clippy ... --features desktop-runtime --all-targets -- -D warnings` | Linux run fails on four existing unused-variable errors in `src/fs_safety/atomic_move.rs` (lines 1013-1014 and 1240-1241); identical errors reproduced on baseline |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --lib --tests` | Exit 0; 7 existing warnings on the library (including the four unused variables and dead code); no warning originated in the new test module |
| `npm run test:governance` | PASS |
| `npm run test:performance:architecture` | PASS on final report tree; architecture guard and 30 tests passed |
| `npm run test:docs` with `DOCS_DIFF_BASE=7a2e1b31bb4ac49aa8e8d2378fc9adb6bb64034f` | PASS; documentation validation covered the one changed Markdown file, and governance passed |
| Codex Review | Attempted on the current diff; blocked before review by CLI authentication errors (401 token refresh and 451 `no_biscuit_no_service`). No review findings were returned. |
| Repository-routed Windows/macOS CI | Pending exact-head Draft PR |

The four Linux Global Index failures are Managed AI worker timeout/wake tests.
The four Linux DB failures are two provider-settings expectation mismatches, a
dependent fresh-analysis expectation, and `unsupported_platform_linux` in an
organization execution test. The same named tests fail on the baseline in this
environment. The CI target is
the supported Windows/macOS platforms; hosted exact-head results remain
required and will be reported separately.

## Review disposition

The required Codex Review was invoked with the requested lock-order,
transaction-lifetime, race, observer, #328/#329, test-flakiness, and scope
checks. The CLI could not authenticate (`401 Unauthorized`; then `451 no_biscuit_no_service`)
and exited before returning a review. This is an
unavailable review, not a PASS and not a review rejection; there are no Codex
Review findings to classify.

A separate primary-agent self-audit (not a substitute for Codex Review) found
the fixture uses channel barriers and production contender wrappers, while the
writer itself is deliberately synthetic. The report keeps historical lock
owner and observer behavior unresolved and classifies #329 as possible only.
The audit removed a strict sub-timeout assertion from the deferred-CAS case,
allowed the read-only WAL writer the full configured timeout as test headroom,
and changed fixture names to UUID-based uniqueness. No production behavior
change was identified.

## Contract and issue state

- Schema: 37.
- Package: 0.1.40.
- Windows Global Index IPC: v3.
- Issue #328: OPEN.
- Issue #329: OPEN and independently active.
- Issue #330: OPEN and ACTIVE (owner governance/read-only reconciliation).

No issue was closed and no production repair was made.
