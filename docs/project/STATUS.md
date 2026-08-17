# Zen Canvas Project Status

Last verified: 2026-08-18

## Current baseline

- Default branch: `master`.
- Latest product/runtime-changing baseline:
  `master@b4001d7c5d09686b15f74125a828b61b0e913b7f` (PR #82 W1-11 squash merge).
- W1 closeout/governance baseline:
  `master@ecde9f146e1e4e4933f6294358fe4a6523c7c0bd` (PR #83 W1-12 squash merge).
- Post-closeout governance hardening baseline:
  `master@84fc784c2e1a3058fb7a18fa778c0b632e0b5fed` (PR #84).
- W1-11 final independently reviewed production head:
  `70b45d787dd6b2fb9c0f7ad14c0d36e03fea22bb`.
- W1-11 exact-head Full Validation: run `32064210757` / #678, conclusion `success`.
- W1-12 merge-push governance CI: run `32068976837` / #686, conclusion `success`.
- W0 File Library / Preview specification baseline:
  `master@c4f7f53782c2fd2b1a7ab077879c6a3fc8db11b3` (PR #64 squash merge).
- Package version: `0.1.40`.
- Database schema: `34`.
- Published GitHub release: none.
- Published Git tag: none.

PR #83 merged the W1-12 documentation/governance closeout. That closeout baseline
does not supersede the runtime baseline above. The File Library 2.0 / Preview
Platform **W1 Foundation** is complete; the overall File Library 2.0 / Preview
Platform product is not complete. W2 Experience, W3 Preview Platform, W4 Native
Integration and W5 Release remain separate future Waves requiring their own
authorization.

## Delivery-state snapshot

- **Implemented** — File Library 2.0 / Preview Platform W1 Foundation F1-F4 is
  complete through W1-11 runtime/performance work and W1-12 current-truth closeout.
- **Validated** — W1-11 reviewed production head
  `70b45d787dd6b2fb9c0f7ad14c0d36e03fea22bb` passed exact-head Full Validation
  `32064210757`; existing Query V2 100k/1M thresholds remained unchanged and
  green, and Workspace Foundation scale/resource evidence ran on Windows and
  Apple Silicon macOS.
- **Packaged** — repository validation includes supported-platform package/build
  paths where applicable; this does not claim signing, notarization or release.
- **Released** — none; no published GitHub release or tag exists.
- **Current implementation work** — none. The repository is between product
  initiatives. W2 is planned but is **not active or authorized** until a separate
  reviewed W2 initiative is created.

## Supported product platforms

- Windows.
- macOS 13 or later on Apple Silicon (`aarch64-apple-darwin`).

Intel Macs, Universal binaries, Rosetta and Linux are not product targets.
Platform detail and mutation guarantees live in
`docs/security/SUPPORTED_PLATFORMS.md` and the related security contracts.

## Completed major programs

- Architecture Remediation V1 through Task 08 and schema 34.
- UI/UX V4.3 product-integration program.
- Apple Silicon macOS native mutation/lifecycle/Quick Look parity baseline.
- M1.1 provider/materialization/portability correctness closeout through PR #63.
- W0 File Library 2.0 / Preview Platform specification through PR #64.
- W1 File Library 2.0 / Preview Platform Foundation through W1-12 closeout.

These are completion records for their bounded scopes, not claims that later
File Library / Preview product Waves or release work are complete.

## W1 Foundation closeout evidence

### Merge ledger

| Track | PR | master merge/squash commit |
| --- | ---: | --- |
| W1-00 Foundation activation | #65 | `3f6f8a72cbca78812ee257431bfa89a8e357f30f` |
| W1-01 Contract Spine | #66 | `3f30f12fea23961e03b4021d0ffa63c80377167b` |
| W1-02 Workspace Navigation | #67 | `68b74580a22fa8853b886185734c5b19478ce52a` |
| W1-03 Ephemeral Browse Core | #68 | `fc97dc17de098efe9d4e9ce1f29698a9e91659ca` |
| W1-04 Location Core | #69 | `0e9a73e886bffaeb660789b06dc80a74f3eb67aa` |
| W1-05 WorkScheduler | #70 | `2955bb67e3e90eef09aa69cd6b0278a8e1245b99` |
| W1-06 Preview Contract Core | #71 | `b6a2608f84c40c9609ad9ec014bb6196fbfb559c` |
| W1-07 Materialization / Read Gate | #73 | `bce4c0f5792ee9cb18b0475351de3303fa73639e` |
| W1-08 Thumbnail Infrastructure | #75 | `172e09dff51f1e9fe5367d5e886d263848c4031c` |
| W1-09 Ephemeral Change / Refresh | #74 | `272093150ffeceef044a0036954a3bfe274f3717` |
| W1-10 Integration Surface | #81 | `1920c3c254992f90335e7c57df4fab819fd6062b` |
| W1-11 Foundation Performance / QA | #82 | `b4001d7c5d09686b15f74125a828b61b0e913b7f` |
| W1-12 Foundation Closeout / Current Truth | #83 | `ecde9f146e1e4e4933f6294358fe4a6523c7c0bd` |

W1-12 records closeout/current truth only and therefore does not create a new
product/runtime baseline. Its merge commit is the durable W1 closeout/governance
record.

### Final W1-11 HARD evidence

- Real progressive 100k Ephemeral Browse completed on Windows and local Apple
  Silicon macOS filesystem fixtures.
- Per-session caps remain `100,000 EntryRefs / 16,384 PathRefs`; process aggregate
  caps remain `200,000 EntryRefs / 32,768 PathRefs`; capacity fails closed and
  teardown returns registries to zero.
- Real `100,002`-entry managed-scan Scheduler pressure exercised
  `scanner::run_managed_session` through `ManagedScanResourceLeaseAdapter`.
- Windows hard leak detection uses `PROCESS_MEMORY_COUNTERS_EX::PrivateUsage`;
  working-set RSS is diagnostic after trim, and an intentional-retention self-test
  proved the hard detector catches sustained committed-memory growth.
- Apple Silicon macOS Workspace Foundation scale/resource evidence included RSS,
  FD and registry steady-state measurements.
- Existing Query V2 100k/1M performance thresholds were not lowered and remained
  green.
- No final W1-11 `BLOCKED` result remained.

### Known performance TARGET MISSED

The W0 scheduler interference 2x-idle comparison is a **TARGET**, not a HARD
correctness gate. W1-11 preserved these misses rather than weakening the target:

- Windows: idle first-page p95 `166 us`, pressure `382 us` (~`2.30x`) —
  **TARGET MISSED**.
- Apple Silicon macOS: idle `54 us`, pressure `226 us` (~`4.19x`) —
  **TARGET MISSED**.

Scheduler HARD gates still passed: foreground work remained bounded/not
indefinitely blocked, a real heavy authority and Scheduler lease adapter were
exercised, Background work eventually progressed, cancellation released leases,
and scheduler/runtime state returned to zero. The target miss remains a future
optimization/measurement item.

### Explicitly UNVERIFIED after W1

W1 does not claim fixture evidence that was not supplied or exercised. The
following remain **UNVERIFIED** where applicable:

- real iCloud and generic File Provider fixtures;
- external APFS and exFAT fixtures;
- SMB/network-volume fixtures;
- OneDrive/removable-drive scenarios without a real exercised fixture;
- true product-level Tauri IPC cancellation/UI interaction beyond the tested
  runtime/command boundary;
- native Quick Look user-visible lifecycle/visual QA not actually exercised;
- W2 UI/accessibility/980x680/focus/keyboard/DPI product QA;
- W3 rich Preview provider/UI matrices;
- signing, notarization and release publication.

Compile success, ordinary local filesystem tests, mocks or capability projection
must not be substituted for these missing fixture claims.

## Preserved authorities

W1 completed without replacing the repository's existing durable authorities:

- File Library Query V2 / `LibrarySelectionV1` for managed-library truth;
- Global Index for system-wide search;
- managed scan-root/watcher revisions and reconciliation;
- authoritative content eligibility/open/revalidation adapted by W1-07 Read Gate;
- filesystem-safety identity/backend revalidation;
- Operation Preview, operation journals, Safe Trash, cleanup and Restore;
- PR #63 provider/materialization/capability semantics.

W1 introduced no Query V3, second managed watcher, second content-read authority,
second mutation/recovery path or new durable job/session database.

## Current initiative

**No active initiative**

Status: between initiatives — no active product/specification initiative

W1 Foundation is closed by its documentation/governance closeout. W2 Experience
is the next planned Wave, but planning in the Roadmap is not authorization. A
separate reviewed W2 initiative must be created before W2 product work starts.

## Open governance priorities

- Keep `STATUS.md` as the only current project-stage/baseline/release-state source.
- Keep one durable authority per product domain.
- Keep validation evidence bound to exact commits.
- Preserve Query V2, watcher/reconciliation, content-read and mutation/recovery
  authorities in future Waves unless a separately reviewed architecture decision
  explicitly changes them.
- Carry the Scheduler 2x-idle target miss forward without silently weakening or
  reclassifying it.
- Keep provider/network/external-volume fixture gaps explicit until real evidence
  exists.
- Continue repository maintainability and test-artifact hygiene rules.

## Status update rule

Every initiative that changes production behavior must update this file before
its final merge. At minimum record the applicable product/runtime baseline,
validation evidence, initiative state, schema/package changes and release state.
A documentation-only closeout records the merge it is closing once that merge is
known; it does not replace the product/runtime baseline.
