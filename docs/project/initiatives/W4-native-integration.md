# W4 — Native Integration

Status: **COMPLETE / CLOSED**

Owner: Zen Canvas

Final W4 project closeout baseline: `master@f45aae1c270d827d881abf620d8f09074c8d7d7e`; tree `d2596364c544e2bcc6648fbe0ff0465f1cc512a8`.

Final W4 closeout authority/evidence: [`../tasks/W4-NATIVE-INTEGRATION-FINAL-CURRENT-TRUTH.md`](../tasks/W4-NATIVE-INTEGRATION-FINAL-CURRENT-TRUTH.md).

The track milestones below are retained as historical implementation and governance provenance for the completed initiative.

Activation baseline: `master@43da96b89a7fe99908198b4b7dfeff3fc3bd686e`

W3 Preview Platform baseline: `master@43da96b89a7fe99908198b4b7dfeff3fc3bd686e`; W3 is COMPLETE / CLOSED and the repository enters W4 from canonical `BETWEEN INITIATIVES` truth.

W4-00 activation merge: `master@994d93b07a2bc3434977de1e16bd1e29b2585983`; tree `8477327c885319dc9146a9d6a73e370f2a74e708` (PR #142).

W4-01 production merge: `master@02e88db7cf4287e0d68792b3960da503b70d6c56`; tree `135c7a30626915bdffb0e1c4e6ca4f09734c5c9f` (PR #143).

W4-02 production merge: `master@8ea647e13882f8cb0e08b77a2953fb06765d1729`; tree `f2ab398bf87d162fa1c6ca07f1784ceca259bdda` (PR #145).

W4-03 v2 production merge: `master@55571e6fc4fbd9a9eedc0f474dff28b113072b67`; tree `f357be042c493d0cefd98be8e02d768210ac1f6b` (PR #151).

Windows source-model amendment: [`../DECISIONS/0006-windows-preview-handler-bounded-capture.md`](../DECISIONS/0006-windows-preview-handler-bounded-capture.md). PR #148 / `db192a541e9bdabcf581f9dce57be8efff39c8e2` remains the provenance identity for that amendment in the current tree; it is not the current master head.

W4-02 current-truth closeout: [`../tasks/W4-02-MACOS-NATIVE-QUICK-LOOK-CURRENT-TRUTH.md`](../tasks/W4-02-MACOS-NATIVE-QUICK-LOOK-CURRENT-TRUTH.md).

W4-03 v1 stop evidence: [`../tasks/W4-03-WINDOWS-PREVIEW-HANDLER-SPIKE-STOP-RESULT.md`](../tasks/W4-03-WINDOWS-PREVIEW-HANDLER-SPIKE-STOP-RESULT.md).

W4-03 v2 current-truth closeout: [`../tasks/W4-03-V2-WINDOWS-PREVIEW-HANDLER-CURRENT-TRUTH.md`](../tasks/W4-03-V2-WINDOWS-PREVIEW-HANDLER-CURRENT-TRUTH.md).

R-FL-01 Operation Preview Confirmation Integrity remediation taskbook (historical remediation evidence): [`../tasks/R-FL-01-OPERATION-PREVIEW-CONFIRMATION-INTEGRITY-CODEX.md`](../tasks/R-FL-01-OPERATION-PREVIEW-CONFIRMATION-INTEGRITY-CODEX.md). It was an authorized correctness remediation within W4, not a new initiative.

## Goal

Integrate the stable Zen Preview Platform with native macOS and Windows surfaces where native capability provides real user value, while preserving the existing PreviewSession / Provider Registry / ReadGate / WorkScheduler / identity / mutation authorities.

W4 is a native-host and packaging Wave. It is **not** a second Preview engine and does not reopen W3 provider architecture.

## Product outcome

W4 should leave Zen with:

- a high-quality native macOS preview path for formats where the operating system already has stronger support than a duplicate Zen renderer;
- a Windows Explorer Preview Handler for a deliberately reviewed set of file types where Zen adds useful preview coverage;
- native lifecycle, accessibility, DPI/display, cancellation and resource-cleanup evidence;
- installer/signing/registration behavior that installs, upgrades and uninstalls cleanly;
- no requirement to launch the full Zen UI merely to service a shell preview request.

## W4-00 product decisions

### macOS

The initial W4 macOS product is **Zen-internal native Quick Look host/fallback**, not a generic Finder Quick Look Preview Extension for standard formats.

Apple's current guidance positions Quick Look Preview Extensions around app-owned/custom file formats and already provides system previews for common standard formats. Zen therefore must not register a broad Quick Look extension merely to override native coverage for PDF, Office, iWork, image, audio or video formats.

W4 may use `QLPreviewView` / `QLPreviewPanel` or another reviewed native Quick Look host inside Zen for strong-native formats, but native quality does not bypass the existing Materialization/Read Gate. Quick Look receives only a request/sourceVersion-bound Zen-owned staged snapshot produced from an authoritative identity-checked open/read path; it does not receive the original managed/provider-backed URL after a checked-once preflight.

A Finder Quick Look Preview Extension remains **conditional / not initially authorized**. It may be activated later in W4 only if Zen owns a custom UTI/file format or a separately reviewed native-preview gap justifies an extension without hijacking system ownership.

Existing `MacThumbnailService` / Quick Look thumbnail behavior remains a separate thumbnail authority and is not replaced for architectural symmetry.

### Windows

The concrete native-system target remains **Windows Explorer Preview Handler**.

`PreviewHostKind::WindowsQuickPreview` remains reserved but is **not activated**. W3 already provides the Zen Floating Quick Preview experience inside the application; W4 must not invent a second global quick-preview product solely because an enum value exists.

A separate Explorer-adjacent/global Windows quick-preview surface may be proposed later only if it demonstrates distinct user value and receives an explicit product/architecture review.

The Windows Preview Handler should prefer `IInitializeWithStream`, run through the normal shell preview-host model, remain read-only/minimal, and avoid opting out of low-integrity isolation merely for implementation convenience.

W4-03 v1 proved that carrying the shell `IStream` into request-long asynchronous worker work and relying on `Unload`-time COM cancellation cannot provide the required universal source-release guarantee. That model is stopped and will not be merged as production basis.

The accepted replacement is ADR-0006 **capture-before-defer**:

```text
IInitializeWithStream
→ retain shell IStream only; no content read
→ DoPreview performs one strictly bounded ingress capture
→ copy bytes into Zen-owned immutable memory
→ release every handler-owned shell IStream reference
→ register/use HostProvided over the memory snapshot
→ only then start deferred provider/render work
→ Unload cleans only Zen-owned request/render state
```

W4-03 v2 has now proved this model through PR #151, including real Explorer/prevhost behavior. W4-04 owns production association/productization of this accepted handler architecture; it does not reopen the source-lifetime decision.

## Hard architecture boundaries

W4 MUST preserve:

- `PreviewSession` as Preview lifecycle/publication authority;
- the production Provider Registry as provider selection truth;
- backend/sourceVersion freshness and stale-publication rules;
- `MaterializationReadGate` for Zen-owned byte-read/materialization authority;
- the rule that previous eligibility is not durable authorization and byte consumers revalidate at their actual open/read boundary;
- `WorkScheduler` for expensive main-process Preview work;
- existing managed/ephemeral source identity authorities;
- existing operation journal / Safe Trash / Restore / filesystem-safety mutation authorities.

W4 MUST NOT:

- expose arbitrary filesystem paths to React/WebView;
- duplicate Preview provider selection in a native shell adapter;
- create a second durable identity database for native shell requests;
- create a second general byte-read/materialization API;
- hand native Quick Look an original managed/provider-backed URL after only an earlier eligibility/identity check;
- weaken source identity, permission, package, symlink, File Provider or mutation safety checks;
- implicitly hydrate cloud/provider content outside a platform-authorized request;
- launch the full Zen UI for every Explorer Preview Handler request as the final architecture;
- disable Windows low-integrity preview isolation as the default solution;
- broadly replace NSIS with MSIX merely to simplify Preview Handler registration;
- add Intel macOS or Linux support;
- add new W3 provider families just because a native host is inconvenient;
- reintroduce request-long shell `IStream` ownership into deferred Windows rendering;
- treat `CoCancelCall` success as a hard source-release guarantee.

If implementation requires a durable authority move, broad permission model, supported-platform change or long-lived privileged bridge outside this initiative, STOP for ADR / architecture review.

## Shared native-host model

W4 has two source-ownership paths. They may reuse native representation/resource helpers but they remain distinct at the authority boundary.

### Zen-owned in-app native-backed Preview

The initial macOS W4 path remains inside the existing Zen Preview lifecycle:

```text
ManagedFile / EphemeralBrowse source + sourceVersion
        ↓
existing PreviewSession / Provider Registry
        ↓
Native Preview Access lease through authoritative Read Gate
        ↓
complete private staging snapshot + final sourceVersion revalidation
        ↓
NativeOpaque representation bound to ZenFloating / ZenPinned
        ↓
macOS native presentation adapter/view opens staged snapshot
```

This path does **not** create a `HostProvided` source merely because the final representation is native. Existing Zen source identity and host identity remain authoritative.

The staging snapshot is not a second content authority. It is a bounded, process-local, request/sourceVersion-bound native presentation artifact created only after authoritative identity-checked access and removed with Preview lifecycle cleanup.

### OS/shell-owned native Preview

Explorer and any future separately authorized Finder extension use a shell-owned request lifecycle. For Windows Preview Handler, ADR-0006 freezes a two-phase source lifetime:

```text
OS/shell request / IStream
        ↓
bounded ingress capture owned by the native host adapter
        ↓
release original shell IStream
        ↓
opaque HostProvided hostToken
        ↓
Zen-owned immutable bounded memory source
        ↓
shared pure representation logic where practical
        ↓
platform-native host rendering
```

This path must not become:

```text
OS path / extension
        ↓
new native parser stack
        ↓
second preview truth
```

`PreviewSourceRef::HostProvided { hostToken }` remains reserved for **OS/shell-owned request ownership**, not all native-backed rendering. A `hostToken` is opaque and must map backend/native-side to a bounded request/source descriptor; it is never a disguised path string.

For Windows, request ownership may outlive the original stream. The request-scoped HostProvided capability survives over the Zen-owned captured memory snapshot; the original shell `IStream` does not survive into deferred work.

## Windows stream rule

Where Explorer supplies `IStream`, the stream itself is the OS-host ingress source. It is not a request-long deferred byte service.

Binding sequence:

1. `Initialize` stores the stream/reference and lightweight generation state only; it performs zero content reads.
2. `DoPreview` performs one strictly bounded ingress capture on the handler's owning apartment.
3. W4-03 v2 freezes that spike capture ceiling at **512 KiB**.
4. captured bytes are copied into an immutable process-local snapshot with truthful Complete/Partial state;
5. every handler-owned shell `IStream` reference is released before deferred provider/render work starts;
6. deferred HostProvided reads target the immutable memory snapshot only;
7. no worker owns an `IStream`, shell file HANDLE or renderer-decodable source path;
8. `Unload` must never depend on COM call cancellation to release the original shell source.

This does not mean the native handler receives a renderer/general Zen ReadGate lease. The shell stream is already the request's open source at ingress. After capture, the accepted W4-01 HostProvided seam remains a narrow, bounded request capability over Zen-owned memory.

The Windows product contract does not claim that Zen can forcibly terminate every possible adversarial custom COM stream implementation whose synchronous `Read` never returns. W4-04 production association eligibility remains grounded in the W4-03 real Explorer/prevhost evidence and the deliberately supported matrix: bounded capture responsiveness, stream release before deferred work and no Zen-owned file lock after capture.

A reusable pure representation library may be extracted if necessary, but extraction must preserve one representation truth and may not fork providers into app and shell copies. The approved seam is `bounded bytes + completeness + inert metadata hints → safe representation`; it does not move PreviewSession, Provider Registry, ReadGate, WorkScheduler or app source identity into the COM DLL.

## macOS source rule

A Zen-internal native Quick Look-backed representation keeps the existing `ManagedFile` / `EphemeralBrowse` source and `ZenFloating` / `ZenPinned` host identity. It must not pass the original source URL directly to Quick Look after a prior check.

W4-01 established the bounded **Native Preview Access** lifecycle that W4-02 consumes. It:

- binds to current Preview session/request/sourceVersion/host;
- performs fresh authoritative eligibility/identity validation at native-access acquisition;
- obtains source bytes only through an identity-checked authoritative open/read path;
- produces a complete private Zen-owned staging snapshot;
- revalidates sourceVersion/freshness after staging and before `NativeOpaque` publication;
- exposes only the staging URL inside backend/native code;
- revokes staging/native resources on switch/cancel/dispose/failure/expiry;
- never converts `MaterializationRequired`, `Downloading`, `MetadataOnly`, unavailable/permission/identity failures into implicit Quick Look hydration.

W4-02 froze and proved its native host/staging bounds on the accepted implementation: PDF is the activated strong-native format, staging remains bounded by the existing W4-01 Native Preview Access limits, and a source that cannot satisfy those limits falls back truthfully. No direct-source-URL escape hatch was introduced.

The native representation uses the existing host-bound `NativeOpaque` seam and does not reclassify the in-app path as `MacQuickLookExtension` or create a `HostProvided` source for symmetry.

The accepted W4-02 implementation also performs a final current-authority revalidation at commit immediately before native generation/publication, so source mutation or superseding preview authority between staging and commit fails closed. Exact acceptance evidence is recorded in [`../tasks/W4-02-MACOS-NATIVE-QUICK-LOOK-CURRENT-TRUTH.md`](../tasks/W4-02-MACOS-NATIVE-QUICK-LOOK-CURRENT-TRUTH.md).

If a future Finder Quick Look extension is activated, its extension-process/source lifecycle must be separately frozen, including sandbox, signing, bundle placement and cancellation; that future shell-owned path may then use `HostProvided` and does not automatically inherit the in-app staging topology.

## Dependency graph

```text
W4-00  Activation + Native Architecture / Experience Freeze        ✅ PR #142
  ↓
W4-01  Shared Native Host Bridge + HostProvided Source Contract    ✅ PR #143
  ↓
 ┌──────────────────────────────────┬────────────────────────────────────┐
 ↓                                  ↓
W4-02 macOS Native Quick Look     W4-03 v1 Windows Preview Handler
      Host / Strong-native              request-long IStream spike
      Format Integration                ARCHITECTURE SPIKE COMPLETE — PR #146 superseded/not merged
      ✅ COMPLETE — PR #145                   ↓
                                     ADR-0006 ✅ PR #148 provenance
                                                ↓
                                     W4-03 v2 Bounded-Capture Spike
                                           ✅ COMPLETE — PR #151
                                                ↓
                                      W4-04 Windows Explorer Handler
                                            ✅ COMPLETE / CLOSED
 └───────────────────┬───────────────────────────────────────────────────┘
                     ↓
W4-05  Signing / Packaging / Registration Integration   ✅ COMPLETE / CLOSED
  ↓
W4-06  Native Accessibility / DPI / Performance / Resource QA   ✅ COMPLETE / CLOSED
  ↓
W4-07  W4 Closeout   ✅ COMPLETE / CLOSED
```

W4-02 is **COMPLETE / CLOSED** and remains independent of the rejected Windows v1 stream lifetime. Its accepted macOS source/view lifecycle remains built on W4-01 Native Preview Access.

W4-03 v1 is **ARCHITECTURE SPIKE COMPLETE / STOP CONDITION #5 CONFIRMED / SUPERSEDED / NOT MERGED**. It was not an unfinished implementation or a failed task awaiting repair; its reusable COM/window/lifecycle findings remain provenance. W4-03 v2 is **COMPLETE / CLOSED** through PR #151 and is the accepted production-directed successor. W4-04 production integration, W4-05 signing/packaging/registration integration and W4-06 native QA are **COMPLETE / CLOSED** under the final W4 closeout; W4-07 is the docs/governance closeout record.

W4-05 and W4-06 closeout evidence is recorded in the final W4 closeout. The accepted engineering packaging/registration path is complete; production signing/notarization remains explicitly deferred by product decision. W5 remains eligible for separate activation and is not activated by W4 completion.

## Track summaries

### W4-00 — Activation + Native Architecture / Experience Freeze — COMPLETE

Docs/governance activation merged through PR #142 as `master@994d93b07a2bc3434977de1e16bd1e29b2585983`. It re-verified the official Apple/Microsoft/Tauri contracts and froze W4 product boundaries, dependency graph, source/open-ownership model, native packaging assumptions, acceptance matrix and stop conditions without production/config/package/workflow changes.

### W4-01 — Shared Native Host Bridge — COMPLETE / CLOSED

Merged through PR #143 as `master@02e88db7cf4287e0d68792b3960da503b70d6c56`; tree `135c7a30626915bdffb0e1c4e6ca4f09734c5c9f`.

Final accepted implementation head `5e99b940ac81a78d4b129d405379a027aad489b7` / tree `100843c8eac51dc1bc676a20b170fbd31abbe759` passed exact-head hosted CI `32844897985` and independent ChatGPT review `#5019582519` with blockers = 0. Final PR head `eca7a10a073b9f2728888cfd5ff3ff47ab6228bf` passed final PR-tree CI `32855283296` after a same-head failed-job rerun; no production code or performance threshold changed between attempts.

Accepted outcomes:

- Managed/Ephemeral + `ZenFloating`/`ZenPinned` ownership is preserved for Zen-owned native-backed representations;
- `MaterializationReadGate` remains byte/open authority and performs one authoritative identity-checked open for complete bounded staging;
- final sourceVersion and current-request authority revalidation gate native token publication;
- Native Preview Access owns only private disposable staging/token lifecycle and exposes no raw path/File/handle to React/WebView;
- staging reuses the global `WorkScheduler` with bounded NativePreview/I/O/open-handle admission and no second scheduler/semaphore;
- Native acquisition is strictly covered by the authoritative ReadGate lease lifetime;
- staging-root initialization/cleanup fails closed on symlink/reparse/non-directory roots and remains bounded to verified Zen-owned state;
- shell-owned `HostProvided` uses opaque request-scoped host/generation tokens, bounded reads, cancellation/revoke/expiry and post-read revalidation;
- native source destruction occurs outside the registry coordination mutex;
- runtime cancel/switch/dispose/Browse teardown and in-flight staging cleanup return resources to baseline;
- normal W3 native shell hosts remain fail-closed and no W4-02/03 platform UI/COM/registration work was pulled forward.

Current-truth closeout:
[`../tasks/W4-01-SHARED-NATIVE-HOST-BRIDGE-CURRENT-TRUTH.md`](../tasks/W4-01-SHARED-NATIVE-HOST-BRIDGE-CURRENT-TRUTH.md).

### W4-02 — macOS Native Quick Look Host — COMPLETE / CLOSED

Apple Silicon / macOS 13+ only.

Merged through PR #145 as `master@8ea647e13882f8cb0e08b77a2953fb06765d1729`; tree `f2ab398bf87d162fa1c6ca07f1784ceca259bdda`. Final PR head `809a2002067c315784b48a524a815be328d7c953` passed independent ChatGPT exact-head review `#5030646522` with blockers = 0 and final post-audit PR-tree CI `32962219486` with conclusion `success`.

Accepted outcomes:

- Zen-internal `QLPreviewView` presentation is integrated inside the existing `ZenFloating` / `ZenPinned` Preview lifecycle rather than adding a Finder extension or second Preview product;
- existing Managed/Ephemeral source identity remains authoritative and native presentation consumes only W4-01 Native Preview Access staged snapshots;
- PDF is the activated strong-native format; Office/iWork/media are not falsely activated without genuine reviewed runtime/fixture evidence;
- renderer-visible state contains only opaque `NativeOpaque` identity and no source/staging filesystem path;
- Quick Look view creation/use is main-thread bound and the existing thumbnail Quick Look authority remains separate;
- native generation/publication performs final current-authority validation immediately before commit, closing the staging-to-commit TOCTOU window identified during independent audit;
- cancel, source switch, dispose and stale-generation races clean native view/access state and cannot publish superseded native content;
- native failure and over-budget/materialization-unavailable cases preserve truthful existing Preview fallback/terminal semantics with no implicit hydration;
- deterministic exact-head tests cover stale commit rejection, coalesced source switching, lifecycle cleanup and native ownership; hosted Apple-Silicon CI executes the native Quick Look lifecycle gate;
- no Windows W4-03 production authority, Finder extension, package/registration expansion, W4-05 activation or W5 activation was pulled forward.

Current-truth closeout:
[`../tasks/W4-02-MACOS-NATIVE-QUICK-LOOK-CURRENT-TRUTH.md`](../tasks/W4-02-MACOS-NATIVE-QUICK-LOOK-CURRENT-TRUTH.md).

### W4-03 v1 — Windows Preview Handler request-long IStream Spike — STOPPED / DO NOT MERGE

PR #146 at evidence head `11fd3729770266f191ea7799edbc2b867693c181` proved useful COM/window/publication behavior but confirmed Stop Condition #5 for the request-long asynchronous shell-stream architecture.

Deterministic standard-marshaled experiments proved that cancellation request success does not universally force a non-cooperative server-side `IStream::Read` to terminate or release its real file lock. The v1 source model is rejected.

Durable evidence:
[`../tasks/W4-03-WINDOWS-PREVIEW-HANDLER-SPIKE-STOP-RESULT.md`](../tasks/W4-03-WINDOWS-PREVIEW-HANDLER-SPIKE-STOP-RESULT.md).

PR #146 is architecture provenance only and was closed without merge.

### W4-03 v2 — Windows Preview Handler Bounded-Capture Spike — COMPLETE / CLOSED

Merged through PR #151 as `master@55571e6fc4fbd9a9eedc0f474dff28b113072b67`; tree `f357be042c493d0cefd98be8e02d768210ac1f6b`. Final reviewed PR head `19e51d5e2eed175a0eda18a02b47d82c97cc289b` has the same tree.

Accepted outcomes:

- `Initialize` stores the shell stream and performs zero content reads;
- `DoPreview` performs owner-apartment ingress capture capped at 512 KiB for the v2 spike;
- captured bytes become Zen-owned immutable bounded memory with truthful Complete/Partial state;
- every handler-owned `IStream` reference is released before deferred representation/render work;
- no deferred worker owns an `IStream`, shell file HANDLE or raw source path;
- memory-backed HostProvided stays opaque, request-scoped and generation-bound;
- child HWND, private completion HWND, `SetWindow`/`SetRect`, focus/accelerator/GetWindow and repeated lifecycle behavior are exact-head tested;
- `Unload` does not depend on `CoCancelCall` to release the original source;
- controlled file-backed evidence proves write/open/rename/move/delete is not blocked by Zen after successful capture;
- app and shell share one HostProvided contract and one pure Text/Code/Markdown representation kernel without moving app authority into the DLL;
- real Explorer/prevhost acceptance passed with normal Preview Handler isolation, isolated HKCU test registration, A/B stale protection and deterministic cleanup;
- Windows native hosted CI, native Cargo RustSec coverage, Preview performance routing and aggregate gates are fail-closed;
- the historical Folder Preview parallel-test flake was fixed by test-local scheduler injection while production continues to use the global `WorkScheduler`.

Independent acceptance reviews: `#5032769265`, `#5032891624`, `#5034153959`, `#5035858384`; final blockers = 0. Final exact-head hosted CI `33008914117` succeeded on attempt 1 at `19e51d5e2eed175a0eda18a02b47d82c97cc289b`.

Current-truth closeout:
[`../tasks/W4-03-V2-WINDOWS-PREVIEW-HANDLER-CURRENT-TRUTH.md`](../tasks/W4-03-V2-WINDOWS-PREVIEW-HANDLER-CURRENT-TRUTH.md).

### W4-04 — Windows Explorer Preview Handler Production Integration — COMPLETE / CLOSED

W4-04 production integration is complete under the final W4 closeout. The accepted implementation preserves the frozen product and architecture decisions and does not reopen the rejected request-long source-ownership model.

W4-04 turned the independently accepted W4-03 v2 architecture into the supported Explorer Preview Handler for a deliberately frozen extension/content-type matrix.

The accepted matrix prioritizes formats where Zen materially improves Windows preview coverage and where the bounded-capture representation model is a natural fit, while preserving stronger PDF/Office/media/system-handler ownership.

W4-04 preserves ADR-0006, the accepted 512 KiB v2 capture model, one shared HostProvided/representation truth, normal Preview Handler isolation and deterministic association cleanup.

W4-04 owned production association/productization evidence, including the frozen support matrix and real install/upgrade/repair/uninstall registration behavior. It does not create a second Preview/read identity authority.

### W4-05 — Signing / Packaging / Registration — COMPLETE / CLOSED

macOS:

- native bundle placement and nested-code signing where applicable;
- hardened runtime / entitlements;
- the exact frozen `0.1.40` Apple-Silicon engineering DMG passed read-only mount, isolated user-Applications copy, same-version replacement, exact target removal and actual detach on hosted macOS; evidence is recorded in [`../tasks/W4-05-NO-SIGN-DISPOSITION-CURRENT-TRUTH.md`](../tasks/W4-05-NO-SIGN-DISPOSITION-CURRENT-TRUTH.md);
- cross-version upgrade remains **DEFERRED / W5 — NO REAL OLDER RELEASE FIXTURE**;
- Developer ID / notarization remains **DEFERRED / NOT PLANNED IN CURRENT HORIZON** under the no-production-signing disposition.

Windows:

- x64 native handler artifact packaging;
- NSIS registration through the existing per-machine installer where feasible;
- clean upgrade/repair/uninstall registry behavior;
- evaluate MSIX `desktop2:DesktopPreviewHandler` as an alternative, not an automatic migration;
- production code-signing evidence remains **DEFERRED / NOT PLANNED IN CURRENT HORIZON** under the no-production-signing disposition.

### W4-06 — Native QA — COMPLETE / CLOSED

Require real platform evidence where the host exists:

- Finder/Quick Look host or Zen native Quick Look manual behavior as applicable;
- Explorer Preview Pane behavior;
- VoiceOver/Narrator where actually executed;
- keyboard/focus/accelerator behavior;
- Retina/DPI/multi-display resizing;
- corrupt/unsupported/permission/materialization failures;
- repeated preview/unload resource steady state;
- Windows shell stream released before deferred rendering and source not locked by Zen after successful bounded capture/close/unload;
- native staging artifacts return to baseline after switch/cancel/close/failure;
- native host startup/useful-render timing including staging/capture cost;
- install/upgrade/uninstall cleanup.

Hosted compile evidence must never be relabeled as interactive native accessibility/UI proof.

### W4-07 — Closeout — COMPLETE / CLOSED

The final W4 closeout records merged production baselines, exact-head CI/native evidence, remaining platform limits and the W5 handoff. W5 is **ELIGIBLE / INACTIVE** and is not activated by W4 completion.

## Initial supported-host matrix

| Host | W4 status | Initial intent |
|---|---|---|
| `ZenFloating` | existing / W3 | unchanged host identity; may render native-backed staged representation on macOS |
| `ZenPinned` | existing / W3 | unchanged host identity; may render native-backed staged representation on macOS |
| `MacQuickLookExtension` | reserved / not initially activated | only for later reviewed custom/native-extension case |
| macOS internal native Quick Look adapter | W4-02 complete / PR #145 | native-backed PDF representation over Zen-owned request-bound staging inside existing Zen hosts |
| `WindowsQuickPreview` | reserved / inactive | no second product without explicit review |
| `WindowsPreviewHandler` | W4-03 v2 and W4-04 complete / closed | accepted capture-before-defer handler with the final production association matrix and packaging integration |

## Initial format strategy

- Keep W3 built-in Text/Code/Markdown/Structured/Table/Image/Folder/ZIP providers as the Zen provider baseline.
- The accepted macOS W4-02 path uses system Quick Look for PDF through complete safe staging; Office/iWork/media remain non-activated until genuine reviewed fixture/runtime evidence exists.
- On Windows, W4-03 v2 proved the 512 KiB bounded-capture model using text/code/Markdown-style representation semantics; W4-04 now owns the exact conservative production association matrix.
- Do not claim universal Windows format parity or override strong built-in/native handlers merely for coverage.
- Native failure must fall back or report unsupported truthfully; no script/macro execution, hidden network resources, direct source-URL bypass or implicit hydration.

## Packaging reality at final W4 baseline

Current repository packaging is:

- Tauri 2;
- Windows NSIS, per-machine, with existing installer hooks already managing the Global Index service;
- macOS DMG with minimum macOS 13 and hardened runtime;
- accepted Windows Preview Handler DLL/runtime artifact, production extension-association matrix and installer registration from W4-04;
- no current app-extension target;
- no current MSIX target.

W4-04/W4-05 extended this packaging deliberately; the final W4 closeout records the accepted engineering package and registration behavior. Production signing/notarization remains deferred by product decision.

The exact frozen `0.1.40` macOS engineering DMG also has real hosted Apple-Silicon lifecycle evidence: read-only mount, isolated user-Applications copy, same-version replacement, exact target removal and actual detach all passed. No cross-version claim is made; the required older-release fixture remains **DEFERRED / W5 — NO REAL OLDER RELEASE FIXTURE**. The no-sign disposition and raw evidence identity are recorded in [`../tasks/W4-05-NO-SIGN-DISPOSITION-CURRENT-TRUTH.md`](../tasks/W4-05-NO-SIGN-DISPOSITION-CURRENT-TRUTH.md).

## Acceptance gate

W4 closed with the following gates satisfied or truthfully classified by the final closeout:

1. W4-01 proves both reviewed native source-ownership paths without renderer raw paths, source re-tokenization or second durable authority, including authoritative actual-open/staging behavior for Zen-owned native Preview. **SATISFIED by PR #143.**
2. macOS native-host behavior is proven for the approved strong-native format scope with complete bounded staging and no original-source URL bypass, or explicitly classified N/A/deferred with truthful rationale. **W4-02 TRACK SATISFIED by PR #145 for the activated PDF scope; broader W4-06 manual accessibility/display evidence remains separately gated.**
3. Windows Explorer Preview Handler passes the accepted ADR-0006 lifecycle: zero-read Initialize, bounded DoPreview capture, shell-stream release before deferred work, real `Initialize → DoPreview → Unload` lifecycle and no Zen-owned file lock after capture/Unload. **W4-03 ARCHITECTURE TRACK SATISFIED by PR #151; W4-04 production integration SATISFIED by PR #159 and the final closeout.**
4. applicable native registration/install/upgrade/uninstall is proven. **Windows registration and installer lifecycle SATISFIED by W4-04 / PR #159; macOS current engineering DMG mount/copy/same-version replacement/remove/detach SATISFIED by hosted W4-05 evidence; cross-version macOS upgrade remains DEFERRED / W5 — NO REAL OLDER RELEASE FIXTURE.**
5. platform capability differences remain explicit.
6. crash/cancel/unload paths release request, captured snapshot, staging, renderer and scheduler resources; Windows deferred work owns no shell stream/file handle.
7. security rules remain read-only/no macros/no hidden network/no implicit hydration.
8. native keyboard/focus/display behavior is validated where executable fixtures exist.
9. exact-head CI and applicable real native tests are recorded.
10. W5 is not activated by W4 completion; it remains **ELIGIBLE / INACTIVE** pending separate activation.

## Deferred / non-goals

W4 does not authorize:

- OCR/AI/RAG/plugin SDK work;
- arbitrary third-party Preview plugins;
- universal PDF/Office/media Zen renderers;
- Linux;
- Intel macOS;
- a general Finder Sync feature suite;
- a global Windows hotkey/overlay product unless separately reviewed;
- native direct source access that bypasses authoritative actual-open/read semantics;
- request-long asynchronous shell-IStream ownership in the Windows Preview Handler;
- release publication itself; publication remains W5.

## Current state

The W4 initiative is **COMPLETE / CLOSED**. W4-00, W4-01, W4-02 and W4-03 v2 are complete. W4-02 macOS Native Quick Look Host / Strong-native Format Integration is **COMPLETE / CLOSED** through PR #145; exact evidence is recorded in the W4-02 current-truth closeout.

W4-03 v1 reached a valid architecture Stop Condition at PR #146 and is not a merge candidate. ADR-0006 replaces its Windows source-lifetime assumption. W4-03 v2 Bounded-Capture Spike is **COMPLETE / CLOSED** through PR #151 / `master@55571e6fc4fbd9a9eedc0f474dff28b113072b67`; exact evidence is recorded in the W4-03 v2 current-truth closeout.

W4-04 Windows Explorer Preview Handler Production Integration is **COMPLETE / CLOSED** through PR #159. W4-05 signing/packaging/registration integration and W4-06 native QA are **COMPLETE / CLOSED**; W4-05 no-production-signing disposition and hosted macOS DMG lifecycle evidence are recorded in [`../tasks/W4-05-NO-SIGN-DISPOSITION-CURRENT-TRUTH.md`](../tasks/W4-05-NO-SIGN-DISPOSITION-CURRENT-TRUTH.md). W4-07 is the final docs/governance closeout. W5 Release / Hardening is **ELIGIBLE / INACTIVE** and requires separate activation; W4 completion does not automatically authorize or activate it.
