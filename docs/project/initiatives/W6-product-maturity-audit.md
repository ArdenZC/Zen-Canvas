# W6 — Product Maturity Audit

Status: **ACTIVE — implementation; W6-08 Cross-Platform Quick Preview Experience**

Owner: Zen Canvas

W6 activation baseline: `master@88ea3693beb60557c8f50777753f16499ea02b70`.

W6-05 accepted result/evidence squash merge / W6-06 activation baseline: `master@507253589c2bbc9924f643ddd38456e2716138dd` (#199).

W6-06 final freeze squash merge / W6-07 activation baseline: `master@6b435dbf49c609a95a4d95935090825f003e7a5d` (#206).

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

Final matrix: `PASS 45 / FAIL 6 / DEGRADED 7 / UNVERIFIED 22 / total 80`.

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

Final owner decision:

> **W6-06 TARGET DESIGN FREEZE: PASS — 93.4 / 100**

Retained freeze threshold: **92 / 100**.

Final authority:

- [`../tasks/W6-06-FINAL-DESIGN-FREEZE-AUDIT.md`](../tasks/W6-06-FINAL-DESIGN-FREEZE-AUDIT.md)
- [`../tasks/W6-06-DESIGN-FREEZE-CLOSEOUT-RESULT.md`](../tasks/W6-06-DESIGN-FREEZE-CLOSEOUT-RESULT.md)
- [`../../design/w6-06/07-V26-FREEZE-MANIFEST.md`](../../design/w6-06/07-V26-FREEZE-MANIFEST.md)
- [`../../design/w6-06/07-W6-07-IMPLEMENTATION-HANDOFF.md`](../../design/w6-06/07-W6-07-IMPLEMENTATION-HANDOFF.md)

W6-06 changed no production implementation. Its browser/prototype evidence remains design acceptance only.

## Completed Track — W6-07 Core Experience Reconstruction

**COMPLETE / CLOSED through PR #238.**

Authority: [`../tasks/W6-07-CORE-EXPERIENCE-RECONSTRUCTION-ACTIVATION.md`](../tasks/W6-07-CORE-EXPERIENCE-RECONSTRUCTION-ACTIVATION.md).

Merge baseline: `master@60d43db7de7f9ac598d0262a237a330ed91530d2`;
tree `d70b52caa51ef1a60ebd016345a8f85e7455df81`.

Working rule:

> **Preserve the engine; rebuild the cockpit.**

W6-07 must reconstruct the real product toward the checksum-bound V26 presentation target while preserving durable backend, filesystem, Query, Preview, restore, safety and provider authorities.

Fresh implementation checkouts must verify V26 before side-by-side review:

```bash
python docs/design/w6-06/07-v26/rebuild-v26.py --verify-only
```

### Frozen implementation order

1. tokens / typography / shared primitives / native shell;
2. Files workspace;
3. Inspector + Search + Command Palette;
4. Settings;
5. Organize + Cleanup;
6. Overview + History + Automation;
7. cross-surface consolidation.

### First bounded implementation slice

The first reviewable implementation is intentionally narrower than the whole Track:

- production semantic tokens / typography / density roles;
- minimal shared primitives needed by shell and Files;
- native-shell scaffolding only where required for presentation integration;
- exactly one global Files destination with Library/Browse internal modes;
- bounded real Files list/search/selection/Inspector behavior using existing authorities;
- proportional browser/code/interaction evidence and focused native evidence only where a claim depends on native behavior.

Do not absorb Settings, Organize, Cleanup, History, Automation or broad Preview-format expansion into the first production PR merely for completeness.

### Durable authorities W6-07 must preserve

- Library/Browse authority separation;
- Query/selection scaling and stale-snapshot behavior;
- large-library virtualization/performance contracts;
- Preview Core cancellation/fallback/materialization boundaries;
- Organization Plan review → safe preview → Dry Run → execution gates;
- Cleanup Analysis/Finding → Preview → Safe Trash;
- Restore/recovery authority and History ledger boundaries;
- Global Search ordering/no-source/IME semantics;
- local-first/no-upload privacy posture;
- AI local/cloud/provider consent and credential boundaries;
- exact-SHA CI/release qualification and performance gates.

`src/` presentation changes are authorized. `src-tauri/` changes are authorized only for presentation/native-shell integration where needed. Database/schema migrations, new durable backend authority, mutation-safety ownership changes, provider ownership changes and a second Preview architecture remain outside this activation.

## Later planned maturity sequence

### W6-08 — Cross-Platform Quick Preview Experience

**ACTIVE — Issue #239.** Improve the existing first-party Preview experience using existing `ZenFloatingQuickPreview` / Preview Core seams. Preserve the existing Preview authority and close or explicitly disposition the Preview-specific W6-05 residual before W6-09.

### W6-09 — Whole-Product Native Regression

**NEXT after W6-08 and the residual-disposition gate.** Run coherent real-product regression after redesign/reconstruction rather than native verification after every small presentation PR.

### W6-10 — Release Re-entry

**INACTIVE.** Only after product-owner maturity acceptance: freeze a fresh exact candidate, run release qualification/installer evidence, perform supported-platform release-path native acceptance, and make a new publication decision.

## Validation policy

- browser evidence must not be inferred as native GUI acceptance;
- W6-05 remains the native evidence baseline until W6-09;
- normal presentation work uses proportional code/browser/interaction evidence;
- native/rendering-specific claims require focused real-host validation;
- stage-level native QA is preferred over repetitive full native acceptance after every small PR;
- release-path evidence remains deferred to W6-10.

## Product maturity boundaries

W6 work must not solve maturity through updater infrastructure, OCR/RAG/plugin/agent breadth, another Preview engine, another AI feature, new durable authorities, weaker filesystem safety, or weaker AI consent/credential gates.

## Review policy

W6 work must not use Codex Review as merge authority. Review/merge decisions use direct diff inspection, repository governance checks and CI evidence unless the product owner explicitly changes this rule.
