# ZB-01 — Database Resident Footprint Result

Date: 2026-09-24

## Baseline and branch

- Required baseline: `6e8c04d2773f52e8b9bcd1ba5d5226b49e477798`.
- Branch: `perf/zb-01-database-resident-footprint`.
- Final HEAD for validated production and tests: `936f000f606ae0cdd8eb522e888cdf5ed6c48b48`.
- The result record is a documentation-only successor to the validated code commit; no production code changed after validation.

## Changed files

- `src-tauri/src/db/connection.rs`
- `docs/project/tasks/ZB-01-DATABASE-RESIDENT-FOOTPRINT-RESULT.md`

## Before and after configuration

Confirmed the locked `r2d2` version is 0.8.10. In this version, `min_idle = None` uses `max_size` as the minimum pool population, and pool construction waits for that initial population.

Before:

```rust
Pool::builder()
    .max_size(8)
    .build(manager)?
```

Effective configuration: `max_size = 8`, `min_idle = None`, effective initial/minimum pool population `= 8`.

After:

```rust
Pool::builder()
    .max_size(8)
    .min_idle(Some(1))
    .build(manager)?
```

Effective configuration: `max_size = 8`, `min_idle = Some(1)`. Interactive work can start from the smaller idle pool and the pool can still grow on demand up to eight connections.

## Pool-state evidence

Baseline instrumentation against the required baseline observed:

```text
connections=8, idle_connections=8, max_size=8, min_idle=None
```

The two deterministic pool tests on validated commit `936f000f606ae0cdd8eb522e888cdf5ed6c48b48` observed:

```text
after Database::open and migrations: connections=2, idle_connections=2, max_size=8, min_idle=Some(1)
with three leases held:              connections=3, idle_connections=0, max_size=8, min_idle=Some(1)
after returning those leases:         connections=4, idle_connections=4
```

The post-open observation can include a second idle connection because the migration checkout temporarily uses the first connection while `r2d2` maintains the configured minimum. The tests assert the configured minimum, allow the observed one-or-two connection post-open state, verify three simultaneous leases, and run a successful query after returning leases.

## Tests and validation

All commands below ran against the validated production/test commit unless otherwise stated.

- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — passed.
- `cargo test --manifest-path src-tauri/Cargo.toml db::connection::pool_tests:: -- --nocapture` — 2 passed; pool states above recorded.
- `cargo test --manifest-path src-tauri/Cargo.toml db::` — 229 passed, 6 ignored.
- `cargo test --manifest-path src-tauri/Cargo.toml` — 955 passed, 23 ignored; all integration and doc-test targets completed successfully.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` — passed.
- `npm run verify:rust` — passed; desktop-runtime library tests 956 passed, 23 ignored; integration tests and clippy passed.
- `npm run test:performance:architecture` — passed; 3 files and 28 tests.
- `npm run verify:security` — exited successfully. It reported 2 moderate npm advisories involving `vitest`/`@vitest/mocker` and 8 allowed Rust audit warnings. No dependency or lockfile was changed.
- `npm run test:performance:extended` — passed all extended suites on the validated commit (Search, Scan/Schema, Library/Content, Intelligence, Workspace Foundation, Preview Platform; total reported runtime 243.174 s).
- Windows native filesystem hardening smoke required by the current Rust CI routing — passed. The isolated fixture used F: and D:, exercised cross-volume behavior, preserved its canary hash, reported `real_app_data_accessed=false`, and reported `fixture_cleaned=true`.

The first extended-profile attempt flagged monotonic settled PrivateUsage growth in the Workspace Foundation resource test. The isolated retry passed, and the complete extended profile then passed on the validated commit with `hard_resource_growth=false` and `private_committed_sustained_growth=false`. No threshold or unrelated performance logic was changed.

The extended profile also emitted a `TARGET MISSED` observation for managed-scan foreground latency (`foreground_wait_ms=136`, pressure first-page p95 `=283 µs` versus idle p95 `=133 µs`). Its bounded-pressure correctness test and the full profile exited successfully; this observation was not modified as part of ZB-01.

## Windows process evidence

**INCONCLUSIVE / NOT ATTRIBUTABLE.** No same-process before/after measurement of the native application was made. The performance harness's PrivateUsage observations belong to its own test process and cannot be attributed to the application pool change or used to claim an application memory reduction.

## Scope confirmations

- Schema changes: **NONE**.
- Query semantic changes: **NONE**.
- PRAGMA changes: **NONE**.
- Dependency changes: **NONE**.
- Authority changes: **NONE**.
- `STATUS.md` / `ROADMAP.md` changes: **NONE**.
- ZB-02 started: **NO**.

## Disposition

**READY FOR OWNER REVIEW**

The local gates and Windows filesystem smoke applicable to this host passed. Hosted macOS validation was not run on this Windows host and is not claimed here; no release, publication, merge, or Ready PR action was taken.
