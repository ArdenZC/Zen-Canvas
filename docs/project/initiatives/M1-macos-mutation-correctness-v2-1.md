# M1.1 — macOS Mutation Correctness V2.1 / Provider and Portability Closeout

Status: complete pending exact-head remote evidence and final current-truth
closeout.

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
