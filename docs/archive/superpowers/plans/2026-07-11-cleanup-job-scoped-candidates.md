# Cleanup Job-scoped Candidates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bind every Storage Cleanup candidate lookup, preview, AI analysis, and execution request to the completed retained scan job that produced it.

**Architecture:** Move candidate ownership from the global `latest_candidates` cache into each `StorageCleanupJob`, retain an ordered analysis plus an indexed lookup, and expose one strict all-or-nothing `(job_id, ids)` resolver. Split frontend scan activity from displayed-result identity and require `displayedJobId` on every candidate-bearing API call while rejecting stale async responses.

**Tech Stack:** Rust, Tauri 2 commands/state, TypeScript, Zustand, React 19, Vitest, Cargo tests.

---

### Task 1: Specify strict backend job ownership

**Files:**
- Modify: `src-tauri/tests/storage_analyzer.rs`
- Modify: `src-tauri/src/storage_analyzer.rs`

- [ ] **Step 1: Write failing Rust behavior tests**

Add test-only helpers to the import list and tests that start scans over temporary roots containing candidate-producing `node_modules` directories. Poll each job until it completes, then assert the wished-for API:

```rust
let a = candidates_by_job_and_ids_for_test(&state, &job_a, &[candidate_a.id.clone()])?;
assert_eq!(a[0].id, candidate_a.id);

let cross_job = candidates_by_job_and_ids_for_test(
    &state,
    &job_a,
    &[candidate_b.id.clone()],
);
assert!(cross_job.unwrap_err().contains("does not belong"));
```

Cover these independent behaviors:

```rust
cleanup_job_a_cannot_execute_job_b_candidates
cleanup_new_job_does_not_change_old_job_page
cleanup_missing_candidate_fails_whole_request
cleanup_duplicate_candidate_ids_are_rejected
cleanup_candidate_resolution_preserves_request_order
cleanup_candidate_ids_are_scoped_to_jobs
cleanup_evicted_job_cannot_resolve_candidates
```

- [ ] **Step 2: Run the new Rust tests and verify RED**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --test storage_analyzer cleanup_job_a_cannot_execute_job_b_candidates -- --exact
```

Expected: compilation fails because `candidates_by_job_and_ids_for_test` and the job-scoped ownership behavior do not exist.

- [ ] **Step 3: Replace the global cache with job-owned candidate state**

Change the state shape to:

```rust
#[derive(Default)]
struct StorageCleanupStateInner {
    jobs: Mutex<HashMap<String, StorageCleanupJob>>,
    active_job_id: Mutex<Option<String>>,
}

#[derive(Clone)]
struct StorageCleanupJob {
    status: StorageCleanupScanStatus,
    cancel_flag: Arc<AtomicBool>,
    candidates_by_id: HashMap<String, StorageCandidate>,
}
```

Initialize `candidates_by_id` as empty for running jobs. On completion, rewrite every candidate ID using the job and normalized path before constructing the index:

```rust
fn candidate_id_for_job(job_id: &str, path: &str) -> String {
    let mut hasher = DefaultHasher::new();
    job_id.hash(&mut hasher);
    normalize_compare_text(path).hash(&mut hasher);
    format!("storage-{:016x}", hasher.finish())
}
```

Install the rewritten analysis and index on the same mutable job while holding the jobs mutex. Remove `latest_candidates`, `replace_candidates`, `candidates_by_id`, and the global-cache version of `update_candidates`.

- [ ] **Step 4: Implement the strict resolver and job-local updater**

Add:

```rust
fn candidates_by_job_and_ids(
    &self,
    job_id: &str,
    ids: &[String],
) -> Result<Vec<StorageCandidate>, String>
```

The function must first require an existing job with status `completed`; then use a `HashSet` to reject duplicates; then resolve each ID with `map` and `collect::<Result<Vec<_>, _>>()` so one missing ID fails the whole request and request order is preserved. Add `update_candidates_for_job(job_id, candidates)` that rejects missing candidates and updates both `status.analysis.candidates` and `candidates_by_id` for the specified completed job.

Expose narrowly scoped test helpers:

```rust
pub fn candidates_by_job_and_ids_for_test(
    state: &StorageCleanupState,
    job_id: &str,
    ids: &[String],
) -> Result<Vec<StorageCandidate>, String>
```

and a paging wrapper for assertions. Do not add test-only behavior to production commands.

- [ ] **Step 5: Run all targeted Rust tests and verify GREEN**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --test storage_analyzer cleanup_ -- --nocapture
```

Expected: all Storage Cleanup ownership, paging, missing-ID, order, duplicate, and eviction tests pass.

### Task 2: Require job ID on every backend candidate command

**Files:**
- Modify: `src-tauri/src/storage_analyzer.rs`
- Modify: `src-tauri/src/ai/cleanup.rs`
- Modify: `src-tauri/tests/storage_analyzer.rs`

- [ ] **Step 1: Add failing command-boundary tests**

Add direct state/helper tests proving a running job and a cancelled job return an error from strict resolution, and that AI updates scoped to job A cannot update job B. Use explicit assertions for the completed-state error and ownership error.

- [ ] **Step 2: Run the boundary tests and verify RED**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --test storage_analyzer cleanup_running_job_cannot_resolve_candidates -- --exact
```

Expected: FAIL because candidate resolution is not yet wired through all command paths.

- [ ] **Step 3: Add `job_id` to every Tauri command**

Update the signatures and resolvers for:

```rust
preview_cleanup_candidates(job_id, ids)
preview_cleanup_operations(job_id, ids)
move_cleanup_candidates_to_trash(job_id, ids)
move_cleanup_candidates_to_safe_trash(job_id, ids)
analyze_cleanup_candidates_with_ai(job_id, ids)
```

Every command must call `candidates_by_job_and_ids(&job_id, &ids)` before using existing preview/revalidation/execution logic. The AI command must call `update_candidates_for_job(&job_id, &updated)` after provider analysis. Do not alter preview confirmation, main-window authorization, execution-time path revalidation, or Safe Trash behavior.

- [ ] **Step 4: Run Rust tests and verify GREEN**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --test storage_analyzer
cargo test --manifest-path src-tauri/Cargo.toml --lib ai::cleanup
```

Expected: both commands exit successfully with no failed tests.

### Task 3: Make the TypeScript API contract explicit

**Files:**
- Modify: `tests/tauriApi.test.ts`
- Modify: `src/api/tauriApi.ts`
- Modify: `src/api/browserMockApi.ts`

- [ ] **Step 1: Change API tests first**

Call candidate APIs with `"job-1"` and assert payloads include it:

```ts
await tauriApi.previewCleanupCandidates("job-1", ["storage-safe-1"]);
expect(apiMocks.invoke).toHaveBeenCalledWith("preview_cleanup_candidates", {
  jobId: "job-1",
  ids: ["storage-safe-1"]
});
```

Repeat for operation preview, AI analysis, system trash, and Safe Trash.

- [ ] **Step 2: Run the API test and verify RED**

Run:

```powershell
npx vitest run tests/tauriApi.test.ts
```

Expected: TypeScript/runtime argument assertions fail because the API methods accept only IDs.

- [ ] **Step 3: Implement TypeScript API signatures**

Change every candidate-bearing method to accept `jobId: string` first and invoke Tauri with `{ jobId, ids }`. Update browser mock command handling to validate/preserve the same request shape without changing mock cleanup safety semantics.

- [ ] **Step 4: Run the API test and verify GREEN**

Run:

```powershell
npx vitest run tests/tauriApi.test.ts
```

Expected: PASS.

### Task 4: Separate active and displayed cleanup jobs

**Files:**
- Modify: `tests/storageCleanupStore.test.ts`
- Modify: `src/store/useStorageCleanupStore.ts`

- [ ] **Step 1: Write failing Zustand behavior tests**

Replace `scanJobId` assertions with explicit `activeJobId` and `displayedJobId` behavior. Add tests:

```ts
it("switching jobs clears selection and old pages", () => {
  useStorageCleanupStore.getState().completeScan("job-a", analysis);
  useStorageCleanupStore.getState().beginDisplayingJob("job-b");
  const state = useStorageCleanupStore.getState();
  expect(state.displayedJobId).toBe("job-b");
  expect(state.analysis).toBeNull();
  expect([...state.selectedCleanupIds]).toEqual([]);
});
```

Add deferred-promise tests proving an old job page and an out-of-order same-job page cannot overwrite the current page.

- [ ] **Step 2: Run the store test and verify RED**

Run:

```powershell
npx vitest run tests/storageCleanupStore.test.ts
```

Expected: FAIL because `activeJobId`, `displayedJobId`, `beginDisplayingJob`, and guarded pagination do not exist.

- [ ] **Step 3: Implement separated job state**

Replace `scanJobId` with:

```ts
activeJobId: string | null;
displayedJobId: string | null;
```

Use `activeJobId` only for scan progress, completion, failure, and cancellation. Use `displayedJobId` only for paging and candidate actions. `completeScan` must atomically clear active state and establish displayed state. `beginDisplayingJob(jobId)` must clear analysis, selection, AI markers/status, execution result, and filter state before loading that job.

Guard pagination with both captured identity and captured offset:

```ts
const jobId = get().displayedJobId;
const offset = get().analysis?.candidates.length ?? 0;
const page = await api.getStorageCleanupCandidatePage(jobId, offset, 200);
if (get().displayedJobId !== jobId) return;
if ((get().analysis?.candidates.length ?? 0) !== offset) return;
```

- [ ] **Step 4: Run the store test and verify GREEN**

Run:

```powershell
npx vitest run tests/storageCleanupStore.test.ts
```

Expected: PASS, including stale and out-of-order response tests.

### Task 5: Route UI actions through the displayed job

**Files:**
- Modify: `tests/storageCleanupView.test.tsx`
- Modify: `src/views/cleanup/StorageCleanupView.tsx`

- [ ] **Step 1: Update view contract tests first**

Assert the source passes the displayed job into AI and Safe Trash calls:

```ts
expect(source).toContain("api.analyzeCleanupCandidatesWithAI(displayedJobId, ids)");
expect(source).toContain("api.moveCleanupCandidatesToSafeTrash(displayedJobId, [...selectedCleanupIds])");
```

Add a rendered test that candidate actions are unavailable when analysis exists without a displayed job ID.

- [ ] **Step 2: Run the view test and verify RED**

Run:

```powershell
npx vitest run tests/storageCleanupView.test.tsx
```

Expected: FAIL because calls remain unscoped.

- [ ] **Step 3: Pass `displayedJobId` through all view actions**

Read `displayedJobId` from the store. Before preview, AI, or execution, report a local stale-result error when it is absent. Pass it as the first argument to every candidate-bearing API call. Preserve the current explicit confirmation dialog, Review warning, Safe Trash copy, and advisory-only AI behavior.

- [ ] **Step 4: Run frontend cleanup tests and verify GREEN**

Run:

```powershell
npx vitest run tests/storageCleanupStore.test.ts tests/storageCleanupView.test.tsx tests/tauriApi.test.ts
```

Expected: PASS.

### Task 6: Phase validation and isolated commit

**Files:**
- Verify all modified phase-1 files
- Do not stage unrelated UI/design work already present in the worktree

- [ ] **Step 1: Run formatting and diff checks**

Run:

```powershell
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
git diff --check
```

Expected: both commands succeed; unrelated working-tree paths remain unstaged.

- [ ] **Step 2: Run the complete phase gate**

Run:

```powershell
npm run typecheck
npm test
cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime
cargo clippy --manifest-path src-tauri/Cargo.toml --features desktop-runtime -- -D warnings
```

Expected: every command exits with code 0 and no failed test or Clippy warning.

- [ ] **Step 3: Audit the phase requirements against current source**

Confirm by search and diff inspection that `latest_candidates` and unscoped candidate commands are gone, every candidate command includes `job_id`, no resolver uses `filter_map`, frontend action calls include `displayedJobId`, and all required behavior tests exist.

- [ ] **Step 4: Commit only phase 1 files**

Stage the plan, Rust backend/tests, TypeScript API/mock/store/view, and their tests by exact path. Confirm `git diff --cached --name-only` contains no parallel UI design-system files, then commit:

```powershell
git commit -m "fix(cleanup): scope candidates by scan job"
```
