# Zen Canvas Project Status

Last verified: 2026-08-16

## Current baseline

- Default branch: `master`.
- Last product/runtime-changing baseline: `master@c802397930ce276de7902ee37d5927083f2912ed`.
- G1 completed merge baseline: `master@ffdd71d19a97ffbea6cc5e1340f9201417d85ac5` (PR #60).
- Latest exact-head M1 production-validation head: `c802397930ce276de7902ee37d5927083f2912ed`.
- M1 correctness-remediation starting baseline: `master@d814ebbc2f623fe6719e0a54028c5c4183243902`.
- Exact-head Fast CI: run `31878915359`.
- Exact-head Full Validation: run `31878365268`.
- M1.1 Provider/Portability V2.1 closeout delivery: PR #63, starting remote
  SHA `7b1dac7`, branch `fix/macos-provider-portability-closeout`.
- M1.1 original implementation commits: `e9d75ba` and `17cb2c9`; the PR also
  contains the follow-up native race/test-accounting, apply-performance,
  provider-bridge, materialization, portable-retirement, and copy-proof
  corrections required by exact-head validation.
- Later focused maintenance validation:
  - C0B-1 documentation/root hygiene CI run `31865245650`.
  - C0B-2 retired-helper removal CI run `31865373969`.
- Package version: `0.1.40`.
- Database schema: `34`.
- Published GitHub release: none.
- Published Git tag: none.

The G1 closeout is documentation/governance-only. It records the state created by the merged G1A/G1B work and therefore does not need to self-reference its own future squash-merge SHA as a product/runtime baseline. The C0B-1 and C0B-2 runs are focused maintenance evidence; M1 production validation is recorded separately against its exact production head below.

## Delivery-state snapshot

- **Implemented** — M1 macOS mutation correctness remediation is present at `master@c802397930ce276de7902ee37d5927083f2912ed`; the G1 Engineering OS governance layer is complete through PR #60 at `master@ffdd71d19a97ffbea6cc5e1340f9201417d85ac5`.
- **Validated** — production head `c802397930ce276de7902ee37d5927083f2912ed` passed the exact Fast and Full validation runs listed below; later documentation-only closeout changes do not change that production evidence.
- **Packaged** — the Full Validation evidence below includes the Apple Silicon unsigned DMG packaging path; this does not claim signing or notarization.
- **Released** — none; no published GitHub release or Git tag exists.
- **M1.1 delivery** — Provider, materialization, portable-retirement,
  Organization, race, copy-performance, coordinator-contract, and async
  Quick Look closeout is under PR #63. The protected merge has not yet
  established the merged production SHA; native evidence must remain bound to
  the final PR head, not to the older merged M1 baseline above.

## Supported product platforms

- Windows.
- macOS 13 or later on Apple Silicon (`aarch64-apple-darwin`).

Intel Macs, Universal binaries, Rosetta and Linux are not product targets. Platform detail and mutation guarantees live in `docs/security/SUPPORTED_PLATFORMS.md` and the related security contracts.

## Completed major programs

- Architecture Remediation V1 through Task 08 and schema 34.
- Post-V1 verification maintenance.
- UI/UX V4.3 product-integration program.
- Apple Silicon macOS native mutation/lifecycle/Quick Look parity baseline.

These programs are historical completion records. Their taskbooks and execution documents remain evidence but are not the current project-stage authority.

## Latest validated production evidence

Exact M1 production head `c802397930ce276de7902ee37d5927083f2912ed` passed:

- Fast CI run `31878915359`.
- Full Validation run `31878365268`.

The validated matrix included Apple Silicon Rust tests and Clippy, the 100,000-iteration macOS race gate, native mutation/recovery and path/temp policy coverage, macOS release compile and unsigned DMG packaging, Windows quality/release compile and native smoke, dependency audit, frontend checks and configured performance shards.

Known evidence still outside that validation includes real iCloud/File Provider/external/network-volume fixtures, the named 100 GB and 100k-entry mutation benchmarks, native visual/accessibility states, and signing/notarization.

## Completed initiative

**G1 — Engineering OS installation — complete**

G1A and G1B are both merged and complete:

- G1A — Current Truth and workflow foundation: PR #57, merge commit `c21e5ea9a84da74ac821560ac71a1af17ac26d5c`.
- G1B — Public docs and evidence convergence: PR #60, merge commit `ffdd71d19a97ffbea6cc5e1340f9201417d85ac5`.
- Source branches `chore/engineering-os-g1` and `chore/engineering-os-g1b` were deleted locally and remotely after merge.

Goals:

- install `docs/project/` as the unique current-truth layer;
- remove changing project-stage/baseline ownership from agent instruction files;
- define initiative, branch, validation, merge and closeout lifecycle;
- index current architecture debt and risks without rewriting production code.

G1 changed no product code, schema, dependency, CI threshold or runtime authority.

**M1 — macOS Mutation Correctness Remediation V2 — complete**

- Production implementation and exact-head validation completed at
  `master@c802397930ce276de7902ee37d5927083f2912ed`.
- Exact-head Fast CI run: `31878915359`.
- Exact-head Full Validation run: `31878365268`.
- The later documentation/governance closeout does not change the production
  head to which native evidence is bound.

## M1.1 delivery closeout

**M1.1 — macOS Mutation Correctness V2.1 / Provider and Portability Closeout**

Status: delivery through PR #63. The PR is base `master`, head
`fix/macos-provider-portability-closeout`, Ready for review and non-Draft.
Required checks and the high-risk Full Validation must be green on the final
PR head before merge. No Protect master ruleset change is in scope.

The PR implementation now uses the ABI-correct public File Provider item/domain
bridge, explicit user-confirmed materialization with bounded post-read proof,
operation-aware coordinator contracts, read-only Preview capability
observation, execution-time portable retirement probes with bounded
mount-aware cache invalidation, strict destructive namespace identity checks,
and staged/committed copy identity plus content verification. If a portable
source retirement cannot be proven, the target-first result remains
`source_cleanup_pending` with the source preserved for existing recovery.
Real iCloud, File Provider, external APFS, exFAT and network-volume fixtures
remain **NOT VERIFIED — fixture unavailable** when unavailable; a skipped
fixture is not a pass claim.

Windows-local checks cover shared Rust and renderer behavior only. Apple
Silicon native tests, Clippy, race gates, native performance, and Full
Validation must be tied to the exact final PR head. Real iCloud, File
Provider, external APFS, exFAT and network-volume fixtures are
**NOT VERIFIED — fixture unavailable** when absent; a skipped fixture is not a
pass claim.

## Current initiative

**File Library 2.0 / Preview Platform — W0 Specification**

Status: active — specification only.

W0 is the current product-design initiative after the completed M1 hardening.
Its canonical W-1 research input is
[`OPEN_SOURCE_SYNTHESIS.md`](research/file-library-preview/OPEN_SOURCE_SYNTHESIS.md).

W0 authorizes only research synthesis, product specification, information
architecture, architecture contracts, performance/QA budgets and Wave/Track
planning. It does not authorize production implementation, schema/dependency
changes, CI changes, runtime-authority changes or W1 work.

The bounded initiative record is
[`initiatives/W0-file-library-preview.md`](initiatives/W0-file-library-preview.md).

## Open governance priorities

- Keep `STATUS.md` as the only current project-stage/baseline/release-state source.
- Retire compatibility paths by exit condition, not by age or filename.
- Close branches after merge/content-equivalence verification.
- Keep one durable authority per product domain.
- Keep validation evidence bound to exact commits.
- Keep M1 evidence bound to its exact production head; any later production-code
  change requires a new applicable native validation run.

## Status update rule

Every initiative that changes production behavior must update this file before its final merge. At minimum record the applicable product/runtime baseline, validation evidence, initiative state, schema/package changes and any new release state. A documentation-only closeout records the merge it is closing and must not create an infinite self-reference requirement by trying to predict its own future squash-merge SHA.
