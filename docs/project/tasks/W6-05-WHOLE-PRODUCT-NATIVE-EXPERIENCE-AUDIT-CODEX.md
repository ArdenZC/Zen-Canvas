# W6-05 — Whole-Product Native Experience Audit — Codex Brief

Status: **STAGED — execute only after the activation/current-truth PR is merged to `master`**

Authority: [`W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-ACTIVATION.md`](W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-ACTIVATION.md)

This is **Codex Computer Use QA**, not Codex Review and not an implementation task.

## Mission

Use the real Windows/Tauri Zen Canvas like a user from first launch through the major product workflows. Produce a truthful functional + UX/visual evidence package before W6-06 redesign.

Do not change production source while auditing.

## R0 — Preflight

1. Read the full activation and required read set.
2. `git fetch origin master`.
3. Require the exact active W6-05 `master` baseline stated in current truth.
4. Require a clean worktree before creating task-owned evidence/fixtures.
5. Record exact HEAD/tree.
6. Record Windows build/architecture, display resolution/scaling and native executable/build path.
7. Record current Computer Use surfaces and confirm the real native application can be controlled.
8. If the baseline is not exact or native application control is unavailable, stop and report rather than substituting browser evidence.

## R1 — Isolated audit state and fixtures

Prefer an isolated Tauri identifier/profile so normal user state is not overwritten.

Create disposable fixture roots containing representative harmless content needed by the audit, including where practical:

- folders and nested folders;
- TXT / Markdown;
- image;
- PDF;
- CSV;
- JSON;
- code/source files;
- duplicates or cleanup candidates designed specifically for the fixture;
- files suitable for a safe Organize plan.

Record a before-state manifest and hashes for any files that may be mutated.

Never use personal/irreplaceable files for Organize, Cleanup, Safe Trash or Restore.

## R2 — Evidence archive

Create and retain:

```text
outputs/w6-05-native-audit/
  screenshots/
  manifests/
  notes/
```

Name screenshots predictably, for example:

```text
A01-cold-launch.png
A02-onboarding-folder.png
B01-overview.png
C01-library-default.png
C02-library-multi-selection.png
D01-preview-image.png
H01-settings-general.png
...
```

Every core page reached must have at least one screenshot. Major materially different states should have additional screenshots.

At the end create:

`outputs/w6-05-native-audit/w6-05-native-audit-evidence.zip`

Record its SHA-256 in the result document.

Do not commit a large raw screenshot set to the repository unless repository policy explicitly permits it. The result document and manifest must make the retained archive locatable and auditable.

## R3 — Status discipline

For every matrix row use exactly one:

- `PASS`
- `FAIL`
- `DEGRADED`
- `UNVERIFIED`

Use `DEGRADED` when the feature basically works but has a material UX/visual/interaction/capability problem.

Do not use source existence, Vitest, Playwright or browser output to promote a native row to PASS.

If a state cannot be safely reached, use `UNVERIFIED` with the reason.

## R4 — Startup / onboarding / Overview

Exercise and screenshot the activation matrix for:

- cold launch/loading;
- first-run privacy/folder flow;
- first value;
- Overview;
- Getting Started re-entry;
- restart/completed onboarding;
- naturally reachable empty/loading/error/retry states.

Do not intentionally corrupt the user database. Isolated safe failure reproduction is optional; otherwise mark `UNVERIFIED`.

## R5 — File Library / Browse / Search / Filter / Selection

Exercise and screenshot:

- Library default;
- Browse default/empty/open-location when available;
- local search;
- filter apply + clear;
- sort;
- Saved Views when available;
- List/Grid;
- Context Panel;
- no selection;
- one selected item;
- **multiple selected items**;
- select-all-matching if exposed.

W6-04 failed to exercise multi-selection. W6-05 must either exercise it or explicitly leave it `UNVERIFIED`; do not silently omit it.

## R6 — Preview experience

Use the existing first-party Preview path and capture representative formats where practical:

- image;
- PDF;
- Markdown;
- code;
- CSV;
- JSON;
- text;
- directory/folder;
- unsupported/fallback case.

Also inspect:

- loading transition;
- sizing;
- typography/chrome;
- previous/next navigation;
- close/return;
- pinned/context preview;
- error/fallback behavior.

Treat experienced Windows quality as product evidence. A technically successful Preview can still be `DEGRADED`.

Do not test Explorer Preview Handler as if it were the flagship Zen preview experience.

## R7 — Organize Files

Using only disposable files:

1. enter Organize;
2. create the current supported plan;
3. inspect plan/reasoning hierarchy;
4. run Preview/Dry Run;
5. verify cancel/back behavior;
6. execute one safe plan only if required to verify the real feature;
7. verify the exact fixture outcome;
8. capture result/history state.

Stop immediately if a mutation targets anything outside the fixture boundary.

## R8 — Cleanup / Safe Trash / Restore

Using only disposable files:

1. run cleanup analysis;
2. inspect findings/details;
3. Preview the intended action;
4. Safe Trash a task-owned item when safe;
5. verify post-action filesystem/product state;
6. Restore it;
7. verify restored filesystem/product state.

Record empty/no-finding/error/retry states if reached.

## R9 — History / Automation / Rules

Exercise user-facing history and Automation/Rules surfaces.

Prefer safe create/edit/enable/disable actions against isolated/task-owned state. If a runtime dependency or fixture is missing, record `UNVERIFIED` rather than claiming completion from UI presence.

## R10 — Settings / Global Index / Managed Scopes / Diagnostics / About

Open every current Settings section and advanced/developer/troubleshooting disclosure.

Screenshot representative ordinary Settings plus:

- Global Index;
- Managed Scopes;
- Platform Diagnostics;
- About;
- deep-link/reveal behavior where present.

Record whether these surfaces are understandable for ordinary users or overexpose implementation architecture.

## R11 — AI states

Within existing consent/credential boundaries, exercise:

- disabled/default state;
- local state only if genuinely available;
- cloud credential-required state;
- provider/credential error only if safely reproducible in isolated state.

Never expose real credentials in screenshots or notes. Never weaken a gate to obtain evidence.

Unavailable execution remains `UNVERIFIED`.

## R12 — Theme / language / responsive samples

Capture enough representative combinations to reveal inconsistencies:

- Chinese / English;
- Light / Dark;
- Wide / Medium / Narrow practical native window.

At minimum include Overview, File Library, Quick Preview and Settings across representative combinations.

## R13 — Keyboard / Windows-native smoke

On the major workflows, exercise:

- Tab / Shift+Tab;
- visible focus;
- Enter/Space on representative controls;
- Escape close/return;
- `Ctrl+F` or supported search focus shortcut;
- real Windows folder picker;
- native resize/minimize/restore.

Narrator is `UNVERIFIED` unless actually controlled and observed. Do not claim accessibility certification.

## R14 — Visual / UX annotation

For every core screenshot add concise notes covering relevant items:

- visual hierarchy;
- next-action clarity;
- spacing;
- typography;
- control density;
- card/border overuse;
- radius/shadow consistency;
- icon alignment/size;
- toolbar/command bar clarity;
- focus/selected/disabled states;
- dialogs/popovers/sheets;
- empty/loading/error quality;
- wording consistency;
- technical-control overexposure;
- cross-surface consistency.

Do not modify Tailwind/classes/components during this audit.

## R15 — Finding handling

Assign P0/P1/P2/P3 separately from PASS/FAIL/DEGRADED/UNVERIFIED.

- P0/P1 safety/core-journey finding: stop the affected path and report immediately; do not broaden into an unapproved fix.
- P2/P3 finding: record it and continue the planned audit where safe.

Do not rerun the entire product after each finding. This Track is the stage-level native gate; broad native regression belongs to W6-09 after redesign/reconstruction.

## R16 — Result document

Create:

`docs/project/tasks/W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-RESULT.md`

It must include:

- exact provenance/environment;
- complete feature/state matrix;
- screenshot manifest;
- evidence ZIP location + SHA-256;
- P0-P3 findings;
- journey friction map;
- visual inconsistency inventory;
- `UNVERIFIED` functionality list;
- strengths to preserve;
- W6-06 design inputs;
- W6-08 Preview inputs;
- final decision required by the activation.

## R17 — Cleanup

Before finishing:

- close transient dialogs/popovers;
- stop only task-owned dev processes;
- delete disposable fixture data after verifying the intended final/restored state, unless the result explicitly needs a retained fixture and documents why;
- retain the screenshot/evidence archive for W6-06;
- verify no production source changed;
- verify no user credentials or personal data entered the result/evidence;
- do not create a tag, GitHub Release or publication action.

## Final output to the product owner

Return a compact completion summary containing:

- tested exact SHA/tree;
- Windows/native control status;
- counts of PASS / FAIL / DEGRADED / UNVERIFIED rows;
- P0/P1/P2/P3 counts;
- evidence ZIP path + SHA-256;
- result document path/commit;
- whether production code changed (must be `No`);
- final W6-05 decision.
