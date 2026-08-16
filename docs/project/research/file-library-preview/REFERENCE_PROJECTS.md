# Reference Projects — Comparison Matrix

Source verification refreshed: 2026-08-17. Historical Zen conclusions below reflect the original W-1 research rounds; current upstream links are retained for traceability and should be re-verified again when a later Wave depends on a changing upstream capability.

This matrix summarizes the external projects that most strongly influenced the File Library 2.0 / Preview Platform research.

| Reference | Why we studied it | Adopt / adapt | Explicit rejection / guardrail | Main Zen influence |
|---|---|---|---|---|
| **Spacedrive v2** | Cross-platform file library / virtual filesystem architecture; object vs location thinking; Rust-based desktop implementation | Separate logical entry/object identity from physical location/path; treat locations as first-class capability/policy boundaries; preserve identity across rename/move when verified | Do not turn Zen into a distributed VDFS/cloud-drive product; do not copy Spacedrive persistence or job architecture wholesale | W0-C domain contracts; W1-01 Entry/Location refs; W2 Library/Browse model |
| **Files** | Modern Windows file-manager UX and Explorer integration | Preserve Windows-native browsing expectations; shared Back/Forward target history; breadcrumb behavior; per-target List/Grid/presentation preferences | Do not clone Explorer or force Windows users into macOS conventions; do not let UI convenience replace managed authorities | W0-B IA; W1-02 navigation; W2 workspace UX |
| **PowerToys Peek** | Windows quick-preview UX, lifecycle and native-file preview behavior | Preview as disposable/cancellable session; deterministic cleanup; explicit resource/lifetime handling; Windows-native fallback seams | Do not make Preview lifecycle depend on the UI window; do not treat native Preview Handler as Zen's only Windows host | W0-D Preview Core/Host; W1-06 lifecycle; W4 Windows native integration |
| **QuickLook for Windows (QL-Win)** | Mature Space-to-preview interaction and extensible content-provider model | Priority/provider registry, capability-based fallback, rapid sibling navigation, explicit provider lifecycle | v1 built-in providers only; no arbitrary third-party Preview plugin SDK; GPL-3 implementation is study-only/clean-room | W0-D provider registry; W3 provider architecture |
| **TagSpaces** | Offline-first file organization, tags, perspectives/viewers, thumbnail generation | Multiple perspectives over the same files; viewer modularity; thumbnail generation as shared infrastructure; local-first stance | Do not reproduce its UI breadth or editor suite; guard 100k+ scale explicitly; do not create sidecar/tag behavior merely because TagSpaces uses it | W0-B/W0-E; W1-08 Thumbnail; W2 List/Grid/Inspector |
| **QLMarkdown** | Real macOS Quick Look extension for rich Markdown | Separate standalone app/settings from system Quick Look extension; compile-time file-type/UTType registration; sandbox/security awareness; formatted-preview provider can be distinct from source-code provider | Do not treat Quick Look extension as the Zen app UI; do not execute embedded code/JS by default | W0-D Provider/Host split; W3 Markdown provider; W4 macOS Quick Look host |
| **SourceCodeSyntaxHighlight** | macOS source-code Quick Look extension | Native extension boundaries, format/UTType ownership conflicts, source-format specialization | Do not assume third-party Quick Look extensions can claim every type; do not merge Markdown/source-code semantics into one provider just for convenience | W0-D capability/host rules; W3 code provider; W4 macOS integration |
| **SpacePeek** | Native folder Quick Look with on-demand size/count/largest-item/tree analytics | Folder preview can be useful without durable indexing; on-demand local scan; progressive overview + contents; project/Git hints as enrichment, not core truth | Do not scan entire libraries merely for Preview; do not block Preview shell on exact recursive analytics; no implicit indexing authority | W0-D FolderSummary; W0-F folder 1k/10k/100k gates; W3 Folder provider |
| **Lightweight “super quick preview” utilities** | Validate that users value instant preview and longer text/code viewing without launching a heavy app | Space-triggered, read-only, low-friction preview; custom text rendering where native Quick Look is weak | Do not grow Zen into a general document editor or app shelf; keep Preview capability bounded | Product north star; W3 UX |

## Official source index

Primary project sources used for verification:

- Spacedrive: https://github.com/spacedriveapp/spacedrive
- Files: https://github.com/files-community/Files
- Microsoft PowerToys / Peek: https://github.com/microsoft/PowerToys
- QuickLook for Windows: https://github.com/QL-Win/QuickLook
- TagSpaces: https://github.com/tagspaces/tagspaces
- QLMarkdown: https://github.com/sbarex/QLMarkdown
- SourceCodeSyntaxHighlight: https://github.com/sbarex/SourceCodeSyntaxHighlight
- SpacePeek App Store listing: https://apps.apple.com/us/app/spacepeek/id6777129953?mt=12

## Licensing / clean-room note

Research does not authorize code copying.

In particular:

- QuickLook for Windows is GPL-3.0;
- QLMarkdown is GPL-3.0;
- TagSpaces main application is AGPL-3.0;
- other repositories have their own licenses and dependency obligations.

Zen may adopt publicly observable architecture/UX ideas and independently implement compatible concepts, but implementation must follow Zen's own contracts and applicable license rules. When in doubt, study behavior/contracts rather than porting source.