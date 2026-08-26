# W4 — Native Integration

Status: **ACTIVE — W4-01 complete; W4-02 authorized; W4-03 v1 stopped; W4-03 v2 bounded-capture spike authorized next; W4-04 blocked**

Owner: Zen Canvas

Activation baseline: `master@43da96b89a7fe99908198b4b7dfeff3fc3bd686e`

W3 Preview Platform baseline: `master@43da96b89a7fe99908198b4b7dfeff3fc3bd686e`; W3 is COMPLETE / CLOSED and the repository enters W4 from canonical `BETWEEN INITIATIVES` truth.

W4-00 activation merge: `master@994d93b07a2bc3434977de1e16bd1e29b2585983`; tree `8477327c885319dc9146a9d6a73e370f2a74e708` (PR #142).

W4-01 production merge: `master@02e88db7cf4287e0d68792b3960da503b70d6c56`; tree `135c7a30626915bdffb0e1c4e6ca4f09734c5c9f` (PR #143).

Current canonical master entering this amendment: `master@768d7bbabe7513c2ff9fc95363144320997db399`; tree `30382e601749c19893a857928487c6b1d6ed9a07` (PR #147 post-W3 Preview host correctness bugfix).

Windows source-model amendment: [`../DECISIONS/0006-windows-preview-handler-bounded-capture.md`](../DECISIONS/0006-windows-preview-handler-bounded-capture.md).

W4-03 v1 stop evidence: [`../tasks/W4-03-WINDOWS-PREVIEW-HANDLER-SPIKE-STOP-RESULT.md`](../tasks/W4-03-WINDOWS-PREVIEW-HANDLER-SPIKE-STOP-RESULT.md).

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

The Windows product contract does not claim that Zen can forcibly terminate every possible adversarial custom COM stream implementation whose synchronous `Read` never returns. W4-04 association activation instead requires real Explorer/prevhost evidence for the deliberately supported matrix: bounded capture responsiveness, stream release before deferred work and no Zen-owned file lock after capture.

A reusable pure representation library may be extracted if necessary, but extraction must preserve one representation truth and may not fork providers into app and shell copies. The approved seam is `bounded bytes + completeness + inert metadata hints → safe representation`; it does not move PreviewSession, Provider Registry, ReadGate, WorkScheduler or app source identity into the COM DLL.

## macOS source rule

A Zen-internal native Quick Look-backed representation keeps the existing `ManagedFile` / `EphemeralBrowse` source and `ZenFloating` / `ZenPinned` host identity. It must not pass the original source URL directly to Quick Look after a prior check.

W4-01 established the bounded **Native Preview Access** lifecycle that W4-02 must consume. It:

- binds to current Preview session/request/sourceVersion/host;
- performs fresh authoritative eligibility/identity validation at native-access acquisition;
- obtains source bytes only through an identity-checked authoritative open/read path;
- produces a complete private Zen-owned staging snapshot;
- revalidates sourceVersion/freshness after staging and before `NativeOpaque` publication;
- exposes only the staging URL inside backend/native code;
- revokes staging/native resources on switch/cancel/dispose/failure/expiry;
- never converts `MaterializationRequired`, `Downloading`, `MetadataOnly`, unavailable/permission/identity failures into implicit Quick Look hydration.

W4-02 must freeze explicit staging byte/disk/deadline/concurrency budgets for the actual native host and format activation. A source that cannot fit those budgets falls back truthfully; no direct-source-URL escape hatch is allowed merely to preserve coverage or latency.

The native representation should use the existing host-bound `NativeOpaque` seam or a narrowly reviewed equivalent. It must not be reclassified as `MacQuickLookExtension` and must not create a `HostProvided` source solely for implementation symmetry.

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
      Format Integration                STOPPED — PR #146 not mergeable
      AUTHORIZED / NEXT                        ↓
                                     ADR-0006 source-model amendment
                                                ↓
                                     W4-03 v2 Bounded-Capture Spike
                                           AUTHORIZED / NEXT
                                                ↓
                                     W4-04 Windows Explorer Handler
                                           DEPENDS ON W4-03 v2
 └───────────────────┬───────────────────────────────────────────────────┘
                     ↓
W4-05  Signing / Packaging / Registration Integration
  ↓
W4-06  Native Accessibility / DPI / Performance / Resource QA
  ↓
W4-07  W4 Closeout
```

W4-02 remains independent of the rejected Windows v1 stream lifetime and may continue against the accepted W4-01 Native Preview Access model.

W4-03 v1 is stopped. W4-03 v2 becomes the only authorized Windows architecture Track when this governance amendment merges. W4-04 remains gated behind an independently accepted v2 result.

W4-05 preparation may begin alongside platform implementation only where artifact/registration shapes are already frozen; final installer/signing acceptance depends on W4-02/W4-04 outputs.

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

### W4-02 — macOS Native Quick Look Host — AUTHORIZED / NEXT

Apple Silicon / macOS 13+ only.

Initial scope is Zen-internal native Quick Look integration for strong-native formats deferred by W3, prioritizing PDF, Office/iWork and media where system Quick Look is the stronger renderer. It stays inside `ZenFloating` / `ZenPinned` with existing source identity and consumes the accepted W4-01 Native Preview Access lifecycle.

Before format activation W4-02 must freeze and prove Native Preview Access staging budgets/performance for the actual native host. Quick Look receives only the complete staged snapshot, never the original managed/provider-backed source URL after a preflight check. Over-budget or non-local sources fall back truthfully.

A Finder Quick Look Preview Extension is not part of the initial track unless W4 governance is amended by reviewed evidence showing an appropriate custom/native-preview ownership case.

### W4-03 v1 — Windows Preview Handler request-long IStream Spike — STOPPED / DO NOT MERGE

PR #146 at evidence head `11fd3729770266f191ea7799edbc2b867693c181` proved useful COM/window/publication behavior but confirmed Stop Condition #5 for the request-long asynchronous shell-stream architecture.

Deterministic standard-marshaled experiments proved that cancellation request success does not universally force a non-cooperative server-side `IStream::Read` to terminate or release its real file lock. The v1 source model is rejected.

Durable evidence:
[`../tasks/W4-03-WINDOWS-PREVIEW-HANDLER-SPIKE-STOP-RESULT.md`](../tasks/W4-03-WINDOWS-PREVIEW-HANDLER-SPIKE-STOP-RESULT.md).

PR #146 is architecture provenance only and must close without merge.

### W4-03 v2 — Windows Preview Handler Bounded-Capture Spike — AUTHORIZED / NEXT

W4-03 v2 retains accepted COM/window/ABI findings where useful but starts from canonical master after this governance amendment, not from PR #146 history.

It must prove:

- `Initialize` stores the shell stream and performs zero content reads;
- `DoPreview` performs one owner-apartment capture capped at 512 KiB for the spike;
- captured bytes become a Zen-owned immutable memory source with truthful Complete/Partial state;
- every handler-owned shell `IStream` reference is released before any deferred provider/render work;
- no deferred worker owns an `IStream`, shell file HANDLE or raw source path;
- HostProvided remains opaque, request-scoped and backed only by the memory snapshot during deferred work;
- `Unload` never depends on `CoCancelCall` to release the original source;
- child-window, one-DoPreview publication, focus, accelerator, stale-generation and repeated lifecycle behavior remains correct;
- a pure bytes-to-representation kernel can be shared without importing app authority or copying a second provider tree;
- controlled file-lock evidence proves the handler no longer owns a source lock after successful capture;
- real Explorer/prevhost capture responsiveness and low-integrity behavior remain `UNVERIFIED` until actually executed.

The v2 spike is still not the final broad association implementation.

### W4-04 — Windows Explorer Preview Handler Production Integration

Turn an independently accepted W4-03 v2 architecture into the supported Explorer Preview Handler for a deliberately frozen extension/content-type matrix.

Prefer formats where Zen materially improves Windows preview coverage and where the bounded-capture representation model is a natural fit. Initial evaluation should prioritize text/code/Markdown-style formats already supported by bounded W3 representation semantics rather than seizing PDF/Office/media/system-handler territory for parity.

Do not replace built-in system handlers indiscriminately.

W4-04 remains **DEPENDENCY-GATED** until W4-03 v2 is independently accepted, including real Explorer/prevhost source-capture evidence.

### W4-05 — Signing / Packaging / Registration

macOS:

- native bundle placement and nested-code signing where applicable;
- hardened runtime / entitlements;
- Developer ID / notarization evidence when credentials are available;
- DMG install/upgrade/uninstall behavior.

Windows:

- x64 native handler artifact packaging;
- NSIS registration through the existing per-machine installer where feasible;
- clean upgrade/repair/uninstall registry behavior;
- evaluate MSIX `desktop2:DesktopPreviewHandler` as an alternative, not an automatic migration;
- code-signing evidence when credentials are available.

### W4-06 — Native QA

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

### W4-07 — Closeout

Record merged production baselines, exact-head CI/native evidence, remaining platform limits and W5 handoff. W5 remains inactive until W4 closeout is independently accepted.

## Initial supported-host matrix

| Host | W4 status | Initial intent |
|---|---|---|
| `ZenFloating` | existing / W3 | unchanged host identity; may render native-backed staged representation on macOS |
| `ZenPinned` | existing / W3 | unchanged host identity; may render native-backed staged representation on macOS |
| `MacQuickLookExtension` | reserved / not initially activated | only for later reviewed custom/native-extension case |
| macOS internal native Quick Look adapter | W4-02 authorized | native-backed representation over Zen-owned request-bound staging inside existing Zen hosts |
| `WindowsQuickPreview` | reserved / inactive | no second product without explicit review |
| `WindowsPreviewHandler` | W4-03 v2 authorized for bounded-capture architecture spike | Explorer stream ingress → bounded immutable capture → memory-backed HostProvided → deferred native representation |

## Initial format strategy

- Keep W3 built-in Text/Code/Markdown/Structured/Table/Image/Folder/ZIP providers as the Zen provider baseline.
- Prefer macOS system Quick Look for strong-native standard formats rather than duplicating PDF/Office/iWork/audio/video renderers, but only when a complete safe staging snapshot fits the reviewed native-access budgets.
- On Windows, W4-03 v2 proves the 512 KiB bounded-capture model using text/code/Markdown-style representation semantics; W4-04 freezes exact production associations only after real Explorer evidence.
- Do not claim universal Windows format parity or override strong built-in/native handlers merely for coverage.
- Native failure must fall back or report unsupported truthfully; no script/macro execution, hidden network resources, direct source-URL bypass or implicit hydration.

## Packaging reality at activation

Current repository packaging is:

- Tauri 2;
- Windows NSIS, per-machine, with existing installer hooks already managing the Global Index service;
- macOS DMG with minimum macOS 13 and hardened runtime;
- no current app-extension target or accepted production Windows Preview Handler binary;
- no current MSIX target.

W4 must extend this packaging deliberately rather than replace it casually.

## Acceptance gate

W4 may close only when:

1. W4-01 proves both reviewed native source-ownership paths without renderer raw paths, source re-tokenization or second durable authority, including authoritative actual-open/staging behavior for Zen-owned native Preview. **SATISFIED by PR #143.**
2. macOS native-host behavior is proven for the approved strong-native format scope with complete bounded staging and no original-source URL bypass, or explicitly classified N/A/deferred with truthful rationale.
3. Windows Explorer Preview Handler passes the accepted ADR-0006 lifecycle: zero-read Initialize, bounded DoPreview capture, shell-stream release before deferred work, real `Initialize → DoPreview → Unload` lifecycle and no Zen-owned file lock after capture/Unload.
4. applicable native registration/install/upgrade/uninstall is proven.
5. platform capability differences remain explicit.
6. crash/cancel/unload paths release request, captured snapshot, staging, renderer and scheduler resources; Windows deferred work owns no shell stream/file handle.
7. security rules remain read-only/no macros/no hidden network/no implicit hydration.
8. native keyboard/focus/display behavior is validated where executable fixtures exist.
9. exact-head CI and applicable real native tests are recorded.
10. W5 is not activated until W4 closeout is independently accepted.

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

W4 is the sole active initiative. W4-00 and W4-01 are complete. W4-02 macOS Native Quick Look Host / Strong-native Format Integration remains authorized independently.

W4-03 v1 reached a valid architecture Stop Condition at PR #146 and is not a merge candidate. ADR-0006 replaces its Windows source-lifetime assumption. After this governance amendment merges, W4-03 v2 Bounded-Capture Spike is the only authorized Windows implementation Track.

W4-04 remains dependency-gated behind independently accepted W4-03 v2 real-host evidence. W4-05+ remain downstream-gated by the existing dependency graph. W5 Release / Hardening remains **NOT AUTHORIZED / NOT ACTIVE**.
