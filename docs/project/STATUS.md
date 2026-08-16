# Zen Canvas Project Status

Last verified: 2026-08-16

## Current baseline

- Default branch: `master`.
- Last product/runtime-changing baseline: `master@e09447dbf2da46e1b02e6da03bcb3345966f160b` (PR #63 merge).
- G1 completed merge baseline: `master@ffdd71d19a97ffbea6cc5e1340f9201417d85ac5` (PR #60).
- Latest exact-head M1 production-validation head: `c802397930ce276de7902ee37d5927083f2912ed`.
- M1 correctness-remediation starting baseline: `master@d814ebbc2f623fe6719e0a54028c5c4183243902`.
- M1 exact-head Fast CI: run `31878915359`.
- M1 exact-head Full Validation: run `31878365268`.
- M1.1 Provider/Portability V2.1 closeout: PR #63, merged as
  `e09447dbf2da46e1b02e6da03bcb3345966f160b` on 2026-08-16.
- Final PR #63 head: `c1892b8baa70852902363d1c8b8d4b57ac54b627`.
- Final PR-head CI evidence: run `31913867886`, conclusion `success`.
- Later focused maintenance validation:
  - C0B-1 documentation/root hygiene CI run `31865245650`.
  - C0B-2 retired-helper removal CI run `31865373969`.
- Package version: `0.1.40`.
- Database schema: `34`.
- Published GitHub release: none.
- Published Git tag: none.

The G1 closeout is documentation/governance-only. M1 evidence remains bound to
its exact validated production head. PR #63 is now the later merged
product/runtime baseline; its final review/CI evidence does not retroactively
change the exact-head M1 validation record.

## Delivery-state snapshot

- **Implemented** — M1 macOS mutation correctness remediation and the M1.1
  provider/portability closeout are merged; G1 Engineering OS governance is
  complete through PR #60.
- **Validated** — M1 production head
  `c802397930ce276de7902ee37d5927083f2912ed` passed the exact Fast and Full
  validation runs listed below. PR #63 final head passed its recorded CI and
  protected merge review/evidence boundary before merge.
- **Packaged** — the M1 Full Validation evidence includes the Apple Silicon
  unsigned DMG packaging path; this does not claim signing or notarization.
- **Released** — none; no published GitHub release or Git tag exists.
- **Current product-design work** — File Library 2.0 / Preview Platform W0 is
  review-ready specification work only and does not authorize W1 production
  implementation.

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

PR #63 later merged the provider/portability closeout at
`e09447dbf2da46e1b02e6da03bcb3345966f160b`. Its final PR head
`c1892b8baa70852902363d1c8b8d4b57ac54b627` has successful CI run
`31913867886`; the PR also records its focused local/native evidence and the
requirement that unavailable real fixtures are reported as skipped/unverified,
not as passes.

Known real-fixture gaps remain where no fixture was supplied, including real
iCloud/File Provider, external APFS/exFAT and network-volume scenarios, plus
native visual/accessibility states and signing/notarization. W0 retains these as
future QA obligations rather than converting them into pass claims.

## Completed initiatives

### G1 — Engineering OS installation — complete

G1A and G1B are both merged and complete:

- G1A — Current Truth and workflow foundation: PR #57, merge commit
  `c21e5ea9a84da74ac821560ac71a1af17ac26d5c`.
- G1B — Public docs and evidence convergence: PR #60, merge commit
  `ffdd71d19a97ffbea6cc5e1340f9201417d85ac5`.
- Source branches `chore/engineering-os-g1` and `chore/engineering-os-g1b`
  were deleted locally and remotely after merge.

G1 changed no product code, schema, dependency, CI threshold or runtime
authority.

### M1 — macOS Mutation Correctness Remediation V2 — complete

- Production implementation and exact-head validation completed at
  `master@c802397930ce276de7902ee37d5927083f2912ed`.
- Exact-head Fast CI run: `31878915359`.
- Exact-head Full Validation run: `31878365268`.

### M1.1 — macOS Mutation Correctness V2.1 / Provider and Portability Closeout — complete

- PR #63 merged on 2026-08-16 as
  `master@e09447dbf2da46e1b02e6da03bcb3345966f160b`.
- Final PR head: `c1892b8baa70852902363d1c8b8d4b57ac54b627`.
- Final PR-head CI: run `31913867886`, success.
- Generic third-party File Provider paths remain routing hints rather than
  item/domain identity.
- Materialization remains explicit and consent-bound; passive scan, ordinary
  read, preview or thumbnail does not receive universal permission to download
  provider content.
- Runtime/provider/operation capability is layered and fail-closed rather than
  inferred merely from macOS platform presence.
- Portable retirement, source/target identity checks, target-first recovery,
  Safe Trash/Restore identity decoding and structural directory copy/hardlink
  preservation remain in the existing mutation/recovery authority.
- Real iCloud/File Provider/external/network fixtures are still unverified when
  unavailable; skipped fixtures are not pass claims.

## Current initiative

### File Library 2.0 / Preview Platform — W0 Specification

Status: review-ready — specification only.

BR0 has been reconciled against the current product/runtime baseline
`master@e09447dbf2da46e1b02e6da03bcb3345966f160b` after PR #63 merge.

The canonical W-1 research input remains
[`OPEN_SOURCE_SYNTHESIS.md`](research/file-library-preview/OPEN_SOURCE_SYNTHESIS.md).
The review-ready architecture set begins at
[`specs/file-library-preview/00-MASTER-SPEC.md`](specs/file-library-preview/00-MASTER-SPEC.md)
and is governed by
[`initiatives/W0-file-library-preview.md`](initiatives/W0-file-library-preview.md).

W0 authorizes only product specification, information architecture, architecture
contracts, performance/QA budgets and Wave/Track planning. It does not authorize
production implementation, schema/dependency changes, CI-threshold changes,
runtime-authority changes or W1 work.

The W1 Foundation plan contained in the W0 review set is sequencing only. W1
requires a separately authorized implementation initiative after the W0
specification PR is reviewed and merged.

## Open governance priorities

- Keep `STATUS.md` as the only current project-stage/baseline/release-state
  source.
- Retire compatibility paths by exit condition, not by age or filename.
- Close branches after merge/content-equivalence verification.
- Keep one durable authority per product domain.
- Keep validation evidence bound to exact commits.
- Preserve PR #63 provider/materialization/capability semantics in all later W1
  work rather than rebuilding them from pathname/platform assumptions.
- Preserve existing Query V2, watcher/reconciliation and mutation/recovery
  authorities during File Library 2.0 work.

## Status update rule

Every initiative that changes production behavior must update this file before
its final merge. At minimum record the applicable product/runtime baseline,
validation evidence, initiative state, schema/package changes and any new
release state. A documentation-only closeout records the merge it is closing
and must not create an infinite self-reference requirement by trying to predict
its own future squash-merge SHA.
