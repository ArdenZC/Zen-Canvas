# Documentation-only CI Fast Path

## Purpose

Pure documentation pull requests should not spend time building the desktop application or repeating production-code verification that cannot be affected by the change.

## Eligible changes

The lightweight path is used only when every changed file is documentation-only:

- files under `docs/`;
- Markdown or MDX files;
- root `LICENSE*` files;
- GitHub issue and pull-request templates.

Any source code, workflow, script, package metadata, dependency, test, permission, installer, version, release, or lockfile change continues to run the complete CI matrix.

## Lightweight validation

An eligible documentation pull request runs `Change scope / documentation contract`, which checks:

- unresolved merge-conflict markers;
- unclosed Markdown code fences;
- broken relative links in changed Markdown files;
- authorized remediation task documents referenced by the remediation index.

It does not run Rust compilation, frontend test suites, performance benchmarks, dependency audits, NSIS packaging, or DMG packaging.

## Full CI remains authoritative

Production-code pull requests continue to run:

- Windows and macOS frontend, Rust, Clippy, and platform regression checks;
- the Windows 100k search benchmark and native hardening smoke test;
- Windows NSIS and macOS unsigned DMG packaging;
- npm and RustSec dependency audits.

The change classifier is intentionally conservative: an unknown or mixed file type selects the full CI path.
