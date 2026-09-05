# W6-02 — First Value & Recovery Maturity — Result

Status: **COMPLETE — ACCEPTED IMPLEMENTATION CANDIDATE**

Implementation baseline: `master@834c40a2bd51083bf3fa8e78bc9e04de2419a75d`

Validated production head: `78962d8a5fcdeb1df5cfb5b402efd116359ffae8`

Validated production tree: `4a3fa745f16401e5c5b52ad77a6e208cbd767674`

PR: `#192` — `feat(w6-02): mature first value and root recovery`

Hosted CI: `33948599460` — **SUCCESS**

Authority: [`W6-02-FIRST-VALUE-RECOVERY-MATURITY-ACTIVATION.md`](W6-02-FIRST-VALUE-RECOVERY-MATURITY-ACTIVATION.md)

Source audit: [`W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md`](W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md)

## Executive result

W6-02 closes the first-value and foundational recovery subset of the W6-01 maturity blockers without expanding Zen Canvas into another feature wave.

Accepted product changes:

1. **First-run is file-first.** Mandatory onboarding is now privacy/local-first → useful folder. AI provider configuration is no longer part of first-run.
2. **Setup is restartable.** A user who chooses “later” without a useful folder no longer receives a permanent setup-complete marker, and Getting Started remains reopenable from Overview.
3. **First-value routing is truthful.** If background indexing is enabled, useful setup completes into File Library. If `backgroundIndexOnStartup=false`, setup completes into Overview/manual scan rather than bouncing through an unindexed Library.
4. **Startup failure is a product state.** Slow database initialization receives delayed branded feedback with an announced live status; failure receives localized primary copy, authoritative Retry, troubleshooting guidance and separately disclosed technical details.
5. **View crashes are recoverable.** Retry resets the boundary. Failed non-Overview views can return to Overview; when Overview itself fails, the fallback routes to Settings instead of re-rendering the same failed view.

No schema, backend command, durable authority, filesystem mutation/recovery path, provider implementation, update/signing policy or release state changed.

## Finding disposition

### W6-M1-002 — first-run / first-value / one-way onboarding

**CLOSED by W6-02.**

Evidence:

- `src/components/OnboardingDialog.tsx` no longer contains AI settings/provider persistence;
- normal completion requires a useful configured folder;
- useful completion routes according to the existing indexing policy rather than promising an unusable Library state;
- no-folder “later” dismissal does not write `zc-onboarding-complete=true`;
- `data-getting-started` exposes a restartable Getting Started entry on Overview;
- mounted onboarding tests cover background-index-on Library completion, background-index-off Overview/manual-scan completion, no-folder dismissal/reopen and reopen after prior completion.

### W6-M1-003 — database/bootstrap and view failures are developer dead ends

**CLOSED by W6-02.**

Evidence:

- database initialization has an actual re-execution Retry path;
- raw database error text is secondary disclosure rather than primary copy;
- delayed startup copy is exposed through `role="status"`, `aria-live="polite"` and `aria-atomic="true"`;
- view-level errors can retry/reset and escape to a different safe surface;
- when Overview itself is the failed view, fallback routes to Settings instead of retrying the same failed Overview;
- raw view error text is separately disclosed;
- mounted recovery tests prove these paths.

### W6-M2-003 — blank startup before database readiness

**CLOSED by W6-02.**

A short delay keeps fast startup visually quiet. If initialization exceeds `DATABASE_BOOTSTRAP_LOADING_DELAY_MS`, Zen displays and announces an intentional branded loading state without invented progress percentages.

### W6-M2-004 — root failure language inconsistent with mature domain states

**CLOSED for the W6-02 root surfaces.**

Database bootstrap and view errors use shared recovery vocabulary under `src/i18n/maturityCopy.ts`, consumed by multiple root-level surfaces rather than component-local dictionaries.

### Mandatory-onboarding portion of W6-M1-005 — AI over-prominence

**CLOSED for mandatory first-run only.**

Onboarding no longer calls `getAISettings`, `listAIProviderPresets` or `saveAISettings`. The Settings-owned AI configuration path remains intact, and the previously verified fail-closed cloud credential/enablement behavior remains unchanged.

Persistent sidebar AI prominence and Settings information architecture remain W6-03 scope.

## Product behavior accepted

### First-run

- Step 1: local-first/privacy value and safety explanation.
- Step 2: choose a useful file folder.
- Normal completion is unavailable until a useful folder exists.
- With background indexing enabled, successful completion persists onboarding completion and routes to File Library.
- With background indexing disabled, successful completion persists onboarding completion and routes to Overview/manual scan.
- Choosing “later” without a folder leaves onboarding incomplete for future re-entry.
- Getting Started can be reopened from Overview, including after prior completion.

### AI boundary

- No AI settings are loaded during mandatory onboarding.
- No AI settings are persisted during mandatory onboarding.
- No cloud/local AI mode is chosen during first-run.
- Existing Settings/provider/credential authority is unchanged.

### Startup / database recovery

- Fast database initialization remains visually quiet.
- Slow initialization receives delayed loading feedback through a polite live status region.
- Failed initialization exposes a Retry that calls `tauriApi.initDatabase()` again.
- Troubleshooting and technical details remain secondary disclosures.

### View error recovery

- Retry resets the error boundary and retries the current view.
- A failed non-Overview view can navigate to Overview.
- A failed Overview routes to Settings as a distinct safe fallback instead of re-rendering the failed Overview.
- Technical error details are separately disclosed.
- AppShell retains its existing `ViewErrorBoundary key={view}` host seam; no second error/navigation authority was introduced.

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

Project current-truth/activation documentation is also changed in PR #192, but the exact production validation claim belongs to production head `78962d8a...`; later documentation-only successors do not replace that production evidence identity.

## Hosted validation evidence

Exact validated production head: `78962d8a5fcdeb1df5cfb5b402efd116359ffae8`.

Exact production tree: `4a3fa745f16401e5c5b52ad77a6e208cbd767674`.

CI run `33948599460`: **SUCCESS**.

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

Unrelated Rust/native/package lanes were skipped by the current risk router because this Track changes frontend/product surfaces without backend/native/package authority changes. Those skipped lanes are not represented as native PASS evidence.

## Review remediation

Three review findings were accepted and fixed before final production validation:

1. **Overview failure escape:** if Overview itself throws, fallback now routes to Settings rather than re-rendering the same failed view.
2. **Startup accessibility:** delayed database loading is announced through a polite live status region.
3. **Manual-index first value:** when startup background indexing is disabled, onboarding completes into Overview/manual scan instead of opening an unindexed Library.

All three review threads were replied to with evidence and resolved after CI `33948599460` succeeded.

## Visual / native verification boundary

W6-02 has mounted UI coverage plus the CI browser regression gates listed above.

This Track does **not** claim fresh native Windows/macOS onboarding screenshots, SmartScreen/Gatekeeper behavior, Narrator/VoiceOver, DPI/Retina or real native first-launch acceptance. Those remain explicitly unverified and belong to later W6-04/W6-05 evidence work.

No fresh public-release candidate is created by this closeout.

## Acceptance checklist

- [x] first-run is centered on file value rather than mandatory AI configuration;
- [x] useful normal completion requires a file folder;
- [x] completion destination respects the existing background-indexing policy;
- [x] no-folder dismissal does not permanently mark setup complete;
- [x] Getting Started is reopenable;
- [x] cloud AI is not auto-enabled or reinterpreted;
- [x] fast startup remains quiet;
- [x] slow startup gets intentional, announced feedback;
- [x] database Retry reruns authoritative initialization;
- [x] database raw error text is secondary disclosure;
- [x] view Retry resets the boundary;
- [x] view fallback escapes the failed surface, including when Overview itself fails;
- [x] root error technical details are disclosed separately;
- [x] focused mounted regressions exist;
- [x] legacy frontend/browser regression gates pass;
- [x] all review findings are resolved;
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

A later production Track requires its own branch, authorization and fresh validation. The historical W5 release-qualified SHA cannot qualify this changed product state.
