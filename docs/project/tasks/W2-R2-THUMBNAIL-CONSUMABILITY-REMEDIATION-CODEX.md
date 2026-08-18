# W2-R2 — Browse Identity + Thumbnail Consumability Remediation

Status: future gated remediation taskbook — starts only after R1 is independently reviewed and accepted.

R2 owns the smallest W1-to-W2 correction needed to make a real Browse entry safely consumable by Thumbnail without inventing identity. It is deliberately split into two phases inside one remediation so the public Browse lifetime contract is proven before Thumbnail builds on it.

## 0. Required reading and preflight

Read and treat as binding before editing:

1. `AGENTS.md`;
2. `docs/project/README.md`;
3. `docs/project/STATUS.md`;
4. `docs/project/ROADMAP.md`;
5. `docs/project/MASTER_DEVELOPMENT_PLAN.md`;
6. `docs/project/DEVELOPMENT_WORKFLOW.md`;
7. `docs/project/CODE_MAINTAINABILITY.md`;
8. `docs/project/ARCHITECTURE_MAP.md`;
9. `docs/project/initiatives/W2-file-library-experience.md`;
10. `docs/project/specs/file-library-preview/07-W2-EXPERIENCE-IMPLEMENTATION-PLAN.md`;
11. W1 Browse, Read Gate, Thumbnail and integration taskbooks relevant to the current implementation;
12. `src/types/fileWorkspace.ts`;
13. `src/api/fileWorkspaceApi.ts` and `src/api/fileWorkspaceMockApi.ts`;
14. `src/fileWorkspace/fileWorkspaceController.ts`;
15. `src-tauri/src/file_workspace/browse/**`;
16. `src-tauri/src/file_workspace/read_gate.rs`;
17. `src-tauri/src/file_workspace/thumbnail/**`;
18. `src-tauri/src/file_workspace/integration/**`;
19. current focused integration/performance tests that construct ephemeral thumbnail requests;
20. R1 accepted evidence and the latest PR #92/R0 findings.

Record worktree, branch, HEAD, master, merge-base, changed paths and current PR state. Use an isolated worktree. Stop on unrelated changes.

## 1. Problems established by R0

### A. Public Browse identity is broader than the real source

The shared TypeScript `EntryRef` union permits managed or ephemeral identities, while `BrowseService` publishes ephemeral refs and invalidates enumeration-owned entries when their enumeration is superseded/released. A future shared adapter must not accidentally narrow a broad `EntryRef` into a Browse identity without preserving its source lifetime.

### B. `sourceGeneration` has no proven producer contract

The public `ThumbnailRequest` exposes optional `sourceGeneration`; the Rust validator requires it for `EntryRef::Ephemeral`.

However the current service also obtains the authoritative `source_version` from Read Gate itself. In the reviewed code, `sourceGeneration` participates in the session cache/generation identity but R0 did not find an authoritative comparison proving that the caller-supplied value equals `BrowsePage.enumerationId` or another Browse-owned generation.

Tests that copy `enumerationId` into `source_generation` are therefore coverage conveniences, not proof of semantic equivalence.

### C. Browser/mock evidence can mask native contract errors

The browser mock must not accept a request shape that real Rust rejects and then allow a Chromium/UI gate to imply native consumability. R2 must audit mock parity for the exact fields and stale/cross-session behavior touched by the remediation.

## 2. Phase A — Browse identity and lifetime hardening

Before deciding Thumbnail generation, establish a precise public Browse identity contract.

Required outcomes:

- a Browse presentation/input type cannot truthfully represent a managed ref as if it were a Browse entry;
- the complete `sessionId + requestId + enumerationId` collection identity remains available where stale-enumeration reasoning is required;
- any `BrowsePathRef` remains paired with its source Browse session;
- an ephemeral `EntryRef` remains session-scoped and cannot be persisted or promoted to durable identity;
- entry/page projections are discarded or fail closed after supersede/release/session disposal according to existing W1 authority;
- renderer presentation keys remain distinct from command-addressable refs;
- no raw filesystem path is introduced.

Choose the narrowest compatible type/API hardening. Do not duplicate the Browse authority or create a second registry merely to make TypeScript convenient.

If a public contract must be narrowed, update browser mocks and focused integration tests so the mock cannot publish impossible identity combinations.

## 3. Phase B — Determine `sourceGeneration` ownership before implementing a producer

Do **not** begin by assigning a value to `sourceGeneration`.

First answer with code-level evidence:

1. What invariant is `sourceGeneration` intended to protect?
2. Which current backend object owns that invariant?
3. Is it required for security/stale rejection, only cache namespacing/deduplication, or both?
4. Does the current service validate caller-supplied generation against Browse authority anywhere?
5. Could the backend derive the necessary generation/lifetime from the ephemeral ref/session it already resolves?
6. If an explicit opaque token is still required, which backend owner creates it and how is it validated?
7. Is `BrowsePage.enumerationId` actually the same concept? If yes, prove it by authority and tests before using it; matching string shape is not proof.

Then choose the narrowest reviewed solution:

- backend-owned derivation;
- an explicit backend-issued validated opaque token;
- removal/simplification of a redundant caller field;
- or another solution that preserves the same authority without renderer inference.

The selected design must make a truthful production Browse entry able to construct/request a thumbnail with no copy/guess step.

## 4. Safety invariants

Preserve:

- Browse session isolation;
- stale enumeration/entry failure;
- Read Gate as byte-read/source-version authority;
- ThumbnailService cache/scheduler ownership;
- cancellation and publication revocation;
- no implicit materialization/hydration;
- supported Windows and Apple Silicon macOS behavior;
- existing resource caps and performance thresholds.

A cache-identity convenience must never be represented as filesystem or read authority.

## 5. Required tests

At minimum cover:

### Browse identity

- managed ref cannot masquerade as Browse source where the public contract says Browse;
- ephemeral ref/session pairing;
- stale entry after enumeration supersede;
- page release and session disposal lifetime;
- `BrowsePathRef` cross-session rejection;
- adversarial opaque IDs remain data, not paths/presentation-key parsing inputs.

### Thumbnail

- valid production-shaped Browse entry → valid thumbnail request;
- missing/unknown generation behavior under the chosen contract;
- stale enumeration/entry;
- cross-session mismatch;
- source identity/version change;
- cancellation/cleanup;
- Read Gate denial/materialization-required states;
- no implicit hydration;
- mock/browser behavior matches the real request validation relevant to the contract.

Do not use a test helper that bypasses the public producer being proved.

## 6. Maintainability gate

Thumbnail already spans orchestration, cache, dispatch, renderer and read-gate concerns. Before adding behavior, inspect module ownership using `CODE_MAINTAINABILITY.md`.

Do not append a second authority or slow filesystem work under a global coordination lock. If the fix would make one module own Browse lifetime plus Thumbnail cache/scheduler lifetime, STOP and redesign the seam instead.

## 7. Prohibitions

Do not:

- set `sourceGeneration = enumerationId` without an authority proof;
- use UI keys, display paths, raw paths, request IDs or counters as source identity;
- move Read Gate/cache/scheduler/filesystem authority into renderer code;
- create a second Browse registry or durable Browse identity;
- implement W2-02 presentation UI or W2-03/W2-04 adapters;
- redesign Thumbnail scheduling/cache unrelated to the consumer seam;
- weaken stale/cross-session checks;
- claim browser-mock success as native success;
- begin R3/R4.

## 8. Stop conditions

STOP and report if:

- safe thumbnail consumption requires a new durable authority/schema;
- a truthful generation cannot be derived/issued without changing the W1 authority model;
- Browse identity hardening breaks an existing legitimate W1 consumer whose ownership is unclear;
- the proposed fix requires W2-04 navigation/source-owner work;
- maintainability review shows the intended module boundary would create mixed independent lifecycles;
- Windows/macOS behavior would diverge without an approved platform contract.

A STOP result is `BLOCKED`, not permission to guess.

## 9. Validation and evidence

Run focused tests first, then applicable frontend/Rust/remediation/performance/security/build/native gates for the touched code. Preserve exact R1 CI evidence semantics.

Evidence must distinguish:

- deterministic contract tests;
- browser-mock tests;
- Windows native evidence;
- macOS native evidence;
- unrun provider/network fixtures.

Clean task-owned temp/cache/fixture artifacts before reporting completion.

## 10. Exit gate

R2 is complete only when a reviewer can trace, from current production code:

`real Browse producer -> source-specific identity/lifetime -> truthful Thumbnail request -> backend validation -> existing Read Gate/Thumbnail path`

with no fabricated generation, no raw path, no stale/cross-session hole, and browser mocks that do not hide a native rejection.

Classify each conclusion as `HARD PASS`, `OBSERVED`, `UNVERIFIED`, `DEFERRED`, or `BLOCKED`.

R2 does not authorize W2-02. R3 and R4 remain mandatory.

## 11. Final report

Return:

1. exact branch/worktree/head/base;
2. changed files grouped by Phase A/Phase B/tests/docs;
3. final Browse public identity contract;
4. lifetime/stale semantics preserved;
5. `sourceGeneration` purpose discovered;
6. owning authority for that invariant;
7. whether it is security validation, cache namespace, or both;
8. chosen producer/derivation design and rejected alternatives;
9. proof whether `enumerationId` is or is not equivalent;
10. browser-mock parity changes;
11. focused tests;
12. frontend/Rust/native/CI evidence;
13. performance/resource results where applicable;
14. maintainability review;
15. cleanup result;
16. remaining unverified fixtures;
17. PR state/head;
18. explicit statement that R3/R4/W2-02 were not started.

STOP after the R2 Draft PR is pushed for review.