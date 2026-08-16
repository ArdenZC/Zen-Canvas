# File Library 2.0 / Preview Platform — Reference Research

Status: historical research evidence for the File Library 2.0 / Preview Platform program

This directory preserves the external-project research that informed Zen Canvas W0–W5 planning. It is **evidence and rationale**, not a second current roadmap or implementation authority.

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
- Why are third-party Preview plugins, arbitrary unmanaged recursive search and ephemeral disk snapshots deferred?

## Evidence model

Each note separates:

1. **Official-source facts** — what the external project itself documents or implements.
2. **Zen observations** — what we learned from that project.
3. **Adopt / adapt / reject decisions** — the explicit design response for Zen.
4. **Downstream influence** — which Zen specification, Track or Wave inherited the conclusion.

External repositories are references, not Zen authorities. Their code, licenses, architecture and UX are not copied wholesale.

## Reference set

- [`REFERENCE_PROJECTS.md`](REFERENCE_PROJECTS.md) — comparison matrix and source index.
- [`01-SPACEDRIVE.md`](01-SPACEDRIVE.md) — object/location identity, cross-platform file-library architecture.
- [`02-FILES.md`](02-FILES.md) — Windows/Explorer familiarity, navigation and presentation-state lessons.
- [`03-POWERTOYS-PEEK.md`](03-POWERTOYS-PEEK.md) — Windows quick-preview lifecycle and cleanup.
- [`04-QUICKLOOK-WINDOWS.md`](04-QUICKLOOK-WINDOWS.md) — provider/plugin registry and Space-preview interaction model.
- [`05-TAGSPACES.md`](05-TAGSPACES.md) — offline-first organization, perspectives/viewers and thumbnail infrastructure.
- [`06-MACOS-QUICKLOOK-EXTENSIONS.md`](06-MACOS-QUICKLOOK-EXTENSIONS.md) — QLMarkdown / SourceCodeSyntaxHighlight and native Quick Look extension boundaries.
- [`07-SPACEPEEK-QUICK-PREVIEW-UTILITIES.md`](07-SPACEPEEK-QUICK-PREVIEW-UTILITIES.md) — folder Quick Look, progressive analytics and lightweight commercial/native utilities.
- [`08-RESEARCH-ROUNDS-SYNTHESIS.md`](08-RESEARCH-ROUNDS-SYNTHESIS.md) — Round 1–4 conclusion history and the final W0/W1 implications.

## Source-date note

The original research rounds occurred before W0 implementation work. Some external projects have continued evolving since then. These files preserve the design conclusions we actually used, while source links may point to the projects' current official repositories/docs.

When a later Wave relies on a capability that may have materially changed, re-verify the upstream source before implementation. Do not silently rewrite historical conclusions as though they were known during the original research.