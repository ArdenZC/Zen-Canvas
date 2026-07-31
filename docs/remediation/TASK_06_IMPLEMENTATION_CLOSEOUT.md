# Task 06 Implementation Closeout

## 1. Delivery state

- Baseline HEAD: `6b142376f174e2187fffde79d945a60a47b00ac7`.
- Implementation branch: `remediation/06-organization-plan`.
- Code and test evidence HEAD before this closeout: `467118a0e63097f3da4077def34a1cba3e18482f`.
- Final delivery HEAD: the head of the single Draft PR; it is reported in the PR and final delivery because a commit cannot truthfully contain its own hash.
- Schema: `31 → 32`.
- This document records the historical Task 06 closeout before PR #40 was merged. PR #40 later merged Task 06 at `29e85c099c5ee921ad7d4237c780dc47126e0fa3`; the accepted seven-item handoff is closed by Task 07 on `remediation/07-rule-proposal`.

No dependency, `package-lock.json`, `Cargo.lock`, release/version/tag, `files` table, `files.id`, operation/cleanup journal schema, Managed AI schema/provider/worker, Rule AST, or content-extraction change was made.

## 2. Task 05 accepted handoff closure

| Accepted finding | Task 06 closure |
|---|---|
| Vault query loop | Canonical store query, one-way no-argument first-page load, identical-request dedupe, epoch latest-wins, and mounted StrictMode invoke-count tests. |
| Cursor integrity | Live anchor membership plus complete sort-tuple, direction, query fingerprint, and revision revalidation; cursor counts are never authoritative. |
| 100k explicit selection | Request-local SQLite TEMP ID set, 500-ID insertion chunks, independent exclusions, exact 100,000 cap, and 0/1/128/129/999/32766/99999/100000/100001 tests. |
| Snapshot expired | Existing rows remain visible, a nonblocking banner is shown, explicit selection remains, and stale all-matching selection is invalidated. |
| Tag UI | Create, rename, fixed color, usage-aware delete confirmation, assign/remove, loading/error/focus and revision-conflict reload UI. |
| Saved View UI | Create, open, rename, update query, delete, reorder, invalid-reference display, loading/error/focus and revision-conflict reload UI. |
| DTO summary | Bounded active-finding detail plus selection common directory, common tags, missing/excluded and partial-count facts. |
| Revision CAS | Mandatory monotonic `revision` columns and same-second stale-write rejection for tags and Saved Views. |
| Deferred exact count | Complex large queries return a bounded truthful first page with `deferred` count state and token; exact count resolves separately with latest-request ownership and no estimate. |

Virtual-list ARIA ownership is restricted to mounted rows as part of the same handoff.

## 3. Reference and license boundary

- Reference: `hyperfield/ai-file-sorter`.
- Fixed SHA: `cd9a024219b9434fb0a1df6b272f7145d9c67b28`.
- License: GNU AGPL-3.0.
- Conceptually borrowed: review before mutation, explicit From/To preview, per-item accept/keep/edit, safe batch, continue later, and visible conflicts.
- Rejected: source code, Qt models/dialogs/roles/columns, DTO/schema structure, CSS/UI, undo implementation, plugin/model runtime, content analysis, and path-authoritative mutation.

The implementation is independent and preserves Zen Canvas ownership boundaries.

## 4. Schema 32 and rollback

Schema 32 adds only:

- `organization_plans`;
- `organization_plan_items`;
- monotonic `revision` on `user_tags`;
- monotonic `revision` on `library_saved_views`;
- evidence-backed plan/item indexes.

Migration runs inside the existing immediate transaction, sets `user_version = 32` last, preserves every `files.id`, retains the future-schema guard, and rolls back atomically on a conflicting schema object. It does not alter `files` or any operation, cleanup, AI, analysis, finding, rule, or global-index table.

## 5. Durable plan and item ledger

Plan source accepts only authoritative File Library V2 `explicit` or `all_matching` selection. Materialization:

- resolves the selection in SQLite;
- rejects missing or mismatched source facts;
- caps at 10,000 items before publication;
- orders deterministically;
- stages `building → ready` atomically;
- records source revision/fingerprint and per-item metadata/proposal snapshots.

Plans and items use monotonic revision CAS. Plans expose durable lifecycle, execution ownership and failure projection. Items expose decision, validity, proposal fingerprint, preview mapping, execution mapping and operation-log mapping.

## 6. Proposal, decision and refresh

The backend derives proposal kind, target directory, target name and target path from current indexed classification and the existing authoritative preview. Cleanup/delete/review candidates are blocked and never enter Organization Plan execution.

The renderer may submit only plan/item IDs, expected revisions, decisions and an edited filename. Filename editing reuses backend extension-preservation, safe-name, reserved-name, collision, parent and platform/path policy. Batch decisions cap at 10,000, use one transaction and bump the plan revision once. “Accept Safe” is revalidated server-side for ready state, Normal risk, confidence, confirmation, cross-volume, live collision, parent, blocking reason and preview presence.

Refresh resolves the current file row and authoritative preview without AI or filesystem mutation. Missing/changed proposals become stale or needs-review; accepted/edited decisions survive only when the proposal fingerprint is unchanged.

## 7. Managed AI adapter

Plan analysis maps plan item file IDs to active managed entries and calls the existing durable Managed AI enqueue owner. The existing managed scope, provider policy, queue, fingerprint, correction gate, cancellation and worker remain authoritative. AI is metadata-only and can update classification inputs; it never accepts, edits, refreshes, executes, trashes or deletes a plan item.

## 8. Authoritative dry run and execution

Dry run accepts only plan ID, expected plan revision, accepted IDs or `allAccepted`. It live-revalidates indexed source metadata, source health, target collision, parent creation, cross-volume risk, preview mapping and item validity, then returns bounded From/To facts and a fingerprint bound to the plan revision, item revisions, proposal fingerprints, decisions and live facts.

Execution requires explicit confirmation and the exact dry-run fingerprint. It:

1. re-runs the dry run;
2. caps one execution batch at 1,000;
3. claims plan/items with caller-owned execution and operation batch IDs under CAS;
4. converts only backend-owned preview IDs and file IDs to the existing `OperationSelection`;
5. calls the existing preview resolver, identity/source-claim checks and operation journal executor;
6. projects journal log IDs/statuses back into the plan ledger.

No second executor, mutation service, undo system or journal exists. Delete, cleanup and `move_to_trash` are absent from the plan command surface.

## 9. Crash, restart and retention

Startup recovery inspects executing plans and the existing operation logs. Journaled outcomes are projected into item state; unjournaled dispatch failures release the lease without replay; ambiguous mapping becomes stale/manual review. Recovery never automatically repeats a filesystem operation.

Terminal plan retention is 30 days, keeps at least the newest 100 terminal plans, prunes at most 20 per pass, relies on item cascade only, and never deletes operation/cleanup journal rows.

## 10. UI, store and accessibility

The Organize workspace hydrates durable plans/items from the backend and supports create/list/continue, virtual keyset review, inspector, accept/keep/edit/clear, server-validated safe batch, Managed AI request, refresh, dry run, explicit confirmation, execution result/history and keyboard interaction. The AppShell and Rules views no longer treat the legacy in-memory organize decision store as production truth.

The renderer never materializes 10,000 items at once and never submits an authoritative target path or operation kind.

## 11. Permissions and browser mock

All File Library exact-count and Organization Plan commands are registered consistently in Rust, Tauri build permissions, main-window capability, TypeScript API and the command permission matrix. The Search window receives none of the plan, AI or execution commands.

The browser mock provides an in-memory review flow with revision checks and safe-batch checks. It explicitly rejects native execution with `browser_mock_native_execution_unavailable`; it does not claim durable native persistence or filesystem mutation.

## 12. Test, query-plan and performance evidence

Focused evidence before final gates:

- TypeScript typecheck passed.
- Task 05/06 focused frontend contracts: 4 files / 14 tests passed.
- Schema 31→32 success and conflict rollback: 2 tests passed.
- Safe-batch repository revalidation passed.
- Rust test targets compile in debug and release.
- Task 06 release benchmark passed for 100, 1,000 and 10,000 items.

Measured release benchmark on the Windows implementation host:

| Case | Result |
|---|---:|
| 1k create | 10.2 ms |
| 10k create | 114.3 ms |
| first page worst observed | 0.6 ms |
| 10k batch decision | 99.5 ms |
| 10k refresh | 450.7 ms |
| 1k dry run | 105.2 ms |
| 1k execution preparation | 117.8 ms |

The benchmark also covers deep keyset traversal, WAL concurrent reading, execution lease preparation/failure release and terminal retention pruning. File Library performance gates retain EXPLAIN QUERY PLAN checks, 100k explicit selection, 1M deferred first-page timing and separate exact-count recording. Index write amplification is limited to the two new small ledgers; `files` receives no new Task 06 index.

The final gate record is completed in the Draft PR after `verify:frontend`, `verify:rust`, `verify:security`, remediation, performance, build/package, `git diff --check`, lockfile proof and GitHub Windows/macOS jobs finish. Local evidence is never substituted for unavailable macOS/DMG evidence.

## 13. Known risks and stop condition

- Filesystem and platform races can still occur after dry run; execution therefore revalidates through the existing authoritative operation path and fails closed.
- A plan requiring more than 1,000 executable items needs explicit repeated dry-run/confirmation batches.
- Managed AI completion does not silently refresh or preserve approval; the user must refresh and review again.
- Existing allowed Rust dependency advisories remain separately inventoried; Task 06 adds no dependencies.

At the time of this historical closeout Task 06 stopped at one Draft PR for human code-level review. The current state is recorded below; Task 08 remains unstarted.

## 14. Task 07 handoff closure

The complete Task 07 implementation closes every accepted Task 06 handoff item on the single branch `remediation/07-rule-proposal`:

| Accepted handoff | Task 07 evidence |
|---|---|
| Dry-run/execution equivalence | Organization refresh, dry-run and execution rebuild the same live authoritative facts and dispatch the exact canonical preview. |
| Managed root health | Scope/root health, watcher recovery and watcher revision are revalidated at refresh, dry-run and execution; stale states fail closed. |
| `needs_review` approval | Backend review-state projection maps `needs_review` to an explicit reviewed path while blocked/unsupported states remain non-executable. |
| Crash projection | Finalization and restart recovery share terminal projection; all journal-success rows project to `completed`, with fault-injection regression coverage. |
| Retention union | Age UNION count overflow, child-first ordering, deduplication and per-pass caps are tested. |
| Plan summary | Summary counts are authoritative backend aggregates, independent of the first page size. |
| Package evidence | Local package and remote CI package jobs are recorded separately; skipped jobs are never described as success, with real Windows NSIS and macOS unsigned-DMG evidence required in the Task 07 Draft PR. |

Task 07 does not alter the operation/cleanup journals, weaken Safe Trash/Restore, or begin Task 08.
