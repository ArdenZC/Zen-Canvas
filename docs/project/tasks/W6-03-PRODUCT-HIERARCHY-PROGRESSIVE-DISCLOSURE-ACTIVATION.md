# W6-03 — Product Hierarchy & Progressive Disclosure — Activation

Status: **ACTIVE — IMPLEMENTATION AUTHORIZED**

Implementation baseline: `master@8b1f665c2fe9658f39534ada3b898e7f0607f56d`

Baseline tree: `24ba5b3622d55ad69a8bc8316e7f4bdf571acf52`

Parent initiative: [`../initiatives/W6-product-maturity-audit.md`](../initiatives/W6-product-maturity-audit.md)

Audit authority: [`W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md`](W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md)

Previous Track result: [`W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md`](W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md)

## Objective

Make Zen Canvas communicate one clear file-lifecycle product instead of a collection of equal engineering workspaces and subsystem controls.

W6-03 is a **hierarchy and disclosure Track**, not a feature Track. It should reduce permanent product chrome, group advanced capabilities under user intentions and preserve the mature backend/authority boundaries already established by W0–W6-02.

## Audit findings owned

W6-03 owns the remaining M1 maturity findings:

- `W6-M1-004` — Settings progressive disclosure;
- the remaining persistent-shell/Settings portion of `W6-M1-005` — AI product positioning;
- `W6-M1-006` — global product hierarchy.

W6-03 may also close the inexpensive Settings/About portion of `W6-M2-002` when doing so is coherent with the same progressive-disclosure work.

W6-03 does **not** own `W6-M2-001` File Library calm-surface/control-density polish; that remains W6-04 after fresh rendered review.

## Current evidence

### Sidebar

`src/components/AppShell.tsx` currently presents these persistent peer destinations:

- Overview;
- File Library;
- Organize Files;
- Storage Cleanup;
- History;
- Automation;
- Settings.

It also permanently renders `AIProcessingModeStatus`, including when AI is simply disabled or still loading. This gives an optional advisory capability persistent visual weight equal to the product's file-lifecycle surfaces.

### Settings

`src/views/settings/SettingsView.tsx` currently exposes **11 peer settings sections**:

1. General;
2. Appearance;
3. Files / Scan;
4. Search;
5. Global Index;
6. Platform Diagnostics;
7. Managed Scopes;
8. Automation;
9. AI;
10. Privacy;
11. About.

The audit specifically identifies Global Index, Platform Diagnostics and AI-managed scope/provider architecture as implementation concepts that should not remain equal ordinary preference categories.

`src/views/settings/sections/AboutSettingsSection.tsx` also exposes Developer Mode and development/build exclusions such as `node_modules`, `.git`, `target`, `dist` and `build` in the ordinary About surface.

### Existing compatibility seams

The implementation already has seams that W6-03 must preserve:

- `requestSettingsSection(...)` deep-links from shell/Overview/command flows;
- `SETTINGS_SECTION_EVENT` and `useSettingsNavigationController` own section focusing;
- Settings → Automation can navigate to the existing Rules workspace;
- `useAIProcessingModeStore` owns runtime AI status;
- Settings remains the durable AI provider/credential persistence authority;
- Global Index, managed-scope and platform capability controllers remain backend-authoritative.

W6-03 may change how these capabilities are presented, but must not create replacement authorities.

## Authorized product changes

### 1. Persistent shell hierarchy

W6-03 may reduce persistent sidebar destinations when a lower-frequency workspace already has a truthful contextual/settings/command entry.

The default shell should emphasize the core lifecycle:

- understand / Overview;
- find / File Library and global search;
- organize;
- clean up;
- recover / History.

Secondary configuration/automation capabilities may be removed from the peer-level navigation when their existing entry paths remain discoverable and tested.

### 2. Conditional AI chrome

The permanent AI sidebar card must no longer appear merely because AI is disabled or transiently loading.

Persistent AI status is justified when:

- AI is explicitly enabled (local or cloud); or
- AI is in an actionable failed state requiring user attention.

When AI is off and healthy, Settings/contextual AI entry points remain sufficient.

This rule must not weaken provider consent, credential gating or the W6-02 no-AI-onboarding contract.

### 3. Settings user-intent taxonomy

The ordinary Settings navigation should stop exposing platform/index/provider/managed-scope architecture as equal first-class preference concepts.

Preferred ordinary categories are user intentions such as:

- General;
- Appearance;
- Files;
- Search;
- Automation;
- AI;
- Privacy;
- About.

Technical Global Index/provider health, Platform Diagnostics and managed-scope architecture must be subordinated through progressive disclosure, contextual entry or developer/troubleshooting surfaces.

The exact implementation may group or conditionally expose those capabilities, but it must remain possible to reach actionable recovery/configuration paths without guessing hidden architecture.

### 4. About / developer disclosure

Ordinary About should prioritize product/version/project/privacy/support/update truth.

Developer mode, build/search-exclusion internals and other engineering diagnostics may remain available but should not be presented as ordinary peer content. Developer/troubleshooting disclosure is authorized.

## Compatibility requirements

### Settings deep links

Existing callers that request technical settings sections must not silently target a missing DOM node or leave the user at an unrelated section.

W6-03 must introduce an explicit compatibility mapping or reveal mechanism for section IDs that cease to be ordinary peer navigation items.

At minimum preserve truthful behavior for existing requests including:

- `settings-global-index`;
- `settings-files-scan`;
- `settings-ai`;
- `settings-search-scope` → Search compatibility;
- any existing platform/managed-scope direct requests found during implementation.

### Automation

If Automation is removed from persistent sidebar navigation, the existing `rules` view remains supported and reachable through Settings and command/deep-link surfaces. W6-03 does not delete the Automation capability.

### AI

- Settings remains the owner of `tauriApi.saveAISettings` and credential persistence.
- No automatic cloud enablement.
- No automatic credential use/send.
- No new AI provider or AI feature.
- Runtime status presentation may be reduced; runtime authority may not be duplicated.

### Filesystem / recovery / index authority

No change to:

- managed Library/Browse authority;
- Operation Preview / journal / Safe Trash / Restore;
- Organization Plan review/Dry Run/execution authority;
- Query/selection authority;
- Global Search provider/order/no-source semantics;
- Global Index backend authority;
- managed-scope backend authority.

## Explicit non-goals

W6-03 must not:

- redesign File Library command-bar/default chrome (`W6-04`);
- add new workspace features;
- change database schema;
- change filesystem mutation/recovery semantics;
- change AI provider/credential consent semantics;
- add updater/signing/notarization work;
- change package version;
- create a release/tag;
- claim native visual/accessibility acceptance.

Public `v0.1.40` remains **DEFERRED / DO NOT PUBLISH**.

## Implementation constraints

- Prefer deletion/consolidation/conditional rendering over adding more navigation controls.
- Preserve keyboard/focus semantics for Settings navigation.
- Preserve responsive horizontal Settings navigation behavior where applicable.
- Avoid a second settings-navigation authority; extend the existing controller/section request contract.
- Avoid component-local i18n dictionaries; use the shared i18n authority.
- Do not hide an actionable failure with no discoverable recovery route.
- Do not treat developer mode as a security boundary; it is presentation disclosure only.

## Required regression coverage

At minimum, add or update tests proving:

1. normal sidebar hierarchy no longer treats every workspace as a permanent peer;
2. Automation remains reachable after any persistent-nav reduction;
3. AI sidebar status is absent when disabled/healthy and visible when enabled or failed/actionable;
4. ordinary Settings nav no longer exposes Platform Diagnostics / Global Index / managed scopes as equal peer concepts;
5. technical section deep-link requests map/reveal to a truthful reachable surface rather than failing silently;
6. developer/troubleshooting content remains reachable after progressive disclosure;
7. About ordinary surface no longer exposes raw build/search exclusions by default;
8. Settings keyboard/focus/scroll behavior remains valid;
9. AI save/credential fail-closed contracts remain unchanged;
10. existing W2 browser/accessibility/performance gates remain green.

## Validation plan

Run focused tests first, then the repository-routed exact-head frontend integration gates. At minimum require successful evidence for:

- type/frontend tests and architecture contracts;
- frontend build;
- W2-01 real browser regression;
- W2-10 interaction/accessibility/responsive browser gate;
- W2-11 integrated experience/performance browser gate;
- current governance/source-evidence contracts.

Native/package lanes are not automatically required unless implementation unexpectedly crosses their ownership boundaries.

## Acceptance criteria

W6-03 is acceptable only when all of the following are true:

- the normal sidebar communicates a clearer core file-lifecycle hierarchy;
- optional AI no longer occupies permanent healthy-off chrome;
- Settings ordinary navigation is meaningfully simpler than the current 11-peer-section model;
- technical index/platform/managed-scope capability remains available without being normal first-class taxonomy;
- deep links and actionable repair paths remain truthful;
- Automation remains reachable if removed from persistent navigation;
- About no longer foregrounds developer/build internals;
- no durable authority or safety contract changes;
- focused and applicable full CI gates pass on the exact production head;
- current-truth docs are updated before merge;
- public release remains deferred.

## Closeout relationship

Closing W6-03 will close the remaining M1 hierarchy/progressive-disclosure implementation set only if evidence supports all three owned findings.

It will **not** itself authorize publication. W6-04 rendered File Library polish/review and W6-05 native/release re-entry evidence remain later work.
