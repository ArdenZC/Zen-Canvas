# Task 05 Implementation Closeout

## 1. Delivery state

- Baseline HEAD: `409e6bdca3ed4e2210462f6ae4d0b5b105b64eef`.
- Implementation branch: `remediation/05-file-library`.
- Implementation final HEAD: `2a9ec7f676a6863ef4db615fcde3383fca2bacc4`.
- PR: `#38 feat: rebuild file library query tags and saved views`.
- Squash merge: `5468a17790165a149c462a17b64d011750b45410`.
- Schema: `30 → 31`.
- Task 05 was one complete File Library module and was not split into 05A/05B/05C.
- No dependency, package lockfile, Cargo lockfile, release/version/tag, journal, Managed AI, Global Index or `files.id` migration was added.

Task 05 is now the accepted production baseline for Task 06. The human review findings listed in section 15 were deliberately accepted into Task 06 rather than packaged as a standalone cleanup task.

---

## 2. Task 04 accepted-debt handoff

Task 05 closed the four Task 04 accepted items:

1. degraded/permission-required Global Search sources remain partial/pending, never complete;
2. ready-ACK navigation revalidates the original session/revision and cannot hide a newer session;
3. extension tiers use durable entry-ID tie breaking and punctuation fallback preserves query semantics;
4. mounted CommandModal IME interaction suppresses intermediate backend queries and submits the committed value once.

These remain continuous regression contracts.

---

## 3. Reference and license boundary

- Reference: `tagspaces/tagspaces`.
- Fixed SHA: `7ec3a2e8632b8bf5db685436e6d2d8805977a880`.
- License: GNU AGPL-3.0.
- Borrowed only: location-aware scope, user tag vocabulary, tag AND/OR/NOT, named saved-query concepts, on-demand Inspector and explicit selection.
- Refused: source, component/context structure, query schema, CSS/UI, localStorage native truth, filename/sidecar tags and content preview.

---

## 4. Schema 31

Task 05 added only small side tables and evidence-backed indexes:

- `user_tags`;
- `file_user_tags` with `ON UPDATE CASCADE` and `ON DELETE CASCADE`;
- `library_saved_views` with QuerySpec V2 only;
- singleton `library_query_state` revision.

Migration used the existing transactional migration path, set `user_version = 31` last, preserved `files.id`, did not rewrite `files`, and retained the future-schema guard.

---

## 5. FileQuerySpec V2

`src-tauri/src/db/queries/library.rs` introduced:

- strict versioned request/query DTOs;
- durable root/session scopes;
- SQLite-authoritative text/filter/sort;
- canonical JSON and BLAKE3 fingerprint;
- managed `files_fts` only, with no Global Index join;
- File Library-specific revision snapshot;
- keyset cursor;
- exact count and scope-health projection;
- `snapshot_expired` response.

The renderer no longer owns advanced filtering/sorting truth for Vault.

---

## 6. DTO separation

- `FileLibrarySummaryDto`: bounded list metadata and tag preview/count.
- `FileLibraryDetailDto`: ID-only metadata, root health, tags, classification and duplicate summary.
- `FileLibrarySelectionSummaryDto`: backend count/size/type/missing/excluded summary.

Inspector detail and reveal are ID-only and do not read file content.

---

## 7. Selection

`LibrarySelectionV1` supports:

```text
explicit { fileIds[] }
all_matching { canonical query, fingerprint, revision, exclusions[] }
```

Task 05 added truthful two-stage selection and restricted bulk mutation to user-tag metadata. Selection did not gain move/delete/rename/classify authority.

---

## 8. User tags

Task 05 added durable, normalized, fixed-color user tags and file-tag relations. Backend supports list/create/update/delete and explicit/all-matching assign/remove. Tags remain separate from Purpose/Lifecycle/Risk, filename, sidecar, rules and AI.

---

## 9. Saved Views

Task 05 added durable Saved Views storing only canonical QuerySpec V2. They do not store cursor, selection, SQL, script or arbitrary path. Missing roots/tags are exposed as invalid references, and opening a view creates a new query snapshot.

---

## 10. UI and stores

Task 05 introduced separate Zustand stores for query, result, selection, Inspector, tags and Saved Views, and migrated Vault to Query V2 with cursor paging, server filters/sorts, cross-page selection, ID-only detail/reveal and metadata-only preview.

The existing virtual list and accessibility model remained the rendering base.

---

## 11. Permissions and browser mock

The File Library commands were registered across Rust, Tauri capabilities, TypeScript API and browser mock. Commands require the main window; Search window does not receive tag/Saved View/bulk write permissions. Browser mock does not claim native filesystem reveal or durable native persistence.

---

## 12. Validation evidence

Implementation reported and CI confirmed:

- frontend/typecheck: 74 files / 517 tests;
- remediation: 13/13;
- Rust: 510 passed, 7 ignored, rustfmt and Clippy passed;
- npm audit: 0 vulnerabilities;
- cargo audit: exit 0 with existing allowed warnings;
-100k common/complex, 1M common/complex diagnostic, migration and WAL benchmarks;
- Windows/macOS Rust and release compile;
- GitHub run `30438985165` passed all applicable quality, performance and security jobs;
- NSIS/DMG package jobs were skipped under the Draft workflow condition; local NSIS evidence existed.

---

## 13. Known performance fact

Task 05 preserved exact counts. Common 1M pages met the interactive target, while complex exact counts were measured around sub-second to multi-second depending on environment. This was truthful but did not satisfy the original bounded-interactive requirement. Task 06 therefore freezes a deferred exact-count contract: no estimate, bounded first page, exact resolution on demand.

---

## 14. Merge record

PR #38 was marked ready only because GitHub does not merge Draft PRs, then squash merged by explicit human decision.

```text
Merge commit
5468a17790165a149c462a17b64d011750b45410
```

The merge does not assert that the accepted findings below were already fixed. It establishes the Task 05 code as the baseline from which Task 06 must close them.

---

## 15. Accepted handoff to Task 06

The following nine findings from human review `4806627795` are mandatory Task 06 first-group work and may not be deferred again:

1. `VaultView` query effect can repeatedly call `loadFirstPage(spec)` because query execution mutates the same spec state;
2. hex-encoded JSON cursor lacks authoritative live-anchor/tuple verification and can be validly edited;
3. 100,000 explicit selection eventually creates an unsafe giant SQL parameter set, while exclusions inherit an unintended 128-ID limit;
4. snapshot-expired state enters generic error UI, replaces current rows and does not correctly invalidate all-matching selection;
5. user tag UI lacks full rename/color/delete-confirm lifecycle, and Saved View UI lacks rename/update/position;
6. detail lacks active finding summary, and multi-selection lacks common directory/tag commonality;
7. optional second-resolution timestamp CAS can permit stale writes;
8. virtual-list `aria-activedescendant` can reference an unmounted option;
9. 1M complex exact count was treated as diagnostic instead of receiving a bounded truthful product contract.

Frozen Task 06 solutions:

- one-way query flow and mounted invoke-count tests;
- backend live anchor membership + complete tuple cursor validation;
- request-local SQLite TEMP selection set;
- nonblocking snapshot-expired banner and selection invalidation;
- complete tag/Saved View UI;
- bounded finding/common-directory/tag summaries;
- schema 32 monotonic revisions;
- mounted-row-only ARIA target;
- deferred exact count with no estimates.

---

## 16. Next stage

Task 06 is the complete AI organization preview module:

```text
Durable Organization Plan
+ human review
+ authoritative dry run
+ existing Managed AI adapter
+ existing operation journal execution
+ restart/result projection
```

Task 06 authority is defined only by:

```text
docs/remediation/TASK_06_DURABLE_ORGANIZATION_PLAN_AND_DRY_RUN.md
```

Task 07 and Task 08 remain forbidden until Task 06 is implemented, reviewed and merged.

---

## 17. Task 06 handoff closure

The nine accepted findings in section 15 were closed on `remediation/06-organization-plan` as the first implementation group of the complete Task 06 module. Evidence is recorded in `TASK_06_IMPLEMENTATION_CLOSEOUT.md`: mounted one-way Vault queries, authoritative cursor revalidation, request-local 100k selection sets, snapshot-expired row retention, complete tag/Saved View UI, completed detail/selection DTOs, schema 32 revision CAS, mounted-row ARIA ownership and deferred exact counts.

This update records implementation only. Task 06 remains in a Draft PR awaiting human code-level review and merge; Task 07 and Task 08 remain forbidden.
