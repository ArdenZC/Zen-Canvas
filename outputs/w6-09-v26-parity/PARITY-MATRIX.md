# W6-09 Quick Preview visual remediation — V26 parity matrix

Status: **PENDING OWNER REVIEW**

This bounded evidence package covers only the Quick Preview presentation
remediation for Issue #241 / PR #242. It does not claim a numerical parity
score, release readiness, final owner acceptance, merge, W6-10 work, or
Codex Review.

## Current production source and exact Windows runtime

| Field | Current exact value |
| --- | --- |
| Production source HEAD exercised by native capture | `7623cdbde448ed161ed614f77656cd49eef8294d` |
| Production source tree exercised by native capture | `97d613a6e9b6e1c4d54d74aa3010ff6e852e4f1b` |
| Exact runtime | `F:\\CargoTarget\\w6-09-pr242-exact-22859048\\debug\\zen-canvas.exe` |
| Runtime SHA-256 | `63519F2638676E893EBF96446D0E311886F9F1972E939C283F1301096E11A19A` |
| Native capture surface | `computer-use/node_repl + @oai/sky`, Windows, 1275x720 |
| Current native visual evidence | **RECAPTURED at the production HEAD above** |
| Fresh applicable hosted CI | Run `35481405295` — **SUCCESS**, bound to production HEAD |
| Parity score | **PENDING OWNER REVIEW** |

All artifacts in `current/visual-remediation-7623cdbd/` are new exact-head
captures from the runtime above. Older `3f0553ad`, `4c6bc1c7`, and other
captures remain historical only; none is current proof.

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
| Loading | [`loading-exact-head-7623cdbd.png`](current/visual-remediation-7623cdbd/loading-exact-head-7623cdbd.png) | **CAPTURED** — one spinner and one `正在准备预览` label |
| PDF page 1 settled | [`pdf-page1-exact-head-7623cdbd.png`](current/visual-remediation-7623cdbd/pdf-page1-exact-head-7623cdbd.png) | **CAPTURED** — settled page content visible; no blank page in this one-page source |
| PDF page 2/3 continuous-scroll | — | **UNVERIFIED** — bounded native fixture index did not expose the multipage fixture |
| Markdown | — | **UNVERIFIED** — bounded native fixture index did not expose `quick-preview.md` |
| Normal image ready | [`image-exact-head-7623cdbd.png`](current/visual-remediation-7623cdbd/image-exact-head-7623cdbd.png) | **CAPTURED** — direct neutral canvas, centered contain |
| Failed | [`failed-exact-head-7623cdbd.png`](current/visual-remediation-7623cdbd/failed-exact-head-7623cdbd.png) | **CAPTURED** — concise error presentation |
| Pinned with background selection | [`pinned-background-selection-exact-head-7623cdbd.png`](current/visual-remediation-7623cdbd/pinned-background-selection-exact-head-7623cdbd.png) | **CAPTURED** — centered surface, no dim layer, background selection remains visible |
| Details closed | [`details-closed-exact-head-7623cdbd.png`](current/visual-remediation-7623cdbd/details-closed-exact-head-7623cdbd.png) | **CAPTURED** |
| Details open | [`details-open-exact-head-7623cdbd.png`](current/visual-remediation-7623cdbd/details-open-exact-head-7623cdbd.png) | **CAPTURED** — file facts remain behind Details |
| Dark | [`dark-exact-head-7623cdbd.png`](current/visual-remediation-7623cdbd/dark-exact-head-7623cdbd.png) | **CAPTURED** |
| Compact | [`compact-exact-head-7623cdbd.png`](current/visual-remediation-7623cdbd/compact-exact-head-7623cdbd.png) | **CAPTURED** — bounded chrome/padding variant |

### Screenshot hashes

| Artifact | SHA-256 |
| --- | --- |
| `compact-exact-head-7623cdbd.png` | `31D984FB31B99AA7498B431E119659C1733CB0749E3CF8C28DE8E9FF443838B1` |
| `dark-exact-head-7623cdbd.png` | `53816AC44868DA93359DB7B49E83088A073DF5608892488765DE703E0766B054` |
| `details-closed-exact-head-7623cdbd.png` | `250327D7A461B30805DD3B96397F996030AC174AF473FFEBB37737634B06324A` |
| `details-open-exact-head-7623cdbd.png` | `0E08DD536473F8E8050C296E46EDC5984B61BC09C9F2C47345C86ABF5DB04573` |
| `failed-exact-head-7623cdbd.png` | `C70B62B6EB1142405BFEE2545F8B51CDA74599D91A56C3E5B0C315949D8E57C0` |
| `image-exact-head-7623cdbd.png` | `AF5B93AC3C8C599A40A52EA0F6D7283972C082D048445ADD8B618CB6AD18C8F3` |
| `loading-exact-head-7623cdbd.png` | `2948B2E8BE0E846330CB273032722B16C578D85E31A5C5F1362FAA15AA3A4ED2` |
| `pdf-page1-exact-head-7623cdbd.png` | `BD53D0145B83CB3E17687474FB97D46562BD10FEA0EAC7CE89DAF7AA382738E7` |
| `pinned-background-selection-exact-head-7623cdbd.png` | `DD474ED974489353EAAAE8B634A45A9F879E627F44DF08E40F4D0BE0E65903AA` |

## Native evidence boundary

`F:\\work\\NativeFixtureW609` was verified read-only and contains the
task-owned `quick-preview-large.pdf` and `quick-preview.md` fixtures. The
folder was selected again through the bounded native scan-directory picker;
the application reported partial coverage and both the scoped and all-index
queries remained `quick-preview = 0/0`. No database, app internals, user
files, or source authority were modified to bypass that boundary.

Therefore this package does not claim PDF page-2/page-3 lazy-page behavior or
Markdown native visual acceptance. The one-page indexed PDF proves the
settled page-1 path only. A future native recapture must use the same exact
production source and a targetable indexed multipage/Markdown fixture.

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
| Exact Windows Tauri build | **PASS** — Cargo target `F:\\CargoTarget\\w6-09-pr242-exact-22859048`, 0.58s reuse; runtime hash above |
| Fresh hosted CI | **PASS** — run `35481405295`, bound to production HEAD `7623cdbde448ed161ed614f77656cd49eef8294d` |
| Real macOS GUI visual acceptance | **UNVERIFIED** |

No Codex Review, merge, new PR, or W6-10 work was performed.

## Review disposition

Parity score: **PENDING OWNER REVIEW**

Owner checkpoint is ready for the captured presentation states. PDF page-2/3
and Markdown remain explicitly unverified because the bounded native fixture
was not exposed by the application index.
