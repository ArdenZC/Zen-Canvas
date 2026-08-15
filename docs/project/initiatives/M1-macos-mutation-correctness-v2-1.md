# M1.1 — macOS Mutation Correctness V2.1 / Provider and Portability Closeout

Status: delivery through PR #63; exact-head remote evidence and the protected
merge are the remaining closeout gates.

## Delivery record

- Starting remote SHA: `7b1dac7`.
- Base: `master`.
- Head: `fix/macos-provider-portability-closeout`.
- Original implementation commits: `e9d75ba`, `17cb2c9`.
- PR: #63, `fix(macos): close provider and portability correctness gaps`.
- The PR does not modify, close, disable or bypass the `Protect master`
  ruleset.

The closeout covers Provider capability/materialization, portable source
retirement, Organization edited-target execution, coordinated race handling,
copy-performance routing, and their native/contract regression gates. The
final production SHA is the post-merge protected `origin/master` SHA; the
original implementation commits must not be reported as that final SHA when
squash or rebase changes commit identity.

Local Windows validation passed for the final implementation path, including
Rust format, focused Rule Proposal tests, full Rust tests (`629 passed; 0
failed; 9 ignored`), and the applicable frontend/security/build checks listed
in the PR. The Windows host does not provide Apple Silicon native proof.

Real iCloud, File Provider, external APFS, exFAT and network-volume fixtures
are **NOT VERIFIED — fixture unavailable** when absent. Contract tests report
fixture absence as `SKIPPED — REAL FIXTURE NOT PROVIDED`; this is not converted
into a pass claim.

## Objective

Close the V2.1 audit gaps without creating a second filesystem authority:
operation-aware Safe Trash coordination, conservative generic File Provider
identity, explicit materialization UX, portable source retirement, expanded
native race coverage, bounded copy performance and honest capability/evidence
reporting.

## In scope

- Rust macOS strategy, provider, identity, copy and source-claim adapters;
- Operation Preview, materialization command, progress/cancellation and
  History recovery UI;
- Tauri command permission synchronization;
- Apple Silicon race, Safe Trash/Restore, provider-feasibility and performance
  contract tests;
- current-truth, security, ADR and native-completion evidence updates.

## Out of scope

- schema 35 or a new operation/cleanup/restore authority;
- generic File Provider identity API implementation without a native bridge;
- passive downloads or background content materialization;
- product support for Intel/Rosetta/Universal/Linux;
- signing, notarization or physical SSD secure erase.

## Required evidence boundary

Windows-local checks validate shared Rust and renderer behavior only. Apple
Silicon compile, Clippy, native smoke, the 10k/100k race gates and the full
performance profile must be bound to the exact pushed production-code SHA.
The optional fixture variables are:

`ZEN_CANVAS_ICLOUD_FIXTURE`, `ZEN_CANVAS_FILE_PROVIDER_FIXTURE`,
`ZEN_CANVAS_EXTERNAL_APFS_FIXTURE`, `ZEN_CANVAS_EXFAT_FIXTURE`, and
`ZEN_CANVAS_NETWORK_VOLUME_FIXTURE`.

An absent fixture is reported exactly as `SKIPPED — REAL FIXTURE NOT
PROVIDED`; it is never converted into a pass claim.
