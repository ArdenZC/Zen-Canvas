# Zen Canvas Project Status

Last verified: 2026-09-05

## Current baseline

- Default branch: `master`.
- W6-02 closeout merge / W6-03 implementation baseline: `master@8b1f665c2fe9658f39534ada3b898e7f0607f56d`.
- W6-02 validated production head before squash closeout: `78962d8a5fcdeb1df5cfb5b402efd116359ffae8`.
- W6-02 validated production tree: `4a3fa745f16401e5c5b52ad77a6e208cbd767674`.
- W6-02 hosted production CI `33948599460`: **SUCCESS**.
- W6-02 final PR-head integration CI `33949133453`: **SUCCESS**.
- Current execution state: **ACTIVE — implementation**.
- W4 — Native Integration: **COMPLETE / CLOSED**.
- TD-014 — Cleanup Ledger Physical Identity Normalization: **COMPLETE / CLOSED**.
- W5 — Release / Hardening: **COMPLETE / CLOSED**.
- W6 — Product Maturity Audit: **ACTIVE — implementation**.
- W6-01 — Product Maturity Audit: **COMPLETE — PUBLIC RELEASE NOT RECOMMENDED; MATURITY WORK REQUIRED**.
- W6-02 — First Value & Recovery Maturity: **COMPLETE / MERGED**.
- W6-03 — Product Hierarchy & Progressive Disclosure: **ACTIVE — IMPLEMENTATION AUTHORIZED**.
- W6-01 overall maturity assessment before W6 implementation: approximately **2.9 / 5**.
- Public `v0.1.40` publication: **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED**.
- Published GitHub release: none.
- Published Git tag: none.
- Package version remains `0.1.40`; W6-03 does not authorize a version change.
- Database schema: `35`.

## Current initiative

**W6 — Product Maturity Audit**

Status: **ACTIVE — implementation; W6-03 Product Hierarchy & Progressive Disclosure active**

Authority: [W6 initiative](initiatives/W6-product-maturity-audit.md).

Current task: [W6-03 Product Hierarchy & Progressive Disclosure Activation](tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-ACTIVATION.md).

Latest completed implementation result: [W6-02 First Value & Recovery Maturity Result](tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md).

Audit authority: [W6-01 Product Maturity Audit Result](tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md).

W6-03 is intentionally limited to product hierarchy and progressive disclosure. It does not authorize File Library command-bar/control-density redesign, durable authority changes, updater/signing work or public release.

## W6-02 accepted result

W6-02 is merged at `master@8b1f665c2fe9658f39534ada3b898e7f0607f56d`.

It closed first-value/root-recovery work while preserving the existing safety model:

- mandatory onboarding is privacy/local-first → useful folder, with no mandatory AI configuration;
- setup remains reopenable and does not permanently complete without a useful folder;
- completion routing respects background-indexing policy;
- slow database startup has announced intentional loading;
- database/view failures have retry/recovery and technical-detail disclosure;
- failed Overview can escape to Settings rather than looping into itself;
- cloud AI credential/consent behavior remains fail-closed.

## W6-03 owned maturity blockers

W6-03 owns the three remaining M1 areas from W6-01:

1. **Settings progressive disclosure** (`W6-M1-004`) — ordinary Settings currently exposes implementation architecture as peer taxonomy.
2. **AI product positioning** (`W6-M1-005`, remaining portion) — AI remains permanently visible in the sidebar and overly prominent in Settings relative to the file-lifecycle north star.
3. **Global product hierarchy** (`W6-M1-006`) — the shell still presents too many workspaces as equal persistent destinations.

W6-03 may also close the coherent Settings/About portion of `W6-M2-002` by moving developer/build internals behind progressive disclosure.

## W6-03 implementation truth

The activation authorizes:

- reducing persistent sidebar peer destinations when existing contextual/Settings/command entry points remain truthful;
- keeping AI sidebar status only when AI is enabled or an actionable failure exists;
- simplifying ordinary Settings navigation away from the current 11 peer sections;
- subordinating Global Index/provider health, Platform Diagnostics and managed-scope architecture behind user-intent, troubleshooting or developer disclosure;
- removing raw build/search-exclusion internals from ordinary About while preserving developer access;
- adding compatibility mappings/reveal behavior so existing `requestSettingsSection(...)` deep links do not silently target hidden/missing content.

W6-03 must preserve:

- Settings ownership of AI provider/credential persistence;
- fail-closed cloud AI consent/credential activation;
- Global Index/backend managed-scope authority;
- Library/Browse authority separation;
- operation preview/journal/Safe Trash/Restore safety;
- Organization Plan review/Dry Run/execution gates;
- Global Search provider/order/no-source semantics;
- current accessibility and performance gates.

## Publication state

Current release state remains:

> **Validated / Packaged historical candidate; public publication deferred for product maturity.**

Historical W5 engineering evidence remains historical only. W6-02 changed production code, so no W5 exact-SHA artifact qualifies the current product state.

The [v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md) remains **DEFERRED / DO NOT EXECUTE**.

W6-03 completion will not itself authorize publication. W6-04 and W6-05 remain later evidence/re-entry Tracks.

## Strengths W6 must preserve

The maturity program continues to protect:

- Library/Browse authority separation;
- Query/selection scaling and stale-snapshot handling;
- Preview cancellation/fallback;
- Organization Plan review → Dry Run → execution gates;
- Cleanup Analysis/Finding → Preview → Safe Trash;
- Restore/recovery authority;
- Global Search ordering/no-source/IME semantics;
- local/cloud/provider consent boundaries, including fail-closed cloud AI credential activation;
- exact-SHA release qualification;
- large-library performance gates.

The objective remains a simpler, calmer product surface over these strengths, not a subsystem rewrite.

## W6 sequencing

### W6-02 — First Value & Recovery Maturity

**COMPLETE / MERGED.** Result: [W6-02 closeout](tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md).

### W6-03 — Product Hierarchy & Progressive Disclosure

**ACTIVE — IMPLEMENTATION AUTHORIZED.**

Authority: [W6-03 activation](tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-ACTIVATION.md).

### W6-04 — File Library Calm-Surface Polish

Later and conditional on fresh rendered review after global hierarchy changes.

### W6-05 — Public Release Experience & Native Acceptance

Later release re-entry Track after remaining maturity implementation closes.

## Supported product platform truth

- Windows is a supported product platform.
- macOS 13 or later on Apple Silicon is a supported product platform.
- Intel Macs are not product targets.
- Universal binaries are not product targets.
- Rosetta is not a product target.
- Linux is not a product target.
- SmartScreen/Gatekeeper/manual native acceptance remains **UNVERIFIED / EXPLICITLY DEFERRED**, not PASS.
- Accessibility certification is not claimed.

## First-release policy truth

The W5 distribution policy remains intended if/when maturity is later accepted:

- GitHub Releases manual distribution;
- Windows x64 NSIS;
- macOS 13+ Apple-Silicon DMG;
- no automatic/background update checks;
- no in-app updater;
- updater key/endpoint/manifest deferred;
- Windows Authenticode not provided;
- Apple Developer ID/notarization/stapling not provided.

W6 explicitly recommends **not** adding updater/signing/general feature breadth as a substitute for product maturity.

## Durable authority pointers

- Active initiative: [W6 initiative](initiatives/W6-product-maturity-audit.md).
- Current task: [W6-03 activation](tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-ACTIVATION.md).
- Latest implementation result: [W6-02 result](tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md).
- Maturity audit: [W6-01 result](tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md).
- Deferred publication action: [v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md).
- W5 publication-decision history: [W5-06 result](tasks/W5-06-RELEASE-CANDIDATE-PUBLICATION-DECISION-RESULT.md).
