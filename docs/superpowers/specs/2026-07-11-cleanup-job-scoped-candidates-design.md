# Cleanup Job-scoped Candidates Design

## Scope

This design covers only phase 1 of the combined second/third remediation audit at baseline `537281a7d72280403aeea056a264b1c3e3e13f89`: bind every Storage Cleanup candidate to the scan job that produced it. Later path, settings, journal, dedupe, UUID, domain, AI credential, and cross-platform test phases remain out of scope.

The existing safety contract remains unchanged: cleanup is advisory until the user enters preview, execution uses Rust-owned authoritative candidates, every candidate is revalidated immediately before execution, and cleanup uses Safe Trash rather than permanent deletion.

## Current Failure Mode

`StorageCleanupState` retains multiple jobs but stores candidates in one global `latest_candidates` map. Completing job B clears job A's lookup data while job A's paginated analysis remains available. Preview, AI analysis, system-trash, and Safe Trash commands accept only candidate IDs and resolve them against that global map. Missing IDs are silently dropped by `filter_map`.

The frontend also overloads `scanJobId` as both the currently running scan and the analysis being displayed. This makes it difficult to reject stale paging responses and impossible to state explicitly which job owns an execution request.

## Considered Approaches

### 1. Job-owned analysis and candidate index (selected)

Each retained job owns its full analysis plus a `candidates_by_id` index. Commands resolve `(job_id, ids)` while holding the jobs lock, require a completed retained job, validate every requested ID, preserve request order, and reject duplicate IDs. AI updates mutate both the job analysis and its index.

This duplicates candidate values between the ordered analysis vector and lookup map, but keeps paging stable and makes ownership and eviction atomic. The bounded retained-job count limits memory growth.

### 2. Job-owned analysis with per-request indexing

Keep only the ordered analysis vector and build a temporary map for every candidate request. This avoids stored duplication but repeats allocation and indexing for every preview, AI, and execution request.

### 3. Global composite-key cache

Keep a global map keyed by `(job_id, candidate_id)`. This is a smaller structural change but separates candidate lifetime from job eviction and leaves two state stores that can drift. It is rejected because the audit specifically requires candidates to belong to jobs.

## Backend Design

`StorageCleanupJob` will own:

- its existing status and cancellation flag;
- the complete ordered `StorageAnalysis` after a successful scan;
- a `HashMap<String, StorageCandidate>` lookup index for the same candidates.

The global `latest_candidates` field and its replacement/lookup/update helpers will be removed.

When a scan completes, candidate IDs will be rebound to the job using a deterministic hash of `job_id` and the candidate's normalized path. This makes the same path scanned by two jobs produce different IDs while keeping ordering deterministic inside one completed result. Both analysis and index are installed in the job in one state transition.

The unified resolver will have the semantic contract:

```rust
fn candidates_by_job_and_ids(
    &self,
    job_id: &str,
    ids: &[String],
) -> Result<Vec<StorageCandidate>, String>
```

It will:

1. fail when the job is absent or has been evicted;
2. fail unless the job status is `completed`;
3. reject duplicate requested IDs;
4. fail the whole request if any ID is absent from the job;
5. return candidates in request order.

All candidate-bearing Tauri commands will require `job_id`: candidate preview, operation preview, system-trash execution, Safe Trash execution, and AI analysis. Paging already accepts `job_id` and will continue to read from the retained job. AI results will update only the specified retained job and will fail if the job is no longer executable.

Job eviction removes the status, ordered analysis, and candidate index together. Consequently, an evicted job cannot be paged, analyzed, previewed, or executed.

## Frontend Design

The cleanup store will distinguish:

- `activeJobId`: the scan currently receiving progress/cancellation events;
- `displayedJobId`: the completed job whose candidates are visible and actionable.

Starting a scan clears the displayed analysis and selection, assigns the eventual job ID to `activeJobId`, and leaves `displayedJobId` empty until that job completes. Completion is accepted only for the active job and atomically sets `displayedJobId`, the first analysis page, and default-safe selections.

Every candidate-bearing API call will receive `displayedJobId`. UI actions will fail locally when no displayed job exists instead of sending an unscoped request.

Changing the displayed job clears selection, old pages, AI markers/status, and execution state before loading the first page. Paging captures the requested job ID and offset. A response is applied only if `displayedJobId` still matches and the current candidate count still equals the captured offset, preventing both cross-job responses and same-job out-of-order page writes.

## Error Handling and Concurrency

Backend candidate resolution is all-or-nothing. No candidate request may use `filter_map` or silently shrink the requested set. Errors identify the missing job, non-completed state, duplicate request, or missing candidate without exposing filesystem paths unnecessarily.

Frontend async operations capture `displayedJobId` at dispatch. AI results and paging results are ignored if the displayed job changes before completion. Execution requests remain explicit user actions and continue through existing preview/Safe Trash confirmation.

## Test Design

Rust behavior tests will prove:

- job A cannot resolve or execute job B candidates;
- completing job B does not change job A paging;
- one missing ID fails the whole request;
- duplicate IDs are rejected;
- candidate response order follows request order;
- candidate IDs differ across jobs for the same path;
- an evicted historical job cannot resolve candidates.

TypeScript tests will prove:

- every candidate API command includes `jobId`;
- switching displayed jobs clears selection and old candidate pages;
- a stale page response cannot overwrite the new displayed job;
- an out-of-order page response for the same job cannot corrupt pagination;
- preview, AI, and execution actions use `displayedJobId`.

After targeted red/green cycles, the phase is accepted only after the audit-prescribed typecheck, frontend suite, Rust formatting check, desktop-runtime Rust tests, and Clippy all pass. The phase will then be committed separately as `fix(cleanup): scope candidates by scan job`.
