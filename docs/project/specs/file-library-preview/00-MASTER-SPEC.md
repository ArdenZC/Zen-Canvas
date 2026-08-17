# Zen File Library 2.0 / Preview Platform — W0 Master Specification

Status: frozen canonical specification — merged through PR #64

BR0 baseline: `master@e09447dbf2da46e1b02e6da03bcb3345966f160b` (PR #63 merge)

## 1. Objective

File Library 2.0 evolves Zen's existing managed File Library into one workspace with two user-facing organization modes:

- **Library Mode** answers “what are my files?” using managed-library query semantics.
- **Browse Mode** answers “where are my files?” using familiar filesystem navigation without implicitly admitting locations into the managed library.

Quick Preview is a read-only representation/session platform shared conceptually across the Zen app and native system hosts. It remains strictly separate from Operation Preview and every mutation, journal, Safe Trash, cleanup and Restore authority.

## 2. Supported platforms

- macOS 13+ on Apple Silicon only (`aarch64-apple-darwin`) — first-class.
- Windows 11 x64 — first-class.
- Windows ARM64 — architecture-ready; not a v1 release commitment.
- Intel Mac, Universal binaries, Rosetta, Linux — not product targets.

## 3. Existing authorities that remain authoritative

W0 and all later Waves must preserve these authorities:

- File Library Query V2 — managed-library query authority.
- `LibrarySelectionV1` — managed-library selection authority.
- Global Index — system-wide search authority, separate from File Library Search.
- Scan roots, managed watcher state, watcher revisions and reconciliation — managed-location truth.
- Existing filesystem-safety identity and backend revalidation — mutation correctness authority.
- Existing platform/content byte-read eligibility and open/revalidation paths — content-access authority.
- Operation Preview, operation journal, Safe Trash, cleanup journal and Restore ledgers — filesystem mutation/recovery authority.
- Existing macOS and Windows filesystem safety/platform adapters.

W0 does not authorize Query V3, a second watcher, a second content-read eligibility engine, a generic new job database or a second mutation/recovery path.

## 4. Non-negotiable architecture rules

1. Workspace entry identity is not a raw path.
2. Physical verification identity is not the same as managed-library identity.
3. Library and Browse are two projections inside one File Library workspace, not separate top-level product modules.
4. Browse does not implicitly add a location to the managed library.
5. Managed watcher events are hints feeding authoritative reconciliation; they are not durable truth by themselves.
6. Quick Preview is read-only and cannot authorize filesystem mutation.
7. Preview Core and Preview Host are separate contracts; the Host/session exists before slow source/provider work so cancellation and shell-first UX are always available.
8. Thumbnail is shared infrastructure, not a Grid-only feature.
9. Background enrichment must never block the interactive shell; global scheduling must include selected adapters for existing heavy authorities rather than only new work.
10. Cloud/provider content must not be implicitly hydrated by listing, indexing, thumbnailing, analytics or preview. Materialization/content state is entry/source scoped, not a Location-wide claim.
11. A disconnected/offline location is not equivalent to mass deletion.
12. No UI convenience layer may create a new durable authority.
13. Session-scoped Browse refs/cursors never become cross-process authorization; restore uses a separate non-authoritative locator/bookmark that is re-resolved and revalidated.
14. Every byte consumer revalidates through the existing authoritative read/open boundary; previous eligibility or operation proofs are not durable byte-read permission.

## 5. PR #63 reconciliation

PR #63 strengthens, rather than invalidates, W0 assumptions:

- Generic File Provider paths are routing hints, not native provider item/domain identity.
- Provider identity must never be fabricated from pathname/POSIX metadata.
- Materialization remains explicit and consent-bound.
- Generic provider byte reads and mutation eligibility remain runtime/capability dependent.
- External/network/provider support must be represented in layered capability state rather than inferred from `cfg!(macOS)`.
- `BoundaryReadable`-style evidence is bounded evidence, not durable fully-local state.
- Any preview/materialization implementation must independently re-resolve and revalidate its source; an earlier operation or read-eligibility proof must not be treated as universal byte-read authority.

## 6. File Library 2.0 product model

```text
File Library
   |
   +-- Library Mode  -> managed/query organization
   |
   +-- Browse Mode   -> filesystem/path navigation
            |
            +-- macOS Finder-familiar presentation
            +-- Windows Explorer-familiar presentation

Shared workspace:
Navigation | Content | Context
                |
          List / Grid
                |
        Inspector / Preview
```

The product keeps one top-level File Library entry. Library/Browse are internal workspace modes; implementation modules/stores remain separated where their authorities differ.

## 7. Development Waves

- **W-1 Research** — complete.
- **W0 Specification** — this specification set; no production implementation.
- **W1 Foundation** — contracts, data sources, lifecycle, scheduling, materialization/read gate, thumbnail infrastructure and integration surface.
- **W2 Experience** — Library Mode, Browse Mode, List/Grid workspace and Context Panel.
- **W3 Preview Platform** — Quick Preview UI and rich providers.
- **W4 Native Integration** — macOS Quick Look and Windows native/system integration.
- **W5 Release Gate** — full performance, stability, security, accessibility and polish closeout.

## 8. v1 explicit non-goals

- AI Preview, RAG, OCR, Agent/MCP execution.
- File editing or format conversion inside Preview.
- Third-party Preview plugin SDK/marketplace.
- Finder/File Explorer full replacement.
- Arbitrary unmanaged recursive filesystem/global search engine.
- New distributed/multi-device filesystem architecture.
- Generic new persistent job runtime.
- Intel macOS support.
- Format-count competition (EPUB/PSD/3D/etc. are post-v1 candidates).

## 9. W0 closeout condition

W0 is complete only when the reviewed spec set is merged and current-truth records are updated. Production W1 work then requires a separately authorized W1 initiative bound to the final merged baseline.
