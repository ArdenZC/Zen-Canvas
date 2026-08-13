# Code pull-request CI fast path

Code pull requests use parallel, purpose-specific jobs instead of one serial platform matrix.

- Frontend tests, remediation contracts, and `cargo fmt` run once on Ubuntu.
- Windows and macOS Rust validation run in parallel.
- Ordinary pull requests use the bounded PR performance profile plus one 100k FTS complexity sentinel.
- Database, search, scan, dedupe, and analysis-sensitive pull requests use the extended 100k performance profile.
- The full performance profile is reserved for scheduled validation, manual full validation, labeled full-validation pull requests, missing diff bases, and other high-risk paths.
- Ordinary pull requests build the Vite production frontend and run a platform-specific Rust release `cargo check`; they do not perform a full Tauri link or bundle.
- Packaging-sensitive pull requests run package metadata/input smoke checks in addition to the normal cross-platform release compile. They do not run NSIS or DMG packaging unless full validation is selected.
- Scheduled/manual full validation and high-risk paths perform the full link and build NSIS and unsigned DMG packages. Ordinary `master` pushes do not become full solely because they are pushes.
- Dependency audit runs on Ubuntu.
- The required check names `Quality (windows-latest)`, `Quality (macos-latest)`, and `Dependency audit` remain stable.

Change classification includes added, copied, modified, renamed, type-changed, and deleted paths. A source deletion can therefore never be hidden by an accompanying documentation edit.

The product remains Windows/macOS-only. Ubuntu is used only for platform-independent CI work such as TypeScript, Vitest, remediation contracts, formatting, change classification, and dependency auditing.
