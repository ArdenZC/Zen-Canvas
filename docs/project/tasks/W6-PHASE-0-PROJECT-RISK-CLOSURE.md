# W6 Phase 0 — Project Risk Closure

Status: **READY FOR REVIEW — bounded governance/security PR; no publication performed**

Issue: [#227](https://github.com/ArdenZC/Zen-Canvas/issues/227)

This record covers the three project-level P1 findings authorized by Issue
#227. It is a bounded Phase 0 closure input for review, not a new technical
debt cleanup Track and not a replacement for `STATUS.md` or `ROADMAP.md`.

## Exact source

| Fact | Value |
| --- | --- |
| Baseline commit | `3da21ad1e6815cd839ba4e95d8a14254ce5ad661` |
| Baseline tree | `aef9b67fd6cf4737a17d1f2347f3a3578d2452ca` |
| Result branch | `codex/w6-phase0-project-risk-closure` |
| Product runtime changed | **No** |
| Publication performed | **No** |

The final PR HEAD/tree and exact-hosted-CI evidence are recorded in the PR
description after the last commit.

## Track A — release least privilege

| Workflow scope | Before | After |
| --- | --- | --- |
| Workflow default | `contents: write` | `contents: read` |
| `release-qualified-validation` | Explicit `actions: read`, `contents: read` | Unchanged, explicit read-only |
| `build` matrix | Inherited top-level `contents: write` | Explicit `contents: read` |
| `release` publication job | Inherited top-level `contents: write` | Explicit `contents: write`; only write-capable job |

| Checkout | Before | After |
| --- | --- | --- |
| Qualification checkout | `persist-credentials` omitted | `persist-credentials: false` |
| Build checkout | `persist-credentials` omitted | `persist-credentials: false` |
| Publication checkout | `persist-credentials` omitted | `persist-credentials: false` |

Installer build, NSIS/DMG verification, SBOM generation, checksum creation,
artifact transfer and exact-SHA qualification logic remain in place.

## Track B — W6 publication deferral

| Control | Before | After |
| --- | --- | --- |
| Automatic trigger | `push.tags: ["v*"]` | No tag-push trigger; `workflow_dispatch` remains |
| Publication job entry | Any tag-triggered run | Manual dispatch on a tag only |
| W6 guard | None | `W6_RELEASE_PUBLICATION_ENABLED: "false"`; first publication step fails closed unless a reviewed future re-entry changes the disabled state |
| Qualification/build | Exact-SHA validation and platform packaging | Preserved for manual installer/evidence runs |

Therefore a plain `git tag v... && git push origin v...` does not start this
workflow and cannot publish a GitHub Release. No tag, release, installer
publication, signing or notarization was performed by this task.

## Track C — current-truth reconciliation

- `RISK_REGISTER.md` now records release privilege/publication control as
  hardened by #227, retains the five W6-05 residual areas, records the native
  evidence freshness gap after W6-07, and treats the accepted TD-001-P3 scope
  contract as controlled OPEN work rather than an endless W6 gate.
- `PRODUCT_MAP.md` now has one top-level `Files` workspace with internal
  `Library` and `Browse Folder` modes. Managed Library Query V2 and Ephemeral
  Browse remain separate authorities; Global Search, Files local search,
  Content Quick Preview and Operation Preview remain distinct.
- `ROADMAP.md` keeps W6-07 as the product mainline and adds a pre-W6-09
  Residual Product Defect Closure Gate with explicit owner dispositions:
  `CLOSED / FIXED`, `NOT REPRODUCIBLE WITH EVIDENCE`,
  `ENVIRONMENT-SPECIFIC`, `ACCEPTED DEFER` or `OWNER-ACCEPTED RESIDUAL`.
- `STATUS.md` was not changed because its current W6-07, W6-05 baseline,
  version, schema and publication statements remain accurate.

## Hard-boundary proof

No files under `src/` or `src-tauri/` changed. Query V2, Preview,
filesystem mutation/recovery, AI/provider, schema, version, signing and
publication behavior were not expanded or replaced. The only workflow write
permission belongs to the final publication job, and that job is fail-closed
for the current W6 deferral.

## Validation record

The final PR description records the exact HEAD/tree, static workflow tests,
docs/governance tests, release qualification helper tests, routed CI results,
and the explicit **publication performed: No / product runtime changed: No**
claims.
