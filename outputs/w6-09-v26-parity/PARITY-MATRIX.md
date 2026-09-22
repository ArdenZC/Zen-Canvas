# W6-09 FIRST-ENTRY BROWSE + Settings + Quick Preview V26 parity matrix

Status: **PENDING OWNER REVIEW**

This bounded evidence package covers Issue #241 / PR #242: first-entry
Browse admission, the PDF lazy-page rendering race, controlled native image
transport, and the exact-head Windows native Settings/Quick Preview review
surface. It does not claim a numerical parity score, release readiness, final
owner acceptance, merge, W6-10 work, or Codex Review.

## Current production source and exact Windows runtime

| Field | Current exact value |
| --- | --- |
| Production source HEAD used for the runtime | `88fc663392371049fda2d71b85bd4815d073bfe0` |
| Production source tree used for the runtime | `5ca511f055b02bb511bc0873ffc5c2a2d26efadf` |
| Evidence package | `current/native-exact-88fc6633/` |
| Exact runtime | `F:/CargoTarget/w6-09-pr242-exact-22859048/debug/zen-canvas.exe` |
| Runtime SHA-256 | `241EF67CA2E02547303AFED5D2B3475E749CAA8532A64CC6A92D930F574365CF` |
| Runtime profile override | `identifier=com.startlan.zencanvas.w609final` (task-local QA profile only; production config unchanged) |
| Native capture surface | `computer-use/node_repl + @oai/sky`, Windows, target window 1282x862 |
| Native flow | Files → Browse Folder → Choose Folder → `F:/work/NativeFixtureW609` |
| Current native visual evidence | **CAPTURED from the exact production runtime through the normal UI route** |
| Parity score | **PENDING OWNER REVIEW** |

The earlier `3f0553ad`, `7623cdbd`, `7f945abd`, `ce8d3a58`, and
`92e0d129` evidence directories are historical only. They are not current
proof. The current matrix and screenshot hashes below are bound to production
HEAD `88fc6633…`, tree `5ca511f…`, and runtime SHA-256 above.

## Root cause and bounded production fixes

### Browse first-entry path

The prior `list_locations()` fix remains in place: live ephemeral projections
retain `LocationRuntimeEvidence::browse_admitted()` instead of being downgraded
to `unknown`.

The remaining clean-runtime failure was a missing first-entry UI. Switching to
Browse correctly produced a detached picker, but `BrowseLocationPicker` only
exposed managed-location refresh and `browseLocation(LocationRef)`; it had no
folder-picker action that could create the first ephemeral session.

`BrowseLocationPicker` now exposes the shared-i18n `Choose Folder…` action
and uses the existing `@tauri-apps/plugin-dialog open({ directory: true,
multiple: false })` route. After a selection it calls the existing
`FileLibraryExperience.openBrowse({ platform, routingHint, displayHint })`
authority, maps Windows/macOS runtime platforms through the existing command
context, and renders the admitted Browse session immediately. Cancel stays in
the picker without an error; admission failure stays in the picker with a
truthful error; duplicate selection/admission actions are guarded. Existing
managed `browseLocation(LocationRef)` cards remain unchanged.

No capability change, new persistence authority, second store, path authority,
IPC bypass, database mutation, or fake target was introduced.

### Quick Preview presentation/runtime corrections

- PDF page requests no longer cancel merely because a page briefly leaves the
  observer window; request identity and settled canvas lifecycle prevent a
  content-bearing page from remaining blank after continuous scroll.
- Normal-ready, loading, failed, image, Markdown, pinned, Details, Dark and
  Compact evidence is captured from the final runtime. Loading uses one quiet
  label and spinner; failed content keeps metadata behind Details; image
  content uses the neutral canvas directly.
- The Tauri CSP now allows only the controlled `blob:` image transport used by
  the existing Preview read path; `data:` and network image sources remain
  disallowed.
- Quick Preview Settings remains a truthful non-interactive capability row:

      快速预览
      支持的文件类型优先在应用内预览
      状态：已启用

  There is no canonical persisted user-disable preference and no new one was
  added.

## Current exact-head native visual evidence

All artifacts below are PNGs captured from the runtime and directory recorded
above. The PDF page 3 screenshot was captured only after the page indicator
reached page 3 and the content-bearing page settled visibly in the viewport.

| State | Exact-head artifact | Result |
| --- | --- | --- |
| Files → Browse Folder → Choose Folder → admitted Browse | [`browse-folder-first-entry.png`](current/native-exact-88fc6633/browse-folder-first-entry.png) | **CAPTURED** — selected `F:/work/NativeFixtureW609`, detached false, normal Browse UI with four fixtures |
| Quick Preview PDF page 1 | [`quick-preview-pdf-page1.png`](current/native-exact-88fc6633/quick-preview-pdf-page1.png) | **CAPTURED** — content visible |
| Quick Preview PDF page 2 | [`quick-preview-pdf-page2.png`](current/native-exact-88fc6633/quick-preview-pdf-page2.png) | **CAPTURED** — content visible |
| Quick Preview PDF page 3 after continuous scroll | [`quick-preview-pdf-page3.png`](current/native-exact-88fc6633/quick-preview-pdf-page3.png) | **CAPTURED** — page 3 indicator and non-blank content visible after settle |
| Markdown ready | [`quick-preview-markdown.png`](current/native-exact-88fc6633/quick-preview-markdown.png) | **CAPTURED** |
| Image ready | [`quick-preview-image.png`](current/native-exact-88fc6633/quick-preview-image.png) | **CAPTURED** — neutral canvas, contained/centered image, no decode failure |
| Loading | [`quick-preview-loading.png`](current/native-exact-88fc6633/quick-preview-loading.png) | **CAPTURED** — immediate shell plus one restrained `正在准备预览` indicator |
| Failed | [`quick-preview-failed.png`](current/native-exact-88fc6633/quick-preview-failed.png) | **CAPTURED** — concise icon/message, no main-content metadata table |
| Details closed | [`quick-preview-details-closed.png`](current/native-exact-88fc6633/quick-preview-details-closed.png) | **CAPTURED** |
| Details open | [`quick-preview-details-open.png`](current/native-exact-88fc6633/quick-preview-details-open.png) | **CAPTURED** — metadata is behind Details |
| Details open while pinned | [`quick-preview-details-open-pinned.png`](current/native-exact-88fc6633/quick-preview-details-open-pinned.png) | **CAPTURED** — centered pinned surface, Details open |
| Pinned with background selection | [`quick-preview-pinned-background-selection.png`](current/native-exact-88fc6633/quick-preview-pinned-background-selection.png) | **CAPTURED** — underlying Browse selection changes while pinned source remains fixed |
| Dark | [`quick-preview-dark.png`](current/native-exact-88fc6633/quick-preview-dark.png) | **CAPTURED** |
| Compact | [`quick-preview-compact.png`](current/native-exact-88fc6633/quick-preview-compact.png) | **CAPTURED** — bounded chrome/density difference without shrinking preview content |
| Titlebar controls | [`titlebar-controls.png`](current/native-exact-88fc6633/titlebar-controls.png) | **CAPTURED** |
| Preview open without UI focus halo | [`preview-open-no-focus-halo.png`](current/native-exact-88fc6633/preview-open-no-focus-halo.png) | **CAPTURED** |

### Screenshot hashes

| Artifact | SHA-256 |
| --- | --- |
| `browse-folder-first-entry.png` | `1BE60AD653B77888D86E2DFB7E1797711E688E0161D54AF0359191D89FE39B55` |
| `quick-preview-pdf-page1.png` | `CF292B3840D3A50E4DCFE5F1B065545FC244BAE9607279F135ED8D9DF00CE14F` |
| `quick-preview-pdf-page2.png` | `D2CE3C8241FF96F8784FFA9BD534F4DDD3D39DCF248AF0BDE7ED3670EFB6C69B` |
| `quick-preview-pdf-page3.png` | `279C761952BCED2ABEFFCCCCC420E974A714E1311E3E6A02786E89869FD452EA` |
| `quick-preview-markdown.png` | `30F25AD9CF9488E183AE8DAC8A6740365FB48E29532FE227CDD9D56BE814A889` |
| `quick-preview-image.png` | `1ADC431174D26FD3FF18F00F2B32FFB5296E782ED113B9C76067225BD92A6942` |
| `quick-preview-loading.png` | `676A78FD5221A332B04AAA32C2396B4481C084662C1E54A327A07D027B37680E` |
| `quick-preview-failed.png` | `AD51CEF91CDAB01B11B77AECCD5F7DA9D6BE4E5610342FA39C539E1CC8092F6A` |
| `quick-preview-details-closed.png` | `CF292B3840D3A50E4DCFE5F1B065545FC244BAE9607279F135ED8D9DF00CE14F` |
| `quick-preview-details-open.png` | `E7FC87ADEA604448941B505ADDB20930452D31F483C3E8E363CFCDFE6DFD6703` |
| `quick-preview-details-open-pinned.png` | `08B9D1FFF43AF5F399C07B52D9D7AE7F2D73B7F48A66B9B93E0B50A7130CC308` |
| `quick-preview-pinned-background-selection.png` | `82332486C308506F8A1DE236EFB0473C91C9CDF9E3EBBACA301CBB492DA5123A` |
| `quick-preview-dark.png` | `31B306B6303C923FF30DAB48D630E9DA22418DC7C761AEAF33A7459CBD2C707F` |
| `quick-preview-compact.png` | `D742621C6583142249089AEC03CFD9CB5EEC46662644238A427D73C16FBFBC8A` |
| `titlebar-controls.png` | `D742621C6583142249089AEC03CFD9CB5EEC46662644238A427D73C16FBFBC8A` |
| `preview-open-no-focus-halo.png` | `D742621C6583142249089AEC03CFD9CB5EEC46662644238A427D73C16FBFBC8A` |

## Accepted Settings and Quick Preview presentation state

The Settings changes remain bounded to the Settings internal layout. The app
shell/sidebar 1100px breakpoint is independent and untouched.

### Settings responsive matrix

| Width | Settings columns | Secondary section navigation | Settings row controls |
| ---: | --- | --- | --- |
| 1282 | Two-column | Vertical | Two-column |
| 969 | Two-column, V26 composition retained | Vertical | Two-column |
| 840 boundary | Single content column | Horizontal scroll | Two-column |
| 760 boundary | Single content column | Horizontal scroll | Stacked single-column |

The old `1179px`/`1180px` Settings section-navigation breakpoint is absent.
The Quick Preview row is truthful and non-interactive; there is no fake
disabled Switch and no new persistence authority.

## Native evidence boundary

The selected `F:/work/NativeFixtureW609` directory was used only through
the visible Windows folder picker and the admitted Browse session. No database,
app internals, user-file mutation, source authority, IPC, DevTools, path
injection, or disabled control was used to bypass the product route. The
task-local runtime profile was isolated with the identifier override above;
the shared user database was not modified.

Forced Colors, DPI-specific variations beyond the captured 1282x862 window,
and real macOS GUI visual acceptance remain **UNVERIFIED**. The Windows native
evidence is current exact-head evidence only; it is not an owner score.

## Validation evidence

| Gate | Result |
| --- | --- |
| Focused Browse frontend/source-owner suite | **PASS** — `tests/fileLibraryW204Browse.test.ts`, 19 tests |
| Focused Browse + Preview frontend suite | **PASS** — 15 files, 148 tests |
| Full frontend test suite | **PASS** — 150 files, 1605 tests |
| `npm run typecheck` | **PASS** |
| `npm run test:remediation` | **PASS** — 14 tests |
| `npm run test:performance:architecture` | **PASS** — 3 files, 28 tests |
| W2-01 browser regression | **PASS** — 8 tests |
| W2-04 real browser gate | **PASS** — 1600x900 and 980x680, source `88fc6633…`, tree `5ca511f…` |
| `npm run build:frontend` | **PASS** — existing CSS/dynamic-import/chunk-size warnings only |
| `npm run build:check` | **PASS** — frontend build plus release Rust check |
| Focused Rust Browse tests | **PASS** — 22 tests |
| Focused Rust File Workspace integration | **PASS** — 44 passed, 14 ignored |
| `npm run verify:rust` | **PASS** — fmt, desktop-runtime Rust tests, clippy `-D warnings`; rerun with single job and isolated exact Cargo target after the initial Windows page-file mmap error `os error 1455` |
| Native Preview Handler build | **PASS** — expected linker warning `LNK4104` only |
| V26 verify-only | **PASS 4/4** |
| Exact Windows Tauri runtime build | **PASS** — runtime SHA-256 recorded above |
| Fresh applicable hosted CI | **PASS** — run [35608830144](https://github.com/ArdenZC/Zen-Canvas/actions/runs/35608830144), SUCCESS, bound to production HEAD `88fc6633…` / tree `5ca511f…` |
| Real macOS GUI visual acceptance | **UNVERIFIED** |
| Forced Colors / DPI-specific native review | **UNVERIFIED** |

No Codex Review, merge, new PR, W6-10 work, or unrelated page work was
performed.

## Review disposition

Parity score: **PENDING OWNER REVIEW**

This matrix is ready for the final fresh hosted-CI binding and owner review.
STOP at this checkpoint after the evidence/PR update; do not merge or enter
W6-10.
