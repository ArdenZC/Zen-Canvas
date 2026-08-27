# R-FL-01 — Operation Preview Confirmation Integrity & Authoritative Permanent Delete Remediation — Codex / Agent Brief

Status: **AUTHORIZED CORRECTNESS REMEDIATION — PHASE A TASKBOOK / GOVERNANCE FREEZE**

Taskbook PR base: `master@ed79b374fa058d078765cf6394b40e8348d2746c`; tree `3b4c00121de6445ec5e2721ee43762782590b09c`.

Implementation branch: `fix/r-fl-01-operation-preview-confirmation-integrity`

Implementation baseline: **the exact squash-merge commit produced by this R-FL-01 taskbook PR**. This taskbook must not guess a future implementation SHA. After this taskbook merges, the governance owner creates the implementation branch directly from that exact taskbook merge commit.

R-FL-01 is an independently audited correctness remediation. It is not a new initiative, W4 feature expansion, W3 reopening, File Library redesign, technical-debt cleanup wave or release task. The sole active initiative remains **W4 — Native Integration**. W4-04 production implementation is temporarily blocked pending this remediation; the accepted W4-04 product and architecture contract remains frozen.

## 0. Required read set

Before production implementation or review, read completely:

1. [`AGENTS.md`](../../../AGENTS.md)
2. [`docs/project/README.md`](../README.md)
3. [`docs/project/MASTER_DEVELOPMENT_PLAN.md`](../MASTER_DEVELOPMENT_PLAN.md)
4. [`docs/project/STATUS.md`](../STATUS.md)
5. [`docs/project/ROADMAP.md`](../ROADMAP.md)
6. [`docs/project/PRODUCT_MAP.md`](../PRODUCT_MAP.md)
7. [`docs/project/ARCHITECTURE_MAP.md`](../ARCHITECTURE_MAP.md)
8. [`docs/project/DEVELOPMENT_WORKFLOW.md`](../DEVELOPMENT_WORKFLOW.md)
9. [`docs/project/CODE_MAINTAINABILITY.md`](../CODE_MAINTAINABILITY.md)
10. [`docs/project/initiatives/W4-native-integration.md`](../initiatives/W4-native-integration.md)
11. [`docs/project/DECISIONS/0005-native-preview-host-boundary.md`](../DECISIONS/0005-native-preview-host-boundary.md)
12. [`docs/project/DECISIONS/0006-windows-preview-handler-bounded-capture.md`](../DECISIONS/0006-windows-preview-handler-bounded-capture.md)
13. [`docs/project/specs/file-library-preview/04-INFRASTRUCTURE-CONTRACTS.md`](../specs/file-library-preview/04-INFRASTRUCTURE-CONTRACTS.md)
14. [`docs/project/specs/file-library-preview/11-W4-NATIVE-INTEGRATION-IMPLEMENTATION-PLAN.md`](../specs/file-library-preview/11-W4-NATIVE-INTEGRATION-IMPLEMENTATION-PLAN.md)
15. [`docs/project/specs/file-library-preview/12-W4-NATIVE-INTEGRATION-ARCHITECTURE-EXPERIENCE-FREEZE.md`](../specs/file-library-preview/12-W4-NATIVE-INTEGRATION-ARCHITECTURE-EXPERIENCE-FREEZE.md)
16. [`docs/project/tasks/W4-04-WINDOWS-EXPLORER-PREVIEW-HANDLER-PRODUCTION-INTEGRATION-CODEX.md`](W4-04-WINDOWS-EXPLORER-PREVIEW-HANDLER-PRODUCTION-INTEGRATION-CODEX.md)
17. [`docs/project/tasks/W4-03-V2-WINDOWS-PREVIEW-HANDLER-CURRENT-TRUTH.md`](W4-03-V2-WINDOWS-PREVIEW-HANDLER-CURRENT-TRUTH.md)
18. [`docs/project/tasks/W4-03-WINDOWS-PREVIEW-HANDLER-SPIKE-STOP-RESULT.md`](W4-03-WINDOWS-PREVIEW-HANDLER-SPIKE-STOP-RESULT.md)
19. [`docs/security/SUPPORTED_PLATFORMS.md`](../../security/SUPPORTED_PLATFORMS.md)
20. [`docs/security/FILE_IDENTITY_SEMANTICS.md`](../../security/FILE_IDENTITY_SEMANTICS.md)
21. [`docs/security/MACOS_MUTATION_THREAT_MODEL.md`](../../security/MACOS_MUTATION_THREAT_MODEL.md)
22. [`docs/security/TAURI_COMMAND_PERMISSION_MATRIX.md`](../../security/TAURI_COMMAND_PERMISSION_MATRIX.md)

Inspect the current production owners directly during implementation. This taskbook does not authorize production edits during PHASE A.

## 1. PHASE A scope — taskbook and governance freeze only

PHASE A may change only the following paths:

- this R-FL-01 taskbook;
- `docs/project/STATUS.md`;
- `docs/project/ROADMAP.md`;
- `docs/project/initiatives/W4-native-integration.md` only where current-truth consistency requires it.

PHASE A must not modify:

- `src/**`;
- `src-tauri/**`;
- `tests/**`;
- `scripts/**`;
- `package.json`;
- `Cargo.*`;
- `.github/**`;
- installer, schema, permissions, capabilities or production configuration.

This taskbook records the later production contract. It does not implement the remediation, create the implementation branch, run production implementation tests or claim runtime correctness.

## 2. R0 — fail-closed implementation baseline

After this taskbook PR squash-merges, the governance owner creates:

```text
fix/r-fl-01-operation-preview-confirmation-integrity
```

directly from the exact R-FL-01 taskbook squash-merge commit. At production implementation entry, prove all of the following before editing:

```text
current branch == fix/r-fl-01-operation-preview-confirmation-integrity
HEAD == the exact R-FL-01 taskbook squash-merge commit
origin/master == that same commit
working tree == clean
W4-03 v2 production merge 55571e6fc4fbd9a9eedc0f474dff28b113072b67 is an ancestor
W4-04 taskbook/product decisions remain present and unchanged
no unrelated feature branch history or worktree state was imported
```

Use a fresh clean clone or isolated worktree. Do not repair an ambiguous checkout by reset, restore, checkout, clean, stash/drop, rebase, merge or cherry-pick. If any identity, ancestry, scope or cleanliness condition fails, stop and report it.

The implementation baseline is deliberately unresolved until this taskbook PR merges. Do not pre-create the implementation branch and do not write a guessed future SHA into current truth.

## 3. Governance relationship to W4-04

R-FL-01 is a bounded correctness gate between the accepted W4-03 v2 architecture and W4-04 production implementation:

```text
W4-03 v2 COMPLETE / CLOSED
        ↓
R-FL-01 taskbook / governance freeze
        ↓
R-FL-01 production remediation
        ↓
narrow W4-04 execution-baseline amendment
        ↓
W4-04 production implementation may resume
```

The W4 initiative remains the sole active initiative. W4-04 remains authorized in scope but is temporarily **BLOCKED pending R-FL-01 correctness remediation**. W4-05 and later tracks remain downstream-gated. W5 remains **NOT AUTHORIZED / NOT ACTIVE**.

This remediation does not change the W4-04 product or architecture freeze. In particular, it does not change:

- ADR-0006;
- the production CLSID;
- `ThreadingModel`;
- the Prevhost AppID;
- the 512 KiB ingress ceiling;
- the 16-extension production matrix;
- the `SystemFileAssociations` strategy;
- the foreign-handler conflict rule;
- Low IL / normal Preview Handler isolation;
- installer/native product scope;
- real Explorer acceptance requirements.

After the R-FL-01 production remediation is independently reviewed, merged and closed, W4-04 receives a narrow execution-baseline amendment before production implementation resumes. R-FL-01 does not start W4-04 implementation automatically.

## 4. Authority and safety invariants

Preserve the existing authorities:

- Operation Preview remains backend-authoritative;
- the backend-issued `operationFingerprint` remains the confirmation revision authority;
- the existing filesystem/source identity validation remains mandatory;
- the existing `execute_moves` command and authoritative operation resolver remain the mutation entry point;
- the existing operation journal remains the only mutation journal;
- the existing permanent-delete quarantine/source-claim and filesystem-safety implementation remains authoritative;
- Safe Trash, restore and recovery semantics remain unchanged;
- renderer paths, rendered rows, local counts and operation classifications remain non-authoritative;
- no second preview, mutation, journal, recovery, provider, materialization or filesystem authority is introduced.

Confirmation fingerprint validation and physical filesystem identity validation are separate gates. Neither substitutes for the other.

### 4.1 Confirmation fingerprint completeness

The existing backend-issued `operationFingerprint` remains the single confirmation revision identity. It **MUST change whenever any backend-authoritative property that changes the meaning or admissibility of the user's confirmation changes**.

At minimum, the canonical fingerprint payload or an exactly equivalent canonical derivation must represent:

- operation type;
- source;
- target;
- source/provider semantics;
- `risk_level`;
- `requires_confirmation`;
- executable/blocking semantics, wherever those semantics are not already completely represented by the other canonical fields.

The production implementation must prove that a change in each applicable property produces a new backend fingerprint. It must not satisfy this contract by preserving the old fingerprint while adding renderer authority or a parallel consent-version system. If an applicable property is already completely represented by another canonical field, the implementation must document that equivalence and retain the same single backend-issued fingerprint authority.

## 5. P1-A — Operation Preview confirmation integrity

### 5.1 Required Execute selection contract

Every normal authoritative Execute selection must carry the backend-issued fingerprint of the exact preview reviewed by the user:

```json
{
  "id": "preview-id",
  "fileId": "file-id",
  "operationFingerprint": "backend-issued-fingerprint",
  "expectedRevision": "backend-issued-fingerprint",
  "newName": "optional-user-name"
}
```

For this remediation:

```text
expectedRevision == operationFingerprint
```

`operationFingerprint` and `expectedRevision` are required for executable requests. Missing or empty fingerprints are not backward-compatible requests and must fail closed.

The Execute IPC must continue to exclude renderer authority for:

- `sourcePath`;
- `targetPath`;
- `operationType`;
- `risk`;
- `isExecutable`;
- `strategy`;
- conflict policy.

An explicit validated `newName` remains the only user-editable operation parameter in this contract.

### 5.2 Whole-batch backend admission gate

Before any journal creation, journal mutation admission or filesystem mutation:

1. resolve the current authoritative preview candidate for every requested selection;
2. prove the resolved preview ID equals the requested preview ID;
3. prove the resolved file ID equals the requested file ID;
4. read or recompute the current authoritative `operationFingerprint`;
5. prove `request.operationFingerprint == current.operationFingerprint`;
6. prove `request.expectedRevision == request.operationFingerprint`;
7. perform the existing indexed/filesystem identity validation;
8. normalize and validate any explicit `newName`;
9. only then construct the canonical `OperationPreviewRequest`;
10. only after the entire batch passes, admit operations to the existing journal/mutation pipeline.

The whole requested batch is one stale-consent admission unit. If 19 selections are current and one is stale, reject all 20 before any journal admission or filesystem mutation. Do not partially execute the 19 current operations.

A fingerprint mismatch returns a stable stale-preview error/token:

```text
operation_preview_stale
```

No journal row may be created for a rejected stale request. No filesystem mutation may begin.

### 5.3 Consent identity and edited filename semantics

The canonical operation fingerprint binds the backend operation and target semantics. It does not turn renderer input into operation authority.

```text
effective confirmation identity
  = canonical operationFingerprint
  + explicit validated user filename override
```

An unchanged canonical operation plus a valid normalized `newName` is allowed. A changed canonical target parent, operation type, source semantics or provider semantics makes the old fingerprint stale, even if the submitted `newName` is valid.

The backend owns filename normalization, invalid-name rejection and safety validation.

### 5.4 Stale confirmation UX

When Execute returns `operation_preview_stale`, the renderer must:

1. refresh or reload the relevant authoritative Operation Preview;
2. visibly explain that the operation changed;
3. require the user to inspect and explicitly confirm the new preview again.

The renderer must not refresh and automatically retry execution. The prior confirmation is invalid after a stale result.

## 6. P1-B — authoritative Permanent Delete Preview

### 6.1 Backend acquisition seam

Add one narrow backend command/API for an explicit user Permanent Delete intent, conceptually:

```text
get_permanent_delete_operation_preview(fileId)
```

It returns an ordinary backend-authoritative `OperationPreview` DTO and does not execute deletion.

The backend must determine:

- the current indexed file;
- the current authoritative source path and identity eligibility;
- runtime permanent-delete capability;
- platform eligibility;
- operation type;
- risk;
- confirmation requirement;
- executable or blocking status;
- operation fingerprint;
- backend-generated preview ID.

The renderer must not synthesize any of these values.

### 6.2 Platform capability truth

Preserve the existing fine-grained capability contract:

- supported macOS runtime may expose Permanent Delete when the current backend eligibility allows it;
- Windows `permanent_delete_available` remains false;
- unsupported or unavailable runtime/platform returns the existing stable unsupported capability result;
- test symmetry must not expand Windows Permanent Delete capability.

### 6.3 Permanent Delete preview identity

The backend-generated Permanent Delete preview ID must be:

- backend-owned;
- deterministic;
- file-bound;
- intent-distinct;
- non-colliding with ordinary organization/suggestion preview identity.

Do not use or preserve the renderer scheme:

```text
permanent-delete-${fileId}
```

The renderer must not generate, parse or treat this ID as execution authority.

### 6.4 Existing execution and recovery path

Permanent Delete must continue through the existing path:

```text
authoritative preview resolution
→ fingerprint-bound execute_moves admission
→ existing operation journal
→ existing permanent-delete quarantine/source claim
→ existing filesystem-safety identity checks
→ durable outcome / existing recovery semantics
```

On a supported macOS runtime with an eligible current source, the authoritative Permanent Delete preview must be executable rather than permanently blocked. The implementation must prove one positive end-to-end confirmation using the exact current backend fingerprint reaches the existing journal/quarantine path, completes Permanent Delete, records the durable outcome and leaves the source absent. Preview acquisition alone is not sufficient P1-B acceptance evidence.

Do not introduce:

- `execute_permanent_delete_now`;
- `delete_file_directly`;
- a second delete executor;
- a second delete journal;
- a second recovery ledger;
- renderer filesystem execution;
- renderer operation-type authority.

### 6.5 Execute resolution remains operation-type-free

The Execute IPC must not add an `operationType` field. The backend resolves each requested `fileId` plus `previewId` against the current authoritative preview candidates, including the ordinary Operation Preview and the explicit Permanent Delete preview where applicable. Only a backend-regenerated candidate that matches the requested preview identity may proceed to the fingerprint gate. Renderer classification must not select the executor or bypass the backend preview authority.

## 7. Renderer product flow

Library Permanent Delete must become:

```text
user selects Permanent Delete
→ request backend-authoritative Permanent Delete preview
→ populate the existing Operation Preview UI
→ user reviews the returned preview
→ user explicitly confirms
→ normal executeSelected
→ fingerprint-bound execute_moves admission
```

The local runtime capability check may remain as a UX affordance. It is not execution authority.

If backend preview acquisition fails:

- do not open an executable Operation Preview;
- do not fabricate a fallback preview;
- surface the stable backend error.

Remove executable Permanent Delete preview fabrication from `LibraryMode`. The normal Operation Preview UI and normal Execute route remain the only user confirmation path.

## 8. Allowed production implementation surface after PHASE A

The later implementation may consider only the smallest coherent changes in existing owners, including:

- `src/types/domain.ts`;
- `src/api/operationApi.ts`;
- `src/store/operationQueue/operationExecutionController.ts`;
- `src/views/fileLibrary/library/LibraryMode.tsx`;
- `src/api/browserMockApi.ts`;
- `src-tauri/src/file_ops/types.rs`;
- `src-tauri/src/file_ops/authority.rs`;
- the existing authoritative Operation Preview construction owner;
- existing Tauri command registration and permission files only if the narrow API requires them;
- focused tests and existing browser-mock contract surfaces only where required for deterministic coverage.

This list is not permission to expand authority, add schema, change platform capability or redesign File Library. Any additional production path requires explicit scope review.

## 9. HARD implementation test matrix

The later production implementation must prove at minimum:

| ID | Required proof |
| --- | --- |
| T1 | Exact backend fingerprint executes successfully. |
| T2 | Changed target rejects the old confirmation with `operation_preview_stale`, zero journal admission and zero mutation. |
| T3 | Changed operation type rejects the old confirmation. |
| T4 | Changed source/provider semantics rejects the old confirmation. |
| T5 | Missing or empty fingerprint fails closed. |
| T6 | `expectedRevision != operationFingerprint` fails closed. |
| T7 | A batch with 19 current selections and 1 stale selection rejects as a whole with zero mutations. |
| T8 | Valid user `newName` with unchanged canonical operation is allowed after backend normalization/validation. |
| T9 | Valid `newName` with changed canonical target is rejected as stale. |
| T10 | Authoritative Permanent Delete preview has a backend-owned deterministic intent-distinct ID, `permanent_delete` operation type, `Sensitive` risk, confirmation required and non-empty fingerprint. |
| T11 | Stale Permanent Delete confirmation is rejected and the source remains present. |
| T12 | Unsupported platform/runtime returns no authoritative Permanent Delete preview and no renderer fallback. |
| T13 | Execute IPC contains no `sourcePath`, `targetPath`, `operationType`, `risk`, `isExecutable` or `strategy` authority. |
| T14 | Existing provider materialization/fingerprint flow remains green. |
| T15 | Independently prove both risk-only and confirmation-only changes invalidate old consent: same file/source/target/operation with only `risk_level` changed produces a new fingerprint, and the old fingerprint is rejected with `operation_preview_stale` and zero side effects; repeat independently with only `requires_confirmation` changed and the same rejection/zero-side-effect proof. |
| T16 | On supported macOS with an eligible source, a current backend-authoritative Permanent Delete preview is executable; submitting its exact `operationFingerprint`/`expectedRevision` through normal `execute_moves` succeeds through the existing journal and quarantine/source-claim path, records the durable successful outcome, removes the source, and does not use any second delete executor or renderer path/type authority. |

Tests must also prove that rejected stale batches create no journal rows, begin no filesystem work and do not trigger automatic retry.

T15 is not satisfied by one combined mutation or by observing only a changed UI field. The two cases must independently prove that the backend-issued fingerprint changes and that Execute admission using the corresponding old fingerprint fails closed before journal creation or filesystem work.

T16 is a positive-path acceptance requirement distinct from T10 preview acquisition and T11 stale rejection. A backend that always returns Permanent Delete as blocked, or a resolver that rejects every current valid Permanent Delete preview, fails R-FL-01 even if all negative tests pass.

## 10. Stop conditions

The production implementation must stop and report instead of forcing completion if the repair appears to require:

1. renderer source-path authority;
2. renderer operation-type, risk, strategy or capability authority;
3. bypassing authoritative Operation Preview resolution;
4. bypassing the existing operation journal;
5. a new permanent-delete executor;
6. a new mutation/recovery ledger;
7. schema changes;
8. weaker physical filesystem identity checks;
9. partial execution after stale batch admission;
10. automatic retry after stale consent;
11. Windows Permanent Delete capability expansion;
12. W4 Preview Handler architecture changes;
13. a second Preview, provider, materialization, filesystem mutation or recovery authority.

## 11. PHASE A validation and delivery

PHASE A is docs/governance-only. Run only the applicable checks:

```text
npm run test:docs
npm run test:governance
git diff --check
git diff --check origin/master...HEAD
```

For local `npm run test:docs`, set `DOCS_DIFF_BASE=origin/master` and `DOCS_DIFF_HEAD=HEAD` because the repository script requires an explicit documentation diff base. Do not run unrelated production, browser, Rust, performance, package or native implementation suites merely to manufacture evidence for work not yet implemented.

Before commit, prove:

- changed files are limited to the PHASE A allowlist;
- no source/docs conflict markers were introduced;
- the taskbook does not guess a future implementation SHA;
- current truth names W4 as the sole active initiative;
- W4-04 is explicitly temporarily blocked pending R-FL-01;
- frozen W4-04 product/architecture decisions remain unchanged;
- W5 remains not authorized/not active.

Create one focused docs commit:

```text
docs(file-library): freeze operation confirmation remediation
```

Push only:

```text
docs/r-fl-01-operation-preview-confirmation-integrity
```

Open one docs-only PR against `master`:

```text
R-FL-01: freeze operation preview confirmation remediation
```

Keep the PR docs/governance-only and **Draft**. Do not merge it, do not mark it ready, do not create `fix/r-fl-01-*`, and do not begin production implementation after opening it.

## 12. PHASE B — production implementation and acceptance contract

PHASE B may begin only after the PHASE A taskbook PR is independently accepted and merged. The governance owner must then create `fix/r-fl-01-operation-preview-confirmation-integrity` from the exact PHASE A taskbook squash-merge commit and record its exact commit and tree. No other baseline is valid.

### 12.1 Production local validation

The implementation branch must run and record the following local validation, plus all focused R-FL-01 tests required to prove T1–T16:

```text
npm run typecheck
npm test
npm run test:remediation
npm run test:performance:architecture
npm run build:frontend

cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --features desktop-runtime
cargo clippy --manifest-path src-tauri/Cargo.toml \
  --features desktop-runtime \
  --all-targets -- -D warnings

npm run security:audit
npm run security:audit:rust

npm run test:docs
npm run test:governance

git diff --check
git diff --check origin/master...HEAD
```

Local success is evidence for the exact local implementation head only. It does not replace independent review, exact-head hosted CI or required native/platform evidence.

### 12.2 Implementation Draft PR contract

Production implementation must be submitted as one PR from the exact PHASE A taskbook merge baseline. That implementation PR must remain **Draft** until independent review is complete. It must not be marked ready, merged or used to advance W4-04 while required acceptance evidence is pending.

### 12.3 Independent exact-head review

An independent reviewer, separate from the implementation author and separate from Codex Review, must review the exact production PR head. The review record must include:

- reviewed commit SHA;
- reviewed tree SHA;
- blockers count;
- disposition for every P1-A/P1-B requirement and T1–T16 proof.

Codex Review **MUST NOT** be used as the independent acceptance gate for this remediation.

### 12.4 Blockers-zero requirement

The independent review must explicitly record `blockers = 0`. Any blocker, unresolved stop condition, missing required test proof or authority-boundary violation keeps the implementation PR Draft and blocks hosted exact-head CI and merge acceptance.

### 12.5 Exact-head hosted CI after independent review

Only after the independent review records `blockers = 0` may final hosted CI be run for the exact reviewed production head. The acceptance record must include the reviewed SHA, reviewed tree and hosted CI run ID, and all required hosted jobs must report `SUCCESS` for that exact head.

### 12.6 Review and CI invalidation after later production changes

Any later production-code change after the reviewed head invalidates both the independent review and exact-head hosted CI evidence. The implementation must then receive a fresh independent review and fresh hosted CI run on the new exact head. A stale successful run or a tree-equivalent claim is not a substitute for exact-head evidence unless the applicable current governance contract explicitly records that equivalence.

### 12.7 Squash merge with expected-head protection

Merge is permitted only when both conditions hold:

```text
independent review blockers == 0
AND
exact-head hosted CI == SUCCESS
```

Use squash merge with expected-head protection. If the PR head changes, the expected-head check must fail closed and the review/CI gates must be restarted. Do not force-update `master`, bypass branch protection, or merge a different head from the one reviewed and tested.

### 12.8 Production current-truth closeout

After the production PR is merged, create and merge an R-FL-01 current-truth closeout record before any W4-04 baseline amendment. The closeout must record:

- the PHASE A taskbook merge SHA and tree;
- the production PR number and URL;
- the final independently reviewed production head and tree;
- the exact-head hosted CI run and result;
- the production squash-merge SHA and tree;
- the final P1-A disposition;
- the final P1-B disposition;
- any explicitly unverified or deferred evidence.

The closeout must update the applicable current-truth records without rewriting historical provenance.

### 12.9 R-FL-01 COMPLETE/CLOSED definition

R-FL-01 is **COMPLETE / CLOSED** only when the production implementation has merged at the independently reviewed exact head, exact-head hosted CI is successful, all required T1–T16 and platform evidence is recorded, the current-truth closeout is merged, and P1-A/P1-B have final dispositions with no open blockers or unresolved stop conditions. A production merge alone does not constitute completion.

### 12.10 W4-04 baseline amendment only after closeout

Only after R-FL-01 is COMPLETE / CLOSED may the governance owner amend the W4-04 execution baseline. That amendment must point W4-04 to the exact post-closeout `master` baseline and must preserve the frozen W4-04 architecture and product decisions. W4-04 production implementation must not begin from an earlier taskbook, pre-created branch or unreviewed R-FL-01 head.

## 13. Required PR and closeout report

The PHASE A PR description/report must include:

- exact base SHA/tree: `ed79b374fa058d078765cf6394b40e8348d2746c` / `3b4c00121de6445ec5e2721ee43762782590b09c`;
- fresh-clone R0 evidence;
- changed-file list and docs-only scope;
- the two independently audited P1 defects;
- authority and compatibility paths preserved;
- W4-04 temporarily blocked, not redesigned;
- unchanged ADR-0006 and frozen W4-04 product/architecture decisions;
- implementation branch name `fix/r-fl-01-operation-preview-confirmation-integrity`;
- implementation baseline described only as the exact squash-merge commit produced by this taskbook PR;
- validation commands and exact results;
- final commit SHA/tree;
- PR number, URL, base, head and state;
- explicit statement that production implementation has not started.

After reporting the PR number/head SHA/tree/state, stop. The next action requires an independent governance/review decision and a fresh implementation-baseline preflight.
