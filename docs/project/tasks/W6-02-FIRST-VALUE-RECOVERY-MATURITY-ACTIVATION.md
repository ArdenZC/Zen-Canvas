# W6-02 — First Value & Recovery Maturity — Activation

Status: **ACTIVE — IMPLEMENTATION AUTHORIZED**

Baseline: `master@834c40a2bd51083bf3fa8e78bc9e04de2419a75d`

Authority: [`../initiatives/W6-product-maturity-audit.md`](../initiatives/W6-product-maturity-audit.md)

Source finding set: [`W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md`](W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md)

## Goal

Make the first minutes and foundational failure states of Zen Canvas feel like a deliberate public desktop product rather than a developer-oriented system surface.

W6-02 closes the W6-01 first-value and root-recovery findings without starting the later shell/Settings information-architecture redesign.

## Findings owned by W6-02

Primary:

- `W6-M1-002` — first-run can finish with no useful file source and onboarding is effectively one-way;
- `W6-M1-003` — database/bootstrap and view-level failures are developer-style dead ends.

Closely related M2 work allowed when needed for a coherent implementation:

- `W6-M2-003` — startup has no intentional loading experience before database readiness;
- `W6-M2-004` — root failure handling is inconsistent with mature domain-state handling.

AI scope is intentionally narrow. W6-02 may remove AI configuration from the mandatory first-run flow because `W6-M1-005` found AI over-prominent, but it must not redesign the persistent sidebar/Settings AI hierarchy; that belongs to W6-03.

## Required product behavior

### 1. First-value onboarding

- onboarding must emphasize the file-lifecycle value proposition and a useful location before optional advanced configuration;
- a user may still skip setup, but skipping must not falsely imply that useful setup has been completed forever;
- the product must expose a discoverable way to reopen Getting Started / first-run setup later;
- finishing setup should lead to an immediately useful file-oriented destination;
- when no managed scan root exists, the user must still have a direct path to browse or add a location rather than being bounced through unrelated dashboards;
- existing local-first/privacy messaging remains explicit.

### 2. AI boundary

- remove AI mode selection from mandatory onboarding;
- do not auto-enable cloud AI;
- do not weaken the existing fail-closed contract where cloud provider selection can remain disabled until credentials are configured;
- do not add provider credentials, model selection or AI architecture to first-run;
- AI configuration remains available through existing Settings/contextual entry points until W6-03 decides broader disclosure.

### 3. Startup loading

- database initialization should not leave an unexplained blank window on a slow start;
- avoid flashing a heavy loading screen during fast startup: use a short delay before showing the branded bootstrap state;
- loading state must use shared product styling/i18n where practical and must not invent progress percentages.

### 4. Database/bootstrap recovery

On database initialization failure, show a bounded user-facing recovery surface with at least:

- localized title and explanatory copy;
- Retry;
- a secondary troubleshooting/diagnostics affordance that does not depend on the normal failed navigation tree;
- technical details disclosed separately from primary copy rather than raw internal error text as the main message.

Retry must rerun the authoritative initialization path rather than only hiding the error.

### 5. View-level recovery

`ViewErrorBoundary` or its replacement must:

- use shared localized product copy;
- provide a retry/reset action for the failed view;
- provide a safe route back to a stable surface when retry is insufficient;
- hide raw error details behind an explicit technical-details disclosure;
- reset its captured error when the user requests retry/navigation so the boundary is not a permanent dead end.

## Non-goals

W6-02 does **not** authorize:

- shell-wide navigation redesign;
- Settings taxonomy redesign;
- persistent sidebar AI-status redesign;
- File Library command-bar/control-density redesign;
- updater/signing/notarization work;
- schema changes;
- new durable authorities;
- new AI providers/features;
- weaker AI credential/consent gates;
- filesystem mutation/recovery behavior changes.

## Expected implementation areas

Likely bounded files include:

- `src/components/OnboardingDialog.tsx`;
- `src/components/DatabaseBootstrapper.tsx`;
- `src/components/ErrorBoundary.tsx`;
- application shell/navigation context only where needed to expose Getting Started safely;
- `src/i18n/dictionary.ts`;
- focused tests for onboarding/bootstrap/error-boundary behavior.

If implementation requires broad changes to AppShell/Settings taxonomy, stop and move that work to W6-03 rather than expanding this Track.

## Test requirements

At minimum, executable tests must prove:

1. onboarding no longer requires or saves an AI choice as part of mandatory completion;
2. existing cloud-AI fail-closed persistence/credential semantics are not weakened;
3. first-run setup can be reopened after dismissal/completion;
4. finishing a useful location setup routes to a file-oriented destination;
5. no-location users retain a direct add/browse path;
6. database bootstrap retry actually invokes initialization again and can recover to children;
7. delayed startup state does not appear immediately on fast initialization;
8. database failure primary copy is localized and raw technical details are disclosed separately;
9. view error boundary retry resets the boundary and navigation fallback is available;
10. existing governance, typecheck and relevant UI tests remain green.

## Validation

Required before merge:

- `npm run test:governance`;
- `npm run test:docs` with the correct docs diff base/head;
- `npm run typecheck`;
- focused onboarding/bootstrap/error-boundary tests;
- CI-selected validation lanes for the production diff;
- direct diff review; no Codex Review.

## Exit gate

W6-02 may close only when:

- `W6-M1-002` and `W6-M1-003` are demonstrably closed by source + executable behavior;
- startup loading/recovery no longer presents a blank/developer dead end;
- AI has been removed from mandatory first-run without weakening consent/credential safety;
- Getting Started is discoverably reopenable;
- no W6-03 shell/Settings redesign has leaked into the Track;
- current project truth records the exact accepted implementation baseline.

Closing W6-02 does not authorize public release. W6-03 remains required for the active hierarchy/progressive-disclosure findings.
