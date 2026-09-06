# W6-07 — Core Experience Reconstruction Activation

Date: 2026-09-07

Status: **ACTIVE — implementation; staged presentation-layer reconstruction authorized**

## Baseline and authority

Activation baseline:

- `master@6b435dbf49c609a95a4d95935090825f003e7a5d`
- W6-06 final freeze/closeout: PR #206
- W6-06 owner freeze score: **93.4 / 100**
- retained freeze threshold: **92 / 100**

Primary implementation target:

- [W6-06 Final Design Freeze Audit](W6-06-FINAL-DESIGN-FREEZE-AUDIT.md)
- [W6-06 Design Freeze Closeout Result](W6-06-DESIGN-FREEZE-CLOSEOUT-RESULT.md)
- [V26 Freeze Manifest](../../design/w6-06/07-V26-FREEZE-MANIFEST.md)
- [W6-07 Implementation Handoff](../../design/w6-06/07-W6-07-IMPLEMENTATION-HANDOFF.md)

A fresh implementation checkout must verify the frozen V26 targets before side-by-side review:

```bash
python docs/design/w6-06/07-v26/rebuild-v26.py --verify-only
```

Expected result: four checksum-bound V26 targets PASS exactly as recorded in the freeze manifest.

Initiative authority:

- [W6 — Product Maturity Audit](../initiatives/W6-product-maturity-audit.md)

Native evidence baseline retained:

- W6-05 remains the accepted whole-product native evidence baseline until W6-09.
- Its `FAIL`, `DEGRADED` and `UNVERIFIED` states are not upgraded by W6-06 design acceptance or by W6-07 implementation work without new evidence.

## Purpose

W6-07 reconstructs the Zen Canvas **presentation layer and native shell toward the frozen V26 target** while preserving the mature engine underneath it.

Working rule:

> **Preserve the engine; rebuild the cockpit.**

This is not authority for a backend rewrite, a new Preview architecture, a schema migration, or a feature-expansion wave. The goal is to make the real product inherit the coherence, density, state grammar, platform credibility and interaction quality frozen by W6-06.

## Frozen product decisions

W6-07 implementation must preserve these owner decisions unless a separately reviewed amendment explicitly changes them:

- exactly one global **Files** destination;
- Library and Browse Folder are internal Files-workspace modes, not duplicate top-level destinations;
- centered Search + Commands anchor;
- Selection ≠ Focus ≠ Primary;
- no underline / bottom-bar / focus rail / decorative focus glow;
- `Space` opens Quick Preview;
- related-but-not-identical selection semantics;
- truthful loading/degraded/unavailable/permission/partial-failure/safety states;
- Windows and macOS share Zen product grammar but keep platform-appropriate native chrome;
- no second Preview architecture;
- release/publication state remains unchanged.

## Durable authorities that must not be restarted

The presentation reconstruction must preserve existing durable behavior and ownership represented by:

- Library/Browse authority separation;
- Query/selection scaling and stale-snapshot behavior;
- large-library virtualization/performance contracts;
- Preview Core cancellation/fallback/materialization boundaries;
- existing `ZenFloatingQuickPreview` / Preview Host seams;
- Organization Plan review → safe preview → Dry Run → execution gates;
- Cleanup Analysis/Finding → Preview → Safe Trash;
- Restore/recovery and History ledger authority;
- Global Search ordering/no-source/IME semantics;
- local-first/no-upload privacy posture;
- AI local/cloud/provider consent and credential boundaries;
- exact-SHA CI/release qualification contracts;
- schema/version authority.

Presentation adapters may consume those authorities; they must not duplicate or weaken them.

## Authorized staged reconstruction

W6-07 is an implementation Track, but implementation is intentionally staged.

### Phase 1 — Tokens, primitives and native shell

Introduce/consolidate production presentation foundations needed by later slices:

- semantic color roles and Light/Dark mapping;
- typography ladder;
- spacing/density/radius/elevation roles;
- reduced-motion and motion-role foundations;
- Button / IconButton;
- SearchField / Input;
- Zen Select;
- Switch;
- Menu / Context Menu;
- Dialog / overlay foundation;
- FileRow / GridTile state primitives;
- focus/selection/disabled grammar;
- Windows native titlebar/caption integration;
- macOS native titlebar/toolbar integration;
- shared app shell/navigation scaffolding.

Do not migrate every page merely because primitives exist.

### Phase 2 — Files flagship workspace

The first complete production surface should become the Files workspace:

- one global Files entry;
- Library / Browse Folder internal modes;
- Back / Forward where authoritative history exists;
- scope-aware Search;
- Filter / Sort / Saved View using existing Query authority;
- List / Grid;
- single and multi-selection;
- Inspector relationship;
- Context Menu;
- Show Location;
- Organize selection entry point;
- `Space` → existing Quick Preview path;
- real empty/loading/degraded/unavailable/permission states;
- preserve virtualization and stale-snapshot semantics.

### Phase 3 — Search / Palette / Inspector

- centered Search + Commands anchor;
- application Command Palette;
- Desktop Quick Search integration boundary;
- selection → Inspector continuity;
- keyboard/focus-return contracts;
- no new search authority parallel to existing search/query seams.

### Phase 4 — Settings

- Zen Select / Switch / Settings Search;
- Settings section keyboard navigation;
- System / Light / Dark;
- Default / Compact;
- AI consent/provider truth;
- Global Index and diagnostics truth states;
- wide/narrow presentation without hiding required controls.

### Phase 5 — Organize + Cleanup

Preserve Zen's safety signature while reconstructing presentation:

- suggestion → authoritative safe preview → Dry Run → confirm;
- scan → review → Preview → Safe Trash → restore;
- partial/degraded/unavailable states remain explicit;
- no styling that implies readiness or success before authoritative state exists.

### Phase 6 — Overview + History + Automation

Migrate remaining primary surfaces to the same primitive/state system. Remove legacy duplicate styling only after replacement behavior is proven.

### Phase 7 — Cross-surface consolidation

- remove temporary presentation compatibility layers after consumers migrate;
- verify canonical metrics/state grammar across surfaces;
- prepare W6-08 Quick Preview-specific inputs;
- prepare W6-09 whole-product native-regression readiness.

## First bounded implementation slice

Activation of W6-07 does **not** authorize an immediate whole-product rewrite.

The first reviewable implementation slice is bounded to:

1. canonical production tokens/typography/density roles;
2. a minimal shared primitive set needed by the shell and Files workspace;
3. Windows/macOS shell/chrome scaffolding where production integration requires it;
4. exactly one global Files destination with Library/Browse internal-mode scaffolding;
5. a bounded real Files list/selection/search/Inspector path that continues to use existing authorities;
6. browser/code regression evidence proving no duplicate top-level Library/Browse path and no focus-grammar regression.

If a native titlebar/window behavior cannot be validated truthfully in browser evidence, record it as a focused native checkpoint rather than inventing PASS.

Do **not** include Settings, Organize, Cleanup, History, Automation or broad Quick Preview format expansion in the first implementation PR merely to make it look complete.

## Production paths authorized

W6-07 may modify production presentation code under `src/` as needed for the staged reconstruction.

`src-tauri/` changes are authorized only where required for **presentation/native-shell integration** such as window chrome, titlebar hit regions, platform window behavior or an existing presentation seam. They must not be used to restart backend/file/Preview/provider authority.

Any proposed database/schema migration, new durable backend authority, mutation-safety change, provider/credential ownership change or second Preview architecture is **outside this activation** and requires separate governance.

## Validation policy

### Normal implementation PRs

Use proportional evidence:

- code/static checks;
- browser/rendered comparison against checksum-verified V26 target states;
- focused interaction/keyboard regression;
- existing feature-authority tests appropriate to touched surfaces.

### Native-dependent slices

Focused real-host evidence is required when a claim depends on native behavior such as:

- Windows/macOS titlebar/caption/hit regions;
- DPI/Retina/font raster behavior materially affecting acceptance;
- native IME/accessibility behavior;
- drag/drop or OS Context Menu integration;
- Preview window behavior that cannot be represented truthfully in browser-only evidence.

Do not require full whole-product native regression after every small PR. W6-09 owns coherent whole-product native regression after reconstruction.

### Performance

Files reconstruction must preserve existing large-library performance/virtualization gates. A visually correct implementation that regresses large-library behavior is not acceptable.

## Acceptance gates for W6-07

W6-07 is not complete merely when V26 styling is copied into production.

Closeout requires evidence that:

- the main production surfaces share one implemented Zen presentation system;
- Files has one top-level destination and preserves Library/Browse authority internally;
- Search/selection/focus/Inspector behavior is real, not decorative;
- Settings/Organize/Cleanup/History/Automation migrate without weakening authority/safety truth;
- Light/Dark, Chinese/English and supported desktop window ranges are coherent;
- Windows/macOS native shell behavior is platform-credible where implemented;
- no second Preview/search/backend authority was introduced;
- W6-05 evidence truth remains accurately represented;
- W6-08 and W6-09 handoff inputs are ready.

Expected final decision:

> **W6-07 COMPLETE — PROCEED TO W6-08 QUICK PREVIEW EXPERIENCE**

or a separately documented blocker/amendment decision.

## Explicit non-goals

W6-07 must not:

- publish `v0.1.40`;
- create a tag/GitHub Release;
- bump package version or schema merely because presentation changes;
- add updater/OCR/RAG/plugin/agent breadth;
- create another Preview engine;
- weaken mutation confirmation/revalidation;
- weaken Safe Trash/Restore guarantees;
- weaken AI consent/provider/credential boundaries;
- relabel W6-05 evidence without new evidence;
- solve design debt by indiscriminate feature expansion.

## Review policy

W6 review policy remains:

> **Codex Review is not merge authority.**

Merge decisions use direct diff inspection, project-governance checks and CI evidence unless the product owner explicitly changes the rule.

## Publication boundary

Public `v0.1.40` publication remains:

> **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED / DO NOT PUBLISH**

W6-07 activation changes no version, tag, release, signing/notarization or publication state.
