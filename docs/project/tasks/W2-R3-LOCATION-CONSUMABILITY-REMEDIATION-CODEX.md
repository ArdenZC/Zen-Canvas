# W2-R3 — Location Consumability Remediation

Status: future gated remediation taskbook — starts only after R2 is independently reviewed and accepted.

R3 owns the minimum backend-authorized seam that lets a future W2 navigation surface act on a Location projection without reconstructing a filesystem path or inventing capability evidence.

## 0. Required reading and preflight

Read and treat as binding:

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
11. relevant W1 Location/Browse/integration taskbooks;
12. `src/types/fileWorkspace.ts`;
13. `src/api/fileWorkspaceApi.ts` and `src/api/fileWorkspaceMockApi.ts`;
14. `src/fileWorkspace/fileWorkspaceController.ts`;
15. `src-tauri/src/file_workspace/location.rs`;
16. `src-tauri/src/file_workspace/browse/**`;
17. `src-tauri/src/file_workspace/integration/browse.rs` and integration types/tests;
18. scan-root/runtime evidence types used by managed locations;
19. accepted R1/R2 evidence and current PR #92/R0 findings.

Record worktree, branch, HEAD, master, merge-base, changed paths and PR state. Use an isolated worktree. Stop on unrelated changes.

## 1. Problems established by R0

### A. Projection is not actionable

`LocationDescriptor` publishes an opaque `LocationRef`, display metadata and fail-closed capability state. `locationList` can return descriptors, while `browseOpen` separately accepts a renderer-provided `routingHint` that backend code turns into a directory admission request.

Therefore a future W2 renderer cannot safely perform:

`LocationDescriptor -> click -> Browse admission`

without an additional backend-owned action seam.

It must not recover a path from `displayName`, `displayPath`, `scanRootId`, provider labels or any other presentation field.

### B. Successful admission and location classification are currently over-coupled

The current `LocationRuntimeEvidence::Available` projection fails closed when the location `kind` is `Unknown`. At the same time, a successful `open_browse` currently projects the admitted ephemeral location with `LocationRuntimeEvidence::unknown()`, so the resulting location can remain `canBrowse=false` even though backend admission already succeeded.

R3 must review whether these are actually the same fact:

- **action/admission capability**: backend can safely open/browse this target now;
- **location classification**: backend knows whether the target is local, external, network, cloud provider, etc.

Do not require high-confidence classification merely to truthfully represent a narrower capability that backend admission already proved, unless the security model demonstrates that coupling is necessary.

### C. Mock/browser parity must not hide the gap

The browser mock currently mirrors some fail-closed unknown location states. R3 must ensure mock navigation/action semantics match the real backend contract being established; Chromium evidence must not pass through a renderer-only shortcut unavailable to native code.

## 2. Required product/authority outcome

Establish one narrow backend-authorized action from a safe renderer intent to fresh Browse authority.

The exact request shape is an implementation decision, but it must satisfy all of the following:

- renderer supplies only an opaque location/action reference or other non-path intent explicitly issued by backend authority;
- backend resolves/adjudicates the intent;
- successful action returns fresh live Browse session/path/location references;
- stale/unknown/unavailable/permission states fail closed;
- no durable Browse refs are created;
- no `LocationRef` becomes a generic path resolver;
- restore remains a separate non-authoritative metadata flow that obtains fresh live refs;
- managed scan-root identity does not become a filesystem-path capability;
- provider/platform evidence remains backend-owned.

If the current `LocationDescriptor` cannot safely support action without an additional backend-issued handle, introduce the smallest opaque action handle needed. Do not expose a raw path.

## 3. No deferral-as-PASS rule

R3 is a hard prerequisite before W2-02 and W2-04.

Therefore **“keep LocationDescriptor non-actionable and let W2-04 solve it later” is not a passing R3 outcome**. That would create a dependency cycle because W2-04 is downstream of W2-02/R3.

If R3 cannot establish the minimal safe action seam within existing W1/W2 authority boundaries, classify R3 `BLOCKED` and return to architecture/dependency review. Do not mark it PASS and defer the missing seam downstream.

## 4. Capability evidence vs classification review

Explicitly model and test the distinction between:

- admission/actionability;
- metadata readability;
- preview eligibility;
- watchability;
- materialization request support;
- add-to-library eligibility;
- availability/permission state;
- location kind/classification confidence;
- freshness/reconciliation state.

A capability may be `false`/unknown when backend has no evidence. But one unknown dimension must not automatically erase an independently proven capability unless the architecture requires that coupling.

The review must answer:

1. After `open_browse` succeeds, what capability facts are now proven?
2. Which facts remain unknown?
3. Does `kind == Unknown` logically invalidate `canBrowse`, or are these independent?
4. For managed scan roots, which capability comes from existing durable authority vs current runtime evidence?
5. How are provider/offline/permission/reconciliation states kept distinct?

## 5. Required tests

At minimum cover:

### Action seam

- valid actionable location intent -> fresh Browse session/root path ref;
- stale/unknown action ref;
- cross-session misuse where applicable;
- unavailable/offline/disconnected;
- permission denied/authentication required;
- managed and ephemeral/source-specific behavior;
- restore obtains fresh live refs and does not reuse stale action/path refs;
- no renderer display/path field can be used as admission input.

### Capability evidence

- successful admission with unknown classification does not produce a false statement;
- known classification + proven capability;
- unknown/unavailable states fail closed for unproven capabilities;
- managed reconciliation/freshness remains distinct from immediate admission capability;
- Windows/macOS supported path behavior;
- browser mock follows the same action/capability contract relevant to UI tests.

Use real backend ownership in integration tests; do not prove the design only with a renderer mock.

## 6. Maintainability gate

Inspect `location.rs`, Browse integration and controller ownership before expanding them.

Do not turn `location.rs` from a projection module into a second filesystem router if the actionable seam properly belongs in integration/admission code. Keep projection, admission and Browse session lifetime responsibilities separable.

If the fix would require a generic resolve-anything service or a new long-lived registry with unclear ownership, STOP.

## 7. Prohibitions

Do not:

- expose raw filesystem paths to renderer code;
- use `displayName`, `displayPath`, provider label or `scanRootId` as a path;
- create a generic `resolveLocationToPath` renderer seam;
- infer provider capability from path strings or OS heuristics;
- turn `LocationRef` into byte-read, thumbnail or mutation authority;
- create a second scan-root/filesystem authority;
- persist ephemeral action/path/session refs;
- implement W2-04 navigation UI or W2-02 presentation adapters;
- claim a later W2 owner will fix the missing seam while marking R3 PASS;
- begin R4/W2-02.

## 8. Stop conditions

STOP and classify `BLOCKED` if:

- safe action requires renderer path reconstruction;
- the only solution requires a new durable authority/schema not separately approved;
- provider/platform semantics cannot be made truthful without broader W4 native integration;
- existing managed-location authority conflicts with the proposed action owner;
- the minimum action seam necessarily belongs to W2-04, creating a dependency cycle;
- capability/classification coupling cannot be resolved without a new architecture decision.

Return to graph/architecture review rather than bypassing the gate.

## 9. Validation and evidence

Run focused Rust/TypeScript/integration tests first, then applicable remediation/security/build/native/CI checks according to touched surfaces and R1 evidence policy.

Native claims require the matching supported runner. Real iCloud/File Provider/network/external fixtures remain `UNVERIFIED` unless actually exercised.

Clean task-owned artifacts before closeout.

## 10. Exit gate

R3 is complete only when a reviewer can trace:

`safe Location projection/intent -> backend-owned admission/action -> fresh Browse authority`

without any renderer path recovery, while capability states remain truthful and independently evidenced.

Classify every conclusion as `HARD PASS`, `OBSERVED`, `UNVERIFIED`, `DEFERRED`, or `BLOCKED`.

R3 completion does not authorize W2-02 until R4 passes.

## 11. Final report

Return:

1. exact branch/worktree/head/base;
2. changed files;
3. action request/response contract;
4. backend owner of admission;
5. freshness/staleness model;
6. restore behavior;
7. capability-vs-kind conclusion;
8. managed vs ephemeral location conclusion;
9. provider/platform evidence boundaries;
10. browser-mock parity changes;
11. focused tests;
12. native/CI evidence;
13. maintainability review;
14. cleanup result;
15. all `UNVERIFIED`/`BLOCKED` cases;
16. PR state/head;
17. explicit statement that R4/W2-02 were not started.

STOP after the R3 Draft PR is pushed for review.