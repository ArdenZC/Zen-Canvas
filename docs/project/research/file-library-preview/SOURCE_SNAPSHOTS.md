# Reference Research — Source Snapshots and Provenance

Audit refresh date: 2026-08-17

## Provenance boundary

The exact contemporaneous source revisions and verbatim working notes from the original W-1 research sessions were **not preserved** in the repository.

The research evidence layer added in August 2026 is therefore a **reconstructed synthesis**. It was rebuilt from surviving Zen decisions/specifications and then checked again against official upstream sources. It must not be cited as though every sentence were copied from a timestamped original W-1 notebook.

The pinned revisions below record the upstream state used for the 2026-08-17 audit/re-verification. They do **not** retroactively claim that these were the exact revisions inspected in the original research.

## Re-verification snapshots

| Reference | Official source used | Snapshot used for 2026-08-17 verification | License/status observed at snapshot |
|---|---|---|---|
| Spacedrive v2 | `spacedriveapp/spacedrive` | `main@6dfeccf2113039e35f2ce735f945e70dc3e4ea45` | README: FSL-1.1-ALv2, converting to Apache-2.0 after two years |
| Files | `files-community/Files` | `main@4be6bc92bc6f65d55d436f42bf18a73cc09a4a3e` | MIT |
| Microsoft PowerToys / Peek | `microsoft/PowerToys` | `main@3d0c3bdb294f96e2e2907dd9fcd7ba363ed0f8e8` plus Microsoft Learn/PowerToys release documentation | MIT |
| QuickLook for Windows | `QL-Win/QuickLook` | `master@cb5d9c429c81d9796fac469da2a68efb5626946d` | GPL-3.0 |
| TagSpaces | `tagspaces/tagspaces` | `develop@7ec3a2e8632b8bf5db685436e6d2d8805977a880` | AGPL-3.0 + commercial dual licensing; Pro components proprietary |
| QLMarkdown | `sbarex/QLMarkdown` | `main@46598db5d67a75bae5f56c777b7104a8c7a3d330` | GPL-3.0 |
| SourceCodeSyntaxHighlight | `sbarex/SourceCodeSyntaxHighlight` | `master@8b9154bee92d23ad3a41f9764136616b823f5974` | GPL-3.0 |
| SpacePeek | Apple App Store listing, app id `6777129953` | App Store listing re-verified 2026-08-17; version 1.4 visible at audit time | Commercial/freemium App Store product; no upstream source repository asserted |
| Original “Super Quick Look” label | Original canonical source not preserved | **NOT PRESERVED / NOT ATTRIBUTED** | No license or implementation claim is made |

## Evidence classes

When reading the research notes, distinguish these classes:

1. **Pinned upstream fact** — supported by the re-verification snapshot/source above.
2. **Zen design inference** — a conclusion Zen drew from one or more references; it is not a claim that the upstream project uses Zen's exact architecture.
3. **Reconstructed historical observation** — a surviving conclusion from the original research whose exact original source revision/working note is no longer available.
4. **Current Zen authority** — reviewed Zen specifications, safety contracts and active initiatives. These outrank the research evidence for implementation decisions.

## Rules for future Waves

- If a later Wave depends on a mutable upstream behavior, re-verify that behavior against a new pinned revision/source before implementation.
- Do not silently replace this snapshot table with newer revisions and imply that the original W-1 research used them. Add a dated verification entry instead.
- Do not copy implementation code merely because a project is listed here. License obligations and Zen's clean-room boundaries still apply.
- Commercial/App Store references are behavioral/product evidence only unless an official source repository is independently identified.

## Primary source locations

- Spacedrive: https://github.com/spacedriveapp/spacedrive
- Files: https://github.com/files-community/Files
- PowerToys: https://github.com/microsoft/PowerToys
- PowerToys Peek documentation: https://learn.microsoft.com/windows/powertoys/peek
- QuickLook for Windows: https://github.com/QL-Win/QuickLook
- TagSpaces: https://github.com/tagspaces/tagspaces
- QLMarkdown: https://github.com/sbarex/QLMarkdown
- SourceCodeSyntaxHighlight: https://github.com/sbarex/SourceCodeSyntaxHighlight
- SpacePeek: https://apps.apple.com/us/app/spacepeek/id6777129953?mt=12
