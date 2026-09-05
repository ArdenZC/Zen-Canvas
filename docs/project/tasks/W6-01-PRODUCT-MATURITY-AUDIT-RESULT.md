# W6-01 — Product Maturity Audit — Result

Status: **COMPLETE — PUBLIC RELEASE NOT RECOMMENDED; MATURITY WORK REQUIRED**

Audit baseline: `master@85f30586447beaf08a175656e93578100835569f`

Production code inspected is unchanged from the W6 activation baseline except for project-current-truth documentation.

## Executive verdict

Zen Canvas is **engineering-mature in several deep subsystems but not yet product-mature enough for a credible public first release**.

The strongest evidence does not point to another feature wave. The repository already contains substantial File Library, Browse, Preview, Organize, Cleanup, Restore, Automation, search, platform and safety machinery. The maturity gap is concentrated in:

- first-run / first-value coherence;
- recoverability when foundational UI/runtime states fail;
- information architecture and progressive disclosure;
- over-prominence of AI and implementation concepts relative to the core file-governance story;
- density/complexity of some high-value workspaces;
- public-release help/support/native-manual evidence that is still incomplete.

The current product therefore should **not** execute the deferred `v0.1.40` publication action.

No new M0 filesystem/data-loss/security implementation blocker was identified by this source/spec audit. That is not equivalent to product release readiness.

## Product-direction anchor

The canonical Master Development Plan says Zen should be a calm, local-first, safety-oriented file lifecycle / file-governance workspace. It also states that complexity must be earned, implementation telemetry/provider internals/architecture metadata should not be exposed merely because the backend knows them, and failure must be treated as a product state.

W6 uses those principles as the maturity bar rather than treating feature count, test count or successful installers as product quality.

## Evidence boundary

This audit used current production source, executable-test contracts, the Master Development Plan, accepted W5 current truth/release evidence, and historical UI/UX V4.3 browser-render QA where it still describes current surfaces.

The available Computer Use environment still does not expose native app windows. This audit therefore does **not** claim a fresh native visual, SmartScreen, Gatekeeper, Narrator, VoiceOver or real first-launch PASS/FAIL.

Historical V4.3 browser-mock evidence established responsive/theme/language coverage and no horizontal overflow for exercised screens, but explicitly did not exercise native Tauri lifecycle and did not render the real first-run onboarding path. Visual scores are provisional where appropriate.

## Maturity scorecard

Scale: 1 = prototype/developer surface, 3 = usable but visibly pre-release, 5 = polished public-product standard.

| Dimension | Score | Confidence | Verdict |
| --- | ---: | --- | --- |
| North-star fidelity | 2.5 / 5 | medium-high | Deep file-governance capability exists, but the default product story is diluted by many peer workspaces, persistent AI status and architecture-flavored settings. |
| First-run / first-value | 2.0 / 5 | high | Onboarding can complete without a file source, can be permanently skipped, introduces AI before core value, and has a concrete Cloud AI persistence bug. |
| Core file journeys | 3.5 / 5 | high for source behavior | Library/Browse/Preview/Organize/Cleanup/Restore are substantial and safety-aware; complexity and handoffs still need product simplification. |
| Information architecture | 2.5 / 5 | high | Top-level navigation and 11 Settings sections expose too much product/system structure at once. |
| Interaction maturity | 3.5 / 5 | high for source/tests | Keyboard/focus/confirmation/cancellation contracts are strong in many surfaces, but foundational error recovery remains weak. |
| Visual/system consistency | 3.5 / 5 provisional | medium | V4.3 browser evidence shows shared primitives, responsive layouts and theme/language consistency; current native/first-run visual quality is not freshly observed. |
| Failure-state quality | 2.0 / 5 | high | Many domain-specific states are carefully modeled, but app/bootstrap and React view failures still collapse into developer-style dead ends/raw messages. |
| Performance/scale engineering | 4.0 / 5 | high | Existing 100k/1M/performance and exact-SHA release evidence is a major strength; perceived native UX still needs later observation. |
| Settings/lifecycle maturity | 2.5 / 5 | high | Settings are structurally well implemented but expose Global Index, Platform Diagnostics, AI-managed scopes and developer-facing concepts too prominently. |
| Platform fidelity | 3.0 / 5 | medium | Windows/macOS architecture and packaging are substantial; W5-04 native manual acceptance remains explicitly unverified. |
| Trust/safety/privacy | 4.0 / 5 | high | Explicit previews, Safe Trash/Restore, authority boundaries and AI consent controls are strong; communication can be simplified. |
| Public release experience | 2.0 / 5 | high | Packaging is ready, but native first-launch evidence, support/troubleshooting polish and product-maturity acceptance are not. |

Overall maturity assessment: **approximately 2.9 / 5 — strong pre-release engineering product, not yet a polished public first release.**

## Finding register

### W6-M1-001 — Cloud AI choice in onboarding persists as AI disabled

**Severity:** M1 — must improve before public release

**Surface:** onboarding / AI mode

**Evidence type:** current source

**Evidence:** `src/components/OnboardingDialog.tsx`; `src/store/useAIProcessingModeStore.ts`; `src/views/settings/SettingsView.tsx`

`OnboardingDialog.saveAIChoice()` selects an OpenAI-compatible preset for the `cloud` choice but writes `enabled: selectedAI === "local"`. Therefore Cloud AI is saved with `enabled: false`. `resolveAIProcessingMode()` treats any `enabled: false` settings as disabled.

The normal Settings path contains the expected behavior: selecting `cloud` produces `enabled: true` and a non-Ollama provider.

**Maturity impact:** first-run presents a meaningful product choice that does not produce the state the user selected. This damages trust in onboarding and makes the first-run contract internally inconsistent.

**Disposition:** **FIX.** Use the same mode-transition semantics as Settings and add a mounted onboarding regression test for disabled/local/cloud persistence.

**Later implementation Track required:** yes.

### W6-M1-002 — First-run can finish with no file source and onboarding becomes one-way

**Severity:** M1 — must improve before public release

**Surface:** onboarding → first value

**Evidence type:** current source + i18n

**Evidence:** `src/components/OnboardingDialog.tsx`; `src/i18n/dictionary.ts`; `src/views/fileLibrary/library/LibraryMode.tsx`

The folder step explicitly says a source may be added later. `Skip`, Escape, or finishing onboarding calls `dismiss()`, writes `zc-onboarding-complete=true`, closes onboarding and routes to Overview. No source requirement exists. Repository search found no user-facing reset/restart path for the onboarding completion key.

When Library has no indexed data, its primary action sends the user back to Overview rather than giving the Library itself a direct first-value setup flow.

**Maturity impact:** a new user can permanently exit the only guided setup without connecting any files, then arrive at a system/task dashboard with no content. The product allows a valid but low-value state to become the default first impression.

**Disposition:** **REDESIGN.** Keep skip available, but separate “dismiss this explanation” from “setup complete”; make adding/browsing a real location the first-value path, and provide a discoverable restart/Getting Started entry.

**Later implementation Track required:** yes.

### W6-M1-003 — Foundational failures are still developer-style dead ends

**Severity:** M1 — must improve before public release

**Surface:** startup / global view failure

**Evidence type:** current source

**Evidence:** `src/components/DatabaseBootstrapper.tsx`; `src/components/ErrorBoundary.tsx`

Database initialization failure renders a static title/message only. There is no retry, safe restart, troubleshooting entry, open-data-location action, copy-diagnostics action or user-oriented recovery route. The error concatenates `readableError(error)` directly into visible copy.

`ViewErrorBoundary` renders a hard-coded Chinese fallback plus raw `error.message`, with no retry/reset/navigation action and no shared i18n. Database initialization also returns `null` while pending, so cold-start bootstrap has no explicit product loading state.

**Maturity impact:** Zen carefully models domain failures inside advanced workflows, but a failure near the root of the application feels like a development build.

**Disposition:** **FIX / REDESIGN.** Add a shared fatal/recoverable application-state surface with localized copy, Retry, safe restart/navigation where possible, and a bounded diagnostics/support affordance. Do not expose raw internal error text as primary copy.

**Later implementation Track required:** yes.

### W6-M1-004 — Settings exposes implementation architecture as first-class product taxonomy

**Severity:** M1 — must improve before public release

**Surface:** Settings / information architecture

**Evidence type:** current source + i18n + canonical product principle

**Evidence:** `src/views/settings/SettingsView.tsx`; `src/views/settings/controllers/useSettingsNavigationController.ts`; `src/i18n/dictionary.ts`; `docs/project/MASTER_DEVELOPMENT_PLAN.md`

Settings has 11 first-class sections. User-facing section labels include `Global index & AI management`, `Platform diagnostics`, `AI-managed scopes`, plus separate Search, Files/Scan, Automation, AI, Privacy and About sections.

This conflicts with the Master Plan principle that complexity must be earned and that provider internals/architecture metadata/low-value controls should not be exposed merely because the backend knows them.

**Maturity impact:** Settings feels closer to an administration console for Zen's architecture than a calm preference surface.

**Disposition:** **SIMPLIFY / GROUP / PROGRESSIVELY DISCLOSE.** Keep capabilities, but reorganize around user intentions. Move platform diagnostics and low-level index/provider health behind Troubleshooting/Developer disclosure; make AI-managed scope subordinate to AI/privacy rather than a peer top-level setting.

**Later implementation Track required:** yes.

### W6-M1-005 — AI is more prominent than its role in the product north star warrants

**Severity:** M1 — must improve before public release

**Surface:** onboarding / sidebar / settings

**Evidence type:** current source + product-direction inference

**Evidence:** `src/components/OnboardingDialog.tsx`; `src/components/AppShell.tsx`; `src/views/settings/SettingsView.tsx`; `docs/project/MASTER_DEVELOPMENT_PLAN.md`

AI receives one of only three onboarding steps before the user has obtained core file value, a permanent status card at the bottom of the main sidebar, dedicated AI settings, and a separate AI-managed-scopes settings area.

The north star is file lifecycle/governance; AI is an advisory capability, not the product's primary value proposition.

**Disposition:** **SIMPLIFY / DEFER DISCLOSURE.** Remove AI configuration from mandatory first-run; surface it when the user invokes an AI-dependent capability. Keep sidebar status only when it is actionable or when AI is explicitly enabled.

**Later implementation Track required:** yes.

### W6-M1-006 — The product still lacks one obvious primary workflow hierarchy

**Severity:** M1 — must improve before public release

**Surface:** global shell / navigation

**Evidence type:** current source + historical UX evidence + product-direction inference

**Evidence:** `src/components/AppShell.tsx`; `docs/design/UI_UX_V4_3_EXECUTION.md`

The default sidebar presents Overview, File Library, Organize Files, Storage Cleanup, History, Automation and Settings as peer destinations.

V4.3 was explicitly created to move Zen from a feature-complete but fragmented interface toward a coherent product. The implementation is more integrated than before, but the shell still communicates a collection of workspaces rather than one dominant file lifecycle with contextual secondary actions.

**Disposition:** **REDESIGN / SIMPLIFY**, not feature expansion. Audit which destinations deserve persistent top-level navigation and which should become contextual actions, secondary navigation or progressive disclosure.

**Later implementation Track required:** yes.

### W6-M2-001 — File Library is functionally rich but default chrome is control-dense

**Severity:** M2 — important polish

**Surface:** File Library

**Evidence type:** current source + inference; fresh rendered review still needed

**Evidence:** `src/views/fileLibrary/FileLibraryWorkspace.tsx`; `src/views/fileLibrary/library/LibraryMode.tsx`

The shared command bar can expose Back, Forward, Library/Browse mode tabs, Navigation, target label, local search, source actions, List/Grid and Context. Library source chrome can additionally expose scope/health, View All, Switch Scan Directory, Saved Views manager, Tags manager, filter summary, clear filter, result count, selection count and select-all-matching.

**Disposition:** **VISUALLY REVIEW, THEN SIMPLIFY.** Preserve shortcuts and advanced access but establish a calm default hierarchy and move lower-frequency controls into contextual/overflow surfaces where appropriate.

### W6-M2-002 — About/Preferences still carries developer-facing content into the normal product surface

**Severity:** M2 — important polish

**Surface:** Settings → About

**Evidence type:** current source + i18n

**Evidence:** `src/views/settings/sections/AboutSettingsSection.tsx`; `src/i18n/dictionary.ts`

About contains a Developer mode switch and a visible Search Sources group listing development/build exclusions such as `node_modules`, `.git`, `target`, `dist`, and `build`. The version row is described as developer-facing information.

**Disposition:** **MOVE / HIDE.** Keep developer mode but place technical exclusions/build internals inside developer/troubleshooting disclosure. Use About for version, supported platforms, privacy/update truth, project/support links and diagnostics entry appropriate for ordinary users.

### W6-M2-003 — Startup has no explicit loading experience before database readiness

**Severity:** M2 — important polish

**Surface:** cold start

**Evidence type:** current source

**Evidence:** `src/components/DatabaseBootstrapper.tsx`

Before `initDatabase()` completes, the component returns `null`.

**Disposition:** **FIX.** Show a minimal branded/bootstrap state only when startup exceeds a short threshold; keep fast startup visually quiet.

### W6-M2-004 — Mature domain-state handling is inconsistent with root-level error handling

**Severity:** M2 — important polish

**Surface:** cross-product failure communication

**Evidence type:** current source

**Evidence:** `src/views/scanner/ScannerView.tsx`; `src/views/fileLibrary/library/LibraryMode.tsx`; `src/views/restore/RestoreView.tsx`; root error surfaces above.

Overview, Library and Restore distinguish nuanced states such as no source, partial, permission, reconciliation, retry exhaustion, stale snapshots and restore authority. Root-level bootstrap/view errors do not use the same recovery/state design language.

**Disposition:** **UNIFY.** Create one product-level state/recovery vocabulary and reuse it from bootstrap through advanced workflows.

### W6-M2-005 — Current native visual/accessibility evidence is insufficient for a maturity claim

**Severity:** M2 — evidence obligation, not observed product failure

**Surface:** Windows/macOS native shell and first launch

**Evidence type:** missing evidence

**Evidence:** W5-04 result; historical `UI_UX_V4_3_FINAL_QA.md`

Historical browser preview verified responsive width, light/dark and Chinese/English for many workspaces, but explicitly did not verify native Tauri lifecycle, real onboarding, DPI/High Contrast/Narrator, Retina/VoiceOver or native first-launch flows. W5-04 later remained explicitly deferred because Computer Use exposed browser only.

**Disposition:** **OBTAIN EVIDENCE LATER.** Require real native acceptance before the eventual public-release decision unless the product owner explicitly re-accepts the risk.

### W6-M3-001 — Do not add updater/signing/general feature breadth to solve maturity

**Severity:** M3 — later opportunity / explicit non-solution

**Surface:** release roadmap

**Evidence type:** W5 decisions + audit inference

The maturity findings are not caused by the lack of an in-app updater, signing/notarization infrastructure, OCR, RAG, plugin SDK, another Preview provider or another AI feature.

**Disposition:** **DEFER.** Preserve W5 manual-download/no-updater/no-sign truth until a later independent product/release decision demonstrates a need.

## Public-release Must Fix set

Release re-entry should require closure or explicit reviewed disposition of these M1 items:

1. **Onboarding AI correctness** — Cloud AI selection must persist truthfully and be regression tested.
2. **First-value path** — first run must guide the user to useful file value; onboarding must be restartable/discoverable.
3. **Root recovery UX** — database bootstrap and view-level fatal errors need localized, non-technical recovery paths.
4. **Settings progressive disclosure** — platform/index/provider/managed-scope architecture must stop appearing as equal first-class preference concepts.
5. **AI product positioning** — AI must be optional/contextual relative to the file lifecycle.
6. **Global product hierarchy** — the shell needs a clearer primary user journey and less peer-level workspace fragmentation.

M2 items should be addressed in the same Tracks where inexpensive, but should not independently expand scope into a long polish backlog.

## Simplify / Remove / Defer candidates

- Move Platform Diagnostics behind Troubleshooting/Developer disclosure.
- Merge/subordinate AI-managed scopes under the AI/privacy mental model instead of a peer Settings section.
- Remove AI mode configuration from mandatory onboarding; configure AI when first needed or through Settings.
- Make sidebar AI state conditional: enabled/problem/actionable rather than permanently visible when AI is off.
- Move build/search-exclusion internals out of normal About.
- Reduce default File Library chrome after a rendered review; preserve advanced controls via contextual/overflow surfaces.
- Re-evaluate persistent top-level navigation for Automation and some lifecycle workspaces while preserving commands/deep links.
- Defer updater/signing/new feature modules as unrelated to the current maturity blockers.

## Missing evidence register

The audit does not fabricate answers for:

- real Windows SmartScreen/Unknown Publisher first-install behavior;
- real macOS quarantine/Gatekeeper first-launch behavior;
- current native onboarding screenshots on supported platforms;
- Narrator/VoiceOver and native focus behavior;
- Windows DPI/High Contrast and macOS Retina/multi-display polish;
- real user usability observation for first-run and Library command density;
- post-W6 long-session native perceived-performance evidence if future changes materially affect those flows.

These are `UNVERIFIED`, not FAIL and not PASS.

## What is already mature and should be protected

W6 should avoid destabilizing strengths while simplifying the product:

- File Library managed/ephemeral authority separation;
- Library/Browse shared workspace model;
- Query/selection scaling and stale-snapshot handling;
- Preview cancellation/fallback architecture;
- Organize Plan → review → Dry Run → execution gates;
- Cleanup Analysis/Finding → preview → Safe Trash path;
- Restore/recovery authority and history modeling;
- operation previews and explicit destructive-action gates;
- Global Search `no_source`/partial/order/IME semantics;
- local/cloud/provider consent boundaries;
- exact-SHA CI/release qualification and package verification;
- performance gates and large-library engineering evidence.

The goal is to expose these strengths through a simpler product, not rebuild them.

## Recommended follow-up Tracks

### W6-02 — First Value & Recovery Maturity

Priority: **1**

Bounded scope:

- fix Cloud AI onboarding persistence;
- redesign onboarding completion/restart and first-location path;
- move AI setup out of mandatory first-run;
- add intentional startup/loading state;
- replace database/view dead ends with localized recovery/troubleshooting surfaces.

No navigation/settings-wide redesign belongs in this Track.

### W6-03 — Product Hierarchy & Progressive Disclosure

Priority: **2**

Bounded scope:

- simplify sidebar hierarchy;
- re-evaluate persistent AI status;
- simplify Settings taxonomy;
- move platform diagnostics/developer/build internals behind disclosure;
- keep all existing authority/safety behavior intact.

This Track should remove/consolidate before adding controls.

### W6-04 — File Library Calm-Surface Polish

Priority: **3, conditional on fresh rendered review**

Bounded scope:

- obtain current rendered Library/Browse screenshots at supported window sizes;
- determine which command-bar/source-chrome controls belong in the calm default;
- simplify visible hierarchy without removing keyboard commands or underlying capability;
- verify empty/loading/error/context/Preview transitions visually.

Do not activate until W6-03 establishes the global hierarchy direction.

### W6-05 — Public Release Experience & Native Acceptance

Priority: **after M1 implementation closes**

Bounded scope:

- current About/support/troubleshooting/release copy;
- real Windows/macOS first-install/launch/removal evidence;
- keyboard/screen-reader/display smoke where fixtures are available;
- final candidate exact-SHA Full Validation and installer evidence;
- explicit publication decision.

This is not permission to add an updater or signing infrastructure automatically.

## Release version/candidate recommendation

Do **not** reserve the historical `8b573772...` candidate as the eventual public release source. It remains an internal stable/release-qualified baseline only.

Because W6-02/W6-03 are expected to change production behavior/UI, the eventual public candidate must be a later exact SHA with fresh release evidence. The final public version should be chosen at release re-entry. Reusing `0.1.40` is acceptable only if no public tag/release exists and versioning policy deliberately chooses it; the old internal package number must not constrain maturity work.

## Release re-entry gate

A future publication decision should not be opened until:

1. W6-M1-001 through W6-M1-006 are closed or explicitly reclassified with evidence;
2. current first-run can reach useful file value without requiring knowledge of Zen's architecture;
3. root startup/view failures have actionable recovery UX;
4. global navigation/settings have a reviewed calm-default hierarchy;
5. a fresh rendered review confirms the main shell and File Library hierarchy after those changes;
6. the product owner explicitly accepts maturity;
7. a new exact candidate receives fresh Full Validation and release-installer evidence;
8. native manual gaps are either exercised or explicitly accepted again at that future decision.

## W6-01 final recommendation

> **DO NOT PUBLISH NOW. Proceed with W6-02 First Value & Recovery Maturity first.**

The audit finds no justification for a broad new feature Wave. Product maturity should come from correctness of first-run choices, a stronger first-value path, recoverable failure states, clearer hierarchy and aggressive progressive disclosure of advanced machinery.
