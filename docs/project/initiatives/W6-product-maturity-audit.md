# W6 — Product Maturity Audit

Status: **ACTIVE — implementation; W6-10A COMPLETE / CLOSED / MERGED; RC1 FROZEN / ACCEPTED FOR RELEASE QUALIFICATION; W6-10B WINDOWS RELEASE QUALIFICATION ACTIVE; W6-10C ELIGIBLE / NOT ACTIVE; PUBLICATION DEFERRED**

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

**COMPLETE through PR #240 — Issue #239.** The existing first-party Preview
experience was improved using the existing `ZenFloatingQuickPreview` /
Preview Core seams. Its repository/browser presentation gap is closed and the
typed/folder residual is explicitly **ACCEPTED DEFER** for exact-head native
verification in W6-09. Browser PASS != Native PASS.

### W6-09 Visual Authority Amendment — Solid / Calm Demo V2

**OWNER-APPROVED CURRENT VISUAL AUTHORITY (2026-09-21).**

The earlier Liquid Glass material direction is revoked. The checksum-bound [Solid / Calm Demo V2 freeze](../../design/w6-09/SOLID-CALM-V2-FREEZE-MANIFEST.md) is canonical for material, surfaces, borders, shadows, selected navigation state, Settings, Quick Preview, spacing refinements, icons and shell polish.

V26 remains authoritative for structure, navigation hierarchy, information architecture and interaction contracts not superseded by later Owner decisions. The accepted production functional baseline `88fc663392371049fda2d71b85bd4815d073bfe0` / tree `5ca511f055b02bb511bc0873ffc5c2a2d26efadf` must not regress during presentation migration.

The Windows evidence captured at that baseline remains valid functional/native regression evidence but is historical for final visual parity. The final Solid / Calm Windows exact-head evidence has now been captured and accepted by Owner. Full supported-platform native PASS is not claimed; real macOS GUI, Forced Colors, additional DPI/Retina and release-path/release-binary acceptance are accepted residuals for W6-10.

### W6-09 — Whole-Product Native Regression

**COMPLETE / CLOSED — OWNER WINDOWS NATIVE PRODUCT ACCEPTANCE PASS; SOLID / CALM WINDOWS VISUAL ACCEPTANCE PASS; FULL SUPPORTED-PLATFORM NATIVE PASS NOT CLAIMED.**

- Issue #241 is **CLOSED / completed** and PR #242 is **squash-merged** to `master@164608f90b8233303fefcf9660822daea0ecb857`; the W6-09 track is closed at the accepted-evidence boundary.
- Accepted production functional baseline: `88fc663392371049fda2d71b85bd4815d073bfe0`; tree `5ca511f055b02bb511bc0873ffc5c2a2d26efadf`.
- First-entry Browse admission/session truth and accepted Quick Preview functional architecture are frozen against presentation-only migration.
- Windows native functional evidence was captured from the legal product route and is accepted for functionality.
- Production-head hosted CI 35608830144 is **SUCCESS**.
- Presentation production source `8fd246476e025636d4606a44d23688865ab89cc2` / tree `475a8d0e0295abbe37b3afa115738fa3602785e7` is pushed to PR #242; fresh hosted CI 35685110417 is **SUCCESS**.
- Visual authority is now Solid / Calm Demo V2; Liquid Glass material is revoked.
- Exact-head Windows Solid / Calm visual acceptance is **PASS** and retained at `F:\CargoTarget\w6-09-solid-calm-owner-review-00787888\windows\`; the evidence package SHA-256 is `43236C3E82ACF409261436E598EBE191EA048715CCCB2832C84795C705F0BEF8` and remains bound to the production source above.
- Final closeout authority: [`W6-09-WHOLE-PRODUCT-NATIVE-REGRESSION-CLOSEOUT-RESULT.md`](../tasks/W6-09-WHOLE-PRODUCT-NATIVE-REGRESSION-CLOSEOUT-RESULT.md).
- Windows DPI/scaling, Forced Colors, real macOS GUI/Retina, release-path/release-binary acceptance, Narrator/VoiceOver, native Reduced Motion and remaining lifecycle/mutation residuals are explicitly accepted for W6-10. Full supported-platform native PASS is **NOT CLAIMED**.
- Merge-after hosted CI [35697239225](https://github.com/ArdenZC/Zen-Canvas/actions/runs/35697239225) is **SUCCESS** on `master@164608f90b8233303fefcf9660822daea0ecb857`.
- W6-10A is **COMPLETE / CLOSED** with RC1 frozen; W6-10B/C remain **ELIGIBLE / NOT ACTIVE**, W6-10D/E/F remain dependency-gated, and publication remains deferred.

### W6-10 — Release Re-entry

**ACTIVE — implementation through W6-10A Release Candidate Freeze only; W6-10A COMPLETE / CLOSED.**

Qualification authority:

- [W6-10 Release Re-entry Qualification Matrix](../tasks/W6-10-RELEASE-REENTRY-QUALIFICATION-MATRIX.md)
- [W6-10 Release Re-entry Preflight](../tasks/W6-10-RELEASE-REENTRY-PREFLIGHT.md)
- [W6-10A Release Candidate Freeze Activation](../tasks/W6-10A-RELEASE-CANDIDATE-FREEZE-ACTIVATION.md)
- [Issue #245 — W6-10A Release Candidate Freeze](https://github.com/ArdenZC/Zen-Canvas/issues/245) — **CLOSED / completed**
- [PR #246 — W6-10A Release Candidate Freeze](https://github.com/ArdenZC/Zen-Canvas/pull/246) — **MERGED**

RC1 is **FROZEN / ACCEPTED FOR RELEASE QUALIFICATION** at source `9c8cdee792f8a2b5078c22c517d8648899440b0c` / tree `3ec2158bb56ce0a734b2c894793f5fe60b8b3296`, candidate version `0.1.40`. Full Validation run `35702434460` and Release Build run `35704683429` are **SUCCESS**. Issue #245 is **CLOSED**, PR #246 is **MERGED** to `master@07bb2ea546ea4469b8aa143f22f47b0da66a3286`, and merge-after CI `35709481851` is **SUCCESS**. The `v0.1.40` tag and GitHub Release remain absent. The workflow-dispatch helper branch `rc/w6-10-0.1.40-rc1` points to the immutable RC1 source and was not moved.

W6-10A has frozen automated exact-SHA release evidence and is **COMPLETE / CLOSED / MERGED**. W6-10B Windows Release Qualification is now **ACTIVE** through [Issue #248](https://github.com/ArdenZC/Zen-Canvas/issues/248) and its activation record. W6-10C macOS manual qualification remains **ELIGIBLE / NOT ACTIVE**; W6-10D/E/F and publication remain dependency-gated / deferred and are not active.

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
