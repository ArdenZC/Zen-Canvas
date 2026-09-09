# W6-09 V26 parity matrix — Settings + Quick Preview

Status: **PENDING OWNER REVIEW**

This is a bounded evidence package for Issue #241 / PR #242. It compares the
V26 target showcase with the exact Windows native runtime only for Settings and
Quick Preview. It is not a numerical score and does not claim `98%`, release
readiness, or final acceptance.

## Evidence identity

| Field | Target | Current native evidence |
| --- | --- | --- |
| Source | `target/zen-canvas-full-product-showcase-v26-windows.html` | Exact production source head `3f0553ad948a6ec728c4651fb2993195da7879ab`; tree `b50dab95a13e3ed809004688adc83bc84bdb22b7`. Earlier captures remain identified below when they were taken from the preceding production head. |
| Capture path | Headless target render | Direct `@oai/sky` `get_window_state({ include_screenshot: true })` from a live native window; the returned JPEG was converted to PNG with `System.Drawing` |
| Runtime | Synthetic showcase | Exact-head capture: `F:\CargoTarget\debug\zen-canvas.exe`, PID `4412`, window `10622324`, title `Zen Canvas`; binary hash below. Earlier current captures use the prior exact runtime PID `35848`, window `35461072`. |
| Binary SHA-256 | N/A | `A5C6B9570E3D72E88A449766735D49FBBB76A1EF0D302BADF99469B643F1C662` |
| Window / viewport | `1282×862` except `target/settings-narrow.png` at `760×862` | Exact-head Settings capture is `1282×862`; earlier current captures are `1282×862` or the observed native minimum `969×862` |
| DPI | Not specified by target | Host DPI/scaling variant was not independently measured; do not infer DPI parity |

The target images are browser/headless evidence. The current images are native
evidence from the process-backed window above. Browser/headless evidence does
not prove native behavior.

## State matrix

| Surface/state | Target evidence | Current native evidence | Result and boundary |
| --- | --- | --- | --- |
| Settings — light/default | [`target/settings-default.png`](target/settings-default.png) | [`current/settings-default-exact-head.png`](current/settings-default-exact-head.png); preceding fix capture [`current/settings-default-switch-fixed.png`](current/settings-default-switch-fixed.png) | Main Settings structure is comparable. The exact-head native capture is `1282×862` and shows the read-only Quick Preview thumb fully inside its `40×24` track. Target shows `跟随系统`; current shows `白昼`, default density, and a disabled/read-only Quick Preview state. **Geometry fixed on the exact production head; state/theme differences remain for owner review.** |
| Settings — dark | [`target/settings-dark.png`](target/settings-dark.png) | [`current/settings-dark.png`](current/settings-dark.png) | Dark palette and Settings structure are present in both. Current Quick Preview remains disabled/off while target shows it enabled/on. **Partial parity.** |
| Settings — compact | [`target/settings-compact.png`](target/settings-compact.png) | [`current/settings-compact.png`](current/settings-compact.png) | Compact density is observable in both. Current capture is light/follow-system with Quick Preview disabled/off; target controls remain enabled/on. **Partial parity.** |
| Settings — appearance select open | [`target/settings-select-open.png`](target/settings-select-open.png) | [`current/settings-select-open.png`](current/settings-select-open.png) | Target menu is visibly painted. Native accessibility output exposed the listbox options, but the native screenshot did not visibly paint the option menu and showed horizontal overflow. **Visual parity unverified.** |
| Settings — narrow | [`target/settings-narrow.png`](target/settings-narrow.png) (`760×862`) | [`current/settings-min-width.png`](current/settings-min-width.png) (`969×862`) | Native resize attempts reached an apparent `969` logical-pixel minimum and could not reach `760`. **Target narrow state unverified; no synthetic native capture substituted.** |
| Quick Preview — PDF | [`target/quick-preview-pdf.png`](target/quick-preview-pdf.png) | [`current/quick-preview-pdf-v26.png`](current/quick-preview-pdf-v26.png) | Target is a synthetic ready `Release checklist.pdf` presentation. Native evidence is the real `准考证_苑中亚_411722200503238230.pdf` and truthfully shows unsupported presentation with metadata and `boundary_readable`. **State/content mismatch; not a native ready-PDF pass.** |
| Quick Preview — floating ready | [`target/quick-preview-floating-ready.png`](target/quick-preview-floating-ready.png) | [`current/quick-preview-floating-ready.png`](current/quick-preview-floating-ready.png) | Native `项目4.txt` modal reached `预览内容已准备好` with text content and File Library metadata. Target uses synthetic content and is `1282×862`; native capture is `969×862`. **Ready-state seam observed; geometry/content parity partial.** |
| Quick Preview — pinned ready | [`target/quick-preview-pinned-ready.png`](target/quick-preview-pinned-ready.png) | [`current/quick-preview-pinned-ready.png`](current/quick-preview-pinned-ready.png) | Native pin action completed. Accessibility state exposed `固定预览`, `取消固定预览` and `预览会跟随当前焦点项目`; the screenshot shows the pinned host. **Pinned-state seam observed; geometry/content parity partial.** |
| Quick Preview — loading / failed | [`target/quick-preview-loading.png`](target/quick-preview-loading.png), [`target/quick-preview-failed.png`](target/quick-preview-failed.png) | No canonical current capture | These states were not reproducible in this bounded native session. **UNVERIFIED; no state was fabricated.** |

## Canonical capture hashes

The following hashes identify the captures used by the matrix. All current
captures are `969×862` or `1282×862` PNGs as stated above.

| Capture | SHA-256 |
| --- | --- |
| `current/settings-default.png` | `300C0111A16B0AED26440AF88AA838A2D9D280FEE2E9DC69CC3C6C9F4E9B52F8` |
| `current/settings-default-exact-head.png` | `58009ADB86929BC31F70DC33CB83B2996984775A73CCAF94024D6ADA9BD1859F` |
| `current/settings-default-switch-fixed.png` | `30E719A6BD813CC6AF3AC929B65BE761B65C802FA32BCAB708E4CB9C4AAD8693` |
| `current/settings-dark.png` | `983635C96FE5C2A2A7EFE33057B42E920BF9BF39904B4095CC63A351DDFAD3A3` |
| `current/settings-compact.png` | `CCAAF2B6B1628333DC9C4FACEADECE62206FFB857B2AFAC36380C031D99EC564` |
| `current/settings-select-open.png` | `77B412009D3AB3E9D263565EC15FCD4B44332620340D97384D0D9B6641ED6FBA` |
| `current/settings-min-width.png` | `956D296B5A916A2FB5AE55D62D39C9DFC4D0826F51B24B9279608678001091C9` |
| `current/quick-preview-pdf-v26.png` | `7B5FCEE7EED639B723B0E7CA88A17B6A73AE1E9D5EE7FA8F8FD39B826A5A9BE1` |
| `current/quick-preview-floating-ready.png` | `CE94E90104C5F6160E84F3D48B6442F366BEEAA6272F741434DB80BB2D346CB8` |
| `current/quick-preview-pinned-ready.png` | `1BB5909F93383F10A0A2F8D471214A1C11240909AB5558E0D2B7C2834E8B1603` |

## Remaining mismatches and unverified claims

1. The native Settings Quick Preview control remains disabled/read-only in the
   captured runtime while the target control is interactive. Its follow-up
   native geometry is now aligned: the thumb no longer drifts outside the
   track.
2. The target default appearance is `跟随系统`; the captured native default
   image is `白昼`. The native theme menu was exposed to accessibility, but its
   painted menu did not match the target screenshot.
3. The native window did not reach the target `760×862` narrow viewport; its
   observed floor was `969×862`. The target narrow claim therefore remains
   unverified.
4. The synthetic PDF and ready-text fixtures do not represent the same files as
   the native File Library results. Native PDF behavior is the observed
   unsupported / `boundary_readable` state; native loading and failed states
   were not reproduced here.
5. Native DPI variants, Forced Colors, macOS, assistive technology, and the
   broader W6-09 surfaces are outside this materialization package and remain
   governed by the W6-09 status record.

## Exact-head hosted validation

Hosted CI run [`34365984757`](https://github.com/ArdenZC/Zen-Canvas/actions/runs/34365984757)
completed **successfully** for production head
`3f0553ad948a6ec728c4651fb2993195da7879ab`. Its source checkout/evidence,
frontend and format quality, W2-01 real browser gate (including the compact
`980×680` scroll/load-more scene), W2-10/W2-11 browser gates, Performance
Search/Preview lanes, and Windows/macOS quality dependency checks all passed.
The earlier run `34363817567` is retained as historical failure evidence for
the now-fixed compact-library virtual-scroll boundary and is not the current
head result.

## Review disposition

The Settings + Quick Preview evidence is materialized for owner review. The
package records real native states and explicit mismatches; it does not promote
the V26 target to a `98%` or `PASS` claim. W6-09 remains active.
