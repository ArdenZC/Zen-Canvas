# W4 — Native Integration Implementation Plan

Status: **W4-00 architecture / sequencing freeze**

Activation baseline: `master@43da96b89a7fe99908198b4b7dfeff3fc3bd686e`

Authority: [`../../initiatives/W4-native-integration.md`](../../initiatives/W4-native-integration.md)

Architecture decision: [`../../DECISIONS/0005-native-preview-host-boundary.md`](../../DECISIONS/0005-native-preview-host-boundary.md)

## 1. Objective

W4 connects the completed W3 Preview Platform to native macOS and Windows preview surfaces without replacing PreviewSession, Provider Registry, MaterializationReadGate, WorkScheduler, source identity, mutation or recovery authorities.

The Wave should deliver native value, not superficial cross-platform symmetry.

## 2. Entry truth

W4 starts only after W3 closes at `master@43da96b89a7fe99908198b4b7dfeff3fc3bd686e`.

At entry:

- W3 Floating/Pinned Preview hosts are complete;
- Text/Code/Markdown/Structured/Table/Image/Folder/ZIP providers are production-composed;
- native host enum values exist but fail closed;
- `PreviewSourceRef::HostProvided` exists but is not a usable native request registry yet;
- macOS Quick Look support is thumbnail-only and `PREVIEW_AVAILABLE=false`;
- Windows has no native Preview Handler subsystem;
- Windows packaging is per-machine NSIS with an existing installer-hook authority;
- macOS packaging is DMG, macOS 13+, hardened runtime;
- W5 is inactive.

## 3. Dependency graph

```text
W4-00  Activation + Native Architecture / Experience Freeze
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

### Parallelization rule

- W4-01 is serialized because both platform branches depend on the same reviewed native representation/resource boundary, while only shell-owned requests depend on the `HostProvided` source contract.
- W4-02 and W4-03 may run in parallel after W4-01 merges and closes.
- W4-04 depends on the Windows spike result.
- W4-05 packaging preparation may proceed alongside platform work only after artifact/registration shapes are frozen; final package acceptance waits for platform outputs.
- W4-06 is an integration gate over the merged platform/package result.
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

### W4-01 — Shared Native Host Bridge

Goal: prove the minimum native representation/resource seam plus the separate shell-owned `HostProvided` source lifecycle before either platform UI Track begins.

W4-01 has **two source-ownership paths** and must preserve their distinction.

#### A. Zen-owned in-app native-backed path

This path is consumed later by W4-02.

Required outcomes:

1. existing `ManagedFile` / `EphemeralBrowse` source identity and sourceVersion remain authoritative;
2. existing `ZenFloating` / `ZenPinned` host identity remains authoritative;
3. host-bound `NativeOpaque` representation ownership/lifetime is explicit for the matching Zen host;
4. any native representation token is request/sourceVersion/host-bound, opaque and lifecycle-revoked;
5. source switch/cancel/dispose releases native representation/view/resource state without creating a `HostProvided` source;
6. stale publication remains rejected by existing PreviewSession request/sourceVersion authority.

#### B. OS/shell-owned HostProvided path

This path is consumed by W4-03/W4-04 and by a future Finder Preview Extension only if separately authorized.

Required outcomes:

1. strict bounded backend/native registry for `HostProvided` request tokens;
2. explicit shell request owner + activated native host kind + source/freshness state;
3. bounded create/resolve/cancel/unload/revoke lifecycle;
4. stale/unknown/reused token fail-closed behavior;
5. bounded host-provided file/stream read adapter with no generic renderer path/read authority;
6. tests proving no host token survives unload/revoke and shell-owned resources return to baseline.

#### Shared outcomes

1. provider/representation logic may be reused without forking a second production provider truth;
2. native representation/asset ownership rules are suitable for the consuming process/host;
3. bounded native renderer/resource admission and cleanup have explicit owners;
4. capability projection activates only reviewed consumers and does not activate `MacQuickLookExtension` or `WindowsQuickPreview` by implication;
5. cross-process cancellation/resource accounting is defined where a real process boundary exists;
6. shared helpers never unify the two paths by re-tokenizing Zen-owned Managed/Ephemeral sources as `HostProvided`.

Non-goals:

- no macOS final native UI;
- no Windows Explorer registration;
- no broad provider additions;
- no package migration.

Stop if the implementation requires a second Provider Registry, second ReadGate, competing source identity model or durable native-path/token database.

### W4-02 — macOS Native Quick Look Host / Strong-native Formats

Target: supported Apple Silicon macOS 13+.

Goal: integrate system-native preview capability inside Zen for strong-native standard formats W3 intentionally deferred.

Initial format priority for real fixture evaluation:

1. PDF;
2. Office documents where system Quick Look is present;
3. iWork documents where system Quick Look is present;
4. audio/video/media where a bounded native host is appropriate.

Required behavior:

- source remains the existing managed/ephemeral Preview source and is resolved backend/native-side after existing eligibility checks;
- host remains `ZenFloating` / `ZenPinned`; the native-backed representation uses `NativeOpaque` or a narrowly reviewed equivalent, not `MacQuickLookExtension`;
- no `HostProvided` token is created merely because the final representation is native-backed;
- no raw source path crosses generic React/Tauri Preview wire;
- host presentation follows native semantics rather than reproducing Zen Floating chrome inside native content;
- switching/cancel/close returns native resources to baseline;
- provider/native failure preserves existing terminal/fallback truth;
- File Provider/materialization state is not silently converted to hydration;
- existing `MacThumbnailService` remains separate unless an evidence-backed replacement is independently accepted.

Finder Quick Look Preview Extension is not part of this initial Track.

### W4-03 — Windows Preview Handler Architecture + Lifecycle Spike

Goal: resolve the high-risk Windows shell/process questions before full product integration.

Must prove:

- Rust COM strategy and build artifact shape;
- shell-hosted out-of-process model compatible with normal Preview Handler isolation;
- `IInitializeWithStream` source ingestion where feasible;
- `HostProvided` request ownership is limited to the Explorer/shell-owned request lifetime;
- `IObjectWithSite`, `IOleWindow`, `IPreviewHandler` lifecycle shape;
- `SetWindow` / `SetRect` resize correctness;
- `DoPreview` deferred work rather than eager Initialize parsing;
- focus / accelerator handling shape;
- `Unload` hard cleanup;
- no file lock after Unload;
- corrupt/unsupported request isolation;
- no requirement to launch the full Zen application UI;
- deterministic test registration/unregistration seam.

The spike must be production-shaped but need not register broad file associations yet.

### W4-04 — Windows Explorer Preview Handler Production Integration

Goal: ship the accepted W4-03 architecture into Explorer Preview Pane for a deliberately frozen supported-content matrix.

Selection rules:

- Zen must add real user value versus existing Windows handlers;
- no broad claiming of file types solely to increase coverage numbers;
- do not override stronger system/native handlers without a reviewed reason;
- script/macro/external-resource behavior stays inert;
- no persistent file lock;
- repeated preview/unload is resource-stable.

The exact association matrix is frozen in W4-04 after the spike proves renderer/process viability.

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
- source switch/cancel/close;
- File Provider/materialization cases where genuine fixtures exist;
- Retina/multi-display behavior;
- VoiceOver/manual keyboard evidence when actually executed.

Windows:

- real Explorer Preview Pane behavior;
- `Initialize → DoPreview → Unload` lifecycle;
- resize/DPI/multi-display;
- focus/accelerator/keyboard;
- Narrator evidence when actually executed;
- repeated preview/unload steady state;
- no file lock after Unload;
- install/upgrade/uninstall cleanup.

Shared:

- corrupt/unsupported/permission/unavailable/identity-changed states;
- no script/macro/network side effects;
- bounded handles/streams/assets/helpers;
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
| Zen in-app native representation | host-bound NativeOpaque/native adapter tied to existing Preview lifecycle |
| OS/shell-owned native request source | bounded request-scoped HostProvided registry/adapter |
| Zen byte-read/materialization | existing MaterializationReadGate |
| OS-owned native stream/handle | request-scoped native adapter only |
| Main-process expensive work | existing WorkScheduler |
| Native-process local limits | bounded process-local admission, not product provider authority |
| File mutation/recovery | existing file_ops / journals / Safe Trash / Restore |
| Windows registration | W4-05 installer integration |
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
```

Unsupported capability is reported as unsupported/N/A, not emulated with unsafe parity.

## 7. Security rules

Binding for all tracks:

- Preview read-only;
- no macro/script execution;
- no archive extraction because a native host exists;
- no hidden network resource fetch;
- no implicit cloud hydration;
- no arbitrary renderer raw path;
- no durable shell-path cache;
- no arbitrary third-party plugin loading;
- no downgrade of identity because an OS shell supplies the source;
- no broad low-integrity opt-out on Windows without separate review.

## 8. Performance / resource targets

Freeze exact numeric host targets only after W4-02/W4-03 establish real platform baselines. Until then:

- shell/native host presentation must begin promptly;
- first useful representation should preserve Quick Preview flow and target approximately <=1 s for local supported native fixtures where reasonable;
- close/unload must promptly release file/stream/asset/native renderer resources;
- repeated cycles must reach steady state;
- full Zen UI startup must not be the Windows handler steady-state cost.

Do not lower W3/Query/File Library thresholds to make W4 pass.

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

## 10. W5 boundary

W5 owns release/hardening, not W4 feature spillover.

W4 may perform the native packaging/signing work required to prove its native integration is installable. Actual final release publication, update-channel readiness and release-wide polish remain W5.
