# W6-09 Quick Preview visual remediation — V26 parity matrix

Status: **PENDING OWNER REVIEW**

This bounded evidence package covers only the Quick Preview presentation
remediation for Issue #241 / PR #242. It does not claim a numerical parity
score, release readiness, final owner acceptance, merge, W6-10 work, or
Codex Review.

## Current production source and exact Windows runtime

| Field | Current exact value |
| --- | --- |
| Production source HEAD for this checkpoint | `7f945abd5ee0e09dd933e3b86c6d2340a032cd63` |
| Production source tree for this checkpoint | `4ee2b1ef38c117e25591faf4920c16b5ee44d947` |
| Evidence package | `current/visual-remediation-7f945abd/` (captured against the exact production HEAD above) |
| Exact runtime | `F:\\CargoTarget\\w6-09-pr242-exact-22859048\\debug\\zen-canvas.exe` |
| Runtime SHA-256 | `63519F2638676E893EBF96446D0E311886F9F1972E939C283F1301096E11A19A` |
| Native capture surface | `computer-use/node_repl + @oai/sky`, Windows, 1275x800 |
| Current native visual evidence | **BLOCKED at the supported Browse Folder authority boundary** |
| Fresh applicable hosted CI | Run `35486483365` — **SUCCESS**, bound to production HEAD `7f945abd5ee0e09dd933e3b86c6d2340a032cd63` |
| Parity score | **PENDING OWNER REVIEW** |

The prior `7623cdbd` capture set and its evidence successor are historical
only. Older `3f0553ad`, `4c6bc1c7`, and other captures remain historical only;
none is current proof for this checkpoint.

## Presentation decisions exercised

- Normal-ready lifecycle/debug chrome is not presented as visible content. The
  top-right close and Escape remain the close path; the footer contains only
  useful content controls.
- Loading uses one restrained spinner and one concise label.
- Failed preview uses a concise icon and primary message; metadata remains in
  Details rather than the main failure content.
- Image preview uses a neutral canvas with centered contain behavior, without a
  redundant section heading, nested frame, or scrollbar when the image fits.
- Markdown and PDF presentation remain renderer-owned and sanitized; PDF
  controls are kept quiet and content-led.
- Pinned preview keeps the centered surface, removes modal/dimming treatment,
  leaves the workspace visually normal and interactive, and freezes the source.
- Compact follows behavior **B**: it changes bounded Quick Preview chrome and
  padding metrics in the canonical style rules without shrinking preview
  content excessively. It is not a second persistence or authority path.

## Current native visual evidence

| State | Exact-head artifact | Result |
| --- | --- | --- |
| Browse Folder authority boundary | [`browse-folder-authority-blocked-exact-head-7f945abd.png`](current/visual-remediation-7f945abd/browse-folder-authority-blocked-exact-head-7f945abd.png) | **CAPTURED** — `NativeFixtureW609` is visible but `状态未知`; `打开位置` remains disabled by the product fail-closed rule |
| Shell titlebar / controls | [`shell-titlebar-controls-100-exact-head-7f945abd.png`](current/visual-remediation-7f945abd/shell-titlebar-controls-100-exact-head-7f945abd.png) | **CAPTURED** — exact process-backed native window |
| Loading | — | **UNVERIFIED** — supported Browse Folder path did not admit the task-owned fixture |
| PDF page 1/2/3 continuous-scroll | — | **UNVERIFIED** — no authoritative Browse session was opened |
| Markdown | — | **UNVERIFIED** — no authoritative Browse session was opened |
| Normal image ready | — | **UNVERIFIED** — no authoritative Browse session was opened |
| Failed | — | **UNVERIFIED** — no authoritative Browse session was opened |
| Pinned with background selection | — | **UNVERIFIED** — no authoritative Browse session was opened |
| Details closed/open and Pin/Unpin | — | **UNVERIFIED** — no authoritative Browse session was opened |
| Dark | — | **UNVERIFIED** — no Quick Preview state was opened in this exact-head session |
| Compact | — | **UNVERIFIED** — no Quick Preview state was opened in this exact-head session |

### Screenshot hashes

| Artifact | SHA-256 |
| --- | --- |
| `browse-folder-authority-blocked-exact-head-7f945abd.png` | `9D1578065FB03469D29114416E6EB7E018F80AA386B7BFAF5DE1B4AC7D1FE8B0` |
| `shell-titlebar-controls-100-exact-head-7f945abd.png` | `4AC6F236D4B6D1717E0D2FDFDEA4802ED55D049EFA385F6BFCC0182C07ACB9BC` |

## Native evidence boundary

`F:\\work\\NativeFixtureW609` was verified read-only and contains the
task-owned `quick-preview-large.pdf` and `quick-preview.md` fixtures. The
supported native Browse Folder location list exposed `NativeFixtureW609`,
but the backend returned `availability=unknown` and `canBrowse=false`; after
using the visible `重新读取位置` action it remained unknown and the
`打开位置` control stayed disabled. No database, app internals, user files,
or source authority were modified to bypass that boundary.

Therefore this checkpoint does not claim any Quick Preview native visual
acceptance. A future native recapture must first obtain a backend-admitted
`EphemeralBrowse` session for the same task-owned fixture, then use the exact
production source recorded above.

## Accepted source and architecture state

- Preview Core, Read Gate, source identity, provider ordering, and pinned
  source semantics remain unchanged and accepted.
- Floating and Pinned use the shared `ZenQuickPreviewSurface`.
- The right-side pinned dock remains retired; Details is hidden by default.
- PDF.js continues to use opaque range-backed Preview asset access; no raw
  filesystem path is passed to the renderer.
- No Quick Preview enable/disable preference was found. The fake disabled
  Switch was removed in favor of the truthful capability presentation:

      快速预览
      支持的文件类型优先在应用内预览
      状态：已启用

- No new persistence authority was introduced.

## Settings source contract retained for the bounded W6-09 scope

| Width | Settings columns | Secondary section navigation | Settings row controls |
| ---: | --- | --- | --- |
| 1282 | Two-column | Vertical | Two-column |
| 969 | Two-column | Vertical | Two-column |
| 840 boundary | Single content column | Horizontal scroll | Two-column |
| 760 boundary | Single content column | Horizontal scroll | Stacked single-column |

The Settings-only internal rules use the 840px and 760px boundaries. The old
1179px/1180px Settings section-navigation breakpoint is absent; the app
shell/sidebar 1100px breakpoint remains unchanged. The Quick Preview setting
row is a quiet, non-interactive capability presentation: `状态：已启用`.

## Validation evidence

| Gate | Result |
| --- | --- |
| Focused Preview/remediation tests | **PASS** — 8 files, 43 tests |
| Full `npm test` | **PASS** — 150 files, 1593 tests |
| `npm run typecheck` | **PASS** |
| `npm run test:performance:architecture` | **PASS** — 3 files, 28 tests |
| `npm run build:frontend` | **PASS** — existing CSS/dynamic-import/chunk-size warnings only |
| V26 verify-only | **PASS 4/4** |
| Exact Windows Tauri build | **PASS** — Cargo target `F:\\CargoTarget\\w6-09-pr242-exact-22859048`, current-HEAD build reused in 0.63s; runtime hash above |
| Fresh hosted CI | **PASS** — run `35486483365`, bound to production HEAD `7f945abd5ee0e09dd933e3b86c6d2340a032cd63` |
| Real macOS GUI visual acceptance | **UNVERIFIED** |

No Codex Review, merge, new PR, or W6-10 work was performed.

## Review disposition

Parity score: **PENDING OWNER REVIEW**

Owner checkpoint is **BLOCKED**. The exact-head runtime and shell evidence are
valid, but the supported Browse Folder authority did not admit the requested
fixture, so the requested Quick Preview screenshots and fresh CI evidence are
not claimed.
