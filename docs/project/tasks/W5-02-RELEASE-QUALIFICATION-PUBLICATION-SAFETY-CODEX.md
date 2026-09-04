# W5-02 — Release Qualification & Publication Safety Gate — Codex / Agent Brief

Status: **AUTHORIZED / NEXT after W5-01 merge — implementation**

Baseline: resolve the exact W5-01 merge SHA on `master` before execution.

Suggested branch: `fix/w5-02-release-qualification-publication-safety`

W5-02 is the first implementation Track derived from the W5-01 release audit. It addresses release qualification and artifact freshness only. It must not publish a tag or GitHub Release.

## Objective

Make the existing release pipeline fail closed unless the exact release SHA has explicit release-qualified validation, and prove that the current product source can produce both supported-platform installer artifacts with truthful unsigned-distribution metadata.

The Track closes two release blockers from W5-01:

- RQ-01 — release publication currently accepts any successful ordinary CI run, including proportional/docs-only validation;
- RQ-02 — current post-TD-014 product code has release-compile evidence but no current NSIS/DMG package evidence.

## Required read set

Read completely before editing:

1. `AGENTS.md`
2. `docs/project/STATUS.md`
3. `docs/project/ROADMAP.md`
4. `docs/project/initiatives/W5-release-hardening.md`
5. `docs/project/tasks/W5-01-RELEASE-BASELINE-GAP-AUDIT-RESULT.md`
6. `.github/workflows/ci.yml`
7. `.github/workflows/ci-full.yml`
8. `.github/workflows/release-build.yml`
9. `tests/ciFastPathContract.test.ts`
10. `scripts/ciEvidence.mjs`
11. `scripts/ciValidationPlan.mjs`
12. `src-tauri/tauri.conf.json`
13. `scripts/buildWindowsPackage.mjs`
14. `docs/project/tasks/W4-05-NO-SIGN-DISPOSITION-CURRENT-TRUTH.md`
15. `docs/project/tasks/W4-NATIVE-INTEGRATION-FINAL-CURRENT-TRUTH.md`

Use current official GitHub Actions/Tauri/platform documentation if an implementation detail depends on current external behavior.

## Frozen product decisions

W5-02 MUST preserve these facts unless a separate product decision changes them:

- Windows Authenticode is not planned in the current horizon;
- Apple Developer ID signing is not planned in the current horizon;
- Apple notarization/stapling is not planned in the current horizon;
- Windows and macOS artifacts may therefore remain intentionally unsigned;
- no signed/notarized PASS may be claimed;
- SmartScreen/Gatekeeper reputation acceptance remains unverified/manual release evidence;
- supported platforms remain Windows and macOS 13+ Apple Silicon only.

Do not add dormant signing secret interfaces or certificate-specific infrastructure in W5-02.

## Required implementation

### 1. Release-qualified exact-SHA prerequisite

`release-build.yml` must no longer treat an arbitrary successful ordinary `CI` run as sufficient release qualification.

Preferred contract: require a successful `CI Full Validation` run for the exact release SHA, with immutable source evidence and the full release matrix enabled. An equivalent contract is acceptable only if it proves the same facts explicitly.

The release prerequisite must fail closed when:

- only docs-only/proportional ordinary CI exists;
- Full Validation exists for a different SHA;
- Full Validation is cancelled, skipped, failed or incomplete;
- source evidence does not bind the validation run to the release SHA;
- the release tag does not resolve to the workflow SHA;
- version metadata does not match the tag.

Do not weaken `CI Full Validation` to make release-build easier to satisfy.

### 2. Preserve package provenance

Keep the current exact-SHA/tag/version checks and artifact checks:

- package / package-lock / Tauri / Cargo version agreement;
- tag `v<version>` agreement when tag-triggered;
- Windows NSIS exists, non-empty and versioned;
- macOS DMG exists, non-empty, Apple-Silicon-only naming;
- checksums cover every installer;
- Node + Rust CycloneDX SBOMs exist and parse;
- final release job re-verifies downloaded artifacts and tag/SHA binding.

### 3. Truthful release body

The release body may continue to state that distribution is unsigned, because that is current product policy.

However, every positive security/release claim in the release body must be guaranteed by the required release-qualified evidence. If a claim such as dependency-audit cleanliness is not guaranteed by the prerequisite, either make the prerequisite guarantee it or remove/narrow the claim.

Do not claim:

- Authenticode PASS;
- Developer ID PASS;
- notarization/stapling PASS;
- SmartScreen/Gatekeeper acceptance;
- manual accessibility/display/provider fixture PASS;
- updater availability.

### 4. Current package evidence

The W5-02 PR must route to the required product/release validation lanes and produce current exact-head package evidence for:

- Windows x64 NSIS;
- macOS Apple-Silicon unsigned DMG.

If ordinary PR routing does not automatically execute both package lanes for this workflow change, obtain the repository's exact supported full-validation/package evidence without fabricating a result. Record run/job/artifact IDs in the W5-02 result.

A successful release compile alone does not close RQ-02.

### 5. Focused contract tests

Extend the workflow contract tests so they prove at minimum:

- release workflow references `CI Full Validation` (or the accepted equivalent) rather than accepting any green ordinary CI;
- exact SHA matching is required;
- a docs-only ordinary CI cannot satisfy release qualification by construction;
- tag/version binding remains required;
- unsigned policy text remains explicit and does not claim platform signing/notarization;
- release-build still requires checksums and SBOMs.

Avoid tests that merely snapshot large YAML strings without proving the security property.

## Non-goals

W5-02 MUST NOT:

- create or push a release tag;
- publish a GitHub Release;
- add an updater/update channel;
- add platform signing/notarization infrastructure;
- change package version solely for this Track;
- expand supported platforms/architectures;
- alter Preview/File Library/mutation/recovery authorities;
- close unrelated technical debt;
- require manual accessibility/provider evidence before the automated release gate is fixed;
- reinterpret historical UNVERIFIED/DEFERRED evidence as PASS.

## Validation

Minimum acceptance:

1. focused workflow-contract tests pass;
2. documentation/governance checks pass;
3. exact changed-file scope remains bounded to release/CI contract + focused tests + W5 current-truth/result files;
4. exact-head full product validation required by the classifier passes;
5. exact-head Windows NSIS package lane passes and artifact identity is recorded;
6. exact-head macOS unsigned-DMG package lane passes and artifact identity is recorded;
7. dependency/security validation required by the new release prerequisite passes on the exact source used for package evidence;
8. no release/tag is created;
9. no unresolved reviewer blocker remains.

## Stop conditions

STOP and escalate instead of widening the Track if:

- release qualification cannot be bound to one immutable exact SHA;
- the only way to obtain green release evidence is to weaken full-validation gates;
- current package build reveals a product/runtime/installer defect unrelated to the release-workflow qualification change;
- supported-platform package production now requires a new signing identity or privileged service;
- current GitHub Actions semantics make the intended release evidence ambiguous;
- any tag/release publication would be required just to test the gate.

## Expected state after W5-02

```text
W5 ACTIVE — implementation
W5-01 COMPLETE / CLOSED
W5-02 COMPLETE / CLOSED
Release qualification requires exact-SHA full release validation
Current Windows NSIS Packaged / Validated
Current macOS unsigned DMG Packaged / Validated
Signing/notarization still DEFERRED by product decision
Release none
Tag none
W5-03 Distribution / Update Strategy NEXT
```
