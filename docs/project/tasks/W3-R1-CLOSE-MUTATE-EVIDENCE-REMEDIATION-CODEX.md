# W3-R1 — Close → Mutate Evidence Remediation

Status: **COMPLETE / CLOSED — production remediation merged; final governance closeout in progress**

Activation baseline: `master@f4b2178f688bdf054c84a9066212d941e60b54a2`; tree `842afd45e64c99b061246cb08dde6ebbdaffa85b` (W3-11 PR #137 squash merge)

W3-R1 activation merge: `master@5f66e78f021af5d0c3a90d6c87b895c767e7527c`; tree `78b49b3e9d822730cef6fbc37492b4bf69f43bf9` (PR #138 squash merge)

Production remediation merge: `master@e3d7f4c36ff70f0d6def95e739ae11508508a4d1`; tree `ae017ec23241c69f7b33cb1022da5f3a690a1e2a` (PR #140 squash merge)

Final reviewed production head: `32d59594d00a0dc04c9d622250604731ab3b7ef4`; tree `ae017ec23241c69f7b33cb1022da5f3a690a1e2a`

Trigger: post-merge Codex review on PR #137, review `#5009168468`, inline blocker `#3844601370`.

Architecture checkpoint: issue #139 — **RESOLVED / CLOSED** after PR #140.

Owner: Zen Canvas

## Goal

Repair one evidence-classification defect discovered after W3-11 merged: W3 current truth marked the frozen close/dispose → rename/move/delete/open acceptance criterion `HARD PASS` while permanent-delete evidence remained `UNVERIFIED`.

W3-R1 existed only to make the frozen W3 acceptance criterion and current truth consistent. It was not a new feature Track and did not activate W4.

**Result: COMPLETE.** The required permanent-delete evidence now exists on the platform where the product exposes that capability, the Windows capability boundary is explicitly classified rather than silently failed, and the aggregate close→mutate gate is evidence-backed.

## Exact blocker

The durable W3 initiative says W3 is complete only when:

> close/dispose releases resources sufficiently for immediate rename/move/delete/open through existing mutation authorities.

W3-10 proved representative rename/move/fresh-open behavior for six byte-provider fixtures on Windows/macOS and proved Folder rename on macOS, but its permanent-delete probe downgraded failure to `UNVERIFIED`. W3-11 then summarized the aggregate criterion as `HARD PASS`.

That summary was not acceptable. W3-R1 reopened W3 only long enough to repair the evidence and the narrow production defect exposed by the authoritative delete path.

## Architecture checkpoint result

Pre-implementation audit proved that the delete gap was not test-only:

- production `permanent_delete` is an advertised macOS capability and already had an authoritative source-claim/quarantine/identity/recovery implementation;
- the UI/journal value `Permanent deletion quarantine` is a display/journal sentinel, not a filesystem destination;
- macOS pre-journal eligibility incorrectly treated that sentinel as a real target path and rejected the operation before the existing lower authority could run;
- Windows intentionally does not advertise permanent delete (`permanent_delete_available=false`) and the non-macOS lower authority rejects it.

Issue #139 therefore authorized one narrow production correction rather than a second mutation implementation. PR #140 changed only:

- `src-tauri/src/file_ops/journal.rs` — macOS `permanent_delete` preflight now models the operation as source-local, using source + source parent consistently with the existing lower authority;
- `src-tauri/src/file_workspace/integration/performance/preview.rs` — macOS permanent delete became a hard assertion with source-absence + fresh-open proof; non-macOS is explicitly `NOT APPLICABLE` by current product capability.

No source-claim, identity, quarantine, recovery, filesystem-safety, Windows mutation, read/materialization, scheduler, provider, schema or release authority was widened.

## Authority constraints

W3-R1 preserved all existing owners:

- `PreviewSession` / Provider Registry = Preview lifecycle/provider/publication authority;
- `MaterializationReadGate` = byte-read/materialization authority;
- `WorkScheduler` = expensive-work admission authority;
- `BrowseService` = Folder/Browse enumeration authority;
- existing `file_ops` / operation journal / Safe Trash / Restore / fs-safety code = mutation/recovery authority.

W3-R1 did not:

- add a second mutation API or bypass `file_ops` / fs-safety;
- weaken path, identity, source-claim, quarantine, recovery, or cleanup policy;
- broaden Windows directory mutation merely to make a test green;
- add Windows permanent-delete authority that the product does not expose;
- add W4 Finder Quick Look / Explorer Preview Handler work;
- add provider families, schema changes, package-version changes, release/signing work, OCR/AI/RAG/plugin scope;
- rewrite the frozen W3 acceptance criterion.

## Evidence interpretation

### Byte-reading providers

Permanent delete is a required part of the frozen close→mutate gate **where the existing product mutation capability applies**. The final remediation now produces a deterministic hard assertion through the existing reviewed mutation seam on Apple-Silicon macOS; a failed delete can no longer be relabeled `UNVERIFIED` while the aggregate gate is `HARD PASS`.

Windows is different by existing product/runtime contract: `permanent_delete_available=false`. W3-R1 therefore records Windows permanent delete as `NOT APPLICABLE` and does not fabricate a second authority.

### Folder on Windows

W3-10's frozen taskbook separately says Folder must prove temporary Browse/session/page/enumeration/scheduler resources are gone before immediate directory mutation/open **where the platform fixture permits**.

Current Windows `file_ops::validate_source_path` intentionally rejects non-file sources. W3-R1 did not invent Windows directory-mutation authority to satisfy a test. Windows Folder therefore remains explicitly platform-limited where that existing seam does not permit directory mutation. This is separate from the now-closed byte-provider delete evidence gap.

## Production-remediation scope — COMPLETE

Implementation branch:

`feat/w3-r1-close-mutate-evidence-remediation`

Merged production files:

- `src-tauri/src/file_workspace/integration/performance/preview.rs`
- `src-tauri/src/file_ops/journal.rs`

The second file was authorized only after issue #139 documented the real macOS pre-journal correctness defect. No other production file changed in PR #140.

## Required hard evidence — PASS

1. Preview reaches useful/ready representation. **PASS**
2. Preview session is disposed. **PASS**
3. Browse/read-gate/scheduler/asset baselines are restored. **PASS**
4. Existing authoritative permanent-delete operation succeeds on a test-owned byte-provider source after disposal where the product exposes that capability. **PASS — Apple-Silicon macOS**
5. The deleted source is actually absent afterward. **PASS — hard assertion executed on macOS**
6. A subsequent fresh Preview open succeeds, proving the runtime remains usable after the mutation. **PASS**
7. Existing representative rename/move/fresh-open matrix remains PASS. **PASS — rename=3, move=3 on both supported hosted lanes**
8. macOS Folder directory mutation evidence remains PASS where previously proven. **PASS**
9. Windows Folder classification remains honest if the existing file-only mutation seam does not permit directory mutation. **PASS — platform-limited classification retained**
10. No new mutation/read/path authority is introduced. **PASS**

The performance metric now fails hard if macOS permanent delete fails. It cannot emit aggregate `HARD PASS` with a required macOS delete sub-gate `UNVERIFIED`.

## Hosted validation evidence

CI run `32757439487` on exact reviewed PR head `32d59594d00a0dc04c9d622250604731ab3b7ef4` completed `success`.

Validation-plan evidence:

- PR head tree: `ae017ec23241c69f7b33cb1022da5f3a690a1e2a`
- merge-integration tree: `ae017ec23241c69f7b33cb1022da5f3a690a1e2a`
- `tree_equivalent=true`
- `head_validation_required=false`

The same run passed macOS and Windows Rust quality, release compile, routed Preview Platform performance, native Apple-Silicon performance, Performance profile and final platform Quality aggregators.

### Apple-Silicon macOS close→mutate metric

`preview_close_mutate_open_hard_gate` reported:

- aggregate classification: `HARD PASS`
- `platform=macos`
- `delete_attempted=true`
- `delete_capability_available=true`
- `delete_platform_classification=HARD PASS`
- `delete_platform_reason=null`
- `folder_mutation_classification=HARD PASS`
- `rename_successes=3`
- `move_successes=3`
- read-gate/scheduler/preview-asset baselines restored = `true`
- mutation authority = `crate::file_ops::execute_moves_with_persistence`

The test itself completed `ok` after the source-absence assertion and the subsequent fresh Preview open.

### Windows close→mutate metric

`preview_close_mutate_open_hard_gate` reported:

- aggregate classification: `HARD PASS`
- `platform=windows`
- `delete_attempted=false`
- `delete_capability_available=false`
- `delete_platform_classification=NOT APPLICABLE`
- reason = `runtime permanent_delete_available capability is macOS-only`
- `folder_mutation_classification=UNVERIFIED` where the existing file-only directory mutation seam is unavailable
- `rename_successes=3`
- `move_successes=3`
- resource baselines restored = `true`

This is the intended capability classification, not an evidence downgrade.

## Review evidence

Independent exact-head review on PR #140 recorded blockers = 0 for `32d59594d00a0dc04c9d622250604731ab3b7ef4`.

Final Codex review on the same commit reported: `Didn't find any major issues.`

PR #140 then squash-merged with expected-head protection as `master@e3d7f4c36ff70f0d6def95e739ae11508508a4d1`, tree `ae017ec23241c69f7b33cb1022da5f3a690a1e2a`.

Issue #139 is closed as completed.

## Validation contract

The remediation was required to run the narrowest relevant checks plus the full routed validation required by the repository, including at minimum:

```text
cargo fmt --check
focused Preview performance / close-mutate tests
npm run test:performance:pr
npm run test:performance:extended
npm run test:governance
npm run typecheck
npm test
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
git diff --check
git diff --check origin/master...HEAD
```

Hosted evidence included supported Windows and Apple-Silicon macOS lanes that actually executed the Preview Platform performance shard containing the close→mutate gate.

## Reviewer contract — SATISFIED

Independent review verified:

- exact base was the merged W3-R1 activation master;
- delete is a real hard assertion, not a classification downgrade;
- mutation flows through existing authority;
- no production safety boundary was weakened to satisfy the fixture;
- Windows Folder is not falsely called PASS if directory mutation remains unsupported by the existing seam;
- Windows permanent delete is correctly N/A under the existing product capability;
- W4 remains inactive;
- fresh exact-tree-equivalent CI is successful.

## Closeout contract

The production remediation is complete and merged. This separate docs/governance closeout is now authorized to:

- record the remediation merge SHA/tree and exact-head evidence;
- resolve the PR #137 blocker;
- restore the close→mutate criterion to `HARD PASS` based on the actual macOS delete hard evidence plus explicit Windows capability classification;
- restore `W3 COMPLETE / CLOSED` and `BETWEEN INITIATIVES`;
- keep W4 `NOT AUTHORIZED / NOT ACTIVE` and W5 future/inactive.

No W4 implementation or activation is part of this closeout.

## Stop conditions — CLEARED

The final evidence did not require bypassing safety or identity checks, a second mutation authority, Windows directory-mutation semantics, Windows permanent-delete expansion, or any W4 system-host work. The required applicable HARD delete sub-gate is no longer `UNVERIFIED`.
