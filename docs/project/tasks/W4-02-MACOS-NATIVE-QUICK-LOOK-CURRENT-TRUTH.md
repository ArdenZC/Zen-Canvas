# W4-02 — macOS Native Quick Look Host — Current-Truth Closeout

Recorded: 2026-08-26

Status: **COMPLETE / CLOSED — MERGED / GOVERNED**

## Production merge record

W4-02 production merge:

`master@8ea647e13882f8cb0e08b77a2953fb06765d1729`

tree:

`f2ab398bf87d162fa1c6ca07f1784ceca259bdda`

PR: #145 — `W4-02: add macOS native Quick Look preview host`

Final PR head before squash merge:

`809a2002067c315784b48a524a815be328d7c953`

Accepted implementation tree:

`f2ab398bf87d162fa1c6ca07f1784ceca259bdda`

Independent exact-head review-of-record:

`#5030646522` — **PASS / blockers = 0**

Hosted CI run-of-record:

`32962219486` — **SUCCESS** on the exact final PR head after the final post-audit PR-tree rerun.

Expected-head squash merge succeeded with:

```text
expected head: 809a2002067c315784b48a524a815be328d7c953
merge SHA:    8ea647e13882f8cb0e08b77a2953fb06765d1729
merge tree:   f2ab398bf87d162fa1c6ca07f1784ceca259bdda
```

The Ready transition was a mechanical GitHub state change after all independent acceptance gates were already satisfied. It did not change the head and did not trigger a replacement acceptance review.

## Initiative truth after closeout

W4 — Native Integration remains **ACTIVE**. W4 itself is not closed by W4-02.

W4-02 — macOS Native Quick Look Host / Strong-native Format Integration is now **COMPLETE / CLOSED**.

The accepted dependency truth is:

- W4-03 v1 Windows request-long shell-`IStream` spike remains **STOPPED / CLOSED WITHOUT MERGE** after Stop Condition #5;
- ADR-0006 capture-before-defer remains the accepted Windows source-lifetime amendment;
- W4-03 v2 Bounded-Capture Spike remains the only authorized Windows implementation Track and is **AUTHORIZED / NEXT**;
- W4-04 Windows Explorer Preview Handler Production Integration remains dependency-gated behind an independently accepted W4-03 v2 result, including real Explorer/prevhost evidence;
- W4-05+ remain downstream-gated by the existing W4 dependency graph;
- W5 Release / Hardening remains **NOT AUTHORIZED / NOT ACTIVE**.

W4-02 completion does not activate W4-05, W4-06, W4-07 or W5 by implication.

## Accepted W4-02 product and architecture

W4-02 is the Zen-internal native Quick Look path for supported **Apple Silicon macOS 13+**. It does not add Intel macOS support and does not create a broad Finder Quick Look Preview Extension.

The merged implementation preserves the frozen W4 authority model:

- `ManagedFile` / `EphemeralBrowse` source identity remains authoritative;
- `ZenFloating` / `ZenPinned` remains the Preview host identity;
- W4-01 Native Preview Access remains the only Zen-owned native staging/access seam;
- `MaterializationReadGate` remains the underlying byte/open/materialization authority;
- the native representation remains host-bound `NativeOpaque` state rather than `MacQuickLookExtension` or a synthetic `HostProvided` source;
- Quick Look opens only a complete private Zen-owned staged snapshot, never the original managed/provider-backed source URL after a checked-once preflight;
- final sourceVersion/current-request authority is revalidated before native publication;
- switch/cancel/close/dispose/failure revokes native ownership before staged artifacts are released;
- over-budget, unavailable, materialization-required, stale and native-failure paths fall back truthfully rather than widening W4-01 limits or using a direct-source escape hatch;
- existing `MacThumbnailService` / Quick Look thumbnail ownership remains separate;
- no renderer-facing raw source or staging path was introduced;
- no Windows Preview Handler, installer/file-association, signing or W5 scope was pulled into W4-02.

The accepted strong-native activation includes real PDF coverage through the native Quick Look view lifecycle on Apple Silicon macOS. Office/iWork/media remain governed by actual runtime capability and evidence rather than extension-name claims.

## Final lifecycle / TOCTOU closure

The final independent audit closed the remaining native-host generation race.

The accepted replacement sequence is:

```text
claim validation
→ begin_replacement()
    snapshots generation + current identity
    does not advance generation
→ native view creation
→ commit_replacement()
    rechecks reservation/current identity
    revalidates the candidate claim
    advances generation only for the successful commit
    replaces the current native owner
```

A stale reservation therefore cannot invalidate a newer valid in-flight native request merely by reaching the reservation stage.

The deterministic A/B/C real-host regression proves the critical ordering:

1. B is the current native owner;
2. A passes its initial claim validation and pauses;
3. A is revoked;
4. C starts and reaches native creation while the generation is still unchanged;
5. A resumes and returns stale without advancing generation or poisoning C;
6. C completes and only its successful commit advances generation and becomes current.

Existing coalescing, detach/retry, native-failure and publication-generation regression coverage remains intact.

## Accepted validation evidence

Final W4-02 validation included:

- `cargo fmt --check`: PASS;
- `git diff --check`: PASS;
- hosted Rust tests: PASS;
- hosted Rust clippy: PASS;
- macOS serial race validation: PASS;
- Apple Silicon native Quick Look lifecycle: PASS;
- Native macOS performance: PASS;
- Windows Rust / native filesystem smoke: PASS in the final post-audit PR-tree attempt;
- Frontend / architecture / browser gates: PASS;
- dependency audit: PASS;
- Windows/macOS release compile: PASS;
- all applicable performance shards and aggregate quality gates: PASS.

The local focused Rust invocation on the final remediation machine was blocked **before test execution** by no free space in the shared `F:\CargoTarget`. It is therefore not recorded as a local PASS or FAIL. Exact-head hosted macOS/native evidence supplied the acceptance evidence instead.

Earlier attempts of hosted run `32962219486` exposed the pre-existing Windows parallel Folder Preview test `file_workspace::integration::folder_preview_tests::stale_folder_a_cannot_publish_after_switch_to_folder_b` with opposite instantaneous shared-scheduler `active_work` count mismatches. The final post-audit rerun on the same exact W4-02 head/tree passed that test and every required gate. No W4-02 production code, benchmark threshold or acceptance criterion changed to obtain the final green result. That cross-test-isolation observation remains separate CI hygiene and is not reclassified as a W4-02 product defect.

## Independent audit record

W4-02 did not close merely because CI was green.

Independent ChatGPT exact-head audit on `809a2002067c315784b48a524a815be328d7c953` rechecked native ownership, source/staging authority, cleanup ordering, publication generation, coalescing/detach/retry behavior and the final A/B/C TOCTOU regression.

Review `#5030646522` records:

**PASS — code/architecture blockers = 0.**

After that audit, the full PR-tree CI dependency chain was rerun on the same exact head. It completed **SUCCESS** before the PR was marked Ready and squash-merged with the expected-head guard.

## Scope preserved at closeout

This closeout does **not**:

- reopen W4-01 Native Preview Access or ReadGate authority;
- activate Finder Quick Look extension ownership;
- activate `MacQuickLookExtension`;
- create `HostProvided` symmetry for Managed/Ephemeral sources;
- widen staging byte/disk/deadline limits to manufacture coverage;
- alter W4-03 v1 Stop Condition #5 or ADR-0006;
- authorize W4-04 before W4-03 v2 acceptance;
- authorize W4-05+ or W5;
- close unrelated technical debt.

W4-02 is therefore **COMPLETE / CLOSED** at the production merge and evidence identities recorded above, while W4 remains active for the independently governed Windows and downstream native-integration Tracks.
