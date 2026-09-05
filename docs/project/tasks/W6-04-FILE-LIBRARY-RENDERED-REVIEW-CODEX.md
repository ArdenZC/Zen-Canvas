# W6-04 — File Library Rendered Review — Codex / Native Computer-Use Brief

Status: **ACTIVE — specification only / evidence collection; NO PRODUCTION IMPLEMENTATION**

Authority: [`W6-04-FILE-LIBRARY-RENDERED-REVIEW-ACTIVATION.md`](W6-04-FILE-LIBRARY-RENDERED-REVIEW-ACTIVATION.md)

Expected baseline: `master@9fd34956c8907810fea676e643202ea735af46df`; expected tree `237d63c842a200eba1058d206c9dc89a7b0e6ebf`.

## Mission

Use the restored native computer-control capability to inspect **the real current Windows Zen Canvas application** and produce fresh rendered evidence for W6-04.

The goal is to decide whether File Library still needs bounded calm-surface/control-density polish after W6-03. Do not implement UI changes during this run.

This is **Codex Computer Use / QA**, not Codex Review. Do not open or submit a Codex code review.

## Required read set

Read before doing anything else:

1. `AGENTS.md`
2. `docs/project/MASTER_DEVELOPMENT_PLAN.md`
3. `docs/project/STATUS.md`
4. `docs/project/ROADMAP.md`
5. `docs/project/initiatives/W6-product-maturity-audit.md`
6. `docs/project/DEVELOPMENT_WORKFLOW.md`
7. `docs/project/CODE_MAINTAINABILITY.md`
8. `docs/project/tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-ACTIVATION.md`
9. `docs/project/tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md`
10. `docs/project/tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-RESULT.md`
11. `docs/project/tasks/W5-04-SUPPORTED-PLATFORM-MANUAL-RELEASE-ACCEPTANCE-RESULT.md`

## R0 — fail-closed preflight

Before launching the app, record:

```text
repository root:
branch:
HEAD:
HEAD tree:
origin/master:
origin/master tree:
working tree status:
Windows version/build:
architecture:
display resolution:
display scaling:
native Computer Use app list / native control availability:
```

Required source condition:

- preferred: exact `master@9fd34956c8907810fea676e643202ea735af46df` and tree `237d63c842a200eba1058d206c9dc89a7b0e6ebf`;
- acceptable only if master has advanced by documentation-only changes with production tree equivalence explicitly proven and recorded;
- otherwise stop and report the actual source identity before collecting acceptance evidence.

Do not mutate an unknown dirty checkout. Do not discard or overwrite unrelated local changes.

## R1 — controlled fixture

Create or select a review-owned local fixture directory that is safe to inspect. Prefer a worktree/repository-local ignored fixture root when practical.

The fixture should contain a small but visually meaningful hierarchy, for example:

- several folders;
- common text/source documents;
- a few images if supported;
- enough files to exercise search, selection and Preview;
- no sensitive/private files;
- no need to exceed ordinary small-fixture size.

Record the fixture path and whether any files were created specifically for the review.

Do not use real personal files for destructive operations.

## R2 — launch the real native app

Launch Zen Canvas as the real Windows native/Tauri application from the recorded source/build.

Record:

- exact launch command or executable path;
- whether startup completed successfully;
- whether the window is genuinely native and controllable;
- initial window size/state;
- whether onboarding appears.

If onboarding appears, exercise only the minimum safe current-product path needed to connect the review fixture. Observe the current first-value hierarchy as supplementary evidence, but do not turn this into W6-02 re-implementation work.

If only a browser surface is available, stop the native claim and label the run `BROWSER FALLBACK — NATIVE REVIEW UNVERIFIED`.

## R3 — primary File Library rendered review

Navigate to File Library and capture/record the stable default Library state.

For every screenshot/observation, record enough context to identify the state.

Inspect:

- dominant visual target;
- relationship between content and command chrome;
- Back/Forward and mode/navigation controls;
- Library/Browse switch;
- current target/source label;
- search field;
- source actions;
- List/Grid controls;
- contextual/overflow actions;
- scope/health indicators;
- View All / Switch Scan Directory if present;
- Saved Views and Tags management affordances if present;
- filter summary / clear filter;
- result count / selection count;
- select-all-matching affordance when applicable.

Do not mark a control as “too much” merely because it exists. Judge visual competition, frequency, grouping, hierarchy and state relevance in the rendered app.

## R4 — state matrix

Exercise and capture these states where available:

### Library default

- no local search query;
- no transient filter if possible;
- no selection.

### Browse

- switch to Browse;
- navigate one safe level if possible;
- return to Library;
- verify the authority distinction remains understandable.

### Search/filter

- enter a representative local search query;
- clear it;
- exercise one representative filter/saved-view state if naturally available;
- return to calm default.

### Selection

- select one item;
- select several items;
- observe select-all-matching if exposed;
- clear selection.

Do not confirm destructive actions.

### Preview

- open one ordinary supported file Preview;
- observe Preview hierarchy and contextual relationship to File Library;
- close/return;
- record whether selection/focus/context remains understandable.

This does not validate Explorer Preview Handler.

## R5 — native window/responsive review

Resize the actual native window and capture at least three useful widths:

1. wide desktop state;
2. medium desktop state;
3. narrowest practical supported state reachable without forcing an invalid unsupported size.

For each state record:

- approximate window dimensions;
- clipped/overflowing controls;
- excessive wrapping;
- lost labels or inaccessible critical actions;
- whether content or low-frequency chrome yields space first;
- whether the File Library still communicates a coherent primary task.

Do not infer CSS breakpoints from source as rendered evidence; observe the actual window.

## R6 — theme/language sample

If safe and available in the current Settings UI:

- observe primary File Library in light theme;
- observe primary File Library in dark theme;
- observe one Chinese state;
- observe one English state.

Record only what is actually exercised. Do not claim complete theme/localization certification.

## R7 — keyboard/focus smoke

Using keyboard input rather than mouse-only control, exercise a bounded primary flow:

- enter the shell / File Library controls;
- Tab / Shift+Tab through representative primary controls;
- activate at least one non-destructive control with keyboard;
- enter/exit one contextual or Preview surface;
- verify visible focus is not lost or trapped unexpectedly;
- verify Escape/back behavior where applicable.

Record the actual observed focus sequence sufficiently to identify any problem.

Use `PASS`, `FAIL`, or `UNVERIFIED`; do not call this accessibility certification.

## R8 — Narrator smoke, if genuinely available

If Windows Narrator can be launched and used safely in the environment:

- enable Narrator;
- sample the main shell navigation;
- sample File Library mode/search/list/grid or equivalent principal controls;
- sample one selected file or Preview state;
- record whether principal control names/roles/states are intelligible in the exercised path.

Do not attempt exhaustive WCAG/accessibility certification.

If Narrator cannot be controlled reliably, record `UNVERIFIED — Narrator fixture/control unavailable`.

## R9 — display scaling smoke, if safely available

If the Windows host permits changing display scale without destabilizing the environment:

- record initial scale;
- exercise one additional real scale setting;
- relaunch/reobserve File Library if Windows requires it;
- record clipping, sizing, focus and readability issues;
- restore the original scale afterward.

If changing scale is unsafe or unsupported in the current remote/native-control environment, mark `UNVERIFIED`.

Do not fabricate DPI evidence by browser zoom.

## R10 — explicitly do NOT execute in this run

Do not perform these W6-05 release-acceptance items:

- download/acquire a release installer merely to trigger Internet-zone behavior;
- SmartScreen/reputation testing;
- Unknown Publisher/UAC release-path testing;
- NSIS install/uninstall acceptance;
- Explorer Preview Handler acceptance;
- macOS DMG/Gatekeeper/VoiceOver testing;
- external-volume/SMB/iCloud/File Provider fixture simulation;
- cross-version upgrade testing;
- publication/tag/release actions.

If an existing installed build happens to surface an OS warning incidentally, record it as incidental evidence but do not expand scope.

## R11 — result document

Create:

`docs/project/tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-RESULT.md`

Required structure:

```text
Status
Date/time
Exact source SHA/tree
Environment
Launch/build provenance
Fixture
Evidence classification legend

A. Default Library rendered hierarchy
B. Browse state
C. Search/filter states
D. Selection states
E. Preview state
F. Window-width/responsive observations
G. Theme/language sample
H. Keyboard/focus smoke
I. Narrator smoke
J. Display-scaling smoke
K. Unverified/deferred native evidence

Findings ranked:
- P0/P1 blockers, if any
- P2 maturity defects
- P3 polish observations

Controls that should remain primary
Controls eligible for grouping/contextual/overflow treatment

Decision:
- NO W6-04 IMPLEMENTATION REQUIRED
or
- ACTIVATE BOUNDED W6-04 IMPLEMENTATION

Proposed bounded implementation scope, if activated
```

Screenshots/evidence files should be stored only in an appropriate task-owned evidence location already permitted by repository conventions. Do not commit huge transient captures blindly; if repository policy expects external/local evidence, record paths and provenance instead.

## R12 — final report back

Return a concise machine-readable summary alongside the result document:

```text
source_sha: ...
source_tree: ...
native_app_control: PASS|FAIL|UNVERIFIED
file_library_default: PASS|FAIL|OBSERVED
browse_state: PASS|FAIL|UNVERIFIED
search_filter: PASS|FAIL|UNVERIFIED
selection: PASS|FAIL|UNVERIFIED
preview: PASS|FAIL|UNVERIFIED
responsive_native_window: PASS|FAIL|UNVERIFIED
keyboard_focus: PASS|FAIL|UNVERIFIED
narrator: PASS|FAIL|UNVERIFIED
display_scaling: PASS|FAIL|UNVERIFIED
p0_p1_findings: <count>
p2_findings: <count>
p3_findings: <count>
implementation_recommendation: NONE|ACTIVATE_BOUNDED_W6_04
release_acceptance_claimed: false
publication_authorized: false
```

## Non-negotiable truth rules

- A screenshot is evidence only for the state it actually shows.
- Native computer control is not proof of installer/reputation acceptance.
- Browser fallback is not native PASS.
- A missing fixture is `UNVERIFIED`, not assumed safe.
- Do not weaken or change product behavior while collecting evidence.
- Do not use Codex Review.
- Do not publish `v0.1.40`.
