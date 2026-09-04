# W5-01 — Release Baseline & Gap Audit — Result

Status: **COMPLETE / CLOSED — W5-02 RELEASE QUALIFICATION & PUBLICATION SAFETY GATE NEXT**

Audit baseline: `master@a2fd23f81a07a2a55ac0558bf852c624255ac353`; tree `e602bce0904207a7c50ff49afb2e0c4eb02e8329`.

W5 remains **ACTIVE — implementation**. This Track is evidence/governance only: it does not modify production source, package configuration, CI/release workflows, schema, version, release or tag state.

## Executive result

Zen Canvas is not blocked by a known filesystem/data-loss/runtime defect at W5 entry. The current product code has recent cross-platform compile/quality/performance evidence and W4 has strong Windows installer/native evidence plus bounded macOS engineering-DMG evidence.

Zen Canvas is **not yet release-qualified**, for a different reason: the current public release path can accept any successful ordinary CI run for the exact SHA, including a docs-only run, and then publish installers on a matching `v*` tag. It does not require the repository's existing `CI Full Validation` release matrix. This is the first W5 release blocker.

A second blocker is artifact freshness: the latest production-affecting TD-014 candidate passed release compilation, Rust/native and performance validation, but its NSIS and unsigned-DMG package jobs were skipped. The accepted packaged artifacts therefore still come from the earlier W4 `0.1.40` baseline rather than the current product code.

Production platform signing/notarization is **not** classified as an implementation blocker. W4 made an explicit product decision that Authenticode, Apple Developer ID, notarization and stapling are not planned for the foreseeable horizon. W5 must preserve that decision unless product policy changes; the release problem is to qualify and truthfully present an intentionally unsigned distribution, not to assume credentials will appear.

There is also no application updater/update-channel implementation in the current dependency/config/code surface. W5 must explicitly choose between a manual-download first-release policy and a separately implemented update mechanism before final publication policy is closed.

## Release baseline

| Area | Requirement | Current state | Evidence | Gap | Release impact | Owner / next Track |
| --- | --- | --- | --- | --- | --- | --- |
| Version | One coherent app/package version | **Implemented / statically consistent** | `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` all report `0.1.40`; release workflow also rejects cross-file/tag version drift | No current mismatch | none | retain gate |
| Schema | Current durable DB version is explicit | **Implemented / Validated** | TD-014 accepted schema 35 migration/runtime evidence | No current schema blocker | none | retain gate |
| GitHub Release | Published release exists | **Not Released** | GitHub Releases collection is empty at audit time; current STATUS also records none | First publication has not occurred | expected pre-release | W5-06 later |
| Git tag | Published release tag exists | **Not Released / none in current project truth** | STATUS at W5 activation records no published Git tag | First release tag has not occurred | expected pre-release | W5-06 later |
| Release workflow | Build/publish workflow exists | **Implemented** | `.github/workflows/release-build.yml` supports manual installer builds and `v*` tag publication | Qualification gate is too broad; see blocker RQ-01 | **BLOCKER** | **W5-02** |
| Full validation | Exact release SHA has complete release matrix | **Capability implemented; not required by release workflow** | `.github/workflows/ci-full.yml` provides manual/scheduled Full Validation; `release-build.yml` checks only any successful ordinary `CI` run | A docs-only successful CI can satisfy current release precondition | **BLOCKER** | **W5-02** |
| Current Windows package | Current product code has a verified NSIS artifact | **Historical Packaged; current code not yet Packaged** | W4 accepted `Zen Canvas_0.1.40_x64-setup.exe`; TD-014 exact-head run `33834541344` passed Windows release compile but NSIS package lane was skipped | Rebuild/verify NSIS from current product baseline | **BLOCKER** | **W5-02** |
| Current macOS package | Current product code has a verified Apple-Silicon DMG | **Historical Packaged; current code not yet Packaged** | W4 accepted `Zen Canvas_0.1.40_aarch64.dmg`; TD-014 exact-head run `33834541344` passed macOS release compile/native QA but unsigned-DMG package lane was skipped | Rebuild/verify DMG from current product baseline | **BLOCKER** | **W5-02** |
| Artifact provenance | Version/architecture/checksum/SBOM/exact SHA are enforced | **Implemented / historically Validated** | release workflow verifies exact SHA + version metadata, produces SHA-256 manifests and Node/Rust CycloneDX SBOMs; W4 package evidence accepted these contracts | Must be exercised on current release-qualified SHA | P1 release evidence | **W5-02** |
| Signing policy | Platform production signatures/notarization | **DEFERRED / NOT PLANNED IN CURRENT HORIZON** | W4-05 No-Sign disposition explicitly records no planned Authenticode, Developer ID, notarization or stapling credentials | Do not invent signing implementation; public unsigned consequences must be accepted/tested truthfully | P1 product-policy evidence, not code blocker | W5-02 + W5-04 |
| Public unsigned messaging | Release notes describe actual trust state | **Implemented but policy-sensitive** | release workflow hard-codes `UNSIGNED`, platform signing OUT OF SCOPE, and says signing/notarization is not a Release blocker | This wording is only safe if W5 release qualification and manual install/launch evidence support an intentionally unsigned first release | P1 | W5-02 + W5-04 |
| Update mechanism | In-app updater/update channel | **Not Implemented** | no `tauri-plugin-updater` dependency, updater code, update endpoint or update manifest found | Must choose manual-download first-release policy or implement a bounded updater Track | P1 release-policy gap | **W5-03** |
| Windows installer lifecycle | Fresh install/repair/uninstall/Preview Handler ownership | **Validated / Packaged on W4 artifact** | W4 final closeout: clean install, repair, uninstall/reinstall, foreign-state preservation, genuine Explorer/Low-IL preview, in-use DLL servicing all accepted | Re-run package-level smoke on current artifact; no known runtime defect | P1 evidence refresh | W5-02 / W5-04 |
| macOS package lifecycle | Mount/copy/replace/remove/detach | **Validated / Packaged on W4 engineering artifact** | W4 hosted Apple-Silicon DMG lifecycle passed read-only mount, isolated copy, same-version replacement, removal and detach | Current artifact refresh required; GUI launch not executed | P1 evidence refresh | W5-02 / W5-04 |
| macOS cross-version upgrade | Upgrade from a real older release | **DEFERRED / NO REAL OLDER RELEASE FIXTURE** | W4 final closeout and no-sign disposition preserve this exact classification | Cannot prove until a real older release fixture exists; first release may make future cross-version testing possible | P2 external-fixture gap | W5-04 / later release cycle |
| macOS Gatekeeper | Default public-distribution launch experience | **UNVERIFIED / expected warning path** | W4 hosted diagnostic: adhoc signature, no Team ID, `spctl` exit 1; no Developer ID/notarization claim | Test/document the real first-launch/override experience for intentional unsigned distribution; no fabricated Gatekeeper PASS | P1 | **W5-04** |
| Windows reputation | SmartScreen/Unknown Publisher public experience | **UNVERIFIED** | W4 deliberately makes no Authenticode/reputation acceptance claim | Test/document actual unsigned installer warning/launch flow | P1 | **W5-04** |
| macOS native manual QA | Retina, multi-display, keyboard/focus, VoiceOver, genuine provider/external-volume behavior | **UNVERIFIED** | W4 final closeout preserves each as unverified | Decide required pre-release subset vs accepted defer; execute only real-fixture/manual checks that matter to supported product | P1/P2 evidence gap | **W5-04** |
| Windows native manual QA | DPI transition, multi-display, keyboard/focus, Narrator | **UNVERIFIED** | W4 final closeout preserves each as unverified | Decide required pre-release subset vs accepted defer | P1/P2 evidence gap | **W5-04** |
| Automated performance | Current product baseline has broad performance/native evidence | **Validated** | TD-014 exact-head run `33834541344` passed native macOS performance and Search/Scan/Schema/Library/Content/Intelligence/Workspace/Preview performance shards | No demonstrated current regression | non-blocking | retain; W5-05 only if needed |
| Scheduler pressure target | W0 2x-idle comparison | **TARGET MISSED** | W1 closeout: Windows ~2.30x; macOS ~4.19x; explicitly not a hard correctness gate | Re-measure only if release UX/resource evidence makes it material; do not relabel as PASS | P2 | W5-05 / may defer |
| Dependency/security audit | Release SHA has current dependency audit | **Capability implemented; not release-qualified by current workflow** | `CI Full Validation` includes npm/RustSec audit; TD-014 exact-head release run skipped the dependency-audit lane; release workflow itself does not run the audit | Full-validation requirement in W5-02 must make security evidence part of release qualification | P1 | **W5-02** |
| Technical debt | Open debt must be cleared before release | **Not a blanket blocker** | TECH_DEBT exit conditions + post-TD-014 reprioritization | TD-004 is a cheap candidate; TD-012 depends on package evidence; broad compatibility/refactor debts remain safe to leave open unless W5 evidence changes release impact | P2 | targeted only |

## Blockers and priorities

### P1 / release blocker — RQ-01: release qualification accepts insufficient CI evidence

Current `release-build.yml` requires only a successful workflow named `CI` on the exact SHA. It does **not** require that the run selected full-validation lanes or that package, dependency-audit, performance and supported-platform gates actually ran.

This matters because the CI router intentionally supports docs-only and proportional validation. A docs-only merge can therefore have a successful exact-SHA ordinary CI while providing no new product release qualification.

**Required disposition:** before any public tag/release, the release workflow must require release-qualified exact-SHA evidence, preferably the repository's existing `CI Full Validation` workflow (or an equivalently explicit immutable release-validation contract). It must not infer full validation merely from a green ordinary CI conclusion.

### P1 / release blocker — RQ-02: current product code has no current packaged artifact

The last production-affecting change before W5 activation is TD-014. Its final exact-head CI passed Rust, native macOS, release compile and all applicable performance lanes, but package NSIS/unsigned-DMG jobs were skipped. The latest accepted installer artifacts are therefore earlier W4 artifacts.

**Required disposition:** W5-02 must produce and verify both supported-platform installers from the exact release-qualified current product SHA. Release compile alone is not `Packaged`.

### P1 / policy gate — RQ-03: intentional unsigned first-release consequences need W5 acceptance

W4 explicitly decided not to operate production signing/notarization credentials for the foreseeable horizon. That remains authoritative. W5 must not reopen signing merely for release-checklist symmetry.

The release workflow already labels a tag publication as an unsigned public build. The missing evidence is whether the actual supported-platform warning/install/launch experience is acceptable and documented truthfully.

**Required disposition:** W5-02 preserves the no-sign product decision; W5-04 exercises the real unsigned installation/first-launch warning paths and records user-facing limitations. A policy change to obtain credentials would require a separate product decision.

### P1 / release-policy gap — RQ-04: no updater/update channel exists

No updater dependency or update endpoint/manifest was found. This is not hidden implementation debt: the capability is absent.

**Required disposition:** W5-03 must explicitly choose one bounded first-release model:

1. manual download/install updates for the first release, with truthful documentation and lifecycle expectations; or
2. a separately reviewed updater implementation with its own trust/version/rollback/security contract.

Do not smuggle updater work into W5-02.

### P1/P2 / evidence gap — RQ-05: manual/native supported-platform release matrix is incomplete

W4 intentionally preserved native manual/accessibility/display/provider gaps as `UNVERIFIED`, not defects. W5 now owns deciding which of them are necessary for release confidence.

The highest-value real checks are:

- macOS unsigned DMG first launch/Gatekeeper override path and actual GUI launch;
- Windows unsigned installer Unknown Publisher/SmartScreen flow;
- keyboard/focus behavior on the two native host surfaces;
- one representative supported DPI/Retina display check;
- VoiceOver/Narrator only where the native surface is part of the supported user flow;
- genuine provider/external/network-volume checks only when a real fixture is available and the supported release claim would otherwise overstate evidence.

Cross-version macOS upgrade remains truthfully deferred until a real older release artifact exists.

### P2 / optimization — RQ-06: historical Scheduler target remains missed

Current exact-head performance suites are green and W4 found no current native resource regression. The W1 2x-idle scheduler comparison remains a measured target miss, not a correctness failure.

**Disposition:** do not block W5-02 on this historical target. W5-05 should re-measure it only if long-session or interactive release evidence shows a user-visible issue. Otherwise retain the explicit target-missed observation for post-release optimization.

## Technical-debt release relevance

| Debt | W5-01 disposition |
| --- | --- |
| TD-001 | Leave open unless release evidence identifies a concrete compatibility-authority defect. Broad retirement is not release work by default. |
| TD-002 | Leave open; composition-root maintainability is not a release blocker without a demonstrated lifecycle defect. |
| TD-003 | Leave open while capability fallback/support-window proof is incomplete. |
| TD-004 | Cheap retirement candidate, but **not before W5-02**. Remove only with authoritative-preview regression and no production caller proof. |
| TD-005 | Leave open unless operation-preview continuity is proven in a bounded release-risk fix. |
| TD-006 | Leave open; durable managed-AI compatibility/repair semantics remain real. |
| TD-007 | Leave open unless release-facing visual regressions are tied to the aliases. |
| TD-008 | Leave open; module size alone does not justify pre-release refactor. |
| TD-009 | Leave open; Windows safety boundary refactor is not required by accepted current behavior. |
| TD-010 | Leave open unless release evidence exposes a command/capability drift defect. |
| TD-012 | Re-evaluate after W5-02 produces exact current packages; package evidence is its recorded blocker. |
| TD-015 | Leave open; broad File Library compatibility retirement remains post-W2 debt, not a first-release prerequisite by itself. |

No debt item is closed by W5-01.

## External/manual blockers

Evidence that cannot be fabricated by hosted source checks:

- production signing/notarization credentials — intentionally not planned, not awaited;
- SmartScreen/reputation behavior — real Windows distribution context/manual evidence;
- Gatekeeper first-launch behavior — real macOS unsigned distribution/manual evidence;
- VoiceOver/Narrator and genuine native keyboard/focus/display observations — manual/native evidence;
- genuine iCloud/File Provider/external APFS/exFAT/SMB/network fixtures — only when real fixtures exist;
- cross-version macOS upgrade — requires a real older release artifact.

## Evidence available immediately in hosted CI

W5 can obtain immediately, without new platform credentials:

- exact-SHA `CI Full Validation`;
- full frontend/Rust/native/performance/security matrix;
- current Windows NSIS build and package-semantic verification;
- current unsigned Apple-Silicon DMG build and artifact verification;
- checksums and CycloneDX SBOMs;
- version/architecture/provenance checks;
- native macOS automated lifecycle/performance and Windows package/runtime automated gates already supported by CI.

## Downstream W5 Track proposal

The audit now provides enough evidence to authorize a bounded queue.

```text
W5-01  Release Baseline & Gap Audit                         COMPLETE / CLOSED
  ↓
W5-02  Release Qualification & Publication Safety Gate       NEXT / BLOCKER
  ↓
W5-03  Distribution / Update Strategy                       AFTER W5-02
  ↓
W5-04  Supported-Platform Manual Release Acceptance          AFTER CURRENT PACKAGES EXIST
  ↓
W5-05  Long-session / Performance Release Evidence           ONLY IF W5-04 OR CURRENT METRICS REQUIRE IT
  ↓
W5-06  Release Candidate / Publication Decision              LATER REVIEW — NO AUTO-PUBLISH
```

This queue is evidence-derived, not a new feature roadmap.

### W5-02 required scope

W5-02 is the only downstream Track activated by this audit.

It must:

- replace the broad `any successful ordinary CI` release prerequisite with an explicit release-qualified exact-SHA validation prerequisite;
- preserve immutable source/tag/version binding;
- make security/full-validation evidence part of release qualification;
- ensure a release tag cannot publish from a docs-only qualification run;
- produce/verify current Windows NSIS and Apple-Silicon unsigned DMG artifacts from the release-qualified source;
- preserve checksums/SBOM/version/architecture checks;
- preserve the W4 no-production-signing decision unless a separate product decision changes it;
- remove or correct any release-body claim that is not guaranteed by the required release evidence;
- add focused workflow-contract tests for the new release prerequisite;
- **not** create a tag or GitHub Release.

If the implementation would require a new signing identity, update architecture, supported-platform expansion, new privileged service or authority redesign, stop and split/escalate rather than widening W5-02.

## W5-01 completion decision

W5-01 is complete because the current release picture is now answerable from one record:

- **What prevents a truthful first release today?** Release qualification is too broad, current product code lacks current packaged artifacts, updater policy is unresolved, and selected manual unsigned/native evidence is not yet accepted.
- **What is an implementation defect versus evidence-only?** RQ-01 is a release workflow defect; RQ-02 is an artifact freshness gap; updater is absent capability/policy; signing is intentional defer; native accessibility/display/provider items are evidence gaps.
- **What needs external fixtures?** SmartScreen/Gatekeeper/manual accessibility/display/provider/older-release upgrade evidence as listed above.
- **What should happen next?** W5-02 release qualification/publication safety, then distribution/update policy, then current-package manual acceptance.
- **Which debts may remain open?** All currently open debts may remain unless a later W5 Track demonstrates direct release risk; TD-004 is the only obvious cheap retirement candidate and is still not sequenced ahead of release blockers.

No release/tag/publication action is authorized by this closeout.
