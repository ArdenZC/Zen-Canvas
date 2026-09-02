# W4 — Native Integration — Final Current Truth

Status: **COMPLETE / CLOSED**

Last verified: 2026-09-02

## Authority and precedence

This document is the canonical W4 closeout record.

It supersedes earlier W4 status snapshots in `ROADMAP.md`, `STATUS.md`, the W4 initiative page and historical taskbooks **only where those older snapshots conflict with this later current truth**. Historical documents remain provenance and are not rewritten here.

W4-07 starts from:

- `master@788b95e60e3b3683d37b5cedf7cb62c7b399fedb`;
- tree `b58077d295909e95ab52927fa5556b52ac914a70`;
- W4-06 closeout PR #169;
- W4-06 exact-head docs/governance CI `33586760969` SUCCESS.

W4 product/runtime implementation was already frozen by W4-04. W4-05, W4-06 and W4-07 are governance/evidence closeout work and do not reopen that runtime implementation.

## W4 objective — final result

W4 integrated native platform Preview behavior without creating a second Preview architecture or a second source/materialization authority.

Final result:

- shared native-host access is bounded and identity checked;
- macOS has an accepted native Quick Look path for the activated strong-native scope;
- Windows has an accepted production Explorer Preview Handler for the activated text/source extension scope;
- native hosts preserve source-version/current-request authority and stale-publication rejection;
- provider/materialization state remains fail-closed rather than being implicitly hydrated;
- Windows packaging/registration/repair/uninstall behavior is accepted on the final production artifact;
- native performance/resource evidence shows no current regression;
- production signing/notarization is explicitly deferred by product decision;
- manual display/accessibility and unavailable real-provider fixture gaps remain truthfully `UNVERIFIED` rather than fabricated PASS claims.

No active W4 product defect remains.

## W4 sequence

| Track | Final state | Canonical milestone |
|---|---|---|
| W4-00 — activation / architecture freeze | **COMPLETE / CLOSED** | PR #142, `master@994d93b07a2bc3434977de1e16bd1e29b2585983` |
| W4-01 — shared native host bridge | **COMPLETE / CLOSED** | PR #143, `master@02e88db7cf4287e0d68792b3960da503b70d6c56` |
| W4-02 — macOS native Quick Look | **COMPLETE / CLOSED** | PR #145, `master@8ea647e13882f8cb0e08b77a2953fb06765d1729`; reviewed tree `f2ab398bf87d162fa1c6ca07f1784ceca259bdda`; CI `32962219486` SUCCESS |
| W4-03 v1 | **STOPPED / CLOSED WITHOUT MERGE** | PR #146 Stop Condition #5; retained only as provenance |
| ADR-0006 / W4-03 v2 | **COMPLETE / CLOSED** | capture-before-defer amendment; PR #151, `master@55571e6fc4fbd9a9eedc0f474dff28b113072b67`; tree `f357be042c493d0cefd98be8e02d768210ac1f6b`; CI `33008914117` SUCCESS |
| W4-04 — Windows Explorer production integration | **COMPLETE / CLOSED** | PR #159 squash merge `d526eb972f55de42df77946354b8ab79c05152dc`; accepted tree `2b9146eaff9696867c1ba1c5649aec3b8ce831d0`; merge CI `33532586198` SUCCESS |
| W4-05 — signing / packaging / registration integration | **COMPLETE / CLOSED** | packaging/registration inherited from W4-04; signing/notarization deferred by product decision through PR #168, `master@9ea11809fa60732c110d60cce183f2f52c235194` |
| W4-06 — native QA evidence gate | **COMPLETE / CLOSED** | evidence defect count 0; PR #169, `master@788b95e60e3b3683d37b5cedf7cb62c7b399fedb`; CI `33586760969` SUCCESS |
| W4-07 — W4 closeout | **COMPLETE / CLOSED by this record after merge** | docs/governance only; no runtime mutation |

## Final shared native authority

W4 preserves the existing architecture rather than introducing parallel authorities.

Accepted shared rules:

- one existing Provider Registry remains authoritative for source/provider state;
- one existing MaterializationReadGate/source access path remains authoritative;
- native access is identity checked and bounded;
- native staging owns private Zen-managed snapshots rather than exposing original managed/provider-backed paths;
- source/version/current-request authority is revalidated before publication;
- cancel/switch/close/dispose/failure revokes staging/native ownership;
- stale results cannot publish over a newer request;
- resource/staging/captured-memory limits remain bounded;
- no broad implicit hydration/materialization is introduced solely for native Preview;
- native Preview content remains inert: no macro/script execution and no hidden resource-fetch expansion is introduced by the native host path.

## Final macOS native scope

### Supported product truth

- supported baseline: Apple Silicon macOS 13+;
- accepted native host: system Quick Look presentation through the W4-02 native path;
- activated strong-native format scope: **PDF**;
- native host consumes a complete private staged snapshot after one-time authoritative source access;
- original managed/provider-backed URL is not handed to Quick Look after preflight;
- source mutation/version drift before publication fails closed;
- over-budget/unavailable/materialization-required/native-failure cases remain truthful fallback/unavailable states;
- switch/cancel/close/dispose cleanup and repeated resource-baseline behavior are accepted;
- native performance framework and accepted macOS performance lanes remain green.

### Not expanded by W4

Office/iWork/media formats were not promoted into unconditional strong-native support merely to increase coverage. Their behavior remains capability/runtime/evidence driven under existing Preview policy.

### Real-fixture/manual evidence boundaries

The following are **UNVERIFIED**, not PASS and not current product defects:

- genuine iCloud / generic File Provider fixture behavior;
- external/network-volume native fixture behavior;
- Retina/display-scale visual QA;
- multi-display native QA;
- genuine native keyboard/focus interaction;
- VoiceOver;
- preserved human-visible first-useful-frame timing evidence.

## Final Windows native scope

### Accepted production host

- real Windows Explorer Preview Pane;
- x64 Low Integrity `prevhost.exe`;
- production COM Preview Handler;
- `IInitializeWithStream` zero-read initialization;
- bounded `DoPreview` ingress capture with a 512 KiB ceiling;
- shell stream release before deferred rendering;
- stale-generation/publication rejection;
- reusable child-window lifecycle with `SetWindow` / `SetRect` contract;
- controlled focus/accelerator COM behavior;
- source write/rename/move/delete freedom after accepted capture/navigation-away;
- repeated Preview/resource steady-state behavior;
- mapped Preview DLL repair and uninstall while the original Preview host remains alive.

### Production extension association matrix

The final production Preview Handler owns only the accepted 16-extension matrix when the slot is available/exact-owned:

- `.md`
- `.markdown`
- `.rs`
- `.py`
- `.js`
- `.jsx`
- `.ts`
- `.tsx`
- `.java`
- `.c`
- `.h`
- `.cpp`
- `.hpp`
- `.ps1`
- `.sh`
- `.sql`

Foreign/wrong-type ownership is preserved/fail-closed according to the accepted W4-04 authority model.

Windows W4 does not seize stronger PDF/Office/media Preview Handler ownership.

### Final Windows artifact authority

Accepted release-build/run identity:

- release-build `33515469458`;
- Windows artifact ID `9804066036`;
- final installer: `Zen Canvas_0.1.40_x64-setup.exe`;
- installer SHA-256 `5E92A0397F876754F8F3CD06D92BF038364D5D5145DDB04A9EF42A006D973A5D`.

Final accepted runtime evidence includes:

- clean fresh install;
- running-service repair;
- stopped-service repair;
- uninstall/reinstall sanity;
- foreign association preservation;
- foreign same-name service preservation;
- foreign Inproc preservation;
- genuine Explorer Preview;
- x64 Low Integrity Preview host;
- source rename/move/delete release;
- in-use Preview DLL retirement/replacement without host termination;
- Preview after repair;
- uninstall while Explorer/`prevhost.exe` remain alive;
- final product/service/active Preview cleanup;
- Explorer remains responsive after uninstall.

No `taskkill`, Explorer/`prevhost.exe` termination, Low-IL bypass or reboot-for-PASS was required for final acceptance.

### Manual evidence boundaries

The following remain **UNVERIFIED**, not PASS and not current product defects:

- genuine Explorer DPI-transition behavior;
- multi-display Preview Handler behavior;
- full genuine Explorer keyboard/focus traversal;
- Narrator.

## Packaging and signing truth

Final W4 package truth:

- Windows: x64 NSIS engineering package accepted;
- macOS: Apple Silicon DMG engineering package path accepted;
- artifact existence/version/architecture checks remain part of the release pipeline;
- exact-SHA CI provenance, checksums and SBOM generation remain active;
- no public GitHub Release was published by W4.

The project does not currently plan to operate production signing credentials.

Therefore:

- Windows Authenticode: **DEFERRED / NOT PLANNED IN CURRENT HORIZON**;
- Preview Handler trusted production signature: **DEFERRED**;
- Windows installer trusted production signature: **DEFERRED**;
- Apple Developer ID: **DEFERRED / NOT PLANNED IN CURRENT HORIZON**;
- Apple notarization/stapling: **DEFERRED / NOT PLANNED IN CURRENT HORIZON**.

Unsigned engineering artifacts must remain truthfully described as unsigned. W4 does not claim SmartScreen/Gatekeeper/public-distribution reputation acceptance.

## Performance and resource closeout

W4-06 reviewed and reused accepted performance/resource evidence instead of imposing a second performance regime.

Accepted evidence includes:

- Native macOS performance PASS;
- 10,000-entry mixed package corpus;
- 1,000,000-operation identity bookkeeping profile;
- native lifecycle/resource baseline restoration;
- staging/captured-memory capacity/deadline bounds;
- Preview Platform performance routing;
- Windows controlled lifecycle plus genuine Explorer responsiveness/repeated switching.

No current performance/resource regression was demonstrated.

The W4 plan's approximate user-flow latency target is not converted into a new hard CI number without a reviewed interactive measurement method.

## Accessibility/display closeout

W4 does not fabricate interactive accessibility evidence.

The final truth is:

- controlled native lifecycle/focus/window contracts: accepted where documented;
- real VoiceOver: **UNVERIFIED**;
- real Narrator: **UNVERIFIED**;
- listed real DPI/Retina/multi-display/manual keyboard facts: **UNVERIFIED**.

Those evidence boundaries may be revisited in future targeted QA when a real need/fixture exists. They do not represent a demonstrated current defect.

## Defect and debt disposition

At W4 closeout:

- active W4 product defect count: **0**;
- active W4 implementation tracks: **0**;
- W4-04 installer/runtime blockers: **0**;
- W4-06 evidence-detected defects: **0**;
- production signing/notarization: intentionally deferred by product decision;
- manual/provider/display/accessibility gaps: recorded `UNVERIFIED` evidence boundaries.

Historical stopped/remediation attempts remain provenance and do not override this final current truth.

## W5 handoff

After this W4-07 closeout record passes docs/governance validation and merges:

- W4 becomes **COMPLETE / CLOSED**;
- no W4 implementation track remains active;
- W5 becomes **ELIGIBLE FOR A SEPARATE ACTIVATION**;
- W5 is **NOT ACTIVE** merely because W4 closed.

A future W5 activation must start from the exact post-W4-07 master and define its own scope/current-truth contract. It must not assume that signing credentials will become available.

## Final state

```text
W4-00  COMPLETE / CLOSED
  ↓
W4-01  COMPLETE / CLOSED
  ↓
W4-02  COMPLETE / CLOSED
  ↓
W4-03 v1  STOPPED / CLOSED WITHOUT MERGE
  ↓
ADR-0006 + W4-03 v2  COMPLETE / CLOSED
  ↓
W4-04  COMPLETE / CLOSED
  ↓
W4-05  COMPLETE / CLOSED — SIGNING DEFERRED
  ↓
W4-06  COMPLETE / CLOSED — DEFECT COUNT 0
  ↓
W4-07  COMPLETE / CLOSED after this record merges
  ↓
W4  COMPLETE / CLOSED
  ↓
W5  ELIGIBLE FOR SEPARATE ACTIVATION / NOT ACTIVE
```
