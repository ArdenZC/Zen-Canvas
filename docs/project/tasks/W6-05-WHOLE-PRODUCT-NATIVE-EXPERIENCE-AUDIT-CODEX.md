# W6-05 — Whole-Product Native Experience Audit — Codex Brief

Status: **STAGED — execute only after the activation/current-truth PR is merged to `master`**

Authority: [`W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-ACTIVATION.md`](W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-ACTIVATION.md)

This is **Codex Computer Use QA**, not Codex Review and not an implementation task.

## Mission

Use the real Windows/Tauri Zen Canvas like a user from first launch through the major product workflows. Produce a truthful functional + UX/visual evidence package before W6-06 redesign.

Do not change production source while auditing.

## R0 — Preflight: distinguish governance head from audited production source

1. Read the full activation and required read set from the **merged W6-05 governance head** on `origin/master`.
2. `git fetch origin master`.
3. Record the exact merged governance HEAD/tree and verify that current truth says W6-05 is active specification-only work.
4. Bind the audited production source to `ee1163fbf32f23cc95150adca4e1cb5a53081654` / tree `57dc0ac45810477c8477542512c3c65a60605fb9`.
5. Prove that the merged governance head differs from that audited production baseline only in documentation paths. If any non-documentation path differs, stop and report rather than silently auditing a different product source.
6. Keep the governance/current-truth worktree separate from the audited-product worktree or checkout. The governance head owns the task instructions/result document; the native app under audit must be built/run from the bound production source, or from an explicitly proven docs-only successor with the same production paths.
7. Require clean relevant worktrees before creating task-owned evidence/fixtures.
8. Record Windows build/architecture, display resolution/scaling and native executable/build path.
9. Record current Computer Use surfaces and confirm the real native application can be controlled.
10. If governance provenance, audited production provenance, docs-only-successor proof, or native application control cannot be established, stop and report rather than substituting browser evidence.

## R1 — Mandatory durable-state isolation and fixtures

Before launching into any flow that can persist onboarding, Settings, language/theme, managed scopes, rules, provider/AI state, database state or other user configuration, establish **one** safe state boundary:

### Preferred: verified isolated profile

Use a task-owned Tauri identifier/profile/data root and prove that it is not the normal user profile. Record the identifier and exact durable-state path(s).

### Fallback: bounded backup-and-restore

If an isolated profile cannot be created, enumerate every durable app-state root/file that the audit can touch, back it up before the first persistent action, record enough metadata/hashes to verify restoration, and define the exact restore procedure before continuing.

If neither verified isolation nor bounded backup-and-restore can be established, stop all persistent-state paths and mark them `UNVERIFIED`. A disposable filesystem fixture alone is not sufficient protection for normal app settings/database state.

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

Persistent onboarding or startup-state changes are allowed only after R1 isolation/backup is verified.

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

Create/edit/enable/disable actions are permitted only after R1 isolation/backup is verified. If a runtime dependency, safe state boundary or fixture is missing, record `UNVERIFIED` rather than claiming completion from UI presence.

## R10 — Settings / Global Index / Managed Scopes / Diagnostics / About

Open every current Settings section and advanced/developer/troubleshooting disclosure.

Screenshot representative ordinary Settings plus:

- Global Index;
- Managed Scopes;
- Platform Diagnostics;
- About;
- deep-link/reveal behavior where present.

Read-only inspection can proceed without changing values. Any persistent Settings/managed-scope mutation requires R1 isolation/backup first.

Record whether these surfaces are understandable for ordinary users or overexpose implementation architecture.

## R11 — AI states

Within existing consent/credential boundaries and only after R1 isolation/backup for any persistent provider-state mutation, exercise:

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

Changing theme/language is a persistent-state mutation and requires R1 isolation/backup first.

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

- merged governance execution SHA/tree;
- audited production SHA/tree;
- proof the governance successor was docs-only relative to the audited production baseline;
- durable-state isolation identifier/path, or backup/restore provenance and verification;
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

## R17 — Cleanup and durable-state restoration

Before finishing:

- close transient dialogs/popovers;
- stop only task-owned dev processes;
- delete disposable fixture data after verifying the intended final/restored state, unless the result explicitly needs a retained fixture and documents why;
- if R1 used backup-and-restore mode, restore every backed-up durable app-state root/file and verify restoration before declaring audit completion;
- if R1 used an isolated profile, remove or explicitly retain/document only the task-owned isolated profile; do not leave audit state mixed into the normal profile;
- retain the screenshot/evidence archive for W6-06;
- verify no production source changed;
- verify no user credentials or personal data entered the result/evidence;
- do not create a tag, GitHub Release or publication action.

## Final output to the product owner

Return a compact completion summary containing:

- merged governance SHA/tree;
- audited production SHA/tree;
- Windows/native control status;
- durable-state isolation/restore status;
- counts of PASS / FAIL / DEGRADED / UNVERIFIED rows;
- P0/P1/P2/P3 counts;
- evidence ZIP path + SHA-256;
- result document path/commit;
- whether production code changed (must be `No`);
- final W6-05 decision.
