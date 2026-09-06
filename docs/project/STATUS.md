# Zen Canvas Project Status

Last verified: 2026-09-06

## Current execution truth

- Default branch: `master`.
- W6-05 accepted result/evidence squash merge / W6-06 activation baseline: `master@507253589c2bbc9924f643ddd38456e2716138dd` (#199).
- W6-05 final matrix remains `PASS 45 / FAIL 6 / DEGRADED 7 / UNVERIFIED 22 / total 80`.
- W6-05 finding severity remains `P0=0 / P1=0 / P2=5 / P3=0`.
- W6-06 — Zen Visual System & UX Redesign: **COMPLETE / CLOSED — V26 TARGET DESIGN FROZEN**.
- Final W6-06 owner score: **93.4 / 100**, above the retained **92 / 100** freeze threshold.
- W6-07 — Core Experience Reconstruction: **INACTIVE — requires a separate governance activation after W6-06 merge**.
- W6-08 / W6-09 / W6-10: inactive.
- Current W6 state: **ACTIVE — between Tracks; W6-06 complete, W6-07 not yet activated**.
- Production `src/` / `src-tauri/` changes authorized by W6-06: **none**.
- Public `v0.1.40` publication: **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED / DO NOT PUBLISH**.
- Published GitHub release: none.
- Published Git tag: none.
- Package version remains `0.1.40`.
- Database schema remains `35`.

## W6-06 final design freeze

W6-06 converted the accepted W6-05 real-product evidence into one coherent Zen Canvas presentation target without changing production implementation.

Final authority:

- [W6-06 Final Design Freeze Audit](tasks/W6-06-FINAL-DESIGN-FREEZE-AUDIT.md)
- [W6-06 Design Freeze Closeout Result](tasks/W6-06-DESIGN-FREEZE-CLOSEOUT-RESULT.md)
- [V26 Freeze Manifest](../design/w6-06/07-V26-FREEZE-MANIFEST.md)
- [W6-07 Implementation Handoff](../design/w6-06/07-W6-07-IMPLEMENTATION-HANDOFF.md)

Final owner decision:

> **W6-06 TARGET DESIGN FREEZE: PASS — 93.4 / 100**

The retained threshold was 92 / 100. V26 is now the authoritative presentation-layer target for later implementation.

Frozen owner decisions include:

- one global **Files** entry; Library and Browse Folder remain internal File-workspace modes;
- centered Search + Commands anchor;
- Selection, Focus and Primary remain independent concepts;
- underline / bottom-bar / focus-rail / decorative glow focus grammar is prohibited;
- `Space` opens Quick Preview;
- related controls share a family without mechanically identical selection anatomy;
- degraded / unavailable / permission / partial-failure / safety states remain truthful;
- Windows and macOS share the Zen design language but retain platform-appropriate native chrome;
- existing durable Query, Preview Core, Restore, Dry Run, Safe Trash and AI-consent authorities are preserved;
- no second Preview architecture is authorized.

Final browser/prototype QA recorded by the freeze audit:

- main V26: `128 / 128` primary layout scenarios PASS;
- main V26: `8 / 8` core interaction suites PASS;
- main V26: `16 / 16` additional 680px smoke PASS;
- Windows platform chrome: PASS;
- macOS platform chrome: PASS;
- Desktop Quick Search V26: `6 / 6` layout scenarios PASS plus its search/keyboard/focus suite PASS;
- console/page errors: 0 in the retained runs.

These are **design/prototype acceptance claims only**. They are not native-product acceptance and do not upgrade W6-05 `FAIL`, `DEGRADED` or `UNVERIFIED` observations.

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

W6-06 may specify target behavior for these states, but the design freeze does not change their native evidence status.

## Next authorized sequencing

The intended W6 maturity sequence remains:

1. **W6-06 — Zen Visual System & UX Redesign** — COMPLETE / CLOSED.
2. **W6-07 — Core Experience Reconstruction** — next planned Track, but **not activated by W6-06 completion**.
3. **W6-08 — Cross-Platform Quick Preview Experience** — later focused work on the existing Preview Core / `ZenFloatingQuickPreview` architecture.
4. **W6-09 — Whole-Product Native Regression** — coherent supported-platform native regression after redesign/reconstruction.
5. **W6-10 — Release Re-entry** — only after product-owner maturity acceptance.

A separate governance change must activate W6-07. Until that merges, production reconstruction remains unauthorized.

## W6-07 implementation boundary prepared by W6-06

The implementation handoff freezes the intended order:

1. tokens / typography / shared primitives / native shell;
2. Files workspace (Library + Browse Folder internal modes);
3. Inspector + Search + Command Palette;
4. Settings;
5. Organize + Cleanup;
6. Overview + History + Automation;
7. cross-surface consolidation.

Working rule:

> **Preserve the engine; rebuild the cockpit.**

W6-07 must not reinterpret the freeze as authority to restart backend ownership, weaken filesystem/safety gates, introduce another Preview engine, or erase W6-05 evidence truth.

## Native QA policy

Native QA remains a **stage-level gate**, not a mandatory action after every small presentation PR.

- browser/prototype evidence must not be promoted into native acceptance;
- native/rendering-specific slices may require focused real-host evidence;
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

No W6-06 result authorizes a version change, tag, GitHub Release, signing/notarization work or publication.

## Strengths later work must preserve

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

W6 work must not use Codex Review as the merge authority. Merge decisions use direct diff inspection, repository governance checks and CI evidence unless the product owner explicitly changes this rule.
