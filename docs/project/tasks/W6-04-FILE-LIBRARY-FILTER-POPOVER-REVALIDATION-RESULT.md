# W6-04 Filter Popover Native Revalidation Result

## Status

**COMPLETE — focused native revalidation of the repaired Filter popover P2.**

This is not a second full W6-04 review. The original rendered-review result and its observations remain unchanged. This document records only the native revalidation of PR #195 and the evidence needed to close the previously observed Filter popover occlusion/focus defect.

Date/time: 2026-09-05, Asia/Shanghai

## Source and provenance

| Item | Value |
| --- | --- |
| Repository | `F:\Coding\Zen-Canvas` (`ArdenZC/Zen-Canvas`) |
| Tested implementation branch | `feat/w6-04-filter-popover-boundary-focus` |
| Tested exact SHA | `1aab52bb63f6c16e28ea9880c4a4afe52594c0c8` |
| Tested tree | `73f2868aef6e2bd03d44104866652f9c88056d13` |
| `origin/master` after fetch | `9895079a4ebb1e810b8c42d6a74b24ba147c6645` |
| Original W6-04 evidence commit | `1aab5bb414ccbf94fc1afd9760072153fb2331da` — pushed before this revalidation |
| Production-code changes in this result branch | None |

The implementation branch was clean and equal to its remote before testing. `npm run typecheck` passed, and `npx vitest run tests/fileLibraryFilterPopover.test.ts` passed 1 file / 3 tests. The focused source test includes medium, above-placement and compact-width cases; those results are supporting evidence only and are not substituted for native observations below.

## Environment

- Windows 11 Pro, build `10.0.26200`, x64.
- Display `1920×1080`, work area `1920×1032`, `96 DPI / 100%`; display settings were not changed.
- Native Computer Use: **PASS**. The target was the real Tauri process `F:\CargoTarget\debug\zen-canvas.exe`; a real Windows folder picker was also controlled. No browser mock, Playwright, DOM/CSS edit or source edit was used.
- The pre-existing installed service `C:\Program Files\Zen Canvas\zen-canvas.exe` was not used as evidence and was left untouched.
- Launch command: `npm run dev -- --config '{"identifier":"com.startlan.zencanvas.w604revalidation20260905b"}'` for the primary run, with a second short native focus-wrap run using identifier `com.startlan.zencanvas.w604revalidation20260905c`.
- No W6-05 installer, NSIS, SmartScreen, Unknown Publisher, Explorer Preview Handler, tag, release or publication action was performed.

## Fixture and evidence classification

Task-owned disposable fixtures were created on the repository drive and contained only small non-sensitive review files: `README.md`, `中文说明.txt`, `Data\metrics.csv`, `Source\main.ts`, and `Archive\old-notes.txt`.

- Primary fixture: `F:\Coding\Zen-Canvas\.tmp-tests\w6-04-filter-revalidation-20260905-clean`.
- Supplemental focus-wrap fixture: `F:\Coding\Zen-Canvas\.tmp-tests\w6-04-filter-revalidation-20260905-wrap`.
- Both fixtures were created specifically for this QA, used through the real Windows folder picker, and removed exactly after the run. Final existence checks returned `False` for both paths.

`PASS` below means directly observed in the real native/Tauri application. `UNVERIFIED` means the required native condition was not safely available; it is not inferred from source or browser behavior. CUA screenshots were captured during the native observations; no large transient capture files were committed.

## Native revalidation observations

### Geometry, occlusion and scroll boundary

Core target: `1282×862` actual native window size.

- Approximate workspace bounds in the native capture: `x≈228..1279`.
- Approximate Filter panel bounds: `x≈241..621`, `y≈144..705`.
- Placement: `below — OBSERVED`.
- The panel was fully visible, no longer occluded by the left File Library area, and did not cross the workspace safe boundary or become covered by Navigation/Context chrome.
- The panel's internal vertical scrollbar was visible and usable; the lower controls remained reachable and `完成` was visible/reachable.

Result: **PASS**.

### Initial focus and keyboard containment

Opening Filter from the native File Library placed the visible focus ring on the first filter control, `文件类型` (File Type), and the native accessibility tree exposed dialog `筛选文件`.

The observed forward sequence stayed inside the dialog and auto-scrolled as needed:

`文件类型 → 生命周期 → 风险 → 重复文件 → 需要确认 → 包含全部标签 → 包含任一标签 → 排除标签 → 完成`

The actual dialog tab order places `清除筛选` before the filter controls for wrap purposes. From `完成`, Tab moved to `清除筛选`, with the dialog still open; from `清除筛选`, Shift+Tab moved back to `完成`. No focus escaped to the File Library background. This directly verifies both wrap edges.

- Initial focus: **PASS** — visual focus ring on `文件类型`.
- Tab containment and last-to-first wrap: **PASS** — `完成 → Tab → 清除筛选`.
- Shift+Tab containment and first-to-last wrap: **PASS** — `清除筛选 → Shift+Tab → 完成`.

### Escape and Done restoration

- Escape closed the dialog and restored the visible focus ring to the original `筛选` trigger; the closed visual state was restored. Result: **PASS**.
- A separate keyboard path tabbed to `完成` and activated it. The dialog closed and focus returned to `筛选`. Result: **PASS**.

### Real filter value application

On the primary fixture, the native File Type control was opened and `代码` was selected through the real Windows/native keyboard path. The File Library then showed the Query V2-backed result `1 / 1`, containing `main.ts` (Code). After activating `清除筛选`, the result restored to `9 / 9`; the panel stayed open until Escape and then returned focus to the trigger.

An earlier UIA `set_value` attempt reported a read-only cache error. It did not count as evidence or as a failure; the actual native select/popup/Return interaction succeeded and produced the result change above.

Result: **PASS**.

### Narrow-window smoke

At an actual native window size of approximately `1041×862`, Filter remained inside the File Library workspace, narrowed safely without horizontal clipping, retained internal scrolling and kept `完成` reachable. Escape returned focus to `筛选`.

Result: **PASS**.

### Low vertical space / placement flip smoke

The native window was also reduced to approximately `1041×681`. The trigger remained near the top of the usable toolbar and the panel continued to render below it. A safe native condition with the trigger genuinely near the lower boundary could not be manufactured without forcing an invalid or unsafe layout; no real above-placement observation was therefore claimed.

Result: **UNVERIFIED** — `placement: above` was not observed in the native environment. The implementation branch's above-placement unit test is not used to upgrade this native result.

## Findings and decision

- P0: `0`.
- P1: `0`.
- P2: `0` open. Previous W6-04 Filter popover occlusion/focus finding is **CLOSED** by this revalidation.
- P3: `0`.
- The transient `Scan root already has an active run` message in the short supplemental setup was an environment/backend setup observation, not a Filter popover product finding; it did not alter the primary 9/9 native filter evidence.

## Cleanup and scope boundary

- Filter was closed before teardown.
- The window was restored to approximately `1283×862` (one pixel from the `1282×862` target due to native frame sizing).
- The disposable fixtures above were deleted and verified absent.
- The temporary native dev process and dev shell were stopped; only the pre-existing installed service remained.
- The result branch is the only branch receiving a new commit. No production code was changed, and no Codex Review, W6-05 release acceptance, tag, GitHub Release or `v0.1.40` publication was performed.

## Final result

**PASS — W6-04 P2 CLOSED**

**NO W6-04 IMPLEMENTATION REQUIRED**

```text
tested_implementation_branch: feat/w6-04-filter-popover-boundary-focus
tested_exact_sha: 1aab52bb63f6c16e28ea9880c4a4afe52594c0c8
tested_tree: 73f2868aef6e2bd03d44104866652f9c88056d13
native_app_control: PASS
filter_popover_geometry: PASS
initial_focus: PASS
tab_containment_and_wrap: PASS
shift_tab_containment_and_wrap: PASS
escape_restore: PASS
done_restore: PASS
filter_value_application: PASS
narrow_window_smoke: PASS
vertical_flip_smoke: UNVERIFIED
p0_findings: 0
p1_findings: 0
p2_open_findings: 0
p3_findings: 0
implementation_recommendation: NONE
release_acceptance_claimed: false
publication_authorized: false
```
