# W6-05 — Windows Computer Surface Control Amendment

Status: **ACTIVE CLARIFICATION — applies to W6-05 R0 native-control preflight**

Authority: [`W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-ACTIVATION.md`](W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-ACTIVATION.md)

Execution brief: [`W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-CODEX.md`](W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-CODEX.md)

## Why this clarification exists

The first W6-05 R0 attempt established the exact governance/product provenance successfully, and Computer Use could enumerate Zen Canvas process/window information, but execution stopped because `getApp("Zen Canvas")` / application-ID binding returned:

`Native app bindings are unavailable for windows`

That result proves only that the higher-level native application binding API used by that probe is unavailable in the current Windows runtime. It does **not** by itself prove that the generic Windows `computer` surface cannot visually control the real Zen Canvas Tauri desktop window.

W6-05 requires real Windows desktop interaction. It does not require any particular application-binding helper API.

This clarification narrows the R0 stop condition accordingly. It does not weaken the ban on browser-only evidence and does not convert unavailable Computer Use into PASS.

## Authoritative Windows native-control criterion

For W6-05, **native Windows control is established when all of the following are directly observed**:

1. the audited Zen Canvas executable/process is the real Windows/Tauri product built or run from the bound production source;
2. the Windows `computer` surface can display the real desktop/window containing Zen Canvas;
3. the surface can bring or keep that Zen Canvas window in the foreground without substituting an in-app browser rendering;
4. pointer and/or keyboard input sent through Computer Use can cause a harmless, visible Zen Canvas UI state change;
5. the resulting real desktop state can be captured as native screenshot evidence.

Examples of an acceptable harmless control probe include:

- focus a visible Zen Canvas control and press `Escape`;
- navigate from Overview to File Library and back;
- focus Search and then dismiss/clear focus without changing durable state;
- resize the real Zen Canvas desktop window and verify the rendered UI responds.

The probe must not mutate user files or durable app configuration.

## `getApp()` / app binding is not a prerequisite

The following are **optional helper mechanisms**, not W6-05 acceptance requirements:

- `getApp("Zen Canvas")`;
- application-ID lookup;
- AUMID/native-app binding helpers;
- other higher-level app object bindings.

If those helpers return `Native app bindings are unavailable for windows`, record that limitation in provenance/notes and continue to the generic `computer` surface control probe.

Do **not** classify W6-05 as blocked solely because those helper APIs are unavailable.

## R0 retry procedure

Repeat W6-05 R0 from the current merged governance head while retaining the audited production binding already defined by W6-05.

After normal provenance checks:

1. confirm `computer` is an enabled/available Computer Use surface;
2. launch or identify the real Zen Canvas Tauri app from the audited production worktree/build;
3. use the generic Windows computer surface to view the actual desktop;
4. bring Zen Canvas to the foreground if necessary;
5. perform one harmless reversible UI interaction from the list above;
6. capture a screenshot before/after or otherwise record an unambiguous visible UI transition;
7. record whether pointer input, keyboard input and screenshot capture each worked;
8. record any unavailable `getApp()`/app-binding helper separately as an environment limitation, not as the native-control verdict.

If this direct computer-surface probe succeeds, R0 native-control provenance is **PASS** and W6-05 continues to R1 isolation/fixtures and the full audit.

If the computer surface can enumerate a window but cannot display it, cannot deliver input to it, cannot observe the resulting real desktop state, or only browser content can be controlled, R0 remains fail-closed and the audit stops.

## Evidence boundary remains unchanged

None of the following may be used as a substitute for the direct computer-surface probe:

- browser surface;
- Playwright/browser screenshots;
- source inspection;
- unit/Vitest results;
- CI status;
- process/window enumeration without actual visible desktop interaction.

A real Windows desktop screenshot plus successful reversible input is required before any W6-05 row can receive native `PASS`/`DEGRADED` evidence.

## Durable-state and filesystem safety remain unchanged

This amendment changes only the R0 interpretation of Windows application control.

All existing W6-05 requirements remain binding, including:

- audited production SHA/tree provenance;
- governance successor docs-only proof;
- verified isolated profile or bounded backup-and-restore before persistent-state mutation;
- task-owned disposable fixtures for file mutation;
- no production source changes;
- no browser evidence promoted to native evidence;
- no tag, GitHub Release or `v0.1.40` publication;
- stage-level native QA rather than per-task full native reruns.

## Disposition of the first R0 stop

The first R0 attempt is retained as truthful environment evidence:

- provenance: PASS;
- `getApp()` / native app-binding helper: unavailable on the observed Windows runtime;
- generic Windows computer-surface control: **not yet tested by that attempt**.

Therefore it is not a W6-05 product finding and does not close or block W6-05 by itself.

W6-05 should retry R0 using this amended control criterion.