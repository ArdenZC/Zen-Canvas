# ADR-0005 — Native Preview Host Boundary

Status: **Accepted for W4 activation**

Date: 2026-08-25

Windows amendment: [ADR-0006 — Windows Preview Handler Bounded-Capture Source Model](0006-windows-preview-handler-bounded-capture.md) supersedes the request-long Windows Preview Handler stream-lifetime assumption after W4-03 Stop Condition #5. This ADR remains authoritative for the overall native Host/Adapter boundary, macOS Native Preview Access, opaque `HostProvided` ownership, shell isolation and packaging boundaries.

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

The existing infrastructure contract is also explicit that **a prior eligibility result is not durable byte-read authorization**. Every byte consumer must revalidate at its actual open boundary. That rule remains binding when the eventual reader is a native framework such as Quick Look.

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

For the Windows Explorer Preview Handler specifically, ADR-0006 narrows this sentence: the shell `IStream` is an ingress source only through the bounded `DoPreview` capture phase; deferred HostProvided work is backed by Zen-owned immutable bounded memory, not the original stream.

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

### 3a. Quick Look may not receive a checked-once original source URL

The initial W4 macOS path must preserve the existing Materialization/Read Gate rule that authorization is revalidated at the byte consumer's actual open boundary.

Quick Look opens a supplied URL asynchronously and Zen cannot treat an earlier eligibility/path check as durable authorization for that later open. Therefore W4-02 must **not** hand Quick Look the original managed/provider-backed source URL after a one-time preflight check.

The initial authorized mechanism is a **request/sourceVersion-bound Native Preview Access lease backed by a Zen-owned ephemeral staging snapshot**:

```text
ManagedFile / EphemeralBrowse + expected sourceVersion
        ↓
existing authoritative Read Gate / source resolver
        ↓
fresh eligibility + physical identity check at native-access acquisition
        ↓
authoritative identity-checked open/read
        ↓
complete Zen-owned ephemeral staging snapshot
        ↓
final sourceVersion/freshness revalidation
        ↓
NativeOpaque token bound to session/request/sourceVersion/host
        ↓
Quick Look receives only the staging URL inside backend/native code
```

Binding rules:

- the source snapshot is produced only from an authoritative identity-checked open/read path; a path-based copy performed after a prior check is not sufficient;
- provider/cloud states such as `MaterializationRequired`, `Downloading`, `MetadataOnly`, permission failure, unavailable or identity-changed remain fail-closed and must not be converted into implicit hydration by Quick Look;
- staging must be **complete** before `NativeOpaque` publication; truncated/partial staging is never handed to Quick Look as if it were the source;
- the source must be revalidated against the expected `sourceVersion` after staging and before publication; drift discards the staged artifact and publishes no native representation;
- staging is process-local/ephemeral, stored only in a Zen-owned private temporary namespace, never persisted as file identity or Library truth;
- staging file names may preserve only a backend-derived safe leaf/extension needed for native type recognition; the original source path does not cross the generic renderer wire and is not encoded into the opaque token;
- W4-02 must freeze explicit per-request/per-process byte, disk, deadline and concurrency budgets before production activation; files that cannot be staged within those bounds fall back truthfully rather than bypassing the Read Gate;
- native-access/staging lifetime is bound to the current Preview session/request/sourceVersion/host and is revoked on source switch, cancel, dispose, failure and bounded expiry;
- cleanup must include abandoned/error paths and a bounded startup sweep for Zen-owned stale staging artifacts if crash recovery requires it;
- the native view may keep the staging snapshot alive only for the approved request lifetime; release/close must make cleanup deterministic.

A future platform-native mechanism may replace staging only if it can prove an equivalent identity-bound actual-open guarantee **and** preserve the no-implicit-hydration rule. Such a change requires explicit architecture review; a plain checked-once original URL is not equivalent.

### 4. Windows prioritizes Explorer Preview Handler

The concrete Windows native-system target is `WindowsPreviewHandler` / Explorer Preview Pane integration.

`WindowsQuickPreview` remains reserved and inactive. W3 already owns the in-app Space/toggle Quick Preview experience; W4 will not invent a second global quick-preview product solely because a contract enum exists.

The Preview Handler should prefer `IInitializeWithStream`, use the normal shell-hosted lifecycle, remain read-only/minimal, and release stream/render resources deterministically. ADR-0006 defines the accepted Windows source-lifetime model: the shell stream is retained through `Initialize`, read only during a strictly bounded `DoPreview` ingress phase, released before deferred representation/render work, and never carried as request-long worker state.

The default architecture must preserve Windows preview-host isolation; opting out of low-integrity hosting requires a separate explicit security review.

For stream-initialized Explorer requests, the shell-owned `IStream` is already the request's open ingress source rather than a Zen path precheck. W4 still bounds access/lifetime and must not resolve the stream back into an arbitrary filesystem path.

### 5. Provider logic may be shared, not forked

If cross-process/native integration requires extracting pure provider/representation logic into a reusable library, the extraction must preserve one provider contract and one authoritative composition policy.

Do not maintain separate app-provider and shell-provider implementations that can drift in capability, safety or parsing behavior.

ADR-0006 further narrows the approved Windows reuse seam to pure bounded bytes-to-representation logic; the shell DLL does not inherit app source/read/session authorities merely to reuse rendering logic.

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
- native Quick Look cannot bypass the authoritative actual-open/read boundary merely by receiving a previously checked source URL.
- provider placeholders cannot be silently hydrated by the native preview framework through Zen's initial W4 path.
- Windows can exploit stream-first shell contracts without turning a path into Preview authority.
- common standard macOS formats keep strong system-native rendering rather than receiving duplicate Zen renderers.

### Costs

- W4 needs explicit cross-process/native lifecycle work.
- W4-01/W4-02 need a bounded ephemeral native-access/staging lifecycle in addition to the existing byte-asset registry.
- very large native formats may fall back when they cannot fit the reviewed staging budgets; W4 must prefer truthful limitation over bypassing safety.
- Windows COM/prevhost integration and installer cleanup are first-class engineering tasks.
- macOS native host embedding/lifetime must be proven independently from existing thumbnail support.
- some provider code may need careful extraction to support native process boundaries without duplication.
- Windows W4-03 v2 accepts a bounded synchronous ingress capture cost in `DoPreview` and therefore requires real Explorer/prevhost responsiveness evidence before production associations are activated.

## Rejected alternatives

### A. Build a new native Preview engine per platform

Rejected because it duplicates provider/read/identity/failure truth and would drift from W3.

### B. Pass arbitrary source paths through `hostToken`

Rejected because it defeats the opaque-source contract and creates path authority by another name.

### C. Convert every native-backed Preview source into `HostProvided`

Rejected because Zen-owned Library/Browse requests already have authoritative source identity. Re-tokenizing them would add indirection and risk creating a competing source-lifecycle model without gaining native correctness.

### D. Reclassify the internal macOS native representation as `MacQuickLookExtension`

Rejected because the initial W4 macOS feature is still rendered inside the existing Zen Floating/Pinned Preview experience. Finder extension host identity is reserved for a real separately authorized extension process/surface.

### E. Hand Quick Look the original file URL after a preflight eligibility/identity check

Rejected because Quick Look's asynchronous open would occur after that check and outside the authoritative Read Gate open boundary. The source could be replaced/evicted or provider-backed access could trigger implicit hydration before the native framework opens it.

### F. Register a broad macOS Finder Quick Look extension for standard formats

Rejected as the initial strategy because Apple already owns Preview behavior for many common types and positions Preview Extensions around app-supported custom formats.

### G. Activate `WindowsQuickPreview` because the enum exists

Rejected because an implementation contract must not decide the product. W3 already supplies Zen Quick Preview in-app.

### H. Prefer `IInitializeWithFile` on Windows solely because it is easier

Rejected as the default because stream-first initialization is the safer shell contract and better fits the host-provided source model. A path-based fallback requires explicit architecture/security justification.

### I. Move the Windows product to MSIX solely for Preview Handler registration

Rejected. MSIX remains an evaluated packaging alternative, not an automatic W4 migration.

### J. Carry the Windows shell IStream into deferred worker work and rely on Unload-time COM cancellation

Rejected by W4-03 Stop Condition #5. Deterministic standard-marshaled non-cooperative stream evidence showed that cancellation request success does not imply server-side `Read` termination or source-lock release.

## Validation / revisit triggers

Revisit this ADR only if implementation proves that:

- the current Preview provider architecture cannot be shared without a new durable authority;
- a required OS API makes request-scoped host-provided source ownership impossible;
- a platform-native macOS mechanism can prove equivalent actual-open identity and no-hydration semantics without staging;
- a real custom macOS document type requires Finder Quick Look extension ownership;
- Windows shell isolation cannot support the approved renderer architecture;
- Windows real-host evidence disproves ADR-0006 bounded-capture viability for the conservative supported matrix;
- packaging/signing constraints require a product-wide installation-model change.

Any such change requires architecture review before production scope widens.
