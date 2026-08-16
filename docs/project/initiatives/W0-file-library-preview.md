# File Library 2.0 / Preview Platform — W0 Specification

Status: complete

Owner: Product and architecture review

Original research/start baseline: `master@37a3d03285c2f9d7f2b30ba1e18c6d640bc7f5d4`

BR0 reconciled baseline: `master@e09447dbf2da46e1b02e6da03bcb3345966f160b` (PR #63 merge)

Specification merge baseline: `master@c4f7f53782c2fd2b1a7ab077879c6a3fc8db11b3` (PR #64 squash merge)

W0 is closed. Production implementation is governed by the separately active
[`W1-file-library-foundation.md`](W1-file-library-foundation.md) initiative.

## Problem and research

File Library 2.0 and the Preview Platform required a coherent information
architecture for managed files and familiar filesystem browsing while preserving
existing query, identity, mutation, recovery and platform authorities.

The W-1 research input is persisted in
[`OPEN_SOURCE_SYNTHESIS.md`](../research/file-library-preview/OPEN_SOURCE_SYNTHESIS.md)
and covered Spacedrive, Files, PowerToys Peek, QuickLook for Windows, TagSpaces,
QLMarkdown / SourceCodeSyntaxHighlight and representative failure reports.

## Canonical merged specification

PR #64 merged the reviewed W0 set:

- [00 — Master Specification](../specs/file-library-preview/00-MASTER-SPEC.md)
- [01 — Product and Information Architecture](../specs/file-library-preview/01-PRODUCT-IA.md)
- [02 — Core Domain Contracts](../specs/file-library-preview/02-CORE-DOMAIN-CONTRACTS.md)
- [03 — Preview Architecture](../specs/file-library-preview/03-PREVIEW-ARCHITECTURE.md)
- [04 — Infrastructure Contracts](../specs/file-library-preview/04-INFRASTRUCTURE-CONTRACTS.md)
- [05 — Performance Budget and QA Matrix](../specs/file-library-preview/05-PERFORMANCE-QA.md)
- [06 — W1 Foundation Implementation Plan](../specs/file-library-preview/06-W1-IMPLEMENTATION-PLAN.md)

The final review preserved the product direction while tightening several
cross-contract boundaries:

- materialization/content availability is entry/source scoped rather than
  Location-wide;
- read eligibility remains an adaptor over existing authoritative byte-open
  semantics rather than a second read engine;
- Preview Host/Session exists before slow source/provider work and byte-reading
  providers use bounded opaque content access backed by authoritative open /
  revalidation rules;
- Ephemeral Browse pages/cursors are session/request/enumeration-generation
  bound so invalidation cannot stale-publish old pages;
- cross-process Browse recovery uses a non-authoritative locator/bookmark and
  never revives prior-process ephemeral refs;
- Scheduler interference gates require selected adapters for real existing heavy
  authorities while those authorities keep lifecycle ownership;
- Thumbnail byte generation depends on the Materialization/Read Gate and durable
  cache reuse requires stable backend-verified identity;
- arbitrary unmanaged recursive filesystem/global search remains out of W1/v1
  scope.

## Preserved authorities

The merged W0 specification keeps authoritative:

- File Library Query V2 / `LibrarySelectionV1`;
- Global Index;
- scan-root/watcher revisions and reconciliation;
- filesystem-safety identity/backend revalidation;
- existing platform/content byte-read eligibility and open/revalidation paths;
- Operation Preview / operation journal;
- Safe Trash / cleanup journal / Restore;
- merged macOS Apple Silicon and Windows platform safety/capability adapters.

W0 created no Query V3, second watcher, second content-read eligibility engine,
generic job database, schema migration or second mutation/recovery path.

## Validation evidence

PR #64 final head: `a52a81ec02129c517211a6a868d23d7e5d76af02`.

Final CI: run `31926495395`, conclusion `success`.

The final run classified the PR correctly and passed:

- project governance validation;
- documentation-only validation including documentation checks and
  `git diff --check`.

Production, native, performance and packaging jobs were correctly skipped for
the specification-only change. Real iCloud/File Provider/external/network
fixtures remain future implementation QA obligations and were not converted to
pass claims.

## Closeout

- W0 specification PR: #64 — merged.
- Merge SHA: `c4f7f53782c2fd2b1a7ab077879c6a3fc8db11b3`.
- W0 status: complete.
- W1 production authorization: separate active W1 Foundation initiative.
- Source branch cleanup remains a repository hygiene action after merge/content
  equivalence verification.
