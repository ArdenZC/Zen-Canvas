# W4-03 v2 — Windows Preview Handler Bounded-Capture Current Truth

Status: **COMPLETE / CLOSED**

Last verified: 2026-08-27

## Canonical identities

- Production PR: **#151** — `feat: W4-03 v2 Windows Preview Handler bounded capture`.
- Final reviewed PR head: `19e51d5e2eed175a0eda18a02b47d82c97cc289b`.
- Final reviewed tree: `f357be042c493d0cefd98be8e02d768210ac1f6b`.
- Squash merge: `master@55571e6fc4fbd9a9eedc0f474dff28b113072b67`.
- Canonical merge tree: `f357be042c493d0cefd98be8e02d768210ac1f6b`.
- Parent/current-truth baseline before merge: `d3d91dbdc9bfa8278eb1afc30be6c98f830fae08`.

The squash-merge tree is exactly the final reviewed PR tree.

## Architecture decision

W4-03 v2 closes the Windows architecture spike using ADR-0006 **capture-before-defer**. The rejected W4-03 v1 request-long shell-`IStream` design remains historical stop evidence only and was never merged.

Accepted Windows source lifecycle:

```text
IInitializeWithStream::Initialize
→ retain shell IStream only
→ zero content reads

DoPreview
→ owner-apartment bounded ingress capture
→ at most 512 KiB total source bytes for the v2 spike
→ truthful Complete / Partial state
→ immutable Zen-owned memory snapshot
→ release every handler-owned shell IStream reference
→ only then create memory-backed HostProvided state
→ only then begin deferred representation/render work

Deferred work
→ bounded immutable memory + request/generation/token state
→ no IStream / marshaled proxy / clone
→ no shell file HANDLE
→ no reconstructed source path

Unload
→ invalidate publication/generation
→ revoke HostProvided memory request
→ release Zen-owned deferred/native resources
→ never depend on CoCancelCall to release the original source
```

This preserves the existing Preview/provider/read/identity authorities. The shell DLL does not import `PreviewSession`, app Provider Registry composition, `MaterializationReadGate`, Tauri runtime, database authority or renderer-visible filesystem paths.

## Shared HostProvided / representation result

PR #151 extracted/reused one shared native HostProvided implementation and one pure bounded representation kernel rather than introducing app/shell forks.

Accepted boundaries:

- W4-01 HostProvided remains opaque, request/generation-bound, bounded, revocable and non-durable;
- app and Windows shell paths reuse the same HostProvided semantics without sharing process-local registry instances as global durable authority;
- Text / Source Code / Markdown reuse one pure `bounded bytes + completeness + inert hints → safe representation` kernel;
- Markdown remains sanitized/inert;
- no source resolver, filesystem authority, PreviewSession or renderer-general byte API moved into the shared crates.

## COM / window / lifecycle result

Accepted implementation proves:

- dedicated Windows Preview Handler COM DLL / class factory;
- `DllGetClassObject` and `DllCanUnloadNow` lifecycle;
- `IInitializeWithStream`, `IPreviewHandler`, `IOleWindow`, `IObjectWithSite`;
- one reusable child HWND;
- `SetWindow` / `SetRect` behavior;
- owner-apartment completion publication through a private Zen message-only window class;
- stale-generation rejection;
- raw `GetWindow` and frame `TranslateAccelerator` HRESULT behavior;
- repeated `Initialize → DoPreview → Unload → Initialize` lifecycle;
- RAII deferred-work accounting and generation-exact failed-admission rollback.

## Controlled Windows evidence

The final Windows-native hosted lane builds/tests the independent native workspace and executes the controlled external harness. It proves:

- `Initialize` performs zero content reads;
- total ingress capture is bounded to 512 KiB;
- `Complete` / `Partial` is truthful;
- handler-owned shell source is released before deferred admission;
- three-generation stale publication is rejected;
- write/open, rename, move and delete succeed after successful capture while deferred work is held;
- completion HWND recreation and native resource baselines recover;
- HostProvided and `DllCanUnloadNow` return to baseline;
- the permanent non-cooperative COM cancellation fixture still proves that `CoCancelCall(S_OK)` is not a universal source-release guarantee.

The production v2 architecture therefore does not rely on the v1 cancellation assumption.

## Real Explorer / prevhost evidence

Real Windows shell acceptance was executed against the native handler source state at `886fb0658816c75d5173e572276f1f6e0e8a5ab0` using the test-only isolated registration seam.

Handler DLL SHA-256:

`51C89F1746E95314D6715DB296339C0A6DC44928136919E52432F65EBAC7F29A`

Observed results:

- isolated HKCU test Preview Handler registration: **PASS**;
- `CoCreateInstance` for the dedicated test CLSID: **PASS**;
- normal Preview Handler isolation preserved; `DisableLowILProcessIsolation` was not set;
- custom handler DLL loaded by `prevhost.exe`: **PASS**;
- Explorer Preview Pane fixture A/B selection rendered correctly: **PASS**;
- stale A did not replace current B: **PASS**;
- write/open, rename, move and delete succeeded while preview remained active after bounded capture: **PASS**;
- exact test registry cleanup: **PASS**;
- fixture cleanup: **PASS**;
- loaded custom-module count returned to baseline: **PASS**.

The two final commits after that real-host source state are CI/test-isolation-only:

- `685bdfc7333ef13006be9004926c587809501eb5` — native workspace RustSec/dependency routing and shared Preview performance routing;
- `19e51d5e2eed175a0eda18a02b47d82c97cc289b` — deterministic Folder Preview test-local scheduler isolation.

Neither modifies the Windows handler, real-host registration seam, controlled harness, HostProvided implementation or shared representation kernel. The real-host-tested native artifact is therefore native-equivalent to the final PR tree.

## Independent review record

Independent ChatGPT audit remained the acceptance authority; no Codex Review was used.

- Core bounded-capture / COM / lifecycle audit: review `#5032769265` — code/architecture blockers = 0 after remediation.
- Real-host / integration evidence audit: review `#5032891624` — real Explorer/prevhost viability accepted; hosted gate remained explicit until completion.
- CI-contract P2 re-audit: review `#5034153959` — native RustSec coverage and shared Preview performance routing accepted; both review threads resolved.
- Final Folder Preview isolation / exact-head audit: review `#5035858384` — blockers = 0.

## Final hosted CI

Final exact-head hosted run:

- Run: `33008914117`.
- Head: `19e51d5e2eed175a0eda18a02b47d82c97cc289b`.
- Base: `d3d91dbdc9bfa8278eb1afc30be6c98f830fae08`.
- Conclusion: **SUCCESS on attempt 1**.

Applicable successful gates include:

- source checkout / evidence contract;
- merge-integration / validation lane plan;
- Windows native Preview Handler build/tests/clippy/harness;
- Windows Rust quality under the default parallel runner;
- macOS Rust quality, serial race validation and Apple Silicon native Quick Look lifecycle;
- Dependency audit covering both `src-tauri/Cargo.lock` and `src-tauri/native/Cargo.lock`;
- Preview Platform performance routing for shared native Preview crates;
- frontend/browser gates;
- Windows/macOS release compile;
- Native macOS performance;
- applicable performance shards/profile;
- Windows/macOS aggregate quality.

The historical Folder Preview CI flake was closed by making the test fixture scheduler test-local without changing production scheduler ownership, weakening assertions, serializing the suite, adding sleep or retry, or changing W4-03 native behavior.

## Completion decision

W4-03 v2 is **COMPLETE / CLOSED**.

The accepted facts are sufficient to retire the architecture spike gate:

- ADR-0006 capture-before-defer is implemented and independently accepted;
- the request-long v1 topology remains prohibited;
- bounded source release is proven by controlled harness and real Explorer/prevhost evidence;
- native process/window/resource lifecycle is exact-head tested;
- CI/security/performance routing for the new shared/native workspace is fail-closed;
- final hosted validation is green on the merged tree.

## W4-04 authorization

W4-04 — **Windows Explorer Preview Handler Production Integration** — is now **AUTHORIZED / NEXT**.

W4-04 does **not** reopen the source architecture. It owns productization of the accepted v2 handler:

- freeze a deliberately narrow production extension/content-type association matrix;
- prefer text/code/Markdown-style families where Zen materially improves Windows Preview coverage and bounded capture is a natural fit;
- do not seize stronger built-in PDF/Office/media handlers for parity or coverage numbers;
- integrate production registration/association behavior with existing Windows packaging authority;
- preserve normal Preview Handler isolation;
- prove install/upgrade/repair/uninstall association cleanup and real Explorer behavior for the accepted matrix;
- keep the 512 KiB v2 capture model unless a separate reviewed evidence/budget decision explicitly changes it;
- retain one HostProvided/representation truth and all existing W3/W4 authority boundaries.

W4-05+ remain downstream-gated by the existing W4 dependency graph. This closeout does not activate W4-05, W4-06, W4-07 or W5 by implication.
