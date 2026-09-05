# W6-05 — Whole-Product Native Experience Audit — Activation

Status: **ACTIVE / AUTHORIZED — evidence-only stage gate; production implementation not authorized**

Baseline: `master@ee1163fbf32f23cc95150adca4e1cb5a53081654`; tree `57dc0ac45810477c8477542512c3c65a60605fb9`.

Authority: [`../initiatives/W6-product-maturity-audit.md`](../initiatives/W6-product-maturity-audit.md)

Previous Track: W6-04 File Library Calm-Surface Review / Bounded Remediation — **COMPLETE / CLOSED**.

Codex/native execution brief: [`W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-CODEX.md`](W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-CODEX.md)

## Why this Track exists

W5 established strong engineering/release qualification and W6-02 through W6-04 closed several bounded maturity defects, but engineering maturity is not product maturity.

The governing product rule is:

> **CI GREEN != PRODUCT PASS.**

A feature can compile, pass unit/browser/contract tests and still be confusing, visually inconsistent, hard to discover, poorly responsive, awkward to operate or simply never exercised in real use.

W6-05 therefore performs one coherent **stage-level native/product audit** before broad redesign. This is not a requirement to run full native acceptance after every future task.

## Activation boundary

This Track authorizes:

- real Windows/Tauri whole-product use through Codex Computer Use;
- task-owned disposable fixtures and isolated app state;
- screenshots, manifests and evidence archiving;
- read-only source inspection when needed to explain observed behavior;
- controlled file mutations only inside disposable fixtures when required to truthfully exercise Organize/Cleanup/Safe Trash/Restore;
- capability classification and UX/visual findings for W6-06 and W6-08.

This Track does **not** authorize:

- production code changes;
- schema/dependency/workflow/version changes;
- opportunistic fixes while auditing;
- installer/SmartScreen/Gatekeeper/release-path acceptance;
- tag/GitHub Release/publication;
- signing/notarization;
- another Preview architecture;
- OCR/RAG/plugin/agent/AI feature breadth;
- Codex Review.

If a defect is found, record it. Only a separately authorized P0/P1 emergency remediation may interrupt this evidence-only boundary.

## Required read set

Before execution, read:

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
13. current user-facing source only as needed to explain observed behavior.

## Primary question

> If a real user opens the current Zen Canvas and tries to use it end to end, which major functions are genuinely usable and coherent, which are degraded, which fail, and which have never actually been verified?

The answer must come from real use, not from source existence or green CI.

## Evidence vocabulary

Every audited capability/state must end in exactly one of these four statuses:

- **PASS** — directly exercised in the real native app and usable within scope, with no material product defect observed;
- **FAIL** — directly exercised and blocked/broken/incorrect/unsafe;
- **DEGRADED** — directly exercised and basically functional, but with a material UX/visual/interaction/responsive/discoverability/capability defect;
- **UNVERIFIED** — not truthfully exercised or required host/fixture/capability was unavailable.

Do not promote source inspection, browser output, unit tests or assumptions into native `PASS`.

Findings use a separate severity field:

- **P0** — data loss, unsafe filesystem mutation or security-boundary failure;
- **P1** — core journey blocked or product cannot be used reliably;
- **P2** — material functional/UX/visual/accessibility degradation;
- **P3** — minor polish inconsistency.

## Native host and provenance

Windows is the primary W6-05 audit host because native Computer Use is currently available there.

Record exact:

- source SHA/tree;
- Windows edition/build/architecture;
- native executable/build provenance;
- display resolution/scaling;
- isolated app identifier/profile strategy;
- fixture roots;
- relevant pre-existing Zen Canvas services/processes and whether they were left untouched.

macOS remains `UNVERIFIED` unless a real supported Apple-Silicon host is genuinely available. A DMG artifact or browser view is not macOS native evidence.

## Screenshot / evidence requirement

Every core page/workflow reached must have at least one real native screenshot. Materially different states should have additional checkpoints.

Use a task-owned retained evidence directory such as:

```text
outputs/w6-05-native-audit/
  screenshots/
  manifests/
  notes/
  w6-05-native-audit-evidence.zip
```

The result must map audit rows to screenshot filenames and record the final ZIP SHA-256.

Disposable fixture data may be deleted at closeout; the screenshot/evidence archive must be retained for W6-06 visual review.

## Whole-product audit matrix

### A. Startup / onboarding / first value

Exercise where safely available:

- cold native launch and branded startup/loading feedback;
- first-run privacy and useful-folder flow through the real Windows picker;
- onboarding completion path;
- background-index-off/manual-scan routing if safely reproducible in isolated state;
- Getting Started re-entry;
- restart after completed onboarding;
- empty first-value state;
- startup/database failure + retry only if a safe isolated reproduction exists, otherwise `UNVERIFIED`.

### B. Shell / Overview

Exercise persistent navigation, Overview default/empty/loading/error/retry states reached safely, scan/root summaries, primary next-action clarity and transitions to/from File Library.

### C. File Library / Browse / Query / Selection

Exercise:

- Library default;
- Browse default/empty/open-location when genuinely available;
- Search / Spotlight entry;
- Filter apply/Clear;
- Sort;
- Saved Views when available;
- List/Grid;
- Context Panel;
- no selection;
- one selected item;
- **multiple selected items**;
- select-all-matching when exposed;
- focus/context preservation around contextual actions.

W6-04 explicitly left native multi-selection `UNVERIFIED`; W6-05 owns that gap.

### D. Quick Preview / pinned preview / representative formats

Use the existing first-party Preview architecture and cover, where representative fixtures are practical:

- image;
- PDF;
- Markdown;
- code/source;
- CSV;
- JSON;
- plain text;
- folder/directory behavior;
- unsupported/fallback content;
- previous/next navigation;
- close/return;
- pinned/context preview;
- loading/error/fallback transitions;
- sizing, chrome, typography and visual hierarchy.

A technically working Windows Preview may still be `DEGRADED` if the experienced product quality is materially poor. Capture those findings for W6-08.

Explorer Preview Handler is outside this Track's release-acceptance boundary.

### E. Organize Files / Organization Plan

Using only task-owned disposable files:

- enter Organize;
- create/generate the current supported plan;
- inspect plan hierarchy/explanation;
- Preview / Dry Run;
- cancel/back;
- execute one safe disposable-file plan if real execution is necessary to verify the feature;
- verify exact filesystem outcome and result/history state.

### F. Storage Cleanup / Safe Trash / Restore

Using only disposable files:

- cleanup analysis;
- finding/result details;
- Preview;
- Safe Trash when safe;
- verify post-action state;
- Restore;
- verify restored filesystem/product state;
- empty/no-finding/error/retry states when reached.

Any mutation escaping the exact fixture root is a stop condition.

### G. History / Automation / Rules

Exercise user-facing history and Automation/Rules entry/list/empty states plus safe create/edit/enable/disable behavior where isolated state permits it.

A surface that exists but cannot be truthfully exercised remains `DEGRADED` or `UNVERIFIED` based on direct observation.

### H. Settings / advanced surfaces

Open every current Settings section and record hierarchy, wording and availability, including:

- ordinary user-intent sections;
- Global Index;
- Managed Scopes;
- Platform Diagnostics;
- troubleshooting/developer disclosures;
- About;
- deep-link/reveal behavior where present.

Assess whether implementation architecture is appropriately disclosed rather than competing with ordinary tasks.

### I. AI states

Within existing consent/credential boundaries, exercise:

- AI disabled/default state;
- local AI only if genuinely configured/available;
- cloud credential-required state;
- provider/credential error only if safely reproducible in isolated state.

Never expose real credentials in screenshots/notes and never weaken gates to obtain a PASS. Unavailable local/cloud execution remains `UNVERIFIED`.

### J. Empty / loading / error / recovery

Maintain a separate state matrix for important empty/loading/error/retry/recovery states encountered across A-I. Deliberately exercise safe missing-data/no-result states where practical; do not manufacture unsafe backend corruption for screenshots.

### K. Theme / language / native width

Sample representative core surfaces across:

- Chinese / English;
- Light / Dark;
- Wide / Medium / narrowest practical supported native window.

At minimum include Overview, File Library, Quick Preview and Settings in enough combinations to reveal copy expansion, hierarchy and responsive inconsistencies.

### L. Windows keyboard / native interaction

Perform bounded smoke across major workflows:

- Tab / Shift+Tab and visible focus;
- Enter/Space activation on representative controls;
- Escape close/return for dialogs/popovers/Preview;
- supported search focus shortcut;
- real Windows folder picker;
- native resize/minimize/restore.

Narrator remains `UNVERIFIED` unless actually exercised. This Track does not claim accessibility certification.

## UX / visual review questions

For each core screenshot, record concise observations on relevant items:

- primary visual hierarchy and next-action clarity;
- spacing and typography consistency;
- control density;
- card/border overuse;
- radius/shadow consistency;
- icon sizing/alignment;
- toolbar/command-bar clarity;
- hover/selected/focus/disabled states;
- modal/popover/sheet behavior;
- empty/loading/error quality;
- wording consistency;
- technical-control overexposure;
- cross-surface consistency.

Do not redesign during W6-05. These are inputs to W6-06.

## Native-stage cost rule

W6-05 is itself the stage-level native gate.

- Complete one coherent whole-product audit against one recorded product baseline.
- Do not rerun the whole matrix after every finding.
- Record P2/P3 defects and continue where safe instead of fixing them in-session.
- Only a separately authorized P0/P1 safety blocker may justify immediate focused remediation/revalidation.
- Broad native regression after redesign belongs to W6-09, not each small PR.

## Safety rules

- Prefer isolated app state.
- Use disposable fixture roots for every file mutation.
- Never test destructive flows on personal/irreplaceable files.
- Snapshot fixture contents before mutation and verify after mutation/restore.
- Do not disable OS security globally.
- Do not fabricate external-volume/network/provider evidence with ordinary local folders.
- Redact credentials, tokens, personal paths/content and sensitive data from screenshots/results.

## Stop conditions

Stop the affected path and report if:

- exact provenance cannot be established;
- native Windows control is unavailable and only browser evidence remains;
- a P0 unsafe/data-loss/security condition appears;
- a mutation escapes the disposable fixture;
- the audit would require weakening a durable safety/consent boundary;
- the audit starts turning into production implementation;
- release-installer/reputation/signing work starts dominating the session.

Other unavailable scenarios become `UNVERIFIED`.

## Required output

Create `docs/project/tasks/W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-RESULT.md` containing:

1. exact source SHA/tree/environment;
2. fixture/isolation provenance;
3. complete PASS/FAIL/DEGRADED/UNVERIFIED matrix;
4. screenshot manifest + evidence ZIP SHA-256;
5. P0-P3 finding list;
6. user-journey friction map;
7. visual/UX inconsistency inventory;
8. source-visible functionality that remained `UNVERIFIED` in real use;
9. strengths to preserve;
10. explicit W6-06 design inputs;
11. explicit W6-08 Preview inputs;
12. final decision:
   - `W6-05 COMPLETE — PROCEED TO W6-06 DESIGN`, or
   - `W6-05 BLOCKED — EMERGENCY P0/P1 REMEDIATION REQUIRED`.

W6-05 completion does not silently activate W6-06; a separate activation is required.

## Publication state

Public `v0.1.40` remains **DEFERRED / DO NOT PUBLISH**.

No W6-05 evidence authorizes a tag, GitHub Release, signing/notarization action or release-path acceptance claim.
