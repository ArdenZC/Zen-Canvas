# W6-03 — Product Hierarchy & Progressive Disclosure — Result

Status: **COMPLETE — ACCEPTED IMPLEMENTATION CANDIDATE**

Implementation baseline: `master@8b1f665c2fe9658f39534ada3b898e7f0607f56d`

Validated production head: `1efb17ef55b14a28b5372acbcfe4c809fc1d2229`

Validated production tree: `9e4c93011f330e108383f7ddcf71d478974244f3`

PR: `#193` — `feat(w6-03): simplify product hierarchy and progressive disclosure`

Hosted CI: `33956098213` — **SUCCESS**

Authority: [`W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-ACTIVATION.md`](W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-ACTIVATION.md)

Source audit: [`W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md`](W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md)

Previous implementation result: [`W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md`](W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md)

## Executive result

W6-03 closes the remaining M1 product-hierarchy/progressive-disclosure implementation set without changing Zen Canvas durable authorities or expanding the product into a new feature wave.

Accepted product changes:

1. **The persistent shell is quieter.** Automation is no longer a permanent sidebar peer, while the existing Rules workspace remains supported and reachable through Settings and command/deep-link paths.
2. **Healthy-off AI no longer occupies permanent chrome.** The sidebar AI status is absent while AI is disabled or transiently loading. Enabled local/cloud modes and actionable failure remain visible.
3. **Settings uses user-intent navigation.** Ordinary Settings navigation is reduced from 11 peer sections to eight visible categories: General, Appearance, Files, Search, Automation, AI, Privacy and About.
4. **Technical settings remain truthful but subordinate.** Global Index, Platform Diagnostics and Managed Scopes remain real sections and durable recovery/configuration surfaces, but are progressively disclosed rather than ordinary peer navigation items.
5. **Legacy/deep-link section requests remain compatible.** Technical requests still reveal and focus their truthful section while the navigation highlight maps to the canonical user-intent category.
6. **About no longer foregrounds developer/build internals.** Developer Mode and raw build/search-exclusion details are behind Advanced Settings; raw exclusions are only shown when developer mode is enabled.

No database schema, filesystem mutation/recovery authority, Global Index authority, managed-scope authority, AI provider/credential authority, package version, updater/signing policy or release state changed.

## Finding disposition

### W6-M1-004 — Settings progressive disclosure

**CLOSED by W6-03.**

Evidence:

- `settingsSectionModel.ts` defines one explicit section taxonomy and identifies `settings-global-index`, `settings-platform-diagnostics` and `settings-managed-scopes` as progressive sections;
- `SettingsSectionNav` filters those implementation-oriented sections out of ordinary peer navigation;
- the sections remain mounted, addressable and actionable;
- `SettingsSection` supports a real `details`-based progressive disclosure surface rather than deleting technical capability;
- compatibility tests cover reveal, navigation mapping, keyboard/focus and retained DOM targets.

### Remaining persistent-shell/Settings portion of W6-M1-005 — AI product positioning

**CLOSED by W6-03.**

Evidence:

- `shouldShowAIProcessingModeStatus(...)` renders persistent AI chrome only for `local`, `cloud` or `failed` states;
- healthy disabled/loading states render no sidebar AI card;
- Settings remains the provider/credential editing surface;
- existing AI save/credential fail-closed tests remain green;
- no automatic cloud enablement or credential activation was added.

### W6-M1-006 — global product hierarchy

**CLOSED by W6-03.**

Evidence:

- Automation is removed from persistent sidebar peers;
- core file-lifecycle destinations remain persistent;
- `RulesView` remains routed and Settings retains an Automation entry that opens it;
- command/deep-link compatibility remains covered;
- W2 browser interaction/accessibility/performance gates pass on the validated production head.

### Settings/About portion of W6-M2-002 — developer/internal presentation

**CLOSED for the W6-03 owned surface.**

Ordinary About prioritizes product-facing information. Developer Mode and raw build/search exclusions are subordinate to Advanced Settings, and raw exclusion details are only rendered when developer mode is explicitly enabled.

W6-M2-001 File Library calm-surface/control-density polish remains W6-04 scope.

Fresh native/manual evidence remains later W6-04/W6-05 work and is not converted into PASS by this Track.

## Product behavior accepted

### Persistent shell

- Overview, File Library, Organize, Storage Cleanup, History/Restore-oriented recovery and Settings remain the primary persistent hierarchy.
- Automation is not a permanent sidebar peer.
- The Rules workspace is not deleted.
- Settings → Automation continues to provide a truthful entry to Rules.

### AI status

- loading: no persistent sidebar card;
- disabled/healthy: no persistent sidebar card;
- local enabled: visible local status;
- cloud enabled: visible cloud status;
- failed/actionable: visible warning with Settings recovery path.

### Settings taxonomy and compatibility

Ordinary navigation exposes eight user-intent categories:

- General;
- Appearance;
- Files;
- Search;
- Automation;
- AI;
- Privacy;
- About.

Technical sections remain mounted and progressively disclosed:

- `settings-global-index` → canonical Search navigation;
- `settings-platform-diagnostics` → canonical Search navigation;
- `settings-managed-scopes` → canonical AI navigation;
- `settings-search-scope` → Search compatibility target.

A direct compatibility request reveals the retained technical disclosure, scrolls to the actual target section and focuses the truthful section heading rather than silently landing on an unrelated fallback.

### About / developer disclosure

- Developer Mode remains available.
- Developer Mode is presentation disclosure, not a security boundary.
- raw exclusions such as `node_modules`, `.git`, `target`, `dist` and `build` are not ordinary About content;
- those details remain reachable when Advanced Settings is opened and developer mode is enabled.

## Authority and safety boundaries preserved

Unchanged:

- managed Library/Browse authority separation;
- Query/selection authority;
- Preview cancellation/fallback architecture;
- Organization Plan review → Dry Run → execution authority;
- Cleanup Analysis/Finding → Preview → Safe Trash;
- operation journals and Restore;
- Global Search provider/order/no-source semantics;
- Global Index backend authority;
- managed-scope backend authority;
- AI Settings/provider/credential persistence authority;
- fail-closed cloud AI credential/consent behavior;
- database schema `35`;
- package version `0.1.40`.

## Files changed in validated production candidate

Production/runtime presentation and compatibility:

- `src/components/AppShell.tsx`;
- `src/views/settings/components/SettingsPrimitives.tsx`;
- `src/views/settings/controllers/useSettingsNavigationController.ts`;
- `src/views/settings/settingsSectionModel.ts`;
- `src/views/settings/sections/AboutSettingsSection.tsx`;
- `src/views/settings/sections/GlobalIndexSettingsSection.tsx`;
- `src/views/settings/sections/ManagedLibrarySettingsSection.tsx`;
- `src/views/settings/sections/PlatformDiagnosticsSettingsSection.tsx`.

Tests/contracts:

- `tests/appShellBehavior.test.ts`;
- `tests/appShellV4.test.ts`;
- `tests/modalInfrastructure.test.tsx`;
- `tests/settingsViewBehavior.test.tsx`;
- `tests/settingsViewUi.test.ts`;
- `tests/w6ProductHierarchy.test.tsx`.

Project current-truth/activation documentation also changes in PR #193. The exact production validation claim belongs to production head `1efb17ef...`; later documentation-only closeout successors do not replace that production evidence identity.

## Hosted validation evidence

Exact validated production head: `1efb17ef55b14a28b5372acbcfe4c809fc1d2229`.

Exact production tree: `9e4c93011f330e108383f7ddcf71d478974244f3`.

CI run `33956098213`: **SUCCESS**.

Observed successful gates include:

- Source checkout / evidence contract;
- Change scope / routing contract;
- Validation lane plan;
- Frontend tests and architecture checks;
- frontend build;
- W2-01 real browser regression gate;
- W2-10 interaction/accessibility/responsive browser gate;
- W2-11 integrated experience/performance browser gate;
- Performance profile aggregation.

Risk-routed native/package/Rust lanes that were not owned by this frontend hierarchy Track were skipped and are not represented as native PASS evidence.

## CI diagnosis and regression remediation

During final validation, the combined frontend quality step initially failed. A temporary diagnostic workflow split the four constituent commands and captured real exit codes/logs without weakening the repository gate.

The failure was isolated to three stale Vitest expectations created by the intentional W6-03 product hierarchy change:

1. an old AppShell behavior test still expected loading/disabled AI status to render;
2. an old AppShell v4 test still expected `rules` to remain a persistent navigation peer;
3. a Settings behavior test used an unscoped `querySelector("details")`, which began selecting the newly added Global Index progressive disclosure instead of AI Advanced Settings.

The tests were updated to the new authorized product contract; production behavior was not changed to satisfy stale assertions. The temporary diagnostic workflow was then removed. Clean exact-head standard CI `33956098213` completed successfully.

## Visual / native verification boundary

W6-03 has mounted UI coverage plus the repository browser regression/accessibility/performance gates listed above.

This Track does **not** claim fresh Windows/macOS native GUI acceptance, SmartScreen/Gatekeeper behavior, Narrator/VoiceOver acceptance, Explorer Preview Handler focus, DPI/Retina acceptance, installer first-launch acceptance or full accessibility certification.

Historical W5-04 manual/native evidence remains `UNVERIFIED / EXPLICITLY DEFERRED`; restored native Computer Use capability may allow later real-host evidence to be collected, but that evidence belongs to a fresh rendered/native Track and must be bound to the current product/candidate rather than retroactively changing W6-03 evidence.

## Acceptance checklist

- [x] normal sidebar communicates a clearer core file-lifecycle hierarchy;
- [x] Automation is removed from persistent peer navigation without deleting the capability;
- [x] healthy disabled/loading AI no longer occupies permanent sidebar chrome;
- [x] enabled or actionable-failure AI status remains visible;
- [x] ordinary Settings navigation is reduced from 11 peers to eight user-intent categories;
- [x] Global Index / Platform Diagnostics / Managed Scopes remain truthful reachable technical surfaces;
- [x] retained technical deep links reveal and focus the actual target;
- [x] Spotlight/settings compatibility remains covered;
- [x] Settings keyboard/focus/scroll behavior remains covered;
- [x] About no longer foregrounds raw build/search internals;
- [x] AI save/credential fail-closed contracts remain unchanged;
- [x] frontend build and applicable W2 browser gates pass on the exact production head;
- [x] no durable authority, schema, version or release-policy change was introduced;
- [x] public `v0.1.40` remains deferred.

## Deferred / next maturity work

W6-03 deliberately does not close:

- `W6-M2-001` — File Library calm-surface/control-density polish;
- fresh rendered product review after the global hierarchy change;
- fresh native Windows/macOS install/launch/accessibility/display acceptance;
- current-candidate SmartScreen/Gatekeeper/manual release-path evidence;
- a new public-release candidate decision.

These map to W6-04 and W6-05 rather than expanding W6-03.

## Closeout decision

> **W6-03 is complete. Do not publish. Next priority is W6-04 File Library Calm-Surface Polish, beginning with a fresh rendered review of the current product hierarchy. Fresh native/manual release acceptance remains a later W6-05 responsibility.**

No tag or GitHub Release is created by this closeout. The historical W5 release-qualified SHA does not qualify the changed W6 product state.
