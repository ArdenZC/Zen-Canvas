# W6-09 V26 parity matrix — Settings + Quick Preview

Status: **PENDING OWNER REVIEW**

This is a bounded evidence package for Issue #241 / PR #242. It covers only
Settings and Quick Preview. It does not claim a numerical score, release
readiness, or final acceptance.

## Current production identity

| Field | V26 target | Current exact production source |
| --- | --- | --- |
| Source | target/zen-canvas-full-product-showcase-v26-windows.html | Production HEAD 318eb84e0d2b4967cbb5285f5ca76bd161765ed5; tree 5725aa0484372576ff142b8bd0bca9c24126b0a1 |
| Runtime | Synthetic showcase | F:\CargoTarget\w6-09-pr242-final-318eb84e\debug\zen-canvas.exe |
| Runtime SHA-256 | N/A | 7F8F5B3A352EC06FAE460860E22B220CFFB1B91B95E31D9868C47C877932A822 |
| Native capture | Headless target render | Not generated: the native CUA trusted RPC service returned “Trusted RPC service is not configured: sky”; no current native screenshot is claimed |
| Requested Settings sizes | 1282, 969, 840, and 760 logical px | Not captured natively in this run; browser/headless output is not substituted for native proof |
| DPI | Not specified by target | Not independently measured |

The production source identity above is the source used to build the runtime.
The native screenshot set remains unmaterialized because the capture service
was unavailable. No legacy screenshot is current proof.

## Settings breakpoint matrix

| Width | Settings column composition | Secondary section navigation | Settings row controls | Source contract |
| ---: | --- | --- | --- | --- |
| 1282 | Two-column | Vertical | Two-column | V26 intended desktop composition |
| 969 | Two-column | Vertical | Two-column | V26 intended desktop composition |
| 840 | Single content column | Horizontal scroll | Two-column | Settings-only max-width 840px boundary |
| 760 | Single content column | Horizontal scroll | Stacked single column | Settings-only max-width 760px boundary |

The app shell/sidebar breakpoint remains unchanged at 1100px. The Settings
implementation no longer uses 1179px or 1180px for its internal section-nav
composition.

## Quick Preview setting truth

The Settings Quick Preview row is now a quiet, non-interactive capability
presentation:

快速预览
支持的文件类型优先在应用内预览
状态：已启用

The fake disabled Switch presentation and its read-only painted-switch CSS were
removed. A repository search found no canonical persisted Quick Preview
enable/disable preference, so no new persistence authority was introduced.
Quick Preview geometry was not changed in this round.

## State matrix

Current native evidence for every row below is **NOT GENERATED** because the
native CUA service was unavailable. The target links remain useful target
references only.

| Surface/state | V26 target | Current exact-head native evidence | Boundary |
| --- | --- | --- | --- |
| Settings — light/default | [target/settings-default.png](target/settings-default.png) | Not generated | Source/test contract covers the 1282 and 969 compositions; native visual confirmation is pending |
| Settings — dark | [target/settings-dark.png](target/settings-dark.png) | Not generated | Native dark visual confirmation is pending |
| Settings — compact | [target/settings-compact.png](target/settings-compact.png) | Not generated | Native compact visual confirmation is pending |
| Settings — appearance select open | [target/settings-select-open.png](target/settings-select-open.png) | Select-open screenshot not generated | Portal source fix is retained; native proof of visible popup, width, anchor, selected item, focus, no overflow, and no clipping is pending |
| Settings — 969 | [target/settings-default.png](target/settings-default.png) | Not generated | Responsive source/test contract says V26 two-column and vertical section nav |
| Settings — 840 boundary | [target/settings-default.png](target/settings-default.png) | Not generated | Responsive source/test contract says single content column and horizontal section nav |
| Settings — 760 narrow | [target/settings-narrow.png](target/settings-narrow.png) | Not generated | Responsive source/test contract says stacked rows; native window permission/size evidence is pending |
| Quick Preview — floating ready | [target/quick-preview-floating-ready.png](target/quick-preview-floating-ready.png) | Not generated | Exact-head native ready-state visual confirmation is pending |
| Quick Preview — pinned ready | [target/quick-preview-pinned-ready.png](target/quick-preview-pinned-ready.png) | Not generated | Exact-head native pinned-state visual confirmation is pending |
| Quick Preview — PDF fallback | [target/quick-preview-pdf.png](target/quick-preview-pdf.png) | Not generated | Exact-head native PDF fallback visual confirmation is pending |
| Quick Preview — normal ready text/image | [target/quick-preview-floating-ready.png](target/quick-preview-floating-ready.png) | Not generated | Exact-head native normal ready visual confirmation is pending |

## Zen Select native proof checklist

The existing createPortal(document.body) popup fix is retained. No Select
redesign was made. Native proof still required:

- popup visible;
- no horizontal overflow;
- correct width;
- correct anchor;
- correct selected item;
- active/focus state visible or inspectable;
- popup not clipped.

This checklist is **UNVERIFIED** for the current production runtime because the
native capture service did not expose a live window.

## Historical evidence only

The formerly named current/ screenshots were moved to
historical/ and are retained for provenance only. They must not be used as
current proof. The prior matrix identified the principal legacy capture as
production HEAD 3f0553ad948a6ec728c4651fb2993195da7879ab with tree
b50dab95a13e3ed809004688adc83bc84bdb22b7; that identity is historical and is
not the source identity above.

| Historical capture | SHA-256 |
| --- | --- |
| [historical/settings-default.png](historical/settings-default.png) | 300C0111A16B0AED26440AF88AA838A2D9D280FEE2E9DC69CC3C6C9F4E9B52F8 |
| [historical/settings-default-exact-head.png](historical/settings-default-exact-head.png) | 58009ADB86929BC31F70DC33CB83B2996984775A73CCAF94024D6ADA9BD1859F |
| [historical/settings-default-switch-fixed.png](historical/settings-default-switch-fixed.png) | 30E719A6BD813CC6AF3AC929B65BE761B65C802FA32BCAB708E4CB9C4AAD8693 |
| [historical/settings-dark.png](historical/settings-dark.png) | 983635C96FE5C2A2A7EFE33057B42E920BF9BF39904B4095CC63A351DDFAD3A3 |
| [historical/settings-compact.png](historical/settings-compact.png) | CCAAF2B6B1628333DC9C4FACEADECE62206FFB857B2AFAC36380C031D99EC564 |
| [historical/settings-select-open.png](historical/settings-select-open.png) | 77B412009D3AB3E9D263565EC15FCD4B44332620340D97384D0D9B6641ED6FBA |
| [historical/settings-min-width.png](historical/settings-min-width.png) | 956D296B5A916A2FB5AE55D62D39C9DFC4D0826F51B24B9279608678001091C9 |
| [historical/quick-preview-pdf-v26.png](historical/quick-preview-pdf-v26.png) | 7B5FCEE7EED639B723B0E7CA88A17B6A73AE1E9D5EE7FA8F8FD39B826A5A9BE1 |
| [historical/quick-preview-floating-ready.png](historical/quick-preview-floating-ready.png) | CE94E90104C5F6160E84F3D48B6442F366BEEAA6272F741434DB80BB2D346CB8 |
| [historical/quick-preview-pinned-ready.png](historical/quick-preview-pinned-ready.png) | 1BB5909F93383F10A0A2F8D471214A1C11240909AB5558E0D2B7C2834E8B1603 |

## Validation evidence for production HEAD 318eb84e

| Gate | Result |
| --- | --- |
| npm run typecheck | PASS |
| Focused Settings / Select / Switch / Preview Vitest set | PASS — 6 files, 46 tests |
| npm test | PASS — 148 files, 1580 tests |
| npm run test:remediation | PASS — 14 tests |
| npm run test:performance:architecture | PASS — 28 tests |
| npm run build:frontend | PASS — existing CSS/dynamic-import/chunk-size warnings only |
| npm run build:native-preview-handler | PASS — packaged DLL; existing linker warning only |
| npm run check:rust:release | PASS |
| npm run verify:rust | PASS — fmt, Rust unit/integration suites, clippy |
| npm run test:browser:w2-01 | PASS — contract 8 tests plus all real scenes; source HEAD/tree matched |
| python docs/design/w6-06/07-v26/rebuild-v26.py --verify-only | PASS — 4/4 |
| Exact-head Tauri runtime build | PASS — runtime path and SHA-256 recorded above |
| Native Settings / Quick Preview screenshot capture | BLOCKED — trusted CUA RPC service unavailable |

## Hosted CI

Fresh hosted CI run
[34769747563](https://github.com/ArdenZC/Zen-Canvas/actions/runs/34769747563)
completed successfully on evidence commit
f4b7597bb69efa4655f7776c735977825c6655c8. That commit is a docs/evidence
successor of production source HEAD 318eb84e0d2b4967cbb5285f5ca76bd161765ed5;
the production source tree and runtime identity above remain unchanged.

Passed hosted jobs: source checkout/evidence, change-scope routing,
frontend/format quality including W2-01, W2-10, and W2-11, performance
prepare, performance search, performance preview platform, performance
profile, and Windows/macOS quality dependency checks.

The hosted package, release compile, Rust quality, native Preview Handler,
native macOS performance, package metadata, dependency audit, and
documentation-only matrix jobs were actually skipped by the workflow route.
They are not represented as hosted PASS here. Local Rust, frontend, and
Windows Preview Handler results are recorded in the validation table above.

## Review disposition

Parity score: **PENDING OWNER REVIEW**

The source and automated gates are ready for the owner checkpoint. Native
visual confirmation remains explicitly unverified because the required live
window capture service was unavailable.
