# ADR-0006 — Windows Preview Handler Bounded-Capture Source Model

Status: **Accepted for W4-03 recovery when this governance amendment merges**

Date: 2026-08-26

Supersedes: the Windows Preview Handler stream-lifetime assumptions in [ADR-0005](0005-native-preview-host-boundary.md). ADR-0005 remains authoritative for the overall native Host/Adapter boundary, macOS Native Preview Access, opaque `HostProvided` ownership, shell isolation and packaging boundaries.

Evidence record: [`../tasks/W4-03-WINDOWS-PREVIEW-HANDLER-SPIKE-STOP-RESULT.md`](../tasks/W4-03-WINDOWS-PREVIEW-HANDLER-SPIKE-STOP-RESULT.md)

## Context

W4-03 PR #146 implemented a production-shaped Windows Preview Handler spike around the original W4 source-lifetime assumption:

```text
Explorer / preview-host IStream
→ standard COM marshal to detached MTA worker
→ request-long HostProvided IStream adapter
→ bounded asynchronous Seek / Read
→ owner-STA publication
→ Unload attempts COM call cancellation
```

The spike successfully proved several independent parts of the Windows host contract:

- a dedicated Windows-only COM DLL / class-factory artifact;
- `IInitializeWithStream`, `IObjectWithSite`, `IOleWindow` and `IPreviewHandler` object/lifetime shape;
- one child HWND with `SetWindow` / `SetRect` geometry;
- owner-STA completion publication after exactly one `DoPreview`;
- generation-scoped stale-publication rejection;
- raw `GetWindow` and `TranslateAccelerator` HRESULT correctness;
- `DllCanUnloadNow` protection while detached DLL-owned work remains active;
- completed-read file-stream release and rename/move/delete evidence;
- no full Zen UI startup, renderer raw path or second durable HostProvided registry.

However, deterministic cancellation-limit experiments at PR #146 head `11fd3729770266f191ea7799edbc2b867693c181` disproved the required hard-Unload guarantee for the request-long `IStream` model.

The experiments used standard COM marshaling and covered:

1. cancellation after client-side work is marked active but before the real outbound COM call;
2. cancellation after `Seek` but before `Read`;
3. a non-agile, standard-marshaled, non-cooperative `IStream` whose server-side `Read` does not call `CoTestCancel` and holds a real Windows file handle that blocks write/rename/delete.

The decisive observation was that `CoCancelCall` could return `S_OK` while the non-cooperative server-side `Read` remained active and its real file lock remained held. Publication authority could be revoked and client-side worker accounting could quiesce without proving source-side resource release.

This matches Windows COM cancellation semantics: call cancellation is a request against a pending synchronous call, and a server may observe cancellation with `CoTestCancel`; a successful cancellation request is not a universal forced-termination primitive for an arbitrary non-cooperative COM server.

Therefore the original combination of these two requirements is not supportable as a universal contract:

```text
request-long arbitrary shell IStream used by deferred worker
+
Unload always forces that arbitrary call/source lock to end before returning
```

W4 Stop Condition #5 is confirmed for that architecture.

## Decision

### 1. Reject request-long asynchronous shell-IStream ownership

W4-03 v2 MUST NOT carry the shell-provided `IStream`, an unmarshaled proxy, a clone, or a shell file handle into deferred provider/render work.

The following production topology is rejected:

```text
IStream
→ marshal / worker
→ asynchronous request-long Seek/Read
→ Unload-time COM cancellation as correctness mechanism
```

`CoCancelCall` may remain useful as defensive diagnostics in experiments, but W4 correctness MUST NOT depend on it terminating arbitrary source work.

### 2. Use capture-before-defer

The Windows Preview Handler source lifecycle becomes:

```text
Explorer / preview host
→ IInitializeWithStream::Initialize
   → retain the shell IStream only
   → no content read
   → no provider/render work

→ SetWindow

→ IPreviewHandler::DoPreview
   → create/prepare the child preview surface
   → on the owning apartment, perform one strictly bounded ingress capture
   → copy captured bytes into Zen-owned immutable memory
   → determine truthful Complete/Partial ingress state from observed stream facts
   → release every handler-owned shell IStream reference
   → only after release, register/use request-scoped HostProvided over the captured memory
   → only after release, start deferred provider/representation/render work

→ deferred work
   → may use Zen-owned immutable bytes, generation/token state and renderer resources
   → must not possess IStream, shell file handle or decoded raw path authority

→ Unload
   → invalidate generation/publication
   → revoke HostProvided
   → cancel/finish Zen-owned work
   → destroy child HWND
   → release representation/snapshot/site/frame state
```

The important phase boundary is:

```text
successful ingress capture completes
→ shell IStream ownership ends
→ deferred preview work begins
```

### 3. Freeze the W4-03 v2 capture ceiling at 512 KiB

The v2 spike uses a fixed source-prefix capture ceiling of **512 KiB**.

Rationale:

- W3 Text / Source Code / Markdown providers already use a 512 KiB bounded prefix and truthfully represent `Complete` versus `Partial` content;
- W4-01 `HostProvidedConfig` already caps an individual bounded read at 1 MiB by default;
- 512 KiB is sufficient to prove shared text/code/Markdown representation feasibility without introducing whole-file staging or a new resource authority.

W4-04 may freeze a different per-format capture rule only after real Explorer/prevhost evidence and independent architecture review. It MUST NOT exceed the accepted W4-01 HostProvided bound or introduce whole-file hidden staging merely to widen coverage without a separate reviewed contract change.

### 4. `HostProvided` survives; the original shell stream does not

ADR-0005 remains correct that an Explorer request is shell-owned and maps to an opaque request-scoped `HostProvided` capability.

ADR-0006 narrows what backs that capability during the deferred phase:

```text
before capture:
  shell-owned IStream is the authoritative ingress source

after capture:
  Zen-owned immutable bounded snapshot is the HostProvidedReadSource
```

The `hostToken` may remain valid for the Preview request lifetime. The original `IStream` MUST NOT.

The memory-backed HostProvided source must be:

- immutable;
- process-local;
- bounded;
- non-durable;
- pathless;
- free of COM/file-handle ownership;
- destroyed with request/token lifecycle.

### 5. Preserve shell isolation and stream-first initialization

W4 continues to prefer `IInitializeWithStream` and the normal Preview Handler surrogate-host model.

This decision does not authorize:

- `IInitializeWithFile` as a convenience fallback;
- filesystem-path reconstruction from the stream;
- low-integrity isolation opt-out;
- launching `zen-canvas.exe` for every shell preview;
- a durable helper/service solely to retain source state.

### 6. Narrow the supported stream contract truthfully

Windows does not provide Zen with a general primitive that forcibly terminates every possible adversarial/non-cooperative synchronous `IStream::Read` implementation.

Therefore W4 MUST NOT claim this universal guarantee:

```text
any arbitrary custom IStream can block forever and Zen can still force DoPreview/Unload to complete within a fixed bound
```

Instead, production acceptance is evidence-based and scoped to the real Explorer/preview-host stream behavior of the deliberately registered W4-04 content matrix.

Before W4-04 can activate an association, real host evidence must show that the bounded ingress capture:

- completes within the reviewed responsiveness budget on representative local fixtures;
- releases the handler-owned shell stream before deferred rendering;
- does not leave the source write/rename/move/delete locked by Zen after capture;
- remains compatible with normal Preview Handler isolation;
- fails locally and truthfully when capture cannot produce a supported representation.

The non-cooperative fixture remains a permanent negative architecture regression: it proves why request-long shell-stream ownership must never return. It is not a promise that W4 supports hostile custom COM servers that never return from `Read`.

### 7. Share a pure representation kernel, not app authority

W4-04 must reuse representation logic without linking the full Tauri runtime into the shell DLL and without copying a second provider tree.

The approved extraction direction is a narrow pure kernel around logic equivalent to:

```text
bounded bytes + truthful completeness + safe metadata hints
→ safe inert representation
```

Candidate reusable logic includes bounded text decoding, source-code language presentation hints and sanitized Markdown representation.

The shared kernel MUST NOT own or import:

- `PreviewSession`;
- the production Provider Registry composition owner;
- `ManagedFile` / `EphemeralBrowse` resolution;
- `MaterializationReadGate`;
- `WorkScheduler`;
- Tauri commands/runtime;
- SQLite/app state;
- COM/HWND lifecycle;
- filesystem path authority.

The Zen app path keeps its existing provider/read authorities; the shell path supplies already captured bounded bytes to the same pure representation logic.

### 8. Unload correctness changes from forced source cancellation to source absence

The v2 hard-cleanup invariant is:

```text
before deferred rendering is allowed:
  handler-owned shell IStream refs == 0
  handler-owned shell file handles == 0
  shell IStream COM calls in flight == 0
```

Therefore `Unload` MUST NOT need to wait for or cancel a shell `IStream` call in the accepted steady-state deferred phase.

`Unload` still remains a hard cleanup boundary for everything Zen owns after capture:

- publication/generation authority;
- HostProvided memory snapshot/token;
- provider/representation work;
- child HWND/native rendering resources;
- site/frame/request state.

### 9. W4-03 v1 PR #146 is evidence, not mergeable product history

PR #146 / branch `feat/w4-windows-preview-handler-spike` is retained as architecture-spike provenance and MUST NOT be merged into `master` as the production basis for W4-04.

Its accepted reusable findings are recorded in the stop-result document. Its request-long asynchronous shell-IStream model is rejected.

W4-03 v2 starts from the canonical master produced after this governance amendment, not from PR #146 history.

## Required W4-03 v2 evidence

The replacement spike must deterministically prove at minimum:

1. `Initialize` performs zero content reads;
2. `DoPreview` performs no more than the frozen bounded capture;
3. after successful capture and before deferred work, the handler has released its shell `IStream` ownership;
4. deferred provider/render work has no `IStream`, shell HANDLE or raw source path;
5. the memory-backed HostProvided source is bounded and generation-scoped;
6. one-`DoPreview` owner-STA publication and stale-generation suppression remain correct;
7. `GetWindow`, focus and accelerator ABI behavior remains correct;
8. completed capture makes the real file rename/move/delete-capable before deferred rendering/Unload where the controlled fixture models normal Explorer ownership;
9. repeated `Initialize → DoPreview → Unload` reaches steady state;
10. `Unload` never depends on `CoCancelCall` to release the original source;
11. a narrow shared bytes-to-representation kernel can be reused without creating a second provider/read/source authority;
12. real Explorer/prevhost behavior remains explicitly `UNVERIFIED` until actually executed.

## Consequences

### Positive

- removes an impossible arbitrary-COM forced-cancellation requirement from the production architecture;
- makes the shell source lifetime strictly shorter than deferred Preview lifetime;
- lets `Unload` clean up only resources Zen actually controls;
- preserves stream-first shell isolation and opaque HostProvided identity;
- reuses W3 bounded-prefix semantics instead of adding whole-file staging;
- creates a narrow, reviewable provider-reuse seam for W4-04.

### Costs

- `DoPreview` performs a bounded synchronous ingress read before deferred rendering can start;
- W4-03 v2 and W4-04 must measure this capture against real Explorer/prevhost responsiveness;
- initial Windows format scope must remain conservative and aligned with bounded-prefix representations;
- formats requiring complete/random-access/large-file source ownership are not automatically eligible for the first Windows matrix.

## Rejected alternatives

### A. Keep the marshaled IStream worker and add more cancellation checks

Rejected. Extra admission checks can close client-side races but do not force a non-cooperative server-side `Read` or source lock to terminate.

### B. Wait in `Unload` with a fixed timeout

Rejected. A timeout cannot create a correctness guarantee; returning after the timeout can still leave the source locked, while waiting indefinitely can hang the shell host.

### C. Terminate the worker thread

Rejected as unsafe and incapable of proving COM/server-side resource cleanup.

### D. Disable normal Preview Handler isolation or launch the full Zen app

Rejected by ADR-0005 security/product boundaries.

### E. Copy the entire source into a hidden temp file

Rejected for W4-03 v2 because it creates whole-file latency/resource pressure solely to avoid source-lifetime design. Windows initial scope should instead align with bounded representations. Any later complete-file staging model requires a separate evidence-backed decision.

### F. Maintain a second Windows-only parser/provider tree

Rejected because provider safety/capability truth would drift from W3.

## Revisit triggers

Revisit this decision only if:

- real Explorer/prevhost streams cannot meet the bounded capture responsiveness needed even for the conservative initial matrix;
- the pure representation seam cannot be extracted without moving/duplicating Preview authority;
- a required Windows format needs a fundamentally different source model;
- normal Preview Handler isolation cannot host the approved v2 renderer safely;
- a future Windows API provides a materially stronger source/cancellation primitive and a separate review accepts it.
