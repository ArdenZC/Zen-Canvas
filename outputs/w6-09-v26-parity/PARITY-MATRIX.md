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
| Native capture | Exact-head Windows Tauri runtime | computer-use/node_repl + @oai/sky; returned process-backed exact runtime window and captured native window state |
| Native target | Live production app window | PID 13164; window id 1051076; title Zen Canvas; app process:F:\CargoTarget\w6-09-pr242-final-318eb84e\debug\zen-canvas.exe |
| Windows | Native Windows evidence | Microsoft Windows 11 专业版, version 10.0.26200, build 26200, 64-bit |
| Native screenshot sizes | 1282, 969, 840, and 760 logical px requested | Settings captures: 1275x720 for default/dark/compact/select-open; 968x720 at the native 969-boundary attempt; Quick Preview captures: 1280x672 |
| 840/760 native boundary | Capture if the native window permits | Not physically reachable in this exact runtime: native Size mode remained at the observed 968x720 minimum; src-tauri/tauri.conf.json declares minWidth: 980 |
| DPI | Not specified by target | Not independently measured |

The runtime was built from production HEAD 318eb84e0d2b4967cbb5285f5ca76bd161765ed5.
The current PNG artifacts are lossless PNG transcodes of the JPEG image payloads
returned by the exact native sky.get_window_state captures. No browser or
headless render is substituted for the current native evidence.

## Native capture provenance

- Native surface: node_repl using @oai/sky; the old cua_repl surface was not
  used for capture.
- Target selection: sky.list_apps() returned exactly one window whose
  process-backed app identifier contains the exact runtime executable path.
- Capture: sky.get_window_state with the bounded native screenshot and
  accessibility text; the largest returned screenshot was persisted as the
  evidence artifact.
- The exact runtime was restarted only to clear stale window state. No source,
  src-tauri, proxy, AppX, app.asar, or production UI file was changed in this
  evidence round.

## Settings breakpoint matrix

| Width | Settings column composition | Secondary section navigation | Settings row controls | Source contract |
| ---: | --- | --- | --- | --- |
| 1282 | Two-column | Vertical | Two-column | V26 intended desktop composition |
| 969 | Two-column | Vertical | Two-column | V26 intended desktop composition |
| 840 | Single content column | Horizontal scroll | Two-column | Settings-only max-width 840px boundary |
| 760 | Single content column | Horizontal scroll | Stacked single column | Settings-only max-width 760px boundary |

The app shell/sidebar breakpoint remains unchanged at 1100px. The Settings
implementation no longer uses 1179px or 1180px for its internal section-nav
composition. The exact native runtime reached the Settings minimum-width
surface at 968x720; the 840/760 rows therefore remain source/test-contract
evidence only in this native package.

## Quick Preview setting truth

The Settings Quick Preview row is a quiet, non-interactive capability
presentation:

快速预览
支持的文件类型优先在应用内预览
状态：已启用

The fake disabled Switch presentation and its read-only painted-switch CSS were
removed. A repository search found no canonical persisted Quick Preview
enable/disable preference, so no new persistence authority was introduced.
Quick Preview geometry was not changed in this evidence round.

## State matrix

| Surface/state | V26 target | Current exact-head native evidence | Observed state / boundary |
| --- | --- | --- | --- |
| Settings — light/default | Settings calm light default | [current/settings-default-318eb84e.png](current/settings-default-318eb84e.png) | 1275x720; light/follow-system; About section visible |
| Settings — dark | Settings dark theme | [current/settings-dark-318eb84e.png](current/settings-dark-318eb84e.png) | 1275x720; Deep Sea theme; default density |
| Settings — compact | Settings compact density | [current/settings-compact-318eb84e.png](current/settings-compact-318eb84e.png) | 1275x720; Deep Sea theme; compact density |
| Settings — appearance select open | Visible native Zen Select | [current/settings-select-open-318eb84e.png](current/settings-select-open-318eb84e.png) | 1275x720; popup visible and selected Deep Sea item checked |
| Settings — 969 | Two-column Settings composition | [current/settings-969-318eb84e.png](current/settings-969-318eb84e.png) | Observed native 968x720 minimum; two-column content and vertical section nav |
| Settings — 840 boundary | Single content column and horizontal section nav | Not generated natively | Exact runtime minimum remained 968x720; no 840 screenshot is claimed |
| Settings — 760 narrow | Stacked Settings rows | Not generated natively | Exact runtime minimum remained 968x720; no 760 screenshot is claimed |
| Quick Preview — floating ready | Floating ready preview | [current/quick-preview-floating-ready-318eb84e.png](current/quick-preview-floating-ready-318eb84e.png) | 1280x672; 项目4.txt; 预览内容已准备好 |
| Quick Preview — pinned ready | Pinned ready preview | [current/quick-preview-pinned-ready-318eb84e.png](current/quick-preview-pinned-ready-318eb84e.png) | 1280x672; 项目4.txt; pinned host; 预览内容已准备好 |
| Quick Preview — PDF fallback | Truthful PDF fallback | [current/quick-preview-pdf-fallback-318eb84e.png](current/quick-preview-pdf-fallback-318eb84e.png) | 1280x672; 准考证_苑中亚_411722200503238230.pdf; boundary_readable |
| Quick Preview — normal ready text/image | Normal ready text/image state | [current/quick-preview-normal-ready-318eb84e.png](current/quick-preview-normal-ready-318eb84e.png) | 1280x672; 项目4.txt text content; 预览内容已准备好 |

## Zen Select native proof

The existing createPortal(document.body) popup fix is retained. No Select
redesign was made. The exact-head screenshot
[current/settings-select-open-318eb84e.png](current/settings-select-open-318eb84e.png)
shows:

- popup visible;
- no horizontal overflow;
- popup width matching the appearance control;
- popup anchored to the appearance control;
- Deep Sea is the selected item and has the check mark;
- the trigger has the active/focus outline;
- popup is not clipped by the Settings content surface.

## Current screenshot SHA-256 inventory

| Artifact | Logical size | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| [current/settings-default-318eb84e.png](current/settings-default-318eb84e.png) | 1275x720 | 188643 | 58F249262E129ED5940A7DC82752000CB69EEDBA33C183B548A758629C309C5D |
| [current/settings-dark-318eb84e.png](current/settings-dark-318eb84e.png) | 1275x720 | 208171 | B597FEDBCF8928CEFBB2B44632F312F0BF5C2B911D6D5762A29629CDE3980A29 |
| [current/settings-compact-318eb84e.png](current/settings-compact-318eb84e.png) | 1275x720 | 206021 | 233005B07DB9BD58AB2B72D4B1DDB77EFDEC9DBE83FEF8356696C574C703446C |
| [current/settings-select-open-318eb84e.png](current/settings-select-open-318eb84e.png) | 1275x720 | 281826 | 9C2241706DE5EBA4E4BDD068B752695674D59EE8A5A7EAFEBABD051B9C90F093 |
| [current/settings-969-318eb84e.png](current/settings-969-318eb84e.png) | 968x720 | 255344 | B1E1030A7465470A1DFFC4CC1FFB26239AA7BF553CDEA811AAB97D8C1C3D1F0D |
| [current/quick-preview-floating-ready-318eb84e.png](current/quick-preview-floating-ready-318eb84e.png) | 1280x672 | 268435 | 6677737A4A0D5D641AA8757E995149C427FAB18B978211508847AA41075B8912 |
| [current/quick-preview-pinned-ready-318eb84e.png](current/quick-preview-pinned-ready-318eb84e.png) | 1280x672 | 225366 | AE5AEBFCA75A6C4BF70248FF39ADA642CC02BBE704595E43616D31D411580EAB |
| [current/quick-preview-pdf-fallback-318eb84e.png](current/quick-preview-pdf-fallback-318eb84e.png) | 1280x672 | 234151 | 558C337002E2F5DBA5F537726FEDBD981E48BA2E380429C14BB0ABB51C8E377E |
| [current/quick-preview-normal-ready-318eb84e.png](current/quick-preview-normal-ready-318eb84e.png) | 1280x672 | 268435 | 6677737A4A0D5D641AA8757E995149C427FAB18B978211508847AA41075B8912 |

No current artifact is created for the native-unreachable 840px or 760px
requests.

## Historical evidence only

The formerly named current/ screenshots were moved to historical/ and are
retained for provenance only. They must not be used as current proof. The prior
matrix identified the principal legacy capture as production HEAD
3f0553ad948a6ec728c4651fb2993195da7879ab with tree
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

The historical 3f0553ad evidence is not canonical current proof.

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
| Native Settings / Quick Preview screenshot capture | PASS — exact runtime via node_repl + @oai/sky; current artifacts and hashes recorded above |

## Hosted CI

Fresh hosted evidence CI [`34773058766`](https://github.com/ArdenZC/Zen-Canvas/actions/runs/34773058766)
completed successfully for the exact screenshot artifact commit
`48f94c115d19c2140830fe7ac68cba24b53b6323` (tree
`32e16e4f6935b09770331076f28fa36b86f47ae7`). The run checked out the exact
PR head and passed source checkout/evidence contract, change-scope routing,
validation-lane planning, frontend and format quality, W2-01/W2-10/W2-11,
Performance Preview Platform/Search/profile, and Windows/macOS quality
dependency checks. The release/package/Rust/native Preview Handler/macOS
performance lanes and unrelated performance shards were skipped by the
evidence-only routing contract. The runtime/source identity exercised by the
native screenshots remains pinned to production HEAD `318eb84e` / tree
`5725aa0484372576ff142b8bd0bca9c24126b0a1`; this matrix update is a
documentation-only successor and does not change that production identity.

## Review disposition

Parity score: **PENDING OWNER REVIEW**

The current evidence is ready for the owner checkpoint. The 840px and 760px
native screenshot requests remain explicitly unmaterialized because the exact
Windows runtime stopped resizing at its native 968x720 minimum; source tests
cover those Settings-only breakpoint contracts.
