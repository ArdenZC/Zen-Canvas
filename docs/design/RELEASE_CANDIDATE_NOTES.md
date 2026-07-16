# Zen Canvas v4 Windows Release Candidate Notes

## What Zen Canvas is

Zen Canvas is a local-first desktop workspace for understanding a file library, reviewing organization suggestions, and carrying out explicitly approved file changes with a recoverable history.

## Core capabilities

- Local SQLite indexing and file-library search.
- Organization suggestions with an explicit Preview step.
- Confirmed file operations with conflict and stale-state checks.
- Safe Trash and History/Restore workflows.
- Automation rules that generate suggestions only.
- Optional AI processing modes with fail-closed persistence and clear local/cloud configuration.
- Native Windows folder selection, application controls, global search hotkey, and NSIS packaging.

## File safety boundaries

Zen Canvas does not automatically move, rename, overwrite, permanently delete, or restore files. Suggestions must enter Preview, remain in the authoritative allowlist, pass blocked/path/name/conflict checks, and be explicitly selected and confirmed before execution. Automation and AI do not directly call file execution. Restore does not overwrite an existing destination.

Safe Trash is recoverable storage inside approved boundaries; it is not permanent deletion. Users should still test this RC only with disposable files and isolated folders, never with important originals.

## Windows RC status

The frontend, Rust backend, release build, native fixture flow, performance suite, and security audits have been exercised as part of Stages 9 and 10. Stage 10 additionally reviews the Stage 9 diff, performs real Windows scaling and accessibility checks, and verifies same-version overwrite, data-preserving uninstall, reinstall, and first launch through the real NSIS UI. Exact pass/fail details and any unverified gates are recorded in `PHASE_10_RELEASE_READINESS_CLOSEOUT.md`.

## Known limitations and release risks

- The current Windows executable and installer are unsigned. Windows may show Unknown Publisher or Microsoft Defender SmartScreen warnings. This installer is not approved for public distribution.
- The standalone search WebView can have visibility-observation limitations on the current WebView2 runtime. The in-window Spotlight fallback remains available.
- A same-version overwrite is not a true version-to-version upgrade. A genuine upgrade gate requires two separately versioned, signed builds.
- macOS has not been tested on real hardware in this release-candidate cycle. macOS signing and notarization are not complete.
- Stage 10 evidence produced outside the repository is local QA evidence and is not part of the public source tree.

## Reporting feedback

Include the source commit, Windows version, display scaling, text scaling, theme/high-contrast state, WebView2 version, the page and action involved, and sanitized application/Rust logs. Include a disposable reproduction folder structure when relevant.

Never include API keys, Authorization headers, certificate private keys, passwords, personal filenames, database contents, or unrelated user paths in a report.
