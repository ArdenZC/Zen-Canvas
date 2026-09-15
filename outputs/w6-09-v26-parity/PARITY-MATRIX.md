# W6-09 V26 parity matrix — Settings + Quick Preview

Status: **PENDING OWNER REVIEW**

This bounded evidence package covers only Settings and Quick Preview for Issue
#241 / PR #242. It does not claim a numerical parity score, release readiness,
or final acceptance.

## Current exact-head candidate

| Field | Current exact value |
| --- | --- |
| Current code candidate | `a6c9884ece5ce44e42e9a43b65e5feebd6cdd50c` |
| Current code tree | `81831bb5b85b235ec16781cb0bdb2c51819191f8` |
| Fresh hosted CI | [34955347805](https://github.com/ArdenZC/Zen-Canvas/actions/runs/34955347805) — **SUCCESS** |
| Current native visual evidence | **UNVERIFIED / NOT RECAPTURED at this head** |
| Parity score | **PENDING OWNER REVIEW** |

The current candidate is accepted at source and contract level. No newly
captured native visual set is available for this reimplemented candidate, so
historical screenshots are not promoted to current pixel evidence.

## Accepted source and architecture state

- ADR-0009 is accepted; Floating and Pinned use one shared
  `ZenQuickPreviewSurface`.
- The right-side pinned dock is retired; details are hidden by default.
- The Preview Core, Read Gate and source-identity authorities are retained.
- The local PDF.js renderer uses opaque range-backed Preview asset access; no
  raw filesystem path is passed to the renderer.
- The duplicate Settings Appearance presentation is retired.

## Accepted PDF source and contract state

- The 1 MiB value is a per-read bound, not a total PDF limit.
- Representative sources above 1 MiB are covered by range contract tests.
- There is no 128-page product cutoff; pages are acquired/rendered near the
  viewport and page/canvas resources are cleaned.
- Encrypted PDF passwords use `PDFDocumentLoadingTask.onPassword`.
- PDF scripting remains disabled.

## Accepted macOS and Pinned contract state

- Native Quick Look provider priority is restored above builtin PDF.
- The hosted Apple Silicon Quick Look lifecycle test is **PASS**.
- Real macOS GUI visual acceptance remains **UNVERIFIED**.
- Pinned Preview remains the same centered canonical surface, with a
  pointer-transparent outside backdrop and a source frozen by the controller.

## Settings source contract

| Width | Settings columns | Secondary section navigation | Settings row controls |
| ---: | --- | --- | --- |
| 1282 | Two-column | Vertical | Two-column |
| 969 | Two-column | Vertical | Two-column |
| 840 boundary | Single content column | Horizontal scroll | Two-column |
| 760 boundary | Single content column | Horizontal scroll | Stacked single-column |

The Settings-only internal rules use the 840px and 760px boundaries. The old
1179px/1180px Settings section-navigation breakpoint is absent; the app
shell/sidebar 1100px breakpoint remains unchanged.

## Quick Preview setting truth

The row is a quiet, non-interactive capability presentation:

    快速预览
    支持的文件类型优先在应用内预览。
    状态：已启用

The fake disabled read-only Switch presentation was removed. No canonical
persisted Quick Preview preference was found, so no new persistence authority
was introduced.

## Current native visual boundary

Current visual evidence: **UNVERIFIED / NOT RECAPTURED at this head**. The
current Windows exact-source Tauri candidate was not available as a targetable
native capture session after the final reimplementation. Real macOS GUI
acceptance is also **UNVERIFIED**. The parity score remains **PENDING OWNER
REVIEW**, with no numeric score.

## Historical native evidence only

The following older runtime and screenshots are retained for comparison only;
they are not current exact-head proof. The files are physically retained under
`current/` to avoid unnecessary evidence movement, but are logically historical
in this matrix.

Historical source/runtime identity:

| Field | Historical value |
| --- | --- |
| Source HEAD | `228590489ebf779615e3f8507aeb1bc5e1704b73` |
| Source tree | `37649d07f1d6b7462cb155f06d90a83901a3b5a9` |
| Runtime | `F:\\CargoTarget\\w6-09-pr242-exact-22859048\\debug\\zen-canvas.exe` |
| Runtime SHA-256 | `CA60A367270CE82DB43CEB94344937471F8D56CB036FB9C20916B37A57353B44` |
| Native capture | `computer-use/node_repl + @oai/sky`, 1275x720 |

| Historical artifact | Logical size | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| [historical: settings-default-22859048.png](current/settings-default-22859048.png) | 1275x720 | 261396 | `D8A4C38D11DD63EAE54C33A6121C66E54721FFBB155DB62E52184AD84BD08896` |
| [historical: settings-dark-22859048.png](current/settings-dark-22859048.png) | 1275x720 | 292542 | `D621667BF0189A514ED037440F19792A9875AE32E9C3A7DC253C786A2DB5DA0D` |
| [historical: settings-compact-22859048.png](current/settings-compact-22859048.png) | 1275x720 | 292572 | `624950A97E798C993CE8A5DF01ABC9A117E7A8E6361A81DF38D565A387BEDDDB` |
| [historical: settings-dark-compact-22859048.png](current/settings-dark-compact-22859048.png) | 1275x720 | 291656 | `0CC003E1A60785CE8EA4A0A64DC5AF0CB09FFF8AAA05023D9103095A15529AE2` |
| [historical: settings-select-open-22859048.png](current/settings-select-open-22859048.png) | 1275x720 | 275323 | `2BB21A1B2F6273B9BA3347C9D98A257FAFB1E95CBE82B16B3258266A419A5A25` |
| [historical: quick-preview-floating-ready-22859048.png](current/quick-preview-floating-ready-22859048.png) | 1275x720 | 288351 | `E2F9649CC75D8433A6090B9CD201A099D8175D11D2D9B209765135605249C549` |
| [historical: quick-preview-pinned-ready-22859048.png](current/quick-preview-pinned-ready-22859048.png) | 1275x720 | 290214 | `630CA21952C2B3F24472A2C1DBC01F71BE232BD47D2AE42917B8099A5811F89F` |
| [historical: quick-preview-details-open-22859048.png](current/quick-preview-details-open-22859048.png) | 1275x720 | 309487 | `09408A1C80133EE4DC4866EE1BEECB26537380C526F95E71D4190747376BA978` |
| [historical: quick-preview-pdf-fallback-22859048.png](current/quick-preview-pdf-fallback-22859048.png) | 1275x720 | 177940 | `7C3B5BBA5EA36B0CF6BDDAB4DD4F740AE144A2312B0FEAE56BA3A5801D6E15D6` |

The former `318eb84e`, `7fe9d9d7`, `5ccca1cf`, `3f0553ad948a6ec728c4651fb2993195da7879ab`, and other pre-current captures are likewise historical only. No old evidence is deleted.

## Validation evidence

| Gate | Result |
| --- | --- |
| W3-02 browser gate | **PASS** — exact current candidate, 1600x900 and 980x680 |
| W3-03 browser gate | **PASS** — exact current candidate, 1600x900 and 980x680 |
| W3-04 browser gate | **PASS** — exact current candidate, 1600x900 and 980x680 |
| W3-05 browser gate | **PASS** — exact current candidate, 1600x900 and 980x680 |
| W3-06 browser gate | **PASS** — exact current candidate, 1600x900 and 980x680 |
| W3-07 browser gate | **PASS** — exact current candidate, 1600x900 and 980x680 |
| W3-08 browser gate | **PASS** — exact current candidate, 1600x900 and 980x680 |
| W3-09 browser gate | **PASS** — exact current candidate, 1600x900 and 980x680 |
| RustSec audit | **PASS** — fresh hosted CI 34955347805 |
| Fresh hosted exact-head CI | **PASS** — 34955347805; frontend/build, W2-01/W2-10/W2-11, Windows/macOS Rust quality, Apple Silicon Quick Look lifecycle, Windows Preview Handler, npm audit, performance and release compile lanes |
| `npm run test:docs` | **PASS** — this normalization |
| `npm run test:governance` | **PASS** — this normalization |
| Current Windows native visual acceptance | **UNVERIFIED / NOT RECAPTURED** |
| Real macOS GUI visual acceptance | **UNVERIFIED** |

No old red-CI, rustls advisory, macOS native-presentation failure, or blocked
W3 browser-gate result is current truth. No Codex Review, merge, W6-10 work, or
new PR was performed.

## Review disposition

Parity score: **PENDING OWNER REVIEW**
