# W6-10 — Release Re-entry Preflight

Status: **PREPARED / NOT ACTIVE**

This taskbook is the activation gate for W6-10. It does not itself activate
W6-10.

Authoritative qualification matrix:

- [W6-10 Release Re-entry Qualification Matrix](W6-10-RELEASE-REENTRY-QUALIFICATION-MATRIX.md)

## Current preparation baseline

- `master@1ee3e6930ee3a1c6f56d1f20932506357cc6deae`
- tree `b5f869a03d8fcdc6982cb02efde4755cbeeca4c2`
- W6-09: COMPLETE / CLOSED / MERGED
- W6-10: INACTIVE / NOT YET STARTED
- publication: DEFERRED
- public tag/release: must be rechecked at activation

## Why W6-10 exists

W5 established automated release engineering and packaging.

W6 established product maturity and accepted Windows product/native evidence.

W6-10 exists to close the remaining gap:

> release artifacts must be proven on real supported Windows and macOS hosts
> before a new publication decision.

The key change from W5 is that real macOS GUI / Quick Look and real Windows
display/accessibility release-path evidence are now first-class qualification
gates rather than broad manual deferrals.

## Planned track sequence

### W6-10A — RC Freeze

Freeze one exact candidate and release artifact identity.

No native acceptance before RC freeze counts as release acceptance.

### W6-10B — Windows Release Qualification

Real installed release artifact:

- install/first launch/restart/uninstall;
- core product;
- Zen Quick Preview;
- Explorer Preview Handler;
- 100/125/150 DPI;
- Forced Colors;
- Narrator/keyboard smoke.

### W6-10C — macOS Release Qualification

Real Apple Silicon macOS 13+ release app:

- DMG/Finder/Gatekeeper path;
- whole-product GUI;
- Zen Quick Preview under WKWebView;
- native Quick Look PDF lifecycle;
- Retina;
- traffic lights/fullscreen;
- trackpad/keyboard;
- VoiceOver and motion/contrast smoke.

A real Mac GUI host is mandatory for GO.

### W6-10D — Safety / Recovery

Disposable-fixture mutation/recovery and retained W6-09 residual qualification.

### W6-10E — Release Path / Artifacts

Exact artifact checksums, SBOMs, architecture/version and publication safety.

### W6-10F — GO / NO-GO

Only:

- RELEASE ACCEPTED; or
- RELEASE NOT ACCEPTED with concrete blockers.

Publication remains a separate explicit action.

## Activation prerequisites

Before W6-10A may start:

1. this matrix/preflight package is merged;
2. current `master` exact SHA/tree are re-read;
3. current package version is read from source;
4. `v0.1.40` and any replacement intended tag/release state are checked;
5. Windows native-control path is available;
6. a real supported Apple Silicon Mac GUI host is available or scheduled for
   the macOS lane;
7. release workflows remain fail-closed/exact-SHA qualified;
8. no unresolved P0/P1 project blocker is open.

If the Mac GUI host is unavailable, W6-10 may perform preparatory RC work but
must not issue GO.

## Scope guardrails

W6-10 does not authorize:

- new user-facing features;
- OCR/RAG/plugin/agent expansion;
- a second Preview engine;
- new durable filesystem/index/provider authority;
- visual redesign outside evidence-derived release defects;
- signing/updater infrastructure unless separately authorized;
- publication/tag creation before final GO.

## Candidate invalidation

Any production code/config/workflow change that affects the release candidate
creates a new RC.

The prior RC becomes historical evidence.

Only evidence unaffected by the change may be reused, and reuse must be
explicitly justified.

## Evidence handling

Windows and macOS must produce separate manifest-bound evidence packages.

Do not infer one platform from the other.

Do not infer release-binary behavior from dev builds.

Do not infer GUI behavior from hosted compile/tests.

## Stop conditions

Stop and return to Owner / ChatGPT if:

- baseline moves unexpectedly;
- release candidate identity is ambiguous;
- tag/release state conflicts with the intended version;
- release workflow exact-SHA qualification fails;
- a P0/P1 safety defect appears;
- native evidence cannot be truthfully obtained;
- fixing a defect would require broad product redesign.

## Next authorized step after this prep merges

Only a separate Owner instruction may activate:

> **W6-10A — Release Candidate Freeze**

W6-10B/C/D/E/F remain dependency-gated behind the RC identity.
