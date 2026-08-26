# W4 — Native Integration Implementation Plan

Status: **W4-00 architecture / sequencing freeze + ADR-0006 Windows amendment; W4-01, W4-02 and W4-03 v2 complete; W4-04 authorized next**

Activation baseline: `master@43da96b89a7fe99908198b4b7dfeff3fc3bd686e`

Current W4 production baseline: `master@55571e6fc4fbd9a9eedc0f474dff28b113072b67`; tree `f357be042c493d0cefd98be8e02d768210ac1f6b` (PR #151 W4-03 v2).

Authority: [`../../initiatives/W4-native-integration.md`](../../initiatives/W4-native-integration.md)

Architecture decisions:

- [`../../DECISIONS/0005-native-preview-host-boundary.md`](../../DECISIONS/0005-native-preview-host-boundary.md)
- [`../../DECISIONS/0006-windows-preview-handler-bounded-capture.md`](../../DECISIONS/0006-windows-preview-handler-bounded-capture.md)

W4-02 current-truth closeout:
[`../../tasks/W4-02-MACOS-NATIVE-QUICK-LOOK-CURRENT-TRUTH.md`](../../tasks/W4-02-MACOS-NATIVE-QUICK-LOOK-CURRENT-TRUTH.md)

W4-03 v1 stop evidence:
[`../../tasks/W4-03-WINDOWS-PREVIEW-HANDLER-SPIKE-STOP-RESULT.md`](../../tasks/W4-03-WINDOWS-PREVIEW-HANDLER-SPIKE-STOP-RESULT.md)

W4-03 v2 current-truth closeout:
[`../../tasks/W4-03-V2-WINDOWS-PREVIEW-HANDLER-CURRENT-TRUTH.md`](../../tasks/W4-03-V2-WINDOWS-PREVIEW-HANDLER-CURRENT-TRUTH.md)

## 1. Objective

W4 connects the completed W3 Preview Platform to native macOS and Windows preview surfaces without replacing PreviewSession, Provider Registry, MaterializationReadGate, WorkScheduler, source identity, mutation or recovery authorities.

The Wave should deliver native value, not superficial cross-platform symmetry.

ADR-0006 revises only the Windows Preview Handler source-lifetime portion of the original W4 freeze. The Windows shell `IStream` is an ingress-only source for a strictly bounded `DoPreview` capture; deferred work uses Zen-owned immutable memory and does not retain the original stream or a shell file handle. W4-03 v2 has now proved that architecture; W4-04 owns its production Explorer association/productization.

## 2. Entry truth

W4 starts only after W3 closes at `master@43da96b89a7fe99908198b4b7dfeff3fc3bd686e`.

At entry:

- W3 Floating/Pinned Preview hosts are complete;
- Text/Code/Markdown/Structured/Table/Image/Folder/ZIP providers are production-composed;
- native host enum values exist but fail closed;
- `PreviewSourceRef::HostProvided` exists but is not a usable native request registry yet;
- macOS Quick Look support is thumbnail-only and `PREVIEW_AVAILABLE=false`;
- the existing Read Gate re-resolves/revalidates at every actual byte read and does not treat prior eligibility as durable authorization;
- Windows has no native Preview Handler subsystem;
- Windows packaging is per-machine NSIS with an existing installer-hook authority;
- macOS packaging is DMG, macOS 13+, hardened runtime;
- W5 is inactive.

Since activation, W4-01, W4-02 and W4-03 v2 have completed. W4-02 merged through PR #145 at `master@8ea647e13882f8cb0e08b77a2953fb06765d1729`. W4-03 v1 independently produced Stop Condition #5 and was closed without merge. ADR-0006 replaced that rejected request-long stream topology, and W4-03 v2 then merged through PR #151 at `master@55571e6fc4fbd9a9eedc0f474dff28b113072b67`, proving capture-before-defer through controlled Windows-native CI and real Explorer/prevhost evidence. PR #148's `db192a541e9bdabcf581f9dce57be8efff39c8e2` remains Windows governance provenance, not the current master head.

## 3. Dependency graph

```text
W4-00  Activation + Native Architecture / Experience Freeze       ✅ PR #142
  ↓
W4-01  Shared Native Host Bridge + HostProvided Source Contract   ✅ PR #143
  ↓
 ┌──────────────────────────────────┬───────────────────────────────────────────────┐
 ↓                                  ↓
W4-02 macOS Native Quick Look     W4-03 v1 request-long IStream spike
      Host / Strong-native              STOPPED / PR #146 closed-no-merge
      Format Integration ✅ PR #145              ↓
                                          ADR-0006 ✅ PR #148 provenance
                                                 ↓
                                      W4-03 v2 bounded-capture spike
                                           ✅ COMPLETE / PR #151
                                                 ↓
                                      W4-04 Windows Explorer Handler
                                           AUTHORIZED / NEXT
 └───────────────────┬──────────────────────────────────────────────────────────────┘
                     ↓
W4-05  Signing / Packaging / Registration Integration
  ↓
W4-06  Native Accessibility / DPI / Performance / Resource QA
  ↓
W4-07  W4 Closeout
```

### Parallelization rule

- W4-01 is complete; both platform branches inherit its reviewed native representation/resource boundary, while only shell-owned requests depend on the `HostProvided` source contract.
- W4-02 is complete / closed through PR #145 and remains independent of the rejected W4-03 v1 stream-lifetime model.
- W4-03 v1 is stopped; it is architecture evidence, not a merge dependency.
- W4-03 v2 is complete / closed through PR #151 under ADR-0006, including real Explorer/prevhost evidence.
- W4-04 is now the only authorized Windows implementation Track and must productize the accepted v2 architecture rather than reopen it.
- W4-05 packaging preparation may proceed alongside platform work only where artifact/registration shapes are already frozen; final package acceptance waits for the accepted platform outputs and is not activated by this closeout.
- W4-06 is an integration gate over the merged platform/package result, including native manual evidence not fully owned by W4-02/W4-03.
- W4-07 is docs/governance closeout only after all accepted W4 runtime work merges.

## 4. Track contracts

### W4-00 — Activation + Architecture / Experience Freeze

Type: docs/governance only.

Deliver:

- active W4 initiative;
- ADR-0005 native-host boundary;
- this implementation plan;
- architecture/experience freeze;
- current-truth updates;
- exact docs-only validation.

Must not change production source, package/config, workflow, schema or installer behavior.

Exit:

- W4 is the sole active initiative;
- W4-01 is NEXT and uniquely authorized for production implementation;
- W5 remains inactive.

ADR-0006 is a later evidence-triggered Windows amendment to this freeze; it does not reopen the accepted macOS or shared W4-01 authority model.

### W4-01 — Shared Native Host Bridge

Goal: prove the minimum native representation/resource seam, authoritative native-access staging contract, and separate shell-owned `HostProvided` source lifecycle before either platform UI Track begins.

W4-01 has **two source-ownership paths** and must preserve their distinction.

#### A. Zen-owned in-app native-backed path

This path is consumed later by W4-02.

Required outcomes:

1. existing `ManagedFile` / `EphemeralBrowse` source identity and sourceVersion remain authoritative;
2. existing `ZenFloating` / `ZenPinned` host identity remains authoritative;
3. host-bound `NativeOpaque` representation ownership/lifetime is explicit for the matching Zen host;
4. introduce one bounded process-local **Native Preview Access registry/lease** bound to Preview session/request/sourceVersion/host;
5. native-access acquisition performs fresh authoritative eligibility/identity validation and obtains source bytes through the existing identity-checked open/read boundary rather than a path-copy after preflight;
6. native access produces a complete private Zen-owned staging snapshot and performs final sourceVersion/freshness revalidation before allowing `NativeOpaque` publication;
7. stale/changed/terminal/over-budget acquisition deletes/discards staging and publishes no native representation;
8. source switch/cancel/dispose/failure/expiry releases native representation/view/staging state without creating a `HostProvided` source;
9. stale publication remains rejected by existing PreviewSession request/sourceVersion authority;
10. no original managed/provider-backed source URL becomes the Quick Look input contract.

W4-01 does not need to activate final Quick Look UI, but it must make the access/staging lifecycle testable without that UI.

#### B. OS/shell-owned HostProvided path

This path is consumed by W4-03/W4-04 and by a future Finder Preview Extension only if separately authorized.

Required outcomes:

1. strict bounded backend/native registry for `HostProvided` request tokens;
2. explicit shell request owner + activated native host kind + source/freshness state;
3. bounded create/resolve/cancel/unload/revoke lifecycle;
4. stale/unknown/reused token fail-closed behavior;
5. bounded host-provided read adapter with no generic renderer path/read authority;
6. tests proving no host token survives unload/revoke and shell-owned resources return to baseline.

A shell-supplied stream is the incoming request source; do not resolve it back into a guessed filesystem path merely to reuse in-app staging.

ADR-0006 clarifies the Windows consumer of this contract: the original Explorer `IStream` does not remain the backing object for the entire HostProvided request. W4-03 v2 performs a bounded ingress capture, releases the stream, then backs HostProvided with a Zen-owned immutable memory source for deferred work.

#### Shared outcomes

1. provider/representation logic may be reused without forking a second production provider truth;
2. native representation/asset/access ownership rules are suitable for the consuming process/host;
3. bounded native renderer/staging/resource admission and cleanup have explicit owners;
4. capability projection activates only reviewed consumers and does not activate `MacQuickLookExtension` or `WindowsQuickPreview` by implication;
5. cross-process cancellation/resource accounting is defined where a real process boundary exists;
6. shared helpers never unify the two paths by re-tokenizing Zen-owned Managed/Ephemeral sources as `HostProvided`;
7. the existing MaterializationReadGate remains the Zen-owned byte-read authority; Native Preview Access is a bounded consumer/staging adapter, not a second eligibility engine.

Non-goals:

- no macOS final native UI;
- no Windows Explorer production registration;
- no broad provider additions;
- no package migration.

Stop if the implementation requires a second Provider Registry, second ReadGate, competing source identity model, durable native-path/token database, direct original-source URL handoff that bypasses actual-open revalidation, or request-long Windows shell-stream ownership in deferred work.

### W4-02 — macOS Native Quick Look Host / Strong-native Formats — COMPLETE / CLOSED

Target: supported Apple Silicon macOS 13+.

Goal: integrate system-native preview capability inside Zen for strong-native standard formats W3 intentionally deferred.

Initial format priority for real fixture evaluation:

1. PDF;
2. Office documents where system Quick Look is present;
3. iWork documents where system Quick Look is present;
4. audio/video/media only where reviewed staging/performance bounds make the path practical.

Required behavior:

- source remains the existing managed/ephemeral Preview source;
- host remains `ZenFloating` / `ZenPinned`; the native-backed representation uses `NativeOpaque` or a narrowly reviewed equivalent, not `MacQuickLookExtension`;
- no `HostProvided` token is created merely because the final representation is native-backed;
- Quick Look receives only the complete staged snapshot from the W4-01 Native Preview Access lease, never the original managed/provider-backed URL after a prior check;
- staging input comes from authoritative identity-checked open/read and receives final sourceVersion revalidation before publication;
- no raw source path crosses generic React/Tauri Preview wire;
- W4-02 freezes explicit per-request/per-process staging byte, disk, deadline and concurrency budgets before enabling a format;
- over-budget sources fall back truthfully; partial staging is never published as a native source;
- host presentation follows native semantics rather than reproducing Zen Floating chrome inside native content;
- switching/cancel/close returns native/staging resources to baseline;
- provider/native failure preserves existing terminal/fallback truth;
- File Provider/materialization state is not silently converted to hydration;
- existing `MacThumbnailService` remains separate unless an evidence-backed replacement is independently accepted.

Finder Quick Look Preview Extension is not part of this initial Track.

Accepted result: PR #145 squash-merged as `master@8ea647e13882f8cb0e08b77a2953fb06765d1729`; tree `f2ab398bf87d162fa1c6ca07f1784ceca259bdda`. Final PR head `809a2002067c315784b48a524a815be328d7c953` passed independent ChatGPT exact-head audit `#5030646522` with blockers = 0 and post-audit final PR-tree CI `32962219486` with conclusion `success`.

The activated strong-native matrix is deliberately narrow: PDF is enabled through the Zen-internal native Quick Look path; Office/iWork/media remain non-activated without genuine reviewed runtime/fixture evidence. The implementation preserves Managed/Ephemeral and `ZenFloating`/`ZenPinned` ownership, consumes only complete W4-01 staged snapshots, publishes opaque `NativeOpaque` identity, keeps Quick Look main-thread view ownership and thumbnail authority separate, and performs final current-authority validation immediately before native generation/publication. Deterministic race/lifecycle tests and Apple-Silicon CI cover the accepted host lifecycle. No Finder extension, Windows production handler, packaging activation or W5 activation was pulled forward.

Current-truth evidence:
[`../../tasks/W4-02-MACOS-NATIVE-QUICK-LOOK-CURRENT-TRUTH.md`](../../tasks/W4-02-MACOS-NATIVE-QUICK-LOOK-CURRENT-TRUTH.md).

### W4-03 v1 — Windows Preview Handler Request-long IStream Spike — STOPPED / DO NOT MERGE

Goal was to resolve the high-risk Windows shell/process questions before full product integration.

Reusable findings include:

- Rust COM strategy and build artifact shape;
- Preview Handler class/interface/lifetime shape;
- child HWND / `SetWindow` / `SetRect` behavior;
- one-`DoPreview` owner-STA completion delivery;
- focus / accelerator / `GetWindow` ABI behavior;
- generation-scoped stale-publication rejection;
- completed-read file-stream cleanup;
- no full Zen UI launch requirement;
- deterministic load/registration harness seam.

The v1 source architecture is rejected because a request-long marshaled shell `IStream` cannot be given the required universal hard-Unload source-release guarantee. Deterministic non-cooperative COM/file-lock evidence confirmed Stop Condition #5.

Durable result:
[`../../tasks/W4-03-WINDOWS-PREVIEW-HANDLER-SPIKE-STOP-RESULT.md`](../../tasks/W4-03-WINDOWS-PREVIEW-HANDLER-SPIKE-STOP-RESULT.md).

PR #146 remains architecture provenance and was closed without merge.

### W4-03 v2 — Windows Preview Handler Bounded-Capture Spike — COMPLETE / CLOSED

Goal: prove the revised ADR-0006 source/lifecycle model before W4-04 production integration.

Accepted result: PR #151 squash-merged as `master@55571e6fc4fbd9a9eedc0f474dff28b113072b67`; tree `f357be042c493d0cefd98be8e02d768210ac1f6b`. Final reviewed PR head `19e51d5e2eed175a0eda18a02b47d82c97cc289b` has the same tree. Independent acceptance reviews `#5032769265`, `#5032891624`, `#5034153959`, `#5035858384` close with blockers = 0. Final exact-head hosted run `33008914117` succeeded on attempt 1.

Proven outcomes:

- dedicated Windows Preview Handler DLL/class-factory artifact is viable;
- normal Preview Handler surrogate-host/isolation model is preserved;
- `IInitializeWithStream` stores the shell stream and performs **zero content reads**;
- `DoPreview` performs owner-apartment ingress capture capped at **512 KiB** for the spike;
- capture produces Zen-owned immutable bounded memory with truthful Complete/Partial state;
- every handler-owned `IStream` reference is released **before any deferred provider/representation/render work starts**;
- no deferred worker or renderer owns an `IStream`, shell file HANDLE or raw source path;
- deferred HostProvided is memory-backed, opaque, request-scoped and generation-bound;
- child-window, private completion window, `SetWindow` / `SetRect`, one-DoPreview publication, focus, accelerator, `GetWindow` and repeated lifecycle semantics are covered;
- `Unload` never depends on `CoCancelCall` to release the original source;
- controlled file-backed evidence proves source write/open/rename/move/delete is not blocked by the handler after successful capture;
- one pure bytes-to-representation kernel is shared by app and shell without importing PreviewSession, Provider Registry composition, ReadGate, WorkScheduler, Tauri runtime or app source identity into the DLL;
- test-only isolated registration cleanup is deterministic and keeps normal Preview Handler isolation;
- real Explorer Preview Pane / `prevhost.exe` loaded the handler and passed A/B stale protection plus file-mutation evidence;
- native workspace dependency audit/performance routing and Windows-native hosted lane are fail-closed.

Current-truth evidence:
[`../../tasks/W4-03-V2-WINDOWS-PREVIEW-HANDLER-CURRENT-TRUTH.md`](../../tasks/W4-03-V2-WINDOWS-PREVIEW-HANDLER-CURRENT-TRUTH.md).

The 512 KiB capture ceiling remains the accepted v2 architecture baseline. W4-04 may change that total/per-format capture budget only through explicit reviewed real-host evidence plus memory/latency/resource budgeting; no whole-file hidden staging or request-long source ownership is implicitly authorized.

### W4-04 — Windows Explorer Preview Handler Production Integration — AUTHORIZED / NEXT

Goal: ship the independently accepted W4-03 v2 architecture into Explorer Preview Pane for a deliberately frozen supported-content matrix.

Selection rules:

- Zen must add real user value versus existing Windows handlers;
- initial evaluation should favor text/code/Markdown-style formats that naturally fit the bounded-capture model;
- no broad claiming of file types solely to increase coverage numbers;
- do not override stronger system/native handlers without a reviewed reason;
- script/macro/external-resource behavior stays inert;
- no persistent file lock;
- repeated preview/unload is resource-stable;
- real Explorer/prevhost capture latency and stream-release behavior remain hard acceptance evidence for every production association family.

W4-04 must freeze the exact production association matrix before broad registration, reuse the accepted handler/source architecture without reintroducing request-long `IStream`, and keep production registration within the existing Windows packaging authority. Production association/installer evidence belongs to W4-04/W4-05, not to the completed architecture spike.

### W4-05 — Signing / Packaging / Registration

Goal: package native artifacts with correct install, upgrade, repair and uninstall behavior.

macOS:

- bundle placement for any new native helper/framework/view component;
- nested-code signing where applicable;
- hardened runtime/entitlements;
- Developer ID/notarization evidence where credentials exist;
- DMG install/update behavior.

Windows:

- x64 Preview Handler artifact;
- COM/file-association registration integrated with the current per-machine NSIS model where feasible;
- rollback on failed registration;
- upgrade replacement without orphaned CLSIDs/file associations;
- uninstall cleanup;
- Explorer/prevhost refresh/restart test strategy;
- MSIX `desktop2:DesktopPreviewHandler` remains an evaluated alternative, not an assumed migration.

W4-05 must account for the existing Global Index installer hooks rather than create a competing installer lifecycle owner.

### W4-06 — Native QA / Accessibility / Performance / Resource Gate

Required evidence, where applicable:

macOS:

- real native Quick Look host behavior;
- format fixtures from the accepted matrix;
- authoritative staging/no-original-URL behavior;
- source mutation/eviction between preflight and native-access acquisition fails closed;
- source mutation during staging discards staged data and publishes no stale native representation;
- staging budget/fallback behavior;
- source switch/cancel/close and staging cleanup;
- File Provider/materialization cases where genuine fixtures exist;
- Retina/multi-display behavior;
- VoiceOver/manual keyboard evidence when actually executed.

Windows:

- real Explorer Preview Pane behavior;
- `Initialize → DoPreview → Unload` lifecycle;
- zero-read `Initialize` and bounded `DoPreview` ingress capture;
- handler-owned shell stream released before deferred rendering;
- source write/rename/move/delete not blocked by Zen after successful capture and after Unload;
- capture/useful-render timing under real supported fixtures;
- resize/DPI/multi-display;
- focus/accelerator/keyboard;
- Narrator evidence when actually executed;
- repeated preview/unload steady state;
- install/upgrade/uninstall cleanup.

Shared:

- corrupt/unsupported/permission/unavailable/identity-changed states;
- no script/macro/network side effects;
- bounded handles/streams/assets/staging/helpers;
- useful-render timing under reviewed real fixtures;
- exact-head CI and native evidence identity.

Hosted compile is not interactive native UI/accessibility proof.

### W4-07 — Closeout

Docs/governance only.

Record:

- final runtime merge baselines;
- reviewed heads/trees;
- hosted/native evidence;
- supported native host and format matrix;
- residual UNVERIFIED/platform-limited facts;
- packaging/signing state;
- W5 handoff.

W5 becomes eligible for a separate activation only after W4 closeout is accepted.

## 5. Shared authority matrix

| Concern | Authority after W4 |
|---|---|
| Preview lifecycle/publication | existing PreviewSession |
| Provider selection | existing production Provider Registry |
| Managed/ephemeral identity | existing source owners |
| Zen in-app native-backed source | existing ManagedFile / EphemeralBrowse source + sourceVersion |
| Zen byte-read/materialization / actual open | existing MaterializationReadGate + authoritative platform opener |
| Zen in-app native access artifact | bounded process-local Native Preview Access lease/staging registry; consumer only, not durable authority |
| Zen in-app native representation | host-bound NativeOpaque/native adapter tied to existing Preview lifecycle |
| OS/shell-owned native request identity | bounded request-scoped HostProvided capability |
| Windows shell ingress source | Explorer/preview-host `IStream`, retained only until bounded `DoPreview` capture completes |
| Windows deferred HostProvided source | Zen-owned immutable bounded memory snapshot; no COM/file-handle/path ownership |
| Main-process expensive work | existing WorkScheduler |
| Native-process local limits | bounded process-local admission, not product provider authority |
| File mutation/recovery | existing file_ops / journals / Safe Trash / Restore |
| Windows association matrix | W4-04 production integration |
| Windows installer registration | W4-05 installer integration |
| macOS bundle/signing | W4-05 native packaging integration |

## 6. Capability rules

A native host becomes available only through explicit platform/runtime/build capability.

Never infer support from filename extension alone.

Effective behavior is still bounded by:

```text
build/platform capability
∩ native host capability
∩ verified source/request state
∩ provider/native renderer capability
∩ read/materialization/permission eligibility
∩ native-access/staging/capture budget eligibility where required
```

Unsupported/over-budget capability is reported as unsupported/fallback/N/A as appropriate, not emulated with unsafe parity.

## 7. Security rules

Binding for all tracks:

- Preview read-only;
- no macro/script execution;
- no archive extraction because a native host exists;
- no hidden network resource fetch;
- no implicit cloud hydration;
- no direct original managed/provider-backed Quick Look URL after only preflight validation;
- no arbitrary renderer raw path;
- no durable shell/source-path cache;
- no arbitrary third-party plugin loading;
- no downgrade of identity because an OS shell supplies the source;
- no broad low-integrity opt-out on Windows without separate review;
- no request-long shell `IStream` or file-handle ownership in deferred Windows Preview work.

## 8. Performance / resource targets

W4-02 has established the accepted macOS native-host baseline for its activated PDF scope. W4-03 v2 has established the accepted Windows architecture baseline through controlled and real Explorer/prevhost evidence. W4-04 must now freeze production-matrix timing/resource budgets without weakening those accepted boundaries.

- shell/native host presentation must begin promptly;
- first useful representation should preserve Quick Preview flow and target approximately <=1 s for local supported native fixtures where reasonable, including required staging/capture;
- native staging/capture is strictly bounded and may truthfully reject unsupported/slow sources;
- the accepted Windows v2 ingress baseline is 512 KiB total; any W4-04 per-format change requires explicit reviewed real-host evidence plus memory/latency/resource budgeting;
- Windows deferred work starts only after the shell stream has been released;
- close/unload must promptly release request/captured-memory/asset/native-renderer resources and must not wait on the original shell stream in the accepted steady-state;
- repeated cycles must reach steady state;
- full Zen UI startup must not be the Windows handler steady-state cost.

Do not lower W3/Query/File Library thresholds or bypass native-access safety to make W4 pass.

## 9. Required review gates

Every production Track requires:

- exact expected base;
- scoped diff audit;
- maintainability/module-boundary review;
- focused platform/contract tests;
- applicable full CI/native lanes;
- independent exact-head review;
- no unresolved merge-blocking review thread;
- current-truth closeout before the next dependent Track is authorized.

W4-02 satisfied its production-track review flow through PR #145 and its dedicated post-merge current-truth closeout record.

W4-03 v2 satisfied its architecture-track flow through PR #151, including real Explorer/prevhost evidence, exact-head Windows-native CI, independent reviews with blockers = 0 and this dedicated post-merge closeout. W4-04 is therefore authorized next. This does not authorize W4-05 or W5.

## 10. W5 boundary

W5 owns release/hardening, not W4 feature spillover.

W4 may perform the native packaging/signing work required to prove its native integration is installable. Actual final release publication, update-channel readiness and release-wide polish remain W5.