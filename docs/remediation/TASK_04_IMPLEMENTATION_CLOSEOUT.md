# Task 04 Implementation Closeout

## 1. Delivery state

- Current `origin/master` baseline: `d8d68f156bb43ddad22105f5656e2dc83eb4c397`.
- The implementation branch includes the baseline merge `d6232fe1a0e80314dabef91e06a0366b6837b52f`.
- Implementation branch: `remediation/04-global-shortcut-search`.
- First-round Task 04 delivery commits: `d898fd7` and `b853618af5dd502b1005754999417f59183643ed`.
- Second-round review remediation: `aec94d9`, `83b9afd`, and `e82ca49`.
- Draft PR: [#35](https://github.com/ArdenZC/Zen-Canvas/pull/35), `feat: harden global shortcut search and command surface`.
- The branch remains Draft and is waiting for the second human code-level acceptance. Merge is prohibited until that review completes.
- Database schema remains 30. No dependency, lockfile, schema, installer, or release change was made.
- Task 05 and all later tasks were not started.

The second-round review changes are limited to the five Task 04 blockers recorded in the PR conversation. The existing Global Index authority, Managed AI boundary, `files.id`, dedupe, operation/cleanup journal, Safe Trash, and restore contracts remain unchanged.

## 2. Task 03 and reference boundaries retained

The Task 03 exact physical-union work remains unchanged: active authoritative duplicate-group members resolve to physical subjects, keeper and hardlink aliases collapse deterministically, and Safe exact findings are unioned without double counting. The Task 03 implementation and its acceptance evidence were not reopened by this Task 04 review pass.

The Tolaria review remains design-only. The reviewed reference was `refactoringhq/tolaria` at `43e3b32322b1f1eb1d0c1fc156c2db340af79d90`, licensed AGPL-3.0. Only independent interaction principles were used; no source, manifest, command ID, component structure, CSS, directory layout, or implementation skeleton was copied.

## 3. Second-round blocker closure

### 3.1 Bounded layered ranking, dedupe, and pagination

`src-tauri/src/global_index/search.rs` now fills a single bounded result window in this order:

```text
exact normalized name
  -> name prefix
  -> exact extension
  -> extension prefix
  -> safe FTS Top-N or indexed punctuation-prefix fallback
```

Each layer is queried only while the earlier layers have not filled `offset + limit`. A layer receives at most `target + already_seen`, the final de-duplicated candidate window is capped at 4,096, and an offset at or beyond that cap fails closed with an empty page. Stable global-entry IDs remove cross-layer duplicates before the numeric cursor/offset is applied. The public cursor remains an explicit numeric offset, so pages are slices of the same deterministic de-duplicated stream rather than independent SQL pages.

Exact and prefix name tiers use the active-name partial index; extension tiers use the active-extension partial index; FTS is entered only for queries of at least three alphanumeric/whitespace characters and uses a quoted trigram match; punctuation-heavy queries use an indexed normalized-name prefix hint. Every tier has an explicit deterministic order, and extension row ties use the stable SQLite rowid tie key to avoid materializing the full extension population.

The former static all-tier CTE was removed. A query that is satisfied by an earlier tier does not execute the later FTS tier, which is the required bounded fast path. `src-tauri/src/global_index/tests.rs` now covers exact/prefix/extension precedence, FTS filling, cross-tier dedupe, repeated-query ordering, and offset pages with no duplication or drift. The 100k release benchmark also exercises exact, prefix, extension, and punctuation samples.

### 3.2 IME composition and committed query state

`src/components/CommandModal.tsx` keeps display text separate from `committedSearch`. `src/components/spotlight/spotlightComposition.ts` rejects composition updates, native `isComposing`, and key code 229 from backend/debounce submission. `compositionend` commits the final value once; keyboard activation and blur re-check the composition guard. Clearing or reopening the window resets both display and committed state.

`tests/searchSpotlight.test.ts` covers the `z -> zh -> zhong -> 中` sequence and asserts that only the final committed query reaches the query path. The existing CommandModal source-contract coverage remains green.

### 3.3 Fixed settings target and full navigation context parity

Standalone settings navigation uses `SearchSettingsTarget` (`search-scope`, `global-index`, `appearance`, or `ai`) rather than a renderer-provided selector. Rust deserializes the fixed enum and includes `view`, `fileId`, `nonce`, `sessionId`, `revision`, and the fixed target in the DTO boundary.

`MainWindowReadyRequest` now carries the optional search-window `sessionId` and `revision` alongside its nonce. The main renderer stores those values with the pending readiness context and applies navigation only when nonce, session, revision, current view, and current selected-file context all match. View, file ID, target enum, and settings/file compatibility are validated before any state setter runs; invalid or stale payloads fail closed. The browser mock validates the same DTO target and performs no native window or navigation mutation.

Relevant coverage is in `src-tauri/src/app_control.rs`, `src/utils/searchNavigation.ts`, `src/components/AppRuntimeProviders.tsx`, `src/api/tauriApi.ts`, `src/api/browserMockApi.ts`, and `tests/searchSpotlight.test.ts`. Tests cover fixed target serialization, ready-request context serialization, stale session/revision rejection, invalid view/target rejection, and browser mock wire compatibility.

### 3.4 One Rust lifecycle owner for resize and recoverable native failure

`SearchWindowLifecycleState::operation_owner` serializes the complete lifecycle operation. Resize now performs CAS validation, the native resize/center side effect, and the revision commit while one Rust owner is held. A stale request is rejected before the native adapter is invoked; a native failure leaves the prior durable snapshot and revision available for retry.

The same owner protects show/hide transitions. A failed show restores `Hidden`; a failed hide restores the previous visible snapshot and emits the retryable state instead of leaving a permanent `Hiding` phase. The old split pre-check/native/commit path is not used by production resize.

Rust tests cover stale resize with zero native calls, concurrent owner serialization with an old request rejected before side effect, and native failure recovery without a stuck transition. The permission matrix records the single-owner and rollback contract.

### 3.5 One SQLite read snapshot and coordinator conflict projection

`Database::search_global_entries_snapshot` in `src-tauri/src/global_index/repository.rs` is the single repository read operation for one search response. One SQLite read transaction obtains:

- bounded search results;
- grouped source health and source provider facts;
- a revision hash over source state, active-entry counts, and last-seen facts;
- aggregate status, completeness, counts, and errors.

The source-health query is one grouped left join over all volumes and active entries. Search results do not perform per-result source-health queries. The command compares the same-transaction database facts with the coordinator status; a conflict is projected as `pending` for an empty response or `partial` for a non-empty response, with the response remaining non-authoritative until the next consistent snapshot. Provider status is advisory and is attached to the same response DTO without creating an additional SQLite read or write.

`src-tauri/src/global_index/tests.rs` covers disabled/stale filtering, source revision changes, and source-consistent snapshots during status changes. The result-state tests cover complete, partial, pending, empty, failed, and coordinator-conflict outcomes.

## 4. Command and permission boundary

The command catalog remains metadata-only and uses fixed execution adapters. Search results open/reveal by entry ID only; Rust revalidates enabled/trusted source, stale state, path containment, live existence, object kind, and native identity before activation. Renderer-supplied arbitrary paths, selectors, SQL, shell commands, file mutations, AI execution, settings writes, rebuilds, and cleanup/restore operations are outside the search capability.

`docs/security/TAURI_COMMAND_PERMISSION_MATRIX.md` records the updated navigation DTO and lifecycle ownership contract. The browser mock is intentionally behaviorally safe: it checks the wire shape but does not pretend to perform native navigation or window side effects.

## 5. Test and validation evidence

The focused checks completed while implementing the second-round fixes are:

| Validation | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm test -- tests/searchSpotlight.test.ts tests/commandModalUi.test.ts` | pass; 24/24 |
| Rust FTS/pagination test | pass; `global_search_fts_layer_fills_remaining_page_and_offset_is_stable` |
| Rust ready-request DTO test | pass; `main_window_ready_request_carries_search_context_for_renderer_parity` |
| Rust lifecycle race/failure tests | pass; stale resize, owner serialization, and retryable native failure |
| Rust global-index focused tests | pass; ranking, FTS, snapshot, disabled-source, and status-conflict coverage |
| `npm run verify:frontend` | pass; typecheck, 73 frontend files / 513 tests, remediation 13/13, full performance matrix, and Windows NSIS build |
| `npm run verify:rust` | pass; fmt, 499 desktop-runtime tests passed / 7 performance tests ignored, all integration/doc tests, and Clippy `-D warnings` |
| `npm run verify:security` | pass; npm audit 0 vulnerabilities; cargo audit 0 vulnerabilities with 15 existing allowed advisories |
| `npm run build` | pass through `verify:frontend`; NSIS produced `Zen Canvas_0.1.40_x64-setup.exe` |
| Task 04 100k release benchmark | pass; 15 samples, p95 31.082 ms, threshold 100 ms |
| Task 04 1M release benchmark | pass; 15 prefix samples, p95 0.596 ms, threshold 100 ms; active-name index plan confirmed |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | pass |
| `git diff --check` | pass before documentation commit |

The complete frontend, Rust, remediation, performance, security, and build gates are green. A prior static-CTE performance attempt was stopped after it exposed an unacceptable punctuation/extension fast-path regression; that implementation was replaced by the sequential short-circuit design above and both 100k and 1M benchmarks now pass within threshold. GitHub Windows/macOS CI evidence is appended after the push to the existing Draft PR.

## 6. Compatibility, rollback, and non-goals

- Schema remains 30; no schema migration, dependency, lockfile, version, installer, or release change was made.
- Global Index remains the only global search authority.
- File Library Query V2, cross-page selection, tags, Saved View, Inspector, Organization Plan, Task 05, and all later tasks were not started.
- `files`, Managed AI, `files.id`, dedupe, operation/cleanup journal, Safe Trash, and restore boundaries were not modified.
- Search rollback is a source-level revert of the Task 04 branch commits; there is no database migration rollback because this remediation adds no schema.
- If a provider/coordinator revision conflicts, the renderer must show the partial/pending state and refetch; it must not silently upgrade the response to complete.
- If the native search window adapter fails, the Rust lifecycle snapshot remains retryable and no stale renderer request may perform a native side effect.

## 7. Known risks and human acceptance

- Real Windows/macOS shortcut registration, focus ordering, transparent-window behavior, open/reveal integration, and packaging still require platform CI and human runtime review.
- Non-desktop Rust compilation retains existing cfg-dependent dead-code warnings; the desktop Clippy gate is the authoritative warning-denied check.
- Existing dependency-owner RustSec advisories, if reported by the security job, are pre-existing and no dependency changed in Task 04.
- The search response is intentionally bounded to 4,096 de-duplicated candidates; a cursor beyond that boundary returns no page rather than silently scanning the full index.

Task 04 second-round implementation remediation is complete on the branch, but the Draft PR remains pending second human code-level acceptance. Do not merge and do not begin Task 05.

## 8. Delivery record

- Final branch HEAD and full local validation results are updated here after the final commit.
- Draft PR: [#35](https://github.com/ArdenZC/Zen-Canvas/pull/35), `feat: harden global shortcut search and command surface`.
- The branch must be pushed to the existing PR only; no new PR is to be created.
- Merge: prohibited; stop after reporting validation and wait for human review.
