# Zen Canvas Project Status

Last verified: 2026-08-17

## Current baseline

- Default branch: `master`.
- Latest product/runtime-changing baseline:
  `master@1920c3c254992f90335e7c57df4fab819fd6062b` (PR #81 W1-10 merge; F3 Infrastructure complete).
- W1-10 reviewed production-validation head:
  `1270d19ff3ba4497824e6a12fa3ae0c66aece20a`.
- W1-10 production exact-head CI: run `32019450123`, conclusion `success`.
- W1-10 final docs-only PR head:
  `066ecaf63d9b24b85cc886e4af6bd5396fbe139c`.
- W1-10 final-head CI: run `32020125857`, conclusion `success`.
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

W0 remains the canonical architecture/specification baseline for the File Library /
Preview program. The current product/runtime baseline has advanced through merged
W1 Foundation implementation to PR #81. M1/M1.1 exact-head evidence remains
historical regression evidence and is not overwritten by later documentation-only
commits.

## Delivery-state snapshot

- **Implemented** — M1 macOS mutation correctness remediation and M1.1
  provider/portability closeout are merged; G1 Engineering OS governance is
  complete; W0 File Library 2.0 / Preview architecture is merged; W1 F1-F3
  Foundation implementation through W1-10 Integration Surface is merged.
- **Validated** — M1 production head
  `c802397930ce276de7902ee37d5927083f2912ed` passed its exact Fast/Full runs;
  PR #63 final head passed CI `31913867886`; W0 specification final head passed
  docs/governance CI `31926495395`; W1-10 reviewed production head
  `1270d19ff3ba4497824e6a12fa3ae0c66aece20a` passed exact-head CI
  `32019450123` and final docs-only head passed `32020125857`.
- **Packaged** — M1 Full Validation includes the Apple Silicon unsigned DMG
  path; this does not claim signing or notarization.
- **Released** — none; no published GitHub release or Git tag exists.
- **Current implementation work** — W1-11 Foundation Performance / QA is active
  on Draft PR #82 against `master@1920c3c254992f90335e7c57df4fab819fd6062b`.
  F4 is not complete; W1-12 and W2 have not started.

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

W1-10 PR #81 merged at `1920c3c254992f90335e7c57df4fab819fd6062b`.
The independently reviewed production head
`1270d19ff3ba4497824e6a12fa3ae0c66aece20a` passed exact-head CI
`32019450123`; the final docs-only successor
`066ecaf63d9b24b85cc886e4af6bd5396fbe139c` passed CI `32020125857`.
The accepted integration surface preserves shared Browse/Read Gate/Thumbnail
ownership, Query V2 and managed watcher/mutation authorities, async cancellation,
process-local Browse history and binary Thumbnail IPC. W1-11 now owns the
remaining F4 scale/performance/platform evidence rather than treating W1-10 CI
as proof of those gates.

Known real-fixture gaps remain where no fixture was supplied, including real
iCloud/File Provider, external APFS/exFAT and network-volume scenarios, plus
native visual/accessibility states and signing/notarization. W1-11/W4 retain
these as explicit QA obligations rather than pass claims.

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

Architecture baseline: `master@c4f7f53782c2fd2b1a7ab077879c6a3fc8db11b3` (W0 PR #64 merge).

Current runtime baseline: `master@1920c3c254992f90335e7c57df4fab819fd6062b` (W1-10 PR #81 merge).

Authority:
[`initiatives/W1-file-library-foundation.md`](initiatives/W1-file-library-foundation.md).

F1 Contract Spine, F2 Parallel Core and F3 Infrastructure are complete through
W1-10. PR #81 merged the bounded Integration Surface after independent review;
its reviewed production-validation head is
`1270d19ff3ba4497824e6a12fa3ae0c66aece20a` with successful exact-head CI
`32019450123`.

W1-11 Foundation Performance / QA is now active on Draft PR #82,
`feat/w1-11-foundation-performance-qa`, based on
`master@1920c3c254992f90335e7c57df4fab819fd6062b`. Its taskbook is
[`tasks/W1-11-FOUNDATION-PERFORMANCE-QA-CODEX.md`](tasks/W1-11-FOUNDATION-PERFORMANCE-QA-CODEX.md).
W1-11 must establish F4 evidence for 100k progressive Ephemeral Browse,
cancellation/history/restore correctness, scheduler interference with real
heavy-authority adapters, Read Gate/materialization failure paths, resource and
platform observations, and unchanged existing Query V2 100k/1M performance
gates. F4 remains incomplete until that evidence passes independent review.
W1-12 closeout and W2 Experience are not authorized yet.

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
