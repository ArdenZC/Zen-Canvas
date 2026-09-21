# W6-09 Browse authority fix — Settings + Quick Preview V26 parity matrix

Status: **PENDING OWNER REVIEW**

This bounded evidence package covers the Browse location projection fix for
Issue #241 / PR #242 and the exact-head Windows native boundary evidence. It
does not claim a numerical parity score, release readiness, final owner
acceptance, merge, W6-10 work, or Codex Review.

## Current production source and exact Windows runtime

| Field | Current exact value |
| --- | --- |
| Production source HEAD for this checkpoint | `ce8d3a58f662ad59a7b6134062497cec786ea508` |
| Production source tree for this checkpoint | `20d4d0a1684b6b3a8fe4012fbdc737d28de25c1d` |
| Evidence package | `current/visual-remediation-ce8d3a58/` (captured against the exact production HEAD above) |
| Exact runtime | `F:\\CargoTarget\\w6-09-pr242-exact-22859048\\debug\\zen-canvas.exe` |
| Runtime SHA-256 | `4B5EDD3C1D2AF35C4D63CC05FE5515847E366AFA32288EECC425D74F5560F89B` |
| Native capture surface | `computer-use/node_repl + @oai/sky`, Windows, 1275x800 |
| Current native visual evidence | **CAPTURED at the supported Browse Folder authority boundary; Quick Preview route remains blocked** |
| Fresh applicable hosted CI | Run `35553011841` — **SUCCESS**, bound to production HEAD `ce8d3a58f662ad59a7b6134062497cec786ea508` |
| Parity score | **PENDING OWNER REVIEW** |

The prior `3f0553ad`, `7623cdbd`, `7f945abd`, and their evidence successors
are historical only. They are not current proof for this checkpoint.

## Root cause and bounded production fix

`open_browse()` correctly admitted a live `EphemeralBrowse` session with
`LocationRuntimeEvidence::browse_admitted()`. On refresh,
`list_locations()` reprojected live ephemeral records from
`self.inner.sessions` using `LocationRuntimeEvidence::unknown()`. That
downgraded the same live reference to unavailable and made the supported
`Open location` action fail closed.

The production fix is limited to the ephemeral projection in
`src-tauri/src/file_workspace/integration/browse.rs`: live ephemeral records
now retain `LocationRuntimeEvidence::browse_admitted()` during
`list_locations()`. The managed projection, `isActivatableLocation` guard,
authority boundaries, and persistence contracts are unchanged. No new
authority or persistence preference was introduced.

Focused Rust coverage proves:

- A: `open_browse()` followed by `list_locations()` preserves the exact
  `Ephemeral` reference, `available`, and `canBrowse`, while unknown kind and
  all other capabilities remain false.
- B: repeated `list_locations()` calls do not degrade the admission.
- C: disposal removes the location and the stale reference is not actionable.
- D: stale and cross-session references fail closed.

## Current native visual evidence

| State | Exact-head artifact | Result |
| --- | --- | --- |
| Files → Browse Folder → refresh boundary | [`browse-folder-location-picker-exact-head-ce8d3a58.jpg`](current/visual-remediation-ce8d3a58/browse-folder-location-picker-exact-head-ce8d3a58.jpg) | **CAPTURED** — final exact runtime shows `NativeFixtureW609` with `状态未知`; after the visible `重新读取位置` action, `打开位置` remains disabled by the product fail-closed rule |
| Quick Preview loading | — | **UNVERIFIED** — the supported normal route did not admit an ephemeral Browse session |
| PDF page 1/2/3 settled continuous scroll | — | **UNVERIFIED** — no authoritative Browse session was opened |
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
| `browse-folder-location-picker-exact-head-ce8d3a58.jpg` | `795286237A25CBD4A8BF7112CE78051372E257389E98EF915DE542447CF87630` |

## Native evidence boundary

`F:\\work\\NativeFixtureW609` was verified read-only and contains the
task-owned `quick-preview-large.pdf` and `quick-preview.md` fixtures. The
supported native Browse Folder location list exposed `NativeFixtureW609`, but
the backend returned `availability=unknown` and `canBrowse=false`; after the
visible `重新读取位置` action it remained unknown and the `打开位置` control
stayed disabled. A clean exact runtime exposes only these managed location
cards; this normal UI path does not create a new ephemeral Browse session.

No database, app internals, user files, source authority, IPC, DevTools,
path injection, or disabled control was used to bypass that boundary.
Therefore this checkpoint does not claim Quick Preview native visual
acceptance. A subsequent native recapture must first obtain a backend-admitted
`EphemeralBrowse` session for the same task-owned fixture, then use the exact
production source recorded above.

## Accepted Settings and Quick Preview presentation state

The earlier bounded presentation changes remain unchanged by this authority
fix:

- Settings internal breakpoints are 840px and 760px; the app shell/sidebar
  1100px breakpoint is independent.
- Quick Preview has no canonical user-disable preference. Its Settings row is
  a quiet, non-interactive capability presentation:

      快速预览
      支持的文件类型优先在应用内预览
      状态：已启用

- Normal-ready debug chrome is removed; close remains top-right/Escape and
  the footer keeps only useful content controls.
- Loading, failed, image, Markdown, PDF, pinned, and Compact presentation
  decisions remain as previously recorded in the production diff; no new
  styling or authority was added in this root-cause fix.

### Settings responsive matrix

| Width | Settings columns | Secondary section navigation | Settings row controls |
| ---: | --- | --- | --- |
| 1282 | Two-column | Vertical | Two-column |
| 969 | Two-column | Vertical | Two-column |
| 840 boundary | Single content column | Horizontal scroll | Two-column |
| 760 boundary | Single content column | Horizontal scroll | Stacked single-column |

The old 1179px/1180px Settings section-navigation breakpoint is absent. The
Settings Quick Preview row remains truthful and non-interactive; there is no
fake disabled Switch and no new persistence authority.

## Validation evidence

| Gate | Result |
| --- | --- |
| Focused Browse frontend regression | **PASS** — `tests/fileLibraryW204Browse.test.ts`, 12 tests |
| Focused Rust Browse tests | **PASS** — 2 focused tests; file-workspace integration suite 21 tests |
| Rust clippy | **PASS** — all targets, `-D warnings` |
| Full `cargo test` | **PASS** — desktop-runtime suite, including 954 library tests and integration binaries |
| `npm run typecheck` | **PASS** |
| Focused Preview suite | **PASS** — 13 files, 101 tests |
| `npm test` | **PASS** — 150 files, 1597 tests |
| `npm run test:remediation` | **PASS** — 14 tests |
| `npm run test:performance:architecture` | **PASS** — 3 files, 28 tests |
| `npm run build:frontend` | **PASS** — existing CSS/dynamic-import/chunk-size warnings only |
| Native Preview Handler build | **PASS** — expected linker warning `LNK4104` only |
| W2-01 browser contract | **PASS** — 8 tests |
| V26 verify-only | **PASS 4/4** |
| Release Rust check | **PASS** — `cargo check --release --features desktop-runtime` |
| Exact Windows Tauri runtime build | **PASS** — final runtime SHA-256 recorded above |
| Fresh hosted CI | **PASS** — run `35553011841`, bound to production HEAD above |
| Real macOS GUI visual acceptance | **UNVERIFIED** |
| Forced Colors / DPI-specific native review | **UNVERIFIED** |

No Codex Review, merge, new PR, W6-10 work, or other page work was performed.

## Review disposition

Parity score: **PENDING OWNER REVIEW**

The Browse authority fix and its focused regression evidence are ready for
owner review. The exact-head native Browse boundary artifact is current and
valid, but Quick Preview native screenshots remain blocked until the supported
normal route admits a live ephemeral Browse session. STOP at this checkpoint.
