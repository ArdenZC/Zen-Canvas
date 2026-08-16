# Reference Projects — Comparison Matrix

Source verification refreshed: 2026-08-17. See [`SOURCE_SNAPSHOTS.md`](SOURCE_SNAPSHOTS.md) for exact upstream revisions and provenance limits.

The historical Zen conclusions below are a reconstruction of the W-1 research outcome. The exact contemporaneous W-1 upstream revisions were not preserved; the pinned snapshots document only the 2026-08-17 re-verification state.

| Reference | Why we studied it | Adopt / adapt | Explicit rejection / guardrail | Main Zen influence |
|---|---|---|---|---|
| **Spacedrive v2** | Cross-platform file-library / VDFS architecture; object/content identity vs location; Rust-based desktop core | Separate logical entry/content identity from physical location/path; treat locations as first-class capability/policy boundaries; preserve higher-level identity across rename/move only when continuity is verified | Do not turn Zen into a distributed VDFS/cloud-drive/cross-device data platform; do not copy Spacedrive persistence/job/agent architecture wholesale | W0-C domain contracts; W1-01 Entry/Location refs; W2 Library/Browse model |
| **Files** | Modern Windows file-manager UX and Explorer-centered conventions | Preserve Windows-native browsing expectations; shared Back/Forward target history; breadcrumb behavior; per-target List/Grid/presentation preferences | Do not clone Explorer or force Windows users into macOS conventions; do not let UI convenience replace managed authorities | W0-B IA; W1-02 navigation; W2 workspace UX |
| **PowerToys Peek** | Windows quick-preview UX, lifecycle and native-file preview behavior | Preview as disposable/cancellable session; deterministic cleanup; explicit resource/lifetime handling; Windows-native fallback seams | Do not make Preview lifecycle depend on the UI window; do not treat native Preview Handler as Zen's only Windows host | W0-D Preview Core/Host; W1-06 lifecycle; W4 Windows native integration |
| **QuickLook for Windows (QL-Win)** | Mature Space-to-preview interaction and extensible content-provider model | Priority/provider registry, capability-based fallback, rapid sibling navigation, explicit provider lifecycle | v1 built-in providers only; no arbitrary third-party Preview plugin SDK; GPL-3.0 implementation is study-only/clean-room | W0-D provider registry; W3 provider architecture |
| **TagSpaces** | Offline-first file organization, tags, perspectives/viewers, thumbnail generation | Multiple perspectives over the same files; viewer modularity; thumbnail generation as shared infrastructure; local-first stance | Do not reproduce its UI breadth or editor suite; guard 100k+ scale explicitly; do not create filename/sidecar metadata behavior merely because TagSpaces supports it | W0-B/W0-E; W1-08 Thumbnail; W2 List/Grid/Inspector |
| **QLMarkdown** | Real macOS Quick Look extension for rich Markdown | Separate standalone app/settings from system Quick Look extension; registered file-type/Quick Look extension boundaries; sandbox/security awareness; formatted-preview provider can be distinct from source-code provider | Do not treat Quick Look extension as the Zen app UI; do not execute embedded code/JS by default | W0-D Provider/Host split; W3 Markdown provider; W4 macOS Quick Look host |
| **SourceCodeSyntaxHighlight** | macOS source-code Quick Look extension | Native extension boundaries, format/type ownership conflicts, source-format specialization | Do not assume a Quick Look extension can safely claim every type; do not merge Markdown/source-code semantics into one provider just for convenience | W0-D capability/host rules; W3 code provider; W4 macOS integration |
| **SpacePeek** | Native folder Quick Look with on-demand size/count/largest-item/tree analytics | Folder preview can be useful without durable indexing; on-demand local scan; progressive overview + contents; project/Git hints as enrichment, not core truth | Do not scan entire libraries merely for Preview; do not block Preview shell on exact recursive analytics; no implicit indexing authority | W0-D FolderSummary; W0-F folder 1k/10k/100k gates; W3 Folder provider |
| **Lightweight “super quick preview” utilities** | Validate that users value instant preview and longer text/code viewing without launching a heavy app | Space-triggered, read-only, low-friction preview; custom text rendering where native Quick Look is weak | Do not grow Zen into a general document editor or app shelf; keep Preview capability bounded | Product north star; W3 UX |

The final row is a product-pattern category. The original conversation used the label **“Super Quick Look”**, but its canonical upstream URL was not preserved. No current project is claimed to be that exact original reference.

## Official source index

Primary project sources used for the 2026-08-17 re-verification:

- Spacedrive: https://github.com/spacedriveapp/spacedrive
- Files: https://github.com/files-community/Files
- Microsoft PowerToys / Peek: https://github.com/microsoft/PowerToys
- Microsoft Peek documentation: https://learn.microsoft.com/windows/powertoys/peek
- QuickLook for Windows: https://github.com/QL-Win/QuickLook
- TagSpaces: https://github.com/tagspaces/tagspaces
- QLMarkdown: https://github.com/sbarex/QLMarkdown
- SourceCodeSyntaxHighlight: https://github.com/sbarex/SourceCodeSyntaxHighlight
- SpacePeek App Store listing: https://apps.apple.com/us/app/spacepeek/id6777129953?mt=12

## License / clean-room matrix

This section records the license/status observed during the 2026-08-17 audit. It is not legal advice, and any future implementation reuse must re-check the exact dependency/source being considered.

| Reference | Observed license/status | Zen research rule |
|---|---|---|
| Spacedrive v2 | Current README: FSL-1.1-ALv2, converting to Apache-2.0 after two years | Architecture/product observation only unless a separately reviewed compatible reuse is established |
| Files | MIT | Reference behavior/UX freely; code reuse still requires normal dependency/license review |
| PowerToys | MIT | Reference behavior/UX; any code reuse requires explicit scoped dependency/license review |
| QuickLook for Windows | GPL-3.0 | Study-only / clean-room implementation for Zen concepts |
| TagSpaces | AGPL-3.0 + commercial dual licensing; Pro components proprietary | Study-only / clean-room for open-source implementation; do not copy Pro/proprietary components |
| QLMarkdown | GPL-3.0 | Study-only / clean-room implementation |
| SourceCodeSyntaxHighlight | GPL-3.0 | Study-only / clean-room implementation |
| SpacePeek | Commercial/freemium App Store product; no source repository asserted here | Behavioral/product reference only |
| Original “Super Quick Look” label | Source/license not preserved | No implementation or license claim may be inferred |

Research does not authorize code copying. Zen may adopt publicly observable architecture/UX ideas and independently implement compatible concepts, but implementation must follow Zen's own contracts and applicable license rules.