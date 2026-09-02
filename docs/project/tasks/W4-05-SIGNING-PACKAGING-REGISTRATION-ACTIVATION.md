# W4-05 — Signing / Packaging / Registration Integration Activation

Status: **ACTIVE / NEXT — GAP AUDIT FIRST**

Last verified: 2026-09-02

## Purpose

Activate W4-05 after W4-04 completed and merged to `master`.

W4-05 is a **bounded integration track**, not a second installer-hardening program. W4-04 already proved the Windows production installer/registration lifecycle in depth and established optimized cross-platform release packaging infrastructure. W4-05 must reuse that evidence and implement only the remaining signing/packaging/registration gaps.

## Entry baseline

W4-05 is activated from the W4-04 production baseline:

- `master@d526eb972f55de42df77946354b8ab79c05152dc`;
- tree `2b9146eaff9696867c1ba1c5649aec3b8ce831d0`;
- W4-04 production PR #159: merged;
- W4-04 remediation PR #164: merged;
- W4-04 final current truth: [`W4-04-WINDOWS-EXPLORER-PRODUCTION-CURRENT-TRUTH.md`](W4-04-WINDOWS-EXPLORER-PRODUCTION-CURRENT-TRUTH.md).

Final accepted Windows artifact inherited from W4-04:

- artifact ID `9804066036`;
- installer SHA-256 `5E92A0397F876754F8F3CD06D92BF038364D5D5145DDB04A9EF42A006D973A5D`;
- exact-head CI `33514455254`: SUCCESS;
- release-build `33515469458`: SUCCESS.

W4-04 historical candidates are provenance only and are not W4-05 acceptance authorities.

## Activation decision

W4-05 is **ACTIVE** after this docs/governance activation merges.

The first implementation action is a **gap audit**, not production modification.

No W4-05 source/config/workflow change is authorized merely because this activation document exists. A later implementation branch must start from the exact post-activation `master` baseline and must be scoped to gaps actually proven by the audit.

## Already solved — do not reopen

### Windows

W4-04 already closed:

- x64 Preview Handler production packaging;
- NSIS per-machine registration integration;
- exact typed ARP/manufacturer authority;
- Global Index service lifecycle and direct SCM runtime authority;
- Preview CLSID/AppID/Inproc/ThreadingModel registration;
- conservative 16-extension `SystemFileAssociations` matrix;
- foreign association/service/Inproc preservation;
- fresh install, same-version repair, stopped/running-service repair and uninstall;
- mapped Preview DLL retirement/replacement without Explorer/`prevhost.exe` termination;
- Preview DLL static CRT dependency closure;
- genuine Explorer + Low Integrity `prevhost.exe` runtime acceptance;
- checksum/SBOM/artifact issuance;
- exact-SHA CI prerequisite before release packaging.

W4-05 must not add new generic ownership states, broaden foreign-state deletion, restore process-kill servicing, require physical DLL unmap, or repeat the W4-04 A/B hardening matrix without a new signing/packaging-specific reason.

### macOS

W4-02 already closed the Zen-internal native Quick Look host/runtime path for the activated PDF scope. Current release infrastructure already builds a macOS DMG on Apple Silicon and verifies the unsigned artifact shape.

W4-05 must not activate a broad Finder Quick Look extension merely for symmetry.

### Release workflow

The optimized release workflow already delegates ordinary source correctness to exact-SHA CI. W4-05 must not restore redundant:

- typecheck;
- ordinary frontend tests;
- ordinary Rust tests/fmt/clippy;
- dependency audit;
- 100k performance validation;
- macOS race validation

inside the packaging workflow unless a new artifact-specific requirement demonstrably needs it.

## W4-05 gap audit questions

The audit must answer these questions before implementation.

### A. Windows signing

1. Is an Authenticode certificate/credential currently available to CI or release operators?
2. Which binaries require signing for the supported distribution contract?
   - main EXE;
   - Preview Handler DLL;
   - NSIS installer;
   - uninstaller if signing is technically supported by the current packaging flow.
3. Does Tauri/NSIS already expose a supported signing hook that can be configured without replacing installer ownership?
4. What timestamp authority is intended?
5. What exact verification should run on the packaged artifact (`Get-AuthenticodeSignature`, `signtool verify`, signer subject, timestamp where available)?
6. If credentials are unavailable, what is the truthful W4-05 disposition: implementation-ready/configured-but-unverified vs deferred-to-W5/release credentials?

W4-05 must not invent test certificates and call them production signing evidence.

### B. macOS signing / notarization

1. Is an Apple Developer ID Application identity currently available?
2. Are notarization credentials/API keys available?
3. What is the exact current Tauri bundle signing/hardened-runtime configuration?
4. Which nested code exists in the final app bundle and must be covered by code signing?
5. Does the current app already carry hardened runtime/entitlements suitable for the W4 native path?
6. Can `codesign --verify --deep --strict` and Gatekeeper assessment be run on the produced app/DMG?
7. Can notarization + stapling be performed with available credentials?
8. If credentials are absent, which steps can still be structurally verified without falsely claiming notarization?

No fake/self-signed identity may be reclassified as Developer ID/notarization acceptance.

### C. Package/registration integration

1. Which W4-05 registration obligations remain after W4-04?
2. Does Windows need any change beyond signing the already-accepted NSIS/Preview registration product?
3. Does macOS have any new native helper/bundle placement that W4-05 actually needs to sign, or is the W4-02 path already inside the main app bundle?
4. Is there a real cross-version upgrade fixture available for `0.1.40` → a different packaged version, or would changing package version solely to manufacture an upgrade test be artificial?
5. Which upgrade evidence belongs here vs W5 release/update-channel work?
6. Does any packaging change alter the accepted Windows tree/registration semantics? If not, W4-04 runtime hardening must remain closed.

### D. Artifact provenance

Audit current coverage for:

- exact source SHA/tree;
- exact-SHA ordinary-CI prerequisite;
- installer/DMG existence and non-empty checks;
- version/architecture verification;
- checksum manifest;
- Node/Rust SBOM;
- artifact digest;
- tag-only final verification.

Only add a new gate if a specific signing/package gap is not already represented.

## Expected W4-05 implementation scope

The preferred outcome is intentionally small.

Likely authorized implementation after the audit:

- production signing configuration/hooks where credentials exist or can be supplied securely;
- artifact-specific signature verification;
- macOS notarization/stapling integration where credentials exist;
- any narrowly required nested-code signing order/configuration;
- truthful unsigned/unnotarized classification when credentials are unavailable;
- narrow package metadata/provenance fixes discovered by the audit;
- one cross-version package test only if a real versioned fixture exists without manufacturing release semantics.

Not expected:

- redesigning NSIS;
- migration to MSIX without an independent product reason;
- broad Finder extension work;
- rewriting W4-04 association/service ownership;
- new Preview renderer/provider architecture;
- release publication or update-channel activation;
- generic security hardening unrelated to packaging/signing.

## Credential boundary

Signing secrets/credentials are never committed to the repository.

W4-05 may define secret names and CI interfaces, but must preserve least-privilege handling and must not print private keys, certificates, passwords, API tokens or notarization secrets into logs/artifacts.

If production credentials are unavailable, record that fact explicitly and stop at the strongest non-secret structural verification available. Do not weaken or fake the evidence classification.

## Performance / CI budget

W4-05 inherits the optimized release-build structure.

Target behavior:

- signing/verifying adds only artifact-specific work;
- do not duplicate ordinary CI;
- Windows/macOS packaging should remain approximately within the current optimized envelope unless real signing/notarization latency requires otherwise;
- notarization network wait, if used, must be reported separately from compile/package time rather than hidden as source-build regression.

No hard timing gate should be introduced merely to preserve a historical single-run number.

## Acceptance model

W4-05 may close when the applicable supported-platform facts are truthful and complete:

1. Windows packaged native artifacts use the accepted W4-04 registration product with no regression;
2. Windows production signing is verified when credentials are available, otherwise explicitly deferred/unverified with configuration truth recorded;
3. macOS nested/main code signing and hardened runtime are verified where applicable;
4. notarization/stapling are verified when credentials are available, otherwise explicitly deferred/unverified;
5. DMG/NSIS artifact provenance, checksums and SBOM remain correct;
6. any real upgrade/package transition required by W4-05 is proven without fabricating a release version;
7. tag/release publication remains W5;
8. no W4-04 runtime acceptance is reopened without a packaging-induced product change;
9. exact-head CI and artifact-specific package checks are recorded;
10. W4-06 becomes the next track only after W4-05 current-truth closeout.

## Stop conditions

Stop for review if implementation would require:

- replacing NSIS with MSIX;
- adding a Finder Preview Extension;
- changing Windows Preview association/ownership semantics;
- changing service authority;
- changing Preview Handler COM/runtime architecture;
- changing supported platforms;
- committing signing secrets;
- bypassing signing/notarization failures;
- creating a fake production signature/notarization PASS;
- activating W5 publication/update work.

## Sequencing

```text
W4-00 ✅
  ↓
W4-01 ✅
  ↓
W4-02 ✅            W4-03 v1 STOPPED
                       ↓
                    ADR-0006 ✅
                       ↓
                    W4-03 v2 ✅
                       ↓
                    W4-04 ✅ COMPLETE / CLOSED — PR #159
  └────────────────────┘
           ↓
W4-05  ACTIVE / GAP AUDIT FIRST
  ↓
W4-06  downstream
  ↓
W4-07  downstream
  ↓
W5     NOT AUTHORIZED / NOT ACTIVE
```

## Handoff to implementation

After this activation PR merges:

1. record the exact post-activation `master` SHA/tree;
2. create a fresh W4-05 audit branch from that exact baseline;
3. audit current signing/package config and CI secrets interfaces without changing production behavior;
4. return a gap table with `ALREADY SATISFIED`, `IMPLEMENT`, `CREDENTIAL-DEPENDENT`, `DEFERRED / W5`, or `NOT APPLICABLE` classifications;
5. only then authorize the smallest implementation set.

W4-05 should be substantially smaller than W4-04 unless the audit uncovers a genuinely new distribution blocker.
