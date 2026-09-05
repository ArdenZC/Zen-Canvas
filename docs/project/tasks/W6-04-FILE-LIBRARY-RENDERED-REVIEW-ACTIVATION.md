# W6-04 — File Library Calm-Surface Rendered Review — Activation

Status: **ACTIVE — specification only / evidence review; implementation not yet authorized**

Baseline: `master@9fd34956c8907810fea676e643202ea735af46df`; tree `237d63c842a200eba1058d206c9dc89a7b0e6ebf`.

Authority: [`../initiatives/W6-product-maturity-audit.md`](../initiatives/W6-product-maturity-audit.md)

Source finding: [`W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md`](W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md) — `W6-M2-001` and bounded evidence relevant to `W6-M2-005`.

Previous result: [`W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-RESULT.md`](W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-RESULT.md)

Codex / native QA brief: [`W6-04-FILE-LIBRARY-RENDERED-REVIEW-CODEX.md`](W6-04-FILE-LIBRARY-RENDERED-REVIEW-CODEX.md)

## Required read set

Before collecting evidence or proposing implementation, read:

1. `AGENTS.md`
2. `docs/project/MASTER_DEVELOPMENT_PLAN.md`
3. `docs/project/STATUS.md`
4. `docs/project/ROADMAP.md`
5. `docs/project/initiatives/W6-product-maturity-audit.md`
6. `docs/project/DEVELOPMENT_WORKFLOW.md`
7. `docs/project/CODE_MAINTAINABILITY.md`
8. `docs/project/tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md`
9. `docs/project/tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-RESULT.md`
10. `docs/project/tasks/W5-04-SUPPORTED-PLATFORM-MANUAL-RELEASE-ACCEPTANCE-RESULT.md`
11. the current File Library implementation and existing W2 browser/performance contracts relevant to any observed issue.

## Why this Track begins with evidence

W6-01 classified `W6-M2-001` as **VISUALLY REVIEW, THEN SIMPLIFY**. The source already proves that File Library has substantial control density, but source inspection alone cannot determine which controls are visually dominant, which states are calm in practice, or whether W6-03's new global hierarchy changes the perceived balance.

W6-03 is now merged. Native desktop control is reported available again, so the missing fresh rendered observation can be collected against the current product instead of relying on historical browser mocks.

This activation therefore authorizes **observation and specification only**. It does not authorize production UI changes yet.

## Primary question

> On the current W6-03 master, does File Library present a calm, obvious default workflow, or do low-frequency controls still compete visually with core browse/search/select/preview actions?

The answer must come from fresh rendered evidence, not from counting controls in source.

## Evidence target

Preferred target is the real Windows Zen Canvas native application launched from the exact W6-04 baseline or a later explicitly recorded docs-only successor with the same production tree.

Record:

- exact source SHA and tree;
- host Windows version/build and architecture;
- launch method/build provenance;
- display resolution and scaling;
- whether evidence is native Tauri UI or browser-only fallback;
- fixture/data source used;
- screenshots or equivalent visual evidence for each exercised state;
- keyboard/Narrator/display observations where actually exercised.

A browser fallback may still produce useful layout evidence, but it must be labeled browser evidence and must not be represented as native acceptance.

## Required rendered review matrix

### A. Default File Library hierarchy

Observe the first stable Library state with a controlled local fixture containing enough folders/files to make the main controls meaningful.

Assess:

- what the eye is drawn to first;
- whether the primary file/content area dominates over chrome;
- command-bar density and grouping;
- source/scope chrome density;
- visibility and relative emphasis of search, source actions, navigation, List/Grid and contextual actions;
- whether Saved Views / Tags / filter state / counts compete with core tasks;
- whether the default surface communicates one obvious next action.

### B. Browse mode

Switch to Browse and observe whether Library/Browse mode ownership remains understandable without making the command bar feel like a second navigation system.

Do not reinterpret Browse as durable managed-Library authority.

### C. Search / filter states

Exercise:

- no query / no filter;
- local search query;
- one representative filter or saved-view state when available;
- clear-filter / return-to-default path.

Record whether transient state produces excessive persistent controls or confusing duplicate status copy.

### D. Selection states

Exercise:

- no selection;
- one selected item;
- multiple selected items when safe;
- select-all-matching affordance if the fixture/state exposes it.

Do not execute destructive mutations merely to create evidence. Selection/action hierarchy may be observed without confirming an operation.

### E. Preview interaction

Open one supported ordinary preview from File Library and close/return.

Assess whether Preview feels like a contextual file action rather than another competing workspace, and whether returning to Library preserves understandable focus/context.

This is File Library rendered review, not Explorer Preview Handler acceptance.

### F. Responsive/native window widths

Exercise at least:

- a comfortable wide desktop window;
- a medium window around the product's common desktop working width;
- the narrowest practical supported native window state that can be reached without forcing an invalid layout.

Record overflow, clipped controls, hidden critical actions, excessive wrapping and whether lower-frequency chrome properly yields space to content.

### G. Theme/language sample

At minimum observe the primary Library state in both light and dark themes if the current product supports them without destructive setup changes.

Observe one Chinese and one English state where practical. This is a sample for hierarchy/copy expansion, not a claim of full localization certification.

### H. Bounded native input/accessibility/display smoke

Because native control is now available, attempt the following on Windows where genuinely supported by the environment:

- keyboard traversal through the primary shell into File Library and major File Library controls;
- visible focus sanity for the exercised path;
- Escape/back/close behavior for one contextual surface or Preview state;
- one real Windows display-scaling scenario if the host can change scaling safely;
- Narrator smoke for the primary shell and File Library's principal controls if Narrator is available.

Record narrow observations such as `PASS — focus moved through the exercised primary controls in a usable order` or `OBSERVED — Narrator identified the exercised control name/state`.

Do **not** claim accessibility compliance or full native acceptance.

## Evidence classifications

Use only:

- `PASS` — the bounded stated behavior was actually exercised successfully;
- `FAIL` — the bounded stated behavior was exercised and failed;
- `OBSERVED` — descriptive visual/native evidence that is not meaningfully pass/fail;
- `NOT OBSERVED` — a conditional surface did not appear in the stated environment;
- `UNVERIFIED` — not executed or required fixture/capability unavailable;
- `DEFERRED` — intentionally postponed with reason and owning later Track.

## Explicitly deferred to W6-05

This Track must not manufacture release acceptance. Unless a separate later activation explicitly moves the boundary, keep these in W6-05:

- NSIS installer acquisition/install/repair/uninstall lifecycle;
- SmartScreen and Internet-zone reputation behavior;
- Unknown Publisher / UAC release-path observations;
- Explorer Preview Handler native focus/keyboard acceptance;
- macOS DMG/quarantine/Gatekeeper lifecycle;
- VoiceOver / Retina release acceptance on Apple Silicon;
- release-artifact hashes/provenance for a fresh public candidate;
- iCloud/File Provider, external APFS/exFAT, SMB/network and genuine multi-display fixture evidence;
- real older-release → newer-release cross-version upgrade.

The historical W5-04 candidate is not a substitute for current W6 evidence.

## Safety / fixture rules

- Prefer a disposable local fixture folder owned by this review.
- Do not use irreplaceable personal files for mutation flows.
- Do not execute destructive cleanup/organize/restore actions merely to populate screenshots.
- Do not disable Windows security globally.
- Do not fabricate network/external/provider fixtures with ordinary local folders.
- If native control cannot reach a surface truthfully, mark it `UNVERIFIED` rather than substituting browser evidence silently.

## Output required before implementation activation

Create a rendered-review result that contains:

1. exact SHA/tree/environment;
2. evidence matrix with screenshots/notes;
3. observed hierarchy problems ranked by product impact;
4. controls that should remain primary;
5. controls that appear eligible for grouping/contextual/overflow treatment;
6. any accessibility/responsive defect actually observed;
7. explicit `UNVERIFIED`/`DEFERRED` items;
8. a bounded recommendation:
   - `NO W6-04 IMPLEMENTATION REQUIRED`, or
   - `ACTIVATE BOUNDED W6-04 IMPLEMENTATION` with a short proposed scope.

No production code may be changed under this evidence-only activation.

## Stop conditions

Stop and report rather than broadening scope if:

- the exact baseline cannot be identified;
- the real native app cannot be launched and only browser evidence is available;
- a P0/P1 data-loss, unsafe filesystem mutation or security defect is discovered;
- the review would require changing durable Library/Browse/Query/Preview authority;
- evidence suggests a new feature rather than simplification is required;
- release-installer/OS-reputation work begins to dominate the review.

## Publication state

Public `v0.1.40` remains **DEFERRED / DO NOT EXECUTE**. W6-04 rendered review does not authorize a tag, GitHub Release, signing/notarization work or publication.
