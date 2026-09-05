# Zen Canvas v0.1.40 — Publication Action

Status: **AUTHORIZED AFTER W5-06 CLOSEOUT MERGES — NOT EXECUTED**

This is an operational publication action, not a new product initiative and not a feature Track.

## Immutable source

- tag: `v0.1.40`
- exact source commit: `8b573772d842b4996bc1c34161236fa47025cc83`
- source tree: `67cf3da35d7556bb868746a9ae0a56725558a163`
- package version: `0.1.40`

**Do not tag current `master` if it has advanced beyond this candidate.** The W5 release qualification evidence belongs to the exact source above.

## Required preflight

Before creating the tag:

1. confirm `v0.1.40` does not already exist;
2. confirm no GitHub Release `v0.1.40` already exists;
3. confirm `CI Full Validation` run `33942690517` is `completed / success` on the exact candidate;
4. confirm `Build Release Installers` run `33943755887` is `completed / success` on the same candidate;
5. confirm package metadata at the candidate is `0.1.40`;
6. confirm the accepted release workflow at the candidate binds tag/version/source equality and includes the #189 single-source SBOM fix;
7. confirm the workflow-dispatch evidence contains one Windows NSIS installer, one Apple-Silicon DMG, two checksum manifests and exactly two valid CycloneDX SBOMs;
8. confirm W5-06 result is merged and publication is authorized.

Accepted evidence identities:

- Windows artifact `Zen-Canvas-Windows`, id `9962868134`, digest `sha256:dc66010f193ed3eada2025ddbca61fb2d02dd9e635f00e1cb598b782f169346b`;
- Windows installer `Zen Canvas_0.1.40_x64-setup.exe`, 5,259,151 bytes, SHA-256 `22e1416f39b9f2847b907419400528208422aba1d32defa99e8aed21b0827711`;
- macOS artifact `Zen-Canvas-macOS`, id `9962728560`, digest `sha256:0fea6a1086cc4a4704298643b64a91b076e7a0d9aaa30f461bf3233f3337944a`;
- macOS installer `Zen Canvas_0.1.40_aarch64.dmg`, 4,516,903 bytes, SHA-256 `13f519199bbdf13c6242c0719e3a0358be0a9aa4263d2cb454864bf34441926f`;
- checksum manifests verified against both installers;
- exactly two CycloneDX 1.6 SBOMs verified: `sbom-node.cdx.json` and `sbom-rust.cdx.json`.

Any mismatch is fail-closed.

## Publication execution

The publication action is intentionally small:

1. create Git tag `v0.1.40` pointing exactly to `8b573772d842b4996bc1c34161236fa47025cc83`;
2. push/create that tag on GitHub;
3. allow the tag-triggered `.github/workflows/release-build.yml` workflow to run;
4. do not manually bypass its exact-SHA qualification gate;
5. wait for the complete tag-triggered workflow result before classifying the release state.

The workflow is expected to:

- require a successful exact-SHA `CI Full Validation`;
- build Windows x64 NSIS;
- build macOS 13+ Apple-Silicon unsigned DMG;
- generate one checksum manifest per platform;
- generate exactly one Node and one Rust CycloneDX SBOM from the Windows matrix lane;
- verify final downloaded artifacts/checksums/version/source/tag identity and exactly-two-SBOM contract;
- create the GitHub Release only for the tag-triggered run.

The workflow-dispatch evidence run intentionally skipped `Publish GitHub Release`; that skip is expected and is not publication evidence. Actual publication still requires the tag-triggered job to run successfully.

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
- exactly the required Node and Rust CycloneDX SBOMs are attached;
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
