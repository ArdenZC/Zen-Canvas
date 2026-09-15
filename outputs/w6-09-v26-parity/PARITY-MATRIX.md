# W6-09 V26 parity matrix — Settings + Quick Preview

Status: **PENDING OWNER REVIEW**

This is a bounded evidence package for Issue #241 / PR #242. It covers only
Settings and Quick Preview. It does not claim a numerical parity score, release
readiness, or final acceptance.

## Exact production identity

| Field | Current exact value |
| --- | --- |
| Production source HEAD used for the runtime | `228590489ebf779615e3f8507aeb1bc5e1704b73` |
| Production source tree | `37649d07f1d6b7462cb155f06d90a83901a3b5a9` |
| Exact Tauri runtime | `F:\\CargoTarget\\w6-09-pr242-exact-22859048\\debug\\zen-canvas.exe` |
| Runtime SHA-256 | `CA60A367270CE82DB43CEB94344937471F8D56CB036FB9C20916B37A57353B44` |
| Runtime bytes | 49,543,168 |
| Native capture surface | `computer-use/node_repl + @oai/sky` |
| Native window | process-backed exact runtime; title `Zen Canvas`; window id `137036382` |
| Native capture size | 1275x720 for all current screenshots |
| Target OS | Windows 11, build 26200, 64-bit |

The current PNG artifacts are lossless PNG transcodes of the JPEG image
payloads returned by `sky.get_window_state` for the exact runtime above. No
browser or headless render is substituted for current native evidence. The
runtime was built after the final production/test source commit, and the
registry contract tests were included in that build.

## Native capture provenance

- The exact window was selected by its process-backed executable path, not by
  title alone.
- Every coordinate action used a freshly observed full-window screenshot id.
- Settings evidence was captured in light/default, dark/default,
  dark/compact, light/compact Select-open, and an additional dark/compact
  state.
- Quick Preview evidence was captured in floating ready, pinned ready,
  details-open, and PDF fallback states.
- The native window could not be resized below its observed 1275x720 surface
  in this environment. The source/test breakpoint contract is therefore the
  evidence for 969/840/760; no synthetic native screenshot is claimed for
  those widths.

## Settings breakpoint matrix

| Width | Settings columns | Secondary section navigation | Settings row controls | Evidence |
| ---: | --- | --- | --- | --- |
| 1282 | Two-column | Vertical | Two-column | focused source contract |
| 969 | Two-column | Vertical | Two-column | focused source contract |
| 840 boundary | Single content column | Horizontal scroll | Two-column | focused source contract |
| 760 boundary | Single content column | Horizontal scroll | Stacked single-column | focused source contract |

The Settings-only internal rules use the 840px and 760px boundaries. The old
1179px/1180px Settings section-navigation breakpoint is absent. The app
shell/sidebar 1100px breakpoint remains unchanged. The 969px contract
explicitly remains the V26 two-column/vertical/two-column composition.

## Quick Preview setting truth

The Settings row is now a quiet, non-interactive capability presentation:

    快速预览
    支持的文件类型优先在应用内预览。
    状态：已启用

The fake disabled read-only Switch and its enabled-painted CSS presentation
were removed. The row has no switch role and no click affordance. Repository
search found no canonical persisted Quick Preview enable/disable preference;
no new persistence authority was introduced.

## Quick Preview geometry and state matrix

The accepted V26 geometry was not redesigned in this round. The native
details-open capture shows the bounded shell, 226px inspector, bounded content
area, and non-clipping scroll ownership. The source contract retains the
892px shell / 42px rows / 68px header-footer / 30px actions / 26px content /
15px side rail / 29px footer-controls composition for the available viewport.

| Surface/state | Current exact-head native evidence | Observed state |
| --- | --- | --- |
| Floating ready / normal ready text | [current/quick-preview-floating-ready-22859048.png](current/quick-preview-floating-ready-22859048.png) | `项目4.txt`; real text content; `预览内容已准备好` |
| Pinned ready | [current/quick-preview-pinned-ready-22859048.png](current/quick-preview-pinned-ready-22859048.png) | Same text source; pin control active; host remains visible and bounded |
| Details open | [current/quick-preview-details-open-22859048.png](current/quick-preview-details-open-22859048.png) | Inspector visible at the right; content remains visible and not clipped |
| PDF fallback | [current/quick-preview-pdf-fallback-22859048.png](current/quick-preview-pdf-fallback-22859048.png) | Exact PDF selection reaches truthful `预览暂时不可用` fallback; no PDF-ready claim |
| Image ready | Not captured in this Windows data set | Unverified; no image-ready claim |
| Loading / failed / unsupported | Not recaptured as final current states | Unverified; prior artifacts are historical only |

The current Quick Preview screenshots are all from the final exact runtime and
prove the required ready, pinned, and fallback visual states. The PDF row is
reported as fallback because that is the observed native result; it is not
silently promoted to a successful PDF render.

## Zen Select native proof

The existing `createPortal(document.body)` fix is retained. No Select
redesign was made. The exact-head screenshot
[current/settings-select-open-22859048.png](current/settings-select-open-22859048.png)
shows:

- popup visible;
- no horizontal overflow;
- popup width matching the appearance control;
- popup anchored to the appearance control;
- 白昼 is the selected item and has the check mark;
- the trigger has the active/focus outline;
- the popup is not clipped by the Settings content surface.

## Current screenshot SHA-256 inventory

| Artifact | Logical size | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| [current/settings-default-22859048.png](current/settings-default-22859048.png) | 1275x720 | 261396 | `D8A4C38D11DD63EAE54C33A6121C66E54721FFBB155DB62E52184AD84BD08896` |
| [current/settings-dark-22859048.png](current/settings-dark-22859048.png) | 1275x720 | 292542 | `D621667BF0189A514ED037440F19792A9875AE32E9C3A7DC253C786A2DB5DA0D` |
| [current/settings-compact-22859048.png](current/settings-compact-22859048.png) | 1275x720 | 292572 | `624950A97E798C993CE8A5DF01ABC9A117E7A8E6361A81DF38D565A387BEDDDB` |
| [current/settings-dark-compact-22859048.png](current/settings-dark-compact-22859048.png) | 1275x720 | 291656 | `0CC003E1A60785CE8EA4A0A64DC5AF0CB09FFF8AAA05023D9103095A15529AE2` |
| [current/settings-select-open-22859048.png](current/settings-select-open-22859048.png) | 1275x720 | 275323 | `2BB21A1B2F6273B9BA3347C9D98A257FAFB1E95CBE82B16B3258266A419A5A25` |
| [current/quick-preview-floating-ready-22859048.png](current/quick-preview-floating-ready-22859048.png) | 1275x720 | 288351 | `E2F9649CC75D8433A6090B9CD201A099D8175D11D2D9B209765135605249C549` |
| [current/quick-preview-pinned-ready-22859048.png](current/quick-preview-pinned-ready-22859048.png) | 1275x720 | 290214 | `630CA21952C2B3F24472A2C1DBC01F71BE232BD47D2AE42917B8099A5811F89F` |
| [current/quick-preview-details-open-22859048.png](current/quick-preview-details-open-22859048.png) | 1275x720 | 309487 | `09408A1C80133EE4DC4866EE1BEECB26537380C526F95E71D4190747376BA978` |
| [current/quick-preview-pdf-fallback-22859048.png](current/quick-preview-pdf-fallback-22859048.png) | 1275x720 | 177940 | `7C3B5BBA5EA36B0CF6BDDAB4DD4F740AE144A2312B0FEAE56BA3A5801D6E15D6` |

## Historical evidence only

The old screenshot files have been moved out of `current/` and retain their
original names under `historical/`. The former `318eb84e` evidence,
the intermediate `7fe9d9d7` evidence, and the intermediate
`5ccca1cf` evidence are historical only. The prior matrix also identified
`3f0553ad948a6ec728c4651fb2993195da7879ab` as an older principal capture;
that identity is not canonical current proof and is not used for the current
score.

## Validation evidence

| Gate | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| Focused Settings / Select / shared Switch / Quick Preview / Preview tests | PASS — 8 files, 73 tests |
| `npm test` | PASS — 148 files, 1582 tests |
| `npm run test:remediation` | PASS — 14 tests |
| `npm run test:performance:architecture` | PASS — 28 tests |
| `npm run build:frontend` | PASS — existing CSS/dynamic-import/chunk-size warnings only |
| `npm run build:native-preview-handler` | PASS — existing linker export warning only |
| `npm run check:rust:release` | PASS |
| `npm run verify:rust` | PASS — fmt, 947 Rust tests passed / 23 ignored, clippy `-D warnings` |
| `npm run test:browser:w2-01` | PASS — contract 8 tests plus all real scenes; source HEAD/tree was `22859048 / 37649d07` |
| `python docs/design/w6-06/07-v26/rebuild-v26.py --verify-only` | PASS — 4/4 |
| Exact-head Tauri runtime build | PASS — final runtime SHA-256 recorded above |
| Native Settings / Quick Preview capture | PASS for captured states — final runtime via node_repl + @oai/sky |
| `npm run security:audit` | BLOCKED — 2 moderate Vitest/`@vitest/mocker` advisory findings |
| `npm run security:audit:rust` | BLOCKED — `rustls 0.23.41` medium advisory plus existing warning inventory |
| W3-02 / W3-03 / W3-04 browser gates | BLOCKED by existing harness role lookup for `File Library`; no production change made |
| W3-09 browser gate | BLOCKED — Markdown preview did not settle a Preview phase in the harness |

The W3 failures are recorded as validation limitations, not parity passes. No
Codex Review, merge, W6-10 work, or new PR was performed.

## Review disposition

Parity score: **PENDING OWNER REVIEW**

The current evidence is ready for the owner checkpoint. Native 969/840/760
screenshots remain unmaterialized because this Windows runtime/environment did
not permit the requested resize; the Settings source tests cover those exact
composition boundaries. Image-ready and unrecaptured transient Preview states
remain unverified.
