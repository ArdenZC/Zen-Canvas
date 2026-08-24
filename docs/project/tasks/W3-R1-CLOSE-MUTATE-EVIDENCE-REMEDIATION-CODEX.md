# W3-R1 — Close → Mutate Evidence Remediation

Status: **ACTIVE / AUTHORIZED — bounded post-closeout remediation**

Activation baseline: `master@f4b2178f688bdf054c84a9066212d941e60b54a2`; tree `842afd45e64c99b061246cb08dde6ebbdaffa85b` (W3-11 PR #137 squash merge)

Trigger: post-merge Codex review on PR #137, review `#5009168468`, inline blocker `#3844601370`.

Owner: Zen Canvas

## Goal

Repair one evidence-classification defect discovered after W3-11 merged: W3 current truth marked the frozen close/dispose → rename/move/delete/open acceptance criterion `HARD PASS` while permanent-delete evidence remained `UNVERIFIED`.

W3-R1 exists only to make the frozen W3 acceptance criterion and current truth consistent. It is not a new feature Track and does not activate W4.

## Exact blocker

The durable W3 initiative says W3 is complete only when:

> close/dispose releases resources sufficiently for immediate rename/move/delete/open through existing mutation authorities.

W3-10 proved representative rename/move/fresh-open behavior for six byte-provider fixtures on Windows/macOS and proved Folder rename on macOS, but its permanent-delete probe downgraded failure to `UNVERIFIED`. W3-11 then summarized the aggregate criterion as `HARD PASS`.

That summary is not acceptable. Until permanent-delete evidence is proven through an existing authoritative mutation seam, W3 is reopened for this bounded remediation.

## Authority constraints

W3-R1 MUST preserve all existing owners:

- `PreviewSession` / Provider Registry = Preview lifecycle/provider/publication authority;
- `MaterializationReadGate` = byte-read/materialization authority;
- `WorkScheduler` = expensive-work admission authority;
- `BrowseService` = Folder/Browse enumeration authority;
- existing `file_ops` / operation journal / Safe Trash / Restore / fs-safety code = mutation/recovery authority.

W3-R1 MUST NOT:

- add a second mutation API or bypass `file_ops` / fs-safety;
- weaken path, identity, source-claim, quarantine, recovery, or cleanup policy;
- broaden Windows directory mutation merely to make a test green;
- add W4 Finder Quick Look / Explorer Preview Handler work;
- add provider families, schema changes, package-version changes, release/signing work, OCR/AI/RAG/plugin scope;
- rewrite the frozen W3 acceptance criterion.

## Evidence interpretation

### Byte-reading providers

Permanent delete is a required part of the frozen close→mutate gate. The final remediation must produce a deterministic hard assertion through an existing reviewed mutation seam; a failed delete may not be relabeled `UNVERIFIED` while the aggregate gate is `HARD PASS`.

The preferred implementation is the smallest test/performance-harness correction necessary to exercise existing authoritative permanent-delete behavior after Preview disposal. Production mutation semantics should remain unchanged unless the test exposes a real production defect.

### Folder on Windows

W3-10's frozen taskbook separately says Folder must prove temporary Browse/session/page/enumeration/scheduler resources are gone before immediate directory mutation/open **where the platform fixture permits**.

Current Windows `file_ops::validate_source_path` intentionally rejects non-file sources. W3-R1 must not invent Windows directory-mutation authority to satisfy a test. If that existing platform seam remains unavailable, retain an explicit platform-limited `UNVERIFIED`/not-applicable classification for Folder while proving resource release. This does not substitute for the required byte-provider permanent-delete evidence.

## Required production-remediation scope

Expected implementation branch:

`feat/w3-r1-close-mutate-evidence-remediation`

Expected primary implementation file:

- `src-tauri/src/file_workspace/integration/performance/preview.rs`

Additional files may change only if the failing authoritative delete path demonstrates a real correctness defect. If production mutation/fs-safety code must change, stop and document the exact defect before widening scope.

## Required hard evidence

At minimum:

1. Preview reaches useful/ready representation.
2. Preview session is disposed.
3. Browse/read-gate/scheduler/asset baselines are restored.
4. Existing authoritative permanent-delete operation succeeds on a test-owned byte-provider source after disposal.
5. The deleted source is actually absent afterward.
6. A subsequent fresh Preview open succeeds, proving the runtime remains usable after the mutation.
7. Existing representative rename/move/fresh-open matrix remains PASS.
8. macOS Folder directory mutation evidence remains PASS where previously proven.
9. Windows Folder classification remains honest if the existing file-only mutation seam does not permit directory mutation.
10. No new mutation/read/path authority is introduced.

The performance metric must fail hard if the required byte-provider delete does not succeed. It may not emit aggregate `HARD PASS` while delete is `UNVERIFIED`.

## Validation

For the final remediation head run the narrowest relevant checks plus the full routed validation required by the repository, including at minimum:

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

Hosted evidence must include supported Windows and Apple-Silicon macOS lanes that actually execute the Preview Platform performance shard containing the close→mutate gate.

## Reviewer contract

Independent review must verify:

- exact base is the merged W3-R1 activation master;
- delete is a real hard assertion, not a classification downgrade;
- mutation flows through existing authority;
- no production safety boundary was weakened to satisfy the fixture;
- Windows Folder is not falsely called PASS if directory mutation remains unsupported by the existing seam;
- W4 remains inactive;
- fresh exact-head CI is successful.

## Closeout contract

W3 is not COMPLETE/CLOSED while W3-R1 is active.

After W3-R1 production remediation independently passes review and merges, create a separate docs/governance closeout update that:

- records the remediation merge SHA/tree and exact-head evidence;
- resolves the PR #137 blocker;
- changes the close→mutate criterion to `HARD PASS` only if the required permanent-delete evidence truly exists;
- restores `W3 COMPLETE / CLOSED` and `BETWEEN INITIATIVES` only then;
- keeps W4 `NOT AUTHORIZED / NOT ACTIVE`.

## Stop conditions

STOP and return to architecture/reviewer review if:

- permanent delete requires bypassing existing safety or identity checks;
- the failure exposes a real mutation/recovery defect broader than the harness;
- a second mutation authority would be required;
- Windows Folder support would require new production directory-mutation semantics;
- any W4 system-host work is needed;
- the final evidence still contains a required HARD sub-gate classified `UNVERIFIED`.
