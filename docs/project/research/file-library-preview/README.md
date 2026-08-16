# File Library 2.0 / Preview Platform — Reference Research

Status: reconstructed historical research synthesis and evidence index for the File Library 2.0 / Preview Platform program

This directory preserves the external-project research rationale that informed Zen Canvas W0–W5 planning. It is **evidence and rationale**, not a second current roadmap or implementation authority.

## Provenance and reconstruction limits

The exact contemporaneous W-1 working notes and exact upstream source revisions used during the original research sessions were **not preserved** in the repository.

This evidence layer was reconstructed on 2026-08-17 from surviving Zen conclusions, reviewed W0/W1 specifications and other retained project context, then re-verified against official upstream sources. Therefore:

- these files are not verbatim original research transcripts;
- the Round 1–4 organization is a normalized reconstruction of how the conclusions converged, not a guarantee of the exact original chat/session boundaries or ordering;
- current upstream facts are tied to the audit snapshots in [`SOURCE_SNAPSHOTS.md`](SOURCE_SNAPSHOTS.md);
- a later reviewed Zen specification remains the implementation contract if wording here differs;
- research can explain **why** a decision exists, but cannot authorize a new implementation scope by itself.

Read the long-horizon direction first:

- [`../../MASTER_DEVELOPMENT_PLAN.md`](../../MASTER_DEVELOPMENT_PLAN.md)

Then use this directory to answer questions such as:

- Why does Zen separate `Entry` / `Location` / path identity?
- Why are Library and Browse separate authorities inside one workspace?
- Why is Preview split into Core / Provider / Representation / Host?
- Why does Windows Quick Preview not equal an Explorer Preview Handler?
- Why is Thumbnail shared infrastructure rather than a Grid-only concern?
- Why are watcher notifications hints rather than row-level truth?
- Why does Zen refuse implicit cloud hydration?
- Why do File Library/Preview contracts preserve the existing filesystem mutation/recovery authority?
- Why are third-party Preview plugins, arbitrary unmanaged recursive search and ephemeral disk snapshots deferred?

## Evidence model

Each note separates, as far as the surviving evidence allows:

1. **Official-source facts** — what the external project currently documents or implements at the pinned re-verification snapshot.
2. **Zen observations / reconstructed historical observations** — what Zen learned or retained from the earlier research; exact original source revision may be unavailable.
3. **Adopt / adapt / reject decisions** — the explicit design response for Zen.
4. **Downstream influence** — which Zen specification, Track or Wave inherited the conclusion.

External repositories are references, not Zen authorities. Their code, licenses, architecture and UX are not copied wholesale.

## Reference set

- [`REFERENCE_PROJECTS.md`](REFERENCE_PROJECTS.md) — comparison matrix and source/license index.
- [`SOURCE_SNAPSHOTS.md`](SOURCE_SNAPSHOTS.md) — exact 2026-08-17 re-verification revisions and provenance limits.
- [`01-SPACEDRIVE.md`](01-SPACEDRIVE.md) — object/location identity, cross-platform file-library architecture.
- [`02-FILES.md`](02-FILES.md) — Windows/Explorer familiarity, navigation and presentation-state lessons.
- [`03-POWERTOYS-PEEK.md`](03-POWERTOYS-PEEK.md) — Windows quick-preview lifecycle and cleanup.
- [`04-QUICKLOOK-WINDOWS.md`](04-QUICKLOOK-WINDOWS.md) — provider/plugin registry and Space-preview interaction model.
- [`05-TAGSPACES.md`](05-TAGSPACES.md) — offline-first organization, perspectives/viewers and thumbnail infrastructure.
- [`06-MACOS-QUICKLOOK-EXTENSIONS.md`](06-MACOS-QUICKLOOK-EXTENSIONS.md) — QLMarkdown / SourceCodeSyntaxHighlight and native Quick Look extension boundaries.
- [`07-SPACEPEEK-QUICK-PREVIEW-UTILITIES.md`](07-SPACEPEEK-QUICK-PREVIEW-UTILITIES.md) — folder Quick Look, progressive analytics and lightweight commercial/native utilities.
- [`08-RESEARCH-ROUNDS-SYNTHESIS.md`](08-RESEARCH-ROUNDS-SYNTHESIS.md) — reconstructed Round 1–4 conclusion history and final W0/W1 implications.
- [`09-ADJACENT-SAFETY-RESEARCH.md`](09-ADJACENT-SAFETY-RESEARCH.md) — boundary note connecting identity/path research to the pre-existing mutation-correctness safety authority without duplicating that remediation program.

## Source-date rule

The original research rounds occurred before W0 implementation work. Some external projects have continued evolving since then. The pinned 2026-08-17 snapshots record the state used to audit/re-verify this reconstructed evidence layer; they are **not** retroactive claims about the exact revisions used during the original W-1 research.

When a later Wave relies on a capability that may have materially changed, re-verify the upstream source and record a new dated snapshot before implementation. Do not silently rewrite historical conclusions as though a newer upstream behavior were known during the original research.