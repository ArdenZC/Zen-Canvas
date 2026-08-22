# W3-01 — Preview Core Consumer-Readiness

Status: **COMPLETE — independently reviewed and squash merged through PR #119**

Baseline: `master@e54c788db637e6c6140cf618dd3d7125ea1df8e3` (W3-00 activation)

Implementation branch: `feat/w3-01-preview-core-consumer-readiness`

Final reviewed head: `09be79b9415d55a7e0ef5271f465b557c1ee6d57`

Final reviewed tree: `6add03115a69fe226b5c040ee8bb23d66e373704`

Exact-head hosted CI: `32564728867` — `success`

Squash merge / runtime baseline:
`master@fb48696795e19aa5fabac5966d31665a6b95e81e`

## Goal

Make the existing W1 Preview Core safe and deterministic for the later W3
hosts and built-in provider Tracks. This Track owns consumer-readiness seams,
not a user-facing Quick Preview host or rich content providers.

## Authority invariants

- `PreviewSession` remains the sole Preview lifecycle, provider-selection and
  publication authority.
- Query V2 / `LibrarySelectionV1`, BrowseService, WorkspaceSession,
  MaterializationReadGate and WorkScheduler remain their existing authorities.
- Renderer and provider-facing contracts contain no filesystem paths, native
  handles or generic byte-read authority.
- Materialization remains explicit; W3-01 does not add hydration or a general
  download action.
- Preview asset bytes are bounded, opaque, process-local and bound to the
  current session/request/sourceVersion.
- Zen Floating and Pinned hosts are the only activated host kinds. Native W4
  hosts remain contract-only and fail closed.
- TD-015 remains open; legacy Preview/Vault compatibility is not retired here.

## Implemented scope

1. One production Provider Registry composition owner replaces per-start
   ad-hoc registry construction. The W3-01 rich-provider set intentionally
   remains empty.
2. Explicit backend-owned `zen_floating` and `zen_pinned` host capability
   matrices are established; W4 native hosts are not activated.
3. Source capability projection is derived from backend-known source/entry,
   read/materialization and availability facts rather than extension/path
   inference.
4. Rust/TypeScript representation and warning wire contracts are exhaustive and
   strict for Metadata, Text, SafeHTML, StructuredTree, Table, Image, Media,
   FolderSummary, ArchiveTree and NativeOpaque.
5. Preview-specific asset transport is bounded, opaque, sourceVersion-bound and
   revocable; no renderer source path or generic byte-read command exists.
6. Progressive publication is request/session/sourceVersion-bound, monotonic
   and stale/out-of-order/cancel/dispose-safe.
7. Asset lifecycle cleanup follows PreviewSession authority revocation. Asset
   publication re-validates authority while holding the asset registry mutex
   immediately before mutation, closing the post-check/pre-insert TOCTOU race.
8. Successful source switch cleans only the superseded request/sourceVersion
   tuple; a concurrently valid new request asset is preserved. Failed switch
   preserves the old request authority and exact asset tuple.
9. Progressive-publication responsibility is decomposed into a focused module
   without creating a second lifecycle/publication authority.
10. Frontend API/mock contracts are consumer-ready without adding W3-02 UI or
    rich renderers.

## Hard non-goals retained

- No Floating/Pinned Quick Preview UI, Space/Esc shortcuts or Context Panel
  integration.
- No Text/Markdown, JSON/YAML/XML, CSV/TSV, Image, Media, Folder or ZIP
  production provider.
- No Finder Quick Look extension, Windows Preview Handler or other W4 native
  integration.
- No schema, durable Preview job/session store, Query V3, second read gate,
  second scheduler, filesystem mutation/recovery authority or plugin SDK.
- No renderer raw path, generic byte-read command, implicit materialization or
  automatic cloud hydration.
- No broad Vault/legacy Preview cleanup and no closure of TD-015.

## Final validation

Local final-head validation:

```text
npm run typecheck                                  PASS
npm test                                           PASS — 1261 tests
npm run test:remediation                           PASS — 14 tests
npm run test:performance:architecture              PASS — 25 tests
npm run build:check                                PASS
npm run verify:rust                                PASS — 788 passed / 0 failed / 15 ignored
npm run verify:security                            PASS
npm run test:governance                            PASS
git diff --check                                   PASS
```

Deterministic lifecycle/publication evidence includes:

- cancel authority-before-cleanup;
- dispose authority-before-cleanup;
- Browse teardown authority-before-cleanup;
- source-switch stale publication rejection;
- failed-switch authority/asset preservation;
- post-first-`ensure_active` / pre-registry-lock TOCTOU closure;
- switch cleanup preserving a concurrently valid new-request asset;
- bounded asset registry returning to expected steady state.

No timing sleeps or random race scheduling are used for these acceptance tests.

Hosted exact-head CI `32564728867` succeeded on the final reviewed head. Windows
and macOS Rust quality, release compile, frontend, native Apple Silicon
performance and applicable Workspace Foundation performance all passed.

ADR-0004 evidence:

```text
head checkout      09be79b9415d55a7e0ef5271f465b557c1ee6d57
head tree          6add03115a69fe226b5c040ee8bb23d66e373704
integration        c32739c4acb5892384767d9ecef7cd93f81049be
integration tree   6add03115a69fe226b5c040ee8bb23d66e373704
tree_equivalent    true
head_validation_required false
validation lane    merge_integration
```

The earlier Windows Thumbnail lifecycle failure is classified `OBSERVED` timing
flake. Reviewer rerun succeeded and the final exact-head Windows CI did not
reproduce it; W3-01 did not alter unrelated Thumbnail semantics.

## Closeout verdict

**HARD PASS / MERGED.**

W3-01's consumer-readiness contracts are now the accepted baseline for later W3
hosts/providers. W3-02 may start from
`master@fb48696795e19aa5fabac5966d31665a6b95e81e` after this current-truth
closeout merges.

W3-02 is a separate user-facing host Track. W3-01 completion does not authorize
W3-03 pinned Preview, W3-04+ rich providers, W4 native system hosts or W5
release work.
