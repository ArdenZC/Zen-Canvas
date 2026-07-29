# Task 05 Implementation Closeout

## 1. Delivery state

- Baseline HEAD before Task 05: `409e6bdca3ed4e2210462f6ae4d0b5b105b64eef`.
- Final HEAD: recorded in the delivery commit after this closeout is committed.
- Implementation branch: `remediation/05-file-library`.
- Draft PR title: `feat: rebuild file library query tags and saved views`.
- This is one complete File Library module. It is not split into 05A/05B/05C.
- Schema: `30 → 31`.
- No dependency, package lockfile, Cargo lockfile, release/version/tag, journal, Managed AI, Global Index, or `files.id` migration was added.
- Task 06 and all later modules were not started.

The taskbook was treated as the implementation contract. It was not rewritten.

## 2. Task 04 accepted-debt handoff

The four Task 04 accepted items were closed before the File Library implementation was exercised:

1. degraded/permission-required Global Search sources remain `partial`/`pending`, never `complete`;
2. ready-ACK navigation revalidates the original session/revision and cannot hide a newer session;
3. extension tiers use durable entry-ID tie breaking and punctuation fallback preserves query semantics;
4. mounted CommandModal IME interaction suppresses intermediate backend queries and submits the committed value once.

The retained implementation/evidence is in `src-tauri/src/global_index/**`, `src-tauri/src/app_control.rs`, `src/components/CommandModal.tsx`, `src/components/spotlight/spotlightComposition.ts`, `src/utils/searchNavigation.ts`, and `tests/searchSpotlight.test.ts` plus the focused Rust global-index/lifecycle tests. Task 05 did not create a second Search authority or alter those contracts.

## 3. Reference and license boundary

- Reference: `tagspaces/tagspaces` at fixed SHA `7ec3a2e8632b8bf5db685436e6d2d8805977a880`.
- License: repository `LICENSE.txt`, GNU AGPL-3.0.
- Borrowed only: location-aware scope presentation, tag AND/OR/NOT concepts, named saved-query concepts, on-demand inspector, explicit selection, and separate user metadata.
- Refused: TagSpaces source, manifest, component hierarchy, directory structure, CSS, localStorage truth, filename/sidecar tags, file-content preview, and implementation skeleton.

## 4. Schema 31, migration, rollback

`src-tauri/src/db/schema.rs` keeps `CURRENT_SCHEMA_VERSION = 31` and adds only:

- `user_tags`;
- `file_user_tags` with `file_id REFERENCES files(id) ON UPDATE CASCADE ON DELETE CASCADE`;
- `library_saved_views` with `query_spec_version = 2`;
- singleton `library_query_state` revision clock;
- five evidence-backed File Library sort indexes and the tag/saved-view indexes.

Migration from schema 30 runs inside the existing `BEGIN IMMEDIATE` migration transaction and sets `user_version = 31` last. Any table/index/seed failure rolls back and leaves `user_version = 30`; no `files` column or row rewrite is performed. Current-schema startup re-runs the idempotent ensure path. Schema 32 is rejected by the existing future-schema guard.

Focused coverage includes a real schema-30 fixture, atomic malformed-table rollback, preserved `files.id`, foreign-key cascade, empty new metadata tables, future-schema rejection, 100k migration, 1M migration, and WAL readers.

## 5. QuerySpec V2 and canonical form

`src-tauri/src/db/queries/library.rs` is the sole File Library V2 repository. The backend owns:

- strict `FileQueryRequestV2`/`FileQuerySpecV2` DTO validation;
- durable scope variants `all_enabled_roots`, `roots { scanRootIds }`, and `current_scan { scanSessionId }`;
- trim/empty normalization, stable sorted/deduplicated enum and ID arrays, range validation, fixed enum domains, bounded text/array lengths, and relevance/text compatibility;
- canonical JSON and BLAKE3 fingerprint generation;
- injection-safe reuse of the managed `files_fts` query builder;
- no renderer path authority and no `global_entries` join.

The renderer carries the returned fingerprint but cannot declare it authoritative. Saved Views store only this canonical typed query JSON; they do not store SQL, cursor, selection, revision, or arbitrary filesystem paths.

## 6. Snapshot, cursor, and revision owner

`library_query_state.revision` is the File Library-only consistency clock. `bump_library_query_revision_in_transaction(tx)` is the single owner and bumps at most once per business transaction. Audited production paths are:

- `db/queries/files.rs`: insert/restore, stale marking, path/id upsert, and removal;
- `db/queries/scan.rs`: scanner batch persistence, watcher mutation, stale/reconciliation changes;
- `db/queries/dedupe.rs`: active duplicate publication/invalidation and query-visible fingerprint changes;
- `db/classification/engine.rs`: rule classification batch;
- `ai/classification.rs`: AI classification batch;
- `db/learning.rs`: confirmation/correction classification writes;
- `library.rs`: user-tag assign/remove/create/rename/delete.

Saved View writes deliberately do not bump the file-query revision. Failed transactions roll back both their data and any attempted revision bump.

The response reads revision, scope health, exact count, and rows in one short SQLite read transaction. Subsequent pages use a backend-issued opaque hex/JSON cursor with contract version, fingerprint, revision, sort kind/direction, complete tuple, and durable file ID. V2 never uses `OFFSET`, materializes a million-item snapshot, or holds a transaction across IPC. Tampering, query mismatch, invalid numeric tuple, and stale revision fail closed; stale cursors return `snapshot_expired` without mixing old and new pages.

## 7. DTO separation

- `FileLibrarySummaryDto`: bounded list metadata, display directory, durable ID, sort fields, classification summary, duplicate/review/stale flags, and a fixed tag preview/count. It omits content hash, full rule evidence, AI trace, operation journal, and file content.
- `FileLibraryDetailDto`: ID-only on-demand metadata/path, root health, all user tags, classification provenance, duplicate group summary, stale state, and safe actions. It never reads content.
- `FileLibrarySelectionSummaryDto`: backend count, size, type counts, excluded/missing counts, fingerprint, and revision.

Inspector detail and reveal are ID-only. Detail requests use latest-request-wins state, and selection summary is never inferred by walking loaded renderer rows.

## 8. Selection contract

`LibrarySelectionV1` supports explicit IDs and `all_matching { canonical query, fingerprint, revision, exclusions }`. Query changes clear selection; snapshot expiry rejects all-matching selection; exclusions are normalized and bounded. Backend selection resolution is authoritative and fail-closed for missing/stale IDs, invalid roots, missing tags, and degraded scopes.

The only new bulk mutation is atomic user-tag metadata mutation. The backend validates the main-window boundary, snapshot/fingerprint, target count, 100,000 safety cap, and tag IDs before one set-based/chunk-safe transaction, then bumps the revision once and returns applied/already-present/missing/excluded counts. Selection cannot move, delete, rename, classify, execute a suggestion, or bypass operation/journal/Safe Trash boundaries.

## 9. User tags

`user_tags` and `file_user_tags` are independent metadata. Rust validates names, normalization/case collisions, control characters, reserved prefixes, fixed color tokens, expected timestamps, and usage-confirmed deletion. Add/remove is idempotent and works for explicit and all-matching selections. Tag filters support all/any/none and reference IDs only.

Tag operations do not modify path, filename, Purpose, Lifecycle, Risk, AI classification, rule state, sidecars, or files. `ON UPDATE CASCADE` preserves tags when an existing operation/restore path updates a `files.id`.

## 10. Saved Views

Saved View create/update/delete/list uses durable `library_saved_views`, expected `updatedAt`, canonical QuerySpec V2 JSON, stable position ordering, and no query-revision bump. Open creates a new query snapshot. Missing/disabled/degraded roots and deleted tags are projected as `invalidReferences` and never silently broaden the result. Browser mock state is explicitly in-memory and native reveal/persistence is rejected rather than faked.

## 11. Scope and root health

Rust resolves root/session IDs through `scan_roots`/`scan_session_roots` and authoritative normalized paths. Only `source_kind = 'file_library'` roots participate. Missing, disabled, degraded, reconciliation-required, and unavailable roots are projected as invalid/partial health; available rows are never replaced by all-root fallback. Current-scan sessions that cannot resolve fail with a stable error. Selection and mutation refuse non-healthy scopes.

## 12. UI/store architecture

`useFileLibraryV2Store.ts` separates query, result/cursor, selection, inspector, tag catalog/mutation, and Saved View state. `VaultView` uses server-authoritative V2 filters/sorts, next-cursor paging, two-stage selection messaging, snapshot-expired refresh, backend multi-selection summary, ID-only detail/reveal, and metadata-only preview. It contains no `collectLibraryPages`, renderer full-collection truth workaround, renderer filtering/sorting authority, or legacy `getPagedFiles` path.

The existing virtual list and keyboard/accessibility boundaries remain in place; Task 05 adds V2 contract and interaction coverage without adding a list/state dependency.

## 13. Commands, permissions, and browser mock

The 13 File Library commands are registered in `build.rs`/`main.rs`, capability JSON, Rust command guards, TypeScript API, and browser mock. Query, detail, reveal, tag, and Saved View commands require the main File Library window; Search window permissions do not include the library mutation surface. Reveal accepts only `fileId` and backend-resolves/revalidates the live path.

`docs/security/TAURI_COMMAND_PERMISSION_MATRIX.md` is synchronized. Static permission tests reject truncated command names, generic invoke/SQL/shell expansion, arbitrary path authority, and Search-window access.

## 14. Test and performance evidence

Focused Task 05 evidence:

| Area | Result |
|---|---|
| Frontend/typecheck | pass; `npm run typecheck`; full suite 74 files / 517 tests |
| Query V2/UI/browser mock | pass; `tests/fileLibraryV2.test.ts` plus adapted Vault/architecture/permission tests |
| Rust Query V2 | pass; 8 library tests including cursor, relevance, scope, failed transaction, selection cap, tags, Saved Views, and cascade |
| Remediation | pass; 13/13 |
| Migration/rollback | pass; schema 30→31, rollback, future-schema, 100k and 1M fixtures |
| 100k File Library | pass; common p95 11.258ms, complex p95 92.275ms, detail 0.170ms, selection summary 52.617ms, bulk tag 334.190ms |
| 1M File Library | pass; common p95 104.940ms, complex exact p95 922.504ms, detail 0.134ms, deep keyset 20 pages / 1.842s, selection summary 518.409ms, bulk tag 496.247ms |
| Schema 30→31 migration | pass; 100k 458.586ms, 1M 4,954.826ms, WAL reader row counts preserved |
| Query plans | pass; modified/created/name/size/confidence indexes, tag `(tag_id,file_id)`, materialized FTS plan |
| Existing Task 02–04 performance | pass through `npm run test:performance` |

The 1M 150ms target is applied to common pages as defined by the taskbook; complex exact counts remain exact and are reported separately rather than estimated or hidden.

## 15. Security, build, platform, and package evidence

The required local `verify:frontend` and `verify:rust` gates pass on the final implementation worktree; `verify:security` is rerun before delivery. Local Windows release build produces the NSIS installer. GitHub Windows/macOS Rust quality and release-compile evidence is recorded after the Draft PR workflow completes; Draft-only package jobs are reported as skipped when the workflow condition requires a non-Draft PR. Unsigned DMG evidence is recorded when the macOS package job is available; otherwise the platform limitation is stated explicitly.

## 16. Rollback and known risks

- Source rollback is a revert of the Task 05 implementation commits.
- Database rollback is the transaction-safe schema-30 fixture path; no production downgrade migration or `files` backfill is required.
- Exact counts on complex 1M filters are slower than common pages but remain truthful; no estimate/fail-open substitution was introduced.
- Existing non-desktop cfg dead-code warnings and pre-existing RustSec advisories remain outside this task’s dependency scope.
- Temporary ignored-benchmark SQLite fixtures are outside the repository and are not staged.

## 17. Delivery record

- Commit list and final HEAD are filled after the implementation/doc commits are created.
- Draft PR remains Draft and is not auto-merged.
- Human code-level acceptance is required before any merge or Task 06 work.
