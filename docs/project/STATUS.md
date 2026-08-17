# Zen Canvas Project Status

Last verified: 2026-08-16

## Current baseline

- Default branch: `master`.
- Last product/runtime-changing baseline: `master@e09447dbf2da46e1b02e6da03bcb3345966f160b` (PR #63 merge).
- W0 File Library / Preview specification baseline:
  `master@c4f7f53782c2fd2b1a7ab077879c6a3fc8db11b3` (PR #64 squash merge).
- G1 completed merge baseline: `master@ffdd71d19a97ffbea6cc5e1340f9201417d85ac5` (PR #60).
- Latest exact-head M1 production-validation head: `c802397930ce276de7902ee37d5927083f2912ed`.
- M1 correctness-remediation starting baseline: `master@d814ebbc2f623fe6719e0a54028c5c4183243902`.
- M1 exact-head Fast CI: run `31878915359`.
- M1 exact-head Full Validation: run `31878365268`.
- M1.1 Provider/Portability V2.1 closeout: PR #63, merged as
  `e09447dbf2da46e1b02e6da03bcb3345966f160b` on 2026-08-16.
- Final PR #63 head: `c1892b8baa70852902363d1c8b8d4b57ac54b627`.
- Final PR-head CI evidence: run `31913867886`, conclusion `success`.
- W0 specification final PR head:
  `a52a81ec02129c517211a6a868d23d7e5d76af02`.
- W0 specification final CI: run `31926495395`, conclusion `success`.
- Package version: `0.1.40`.
- Database schema: `34`.
- Published GitHub release: none.
- Published Git tag: none.

The W0 merge is documentation/specification-only and therefore does not replace
PR #63 as the latest product/runtime-changing baseline. W1 implementation starts
from the W0 architecture baseline while preserving exact-head production evidence
for M1/M1.1.

## Delivery-state snapshot

- **Implemented** — M1 macOS mutation correctness remediation and M1.1
  provider/portability closeout are merged; G1 Engineering OS governance is
  complete; W0 File Library 2.0 / Preview architecture is merged.
- **Validated** — M1 production head
  `c802397930ce276de7902ee37d5927083f2912ed` passed its exact Fast/Full runs;
  PR #63 final head passed CI `31913867886`; W0 specification final head passed
  docs/governance CI `31926495395`.
- **Packaged** — M1 Full Validation includes the Apple Silicon unsigned DMG
  path; this does not claim signing or notarization.
- **Released** — none; no published GitHub release or Git tag exists.
- **Current implementation work** — W1 Foundation is active against the merged
  W0 specification baseline and is bounded to contracts, Ephemeral Browse,
  Location, scheduling, Preview lifecycle, Materialization/Read Gate, Thumbnail,
  change invalidation, integration and Foundation QA.

## Supported product platforms

- Windows.
- macOS 13 or later on Apple Silicon (`aarch64-apple-darwin`).

Intel Macs, Universal binaries, Rosetta and Linux are not product targets.
Platform detail and mutation guarantees live in
`docs/security/SUPPORTED_PLATFORMS.md` and the related security contracts.

## Completed major programs

- Architecture Remediation V1 through Task 08 and schema 34.
- Post-V1 verification maintenance.
- UI/UX V4.3 product-integration program.
- Apple Silicon macOS native mutation/lifecycle/Quick Look parity baseline.
- M1.1 provider/materialization/portability correctness closeout through PR #63.
- W0 File Library 2.0 / Preview Platform specification through PR #64.

These programs are historical completion records. Their taskbooks and execution
documents remain evidence but are not the current project-stage authority.

## Latest validated production evidence

Exact M1 production head `c802397930ce276de7902ee37d5927083f2912ed`
passed:

- Fast CI run `31878915359`.
- Full Validation run `31878365268`.

The validated matrix included Apple Silicon Rust tests and Clippy, the
100,000-iteration macOS race gate, native mutation/recovery and path/temp policy
coverage, macOS release compile and unsigned DMG packaging, Windows
quality/release compile and native smoke, dependency audit, frontend checks and
configured performance shards.

PR #63 later merged provider/portability closeout at
`e09447dbf2da46e1b02e6da03bcb3345966f160b`. Its final PR head
`c1892b8baa70852902363d1c8b8d4b57ac54b627` has successful CI run
`31913867886`; unavailable real fixtures remain skipped/unverified rather than
pass claims.

W0 PR #64 merged at `c4f7f53782c2fd2b1a7ab077879c6a3fc8db11b3`.
Its final head `a52a81ec02129c517211a6a868d23d7e5d76af02` passed CI
`31926495395`, including project governance, documentation checks and
`git diff --check`; production/performance/package jobs were correctly skipped.

Known real-fixture gaps remain where no fixture was supplied, including real
iCloud/File Provider, external APFS/exFAT and network-volume scenarios, plus
native visual/accessibility states and signing/notarization. W1/W4 retain these
as QA obligations rather than pass claims.

## Completed initiatives

### G1 — Engineering OS installation — complete

- G1A: PR #57, merge `c21e5ea9a84da74ac821560ac71a1af17ac26d5c`.
- G1B: PR #60, merge `ffdd71d19a97ffbea6cc5e1340f9201417d85ac5`.

### M1 — macOS Mutation Correctness Remediation V2 — complete

- Production/validation head: `c802397930ce276de7902ee37d5927083f2912ed`.
- Fast CI: `31878915359`.
- Full Validation: `31878365268`.

### M1.1 — Provider and Portability Closeout — complete

- PR #63 merge: `e09447dbf2da46e1b02e6da03bcb3345966f160b`.
- Final head: `c1892b8baa70852902363d1c8b8d4b57ac54b627`.
- Final CI: `31913867886`.

### File Library 2.0 / Preview Platform — W0 Specification — complete

- PR #64 squash merge: `c4f7f53782c2fd2b1a7ab077879c6a3fc8db11b3`.
- Final PR head: `a52a81ec02129c517211a6a868d23d7e5d76af02`.
- Final CI: `31926495395`, success.
- Canonical architecture begins at
  [`specs/file-library-preview/00-MASTER-SPEC.md`](specs/file-library-preview/00-MASTER-SPEC.md).
- Closeout record:
  [`initiatives/W0-file-library-preview.md`](initiatives/W0-file-library-preview.md).

## Current initiative

**File Library 2.0 / Preview Platform — W1 Foundation**

Status: active — implementation.

Baseline: `master@c4f7f53782c2fd2b1a7ab077879c6a3fc8db11b3` (W0 PR #64 merge).

Authority:
[`initiatives/W1-file-library-foundation.md`](initiatives/W1-file-library-foundation.md).

W1 implements the merged W0 contracts only. F1 starts with W1-00 governance
activation and W1-01 Contract Spine. After F1, Navigation, Ephemeral Browse,
Location, Scheduler and Preview Contract tracks may proceed in parallel according
to the merged W1 dependency plan.

W1-10 Integration Surface is implemented on Draft PR #81 at
`feat/w1-10-integration-surface` from the taskbook baseline
`master@172e09dff51f1e9fe5367d5e886d263848c4031c`. The bounded surface composes
the existing BrowseService, W1-07 Read Gate, W1-08 ThumbnailService,
W1-09 change monitor, W1 Preview lifecycle and the global WorkScheduler. It
adds no schema, durable authority, Query V3, managed watcher, byte-read or
filesystem-mutation path. PR #81 remains Draft pending exact-head CI and
independent architecture/maintainability review; W1-11 has not started.

W1 does not authorize the polished W2 Library/Browse UI, W3 rich Preview
providers, W4 Finder/Explorer integration, Query V3, managed-watcher rewrite,
second content-read engine, new mutation/recovery path, third-party Preview
plugins, AI/OCR/RAG/Agent/MCP expansion, Intel macOS or Linux support.

## Open governance priorities

- Keep `STATUS.md` as the only current project-stage/baseline/release-state
  source.
- Keep one durable authority per product domain.
- Keep validation evidence bound to exact commits.
- Preserve PR #63 provider/materialization/capability semantics.
- Preserve Query V2, watcher/reconciliation, content-read and mutation/recovery
  authorities during W1.
- Treat W1 integration hotspots as single-owner/shared surfaces and prefer
  bounded modules over broad cross-cutting rewrites.
- Stop/escalate any Track that discovers a need for schema change, new durable
  authority, CI performance-threshold change or filesystem-safety rewrite.

## Status update rule

Every initiative that changes production behavior must update this file before
its final merge. At minimum record the applicable product/runtime baseline,
validation evidence, initiative state, schema/package changes and any new
release state. A documentation-only closeout records the merge it is closing
and must not create an infinite self-reference requirement by trying to predict
its own future squash-merge SHA.
