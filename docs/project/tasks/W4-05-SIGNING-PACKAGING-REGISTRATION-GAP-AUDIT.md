# W4-05 — Signing / Packaging / Registration Gap Audit

Status: **AUDIT COMPLETE — MINIMAL IMPLEMENTATION SET IDENTIFIED**

Last verified: 2026-09-02

## Audit baseline

- W4-05 activation merge: `master@1c8b5f79d972f97f34fd402fd0e1850838f7e98e`.
- W4-04 accepted production tree inherited unchanged: `2b9146eaff9696867c1ba1c5649aec3b8ce831d0`.
- W4-04 final accepted Windows artifact: `9804066036`.
- W4-04 final accepted Windows installer SHA-256: `5E92A0397F876754F8F3CD06D92BF038364D5D5145DDB04A9EF42A006D973A5D`.
- W4-05 activation contract: [`W4-05-SIGNING-PACKAGING-REGISTRATION-ACTIVATION.md`](W4-05-SIGNING-PACKAGING-REGISTRATION-ACTIVATION.md).

This audit is read-only with respect to production behavior. It classifies the current repository and release pipeline before any W4-05 implementation is authorized.

## Classification vocabulary

- **ALREADY SATISFIED** — current accepted implementation/evidence already closes the W4-05 concern; do not reopen it.
- **IMPLEMENT** — a concrete repository/workflow/configuration gap remains and is authorized for the smallest later implementation.
- **CREDENTIAL-DEPENDENT** — production acceptance depends on an external signing/notarization identity that cannot be inferred from repository contents or GitHub's public API.
- **DEFERRED / W5** — belongs to final release publication/update-channel/release-hardening scope, not W4-05 implementation.
- **NOT APPLICABLE** — outside the accepted W4 product shape.

## Executive result

W4-05 is substantially smaller than W4-04.

The accepted Windows installer/registration product does **not** require another lifecycle/ownership remediation. The remaining repository implementation is concentrated in one release-signing integration layer:

1. replace the hard-coded unsigned-only release contract with explicit engineering-unsigned vs production-signed modes;
2. add artifact-specific Windows signature verification hooks and a production signing interface without committing credentials;
3. allow macOS Developer ID signing/notarization through Tauri's supported credential interfaces instead of forcing `--no-sign` in production-signed mode;
4. verify signed/notarized artifacts when that mode is requested;
5. keep unsigned `workflow_dispatch` engineering artifacts truthful and non-public;
6. keep tag/publication execution outside W4-05 acceptance and owned by W5.

Production credentials themselves are **not observable** from the connected repository interface. W4-05 must therefore separate `configuration implemented` from `real production credential acceptance` and must not fabricate PASS evidence.

## Current package/config truth

### Tauri bundle

Current `src-tauri/tauri.conf.json` records:

- bundle active;
- targets: `nsis`, `dmg`;
- Windows NSIS per-machine installation with the existing installer-hook authority;
- macOS minimum system version 13.0;
- macOS `hardenedRuntime: true`;
- no Windows `certificateThumbprint`, `timestampUrl` or `signCommand`;
- no macOS `signingIdentity`;
- no explicit macOS entitlements file.

The repository contains no standalone macOS Finder Preview Extension or other W4 native helper bundle requiring a newly introduced nested signing topology. W4-02's accepted native Quick Look path is Zen-internal and remains part of the main app/runtime architecture.

### Windows package composition

`src-tauri/tauri.windows.package.conf.json` adds the accepted Preview Handler DLL as a package resource and points to the reviewed NSIS lifecycle wrapper/template. No signing configuration is present there.

`scripts/buildWindowsPackage.mjs` builds/stages the Preview Handler, prepares the reviewed NSIS template and invokes `tauri build`; it contains no production signing step or signing credential interface.

### Release workflow

Current `.github/workflows/release-build.yml` already provides high-value package/provenance behavior:

- exact-SHA successful ordinary CI prerequisite;
- exact checkout and version/tag consistency;
- Apple Silicon runner verification;
- Windows NSIS packaging and W4-04 Preview/registry/service artifact-specific semantics;
- macOS DMG packaging;
- Node/Rust CycloneDX SBOMs;
- per-platform SHA-256 manifests;
- artifact upload;
- tag-only final artifact/checksum/SBOM verification.

But its signing truth is intentionally pre-W4-05:

- macOS packaging is forced through `npm run build -- --no-sign`;
- the release body declares `Distribution model: UNSIGNED`;
- Windows Authenticode, macOS Developer ID, Apple notarization and stapling are declared `OUT OF SCOPE`;
- it states signing/notarization is not a release blocker;
- no production signing credential variables or secret interfaces are referenced.

`tests/remediationContract.test.ts` explicitly freezes that unsigned-only contract and therefore must be updated as part of W4-05 implementation rather than treated as immutable governance.

## Official Tauri capability check

Tauri 2 supports the required integration without changing installer technology:

- Windows supports normal certificate-based signing via `bundle.windows.certificateThumbprint` / digest / timestamp configuration and custom `bundle.windows.signCommand` for managed signing services.
- macOS supports `bundle.macOS.signingIdentity` or `APPLE_SIGNING_IDENTITY`, CI certificate import through `APPLE_CERTIFICATE` / `APPLE_CERTIFICATE_PASSWORD`, and notarization credentials through either App Store Connect API-key variables or Apple-ID credentials.
- direct macOS distribution requires code signing and notarization; W4-05 may wire these interfaces without publishing a release.

Therefore no MSIX migration or alternative package framework is justified by the audit.

## Gap table

| Area | Current truth | Classification | W4-05 action |
|---|---|---|---|
| Windows NSIS lifecycle | Fresh/repair/uninstall, rollback, service/registry authority and in-use Preview DLL servicing accepted in W4-04 | **ALREADY SATISFIED** | None |
| Windows Preview registration | CLSID/AppID/Inproc/associations and foreign-state preservation accepted | **ALREADY SATISFIED** | None |
| Windows package architecture | x64 NSIS + packaged static-CRT Preview Handler accepted | **ALREADY SATISFIED** | None |
| Windows Authenticode design | Durable design plan exists, but no active workflow/config signing hook | **IMPLEMENT** | Add one production-signing interface and verification path; do not redesign NSIS |
| Windows signing credential | Not referenced by workflow; secret existence is not observable | **CREDENTIAL-DEPENDENT** | Define secret/interface names only; real signing remains UNVERIFIED until credential supplied |
| Windows timestamp/signature verification | Planned in docs, absent from active release workflow | **IMPLEMENT** | Verify exact signed binaries/installer with Authenticode/signtool in production-sign mode |
| Preview Handler DLL signing | DLL is packaged and dependency-verified but not production-signed by current pipeline | **IMPLEMENT + CREDENTIAL-DEPENDENT** | Ensure the packaged DLL is signed before NSIS consumes it when production-sign mode is active |
| Main Windows EXE signing | Current Tauri build has no active certificate/sign command | **IMPLEMENT + CREDENTIAL-DEPENDENT** | Use supported Tauri signing hook/config in production-sign mode |
| NSIS installer signing | Current artifact remains unsigned | **IMPLEMENT + CREDENTIAL-DEPENDENT** | Sign final installer and verify exact final bytes |
| `uninstall.exe` independent signing | Generated inside NSIS product; no separate proven signing hook in current pipeline | **NOT APPLICABLE for separate gate** | Do not invent a second uninstaller-signing system; preserve NSIS owner unless later evidence requires it |
| macOS hardened runtime | `hardenedRuntime: true` already configured | **ALREADY SATISFIED (configuration)** | Preserve |
| macOS Developer ID signing config | No signing identity / certificate interface in workflow; packaging forced `--no-sign` | **IMPLEMENT + CREDENTIAL-DEPENDENT** | Add production-sign mode using supported Tauri env/config; keep unsigned engineering mode truthful |
| macOS entitlements | No explicit entitlements file; no audit evidence that W4 native path requires extra entitlement | **NOT APPLICABLE / NO CHANGE NOW** | Do not add entitlements speculatively; revisit only on codesign/notarization evidence |
| macOS nested helper/extension signing | No W4 Finder extension or separately packaged native helper exists | **NOT APPLICABLE** | None |
| macOS notarization | No workflow integration; current build explicitly unsigned | **IMPLEMENT + CREDENTIAL-DEPENDENT** | Wire supported notarization credential interface and verify notarization/stapling in production-sign mode |
| macOS Gatekeeper/codesign verification | Not present in current release workflow | **IMPLEMENT** | Add artifact-specific verification after signed build; skip only in explicit engineering-unsigned mode |
| Windows installer/registration A/B matrix | Fully accepted W4-04 runtime evidence | **ALREADY SATISFIED** | Do not rerun unless signing changes product behavior |
| Genuine Explorer Preview acceptance | Accepted exact artifact/tree | **ALREADY SATISFIED** | Signing-only change requires only narrow signed-artifact sanity when credentials exist, not full A/B matrix |
| macOS native Quick Look runtime | W4-02 COMPLETE/CLOSED | **ALREADY SATISFIED** | W4-06 owns remaining manual accessibility/display evidence |
| NSIS/DMG artifact existence/version/arch | Verified in release workflow | **ALREADY SATISFIED** | Preserve |
| Checksums | Per-platform SHA-256 manifests plus final tag verification already present | **ALREADY SATISFIED** | Preserve after signing; checksums must be generated from final signed bytes |
| SBOM | Node + Rust CycloneDX generation/verification present | **ALREADY SATISFIED** | Preserve |
| Exact-SHA provenance | ordinary-CI prerequisite and tag/checkout binding present | **ALREADY SATISFIED** | Preserve |
| Release workflow source correctness duplication | removed in W4-04; exact-SHA CI owns it | **ALREADY SATISFIED** | Do not restore |
| Production credential storage | No repo secrets can be inspected; no signing secrets committed | **CREDENTIAL-DEPENDENT** | Use GitHub secrets/managed identity only; never commit or echo secrets |
| Real cross-version upgrade fixture | Package version is 0.1.40; repository has no public release and audit found no maintained older installer fixture | **DEFERRED / W5** | Do not manufacture a version bump merely for W4-05 |
| GitHub Release publication | Workflow contains tag-only publication machinery but repository has no published release | **DEFERRED / W5** | Do not create tag/release during W4-05 |
| Update channel readiness | No W4 authorization | **DEFERRED / W5** | None |
| SmartScreen reputation | Depends on production certificate/reputation and real distribution | **DEFERRED / W5** | Signing verification is W4-05; reputation/public rollout is W5 |
| MSIX migration | Existing NSIS product is accepted | **NOT APPLICABLE** | Do not migrate |
| Finder Quick Look extension | Not part of accepted W4 macOS product | **NOT APPLICABLE** | Do not add |

## Important policy correction

The current release workflow's hard-coded statement that signing/notarization is `OUT OF SCOPE` and not a release blocker was valid for earlier internal RC work, but is no longer the governing W4-05 packaging truth.

W4-05 must replace that unconditional policy with an explicit build mode:

### Engineering unsigned mode

Purpose: repeatable branch/manual packaging for engineering evidence.

Allowed only when no GitHub Release is being published.

Required truth:

- Windows/macOS artifacts are explicitly classified `UNSIGNED / ENGINEERING ONLY`;
- macOS may retain `--no-sign` in this mode;
- no signature/notarization PASS is claimed;
- normal artifact/provenance/SBOM/checksum verification remains active.

### Production signed mode

Purpose: prove the distribution-signing integration on an immutable exact SHA when real credentials are available.

Required truth:

- missing credential/interface is a hard failure of this mode;
- Windows main app/Preview DLL/final installer receive the intended trusted signature path;
- macOS app/DMG signing/notarization uses Tauri-supported Developer ID/notarization interfaces;
- signatures/notarization are verified after final packaging;
- checksum manifests are generated only after final signed bytes exist;
- secrets never enter logs/artifacts;
- this mode does not itself publish a GitHub Release during W4-05.

The implementation may choose a simple workflow input or a narrowly scoped reusable environment switch, but must not make ordinary PR CI depend on production secrets.

## Credential availability disposition

The repository and connected GitHub interface do not expose secret values or prove that production signing identities are currently available.

Therefore this audit records:

- Windows trusted code-signing identity availability: **UNVERIFIED / CREDENTIAL-DEPENDENT**;
- Apple Developer ID Application identity availability: **UNVERIFIED / CREDENTIAL-DEPENDENT**;
- Apple notarization credential availability: **UNVERIFIED / CREDENTIAL-DEPENDENT**.

This is not a product failure. It determines how far runtime signing acceptance can proceed after the implementation lands.

W4-05 must not create self-signed/test certificates and call them production evidence.

## Minimal implementation authorization

The later code/workflow implementation is authorized to modify only the surfaces necessary for the signing-mode integration, expected to be primarily:

- `.github/workflows/release-build.yml`;
- `src-tauri/tauri.conf.json` and/or a narrow platform signing override/config if needed;
- `src-tauri/tauri.windows.conf.json` or another narrow Windows signing config if that is cleaner than the shared config;
- small release/signature verification scripts under `scripts/`;
- focused contract tests such as `tests/remediationContract.test.ts` and a new W4-05 release-signing contract test if useful;
- documentation strings that currently assert signing is permanently out of scope.

Production installer lifecycle `.nsh`, registry/service authority, Preview COM/native renderer and association ownership are **not authorized for modification** by this audit.

## Implementation requirements

1. Preserve a fast unsigned engineering packaging path.
2. Add an explicit production-signed packaging path that fails closed when credentials are absent.
3. Do not expose secrets through command echo, generated artifacts or checked-in files.
4. Use Tauri-supported signing integration before inventing custom packaging.
5. Windows: sign/verify the exact binaries that become the packaged product, including the Preview Handler DLL and final installer as applicable.
6. macOS: remove `--no-sign` only in production-signed mode; use Developer ID + notarization interfaces and verify the resulting artifact when credentials exist.
7. Generate checksums from final post-signing bytes.
8. Preserve exact-SHA ordinary CI prerequisite and existing artifact-specific W4-04 Windows checks.
9. Do not restore duplicated source-correctness lanes to release-build.
10. Do not publish a tag/GitHub Release during W4-05 acceptance.
11. No version bump solely to manufacture cross-version evidence.
12. No W4-04 runtime matrix rerun unless a signing operation changes functional behavior; signed-artifact sanity is sufficient when real credentials become available.

## Acceptance split

### Repository/configuration acceptance

Can be completed without production credentials:

- engineering vs production-sign mode is explicit;
- production-sign mode references secure external credentials only;
- missing credentials fail closed;
- unsigned mode stays truthful/non-public;
- verification logic is present and deterministic;
- release body/policy no longer claims production signing is permanently out of scope;
- tests prove no signing secret is committed or echoed;
- ordinary exact-head CI and unsigned package run remain green.

### Real credential acceptance

Can only be claimed when real credentials are supplied:

- Windows Authenticode signatures verify against the intended trusted identity and timestamp policy;
- macOS Developer ID signature verifies;
- notarization succeeds and the result is stapled/assessed where applicable;
- final signed artifact hashes/checksums are frozen;
- a narrow signed install/launch/native-preview sanity pass succeeds.

If credentials remain unavailable, W4-05 may close repository/configuration integration with the production-signing runtime facts explicitly **UNVERIFIED / CREDENTIAL-DEPENDENT**, provided no false public-release readiness is claimed. W5 must inherit that residual truth.

## W5 boundary

W4-05 does **not**:

- create a release tag;
- publish a GitHub Release;
- establish update-channel behavior;
- promise SmartScreen reputation;
- execute a version bump solely to create upgrade evidence;
- authorize general release hardening.

Those remain W5 responsibilities.

## Decision

Audit result: **IMPLEMENT A SMALL SIGNING-INTEGRATION CHANGESET; DO NOT REOPEN W4-04.**

Expected code/workflow complexity is low-to-moderate and should be reviewed as one focused W4-05 implementation PR after exact-base preflight.
