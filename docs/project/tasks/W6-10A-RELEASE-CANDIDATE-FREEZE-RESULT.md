# W6-10A — Release Candidate Freeze — Result

Status: **COMPLETE / CLOSED**

Verified: 2026-09-22

## Final disposition

> **RC1 FROZEN / ACCEPTED FOR RELEASE QUALIFICATION**

This result freezes the exact RC1 source and the exact release-build artifacts
for later W6-10B/C qualification. It does not claim Windows release PASS,
macOS release PASS, product release, publication authorization, or native
manual acceptance.

## Authoritative identities

| Item | Exact value |
| --- | --- |
| Activation branch | `codex/w6-10a-rc-freeze` |
| Activation HEAD | `4b12876e0098659f682674b05f1692a06bad302b` |
| Activation tree | `0748143693a9da2001ec40854b1cb61dce2fd9be` |
| RC1 source | `9c8cdee792f8a2b5078c22c517d8648899440b0c` |
| RC1 tree | `3ec2158bb56ce0a734b2c894793f5fe60b8b3296` |
| RC helper ref | `rc/w6-10-0.1.40-rc1` |
| RC helper HEAD | `9c8cdee792f8a2b5078c22c517d8648899440b0c` |
| Candidate version | `0.1.40` |
| PR | [#246](https://github.com/ArdenZC/Zen-Canvas/pull/246) — **MERGED** to `master@07bb2ea546ea4469b8aa143f22f47b0da66a3286` |
| Issue | [#245](https://github.com/ArdenZC/Zen-Canvas/issues/245) — **CLOSED / completed** |

The local activation branch and worktree were clean at the final evidence
checks. The RC helper ref was not moved.

## Version and publication state

All checked version authorities declare `0.1.40`:

- `package.json`
- `package-lock.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`

Publication state before and after both workflows:

- tag `v0.1.40`: **ABSENT**;
- GitHub Release `v0.1.40`: **ABSENT**;
- no conflicting GitHub release was present at preflight;
- frozen RC source keeps `W6_RELEASE_PUBLICATION_ENABLED: "false"`.

## CI Full Validation

Run: [35702434460](https://github.com/ArdenZC/Zen-Canvas/actions/runs/35702434460)

| Field | Result |
| --- | --- |
| Workflow | `CI Full Validation` |
| Event | `workflow_dispatch` |
| Head SHA | `9c8cdee792f8a2b5078c22c517d8648899440b0c` |
| Conclusion | **SUCCESS** |

All jobs in the fresh exact-SHA run succeeded, including:

- `Full Validation / source evidence`;
- `Full Validation / lane plan`;
- `Quality (windows-latest)`;
- `Quality (macos-latest)`;
- `Package NSIS`;
- `Package unsigned DMG`;
- `Dependency audit`;
- release compile on Windows and macOS;
- Rust quality on Windows and macOS;
- Windows native Preview Handler;
- all Performance / Prepare, shard, profile and native macOS performance jobs;
- Frontend and format quality.

## Release Build

Run: [35704683429](https://github.com/ArdenZC/Zen-Canvas/actions/runs/35704683429)

| Field | Result |
| --- | --- |
| Workflow | `Build Release Installers` |
| Event | `workflow_dispatch` |
| Head SHA | `9c8cdee792f8a2b5078c22c517d8648899440b0c` |
| Conclusion | **SUCCESS** |
| `Require CI Full Validation for exact SHA` | **SUCCESS** |
| Selected Full Validation run | `35702434460` — exact RC1 SHA — **SUCCESS** |
| Windows NSIS | **SUCCESS** |
| macOS DMG | **SUCCESS** |
| Publish GitHub Release | **SKIPPED** |

The qualification job log explicitly selected Full Validation run
`35702434460` for expected SHA `9c8cdee792f8a2b5078c22c517d8648899440b0c`.

## Release artifacts

Artifacts were downloaded outside the repository to:

`F:\CargoTarget\w6-10-rc1-9c8cdee\`

### Windows

| Field | Result |
| --- | --- |
| GitHub artifact | `Zen-Canvas-Windows` |
| Artifact ID | `10684476661` |
| GitHub artifact digest | `sha256:3df681a8d261f864df00008d160951cd8f15eb07fea1a0e9c2383d36672f1a5e` |
| Artifact size | `9446575` bytes |
| Installer | `Zen Canvas_0.1.40_x64-setup.exe` |
| Installer size | `9380984` bytes |
| Installer SHA-256 | `c7fed4c0bbd9d065d7b9772a34d67455ad4423c16e7a85e700e0bea52a0eed98` |
| `installers-windows.sha256` | **MATCH** |

Exactly one non-empty `.exe` was present, and its name identifies version
`0.1.40` and x64 packaging.

### macOS

| Field | Result |
| --- | --- |
| GitHub artifact | `Zen-Canvas-macOS` |
| Artifact ID | `10684705483` |
| GitHub artifact digest | `sha256:3e3d94212fe1a3f8e559f6b4f694f6df9ac097f560d4fb041fbfeff3d6c38e24` |
| Artifact size | `13226342` bytes |
| DMG | `Zen Canvas_0.1.40_aarch64.dmg` |
| DMG size | `13292198` bytes |
| DMG SHA-256 | `0216b4c16e85f1b77aa6ff1b1c6090ea591f729fba4bff46e09faa6e73085c4f` |
| `installers-macos.sha256` | **MATCH** |

Exactly one non-empty `.dmg` was present. Its name identifies `aarch64`; no
`x86_64` or `universal` claim was present.

## SBOM contract

Exactly **two** `*.cdx.json` files were present across the downloaded release
artifacts:

1. `Zen-Canvas-Windows/sbom-node.cdx.json` — valid JSON, `bomFormat: CycloneDX`, `specVersion: 1.5`;
2. `Zen-Canvas-Windows/src-tauri/sbom-rust.cdx.json` — valid JSON, `bomFormat: CycloneDX`, `specVersion: 1.3`.

The exact-two Node + Rust SBOM contract **PASSED**. No duplicate or third SBOM
was present.

## W6-10 boundary after acceptance

- W6-10A: **COMPLETE / CLOSED**;
- RC1: **FROZEN / ACCEPTED FOR RELEASE QUALIFICATION**;
- W6-10B Windows Release Qualification: **ELIGIBLE / NOT ACTIVE**;
- W6-10C macOS Release Qualification: **ELIGIBLE / NOT ACTIVE**;
- W6-10D/E/F: **DEPENDENCY-GATED / NOT ACTIVE**;
- publication: **DEFERRED**.

No Windows manual installation, macOS Finder/Gatekeeper acceptance, tag
creation, GitHub Release creation, or publication was performed during RC1
freeze. PR #246 was subsequently squash-merged to
`master@07bb2ea546ea4469b8aa143f22f47b0da66a3286`; merge-after hosted CI
`35709481851` is **SUCCESS**. The merge did not change RC1 source/artifacts and
did not activate W6-10B/C.
