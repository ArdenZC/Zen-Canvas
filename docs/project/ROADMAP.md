# Zen Canvas Roadmap

The roadmap records authorized sequencing, not a promise that every item will ship unchanged. Production implementation still requires an active initiative with explicit scope and acceptance gates.

## Completed

### G1 — Engineering OS

Goal: make project state, architecture ownership, technical debt, risk, workflow and closeout rules explicit and durable.

- **G1A — Current Truth and workflow foundation:** complete; merged through PR #57.
- **G1B — Public docs and evidence convergence:** complete; merged through PR #60.

G1 does not change product runtime behavior.

## Current

### M1 — macOS Mutation Correctness Remediation V2

Status: active — high-risk implementation and validation. See
[`initiatives/M1-macos-mutation-correctness-v2.md`](initiatives/M1-macos-mutation-correctness-v2.md)
and ADR-0002.

Goal: close claim rebinding, provider journal/coordination, portable strategy,
copy/move ordering, metadata, capability and adversarial-race correctness gaps
in the existing Apple Silicon macOS mutation implementation while preserving
the existing Operation Preview, journals, Safe Trash and Restore authorities.

M1 is a bounded hardening initiative. It adds no product feature, schema,
second queue/ledger, privileged helper or UI redesign. Its exact-head native
and Windows gates must pass before closeout.

### File Library 2.0 / Preview Platform — W0 Specification

Status: paused during M1 — specification only. See [`initiatives/W0-file-library-preview.md`](initiatives/W0-file-library-preview.md).

Goal: specify the next-generation File Library experience, including the planned managed-library primary entry, Finder/File Explorer-friendly modes, cross-platform preview integration and platform-adaptive behavior, while preserving existing durable query, preview, journal, Safe Trash and restore authorities.

W0 is a specification/architecture-freeze phase. It authorizes research synthesis, product specification, information architecture, architecture contracts, performance/QA budgets and Wave/Track planning only. Production implementation begins only after the specification and acceptance gates are reviewed; W1 is not authorized by this roadmap.

Expected concerns include:

- File Library information architecture and dual familiar/managed browsing modes;
- macOS and Windows platform adaptation;
- Quick Look/preview entry points and lifecycle ownership;
- platform capability contracts;
- migration away from legacy File Library compatibility state;
- performance, accessibility, native-window and package verification.

## Architecture hardening lane

These are not independent product modules. They are executed only when a product initiative naturally reaches the relevant boundary or an explicit hardening initiative is approved.

- split `AppRuntimeProviders` ownership without creating duplicate runtime authorities;
- converge Windows platform boundaries toward the explicit macOS platform-adapter shape where useful;
- reduce oversized Rust domain modules without changing behavior or persistence authority;
- converge Tauri command/permission registries where it can be proven safe;
- reduce browser mock concentration while preserving deterministic mock honesty.

## Technical-debt retirement lane

Retire only when the deletion condition in `TECH_DEBT.md` is satisfied. Priority candidates include:

- legacy File Library compatibility store;
- legacy watcher adapter;
- legacy operation preview callback paths;
- `useOrganizeDecisionStore` compatibility bridge;
- `global_index/legacy_queue.rs`;
- legacy design-token aliases;
- dead Tauri command/permission surface confirmed to have no caller;
- obsolete packaging/build assets after real package verification;
- merged/superseded remote branches after equivalence proof.

## Not authorized by this roadmap

This roadmap does not authorize OCR, RAG/vector database, a generic Agent runtime, shell/MCP/tool execution, Rule AST V2, a second AI queue, a new operation/recovery system, Linux support, Intel macOS support or schema changes.

Any such expansion requires a separate product/architecture decision.
