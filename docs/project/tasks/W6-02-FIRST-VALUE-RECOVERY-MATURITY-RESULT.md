# W6-02 — First Value & Recovery Maturity — Result

Status: **COMPLETE — ACCEPTED IMPLEMENTATION CANDIDATE**

Implementation baseline: `master@834c40a2bd51083bf3fa8e78bc9e04de2419a75d`

Validated production head: `b01bc30f4a1a98796ca9a51b0846cb4b73b5b7b5`

Validated production tree: `3946cf50b30a312dd13dd622359a4ac3439ae6b1`

PR: `#192` — `feat(w6-02): mature first value and root recovery`

Hosted CI: `33948034597` — **SUCCESS**

Authority: [`W6-02-FIRST-VALUE-RECOVERY-MATURITY-ACTIVATION.md`](W6-02-FIRST-VALUE-RECOVERY-MATURITY-ACTIVATION.md)

Source audit: [`W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md`](W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md)

## Executive result

W6-02 closes the first-value and root-recovery subset of the W6-01 maturity blockers without expanding Zen Canvas into another feature wave.

The accepted production candidate changes the product in four bounded ways:

1. **First-run is file-first.** Mandatory onboarding is now privacy/local-first → useful folder. AI provider configuration is no longer part of first-run.
2. **Setup is restartable.** A user who chooses “later” without a useful folder no longer receives a permanent setup-complete marker, and Getting Started remains explicitly reopenable from Overview.
3. **Startup failure is a product state.** Slow database initialization receives delayed branded feedback; database failure receives localized primary copy, authoritative Retry, troubleshooting guidance and separately disclosed technical details.
4. **View crashes are recoverable.** A captured React view error now offers localized Retry, Back to Overview and separately disclosed technical details instead of a hard-coded developer dead end.

No schema, backend command, durable authority, filesystem mutation/recovery path, provider implementation, update/signing policy or release state changed.

## Finding disposition

### W6-M1-002 — first-run / first-value / one-way onboarding

**CLOSED by W6-02.**

Evidence:

- `src/components/OnboardingDialog.tsx` no longer contains AI settings/provider persistence;
- normal completion requires a useful configured folder;
- useful completion routes directly to File Library;
- no-folder “later” dismissal does not write `zc-onboarding-complete=true`;
- `data-getting-started` exposes a restartable Getting Started entry on Overview;
- mounted onboarding tests cover useful completion, no-folder dismissal/reopen and reopen after prior completion.

This closes the product defect without requiring a new Browse/Library authority or forcing the user into AI configuration.

### W6-M1-003 — database/bootstrap and view failures are developer dead ends

**CLOSED by W6-02.**

Evidence:

- database initialization has an actual re-execution Retry path;
- the raw database error is no longer the primary user-facing message;
- troubleshooting and technical details are explicit secondary disclosures;
- view-level errors can reset/retry and navigate safely back to Overview;
- raw view error text is separately disclosed rather than serving as the primary explanation;
- mounted recovery tests prove retry/reset/navigation behavior.

### W6-M2-003 — blank startup before database readiness

**CLOSED by W6-02.**

A short delay keeps fast startup visually quiet. If initialization exceeds `DATABASE_BOOTSTRAP_LOADING_DELAY_MS`, Zen displays an intentional branded loading state without invented progress percentages.

### W6-M2-004 — root failure language inconsistent with mature domain states

**CLOSED for the W6-02 root surfaces.**

Database bootstrap and view errors now use a shared recovery vocabulary under `src/i18n/maturityCopy.ts`. This is a shared `src/i18n/` namespace consumed by multiple root-level surfaces, not component-local copy authority.

Broader product hierarchy/copy simplification remains W6-03/W6-04 work and is not claimed closed here.

### Mandatory-onboarding portion of W6-M1-005 — AI over-prominence

**CLOSED for mandatory first-run only.**

Onboarding no longer calls:

- `getAISettings`;
- `listAIProviderPresets`;
- `saveAISettings`.

The Settings-owned AI configuration path remains intact.

The previously verified fail-closed cloud behavior remains unchanged: W6-02 does not auto-enable cloud AI, configure credentials or weaken provider consent boundaries.

Persistent sidebar AI prominence and Settings information architecture remain active W6-03 scope.

## Product behavior accepted

### First-run

- Step 1: local-first/privacy value and safety explanation.
- Step 2: choose a useful file folder.
- File Library completion is unavailable until a useful folder exists.
- Successful completion persists onboarding completion and routes to `library`.
- Choosing “later” without a folder leaves onboarding incomplete and routes to Overview for the current session.
- Getting Started can be reopened from Overview, including after a previously completed setup.

### AI boundary

- No AI settings are loaded during mandatory onboarding.
- No AI settings are persisted during mandatory onboarding.
- No cloud/local AI mode is chosen during first-run.
- Existing Settings/provider authority is unchanged.
- Existing credential/fail-closed behavior is unchanged.

### Startup / database recovery

- Fast database initialization remains visually quiet.
- Slow initialization receives delayed loading feedback.
- Failed initialization exposes a Retry that calls `tauriApi.initDatabase()` again.
- Troubleshooting guidance remains available without the normal application navigation tree.
- Technical error text is disclosed separately.

### View error recovery

- Retry resets the error boundary and retries rendering the current view.
- Back to Overview resets the boundary and routes to `scanner` / Overview.
- Technical error details are separately disclosed.
- AppShell does not acquire a second view/error authority; its existing `ViewErrorBoundary key={view}` seam remains the host.

## Authority and compatibility paths

Preserved unchanged:

- File Library managed Query/selection authority;
- Browse ephemeral authority;
- Preview authority/cancellation;
- filesystem operation previews, journals, Safe Trash and Restore;
- Organization Plan / Dry Run authority;
- Analysis/Finding cleanup authority;
- Global Search ordering/no-source/IME semantics;
- AI Settings/provider/credential authority;
- database schema `35`;
- package version `0.1.40`.

The Phase 8 static release contract was intentionally updated: onboarding is now required **not** to call AI persistence APIs, while Settings remains required to own `tauriApi.saveAISettings`.

## Files changed in validated production candidate

Production/runtime:

- `src/components/OnboardingDialog.tsx`;
- `src/components/DatabaseBootstrapper.tsx`;
- `src/components/ErrorBoundary.tsx`;
- `src/i18n/maturityCopy.ts`.

Tests/contracts:

- `tests/onboardingDialog.test.tsx`;
- `tests/databaseBootstrapper.test.tsx`;
- `tests/viewErrorBoundary.test.tsx`;
- `tests/phase8ReleaseAudit.test.ts`.

Project-current-truth/activation documentation is also changed in PR #192, but the exact production validation claim above belongs to production head `b01bc30f...` before this docs-only closeout successor.

## Hosted validation evidence

Exact validated production head: `b01bc30f4a1a98796ca9a51b0846cb4b73b5b7b5`.

CI run `33948034597`: **SUCCESS**.

Observed successful gates include:

- Source checkout / evidence contract;
- Change scope / routing contract;
- project governance validation;
- Frontend tests and architecture checks;
- frontend build;
- W2-01 real browser regression gate;
- W2-10 interaction/accessibility/responsive browser gate;
- W2-11 integrated experience/performance browser gate;
- Performance profile aggregation;
- Windows quality aggregation;
- macOS quality aggregation.

The current risk routing correctly skipped unrelated Rust/native/package lanes because this Track changes frontend/product surfaces without backend/native/package authority changes. W6-02 does not reinterpret those skipped lanes as PASS evidence for native behavior.

## Direct review result

The final production diff was directly inspected for Track leakage.

No W6-03 scope was introduced:

- no sidebar hierarchy redesign;
- no Settings taxonomy redesign;
- no persistent AI status redesign;
- no File Library command-bar/control-density redesign.

No safety/authority expansion was introduced:

- no filesystem mutation path;
- no schema/persistence migration;
- no updater/signing path;
- no new provider;
- no cloud credential auto-activation.

The new recovery copy is centralized under `src/i18n/` and shared across root recovery components rather than embedded as separate per-component dictionaries.

## Visual / native verification boundary

W6-02 has executable mounted UI coverage plus the CI browser regression gates listed above.

This Track does **not** claim fresh native Windows/macOS onboarding screenshots, SmartScreen/Gatekeeper behavior, Narrator/VoiceOver, DPI/Retina or real native first-launch acceptance. Those remain explicitly unverified and belong to later W6-04/W6-05 evidence work.

No fresh public-release candidate is created by this closeout.

## Acceptance checklist

- [x] first-run is centered on file value rather than mandatory AI configuration;
- [x] useful normal completion requires a file folder;
- [x] successful setup routes directly to File Library;
- [x] no-folder dismissal does not permanently mark setup complete;
- [x] Getting Started is reopenable;
- [x] cloud AI is not auto-enabled or reinterpreted;
- [x] fast startup remains quiet;
- [x] slow startup gets intentional feedback;
- [x] database Retry reruns authoritative initialization;
- [x] database raw error text is secondary disclosure;
- [x] view Retry resets the boundary;
- [x] view fallback can return to Overview;
- [x] root error technical details are disclosed separately;
- [x] focused mounted regressions exist;
- [x] legacy frontend/browser regression gates pass;
- [x] no W6-03 hierarchy work leaked into this Track;
- [x] `v0.1.40` publication remains deferred.

## Deferred / still active maturity work

W6-02 deliberately does not close:

- `W6-M1-004` — Settings architecture is too exposed;
- the persistent sidebar/Settings portion of `W6-M1-005` — AI remains over-prominent outside first-run;
- `W6-M1-006` — shell/workspace hierarchy remains too fragmented;
- `W6-M2-001` — File Library calm-surface/control-density polish;
- `W6-M2-002` — About/developer content polish;
- `W6-M2-005` — fresh native visual/accessibility evidence.

Those remain the reason public release is still deferred.

## Closeout decision

> **W6-02 is complete. Do not publish. Next implementation priority is W6-03 Product Hierarchy & Progressive Disclosure, but W6-03 is not activated by this closeout.**

A later production Track will require its own branch, authorization and fresh validation. The historical W5 release-qualified SHA cannot qualify this changed product state.
