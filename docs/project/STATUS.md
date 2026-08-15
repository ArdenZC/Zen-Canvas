# Zen Canvas Project Status

Last verified: 2026-08-15

## Current baseline

- Default branch: `master`.
- Current implementation/repository baseline: `master@fb953cadfc3f7c4a376ad6918f23bb53c949b774`.
- Original G1 draft baseline: `master@0805ff54a17ccaf0aa88bc171e8ff00ee83c6c7d`.
- Latest full production-validation head: `d99bbdb594556ffbd194fe92871c600000b61a91`.
- Later focused maintenance validation:
  - C0B-1 documentation/root hygiene CI run `31865245650`.
  - C0B-2 retired-helper removal CI run `31865373969`.
- Package version: `0.1.40`.
- Database schema: `34`.
- Published GitHub release: none.
- Published Git tag: none.

The C0B-1 and C0B-2 runs are focused maintenance evidence for the current repository baseline. They do not replace or extend the latest full production-validation evidence recorded for `d99bbdb`.

## Delivery-state snapshot

- **Implemented** — the current product/runtime and repository baseline is represented by `master@fb953cadfc3f7c4a376ad6918f23bb53c949b774`; the G1A documentation layer is implemented in review on PR #57.
- **Validated** — production head `d99bbdb594556ffbd194fe92871c600000b61a91` passed the exact validation runs listed below.
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

## Current initiative

**G1 — Engineering OS installation**

G1A implementation and review fixes are complete and ready for merge in PR #57.

Goals:

- install `docs/project/` as the unique current-truth layer;
- remove changing project-stage/baseline ownership from agent instruction files;
- define initiative, branch, validation, merge and closeout lifecycle;
- index current architecture debt and risks without rewriting production code.

No product code, schema, dependency, CI threshold or runtime authority change is authorized by G1A.

## Next authorized sub-stage

**G1B — Public docs and evidence convergence**

G1B has not started. Its scope remains documentation/governance only:

- converge public README and scattered completion evidence onto the new current-truth index without deleting historical evidence;
- mark old V4.3/current-stage metadata as historical or evidence-only where needed;
- reconcile root-level archived/startup guidance that can still mislead new contributors.

Later roadmap work remains File Library 2.0 / Preview Platform W0, followed by technical-debt retirements only when their explicit deletion conditions are satisfied.

## Open governance priorities

- Keep `STATUS.md` as the only current project-stage/baseline/release-state source.
- Retire compatibility paths by exit condition, not by age or filename.
- Close branches after merge/content-equivalence verification.
- Keep one durable authority per product domain.
- Keep validation evidence bound to exact commits.

## Status update rule

Every initiative that changes production behavior must update this file before its final merge. At minimum record the new baseline, validation evidence, initiative state, schema/package changes and any new release state.
