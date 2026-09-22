# W6-09 Whole-Product Native Regression — Closeout Result

Status: **COMPLETE / CLOSED — OWNER WINDOWS NATIVE ACCEPTANCE PASS; SOLID / CALM WINDOWS VISUAL ACCEPTANCE PASS**

Track: Issue #241 / PR #242

This is the durable W6-09 closeout authority. It records the Owner-accepted
Windows result and the residual platform/release qualification work carried
explicitly into W6-10. It does not claim a full supported-platform native pass.

## Final disposition

**W6-09 WHOLE-PRODUCT NATIVE REGRESSION: COMPLETE / CLOSED**

- **WINDOWS PRODUCT/NATIVE ACCEPTANCE = PASS**
- **SOLID / CALM WINDOWS VISUAL ACCEPTANCE = PASS**
- **FULL SUPPORTED-PLATFORM NATIVE PASS = NOT CLAIMED**

W6-09 is allowed to close because the remaining unsupported or unverified
platform and release-qualification items are explicitly accepted as residuals
for W6-10. Public publication remains deferred. This record must not be
described as Windows + macOS native PASS or full supported-platform acceptance
PASS.

## Final identity

| Identity | Value |
| --- | --- |
| Activation baseline | `master@20781c8dc4dc8f24f0ed7d2ce860f5fd62d35ec9` |
| Activation baseline tree | `2535499a23be61786543bab19c71e35ee7a1d36f` |
| Accepted functional baseline | `88fc663392371049fda2d71b85bd4815d073bfe0` |
| Accepted functional baseline tree | `5ca511f055b02bb511bc0873ffc5c2a2d26efadf` |
| Final production / presentation candidate | `8fd246476e025636d4606a44d23688865ab89cc2` |
| Production candidate tree | `475a8d0e0295abbe37b3afa115738fa3602785e7` |
| Production CI | `35685110417 — SUCCESS` |
| Final closeout docs predecessor | `edb5a9e15f58955636efac09cc0203eec7163340` |
| Closeout predecessor tree | `a24ac277d5c38cbcea12b49e20710bc74d35ecb5` |
| Closeout-predecessor CI | `35690129230 — SUCCESS` |
| Owner evidence package SHA-256 | `43236C3E82ACF409261436E598EBE191EA048715CCCB2832C84795C705F0BEF8` |

The native evidence package is retained at:
`F:\CargoTarget\w6-09-solid-calm-owner-review-00787888.zip`.
The evidence is bound to the final production / presentation candidate above;
the closeout documentation successor does not reissue or broaden that native
evidence.

## Windows accepted results

The following exact-head Windows results were reviewed and accepted by the
Owner without reopening testing:

- Windows native UI / shell;
- Windows titlebar and caption controls;
- Files;
- adjacent Inspector;
- selected versus keyboard-focused distinction;
- Settings;
- Global Search;
- Automation surface;
- Solid / Calm presentation;
- Quick Preview floating and pinned states;
- PDF continuous pages 1/2/3;
- Markdown rendered document mode;
- image Preview;
- Loading;
- Failed;
- Details closed/open;
- pinned Preview source freeze while the background Files selection differs;
- Dark;
- Compact;
- Browse first-entry / native Choose Folder route;
- keyboard and focus contracts covered by the current evidence and tests.

These are Windows acceptance results only. They do not establish macOS GUI,
Forced Colors, a complete DPI matrix or release-binary native acceptance.

## Owner-accepted residuals for W6-10

### A. Windows DPI / scaling

**Status:** ACCEPTED RELEASE-QUALIFICATION RESIDUAL → W6-10

Normal and maximized native Windows states were observed. An explicit 100% /
125% / 150% matrix was not established. This is not a PASS.

### B. Windows Forced Colors

**Status:** ACCEPTED RELEASE-BLOCKING RESIDUAL → W6-10

**Current state:** UNVERIFIED. A real Windows Forced Colors native sweep was
not executed, although Issue #241 originally required it. W6-10 release
qualification must resolve or explicitly re-authorize this residual before
publication.

### C. Real macOS GUI

**Status:** ACCEPTED RELEASE-BLOCKING RESIDUAL → W6-10

**Current state:** UNVERIFIED because no real supported macOS GUI host was
available. This includes macOS native UI, traffic-light/titlebar visual
acceptance, Retina, fullscreen/restored behavior, the real Quick Preview /
Quick Look lifecycle seam and a representative macOS whole-product sweep.
Hosted macOS compile, performance and logic evidence is useful evidence but is
not GUI PASS.

### D. Release-path / release-binary native acceptance

**Status:** DEFERRED BY DESIGN → W6-10

**Current state:** UNVERIFIED / NOT ACCEPTED FOR PUBLICATION. Build success is
not native release-path acceptance.

### E. Narrator / VoiceOver

**Status:** ACCEPTED ACCESSIBILITY QUALIFICATION RESIDUAL → W6-10

Narrator and VoiceOver remain UNVERIFIED. No PASS is claimed.

### F. Reduced Motion

Only automated/CSS regression evidence is retained where applicable. It is not
upgraded to native manual PASS. Native manual smoke is carried into W6-10 if
still required.

### G. Organize / Cleanup / Restore mutation depth

Native surfaces and safety boundaries were observed, but no broad personal-file
mutation was authorized. Existing PARTIAL truth is retained, and disposable-
fixture release qualification is carried into W6-10 where applicable.

### H. First-launch / restart recovery

Existing PARTIAL / residual truth is preserved. Unresolved lifecycle
qualification is carried into W6-10.

### I. Organization Plan

Status remains ENVIRONMENT-SPECIFIC / accepted residual. Fail-closed behavior
is preserved, with supported release-environment qualification carried into
W6-10.

### J. Global Index

ACCEPTED DEFER / residual is preserved. No source readiness is claimed without
a real source; release-significant source/state qualification is carried into
W6-10.

### K. Browse recovery

Browse first-entry has valid native evidence and is accepted. Any remaining
first-scan or restart-recovery residual remains explicit and is carried into
W6-10.

### L. W6-08 Preview residual

Windows Quick Preview is accepted. The remaining macOS native portion is
covered by the macOS release-blocking residual above.

## Issue, PR and sequencing state

- Issue #241 remains **OPEN**.
- PR #242 remains **OPEN, non-draft and unmerged** pending the Owner merge
  decision.
- W6-10 remains **INACTIVE / NOT YET STARTED**.
- Publication remains **DEFERRED**.
- This closeout does not merge PR #242, close Issue #241, activate W6-10 or
  invoke Codex Review.

## Validation boundary

The final production candidate and its native evidence remain bound to their
recorded exact identities. The closeout successor is documentation-only.
Hosted CI `35690129230` passed the closeout predecessor, and the production
candidate CI `35685110417` passed the production candidate. Local closeout
validation is recorded on the final closeout commit.
