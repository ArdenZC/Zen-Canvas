# W4-06 — Native Accessibility / DPI / Performance / Resource QA — Current Truth

Status: **COMPLETE / CLOSED — EVIDENCE RECONCILED, NO CURRENT DEFECT**

Last verified: 2026-09-02

## Baseline

W4-06 was activated from:

- `master@9ea11809fa60732c110d60cce183f2f52c235194`;
- tree `d91e018a25796155660e294e8886976f2bb2dd3b`;
- W4-05 no-sign closeout / W4-06 activation PR #168.

The detailed evidence matrix is recorded in:

[`W4-06-NATIVE-QA-EVIDENCE-GAP-AUDIT.md`](W4-06-NATIVE-QA-EVIDENCE-GAP-AUDIT.md).

## Completion result

W4-06 closes as an evidence-integration gate, not as a new implementation track.

The audit found:

- **0 current product defects**;
- no reason to reopen W4-04 installer/registration/runtime behavior;
- no reason to change the W4-02 macOS native host;
- no reason to change the W4-03 v2 Windows capture/COM architecture;
- no reason to introduce new performance thresholds merely to manufacture fresh evidence;
- no reason to add signing/notarization work deferred by W4-05.

No product source, workflow, installer, schema, package configuration or test implementation change is required for W4-06 closure.

## Accepted native QA facts

### macOS

Accepted existing evidence covers:

- Apple Silicon native execution and macOS supported baseline;
- native Quick Look lifecycle for the accepted PDF strong-native scope;
- complete Zen-owned private staging rather than original managed/provider URL handoff;
- source-version/current-authority revalidation;
- stale/mutated-source rejection before publication;
- bounded acquisition/staging/capacity/deadline behavior;
- truthful over-budget/unavailable/materialization-required handling;
- switch/cancel/close/dispose cleanup;
- repeated lifecycle/resource baseline recovery;
- native performance framework, including the accepted mixed package corpus and identity bookkeeping profile;
- inert/fail-closed provider/read semantics;
- no implicit cloud hydration from the native Preview path.

### Windows

Accepted existing evidence covers:

- genuine Explorer Preview Pane on the accepted production artifact;
- normal x64 Low Integrity `prevhost.exe` hosting;
- `Initialize → DoPreview → Unload` and repeated handler lifecycle;
- zero-read `Initialize`;
- bounded 512 KiB capture-before-defer ingress;
- shell stream release before deferred rendering;
- source write/rename/move/delete freedom after capture/navigation-away;
- child-window `SetWindow` / `SetRect` and controlled focus/accelerator contracts;
- repeated resource steady-state behavior;
- mapped Preview DLL repair/uninstall while the original Preview host remains alive;
- final 16-extension production association matrix;
- corrupt/unsupported/unavailable/fallback semantics;
- no current useful-render/resource regression in accepted controlled/performance/real-Explorer evidence.

### Shared

Accepted evidence preserves:

- inert content behavior with no macro/script execution;
- no hidden native-host network-resource fetch;
- no broad implicit hydration/materialization;
- bounded handles/streams/assets/staging/captured memory;
- stale publication rejection;
- truthful unsupported/partial/terminal states;
- one existing Provider Registry / ReadGate / source authority topology;
- exact evidence identity for accepted W4 platform work;
- no W5 spillover.

## Explicitly unverified — not failures

W4-06 does **not** claim PASS for manual or fixture-dependent facts that were not genuinely executed.

The following remain explicit evidence boundaries:

### macOS

- real Retina/display-scale visual QA;
- multi-display native movement/resizing;
- genuine native keyboard/focus interaction;
- VoiceOver;
- human-visible first-useful-frame timing record;
- genuine iCloud / generic File Provider fixture;
- external/network-volume native fixture.

### Windows

- genuine Explorer DPI-transition QA;
- multi-display Preview Handler QA;
- full real Explorer keyboard/focus traversal;
- Narrator.

No failing observation exists for those rows. They remain **UNVERIFIED**, not PASS and not DEFECT.

This disposition is intentional and follows the W4-06 activation contract, which explicitly rejects treating hosted compile/test as manual accessibility/display proof and permits fixture/manual facts to remain truthful at closeout.

## Performance/resource disposition

W4-06 reuses accepted performance/resource evidence rather than creating a new threshold regime.

Relevant accepted evidence includes:

- W4-02 Native macOS performance PASS;
- 10,000-entry mixed package corpus and 1,000,000-op identity bookkeeping profile;
- native Preview lifecycle/resource baseline tests;
- W4-03/W4-04 Windows controlled lifecycle and genuine Explorer repeated switching/source-release evidence;
- Preview Platform performance routing;
- scheduler/native staging/captured-memory bounds.

No current regression was demonstrated.

The approximate `<=1 s` user-flow target in the W4 implementation plan is not converted into a newly invented hard CI threshold without a reviewed real interactive fixture/timing method.

## Accessibility disposition

Manual accessibility evidence is intentionally not fabricated.

- VoiceOver: **UNVERIFIED**.
- Narrator: **UNVERIFIED**.
- genuine native keyboard/display cross-host QA: partially covered at contract level, manual host evidence remains **UNVERIFIED** where listed above.

These are carried as residual evidence boundaries for future targeted QA when appropriate, not as blockers to the already accepted native architecture/product integration.

## Fixture disposition

The project does not manufacture fake cloud/provider/external-volume fixtures to turn an unavailable environment into a PASS.

Existing genuine-fixture gaps remain:

- iCloud/File Provider;
- external/network-volume native cases.

Runtime behavior remains fail-closed where identity/materialization/availability cannot be proven.

## Code-change decision

W4-06 authorizes **no product remediation** because no reproducible current defect was found.

Do not create a Codex implementation track merely to eliminate `UNVERIFIED` labels.

If a future genuine host run demonstrates an actual defect, it should be handled as a narrow remediation against the then-current product baseline rather than retrospectively reopening the entire W4-06 matrix.

## Exit gate

W4-06 is **COMPLETE / CLOSED** because:

1. every W4-06 audit row has an explicit disposition;
2. accepted functional/resource evidence is reconciled to exact W4 authority records;
3. no current supported-platform defect is demonstrated;
4. manual/fixture gaps remain truthfully `UNVERIFIED`;
5. no arbitrary new performance threshold is introduced;
6. W4-02/W4-03/W4-04 closed architecture/product tracks remain closed;
7. production signing/notarization remains deferred by W4-05;
8. only W4-07 W4 Closeout remains downstream.

## Sequencing

W4-07 — **W4 Closeout** is authorized next as a docs/governance-only track.

W4-07 must summarize final W4 runtime merge baselines, supported native host/format matrix, packaging/signing truth, accepted evidence, and residual `UNVERIFIED` boundaries.

W5 remains **NOT AUTHORIZED / NOT ACTIVE** until W4-07 is separately completed and accepted.
