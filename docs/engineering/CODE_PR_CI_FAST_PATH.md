# Code pull-request CI fast path

Code pull requests use parallel, purpose-specific jobs instead of one serial platform matrix.

- Frontend tests, remediation contracts, and `cargo fmt` run once on Ubuntu.
- Windows and macOS Rust validation run in parallel.
- Ordinary pull requests use the bounded performance profile plus one 100k FTS complexity sentinel.
- Database, search, scan, dedupe, and analysis-sensitive pull requests run the full performance suite.
- Ordinary pull requests compile release applications with `--no-bundle`.
- Packaging-sensitive pull requests, `master` pushes, nightly runs, and manual runs build NSIS and unsigned DMG packages.
- Dependency audit runs on Ubuntu.
- The required check names `Quality (windows-latest)`, `Quality (macos-latest)`, and `Dependency audit` remain stable.

Change classification includes added, copied, modified, renamed, type-changed, and deleted paths. A source deletion can therefore never be hidden by an accompanying documentation edit.

The product remains Windows/macOS-only. Ubuntu is used only for platform-independent CI work such as TypeScript, Vitest, remediation contracts, formatting, change classification, and dependency auditing.
