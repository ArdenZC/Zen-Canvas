# ADR-0005 — Native Preview Host Boundary

Status: **Accepted for W4 activation**

Date: 2026-08-25

## Context

W3 closes with one stable Preview lifecycle/provider/read architecture and two Zen-owned hosts (`ZenFloating`, `ZenPinned`). W4 introduces operating-system-native preview surfaces and therefore crosses new process, shell-lifecycle, packaging and signing boundaries.

The repository already reserves:

- `PreviewSourceRef::HostProvided { hostToken }`;
- `PreviewHostKind::MacQuickLookExtension`;
- `PreviewHostKind::WindowsQuickPreview`;
- `PreviewHostKind::WindowsPreviewHandler`;
- host-bound `PreviewRepresentation::NativeOpaque { host, token }`.

Those are contracts, not activated implementations. Current `preview_policy` fails closed for all native host kinds.

A naive W4 could accidentally create a second Preview engine by letting Finder/Explorer paths feed independent native parsers, or could make platform parity the goal instead of native correctness. That would violate the Master Development Plan.

Current platform guidance also differs materially:

- Apple Quick Look Preview Extensions are principally appropriate when an application owns/supports custom document types; Quick Look Thumbnailing and app-internal Quick Look UI are separate responsibilities.
- Windows Explorer Preview Handlers are shell components with `IPreviewHandler` lifecycle; Microsoft strongly prefers stream-based initialization and requires deterministic `Unload` cleanup.

## Decision

### 1. Native integration is a Host/Adapter concern

W4 reuses the existing Preview authority graph:

```text
native request
→ platform adapter
→ bounded host/source bridge
→ existing Preview/provider contracts
→ native presentation
```

W4 does not create a second durable Preview/provider/read/identity/mutation authority.

### 2. Host-provided sources are opaque and request-scoped

`HostProvided { hostToken }` is the reserved seam for an OS-owned native request.

A host token:

- is opaque;
- is never a disguised filesystem path;
- resolves only backend/native-side;
- is scoped to one bounded native request/session unless a later reviewed contract explicitly says otherwise;
- is revoked on unload/cancel/source switch;
- fails closed when stale or unknown;
- does not become durable database state.

A platform-supplied stream/handle may back the host-provided source for the lifetime of that request. It does not grant a generic renderer-facing byte-read API.

### 2a. Zen-owned in-app sources keep their existing identity

`HostProvided` is **not** a universal replacement for W3 source identity.

When an existing Zen Floating/Pinned Preview invokes a native-backed macOS representation, the source remains the already-authoritative `ManagedFile` or `EphemeralBrowse` source. W4 may add a native presentation/read adapter behind that source, but it must not re-tokenize the source as `HostProvided` merely to reuse native plumbing.

Use `HostProvided` when the **operating system/native shell owns the incoming request/source lifetime**—for example, a Windows Explorer Preview Handler request or a future separately authorized Finder Preview Extension request. This preserves the distinction between:

```text
Zen-owned Preview request
→ existing ManagedFile / EphemeralBrowse identity
→ native-backed representation adapter
```

and:

```text
OS/shell-owned Preview request
→ opaque HostProvided token
→ bounded native request source
```

The two paths may share lifecycle/representation helpers, but they do not collapse source ownership into one artificial token model.

### 3. macOS starts with an internal native Quick Look host/fallback

The initial W4 macOS product target is a Zen-internal native Quick Look host/fallback for strong-native standard formats that W3 intentionally did not duplicate, such as PDF, Office/iWork and media where system Quick Look is the stronger renderer.

For this initial in-app path, the Preview host identity remains the existing `ZenFloating` or `ZenPinned` host. Native presentation should use the already-reserved host-bound `NativeOpaque` representation seam (or a narrowly reviewed equivalent that preserves the same ownership), with the representation token meaningful only to the matching Zen host/native bridge. `MacQuickLookExtension` therefore remains inactive for W4-02.

A broad Finder Quick Look Preview Extension is **not** authorized by default for standard formats. Such an extension is appropriate only when Zen owns a custom UTI/document format or a separately reviewed gap demonstrates real value without hijacking system ownership.

`MacThumbnailService` remains thumbnail infrastructure and is not replaced merely for symmetry.

### 4. Windows prioritizes Explorer Preview Handler

The concrete Windows native-system target is `WindowsPreviewHandler` / Explorer Preview Pane integration.

`WindowsQuickPreview` remains reserved and inactive. W3 already owns the in-app Space/toggle Quick Preview experience; W4 will not invent a second global quick-preview product solely because a contract enum exists.

The Preview Handler should prefer `IInitializeWithStream`, use the normal shell-hosted lifecycle, remain read-only/minimal, and release stream/render resources at `Unload`.

The default architecture must preserve Windows preview-host isolation; opting out of low-integrity hosting requires a separate explicit security review.

### 5. Provider logic may be shared, not forked

If cross-process/native integration requires extracting pure provider/representation logic into a reusable library, the extraction must preserve one provider contract and one authoritative composition policy.

Do not maintain separate app-provider and shell-provider implementations that can drift in capability, safety or parsing behavior.

### 6. Packaging changes are deliberate and platform-specific

Current packaging remains the baseline:

- Windows: per-machine NSIS with existing installer hooks;
- macOS: DMG, macOS 13+, Apple Silicon product target, hardened runtime.

W4 may extend these packages to carry native artifacts and registration, but must not silently migrate the entire Windows product to MSIX or otherwise change the release model solely for convenience.

## Consequences

### Positive

- W3 authority remains intact.
- macOS and Windows can use different native surfaces without false parity.
- native request ownership can remain opaque and lifecycle-bound.
- Zen-owned managed/ephemeral source identity is not needlessly replaced by HostProvided indirection.
- the existing Zen hosts can gain native-backed presentation without pretending they are Finder extension hosts.
- Windows can exploit stream-first shell contracts without turning a path into Preview authority.
- common standard macOS formats keep strong system-native rendering rather than receiving duplicate Zen renderers.

### Costs

- W4 needs explicit cross-process/native lifecycle work.
- Windows COM/prevhost integration and installer cleanup are first-class engineering tasks.
- macOS native host embedding/lifetime must be proven independently from existing thumbnail support.
- some provider code may need careful extraction to support native process boundaries without duplication.

## Rejected alternatives

### A. Build a new native Preview engine per platform

Rejected because it duplicates provider/read/identity/failure truth and would drift from W3.

### B. Pass arbitrary source paths through `hostToken`

Rejected because it defeats the opaque-source contract and creates path authority by another name.

### C. Convert every native-backed Preview source into `HostProvided`

Rejected because Zen-owned Library/Browse requests already have authoritative source identity. Re-tokenizing them would add indirection and risk creating a competing source-lifecycle model without gaining native correctness.

### D. Reclassify the internal macOS native representation as `MacQuickLookExtension`

Rejected because the initial W4 macOS feature is still rendered inside the existing Zen Floating/Pinned Preview experience. Finder extension host identity is reserved for a real separately authorized extension process/surface.

### E. Register a broad macOS Finder Quick Look extension for standard formats

Rejected as the initial strategy because Apple already owns Preview behavior for many common types and positions Preview Extensions around app-supported custom formats.

### F. Activate `WindowsQuickPreview` because the enum exists

Rejected because an implementation contract must not decide the product. W3 already supplies Zen Quick Preview in-app.

### G. Prefer `IInitializeWithFile` on Windows solely because it is easier

Rejected as the default because stream-first initialization is the safer shell contract and better fits the host-provided source model. A path-based fallback requires explicit architecture/security justification.

### H. Move the Windows product to MSIX solely for Preview Handler registration

Rejected. MSIX remains an evaluated packaging alternative, not an automatic W4 migration.

## Validation / revisit triggers

Revisit this ADR only if implementation proves that:

- the current Preview provider architecture cannot be shared without a new durable authority;
- a required OS API makes request-scoped host-provided source ownership impossible;
- a real custom macOS document type requires Finder Quick Look extension ownership;
- Windows shell isolation cannot support the approved renderer architecture;
- packaging/signing constraints require a product-wide installation-model change.

Any such change requires architecture review before production scope widens.
