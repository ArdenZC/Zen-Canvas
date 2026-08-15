# Post-V4.3 Repository Remediation Closeout

Date: 2026-08-13
Repository: `ArdenZC/Zen-Canvas`
Implementation validation head for the final release workflow: `53168f8ece61a42a4ae1bbe669aacf975687d3ac`
Branch: `master`
Baseline ancestor: `9ea69d29143b994c8632747ab647f59637dfe324`

Final unsigned remote evidence run: [31652573285](https://github.com/ArdenZC/Zen-Canvas/actions/runs/31652573285)

This closeout records the requested Post-V4.3 repository remediation. It preserves Schema 34, the existing backend authority boundaries, the existing safety gates, and the existing product scope. No Task 09, Schema 35, new product module, pull request, tag, or GitHub Release was created.

## Completed

### Phase 1 — correctness and authority

- File Library result ownership now invalidates pending page and exact-count work when results are cleared, preventing stale responses from repopulating a new query.
- Content Understanding active-run hydration uses the backend-authoritative exact-file lookup and selects the newest non-terminal run; it no longer relies on a bounded renderer candidate list.
- Focused race, stale transition, cross-file, terminal-state, and fail-closed tests were added.

### Phase 2 — unsigned release engineering

- Release checkout and tag provenance are checked against the exact workflow commit.
- Package, lockfile, Tauri, Cargo, and tag version metadata must agree.
- Windows NSIS and macOS DMG jobs require real, non-empty, version-matching artifacts.
- Final downloaded release artifacts are revalidated for existence, version, provenance, and checksum coverage.
- Checksums are generated and verified against the final uploaded artifact files.
- The macOS checksum manifest records each final DMG by basename, matching the uploaded artifact name used by final verification.
- Node and Rust CycloneDX SBOMs are required, non-empty, and structurally validated.
- Release publication requires the build matrix and its validation steps through `needs: build`, with unmatched upload files failing closed.
- Static coverage verifies skipped jobs cannot be represented as successful release evidence and that stale or mismatched artifacts fail.

### Phase 3 — frontend runtime and performance

- Browser mock loading is development-only and dynamic; production `tauriApi` no longer has a static browser mock dependency.
- File Library selection membership uses a stable cached `Set` while preserving the `LibrarySelectionV1` wire contract and all selection modes.
- App shell context ownership is split into I18n, Navigation, Command, Window, and Theme contexts, reducing unrelated context propagation.
- Settings domain data loads are independent of language changes; mounted language-switch regression coverage protects against refetching.
- File Library pagination architecture checks follow the query controller and domain API split rather than mistaking a moved implementation for a bypass.

### Phase 4 — frontend maintainability

- The Tauri facade now delegates to domain API modules over shared invocation/listener infrastructure.
- Settings navigation/global-index controllers and the Vault query controller are extracted without changing public behavior.
- i18n dictionary/types are separated behind the compatibility facade.
- Operation Queue selectors and preview helpers are internally separated while preserving compatibility exports.

### Phase 5 — verified legacy retirement

- The obsolete renderer `useStorageCleanupStore` and its tests were removed after production-call-site evidence showed durable Analysis Run/Finding state was the only Cleanup page authority.
- Remaining legacy paths are retained only where active production callers or compatibility boundaries still require them; they are documented in `docs/remediation/LEGACY_RETIREMENT_PLAN.md` and the V4.3 authority map.

### Phase 6 — behavior-preserving Rust modularization

- Organization query internals were split into `organization/{mod.rs,cursor.rs,projection.rs,queries.rs}`.
- File Library internals were split into `library/{mod.rs,tags.rs,saved_views.rs}`.
- Rule Proposal, Analysis, and Dedupe projection/predicate internals were split into their respective module directories.
- Public command names, DTOs, error codes, schema, and behavior were preserved; focused domain tests passed after each split.

## Authority and legacy paths

| Surface | Final authority | Retained compatibility path |
| --- | --- | --- |
| File Library | File Library Query V2 and result/selection stores | `useFileLibraryStore` remains for active legacy callers and bootstrap compatibility |
| Content Understanding | backend Content Run lookup and Content Scope policy | no renderer candidate-list authority |
| Storage Cleanup | durable Analysis Run/Finding/Evidence/Decision | obsolete renderer cleanup store retired |
| Organize | durable Organization Plan and item ledger | existing edited-filename bridge remains in the operation queue |
| Global Search | Global Index repository | managed-AI legacy queue adapter remains an active compatibility boundary |
| Automation | Rule Repository V2 | no legacy rule mutation commands were restored |
| API | domain API modules with shared core and `tauriApi` facade | facade remains the public renderer boundary |
| Rust queries | split domain modules | command registration and DTO surface unchanged |

No second Global Index, queue, generic runtime, reconciliation framework, filesystem authority, or persistence schema was introduced.

## Important product decisions

### Release distribution model

Distribution model: UNSIGNED

Windows Authenticode:
OUT OF SCOPE

macOS Developer ID:
OUT OF SCOPE

Apple notarization:
OUT OF SCOPE

Stapling:
OUT OF SCOPE

Signing/notarization is not P0/P1/P2 and is not a Release blocker.

No signing certificate was purchased or configured. No signing secret was added. The workflow was not refactored to introduce signing. The release gate is limited to real unsigned NSIS/DMG packaging, release compilation, exact commit/tag ownership, non-empty artifact validation, metadata consistency, final-artifact checksum, SBOM, dependency/security audit, stale-artifact rejection, and publish dependency ordering.

The local Windows package produced by the final build was:

- `F:\CargoTarget\release\bundle\nsis\Zen Canvas_0.1.40_x64-setup.exe`
- size: `7,171,586` bytes
- SHA-256: `DEC51C49F1E5C79230DEB3B2556987BD6E57C1542652D1CC23C40100742F90F7`

This local package was not published.

The final remote unsigned workflow run (`31652573285`, head `53168f8`) completed with both platform jobs successful. Downloaded final artifacts were independently checked after upload:

- Windows NSIS: `Zen Canvas_0.1.40_x64-setup.exe`, `7,117,099` bytes, SHA-256 `D5C26C58C7E6ACEE2C28A21CB0670494B01A03810BF70CB8B84243F9DD68D774`.
- macOS unsigned DMG: `Zen Canvas_0.1.40_aarch64.dmg`, `10,842,133` bytes, SHA-256 `3E801BA4E8D97EC504842418F5FAF33CB19C6FCB71B66D1CBBD5734C2A672615`.
- Both downloaded checksum manifests matched the recomputed hash of the corresponding final uploaded artifact. Node and Rust SBOMs for both platforms were non-empty CycloneDX documents.
- `Publish GitHub Release` was skipped because the validation ref was `master`, not a tag; no skipped job was represented as verified release evidence.

## Files changed

The implementation was delivered in the following commits:

- `8bdf83b` — File Library stale-clear race and Content active-run authority.
- `f045d1c` — unsigned release provenance, artifact, checksum, SBOM, and publish gates.
- `1ac508b` — frontend runtime, selection, context, Settings, and bundle overhead.
- `3376cfb` — frontend API/domain/controller boundaries and internal splits.
- `06f6a38` — verified retirement of the obsolete Cleanup renderer store.
- `2532b26`, `65c0bd9`, `938f025`, `f5e8bf2`, `06d4101`, `5133d9d`, `e89be2d` — behavior-preserving Rust query modularization.
- `53168f8` — corrected macOS checksum manifests to bind hashes to uploaded artifact basenames and added the contract assertion.

The final closeout update also changes:

- `.github/workflows/release-build.yml`
- `scripts/performanceArchitectureGuard.mjs`
- `scripts/runPerformanceTest.mjs`
- release and architecture contract tests under `tests/`
- this closeout document

## Tests and commands run

All commands were run from `F:\Coding\Zen-Canvas` with task-scoped temporary/cache/target locations on `F:`.

| Command | Result |
| --- | --- |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd test -- --reporter=dot` | PASS — 99 files, 1039 tests |
| `npm.cmd run test:remediation` | PASS — 14 tests |
| `npm.cmd run test:performance` | PASS — full profile, including 100k FTS, Global Search, managed scan, migration/WAL, Analysis, Dedupe, Organization, and Rule Proposal scenarios |
| `npm.cmd run build:check` | PASS — Vite 2104 modules and Cargo release check |
| `npm.cmd run build` | PASS — Windows release compile and real NSIS bundle |
| `npm.cmd run verify:rust` | PASS — fmt check, 598 Rust tests/integration tests, clippy `-D warnings` |
| `npm.cmd run verify:security` | PASS — npm audit 0 vulnerabilities; Rust audit reported 15 existing allowed warnings and exited 0 |
| `npm.cmd exec vitest run tests/performanceArchitecture.test.ts tests/remediationContract.test.ts -- --reporter=dot` | PASS — 304 tests |
| `git diff --check` and `git diff --cached --check` | PASS on the final working and staged diffs |
| `gh workflow run release-build.yml --repo ArdenZC/Zen-Canvas --ref master` / run `31652573285` | PASS — Windows NSIS and macOS unsigned DMG jobs; compile, quality, performance, security, SBOM, checksum, and upload gates all succeeded; publish correctly skipped on non-tag ref |

The Rust audit output contains the existing allowed advisory set, including unmaintained GTK/unic/proc-macro dependencies and the existing glib unsoundness advisory. No advisory was suppressed by this remediation.

## Visual verification

Using the local Vite browser preview with the browser mock:

- Light Chinese Overview at 1280×800: verified rendered navigation, Overview task state, space summary, system coverage, and recent activity.
- Dark English Preferences at 1280×800: verified rendered section navigation, language/theme controls, and settings content.
- Dark Chinese Preferences at 980×680: verified rendered compact/narrow section layout and visible controls.
- Light English Preferences at 980×680: verified rendered compact/narrow layout and visible controls.
- The local app was reloaded after viewport changes and the viewport was restored to 1280×800.
- Remote run `31652573285` verified Windows NSIS and macOS unsigned DMG packaging, final artifact existence/non-empty checks, checksum coverage, and SBOM validation on the pushed head.

Not verified in this environment: native Tauri window behavior, Windows DPI 125/150/200%, Windows High Contrast/Narrator, macOS Retina/VoiceOver, install/upgrade/uninstall behavior, and native visual inspection of the packaged installers. Browser preview evidence is not substituted for native/platform evidence.

## Acceptance checklist

- [x] Baseline ancestor `9ea69d29143b994c8632747ab647f59637dfe324` is present.
- [x] Final branch is `master`; no new branch was created.
- [x] Schema remains 34; no Schema 35 migration was added.
- [x] File Library stale-clear race is protected.
- [x] Content active-run lookup is backend-authoritative and fail-closed.
- [x] Browser mock is isolated from the production import path.
- [x] Selection, context, Settings, API, controller, and Rust modularization changes preserve existing contracts.
- [x] Obsolete Cleanup renderer store was retired only after call-site verification.
- [x] Full frontend, performance, build, Rust, and security gates pass locally.
- [x] Windows NSIS real local build passed and is non-empty.
- [x] Release workflow statically enforces exact provenance, final-artifact checksum, SBOM, stale-artifact/version checks, and publish dependency ordering.
- [x] UNSIGNED distribution fields are explicit; signing/notarization are out of scope and not blockers.
- [x] Remote Windows NSIS and macOS unsigned DMG workflow run on the final release-workflow head `53168f8` — run `31652573285` passed; downloaded final artifacts matched their manifests.
- [ ] Native and cross-platform visual/accessibility matrix — platform evidence pending.

## Deferred or unverified

- No GitHub tag or Release was created, so no public artifact was published.
- macOS DMG cannot be built on this Windows host.
- Native Tauri lifecycle, DPI, High Contrast, screen-reader, Retina, VoiceOver, install/upgrade/uninstall, and SmartScreen checks require their respective environments.
- Existing frontend test output contains React `act(...)` environment warnings while the test process exits successfully; no new failure was observed.
- Vite retains the existing chunk-size and Tailwind plugin-timing warnings.

## Risks requiring human review

- Reviewers should inspect the final remote workflow evidence for both Windows and macOS jobs and confirm that artifact names, checksums, SBOMs, and exact commit ownership are all from the same final workflow run.
- Earlier Windows validation attempts exposed runner-side performance variance at the existing fixed thresholds; the final independent run passed without changing those thresholds. Reviewers should retain the performance gate as a real gate.
- Reviewers should confirm the unsigned distribution warning/UX is appropriate for the intended audience; this is a product/release decision, not a signing gate.
- Reviewers should perform native Windows and macOS accessibility and window-management checks before public distribution.
