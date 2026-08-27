# W4-04 — Windows Explorer Preview Handler Production Integration — Codex / Agent Brief

Status: **AUTHORIZED / NEXT — canonical implementation brief once this taskbook merges**

Taskbook PR base: `master@46a23d26e756aced58278cb6594cc7abc863605e`; tree `ee9ba93b018f24213f96b034cf8a898284cdb1b8` (PR #153 W4-03 v2 current-truth closeout).

Implementation branch: `feat/w4-windows-preview-handler-production-integration`

Implementation baseline: **the exact squash-merge commit produced by this taskbook PR**. That SHA is intentionally not guessed here. Immediately after this docs PR merges, the governance owner creates the implementation branch above directly from the exact taskbook merge commit; that branch HEAD becomes the frozen W4-04 execution baseline.

W4-03 v2 is **COMPLETE / CLOSED**. W4-04 productizes the accepted handler; it does not reopen ADR-0006 or repeat the architecture spike.

## 0. Required read set

Before implementation or review, read completely:

1. `AGENTS.md`
2. `docs/project/README.md`
3. `docs/project/STATUS.md`
4. `docs/project/ROADMAP.md`
5. `docs/project/MASTER_DEVELOPMENT_PLAN.md`
6. `docs/project/ARCHITECTURE_MAP.md`
7. `docs/project/PRODUCT_MAP.md`
8. `docs/project/DEVELOPMENT_WORKFLOW.md`
9. `docs/project/CODE_MAINTAINABILITY.md`
10. `docs/project/DECISIONS/0005-native-preview-host-boundary.md`
11. `docs/project/DECISIONS/0006-windows-preview-handler-bounded-capture.md`
12. `docs/project/initiatives/W4-native-integration.md`
13. `docs/project/specs/file-library-preview/04-INFRASTRUCTURE-CONTRACTS.md`
14. `docs/project/specs/file-library-preview/11-W4-NATIVE-INTEGRATION-IMPLEMENTATION-PLAN.md`
15. `docs/project/specs/file-library-preview/12-W4-NATIVE-INTEGRATION-ARCHITECTURE-EXPERIENCE-FREEZE.md`
16. `docs/project/tasks/W4-01-SHARED-NATIVE-HOST-BRIDGE-CURRENT-TRUTH.md`
17. `docs/project/tasks/W4-02-MACOS-NATIVE-QUICK-LOOK-CURRENT-TRUTH.md`
18. `docs/project/tasks/W4-03-WINDOWS-PREVIEW-HANDLER-SPIKE-STOP-RESULT.md`
19. `docs/project/tasks/W4-03-V2-WINDOWS-PREVIEW-HANDLER-BOUNDED-CAPTURE-CODEX.md`
20. `docs/project/tasks/W4-03-V2-WINDOWS-PREVIEW-HANDLER-CURRENT-TRUTH.md`
21. this taskbook.

Inspect the current production owners directly before editing:

- `src-tauri/tauri.conf.json`
- `src-tauri/windows/installer-hooks.nsh`
- `src-tauri/build.rs`
- `package.json`
- `scripts/classifyCiChanges.mjs`
- `.github/workflows/ci.yml`
- `.github/workflows/ci-full.yml`
- `src-tauri/native/Cargo.toml`
- `src-tauri/native/Cargo.lock`
- `src-tauri/native/windows-preview-handler/Cargo.toml`
- `src-tauri/native/windows-preview-handler/src/lib.rs`
- `src-tauri/native/windows-preview-handler/src/com.rs`
- `src-tauri/native/windows-preview-handler/src/capture.rs`
- `src-tauri/native/windows-preview-handler/src/window.rs`
- `src-tauri/native/windows-preview-handler/src/completion.rs`
- `src-tauri/native/windows-preview-handler/src/test_registration.rs`
- `src-tauri/native/windows-preview-handler/src/real_host_registration.rs`
- `src-tauri/native/windows-preview-handler-harness/`
- `src-tauri/native/host-provided/`
- `src-tauri/native/preview-representation/`.

Official platform references to re-check before production registry work:

- Microsoft, **How to Register a Preview Handler**: <https://learn.microsoft.com/en-us/windows/win32/shell/how-to-register-a-preview-handler>
- Microsoft, **Preview Handlers and Shell Preview Host**: <https://learn.microsoft.com/en-us/windows/win32/shell/preview-handlers>
- Microsoft, **Association Arrays**: <https://learn.microsoft.com/en-us/windows/win32/shell/fa-associationarray>
- Microsoft, **Application Registration**: <https://learn.microsoft.com/en-us/windows/win32/shell/app-registration>
- Microsoft PowerToys, **File Explorer add-ons**: <https://learn.microsoft.com/en-us/windows/powertoys/file-explorer>

If current platform documentation materially contradicts this taskbook, STOP for architecture/governance review rather than silently changing the product contract.

## 1. R0 — fail-closed execution baseline

The governance owner creates `feat/w4-windows-preview-handler-production-integration` immediately after this taskbook PR merges, using the exact squash-merge SHA of this taskbook PR.

Before editing production files, Codex must prove:

```text
current branch == feat/w4-windows-preview-handler-production-integration
starting HEAD == exact taskbook squash-merge commit
that commit contains this merged taskbook
origin/master == that same execution-baseline commit at task entry
working tree is clean
W4-03 v2 production merge 55571e6fc4fbd9a9eedc0f474dff28b113072b67 is an ancestor
W4-03 v1 evidence head 11fd3729770266f191ea7799edbc2b867693c181 is NOT an ancestor except through separately merged canonical history (do not import PR #146 branch history)
```

Use a fresh dedicated worktree/clone. Do not repair or reuse a dirty W2/W3/W4 worktree.

If the branch, HEAD, tree, current `origin/master`, ancestry, or cleanliness does not match the pre-created baseline, **STOP / fail closed**. Do not rebase, merge, cherry-pick, reset or carry unrelated state forward without an explicit later integration decision.

PR #146 remains read-only v1 stop evidence. PR #151 is merged canonical v2 production history; do not copy its old feature branch into a new fork.

## 2. Entry truth

At W4-04 entry:

- W4-00, W4-01, W4-02 and W4-03 v2 are COMPLETE;
- W4-03 v1 is STOPPED / CLOSED WITHOUT MERGE;
- ADR-0006 capture-before-defer is binding;
- W4-04 is the only authorized next Windows implementation Track;
- W4-05+ remain downstream-gated;
- W5 remains NOT AUTHORIZED / NOT ACTIVE.

Canonical W4-03 implementation facts:

```text
PR #151 production merge:
55571e6fc4fbd9a9eedc0f474dff28b113072b67

tree:
f357be042c493d0cefd98be8e02d768210ac1f6b

final reviewed PR head:
19e51d5e2eed175a0eda18a02b47d82c97cc289b

final exact-head hosted CI:
33008914117 — SUCCESS on attempt 1

real-host DLL SHA-256:
51C89F1746E95314D6715DB296339C0A6DC44928136919E52432F65EBAC7F29A
```

W4-04 must preserve the independently accepted source/lifecycle architecture. This task is production identity, supported-matrix, presentation, installer/association and real-installed-host integration.

## 3. Non-negotiable ADR-0006 source architecture

The accepted lifecycle remains:

```text
IInitializeWithStream::Initialize
→ retain shell IStream only
→ zero content reads

DoPreview
→ owner-apartment bounded ingress capture
→ <= 512 KiB total source bytes under the accepted v2 baseline
→ truthful Complete / Partial
→ immutable Zen-owned memory snapshot
→ release all handler-owned shell IStream references
→ no shell IStream call remains in flight
→ only then create/use memory-backed HostProvided
→ only then dispatch deferred representation/render work

Deferred work
→ immutable bounded memory + request/generation/token + representation/native state only
→ no IStream / proxy / clone
→ no shell source HANDLE
→ no reconstructed raw source path

Unload
→ revoke publication/generation
→ revoke HostProvided
→ clean only Zen-owned post-capture resources
→ no correctness dependency on CoCancelCall releasing the original source
```

W4-04 MUST NOT:

- reintroduce request-long shell-stream ownership;
- increase the 512 KiB total ingress ceiling merely because production registration exists;
- add hidden whole-file staging;
- reconstruct a path from the stream;
- create a service/broker/database for Preview Handler source bytes;
- disable low-integrity Preview Handler isolation;
- launch the full Zen/Tauri UI in `prevhost.exe`;
- fork HostProvided or Text/Code/Markdown representation logic.

Any requested capture-budget change requires separate real-host evidence plus memory/latency/resource review and an explicit architecture decision. It is not part of ordinary W4-04 implementation.

## 4. Production identity

W4-03's historical/test identity must not become an accidental public product contract.

Freeze the W4-04 x64 production Preview Handler identity as:

```text
CLSID:
{3D1A446C-162E-4313-A026-8ADC792C4862}

Friendly name:
Zen Canvas Preview Handler

Preview Handler ShellEx category:
{8895B1C6-B41F-4C1C-A562-0D564250836F}

64-bit system Prevhost AppID:
{6D2B5079-2F0B-48DD-AB7F-97CEC514D30B}

ThreadingModel:
Apartment
```

Requirements:

- the production DLL/class factory must recognize the production CLSID;
- test-only registration identifiers may remain separate, but must not leak into the production installer association matrix;
- do not register 32-bit Preview Handler support;
- do not add ARM64/x86 scope in this Track;
- do not create a custom surrogate AppID unless the system Prevhost model is proven insufficient and separately reviewed;
- do not set `DisableLowILProcessIsolation`.

The production CLSID is a durable product identity after W4-04 merges. Do not generate a new GUID at install time or per version.

## 5. Initial production association matrix

The W4-04 initial production matrix is deliberately narrow and limited to formats already supported by the accepted pure Text/Code/Markdown representation semantics.

### 5.1 Included extensions

Markdown:

```text
.md
.markdown
```

Source code / scripts:

```text
.rs
.py
.js
.jsx
.ts
.tsx
.java
.c
.h
.cpp
.hpp
.ps1
.sh
.sql
```

Total initial matrix: **16 extensions**.

All matching is case-insensitive under normal Windows extension semantics.

### 5.2 Explicitly excluded from W4-04 initial matrix

Do **not** register Zen's production Preview Handler for:

```text
.txt
.text
.log
.cfg
.conf
.ini
.env
.toml
.json
.yaml
.yml
.xml
.csv
.tsv
.html
.htm
.css
.php
.rb
.kt
.kts
.swift
.vue
.svelte
.pdf
.doc/.docx
.xls/.xlsx
.ppt/.pptx
images
archives
font files
audio/video/media
```

Rationale:

- `.txt` and generic text/config families do not justify displacing ordinary system/default preview behavior merely for coverage;
- JSON/YAML/XML/CSV/TSV have richer W3 structured/table semantics that are not part of the accepted W4-03 shell representation kernel; do not degrade them to generic source text by association;
- PDF/Office/media/image formats have stronger system/vendor/native handlers or separate product paths; W4-04 must not seize them;
- additional source-code extensions can be proposed later only through an explicit reviewed matrix amendment.

Do not expand the matrix to PowerToys-style 100+ source extensions in this Track.

## 6. Association ownership — additive, lower-priority, conflict-aware

Zen must not become the user's default application merely to provide a Preview Handler.

W4-04 MUST NOT modify:

- `UserChoice`;
- the default value of `HKCR\.ext` / the extension's current ProgID;
- `OpenWithProgIds` for Preview Handler purposes;
- default application ownership;
- existing third-party ProgID definitions.

For the included existing file types, prefer the shared association layer:

```text
HKLM\Software\Classes\SystemFileAssociations\.ext\shellex\
  {8895B1C6-B41F-4C1C-A562-0D564250836F}
    (Default) = {3D1A446C-162E-4313-A026-8ADC792C4862}
```

This is intentionally lower priority than the current default ProgID in the Shell association array. A stronger handler owned by the active/default ProgID remains ahead of Zen.

### 6.1 Conflict rule

For every matrix extension:

- if the exact Zen-owned SystemFileAssociations Preview Handler slot is absent, Zen may create it;
- if it already equals the Zen production CLSID, installation/repair is idempotent;
- if it contains a different CLSID, **do not overwrite it**;
- record/print the conflict and leave that extension unclaimed by Zen;
- uninstall must never delete a different current CLSID.

If real Explorer testing proves the documented association-array layer does not resolve Preview Handler ShellEx data for this production model, STOP for review. Do **not** respond by rewriting extension default ProgIDs or `UserChoice`.

### 6.2 Existing higher-priority handler

A higher-priority Preview Handler from the active ProgID is not an error. Zen must not attempt to defeat it. The system/default/vendor handler may remain effective while Zen's lower-priority fallback registration exists.

Tests must cover both an unowned slot and a simulated foreign-handler slot.

## 7. Production COM registry contract

The per-machine installer currently owns elevated Windows installation and remains the registration authority.

Required x64 machine registration shape:

```text
HKLM\Software\Classes\CLSID\{PRODUCTION_CLSID}
  (Default) = "Zen Canvas Preview Handler"
  AppID = "{6D2B5079-2F0B-48DD-AB7F-97CEC514D30B}"

HKLM\Software\Classes\CLSID\{PRODUCTION_CLSID}\InprocServer32
  (Default) = <absolute installed Zen handler DLL path>
  ThreadingModel = "Apartment"

HKLM\Software\Microsoft\Windows\CurrentVersion\PreviewHandlers
  {PRODUCTION_CLSID} = "Zen Canvas Preview Handler"
```

Plus only the conflict-aware SystemFileAssociations entries for the frozen matrix.

Use the 64-bit registry view.

Do not write the production CLSID under HKCU as the installed product authority. HKCU remains acceptable only for isolated test seams that fail closed around existing product registration.

### 7.1 Installed DLL location

The production DLL must live under the Zen installation root, never System32 or another shared system directory.

Preferred conceptual layout:

```text
$INSTDIR\native\zen_canvas_windows_preview_handler.dll
```

If the Tauri resource/bundle mechanism requires a different stable subpath under `$INSTDIR`, freeze that path in code/tests before registry mutation and document it in the PR. The registry must point to the actual installed x64 DLL.

Do not commit compiled DLL binaries to Git.

## 8. One product-registration truth

Do not create unrelated copies of:

- production CLSID;
- friendly name;
- extension matrix;
- ShellEx category GUID;
- Prevhost AppID;
- expected DLL relative location.

Preferred implementation shapes include:

1. one narrow machine-readable/product-registration module with generated installer constants; or
2. one Rust/product definition plus an installer representation guarded by exact drift tests.

The exact mechanism is not frozen, but automated tests MUST fail if installer registration, Rust handler identity and documented matrix drift apart.

A separate registration helper executable is allowed only if it is narrowly scoped, ships under the Zen install root, accepts no arbitrary registry paths/CLSID/extension list from untrusted CLI input, and is actually simpler/safer than direct NSIS registration.

Do not add a durable registration daemon/service.

## 9. Installer / build integration boundary

Current Windows packaging is Tauri 2 + per-machine NSIS with existing `src-tauri/windows/installer-hooks.nsh` authority for the Global Index service.

W4-04 may extend this existing authority for the Preview Handler production integration.

Required outcomes:

- release build produces the x64 handler DLL from the native workspace;
- the NSIS installer contains/copies that exact handler artifact under `$INSTDIR`;
- post-install/repair registers COM + PreviewHandlers + conflict-safe matrix associations;
- uninstall unregisters only Zen-owned Preview Handler state;
- registry association change is communicated to the Shell using a normal supported association-change notification mechanism;
- Global Index service installer behavior remains intact;
- no second installer framework or MSIX migration is introduced;
- no `regsvr32` dependency is required unless separately justified; direct installer-owned registration is preferred for this non-self-registering handler;
- install failure does not report success with a partially registered Zen handler.

### 9.1 W4-04 vs W4-05 boundary

W4-04 owns:

- production handler identity;
- production association matrix;
- production DLL inclusion/installed location sufficient to make the handler usable;
- registry install/repair/uninstall semantics;
- real installed Explorer evidence;
- deterministic conflict/ownership cleanup behavior.

W4-05 remains responsible for release-grade packaging/signing integration across W4, including:

- production code signing credentials/evidence;
- final signed nested/native artifact chain;
- broader installer hardening and release packaging matrix;
- actual cross-version signed-release upgrade evidence;
- any later MSIX evaluation/migration decision.

W4-04 must nevertheless prove its registration layer's **upgrade semantics** deterministically by converging a simulated/fixture previous Zen-owned registration state to the new canonical state without touching foreign ownership. Do not claim that this replaces W4-05's real cross-version release-installer validation.

## 10. Safe install / repair / upgrade / uninstall semantics

### Fresh install

- refuse a production CLSID collision that does not match Zen's expected registration;
- create/update Zen COM registration;
- add PreviewHandlers list value;
- claim only unowned/Zen-owned matrix slots;
- preserve all foreign slots;
- notify Shell of association changes;
- verify the installed DLL exists before committing InprocServer32.

### Repair / same-version reinstall

- idempotently converge Zen-owned COM/PreviewHandlers/association state;
- restore missing Zen-owned matrix entries only where the slot is unowned;
- never overwrite a newly introduced foreign handler;
- do not duplicate keys/values.

### Upgrade-state fixture

Create deterministic tests for an earlier Zen-owned registration state, for example an old installed DLL path and subset of Zen-owned matrix slots.

The W4-04 registration layer must:

- replace Zen's own old InprocServer32 path with the current installed path;
- converge the current matrix;
- leave foreign slots untouched;
- remove only stale Zen-owned association entries that are explicitly no longer in the matrix;
- retain a rollback-safe error model.

### Uninstall

For every registry value/key:

- remove it only if it is still Zen-owned or is an empty container created solely for Zen after its exact value is removed;
- if a third party/user changed the slot, preserve it;
- never recursively delete a generic `SystemFileAssociations\.ext` parent;
- remove Zen's PreviewHandlers list value and CLSID only after association slots no longer reference it;
- notify Shell of association changes;
- verify no Zen production registration residue remains.

Do not globally terminate Explorer or all `prevhost.exe` instances to make install/uninstall pass.

## 11. Loaded-DLL / upgrade file lifecycle

A Preview Handler may have been loaded in `prevhost.exe` before repair/uninstall.

W4-04 must prove the chosen installed-file strategy is viable after real Preview use.

Requirements:

- close/Unload the Zen preview normally;
- wait only within a bounded reviewed settle window for Zen's handler object/deferred work to return to unloadable baseline;
- do not `taskkill /IM prevhost.exe` as normal product behavior;
- do not restart Explorer as the default install strategy;
- do not overwrite/delete a still-loaded DLL by unsafe force;
- if the packaging strategy cannot reliably update/remove the installed handler after normal host release, STOP for W4-05/architecture review rather than adding global process termination.

A versioned/sid-by-side DLL placement strategy may be proposed if needed, but must be independently reviewed before it becomes production truth and must not leak orphaned versions indefinitely.

## 12. Production presentation quality

W4-03 proved the lifecycle using a minimal child surface. W4-04 must make the registered handler genuinely useful without turning it into a second Zen application.

Minimum production UI contract:

- one child preview surface owned by the Preview Handler;
- read-only and non-mutating;
- multi-line content presentation;
- vertical scrolling for long content;
- horizontal scrolling or a deliberate wrap policy appropriate to code;
- text selection and copy may be supported, but editing must not be;
- source code uses a readable monospaced presentation;
- Markdown is presented as safe inert content; no links/resources/scripts/macros/navigation may become active merely because it is Markdown;
- no full Tauri/WebView/Zen window is launched;
- no app chrome, toolbar, file mutation controls or hidden network fetches;
- `SetWindow` / `SetRect` resize remains live without restarting the source request;
- focus/Tab/accelerator behavior preserves the accepted COM/frame contract;
- no path is exposed in the rendered content as authority.

Syntax highlighting is **not required** for W4-04 acceptance.

A standard Windows control / narrow native renderer is preferred over a heavyweight embedded browser. If Markdown cannot receive richer native styling without importing a heavyweight runtime or forking representation truth, a truthful safe read-only Markdown-source presentation is acceptable for the initial matrix; document that limitation rather than introducing WebView/Tauri into `prevhost.exe`.

### 12.1 Visual host integration

Implement `IPreviewHandlerVisuals` or an equivalent standards-compliant host-color/font integration if practical for the chosen native control. At minimum prove readable light/dark/high-contrast behavior on the real supported Windows fixture used for W4-04 evidence.

Full Narrator/DPI/multi-display accessibility closeout remains W4-06, but W4-04 must not knowingly ship an unreadable or keyboard-dead production surface.

## 13. Representation dispatch

The production extension matrix must map only to the already-accepted shared representation kernel.

Required mapping:

- `.md`, `.markdown` → Markdown-safe path;
- source extensions → shared source/text representation with inert language hint where available;
- invalid UTF-8 / obvious binary input → local unsupported/corrupt result, not arbitrary byte rendering;
- a 512 KiB prefix with unknown EOF remains Partial;
- no extension may bypass content validation merely because the installer registered it.

Do not add W3 Structured/Table/Image/ZIP/Folder provider logic to the shell in W4-04.

If an included extension is not actually supported by the shared kernel at implementation time, either add the **minimal pure hint mapping with app+shell equivalence tests** or remove that extension through an explicit taskbook/governance amendment. Do not silently register an extension that falls through to misleading output.

## 14. Registry / association deterministic tests

Create a testable registration planner/contract independent of actually modifying the developer's production registry.

At minimum test:

1. exact stable production CLSID/friendly name/AppID/ShellEx identity;
2. exactly the 16 frozen extensions and no others;
3. no excluded extension is present;
4. 64-bit production key paths;
5. no `UserChoice`, default extension ProgID, OpenWith or low-IL opt-out writes;
6. fresh unowned association plan;
7. already-Zen-owned idempotent repair;
8. foreign SystemFileAssociations preview slot remains unchanged;
9. higher-priority/default-ProgID foreign handler is not modified;
10. upgrade-state fixture from old Zen DLL path/subset matrix converges correctly;
11. uninstall removes only Zen-owned exact values;
12. foreign mutation after install survives Zen uninstall;
13. all matrix/identity copies used by installer and handler remain equal;
14. Shell association-change notification occurs after successful mutation/cleanup, not before.

Use test-only HKCU or an in-memory/fake registry seam for deterministic unit tests. Product installer authority remains HKLM per-machine.

## 15. Real installed Explorer acceptance

W4-04 is not complete on synthetic registry tests alone.

Execute a real x64 Windows install using the W4-04 product installer/package path, then use Explorer Preview Pane / normal `prevhost.exe`.

### 15.1 Representative fixture matrix

At minimum execute real Preview Pane evidence for:

```text
.md        Markdown
.rs        Rust
.py        Python
.ts        TypeScript
.cpp       C++
.ps1       PowerShell
.sql       SQL
```

Also verify every remaining registered extension resolves to Zen or is truthfully skipped because a pre-existing stronger/conflicting handler owns the relevant slot.

Fixtures must include:

- small Complete source;
- >512 KiB source demonstrating truthful Partial;
- Unicode + CRLF;
- partial trailing UTF-8 boundary;
- obvious binary/corrupt input under a registered extension;
- Markdown with hostile links/images/raw HTML/scripts to prove inert presentation.

### 15.2 Lifecycle evidence

For real installed handler:

- select A → useful preview;
- A → B rapid selection, stale A cannot repaint B;
- resize Preview Pane while active;
- focus/keyboard/scroll/copy behavior;
- close Preview Pane / select unsupported item;
- write/open, rename, move and delete after successful bounded capture while Preview remains active where the fixture permits;
- repeated 20+ preview cycles return handler/resource state to a steady baseline;
- no Zen-owned source file lock after capture;
- no unexpected network access;
- `prevhost.exe` uses normal low-integrity isolation;
- no full Zen UI launches.

Record capture bytes/Complete-Partial/timing for representative fixtures. Do not invent or widen a timeout merely to pass.

## 16. Installer acceptance

On a clean or dedicated Windows environment, record:

### Fresh install

- installer artifact identity/SHA256;
- installed handler DLL path/SHA256;
- production CLSID values;
- PreviewHandlers value;
- every matrix association written/skipped and why;
- default app/ProgID before vs after unchanged;
- Preview Handler operational in Explorer.

### Conflict fixture

Before installation, create a deterministic foreign Preview Handler association fixture for one matrix extension in an isolated test environment.

Prove:

- Zen installation does not overwrite it;
- other unowned matrix entries can still be installed;
- uninstall leaves the foreign fixture unchanged.

### Repair

Run same-version repair/reinstall after the handler has been exercised.

Prove:

- Zen-owned state converges;
- foreign state remains untouched;
- handler still loads/render correctly;
- no orphaned registration/artifact is created.

### Upgrade-state registration fixture

Prove the registration layer migrates an earlier Zen-owned DLL path/subset matrix to the current state, while preserving foreign ownership.

Do not mislabel this fixture as W4-05's future signed cross-version installer proof.

### Uninstall

After real preview use:

- uninstall without globally killing Explorer/prevhost;
- verify all Zen production association slots are absent or no longer Zen-owned;
- production CLSID/InprocServer32 absent;
- PreviewHandlers list value absent;
- default app/ProgID unchanged;
- foreign conflict fixture preserved;
- installed handler artifact removed after normal bounded host release;
- no Zen registry residue under the exact production namespace.

If reboot is required for normal file cleanup, report it truthfully and STOP for packaging review; do not call that a clean W4-04 uninstall PASS.

## 17. Security requirements

Binding:

- read-only Preview;
- no macros/scripts execution even for `.ps1`/`.sh`/Markdown;
- no remote/local Markdown resource resolution;
- no arbitrary file/path access beyond the shell stream ingress;
- no hidden network fetch;
- no archive extraction;
- no implicit cloud hydration;
- no `DisableLowILProcessIsolation`;
- no global process termination to unload the handler;
- no registry takeover of user default apps;
- no arbitrary extension/CLSID/path input accepted by an elevated registration helper;
- all installed DLL paths remain under the Zen install root;
- dependency/RustSec coverage for the independent native workspace remains intact.

## 18. CI / routing requirements

Preserve the accepted PR #151 native workspace and Preview performance routing.

W4-04 changes are expected to route appropriately when touching:

- native Preview Handler source/workspace;
- shared HostProvided/representation crates if genuinely necessary;
- Windows installer hooks/config/build scripts;
- dependency manifests/locks;
- Preview performance-sensitive shared code.

Do not weaken classifier rules or skip existing lanes to shorten CI.

Hosted Windows validation must at minimum include:

- native workspace fmt/tests/clippy;
- production handler release compile;
- controlled external harness;
- production registration planner/unit tests;
- installer/package metadata contract tests;
- NSIS package build when packaging inputs changed;
- RustSec audit of both Cargo workspaces;
- relevant Preview Platform performance shard;
- standard Windows Rust/app regressions.

A hosted runner need not be mislabeled as manual Explorer UI evidence if the environment cannot reliably drive interactive Explorer. Real installed Explorer evidence remains separately required.

## 19. Required local validation

Run focused checks first, then repository gates.

At minimum:

```text
cargo fmt --manifest-path src-tauri/native/Cargo.toml --all -- --check
cargo test --manifest-path src-tauri/native/Cargo.toml
cargo clippy --manifest-path src-tauri/native/Cargo.toml --all-targets -- -D warnings
```

Build release:

- production handler DLL;
- controlled harness;
- any narrow registration helper if one is introduced.

Run:

- controlled W4-03 harness unchanged;
- new W4-04 registration/association tests;
- HostProvided + representation regressions;
- any native presentation tests.

Then all applicable repository gates:

```text
npm run typecheck
npm test
npm run test:remediation
npm run test:performance:architecture
npm run test:governance
npm run build:check
npm run verify:rust
npm run verify:security
git diff --check
```

Build the actual Windows NSIS installer/package path required for the real installed evidence.

Do not relax timeouts, thresholds, ignored tests, test threading, security warnings or performance routing merely to make the Track pass.

## 20. Exact-head hosted CI

Final implementation evidence must be against the final pushed W4-04 PR head.

Record:

- source HEAD/tree;
- base master SHA;
- merge-integration head/tree if applicable;
- tree equivalence / head-validation requirement;
- Windows native handler job;
- Windows Rust quality;
- Dependency audit;
- Preview Platform performance;
- package/NSIS lane;
- Windows aggregate quality;
- other applicable regression lanes.

If code changes after a successful run, the previous hosted evidence is stale.

A known unrelated flake may be rerun only after its failure is independently classified; do not repeatedly rerun a deterministic failure until green.

## 21. Maintainability gate

Before final commit, audit:

- no production identity/matrix drift across Rust/installer/tests;
- no oversized registry/installer module that should be split;
- no duplicated HostProvided/representation implementation;
- no raw Win32 registry logic scattered through COM/window/render modules;
- no test-registration feature leaking into default production build;
- no production installer dependence on developer-only paths;
- no committed build artifacts;
- no unrelated W4-05/W5 scope;
- no weakened comments/docs that re-label v1 cancellation as safe.

If the clean implementation requires a second Preview authority, broad default-app takeover or a new long-lived privileged service, STOP.

## 22. Stop conditions

STOP and report instead of forcing completion if any of these occur:

1. production association requires rewriting default ProgID/UserChoice to become effective;
2. SystemFileAssociations Preview registration is not honored in real Explorer and the only workaround is invasive file-association takeover;
3. the handler must disable normal low-integrity Preview Host isolation;
4. production rendering requires full Zen/Tauri/WebView startup in `prevhost.exe`;
5. an included matrix family requires request-long shell stream/file-handle ownership;
6. the 512 KiB capture architecture is no longer responsive/usable on real product fixtures;
7. install/repair/uninstall cannot preserve a pre-existing third-party Preview Handler association;
8. uninstall/upgrade requires globally killing Explorer/prevhost in normal operation;
9. stable production identity/artifact packaging cannot be made deterministic without committing binaries or inventing a second package system;
10. W4-04 would need to activate W4-05/W5 scope merely to claim success.

A stop result is preferable to unsafe association takeover.

## 23. Commit / PR rules

When implementation and evidence are ready:

1. `git diff --check`;
2. remove task-owned temp/target/fixture artifacts;
3. inspect exact changed-file list;
4. commit with focused messages;
5. push only `feat/w4-windows-preview-handler-production-integration`;
6. create/update one Draft PR to `master`;
7. keep Draft/Open;
8. do not request Codex Review;
9. do not request reviewers unless the user explicitly asks;
10. do not mark Ready;
11. do not merge;
12. do not update STATUS/ROADMAP/current-truth completion docs in the implementation PR.

Independent ChatGPT audit owns acceptance, remediation instructions, Ready transition, expected-head merge and post-merge current-truth closeout.

## 24. Final implementation report

Return:

### A. R0 identity

- worktree/clone;
- branch;
- entry HEAD/tree;
- origin/master;
- working-tree cleanliness.

### B. Production identity

- production CLSID;
- friendly name;
- installed DLL path;
- AppID/ThreadingModel;
- confirmation test identities do not leak into product registration.

### C. Supported matrix

- exact 16 registered extensions;
- exact skipped conflicts;
- confirmation excluded families remain unregistered;
- default ProgID/UserChoice unchanged.

### D. Registration architecture

- one product identity/matrix truth;
- exact HKLM paths/values;
- ownership/conflict algorithm;
- Shell notification behavior;
- no low-IL opt-out.

### E. Packaging/build

- how native DLL is built;
- how installer receives it;
- final installed path;
- no committed binary;
- relationship to existing Global Index installer hooks.

### F. Presentation

- native control/rendering design;
- multiline/scroll/select/copy behavior;
- code/Markdown behavior;
- visuals/theme behavior;
- no WebView/Tauri/network/mutation.

### G. ADR-0006 invariants

- Initialize zero-read;
- <=512 KiB total capture;
- truthful Complete/Partial;
- stream release before defer;
- no deferred stream/HANDLE/path;
- no CoCancelCall correctness dependency.

### H. Deterministic tests

- registry fresh/repair/conflict/upgrade/uninstall;
- matrix exactness;
- handler/installer identity equality;
- controlled harness;
- representation/HostProvided regressions.

### I. Real installed Explorer evidence

- Windows build;
- installer SHA256;
- installed DLL SHA256;
- registry snapshot/mutations;
- matrix results;
- representative real Preview fixtures;
- timing/capture/completeness;
- A→B stale behavior;
- write/rename/move/delete;
- resize/focus/keyboard/scroll;
- repeated cycles;
- low-IL/prevhost observation;
- network/resource observation.

### J. Repair / upgrade-state / uninstall evidence

- same-version repair;
- previous-Zen registration fixture migration;
- foreign conflict preservation;
- complete Zen registry cleanup;
- artifact cleanup without global process kill/reboot.

### K. Validation

- focused commands/counts;
- full repository gates;
- security audit;
- performance routing;
- NSIS build.

### L. Files changed

Group by:

- native production;
- shared native;
- installer/build;
- CI/routing;
- tests;
- docs.

### M. Commit / Draft PR

- final commit SHA/tree;
- remote equality;
- PR number/base/head;
- Draft/Open/unmerged;
- no Codex Review.

### N. Exact-head hosted CI

- run ID;
- exact source SHA/tree;
- integration SHA/tree;
- Windows native;
- RustSec;
- Preview performance;
- package/NSIS;
- Windows aggregate;
- other applicable gates.

### O. Deferred / UNVERIFIED

Explicitly list anything not genuinely executed. Do not convert W4-05 signing/cross-version release packaging or W4-06 Narrator/DPI/multi-display/manual accessibility evidence into W4-04 PASS.

STOP after reporting. Do not perform independent code review or merge the PR.