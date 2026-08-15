# Zen Canvas Project Status

Last verified: 2026-08-15

## Current baseline

- Default branch: `master`.
- Last product/runtime-changing baseline: `master@fb953cadfc3f7c4a376ad6918f23bb53c949b774`.
- G1 completed merge baseline: `master@ffdd71d19a97ffbea6cc5e1340f9201417d85ac5` (PR #60).
- Latest full production-validation head: `d99bbdb594556ffbd194fe92871c600000b61a91`.
- Later focused maintenance validation:
  - C0B-1 documentation/root hygiene CI run `31865245650`.
  - C0B-2 retired-helper removal CI run `31865373969`.
- Package version: `0.1.40`.
- Database schema: `34`.
- Published GitHub release: none.
- Published Git tag: none.

The G1 closeout is documentation/governance-only. It records the state created by the merged G1A/G1B work and therefore does not need to self-reference its own future squash-merge SHA as a product/runtime baseline. The C0B-1 and C0B-2 runs are focused maintenance evidence and do not replace or extend the latest full production-validation evidence recorded for `d99bbdb`.

## Delivery-state snapshot

- **Implemented** — current product/runtime code includes the focused C0B-2 cleanup at `master@fb953cadfc3f7c4a376ad6918f23bb53c949b774`; the G1 Engineering OS governance layer is complete through PR #60 at `master@ffdd71d19a97ffbea6cc5e1340f9201417d85ac5`.
- **Validated** — production head `d99bbdb594556ffbd194fe92871c600000b61a91` passed the exact validation runs listed below; later maintenance/documentation changes carry their own narrower evidence.
- **Packaged** — the Full Validation evidence below includes the Apple Silicon unsigned DMG packaging path; this does not claim signing or notarization.
- **Released** — none; no published GitHub release or Git tag exists.

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

Exact production head `d99bbdb594556ffbd194fe92871c600000b61a91` passed:

- Fast CI run `31843452631`.
- Full Validation run `31843459483`.

The validated matrix included Apple Silicon Rust tests and Clippy, native mutation/recovery coverage, macOS release compile and unsigned DMG packaging, Windows quality/release compile, dependency audit and configured performance shards.

Known evidence still outside that validation includes broader real provider/external/network-volume fixtures, broader adversarial race coverage, native visual/accessibility states, and signing/notarization.

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

## Current initiative

**File Library 2.0 / Preview Platform — W0 Specification**

Status: active — specification only.

W0 authorizes only:

- research synthesis;
- product specification and information architecture;
- architecture contracts and performance/QA budgets;
- Wave/Track planning.

W0 does not authorize production implementation, schema or dependency changes, CI changes, runtime-authority changes or W1 work. The bounded initiative record is [`initiatives/W0-file-library-preview.md`](initiatives/W0-file-library-preview.md).

## Open governance priorities

- Keep `STATUS.md` as the only current project-stage/baseline/release-state source.
- Retire compatibility paths by exit condition, not by age or filename.
- Close branches after merge/content-equivalence verification.
- Keep one durable authority per product domain.
- Keep validation evidence bound to exact commits.

## Status update rule

Every initiative that changes production behavior must update this file before its final merge. At minimum record the applicable product/runtime baseline, validation evidence, initiative state, schema/package changes and any new release state. A documentation-only closeout records the merge it is closing and must not create an infinite self-reference requirement by trying to predict its own future squash-merge SHA.
