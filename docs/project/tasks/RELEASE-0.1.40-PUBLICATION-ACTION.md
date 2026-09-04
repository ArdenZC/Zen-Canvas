# Zen Canvas v0.1.40 — Publication Action

Status: **AUTHORIZED AFTER W5-06 CLOSEOUT MERGES — NOT EXECUTED**

This is an operational publication action, not a new product initiative and not a feature Track.

## Immutable source

- tag: `v0.1.40`
- exact source commit: `5f6dcc643bec099e3b011af97c046ebc53d2772a`
- source tree: `c142ab0d10ad4217cdb1ff14e248da871b0f7c2f`
- package version: `0.1.40`

**Do not tag current `master` if it has advanced beyond this candidate.** The W5-02 release qualification evidence belongs to the exact source above.

## Required preflight

Before creating the tag:

1. confirm `v0.1.40` does not already exist;
2. confirm no GitHub Release `v0.1.40` already exists;
3. confirm `CI Full Validation` run `33890392142` is `completed / success` on the exact candidate;
4. confirm package metadata at the candidate is `0.1.40`;
5. confirm the accepted release workflow exists at the candidate and still binds tag/version/source equality;
6. confirm W5-06 result is merged and publication is authorized.

Any mismatch is fail-closed.

## Publication execution

The publication action is intentionally small:

1. create Git tag `v0.1.40` pointing exactly to `5f6dcc643bec099e3b011af97c046ebc53d2772a`;
2. push/create that tag on GitHub;
3. allow the tag-triggered `.github/workflows/release-build.yml` workflow to run;
4. do not manually bypass its exact-SHA qualification gate;
5. wait for the complete tag-triggered workflow result before classifying the release state.

The workflow is expected to:

- require a successful exact-SHA `CI Full Validation`;
- build Windows x64 NSIS;
- build macOS 13+ Apple-Silicon unsigned DMG;
- generate platform checksum manifests;
- generate Node and Rust CycloneDX SBOMs;
- verify final downloaded artifacts/checksums/version/source/tag identity;
- create the GitHub Release only for the tag-triggered run.

## Public truth that must remain explicit

The first release is intentionally unsigned:

- Windows Authenticode: `NOT PROVIDED`;
- Apple Developer ID: `NOT PROVIDED`;
- Apple notarization: `NOT PROVIDED`;
- stapling: `NOT PROVIDED`.

The release must not claim:

- SmartScreen acceptance;
- Gatekeeper acceptance;
- accessibility certification;
- completed native/manual W5-04 acceptance;
- in-app updating or automatic update checks.

W5-04 native/manual evidence remains `UNVERIFIED / EXPLICITLY DEFERRED` by accepted product decision.

## Post-publication verification

Publication is complete only after all of the following are verified:

- tag `v0.1.40` resolves to the exact authorized candidate;
- tag-triggered `Build Release Installers` completes `success`;
- GitHub Release `v0.1.40` exists;
- Windows x64 NSIS installer is attached;
- Apple-Silicon DMG is attached;
- both checksum manifests are attached;
- required CycloneDX SBOMs are attached;
- release text does not claim signing/notarization or manual-acceptance PASS;
- `STATUS.md` is later updated from `AUTHORIZED / NOT YET EXECUTED` to the actual `Released` state only after these checks pass.

If the workflow fails after tag creation, preserve the failure evidence and do not describe the release as successfully published merely because a tag exists.

## Cleanup / rollback boundary

Do not delete or move a published tag/release automatically to hide a failed publication attempt.

If publication fails after tag creation:

- record the exact failed run and state;
- leave current truth explicit;
- decide any tag/release correction separately and deliberately.

No force-moving an existing public tag is authorized by this action.
