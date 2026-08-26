# W4-03 — Windows Preview Handler Spike — Stop Result

Status: **ARCHITECTURE STOP — Stop Condition #5 confirmed**

Date: 2026-08-26

Track: W4-03 Windows Preview Handler Architecture + Lifecycle Spike

PR: #146 — `W4-03: prove Windows Preview Handler lifecycle spike`

Spike branch: `feat/w4-windows-preview-handler-spike`

Final evidence head: `11fd3729770266f191ea7799edbc2b867693c181`

Final evidence tree: `133ca9be6eb5ca38524c98610b32facfeb51f2cd`

Canonical master during stop decision: `768d7bbabe7513c2ff9fc95363144320997db399`

Architecture replacement: [`../DECISIONS/0006-windows-preview-handler-bounded-capture.md`](../DECISIONS/0006-windows-preview-handler-bounded-capture.md)

## 1. Purpose

W4-03 existed to answer the high-risk Windows shell questions before W4-04 production association work. It was intentionally a production-shaped spike, not a broad Explorer registration implementation.

The spike was required to prove or stop on the `IInitializeWithStream` / `IPreviewHandler` lifecycle, shell-owned HostProvided source ownership, native child-window behavior, deterministic cleanup, file-lock release and a safe path to shared representation logic.

The spike reached a valid architecture-stop result. It is not a failed attempt that should be repaired until green; its final experiments disprove one of the original source-lifetime assumptions and therefore trigger an ADR revision before production scope continues.

## 2. Accepted reusable findings

Independent exact-head audits accepted these parts of the spike design before the stop-condition investigation:

- dedicated Windows-only COM DLL / `cdylib` topology rather than converting the main Tauri app into a COM server;
- normal Preview Handler class-factory / reference-lifetime shape;
- `IInitializeWithStream`, `IObjectWithSite`, `IOleWindow` and `IPreviewHandler` interface structure;
- one child HWND owned by the Preview Handler and constrained by `SetWindow` / `SetRect`;
- repeated handler reuse across `Initialize → DoPreview → Unload → Initialize` generations;
- owner-STA completion notification using a message-only window, so asynchronous Zen-owned completion does not depend on a second COM method call;
- generation/token/child-HWND revalidation before publication, preventing stale notifications from repainting a newer generation;
- `QueryFocus` returning the current thread `GetFocus()` result;
- raw ABI `IOleWindow::GetWindow` behavior: `E_FAIL` without a child and `S_OK` with the active child;
- raw `IPreviewHandlerFrame::TranslateAccelerator` HRESULT propagation, including exact `S_FALSE` preservation;
- `DllCanUnloadNow` remaining `S_FALSE` while detached DLL-owned work is still active;
- completed-read file-backed stream release with reopen/write/rename/move/delete evidence;
- no main Zen UI launch, no filesystem-path reconstruction from the stream, no renderer raw-path authority and no second durable HostProvided registry.

These findings may be reused by W4-03 v2 if they remain compatible with the replacement source model.

## 3. Rejected v1 source model

The original W4-03 source path was:

```text
Explorer / preview host IStream
→ standard COM marshal packet
→ detached MTA worker
→ request-long HostProvided IStream adapter
→ synchronous Seek / Read on worker
→ owner-STA publication
→ Unload attempts cancellation with CoCancelCall
```

This model was intended to keep `Initialize` lightweight and move bounded source work out of the handler STA.

The decisive problem is that it also required `Unload` to turn arbitrary in-flight synchronous COM stream work into a hard source-release boundary. Windows COM cancellation does not provide that universal guarantee.

## 4. Deterministic cancellation-limit experiments

Commit `11fd3729770266f191ea7799edbc2b867693c181` added deterministic, feature-gated architecture experiments without changing normal non-observability production semantics.

The harness covers three cases.

### 4.1 Cancellation before the real outbound COM call

A barrier pauses the worker after the client-side cancellation state reports active work but before the actual `IStream::Seek`/`Read` call is made.

Observed architecture fact:

```text
client marks work active
→ Unload requests cancellation
→ there is not yet a pending outbound call to cancel
→ later stream operation can still be admitted
```

Therefore a client-side `call_active` flag is not equivalent to a COM-runtime cancellation object for a future call.

### 4.2 Cancellation between `Seek` and `Read`

A second barrier pauses after `Seek` completes and before `Read` begins.

Observed architecture fact:

```text
Seek completes
→ Unload requests cancellation
→ later Read can still be admitted unless the client explicitly rejects it before call entry
```

This race can be narrowed with additional client-side cancellation checks, but doing so does not solve the more fundamental server-side blocking case below.

### 4.3 Non-cooperative standard-marshaled `IStream` with a real file lock

The decisive fixture is:

- non-agile;
- standard-marshaled across apartments;
- backed by a real Windows file HANDLE opened with sharing that blocks write/rename/delete;
- server-side `Read` genuinely blocks;
- server-side `Read` does **not** call `CoTestCancel`;
- server-side `Read` does not observe HostProvided cancellation;
- no private cancellation callback releases it before the acceptance observation;
- manual teardown/unblock happens only after the diagnostic result is captured.

The hosted Windows experiment observed the Stop Condition shape:

```text
manual_unblock_before_assertion = false
CoCancelCall was attempted and returned S_OK
HostProvided publication authority was revoked
client-side worker/accounting could quiesce
server-side Read had not exited
real file write/rename/delete remained blocked
```

This proves:

```text
successful cancellation request
!=
forced termination of arbitrary non-cooperative server-side IStream work
```

and:

```text
publication revocation / client quiescence
!=
source-side resource release
```

## 5. Hosted evidence identity

GitHub Actions run: `32937430033`

Run head: `11fd3729770266f191ea7799edbc2b867693c181`

Run event: PR #146

Overall run conclusion: **failure**.

The overall run MUST NOT be relabeled as a green exact-head CI run.

Relevant exact-head Windows job:

- `Rust quality (windows-latest) (head_validation)`
- job id `98081436225`
- head `11fd3729770266f191ea7799edbc2b867693c181`
- conclusion: **success**

That Windows head-validation lane built and executed the W4-03 native spike/harness at the evidence head. Its architecture-limit output is evidence for the Stop Condition; the overall workflow failure does not convert that finding into a PASS for the PR.

The full CI run also contained a separate merge-integration failure outside the cancellation architecture finding. That failure is not used as evidence for or against Stop Condition #5 and does not make PR #146 mergeable product work.

## 6. Stop Condition #5 conclusion

The frozen W4 contract required W4-03 to stop before W4-04 if the chosen Windows source model could not reliably cancel work and release the stream/file lock at the hard cleanup boundary.

That stop condition is confirmed for the v1 request-long asynchronous `IStream` architecture.

Final truth:

| Property | v1 result |
|---|---|
| publication revocation on Unload | proven |
| stale-generation publication suppression | proven |
| cooperative COM cancellation | proven |
| cancellation-admission races | reproduced |
| arbitrary non-cooperative synchronous `IStream::Read` forced termination | **not guaranteed / disproven as universal contract** |
| source-side file-lock release solely because `CoCancelCall` returned `S_OK` | **not guaranteed** |
| request-long shell `IStream` suitable as deferred production source | **rejected** |
| W4-04 dependency gate | **remains blocked** |

## 7. Governance consequence

PR #146 is architecture-spike provenance and MUST NOT be merged into `master` as the production foundation for W4-04.

The source model is replaced by ADR-0006:

```text
IInitializeWithStream
→ retain stream only
→ DoPreview performs one bounded ingress capture
→ copy to Zen-owned immutable memory
→ release shell IStream
→ only then begin deferred provider/render work over memory-backed HostProvided source
→ Unload cleans only Zen-owned request/render resources
```

W4-03 v2 must start from the canonical master after the ADR-0006 governance amendment merges. It must not inherit PR #146 history by rebase/cherry-pick as its implementation baseline.

## 8. What remains unverified

PR #146 never claimed these as completed:

- real `prevhost.exe` loading;
- real Explorer Preview Pane interaction;
- real low-integrity host behavior;
- production CLSID / extension association matrix;
- NSIS registration / upgrade / repair / uninstall;
- manual DPI, multi-display, Narrator and visual interaction QA.

Those remain downstream evidence requirements. They do not weaken the Stop Condition, which concerns the source-lifetime model itself.

## 9. Track state after this result

```text
W4-02 macOS Native Quick Look:
  independent; may continue under its accepted W4-01 source model

W4-03 v1 request-long IStream spike:
  STOPPED / architecture rejected

W4-03 v2 bounded-capture spike:
  becomes authorized only through the ADR-0006 governance amendment

W4-04 Windows production integration:
  BLOCKED until W4-03 v2 is independently accepted

W4-05+:
  remain subject to the existing dependency graph

W5:
  NOT AUTHORIZED / NOT ACTIVE
```
