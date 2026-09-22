# W6-10A — Release Candidate Freeze — Activation

Status: **ACTIVE — implementation**

Issue: #245
Initiative: W6 — Product Maturity Audit / W6-10 Release Re-entry

## Activation baseline

- source: `master@9c8cdee792f8a2b5078c22c517d8648899440b0c`
- tree: `3ec2158bb56ce0a734b2c894793f5fe60b8b3296`
- package version: `0.1.40`
- Tauri version: `0.1.40`
- `v0.1.40` tag: **ABSENT**
- GitHub Release `v0.1.40`: **ABSENT**
- W6-10 qualification plan: merged through PR #244
- merge-after prep CI: **SUCCESS**

## Explicit version decision

`0.1.40` is explicitly re-selected as the W6-10 RC1 candidate version.

Reason:

- the current production source still declares `0.1.40`;
- no public `v0.1.40` tag exists;
- no GitHub Release exists;
- the historical W5 authorization is superseded by W6 product-maturity work;
- this is a new W6-10 decision and must receive fresh exact-SHA qualification.

Do not treat historical W5 installer evidence as current RC evidence.

## RC1 immutable source

Create/use the release-candidate branch:

`rc/w6-10-0.1.40-rc1`

It is frozen at:

`9c8cdee792f8a2b5078c22c517d8648899440b0c`

Do not move this branch during RC1 qualification.

This branch exists only so GitHub workflow_dispatch can select the exact
candidate without creating a release tag.

## Scope

W6-10A owns only release-candidate freeze and artifact identity.

Authorized:

1. verify exact RC branch/source/tree/version;
2. run fresh `CI Full Validation` on the RC branch;
3. require exact-SHA successful Full Validation;
4. run fresh `Build Release Installers` on the same RC branch;
5. verify the release-build qualification job selects the fresh Full Validation
   run for the exact RC SHA;
6. record Windows NSIS artifact identity;
7. record macOS Apple Silicon DMG artifact identity;
8. verify installer checksum manifests;
9. verify exactly two valid CycloneDX SBOMs;
10. confirm tag and GitHub Release remain absent;
11. create a durable W6-10A RC1 freeze result.

Not authorized:

- Windows manual/native release acceptance;
- macOS manual/native release acceptance;
- DPI/Forced Colors/Retina/VoiceOver/Narrator acceptance;
- product/UI remediation;
- release workflow redesign unless a concrete W6-10A blocker is found;
- tag creation;
- GitHub Release creation;
- publication;
- W6-10B/C/D/E/F activation.

## Fail-closed start gate

Before any workflow dispatch:

```bash
git fetch origin
git status --short
git branch --show-current
git rev-parse origin/master
git rev-parse origin/master^{tree}
git rev-parse origin/rc/w6-10-0.1.40-rc1
```

Require:

- worktree clean;
- `origin/master = 9c8cdee792f8a2b5078c22c517d8648899440b0c`;
- master tree = `3ec2158bb56ce0a734b2c894793f5fe60b8b3296`;
- RC branch = same source SHA.

If master has moved before qualification begins:

STOP.

Owner / ChatGPT must decide whether RC1 remains valid or a new candidate is
required.

Do not silently retarget RC1.

## Version / publication-state verification

Before workflow dispatch, verify current repository truth:

- all release version metadata agree on `0.1.40`;
- `v0.1.40` tag remains absent;
- GitHub Release `v0.1.40` remains absent;
- no other release has been created that conflicts with the candidate decision.

If publication state changed:

STOP.

## Exact workflow sequence

### 1. Full Validation

Dispatch:

```bash
gh workflow run ci-full.yml \
  --ref rc/w6-10-0.1.40-rc1 \
  -f full_validation=true
```

Wait for the new workflow-dispatch run.

Require:

- workflow: `CI Full Validation`;
- event: `workflow_dispatch`;
- head SHA exactly
  `9c8cdee792f8a2b5078c22c517d8648899440b0c`;
- final conclusion: **SUCCESS**;
- required Windows/macOS quality/package/dependency/performance gates succeed.

Record the run ID.

Do not accept a historical scheduled or workflow-dispatch run from another SHA.

### 2. Build Release Installers

Only after Full Validation SUCCESS:

```bash
gh workflow run release-build.yml \
  --ref rc/w6-10-0.1.40-rc1
```

Require:

- workflow: `Build Release Installers`;
- event: `workflow_dispatch`;
- head SHA exactly RC1;
- `Require CI Full Validation for exact SHA` succeeds and selects the fresh
  RC1 Full Validation;
- Windows NSIS build succeeds;
- macOS DMG build succeeds;
- tag-only publication job remains skipped;
- no tag or GitHub Release is created.

Record the run ID.

## Artifact verification

Download the workflow artifacts outside the repository.

Require:

### Windows

- artifact name `Zen-Canvas-Windows`;
- one expected versioned x64 NSIS installer;
- installer non-empty;
- installer filename contains `0.1.40`;
- `installers-windows.sha256` matches;
- record installer SHA-256.

### macOS

- artifact name `Zen-Canvas-macOS`;
- one expected Apple Silicon DMG;
- DMG non-empty;
- filename contains `0.1.40`;
- no x86_64/universal artifact claim;
- `installers-macos.sha256` matches;
- record DMG SHA-256.

### SBOM

Across release artifacts:

- exactly two `*.cdx.json`;
- Node SBOM valid CycloneDX;
- Rust SBOM valid CycloneDX;
- no duplicate/missing SBOM.

Record GitHub artifact IDs/digests when available.

## Candidate invalidation

If any source/config/workflow production correction is required:

RC1 is invalid.

Do not patch the RC branch.

Return the concrete blocker.

Owner / ChatGPT decides whether to create RC2.

Documentation-only evidence/result commits do not alter RC1.

## Result document

Create:

`docs/project/tasks/W6-10A-RELEASE-CANDIDATE-FREEZE-RESULT.md`

It must contain:

- RC source/tree/version;
- RC branch;
- tag/release state;
- Full Validation run ID/conclusion;
- release build run ID/conclusion;
- Windows artifact ID/digest/installer name/size/SHA-256;
- macOS artifact ID/digest/DMG name/size/SHA-256;
- checksum verification;
- exactly-two-SBOM verification;
- publication job disposition;
- RC1 final disposition.

Allowed result:

- **RC1 FROZEN / ACCEPTED FOR RELEASE QUALIFICATION**
- or
- **RC1 REJECTED / NEW RC REQUIRED**

No platform manual PASS is created by W6-10A.

## Exit

If RC1 is accepted:

- W6-10A = COMPLETE / CLOSED;
- W6-10B Windows Release Qualification = ELIGIBLE / NOT ACTIVE;
- W6-10C macOS Release Qualification = ELIGIBLE / NOT ACTIVE;
- W6-10D/E/F remain dependency-gated;
- publication remains DEFERRED.

Then STOP.

Do not begin native manual acceptance until Owner / ChatGPT reviews the RC1
freeze result.
