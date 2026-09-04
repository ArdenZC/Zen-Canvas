# W5-03 — Distribution / Update Strategy — Result

Status: **COMPLETE / CLOSED — FIRST RELEASE USES MANUAL DOWNLOAD / INSTALL; W5-04 NEXT / ELIGIBLE**

Activation merge: `master@3001c7b0a5224d3d2555d89f8eeb95e4335236fa`; tree `29a672b8746584003e3d28ce0691c603e1f9d367`.

Decision Track: [`W5-03-DISTRIBUTION-UPDATE-STRATEGY-CODEX.md`](W5-03-DISTRIBUTION-UPDATE-STRATEGY-CODEX.md).

## Decision

Zen Canvas will use a **manual-download/install update lifecycle for the first public release**.

W5-03 does **not** add an in-app updater, background update check, update endpoint, update manifest, updater signing key, updater artifacts, update UI or automatic install behavior.

Future published versions will remain discoverable/distributable through the canonical GitHub Releases surface unless a separately reviewed updater initiative later changes that policy.

No release/tag is created by W5-03.

## Why this is the correct first-release boundary

### 1. No updater capability exists today

Repository inspection on the W5-03 baseline found no:

- `@tauri-apps/plugin-updater` dependency;
- `tauri-plugin-updater` Rust dependency;
- updater plugin registration;
- updater `pubkey` / `endpoints` configuration;
- `createUpdaterArtifacts` configuration;
- `latest.json` or equivalent updater manifest;
- production check/download/install updater flow.

The current package model remains Windows x64 NSIS + Apple-Silicon DMG. W5-02 already validated those artifact paths on the accepted release-hardening tree.

### 2. A Tauri updater would create a new long-lived trust/security lifecycle

Current official Tauri v2 updater documentation states that update signatures are required to verify updates and **cannot be disabled**. The updater model requires a public/private updater key pair; the private key signs update artifacts, and losing that key prevents publishing further updates to already installed users that trust it.

The same updater configuration introduces `createUpdaterArtifacts`, a public key, HTTPS update endpoints or a static update manifest, and platform-specific updater artifacts/signatures. See the official Tauri updater documentation: `https://v2.tauri.app/plugin/updater/`.

This updater signature is **not** Windows Authenticode, Apple Developer ID signing or Apple notarization. The accepted W4 no-production-signing decision therefore does not forbid it. However, it would still become a new durable release trust root/private-secret lifecycle and a new long-lived network/update subsystem.

Under the project governance rules, that is not a convenience change to smuggle into release hardening. It requires explicit ownership, recovery/rotation, endpoint, artifact, permission, version and rollback review before implementation.

### 3. There is no installed public population yet

Current release/tag state is none. No public Zen Canvas release currently exists, so there is no existing public installed population that needs automatic update delivery before the first release.

The first-release user outcome is satisfied by publishing the already-supported versioned installers through GitHub Releases after the later W5 publication decision.

### 4. A genuine cross-version updater fixture does not exist yet

W4/W5 evidence explicitly records cross-version macOS upgrade as `DEFERRED / NO REAL OLDER RELEASE FIXTURE`. W4 proved same-version DMG replacement for the frozen engineering artifact; it did not prove a real older-version → newer-version lifecycle.

Changing `0.1.40` solely to manufacture an artificial updater test would violate the W5-03 scope and would not create a genuine already-published installed population.

After the first real public release exists, that artifact can become an authentic older-release fixture for a later update/updater review.

### 5. Manual distribution reuses the release path already hardened by W5-02

`release-build.yml` already owns the future GitHub Release publication path for a version-matching `v*` tag after exact-SHA `CI Full Validation`. It builds, verifies and uploads:

- Windows NSIS;
- macOS Apple-Silicon DMG;
- SHA-256 checksum manifests;
- Node and Rust CycloneDX SBOMs.

The tag-triggered release job then re-verifies downloaded installer/version/checksum/SBOM/source binding before attaching the artifacts to a GitHub Release.

A first-release manual update/distribution policy therefore uses the existing hardened publication authority instead of creating a second update artifact/channel before it is needed.

## First-release distribution / update policy

When W5-06 later explicitly authorizes a public release:

### Canonical publication surface

- GitHub Releases is the canonical public distribution surface.
- A release is published only through the accepted tag/exact-SHA release pipeline.
- Release/tag state remains `none` until that later explicit publication occurs.

### Windows

- Supported artifact: versioned Windows x64 NSIS installer.
- Initial install is manual.
- Future manual updates use the newly published versioned installer.
- W5-03 does not claim a not-yet-tested real cross-version installer transition as PASS; later releases must validate the applicable older→newer lifecycle before making that claim.

### macOS

- Supported artifact: versioned Apple-Silicon DMG for macOS 13+.
- Initial install is manual.
- Future manual updates use the newly published DMG/application replacement flow.
- Existing W4 same-version replacement evidence remains valid only for the source/artifact it actually tested.
- Real cross-version replacement remains unverified until a genuine older public release fixture exists.

### Application behavior

For the first release:

- no automatic update check;
- no background update network request;
- no in-app update download;
- no in-app update install;
- no updater endpoint/manifest;
- no updater signing key;
- no automatic rollback/downgrade promise.

Release notes/download guidance must state that updates are manual until a future reviewed updater policy changes this fact.

## Future updater reconsideration trigger

An updater should be reconsidered only through a separate reviewed initiative/Track after the first release when there is concrete evidence that manual updates are insufficient.

At minimum, that review must have answers for:

1. **Product need** — what user problem requires in-app/automatic updates now?
2. **Real fixture** — which already-published older release is used for end-to-end upgrade/rollback acceptance?
3. **Update trust root** — who owns the updater private key, how is it backed up, and how are compromise/loss/rotation handled?
4. **Endpoint/manifest ownership** — where update metadata is published and how authenticity/freshness are controlled.
5. **Artifact model** — exact Windows/macOS updater bundle/signature formats and how they relate to the normal NSIS/DMG release assets.
6. **Privilege/install lifecycle** — including interaction with the current Windows per-machine install mode.
7. **Version and rollback policy** — upgrade/downgrade compatibility and schema/data expectations.
8. **Network/user behavior** — manual versus automatic checks, consent, failure/degraded states and user-visible policy.
9. **Release qualification** — how updater artifacts/signatures become exact-SHA release evidence without weakening W5-02.
10. **Architecture/governance** — whether the new long-lived updater/network/trust subsystem requires an ADR under current project rules.

Until those triggers are satisfied, updater state is:

`NOT IMPLEMENTED / DEFERRED BY FIRST-RELEASE PRODUCT DECISION`.

## Relationship to OS signing policy

W5-03 does not change the accepted W4 disposition:

- Windows Authenticode: not provided / intentionally deferred;
- Windows installer/Preview Handler production signing: deferred;
- Apple Developer ID: not provided / intentionally deferred;
- Apple notarization/stapling: not provided / intentionally deferred.

Tauri updater artifact signing is a separate update-authenticity mechanism. Because no updater is implemented for the first release, no updater key is created by this Track.

## W5-04 consequence

W5-04 remains necessary and becomes the next eligible Track.

The manual-first decision makes W5-04's real supported-platform acceptance path explicit:

- Windows: actual unsigned NSIS install/launch warning and manual lifecycle evidence, including truthful SmartScreen/Unknown Publisher behavior where observable;
- macOS: actual unsigned DMG copy/first-launch/Gatekeeper behavior on the supported Apple-Silicon target;
- selected native accessibility/display/provider evidence only where W5's existing matrix requires it and real fixtures are available;
- no updater UI/network acceptance is required because updater behavior is not part of the first release.

## Technical-debt consequence

W5-02's fresh exact-tree package evidence removes the specific package-evidence blocker recorded for TD-012 Build Assets. TD-012 is therefore no longer `blocked` on packaging evidence, but it is **not closed**: asset deletion still requires repository consumer/equivalence proof and should not preempt the release sequence.

No build asset is deleted by W5-03.

## Validation / evidence classification

W5-03 is a documentation/evidence/product-policy Track. It changes no production/runtime code, dependencies, package config, schema, version, platform support, tag or release.

The decision relies on:

- current repository dependency/config/code search;
- accepted W5-02 package/release-path evidence;
- accepted W4/W5 cross-version evidence limits;
- current official Tauri v2 updater requirements.

No updater PASS is claimed because no updater exists or ran.

## Resulting current truth

```text
W5 ACTIVE — implementation
W5-01 COMPLETE / CLOSED
W5-02 COMPLETE / CLOSED
W5-03 COMPLETE / CLOSED
First-release distribution = GitHub Releases + manual download/install
In-app updater = NOT IMPLEMENTED / DEFERRED
Updater key/endpoint/manifest = none
OS signing/notarization = intentionally deferred / not provided
Release none
Tag none
W5-04 Supported-Platform Manual Release Acceptance NEXT / ELIGIBLE — NOT YET ACTIVE
```
