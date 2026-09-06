# W6 — Product Maturity Audit

Status: **ACTIVE — between Tracks; W6-06 complete, W6-07 pending separate activation**

Owner: Zen Canvas

W6 activation baseline: `master@88ea3693beb60557c8f50777753f16499ea02b70`.

W6-05 accepted result/evidence squash merge / W6-06 activation baseline: `master@507253589c2bbc9924f643ddd38456e2716138dd` (#199).

## Why W6 exists

W5 proved technical release qualification and packaging readiness, but release-engineering readiness is not the same as product maturity. W6 turns the decision not to publish yet into evidence-backed simplification, UX review, reconstruction and quality work rather than another feature wave.

Governing rule:

> **CI GREEN is not a product-maturity claim.**

Public `v0.1.40` publication remains **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED / DO NOT PUBLISH**.

## Completed W6 work

### W6-01 — Product Maturity Audit

**COMPLETE.** Result: [`../tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md`](../tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md).

### W6-02 — First Value & Recovery Maturity

**COMPLETE / MERGED.**

### W6-03 — Product Hierarchy & Progressive Disclosure

**COMPLETE / MERGED.**

### W6-04 — File Library Calm-Surface Review / Bounded Remediation

**COMPLETE / CLOSED.** The bounded production remediation preserved Query V2/filter/Saved View/Library/Browse/Preview/filesystem authority while closing the observed Filter popover P2 with focused native evidence.

### W6-05 — Whole-Product Native Experience Audit

**COMPLETE / CLOSED.** Accepted result/evidence squash merge: `master@507253589c2bbc9924f643ddd38456e2716138dd` (#199).

Final product outcome: **DEGRADED**.

Final matrix:

- `PASS`: 45;
- `FAIL`: 6;
- `DEGRADED`: 7;
- `UNVERIFIED`: 22;
- total: 80.

Final severity: `P0=0 / P1=0 / P2=5 / P3=0`.

The five consolidated P2 findings remain:

- Cleanup valid Windows extended-path rejection before candidate review;
- image / CSV / JSON / folder Quick Preview generic unavailable states;
- Global Index source unavailable in the isolated audit run;
- Organization Plan suggestion / authoritative safe-preview loading degraded;
- Browse root-status / first-scan recovery friction.

W6-05 remains the accepted whole-product native evidence baseline until W6-09.

### W6-06 — Zen Visual System & UX Redesign

**COMPLETE / CLOSED — V26 TARGET DESIGN FROZEN.**

Activation baseline: `master@507253589c2bbc9924f643ddd38456e2716138dd`.

Purpose was to convert W6-05 real-product evidence into one coherent Zen Canvas visual and interaction language before broad reconstruction.

Working rule:

> **Preserve the engine; design the cockpit before rebuilding it.**

Final owner decision:

> **W6-06 TARGET DESIGN FREEZE: PASS — 93.4 / 100**

Retained freeze threshold: **92 / 100**.

Final authority:

- [`../tasks/W6-06-FINAL-DESIGN-FREEZE-AUDIT.md`](../tasks/W6-06-FINAL-DESIGN-FREEZE-AUDIT.md)
- [`../tasks/W6-06-DESIGN-FREEZE-CLOSEOUT-RESULT.md`](../tasks/W6-06-DESIGN-FREEZE-CLOSEOUT-RESULT.md)
- [`../../design/w6-06/07-V26-FREEZE-MANIFEST.md`](../../design/w6-06/07-V26-FREEZE-MANIFEST.md)
- [`../../design/w6-06/07-W6-07-IMPLEMENTATION-HANDOFF.md`](../../design/w6-06/07-W6-07-IMPLEMENTATION-HANDOFF.md)

Frozen owner decisions include:

- one global **Files** entry, with Library / Browse Folder internal modes;
- centered Search + Commands anchor;
- Selection ≠ Focus ≠ Primary;
- no underline / bottom-bar / rail / glow focus grammar;
- `Space` = Quick Preview;
- related-but-not-identical selection anatomy;
- truthful loading/degraded/unavailable/permission/partial-failure/safety states;
- Windows and macOS share Zen language while retaining platform-appropriate chrome;
- preserve existing Query, Preview Core, Restore, Dry Run, Safe Trash and AI-consent authorities;
- do not create another Preview architecture.

W6-06 changed no production `src/` / `src-tauri/` implementation. Its browser/prototype evidence is design acceptance only and does not upgrade W6-05 native evidence states.

## Current W6 state

W6 remains **ACTIVE**, but there is currently **no active implementation Track**.

W6-06 is closed. W6-07 is the next planned Track but remains **INACTIVE** until a separate activation governance change merges.

Completion of W6-06 must not be interpreted as implicit production authorization.

## Planned W6-07 — Core Experience Reconstruction

**INACTIVE — separate activation required.**

Purpose: reconstruct/polish the presentation layer while preserving durable backend, filesystem, Query, Preview, restore and provider authorities.

Working rule:

> **Preserve the engine; rebuild the cockpit.**

Frozen implementation order:

1. tokens / typography / shared primitives / native shell;
2. Files workspace;
3. Inspector + Search + Command Palette;
4. Settings;
5. Organize + Cleanup;
6. Overview + History + Automation;
7. cross-surface consolidation.

W6-07 must preserve:

- Library/Browse authority separation;
- Query/selection scaling and stale-snapshot behavior;
- Preview Core cancellation/fallback/materialization boundaries;
- Organization Plan review → safe preview → Dry Run → execution gates;
- Cleanup Analysis/Finding → Preview → Safe Trash;
- Restore/recovery authority and History ledger boundaries;
- Global Search ordering/no-source/IME semantics;
- local-first/no-upload privacy posture;
- AI local/cloud/provider consent and credential boundaries;
- exact-SHA CI/release qualification and performance gates.

A separate W6-07 activation document must define the first bounded implementation slice. The activation itself should remain governance-only rather than mixing approval with production changes.

## Later planned maturity sequence

### W6-08 — Cross-Platform Quick Preview Experience

Improve the existing first-party Preview experience using existing `ZenFloatingQuickPreview` / Preview Core seams. Explorer Preview Handler remains supplementary shell integration rather than the flagship Zen preview experience.

### W6-09 — Whole-Product Native Regression

Run coherent real-product regression after redesign/reconstruction rather than native verification after every small presentation PR.

### W6-10 — Release Re-entry

Only after product-owner maturity acceptance: freeze a fresh exact candidate, run release qualification/installer evidence, perform supported-platform release-path native acceptance, and make a new publication decision.

## Validation policy

- browser/prototype evidence must not be inferred as native GUI acceptance;
- W6-05 remains the native evidence baseline until W6-09;
- normal presentation work may use Code + Browser evidence unless specifically native/rendering-dependent;
- stage-level native QA is preferred over repetitive full native acceptance after every small PR;
- release-path evidence remains deferred to W6-10.

## Product maturity boundaries

W6 work must not solve maturity through updater infrastructure, OCR/RAG/plugin/agent breadth, another Preview engine, another AI feature, new durable authorities, weaker filesystem safety, or weaker AI consent/credential gates.

## Review policy

W6 work must not use Codex Review as merge authority. Review/merge decisions use direct diff inspection, repository governance checks and CI evidence unless the product owner explicitly changes this rule.
