# Zen Canvas Project Status

Last verified: 2026-09-05

## Current baseline

- Default branch: `master`.
- W6-02 closeout merge / W6-03 implementation baseline: `master@8b1f665c2fe9658f39534ada3b898e7f0607f56d`.
- W6-03 validated production head: `1efb17ef55b14a28b5372acbcfe4c809fc1d2229`.
- W6-03 validated production tree: `9e4c93011f330e108383f7ddcf71d478974244f3`.
- W6-03 hosted production CI `33956098213`: **SUCCESS**.
- W6-03 PR: `#193` — implementation accepted; closeout/current-truth documentation in progress before merge.
- Current execution state: **W6-03 COMPLETE — ACCEPTED IMPLEMENTATION CANDIDATE; W6-04 NOT YET ACTIVATED**.
- W4 — Native Integration: **COMPLETE / CLOSED**.
- TD-014 — Cleanup Ledger Physical Identity Normalization: **COMPLETE / CLOSED**.
- W5 — Release / Hardening: **COMPLETE / CLOSED**.
- W6 — Product Maturity Audit: **ACTIVE — maturity implementation / evidence**.
- W6-01 — Product Maturity Audit: **COMPLETE — PUBLIC RELEASE NOT RECOMMENDED; MATURITY WORK REQUIRED**.
- W6-02 — First Value & Recovery Maturity: **COMPLETE / MERGED**.
- W6-03 — Product Hierarchy & Progressive Disclosure: **COMPLETE — ACCEPTED IMPLEMENTATION CANDIDATE**.
- W6-01 overall maturity assessment before W6 implementation: approximately **2.9 / 5**.
- Public `v0.1.40` publication: **DEFERRED — PRODUCT MATURITY NOT YET ACCEPTED**.
- Published GitHub release: none.
- Published Git tag: none.
- Package version remains `0.1.40`; W6 does not currently authorize a version change.
- Database schema: `35`.

## Current initiative

**W6 — Product Maturity Audit**

Status: **ACTIVE — W6-03 implementation accepted; next priority W6-04 rendered review / calm-surface polish**

Authority: [W6 initiative](initiatives/W6-product-maturity-audit.md).

Latest completed implementation result: [W6-03 Product Hierarchy & Progressive Disclosure Result](tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-RESULT.md).

Previous result: [W6-02 First Value & Recovery Maturity Result](tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md).

Audit authority: [W6-01 Product Maturity Audit Result](tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md).

W6-04 is the next intended Track but is not silently activated by the W6-03 closeout. Its scope begins with fresh rendered review of the changed hierarchy and is limited to File Library calm-surface/control-density polish without changing durable Library/Browse authorities.

## W6-03 accepted result

W6-03 closes the remaining M1 hierarchy/progressive-disclosure implementation set while preserving the safety model:

- Automation is no longer a permanent sidebar peer, while the Rules workspace remains supported through Settings and command/deep-link paths;
- healthy disabled/loading AI no longer occupies permanent sidebar chrome; enabled local/cloud and actionable failure states remain visible;
- ordinary Settings navigation is reduced from 11 peer sections to eight user-intent categories;
- Global Index, Platform Diagnostics and Managed Scopes remain real technical sections but are progressively disclosed rather than peer navigation items;
- legacy/deep-link requests reveal and focus the truthful retained technical section while mapping navigation highlight to the canonical user-intent category;
- About no longer foregrounds developer mode or raw build/search exclusions; those details remain behind Advanced Settings / developer disclosure;
- no durable filesystem/recovery/index/provider authority, schema, version, updater/signing policy or release state changed.

Exact production evidence is `1efb17ef55b14a28b5372acbcfe4c809fc1d2229`, tree `9e4c93011f330e108383f7ddcf71d478974244f3`, CI `33956098213` **SUCCESS**.

## W6-03 finding disposition

W6-03 closes:

1. **Settings progressive disclosure** (`W6-M1-004`).
2. **AI product positioning** (`W6-M1-005`, remaining persistent-shell/Settings portion).
3. **Global product hierarchy** (`W6-M1-006`).
4. The coherent Settings/About portion of **`W6-M2-002`** by moving developer/build internals behind disclosure.

W6-03 deliberately does not close:

- `W6-M2-001` — File Library calm-surface/control-density polish;
- fresh rendered review of the changed hierarchy;
- fresh native Windows/macOS install/launch/accessibility/display acceptance;
- current-candidate SmartScreen/Gatekeeper/manual release-path evidence;
- a new public-release candidate decision.

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

## Publication state

Current release state remains:

> **Validated product implementation; public publication deferred for product maturity.**

Historical W5 engineering evidence remains historical only. W6-02 and W6-03 changed production code, so no W5 exact-SHA artifact qualifies the current product state.

The [v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md) remains **DEFERRED / DO NOT EXECUTE**.

W6-03 completion does not authorize publication. W6-04 rendered product review/polish and W6-05 native/release re-entry remain later evidence Tracks.

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

**COMPLETE — ACCEPTED IMPLEMENTATION CANDIDATE.**

Result: [W6-03 closeout](tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-RESULT.md).

Validated production head: `1efb17ef55b14a28b5372acbcfe4c809fc1d2229`; CI `33956098213` **SUCCESS**.

### W6-04 — File Library Calm-Surface Polish

**NEXT — NOT YET ACTIVATED.** Begin only after W6-03 merge and a fresh rendered review of the changed hierarchy. The Track is hierarchy/polish only, not a Library/Browse authority rewrite.

### W6-05 — Public Release Experience & Native Acceptance

Later release re-entry Track after remaining maturity implementation closes. It owns fresh current-candidate native/manual acceptance, release-experience evidence, fresh exact-SHA qualification and a new publication decision.

## Supported product platform truth

- Windows is a supported product platform.
- macOS 13 or later on Apple Silicon is a supported product platform.
- Intel Macs are not product targets.
- Universal binaries are not product targets.
- Rosetta is not a product target.
- Linux is not a product target.
- Historical W5-04 SmartScreen/Gatekeeper/manual native acceptance remains **UNVERIFIED / EXPLICITLY DEFERRED**, not PASS.
- Browser/UI automation evidence must not be promoted into native GUI acceptance.
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
- Latest implementation result: [W6-03 result](tasks/W6-03-PRODUCT-HIERARCHY-PROGRESSIVE-DISCLOSURE-RESULT.md).
- Previous implementation result: [W6-02 result](tasks/W6-02-FIRST-VALUE-RECOVERY-MATURITY-RESULT.md).
- Maturity audit: [W6-01 result](tasks/W6-01-PRODUCT-MATURITY-AUDIT-RESULT.md).
- Historical deferred native/manual result: [W5-04 result](tasks/W5-04-SUPPORTED-PLATFORM-MANUAL-RELEASE-ACCEPTANCE-RESULT.md).
- Deferred publication action: [v0.1.40 publication action](tasks/RELEASE-0.1.40-PUBLICATION-ACTION.md).
- W5 publication-decision history: [W5-06 result](tasks/W5-06-RELEASE-CANDIDATE-PUBLICATION-DECISION-RESULT.md).
