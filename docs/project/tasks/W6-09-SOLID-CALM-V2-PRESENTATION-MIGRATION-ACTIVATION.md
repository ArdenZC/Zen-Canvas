# W6-09 Solid / Calm V2 Presentation Migration — Activation

Status: **PREPARED / NOT STARTED**

Track: Issue #241 / PR #242
Branch: `codex/w6-09-native-regression`

This is the next authorized implementation checkpoint after the Solid / Calm Demo V2 freeze. It is **presentation/material migration only**.

## Start gate

Before any production edit:

1. `git fetch origin`;
2. require branch `codex/w6-09-native-regression`;
3. require local HEAD to equal the exact remote HEAD supplied by Owner/ChatGPT for activation;
4. require a clean worktree;
5. run `python docs/design/w6-09/solid-calm-v2/verify-solid-calm-v2.py`;
6. stop fail-closed if either frozen artifact hash differs.

Do not reset/rebase to repair a mismatch.

## Owner functional disposition

Functional / authority baseline is accepted at:

- source `88fc663392371049fda2d71b85bd4815d073bfe0`
- tree `5ca511f055b02bb511bc0873ffc5c2a2d26efadf`

Do not redesign or regress:

- Browse first-entry;
- EphemeralBrowse authority;
- Browse admission/session lifecycle;
- Preview Core;
- Read Gate;
- PDF range transport;
- PDF continuous scroll;
- PDF lazy rendering;
- Markdown rendered-first behavior;
- image blob transport;
- Preview provider ordering;
- pinned source freeze;
- Details lifecycle;
- stale/cancellation behavior.

## Visual authority

Read first:

1. `docs/design/w6-09/SOLID-CALM-V2-FREEZE-MANIFEST.md`;
2. both frozen HTML artifacts under `docs/design/w6-09/solid-calm-v2/`;
3. relevant current production presentation owners/tests symbol-first.

Do not reinterpret or redesign the demo.

V26 remains a structural / information-architecture / unsuperseded-interaction reference only. Liquid Glass material assumptions are revoked.

## Migration requirements

### Material system

Remove production dependency on obsolete Liquid Glass presentation assumptions, including the `--zc-glass-*` family and glass-only presentation primitives.

Replace them with one coherent Solid / Calm semantic surface system using repository-appropriate names equivalent to:

- surface-base
- surface-raised
- surface-overlay
- surface-selected
- border-subtle
- border-strong
- shadow-float
- shadow-menu

Do not append another override block. Consolidate/delete superseded CSS while migrating.

### Navigation / focus

Never express selection, current page, focus or active navigation with a decorative left border/strip/rail.

Use whole-row quiet selected background + typography. Structural dividers remain valid. Do not use decorative glow as focus grammar.

### Settings

- follow Solid / Calm Demo V2;
- use the corrected optically centered gear icon;
- no card-inside-card layout;
- no decorative rail;
- quiet rows/dividers;
- every real capability remains accessible exactly once.

### Quick Preview

- solid raised surface;
- no glass / no backdrop-blur material;
- content-first;
- Details hidden by default;
- retain PDF continuous scrolling;
- retain Markdown rendered reading mode;
- retain same centered pinned surface;
- retain non-modal pinned background interaction;
- centered loading and failed/unsupported states;
- no startup Close-button halo.

### Native Windows chrome

Minimize, maximize and close controls must be geometrically and optically vertically centered.

## Test migration

Remove obsolete presentation tests that require Liquid Glass. Replace them with behavior/semantic assertions covering at least:

- no production `--zc-glass-*` dependency;
- no Quick Preview backdrop-filter material;
- no decorative selected left rail;
- Preview focus contract;
- centered terminal states;
- canonical Settings navigation state;
- corrected Settings icon;
- Solid / Calm surface tokens.

Do not weaken behavioral tests protecting accepted Preview/Browse functionality.

## Boundaries

Do not use this task to modify backend/durable authorities, schema, filesystem permission model, Preview Core or Read Gate contracts, PDF range architecture, Browse admission/session authority, or version/tag/release/publication.

No new PR. No merge. No auto-merge. No Codex Review. W6-10 remains inactive.

## Validation and final evidence

Run focused presentation/component tests for touched surfaces, then applicable frontend/type/build/remediation/performance checks. Re-run the frozen Demo V2 verifier.

After migration is stable, rebuild the exact Windows Tauri candidate and capture a **small final native visual matrix**. Old `88fc6633...` captures remain functional evidence but are historical for final visual parity.

Prioritize: whole-product Solid / Calm shell; Settings; >1 MiB PDF first page + continuous pages 2/3 + a late page; rendered Markdown; pinned Preview with background Files interaction and frozen source; Details closed/open; Image; Loading/Failed; Dark/Compact; titlebar controls; Forced Colors/DPI where feasible.

Real macOS GUI remains UNVERIFIED unless a real host is available.

## Stop condition

Return for Owner/ChatGPT review with exact source/tree, changed files, CSS authority removed/consolidated, tests, current CI and new native evidence status.

Do not merge and do not activate W6-10.
