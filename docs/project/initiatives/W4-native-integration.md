# W4 — Native Integration

Status: **ACTIVE — implementation — W4-00 architecture / experience freeze**

Owner: Zen Canvas

Activation baseline: `master@43da96b89a7fe99908198b4b7dfeff3fc3bd686e`

W3 Preview Platform baseline: `master@43da96b89a7fe99908198b4b7dfeff3fc3bd686e`; W3 is COMPLETE / CLOSED and the repository enters W4 from canonical `BETWEEN INITIATIVES` truth.

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

W4 may use `QLPreviewView` / `QLPreviewPanel` or another reviewed native Quick Look host inside Zen for strong-native formats, with backend-owned source resolution and no renderer raw-path authority.

A Finder Quick Look Preview Extension remains **conditional / not initially authorized**. It may be activated later in W4 only if Zen owns a custom UTI/file format or a separately reviewed native-preview gap justifies an extension without hijacking standard system ownership.

Existing `MacThumbnailService` / Quick Look thumbnail behavior remains a separate thumbnail authority and is not replaced for architectural symmetry.

### Windows

The concrete native-system target is **Windows Explorer Preview Handler**.

`PreviewHostKind::WindowsQuickPreview` remains reserved but is **not activated by W4-00**. W3 already provides the Zen Floating Quick Preview experience inside the application; W4 must not invent a second global quick-preview product solely because an enum value exists.

A separate Explorer-adjacent/global Windows quick-preview surface may be proposed later only if it demonstrates distinct user value and receives an explicit product/architecture review.

The Windows Preview Handler should prefer `IInitializeWithStream`, run through the normal shell preview-host model, remain read-only/minimal, release all stream/render resources on `Unload`, and avoid opting out of low-integrity isolation merely for implementation convenience.

## Hard architecture boundaries

W4 MUST preserve:

- `PreviewSession` as Preview lifecycle/publication authority;
- the production Provider Registry as provider selection truth;
- backend/sourceVersion freshness and stale-publication rules;
- `MaterializationReadGate` for Zen-owned byte-read/materialization authority;
- `WorkScheduler` for expensive main-process Preview work;
- existing managed/ephemeral source identity authorities;
- existing operation journal / Safe Trash / Restore / filesystem-safety mutation authorities.

W4 MUST NOT:

- expose arbitrary filesystem paths to React/WebView;
- duplicate Preview provider selection in a native shell adapter;
- create a second durable identity database for native shell requests;
- create a second general byte-read/materialization API;
- weaken source identity, permission, package, symlink, File Provider or mutation safety checks;
- implicitly hydrate cloud/provider content outside a platform-authorized request;
- launch the full Zen app UI for every Explorer Preview Handler request as the final architecture;
- disable Windows low-integrity preview isolation as the default solution;
- broadly replace NSIS with MSIX merely to simplify Preview Handler registration;
- add Intel macOS or Linux support;
- add new W3 provider families just because a native host is inconvenient.

If implementation requires a durable authority move, broad permission model, supported-platform change or long-lived privileged bridge outside this initiative, STOP for ADR / architecture review.

## Shared native-host model

The target shape is:

```text
Native host request / OS-owned source
        ↓
platform-native adapter
        ↓
bounded host/source bridge
        ↓
EXISTING Preview contracts / provider representations
        ↓
platform-native host rendering
```

It must not become:

```text
OS path / extension
        ↓
new native parser stack
        ↓
second preview truth
```

`PreviewSourceRef::HostProvided { hostToken }` remains the reserved backend seam for native request ownership. A `hostToken` is opaque and must map backend-side to a bounded request/source descriptor; it is never a disguised path string.

## Windows stream rule

Where Explorer supplies `IStream`, the stream itself is the OS-host request source. W4 should adapt that stream into a bounded native read source and reuse shared provider/representation logic where practical.

This does not mean the native handler receives a renderer/general Zen ReadGate lease. It means W4-00/W4-01 must define a narrow host-provided read adapter whose authority exists only for the shell-owned request lifetime.

A reusable pure provider/representation library may be extracted if necessary, but extraction must preserve one provider contract and one production composition truth. It may not fork providers into app and shell copies.

## macOS source rule

A Zen-internal native Quick Look host may receive a backend-resolved local file URL only inside native/backend code after existing source/read eligibility checks. The URL must not cross the generic renderer wire.

The host must not hold the file open longer than needed and must preserve truthful materialization/File Provider/permission/identity states.

If a future Finder Quick Look extension is activated, its extension-process/source lifecycle must be separately frozen, including sandbox, signing, bundle placement and cancellation.

## Dependency graph

```text
W4-00  Activation + Native Architecture / Experience Freeze        CURRENT
  ↓
W4-01  Shared Native Host Bridge + HostProvided Source Contract
  ↓
 ┌──────────────────────────────────┬────────────────────────────────────┐
 ↓                                  ↓
W4-02 macOS Native Quick Look     W4-03 Windows Preview Handler
      Host / Strong-native              Architecture + Lifecycle Spike
      Format Integration
                                     ↓
                                  W4-04 Windows Explorer Preview Handler
                                        Production Integration
 └───────────────────┬───────────────────────────────────────────────────┘
                     ↓
W4-05  Signing / Packaging / Registration Integration
  ↓
W4-06  Native Accessibility / DPI / Performance / Resource QA
  ↓
W4-07  W4 Closeout
```

W4-02 and W4-03 may proceed in parallel only after W4-01 freezes the shared host/source bridge contract.

W4-05 preparation may begin alongside platform implementation once artifact/bundle/registration shapes are frozen, but final installer/signing acceptance depends on W4-02/W4-04 outputs.

## Track summaries

### W4-00 — Activation + Native Architecture / Experience Freeze

Docs/governance only. Re-verify official Apple/Microsoft/Tauri contracts, freeze W4 product boundaries, dependency graph, host/source model, native packaging assumptions, acceptance matrix and stop conditions. No production/config/package/workflow changes.

### W4-01 — Shared Native Host Bridge

Define and implement the minimum backend/native seam needed for native host requests:

- strict `HostProvided` token lifecycle;
- request/source ownership and freshness;
- host cancellation/unload;
- host capability projection;
- bounded host-provided stream/file adapter without renderer path authority;
- representation ownership across process boundaries where needed;
- deterministic stale/revocation tests.

No platform UI should be built until this contract is stable enough to consume.

### W4-02 — macOS Native Quick Look Host

Apple Silicon / macOS 13+ only.

Initial scope is Zen-internal native Quick Look integration for strong-native formats deferred by W3, prioritizing PDF, Office/iWork and media where system Quick Look is the stronger renderer.

A Finder Quick Look Preview Extension is not part of the initial track unless W4-00 is amended by reviewed evidence showing an appropriate custom/native-preview ownership case.

### W4-03 — Windows Preview Handler Architecture + Lifecycle Spike

Prove, with production-shaped code but bounded scope:

- Rust COM implementation strategy;
- in-proc COM server hosted out-of-process by `prevhost.exe` or another reviewed shell model;
- low-integrity compatibility;
- `IInitializeWithStream` lifecycle;
- `SetWindow` / `SetRect` / `DoPreview` / focus / accelerator / `Unload` behavior;
- child-window rendering approach;
- no full Zen app launch requirement;
- no file lock after `Unload`;
- registration/unregistration test seam.

If this cannot be achieved without a second provider/read authority, stop before W4-04.

### W4-04 — Windows Explorer Preview Handler Production Integration

Turn the accepted W4-03 spike into the supported Explorer Preview Handler for a deliberately frozen extension/content-type matrix.

Prefer formats where Zen materially improves Windows preview coverage. Do not replace built-in system handlers indiscriminately.

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
- file is not locked after close/unload;
- native host startup/useful-render timing;
- install/upgrade/uninstall cleanup.

Hosted compile evidence must never be relabeled as interactive native accessibility/UI proof.

### W4-07 — Closeout

Record merged production baselines, exact-head CI/native evidence, remaining platform limits and W5 handoff. W5 remains inactive until W4 closeout is independently accepted.

## Initial supported-host matrix

| Host | W4-00 status | Initial intent |
|---|---|---|
| `ZenFloating` | existing / W3 | unchanged |
| `ZenPinned` | existing / W3 | unchanged |
| `MacQuickLookExtension` | reserved / not initially activated | only for later reviewed custom/native-extension case |
| macOS internal native Quick Look adapter | W4 planned | strong-native format fallback inside Zen |
| `WindowsQuickPreview` | reserved / inactive | no second product without explicit review |
| `WindowsPreviewHandler` | W4 planned | Explorer Preview Pane integration |

## Initial format strategy

- Keep W3 built-in Text/Code/Markdown/Structured/Table/Image/Folder/ZIP providers as the Zen provider baseline.
- Prefer macOS system Quick Look for strong-native standard formats rather than duplicating PDF/Office/iWork/audio/video renderers.
- On Windows, initially target Preview Handler coverage only where Zen clearly adds value and the handler can render safely/lightly; do not claim universal format parity.
- Native failure must fall back or report unsupported truthfully; no script/macro execution or hidden network resources.

## Packaging reality at activation

Current repository packaging is:

- Tauri 2;
- Windows NSIS, per-machine, with existing installer hooks already managing the Global Index service;
- macOS DMG with minimum macOS 13 and hardened runtime;
- no current app-extension target or Windows Preview Handler binary;
- no current MSIX target.

W4 must extend this packaging deliberately rather than replace it casually.

## Acceptance gate

W4 may close only when:

1. W4-01 proves a bounded native host/source lifecycle without renderer raw paths or second durable authority.
2. macOS native-host behavior is proven for the approved strong-native format scope, or explicitly classified N/A/deferred with truthful rationale.
3. Windows Explorer Preview Handler passes real `Initialize → DoPreview → Unload` lifecycle and no-file-lock evidence.
4. applicable native registration/install/upgrade/uninstall is proven.
5. platform capability differences remain explicit.
6. crash/cancel/unload paths release request, stream/handle, renderer and scheduler resources.
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
- release publication itself; publication remains W5.

## Current state

W4-00 is the only active W4 Track. No production native host is authorized until the W4-00 activation/freeze PR is reviewed and merged.

W5 Release / Hardening remains **NOT AUTHORIZED / NOT ACTIVE**.