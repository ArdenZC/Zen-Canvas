# W2-R4 — W1-to-W2 Final Consumability Verification

Status: future verification gate — starts only after R1, R2 and R3 are independently accepted.

R4 is an independent verification pass. It is not an implementation Track and must not become a convenient place to repair remaining production defects. Its job is to prove that the public W1 producers and the intended W2 consumers can now form truthful requests without renderer guessing, authority duplication or lifetime loss.

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
11. the accepted R1, R2 and R3 taskbooks, PRs, ADR/evidence and exact merged heads;
12. current public File Workspace TypeScript contracts/API/controller;
13. current Rust Browse/Location/Read Gate/Thumbnail/Preview integration surfaces;
14. current Query V2 and `LibrarySelectionV1` public selection helpers/adapters;
15. browser mocks and focused integration tests that represent these seams.

R4 should normally be docs/governance/test-evidence only. If a production fix is required, STOP, classify the seam `BLOCKED`, and create a separately reviewed remediation before restarting R4.

Record current master HEAD, exact R1/R2/R3 merge descendants, worktree state and all relevant CI/native evidence.

## 1. Verification principle

For every seam, answer this question using current code rather than intent:

> Given only the public producer output and public consumer request contract, can a real W2 caller construct a request that the authoritative backend will accept, while preserving the correct owner, source lifetime and fail-closed semantics?

A type existing is not a PASS. A mock accepting a request is not a PASS. A test helper fabricating hidden fields is not a PASS.

## 2. Required seam matrix

### A. Browse identity and lifetime

Verify:

- source-specific Browse identity cannot masquerade as managed/durable identity;
- `sessionId + requestId + enumerationId` provenance is preserved where collection/stale semantics require it;
- `BrowsePathRef` remains paired with its session;
- stale entries/pages/paths fail closed after supersede/release/disposal;
- presentation keys are not command refs;
- no raw path crosses the renderer authority boundary.

### B. Thumbnail

Verify:

- a real Browse producer can request a thumbnail without copying/guessing generation data;
- the final owner/meaning of any generation field is explicit;
- stale/cross-session/source-version checks are effective in the authoritative backend;
- Read Gate and Thumbnail cache/scheduler ownership remain unchanged;
- browser mocks cannot pass a shape native Rust rejects.

### C. Location admission/navigation

Verify:

- a future W2 navigation surface can act on a backend-issued opaque location intent without recovering a path;
- backend admission returns fresh live Browse refs;
- unavailable/permission/provider states fail closed;
- capability evidence is not falsely coupled to classification where the backend has independently proven a narrower fact;
- restore remains non-authoritative and obtains fresh references.

### D. Read Gate

Verify current public consumers can use managed and ephemeral opaque sources without renderer path resolution and that backend resolution/eligibility/source-version remain authoritative.

Record any materialization/provider cases that remain intentionally fail-closed or unverified.

### E. Preview Core

Verify W1 Preview remains safely consumable as the current metadata-fallback Preview Core seam:

- source resolution remains backend-owned;
- Read Gate remains the byte eligibility/lease authority;
- lifecycle/cancellation/source switching are bounded;
- W2 does **not** reinterpret this as W3 rich Quick Preview/provider completion.

### F. Query V2 / Library selection provenance

Verify:

- `LibrarySelectionV1` remains the source authority;
- `all_matching` stays compact;
- any row-membership decision used by later shared UI is bound to the exact active Query V2 collection context or fails closed;
- no context-free helper is promoted as a cross-source contract;
- no 100k ID materialization is introduced.

R4 does not require shared selection/focus convergence. That remains downstream of W2-03 and W2-04.

### G. CI evidence

Verify R1 policy against actual current runs:

- exact PR-head lane identifies the executed head;
- merge-integration lane identifies the integration tree;
- diff head/base semantics are inspectable;
- required-check/rules enforcement conclusion is current;
- artifacts cannot imply a different tree from the one executed.

## 3. Classification rules

Use only:

- `HARD PASS` — invariant proven by current code/tests/evidence;
- `OBSERVED` — observed in a real environment but not fully contract-proven;
- `UNVERIFIED` — relevant fixture/environment was not exercised;
- `DEFERRED` — intentionally outside the current W2/W1 boundary and not required for this gate;
- `BLOCKED` — required consumer contract is still unsafe/incomplete.

Any required seam classified `BLOCKED` prevents W2-02 production.

Provider/network/native fixtures may remain `UNVERIFIED` only when the frozen product scope permits that gap and no current UI claim depends on them.

## 4. No repair-in-verification rule

R4 may update verification/current-truth documentation and focused evidence scripts only if they do not alter production behavior.

If verification discovers a production defect:

1. document it;
2. classify the affected seam `BLOCKED`;
3. stop R4;
4. open a bounded remediation with its own taskbook/PR;
5. rerun R4 from the new current master after that remediation merges.

Do not make a production fix in the verification PR and then self-certify it in the same pass.

## 5. Required evidence

Produce one table with at least:

| Seam | Public producer | Public consumer/request | Owning authority | Lifetime identity | Native/browser evidence | Classification |
| --- | --- | --- | --- | --- | --- | --- |

The table must include Browse, Thumbnail, Location, Read Gate, Preview, Query V2 selection provenance and CI evidence.

Also record:

- exact master SHA under review;
- R1/R2/R3 merge SHAs;
- focused test commands and exact results;
- native runner/run IDs when making native claims;
- explicit remaining fixture gaps.

## 6. Exit gate

R4 passes only when:

- every W2-02 prerequisite consumer seam is `HARD PASS` or explicitly permissible `UNVERIFIED/DEFERRED` under the frozen scope;
- no required seam is `BLOCKED`;
- no renderer guess/copy/path reconstruction remains;
- no second durable/query/read/filesystem authority was introduced;
- Read Gate and Preview boundaries are explicitly confirmed, not silently assumed;
- Query V2 selection provenance is safe enough for later source adapters without defining a shared selection runtime;
- CI evidence is tied to the actual trees it names;
- documentation/current truth points to the same dependency graph.

Only then may STATUS/ROADMAP mark W2-02 production dependency-eligible.

## 7. Final report

Return:

1. exact master SHA and worktree state;
2. R1/R2/R3 accepted merge SHAs;
3. the complete seam matrix;
4. Browse result;
5. Thumbnail result;
6. Location result;
7. Read Gate result;
8. Preview Core result;
9. Query V2 selection-provenance result;
10. CI evidence result;
11. native/browser/provider fixture matrix;
12. all `UNVERIFIED`/`DEFERRED` items with reasons;
13. any `BLOCKED` item and required remediation owner;
14. docs/governance validation;
15. explicit `R4 PASS` or `R4 BLOCKED` decision;
16. if PASS, explicit statement that W2-02 is now dependency-eligible but has not started.

STOP after R4 verification. Do not implement W2-02 in the R4 change.