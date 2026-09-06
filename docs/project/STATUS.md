# Zen Canvas Project Status

Last verified: 2026-09-07

## Current execution truth

- Default branch: `master`.
- W6-06 final design freeze squash merge / W6-07 activation baseline: `master@6b435dbf49c609a95a4d95935090825f003e7a5d` (#206).
- W6-05 final matrix remains `PASS 45 / FAIL 6 / DEGRADED 7 / UNVERIFIED 22 / total 80`.
- W6-05 finding severity remains `P0=0 / P1=0 / P2=5 / P3=0`.
- W6-06 — Zen Visual System & UX Redesign: **COMPLETE / CLOSED — V26 TARGET DESIGN FROZEN**.
- Final W6-06 owner score: **93.4 / 100**, above the retained **92 / 100** freeze threshold.
- W6-07 — Core Experience Reconstruction: **ACTIVE — implementation; staged presentation-layer reconstruction authorized**.
- W6-08 / W6-09 / W6-10: inactive.
- Current W6 state: **ACTIVE — implementation; W6-07 Core Experience Reconstruction**.
- Public `v0.1.40` publication: **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED / DO NOT PUBLISH**.
- Published GitHub release: none.
- Published Git tag: none.
- Package version remains `0.1.40`.
- Database schema remains `35`.

## Current initiative

**W6 — Product Maturity Audit**

Status: **ACTIVE — implementation; W6-07 Core Experience Reconstruction**

Authority: [W6 initiative](initiatives/W6-product-maturity-audit.md).

Current Track authority: [W6-07 Core Experience Reconstruction Activation](tasks/W6-07-CORE-EXPERIENCE-RECONSTRUCTION-ACTIVATION.md).

W6-06 freeze authority: [W6-06 Design Freeze Closeout Result](tasks/W6-06-DESIGN-FREEZE-CLOSEOUT-RESULT.md).

## W6-07 current implementation boundary

W6-07 reconstructs the presentation layer toward the checksum-bound V26 target while preserving the existing engine and durable authorities.

Working rule:

> **Preserve the engine; rebuild the cockpit.**

The first bounded implementation slice is deliberately limited to:

1. production tokens / typography / density roles;
2. minimal shared primitives needed by shell and Files;
3. Windows/macOS native shell/chrome scaffolding where presentation integration requires it;
4. exactly one global Files destination with Library/Browse internal-mode scaffolding;
5. bounded real Files list/search/selection/Inspector behavior using existing Query/selection authorities;
6. proportional code/browser/interaction evidence plus focused native checks only where claims depend on native behavior.

The first implementation PR must not pull Settings, Organize, Cleanup, History, Automation or broad Quick Preview format expansion into scope merely for visual completeness.

Production `src/` changes are authorized for staged presentation reconstruction. `src-tauri/` changes are authorized only where required for presentation/native-shell integration; backend/file/Preview/provider authority is not reopened.

Any database/schema migration, new durable backend authority, mutation-safety change, provider/credential ownership change or second Preview architecture remains outside W6-07 activation.

## W6-06 final design freeze

W6-06 converted the accepted W6-05 real-product evidence into one coherent Zen Canvas presentation target without changing production implementation.

Final authority:

- [W6-06 Final Design Freeze Audit](tasks/W6-06-FINAL-DESIGN-FREEZE-AUDIT.md)
- [W6-06 Design Freeze Closeout Result](tasks/W6-06-DESIGN-FREEZE-CLOSEOUT-RESULT.md)
- [V26 Freeze Manifest](../design/w6-06/07-V26-FREEZE-MANIFEST.md)
- [W6-07 Implementation Handoff](../design/w6-06/07-W6-07-IMPLEMENTATION-HANDOFF.md)

A fresh W6-07 checkout must verify the target before side-by-side implementation review:

```bash
python docs/design/w6-06/07-v26/rebuild-v26.py --verify-only
```

Final owner decision:

> **W6-06 TARGET DESIGN FREEZE: PASS — 93.4 / 100**

Frozen owner decisions include:

- one global **Files** entry; Library and Browse Folder remain internal Files-workspace modes;
- centered Search + Commands anchor;
- Selection, Focus and Primary remain independent concepts;
- underline / bottom-bar / focus-rail / decorative glow focus grammar is prohibited;
- `Space` opens Quick Preview;
- related controls share a family without mechanically identical selection anatomy;
- degraded / unavailable / permission / partial-failure / safety states remain truthful;
- Windows and macOS share the Zen design language but retain platform-appropriate native chrome;
- existing durable Query, Preview Core, Restore, Dry Run, Safe Trash and AI-consent authorities are preserved;
- no second Preview architecture is authorized.

W6-06 browser/prototype acceptance is not native-product acceptance.

## W6-05 evidence truth retained

W6-05 is **COMPLETE / CLOSED** and remains the accepted whole-product native evidence baseline until the planned W6-09 native regression.

Final outcome: **DEGRADED**.

The five consolidated P2 findings remain:

1. Cleanup valid Windows extended-path rejection before candidate review;
2. image / CSV / JSON / folder Quick Preview generic unavailable states;
3. Global Index source unavailable in the isolated audit run;
4. Organization Plan suggestion / authoritative safe-preview loading degraded;
5. Browse root-status / first-scan recovery friction.

Final retained W6-05 evidence ZIP SHA-256:

`0659F2BAEF45666D9380C623B179B9513D5643281B21B0B0411824D2EC0EFDA3`

W6-07 implementation must not silently upgrade these `FAIL`, `DEGRADED` or `UNVERIFIED` states.

## Authorized W6 sequencing

1. **W6-06 — Zen Visual System & UX Redesign** — COMPLETE / CLOSED.
2. **W6-07 — Core Experience Reconstruction** — **ACTIVE — implementation**.
3. **W6-08 — Cross-Platform Quick Preview Experience** — planned/inactive; separate activation required.
4. **W6-09 — Whole-Product Native Regression** — planned/inactive.
5. **W6-10 — Release Re-entry** — planned/inactive; only after product-owner maturity acceptance.

W6-07 implementation order remains:

1. tokens / typography / shared primitives / native shell;
2. Files workspace;
3. Inspector + Search + Command Palette;
4. Settings;
5. Organize + Cleanup;
6. Overview + History + Automation;
7. cross-surface consolidation.

## Native QA policy

Native QA remains a **stage-level gate**, not a mandatory action after every small presentation PR.

- browser evidence must not be promoted into native acceptance;
- native/rendering-specific slices require focused real-host evidence when the claim depends on native behavior;
- broad coherent native regression belongs to W6-09;
- W6-10 owns fresh release-path evidence on an exact candidate.

## Supported product platform truth

- Windows is a supported product platform.
- macOS 13 or later on Apple Silicon is a supported product platform.
- Intel Macs, Universal binaries, Rosetta and Linux are not product targets.
- Accessibility certification is not claimed.

## Publication state

Current release state remains:

> **Product implementation under maturity work; public publication deferred.**

The [v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md) remains **DEFERRED / DO NOT EXECUTE**.

No W6-07 activation authorizes a version change, tag, GitHub Release, signing/notarization work or publication.

## Strengths W6-07 must preserve

- Library/Browse authority separation;
- Query/selection scaling and stale-snapshot behavior;
- Preview Core cancellation/fallback/materialization boundaries;
- Organization Plan review → safe preview → Dry Run → execution gates;
- Cleanup Analysis/Finding → Preview → Safe Trash;
- Restore/recovery authority;
- Global Search ordering/no-source/IME semantics;
- AI local/cloud/provider consent boundaries;
- exact-SHA CI/release qualification;
- large-library performance gates.

## Review policy

W6 work must not use Codex Review as merge authority. Merge decisions use direct diff inspection, repository governance checks and CI evidence unless the product owner explicitly changes this rule.
