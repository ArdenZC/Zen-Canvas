# W4-01 — Shared Native Host Bridge + HostProvided Source Contract — Codex / Agent Brief

Status: **ACTIVE implementation Track on branch**

Baseline: `master@994d93b07a2bc3434977de1e16bd1e29b2585983` (W4-00 activation / PR #142)

Branch: `feat/w4-shared-native-host-bridge`

W4-01 implements only the shared backend/native boundaries authorized by W4-00. It must not build the final macOS Quick Look view, Windows COM Preview Handler, file-association registration, signing/package integration or W4-02+ product UI.

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
11. `docs/project/initiatives/W4-native-integration.md`
12. `docs/project/specs/file-library-preview/04-INFRASTRUCTURE-CONTRACTS.md`
13. `docs/project/specs/file-library-preview/11-W4-NATIVE-INTEGRATION-IMPLEMENTATION-PLAN.md`
14. `docs/project/specs/file-library-preview/12-W4-NATIVE-INTEGRATION-ARCHITECTURE-EXPERIENCE-FREEZE.md`
15. `docs/project/tasks/W4-00-NATIVE-INTEGRATION-ACTIVATION-CODEX.md`
16. this taskbook.

Inspect current production owners directly:

- `src-tauri/src/file_workspace/contracts.rs`
- `src-tauri/src/file_workspace/preview.rs`
- `src-tauri/src/file_workspace/preview_policy.rs`
- `src-tauri/src/file_workspace/preview_asset.rs`
- `src-tauri/src/file_workspace/read_gate.rs`
- `src-tauri/src/file_workspace/integration/preview.rs`
- `src-tauri/src/file_workspace/integration/runtime.rs`
- `src-tauri/src/file_workspace/integration/commands.rs`
- `src-tauri/src/file_workspace/thumbnail/read.rs`
- `src-tauri/src/file_workspace/thumbnail/renderer.rs`
- `src-tauri/src/platform/macos/quick_look.rs`
- `src-tauri/src/scheduler.rs`
- `src-tauri/src/main.rs`.

## 1. Entry truth

W4-00 merged through PR #142 at:

`master@994d93b07a2bc3434977de1e16bd1e29b2585983`.

W4 is the sole active initiative. W4-01 is the only authorized production Track. W4-02+ remain dependency-gated and W5 remains NOT AUTHORIZED / NOT ACTIVE.

W4-00 review established three blockers that W4-01 must preserve as regression contracts:

1. Zen-owned native-backed Preview must retain Managed/Ephemeral source identity; `HostProvided` is shell-owned only.
2. macOS native presentation may not receive a checked-once original source URL; actual byte acquisition must remain behind the authoritative Read Gate/open boundary and initial W4 uses complete private staging plus final sourceVersion revalidation.
3. Content Quick Preview/native Preview and Operation Preview are separate product concepts and authorities.

## 2. Current production audit

### 2.1 Existing contracts are sufficient

`PreviewSourceRef` already provides:

- `Managed`;
- `Ephemeral`;
- `HostProvided { hostToken }`.

`PreviewHostKind` already provides:

- `ZenFloating`;
- `ZenPinned`;
- `MacQuickLookExtension`;
- `WindowsQuickPreview`;
- `WindowsPreviewHandler`.

`PreviewRepresentation::NativeOpaque { host, token }` already exists and enforces host matching in Preview Core.

W4-01 must not create substitute source/host/representation enums merely to make implementation easier.

### 2.2 WorkspacePreviewResolver stays Managed/Ephemeral-only

The current `WorkspacePreviewResolver` is the W1/W3 source resolver for File Library/Browse sources. Its current fail-closed `HostProvided` branch is intentional.

W4-01 MUST NOT make `WorkspacePreviewResolver` resolve shell host tokens. Shell-owned requests need a separate request-scoped adapter/registry so File Library/Browse source ownership is not collapsed into shell ownership.

### 2.3 MaterializationReadGate remains Zen byte authority

The current Read Gate:

- owns Preview byte-read eligibility and sourceVersion truth;
- re-resolves the opaque source at the actual read boundary;
- opens through `open_authoritative_file()`;
- validates opened physical identity;
- preserves no-implicit-hydration and terminal source states;
- already has `ReadIntent::Preview`;
- already exposes backend-only `source_file_name()` for safe staging-name hints.

W4-01 needs no new generic read authority and no new `ReadIntent::NativePreview`.

`read_gate.rs` is already a large authority module. W4-01 may add only a narrow primitive that belongs to the existing authoritative open/read responsibility; staging lifecycle/registry ownership must live elsewhere.

### 2.4 Existing Quick Look thumbnail path is the security precedent

`MacQuickLookThumbnailRenderer` reads bytes through the W1 Read Gate and then calls the private `MacThumbnailService::request_gated_bytes()` staging path. The Quick Look helper receives a Zen-owned private staged file rather than the original source path.

W4 full Preview follows the same authority direction, but it must not misuse ThumbnailService as the full Preview lifecycle owner.

### 2.5 Runtime and scheduler seams already exist

`RuntimeInner` already centralizes disposable File Workspace service owners and `dispose_inner_fields()` cleanup.

`WorkScheduler` already owns a `NativePreview` resource class / `ResourceHints.native_preview` with bounded capacity. W4-01 must reuse it rather than creating a second native-preview semaphore or scheduler.

### 2.6 No renderer-facing native source API

Existing Tauri Preview commands are main-window IPC. W4-01 native access/HostProvided registries are backend/native-side seams.

Do NOT add a Tauri command that:

- returns a staging filesystem path;
- creates/resolves a `HostProvided` token from React;
- returns a native file handle/stream;
- turns Native Preview Access into a generic renderer byte API.

## 3. Module ownership freeze

Preferred production decomposition:

```text
src-tauri/src/file_workspace/native_preview/
  mod.rs
  access.rs          # Zen-owned Native Preview Access staging/token lifecycle
  host_provided.rs   # OS/shell-owned opaque request/source lifecycle
```

The exact names may vary if review finds a materially better cohesive boundary, but the two lifecycles must remain separate.

### Read Gate

May gain one crate-private Preview-specific verified copy/stream primitive because authoritative resolve/open/identity verification belongs there.

It must not own staging directories, native representation tokens or HostProvided lifecycle maps.

### Native Preview Access registry

Owns only process-local Zen staging/presentation state:

- private staging root and records;
- session/request/sourceVersion/host-bound opaque access token;
- bounded entry/byte/TTL limits;
- cleanup/revocation;
- safe staged filename;
- final freshness verification before a record becomes publishable/resolvable.

It does not decide read eligibility or source identity.

### HostProvided registry

Owns only shell-created request state:

- opaque host token generation;
- activated shell host kind carried explicitly by the registration;
- request-scoped source object/stream abstraction;
- freshness/generation state local to that shell request;
- revoke/unload/cancel cleanup.

It is not a durable path registry, File Library identity source or renderer byte service.

### Runtime

`RuntimeInner` composes both process-local registries and disposes them with existing Preview runtime resources.

`main.rs` supplies an explicit app-data staging root such as `file-workspace-native-preview`; runtime code must not infer a sibling path from the thumbnail cache directory.

## 4. A — Zen-owned Native Preview Access contract

### 4.1 Request ownership

Input is an existing Zen Preview tuple:

```text
PreviewSession id
+ request id
+ Managed/Ephemeral source
+ expected sourceVersion
+ ZenFloating or ZenPinned host
+ cancellation/deadline
```

Reject:

- HostProvided source;
- native shell host kinds;
- empty/oversized opaque ids;
- stale/mismatched sourceVersion;
- cancelled/expired requests.

### 4.2 Authoritative acquisition

Initial W4 path is:

```text
source + expected sourceVersion
→ fresh MaterializationReadGate resolve/eligibility
→ exact sourceVersion comparison
→ authoritative identity-checked open
→ bounded complete copy through that same open
→ private staging file
→ fresh current_source_version() revalidation
→ publishable Native Preview Access record
```

A normal `fs::copy(source_path, staged_path)` after an earlier eligibility check is forbidden.

A direct original source URL/path escape hatch is forbidden.

### 4.3 ReadGate verified-copy primitive

Prefer one crate-private method rather than repeatedly calling 1 MiB bounded reads that reopen the source for every chunk.

The primitive should:

- accept source, expected sourceVersion, Preview request/context, max total bytes and an injected writer;
- validate Preview intent/context;
- fresh-resolve eligibility and exact sourceVersion;
- open once via the existing authoritative opener;
- stream in bounded chunks to the caller-provided writer;
- enforce total-byte, cancellation and deadline bounds during the copy;
- fail if lease/context is revoked before completion;
- never return the source path or opened File/handle;
- preserve existing terminal/error mapping.

The final current-sourceVersion revalidation after the copy remains the Native Preview Access caller's publication gate.

### 4.4 Complete staging only

A staged source is usable only if the entire approved source fits within the configured W4-01 access budget and the copy completes.

Partial/truncated staging must be deleted and never resolve as a native source.

Over-budget input returns a bounded unsupported/resource-limit result for later truthful W4-02 fallback. It must not bypass the gate.

### 4.5 Private staging

On supported Unix/macOS:

- staging root/request directory private to the current user (`0700` equivalent);
- staged file private (`0600` equivalent);
- file created with create-new semantics;
- no caller-controlled path traversal;
- only a sanitized backend-derived leaf filename/extension hint may be preserved.

Cross-platform implementation must use the narrowest safe equivalent and fail closed when secure staging cannot be established.

### 4.6 Access token

The resolved Native Preview Access token:

- is opaque and random;
- is not the staged path;
- is bound to session id, request id, sourceVersion and exact Zen host;
- is process-local/non-durable;
- expires/revokes;
- rejects wrong-host, wrong-request, wrong-sourceVersion and stale tokens.

Only backend/native bridge code can resolve the token into the private staged path for the actual native host.

No generic Tauri command exposes this resolution.

### 4.7 Cleanup

Revoke/delete staging on:

- source switch/supersession;
- Preview cancel;
- Preview dispose;
- failed staging;
- final sourceVersion drift;
- deadline/TTL expiry;
- runtime dispose;
- native representation release.

Initialization may perform bounded cleanup of abandoned W4-owned staging entries only. It must never recursively remove unrelated app-data state.

## 5. B — OS/shell-owned HostProvided contract

### 5.1 Ownership

`HostProvided` exists only when the OS/native shell created the request/source lifetime.

Current W4 consumer target: future W4-03/04 Windows Explorer Preview Handler.

Future Finder extension may use it only after separate authorization.

### 5.2 Registration

Registration produces an opaque `hostToken` and stores only bounded process-local request state.

Required binding:

- exact native host kind;
- request/generation id;
- request-scoped source abstraction;
- cancellation/revoked state;
- TTL/deadline where applicable.

No token may contain or encode a path.

### 5.3 Source abstraction

W4-01 should support a narrow request-owned read source suitable for stream/handle-backed shell data and deterministic tests.

Do not require the shell source to route through `WorkspacePreviewResolver` or the managed `MaterializationReadGate`: the shell-owned stream/handle is the incoming request source authority for that bounded request.

Equally, do not turn it into a general read service. Reads remain available only through the current registered native request and are cancelled/revoked at unload.

### 5.4 Lifecycle

Prove:

```text
register
→ resolve/read within matching request
→ cancel/unload/revoke
→ token immediately invalid
→ source/stream resources released
```

Unknown/reused/revoked/wrong-host tokens fail closed.

W4-01 does not yet implement Windows COM `Initialize`/`DoPreview`/`Unload`; it supplies the lifecycle primitive W4-03 will consume.

## 6. Shared native representation / resource contract

W4-01 may add helpers for:

- host-bound `NativeOpaque` token publication/validation;
- native representation resource cleanup;
- scheduler NativePreview admission;
- cancellation propagation.

It must not:

- fork production provider selection;
- activate `MacQuickLookExtension`;
- activate `WindowsPreviewHandler` in the normal Zen host policy merely because the registry exists;
- activate `WindowsQuickPreview`;
- create a second provider registry;
- create a second general ReadGate;
- add native parser copies of W3 providers.

## 7. Runtime wiring

Add explicit process-local owners to `RuntimeInner`:

- Native Preview Access registry;
- HostProvided registry.

Add them to runtime dispose ordering and focused test resource counts.

Suggested cleanup order:

1. revoke/cancel Preview sessions;
2. revoke native access and shell host registrations so no future native resolution can occur;
3. cancel remaining thumbnail/background requests;
4. dispose Browse sessions;
5. dispose services/read gate/assets.

Exact ordering may differ if tests prove a stricter safe order, but request ownership must be revoked before underlying resources are released.

`main.rs` should inject an explicit app-data root for native Preview staging.

## 8. Bounds

W4-01 must freeze conservative implementation defaults and expose focused test configuration where useful.

At minimum bound:

- active Native Preview Access records;
- staged bytes per record;
- total staged bytes;
- staging TTL;
- active HostProvided registrations;
- per-request read chunk size;
- acquisition deadline;
- scheduler native-preview concurrency.

Do not silently inherit the Thumbnail cache's retention semantics; full Preview staging is disposable request state, not a thumbnail cache.

## 9. Required tests

### Native Preview Access

- happy-path complete staged copy from eligible local Managed source;
- happy-path Ephemeral source;
- token is opaque and contains no source/staging path;
- wrong host/request/sourceVersion rejected;
- HostProvided input rejected;
- materialization-required/downloading/metadata-only/permission/unavailable rejected without staging publication;
- source identity drift before authoritative open rejected;
- sourceVersion drift after completed staging but before publication deletes staging and fails;
- cancellation during copy deletes partial staging;
- timeout during copy deletes partial staging;
- per-file/total capacity limit fails closed and cleans partial state;
- revoke request/session removes record + staged file;
- expiry removes record + staged file;
- runtime dispose returns native resources/files to baseline;
- repeated create/revoke reaches steady state.

### HostProvided

- register/resolve matching shell request;
- opaque token does not encode supplied test source data/path;
- wrong host/generation rejected;
- unknown/revoked/reused token rejected;
- cancel/unload semantics release request source;
- capacity/expiry bounded;
- runtime dispose revokes all registrations;
- no Managed/Ephemeral resolver ownership is imported.

### Regression

- existing Zen Floating/Pinned host policy unchanged;
- `MacQuickLookExtension`, `WindowsPreviewHandler` and `WindowsQuickPreview` remain fail-closed in normal W3 production host policy unless a narrowly reviewed internal test seam says otherwise;
- existing Preview provider registry order unchanged;
- existing ReadGate Preview/Thumbnail tests remain PASS;
- current Quick Look thumbnail staging remains PASS;
- no renderer command/wire gains a raw path/native handle/HostProvided registration endpoint.

## 10. Validation

Focused first:

```bash
cargo test --manifest-path src-tauri/Cargo.toml native_preview
cargo test --manifest-path src-tauri/Cargo.toml host_provided
cargo test --manifest-path src-tauri/Cargo.toml file_workspace::read_gate
cargo test --manifest-path src-tauri/Cargo.toml file_workspace::integration
```

Then applicable repository gates, including at least:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
npm run typecheck
npm test
npm run test:remediation
npm run test:performance:architecture
npm run build:check
npm run verify:rust
npm run verify:security
```

Use exact-head CI for Windows/macOS Rust/release/performance lanes selected by repository routing. Real macOS native UI proof is not required in W4-01 because W4-02 owns the final native host, but security/lifecycle behavior must be deterministic on testable platform-independent seams.

## 11. Maintainability gate

Required independent review questions:

- Did `read_gate.rs` receive only a narrow existing-authority primitive rather than a staging lifecycle?
- Are Native Preview Access and HostProvided lifecycles cohesive and separate?
- Did runtime wiring remain composition rather than becoming another authority?
- Are locks held only around in-memory registry mutations, never around long filesystem copies/native work?
- Is cancellation possible while staging is in progress?
- Are cleanup paths idempotent and bounded?
- Is unsafe/native platform code deferred to the platform Track unless W4-01 genuinely needs a narrow portable seam?

## 12. Stop conditions

STOP before merging if implementation:

- retokenizes Zen Managed/Ephemeral Preview as HostProvided;
- makes `WorkspacePreviewResolver` a shell-token resolver;
- exposes original source paths or staged paths to React/WebView;
- adds a renderer-callable HostProvided registration/read API;
- gives Quick Look/native presentation a direct original managed/provider URL escape hatch;
- performs source-path copy after a stale preflight instead of authoritative open/read;
- makes Native Preview Access a second eligibility/read authority;
- creates a second provider registry/scheduler/native semaphore;
- persists host/native access tokens to the database;
- activates W4-02/03/04 platform UI or registration;
- activates W5;
- requires weakening no-implicit-hydration, identity, package, symlink or permission truth;
- leaves staged files/registrations after cancel/dispose/unload in deterministic tests.

## 13. Definition of Done

W4-01 is complete only when:

1. branch is based on W4-00 merge `994d93b0…` with no unrelated production history;
2. Native Preview Access proves complete private request-bound staging through existing authoritative Read Gate/open semantics;
3. final sourceVersion revalidation gates publication/resolution;
4. HostProvided proves opaque shell-only request-scoped registration/revoke lifecycle;
5. Managed/Ephemeral and HostProvided ownership remain distinct;
6. `NativeOpaque` remains host-bound and no raw path becomes renderer wire;
7. runtime/scheduler/resource cleanup is bounded and tested;
8. normal Zen native host kinds remain fail-closed until their dependent Tracks;
9. focused and applicable full validation pass on exact head;
10. maintainability/module-boundary review has blockers = 0;
11. final Codex review has no unresolved P1/P2 blocker;
12. current-truth docs record the W4-01 reviewed/merged result and authorize only the next dependency-safe Tracks.

After W4-01 merges/closes, W4-02 macOS and W4-03 Windows spike may become eligible in parallel. W4-04 remains dependent on W4-03. W5 remains inactive.
