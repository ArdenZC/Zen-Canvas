# W5-06 — Release Candidate / Publication Decision — Codex Brief

Status: **AUTHORIZED WHEN THIS CLOSEOUT MERGES — DECISION ONLY / NO AUTO-PUBLISH**

Baseline candidate: `master@5f6dcc643bec099e3b011af97c046ebc53d2772a`; tree `c142ab0d10ad4217cdb1ff14e248da871b0f7c2f`.

## Objective

Make the explicit final W5 release-candidate/publication decision using the complete current evidence, including the deliberately unresolved W5-04 manual native GUI acceptance gap.

W5-06 is a decision Track. It must not silently publish merely because it is activated.

## Accepted upstream truth

- W5-01: complete / closed.
- W5-02: complete / closed; exact-SHA release qualification and publication safety gate accepted.
- W5-03: complete / closed; first public distribution model is GitHub Releases + manual Windows NSIS / Apple-Silicon DMG, with no updater.
- W5-04: closed by explicit product deferral; real native GUI/manual acceptance remains `UNVERIFIED` because the available Computer Use environment exposes browser only (`apps: []`).
- W5-05: not required / skipped for this decision pass because no evidence-derived long-session/performance trigger exists.

## Exact candidate evidence

- source: `5f6dcc643bec099e3b011af97c046ebc53d2772a`
- tree: `c142ab0d10ad4217cdb1ff14e248da871b0f7c2f`
- `CI Full Validation` run `33890392142`: SUCCESS
- `Build Release Installers` run `33893501841`: SUCCESS
- Windows workflow artifact: `Zen-Canvas-Windows`, id `9945343182`
- macOS workflow artifact: `Zen-Canvas-macOS`, id `9945180370`
- package version: `0.1.40`
- current Git tag: none
- current GitHub Release: none

## Required decision

W5-06 must choose exactly one of:

1. **HOLD PUBLICATION** — do not create a tag/release until real supported-host manual acceptance is completed; or
2. **ACCEPT RESIDUAL MANUAL-ACCEPTANCE RISK AND AUTHORIZE PUBLICATION** — explicitly acknowledge that SmartScreen/Unknown Publisher/Gatekeeper/native accessibility/focus/display paths remain unverified, then authorize a separate publication action bound to the accepted exact candidate.

No middle state may describe W5-04 as PASS.

## Publication constraints if authorization is selected

Any later publication action must:

- bind the tag to the exact reviewed candidate;
- satisfy the W5-02 exact-SHA `CI Full Validation` gate;
- use the accepted release-build workflow;
- preserve version/source/tag equality;
- publish the Windows x64 NSIS and Apple-Silicon macOS DMG plus checksums/SBOMs;
- state truthfully that Windows Authenticode is not provided;
- state truthfully that Apple Developer ID/notarization/stapling are not provided;
- not claim SmartScreen or Gatekeeper acceptance;
- not claim accessibility certification;
- not imply in-app updating exists.

## Non-goals

W5-06 does not authorize:

- new features;
- schema changes;
- signing/notarization implementation;
- updater implementation;
- version bump solely to manufacture release evidence;
- fabricated manual acceptance;
- unrelated technical-debt work.

## Expected output

Produce a short decision record containing:

- candidate SHA/tree;
- automated release evidence;
- W5-04 deferred manual evidence;
- W5-05 disposition;
- residual risks;
- final decision: `HOLD PUBLICATION` or `AUTHORIZE PUBLICATION WITH EXPLICIT ACCEPTED RESIDUAL RISK`;
- whether a separate publication action is authorized;
- final release/tag state after the decision.
