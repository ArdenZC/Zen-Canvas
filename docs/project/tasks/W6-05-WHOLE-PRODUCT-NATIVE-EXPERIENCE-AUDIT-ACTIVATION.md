# W6-05 — Whole-Product Native Experience Audit — Activation

Status: **STAGED — evidence-only activation; do not merge before W6-04 evidence archive closes**

Provisional stacked baseline: `docs/w6-04-file-library-rendered-review-result@bf9e9d1404572e47722d28cfde8c5ef05d9e79c8`, whose parent is merged W6-04 implementation `master@02d0f9712e41a374d91832c6061f0a78770c8c36`.

Before this activation merges to `master`, replace the provisional baseline above with the exact post-#196 `master` SHA/tree.

Authority: [`../initiatives/W6-product-maturity-audit.md`](../initiatives/W6-product-maturity-audit.md)

Previous Track: W6-04 File Library Calm-Surface Review / Bounded Remediation.

Codex/native execution brief: [`W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-CODEX.md`](W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-CODEX.md)

## Why this Track exists

W5 established strong engineering/release qualification, and W6-02 through W6-04 improved several bounded maturity defects. That does not prove that Zen Canvas is a mature product.

The current product-owner rule is:

> **CI GREEN != PRODUCT PASS.**

A feature may compile, pass unit/browser/contract tests and still be confusing, visually inconsistent, hard to operate, poorly responsive, weakly discoverable or insufficiently exercised in real use.

W6-05 therefore performs one coherent **stage-level native/product audit** before any broad redesign. It is deliberately not a per-task native QA policy.

## Activation boundary

This Track authorizes:

- real Windows/Tauri whole-product use through Codex Computer Use;
- disposable, task-owned fixtures needed to exercise product flows safely;
- screenshots and evidence capture;
- read-only source inspection when needed to explain an observed state;
- evidence classification, UX/visual findings and redesign inputs;
- controlled mutations only on disposable audit fixtures when required to truthfully exercise Organize/Cleanup/Restore flows.

This Track does **not** authorize:

- production code changes;
- schema/dependency/workflow/version changes;
- opportunistic bug fixes while auditing;
- installer/SmartScreen/Gatekeeper/release-path acceptance;
- a tag or GitHub Release;
- signing/notarization work;
- a new Preview architecture;
- new OCR/RAG/plugin/agent/AI breadth;
- Codex Review.

If a defect is found, record it. Do not repair it under W6-05 unless a separate emergency activation is required for a P0/P1 safety blocker.

## Required read set

Before executing the native audit, read:

1. `AGENTS.md`
2. `docs/project/MASTER_DEVELOPMENT_PLAN.md`
3. `docs/project/STATUS.md`
4. `docs/project/ROADMAP.md`
5. `docs/project/initiatives/W6-product-maturity-audit.md`
6. `docs/project/DEVELOPMENT_WORKFLOW.md`
7. `docs/project/CODE_MAINTAINABILITY.md`
8. `docs/project/tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md`
9. `docs/project/tasks/W6-04-FILE-LIBRARY-CALM-SURFACE-CLOSEOUT-RESULT.md`
10. `docs/project/tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-RESULT.md`
11. `docs/project/tasks/W6-04-FILE-LIBRARY-FILTER-POPOVER-REVALIDATION-RESULT.md`
12. `docs/project/tasks/W6-04-FILE-LIBRARY-RENDERED-REVIEW-ERRATA.md`
13. current user-facing implementation only as needed to explain observed behavior.

## Primary question

> If a real user opens the current Zen Canvas and tries to use the product end to end, which major functions are genuinely usable and coherent, which are degraded, which fail, and which have never actually been verified?

The answer must come from real use, not from the existence of source code or a green CI lane.

## Evidence status vocabulary

Every audited capability/state must end in exactly one of these four statuses:

- **PASS** — directly exercised in the real native app and usable within the stated scope, with no material product defect observed;
- **FAIL** — directly exercised and blocked/broken/incorrect/unsafe within the stated scope;
- **DEGRADED** — directly exercised and basically functional, but a material UX, visual, interaction, responsiveness, discoverability or capability defect remains;
- **UNVERIFIED** — not truthfully exercised, or required host/fixture/capability was unavailable.

Do not convert source inspection, browser evidence, unit tests or assumptions into a native `PASS`.

Descriptive notes may accompany a status, but they do not create extra status classes.

## Severity vocabulary for findings

Use a separate severity field for issues:

- **P0** — data loss, unsafe filesystem mutation or security boundary failure;
- **P1** — core journey blocked or product cannot be used reliably;
- **P2** — material functionality/UX/visual/accessibility degradation;
- **P3** — minor polish or low-impact inconsistency.

## Primary native host

Windows is the primary W6-05 audit host because current native Computer Use is available there.

Record exact:

- source SHA/tree;
- Windows edition/build/architecture;
- native app executable/build provenance;
- display resolution/scaling;
- app identifier/data-isolation strategy;
- fixture roots;
- whether any pre-existing Zen Canvas service/process was present and whether it was left untouched.

macOS product behavior must remain `UNVERIFIED` unless a real supported Apple-Silicon host is genuinely available during this Track. W6-05 must not substitute a package artifact or browser view for macOS native evidence.

## Screenshot requirement

Every core page/workflow listed below must have at least one real native screenshot when the surface is reached.

For major flows with materially different states, capture more than one checkpoint.

Create a task-owned evidence directory outside normal source files, for example:

`outputs/w6-05-native-audit/`

Recommended structure:

```text
outputs/w6-05-native-audit/
  screenshots/
  manifests/
  notes/
  w6-05-native-audit-evidence.zip
```

The result document must include a screenshot manifest mapping each audit row to one or more filenames and record a SHA-256 for the final evidence ZIP.

Do not silently delete the evidence archive at closeout; fixture data may be deleted, but the screenshot/evidence archive should be retained for W6-06 visual review.

## Whole-product audit matrix

### A. Startup / onboarding / first value

Exercise where safely available:

- cold native launch;
- branded startup/loading feedback;
- first-run privacy step;
- add/useful-folder flow through the real Windows folder picker;
- onboarding completion into File Library when background indexing is enabled;
- manual-scan/Overview routing when background indexing is disabled, if safely reproducible under isolated state;
- Getting Started re-entry;
- restart after completed onboarding;
- empty first-value state;
- startup/database failure and retry only if a safe isolated reproduction exists; otherwise `UNVERIFIED`.

### B. Shell / Overview

Exercise:

- persistent navigation hierarchy;
- Overview default state;
- scan root summary/status;
- primary next-action clarity;
- loading/empty/error/retry states that naturally occur or can be safely isolated;
- transition from Overview to File Library and back.

### C. File Library / Browse / Query / Selection

Exercise:

- Library default state;
- Browse default/empty state;
- Browse open-location path when genuinely available;
- search / Spotlight entry and local result behavior;
- Filter apply / Clear;
- Sort;
- Saved Views when available;
- List / Grid;
- Context Panel;
- no selection;
- one selected item;
- **multiple selected items**;
- select-all-matching affordance when safely exposed;
- return/focus/context preservation after contextual actions.

The W6-04 multi-selection gap is explicitly carried here and must not be skipped silently.

### D. Quick Preview / pinned preview / representative formats

Exercise the existing first-party Preview architecture, not a replacement architecture.

Where representative disposable files can be prepared, cover:

- image;
- PDF;
- Markdown;
- code/source;
- CSV;
- JSON;
- plain text;
- folder/directory behavior;
- unsupported/unavailable content fallback;
- previous/next navigation;
- close/return behavior;
- pinned/context preview;
- loading/error/fallback transitions;
- window sizing and visual hierarchy.

Record the experienced Windows Quick Preview quality even when functionality technically works. Material presentation/capability gaps may be `DEGRADED` and become input to W6-08.

Explorer Preview Handler is not the flagship Preview experience and is outside this Track's release acceptance boundary.

### E. Organize Files / Organization Plan

Using only task-owned disposable files:

- enter Organize Files;
- create/generate a plan through the current supported path;
- inspect plan hierarchy/explanation;
- Preview / Dry Run;
- cancel/back path;
- execute one safe disposable-file plan if the product requires real execution to verify the feature;
- result/confirmation state;
- verify actual fixture outcome;
- capture any recovery/history record produced.

Do not use personal files or broaden the plan beyond the disposable fixture.

### F. Storage Cleanup / Safe Trash / Restore

Using task-owned disposable files only:

- cleanup analysis;
- finding/result presentation;
- preview/details;
- Safe Trash action if safely supported by the fixture;
- post-action state;
- Restore;
- verify restored filesystem state;
- empty/no-finding state when available;
- error/retry behavior when naturally observed.

Any unexpected mutation outside the exact fixture root is a stop condition and P0/P1 investigation trigger.

### G. History / Automation / Rules

Exercise current user-facing surfaces for:

- history/operation records;
- discoverability and interpretation of previous operations;
- Automation / Rules entry path;
- list/empty state;
- create/edit/enable/disable behavior only where it can be done safely without affecting real user data;
- relevant result/error state.

If a feature is only partially reachable or its runtime dependency is unavailable, classify it `DEGRADED` or `UNVERIFIED` based on what was directly observed.

### H. Settings / advanced surfaces

Open every current Settings section and record hierarchy, wording and actual availability.

Include:

- ordinary user-intent Settings sections;
- Global Index;
- Managed Scopes;
- Platform Diagnostics;
- troubleshooting/developer disclosures;
- About;
- deep-link/reveal paths for advanced settings where present.

Assess whether implementation architecture is appropriately disclosed rather than competing with ordinary user tasks.

### I. AI states

Exercise only within existing consent/credential boundaries:

- AI disabled/default product state;
- local AI state if genuinely configured/available without changing durable authority;
- cloud AI selection/credential-required state;
- credential/provider error state only when safely reproducible in isolated audit data.

Do not insert or expose real user credentials in screenshots or committed notes. Do not weaken consent or credential gates to make a scenario pass.

Unavailable local/cloud execution remains `UNVERIFIED`.

### J. Empty / loading / error / recovery states

Across the product, maintain a separate state matrix for important surfaces.

At minimum record all empty/loading/error/retry/recovery states actually encountered during A-I, and deliberately exercise safe missing-data/no-result states where practical.

Do not manufacture unsafe backend failures solely for screenshots.

### K. Theme / language / window size

Sample the representative core surfaces across:

- Chinese;
- English;
- Light;
- Dark;
- Wide native window;
- Medium native window;
- Narrowest practical supported native window.

At minimum capture Overview, File Library, Quick Preview and Settings in enough combinations to reveal copy expansion, hierarchy and responsive inconsistencies.

### L. Windows keyboard / native interaction

Perform bounded keyboard/native interaction smoke for the major workflows:

- Tab/Shift+Tab through primary shell/workspace controls;
- visible focus sanity;
- Enter/Space activation for representative controls;
- Escape/close/return behavior for dialog/popover/preview surfaces;
- `Ctrl+F`/search focus behavior where supported;
- real Windows folder picker interactions;
- native window resize/minimize/restore smoke.

This is not full accessibility certification. Narrator remains `UNVERIFIED` unless actually exercised.

## UX / visual review questions

For every core screenshot, record concise observations on:

- primary visual hierarchy;
- spacing consistency;
- typography hierarchy;
- control density;
- border/card overuse;
- radius/shadow consistency;
- icon sizing/alignment;
- command bar/toolbar clarity;
- hover/selected/focus/disabled states;
- modal/popover/sheet behavior;
- empty/loading/error quality;
- wording consistency;
- whether the user knows the next action;
- whether advanced/technical controls are overexposed;
- whether the surface feels like the same product as adjacent workflows.

Do not redesign during W6-05. Record redesign inputs for W6-06.

## Cost-control / native-stage rule

W6-05 is itself the stage-level native gate.

Do **not** rerun the entire audit after every finding or after every future small implementation task.

During this Track:

- complete one coherent whole-product audit against one recorded product baseline;
- restart/relaunch only as required for state isolation or recovery evidence;
- record defects instead of fixing and repeatedly revalidating them;
- reserve focused immediate revalidation for a separately authorized P0/P1 safety blocker if one is found;
- otherwise defer broad native regression until W6-09 after the redesign/reconstruction batch.

## Safety / fixture rules

- Use an isolated app identifier/profile where practical.
- Use task-owned disposable fixture roots for any file mutation.
- Never test destructive Organize/Cleanup/Restore behavior on personal or irreplaceable files.
- Snapshot fixture contents before mutation and verify after mutation/restore.
- Do not stop or reconfigure unrelated installed services unless the audit explicitly requires it and the action is safe.
- Do not disable OS security globally.
- Do not fabricate external-volume/network/provider evidence with ordinary local folders.
- Redact credentials, tokens, personal paths/content and sensitive data from screenshots/results.

## Stop conditions

Stop the affected path and report immediately if:

- exact source/tree provenance cannot be established;
- native Windows control is unavailable and only browser evidence remains;
- a P0 data-loss/security/unsafe-filesystem condition appears;
- a mutation escapes the disposable fixture boundary;
- the audit would require weakening a durable safety/consent boundary;
- the audit starts turning into production implementation;
- a release-installer/reputation/signing task starts dominating the session.

Other unavailable scenarios should become `UNVERIFIED`, not a reason to invent evidence.

## Required output

Create `docs/project/tasks/W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-RESULT.md` containing:

1. exact source SHA/tree/environment;
2. fixture and isolation provenance;
3. complete capability/state matrix using only PASS/FAIL/DEGRADED/UNVERIFIED;
4. screenshot manifest and evidence ZIP SHA-256;
5. P0-P3 finding list;
6. major user-journey friction map;
7. visual/UX inconsistency inventory;
8. list of functionality that existed in source but remained `UNVERIFIED` in real use;
9. list of strengths to preserve during redesign;
10. explicit inputs for W6-06 Zen Visual System & UX Redesign;
11. explicit inputs for W6-08 Cross-Platform Quick Preview Experience;
12. a final decision:
    - `W6-05 COMPLETE — PROCEED TO W6-06 DESIGN`, or
    - `W6-05 BLOCKED — EMERGENCY P0/P1 REMEDIATION REQUIRED`.

W6-05 completion does not itself activate W6-06; a separate activation/current-truth update is still required.

## Publication state

Public `v0.1.40` remains **DEFERRED / DO NOT PUBLISH**.

No W6-05 evidence may create a tag, GitHub Release, signing/notarization action or release-path acceptance claim.
