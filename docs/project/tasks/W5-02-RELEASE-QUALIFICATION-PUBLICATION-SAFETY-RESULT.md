# W5-02 — Release Qualification & Publication Safety Gate — Result

Status: **COMPLETE / CLOSED — W5-03 DISTRIBUTION / UPDATE STRATEGY NEXT / ELIGIBLE, NOT YET ACTIVE**

Implementation PR: `#181` — `fix(ci): require full validation before release publication`.

Reviewed candidate head: `82dcfe47239c2bbf4854965275a6da71073d3979`.

Accepted implementation merge: `master@f99b3a538cd1608fbf590bae6d4fc66f0cd53809`; tree `4c90fa2016f1758bf4fb73459f3a29ebfcc0ad1f`.

W5 remains **ACTIVE — implementation**. No Git tag or GitHub Release was created by W5-02.

## Executive result

W5-02 closes both release blockers identified by W5-01.

1. Release publication no longer accepts an arbitrary successful ordinary `CI` run. `release-build.yml` now requires a successful `CI Full Validation` for the exact release SHA and independently checks that the required release-grade jobs completed successfully.
2. The accepted W5-02 source tree produced fresh Windows x64 NSIS and Apple-Silicon unsigned-DMG package evidence, together with the required supported-platform quality, release-compile, native, dependency and performance lanes.

The Track does not make Zen Canvas released, signed, notarized or publication-ready. `Implemented`, `Validated`, `Packaged` and `Released` remain distinct states.

## Release qualification contract

A future release SHA is qualified only when all of the following are true:

- the selected workflow is `CI Full Validation` (`ci-full.yml`), not ordinary proportional `CI`;
- the validation run is `completed / success`;
- the validation run is bound to the exact release SHA;
- the run was produced by the repository's manual or scheduled Full Validation entry point;
- required source evidence and lane-plan jobs passed;
- `Quality (windows-latest)` passed;
- `Quality (macos-latest)` passed;
- `Package NSIS` passed;
- `Package unsigned DMG` passed;
- `Dependency audit` passed.

Focused adversarial tests reject docs-only ordinary CI, wrong SHA, failed/cancelled/incomplete validation, and skipped/missing required jobs.

Existing release controls remain in place: tag/version binding, installer existence/version/architecture checks, SHA-256 checksums, Node/Rust CycloneDX SBOMs, and final downloaded-artifact verification.

## Accepted implementation and source identity

The final candidate and merge preserve one identical source tree:

| Surface | Commit | Tree | Meaning |
| --- | --- | --- | --- |
| PR reviewed head | `82dcfe47239c2bbf4854965275a6da71073d3979` | `4c90fa2016f1758bf4fb73459f3a29ebfcc0ad1f` | reviewed W5-02 candidate |
| GitHub PR merge-integration commit used by integration/package lanes | `47e5c9f710236f7b64d7230dfeb6aec373c22d37` | `4c90fa2016f1758bf4fb73459f3a29ebfcc0ad1f` | candidate integrated with unchanged W5-01 base |
| final squash merge on `master` | `f99b3a538cd1608fbf590bae6d4fc66f0cd53809` | `4c90fa2016f1758bf4fb73459f3a29ebfcc0ad1f` | accepted implementation baseline |

The source-evidence job explicitly checked out the reviewed PR head `82dcfe47239c2bbf4854965275a6da71073d3979` and recorded actual tree `4c90fa2016f1758bf4fb73459f3a29ebfcc0ad1f`. Package/integration lanes checked out the GitHub merge-integration commit, whose tree is identical. The squash merge also preserves the same tree. Therefore the accepted package evidence and the merged implementation are tree-identical.

## Hosted validation evidence

PR-head routed CI:

- run: `33880988509` (`CI #1144`)
- PR head: `82dcfe47239c2bbf4854965275a6da71073d3979`
- aggregate result: **SUCCESS**
- source evidence job: `101049314237` — success
- source evidence artifact: `9939825266` (`ci-source-evidence`), SHA-256 `31edb6983806b3bbc183af1a6fe6a68e8c5fd7234ba9fba19e8d69a1fa657856`
- Windows quality: `101053162787` — success
- macOS quality: `101052206296` — success
- Windows NSIS package: `101049497151` — success
- macOS unsigned DMG package: `101049497171` — success
- dependency audit: `101049497543` — success
- Windows release compile: `101049497195` — success
- macOS release compile: `101049497395` — success
- Windows native Preview Handler: `101049497390` — success
- performance profile and required shards: success

The package jobs produced these artifact identities from the accepted tree:

- Windows x64 NSIS: `Zen Canvas_0.1.40_x64-setup.exe`
- macOS Apple Silicon unsigned DMG: `Zen Canvas_0.1.40_aarch64.dmg`

The PR CI package jobs are validation jobs and did not persist the installers as GitHub uploaded workflow artifacts; their authoritative W5-02 evidence is the successful package jobs/logged artifact identity plus the source-tree identity above. W5-02 does not reinterpret those ephemeral validation outputs as a published Release asset.

## Local/focused evidence on final PR head

The final remediation-only change to `tests/remediationContract.test.ts` aligned the contract with the already accepted unsigned/no-sign policy and did not weaken any signing/notarization prohibition.

Reported final local validation on `82dcfe47239c2bbf4854965275a6da71073d3979`:

- focused Vitest: 4 files / 57 tests passed;
- `npm run typecheck`: passed;
- `npm test`: 133 files / 1476 tests passed;
- `npm run test:remediation`: 14 tests passed;
- `npm run test:performance:architecture`: 25 tests passed;
- `git diff --check`: passed;
- working tree clean.

Hosted CI then independently passed the routed full release-grade matrix.

## Dependency/security remediation

Full validation found the transitive Browserslist lock at vulnerable `4.28.2`. W5-02 did not weaken or bypass the dependency gate. Instead it performed a bounded npm-generated transitive lock refresh to `browserslist 4.28.8` and its required browser-data dependencies, without changing `package.json`.

The one-shot lock-refresh workflow used to generate/verify that lock update was removed before the final PR diff. Final dependency audit passed for npm and RustSec.

## Unsigned distribution truth

The W4 product decision remains authoritative:

- Windows Authenticode: **NOT PROVIDED / intentionally deferred**;
- macOS Developer ID: **NOT PROVIDED / intentionally deferred**;
- Apple notarization: **NOT PROVIDED / intentionally deferred**;
- stapling: **NOT PROVIDED / intentionally deferred**.

The release body now states those facts directly and does not claim signing/notarization PASS, SmartScreen/Gatekeeper acceptance, updater availability, or manual accessibility/provider/display PASS.

Successful package production does not imply public reputation or first-launch acceptance. Those real-platform warning/install/launch facts remain W5-04 evidence.

## W5-01 blocker disposition

| Blocker | W5-02 disposition |
| --- | --- |
| RQ-01 — ordinary green CI can satisfy release prerequisite | **CLOSED.** Future publication requires exact-SHA `CI Full Validation` plus required successful release-grade jobs. |
| RQ-02 — current post-TD-014 code lacked fresh packages | **CLOSED.** Accepted tree produced Windows x64 NSIS and Apple-Silicon unsigned DMG package evidence in CI #1144. |
| RQ-03 — unsigned public warning/launch acceptance | **OPEN / later evidence.** Product no-sign decision preserved; manual acceptance belongs to W5-04. |
| RQ-04 — updater/update strategy absent | **OPEN / next decision.** W5-03 owns manual-download versus separately reviewed updater strategy. |
| RQ-05 — selected manual/native release matrix incomplete | **OPEN / later evidence.** W5-04. |
| RQ-06 — historical Scheduler 2x-idle target missed | **UNCHANGED / non-blocking.** W5-05 only if current evidence makes it material. |

## Review / merge truth

- PR #181 final reviewed head: `82dcfe47239c2bbf4854965275a6da71073d3979`.
- PR state before merge: open, non-Draft, mergeable.
- no PR review comments/blockers were present at final review.
- merge method: squash.
- accepted merge: `f99b3a538cd1608fbf590bae6d4fc66f0cd53809`.
- merge verification: GitHub `verified / valid`.
- accepted tree: `4c90fa2016f1758bf4fb73459f3a29ebfcc0ad1f`.

## Resulting current truth

```text
W5 ACTIVE — implementation
W5-01 COMPLETE / CLOSED
W5-02 COMPLETE / CLOSED
Release qualification requires exact-SHA CI Full Validation
Current Windows NSIS Packaged / Validated for accepted W5-02 tree
Current macOS unsigned DMG Packaged / Validated for accepted W5-02 tree
Signing/notarization still intentionally deferred by product decision
Release none
Tag none
W5-03 Distribution / Update Strategy NEXT / ELIGIBLE, NOT YET ACTIVE
```

W5-03 requires its own reviewed scope/activation before implementation. W5-02 does not silently authorize an updater or publish a release.
