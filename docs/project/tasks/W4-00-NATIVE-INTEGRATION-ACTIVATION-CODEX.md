# W4-00 — Native Integration Activation — Codex / Agent Brief

Status: **activation candidate — documentation/governance only**

Baseline: `master@43da96b89a7fe99908198b4b7dfeff3fc3bd686e` (W3-R1 final governance closeout / PR #141)

Branch: `docs/w4-native-integration-activation`

This task activates W4 only after W3 has been independently closed and the project is in canonical `BETWEEN INITIATIVES` state. It is documentation/governance only. **No production source, Rust/Tauri implementation, package/config, installer, schema, workflow or test behavior may change in W4-00.**

## 0. Required read set

Before any W4 production task begins, read completely:

1. `AGENTS.md`
2. `docs/project/README.md`
3. `docs/project/STATUS.md`
4. `docs/project/ROADMAP.md`
5. `docs/project/MASTER_DEVELOPMENT_PLAN.md`
6. `docs/project/ARCHITECTURE_MAP.md`
7. `docs/project/PRODUCT_MAP.md`
8. `docs/project/DEVELOPMENT_WORKFLOW.md`
9. `docs/project/CODE_MAINTAINABILITY.md`
10. `docs/project/TECH_DEBT.md`
11. `docs/project/RISK_REGISTER.md`
12. `docs/project/DECISIONS/0005-native-preview-host-boundary.md`
13. `docs/project/initiatives/W3-preview-platform.md`
14. `docs/project/initiatives/W4-native-integration.md`
15. `docs/project/specs/file-library-preview/03-PREVIEW-ARCHITECTURE.md`
16. `docs/project/specs/file-library-preview/04-INFRASTRUCTURE-CONTRACTS.md`
17. `docs/project/specs/file-library-preview/05-PERFORMANCE-QA.md`
18. `docs/project/specs/file-library-preview/09-W3-PREVIEW-IMPLEMENTATION-PLAN.md`
19. `docs/project/specs/file-library-preview/10-W3-PREVIEW-EXPERIENCE-FREEZE.md`
20. `docs/project/specs/file-library-preview/11-W4-NATIVE-INTEGRATION-IMPLEMENTATION-PLAN.md`
21. `docs/project/specs/file-library-preview/12-W4-NATIVE-INTEGRATION-ARCHITECTURE-EXPERIENCE-FREEZE.md`
22. `docs/project/tasks/W3-R1-CLOSE-MUTATE-EVIDENCE-REMEDIATION-CODEX.md`

Before W4-01 implementation, inspect current production owners rather than inferring them from planning docs:

- `src-tauri/src/file_workspace/contracts.rs`
- `src-tauri/src/file_workspace/preview.rs`
- `src-tauri/src/file_workspace/preview_policy.rs`
- `src-tauri/src/file_workspace/preview_asset.rs`
- `src-tauri/src/file_workspace/read_gate.rs`
- `src-tauri/src/file_workspace/integration/preview.rs`
- `src-tauri/src/file_workspace/integration/runtime.rs`
- `src-tauri/src/file_workspace/integration/commands.rs`
- `src-tauri/src/preview_providers/` or current production provider modules;
- `src-tauri/src/scheduler.rs`
- `src-tauri/src/platform/macos/quick_look.rs`
- `src-tauri/src/platform/macos/file_semantics.rs`
- `src-tauri/src/platform/macos/identity.rs`
- `src-tauri/src/platform/`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src-tauri/Info.plist`
- `src-tauri/windows/installer-hooks.nsh`
- current frontend Preview host/controller modules and strict wire contracts.

Official Apple/Microsoft/Tauri native-host and packaging documentation must be re-checked again at the implementation Track that depends on it; this activation record is not a permanent substitute for current platform documentation.

## 1. Activation objective

Move governance from:

```text
W3 COMPLETE / CLOSED
No active initiative
BETWEEN INITIATIVES
W4 NOT AUTHORIZED / NOT ACTIVE
W5 NOT AUTHORIZED / NOT ACTIVE
```

to:

```text
W3 COMPLETE / CLOSED
W4 Native Integration ACTIVE — architecture / experience freeze
W4-00 ACTIVE / activation
W4-01 NEXT after W4-00 merge
W5 NOT AUTHORIZED / NOT ACTIVE
```

W4-00 authorizes only the reviewed W4 dependency graph and architecture/experience contract. It does not implement a native host.

## 2. W3 exit gate is satisfied

W4 activation depends on W3 being stable enough to host native integration safely.

Accepted entry baseline:

- W3 final closeout PR #141 squash merged at `master@43da96b89a7fe99908198b4b7dfeff3fc3bd686e`;
- W3 Preview Platform is `COMPLETE / CLOSED`;
- the W3-R1 close→mutate blocker is resolved;
- repository current truth is `No active initiative / BETWEEN INITIATIVES` before this activation;
- W4 native host kinds are still fail-closed in production;
- W5 remains future/inactive.

No W3 runtime remediation is part of W4-00.

## 3. Current repository findings

The following are binding W4 inputs.

### 3.1 Native host seams already exist but are inactive

`PreviewHostKind` reserves:

- `MacQuickLookExtension`;
- `WindowsQuickPreview`;
- `WindowsPreviewHandler`.

`PreviewSourceRef` reserves `HostProvided { hostToken }`.

Current `preview_policy` activates only Zen Floating/Pinned and returns `preview_host_not_activated` for native host kinds. W4 must extend that authority deliberately rather than bypass it.

### 3.2 HostProvided is shell-owned, not a universal native identity

`HostProvided` is a contract shape, not permission to encode a path in a token and not a replacement for existing W3 source identity.

W4-01 owns the bounded registry/lifecycle needed to make `HostProvided` a real source seam **only for OS/shell-owned requests** such as Windows Explorer Preview Handler requests (and a future Finder extension only if separately authorized).

Zen-internal macOS native-backed Preview keeps the existing `ManagedFile` / `EphemeralBrowse` source, sourceVersion and `ZenFloating` / `ZenPinned` host identity. Its native presentation uses the host-bound `NativeOpaque` representation seam or a narrowly reviewed equivalent; it must not be re-tokenized as `HostProvided` merely for implementation symmetry.

### 3.3 Read Gate actual-open semantics are binding on native Preview

`MaterializationReadGate` does not treat eligibility or a resolved path as durable authorization. Its actual byte-read path re-resolves the opaque source, compares current sourceVersion, opens through the authoritative identity-checked platform opener and validates the opened object before returning bytes.

Quick Look opens a URL asynchronously, so a prior eligibility/identity check followed by handing the original source URL to Quick Look would bypass this contract. Initial W4 macOS integration therefore requires a request/sourceVersion-bound Native Preview Access lease that creates a complete Zen-owned private staging snapshot from authoritative identity-checked access, then performs final sourceVersion/freshness revalidation before `NativeOpaque` publication.

No `MaterializationRequired`, `Downloading`, `MetadataOnly`, unavailable, permission or identity failure may be converted into native-framework hydration.

### 3.4 macOS current Quick Look capability is thumbnail-only

`src-tauri/src/platform/macos/quick_look.rs` is a bounded thumbnail adapter. `PREVIEW_AVAILABLE=false`; full native Preview remains deferred. Preserve this distinction.

### 3.5 Windows has no Preview Handler subsystem yet

Current Windows platform code and Cargo features do not constitute a shell Preview Handler. W4-03 must prove the COM/prevhost/window/focus/stream lifecycle before broad registration.

### 3.6 Packaging is already non-trivial

Current packaging:

- Tauri 2;
- Windows NSIS per-machine with installer hooks that already own Global Index service installation/cleanup;
- macOS DMG, minimum macOS 13, hardened runtime;
- no current MSIX target;
- no current Finder Preview Extension target;
- no current Windows Preview Handler artifact.

W4 packaging must integrate with these owners instead of silently replacing them.

## 4. Platform research decisions frozen by W4-00

### 4.1 macOS

Initial W4 product scope is a **Zen-internal native Quick Look host/fallback** for strong-native standard formats.

Do not register a generic Finder Quick Look Preview Extension merely to reproduce standard system-format previews. A Finder extension remains conditional on a future reviewed custom UTI/document ownership case or demonstrated native gap.

Quick Look Preview Extension, app-internal Quick Look UI and Quick Look Thumbnailing are separate responsibilities.

The initial in-app path retains `ManagedFile` / `EphemeralBrowse` source identity and `ZenFloating` / `ZenPinned` host identity; it does not activate `MacQuickLookExtension`.

Quick Look receives only a complete request-bound staging snapshot produced from authoritative identity-checked access. The original managed/provider-backed URL is not an approved Quick Look input for initial W4.

### 4.2 Windows

The concrete W4 system target is the **Explorer Preview Handler**.

Prefer stream initialization (`IInitializeWithStream`) and the normal Preview Handler lifecycle. `Unload` is a hard resource-release boundary.

`WindowsQuickPreview` remains reserved/inactive because W3 already supplies the in-app Zen Quick Preview product. No duplicate global preview surface is authorized by this task.

## 5. Authorized W4 dependency graph

```text
W4-00  Activation + Native Architecture / Experience Freeze        THIS TRACK
  ↓
W4-01  Shared Native Host Bridge + HostProvided Source Contract    NEXT
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

Parallelism is dependency-aware:

- W4-01 is serialized because both platform branches depend on a reviewed native representation/resource boundary, while only shell-owned requests depend on the `HostProvided` source seam.
- W4-02 and W4-03 may proceed in parallel only after W4-01 merges and closes.
- W4-04 follows the accepted Windows spike.
- package preparation may overlap after artifact shapes are frozen, but final W4-05 acceptance waits for platform artifacts.
- W4-06 integrates the final native/platform/package result.

## 6. Hard architecture boundaries

W4 MUST NOT:

- replace PreviewSession/provider registry;
- create a second MaterializationReadGate or generic native read authority;
- encode filesystem paths inside host tokens;
- expose native source paths to React/WebView;
- create a durable native shell path/token database;
- re-tokenize Zen-owned Managed/Ephemeral sources as `HostProvided` merely because presentation is native;
- hand Quick Look the original managed/provider-backed source URL after only a preflight eligibility/identity check;
- copy a source by path into staging after a prior check while bypassing the authoritative identity-checked open/read boundary;
- publish partial/truncated staging as a native file;
- duplicate provider implementations per platform;
- weaken File Provider/materialization/identity/package/symlink safety;
- silently hydrate cloud content;
- add file mutation/recovery authority to native Preview;
- launch the full Zen app UI for every Explorer Preview request as the final design;
- opt Windows Preview Handler out of normal isolation merely to simplify implementation;
- migrate the entire installer model for convenience without separate review;
- add Intel macOS/Linux;
- activate W5.

If implementation requires moving durable authority, adding a broad privileged cross-process service, changing supported platform truth or replacing the installation model, STOP for architecture/ADR review.

## 7. W4-01 mandatory scope

The first production Track after activation is W4-01 Shared Native Host Bridge.

It must establish two distinct lifecycle contracts.

### A. Zen-owned in-app native-backed representation

1. preserve `ManagedFile` / `EphemeralBrowse` source identity and sourceVersion;
2. preserve `ZenFloating` / `ZenPinned` host identity;
3. define host-bound `NativeOpaque` representation/resource ownership for the matching Zen host;
4. define one bounded process-local Native Preview Access registry/lease bound to session/request/sourceVersion/host;
5. acquire staging input only through fresh authoritative eligibility/identity validation and an identity-checked open/read path;
6. create only complete private Zen-owned staging snapshots; preserve only a safe backend-derived leaf/extension for native type recognition;
7. perform final sourceVersion/freshness revalidation after staging and before publication;
8. discard and cleanup staging on source drift, terminal read state, cancellation, timeout, failure or budget exhaustion;
9. revoke native representation/view/staging resources on switch/cancel/dispose/expiry;
10. prove stale publication remains rejected without a `HostProvided` indirection;
11. prove the original source URL never becomes Quick Look input through this contract.

W4-01 must make this lifecycle testable without shipping the final native Quick Look view.

### B. OS/shell-owned HostProvided source

1. one bounded backend/native `HostProvided` token registry;
2. explicit shell request owner + activated native host kind + verified request source/freshness state;
3. create/resolve/cancel/unload/revoke lifecycle;
4. stale/reused/unknown token rejection;
5. request-scoped stream adapter compatible with shared provider/representation logic;
6. no generic renderer path/read authority;
7. deterministic unload/revoke cleanup with no surviving host token.

### Shared W4-01 outcomes

1. native representation/asset/access lifetime suitable for each consumer;
2. provider/representation reuse without provider forks or source-identity collapse;
3. bounded native renderer/staging/resource cleanup ownership;
4. capability projection without activating unrelated hosts;
5. cross-process cancellation/resource accounting where a real process boundary exists;
6. deterministic cleanup and stale-publication tests for both source-ownership paths;
7. Native Preview Access remains a bounded consumer/staging adapter over the existing Read Gate, not another eligibility authority.

W4-01 must not simultaneously build the final macOS UI or register the Windows handler broadly.

## 8. Activation PR required files

The W4-00 activation PR should coherently update/add only documentation/governance artifacts needed to activate W4, including:

- `docs/project/STATUS.md`;
- `docs/project/ROADMAP.md`;
- `docs/project/ARCHITECTURE_MAP.md` where native-host boundary truth is recorded;
- `docs/project/DECISIONS/0005-native-preview-host-boundary.md`;
- `docs/project/initiatives/W4-native-integration.md`;
- `docs/project/specs/file-library-preview/11-W4-NATIVE-INTEGRATION-IMPLEMENTATION-PLAN.md`;
- `docs/project/specs/file-library-preview/12-W4-NATIVE-INTEGRATION-ARCHITECTURE-EXPERIENCE-FREEZE.md`;
- this taskbook.

`PRODUCT_MAP.md`, `RISK_REGISTER.md` or `TECH_DEBT.md` should change only if the activation introduces a real current-truth change those files own; do not edit them for cosmetic symmetry.

No `src/**`, `src-tauri/**`, package/config, installer, schema, workflow or test file belongs in W4-00.

## 9. W4-00 validation

Because W4-00 is docs/governance only:

- exact diff must remain documentation-only;
- project governance validation must pass;
- source/current-truth parser must recognize exactly one active initiative (`W4 — Native Integration`);
- STATUS and ROADMAP current initiative names/status must agree;
- documentation validation must pass;
- CI classifier must route the change to docs-only validation;
- no production lane may be forced by accidental file scope;
- exact changed-file list must be independently audited;
- final Codex review must have no unresolved blocker.

No native runtime PASS is claimed by W4-00.

## 10. Stop conditions

STOP W4-00 rather than merging contradictory governance if:

- W3 is no longer closed on current master;
- another initiative becomes active concurrently;
- W4 activation requires production code/config/package changes;
- the final dependency graph implicitly activates more than W4-01;
- Finder Quick Look Extension is described as mandatory for standard formats without a reviewed ownership case;
- Zen-owned macOS in-app Preview is described as requiring `HostProvided` or `MacQuickLookExtension`;
- Quick Look is authorized to open the original managed/provider-backed URL after only a prior eligibility/identity check;
- staging is allowed to bypass the existing identity-checked actual-open/read boundary or publish partial data as a complete native source;
- `WindowsQuickPreview` is activated without a product definition;
- W5 is made active;
- current-truth/governance validation fails.

## 11. Expected current truth after merge

```text
W0 COMPLETE
W1 COMPLETE
W2 COMPLETE
W3 COMPLETE / CLOSED
W4 ACTIVE — architecture / experience freeze
  W4-00 COMPLETE after activation merge
  W4-01 NEXT / only authorized production Track
  W4-02+ dependency-gated
W5 NOT AUTHORIZED / NOT ACTIVE
```

The activation merge authorizes W4-01 only. It does not mean macOS/Windows native integration has already been implemented.
